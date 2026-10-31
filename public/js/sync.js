// Echtzeit-Synchronisation: Server-Sent Events (Empfang) + gebündelte POSTs (Senden)
import { T } from './i18n.js';
import { uid } from './util.js';

// Hat sich gezeigt, dass Server-Sent Events hier nicht durchkommen (z. B. Pufferung durch einen Forward-Proxy),
// wird das für einige Tage gemerkt – so startet das nächste Board sofort mit Long-Polling statt erst zu warten.
const TRANSPORT_KEY = 'vibeboard.transport';
const TRANSPORT_DAYS = 7;
const SSE_TIMEOUT = 4000;

function rememberedPoll() {
  try {
    const v = JSON.parse(localStorage.getItem(TRANSPORT_KEY) || 'null');
    return !!(v && v.mode === 'poll' && v.until > Date.now());
  } catch {
    return false;
  }
}

function rememberTransport(mode) {
  try {
    if (mode === 'poll') localStorage.setItem(TRANSPORT_KEY, JSON.stringify({ mode, until: Date.now() + TRANSPORT_DAYS * 86400000 }));
    else localStorage.removeItem(TRANSPORT_KEY);
  } catch {
    /* Speicher gesperrt – dann eben ohne Gedächtnis */
  }
}

// Der Server nimmt je Anfrage höchstens 40 MB an: Große Änderungen (viele Bilder) gehen in mehreren Paketen
const MAX_PACKET = 20 * 1024 * 1024;
function packets(ops) {
  const out = [];
  let part = [], size = 0;
  for (const op of ops) {
    const n = JSON.stringify(op).length;
    if (part.length && size + n > MAX_PACKET) {
      out.push(part);
      part = [];
      size = 0;
    }
    part.push(op);
    size += n;
  }
  if (part.length) out.push(part);
  return out;
}

export class Sync {
  constructor(boardId, user, { viewOnly = false, canComment = false } = {}) {
    this.boardId = boardId;
    this.user = user;
    this.viewOnly = viewOnly;
    this.canComment = canComment;
    this.clientId = uid();
    this.queue = new Map(); // dedupliziert upserts pro Element
    this.extra = [];        // nicht deduplizierbare Operationen
    this.flushTimer = null;
    this.handlers = {};
    this.connected = false;
    this.inflight = Promise.resolve();
    this.sending = [];
    this.transport = null;
    this.pollLoop = 0;
    // Speicherstand des Servers (siehe lib/boards.js): eigene Änderungen gelten als gespeichert,
    // wenn savedSeq den in der Antwort genannten Stand (ackSeq) erreicht hat
    this.save = { epoch: null, ackSeq: 0, savedSeq: 0, failed: false, at: 0 };
    this.retrying = false;
  }

  // Server meldet seinen Speicherstand (Begrüßung, Antwort auf Änderungen, Nachricht „saved“)
  noteSave(st, { own = false, at = 0 } = {}) {
    if (!st) return;
    const sv = this.save;
    if (st.epoch !== sv.epoch) {
      // Board wurde auf dem Server neu geladen – Zähler beginnen von vorn
      sv.epoch = st.epoch;
      sv.ackSeq = 0;
      sv.savedSeq = 0;
    }
    if (own) sv.ackSeq = Math.max(sv.ackSeq, st.seq);
    sv.savedSeq = Math.max(sv.savedSeq, st.savedSeq);
    sv.failed = !!st.saveFailed;
    if (at && sv.savedSeq >= sv.ackSeq) sv.at = at;
    this.emitState();
  }

  // Zustand für die Anzeige: offline | connecting | saving | error | saved
  saveState() {
    const local = this.queue.size + this.extra.length + this.sending.length;
    if (!this.connected) return { state: this.everConnected ? 'offline' : 'connecting', pending: local };
    // Server konnte nicht schreiben, oder das Senden ist gescheitert und wird wiederholt
    if (this.save.failed || this.retrying) return { state: 'error', pending: local };
    if (local || this.save.ackSeq > this.save.savedSeq) return { state: 'saving', pending: local };
    return { state: 'saved', at: this.save.at };
  }

  emitState() {
    this.emit('saveState', this.saveState());
  }

  on(type, fn) {
    this.handlers[type] = fn;
    return this;
  }

  emit(type, data) {
    this.handlers[type] && this.handlers[type](data);
  }

  dispatch(msg) {
    if (msg.type === 'hello') {
      this.connected = true;
      this.everConnected = true;
      this.emit('status', true);
      // Stand der Begrüßung: alles bis seq ist auf dem Server (eigene, noch unbestätigte Änderungen folgen)
      if (msg.save) {
        this.save.epoch = null;
        this.noteSave(msg.save, { own: true, at: msg.save.seq <= msg.save.savedSeq ? Date.now() : 0 });
      }
    }
    if (msg.type === 'saved') this.noteSave(msg, { at: msg.at });
    this.emit(msg.type, msg);
  }

  // Bevorzugt Server-Sent Events; werden diese blockiert oder von einem Proxy gepuffert,
  // geht es automatisch mit Long-Polling weiter (normales HTTP, funktioniert praktisch überall)
  connect() {
    this.stopped = false;
    const forced = new URLSearchParams(location.search).get('transport');
    if (this.transport === 'poll' || forced === 'poll' || (forced !== 'sse' && rememberedPoll())) return this.connectPoll();
    this.transport = 'sse';
    const p = new URLSearchParams({ client: this.clientId });
    let greeted = false;
    let failures = 0;
    this.es = new EventSource(`/api/boards/${this.boardId}/events?${p}`);
    // remember: nur wenn der Stream offensichtlich zurückgehalten wird (Zeitüberschreitung), nicht bei kurzen Störungen
    // wie einem Neustart des Servers – sonst bliebe der Browser grundlos eine Woche beim Long-Polling
    const fallback = (remember) => {
      if (this.transport !== 'sse' || this.stopped) return;
      console.warn('Echtzeit-Stream nicht verfügbar – wechsle auf Long-Polling');
      this.es.close();
      if (remember) rememberTransport('poll');
      this.connectPoll();
    };
    // Keine Begrüßung innerhalb weniger Sekunden → Stream kommt vermutlich nicht durch (z. B. Pufferung)
    this.sseTimer = setTimeout(() => !greeted && fallback(true), SSE_TIMEOUT);
    this.es.onmessage = (e) => {
      let msg;
      try {
        msg = JSON.parse(e.data);
      } catch {
        return;
      }
      // Der Stream kommt durch – auf die (evtl. große) Begrüßung ohne Zeitlimit warten
      if (msg.type === 'stream') {
        clearTimeout(this.sseTimer);
        return;
      }
      if (msg.type === 'hello') {
        greeted = true;
        clearTimeout(this.sseTimer);
        rememberTransport('sse');
      }
      this.dispatch(msg);
    };
    this.es.onerror = () => {
      this.connected = false;
      this.emit('status', false);
      this.emitState();
      if (!greeted && ++failures >= 2) fallback(false);
    };
  }

  async connectPoll() {
    this.transport = 'poll';
    this.emit('transport', 'poll');
    const loop = ++this.pollLoop;
    const p = new URLSearchParams({ client: this.clientId, transport: 'poll' });
    while (!this.stopped && this.pollLoop === loop) {
      try {
        // Anmelden am Board (liefert die Begrüßung mit dem aktuellen Stand)
        const r = await fetch(`/api/boards/${this.boardId}/events?${p}`, { cache: 'no-store', credentials: 'same-origin' });
        if (r.status === 401 || r.status === 403 || r.status === 404) {
          this.emit('status', false);
          return;
        }
        if (!r.ok) throw new Error(T('HTTP ') + r.status);
        for (const m of (await r.json()).messages || []) this.dispatch(m);
        // Nachrichten abholen, bis die Verbindung serverseitig beendet wird (410)
        while (!this.stopped && this.pollLoop === loop) {
          const q = await fetch(`/api/boards/${this.boardId}/poll?client=${encodeURIComponent(this.clientId)}`, { cache: 'no-store', credentials: 'same-origin' });
          if (q.status === 410) break;
          if (!q.ok) throw new Error(T('HTTP ') + q.status);
          for (const m of (await q.json()).messages || []) this.dispatch(m);
        }
      } catch {
        this.connected = false;
        this.emit('status', false);
        this.emitState();
        await new Promise((res) => setTimeout(res, 2000));
      }
    }
  }

  close() {
    this.stopped = true;
    this.pollLoop++;
    clearTimeout(this.sseTimer);
    if (this.es) this.es.close();
  }

  reconnectAs(user) {
    this.user = user;
    this.close();
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
    // Abstimmen und Schätzen dürfen auch Betrachter, Kommentieren ab der Rolle „Kommentieren“
    if (this.viewOnly && !['vote', 'estimate', 'pollVote', 'romanVote', 'react'].includes(o.op) && !(o.op === 'comment' && this.canComment)) return;
    if (o.op === 'vote') delete o.userId;
    this.extra.push(o);
    this.schedule();
  }

  schedule() {
    if (!this.flushTimer) this.flushTimer = setTimeout(() => this.flush(), 40);
    this.emitState();
  }

  flush() {
    this.flushTimer = null;
    const ops = this.take();
    if (!ops.length) return this.inflight;
    for (const part of packets(ops)) {
      this.sending.push(part);
      // Reihenfolge der Pakete sicherstellen
      this.inflight = this.inflight.then(() => this.post(part));
    }
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
    if (!this.sending.includes(ops)) this.sending.push(ops);
    return fetch(`/api/boards/${this.boardId}/ops`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Vibeboard': '1' },
      body,
      keepalive: body.length < 60000, // Browser erlauben keepalive nur bis 64 KB
    })
      .then(async (r) => {
        const res = await r.json().catch(() => ({}));
        // 409: Verbindung (noch) nicht registriert – nach dem Wiederverbinden erneut senden
        if (r.status === 409 || r.status >= 500) throw new Error(res.error || 'retry');
        if (res.voting !== undefined) this.emit('voting', res.voting);
        if (res.rejected && res.rejected.length) this.emit('rejected', res.rejected);
        if (res.marks && res.marks.length) this.emit('marks', res.marks);
        if (res.revert && res.revert.length) this.emit('revert', res.revert);
        // Von der Moderation abgelehnte Sitzungsänderungen (Timer, Abstimmung …): gültigen Zustand übernehmen
        if (res.session && res.session.length) this.emit('ops', { ops: res.session });
        if (res.blocked) this.emit('blocked', res.blocked);
        if (res.error) this.emit('error', res.error);
        this.retrying = false;
        if (r.ok) this.noteSave(res.save, { own: true });
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
        this.retrying = true;
        setTimeout(() => this.schedule(), 1500);
      })
      .finally(() => {
        this.sending = this.sending.filter((x) => x !== ops);
        this.emitState();
      });
  }

  // Beim Verlassen der Seite: sofort senden, ohne auf laufende Pakete zu warten
  flushNow() {
    clearTimeout(this.flushTimer);
    this.flushTimer = null;
    for (const part of packets(this.take())) this.post(part);
  }

  // Noch nicht bestätigte eigene Änderungen (für den Abgleich nach einem Wiederverbinden)
  pendingOps() {
    return [...this.sending.flat(), ...this.queue.values()].filter((o) => o.op === 'upsert' || o.op === 'delete');
  }

  signal(kind, data) {
    fetch(`/api/boards/${this.boardId}/signal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Vibeboard': '1' },
      body: JSON.stringify({ clientId: this.clientId, kind, data }),
    }).catch(() => {});
  }

  get pending() {
    return this.queue.size + this.extra.length > 0;
  }

  // Noch nicht in der Datenbank angekommene eigene Änderungen (Warnung beim Verlassen der Seite)
  get unsaved() {
    return this.queue.size + this.extra.length + this.sending.length > 0 || this.save.ackSeq > this.save.savedSeq;
  }
}
