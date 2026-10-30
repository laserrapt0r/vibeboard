// Installierbare App: Service Worker registrieren und „App installieren“ anbieten, sobald der Browser es erlaubt
// Service Worker gibt es nur in sicheren Kontexten (https oder localhost)
if ('serviceWorker' in navigator && window.isSecureContext) {
  navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {});
}

let deferred = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferred = e;
  // Wird im Kontomenü als „App installieren“ angezeigt (account.js)
  globalThis.vibeboardInstall = async () => {
    if (!deferred) return;
    deferred.prompt();
    await deferred.userChoice.catch(() => null);
    deferred = null;
    globalThis.vibeboardInstall = null;
  };
});
window.addEventListener('appinstalled', () => {
  deferred = null;
  globalThis.vibeboardInstall = null;
});
