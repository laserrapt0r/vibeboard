// Board-Übersicht (Startseite)
import { T, LOCALE } from './i18n.js';
import { h, api, ICONS, toast, modal, promptDialog, confirmDialog, initials, relTime, loadPref, savePref, readableOn, design, designReady } from './util.js';
import { TEMPLATES } from './templates.js';
import { templateGallery, loadCustom, byRecent, loadTemplate, markTemplateUsed, fillPreview } from './gallery.js';
import { menu } from './menu.js';
import { openShareDialog } from './share.js';
import { openProfileDialog, accountMenuItems, webhooksEnabled } from './account.js';
import { legalFooter } from './footer.js';
import { bellButton, refresh as refreshBell } from './notifications.js';

let data = { owned: [], shared: [], teams: [], folderList: [] };
// Ansicht: start | tasks | all | mine | shared | folder (id) | team (id, optional mit Ordner im Team)
let view = location.hash === '#aufgaben' ? { kind: 'tasks' } : location.hash === '#einladungen' ? { kind: 'start' } : loadPref('dashView', { kind: 'start' });
const BOARD_VIEWS = new Set(['all', 'mine', 'shared', 'folder', 'team']);
let me = null;
// „neon“: Einstellung aus 3.5.0, wird als dunkles Design übernommen
let dark = loadPref('settings', {}).dark || loadPref('settings', {}).neon;

async function load(quiet) {
  try {
    data = await api('/api/boards', { quiet });
  } catch (e) {
    toast(T('Boards konnten nicht geladen werden: ') + e.message);
  }
  render();
}

/* Meine Aufgaben: Karten aller zugänglichen Boards, die mir zugewiesen sind */
const DONE_RE = /^(fertig|erledigt|done|geschlossen|closed|abgeschlossen|resolved|gelöst|übernommen|completed|finished|hecho|terminado|completado|cerrado|resuelto|transferido|terminé|fait|fermé|résolu|reporté|carried over|terminée|terminada|hecha|fermée|cerrada|completada|resuelta|résolue|reportée|transferida)$/i;
const PRIO = { critical: ['⏫', T('Kritisch'), '#e03131'], high: ['▲', T('Hoch'), '#f08c00'], medium: ['■', T('Mittel'), '#1971c2'], low: ['▼', T('Niedrig'), '#868e96'] };
let tasks = [];

async function loadTasks(quiet) {
  try {
    tasks = (await api('/api/tasks', { quiet })).tasks;
  } catch {
    tasks = [];
  }
  render();
}

const todayStr = () => {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
};
const openTasks = () => tasks.filter((t) => !DONE_RE.test(t.status));
const overdueTasks = () => openTasks().filter((t) => t.due && t.due < todayStr());
let taskFilter = loadPref('dashTaskFilter', 'open');

function taskItem(t) {
  const overdue = t.due && t.due < todayStr() && !DONE_RE.test(t.status);
  const p = PRIO[t.priority];
  return h('a', { class: 'my-task', href: `/board/${encodeURIComponent(t.boardId)}#el=${encodeURIComponent(t.id)}` },
    h('span', { class: 'task-color', style: { background: t.color } }),
    h('span', { class: 'task-main' },
      h('span', { class: 'task-title' }, t.comment ? '💬 ' : '', t.key ? h('span', { class: 'muted' }, t.key + ' ') : null, t.title || T('Ohne Titel')),
      h('span', { class: 'task-meta' },
        h('span', {}, '🗂 ' + t.boardName),
        t.comment ? h('span', {}, T`Kommentar${t.by ? T(' · zugewiesen von ') + t.by : ''}`) : null,
        t.status ? h('span', {}, t.status) : null,
        p ? h('span', { style: { color: p[2] } }, `${p[0]} ${p[1]}`) : null,
        t.due ? h('span', { class: overdue ? 'overdue' : '' }, '📅 ' + new Date(t.due + 'T00:00').toLocaleDateString(LOCALE)) : null,
        t.points !== '' ? h('span', {}, T`${t.points} SP`) : null)));
}

function renderTasks() {
  const open = openTasks(), overdue = overdueTasks();
  document.getElementById('dash-tasks-count').textContent = T`${open.length} offen${overdue.length ? T` · ${overdue.length} überfällig` : ''}`;
  const seg = document.getElementById('dash-tasks-filter');
  seg.innerHTML = '';
  for (const [k, l] of [['open', T('Offen')], ['overdue', T('Überfällig')], ['done', T('Erledigt')], ['all', T('Alle')]]) {
    seg.append(h('button', { class: 'btn small' + (taskFilter === k ? ' active' : ''), onclick: () => {
      taskFilter = k;
      savePref('dashTaskFilter', k);
      renderTasks();
    } }, l));
  }
  const pick = { open, overdue, done: tasks.filter((t) => DONE_RE.test(t.status)), all: tasks }[taskFilter] || open;
  const list = [...pick].sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999') || a.title.localeCompare(b.title));
  const box = document.getElementById('dash-tasks');
  box.innerHTML = '';
  if (!list.length) {
    box.append(h('div', { class: 'dash-empty' }, !tasks.length
      ? T('Dir ist noch nichts zugewiesen. Hier erscheinen Karten mit deinem Namen als Zuständigkeit und Kommentare, die dir zugewiesen wurden – aus allen Boards.')
      : taskFilter === 'open' ? T('Keine offenen Aufgaben – alles erledigt. 🎉') : T('Keine Aufgaben für diesen Filter.')));
  }
  for (const t of list.slice(0, 200)) box.append(taskItem(t));
}

// Vorschaubild gleich beim Anlegen erzeugen – sonst entstünde es erst im Board (und nicht, wenn man sofort zurückgeht).
// Höchstens drei Sekunden warten, damit das Öffnen des Boards nicht spürbar verzögert wird.
async function uploadThumb(id, elements) {
  if (!elements.length) return;
  try {
    const { thumbnail } = await import('./exporter.js');
    const url = await Promise.race([thumbnail(elements), new Promise((r) => setTimeout(() => r(null), 3000))]);
    if (url) await api(`/api/boards/${id}/thumb`, { method: 'PUT', body: url, quiet: true });
  } catch {
    /* ohne Vorschaubild weiter – das Board erzeugt es beim Öffnen */
  }
}

async function createFromTemplate(t) {
  const name = await promptDialog(T('Neues Board'), T('Name des Boards'), t.id === 'blank' ? T('Unbenanntes Board') : t.name);
  if (name === null) return;
  try {
    const elements = (await loadTemplate(t)).build();
    const b = await api('/api/boards', { method: 'POST', body: { name: name.trim() || t.name, elements } });
    await Promise.all([uploadThumb(b.id, elements), markTemplateUsed(t)]);
    location.href = '/board/' + b.id;
  } catch (e) {
    toast(e.message);
  }
}

const QUICK_TEMPLATES = ['blank', 'brainstorm', 'kanban', 'retro-ssc', 'mindmap', 'bmc', 'swot', 'flowchart', 'journey'];
let templateState = { custom: [], recent: [] };

// Schnellauswahl: leeres Board, zuletzt verwendete Vorlagen, dann die häufigen – immer gleich viele Einträge
function quickTemplates() {
  // Vorgabe der Administration: nur zentrale und eigene Vorlagen
  const hide = design().hideBuiltin;
  const all = [...templateState.custom, ...(hide ? TEMPLATES.filter((t) => t.id === 'blank') : TEMPLATES)];
  const known = (id) => all.find((t) => t.id === id);
  const ids = [...new Set(['blank', ...templateState.recent.filter(known), ...(hide ? templateState.custom.map((t) => t.id) : QUICK_TEMPLATES)])];
  return byRecent(ids.slice(0, QUICK_TEMPLATES.length).map(known).filter(Boolean), templateState.recent);
}

function openAllTemplates() {
  const m = modal(T('Neues Board aus Vorlage'), templateGallery((t) => {
    m.close();
    createFromTemplate(t);
  }), { wide: true });
}

// „+ Neues Board“: leeres Board, häufige Vorlagen, alle Vorlagen
function newBoardMenu(anchor) {
  menu(anchor, [
    { header: T('Neues Board') },
    ...quickTemplates().map((t) => ({ label: `${t.icon}  ${t.name}`, onClick: () => createFromTemplate(t) })),
    '-',
    { label: T('Alle Vorlagen …'), icon: 'template', onClick: openAllTemplates },
  ], { placement: 'bottom' });
}

let tplCollapsed = loadPref('dashTplCollapsed', false);

/* Einladungen in Teams: annehmen oder ablehnen */
let invitations = [];

async function loadInvitations(quiet) {
  try {
    invitations = (await api('/api/team-invitations', { quiet })).invitations;
  } catch {
    invitations = [];
  }
  renderInvitations();
  renderNav();
}

function renderInvitations() {
  const box = document.getElementById('dash-invites');
  box.innerHTML = '';
  for (const i of invitations) {
    const answer = async (accept) => {
      try {
        await api(`/api/team-invitations/${i.teamId}/${accept ? 'accept' : 'decline'}`, { method: 'POST' });
        toast(accept ? T`Du bist jetzt im Team „${i.teamName}“` : T('Einladung abgelehnt'));
        await loadInvitations();
        await load();
        refreshBell();
        if (accept) setView({ kind: 'team', id: i.teamId });
      } catch (e) {
        toast(e.message);
        loadInvitations();
      }
    };
    box.append(h('div', { class: 'invite-card', role: 'group', 'aria-label': T`Einladung in ${i.teamName}` },
      h('span', { class: 'nav-icon', html: ICONS.team }),
      h('span', { class: 'invite-text' }, h('b', {}, i.by || T('Jemand')), T` lädt dich in das Team „${i.teamName}“ ein`, h('span', { class: 'muted small' }, T` · als ${i.role === 'admin' ? T('Verwaltung') : T('Mitglied')} · ${relTime(i.createdAt)}`)),
      h('button', { class: 'btn small primary', onclick: () => answer(true) }, T('Annehmen')),
      h('button', { class: 'btn small', onclick: () => answer(false) }, T('Ablehnen'))));
  }
}

function renderTemplates() {
  const box = document.getElementById('dash-templates');
  const toggle = document.getElementById('dash-tpl-toggle');
  toggle.textContent = tplCollapsed ? T('Ausklappen') : T('Einklappen');
  box.classList.toggle('hidden', tplCollapsed);
  box.innerHTML = '';
  if (tplCollapsed) return;
  for (const t of quickTemplates()) {
    const prev = h('div', { class: 'tpl-prev' });
    fillPreview(prev, t);
    box.append(h('button', { class: 'tpl-card', title: t.description, onclick: () => createFromTemplate(t) }, prev, h('div', { class: 'tpl-info' }, h('div', { class: 'tpl-name' }, `${t.icon}  ${t.name}`))));
  }
}

const ROLE_LABEL = { owner: T('Besitzer'), editor: T('Bearbeiten'), commenter: T('Kommentieren'), viewer: T('Ansehen') };

const allBoards = () => [...data.owned, ...data.shared];
const inTeam = (b, id) => b.team && b.team.id === id && (b.team.member || b.role === 'owner');
const teamById = (id) => data.teams.find((t) => t.id === id);
const folderById = (id) => data.folderList.find((f) => f.id === id);

function sortList(list) {
  const q = document.getElementById('dash-search').value.trim().toLowerCase();
  const sort = document.getElementById('dash-sort').value;
  return list
    .filter((b) => !q || b.name.toLowerCase().includes(q) || (b.owner && b.owner.displayName.toLowerCase().includes(q)))
    .sort((a, b) => (sort === 'name' ? a.name.localeCompare(b.name, LOCALE) : sort === 'created' ? b.createdAt - a.createdAt : b.updatedAt - a.updatedAt));
}

function card(b) {
  const shared = b.role !== 'owner';
  const thumb = h('div', { class: 'board-thumb' });
  if (b.hasThumb) thumb.append(h('img', { src: `/api/boards/${b.id}/thumb?t=${b.updatedAt}`, alt: '', loading: 'lazy' }));
  else thumb.append(h('div', { class: 'board-thumb-empty' }, '🗒️'));
  const more = h('button', { class: 'icon-btn small', title: T('Aktionen'), html: ICONS.more });
  more.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    boardMenu(more, b);
  };
  const badges = [];
  // Team nur anzeigen, wenn man selbst dazugehört (oder das Board besitzt)
  if (b.team && (b.team.member || b.role === 'owner')) badges.push(h('span', { class: 'tag', title: T`Team „${b.team.name}“ (${ROLE_LABEL[b.team.role]})` }, '👥 ' + b.team.name));
  if (b.linkAccess !== 'private') badges.push(h('span', { class: 'tag', title: T('Per Link freigegeben') }, '🔗'));
  if (b.memberCount) badges.push(h('span', { class: 'tag', title: T`${b.memberCount} Mitglied(er)` }, '👤 ' + b.memberCount));
  for (const fid of b.folders || []) {
    const f = folderById(fid);
    if (f && !(view.kind === 'folder' && view.id === fid)) badges.push(h('span', { class: 'tag', title: T('Ordner') }, '📁 ' + f.name));
  }
  return h('a', { class: 'board-card', href: '/board/' + b.id }, thumb,
    h('div', { class: 'board-info' },
      h('div', { class: 'board-name' }, b.name),
      h('div', { class: 'board-meta' },
        shared && b.owner ? T`von ${b.owner.displayName} · ${ROLE_LABEL[b.role]} · ` : '',
        T`${relTime(b.updatedAt)} · ${b.elementCount} Elemente`,
        b.online ? h('span', { class: 'online' }, T` · ${b.online} online`) : null),
      badges.length ? h('div', { class: 'board-tags' }, badges) : null),
    more);
}

/* ---------------- Navigation: Alle, Meine, Geteilt, Ordner, Teams ---------------- */

function setView(v) {
  view = v;
  savePref('dashView', v);
  history.replaceState(null, '', v.kind === 'tasks' ? '/#aufgaben' : '/');
  render();
  scrollTo({ top: 0 });
}

// Rechts erscheint nur, was links gewählt ist (beim Suchen immer die Board-Liste)
function render() {
  document.getElementById('dash-skeleton')?.remove();
  const searching = !!document.getElementById('dash-search').value.trim();
  const kind = searching && !BOARD_VIEWS.has(view.kind) ? 'all' : view.kind;
  document.getElementById('dash-start').classList.toggle('hidden', kind !== 'start');
  document.getElementById('dash-tasks-view').classList.toggle('hidden', kind !== 'tasks');
  document.getElementById('dash-boards-view').classList.toggle('hidden', !BOARD_VIEWS.has(kind));
  document.getElementById('dash-trash-view').classList.toggle('hidden', kind !== 'trash');
  if (kind === 'start') renderStart();
  if (kind === 'tasks') renderTasks();
  if (kind === 'trash') renderTrash();
  renderBoards();
}

/* ---------------- Papierkorb ---------------- */

let trash = { days: 30, boards: [] };

async function loadTrash(quiet) {
  try {
    trash = await api('/api/trash', { quiet });
  } catch {
    trash = { days: 30, boards: [] };
  }
  renderNav();
  if (view.kind === 'trash') renderTrash();
}

function renderTrash() {
  const box = document.getElementById('dash-trash');
  document.getElementById('dash-trash-info').textContent = T`Gelöschte Boards bleiben ${trash.days} Tage im Papierkorb und werden danach endgültig entfernt. Nur du siehst deine gelöschten Boards.`;
  box.innerHTML = '';
  if (!trash.boards.length) {
    box.append(h('div', { class: 'dash-empty' }, T('Der Papierkorb ist leer.')));
    return;
  }
  for (const b of trash.boards) {
    const days = Math.max(0, Math.ceil((b.purgeAt - Date.now()) / 86400000));
    const thumb = h('div', { class: 'board-thumb' });
    if (b.hasThumb) thumb.append(h('img', { src: `/api/trash/${b.id}/thumb?t=${b.deletedAt}`, alt: '', loading: 'lazy' }));
    else thumb.append(h('div', { class: 'board-thumb-empty' }, '🗑️'));
    box.append(h('div', { class: 'board-card trashed' }, thumb,
      h('div', { class: 'board-info' },
        h('div', { class: 'board-name' }, b.name),
        h('div', { class: 'board-meta' }, T`gelöscht ${relTime(b.deletedAt)} · ${b.elementCount} Elemente · Tage übrig: ${days}`),
        h('div', { class: 'row', style: { marginTop: '8px' } },
          h('button', { class: 'btn small primary', onclick: async () => {
            try {
              await api(`/api/trash/${b.id}/restore`, { method: 'POST' });
              toast(T`„${b.name}“ wiederhergestellt`);
              await loadTrash();
              load();
            } catch (e) {
              toast(e.message);
            }
          } }, h('span', { html: ICONS.restore }), T('Wiederherstellen')),
          h('button', { class: 'btn small danger', onclick: async () => {
            if (!(await confirmDialog(T('Endgültig löschen'), T`„${b.name}“ wird mit allen Inhalten, Versionen, Dateien und Aufzeichnungen endgültig gelöscht. Das lässt sich nicht rückgängig machen.`, T('Endgültig löschen'), true))) return;
            try {
              await api(`/api/trash/${b.id}`, { method: 'DELETE' });
              toast(T('Endgültig gelöscht'));
              loadTrash();
            } catch (e) {
              toast(e.message);
            }
          } }, T('Endgültig löschen'))))));
  }
}

// Start: einklappbare Vorlagenleiste, Hinweis auf fällige Aufgaben, zuletzt bearbeitete Boards
function renderStart() {
  const due = document.getElementById('dash-due');
  due.innerHTML = '';
  const overdue = overdueTasks().length;
  const week = new Date(Date.now() + 7 * 86400000);
  const weekStr = `${week.getFullYear()}-${String(week.getMonth() + 1).padStart(2, '0')}-${String(week.getDate()).padStart(2, '0')}`;
  const soon = openTasks().filter((t) => t.due && t.due >= todayStr() && t.due <= weekStr).length;
  if (overdue || soon) {
    due.append(h('button', { class: 'due-hint' + (overdue ? ' overdue' : ''), onclick: () => setView({ kind: 'tasks' }) },
      h('span', { class: 'nav-icon', html: ICONS.tasks }),
      h('span', {}, [overdue === 1 ? T('1 überfällige Aufgabe') : overdue ? T`${overdue} überfällige Aufgaben` : '', soon ? T`${soon} in den nächsten 7 Tagen fällig` : ''].filter(Boolean).join(' · ')),
      h('span', { class: 'muted' }, T('Meine Aufgaben →'))));
  }
  const recent = document.getElementById('dash-recent');
  recent.innerHTML = '';
  const list = [...allBoards()].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 8);
  if (list.length) list.forEach((b) => recent.append(card(b)));
  else recent.append(h('div', { class: 'dash-empty' }, T('Noch keine Boards – wähle oben eine Vorlage oder links „Neues Board“.')));
}


function renderNav() {
  const nav = document.getElementById('dash-nav');
  nav.innerHTML = '';
  const item = (label, v, count, icon, cls = '') => h('button', {
    class: 'dash-nav-item' + (view.kind === v.kind && view.id === v.id ? ' active' : ''), onclick: () => setView(v),
  }, icon ? h('span', { class: 'nav-icon', html: ICONS[icon] }) : null, h('span', { class: 'nav-label' }, label), count != null ? h('span', { class: 'nav-count ' + cls }, count) : null);
  const add = h('button', { class: 'btn primary dash-new' }, h('span', { html: ICONS.plus }), T('Neues Board'));
  add.onclick = () => newBoardMenu(add);
  const overdue = overdueTasks().length;
  nav.append(
    add,
    item(T('Startseite'), { kind: 'start' }, null, 'home'),
    item(T('Meine Aufgaben'), { kind: 'tasks' }, overdue || openTasks().length || null, 'tasks', overdue ? 'alert' : ''),
    h('div', { class: 'dash-nav-head' }, h('span', {}, T('Boards'))),
    item(T('Alle Boards'), { kind: 'all' }, allBoards().length, 'template'),
    item(T('Meine Boards'), { kind: 'mine' }, data.owned.length, 'users'),
    item(T('Mit mir geteilt'), { kind: 'shared' }, data.shared.length, 'share'));
  const personal = data.folderList.filter((f) => !f.teamId);
  nav.append(h('div', { class: 'dash-nav-head' }, h('span', {}, T('Ordner')), h('button', { class: 'icon-btn small', title: T('Neuer Ordner'), html: ICONS.plus, onclick: () => newFolder(null) })));
  if (!personal.length) nav.append(h('div', { class: 'dash-nav-hint' }, T('Eigene Ordner – nur für dich sichtbar.')));
  for (const f of personal) nav.append(item(f.name, { kind: 'folder', id: f.id }, allBoards().filter((b) => b.folders.includes(f.id)).length, 'folder'));
  nav.append(h('div', { class: 'dash-nav-head' }, h('span', {}, T('Teams')), h('button', { class: 'icon-btn small', title: T('Team erstellen'), html: ICONS.plus, onclick: newTeam })));
  if (invitations.length) nav.append(h('button', { class: 'dash-nav-item invite-link', onclick: () => setView({ kind: 'start' }) }, h('span', { class: 'nav-icon', html: ICONS.bell }), h('span', { class: 'nav-label' }, T('Einladungen')), h('span', { class: 'nav-count alert' }, invitations.length)));
  if (!data.teams.length) nav.append(h('div', { class: 'dash-nav-hint' }, T('Teams teilen Boards mit allen Mitgliedern auf einmal.')));
  for (const t of data.teams) nav.append(item(t.name, { kind: 'team', id: t.id }, allBoards().filter((b) => inTeam(b, t.id)).length, 'team'));
  nav.append(h('div', { class: 'dash-nav-sep' }), item(T('Papierkorb'), { kind: 'trash' }, trash.boards.length || null, 'trash'));
}

function renderBoards() {
  // Ansicht existiert nicht mehr (Ordner gelöscht, Team verlassen)
  if ((view.kind === 'folder' && !folderById(view.id)) || (view.kind === 'team' && !teamById(view.id))) {
    view = { kind: 'all' };
    return render();
  }
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
  let empty = T('Noch keine Boards – lege links über „Neues Board“ eines an.');
  if (view.kind === 'mine') {
    title.textContent = T('Meine Boards');
    list = data.owned;
  } else if (view.kind === 'shared') {
    title.textContent = T('Mit mir geteilt');
    list = data.shared;
    empty = T('Noch keine geteilten Boards. Boards, zu denen du eingeladen wirst oder die ein Team mit dir teilt, erscheinen hier.');
  } else if (view.kind === 'folder') {
    const f = folderById(view.id);
    title.textContent = '📁 ' + f.name;
    list = list.filter((b) => b.folders.includes(f.id));
    empty = T('Dieser Ordner ist leer. Über „…“ an einem Board → „In Ordner verschieben“ legst du Boards hinein.');
    actions.append(folderActions(f));
  } else if (view.kind === 'team') {
    const t = teamById(view.id);
    title.textContent = '👥 ' + t.name;
    list = list.filter((b) => inTeam(b, t.id));
    empty = T('Noch keine Boards in diesem Team. Ordne ein Board über „Teilen“ → „Team“ zu.');
    actions.append(
      h('button', { class: 'btn small', onclick: () => openTeamDialog(t.id) }, h('span', { html: ICONS.team }), T('Mitglieder')),
      h('button', { class: 'btn small', onclick: () => newFolder(t.id) }, h('span', { html: ICONS.folder }), T('Ordner anlegen')));
    // Ordner im Team als Filter
    const tf = data.folderList.filter((f) => f.teamId === t.id);
    if (tf.length) {
      fbar.classList.remove('hidden');
      const chip = (label, fid, n) => h('button', { class: 'chip' + ((view.folder || null) === fid ? ' active' : ''), onclick: () => setView({ ...view, folder: fid }) }, label, h('span', { class: 'muted' }, ` ${n}`));
      fbar.append(chip(T('Alle'), null, list.length));
      for (const f of tf) {
        const c = chip('📁 ' + f.name, f.id, list.filter((b) => b.folders.includes(f.id)).length);
        c.oncontextmenu = (e) => {
          e.preventDefault();
          menu(c, folderMenuItems(f));
        };
        fbar.append(c);
      }
      fbar.append(chip(T('Ohne Ordner'), '-', list.filter((b) => !b.folders.some((x) => tf.some((f) => f.id === x))).length));
      if (view.folder === '-') {
        list = list.filter((b) => !b.folders.some((x) => tf.some((f) => f.id === x)));
        empty = T('Alle Boards dieses Teams liegen in Ordnern.');
      } else if (view.folder) {
        list = list.filter((b) => b.folders.includes(view.folder));
        empty = T('Dieser Ordner ist leer. Über „…“ an einem Board → „In Ordner verschieben“ legst du Boards hinein.');
      }
      const cur = view.folder && view.folder !== '-' && folderById(view.folder);
      if (cur) actions.append(folderActions(cur));
    }
  } else title.textContent = BOARD_VIEWS.has(view.kind) ? T('Alle Boards') : T('Suchergebnisse');
  const box = document.getElementById('dash-boards');
  box.innerHTML = '';
  const sorted = sortList(list);
  if (sorted.length) sorted.forEach((b) => box.append(card(b)));
  else box.append(h('div', { class: 'dash-empty' }, list.length ? T('Keine passenden Boards.') : empty));
}

function folderMenuItems(f) {
  return [
    { header: f.name },
    { label: T('Umbenennen'), icon: 'edit', onClick: async () => {
      const n = await promptDialog(T('Ordner umbenennen'), T('Name'), f.name);
      if (n && n.trim()) await api(`/api/folders/${f.id}`, { method: 'PATCH', body: { name: n.trim() } }).catch((e) => toast(e.message));
      load();
    } },
    { label: T('Ordner löschen'), icon: 'trash', danger: true, onClick: async () => {
      if (!(await confirmDialog(T('Ordner löschen'), T`Der Ordner „${f.name}“ wird gelöscht. Die Boards darin bleiben erhalten.`, T('Löschen'), true))) return;
      await api(`/api/folders/${f.id}`, { method: 'DELETE' }).catch((e) => toast(e.message));
      load();
    } },
  ];
}

function folderActions(f) {
  const b = h('button', { class: 'btn small', title: T('Ordner bearbeiten') }, h('span', { html: ICONS.more }), T('Ordner'));
  b.onclick = () => menu(b, folderMenuItems(f), { placement: 'bottom' });
  return b;
}

async function newFolder(teamId) {
  const n = await promptDialog(teamId ? T('Ordner im Team anlegen') : T('Neuer Ordner'), teamId ? T('Name (für alle im Team sichtbar)') : T('Name (nur für dich sichtbar)'), '');
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
  const n = await promptDialog(T('Team erstellen'), T('Name des Teams'), '');
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
  const m = modal(T`„${b.name}“ in Ordner verschieben`, body);
  if (!options.length) body.append(h('p', { class: 'muted' }, T('Noch keine Ordner. Lege links unter „Ordner“ einen an.')));
  const groups = [[null, T('Meine Ordner')], ...(b.team ? [[b.team.id, T`Team „${b.team.name}“`]] : [])];
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
          toast(inIt ? T('Aus dem Ordner entfernt') : T`In „${f.name}“ verschoben`);
          load();
        } catch (e) {
          toast(e.message);
        }
      } }, h('span', { html: ICONS.folder }), f.name, inIt ? h('span', { class: 'muted small' }, T(' – enthalten, Klick entfernt')) : null));
    }
  }
}

/* ---------------- Team verwalten ---------------- */

async function openTeamDialog(id) {
  const body = h('div', { class: 'form share' });
  const m = modal(T('Team'), body);
  const render = async () => {
    let t;
    try {
      t = await api('/api/teams/' + id);
    } catch (e) {
      body.textContent = e.message;
      return;
    }
    body.closest('.modal')?.querySelector('h2')?.replaceChildren(T`Team „${t.name}“`);
    const admin = t.myRole === 'admin';
    body.innerHTML = '';
    if (admin) {
      const name = h('input', { type: 'text', value: t.name, maxlength: 80 });
      body.append(h('label', {}, T('Name'), h('div', { class: 'copy-row' }, name, h('button', { class: 'btn', onclick: async () => {
        await api('/api/teams/' + id, { method: 'PATCH', body: { name: name.value } }).then(() => toast(T('Gespeichert'))).catch((e) => toast(e.message));
        load();
      } }, T('Speichern')))));
      // Einladen über die E-Mail-Adresse – Mitglied wird die Person erst, wenn sie annimmt
      const input = h('input', { type: 'email', placeholder: T('E-Mail-Adresse'), autocomplete: 'off', inputmode: 'email', required: true });
      const role = h('select', {}, h('option', { value: 'member' }, T('Mitglied')), h('option', { value: 'admin' }, T('Verwaltung')));
      body.append(h('form', { class: 'invite', onsubmit: async (e) => {
        e.preventDefault();
        const send = async (inviteUnregistered) => {
          const email = input.value.trim();
          try {
            const r = await api(`/api/teams/${id}/invitations`, { method: 'POST', body: { email, role: role.value, inviteUnregistered } });
            toast(r.invited ? T('Einladung verschickt – nach der Registrierung gehört die Person zum Team') : T('Einladung verschickt – die Person muss sie noch annehmen'), 4000);
            render();
          } catch (ex) {
            if (ex.code === 'not_registered' && !inviteUnregistered) {
              if (await confirmDialog(T('Keine registrierte Adresse'), T`${email} ist nicht registriert. Soll eine Einladung per E-Mail verschickt werden? Nach der Registrierung gehört die Person zum Team.`, T('Einladung verschicken'))) send(true);
              return;
            }
            toast(ex.message, 5000);
          }
        };
        send(false);
      } }, h('div', { class: 'label' }, T('Person einladen')), h('div', { class: 'invite-row' }, input, role, h('button', { type: 'submit', class: 'btn primary' }, T('Einladen'))),
      h('p', { class: 'muted small' }, T('Die Person bekommt eine Benachrichtigung und tritt dem Team erst bei, wenn sie die Einladung annimmt.'))));
      if (t.invitations.length || t.pending.length) {
        const inv = h('div', { class: 'members' });
        for (const p of t.pending) {
          inv.append(h('div', { class: 'member' },
            h('span', { class: 'avatar sm' }, '✉'),
            h('div', { class: 'member-name' }, h('b', {}, p.email), h('span', { class: 'muted small' }, T`noch nicht registriert · eingeladen ${relTime(p.createdAt)}`)),
            h('button', { class: 'btn small', onclick: async () => {
              await api(`/api/teams/${id}/pending/${p.id}`, { method: 'DELETE' }).catch((e) => toast(e.message));
              render();
            } }, T('Zurückziehen'))));
        }
        for (const u of t.invitations) {
          inv.append(h('div', { class: 'member' },
            h('span', { class: 'avatar sm', style: { background: u.color } }, initials(u.displayName)),
            h('div', { class: 'member-name' }, h('b', {}, u.displayName), h('span', { class: 'muted small' }, T`${u.email} · eingeladen ${relTime(u.createdAt)} als ${u.role === 'admin' ? T('Verwaltung') : T('Mitglied')}`)),
            h('button', { class: 'btn small', onclick: async () => {
              await api(`/api/teams/${id}/invitations/${u.id}`, { method: 'DELETE' }).catch((e) => toast(e.message));
              render();
            } }, T('Zurückziehen'))));
        }
        body.append(h('div', {}, h('div', { class: 'label' }, T`Offene Einladungen (${t.invitations.length + t.pending.length})`), inv));
      }
    }
    const list = h('div', { class: 'members' });
    for (const u of t.members) {
      const self = me && u.id === me.id;
      const controls = h('div', { class: 'row' },
        admin ? h('select', { onchange: async (e) => {
          try {
            await api(`/api/teams/${id}/members/${u.id}`, { method: 'PATCH', body: { role: e.target.value } });
            toast(T('Rolle geändert'));
            render();
            load();
          } catch (ex) {
            toast(ex.message);
            render();
          }
        } }, h('option', { value: 'member', selected: u.role === 'member' }, T('Mitglied')), h('option', { value: 'admin', selected: u.role === 'admin' }, T('Verwaltung')))
          : h('span', { class: 'muted small' }, u.role === 'admin' ? T('Verwaltung') : T('Mitglied')),
        admin || self ? h('button', { class: 'btn small' + (self ? ' danger' : ''), onclick: async () => {
          if (self && !(await confirmDialog(T('Team verlassen'), T`Du verlierst den Zugriff auf die Boards des Teams „${t.name}“.`, T('Verlassen'), true))) return;
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
        } }, self ? T('Verlassen') : T('Entfernen')) : null);
      list.append(h('div', { class: 'member' },
        h('span', { class: 'avatar sm', style: { background: u.color } }, initials(u.displayName)),
        h('div', { class: 'member-name' }, h('b', {}, u.displayName + (self ? T(' (du)') : '')), u.email ? h('span', { class: 'muted small' }, u.email) : null),
        controls));
    }
    body.append(h('div', {}, h('div', { class: 'label' }, T`Mitglieder (${t.members.length})`), list));
    body.append(h('p', { class: 'muted small' }, T('Boards ordnest du über „Teilen“ → „Team“ zu. Dort legst du auch fest, ob das Team bearbeiten, kommentieren oder nur ansehen darf.')));
    if (admin) {
      body.append(h('div', { class: 'form-actions' }, h('button', { class: 'btn', disabled: !webhooksEnabled(), title: webhooksEnabled() ? null : T('abgeschaltet'), onclick: () => import('./webhooks-ui.js').then((mod) => mod.openWebhooks({ teamId: id, teamName: t.name })) }, T('Chat-Anbindung …')), h('span', { class: 'spacer' }), h('button', { class: 'btn danger', onclick: async () => {
        if (!(await confirmDialog(T('Team löschen'), T`Das Team „${t.name}“ wird gelöscht. Die Boards bleiben bei ihren Besitzern erhalten, sind aber nicht mehr für das Team freigegeben.`, T('Löschen'), true))) return;
        try {
          await api('/api/teams/' + id, { method: 'DELETE' });
          m.close();
          view = { kind: 'all' };
          load();
        } catch (ex) {
          toast(ex.message);
        }
      } }, T('Team löschen'))));
    }
  };
  await render();
}

function boardMenu(anchor, b) {
  const owner = b.role === 'owner';
  menu(anchor, [
    { label: T('Öffnen'), icon: 'fit', onClick: () => (location.href = '/board/' + b.id) },
    { label: owner ? T('Teilen & Team …') : T('Teilen …'), icon: 'share', onClick: () => openShareDialog(b.id, { me, onLeave: load, onClose: load }) },
    { label: T('In Ordner verschieben …'), icon: 'folder', onClick: () => moveToFolder(b) },
    ['owner', 'editor'].includes(b.role) ? { label: T('Umbenennen'), icon: 'edit', onClick: async () => {
      const n = await promptDialog(T('Board umbenennen'), T('Name'), b.name);
      if (n && n.trim()) {
        await api('/api/boards/' + b.id, { method: 'PATCH', body: { name: n.trim() } }).catch((e) => toast(e.message));
        load();
      }
    } } : null,
    { label: T('Duplizieren'), icon: 'copy', onClick: async () => {
      try {
        await api(`/api/boards/${b.id}/duplicate`, { method: 'POST' });
        toast(T('Board dupliziert – die Kopie gehört dir'));
        load();
      } catch (e) {
        toast(e.message);
      }
    } },
    { label: T('Link kopieren'), icon: 'link', onClick: async () => {
      try {
        await navigator.clipboard.writeText(location.origin + '/board/' + b.id);
        toast(T('Link kopiert'));
      } catch {
        toast(location.origin + '/board/' + b.id, 5000);
      }
    } },
    '-',
    owner ? { label: T('In den Papierkorb'), icon: 'trash', danger: true, onClick: async () => {
      if (await confirmDialog(T('Board löschen'), T`„${b.name}“ kommt in den Papierkorb und ist für alle Mitglieder nicht mehr erreichbar. Du kannst es dort wiederherstellen, bis es nach Ablauf der Frist endgültig gelöscht wird.`, T('In den Papierkorb'), true)) {
        try {
          await api('/api/boards/' + b.id, { method: 'DELETE' });
          toast(T('Board liegt im Papierkorb'), 5000, { label: T('Rückgängig'), onClick: async () => {
            await api(`/api/trash/${b.id}/restore`, { method: 'POST' }).catch((e) => toast(e.message));
            load();
            loadTrash(true);
          } });
          load();
          loadTrash(true);
        } catch (e) {
          toast(e.message);
        }
      }
    } } : b.member || !(b.team && b.team.member) ? { label: b.member ? T('Board verlassen …') : T('Aus meiner Liste entfernen'), icon: 'close', danger: true, onClick: async () => {
      // Mitglieder verlieren dabei den Zugriff – nur nach Rückfrage
      if (b.member && !(await confirmDialog(T('Board verlassen'), T`Du verlierst den Zugriff auf „${b.name}“, bis du erneut eingeladen wirst.`, T('Verlassen'), true))) return;
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
  b.style.color = readableOn(me.color);
  b.title = me.displayName + T(' – Konto');
  document.getElementById('dash-admin').classList.toggle('hidden', me.role !== 'admin');
  // Ältere Konten ohne E-Mail-Adresse: Anmeldung künftig nur noch per E-Mail
  const hint = document.getElementById('dash-account-hint');
  hint.innerHTML = '';
  if (!me.email && !me.pendingEmail) {
    hint.append(h('div', { class: 'invite-card warn', role: 'status' },
      h('span', { class: 'invite-text' }, h('b', {}, T('Bitte hinterlege eine E-Mail-Adresse. ')), T('Die Anmeldung ist künftig nur noch mit E-Mail-Adresse möglich; ohne Adresse kannst du außerdem nicht zu Teams oder Boards eingeladen werden.')),
      h('button', { class: 'btn small primary', onclick: () => openProfileDialog(me, (u) => {
        me = u;
        renderUser();
      }) }, T('Jetzt ergänzen'))));
  }
}

function applyDark() {
  document.body.classList.toggle('dark', !!dark);
  document.getElementById('dash-dark').innerHTML = ICONS.moon;
}

document.getElementById('dash-search').addEventListener('input', render);
document.getElementById('dash-tpl-toggle').addEventListener('click', () => {
  tplCollapsed = !tplCollapsed;
  savePref('dashTplCollapsed', tplCollapsed);
  renderTemplates();
});
document.getElementById('dash-show-all').addEventListener('click', () => setView({ kind: 'all' }));
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
document.getElementById('dash-all-templates').addEventListener('click', openAllTemplates);
window.addEventListener('hashchange', () => {
  if (location.hash === '#aufgaben') setView({ kind: 'tasks' });
  if (location.hash === '#einladungen') {
    setView({ kind: 'start' });
    loadInvitations();
  }
});

const importInput = h('input', { type: 'file', accept: '.json,application/json,.drawio,.pptx', style: { display: 'none' } });
document.body.append(importInput);
document.getElementById('dash-import').addEventListener('click', () => importInput.click());
importInput.addEventListener('change', async () => {
  const f = importInput.files[0];
  importInput.value = '';
  if (!f) return;
  try {
    // draw.io und PowerPoint: Der Dateiname wird zum Namen des Boards
    const foreign = /\.(drawio|pptx)$/i.test(f.name) ? await (await import('./import-file.js')).readForeign(f) : null;
    const d = foreign ? { name: f.name.replace(/\.[a-z]+$/i, ''), elements: foreign.elements } : JSON.parse(await f.text());
    const elements = Array.isArray(d) ? d : Array.isArray(d.elements) ? d.elements : Object.values(d.elements || {});
    const b = await api('/api/boards', { method: 'POST', body: { name: d.name || f.name.replace(/\.((dlz|vibe)board\.)?json$/, ''), elements } });
    if (b.rejected && b.rejected.length) {
      toast(T`${b.rejected.length} Bild(er) wurden nicht übernommen: ${b.rejected[0].reason}`, 6000);
      setTimeout(() => (location.href = '/board/' + b.id), 4000);
      return;
    }
    location.href = '/board/' + b.id;
  } catch (e) {
    toast(T('Import fehlgeschlagen: ') + e.message);
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
  Promise.all([loadCustom(), designReady]).then(([r]) => {
    templateState = r;
    renderTemplates();
  });
  document.getElementById('dash-bell').append(bellButton());
  refreshBell();
  load();
  loadTasks();
  loadInvitations();
  loadTrash(true);
  legalFooter().then((f) => document.getElementById('footer').append(f));
  setInterval(() => {
    load(true);
    loadTasks(true);
    loadInvitations(true);
    refreshBell();
  }, 30000);
})();
