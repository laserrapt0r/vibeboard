'use strict';
// Lasttest fürs gemeinsame Arbeiten: Viele simulierte Personen tippen, bewegen den Zeiger und melden Cursor, wie echte Browser.
// Gemessen wird die Zeit von der Eingabe, bis sie bei allen Beteiligten ankommt. Nichts für die CI: Das Ergebnis hängt vom Rechner ab.
//
//   BASE=http://127.0.0.1:3310 ADMIN_EMAIL=… ADMIN_PASSWORD=… npm run test:load
//   PERSONS=5,10,20,30  Stufen
//   SECONDS=20          Dauer je Stufe
//   SHARED=0.3          Anteil, der in dieselbe Notiz tippt
//   ELEMENTS=500        Größe des Boards
//   WORKERS=4           Prozesse, die die Personen spielen (sonst misst man den Testrechner)
const { fork } = require('child_process');

const BASE = process.env.BASE || 'http://127.0.0.1:3310';
const LEVELS = String(process.env.PERSONS || '5,10,20,30').split(',').map(Number);
const SECONDS = Number(process.env.SECONDS) || 20;
const SHARED = Number(process.env.SHARED ?? 0.3);
const ELEMENTS = Number(process.env.ELEMENTS) || 500;
const WORKERS = Number(process.env.WORKERS) || 4;
const CHARS_PER_SECOND = 4; // zügiges Tippen
const CURSOR_MS = 100;
const CARET_MS = 150;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const percentile = (sorted, p) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] : 0);

async function login() {
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'X-Vibeboard': '1', 'Content-Type': 'application/json' },
    body: JSON.stringify({ login: process.env.ADMIN_EMAIL || 'admin@test.example', password: process.env.ADMIN_PASSWORD || 'Rotkehlchen-Wolke-47' }),
  });
  if (!r.ok) throw new Error(`Anmeldung gescheitert: ${r.status}`);
  return { 'X-Vibeboard': '1', 'Content-Type': 'application/json', Cookie: r.headers.getSetCookie()[0].split(';')[0] };
}

/* ---------------- Eine simulierte Person ---------------- */

class Person {
  constructor(i, job, stats) {
    Object.assign(this, { i, job, stats, id: `lt${process.pid}x${i}`, seq: 0, pending: null, text: '', stop: false, ctrl: new AbortController() });
    this.note = job.shared ? job.sharedNote : job.notes[i % job.notes.length];
  }

  async connect() {
    const r = await fetch(`${BASE}/api/boards/${this.job.board}/events?client=${this.id}`, { headers: this.job.headers, signal: this.ctrl.signal });
    if (!r.ok) throw new Error(`Verbindung: ${r.status}`);
    const reader = r.body.getReader();
    const dec = new TextDecoder();
    let rest = '';
    let greeted;
    const hello = new Promise((res) => (greeted = res));
    (async () => {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) return;
        const chunk = rest + dec.decode(value, { stream: true });
        const end = chunk.lastIndexOf('\n');
        rest = end < 0 ? chunk : chunk.slice(end + 1);
        if (end < 0) continue;
        this.stats.bytes += end;
        // Bewusst ohne JSON.parse jeder Nachricht: Sonst misst der Test vor allem sich selbst
        for (const m of chunk.slice(0, end).matchAll(/"seq":(\d+)/g)) this.seq = Math.max(this.seq, Number(m[1]));
        for (const m of chunk.slice(0, end).matchAll(/"opId":"(lt[^"]+)"/g)) this.arrived(m[1]);
        if (chunk.includes('"type":"hello"')) greeted();
      }
    })().catch(() => {});
    await Promise.race([hello, wait(15000)]);
  }

  arrived(opId) {
    const at = this.job.sent.get(opId);
    if (at === undefined) return;
    this.stats.delays.push(Date.now() - at);
    if (opId === this.pending) this.pending = null;
  }

  post(path, body) {
    return fetch(`${BASE}/api/boards/${this.job.board}/${path}`, { method: 'POST', headers: this.job.headers, body: JSON.stringify({ clientId: this.id, ...body }) })
      .then((r) => {
        if (!r.ok) this.stats.errors++;
        return r.arrayBuffer();
      })
      .catch(() => this.stats.errors++);
  }

  // Wie im Browser: immer nur ein Paket unterwegs, was danach getippt wird, geht gesammelt raus
  async type() {
    this.buffer = (this.buffer || 0) + 1;
    if (this.pending) return;
    const count = this.buffer;
    this.buffer = 0;
    const opId = `lt${process.pid}x${this.i}n${++this.stats.count}`;
    this.pending = opId;
    this.job.sent.set(opId, Date.now());
    await this.post('ops', { ops: [{ op: 'ttext', id: this.note, field: 'text', ops: [{ p: 0, i: 'x'.repeat(count) }], base: this.seq, opId }] });
  }

  run() {
    const every = (ms, fn) => {
      const t = setInterval(fn, ms);
      this.timers = [...(this.timers || []), t];
    };
    every(1000 / CHARS_PER_SECOND, () => this.type());
    every(CURSOR_MS, () => this.post('signal', { kind: 'cursor', data: { x: this.i * 10, y: Date.now() % 1000 } }));
    every(CARET_MS, () => this.post('signal', { kind: 'caret', data: { id: this.note, field: 'text', pos: 1, end: 1 } }));
  }

  close() {
    (this.timers || []).forEach(clearInterval);
    this.ctrl.abort();
  }
}

async function worker() {
  process.on('message', async (msg) => {
    if (msg.type !== 'start') return;
    const stats = { delays: [], errors: 0, count: 0, bytes: 0 };
    const job = { ...msg.job, sent: new Map() };
    const people = msg.people.map(({ i, shared }) => new Person(i, { ...job, shared }, stats));
    for (const p of people) {
      await p.connect();
      await wait(40);
    }
    process.send({ type: 'ready' });
    process.once('message', async () => {
      people.forEach((p) => p.run());
      await wait(msg.seconds * 1000);
      people.forEach((p) => p.close());
      await wait(1500);
      process.send({ type: 'done', stats });
      process.exit(0);
    });
  });
}

/* ---------------- Ablauf ---------------- */

async function level(persons, headers, board, notes, sharedNote) {
  const procs = Array.from({ length: WORKERS }, () => fork(__filename, ['worker']));
  const shares = Array.from({ length: WORKERS }, () => []);
  for (let i = 0; i < persons; i++) shares[i % WORKERS].push({ i, shared: i < persons * SHARED });
  const job = { board, notes, sharedNote, headers };
  const ready = procs.map((p) => new Promise((r) => p.once('message', r)));
  procs.forEach((p, n) => p.send({ type: 'start', job, people: shares[n], seconds: SECONDS }));
  await Promise.all(ready);
  const done = procs.map((p) => new Promise((r) => p.on('message', (m) => m.type === 'done' && r(m.stats))));
  procs.forEach((p) => p.send({ type: 'go' }));
  const samples = [];
  const end = Date.now() + SECONDS * 1000;
  while (Date.now() < end) {
    const t = Date.now();
    await fetch(`${BASE}/healthz`).catch(() => {});
    samples.push(Date.now() - t);
    await wait(500);
  }
  const all = await Promise.all(done);
  const delays = all.flatMap((s) => s.delays).sort((a, b) => a - b);
  samples.sort((a, b) => a - b);
  return {
    persons,
    sentChars: all.reduce((a, s) => a + s.count, 0),
    p50: percentile(delays, 0.5), p95: percentile(delays, 0.95), p99: percentile(delays, 0.99), max: delays[delays.length - 1] || 0,
    health95: percentile(samples, 0.95),
    errors: all.reduce((a, s) => a + s.errors, 0),
    mbPerPerson: Math.round((all.reduce((a, s) => a + s.bytes, 0) / persons / SECONDS / 1024 / 1024) * 100) / 100,
  };
}

async function main() {
  const headers = await login();
  const board = (await (await fetch(`${BASE}/api/boards`, { method: 'POST', headers, body: JSON.stringify({ name: 'Lasttest' }) })).json()).id;
  const opener = `ltopen${process.pid}`;
  const ctrl = new AbortController();
  await fetch(`${BASE}/api/boards/${board}/events?client=${opener}`, { headers, signal: ctrl.signal });
  await wait(400);
  const noteCount = Math.max(...LEVELS);
  const notes = Array.from({ length: noteCount }, (_, i) => `note${i}`);
  const sharedNote = 'shared';
  const els = [...notes, sharedNote, ...Array.from({ length: ELEMENTS }, (_, i) => `fill${i}`)].map((id, i) => ({
    id, type: 'sticky', x: (i % 40) * 220, y: Math.floor(i / 40) * 220, w: 200, h: 200, z: i + 1, text: 'Lasttest', fill: '#fff9b1',
  }));
  for (let i = 0; i < els.length; i += 200) {
    const r = await fetch(`${BASE}/api/boards/${board}/ops`, { method: 'POST', headers, body: JSON.stringify({ clientId: opener, ops: els.slice(i, i + 200).map((el) => ({ op: 'upsert', el })) }) });
    if (!r.ok) throw new Error(`Board füllen: ${r.status}`);
  }
  console.log(`Board mit ${els.length} Elementen, je Stufe ${SECONDS} s, ${Math.round(SHARED * 100)} % in derselben Notiz, ${WORKERS} Testprozesse`);
  console.log('Personen  Eingaben  Median  95 %   99 %   Maximum  Antwort Server  Fehler  MB/s je Person');
  for (const persons of LEVELS) {
    const r = await level(persons, headers, board, notes, sharedNote);
    console.log([String(r.persons).padEnd(9), String(r.sentChars).padEnd(9), `${r.p50} ms`.padEnd(7), `${r.p95} ms`.padEnd(6), `${r.p99} ms`.padEnd(6), `${r.max} ms`.padEnd(8), `${r.health95} ms`.padEnd(15), String(r.errors).padEnd(7), r.mbPerPerson].join(' '));
    await wait(2000);
  }
  ctrl.abort();
  process.exit(0);
}

if (process.argv[2] === 'worker') worker();
else main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
