'use strict';
// Anmeldung über Keycloak (OpenID Connect, Authorization Code Flow mit PKCE)
const crypto = require('crypto');
const { HttpError } = require('./http');

const TIMEOUT = 8000;
const CACHE_MS = 3600000;
const STATE_MS = 10 * 60000;
const MAX_STATES = 10000;
const CLOCK_SKEW = 60;

const ALGS = {
  RS256: { hash: 'sha256' }, RS384: { hash: 'sha384' }, RS512: { hash: 'sha512' },
  PS256: { hash: 'sha256', pss: true }, PS384: { hash: 'sha384', pss: true }, PS512: { hash: 'sha512', pss: true },
  ES256: { hash: 'sha256', ec: true }, ES384: { hash: 'sha384', ec: true }, ES512: { hash: 'sha512', ec: true },
  EdDSA: { hash: null },
};

const b64 = (buf) => buf.toString('base64url');
const sha256 = (s) => crypto.createHash('sha256').update(s).digest();
const stripSlash = (s) => String(s).replace(/\/+$/, '');

async function getJson(url, init) {
  const res = await fetch(url, { ...init, redirect: 'error', signal: AbortSignal.timeout(TIMEOUT) });
  if (!res.ok) throw new Error(`Antwort ${res.status} von ${new URL(url).host}`);
  return res.json();
}

let meta = null; // { key, at, doc, jwks }

async function discover(cfg, { fresh = false } = {}) {
  const key = stripSlash(cfg.issuer);
  if (!fresh && meta && meta.key === key && Date.now() - meta.at < CACHE_MS) return meta;
  const doc = await getJson(`${key}/.well-known/openid-configuration`);
  if (stripSlash(doc.issuer) !== key) throw new Error('Der Dienst nennt einen anderen Aussteller als eingetragen.');
  meta = { key, at: Date.now(), doc, jwks: await getJson(doc.jwks_uri) };
  return meta;
}

function verifySignature(token, jwks) {
  const parts = String(token).split('.');
  if (parts.length !== 3) throw new Error('Token hat ein falsches Format');
  const header = JSON.parse(Buffer.from(parts[0], 'base64url'));
  // Nur Verfahren mit öffentlichem Schlüssel – „none“ und HMAC wären vom Client frei wählbar
  const alg = Object.hasOwn(ALGS, header.alg) ? ALGS[header.alg] : null;
  if (!alg) throw new Error('Signaturverfahren nicht erlaubt');
  const jwk = jwks.keys.find((k) => k.kid === header.kid && k.use !== 'enc');
  if (!jwk) return null;
  const key = crypto.createPublicKey({ key: jwk, format: 'jwk' });
  const options = { key, ...(alg.pss ? { padding: crypto.constants.RSA_PKCS1_PSS_PADDING, saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST } : {}), ...(alg.ec ? { dsaEncoding: 'ieee-p1363' } : {}) };
  const ok = crypto.verify(alg.hash, Buffer.from(`${parts[0]}.${parts[1]}`), options, Buffer.from(parts[2], 'base64url'));
  if (!ok) throw new Error('Signatur ungültig');
  return JSON.parse(Buffer.from(parts[1], 'base64url'));
}

async function verifiedClaims(cfg, token) {
  const m = await discover(cfg);
  const claims = verifySignature(token, m.jwks);
  if (claims) return claims;
  // Unbekannte Schlüsselkennung: Der Dienst hat vermutlich seine Schlüssel gewechselt
  const again = verifySignature(token, (await discover(cfg, { fresh: true })).jwks);
  if (!again) throw new Error('Signaturschlüssel unbekannt');
  return again;
}

function checkIdToken(cfg, claims, nonce) {
  const now = Date.now() / 1000;
  const aud = [].concat(claims.aud || []);
  if (stripSlash(claims.iss) !== stripSlash(cfg.issuer)) throw new Error('Falscher Aussteller');
  if (!aud.includes(cfg.clientId)) throw new Error('Token ist nicht für diese Anwendung ausgestellt');
  if (aud.length > 1 && claims.azp !== cfg.clientId) throw new Error('Token ist nicht für diese Anwendung ausgestellt');
  if (typeof claims.exp !== 'number' || claims.exp < now - CLOCK_SKEW) throw new Error('Token ist abgelaufen');
  if (typeof claims.iat !== 'number' || claims.iat > now + CLOCK_SKEW) throw new Error('Token liegt in der Zukunft');
  if (!claims.sub) throw new Error('Token ohne Kennung');
  const given = Buffer.from(String(claims.nonce || ''));
  const want = Buffer.from(nonce);
  if (given.length !== want.length || !crypto.timingSafeEqual(given, want)) throw new Error('Nonce stimmt nicht');
}

/* Laufende Anmeldungen: nur im Speicher, wie die Zwei-Faktor-Tickets. Die Anwendung läuft mit genau einer Instanz. */
const pending = new Map();

function prune() {
  const now = Date.now();
  for (const [k, v] of pending) if (v.expires < now) pending.delete(k);
  if (pending.size > MAX_STATES) pending.clear();
}

async function start(cfg, redirectUri, next) {
  const { doc } = await discover(cfg);
  prune();
  const browser = b64(crypto.randomBytes(32));
  const state = b64(crypto.randomBytes(32));
  const nonce = b64(crypto.randomBytes(32));
  const verifier = b64(crypto.randomBytes(48));
  pending.set(state, { browser: sha256(browser), nonce, verifier, redirectUri, next, expires: Date.now() + STATE_MS });
  const url = new URL(doc.authorization_endpoint);
  const params = {
    response_type: 'code', client_id: cfg.clientId, redirect_uri: redirectUri, scope: cfg.scopes, state, nonce,
    code_challenge: b64(sha256(verifier)), code_challenge_method: 'S256',
  };
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return { url: url.href, browser, ttl: STATE_MS / 1000 };
}

// Einmalig einlösbar und an den Browser gebunden, der die Anmeldung begonnen hat (Schutz vor Login-CSRF)
function takeState(state, browser) {
  const p = pending.get(String(state));
  if (!p) return null;
  pending.delete(String(state));
  if (p.expires < Date.now() || !browser || !crypto.timingSafeEqual(p.browser, sha256(String(browser)))) return null;
  return p;
}

function rolesOf(claims, clientId) {
  const client = claims.resource_access && claims.resource_access[clientId];
  return [claims.roles, claims.groups, claims.realm_access && claims.realm_access.roles, client && client.roles]
    .flatMap((v) => (Array.isArray(v) ? v : [])).map((r) => String(r).replace(/^\//, ''));
}

async function finish(cfg, code, p) {
  const { doc } = await discover(cfg);
  const body = new URLSearchParams({ grant_type: 'authorization_code', code: String(code), redirect_uri: p.redirectUri, client_id: cfg.clientId, code_verifier: p.verifier });
  const headers = { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' };
  if (cfg.clientSecret) headers.Authorization = 'Basic ' + Buffer.from(`${encodeURIComponent(cfg.clientId)}:${encodeURIComponent(cfg.clientSecret)}`).toString('base64');
  const tokens = await getJson(doc.token_endpoint, { method: 'POST', headers, body });
  const claims = await verifiedClaims(cfg, tokens.id_token);
  checkIdToken(cfg, claims, p.nonce);
  // Keycloak legt Rollen standardmäßig nur im Access Token ab; es wird genauso geprüft, aber nur dafür gelesen
  let access = {};
  if (tokens.access_token && String(tokens.access_token).split('.').length === 3) {
    const c = await verifiedClaims(cfg, tokens.access_token).catch(() => null);
    if (c && stripSlash(c.iss) === stripSlash(cfg.issuer)) access = c;
  }
  const roles = new Set([...rolesOf(claims, cfg.clientId), ...rolesOf(access, cfg.clientId)]);
  const email = String(claims.email || access.email || '').trim();
  return {
    provider: 'oidc', externalId: String(claims.sub), email,
    emailVerified: claims.email_verified === true || cfg.trustUnverifiedEmail,
    name: String(claims.name || claims.preferred_username || '').trim(),
    allowed: !cfg.requiredRole || roles.has(cfg.requiredRole.replace(/^\//, '')),
    isAdmin: cfg.adminRole ? roles.has(cfg.adminRole.replace(/^\//, '')) : undefined,
  };
}

async function logoutUrl(cfg, postLogout) {
  const { doc } = await discover(cfg);
  if (!doc.end_session_endpoint) return null;
  const url = new URL(doc.end_session_endpoint);
  url.searchParams.set('client_id', cfg.clientId);
  url.searchParams.set('post_logout_redirect_uri', postLogout);
  return url.href;
}

async function test(cfg) {
  const m = await discover(cfg, { fresh: true });
  if (!m.jwks.keys || !m.jwks.keys.length) throw new HttpError(400, 'Der Dienst nennt keine Signaturschlüssel.');
  return [{ ok: true, text: 'Dienst erreichbar', details: { issuer: m.doc.issuer, keys: m.jwks.keys.length } }];
}

module.exports = { start, takeState, finish, logoutUrl, test };
