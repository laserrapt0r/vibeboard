'use strict';
const log = require('./log').child('guests');
// Gastzugang per Link: Personen ohne Konto sehen oder kommentieren genau ein Board – befristet.
// Ein Gast ist eine Benutzerzeile mit der Rolle „guest“, die an ihrem Link hängt: Wird der Link gesperrt,
// gelöscht oder läuft er ab, verschwinden Gastkonto und Sitzung mit ihm.
const crypto = require('crypto');
const db = require('./db');
const auth = require('./auth');
const boards = require('./boards');
const settings = require('./settings');

const MAX_GUESTS_PER_LINK = 100;
const ROLES = new Set(['viewer', 'commenter']);

const publicLink = (l) => ({
  id: String(l.id), role: l.role, label: l.label || '', createdAt: new Date(l.created_at).getTime(), expiresAt: new Date(l.expires_at).getTime(),
  revoked: !!l.revoked_at, expired: new Date(l.expires_at) <= new Date(), guests: Number(l.guests || 0), createdBy: l.creator || null,
});

async function enabled() {
  return (await settings.get()).collab.guestLinks;
}

async function list(boardId) {
  const rows = (await db.query(
    `SELECT gl.*, u.display_name AS creator, (SELECT count(*) FROM users g WHERE g.guest_link_id = gl.id) AS guests
       FROM guest_links gl LEFT JOIN users u ON u.id = gl.created_by
      WHERE gl.board_id = $1 AND (gl.revoked_at IS NULL OR gl.revoked_at > now() - interval '7 days')
      ORDER BY gl.created_at DESC`, [boardId])).rows;
  return rows.map(publicLink);
}

// Liefert den Link im Klartext genau einmal (gespeichert wird nur der Hash)
async function create(boardId, user, { role, days, label }) {
  const s = (await settings.get()).collab;
  if (!s.guestLinks) throw Object.assign(new Error('Der Gastzugang ist in dieser Installation abgeschaltet.'), { status: 403 });
  const r = ROLES.has(role) ? role : 'viewer';
  const d = Math.max(1, Math.min(s.guestMaxDays, Math.round(Number(days) || 7)));
  const token = crypto.randomBytes(24).toString('base64url');
  const row = await db.one(
    `INSERT INTO guest_links (board_id, token_hash, role, label, created_by, expires_at)
     VALUES ($1, $2, $3, $4, $5, now() + $6 * interval '1 day') RETURNING *`,
    [boardId, auth.sha256(token), r, String(label || '').trim().slice(0, 80) || null, user.id, d]);
  return { token, link: publicLink(row) };
}

// Gastkonten eines Links (bzw. aller Links) entfernen und laufende Verbindungen beenden
async function dropGuests(where, params) {
  const gone = (await db.query(`DELETE FROM users WHERE role = 'guest' AND ${where} RETURNING id`, params)).rows.map((r) => String(r.id));
  if (!gone.length) return 0;
  const ids = new Set(gone);
  for (const id of gone) auth.invalidateUser(id);
  boards.kickSessions((c) => ids.has(String(c.uid)));
  return gone.length;
}

async function revoke(boardId, linkId) {
  if (!/^\d{1,18}$/.test(String(linkId))) return false;
  const row = await db.one('UPDATE guest_links SET revoked_at = now() WHERE id = $1 AND board_id = $2 AND revoked_at IS NULL RETURNING id', [linkId, boardId]);
  if (!row) return false;
  await dropGuests('guest_link_id = $1', [row.id]);
  return true;
}

// Admin schaltet den Gastzugang ab: alle Links sperren, alle Gäste abmelden
async function revokeAll() {
  await db.query('UPDATE guest_links SET revoked_at = now() WHERE revoked_at IS NULL');
  const n = await dropGuests('true', []);
  log.info('Gastzugang abgeschaltet – alle Gastlinks gesperrt', { guests: n });
}

async function findLink(token) {
  if (typeof token !== 'string' || !/^[\w-]{20,100}$/.test(token)) return null;
  return db.one(
    `SELECT gl.*, b.name AS board_name FROM guest_links gl JOIN boards b ON b.id = gl.board_id
      WHERE gl.token_hash = $1`, [auth.sha256(token)]);
}

// Infos für die Beitrittsseite (ohne Anmeldung)
async function info(token, me = null) {
  const l = await findLink(token);
  const on = await enabled();
  if (!l || !on || l.revoked_at || new Date(l.expires_at) <= new Date()) return { valid: false };
  // Wer über genau diesen Link schon beigetreten ist, braucht kein zweites Gastkonto
  const joined = me && me.role === 'guest' && String(me.guest_link_id) === String(l.id);
  return { valid: true, boardName: boards.cache.get(l.board_id)?.name || l.board_name, role: l.role, expiresAt: new Date(l.expires_at).getTime(), ...(joined ? { joinedBoardId: l.board_id } : {}) };
}

// Gast anlegen und anmelden; liefert die Board-ID
async function join(token, name, req, res) {
  if (!(await enabled())) throw Object.assign(new Error('Der Gastzugang ist abgeschaltet.'), { status: 403 });
  const l = await findLink(token);
  if (!l || l.revoked_at || new Date(l.expires_at) <= new Date()) throw Object.assign(new Error('Dieser Gastlink ist ungültig oder abgelaufen.'), { status: 410 });
  const display = String(name || '').normalize('NFKC').replace(/[\u0000-\u001f]/g, '').trim().slice(0, 40);
  if (display.length < 2) throw Object.assign(new Error('Bitte gib deinen Namen an (mindestens 2 Zeichen).'), { status: 400 });
  const count = Number((await db.one('SELECT count(*) AS n FROM users WHERE guest_link_id = $1', [l.id])).n);
  if (count >= MAX_GUESTS_PER_LINK) throw Object.assign(new Error('Über diesen Link sind bereits zu viele Gäste angemeldet.'), { status: 429 });
  const username = 'gast-' + crypto.randomBytes(5).toString('hex');
  // Kein Kennwort: „!“ ist kein gültiger Hash, eine Anmeldung per Kennwort ist damit ausgeschlossen
  const user = await db.one(
    `INSERT INTO users (username, display_name, password_hash, role, status, color, email_verified_at, guest_link_id, guest_expires_at)
     VALUES ($1, $2, '!', 'guest', 'active', $3, now(), $4, $5) RETURNING *`,
    [username, display, auth.randomColor(), l.id, l.expires_at]);
  await auth.createSession(res, req, user.id, { expiresAt: new Date(l.expires_at) });
  return { boardId: l.board_id, user };
}

// Abgelaufene Gastkonten regelmäßig entfernen
async function cleanup() {
  try {
    await dropGuests('guest_expires_at < now()', []);
    await db.query(`DELETE FROM guest_links WHERE expires_at < now() - interval '30 days' OR revoked_at < now() - interval '30 days'`);
  } catch (err) {
    log.warn('Abgelaufene Gastzugänge konnten nicht entfernt werden', { err });
  }
}
setInterval(cleanup, 60000).unref();
setTimeout(cleanup, 30000).unref();

// Ein einzelnes Gastkonto entfernen (z. B. beim Wechsel auf einen anderen Gastlink)
const drop = (userId) => dropGuests('id = $1', [userId]);

module.exports = { list, create, revoke, revokeAll, info, join, enabled, drop };
