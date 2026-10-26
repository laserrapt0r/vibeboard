'use strict';
// Prüfung von Board-Elementen und Sitzungsdaten, bevor sie gespeichert und verteilt werden.
// Verhindert eingeschleustes Markup in SVG-Attributen und Werte, die PostgreSQL (jsonb) ablehnt.

const RESERVED = new Set(['__proto__', 'constructor', 'prototype']);
const validId = (id) => typeof id === 'string' && /^[a-zA-Z0-9_-]{1,64}$/.test(id) && !RESERVED.has(id);

const COLOR_RE = /^(#[0-9a-f]{3,8}|transparent|none|rgba?\(\s*[\d.]+%?\s*,\s*[\d.]+%?\s*,\s*[\d.]+%?\s*(,\s*[\d.]+%?\s*)?\))$/i;
const COLOR_KEYS = ['fill', 'stroke', 'textColor', 'color', 'headerFill'];
const NUMBER_KEYS = ['x', 'y', 'w', 'h', 'z', 'strokeWidth', 'rows', 'cols', 'opacity', 'order'];
const SIDES = new Set(['top', 'right', 'bottom', 'left']);
const MAX_ELEMENT_BYTES = 8 * 1024 * 1024;
const HEADS = new Set(['none', 'arrow', 'open', 'triangle', 'diamond', 'diamondFilled', 'circle', 'bar', 'crow']);
const ENUMS = {
  lang: new Set(['plain', 'js', 'python', 'java', 'csharp', 'go', 'php', 'sql', 'bash', 'json', 'yaml', 'html', 'css', 'dockerfile']),
  theme: new Set(['dark', 'light']),
  priority: new Set(['critical', 'high', 'medium', 'low']),
};

// \u0000 und einzelne Surrogate lehnt jsonb ab – vor dem Speichern entfernen
function cleanJson(value) {
  const s = JSON.stringify(value);
  if (s === undefined) return undefined;
  const cleaned = s.replace(/(?<!\\)((?:\\\\)*)\\u(?:0000|d[89a-f][0-9a-f]{2})/gi, '$1');
  return cleaned === s ? value : JSON.parse(cleaned);
}

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

function endpoint(e) {
  if (!e || typeof e !== 'object') return { x: 0, y: 0 };
  const out = {};
  if (validId(e.id)) {
    out.id = e.id;
    // fester Andockpunkt auf dem Umriss (relativ zur Mitte, −1 … 1)
    const ax = Number(e.ax), ay = Number(e.ay);
    if (Number.isFinite(ax) && Number.isFinite(ay)) {
      out.ax = Math.max(-1, Math.min(1, ax));
      out.ay = Math.max(-1, Math.min(1, ay));
    }
  } else {
    out.x = num(e.x);
    out.y = num(e.y);
  }
  if (SIDES.has(e.side)) out.side = e.side;
  return out;
}

// Liefert ein bereinigtes Element oder null, wenn es unbrauchbar ist
function sanitizeElement(el) {
  if (!el || typeof el !== 'object' || Array.isArray(el) || !validId(el.id) || typeof el.type !== 'string') return null;
  const o = cleanJson(el);
  if (!o) return null;
  for (const k of Object.keys(o)) if (RESERVED.has(k)) delete o[k];
  // Kennzeichen des privaten Modus vergibt ausschließlich der Server
  delete o.priv;
  delete o.privName;
  delete o.hidden;
  for (const k of NUMBER_KEYS) if (k in o) o[k] = num(o[k]);
  if ('fontSize' in o && o.fontSize !== 'auto') o.fontSize = num(o.fontSize) || 16;
  for (const k of COLOR_KEYS) {
    if (k in o && !(typeof o[k] === 'string' && COLOR_RE.test(o[k].trim()))) delete o[k];
  }
  // Auswahlfelder nur mit bekannten Werten (werden im Browser als Schlüssel nachgeschlagen)
  for (const [k, allowed] of Object.entries(ENUMS)) if (k in o && !allowed.has(o[k])) delete o[k];
  for (const k of ['assignee', 'status', 'key']) if (typeof o[k] === 'string') o[k] = o[k].trim();
  for (const k of ['title', 'text', 'description', 'label', 'assignee', 'status', 'key', 'points']) if (k in o && o[k] != null && typeof o[k] !== 'string') o[k] = String(o[k]);
  if ('tags' in o) o.tags = (Array.isArray(o.tags) ? o.tags : []).map((t) => String(t).trim()).filter(Boolean).slice(0, 8);
  if (o.type === 'connector') {
    o.from = endpoint(o.from);
    o.to = endpoint(o.to);
    if ('waypoints' in o) o.waypoints = Array.isArray(o.waypoints) ? o.waypoints.slice(0, 100).filter((p) => p && typeof p === 'object').map((p) => ({ x: num(p.x), y: num(p.y) })) : [];
    if ('labelPos' in o) o.labelPos = Number.isFinite(Number(o.labelPos)) ? Math.max(0, Math.min(1, Number(o.labelPos))) : 0.5;
    for (const k of ['arrowStart', 'arrowEnd']) if (k in o && typeof o[k] !== 'boolean' && !HEADS.has(o[k])) delete o[k];
  }
  if (o.type === 'pen') o.points = Array.isArray(o.points) ? o.points.filter(Array.isArray).map((p) => [num(p[0]), num(p[1])]) : [];
  if (o.type === 'table' && Array.isArray(o.cells)) o.cells = o.cells.map((r) => (Array.isArray(r) ? r.map((c) => String(c ?? '')) : []));
  // Bilder nur eingebettet (data:) – externe Adressen würden Dritten Zugriffe verraten und sind per CSP gesperrt
  if (o.type === 'image' && !(typeof o.src === 'string' && /^data:image\/(png|jpe?g|gif|webp|svg\+xml);base64,/i.test(o.src))) delete o.src;
  if (JSON.stringify(o).length > MAX_ELEMENT_BYTES) return null;
  return o;
}

module.exports = { validId, sanitizeElement, cleanJson, COLOR_RE };
