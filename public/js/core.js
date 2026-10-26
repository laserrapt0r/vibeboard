// Kern des Board-Editors: Zustand, Ansicht, Rendering, Historie, Interaktion
import {
  SVGNS, uid, clamp, clone, wrap, rectsIntersect, rectContains, unionRect, loadPref, savePref,
  debounce, throttle, toast, contrastText, STICKY_COLORS, api,
} from './util.js';
import { renderElement, elBounds, isOrphan, connectorGeom, defsMarkup, sortForRender, LH, textLayout, shapeTextBox, penPath, sidePoint, codeMetrics, MONO,
  outlinePoint, sideAnchor, waypointsOf, projectOnPath, pointAlong } from './render.js';
import { THEMES } from './highlight.js';
import { Sync } from './sync.js';

const boardId = location.pathname.split('/').filter(Boolean).pop();

export const app = {
  boardId,
  viewOnly: false,   // wird nach dem Laden aus der Rolle gesetzt
  role: null,
  user: { id: '', name: '', color: '#4262ff' },
  sync: null,
  name: '',
  els: new Map(),
  sel: new Set(),
  tool: 'select',
  toolOpts: loadPref('toolOpts', {
    stickyColor: '#fff9b1', shape: 'rect', penColor: '#1a1a1a', penWidth: 3,
    hlColor: '#f5d128', routing: 'curve', emoji: '👍',
  }),
  view: { x: 0, y: 0, z: 1 },
  session: { timer: null, voting: null },
  peers: new Map(),
  settings: loadPref('settings', { grid: true, snap: false, showAuthor: false, dark: false, hideResolved: false, smartGuides: true, wheelZoom: true }),
  serverOffset: 0,
  editing: null,
  voteMode: true,
  searchHits: [],
  searchIndex: -1,
  following: null,
  loaded: false,
  _l: {},
  on(ev, fn) {
    (this._l[ev] = this._l[ev] || []).push(fn);
  },
  emit(ev, ...a) {
    (this._l[ev] || []).forEach((f) => f(...a));
  },
};

export const $ = (s) => document.querySelector(s);
export const stage = $('#stage');
const svg = $('#svg');
const world = $('#world');
const layerFrames = $('#layer-frames');
const layerEls = $('#layer-els');
const layerOverlay = $('#layer-overlay');
const layerDraft = $('#layer-draft');
const editor = $('#editor');
$('#defs').innerHTML = defsMarkup();

export const getEl = (id) => app.els.get(id);
export const bounds = (el) => elBounds(el, getEl);
export const now = () => Date.now() + app.serverOffset;

/* ================================================================== */
/* Ansicht                                                             */
/* ================================================================== */

export function toWorld(cx, cy) {
  const r = stage.getBoundingClientRect();
  return { x: (cx - r.left - app.view.x) / app.view.z, y: (cy - r.top - app.view.y) / app.view.z };
}

export function toScreen(wx, wy) {
  return { x: wx * app.view.z + app.view.x, y: wy * app.view.z + app.view.y };
}

export function visibleRect() {
  const r = stage.getBoundingClientRect();
  return { x: -app.view.x / app.view.z, y: -app.view.y / app.view.z, w: r.width / app.view.z, h: r.height / app.view.z };
}

const saveView = debounce(() => savePref('view.' + boardId, app.view), 500);
const sendView = throttle(() => app.sync && app.sync.signal('view', visibleRect()), 150);

export function applyView(fromRemote = false) {
  if (![app.view.x, app.view.y, app.view.z].every(Number.isFinite) || app.view.z <= 0) app.view = { x: 0, y: 0, z: 1 };
  const { x, y, z } = app.view;
  world.setAttribute('transform', `translate(${x},${y}) scale(${z})`);
  let gs = 20;
  while (gs * z < 12) gs *= 5;
  stage.style.backgroundSize = `${gs * z}px ${gs * z}px`;
  stage.style.backgroundPosition = `${x}px ${y}px`;
  for (const el of app.els.values()) if (el.type === 'comment') markDirty(el.id);
  scheduleRender(true);
  saveView();
  sendView();
  if (!fromRemote && app.following && !app._applyingFollow) {
    app.following = null;
    app.emit('peers');
  }
  app.emit('view');
}

export function zoomAt(cx, cy, z) {
  const r = stage.getBoundingClientRect();
  z = clamp(z, 0.01, 8);
  const px = cx - r.left, py = cy - r.top;
  const wx = (px - app.view.x) / app.view.z, wy = (py - app.view.y) / app.view.z;
  app.view.z = z;
  app.view.x = px - wx * z;
  app.view.y = py - wy * z;
  applyView();
}

export function zoomBy(f) {
  const r = stage.getBoundingClientRect();
  zoomAt(r.left + r.width / 2, r.top + r.height / 2, app.view.z * f);
}

let anim = 0;
export function animateView(target, ms = 280) {
  cancelAnimationFrame(anim);
  const from = { ...app.view };
  const t0 = performance.now();
  const step = (t) => {
    const k = Math.min(1, (t - t0) / ms);
    const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
    // Zoom logarithmisch interpolieren, damit es gleichmäßig wirkt
    const z = from.z * (target.z / from.z) ** e;
    const r = stage.getBoundingClientRect();
    const cxFrom = (r.width / 2 - from.x) / from.z, cyFrom = (r.height / 2 - from.y) / from.z;
    const cxTo = (r.width / 2 - target.x) / target.z, cyTo = (r.height / 2 - target.y) / target.z;
    const cx = cxFrom + (cxTo - cxFrom) * e, cy = cyFrom + (cyTo - cyFrom) * e;
    app.view = { z, x: r.width / 2 - cx * z, y: r.height / 2 - cy * z };
    applyView(true);
    if (k < 1) anim = requestAnimationFrame(step);
  };
  anim = requestAnimationFrame(step);
}

export function viewFor(rect, pad = 80, maxZ = 2) {
  const r = stage.getBoundingClientRect();
  // Auf kleinen Bildschirmen darf der Rand nicht den ganzen Platz einnehmen
  pad = Math.min(pad, r.width * 0.12, r.height * 0.12);
  const z = clamp(Math.min((r.width - pad * 2) / Math.max(rect.w, 1), (r.height - pad * 2) / Math.max(rect.h, 1)), 0.01, maxZ);
  return { z, x: r.width / 2 - (rect.x + rect.w / 2) * z, y: r.height / 2 - (rect.y + rect.h / 2) * z };
}

export function fitTo(rect, { pad = 80, animate = true, maxZ = 2 } = {}) {
  if (!rect) return;
  const v = viewFor(rect, pad, maxZ);
  if (animate) animateView(v);
  else {
    app.view = v;
    applyView(true);
  }
}

export function fitAll(animate = true) {
  const b = unionRect([...app.els.values()].filter((e) => !isOrphan(e, getEl)).map(bounds));
  if (b) fitTo(b, { animate, maxZ: 1 });
  else {
    const r = stage.getBoundingClientRect();
    app.view = { x: r.width / 2, y: r.height / 2, z: 1 };
    applyView();
  }
}

export function viewCenter() {
  const v = visibleRect();
  return { x: v.x + v.w / 2, y: v.y + v.h / 2 };
}

/* ================================================================== */
/* Rendering                                                           */
/* ================================================================== */

const nodes = new Map();
const dirty = new Set();
let orderDirty = false;
let overlayDirty = false;
let raf = 0;

export function markDirty(id) {
  dirty.add(id);
  scheduleRender();
}

export function scheduleRender(overlay = false) {
  if (overlay) overlayDirty = true;
  if (!raf) raf = requestAnimationFrame(flushRender);
}

export function rerenderAll() {
  for (const id of app.els.keys()) dirty.add(id);
  orderDirty = true;
  scheduleRender(true);
}

function renderEnv() {
  return {
    get: getEl,
    zoom: app.view.z,
    showAuthor: app.settings.showAuthor,
    placeholders: true,
    editingCell: app.editing && app.editing.cell,
    labelBg: app.settings.dark ? '#2a2b31' : '#ffffff',
  };
}

function flushRender() {
  raf = 0;
  if (dirty.size) {
    // abhängige Verbindungen mitzeichnen
    for (const el of app.els.values()) {
      if (el.type === 'connector' && ((el.from && el.from.id && dirty.has(el.from.id)) || (el.to && el.to.id && dirty.has(el.to.id)))) dirty.add(el.id);
    }
    const env = renderEnv();
    for (const id of dirty) renderNode(id, env);
    dirty.clear();
    overlayDirty = true;
  }
  if (orderDirty) reorder();
  if (overlayDirty) {
    overlayDirty = false;
    renderOverlay();
  }
  app.emit('render');
}

function renderNode(id, env) {
  const el = app.els.get(id);
  let g = nodes.get(id);
  if (!el) {
    if (g) g.remove();
    nodes.delete(id);
    return;
  }
  if (el.type === 'comment' && el.resolved && app.settings.hideResolved) {
    if (g) g.remove();
    nodes.delete(id);
    return;
  }
  if (!g) {
    g = document.createElementNS(SVGNS, 'g');
    g.dataset.id = id;
    nodes.set(id, g);
    orderDirty = true;
  }
  let cls = 'el el-' + el.type;
  if (el.locked) cls += ' locked';
  if (app.editing && app.editing.id === id && !app.editing.cell) cls += ' editing';
  g.setAttribute('class', cls);
  try {
    g.innerHTML = renderElement(el, env);
  } catch (e) {
    // Ein fehlerhaftes Element darf die Darstellung des übrigen Boards nicht blockieren
    console.error('Element konnte nicht dargestellt werden:', id, e);
    g.innerHTML = '';
  }
}

function reorder() {
  orderDirty = false;
  const sorted = sortForRender([...app.els.values()]);
  for (const el of sorted) {
    const g = nodes.get(el.id);
    if (!g) continue;
    (el.type === 'frame' ? layerFrames : layerEls).appendChild(g);
  }
}

/* ================================================================== */
/* Änderungen, Historie, Synchronisation                               */
/* ================================================================== */

const undoStack = [];
const redoStack = [];
let tx = null;
let maxZ = 0;

export const nextZ = () => ++maxZ;

export function begin() {
  if (!tx) tx = { before: new Map(), depth: 0 };
  tx.depth++;
}

export function commit() {
  if (!tx) return;
  if (--tx.depth > 0) return;
  const t = tx;
  tx = null;
  const after = new Map();
  let changed = false;
  for (const [id, b] of t.before) {
    const a = app.els.has(id) ? clone(app.els.get(id)) : null;
    after.set(id, a);
    if (JSON.stringify(a) !== JSON.stringify(b)) changed = true;
  }
  if (changed) {
    undoStack.push({ before: t.before, after });
    if (undoStack.length > 300) undoStack.shift();
    redoStack.length = 0;
    app.emit('history');
  }
  scheduleSaveThumb();
}

export function act(fn) {
  begin();
  try {
    return fn();
  } finally {
    commit();
  }
}

function record(id) {
  if (tx && !tx.before.has(id)) tx.before.set(id, app.els.has(id) ? clone(app.els.get(id)) : null);
}

export function setEl(el, send = true) {
  // Verdeckte private Elemente anderer sind unveränderlich
  if (app.viewOnly || el.hidden || app.els.get(el.id)?.hidden) return;
  record(el.id);
  const prev = app.els.get(el.id);
  app.els.set(el.id, el);
  if (!prev || prev.z !== el.z) orderDirty = true;
  if (el.z > maxZ) maxZ = el.z;
  markDirty(el.id);
  if (send) app.sync.upsert(el);
}

export function updateEl(id, patch) {
  const el = app.els.get(id);
  if (!el) return;
  setEl(autoHeight({ ...el, ...patch }));
}

export function deleteEl(id) {
  if (app.viewOnly || !app.els.has(id) || app.els.get(id).hidden) return;
  record(id);
  app.els.delete(id);
  app.sel.delete(id);
  markDirty(id);
  app.sync.remove(id);
}

export function deleteEls(ids) {
  act(() => {
    const set = new Set(ids);
    for (const el of app.els.values()) {
      if (el.type === 'connector' && ((el.from.id && set.has(el.from.id)) || (el.to.id && set.has(el.to.id)))) set.add(el.id);
    }
    for (const id of set) deleteEl(id);
  });
  selectionChanged();
}

function applySnapshot(map) {
  const removed = new Set();
  for (const [id, el] of map) {
    if (el) {
      // Privat-Kennzeichen bestimmt der Server – den aktuellen Stand behalten statt den aus der Historie
      const n = clone(el);
      const cur = app.els.get(id);
      delete n.priv;
      delete n.privName;
      if (cur && cur.priv) Object.assign(n, { priv: cur.priv, privName: cur.privName });
      setEl(n);
    } else {
      deleteEl(id);
      removed.add(id);
    }
  }
  // Verbindungen, die inzwischen an gelöschte Elemente gehängt wurden, ebenfalls entfernen
  if (removed.size) {
    for (const el of [...app.els.values()]) {
      if (el.type === 'connector' && ((el.from?.id && removed.has(el.from.id)) || (el.to?.id && removed.has(el.to.id)))) deleteEl(el.id);
    }
  }
  for (const id of [...app.sel]) if (!app.els.has(id)) app.sel.delete(id);
  selectionChanged();
  scheduleSaveThumb();
}

export function undo() {
  if (app.editing) finishEdit();
  if (drag || tx) return;
  const e = undoStack.pop();
  if (!e) return;
  applySnapshot(e.before);
  redoStack.push(e);
  app.emit('history');
}

export function redo() {
  if (app.editing) finishEdit();
  if (drag || tx) return;
  const e = redoStack.pop();
  if (!e) return;
  applySnapshot(e.after);
  undoStack.push(e);
  app.emit('history');
}

export const canUndo = () => undoStack.length > 0;
export const canRedo = () => redoStack.length > 0;

export function applyRemoteOp(op) {
  if (op.op === 'upsert') {
    if (op.el.type === 'code') op = { ...op, el: autoHeight(op.el) };
    const prev = app.els.get(op.el.id);
    app.els.set(op.el.id, op.el);
    if (!prev || prev.z !== op.el.z) orderDirty = true;
    if (op.el.z > maxZ) maxZ = op.el.z;
    markDirty(op.el.id);
    const ed = app.editing;
    if (ed && ed.id === op.el.id) {
      // Noch nichts getippt: fremden Text übernehmen; sonst gewinnt die eigene Eingabe beim nächsten Tastendruck
      if (!ed.dirty) {
        const v = ed.cell ? op.el.cells?.[ed.cell[0]]?.[ed.cell[1]] : op.el[ed.field];
        if (v !== undefined && v !== editor.value) editor.value = v ?? '';
      }
      requestAnimationFrame(layoutEditor);
    }
  } else if (op.op === 'delete') {
    app.els.delete(op.id);
    if (app.sel.delete(op.id)) selectionChanged();
    markDirty(op.id);
    if (app.editing && app.editing.id === op.id) abortEdit();
  }
}

export function loadElements(obj) {
  for (const id of nodes.keys()) markDirty(id);
  app.els.clear();
  maxZ = 0;
  for (let el of Object.values(obj || {})) {
    if (el.type === 'code') el = autoHeight(el);
    app.els.set(el.id, el);
    if (el.z > maxZ) maxZ = el.z;
    markDirty(el.id);
  }
  for (const id of [...app.sel]) if (!app.els.has(id)) app.sel.delete(id);
  orderDirty = true;
}

/* Vorschaubild für die Board-Übersicht */
const scheduleSaveThumb = debounce(async () => {
  if (app.viewOnly || app.session.privateMode?.active) return;
  try {
    const { thumbnail } = await import('./exporter.js');
    const url = await thumbnail([...app.els.values()]);
    if (url) api(`/api/boards/${boardId}/thumb`, { method: 'PUT', body: url }).catch(() => {});
  } catch {}
}, 4000);

/* ================================================================== */
/* Elemente erzeugen & Hilfen                                          */
/* ================================================================== */

export function autoHeight(el) {
  if (el.type === 'code') {
    const m = codeMetrics(el);
    const h = m.head + m.pad * 2 + Math.max(1, m.lines) * m.lh;
    return Math.abs(h - el.h) > 0.5 ? { ...el, h } : el;
  }
  if (el.type !== 'text') return el;
  const size = Number(el.fontSize) || 16;
  const lines = wrap(el.text || '', el.w - 8, size, el.bold, el.italic).length;
  const h = Math.max(1, lines) * size * LH + 8;
  return Math.abs(h - el.h) > 0.5 ? { ...el, h } : el;
}

export function makeElement(type, x, y, o = {}) {
  const base = { id: uid(), type, z: nextZ(), author: app.user.name || '' };
  switch (type) {
    case 'sticky':
      return { ...base, x: x - 100, y: y - 100, w: 200, h: 200, fill: app.toolOpts.stickyColor, text: '', fontSize: 'auto', ...o };
    case 'shape':
      return { ...base, x: x - 100, y: y - 70, w: 200, h: 140, shape: app.toolOpts.shape, fill: '#ffffff', stroke: '#1a1a1a', strokeWidth: 2, text: '', fontSize: 18, ...o };
    case 'text':
      return autoHeight({ ...base, x: x - 4, y: y - 18, w: 260, h: 38, text: '', fontSize: 24, color: app.settings.dark ? '#f1f1f1' : '#1a1a1a', align: 'left', ...o });
    case 'frame': {
      const n = [...app.els.values()].filter((e) => e.type === 'frame').length + 1;
      return { ...base, x: x - 640, y: y - 360, w: 1280, h: 720, title: 'Frame ' + n, fill: '#ffffff', order: n, ...o };
    }
    case 'card':
      return { ...base, x: x - 150, y: y - 70, w: 300, h: 140, title: 'Neue Karte', description: '', color: '#4262ff', ...o };
    case 'code':
      return autoHeight({ ...base, x: x - 260, y: y - 80, w: 520, h: 160, text: '', lang: app.toolOpts.codeLang || 'js', theme: 'dark', fontSize: 14, ...o });
    case 'table': {
      const cells = [['Spalte 1', 'Spalte 2', 'Spalte 3'], ['', '', ''], ['', '', ''], ['', '', '']];
      return { ...base, x: x - 240, y: y - 100, w: 480, h: 200, rows: 4, cols: 3, cells, header: true, fontSize: 14, ...o };
    }
    case 'emoji':
      return { ...base, x: x - 32, y: y - 32, w: 64, h: 64, char: app.toolOpts.emoji, ...o };
    case 'comment':
      return { ...base, x, y, thread: [], resolved: false, color: app.user.color, ...o };
    case 'connector':
      return { ...base, from: { x, y }, to: { x, y }, stroke: app.settings.dark ? '#e6e6e6' : '#1a1a1a', strokeWidth: 2, routing: app.toolOpts.routing, arrowEnd: true, arrowStart: false, label: '', ...o };
  }
  return { ...base, x, y, ...o };
}

export function addElements(list, { select = true } = {}) {
  act(() => list.forEach((e) => setEl(e)));
  if (select) setSelection(list.filter((e) => e.type !== 'connector' || list.length === 1).map((e) => e.id));
}

export function translated(o, dx, dy) {
  const n = { ...o };
  if (o.type === 'connector') {
    if (!o.from.id) n.from = { ...o.from, x: o.from.x + dx, y: o.from.y + dy };
    if (!o.to.id) n.to = { ...o.to, x: o.to.x + dx, y: o.to.y + dy };
    if (o.waypoints && o.waypoints.length) n.waypoints = waypointsOf(o).map((p) => ({ x: p.x + dx, y: p.y + dy }));
  } else {
    n.x = o.x + dx;
    n.y = o.y + dy;
  }
  return n;
}

function scaleEl(o, ob, nb, singleCorner) {
  const fx = nb.w / (ob.w || 1), fy = nb.h / (ob.h || 1);
  const mx = (v) => nb.x + (v - ob.x) * fx, my = (v) => nb.y + (v - ob.y) * fy;
  if (o.type === 'connector') {
    const n = { ...o };
    if (!o.from.id) n.from = { ...o.from, x: mx(o.from.x), y: my(o.from.y) };
    if (!o.to.id) n.to = { ...o.to, x: mx(o.to.x), y: my(o.to.y) };
    if (o.waypoints && o.waypoints.length) n.waypoints = waypointsOf(o).map((p) => ({ x: mx(p.x), y: my(p.y) }));
    return n;
  }
  if (o.type === 'comment') return { ...o, x: mx(o.x), y: my(o.y) };
  const n = { ...o, x: mx(o.x), y: my(o.y), w: Math.max(4, o.w * fx), h: Math.max(4, o.h * fy) };
  if (o.type === 'pen') n.points = o.points.map(([px, py]) => [px * fx, py * fy]);
  if (o.type === 'code') return autoHeight(n);
  if (o.type === 'text') {
    if (singleCorner && typeof o.fontSize === 'number') n.fontSize = Math.max(6, Math.round(o.fontSize * fy * 10) / 10);
    return autoHeight(n);
  }
  return n;
}

export function selectedEls() {
  return [...app.sel].map(getEl).filter(Boolean);
}

export function selectionBounds() {
  return unionRect(selectedEls().map(bounds));
}

function withGroups(ids) {
  const out = new Set(ids);
  const groups = new Set();
  for (const id of ids) {
    const g = getEl(id)?.groupId;
    if (g) groups.add(g);
  }
  if (groups.size) for (const el of app.els.values()) if (el.groupId && groups.has(el.groupId)) out.add(el.id);
  return out;
}

export function frameChildren(frame) {
  const fb = { x: frame.x, y: frame.y, w: frame.w, h: frame.h };
  const out = [];
  for (const el of app.els.values()) {
    if (el.id === frame.id || el.hidden) continue;
    if (el.type === 'connector') {
      const ends = [el.from, el.to];
      if (ends.every((e) => !e.id && e.x >= fb.x && e.x <= fb.x + fb.w && e.y >= fb.y && e.y <= fb.y + fb.h)) out.push(el);
      continue;
    }
    const b = bounds(el);
    if (el.type === 'frame' ? rectContains(fb, b) : (b.x + b.w / 2 >= fb.x && b.x + b.w / 2 <= fb.x + fb.w && b.y + b.h / 2 >= fb.y && b.y + b.h / 2 <= fb.y + fb.h)) out.push(el);
  }
  return out;
}

export function frames() {
  return [...app.els.values()].filter((e) => e.type === 'frame').sort((a, b) => (a.order ?? 1e9) - (b.order ?? 1e9) || a.y - b.y || a.x - b.x);
}

function elementAt(wx, wy, exclude, pad = 0) {
  const list = sortForRender([...app.els.values()]).reverse();
  for (const el of list) {
    if (exclude && exclude.has(el.id)) continue;
    if (el.type === 'connector' || el.type === 'pen' || el.type === 'comment' || el.type === 'frame') continue;
    if (wx >= el.x - pad && wx <= el.x + el.w + pad && wy >= el.y - pad && wy <= el.y + el.h + pad) return el;
  }
  return null;
}

/* ================================================================== */
/* Auswahl & Overlay                                                   */
/* ================================================================== */

export function setSelection(ids) {
  app.sel = withGroups(ids);
  selectionChanged();
}

export function selectionChanged() {
  // Verdeckte private Elemente anderer lassen sich nicht auswählen
  for (const id of [...app.sel]) if (getEl(id)?.hidden) app.sel.delete(id);
  scheduleRender(true);
  app.emit('selection');
  if (app.sync) sendSel();
}

const sendSel = throttle(() => app.sync.signal('sel', [...app.sel].slice(0, 200)), 200);

const escXml = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

let marquee = null;
let guides = [];
let hoverTarget = null;
let hoverAnchor = null; // Andockpunkt beim Ziehen eines Verbinders: { end, pt }

const SIDES = ['top', 'right', 'bottom', 'left'];
const r3 = (v) => Math.round(v * 1000) / 1000;

// Wo dockt ein Verbinder an, wenn er an Punkt w über Element t losgelassen wird?
//  – nahe einer Seitenmitte: diese Seite
//  – nahe dem Umriss: fester Punkt auf dem Umriss
//  – im Inneren: automatisch (wählt jeweils die günstigste Seite)
function anchorEnd(t, w) {
  const b = bounds(t);
  // Bei kleinen Elementen darf die Schwelle nicht das ganze Innere abdecken
  const thr = Math.min(14 / app.view.z, b.w / 4, b.h / 4);
  const shapeKind = { ...b, shape: t.type === 'shape' ? t.shape : 'rect' };
  for (const side of SIDES) {
    const p = sideAnchor(shapeKind, side);
    if (Math.hypot(p.x - w.x, p.y - w.y) < thr) return { end: { id: t.id, side }, pt: p };
  }
  const ax = (w.x - (b.x + b.w / 2)) / (b.w / 2 || 1), ay = (w.y - (b.y + b.h / 2)) / (b.h / 2 || 1);
  if (ax || ay) {
    const op = outlinePoint(shapeKind, ax, ay);
    if (Math.hypot(op.x - w.x, op.y - w.y) < thr) {
      const nx = (op.x - (b.x + b.w / 2)) / (b.w / 2 || 1), ny = (op.y - (b.y + b.h / 2)) / (b.h / 2 || 1);
      return { end: { id: t.id, ax: r3(nx), ay: r3(ny) }, pt: op };
    }
  }
  return { end: { id: t.id }, pt: null };
}

// Element unter dem Zeiger für Verbinder – auch knapp außerhalb des Umrisses
function connectTargetAt(e, w, excludeId) {
  const hit = hitInfo(e.target);
  let t = hit && !['connector', 'pen', 'comment', 'frame'].includes(hit.el.type) ? hit.el : elementAt(w.x, w.y, null, 14 / app.view.z);
  if (t && (t.id === excludeId || t.hidden)) t = null;
  return t;
}
let draftRect = null;

function renderOverlay() {
  const z = app.view.z;
  const sw = 1.5 / z;
  let out = '';
  // Auswahl anderer Teilnehmer
  for (const p of app.peers.values()) {
    if (p.away) continue;
    let labelAt = null;
    for (const id of p.sel || []) {
      const el = getEl(id);
      if (!el) continue;
      const b = bounds(el);
      out += `<rect x="${b.x - 3 / z}" y="${b.y - 3 / z}" width="${b.w + 6 / z}" height="${b.h + 6 / z}" fill="none" stroke="${p.color}" stroke-width="${2 / z}" rx="${3 / z}"/>`;
      if (!labelAt || b.y < labelAt.y) labelAt = b;
    }
    // Namensschild an der Auswahl bzw. am gerade bearbeiteten Element
    const ed = p.editing && getEl(p.editing);
    if (ed) labelAt = bounds(ed);
    if (labelAt) {
      const label = (ed ? '✎ ' : '') + p.name + (ed ? ' schreibt …' : '');
      const fs = 11 / z, lw = (label.length * 6.4 + 14) / z, lh = 18 / z;
      out += `<g class="peer-tag"><rect x="${labelAt.x - 3 / z}" y="${labelAt.y - 3 / z - lh}" width="${lw}" height="${lh}" rx="${4 / z}" fill="${p.color}"/>` +
        `<text x="${labelAt.x + 4 / z}" y="${labelAt.y - 3 / z - lh * 0.3}" font-size="${fs}" font-weight="bold" fill="#fff" font-family="Helvetica, Arial, sans-serif">${escXml(label)}</text></g>`;
    }
  }
  // Suchtreffer
  app.searchHits.forEach((id, i) => {
    const el = getEl(id);
    if (!el) return;
    const b = bounds(el);
    out += `<rect x="${b.x - 6 / z}" y="${b.y - 6 / z}" width="${b.w + 12 / z}" height="${b.h + 12 / z}" fill="#ffd43b" fill-opacity="${i === app.searchIndex ? 0.35 : 0.15}" stroke="#f59f00" stroke-width="${(i === app.searchIndex ? 3 : 1.5) / z}" rx="${4 / z}"/>`;
  });
  const sel = selectedEls();
  for (const el of sel) {
    if (el.type === 'connector') {
      const g = connectorGeom(el, getEl);
      if (!g) continue;
      out += `<path d="${g.d}" fill="none" stroke="#4262ff" stroke-width="${(el.strokeWidth || 2) + 4 / z}" stroke-opacity="0.35"/>`;
      continue;
    }
    const b = bounds(el);
    out += `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="none" stroke="${el.locked ? '#868e96' : '#4262ff'}" stroke-width="${sw}"${el.locked ? ` stroke-dasharray="${4 / z} ${3 / z}"` : ''}/>`;
  }
  const dragging = drag && (drag.mode === 'move' || drag.mode === 'marquee');
  if (!app.viewOnly && sel.length && !app.editing && !dragging) {
    const hs = 9 / z;
    if (sel.length === 1 && sel[0].type === 'connector') {
      const c = sel[0];
      const g = connectorGeom(c, getEl);
      if (g) {
        // „+“-Griffe in der Mitte jedes Abschnitts: Ziehen erzeugt einen Knickpunkt
        const tk = g.keys.map((k) => projectOnPath(g.poly, k).t);
        for (let i = 0; i < g.keys.length - 1; i++) {
          const a = g.keys[i], b = g.keys[i + 1];
          if (Math.hypot(b.x - a.x, b.y - a.y) * z < 48) continue;
          let tm = (tk[i] + tk[i + 1]) / 2;
          // Nicht genau auf die Beschriftung legen (die soll greifbar bleiben)
          const lp = Number.isFinite(Number(c.labelPos)) ? Number(c.labelPos) : 0.5;
          if (c.label && Math.abs(tm - lp) < 0.1) tm = tk[i] + (tk[i + 1] - tk[i]) * (tm < lp ? 0.25 : 0.75);
          const m = pointAlong(g.poly, tm);
          out += `<g data-handle="add-${i}" class="wp-add"><title>Ziehen: Knickpunkt einfügen</title><circle cx="${m.x}" cy="${m.y}" r="${9 / z}" fill="#4262ff" fill-opacity="0.12"/><circle cx="${m.x}" cy="${m.y}" r="${4.5 / z}" fill="#fff" stroke="#4262ff" stroke-width="${1.5 / z}"/></g>`;
        }
        waypointsOf(c).forEach((p, i) => {
          out += `<rect data-handle="wp-${i}" class="wp" x="${p.x - 5 / z}" y="${p.y - 5 / z}" width="${10 / z}" height="${10 / z}" rx="${2 / z}" fill="#4262ff" stroke="#fff" stroke-width="${1.5 / z}"><title>Knickpunkt – ziehen zum Verschieben, Doppelklick zum Entfernen</title></rect>`;
        });
        for (const [k, p] of [['from', g.p1], ['to', g.p2]]) {
          out += `<circle data-handle="${k}" cx="${p.x}" cy="${p.y}" r="${6 / z}" fill="#fff" stroke="#4262ff" stroke-width="${2 / z}"/>`;
        }
      }
    } else if (!sel.every((e) => e.locked) && !(sel.length === 1 && sel[0].type === 'comment')) {
      const b = selectionBounds();
      if (sel.length > 1) out += `<rect x="${b.x - 4 / z}" y="${b.y - 4 / z}" width="${b.w + 8 / z}" height="${b.h + 8 / z}" fill="none" stroke="#4262ff" stroke-width="${sw}" stroke-dasharray="${5 / z} ${4 / z}"/>`;
      const pts = {
        nw: [b.x, b.y], n: [b.x + b.w / 2, b.y], ne: [b.x + b.w, b.y], e: [b.x + b.w, b.y + b.h / 2],
        se: [b.x + b.w, b.y + b.h], s: [b.x + b.w / 2, b.y + b.h], sw: [b.x, b.y + b.h], w: [b.x, b.y + b.h / 2],
      };
      const small = b.w * z < 40 || b.h * z < 40;
      for (const [k, [px, py]] of Object.entries(pts)) {
        if (small && k.length === 1) continue;
        out += `<rect data-handle="${k}" class="h-${k}" x="${px - hs / 2}" y="${py - hs / 2}" width="${hs}" height="${hs}" rx="${2 / z}" fill="#fff" stroke="#4262ff" stroke-width="${sw}"/>`;
      }
      if (sel.length === 1 && ['sticky', 'shape', 'card', 'text', 'image'].includes(sel[0].type)) {
        const off = 24 / z;
        const qc = { top: [b.x + b.w / 2, b.y - off], right: [b.x + b.w + off, b.y + b.h / 2], bottom: [b.x + b.w / 2, b.y + b.h + off], left: [b.x - off, b.y + b.h / 2] };
        for (const [k, [px, py]] of Object.entries(qc)) {
          out += `<g data-qc="${k}" class="qc"><circle cx="${px}" cy="${py}" r="${9 / z}" fill="#4262ff" fill-opacity="0.12"/><circle cx="${px}" cy="${py}" r="${5 / z}" fill="#fff" stroke="#4262ff" stroke-width="${1.5 / z}"/></g>`;
        }
      }
    }
  }
  if (hoverTarget) {
    const b = bounds(hoverTarget);
    const floating = !hoverAnchor || !hoverAnchor.pt;
    // Im Inneren: automatisch andocken (ganze Form hervorgehoben); am Rand: fester Punkt
    out += `<rect x="${b.x - 4 / z}" y="${b.y - 4 / z}" width="${b.w + 8 / z}" height="${b.h + 8 / z}" fill="#4262ff" fill-opacity="${floating ? 0.12 : 0.04}" stroke="#4262ff" stroke-width="${(floating ? 2.5 : 1.5) / z}" rx="${4 / z}"/>`;
    for (const side of SIDES) {
      const p = sideAnchor({ ...b, shape: hoverTarget.type === 'shape' ? hoverTarget.shape : 'rect' }, side);
      out += `<circle cx="${p.x}" cy="${p.y}" r="${4 / z}" fill="#4262ff"/>`;
    }
    if (!floating) out += `<circle cx="${hoverAnchor.pt.x}" cy="${hoverAnchor.pt.y}" r="${8 / z}" fill="#4262ff" fill-opacity="0.25" stroke="#4262ff" stroke-width="${2 / z}"/><circle cx="${hoverAnchor.pt.x}" cy="${hoverAnchor.pt.y}" r="${3 / z}" fill="#fff"/>`;
  }
  if (marquee) out += `<rect x="${marquee.x}" y="${marquee.y}" width="${marquee.w}" height="${marquee.h}" fill="#4262ff" fill-opacity="0.08" stroke="#4262ff" stroke-width="${1 / z}"/>`;
  if (draftRect) out += `<rect x="${draftRect.x}" y="${draftRect.y}" width="${draftRect.w}" height="${draftRect.h}" fill="#4262ff" fill-opacity="0.06" stroke="#4262ff" stroke-width="${1.5 / z}" stroke-dasharray="${6 / z} ${4 / z}"/>`;
  for (const g of guides) {
    out += g.axis === 'x'
      ? `<line x1="${g.v}" y1="${g.a}" x2="${g.v}" y2="${g.b}" stroke="#f03e3e" stroke-width="${1 / z}"/>`
      : `<line x1="${g.a}" y1="${g.v}" x2="${g.b}" y2="${g.v}" stroke="#f03e3e" stroke-width="${1 / z}"/>`;
  }
  layerOverlay.innerHTML = out;
  app.emit('overlay');
}

/* ================================================================== */
/* Textbearbeitung                                                     */
/* ================================================================== */

export function canEdit(el) {
  return el && !el.locked && !el.hidden && ['sticky', 'shape', 'text', 'frame', 'connector', 'table', 'code'].includes(el.type);
}

export function startEdit(id, opts = {}) {
  const el = getEl(id);
  if (!el || app.viewOnly) return;
  if (el.type === 'card') return app.emit('editCard', id);
  // Beschriftung als eigenes Textelement in derselben Gruppe (z. B. Nachrichten im Sequenzdiagramm)
  if (el.type === 'connector' && !el.label && el.groupId) {
    const txt = [...app.els.values()].find((t) => t.type === 'text' && t.groupId === el.groupId);
    if (txt) return startEdit(txt.id, opts);
  }
  if (!canEdit(el)) return;
  if (app.editing) finishEdit();
  const field = el.type === 'frame' ? 'title' : el.type === 'connector' ? 'label' : 'text';
  let cell = null;
  if (el.type === 'table') {
    cell = opts.cell || [0, 0];
  }
  begin();
  app.editing = { id, field, cell, isNew: !!opts.isNew };
  setSelection([id]);
  const val = cell ? el.cells?.[cell[0]]?.[cell[1]] ?? '' : el[field] ?? '';
  editor.value = val;
  editor.style.display = 'block';
  layoutEditor();
  markDirty(id);
  editor.focus();
  if (opts.selectAll !== false) editor.select();
  else editor.setSelectionRange(editor.value.length, editor.value.length);
  app.emit('editing', true);
}

function editorGeometry(el) {
  const z = app.view.z;
  const ed = app.editing;
  let box, lay, align = 'center', valign = 'middle', color = '#1a1a1a';
  switch (el.type) {
    case 'sticky': {
      const pad = Math.max(8, Math.min(el.w, el.h) * 0.08);
      box = { x: el.x + pad, y: el.y + pad, w: el.w - pad * 2, h: el.h - pad * 2 };
      lay = textLayout(el, box);
      align = el.align || 'center';
      color = el.textColor || contrastText(el.fill);
      break;
    }
    case 'shape':
      box = shapeTextBox(el.shape, el.x, el.y, el.w, el.h);
      lay = textLayout(el, box);
      align = el.align || 'center';
      valign = el.valign || 'middle';
      color = el.textColor || contrastText(el.fill === 'transparent' ? '#ffffff' : el.fill);
      break;
    case 'text':
      box = { x: el.x + 4, y: el.y + 4, w: el.w - 8, h: Math.max(el.h - 8, 20) };
      lay = textLayout(el, box);
      align = el.align || 'left';
      valign = 'top';
      color = el.color || '#1a1a1a';
      break;
    case 'frame': {
      const ts = Math.max(14, Math.min(48, Math.min(el.w, el.h) / 45));
      box = { x: el.x, y: el.y - ts * 1.6, w: Math.max(240, el.w / 2), h: ts * 1.5 };
      lay = { size: ts, lines: [el.title || ''], bold: true };
      align = 'left';
      color = '#6b6b6b';
      break;
    }
    case 'connector': {
      const g = connectorGeom(el, getEl) || { mid: { x: 0, y: 0 } };
      const fs = el.fontSize || 14;
      box = { x: g.mid.x - 100, y: g.mid.y - fs, w: 200, h: fs * 2 };
      lay = { size: fs, lines: (el.label || ' ').split('\n') };
      color = el.stroke;
      break;
    }
    case 'code': {
      const m = codeMetrics(el);
      box = { x: el.x + m.gutter + m.pad, y: el.y + m.head + m.pad, w: el.w - m.gutter - m.pad * 2, h: el.h - m.head - m.pad * 2 };
      lay = { size: m.fs, lines: String(editor.value).split('\n') };
      align = 'left';
      valign = 'top';
      color = THEMES[el.theme === 'light' ? 'light' : 'dark'].text;
      break;
    }
    case 'table': {
      const [r, c] = ed.cell;
      const cw = el.w / el.cols, rh = el.h / el.rows;
      const fs = el.fontSize || 14;
      box = { x: el.x + c * cw + 8, y: el.y + r * rh + 6, w: cw - 16, h: rh - 12 };
      const bold = el.header !== false && r === 0;
      lay = { size: fs, lines: wrap(editor.value, box.w, fs, bold), bold };
      align = 'left';
      break;
    }
  }
  return { box, lay, align, valign, color, z };
}

export function layoutEditor() {
  const ed = app.editing;
  if (!ed) return;
  const el = getEl(ed.id);
  if (!el || !cellValid(el, ed.cell)) return abortEdit();
  const { box, lay, align, valign, color, z } = editorGeometry(el);
  const p = toScreen(box.x, box.y);
  const textH = Math.max(1, lay.lines.length) * lay.size * LH;
  let padTop = 0;
  if (valign === 'middle') padTop = Math.max(0, (box.h - textH) / 2);
  else if (valign === 'bottom') padTop = Math.max(0, box.h - textH);
  Object.assign(editor.style, {
    left: p.x + 'px',
    top: p.y + 'px',
    width: box.w * z + 'px',
    height: Math.max(box.h, textH) * z + 'px',
    fontSize: lay.size * z + 'px',
    lineHeight: LH,
    paddingTop: padTop * z + 'px',
    textAlign: align,
    color,
    fontWeight: lay.bold ? 'bold' : 'normal',
    fontStyle: el.italic ? 'italic' : 'normal',
    fontFamily: el.type === 'code' ? MONO : '',
    whiteSpace: el.type === 'code' ? 'pre' : '',
    tabSize: '2',
    background: el.type === 'connector' || el.type === 'frame' ? (app.settings.dark ? '#2a2b31' : '#ffffff') : 'transparent',
  });
}

function cellValid(el, cell) {
  if (!cell) return true;
  return el.type === 'table' && cell[0] < el.rows && cell[1] < el.cols && Array.isArray(el.cells?.[cell[0]]);
}

editor.addEventListener('input', () => {
  const ed = app.editing;
  if (!ed) return;
  const el = getEl(ed.id);
  if (!el || !cellValid(el, ed.cell)) return abortEdit();
  ed.dirty = true;
  if (ed.cell) {
    const cells = el.cells.map((r) => [...r]);
    cells[ed.cell[0]][ed.cell[1]] = editor.value;
    setEl({ ...el, cells });
  } else {
    setEl(autoHeight({ ...el, [ed.field]: editor.value }));
  }
  layoutEditor();
});

editor.addEventListener('keydown', (e) => {
  e.stopPropagation();
  const ed = app.editing;
  if (!ed) return;
  if (e.key === 'Escape' || (e.key === 'Enter' && (e.ctrlKey || e.metaKey))) {
    e.preventDefault();
    finishEdit();
  } else if (e.key === 'Enter' && (ed.field === 'title')) {
    e.preventDefault();
    finishEdit();
  } else if (e.key === 'Tab') {
    e.preventDefault();
    const el = getEl(ed.id);
    if (el && el.type === 'code') {
      // Einrückung statt Fokuswechsel
      document.execCommand('insertText', false, '  ');
    } else if (el && el.type === 'table') {
      finishEdit();
      let [r, c] = ed.cell;
      c += e.shiftKey ? -1 : 1;
      if (c >= el.cols) { c = 0; r = (r + 1) % el.rows; }
      if (c < 0) { c = el.cols - 1; r = (r - 1 + el.rows) % el.rows; }
      startEdit(el.id, { cell: [r, c] });
    } else if (el && el.mind) {
      finishEdit();
      mindAddChild(el);
    }
  } else if (e.key === 'Enter' && !e.shiftKey && getEl(ed.id)?.mind) {
    e.preventDefault();
    const el = getEl(ed.id);
    finishEdit();
    mindAddSibling(el);
  }
});

editor.addEventListener('blur', () => setTimeout(() => {
  if (app.editing && document.activeElement !== editor) finishEdit();
}, 0));

export function finishEdit() {
  const ed = app.editing;
  if (!ed) return;
  const el = getEl(ed.id);
  if (el && el.type === 'text' && !String(el.text || '').trim()) deleteEls([el.id]);
  cancelEditUI();
  commit();
}

// Bearbeitung von außen beendet (Element gelöscht o. Ä.): Oberfläche schließen und die in startEdit
// geöffnete Transaktion abschließen, damit die Undo-Historie nicht hängen bleibt
export function abortEdit() {
  if (!app.editing) return;
  cancelEditUI();
  commit();
}

function cancelEditUI() {
  const ed = app.editing;
  app.editing = null;
  editor.style.display = 'none';
  editor.blur();
  if (ed) markDirty(ed.id);
  scheduleRender(true);
  app.emit('editing', false);
}

/* ================================================================== */
/* Mindmap                                                             */
/* ================================================================== */

const BRANCH_COLORS = ['#4262ff', '#12b886', '#f59f00', '#e64980', '#7048e8', '#1098ad', '#f03e3e'];

function mindParent(node) {
  for (const el of app.els.values()) if (el.type === 'connector' && el.mind && el.to.id === node.id) return getEl(el.from.id);
  return null;
}

function mindChildren(node) {
  const out = [];
  for (const el of app.els.values()) if (el.type === 'connector' && el.mind && el.from.id === node.id && getEl(el.to.id)) out.push(getEl(el.to.id));
  return out;
}

export function mindAddChild(node) {
  const parent = mindParent(node);
  const kids = mindChildren(node);
  let dir = 1;
  if (parent) dir = node.x + node.w / 2 >= parent.x + parent.w / 2 ? 1 : -1;
  else if (kids.length) {
    const r = kids.filter((k) => k.x > node.x).length, l = kids.length - r;
    dir = r > l ? -1 : 1;
  }
  const isRoot = !parent;
  const sameSide = kids.filter((k) => (dir > 0 ? k.x > node.x : k.x < node.x));
  const color = isRoot ? BRANCH_COLORS[kids.length % BRANCH_COLORS.length] : (node.stroke && node.stroke !== 'none' ? node.stroke : node.fill);
  const w = isRoot ? 220 : 180, h = isRoot ? 64 : 50;
  const x = dir > 0 ? node.x + node.w + 100 : node.x - 100 - w;
  let y = node.y + node.h / 2 - h / 2;
  if (sameSide.length) y = Math.max(...sameSide.map((k) => k.y + k.h)) + 24;
  const child = makeElement('shape', 0, 0, {
    x, y, w, h, mind: true, shape: isRoot ? 'roundrect' : 'pill',
    fill: isRoot ? color : '#ffffff', stroke: isRoot ? 'none' : color, strokeWidth: 2,
    textColor: isRoot ? '#ffffff' : undefined, bold: isRoot, fontSize: isRoot ? 20 : 16, text: '',
  });
  const conn = makeElement('connector', 0, 0, { from: { id: node.id }, to: { id: child.id }, stroke: color, strokeWidth: isRoot ? 4 : 2, routing: 'curve', arrowEnd: false, mind: true });
  act(() => {
    setEl(child);
    setEl(conn);
  });
  startEdit(child.id, { isNew: true });
}

export function mindAddSibling(node) {
  const parent = mindParent(node);
  if (parent) mindAddChild(parent);
  else mindAddChild(node);
}

/* ================================================================== */
/* Werkzeuge                                                           */
/* ================================================================== */

export function setTool(t) {
  if (app.viewOnly && !['select', 'hand', 'laser'].includes(t)) return;
  app.tool = t;
  stage.dataset.tool = t;
  if (t !== 'select') {
    if (app.editing) finishEdit();
  }
  app.emit('tool', t);
}

export function saveToolOpts() {
  savePref('toolOpts', app.toolOpts);
}

/* ================================================================== */
/* Zeiger-Interaktion                                                  */
/* ================================================================== */

let drag = null;
let spaceDown = false;
const pointers = new Map();
let lastCursorWorld = { x: 0, y: 0 };
export const lastPointer = () => lastCursorWorld;

const sendCursor = throttle((p) => app.sync && app.sync.signal('cursor', p), 60);

function hitInfo(target) {
  if (!target || !target.closest) return null;
  const g = target.closest('g[data-id]');
  if (!g || !world.contains(g) || layerOverlay.contains(g)) return null;
  const el = getEl(g.dataset.id);
  if (!el) return null;
  return {
    el,
    frameTitle: target.classList.contains('frame-title') || target.classList.contains('frame-title-text'),
    frameBody: target.classList.contains('frame-body'),
  };
}

function snapV(v) {
  return app.settings.snap ? Math.round(v / 20) * 20 : v;
}

stage.addEventListener('pointerdown', onDown);
window.addEventListener('pointermove', onMove);
window.addEventListener('pointerup', onUp);
window.addEventListener('pointercancel', onUp);

function onDown(e) {
  if (e.target === editor) return;
  // Verhindert, dass das folgende mousedown einem gerade geöffneten Editor den Fokus nimmt
  e.preventDefault();
  const active = document.activeElement;
  if (active && active !== document.body && active !== editor) active.blur();
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 2) {
    // Pinch-Zoom
    const [a, b] = [...pointers.values()];
    if (drag && drag.tx) {
      commit();
      app.emit('dragging', false);
    }
    drag = { mode: 'pinch', dist: Math.hypot(a.x - b.x, a.y - b.y), z: app.view.z, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, vx: app.view.x, vy: app.view.y };
    draftRect = null;
    marquee = null;
    layerDraft.innerHTML = '';
    return;
  }
  if (app.editing) finishEdit();
  app.emit('pointerdown', e);
  const w = toWorld(e.clientX, e.clientY);
  const start = { cx: e.clientX, cy: e.clientY, w };
  if (e.button === 2) return;

  if (e.button === 1 || spaceDown || app.tool === 'hand') {
    e.preventDefault();
    drag = { mode: 'pan', start, vx: app.view.x, vy: app.view.y };
    stage.classList.add('panning');
    return;
  }

  const badge = e.target.closest && e.target.closest('.link-badge');
  if (badge && e.button === 0 && app.tool === 'select') {
    window.open(badge.dataset.link, '_blank', 'noopener');
    return;
  }

  const hit = hitInfo(e.target);
  const handle = e.target.closest && e.target.closest('[data-handle]');
  const qc = e.target.closest && e.target.closest('[data-qc]');

  // Abstimmungsmodus
  const v = app.session.voting;
  if (v && v.active && app.voteMode && app.tool === 'select' && hit && !['frame', 'connector', 'comment', 'pen'].includes(hit.el.type)) {
    app.emit('vote', hit.el.id, e.altKey || e.shiftKey ? -1 : 1);
    return;
  }

  if (app.tool === 'laser') {
    drag = { mode: 'laser', start };
    return;
  }

  if (app.viewOnly) {
    if (hit && hit.el.type === 'comment') app.emit('openComment', hit.el.id);
    drag = { mode: 'pan', start, vx: app.view.x, vy: app.view.y };
    stage.classList.add('panning');
    return;
  }

  switch (app.tool) {
    case 'select': {
      if (handle) {
        const k = handle.dataset.handle;
        begin();
        if (k === 'from' || k === 'to') {
          drag = { mode: 'conn-end', start, end: k, id: [...app.sel][0], tx: true };
        } else if (k.startsWith('wp-') || k.startsWith('add-')) {
          const id = [...app.sel][0];
          const c = getEl(id);
          let index = Number(k.split('-')[1]);
          if (k.startsWith('add-')) {
            const wps = waypointsOf(c);
            wps.splice(index, 0, { x: w.x, y: w.y });
            setEl({ ...c, waypoints: wps });
          }
          drag = { mode: 'wp', start, id, index, tx: true };
        } else {
          const sel = selectedEls().filter((x) => !x.locked);
          drag = { mode: 'resize', start, handle: k, ob: selectionBounds(), origs: sel.map(clone), tx: true };
        }
        return;
      }
      if (qc) {
        const src = selectedEls()[0];
        drag = { mode: 'qc', start, side: qc.dataset.qc, src, moved: false };
        return;
      }
      if (hit) {
        const el = hit.el;
        if (el.type === 'frame' && !hit.frameTitle && !(app.sel.has(el.id) && app.sel.size === 1)) {
          startMarquee(e, start, el.id);
          return;
        }
        if (el.locked) {
          startMarquee(e, start, el.id);
          return;
        }
        if (el.hidden) {
          startMarquee(e, start, null);
          return;
        }
        if (el.type === 'comment') {
          setSelection([el.id]);
          drag = { mode: 'move', start, origs: [clone(el)], tx: true, clickComment: el.id };
          begin();
          return;
        }
        // In einer Mehrfachauswahl verschiebt Ziehen an einer Linie die ganze Auswahl
        const inMulti = app.sel.size > 1 && app.sel.has(el.id);
        if (el.type === 'connector' && !inMulti && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
          // Beschriftung entlang der Linie verschieben
          if (e.target.closest && e.target.closest('.conn-label')) {
            setSelection([el.id]);
            begin();
            drag = { mode: 'label', start, id: el.id, tx: true };
            return;
          }
          // Liegen mehrere Linien übereinander: Ziehen biegt die ausgewählte, ein Klick wählt die nächste
          const { current, next } = overlappingConnector(el, w);
          if (current.from.id || current.to.id) {
            setSelection([current.id]);
            begin();
            drag = { mode: 'bend', start, id: current.id, tx: true, cycleTo: next && next.id };
            return;
          }
          if (next) {
            setSelection([next.id]);
            return;
          }
        }
        if (e.shiftKey || e.ctrlKey || e.metaKey) {
          const ids = withGroups([el.id]);
          const s = new Set(app.sel);
          if (s.has(el.id)) ids.forEach((i) => s.delete(i));
          else ids.forEach((i) => s.add(i));
          app.sel = s;
          selectionChanged();
          if (!app.sel.has(el.id)) return;
        } else if (!app.sel.has(el.id)) {
          setSelection([el.id]);
        }
        startMove(e, start);
        // Klick ohne Ziehen auf ein Element einer Mehrfachauswahl wählt nur dieses aus
        const grp = withGroups([el.id]);
        if (!e.shiftKey && !e.ctrlKey && !e.metaKey && app.sel.size > grp.size) drag.clickSelect = el.id;
        return;
      }
      startMarquee(e, start, null);
      return;
    }
    case 'sticky': case 'shape': case 'frame': case 'text': case 'card': case 'table': case 'code':
      drag = { mode: 'create', start, type: app.tool };
      return;
    case 'mindmap': {
      const el = makeElement('shape', w.x, w.y, { x: w.x - 130, y: w.y - 45, w: 260, h: 90, shape: 'pill', fill: '#1a1a1a', stroke: 'none', strokeWidth: 0, textColor: '#ffffff', bold: true, fontSize: 22, text: '', mind: true });
      act(() => setEl(el));
      setTool('select');
      startEdit(el.id, { isNew: true });
      return;
    }
    case 'connector': {
      const target = connectTargetAt(e, w, null);
      drag = { mode: 'connect', start, from: target ? anchorEnd(target, w).end : { x: snapV(w.x), y: snapV(w.y) }, fromEl: target };
      return;
    }
    case 'pen': case 'highlighter':
      drag = { mode: 'draw', start, points: [[w.x, w.y]] };
      drawDraft();
      return;
    case 'eraser':
      begin();
      drag = { mode: 'erase', start, tx: true };
      eraseAt(e);
      return;
    case 'comment': {
      const el = makeElement('comment', w.x, w.y);
      act(() => setEl(el));
      setTool('select');
      setSelection([el.id]);
      app.emit('openComment', el.id, true);
      return;
    }
    case 'emoji': {
      const el = makeElement('emoji', w.x, w.y);
      act(() => setEl(el));
      return;
    }
  }
}

// Alle Verbinder, die am Punkt w (fast) deckungsgleich verlaufen; ist einer davon ausgewählt, kommt der nächste dran
function overlappingConnector(hitEl, w) {
  const tol = 6 / app.view.z;
  const list = sortForRender([...app.els.values()].filter((c) => c.type === 'connector' && !c.hidden)).reverse().filter((c) => {
    const g = connectorGeom(c, getEl);
    return g && projectOnPath(g.poly, w).dist <= tol;
  });
  if (list.length < 2) return { current: hitEl, next: null };
  const cur = list.findIndex((c) => app.sel.size === 1 && app.sel.has(c.id));
  if (cur < 0) return { current: hitEl, next: null };
  return { current: list[cur], next: list[(cur + 1) % list.length], count: list.length };
}

function startMarquee(e, start, pendingSelect) {
  drag = { mode: 'marquee', start, additive: e.shiftKey, base: new Set(e.shiftKey ? app.sel : []), pendingSelect };
  if (!e.shiftKey && !pendingSelect) {
    app.sel = new Set();
    selectionChanged();
  }
}

function startMove(e, start) {
  begin();
  let ids = new Set(app.sel);
  // Frames nehmen ihren Inhalt mit
  for (const id of app.sel) {
    const el = getEl(id);
    if (el && el.type === 'frame') frameChildren(el).forEach((c) => ids.add(c.id));
  }
  ids = [...ids].filter((id) => getEl(id) && !getEl(id).locked);
  // Knickpunkte von Verbindern zwischen mitbewegten Elementen wandern mit
  const idSet = new Set(ids);
  for (const c of app.els.values()) {
    if (c.type === 'connector' && !idSet.has(c.id) && waypointsOf(c).length && c.from.id && c.to.id && idSet.has(c.from.id) && idSet.has(c.to.id)) ids.push(c.id);
  }
  if (e.altKey) {
    // Alt-Ziehen = Kopie
    const copies = duplicateEls(ids.map(getEl), 0, 0, false);
    ids = copies.map((c) => c.id);
    app.sel = new Set(copies.filter((c) => app.sel.has(c._src)).map((c) => c.id));
    copies.forEach((c) => delete c._src);
    selectionChanged();
  }
  const origs = ids.map((id) => clone(getEl(id)));
  const moving = new Set(ids);
  const ob = unionRect(origs.map((o) => elBounds(o, getEl)));
  // Kandidaten für Hilfslinien
  const vr = visibleRect();
  const cand = { x: [], y: [] };
  if (app.settings.smartGuides && !app.settings.snap) {
    for (const el of app.els.values()) {
      if (moving.has(el.id) || el.type === 'connector' || el.type === 'pen' || el.type === 'comment') continue;
      const b = bounds(el);
      if (!rectsIntersect(b, vr)) continue;
      cand.x.push(b.x, b.x + b.w / 2, b.x + b.w);
      cand.y.push(b.y, b.y + b.h / 2, b.y + b.h);
      if (cand.x.length > 900) break;
    }
  }
  drag = { mode: 'move', start, origs, ob, cand, moved: false, tx: true };
}

function onMove(e) {
  if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  const w = toWorld(e.clientX, e.clientY);
  if (e.target === svg || stage.contains(e.target)) {
    lastCursorWorld = w;
    sendCursor({ x: Math.round(w.x), y: Math.round(w.y) });
  }
  if (!drag) {
    if (app.tool === 'connector' && !app.viewOnly) {
      const t = connectTargetAt(e, w, null);
      const a = t ? anchorEnd(t, w) : null;
      if (t !== hoverTarget || JSON.stringify(a) !== JSON.stringify(hoverAnchor)) {
        hoverTarget = t;
        hoverAnchor = a;
        scheduleRender(true);
      }
    } else if (hoverTarget) {
      hoverTarget = null;
      hoverAnchor = null;
      scheduleRender(true);
    }
    return;
  }
  const s = drag.start;
  const dxs = e.clientX - s.cx, dys = e.clientY - s.cy;
  const far = Math.hypot(dxs, dys) > 4;
  switch (drag.mode) {
    case 'pinch': {
      if (pointers.size < 2) return;
      const [a, b] = [...pointers.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
      app.view.x = drag.vx + (cx - drag.cx);
      app.view.y = drag.vy + (cy - drag.cy);
      applyView();
      zoomAt(cx, cy, drag.z * (dist / drag.dist));
      drag.z = app.view.z;
      drag.dist = dist;
      drag.cx = cx;
      drag.cy = cy;
      drag.vx = app.view.x;
      drag.vy = app.view.y;
      return;
    }
    case 'pan':
      app.view.x = drag.vx + dxs;
      app.view.y = drag.vy + dys;
      applyView();
      return;
    case 'laser':
      app.emit('laser', w, true);
      return;
    case 'move': {
      if (!drag.moved && !far) return;
      drag.moved = true;
      let dx = w.x - s.w.x, dy = w.y - s.w.y;
      guides = [];
      if (drag.ob) {
        if (app.settings.snap) {
          dx = snapV(drag.ob.x + dx) - drag.ob.x;
          dy = snapV(drag.ob.y + dy) - drag.ob.y;
        } else if (app.settings.smartGuides && !e.ctrlKey && !e.metaKey) {
          const thr = 6 / app.view.z;
          const nb = { x: drag.ob.x + dx, y: drag.ob.y + dy, w: drag.ob.w, h: drag.ob.h };
          const sx = bestSnap([nb.x, nb.x + nb.w / 2, nb.x + nb.w], drag.cand.x, thr);
          const sy = bestSnap([nb.y, nb.y + nb.h / 2, nb.y + nb.h], drag.cand.y, thr);
          if (sx) {
            dx += sx.d;
            guides.push({ axis: 'x', v: sx.v, a: nb.y - 2000, b: nb.y + nb.h + 2000 });
          }
          if (sy) {
            dy += sy.d;
            guides.push({ axis: 'y', v: sy.v, a: nb.x - 2000, b: nb.x + nb.w + 2000 });
          }
        }
      }
      for (const o of drag.origs) applyGeom(o, translated(o, dx, dy));
      app.emit('dragging', true);
      return;
    }
    case 'resize': {
      const ob = drag.ob;
      if (!ob) return;
      const dx = w.x - s.w.x, dy = w.y - s.w.y;
      let { x, y, w: bw, h: bh } = ob;
      const k = drag.handle;
      if (k.includes('e')) bw = ob.w + dx;
      if (k.includes('w')) { x = ob.x + dx; bw = ob.w - dx; }
      if (k.includes('s')) bh = ob.h + dy;
      if (k.includes('n')) { y = ob.y + dy; bh = ob.h - dy; }
      const keep = e.shiftKey || drag.origs.some((o) => ['image', 'emoji'].includes(o.type)) || drag.origs.length > 1;
      if (keep && k.length === 2) {
        const f = Math.max(bw / (ob.w || 1), bh / (ob.h || 1));
        bw = ob.w * f;
        bh = ob.h * f;
        if (k.includes('w')) x = ob.x + ob.w - bw;
        if (k.includes('n')) y = ob.y + ob.h - bh;
      }
      if (app.settings.snap) {
        const x2 = snapV(x + bw), y2 = snapV(y + bh);
        if (k.includes('w')) x = snapV(x);
        if (k.includes('n')) y = snapV(y);
        if (k.includes('e')) bw = x2 - x;
        if (k.includes('s')) bh = y2 - y;
        if (k.includes('w')) bw = ob.x + ob.w - x;
        if (k.includes('n')) bh = ob.y + ob.h - y;
      }
      bw = Math.max(10, bw);
      bh = Math.max(10, bh);
      const nb = { x, y, w: bw, h: bh };
      const single = drag.origs.length === 1 && k.length === 2;
      for (const o of drag.origs) applyGeom(o, scaleEl(o, ob, nb, single));
      app.emit('dragging', true);
      return;
    }
    case 'marquee': {
      if (!far && !marquee) return;
      const r = rectFrom(s.w, w);
      marquee = r;
      const s2 = new Set(drag.base);
      for (const el of app.els.values()) {
        const b = bounds(el);
        if (el.type === 'frame' ? rectContains(r, b) : rectsIntersect(r, b)) s2.add(el.id);
      }
      app.sel = withGroups(s2);
      selectionChanged();
      return;
    }
    case 'create': {
      if (!far) return;
      if (['shape', 'frame', 'text', 'table', 'sticky'].includes(drag.type)) {
        let r = rectFrom({ x: snapV(s.w.x), y: snapV(s.w.y) }, { x: snapV(w.x), y: snapV(w.y) });
        if (e.shiftKey || drag.type === 'sticky') {
          const m = Math.max(r.w, r.h);
          r = { x: w.x < s.w.x ? s.w.x - m : s.w.x, y: w.y < s.w.y ? s.w.y - m : s.w.y, w: m, h: m };
        }
        draftRect = r;
        scheduleRender(true);
      }
      return;
    }
    case 'connect':
    case 'qc': {
      if (drag.mode === 'qc' && !far) return;
      if (drag.mode === 'qc' && !drag.moved) {
        drag.moved = true;
        drag.from = { id: drag.src.id, side: drag.side };
        drag.fromEl = drag.src;
      }
      const t = connectTargetAt(e, w, drag.fromEl && drag.fromEl.id);
      hoverTarget = t;
      hoverAnchor = t ? anchorEnd(t, w) : null;
      scheduleRender(true);
      drag.to = hoverAnchor ? hoverAnchor.end : { x: snapV(w.x), y: snapV(w.y) };
      drawConnectorDraft();
      return;
    }
    case 'conn-end': {
      const c = getEl(drag.id);
      if (!c) return;
      const other = drag.end === 'from' ? c.to : c.from;
      const t = connectTargetAt(e, w, other.id);
      hoverTarget = t;
      hoverAnchor = t ? anchorEnd(t, w) : null;
      scheduleRender(true);
      setEl({ ...c, [drag.end]: hoverAnchor ? hoverAnchor.end : { x: snapV(w.x), y: snapV(w.y) } });
      return;
    }
    case 'bend': {
      if (!far) return;
      const c = getEl(drag.id);
      const g = c && connectorGeom(c, getEl);
      if (!g) return;
      // Knickpunkt an der passenden Stelle der Reihenfolge einfügen
      const tp = projectOnPath(g.poly, s.w).t;
      const tk = g.keys.map((k) => projectOnPath(g.poly, k).t);
      let index = 0;
      while (index < tk.length - 2 && tp > tk[index + 1]) index++;
      const wps = waypointsOf(c);
      wps.splice(index, 0, { x: w.x, y: w.y });
      setEl({ ...c, waypoints: wps });
      drag = { ...drag, mode: 'wp', index };
      app.emit('dragging', true);
      return;
    }
    case 'wp': {
      const c = getEl(drag.id);
      if (!c) return;
      const wps = waypointsOf(c);
      if (!wps[drag.index]) return;
      const g = connectorGeom(c, getEl);
      // An Nachbarpunkten waagerecht/senkrecht einrasten (gerade Linien)
      let { x, y } = w;
      guides = [];
      if (g && !e.ctrlKey && !e.metaKey) {
        const thr = 8 / app.view.z;
        const nb = [g.keys[drag.index], g.keys[drag.index + 2]].filter(Boolean);
        for (const q of nb) {
          if (Math.abs(q.x - x) < thr) {
            x = q.x;
            guides.push({ axis: 'x', v: x, a: Math.min(y, q.y) - 40, b: Math.max(y, q.y) + 40 });
          }
          if (Math.abs(q.y - y) < thr) {
            y = q.y;
            guides.push({ axis: 'y', v: y, a: Math.min(x, q.x) - 40, b: Math.max(x, q.x) + 40 });
          }
        }
      }
      wps[drag.index] = { x: snapV(x), y: snapV(y) };
      setEl({ ...c, waypoints: wps });
      app.emit('dragging', true);
      return;
    }
    case 'label': {
      const c = getEl(drag.id);
      const g = c && connectorGeom(c, getEl);
      if (!g) return;
      setEl({ ...c, labelPos: Math.round(projectOnPath(g.poly, w).t * 1000) / 1000 });
      return;
    }
    case 'draw': {
      const last = drag.points[drag.points.length - 1];
      if (Math.hypot(w.x - last[0], w.y - last[1]) * app.view.z < 2) return;
      drag.points.push([w.x, w.y]);
      drawDraft();
      return;
    }
    case 'erase':
      eraseAt(e);
      return;
  }
}

// Nur Position/Größe auf den aktuellen Stand übertragen – Änderungen anderer (Text, Farbe) bleiben erhalten,
// und während des Ziehens gelöschte Elemente werden nicht wiederbelebt
const GEOM_KEYS = ['x', 'y', 'w', 'h', 'points', 'from', 'to', 'fontSize', 'waypoints'];
function applyGeom(orig, moved) {
  const cur = getEl(orig.id);
  if (!cur) return;
  const n = { ...cur };
  for (const k of GEOM_KEYS) if (k in moved) n[k] = moved[k];
  setEl(n);
}

function bestSnap(vals, cands, thr) {
  let best = null;
  for (const v of vals) {
    for (const c of cands) {
      const d = c - v;
      if (Math.abs(d) <= thr && (!best || Math.abs(d) < Math.abs(best.d))) best = { d, v: c };
    }
  }
  return best;
}

function onUp(e) {
  pointers.delete(e.pointerId);
  if (!drag) return;
  const d = drag;
  if (d.mode === 'pinch') {
    if (pointers.size < 2) drag = null;
    return;
  }
  drag = null;
  const w = toWorld(e.clientX, e.clientY);
  const far = Math.hypot(e.clientX - d.start.cx, e.clientY - d.start.cy) > 4;
  stage.classList.remove('panning');
  guides = [];
  const hadHover = hoverTarget;
  hoverTarget = null;
  hoverAnchor = null;
  switch (d.mode) {
    case 'move':
      commit();
      if (d.clickComment && !d.moved) app.emit('openComment', d.clickComment);
      if (d.clickSelect && !d.moved) setSelection([d.clickSelect]);
      app.emit('dragging', false);
      break;
    case 'resize':
      commit();
      app.emit('dragging', false);
      break;
    case 'marquee':
      marquee = null;
      if (!far && d.pendingSelect) setSelection([d.pendingSelect]);
      break;
    case 'create': {
      const r = draftRect;
      draftRect = null;
      let el;
      if (r && far) {
        el = makeElement(d.type, 0, 0);
        Object.assign(el, { x: r.x, y: r.y, w: Math.max(r.w, 20), h: Math.max(r.h, 20) });
        if (d.type === 'text' || d.type === 'code') el = autoHeight(el);
      } else {
        el = makeElement(d.type, snapV(d.start.w.x), snapV(d.start.w.y));
      }
      act(() => setEl(el));
      setTool('select');
      setSelection([el.id]);
      if (['sticky', 'shape', 'text', 'code'].includes(el.type)) startEdit(el.id, { isNew: true });
      else if (el.type === 'frame') startEdit(el.id);
      else if (el.type === 'card') app.emit('editCard', el.id);
      break;
    }
    case 'connect': {
      layerDraft.innerHTML = '';
      if (!d.to || (!far && !hadHover)) break;
      if (!d.from.id && !d.to.id && Math.hypot(d.to.x - d.from.x, d.to.y - d.from.y) < 10) break;
      const c = makeElement('connector', 0, 0, { from: d.from, to: d.to });
      act(() => setEl(c));
      setSelection([c.id]);
      break;
    }
    case 'qc': {
      layerDraft.innerHTML = '';
      quickConnect(d, w, hadHover);
      break;
    }
    case 'bend':
      commit();
      if (d.cycleTo) {
        setSelection([d.cycleTo]);
        toast('Mehrere Linien liegen hier übereinander – jeder weitere Klick wählt die nächste', 2500);
      }
      break;
    case 'conn-end':
    case 'wp':
    case 'label':
      commit();
      app.emit('dragging', false);
      break;
    case 'draw': {
      layerDraft.innerHTML = '';
      const pts = d.points;
      const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
      const minX = Math.min(...xs), minY = Math.min(...ys);
      const hl = app.tool === 'highlighter';
      const el = {
        id: uid(), type: 'pen', z: nextZ(), x: minX, y: minY,
        w: Math.max(1, Math.max(...xs) - minX), h: Math.max(1, Math.max(...ys) - minY),
        points: pts.map(([px, py]) => [Math.round((px - minX) * 10) / 10, Math.round((py - minY) * 10) / 10]),
        stroke: hl ? app.toolOpts.hlColor : app.toolOpts.penColor,
        strokeWidth: hl ? Math.max(12, app.toolOpts.penWidth * 4) : app.toolOpts.penWidth,
        opacity: hl ? 0.45 : 1,
      };
      act(() => setEl(el));
      break;
    }
    case 'erase':
      commit();
      break;
    case 'laser':
      app.emit('laser', w, false);
      break;
  }
  scheduleRender(true);
}

function rectFrom(a, b) {
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) };
}

function drawDraft() {
  const d = drag;
  const hl = app.tool === 'highlighter';
  const color = hl ? app.toolOpts.hlColor : app.toolOpts.penColor;
  const width = hl ? Math.max(12, app.toolOpts.penWidth * 4) : app.toolOpts.penWidth;
  layerDraft.innerHTML = `<path d="${penPath(d.points)}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" stroke-opacity="${hl ? 0.45 : 1}"/>`;
}

function drawConnectorDraft() {
  const d = drag;
  const tmp = { id: '_draft', type: 'connector', from: d.from, to: d.to, stroke: '#4262ff', strokeWidth: 2, routing: app.toolOpts.routing, arrowEnd: true };
  layerDraft.innerHTML = renderElement(tmp, { get: getEl });
}

function eraseAt(e) {
  const t = document.elementFromPoint(e.clientX, e.clientY);
  const hit = hitInfo(t);
  if (hit && hit.el.type === 'pen') deleteEl(hit.el.id);
}

const OPPOSITE = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' };

function quickConnect(d, w, target) {
  const src = d.src;
  if (!src) return;
  if (d.moved && target) {
    const c = makeElement('connector', 0, 0, { from: { id: src.id, side: d.side }, to: { id: target.id } });
    act(() => setEl(c));
    setSelection([c.id]);
    return;
  }
  // neues Element in Pfeilrichtung (Klick) oder am Ablagepunkt (Ziehen)
  const copy = { ...clone(src), id: uid(), z: nextZ(), text: '', title: src.type === 'card' ? 'Neue Karte' : src.title, description: '', groupId: undefined, author: app.user.name || '' };
  delete copy.src;
  if (src.type === 'image') {
    Object.assign(copy, { type: 'shape', shape: 'roundrect', fill: '#ffffff', stroke: '#1a1a1a', strokeWidth: 2, fontSize: 18 });
    copy.w = 200;
    copy.h = 120;
  }
  if (d.moved) {
    copy.x = w.x - copy.w / 2;
    copy.y = w.y - copy.h / 2;
  } else {
    const gap = 100;
    if (d.side === 'right') copy.x = src.x + src.w + gap, copy.y = src.y + (src.h - copy.h) / 2;
    if (d.side === 'left') copy.x = src.x - gap - copy.w, copy.y = src.y + (src.h - copy.h) / 2;
    if (d.side === 'bottom') copy.y = src.y + src.h + gap, copy.x = src.x + (src.w - copy.w) / 2;
    if (d.side === 'top') copy.y = src.y - gap - copy.h, copy.x = src.x + (src.w - copy.w) / 2;
  }
  const toSide = d.moved ? undefined : OPPOSITE[d.side];
  const c = makeElement('connector', 0, 0, { from: { id: src.id, side: d.side }, to: { id: copy.id, side: toSide } });
  act(() => {
    setEl(copy);
    setEl(c);
  });
  if (copy.type === 'card') setSelection([copy.id]);
  else startEdit(copy.id, { isNew: true });
}

/* Doppelklick: bearbeiten bzw. neue Notiz */
stage.addEventListener('dblclick', (e) => {
  if (app.viewOnly || e.target === editor) return;
  // Doppelklick auf einen Knickpunkt entfernt ihn
  const wh = e.target.closest && e.target.closest('[data-handle^="wp-"]');
  if (wh) {
    const c = selectedEls()[0];
    if (c && c.type === 'connector') {
      const wps = waypointsOf(c);
      wps.splice(Number(wh.dataset.handle.slice(3)), 1);
      act(() => setEl({ ...c, waypoints: wps }));
    }
    return;
  }
  const hit = hitInfo(e.target);
  if (hit && hit.el.locked) {
    setSelection([hit.el.id]);
    toast('Dieses Element ist gesperrt – zum Bearbeiten entsperren (Strg+L oder Schloss-Symbol)', 3500);
    return;
  }
  const w = toWorld(e.clientX, e.clientY);
  if (hit) {
    const el = hit.el;
    if (el.type === 'frame' && !hit.frameTitle) {
      // Doppelklick in einen leeren Frame-Bereich legt eine Notiz an
    } else if (el.type === 'table') {
      const c = clamp(Math.floor(((w.x - el.x) / el.w) * el.cols), 0, el.cols - 1);
      const r = clamp(Math.floor(((w.y - el.y) / el.h) * el.rows), 0, el.rows - 1);
      return startEdit(el.id, { cell: [r, c], selectAll: false });
    } else if (el.type === 'comment') {
      return;
    } else {
      return startEdit(el.id, { selectAll: false });
    }
  }
  if (app.tool !== 'select') return;
  const el = makeElement('sticky', snapV(w.x), snapV(w.y));
  act(() => setEl(el));
  startEdit(el.id, { isNew: true });
});

/* Mausrad: Zoom (Strg/Pinch) bzw. Verschieben */
stage.addEventListener('wheel', (e) => {
  e.preventDefault();
  if (app.editing) layoutEditor();
  if (e.ctrlKey || e.metaKey || (app.settings.wheelZoom && !e.shiftKey)) {
    const f = Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0022));
    zoomAt(e.clientX, e.clientY, app.view.z * f);
  } else {
    app.view.x -= e.deltaX * (e.deltaMode === 1 ? 20 : 1);
    app.view.y -= e.deltaY * (e.deltaMode === 1 ? 20 : 1);
    if (e.shiftKey && !e.deltaX) {
      // Umschalt + Mausrad = horizontal verschieben
      app.view.y += e.deltaY * (e.deltaMode === 1 ? 20 : 1);
      app.view.x -= e.deltaY * (e.deltaMode === 1 ? 20 : 1);
    }
    applyView();
  }
  if (app.editing) layoutEditor();
}, { passive: false });

app.on('view', () => app.editing && layoutEditor());

/* ================================================================== */
/* Kopieren, Einfügen, Duplizieren                                     */
/* ================================================================== */

export function collectForCopy(ids) {
  const set = new Set(ids);
  for (const id of ids) {
    const el = getEl(id);
    if (el && el.type === 'frame') frameChildren(el).forEach((c) => set.add(c.id));
  }
  for (const el of app.els.values()) {
    if (el.type === 'connector' && el.from.id && el.to.id && set.has(el.from.id) && set.has(el.to.id)) set.add(el.id);
  }
  return [...set].map(getEl).filter((e) => e && !e.hidden).map(clone);
}

export function duplicateEls(list, dx = 20, dy = 20, select = true) {
  list = list.filter((e) => !e.hidden);
  const idMap = new Map(list.map((e) => [e.id, uid()]));
  const groupMap = new Map();
  const sorted = [...list].sort((a, b) => (a.z || 0) - (b.z || 0));
  const out = sorted
    .map((o) => {
      const n = translated(clone(o), dx, dy);
      delete n.priv;
      delete n.privName;
      // nur lokal benötigt (Auswahl beim Alt-Ziehen) – nicht aufzählbar, wird also nie gespeichert oder gesendet
      Object.defineProperty(n, '_src', { value: o.id, enumerable: false, configurable: true });
      n.id = idMap.get(o.id);
      n.z = nextZ();
      if (n.groupId) {
        if (!groupMap.has(n.groupId)) groupMap.set(n.groupId, uid());
        n.groupId = groupMap.get(n.groupId);
      }
      if (n.type === 'connector') {
        if (n.from.id) n.from = idMap.has(n.from.id) ? { ...n.from, id: idMap.get(n.from.id) } : null;
        if (n.to.id) n.to = idMap.has(n.to.id) ? { ...n.to, id: idMap.get(n.to.id) } : null;
        if (!n.from || !n.to) return null;
      }
      return n;
    })
    .filter(Boolean);
  act(() => out.forEach((n) => setEl(n)));
  if (select) {
    out.forEach((c) => delete c._src);
    setSelection(out.map((n) => n.id));
  }
  return out;
}

export function pasteElements(list, at) {
  if (!list.length) return;
  const b = unionRect(list.map((e) => elBounds(e, (id) => list.find((x) => x.id === id))));
  let dx = 30, dy = 30;
  if (at && b) {
    dx = at.x - (b.x + b.w / 2);
    dy = at.y - (b.y + b.h / 2);
  }
  duplicateEls(list, dx, dy, true);
}

/* ================================================================== */
/* Ausrichten, Anordnen, Ebenen, Gruppen                               */
/* ================================================================== */

export function alignSel(kind) {
  const sel = selectedEls().filter((e) => e.type !== 'connector' && !e.locked);
  if (sel.length < 2) return;
  const b = unionRect(sel.map(bounds));
  act(() => {
    for (const el of sel) {
      const n = { ...el };
      if (kind === 'left') n.x = b.x;
      if (kind === 'right') n.x = b.x + b.w - el.w;
      if (kind === 'centerH') n.x = b.x + (b.w - el.w) / 2;
      if (kind === 'top') n.y = b.y;
      if (kind === 'bottom') n.y = b.y + b.h - el.h;
      if (kind === 'middle') n.y = b.y + (b.h - el.h) / 2;
      setEl(n);
    }
  });
}

export function distributeSel(axis) {
  const sel = selectedEls().filter((e) => e.type !== 'connector' && !e.locked);
  if (sel.length < 3) return;
  const k = axis === 'h' ? 'x' : 'y', s = axis === 'h' ? 'w' : 'h';
  sel.sort((a, b) => a[k] - b[k]);
  const total = sel.reduce((t, e) => t + e[s], 0);
  const span = sel[sel.length - 1][k] + sel[sel.length - 1][s] - sel[0][k];
  const gap = (span - total) / (sel.length - 1);
  let pos = sel[0][k];
  act(() => {
    for (const el of sel) {
      setEl({ ...el, [k]: pos });
      pos += el[s] + gap;
    }
  });
}

export function arrangeGrid(list = selectedEls().filter((e) => e.type !== 'connector' && !e.locked), gap = 20) {
  if (list.length < 2) return;
  const b = unionRect(list.map(bounds));
  const cols = Math.ceil(Math.sqrt(list.length));
  const cw = Math.max(...list.map((e) => e.w)), ch = Math.max(...list.map((e) => e.h));
  list.sort((a, c) => a.y - c.y || a.x - c.x);
  act(() => list.forEach((el, i) => setEl({ ...el, x: b.x + (i % cols) * (cw + gap), y: b.y + Math.floor(i / cols) * (ch + gap) })));
}

export function clusterByColor() {
  const stickies = selectedEls().filter((e) => e.type === 'sticky' && !e.locked);
  if (stickies.length < 2) return toast('Bitte mehrere Sticky Notes auswählen');
  const groups = new Map();
  for (const s of stickies) {
    if (!groups.has(s.fill)) groups.set(s.fill, []);
    groups.get(s.fill).push(s);
  }
  const b = unionRect(stickies.map(bounds));
  const sw = Math.max(...stickies.map((s) => s.w)), sh = Math.max(...stickies.map((s) => s.h));
  let x = b.x;
  const order = [...groups.keys()].sort((a, c) => STICKY_COLORS.indexOf(a) - STICKY_COLORS.indexOf(c));
  act(() => {
    for (const color of order) {
      const g = groups.get(color);
      const cols = Math.ceil(Math.sqrt(g.length));
      g.forEach((s, i) => setEl({ ...s, x: x + (i % cols) * (sw + 15), y: b.y + Math.floor(i / cols) * (sh + 15) }));
      x += cols * (sw + 15) + 80;
    }
  });
  toast(`${groups.size} Farb-Cluster gebildet`);
}

export function bringToFront() {
  const sel = selectedEls().sort((a, b) => a.z - b.z);
  act(() => sel.forEach((el) => setEl({ ...el, z: nextZ() })));
}

export function sendToBack() {
  const sel = selectedEls().sort((a, b) => b.z - a.z);
  let minZ = Math.min(0, ...[...app.els.values()].map((e) => e.z || 0));
  act(() => sel.forEach((el) => setEl({ ...el, z: --minZ })));
}

export function groupSel() {
  const sel = selectedEls();
  if (sel.length < 2) return;
  const gid = uid();
  act(() => sel.forEach((el) => setEl({ ...el, groupId: gid })));
  toast('Gruppiert');
}

export function ungroupSel() {
  act(() => selectedEls().forEach((el) => el.groupId && setEl({ ...el, groupId: undefined })));
  toast('Gruppierung aufgehoben');
}

export function toggleLock() {
  const sel = selectedEls();
  const lock = !sel.every((e) => e.locked);
  act(() => sel.forEach((el) => setEl({ ...el, locked: lock })));
  scheduleRender(true);
  app.emit('selection');
}

export function nudge(dx, dy) {
  const ids = new Set(app.sel);
  for (const el of selectedEls()) if (el.type === 'frame') frameChildren(el).forEach((c) => ids.add(c.id));
  // Knickpunkte von Verbindern zwischen mitbewegten Elementen wandern mit (wie beim Ziehen)
  for (const c of app.els.values()) {
    if (c.type === 'connector' && !ids.has(c.id) && waypointsOf(c).length && c.from.id && c.to.id && ids.has(c.from.id) && ids.has(c.to.id)) ids.add(c.id);
  }
  act(() => [...ids].map(getEl).filter((e) => e && !e.locked).forEach((el) => setEl(translated(el, dx, dy))));
}

/* ================================================================== */
/* Tastatur                                                            */
/* ================================================================== */

function isTyping(e) {
  const t = e.target;
  return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable) && t !== editor;
}

const TOOL_KEYS = { v: 'select', h: 'hand', n: 'sticky', t: 'text', s: 'shape', l: 'connector', p: 'pen', e: 'eraser', f: 'frame', c: 'comment', k: 'card', m: 'mindmap', x: 'laser' };

window.addEventListener('keydown', (e) => {
  if (isTyping(e) || app.editing) return;
  if (document.querySelector('.modal-back')) return;
  const mod = e.ctrlKey || e.metaKey;
  const key = e.key.toLowerCase();
  // Zuerst Module (z. B. Präsentation) reagieren lassen, damit dort auch die Leertaste ankommt
  app.emit('key', e);
  if (e.defaultPrevented) return;
  if (e.key === ' ' && !spaceDown) {
    spaceDown = true;
    stage.classList.add('space');
    e.preventDefault();
    return;
  }
  if (mod && key === 'z') {
    e.preventDefault();
    if (e.shiftKey) redo();
    else undo();
    return;
  }
  if (mod && key === 'y') {
    e.preventDefault();
    redo();
    return;
  }
  if (mod && key === 'a') {
    e.preventDefault();
    setSelection([...app.els.keys()]);
    return;
  }
  if (mod && key === 'd') {
    e.preventDefault();
    if (app.sel.size) duplicateEls(collectForCopy([...app.sel]));
    return;
  }
  if (mod && key === 'g') {
    e.preventDefault();
    if (e.shiftKey) ungroupSel();
    else groupSel();
    return;
  }
  if (mod && key === 'l') {
    e.preventDefault();
    toggleLock();
    return;
  }
  if (mod && (key === '+' || key === '=')) {
    e.preventDefault();
    zoomBy(1.25);
    return;
  }
  if (mod && key === '-') {
    e.preventDefault();
    zoomBy(0.8);
    return;
  }
  if (mod && key === '0') {
    e.preventDefault();
    const c = viewCenter();
    const r = stage.getBoundingClientRect();
    animateView({ z: 1, x: r.width / 2 - c.x, y: r.height / 2 - c.y });
    return;
  }
  if (mod && (e.key === ']' || e.key === 'PageUp')) {
    e.preventDefault();
    bringToFront();
    return;
  }
  if (mod && (e.key === '[' || e.key === 'PageDown')) {
    e.preventDefault();
    sendToBack();
    return;
  }
  if (e.shiftKey && (e.code === 'Digit1')) {
    e.preventDefault();
    fitAll();
    return;
  }
  if (e.shiftKey && (e.code === 'Digit2')) {
    e.preventDefault();
    if (app.sel.size) fitTo(selectionBounds(), { maxZ: 2 });
    return;
  }
  if (mod) return;
  if (app.viewOnly) {
    if (key === 'v' || key === 'h' || key === 'x') setTool(TOOL_KEYS[key]);
    return;
  }
  if (e.key === 'Delete' || e.key === 'Backspace') {
    if (app.sel.size) {
      e.preventDefault();
      deleteEls([...app.sel].filter((id) => !getEl(id)?.locked));
    }
    return;
  }
  if (e.key === 'Escape') {
    if (app.tool !== 'select') setTool('select');
    else setSelection([]);
    return;
  }
  if (e.key.startsWith('Arrow') && app.sel.size) {
    e.preventDefault();
    const s = e.shiftKey ? 10 : 1;
    nudge(e.key === 'ArrowLeft' ? -s : e.key === 'ArrowRight' ? s : 0, e.key === 'ArrowUp' ? -s : e.key === 'ArrowDown' ? s : 0);
    return;
  }
  const one = app.sel.size === 1 ? selectedEls()[0] : null;
  if (e.key === 'Tab' && one && one.mind) {
    e.preventDefault();
    mindAddChild(one);
    return;
  }
  if (e.key === 'Enter' && one) {
    e.preventDefault();
    if (one.mind && e.shiftKey) mindAddSibling(one);
    else startEdit(one.id, { selectAll: false });
    return;
  }
  if (key === 'r') {
    app.toolOpts.shape = 'rect';
    setTool('shape');
    return;
  }
  if (key === 'o') {
    app.toolOpts.shape = 'ellipse';
    setTool('shape');
    return;
  }
  if (TOOL_KEYS[key] && !e.altKey) setTool(TOOL_KEYS[key]);
});

// Leertaste losgelassen, während ein anderes Fenster aktiv war
window.addEventListener('blur', () => {
  spaceDown = false;
  stage.classList.remove('space');
});

window.addEventListener('keyup', (e) => {
  if (e.key === ' ') {
    spaceDown = false;
    stage.classList.remove('space');
  }
});

/* Zwischenablage über System-Events (funktioniert auch boardübergreifend) */
const CLIP_PREFIX = 'vibeboard-clipboard:';

document.addEventListener('copy', (e) => {
  if (isTyping(e) || app.editing || !app.sel.size) return;
  e.preventDefault();
  e.clipboardData.setData('text/plain', CLIP_PREFIX + JSON.stringify(collectForCopy([...app.sel])));
});

document.addEventListener('cut', (e) => {
  if (isTyping(e) || app.editing || !app.sel.size || app.viewOnly) return;
  e.preventDefault();
  e.clipboardData.setData('text/plain', CLIP_PREFIX + JSON.stringify(collectForCopy([...app.sel])));
  deleteEls([...app.sel]);
});

// Mittlere Maustaste = Verschieben. Unter Linux fügt sie sonst zusätzlich die markierte Auswahl ein
// („Primary Selection“), was eine ungewollte Sticky Note erzeugen würde.
let lastMiddleClick = 0;
for (const type of ['mousedown', 'mouseup', 'auxclick']) {
  stage.addEventListener(type, (e) => {
    if (e.button !== 1) return;
    lastMiddleClick = Date.now();
    e.preventDefault();
  });
}

document.addEventListener('paste', (e) => {
  if (Date.now() - lastMiddleClick < 1000) {
    e.preventDefault();
    return;
  }
  if (isTyping(e) || app.editing || app.viewOnly) return;
  const files = [...(e.clipboardData.files || [])].filter((f) => f.type.startsWith('image/'));
  if (files.length) {
    e.preventDefault();
    files.forEach((f, i) => insertImageFile(f, { x: lastCursorWorld.x + i * 30, y: lastCursorWorld.y + i * 30 }));
    return;
  }
  const text = e.clipboardData.getData('text/plain');
  if (!text) return;
  e.preventDefault();
  const at = rectContainsPoint(visibleRect(), lastCursorWorld) ? lastCursorWorld : viewCenter();
  if (text.startsWith(CLIP_PREFIX)) {
    try {
      pasteElements(JSON.parse(text.slice(CLIP_PREFIX.length)), at);
    } catch {
      toast('Einfügen fehlgeschlagen');
    }
    return;
  }
  pasteText(text, at);
});

function rectContainsPoint(r, p) {
  return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
}

export function pasteText(text, at) {
  if (/^https?:\/\/\S+$/.test(text.trim())) {
    const el = makeElement('text', at.x, at.y, { text: text.trim(), color: '#4262ff', fontSize: 18, w: 420 });
    addElements([autoHeight(el)]);
    return;
  }
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length <= 1) {
    const el = makeElement('sticky', at.x, at.y, { text: text.trim() });
    addElements([el]);
    return;
  }
  // Mehrere Zeilen -> eine Sticky Note pro Zeile
  const cols = Math.ceil(Math.sqrt(lines.length));
  const size = 200, gap = 20;
  const ox = at.x - (cols * (size + gap)) / 2, oy = at.y - (Math.ceil(lines.length / cols) * (size + gap)) / 2;
  const list = lines.slice(0, 400).map((l, i) => makeElement('sticky', 0, 0, { x: ox + (i % cols) * (size + gap), y: oy + Math.floor(i / cols) * (size + gap), text: l }));
  addElements(list);
  toast(`${list.length} Sticky Notes erstellt`);
}

/* ================================================================== */
/* Bilder                                                              */
/* ================================================================== */

export function insertImageFile(file, at) {
  if (!file || !file.type.startsWith('image/')) return;
  if (app.viewOnly) return;
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      let src = reader.result;
      let { width, height } = img;
      const MAX = 1800;
      if ((width > MAX || height > MAX || file.size > 1.5e6) && file.type !== 'image/gif' && file.type !== 'image/svg+xml') {
        const f = Math.min(1, MAX / Math.max(width, height));
        const c = document.createElement('canvas');
        c.width = Math.round(width * f);
        c.height = Math.round(height * f);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        src = file.type === 'image/png' ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', 0.85);
        if (src.length > 6e6) src = c.toDataURL('image/jpeg', 0.75);
      }
      const p = at || viewCenter();
      const dispW = Math.min(600, width), dispH = (dispW / width) * height;
      const el = { id: uid(), type: 'image', z: nextZ(), x: p.x - dispW / 2, y: p.y - dispH / 2, w: dispW, h: dispH, src, name: file.name, author: app.user.name || '' };
      addElements([el]);
    };
    img.onerror = () => toast('Bild konnte nicht gelesen werden');
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}

stage.addEventListener('dragover', (e) => {
  e.preventDefault();
  stage.classList.add('dropping');
});
stage.addEventListener('dragleave', () => stage.classList.remove('dropping'));
stage.addEventListener('drop', (e) => {
  e.preventDefault();
  stage.classList.remove('dropping');
  const w = toWorld(e.clientX, e.clientY);
  const files = [...(e.dataTransfer.files || [])];
  files.forEach((f, i) => {
    if (f.type.startsWith('image/')) insertImageFile(f, { x: w.x + i * 40, y: w.y + i * 40 });
    else if (f.name.endsWith('.json')) app.emit('importFile', f);
  });
  if (!files.length) {
    const t = e.dataTransfer.getData('text/plain');
    if (t) pasteText(t, w);
  }
});

/* ================================================================== */
/* Initialisierung                                                     */
/* ================================================================== */

export function initCore() {
  app.sync = new Sync(boardId, app.user, { viewOnly: app.viewOnly });
  const saved = loadPref('view.' + boardId, null);
  if (saved) app.view = saved;
  stage.dataset.tool = app.tool;
  document.body.classList.toggle('dark', !!app.settings.dark);
  stage.classList.toggle('nogrid', !app.settings.grid);
  $('#cursors').classList.toggle('off', !!app.settings.hideCursors);
  applyView(true);
  window.addEventListener('resize', () => applyView(true));
  window.addEventListener('pagehide', () => app.sync.flushNow());
  window.addEventListener('beforeunload', () => app.sync.flushNow());
  return !!saved;
}

export function saveSettings() {
  savePref('settings', app.settings);
  document.body.classList.toggle('dark', !!app.settings.dark);
  stage.classList.toggle('nogrid', !app.settings.grid);
  $('#cursors').classList.toggle('off', !!app.settings.hideCursors);
  rerenderAll();
}
