'use strict';
/*
 * dlzboard – kollaboratives Online-Whiteboard
 * HTTP-Server: statische Dateien, REST-API, Echtzeit über Server-Sent Events,
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
const { HttpError, json, redirect, serveFile, serveStatic } = require('./lib/http');
const pkg = require('./package.json');

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const PUBLIC_DIR = path.join(__dirname, 'public');

const router = new Router();
require('./lib/routes/auth').register(router);
require('./lib/routes/boards').register(router);
require('./lib/routes/admin').register(router);

router.route('GET', '/api/info', async (req, res) => {
  const addresses = Object.values(os.networkInterfaces()).flat()
    .filter((a) => a && a.family === 'IPv4' && !a.internal).map((a) => a.address);
  json(res, 200, { name: 'dlzboard', version: pkg.version, addresses });
});

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'same-origin',
};

const page = (name) => path.join(PUBLIC_DIR, name);

async function handlePage(req, res, url) {
  const p = url.pathname;
  const user = await auth.currentUser(req);
  const toLogin = () => redirect(res, '/login?next=' + encodeURIComponent(p + url.search));

  if (['/login', '/register', '/forgot', '/reset'].includes(p)) {
    if (user && p !== '/reset') return redirect(res, '/');
    return serveFile(res, page('auth.html'));
  }
  if (p === '/' || p === '/index.html') return user ? serveFile(res, page('index.html')) : toLogin();
  if (/^\/board\/[^/]+$/.test(p)) return user ? serveFile(res, page('board.html')) : toLogin();
  if (p === '/admin') {
    if (!user) return toLogin();
    if (user.role !== 'admin') return redirect(res, '/');
    return serveFile(res, page('admin.html'));
  }
  if (p.endsWith('.html')) return redirect(res, '/');
  return serveStatic(res, PUBLIC_DIR, p);
}

const server = http.createServer(async (req, res) => {
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.setHeader(k, v);
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname.startsWith('/api/')) {
      // CSRF-Schutz: ändernde Anfragen müssen den eigenen Header tragen
      // (Fremdseiten können ihn ohne CORS-Freigabe nicht setzen)
      if (req.method !== 'GET' && req.method !== 'HEAD' && req.headers['x-dlz'] !== '1') {
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
    if (!res.headersSent) json(res, e.status || 500, { error: e.status ? e.message : 'Interner Serverfehler' });
    else res.end();
  }
});

async function start() {
  await db.waitForDb();
  await db.migrate();
  await setup.seedAdmin();
  await setup.importLegacy(DATA_DIR);
  setup.scheduleCleanup();
  server.listen(PORT, HOST, () => {
    console.log(`dlzboard ${pkg.version} läuft auf http://localhost:${PORT}`);
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
