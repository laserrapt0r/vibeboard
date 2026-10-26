'use strict';
// Boards: Zugriffsrechte, Arbeitsspeicher-Cache, Persistenz und Echtzeit-Räume
const crypto = require('crypto');
const db = require('./db');

const validId = (id) => typeof id === 'string' && /^[a-zA-Z0-9_-]{1,64}$/.test(id);
const newId = () => crypto.randomBytes(6).toString('base64url');

const ROLE_RANK = { viewer: 1, editor: 2, owner: 3 };
const canEdit = (role) => ROLE_RANK[role] >= 2;

/* ================================================================== */
/* Zugriff                                                             */
/* ================================================================== */

// Rolle eines Benutzers für ein Board: owner | editor | viewer | null
async function access(boardId, user) {
  if (!validId(boardId) || !user) return { board: null, role: null };
  const b = await db.one(
    `SELECT b.id, b.name, b.owner_id, b.link_access, m.role AS member_role
       FROM boards b LEFT JOIN board_members m ON m.board_id = b.id AND m.user_id = $2
      WHERE b.id = $1`, [boardId, user.id]);
  if (!b) return { board: null, role: null };
  let role = null;
  if (user.role === 'admin' || String(b.owner_id) === String(user.id)) role = 'owner';
  else if (b.member_role) role = b.member_role;
  else if (b.link_access === 'edit') role = 'editor';
  else if (b.link_access === 'view') role = 'viewer';
  return { board: b, role };
}

/* ================================================================== */
/* Cache & Persistenz                                                  */
/* ================================================================== */

const cache = new Map();   // id -> Board im Speicher
const loading = new Map(); // id -> Promise

async function load(id) {
  if (cache.has(id)) return cache.get(id);
  if (loading.has(id)) return loading.get(id);
  const p = (async () => {
    const row = await db.one('SELECT id, name, owner_id, link_access, session, created_at, updated_at FROM boards WHERE id = $1', [id]);
    if (!row) return null;
    const els = (await db.query('SELECT data FROM elements WHERE board_id = $1', [id])).rows;
    const b = {
      id: row.id,
      name: row.name,
      ownerId: row.owner_id,
      linkAccess: row.link_access,
      session: { timer: null, voting: null, ...(row.session || {}) },
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      elements: new Map(els.map((r) => [r.data.id, r.data])),
      dirty: new Set(),
      deleted: new Set(),
      metaDirty: false,
      timer: null,
      flushing: false,
      lastActive: Date.now(),
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
  b.updatedAt = new Date();
  b.lastActive = Date.now();
  if (!b.timer) b.timer = setTimeout(() => flush(b), 1000);
}

async function flush(b) {
  b.timer = null;
  if (b.flushing) return schedule(b);
  const dirty = [...b.dirty];
  const deleted = [...b.deleted];
  const meta = b.metaDirty;
  b.dirty.clear();
  b.deleted.clear();
  b.metaDirty = false;
  if (!dirty.length && !deleted.length && !meta) return;
  b.flushing = true;
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
  } catch (e) {
    console.error('Board konnte nicht gespeichert werden', b.id, e.message);
    // erneut versuchen
    for (const id of dirty) if (b.elements.has(id) && !b.deleted.has(id)) b.dirty.add(id);
    for (const id of deleted) if (!b.elements.has(id)) b.deleted.add(id);
    b.metaDirty = true;
    setTimeout(() => schedule(b), 3000);
  } finally {
    b.flushing = false;
  }
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

async function create({ name, ownerId, elements = [] }) {
  const id = newId();
  await db.tx(async (c) => {
    await c.query('INSERT INTO boards (id, name, owner_id) VALUES ($1, $2, $3)', [id, String(name || 'Unbenanntes Board').slice(0, 200), ownerId]);
    const list = (Array.isArray(elements) ? elements : []).filter((e) => e && validId(e.id));
    if (list.length) {
      await c.query(
        `INSERT INTO elements (board_id, id, data)
         SELECT $1, e->>'id', e FROM jsonb_array_elements($2::jsonb) e ON CONFLICT DO NOTHING`, [id, JSON.stringify(list)]);
    }
  });
  return id;
}

async function duplicate(srcId, ownerId) {
  await flushBoard(srcId);
  const id = newId();
  await db.tx(async (c) => {
    await c.query(`INSERT INTO boards (id, name, owner_id, thumbnail) SELECT $2, name || ' (Kopie)', $3, thumbnail FROM boards WHERE id = $1`, [srcId, id, ownerId]);
    await c.query('INSERT INTO elements (board_id, id, data) SELECT $2, id, data FROM elements WHERE board_id = $1', [srcId, id]);
  });
  return id;
}

async function remove(id) {
  broadcast(id, { type: 'deleted' });
  closeRoom(id);
  forget(id);
  await db.query('DELETE FROM boards WHERE id = $1', [id]);
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
  res.write('data: ' + JSON.stringify(msg) + '\n\n');
}

function broadcast(boardId, msg, exceptClientId) {
  const room = rooms.get(boardId);
  if (!room) return;
  for (const [cid, c] of room) if (cid !== exceptClientId) send(c.res, msg);
}

function join(boardId, clientId, client) {
  if (!rooms.has(boardId)) rooms.set(boardId, new Map());
  const room = rooms.get(boardId);
  const old = room.get(clientId);
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

// Verbindungen eines Benutzers schließen, z. B. nach geänderten Rechten (Client lädt neu)
function kickUser(boardId, userId, reason = 'access') {
  const list = boardId ? [[boardId, rooms.get(boardId)]] : [...rooms];
  for (const [bid, room] of list) {
    if (!room) continue;
    for (const [cid, c] of room) {
      if (String(c.uid) !== String(userId)) continue;
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

const onlineCount = (boardId) => rooms.get(boardId)?.size || 0;
const totalOnline = () => [...rooms.values()].reduce((s, r) => s + r.size, 0);

function applyOps(b, ops, sender) {
  const out = [];
  const reply = {};
  for (const op of ops) {
    if (!op || typeof op !== 'object') continue;
    switch (op.op) {
      case 'upsert':
        if (op.el && validId(op.el.id)) {
          b.elements.set(op.el.id, op.el);
          b.dirty.add(op.el.id);
          b.deleted.delete(op.el.id);
          out.push(op);
        }
        break;
      case 'delete':
        if (validId(op.id)) {
          b.elements.delete(op.id);
          b.deleted.add(op.id);
          b.dirty.delete(op.id);
          if (b.session.voting && b.session.voting.votes) delete b.session.voting.votes[op.id];
          out.push(op);
        }
        break;
      case 'rename':
        b.name = String(op.name || '').slice(0, 200) || b.name;
        b.metaDirty = true;
        out.push({ op: 'rename', name: b.name });
        break;
      case 'timer':
        b.session.timer = op.timer || null;
        b.metaDirty = true;
        out.push({ op: 'timer', timer: b.session.timer });
        break;
      case 'voting':
        b.session.voting = op.voting || null;
        b.metaDirty = true;
        out.push({ op: 'voting', voting: b.session.voting });
        break;
    }
  }
  if (out.length) {
    schedule(b);
    broadcast(b.id, { type: 'ops', ops: out, clientId: sender.user.clientId }, sender.user.clientId);
  }
  return reply;
}

// Stimmen dürfen auch Betrachter abgeben – die Benutzer-ID kommt immer aus der Session
function applyVote(b, op, userId) {
  const v = b.session.voting;
  if (!v || !v.active || !validId(op.elId)) return null;
  v.votes = v.votes || {};
  const uid = String(userId);
  const used = Object.values(v.votes).reduce((s, m) => s + (m[uid] || 0), 0);
  const cur = (v.votes[op.elId] && v.votes[op.elId][uid]) || 0;
  const delta = op.delta > 0 ? 1 : -1;
  if (delta > 0 && used >= v.votesPerUser) return v;
  if (delta < 0 && cur <= 0) return v;
  v.votes[op.elId] = v.votes[op.elId] || {};
  v.votes[op.elId][uid] = cur + delta;
  if (!v.votes[op.elId][uid]) delete v.votes[op.elId][uid];
  if (!Object.keys(v.votes[op.elId]).length) delete v.votes[op.elId];
  b.metaDirty = true;
  schedule(b);
  broadcast(b.id, { type: 'ops', ops: [{ op: 'voting', voting: v }] });
  return v;
}

function serialize(b) {
  return {
    id: b.id,
    name: b.name,
    createdAt: b.createdAt,
    updatedAt: b.updatedAt,
    elements: Object.fromEntries(b.elements),
    session: b.session,
  };
}

module.exports = {
  validId, newId, canEdit, access, load, flushBoard, flushAll, forget, create, duplicate, remove, rename, setLinkAccess,
  rooms, send, broadcast, join, leave, client, kickUser, closeRoom, onlineCount, totalOnline, applyOps, applyVote, serialize, cache,
};
