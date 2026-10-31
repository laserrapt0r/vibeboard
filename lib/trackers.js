'use strict';
const log = require('./log').child('trackers');
// Abgleich von Karten mit Jira und Azure DevOps in beide Richtungen.
// Änderungen werden über einen Fingerabdruck erkannt; ändern sich Karte und Ticket gleichzeitig, gewinnt das Ticket.
const crypto = require('crypto');
const db = require('./db');
const i18n = require('./i18n');
const boards = require('./boards');
const { sanitizeElement } = require('./sanitize');

const TIMEOUT = 15000;
const MAX_ISSUES = 500;
const PAGE = 100;
const CARD_W = 300, CARD_H = 140, CARD_GAP = 24, COLS = 5;
const SYNC_MS = 5 * 60000;
const MAX_TAGS = 8; // so viele Schlagwörter fasst eine Karte, weitere bleiben nur im Ticket
const running = new Set();

function fail(message, status = 400) {
  return Object.assign(new Error(message), { status });
}

const checkId = (id) => {
  if (!/^\d{1,18}$/.test(String(id))) throw fail('Verbindung nicht gefunden.', 404);
};

/* ---------------- Verbindungen (Administration) ---------------- */

const publicConn = (c) => ({ id: String(c.id), kind: c.kind, name: c.name, baseUrl: c.base_url, username: c.username });

async function connections() {
  return (await db.query('SELECT * FROM tracker_connections ORDER BY name')).rows.map(publicConn);
}

async function createConnection(user, body) {
  const kind = body.kind === 'azure' ? 'azure' : 'jira';
  const name = String(body.name || '').trim().slice(0, 80);
  const baseUrl = String(body.baseUrl || '').trim().replace(/\/+$/, '');
  const secret = String(body.secret || '').trim();
  if (!name || !/^https?:\/\/\S+$/i.test(baseUrl) || !secret) throw fail('Bitte gib Name, Adresse und Token an.');
  const r = await db.one('INSERT INTO tracker_connections (kind, name, base_url, username, secret, created_by) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
    [kind, name, baseUrl, String(body.username || '').trim().slice(0, 200), secret, user.id]);
  return String(r.id);
}

async function removeConnection(id) {
  checkId(id);
  await db.query('DELETE FROM tracker_connections WHERE id = $1', [id]);
}

/* ---------------- Anfragen ---------------- */

function authHeader(c) {
  if (c.kind === 'azure') return 'Basic ' + Buffer.from(':' + c.secret).toString('base64');
  return c.username ? 'Basic ' + Buffer.from(`${c.username}:${c.secret}`).toString('base64') : 'Bearer ' + c.secret;
}

async function call(c, path, { method = 'GET', body, type = 'application/json' } = {}) {
  let res;
  try {
    res = await fetch(c.base_url + path, {
      method, redirect: 'error', signal: AbortSignal.timeout(TIMEOUT),
      headers: { Authorization: authHeader(c), Accept: 'application/json', ...(body ? { 'Content-Type': type } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    log.warn('Dienst nicht erreichbar', { err: e });
    throw fail('Der Dienst ist nicht erreichbar.', 424);
  }
  if (res.status === 204) return null;
  if (!res.ok) {
    log.warn('Anfrage abgelehnt', { status: res.status });
    if (res.status === 400) throw fail('Der Dienst hat die Anfrage abgelehnt. Bitte prüfe die Abfrage.', 424);
    throw fail(res.status === 401 || res.status === 403 ? 'Der Dienst hat die Zugangsdaten abgelehnt.' : `Der Dienst antwortet mit Fehler ${res.status}.`, 424);
  }
  if (res.status === 202) return null;
  // Eine Anmeldeseite oder ein falscher Pfad antwortet oft mit 200 und HTML
  const data = await res.json().catch(() => undefined);
  if (data === undefined) throw fail('Unter dieser Adresse antwortet kein passender Dienst.', 424);
  return data;
}

/* ---------------- Jira ---------------- */

const JIRA_PRIO = { highest: 'critical', blocker: 'critical', critical: 'critical', high: 'high', major: 'high', medium: 'medium', low: 'low', lowest: 'low', minor: 'low', trivial: 'low' };
const JIRA_NAME = { critical: 'Highest', high: 'High', medium: 'Medium', low: 'Low' };
const JIRA_FIELDS = 'summary,description,status,assignee,priority,duedate,labels,updated';

// Neuere Jira-Cloud-Antworten liefern die Beschreibung als Dokumentbaum
function adfText(node) {
  if (!node) return '';
  if (typeof node === 'string') return node;
  if (node.type === 'text') return node.text || '';
  const inner = (node.content || []).map(adfText).join(node.type === 'doc' ? '\n' : '');
  return node.type === 'hardBreak' ? '\n' : inner;
}

function fromJira(i) {
  const f = i.fields || {};
  return {
    id: i.key, updated: String(f.updated || ''), title: String(f.summary || ''), description: adfText(f.description), status: f.status ? String(f.status.name) : '',
    assignee: f.assignee ? String(f.assignee.displayName || '') : '', priority: f.priority ? JIRA_PRIO[String(f.priority.name).toLowerCase()] : undefined, due: f.duedate || '', tags: Array.isArray(f.labels) ? f.labels : [],
  };
}

const jira = {
  async list(c, link) {
    const out = [];
    const cloud = /\.atlassian\.net$/i.test(new URL(c.base_url).hostname);
    let token = '', at = 0;
    while (out.length < MAX_ISSUES) {
      const q = new URLSearchParams({ jql: link.query, fields: JIRA_FIELDS, maxResults: String(PAGE) });
      if (cloud && token) q.set('nextPageToken', token);
      if (!cloud) q.set('startAt', String(at));
      const r = await call(c, `/rest/api/${cloud ? '3/search/jql' : '2/search'}?${q}`);
      const issues = (r && r.issues) || [];
      out.push(...issues.map(fromJira));
      at += issues.length;
      token = r && r.nextPageToken;
      if (!issues.length || (cloud ? !token : at >= (r.total || 0))) break;
    }
    return out.slice(0, MAX_ISSUES);
  },
  async push(c, id, card, remote) {
    const fields = { summary: card.title, description: card.description || '', duedate: card.due || null, labels: (card.tags || []).map((t) => t.replace(/\s+/g, '-')) };
    if (card.priority) fields.priority = { name: JIRA_NAME[card.priority] };
    await call(c, `/rest/api/2/issue/${encodeURIComponent(id)}`, { method: 'PUT', body: { fields } });
    if (card.status && card.status !== remote.status) {
      const t = await call(c, `/rest/api/2/issue/${encodeURIComponent(id)}/transitions`);
      const hit = ((t && t.transitions) || []).find((x) => x.to && String(x.to.name).toLowerCase() === card.status.toLowerCase());
      if (!hit) return `${id}: Status „${card.status}“ ist von hier aus nicht erreichbar`;
      await call(c, `/rest/api/2/issue/${encodeURIComponent(id)}/transitions`, { method: 'POST', body: { transition: { id: hit.id } } });
    }
    return null;
  },
  async create(c, link, card) {
    const r = await call(c, '/rest/api/2/issue', { method: 'POST', body: { fields: { project: { key: link.project }, issuetype: { name: 'Task' }, summary: card.title, description: card.description || '' } } });
    return r.key;
  },
  test: (c) => call(c, '/rest/api/2/myself'),
  url: (c, id) => `${c.base_url}/browse/${encodeURIComponent(id)}`,
};

/* ---------------- Azure DevOps ---------------- */

const AZ_API = 'api-version=7.1';
const AZ_PRIO = { 1: 'critical', 2: 'high', 3: 'medium', 4: 'low' };
const AZ_NUM = { critical: 1, high: 2, medium: 3, low: 4 };
const AZ_FIELDS = ['System.Title', 'System.Description', 'System.State', 'System.AssignedTo', 'System.Tags', 'System.ChangedDate', 'Microsoft.VSTS.Common.Priority', 'Microsoft.VSTS.Scheduling.DueDate', 'Microsoft.VSTS.Scheduling.TargetDate'];
const stripHtml = (s) => String(s || '').replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|li)>/gi, '\n').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').trim();
const htmlOf = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
const azPath = (link) => `/${encodeURIComponent(link.project)}/_apis/wit`;

function fromAzure(w) {
  const f = w.fields || {};
  const due = f['Microsoft.VSTS.Scheduling.DueDate'] || f['Microsoft.VSTS.Scheduling.TargetDate'] || '';
  const who = f['System.AssignedTo'];
  return {
    id: String(w.id), updated: String(f['System.ChangedDate'] || ''), title: String(f['System.Title'] || ''), description: stripHtml(f['System.Description']), status: String(f['System.State'] || ''),
    assignee: who ? String(who.displayName || who) : '', priority: AZ_PRIO[f['Microsoft.VSTS.Common.Priority']], due: String(due).slice(0, 10),
    tags: String(f['System.Tags'] || '').split(';').map((t) => t.trim()).filter(Boolean),
  };
}

const azure = {
  async list(c, link) {
    const r = await call(c, `${azPath(link)}/wiql?${AZ_API}`, { method: 'POST', body: { query: link.query } });
    const ids = ((r && r.workItems) || []).map((w) => w.id).slice(0, MAX_ISSUES);
    const out = [];
    for (let i = 0; i < ids.length; i += PAGE) {
      const q = new URLSearchParams({ ids: ids.slice(i, i + PAGE).join(','), fields: AZ_FIELDS.join(','), 'api-version': '7.1' });
      const page = await call(c, `${azPath(link)}/workitems?${q}`);
      out.push(...((page && page.value) || []).map(fromAzure));
    }
    return out;
  },
  async push(c, id, card, remote, link) {
    const patch = [
      { op: 'add', path: '/fields/System.Title', value: card.title },
      { op: 'add', path: '/fields/System.Description', value: htmlOf(card.description) },
      { op: 'add', path: '/fields/System.Tags', value: (card.tags || []).join('; ') },
    ];
    if (card.priority) patch.push({ op: 'add', path: '/fields/Microsoft.VSTS.Common.Priority', value: AZ_NUM[card.priority] });
    if (card.status && card.status !== remote.status) patch.push({ op: 'add', path: '/fields/System.State', value: card.status });
    await call(c, `${azPath(link)}/workitems/${encodeURIComponent(id)}?${AZ_API}`, { method: 'PATCH', type: 'application/json-patch+json', body: patch });
    return null;
  },
  async create(c, link, card) {
    const body = [{ op: 'add', path: '/fields/System.Title', value: card.title }, { op: 'add', path: '/fields/System.Description', value: htmlOf(card.description) }];
    const r = await call(c, `${azPath(link)}/workitems/$Task?${AZ_API}`, { method: 'POST', type: 'application/json-patch+json', body });
    return String(r.id);
  },
  test: (c) => call(c, `/_apis/projects?${AZ_API}&$top=1`),
  url: (c, id, link) => `${c.base_url}/${encodeURIComponent(link.project)}/_workitems/edit/${encodeURIComponent(id)}`,
};

const client = (c) => (c.kind === 'azure' ? azure : jira);

async function testConnection(id) {
  checkId(id);
  const c = await db.one('SELECT * FROM tracker_connections WHERE id = $1', [id]);
  if (!c) throw fail('Verbindung nicht gefunden.', 404);
  try {
    await client(c).test(c);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: i18n.tr(e.message) };
  }
}

/* ---------------- Abgleich ---------------- */

const SYNCED = (s) => JSON.stringify([s.title || '', s.description || '', s.status || '', s.due || '', s.priority || '', [...(s.tags || [])].sort()]);
const fingerprint = (s) => crypto.createHash('sha256').update(SYNCED(s)).digest('hex').slice(0, 24);

function freeSpot(b) {
  let maxY = null, minX = 0;
  for (const e of b.elements.values()) {
    if (e.type === 'connector' || e.type === 'comment') continue;
    maxY = Math.max(maxY ?? -Infinity, (e.y || 0) + (e.h || 0));
    minX = Math.min(minX, e.x || 0);
  }
  return { x: minX, y: maxY === null ? 0 : maxY + 80 };
}

function cardFrom(issue, base, conn, link) {
  const el = sanitizeElement({
    ...base, type: 'card', title: issue.title, description: issue.description, status: issue.status, assignee: issue.assignee, assigneeId: undefined, priority: issue.priority, due: issue.due,
    tags: issue.tags, key: issue.id, link: client(conn).url(conn, issue.id, link),
    ext: { c: String(conn.id), id: issue.id, updated: issue.updated, hash: '' },
  });
  // Erst nach der Prüfung: Dabei werden z. B. Schlagwörter begrenzt, sonst gälte die Karte als geändert
  if (el) el.ext.hash = fingerprint(el);
  return el;
}

async function run(boardId) {
  const link = await db.one(`SELECT l.*, c.kind, c.base_url, c.username, c.secret FROM board_trackers l JOIN tracker_connections c ON c.id = l.connection_id WHERE l.board_id = $1`, [boardId]);
  if (!link) return { created: 0, updated: 0, pushed: 0, conflicts: 0 };
  const conn = { id: link.connection_id, kind: link.kind, base_url: link.base_url, username: link.username, secret: link.secret };
  const api = client(conn);
  const b = await boards.load(boardId);
  if (!b) return null;
  const issues = await api.list(conn, link);
  const mine = new Map();
  for (const e of b.elements.values()) if (e.type === 'card' && !e.priv && e.ext && e.ext.c === String(conn.id)) mine.set(e.ext.id, e);
  const result = { created: 0, updated: 0, pushed: 0, conflicts: 0, warnings: [] };
  const changes = [];
  const spot = freeSpot(b);
  let z = Math.max(0, ...[...b.elements.values()].map((e) => e.z || 0));
  for (const issue of issues) {
    const card = mine.get(issue.id);
    if (!card) {
      const col = result.created % COLS, row = Math.floor(result.created / COLS);
      const el = cardFrom(issue, { id: crypto.randomBytes(8).toString('base64url').replace(/[^\w-]/g, 'x'), z: ++z, x: spot.x + col * (CARD_W + CARD_GAP), y: spot.y + row * (CARD_H + CARD_GAP), w: CARD_W, h: CARD_H, color: conn.kind === 'azure' ? '#0078d4' : '#2684ff' }, conn, link);
      changes.push(el);
      result.created++;
      continue;
    }
    const localChanged = fingerprint(card) !== card.ext.hash;
    // Frisch angelegte Tickets: Die Änderungszeit ist noch unbekannt
    const remoteChanged = !!card.ext.updated && issue.updated !== card.ext.updated;
    if (remoteChanged) {
      if (localChanged) result.conflicts++;
      changes.push(cardFrom(issue, card, conn, link));
      result.updated++;
    } else if (localChanged) {
      // Ein abgelehntes Ticket darf den Abgleich der übrigen nicht aufhalten
      const warning = await api.push(conn, issue.id, { ...card, title: card.title || issue.title, tags: [...(card.tags || []), ...issue.tags.slice(MAX_TAGS)] }, issue, link).catch((e) => `${issue.id}: ${i18n.tr(e.message)}`);
      if (warning) result.warnings.push(warning);
      // Ist ein Status nicht erreichbar, zeigt die Karte beim nächsten Abgleich wieder den echten Stand des Tickets
      changes.push({ ...card, ext: { ...card.ext, updated: card.ext.updated || issue.updated, hash: fingerprint(card) } });
      result.pushed++;
    } else if (!card.ext.updated) changes.push({ ...card, ext: { ...card.ext, updated: issue.updated } });
  }
  // Der Abgleich kann dauern: Inzwischen gelöschte Karten nicht zurückholen
  boards.setElements(b, changes.filter((el) => el && (b.elements.has(el.id) || !mine.size || !el.ext || !mine.has(el.ext.id))));
  return result;
}

async function sync(boardId) {
  if (running.has(boardId)) return null;
  running.add(boardId);
  try {
    const r = await run(boardId);
    const note = r && r.warnings && r.warnings.length ? r.warnings.join('; ').slice(0, 300) : '';
    await db.query('UPDATE board_trackers SET last_sync = now(), last_error = $2 WHERE board_id = $1', [boardId, note]);
    boards.broadcast(boardId, { type: 'tracker' });
    return r;
  } catch (e) {
    await db.query('UPDATE board_trackers SET last_error = $2 WHERE board_id = $1', [boardId, String(e.message).slice(0, 300)]);
    throw e;
  } finally {
    running.delete(boardId);
  }
}

async function status(boardId) {
  const l = await db.one(`SELECT l.query, l.project, l.last_sync, l.last_error, l.connection_id, c.name, c.kind FROM board_trackers l JOIN tracker_connections c ON c.id = l.connection_id WHERE l.board_id = $1`, [boardId]);
  return l ? { connectionId: String(l.connection_id), name: l.name, kind: l.kind, query: l.query, project: l.project, lastSync: l.last_sync ? new Date(l.last_sync).getTime() : null, lastError: i18n.tr(l.last_error) } : null;
}

async function linkBoard(boardId, user, body) {
  checkId(body.connectionId);
  const c = await db.one('SELECT kind FROM tracker_connections WHERE id = $1', [body.connectionId]);
  if (!c) throw fail('Verbindung nicht gefunden.', 404);
  const query = String(body.query || '').trim().slice(0, 2000);
  const project = String(body.project || '').trim().slice(0, 200);
  if (!query) throw fail('Bitte gib eine Abfrage an.');
  if (c.kind === 'azure' && !project) throw fail('Für Azure DevOps ist das Projekt nötig.');
  await db.query(
    `INSERT INTO board_trackers (board_id, connection_id, query, project, created_by) VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (board_id) DO UPDATE SET connection_id = EXCLUDED.connection_id, query = EXCLUDED.query, project = EXCLUDED.project, last_error = ''`,
    [boardId, body.connectionId, query, project, user.id]);
}

async function unlink(boardId) {
  await db.query('DELETE FROM board_trackers WHERE board_id = $1', [boardId]);
}

// Karte als neues Ticket anlegen
async function createIssue(boardId, elementId, user, role) {
  const link = await db.one(`SELECT l.*, c.id AS cid, c.kind, c.base_url, c.username, c.secret FROM board_trackers l JOIN tracker_connections c ON c.id = l.connection_id WHERE l.board_id = $1`, [boardId]);
  if (!link) throw fail('Dieses Board ist nicht verbunden.');
  if (!link.project) throw fail('Für neue Tickets fehlt das Projekt in der Verbindung des Boards.');
  const b = await boards.load(boardId);
  const card = b && b.elements.get(String(elementId));
  if (!card || card.type !== 'card' || !boards.canSeeElement(b, card, user.id, role)) throw fail('Karte nicht gefunden.', 404);
  if (card.ext) throw fail('Diese Karte ist bereits verbunden.', 409);
  const conn = { id: link.cid, kind: link.kind, base_url: link.base_url, username: link.username, secret: link.secret };
  const id = await client(conn).create(conn, link, card);
  // Noch keine Änderungszeit bekannt: Der nächste Abgleich übernimmt sie, die Karte gilt so lange als unverändert
  boards.setElements(b, [{ ...card, key: id, link: client(conn).url(conn, id, link), ext: { c: String(conn.id), id, updated: '', hash: fingerprint(card) } }]);
  return { id };
}

function schedule() {
  const tick = async () => {
    const rows = (await db.query('SELECT board_id FROM board_trackers')).rows;
    for (const r of rows) await sync(r.board_id).catch((e) => log.warn('Abgleich fehlgeschlagen', { boardId: r.board_id, reason: e.message }));
  };
  setInterval(() => tick().catch((e) => log.error('Abgleich nicht möglich', { err: e })), SYNC_MS).unref();
}

module.exports = { connections, createConnection, removeConnection, testConnection, sync, status, linkBoard, unlink, createIssue, schedule, fingerprint };
