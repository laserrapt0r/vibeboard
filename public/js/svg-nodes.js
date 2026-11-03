// Baut SVG-Markup aus der Baumstruktur der Fachsymbole und eigenen Formenpakete (Aufbau: lib/svg-clean.js).
// Der Server hat die Daten schon geprüft. Hier gilt dieselbe Liste noch einmal: Was nicht darauf steht, entfällt, jeder Wert wird maskiert.
import { esc } from './util.js';

const TAGS = new Set(['g', 'defs', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'linearGradient', 'radialGradient', 'stop', 'clipPath', 'mask', 'use', 'text', 'tspan', 'symbol']);
const ATTRS = new Set([
  'd', 'points', 'transform', 'gradientTransform', 'patternTransform', 'x', 'y', 'width', 'height', 'rx', 'ry', 'cx', 'cy', 'r', 'fx', 'fy', 'fr', 'x1', 'y1', 'x2', 'y2', 'dx', 'dy', 'offset',
  'fill', 'stroke', 'color', 'stop-color', 'opacity', 'fill-opacity', 'stroke-opacity', 'stop-opacity', 'stroke-width', 'stroke-miterlimit', 'stroke-dasharray', 'stroke-dashoffset',
  'clip-path', 'mask', 'font-size', 'font-family', 'letter-spacing', 'id', 'href', 'fill-rule', 'clip-rule', 'stroke-linecap', 'stroke-linejoin', 'text-anchor', 'dominant-baseline',
  'font-style', 'font-weight', 'gradientUnits', 'clipPathUnits', 'maskUnits', 'maskContentUnits', 'spreadMethod', 'visibility', 'display', 'mix-blend-mode', 'isolation',
]);
// Verweise nur innerhalb der Zeichnung
const SAFE_URL = /^url\(#[\w.:-]+\)$/;

function attrOk(k, v) {
  if (!ATTRS.has(k) || typeof v !== 'string' || v.length > 20000) return false;
  if (k === 'href') return /^#[\w.:-]+$/.test(v);
  if (/url\s*\(/i.test(v)) return SAFE_URL.test(v);
  return !/[<>]/.test(v);
}

const MAX_NODES = 4000;

export function nodesMarkup(nodes) {
  let count = 0;
  const walk = (list, depth) => {
    let out = '';
    for (const n of list) {
      if (typeof n === 'string') {
        out += esc(n);
        continue;
      }
      if (!Array.isArray(n) || !TAGS.has(n[0]) || depth > 32 || ++count > MAX_NODES) continue;
      const [tag, attrs, ...kids] = n;
      let a = '';
      for (const [k, v] of Object.entries(attrs || {})) if (attrOk(k, v)) a += ` ${k}="${esc(v)}"`;
      out += `<${tag}${a}>${walk(kids, depth + 1)}</${tag}>`;
    }
    return out;
  };
  return walk(Array.isArray(nodes) ? nodes : [], 0);
}
