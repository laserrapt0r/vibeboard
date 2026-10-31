'use strict';
const log = require('../log').child('sso');
// Browser-Abläufe der externen Anmeldung. Fehler führen immer zurück zur Anmeldeseite (nur ein fester Code in der Adresse).
const auth = require('../auth');
const settings = require('../settings');
const audit = require('../audit');
const identity = require('../identity');
const oidc = require('../oidc');
const ldap = require('../ldap');
const kerberos = require('../kerberos');
const saml = require('../saml');
const { baseUrl } = require('./auth');
const crypto = require('crypto');
const { parseCookies, clientIp, redirect, readBody, isHttps } = require('../http');

const STATE_COOKIE = 'vb_sso';
const CODES = new Set(['kerberos', 'no_email', 'unverified_email', 'admin_link', 'no_account', 'disabled', 'pending', 'denied']);

// Nur Pfade innerhalb der Anwendung als Ziel – sonst ließe sich die Anmeldung als Weiterleitung missbrauchen
function safeNext(v) {
  const s = String(v || '/');
  return /^\/(?![/\\])[^\s]*$/.test(s) ? s : '/';
}

const noStore = (res) => res.setHeader('Cache-Control', 'no-store');

function toLogin(res, code, next) {
  const q = new URLSearchParams({ sso_error: CODES.has(code) ? code : 'failed' });
  if (next && next !== '/') q.set('next', next);
  redirect(res, '/login?' + q);
}

async function complete(req, res, id, next) {
  const user = await identity.resolve(req, id);
  const method = id.provider === 'ldap' ? 'kerberos' : id.provider;
  // Ein eingerichteter zweiter Faktor gilt auch hier: Die Anmeldeseite fragt ihn ab und führt dann weiter
  const ticket = identity.needsMfa(user, method);
  if (ticket) return redirect(res, '/login?' + new URLSearchParams({ mfa: ticket, next }));
  await identity.startSession(req, res, user, method);
  redirect(res, next);
}

const failed = (req, res, provider, e, next) => {
  if (e.status && e.status < 500) {
    audit.log(req, 'login_failed', { details: { provider, reason: e.code || 'denied' } });
    log.info('Externe Anmeldung abgelehnt', { provider, reason: e.code || e.status });
  } else {
    log.warn('Externe Anmeldung fehlgeschlagen', { provider, err: e });
  }
  toLogin(res, e.status === 429 ? 'failed' : e.code, next);
};

async function logoutRedirect(req) {
  const s = await settings.get();
  if (!s.oidc.enabled) return null;
  try {
    return await oidc.logoutUrl(s.oidc, `${await baseUrl(req)}/login?loggedout=1`);
  } catch (e) {
    log.warn('Abmeldung beim Anmeldedienst nicht möglich', { err: e });
    return null;
  }
}

// Browsern ohne Kerberos zeigt die 401-Antwort diese Seite: Sie führt zurück zur normalen Anmeldung
const fallbackPage = (url) => `<!doctype html><html><head><meta charset="utf-8"><title>vibeboard</title><meta http-equiv="refresh" content="0;url=${url}"></head><body><a href="${url}">Login</a></body></html>`;

/* SAML antwortet per POST von einer fremden Seite: Dafür braucht das Cookie SameSite=None (nur unter HTTPS möglich) */
const samlPending = new Map();
const SAML_MS = 10 * 60000;

function samlRelay(next, browser) {
  const now = Date.now();
  for (const [k, v] of samlPending) if (v.expires < now) samlPending.delete(k);
  const key = crypto.randomBytes(24).toString('base64url');
  samlPending.set(key, { next, browser: auth.sha256(browser), expires: now + SAML_MS });
  return key;
}

function register(r) {
  r.route('GET', '/api/auth/saml/metadata', async (req, res) => {
    const s = await settings.get();
    if (!s.saml.enabled) return toLogin(res, 'failed');
    res.writeHead(200, { 'Content-Type': 'application/samlmetadata+xml; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(saml.metadata(s.saml, await baseUrl(req)));
  });

  r.route('GET', '/api/auth/saml/start', async (req, res, { url }) => {
    noStore(res);
    const next = safeNext(url.searchParams.get('next'));
    try {
      auth.rateLimit('sso:' + clientIp(req), 60, 10 * 60000);
      const s = await settings.get();
      if (!s.saml.enabled) return toLogin(res, 'failed', next);
      const browser = crypto.randomBytes(32).toString('base64url');
      const target = await saml.start(s.saml, await baseUrl(req), samlRelay(next, browser));
      auth.setCookie(res, req, browser, SAML_MS / 1000, STATE_COOKIE, isHttps(req) ? 'None' : 'Lax');
      redirect(res, target);
    } catch (e) {
      failed(req, res, 'saml', e, next);
    }
  });

  r.route('POST', '/api/auth/saml/acs', async (req, res) => {
    noStore(res);
    let next = '/';
    try {
      auth.rateLimit('sso:' + clientIp(req), 60, 10 * 60000);
      const s = await settings.get();
      const form = new URLSearchParams(await readBody(req, 2 * 1024 * 1024));
      const relay = String(form.get('RelayState') || '');
      const p = samlPending.get(relay);
      samlPending.delete(relay);
      const cookie = parseCookies(req)[STATE_COOKIE];
      auth.setCookie(res, req, '', 0, STATE_COOKIE, isHttps(req) ? 'None' : 'Lax');
      // Nur Antworten auf eine Anmeldung, die dieser Browser selbst begonnen hat (Schutz vor Login-CSRF)
      if (!s.saml.enabled || !p || p.expires < Date.now() || !cookie || auth.sha256(cookie) !== p.browser) return toLogin(res, 'failed');
      next = p.next;
      const id = await saml.finish(s.saml, await baseUrl(req), { SAMLResponse: form.get('SAMLResponse'), RelayState: relay });
      if (!id.allowed) return toLogin(res, 'denied', next);
      await complete(req, res, id, next);
    } catch (e) {
      failed(req, res, 'saml', e, next);
    }
  });

  r.route('GET', '/api/auth/oidc/start', async (req, res, { url }) => {
    noStore(res);
    const next = safeNext(url.searchParams.get('next'));
    try {
      auth.rateLimit('sso:' + clientIp(req), 60, 10 * 60000);
      const s = await settings.get();
      if (!s.oidc.enabled) return toLogin(res, 'failed', next);
      const started = await oidc.start(s.oidc, `${await baseUrl(req)}/api/auth/oidc/callback`, next);
      auth.setCookie(res, req, started.browser, started.ttl, STATE_COOKIE);
      redirect(res, started.url);
    } catch (e) {
      failed(req, res, 'oidc', e, next);
    }
  });

  r.route('GET', '/api/auth/oidc/callback', async (req, res, { url }) => {
    noStore(res);
    let next = '/';
    try {
      auth.rateLimit('sso:' + clientIp(req), 60, 10 * 60000);
      const s = await settings.get();
      const p = oidc.takeState(url.searchParams.get('state'), parseCookies(req)[STATE_COOKIE]);
      auth.setCookie(res, req, '', 0, STATE_COOKIE);
      if (!s.oidc.enabled || !p) return toLogin(res, 'failed');
      next = p.next;
      const code = url.searchParams.get('code');
      if (!code) return toLogin(res, 'failed', next); // z. B. in Keycloak abgebrochen
      const id = await oidc.finish(s.oidc, code, p);
      if (!id.allowed) return toLogin(res, 'denied', next);
      await complete(req, res, id, next);
    } catch (e) {
      failed(req, res, 'oidc', e, next);
    }
  });

  r.route('GET', '/api/auth/kerberos', async (req, res, { url }) => {
    noStore(res);
    const next = safeNext(url.searchParams.get('next'));
    const header = String(req.headers.authorization || '');
    const token = /^Negotiate\s+([A-Za-z0-9+/=]+)$/.exec(header);
    try {
      auth.rateLimit('sso:' + clientIp(req), 60, 10 * 60000);
      const s = await settings.get();
      if (!s.kerberos.enabled) return toLogin(res, 'failed', next);
      if (!token) {
        const back = '/login?' + new URLSearchParams({ sso_error: 'kerberos', next }).toString().replace(/&/g, '&amp;');
        res.writeHead(401, { 'WWW-Authenticate': 'Negotiate', 'Content-Type': 'text/html; charset=utf-8' });
        return res.end(fallbackPage(back));
      }
      // Ein NTLM-Token kommt, wenn der Browser kein Kerberos-Ticket erhalten hat
      if (token[1].startsWith('TlRMTVNT')) return toLogin(res, 'kerberos', next);
      const { principal, response } = await kerberos.accept(s.kerberos, await baseUrl(req), token[1]);
      const short = kerberos.shortName(s.kerberos, principal);
      if (!short) return toLogin(res, 'denied', next);
      if (response) res.setHeader('WWW-Authenticate', 'Negotiate ' + response);
      if (s.ldap.enabled) {
        // Mit Verzeichnis: dieselbe Identität wie bei der LDAP-Anmeldung, samt Adresse, Name und Gruppen
        const id = await ldap.lookup(s.ldap, principal) || await ldap.lookup(s.ldap, short);
        if (!id || !id.allowed) return toLogin(res, 'denied', next);
        return await complete(req, res, id, next);
      }
      if (!s.kerberos.emailDomain) return toLogin(res, 'denied', next);
      await complete(req, res, { provider: 'kerberos', externalId: principal, name: short, emailVerified: true, email: `${short}@${s.kerberos.emailDomain}` }, next);
    } catch (e) {
      failed(req, res, 'kerberos', e, next);
    }
  });
}

module.exports = { register, logoutRedirect };
