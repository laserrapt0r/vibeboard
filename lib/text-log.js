'use strict';
// Gemeinsames Tippen: Was sich zuletzt an einem Text geändert hat, damit der Server gleichzeitige Eingaben umrechnen kann.
// Liegt nur im Speicher. Ist ein Stand nicht mehr hier (Neustart, zu alt), sagt rebase() das: Der Browser gleicht sich
// dann am vollständigen Text ab. Ein Eintrag ist nur der Weg, der Text selbst steht wie immer im Element.
const TextOps = require('../public/js/text-ops.js');

const MAX_ENTRIES = 300; // je Text
const MAX_BYTES = 256 * 1024; // je Text, gegen sehr große Einfügungen
const MAX_DOCS = 500; // je Board

const docKey = (id, field, cell) => (cell ? `${id}|c|${cell[0]},${cell[1]}` : `${id}|f|${field}`);

class TextLog {
  constructor(from) {
    this.from = from; // Stände davor sind unbekannt
    this.docs = new Map();
  }

  known(key, base) {
    return base >= (this.docs.get(key)?.from ?? this.from);
  }

  seen(key, opId) {
    return !!this.docs.get(key)?.entries.some((e) => e.opId === opId);
  }

  /** Eingehende Schritte gegen alles rechnen, was seit base dazukam; null, wenn der Stand unbekannt ist. */
  rebase(key, ops, base) {
    if (!this.known(key, base)) return null;
    let out = ops;
    for (const e of this.docs.get(key)?.entries || []) if (e.seq > base) [out] = TextOps.transform(out, e.ops);
    return out;
  }

  since(key, base) {
    if (!this.known(key, base)) return null;
    return (this.docs.get(key)?.entries || []).filter((e) => e.seq > base);
  }

  add(key, ops, seq, opId = null) {
    if (!ops.length && !opId) return;
    let doc = this.docs.get(key);
    if (!doc) {
      if (this.docs.size >= MAX_DOCS) {
        // Ältesten Text vergessen: Wer dort noch tippt, gleicht sich am vollständigen Text ab
        const first = this.docs.keys().next().value;
        this.docs.delete(first);
        this.from = seq;
      }
      doc = { from: this.from, entries: [] };
    } else this.docs.delete(key); // nach hinten: zuletzt benutzt
    this.docs.set(key, doc);
    doc.entries.push({ seq, ops, ...(opId ? { opId } : {}) });
    doc.bytes = (doc.bytes || 0) + JSON.stringify(ops).length;
    while (doc.entries.length > 1 && (doc.entries.length > MAX_ENTRIES || doc.bytes > MAX_BYTES)) {
      const old = doc.entries.shift();
      doc.from = old.seq;
      doc.bytes -= JSON.stringify(old.ops).length;
    }
  }

  /** Text gibt es nicht mehr an dieser Stelle (Element gelöscht) oder Zellen sind umgezogen (Tabellenstruktur). */
  drop(id, seq, onlyCells = false) {
    const prefix = onlyCells ? `${id}|c|` : `${id}|`;
    for (const k of this.docs.keys()) if (k.startsWith(prefix)) this.docs.delete(k);
    // Neue Einträge für diese Zellen starten bei from: Ältere Stände gelten als unbekannt
    this.from = Math.max(this.from, onlyCells ? seq : this.from);
  }
}

module.exports = { TextLog, docKey };
