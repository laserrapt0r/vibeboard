// Board-Übersicht (Startseite)
import { h, ICONS, esc, toast, modal, promptDialog, confirmDialog, getUser, saveUser, initials, relTime, USER_COLORS, loadPref, savePref } from './util.js';
import { TEMPLATES } from './templates.js';
import { templateGallery, templatePreview } from './gallery.js';

let boards = [];
let user = getUser();
let dark = loadPref('settings', {}).dark;

const api = async (url, opts = {}) => {
  const r = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...opts });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || r.statusText);
  return r.json();
};

async function load() {
  try {
    boards = await api('/api/boards');
  } catch (e) {
    toast('Boards konnten nicht geladen werden: ' + e.message);
    boards = [];
  }
  renderBoards();
}

async function createFromTemplate(t) {
  const name = await promptDialog('Neues Board', 'Name des Boards', t.id === 'blank' ? 'Unbenanntes Board' : t.name);
  if (name === null) return;
  const elements = t.build();
  const b = await api('/api/boards', { method: 'POST', body: JSON.stringify({ name: name.trim() || t.name, elements }) });
  location.href = '/board/' + b.id;
}

function renderTemplates() {
  const box = document.getElementById('dash-templates');
  box.innerHTML = '';
  const featured = ['blank', 'brainstorm', 'kanban', 'retro-ssc', 'mindmap', 'bmc', 'swot', 'flowchart', 'journey'];
  for (const id of featured) {
    const t = TEMPLATES.find((x) => x.id === id);
    const prev = h('div', { class: 'tpl-prev' });
    prev.innerHTML = templatePreview(t);
    box.append(h('button', { class: 'tpl-card', title: t.description, onclick: () => createFromTemplate(t) }, prev, h('div', { class: 'tpl-info' }, h('div', { class: 'tpl-name' }, `${t.icon}  ${t.name}`))));
  }
}

function renderBoards() {
  const box = document.getElementById('dash-boards');
  const q = document.getElementById('dash-search').value.trim().toLowerCase();
  const sort = document.getElementById('dash-sort').value;
  let list = boards.filter((b) => !q || b.name.toLowerCase().includes(q));
  list.sort((a, b) => (sort === 'name' ? a.name.localeCompare(b.name, 'de') : sort === 'created' ? b.createdAt - a.createdAt : b.updatedAt - a.updatedAt));
  box.innerHTML = '';
  if (!list.length) {
    box.append(h('div', { class: 'dash-empty' }, q ? 'Keine Boards gefunden.' : 'Noch keine Boards – wähle oben eine Vorlage, um loszulegen.'));
    return;
  }
  for (const b of list) {
    const thumb = h('div', { class: 'board-thumb' });
    if (b.hasThumb) thumb.append(h('img', { src: `/api/boards/${b.id}/thumb?t=${b.updatedAt}`, alt: '', loading: 'lazy' }));
    else thumb.append(h('div', { class: 'board-thumb-empty' }, '🗒️'));
    const more = h('button', { class: 'icon-btn small', title: 'Aktionen', html: ICONS.more });
    more.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      boardMenu(more, b);
    };
    box.append(h('a', { class: 'board-card', href: '/board/' + b.id }, thumb,
      h('div', { class: 'board-info' },
        h('div', { class: 'board-name' }, b.name),
        h('div', { class: 'board-meta' }, `${relTime(b.updatedAt)} · ${b.elementCount} Elemente`, b.online ? h('span', { class: 'online' }, ` · ${b.online} online`) : null)),
      more));
  }
}

function boardMenu(anchor, b) {
  document.querySelector('.popover')?.remove();
  const close = () => pop.remove();
  const item = (label, icon, fn, danger) => h('button', { class: 'menu-item' + (danger ? ' danger' : ''), onclick: () => { close(); fn(); } }, h('span', { class: 'mi-icon', html: ICONS[icon] }), h('span', { class: 'mi-label' }, label));
  const pop = h('div', { class: 'popover panel' }, h('div', { class: 'menu' },
    item('Öffnen', 'fit', () => (location.href = '/board/' + b.id)),
    item('Umbenennen', 'edit', async () => {
      const n = await promptDialog('Board umbenennen', 'Name', b.name);
      if (n && n.trim()) {
        await api('/api/boards/' + b.id, { method: 'PATCH', body: JSON.stringify({ name: n.trim() }) });
        load();
      }
    }),
    item('Duplizieren', 'copy', async () => {
      await api(`/api/boards/${b.id}/duplicate`, { method: 'POST' });
      toast('Board dupliziert');
      load();
    }),
    item('Link kopieren', 'link', async () => {
      try {
        await navigator.clipboard.writeText(location.origin + '/board/' + b.id);
        toast('Link kopiert');
      } catch {
        toast(location.origin + '/board/' + b.id, 5000);
      }
    }),
    h('div', { class: 'menu-sep' }),
    item('Löschen', 'trash', async () => {
      if (await confirmDialog('Board löschen', `„${b.name}“ wird unwiderruflich gelöscht.`, 'Löschen', true)) {
        await api('/api/boards/' + b.id, { method: 'DELETE' });
        toast('Board gelöscht');
        load();
      }
    }, true)));
  document.body.append(pop);
  const r = anchor.getBoundingClientRect();
  const pr = pop.getBoundingClientRect();
  pop.style.left = Math.min(innerWidth - pr.width - 8, r.right - pr.width) + 'px';
  pop.style.top = Math.min(innerHeight - pr.height - 8, r.bottom + 6) + 'px';
  setTimeout(() => document.addEventListener('pointerdown', function off(e) {
    if (!pop.contains(e.target)) {
      pop.remove();
      document.removeEventListener('pointerdown', off, true);
    }
  }, true), 0);
}

function renderUser() {
  const b = document.getElementById('dash-user');
  b.textContent = initials(user.name || 'Gast');
  b.style.background = user.color;
  b.title = (user.name || 'Gast') + ' – Profil bearbeiten';
}

function editProfile() {
  let color = user.color;
  const name = h('input', { type: 'text', value: user.name || '', maxlength: 40 });
  const sw = h('div', { class: 'swatches' }, USER_COLORS.map((c) => h('button', { type: 'button', class: 'swatch' + (c === color ? ' active' : ''), title: c, style: { background: c }, onclick: () => {
    color = c;
    sw.querySelectorAll('.swatch').forEach((s) => s.classList.toggle('active', s.title === c));
  } })));
  const m = modal('Profil', h('form', { class: 'form', onsubmit: (e) => {
    e.preventDefault();
    user = { ...user, name: name.value.trim(), color };
    saveUser(user);
    renderUser();
    m.close();
  } }, h('label', {}, 'Name', name), h('div', {}, h('div', { class: 'label' }, 'Farbe'), sw),
  h('div', { class: 'form-actions' }, h('button', { class: 'btn primary', type: 'submit' }, 'Speichern'))));
}

function applyDark() {
  document.body.classList.toggle('dark', !!dark);
  document.getElementById('dash-dark').innerHTML = ICONS.moon;
}

document.getElementById('dash-search').addEventListener('input', renderBoards);
document.getElementById('dash-sort').addEventListener('change', renderBoards);
document.getElementById('dash-user').addEventListener('click', editProfile);
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
    const data = JSON.parse(await f.text());
    const elements = Array.isArray(data) ? data : Array.isArray(data.elements) ? data.elements : Object.values(data.elements || {});
    const b = await api('/api/boards', { method: 'POST', body: JSON.stringify({ name: data.name || f.name.replace(/\.(dlzboard\.)?json$/, ''), elements }) });
    location.href = '/board/' + b.id;
  } catch (e) {
    toast('Import fehlgeschlagen: ' + e.message);
  }
});

applyDark();
renderUser();
renderTemplates();
load();
setInterval(load, 30000);
