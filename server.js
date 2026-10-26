'use strict';
/*
 * dlzboard – kollaboratives Online-Whiteboard
 * Server ohne externe Abhängigkeiten: statische Dateien, REST-API,
 * Echtzeit-Synchronisation über Server-Sent Events (SSE) + POST.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const BOARD_DIR = path.join(DATA_DIR, 'boards');
const THUMB_DIR = path.join(DATA_DIR, 'thumbs');
const PUBLIC_DIR = path.join(__dirname, 'public');
const MAX_BODY = 40 * 1024 * 1024;

fs.mkdirSync(BOARD_DIR, { recursive: true });
fs.mkdirSync(THUMB_DIR, { recursive: true });

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
};

/* ------------------------------------------------------------------ */
/* Datenhaltung                                                        */
/* ------------------------------------------------------------------ */

const boards = new Map();      // id -> board
const rooms = new Map();       // id -> Map(clientId -> { res, user })
const saveTimers = new Map();

const validId = (id) => typeof id === 'string' && /^[a-zA-Z0-9_-]{1,64}$/.test(id);
const newId = () => crypto.randomBytes(6).toString('base64url');

function emptySession() {
  return { timer: null, voting: null };
}

function loadAll() {
  for (const f of fs.readdirSync(BOARD_DIR)) {
    if (!f.endsWith('.json')) continue;
    try {
      const b = JSON.parse(fs.readFileSync(path.join(BOARD_DIR, f), 'utf8'));
      if (!validId(b.id)) continue;
      b.elements = b.elements || {};
      b.session = b.session || emptySession();
      boards.set(b.id, b);
    } catch (e) {
      console.error('Board konnte nicht geladen werden:', f, e.message);
    }
  }
}

function saveNow(id) {
  const b = boards.get(id);
  saveTimers.delete(id);
  if (!b) return;
  const file = path.join(BOARD_DIR, id + '.json');
  const tmp = file + '.tmp';
  fs.writeFile(tmp, JSON.stringify(b), (err) => {
    if (err) return console.error('Speichern fehlgeschlagen', id, err.message);
    fs.rename(tmp, file, (err2) => err2 && console.error('Umbenennen fehlgeschlagen', err2.message));
  });
}

function scheduleSave(b) {
  b.updatedAt = Date.now();
  if (saveTimers.has(b.id)) return;
  saveTimers.set(b.id, setTimeout(() => saveNow(b.id), 800));
}

function boardMeta(b) {
  return {
    id: b.id,
    name: b.name,
    createdAt: b.createdAt,
    updatedAt: b.updatedAt,
    elementCount: Object.keys(b.elements).length,
    hasThumb: fs.existsSync(path.join(THUMB_DIR, b.id + '.png')),
    online: rooms.has(b.id) ? rooms.get(b.id).size : 0,
  };
}

function createBoard(name, elements) {
  const id = newId();
  const now = Date.now();
  const b = {
    id,
    name: (name || 'Unbenanntes Board').slice(0, 200),
    createdAt: now,
    updatedAt: now,
    elements: {},
    session: emptySession(),
  };
  if (Array.isArray(elements)) {
    for (const el of elements) if (el && validId(el.id)) b.elements[el.id] = el;
  }
  boards.set(id, b);
  scheduleSave(b);
  return b;
}

/* ------------------------------------------------------------------ */
/* Echtzeit                                                            */
/* ------------------------------------------------------------------ */

function send(res, msg) {
  res.write('data: ' + JSON.stringify(msg) + '\n\n');
}

function broadcast(boardId, msg, exceptClientId) {
  const room = rooms.get(boardId);
  if (!room) return;
  for (const [cid, c] of room) if (cid !== exceptClientId) send(c.res, msg);
}

function applyOps(b, ops, clientId) {
  const out = [];
  let reply = {};
  for (const op of ops) {
    if (!op || typeof op !== 'object') continue;
    switch (op.op) {
      case 'upsert':
        if (op.el && validId(op.el.id)) {
          b.elements[op.el.id] = op.el;
          out.push(op);
        }
        break;
      case 'delete':
        if (validId(op.id)) {
          delete b.elements[op.id];
          if (b.session.voting && b.session.voting.votes) delete b.session.voting.votes[op.id];
          out.push(op);
        }
        break;
      case 'rename':
        b.name = String(op.name || '').slice(0, 200) || b.name;
        out.push({ op: 'rename', name: b.name });
        break;
      case 'timer':
        b.session.timer = op.timer || null;
        out.push({ op: 'timer', timer: b.session.timer });
        break;
      case 'voting':
        b.session.voting = op.voting || null;
        out.push({ op: 'voting', voting: b.session.voting });
        break;
      case 'vote': {
        const v = b.session.voting;
        if (!v || !v.active || !validId(op.elId) || typeof op.userId !== 'string') break;
        v.votes = v.votes || {};
        const used = Object.values(v.votes).reduce((s, m) => s + (m[op.userId] || 0), 0);
        const cur = (v.votes[op.elId] && v.votes[op.elId][op.userId]) || 0;
        const delta = op.delta > 0 ? 1 : -1;
        if (delta > 0 && used >= v.votesPerUser) break;
        if (delta < 0 && cur <= 0) break;
        v.votes[op.elId] = v.votes[op.elId] || {};
        v.votes[op.elId][op.userId] = cur + delta;
        if (!v.votes[op.elId][op.userId]) delete v.votes[op.elId][op.userId];
        if (!Object.keys(v.votes[op.elId]).length) delete v.votes[op.elId];
        reply.voting = v;
        out.push({ op: 'voting', voting: v });
        break;
      }
    }
  }
  if (out.length) {
    scheduleSave(b);
    broadcast(b.id, { type: 'ops', ops: out, clientId }, clientId);
  }
  return reply;
}

/* ------------------------------------------------------------------ */
/* HTTP-Helfer                                                         */
/* ------------------------------------------------------------------ */

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(Object.assign(new Error('Anfrage zu groß'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function readJson(req) {
  const txt = await readBody(req);
  if (!txt) return {};
  try {
    return JSON.parse(txt);
  } catch {
    throw Object.assign(new Error('Ungültiges JSON'), { status: 400 });
  }
}

function json(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, { 'Content-Type': MIME['.json'], 'Cache-Control': 'no-store' });
  res.end(body);
}

function serveFile(res, file) {
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Nicht gefunden');
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
      'Content-Length': st.size,
      'Cache-Control': 'no-cache',
    });
    fs.createReadStream(file).pipe(res);
  });
}

function serveStatic(res, urlPath) {
  const rel = path.normalize(decodeURIComponent(urlPath)).replace(/^([/\\])+/, '');
  const file = path.join(PUBLIC_DIR, rel);
  if (!file.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end();
  }
  serveFile(res, file);
}

/* ------------------------------------------------------------------ */
/* Routen                                                              */
/* ------------------------------------------------------------------ */

async function handleApi(req, res, parts, url) {
  // parts: ['api', 'boards', id?, sub?]
  if (parts[1] === 'info' && req.method === 'GET') {
    const addresses = Object.values(os.networkInterfaces()).flat()
      .filter((a) => a && a.family === 'IPv4' && !a.internal).map((a) => a.address);
    return json(res, 200, { name: 'dlzboard', version: require('./package.json').version, addresses });
  }
  if (parts[1] !== 'boards') return json(res, 404, { error: 'Nicht gefunden' });
  const id = parts[2];
  const sub = parts[3];

  if (!id) {
    if (req.method === 'GET') {
      const list = [...boards.values()].map(boardMeta).sort((a, b) => b.updatedAt - a.updatedAt);
      return json(res, 200, list);
    }
    if (req.method === 'POST') {
      const body = await readJson(req);
      const b = createBoard(body.name, body.elements);
      return json(res, 201, boardMeta(b));
    }
    return json(res, 405, { error: 'Methode nicht erlaubt' });
  }

  if (!validId(id)) return json(res, 400, { error: 'Ungültige ID' });
  const b = boards.get(id);
  if (!b) return json(res, 404, { error: 'Board nicht gefunden' });

  if (!sub) {
    if (req.method === 'GET') return json(res, 200, b);
    if (req.method === 'PATCH') {
      const body = await readJson(req);
      if (typeof body.name === 'string') {
        b.name = body.name.slice(0, 200) || b.name;
        broadcast(id, { type: 'ops', ops: [{ op: 'rename', name: b.name }] });
      }
      scheduleSave(b);
      return json(res, 200, boardMeta(b));
    }
    if (req.method === 'DELETE') {
      boards.delete(id);
      broadcast(id, { type: 'deleted' });
      clearTimeout(saveTimers.get(id));
      saveTimers.delete(id);
      fs.rm(path.join(BOARD_DIR, id + '.json'), { force: true }, () => {});
      fs.rm(path.join(THUMB_DIR, id + '.png'), { force: true }, () => {});
      return json(res, 200, { ok: true });
    }
    return json(res, 405, { error: 'Methode nicht erlaubt' });
  }

  if (sub === 'duplicate' && req.method === 'POST') {
    const copy = createBoard(b.name + ' (Kopie)', Object.values(JSON.parse(JSON.stringify(b.elements))));
    const thumb = path.join(THUMB_DIR, id + '.png');
    if (fs.existsSync(thumb)) fs.copyFileSync(thumb, path.join(THUMB_DIR, copy.id + '.png'));
    return json(res, 201, boardMeta(copy));
  }

  if (sub === 'events' && req.method === 'GET') {
    const clientId = url.searchParams.get('client');
    if (!validId(clientId)) return json(res, 400, { error: 'client fehlt' });
    const user = {
      clientId,
      userId: String(url.searchParams.get('user') || '').slice(0, 64),
      name: String(url.searchParams.get('name') || 'Gast').slice(0, 40),
      color: /^#[0-9a-f]{6}$/i.test(url.searchParams.get('color') || '') ? url.searchParams.get('color') : '#4262ff',
      viewOnly: url.searchParams.get('view') === '1',
    };
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.write('retry: 2000\n\n');
    if (!rooms.has(id)) rooms.set(id, new Map());
    const room = rooms.get(id);
    const old = room.get(clientId);
    if (old) old.res.end();
    room.set(clientId, { res, user });
    send(res, {
      type: 'hello',
      serverTime: Date.now(),
      board: b,
      peers: [...room.values()].map((c) => c.user).filter((u) => u.clientId !== clientId),
    });
    broadcast(id, { type: 'join', user }, clientId);
    const ping = setInterval(() => res.write(': ping\n\n'), 20000);
    req.on('close', () => {
      clearInterval(ping);
      const r = rooms.get(id);
      if (r && r.get(clientId) && r.get(clientId).res === res) {
        r.delete(clientId);
        if (!r.size) rooms.delete(id);
        broadcast(id, { type: 'leave', clientId });
      }
    });
    return;
  }

  if (sub === 'ops' && req.method === 'POST') {
    const body = await readJson(req);
    if (!Array.isArray(body.ops)) return json(res, 400, { error: 'ops fehlt' });
    const room = rooms.get(id);
    const client = room && room.get(body.clientId);
    if (client && client.user.viewOnly) return json(res, 403, { error: 'Nur-Lese-Modus' });
    const reply = applyOps(b, body.ops, body.clientId);
    return json(res, 200, { ok: true, ...reply });
  }

  if (sub === 'signal' && req.method === 'POST') {
    const body = await readJson(req);
    broadcast(id, { type: 'signal', from: body.clientId, kind: body.kind, data: body.data }, body.clientId);
    return json(res, 200, { ok: true });
  }

  if (sub === 'thumb') {
    const file = path.join(THUMB_DIR, id + '.png');
    if (req.method === 'GET') return serveFile(res, file);
    if (req.method === 'PUT') {
      const txt = await readBody(req);
      const m = /^data:image\/png;base64,(.+)$/.exec(txt);
      if (!m) return json(res, 400, { error: 'PNG-Data-URL erwartet' });
      fs.writeFile(file, Buffer.from(m[1], 'base64'), () => {});
      return json(res, 200, { ok: true });
    }
  }

  return json(res, 404, { error: 'Nicht gefunden' });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts[0] === 'api') return await handleApi(req, res, parts, url);
    if (url.pathname === '/' || url.pathname === '/index.html') return serveFile(res, path.join(PUBLIC_DIR, 'index.html'));
    if (parts[0] === 'board' && parts.length === 2) return serveFile(res, path.join(PUBLIC_DIR, 'board.html'));
    return serveStatic(res, url.pathname);
  } catch (e) {
    console.error(e);
    if (!res.headersSent) json(res, e.status || 500, { error: e.message || 'Serverfehler' });
    else res.end();
  }
});

loadAll();
server.listen(PORT, HOST, () => {
  console.log(`dlzboard läuft auf http://localhost:${PORT}  (${boards.size} Boards geladen)`);
});

function shutdown() {
  for (const [id, t] of saveTimers) {
    clearTimeout(t);
    const b = boards.get(id);
    if (b) fs.writeFileSync(path.join(BOARD_DIR, id + '.json'), JSON.stringify(b));
  }
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
