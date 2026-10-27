'use strict';
const log = require('./log').child('notify');
// Benachrichtigungen: Erwähnungen, Antworten in eigenen Kommentar-Threads und zugewiesene Kommentare.
// Sie erscheinen sofort in der Glocke (live, falls die Person gerade verbunden ist) und optional per E-Mail.
const db = require('./db');
const boards = require('./boards');
const settings = require('./settings');
const mail = require('./mail');

const MAIL_PAUSE_MS = 10 * 60000; // höchstens eine E-Mail je Person und Board in zehn Minuten
const KEEP_DAYS = 90;
const lastMail = new Map();

// Personen, die ein Board kennen: Besitzer, Mitglieder, Team, aktive Gäste und (bei Link-Freigabe) Besucher.
// Für Erwähnungen und die Zuweisung von Kommentaren.
async function boardPeople(boardId) {
  const rows = (await db.query(
    `SELECT DISTINCT u.id, u.username, u.display_name, u.color, u.role FROM users u
      WHERE u.status = 'active' AND u.email_verified_at IS NOT NULL AND (u.role <> 'guest' OR u.guest_expires_at > now()) AND (
            u.id = (SELECT owner_id FROM boards WHERE id = $1)
         OR u.id IN (SELECT user_id FROM board_members WHERE board_id = $1)
         OR u.id IN (SELECT tm.user_id FROM team_members tm JOIN boards b ON b.team_id = tm.team_id WHERE b.id = $1)
         OR u.guest_link_id IN (SELECT id FROM guest_links WHERE board_id = $1 AND revoked_at IS NULL)
         OR (u.id IN (SELECT user_id FROM board_visits WHERE board_id = $1 AND visited_at > now() - interval '180 days')
             AND (SELECT link_access FROM boards WHERE id = $1) <> 'private'))
      ORDER BY u.username LIMIT 500`, [boardId])).rows;
  return rows.map((u) => ({ id: String(u.id), username: u.username, displayName: u.display_name || u.username, color: u.color, guest: u.role === 'guest' }));
}

// @Erwähnungen im Text: Benutzername oder Anzeigename ohne Leerzeichen (Groß-/Kleinschreibung egal)
function mentionedIds(text, people) {
  const ids = new Set();
  for (const m of String(text || '').matchAll(/@([\p{L}\p{N}._-]+)/gu)) {
    const t = m[1].toLowerCase().replace(/[.,;:!?)]+$/, '');
    for (const p of people) {
      if (p.username.toLowerCase() === t || p.displayName.replace(/\s+/g, '').toLowerCase() === t) ids.add(p.id);
    }
  }
  return ids;
}

const onlineOn = (boardId, uid) => [...(boards.rooms.get(boardId)?.values() || [])].some((c) => c.uid === String(uid));

function pushLive(uid, item) {
  for (const room of boards.rooms.values()) {
    for (const c of room.values()) if (c.uid === String(uid)) boards.send(c.res, { type: 'notify', item });
  }
}

const SUBJECT = {
  mention: (a) => `${a} hat dich erwähnt`,
  reply: (a) => `${a} hat auf einen Kommentar geantwortet`,
  task: (a) => `${a} hat dir einen Kommentar zugewiesen`,
};

// Legt Benachrichtigungen an (nicht für die handelnde Person selbst und nur für Personen mit Zugriff auf das Board).
// origin: Basisadresse für Links in E-Mails (oder null)
async function create({ boardId, boardName, kind, actor, elementId, excerpt, userIds, origin }) {
  const targets = [...new Set([...userIds].map(String))].filter((id) => id !== String(actor.id) && /^\d{1,18}$/.test(id));
  if (!targets.length) return;
  const users = (await db.query(`SELECT * FROM users WHERE id = ANY($1::bigint[]) AND status = 'active'`, [targets])).rows;
  const s = await settings.get();
  const mailOk = s.collab.mentionEmails && (await settings.mailConfigured());
  const actorName = (actor.display_name || actor.username) + (actor.role === 'guest' ? ' (Gast)' : '');
  for (const u of users) {
    const { role } = await boards.access(boardId, u);
    if (!role) continue;
    const row = await db.one(
      `INSERT INTO notifications (user_id, board_id, kind, actor_id, actor_name, element_id, excerpt)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, created_at`,
      [u.id, boardId, kind, actor.role === 'guest' ? null : actor.id, actorName, elementId, String(excerpt || '').slice(0, 300)]);
    pushLive(u.id, {
      id: String(row.id), kind, boardId, boardName, actor: actorName, elementId, excerpt: String(excerpt || '').slice(0, 300),
      createdAt: new Date(row.created_at).getTime(), read: false,
    });
    // E-Mail nur, wenn die Person gerade nicht im Board ist – und nicht öfter als alle zehn Minuten je Board
    const key = `${u.id}:${boardId}`;
    if (!mailOk || u.role === 'guest' || !u.email || u.notify_email === false || !origin || onlineOn(boardId, u.id)) continue;
    if (Date.now() - (lastMail.get(key) || 0) < MAIL_PAUSE_MS) continue;
    lastMail.set(key, Date.now());
    const url = `${origin}/board/${boardId}${elementId ? '#el=' + encodeURIComponent(elementId) : ''}`;
    mail.sendQuietly(u.email, SUBJECT[kind](actorName), SUBJECT[kind](actorName),
      [`Board: „${boardName}“`, `„${String(excerpt || '').slice(0, 300)}“`, 'Weitere Hinweise siehst du in der Glocke oben rechts. E-Mail-Benachrichtigungen kannst du in deinem Profil abschalten.'],
      { label: 'Zum Kommentar', url });
  }
  if (lastMail.size > 5000) for (const [k, t] of lastMail) if (Date.now() - t > MAIL_PAUSE_MS) lastMail.delete(k);
}

async function list(userId, limit = 50) {
  const rows = (await db.query(
    `SELECT n.*, b.name AS board_name FROM notifications n LEFT JOIN boards b ON b.id = n.board_id
      WHERE n.user_id = $1 ORDER BY n.created_at DESC LIMIT $2`, [userId, Math.max(1, Math.min(100, limit))])).rows;
  const unread = Number((await db.one('SELECT count(*) AS n FROM notifications WHERE user_id = $1 AND read_at IS NULL', [userId])).n);
  return {
    unread,
    items: rows.map((n) => ({
      id: String(n.id), kind: n.kind, boardId: n.board_id, boardName: boards.cache.get(n.board_id)?.name || n.board_name || '',
      actor: n.actor_name || '', elementId: n.element_id, excerpt: n.excerpt || '', createdAt: new Date(n.created_at).getTime(), read: !!n.read_at,
    })),
  };
}

async function markRead(userId, { ids, all, boardId, elementId }) {
  if (all) return db.query('UPDATE notifications SET read_at = now() WHERE user_id = $1 AND read_at IS NULL', [userId]);
  if (boardId && elementId) {
    return db.query('UPDATE notifications SET read_at = now() WHERE user_id = $1 AND board_id = $2 AND element_id = $3 AND read_at IS NULL', [userId, boardId, elementId]);
  }
  const list = (Array.isArray(ids) ? ids : []).map(String).filter((x) => /^\d{1,18}$/.test(x)).slice(0, 200);
  if (list.length) await db.query('UPDATE notifications SET read_at = now() WHERE user_id = $1 AND id = ANY($2::bigint[])', [userId, list]);
}

setInterval(() => {
  db.query(`DELETE FROM notifications WHERE created_at < now() - $1 * interval '1 day'`, [KEEP_DAYS])
    .catch((err) => log.warn('Alte Benachrichtigungen konnten nicht gelöscht werden', { err }));
}, 24 * 3600000).unref();

module.exports = { boardPeople, mentionedIds, create, list, markRead };
