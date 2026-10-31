// Kern des Board-Editors: Zustand, Ansicht, Rendering, Historie, Interaktion
import { T } from './i18n.js';
import {
  SVGNS, uid, clamp, clone, wrap, rectsIntersect, rectContains, unionRect, loadPref, savePref,
  debounce, throttle, toast, contrastText, STICKY_COLORS, api,
} from './util.js';
import { renderElement, elBounds, isOrphan, connectorGeom, defsMarkup, sortForRender, LH, textLayout, shapeTextBox, penPath, sidePoint, codeMetrics, MONO,
  outlinePoint, sideAnchor, waypointsOf, projectOnPath, pointAlong, tableLayout, cellAt, cellStyle, fractions, SHAPE_DEFAULTS, labelBelow, labelOutside, setElementLookup } from './render.js';
import { THEMES } from './highlight.js';
import { Sync } from './sync.js';

const boardId = location.pathname.split('/').filter(Boolean).pop();

export const app = {
  boardId,
  viewOnly: false,   // wird nach dem Laden aus der Rolle gesetzt (auch während einer Bearbeitungssperre der Moderation)
  canComment: false, // Rolle „Kommentieren“ oder höher
  isFacilitator: false, // moderiert gerade (Besitzer immer)
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
  off(ev, fn) {
    this._l[ev] = (this._l[ev] || []).filter((f) => f !== fn);
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
setElementLookup(getEl);
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
  let gs = Math.max(5, Number(app.settings.gridSize) || 20);
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
    reviews: app.reviews,
    placeholders: true,
    me: app.user && app.user.id,
    boardId,
    seesConcealed: !!app.isFacilitator,
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
    // Diagramme zeigen die Werte ihrer Tabelle
    for (const el of app.els.values()) if (el.type === 'chart' && dirty.has(el.sourceId)) dirty.add(el.id);
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
  let cls = T('el el-') + el.type;
  if (isLocked(el)) cls += T(' locked');
  // Filter (Schlagwörter, Farbe, Person …): nicht passende Elemente werden abgeblendet
  if (app.filter && el.type !== 'frame' && el.type !== 'connector' && !app.filter(el)) cls += T(' dimmed');
  if (app.discussFocus && app.discussFocus === id) cls += T(' discuss-current');
  if (app.editing && app.editing.id === id && !app.editing.cell) cls += T(' editing');
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
    // Themengruppen liegen über Vorlagen-Flächen, aber unter den Beiträgen (siehe sortForRender)
    (el.type === 'frame' && el.kind !== 'topic' ? layerFrames : layerEls).appendChild(g);
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
  if (send) app.sync.upsert(el, prev);
}

export function updateEl(id, patch) {
  const el = app.els.get(id);
  if (!el) return;
  setEl(autoHeight({ ...el, ...patch }));
}

export function deleteEl(id) {
  if (app.viewOnly || !app.els.has(id) || app.els.get(id).hidden) return;
  record(id);
  const prev = app.els.get(id);
  app.els.delete(id);
  app.sel.delete(id);
  markDirty(id);
  app.sync.remove(id, prev);
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

// Rückgängig bei Tabellen: nur die selbst geänderten Zellen, Formate und Eigenschaften zurücksetzen,
// damit gleichzeitige Eingaben anderer erhalten bleiben (bei geänderter Zeilen-/Spaltenzahl die ganze Tabelle)
function tableUndoPatch(target, other, cur) {
  if (!other || !cur || cur.type !== 'table' || target.type !== 'table' || other.type !== 'table') return null;
  if (target.rows !== other.rows || target.cols !== other.cols || cur.rows !== target.rows || cur.cols !== target.cols) return null;
  const p = { cells: [], styles: [], props: {} };
  for (let r = 0; r < target.rows; r++) {
    for (let c = 0; c < target.cols; c++) {
      const tv = target.cells?.[r]?.[c] ?? '', ov = other.cells?.[r]?.[c] ?? '';
      if (tv !== ov) p.cells.push([r, c, tv]);
      const ts = target.styles?.[r]?.[c] || null, os = other.styles?.[r]?.[c] || null;
      if (JSON.stringify(ts) !== JSON.stringify(os)) p.styles.push([r, c, ts]);
    }
  }
  for (const k of TableOps.PROPS) if (JSON.stringify(target[k]) !== JSON.stringify(other[k])) p.props[k] = target[k] === undefined ? null : target[k];
  return p;
}

function applySnapshot(map, opposite = new Map()) {
  const removed = new Set();
  for (const [id, el] of map) {
    const tp = el && tableUndoPatch(el, opposite.get(id), app.els.get(id));
    if (tp) {
      tablePatch(app.els.get(id), tp);
      continue;
    }
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
  applySnapshot(e.before, e.after);
  redoStack.push(e);
  app.emit('history');
}

export function redo() {
  if (app.editing) finishEdit();
  if (drag || tx) return;
  const e = redoStack.pop();
  if (!e) return;
  applySnapshot(e.after, e.before);
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

// Neuer Kommentar: zunächst nur ein lokaler Platzhalter; angelegt wird er erst mit dem ersten Beitrag (Server)
export function newComment(w) {
  const el = { ...makeElement('comment', w.x, w.y), draft: true };
  applyRemoteOp({ op: 'upsert', el });
  setTool('select');
  app.emit('openComment', el.id, true);
}

/* ---------------- Tabellen: zellgenaue Änderungen (siehe table-ops.js) ---------------- */

const TableOps = globalThis.TableOps;

// Lokal anwenden (mit Rückgängig) und als Zellen-Patch senden
export function tablePatch(t, p) {
  const n = TableOps.applyPatch(t, p);
  setEl(n, false);
  if (!app.viewOnly) app.sync.op({ op: 'tpatch', id: t.id, ...p, opId: uid(), prev: t });
  return n;
}

export function tableStruct(t, st) {
  const n = TableOps.applyStruct(t, st);
  if (!n) return null;
  setEl(n, false);
  if (!app.viewOnly) app.sync.op({ op: 'tstruct', id: t.id, ...st, opId: uid(), prev: t });
  return n;
}

// Änderung einer anderen Person (bzw. Bestätigung der eigenen) anwenden
export function applyRemoteTableOp(op) {
  const t = getEl(op.id);
  if (!t || t.type !== 'table') return;
  if (op.op === 'tstruct') {
    const n = TableOps.applyStruct(t, op);
    if (!n) return;
    // bearbeitete Zelle und Zellauswahl wandern mit der Strukturänderung
    const ed = app.editing;
    if (ed && ed.id === op.id && ed.cell) {
      const m = TableOps.mapCell(op, ed.cell[0], ed.cell[1]);
      if (m) ed.cell = m;
      else abortEdit();
    }
    const cs = app.cellSel;
    if (cs && cs.id === op.id) {
      const a = TableOps.mapCell(op, cs.r0, cs.c0), b = TableOps.mapCell(op, cs.r1, cs.c1);
      app.cellSel = a && b ? { id: cs.id, r0: a[0], c0: a[1], r1: b[0], c1: b[1] } : null;
      app.emit('selection');
    }
    applyRemoteOp({ op: 'upsert', el: n });
  } else applyRemoteOp({ op: 'upsert', el: TableOps.applyPatch(t, op) });
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
async function saveThumb() {
  if (app.viewOnly || app.session.privateMode?.active) return;
  try {
    const { thumbnail } = await import('./exporter.js');
    const url = await thumbnail([...app.els.values()]);
    if (url) await api(`/api/boards/${boardId}/thumb`, { method: 'PUT', body: url, quiet: true });
    if (url && app.boardMeta) app.boardMeta.hasThumb = true;
  } catch {}
}
const scheduleSaveThumb = debounce(saveThumb, 4000);

// Boards mit Inhalt, aber ohne Vorschaubild (z. B. Importe): sofort nach dem Laden erzeugen – nicht erst nach
// der Wartezeit für Änderungen, sonst fehlt es, wenn man gleich wieder zur Übersicht geht
export function ensureThumb() {
  if (app.boardMeta && !app.boardMeta.hasThumb && app.els.size) setTimeout(saveThumb, 300);
}

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
    case 'shape': {
      const kind = o.shape || app.toolOpts.shape;
      const d = SHAPE_DEFAULTS[kind] || {};
      const w = d.w || 200, h = d.h || 140;
      // Beschriftung auf dem Board-Hintergrund: im dunklen Design hell, wie beim Textwerkzeug
      const label = app.settings.dark && labelOutside(kind) ? { textColor: '#f1f1f1' } : {};
      return { ...base, shape: kind, fill: '#ffffff', stroke: '#1a1a1a', strokeWidth: 2, text: '', fontSize: 18, ...d, ...label, x: x - w / 2, y: y - h / 2, w, h, ...o };
    }
    case 'text':
      return autoHeight({ ...base, x: x - 4, y: y - 18, w: 260, h: 38, text: '', fontSize: 24, color: app.settings.dark ? '#f1f1f1' : '#1a1a1a', align: 'left', ...o });
    case 'frame': {
      const n = [...app.els.values()].filter((e) => e.type === 'frame').length + 1;
      return { ...base, x: x - 640, y: y - 360, w: 1280, h: 720, title: T('Frame ') + n, fill: '#ffffff', order: n, ...o };
    }
    case 'card':
      return { ...base, x: x - 150, y: y - 70, w: 300, h: 140, title: T('Neue Karte'), description: '', color: '#4262ff', ...o };
    case 'code':
      return autoHeight({ ...base, x: x - 260, y: y - 80, w: 520, h: 160, text: '', lang: app.toolOpts.codeLang || 'js', theme: 'dark', fontSize: 14, ...o });
    case 'table': {
      const cells = [[T('Spalte 1'), T('Spalte 2'), T('Spalte 3')], ['', '', ''], ['', '', ''], ['', '', '']];
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
  if (o.type === 'pen') n.points = o.points.map(([px, py, ...p]) => [px * fx, py * fy, ...p]);
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
  // Themengruppen (Retro) sind keine Folien
  return [...app.els.values()].filter((e) => e.type === 'frame' && e.kind !== 'topic').sort((a, b) => (a.order ?? 1e9) - (b.order ?? 1e9) || a.y - b.y || a.x - b.x);
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
  if (app.cellSel && !(app.sel.size === 1 && app.sel.has(app.cellSel.id))) app.cellSel = null;
  scheduleRender(true);
  app.emit('selection');
  if (app.sync) sendSel();
}

// Anonyme Beiträge: Auswahl und „… schreibt“ verrieten sonst, wer welche Notiz bearbeitet. Während des anonymen Sammelns
// gilt das für alles Neue – das Kennzeichen des Servers kommt erst kurz nach dem Anlegen an
export function isAnonymous(el) {
  const pm = app.session && app.session.privateMode;
  return !!el && (!!el.anon || !!(pm && pm.active && pm.anonymous));
}
const sendSel = throttle(() => app.sync.signal('sel', [...app.sel].filter((id) => !isAnonymous(app.els.get(id))).slice(0, 200)), 200);

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
      const label = (ed ? '✎ ' : '') + p.name + (ed ? T(' schreibt …') : '');
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
    out += `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="none" stroke="${isLocked(el) ? '#868e96' : '#4262ff'}" stroke-width="${sw}"${isLocked(el) ? T` stroke-dasharray="${4 / z} ${3 / z}"` : ''}/>`;
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
          out += `<g data-handle="add-${i}" class="wp-add"><title>${T('Ziehen: Knickpunkt einfügen')}</title><circle cx="${m.x}" cy="${m.y}" r="${9 / z}" fill="#4262ff" fill-opacity="0.12"/><circle cx="${m.x}" cy="${m.y}" r="${4.5 / z}" fill="#fff" stroke="#4262ff" stroke-width="${1.5 / z}"/></g>`;
        }
        waypointsOf(c).forEach((p, i) => {
          out += `<rect data-handle="wp-${i}" class="wp" x="${p.x - 5 / z}" y="${p.y - 5 / z}" width="${10 / z}" height="${10 / z}" rx="${2 / z}" fill="#4262ff" stroke="#fff" stroke-width="${1.5 / z}"><title>${T('Knickpunkt – ziehen zum Verschieben, Doppelklick zum Entfernen')}</title></rect>`;
        });
        for (const [k, p] of [['from', g.p1], ['to', g.p2]]) {
          out += `<circle data-handle="${k}" cx="${p.x}" cy="${p.y}" r="${6 / z}" fill="#fff" stroke="#4262ff" stroke-width="${2 / z}"/>`;
        }
      }
    } else if (!sel.every((e) => isLocked(e)) && !(sel.length === 1 && sel[0].type === 'comment')) {
      const b = selectionBounds();
      if (sel.length > 1) out += `<rect x="${b.x - 4 / z}" y="${b.y - 4 / z}" width="${b.w + 8 / z}" height="${b.h + 8 / z}" fill="none" stroke="#4262ff" stroke-width="${sw}" stroke-dasharray="${5 / z} ${4 / z}"/>`;
      const pts = {
        nw: [b.x, b.y], n: [b.x + b.w / 2, b.y], ne: [b.x + b.w, b.y], e: [b.x + b.w, b.y + b.h / 2],
        se: [b.x + b.w, b.y + b.h], s: [b.x + b.w / 2, b.y + b.h], sw: [b.x, b.y + b.h], w: [b.x, b.y + b.h / 2],
      };
      // Seitengriffe ändern nur Breite bzw. Höhe. Bei flachen oder schmalen Elementen bleiben sie sichtbar,
      // dafür entfallen die sich überlagernden Eckgriffe auf dieser Achse.
      // Flach oder schmal: nur Seitengriffe (Ecken lägen darauf); winzig: nur Eckgriffe
      const flat = b.h * z < 30, narrow = b.w * z < 30, tiny = flat && narrow;
      // Text und Code-Blöcke: Höhe ergibt sich aus dem Inhalt (keine Griffe oben/unten); Ecken skalieren die Schrift
      const autoH = sel.every((x) => x.type === 'text' || x.type === 'code');
      const showHandle = (k) => {
        if (autoH) return k.length === 2 || k === 'e' || k === 'w' ? !(k.length === 1 && narrow) : false;
        return k.length === 2 ? tiny || !(flat || narrow) : !tiny;
      };
      // Größere Greiffläche – aber nie über die Mitte kleiner Elemente (dort soll Ziehen verschieben)
      const hit = Math.max(hs, Math.min(18 / z, Math.min(b.w, b.h) * 0.45));
      for (const [k, [px, py]] of Object.entries(pts)) {
        if (!showHandle(k)) continue;
        out += `<rect data-handle="${k}" class="h-${k} h-hit" x="${px - hit / 2}" y="${py - hit / 2}" width="${hit}" height="${hit}" fill="transparent"/>`;
        out += `<rect data-handle="${k}" class="h-${k}" x="${px - hs / 2}" y="${py - hs / 2}" width="${hs}" height="${hs}" rx="${2 / z}" fill="#fff" stroke="#4262ff" stroke-width="${sw}"/>`;
      }
      if (sel.length === 1 && sel[0].type === 'table') {
        const t = sel[0];
        const { xs, ys, rows, cols } = tableLayout(t);
        const cs = app.cellSel && app.cellSel.id === t.id ? app.cellSel : null;
        if (cs) {
          const r0 = Math.min(cs.r0, cs.r1), r1 = Math.max(cs.r0, cs.r1), c0 = Math.min(cs.c0, cs.c1), c1 = Math.max(cs.c0, cs.c1);
          if (r1 < rows && c1 < cols) out += `<rect x="${xs[c0]}" y="${ys[r0]}" width="${xs[c1 + 1] - xs[c0]}" height="${ys[r1 + 1] - ys[r0]}" fill="#4262ff" fill-opacity="0.1" stroke="#4262ff" stroke-width="${2 / z}"/>`;
        }
        // Spaltenbreiten und Zeilenhöhen an den Linien ziehen
        const hw = 8 / z;
        for (let c = 1; c < cols; c++) out += `<rect data-handle="col-${c - 1}" class="tab-col" x="${xs[c] - hw / 2}" y="${t.y}" width="${hw}" height="${t.h}" fill="transparent"><title>${T('Ziehen: Spaltenbreite ändern')}</title></rect>`;
        for (let r = 1; r < rows; r++) out += `<rect data-handle="row-${r - 1}" class="tab-row" x="${t.x}" y="${ys[r] - hw / 2}" width="${t.w}" height="${hw}" fill="transparent"><title>${T('Ziehen: Zeilenhöhe ändern')}</title></rect>`;
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
  const tag = (x, y, text, color = '#f03e3e') => {
    const fs = 11 / z, w = (text.length * 6.5 + 10) / z, hh = 17 / z;
    return `<rect x="${x - w / 2}" y="${y - hh / 2}" width="${w}" height="${hh}" rx="${3 / z}" fill="${color}"/><text x="${x}" y="${y + fs * 0.35}" font-size="${fs}" font-family="Helvetica, Arial, sans-serif" text-anchor="middle" fill="#fff">${escXml(text)}</text>`;
  };
  for (const g of guides) {
    if (g.axis === 'x') out += `<line x1="${g.v}" y1="${g.a}" x2="${g.v}" y2="${g.b}" stroke="#f03e3e" stroke-width="${1 / z}"/>`;
    else if (g.axis === 'y') out += `<line x1="${g.a}" y1="${g.v}" x2="${g.b}" y2="${g.v}" stroke="#f03e3e" stroke-width="${1 / z}"/>`;
    else if (g.axis === 'gapx' || g.axis === 'gapy') {
      // Abstandsmarkierung (gleiche Abstände)
      const [x1, y1, x2, y2] = g.axis === 'gapx' ? [g.a, g.v, g.b, g.v] : [g.v, g.a, g.v, g.b];
      const t = 4 / z;
      out += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#e64980" stroke-width="${1.5 / z}"/>`;
      out += g.axis === 'gapx'
        ? `<line x1="${x1}" y1="${y1 - t}" x2="${x1}" y2="${y1 + t}" stroke="#e64980" stroke-width="${1.5 / z}"/><line x1="${x2}" y1="${y2 - t}" x2="${x2}" y2="${y2 + t}" stroke="#e64980" stroke-width="${1.5 / z}"/>`
        : `<line x1="${x1 - t}" y1="${y1}" x2="${x1 + t}" y2="${y1}" stroke="#e64980" stroke-width="${1.5 / z}"/><line x1="${x2 - t}" y1="${y2}" x2="${x2 + t}" y2="${y2}" stroke="#e64980" stroke-width="${1.5 / z}"/>`;
      if (g.label) out += tag((x1 + x2) / 2, (y1 + y2) / 2, g.label, '#e64980');
    } else if (g.axis === 'label') out += tag(g.x, g.y, g.text, g.color || '#4262ff');
  }
  layerOverlay.innerHTML = out;
  app.emit('overlay');
}

/* ================================================================== */
/* Textbearbeitung                                                     */
/* ================================================================== */

export function canEdit(el) {
  return el && !isLocked(el) && !el.hidden && ['sticky', 'shape', 'text', 'frame', 'connector', 'table', 'code'].includes(el.type);
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
    app.cellSel = { id, r0: cell[0], c0: cell[1], r1: cell[0], c1: cell[1] };
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
      valign = labelBelow(el.shape) ? 'top' : el.valign || 'middle';
      color = el.textColor || (labelOutside(el.shape) ? '#1a1a1a' : contrastText(el.fill === 'transparent' ? '#ffffff' : el.fill));
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
      const { xs, ys } = tableLayout(el);
      const st = cellStyle(el, r, c);
      box = { x: xs[c] + 8, y: ys[r] + 6, w: Math.max(40, xs[c + 1] - xs[c] - 16), h: Math.max(st.size, ys[r + 1] - ys[r] - 12) };
      lay = { size: st.size, lines: wrap(editor.value, box.w, st.size, st.bold, st.italic), bold: st.bold, italic: st.italic, underline: st.underline, strike: st.strike };
      align = st.align;
      valign = st.valign;
      color = st.color;
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
    fontStyle: (lay.italic ?? el.italic) ? 'italic' : 'normal',
    textDecoration: [(lay.underline ?? el.underline) && 'underline', (lay.strike ?? el.strike) && 'line-through'].filter(Boolean).join(' ') || 'none',
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
    tablePatch(el, { cells: [[ed.cell[0], ed.cell[1], editor.value]] });
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
  if (app.viewOnly && !['select', 'hand', 'laser'].includes(t) && !(t === 'comment' && app.canComment)) return;
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

export const gridSize = () => Math.max(5, Number(app.settings.gridSize) || 20);

function snapV(v) {
  return app.settings.snap ? Math.round(v / gridSize()) * gridSize() : v;
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
  // Abstimmung über Themengruppen (Retro): ein Klick irgendwo in die Gruppe zählt für das Thema
  if (v && v.active && app.voteMode && app.tool === 'select' && v.target === 'topics') {
    const topic = [...app.els.values()].filter((f) => f.type === 'frame' && f.kind === 'topic' && w.x >= f.x && w.x <= f.x + f.w && w.y >= f.y && w.y <= f.y + f.h)
      .sort((a, b) => a.w * a.h - b.w * b.h)[0];
    if (topic) {
      app.emit('vote', topic.id, e.altKey || e.shiftKey ? -1 : 1);
      return;
    }
  } else if (v && v.active && app.voteMode && app.tool === 'select' && hit && !['frame', 'connector', 'comment', 'pen'].includes(hit.el.type)) {
    app.emit('vote', hit.el.id, e.altKey || e.shiftKey ? -1 : 1);
    return;
  }

  if (app.tool === 'laser') {
    drag = { mode: 'laser', start };
    return;
  }

  // Kommentieren dürfen auch Personen mit der Rolle „Kommentieren“ (und Gäste mit dieser Rolle)
  if (app.tool === 'comment' && app.canComment) {
    if (hit && hit.el.type === 'comment') app.emit('openComment', hit.el.id);
    else newComment(w);
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
        } else if (k.startsWith('col-') || k.startsWith('row-')) {
          drag = { mode: 'tabsize', start, id: [...app.sel][0], axis: k.slice(0, 3), index: Number(k.slice(4)), tx: true };
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
          const sel = selectedEls().filter((x) => !isLocked(x));
          drag = { mode: 'resize', start, handle: k, ob: selectionBounds(), origs: sel.map(clone), tx: true, cand: snapCandidates(new Set(sel.map((x) => x.id))) };
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
        const preSelected = new Set(app.sel);
        if (el.type === 'frame' && !hit.frameTitle && !(app.sel.has(el.id) && app.sel.size === 1)) {
          startMarquee(e, start, el.id);
          return;
        }
        if (isLocked(el)) {
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
        // Verbinder in einer Gruppe: Ziehen verschiebt die Gruppe (zum Biegen erst in die Gruppe klicken)
        const groupWhole = el.groupId && !(app.sel.size === 1 && app.sel.has(el.id));
        if (el.type === 'connector' && !inMulti && !groupWhole && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
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
        let toggleOff = null;
        if (e.shiftKey || e.ctrlKey || e.metaKey) {
          const ids = withGroups([el.id]);
          // Bereits ausgewählt: erst beim Loslassen ohne Ziehen abwählen – Umschalt-/Strg-Ziehen verschiebt
          if (app.sel.has(el.id)) toggleOff = el.type === 'table' && app.sel.size === 1 ? null : ids;
          else {
            app.sel = new Set([...app.sel, ...ids]);
            selectionChanged();
          }
        } else if (!app.sel.has(el.id)) {
          setSelection([el.id]);
        }
        const grp = withGroups([el.id]);
        const groupSelected = el.groupId && grp.size > 1 && app.sel.size === grp.size && [...grp].every((id) => app.sel.has(id));
        startMove(e, start);
        if (toggleOff) drag.toggleOff = [...toggleOff];
        // Klick in eine bereits ausgewählte Tabelle wählt eine Zelle (Umschalt: Bereich)
        if (el.type === 'table' && preSelected.size === 1 && preSelected.has(el.id) && !isLocked(el)) drag.cellClick = { id: el.id, cell: cellAt(el, w.x, w.y), extend: e.shiftKey };
        if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
          // Klick ohne Ziehen auf ein Element einer Mehrfachauswahl wählt nur dieses aus
          if (app.sel.size > grp.size) drag.clickSelect = el.id;
          // Erneuter Klick in eine bereits ausgewählte Gruppe wählt nur das angeklickte Element (Bearbeiten in der Gruppe)
          else if (groupSelected && preSelected.has(el.id)) drag.clickSelectSingle = el.id;
        }
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
      drag = { mode: 'draw', start, points: [[w.x, w.y, ...stylusPressure(e)]] };
      drawDraft();
      return;
    case 'eraser':
      begin();
      drag = { mode: 'erase', start, tx: true };
      eraseAt(e);
      return;
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

// Dokumentseiten sind gegen Verrutschen gesperrt, gehören aber fest zu ihrem Frame
function pageOfMovedFrame(el) {
  if (!el.fileRef || el.modLock) return false;
  return selectedEls().some((f) => f.type === 'frame' && frameChildren(f).some((c) => c.id === el.id));
}

function startMove(e, start) {
  begin();
  let ids = new Set(app.sel);
  // Frames nehmen ihren Inhalt mit – Gruppen darin bleiben vollständig zusammen
  for (const id of app.sel) {
    const el = getEl(id);
    if (el && el.type === 'frame') withGroups(frameChildren(el).map((c) => c.id)).forEach((c) => ids.add(c));
  }
  ids = [...ids].filter((id) => getEl(id) && (!isLocked(getEl(id)) || pageOfMovedFrame(getEl(id))));
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
  const cand = app.settings.smartGuides ? snapCandidates(moving) : { x: [], y: [], w: [], h: [], boxes: [] };
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
      // Umschalt: nur waagerecht oder senkrecht verschieben
      if (e.shiftKey) {
        if (Math.abs(dx) > Math.abs(dy)) dy = 0;
        else dx = 0;
      }
      guides = [];
      if (drag.ob) {
        if (app.settings.snap) {
          if (!e.shiftKey || dx) dx = snapV(drag.ob.x + dx) - drag.ob.x;
          if (!e.shiftKey || dy) dy = snapV(drag.ob.y + dy) - drag.ob.y;
        } else if (app.settings.smartGuides && !e.ctrlKey && !e.metaKey) {
          const thr = 6 / app.view.z;
          const nb = { x: drag.ob.x + dx, y: drag.ob.y + dy, w: drag.ob.w, h: drag.ob.h };
          const sx = !(e.shiftKey && !dx) && bestSnap([nb.x, nb.x + nb.w / 2, nb.x + nb.w], drag.cand.x, thr);
          const sy = !(e.shiftKey && !dy) && bestSnap([nb.y, nb.y + nb.h / 2, nb.y + nb.h], drag.cand.y, thr);
          // Gleiche Abstände haben Vorrang, wenn sie mindestens so nah liegen wie eine Kante
          const gx = !(e.shiftKey && !dx) && spacingSnap(nb, drag.cand.boxes, 'x', thr);
          const gy = !(e.shiftKey && !dy) && spacingSnap(nb, drag.cand.boxes, 'y', thr);
          const useGx = gx && (!sx || Math.abs(gx.d) <= Math.abs(sx.d));
          const useGy = gy && (!sy || Math.abs(gy.d) <= Math.abs(sy.d));
          if (useGx) dx += gx.d;
          else if (sx) dx += sx.d;
          if (useGy) dy += gy.d;
          else if (sy) dy += sy.d;
          // Hilfslinien an der endgültigen Position
          const fx = drag.ob.x + dx, fy = drag.ob.y + dy;
          if (useGx) guides.push(...gx.guides.map((g) => ({ ...g, v: fy + nb.h / 2 })));
          else if (sx) guides.push({ axis: 'x', v: sx.v, a: fy - 2000, b: fy + nb.h + 2000 });
          if (useGy) guides.push(...gy.guides.map((g) => ({ ...g, v: fx + nb.w / 2 })));
          else if (sy) guides.push({ axis: 'y', v: sy.v, a: fx - 2000, b: fx + nb.w + 2000 });
        }
        const p = { x: drag.ob.x + dx, y: drag.ob.y + dy };
        guides.push({ axis: 'label', x: p.x + drag.ob.w / 2, y: p.y + drag.ob.h + 18 / app.view.z, text: `X ${Math.round(p.x)}  Y ${Math.round(p.y)}`, color: '#495057' });
      }
      for (const o of drag.origs) applyGeom(o, translated(o, dx, dy));
      app.emit('dragging', true);
      return;
    }
    case 'resize': {
      const ob = drag.ob;
      if (!ob) return;
      const dx = w.x - s.w.x, dy = w.y - s.w.y;
      const k = drag.handle;
      const z = app.view.z, thr = 6 / z;
      const fromCenter = e.altKey;
      let x = ob.x, y = ob.y, x2 = ob.x + ob.w, y2 = ob.y + ob.h;
      if (k.includes('e')) x2 += dx;
      if (k.includes('w')) x += dx;
      if (k.includes('s')) y2 += dy;
      if (k.includes('n')) y += dy;
      guides = [];
      const smart = app.settings.smartGuides && !app.settings.snap && !e.ctrlKey && !e.metaKey;
      const eqTags = [];
      // Je Achse: Kante an Raster bzw. Kanten/Mitten/Tabellenlinien anderer Elemente einrasten – oder an die gleiche
      // Breite/Höhe eines anderen Elements; der nähere Treffer gewinnt
      const snapAxis = (axis) => {
        const [lo, hi] = axis === 'x' ? ['w', 'e'] : ['n', 's'];
        const moveLo = k.includes(lo), moveHi = k.includes(hi);
        if (!moveLo && !moveHi) return;
        let a0 = axis === 'x' ? x : y, a1 = axis === 'x' ? x2 : y2;
        const orig0 = axis === 'x' ? ob.x : ob.y, origLen = axis === 'x' ? ob.w : ob.h;
        if (fromCenter) {
          const d = axis === 'x' ? dx : dy;
          let len = Math.max(10, origLen + (moveHi ? d : -d) * 2);
          if (app.settings.snap) len = Math.max(gridSize(), Math.round(len / gridSize()) * gridSize());
          a0 = orig0 + (origLen - len) / 2;
          a1 = a0 + len;
        }
        if (app.settings.snap && !fromCenter) {
          if (moveLo) a0 = snapV(a0);
          if (moveHi) a1 = snapV(a1);
        } else if (smart) {
          const edge = !fromCenter && bestSnap([moveHi ? a1 : a0], axis === 'x' ? drag.cand.x : drag.cand.y, thr);
          const size = drag.origs.length === 1 ? nearestSize(a1 - a0, axis === 'x' ? drag.cand.w : drag.cand.h, thr) : null;
          const ds = size === null ? Infinity : Math.abs(size - (a1 - a0));
          if (edge && Math.abs(edge.d) <= ds) {
            if (moveHi) a1 = edge.v;
            else a0 = edge.v;
            guides.push(axis === 'x' ? { axis: 'x', v: edge.v, a: y - 2000, b: y2 + 2000 } : { axis: 'y', v: edge.v, a: x - 2000, b: x2 + 2000 });
          } else if (size !== null) {
            if (fromCenter) {
              a0 = orig0 + (origLen - size) / 2;
              a1 = a0 + size;
            } else if (moveHi) a1 = a0 + size;
            else a0 = a1 - size;
            eqTags.push(axis === 'x' ? T('= Breite') : T('= Höhe'));
          }
        }
        if (axis === 'x') {
          x = a0;
          x2 = a1;
        } else {
          y = a0;
          y2 = a1;
        }
      };
      snapAxis('x');
      snapAxis('y');
      let bw = x2 - x, bh = y2 - y;
      // Seitenverhältnis: Umschalt (bei Bildern und Mehrfachauswahl umgekehrt: Umschalt löst es)
      const ratioDefault = drag.origs.some((o) => ['image', 'emoji'].includes(o.type)) || drag.origs.length > 1;
      const keep = ratioDefault ? k.length === 2 && !e.shiftKey : e.shiftKey;
      if (keep && ob.w && ob.h) {
        // Mindestgröße einhalten, ohne das Seitenverhältnis zu verlieren
        const f = Math.max(10 / Math.min(ob.w, ob.h), k.length === 2 ? Math.max(bw / ob.w, bh / ob.h) : k === 'e' || k === 'w' ? bw / ob.w : bh / ob.h);
        eqTags.length = 0;
        guides = guides.filter((g) => g.axis === 'label');
        const nw = ob.w * f, nh = ob.h * f;
        if (k.length === 1) {
          // Seitengriff mit Umschalt: andere Achse mittig mitskalieren
          if (k === 'e' || k === 'w') y = ob.y + (ob.h - nh) / 2;
          else x = ob.x + (ob.w - nw) / 2;
        } else {
          if (k.includes('w')) x = fromCenter ? ob.x + (ob.w - nw) / 2 : ob.x + ob.w - nw;
          if (k.includes('n')) y = fromCenter ? ob.y + (ob.h - nh) / 2 : ob.y + ob.h - nh;
          if (fromCenter) {
            x = ob.x + (ob.w - nw) / 2;
            y = ob.y + (ob.h - nh) / 2;
          }
        }
        bw = nw;
        bh = nh;
      }
      if (bw < 10) {
        if (k.includes('w')) x -= 10 - bw;
        bw = 10;
      }
      if (bh < 10) {
        if (k.includes('n')) y -= 10 - bh;
        bh = 10;
      }
      const nb = { x, y, w: bw, h: bh };
      const single = drag.origs.length === 1 && k.length === 2;
      for (const o of drag.origs) applyGeom(o, scaleEl(o, ob, nb, single));
      // Größenanzeige
      const cur = drag.origs.length === 1 ? bounds(getEl(drag.origs[0].id) || nb) : nb;
      guides.push({ axis: 'label', x: cur.x + cur.w / 2, y: cur.y + cur.h + 18 / z, text: `${Math.round(cur.w)} × ${Math.round(cur.h)}${eqTags.length ? '  ' + eqTags.join(' ') : ''}`, color: eqTags.length ? '#e64980' : '#4262ff' });
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
    case 'tabsize': {
      // Grenze zwischen zwei Spalten/Zeilen verschieben; die übrigen bleiben gleich
      const t = getEl(drag.id);
      if (!t) return;
      const { xs, ys } = tableLayout(t);
      const lines = drag.axis === 'col' ? xs : ys, i = drag.index;
      // Mindestbreite – bei sehr kleinen Tabellen höchstens die Hälfte des verfügbaren Platzes
      const min = Math.min(16, (lines[i + 2] - lines[i]) * 0.45);
      let v = drag.axis === 'col' ? w.x : w.y;
      if (app.settings.snap) v = snapV(v);
      v = clamp(v, lines[i] + min, lines[i + 2] - min);
      const sizes = lines.slice(1).map((l, k) => l - lines[k]);
      sizes[i] = v - lines[i];
      sizes[i + 1] = lines[i + 2] - v;
      const total = drag.axis === 'col' ? t.w : t.h;
      tablePatch(t, { props: { [drag.axis === 'col' ? 'colW' : 'rowH']: sizes.map((sz) => sz / total) } });
      guides = [{ axis: 'label', x: drag.axis === 'col' ? v : t.x + t.w / 2, y: drag.axis === 'col' ? t.y - 14 / app.view.z : v, text: `${Math.round(sizes[i])} | ${Math.round(sizes[i + 1])}`, color: '#4262ff' }];
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
      drag.points.push([w.x, w.y, ...stylusPressure(e)]);
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
  // Tabellen: nur Lage und Größe senden, damit gleichzeitige Zelleingaben anderer erhalten bleiben
  if (cur.type === 'table' && !cur.hidden) {
    const props = {};
    for (const k of ['x', 'y', 'w', 'h']) if (k in moved && moved[k] !== cur[k]) props[k] = moved[k];
    if (Object.keys(props).length) tablePatch(cur, { props });
    return;
  }
  const n = { ...cur };
  for (const k of GEOM_KEYS) if (k in moved) n[k] = moved[k];
  setEl(n);
}

/* ---------------- Einrasten: Kandidaten, gleiche Abstände, gleiche Größen ---------------- */

// Kanten, Mitten und Tabellenlinien sichtbarer Elemente sowie deren Größen
function snapCandidates(exclude) {
  const vr = visibleRect();
  const area = { x: vr.x - vr.w, y: vr.y - vr.h, w: vr.w * 3, h: vr.h * 3 };
  const cand = { x: [], y: [], w: [], h: [], boxes: [] };
  for (const el of app.els.values()) {
    if (exclude.has(el.id) || el.hidden || el.type === 'connector' || el.type === 'pen' || el.type === 'comment') continue;
    const b = bounds(el);
    if (!rectsIntersect(b, area)) continue;
    cand.x.push(b.x, b.x + b.w / 2, b.x + b.w);
    cand.y.push(b.y, b.y + b.h / 2, b.y + b.h);
    // Zeilen- und Spaltenlinien von Tabellen (z. B. Wochen im Gantt-Diagramm)
    if (el.type === 'table') {
      const { xs, ys } = tableLayout(el);
      cand.x.push(...xs.slice(1, -1));
      cand.y.push(...ys.slice(1, -1));
    }
    if (el.type !== 'frame') {
      cand.w.push(b.w);
      cand.h.push(b.h);
      cand.boxes.push(b);
    }
    if (cand.boxes.length > 1500) break;
  }
  return cand;
}

// Gleiche Abstände: Position entlang einer Achse, an der der Abstand zum Nachbarn einem vorhandenen Abstand
// in derselben Reihe entspricht oder das Element mittig zwischen zwei Nachbarn liegt
function spacingSnap(nb, boxes, axis, thr) {
  const [p, s, q, t] = axis === 'x' ? ['x', 'w', 'y', 'h'] : ['y', 'h', 'x', 'w'];
  const row = boxes.filter((b) => b[q] < nb[q] + nb[t] && b[q] + b[t] > nb[q]).sort((a, b) => a[p] - b[p]);
  if (!row.length) return null;
  const mid = nb[p] + nb[s] / 2;
  const before = row.filter((b) => b[p] + b[s] <= mid).sort((a, b) => b[p] + b[s] - (a[p] + a[s]))[0];
  const after = row.filter((b) => b[p] >= mid).sort((a, b) => a[p] - b[p])[0];
  const gaps = [];
  for (let i = 1; i < row.length; i++) {
    const g = row[i][p] - (row[i - 1][p] + row[i - 1][s]);
    if (g > 0.5) gaps.push({ g, a: row[i - 1], b: row[i] });
  }
  const opts = [];
  if (before && after) {
    const v = (before[p] + before[s] + after[p] - nb[s]) / 2;
    if (v > before[p] + before[s]) opts.push({ v, g: v - (before[p] + before[s]), marks: [[before[p] + before[s], v], [v + nb[s], after[p]]] });
  }
  for (const { g, a, b } of gaps) {
    if (before) opts.push({ v: before[p] + before[s] + g, g, marks: [[before[p] + before[s], before[p] + before[s] + g], [a[p] + a[s], b[p]]] });
    if (after) opts.push({ v: after[p] - g - nb[s], g, marks: [[after[p] - g, after[p]], [a[p] + a[s], b[p]]] });
  }
  let best = null;
  for (const o of opts) {
    const d = o.v - nb[p];
    if (Math.abs(d) <= thr && (!best || Math.abs(d) < Math.abs(best.d))) best = { ...o, d };
  }
  if (!best) return null;
  const level = nb[q] + nb[t] / 2;
  best.guides = best.marks.map(([a, b]) => ({ axis: axis === 'x' ? 'gapx' : 'gapy', v: level, a, b, label: String(Math.round(best.g)) }));
  return best;
}

function nearestSize(v, list, thr) {
  let best = null;
  for (const c of list) if (Math.abs(c - v) <= thr && (best === null || Math.abs(c - v) < Math.abs(best - v))) best = c;
  return best;
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
      if (d.cellClick && !d.moved) {
        const [r, c] = d.cellClick.cell;
        const cs = app.cellSel;
        app.cellSel = d.cellClick.extend && cs && cs.id === d.cellClick.id ? { ...cs, r1: r, c1: c } : { id: d.cellClick.id, r0: r, c0: c, r1: r, c1: c };
        scheduleRender(true);
        app.emit('selection');
      }
      if (d.toggleOff && !d.moved) {
        const s2 = new Set(app.sel);
        d.toggleOff.forEach((i) => s2.delete(i));
        app.sel = s2;
        selectionChanged();
      }
      if (d.clickSelectSingle && !d.moved) {
        // ohne Gruppenerweiterung: nur dieses Element
        app.sel = new Set([d.clickSelectSingle]);
        selectionChanged();
        toast(T('Einzelnes Element der Gruppe ausgewählt – Klick daneben wählt wieder die ganze Gruppe'), 2500);
      }
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
        toast(T('Mehrere Linien liegen hier übereinander – jeder weitere Klick wählt die nächste'), 2500);
      }
      break;
    case 'conn-end':
    case 'wp':
    case 'label':
    case 'tabsize':
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
        points: pts.map(([px, py, ...p]) => [Math.round((px - minX) * 10) / 10, Math.round((py - minY) * 10) / 10, ...p]),
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

// Nur Stifte liefern echten Druck; die Maus meldet immer denselben Wert
const stylusPressure = (e) => (e.pointerType === 'pen' && e.pressure > 0 ? [Math.round(e.pressure * 100) / 100] : []);

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
  const copy = { ...clone(src), id: uid(), z: nextZ(), text: '', title: src.type === 'card' ? T('Neue Karte') : src.title, description: '', groupId: undefined, author: app.user.name || '' };
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
  // Dateianhänge öffnen auch Betrachter (Vorschau bzw. Download)
  const fh = hitInfo(e.target);
  if (fh && fh.el.type === 'file') return app.emit('openFile', fh.el.id);
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
  if (hit && isLocked(hit.el)) {
    setSelection([hit.el.id]);
    toast(hit.el.locked ? T('Dieses Element ist gesperrt – zum Bearbeiten entsperren (Strg+L oder Schloss-Symbol)') : T('Dieses Element hat die Moderation für Teilnehmende gesperrt'), 3500);
    return;
  }
  const w = toWorld(e.clientX, e.clientY);
  if (hit) {
    const el = hit.el;
    if (el.type === 'frame' && !hit.frameTitle) {
      // Doppelklick in einen leeren Frame-Bereich legt eine Notiz an
    } else if (el.type === 'table') {
      const [r, c] = cellAt(el, w.x, w.y);
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
    if (el && el.type === 'frame') withGroups(frameChildren(el).map((c) => c.id)).forEach((c) => set.add(c));
  }
  for (const el of app.els.values()) {
    if (el.type === 'connector' && el.from.id && el.to.id && set.has(el.from.id) && set.has(el.to.id)) set.add(el.id);
  }
  return [...set].map(getEl).filter((e) => e && !e.hidden).map(clone);
}

export function duplicateEls(list, dx = 20, dy = 20, select = true) {
  // Kommentare gehören zu ihrem Ort und ihren Personen – sie werden nicht kopiert (wie beim Export)
  const comments = list.filter((e) => e.type === 'comment').length;
  list = list.filter((e) => !e.hidden && e.type !== 'comment');
  if (comments) toast(T`Nicht mitkopierte Kommentare: ${comments}`, 3500);
  if (!list.length) return [];
  const idMap = new Map(list.map((e) => [e.id, uid()]));
  const groupMap = new Map();
  const sorted = [...list].sort((a, b) => (a.z || 0) - (b.z || 0));
  const out = sorted
    .map((o) => {
      const n = translated(clone(o), dx, dy);
      delete n.priv;
      delete n.privName;
      delete n.ext; // Die Kopie ist nicht mit demselben Ticket verbunden
      if (n.type === 'chart' && idMap.has(n.sourceId)) n.sourceId = idMap.get(n.sourceId);
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
  const sel = selectedEls().filter((e) => e.type !== 'connector' && !isLocked(e));
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
  const sel = selectedEls().filter((e) => e.type !== 'connector' && !isLocked(e));
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

export function arrangeGrid(list = selectedEls().filter((e) => e.type !== 'connector' && !isLocked(e)), gap = 20) {
  if (list.length < 2) return;
  const b = unionRect(list.map(bounds));
  const cols = Math.ceil(Math.sqrt(list.length));
  const cw = Math.max(...list.map((e) => e.w)), ch = Math.max(...list.map((e) => e.h));
  list.sort((a, c) => a.y - c.y || a.x - c.x);
  act(() => list.forEach((el, i) => setEl({ ...el, x: b.x + (i % cols) * (cw + gap), y: b.y + Math.floor(i / cols) * (ch + gap) })));
}

/* ---------------- Tabellen: Zellauswahl, Formatierung, Zeilen und Spalten ---------------- */

// Auswahlbereich in der Tabelle; ohne Zellauswahl die ganze Tabelle
export function tableRange() {
  const t = selectedEls().length === 1 && selectedEls()[0].type === 'table' ? selectedEls()[0] : null;
  if (!t) return null;
  let cs = app.cellSel && app.cellSel.id === t.id ? app.cellSel : null;
  // Zellauswahl außerhalb der Tabelle (z. B. nachdem jemand Zeilen gelöscht hat) verwerfen
  if (cs && Math.min(cs.r0, cs.r1) >= t.rows || cs && Math.min(cs.c0, cs.c1) >= t.cols) cs = app.cellSel = null;
  if (!cs) return { t, r0: 0, c0: 0, r1: t.rows - 1, c1: t.cols - 1, whole: true };
  return { t, r0: Math.min(cs.r0, cs.r1), r1: Math.min(t.rows - 1, Math.max(cs.r0, cs.r1)), c0: Math.min(cs.c0, cs.c1), c1: Math.min(t.cols - 1, Math.max(cs.c0, cs.c1)), whole: false };
}

// Formatierung auf den Bereich anwenden: patch ist ein Objekt oder eine Funktion (bisheriges Format → neues)
export function formatCells(patch) {
  const rg = tableRange();
  if (!rg) return;
  const styles = [];
  for (let r = rg.r0; r <= rg.r1; r++) {
    for (let c = rg.c0; c <= rg.c1; c++) {
      const cur = rg.t.styles?.[r]?.[c] || {};
      const next = { ...cur, ...(typeof patch === 'function' ? patch(cur, r, c) : patch) };
      for (const k of Object.keys(next)) if (next[k] === undefined || next[k] === null) delete next[k];
      styles.push([r, c, Object.keys(next).length ? next : null]);
    }
  }
  act(() => tablePatch(rg.t, { styles }));
  // Während der Bearbeitung einer Zelle zeigt der Editor das neue Format sofort
  if (app.editing && app.editing.cell) layoutEditor();
}

export function tableAction(action) {
  const rg = tableRange();
  if (!rg) return;
  const t = rg.t;
  const px = (list, n, total) => TableOps.fractions(list, n).map((f) => f * total);
  const avg = (list) => list.reduce((x, y) => x + y, 0) / list.length;
  let sel = null;
  act(() => {
    switch (action) {
      case 'rowAbove': case 'rowBelow': {
        const at = action === 'rowAbove' ? rg.r0 : rg.r1 + 1;
        if (tableStruct(t, { action: 'insertRows', at, count: 1, size: avg(px(t.rowH, t.rows, t.h)) })) sel = [at, rg.c0];
        break;
      }
      case 'colLeft': case 'colRight': {
        const at = action === 'colLeft' ? rg.c0 : rg.c1 + 1;
        if (tableStruct(t, { action: 'insertCols', at, count: 1, size: avg(px(t.colW, t.cols, t.w)) })) sel = [rg.r0, at];
        break;
      }
      case 'deleteRows': {
        const n = rg.r1 - rg.r0 + 1;
        if (n >= t.rows) return toast(T('Die letzte Zeile kann nicht gelöscht werden'));
        if (tableStruct(t, { action: 'deleteRows', at: rg.r0, count: n })) sel = [Math.min(rg.r0, t.rows - n - 1), rg.c0];
        break;
      }
      case 'deleteCols': {
        const n = rg.c1 - rg.c0 + 1;
        if (n >= t.cols) return toast(T('Die letzte Spalte kann nicht gelöscht werden'));
        if (tableStruct(t, { action: 'deleteCols', at: rg.c0, count: n })) sel = [rg.r0, Math.min(rg.c0, t.cols - n - 1)];
        break;
      }
      case 'clear': {
        const cells = [];
        for (let r = rg.r0; r <= rg.r1; r++) for (let c = rg.c0; c <= rg.c1; c++) cells.push([r, c, '']);
        tablePatch(t, { cells });
        break;
      }
      case 'clearFormat': {
        const styles = [];
        for (let r = rg.r0; r <= rg.r1; r++) for (let c = rg.c0; c <= rg.c1; c++) styles.push([r, c, null]);
        tablePatch(t, { styles });
        break;
      }
      case 'equalCols':
        tablePatch(t, { props: { colW: Array(t.cols).fill(1 / t.cols) } });
        break;
      case 'equalRows':
        tablePatch(t, { props: { rowH: Array(t.rows).fill(1 / t.rows) } });
        break;
    }
  });
  if (sel && !rg.whole) app.cellSel = { id: t.id, r0: sel[0], c0: sel[1], r1: sel[0], c1: sel[1] };
  scheduleRender(true);
  app.emit('selection');
}

// Neue Größe für ein Element (Freihandlinien skalieren ihre Punkte mit)
function resized(el, w, h) {
  const n = { ...el, w: Math.max(4, w), h: Math.max(4, h) };
  if (el.type === 'pen') n.points = (el.points || []).map(([px, py, ...p]) => [px * (n.w / (el.w || 1)), py * (n.h / (el.h || 1)), ...p]);
  return autoHeight(n);
}

// Ein Element samt Frame-Inhalt (Gruppen vollständig) verschieben
function moveWithContent(el, dx, dy, done) {
  if (!dx && !dy) return;
  const ids = [el.id];
  if (el.type === 'frame') ids.push(...withGroups(frameChildren(el).map((c) => c.id)));
  for (const id of ids) {
    if (done.has(id)) continue;
    done.add(id);
    const cur = getEl(id);
    if (cur && !isLocked(cur)) setEl(translated(cur, dx, dy));
  }
}

// Größe anpassen: Breite und/oder Höhe aller ausgewählten Elemente an die des Referenzelements
// (das zuerst ausgewählte) angleichen
const sizable = () => selectedEls().filter((e) => e.type !== 'connector' && e.type !== 'comment' && !isLocked(e) && !e.hidden);

export function matchSize(kind) {
  // Auch ein gesperrtes Element darf Referenz sein; angepasst werden nur nicht gesperrte
  const all = selectedEls().filter((e) => e.type !== 'connector' && e.type !== 'comment' && !e.hidden);
  if (all.length < 2) return toast(T('Bitte mindestens zwei Elemente auswählen'));
  const ref = all[0];
  const sel = [ref, ...all.slice(1).filter((e) => !isLocked(e))];
  act(() => {
    for (const el of sel.slice(1)) setEl(resized(el, kind !== 'h' ? ref.w : el.w, kind !== 'w' ? ref.h : el.h));
  });
  toast(T`${kind === 'w' ? T('Breite') : kind === 'h' ? T('Höhe') : T('Größe')} von „${String(ref.text || ref.title || T('erstem Element')).slice(0, 30)}“ übernommen`);
}

// Lückenlos bzw. mit festem Abstand aneinanderreihen (Reihenfolge nach Lage)
export function packSel(axis, gap = 0) {
  const sel = sizable();
  if (sel.length < 2) return toast(T('Bitte mindestens zwei Elemente auswählen'));
  const [p, s] = axis === 'h' ? ['x', 'w'] : ['y', 'h'];
  sel.sort((a, b) => a[p] - b[p]);
  let pos = sel[0][p] + sel[0][s] + gap;
  const done = new Set(sel.map((e) => e.id));
  act(() => {
    for (const el of sel.slice(1)) {
      const d = pos - el[p];
      done.delete(el.id);
      moveWithContent(el, p === 'x' ? d : 0, p === 'y' ? d : 0, done);
      pos += el[s] + gap;
    }
  });
}

// Position und Größe auf das Raster runden
export function snapSelToGrid() {
  const g = gridSize();
  const r = (v) => Math.round(v / g) * g;
  act(() => {
    for (const el of sizable()) {
      const n = { ...el, x: r(el.x), y: r(el.y) };
      if (el.type !== 'text' && el.type !== 'code' && el.type !== 'pen') Object.assign(n, { w: Math.max(g, r(el.w)), h: Math.max(g, r(el.h)) });
      setEl(autoHeight(n));
    }
  });
}

// Größe kopieren / übernehmen (wie „Copy Size“ / „Paste Size“)
let copiedSize = null;
export function copySize() {
  const el = sizable()[0];
  if (!el) return;
  copiedSize = { w: el.w, h: el.h };
  toast(T`Größe ${Math.round(el.w)} × ${Math.round(el.h)} kopiert`);
}
export function pasteSize(kind = 'both') {
  if (!copiedSize) return toast(T('Zuerst eine Größe kopieren'));
  act(() => sizable().forEach((el) => setEl(resized(el, kind !== 'h' ? copiedSize.w : el.w, kind !== 'w' ? copiedSize.h : el.h))));
}
export const hasCopiedSize = () => !!copiedSize;

// Exakte Werte setzen. Bei mehreren Elementen verschieben X/Y die ganze Auswahl, B/H gelten für jedes Element.
export function setGeometry({ x, y, w, h, keepRatio }) {
  const sel = sizable();
  if (!sel.length) return;
  const b = selectionBounds();
  const dx = Number.isFinite(x) ? x - b.x : 0, dy = Number.isFinite(y) ? y - b.y : 0;
  const done = new Set();
  act(() => {
    // zuerst verschieben (Frames samt Inhalt, ausgewählte freie Verbinder mit), dann Größe setzen
    for (const el of sel) moveWithContent(el, dx, dy, done);
    for (const c of selectedEls()) if (c.type === 'connector' && !c.from.id && !c.to.id) moveWithContent(c, dx, dy, done);
    if (!Number.isFinite(w) && !Number.isFinite(h)) return;
    for (const el0 of sel) {
      const el = getEl(el0.id);
      let nw = Number.isFinite(w) ? w : el.w, nh = Number.isFinite(h) ? h : el.h;
      if (keepRatio && el.w && el.h) {
        if (Number.isFinite(w) && !Number.isFinite(h)) nh = el.h * (nw / el.w);
        if (Number.isFinite(h) && !Number.isFinite(w)) nw = el.w * (nh / el.h);
      }
      setEl(resized(el, nw, nh));
    }
  });
}

// Strg+D: Wurde die letzte Kopie verschoben, wird dieser Versatz wiederholt (Reihen gleicher Elemente)
let lastDup = null;
function smartDuplicate() {
  const ids = [...app.sel];
  let dx = 20, dy = 20;
  if (lastDup && lastDup.copies.length === ids.length && lastDup.copies.every((id, i) => id === ids[i])) {
    const src = getEl(lastDup.src[0]), cur = getEl(lastDup.copies[0]);
    if (src && cur && Number.isFinite(src.x) && Number.isFinite(cur.x)) {
      dx = cur.x - src.x;
      dy = cur.y - src.y;
    }
  }
  const list = collectForCopy(ids);
  const copies = duplicateEls(list, dx, dy, false);
  // Reihenfolge der Auswahl beibehalten: Quelle → Kopie
  const map = new Map(copies.map((c) => [c._src, c.id]));
  const srcIds = ids.filter((id) => map.has(id));
  lastDup = { src: srcIds, copies: srcIds.map((id) => map.get(id)) };
  copies.forEach((c) => delete c._src);
  setSelection(lastDup.copies.length ? lastDup.copies : copies.map((c) => c.id));
}

export function clusterByColor() {
  const stickies = selectedEls().filter((e) => e.type === 'sticky' && !isLocked(e));
  if (stickies.length < 2) return toast(T('Bitte mehrere Sticky Notes auswählen'));
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
  toast(T`${groups.size} Farb-Cluster gebildet`);
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
  toast(T('Gruppiert'));
}

export function ungroupSel() {
  act(() => selectedEls().forEach((el) => el.groupId && setEl({ ...el, groupId: undefined })));
  toast(T('Gruppierung aufgehoben'));
}

export function toggleLock() {
  const sel = selectedEls();
  const lock = !sel.every((e) => e.locked);
  act(() => sel.forEach((el) => setEl({ ...el, locked: lock })));
  scheduleRender(true);
  app.emit('selection');
}

// Gesperrt für mich: selbst gesperrt oder von der Moderation für Teilnehmende gesperrt
export function isLocked(el) {
  return !!el && (!!el.locked || (!!el.modLock && !app.isFacilitator));
}

// Moderation: Elemente für Teilnehmende sperren bzw. freigeben (der Server prüft die Berechtigung)
export function toggleModLock() {
  const sel = selectedEls().filter((e) => e.type !== 'comment');
  if (!sel.length || !app.isFacilitator) return;
  const lock = !sel.every((e) => e.modLock);
  act(() => sel.forEach((el) => {
    const n = { ...el, modLock: lock };
    if (!lock) delete n.modLock;
    setEl(n);
  }));
  toast(lock ? T('Für Teilnehmende gesperrt – nur Moderierende können diese Elemente ändern') : T('Für Teilnehmende freigegeben'));
  scheduleRender(true);
  app.emit('selection');
}

export function nudge(dx, dy) {
  const ids = new Set(app.sel);
  for (const el of selectedEls()) if (el.type === 'frame') withGroups(frameChildren(el).map((c) => c.id)).forEach((c) => ids.add(c));
  // Knickpunkte von Verbindern zwischen mitbewegten Elementen wandern mit (wie beim Ziehen)
  for (const c of app.els.values()) {
    if (c.type === 'connector' && !ids.has(c.id) && waypointsOf(c).length && c.from.id && c.to.id && ids.has(c.from.id) && ids.has(c.to.id)) ids.add(c.id);
  }
  act(() => [...ids].map(getEl).filter((e) => e && (!isLocked(e) || pageOfMovedFrame(e))).forEach((el) => setEl(translated(el, dx, dy))));
}

/* ================================================================== */
/* Tastatur                                                            */
/* ================================================================== */

function isTyping(e) {
  const t = e.target;
  return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable) && t !== editor;
}

const TOOL_KEYS = { v: 'select', h: 'hand', n: 'sticky', t: 'text', s: 'shape', l: 'connector', p: 'pen', e: 'eraser', f: 'frame', c: 'comment', k: 'card', m: 'mindmap', x: 'laser' };

window.addEventListener('keydown', (e) => {
  if (isTyping(e) || app.editing) return;
  if (document.querySelector('.modal-back')) return;
  // Schaltflächen und Links reagieren selbst auf die Tastatur
  if ((e.key === 'Enter' || e.key === ' ') && e.target.closest?.('button, a, summary')) return;
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
    if (app.sel.size) smartDuplicate();
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
    if (key === 'v' || key === 'h' || key === 'x' || (key === 'c' && app.canComment)) setTool(TOOL_KEYS[key]);
    return;
  }
  // Zellauswahl in einer Tabelle: Pfeiltasten wandern, Enter bearbeitet, Entf leert, Tippen überschreibt
  const cs = app.cellSel && app.sel.size === 1 && app.sel.has(app.cellSel.id) ? app.cellSel : null;
  const tbl = cs && getEl(cs.id);
  if (tbl && tbl.type === 'table' && !isLocked(tbl)) {
    if (e.key.startsWith('Arrow')) {
      e.preventDefault();
      const dr = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0, dc = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      const r = clamp(cs.r1 + dr, 0, tbl.rows - 1), c = clamp(cs.c1 + dc, 0, tbl.cols - 1);
      app.cellSel = e.shiftKey ? { ...cs, r1: r, c1: c } : { id: cs.id, r0: r, c0: c, r1: r, c1: c };
      scheduleRender(true);
      app.emit('selection');
      return;
    }
    if (e.key === 'Enter' || e.key === 'F2') {
      e.preventDefault();
      startEdit(tbl.id, { cell: [cs.r1, cs.c1], selectAll: false });
      return;
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      tableAction('clear');
      return;
    }
    if (e.key === 'Escape') {
      app.cellSel = null;
      scheduleRender(true);
      app.emit('selection');
      return;
    }
    if (e.key.length === 1 && !e.altKey) {
      // Tippen überschreibt die Zelle (wie in einer Tabellenkalkulation)
      e.preventDefault();
      startEdit(tbl.id, { cell: [cs.r1, cs.c1] });
      editor.value = e.key;
      editor.dispatchEvent(new Event('input'));
      editor.setSelectionRange(1, 1);
      return;
    }
  }
  if (e.key === 'Delete' || e.key === 'Backspace') {
    if (app.sel.size) {
      e.preventDefault();
      deleteEls([...app.sel].filter((id) => !isLocked(getEl(id))));
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
    // Mit eingeschaltetem Raster um eine Rasterweite, sonst 1 px bzw. 10 px (Umschalt)
    const s = app.settings.snap ? gridSize() : e.shiftKey ? 10 : 1;
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
      toast(T('Einfügen fehlgeschlagen'));
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
  toast(T`${list.length} Sticky Notes erstellt`);
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
    img.onerror = () => toast(T('Bild konnte nicht gelesen werden'));
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
    else app.emit('dropFile', f, { x: w.x + i * 240, y: w.y });
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
  app.sync = new Sync(boardId, app.user, { viewOnly: app.viewOnly, canComment: app.canComment });
  const saved = loadPref('view.' + boardId, null);
  if (saved) app.view = saved;
  stage.dataset.tool = app.tool;
  // Das Neon-Design aus 3.5.0 gibt es nicht mehr; wer es gewählt hatte, erhält das dunkle Design
  if (app.settings.neon) {
    app.settings.dark = true;
    delete app.settings.neon;
    savePref('settings', app.settings);
  }
  document.body.classList.toggle('dark', !!app.settings.dark);
  stage.classList.toggle('nogrid', !app.settings.grid);
  $('#cursors').classList.toggle('off', !!app.settings.hideCursors);
  applyView(true);
  window.addEventListener('resize', () => applyView(true));
  window.addEventListener('pagehide', () => app.sync.flushNow());
  window.addEventListener('beforeunload', (e) => {
    // Noch nicht beim Server angekommene Änderungen: Browser fragt nach, bevor die Seite verlassen wird
    const unsent = app.sync.pending || app.sync.sending.length > 0;
    app.sync.flushNow();
    // Speicherfehler des Servers betreffen nur, wer selbst noch ungespeicherte Änderungen hat
    if ((unsent && (!app.sync.connected || app.sync.retrying)) || (app.sync.save.failed && app.sync.unsaved)) {
      e.preventDefault();
      e.returnValue = '';
    }
  });
  return !!saved;
}

export function saveSettings() {
  savePref('settings', app.settings);
  document.body.classList.toggle('dark', !!app.settings.dark);
  stage.classList.toggle('nogrid', !app.settings.grid);
  $('#cursors').classList.toggle('off', !!app.settings.hideCursors);
  rerenderAll();
}
