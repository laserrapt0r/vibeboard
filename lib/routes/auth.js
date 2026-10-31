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
const invites = require('../invites');
const i18n = require('../i18n');
const { checkPassword } = require('../password');
const ldap = require('../ldap');
const identity = require('../identity');
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
  const admins = (await db.query(`SELECT email, locale FROM users WHERE role = 'admin' AND status = 'active' AND email IS NOT NULL`)).rows;
  const url = (await baseUrl(req)) + '/admin#users';
  for (const a of admins) {
    mail.sendQuietly(a, 'Neue Registrierung wartet auf Freigabe', 'Neue Registrierung',
      [`${nameOf(user)} (${user.email}) hat sich registriert, die E-Mail-Adresse bestätigt und wartet auf Freigabe.`], { label: 'Benutzer verwalten', url });
  }
}

async function registrationState() {
  const s = await settings.get();
  const count = Number((await db.one('SELECT count(*) AS n FROM users')).n);
  if (count === 0) return { open: true, mode: 'open', setup: true };
  if (s.auth.localLogin !== 'all') return { open: false, mode: 'closed', reason: 'Konten entstehen hier bei der ersten Anmeldung über den Anmeldedienst deiner Organisation.' };
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
      registrationReason: i18n.tr(reg.reason || ''),
      passwordMinLength: s.security.passwordMinLength,
      mailEnabled: await settings.mailConfigured(),
      webhooks: s.collab.webhooks,
      design: {
        accent: s.design.accent, hideBuiltin: s.design.hideBuiltin,
        palette: s.design.palette ? s.design.palette.split(' ') : null, stickyColors: s.design.stickyColors ? s.design.stickyColors.split(' ') : null,
      },
      officeConverter: require('../files').converterEnabled,
      needsSetup: !!reg.setup,
      legal: await require('./legal').available(),
      version: require('../version').VERSION,
      auth: {
        local: s.auth.localLogin,
        ldap: s.ldap.enabled,
        auto: s.auth.autoSso,
        sso: [
          s.oidc.enabled ? { id: 'oidc', label: s.oidc.label, url: '/api/auth/oidc/start' } : null,
          s.saml.enabled ? { id: 'saml', label: s.saml.label, url: '/api/auth/saml/start' } : null,
          s.kerberos.enabled ? { id: 'kerberos', label: s.kerberos.label, url: '/api/auth/kerberos' } : null,
        ].filter(Boolean),
      },
    });
  });

  /* ---------------- Registrierung & Bestätigung ---------------- */

  r.route('POST', '/api/auth/register', async (req, res) => {
    auth.rateLimit('register:' + clientIp(req), 10, 30 * 60000);
    const body = await readJson(req);
    const s = await settings.get();
    // Ein Name (muss nicht eindeutig sein); angemeldet wird mit der E-Mail-Adresse
    const name = auth.validateName(body.name ?? body.displayName ?? body.username);
    const email = checkEmail(body.email, s.security);
    const password = await checkPassword(body.password, await passwordRules({ username: name, email }));
    const hash = await auth.hashPassword(password);
    // Link aus einer Einladungsmail: Er beweist den Zugriff auf genau diese Adresse – keine zweite Bestätigung nötig
    const inviteToken = typeof body.inviteToken === 'string' ? body.inviteToken : '';
    const invite = inviteToken ? await invites.info(inviteToken) : null;
    const invited = !!invite && invite.email === email;

    const result = await db.tx(async (c) => {
      // Sperre, damit bei gleichzeitigen Registrierungen nur einer der erste Admin wird
      await c.query('LOCK TABLE users IN SHARE ROW EXCLUSIVE MODE');
      const count = Number((await c.query('SELECT count(*) AS n FROM users')).rows[0].n);
      const first = count === 0;
      if (!first) {
        const reg = await registrationState();
        if (!reg.open) throw new HttpError(403, reg.reason);
      }
      // Bereits verwendete E-Mail-Adresse nicht verraten (Schutz vor Ausforschung)
      const existing = (await c.query('SELECT * FROM users WHERE lower(email) = $1', [email])).rows[0];
      if (existing) return { existing };
      const status = first || s.general.registration === 'open' ? 'active' : 'pending';
      const user = (await c.query(
        `INSERT INTO users (username, email, display_name, password_hash, role, status, color, email_verified_at, password_changed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now()) RETURNING *`,
        [name, email, name, hash, first ? 'admin' : 'user', status, auth.randomColor(), first || invited ? new Date() : null])).rows[0];
      // Boards ohne Besitzer (z. B. aus dem Import) gehören dem ersten Admin
      if (first) await c.query('UPDATE boards SET owner_id = $1 WHERE owner_id IS NULL', [user.id]);
      await c.query('UPDATE users SET locale = $2 WHERE id = $1', [user.id, i18n.current()]);
      return { user, first };
    });

    if (result.existing) {
      const u = result.existing;
      mail.sendQuietly(u, 'Registrierungsversuch mit deiner Adresse', 'Registrierungsversuch',
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
    if (invited) {
      await invites.accept(inviteToken, email);
      await invites.claim(user);
      if (user.status === 'pending') {
        notifyAdminsAboutPending(req, user).catch((e) => log.error('Admin-Benachrichtigung fehlgeschlagen', { userId: user.id, err: e }));
        return json(res, 201, { status: 'pending' });
      }
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
        mail.sendQuietly(old, 'Deine E-Mail-Adresse wurde geändert', 'E-Mail-Adresse geändert',
          [`Hallo ${nameOf(old)},`, `die E-Mail-Adresse deines Kontos wurde auf ${user.email} geändert.`, 'Warst du das nicht, wende dich bitte sofort an einen Administrator.']);
      }
      auth.invalidateUser(user.id);
      await invites.claim(user).catch((e) => log.error('Einladungen konnten nicht eingelöst werden', { userId: user.id, err: e }));
      return json(res, 200, { status: user.status, changed: true });
    }
    user = await db.one('UPDATE users SET email_verified_at = COALESCE(email_verified_at, now()) WHERE id = $1 RETURNING *', [t.userId]);
    if (!user) throw new HttpError(400, 'Das Konto existiert nicht mehr.');
    audit.log(req, 'email_verified', { userId: user.id });
    await invites.claim(user).catch((e) => log.error('Einladungen konnten nicht eingelöst werden', { userId: user.id, err: e }));
    if (user.status === 'pending') notifyAdminsAboutPending(req, user).catch((e) => log.error('Admin-Benachrichtigung fehlgeschlagen', { userId: user.id, err: e }));
    json(res, 200, { status: user.status });
  });

  r.route('POST', '/api/auth/resend-verification', async (req, res) => {
    auth.rateLimit('resend:' + clientIp(req), 5, 15 * 60000);
    const body = await readJson(req);
    const login = String(body.login || '').trim();
    if (await settings.mailConfigured()) {
      const user = login && await db.one(
        `SELECT * FROM users WHERE lower(email) = lower($1)
            AND email_verified_at IS NULL AND status <> 'disabled'`, [login]);
      if (user) await sendVerification(req, user).catch((e) => log.error('Bestätigungsmail fehlgeschlagen', { userId: user.id, err: e }));
    }
    json(res, 200, { ok: true }); // immer gleiche Antwort
  });

  /* ---------------- Anmeldung ---------------- */

  // Fehlermeldung hängt nur von der Eingabe ab (mit oder ohne „@“), nie davon, ob es das Konto gibt
  const loginFailed = (login, directory) => (directory
    ? new HttpError(401, 'Anmeldename oder Kennwort ist falsch.')
    : login.includes('@')
    ? new HttpError(401, 'E-Mail-Adresse oder Kennwort ist falsch.')
    : new HttpError(401, 'Anmeldung fehlgeschlagen. Bitte melde dich mit deiner E-Mail-Adresse an – der frühere Benutzername gilt nur noch für ältere Konten ohne hinterlegte Adresse.', 'email_required'));

  // null = Anmeldename oder Kennwort falsch. Ein Ausfall des Verzeichnisses verrät nichts über Konten, wird aber gemeldet.
  async function ldapLogin(req, s, login, password) {
    let id;
    try {
      id = await ldap.authenticate(s.ldap, login, password);
    } catch (e) {
      if (e.status) throw e; // Begrenzung der Fehlversuche
      log.error('LDAP-Anmeldung nicht möglich', { err: e });
      throw new HttpError(424, 'Der Anmeldedienst ist gerade nicht erreichbar. Bitte versuche es später noch einmal.');
    }
    if (!id) return null;
    if (!id.allowed) {
      audit.log(req, 'login_failed', { details: { provider: 'ldap', reason: 'group' } });
      throw new HttpError(403, 'Du hast keinen Zugang zu dieser Anwendung. Bitte wende dich an deine IT.');
    }
    return identity.resolve(req, id);
  }

  r.route('POST', '/api/auth/login', async (req, res) => {
    const body = await readJson(req);
    const login = String(body.email || body.login || body.username || '').normalize('NFKC').trim();
    auth.rateLimit('login-ip:' + clientIp(req), 30, 10 * 60000);
    auth.rateLimit('login-user:' + login.toLowerCase(), 10, 15 * 60000);
    const password = String(body.password || '');
    // Anmeldung mit der E-Mail-Adresse. Übergang: Ältere Konten ganz ohne E-Mail-Adresse melden sich mit ihrem Namen an,
    // sofern er unter diesen Konten eindeutig ist – sie werden danach gebeten, eine Adresse zu hinterlegen.
    let user = null;
    if (login.includes('@')) user = await db.one(`SELECT * FROM users WHERE lower(email) = lower($1) AND role <> 'guest'`, [login]);
    else if (login) {
      const legacy = (await db.query(`SELECT * FROM users WHERE email IS NULL AND role <> 'guest' AND lower(username) = lower($1) LIMIT 2`, [login])).rows;
      if (legacy.length === 1) user = legacy[0];
    }
    // Kennwort-Anmeldung lokaler Konten; sonst das Verzeichnis. Beides antwortet gleich, wenn etwas nicht passt.
    const s = await settings.get();
    const localAllowed = !!user && user.password_hash !== auth.EXTERNAL_HASH && (s.auth.localLogin === 'all' || user.role === 'admin');
    let method = 'local';
    let passed = false;
    if (localAllowed) passed = await auth.verifyPassword(password, user.password_hash);
    else await auth.burnTime(password);
    if (!passed && s.ldap.enabled) {
      const found = await ldapLogin(req, s, login, password);
      if (found) {
        user = found;
        passed = true;
        method = 'ldap';
      }
    }
    if (!passed) {
      audit.log(req, 'login_failed', user ? { userId: user.id } : { details: { login: login.slice(0, 100) } });
      // Hinweis für alle Eingaben ohne „@“ gleich – verrät also nicht, ob es ein Konto mit diesem Namen gibt
      throw loginFailed(login, s.ldap.enabled);
    }
    // Gastzugänge haben kein Kennwort und melden sich nur über ihren Link an
    if (user.role === 'guest') throw new HttpError(401, 'E-Mail-Adresse oder Kennwort ist falsch.');
    if (user.status === 'disabled') throw new HttpError(403, 'Dein Konto wurde deaktiviert.');
    if (!user.email_verified_at) throw new HttpError(403, 'Bitte bestätige zuerst deine E-Mail-Adresse über den Link in der Bestätigungsmail.', 'unverified');
    if (user.status === 'pending') throw new HttpError(403, 'Dein Konto wartet noch auf die Freigabe durch einen Administrator.', 'pending');
    if (method === 'local' && auth.needsRehash(user.password_hash)) {
      auth.hashPassword(password).then((h) => db.query('UPDATE users SET password_hash = $2 WHERE id = $1', [user.id, h])).catch(() => {});
    }
    // Sprache der Person merken (für E-Mails, die andere auslösen)
    if (user.locale !== i18n.current()) db.query('UPDATE users SET locale = $2 WHERE id = $1', [user.id, i18n.current()]).catch(() => {});
    // Einladungen an diese Adresse einlösen (z. B. Konto durch Admin angelegt oder Adresse nachgetragen)
    await invites.claim(user).catch((e) => log.error('Einladungen konnten nicht eingelöst werden', { userId: user.id, err: e }));
    if (user.totp_enabled) return json(res, 200, { mfa: true, ticket: auth.createMfaTicket(user.id, method) });
    if (method === 'ldap') await identity.startSession(req, res, user, 'ldap');
    else {
      await auth.createSession(res, req, user.id);
      audit.log(req, 'login', { userId: user.id });
    }
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
    if (t.method === 'local') {
      await auth.createSession(res, req, user.id);
      audit.log(req, 'login', { userId: user.id, details: { mfa: true } });
    } else await identity.startSession(req, res, user, t.method);
    json(res, 200, { user: auth.publicUser(user) });
  });

  r.route('POST', '/api/auth/logout', async (req, res) => {
    const u = await auth.currentUser(req);
    const method = await auth.sessionMethod(req);
    await auth.destroySession(req, res);
    if (u) audit.log(req, 'logout', { userId: u.id });
    json(res, 200, { ok: true, redirect: method === 'oidc' ? await require('./sso').logoutRedirect(req) : null });
  });

  /* ---------------- Profil ---------------- */

  r.route('GET', '/api/auth/me', async (req, res) => {
    const u = await auth.requireUser(req, { guests: true });
    const s = await settings.get();
    json(res, 200, { user: auth.publicUser(u), recoveryCodesLeft: u.recovery_codes.length, mfaRequired: u.role === 'admin' && s.security.requireMfaAdmins });
  });

  r.route('PATCH', '/api/auth/me', async (req, res) => {
    const u = await auth.requireUser(req);
    auth.rateLimit('profile:' + u.id, 30, 10 * 60000);
    const body = await readJson(req);
    const displayName = body.displayName !== undefined || body.name !== undefined ? auth.validateName(body.name ?? body.displayName) : u.display_name;
    const color = /^#[0-9a-f]{6}$/i.test(body.color || '') ? body.color : u.color;
    const notifyEmail = body.notifyEmail !== undefined ? !!body.notifyEmail : u.notify_email !== false;
    // E-Mail zuerst prüfen, damit bei einem Fehler nichts halb gespeichert ist.
    // Leeres Feld bei Konten ohne Adresse = unverändert.
    let newEmail = null;
    // Extern verwaltete Konten: Die Adresse kommt aus dem Verzeichnis
    if (body.email !== undefined && u.password_hash !== auth.EXTERNAL_HASH && !(String(body.email).trim() === '' && !u.email)) {
      const s = await settings.get();
      const email = checkEmail(body.email, s.security);
      if (email !== (u.email || '')) {
        if (!(await settings.mailConfigured())) throw new HttpError(400, 'Ohne Mailserver kann nur ein Administrator die E-Mail-Adresse ändern.');
        if (await db.one('SELECT 1 FROM users WHERE lower(email) = $1 AND id <> $2', [email, u.id])) throw new HttpError(409, 'Diese E-Mail-Adresse wird bereits verwendet.');
        newEmail = email;
      }
    }
    let row;
    let mailed = false;
    try {
      // Unveränderte Adresse: eine offene Änderung verwerfen
      row = await db.one(
        // Konten ohne E-Mail melden sich übergangsweise mit „username“ an – der bleibt dann unverändert
        `UPDATE users SET display_name = $2, username = CASE WHEN email IS NULL THEN username ELSE $2 END, color = $3, notify_email = $4,
                pending_email = CASE WHEN $5::boolean THEN NULL ELSE pending_email END
          WHERE id = $1 RETURNING *`, [u.id, displayName, color, notifyEmail, body.email !== undefined && !newEmail]);
      // Geänderte E-Mail-Adresse wird erst nach Bestätigung übernommen
      if (newEmail) {
        const token = await auth.createToken(u.id, 'email-change', 24, newEmail);
        try {
          await mail.send(newEmail, 'Neue E-Mail-Adresse bestätigen', 'Neue E-Mail-Adresse bestätigen',
            [`Hallo ${nameOf(u)},`, 'bitte bestätige, dass diese Adresse künftig für dein Konto verwendet werden soll. Der Link ist 24 Stunden gültig.'],
            { label: 'Adresse bestätigen', url: `${await baseUrl(req)}/verify?token=${token}` });
        } catch (e) {
          await db.query(`DELETE FROM tokens WHERE user_id = $1 AND purpose = 'email-change'`, [u.id]);
          log.error('Bestätigungsmail für neue E-Mail-Adresse fehlgeschlagen', { userId: u.id, err: e });
          throw new HttpError(502, 'Die Bestätigungsmail konnte nicht gesendet werden. Name und Einstellungen sind gespeichert, die E-Mail-Adresse bleibt unverändert.');
        }
        row = await db.one('UPDATE users SET pending_email = $2 WHERE id = $1 RETURNING *', [u.id, newEmail]);
        mailed = true;
      }
    } finally {
      auth.invalidateUser(u.id);
    }
    json(res, 200, { user: auth.publicUser(row), mailed });
  });

  r.route('POST', '/api/auth/password', async (req, res) => {
    const u = await auth.requireUser(req);
    auth.rateLimit('pw:' + u.id, 10, 10 * 60000);
    if (u.password_hash === auth.EXTERNAL_HASH) throw new HttpError(400, 'Dein Kennwort wird beim Anmeldedienst deiner Organisation verwaltet.');
    const body = await readJson(req);
    if (!(await auth.verifyPassword(String(body.current || ''), u.password_hash))) throw new HttpError(400, 'Das aktuelle Kennwort ist falsch.');
    const pw = await checkPassword(body.password, await passwordRules({ username: u.display_name || u.username, email: u.email }));
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
    const user = login && await db.one(`SELECT * FROM users WHERE lower(email) = lower($1) AND status <> 'disabled' AND role <> 'guest'`, [login]);
    // Lokale Kennwörter gibt es nur, wo sie auch gelten
    const local = user && user.password_hash !== auth.EXTERNAL_HASH && ((await settings.get()).auth.localLogin === 'all' || user.role === 'admin');
    if (local) {
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
    if (user.password_hash === auth.EXTERNAL_HASH) throw new HttpError(400, 'Dein Kennwort wird beim Anmeldedienst deiner Organisation verwaltet.');
    let pw;
    try {
      pw = await checkPassword(body.password, await passwordRules({ username: user.display_name || user.username, email: user.email }));
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
    const url = totp.otpauthUrl(secret, u.email || u.display_name || u.username, s.general.siteName || 'vibeboard');
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
}

module.exports = { register, baseUrl, sendVerification, passwordRules, notifyAdminsAboutPending };
