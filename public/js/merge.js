// Abgleich gleichzeitiger Änderungen. Keine Abhängigkeiten, damit scripts/test-sync.js beliebige Abläufe prüfen kann.
//
// Der Server legt die Reihenfolge fest und nummeriert jede Änderung (seq). Für jedes Element, an dem man selbst gerade
// arbeitet, führt der Browser einen Eintrag:
//   base  letzter vollständiger Stand vom Server, seq dessen Nummer
//   log   bestätigte Änderungen, die in base noch fehlen (eigene, Tabellenänderungen), nach Nummer sortiert
// Angezeigt wird: base + log + noch offene eigene Änderungen. Wer das gleich rechnet, bekommt dasselbe wie der Server,
// egal in welcher Reihenfolge Bestätigung und Live-Stream eintreffen: Beide sind getrennte Kanäle und können sich überholen.

const TRACKED = new Set(['upsert', 'patch', 'delete', 'tpatch', 'tstruct']);
const KEEP_MS = 120000;

export const tracked = (op) => TRACKED.has(op.op);
export const idOf = (op) => (op.op === 'upsert' ? op.el.id : op.id);

const same = (a, b) => a === b || (!!a && !!b && typeof a === 'object' && typeof b === 'object' && JSON.stringify(a) === JSON.stringify(b));
const copy = (v) => (v && typeof v === 'object' ? JSON.parse(JSON.stringify(v)) : v);

/** Geänderte Felder zwischen zwei Ständen eines Elements: { set, unset } oder null, wenn nichts anders ist. */
export function diff(prev, next) {
  const set = {}, unset = [];
  // undefined übersteht JSON nicht: Ein so geleertes Feld muss als entfernt gelten, sonst behält es der Server
  for (const k of Object.keys(next)) if (next[k] !== undefined && !same(prev[k], next[k])) set[k] = copy(next[k]);
  for (const k of Object.keys(prev)) if (prev[k] !== undefined && next[k] === undefined) unset.push(k);
  return Object.keys(set).length || unset.length ? { set, unset } : null;
}

export const equal = (a, b) => !diff(a, b);

export function applyPatch(el, patch) {
  const out = { ...el, ...patch.set };
  for (const k of patch.unset) delete out[k];
  return out;
}

// Laufende Marke je Operation (Symbol: geht nicht über die Leitung). Scheitern mehrere Pakete nacheinander, kommen ältere
// Operationen nach neueren zurück in die Warteschlange; die Marke sagt, welche die neuere ist.
const STAMP = Symbol('stamp');
let stamps = 0;
export function stamped(op) {
  op[STAMP] = ++stamps;
  return op;
}
const stampOf = (op) => op[STAMP] || 0;
const RETRIED = Symbol('retried');
export const wasRetried = (op) => !!op[RETRIED];
export const byStamp = (a, b) => stampOf(a) - stampOf(b);

// Zusammengefasste Patches enthalten Felder verschiedenen Alters. Eine Marke für alles machte alte Werte scheinbar neu: Sie
// überschrieben dann eine neuere Eingabe. Darum zählt je Feld die Marke, mit der es entstanden ist.
const FIELDS = Symbol('fields');
const fieldStamp = (op, k) => op[FIELDS]?.[k] ?? stampOf(op);
const patchKeys = (op) => [...Object.keys(op.set), ...op.unset];

/** Zwei Patches feldweise zusammenfassen; die Reihenfolge der Argumente spielt keine Rolle. */
function mergePatches(a, b) {
  const set = {}, unset = [], fields = {};
  for (const k of new Set([...patchKeys(a), ...patchKeys(b)])) {
    const inA = patchKeys(a).includes(k), inB = patchKeys(b).includes(k);
    const from = !inB || (inA && fieldStamp(a, k) > fieldStamp(b, k)) ? a : b;
    fields[k] = fieldStamp(from, k);
    if (k in from.set) set[k] = from.set[k];
    else unset.push(k);
  }
  const out = { op: 'patch', id: a.id, set, unset };
  out[STAMP] = Math.max(stampOf(a), stampOf(b));
  out[FIELDS] = fields;
  out[RETRIED] = a[RETRIED] || b[RETRIED];
  return out;
}

/** Nur die Felder eines Patches, die jünger sind als die Marke; null, wenn keins bleibt. */
function fieldsAfter(op, stamp, drop = () => false) {
  const keep = (k) => fieldStamp(op, k) > stamp && !drop(k);
  const set = Object.fromEntries(Object.entries(op.set).filter(([k]) => keep(k)));
  const unset = op.unset.filter(keep);
  if (!Object.keys(set).length && !unset.length) return null;
  return { ...op, set, unset };
}

/** Zwei Operationen am selben Element zu einer zusammenfassen. */
function combine(a, b) {
  if (a.op === 'patch' && b.op === 'patch') return mergePatches(a, b);
  const [older, newer] = stampOf(a) > stampOf(b) ? [b, a] : [a, b];
  let out = newer;
  if (newer.op === 'patch') {
    // Ein Patch, der älter ist als ein Anlegen oder Löschen, ist darin aufgegangen: Es zählen nur seine jüngeren Felder
    const rest = fieldsAfter(newer, stampOf(older));
    if (older.op === 'delete') out = rest ? { ...rest } : older;
    else out = { op: 'upsert', el: rest ? applyPatch(older.el, rest) : older.el };
  }
  out[STAMP] = stampOf(newer);
  out[RETRIED] = a[RETRIED] || b[RETRIED];
  return out;
}

/**
 * Eigene Änderung in die Warteschlange (Map id -> Operation) legen. Bekannte Elemente gehen als Patch: Nur geänderte Felder,
 * sonst überschriebe eine Änderung an der Farbe, was jemand gleichzeitig am Text geändert hat.
 * Wurde el an Ort und Stelle geändert (prev === el), ist kein Vergleich möglich: Dann geht das ganze Element.
 * Liefert false, wenn sich nichts geändert hat.
 */
export function enqueue(queue, el, prev) {
  const queued = queue.get(el.id);
  if (!prev || prev === el || prev.draft || (queued && queued.op !== 'patch')) {
    queue.set(el.id, stamped({ op: 'upsert', el: copy(el) }));
    return true;
  }
  const change = diff(prev, el);
  if (!change) return false;
  const patch = stamped({ op: 'patch', id: el.id, ...change });
  queue.set(el.id, queued ? combine(queued, patch) : patch);
  return true;
}

export function enqueueDelete(queue, id) {
  queue.set(id, stamped({ op: 'delete', id }));
}

/** Fehlgeschlagene Operation wieder einreihen. Was neuer ist, hat Vorrang, egal in welcher Folge die Pakete scheitern. */
export function requeue(queue, op) {
  const id = idOf(op);
  const cur = queue.get(id);
  op[RETRIED] = true;
  if (!cur) queue.set(id, op);
  else queue.set(id, combine(cur, op));
}

/**
 * Der Server hat op angenommen. Liegt noch eine ältere, gescheiterte Änderung am selben Element in der Warteschlange,
 * darf sie die neuere nicht nachträglich überschreiben.
 */
export function supersede(queue, op) {
  if (op.op !== 'upsert' && op.op !== 'patch' && op.op !== 'delete') return;
  const id = idOf(op);
  const cur = queue.get(id);
  if (!cur) return;
  if (cur.op === 'patch') {
    // Felder, die der Server schon in neuerer Fassung hat, entfallen; jüngere bleiben
    const rest = op.op === 'patch'
      ? fieldsAfter(cur, -1, (k) => patchKeys(op).includes(k) && fieldStamp(cur, k) < fieldStamp(op, k))
      : fieldsAfter(cur, stampOf(op));
    if (rest) queue.set(id, rest);
    else queue.delete(id);
  } else if (stampOf(cur) < stampOf(op)) {
    if (op.op !== 'patch') queue.delete(id);
    else if (cur.op === 'upsert') queue.set(id, { ...cur, el: applyPatch(cur.el, op) });
  }
}

/** Dasselbe für Pakete, die schon entnommen, aber noch nicht abgeschickt sind. Liefert die übrigen Pakete, leere fallen weg. */
export function supersedeParts(parts, op) {
  if (op.op !== 'upsert' && op.op !== 'patch' && op.op !== 'delete') return;
  for (const part of parts) {
    for (let i = part.length - 1; i >= 0; i--) {
      if (!tracked(part[i]) || part[i].op === 'tpatch' || part[i].op === 'tstruct' || idOf(part[i]) !== idOf(op)) continue;
      const one = new Map([[idOf(op), part[i]]]);
      supersede(one, op);
      if (one.size) part[i] = one.get(idOf(op));
      else part.splice(i, 1);
    }
  }
}

export class Reconciler {
  // applyOther: wendet Operationen an, die nicht zu den Grundformen gehören (Tabellen)
  constructor({ applyOther = (el) => el, now = Date.now } = {}) {
    this.applyOther = applyOther;
    this.now = now;
    this.entries = new Map();
  }

  reset() {
    this.entries.clear();
  }

  has(id) {
    return this.entries.has(id);
  }

  forget(id) {
    this.entries.delete(id);
  }

  /** Kennt der Server dieses Element? Bestätigtes Anlegen liegt noch im Log, nicht in der Grundlage. */
  known(id) {
    const e = this.entries.get(id);
    return !!e && (!!e.base || e.log.some((x) => x.op.op === 'upsert'));
  }

  /** Vor einer eigenen Änderung aufrufen. before: Stand davor, undefined bei neuen Elementen. */
  touch(id, before) {
    const e = this.entries.get(id);
    if (e) e.at = this.now();
    else this.entries.set(id, { base: before?.draft ? undefined : before, seq: 0, log: [], at: this.now() });
  }

  /** Nach dem Wiederverbinden: Der vollständige Stand vom Server ist die neue Grundlage. */
  rebase(id, base, seq) {
    this.entries.set(id, { base, seq: seq ?? 0, log: [], at: this.now() });
  }

  step(el, op) {
    if (op.op === 'delete') return undefined;
    if (op.op === 'upsert') return el?.priv ? { ...op.el, priv: el.priv, privName: el.privName } : op.el;
    if (!el) return undefined; // Der Server verwirft Änderungen an gelöschten Elementen ebenso
    if (op.op === 'patch') return applyPatch(el, op);
    return this.applyOther(el, op) || el;
  }

  /** Stand zum Anzeigen. open: offene eigene Operationen, älteste zuerst. Ohne Eintrag: null. */
  view(id, open) {
    const e = this.entries.get(id);
    if (!e) return null;
    let el = e.base;
    // Verborgene Stände sind geschwärzt; eigene Änderungen daran lehnt der Server ab
    if (el?.hidden) return { el };
    for (const x of e.log) el = this.step(el, x.op);
    for (const op of open) el = this.step(el, op);
    return { el };
  }

  /** Vollständiger Stand vom Server. Liefert false, wenn es keinen Eintrag gibt und er direkt gilt. */
  remote(op, seq) {
    const e = this.entries.get(idOf(op));
    if (!e) return false;
    const at = seq ?? e.seq;
    if (at < e.seq) return true; // überholt
    e.base = op.op === 'upsert' ? op.el : undefined;
    e.seq = at;
    e.log = e.log.filter((x) => x.seq > at);
    return true;
  }

  /** Teiländerung vom Server (Tabelle). Liefert false, wenn sie in der Grundlage schon enthalten ist. */
  partial(op, seq) {
    const e = this.entries.get(idOf(op));
    if (!e) return true;
    const at = seq ?? e.seq + 0.5;
    if (at <= e.seq) return false;
    this.insert(e, at, op);
    return true;
  }

  insert(e, seq, op) {
    let i = e.log.length;
    while (i > 0 && e.log[i - 1].seq > seq) i--;
    e.log.splice(i, 0, { seq, op, at: this.now() });
  }

  /** Der Server hat ein Paket unter dieser Nummer angenommen. */
  acked(ops, seq) {
    const now = this.now();
    for (const op of ops) {
      if (!tracked(op)) continue;
      const e = this.entries.get(idOf(op));
      if (!e) continue;
      e.at = now;
      if (seq !== undefined && seq > e.seq) this.insert(e, seq, op);
    }
  }

  /** Vom Server gesetzte Kennzeichen (privat, anonym) in den geführten Stand übernehmen. */
  fix(id, fn) {
    const e = this.entries.get(id);
    if (!e) return;
    if (e.base) e.base = fn(e.base);
    e.log = e.log.map((x) => (x.op.op === 'upsert' ? { ...x, op: { ...x.op, el: fn(x.op.el) } } : x));
  }

  /** Einträge ohne offene Änderungen nach einer Weile vergessen. isOpen(id): noch offene eigene Änderungen. */
  sweep(isOpen) {
    const limit = this.now() - KEEP_MS;
    for (const [id, e] of this.entries) {
      if (e.at < limit && !isOpen(id)) {
        this.entries.delete(id);
        continue;
      }
      // Was so alt ist, kann kein verspäteter Stand mehr überholen: in die Grundlage übernehmen, damit das Log klein bleibt
      while (e.log.length && e.log[0].at < limit) {
        const x = e.log.shift();
        e.base = this.step(e.base, x.op);
        e.seq = Math.max(e.seq, x.seq);
      }
    }
  }
}
