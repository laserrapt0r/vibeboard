'use strict';
// Boards, Mitglieder und Echtzeit-Kanal
const db = require('../db');
const auth = require('../auth');
const boards = require('../boards');
const settings = require('../settings');
const mail = require('../mail');
const uploads = require('../uploads');
const { VERSION } = require('../version');
const { baseUrl } = require('./auth');
const { HttpError, readJson, readBody, json } = require('../http');

const MAX_THUMB = 2 * 1024 * 1024;

async function requireRole(req, id, min) {
  const user = await auth.requireUser(req);
  const { board, role } = await boards.access(id, user);
  if (!board) throw new HttpError(404, 'Board nicht gefunden.');
  const rank = { viewer: 1, editor: 2, owner: 3 };
  if (!role) throw new HttpError(403, 'Du hast keinen Zugriff auf dieses Board.');
  if (rank[role] < rank[min]) throw new HttpError(403, min === 'owner' ? 'Nur der Besitzer kann das ändern.' : 'Du darfst dieses Board nur ansehen.');
  return { user, board, role };
}

// Live-Werte aus dem Cache bevorzugen (noch nicht gespeicherte Änderungen)
function liveMeta(row) {
  const c = boards.cache.get(row.id);
  return {
    id: row.id,
    name: c ? c.name : row.name,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(c ? c.updatedAt : row.updated_at).getTime(),
    elementCount: c ? c.elements.size : Number(row.element_count),
    hasThumb: row.has_thumb,
    online: boards.onlineCount(row.id),
    linkAccess: row.link_access,
    role: row.role,
    owner: row.owner_name ? { username: row.owner_name, displayName: row.owner_display || row.owner_name } : null,
    memberCount: Number(row.member_count || 0),
    member: !!row.is_member,
  };
}

const LIST_COLUMNS = `b.id, b.name, b.created_at, b.updated_at, b.link_access, (b.thumbnail IS NOT NULL) AS has_thumb,
  (SELECT count(*) FROM elements e WHERE e.board_id = b.id) AS element_count,
  (SELECT count(*) FROM board_members bm WHERE bm.board_id = b.id) AS member_count,
  o.username AS owner_name, o.display_name AS owner_display`;

function register(r) {
  r.route('GET', '/api/boards', async (req, res) => {
    const u = await auth.requireUser(req);
    const owned = (await db.query(`SELECT ${LIST_COLUMNS}, 'owner' AS role FROM boards b LEFT JOIN users o ON o.id = b.owner_id WHERE b.owner_id = $1`, [u.id])).rows;
    const shared = (await db.query(
      `SELECT ${LIST_COLUMNS},
              COALESCE(m.role, CASE b.link_access WHEN 'edit' THEN 'editor' ELSE 'viewer' END) AS role,
              (m.user_id IS NOT NULL) AS is_member
         FROM boards b
         LEFT JOIN users o ON o.id = b.owner_id
         LEFT JOIN board_members m ON m.board_id = b.id AND m.user_id = $1
         LEFT JOIN board_visits v ON v.board_id = b.id AND v.user_id = $1
        WHERE b.owner_id IS DISTINCT FROM $1
          AND (m.user_id IS NOT NULL OR (v.user_id IS NOT NULL AND b.link_access <> 'private'))`, [u.id])).rows;
    json(res, 200, { owned: owned.map(liveMeta), shared: shared.map(liveMeta) });
  });

  r.route('POST', '/api/boards', async (req, res) => {
    const u = await auth.requireUser(req);
    const body = await readJson(req);
    const elements = Array.isArray(body.elements) ? body.elements : [];
    // Bilder aus Importen ebenfalls prüfen; abgelehnte werden nicht übernommen
    const rejected = await uploads.checkElements(elements, { req, userId: u.id, kind: 'Import' });
    const bad = new Set(rejected.map((r) => r.id));
    const id = await boards.create({ name: body.name, ownerId: u.id, elements: elements.filter((e) => !e || !bad.has(e.id)) });
    json(res, 201, { id, rejected });
  });

  r.route('GET', '/api/boards/:id', async (req, res, { params }) => {
    const { board, role } = await requireRole(req, params.id, 'viewer');
    const owner = board.owner_id ? await db.one('SELECT username, display_name FROM users WHERE id = $1', [board.owner_id]) : null;
    json(res, 200, {
      id: board.id, name: board.name, role, linkAccess: board.link_access,
      owner: owner ? { username: owner.username, displayName: owner.display_name || owner.username } : null,
    });
  });

  r.route('PATCH', '/api/boards/:id', async (req, res, { params }) => {
    const body = await readJson(req);
    const needOwner = body.linkAccess !== undefined;
    const { board } = await requireRole(req, params.id, needOwner ? 'owner' : 'editor');
    if (needOwner && !['private', 'view', 'edit'].includes(body.linkAccess)) throw new HttpError(400, 'Ungültige Freigabe.');
    if (typeof body.name === 'string') await boards.rename(board.id, body.name);
    if (needOwner) {
      await db.query('UPDATE boards SET link_access = $2 WHERE id = $1', [board.id, body.linkAccess]);
      boards.setLinkAccess(board.id, body.linkAccess);
      // Verbundene Nutzer mit Link-Zugriff neu verbinden lassen
      const room = boards.rooms.get(board.id);
      if (room) {
        const members = new Set((await db.query('SELECT user_id FROM board_members WHERE board_id = $1', [board.id])).rows.map((x) => String(x.user_id)));
        for (const c of [...room.values()]) if (c.role !== 'owner' && !members.has(String(c.uid))) boards.kickUser(board.id, c.uid);
      }
    }
    json(res, 200, { ok: true });
  });

  r.route('DELETE', '/api/boards/:id', async (req, res, { params }) => {
    await requireRole(req, params.id, 'owner');
    await boards.remove(params.id);
    json(res, 200, { ok: true });
  });

  r.route('POST', '/api/boards/:id/duplicate', async (req, res, { params }) => {
    const { user } = await requireRole(req, params.id, 'viewer');
    const id = await boards.duplicate(params.id, user.id);
    json(res, 201, { id });
  });

  /* ---------------- Mitglieder ---------------- */

  r.route('GET', '/api/boards/:id/members', async (req, res, { params }) => {
    const { board, role } = await requireRole(req, params.id, 'viewer');
    const owner = board.owner_id ? await db.one('SELECT * FROM users WHERE id = $1', [board.owner_id]) : null;
    const members = (await db.query(
      `SELECT u.*, m.role AS member_role FROM board_members m JOIN users u ON u.id = m.user_id
        WHERE m.board_id = $1 ORDER BY u.username`, [board.id])).rows;
    const pub = (u) => ({ id: String(u.id), username: u.username, displayName: u.display_name || u.username, color: u.color });
    json(res, 200, {
      myRole: role,
      linkAccess: board.link_access,
      owner: owner ? pub(owner) : null,
      members: members.map((m) => ({ ...pub(m), role: m.member_role })),
    });
  });

  r.route('POST', '/api/boards/:id/members', async (req, res, { params }) => {
    const { board, user } = await requireRole(req, params.id, 'owner');
    const body = await readJson(req);
    const role = body.role === 'viewer' ? 'viewer' : 'editor';
    const target = await db.one(`SELECT * FROM users WHERE (lower(username) = lower($1) OR lower(email) = lower($1)) AND status = 'active'`, [String(body.user || '').trim()]);
    if (!target) throw new HttpError(404, 'Benutzer nicht gefunden.');
    if (String(target.id) === String(board.owner_id)) throw new HttpError(400, 'Das ist bereits der Besitzer des Boards.');
    await db.query(
      `INSERT INTO board_members (board_id, user_id, role) VALUES ($1, $2, $3)
       ON CONFLICT (board_id, user_id) DO UPDATE SET role = EXCLUDED.role`, [board.id, target.id, role]);
    boards.kickUser(board.id, target.id);
    let mailed = false;
    const base = await baseUrl(req).catch(() => null);
    if (body.notify !== false && target.email && base && (await settings.mailConfigured())) {
      const url = `${base}/board/${board.id}`;
      mail.sendQuietly(target.email, `Einladung zu „${board.name}“`, 'Du wurdest zu einem Board eingeladen',
        [`${user.display_name || user.username} hat dich zum Board „${board.name}“ eingeladen (${role === 'editor' ? 'darf bearbeiten' : 'darf ansehen'}).`],
        { label: 'Board öffnen', url });
      mailed = true;
    }
    json(res, 200, { ok: true, mailed });
  });

  r.route('PATCH', '/api/boards/:id/members/:uid', async (req, res, { params }) => {
    if (!/^\d+$/.test(params.uid)) throw new HttpError(404, 'Benutzer nicht gefunden.');
    const { board } = await requireRole(req, params.id, 'owner');
    const body = await readJson(req);
    const role = body.role === 'viewer' ? 'viewer' : 'editor';
    await db.query('UPDATE board_members SET role = $3 WHERE board_id = $1 AND user_id = $2', [board.id, params.uid, role]);
    boards.kickUser(board.id, params.uid);
    json(res, 200, { ok: true });
  });

  r.route('DELETE', '/api/boards/:id/members/:uid', async (req, res, { params }) => {
    if (!/^\d+$/.test(params.uid)) throw new HttpError(404, 'Benutzer nicht gefunden.');
    const user = await auth.requireUser(req);
    // Mitglieder dürfen sich selbst entfernen, sonst nur der Besitzer
    if (String(user.id) !== String(params.uid)) await requireRole(req, params.id, 'owner');
    await db.query('DELETE FROM board_members WHERE board_id = $1 AND user_id = $2', [params.id, params.uid]);
    await db.query('DELETE FROM board_visits WHERE board_id = $1 AND user_id = $2', [params.id, params.uid]);
    boards.kickUser(params.id, params.uid);
    json(res, 200, { ok: true });
  });

  /* ---------------- Vorschaubild ---------------- */

  r.route('GET', '/api/boards/:id/thumb', async (req, res, { params }) => {
    await requireRole(req, params.id, 'viewer');
    const row = await db.one('SELECT thumbnail FROM boards WHERE id = $1', [params.id]);
    if (!row || !row.thumbnail) throw new HttpError(404, 'Kein Vorschaubild');
    res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'private, max-age=60' });
    res.end(row.thumbnail);
  });

  r.route('PUT', '/api/boards/:id/thumb', async (req, res, { params }) => {
    await requireRole(req, params.id, 'editor');
    const txt = await readBody(req, MAX_THUMB * 1.4);
    const m = /^data:image\/png;base64,(.+)$/.exec(txt);
    if (!m) throw new HttpError(400, 'PNG-Data-URL erwartet');
    const reason = await uploads.checkDataUrl(txt, { req, kind: 'Vorschaubild' });
    if (reason) throw new HttpError(422, reason, 'upload_rejected');
    await db.query('UPDATE boards SET thumbnail = $2 WHERE id = $1', [params.id, Buffer.from(m[1], 'base64')]);
    json(res, 200, { ok: true });
  });

  /* ---------------- Echtzeit ---------------- */

  r.route('GET', '/api/boards/:id/events', async (req, res, { params, url }) => {
    // Abbruch durch den Client schon während der Datenbankabfragen erkennen
    let closed = false;
    res.on('close', () => (closed = true));
    const { user, role } = await requireRole(req, params.id, 'viewer');
    const clientId = url.searchParams.get('client');
    if (!boards.validId(clientId)) throw new HttpError(400, 'client fehlt');
    const b = await boards.load(params.id);
    if (!b) throw new HttpError(404, 'Board nicht gefunden.');
    const existing = boards.client(b.id, clientId);
    if (existing && existing.uid !== String(user.id)) throw new HttpError(409, 'Verbindungskennung bereits vergeben.');
    if (closed) return;
    const info = {
      clientId,
      userId: String(user.id),
      name: user.display_name || user.username,
      color: user.color,
      viewOnly: !boards.canEdit(role),
    };
    const visit = () => db.query(`INSERT INTO board_visits (board_id, user_id) VALUES ($1, $2)
              ON CONFLICT (board_id, user_id) DO UPDATE SET visited_at = now()`, [b.id, user.id]).catch(() => {});

    // Rückfall-Transport: Long-Polling (falls Server-Sent Events blockiert werden)
    if (url.searchParams.get('transport') === 'poll') {
      const ch = new boards.PollChannel();
      const peers = boards.join(b.id, clientId, { res: ch, user: info, role, uid: String(user.id), sid: req._sid });
      if (!peers) throw new HttpError(409, 'Verbindungskennung bereits vergeben.');
      ch.onClose(() => {
        if (boards.leave(b.id, clientId, ch)) boards.broadcast(b.id, { type: 'leave', clientId });
      });
      boards.broadcast(b.id, { type: 'join', user: info }, clientId);
      visit();
      return json(res, 200, { messages: [{ type: 'hello', serverTime: Date.now(), version: VERSION, role, me: info, board: boards.serialize(b), peers, transport: 'poll' }] });
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.write('retry: 2000\n\n');
    const peers = boards.join(b.id, clientId, { res, user: info, role, uid: String(user.id), sid: req._sid });
    if (!peers) return res.end();
    boards.send(res, { type: 'hello', serverTime: Date.now(), version: VERSION, role, me: info, board: boards.serialize(b), peers });
    boards.broadcast(b.id, { type: 'join', user: info }, clientId);
    visit();
    const ping = setInterval(() => res.write(': ping\n\n'), 20000);
    res.on('close', () => {
      clearInterval(ping);
      if (boards.leave(b.id, clientId, res)) boards.broadcast(b.id, { type: 'leave', clientId });
    });
  });

  // Nachrichten abholen (Long-Polling): antwortet sofort, wenn etwas vorliegt, sonst nach spätestens 25 s
  r.route('GET', '/api/boards/:id/poll', async (req, res, { params, url }) => {
    const user = await auth.requireUser(req);
    const c = boards.client(params.id, url.searchParams.get('client'));
    if (!c || !c.res.poll || c.uid !== String(user.id) || c.res.ended) throw new HttpError(410, 'Verbindung beendet – bitte neu verbinden.');
    const ch = c.res;
    ch.lastPoll = Date.now();
    if (!ch.queue.length) {
      ch.wake(); // eine evtl. noch wartende ältere Abfrage freigeben
      await new Promise((resolve) => {
        const t = setTimeout(resolve, 25000);
        ch.waiter = () => {
          clearTimeout(t);
          resolve();
        };
        res.on('close', () => {
          if (ch.waiter) ch.wake();
        });
      });
    }
    ch.lastPoll = Date.now();
    if (res.destroyed) return;
    json(res, 200, { messages: ch.take() });
  });

  r.route('POST', '/api/boards/:id/ops', async (req, res, { params }) => {
    const user = await auth.requireUser(req);
    const body = await readJson(req);
    if (!Array.isArray(body.ops)) throw new HttpError(400, 'ops fehlt');
    const client = boards.client(params.id, body.clientId);
    // Operationen nur von einer aktiven Verbindung desselben Benutzers
    if (!client || client.uid !== String(user.id)) throw new HttpError(409, 'Keine aktive Verbindung zum Board.');
    const b = await boards.load(params.id);
    if (!b) throw new HttpError(404, 'Board nicht gefunden.');
    const votes = body.ops.filter((o) => o && o.op === 'vote');
    let rest = body.ops.filter((o) => o && o.op !== 'vote');
    const reply = {};
    // Hochgeladene Bilder vor dem Übernehmen prüfen (Dateityp + Virenscan)
    if (boards.canEdit(client.role)) {
      const rejected = await uploads.checkElements(rest.filter((o) => o.op === 'upsert').map((o) => o.el), { req, userId: user.id });
      if (rejected.length) {
        const bad = new Set(rejected.map((x) => x.id));
        rest = rest.filter((o) => !(o.op === 'upsert' && o.el && bad.has(o.el.id)));
        reply.rejected = rejected;
      }
    }
    if (rest.length) {
      if (!boards.canEdit(client.role)) throw new HttpError(403, 'Du darfst dieses Board nur ansehen.');
      boards.applyOps(b, rest, client);
    }
    for (const v of votes) {
      const res = boards.applyVote(b, v, user.id);
      if (res) reply.voting = res;
    }
    json(res, 200, { ok: true, ...reply });
  });

  r.route('POST', '/api/boards/:id/signal', async (req, res, { params }) => {
    const user = await auth.requireUser(req);
    const body = await readJson(req);
    const client = boards.client(params.id, body.clientId);
    if (!client || client.uid !== String(user.id)) throw new HttpError(409, 'Keine aktive Verbindung zum Board.');
    boards.broadcast(params.id, { type: 'signal', from: body.clientId, kind: String(body.kind || ''), data: body.data }, body.clientId);
    json(res, 200, { ok: true });
  });
}

module.exports = { register };
