// Export nach PowerPoint: Jeder Frame wird eine Folie. Text, Formen, Linien, Bilder und Tabellen bleiben in PowerPoint
// bearbeitbar, alles andere (Karten, Diagramme, Code, Zeichnungen) kommt als Bild.
import { connectorGeom, textLayout, elBounds, shownCells } from './render.js';
import { pngDataUrl } from './exporter.js';
import { writeZip } from './zip.js';

const EMU = 9525;
const SLIDE_W = 1280, SLIDE_H = 720; // 16:9 in Pixeln
const PRST = {
  rect: 'rect', roundrect: 'roundRect', ellipse: 'ellipse', triangle: 'triangle', diamond: 'diamond', hexagon: 'hexagon', parallelogram: 'parallelogram',
  trapezoid: 'trapezoid', star: 'star5', pill: 'flowChartTerminator', cloud: 'cloud', cylinder: 'can', document: 'flowChartDocument',
};
const XMLNS = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';

const x = (s) => String(s ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const emu = (v) => Math.round(v * EMU);
const hex = (c) => (/^#[0-9a-f]{6}$/i.test(c || '') ? c.slice(1).toUpperCase() : /^#[0-9a-f]{3}$/i.test(c || '') ? [...c.slice(1)].map((d) => d + d).join('').toUpperCase() : null);
const fillXml = (c) => (hex(c) ? `<a:solidFill><a:srgbClr val="${hex(c)}"/></a:solidFill>` : '<a:noFill/>');

function dataBytes(url) {
  const bin = atob(url.slice(url.indexOf(',') + 1));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function paragraphs(text, size, { color, bold, align }) {
  const pts = Math.round(Math.max(6, Math.min(200, size * 0.75)) * 100);
  const run = `<a:rPr lang="de-DE" sz="${pts}"${bold ? ' b="1"' : ''}>${hex(color) ? `<a:solidFill><a:srgbClr val="${hex(color)}"/></a:solidFill>` : ''}</a:rPr>`;
  const algn = { center: 'ctr', right: 'r', left: 'l' }[align] || 'l';
  return String(text || '').split('\n').map((l) => `<a:p><a:pPr algn="${algn}"/>${l ? `<a:r>${run}<a:t>${x(l)}</a:t></a:r>` : `<a:endParaRPr lang="de-DE" sz="${pts}"/>`}</a:p>`).join('') || '<a:p/>';
}

class Slide {
  constructor(index, media) {
    this.index = index;
    this.media = media;
    this.xml = [];
    this.rels = [`<Relationship Id="rId1" Type="${REL}/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>`];
    this.nextId = 2;
  }
  box(b) {
    return `<a:xfrm><a:off x="${emu(b.x)}" y="${emu(b.y)}"/><a:ext cx="${emu(Math.max(1, b.w))}" cy="${emu(Math.max(1, b.h))}"/></a:xfrm>`;
  }
  shape(b, { prst = 'rect', fill, stroke, width = 1, text, size = 18, color, bold, align = 'center', anchor = 'ctr', txBox = false, name = 'Form' }) {
    const id = this.nextId++;
    this.xml.push(`<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${x(name)} ${id}"/><p:cNvSpPr${txBox ? ' txBox="1"' : ''}/><p:nvPr/></p:nvSpPr><p:spPr>${this.box(b)}<a:prstGeom prst="${prst}"><a:avLst/></a:prstGeom>${fillXml(fill)}<a:ln w="${emu(width)}">${fillXml(stroke)}</a:ln></p:spPr><p:txBody><a:bodyPr wrap="square" anchor="${anchor}" lIns="45720" rIns="45720" tIns="45720" bIns="45720"><a:normAutofit/></a:bodyPr><a:lstStyle/>${paragraphs(text, size, { color, bold, align })}</p:txBody></p:sp>`);
  }
  image(b, dataUrl, crop) {
    const ext = (/^data:image\/(png|jpe?g|gif)/.exec(dataUrl) || [])[1];
    if (!ext) return false;
    const name = `image${this.media.length + 1}.${ext === 'jpeg' ? 'jpg' : ext}`;
    this.media.push({ name: 'ppt/media/' + name, data: dataBytes(dataUrl) });
    const rid = `rId${this.nextId}`;
    const id = this.nextId++;
    this.rels.push(`<Relationship Id="${rid}" Type="${REL}/image" Target="../media/${name}"/>`);
    const src = crop ? `<a:srcRect l="${Math.round(crop.x * 1e5)}" t="${Math.round(crop.y * 1e5)}" r="${Math.round((1 - crop.x - crop.w) * 1e5)}" b="${Math.round((1 - crop.y - crop.h) * 1e5)}"/>` : '';
    this.xml.push(`<p:pic><p:nvPicPr><p:cNvPr id="${id}" name="Bild ${id}"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="${rid}"/>${src}<a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr>${this.box(b)}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>`);
    return true;
  }
  line(a, b, stroke, width, arrow) {
    const id = this.nextId++;
    const flip = `${a.x > b.x ? ' flipH="1"' : ''}${a.y > b.y ? ' flipV="1"' : ''}`;
    const off = { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) };
    this.xml.push(`<p:cxnSp><p:nvCxnSpPr><p:cNvPr id="${id}" name="Linie ${id}"/><p:cNvCxnSpPr/><p:nvPr/></p:nvCxnSpPr><p:spPr><a:xfrm${flip}><a:off x="${emu(off.x)}" y="${emu(off.y)}"/><a:ext cx="${emu(off.w)}" cy="${emu(off.h)}"/></a:xfrm><a:prstGeom prst="line"><a:avLst/></a:prstGeom><a:ln w="${emu(width)}">${fillXml(stroke || '#1a1a1a')}${arrow ? '<a:tailEnd type="triangle"/>' : ''}</a:ln></p:spPr></p:cxnSp>`);
  }
  table(b, el, size) {
    const id = this.nextId++;
    const rows = shownCells(el);
    const cols = Math.max(1, ...rows.map((r) => r.length));
    const colW = el.colW && el.colW.length === cols ? el.colW : Array(cols).fill(1);
    const sum = colW.reduce((s, v) => s + v, 0) || 1;
    const rowH = b.h / Math.max(1, rows.length);
    const grid = colW.map((w) => `<a:gridCol w="${emu((b.w * w) / sum)}"/>`).join('');
    const tr = rows.map((r, i) => `<a:tr h="${emu(rowH)}">${Array.from({ length: cols }, (_, c) => `<a:tc><a:txBody><a:bodyPr/><a:lstStyle/>${paragraphs(r[c] || '', size, { bold: el.header && i === 0, align: 'left' })}</a:txBody><a:tcPr><a:lnL w="6350">${fillXml('#adb5bd')}</a:lnL><a:lnR w="6350">${fillXml('#adb5bd')}</a:lnR><a:lnT w="6350">${fillXml('#adb5bd')}</a:lnT><a:lnB w="6350">${fillXml('#adb5bd')}</a:lnB>${el.header && i === 0 ? fillXml('#e9ecef') : ''}</a:tcPr></a:tc>`).join('')}</a:tr>`).join('');
    this.xml.push(`<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="${id}" name="Tabelle ${id}"/><p:cNvGraphicFramePr><a:graphicFrameLocks noGrp="1"/></p:cNvGraphicFramePr><p:nvPr/></p:nvGraphicFramePr><p:xfrm><a:off x="${emu(b.x)}" y="${emu(b.y)}"/><a:ext cx="${emu(b.w)}" cy="${emu(b.h)}"/></p:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table"><a:tbl><a:tblGrid>${grid}</a:tblGrid>${tr}</a:tbl></a:graphicData></a:graphic></p:graphicFrame>`);
  }
  render() {
    return `${HEAD}<p:sld ${XMLNS}><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>${this.xml.join('')}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`;
  }
}

async function addElement(slide, el, map, s, get) {
  const b0 = elBounds(el, get);
  const b = map(b0);
  const size = (typeof el.fontSize === 'number' ? el.fontSize : textLayout(el, { x: 0, y: 0, w: el.w, h: el.h }).size || 18) * s;
  switch (el.type) {
    case 'sticky':
      return slide.shape(b, { fill: el.fill || '#fff9b1', text: el.text, size, color: el.textColor || '#1a1a1a', bold: el.bold, align: el.align || 'center', name: 'Notiz' });
    case 'text':
      return slide.shape(b, { text: el.text, size, color: el.textColor || '#1a1a1a', bold: el.bold, align: el.align || 'left', anchor: 't', txBox: true, name: 'Text' });
    case 'shape':
      if (PRST[el.shape || 'rect']) {
        return slide.shape(b, { prst: PRST[el.shape || 'rect'], fill: el.fill, stroke: el.stroke, width: el.strokeWidth ?? 2, text: el.text, size, color: el.textColor || '#1a1a1a', bold: el.bold, align: el.align || 'center' });
      }
      break;
    case 'image':
      if (el.src && slide.image(b, el.src, el.crop)) return undefined;
      break;
    case 'table':
      return slide.table(b, el, size);
    case 'connector': {
      const g = connectorGeom(el, get);
      if (g && g.poly && g.poly.length > 1) {
        // Kurven werden in PowerPoint zur geraden Linie, Ecken bleiben erhalten
        const pts = (el.routing || 'curve') === 'curve' ? [g.p1, g.p2] : g.poly;
        for (let i = 1; i < pts.length; i++) {
          const last = i === pts.length - 1;
          slide.line(map({ ...pts[i - 1], w: 0, h: 0 }), map({ ...pts[i], w: 0, h: 0 }), el.stroke, el.strokeWidth || 2, last && el.arrowEnd !== false && el.arrowEnd !== 'none');
        }
      }
      return undefined;
    }
    default:
  }
  if (el.type === 'comment' || el.hidden) return undefined;
  // Alles andere als Bild, damit nichts verloren geht
  const url = await pngDataUrl([el], { scale: 2, maxSize: 2000, padding: 0, background: 'transparent', bounds: b0, redactPrivate: true }).catch(() => null);
  if (url) slide.image(b, url);
  return undefined;
}

const THEME = `${HEAD}<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="vibeboard"><a:themeElements><a:clrScheme name="vibeboard"><a:dk1><a:srgbClr val="1A1A1A"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="44546A"/></a:dk2><a:lt2><a:srgbClr val="E7E6E6"/></a:lt2><a:accent1><a:srgbClr val="4262FF"/></a:accent1><a:accent2><a:srgbClr val="12B886"/></a:accent2><a:accent3><a:srgbClr val="F59F00"/></a:accent3><a:accent4><a:srgbClr val="E64980"/></a:accent4><a:accent5><a:srgbClr val="7048E8"/></a:accent5><a:accent6><a:srgbClr val="1098AD"/></a:accent6><a:hlink><a:srgbClr val="4262FF"/></a:hlink><a:folHlink><a:srgbClr val="7048E8"/></a:folHlink></a:clrScheme><a:fontScheme name="vibeboard"><a:majorFont><a:latin typeface="Arial"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="Arial"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme><a:fmtScheme name="vibeboard"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst><a:lnStyleLst><a:ln w="6350"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="12700"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln><a:ln w="19050"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme></a:themeElements></a:theme>`;
const TREE = '<p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree>';

/**
 * slides: [{ bounds, elements }]; get: Nachschlagen von Elementen (Verbindungen).
 * Liefert die Datei als Blob.
 */
export async function buildPptx(slides, get) {
  const media = [];
  const parts = [];
  for (let i = 0; i < slides.length; i++) {
    const { bounds, elements } = slides[i];
    const s = Math.min(SLIDE_W / (bounds.w || 1), SLIDE_H / (bounds.h || 1));
    const ox = (SLIDE_W - bounds.w * s) / 2, oy = (SLIDE_H - bounds.h * s) / 2;
    const map = (b) => ({ x: ox + (b.x - bounds.x) * s, y: oy + (b.y - bounds.y) * s, w: (b.w || 0) * s, h: (b.h || 0) * s });
    const slide = new Slide(i + 1, media);
    for (const el of elements) await addElement(slide, el, map, s, get);
    parts.push({ name: `ppt/slides/slide${i + 1}.xml`, data: slide.render() });
    parts.push({ name: `ppt/slides/_rels/slide${i + 1}.xml.rels`, data: `${HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${slide.rels.join('')}</Relationships>` });
  }
  const types = ['jpg', 'jpeg', 'png', 'gif'].map((e) => `<Default Extension="${e}" ContentType="image/${e === 'jpg' ? 'jpeg' : e}"/>`).join('');
  const overrides = slides.map((_, i) => `<Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join('');
  const contentTypes = `${HEAD}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${types}<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/><Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/><Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>${overrides}</Types>`;
  const ids = slides.map((_, i) => `<p:sldId id="${256 + i}" r:id="rId${i + 2}"/>`).join('');
  const presentation = `${HEAD}<p:presentation ${XMLNS}><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldIdLst>${ids}</p:sldIdLst><p:sldSz cx="${SLIDE_W * EMU}" cy="${SLIDE_H * EMU}"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>`;
  const presRels = `${HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${REL}/slideMaster" Target="slideMasters/slideMaster1.xml"/>${slides.map((_, i) => `<Relationship Id="rId${i + 2}" Type="${REL}/slide" Target="slides/slide${i + 1}.xml"/>`).join('')}<Relationship Id="rId${slides.length + 2}" Type="${REL}/theme" Target="theme/theme1.xml"/></Relationships>`;
  const master = `${HEAD}<p:sldMaster ${XMLNS}><p:cSld><p:bg><p:bgRef idx="1001"><a:schemeClr val="bg1"/></p:bgRef></p:bg>${TREE}</p:cSld><p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/><p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst></p:sldMaster>`;
  const layout = `${HEAD}<p:sldLayout ${XMLNS} type="blank" preserve="1"><p:cSld name="Leer">${TREE}</p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`;
  const rel = (items) => `${HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${items}</Relationships>`;
  return writeZip([
    { name: '[Content_Types].xml', data: contentTypes },
    { name: '_rels/.rels', data: rel(`<Relationship Id="rId1" Type="${REL}/officeDocument" Target="ppt/presentation.xml"/>`) },
    { name: 'ppt/presentation.xml', data: presentation },
    { name: 'ppt/_rels/presentation.xml.rels', data: presRels },
    { name: 'ppt/theme/theme1.xml', data: THEME },
    { name: 'ppt/slideMasters/slideMaster1.xml', data: master },
    { name: 'ppt/slideMasters/_rels/slideMaster1.xml.rels', data: rel(`<Relationship Id="rId1" Type="${REL}/slideLayout" Target="../slideLayouts/slideLayout1.xml"/><Relationship Id="rId2" Type="${REL}/theme" Target="../theme/theme1.xml"/>`) },
    { name: 'ppt/slideLayouts/slideLayout1.xml', data: layout },
    { name: 'ppt/slideLayouts/_rels/slideLayout1.xml.rels', data: rel(`<Relationship Id="rId1" Type="${REL}/slideMaster" Target="../slideMasters/slideMaster1.xml"/>`) },
    ...parts, ...media,
  ]);
}
