// Import von PowerPoint (.pptx): Jede Folie wird ein Frame, Texte, Formen, Bilder, Linien und Tabellen bleiben bearbeitbar
import { uid } from './util.js';
import { readZip } from './zip.js';

const EMU = 9525; // Einheiten je Pixel bei 96 dpi
const SLIDE_GAP = 120;
const MAX_IMAGE = 6 * 1024 * 1024;
const NS = { a: 'http://schemas.openxmlformats.org/drawingml/2006/main', p: 'http://schemas.openxmlformats.org/presentationml/2006/main', r: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships' };
const GEOM = {
  rect: 'rect', roundRect: 'roundrect', ellipse: 'ellipse', triangle: 'triangle', diamond: 'diamond', hexagon: 'hexagon', parallelogram: 'parallelogram',
  trapezoid: 'trapezoid', star5: 'star', cloud: 'cloud', can: 'cylinder', flowChartProcess: 'rect', flowChartDecision: 'diamond', flowChartTerminator: 'pill', flowChartDocument: 'document',
};
const MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp' };

const xml = (s) => new DOMParser().parseFromString(s, 'application/xml');
const q = (el, ns, name) => (el ? el.getElementsByTagNameNS(NS[ns], name)[0] || null : null);
const all = (el, ns, name) => (el ? [...el.getElementsByTagNameNS(NS[ns], name)] : []);
const kids = (el) => [...el.children];
const child = (el, name) => (el ? kids(el).find((c) => c.localName === name) || null : null);

async function rels(zip, path) {
  const dir = path.slice(0, path.lastIndexOf('/'));
  const file = path.slice(path.lastIndexOf('/') + 1);
  const text = await zip.text(`${dir}/_rels/${file}.rels`);
  const map = new Map();
  if (!text) return map;
  for (const r of xml(text).documentElement.children) {
    const target = r.getAttribute('Target');
    const parts = (target.startsWith('/') ? target.slice(1) : `${dir}/${target}`).split('/');
    const norm = [];
    for (const p of parts) {
      if (p === '..') norm.pop();
      else if (p !== '.') norm.push(p);
    }
    map.set(r.getAttribute('Id'), { type: r.getAttribute('Type'), path: norm.join('/') });
  }
  return map;
}

function xfrmOf(spPr) {
  const x = child(spPr, 'xfrm');
  if (!x) return null;
  const off = child(x, 'off'), ext = child(x, 'ext');
  if (!off || !ext) return null;
  return {
    x: +off.getAttribute('x') / EMU, y: +off.getAttribute('y') / EMU, w: +ext.getAttribute('cx') / EMU, h: +ext.getAttribute('cy') / EMU,
    flipH: x.getAttribute('flipH') === '1', flipV: x.getAttribute('flipV') === '1',
  };
}

const solid = (node) => {
  const fill = child(node, 'solidFill');
  const rgb = fill && child(fill, 'srgbClr');
  return rgb ? '#' + rgb.getAttribute('val') : undefined;
};

function textOf(txBody) {
  if (!txBody) return { text: '' };
  const paras = kids(txBody).filter((c) => c.localName === 'p');
  const lines = [];
  let size, bold, color, align;
  for (const p of paras) {
    let line = '';
    const pPr = child(p, 'pPr');
    if (pPr && pPr.getAttribute('algn') && !align) align = { ctr: 'center', r: 'right', l: 'left' }[pPr.getAttribute('algn')];
    for (const r of kids(p)) {
      if (r.localName === 'br') line += '\n';
      if (r.localName !== 'r' && r.localName !== 'fld') continue;
      line += child(r, 't')?.textContent || '';
      const rPr = child(r, 'rPr');
      if (rPr) {
        if (!size && rPr.getAttribute('sz')) size = (+rPr.getAttribute('sz') / 100) * (96 / 72);
        if (bold === undefined && rPr.getAttribute('b')) bold = rPr.getAttribute('b') === '1';
        color = color || solid(rPr);
      }
    }
    lines.push(line);
  }
  return { text: lines.join('\n').trim(), size, bold, color, align };
}

function placeholders(doc) {
  const map = new Map();
  for (const sp of all(doc, 'p', 'sp')) {
    const ph = q(sp, 'p', 'ph');
    const box = xfrmOf(child(sp, 'spPr'));
    if (!ph || !box) continue;
    map.set('idx:' + ph.getAttribute('idx'), box);
    if (ph.getAttribute('type')) map.set('type:' + ph.getAttribute('type'), box);
  }
  return map;
}

function inherited(sp, layout, master) {
  const ph = q(sp, 'p', 'ph');
  if (!ph) return null;
  const type = ph.getAttribute('type');
  const keys = ['idx:' + ph.getAttribute('idx'), 'type:' + type, type === 'ctrTitle' ? 'type:title' : '', type === 'subTitle' ? 'type:body' : ''];
  for (const m of [layout, master]) for (const k of keys) if (m.has(k)) return m.get(k);
  return null;
}

async function dataUrl(zip, path) {
  const ext = (/\.([a-z0-9]+)$/i.exec(path) || [])[1]?.toLowerCase();
  const mime = MIME[ext];
  const bytes = mime && await zip.read(path);
  if (!bytes || bytes.length > MAX_IMAGE) return null;
  let bin = '';
  for (let i = 0; i < bytes.length; i += 32768) bin += String.fromCharCode(...bytes.subarray(i, i + 32768));
  return `data:${mime};base64,${btoa(bin)}`;
}

async function readShapes(zip, tree, map, ctx, tx) {
  const out = [];
  const place = (b) => ({ x: ctx.x + tx.ox + b.x * tx.sx, y: ctx.y + tx.oy + b.y * tx.sy, w: Math.max(2, b.w * tx.sx), h: Math.max(2, b.h * tx.sy) });
  for (const node of kids(tree)) {
    const kind = node.localName;
    if (kind === 'sp') {
      const spPr = child(node, 'spPr');
      const box = xfrmOf(spPr) || inherited(node, ctx.layout, ctx.master);
      if (!box) continue;
      const t = textOf(child(node, 'txBody'));
      const geom = child(spPr, 'prstGeom')?.getAttribute('prst');
      const fill = solid(spPr);
      const ln = child(spPr, 'ln');
      const isText = node.getElementsByTagNameNS(NS.p, 'cNvSpPr')[0]?.getAttribute('txBox') === '1' || (!geom && !fill) || (geom === 'rect' && !fill && !solid(ln || spPr) && t.text);
      if (!t.text && !fill && !ln) continue;
      const fontSize = Math.round(t.size || 18);
      if (isText) out.push({ id: uid(), type: 'text', ...place(box), text: t.text, fontSize, bold: t.bold || undefined, textColor: t.color, align: t.align || 'left', autoHeight: false });
      else out.push({ id: uid(), type: 'shape', shape: GEOM[geom] || 'rect', ...place(box), text: t.text, fontSize, bold: t.bold || undefined, textColor: t.color, fill: fill || 'transparent', stroke: (ln && solid(ln)) || (fill ? 'transparent' : '#1a1a1a'), strokeWidth: 2 });
    } else if (kind === 'pic') {
      const box = xfrmOf(child(node, 'spPr'));
      const id = q(node, 'a', 'blip')?.getAttributeNS(NS.r, 'embed');
      const src = id && map.has(id) ? await dataUrl(zip, map.get(id).path) : null;
      if (!box) continue;
      if (src) out.push({ id: uid(), type: 'image', ...place(box), src });
      else ctx.skipped.images++;
    } else if (kind === 'cxnSp') {
      const box = xfrmOf(child(node, 'spPr'));
      if (!box) continue;
      const b = place(box);
      const ln = child(child(node, 'spPr'), 'ln');
      const [x1, x2] = box.flipH ? [b.x + b.w, b.x] : [b.x, b.x + b.w];
      const [y1, y2] = box.flipV ? [b.y + b.h, b.y] : [b.y, b.y + b.h];
      out.push({ id: uid(), type: 'connector', from: { x: x1, y: y1 }, to: { x: x2, y: y2 }, routing: 'straight', stroke: (ln && solid(ln)) || '#1a1a1a', strokeWidth: 2, arrowEnd: ln && child(ln, 'tailEnd') ? true : false });
    } else if (kind === 'graphicFrame') {
      const tbl = q(node, 'a', 'tbl');
      const x = child(node, 'xfrm');
      if (!tbl || !x) {
        ctx.skipped.other++;
        continue;
      }
      const off = child(x, 'off'), ext = child(x, 'ext');
      const box = { x: +off.getAttribute('x') / EMU, y: +off.getAttribute('y') / EMU, w: +ext.getAttribute('cx') / EMU, h: +ext.getAttribute('cy') / EMU };
      const rows = kids(tbl).filter((c) => c.localName === 'tr').map((tr) => kids(tr).filter((c) => c.localName === 'tc').map((tc) => textOf(child(tc, 'txBody')).text));
      const cols = Math.max(1, ...rows.map((r) => r.length));
      const widths = all(tbl, 'a', 'gridCol').map((g) => +g.getAttribute('w'));
      const sum = widths.reduce((s, v) => s + v, 0) || 1;
      out.push({ id: uid(), type: 'table', ...place(box), rows: rows.length, cols, cells: rows.map((r) => [...r, ...Array(cols - r.length).fill('')]), header: true, fontSize: 14, ...(widths.length === cols ? { colW: widths.map((w) => w / sum) } : {}) });
    } else if (kind === 'grpSp') {
      const pr = child(child(node, 'grpSpPr'), 'xfrm');
      if (!pr) continue;
      const n = (el, k) => +el.getAttribute(k) / EMU;
      const off = child(pr, 'off'), ext = child(pr, 'ext'), chOff = child(pr, 'chOff'), chExt = child(pr, 'chExt');
      const sx = n(ext, 'cx') / (n(chExt, 'cx') || 1), sy = n(ext, 'cy') / (n(chExt, 'cy') || 1);
      out.push(...await readShapes(zip, node, map, ctx, {
        sx: tx.sx * sx, sy: tx.sy * sy, ox: tx.ox + (n(off, 'x') - n(chOff, 'x') * sx) * tx.sx, oy: tx.oy + (n(off, 'y') - n(chOff, 'y') * sy) * tx.sy,
      }));
    } else if (!['nvGrpSpPr', 'grpSpPr'].includes(kind)) ctx.skipped.other++;
  }
  return out;
}

const shapeTree = (doc) => q(q(doc, 'p', 'cSld'), 'p', 'spTree');

export async function parsePptx(buffer) {
  const zip = await readZip(buffer);
  const presPath = 'ppt/presentation.xml';
  const presText = await zip.text(presPath);
  if (!presText) throw new Error('pptx');
  const pres = xml(presText);
  const size = q(pres, 'p', 'sldSz');
  const w = +size.getAttribute('cx') / EMU, h = +size.getAttribute('cy') / EMU;
  const presRels = await rels(zip, presPath);
  const skipped = { images: 0, other: 0 };
  const out = [];
  let index = 0;
  for (const s of all(pres, 'p', 'sldId')) {
    const rel = presRels.get(s.getAttributeNS(NS.r, 'id'));
    if (!rel) continue;
    const doc = xml(await zip.text(rel.path));
    const map = await rels(zip, rel.path);
    const layoutRel = [...map.values()].find((r) => r.type.endsWith('/slideLayout'));
    let layout = new Map(), master = new Map();
    if (layoutRel) {
      layout = placeholders(xml(await zip.text(layoutRel.path)));
      const masterRel = [...(await rels(zip, layoutRel.path)).values()].find((r) => r.type.endsWith('/slideMaster'));
      if (masterRel) master = placeholders(xml(await zip.text(masterRel.path)));
    }
    const x = index * (w + SLIDE_GAP);
    const title = all(doc, 'p', 'sp').map((sp) => (q(sp, 'p', 'ph')?.getAttribute('type') || '').toLowerCase().includes('title') ? textOf(child(sp, 'txBody')).text : '').find(Boolean);
    index++;
    out.push({ id: uid(), type: 'frame', x, y: 0, w, h, title: title || `Slide ${index}`, order: index, fill: '#ffffff' });
    out.push(...await readShapes(zip, shapeTree(doc), map, { x, y: 0, layout, master, skipped }, { sx: 1, sy: 1, ox: 0, oy: 0 }));
  }
  return { elements: out.map((e, i) => ({ ...e, z: i + 1 })), skipped };
}
