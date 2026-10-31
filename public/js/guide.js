// Einstieg und Orientierung: Start auf dem leeren Board, Gliederung, gemerkte Ansichten
import { T } from './i18n.js';
import { h, ICONS, loadPref, savePref, promptDialog, toast } from './util.js';
import { app, frames, fitTo, makeElement, setEl, act, startEdit, setSelection, viewCenter, visibleRect, bounds, getEl } from './core.js';
import { openTemplates, renderSidePanel, currentSidePanel } from './ui.js';

const HEADING_SIZE = 28;
const MAX_HEADINGS = 60;
const MAX_VIEWS = 30;
// In der Präsentation führt die Folge: Ein Sprung ließe das Publikum vor einer leeren Fläche stehen
const PRESENTING = () => document.body.classList.contains('presenting');

/* ---------------- Leeres Board ---------------- */

const start = h('div', { id: 'empty-start', class: 'panel hidden', role: 'region', 'aria-label': T('Erste Schritte') });
document.body.append(start);
let startClosed = false;
// Das Fenster liegt über der Zeichenfläche: Wer eine Datei hereinzieht, soll sie dort ablegen können
start.addEventListener('dragenter', () => {
  startClosed = true;
  updateStart();
});

function addNote() {
  const c = viewCenter();
  const el = makeElement('sticky', c.x, c.y);
  act(() => setEl(el));
  setSelection([el.id]);
  startEdit(el.id, { isNew: true });
}

function renderStart() {
  const choice = (icon, title, text, onclick) => h('button', { class: 'empty-choice', onclick },
    h('span', { class: 'empty-icon', html: ICONS[icon] }), h('span', {}, h('b', {}, title), h('span', { class: 'muted small' }, text)));
  start.replaceChildren(
    h('h2', {}, T('Womit möchtest du anfangen?')),
    choice('sticky', T('Notiz schreiben'), T('Oder irgendwo doppelklicken'), addNote),
    choice('template', T('Vorlage wählen'), T('Retro, Brainstorming, Kanban und mehr'), openTemplates),
    app.role === 'owner' ? choice('share', T('Personen einladen'), T('Gemeinsam auf diesem Board arbeiten'), () => app.emit('openShare')) : null,
    h('p', { class: 'muted small' }, T('Alle Funktionen findest du mit Strg+K.')),
    h('button', { class: 'btn small', onclick: () => { startClosed = true; updateStart(); } }, T('Schließen')));
}

function updateStart() {
  // Mit gewähltem Werkzeug will jemand zeichnen: Das Fenster darf die Mitte der Zeichenfläche nicht verdecken
  const show = app.loaded && !startClosed && !app.viewOnly && app.els.size === 0 && !app.editing && app.tool === 'select';
  if (show === !start.classList.contains('hidden')) return;
  if (show) renderStart();
  start.classList.toggle('hidden', !show);
}

app.on('loaded', updateStart);
app.on('render', updateStart);
app.on('tool', updateStart);

/* ---------------- Gliederung ---------------- */

export function headings() {
  const titles = new Set(frames().map((f) => String(f.title || '').trim()));
  return [...app.els.values()]
    .filter((e) => e.type === 'text' && !e.hidden && typeof e.fontSize === 'number' && e.fontSize >= HEADING_SIZE && String(e.text || '').trim() && !titles.has(String(e.text).trim()))
    .sort((a, b) => a.y - b.y || a.x - b.x)
    .slice(0, MAX_HEADINGS)
    .map((e) => ({ id: e.id, text: String(e.text).replace(/\s+/g, ' ').trim().slice(0, 80) }));
}

export function goToHeading(item) {
  const el = getEl(item.id);
  if (!el) return;
  setSelection([el.id]);
  fitTo(bounds(el), { maxZ: 1.5, pad: 200 });
}

/* ---------------- Gemerkte Ansichten ---------------- */

const viewKey = () => 'views.' + app.boardId;
export function savedViews() {
  const list = loadPref(viewKey(), []);
  return Array.isArray(list) ? list.filter((v) => v && v.name && v.rect) : [];
}

export function goToView(v) {
  fitTo(v.rect, { pad: 0, maxZ: 8 });
}

export async function saveCurrentView() {
  const list = savedViews();
  // Der Vorschlag darf keine bestehende Ansicht treffen, auch wenn dazwischen eine entfernt wurde
  let n = list.length + 1;
  while (list.some((v) => v.name === T`Ansicht ${n}`)) n++;
  const name = await promptDialog(T('Ansicht merken'), T('Name'), T`Ansicht ${n}`);
  if (!name || !name.trim()) return;
  const entry = { name: name.trim().slice(0, 60), rect: visibleRect() };
  // Gleicher Name ersetzt die Ansicht an ihrem Platz: Alt+Ziffer bleibt dadurch stabil
  const at = list.findIndex((v) => v.name === entry.name);
  if (at < 0 && list.length >= MAX_VIEWS) return toast(T`Höchstens ${MAX_VIEWS} Ansichten möglich`);
  if (at >= 0) list[at] = entry;
  else list.push(entry);
  savePref(viewKey(), list);
  toast(T('Ansicht gemerkt – nur in diesem Browser'));
  if (currentSidePanel() === 'frames') renderSidePanel();
}

function removeView(name) {
  savePref(viewKey(), savedViews().filter((v) => v.name !== name));
  renderSidePanel();
}

app.on('framesPanel', (side) => {
  const views = savedViews();
  side.append(h('div', { class: 'side-head' }, h('h3', {}, T('Gemerkte Ansichten'))));
  side.append(h('div', { class: 'side-actions' }, h('button', { class: 'btn small', onclick: saveCurrentView }, T('Aktuelle Ansicht merken'))));
  if (views.length) {
    side.append(h('div', { class: 'frame-list' }, views.map((v, i) => h('div', { class: 'outline-item' },
      h('button', { class: 'outline-link', onclick: () => goToView(v) }, i < 9 ? h('span', { class: 'frame-no' }, i + 1) : null, v.name),
      h('button', { class: 'icon-btn', title: T`Ansicht „${v.name}“ entfernen`, 'aria-label': T`Ansicht „${v.name}“ entfernen`, html: ICONS.close, onclick: () => removeView(v.name) })))));
  } else side.append(h('p', { class: 'muted pad small' }, T('Springe mit Alt+1 bis Alt+9 zu gemerkten Ansichten. Sie gelten nur in diesem Browser.')));
  const list = headings();
  if (list.length) {
    side.append(h('div', { class: 'side-head' }, h('h3', {}, T('Überschriften'))));
    side.append(h('div', { class: 'frame-list' }, list.map((item) => h('div', { class: 'outline-item' },
      h('button', { class: 'outline-link', onclick: () => goToHeading(item) }, item.text)))));
  }
});

app.on('key', (e) => {
  if (!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || !/^Digit[1-9]$/.test(e.code) || PRESENTING()) return;
  const v = savedViews()[Number(e.code.slice(5)) - 1];
  if (!v) return;
  e.preventDefault();
  goToView(v);
});
