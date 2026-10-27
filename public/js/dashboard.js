// Board-Übersicht (Startseite)
import { h, api, ICONS, toast, modal, promptDialog, confirmDialog, initials, relTime, loadPref, savePref } from './util.js';
import { TEMPLATES } from './templates.js';
import { templateGallery, templatePreview } from './gallery.js';
import { menu } from './menu.js';
import { openShareDialog } from './share.js';
import { accountMenuItems } from './account.js';
import { legalFooter } from './footer.js';
import { bellButton, refresh as refreshBell } from './notifications.js';

let data = { owned: [], shared: [], teams: [], folderList: [] };
// Ansicht: all | mine | shared | folder:<id> | team:<id> (optional mit Ordner im Team)
let view = loadPref('dashView', { kind: 'all' });
let me = null;
// „neon“: Einstellung aus 3.5.0, wird als dunkles Design übernommen
let dark = loadPref('settings', {}).dark || loadPref('settings', {}).neon;

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
        h('span', { class: 'task-title' }, t.comment ? '💬 ' : '', t.key ? h('span', { class: 'muted' }, t.key + ' ') : null, t.title || 'Ohne Titel'),
        h('span', { class: 'task-meta' },
          h('span', {}, '🗂 ' + t.boardName),
          t.comment ? h('span', {}, `Kommentar${t.by ? ' · zugewiesen von ' + t.by : ''}`) : null,
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

const ROLE_LABEL = { owner: 'Besitzer', editor: 'Bearbeiten', commenter: 'Kommentieren', viewer: 'Ansehen' };

const allBoards = () => [...data.owned, ...data.shared];
const inTeam = (b, id) => b.team && b.team.id === id && (b.team.member || b.role === 'owner');
const teamById = (id) => data.teams.find((t) => t.id === id);
const folderById = (id) => data.folderList.find((f) => f.id === id);

function sortList(list) {
  const q = document.getElementById('dash-search').value.trim().toLowerCase();
  const sort = document.getElementById('dash-sort').value;
  return list
    .filter((b) => !q || b.name.toLowerCase().includes(q) || (b.owner && b.owner.displayName.toLowerCase().includes(q)))
    .sort((a, b) => (sort === 'name' ? a.name.localeCompare(b.name, 'de') : sort === 'created' ? b.createdAt - a.createdAt : b.updatedAt - a.updatedAt));
}

function card(b) {
  const shared = b.role !== 'owner';
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
  // Team nur anzeigen, wenn man selbst dazugehört (oder das Board besitzt)
  if (b.team && (b.team.member || b.role === 'owner')) badges.push(h('span', { class: 'tag', title: `Team „${b.team.name}“ (${ROLE_LABEL[b.team.role]})` }, '👥 ' + b.team.name));
  if (b.linkAccess !== 'private') badges.push(h('span', { class: 'tag', title: 'Per Link freigegeben' }, '🔗'));
  if (b.memberCount) badges.push(h('span', { class: 'tag', title: `${b.memberCount} Mitglied(er)` }, '👤 ' + b.memberCount));
  for (const fid of b.folders || []) {
    const f = folderById(fid);
    if (f && !(view.kind === 'folder' && view.id === fid)) badges.push(h('span', { class: 'tag', title: 'Ordner' }, '📁 ' + f.name));
  }
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

/* ---------------- Navigation: Alle, Meine, Geteilt, Ordner, Teams ---------------- */

function setView(v) {
  view = v;
  savePref('dashView', v);
  renderBoards();
  // Die Board-Liste steht unter Vorlagen und Aufgaben – nach der Auswahl dorthin scrollen, falls nicht sichtbar
  const t = document.getElementById('dash-title');
  const r = t.getBoundingClientRect();
  if (r.top < 60 || r.top > innerHeight * 0.6) t.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderNav() {
  const nav = document.getElementById('dash-nav');
  nav.innerHTML = '';
  const item = (label, v, count, icon) => h('button', {
    class: 'dash-nav-item' + (view.kind === v.kind && view.id === v.id ? ' active' : ''), onclick: () => setView(v),
  }, icon ? h('span', { class: 'nav-icon', html: ICONS[icon] }) : null, h('span', { class: 'nav-label' }, label), count != null ? h('span', { class: 'nav-count' }, count) : null);
  nav.append(
    item('Alle Boards', { kind: 'all' }, allBoards().length, 'home'),
    item('Meine Boards', { kind: 'mine' }, data.owned.length, 'users'),
    item('Mit mir geteilt', { kind: 'shared' }, data.shared.length, 'share'));
  const personal = data.folderList.filter((f) => !f.teamId);
  nav.append(h('div', { class: 'dash-nav-head' }, h('span', {}, 'Ordner'), h('button', { class: 'icon-btn small', title: 'Neuer Ordner', html: ICONS.plus, onclick: () => newFolder(null) })));
  if (!personal.length) nav.append(h('div', { class: 'dash-nav-hint' }, 'Eigene Ordner – nur für dich sichtbar.'));
  for (const f of personal) nav.append(item(f.name, { kind: 'folder', id: f.id }, allBoards().filter((b) => b.folders.includes(f.id)).length, 'folder'));
  nav.append(h('div', { class: 'dash-nav-head' }, h('span', {}, 'Teams'), h('button', { class: 'icon-btn small', title: 'Team erstellen', html: ICONS.plus, onclick: newTeam })));
  if (!data.teams.length) nav.append(h('div', { class: 'dash-nav-hint' }, 'Teams teilen Boards mit allen Mitgliedern auf einmal.'));
  for (const t of data.teams) nav.append(item(t.name, { kind: 'team', id: t.id }, allBoards().filter((b) => inTeam(b, t.id)).length, 'team'));
}

function renderBoards() {
  // Ansicht existiert nicht mehr (Ordner gelöscht, Team verlassen)
  if ((view.kind === 'folder' && !folderById(view.id)) || (view.kind === 'team' && !teamById(view.id))) view = { kind: 'all' };
  // Gewählter Ordner im Team gelöscht (auch von anderen) → zurück auf „Alle“
  if (view.kind === 'team' && view.folder && view.folder !== '-' && !folderById(view.folder)) view = { ...view, folder: null };
  renderNav();
  const title = document.getElementById('dash-title');
  const actions = document.getElementById('dash-view-actions');
  const fbar = document.getElementById('dash-folderbar');
  actions.innerHTML = '';
  fbar.innerHTML = '';
  fbar.classList.add('hidden');
  let list = allBoards();
  let empty = 'Noch keine Boards – wähle oben eine Vorlage, um loszulegen.';
  if (view.kind === 'mine') {
    title.textContent = 'Meine Boards';
    list = data.owned;
  } else if (view.kind === 'shared') {
    title.textContent = 'Mit mir geteilt';
    list = data.shared;
    empty = 'Noch keine geteilten Boards. Boards, zu denen du eingeladen wirst oder die ein Team mit dir teilt, erscheinen hier.';
  } else if (view.kind === 'folder') {
    const f = folderById(view.id);
    title.textContent = '📁 ' + f.name;
    list = list.filter((b) => b.folders.includes(f.id));
    empty = 'Dieser Ordner ist leer. Über „…“ an einem Board → „In Ordner verschieben“ legst du Boards hinein.';
    actions.append(folderActions(f));
  } else if (view.kind === 'team') {
    const t = teamById(view.id);
    title.textContent = '👥 ' + t.name;
    list = list.filter((b) => inTeam(b, t.id));
    empty = 'Noch keine Boards in diesem Team. Ordne ein Board über „Teilen“ → „Team“ zu.';
    actions.append(
      h('button', { class: 'btn small', onclick: () => openTeamDialog(t.id) }, h('span', { html: ICONS.team }), 'Mitglieder'),
      h('button', { class: 'btn small', onclick: () => newFolder(t.id) }, h('span', { html: ICONS.folder }), 'Ordner anlegen'));
    // Ordner im Team als Filter
    const tf = data.folderList.filter((f) => f.teamId === t.id);
    if (tf.length) {
      fbar.classList.remove('hidden');
      const chip = (label, fid, n) => h('button', { class: 'chip' + ((view.folder || null) === fid ? ' active' : ''), onclick: () => setView({ ...view, folder: fid }) }, label, h('span', { class: 'muted' }, ` ${n}`));
      fbar.append(chip('Alle', null, list.length));
      for (const f of tf) {
        const c = chip('📁 ' + f.name, f.id, list.filter((b) => b.folders.includes(f.id)).length);
        c.oncontextmenu = (e) => {
          e.preventDefault();
          menu(c, folderMenuItems(f));
        };
        fbar.append(c);
      }
      fbar.append(chip('Ohne Ordner', '-', list.filter((b) => !b.folders.some((x) => tf.some((f) => f.id === x))).length));
      if (view.folder === '-') {
        list = list.filter((b) => !b.folders.some((x) => tf.some((f) => f.id === x)));
        empty = 'Alle Boards dieses Teams liegen in Ordnern.';
      } else if (view.folder) {
        list = list.filter((b) => b.folders.includes(view.folder));
        empty = 'Dieser Ordner ist leer. Über „…“ an einem Board → „In Ordner verschieben“ legst du Boards hinein.';
      }
      const cur = view.folder && view.folder !== '-' && folderById(view.folder);
      if (cur) actions.append(folderActions(cur));
    }
  } else title.textContent = 'Alle Boards';
  const box = document.getElementById('dash-boards');
  box.innerHTML = '';
  const sorted = sortList(list);
  if (sorted.length) sorted.forEach((b) => box.append(card(b)));
  else box.append(h('div', { class: 'dash-empty' }, list.length ? 'Keine passenden Boards.' : empty));
}

function folderMenuItems(f) {
  return [
    { header: f.name },
    { label: 'Umbenennen', icon: 'edit', onClick: async () => {
      const n = await promptDialog('Ordner umbenennen', 'Name', f.name);
      if (n && n.trim()) await api(`/api/folders/${f.id}`, { method: 'PATCH', body: { name: n.trim() } }).catch((e) => toast(e.message));
      load();
    } },
    { label: 'Ordner löschen', icon: 'trash', danger: true, onClick: async () => {
      if (!(await confirmDialog('Ordner löschen', `Der Ordner „${f.name}“ wird gelöscht. Die Boards darin bleiben erhalten.`, 'Löschen', true))) return;
      await api(`/api/folders/${f.id}`, { method: 'DELETE' }).catch((e) => toast(e.message));
      load();
    } },
  ];
}

function folderActions(f) {
  const b = h('button', { class: 'btn small', title: 'Ordner bearbeiten' }, h('span', { html: ICONS.more }), 'Ordner');
  b.onclick = () => menu(b, folderMenuItems(f), { placement: 'bottom' });
  return b;
}

async function newFolder(teamId) {
  const n = await promptDialog(teamId ? 'Ordner im Team anlegen' : 'Neuer Ordner', teamId ? 'Name (für alle im Team sichtbar)' : 'Name (nur für dich sichtbar)', '');
  if (!n || !n.trim()) return;
  try {
    const r = await api('/api/folders', { method: 'POST', body: { name: n.trim(), teamId } });
    await load();
    setView(teamId ? { kind: 'team', id: teamId, folder: r.id } : { kind: 'folder', id: r.id });
  } catch (e) {
    toast(e.message);
  }
}

async function newTeam() {
  const n = await promptDialog('Team erstellen', 'Name des Teams', '');
  if (!n || !n.trim()) return;
  try {
    const r = await api('/api/teams', { method: 'POST', body: { name: n.trim() } });
    await load();
    setView({ kind: 'team', id: r.id });
    openTeamDialog(r.id);
  } catch (e) {
    toast(e.message);
  }
}

// Board in einen Ordner legen: eigene Ordner und (falls das Board einem Team gehört) die Ordner dieses Teams
function moveToFolder(b) {
  const options = data.folderList.filter((f) => !f.teamId || (b.team && f.teamId === b.team.id));
  const body = h('div', { class: 'form' });
  const m = modal(`„${b.name}“ in Ordner verschieben`, body);
  if (!options.length) body.append(h('p', { class: 'muted' }, 'Noch keine Ordner. Lege links unter „Ordner“ einen an.'));
  const groups = [[null, 'Meine Ordner'], ...(b.team ? [[b.team.id, `Team „${b.team.name}“`]] : [])];
  for (const [tid, label] of groups) {
    const fl = options.filter((f) => (f.teamId || null) === tid);
    if (!fl.length) continue;
    body.append(h('div', { class: 'label' }, label));
    for (const f of fl) {
      const inIt = b.folders.includes(f.id);
      body.append(h('button', { class: 'folder-pick' + (inIt ? ' active' : ''), onclick: async () => {
        try {
          if (inIt) await api(`/api/folders/${f.id}/boards/${b.id}`, { method: 'DELETE' });
          else await api(`/api/folders/${f.id}/boards/${b.id}`, { method: 'PUT' });
          m.close();
          toast(inIt ? 'Aus dem Ordner entfernt' : `In „${f.name}“ verschoben`);
          load();
        } catch (e) {
          toast(e.message);
        }
      } }, h('span', { html: ICONS.folder }), f.name, inIt ? h('span', { class: 'muted small' }, ' – enthalten, Klick entfernt') : null));
    }
  }
}

/* ---------------- Team verwalten ---------------- */

async function openTeamDialog(id) {
  const body = h('div', { class: 'form share' });
  const m = modal('Team', body);
  const render = async () => {
    let t;
    try {
      t = await api('/api/teams/' + id);
    } catch (e) {
      body.textContent = e.message;
      return;
    }
    body.closest('.modal')?.querySelector('h2')?.replaceChildren('Team „' + t.name + '“');
    const admin = t.myRole === 'admin';
    body.innerHTML = '';
    if (admin) {
      const name = h('input', { type: 'text', value: t.name, maxlength: 80 });
      body.append(h('label', {}, 'Name', h('div', { class: 'copy-row' }, name, h('button', { class: 'btn', onclick: async () => {
        await api('/api/teams/' + id, { method: 'PATCH', body: { name: name.value } }).then(() => toast('Gespeichert')).catch((e) => toast(e.message));
        load();
      } }, 'Speichern'))));
      const input = h('input', { type: 'text', placeholder: 'Benutzername oder E-Mail', autocomplete: 'off' });
      const role = h('select', {}, h('option', { value: 'member' }, 'Mitglied'), h('option', { value: 'admin' }, 'Verwaltung'));
      body.append(h('form', { class: 'invite', onsubmit: async (e) => {
        e.preventDefault();
        try {
          await api(`/api/teams/${id}/members`, { method: 'POST', body: { user: input.value.trim(), role: role.value } });
          toast('Hinzugefügt');
          render();
          load();
        } catch (ex) {
          toast(ex.message);
        }
      } }, h('div', { class: 'label' }, 'Mitglied hinzufügen'), h('div', { class: 'invite-row' }, input, role, h('button', { type: 'submit', class: 'btn primary' }, 'Hinzufügen'))));
    }
    const list = h('div', { class: 'members' });
    for (const u of t.members) {
      const self = me && u.id === me.id;
      const controls = h('div', { class: 'row' },
        admin ? h('select', { onchange: async (e) => {
          try {
            await api(`/api/teams/${id}/members/${u.id}`, { method: 'PATCH', body: { role: e.target.value } });
            toast('Rolle geändert');
            render();
            load();
          } catch (ex) {
            toast(ex.message);
            render();
          }
        } }, h('option', { value: 'member', selected: u.role === 'member' }, 'Mitglied'), h('option', { value: 'admin', selected: u.role === 'admin' }, 'Verwaltung'))
          : h('span', { class: 'muted small' }, u.role === 'admin' ? 'Verwaltung' : 'Mitglied'),
        admin || self ? h('button', { class: 'btn small' + (self ? ' danger' : ''), onclick: async () => {
          if (self && !(await confirmDialog('Team verlassen', `Du verlierst den Zugriff auf die Boards des Teams „${t.name}“.`, 'Verlassen', true))) return;
          try {
            await api(`/api/teams/${id}/members/${u.id}`, { method: 'DELETE' });
            if (self) {
              m.close();
              view = { kind: 'all' };
            } else render();
            load();
          } catch (ex) {
            toast(ex.message);
          }
        } }, self ? 'Verlassen' : 'Entfernen') : null);
      list.append(h('div', { class: 'member' },
        h('span', { class: 'avatar sm', style: { background: u.color } }, initials(u.displayName)),
        h('div', { class: 'member-name' }, h('b', {}, u.displayName + (self ? ' (du)' : '')), h('span', { class: 'muted small' }, '@' + u.username)),
        controls));
    }
    body.append(h('div', {}, h('div', { class: 'label' }, `Mitglieder (${t.members.length})`), list));
    body.append(h('p', { class: 'muted small' }, 'Boards ordnest du über „Teilen“ → „Team“ zu. Dort legst du auch fest, ob das Team bearbeiten, kommentieren oder nur ansehen darf.'));
    if (admin) {
      body.append(h('div', { class: 'form-actions' }, h('button', { class: 'btn danger', onclick: async () => {
        if (!(await confirmDialog('Team löschen', `Das Team „${t.name}“ wird gelöscht. Die Boards bleiben bei ihren Besitzern erhalten, sind aber nicht mehr für das Team freigegeben.`, 'Löschen', true))) return;
        try {
          await api('/api/teams/' + id, { method: 'DELETE' });
          m.close();
          view = { kind: 'all' };
          load();
        } catch (ex) {
          toast(ex.message);
        }
      } }, 'Team löschen')));
    }
  };
  await render();
}

function boardMenu(anchor, b) {
  const owner = b.role === 'owner';
  menu(anchor, [
    { label: 'Öffnen', icon: 'fit', onClick: () => (location.href = '/board/' + b.id) },
    { label: owner ? 'Teilen & Team …' : 'Teilen …', icon: 'share', onClick: () => openShareDialog(b.id, { me, onLeave: load, onClose: load }) },
    { label: 'In Ordner verschieben …', icon: 'folder', onClick: () => moveToFolder(b) },
    ['owner', 'editor'].includes(b.role) ? { label: 'Umbenennen', icon: 'edit', onClick: async () => {
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
    } } : b.member || !(b.team && b.team.member) ? { label: b.member ? 'Board verlassen …' : 'Aus meiner Liste entfernen', icon: 'close', danger: true, onClick: async () => {
      // Mitglieder verlieren dabei den Zugriff – nur nach Rückfrage
      if (b.member && !(await confirmDialog('Board verlassen', `Du verlierst den Zugriff auf „${b.name}“, bis du erneut eingeladen wirst.`, 'Verlassen', true))) return;
      try {
        await api(`/api/boards/${b.id}/members/${me.id}`, { method: 'DELETE' });
        load();
      } catch (e) {
        toast(e.message);
      }
    } } : null,
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
  savePref('settings', { ...loadPref('settings', {}), dark, neon: undefined });
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
  document.getElementById('dash-bell').append(bellButton());
  refreshBell();
  load();
  loadTasks();
  legalFooter().then((f) => document.getElementById('footer').append(f));
  setInterval(() => {
    load();
    loadTasks();
    refreshBell();
  }, 30000);
})();
