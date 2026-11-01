'use strict';
// Prüft das gemeinsame Tippen mit zufälligen Abläufen: Mehrere Browser tippen gleichzeitig, Nachrichten sind unterwegs, gehen
// verloren oder Verbindungen brechen ab. Verwendet die echte Logik (text-ops.js, text-log.js, text-sync.js); nur Netz und
// Speicher sind nachgebaut. Aufruf: npm run test:text (TEXT_RUNS=… für mehr Abläufe)
const assert = require('assert');
const TextOps = require('../public/js/text-ops.js');
const { TextLog, docKey } = require('../lib/text-log.js');

globalThis.TextOps = TextOps;
const RUNS = Number(process.env.TEXT_RUNS) || 20000;

function random(seed) {
  let s = seed >>> 0 || 1;
  return (n) => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s % n;
  };
}

// Server wie lib/boards.js: nummeriert, rechnet um, verteilt den ganzen Text
class Server {
  constructor(text) {
    this.seq = 1000;
    this.text = text;
    this.log = new TextLog(this.seq);
    this.key = docKey('n', 'text');
    this.clients = [];
  }

  sync(c, base, stale) {
    const entries = this.log.since(this.key, base);
    c.down.push({ type: 'tsync', key: this.key, seq: this.seq, text: this.text, ...(entries && !stale ? { entries } : {}) });
  }

  receive(c, m) {
    if (m.op === 'tsync') return this.sync(c, m.base);
    if (this.log.seen(this.key, m.opId)) return this.sync(c, m.base);
    const ops = this.log.rebase(this.key, m.ops, m.base);
    if (!ops) return this.sync(c, m.base, true);
    this.text = TextOps.apply(this.text, ops);
    const seq = ++this.seq;
    this.log.add(this.key, ops, seq, m.opId);
    for (const x of this.clients) if (x.online) x.down.push({ type: 'ops', seq, text: this.text, edit: { f: 'text', ops, opId: m.opId } });
  }

  // Jemand ohne Sitzung setzt den Text (Rückgängig, Format übertragen)
  replace(text) {
    const ops = TextOps.diff(this.text, text);
    this.text = text;
    const seq = ++this.seq;
    this.log.add(this.key, ops, seq);
    for (const x of this.clients) if (x.online) x.down.push({ type: 'ops', seq, text, edit: null });
  }

  restart() {
    this.log = new TextLog(++this.seq);
    for (const c of this.clients) c.disconnect();
  }
}

(async () => {
  const { TextSessions } = await import('../public/js/text-sync.js');

  class Client {
    constructor(srv, i, rnd) {
      Object.assign(this, { srv, i, rnd, up: [], down: [], online: true });
      this.sessions = new TextSessions((m) => this.up.push(m), () => srv.seq);
      this.s = this.sessions.open({ id: 'n', field: 'text' }, srv.text);
      this.typed = [];
    }

    get text() {
      return this.s.value;
    }

    disconnect() {
      this.online = false;
      this.down = [];
    }

    reconnect() {
      this.online = true;
      this.sessions.reconnected();
    }

    typeChar(char, opts) {
      const v = this.text;
      if (opts.deletes && this.rnd(4) === 0 && v.length) {
        const p = this.rnd(v.length), n = 1 + this.rnd(Math.min(3, v.length - p));
        this.s.type(v.slice(0, p) + v.slice(p + n));
        return;
      }
      const p = this.rnd(v.length + 1);
      this.s.type(v.slice(0, p) + char + v.slice(p), p + 1);
      this.typed.push(char);
    }

    deliver() {
      const m = this.down.shift();
      if (!m) return;
      if (m.type === 'tsync') this.sessions.onSync(m);
      else this.sessions.incoming({ op: 'upsert', el: { id: 'n', text: m.text }, edits: m.edit ? [m.edit] : [] }, m.seq);
    }
  }

  function run(seed, opts) {
    const rnd = random(seed * 2654435761);
    const srv = new Server(opts.deletes ? 'Hallo Welt' : '');
    const clients = [0, 1, 2].slice(0, 2 + rnd(2)).map((i) => new Client(srv, i, rnd));
    srv.clients = clients;
    let next = 0xe000;
    const steps = 20 + rnd(60);
    for (let n = 0; n < steps; n++) {
      const c = clients[rnd(clients.length)];
      switch (rnd(opts.flaky ? 7 : 5)) {
        case 0: case 1: c.typeChar(String.fromCharCode(next++), opts); break;
        case 2: if (c.online && c.up.length) srv.receive(c, c.up.shift()); break;
        case 3: c.deliver(); break;
        case 4:
          if (opts.replace && rnd(10) === 0) srv.replace(`${srv.text.slice(0, rnd(srv.text.length + 1))}#`);
          else if (c.online && c.up.length) srv.receive(c, c.up.shift());
          break;
        case 5: if (c.online) c.disconnect(); else c.reconnect(); break;
        case 6: if (opts.restart && rnd(6) === 0) srv.restart(); else c.deliver(); break;
      }
    }
    // Alles zustellen, Ausfälle wie im Browser über die Nachfrage beheben
    for (const c of clients) if (!c.online) c.reconnect();
    for (let round = 0; round < 400; round++) {
      let idle = true;
      for (const c of clients) {
        while (c.up.length) {
          idle = false;
          srv.receive(c, c.up.shift());
        }
        while (c.down.length) {
          idle = false;
          c.deliver();
        }
      }
      if (idle) {
        const stuck = clients.filter((c) => c.s.busy);
        if (!stuck.length) break;
        stuck.forEach((c) => c.s.requestSync());
      }
    }
    for (const c of clients) clearInterval(c.sessions.timer);
    for (const c of clients) {
      if (c.s.busy) return `Browser ${c.i} bleibt hängen`;
      if (c.text !== srv.text) return `Browser ${c.i} weicht ab: ${JSON.stringify(c.text)} statt ${JSON.stringify(srv.text)}`;
    }
    // Ohne Löschen und Ersetzen geht kein getipptes Zeichen verloren und keines kommt doppelt an
    if (!opts.deletes && !opts.replace && !opts.restart) {
      for (const c of clients) {
        for (const ch of c.typed) {
          const n = srv.text.split(ch).length - 1;
          if (n !== 1) return `Zeichen ${ch.charCodeAt(0).toString(16)} steht ${n}-mal im Text`;
        }
      }
    }
    return null;
  }

  // Rechenregeln: Beide Wege führen zum selben Text
  function converge(seed) {
    const r = random(seed * 40503);
    const pick = (t) => {
      const ops = [];
      let cur = t;
      for (let i = 0, n = 1 + r(3); i < n; i++) {
        if (r(2) && cur.length) {
          const p = r(cur.length);
          ops.push({ p, d: 1 + r(Math.min(4, cur.length - p)) });
        } else ops.push({ p: r(cur.length + 1), i: 'xyzäö'.slice(r(4)) });
        cur = TextOps.apply(cur, ops.slice(-1));
      }
      return ops;
    };
    const t = 'abcdefghijkl'.slice(r(12));
    const a = pick(t), b = pick(t);
    const [a2, b2] = TextOps.transform(a, b);
    const one = TextOps.apply(TextOps.apply(t, b), a2), two = TextOps.apply(TextOps.apply(t, a), b2);
    return one === two ? null : { t, a, b, one, two };
  }

  let failed = 0;
  let bad = null;
  for (let s = 1; s <= RUNS * 5; s++) bad = bad || converge(s);
  console.log(bad ? `Umrechnung falsch: ${JSON.stringify(bad)}` : `Umrechnung: ${RUNS * 5} Paare, beide Wege gleich`);
  if (bad) failed++;

  const SETS = [
    ['Nur Tippen', {}],
    ['Tippen und Löschen', { deletes: true }],
    ['Ersetzen von außen', { deletes: true, replace: true }],
    ['Abbrüche', { flaky: true }],
    ['alles zusammen', { deletes: true, replace: true, flaky: true, restart: true }],
  ];
  for (const [name, opts] of SETS) {
    let count = 0, first = null;
    for (let seed = 1; seed <= RUNS; seed++) {
      const f = run(seed, opts);
      if (f) {
        count++;
        first = first || `Ablauf ${seed}: ${f}`;
      }
    }
    console.log(`${name}: ${RUNS} Abläufe, ${count} Abweichungen${first ? ` (${first})` : ''}`);
    if (count) failed++;
  }

  // Einzelregeln
  const T = TextOps;
  assert.deepStrictEqual(T.diff('aaa', 'aaaa', 2), [{ p: 1, i: 'a' }]);
  assert.deepStrictEqual(T.diff('😀', '😁'), [{ p: 0, d: 2 }, { p: 0, i: '😁' }]);
  assert.strictEqual(T.merge3('Hallo', 'Hallo Welt', 'Oh Hallo'), 'Oh Hallo Welt');
  assert.strictEqual(T.merge3('Hallo', 'Hallo', 'Oh Hallo'), 'Oh Hallo');
  assert.strictEqual(T.apply('abcXdef', T.transform([{ p: 1, d: 4 }], [{ p: 3, i: 'X' }])[0]), 'aXf');
  assert.strictEqual(T.mapPos(3, [{ p: 3, i: 'x' }]), 3);
  assert.strictEqual(T.mapPos(3, [{ p: 1, i: 'x' }]), 4);
  assert.strictEqual(T.valid([{ p: -1, i: 'x' }]), false);
  assert.strictEqual(T.valid([{ p: 1, d: 1, i: 'x' }]), false);
  console.log('Einzelregeln: bestanden');
  process.exit(failed ? 1 : 0);
})();
