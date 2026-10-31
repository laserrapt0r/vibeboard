'use strict';
// Kennwort-Hashes, Sessions, Einmal-Tokens, Zwei-Faktor-Tickets, Rate-Limits
const crypto = require('crypto');
const db = require('./db');
const settings = require('./settings');
const { HttpError, parseCookies, isHttps, clientIp } = require('./http');

const COOKIE = 'vb_sid';
const COOKIE_SECURE = '__Host-vb_sid'; // unter HTTPS: nur Secure, Pfad /, ohne Domain
const SESSION_DAYS = 30;               // absolute Gültigkeit
const SESSION_IDLE_DAYS = 14;          // Abmeldung nach Inaktivität

// scrypt-Parameter nach OWASP Password Storage Cheat Sheet (N=2^17, r=8, p=1)
const SCRYPT = { N: 131072, r: 8, p: 1, keylen: 64 };
const MAX_PARALLEL_HASHES = 2; // jede Berechnung braucht ca. 128 MB – begrenzt gegen Überlastung
const EXTERNAL_HASH = '!external'; // Konto meldet sich nur extern an; passt zu keinem Kennwort

/* ---------------- Kennwörter ---------------- */

let running = 0;
const waiting = [];

async function withSlot(fn) {
  if (running >= MAX_PARALLEL_HASHES) await new Promise((r) => waiting.push(r));
  running++;
  try {
    return await fn();
  } finally {
    running--;
    if (waiting.length) waiting.shift()();
  }
}

function scrypt(password, salt, { N, r, p, keylen }) {
  return withSlot(() => new Promise((resolve, reject) =>
    crypto.scrypt(password.normalize('NFKC'), salt, keylen, { N, r, p, maxmem: 256 * 1024 * 1024 }, (err, key) => (err ? reject(err) : resolve(key)))));
}

async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(password, salt, SCRYPT);
  return ['scrypt', SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString('base64'), key.toString('base64')].join('$');
}

async function verifyPassword(password, stored) {
  const [alg, N, r, p, salt, hash] = String(stored || '').split('$');
  if (alg !== 'scrypt' || !hash) return false;
  const expected = Buffer.from(hash, 'base64');
  const key = await scrypt(String(password), Buffer.from(salt, 'base64'), { N: +N, r: +r, p: +p, keylen: expected.length });
  return key.length === expected.length && crypto.timingSafeEqual(key, expected);
}

// Ältere Hashes mit schwächeren Parametern beim nächsten Login erneuern
function needsRehash(stored) {
  const [alg, N, r, p] = String(stored || '').split('$');
  return alg !== 'scrypt' || +N < SCRYPT.N || +r < SCRYPT.r || +p < SCRYPT.p;
}

// Für unbekannte Benutzer trotzdem rechnen, damit die Antwortzeit nichts verrät
let dummyHash = null;
async function burnTime(password) {
  dummyHash = dummyHash || (await hashPassword(crypto.randomBytes(16).toString('hex')));
  await verifyPassword(password, dummyHash);
}

/* ---------------- Validierung ---------------- */

// Name (Anzeigename): frei wählbar, muss nicht eindeutig sein – angemeldet wird mit der E-Mail-Adresse
function validateName(n) {
  const s = String(n || '').normalize('NFKC').replace(/[\u0000-\u001f\u007f-\u009f]/g, '').replace(/\s+/g, ' ').trim();
  if (s.length < 1 || s.length > 60) throw new HttpError(400, 'Bitte gib einen Namen mit 1 bis 60 Zeichen an.');
  return s;
}

const COLORS = ['#e64980', '#4262ff', '#12b886', '#f59f00', '#7048e8', '#f03e3e', '#1098ad', '#5c940d', '#d6336c', '#364fc7'];
const randomColor = () => COLORS[crypto.randomInt(COLORS.length)];

function publicUser(u) {
  if (!u) return null;
  return {
    id: String(u.id),
    // „username“ bleibt aus Kompatibilitätsgründen, enthält aber denselben Anzeigenamen
    username: u.display_name || u.username,
    displayName: u.display_name || u.username,
    email: u.email || '',
    emailVerified: !!u.email_verified_at,
    pendingEmail: u.pending_email || '',
    mfa: !!u.totp_enabled,
    external: u.password_hash === EXTERNAL_HASH, // Kennwort, Adresse und Zwei-Faktor liegen beim Anmeldedienst
    color: u.color,
    role: u.role,
    status: u.status,
    notifyEmail: u.notify_email !== false,
    guest: u.role === 'guest',
    guestExpiresAt: u.guest_expires_at || null,
    createdAt: u.created_at,
    lastLoginAt: u.last_login_at,
  };
}

/* ---------------- Sessions ---------------- */

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
const sessionCache = new Map(); // token_hash -> { user, until, touched }

function cookieName(req) {
  return isHttps(req) ? COOKIE_SECURE : COOKIE;
}

function readToken(req) {
  const c = parseCookies(req);
  return c[COOKIE_SECURE] || c[COOKIE] || null;
}

// expiresAt: kürzere Gültigkeit (Gastzugang endet mit seinem Link)
async function createSession(res, req, userId, { expiresAt, method = 'local' } = {}) {
  const token = crypto.randomBytes(32).toString('base64url');
  const full = new Date(Date.now() + SESSION_DAYS * 86400000);
  const expires = expiresAt && expiresAt < full ? expiresAt : full;
  await db.query('INSERT INTO sessions (token_hash, user_id, expires_at, user_agent, ip, login_method) VALUES ($1, $2, $3, $4, $5, $6)',
    [sha256(token), userId, expires, String(req.headers['user-agent'] || '').slice(0, 300), clientIp(req).slice(0, 64), method]);
  await db.query('UPDATE users SET last_login_at = now() WHERE id = $1', [userId]);
  setCookie(res, req, token, Math.max(60, Math.round((expires - Date.now()) / 1000)));
}

function setCookie(res, req, value, maxAge, name = cookieName(req), sameSite = 'Lax') {
  const parts = [`${name}=${value}`, 'Path=/', 'HttpOnly', `SameSite=${sameSite}`, `Max-Age=${maxAge}`];
  if (isHttps(req)) parts.push('Secure');
  const prev = res.getHeader('Set-Cookie');
  res.setHeader('Set-Cookie', [...(prev ? [].concat(prev) : []), parts.join('; ')]);
}

async function currentUser(req) {
  if (req._user !== undefined) return req._user;
  const token = readToken(req);
  req._user = null;
  if (!token) return null;
  const h = sha256(token);
  req._sid = h;
  const hit = sessionCache.get(h);
  if (hit && hit.until > Date.now()) return (req._user = hit.user);
  const row = await db.one(
    `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = $1 AND s.expires_at > now()
       AND s.last_seen_at > now() - $2 * interval '1 day'
       AND u.status = 'active' AND u.email_verified_at IS NOT NULL
       AND (u.role <> 'guest' OR u.guest_expires_at > now())`, [h, SESSION_IDLE_DAYS]);
  if (row) {
    sessionCache.set(h, { user: row, until: Date.now() + 30000 });
    if (sessionCache.size > 5000) sessionCache.clear();
    // Zuletzt-aktiv höchstens alle paar Minuten schreiben
    db.query(`UPDATE sessions SET last_seen_at = now(), ip = $2 WHERE token_hash = $1 AND last_seen_at < now() - interval '5 minutes'`,
      [h, clientIp(req).slice(0, 64)]).catch(() => {});
  }
  req._user = row;
  return row;
}

// Live-Verbindungen (SSE/Polling) gehören zu einer Session und werden mit ihr beendet
function kickSessions(pred) {
  require('./boards').kickSessions(pred);
}

// Wie wurde die aktuelle Sitzung angemeldet? (Abmeldung beim Anmeldedienst)
async function sessionMethod(req) {
  const token = readToken(req);
  const row = token && await db.one('SELECT login_method FROM sessions WHERE token_hash = $1', [sha256(token)]);
  return row ? row.login_method : null;
}

async function destroySession(req, res) {
  const token = readToken(req);
  if (token) {
    const h = sha256(token);
    sessionCache.delete(h);
    await db.query('DELETE FROM sessions WHERE token_hash = $1', [h]);
    kickSessions((c) => c.sid === h);
  }
  setCookie(res, req, '', 0);
}

// Nach Änderungen an einem Benutzer (Rolle, Status, Profil) zwischengespeicherte Sessions verwerfen
function invalidateUser(userId) {
  for (const [k, v] of sessionCache) if (String(v.user.id) === String(userId)) sessionCache.delete(k);
}

async function destroyUserSessions(userId, exceptReq) {
  const keep = exceptReq ? sha256(readToken(exceptReq) || '') : '';
  await db.query('DELETE FROM sessions WHERE user_id = $1 AND token_hash <> $2', [userId, keep]);
  invalidateUser(userId);
  kickSessions((c) => String(c.uid) === String(userId) && c.sid !== keep);
}

async function listSessions(userId, req) {
  const current = sha256(readToken(req) || '');
  const rows = (await db.query(
    `SELECT token_hash, created_at, last_seen_at, user_agent, ip FROM sessions
      WHERE user_id = $1 AND expires_at > now() ORDER BY last_seen_at DESC`, [userId])).rows;
  return rows.map((r) => ({
    id: r.token_hash.slice(0, 16),
    current: r.token_hash === current,
    createdAt: r.created_at,
    lastSeenAt: r.last_seen_at,
    userAgent: r.user_agent,
    ip: r.ip,
  }));
}

async function revokeSession(userId, id) {
  if (!/^[0-9a-f]{16}$/.test(String(id))) throw new HttpError(404, 'Sitzung nicht gefunden.');
  const row = await db.one('DELETE FROM sessions WHERE user_id = $1 AND left(token_hash, 16) = $2 RETURNING token_hash', [userId, id]);
  if (!row) throw new HttpError(404, 'Sitzung nicht gefunden.');
  sessionCache.delete(row.token_hash);
  kickSessions((c) => c.sid === row.token_hash);
}

// Gäste (Zugang per Gastlink) dürfen nur, was eine Route ausdrücklich erlaubt: { guests: true }
async function requireUser(req, { guests = false } = {}) {
  const u = await currentUser(req);
  if (!u) throw new HttpError(401, 'Bitte melde dich an.');
  if (u.role === 'guest' && !guests) throw new HttpError(403, 'Als Gast hast du darauf keinen Zugriff.', 'guest');
  return u;
}

async function requireAdmin(req) {
  const u = await requireUser(req);
  if (u.role !== 'admin') throw new HttpError(403, 'Nur für Administratoren.');
  // Keycloak, SAML und Kerberos bringen ihre eigene starke Anmeldung mit; LDAP prüft nur ein Kennwort und zählt daher nicht
  const strongExternal = u.password_hash === EXTERNAL_HASH && ['oidc', 'kerberos', 'saml'].includes(await sessionMethod(req));
  if ((await settings.get()).security.requireMfaAdmins && !u.totp_enabled && !strongExternal) {
    throw new HttpError(403, 'Für die Administration ist die Zwei-Faktor-Anmeldung vorgeschrieben. Bitte richte sie in deinem Profil ein.', 'mfa_required');
  }
  return u;
}

/* ---------------- Einmal-Tokens (Bestätigung, Kennwort-Reset) ---------------- */

async function createToken(userId, purpose, hours, data = null) {
  const token = crypto.randomBytes(32).toString('base64url');
  await db.query('DELETE FROM tokens WHERE user_id = $1 AND purpose = $2', [userId, purpose]);
  await db.query(`INSERT INTO tokens (token_hash, user_id, purpose, expires_at, data) VALUES ($1, $2, $3, now() + $4 * interval '1 hour', $5)`,
    [sha256(token), userId, purpose, hours, data]);
  return token;
}

// Löst einen Token einmalig ein; purposes = erlaubte Zwecke
async function consumeToken(token, purposes) {
  const row = await db.one(
    'DELETE FROM tokens WHERE token_hash = $1 AND purpose = ANY($2::text[]) RETURNING user_id, purpose, data, expires_at',
    [sha256(String(token || '')), [].concat(purposes)]);
  if (!row || new Date(row.expires_at) < new Date()) return null;
  return { userId: row.user_id, purpose: row.purpose, data: row.data };
}

/* ---------------- Zwei-Faktor-Tickets ---------------- */

// Nach korrektem Kennwort, aber vor dem zweiten Faktor: kurzlebiges Ticket statt Session
const mfaTickets = new Map(); // ticket -> { userId, exp, tries }

function createMfaTicket(userId, method = 'local') {
  const ticket = crypto.randomBytes(24).toString('base64url');
  mfaTickets.set(ticket, { userId, method, exp: Date.now() + 5 * 60000, tries: 0 });
  for (const [k, v] of mfaTickets) if (v.exp < Date.now()) mfaTickets.delete(k);
  return ticket;
}

function readMfaTicket(ticket) {
  const t = mfaTickets.get(String(ticket || ''));
  if (!t || t.exp < Date.now()) {
    mfaTickets.delete(ticket);
    throw new HttpError(401, 'Die Anmeldung ist abgelaufen. Bitte melde dich erneut an.', 'mfa_expired');
  }
  return t;
}

function failMfaTicket(ticket) {
  const t = mfaTickets.get(ticket);
  if (t && ++t.tries >= 5) mfaTickets.delete(ticket);
}

const consumeMfaTicket = (ticket) => mfaTickets.delete(ticket);

const hashRecovery = (code) => sha256(String(code || '').toLowerCase().replace(/[^a-z0-9]/g, ''));

/* ---------------- Rate-Limit (im Speicher) ---------------- */

const hits = new Map();

function rateLimit(key, max, windowMs) {
  const now = Date.now();
  let e = hits.get(key);
  if (!e || e.reset < now) {
    e = { n: 0, reset: now + windowMs };
    hits.set(key, e);
  }
  e.n++;
  if (hits.size > 10000) for (const [k, v] of hits) if (v.reset < now) hits.delete(k);
  if (e.n > max) throw new HttpError(429, 'Zu viele Versuche. Bitte warte einen Moment.');
}

module.exports = {
  hashPassword, verifyPassword, needsRehash, burnTime, validateName, randomColor, publicUser,
  createSession, currentUser, destroySession, destroyUserSessions, invalidateUser, listSessions, revokeSession,
  requireUser, requireAdmin, createToken, consumeToken, createMfaTicket, readMfaTicket, failMfaTicket, consumeMfaTicket,
  hashRecovery, rateLimit, sha256, setCookie, sessionMethod, EXTERNAL_HASH,
};
