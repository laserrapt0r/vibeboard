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
const SECRET = { concealed: 'MARKE-VERBORGEN-7f3a', priv: 'MARKE-PRIVAT-91c2', token: 'MARKE-TOKEN-55de', file: 'MARKE-DATEI-20ab', template: 'MARKE-EIGENES-c4e1' };

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
// Änderungen, die auch mit Ansehen- oder Gast-Rolle erlaubt sind, weil sie das Board nicht ändern
const READ_ROLE_WRITES = new Map(Object.entries({
  'POST /api/boards/:id/duplicate': 'legt eine eigene Kopie an, siehe duplicates()',
  'DELETE /api/boards/:id/members/:uid': 'nur sich selbst entfernen; der Test nutzt eine fremde Kennung',
}));
// Zusätzlich für die Rolle Kommentieren: bewusst erlaubt
const COMMENTER_WRITES = new Set(['POST /api/boards/:id/recordings', 'POST /api/boards/:id/reviews/:rid/decision', 'POST /api/boards/:id/ops', 'POST /api/boards/:id/signal']);
// Nur der Besitzer, auch nicht die Rolle Bearbeiten
const OWNER_ONLY = [
  ['DELETE', '/api/boards/:id'], ['POST', '/api/boards/:id/members', { email: 'stranger@example.org', role: 'viewer' }], ['PATCH', '/api/boards/:id/members/:uid', { role: 'owner' }],
  ['GET', '/api/boards/:id/guest-links'], ['POST', '/api/boards/:id/guest-links', {}], ['PATCH', '/api/boards/:id', { linkAccess: 'edit' }],
];
// Geben ohne Objekt-Bezug bewusst 404 auch für Berechtigte (kein Testinhalt vorhanden)
const NO_FIXTURE = new Set(['GET /api/boards/:id/recordings/:rid/audio', 'GET /api/boards/:id/poll', 'GET /api/boards/:id/files/:fid/preview', 'GET /api/boards/:id/files/:fid/pdf', 'GET /api/guest/:token', 'GET /api/invites/:token', 'GET /api/legal/:kind']);
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mNk+M9Qz0AEYBxVSFIhAJbzBA3rQ8u4AAAAAElFTkSuQmCC';
// Routen, die ohne passenden Inhalt schon an der Eingabe scheitern würden, statt an den Rechten
const BODY = { 'POST /api/boards/:id/ops': { clientId: 'zugriffsprobe0001', ops: [] } };

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

  // Offene Streams liefern sofort Kopfzeilen und laufen weiter: Dann zählt, was bis zur Frist ankam
  async call(method, url, body) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
      const r = await fetch(BASE + url, {
        method, redirect: 'manual', signal: controller.signal,
        headers: { 'X-Vibeboard': '1', 'Content-Type': 'application/json', ...(this.cookie ? { Cookie: this.cookie } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      for (const h of r.headers.getSetCookie()) if (/^(__Host-)?vb_sid=/.test(h)) this.cookie = h.split(';')[0];
      let text = '';
      const stream = /event-stream/.test(r.headers.get('content-type') || '');
      if (stream) {
        const reader = r.body.getReader();
        const deadline = Date.now() + 700;
        while (Date.now() < deadline) {
          const next = await Promise.race([reader.read(), new Promise((res) => setTimeout(() => res(null), Math.max(1, deadline - Date.now())))]);
          if (!next || next.done) break;
          text += Buffer.from(next.value).toString();
        }
        controller.abort();
      } else text = await r.text();
      return { status: r.status, text };
    } catch (e) {
      return { status: 0, text: '', error: e.message };
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
  const { token } = await owner.json('POST', `/api/boards/${id}/guest-links`, { role: 'commenter', days: 7 });
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
  // Weitere Objekte, damit jede Route einen echten Gegenstand hat
  const vid = (await owner.json('POST', `/api/boards/${id}/versions`, { label: 'Stand' })).id;
  const rec = await owner.json('POST', `/api/boards/${id}/recordings`, { durationMs: 2000, track: [] });
  const team = await owner.json('POST', '/api/teams', { name: 'Team' });
  const folder = await owner.json('POST', '/api/folders', { name: 'Ordner' });
  const template = await owner.json('POST', '/api/templates', { name: 'Vorlage', elements: [{ id: 'a1', type: 'sticky', x: 0, y: 0, w: 10, h: 10, text: SECRET.template }] });
  const trashed = (await owner.json('POST', '/api/boards', { name: 'Papierkorb', elements: [{ id: 't1', type: 'sticky', x: 0, y: 0, w: 10, h: 10, text: SECRET.template }] })).id;
  for (const b of [id, trashed]) {
    await fetch(`${BASE}/api/boards/${b}/thumb`, { method: 'PUT', body: PNG, headers: { 'X-Vibeboard': '1', 'Content-Type': 'text/plain', Cookie: owner.cookie } });
  }
  await owner.json('DELETE', `/api/boards/${trashed}`);
  return { id, fid: file.id, rid, tracker: trk.id, vid: String(vid), recording: rec.id, team: team.id || team.team?.id, folder: folder.id || folder.folder?.id, template: template.id, trashed };
}

// Jede Route bekommt einen echten Gegenstand: Mit erfundenen Kennungen käme ein 404 und bewiese nichts
function fill(r, ids) {
  const p = r.pattern;
  const value = (k) => {
    if (k === 'id') return p.startsWith('/api/trash') ? ids.trashed : ids.id;
    if (k === 'tid') return p.includes('trackers') ? ids.tracker : p.includes('templates') ? ids.template : ids.team;
    if (k === 'fid') return p.startsWith('/api/folders') ? ids.folder : ids.fid;
    if (k === 'rid') return p.includes('recordings') ? ids.recording : ids.rid;
    return { vid: ids.vid, eid: 'noteX', kind: 'privacy', uid: ids.uid, sid: '0123456789abcdef', token: 'x'.repeat(32) }[k] ?? '1';
  };
  const url = p.replace(/:(\w+)/g, (m, k) => encodeURIComponent(value(k)));
  return /\/(events|poll)$/.test(p) ? `${url}?client=sweep${Math.random().toString(36).slice(2, 14)}` : url;
}

// Abgelehnt heißt: Rechte fehlen oder die Verbindung fehlt. 400 oder 500 wären nur ein Zufallstreffer der Eingabeprüfung.
const allowed = (s) => [401, 403, 404, 405, 409, 410].includes(s);
const leaks = (text) => Object.values(SECRET).filter((v) => text.includes(v));
const hasParam = (r) => r.pattern.includes('/:') && !r.pattern.startsWith('/api/admin') && !r.pattern.startsWith('/api/auth');

async function sweep(list, people, ids) {
  const { anon, stranger, viewer, commenter, editor, owner, guest } = people;
  const rejected = (p, r, s, what) => {
    check(s.status !== 0, `${p.name}: ${r.key} → keine Antwort (${s.error})`);
    check(allowed(s.status), `${what}: ${p.name} ${r.key} → ${s.status}`);
    check(!leaks(s.text).length, `${p.name} sieht Geheimes: ${r.key}`);
  };
  for (const r of list) {
    const url = fill(r, ids);
    const write = r.method !== 'GET';
    const body = write ? BODY[r.key] || {} : undefined;
    // Gegenprobe: Mit Berechtigung gibt es diese Route samt Gegenstand wirklich
    if (!write && !NO_FIXTURE.has(r.key)) {
      const who = r.pattern.startsWith('/api/admin') ? people.admin : owner;
      const s = await who.call('GET', url);
      check(s.status !== 0 && s.status !== 404, `Gegenprobe: ${r.key} antwortet dem Berechtigten mit ${s.status}, der Test beweist hier nichts`);
    }
    if (!PUBLIC.has(r.key)) rejected(anon, r, await anon.call(r.method, url, body), 'ohne Anmeldung offen');
    // Fremde: nichts an Objekten anderer
    if (hasParam(r) && !PUBLIC.has(r.key)) rejected(stranger, r, await stranger.call(r.method, url, body), 'fremde Person kommt durch');
    if (r.pattern.startsWith('/api/admin')) {
      for (const p of [stranger, editor]) {
        const s = await p.call(r.method, url, body);
        check(s.status === 403, `Administration offen für ${p.name}: ${r.key} → ${s.status}`);
      }
    }
    if (!write) {
      for (const p of [viewer, commenter, editor, guest, stranger]) {
        const s = await p.call('GET', fill(r, ids));
        const found = leaks(s.text);
        check(!found.length, `${p.name} sieht Geheimes über ${r.key}: ${found.join(', ')}`);
      }
      continue;
    }
    // Lesende Rollen dürfen nichts ändern; jede Antwort wird auch auf Geheimes geprüft
    if (r.pattern.startsWith('/api/boards/:id') && !READ_ROLE_WRITES.has(r.key)) {
      rejected(viewer, r, await viewer.call(r.method, url, body), 'darf ändern');
      // Der Gastlink des Tests erlaubt Kommentieren
      if (!COMMENTER_WRITES.has(r.key)) for (const p of [commenter, guest]) rejected(p, r, await p.call(r.method, url, body), 'darf ändern');
    }
  }
  for (const [method, pattern, body] of OWNER_ONLY) {
    const s = await editor.call(method, fill({ pattern }, ids), body);
    check(s.status === 403, `Bearbeiten darf, was dem Besitzer vorbehalten ist: ${method} ${pattern} → ${s.status}`);
  }
}

// Kopien dürfen nicht mitnehmen, was die kopierende Person nicht sehen darf
async function duplicates(people, ids) {
  const check2 = async (who, copy, how) => {
    const s = await who.call('GET', `/api/boards/${copy}/events?client=copy${Math.random().toString(36).slice(2, 14)}&transport=poll`);
    check(s.status === 200, `${how}: Kopie nicht lesbar → ${s.status}`);
    check(!leaks(s.text).length, `${how}: Kopie enthält Geheimes`);
    for (const suffix of ['', '/info', '/preview']) {
      const f = await who.call('GET', `/api/boards/${copy}/files/${ids.fid}${suffix}`);
      check(f.status === 404, `${how}: Datei aus verborgenem Bereich in der Kopie → ${f.status}`);
    }
  };
  const a = await people.viewer.json('POST', `/api/boards/${ids.id}/duplicate`, {});
  await check2(people.viewer, a.id, 'Betrachter dupliziert');
  const b = await people.editor.json('POST', `/api/boards/${ids.id}/versions/${ids.vid}/copy`, {});
  await check2(people.editor, b.id, 'Bearbeiten kopiert Version');
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

// Regeln innerhalb der Board-Operationen, die schon einmal fehlten
async function operations(people, ids) {
  const url = `/api/boards/${ids.id}`;
  const join = async (p) => {
    const client = `ops${p.name}${Math.random().toString(36).slice(2, 12)}`;
    await p.json('GET', `${url}/events?client=${client}&transport=poll`);
    return (ops) => p.json('POST', `${url}/ops`, { clientId: client, ops });
  };
  const state = async () => (await people.owner.call('GET', `${url}/events?client=stand${Math.random().toString(36).slice(2, 12)}&transport=poll`)).text;
  const client = `opsviewer${Math.random().toString(36).slice(2, 12)}`;
  await people.viewer.json('GET', `${url}/events?client=${client}&transport=poll`);
  const refused = await people.viewer.call('POST', `${url}/ops`, { clientId: client, ops: [{ op: 'upsert', el: { id: 'viewerNote', type: 'sticky', x: 0, y: 900, w: 100, h: 100, text: 'von Betrachter' } }] });
  check(refused.status === 403, `Betrachter sendet Operationen → ${refused.status}`);
  check(!(await state()).includes('viewerNote'), 'Betrachter legt über ops ein Element an');
  const editor = await join(people.editor);
  const r = await editor([{ op: 'privateMode', active: false }]);
  check(r.blocked === 'privateMode', 'Bearbeiten deckt fremden privaten Modus auf');
  check((await state()).includes(SECRET.priv) && !(await people.viewer.call('GET', `${url}/events?client=probe${Math.random().toString(36).slice(2, 12)}&transport=poll`)).text.includes(SECRET.priv), 'Private Inhalte nach dem Versuch nicht mehr privat');
  const owner = await join(people.owner);
  await owner([{ op: 'privateMode', active: true, anonymous: false }]);
  await editor([{ op: 'upsert', el: { id: 'fakeNote', type: 'sticky', x: 0, y: 1100, w: 100, h: 100, text: 'x', author: 'Jemand Anderes', anon: true } }]);
  // Feldänderungen unterliegen denselben Regeln wie vollständige Elemente
  await editor([{ op: 'patch', id: 'noteP', set: { x: 1 }, unset: ['text'] }]);
  check((await state()).includes(SECRET.priv), 'Feldänderung an fremdem privatem Element');
  const peek = await editor([{ op: 'patch', id: 'noteP', set: { x: 2 }, unset: [] }, { op: 'patch', id: 'noteX', set: { x: 3060 }, unset: [] }, { op: 'patch', id: 'noteP', set: { priv: null, hidden: false }, unset: ['priv'] }]);
  check(!JSON.stringify(peek).includes(SECRET.priv) && !JSON.stringify(peek).includes(SECRET.concealed), 'Antwort auf Feldänderungen enthält fremde Inhalte');
  check(!(await people.viewer.call('GET', `${url}/events?client=probe${Math.random().toString(36).slice(2, 12)}&transport=poll`)).text.includes(SECRET.priv), 'Feldänderung macht privates Element sichtbar');
  await editor([{ op: 'patch', id: 'fakeNote', set: { author: 'Jemand Anderes', anon: true }, unset: [] }]);
  const full = await state();
  check(!/"id":"fakeNote"[^}]*"author":"Jemand Anderes"/.test(full), 'Fremder Name an einem Element');
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
    await duplicates(people, ids);
    await operations(people, ids);
    await sweep(list, people, ids);
    const survived = await people.owner.call('GET', `/api/boards/${ids.id}/members`);
    check(survived.status === 200, 'Das Board hat den Test nicht überstanden');
    // Administration: Geheimnisse werden auch ihr nicht ausgeliefert
    for (const r of list.filter((x) => x.method === 'GET' && x.pattern.startsWith('/api/admin'))) {
      const s = await admin.call('GET', fill(r, ids));
      check(!s.text.includes(SECRET.token), `Geheimnis in ${r.key}`);
    }
    // Außerhalb des Routers: Sie dürfen nichts Geheimes enthalten
    for (const p of ['/healthz', '/api/info', '/api/config']) check(!leaks((await people.anon.call('GET', p)).text).length, `Geheimes in ${p}`);
    // SCIM: aus, dann eingeschaltet ohne und mit falschem Token
    const scimPaths = ['/scim/v2/Users', '/scim/v2/ServiceProviderConfig', '/scim/v2/Schemas', '/scim/v2/ResourceTypes', `/scim/v2/Users/${ids.uid}`];
    for (const p of scimPaths) check((await people.anon.call('GET', p)).status === 404, `SCIM ohne Einschalten offen: ${p}`);
    await admin.json('PUT', '/api/admin/settings', { scim: { enabled: true } });
    await admin.json('POST', '/api/admin/scim/token');
    for (const p of scimPaths) check((await people.anon.call('GET', p)).status === 401, `SCIM ohne Token offen: ${p}`);
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
