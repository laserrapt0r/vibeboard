'use strict';
// Administration: Übersicht, Einstellungen, Mailserver, Benutzer, Boards
const db = require('../db');
const auth = require('../auth');
const boards = require('../boards');
const settings = require('../settings');
const mail = require('../mail');
const { baseUrl } = require('./auth');
const { HttpError, readJson, json } = require('../http');
const pkg = require('../../package.json');

async function adminCount(exceptId) {
  return Number((await db.one(`SELECT count(*) AS n FROM users WHERE role = 'admin' AND status = 'active' AND id <> $1`, [exceptId || 0])).n);
}

function register(r) {
  r.route('GET', '/api/admin/overview', async (req, res) => {
    await auth.requireAdmin(req);
    const users = (await db.query('SELECT status, count(*)::int AS n FROM users GROUP BY status')).rows;
    const stats = await db.one(`SELECT
      (SELECT count(*)::int FROM boards) AS boards,
      (SELECT count(*)::int FROM elements) AS elements,
      (SELECT count(*)::int FROM sessions WHERE expires_at > now()) AS sessions,
      pg_database_size(current_database())::bigint AS db_size,
      version() AS pg_version`);
    json(res, 200, {
      version: pkg.version,
      users: Object.fromEntries(users.map((u) => [u.status, u.n])),
      boards: stats.boards,
      elements: stats.elements,
      sessions: stats.sessions,
      dbSize: Number(stats.db_size),
      pgVersion: String(stats.pg_version).split(' ').slice(0, 2).join(' '),
      online: boards.totalOnline(),
      activeBoards: boards.rooms.size,
      mailConfigured: await settings.mailConfigured(),
      uptime: Math.round(process.uptime()),
    });
  });

  /* ---------------- Einstellungen & Mail ---------------- */

  r.route('GET', '/api/admin/settings', async (req, res) => {
    await auth.requireAdmin(req);
    json(res, 200, await settings.forAdmin());
  });

  r.route('PUT', '/api/admin/settings', async (req, res) => {
    await auth.requireAdmin(req);
    const body = await readJson(req);
    try {
      if (body.general) await settings.update('general', body.general);
      if (body.smtp) {
        const patch = { ...body.smtp };
        // Leeres Passwortfeld = bisheriges Passwort behalten
        if (!patch.pass && !body.smtp.clearPassword) delete patch.pass;
        if (body.smtp.clearPassword) patch.pass = '';
        await settings.update('smtp', patch);
      }
    } catch (e) {
      throw new HttpError(400, e.message);
    }
    json(res, 200, await settings.forAdmin());
  });

  r.route('POST', '/api/admin/test-mail', async (req, res) => {
    const admin = await auth.requireAdmin(req);
    auth.rateLimit('testmail:' + admin.id, 10, 10 * 60000);
    const body = await readJson(req);
    const stored = (await settings.get()).smtp;
    // Ungespeicherte Werte aus dem Formular testen, Passwort ggf. aus der Datenbank
    const smtp = { ...stored, ...(body.smtp || {}) };
    if (!body.smtp?.pass) smtp.pass = stored.pass;
    smtp.port = Number(smtp.port) || 587;
    const to = auth.validateEmail(body.to || admin.email, true);
    try {
      const id = await mail.send(to, 'Testnachricht', 'Der Mailversand funktioniert 🎉',
        ['Diese Testnachricht wurde aus der Administration verschickt.', `Server: ${smtp.host}:${smtp.port} (${smtp.security})`], null, smtp);
      json(res, 200, { ok: true, messageId: id });
    } catch (e) {
      throw new HttpError(502, 'Versand fehlgeschlagen: ' + e.message);
    }
  });

  /* ---------------- Benutzer ---------------- */

  r.route('GET', '/api/admin/users', async (req, res) => {
    await auth.requireAdmin(req);
    const rows = (await db.query(
      `SELECT u.*, (SELECT count(*)::int FROM boards b WHERE b.owner_id = u.id) AS board_count
         FROM users u ORDER BY (u.status = 'pending') DESC, lower(u.username)`)).rows;
    json(res, 200, rows.map((u) => ({ ...auth.publicUser(u), boardCount: u.board_count })));
  });

  r.route('POST', '/api/admin/users', async (req, res) => {
    await auth.requireAdmin(req);
    const body = await readJson(req);
    const username = auth.validateUsername(body.username);
    const password = auth.validatePassword(body.password);
    const email = auth.validateEmail(body.email, false);
    const role = body.role === 'admin' ? 'admin' : 'user';
    try {
      const row = await db.one(
        `INSERT INTO users (username, email, display_name, password_hash, role, status, color)
         VALUES ($1, $2, $3, $4, $5, 'active', $6) RETURNING *`,
        [username, email, String(body.displayName || '').trim() || null, await auth.hashPassword(password), role, auth.randomColor()]);
      json(res, 201, auth.publicUser(row));
    } catch (e) {
      if (e.code === '23505') throw new HttpError(409, 'Benutzername oder E-Mail-Adresse ist bereits vergeben.');
      throw e;
    }
  });

  r.route('PATCH', '/api/admin/users/:uid', async (req, res, { params }) => {
    const admin = await auth.requireAdmin(req);
    const body = await readJson(req);
    const user = await db.one('SELECT * FROM users WHERE id = $1', [params.uid]);
    if (!user) throw new HttpError(404, 'Benutzer nicht gefunden.');
    const role = body.role !== undefined ? (body.role === 'admin' ? 'admin' : 'user') : user.role;
    const status = body.status !== undefined ? body.status : user.status;
    if (!['active', 'pending', 'disabled'].includes(status)) throw new HttpError(400, 'Ungültiger Status.');
    const losesAdmin = user.role === 'admin' && user.status === 'active' && (role !== 'admin' || status !== 'active');
    if (losesAdmin && (await adminCount(user.id)) === 0) throw new HttpError(400, 'Es muss mindestens ein aktiver Administrator bleiben.');
    const email = body.email !== undefined ? auth.validateEmail(body.email, false) : user.email;
    const displayName = body.displayName !== undefined ? String(body.displayName).trim().slice(0, 60) || null : user.display_name;
    let row;
    try {
      row = await db.one('UPDATE users SET role = $2, status = $3, email = $4, display_name = $5 WHERE id = $1 RETURNING *',
        [user.id, role, status, email, displayName]);
    } catch (e) {
      if (e.code === '23505') throw new HttpError(409, 'Diese E-Mail-Adresse wird bereits verwendet.');
      throw e;
    }
    if (body.password) {
      await db.query('UPDATE users SET password_hash = $2 WHERE id = $1', [user.id, await auth.hashPassword(auth.validatePassword(body.password))]);
      await auth.destroyUserSessions(user.id, String(user.id) === String(admin.id) ? req : null);
    }
    auth.invalidateUser(user.id);
    if (status !== 'active') {
      await auth.destroyUserSessions(user.id);
      boards.kickUser(null, user.id, 'disabled');
    } else if (role !== user.role) boards.kickUser(null, user.id);
    // Freigabe per E-Mail mitteilen
    if (user.status === 'pending' && status === 'active' && row.email && (await settings.mailConfigured())) {
      mail.sendQuietly(row.email, 'Dein Konto wurde freigeschaltet', 'Willkommen!',
        [`Hallo ${row.display_name || row.username},`, 'dein Konto wurde von einem Administrator freigeschaltet. Du kannst dich jetzt anmelden.'],
        { label: 'Jetzt anmelden', url: (await baseUrl(req)) + '/login' });
    }
    json(res, 200, auth.publicUser(row));
  });

  r.route('DELETE', '/api/admin/users/:uid', async (req, res, { params, url }) => {
    const admin = await auth.requireAdmin(req);
    if (String(admin.id) === String(params.uid)) throw new HttpError(400, 'Du kannst dich nicht selbst löschen.');
    const user = await db.one('SELECT * FROM users WHERE id = $1', [params.uid]);
    if (!user) throw new HttpError(404, 'Benutzer nicht gefunden.');
    if (user.role === 'admin' && (await adminCount(user.id)) === 0) throw new HttpError(400, 'Der letzte Administrator kann nicht gelöscht werden.');
    const deleteBoards = url.searchParams.get('boards') === 'delete';
    const owned = (await db.query('SELECT id FROM boards WHERE owner_id = $1', [user.id])).rows.map((x) => x.id);
    boards.kickUser(null, user.id, 'disabled');
    if (deleteBoards) for (const id of owned) await boards.remove(id);
    else await db.query('UPDATE boards SET owner_id = $2 WHERE owner_id = $1', [user.id, admin.id]);
    await db.query('DELETE FROM users WHERE id = $1', [user.id]);
    auth.invalidateUser(user.id);
    json(res, 200, { ok: true, boards: owned.length, deletedBoards: deleteBoards });
  });

  // Link zum Zurücksetzen des Kennworts erzeugen (per Mail oder zum Weitergeben)
  r.route('POST', '/api/admin/users/:uid/reset-link', async (req, res, { params }) => {
    await auth.requireAdmin(req);
    const user = await db.one('SELECT * FROM users WHERE id = $1', [params.uid]);
    if (!user) throw new HttpError(404, 'Benutzer nicht gefunden.');
    const token = await auth.createToken(user.id, 'reset', 24);
    const link = `${await baseUrl(req)}/reset?token=${token}`;
    if (user.email && (await settings.mailConfigured())) {
      try {
        await mail.send(user.email, 'Kennwort festlegen', 'Kennwort festlegen',
          [`Hallo ${user.display_name || user.username},`, 'ein Administrator hat dir einen Link zum Festlegen eines neuen Kennworts geschickt. Er ist 24 Stunden gültig.'],
          { label: 'Kennwort festlegen', url: link });
        return json(res, 200, { sent: true, email: user.email });
      } catch (e) {
        return json(res, 200, { sent: false, link, error: e.message });
      }
    }
    json(res, 200, { sent: false, link });
  });

  /* ---------------- Boards ---------------- */

  r.route('GET', '/api/admin/boards', async (req, res) => {
    await auth.requireAdmin(req);
    const rows = (await db.query(
      `SELECT b.id, b.name, b.link_access, b.created_at, b.updated_at, b.owner_id, o.username AS owner,
              (SELECT count(*)::int FROM elements e WHERE e.board_id = b.id) AS elements,
              (SELECT count(*)::int FROM board_members m WHERE m.board_id = b.id) AS members
         FROM boards b LEFT JOIN users o ON o.id = b.owner_id ORDER BY b.updated_at DESC`)).rows;
    json(res, 200, rows.map((b) => ({
      id: b.id, name: boards.cache.get(b.id)?.name || b.name, linkAccess: b.link_access, owner: b.owner, ownerId: b.owner_id && String(b.owner_id),
      elements: boards.cache.get(b.id)?.elements.size ?? b.elements, members: b.members, online: boards.onlineCount(b.id),
      createdAt: b.created_at, updatedAt: b.updated_at,
    })));
  });

  r.route('PATCH', '/api/admin/boards/:id', async (req, res, { params }) => {
    await auth.requireAdmin(req);
    const body = await readJson(req);
    if (body.ownerId) {
      const u = await db.one('SELECT id FROM users WHERE id = $1', [body.ownerId]);
      if (!u) throw new HttpError(404, 'Benutzer nicht gefunden.');
      await db.query('UPDATE boards SET owner_id = $2 WHERE id = $1', [params.id, u.id]);
      await db.query('DELETE FROM board_members WHERE board_id = $1 AND user_id = $2', [params.id, u.id]);
    }
    json(res, 200, { ok: true });
  });
}

module.exports = { register };
