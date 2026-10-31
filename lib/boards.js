'use strict';
const log = require('./log').child('boards');
// Boards: Zugriffsrechte, Arbeitsspeicher-Cache, Persistenz und Echtzeit-Räume
const crypto = require('crypto');
const db = require('./db');
const { validId, sanitizeElement, cleanJson } = require('./sanitize');
// Zellgenaue Tabellenänderungen – dieselbe Logik wie im Browser
const TableOps = require('../public/js/table-ops.js');
const ConcealOps = require('../public/js/conceal-ops.js');
const activity = require('./activity');
const retro = require('./retro');
const newId = () => crypto.randomBytes(6).toString('base64url');

// Kommentieren: wie Ansehen, zusätzlich Kommentare schreiben, beantworten, erledigen und zuweisen
const ROLE_RANK = { viewer: 1, commenter: 2, editor: 3, owner: 4 };
const LINK_ROLE = { view: 'viewer', comment: 'commenter', edit: 'editor' };

// Elementarten, die im privaten Modus nur für die erstellende Person sichtbar sind
const PRIVATE_TYPES = new Set(['sticky', 'text', 'card', 'shape', 'code', 'table', 'image']);

// Kartendecks für Schätzrunden
const DECKS = {
  fib: ['0', '1', '2', '3', '5', '8', '13', '20', '40', '100', '?', '☕'],
  tshirt: ['XS', 'S', 'M', 'L', 'XL', 'XXL', '?', '☕'],
  hours: ['1', '2', '4', '8', '16', '24', '40', '?', '☕'],
};

// Automatische Versionen: höchstens alle 30 Minuten, solange das Board bearbeitet wird
const AUTO_VERSION_MS = 30 * 60000;
const VERSION_KEEP = { auto: 20, manual: 30, restore: 5 };
const MAX_VERSION_BYTES = 20 * 1024 * 1024;
const canEdit = (role) => ROLE_RANK[role] >= 3;
const canComment = (role) => ROLE_RANK[role] >= 2;
const maxRole = (...roles) => roles.filter((r) => ROLE_RANK[r]).reduce((a, r) => (!a || ROLE_RANK[r] > ROLE_RANK[a] ? r : a), null);

/* ================================================================== */
/* Zugriff                                                             */
/* ================================================================== */

// Rolle aus den Angaben einer Board-Zeile: die höchste aus Mitgliedschaft, Team und Link-Freigabe.
// Gäste erhalten ausschließlich die Rolle ihres (gültigen) Gastlinks für genau dieses Board.
function roleFor(b, user) {
  if (!b || !user) return null;
  if (user.role === 'guest') return b.guest_role || null;
  if (user.role === 'admin' || String(b.owner_id) === String(user.id)) return 'owner';
  return maxRole(b.member_role, b.team_member ? b.team_role : null, LINK_ROLE[b.link_access]);
}

// Rolle eines Benutzers für ein Board: owner | editor | commenter | viewer | null
async function access(boardId, user) {
  if (!validId(boardId) || !user) return { board: null, role: null };
  const b = await db.one(
    `SELECT b.id, b.name, b.owner_id, b.link_access, b.team_id, b.team_role, m.role AS member_role,
            (tm.user_id IS NOT NULL) AS team_member,
            (SELECT gl.role FROM guest_links gl WHERE gl.id = $3 AND gl.board_id = b.id AND gl.revoked_at IS NULL AND gl.expires_at > now()) AS guest_role
       FROM boards b
       LEFT JOIN board_members m ON m.board_id = b.id AND m.user_id = $2
       LEFT JOIN team_members tm ON tm.team_id = b.team_id AND tm.user_id = $2
      WHERE b.id = $1 AND b.deleted_at IS NULL`, [boardId, user.id, user.role === 'guest' ? user.guest_link_id : null]);
  if (!b) return { board: null, role: null };
  return { board: b, role: roleFor(b, user) };
}

/* ---------------- Moderation ---------------- */

// Moderierende: Besitzer (und Admins) immer, sonst die bei laufender Moderation eingetragenen Personen
function isFacilitator(b, uid, role) {
  if (role === 'owner') return true;
  const m = b.session.moderation;
  return !!(m && m.active && Array.isArray(m.facilitators) && m.facilitators.includes(String(uid)));
}

// Sind Timer, Abstimmung, Schätzrunde, privater Modus und „Alle zu mir“ gerade der Moderation vorbehalten?
function toolsReserved(b, uid, role) {
  const m = b.session.moderation;
  return !!(m && m.active && m.reserveTools) && !isFacilitator(b, uid, role);
}

/* ================================================================== */
/* Cache & Persistenz                                                  */
/* ================================================================== */

const cache = new Map();   // id -> Board im Speicher
const loading = new Map(); // id -> Promise
const removed = new Set(); // gerade gelöschte Boards – nicht erneut laden oder speichern

async function load(id) {
  if (removed.has(id)) return null;
  if (cache.has(id)) return cache.get(id);
  if (loading.has(id)) return loading.get(id);
  const p = (async () => {
    const row = await db.one('SELECT id, name, owner_id, link_access, session, created_at, updated_at, prev_retro_id FROM boards WHERE id = $1 AND deleted_at IS NULL', [id]);
    if (!row || removed.has(id)) return null;
    const els = (await db.query('SELECT data FROM elements WHERE board_id = $1', [id])).rows;
    const lastVersion = await db.one('SELECT max(created_at) AS t FROM board_versions WHERE board_id = $1', [id]);
    const b = {
      id: row.id,
      name: row.name,
      ownerId: row.owner_id,
      linkAccess: row.link_access,
      prevRetroId: row.prev_retro_id || null,
      session: { timer: null, voting: null, ...(row.session || {}) },
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      elements: new Map(els.map((r) => [r.data.id, r.data])),
      dirty: new Set(),
      deleted: new Set(),
      metaDirty: false,
      timer: null,
      flushing: false,
      // Speicherstand für die Anzeige „Alle Änderungen gespeichert“: seq zählt Änderungen im Speicher,
      // savedSeq ist der Stand, der zuletzt vollständig in der Datenbank angekommen ist. epoch unterscheidet
      // neu geladene Boards (Zähler beginnt dann wieder bei 0).
      epoch: crypto.randomBytes(6).toString('hex'),
      opSeq: Date.now(), // wächst auch über einen Neustart hinweg weiter
      tableSeen: new Set(), // bereits ausgeführte Tabellenänderungen (siehe tpatch, tstruct)
      seq: 0,
      savedSeq: 0,
      saveFailed: false,
      lastActive: Date.now(),
      lastVersionAt: lastVersion && lastVersion.t ? new Date(lastVersion.t).getTime() : 0,
    };
    cache.set(id, b);
    return b;
  })();
  loading.set(id, p);
  try {
    return await p;
  } finally {
    loading.delete(id);
  }
}

function schedule(b) {
  b.seq++;
  b.updatedAt = new Date();
  b.lastActive = Date.now();
  if (!b.timer) b.timer = setTimeout(() => flush(b), 1000);
}

// Allen Verbundenen den Speicherstand mitteilen
function saveState(b) {
  return { epoch: b.epoch, seq: b.seq, savedSeq: b.savedSeq, saveFailed: b.saveFailed };
}

function markSaved(b, seq, ok) {
  if (ok) b.savedSeq = Math.max(b.savedSeq, seq);
  b.saveFailed = !ok;
  broadcast(b.id, { type: 'saved', ...saveState(b), at: Date.now() });
}

async function flush(b) {
  b.timer = null;
  if (b.removed) return;
  if (b.flushing) {
    b.timer = setTimeout(() => flush(b), 1000);
    return;
  }
  const seq = b.seq;
  const dirty = [...b.dirty];
  const deleted = [...b.deleted];
  const meta = b.metaDirty;
  b.dirty.clear();
  b.deleted.clear();
  b.metaDirty = false;
  if (!dirty.length && !deleted.length && !meta) {
    // nichts zu schreiben (z. B. nur Zwischenschritte, die schon gespeichert sind)
    if (seq > b.savedSeq) markSaved(b, seq, true);
    return;
  }
  b.flushing = true;
  let ok = true;
  try {
    await db.tx(async (c) => {
      const list = dirty.map((id) => b.elements.get(id)).filter(Boolean);
      if (list.length) {
        await c.query(
          `INSERT INTO elements (board_id, id, data)
           SELECT $1, e->>'id', e FROM jsonb_array_elements($2::jsonb) e
           ON CONFLICT (board_id, id) DO UPDATE SET data = EXCLUDED.data`, [b.id, JSON.stringify(list)]);
      }
      if (deleted.length) await c.query('DELETE FROM elements WHERE board_id = $1 AND id = ANY($2::text[])', [b.id, deleted]);
      await c.query('UPDATE boards SET name = $2, session = $3, updated_at = now() WHERE id = $1', [b.id, b.name, b.session]);
    });
    if (dirty.length || deleted.length) maybeAutoVersion(b);
  } catch (e) {
    // Board wurde inzwischen gelöscht (Fremdschlüssel) – nichts mehr zu speichern
    if (b.removed || e.code === '23503') {
      forget(b.id);
      return;
    }
    log.error('Board konnte nicht gesammelt gespeichert werden – speichere einzeln', { boardId: b.id, err: e });
    ok = await flushIndividually(b, dirty, deleted);
  } finally {
    b.flushing = false;
  }
  if (!b.removed) markSaved(b, seq, ok);
}

// Rückfallebene: jedes Element einzeln speichern, damit ein fehlerhaftes nicht alle anderen blockiert
async function flushIndividually(b, dirty, deleted) {
  let retry = false;
  for (const id of dirty) {
    const el = b.elements.get(id);
    if (!el) continue;
    try {
      await db.query(`INSERT INTO elements (board_id, id, data) VALUES ($1, $2, $3)
                      ON CONFLICT (board_id, id) DO UPDATE SET data = EXCLUDED.data`, [b.id, id, JSON.stringify(el)]);
    } catch (e) {
      if (e.code && e.code.startsWith('22')) log.error('Element verworfen (ungültige Daten)', { boardId: b.id, elementId: id, err: e });
      else {
        b.dirty.add(id);
        retry = true;
      }
    }
  }
  try {
    if (deleted.length) await db.query('DELETE FROM elements WHERE board_id = $1 AND id = ANY($2::text[])', [b.id, deleted]);
    await db.query('UPDATE boards SET name = $2, session = $3, updated_at = now() WHERE id = $1', [b.id, b.name, JSON.stringify(cleanJson(b.session))]);
  } catch (e) {
    log.error('Board-Metadaten konnten nicht gespeichert werden', { boardId: b.id, err: e });
    for (const id of deleted) b.deleted.add(id);
    b.metaDirty = true;
    retry = true;
  }
  if (retry && !b.removed) setTimeout(() => schedule(b), 3000);
  return !retry;
}

async function flushBoard(id) {
  const b = cache.get(id);
  if (!b) return;
  clearTimeout(b.timer);
  b.timer = null;
  while (b.flushing) await new Promise((r) => setTimeout(r, 20));
  await flush(b);
}

async function flushAll() {
  await Promise.all([...cache.keys()].map(flushBoard));
}

function forget(id) {
  const b = cache.get(id);
  if (b) clearTimeout(b.timer);
  cache.delete(id);
}

// Nicht mehr genutzte Boards aus dem Speicher entfernen
setInterval(() => {
  const now = Date.now();
  for (const [id, b] of cache) {
    if (rooms.has(id) || b.dirty.size || b.deleted.size || b.metaDirty || b.flushing) continue;
    if (now - b.lastActive > 5 * 60000) cache.delete(id);
  }
}, 60000).unref();

// Neues Board (Vorlage, Import, Kopie einer Version). Zuweisungen und Moderationssperren werden nicht übernommen;
// bei nicht vertrauenswürdigen Daten (Import) verlieren Kommentare zudem die Benutzer-IDs ihrer Beiträge –
// der Name bleibt als Text erhalten, gilt aber nicht als echte Autorschaft.
function forCopy(el, trusted) {
  if (!el) return null;
  const o = { ...el };
  delete o.task;
  delete o.modLock;
  delete o.ext;
  if (!trusted && o.type === 'comment' && Array.isArray(o.thread)) o.thread = o.thread.map(({ uid, ...m }) => m);
  // Importierte Datei-Elemente: Die Dateien liegen auf dem Herkunfts-Board
  if (!trusted && o.type === 'file') {
    delete o.fileId;
    delete o.preview;
  }
  return o;
}

async function create({ name, ownerId, elements = [], trusted = false }) {
  const id = newId();
  await db.tx(async (c) => {
    await c.query('INSERT INTO boards (id, name, owner_id) VALUES ($1, $2, $3)', [id, String(name || require('./i18n').tr('Unbenanntes Board')).slice(0, 200), ownerId]);
    const list = (Array.isArray(elements) ? elements : []).map(sanitizeElement).map((e) => forCopy(e, trusted)).filter(Boolean);
    if (list.length) {
      await c.query(
        `INSERT INTO elements (board_id, id, data)
         SELECT $1, e->>'id', e FROM jsonb_array_elements($2::jsonb) e ON CONFLICT DO NOTHING`, [id, JSON.stringify(list)]);
    }
  });
  return id;
}

async function duplicate(srcId, ownerId, skip = null) {
  await flushBoard(srcId);
  const id = newId();
  await db.tx(async (c) => {
    await c.query(`INSERT INTO boards (id, name, owner_id, thumbnail) SELECT $2, name || ' (Kopie)', $3, thumbnail FROM boards WHERE id = $1`, [srcId, id, ownerId]);
    // Private Elemente anderer werden nicht mitkopiert, eigene werden in der Kopie öffentlich.
    // Inhalte verborgener Bereiche nur, wenn die kopierende Person sie sehen darf.
    const hide = skip && skip.size ? [...skip] : [];
    await c.query(`INSERT INTO elements (board_id, id, data)
                   SELECT $2, id, data - 'priv' - 'privName' - 'task' - 'modLock' - 'reactions' - 'ext' FROM elements
                    WHERE board_id = $1 AND (NOT data ? 'priv' OR data->>'priv' = $3) AND NOT (id = ANY($4::text[]))`, [srcId, id, String(ownerId), hide]);
    await require('./files').copyReferenced(srcId, id, c);
  });
  return id;
}

/* ================================================================== */
/* Versionen (Sicherungspunkte eines Boards)                           */
/* ================================================================== */

async function createVersion(boardId, { kind = 'manual', label = null, userId = null } = {}) {
  const r = await db.one(
    `INSERT INTO board_versions (board_id, kind, label, created_by, name, element_count, data)
     SELECT b.id, $2, $3, $4, b.name, count(e.id), COALESCE(jsonb_agg(e.data) FILTER (WHERE e.id IS NOT NULL), '[]'::jsonb)
       FROM boards b LEFT JOIN elements e ON e.board_id = b.id
      WHERE b.id = $1 AND (SELECT COALESCE(sum(octet_length(data::text)), 0) FROM elements WHERE board_id = $1) < $5
      GROUP BY b.id, b.name
     RETURNING id, created_at`, [boardId, kind, label ? String(label).slice(0, 120) : null, userId, MAX_VERSION_BYTES]);
  if (!r) return null;
  await db.query(
    `DELETE FROM board_versions WHERE board_id = $1 AND kind = $2 AND id NOT IN (
       SELECT id FROM board_versions WHERE board_id = $1 AND kind = $2 ORDER BY created_at DESC LIMIT $3)`,
    [boardId, kind, VERSION_KEEP[kind] || 25]);
  const b = cache.get(boardId);
  if (b) b.lastVersionAt = Date.now();
  return r;
}

function maybeAutoVersion(b) {
  if (Date.now() - (b.lastVersionAt || 0) < AUTO_VERSION_MS) return;
  b.lastVersionAt = Date.now();
  createVersion(b.id, { kind: 'auto' }).catch((e) => log.error('Automatische Version fehlgeschlagen', { boardId: b.id, err: e }));
}

async function versionData(boardId, versionId) {
  if (!/^\d{1,18}$/.test(String(versionId))) return null;
  return db.one('SELECT id, name, kind, label, created_at, data FROM board_versions WHERE id = $1 AND board_id = $2', [versionId, boardId]);
}

// Stellt eine Version wieder her. Der aktuelle Stand wird vorher selbst als Version gesichert.
async function restoreVersion(boardId, versionId, user) {
  const v = await versionData(boardId, versionId);
  if (!v) return null;
  const b = await load(boardId);
  if (!b) return null;
  // Während des Wiederherstellens keine Änderungen annehmen (sie gingen sonst still verloren)
  b.restoring = true;
  try {
    await flushBoard(boardId);
    const backup = await createVersion(boardId, { kind: 'restore', label: 'Stand vor dem Wiederherstellen', userId: user.id });
    if (!backup) {
      const e = new Error('Das Board ist zu groß, um den aktuellen Stand vorher zu sichern. Wiederherstellen abgebrochen.');
      e.status = 413;
      throw e;
    }
    const list = (Array.isArray(v.data) ? v.data : []).filter((e) => e && validId(e.id));
    // Enthält die Version noch nicht aufgedeckte private Elemente, bleiben sie privat und der private Modus wird
    // (wieder) aktiviert – sie müssen erneut aufgedeckt werden, statt ungefragt sichtbar zu werden
    const session = { ...b.session, voting: null, estimation: null };
    if (list.some((e) => e.priv) && !(session.privateMode && session.privateMode.active)) {
      session.privateMode = { active: true, by: user.display_name || user.username, byId: String(user.id), startedAt: Date.now(), restored: true };
    }
    clearTimeout(b.timer);
    b.timer = null;
    await db.tx(async (c) => {
      await c.query('DELETE FROM elements WHERE board_id = $1', [boardId]);
      if (list.length) {
        await c.query(`INSERT INTO elements (board_id, id, data) SELECT $1, e->>'id', e FROM jsonb_array_elements($2::jsonb) e ON CONFLICT DO NOTHING`, [boardId, JSON.stringify(list)]);
      }
      await c.query('UPDATE boards SET session = $2, updated_at = now() WHERE id = $1', [boardId, JSON.stringify(cleanJson(session))]);
    });
    b.removed = true; // alte Instanz im Speicher verwerfen
    forget(boardId);
    // Alle Verbundenen laden den wiederhergestellten Stand neu
    kickWhere(boardId, () => true, 'restored');
    return { count: list.length };
  } finally {
    b.restoring = false;
  }
}

// Endgültig löschen (Papierkorb leeren, Benutzer löschen)
async function remove(id) {
  removed.add(id);
  const b = cache.get(id);
  if (b) b.removed = true;
  broadcast(id, { type: 'deleted' });
  closeRoom(id);
  forget(id);
  try {
    await db.query('DELETE FROM boards WHERE id = $1', [id]);
  } finally {
    setTimeout(() => removed.delete(id), 60000).unref();
  }
}

// In den Papierkorb legen: Board ist für alle unzugänglich, bleibt aber wiederherstellbar
async function trash(id, userId) {
  await flushBoard(id);
  await db.query('UPDATE boards SET deleted_at = now(), deleted_by = $2 WHERE id = $1 AND deleted_at IS NULL', [id, userId]);
  const b = cache.get(id);
  if (b) b.removed = true;
  broadcast(id, { type: 'deleted' });
  closeRoom(id);
  forget(id);
}

async function untrash(id) {
  const r = await db.one('UPDATE boards SET deleted_at = NULL, deleted_by = NULL WHERE id = $1 AND deleted_at IS NOT NULL RETURNING id', [id]);
  return !!r;
}

// Abgelaufene Boards aus dem Papierkorb endgültig entfernen
async function purgeTrash(days) {
  const rows = (await db.query(`SELECT id FROM boards WHERE deleted_at < now() - make_interval(days => $1)`, [days])).rows;
  for (const r of rows) await remove(r.id);
  if (rows.length) log.info('Papierkorb geleert', { count: rows.length });
  return rows.length;
}

async function rename(id, name) {
  name = String(name || '').trim().slice(0, 200);
  if (!name) return;
  const b = cache.get(id);
  if (b) {
    b.name = name;
    b.metaDirty = true;
    schedule(b);
  } else await db.query('UPDATE boards SET name = $2, updated_at = now() WHERE id = $1', [id, name]);
  broadcast(id, { type: 'ops', ops: [{ op: 'rename', name }] });
}

function setLinkAccess(id, linkAccess) {
  const b = cache.get(id);
  if (b) b.linkAccess = linkAccess;
}

/* ================================================================== */
/* Echtzeit                                                            */
/* ================================================================== */

const rooms = new Map(); // boardId -> Map(clientId -> { res, user, role, uid })

function send(res, msg) {
  if (res.poll) res.push(msg);
  else res.write('data: ' + JSON.stringify(msg) + '\n\n');
}

// Rückfall für Umgebungen, in denen Server-Sent Events blockiert oder gepuffert werden:
// Nachrichten werden gesammelt und per Long-Polling abgeholt. Verhält sich nach außen wie eine Antwort (res).
class PollChannel {
  constructor() {
    this.poll = true;
    this.queue = [];
    this.waiter = null;
    this.ended = false;
    this.lastPoll = Date.now();
    this.closeHandlers = [];
  }
  push(msg) {
    if (this.ended) return;
    this.queue.push(msg);
    // Client holt nicht mehr ab und der Puffer läuft voll → neu laden lassen statt Nachrichten zu verlieren
    if (this.queue.length > 5000) {
      this.queue = [{ type: 'reload', reason: 'overflow' }];
      this.end();
    }
    this.wake();
  }
  take() {
    const q = this.queue;
    this.queue = [];
    return q;
  }
  wake() {
    if (this.waiter) {
      const w = this.waiter;
      this.waiter = null;
      w();
    }
  }
  end() {
    if (this.ended) return;
    this.ended = true;
    this.wake();
    this.closeHandlers.splice(0).forEach((f) => f());
  }
  onClose(fn) {
    this.closeHandlers.push(fn);
  }
}

// Polling-Teilnehmer, die nicht mehr abholen (Tab geschlossen), nach einer Minute entfernen
setInterval(() => {
  const now = Date.now();
  for (const [bid, room] of rooms) {
    for (const [cid, c] of room) {
      if (c.res.poll && !c.res.waiter && now - c.res.lastPoll > 60000) {
        room.delete(cid);
        c.res.end();
        broadcast(bid, { type: 'leave', clientId: cid });
      }
    }
    if (!room.size) rooms.delete(bid);
  }
}, 15000).unref();

function broadcast(boardId, msg, exceptClientId) {
  const room = rooms.get(boardId);
  if (!room) return;
  for (const [cid, c] of room) if (cid !== exceptClientId) send(c.res, msg);
}

function join(boardId, clientId, client) {
  if (!rooms.has(boardId)) rooms.set(boardId, new Map());
  const room = rooms.get(boardId);
  const old = room.get(clientId);
  // Eine fremde Verbindung mit derselben clientId darf nicht verdrängt werden
  if (old && old.uid !== client.uid) return null;
  if (old) old.res.end();
  room.set(clientId, client);
  return [...room.values()].map((c) => c.user).filter((u) => u.clientId !== clientId);
}

function leave(boardId, clientId, res) {
  const room = rooms.get(boardId);
  if (!room || !room.get(clientId) || room.get(clientId).res !== res) return false;
  room.delete(clientId);
  if (!room.size) rooms.delete(boardId);
  return true;
}

function client(boardId, clientId) {
  return rooms.get(boardId)?.get(clientId) || null;
}

// Verbindungen schließen, z. B. nach geänderten Rechten (Client lädt neu)
function kickUser(boardId, userId, reason = 'access') {
  kickWhere(boardId, (c) => String(c.uid) === String(userId), reason);
}

// Nach Abmeldung oder Kennwortänderung: Verbindungen bestimmter Sessions schließen
function kickSessions(pred, reason = 'disabled') {
  kickWhere(null, (c) => pred(c), reason);
}

function kickWhere(boardId, pred, reason) {
  const list = boardId ? [[boardId, rooms.get(boardId)]] : [...rooms];
  for (const [bid, room] of list) {
    if (!room) continue;
    for (const [cid, c] of room) {
      if (!pred(c)) continue;
      send(c.res, { type: 'reload', reason });
      c.res.end();
      room.delete(cid);
      broadcast(bid, { type: 'leave', clientId: cid });
    }
    if (!room.size) rooms.delete(bid);
  }
}

function closeRoom(boardId) {
  const room = rooms.get(boardId);
  if (!room) return;
  for (const c of room.values()) c.res.end();
  rooms.delete(boardId);
}

/* ---------------- Privater Modus & Schätzrunden: Ansicht pro Empfänger ---------------- */

// Fremde private Elemente nur als verdeckte Platzhalter (Lage, Größe, Farbe) ausliefern
function redactEl(el, uid) {
  if (!el || !el.priv || String(el.priv) === String(uid)) return el;
  // Anonym gesammelt: auch die Benutzer-ID der erstellenden Person bleibt verborgen
  const o = { id: el.id, type: el.type, x: el.x, y: el.y, w: el.w, h: el.h, z: el.z, hidden: true, priv: el.anon ? 'anon' : el.priv, privName: el.privName };
  for (const k of ['fill', 'color', 'shape', 'groupId']) if (el[k] !== undefined) o[k] = el[k];
  return o;
}

// Vor dem Aufdecken sieht jede Person nur, wer schon geschätzt hat – nicht den Wert
function redactEstimation(est, uid) {
  if (!est || est.revealed) return est;
  const votes = {};
  for (const [k, v] of Object.entries(est.votes || {})) votes[k] = k === String(uid) ? v : { name: v.name, voted: true };
  return { ...est, votes };
}

function redactOp(op, uid, hidden) {
  // Verborgene Bereiche: Inhalte erreichen Teilnehmende nicht (ein Löschen entfernt evtl. schon vorhandene Kopien)
  if (hidden && hidden.size) {
    if (op.op === 'upsert' && op.el && hidden.has(op.el.id)) return { op: 'delete', id: op.el.id };
    if ((op.op === 'tpatch' || op.op === 'tstruct') && hidden.has(op.id)) return null;
  }
  if (op.op === 'upsert' && op.el && op.el.priv) return { op: 'upsert', el: redactEl(op.el, uid) };
  if (op.op === 'estimation') return { op: 'estimation', estimation: redactEstimation(op.estimation, uid) };
  if (op.op === 'poll') return { op: 'poll', poll: retro.redactPoll(op.poll, uid) };
  return op;
}

// Verborgene Elemente des Boards (leer, solange es keinen verborgenen Bereich gibt)
function concealedOf(b) {
  if (b.concealCache && b.concealCache.v === b.seq && b.concealCache.n === b.elements.size) return b.concealCache.set;
  const set = ConcealOps.concealedIds(b.elements);
  b.concealCache = { v: b.seq, n: b.elements.size, set };
  return set;
}

// Sieht diese Verbindung verborgene Inhalte?
const seesConcealed = (b, c) => isFacilitator(b, c.uid, c.role);

// Darf diese Person dieses Element sehen? Einzige Stelle für diese Entscheidung: Wer Elemente außerhalb des
// Echtzeit-Kanals verwendet (Freigaben, Tickets, Exporte auf dem Server), fragt hier. Elemente im Speicher sind ungeschwärzt.
function canSeeElement(b, el, uid, role) {
  if (!el) return false;
  if (el.priv && String(el.priv) !== String(uid)) return false;
  return isFacilitator(b, String(uid), role) || !concealedOf(b).has(el.id);
}

// seq legt die Reihenfolge fest: Browser ordnen damit Bestätigung und Live-Stream, die sich überholen können
function broadcastOps(b, ops, exceptClientId, seq = ++b.opSeq) {
  const room = rooms.get(b.id);
  if (!room || !ops.length) return;
  const hidden = concealedOf(b);
  const personal = hidden.size || ops.some((o) => (o.op === 'upsert' && o.el && o.el.priv) || o.op === 'estimation' || o.op === 'poll');
  // Bewusst ohne Absender: Änderungen an anonymen Beiträgen dürfen nicht zuzuordnen sein
  const raw = personal ? null : { type: 'ops', ops, seq };
  for (const [cid, c] of room) {
    if (cid === exceptClientId) continue;
    if (raw) {
      send(c.res, raw);
      continue;
    }
    const h = hidden.size && !seesConcealed(b, c) ? hidden : null;
    const list = ops.map((o) => redactOp(o, c.uid, h)).filter(Boolean);
    if (list.length) send(c.res, { type: 'ops', ops: list, seq });
  }
}

// Ein verborgener Bereich wurde gesetzt, aufgehoben, verschoben oder gelöscht: Teilnehmenden die Differenz schicken
function syncConcealment(b, before) {
  const after = concealedOf(b);
  const added = [...after].filter((id) => !before.has(id));
  const freed = [...before].filter((id) => !after.has(id) && b.elements.has(id));
  if (!added.length && !freed.length) return;
  const room = rooms.get(b.id);
  if (!room) return;
  for (const c of room.values()) {
    if (seesConcealed(b, c)) continue;
    const ops = [...added.map((id) => ({ op: 'delete', id })), ...freed.map((id) => ({ op: 'upsert', el: redactEl(b.elements.get(id), c.uid) }))];
    send(c.res, { type: 'ops', ops, seq: ++b.opSeq });
  }
}

const onlineCount = (boardId) => rooms.get(boardId)?.size || 0;
const totalOnline = () => [...rooms.values()].reduce((s, r) => s + r.size, 0);

// Änderungen, die nicht von einer verbundenen Person stammen (Abgleich mit Jira oder Azure DevOps)
function setElements(b, list) {
  if (!list.length) return;
  for (const el of list) {
    b.elements.set(el.id, el);
    b.dirty.add(el.id);
    b.deleted.delete(el.id);
  }
  schedule(b);
  broadcastOps(b, list.map((el) => ({ op: 'upsert', el })));
}

// Feldänderungen auf den aktuellen Stand anwenden. Muss direkt vor applyOps laufen, ohne await dazwischen:
// Sonst gingen Änderungen verloren, die andere in der Zwischenzeit gemacht haben.
const MAX_PATCH_FIELDS = 500;
const PATCH_RESERVED = new Set(['id', '__proto__', 'constructor', 'prototype']);

function expandPatches(b, ops) {
  const out = [];
  const seen = new Set();
  for (const op of ops) {
    if (!op || op.op !== 'patch') {
      out.push(op);
      continue;
    }
    // Browser senden je Element einen Patch. Mehr wären ein Hebel: Wenige Bytes ergeben jedes Mal das ganze Element.
    if (seen.has(op.id)) continue;
    seen.add(op.id);
    const prev = b.elements.get(op.id);
    // Inzwischen gelöscht: Die Löschung erreicht den Browser über den Live-Stream
    if (!prev || !op.set || typeof op.set !== 'object' || Array.isArray(op.set)) continue;
    const el = { ...prev };
    const fields = Object.entries(op.set);
    const unset = Array.isArray(op.unset) ? op.unset : [];
    if (fields.length + unset.length > MAX_PATCH_FIELDS) continue;
    for (const [k, v] of fields) if (!PATCH_RESERVED.has(k)) el[k] = v;
    for (const k of unset) if (typeof k === 'string' && !PATCH_RESERVED.has(k) && k !== 'type') delete el[k];
    out.push({ op: 'upsert', el });
  }
  return out;
}

function applyOps(b, ops, sender) {
  const out = [];
  const all = []; // geht an alle, auch an den Absender (Server ergänzt Daten)
  const reply = {};
  if (b.removed) return reply;
  const uid = String(sender.uid);
  const pm = b.session.privateMode;
  if (!b.recentlyDeleted) b.recentlyDeleted = new Set();
  const actor = { userId: uid, name: sender.user.name, color: sender.user.color };
  // Anonyme Beiträge (anonymer privater Modus) erscheinen im Verlauf ohne Namen
  const ANON = { userId: null, name: 'Anonym', color: '#868e96' };
  const actorFor = (el) => (el && el.anon ? ANON : actor);
  const fac = isFacilitator(b, uid, sender.role);
  // Verborgene Bereiche: Stand vor den Änderungen (nur, wenn Frames betroffen sein können)
  const hiddenBefore = concealedOf(b);
  const framesTouched = ops.some((o) => o && (o.op === 'delete' || (o.op === 'upsert' && o.el && (o.el.type === 'frame' || (b.elements.get(o.el.id) || {}).type === 'frame'))));
  const before = framesTouched ? new Set(hiddenBefore) : null;
  // Abgelehnte Änderung: dem Absender den gültigen Stand zurückgeben, damit sein Board nicht abweicht
  // Erst am Ende des Pakets gebildet: Der Stand muss auch spätere Operationen desselben Pakets enthalten
  const refused = new Set();
  const revert = (id) => refused.add(id);
  const mod = b.session.moderation;
  const editLocked = !!(mod && mod.active && mod.editLock) && !fac;
  const reserved = toolsReserved(b, uid, sender.role);
  // Steuern (Retro-Ablauf, Besprechung, Umfragen, Zufallsauswahl): wer moderiert – ohne Moderation, wer bearbeiten darf
  const canSteer = sender.role === 'owner' || (mod && mod.active ? fac : canEdit(sender.role));
  // Abgelehnte Sitzungsänderung: dem Absender den gültigen Zustand zurückgeben
  const revertSession = (o) => (reply.session = reply.session || []).push(o);
  const blocked = (why) => {
    reply.blocked = why;
  };
  const personal = []; // Sitzungsänderungen, die je Person anders aussehen (Umfragen)
  for (const op of ops) {
    if (!op || typeof op !== 'object') continue;
    // Gesperrtes Bearbeiten (Moderation) bzw. für Teilnehmende gesperrte Elemente
    if (['upsert', 'delete', 'tpatch', 'tstruct'].includes(op.op)) {
      const id = op.op === 'upsert' ? op.el && op.el.id : op.id;
      if (!validId(id)) continue;
      if (editLocked) {
        revert(id);
        blocked('editLock');
        continue;
      }
      const prevEl = b.elements.get(id);
      if (prevEl && prevEl.modLock && !fac) {
        revert(id);
        blocked('modLock');
        continue;
      }
      // Verborgene Bereiche und ihr Inhalt sind für Teilnehmende unveränderlich; neue Elemente dürfen nicht hinein
      if (!fac && (hiddenBefore.has(id) || (prevEl && prevEl.type === 'frame' && prevEl.concealed)
        || (op.op === 'upsert' && ConcealOps.inConcealedArea(op.el, b.elements)))) {
        revert(id);
        blocked('concealed');
        continue;
      }
    }
    switch (op.op) {
      case 'upsert': {
        // Verdeckte Platzhalter (z. B. aus Rückgängig oder Kopien) dürfen nie gespeichert werden
        if (op.el && op.el.hidden) {
          if (validId(op.el.id)) revert(op.el.id);
          break;
        }
        let el = sanitizeElement(op.el);
        if (!el) {
          if (op.el && validId(op.el.id)) revert(op.el.id);
          break;
        }
        const prev = b.elements.get(el.id);
        // Nur Moderierende dürfen Elemente für Teilnehmende sperren oder entsperren und Bereiche verbergen
        if (!fac) {
          if (prev && prev.modLock) el.modLock = true;
          else delete el.modLock;
          delete el.concealed;
        }
        if (el.type !== 'frame') delete el.concealed;
        // Reaktionen ändern sich nur über die Reaktions-Operation
        if (prev && prev.reactions) el.reactions = prev.reactions;
        else delete el.reactions;
        // Anonym gesammelt: Autorschaft bleibt dauerhaft verborgen – auch wenn ein gelöschter Beitrag per Rückgängig
        // zurückkommt (dann bringt der Browser den alten Stand mit, evtl. samt Namen)
        if ((prev && prev.anon) || (!prev && b.anonDeleted && b.anonDeleted.has(el.id))) el.anon = true;
        else delete el.anon; // Anonym wird nur, was im anonymen privaten Modus entsteht (siehe unten)
        // Der Name kommt vom Server: Sonst ließe sich ein Beitrag einer anderen Person unterschieben
        if (prev) {
          if (prev.author !== undefined) el.author = prev.author;
          else delete el.author;
        } else if (el.author !== undefined) el.author = sender.user.name;
        if (el.anon) delete el.author;
        // Kommentar-Threads ändern sich nur über Kommentar-Operationen (Autorschaft, Benachrichtigungen);
        // ein Upsert verschiebt lediglich den Kommentar und kann alte Stände nicht zurückschreiben.
        // Neue Kommentare oder ein Typwechsel von/zu „comment“ per Upsert sind nicht erlaubt – außer beim
        // Rückgängigmachen einer Löschung: dann wird der gespeicherte Serverstand wiederhergestellt.
        if ((el.type === 'comment') !== (!!prev && prev.type === 'comment') && (prev || el.type === 'comment')) {
          const saved = !prev && el.type === 'comment' && b.deletedComments && b.deletedComments.get(el.id);
          if (!saved) {
            revert(el.id);
            break;
          }
          el = { ...saved, x: el.x, y: el.y };
          b.deletedComments.delete(el.id);
        } else if (prev && prev.type === 'comment') {
          el = { ...prev, x: el.x, y: el.y, z: el.z, ...(el.groupId !== undefined ? { groupId: el.groupId } : {}), ...(fac ? { modLock: el.modLock } : {}), locked: el.locked };
          if (el.modLock === undefined) delete el.modLock;
          if (!el.locked) delete el.locked;
        }
        if (prev && prev.priv) {
          // Private Elemente anderer sind bis zum Aufdecken unveränderlich
          if (String(prev.priv) !== uid) {
            revert(el.id);
            break;
          }
          el.priv = prev.priv;
          el.privName = prev.privName;
        } else if (!prev && pm && pm.active && PRIVATE_TYPES.has(el.type) && !b.recentlyDeleted.has(el.id)) {
          // Nur wirklich neue Elemente werden privat – nicht per Rückgängig wiederhergestellte
          el.priv = uid;
          el.privName = pm.anonymous ? '' : sender.user.name;
          if (pm.anonymous) {
            el.anon = true;
            delete el.author;
          }
        }
        b.elements.set(el.id, el);
        b.dirty.add(el.id);
        b.deleted.delete(el.id);
        out.push({ op: 'upsert', el });
        if (el.type !== 'comment' && el.type !== 'pen' || !prev) {
          activity.record(b.id, actorFor(el), prev ? 'changed' : 'created', el, ConcealOps.inConcealedArea(el, b.elements) ? { label: '' } : {});
        }
        // Privat-Kennzeichen erhält der Absender per Antwort (keine verspätete Kopie, die neuere Eingaben überschreibt)
        if (el.priv) (reply.marks = reply.marks || []).push({ id: el.id, priv: el.priv, privName: el.privName, anon: !!el.anon });
        break;
      }
      // Tabellen: einzelne Zellen/Formate (tpatch) bzw. Zeilen/Spalten (tstruct) auf den aktuellen Stand anwenden –
      // so gehen gleichzeitige Änderungen verschiedener Personen an verschiedenen Zellen nicht verloren
      case 'tpatch':
      case 'tstruct': {
        if (!validId(op.id)) break;
        const prev = b.elements.get(op.id);
        if (!prev || prev.type !== 'table') break;
        if (prev.priv && String(prev.priv) !== uid) {
          revert(op.id);
          break;
        }
        // Wiederholung nach verlorener Antwort: nicht doppelt ausführen, sondern den gültigen Stand zurückgeben.
        // Sonst träfe sie, wenn inzwischen eine Zeile dazukam, sogar die falsche Stelle.
        if (op.opId && b.tableSeen.has(op.opId)) {
          revert(op.id);
          break;
        }
        const raw = op.op === 'tpatch'
          ? TableOps.applyPatch(prev, { cells: op.cells, styles: op.styles, props: op.props })
          : TableOps.applyStruct(prev, { action: op.action, at: op.at, count: op.count, size: op.size });
        const el = raw && sanitizeElement(raw);
        if (!el) {
          revert(op.id);
          break;
        }
        if (prev.priv) Object.assign(el, { priv: prev.priv, privName: prev.privName });
        if (typeof op.opId === 'string' && op.opId.length <= 64) {
          b.tableSeen.add(op.opId);
          if (b.tableSeen.size > 2000) b.tableSeen.delete(b.tableSeen.values().next().value);
        }
        b.elements.set(el.id, el);
        b.dirty.add(el.id);
        activity.record(b.id, actorFor(el), 'changed', el, hiddenBefore.has(el.id) ? { label: '' } : {});
        if (el.priv) out.push({ op: 'upsert', el }); // private Tabellen nur als (geschwärzte) Gesamtfassung verteilen
        else if (op.op === 'tpatch') {
          // an alle – auch an den Absender, damit alle Änderungen in derselben Reihenfolge ankommen
          all.push({ op: 'tpatch', id: el.id, cells: op.cells, styles: op.styles, props: op.props });
        } else out.push({ op: 'tstruct', id: el.id, action: op.action, at: op.at, count: op.count, size: op.size });
        break;
      }
      case 'privateMode': {
        if (reserved) {
          revertSession({ op: 'privateMode', privateMode: b.session.privateMode || null });
          blocked('reserved');
          break;
        }
        // Aufdecken zeigt die Beiträge aller: Das entscheidet, wer den Modus gestartet hat oder das Board leitet
        if (pm && pm.active && pm.byId !== uid && sender.role !== 'owner' && !fac) {
          revertSession({ op: 'privateMode', privateMode: b.session.privateMode });
          blocked('privateMode');
          break;
        }
        if (op.active) {
          b.session.privateMode = { active: true, by: sender.user.name, byId: uid, startedAt: Date.now(), anonymous: !!op.anonymous };
          all.push({ op: 'privateMode', privateMode: b.session.privateMode });
          // Wechsel auf anonym: Bereits verdeckte Beiträge verlieren ihre Namen ebenfalls
          if (op.anonymous) {
            for (const el of b.elements.values()) {
              if (!el.priv || el.anon) continue;
              el.anon = true;
              el.privName = '';
              delete el.author;
              b.dirty.add(el.id);
              all.push({ op: 'upsert', el });
            }
          }
        } else {
          b.session.privateMode = null;
          b.recentlyDeleted.clear();
          all.push({ op: 'privateMode', privateMode: null });
          // Aufdecken: alle privaten Elemente werden für alle sichtbar
          let revealed = 0;
          for (const el of b.elements.values()) {
            if (!el.priv) continue;
            delete el.priv;
            delete el.privName;
            b.dirty.add(el.id);
            all.push({ op: 'upsert', el });
            revealed++;
          }
          if (revealed) activity.record(b.id, actor, 'revealed', null, { count: revealed, label: '' });
        }
        b.metaDirty = true;
        break;
      }
      case 'estimation': {
        if (reserved) {
          revertSession({ op: 'estimation', estimation: redactEstimation(b.session.estimation || null, uid) });
          blocked('reserved');
          break;
        }
        const cur = b.session.estimation;
        // Verborgene Karten: Teilnehmende kennen sie nicht, der Titel bleibt auch sonst geheim
        if (op.action === 'start' && hiddenBefore.has(op.elId) && !fac) {
          revertSession({ op: 'estimation', estimation: redactEstimation(b.session.estimation || null, uid) });
          blocked('concealed');
          break;
        }
        if (op.action === 'start' && validId(op.elId) && b.elements.has(op.elId)) {
          const card = b.elements.get(op.elId);
          b.session.estimation = {
            // Titel einer privaten Karte nicht verraten
            id: Date.now(), elId: op.elId, title: card.priv || hiddenBefore.has(op.elId) ? '' : String(card.title || '').slice(0, 200), deck: Object.hasOwn(DECKS, op.deck) ? op.deck : 'fib',
            by: sender.user.name, revealed: false, votes: {},
          };
        } else if (cur && op.action === 'reveal') cur.revealed = true;
        else if (cur && op.action === 'reset') b.session.estimation = { ...cur, id: Date.now(), revealed: false, votes: {} };
        else if (op.action === 'close') b.session.estimation = null;
        else break;
        b.metaDirty = true;
        all.push({ op: 'estimation', estimation: b.session.estimation });
        break;
      }
      case 'delete':
        if (validId(op.id)) {
          const prev = b.elements.get(op.id);
          if (prev && prev.priv && String(prev.priv) !== uid) {
            revert(op.id);
            break;
          }
          b.elements.delete(op.id);
          b.deleted.add(op.id);
          b.dirty.delete(op.id);
          // Private Beiträge bleiben beim Rückgängigmachen privat; nur zuvor öffentliche nicht
          if (prev && !prev.priv) b.recentlyDeleted.add(op.id);
          if (prev && prev.anon) {
            if (!b.anonDeleted) b.anonDeleted = new Set();
            b.anonDeleted.add(op.id);
            if (b.anonDeleted.size > 5000) b.anonDeleted.delete(b.anonDeleted.values().next().value);
          }
          if (prev && prev.type === 'comment') {
            if (!b.deletedComments) b.deletedComments = new Map();
            b.deletedComments.set(op.id, prev);
            if (b.deletedComments.size > 500) b.deletedComments.delete(b.deletedComments.keys().next().value);
          }
          if (prev && !prev.priv) activity.record(b.id, actorFor(prev), 'deleted', prev, hiddenBefore.has(prev.id) ? { label: '' } : {});
          if (b.session.voting && b.session.voting.votes) delete b.session.voting.votes[op.id];
          // Schätzrunde zu einer gelöschten Karte beenden
          if (b.session.estimation && b.session.estimation.elId === op.id) {
            b.session.estimation = null;
            all.push({ op: 'estimation', estimation: null });
          }
          out.push({ op: 'delete', id: op.id });
        }
        break;
      case 'rename':
        if (editLocked) {
          revertSession({ op: 'rename', name: b.name });
          blocked('editLock');
          break;
        }
        b.name = String(op.name || '').slice(0, 200) || b.name;
        b.metaDirty = true;
        out.push({ op: 'rename', name: b.name });
        activity.record(b.id, actor, 'renamed', null, { label: b.name });
        break;
      case 'moderation': {
        const cur = b.session.moderation;
        // Starten darf, wer bearbeiten darf; laufend steuern nur Moderierende (und der Besitzer)
        const canSteer = sender.role === 'owner' || (cur && cur.active ? fac : canEdit(sender.role));
        if (!canSteer) {
          revertSession({ op: 'moderation', moderation: cur || null });
          blocked('reserved');
          break;
        }
        // Wer die Moderation startet, sähe verborgene Bereiche – dort darf nur der Besitzer starten
        if (!(cur && cur.active) && sender.role !== 'owner' && [...b.elements.values()].some((e) => e.type === 'frame' && e.concealed)) {
          revertSession({ op: 'moderation', moderation: cur || null });
          blocked('concealed');
          break;
        }
        if (op.active === false) b.session.moderation = null;
        else {
          const next = cur && cur.active
            ? { ...cur, facilitators: [...(cur.facilitators || [])] }
            : { active: true, by: sender.user.name, byId: uid, startedAt: Date.now(), facilitators: [uid], editLock: false, reserveTools: true };
          if (typeof op.editLock === 'boolean') next.editLock = op.editLock;
          if (typeof op.reserveTools === 'boolean') next.reserveTools = op.reserveTools;
          const add = String(op.addFacilitator || ''), rem = String(op.removeFacilitator || '');
          if (/^\d{1,18}$/.test(add) && !next.facilitators.includes(add)) next.facilitators.push(add);
          if (rem) next.facilitators = next.facilitators.filter((x) => x !== rem);
          next.facilitators = next.facilitators.slice(0, 50);
          b.session.moderation = next;
        }
        b.metaDirty = true;
        all.push({ op: 'moderation', moderation: b.session.moderation });
        // Wer verborgene Bereiche sieht, hängt an der Moderation – Teilnehmende laden den passenden Stand neu
        if (hiddenBefore.size) setTimeout(() => kickWhere(b.id, (c) => c.role !== 'owner' && String(c.uid) !== uid, 'moderation'), 300);
        break;
      }
      case 'timer':
        if (reserved) {
          revertSession({ op: 'timer', timer: b.session.timer || null });
          blocked('reserved');
          break;
        }
        b.session.timer = (op.timer && typeof op.timer === 'object' && cleanJson(op.timer)) || null;
        b.metaDirty = true;
        out.push({ op: 'timer', timer: b.session.timer });
        break;
      case 'voting': {
        if (reserved) {
          revertSession({ op: 'voting', voting: b.session.voting || null });
          blocked('reserved');
          break;
        }
        // Stimmen verwaltet der Server selbst; nur bei einer neuen Abstimmung (anderes startedAt) zurücksetzen
        const prev = b.session.voting;
        const nv = (op.voting && typeof op.voting === 'object' && cleanJson(op.voting)) || null;
        if (nv) {
          nv.votesPerUser = Math.max(1, Math.min(50, Number(nv.votesPerUser) || 3));
          nv.votes = prev && prev.startedAt === nv.startedAt && prev.votes ? prev.votes : Object.create(null);
        }
        b.session.voting = nv;
        b.metaDirty = true;
        out.push({ op: 'voting', voting: b.session.voting });
        break;
      }
      default:
        retro.apply(b, op, { sender, uid, fac, canSteer, reserved, all, personal, revertSession, blocked, hidden: hiddenBefore });
    }
  }
  // Änderungen können eine Freigabe entwerten: Alle Beteiligten sollen das bald sehen
  if (out.length && b.hasReviews && !b.reviewTimer) {
    b.reviewTimer = setTimeout(() => {
      b.reviewTimer = null;
      broadcast(b.id, { type: 'reviews' });
    }, 1500);
    b.reviewTimer.unref();
  }
  for (const id of refused) {
    const cur = b.elements.get(id);
    (reply.revert = reply.revert || []).push(cur && (fac || !hiddenBefore.has(id)) ? { op: 'upsert', el: redactEl(cur, uid) } : { op: 'delete', id });
  }
  // Immer eine Nummer: Auch eine Ablehnung (revert) hat ihren Platz in der Reihenfolge
  reply.seq = ++b.opSeq;
  if (out.length || all.length || personal.length) {
    schedule(b);
    // Ein Paket, eine Nummer: Gesamtstände müssen darum den Endstand des Pakets zeigen, auch spätere Tabellenänderungen
    // Tabellenänderungen stecken dann schon darin und dürfen nicht ein zweites Mal ankommen. Zelle und Struktur im selben Paket
    // ebenso: Sie gehen über getrennte Listen und kämen sonst vertauscht an, Zellen landeten in der falschen Zeile.
    const whole = new Set([...out, ...all].filter((o) => o.op === 'upsert').map((o) => o.el.id));
    const struct = new Set(out.filter((o) => o.op === 'tstruct').map((o) => o.id));
    for (const o of all) {
      if (o.op !== 'tpatch' || !struct.has(o.id) || whole.has(o.id) || !b.elements.has(o.id)) continue;
      whole.add(o.id);
      out.push({ op: 'upsert', el: b.elements.get(o.id) });
    }
    const final = (list) => list
      .filter((o) => !((o.op === 'tstruct' || o.op === 'tpatch') && whole.has(o.id)))
      .map((o) => (o.op === 'upsert' && b.elements.has(o.el.id) ? { ...o, el: b.elements.get(o.el.id) } : o));
    broadcastOps(b, final(out), sender.user.clientId, reply.seq);
    broadcastOps(b, final(all), null, reply.seq);
    broadcastOps(b, personal, null, reply.seq);
    // Umfragen sieht auch der Absender nur geschwärzt (eigene Stimme, keine fremden)
    if (personal.length) reply.session = [...(reply.session || []), ...personal.map((o) => redactOp(o, uid))];
  }
  if (before) syncConcealment(b, before);
  return reply;
}

// Stimme in einer Umfrage, Lean-Coffee-Daumen, Reaktion auf ein Element – auch für Betrachter
function applyPollVote(b, op, user) {
  retro.vote(b, op, user, () => {
    schedule(b);
    broadcastOps(b, [{ op: 'poll', poll: b.session.poll }], null);
  });
}

function applyRomanVote(b, op, user) {
  if (!retro.romanVote(b, op, user)) return;
  schedule(b);
  broadcastOps(b, [{ op: 'discussion', discussion: b.session.discussion }], null);
}

function applyReaction(b, op, user, role) {
  if (concealedOf(b).has(op.id) && !isFacilitator(b, user.id, role)) return;
  const el = retro.react(b, op, user);
  if (!el) return;
  schedule(b);
  broadcastOps(b, [{ op: 'upsert', el }], null);
}

// Schätzwert abgeben – auch Betrachter dürfen schätzen; die Benutzer-ID kommt aus der Session
function applyEstimate(b, op, user) {
  const est = b.session.estimation;
  if (!est || est.revealed || b.removed) return;
  const uid = String(user.id);
  const deck = Object.hasOwn(DECKS, est.deck) ? DECKS[est.deck] : DECKS.fib;
  if (op.value === null) delete est.votes[uid];
  else if (deck.includes(String(op.value))) est.votes[uid] = { name: user.display_name || user.username, value: String(op.value) };
  else return;
  b.metaDirty = true;
  schedule(b);
  broadcastOps(b, [{ op: 'estimation', estimation: est }], null);
}

// Stimmen dürfen auch Betrachter abgeben – die Benutzer-ID kommt immer aus der Session
function applyVote(b, op, userId) {
  const v = b.session.voting;
  if (!v || !v.active || !validId(op.elId) || b.removed) return null;
  if (!v.votes || typeof v.votes !== 'object') v.votes = Object.create(null);
  // nur Stimmen für vorhandene Elemente (bei Themen-Abstimmung nur für Themengruppen)
  if (!b.elements.has(op.elId)) return v;
  if (v.target === 'topics') {
    const t = b.elements.get(op.elId);
    if (t.type !== 'frame' || t.kind !== 'topic') return v;
  }
  const uid = String(userId);
  const used = Object.values(v.votes).reduce((s, m) => s + (m[uid] || 0), 0);
  const has = Object.hasOwn(v.votes, op.elId);
  const cur = (has && v.votes[op.elId][uid]) || 0;
  const delta = op.delta > 0 ? 1 : -1;
  if (delta > 0 && used >= v.votesPerUser) return v;
  if (delta < 0 && cur <= 0) return v;
  v.votes[op.elId] = has ? v.votes[op.elId] : {};
  v.votes[op.elId][uid] = cur + delta;
  if (!v.votes[op.elId][uid]) delete v.votes[op.elId][uid];
  if (!Object.keys(v.votes[op.elId]).length) delete v.votes[op.elId];
  b.metaDirty = true;
  schedule(b);
  broadcast(b.id, { type: 'ops', ops: [{ op: 'voting', voting: v }] });
  return v;
}

// sees: darf verborgene Bereiche sehen (Moderierende)
function serialize(b, uid, sees = true) {
  const elements = {};
  const hidden = sees ? null : concealedOf(b);
  for (const [id, el] of b.elements) if (!hidden || !hidden.has(id)) elements[id] = redactEl(el, uid);
  let session = b.session.estimation ? { ...b.session, estimation: redactEstimation(b.session.estimation, uid) } : b.session;
  session = retro.redactSession(session, uid);
  return { id: b.id, name: b.name, createdAt: b.createdAt, updatedAt: b.updatedAt, prevRetroId: b.prevRetroId || null, elements, session };
}

module.exports = {
  validId, newId, saveState, canEdit, canComment, ROLE_RANK, LINK_ROLE, roleFor, maxRole, isFacilitator, toolsReserved, schedule, redactEstimation, access, load, flushBoard, flushAll, forget, create, duplicate, remove, trash, untrash, purgeTrash, rename, setLinkAccess,
  rooms, send, broadcast, broadcastOps, join, leave, client, kickUser, kickSessions, kickWhere, closeRoom, PollChannel, onlineCount, totalOnline, applyOps, applyVote,
  applyPollVote, applyRomanVote, applyReaction, concealedOf, canSeeElement, setElements, expandPatches,
  applyEstimate, serialize, cache, createVersion, restoreVersion, versionData, redactEl, DECKS,
};
