// Echtzeit-Synchronisation: Server-Sent Events (Empfang) + gebündelte POSTs (Senden)
import { uid } from './util.js';

export class Sync {
  constructor(boardId, user, { viewOnly = false } = {}) {
    this.boardId = boardId;
    this.user = user;
    this.viewOnly = viewOnly;
    this.clientId = uid();
    this.queue = new Map(); // dedupliziert upserts pro Element
    this.extra = [];        // nicht deduplizierbare Operationen
    this.flushTimer = null;
    this.handlers = {};
    this.connected = false;
    this.inflight = Promise.resolve();
    this.sending = [];
  }

  on(type, fn) {
    this.handlers[type] = fn;
    return this;
  }

  emit(type, data) {
    this.handlers[type] && this.handlers[type](data);
  }

  connect() {
    // Identität und Rechte ermittelt der Server aus der Session
    const p = new URLSearchParams({ client: this.clientId });
    this.es = new EventSource(`/api/boards/${this.boardId}/events?${p}`);
    this.es.onmessage = (e) => {
      let msg;
      try {
        msg = JSON.parse(e.data);
      } catch {
        return;
      }
      if (msg.type === 'hello') {
        this.connected = true;
        this.emit('status', true);
      }
      this.emit(msg.type, msg);
    };
    this.es.onerror = () => {
      this.connected = false;
      this.emit('status', false);
    };
  }

  reconnectAs(user) {
    this.user = user;
    this.es && this.es.close();
    this.connect();
  }

  upsert(el) {
    if (this.viewOnly) return;
    this.queue.set(el.id, { op: 'upsert', el: JSON.parse(JSON.stringify(el)) });
    this.schedule();
  }

  remove(id) {
    if (this.viewOnly) return;
    this.queue.set(id, { op: 'delete', id });
    this.schedule();
  }

  op(o) {
    if (this.viewOnly && o.op !== 'vote') return;
    if (o.op === 'vote') delete o.userId;
    this.extra.push(o);
    this.schedule();
  }

  schedule() {
    if (!this.flushTimer) this.flushTimer = setTimeout(() => this.flush(), 40);
  }

  flush() {
    this.flushTimer = null;
    const ops = this.take();
    if (!ops.length) return this.inflight;
    // Reihenfolge der Pakete sicherstellen
    this.inflight = this.inflight.then(() => this.post(ops));
    return this.inflight;
  }

  take() {
    const ops = [...this.queue.values(), ...this.extra];
    this.queue.clear();
    this.extra = [];
    return ops;
  }

  post(ops) {
    const body = JSON.stringify({ clientId: this.clientId, ops });
    this.sending.push(ops);
    return fetch(`/api/boards/${this.boardId}/ops`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-DLZ': '1' },
      body,
      keepalive: body.length < 60000, // Browser erlauben keepalive nur bis 64 KB
    })
      .then(async (r) => {
        const res = await r.json().catch(() => ({}));
        // 409: Verbindung (noch) nicht registriert – nach dem Wiederverbinden erneut senden
        if (r.status === 409 || r.status >= 500) throw new Error(res.error || 'retry');
        if (res.voting !== undefined) this.emit('voting', res.voting);
        if (res.error) this.emit('error', res.error);
      })
      .catch(() => {
        // Bei Verbindungsproblemen erneut einreihen – neuere Änderungen am selben Element haben Vorrang
        const rest = [];
        for (const o of ops) {
          if (o.op === 'upsert') !this.queue.has(o.el.id) && this.queue.set(o.el.id, o);
          else if (o.op === 'delete') !this.queue.has(o.id) && this.queue.set(o.id, o);
          else rest.push(o);
        }
        this.extra.unshift(...rest);
        setTimeout(() => this.schedule(), 1500);
      })
      .finally(() => {
        this.sending = this.sending.filter((x) => x !== ops);
      });
  }

  // Beim Verlassen der Seite: sofort senden, ohne auf laufende Pakete zu warten
  flushNow() {
    clearTimeout(this.flushTimer);
    this.flushTimer = null;
    const ops = this.take();
    if (ops.length) this.post(ops);
  }

  // Noch nicht bestätigte eigene Änderungen (für den Abgleich nach einem Wiederverbinden)
  pendingOps() {
    return [...this.sending.flat(), ...this.queue.values()].filter((o) => o.op === 'upsert' || o.op === 'delete');
  }

  signal(kind, data) {
    fetch(`/api/boards/${this.boardId}/signal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-DLZ': '1' },
      body: JSON.stringify({ clientId: this.clientId, kind, data }),
    }).catch(() => {});
  }

  get pending() {
    return this.queue.size + this.extra.length > 0;
  }
}
