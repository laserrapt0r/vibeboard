'use strict';
/*
 * vibeboard – kollaboratives Online-Whiteboard
 * HTTP-Server: statische Dateien, REST-API, Echtzeit über Server-Sent Events (mit Long-Polling als Rückfall),
 * Datenhaltung in PostgreSQL, Benutzerkonten mit Sessions.
 */
const http = require('http');
const os = require('os');
const path = require('path');
const db = require('./lib/db');
const auth = require('./lib/auth');
const boards = require('./lib/boards');
const setup = require('./lib/setup');
const { Router } = require('./lib/router');
const { HttpError, json, redirect, serveFile, serveStatic, isHttps } = require('./lib/http');
const pkg = require('./package.json');

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const PUBLIC_DIR = path.join(__dirname, 'public');

// Pflicht-Header für ändernde API-Aufrufe (CSRF-Schutz): Fremdseiten können ihn ohne CORS-Freigabe nicht setzen
const CSRF_HEADER = 'x-vibeboard';

const router = new Router();
require('./lib/routes/auth').register(router);
require('./lib/routes/boards').register(router);
require('./lib/routes/admin').register(router);
require('./lib/routes/legal').register(router);

// Netzwerkadressen für den Teilen-Dialog – nur für angemeldete Nutzer
router.route('GET', '/api/info', async (req, res) => {
  await auth.requireUser(req);
  const addresses = Object.values(os.networkInterfaces()).flat()
    .filter((a) => a && a.family === 'IPv4' && !a.internal).map((a) => a.address);
  json(res, 200, { name: 'vibeboard', version: pkg.version, addresses });
});

router.route('GET', '/healthz', async (req, res) => json(res, 200, { ok: true }));

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'", // Inline-Stile für dynamische Positionen/Farben
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "media-src 'none'",
  "object-src 'none'",
  "frame-src 'none'",
  "frame-ancestors 'none'",
  "base-uri 'none'",
  "form-action 'self'",
].join('; ');

function securityHeaders(req, res) {
  res.setHeader('Content-Security-Policy', CSP);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()');
  if (isHttps(req)) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
}

const page = (name) => path.join(PUBLIC_DIR, name);
const AUTH_PAGES = ['/login', '/register', '/forgot', '/reset', '/verify'];

async function handlePage(req, res, url) {
  const p = url.pathname;
  if (req.method !== 'GET' && req.method !== 'HEAD') throw new HttpError(405, 'Methode nicht erlaubt');
  const user = await auth.currentUser(req);
  const toLogin = () => redirect(res, '/login?next=' + encodeURIComponent(p + url.search));
  const noStore = { 'Cache-Control': 'no-store' };

  // Impressum und Datenschutzerklärung müssen ohne Anmeldung erreichbar sein
  if (p === '/impressum' || p === '/datenschutz') return serveFile(res, page('legal.html'));
  if (AUTH_PAGES.includes(p)) {
    if (user && ['/login', '/register'].includes(p)) return redirect(res, '/');
    return serveFile(res, page('auth.html'), noStore);
  }
  if (p === '/' || p === '/index.html') return user ? serveFile(res, page('index.html'), noStore) : toLogin();
  if (/^\/board\/[^/]+$/.test(p)) return user ? serveFile(res, page('board.html'), noStore) : toLogin();
  if (p === '/admin') {
    if (!user) return toLogin();
    if (user.role !== 'admin') return redirect(res, '/');
    return serveFile(res, page('admin.html'), noStore);
  }
  if (p.endsWith('.html')) return redirect(res, '/');
  return serveStatic(res, PUBLIC_DIR, p);
}

const server = http.createServer(async (req, res) => {
  securityHeaders(req, res);
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname.startsWith('/api/') || url.pathname === '/healthz') {
      if (req.method !== 'GET' && req.method !== 'HEAD' && req.headers[CSRF_HEADER] !== '1') {
        throw new HttpError(403, 'Anfrage abgelehnt (CSRF-Schutz).');
      }
      const m = router.match(req.method, url.pathname);
      if (!m) throw new HttpError(404, 'Nicht gefunden');
      if (m.methodNotAllowed) throw new HttpError(405, 'Methode nicht erlaubt');
      if (m.badRequest) throw new HttpError(400, 'Ungültige Adresse');
      return await m.handler(req, res, { params: m.params, url });
    }
    return await handlePage(req, res, url);
  } catch (e) {
    if (!e.status) console.error(e);
    if (!res.headersSent) json(res, e.status || 500, e.status ? { error: e.message, ...(e.code ? { code: e.code } : {}) } : { error: 'Interner Serverfehler' });
    else res.end();
  }
});

// Schutz gegen langsame Verbindungen (Slowloris): Kopfzeilen und Anfragekörper müssen zügig ankommen.
// Lange Antworten (Echtzeit-Stream, Long-Polling) sind davon nicht betroffen.
server.headersTimeout = 20000;
server.requestTimeout = 60000;
server.keepAliveTimeout = 65000;
server.maxHeadersCount = 100;

async function start() {
  await db.waitForDb();
  await db.migrate();
  await setup.seedAdmin();
  await setup.importLegacy(DATA_DIR);
  setup.scheduleCleanup();
  server.listen(PORT, HOST, () => {
    console.log(`vibeboard ${pkg.version} läuft auf http://localhost:${PORT}`);
  });
}

let stopping = false;
async function shutdown() {
  if (stopping) return;
  stopping = true;
  console.log('Beende – speichere offene Änderungen …');
  server.close();
  for (const id of [...boards.rooms.keys()]) boards.closeRoom(id);
  try {
    await boards.flushAll();
    await db.pool.end();
  } catch (e) {
    console.error(e.message);
  }
  process.exit(0);
}
process.on('unhandledRejection', (e) => console.error('Unbehandelter Fehler:', e));
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

start().catch((e) => {
  console.error('Start fehlgeschlagen:', e.message);
  process.exit(1);
});
