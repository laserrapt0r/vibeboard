// Einstiegspunkt der Board-Seite
import { api, h } from './util.js';
import { app, ensureThumb } from './core.js';
import { initUI } from './ui.js';
import { initCollab } from './collab.js';
import './teamwork.js';
import './planning.js';
import './diagram-text.js';
import './moderation.js';
import './activity.js';
import './recording.js';

// Ladeanzeige ausblenden, sobald der Stand des Boards da ist
export function hideLoader() {
  const l = document.getElementById('board-loader');
  document.getElementById('stage')?.removeAttribute('aria-busy');
  if (!l) return;
  l.classList.add('done');
  setTimeout(() => l.remove(), 300);
}

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
  app.viewOnly = !['editor', 'owner'].includes(meta.role);
  app.baseViewOnly = app.viewOnly;
  app.canComment = meta.role !== 'viewer';
  app.isFacilitator = meta.role === 'owner';
  app.guest = !!meta.guest;
  app.features = meta.features || {};
  app.boardMeta = meta;
  app.name = meta.name;
  document.title = meta.name + ' – vibeboard';
  initUI();
  app.on('loaded', () => {
    hideLoader();
    ensureThumb();
  });
  initCollab();
}

boot();
