'use strict';
// Eigene Vorlagen: ein Board (oder Teile davon) als persönliche oder Team-Vorlage speichern
const db = require('./db');
const uploads = require('./uploads');
const { sanitizeElement } = require('./sanitize');

const MAX_BYTES = 10 * 1024 * 1024;
const MAX_PER_OWNER = 100;
// Kommentare (Gespräche mit Autorschaft) und Dateianhänge (gehören zu einem Board) wandern nicht in Vorlagen
const SKIP_TYPES = new Set(['comment', 'file']);

function fail(message, status = 400) {
  return Object.assign(new Error(message), { status });
}

const checkId = (id) => {
  if (!/^\d{1,18}$/.test(String(id))) throw fail('Vorlage nicht gefunden.', 404);
};

async function teamRole(teamId, userId) {
  const r = await db.one('SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2', [teamId, userId]);
  return r && r.role;
}

function pub(r, user) {
  return {
    id: String(r.id), name: r.name, description: r.description, icon: r.icon,
    scope: r.org ? 'org' : r.team_id ? 'team' : 'personal', teamId: r.team_id ? String(r.team_id) : null, teamName: r.team_name || null,
    by: r.by_name || '', createdAt: new Date(r.created_at).getTime(), elementCount: Number(r.n || 0),
    canDelete: r.org ? user.role === 'admin' : String(r.created_by) === String(user.id) || String(r.owner_id) === String(user.id) || r.my_team_role === 'admin',
  };
}

async function list(user) {
  const rows = (await db.query(
    `SELECT t.id, t.name, t.description, t.icon, t.owner_id, t.team_id, t.org, t.created_by, t.created_at, tm.name AS team_name,
            COALESCE(u.display_name, u.username) AS by_name, jsonb_array_length(t.data) AS n, m.role AS my_team_role
       FROM user_templates t
       LEFT JOIN teams tm ON tm.id = t.team_id
       LEFT JOIN users u ON u.id = t.created_by
       LEFT JOIN team_members m ON m.team_id = t.team_id AND m.user_id = $1
      WHERE t.owner_id = $1 OR m.user_id IS NOT NULL OR t.org
      ORDER BY t.org DESC, t.created_at DESC LIMIT 500`, [user.id])).rows;
  return rows.map((r) => pub(r, user));
}

async function get(user, id) {
  checkId(id);
  const r = await db.one(
    `SELECT t.*, m.role AS my_team_role FROM user_templates t
       LEFT JOIN team_members m ON m.team_id = t.team_id AND m.user_id = $2
      WHERE t.id = $1 AND (t.owner_id = $2 OR m.user_id IS NOT NULL OR t.org)`, [id, user.id]);
  if (!r) throw fail('Vorlage nicht gefunden.', 404);
  return { ...pub(r, user), elements: r.data };
}

async function create(user, body) {
  const name = String(body.name || '').trim().slice(0, 80);
  if (!name) throw fail('Bitte gib der Vorlage einen Namen.');
  const description = String(body.description || '').trim().slice(0, 200);
  const icon = [...String(body.icon || '⭐').trim()].slice(0, 2).join('') || '⭐';
  let teamId = null;
  const org = body.org === true;
  // Zentrale Vorlagen sieht die ganze Installation: Die Entscheidung liegt bei der Administration
  if (org && user.role !== 'admin') throw fail('Zentrale Vorlagen legt die Administration an.', 403);
  if (!org && body.teamId) {
    if (!/^\d{1,18}$/.test(String(body.teamId))) throw fail('Team nicht gefunden.', 404);
    if (!(await teamRole(body.teamId, user.id))) throw fail('Du bist nicht Mitglied dieses Teams.', 403);
    teamId = String(body.teamId);
  }
  const raw = Array.isArray(body.elements) ? body.elements.slice(0, 5000) : [];
  const elements = raw.map(sanitizeElement).filter((e) => e && !SKIP_TYPES.has(e.type)).map((e) => {
    // Zuweisungen, Sperren der Moderation, Reaktionen und private Kennzeichen gehören nicht in eine Vorlage
    const o = { ...e };
    for (const k of ['task', 'modLock', 'reactions', 'concealed', 'priv', 'privName', 'author', 'ext']) delete o[k];
    return o;
  });
  if (!elements.length) throw fail('Die Vorlage enthält keine Elemente.');
  const data = JSON.stringify(elements);
  if (data.length > MAX_BYTES) throw fail('Die Vorlage ist zu groß (höchstens 10 MB).', 413);
  const rejected = await uploads.checkElements(elements, { userId: user.id, kind: 'Vorlage' });
  if (rejected.length) throw fail(rejected[0].reason, 422);
  const n = Number((await db.one(org ? 'SELECT count(*) AS n FROM user_templates WHERE org AND $1::bigint IS NOT NULL' : teamId ? 'SELECT count(*) AS n FROM user_templates WHERE team_id = $1' : 'SELECT count(*) AS n FROM user_templates WHERE owner_id = $1', [teamId || user.id])).n);
  if (n >= MAX_PER_OWNER) throw fail(`Es sind höchstens ${MAX_PER_OWNER} Vorlagen möglich. Bitte lösche ältere.`);
  const row = await db.one(
    `INSERT INTO user_templates (name, description, icon, owner_id, team_id, data, created_by, org) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
    [name, description, icon, teamId || org ? null : user.id, teamId, data, user.id, org]);
  return String(row.id);
}

// Löschen: wer sie angelegt hat, bei Team-Vorlagen auch die Team-Verwaltung
async function remove(user, id) {
  checkId(id);
  const r = await db.one('SELECT owner_id, team_id, created_by, org FROM user_templates WHERE id = $1', [id]);
  if (!r) throw fail('Vorlage nicht gefunden.', 404);
  if (r.org) {
    if (user.role !== 'admin') throw fail('Zentrale Vorlagen verwaltet die Administration.', 403);
    return void await db.query('DELETE FROM user_templates WHERE id = $1', [id]);
  }
  const own = String(r.owner_id) === String(user.id) || String(r.created_by) === String(user.id);
  const admin = r.team_id && (await teamRole(r.team_id, user.id)) === 'admin';
  const member = r.team_id && (await teamRole(r.team_id, user.id));
  if (!(own && (!r.team_id || member)) && !admin) throw fail('Diese Vorlage kannst du nicht löschen.', 403);
  await db.query('DELETE FROM user_templates WHERE id = $1', [id]);
}

/* ---------------- Zuletzt verwendet ---------------- */

const MAX_RECENT = 12;
// Eingebaute Vorlagen haben sprechende Kennungen, eigene die Form „u<Zahl>“
const RECENT_ID = /^(?:u\d{1,18}|[a-z0-9][a-z0-9-]{0,47})$/;

async function recent(user) {
  const r = await db.one('SELECT recent_templates FROM users WHERE id = $1', [user.id]);
  return r ? r.recent_templates : [];
}

async function markUsed(user, id) {
  if (typeof id !== 'string' || !RECENT_ID.test(id)) throw fail('Vorlage nicht gefunden.', 404);
  const next = [id, ...(await recent(user)).filter((x) => x !== id)].slice(0, MAX_RECENT);
  await db.query('UPDATE users SET recent_templates = $2 WHERE id = $1', [user.id, JSON.stringify(next)]);
}

module.exports = { list, get, create, remove, recent, markUsed };
