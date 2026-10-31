// Import von draw.io-Dateien (.drawio, .xml): Formen, Text, Verbindungen und Seiten werden zu normalen Board-Elementen
import { uid } from './util.js';
import { inflateRaw } from './zip.js';

const SHAPES = {
  rhombus: 'diamond', ellipse: 'ellipse', triangle: 'triangle', hexagon: 'hexagon', parallelogram: 'parallelogram', trapezoid: 'trapezoid',
  cylinder: 'cylinder', cylinder3: 'cylinder', cloud: 'cloud', document: 'document', process: 'subprocess', note: 'note', step: 'pill', actor: 'actor',
  umlActor: 'actor', 'mxgraph.flowchart.decision': 'diamond', 'mxgraph.flowchart.terminator': 'pill',
};
const PAGE_GAP = 200;

function parseStyle(s) {
  const out = {};
  for (const part of String(s || '').split(';')) {
    if (!part) continue;
    const i = part.indexOf('=');
    if (i < 0) out[part] = '1';
    else out[part.slice(0, i)] = part.slice(i + 1);
  }
  return out;
}

const color = (v) => (/^#[0-9a-f]{3,8}$/i.test(v || '') ? v : undefined);

// Beschriftungen sind oft HTML: nur der Text interessiert, niemals das Markup
function plain(value) {
  const s = String(value || '');
  if (!/[<&]/.test(s)) return s;
  const doc = new DOMParser().parseFromString(s.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(div|p)>/gi, '\n'), 'text/html');
  return (doc.body.textContent || '').replace(/\n{3,}/g, '\n\n').trim();
}

async function decodeDiagram(node) {
  const direct = node.querySelector('mxGraphModel');
  if (direct) return direct;
  const text = node.textContent.trim();
  if (!text) return null;
  const bytes = Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
  const xml = decodeURIComponent(new TextDecoder().decode(await inflateRaw(bytes)));
  return new DOMParser().parseFromString(xml, 'application/xml').documentElement;
}

function geometry(cell) {
  const g = cell.querySelector(':scope > mxGeometry');
  if (!g) return { x: 0, y: 0, w: 0, h: 0, points: [] };
  const n = (k) => Number(g.getAttribute(k)) || 0;
  const pt = (as) => {
    const p = g.querySelector(`:scope > mxPoint[as="${as}"]`);
    return p ? { x: Number(p.getAttribute('x')) || 0, y: Number(p.getAttribute('y')) || 0 } : null;
  };
  const arr = g.querySelector(':scope > Array[as="points"]');
  const points = arr ? [...arr.querySelectorAll('mxPoint')].map((p) => ({ x: Number(p.getAttribute('x')) || 0, y: Number(p.getAttribute('y')) || 0 })) : [];
  return { x: n('x'), y: n('y'), w: n('width'), h: n('height'), points, source: pt('sourcePoint'), target: pt('targetPoint') };
}

function vertex(st, value, g) {
  const base = { x: g.x, y: g.y, w: Math.max(10, g.w), h: Math.max(10, g.h) };
  const text = plain(value);
  const fs = Number(st.fontSize) || 14;
  if (st.text) return { ...base, type: 'text', text, fontSize: fs, textColor: color(st.fontColor), align: st.align || 'left' };
  if (st.swimlane) return { ...base, type: 'frame', title: text };
  if (st.shape === 'image' || st.image) {
    if (/^data:image\/(png|jpe?g|gif|webp);base64,/.test(st.image || '')) return { ...base, type: 'image', src: st.image };
  }
  const key = st.shape || Object.keys(st).find((k) => SHAPES[k]);
  const shape = SHAPES[key] || (st.rounded === '1' ? 'roundrect' : 'rect');
  return {
    ...base, type: 'shape', shape, text, fontSize: fs, strokeWidth: Number(st.strokeWidth) || 2,
    fill: st.fillColor === 'none' ? 'transparent' : color(st.fillColor) || '#ffffff', stroke: st.strokeColor === 'none' ? 'transparent' : color(st.strokeColor) || '#1a1a1a',
    textColor: color(st.fontColor), bold: (Number(st.fontStyle) & 1) === 1 || undefined,
  };
}

async function readPage(model, offsetX) {
  const cells = [...model.querySelectorAll('mxCell')];
  const info = new Map(cells.map((c) => [c.getAttribute('id'), c]));
  const out = [];
  const ids = new Map();
  // Kinder geben ihre Position relativ zum Eltern-Element an
  const origin = (id) => {
    const c = info.get(id);
    if (!c || c.getAttribute('vertex') !== '1') return { x: 0, y: 0 };
    const g = geometry(c);
    const p = origin(c.getAttribute('parent'));
    return { x: p.x + g.x, y: p.y + g.y };
  };
  const vertices = cells.filter((c) => c.getAttribute('vertex') === '1');
  const labels = new Map();
  for (const c of vertices) {
    const st = parseStyle(c.getAttribute('style'));
    if (st.edgeLabel) {
      labels.set(c.getAttribute('parent'), plain(c.getAttribute('value')));
      continue;
    }
    const pos = origin(c.getAttribute('id'));
    const el = vertex(st, c.getAttribute('value'), { ...geometry(c), x: pos.x + offsetX, y: pos.y });
    el.id = uid();
    ids.set(c.getAttribute('id'), el.id);
    out.push(el);
  }
  for (const c of cells.filter((x) => x.getAttribute('edge') === '1')) {
    const st = parseStyle(c.getAttribute('style'));
    const g = geometry(c);
    const end = (attr, p) => {
      const id = ids.get(c.getAttribute(attr));
      if (id) return { id };
      return p ? { x: p.x + offsetX, y: p.y } : { x: offsetX, y: 0 };
    };
    out.push({
      id: uid(), type: 'connector', from: end('source', g.source), to: end('target', g.target),
      routing: st.edgeStyle ? (st.curved === '1' ? 'curved' : 'elbow') : 'straight',
      waypoints: g.points.map((p) => ({ x: p.x + offsetX, y: p.y })),
      stroke: color(st.strokeColor) || '#1a1a1a', strokeWidth: Number(st.strokeWidth) || 2,
      arrowEnd: st.endArrow === 'none' ? false : true, arrowStart: st.startArrow && st.startArrow !== 'none' ? true : undefined,
      dash: st.dashed === '1' ? 'dashed' : undefined,
      label: plain(c.getAttribute('value')) || labels.get(c.getAttribute('id')) || undefined,
    });
  }
  return out;
}

export async function parseDrawio(text) {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.querySelector('parsererror')) throw new Error('xml');
  const root = doc.documentElement;
  const models = root.nodeName === 'mxGraphModel' ? [root] : await Promise.all([...doc.querySelectorAll('diagram')].map(decodeDiagram));
  if (!models.length) throw new Error('xml');
  const out = [];
  let x = 0;
  for (const m of models.filter(Boolean)) {
    const page = await readPage(m, x);
    const right = page.filter((e) => e.type !== 'connector').map((e) => e.x + e.w);
    if (right.length) x = Math.max(...right) + PAGE_GAP;
    out.push(...page);
  }
  return out.map((e, i) => ({ ...e, z: i + 1 }));
}
