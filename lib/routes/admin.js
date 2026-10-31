'use strict';
// Administration: Übersicht, Einstellungen, Mailserver, Benutzerverwaltung, Boards, Sicherheitsprotokoll
const crypto = require('crypto');
const db = require('../db');
const metrics = require('../metrics');
const log = require('../log');
const auth = require('../auth');
const boards = require('../boards');
const settings = require('../settings');
const trackers = require('../trackers');
const mail = require('../mail');
const audit = require('../audit');
const { checkPassword } = require('../password');
const { normalizeEmail, DISPOSABLE_COUNT } = require('../email');
const { baseUrl, sendVerification, passwordRules } = require('./auth');
const { HttpError, readJson, json, clientIp, trustInfo } = require('../http');
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
    providers: u.providers || [],
    externalLinkOk: !!u.external_link_ok,
  };
}

// Sobald externe Methoden aktiv sind, bleibt immer ein lokales Admin-Konto als Notzugang
async function assertNotLastLocalAdmin(c, user) {
  if (user.role !== 'admin' || user.status !== 'active' || user.password_hash === auth.EXTERNAL_HASH || !(await settings.ssoConfigured())) return;
  const r = (await c.query(`SELECT count(*)::int AS n FROM users WHERE role = 'admin' AND status = 'active' AND password_hash <> $1 AND id <> $2`, [auth.EXTERNAL_HASH, user.id])).rows[0];
  if (!r.n) throw new HttpError(400, 'Es muss ein aktives Administrator-Konto mit lokalem Kennwort geben (Notzugang).');
}

// Lokale Anmeldung nur für Admins setzt voraus: Es gibt einen anderen Weg für alle und einen Notzugang
async function assertLocalAdminRemains(external) {
  if (!external) throw new Error('Schalte zuerst eine externe Anmeldemethode ein.');
  const r = await db.one(`SELECT count(*)::int AS n FROM users WHERE role = 'admin' AND status = 'active' AND password_hash <> $1`, [auth.EXTERNAL_HASH]);
  if (!r.n) throw new Error('Es muss ein aktives Administrator-Konto mit lokalem Kennwort geben (Notzugang).');
}

async function sendInvite(req, user) {
  const token = await auth.createToken(user.id, 'invite', 72);
  const s = await settings.get();
  await mail.send(user, `Dein Zugang zu ${s.general.siteName}`, 'Willkommen!',
    [`Hallo ${nameOf(user)},`, `für dich wurde ein Konto angelegt. Du meldest dich mit deiner E-Mail-Adresse ${user.email} an.`, 'Lege über den folgenden Link dein Kennwort fest. Der Link ist 72 Stunden gültig.'],
    { label: 'Kennwort festlegen', url: `${await baseUrl(req)}/reset?token=${token}` });
}

// Hinweis, wenn im Protokoll vermutlich nicht die echten Adressen der Nutzenden landen
function networkHint(req) {
  const ip = clientIp(req);
  const trust = trustInfo();
  const forwarded = !!req.headers['x-forwarded-for'];
  let hint = null;
  if (trust === '0' && forwarded) hint = 'proxy';
  // Docker-Gateway (z. B. 172.20.0.1): Verbindung kam über docker-proxy oder einen Proxy auf dem Host
  else if (trust === '0' && /^(172\.(1[6-9]|2\d|3[01])|10|192\.168)\.\d+\.\d+$/.test(ip) && ip.endsWith('.1')) hint = 'gateway';
  return { ip, trust, hint };
}

function register(r) {
  r.route('GET', '/api/admin/overview', async (req, res) => {
    await auth.requireAdmin(req);
    const users = (await db.query(`SELECT status, count(*)::int AS n FROM users WHERE role <> 'guest' GROUP BY status`)).rows;
    const stats = await db.one(`SELECT
      (SELECT count(*)::int FROM boards) AS boards,
      (SELECT count(*)::int FROM elements) AS elements,
      (SELECT count(*)::int FROM sessions WHERE expires_at > now()) AS sessions,
      (SELECT count(*)::int FROM users WHERE email_verified_at IS NULL) AS unverified,
      (SELECT count(*)::int FROM users WHERE role = 'guest') AS guests,
      (SELECT count(*)::int FROM users WHERE role <> 'guest' AND email IS NULL) AS without_email,
      (SELECT count(*)::int FROM teams) AS teams,
      (SELECT count(*)::int FROM users WHERE totp_enabled) AS mfa,
      (SELECT count(*)::int FROM audit_log WHERE event IN ('login_failed', 'login_mfa_failed') AND at > now() - interval '24 hours') AS failed24h,
      (SELECT count(*)::int FROM audit_log WHERE event = 'upload_blocked' AND at > now() - interval '30 days') AS blocked30d,
      (SELECT count(*)::int FROM audit_log WHERE event = 'upload_unscanned' AND at > now() - interval '30 days') AS unscanned30d,
      pg_database_size(current_database())::bigint AS db_size,
      version() AS pg_version`);
    const s = await settings.get();
    json(res, 200, {
      version: pkg.version,
      users: Object.fromEntries(users.map((u) => [u.status, u.n])),
      unverified: stats.unverified,
      mfaUsers: stats.mfa,
      guests: stats.guests,
      withoutEmail: stats.without_email,
      network: networkHint(req),
      teams: stats.teams,
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
      uploadsUnscanned30d: stats.unscanned30d,
      requireVirusScan: s.security.requireVirusScan,
      versionHistory: await versions.history(5),
    });
  });

  // Systemmetriken (für die laufende Aktualisierung der Übersicht)
  r.route('GET', '/api/admin/metrics', async (req, res) => {
    await auth.requireAdmin(req);
    const dbStats = await db.one(`SELECT
      (SELECT count(*)::int FROM pg_stat_activity WHERE datname = current_database()) AS connections,
      (SELECT round(100.0 * sum(blks_hit) / NULLIF(sum(blks_hit) + sum(blks_read), 0), 1) FROM pg_stat_database WHERE datname = current_database()) AS cache_hit`);
    json(res, 200, {
      ...metrics.snapshot(),
      db: { connections: dbStats.connections, poolSize: Number(process.env.DB_POOL_SIZE) || 10, cacheHit: dbStats.cache_hit == null ? null : Number(dbStats.cache_hit) },
      realtime: { online: boards.totalOnline(), activeBoards: boards.rooms.size, boardsInMemory: boards.cache.size },
    });
  });

  /* ---------------- Einstellungen & Mail ---------------- */

  r.route('GET', '/api/admin/settings', async (req, res) => {
    await auth.requireAdmin(req);
    json(res, 200, { ...(await settings.forAdmin()), virusScanner: await scanner.status(), logInfo: { current: log.getLevel(), envLevel: log.envLevel, format: log.format } });
  });

  r.route('PUT', '/api/admin/settings', async (req, res) => {
    const admin = await auth.requireAdmin(req);
    const body = await readJson(req);
    try {
      // Vor dem Speichern prüfen, auch beim Abschalten einer Methode: Niemand darf ausgesperrt werden
      const cur = await settings.get();
      if ((body.auth?.localLogin ?? cur.auth.localLogin) === 'admins') {
        await assertLocalAdminRemains(['oidc', 'ldap', 'kerberos', 'saml'].some((k) => body[k]?.enabled ?? cur[k].enabled));
      }
      // Ohne Verzeichnis ist die E-Mail-Domain die Zusicherung, dass Kurzname@Domain wirklich das Postfach der Person ist
      if ((body.kerberos?.enabled ?? cur.kerberos.enabled) && !(body.ldap?.enabled ?? cur.ldap.enabled) && !(body.kerberos?.emailDomain ?? cur.kerberos.emailDomain)) {
        throw new Error('Kerberos ohne LDAP braucht die E-Mail-Domain.');
      }
      if (body.general) await settings.update('general', body.general);
      if (body.security) {
        // Sich nicht selbst aus der Administration aussperren
        if (body.security.requireMfaAdmins && !admin.totp_enabled) {
          throw new Error('Richte zuerst für dein eigenes Konto die Zwei-Faktor-Anmeldung ein.');
        }
        await settings.update('security', body.security);
      }
      if (body.collab) {
        const before = (await settings.get()).collab;
        const next = await settings.update('collab', body.collab);
        // Gastzugang abgeschaltet: alle Gastlinks sperren und laufende Gastsitzungen sofort beenden
        if (before.guestLinks && !next.guestLinks) await require('../guests').revokeAll();
      }
      if (body.legal) await settings.update('legal', body.legal);
      if (body.oidc) {
        const patch = { ...body.oidc };
        // Leeres Feld = bisheriges Geheimnis behalten
        if (!patch.clientSecret) delete patch.clientSecret;
        if (patch.clearSecret) patch.clientSecret = '';
        await settings.update('oidc', patch);
      }
      if (body.ldap) {
        const patch = { ...body.ldap };
        if (!patch.bindPassword) delete patch.bindPassword;
        if (patch.clearPassword) patch.bindPassword = '';
        await settings.update('ldap', patch);
      }
      if (body.kerberos) await settings.update('kerberos', body.kerberos);
      if (body.saml) await settings.update('saml', body.saml);
      if (body.design) await settings.update('design', body.design);
      if (body.scim) await settings.update('scim', { enabled: !!body.scim.enabled });
      if (body.auth) {
        const s = await settings.get();
        if (body.auth.autoSso && !s[body.auth.autoSso]?.enabled) throw new Error('Die automatische Weiterleitung braucht eine eingeschaltete Anmeldemethode.');
        await settings.update('auth', body.auth);
      }
      if (body.logging) {
        const next = await settings.update('logging', body.logging);
        const prev = log.getLevel();
        const target = next.level || log.envLevel;
        // Die Änderung selbst soll im Protokoll stehen – auch wenn die neue Stufe sparsamer ist
        const note = () => log.child('admin').info('Protokollstufe geändert', { from: prev, to: target, userId: admin.id });
        if (log.LEVELS.indexOf(target) > log.LEVELS.indexOf(prev)) note();
        log.setLevel(next.level);
        if (log.LEVELS.indexOf(target) <= log.LEVELS.indexOf(prev)) note();
      }
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
    audit.log(req, 'admin_settings', { actorId: admin.id, details: { sections: Object.keys(body).filter((k) => ['general', 'security', 'collab', 'legal', 'logging', 'smtp', 'auth', 'oidc', 'ldap', 'kerberos', 'saml', 'scim', 'design'].includes(k)) } });
    json(res, 200, await settings.forAdmin());
  });

  // Prüft die gespeicherten Einstellungen; Fehlertexte sind für die Administration bestimmt
  r.route('POST', '/api/admin/auth/test', async (req, res) => {
    await auth.requireAdmin(req);
    const body = await readJson(req);
    const s = await settings.get();
    let steps;
    try {
      if (body.provider === 'oidc') steps = await require('../oidc').test(s.oidc);
      else if (body.provider === 'ldap') steps = await require('../ldap').test(s.ldap, String(body.login || '').slice(0, 200));
      else if (body.provider === 'saml') steps = await require('../saml').test(s.saml, await baseUrl(req));
      else if (body.provider === 'kerberos') steps = await require('../kerberos').test(s.kerberos, await baseUrl(req));
      else throw new HttpError(400, 'Unbekannte Anmeldemethode.');
    } catch (e) {
      if (e.status && e.status !== 400) throw e;
      steps = [{ ok: false, text: 'Fehlgeschlagen', details: { error: String(e.message).slice(0, 300) } }];
    }
    json(res, 200, { steps });
  });

  // SCIM-Token: wird nur einmal angezeigt, gespeichert bleibt der Hash
  r.route('POST', '/api/admin/scim/token', async (req, res) => {
    const admin = await auth.requireAdmin(req);
    const token = crypto.randomBytes(32).toString('base64url');
    await settings.update('scim', { tokenHash: auth.sha256(token) });
    audit.log(req, 'scim_token_created', { actorId: admin.id });
    json(res, 200, { token, url: `${await baseUrl(req)}/scim/v2` });
  });

  /* ---------------- Jira und Azure DevOps ---------------- */

  r.route('GET', '/api/admin/trackers', async (req, res) => {
    await auth.requireAdmin(req);
    json(res, 200, { connections: await trackers.connections() });
  });

  r.route('POST', '/api/admin/trackers', async (req, res) => {
    const admin = await auth.requireAdmin(req);
    const id = await trackers.createConnection(admin, await readJson(req));
    audit.log(req, 'tracker_connection_created', { actorId: admin.id });
    json(res, 201, { id });
  });

  r.route('DELETE', '/api/admin/trackers/:tid', async (req, res, { params }) => {
    const admin = await auth.requireAdmin(req);
    await trackers.removeConnection(params.tid);
    audit.log(req, 'tracker_connection_removed', { actorId: admin.id });
    json(res, 200, { ok: true });
  });

  r.route('POST', '/api/admin/trackers/:tid/test', async (req, res, { params }) => {
    await auth.requireAdmin(req);
    json(res, 200, await trackers.testConnection(params.tid));
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
              (SELECT count(*)::int FROM sessions s WHERE s.user_id = u.id AND s.expires_at > now()) AS session_count,
              ARRAY(SELECT i.provider FROM user_identities i WHERE i.user_id = u.id ORDER BY i.provider) AS providers
         FROM users u
        WHERE u.role <> 'guest'
        ORDER BY (u.status = 'pending') DESC, lower(COALESCE(u.display_name, u.username))`)).rows;
    json(res, 200, rows.map(adminUser));
  });

  // Neues Konto: entweder mit Kennwort oder per Einladungslink (Kennwort legt die Person selbst fest)
  r.route('POST', '/api/admin/users', async (req, res) => {
    const admin = await auth.requireAdmin(req);
    const body = await readJson(req);
    const name = auth.validateName(body.name ?? body.displayName ?? body.username);
    // Angemeldet wird mit der E-Mail-Adresse – sie ist daher Pflicht
    const email = body.email ? normalizeEmail(body.email) : null;
    if (!email || !EMAIL_RE.test(email)) throw new HttpError(400, 'Bitte gib eine gültige E-Mail-Adresse an – mit ihr meldet sich die Person an.');
    const invite = !body.password;
    if (invite && !(await settings.mailConfigured())) throw new HttpError(400, 'Für eine Einladung muss der Mailserver eingerichtet sein – oder lege ein Kennwort fest.');
    const pw = invite ? crypto.randomBytes(32).toString('base64url') : await checkPassword(body.password, await passwordRules({ username: name, email }));
    const role = body.role === 'admin' ? 'admin' : 'user';
    let row;
    try {
      row = await db.one(
        `INSERT INTO users (username, email, display_name, password_hash, role, status, color, email_verified_at, password_changed_at)
         VALUES ($1, $2, $1, $3, $4, 'active', $5, now(), now()) RETURNING *`,
        [name, email, await auth.hashPassword(pw), role, auth.randomColor()]);
    } catch (e) {
      if (e.code === '23505') throw new HttpError(409, 'Diese E-Mail-Adresse wird bereits verwendet.');
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
    if (existing.role === 'guest') throw new HttpError(400, 'Gastzugänge werden über den Gastlink des Boards verwaltet.');
    const pwHash = body.password
      ? await auth.hashPassword(await checkPassword(body.password, await passwordRules({ username: existing.display_name || existing.username, email: existing.email || '' })))
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
      if (losesAdmin) await assertNotLastLocalAdmin(c, user);
      let email = user.email;
      if (body.email !== undefined) email = String(body.email).trim() ? normalizeEmail(body.email) : user.email ? '' : null;
      // Ohne E-Mail-Adresse wäre keine Anmeldung mehr möglich
      if (email === '') throw new HttpError(400, 'Die E-Mail-Adresse kann nicht entfernt werden – mit ihr meldet sich die Person an.');
      if (email && !EMAIL_RE.test(email)) throw new HttpError(400, 'Die E-Mail-Adresse ist ungültig.');
      const displayName = body.displayName !== undefined || body.name !== undefined ? auth.validateName(body.name ?? body.displayName) : user.display_name;
      // Vom Admin gesetzte Adresse gilt als bestätigt; „emailVerified“ bestätigt manuell
      const markVerified = body.emailVerified === true || (email && email !== user.email);
      let row;
      try {
        row = (await c.query(
          `UPDATE users SET role = $2, status = $3, email = $4, display_name = $5, username = CASE WHEN $4::text IS NULL THEN username ELSE COALESCE($5, username) END,
                  email_verified_at = CASE WHEN $6 THEN COALESCE(email_verified_at, now()) ELSE email_verified_at END,
                  pending_email = CASE WHEN $4::text IS DISTINCT FROM email THEN NULL ELSE pending_email END
            WHERE id = $1 RETURNING *`,
          [user.id, role, status, email, displayName, !!markVerified])).rows[0];
      } catch (e) {
        if (e.code === '23505') throw new HttpError(409, 'Diese E-Mail-Adresse wird bereits verwendet.');
        throw e;
      }
      if (pwHash) row = (await c.query('UPDATE users SET password_hash = $2, password_changed_at = now() WHERE id = $1 RETURNING *', [user.id, pwHash])).rows[0];
      if (body.allowExternalLink !== undefined) row = (await c.query('UPDATE users SET external_link_ok = $2 WHERE id = $1 RETURNING *', [user.id, !!body.allowExternalLink])).rows[0];
      if (body.unlinkExternal) {
        // Ohne Kennwort käme die Person danach nicht mehr ins Konto
        if (row.password_hash === auth.EXTERNAL_HASH) throw new HttpError(400, 'Dieses Konto hat kein lokales Kennwort. Lege zuerst eines fest.');
        await c.query('DELETE FROM user_identities WHERE user_id = $1', [user.id]);
      }
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
      mail.sendQuietly(row, 'Dein Konto wurde freigeschaltet', 'Willkommen!',
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
      await assertNotLastLocalAdmin(c, user);
      const owned = (await c.query('SELECT id FROM boards WHERE owner_id = $1', [user.id])).rows.map((x) => x.id);
      if (!deleteBoards) await c.query('UPDATE boards SET owner_id = $2 WHERE owner_id = $1', [user.id, admin.id]);
      // Teams, die nur diese Person verwaltet: das am längsten dabei befindliche Mitglied übernimmt; leere Teams entfallen
      await c.query(
        `UPDATE team_members tm SET role = 'admin'
           FROM (SELECT DISTINCT ON (x.team_id) x.team_id, x.user_id FROM team_members x
                  WHERE x.user_id <> $1 AND x.team_id IN (
                        SELECT team_id FROM team_members WHERE user_id = $1 AND role = 'admin'
                        EXCEPT SELECT team_id FROM team_members WHERE role = 'admin' AND user_id <> $1)
                  ORDER BY x.team_id, x.added_at) n
          WHERE tm.team_id = n.team_id AND tm.user_id = n.user_id`, [user.id]);
      await c.query(`DELETE FROM teams WHERE id IN (SELECT team_id FROM team_members WHERE user_id = $1)
                       AND NOT EXISTS (SELECT 1 FROM team_members WHERE team_id = teams.id AND user_id <> $1)`, [user.id]);
      await c.query('DELETE FROM users WHERE id = $1', [user.id]);
      return { user, owned };
    });
    boards.kickUser(null, user.id, 'disabled');
    if (deleteBoards) for (const id of owned) await boards.remove(id);
    auth.invalidateUser(user.id);
    audit.log(req, 'admin_user_deleted', { actorId: admin.id, details: { name: user.display_name || user.username, boards: owned.length, deletedBoards: deleteBoards } });
    json(res, 200, { ok: true, boards: owned.length, deletedBoards: deleteBoards });
  });

  // Link zum Zurücksetzen des Kennworts erzeugen (per Mail oder zum Weitergeben)
  r.route('POST', '/api/admin/users/:uid/reset-link', async (req, res, { params }) => {
    const admin = await auth.requireAdmin(req);
    checkUid(params.uid);
    const user = await db.one('SELECT * FROM users WHERE id = $1', [params.uid]);
    if (!user) throw new HttpError(404, 'Benutzer nicht gefunden.');
    if (user.password_hash === auth.EXTERNAL_HASH) throw new HttpError(400, 'Das Kennwort dieses Kontos wird beim Anmeldedienst verwaltet.');
    const token = await auth.createToken(user.id, 'reset', 24);
    const link = `${await baseUrl(req)}/reset?token=${token}`;
    audit.log(req, 'admin_user_updated', { userId: user.id, actorId: admin.id, details: { changes: ['reset-link'] } });
    if (user.email && (await settings.mailConfigured())) {
      try {
        await mail.send(user, 'Kennwort festlegen', 'Kennwort festlegen',
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
              COALESCE(u.display_name, u.username) AS user_name, COALESCE(ac.display_name, ac.username) AS actor_name, u.email AS user_email
         FROM audit_log a
         LEFT JOIN users u ON u.id = a.user_id
         LEFT JOIN users ac ON ac.id = a.actor_id
        WHERE ($1::bigint IS NULL OR a.id < $1)
          AND ($2::text IS NULL OR a.event = $2)
          AND ($3 = '' OR u.display_name ILIKE '%' || $3 || '%' OR u.email ILIKE '%' || $3 || '%' OR ac.display_name ILIKE '%' || $3 || '%' OR a.ip ILIKE $3 || '%')
        ORDER BY a.id DESC LIMIT $4`, [before, event, q.replace(/[%_\\]/g, '\\$&'), limit])).rows;
    json(res, 200, { events: audit.LABELS, entries: rows.map((e) => ({ ...e, id: String(e.id), label: audit.LABELS[e.event] || e.event })) });
  });

  /* ---------------- Boards ---------------- */

  r.route('GET', '/api/admin/boards', async (req, res) => {
    await auth.requireAdmin(req);
    const rows = (await db.query(
      `SELECT b.id, b.name, b.link_access, b.created_at, b.updated_at, b.owner_id, COALESCE(o.display_name, o.username) AS owner,
              (SELECT count(*)::int FROM elements e WHERE e.board_id = b.id) AS elements,
              (SELECT count(*)::int FROM board_members m WHERE m.board_id = b.id) AS members, b.deleted_at
         FROM boards b LEFT JOIN users o ON o.id = b.owner_id ORDER BY b.updated_at DESC`)).rows;
    json(res, 200, rows.map((b) => ({
      id: b.id, name: boards.cache.get(b.id)?.name || b.name, linkAccess: b.link_access, owner: b.owner, ownerId: b.owner_id && String(b.owner_id),
      elements: boards.cache.get(b.id)?.elements.size ?? b.elements, members: b.members, online: boards.onlineCount(b.id),
      createdAt: b.created_at, updatedAt: b.updated_at, deletedAt: b.deleted_at,
    })));
  });

  r.route('PATCH', '/api/admin/boards/:id', async (req, res, { params }) => {
    const admin = await auth.requireAdmin(req);
    const body = await readJson(req);
    if (body.ownerId) {
      checkUid(body.ownerId);
      const u = await db.one(`SELECT id FROM users WHERE id = $1 AND role <> 'guest'`, [body.ownerId]);
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
