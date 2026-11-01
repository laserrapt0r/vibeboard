// Offline-Seite: Sie steht unter der ursprünglichen Adresse. Ist der Server zurück, geht es dort weiter.
const retry = document.getElementById('retry');
const here = location.pathname === '/offline.html' ? '/' : location.href;
retry.href = here;
setInterval(() => {
  fetch('/healthz', { cache: 'no-store' }).then((r) => r.ok && location.replace(here)).catch(() => {});
}, 5000);
