// Gemeinsames Tippen im Browser. Keine Abhängigkeiten außer TextOps, damit scripts/test-text.js beliebige Abläufe prüfen kann.
//
// Ein Text, an dem man gerade schreibt, hat eine Sitzung:
//   server  zuletzt bekannter Text des Servers, seq dessen Nummer
//   flying  gesendete, noch nicht bestätigte Schritte (immer höchstens ein Paket)
//   buffer  Schritte, die danach getippt wurden
// Angezeigt wird server + flying + buffer. Jede Änderung vom Server bringt den ganzen Text mit: Er ersetzt server. Darum
// kann ein Rechenfehler höchstens etwas an die falsche Stelle setzen, aber nie Browser dauerhaft auseinanderlaufen lassen.
// Reihenfolge: Bestätigungen kommen über den Live-Stream, also garantiert hinter allem, was der Server davor verteilt hat.

const Ops = () => globalThis.TextOps;
const RETRY_MS = 4000;
let counter = 0;
const newId = () => `${Date.now().toString(36)}${(++counter).toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export const textKey = (t) => (t.cell ? `${t.id}|c|${t.cell[0]},${t.cell[1]}` : `${t.id}|f|${t.field}`);

export class TextSession {
  constructor(target, text, seq, send) {
    Object.assign(this, { target, server: String(text ?? ''), seq, send, flying: null, buffer: [], attached: false, listener: null, asked: 0, fresh: false });
  }

  get value() {
    const T = Ops();
    return T.apply(T.apply(this.server, this.flying ? this.flying.ops : []), this.buffer);
  }

  get busy() {
    return !!this.flying || this.buffer.length > 0 || !!this.asked;
  }

  /** Eigene Eingabe: Der Editor zeigt jetzt next. */
  type(next, caret = null) {
    const ops = Ops().diff(this.value, next, caret);
    if (ops.length) this.push(ops);
    return ops;
  }

  push(ops) {
    this.buffer.push(...ops);
    this.flush();
  }

  flush(now = Date.now()) {
    if (this.flying || this.asked || !this.buffer.length) return;
    const T = Ops();
    let ops = T.compact(this.buffer);
    // Lange offline quer durch den Text getippt: als ein Unterschied senden
    if (ops.length > T.MAX_STEPS / 2) ops = T.diff(this.server, this.value);
    this.buffer = [];
    if (!ops.length) return;
    this.flying = { ops, opId: newId(), at: now };
    this.post();
  }

  post() {
    const { id, field, cell } = this.target;
    this.send({ op: 'ttext', id, ...(cell ? { cell } : { field }), ops: this.flying.ops, base: this.seq, opId: this.flying.opId });
  }

  // Bis die Antwort da ist, zählt nichts aus dem Live-Stream: Es könnte schon die eigene, unbestätigte Eingabe enthalten.
  // Die Antwort steht im selben Stream, und alles davor ist in ihr enthalten.
  // fresh: Der eigene Stand zählt nicht als Grundlage, etwa beim Öffnen, wenn eigene Änderungen noch unterwegs sein können.
  requestSync(now = Date.now(), fresh = false) {
    const { id, field, cell } = this.target;
    this.asked = now;
    this.fresh = this.fresh || fresh;
    if (this.flying) this.flying.at = now;
    this.send({ op: 'tsync', id, ...(cell ? { cell } : { field }), base: this.seq });
  }

  /** Antwort bleibt aus (verlorene Bestätigung, abgelehnt): nachfragen. */
  tick(now) {
    if (this.asked ? now - this.asked > RETRY_MS : this.flying && now - this.flying.at > RETRY_MS) this.requestSync(now);
  }

  /** Neuer Stand vom Server. edit: seine Schritte; ohne sie (z. B. Rückgängig eines anderen) wird verglichen. */
  remote(text, edit, seq) {
    if (this.asked || seq <= this.seq) return;
    this.step(String(text ?? ''), edit, seq);
  }

  step(text, edit, seq) {
    const T = Ops();
    this.seq = seq;
    if (edit && this.flying && edit.opId === this.flying.opId) {
      this.server = text;
      this.flying = null;
      this.flush();
      return;
    }
    // Stimmt die Rechnung nicht mit dem Text überein (Server hat gekürzt), zählt der Vergleich
    const ops = edit && T.apply(this.server, edit.ops) === text ? edit.ops : T.diff(this.server, text);
    if (!ops.length) return;
    const before = this.value;
    let r = ops;
    if (this.flying) [this.flying.ops, r] = T.transform(this.flying.ops, r);
    [this.buffer, r] = T.transform(this.buffer, r);
    this.server = text;
    if (r.length && this.listener) this.listener(r, before);
  }

  // Kein Verlauf mehr vorhanden oder Abweichung: am vollständigen Text ausrichten
  align(msg) {
    const T = Ops();
    // Die Bestätigung ging verloren, der Server hat die Eingabe aber: nicht noch einmal senden
    if (this.flying && msg.text !== this.server && T.apply(this.server, this.flying.ops) === msg.text) {
      this.server = msg.text;
      this.flying = null;
    }
    if (msg.text !== this.server) this.step(msg.text, null, Math.max(msg.seq, this.seq + 1));
    this.seq = Math.max(this.seq, msg.seq);
  }

  /** Antwort auf eine Nachfrage. refused: Der Server nimmt nichts an, die offenen Schritte sind verworfen. */
  sync(msg) {
    const T = Ops();
    this.asked = 0;
    if (this.fresh && !msg.refused && typeof msg.text === 'string') {
      this.fresh = false;
      this.align(msg);
      // Noch unbestätigte Eingabe: auf dem neuen Stand erneut senden, ihre Kennung verhindert doppeltes Ausführen
      if (this.flying) {
        this.flying.at = Date.now();
        this.post();
      }
      this.flush();
      return;
    }
    if (msg.refused) {
      const before = this.value;
      this.flying = null;
      this.buffer = [];
      this.seq = Math.max(this.seq, msg.seq);
      if (typeof msg.text === 'string') this.server = msg.text;
      const after = this.value;
      if (after !== before && this.listener) this.listener(T.diff(before, after), before);
      return;
    }
    for (const e of msg.entries || []) {
      if (e.seq <= this.seq) continue;
      this.step(T.apply(this.server, e.ops), e, e.seq);
    }
    if (typeof msg.text === 'string') this.align(msg);
    // Was der Server bis hierher nicht hatte, ist nicht angekommen; dieselbe Kennung verhindert doppeltes Ausführen
    if (this.flying) {
      this.flying.at = Date.now();
      this.post();
    }
    this.flush();
  }
}

export class TextSessions {
  // online: Ohne Verbindung wird nicht nachgefragt; das übernimmt reconnected()
  constructor(send, seq, online = () => true) {
    Object.assign(this, { map: new Map(), send, seq, online, timer: null });
  }

  /** Noch nicht gesendete Eingaben: gehen beim Verlassen der Seite verloren. */
  get unsent() {
    return [...this.map.values()].some((s) => s.buffer.length > 0);
  }

  get busy() {
    return [...this.map.values()].some((s) => s.busy);
  }

  of(id) {
    return [...this.map.values()].filter((s) => s.target.id === id);
  }

  open(target, text) {
    const key = textKey(target);
    let s = this.map.get(key);
    if (!s) {
      s = new TextSession(target, text, this.seq(), this.send);
      this.map.set(key, s);
      s.requestSync(Date.now(), true);
    }
    s.attached = true;
    this.watch();
    return s;
  }

  close(s) {
    s.attached = false;
    s.listener = null;
    this.sweep();
  }

  sweep() {
    for (const [k, s] of this.map) if (!s.attached && !s.busy) this.map.delete(k);
  }

  drop(id) {
    for (const [k, s] of this.map) if (s.target.id === id) this.map.delete(k);
  }

  /** Zellen sind umgezogen; null: Die Zelle gibt es nicht mehr. */
  moveCell(id, map) {
    const cells = this.of(id).filter((s) => s.target.cell);
    for (const s of cells) this.map.delete(textKey(s.target));
    for (const s of cells) {
      const m = map(s.target.cell[0], s.target.cell[1]);
      if (!m) continue;
      s.target = { ...s.target, cell: m };
      this.map.set(textKey(s.target), s);
      // Der Server passt Formeln an die neue Struktur an: von ihm den gültigen Text holen
      s.requestSync(Date.now(), true);
    }
  }

  /** Rückgängig setzt den Text gerade als Ganzes: Ungesendetes aus beendeten Eingaben käme sonst danach wieder dazu. */
  dropBuffered(ids) {
    for (const s of this.map.values()) if (!s.attached && ids.has(s.target.id)) s.buffer = [];
  }

  /** Sicht auf das Element, wie sie der Server kennt: Der getippte Text geht nur als Schritte zu ihm. */
  mask(el) {
    if (!el) return el;
    let out = el;
    // Nur offene Editoren: Rückgängig nach dem Beenden schreibt den Text bewusst als Ganzes
    for (const s of this.of(el.id).filter((x) => x.attached)) {
      const { field, cell } = s.target;
      if (cell) {
        if (out.cells?.[cell[0]]) out = { ...out, cells: out.cells.map((row, r) => (r === cell[0] ? row.map((x, c) => (c === cell[1] ? s.server : x)) : row)) };
      } else out = { ...out, [field]: s.server };
    }
    return out;
  }

  // Änderung vom Server, bevor sie angezeigt wird
  incoming(op, seq) {
    if (op.op === 'delete') return this.drop(op.id);
    const id = op.op === 'upsert' ? op.el?.id : op.id;
    const list = this.of(id);
    if (!list.length) return;
    for (const s of list) {
      const { field, cell } = s.target;
      const edits = op.edits || [];
      const edit = edits.find((e) => (cell ? e.c && e.c[0] === cell[0] && e.c[1] === cell[1] : e.f === field)) || null;
      // Eigene Eingabe, aber die Zelle ist inzwischen umgezogen: angekommen ist sie, den Text holen wir neu
      if (!edit && s.flying && edits.some((e) => e.opId === s.flying.opId)) {
        s.server = Ops().apply(s.server, s.flying.ops);
        s.flying = null;
        s.requestSync(Date.now(), true);
        continue;
      }
      if (op.op === 'upsert') {
        if (op.el.hidden) continue;
        s.remote(cell ? op.el.cells?.[cell[0]]?.[cell[1]] : op.el[field], edit, seq);
      } else if (op.op === 'tpatch' && cell) {
        const hit = (op.cells || []).find((c) => c[0] === cell[0] && c[1] === cell[1]);
        if (hit) s.remote(hit[2], edit, seq);
      }
    }
    this.sweep();
  }

  // Liefert das Ziel, damit das Element den neuen Stand zeigen kann
  onSync(msg) {
    const s = this.map.get(msg.key);
    if (!s) return null;
    if (msg.gone) this.map.delete(msg.key);
    else s.sync(msg);
    this.sweep();
    return s.target;
  }

  abandon() {
    for (const s of this.map.values()) {
      s.flying = null;
      s.buffer = [];
      s.asked = 0;
    }
    this.sweep();
  }

  /** Nach dem Wiederverbinden: Was verpasst wurde, holt die Sitzung nach. */
  reconnected() {
    for (const s of this.map.values()) s.requestSync();
  }

  /** Eigene Texte im Element anzeigen, solange der Server sie noch nicht hat. */
  overlay(el) {
    if (!el) return el;
    let out = el;
    for (const s of this.of(el.id)) {
      const v = s.value;
      const { field, cell } = s.target;
      if (cell) {
        if (out.cells?.[cell[0]] && out.cells[cell[0]][cell[1]] !== v) {
          out = { ...out, cells: out.cells.map((row, r) => (r === cell[0] ? row.map((x, c) => (c === cell[1] ? v : x)) : row)) };
        }
      } else if ((out[field] ?? '') !== v) out = { ...out, [field]: v };
    }
    return out;
  }

  watch() {
    if (this.timer) return;
    this.timer = setInterval(() => {
      const now = Date.now();
      if (this.online()) for (const s of this.map.values()) s.tick(now);
      if (!this.map.size) {
        clearInterval(this.timer);
        this.timer = null;
      }
    }, 1000);
    this.timer.unref?.();
  }
}
