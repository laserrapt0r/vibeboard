'use strict';
// Administration: Übersicht, Einstellungen, Mailserver, Benutzerverwaltung, Boards, Sicherheitsprotokoll
const crypto = require('crypto');
const db = require('../db');
const auth = require('../auth');
const boards = require('../boards');
const settings = require('../settings');
const mail = require('../mail');
const audit = require('../audit');
const { checkPassword } = require('../password');
const { normalizeEmail, DISPOSABLE_COUNT } = require('../email');
const { baseUrl, sendVerification, passwordRules } = require('./auth');
const { HttpError, readJson, json } = require('../http');
const scanner = require('../virusscan');
const versions = require('../version');
const pkg = require('../../package.json');

const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]+@[a-z0-9-]+(\.[a-z0-9-]+)+$/;

// Zählt andere aktive Admins; innerhalb einer Transaktion mit Tabellensperre aufrufen,
// damit zwei gleichzeitige Änderungen nicht beide den „letzten“ Admin entfernen
async function adminCount(c, exceptId) {
  return Number((await c.query(`SELECT count(*) AS n FROM users WHERE role = 'admin' AND status = 'active' AND id <> $1`, [exceptId || 0])).rows[0].n);
}

function checkUid(uid) {
  if (!/^\d+$/.test(String(uid))) throw new HttpError(404, 'Benutzer nicht gefunden.');
}

const nameOf = (u) => u.display_name || u.username;

function adminUser(u) {
  return {
    ...auth.publicUser(u),
    boardCount: u.board_count ?? 0,
    sessionCount: u.session_count ?? 0,
    recoveryCodesLeft: (u.recovery_codes || []).length,
  };
}

async function sendInvite(req, user) {
  const token = await auth.createToken(user.id, 'invite', 72);
  const s = await settings.get();
  await mail.send(user.email, `Dein Zugang zu ${s.general.siteName}`, 'Willkommen!',
    [`Hallo ${nameOf(user)},`, `für dich wurde ein Konto mit dem Benutzernamen „${user.username}“ angelegt.`, 'Lege über den folgenden Link dein Kennwort fest. Der Link ist 72 Stunden gültig.'],
    { label: 'Kennwort festlegen', url: `${await baseUrl(req)}/reset?token=${token}` });
}

function register(r) {
  r.route('GET', '/api/admin/overview', async (req, res) => {
    await auth.requireAdmin(req);
    const users = (await db.query('SELECT status, count(*)::int AS n FROM users GROUP BY status')).rows;
    const stats = await db.one(`SELECT
      (SELECT count(*)::int FROM boards) AS boards,
      (SELECT count(*)::int FROM elements) AS elements,
      (SELECT count(*)::int FROM sessions WHERE expires_at > now()) AS sessions,
      (SELECT count(*)::int FROM users WHERE email_verified_at IS NULL) AS unverified,
      (SELECT count(*)::int FROM users WHERE totp_enabled) AS mfa,
      (SELECT count(*)::int FROM audit_log WHERE event IN ('login_failed', 'login_mfa_failed') AND at > now() - interval '24 hours') AS failed24h,
      (SELECT count(*)::int FROM audit_log WHERE event = 'upload_blocked' AND at > now() - interval '30 days') AS blocked30d,
      pg_database_size(current_database())::bigint AS db_size,
      version() AS pg_version`);
    const s = await settings.get();
    json(res, 200, {
      version: pkg.version,
      users: Object.fromEntries(users.map((u) => [u.status, u.n])),
      unverified: stats.unverified,
      mfaUsers: stats.mfa,
      failedLogins24h: stats.failed24h,
      boards: stats.boards,
      elements: stats.elements,
      sessions: stats.sessions,
      dbSize: Number(stats.db_size),
      pgVersion: String(stats.pg_version).split(' ').slice(0, 2).join(' '),
      online: boards.totalOnline(),
      activeBoards: boards.rooms.size,
      mailConfigured: await settings.mailConfigured(),
      baseUrl: s.general.baseUrl || process.env.PUBLIC_URL || '',
      disposableDomains: DISPOSABLE_COUNT,
      uptime: Math.round(process.uptime()),
      virusScanner: await scanner.status(),
      uploadsBlocked30d: stats.blocked30d,
      requireVirusScan: s.security.requireVirusScan,
      versionHistory: await versions.history(5),
    });
  });

  /* ---------------- Einstellungen & Mail ---------------- */

  r.route('GET', '/api/admin/settings', async (req, res) => {
    await auth.requireAdmin(req);
    json(res, 200, { ...(await settings.forAdmin()), virusScanner: await scanner.status() });
  });

  r.route('PUT', '/api/admin/settings', async (req, res) => {
    const admin = await auth.requireAdmin(req);
    const body = await readJson(req);
    try {
      if (body.general) await settings.update('general', body.general);
      if (body.security) {
        // Sich nicht selbst aus der Administration aussperren
        if (body.security.requireMfaAdmins && !admin.totp_enabled) {
          throw new Error('Richte zuerst für dein eigenes Konto die Zwei-Faktor-Anmeldung ein.');
        }
        await settings.update('security', body.security);
      }
      if (body.legal) await settings.update('legal', body.legal);
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
    audit.log(req, 'admin_settings', { actorId: admin.id, details: { sections: Object.keys(body).filter((k) => ['general', 'security', 'legal', 'smtp'].includes(k)) } });
    json(res, 200, await settings.forAdmin());
  });

  r.route('POST', '/api/admin/test-mail', async (req, res) => {
    const admin = await auth.requireAdmin(req);
    auth.rateLimit('testmail:' + admin.id, 10, 10 * 60000);
    const body = await readJson(req);
    const stored = (await settings.get()).smtp;
    // Ungespeicherte Werte aus dem Formular testen, Passwort ggf. aus der Datenbank
    const smtp = { ...stored, ...(body.smtp || {}) };
    smtp.port = Number(smtp.port) || 587;
    if (!body.smtp?.pass) {
      // Das gespeicherte Kennwort nur an denselben Server mit demselben Benutzer schicken
      const same = smtp.host === stored.host && smtp.port === stored.port && smtp.user === stored.user;
      if (stored.pass && !same) throw new HttpError(400, 'Server oder Benutzer wurden geändert – bitte das Kennwort für den Test erneut eingeben.');
      smtp.pass = stored.pass;
    }
    const to = normalizeEmail(body.to || admin.email);
    if (!EMAIL_RE.test(to)) throw new HttpError(400, 'Bitte eine gültige Empfängeradresse angeben.');
    try {
      const id = await mail.send(to, 'Testnachricht', 'Der Mailversand funktioniert 🎉',
        ['Diese Testnachricht wurde aus der Administration verschickt.', `Server: ${smtp.host}:${smtp.port} (${smtp.security})`], null, smtp);
      json(res, 200, { ok: true, messageId: id });
    } catch (e) {
      throw new HttpError(502, 'Versand fehlgeschlagen: ' + e.message);
    }
  });

  /* ---------------- Benutzerverwaltung ---------------- */

  r.route('GET', '/api/admin/users', async (req, res) => {
    await auth.requireAdmin(req);
    const rows = (await db.query(
      `SELECT u.*,
              (SELECT count(*)::int FROM boards b WHERE b.owner_id = u.id) AS board_count,
              (SELECT count(*)::int FROM sessions s WHERE s.user_id = u.id AND s.expires_at > now()) AS session_count
         FROM users u ORDER BY (u.status = 'pending') DESC, lower(u.username)`)).rows;
    json(res, 200, rows.map(adminUser));
  });

  // Neues Konto: entweder mit Kennwort oder per Einladungslink (Kennwort legt die Person selbst fest)
  r.route('POST', '/api/admin/users', async (req, res) => {
    const admin = await auth.requireAdmin(req);
    const body = await readJson(req);
    const username = auth.validateUsername(body.username);
    const email = body.email ? normalizeEmail(body.email) : null;
    if (email && !EMAIL_RE.test(email)) throw new HttpError(400, 'Die E-Mail-Adresse ist ungültig.');
    const invite = !body.password;
    if (invite && !email) throw new HttpError(400, 'Für eine Einladung wird eine E-Mail-Adresse benötigt – oder lege ein Kennwort fest.');
    if (invite && !(await settings.mailConfigured())) throw new HttpError(400, 'Für eine Einladung muss der Mailserver eingerichtet sein – oder lege ein Kennwort fest.');
    const pw = invite ? crypto.randomBytes(32).toString('base64url') : await checkPassword(body.password, await passwordRules({ username, email: email || '' }));
    const role = body.role === 'admin' ? 'admin' : 'user';
    let row;
    try {
      row = await db.one(
        `INSERT INTO users (username, email, display_name, password_hash, role, status, color, email_verified_at, password_changed_at)
         VALUES ($1, $2, $3, $4, $5, 'active', $6, now(), now()) RETURNING *`,
        [username, email, String(body.displayName || '').trim().slice(0, 60) || null, await auth.hashPassword(pw), role, auth.randomColor()]);
    } catch (e) {
      if (e.code === '23505') throw new HttpError(409, 'Benutzername oder E-Mail-Adresse ist bereits vergeben.');
      throw e;
    }
    audit.log(req, 'admin_user_created', { userId: row.id, actorId: admin.id, details: { role, invite } });
    let inviteError = null;
    if (invite) await sendInvite(req, row).catch((e) => (inviteError = e.message));
    json(res, 201, { ...adminUser(row), invited: invite && !inviteError, inviteError });
  });

  r.route('PATCH', '/api/admin/users/:uid', async (req, res, { params }) => {
    const admin = await auth.requireAdmin(req);
    checkUid(params.uid);
    const body = await readJson(req);
    const existing = await db.one('SELECT * FROM users WHERE id = $1', [params.uid]);
    if (!existing) throw new HttpError(404, 'Benutzer nicht gefunden.');
    const pwHash = body.password
      ? await auth.hashPassword(await checkPassword(body.password, await passwordRules({ username: existing.username, email: existing.email || '' })))
      : null;
    const { user, row, role, status } = await db.tx(async (c) => {
      await c.query('LOCK TABLE users IN SHARE ROW EXCLUSIVE MODE');
      const user = (await c.query('SELECT * FROM users WHERE id = $1', [params.uid])).rows[0];
      if (!user) throw new HttpError(404, 'Benutzer nicht gefunden.');
      const role = body.role !== undefined ? (body.role === 'admin' ? 'admin' : 'user') : user.role;
      const status = body.status !== undefined ? body.status : user.status;
      if (!['active', 'pending', 'disabled'].includes(status)) throw new HttpError(400, 'Ungültiger Status.');
      const losesAdmin = user.role === 'admin' && user.status === 'active' && (role !== 'admin' || status !== 'active');
      if (losesAdmin && (await adminCount(c, user.id)) === 0) throw new HttpError(400, 'Es muss mindestens ein aktiver Administrator bleiben.');
      let email = user.email;
      if (body.email !== undefined) email = String(body.email).trim() ? normalizeEmail(body.email) : null;
      if (email && !EMAIL_RE.test(email)) throw new HttpError(400, 'Die E-Mail-Adresse ist ungültig.');
      const displayName = body.displayName !== undefined ? String(body.displayName).trim().slice(0, 60) || null : user.display_name;
      // Vom Admin gesetzte Adresse gilt als bestätigt; „emailVerified“ bestätigt manuell
      const markVerified = body.emailVerified === true || (email && email !== user.email);
      let row;
      try {
        row = (await c.query(
          `UPDATE users SET role = $2, status = $3, email = $4, display_name = $5,
                  email_verified_at = CASE WHEN $6 THEN COALESCE(email_verified_at, now()) ELSE email_verified_at END,
                  pending_email = CASE WHEN $4::text IS DISTINCT FROM email THEN NULL ELSE pending_email END
            WHERE id = $1 RETURNING *`,
          [user.id, role, status, email, displayName, !!markVerified])).rows[0];
      } catch (e) {
        if (e.code === '23505') throw new HttpError(409, 'Diese E-Mail-Adresse wird bereits verwendet.');
        throw e;
      }
      if (pwHash) row = (await c.query('UPDATE users SET password_hash = $2, password_changed_at = now() WHERE id = $1 RETURNING *', [user.id, pwHash])).rows[0];
      if (body.resetMfa) row = (await c.query(`UPDATE users SET totp_enabled = false, totp_secret = NULL, totp_pending = NULL, recovery_codes = '{}' WHERE id = $1 RETURNING *`, [user.id])).rows[0];
      return { user, row, role, status };
    });
    if (pwHash) await auth.destroyUserSessions(user.id, String(user.id) === String(admin.id) ? req : null);
    auth.invalidateUser(user.id);
    if (status !== 'active') {
      await auth.destroyUserSessions(user.id);
      boards.kickUser(null, user.id, 'disabled');
    } else if (role !== user.role) boards.kickUser(null, user.id);
    const changes = Object.keys(body).filter((k) => k !== 'password').concat(pwHash ? ['password'] : []);
    audit.log(req, 'admin_user_updated', { userId: user.id, actorId: admin.id, details: { changes, role, status } });
    // Freigabe per E-Mail mitteilen
    const base = await baseUrl(req).catch(() => null);
    if (user.status === 'pending' && status === 'active' && row.email && row.email_verified_at && base && (await settings.mailConfigured())) {
      mail.sendQuietly(row.email, 'Dein Konto wurde freigeschaltet', 'Willkommen!',
        [`Hallo ${nameOf(row)},`, 'dein Konto wurde von einem Administrator freigeschaltet. Du kannst dich jetzt anmelden.'],
        { label: 'Jetzt anmelden', url: base + '/login' });
    }
    json(res, 200, adminUser(row));
  });

  r.route('DELETE', '/api/admin/users/:uid', async (req, res, { params, url }) => {
    const admin = await auth.requireAdmin(req);
    checkUid(params.uid);
    if (String(admin.id) === String(params.uid)) throw new HttpError(400, 'Du kannst dich nicht selbst löschen.');
    const deleteBoards = url.searchParams.get('boards') === 'delete';
    const { user, owned } = await db.tx(async (c) => {
      await c.query('LOCK TABLE users IN SHARE ROW EXCLUSIVE MODE');
      const user = (await c.query('SELECT * FROM users WHERE id = $1', [params.uid])).rows[0];
      if (!user) throw new HttpError(404, 'Benutzer nicht gefunden.');
      if (user.role === 'admin' && (await adminCount(c, user.id)) === 0) throw new HttpError(400, 'Der letzte Administrator kann nicht gelöscht werden.');
      const owned = (await c.query('SELECT id FROM boards WHERE owner_id = $1', [user.id])).rows.map((x) => x.id);
      if (!deleteBoards) await c.query('UPDATE boards SET owner_id = $2 WHERE owner_id = $1', [user.id, admin.id]);
      await c.query('DELETE FROM users WHERE id = $1', [user.id]);
      return { user, owned };
    });
    boards.kickUser(null, user.id, 'disabled');
    if (deleteBoards) for (const id of owned) await boards.remove(id);
    auth.invalidateUser(user.id);
    audit.log(req, 'admin_user_deleted', { actorId: admin.id, details: { username: user.username, boards: owned.length, deletedBoards: deleteBoards } });
    json(res, 200, { ok: true, boards: owned.length, deletedBoards: deleteBoards });
  });

  // Link zum Zurücksetzen des Kennworts erzeugen (per Mail oder zum Weitergeben)
  r.route('POST', '/api/admin/users/:uid/reset-link', async (req, res, { params }) => {
    const admin = await auth.requireAdmin(req);
    checkUid(params.uid);
    const user = await db.one('SELECT * FROM users WHERE id = $1', [params.uid]);
    if (!user) throw new HttpError(404, 'Benutzer nicht gefunden.');
    const token = await auth.createToken(user.id, 'reset', 24);
    const link = `${await baseUrl(req)}/reset?token=${token}`;
    audit.log(req, 'admin_user_updated', { userId: user.id, actorId: admin.id, details: { changes: ['reset-link'] } });
    if (user.email && (await settings.mailConfigured())) {
      try {
        await mail.send(user.email, 'Kennwort festlegen', 'Kennwort festlegen',
          [`Hallo ${nameOf(user)},`, 'ein Administrator hat dir einen Link zum Festlegen eines neuen Kennworts geschickt. Er ist 24 Stunden gültig.'],
          { label: 'Kennwort festlegen', url: link });
        return json(res, 200, { sent: true, email: user.email });
      } catch (e) {
        return json(res, 200, { sent: false, link, error: e.message });
      }
    }
    json(res, 200, { sent: false, link });
  });

  r.route('POST', '/api/admin/users/:uid/resend-verification', async (req, res, { params }) => {
    await auth.requireAdmin(req);
    checkUid(params.uid);
    const user = await db.one('SELECT * FROM users WHERE id = $1', [params.uid]);
    if (!user) throw new HttpError(404, 'Benutzer nicht gefunden.');
    if (!user.email) throw new HttpError(400, 'Für diesen Benutzer ist keine E-Mail-Adresse hinterlegt.');
    if (user.email_verified_at) throw new HttpError(400, 'Die E-Mail-Adresse ist bereits bestätigt.');
    if (!(await settings.mailConfigured())) throw new HttpError(400, 'Der Mailserver ist nicht eingerichtet.');
    await sendVerification(req, user);
    json(res, 200, { ok: true, email: user.email });
  });

  r.route('POST', '/api/admin/users/:uid/revoke-sessions', async (req, res, { params }) => {
    const admin = await auth.requireAdmin(req);
    checkUid(params.uid);
    await auth.destroyUserSessions(params.uid, String(params.uid) === String(admin.id) ? req : null);
    audit.log(req, 'sessions_revoked', { userId: params.uid, actorId: admin.id });
    json(res, 200, { ok: true });
  });

  /* ---------------- Sicherheitsprotokoll ---------------- */

  r.route('GET', '/api/admin/audit', async (req, res, { url }) => {
    await auth.requireAdmin(req);
    const limit = Math.max(1, Math.min(500, Number(url.searchParams.get('limit')) || 200));
    const before = /^\d+$/.test(url.searchParams.get('before') || '') ? url.searchParams.get('before') : null;
    const event = url.searchParams.get('event') || null;
    const q = String(url.searchParams.get('q') || '').trim().slice(0, 100);
    const rows = (await db.query(
      `SELECT a.id, a.at, a.event, a.ip, a.user_agent, a.details,
              u.username AS user_name, ac.username AS actor_name
         FROM audit_log a
         LEFT JOIN users u ON u.id = a.user_id
         LEFT JOIN users ac ON ac.id = a.actor_id
        WHERE ($1::bigint IS NULL OR a.id < $1)
          AND ($2::text IS NULL OR a.event = $2)
          AND ($3 = '' OR u.username ILIKE '%' || $3 || '%' OR ac.username ILIKE '%' || $3 || '%' OR a.ip ILIKE $3 || '%')
        ORDER BY a.id DESC LIMIT $4`, [before, event, q.replace(/[%_\\]/g, '\\$&'), limit])).rows;
    json(res, 200, { events: audit.LABELS, entries: rows.map((e) => ({ ...e, id: String(e.id), label: audit.LABELS[e.event] || e.event })) });
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
    const admin = await auth.requireAdmin(req);
    const body = await readJson(req);
    if (body.ownerId) {
      checkUid(body.ownerId);
      const u = await db.one('SELECT id FROM users WHERE id = $1', [body.ownerId]);
      if (!u) throw new HttpError(404, 'Benutzer nicht gefunden.');
      const old = await db.one('SELECT owner_id FROM boards WHERE id = $1', [params.id]);
      if (!old) throw new HttpError(404, 'Board nicht gefunden.');
      await db.query('UPDATE boards SET owner_id = $2 WHERE id = $1', [params.id, u.id]);
      await db.query('DELETE FROM board_members WHERE board_id = $1 AND user_id = $2', [params.id, u.id]);
      // Offene Verbindungen von altem und neuem Besitzer mit neuen Rechten aufbauen lassen
      if (old.owner_id) boards.kickUser(params.id, old.owner_id);
      boards.kickUser(params.id, u.id);
      audit.log(req, 'admin_board_owner', { userId: u.id, actorId: admin.id, details: { board: params.id } });
    }
    json(res, 200, { ok: true });
  });
}

module.exports = { register };
