// Darstellung der Board-Elemente als SVG-Markup (für Board, Vorschau & Export)
import { esc, FONT, wrap, fitText, measure, contrastText, initials, unionRect } from './util.js';

export const LH = 1.25;

export const SHAPES = [
  ['rect', 'Rechteck'], ['roundrect', 'Abgerundet'], ['ellipse', 'Ellipse'], ['diamond', 'Raute'],
  ['triangle', 'Dreieck'], ['hexagon', 'Sechseck'], ['parallelogram', 'Parallelogramm'], ['trapezoid', 'Trapez'],
  ['star', 'Stern'], ['pill', 'Pille'], ['cylinder', 'Zylinder'], ['arrow', 'Blockpfeil'],
  ['callout', 'Sprechblase'], ['cross', 'Kreuz'], ['document', 'Dokument'], ['cloud', 'Wolke'],
];

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
  }
  return { x: x + w * ix + pad, y: y + h * iy + pad, w: Math.max(4, w * iw - pad * 2), h: Math.max(4, h * ih - pad * 2) };
}

/* ---------------- Verbindungen ---------------- */

export function elBounds(el, get) {
  if (el.type === 'connector') {
    const g = connectorGeom(el, get);
    return g ? g.bbox : { x: 0, y: 0, w: 0, h: 0 };
  }
  if (el.type === 'comment') return { x: el.x, y: el.y - 30, w: 30, h: 30 };
  return { x: el.x, y: el.y, w: el.w, h: el.h };
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

function endTarget(end, get) {
  if (end && end.id) {
    const t = get(end.id);
    if (t && t.type !== 'connector') return t;
  }
  return null;
}

function centerOf(end, get) {
  const t = endTarget(end, get);
  if (t) return { x: t.x + t.w / 2, y: t.y + t.h / 2 };
  return { x: end?.x ?? 0, y: end?.y ?? 0 };
}

function freeSide(from, to) {
  const dx = to.x - from.x, dy = to.y - from.y;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left';
  return dy > 0 ? 'bottom' : 'top';
}

export function connectorGeom(el, get) {
  const t1 = endTarget(el.from, get), t2 = endTarget(el.to, get);
  // Verbindung zu einem gelöschten Element
  if ((el.from && el.from.id && !t1) || (el.to && el.to.id && !t2)) return null;
  const c1 = centerOf(el.from, get), c2 = centerOf(el.to, get);
  let p1, p2, s1, s2;
  if (t1) {
    s1 = el.from.side || autoSide(t1, c2);
    p1 = sidePoint(t1, s1);
  } else p1 = c1;
  if (t2) {
    s2 = el.to.side || autoSide(t2, t1 ? sidePoint(t1, s1) : c1);
    p2 = sidePoint(t2, s2);
  } else p2 = c2;
  if (t1 && !el.from.side && t2) {
    s1 = autoSide(t1, p2);
    p1 = sidePoint(t1, s1);
  }
  if (!s1) s1 = freeSide(p1, p2);
  if (!s2) s2 = freeSide(p2, p1);

  let d, pts, startDir, endDir, mid;
  const routing = el.routing || 'curve';
  if (routing === 'straight') {
    d = `M${r1(p1.x)},${r1(p1.y)} L${r1(p2.x)},${r1(p2.y)}`;
    pts = [p1, p2];
    startDir = [p1.x - p2.x, p1.y - p2.y];
    endDir = [p2.x - p1.x, p2.y - p1.y];
    mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
  } else if (routing === 'elbow') {
    pts = elbowPoints(p1, s1, p2, s2);
    d = 'M' + pts.map((p) => `${r1(p.x)},${r1(p.y)}`).join(' L');
    const n = pts.length;
    startDir = [pts[0].x - pts[1].x, pts[0].y - pts[1].y];
    endDir = [pts[n - 1].x - pts[n - 2].x, pts[n - 1].y - pts[n - 2].y];
    mid = polyMid(pts);
  } else {
    const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    const k = Math.max(30, dist * 0.4);
    const v1 = SIDE_VEC[s1], v2 = SIDE_VEC[s2];
    const cp1 = { x: p1.x + v1[0] * k, y: p1.y + v1[1] * k };
    const cp2 = { x: p2.x + v2[0] * k, y: p2.y + v2[1] * k };
    d = `M${r1(p1.x)},${r1(p1.y)} C${r1(cp1.x)},${r1(cp1.y)} ${r1(cp2.x)},${r1(cp2.y)} ${r1(p2.x)},${r1(p2.y)}`;
    pts = [p1, cp1, cp2, p2];
    startDir = [p1.x - cp1.x, p1.y - cp1.y];
    endDir = [p2.x - cp2.x, p2.y - cp2.y];
    const t = 0.5, mt = 1 - t;
    mid = {
      x: mt ** 3 * p1.x + 3 * mt * mt * t * cp1.x + 3 * mt * t * t * cp2.x + t ** 3 * p2.x,
      y: mt ** 3 * p1.y + 3 * mt * mt * t * cp1.y + 3 * mt * t * t * cp2.y + t ** 3 * p2.y,
    };
  }
  const bbox = unionRect(pts.map((p) => ({ x: p.x, y: p.y, w: 0, h: 0 })));
  return { p1, p2, s1, s2, d, startDir, endDir, mid, bbox };
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

function polyMid(pts) {
  let total = 0;
  for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  let half = total / 2;
  for (let i = 1; i < pts.length; i++) {
    const seg = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    if (half <= seg && seg > 0) {
      const t = half / seg;
      return { x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * t, y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * t };
    }
    half -= seg;
  }
  return pts[0];
}

function arrowHead(tip, dir, size, color) {
  const len = Math.hypot(dir[0], dir[1]) || 1;
  const ux = dir[0] / len, uy = dir[1] / len;
  const bx = tip.x - ux * size, by = tip.y - uy * size;
  const px = -uy * size * 0.55, py = ux * size * 0.55;
  return `<polygon points="${r1(tip.x)},${r1(tip.y)} ${r1(bx + px)},${r1(by + py)} ${r1(bx - px)},${r1(by - py)}" fill="${color}"/>`;
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

export function renderElement(el, env = {}) {
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
      return `${geo} fill="${fill === 'transparent' ? 'rgba(255,255,255,0.001)' : fill}" stroke="${stroke}" stroke-width="${sw}"${dash ? ` stroke-dasharray="${dash}"` : ''} stroke-linejoin="round"/>` +
        textSvg(box, lay, { color: el.textColor || contrastText(fill === 'transparent' ? '#ffffff' : fill), align: el.align || 'center', valign: el.valign || 'middle' });
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
      let out = `<path class="hit" d="${g.d}" fill="none" stroke="transparent" stroke-width="${Math.max(14, sw + 10)}"/>`;
      out += `<path d="${g.d}" fill="none" stroke="${color}" stroke-width="${sw}"${dash ? ` stroke-dasharray="${dash}"` : ''} stroke-linecap="round" stroke-linejoin="round"/>`;
      if (el.arrowEnd !== false && el.arrowEnd !== 'none') out += arrowHead(g.p2, g.endDir, ah, color);
      if (el.arrowStart && el.arrowStart !== 'none') out += arrowHead(g.p1, g.startDir, ah, color);
      if (el.label) {
        const fs = el.fontSize || 14;
        const lines = String(el.label).split('\n');
        const lw = Math.max(...lines.map((l) => measure(l, fs))) + 12;
        const lh = lines.length * fs * LH + 6;
        out += `<rect x="${r1(g.mid.x - lw / 2)}" y="${r1(g.mid.y - lh / 2)}" width="${r1(lw)}" height="${r1(lh)}" rx="4" fill="${env.labelBg || '#ffffff'}"/>`;
        out += textSvg({ x: g.mid.x - lw / 2, y: g.mid.y - lh / 2, w: lw, h: lh }, { size: fs, lines, bold: false, italic: false }, { color });
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
    case 'card': {
      const color = el.color || '#4262ff';
      const pad = 14;
      let out = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="#ffffff" stroke="#e3e3e3" filter="url(#shadow-sm)"/>`;
      out += `<path d="M${x + 8},${y} H${x + w - 8} Q${x + w},${y} ${x + w},${y + 8} V${y + 6} H${x} V${y + 8} Q${x},${y} ${x + 8},${y} Z" fill="${color}"/>`;
      const tlay = { size: 15, bold: true, italic: false, lines: wrap(el.title || 'Neue Karte', w - pad * 2, 15, true).slice(0, 3) };
      out += textSvg({ x: x + pad, y: y + 16, w: w - pad * 2, h: 60 }, tlay, { align: 'left', valign: 'top', color: '#1a1a1a' });
      const ty = y + 16 + tlay.lines.length * 15 * LH + 6;
      if (el.description) {
        const maxL = Math.max(0, Math.floor((y + h - 40 - ty) / (13 * LH)));
        const dl = wrap(el.description, w - pad * 2, 13).slice(0, maxL);
        out += textSvg({ x: x + pad, y: ty, w: w - pad * 2, h: 200 }, { size: 13, lines: dl }, { align: 'left', valign: 'top', color: '#666666' });
      }
      const fy = y + h - 28;
      if (el.status) {
        const sw = measure(el.status, 11, true) + 14;
        out += `<rect x="${x + pad}" y="${fy}" width="${sw}" height="18" rx="9" fill="${color}" fill-opacity="0.15"/><text x="${x + pad + 7}" y="${fy + 13}" font-family="${esc(FONT)}" font-size="11" font-weight="bold" fill="${color}">${esc(el.status)}</text>`;
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

/* Vollständiges SVG für eine Menge von Elementen (Vorschau, Export) */
export function renderSvgDocument(elements, { padding = 40, background = '#ffffff', width, height, bounds } = {}) {
  const map = new Map(elements.map((e) => [e.id, e]));
  const get = (id) => map.get(id);
  const list = sortForRender(elements.filter((e) => e.type !== 'comment'));
  const b = bounds || unionRect(list.map((e) => elBounds(e, get))) || { x: 0, y: 0, w: 100, h: 100 };
  const vb = { x: b.x - padding, y: b.y - padding, w: b.w + padding * 2, h: b.h + padding * 2 };
  // Rahmentitel ragen über den Frame hinaus
  if (!bounds && list.some((e) => e.type === 'frame')) {
    vb.y -= 40;
    vb.h += 40;
  }
  const body = list.map((e) => `<g>${renderElement(e, { get })}</g>`).join('');
  return {
    svg: `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="${vb.x} ${vb.y} ${vb.w} ${vb.h}" width="${width || vb.w}" height="${height || vb.h}"><defs>${defsMarkup()}</defs>` +
      (background ? `<rect x="${vb.x}" y="${vb.y}" width="${vb.w}" height="${vb.h}" fill="${background}"/>` : '') + body + '</svg>',
    viewBox: vb,
  };
}

export function sortForRender(list) {
  const rank = (e) => (e.type === 'frame' ? 0 : e.type === 'comment' ? 2 : 1);
  return [...list].sort((a, b) => rank(a) - rank(b) || (a.z || 0) - (b.z || 0));
}
