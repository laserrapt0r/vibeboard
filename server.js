'use strict';
/*
 * vibeboard – kollaboratives Online-Whiteboard
 * HTTP-Server: statische Dateien, REST-API, Echtzeit über Server-Sent Events (mit Long-Polling als Rückfall),
 * Datenhaltung in PostgreSQL, Benutzerkonten mit Sessions.
 */
const http = require('http');
const crypto = require('crypto');
const log = require('./lib/log');
const os = require('os');
const path = require('path');
const db = require('./lib/db');
const auth = require('./lib/auth');
const boards = require('./lib/boards');
const setup = require('./lib/setup');
const versions = require('./lib/version');
const { Router } = require('./lib/router');
const { HttpError, json, redirect, serveFile, serveStatic, isHttps } = require('./lib/http');
const pkg = require('./package.json');
const settings = require('./lib/settings');
const i18n = require('./lib/i18n');

const httpLog = log.child('http');
const SLOW_MS = 2000;
// Echtzeit-Verbindungen sind absichtlich langlebig und zählen nicht als langsam
const LONG_LIVED = /^\/api\/boards\/[^/]+\/(events|poll)$/;

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const PUBLIC_DIR = path.join(__dirname, 'public');

// Pflicht-Header für ändernde API-Aufrufe (CSRF-Schutz): Fremdseiten können ihn ohne CORS-Freigabe nicht setzen
const CSRF_HEADER = 'x-vibeboard';

const router = new Router();
require('./lib/routes/auth').register(router);
require('./lib/routes/boards').register(router);
require('./lib/routes/collab').register(router);
require('./lib/routes/files').register(router);
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
  "media-src 'self' blob:", // Wiedergabe von Aufzeichnungen
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
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(self), geolocation=(), payment=(), usb=(), interest-cohort=()');
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
  // Gastlink: Seite zum Beitreten (ohne Anmeldung)
  if (/^\/g\/[\w-]{20,100}$/.test(p)) return serveFile(res, page('guest.html'), noStore);
  // Gäste sehen nur ihr Board
  if (user && user.role === 'guest' && !/^\/board\/[^/]+$/.test(p) && !p.includes('.')) {
    const link = await db.one('SELECT board_id FROM guest_links WHERE id = $1', [user.guest_link_id]);
    return redirect(res, link ? '/board/' + link.board_id : '/login');
  }
  if (p === '/' || p === '/index.html') return user ? serveFile(res, page('index.html'), noStore) : toLogin();
  if (/^\/board\/[^/]+$/.test(p)) return user ? serveFile(res, page('board.html'), noStore) : toLogin();
  if (p === '/admin') {
    if (!user) return toLogin();
    if (user.role !== 'admin') return redirect(res, '/');
    return serveFile(res, page('admin.html'), noStore);
  }
  if (p === '/offline.html') return serveFile(res, page('offline.html'));
  if (p.endsWith('.html')) return redirect(res, '/');
  // pdf.js (Vorschau von PDF-Anhängen) direkt aus dem npm-Paket
  if (p === '/vendor/pdfjs/pdf.min.mjs' || p === '/vendor/pdfjs/pdf.worker.min.mjs') {
    return serveFile(res, path.join(__dirname, 'node_modules', 'pdfjs-dist', 'build', path.basename(p)));
  }
  // Service Worker der installierbaren App: muss vom Wurzelpfad kommen und immer frisch geprüft werden
  if (p === '/sw.js') return serveFile(res, page('sw.js'), { 'Cache-Control': 'no-cache', 'Service-Worker-Allowed': '/' });
  return serveStatic(res, PUBLIC_DIR, p);
}

// Request-ID: von einem vorgeschalteten Proxy übernehmen (wenn gültig) oder neu erzeugen
function requestId(req) {
  const given = req.headers['x-request-id'];
  return typeof given === 'string' && /^[\w.-]{8,64}$/.test(given) ? given : crypto.randomBytes(8).toString('hex');
}

const server = http.createServer((req, res) => {
  const reqId = requestId(req);
  res.setHeader('X-Request-Id', reqId);
  // Sprache der Antwort folgt dem Browser (ohne unterstützte Sprache: Englisch)
  i18n.run(i18n.negotiate(req.headers['accept-language']), () => log.withContext({ reqId }, () => handle(req, res, reqId)));
});

async function handle(req, res, reqId) {
  const started = process.hrtime.bigint();
  let pathname = '';
  // Zugriffsprotokoll: nur Methode, Pfad (ohne Query – dort können Tokens stehen), Status und Dauer; keine IP-Adressen
  res.on('close', () => {
    const ms = Math.round(Number(process.hrtime.bigint() - started) / 1e6);
    const fields = { method: req.method, path: pathname, status: res.statusCode, ms };
    if (!res.writableFinished && !LONG_LIVED.test(pathname)) httpLog.debug('Verbindung vorzeitig geschlossen', fields);
    else if (ms > SLOW_MS && !LONG_LIVED.test(pathname)) httpLog.warn('Langsame Anfrage', fields);
    else httpLog.debug('Anfrage', fields);
  });
  securityHeaders(req, res);
  try {
    const url = new URL(req.url, 'http://localhost');
    // Gastlink-Tokens stehen im Pfad – im Protokoll maskieren
    pathname = url.pathname.replace(/^(\/g\/|\/api\/guest\/)(?!join$)[^/]+/, '$1***');
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
    // Erwartete Fehler (4xx) nur auf Stufe debug; unerwartete mit Stacktrace als error
    if (e.status && e.status < 500) httpLog.debug('Anfrage abgelehnt', { method: req.method, path: pathname, status: e.status, reason: e.message });
    else httpLog.error('Unerwarteter Fehler bei der Anfrage', { method: req.method, path: pathname, err: e });
    // Die Request-ID hilft, eine Fehlermeldung im Protokoll wiederzufinden
    if (!res.headersSent) json(res, e.status || 500, e.status && e.status < 500 ? { error: i18n.tr(e.message), ...(e.code ? { code: e.code } : {}) } : { error: i18n.tr('Interner Serverfehler'), requestId: reqId });
    else res.end();
  }
}

// Schutz gegen langsame Verbindungen (Slowloris): Kopfzeilen und Anfragekörper müssen zügig ankommen.
// Lange Antworten (Echtzeit-Stream, Long-Polling) sind davon nicht betroffen.
server.headersTimeout = 20000;
server.requestTimeout = 60000;
server.keepAliveTimeout = 65000;
server.maxHeadersCount = 100;

async function start() {
  log.info('Starte vibeboard', { version: pkg.version, node: process.version, logLevel: log.getLevel(), logFormat: log.format });
  await db.waitForDb();
  await versions.upgrade(); // Downgrade-Schutz, Sicherung, Migrationen, Versionshistorie
  // In der Administration gewählte Protokollstufe übernehmen
  const saved = (await settings.get()).logging.level;
  if (saved) {
    log.setLevel(saved);
    log.info('Protokollstufe aus der Administration übernommen', { level: log.getLevel() });
  }
  await setup.seedAdmin();
  await setup.importLegacy(DATA_DIR);
  setup.scheduleCleanup();
  server.listen(PORT, HOST, () => {
    log.info(`vibeboard ${pkg.version} läuft auf http://localhost:${PORT}`, { host: HOST, port: PORT });
  });
}

let stopping = false;
async function shutdown() {
  if (stopping) return;
  stopping = true;
  log.info('Beende – speichere offene Änderungen …');
  server.close();
  for (const id of [...boards.rooms.keys()]) boards.closeRoom(id);
  try {
    await boards.flushAll();
    await require('./lib/activity').stop();
    await db.pool.end();
  } catch (e) {
    log.error('Fehler beim Beenden', e);
  }
  log.info('Beendet');
  process.exit(0);
}
process.on('unhandledRejection', (e) => log.error('Unbehandelte Promise-Ablehnung', { err: e instanceof Error ? e : new Error(String(e)) }));
// Nach einer unbehandelten Ausnahme ist der Zustand unklar: protokollieren und beenden (Docker startet neu)
process.on('uncaughtException', (e) => {
  log.fatal('Unbehandelte Ausnahme – Prozess wird beendet', e);
  process.exit(1);
});
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

start().catch((e) => {
  log.fatal('Start fehlgeschlagen', e);
  process.exit(1);
});
