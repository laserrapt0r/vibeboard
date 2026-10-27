// Projektarbeit: Aufgaben-Übersicht, Versionsverlauf, Import von Karten aus CSV, Direktlinks auf Elemente
import { h, ICONS, toast, modal, api, initials, relTime, confirmDialog, promptDialog, throttle, uid } from './util.js';
import { app, getEl, bounds, fitTo, setSelection } from './core.js';
import { currentSidePanel, renderSidePanel, toggleSidePanel, placeElements } from './ui.js';

const renderSidePanelClose = () => toggleSidePanel(currentSidePanel());
import { PRIORITIES, cardTags } from './render.js';

export const DONE_RE = /^(fertig|erledigt|done|geschlossen|closed|abgeschlossen|resolved|gelöst)$/i;

// Datum in lokaler Zeit (nicht UTC), damit „überfällig“ um Mitternacht stimmt
const localDate = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const today = () => localDate();
const statusOf = (c) => String(c.status || '').trim();
const isDone = (c) => DONE_RE.test(statusOf(c));
const isOverdue = (c) => c.due && !isDone(c) && c.due < today();
const fmtDue = (d) => {
  if (!d) return '';
  const date = new Date(d + 'T00:00');
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString('de-DE', sameYear ? { day: '2-digit', month: '2-digit' } : { day: '2-digit', month: '2-digit', year: 'numeric' });
};

function jumpTo(el) {
  if (!el) return;
  // Auf schmalen Bildschirmen verdeckt das Panel die Karte
  if (innerWidth < 760 && currentSidePanel()) renderSidePanelClose();
  if (el.type === 'comment') {
    fitTo({ x: el.x - 200, y: el.y - 200, w: 400, h: 400 }, { maxZ: 1.5 });
    setTimeout(() => app.emit('openComment', el.id), 320);
    return;
  }
  setSelection([el.id]);
  fitTo(bounds(el), { maxZ: 1.5, pad: 200 });
}

// Zugewiesene Kommentare erscheinen wie Karten in der Aufgabenliste
function commentTasks() {
  return [...app.els.values()].filter((e) => e.type === 'comment' && e.task && (e.thread || []).length).map((c) => ({
    id: c.id, type: 'comment', title: '💬 ' + String(c.thread[0].text).slice(0, 120), status: c.resolved ? 'Erledigt' : 'Offen',
    due: c.task.due, assignee: c.task.assignee, assigneeId: c.task.assigneeId, color: '#f08c00',
  }));
}

/* ================================================================== */
/* Aufgaben-Panel                                                      */
/* ================================================================== */

let taskFilter = 'open';

function matchesMe(c) {
  if (c.type === 'comment') return c.assigneeId === String(app.user.id);
  const a = String(c.assignee || '').trim().toLowerCase();
  return !!a && [app.user.name, app.me && app.me.username].filter(Boolean).some((n) => n.toLowerCase() === a);
}

function renderTasks(side, close) {
  const cards = [...app.els.values()].filter((e) => e.type === 'card' && !e.hidden).concat(commentTasks());
  const filters = [['open', 'Offen'], ['mine', 'Mir zugewiesen'], ['overdue', 'Überfällig'], ['all', 'Alle']];
  const list = cards.filter((c) => taskFilter === 'all' || (taskFilter === 'open' && !isDone(c)) ||
    (taskFilter === 'mine' && matchesMe(c)) || (taskFilter === 'overdue' && isOverdue(c)));
  const open = cards.filter((c) => !isDone(c)).length;
  side.append(h('div', { class: 'side-head' }, h('h3', {}, `Aufgaben (${open} offen)`), h('span', { class: 'spacer' }), close));
  side.append(h('div', { class: 'side-actions' }, h('div', { class: 'seg' }, filters.map(([k, l]) =>
    h('button', { class: 'btn small' + (taskFilter === k ? ' active' : ''), onclick: () => { taskFilter = k; renderSidePanel(); } }, l)))));
  if (!cards.length) {
    side.append(h('p', { class: 'muted pad' }, 'Noch keine Karten. Mit dem Karten-Werkzeug (K) legst du Aufgaben mit Zuständigkeit, Fälligkeit, Status, Priorität und Story Points an – oder du importierst sie aus einer CSV-Datei.'));
    side.append(h('div', { class: 'side-actions' }, app.viewOnly ? null : h('button', { class: 'btn small', onclick: () => app.emit('openCsvImport') }, h('span', { html: ICONS.upload }), 'Aus CSV importieren')));
    return;
  }
  // Nach Status gruppieren
  const groups = new Map();
  for (const c of list.sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999') || String(a.title).localeCompare(String(b.title)))) {
    const k = statusOf(c) || 'Ohne Status';
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(c);
  }
  if (!list.length) side.append(h('p', { class: 'muted pad' }, 'Keine Aufgaben für diesen Filter.'));
  for (const [status, items] of groups) {
    const pts = items.reduce((s, c) => s + (Number(c.points) || 0), 0);
    side.append(h('div', { class: 'task-group' }, h('span', {}, status), h('span', { class: 'muted small' }, `${items.length}${pts ? ` · ${pts} SP` : ''}`)));
    for (const c of items) {
      const prio = Object.hasOwn(PRIORITIES, c.priority) ? PRIORITIES[c.priority] : null;
      side.append(h('button', { class: 'task-row', onclick: () => jumpTo(getEl(c.id)) },
        h('span', { class: 'task-color', style: { background: c.color || '#4262ff' } }),
        h('span', { class: 'task-main' },
          h('span', { class: 'task-title' }, c.key ? h('span', { class: 'muted' }, c.key + ' ') : null, c.title || 'Ohne Titel'),
          h('span', { class: 'task-meta' },
            prio ? h('span', { style: { color: prio.color }, title: 'Priorität' }, `${prio.icon} ${prio.label}`) : null,
            c.due ? h('span', { class: isOverdue(c) ? 'overdue' : '' }, '📅 ' + fmtDue(c.due)) : null,
            c.points ? h('span', { title: 'Story Points' }, `${c.points} SP`) : null,
            cardTags(c).slice(0, 3).map((t) => h('span', { class: 'task-tag' }, t)))),
        c.assignee ? h('span', { class: 'avatar xs', title: c.assignee }, initials(c.assignee)) : null));
    }
  }
  side.append(h('div', { class: 'side-actions' }, h('a', { class: 'btn small', href: '/#aufgaben', target: '_blank', rel: 'noopener' }, 'Meine Aufgaben auf allen Boards')));
}

/* ================================================================== */
/* Versionsverlauf                                                     */
/* ================================================================== */

const KIND = { manual: 'Gesichert', auto: 'Automatisch', restore: 'Vor Wiederherstellung' };

async function renderVersions(side, close) {
  side.append(h('div', { class: 'side-head' }, h('h3', {}, 'Versionsverlauf'), h('span', { class: 'spacer' }), close));
  side.append(h('div', { class: 'side-actions' }, h('button', { class: 'btn small primary', onclick: async () => {
    const label = await promptDialog('Version sichern', 'Name der Version (optional)', '');
    if (label === null) return;
    try {
      await api(`/api/boards/${app.boardId}/versions`, { method: 'POST', body: { label } });
      toast('Version gesichert');
      renderSidePanel();
    } catch (e) {
      toast(e.message);
    }
  } }, h('span', { html: ICONS.plus }), 'Aktuellen Stand sichern')));
  side.append(h('p', { class: 'muted pad small' }, 'Während das Board bearbeitet wird, entsteht höchstens alle 30 Minuten automatisch eine Version. Beim Wiederherstellen wird der aktuelle Stand vorher gesichert.'));
  const box = h('div', { class: 'version-list' }, h('p', { class: 'muted pad' }, 'Wird geladen …'));
  side.append(box);
  let versions;
  try {
    ({ versions } = await api(`/api/boards/${app.boardId}/versions`));
  } catch (e) {
    box.innerHTML = '';
    box.append(h('p', { class: 'muted pad' }, e.message));
    return;
  }
  if (currentSidePanel() !== 'versions') return;
  box.innerHTML = '';
  if (!versions.length) box.append(h('p', { class: 'muted pad' }, 'Noch keine Versionen.'));
  for (const v of versions) {
    const when = new Date(v.createdAt).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' });
    box.append(h('div', { class: 'version-row' },
      h('div', { class: 'version-title' }, v.label || (v.kind === 'manual' ? 'Ohne Namen' : KIND[v.kind] || 'Version'), h('span', { class: 'pill' + (v.kind === 'manual' ? ' accent' : '') }, KIND[v.kind] || v.kind)),
      h('div', { class: 'muted small' }, `${when} · ${relTime(v.createdAt)}${v.by ? ' · ' + v.by : ''} · ${v.elementCount} Elemente`),
      h('div', { class: 'row' },
        h('button', { class: 'btn small', onclick: async () => {
          const ok = await confirmDialog('Version wiederherstellen?', `Das Board wird für alle auf den Stand vom ${when} zurückgesetzt. Der aktuelle Stand wird vorher als Version gesichert.`, 'Wiederherstellen', true);
          if (!ok) return;
          try {
            await api(`/api/boards/${app.boardId}/versions/${v.id}/restore`, { method: 'POST' });
            toast('Version wiederhergestellt – Board wird neu geladen');
          } catch (e) {
            toast(e.message);
          }
        } }, 'Wiederherstellen'),
        h('button', { class: 'btn small', onclick: async () => {
          // Tab sofort (im Klick) öffnen, sonst blockieren Pop-up-Blocker ihn nach dem Warten auf den Server
          const win = window.open('about:blank', '_blank');
          try {
            const r = await api(`/api/boards/${app.boardId}/versions/${v.id}/copy`, { method: 'POST' });
            if (win) {
              win.opener = null;
              win.location.href = '/board/' + r.id;
            } else location.href = '/board/' + r.id;
          } catch (e) {
            if (win) win.close();
            toast(e.message);
          }
        } }, 'Als Kopie öffnen'))));
  }
}

app.on('renderPanel', (kind, side, close) => {
  if (kind === 'tasks') renderTasks(side, close);
  else if (kind === 'versions') renderVersions(side, close);
});
// Nur neu aufbauen, wenn sich Karten geändert haben (Scrollposition bleibt erhalten)
let taskSig = '';
app.on('render', throttle(() => {
  if (currentSidePanel() !== 'tasks') return (taskSig = '');
  const sig = JSON.stringify([...app.els.values()].filter((e) => e.type === 'card').map((c) => [c.id, c.title, c.status, c.assignee, c.due, c.priority, c.points, c.key, c.tags, c.color, c.hidden]));
  if (sig === taskSig) return;
  taskSig = sig;
  const side = document.getElementById('sidepanel');
  const top = side.scrollTop;
  renderSidePanel();
  side.scrollTop = top;
}, 500));

/* ================================================================== */
/* Karten aus CSV / Tabellen importieren (z. B. Jira-, Azure-DevOps- oder Excel-Export)  */
/* ================================================================== */

const FIELDS = {
  title: ['titel', 'title', 'summary', 'zusammenfassung', 'name', 'aufgabe', 'task', 'thema'],
  description: ['beschreibung', 'description', 'details', 'text'],
  assignee: ['zuständig', 'zustaendig', 'assignee', 'assigned to', 'bearbeiter', 'verantwortlich', 'owner', 'zugewiesen an', 'zugewiesen'],
  status: ['status', 'state', 'spalte', 'column'],
  due: ['fällig', 'faellig', 'fällig am', 'due', 'due date', 'fälligkeitsdatum', 'termin', 'deadline', 'enddatum'],
  points: ['story points', 'punkte', 'story point estimate', 'sp', 'estimate', 'schätzung', 'aufwand', 'effort', 'custom field (story points)', 'custom field (story point estimate)', 'storypoints'],
  priority: ['priorität', 'prioritaet', 'priority', 'prio'],
  key: ['schlüssel', 'key', 'issue key', 'id', 'ticket', 'vorgangsschlüssel', 'work item id'],
  tags: ['labels', 'label', 'tags', 'schlagwörter', 'stichwörter'],
};

export function parseCsv(text) {
  const firstLine = text.split(/\r?\n/, 1)[0] || '';
  const count = (ch) => firstLine.split(ch).length - 1;
  const delim = [['\t', count('\t')], [';', count(';')], [',', count(',')]].sort((a, b) => b[1] - a[1])[0][0];
  const rows = [];
  let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"' && !cell) q = true;
    else if (c === delim) { row.push(cell); cell = ''; } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      if (row.some((x) => x.trim())) rows.push(row);
      row = [];
      cell = '';
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x.trim())) rows.push(row);
  return rows.map((r) => r.map((x) => x.trim()));
}

export function normPriority(v) {
  const s = String(v || '').toLowerCase().trim();
  // Wörter zuerst, Ziffern nur als eigenständige Stufe (P1, Prio 2 …)
  if (/highest|blocker|kritisch|critical|sehr hoch|höchste|dringend|urgent/.test(s)) return 'critical';
  if (/lowest|niedrigste/.test(s)) return 'low';
  if (/high|hoch|major|wichtig/.test(s)) return 'high';
  if (/medium|mittel|normal/.test(s)) return 'medium';
  if (/low|niedrig|minor|trivial|gering/.test(s)) return 'low';
  const n = /^(?:p|prio(?:rität)?\s*)?([1-5])$/.exec(s.replace(/\s+/g, ' '));
  if (n) return ['critical', 'high', 'medium', 'low', 'low'][Number(n[1]) - 1];
  return undefined;
}

const MONTHS = { jan: 1, feb: 2, mar: 3, mär: 3, apr: 4, may: 5, mai: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, okt: 10, nov: 11, dec: 12, dez: 12 };

// Nur eindeutige Datumsformate; ungültige Tage (31.02.) werden verworfen
export function normDate(v) {
  const s = String(v || '').trim();
  let y, mo, d, m;
  if ((m = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ]|$)/.exec(s))) [y, mo, d] = [m[1], m[2], m[3]];
  else if ((m = /^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})(?:\s|$)/.exec(s))) [d, mo, y] = [m[1], m[2], m[3]];
  else if ((m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s|$)/.exec(s))) [d, mo, y] = [m[1], m[2], m[3]];
  else if ((m = /^(\d{1,2})[/ .-]([a-zäA-ZÄ]{3})[a-z]*[/ .-](\d{2}|\d{4})(?:\s|$)/.exec(s)) && MONTHS[m[2].toLowerCase()]) [d, mo, y] = [m[1], MONTHS[m[2].toLowerCase()], m[3]];
  else return undefined;
  y = String(y).length === 2 ? 2000 + Number(y) : Number(y);
  mo = Number(mo);
  d = Number(d);
  const date = new Date(y, mo - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return undefined;
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function cardsFromRows(rows) {
  if (!rows.length) return [];
  const head = rows[0].map((x) => x.toLowerCase().replace(/^﻿/, '').trim());
  const idx = {};
  for (const [f, names] of Object.entries(FIELDS)) {
    const i = head.findIndex((x) => names.includes(x));
    if (i >= 0) idx[f] = i;
  }
  // Kopfzeile, sobald mindestens eine Spalte erkannt wird
  const hasHeader = Object.keys(idx).length > 0;
  const body = hasHeader ? rows.slice(1) : rows;
  const get = (r, f) => (idx[f] !== undefined ? r[idx[f]] || '' : '');
  const titleOf = (r) => (idx.title !== undefined ? get(r, 'title') : get(r, 'key') || r.find((x, i) => x && !Object.values(idx).includes(i)) || r.find(Boolean) || '');
  // Jira exportiert Labels oft in mehreren Spalten mit gleichem Namen
  const tagCols = head.map((x, i) => (FIELDS.tags.includes(x) ? i : -1)).filter((i) => i >= 0);
  return body.slice(0, 500).map((r) => {
    const tags = tagCols.flatMap((i) => String(r[i] || '').split(/[,;]/)).map((t) => t.trim()).filter(Boolean);
    return {
      title: (hasHeader ? titleOf(r) : r.filter(Boolean).join(' – ')).slice(0, 300) || 'Ohne Titel',
      description: get(r, 'description').slice(0, 2000),
      assignee: get(r, 'assignee'),
      status: get(r, 'status'),
      due: normDate(get(r, 'due')),
      points: get(r, 'points') ? (Number.isFinite(Number(get(r, 'points').replace(',', '.'))) ? String(Number(get(r, 'points').replace(',', '.'))) : get(r, 'points')).slice(0, 5) : undefined,
      priority: normPriority(get(r, 'priority')),
      key: get(r, 'key') || undefined,
      tags: [...new Set(tags)].slice(0, 8),
    };
  });
}

const STATUS_COLORS = ['#4262ff', '#f59f00', '#7048e8', '#e64980', '#12b886', '#1098ad', '#868e96'];

export function layoutCards(cards, byStatus = true) {
  const els = [];
  const cw = 300, gap = 20;
  const ch = (c) => 140 + (c.key ? 16 : 0) + (c.tags.length ? 24 : 0) + (c.description ? 20 : 0);
  const groups = new Map();
  for (const c of cards) {
    const k = byStatus ? c.status || 'Ohne Status' : '';
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(c);
  }
  let gi = 0, x = 0;
  for (const [status, list] of groups) {
    const color = STATUS_COLORS[gi % STATUS_COLORS.length];
    let y = 0;
    if (byStatus) {
      const head = `${status} (${list.length})`.slice(0, 80);
      const lines = Math.min(3, Math.ceil(head.length / 20));
      els.push({ id: uid(), type: 'text', x, y: -20 - lines * 30, w: cw, h: lines * 30 + 8, text: head, fontSize: 24, bold: true, color: '#1a1a1a', align: 'left' });
      list.forEach((c, i) => {
        els.push({ id: uid(), type: 'card', x, y, w: cw, h: ch(c), color, ...c, author: app.user.name || '' });
        y += ch(c) + gap;
      });
      x += cw + 60;
    } else {
      const cols = Math.ceil(Math.sqrt(list.length));
      list.forEach((c, i) => els.push({ id: uid(), type: 'card', x: (i % cols) * (cw + gap), y: Math.floor(i / cols) * (200 + gap), w: cw, h: ch(c), color, ...c, author: app.user.name || '' }));
    }
    gi++;
  }
  return els;
}

app.on('openCsvImport', () => {
  if (app.viewOnly) return;
  const ta = h('textarea', { rows: 10, class: 'mono', placeholder: 'Titel;Status;Zuständig;Fällig;Story Points;Priorität\nLogin-Seite bauen;In Arbeit;Alex;2026-11-20;5;Hoch' });
  const file = h('input', { type: 'file', accept: '.csv,.tsv,.txt,text/csv' });
  const byStatus = h('input', { type: 'checkbox', checked: true });
  const info = h('p', { class: 'muted small' });
  const update = () => {
    const rows = parseCsv(ta.value);
    const cards = cardsFromRows(rows);
    const more = rows.length - 1 > 500 ? ` (Datei enthält ${rows.length - 1} Zeilen – höchstens 500 werden übernommen)` : '';
    info.textContent = cards.length ? `${cards.length} Karte${cards.length === 1 ? '' : 'n'} erkannt${more}${cards.some((c) => c.status) ? ' · ' + new Set(cards.map((c) => c.status || 'Ohne Status')).size + ' Status-Spalten' : ''}` : 'Noch keine Daten.';
  };
  ta.addEventListener('input', update);
  file.addEventListener('change', async () => {
    if (file.files[0]) ta.value = await file.files[0].text();
    update();
  });
  const form = h('form', { class: 'form', onsubmit: (e) => {
    e.preventDefault();
    const cards = cardsFromRows(parseCsv(ta.value));
    if (!cards.length) return toast('Keine Karten erkannt');
    placeElements(layoutCards(cards, byStatus.checked), { select: true });
    toast(`${cards.length} Karten importiert`);
    m.close();
  } },
  h('p', { class: 'muted' }, 'CSV-Datei wählen oder Tabelle einfügen (z. B. aus Excel, Jira oder Azure DevOps). Erkannte Spalten: Titel/Summary, Beschreibung, Zuständig/Assignee, Status, Fällig/Due Date, Story Points, Priorität, Schlüssel/Issue Key, Labels. Ohne Kopfzeile wird jede Zeile zu einer Karte.'),
  file, ta, info,
  h('label', { class: 'check' }, byStatus, 'Nach Status in Spalten anordnen (Kanban)'),
  h('div', { class: 'form-actions' }, h('button', { type: 'button', class: 'btn', onclick: () => m.close() }, 'Abbrechen'), h('button', { type: 'submit', class: 'btn primary' }, 'Karten anlegen')));
  const m = modal('Karten importieren', form, { wide: true });
  update();
  setTimeout(() => ta.focus(), 0);
});

/* ================================================================== */
/* Direktlink auf ein Element: /board/<id>#el=<elementId>              */
/* ================================================================== */

function focusFromHash() {
  const m = /^#el=([\w-]{1,64})$/.exec(location.hash);
  if (!m) return;
  const el = getEl(m[1]);
  if (el) setTimeout(() => jumpTo(el), 150);
  else toast('Das verlinkte Element gibt es nicht mehr');
  history.replaceState(null, '', location.pathname + location.search);
}

let firstLoad = true;
app.on('loaded', () => {
  if (!firstLoad) return;
  firstLoad = false;
  focusFromHash();
});
window.addEventListener('hashchange', focusFromHash);
