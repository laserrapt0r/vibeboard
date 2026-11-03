// Seitenpanel „Alle Formen“: Suche, Pakete, Vorschau, Ablegen per Ziehen und die persönliche Paketauswahl
import { T, LANG } from './i18n.js';
import { h, api, toast, design, ICONS } from './util.js';
import { app, placeShape, setTool, saveToolOpts, toWorld } from './core.js';
import { SHAPES, SHAPE_DEFAULTS, shapeGeom, shapeDecor } from './render.js';
import { SHAPE_PACKS, ICON_GROUPS, visiblePacks, shapeSynonyms } from './shape-catalog.js';
import { isIconKey, iconReady, iconBody, iconBox, iconMode, iconLabel, iconMotives, setOf, setLoaded, setItems, setGroups, loadSet, forgetSet, onIconsLoaded } from './icons.js';
import { closePop, showSidePanel, toggleSidePanel, currentSidePanel } from './ui.js';

const SHAPE_NAMES = new Map(SHAPES);
const previews = new Map();
const BOX_W = 34, BOX_H = 24;

// Standardgröße bestimmt das Seitenverhältnis der Vorschau, damit schmale Formen nicht verzerren
function previewBox(k) {
  const d = SHAPE_DEFAULTS[k];
  if (!d?.w || !d?.h || d.valign === 'top' && !d.text) return [3, 3, BOX_W, BOX_H];
  const s = Math.min(BOX_W / d.w, BOX_H / d.h);
  const w = Math.max(4, d.w * s), h = Math.max(4, d.h * s);
  return [20 - w / 2, 15 - h / 2, w, h];
}

// Die Vorschauen sind reine Zeichenketten und ändern sich nie: Einmal berechnet, gelten sie für alle Knöpfe
export function shapePreview(k) {
  if (isIconKey(k)) {
    const mode = iconMode(k);
    if (mode === 'tabler') return `<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${iconReady(k) ? iconBody(k) : ''}</svg>`;
    const [x, y, w, hh] = iconBox(k);
    // Lange Formen (Widerstand, Leitung) bekommen eine dünnere Linie, damit sie in der Vorschau nicht verschwimmen
    const sw = mode === 'stroke' ? Math.max(w, hh) / 28 * 1.6 : 0;
    const paint = mode === 'fill' ? 'fill="currentColor"' : mode === 'stroke' ? `fill="none" stroke="currentColor" stroke-width="${Math.round(sw * 100) / 100}" stroke-linecap="round" stroke-linejoin="round"` : '';
    return `<svg viewBox="${x} ${y} ${w} ${hh}" width="30" height="30" ${paint}>${iconReady(k) ? iconBody(k) : ''}</svg>`;
  }
  let svg = previews.get(k);
  if (!svg) {
    const [x, y, w, h] = previewBox(k);
    const deco = shapeDecor(k, x, y, w, h, { fill: 'none', stroke: 'currentColor', sw: 1.6, full: true, cls: 'pv-fill' });
    svg = `<svg viewBox="0 0 40 30" width="40" height="30">${deco.before}${shapeGeom(k, x, y, w, h, true)} class="pv-fill" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>${deco.after}</svg>`;
    previews.set(k, svg);
  }
  return svg;
}

const adminOff = () => design().shapePacksOff || [];
const userOff = () => app.me?.shapePacksOff || [];

// Eigene Formenpakete der Administration: Die Liste kommt beim Öffnen des Panels frisch vom Server
let customPacks = [];
const customAsPacks = () => customPacks.map((p) => ({ id: 'cu-' + p.id, name: p.name, keys: [], set: 'cu-' + p.id, source: p.source, count: p.count, custom: true }));
async function fetchCustomPacks() {
  try {
    const list = await api('/api/shape-packs');
    const before = new Map(customPacks.map((p) => [p.id, p.version]));
    customPacks = Array.isArray(list) ? list : [];
    // Geänderte Pakete neu laden, sobald sie gebraucht werden
    for (const p of customPacks) if (before.has(p.id) && before.get(p.id) !== p.version) forgetSet('cu-' + p.id);
    return customPacks.some((p) => before.get(p.id) !== p.version) || before.size !== customPacks.length;
  } catch {
    return false;
  }
}

export const allPacks = () => [...SHAPE_PACKS, ...customAsPacks()];
export const availablePacks = () => visiblePacks(adminOff(), userOff(), customAsPacks());
export const availableShapes = () => new Set(availablePacks().flatMap((p) => p.keys));
const setPacks = () => availablePacks().filter((p) => p.set);
const setOn = (set) => setPacks().some((p) => p.set === set);
export const shapeUsable = (k) => (isIconKey(k) ? setOn(setOf(k)) && iconReady(k) : availableShapes().has(k));
export const shapeName = (k) => (isIconKey(k) ? iconLabel(k, LANG === 'de') : SHAPE_NAMES.get(k) || k);
const open = () => currentSidePanel() === 'shapes';

/* ---------------- Suche ---------------- */

const plain = (s) => String(s).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

// Abstand mit Buchstabendrehern, oberhalb von max genügt die Aussage „zu weit“
function distance(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev2 = [], prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) cur[j] = Math.min(cur[j], prev2[j - 2] + 1);
    }
    prev2 = prev;
    prev = cur;
  }
  return prev[b.length];
}

// tolerant: Vertipper zählen. Die rund 5000 Stichwortlisten der Symbole bleiben davon ausgenommen.
function wordScore(q, words, tolerant = true) {
  const allowed = !tolerant ? 0 : q.length >= 8 ? 2 : q.length >= 4 ? 1 : 0;
  let best = 0;
  for (const w of words) {
    if (w === q) return 4;
    if (w.startsWith(q)) best = Math.max(best, 3);
    else if (w.includes(q)) best = Math.max(best, 2);
    else if (allowed && best < 1) {
      // Vertipper am Wortanfang eines längeren Wortes zählen auch
      if (distance(q, w, allowed) <= allowed || distance(q, w.slice(0, q.length), allowed) <= allowed) best = 1;
    }
  }
  return best;
}

let index = null;
function searchIndex() {
  if (index) return index;
  const also = shapeSynonyms();
  const items = new Map();
  for (const p of SHAPE_PACKS) {
    const labels = p.labels?.() || {};
    for (const k of p.keys) {
      const it = items.get(k) || { k, name: new Set([SHAPE_NAMES.get(k)]), packs: new Set() };
      if (labels[k]) it.name.add(labels[k]);
      it.packs.add(p.id);
      it.packNames = `${it.packNames || ''} ${p.name}`;
      items.set(k, it);
    }
  }
  index = [...items.values()].map((it) => {
    const split = (s) => plain(s).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
    return { ...it, nameWords: split([...it.name].join(' ')), alsoWords: split(`${also[it.k] || ''} ${it.packNames}`), label: [...it.name].join(' / ') };
  });
  return index;
}

export function searchShapes(query, allowed = availableShapes()) {
  const words = plain(query).split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const hits = [];
  for (const it of searchIndex()) {
    if (!allowed.has(it.k)) continue;
    let total = 0;
    for (const w of words) {
      const s = Math.max(wordScore(w, it.nameWords) * 2, wordScore(w, it.alsoWords));
      if (!s) {
        total = 0;
        break;
      }
      total += s;
    }
    if (total) hits.push([total, it.k]);
  }
  return hits.sort((a, b) => b[0] - a[0]).map(([, k]) => k);
}

const iconIndex = new Map();
function iconSearchIndex(set) {
  const split = (s) => [...new Set(plain(s).split(/[^\p{L}\p{N}]+/u).filter(Boolean))];
  if (!iconIndex.has(set)) {
    const groups = new Map(setGroups(set));
    const label = (it) => (typeof it.label === 'string' ? it.label : '');
    // Eigene Pakete heißen nach Nummern: Dort zählt nur die Bezeichnung
    const named = (it) => (set.startsWith('cu-') ? '' : it.name);
    iconIndex.set(set, setItems(set).map((it) => ({ k: it.k, size: (label(it) || it.name).length, nameWords: split(`${named(it)} ${label(it)} ${iconMotives(it)}`), tagWords: split(`${it.tags} ${groups.get(it.group) || ''}`) })));
  }
  return iconIndex.get(set);
}

// Bei gleicher Wertung zuerst der kürzeste Name: „bell“ vor „bell-school-off“. Ohne set: alle eingeschalteten und geladenen Sätze.
export function searchIcons(query, set = null) {
  const words = plain(query).split(/\s+/).filter(Boolean);
  const list = (set ? [set] : setPacks().map((p) => p.set)).filter(setLoaded);
  if (!words.length || !list.length) return [];
  const hits = [];
  for (const it of list.flatMap(iconSearchIndex)) {
    let total = 0;
    for (const w of words) {
      const s = Math.max(wordScore(w, it.nameWords) * 2, wordScore(w, it.tagWords, false));
      if (!s) {
        total = 0;
        break;
      }
      total += s;
    }
    if (total) hits.push([total, it.size, it.k]);
  }
  return hits.sort((a, b) => b[0] - a[0] || a[1] - b[1] || (a[2] < b[2] ? -1 : 1)).map((x) => x[2]);
}

/* ---------------- Auswählen und Ablegen ---------------- */

const narrow = () => innerWidth <= 760 || matchMedia('(pointer: coarse)').matches;

// Klick: Werkzeug wählen wie im Formen-Menü. Die nächste Stelle auf dem Board bekommt die Form.
function pick(k) {
  if (app.viewOnly) return;
  app.toolOpts.shape = k;
  saveToolOpts();
  setTool('shape');
  closePop();
  markActive();
  // Auf dem Handy liegt das Panel über dem Board: Es macht Platz zum Antippen
  if (innerWidth <= 760) {
    toggleSidePanel('shapes');
    toast(T('Tippe aufs Board, um die Form abzulegen'), 2500);
  }
}

function markActive() {
  panel?.querySelectorAll('.shape-btn').forEach((b) => b.classList.toggle('active', app.tool === 'shape' && b.dataset.shape === app.toolOpts.shape));
}

let suppressClick = false;

// Ziehen aufs Board. Nur mit Maus oder Stift: Auf Touch-Geräten scrollt der Finger das Panel.
function startDrag(e, k) {
  if (e.button !== 0 || e.pointerType === 'touch') return;
  const sx = e.clientX, sy = e.clientY;
  let ghost = null;
  const move = (ev) => {
    if (!ghost && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 6) return;
    if (!ghost) {
      ghost = h('div', { class: 'shape-ghost', html: shapePreview(k) });
      document.body.append(ghost);
    }
    ghost.style.left = ev.clientX + 'px';
    ghost.style.top = ev.clientY + 'px';
  };
  const stop = (ev) => {
    removeEventListener('pointermove', move);
    removeEventListener('pointerup', stop);
    removeEventListener('pointercancel', stop);
    removeEventListener('keydown', esc, true);
    if (!ghost) return;
    ghost.remove();
    ghost = null;
    suppressClick = true;
    setTimeout(() => (suppressClick = false), 0);
    if (ev?.type !== 'pointerup') return;
    const over = document.elementFromPoint(ev.clientX, ev.clientY);
    if (!over || over.closest('.chrome')) return;
    placeShape(k, toWorld(ev.clientX, ev.clientY));
    markActive();
  };
  const esc = (ev) => {
    if (ev.key !== 'Escape' || !ghost) return;
    ev.stopPropagation();
    stop();
  };
  addEventListener('pointermove', move);
  addEventListener('pointerup', stop);
  addEventListener('pointercancel', stop);
  addEventListener('keydown', esc, true);
}

function shapeButton(k, label) {
  const name = label || shapeName(k);
  const b = h('button', {
    class: 'shape-btn' + (app.tool === 'shape' && app.toolOpts.shape === k ? ' active' : ''), type: 'button', html: shapePreview(k), tabindex: '-1', 'aria-label': name,
    onclick: () => !suppressClick && pick(k),
    onpointerdown: (e) => startDrag(e, k),
  });
  b.dataset.shape = k;
  b.dataset.tip = name;
  return b;
}

/* ---------------- Tastatur im Raster ---------------- */

const gridButtons = () => [...panel.querySelectorAll('.shape-btn')].filter((b) => b.offsetParent !== null);

function focusButton(b, list) {
  for (const x of list) x.tabIndex = x === b ? 0 : -1;
  b.focus();
  b.scrollIntoView({ block: 'nearest' });
}

function gridKey(e) {
  const b = e.target.closest?.('.shape-btn');
  if (!b) return;
  if (e.key === 'Enter') {
    e.preventDefault();
    placeShape(b.dataset.shape);
    closePop();
    markActive();
    return;
  }
  if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
  e.preventDefault();
  const list = gridButtons(), i = list.indexOf(b);
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    const next = list[i + (e.key === 'ArrowRight' ? 1 : -1)];
    if (next) focusButton(next, list);
    return;
  }
  const r = b.getBoundingClientRect();
  const down = e.key === 'ArrowDown';
  const rows = list.filter((x) => {
    const t = x.getBoundingClientRect().top;
    return down ? t > r.top + 4 : t < r.top - 4;
  });
  if (!rows.length) {
    if (!down) searchInput.focus();
    return;
  }
  const rowTop = down ? Math.min(...rows.map((x) => x.getBoundingClientRect().top)) : Math.max(...rows.map((x) => x.getBoundingClientRect().top));
  const row = rows.filter((x) => Math.abs(x.getBoundingClientRect().top - rowTop) < 4);
  const near = row.reduce((best, x) => (Math.abs(x.getBoundingClientRect().left - r.left) < Math.abs(best.getBoundingClientRect().left - r.left) ? x : best));
  focusButton(near, list);
}

/* ---------------- Aufbau ---------------- */

let panel = null, body = null, searchInput = null, builtFor = '', manage = false;

const closedGroups = () => new Set(app.toolOpts.shapeGroupsClosed || []);
const openedGroups = () => new Set(app.toolOpts.shapeGroupsOpen || []);
// Symbolsätze außer den Allgemeinen Symbolen sind anfangs zu: Sonst lädt das erste Öffnen des Panels alle Dateien auf einmal
const startsClosed = (pack) => !!pack.set && pack.id !== 'icons';
const isClosed = (pack) => (startsClosed(pack) ? !openedGroups().has(pack.id) : closedGroups().has(pack.id));

function toggleGroup(pack, head, grid, fill) {
  const nowClosed = !isClosed(pack);
  const key = startsClosed(pack) ? 'shapeGroupsOpen' : 'shapeGroupsClosed';
  const list = startsClosed(pack) ? openedGroups() : closedGroups();
  if (nowClosed === !startsClosed(pack)) list.add(pack.id);
  else list.delete(pack.id);
  app.toolOpts[key] = [...list].slice(-100);
  saveToolOpts();
  head.setAttribute('aria-expanded', String(!nowClosed));
  grid.hidden = nowClosed;
  if (!nowClosed) fill();
}

function group(pack) {
  const labels = pack.labels?.() || {};
  const grid = h('div', { class: pack.set ? 'shape-subs' : 'shape-grid', role: 'group', 'aria-label': pack.name });
  // Zugeklappte Gruppen bekommen ihre Knöpfe erst beim Aufklappen
  const fill = () => {
    if (pack.set) return fillSet(grid, pack.set);
    if (grid.firstChild) return;
    grid.append(...pack.keys.map((k) => shapeButton(k, labels[k])));
    if (grid.firstChild) grid.firstChild.tabIndex = 0;
  };
  const closed = isClosed(pack);
  const head = h('button', { class: 'shape-group-head', type: 'button', 'aria-expanded': String(!closed), onclick: () => toggleGroup(pack, head, grid, fill) },
    h('span', { class: 'shape-chev', html: ICONS.chevDown || '' }), h('span', { class: 'shape-group-name' }, pack.name), h('span', { class: 'muted small' }, packCount(pack)));
  grid.hidden = closed;
  if (!closed) fill();
  return h('section', { class: 'shape-group' }, head, grid);
}

/* ---------------- Symbolsätze und eigene Pakete ---------------- */

const PAGE = 60; // Knöpfe je Schritt: Das Panel baut nie alle rund 5000 auf einmal
const failed = new Set(); // Sätze, deren Laden zuletzt fehlschlug

// Knöpfe entstehen seitenweise, sobald das Ende der Liste in Sicht kommt. „Mehr anzeigen“ bleibt für die Tastatur erreichbar.
const moreWatch = 'IntersectionObserver' in globalThis ? new IntersectionObserver((seen) => {
  for (const s of seen) if (s.isIntersecting) s.target.click();
}, { rootMargin: '160px' }) : null;

function pagedGrid(keys, label) {
  const grid = h('div', { class: 'shape-grid', role: 'group', 'aria-label': label });
  let shown = 0;
  const more = h('button', { class: 'btn small shape-more', type: 'button', onclick: () => page() }, T('Mehr anzeigen'));
  const page = () => {
    grid.append(...keys.slice(shown, shown + PAGE).map((k) => shapeButton(k)));
    if (!shown && grid.firstChild) grid.firstChild.tabIndex = 0;
    shown += PAGE;
    moreWatch?.unobserve(more);
    more.hidden = shown >= keys.length;
    if (!more.hidden) moreWatch?.observe(more);
  };
  page();
  return h('div', {}, grid, more);
}

const keysByGroup = (set) => {
  const by = new Map();
  for (const it of setItems(set)) by.set(it.group, [...(by.get(it.group) || []), it.k]);
  return by;
};
const openIconGroups = () => new Set(app.toolOpts.shapeIconGroupsOpen || []);
const shutIconGroups = () => new Set(app.toolOpts.shapeIconGroupsShut || []);
// Kleine Sätze (Kubernetes, Elektro, Verfahrenstechnik) zeigen ihre Untergruppen gleich offen, große erst auf Klick
const SMALL_SET = 200;

// Die Untergruppen der Allgemeinen Symbole behalten ihre bisherigen Kennungen, damit gespeicherte Auswahl gilt
const subId = (set, id) => (set === 'ti' ? id : `${set}:${id}`);

function iconSubgroup(id, name, keys, startOpen = false) {
  let content = null;
  const box = h('div', { class: 'shape-sub-body' });
  const opened = startOpen ? !shutIconGroups().has(id) : openIconGroups().has(id);
  const show = (on) => {
    box.hidden = !on;
    if (on && !content) {
      content = pagedGrid(keys, name);
      box.append(content);
    }
  };
  const head = h('button', { class: 'shape-group-head shape-sub-head', type: 'button', 'aria-expanded': String(opened), onclick: () => {
    const on = head.getAttribute('aria-expanded') !== 'true';
    const key = startOpen ? 'shapeIconGroupsShut' : 'shapeIconGroupsOpen';
    const list = startOpen ? shutIconGroups() : openIconGroups();
    if (on !== startOpen) list.add(id);
    else list.delete(id);
    app.toolOpts[key] = [...list].slice(-200);
    saveToolOpts();
    head.setAttribute('aria-expanded', String(on));
    show(on);
  } }, h('span', { class: 'shape-chev', html: ICONS.chevDown || '' }), h('span', { class: 'shape-group-name' }, name), h('span', { class: 'muted small' }, String(keys.length)));
  show(opened);
  return h('section', { class: 'shape-sub' }, head, box);
}

function iconStatus(sets) {
  const bad = sets.filter((s) => failed.has(s));
  if (!bad.length) return h('p', { class: 'muted small shape-status' }, T('Symbole werden geladen …'));
  return h('p', { class: 'muted small shape-status' }, T('Die Symbole konnten nicht geladen werden.'), ' ', h('button', { class: 'btn small', type: 'button', onclick: () => bad.forEach((s) => fetchSet(s, true)) }, T('Erneut versuchen')));
}

function fetchSet(set, force) {
  if (setLoaded(set) || !setOn(set)) return;
  failed.delete(set);
  loadSet(set, force).catch(() => {
    failed.add(set);
    if (panel && !manage) refreshBody();
  });
}

function fillSet(box, set) {
  if (!setLoaded(set)) {
    // Erst nach dem Öffnen angehakt: Dann hat noch niemand geladen
    if (!failed.has(set)) fetchSet(set, false);
    return box.replaceChildren(iconStatus([set]));
  }
  const by = keysByGroup(set);
  const groups = set === 'ti' ? ICON_GROUPS : setGroups(set);
  const used = groups.filter(([id]) => by.has(id));
  // Ein Paket ohne Unterteilung zeigt seine Symbole direkt
  if (used.length <= 1) return box.replaceChildren(pagedGrid([...by.values()].flat(), set));
  const small = set !== 'ti' && setItems(set).length <= SMALL_SET;
  box.replaceChildren(...used.map(([id, name]) => iconSubgroup(subId(set, id), name || T('Ohne Gruppe'), by.get(id), small)));
  return undefined;
}

const packCount = (p) => (p.set ? (setLoaded(p.set) ? String(setItems(p.set).length) : p.count != null ? String(p.count) : '') : String(p.keys.length));

function recentSection() {
  const keys = (app.toolOpts.recentShapes || []).filter(shapeUsable);
  if (!keys.length) return null;
  const grid = h('div', { class: 'shape-grid', role: 'group', 'aria-label': T('Zuletzt verwendet') }, keys.map((k) => shapeButton(k)));
  grid.firstChild.tabIndex = 0;
  return h('section', { class: 'shape-group shape-recent' }, h('div', { class: 'pop-title' }, T('Zuletzt verwendet')), grid);
}

const stampNow = () => JSON.stringify([adminOff(), userOff(), customPacks.map((p) => [p.id, p.version, p.name])]);

function fillGroups() {
  builtFor = stampNow();
  body.replaceChildren(...[recentSection(), ...availablePacks().map(group)].filter(Boolean));
}

// Formen und Symbole stehen untereinander in einer Trefferliste. Die Symbole folgen, sobald ihre Daten da sind.
function showResults(q) {
  const keys = searchShapes(q);
  const sets = setPacks().map((p) => p.set);
  // Eine Suche braucht alle eingeschalteten Sätze
  for (const s of sets) if (!failed.has(s)) fetchSet(s, false);
  const icons = searchIcons(q);
  const waiting = sets.filter((s) => !setLoaded(s));
  const parts = [];
  if (keys.length) parts.push(h('div', { class: 'shape-grid', role: 'group', 'aria-label': T('Suchergebnis') }, keys.map((k) => shapeButton(k))));
  if (icons.length) parts.push(h('div', { class: 'pop-title shape-hits' }, T('Symbole')), pagedGrid(icons, T('Symbole')));
  if (waiting.length) parts.push(iconStatus(waiting));
  if (!parts.length) parts.push(h('p', { class: 'muted pad' }, T('Keine passende Form gefunden.')));
  body.replaceChildren(...parts);
  const first = body.querySelector('.shape-btn');
  if (first) first.tabIndex = 0;
}

function refreshBody() {
  const q = searchInput.value.trim();
  if (q) showResults(q);
  else fillGroups();
}

async function setPack(id, on, box) {
  const before = userOff();
  const next = on ? before.filter((x) => x !== id) : [...before, id];
  app.me.shapePacksOff = next;
  try {
    await api('/api/auth/me/shape-packs', { method: 'PUT', body: { off: next } });
  } catch (e) {
    app.me.shapePacksOff = before;
    box.checked = !on;
    toast(e.message);
  }
}

function manageView() {
  const off = adminOff();
  return h('div', { class: 'shape-manage' },
    h('p', { class: 'muted small' }, T('Wähle, welche Pakete im Panel erscheinen. Vorhandene Elemente bleiben davon unberührt. Die Grundformen sind immer dabei.')),
    allPacks().filter((p) => p.id !== 'basic' && !off.includes(p.id)).map((p) => {
      const box = h('input', { type: 'checkbox', checked: !userOff().includes(p.id), onchange: () => setPack(p.id, box.checked, box) });
      box.dataset.pack = p.id;
      // Herkunft und Lizenz stehen unter dem Namen (Namensnennung der Symbolsätze)
      const source = p.source ? h('span', { class: 'muted small shape-source' }, p.source) : null;
      return h('label', { class: 'check shape-pack-row' }, box, h('span', { class: 'shape-pack-text' }, h('span', { class: 'shape-group-name' }, p.name), source), h('span', { class: 'muted small' }, packCount(p)));
    }));
}

function renderView(toggle) {
  toggle.textContent = manage ? T('Zurück zu den Formen') : T('Formen verwalten');
  searchInput.parentElement.hidden = manage;
  if (manage) body.replaceChildren(manageView());
  else refreshBody();
}

function build(closeButton) {
  searchInput = h('input', {
    type: 'search', placeholder: T('Formen und Symbole suchen …'), 'aria-label': T('Formen und Symbole suchen …'), autocomplete: 'off', spellcheck: 'false',
    oninput: refreshBody,
    onkeydown: (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const b = body.querySelector('.shape-btn');
        if (b && searchInput.value.trim()) b.click();
      } else if (e.key === 'ArrowDown') {
        const list = gridButtons();
        if (list.length) {
          e.preventDefault();
          focusButton(list[0], list);
        }
      }
    },
  });
  body = h('div', { class: 'shape-body' });
  const toggle = h('button', { class: 'btn small', type: 'button', onclick: () => {
    manage = !manage;
    renderView(toggle);
  } });
  panel = h('div', { class: 'shapes-panel', onkeydown: (e) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      if (searchInput.value && !manage) {
        searchInput.value = '';
        refreshBody();
        searchInput.focus();
      } else {
        toggleSidePanel('shapes');
        document.querySelector('#tools [data-tool="shape"]')?.focus();
      }
      return;
    }
    gridKey(e);
  } },
  h('div', { class: 'side-head' }, h('h3', {}, T('Alle Formen')), h('span', { class: 'spacer' }), closeButton),
  h('div', { class: 'shape-search' }, searchInput),
  body,
  h('div', { class: 'side-actions shape-foot' }, toggle));
  renderView(toggle);
  return toggle;
}

// Aufruf aus renderSidePanel. Der Aufbau bleibt erhalten, damit das erneute Öffnen und Neuzeichnen nichts kostet.
export function mountShapesPanel(side, closeButton) {
  if (!panel) build(closeButton());
  else if (!manage && !searchInput.value && builtFor !== stampNow()) fillGroups();
  if (!side.contains(panel)) side.replaceChildren(panel);
  markActive();
  // Erst nach dem Aufbau: Die Formen stehen sofort, die Allgemeinen Symbole und eigene Pakete kommen dazu
  if (!failed.has('ti')) fetchSet('ti', false);
  fetchCustomPacks().then((changed) => {
    if (!changed || !panel) return;
    iconIndex.clear();
    if (manage) body.replaceChildren(manageView());
    else refreshBody();
  });
}

// Nach einer Änderung an „Zuletzt verwendet“ steht die Liste beim nächsten Öffnen neu oben
function refreshRecent() {
  if (!panel || manage || searchInput.value) return;
  const cur = body.querySelector('.shape-recent');
  const next = recentSection();
  if (cur && next) cur.replaceWith(next);
  else if (cur) cur.remove();
  else if (next) body.prepend(next);
}

export function openShapesPanel() {
  if (app.viewOnly) return;
  closePop();
  showSidePanel('shapes');
  refreshRecent();
  if (!narrow()) searchInput.focus();
}

app.on('tool', () => open() && markActive());
app.on('shapeUsed', () => open() && refreshRecent());
onIconsLoaded((set) => {
  iconIndex.delete(set);
  failed.delete(set);
  if (panel && !manage) refreshBody();
  else if (panel) body.replaceChildren(manageView());
});
