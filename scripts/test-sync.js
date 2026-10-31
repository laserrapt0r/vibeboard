'use strict';
// Prüft den Abgleich gleichzeitiger Änderungen mit zufälligen Abläufen: Mehrere Browser ändern dieselben Elemente, Bestätigung
// und Live-Stream überholen sich, Antworten gehen verloren, der Server lehnt ab, Verbindungen brechen ab. Am Ende müssen alle
// denselben Stand haben wie der Server. Verwendet die echte Logik aus public/js/merge.js; nur Server und Netz sind nachgestellt.
// Aufruf: npm run test:sync (SYNC_RUNS=… für mehr Abläufe)
const path = require('path');

const RUNS = Number(process.env.SYNC_RUNS) || 20000;
const clone = (x) => JSON.parse(JSON.stringify(x));

function random(seed) {
  let s = seed >>> 0 || 1;
  return (n) => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s % n;
  };
}

// Tabellen vereinfacht: tpatch setzt eine Zelle und geht an alle, tstruct fügt vorn eine Zeile ein und geht an alle außer den
// Absender. Wie im Original hängt das Ergebnis also von der Reihenfolge ab: Eine Zelle gehört zu ihrer Zeilennummer.
function applyTable(el, op) {
  if (op.op === 'tstruct') return { ...el, rows: [op.row, ...el.rows] };
  if (op.at >= el.rows.length) return el;
  return { ...el, rows: el.rows.map((v, i) => (i === op.at ? op.val : v)) };
}

class Server {
  constructor(els) {
    this.els = new Map(clone(els).map((e) => [e.id, e]));
    this.seq = 1000;
    this.seen = new Set();
    this.clients = [];
  }

  // wie expandPatches und applyOps: ein Paket, eine Nummer
  receive(from, ops, m, { refuse }) {
    const seq = ++this.seq;
    const others = [], all = [], refused = new Set(), gone = [];
    for (const op of ops) {
      const id = m.idOf(op);
      if (refuse(op)) refused.add(id);
      else if (op.op === 'patch') {
        const prev = this.els.get(id);
        if (!prev) {
          gone.push(id);
          continue;
        }
        const el = m.applyPatch(prev, op);
        this.els.set(id, el);
        others.push({ op: 'upsert', el });
      } else if (op.op === 'upsert') {
        this.els.set(id, clone(op.el));
        others.push(op);
      } else if (op.op === 'delete') {
        if (this.els.delete(id)) others.push(op);
      } else if (this.seen.has(op.opId)) {
        // Wiederholung nach verlorener Antwort: nicht doppelt ausführen, gültigen Stand zurückgeben
        refused.add(id);
      } else if (this.els.has(id)) {
        this.seen.add(op.opId);
        this.els.set(id, applyTable(this.els.get(id), op));
        (op.op === 'tpatch' ? all : others).push(op);
      }
    }
    // wie applyOps: erst am Ende des Pakets, damit der Stand vollständig ist
    const revert = [...refused].map((id) => {
      const cur = this.els.get(id);
      return cur ? { op: 'upsert', el: clone(cur) } : { op: 'delete', id };
    });
    // wie applyOps: Gesamtstände zeigen den Endstand des Pakets
    const whole = new Set([...others, ...all].filter((o) => o.op === 'upsert').map((o) => o.el.id));
    const struct = new Set(others.filter((o) => o.op === 'tstruct').map((o) => o.id));
    for (const o of all) {
      if (o.op !== 'tpatch' || !struct.has(o.id) || whole.has(o.id)) continue;
      whole.add(o.id);
      others.push({ op: 'upsert', el: this.els.get(o.id) });
    }
    const final = (list) => list
      .filter((o) => !((o.op === 'tstruct' || o.op === 'tpatch') && whole.has(o.id)))
      .map((o) => (o.op === 'upsert' && this.els.has(o.el.id) ? { ...o, el: this.els.get(o.el.id) } : o));
    for (const c of this.clients) {
      const list = final(c === from ? all : [...others, ...all]);
      if (list.length) c.stream.push({ ops: clone(list), seq, epoch: c.epoch });
    }
    return { seq, revert: clone(revert), gone };
  }
}

class Browser {
  constructor(name, server, els, m) {
    Object.assign(this, { name, server, m });
    this.els = new Map(clone(els).map((e) => [e.id, e]));
    this.merge = new m.Reconciler({ applyOther: applyTable, now: () => 0 });
    this.queue = new Map();
    this.extra = [];
    this.sending = [];
    this.stream = [];  // Live-Stream: in sich geordnet
    this.replies = []; // Antworten auf POST: unabhängig davon
    this.outbox = [];
    this.epoch = 0;
    this.connected = true;
  }

  change(id, fields) {
    const prev = this.els.get(id);
    if (!prev) return;
    const next = { ...prev, ...fields };
    this.els.set(id, next);
    this.merge.touch(id, prev);
    this.m.enqueue(this.queue, next, prev);
  }

  table(op) {
    const prev = this.els.get(op.id);
    if (!prev) return;
    this.merge.touch(op.id, prev);
    this.els.set(op.id, applyTable(prev, op));
    this.extra.push(this.m.stamped(op));
  }

  remove(id) {
    const prev = this.els.get(id);
    if (!prev) return;
    this.els.delete(id);
    this.merge.touch(id, prev);
    this.m.enqueueDelete(this.queue, id);
  }

  add(el) {
    this.els.set(el.id, el);
    this.merge.touch(el.id, undefined);
    this.m.enqueue(this.queue, el, undefined);
  }

  flush() {
    if (!this.queue.size && !this.extra.length) return;
    const part = [...this.queue.values(), ...this.extra];
    this.queue.clear();
    this.extra = [];
    this.sending.push(part);
    this.outbox.push(part);
  }

  open(id) {
    const out = [...this.sending.flat(), ...this.extra].filter((o) => this.m.idOf(o) === id);
    if (this.queue.has(id)) out.push(this.queue.get(id));
    return out;
  }

  isOpen(id) {
    return this.open(id).length > 0;
  }

  show(id) {
    const v = this.merge.view(id, this.open(id));
    if (!v) return;
    if (v.el) this.els.set(id, v.el);
    else this.els.delete(id);
  }

  raw(op) {
    if (op.op === 'delete') this.els.delete(op.id);
    else if (op.op === 'upsert') this.els.set(op.el.id, op.el);
    else if (this.els.has(op.id)) this.els.set(op.id, applyTable(this.els.get(op.id), op));
  }

  onStream(msg) {
    if (msg.epoch !== this.epoch) return;
    for (const op of msg.ops) {
      const id = this.m.idOf(op);
      if (op.op === 'upsert' || op.op === 'delete') {
        if (this.merge.remote(op, msg.seq)) this.show(id);
        else this.raw(op);
      } else if (this.merge.partial(op, msg.seq)) {
        if (this.merge.has(id)) this.show(id);
        else this.raw(op);
      }
    }
  }

  onReply(part, res) {
    for (const id of res.gone) {
      const op = part.find((o) => o.op === 'patch' && o.id === id);
      const v = op && this.m.wasRetried(op) && this.merge.view(id, this.open(id));
      if (v && v.el) this.queue.set(id, this.m.stamped({ op: 'upsert', el: clone(v.el) }));
    }
    this.sending = this.sending.filter((p) => p !== part);
    this.merge.acked(part, res.seq);
    part.forEach((o) => {
      this.m.supersede(this.queue, o);
      this.m.supersedeParts(this.outbox, o);
    });
    for (const op of res.revert) if (!this.merge.remote(op, res.seq)) this.raw(op);
    for (const op of part) this.show(this.m.idOf(op));
  }

  // Antwort verloren oder Verbindung gestört: wie post().catch
  onLost(part) {
    this.sending = this.sending.filter((p) => p !== part);
    for (const o of part) {
      if (['upsert', 'patch', 'delete'].includes(o.op)) this.m.requeue(this.queue, o);
      else this.extra.push(o);
    }
    this.extra.sort(this.m.byStamp);
  }

  // wie s.on('hello'): Der Live-Stream begann neu, der Stand kommt vollständig
  hello() {
    this.epoch++;
    this.stream = [];
    const before = this.els;
    this.els = new Map(clone([...this.server.els.values()]).map((e) => [e.id, e]));
    this.merge.reset();
    const seq = this.server.seq;
    for (const op of [...this.sending.flat(), ...this.extra, ...this.queue.values()]) {
      const id = this.m.idOf(op);
      this.merge.rebase(id, this.els.get(id), seq);
    }
    for (const op of [...this.sending.flat(), ...this.extra, ...this.queue.values()]) {
      const id = this.m.idOf(op);
      if (op.op === 'patch' && !this.els.has(id) && before.get(id)) this.queue.set(id, this.m.stamped({ op: 'upsert', el: clone(before.get(id)) }));
    }
    for (const id of new Set([...this.sending.flat(), ...this.extra, ...this.queue.values()].map(this.m.idOf))) this.show(id);
  }
}

const canon = (map) => JSON.stringify([...map.values()].map((e) => Object.fromEntries(Object.entries(e).sort())).sort((a, b) => a.id.localeCompare(b.id)));

function run(seed, m, opts) {
  const r = random(seed * 2654435761);
  const start = [
    { id: 'a', x: 0, y: 0, text: 't', color: 'c' },
    { id: 'b', x: 1, y: 1, text: 'u', color: 'd' },
    { id: 't', x: 3, rows: ['z0', 'z1', 'z2'] },
  ];
  const server = new Server(start);
  const clients = ['P', 'Q', 'R'].slice(0, 2 + r(2)).map((n) => new Browser(n, server, start, m));
  server.clients = clients;
  const FIELDS = ['x', 'y', 'text', 'color'];
  let counter = 0;
  const trace = [];
  // Abgelehnt wird alles von R an Element b, solange die Sperre gilt: wie Moderation oder fremde private Elemente
  const locked = { on: false };
  const refuse = (c) => (op) => opts.refuse && locked.on && c.name === 'R' && server.els.has('b') && m.idOf(op) === 'b';

  const arrive = (c) => {
    const part = c.outbox.shift();
    const lost = opts.flaky ? r(12) : 1;
    if (lost === 0) {
      trace.push(`${c.name} Paket verloren`);
      c.onLost(part);
      return;
    }
    const res = server.receive(c, part, m, { refuse: refuse(c) });
    trace.push(`${c.name} sendet ${res.seq} ${JSON.stringify(part)}`);
    // Antwort verloren: Der Server hat es übernommen, der Browser weiß es nicht und sendet erneut
    if (opts.flaky && r(12) === 0) {
      trace.push(`${c.name} Antwort verloren`);
      c.replies.push({ part, lost: true });
    } else c.replies.push({ part, res });
  };

  const pump = () => {
    const ready = clients.filter((c) => c.outbox.length || c.stream.length || c.replies.length);
    if (!ready.length) return false;
    const c = ready[r(ready.length)];
    const moves = [];
    if (c.outbox.length) moves.push('out');
    if (c.stream.length) moves.push('stream');
    if (c.replies.length) moves.push('reply');
    const move = moves[r(moves.length)];
    if (move === 'out') arrive(c);
    else if (move === 'stream') {
      const msg = c.stream.shift();
      trace.push(`${c.name} Stream ${msg.seq}`);
      c.onStream(msg);
    } else {
      const x = c.replies.shift();
      if (x.lost) c.onLost(x.part);
      else {
        trace.push(`${c.name} Antwort ${x.res.seq}`);
        c.onReply(x.part, x.res);
      }
    }
    return true;
  };

  const steps = 8 + r(40);
  for (let i = 0; i < steps; i++) {
    const c = clients[r(clients.length)];
    const id = opts.tables ? ['a', 'b', 't'][r(3)] : ['a', 'b'][r(2)];
    const dice = r(24);
    if (opts.structure && dice === 0 && id !== 't') {
      c.remove(id);
      trace.push(`${c.name} löscht ${id}`);
    } else if (opts.structure && dice === 1) {
      c.add({ id: `n${++counter}`, x: 2, y: 2, text: '', color: 'e' });
    } else if (opts.tables && dice === 2) {
      c.table({ op: 'tpatch', id: 't', opId: `p${++counter}`, at: r(3), val: `${c.name}${counter}` });
      if (r(2)) c.change('t', { x: `${c.name}${++counter}` });
    } else if (opts.tables && dice === 3) {
      c.table({ op: 'tstruct', id: 't', opId: `s${++counter}`, row: `${c.name}${counter}` });
    } else if (opts.refuse && dice === 4) {
      locked.on = !locked.on;
    } else if (opts.reconnect && dice === 5) {
      trace.push(`${c.name} verbindet neu`);
      c.hello();
    } else {
      const k = id === 't' ? 'x' : FIELDS[r(FIELDS.length)];
      c.change(id, { [k]: `${c.name}${++counter}` });
      trace.push(`${c.name} ${id}.${k}=${c.name}${counter}`);
    }
    if (r(2)) c.flush();
    for (let n = r(4); n > 0; n--) pump();
  }
  locked.on = false;
  for (const c of clients) c.flush();
  for (;;) {
    while (pump()) for (const c of clients) c.flush();
    for (const c of clients) c.flush();
    if (!clients.some((c) => c.outbox.length)) break;
  }
  const want = canon(server.els);
  for (const c of clients) {
    const got = canon(c.els);
    if (got !== want) return { seed, client: c.name, want, got, trace };
  }
  return null;
}

// Verschiedene Felder: Keine Änderung darf verloren gehen
function noLostFields(m) {
  for (let seed = 1; seed <= 2000; seed++) {
    const r = random(seed * 40503);
    const start = [{ id: 'a', x: 0, text: 't' }];
    const server = new Server(start);
    const p = new Browser('P', server, start, m), q = new Browser('Q', server, start, m);
    server.clients = [p, q];
    p.change('a', { x: 'von-P' });
    q.change('a', { text: 'von-Q' });
    p.flush();
    q.flush();
    const all = [p, q];
    for (;;) {
      const ready = all.filter((c) => c.outbox.length || c.stream.length || c.replies.length);
      if (!ready.length) break;
      const c = ready[r(ready.length)];
      const pick = r(3);
      if (pick === 0 && c.outbox.length) {
        const part = c.outbox.shift();
        c.replies.push({ part, res: server.receive(c, part, m, { refuse: () => false }) });
      } else if (pick === 1 && c.stream.length) c.onStream(c.stream.shift());
      else if (pick === 2 && c.replies.length) {
        const x = c.replies.shift();
        c.onReply(x.part, x.res);
      }
    }
    const e = server.els.get('a');
    if (e.x !== 'von-P' || e.text !== 'von-Q' || canon(p.els) !== canon(server.els) || canon(q.els) !== canon(server.els)) return { seed, e, p: canon(p.els), q: canon(q.els) };
  }
  return null;
}

// Eine Person, gestörte Verbindung: Der Stand muss am Ende ihrer letzten Eingabe entsprechen. Gleichheit aller Browser reicht
// dafür nicht: Sie könnten auch gemeinsam den falschen Stand haben.
function lastInputWins(m) {
  for (let seed = 1; seed <= 20000; seed++) {
    const r = random(seed * 69069);
    const start = [{ id: 'a', x: 0, y: 0, text: 't' }];
    const server = new Server(start);
    const p = new Browser('P', server, start, m);
    server.clients = [p];
    const want = { ...start[0] };
    const noRefuse = { refuse: () => false };
    const step = () => {
      const moves = [];
      // Wie die Sendekette im Browser: Das nächste Paket geht erst nach der Antwort auf das vorige
      if (p.outbox.length && !p.replies.length) moves.push('out');
      if (p.replies.length) moves.push('reply');
      if (p.stream.length) moves.push('stream');
      if (!moves.length) return false;
      const move = moves[r(moves.length)];
      if (move === 'stream') p.onStream(p.stream.shift());
      else if (move === 'reply') {
        const x = p.replies.shift();
        if (x.lost) p.onLost(x.part);
        else p.onReply(x.part, x.res);
      } else {
        const part = p.outbox.shift();
        const fate = r(4);
        if (fate === 0) p.onLost(part);
        else {
          const res = server.receive(p, part, m, noRefuse);
          p.replies.push(fate === 1 ? { part, lost: true } : { part, res });
        }
      }
      return true;
    };
    for (let i = 0, n = 6 + r(24); i < n; i++) {
      const k = ['x', 'y', 'text'][r(3)];
      want[k] = `v${i}`;
      p.change('a', { [k]: `v${i}` });
      if (r(2)) p.flush();
      for (let j = r(3); j > 0; j--) step();
    }
    for (;;) {
      p.flush();
      if (!step() && !p.queue.size) break;
    }
    if (canon(server.els) !== canon(new Map([['a', want]]))) return { seed, want, got: canon(server.els) };
  }
  return null;
}

// Einzelne Regeln, die der Zufall nicht gezielt trifft
function rules(m) {
  const out = [];
  const check = (name, ok) => { if (!ok) out.push(name); };
  const q = new Map();
  const base = { id: 'a', x: 1, tags: ['a'] };
  check('nichts geändert, nichts gesendet', m.enqueue(q, { ...base, tags: ['a'] }, base) === false && q.size === 0);
  m.enqueue(q, { ...base, x: 2 }, base);
  check('nur das geänderte Feld', JSON.stringify(q.get('a')) === '{"op":"patch","id":"a","set":{"x":2},"unset":[]}');
  const inPlace = { id: 'b', x: 1 };
  m.enqueue(q, inPlace, inPlace);
  check('Änderung an Ort und Stelle geht vollständig', q.get('b').op === 'upsert');
  const cleared = new Map();
  m.enqueue(cleared, { ...base, group: undefined }, { ...base, group: 'g' });
  check('auf undefined gesetztes Feld gilt als entfernt', JSON.stringify(cleared.get('a').unset) === '["group"]' && !('group' in cleared.get('a').set));
  check('undefined ohne Vorwert ändert nichts', m.diff(base, { ...base, group: undefined }) === null);
  check('Feld kommt zurück', JSON.stringify(m.diff({ id: 'a', n: undefined }, { id: 'a', n: 0 }).set) === '{"n":0}');
  m.enqueue(q, { id: 'c', x: 1 }, { id: 'c', x: 0, draft: true });
  check('Entwürfe gehen vollständig', q.get('c').op === 'upsert');
  m.enqueue(q, { id: 'a', tags: ['a'] }, { ...base, x: 2 });
  check('entferntes Feld', JSON.stringify(q.get('a').unset) === '["x"]' && !('x' in q.get('a').set));
  const patch = (set) => m.stamped({ op: 'patch', id: 'a', set, unset: [] });
  const older = patch({ x: 'alt', y: 1 }), newer = patch({ x: 'neu' });
  const retry = new Map([['a', newer]]);
  m.requeue(retry, older);
  check('erneutes Senden überschreibt Neueres nicht', retry.get('a').set.x === 'neu' && retry.get('a').set.y === 1);
  const first = patch({ x: 1 }), del = m.stamped({ op: 'delete', id: 'a' });
  const gone = new Map();
  m.requeue(gone, first);
  m.requeue(gone, del);
  check('spätere Löschung gewinnt, wenn zwei Pakete scheitern', gone.get('a').op === 'delete');
  // Letzte Eingabe gewinnt, auch wenn ein Paket mit jüngerer Eingabe zusammengefasst wurde (a: Paket 1 und 2, b: später getippt)
  const p1 = m.stamped({ op: 'patch', id: 'k', set: { a: 1 }, unset: [] }), p2 = m.stamped({ op: 'patch', id: 'k', set: { a: 2 }, unset: [] });
  const typed = new Map();
  m.enqueue(typed, { id: 'k', a: 2, b: 1 }, { id: 'k', a: 2 });
  m.requeue(typed, p1);
  m.requeue(typed, p2);
  check('beide scheitern: a behält den neueren Wert', typed.get('k').set.a === 2 && typed.get('k').set.b === 1);
  const p3 = m.stamped({ op: 'patch', id: 'k', set: { a: 1 }, unset: [] }), p4 = m.stamped({ op: 'patch', id: 'k', set: { a: 2 }, unset: [] });
  const typedNew = new Map();
  m.requeue(typedNew, p3);
  m.enqueue(typedNew, { id: 'k', a: 1, b: 1 }, { id: 'k', a: 1 });
  m.supersede(typedNew, p4);
  check('Paket 2 angenommen: Der alte Wert geht nicht mehr raus, die Eingabe schon', !('a' in typedNew.get('k').set) && typedNew.get('k').set.b === 1);
  const stale = patch({ x: 'alt', y: 1 }), won = patch({ x: 'neu' });
  const waiting = new Map([['a', stale]]);
  m.supersede(waiting, won);
  check('gescheitertes älteres Paket überschreibt angenommenes neueres nicht', !('x' in waiting.get('a').set) && waiting.get('a').set.y === 1);
  const none = new Map([['a', patch({ x: 1 })]]);
  m.supersede(none, m.stamped({ op: 'delete', id: 'a' }));
  check('angenommene Löschung ersetzt ältere Änderung', !none.size);
  const made = m.stamped({ op: 'upsert', el: { id: 'a', x: 1 } }), then = patch({ x: 2 });
  const fresh = new Map([['a', then]]);
  m.requeue(fresh, made);
  check('neues Element bleibt neu, wenn es scheitert', fresh.get('a').op === 'upsert' && fresh.get('a').el.x === 2);
  check('Marke geht nicht über die Leitung', JSON.stringify(m.stamped({ op: 'delete', id: 'a' })) === '{"op":"delete","id":"a"}');
  const rec = new m.Reconciler();
  rec.rebase('h', { id: 'h', hidden: true }, 5);
  check('verborgene Stände bleiben unberührt', rec.view('h', [{ op: 'patch', id: 'h', set: { text: 'x' }, unset: [] }]).el.text === undefined);
  let t = 0;
  const old = new m.Reconciler({ now: () => t });
  old.touch('a', base);
  t = 200000;
  old.sweep(() => true);
  check('offene Einträge bleiben', old.has('a'));
  old.sweep(() => false);
  check('alte Einträge werden vergessen', !old.has('a'));
  let t2 = 0;
  const folds = new m.Reconciler({ now: () => t2, applyOther: applyTable });
  folds.touch('t', { id: 't', rows: ['a', 'b'] });
  for (let i = 0; i < 50; i++) folds.partial({ op: 'tpatch', id: 't', at: 0, val: `v${i}` }, 10 + i);
  t2 = 200000;
  folds.partial({ op: 'tpatch', id: 't', at: 1, val: 'neu' }, 100);
  folds.sweep(() => true);
  check('altes Log wird in die Grundlage übernommen', folds.entries.get('t').log.length === 1 && folds.view('t', []).el.rows.join() === 'v49,neu');
  return out;
}

(async () => {
  const m = await import(path.join(__dirname, '../public/js/merge.js'));
  let failed = false;
  const SETS = [
    ['Felder', {}],
    ['Anlegen und Löschen', { structure: true }],
    ['Tabellen', { tables: true }],
    ['Ablehnungen', { structure: true, refuse: true }],
    ['Verlorene Pakete', { flaky: true, structure: true }],
    ['Wiederverbinden', { reconnect: true, structure: true }],
    ['alles zusammen', { flaky: true, structure: true, tables: true, refuse: true, reconnect: true }],
  ];
  for (const [name, opts] of SETS) {
    let bad = null, count = 0;
    for (let seed = 1; seed <= RUNS; seed++) {
      const f = run(seed, m, opts);
      if (f) {
        count++;
        bad = bad || f;
      }
    }
    console.log(`${name}: ${RUNS} Abläufe, ${count} Abweichungen`);
    if (bad) {
      failed = true;
      if (process.env.SYNC_TRACE) console.error(JSON.stringify({ seed: bad.seed, client: bad.client, want: bad.want, got: bad.got }, null, 1) + '\n' + bad.trace.join('\n'));
    }
  }
  const lost = noLostFields(m);
  console.log(lost ? `Verlorene Felder: ${JSON.stringify(lost)}` : 'Verschiedene Felder: nichts verloren');
  const stale = lastInputWins(m);
  console.log(stale ? `Letzte Eingabe verloren: ${JSON.stringify(stale)}` : 'Letzte Eingabe gewinnt: bestanden');
  const broken = rules(m);
  console.log(broken.length ? `Regeln verletzt: ${broken.join('; ')}` : 'Einzelregeln: bestanden');
  process.exit(failed || lost || stale || broken.length ? 1 : 0);
})();
