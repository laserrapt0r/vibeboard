// Einstiegspunkt der Board-Seite
import { api, h } from './util.js';
import { app } from './core.js';
import { initUI } from './ui.js';
import { initCollab } from './collab.js';

function showError(title, text) {
  document.body.innerHTML = '';
  document.body.className = 'dash-page';
  document.body.append(h('div', { class: 'auth-wrap' }, h('div', { class: 'auth-card' },
    h('h1', {}, title), h('p', { class: 'muted' }, text),
    h('a', { class: 'btn primary', href: '/' }, 'Zur Übersicht'))));
}

async function boot() {
  let me, meta;
  try {
    me = (await api('/api/auth/me')).user;
    meta = await api(`/api/boards/${app.boardId}`);
  } catch (e) {
    if (e.status === 404) return showError('Board nicht gefunden', 'Dieses Board existiert nicht (mehr).');
    if (e.status === 403) return showError('Kein Zugriff', 'Du hast keine Berechtigung für dieses Board. Bitte die Besitzerin oder den Besitzer, es mit dir zu teilen.');
    if (e.message !== 'Nicht angemeldet') showError('Fehler', e.message);
    return;
  }
  app.me = me;
  app.user = { id: me.id, name: me.displayName, color: me.color };
  app.role = meta.role;
  app.viewOnly = meta.role === 'viewer';
  app.boardMeta = meta;
  app.name = meta.name;
  document.title = meta.name + ' – vibeboard';
  initUI();
  initCollab();
}

boot();
