'use strict';
// Passwörter, Sessions, Einmal-Tokens, Rate-Limits
const crypto = require('crypto');
const db = require('./db');
const { HttpError, parseCookies, isHttps } = require('./http');

const COOKIE = 'dlz_sid';
const SESSION_DAYS = 30;
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };

/* ---------------- Passwörter ---------------- */

function scrypt(password, salt, { N, r, p, keylen }) {
  return new Promise((resolve, reject) =>
    crypto.scrypt(password, salt, keylen, { N, r, p, maxmem: 64 * 1024 * 1024 }, (err, key) => (err ? reject(err) : resolve(key))));
}

async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(password, salt, SCRYPT);
  return ['scrypt', SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString('base64'), key.toString('base64')].join('$');
}

async function verifyPassword(password, stored) {
  const [alg, N, r, p, salt, hash] = String(stored || '').split('$');
  if (alg !== 'scrypt') return false;
  const expected = Buffer.from(hash, 'base64');
  const key = await scrypt(password, Buffer.from(salt, 'base64'), { N: +N, r: +r, p: +p, keylen: expected.length });
  return key.length === expected.length && crypto.timingSafeEqual(key, expected);
}

// Für unbekannte Benutzer trotzdem rechnen, damit die Antwortzeit nichts verrät
let dummyHash = null;
async function burnTime(password) {
  dummyHash = dummyHash || (await hashPassword('dummy-password'));
  await verifyPassword(password, dummyHash);
}

/* ---------------- Validierung ---------------- */

function validateUsername(u) {
  u = String(u || '').trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{2,31}$/.test(u)) throw new HttpError(400, 'Der Benutzername muss 3–32 Zeichen lang sein und darf nur Buchstaben, Ziffern, Punkt, Binde- und Unterstrich enthalten.');
  return u;
}

function validatePassword(p) {
  p = String(p || '');
  if (p.length < 8) throw new HttpError(400, 'Das Kennwort muss mindestens 8 Zeichen lang sein.');
  if (p.length > 200) throw new HttpError(400, 'Das Kennwort ist zu lang.');
  return p;
}

function validateEmail(e, required) {
  e = String(e || '').trim();
  if (!e) {
    if (required) throw new HttpError(400, 'Bitte eine E-Mail-Adresse angeben.');
    return null;
  }
  if (e.length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) throw new HttpError(400, 'Die E-Mail-Adresse ist ungültig.');
  return e;
}

const COLORS = ['#e64980', '#4262ff', '#12b886', '#f59f00', '#7048e8', '#f03e3e', '#1098ad', '#5c940d', '#d6336c', '#364fc7'];
const randomColor = () => COLORS[crypto.randomInt(COLORS.length)];

function publicUser(u) {
  if (!u) return null;
  return {
    id: String(u.id),
    username: u.username,
    displayName: u.display_name || u.username,
    email: u.email || '',
    color: u.color,
    role: u.role,
    status: u.status,
    createdAt: u.created_at,
    lastLoginAt: u.last_login_at,
  };
}

/* ---------------- Sessions ---------------- */

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
const sessionCache = new Map(); // token_hash -> { user, until }

async function createSession(res, req, userId) {
  const token = crypto.randomBytes(32).toString('base64url');
  const expires = new Date(Date.now() + SESSION_DAYS * 86400000);
  await db.query('INSERT INTO sessions (token_hash, user_id, expires_at, user_agent) VALUES ($1, $2, $3, $4)',
    [sha256(token), userId, expires, String(req.headers['user-agent'] || '').slice(0, 300)]);
  await db.query('UPDATE users SET last_login_at = now() WHERE id = $1', [userId]);
  setCookie(res, req, token, SESSION_DAYS * 86400);
}

function setCookie(res, req, value, maxAge) {
  const parts = [`${COOKIE}=${value}`, 'Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${maxAge}`];
  if (isHttps(req)) parts.push('Secure');
  const prev = res.getHeader('Set-Cookie');
  res.setHeader('Set-Cookie', [...(prev ? [].concat(prev) : []), parts.join('; ')]);
}

async function currentUser(req) {
  if (req._user !== undefined) return req._user;
  const token = parseCookies(req)[COOKIE];
  req._user = null;
  if (!token) return null;
  const h = sha256(token);
  const hit = sessionCache.get(h);
  if (hit && hit.until > Date.now()) return (req._user = hit.user);
  const row = await db.one(
    `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = $1 AND s.expires_at > now() AND u.status = 'active'`, [h]);
  if (row) {
    sessionCache.set(h, { user: row, until: Date.now() + 30000 });
    if (sessionCache.size > 5000) sessionCache.clear();
  }
  req._user = row;
  return row;
}

async function destroySession(req, res) {
  const token = parseCookies(req)[COOKIE];
  if (token) {
    const h = sha256(token);
    sessionCache.delete(h);
    await db.query('DELETE FROM sessions WHERE token_hash = $1', [h]);
  }
  setCookie(res, req, '', 0);
}

// Nach Änderungen an einem Benutzer (Rolle, Status, Profil) zwischengespeicherte Sessions verwerfen
function invalidateUser(userId) {
  for (const [k, v] of sessionCache) if (String(v.user.id) === String(userId)) sessionCache.delete(k);
}

async function destroyUserSessions(userId, exceptReq) {
  const keep = exceptReq ? sha256(parseCookies(exceptReq)[COOKIE] || '') : '';
  await db.query('DELETE FROM sessions WHERE user_id = $1 AND token_hash <> $2', [userId, keep]);
  invalidateUser(userId);
}

async function requireUser(req) {
  const u = await currentUser(req);
  if (!u) throw new HttpError(401, 'Bitte melde dich an.');
  return u;
}

async function requireAdmin(req) {
  const u = await requireUser(req);
  if (u.role !== 'admin') throw new HttpError(403, 'Nur für Administratoren.');
  return u;
}

/* ---------------- Einmal-Tokens (Passwort zurücksetzen) ---------------- */

async function createToken(userId, purpose, hours) {
  const token = crypto.randomBytes(32).toString('base64url');
  await db.query('DELETE FROM tokens WHERE user_id = $1 AND purpose = $2', [userId, purpose]);
  await db.query('INSERT INTO tokens (token_hash, user_id, purpose, expires_at) VALUES ($1, $2, $3, now() + $4 * interval \'1 hour\')',
    [sha256(token), userId, purpose, hours]);
  return token;
}

async function consumeToken(token, purpose) {
  const row = await db.one('DELETE FROM tokens WHERE token_hash = $1 AND purpose = $2 RETURNING user_id, expires_at', [sha256(String(token || '')), purpose]);
  if (!row || new Date(row.expires_at) < new Date()) return null;
  return row.user_id;
}

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
  hashPassword, verifyPassword, burnTime, validateUsername, validatePassword, validateEmail, randomColor, publicUser,
  createSession, currentUser, destroySession, destroyUserSessions, invalidateUser, requireUser, requireAdmin,
  createToken, consumeToken, rateLimit, COOKIE,
};
