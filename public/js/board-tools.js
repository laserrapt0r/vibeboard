// Werkzeuge am ausgewählten Element: automatisch anordnen, Swimlanes, Diagramme aus Tabellen, Bilder zuschneiden, Skizzen zu Formen
import { T } from './i18n.js';
import { h, toast, modal } from './util.js';
import { app, getEl, act, updateEl, setEl, deleteEls, addElements, makeElement, bounds, selectedEls, frameChildren, setSelection } from './core.js';
import { menu } from './menu.js';
import { buildCtx } from './ui.js';
import { layered, tree, lanes } from './layout.js';

/* ---------------- Automatisch anordnen ---------------- */

const isNode = (e) => !['connector', 'frame', 'comment', 'pen'].includes(e.type) && !e.hidden;
const connectors = () => [...app.els.values()].filter((e) => e.type === 'connector' && e.from.id && e.to.id);

// Alles, was über Verbindungen mit den Startelementen zusammenhängt
function component(seed) {
  const seen = new Set(seed);
  const queue = [...seed];
  const list = connectors();
  while (queue.length) {
    const id = queue.pop();
    for (const c of list) {
      const other = c.from.id === id ? c.to.id : c.to.id === id ? c.from.id : null;
      const el = other && getEl(other);
      if (el && isNode(el) && !seen.has(other)) {
        seen.add(other);
        queue.push(other);
      }
    }
  }
  return [...seen].map(getEl).filter((e) => e && isNode(e));
}

const nodeBox = (e) => ({ id: e.id, ...bounds(e) });
const edgesOf = (list) => {
  const ids = new Set(list.map((e) => e.id));
  return connectors().filter((c) => ids.has(c.from.id) && ids.has(c.to.id)).map((c) => ({ from: c.from.id, to: c.to.id, id: c.id }));
};

function place(positions, edges) {
  for (const [id, p] of positions) {
    const el = getEl(id);
    if (el && !el.locked) updateEl(id, { x: Math.round(p.x), y: Math.round(p.y) });
  }
  // Von Hand gesetzte Zwischenpunkte passen nach dem Umordnen nicht mehr
  for (const e of edges) if (getEl(e.id)?.waypoints?.length) updateEl(e.id, { waypoints: undefined });
}

function arrange(list, mode) {
  const nodes = list.map(nodeBox);
  const edges = edgesOf(list);
  if (nodes.length < 2) return toast(T('Für das Anordnen braucht es mindestens zwei Elemente.'));
  let result;
  if (mode === 'tree') {
    if (!edges.length) return toast(T('Für eine Mindmap müssen die Elemente verbunden sein.'));
    const heads = new Set(edges.map((e) => e.to));
    const root = nodes.find((n) => app.sel.has(n.id) && !heads.has(n.id)) || nodes.find((n) => !heads.has(n.id)) || nodes[0];
    result = tree(nodes, edges, root.id);
  } else result = layered(nodes, edges, mode);
  act(() => place(result, edges));
  setSelection(list.map((e) => e.id));
}

function arrangeMenu(anchor, sel) {
  const start = sel.filter(isNode);
  const list = start.length === 1 ? component([start[0].id]) : start;
  menu(anchor, [
    { header: T('Automatisch anordnen') },
    { label: T('Von links nach rechts'), onClick: () => arrange(list, 'LR') },
    { label: T('Von oben nach unten'), onClick: () => arrange(list, 'TB') },
    { label: T('Als Mindmap'), onClick: () => arrange(list, 'tree') },
  ]);
}

/* ---------------- Swimlanes ---------------- */

function editLanes(frame) {
  const text = h('textarea', { rows: 5 }, (frame.lanes || []).map((l) => l.title).join('\n'));
  const form = h('form', { class: 'form', onsubmit: (e) => {
    e.preventDefault();
    const titles = text.value.split('\n').map((s) => s.trim()).filter(Boolean).slice(0, 12);
    act(() => updateEl(frame.id, { lanes: titles.length ? titles.map((title) => ({ title })) : undefined }));
    m.close();
    buildCtx();
  } },
  h('label', {}, T('Bahnen (eine je Zeile, z. B. Rolle oder Abteilung)'), text),
  h('p', { class: 'muted small' }, T('Leer lassen entfernt die Bahnen.')),
  h('div', { class: 'form-actions' }, h('button', { type: 'button', class: 'btn', onclick: () => m.close() }, T('Abbrechen')), h('button', { type: 'submit', class: 'btn primary' }, T('Übernehmen'))));
  const m = modal(T('Swimlanes'), form);
}

const LANE_HEAD = 44;
const LANE_PAD = 30;

// Spalten nach Abfolge der Verbindungen, die Bahn jedes Elements bleibt. Der Frame wächst bei Bedarf mit.
function arrangeLanes(frame) {
  const kids = frameChildren(frame).filter(isNode);
  if (kids.length < 2) return toast(T('Für das Anordnen braucht es mindestens zwei Elemente.'));
  const n = frame.lanes.length;
  const laneOf = (el) => Math.max(0, Math.min(n - 1, Math.floor(((el.y + el.h / 2 - frame.y) / frame.h) * n)));
  const nodes = kids.map(nodeBox);
  const edges = edgesOf(kids);
  const g = lanes(nodes, edges, laneOf, n);
  const laneH = Math.max((frame.h / n), ...g.laneH.map((v) => v + LANE_PAD * 2));
  const width = LANE_HEAD + LANE_PAD * 2 + g.colW.reduce((s, v) => s + v, 0) + g.GAP_LAYER * (g.colCount - 1);
  const positions = new Map();
  let cx = frame.x + LANE_HEAD + LANE_PAD;
  for (let c = 0; c < g.colCount; c++) {
    for (let l = 0; l < n; l++) {
      const list = g.cells.get(`${c}:${l}`) || [];
      const total = list.reduce((s, e) => s + e.h, 0) + g.GAP_NODE * Math.max(0, list.length - 1);
      let y = frame.y + laneH * l + (laneH - total) / 2;
      for (const e of list) {
        positions.set(e.id, { x: cx + (g.colW[c] - e.w) / 2, y });
        y += e.h + g.GAP_NODE;
      }
    }
    cx += g.colW[c] + g.GAP_LAYER;
  }
  act(() => {
    updateEl(frame.id, { w: Math.max(frame.w, width), h: laneH * n });
    place(positions, edges);
  });
}

/* ---------------- Diagramme aus Tabellen ---------------- */

function addChart(table, chartKind) {
  const b = bounds(latest(table));
  const el = { ...makeElement('chart', 0, 0, { sourceId: table.id, chartKind, title: '' }), x: b.x + b.w + 40, y: b.y, w: 520, h: 340 };
  addElements([el]);
}

const KINDS = () => [['bar', T('Balkendiagramm')], ['line', T('Liniendiagramm')], ['pie', T('Tortendiagramm')]];

const latest = (el) => getEl(el.id) || el;

function chartMenu(anchor, pick, current) {
  menu(anchor, [{ header: T('Diagramm') }, ...KINDS().map(([k, label]) => ({ label, checked: current ? current === k : undefined, onClick: () => pick(k) }))]);
}

function chartTitle(el) {
  const input = h('input', { type: 'text', value: el.title || '', maxlength: 120 });
  const form = h('form', { class: 'form', onsubmit: (e) => {
    e.preventDefault();
    act(() => updateEl(el.id, { title: input.value.trim() }));
    m.close();
  } }, h('label', {}, T('Titel'), input), h('div', { class: 'form-actions' }, h('button', { type: 'submit', class: 'btn primary' }, T('Übernehmen'))));
  const m = modal(T('Diagramm'), form);
}

/* ---------------- Bilder zuschneiden ---------------- */

function cropImage(el) {
  const c = el.crop || { x: 0, y: 0, w: 1, h: 1 };
  let box = { l: c.x, t: c.y, r: c.x + c.w, b: c.y + c.h };
  const fields = {};
  const area = h('div', { class: 'crop-box' });
  const img = h('img', { src: el.src, alt: '', draggable: 'false' });
  const stage = h('div', { class: 'crop-stage' }, img, area);
  const paint = () => {
    Object.assign(area.style, { left: box.l * 100 + '%', top: box.t * 100 + '%', width: (box.r - box.l) * 100 + '%', height: (box.b - box.t) * 100 + '%' });
    for (const k of Object.keys(fields)) fields[k].value = Math.round((k === 'l' || k === 't' ? box[k] : 1 - box[k]) * 100);
  };
  const MIN = 0.02;
  const set = (k, v) => {
    if (k === 'l') box.l = Math.max(0, Math.min(box.r - MIN, v));
    if (k === 't') box.t = Math.max(0, Math.min(box.b - MIN, v));
    if (k === 'r') box.r = Math.min(1, Math.max(box.l + MIN, v));
    if (k === 'b') box.b = Math.min(1, Math.max(box.t + MIN, v));
    paint();
  };
  for (const [cls, keys] of [['tl', 'lt'], ['tr', 'rt'], ['bl', 'lb'], ['br', 'rb']]) {
    const grip = h('span', { class: 'crop-grip ' + cls });
    grip.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      grip.setPointerCapture(e.pointerId);
      const move = (ev) => {
        const r = stage.getBoundingClientRect();
        set(keys[0], (ev.clientX - r.left) / r.width);
        set(keys[1], (ev.clientY - r.top) / r.height);
      };
      grip.addEventListener('pointermove', move);
      grip.addEventListener('pointerup', () => grip.removeEventListener('pointermove', move), { once: true });
    });
    area.append(grip);
  }
  // Zahlenfelder: dieselbe Funktion ohne Maus
  const percent = (k, label) => {
    const input = h('input', { type: 'number', min: 0, max: 98, step: 1 });
    input.addEventListener('input', () => set(k, k === 'l' || k === 't' ? input.value / 100 : 1 - input.value / 100));
    fields[k] = input;
    return h('label', {}, label, input);
  };
  const form = h('form', { class: 'form', onsubmit: (e) => {
    e.preventDefault();
    const next = { x: box.l, y: box.t, w: box.r - box.l, h: box.b - box.t };
    // Der aktuelle Stand zählt: Während der Dialog offen war, kann das Bild verschoben worden sein
    const cur = getEl(el.id);
    if (!cur) return m.close();
    const had = cur.crop || { x: 0, y: 0, w: 1, h: 1 };
    const fullW = cur.w / had.w, fullH = cur.h / had.h;
    act(() => updateEl(cur.id, {
      crop: next.w > 0.995 && next.h > 0.995 ? undefined : next,
      x: cur.x + (next.x - had.x) * fullW, y: cur.y + (next.y - had.y) * fullH, w: fullW * next.w, h: fullH * next.h,
    }));
    m.close();
    buildCtx();
  } }, stage,
  h('div', { class: 'form-row' }, percent('l', T('Links (%)')), percent('r', T('Rechts (%)')), percent('t', T('Oben (%)')), percent('b', T('Unten (%)'))),
  h('div', { class: 'form-actions' },
    h('button', { type: 'button', class: 'btn', onclick: () => {
      box = { l: 0, t: 0, r: 1, b: 1 };
      paint();
    } }, T('Zurücksetzen')),
    h('span', { class: 'spacer' }),
    h('button', { type: 'button', class: 'btn', onclick: () => m.close() }, T('Abbrechen')), h('button', { type: 'submit', class: 'btn primary' }, T('Zuschneiden'))));
  const m = modal(T('Bild zuschneiden'), form, { wide: true });
  paint();
}

/* ---------------- Skizzen zu Formen ---------------- */

const SHARP_TURN = 0.9; // etwa 50 Grad
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

// Punkte auf die wesentlichen Ecken verringern (Douglas-Peucker)
function simplify(pts, eps) {
  if (pts.length < 3) return pts;
  const [a, b] = [pts[0], pts[pts.length - 1]];
  const len = dist(a, b);
  let far = 0, at = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    // Geschlossener Linienzug: Anfang und Ende fallen zusammen, dann zählt der Abstand zum Punkt
    const d = len < 1e-6 ? dist(a, pts[i]) : Math.abs((b[0] - a[0]) * (a[1] - pts[i][1]) - (a[0] - pts[i][0]) * (b[1] - a[1])) / len;
    if (d > far) {
      far = d;
      at = i;
    }
  }
  if (far <= eps) return [a, b];
  return [...simplify(pts.slice(0, at + 1), eps).slice(0, -1), ...simplify(pts.slice(at), eps)];
}

// Ecken eines geschlossenen Umrisses: Punkte auf einer geraden Strecke zählen nicht
function cornersOf(line, size, minTurn = 0.45) {
  const list = simplify(line, size * 0.09).slice(0, -1);
  return list.filter((p, i) => {
    const a = list[(i - 1 + list.length) % list.length], b = list[(i + 1) % list.length];
    const turn = Math.abs(Math.atan2(b[1] - p[1], b[0] - p[0]) - Math.atan2(p[1] - a[1], p[0] - a[0]));
    return Math.min(turn, Math.PI * 2 - turn) > minTurn;
  });
}

export function recognize(points) {
  const pts = points.map((p) => [p[0], p[1]]);
  if (pts.length < 2) return null;
  let length = 0;
  for (let i = 1; i < pts.length; i++) length += dist(pts[i - 1], pts[i]);
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const w = Math.max(...xs) - Math.min(...xs), h2 = Math.max(...ys) - Math.min(...ys);
  const size = Math.max(w, h2);
  if (size < 8) return null;
  const ends = dist(pts[0], pts[pts.length - 1]);
  if (ends / length > 0.9) return { kind: 'line' };
  if (ends > length * 0.22) return null; // offene Kurve: lieber nicht raten
  // Geschlossene Form: Ecken zählen
  const closed = [...pts, pts[0]];
  // Startpunkt in die Mitte einer Seite legen, damit keine Ecke verloren geht
  const rotated = closed.slice(Math.floor(closed.length / 8)).concat(closed.slice(1, Math.floor(closed.length / 8) + 1));
  const s = cornersOf(rotated, size);
  const corners = s.length;
  if (corners === 3) return { kind: 'triangle' };
  if (corners === 4) {
    const dx = Math.min(...xs), dy = Math.min(...ys);
    // Ecken in der Mitte der Seiten: Raute, sonst Rechteck
    const mid = s.filter((p) => Math.abs(p[0] - dx - w / 2) < w * 0.22 || Math.abs(p[1] - dy - h2 / 2) < h2 * 0.22).length;
    return { kind: mid >= 3 ? 'diamond' : 'rect' };
  }
  return roundShape(pts, ring(xs, ys, w, h2)) ? { kind: 'ellipse' } : null;
}

const ring = (xs, ys, w, h) => ({ cx: Math.min(...xs) + w / 2, cy: Math.min(...ys) + h / 2, w: w || 1, h: h || 1 });

// Rund heißt: gleichmäßiger Abstand zur Mitte und keine klaren Ecken. Stern, Acht oder Kritzel bleiben Linien.
function roundShape(pts, c) {
  const unit = pts.map((p) => [(p[0] - c.cx) / c.w, (p[1] - c.cy) / c.h]);
  const r = unit.map((p) => Math.hypot(p[0], p[1]));
  const mean = r.reduce((a, v) => a + v, 0) / r.length;
  const spread = Math.sqrt(r.reduce((a, v) => a + (v - mean) ** 2, 0) / r.length) / mean;
  if (spread > 0.12) return false;
  return cornersOf([...unit, unit[0]], 0.45, SHARP_TURN).length < 3;
}

function shapeFrom(pens) {
  const made = [];
  const remove = [];
  for (const p of pens) {
    const r = recognize(p.points || []);
    if (!r) continue;
    remove.push(p.id);
    if (r.kind === 'line') {
      const first = p.points[0], last = p.points[p.points.length - 1];
      made.push({ ...makeElement('connector', 0, 0), from: { x: p.x + first[0], y: p.y + first[1] }, to: { x: p.x + last[0], y: p.y + last[1] }, stroke: p.stroke, strokeWidth: p.strokeWidth, routing: 'straight', arrowEnd: 'none' });
    } else {
      made.push({ ...makeElement('shape', 0, 0, { shape: r.kind }), x: p.x, y: p.y, w: Math.max(20, p.w), h: Math.max(20, p.h), stroke: p.stroke, strokeWidth: p.strokeWidth, fill: 'transparent' });
    }
  }
  if (!made.length) return toast(T('Keine Form erkannt. Zeichne Linie, Kreis, Rechteck, Dreieck oder Raute möglichst geschlossen.'), 5000);
  act(() => {
    deleteEls(remove);
    made.forEach((e) => setEl(e));
  });
  setSelection(made.map((e) => e.id));
}

/* ---------------- Kontextleiste ---------------- */

app.on('ctxItems', (items, sel, { locked, one, actBtn }) => {
  if (locked) return;
  if (sel.filter(isNode).length >= 1 && (sel.length > 1 || connectors().some((c) => c.from.id === one?.id || c.to.id === one?.id))) {
    const b = actBtn('sitemap', T('Automatisch anordnen'), () => arrangeMenu(b, sel));
    items.push(b);
  }
  if (one?.type === 'frame' && one.kind !== 'topic') {
    items.push(actBtn('lanes', T('Swimlanes'), () => editLanes(latest(one))));
    if (one.lanes?.length) items.push(actBtn('sitemap', T('In den Bahnen anordnen'), () => arrangeLanes(latest(one))));
  }
  if (one?.type === 'table') {
    const b = actBtn('chart', T('Diagramm aus Tabelle'), () => chartMenu(b, (k) => addChart(one, k)));
    items.push(b);
  }
  if (one?.type === 'chart') {
    const b = actBtn('chart', T('Diagrammart'), () => chartMenu(b, (k) => act(() => updateEl(one.id, { chartKind: k })), latest(one).chartKind));
    items.push(b, actBtn('edit', T('Titel des Diagramms'), () => chartTitle(latest(one))));
  }
  if (one?.type === 'image' && one.src) items.push(actBtn('crop', T('Zuschneiden'), () => cropImage(latest(one))));
  if (sel.length && sel.every((e) => e.type === 'pen')) items.push(actBtn('magic', T('In Form umwandeln'), () => shapeFrom(selectedEls())));
});

