// Board-Übersicht (Startseite)
import { h, api, ICONS, toast, modal, promptDialog, confirmDialog, initials, relTime, loadPref, savePref } from './util.js';
import { TEMPLATES } from './templates.js';
import { templateGallery, templatePreview } from './gallery.js';
import { menu } from './menu.js';
import { openShareDialog } from './share.js';
import { accountMenuItems } from './account.js';
import { legalFooter } from './footer.js';

let data = { owned: [], shared: [] };
let me = null;
let dark = loadPref('settings', {}).dark;
let neon = loadPref('settings', {}).neon;

async function load() {
  try {
    data = await api('/api/boards');
  } catch (e) {
    toast('Boards konnten nicht geladen werden: ' + e.message);
  }
  renderBoards();
}

/* Meine Aufgaben: Karten aller zugänglichen Boards, die mir zugewiesen sind */
const DONE_RE = /^(fertig|erledigt|done|geschlossen|closed|abgeschlossen|resolved|gelöst)$/i;
const PRIO = { critical: ['⏫', 'Kritisch', '#e03131'], high: ['▲', 'Hoch', '#f08c00'], medium: ['■', 'Mittel', '#1971c2'], low: ['▼', 'Niedrig', '#868e96'] };
let tasks = [];

async function loadTasks() {
  try {
    tasks = (await api('/api/tasks')).tasks;
  } catch {
    tasks = [];
  }
  renderTasks();
}

function renderTasks() {
  const showDone = document.getElementById('dash-tasks-done').checked;
  const n = new Date();
  const today = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
  const open = tasks.filter((t) => !DONE_RE.test(t.status));
  const list = (showDone ? tasks : open).sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999') || a.title.localeCompare(b.title));
  const section = document.getElementById('aufgaben');
  const wasHidden = section.classList.contains('hidden');
  section.classList.toggle('hidden', !tasks.length);
  // Link „Meine Aufgaben“ (#aufgaben): erst nach dem Laden ist der Abschnitt da
  if (wasHidden && tasks.length && location.hash === '#aufgaben') setTimeout(() => section.scrollIntoView({ block: 'start' }), 0);
  document.getElementById('dash-tasks-count').textContent = `${open.length} offen${open.some((t) => t.due && t.due < today) ? ` · ${open.filter((t) => t.due && t.due < today).length} überfällig` : ''}`;
  const box = document.getElementById('dash-tasks');
  box.innerHTML = '';
  if (!list.length) box.append(h('div', { class: 'dash-empty' }, 'Keine offenen Aufgaben – alles erledigt. 🎉'));
  for (const t of list.slice(0, 60)) {
    const overdue = t.due && t.due < today && !DONE_RE.test(t.status);
    const p = PRIO[t.priority];
    box.append(h('a', { class: 'my-task', href: `/board/${encodeURIComponent(t.boardId)}#el=${encodeURIComponent(t.id)}` },
      h('span', { class: 'task-color', style: { background: t.color } }),
      h('span', { class: 'task-main' },
        h('span', { class: 'task-title' }, t.key ? h('span', { class: 'muted' }, t.key + ' ') : null, t.title || 'Ohne Titel'),
        h('span', { class: 'task-meta' },
          h('span', {}, '🗂 ' + t.boardName),
          t.status ? h('span', {}, t.status) : null,
          p ? h('span', { style: { color: p[2] } }, `${p[0]} ${p[1]}`) : null,
          t.due ? h('span', { class: overdue ? 'overdue' : '' }, '📅 ' + new Date(t.due + 'T00:00').toLocaleDateString('de-DE')) : null,
          t.points !== '' ? h('span', {}, `${t.points} SP`) : null))));
  }
}

document.getElementById('dash-tasks-done').addEventListener('change', renderTasks);

async function createFromTemplate(t) {
  const name = await promptDialog('Neues Board', 'Name des Boards', t.id === 'blank' ? 'Unbenanntes Board' : t.name);
  if (name === null) return;
  try {
    const b = await api('/api/boards', { method: 'POST', body: { name: name.trim() || t.name, elements: t.build() } });
    location.href = '/board/' + b.id;
  } catch (e) {
    toast(e.message);
  }
}

function renderTemplates() {
  const box = document.getElementById('dash-templates');
  box.innerHTML = '';
  for (const id of ['blank', 'brainstorm', 'kanban', 'retro-ssc', 'mindmap', 'bmc', 'swot', 'flowchart', 'journey']) {
    const t = TEMPLATES.find((x) => x.id === id);
    const prev = h('div', { class: 'tpl-prev' });
    prev.innerHTML = templatePreview(t);
    box.append(h('button', { class: 'tpl-card', title: t.description, onclick: () => createFromTemplate(t) }, prev, h('div', { class: 'tpl-info' }, h('div', { class: 'tpl-name' }, `${t.icon}  ${t.name}`))));
  }
}

const ROLE_LABEL = { owner: 'Besitzer', editor: 'Bearbeiten', viewer: 'Ansehen' };

function sortList(list) {
  const q = document.getElementById('dash-search').value.trim().toLowerCase();
  const sort = document.getElementById('dash-sort').value;
  return list
    .filter((b) => !q || b.name.toLowerCase().includes(q) || (b.owner && b.owner.displayName.toLowerCase().includes(q)))
    .sort((a, b) => (sort === 'name' ? a.name.localeCompare(b.name, 'de') : sort === 'created' ? b.createdAt - a.createdAt : b.updatedAt - a.updatedAt));
}

function card(b, shared) {
  const thumb = h('div', { class: 'board-thumb' });
  if (b.hasThumb) thumb.append(h('img', { src: `/api/boards/${b.id}/thumb?t=${b.updatedAt}`, alt: '', loading: 'lazy' }));
  else thumb.append(h('div', { class: 'board-thumb-empty' }, '🗒️'));
  const more = h('button', { class: 'icon-btn small', title: 'Aktionen', html: ICONS.more });
  more.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    boardMenu(more, b);
  };
  const badges = [];
  if (b.linkAccess !== 'private') badges.push(h('span', { class: 'tag', title: 'Per Link freigegeben' }, '🔗'));
  if (b.memberCount) badges.push(h('span', { class: 'tag', title: `${b.memberCount} Mitglied(er)` }, '👥 ' + b.memberCount));
  return h('a', { class: 'board-card', href: '/board/' + b.id }, thumb,
    h('div', { class: 'board-info' },
      h('div', { class: 'board-name' }, b.name),
      h('div', { class: 'board-meta' },
        shared && b.owner ? `von ${b.owner.displayName} · ${ROLE_LABEL[b.role]} · ` : '',
        `${relTime(b.updatedAt)} · ${b.elementCount} Elemente`,
        b.online ? h('span', { class: 'online' }, ` · ${b.online} online`) : null),
      badges.length ? h('div', { class: 'board-tags' }, badges) : null),
    more);
}

function renderBoards() {
  const owned = sortList(data.owned);
  const shared = sortList(data.shared);
  const box = document.getElementById('dash-boards');
  const sbox = document.getElementById('dash-shared');
  box.innerHTML = '';
  sbox.innerHTML = '';
  if (owned.length) owned.forEach((b) => box.append(card(b, false)));
  else box.append(h('div', { class: 'dash-empty' }, data.owned.length ? 'Keine passenden Boards.' : 'Noch keine eigenen Boards – wähle oben eine Vorlage, um loszulegen.'));
  document.getElementById('dash-shared-section').classList.toggle('hidden', !data.shared.length);
  shared.forEach((b) => sbox.append(card(b, true)));
}

function boardMenu(anchor, b) {
  const owner = b.role === 'owner';
  menu(anchor, [
    { label: 'Öffnen', icon: 'fit', onClick: () => (location.href = '/board/' + b.id) },
    { label: 'Teilen …', icon: 'share', onClick: () => openShareDialog(b.id, { me, onLeave: load }) },
    b.role !== 'viewer' ? { label: 'Umbenennen', icon: 'edit', onClick: async () => {
      const n = await promptDialog('Board umbenennen', 'Name', b.name);
      if (n && n.trim()) {
        await api('/api/boards/' + b.id, { method: 'PATCH', body: { name: n.trim() } }).catch((e) => toast(e.message));
        load();
      }
    } } : null,
    { label: 'Duplizieren', icon: 'copy', onClick: async () => {
      try {
        await api(`/api/boards/${b.id}/duplicate`, { method: 'POST' });
        toast('Board dupliziert – die Kopie gehört dir');
        load();
      } catch (e) {
        toast(e.message);
      }
    } },
    { label: 'Link kopieren', icon: 'link', onClick: async () => {
      try {
        await navigator.clipboard.writeText(location.origin + '/board/' + b.id);
        toast('Link kopiert');
      } catch {
        toast(location.origin + '/board/' + b.id, 5000);
      }
    } },
    '-',
    owner ? { label: 'Löschen', icon: 'trash', danger: true, onClick: async () => {
      if (await confirmDialog('Board löschen', `„${b.name}“ wird für alle Mitglieder unwiderruflich gelöscht.`, 'Löschen', true)) {
        try {
          await api('/api/boards/' + b.id, { method: 'DELETE' });
          toast('Board gelöscht');
          load();
        } catch (e) {
          toast(e.message);
        }
      }
    } } : { label: b.member ? 'Board verlassen …' : 'Aus meiner Liste entfernen', icon: 'close', danger: true, onClick: async () => {
      // Mitglieder verlieren dabei den Zugriff – nur nach Rückfrage
      if (b.member && !(await confirmDialog('Board verlassen', `Du verlierst den Zugriff auf „${b.name}“, bis du erneut eingeladen wirst.`, 'Verlassen', true))) return;
      try {
        await api(`/api/boards/${b.id}/members/${me.id}`, { method: 'DELETE' });
        load();
      } catch (e) {
        toast(e.message);
      }
    } },
  ], { placement: 'bottom' });
}

function renderUser() {
  const b = document.getElementById('dash-user');
  b.textContent = initials(me.displayName);
  b.style.background = me.color;
  b.title = me.displayName + ' – Konto';
  document.getElementById('dash-admin').classList.toggle('hidden', me.role !== 'admin');
}

function applyDark() {
  document.body.classList.toggle('dark', !!dark || !!neon);
  document.body.classList.toggle('neon', !!neon);
  const b = document.getElementById('dash-dark');
  b.innerHTML = ICONS.moon;
  b.title = `Design: ${neon ? 'Neon' : dark ? 'Dunkel' : 'Hell'} (Klick wechselt)`;
}

document.getElementById('dash-search').addEventListener('input', renderBoards);
document.getElementById('dash-sort').addEventListener('change', renderBoards);
document.getElementById('dash-user').addEventListener('click', (e) => menu(e.currentTarget, accountMenuItems(me, (u) => {
  me = u;
  renderUser();
}), { placement: 'bottom' }));
document.getElementById('dash-admin').innerHTML = ICONS.settings;
// Hell → Dunkel → Neon → Hell
document.getElementById('dash-dark').addEventListener('click', () => {
  if (neon) [dark, neon] = [false, false];
  else if (dark) [dark, neon] = [false, true];
  else [dark, neon] = [true, false];
  savePref('settings', { ...loadPref('settings', {}), dark, neon });
  applyDark();
});
document.getElementById('dash-all-templates').addEventListener('click', () => {
  const m = modal('Neues Board aus Vorlage', templateGallery((t) => {
    m.close();
    createFromTemplate(t);
  }), { wide: true });
});

const importInput = h('input', { type: 'file', accept: '.json,application/json', style: { display: 'none' } });
document.body.append(importInput);
document.getElementById('dash-import').addEventListener('click', () => importInput.click());
importInput.addEventListener('change', async () => {
  const f = importInput.files[0];
  importInput.value = '';
  if (!f) return;
  try {
    const d = JSON.parse(await f.text());
    const elements = Array.isArray(d) ? d : Array.isArray(d.elements) ? d.elements : Object.values(d.elements || {});
    const b = await api('/api/boards', { method: 'POST', body: { name: d.name || f.name.replace(/\.((dlz|vibe)board\.)?json$/, ''), elements } });
    if (b.rejected && b.rejected.length) {
      toast(`${b.rejected.length} Bild(er) wurden nicht übernommen: ${b.rejected[0].reason}`, 6000);
      setTimeout(() => (location.href = '/board/' + b.id), 4000);
      return;
    }
    location.href = '/board/' + b.id;
  } catch (e) {
    toast('Import fehlgeschlagen: ' + e.message);
  }
});

(async () => {
  applyDark();
  try {
    me = (await api('/api/auth/me')).user;
  } catch {
    location.href = '/login';
    return;
  }
  renderUser();
  renderTemplates();
  load();
  loadTasks();
  legalFooter().then((f) => document.getElementById('footer').append(f));
  setInterval(() => {
    load();
    loadTasks();
  }, 30000);
})();
