'use strict';
// Prüft die Zugriffsrechte der laufenden Anwendung: Alle Routen werden aus dem Router gelesen und mit jeder Rolle aufgerufen.
// Neue Routen sind dadurch automatisch erfasst. Aufruf: DATABASE_URL=postgres://… npm run test:access
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const PORT = Number(process.env.ACCESS_PORT) || 3399;
const BASE = `http://127.0.0.1:${PORT}`;
const PASSWORD = 'Rechte-Pruefung-2026';
const ROOT = path.join(__dirname, '..');

// Testmarken: dürfen außerhalb der Berechtigten in keiner Antwort stehen
const SECRET = { concealed: 'MARKE-VERBORGEN-7f3a', priv: 'MARKE-PRIVAT-91c2', token: 'MARKE-TOKEN-55de', file: 'MARKE-DATEI-20ab' };

// Öffentlich mit Begründung. Eine neue Route gehört nur nach bewusster Entscheidung hierher.
const PUBLIC = new Map(Object.entries({
  'GET /api/config': 'Anmeldeseite braucht Einstellungen, keine Geheimnisse',
  'GET /api/legal': 'Impressum und Datenschutz sind öffentlich',
  'GET /api/legal/:kind': 'Impressum und Datenschutz sind öffentlich',
  'GET /api/guest/:token': 'Gastlink, geschützt durch das Token',
  'POST /api/guest/join': 'Gastlink, geschützt durch das Token',
  'GET /api/invites/:token': 'Einladung, geschützt durch das Token',
  'POST /api/auth/login': 'Anmeldung', 'POST /api/auth/login/mfa': 'Anmeldung', 'POST /api/auth/logout': 'Abmeldung ohne Wirkung ohne Sitzung',
  'POST /api/auth/register': 'Registrierung', 'POST /api/auth/verify': 'Token', 'POST /api/auth/resend-verification': 'antwortet immer gleich',
  'POST /api/auth/forgot': 'antwortet immer gleich', 'POST /api/auth/reset': 'Token',
  'GET /api/auth/oidc/start': 'Anmeldung', 'GET /api/auth/oidc/callback': 'Anmeldung', 'GET /api/auth/kerberos': 'Anmeldung',
  'GET /api/auth/saml/start': 'Anmeldung', 'POST /api/auth/saml/acs': 'Anmeldung', 'GET /api/auth/saml/metadata': 'Anmeldung',
}));
// Eigene Daten jeder angemeldeten Person; enthalten kein fremdes Board
const OWN_DATA = /^\/api\/(auth|boards$|boards\/import|trash|tasks|notifications|teams|folders|templates|webhooks|guest|invitations)/;
// Darf, wer nur ansehen oder kommentieren darf, ohne dass etwas am Board geändert wird
const READ_ROLE_WRITES = new Set([
  'POST /api/boards/:id/ops', 'POST /api/boards/:id/signal', 'POST /api/boards/:id/reviews/:rid/decision', 'POST /api/boards/:id/leave',
  'DELETE /api/boards/:id/leave', 'DELETE /api/boards/:id/members/:uid', 'POST /api/boards/:id/folder', 'PUT /api/boards/:id/folder', 'POST /api/boards/:id/duplicate',
  'POST /api/boards/:id/retro/next', 'PUT /api/boards/:id/thumb',
]);
const STREAM = /\/(events|stream|poll)$/;

let failures = 0, checks = 0;
const fail = (msg) => {
  failures++;
  console.error('✗ ' + msg);
};
const check = (ok, msg) => {
  checks++;
  if (!ok) fail(msg);
};

class Person {
  constructor(name) {
    this.name = name;
    this.cookie = '';
  }

  async call(method, url, body) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    try {
      const r = await fetch(BASE + url, {
        method, redirect: 'manual', signal: controller.signal,
        headers: { 'X-Vibeboard': '1', 'Content-Type': 'application/json', ...(this.cookie ? { Cookie: this.cookie } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      for (const h of r.headers.getSetCookie()) if (/^(__Host-)?vb_sid=/.test(h)) this.cookie = h.split(';')[0];
      return { status: r.status, text: await r.text() };
    } catch (e) {
      return { status: 0, text: '', aborted: e.name === 'AbortError' };
    } finally {
      clearTimeout(timer);
    }
  }

  async json(method, url, body) {
    const r = await this.call(method, url, body);
    let data = null;
    try {
      data = JSON.parse(r.text);
    } catch {
      /* keine JSON-Antwort */
    }
    if (r.status >= 400) throw new Error(`${this.name}: ${method} ${url} → ${r.status} ${r.text.slice(0, 160)}`);
    return data;
  }
}

function routes() {
  const { Router } = require('../lib/router');
  const router = new Router();
  for (const f of fs.readdirSync(path.join(ROOT, 'lib/routes'))) {
    const mod = require(path.join(ROOT, 'lib/routes', f));
    if (mod.register) mod.register(router);
  }
  return router.routes.map((r) => ({ method: r.method, pattern: r.pattern, key: `${r.method} ${r.pattern}` }));
}

// Der Server legt keine Felder wie „hidden“ an: Wer sie prüft, prüft nichts
function staticChecks() {
  for (const dir of ['lib', 'lib/routes']) {
    for (const f of fs.readdirSync(path.join(ROOT, dir)).filter((n) => n.endsWith('.js'))) {
      const text = fs.readFileSync(path.join(ROOT, dir, f), 'utf8');
      text.split('\n').forEach((line, i) => {
        checks++;
        if (/(?<![.\w])(el|card|e|element)\.hidden\b/.test(line)) fail(`${dir}/${f}:${i + 1}: „hidden“ ist im Server nie gesetzt – boards.canSeeElement verwenden`);
      });
    }
  }
}

async function start() {
  const url = new URL(process.env.DATABASE_URL);
  const db = url.pathname.slice(1);
  const admin = new Client({ connectionString: process.env.DATABASE_URL.replace(/\/[^/]*$/, '/postgres') });
  await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS ${db}`);
  await admin.query(`CREATE DATABASE ${db}`);
  await admin.end();
  const proc = spawn(process.execPath, ['server.js'], {
    cwd: ROOT, stdio: ['ignore', 'ignore', 'inherit'],
    env: { ...process.env, PORT: String(PORT), HOST: '127.0.0.1', CLAMAV_HOST: '', ADMIN_EMAIL: 'admin@example.org', ADMIN_PASSWORD: PASSWORD, ADMIN_NAME: 'Admin', LOG_LEVEL: 'error', PUBLIC_URL: BASE },
  });
  for (let i = 0; i < 80; i++) {
    const ok = await fetch(BASE + '/healthz').then((r) => r.ok).catch(() => false);
    if (ok) return proc;
    await new Promise((r) => setTimeout(r, 250));
  }
  proc.kill();
  throw new Error('Server startet nicht');
}

async function login(person, email) {
  await person.json('POST', '/api/auth/login', { login: email, password: PASSWORD });
  return person;
}

// Board mit Inhalten, die nicht alle sehen dürfen
async function seed(people) {
  const { admin, owner } = people;
  await admin.json('PUT', '/api/admin/settings', {
    security: { requireVirusScan: false }, collab: { guestLinks: true, webhooks: true },
    oidc: { clientSecret: SECRET.token }, ldap: { bindPassword: SECRET.token }, smtp: { pass: SECRET.token },
  });
  const trk = await admin.json('POST', '/api/admin/trackers', { kind: 'jira', name: 'Probe', baseUrl: 'http://127.0.0.1:9/', username: 'x', secret: SECRET.token });
  const id = (await owner.json('POST', '/api/boards', { name: 'Rechte', elements: [
    { id: 'frame1', type: 'frame', x: 0, y: 0, w: 800, h: 500, title: 'Offen', z: 1 },
    { id: 'note1', type: 'sticky', x: 50, y: 50, w: 100, h: 100, text: 'öffentlich', z: 2 },
    { id: 'card1', type: 'card', x: 1000, y: 0, w: 300, h: 140, title: 'Karte', z: 3 },
    { id: 'table1', type: 'table', x: 1400, y: 0, w: 300, h: 100, rows: 1, cols: 1, cells: [['a']], z: 4 },
  ] })).id;
  for (const role of ['editor', 'commenter', 'viewer']) await owner.json('POST', `/api/boards/${id}/members`, { email: `${role}@example.org`, role });
  const link = await owner.json('POST', `/api/boards/${id}/guest-links`, { role: 'comment', days: 7 });
  const token = link.token || (link.url || '').split('/').pop();
  const guest = new Person('gast');
  await guest.json('POST', '/api/guest/join', { token, name: 'Gast', consent: true });
  people.guest = guest;
  // Eine Datei in einem verborgenen Bereich
  const up = await fetch(`${BASE}/api/boards/${id}/files`, { method: 'POST', body: '%PDF-1.4 probe', headers: { 'X-Vibeboard': '1', 'Content-Type': 'application/octet-stream', 'X-File-Name': `${SECRET.file}.pdf`, Cookie: owner.cookie } });
  const file = await up.json();
  // Inhalte über die Echtzeit-Verbindung anlegen, wie im Browser
  const client = 'zugriffstest0001';
  await owner.json('GET', `/api/boards/${id}/events?client=${client}&transport=poll`);
  const send = (ops) => owner.json('POST', `/api/boards/${id}/ops`, { clientId: client, ops });
  await send([
    { op: 'upsert', el: { id: 'frameX', type: 'frame', x: 3000, y: 0, w: 800, h: 500, title: 'Verborgener Bereich', concealed: true, z: 5 } },
    { op: 'upsert', el: { id: 'noteX', type: 'sticky', x: 3050, y: 50, w: 100, h: 100, text: SECRET.concealed, z: 6 } },
    { op: 'upsert', el: { id: 'cardX', type: 'card', x: 3200, y: 50, w: 300, h: 140, title: SECRET.concealed, z: 7 } },
    { op: 'upsert', el: { id: 'fileX', type: 'file', x: 3050, y: 200, w: 220, h: 260, fileId: file.id, name: `${SECRET.file}.pdf`, mime: 'application/pdf', size: 14, z: 8 } },
  ]);
  await send([{ op: 'privateMode', action: 'start', active: true }]);
  await send([{ op: 'upsert', el: { id: 'noteP', type: 'sticky', x: 1000, y: 300, w: 100, h: 100, text: SECRET.priv, z: 9 } }]);
  await new Promise((r) => setTimeout(r, 300));
  await owner.json('POST', `/api/boards/${id}/reviews`, { elementId: 'fileX', reviewers: [people.ids.owner] });
  await owner.json('POST', `/api/boards/${id}/reviews`, { elementId: 'frame1', reviewers: [people.ids.commenter] });
  const rid = (await owner.json('GET', `/api/boards/${id}/reviews`)).reviews.find((r) => r.elementId === 'frame1').id;
  return { id, fid: file.id, rid, tid: trk.id };
}

function fill(pattern, ids) {
  return pattern.replace(/:(\w+)/g, (m, k) => ({ id: ids.id, fid: ids.fid, rid: ids.rid, tid: ids.tid, eid: 'noteX', kind: 'privacy', uid: ids.uid, sid: '0123456789abcdef', token: 'x'.repeat(32) }[k] ?? '1'));
}

// 409 und 410: keine aktive Verbindung zum Board
const allowed = (s) => [401, 403, 404, 405, 409, 410].includes(s);
const leaks = (text) => Object.values(SECRET).filter((v) => text.includes(v));

async function sweep(list, people, ids) {
  const { anon, stranger, viewer, commenter, editor, guest } = people;
  for (const r of list) {
    const url = fill(r.pattern, ids);
    const write = r.method !== 'GET';
    const body = write ? {} : undefined;
    // Ohne Anmeldung: nur ausdrücklich öffentliche Routen
    if (!PUBLIC.has(r.key)) {
      const a = await anon.call(r.method, url, body);
      check(allowed(a.status) || a.status === 0, `ohne Anmeldung offen: ${r.key} → ${a.status}`);
    }
    // Fremde Personen: nichts an diesem Board
    if (/\/:id(\/|$)/.test(r.pattern) && !/^\/api\/guest/.test(r.pattern)) {
      const s = await stranger.call(r.method, url, body);
      check(allowed(s.status) || (s.status === 400 && write) || s.status === 0, `fremde Person kommt durch: ${r.key} → ${s.status}`);
      check(!leaks(s.text).length, `fremde Person sieht Geheimes: ${r.key}`);
    }
    if (r.pattern.startsWith('/api/admin')) {
      for (const p of [stranger, editor]) {
        const s = await p.call(r.method, url, body);
        check(s.status === 403, `Administration offen für ${p.name}: ${r.key} → ${s.status}`);
      }
    }
    // Lesen: Geheimes bleibt bei den Berechtigten
    if (!write) {
      for (const p of [viewer, commenter, editor, guest, stranger]) {
        if (STREAM.test(r.pattern)) continue;
        const s = await p.call('GET', url);
        const found = leaks(s.text);
        check(!found.length, `${p.name} sieht Geheimes über ${r.key}: ${found.join(', ')}`);
      }
    }
    // Ansehen und Gast: keine Änderungen
    if (write && /\/:id(\/|$)/.test(r.pattern) && !READ_ROLE_WRITES.has(r.key)) {
      for (const p of [viewer, guest]) {
        const s = await p.call(r.method, url, body);
        check(s.status < 200 || s.status >= 300, `${p.name} darf ändern: ${r.key} → ${s.status}`);
      }
    }
  }
}

// Der Live-Stand der Board-Verbindung: das, was der Browser tatsächlich bekommt
async function liveState(people, ids) {
  for (const name of ['viewer', 'commenter', 'editor', 'guest']) {
    const p = people[name];
    const s = await p.call('GET', `/api/boards/${ids.id}/events?client=probe${name}0000000&transport=poll`);
    check(s.status === 200, `${name} kann das Board nicht öffnen → ${s.status}`);
    const found = leaks(s.text);
    check(!found.length, `${name} bekommt Geheimes im Board-Stand: ${found.join(', ')}`);
  }
  // Gegenprobe: Berechtigte sehen die Marken wirklich, sonst würde dieser Test nichts beweisen
  const own = await people.owner.call('GET', `/api/boards/${ids.id}/events?client=probeowner0000000&transport=poll`);
  check(own.text.includes(SECRET.concealed), 'Gegenprobe: Besitzer sieht den verborgenen Inhalt nicht');
  check(own.text.includes(SECRET.priv), 'Gegenprobe: Private Notiz fehlt beim Besitzer');
  const rev = await people.owner.call('GET', `/api/boards/${ids.id}/reviews`);
  check(rev.text.includes(SECRET.file), 'Gegenprobe: Besitzer sieht die Freigabe der Datei nicht');
  const info = await people.owner.call('GET', `/api/boards/${ids.id}/files/${ids.fid}/info`);
  check(info.text.includes(SECRET.file), 'Gegenprobe: Besitzer sieht die Datei nicht');
  const bad = await people.viewer.call('GET', `/api/boards/${ids.id}/files/${ids.fid}`);
  check(bad.status === 404, `Betrachter lädt Datei aus verborgenem Bereich → ${bad.status}`);
}

async function main() {
  staticChecks();
  const proc = await start();
  try {
    const list = routes();
    const admin = new Person('admin');
    await login(admin, 'admin@example.org');
    const names = ['owner', 'editor', 'commenter', 'viewer', 'stranger'];
    const people = { admin, anon: new Person('ohne Anmeldung'), ids: {} };
    for (const n of names) {
      const u = await admin.json('POST', '/api/admin/users', { name: n, email: `${n}@example.org`, password: PASSWORD, role: 'user' });
      people.ids[n] = u.id;
      people[n] = await login(new Person(n), `${n}@example.org`);
    }
    const ids = await seed(people);
    ids.uid = people.ids.owner;
    await liveState(people, ids);
    await sweep(list, people, ids);
    const survived = await people.owner.call('GET', `/api/boards/${ids.id}/members`);
    check(survived.status === 200, 'Das Board hat den Test nicht überstanden');
    // Administration: Geheimnisse werden auch ihr nicht ausgeliefert
    for (const r of list.filter((x) => x.method === 'GET' && x.pattern.startsWith('/api/admin'))) {
      const s = await admin.call('GET', fill(r.pattern, ids));
      check(!s.text.includes(SECRET.token), `Geheimnis in ${r.key}`);
    }
    // SCIM ohne Token
    for (const p of ['/scim/v2/Users', '/scim/v2/ServiceProviderConfig']) {
      const s = await people.anon.call('GET', p);
      check(s.status === 404 || s.status === 401, `SCIM offen: ${p} → ${s.status}`);
    }
    console.log(`${list.length} Routen, ${checks} Prüfungen, ${failures} Fehler`);
  } finally {
    proc.kill();
  }
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error('Abbruch:', e);
  process.exit(1);
});
