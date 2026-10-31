/*
 * Service Worker der installierbaren App (PWA).
 * Strategie „Netz zuerst“: Es gilt immer der aktuelle Stand vom Server – nur ohne Verbindung kommen Oberfläche
 * und Skripte aus dem Zwischenspeicher, Seitenaufrufe zeigen dann die Offline-Seite. Schnittstellen (/api/),
 * Echtzeit-Kanal und Dateien werden nie zwischengespeichert.
 */
const CACHE = 'vibeboard-shell-v5';
const SHELL = ['/offline.html', '/css/app.css', '/favicon.svg', '/icons/icon-192.png', '/manifest.webmanifest', '/js/i18n.js'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/') || url.pathname === '/sw.js') return;
  const isPage = req.mode === 'navigate';
  const isAsset = /^\/(css|js|icons|vendor|i18n)\//.test(url.pathname) || url.pathname === '/favicon.svg' || url.pathname === '/manifest.webmanifest';
  if (!isPage && !isAsset) return;
  e.respondWith((async () => {
    try {
      const res = await fetch(req);
      // Nur statische Dateien merken (Seiten enthalten Anmeldezustände und werden nie gespeichert)
      if (isAsset && res.ok && res.type === 'basic') {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
      }
      return res;
    } catch (err) {
      const hit = await caches.match(req);
      if (hit) return hit;
      if (isPage) return (await caches.match('/offline.html')) || Response.error();
      throw err;
    }
  })());
});
