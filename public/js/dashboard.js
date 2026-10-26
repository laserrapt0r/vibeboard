// Board-Übersicht (Startseite)
import { h, api, ICONS, toast, modal, promptDialog, confirmDialog, initials, relTime, loadPref, savePref } from './util.js';
import { TEMPLATES } from './templates.js';
import { templateGallery, templatePreview } from './gallery.js';
import { menu } from './menu.js';
import { openShareDialog } from './share.js';
import { accountMenuItems } from './account.js';

let data = { owned: [], shared: [] };
let me = null;
let dark = loadPref('settings', {}).dark;

async function load() {
  try {
    data = await api('/api/boards');
  } catch (e) {
    toast('Boards konnten nicht geladen werden: ' + e.message);
  }
  renderBoards();
}

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
      await api(`/api/boards/${b.id}/duplicate`, { method: 'POST' }).catch((e) => toast(e.message));
      toast('Board dupliziert – die Kopie gehört dir');
      load();
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
        await api('/api/boards/' + b.id, { method: 'DELETE' }).catch((e) => toast(e.message));
        toast('Board gelöscht');
        load();
      }
    } } : { label: 'Aus meiner Liste entfernen', icon: 'close', danger: true, onClick: async () => {
      await api(`/api/boards/${b.id}/members/${me.id}`, { method: 'DELETE' }).catch((e) => toast(e.message));
      load();
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
  document.body.classList.toggle('dark', !!dark);
  document.getElementById('dash-dark').innerHTML = ICONS.moon;
}

document.getElementById('dash-search').addEventListener('input', renderBoards);
document.getElementById('dash-sort').addEventListener('change', renderBoards);
document.getElementById('dash-user').addEventListener('click', (e) => menu(e.currentTarget, accountMenuItems(me, (u) => {
  me = u;
  renderUser();
}), { placement: 'bottom' }));
document.getElementById('dash-admin').innerHTML = ICONS.settings;
document.getElementById('dash-dark').addEventListener('click', () => {
  dark = !dark;
  savePref('settings', { ...loadPref('settings', {}), dark });
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
    const b = await api('/api/boards', { method: 'POST', body: { name: d.name || f.name.replace(/\.(dlzboard\.)?json$/, ''), elements } });
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
  setInterval(load, 30000);
})();
