'use strict';
const log = require('./log').child('reviews');
// Freigaben: Frames und Dateien werden Prüfenden vorgelegt. Eine Freigabe gilt nur für den Stand, der geprüft wurde.
const crypto = require('crypto');
const db = require('./db');
const boards = require('./boards');
const notify = require('./notify');
const audit = require('./audit');

const MAX_PEOPLE = 30;
const MAX_NOTE = 2000;

function fail(message, status = 400) {
  return Object.assign(new Error(message), { status });
}

const inside = (f, e) => {
  const cx = (e.x || 0) + (e.w || 0) / 2, cy = (e.y || 0) + (e.h || 0) / 2;
  return cx >= f.x && cx <= f.x + f.w && cy >= f.y && cy <= f.y + f.h;
};

// Felder ohne Bedeutung für den Inhalt
const VOLATILE = new Set(['z', 'reactions', 'author', 'locked', 'modLock', 'groupId', 'votes', 'ext']);
// Schlüssel sortiert: Nach dem Laden aus der Datenbank kann die Reihenfolge eine andere sein
const canon = (v) => (Array.isArray(v) ? v.map(canon) : v && typeof v === 'object'
  ? Object.fromEntries(Object.keys(v).sort().filter((k) => !VOLATILE.has(k)).map((k) => [k, canon(v[k])])) : v);

// Fingerabdruck des Inhalts: Position relativ zum Frame, damit Verschieben des Frames nichts ändert.
// Kommentare gehören nicht dazu – sie sind gerade der Weg, Rückmeldung zu geben.
function contentHash(b, el) {
  const parts = [];
  // Rechenungenauigkeiten beim Ziehen dürfen eine Position nicht über die Rundungsgrenze heben
  const rel = (v, o) => Math.round((v || 0) - o + 1e-6);
  const point = (p) => ({ x: rel(p.x, el.x), y: rel(p.y, el.y) });
  if (el.type === 'frame') {
    const ids = new Set();
    for (const e of b.elements.values()) {
      if (e.id === el.id || e.type === 'comment' || e.type === 'connector' || !inside(el, e)) continue;
      ids.add(e.id);
      parts.push({ ...e, ...point(e) });
    }
    const holds = (end) => (end && end.id ? ids.has(end.id) : !!end && end.x >= el.x && end.x <= el.x + el.w && end.y >= el.y && end.y <= el.y + el.h);
    for (const e of b.elements.values()) {
      if (e.type !== 'connector' || !holds(e.from) || !holds(e.to)) continue;
      const end = (p) => (p.id ? { id: p.id, ax: p.ax, ay: p.ay, side: p.side } : point(p));
      parts.push({ ...e, from: end(e.from), to: end(e.to), waypoints: (e.waypoints || []).map(point) });
    }
    parts.sort((a, c) => String(a.id).localeCompare(String(c.id)));
    parts.unshift({ title: el.title, w: Math.round(el.w), h: Math.round(el.h), lanes: el.lanes });
  } else parts.push({ fileId: el.fileId, name: el.name });
  return crypto.createHash('sha256').update(JSON.stringify(canon(parts))).digest('hex');
}

function statusOf(people, current) {
  if (people.some((p) => p.decision === 'rejected')) return 'rejected';
  if (!people.length || people.some((p) => !p.decision)) return 'open';
  return people.every((p) => p.hash === current) ? 'approved' : 'outdated';
}

async function list(boardId, user, role) {
  const b = await boards.load(boardId);
  const rows = (await db.query(
    `SELECT r.*, COALESCE(u.display_name, u.username) AS by_name FROM reviews r LEFT JOIN users u ON u.id = r.created_by
      WHERE r.board_id = $1 ORDER BY r.created_at DESC`, [boardId])).rows;
  if (b) b.hasReviews = rows.length > 0;
  if (!rows.length) return [];
  const people = (await db.query(
    `SELECT p.*, COALESCE(u.display_name, u.username) AS name, u.color FROM review_people p JOIN users u ON u.id = p.user_id
      WHERE p.review_id = ANY($1::bigint[]) ORDER BY p.decided_at NULLS LAST, name`, [rows.map((r) => r.id)])).rows;
  return rows.filter((r) => {
    const el = b && b.elements.get(r.element_id);
    return !el || boards.canSeeElement(b, el, user.id, role);
  }).map((r) => {
    const el = b && b.elements.get(r.element_id);
    const hash = el ? contentHash(b, el) : null;
    const who = people.filter((p) => String(p.review_id) === String(r.id)).map((p) => ({
      id: String(p.user_id), name: p.name, color: p.color, decision: p.decision, comment: p.comment,
      decidedAt: p.decided_at ? new Date(p.decided_at).getTime() : null, hash: p.content_hash,
    }));
    const status = el ? statusOf(who, hash) : 'missing';
    return {
      id: String(r.id), elementId: r.element_id, title: el ? (el.title || el.name || '') : '', note: r.note, due: r.due || '', by: r.by_name || '', byId: r.created_by ? String(r.created_by) : null,
      createdAt: new Date(r.created_at).getTime(), status, people: who.map(({ hash: _h, ...p }) => ({ ...p, outdated: !!p.decision && _h !== hash })),
    };
  });
}

const changed = (boardId) => boards.broadcast(boardId, { type: 'reviews' });

async function create(board, user, role, body, origin, req) {
  const b = await boards.load(board.id);
  const el = b && typeof body.elementId === 'string' ? b.elements.get(body.elementId) : null;
  if (!el || !['frame', 'file'].includes(el.type) || !boards.canSeeElement(b, el, user.id, role)) throw fail('Zur Freigabe lassen sich Frames und Dateien vorlegen.');
  if (el.type === 'frame' && el.concealed) throw fail('Verborgene Bereiche lassen sich nicht vorlegen.');
  const ids = [...new Set((Array.isArray(body.reviewers) ? body.reviewers : []).map(String))].slice(0, MAX_PEOPLE);
  if (!ids.length) throw fail('Bitte wähle mindestens eine prüfende Person aus.');
  const known = new Set((await notify.boardPeople(board.id)).filter((p) => !p.guest).map((p) => p.id));
  if (!ids.every((id) => known.has(id))) throw fail('Geprüft werden kann nur von Personen mit Zugriff auf das Board.');
  // Entscheiden braucht mindestens das Recht zu kommentieren
  const users = (await db.query('SELECT * FROM users WHERE id = ANY($1::bigint[])', [ids])).rows;
  for (const u of users) {
    const { role: r } = await boards.access(board.id, u);
    if (!r || boards.ROLE_RANK[r] < boards.ROLE_RANK.commenter) throw fail('Prüfende brauchen mindestens das Recht zu kommentieren.');
    if (!boards.canSeeElement(b, el, u.id, r)) throw fail('Geprüft werden kann nur von Personen mit Zugriff auf das Board.');
  }
  const due = /^\d{4}-\d{2}-\d{2}$/.test(body.due || '') ? body.due : '';
  const note = String(body.note || '').trim().slice(0, MAX_NOTE);
  await db.tx(async (c) => {
    const old = (await c.query('SELECT id FROM reviews WHERE board_id = $1 AND element_id = $2', [board.id, el.id])).rows[0];
    if (old) throw fail('Für dieses Element läuft bereits eine Freigabe.', 409);
    const r = (await c.query(`INSERT INTO reviews (board_id, element_id, note, due, created_by) VALUES ($1, $2, $3, $4, $5) RETURNING id`, [board.id, el.id, note, due, user.id])).rows[0];
    for (const id of ids) await c.query('INSERT INTO review_people (review_id, user_id) VALUES ($1, $2)', [r.id, id]);
  });
  b.hasReviews = true;
  audit.log(req, 'review_requested', { userId: user.id, details: { board: board.id, element: el.id } });
  notify.create({ boardId: board.id, boardName: b.name, kind: 'review', actor: user, elementId: el.id, excerpt: el.title || el.name || '', userIds: ids, origin })
    .catch((e) => log.error('Benachrichtigung fehlgeschlagen', { err: e }));
  changed(board.id);
}

async function load(boardId, id) {
  if (!/^\d{1,18}$/.test(String(id))) throw fail('Freigabe nicht gefunden.', 404);
  const r = await db.one('SELECT * FROM reviews WHERE id = $1 AND board_id = $2', [id, boardId]);
  if (!r) throw fail('Freigabe nicht gefunden.', 404);
  return r;
}

async function decide(board, user, role, id, body, origin, req) {
  const r = await load(board.id, id);
  const decision = body.decision;
  if (!['approved', 'rejected'].includes(decision)) throw fail('Ungültige Entscheidung.');
  const comment = String(body.comment || '').trim().slice(0, MAX_NOTE);
  if (decision === 'rejected' && !comment) throw fail('Bitte begründe die Ablehnung.');
  const b = await boards.load(board.id);
  const el = b.elements.get(r.element_id);
  if (!el) throw fail('Das Element existiert nicht mehr.', 409);
  if (!boards.canSeeElement(b, el, user.id, role)) throw fail('Freigabe nicht gefunden.', 404);
  const hit = await db.one(
    `UPDATE review_people SET decision = $3, comment = $4, content_hash = $5, decided_at = now() WHERE review_id = $1 AND user_id = $2 RETURNING user_id`,
    [r.id, user.id, decision, comment, contentHash(b, el)]);
  if (!hit) throw fail('Du bist für diese Freigabe nicht als prüfende Person eingetragen.', 403);
  audit.log(req, 'review_decided', { userId: user.id, details: { board: board.id, element: r.element_id, decision } });
  if (r.created_by) {
    notify.create({ boardId: board.id, boardName: b.name, kind: 'review_result', actor: user, elementId: r.element_id, excerpt: el.title || el.name || '', userIds: [r.created_by], origin })
      .catch((e) => log.error('Benachrichtigung fehlgeschlagen', { err: e }));
  }
  changed(board.id);
}

// Neu vorlegen: Alle bisherigen Entscheidungen verfallen
async function restart(board, user, role, id, origin, req) {
  const r = await load(board.id, id);
  if (String(r.created_by) !== String(user.id) && role !== 'owner') throw fail('Das darf nur, wer die Freigabe angefordert hat, oder der Besitzer.', 403);
  const b = await boards.load(board.id);
  const el = b.elements.get(r.element_id);
  const ids = (await db.query(
    `UPDATE review_people SET decision = NULL, comment = '', content_hash = NULL, decided_at = NULL WHERE review_id = $1 RETURNING user_id`, [r.id])).rows.map((p) => p.user_id);
  audit.log(req, 'review_restarted', { userId: user.id, details: { board: board.id, element: r.element_id } });
  if (el) notify.create({ boardId: board.id, boardName: b.name, kind: 'review', actor: user, elementId: el.id, excerpt: el.title || el.name || '', userIds: ids, origin }).catch((e) => log.error('Benachrichtigung fehlgeschlagen', { err: e }));
  changed(board.id);
}

async function remove(board, user, role, id, req) {
  const r = await load(board.id, id);
  if (String(r.created_by) !== String(user.id) && role !== 'owner') throw fail('Das darf nur, wer die Freigabe angefordert hat, oder der Besitzer.', 403);
  await db.query('DELETE FROM reviews WHERE id = $1', [r.id]);
  audit.log(req, 'review_removed', { userId: user.id, details: { board: board.id, element: r.element_id } });
  changed(board.id);
}

module.exports = { list, create, decide, restart, remove };
