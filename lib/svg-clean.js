'use strict';
/*
 * Macht aus einer SVG-Datei eine harmlose Zeichnung für Formenpakete.
 * Ergebnis ist kein Markup, sondern eine Baumstruktur aus erlaubten Elementen und geprüften Werten:
 *   { vb: [x, y, w, h], nodes: [[Tag, {Attribut: Wert}, ...Kinder]] }   Kinder sind Knoten oder Text (nur in text/tspan)
 * Der Browser baut daraus Markup mit derselben Liste (public/js/svg-nodes.js) und maskiert dabei jeden Wert.
 *
 * Was durchkommt: Formen, Gruppen, Verläufe, Beschneidungen und Masken, Text, alles mit Farben und Zahlen.
 * Was entfällt: Skripte, Ereignisse, Links nach außen, eingebettete Bilder und HTML, Animationen, Filter, Schriftarten aus dem Netz.
 * Verweise (url(#…), href="#…") gelten nur innerhalb der Datei. Die Kennungen bekommen ein Präfix, damit sich zwei Symbole auf einem Board nicht stören.
 */
const { DOMParser } = require('@xmldom/xmldom');

const SVG_NS = 'http://www.w3.org/2000/svg';
const XLINK_NS = 'http://www.w3.org/1999/xlink';

const MAX_INPUT = 512 * 1024;
const MAX_NODES = 4000;
const MAX_DEPTH = 32;
const MAX_TEXT = 200;
const MAX_OUTPUT = 256 * 1024;

const SHAPES = ['path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon'];
// Elemente, die erhalten bleiben. „use“ verweist nur auf Kennungen derselben Datei.
const TAGS = new Set(['g', 'defs', ...SHAPES, 'linearGradient', 'radialGradient', 'stop', 'clipPath', 'mask', 'use', 'text', 'tspan', 'symbol']);
// Elemente, deren Inhalt mitgenommen wird, als wären sie eine Gruppe (Links verlieren dabei ihr Ziel)
const AS_GROUP = new Set(['a', 'switch', 'svg']);

// Werteprüfungen
const NUM = /^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i;
const LEN = /^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?(px|%|pt|mm|cm|in|em)?$/i;
const NUMLIST = /^[\d\s,.eE+-]*$/;
const PATH = /^[MmLlHhVvCcSsQqTtAaZz\d\s,.eE+-]*$/;
// Ohne verschachtelte Wiederholung: Jeder Baustein wird einzeln entfernt, übrig bleiben darf nichts (kein exponentielles Zurückspringen)
const TRANSFORM_PART = /\s*(?:matrix|translate|scale|rotate|skewX|skewY)\s*\([\d\s,.eE+-]*\)\s*,?/g;
const isTransform = (v) => v.replace(TRANSFORM_PART, '').trim() === '';
const HEX = /^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const FUNC_COLOR = /^(rgb|rgba|hsl|hsla)\(\s*[\d.%\s,+-]+\)$/i;
const NAMED = /^[a-z]{3,20}$/i;
const REF = /^url\(\s*['"]?#([A-Za-z_][\w.:-]{0,80})['"]?\s*\)$/;
const FONT = /^[\w\s,'"-]{1,80}$/;

const ENUMS = {
  'fill-rule': ['nonzero', 'evenodd', 'inherit'],
  'clip-rule': ['nonzero', 'evenodd', 'inherit'],
  'stroke-linecap': ['butt', 'round', 'square', 'inherit'],
  'stroke-linejoin': ['miter', 'round', 'bevel', 'arcs', 'miter-clip', 'inherit'],
  'text-anchor': ['start', 'middle', 'end', 'inherit'],
  'dominant-baseline': ['auto', 'middle', 'central', 'hanging', 'alphabetic', 'mathematical', 'text-top', 'text-bottom', 'ideographic'],
  'font-style': ['normal', 'italic', 'oblique'],
  'font-weight': ['normal', 'bold', 'bolder', 'lighter', '100', '200', '300', '400', '500', '600', '700', '800', '900'],
  gradientUnits: ['userSpaceOnUse', 'objectBoundingBox'],
  clipPathUnits: ['userSpaceOnUse', 'objectBoundingBox'],
  maskUnits: ['userSpaceOnUse', 'objectBoundingBox'],
  maskContentUnits: ['userSpaceOnUse', 'objectBoundingBox'],
  spreadMethod: ['pad', 'reflect', 'repeat'],
  visibility: ['visible', 'hidden', 'collapse'],
  display: ['inline', 'none', 'block'],
  'mix-blend-mode': ['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten'],
  'isolation': ['auto', 'isolate'],
};

const KIND = {
  d: 'path', points: 'numlist', transform: 'transform', gradientTransform: 'transform', patternTransform: 'transform',
  x: 'len', y: 'len', width: 'len', height: 'len', rx: 'len', ry: 'len', cx: 'len', cy: 'len', r: 'len', fx: 'len', fy: 'len', fr: 'len',
  x1: 'len', y1: 'len', x2: 'len', y2: 'len', dx: 'numlist', dy: 'numlist', offset: 'len',
  fill: 'paint', stroke: 'paint', color: 'color', 'stop-color': 'color',
  opacity: 'num', 'fill-opacity': 'num', 'stroke-opacity': 'num', 'stop-opacity': 'num',
  'stroke-width': 'len', 'stroke-miterlimit': 'num', 'stroke-dasharray': 'dash', 'stroke-dashoffset': 'len',
  'clip-path': 'ref', mask: 'ref',
  'font-size': 'len', 'font-family': 'font', 'letter-spacing': 'len',
  id: 'id', href: 'href',
};
for (const k of Object.keys(ENUMS)) KIND[k] = 'enum';
// Diese Eigenschaften dürfen auch aus style="" und <style> kommen
const CSS_PROPS = new Set(Object.keys(KIND).filter((k) => !['d', 'points', 'transform', 'gradientTransform', 'patternTransform', 'id', 'href', 'x', 'y', 'width', 'height', 'rx', 'ry', 'cx', 'cy', 'r', 'fx', 'fy', 'fr', 'x1', 'y1', 'x2', 'y2', 'dx', 'dy', 'offset', 'gradientUnits', 'clipPathUnits', 'maskUnits', 'maskContentUnits', 'spreadMethod'].includes(k)));
const ALL_ATTRS = new Set(Object.keys(KIND));

class SvgError extends Error {}

// Zahlen auf die nötige Genauigkeit kürzen: Exporte aus Zeichenprogrammen haben oft zehn Nachkommastellen
function rounder(size) {
  const digits = Math.max(1, Math.min(4, 3 - Math.floor(Math.log10(Math.max(size, 1e-3)))));
  const f = 10 ** digits;
  // Kurzschreibweisen wie „2.4.8“ (zwei Zahlen) bleiben getrennt: Folgt eine Zahl direkt auf eine Ziffer, kommt ein Leerzeichen dazwischen
  return (s) => s.replace(/[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/gi, (m, _a, _b, at, all) => {
    const n = Math.round(Number(m) * f) / f;
    const out = Number.isFinite(n) ? String(Object.is(n, -0) ? 0 : n) : '0';
    return at > 0 && /[\d.]/.test(all[at - 1]) && !/^[+-]/.test(out) ? ' ' + out : out;
  });
}

function checkValue(name, raw, ctx) {
  const v = String(raw).trim();
  if (!v || v.length > 20000) return null;
  switch (KIND[name]) {
    case 'path': return PATH.test(v) ? ctx.round(v).replace(/\s+/g, ' ') : null;
    case 'numlist': return NUMLIST.test(v) && v.length <= 20000 ? ctx.round(v).replace(/\s+/g, ' ') : null;
    case 'transform': return isTransform(v) ? ctx.round(v).replace(/\s+/g, ' ') : null;
    case 'len': return LEN.test(v) ? v.toLowerCase() : null;
    case 'num': return NUM.test(v) ? v : null;
    case 'dash': return v === 'none' || /^[\d\s,.]+$/.test(v) ? v : null;
    case 'enum': return ENUMS[name].includes(v) ? v : null;
    case 'font': return FONT.test(v) ? v : null;
    case 'color': return color(v);
    case 'paint': {
      const m = REF.exec(v);
      if (m) return ctx.refs.has(m[1]) ? `url(#${ctx.refs.get(m[1])})` : null;
      // „url(#x) red“: Ersatzfarbe nach dem Verweis
      const fb = /^url\([^)]*\)\s+(.+)$/.exec(v);
      return color(fb ? fb[1] : v);
    }
    case 'ref': {
      const m = REF.exec(v);
      return m && ctx.refs.has(m[1]) ? `url(#${ctx.refs.get(m[1])})` : v === 'none' ? 'none' : null;
    }
    case 'id': return ctx.refs.get(v) || null;
    case 'href': {
      const m = /^#([A-Za-z_][\w.:-]{0,80})$/.exec(v);
      return m && ctx.refs.has(m[1]) ? '#' + ctx.refs.get(m[1]) : null;
    }
    default: return null;
  }
}

// <use> vervielfältigt Teile der Zeichnung. Verschachtelt wüchse die Arbeit des Browsers exponentiell („Billion Laughs“):
// Ein Verweis darf daher nur auf einen Teil ohne eigenes <use> zeigen, nicht auf sich selbst oder einen Vorfahren, und höchstens MAX_USE-mal vorkommen.
const MAX_USE = 50;
function limitUse(top) {
  const byId = new Map();
  const hasUse = (n) => n.slice(2).some((c) => typeof c !== 'string' && (c[0] === 'use' || hasUse(c)));
  const index = (n) => {
    if (n[1].id) byId.set(n[1].id, n);
    for (const c of n.slice(2)) if (typeof c !== 'string') index(c);
  };
  index(top);
  let count = 0;
  const walk = (n, ancestors) => {
    for (let i = n.length - 1; i >= 2; i--) {
      const c = n[i];
      if (typeof c === 'string') continue;
      if (c[0] === 'use') {
        const target = byId.get(String(c[1].href || '').slice(1));
        if (!target || ++count > MAX_USE || target[0] === 'use' || hasUse(target) || ancestors.includes(target)) n.splice(i, 1);
      } else walk(c, [...ancestors, c]);
    }
  };
  walk(top, [top]);
}

function color(v) {
  if (v.length > 64) return null;
  if (HEX.test(v)) return v.toLowerCase();
  if (FUNC_COLOR.test(v)) return v.replace(/\s+/g, '');
  if (v === 'currentColor' || v === 'currentcolor') return 'currentColor';
  if (NAMED.test(v)) return v.toLowerCase();
  return null;
}

// Einfache Stilregeln: .klasse, Element und #kennung, auch als Liste. Alles andere (Medienabfragen, @import, Selektor-Ketten) entfällt.
// Von Hand zerlegt statt mit regulären Ausdrücken: Die Laufzeit bleibt linear, auch bei böswilligen Eingaben.
const MAX_CSS = 64 * 1024;
function parseCss(text) {
  const rules = [];
  let css = String(text).slice(0, MAX_CSS), plain = '';
  for (let at = 0; at < css.length;) {
    const open = css.indexOf('/*', at);
    if (open < 0) {
      plain += css.slice(at);
      break;
    }
    plain += css.slice(at, open);
    const close = css.indexOf('*/', open + 2);
    at = close < 0 ? css.length : close + 2;
  }
  for (const block of plain.split('}')) {
    const brace = block.indexOf('{');
    if (brace < 0) continue;
    // Was vor einer At-Regel steht (@import …;), gehört nicht zum Selektor
    const head = block.slice(0, brace).split(';').pop();
    if (head.includes('@')) continue;
    const decls = parseDecls(block.slice(brace + 1));
    for (const sel of head.split(',').map((x) => x.trim())) {
      if (/^\.[\w-]+$/.test(sel)) rules.push({ cls: sel.slice(1), decls });
      else if (/^[a-zA-Z]+$/.test(sel)) rules.push({ tag: sel, decls });
      else if (/^#[\w-]+$/.test(sel)) rules.push({ id: sel.slice(1), decls });
    }
  }
  return rules;
}

function parseDecls(text) {
  const out = {};
  for (const part of String(text).split(';')) {
    const i = part.indexOf(':');
    if (i < 0) continue;
    const k = part.slice(0, i).trim().toLowerCase();
    const v = part.slice(i + 1).replace(/!important/i, '').trim();
    if (CSS_PROPS.has(k) || k === 'stop-color' || k === 'stop-opacity') out[k] = v;
  }
  return out;
}

const localName = (el) => el.localName || el.nodeName;
const isSvgElement = (el) => el.nodeType === 1 && (!el.namespaceURI || el.namespaceURI === SVG_NS);

function parseNumber(v) {
  const m = /^\s*([+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?)\s*(px|pt|mm|cm|in)?\s*$/i.exec(String(v || ''));
  return m ? Number(m[1]) : NaN;
}

function viewBoxOf(root) {
  const vb = String(root.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number);
  if (vb.length === 4 && vb.every(Number.isFinite) && vb[2] > 0 && vb[3] > 0) return vb;
  const w = parseNumber(root.getAttribute('width')), h = parseNumber(root.getAttribute('height'));
  if (w > 0 && h > 0) return [0, 0, w, h];
  throw new SvgError('Größe fehlt (viewBox oder width/height)');
}

/**
 * text: Inhalt der SVG-Datei. prefix: Vorsilbe für Kennungen (Buchstaben, Ziffern, Bindestrich).
 * Wirft SvgError mit einem lesbaren Grund, wenn die Datei nicht taugt.
 */
function cleanSvg(text, prefix = 's') {
  if (typeof text !== 'string' || !text.trim()) throw new SvgError('leer');
  if (text.length > MAX_INPUT) throw new SvgError('zu groß');
  if (/<!ENTITY/i.test(text)) throw new SvgError('Entitäten sind nicht erlaubt');
  if (!/^[a-z][a-z0-9-]{0,60}$/.test(prefix)) throw new Error('Ungültiges Präfix');
  const errors = [];
  // Eigene Fehlerbehandlung: Der Parser schriebe sonst auf die Konsole. Auch Warnungen (offene Elemente, kaputte Attribute) lehnen die Datei ab.
  // Schwere Fehler wirft der Parser zusätzlich als Ausnahme.
  let doc;
  try {
    doc = new DOMParser({ onError: (level, msg) => errors.push(String(msg)) }).parseFromString(text.replace(/^\uFEFF/, ''), 'image/svg+xml');
  } catch {
    throw new SvgError('keine gültige SVG-Datei');
  }
  const root = doc?.documentElement;
  if (!root || localName(root) !== 'svg' || errors.length) throw new SvgError('keine gültige SVG-Datei');
  const vb = viewBoxOf(root);
  const ctx = { round: rounder(Math.max(vb[2], vb[3]) / 24), refs: new Map(), count: 0 };

  // Stilregeln aus allen <style>-Blöcken, Kennungen für die Umbenennung
  const rules = [];
  let ids = 0;
  const scan = (el, depth) => {
    if (depth > MAX_DEPTH) throw new SvgError('zu tief verschachtelt');
    for (let c = el.firstChild; c; c = c.nextSibling) {
      if (c.nodeType !== 1) continue;
      if (localName(c) === 'style' && isSvgElement(c)) rules.push(...parseCss(c.textContent || ''));
      const id = c.getAttribute('id');
      if (id && /^[A-Za-z_][\w.:-]{0,80}$/.test(id) && !ctx.refs.has(id)) ctx.refs.set(id, `${prefix}-${(ids++).toString(36)}`);
      scan(c, depth + 1);
    }
  };
  scan(root, 0);

  const styleOf = (el) => {
    const out = {};
    const tag = localName(el), classes = String(el.getAttribute('class') || '').split(/\s+/).filter(Boolean), id = el.getAttribute('id');
    for (const r of rules) if ((r.tag && r.tag === tag) || (r.cls && classes.includes(r.cls)) || (r.id && r.id === id)) Object.assign(out, r.decls);
    Object.assign(out, parseDecls(el.getAttribute('style') || ''));
    return out;
  };

  const convert = (el, depth, inText) => {
    if (++ctx.count > MAX_NODES) throw new SvgError('zu viele Elemente');
    let tag = localName(el);
    if (AS_GROUP.has(tag)) tag = 'g';
    if (!TAGS.has(tag)) return null;
    const attrs = {};
    // Vorrang wie im Browser: Attribut < Stilregel < style=""
    const values = {};
    for (let i = 0; i < el.attributes.length; i++) {
      const a = el.attributes[i];
      let name = a.localName || a.name;
      if (a.namespaceURI === XLINK_NS && name === 'href') name = 'href';
      else if (a.namespaceURI && a.namespaceURI !== SVG_NS) continue;
      else if (a.name.includes(':')) continue;
      if (ALL_ATTRS.has(name)) values[name] = a.value;
    }
    Object.assign(values, styleOf(el));
    // Ein inneres <svg> wird zur verschobenen Gruppe
    if (localName(el) === 'svg' && depth > 0) {
      const x = parseNumber(values.x) || 0, y = parseNumber(values.y) || 0;
      for (const k of ['x', 'y', 'width', 'height']) delete values[k];
      if (x || y) values.transform = `translate(${x} ${y}) ${values.transform || ''}`;
    }
    if (depth === 0) for (const k of ['x', 'y', 'width', 'height']) delete values[k];
    for (const [k, v] of Object.entries(values)) {
      if (tag === 'use' && k === 'href' && !/^#/.test(String(v).trim())) return null;
      const ok = checkValue(k, v, ctx);
      if (ok !== null) attrs[k] = ok;
    }
    if (tag === 'use' && !attrs.href) return null;
    if (tag === 'path' && !attrs.d) return null;
    const node = [tag, attrs];
    for (let c = el.firstChild; c; c = c.nextSibling) {
      if (c.nodeType === 3 || c.nodeType === 4) {
        if (!(inText || tag === 'text' || tag === 'tspan')) continue;
        const t = String(c.data || '').replace(/\s+/g, ' ');
        if (t.trim()) node.push(t.slice(0, MAX_TEXT));
      } else if (c.nodeType === 1 && isSvgElement(c)) {
        if (depth >= MAX_DEPTH) throw new SvgError('zu tief verschachtelt');
        if ((tag === 'text' || tag === 'tspan') && localName(c) !== 'tspan') continue;
        const child = convert(c, depth + 1, inText || tag === 'text');
        if (child) node.push(child);
      }
    }
    // Leere Gruppen tragen nichts bei
    if ((tag === 'g' || tag === 'defs' || tag === 'text') && node.length === 2) return null;
    return node;
  };

  const top = convert(root, 0, false);
  if (top) limitUse(top);
  if (!top || top.length === 2) throw new SvgError('keine Zeichnung enthalten');
  const [, rootAttrs, ...children] = top;
  // Die Wurzel wird zur Gruppe, ihre Farben und Linien gelten weiter für den Inhalt
  const nodes = Object.keys(rootAttrs).length ? [['g', rootAttrs, ...children]] : children;
  const out = { vb: vb.map((n) => Math.round(n * 1000) / 1000), nodes };
  if (JSON.stringify(out).length > MAX_OUTPUT) throw new SvgError('Zeichnung zu umfangreich');
  return out;
}

module.exports = { cleanSvg, SvgError, TAGS, ALL_ATTRS, MAX_INPUT };
