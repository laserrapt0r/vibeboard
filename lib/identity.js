'use strict';
const log = require('./log').child('identity');
// Externe Identitäten (Keycloak, LDAP, Kerberos): Konto finden, verknüpfen oder anlegen und Angaben abgleichen
const db = require('./db');
const auth = require('./auth');
const settings = require('./settings');
const audit = require('./audit');
const invites = require('./invites');
const i18n = require('./i18n');
const { HttpError } = require('./http');

const PROVISION_LOCK = 72617002;
const LABEL = { oidc: 'Keycloak', ldap: 'LDAP', kerberos: 'Kerberos' };

const denied = (message, code) => new HttpError(403, message, code);

// Letzte aktive Administration nie durch einen Gruppenabgleich entfernen
async function lastAdmin(c, id) {
  const { n } = (await c.query(`SELECT count(*) AS n FROM users WHERE role = 'admin' AND status = 'active' AND id <> $1`, [id])).rows[0];
  return Number(n) === 0;
}

async function findOrCreate(c, s, { provider, externalId, email, emailVerified, name }) {
  const linked = (await c.query(
    `SELECT u.* FROM user_identities i JOIN users u ON u.id = i.user_id WHERE i.provider = $1 AND i.external_id = $2`, [provider, externalId])).rows[0];
  if (linked) {
    await c.query('UPDATE user_identities SET last_login_at = now() WHERE provider = $1 AND external_id = $2', [provider, externalId]);
    return { user: linked };
  }
  if (!email) throw denied('Dein Verzeichniseintrag enthält keine E-Mail-Adresse. Bitte wende dich an deine IT.', 'no_email');
  // Unbestätigte Adressen dürfen weder fremde Konten noch fremde Einladungen übernehmen
  if (!emailVerified) throw denied('Deine E-Mail-Adresse ist beim Anmeldedienst nicht bestätigt.', 'unverified_email');
  const existing = (await c.query(`SELECT * FROM users WHERE lower(email) = lower($1) AND role <> 'guest'`, [email])).rows[0];
  if (existing) {
    // Admin-Konten nur nach ausdrücklicher Freigabe: Sonst könnte ein Verzeichniseintrag Administrationsrechte übernehmen
    if (existing.role === 'admin' && !existing.external_link_ok) throw denied('Dieses Administrator-Konto ist nicht für die externe Anmeldung freigegeben.', 'admin_link');
    await c.query('INSERT INTO user_identities (provider, external_id, user_id) VALUES ($1, $2, $3)', [provider, externalId, existing.id]);
    // Unbestätigtes Konto: Jemand anderes könnte es mit dieser Adresse angelegt haben – sein Kennwort darf nicht weiter gelten
    if (!existing.email_verified_at) {
      await c.query('DELETE FROM tokens WHERE user_id = $1', [existing.id]);
      await c.query('DELETE FROM sessions WHERE user_id = $1', [existing.id]);
    }
    const row = (await c.query(
      `UPDATE users SET external_link_ok = false, password_hash = CASE WHEN email_verified_at IS NULL THEN $2 ELSE password_hash END WHERE id = $1 RETURNING *`,
      [existing.id, auth.EXTERNAL_HASH])).rows[0];
    return { user: row, linked: true };
  }
  if (s.auth.provision === 'off') throw denied('Für dich gibt es hier noch kein Konto. Bitte wende dich an einen Administrator.', 'no_account');
  const user = (await c.query(
    `INSERT INTO users (username, email, display_name, password_hash, role, status, color, email_verified_at, password_changed_at, locale)
     VALUES ($1, $2, $1, $3, 'user', $4, $5, now(), now(), $6) RETURNING *`,
    [name, email, auth.EXTERNAL_HASH, s.auth.provision === 'pending' ? 'pending' : 'active', auth.randomColor(), i18n.current()])).rows[0];
  await c.query('INSERT INTO user_identities (provider, external_id, user_id) VALUES ($1, $2, $3)', [provider, externalId, user.id]);
  return { user, created: true };
}

// Name und Adresse folgen dem Verzeichnis. Die Rolle nur bei rein externen Konten: Lokale Konten behalten die hier
// vergebene Rolle, sonst ginge ein Notzugang der Administration durch einen Gruppenabgleich verloren.
// isAdmin undefined = keine Zuordnung eingerichtet.
async function sync(c, user, { email, emailVerified, name, isAdmin }) {
  let role = user.role;
  const managed = user.password_hash === auth.EXTERNAL_HASH;
  if (managed && isAdmin === true) role = 'admin';
  else if (managed && isAdmin === false && role === 'admin') {
    if (await lastAdmin(c, user.id)) log.warn('Letzte Administration bleibt trotz fehlender Gruppe bestehen', { userId: user.id });
    else role = 'user';
  }
  let newEmail = user.email;
  if (email && emailVerified && email.toLowerCase() !== String(user.email || '').toLowerCase()) {
    const taken = (await c.query('SELECT 1 FROM users WHERE lower(email) = lower($1) AND id <> $2', [email, user.id])).rows[0];
    if (taken) log.warn('Adresse aus dem Verzeichnis gehört einem anderen Konto – bleibt unverändert', { userId: user.id });
    else newEmail = email;
  }
  return (await c.query(
    `UPDATE users SET display_name = $2, username = $2, email = $3, role = $4, email_verified_at = COALESCE(email_verified_at, now()) WHERE id = $1 RETURNING *`,
    [user.id, name, newEmail, role])).rows[0];
}

/**
 * Meldet eine extern geprüfte Identität an und liefert den Benutzer.
 * id: { provider, externalId, email, emailVerified, name, isAdmin }
 */
async function resolve(req, id) {
  const s = await settings.get();
  const name = auth.validateName(String(id.name || String(id.email || '').split('@')[0] || id.externalId).slice(0, 60));
  const result = await db.tx(async (c) => {
    // Gleichzeitige Erstanmeldungen derselben Person dürfen kein zweites Konto anlegen
    await c.query('SELECT pg_advisory_xact_lock($1)', [PROVISION_LOCK]);
    const found = await findOrCreate(c, s, { ...id, name });
    return { ...found, user: await sync(c, found.user, { ...id, name }) };
  });
  const user = result.user;
  auth.invalidateUser(user.id);
  if (result.created) audit.log(req, 'external_user_created', { userId: user.id, details: { provider: id.provider } });
  if (result.linked) audit.log(req, 'external_linked', { userId: user.id, details: { provider: id.provider } });
  if (user.status === 'disabled') throw denied('Dein Konto wurde deaktiviert.', 'disabled');
  await invites.claim(user).catch((e) => log.error('Einladungen konnten nicht eingelöst werden', { userId: user.id, err: e }));
  if (user.status === 'pending') {
    if (result.created) require('./routes/auth').notifyAdminsAboutPending(req, user).catch((e) => log.error('Admin-Benachrichtigung fehlgeschlagen', { userId: user.id, err: e }));
    throw denied('Dein Konto wartet noch auf die Freigabe durch einen Administrator.', 'pending');
  }
  if (user.locale !== i18n.current()) db.query('UPDATE users SET locale = $2 WHERE id = $1', [user.id, i18n.current()]).catch(() => {});
  return user;
}

// Sitzung erst nach dem zweiten Faktor, wenn das Konto einen hat
function needsMfa(user, method) {
  return user.totp_enabled ? auth.createMfaTicket(user.id, method) : null;
}

// Sitzung für extern angemeldete Personen: kürzer, damit im Verzeichnis gesperrte Konten bald herausfallen
async function startSession(req, res, user, method) {
  const hours = (await settings.get()).auth.sessionHours;
  await auth.createSession(res, req, user.id, { expiresAt: new Date(Date.now() + hours * 3600000), method });
  audit.log(req, 'login', { userId: user.id, details: { method } });
}

module.exports = { resolve, startSession, needsMfa, LABEL };
