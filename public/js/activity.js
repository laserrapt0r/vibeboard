// Aktivitätsverlauf: wer hat was geändert – mit Sprung zum Element und Markierung der Änderungen seit dem
// letzten Besuch
import { T, LOCALE, guestName } from './i18n.js';
import { h, api, toast, relTime, initials, ICONS, unionRect } from './util.js';
import { app, getEl, bounds, fitTo, setSelection, scheduleRender, $ } from './core.js';
import { currentSidePanel, renderSidePanel, toggleSidePanel, showSidePanel } from './ui.js';

const TYPE = {
  sticky: T('Sticky Note'), text: T('Text'), shape: T('Form'), connector: T('Verbindung'), pen: T('Freihandlinie'), frame: T('Frame'), card: T('Karte'),
  table: T('Tabelle'), code: T('Code-Block'), image: T('Bild'), emoji: T('Sticker'), comment: T('Kommentar'),
};
const VERB = {
  created: T('hat erstellt'), changed: T('hat bearbeitet'), deleted: T('hat gelöscht'), commented: T('hat kommentiert'), resolved: T('hat erledigt'),
  reopened: T('hat wieder geöffnet'), assigned: T('hat zugewiesen'), renamed: T('hat das Board umbenannt in'), revealed: T('hat aufgedeckt'),
  restored: T('hat eine frühere Version wiederhergestellt'), recorded: T('hat einen Rundgang aufgezeichnet:'),
};

let items = [];
let scrollPos = 0;
let loadedAt = 0;
let highlight = false;
let changedSince = new Set();
const layer = $('#layer-overlay');

async function load(more = false) {
  try {
    const last = items[items.length - 1];
    const before = more && last ? `${last.at}:${last.id}` : '';
    const r = await api(`/api/boards/${app.boardId}/activity?limit=60${before ? '&before=' + before : ''}`);
    if (more) items = [...items, ...r.items];
    else {
      // Neueste Seite ersetzt nur ihren Bereich; bereits nachgeladene ältere Einträge bleiben erhalten
      const fresh = new Set(r.items.map((i) => i.id));
      const oldest = r.items[r.items.length - 1];
      const older = oldest ? items.filter((i) => !fresh.has(i.id) && (i.at < oldest.at || (i.at === oldest.at && Number(i.id) < Number(oldest.id)))) : [];
      items = [...r.items, ...older];
    }
    loadedAt = Date.now();
    computeChanged();
  } catch (e) {
    toast(e.message);
  }
}

// Elemente, die andere seit meinem letzten Besuch geändert haben
function computeChanged() {
  changedSince = new Set(items.filter((i) => app.lastVisit && i.at > app.lastVisit && i.userId !== String(app.user.id) && i.elementId).map((i) => i.elementId));
}

function describe(i) {
  const what = i.elementType ? TYPE[i.elementType] || T('Element') : '';
  if (i.kind === 'revealed') return i.count === 1 ? T('hat den privaten Modus aufgedeckt (1 Element)') : T`hat den privaten Modus aufgedeckt (${i.count} Elemente)`;
  if (i.kind === 'renamed' || i.kind === 'recorded') return `${VERB[i.kind]} „${i.label}“`;
  if (!what) return VERB[i.kind] || i.kind;
  return `${VERB[i.kind] || i.kind}: ${what}${i.count > 1 ? ` (${i.count}×)` : ''}`;
}

function jump(i) {
  const el = i.elementId && getEl(i.elementId);
  if (!el) return toast(i.kind === 'deleted' ? T('Dieses Element wurde gelöscht') : T('Das Element gibt es nicht mehr'));
  if (el.type === 'comment') {
    fitTo({ x: el.x - 200, y: el.y - 200, w: 400, h: 400 }, { maxZ: 1.5 });
    setTimeout(() => app.emit('openComment', el.id), 320);
  } else {
    setSelection([el.id]);
    fitTo(bounds(el), { maxZ: 1.5, pad: 200 });
  }
}

async function renderPanel(side, close) {
  side.append(h('div', { class: 'side-head' }, h('h3', {}, T('Aktivität')), h('span', { class: 'spacer' }), close));
  const n = changedSince.size;
  side.append(h('div', { class: 'side-actions' },
    h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: highlight, onchange: (e) => {
      highlight = e.target.checked;
      scheduleRender(true);
    } }), T`Änderungen seit meinem letzten Besuch markieren${n ? ` (${n})` : ''}`)));
  if (Date.now() - loadedAt > 15000) {
    await load();
    if (currentSidePanel() !== 'activity') return;
    return renderSidePanel();
  }
  if (!items.length) {
    side.append(h('p', { class: 'muted pad' }, T('Noch keine Aktivität aufgezeichnet.')));
    return;
  }
  const list = h('div', { class: 'activity-list' });
  let markerDone = false;
  for (const i of items) {
    if (!markerDone && app.lastVisit && i.at <= app.lastVisit) {
      markerDone = true;
      list.append(h('div', { class: 'activity-marker' }, T`Dein letzter Besuch · ${new Date(app.lastVisit).toLocaleString(LOCALE, { dateStyle: 'short', timeStyle: 'short' })}`));
    }
    const isNew = app.lastVisit && i.at > app.lastVisit && i.userId !== String(app.user.id);
    list.append(h('button', { class: 'activity-row' + (isNew ? ' new' : ''), onclick: () => jump(i), title: new Date(i.at).toLocaleString(LOCALE) },
      h('span', { class: 'avatar xs', style: { background: i.color || '#888' } }, initials(i.user || '?')),
      h('span', { class: 'activity-main' },
        h('span', {}, h('b', {}, i.user === 'Anonym' ? T('Anonym') : guestName(i.user) || T('Jemand')), ' ', describe(i)),
        i.label && !['renamed', 'recorded'].includes(i.kind) ? h('span', { class: 'activity-label' }, i.label) : null,
        h('span', { class: 'muted small' }, relTime(i.at)))));
  }
  side.append(list);
  // Scrollposition über den Neuaufbau erhalten
  side.scrollTop = scrollPos;
  side.onscroll = () => (scrollPos = side.scrollTop);
  if (items.length >= 60) side.append(h('div', { class: 'side-actions' }, h('button', { class: 'btn small', onclick: async () => { await load(true); renderSidePanel(); } }, T('Ältere laden'))));
}

app.on('renderPanel', (kind, side, close) => {
  if (kind === 'activity') renderPanel(side, close);
});

// Markierung geänderter Elemente auf der Leinwand
app.on('overlay', () => {
  if (!highlight || !changedSince.size) return;
  const z = app.view.z;
  let out = '';
  for (const id of changedSince) {
    const el = getEl(id);
    if (!el || el.type === 'connector') continue;
    const b = bounds(el);
    const p = 6 / z;
    out += `<rect class="changed-mark" x="${b.x - p}" y="${b.y - p}" width="${b.w + p * 2}" height="${b.h + p * 2}" rx="${6 / z}" fill="none" stroke="#f08c00" stroke-width="${2.5 / z}" stroke-dasharray="${6 / z} ${4 / z}"/>` +
      `<circle cx="${b.x + b.w + p}" cy="${b.y - p}" r="${6 / z}" fill="#f08c00" stroke="#fff" stroke-width="${1.5 / z}"/>`;
  }
  layer.insertAdjacentHTML('beforeend', out);
});

// Beim Öffnen: Hinweis auf Änderungen anderer seit dem letzten Besuch
let greeted = false;
app.on('loaded', async () => {
  if (greeted) return;
  greeted = true;
  if (!app.lastVisit) return;
  await load();
  const n = changedSince.size;
  if (!n) return;
  const bar = h('div', { class: 'panel since-banner' },
    h('span', { html: ICONS.activity }),
    h('span', {}, n === 1 ? T('1 Element wurde seit deinem letzten Besuch von anderen geändert.') : T`${n} Elemente wurden seit deinem letzten Besuch von anderen geändert.`),
    h('button', { class: 'btn small primary', onclick: () => {
      highlight = true;
      showSidePanel('activity');
      // Zu den geänderten Elementen springen
      const rects = [...changedSince].map(getEl).filter(Boolean).map(bounds);
      if (rects.length) fitTo(unionRect(rects), { maxZ: 1.5, pad: 160 });
      scheduleRender(true);
      bar.remove();
    } }, T('Anzeigen')),
    h('button', { class: 'icon-btn small', title: T('Schließen'), html: ICONS.close, onclick: () => bar.remove() }));
  document.body.append(bar);
  setTimeout(() => bar.remove(), 15000);
});

// Neue Aktivitäten (eigene oder fremde Änderungen) beim nächsten Öffnen des Panels nachladen
app.on('render', () => {
  if (currentSidePanel() === 'activity' && Date.now() - loadedAt > 15000) renderSidePanel();
});

export function toggleActivity() {
  toggleSidePanel('activity');
}
