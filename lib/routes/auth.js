'use strict';
// Registrierung, Anmeldung, Profil, Kennwort vergessen
const os = require('os');
const db = require('../db');
const auth = require('../auth');
const settings = require('../settings');
const mail = require('../mail');
const { HttpError, readJson, json, clientIp, requestOrigin } = require('../http');

// Adresse für Links in E-Mails. Der Host-Header der Anfrage ist vom Absender frei wählbar und wird daher
// nur übernommen, wenn er auf diesen Rechner zeigt (localhost, eigener Hostname, eigene Netzwerkadressen).
function trustedOrigin(req) {
  const host = String(req.headers.host || '').toLowerCase();
  const name = host.startsWith('[') ? host.slice(1, host.indexOf(']')) : host.replace(/:\d+$/, '');
  const own = new Set(['localhost', '127.0.0.1', '::1', os.hostname().toLowerCase()]);
  for (const a of Object.values(os.networkInterfaces()).flat()) if (a) own.add(a.address.toLowerCase());
  return own.has(name) ? requestOrigin(req) : null;
}

async function baseUrl(req) {
  const configured = (await settings.get()).general.baseUrl || String(process.env.PUBLIC_URL || '').replace(/\/+$/, '');
  if (configured) return configured;
  const origin = trustedOrigin(req);
  if (origin) return origin;
  throw new HttpError(400, 'Für E-Mail-Links fehlt die öffentliche Adresse. Bitte in der Administration unter „Allgemein“ eintragen.');
}

async function notifyAdminsAboutPending(req, user) {
  const s = await settings.get();
  if (!s.general.notifyAdmins || !(await settings.mailConfigured())) return;
  const admins = (await db.query(`SELECT email FROM users WHERE role = 'admin' AND status = 'active' AND email IS NOT NULL`)).rows;
  const url = (await baseUrl(req)) + '/admin#users';
  for (const a of admins) {
    mail.sendQuietly(a.email, 'Neue Registrierung wartet auf Freigabe', 'Neue Registrierung',
      [`${user.username}${user.email ? ` (${user.email})` : ''} hat sich registriert und wartet auf Freigabe.`], { label: 'Benutzer verwalten', url });
  }
}

function register(r) {
  // Öffentliche Konfiguration für Anmelde- und Registrierungsseite
  r.route('GET', '/api/config', async (req, res) => {
    const s = await settings.get();
    const count = Number((await db.one('SELECT count(*) AS n FROM users')).n);
    json(res, 200, {
      siteName: s.general.siteName,
      registration: count === 0 ? 'open' : s.general.registration,
      requireEmail: s.general.requireEmail,
      mailEnabled: await settings.mailConfigured(),
      needsSetup: count === 0,
    });
  });

  r.route('POST', '/api/auth/register', async (req, res) => {
    auth.rateLimit('register:' + clientIp(req), 10, 10 * 60000);
    const body = await readJson(req);
    const s = await settings.get();
    const username = auth.validateUsername(body.username);
    const password = auth.validatePassword(body.password);
    const email = auth.validateEmail(body.email, s.general.requireEmail);
    const displayName = String(body.displayName || '').trim().slice(0, 60) || null;
    const hash = await auth.hashPassword(password);

    const user = await db.tx(async (c) => {
      // Sperre, damit bei gleichzeitigen Registrierungen nur einer der erste Admin wird
      await c.query('LOCK TABLE users IN SHARE ROW EXCLUSIVE MODE');
      const count = Number((await c.query('SELECT count(*) AS n FROM users')).rows[0].n);
      const first = count === 0;
      if (!first && s.general.registration === 'closed') throw new HttpError(403, 'Die Registrierung ist derzeit geschlossen.');
      const status = first || s.general.registration === 'open' ? 'active' : 'pending';
      let row;
      try {
        row = (await c.query(
          `INSERT INTO users (username, email, display_name, password_hash, role, status, color)
           VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
          [username, email, displayName, hash, first ? 'admin' : 'user', status, auth.randomColor()])).rows[0];
      } catch (e) {
        if (e.code === '23505') throw new HttpError(409, 'Benutzername oder E-Mail-Adresse ist bereits vergeben.');
        throw e;
      }
      // Boards ohne Besitzer (z. B. aus dem Import) gehören dem ersten Admin
      if (first) await c.query('UPDATE boards SET owner_id = $1 WHERE owner_id IS NULL', [row.id]);
      return row;
    });

    if (user.status === 'pending') {
      notifyAdminsAboutPending(req, user).catch((e) => console.error('Admin-Benachrichtigung fehlgeschlagen:', e.message));
      return json(res, 201, { status: 'pending' });
    }
    await auth.createSession(res, req, user.id);
    json(res, 201, { status: 'active', user: auth.publicUser(user) });
  });

  r.route('POST', '/api/auth/login', async (req, res) => {
    const body = await readJson(req);
    const login = String(body.login || body.username || '').trim();
    auth.rateLimit('login-ip:' + clientIp(req), 30, 10 * 60000);
    auth.rateLimit('login-user:' + login.toLowerCase(), 10, 10 * 60000);
    const user = await db.one('SELECT * FROM users WHERE lower(username) = lower($1) OR lower(email) = lower($1) ORDER BY lower(username) = lower($1) DESC LIMIT 1', [login]);
    if (!user) {
      await auth.burnTime(String(body.password || ''));
      throw new HttpError(401, 'Benutzername oder Kennwort ist falsch.');
    }
    if (!(await auth.verifyPassword(String(body.password || ''), user.password_hash))) throw new HttpError(401, 'Benutzername oder Kennwort ist falsch.');
    if (user.status === 'pending') throw new HttpError(403, 'Dein Konto wartet noch auf die Freigabe durch einen Administrator.');
    if (user.status === 'disabled') throw new HttpError(403, 'Dein Konto wurde deaktiviert.');
    await auth.createSession(res, req, user.id);
    json(res, 200, { user: auth.publicUser(user) });
  });

  r.route('POST', '/api/auth/logout', async (req, res) => {
    await auth.destroySession(req, res);
    json(res, 200, { ok: true });
  });

  r.route('GET', '/api/auth/me', async (req, res) => {
    const u = await auth.requireUser(req);
    json(res, 200, { user: auth.publicUser(u) });
  });

  r.route('PATCH', '/api/auth/me', async (req, res) => {
    const u = await auth.requireUser(req);
    const body = await readJson(req);
    const s = await settings.get();
    const displayName = body.displayName !== undefined ? String(body.displayName).trim().slice(0, 60) || null : u.display_name;
    const email = body.email !== undefined ? auth.validateEmail(body.email, s.general.requireEmail) : u.email;
    const color = /^#[0-9a-f]{6}$/i.test(body.color || '') ? body.color : u.color;
    let row;
    try {
      row = await db.one('UPDATE users SET display_name = $2, email = $3, color = $4 WHERE id = $1 RETURNING *', [u.id, displayName, email, color]);
    } catch (e) {
      if (e.code === '23505') throw new HttpError(409, 'Diese E-Mail-Adresse wird bereits verwendet.');
      throw e;
    }
    auth.invalidateUser(u.id);
    json(res, 200, { user: auth.publicUser(row) });
  });

  r.route('POST', '/api/auth/password', async (req, res) => {
    const u = await auth.requireUser(req);
    auth.rateLimit('pw:' + u.id, 10, 10 * 60000);
    const body = await readJson(req);
    if (!(await auth.verifyPassword(String(body.current || ''), u.password_hash))) throw new HttpError(400, 'Das aktuelle Kennwort ist falsch.');
    const pw = auth.validatePassword(body.password);
    await db.query('UPDATE users SET password_hash = $2 WHERE id = $1', [u.id, await auth.hashPassword(pw)]);
    await auth.destroyUserSessions(u.id, req); // andere Geräte abmelden
    json(res, 200, { ok: true });
  });

  r.route('POST', '/api/auth/forgot', async (req, res) => {
    auth.rateLimit('forgot:' + clientIp(req), 5, 15 * 60000);
    const body = await readJson(req);
    const mailEnabled = await settings.mailConfigured();
    if (!mailEnabled) return json(res, 200, { ok: true, mail: false });
    const base = await baseUrl(req);
    const login = String(body.login || '').trim();
    const user = login && await db.one(`SELECT * FROM users WHERE (lower(username) = lower($1) OR lower(email) = lower($1)) AND status = 'active' AND email IS NOT NULL`, [login]);
    if (user) {
      const token = await auth.createToken(user.id, 'reset', 1);
      const url = `${base}/reset?token=${token}`;
      mail.sendQuietly(user.email, 'Kennwort zurücksetzen', 'Kennwort zurücksetzen',
        [`Hallo ${user.display_name || user.username},`, 'für dein Konto wurde ein neues Kennwort angefordert. Der Link ist eine Stunde gültig.', 'Falls du das nicht warst, kannst du diese E-Mail ignorieren.'],
        { label: 'Neues Kennwort festlegen', url });
    }
    // Immer gleiche Antwort, damit nicht erkennbar ist, ob es das Konto gibt
    json(res, 200, { ok: true, mail: true });
  });

  r.route('POST', '/api/auth/reset', async (req, res) => {
    auth.rateLimit('reset:' + clientIp(req), 10, 15 * 60000);
    const body = await readJson(req);
    const pw = auth.validatePassword(body.password);
    const userId = await auth.consumeToken(body.token, 'reset');
    if (!userId) throw new HttpError(400, 'Der Link ist ungültig oder abgelaufen.');
    await db.query('UPDATE users SET password_hash = $2 WHERE id = $1', [userId, await auth.hashPassword(pw)]);
    await auth.destroyUserSessions(userId);
    json(res, 200, { ok: true });
  });

  // Benutzersuche zum Teilen von Boards
  r.route('GET', '/api/users/search', async (req, res, { url }) => {
    const u = await auth.requireUser(req);
    const q = String(url.searchParams.get('q') || '').trim();
    if (!q) return json(res, 200, []);
    const rows = (await db.query(
      `SELECT * FROM users WHERE status = 'active' AND id <> $1
         AND (username ILIKE $2 || '%' OR display_name ILIKE '%' || $2 || '%' OR lower(email) = lower($3))
       ORDER BY username LIMIT 8`, [u.id, q.replace(/[%_\\]/g, '\\$&'), q])).rows;
    json(res, 200, rows.map((x) => ({ id: String(x.id), username: x.username, displayName: x.display_name || x.username, color: x.color })));
  });
}

module.exports = { register, baseUrl };
