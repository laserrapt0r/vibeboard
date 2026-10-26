'use strict';
const log = require('../log').child('auth');
// Registrierung mit E-Mail-Bestätigung, Anmeldung (inkl. Zwei-Faktor), Profil, Kennwort, Sitzungen
const os = require('os');
const uqr = require('uqr');
const db = require('../db');
const auth = require('../auth');
const settings = require('../settings');
const mail = require('../mail');
const audit = require('../audit');
const totp = require('../totp');
const { checkPassword } = require('../password');
const { checkEmail } = require('../email');
const { HttpError, readJson, json, clientIp, requestOrigin } = require('../http');

const VERIFY_HOURS = 48;

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

const nameOf = (u) => u.display_name || u.username;

async function passwordRules(extra = {}) {
  const s = (await settings.get()).security;
  return { minLength: s.passwordMinLength, hibp: s.hibpCheck, ...extra };
}

async function sendVerification(req, user, email = user.email) {
  const token = await auth.createToken(user.id, 'verify', VERIFY_HOURS);
  const url = `${await baseUrl(req)}/verify?token=${token}`;
  await mail.send(email, 'Bitte bestätige deine E-Mail-Adresse', 'E-Mail-Adresse bestätigen',
    [`Hallo ${nameOf(user)},`, 'bitte bestätige deine E-Mail-Adresse, um dein Konto zu aktivieren. Der Link ist 48 Stunden gültig.', 'Falls du dich nicht registriert hast, kannst du diese E-Mail ignorieren.'],
    { label: 'E-Mail-Adresse bestätigen', url });
}

async function notifyAdminsAboutPending(req, user) {
  const s = await settings.get();
  if (!s.general.notifyAdmins || !(await settings.mailConfigured())) return;
  const admins = (await db.query(`SELECT email FROM users WHERE role = 'admin' AND status = 'active' AND email IS NOT NULL`)).rows;
  const url = (await baseUrl(req)) + '/admin#users';
  for (const a of admins) {
    mail.sendQuietly(a.email, 'Neue Registrierung wartet auf Freigabe', 'Neue Registrierung',
      [`${user.username} (${user.email}) hat sich registriert, die E-Mail-Adresse bestätigt und wartet auf Freigabe.`], { label: 'Benutzer verwalten', url });
  }
}

async function registrationState() {
  const s = await settings.get();
  const count = Number((await db.one('SELECT count(*) AS n FROM users')).n);
  if (count === 0) return { open: true, mode: 'open', setup: true };
  if (s.general.registration === 'closed') return { open: false, mode: 'closed', reason: 'Die Registrierung ist derzeit geschlossen.' };
  if (!(await settings.mailConfigured())) return { open: false, mode: s.general.registration, reason: 'Die Registrierung ist erst möglich, wenn ein Administrator den E-Mail-Versand eingerichtet hat.' };
  return { open: true, mode: s.general.registration };
}

function register(r) {
  // Öffentliche Konfiguration für Anmelde- und Registrierungsseite
  r.route('GET', '/api/config', async (req, res) => {
    const s = await settings.get();
    const reg = await registrationState();
    json(res, 200, {
      siteName: s.general.siteName,
      registration: reg.open ? reg.mode : 'closed',
      registrationReason: reg.reason || '',
      passwordMinLength: s.security.passwordMinLength,
      mailEnabled: await settings.mailConfigured(),
      needsSetup: !!reg.setup,
      legal: await require('./legal').available(),
      version: require('../version').VERSION,
    });
  });

  /* ---------------- Registrierung & Bestätigung ---------------- */

  r.route('POST', '/api/auth/register', async (req, res) => {
    auth.rateLimit('register:' + clientIp(req), 10, 30 * 60000);
    const body = await readJson(req);
    const s = await settings.get();
    const username = auth.validateUsername(body.username);
    const email = checkEmail(body.email, s.security);
    const password = await checkPassword(body.password, await passwordRules({ username, email }));
    const displayName = String(body.displayName || '').trim().slice(0, 60) || null;
    const hash = await auth.hashPassword(password);

    const result = await db.tx(async (c) => {
      // Sperre, damit bei gleichzeitigen Registrierungen nur einer der erste Admin wird
      await c.query('LOCK TABLE users IN SHARE ROW EXCLUSIVE MODE');
      const count = Number((await c.query('SELECT count(*) AS n FROM users')).rows[0].n);
      const first = count === 0;
      if (!first) {
        const reg = await registrationState();
        if (!reg.open) throw new HttpError(403, reg.reason);
      }
      if ((await c.query('SELECT 1 FROM users WHERE lower(username) = lower($1)', [username])).rowCount) {
        throw new HttpError(409, 'Dieser Benutzername ist bereits vergeben.');
      }
      // Bereits verwendete E-Mail-Adresse nicht verraten (Schutz vor Ausforschung)
      const existing = (await c.query('SELECT * FROM users WHERE lower(email) = $1', [email])).rows[0];
      if (existing) return { existing };
      const status = first || s.general.registration === 'open' ? 'active' : 'pending';
      const user = (await c.query(
        `INSERT INTO users (username, email, display_name, password_hash, role, status, color, email_verified_at, password_changed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now()) RETURNING *`,
        [username, email, displayName, hash, first ? 'admin' : 'user', status, auth.randomColor(), first ? new Date() : null])).rows[0];
      // Boards ohne Besitzer (z. B. aus dem Import) gehören dem ersten Admin
      if (first) await c.query('UPDATE boards SET owner_id = $1 WHERE owner_id IS NULL', [user.id]);
      return { user, first };
    });

    if (result.existing) {
      const u = result.existing;
      mail.sendQuietly(u.email, 'Registrierungsversuch mit deiner Adresse', 'Registrierungsversuch',
        [`Hallo ${nameOf(u)},`, 'gerade wurde versucht, ein neues Konto mit deiner E-Mail-Adresse zu registrieren. Du hast bereits ein Konto.', 'Falls du dein Kennwort vergessen hast, kannst du es auf der Anmeldeseite zurücksetzen. Warst du das nicht, kannst du diese E-Mail ignorieren.'],
        { label: 'Zur Anmeldung', url: (await baseUrl(req).catch(() => '')) + '/login' });
      return json(res, 201, { status: 'verify' });
    }
    const user = result.user;
    audit.log(req, 'register', { userId: user.id, details: { first: result.first } });
    if (result.first) {
      await auth.createSession(res, req, user.id);
      return json(res, 201, { status: 'active', user: auth.publicUser(user) });
    }
    try {
      await sendVerification(req, user);
    } catch (e) {
      log.error('Bestätigungsmail fehlgeschlagen', { userId: user.id, err: e });
      throw new HttpError(502, 'Dein Konto wurde angelegt, aber die Bestätigungsmail konnte nicht verschickt werden. Bitte versuche es später über „Bestätigungsmail erneut senden“ auf der Anmeldeseite.');
    }
    json(res, 201, { status: 'verify' });
  });

  // Bestätigungslink aus der E-Mail (Registrierung oder geänderte Adresse)
  r.route('POST', '/api/auth/verify', async (req, res) => {
    auth.rateLimit('verify:' + clientIp(req), 20, 15 * 60000);
    const body = await readJson(req);
    const t = await auth.consumeToken(body.token, ['verify', 'email-change']);
    if (!t) throw new HttpError(400, 'Der Link ist ungültig oder abgelaufen. Fordere auf der Anmeldeseite einen neuen an.');
    let user;
    if (t.purpose === 'email-change') {
      const old = await db.one('SELECT * FROM users WHERE id = $1', [t.userId]);
      try {
        user = await db.one('UPDATE users SET email = $2, pending_email = NULL, email_verified_at = now() WHERE id = $1 AND pending_email = $2 RETURNING *', [t.userId, t.data]);
      } catch (e) {
        if (e.code === '23505') throw new HttpError(409, 'Diese E-Mail-Adresse wird inzwischen von einem anderen Konto verwendet.');
        throw e;
      }
      if (!user) throw new HttpError(400, 'Diese Änderung wurde inzwischen zurückgezogen.');
      audit.log(req, 'email_changed', { userId: user.id, details: { from: old.email, to: user.email } });
      if (old && old.email) {
        mail.sendQuietly(old.email, 'Deine E-Mail-Adresse wurde geändert', 'E-Mail-Adresse geändert',
          [`Hallo ${nameOf(old)},`, `die E-Mail-Adresse deines Kontos wurde auf ${user.email} geändert.`, 'Warst du das nicht, wende dich bitte sofort an einen Administrator.']);
      }
      auth.invalidateUser(user.id);
      return json(res, 200, { status: user.status, changed: true });
    }
    user = await db.one('UPDATE users SET email_verified_at = COALESCE(email_verified_at, now()) WHERE id = $1 RETURNING *', [t.userId]);
    if (!user) throw new HttpError(400, 'Das Konto existiert nicht mehr.');
    audit.log(req, 'email_verified', { userId: user.id });
    if (user.status === 'pending') notifyAdminsAboutPending(req, user).catch((e) => log.error('Admin-Benachrichtigung fehlgeschlagen', { userId: user.id, err: e }));
    json(res, 200, { status: user.status });
  });

  r.route('POST', '/api/auth/resend-verification', async (req, res) => {
    auth.rateLimit('resend:' + clientIp(req), 5, 15 * 60000);
    const body = await readJson(req);
    const login = String(body.login || '').trim();
    if (await settings.mailConfigured()) {
      const user = login && await db.one(
        `SELECT * FROM users WHERE (lower(username) = lower($1) OR lower(email) = lower($1))
            AND email IS NOT NULL AND email_verified_at IS NULL AND status <> 'disabled'`, [login]);
      if (user) await sendVerification(req, user).catch((e) => log.error('Bestätigungsmail fehlgeschlagen', { userId: user.id, err: e }));
    }
    json(res, 200, { ok: true }); // immer gleiche Antwort
  });

  /* ---------------- Anmeldung ---------------- */

  r.route('POST', '/api/auth/login', async (req, res) => {
    const body = await readJson(req);
    const login = String(body.login || body.username || '').normalize('NFKC').trim();
    auth.rateLimit('login-ip:' + clientIp(req), 30, 10 * 60000);
    auth.rateLimit('login-user:' + login.toLowerCase(), 10, 15 * 60000);
    const password = String(body.password || '');
    const user = login && await db.one(
      'SELECT * FROM users WHERE lower(username) = lower($1) OR lower(email) = lower($1) ORDER BY lower(username) = lower($1) DESC LIMIT 1', [login]);
    if (!user) {
      await auth.burnTime(password);
      audit.log(req, 'login_failed', { details: { login: login.slice(0, 100) } });
      throw new HttpError(401, 'Benutzername oder Kennwort ist falsch.');
    }
    if (!(await auth.verifyPassword(password, user.password_hash))) {
      audit.log(req, 'login_failed', { userId: user.id });
      throw new HttpError(401, 'Benutzername oder Kennwort ist falsch.');
    }
    if (user.status === 'disabled') throw new HttpError(403, 'Dein Konto wurde deaktiviert.');
    if (!user.email_verified_at) throw new HttpError(403, 'Bitte bestätige zuerst deine E-Mail-Adresse über den Link in der Bestätigungsmail.', 'unverified');
    if (user.status === 'pending') throw new HttpError(403, 'Dein Konto wartet noch auf die Freigabe durch einen Administrator.', 'pending');
    if (auth.needsRehash(user.password_hash)) {
      auth.hashPassword(password).then((h) => db.query('UPDATE users SET password_hash = $2 WHERE id = $1', [user.id, h])).catch(() => {});
    }
    if (user.totp_enabled) return json(res, 200, { mfa: true, ticket: auth.createMfaTicket(user.id) });
    await auth.createSession(res, req, user.id);
    audit.log(req, 'login', { userId: user.id });
    json(res, 200, { user: auth.publicUser(user) });
  });

  // Zweiter Schritt: Code aus der Authenticator-App oder Wiederherstellungscode
  r.route('POST', '/api/auth/login/mfa', async (req, res) => {
    auth.rateLimit('mfa-ip:' + clientIp(req), 30, 10 * 60000);
    const body = await readJson(req);
    const ticket = String(body.ticket || '');
    const t = auth.readMfaTicket(ticket);
    const user = await db.one('SELECT * FROM users WHERE id = $1', [t.userId]);
    if (!user || !user.totp_enabled || user.status !== 'active') throw new HttpError(401, 'Die Anmeldung ist abgelaufen. Bitte melde dich erneut an.', 'mfa_expired');
    const code = String(body.code || '').trim();
    let ok = false;
    const counter = totp.verify(user.totp_secret, code, Number(user.totp_last_counter));
    if (counter !== null) {
      // Gleichzeitige Anfragen: nur wer den Zähler wirklich erhöht, gewinnt (kein doppelter Code)
      ok = !!(await db.one('UPDATE users SET totp_last_counter = $2 WHERE id = $1 AND totp_last_counter < $2 RETURNING id', [user.id, counter]));
    } else if (code.replace(/[^a-z0-9]/gi, '').length === 12) {
      const h = auth.hashRecovery(code);
      ok = !!(await db.one('UPDATE users SET recovery_codes = array_remove(recovery_codes, $2) WHERE id = $1 AND $2 = ANY(recovery_codes) RETURNING id', [user.id, h]));
      if (ok) audit.log(req, 'recovery_code_used', { userId: user.id });
    }
    if (!ok) {
      auth.failMfaTicket(ticket);
      audit.log(req, 'login_mfa_failed', { userId: user.id });
      throw new HttpError(401, 'Der Code ist falsch oder abgelaufen.');
    }
    auth.consumeMfaTicket(ticket);
    await auth.createSession(res, req, user.id);
    audit.log(req, 'login', { userId: user.id, details: { mfa: true } });
    json(res, 200, { user: auth.publicUser(user) });
  });

  r.route('POST', '/api/auth/logout', async (req, res) => {
    const u = await auth.currentUser(req);
    await auth.destroySession(req, res);
    if (u) audit.log(req, 'logout', { userId: u.id });
    json(res, 200, { ok: true });
  });

  /* ---------------- Profil ---------------- */

  r.route('GET', '/api/auth/me', async (req, res) => {
    const u = await auth.requireUser(req);
    const s = await settings.get();
    json(res, 200, { user: auth.publicUser(u), recoveryCodesLeft: u.recovery_codes.length, mfaRequired: u.role === 'admin' && s.security.requireMfaAdmins });
  });

  r.route('PATCH', '/api/auth/me', async (req, res) => {
    const u = await auth.requireUser(req);
    auth.rateLimit('profile:' + u.id, 30, 10 * 60000);
    const body = await readJson(req);
    const displayName = body.displayName !== undefined ? String(body.displayName).trim().slice(0, 60) || null : u.display_name;
    const color = /^#[0-9a-f]{6}$/i.test(body.color || '') ? body.color : u.color;
    let row = await db.one('UPDATE users SET display_name = $2, color = $3 WHERE id = $1 RETURNING *', [u.id, displayName, color]);
    let mailed = false;
    // Geänderte E-Mail-Adresse wird erst nach Bestätigung übernommen
    if (body.email !== undefined) {
      const s = await settings.get();
      const email = checkEmail(body.email, s.security);
      if (email === (u.email || '')) {
        row = await db.one('UPDATE users SET pending_email = NULL WHERE id = $1 RETURNING *', [u.id]);
      } else {
        if (!(await settings.mailConfigured())) throw new HttpError(400, 'Ohne Mailserver kann nur ein Administrator die E-Mail-Adresse ändern.');
        if (await db.one('SELECT 1 FROM users WHERE lower(email) = $1 AND id <> $2', [email, u.id])) throw new HttpError(409, 'Diese E-Mail-Adresse wird bereits verwendet.');
        row = await db.one('UPDATE users SET pending_email = $2 WHERE id = $1 RETURNING *', [u.id, email]);
        const token = await auth.createToken(u.id, 'email-change', 24, email);
        await mail.send(email, 'Neue E-Mail-Adresse bestätigen', 'Neue E-Mail-Adresse bestätigen',
          [`Hallo ${nameOf(u)},`, 'bitte bestätige, dass diese Adresse künftig für dein Konto verwendet werden soll. Der Link ist 24 Stunden gültig.'],
          { label: 'Adresse bestätigen', url: `${await baseUrl(req)}/verify?token=${token}` });
        mailed = true;
      }
    }
    auth.invalidateUser(u.id);
    json(res, 200, { user: auth.publicUser(row), mailed });
  });

  r.route('POST', '/api/auth/password', async (req, res) => {
    const u = await auth.requireUser(req);
    auth.rateLimit('pw:' + u.id, 10, 10 * 60000);
    const body = await readJson(req);
    if (!(await auth.verifyPassword(String(body.current || ''), u.password_hash))) throw new HttpError(400, 'Das aktuelle Kennwort ist falsch.');
    const pw = await checkPassword(body.password, await passwordRules({ username: u.username, email: u.email }));
    if (await auth.verifyPassword(pw, u.password_hash)) throw new HttpError(400, 'Das neue Kennwort muss sich vom bisherigen unterscheiden.');
    await db.query('UPDATE users SET password_hash = $2, password_changed_at = now() WHERE id = $1', [u.id, await auth.hashPassword(pw)]);
    await auth.destroyUserSessions(u.id, req); // andere Geräte abmelden
    audit.log(req, 'password_changed', { userId: u.id });
    if (u.email) mail.sendQuietly(u.email, 'Dein Kennwort wurde geändert', 'Kennwort geändert',
      [`Hallo ${nameOf(u)},`, 'das Kennwort deines Kontos wurde soeben geändert. Andere Geräte wurden abgemeldet.', 'Warst du das nicht, setze dein Kennwort sofort über „Kennwort vergessen“ zurück und informiere einen Administrator.']);
    json(res, 200, { ok: true });
  });

  r.route('POST', '/api/auth/forgot', async (req, res) => {
    auth.rateLimit('forgot:' + clientIp(req), 5, 15 * 60000);
    const body = await readJson(req);
    if (!(await settings.mailConfigured())) return json(res, 200, { ok: true, mail: false });
    const base = await baseUrl(req);
    const login = String(body.login || '').trim();
    const user = login && await db.one(`SELECT * FROM users WHERE (lower(username) = lower($1) OR lower(email) = lower($1)) AND status <> 'disabled' AND email IS NOT NULL`, [login]);
    if (user) {
      const token = await auth.createToken(user.id, 'reset', 1);
      mail.sendQuietly(user.email, 'Kennwort zurücksetzen', 'Kennwort zurücksetzen',
        [`Hallo ${nameOf(user)},`, 'für dein Konto wurde ein neues Kennwort angefordert. Der Link ist eine Stunde gültig.', 'Falls du das nicht warst, kannst du diese E-Mail ignorieren.'],
        { label: 'Neues Kennwort festlegen', url: `${base}/reset?token=${token}` });
    }
    // Immer gleiche Antwort, damit nicht erkennbar ist, ob es das Konto gibt
    json(res, 200, { ok: true, mail: true });
  });

  r.route('POST', '/api/auth/reset', async (req, res) => {
    auth.rateLimit('reset:' + clientIp(req), 10, 15 * 60000);
    const body = await readJson(req);
    const t = await auth.consumeToken(body.token, ['reset', 'invite']);
    if (!t) throw new HttpError(400, 'Der Link ist ungültig oder abgelaufen.');
    const user = await db.one('SELECT * FROM users WHERE id = $1', [t.userId]);
    if (!user) throw new HttpError(400, 'Das Konto existiert nicht mehr.');
    let pw;
    try {
      pw = await checkPassword(body.password, await passwordRules({ username: user.username, email: user.email }));
    } catch (e) {
      // Token wieder gültig machen, damit der Link nach einem Tippfehler weiter funktioniert
      await db.query(`INSERT INTO tokens (token_hash, user_id, purpose, expires_at) VALUES ($1, $2, $3, now() + interval '1 hour') ON CONFLICT DO NOTHING`,
        [auth.sha256(String(body.token)), user.id, t.purpose]);
      throw e;
    }
    // Der Link kam per E-Mail – damit ist die Adresse zugleich bestätigt
    await db.query('UPDATE users SET password_hash = $2, password_changed_at = now(), email_verified_at = COALESCE(email_verified_at, now()) WHERE id = $1',
      [user.id, await auth.hashPassword(pw)]);
    await auth.destroyUserSessions(user.id);
    audit.log(req, 'password_reset', { userId: user.id });
    json(res, 200, { ok: true });
  });

  /* ---------------- Zwei-Faktor-Anmeldung ---------------- */

  r.route('POST', '/api/auth/2fa/setup', async (req, res) => {
    const u = await auth.requireUser(req);
    if (u.totp_enabled) throw new HttpError(400, 'Die Zwei-Faktor-Anmeldung ist bereits aktiv.');
    const secret = totp.newSecret();
    await db.query('UPDATE users SET totp_pending = $2 WHERE id = $1', [u.id, secret]);
    auth.invalidateUser(u.id);
    const s = await settings.get();
    const url = totp.otpauthUrl(secret, u.username, s.general.siteName || 'vibeboard');
    json(res, 200, { secret, otpauth: url, qr: uqr.renderSVG(url, { border: 2 }) });
  });

  r.route('POST', '/api/auth/2fa/enable', async (req, res) => {
    const u = await auth.requireUser(req);
    auth.rateLimit('mfa-setup:' + u.id, 10, 10 * 60000);
    const body = await readJson(req);
    const fresh = await db.one('SELECT totp_pending FROM users WHERE id = $1', [u.id]);
    if (!fresh || !fresh.totp_pending) throw new HttpError(400, 'Bitte starte die Einrichtung erneut.');
    const counter = totp.verify(fresh.totp_pending, body.code);
    if (counter === null) throw new HttpError(400, 'Der Code ist falsch. Prüfe, ob die Uhrzeit auf deinem Gerät stimmt.');
    const codes = totp.recoveryCodes();
    await db.query(
      `UPDATE users SET totp_secret = totp_pending, totp_pending = NULL, totp_enabled = true, totp_last_counter = $2, recovery_codes = $3 WHERE id = $1`,
      [u.id, counter, codes.map(auth.hashRecovery)]);
    auth.invalidateUser(u.id);
    audit.log(req, 'mfa_enabled', { userId: u.id });
    if (u.email) mail.sendQuietly(u.email, 'Zwei-Faktor-Anmeldung aktiviert', 'Zwei-Faktor-Anmeldung aktiviert',
      [`Hallo ${nameOf(u)},`, 'für dein Konto ist jetzt die Zwei-Faktor-Anmeldung aktiv.', 'Warst du das nicht, wende dich bitte sofort an einen Administrator.']);
    json(res, 200, { recoveryCodes: codes });
  });

  r.route('POST', '/api/auth/2fa/disable', async (req, res) => {
    const u = await auth.requireUser(req);
    auth.rateLimit('mfa-setup:' + u.id, 10, 10 * 60000);
    const body = await readJson(req);
    if (!(await auth.verifyPassword(String(body.password || ''), u.password_hash))) throw new HttpError(400, 'Das Kennwort ist falsch.');
    await db.query(`UPDATE users SET totp_enabled = false, totp_secret = NULL, totp_pending = NULL, recovery_codes = '{}' WHERE id = $1`, [u.id]);
    auth.invalidateUser(u.id);
    audit.log(req, 'mfa_disabled', { userId: u.id });
    if (u.email) mail.sendQuietly(u.email, 'Zwei-Faktor-Anmeldung deaktiviert', 'Zwei-Faktor-Anmeldung deaktiviert',
      [`Hallo ${nameOf(u)},`, 'die Zwei-Faktor-Anmeldung deines Kontos wurde ausgeschaltet.', 'Warst du das nicht, ändere sofort dein Kennwort und informiere einen Administrator.']);
    json(res, 200, { ok: true });
  });

  r.route('POST', '/api/auth/2fa/recovery-codes', async (req, res) => {
    const u = await auth.requireUser(req);
    auth.rateLimit('mfa-setup:' + u.id, 10, 10 * 60000);
    const body = await readJson(req);
    if (!u.totp_enabled) throw new HttpError(400, 'Die Zwei-Faktor-Anmeldung ist nicht aktiv.');
    if (!(await auth.verifyPassword(String(body.password || ''), u.password_hash))) throw new HttpError(400, 'Das Kennwort ist falsch.');
    const codes = totp.recoveryCodes();
    await db.query('UPDATE users SET recovery_codes = $2 WHERE id = $1', [u.id, codes.map(auth.hashRecovery)]);
    auth.invalidateUser(u.id);
    json(res, 200, { recoveryCodes: codes });
  });

  /* ---------------- Sitzungen ---------------- */

  r.route('GET', '/api/auth/sessions', async (req, res) => {
    const u = await auth.requireUser(req);
    json(res, 200, await auth.listSessions(u.id, req));
  });

  r.route('DELETE', '/api/auth/sessions/:sid', async (req, res, { params }) => {
    const u = await auth.requireUser(req);
    await auth.revokeSession(u.id, params.sid);
    audit.log(req, 'sessions_revoked', { userId: u.id, details: { session: params.sid } });
    json(res, 200, { ok: true });
  });

  r.route('POST', '/api/auth/sessions/revoke-others', async (req, res) => {
    const u = await auth.requireUser(req);
    await auth.destroyUserSessions(u.id, req);
    audit.log(req, 'sessions_revoked', { userId: u.id, details: { others: true } });
    json(res, 200, { ok: true });
  });

  // Benutzersuche zum Teilen von Boards (nur Name, keine E-Mail-Adressen)
  r.route('GET', '/api/users/search', async (req, res, { url }) => {
    const u = await auth.requireUser(req);
    auth.rateLimit('search:' + u.id, 120, 60000);
    const q = String(url.searchParams.get('q') || '').trim().slice(0, 100);
    if (!q) return json(res, 200, []);
    const rows = (await db.query(
      `SELECT * FROM users WHERE status = 'active' AND email_verified_at IS NOT NULL AND id <> $1
         AND (username ILIKE $2 || '%' OR display_name ILIKE '%' || $2 || '%' OR lower(email) = lower($3))
       ORDER BY username LIMIT 8`, [u.id, q.replace(/[%_\\]/g, '\\$&'), q])).rows;
    json(res, 200, rows.map((x) => ({ id: String(x.id), username: x.username, displayName: x.display_name || x.username, color: x.color })));
  });
}

module.exports = { register, baseUrl, sendVerification, passwordRules };
