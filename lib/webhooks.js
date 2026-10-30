'use strict';
const log = require('./log').child('webhooks');
// Chat-Anbindung per Webhook (Microsoft Teams, Slack, Matrix oder allgemein JSON).
// Der Server ruft dabei fremde Adressen auf. Schutz vor Missbrauch (SSRF):
//   – nur https (http nur, wenn interne Adressen ausdrücklich erlaubt sind), keine Zugangsdaten in der Adresse
//   – die Zieladresse wird aufgelöst und geprüft; interne Netze (localhost, private Netze, Link-Local) sind gesperrt,
//     solange die Administration sie nicht freigibt
//   – die Verbindung geht genau an die geprüfte IP-Adresse (kein erneutes Auflösen → kein DNS-Rebinding)
//   – keine Weiterleitungen, kurze Zeitlimits, Antwort wird verworfen
// Protokolliert wird nur der Hostname, nie die Adresse (sie enthält meist ein Geheimnis).
const dns = require('dns').promises;
const net = require('net');
const http = require('http');
const https = require('https');
const db = require('./db');
const settings = require('./settings');

const USER_EVENTS = { mention: 'Erwähnungen', reply: 'Antworten', task: 'Zuweisungen', team_invite: 'Team-Einladungen' };
const TEAM_EVENTS = { board_shared: 'Board für das Team freigegeben', retro_summary: 'Retro-Zusammenfassungen' };
const FORMATS = ['generic', 'slack', 'teams', 'matrix'];
const MAX_PER_OWNER = 10;
const DISABLE_AFTER = 20; // aufeinanderfolgende Fehler

// Getrennte Listen: Eine BlockList mit IPv4-gemappten Netzen träfe sonst auf jede IPv4-Adresse zu
const blocked4 = new net.BlockList();
for (const [a, b] of [['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16], ['172.16.0.0', 12],
  ['192.0.0.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['224.0.0.0', 4], ['240.0.0.0', 4]]) blocked4.addSubnet(a, b, 'ipv4');
const blocked6 = new net.BlockList();
for (const [a, b] of [['::', 128], ['::1', 128], ['fc00::', 7], ['fe80::', 10], ['fec0::', 10], ['ff00::', 8], ['64:ff9b:1::', 48]]) blocked6.addSubnet(a, b, 'ipv6');

// IPv6-Adresse in acht 16-Bit-Blöcke zerlegen
function hextets(ip) {
  let s = ip.split('%')[0].toLowerCase();
  const v4 = /(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(s);
  if (v4) s = s.slice(0, v4.index) + ((+v4[1] << 8) | +v4[2]).toString(16) + ':' + ((+v4[3] << 8) | +v4[4]).toString(16);
  const [head, tail] = s.split('::');
  const a = head ? head.split(':') : [], b = tail ? tail.split(':') : [];
  const mid = s.includes('::') ? Array(8 - a.length - b.length).fill('0') : [];
  return [...a, ...mid, ...b].map((x) => parseInt(x, 16));
}

const v4of = (hi, lo) => `${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`;

// In IPv6 eingebettete IPv4-Adresse: gemappt, kompatibel, NAT64 und 6to4
function embeddedV4(h) {
  if (h.slice(0, 5).every((x) => x === 0) && (h[5] === 0xffff || h[5] === 0)) return v4of(h[6], h[7]);
  if (h[0] === 0x64 && h[1] === 0xff9b && h.slice(2, 6).every((x) => x === 0)) return v4of(h[6], h[7]);
  if (h[0] === 0x2002) return v4of(h[1], h[2]);
  return null;
}

function fail(message, status = 400) {
  return Object.assign(new Error(message), { status });
}

function isInternal(ip) {
  if (!net.isIPv6(ip)) return blocked4.check(ip, 'ipv4');
  if (blocked6.check(ip, 'ipv6')) return true;
  const v4 = embeddedV4(hextets(ip));
  return !!v4 && blocked4.check(v4, 'ipv4');
}

async function checkUrl(raw) {
  const s = (await settings.get()).collab;
  let u;
  try {
    u = new URL(String(raw || '').trim());
  } catch {
    throw fail('Bitte gib eine gültige Webhook-Adresse an.');
  }
  if (u.protocol !== 'https:' && !(u.protocol === 'http:' && s.webhookPrivate)) throw fail('Webhook-Adressen müssen mit https:// beginnen.');
  if (u.username || u.password) throw fail('Die Adresse darf keine Zugangsdaten enthalten.');
  if (String(raw).length > 2000) throw fail('Die Adresse ist zu lang.');
  return u;
}

// Zieladresse auflösen und prüfen; liefert die zu verwendende IP
async function resolveTarget(u) {
  const s = (await settings.get()).collab;
  const host = u.hostname.replace(/^\[|\]$/g, '');
  let addrs;
  try {
    addrs = net.isIP(host) ? [{ address: host, family: net.isIPv6(host) ? 6 : 4 }] : await dns.lookup(host, { all: true, verbatim: true });
  } catch {
    throw fail('Der Hostname lässt sich nicht auflösen.');
  }
  if (!addrs.length) throw fail('Der Hostname lässt sich nicht auflösen.');
  if (!s.webhookPrivate && addrs.some((a) => isInternal(a.address))) {
    throw fail('Webhooks an interne Adressen sind nicht erlaubt (Administration → Zusammenarbeit).', 403);
  }
  return addrs[0];
}

function payload(format, msg) {
  const text = msg.url ? `${msg.text}\n${msg.url}` : msg.text;
  switch (format) {
    case 'slack':
      return { text: msg.url ? `${msg.text}\n<${msg.url}|${msg.linkText || 'Öffnen'}>` : msg.text };
    case 'teams':
      // Ältere Connectoren lesen „text“, Workflows („Bei Webhook-Anfrage im Kanal posten“) die Adaptive Card
      return {
        text,
        type: 'message',
        attachments: [{
          contentType: 'application/vnd.microsoft.card.adaptive',
          content: {
            $schema: 'http://adaptivecards.io/schemas/adaptive-card.json', type: 'AdaptiveCard', version: '1.4',
            body: [{ type: 'TextBlock', text: msg.title || 'vibeboard', weight: 'Bolder', wrap: true }, { type: 'TextBlock', text: msg.text, wrap: true }],
            ...(msg.url ? { actions: [{ type: 'Action.OpenUrl', title: msg.linkText || 'Öffnen', url: msg.url }] } : {}),
          },
        }],
      };
    case 'matrix':
      return { text, msgtype: 'm.notice', username: 'vibeboard' };
    default:
      return { event: msg.event, title: msg.title || '', text: msg.text, url: msg.url || null, at: new Date().toISOString(), ...(msg.data ? { data: msg.data } : {}) };
  }
}

async function post(urlStr, body) {
  const u = await checkUrl(urlStr);
  const target = await resolveTarget(u);
  const data = Buffer.from(JSON.stringify(body));
  const mod = u.protocol === 'https:' ? https : http;
  return new Promise((resolve, reject) => {
    const req = mod.request({
      protocol: u.protocol, hostname: u.hostname, port: u.port || undefined, path: u.pathname + u.search, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': data.length, 'User-Agent': 'vibeboard-webhook' },
      // genau die geprüfte Adresse verwenden (TLS prüft weiterhin den Hostnamen)
      lookup: (_h, o, cb) => (o && o.all ? cb(null, [{ address: target.address, family: target.family }]) : cb(null, target.address, target.family)),
      timeout: 5000,
    }, (res) => {
      res.resume();
      res.on('end', () => (res.statusCode >= 200 && res.statusCode < 300 ? resolve(res.statusCode) : reject(fail(`Antwort ${res.statusCode}`))));
    });
    req.on('timeout', () => req.destroy(fail('Zeitüberschreitung')));
    req.on('error', reject);
    req.end(data);
  });
}

async function deliver(hook, msg) {
  const host = (() => {
    try {
      return new URL(hook.url).hostname;
    } catch {
      return '?';
    }
  })();
  try {
    const status = await post(hook.url, payload(hook.format, msg));
    await db.query('UPDATE webhooks SET last_at = now(), last_status = $2, failures = 0 WHERE id = $1', [hook.id, String(status)]);
    log.debug('Webhook zugestellt', { webhookId: hook.id, host, event: msg.event });
  } catch (e) {
    await db.query('UPDATE webhooks SET last_at = now(), last_status = $2, failures = failures + 1 WHERE id = $1', [hook.id, String(e.message).slice(0, 120)]).catch(() => {});
    log.warn('Webhook konnte nicht zugestellt werden', { webhookId: hook.id, host, event: msg.event, reason: e.message });
  }
}

async function enabled() {
  return !!(await settings.get()).collab.webhooks;
}

// Ereignis für eine Person (Benachrichtigungen) bzw. ein Team – läuft im Hintergrund, Fehler blockieren nichts
function forUser(userId, event, msg) {
  run(`SELECT * FROM webhooks WHERE user_id = $1 AND $2 = ANY(events) AND failures < ${DISABLE_AFTER}`, [userId, event], { ...msg, event });
}

function forTeam(teamId, event, msg) {
  run(`SELECT * FROM webhooks WHERE team_id = $1 AND $2 = ANY(events) AND failures < ${DISABLE_AFTER}`, [teamId, event], { ...msg, event });
}

function run(sql, args, msg) {
  (async () => {
    if (!(await enabled())) return;
    const hooks = (await db.query(sql, args)).rows;
    for (const h of hooks) await deliver(h, msg);
  })().catch((e) => log.error('Webhooks konnten nicht verarbeitet werden', { err: e }));
}

/* ---------------- Verwaltung ---------------- */

const pub = (h) => ({
  id: String(h.id), name: h.name, format: h.format, events: h.events, createdAt: new Date(h.created_at).getTime(),
  // Adresse nur gekürzt anzeigen – sie enthält meist ein Geheimnis
  host: (() => { try { return new URL(h.url).host; } catch { return ''; } })(),
  lastAt: h.last_at ? new Date(h.last_at).getTime() : null, lastStatus: h.last_status, failures: h.failures, disabled: h.failures >= DISABLE_AFTER,
});

async function list(owner) {
  const rows = (await db.query(`SELECT * FROM webhooks WHERE ${owner.teamId ? 'team_id' : 'user_id'} = $1 ORDER BY created_at`, [owner.teamId || owner.userId])).rows;
  return rows.map(pub);
}

async function create(owner, body, userId) {
  if (!(await enabled())) throw fail('Webhooks sind in dieser Installation abgeschaltet.', 403);
  const allowed = owner.teamId ? TEAM_EVENTS : USER_EVENTS;
  const events = [...new Set((Array.isArray(body.events) ? body.events : []).map(String))].filter((e) => Object.hasOwn(allowed, e));
  if (!events.length) throw fail('Bitte wähle mindestens ein Ereignis.');
  const format = FORMATS.includes(body.format) ? body.format : 'generic';
  const u = await checkUrl(body.url);
  await resolveTarget(u);
  const col = owner.teamId ? 'team_id' : 'user_id';
  const n = Number((await db.one(`SELECT count(*) AS n FROM webhooks WHERE ${col} = $1`, [owner.teamId || owner.userId])).n);
  if (n >= MAX_PER_OWNER) throw fail(`Höchstens ${MAX_PER_OWNER} Webhooks möglich.`);
  const row = await db.one(`INSERT INTO webhooks (${col}, name, url, format, events, created_by) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [owner.teamId || owner.userId, String(body.name || '').trim().slice(0, 60), u.toString(), format, events, userId]);
  return pub(row);
}

async function remove(owner, id) {
  if (!/^\d{1,18}$/.test(String(id))) throw fail('Webhook nicht gefunden.', 404);
  const r = await db.one(`DELETE FROM webhooks WHERE id = $1 AND ${owner.teamId ? 'team_id' : 'user_id'} = $2 RETURNING id`, [id, owner.teamId || owner.userId]);
  if (!r) throw fail('Webhook nicht gefunden.', 404);
}

// Testnachricht – setzt bei Erfolg auch einen wegen Fehlern pausierten Webhook zurück
async function test(owner, id, origin) {
  if (!/^\d{1,18}$/.test(String(id))) throw fail('Webhook nicht gefunden.', 404);
  const h = await db.one(`SELECT * FROM webhooks WHERE id = $1 AND ${owner.teamId ? 'team_id' : 'user_id'} = $2`, [id, owner.teamId || owner.userId]);
  if (!h) throw fail('Webhook nicht gefunden.', 404);
  if (!(await enabled())) throw fail('Webhooks sind in dieser Installation abgeschaltet.', 403);
  try {
    await post(h.url, payload(h.format, { event: 'test', title: 'vibeboard', text: '✅ Testnachricht von vibeboard – der Webhook funktioniert.', url: origin || null }));
  } catch (e) {
    await db.query('UPDATE webhooks SET last_at = now(), last_status = $2 WHERE id = $1', [h.id, String(e.message).slice(0, 120)]);
    throw fail(`Zustellung fehlgeschlagen: ${e.message}`, 422);
  }
  await db.query(`UPDATE webhooks SET last_at = now(), last_status = '200', failures = 0 WHERE id = $1`, [h.id]);
}

module.exports = { forUser, forTeam, list, create, remove, test, enabled, USER_EVENTS, TEAM_EVENTS, FORMATS, isInternal, payload };
