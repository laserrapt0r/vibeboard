// Darstellung der Board-Elemente als SVG-Markup (für Board, Vorschau & Export)
import { esc, FONT, wrap, fitText, measure, contrastText, initials, unionRect } from './util.js';
import { tokenize, THEMES, MAX_LINES } from './highlight.js';

const own = (map, key) => (Object.hasOwn(map, key) ? map[key] : undefined);

export const LH = 1.25;

export const SHAPES = [
  ['rect', 'Rechteck'], ['roundrect', 'Abgerundet'], ['ellipse', 'Ellipse'], ['diamond', 'Raute'],
  ['triangle', 'Dreieck'], ['hexagon', 'Sechseck'], ['parallelogram', 'Parallelogramm'], ['trapezoid', 'Trapez'],
  ['star', 'Stern'], ['pill', 'Pille'], ['cylinder', 'Zylinder'], ['arrow', 'Blockpfeil'],
  ['callout', 'Sprechblase'], ['cross', 'Kreuz'], ['document', 'Dokument'], ['cloud', 'Wolke'],
  ['subprocess', 'Unterprozess'], ['delay', 'Verzögerung'], ['note', 'Notiz'], ['package', 'Paket'],
  ['actor', 'Akteur'], ['server', 'Server'], ['queue', 'Warteschlange'], ['container', 'Container'],
  ['component', 'Komponente'], ['browser', 'Browser / UI'], ['laptop', 'Endgerät'], ['firewall', 'Firewall'],
];

// Gruppierung für die Formenauswahl
export const SHAPE_GROUPS = [
  ['Grundformen', ['rect', 'roundrect', 'ellipse', 'diamond', 'triangle', 'hexagon', 'parallelogram', 'trapezoid', 'star', 'pill', 'arrow', 'callout', 'cross', 'cloud']],
  ['Flussdiagramm & UML', ['rect', 'pill', 'diamond', 'parallelogram', 'document', 'subprocess', 'delay', 'cylinder', 'note', 'package', 'component', 'actor']],
  ['Software & IT', ['server', 'cylinder', 'queue', 'container', 'browser', 'laptop', 'firewall', 'cloud', 'actor', 'component']],
];

export const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace";

export function defsMarkup() {
  return `<filter id="shadow" x="-10%" y="-10%" width="130%" height="140%"><feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#000" flood-opacity="0.16"/></filter>
<filter id="shadow-sm" x="-10%" y="-10%" width="130%" height="140%"><feDropShadow dx="0" dy="1" stdDeviation="1.5" flood-color="#000" flood-opacity="0.18"/></filter>`;
}

/* ---------------- Text ---------------- */

export function textLayout(el, box) {
  const bold = !!el.bold;
  const italic = !!el.italic;
  if (el.fontSize === 'auto' || el.fontSize == null) {
    const r = fitText(el.text || '', box.w, box.h, bold, LH);
    return { size: r.size, lines: r.lines, bold, italic };
  }
  const size = Number(el.fontSize) || 16;
  return { size, lines: wrap(el.text || '', box.w, size, bold, italic), bold, italic };
}

export function textSvg(box, layout, { color = '#1a1a1a', align = 'center', valign = 'middle', cls = 't' } = {}) {
  const { size, lines, bold, italic } = layout;
  if (!lines.length || (lines.length === 1 && !lines[0])) return '';
  const total = lines.length * size * LH;
  let ty = valign === 'top' ? box.y : valign === 'bottom' ? box.y + box.h - total : box.y + (box.h - total) / 2;
  const anchor = align === 'left' ? 'start' : align === 'right' ? 'end' : 'middle';
  const tx = align === 'left' ? box.x : align === 'right' ? box.x + box.w : box.x + box.w / 2;
  const base = size * ((LH - 1) / 2 + 0.8);
  let spans = '';
  lines.forEach((l, i) => {
    if (l) spans += `<tspan x="${r1(tx)}" y="${r1(ty + i * size * LH + base)}">${esc(l)}</tspan>`;
  });
  return `<text class="${cls}" font-family="${esc(FONT)}" font-size="${size}" fill="${color}" text-anchor="${anchor}"${bold ? ' font-weight="bold"' : ''}${italic ? ' font-style="italic"' : ''} xml:space="preserve">${spans}</text>`;
}

const r1 = (v) => Math.round(v * 10) / 10;

/* ---------------- Formen ---------------- */

export function shapeGeom(kind, x, y, w, h) {
  const p = (pts) => `<polygon points="${pts.map(([a, b]) => `${r1(a)},${r1(b)}`).join(' ')}"`;
  switch (kind) {
    case 'roundrect': return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${Math.min(w, h) * 0.15}"`;
    case 'pill': return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${Math.min(w, h) / 2}"`;
    case 'ellipse': return `<ellipse cx="${x + w / 2}" cy="${y + h / 2}" rx="${w / 2}" ry="${h / 2}"`;
    case 'diamond': return p([[x + w / 2, y], [x + w, y + h / 2], [x + w / 2, y + h], [x, y + h / 2]]);
    case 'triangle': return p([[x + w / 2, y], [x + w, y + h], [x, y + h]]);
    case 'hexagon': return p([[x + w * 0.25, y], [x + w * 0.75, y], [x + w, y + h / 2], [x + w * 0.75, y + h], [x + w * 0.25, y + h], [x, y + h / 2]]);
    case 'parallelogram': return p([[x + w * 0.2, y], [x + w, y], [x + w * 0.8, y + h], [x, y + h]]);
    case 'trapezoid': return p([[x + w * 0.2, y], [x + w * 0.8, y], [x + w, y + h], [x, y + h]]);
    case 'star': {
      const pts = [];
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const r = i % 2 ? 0.4 : 1;
        pts.push([x + w / 2 + (Math.cos(a) * w * r) / 2, y + h / 2 + (Math.sin(a) * h * r) / 2 + h * 0.05]);
      }
      return p(pts);
    }
    case 'arrow': return p([[x, y + h * 0.25], [x + w * 0.6, y + h * 0.25], [x + w * 0.6, y], [x + w, y + h / 2], [x + w * 0.6, y + h], [x + w * 0.6, y + h * 0.75], [x, y + h * 0.75]]);
    case 'cross': {
      const a = 0.3, b = 0.7;
      return p([[x + w * a, y], [x + w * b, y], [x + w * b, y + h * a], [x + w, y + h * a], [x + w, y + h * b], [x + w * b, y + h * b], [x + w * b, y + h], [x + w * a, y + h], [x + w * a, y + h * b], [x, y + h * b], [x, y + h * a], [x + w * a, y + h * a]]);
    }
    case 'callout': {
      const bh = h * 0.8, r = Math.min(w, bh) * 0.12;
      return `<path d="M${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + bh - r} Q${x + w},${y + bh} ${x + w - r},${y + bh} H${x + w * 0.4} L${x + w * 0.2},${y + h} L${x + w * 0.25},${y + bh} H${x + r} Q${x},${y + bh} ${x},${y + bh - r} V${y + r} Q${x},${y} ${x + r},${y} Z"`;
    }
    case 'cylinder': {
      const ry = Math.min(h * 0.12, 30);
      return `<path d="M${x},${y + ry} A${w / 2},${ry} 0 0 1 ${x + w},${y + ry} V${y + h - ry} A${w / 2},${ry} 0 0 1 ${x},${y + h - ry} Z M${x},${y + ry} A${w / 2},${ry} 0 0 0 ${x + w},${y + ry}"`;
    }
    case 'document': {
      const wv = h * 0.1;
      return `<path d="M${x},${y} H${x + w} V${y + h - wv} C${x + w * 0.75},${y + h - wv * 2.5} ${x + w * 0.5},${y + h + wv * 0.5} ${x},${y + h - wv} Z"`;
    }
    case 'cloud': {
      const cx = (f) => x + w * f, cy = (f) => y + h * f;
      return `<path d="M${cx(0.25)},${cy(0.85)} C${cx(0.02)},${cy(0.85)} ${cx(0.0)},${cy(0.5)} ${cx(0.18)},${cy(0.45)} C${cx(0.15)},${cy(0.15)} ${cx(0.45)},${cy(0.05)} ${cx(0.55)},${cy(0.25)} C${cx(0.65)},${cy(0.05)} ${cx(0.92)},${cy(0.15)} ${cx(0.85)},${cy(0.42)} C${cx(1.02)},${cy(0.48)} ${cx(1.0)},${cy(0.85)} ${cx(0.78)},${cy(0.85)} Z"`;
    }
    case 'subprocess': return `<path d="M${x},${y} H${x + w} V${y + h} H${x} Z M${x + w * 0.08},${y} V${y + h} M${x + w * 0.92},${y} V${y + h}"`;
    case 'delay': return `<path d="M${x},${y} H${x + w * 0.6} A${w * 0.4},${h / 2} 0 0 1 ${x + w * 0.6},${y + h} H${x} Z"`;
    case 'note': {
      const f = Math.min(w, h) * 0.18;
      return `<path d="M${x},${y} H${x + w - f} L${x + w},${y + f} V${y + h} H${x} Z M${x + w - f},${y} V${y + f} H${x + w}"`;
    }
    case 'package': return `<path d="M${x},${y} H${x + w * 0.4} V${y + h * 0.18} H${x + w} V${y + h} H${x} Z M${x},${y + h * 0.18} H${x + w * 0.4}"`;
    case 'actor': {
      const cx = x + w / 2, r = Math.min(w * 0.16, h * 0.1), hy = y + r + 1;
      return `<path d="M${cx - r},${hy} A${r},${r} 0 1 0 ${cx + r},${hy} A${r},${r} 0 1 0 ${cx - r},${hy} Z M${cx},${hy + r} V${y + h * 0.5} M${x + w * 0.22},${y + h * 0.3} H${x + w * 0.78} M${cx},${y + h * 0.5} L${x + w * 0.26},${y + h * 0.72} M${cx},${y + h * 0.5} L${x + w * 0.74},${y + h * 0.72}"`;
    }
    case 'server': {
      const r = Math.max(1.5, Math.min(w, h) * 0.035);
      const led = (cy) => `M${x + w * 0.88 - r},${cy} A${r},${r} 0 1 0 ${x + w * 0.88 + r},${cy} A${r},${r} 0 1 0 ${x + w * 0.88 - r},${cy} Z`;
      return `<path d="M${x},${y} H${x + w} V${y + h} H${x} Z M${x},${y + h / 3} H${x + w} M${x},${y + (h * 2) / 3} H${x + w} ${led(y + h / 6)} ${led(y + h / 2)} ${led(y + (h * 5) / 6)}"`;
    }
    case 'queue': {
      const rx = Math.min(w * 0.12, 30);
      return `<path d="M${x + rx},${y} H${x + w - rx} A${rx},${h / 2} 0 0 1 ${x + w - rx},${y + h} H${x + rx} A${rx},${h / 2} 0 0 1 ${x + rx},${y} Z M${x + w - rx},${y} A${rx},${h / 2} 0 0 0 ${x + w - rx},${y + h}"`;
    }
    case 'container': {
      const d = Math.min(w, h) * 0.15;
      return `<path d="M${x},${y + d} H${x + w - d} V${y + h} H${x} Z M${x},${y + d} L${x + d},${y} H${x + w} V${y + h - d} L${x + w - d},${y + h} M${x + w - d},${y + d} L${x + w},${y}"`;
    }
    case 'component': return `<path d="M${x + w * 0.1},${y} H${x + w} V${y + h} H${x + w * 0.1} Z M${x},${y + h * 0.22} H${x + w * 0.2} V${y + h * 0.38} H${x} Z M${x},${y + h * 0.62} H${x + w * 0.2} V${y + h * 0.78} H${x} Z"`;
    case 'browser': {
      const r = Math.max(1.5, Math.min(w, h) * 0.03), by = y + h * 0.075;
      const dot = (cx) => `M${cx - r},${by} A${r},${r} 0 1 0 ${cx + r},${by} A${r},${r} 0 1 0 ${cx - r},${by} Z`;
      return `<path d="M${x},${y} H${x + w} V${y + h} H${x} Z M${x},${y + h * 0.15} H${x + w} ${dot(x + w * 0.05)} ${dot(x + w * 0.1)} ${dot(x + w * 0.15)}"`;
    }
    case 'laptop': return `<path d="M${x + w * 0.1},${y} H${x + w * 0.9} V${y + h * 0.82} H${x + w * 0.1} Z M${x},${y + h * 0.86} H${x + w} L${x + w * 0.95},${y + h} H${x + w * 0.05} Z"`;
    case 'firewall': return `<path d="M${x},${y} H${x + w} V${y + h} H${x} Z M${x},${y + h / 3} H${x + w} M${x},${y + (h * 2) / 3} H${x + w} M${x + w / 2},${y} V${y + h / 3} M${x + w / 4},${y + h / 3} V${y + (h * 2) / 3} M${x + (w * 3) / 4},${y + h / 3} V${y + (h * 2) / 3} M${x + w / 2},${y + (h * 2) / 3} V${y + h}"`;
    default: return `<rect x="${x}" y="${y}" width="${w}" height="${h}"`;
  }
}

export function shapeTextBox(kind, x, y, w, h, pad = 10) {
  let ix = 0, iy = 0, iw = 1, ih = 1;
  switch (kind) {
    case 'ellipse': case 'cloud': ix = 0.15; iy = 0.15; iw = 0.7; ih = 0.7; break;
    case 'diamond': ix = 0.22; iy = 0.22; iw = 0.56; ih = 0.56; break;
    case 'triangle': ix = 0.25; iy = 0.45; iw = 0.5; ih = 0.5; break;
    case 'hexagon': ix = 0.15; iw = 0.7; break;
    case 'parallelogram': case 'trapezoid': ix = 0.18; iw = 0.64; break;
    case 'star': ix = 0.3; iy = 0.35; iw = 0.4; ih = 0.4; break;
    case 'arrow': iy = 0.25; ih = 0.5; iw = 0.8; break;
    case 'callout': ih = 0.8; break;
    case 'cross': ix = 0.3; iy = 0.3; iw = 0.4; ih = 0.4; break;
    case 'cylinder': iy = 0.18; ih = 0.78; break;
    case 'document': ih = 0.85; break;
    case 'subprocess': ix = 0.08; iw = 0.84; break;
    case 'delay': iw = 0.85; break;
    case 'note': iw = 0.85; break;
    case 'package': iy = 0.18; ih = 0.82; break;
    case 'actor': iy = 0.74; ih = 0.26; ix = -0.1; iw = 1.2; pad = 2; break;
    case 'server': ix = 0.04; iw = 0.76; iy = 1 / 3; ih = 1 / 3; pad = 4; break;
    case 'queue': ix = 0.1; iw = 0.66; break;
    case 'container': iy = 0.15; ih = 0.85; iw = 0.85; break;
    case 'component': ix = 0.2; iw = 0.8; break;
    case 'browser': iy = 0.15; ih = 0.85; break;
    case 'laptop': ix = 0.1; iw = 0.8; ih = 0.82; break;
    case 'firewall': iy = 1 / 3; ih = 1 / 3; pad = 4; break;
  }
  return { x: x + w * ix + pad, y: y + h * iy + pad, w: Math.max(4, w * iw - pad * 2), h: Math.max(4, h * ih - pad * 2) };
}

/* ---------------- Verbindungen ---------------- */

/* ---------------- Absicherung ---------------- */

// Elemente stammen von anderen Teilnehmenden oder aus Importen. Alles, was in SVG-Attribute geschrieben wird,
// muss eine echte Zahl bzw. eine gültige Farbe sein – sonst könnte Markup eingeschleust werden.
const COLOR_RE = /^(#[0-9a-f]{3,8}|transparent|none|rgba?\(\s*[\d.]+%?\s*,\s*[\d.]+%?\s*,\s*[\d.]+%?\s*(,\s*[\d.]+%?\s*)?\))$/i;
const fin = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const SHAPE_KEYS = new Set(SHAPES.map(([k]) => k));

export function safeEl(el) {
  const o = { ...el };
  for (const k of ['x', 'y', 'w', 'h', 'strokeWidth', 'rows', 'cols', 'opacity']) if (k in o) o[k] = fin(o[k]);
  if (o.fontSize != null && o.fontSize !== 'auto') o.fontSize = fin(o.fontSize) || 16;
  for (const k of ['fill', 'stroke', 'textColor', 'color', 'headerFill']) {
    if (!(k in o)) continue;
    if (typeof o[k] === 'string' && COLOR_RE.test(o[k].trim())) o[k] = o[k].trim();
    else delete o[k];
  }
  if (o.type === 'shape' && !SHAPE_KEYS.has(o.shape)) o.shape = 'rect';
  if (o.type === 'pen') o.points = Array.isArray(o.points) ? o.points.map((p) => [fin(p && p[0]), fin(p && p[1])]) : [];
  if (o.type === 'connector') {
    const anchor = (e) => (Number.isFinite(Number(e.ax)) && Number.isFinite(Number(e.ay)) ? { ax: Math.max(-1, Math.min(1, Number(e.ax))), ay: Math.max(-1, Math.min(1, Number(e.ay))) } : {});
    const end = (e) => (e && e.id ? { id: String(e.id), side: e.side, ...anchor(e) } : { x: fin(e && e.x), y: fin(e && e.y), side: e && e.side });
    o.from = end(o.from);
    o.to = end(o.to);
    o.waypoints = Array.isArray(o.waypoints) ? o.waypoints.slice(0, 100).map((p) => ({ x: fin(p && p.x), y: fin(p && p.y) })) : [];
  }
  if (o.type === 'table') {
    o.rows = Math.max(1, Math.min(200, Math.round(o.rows) || 1));
    o.cols = Math.max(1, Math.min(50, Math.round(o.cols) || 1));
  }
  return o;
}

export function elBounds(el, get) {
  if (el.type === 'connector') {
    const g = connectorGeom(el, get);
    return g ? g.bbox : { x: 0, y: 0, w: 0, h: 0 };
  }
  if (el.type === 'comment') return { x: fin(el.x), y: fin(el.y) - 30, w: 30, h: 30 };
  return { x: fin(el.x), y: fin(el.y), w: fin(el.w), h: fin(el.h) };
}

// Verbindungen, deren Ziel nicht (mehr) existiert, haben keine Geometrie
export function isOrphan(el, get) {
  return el.type === 'connector' && !connectorGeom(el, get);
}

const SIDE_VEC = { top: [0, -1], bottom: [0, 1], left: [-1, 0], right: [1, 0] };

export function sidePoint(b, side) {
  switch (side) {
    case 'top': return { x: b.x + b.w / 2, y: b.y };
    case 'bottom': return { x: b.x + b.w / 2, y: b.y + b.h };
    case 'left': return { x: b.x, y: b.y + b.h / 2 };
    default: return { x: b.x + b.w, y: b.y + b.h / 2 };
  }
}

function autoSide(b, toward) {
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
  const dx = (toward.x - cx) / Math.max(b.w, 1), dy = (toward.y - cy) / Math.max(b.h, 1);
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left';
  return dy > 0 ? 'bottom' : 'top';
}

// Schnittpunkt eines Strahls von der Mitte in Richtung (ax, ay) – normiert auf die halbe Breite/Höhe – mit dem Umriss
const ROUND_SHAPES = new Set(['ellipse', 'cloud']);

// Umrisse vieleckiger Formen in normierten Koordinaten (−1 … 1), passend zu shapeGeom()
const STAR = Array.from({ length: 10 }, (_, i) => {
  const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 0.4 : 1;
  return [Math.cos(a) * r, Math.sin(a) * r + 0.1];
});
const POLYGONS = {
  diamond: [[0, -1], [1, 0], [0, 1], [-1, 0]],
  triangle: [[0, -1], [1, 1], [-1, 1]],
  hexagon: [[-0.5, -1], [0.5, -1], [1, 0], [0.5, 1], [-0.5, 1], [-1, 0]],
  parallelogram: [[-0.6, -1], [1, -1], [0.6, 1], [-1, 1]],
  trapezoid: [[-0.6, -1], [0.6, -1], [1, 1], [-1, 1]],
  arrow: [[-1, -0.5], [0.2, -0.5], [0.2, -1], [1, 0], [0.2, 1], [0.2, 0.5], [-1, 0.5]],
  cross: [[-0.4, -1], [0.4, -1], [0.4, -0.4], [1, -0.4], [1, 0.4], [0.4, 0.4], [0.4, 1], [-0.4, 1], [-0.4, 0.4], [-1, 0.4], [-1, -0.4], [-0.4, -0.4]],
  star: STAR,
};

// Abstand k entlang des Strahls (0,0) + k·(dx,dy) bis zum ersten Schnitt mit dem Vieleck
function rayPolygon(poly, dx, dy) {
  let best = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i], [x2, y2] = poly[(i + 1) % poly.length];
    const ex = x2 - x1, ey = y2 - y1;
    const den = dx * ey - dy * ex;
    if (Math.abs(den) < 1e-12) continue;
    const k = (x1 * ey - y1 * ex) / den;
    const u = (x1 * dy - y1 * dx) / den;
    if (k > 1e-9 && u >= -1e-9 && u <= 1 + 1e-9 && k < best) best = k;
  }
  return Number.isFinite(best) ? best : 1;
}

// Punkt auf dem tatsächlichen Umriss in Richtung (ax, ay) von der Mitte aus
export function outlinePoint(t, ax, ay) {
  if (!ax && !ay) return { x: t.x + t.w / 2, y: t.y + t.h / 2 };
  let k;
  if (Object.hasOwn(POLYGONS, t.shape)) k = rayPolygon(POLYGONS[t.shape], ax, ay);
  else if (ROUND_SHAPES.has(t.shape)) k = 1 / (Math.hypot(ax, ay) || 1);
  else k = 1 / (Math.max(Math.abs(ax), Math.abs(ay)) || 1);
  return { x: t.x + t.w / 2 + (ax * k * t.w) / 2, y: t.y + t.h / 2 + (ay * k * t.h) / 2 };
}

// Mitte einer Seite – auf dem tatsächlichen Umriss (bei Dreiecken z. B. auf der Schräge)
export function sideAnchor(t, side) {
  const v = SIDE_VEC[side];
  return outlinePoint(t, v[0], v[1]);
}

// Seite, in deren Richtung ein Andockpunkt zeigt (bestimmt die Austrittsrichtung bei Kurven und Winkeln)
export function anchorSide(ax, ay) {
  if (Math.abs(ax) >= Math.abs(ay)) return ax >= 0 ? 'right' : 'left';
  return ay >= 0 ? 'bottom' : 'top';
}

function endTarget(end, get) {
  if (end && end.id) {
    const t = get(end.id);
    if (t && t.type !== 'connector') return { x: fin(t.x), y: fin(t.y), w: fin(t.w), h: fin(t.h), shape: t.type === 'shape' ? t.shape : t.type === 'sticky' ? 'rect' : t.type };
  }
  return null;
}

const hasAnchor = (end) => end && Number.isFinite(end.ax) && Number.isFinite(end.ay);

// Lage eines angedockten Endes: fester Punkt auf dem Umriss, feste Seitenmitte oder automatisch (zur Gegenseite)
function attach(end, t, toward) {
  if (hasAnchor(end)) return { p: outlinePoint(t, end.ax, end.ay), s: anchorSide(end.ax, end.ay), fixed: true };
  if (SIDE_VEC[end.side]) return { p: sideAnchor(t, end.side), s: end.side, fixed: true };
  const s = autoSide(t, toward);
  return { p: sideAnchor(t, s), s, fixed: false };
}

function centerOf(end, get) {
  const t = endTarget(end, get);
  if (t) return { x: t.x + t.w / 2, y: t.y + t.h / 2 };
  return { x: fin(end?.x), y: fin(end?.y) };
}

function freeSide(from, to) {
  const dx = to.x - from.x, dy = to.y - from.y;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left';
  return dy > 0 ? 'bottom' : 'top';
}

export function waypointsOf(el) {
  return Array.isArray(el.waypoints) ? el.waypoints.filter((p) => p && Number.isFinite(p.x) && Number.isFinite(p.y)) : [];
}

export function connectorGeom(el, get) {
  const t1 = endTarget(el.from, get), t2 = endTarget(el.to, get);
  // Verbindung zu einem gelöschten Element
  if ((el.from && el.from.id && !t1) || (el.to && el.to.id && !t2)) return null;
  const wps = waypointsOf(el);
  const c1 = centerOf(el.from, get), c2 = centerOf(el.to, get);
  // Automatische Seiten richten sich nach dem nächsten Knickpunkt bzw. dem anderen Ende
  const toward1 = wps[0] || c2, toward2 = wps[wps.length - 1] || c1;
  let a1 = t1 ? attach(el.from, t1, toward1) : null;
  let a2 = t2 ? attach(el.to, t2, a1 && !wps.length ? a1.p : toward2) : null;
  if (a1 && !a1.fixed && a2 && !wps.length) a1 = attach(el.from, t1, a2.p);
  const p1 = a1 ? a1.p : c1, p2 = a2 ? a2.p : c2;
  const s1 = a1 ? a1.s : freeSide(p1, wps[0] || p2);
  const s2 = a2 ? a2.s : freeSide(p2, wps[wps.length - 1] || p1);

  let d, pts, poly, startDir, endDir;
  const routing = el.routing || 'curve';
  if (routing === 'straight') {
    pts = [p1, ...wps, p2];
    poly = pts;
    d = 'M' + pts.map((p) => `${r1(p.x)},${r1(p.y)}`).join(' L');
  } else if (routing === 'elbow') {
    pts = elbowRoute(p1, s1, wps, p2, s2);
    poly = pts;
    d = 'M' + pts.map((p) => `${r1(p.x)},${r1(p.y)}`).join(' L');
  } else {
    // Kurve durch alle Knickpunkte (Catmull-Rom), Enden treten senkrecht aus der Andockseite aus
    const keys = [p1, ...wps, p2];
    const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    const k = Math.max(30, (wps.length ? Math.hypot(keys[1].x - p1.x, keys[1].y - p1.y) : dist) * 0.4);
    const k2 = Math.max(30, (wps.length ? Math.hypot(p2.x - keys[keys.length - 2].x, p2.y - keys[keys.length - 2].y) : dist) * 0.4);
    const v1 = SIDE_VEC[s1], v2 = SIDE_VEC[s2];
    const segs = [];
    for (let i = 0; i < keys.length - 1; i++) {
      const a = keys[i], b = keys[i + 1];
      let cpa, cpb;
      if (i === 0) cpa = { x: a.x + v1[0] * k, y: a.y + v1[1] * k };
      else {
        const prev = keys[i - 1];
        cpa = { x: a.x + (b.x - prev.x) / 6, y: a.y + (b.y - prev.y) / 6 };
      }
      if (i === keys.length - 2) cpb = { x: b.x + v2[0] * k2, y: b.y + v2[1] * k2 };
      else {
        const next = keys[i + 2];
        cpb = { x: b.x - (next.x - a.x) / 6, y: b.y - (next.y - a.y) / 6 };
      }
      segs.push([a, cpa, cpb, b]);
    }
    d = `M${r1(p1.x)},${r1(p1.y)}` + segs.map(([, ca, cb, b]) => ` C${r1(ca.x)},${r1(ca.y)} ${r1(cb.x)},${r1(cb.y)} ${r1(b.x)},${r1(b.y)}`).join('');
    pts = [p1, ...segs.flatMap(([, ca, cb, b]) => [ca, cb, b])];
    poly = [p1];
    for (const [a, ca, cb, b] of segs) {
      for (let i = 1; i <= 16; i++) {
        const t = i / 16, mt = 1 - t;
        poly.push({
          x: mt ** 3 * a.x + 3 * mt * mt * t * ca.x + 3 * mt * t * t * cb.x + t ** 3 * b.x,
          y: mt ** 3 * a.y + 3 * mt * mt * t * ca.y + 3 * mt * t * t * cb.y + t ** 3 * b.y,
        });
      }
    }
    const first = segs[0], last = segs[segs.length - 1];
    startDir = [p1.x - first[1].x, p1.y - first[1].y];
    endDir = [p2.x - last[2].x, p2.y - last[2].y];
  }
  const n = pts.length;
  if (!startDir) startDir = [pts[0].x - pts[1].x, pts[0].y - pts[1].y];
  if (!endDir) endDir = [pts[n - 1].x - pts[n - 2].x, pts[n - 1].y - pts[n - 2].y];
  const lp = Number.isFinite(Number(el.labelPos)) ? Math.min(0.98, Math.max(0.02, Number(el.labelPos))) : 0.5;
  const mid = pointAlong(poly, lp);
  const bbox = unionRect([...pts, ...poly].map((p) => ({ x: p.x, y: p.y, w: 0, h: 0 })));
  return { p1, p2, s1, s2, d, startDir, endDir, mid, bbox, poly, keys: [p1, ...wps, p2] };
}

// Rechtwinklige Führung: verläuft durch alle Knickpunkte und tritt senkrecht aus den Andockseiten aus
function elbowRoute(p1, s1, wps, p2, s2) {
  if (!wps.length) return elbowPoints(p1, s1, p2, s2);
  const off = 24;
  const a = { x: p1.x + SIDE_VEC[s1][0] * off, y: p1.y + SIDE_VEC[s1][1] * off };
  const b = { x: p2.x + SIDE_VEC[s2][0] * off, y: p2.y + SIDE_VEC[s2][1] * off };
  const pts = [p1, a];
  let horiz = s1 === 'left' || s1 === 'right';
  const chain = [...wps, b];
  for (let i = 0; i < chain.length; i++) {
    const prev = pts[pts.length - 1], q = chain[i];
    const last = i === chain.length - 1;
    // letzter Abschnitt: so abbiegen, dass das Ende in Richtung der Zielseite verläuft
    if (last) horiz = !(s2 === 'left' || s2 === 'right');
    pts.push(horiz ? { x: q.x, y: prev.y } : { x: prev.x, y: q.y });
    pts.push(q);
    horiz = !horiz;
  }
  pts.push(p2);
  return pts.filter((p, i) => i === 0 || Math.abs(p.x - pts[i - 1].x) > 0.1 || Math.abs(p.y - pts[i - 1].y) > 0.1);
}

function elbowPoints(p1, s1, p2, s2) {
  const off = 24;
  const a = { x: p1.x + SIDE_VEC[s1][0] * off, y: p1.y + SIDE_VEC[s1][1] * off };
  const b = { x: p2.x + SIDE_VEC[s2][0] * off, y: p2.y + SIDE_VEC[s2][1] * off };
  const h1 = s1 === 'left' || s1 === 'right';
  const h2 = s2 === 'left' || s2 === 'right';
  let middle;
  if (h1 && h2) {
    const mx = (a.x + b.x) / 2;
    middle = [{ x: mx, y: a.y }, { x: mx, y: b.y }];
  } else if (!h1 && !h2) {
    const my = (a.y + b.y) / 2;
    middle = [{ x: a.x, y: my }, { x: b.x, y: my }];
  } else if (h1) middle = [{ x: b.x, y: a.y }];
  else middle = [{ x: a.x, y: b.y }];
  const pts = [p1, a, ...middle, b, p2];
  return pts.filter((p, i) => i === 0 || Math.abs(p.x - pts[i - 1].x) > 0.1 || Math.abs(p.y - pts[i - 1].y) > 0.1);
}

// Punkt bei Anteil t (0…1) der Länge eines Linienzugs
export function pointAlong(pts, t) {
  let total = 0;
  for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  let rest = total * t;
  for (let i = 1; i < pts.length; i++) {
    const seg = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    if (rest <= seg && seg > 0) {
      const k = rest / seg;
      return { x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * k, y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * k };
    }
    rest -= seg;
  }
  return pts[pts.length - 1] || { x: 0, y: 0 };
}

// Anteil (0…1) der Länge, an dem ein Punkt am nächsten am Linienzug liegt
export function projectOnPath(pts, p) {
  let total = 0, best = Infinity, bestAt = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    const dx = b.x - a.x, dy = b.y - a.y, len2 = dx * dx + dy * dy, len = Math.sqrt(len2);
    const k = len2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2)) : 0;
    const dd = Math.hypot(a.x + dx * k - p.x, a.y + dy * k - p.y);
    if (dd < best) {
      best = dd;
      bestAt = total + len * k;
    }
    total += len;
  }
  return { t: total ? bestAt / total : 0.5, dist: best };
}

/* ---------------- Linienenden ---------------- */

export const ARROW_HEADS = [
  ['none', 'Ohne'], ['arrow', 'Pfeil'], ['open', 'Pfeil offen'], ['triangle', 'Dreieck hohl'], ['diamond', 'Raute'],
  ['diamondFilled', 'Raute gefüllt'], ['circle', 'Kreis'], ['bar', 'Querstrich'], ['crow', 'Krähenfuß (n)'],
];
const HEAD_KEYS = new Set(ARROW_HEADS.map(([k]) => k));

// Ältere Boards speichern true/false
export function headType(v, def) {
  if (v === true) return 'arrow';
  if (v === false) return 'none';
  if (v == null) return def;
  return HEAD_KEYS.has(v) ? v : def;
}

function arrowHead(kind, tip, dir, size, color, bg, sw) {
  const len = Math.hypot(dir[0], dir[1]) || 1;
  const ux = dir[0] / len, uy = dir[1] / len;
  const px = -uy, py = ux;
  const P = (along, side) => `${r1(tip.x - ux * along + px * side)},${r1(tip.y - uy * along + py * side)}`;
  const w = size * 0.55;
  switch (kind) {
    case 'arrow': return `<polygon points="${P(0, 0)} ${P(size, w)} ${P(size, -w)}" fill="${color}"/>`;
    case 'open': return `<polyline points="${P(size, w)} ${P(0, 0)} ${P(size, -w)}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>`;
    case 'triangle': return `<polygon points="${P(0, 0)} ${P(size, w)} ${P(size, -w)}" fill="${bg}" stroke="${color}" stroke-width="${sw}" stroke-linejoin="round"/>`;
    case 'diamond': case 'diamondFilled':
      return `<polygon points="${P(0, 0)} ${P(size * 0.8, w * 0.8)} ${P(size * 1.6, 0)} ${P(size * 0.8, -w * 0.8)}" fill="${kind === 'diamond' ? bg : color}" stroke="${color}" stroke-width="${sw}" stroke-linejoin="round"/>`;
    case 'circle': {
      const r = size * 0.4;
      return `<circle cx="${r1(tip.x - ux * r)}" cy="${r1(tip.y - uy * r)}" r="${r1(r)}" fill="${bg}" stroke="${color}" stroke-width="${sw}"/>`;
    }
    case 'bar': return `<polyline points="${P(size * 0.6, w)} ${P(size * 0.6, -w)}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round"/>`;
    case 'crow': return `<polyline points="${P(0, w)} ${P(size, 0)} ${P(0, -w)}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/><polyline points="${P(size * 1.25, w)} ${P(size * 1.25, -w)}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round"/>`;
  }
  return '';
}

/* ---------------- Elemente ---------------- */

export function penPath(points) {
  if (!points || !points.length) return '';
  if (points.length === 1) return `M${points[0][0]},${points[0][1]} l0.01,0`;
  let d = `M${r1(points[0][0])},${r1(points[0][1])}`;
  for (let i = 1; i < points.length - 1; i++) {
    const mx = (points[i][0] + points[i + 1][0]) / 2, my = (points[i][1] + points[i + 1][1]) / 2;
    d += ` Q${r1(points[i][0])},${r1(points[i][1])} ${r1(mx)},${r1(my)}`;
  }
  const l = points[points.length - 1];
  return d + ` L${r1(l[0])},${r1(l[1])}`;
}

const dashFor = (el) => (el.dash === 'dotted' ? `${el.strokeWidth || 2} ${(el.strokeWidth || 2) * 2}` : el.dash ? `${(el.strokeWidth || 2) * 4} ${(el.strokeWidth || 2) * 3}` : '');

const LINKABLE = new Set(['sticky', 'shape', 'text', 'card', 'image', 'emoji', 'frame', 'code']);

export function safeLink(url) {
  const u = String(url || '').trim();
  if (!u) return '';
  if (/^(https?:|mailto:)/i.test(u)) return u;
  if (/^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(u)) return 'https://' + u;
  return '';
}

function linkBadge(el) {
  const href = safeLink(el.link);
  if (!href || !LINKABLE.has(el.type)) return '';
  const s = el.type === 'frame' ? 24 : Math.max(16, Math.min(28, Math.min(el.w, el.h) * 0.14));
  const cx = el.type === 'frame' ? el.x + el.w - s : el.x + el.w - s * 0.75, cy = el.type === 'frame' ? el.y - s : el.y + s * 0.75;
  const k = s / 24;
  return `<g class="link-badge" data-link="${esc(href)}"><title>${esc(href)}</title><circle cx="${cx}" cy="${cy}" r="${s / 2}" fill="#4262ff"/>` +
    `<g transform="translate(${cx - 12 * k * 0.6},${cy - 12 * k * 0.6}) scale(${k * 0.6})" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/></g></g>`;
}

export function renderElement(el, env = {}) {
  el = safeEl(el);
  // Privater Modus: fremde private Elemente kommen ohne Inhalt vom Server (hidden); eigene werden in
  // Vorschaubildern und Exporten ebenfalls verdeckt
  if (el.hidden || (el.priv && env.redactPrivate)) return hiddenMarkup(el);
  const own = el.priv ? privateBadge(el) : '';
  return renderBody(el, env) + (el.link ? linkBadge(el) : '') + own;
}

function hiddenMarkup(el) {
  const { x = 0, y = 0, w = 0, h = 0 } = el;
  const fill = el.fill && el.fill !== 'transparent' ? el.fill : el.color || '#dee2e6';
  const fs = Math.max(10, Math.min(28, Math.min(w, h) * 0.1));
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="${fill}" fill-opacity="0.55" stroke="#868e96" stroke-width="1.5" stroke-dasharray="6 4"/>` +
    `<text x="${x + w / 2}" y="${y + h / 2}" font-family="${esc(FONT)}" font-size="${fs * 1.4}" text-anchor="middle">🔒</text>` +
    `<text x="${x + w / 2}" y="${y + h / 2 + fs * 1.4}" font-family="${esc(FONT)}" font-size="${fs * 0.75}" text-anchor="middle" fill="#495057">${esc(el.privName ? 'Privat · ' + el.privName : 'Privat')}</text>`;
}

function privateBadge(el) {
  const s = Math.max(14, Math.min(24, Math.min(el.w, el.h) * 0.12));
  return `<g><title>Privat – nur für dich sichtbar, bis der private Modus beendet wird</title><circle cx="${el.x + s * 0.2}" cy="${el.y + s * 0.2}" r="${s / 2 + 2}" fill="#212529"/><text x="${el.x + s * 0.2}" y="${el.y + s * 0.2 + s * 0.3}" font-size="${s * 0.75}" text-anchor="middle">🔒</text></g>`;
}

// Höhe eines Code-Blocks aus der Zeilenzahl
export function codeMetrics(el) {
  const fs = Number(el.fontSize) || 14;
  const lines = Math.min(MAX_LINES, String(el.text || '').split('\n').length);
  const gutter = el.lineNumbers === false ? 0 : String(lines).length * fs * 0.62 + 18;
  return { fs, lh: fs * LH, head: 30, pad: 12, gutter, lines };
}

function renderBody(el, env) {
  const get = env.get || (() => null);
  const { x = 0, y = 0, w = 0, h = 0 } = el;
  switch (el.type) {
    case 'sticky': {
      const pad = Math.max(8, Math.min(w, h) * 0.08);
      const box = { x: x + pad, y: y + pad, w: w - pad * 2, h: h - pad * 2 };
      const lay = textLayout(el, box);
      const author = env.showAuthor && el.author ? `<text x="${x + w - 8}" y="${y + h - 7}" font-family="${esc(FONT)}" font-size="${Math.max(8, Math.min(w, h) * 0.055)}" fill="${contrastText(el.fill)}" fill-opacity="0.55" text-anchor="end">${esc(el.author)}</text>` : '';
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${el.fill || '#fff9b1'}" filter="url(#shadow)"/>` +
        textSvg(box, lay, { color: el.textColor || contrastText(el.fill), align: el.align || 'center', valign: el.valign || 'middle' }) + author;
    }
    case 'shape': {
      const fill = el.fill || 'transparent';
      const stroke = el.stroke || 'none';
      const sw = el.strokeWidth ?? 2;
      const dash = dashFor(el);
      const geo = shapeGeom(el.shape || 'rect', x, y, w, h);
      const box = shapeTextBox(el.shape, x, y, w, h);
      const lay = textLayout(el, box);
      // 'none' = ohne Füllung und innen durchklickbar (z. B. Rahmen von Blöcken im Sequenzdiagramm)
      return `${geo} fill="${fill === 'transparent' ? 'rgba(255,255,255,0.001)' : fill}" stroke="${stroke}" stroke-width="${sw}"${dash ? ` stroke-dasharray="${dash}"` : ''} stroke-linejoin="round"/>` +
        textSvg(box, lay, { color: el.textColor || contrastText(fill === 'transparent' || fill === 'none' ? '#ffffff' : fill), align: el.align || 'center', valign: el.valign || 'middle' });
    }
    case 'text': {
      const pad = 4;
      const box = { x: x + pad, y: y + pad, w: w - pad * 2, h: h - pad * 2 };
      const lay = textLayout(el, box);
      const bg = el.fill && el.fill !== 'transparent' ? `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${el.fill}" rx="4"/>` : `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="transparent" class="hit"/>`;
      const ph = !el.text && env.placeholders ? `<text x="${x + pad}" y="${y + pad + lay.size}" font-family="${esc(FONT)}" font-size="${lay.size}" fill="#999">Text</text>` : '';
      return bg + textSvg(box, lay, { color: el.color || '#1a1a1a', align: el.align || 'left', valign: 'top' }) + ph;
    }
    case 'frame': {
      const ts = Math.max(14, Math.min(48, Math.min(w, h) / 45));
      const title = el.title || 'Frame';
      const tw = measure(title, ts, true) + 8;
      return `<rect class="frame-body" x="${x}" y="${y}" width="${w}" height="${h}" fill="${el.fill || '#ffffff'}" stroke="${el.stroke || '#d6d6d6'}" stroke-width="1"/>` +
        `<rect class="frame-title" x="${x}" y="${y - ts * 1.6}" width="${tw}" height="${ts * 1.5}" fill="transparent"/>` +
        `<text class="frame-title-text" x="${x + 2}" y="${y - ts * 0.5}" font-family="${esc(FONT)}" font-size="${ts}" font-weight="bold" fill="#6b6b6b">${esc(title)}</text>`;
    }
    case 'connector': {
      const g = connectorGeom(el, get);
      if (!g) return '';
      const color = el.stroke || '#1a1a1a';
      const sw = el.strokeWidth || 2;
      const dash = dashFor(el);
      const ah = 7 + sw * 2.2;
      const bg = env.labelBg || '#ffffff';
      let out = `<path class="hit" d="${g.d}" fill="none" stroke="transparent" stroke-width="${Math.max(14, sw + 10)}"/>`;
      out += `<path d="${g.d}" fill="none" stroke="${color}" stroke-width="${sw}"${dash ? ` stroke-dasharray="${dash}"` : ''} stroke-linecap="round" stroke-linejoin="round"/>`;
      out += arrowHead(headType(el.arrowEnd, 'arrow'), g.p2, g.endDir, ah, color, bg, sw);
      out += arrowHead(headType(el.arrowStart, 'none'), g.p1, g.startDir, ah, color, bg, sw);
      if (el.label) {
        const fs = el.fontSize || 14;
        const lines = String(el.label).split('\n');
        const lw = Math.max(...lines.map((l) => measure(l, fs))) + 12;
        const lh = lines.length * fs * LH + 6;
        out += `<g class="conn-label"><rect x="${r1(g.mid.x - lw / 2)}" y="${r1(g.mid.y - lh / 2)}" width="${r1(lw)}" height="${r1(lh)}" rx="4" fill="${bg}"/>`;
        out += textSvg({ x: g.mid.x - lw / 2, y: g.mid.y - lh / 2, w: lw, h: lh }, { size: fs, lines, bold: false, italic: false }, { color }) + '</g>';
      }
      return out;
    }
    case 'pen': {
      const d = penPath(el.points);
      return `<g transform="translate(${r1(x)},${r1(y)})"><path class="hit" d="${d}" fill="none" stroke="transparent" stroke-width="${Math.max(12, (el.strokeWidth || 3) + 8)}" stroke-linecap="round"/>` +
        `<path d="${d}" fill="none" stroke="${el.stroke || '#1a1a1a'}" stroke-width="${el.strokeWidth || 3}" stroke-linecap="round" stroke-linejoin="round"${el.opacity && el.opacity < 1 ? ` stroke-opacity="${el.opacity}"` : ''}/></g>`;
    }
    case 'image': {
      if (!el.src) return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#eee" stroke="#ccc"/>`;
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#fff"/><image href="${esc(el.src)}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice"/>`;
    }
    case 'emoji': {
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="transparent" class="hit"/><text x="${x + w / 2}" y="${y + h * 0.86}" font-size="${h * 0.9}" text-anchor="middle">${esc(el.char || '⭐')}</text>`;
    }
    case 'code': {
      const th = THEMES[el.theme === 'light' ? 'light' : 'dark'];
      const m = codeMetrics(el);
      const cid = 'cc-' + String(el.id).replace(/[^\w-]/g, '');
      let out = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="${th.bg}" filter="url(#shadow-sm)"/>`;
      out += `<path d="M${x + 8},${y} H${x + w - 8} Q${x + w},${y} ${x + w},${y + 8} V${y + m.head} H${x} V${y + 8} Q${x},${y} ${x + 8},${y} Z" fill="${th.head}"/>`;
      ['#ff5f57', '#febc2e', '#28c840'].forEach((c, i) => (out += `<circle cx="${x + 16 + i * 16}" cy="${y + m.head / 2}" r="5" fill="${c}"/>`));
      const label = String(el.title || own(LANG_LABEL, el.lang) || '');
      if (label) out += `<text x="${x + w - 12}" y="${y + m.head / 2 + 4}" font-family="${esc(FONT)}" font-size="12" text-anchor="end" fill="${th.gutter}">${esc(label)}</text>`;
      out += `<clipPath id="${cid}"><rect x="${x}" y="${y + m.head}" width="${Math.max(0, w - 10)}" height="${Math.max(0, h - m.head)}"/></clipPath><g clip-path="url(#${cid})">`;
      const by = y + m.head + m.pad;
      const base = m.fs * ((LH - 1) / 2 + 0.8);
      const rows = tokenize(el.text, el.lang || 'plain');
      let txt = '', nums = '';
      rows.forEach((toks, i) => {
        const ly = r1(by + i * m.lh + base);
        if (m.gutter) nums += `<tspan x="${r1(x + m.gutter - 8)}" y="${ly}">${i + 1}</tspan>`;
        if (!toks.length) return;
        txt += `<tspan x="${r1(x + m.gutter + m.pad)}" y="${ly}">` + toks.map((t) => `<tspan fill="${th[t.k] || th.text}">${esc(t.t)}</tspan>`).join('') + '</tspan>';
      });
      if (m.gutter) out += `<text font-family="${esc(MONO)}" font-size="${m.fs}" fill="${th.gutter}" text-anchor="end">${nums}</text>`;
      if (!el.text && env.placeholders) txt = `<tspan x="${x + m.gutter + m.pad}" y="${r1(by + base)}" fill="${th.gutter}">Code hier einfügen …</tspan>`;
      out += `<text class="code-text" font-family="${esc(MONO)}" font-size="${m.fs}" fill="${th.text}" xml:space="preserve">${txt}</text></g>`;
      return out;
    }
    case 'card': {
      const color = el.color || '#4262ff';
      const pad = 14;
      let out = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="#ffffff" stroke="#e3e3e3" filter="url(#shadow-sm)"/>`;
      out += `<path d="M${x + 8},${y} H${x + w - 8} Q${x + w},${y} ${x + w},${y + 8} V${y + 6} H${x} V${y + 8} Q${x},${y} ${x + 8},${y} Z" fill="${color}"/>`;
      let top = y + 16;
      if (el.key) {
        out += `<text x="${x + pad}" y="${top + 10}" font-family="${esc(FONT)}" font-size="11" font-weight="bold" fill="#868e96">${esc(String(el.key).slice(0, 40))}</text>`;
        top += 16;
      }
      const tags = cardTags(el);
      const footer = 28 + (tags.length ? 24 : 0);
      const tlay = { size: 15, bold: true, italic: false, lines: wrap(el.title || 'Neue Karte', w - pad * 2, 15, true).slice(0, 3) };
      out += textSvg({ x: x + pad, y: top, w: w - pad * 2, h: 60 }, tlay, { align: 'left', valign: 'top', color: '#1a1a1a' });
      const ty = top + tlay.lines.length * 15 * LH + 6;
      if (el.description) {
        const maxL = Math.max(0, Math.floor((y + h - footer - 12 - ty) / (13 * LH)));
        const dl = wrap(el.description, w - pad * 2, 13).slice(0, maxL);
        out += textSvg({ x: x + pad, y: ty, w: w - pad * 2, h: 200 }, { size: 13, lines: dl }, { align: 'left', valign: 'top', color: '#666666' });
      }
      const fy = y + h - 28;
      if (tags.length) {
        let tx = x + pad;
        for (const t of tags) {
          const tw = measure(t, 10) + 12;
          if (tx + tw > x + w - pad) break;
          out += `<rect x="${tx}" y="${fy - 23}" width="${tw}" height="16" rx="4" fill="#f1f3f5" stroke="#dee2e6"/><text x="${tx + 6}" y="${fy - 11.5}" font-family="${esc(FONT)}" font-size="10" fill="#495057">${esc(t)}</text>`;
          tx += tw + 5;
        }
      }
      // Fußzeile: links Status, Priorität, Punkte – nur so viel, wie neben Datum und Avatar (rechts) passt
      let fx = x + pad;
      const dueW = el.due ? measure('📅 00.00.', 12) + 6 : 0;
      const right = x + w - pad - (el.assignee ? 28 : 0) - dueW;
      const chip = (label, bold, minW = 0) => Math.max(minW, measure(label, 11, bold) + 14);
      const pt = el.points !== undefined && el.points !== null && el.points !== '' ? String(el.points).slice(0, 5) : '';
      const prio = own(PRIORITIES, el.priority);
      const ptW = pt ? chip(pt, true, 20) + 6 : 0;
      const prW = prio ? chip(prio.icon + ' ' + prio.label, true) + 6 : 0;
      if (el.status) {
        const maxW = Math.max(0, right - fx - ptW - prW - 6);
        let label = String(el.status);
        while (label.length > 1 && chip(label, true) > maxW) label = label.slice(0, -2) + '…';
        if (chip(label, true) <= maxW) {
          const sw = chip(label, true);
          out += `<rect x="${fx}" y="${fy}" width="${sw}" height="18" rx="9" fill="${color}" fill-opacity="0.15"/><text x="${fx + 7}" y="${fy + 13}" font-family="${esc(FONT)}" font-size="11" font-weight="bold" fill="${color}">${esc(label)}</text><title>${esc(el.status)}</title>`;
          fx += sw + 6;
        }
      }
      if (prio && fx + prW <= right) {
        const pw = prW - 6;
        out += `<rect x="${fx}" y="${fy}" width="${pw}" height="18" rx="9" fill="${prio.color}" fill-opacity="0.14"/><text x="${fx + 7}" y="${fy + 13}" font-family="${esc(FONT)}" font-size="11" font-weight="bold" fill="${prio.color}">${prio.icon} ${esc(prio.label)}</text>`;
        fx += prW;
      }
      if (pt && fx + ptW <= right + 6) {
        const pw = ptW - 6;
        out += `<rect x="${fx}" y="${fy}" width="${pw}" height="18" rx="9" fill="#495057"/><text x="${fx + pw / 2}" y="${fy + 13}" font-family="${esc(FONT)}" font-size="11" font-weight="bold" text-anchor="middle" fill="#ffffff">${esc(pt)}</text><title>Story Points / Schätzung</title>`;
      }
      if (el.due) {
        const ds = new Date(el.due + 'T00:00').toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
        const overdue = new Date(el.due + 'T23:59') < new Date();
        out += `<text x="${x + w - pad - (el.assignee ? 30 : 0)}" y="${fy + 13}" font-family="${esc(FONT)}" font-size="12" text-anchor="end" fill="${overdue ? '#e03131' : '#888888'}">📅 ${ds}</text>`;
      }
      if (el.assignee) {
        out += `<circle cx="${x + w - pad - 10}" cy="${fy + 9}" r="11" fill="${color}"/><text x="${x + w - pad - 10}" y="${fy + 13}" font-family="${esc(FONT)}" font-size="10" font-weight="bold" text-anchor="middle" fill="#fff">${esc(initials(el.assignee))}</text>`;
      }
      return out;
    }
    case 'table': {
      const rows = el.rows || 3, cols = el.cols || 3;
      const cw = w / cols, rh = h / rows;
      const fs = el.fontSize || 14;
      const hcolor = el.headerFill || '#eef1ff';
      let out = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${el.fill || '#ffffff'}" stroke="#b9b9b9"/>`;
      if (el.header !== false) out += `<rect x="${x}" y="${y}" width="${w}" height="${rh}" fill="${hcolor}"/>`;
      for (let r = 1; r < rows; r++) out += `<line x1="${x}" y1="${r1(y + r * rh)}" x2="${x + w}" y2="${r1(y + r * rh)}" stroke="#d0d0d0"/>`;
      for (let c = 1; c < cols; c++) out += `<line x1="${r1(x + c * cw)}" y1="${y}" x2="${r1(x + c * cw)}" y2="${y + h}" stroke="#d0d0d0"/>`;
      out += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="#b9b9b9"/>`;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const t = el.cells?.[r]?.[c];
          if (!t || (env.editingCell && env.editingCell[0] === r && env.editingCell[1] === c)) continue;
          const bold = el.header !== false && r === 0;
          const box = { x: x + c * cw + 8, y: y + r * rh + 6, w: cw - 16, h: rh - 12 };
          out += textSvg(box, { size: fs, bold, lines: wrap(t, box.w, fs, bold) }, { align: 'left', valign: 'middle', color: '#1a1a1a' });
        }
      }
      return out;
    }
    case 'comment': {
      const n = (el.thread || []).length;
      const s = 1 / (env.zoom || 1);
      const color = el.resolved ? '#9e9e9e' : el.color || '#4262ff';
      return `<g transform="translate(${x},${y}) scale(${s})"${el.resolved ? ' opacity="0.6"' : ''}>` +
        `<path d="M0,0 L0,-26 Q0,-36 10,-36 L26,-36 Q36,-36 36,-26 L36,-14 Q36,-4 26,-4 L8,-4 Z" fill="${color}" stroke="#fff" stroke-width="2" filter="url(#shadow-sm)"/>` +
        `<text x="18" y="-15" font-family="${esc(FONT)}" font-size="13" font-weight="bold" fill="#fff" text-anchor="middle">${n || '+'}</text></g>`;
    }
  }
  return '';
}

export const PRIORITIES = {
  critical: { label: 'Kritisch', color: '#e03131', icon: '⏫' },
  high: { label: 'Hoch', color: '#f08c00', icon: '▲' },
  medium: { label: 'Mittel', color: '#1971c2', icon: '■' },
  low: { label: 'Niedrig', color: '#868e96', icon: '▼' },
};

export const LANG_LABEL = {
  plain: '', js: 'JavaScript', python: 'Python', java: 'Java', csharp: 'C#', go: 'Go', php: 'PHP', sql: 'SQL', bash: 'Shell',
  json: 'JSON', yaml: 'YAML', html: 'HTML', css: 'CSS', dockerfile: 'Dockerfile',
};

export function cardTags(el) {
  const t = Array.isArray(el.tags) ? el.tags : String(el.tags || '').split(',');
  return t.map((x) => String(x).trim()).filter(Boolean).slice(0, 8);
}

/* Vollständiges SVG für eine Menge von Elementen (Vorschau, Export) */
export function renderSvgDocument(elements, { padding = 40, background = '#ffffff', width, height, bounds, redactPrivate = false } = {}) {
  const map = new Map(elements.map((e) => [e.id, e]));
  const get = (id) => map.get(id);
  const list = sortForRender(elements.filter((e) => e.type !== 'comment' && !isOrphan(e, get)));
  const b = (bounds && { x: fin(bounds.x), y: fin(bounds.y), w: fin(bounds.w), h: fin(bounds.h) }) ||
    unionRect(list.map((e) => elBounds(e, get))) || { x: 0, y: 0, w: 100, h: 100 };
  padding = fin(padding);
  const vb = { x: b.x - padding, y: b.y - padding, w: b.w + padding * 2, h: b.h + padding * 2 };
  // Rahmentitel ragen über den Frame hinaus
  if (!bounds && list.some((e) => e.type === 'frame')) {
    vb.y -= 40;
    vb.h += 40;
  }
  const body = list.map((e) => `<g>${renderElement(e, { get, redactPrivate })}</g>`).join('');
  return {
    svg: `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="${vb.x} ${vb.y} ${vb.w} ${vb.h}" width="${width || vb.w}" height="${height || vb.h}"><defs>${defsMarkup()}</defs>` +
      (background ? `<rect x="${vb.x}" y="${vb.y}" width="${vb.w}" height="${vb.h}" fill="${esc(background)}"/>` : '') + body + '</svg>',
    viewBox: vb,
  };
}

export function sortForRender(list) {
  const rank = (e) => (e.type === 'frame' ? 0 : e.type === 'comment' ? 2 : 1);
  return [...list].sort((a, b) => rank(a) - rank(b) || (a.z || 0) - (b.z || 0));
}
