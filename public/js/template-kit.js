// Bausteine für Vorlagen (Rahmen, Notizen, Formen, Spalten, Quadranten)
import { uid, wrap } from './util.js';

export const C = {
  yellow: '#fff9b1', orange: '#ff9d48', green: '#93d275', lime: '#d5f692', teal: '#67c6c0', blue: '#a6ccf5',
  sky: '#6cd8fa', violet: '#c9b2e8', pink: '#ffcee0', red: '#f99fb1', white: '#ffffff', grey: '#e6e6e6',
};
export const LIGHT = {
  yellow: '#fffbe0', orange: '#fff0e3', green: '#ecf7e6', blue: '#eaf3fd', violet: '#f4effa', pink: '#fff0f5',
  red: '#fde8ec', teal: '#e6f6f5', grey: '#f4f4f5',
};

export function dayOffset(n) {
  const d = new Date(Date.now() + n * 86400000);
  return d.toISOString().slice(0, 10);
}

export class B {
  constructor() {
    this.els = [];
    this.z = 0;
  }
  add(el) {
    el.id = uid();
    el.z = ++this.z;
    this.els.push(el);
    return el;
  }
  frame(x, y, w, h, title, fill = '#ffffff') {
    return this.add({ type: 'frame', x, y, w, h, title, fill });
  }
  sticky(x, y, text = '', fill = C.yellow, w = 150, h = 150) {
    return this.add({ type: 'sticky', x, y, w, h, text, fill, fontSize: 'auto' });
  }
  shape(x, y, w, h, o = {}) {
    return this.add({ type: 'shape', shape: 'rect', x, y, w, h, fill: '#ffffff', stroke: '#1a1a1a', strokeWidth: 2, text: '', fontSize: 16, ...o });
  }
  // Kanban-Spalte: Die Überschrift darin ist zugleich der Status der Karten, die hineingezogen werden
  zone(x, y, w, h, fill, o = {}) {
    return this.shape(x, y, w, h, { shape: 'roundrect', fill, stroke: 'none', strokeWidth: 0, locked: true, ...o });
  }
  text(x, y, w, text, size = 16, o = {}) {
    const lines = wrap(text, w - 8, size, o.bold, o.italic).length;
    return this.add({ type: 'text', x, y, w, h: Math.ceil(lines * size * 1.25 + 8), text, fontSize: size, color: '#1a1a1a', align: 'left', ...o });
  }
  heading(x, y, title, sub, w = 1200) {
    this.text(x, y, w, title, 44, { bold: true });
    if (sub) this.text(x, y + 66, w, sub, 18, { color: '#6b6b6b' });
  }
  conn(a, b, o = {}) {
    return this.add({ type: 'connector', from: { id: a.id, side: o.fromSide }, to: { id: b.id, side: o.toSide }, stroke: '#1a1a1a', strokeWidth: 2, routing: 'curve', arrowEnd: true, ...o, fromSide: undefined, toSide: undefined });
  }
  line(x1, y1, x2, y2, o = {}) {
    return this.add({ type: 'connector', from: { x: x1, y: y1 }, to: { x: x2, y: y2 }, stroke: '#1a1a1a', strokeWidth: 2, routing: 'straight', arrowEnd: false, ...o });
  }
  card(x, y, title, o = {}) {
    return this.add({ type: 'card', x, y, w: 300, h: 140, title, description: '', color: '#4262ff', ...o });
  }
  emoji(x, y, char, size = 64) {
    return this.add({ type: 'emoji', x, y, w: size, h: size, char });
  }
  table(x, y, w, h, cells, o = {}) {
    return this.add({ type: 'table', x, y, w, h, rows: cells.length, cols: cells[0].length, cells, header: true, fontSize: 14, ...o });
  }
  block(x, y, w, h, title, hint, fill = '#ffffff', align = 'left') {
    this.shape(x, y, w, h, { fill, stroke: '#c8c8c8', strokeWidth: 1, text: title, fontSize: 20, bold: true, align, valign: 'top', locked: true });
    if (hint) this.text(x + 10, y + 48, w - 20, hint, 13, { color: '#7a7a7a', align });
  }
}

/* ---------------- Bausteine ---------------- */

export function columnsTemplate(name, sub, cols, { colW = 380, colH = 760, stickies = 1 } = {}) {
  const b = new B();
  const gap = 30;
  const W = 60 * 2 + cols.length * colW + (cols.length - 1) * gap;
  const H = 200 + colH + 60;
  b.frame(0, 0, W, H, name);
  b.heading(60, 40, name, sub, W - 120);
  cols.forEach((c, i) => {
    const x = 60 + i * (colW + gap);
    b.zone(x, 200, colW, colH, c.light || LIGHT.grey);
    b.shape(x, 200, colW, 80, { shape: 'roundrect', fill: c.color, stroke: 'none', strokeWidth: 0, text: `${c.emoji ? c.emoji + '  ' : ''}${c.title}`, fontSize: 22, bold: true, locked: true });
    if (c.hint) b.text(x + 16, 296, colW - 32, c.hint, 14, { color: '#6b6b6b' });
    for (let s = 0; s < stickies; s++) b.sticky(x + 20 + (s % 2) * 175, 370 + Math.floor(s / 2) * 175, '', c.sticky || C.yellow);
  });
  return b.els;
}

export function quadrantTemplate(name, sub, quads, { xAxis, yAxis, size = 560 } = {}) {
  const b = new B();
  const ox = yAxis ? 130 : 60, oy = 200;
  const W = ox + size * 2 + 20 + 60, H = oy + size * 2 + 20 + (xAxis ? 110 : 60);
  b.frame(0, 0, W, H, name);
  b.heading(60, 40, name, sub, W - 120);
  quads.forEach((q, i) => {
    const x = ox + (i % 2) * (size + 20), y = oy + Math.floor(i / 2) * (size + 20);
    b.zone(x, y, size, size, q.light);
    b.shape(x + 20, y + 20, size - 40, 60, { shape: 'roundrect', fill: q.color, stroke: 'none', strokeWidth: 0, text: `${q.emoji ? q.emoji + '  ' : ''}${q.title}`, fontSize: 22, bold: true, locked: true });
    if (q.hint) b.text(x + 24, y + 92, size - 48, q.hint, 14, { color: '#6b6b6b' });
    b.sticky(x + 30, y + 150, '', q.sticky || C.yellow);
  });
  if (xAxis) {
    b.line(ox, oy + size * 2 + 50, ox + size * 2 + 20, oy + size * 2 + 50, { arrowEnd: true, strokeWidth: 3 });
    b.text(ox, oy + size * 2 + 62, size * 2 + 20, xAxis, 18, { bold: true, align: 'center', color: '#444' });
  }
  if (yAxis) {
    b.line(70, oy + size * 2 + 20, 70, oy, { arrowEnd: true, strokeWidth: 3 });
    b.text(10, oy - 40, 200, yAxis, 18, { bold: true, color: '#444' });
  }
  return b.els;
}
