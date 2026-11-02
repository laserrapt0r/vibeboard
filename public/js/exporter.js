// Export: SVG, PNG, JSON, PDF (Datei und Druck), Vorschaubilder
import { T } from './i18n.js';
import { renderSvgDocument } from './render.js';
import { esc } from './util.js';

export function download(name, blobOrUrl) {
  const a = document.createElement('a');
  const url = typeof blobOrUrl === 'string' ? blobOrUrl : URL.createObjectURL(blobOrUrl);
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  if (typeof blobOrUrl !== 'string') setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function safeName(s) {
  return String(s || 'board').replace(/[^\p{L}\p{N}_.-]+/gu, '_').slice(0, 80);
}

export function svgString(elements, opts) {
  return renderSvgDocument(elements, opts).svg;
}

async function renderCanvas(elements, { scale = 2, maxSize = 8000, background = '#ffffff', bounds, padding, redactPrivate, seesConcealed = true } = {}) {
  const { svg, viewBox } = renderSvgDocument(elements, { background, bounds, padding, redactPrivate, seesConcealed });
  let s = scale;
  if (viewBox.w * s > maxSize || viewBox.h * s > maxSize) s = Math.min(maxSize / viewBox.w, maxSize / viewBox.h);
  const w = Math.max(1, Math.round(viewBox.w * s)), h = Math.max(1, Math.round(viewBox.h * s));
  const img = new Image();
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    await new Promise((res, rej) => {
      img.onload = res;
      img.onerror = () => rej(new Error(T('SVG konnte nicht gerendert werden')));
      img.src = url;
    });
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0, w, h);
    return { canvas: c, viewBox };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function pngDataUrl(elements, opts) {
  return (await renderCanvas(elements, opts)).canvas.toDataURL('image/png');
}

export async function thumbnail(elements) {
  if (!elements.length) return null;
  // Vorschaubilder sehen alle Mitglieder – private Inhalte und verborgene Bereiche bleiben verdeckt
  const hidden = globalThis.ConcealOps ? globalThis.ConcealOps.concealedIds(elements) : new Set();
  return pngDataUrl(elements.filter((e) => !hidden.has(e.id)), { scale: 1, maxSize: 480, padding: 20, redactPrivate: true, seesConcealed: false });
}

/* ------------------------------ PDF-Datei ------------------------------ */

const PDF_MAX_SIDE = 2400, PDF_MAX_SIDE_MANY = 1600, PDF_MANY_PAGES = 30;
const PDF_QUALITY = 0.88;
const PDF_MAX_BYTES = 300 * 1024 * 1024;
const PDF_MAX_PT = 14400; // Grenze des Formats: 200 Zoll je Seite

const ascii = (s) => Uint8Array.from(s, (c) => c.charCodeAt(0));

// Texte stehen als UTF-16 in Hexadezimalschreibweise in der Datei: Das kommt ohne jedes Maskieren aus
function pdfText(s) {
  let hex = 'FEFF';
  for (let i = 0; i < s.length; i++) hex += s.charCodeAt(i).toString(16).padStart(4, '0').toUpperCase();
  return `<${hex}>`;
}

/**
 * Minimale PDF-Datei: Je Seite ein JPEG, das die Seite ganz ausfüllt, dazu Lesezeichen und Dokumenttitel.
 * pages: [{ jpeg: Uint8Array, px: { w, h }, pt: { w, h }, title }]
 */
export function buildPdf(pages, title) {
  const parts = [];
  const offsets = [];
  let pos = 0;
  const push = (b) => {
    parts.push(b);
    pos += b.length;
  };
  const object = (n, ...chunks) => {
    offsets[n] = pos;
    push(ascii(`${n} 0 obj\n`));
    chunks.forEach((c) => push(typeof c === 'string' ? ascii(c) : c));
    push(ascii('\nendobj\n'));
  };
  const num = (v) => String(Math.round(v * 100) / 100);
  // Feste Nummern: 1 Katalog, 2 Seitenbaum, 3 Angaben, 4 Lesezeichen, dann je Seite Seite, Inhalt, Bild und Lesezeichen
  const FIRST = 5, PER_PAGE = 4;
  const at = (i, k) => FIRST + i * PER_PAGE + k;
  push(ascii('%PDF-1.4\n'));
  push(Uint8Array.of(0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a)); // Kennzeichen für Binärdaten
  object(1, `<< /Type /Catalog /Pages 2 0 R /Outlines 4 0 R /PageMode /UseOutlines >>`);
  object(2, `<< /Type /Pages /Count ${pages.length} /Kids [${pages.map((_, i) => `${at(i, 0)} 0 R`).join(' ')}] >>`);
  object(3, `<< /Title ${pdfText(title)} /Producer (vibeboard) >>`);
  object(4, `<< /Type /Outlines /First ${at(0, 3)} 0 R /Last ${at(pages.length - 1, 3)} 0 R /Count ${pages.length} >>`);
  pages.forEach((p, i) => {
    const content = `q ${num(p.pt.w)} 0 0 ${num(p.pt.h)} 0 0 cm /Im0 Do Q`;
    object(at(i, 0), `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${num(p.pt.w)} ${num(p.pt.h)}] /Resources << /XObject << /Im0 ${at(i, 2)} 0 R >> >> /Contents ${at(i, 1)} 0 R >>`);
    object(at(i, 1), `<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
    object(at(i, 2), `<< /Type /XObject /Subtype /Image /Width ${p.px.w} /Height ${p.px.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpeg.length} >>\nstream\n`, p.jpeg, '\nendstream');
    const links = `${i ? `/Prev ${at(i - 1, 3)} 0 R ` : ''}${i < pages.length - 1 ? `/Next ${at(i + 1, 3)} 0 R ` : ''}`;
    object(at(i, 3), `<< /Title ${pdfText(p.title)} /Parent 4 0 R ${links}/Dest [${at(i, 0)} 0 R /Fit] >>`);
  });
  const size = FIRST + pages.length * PER_PAGE;
  const start = pos;
  let xref = `xref\n0 ${size}\n0000000000 65535 f \n`;
  for (let n = 1; n < size; n++) xref += `${String(offsets[n]).padStart(10, '0')} 00000 n \n`;
  push(ascii(`${xref}trailer\n<< /Size ${size} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${start}\n%%EOF\n`));
  return new Blob(parts, { type: 'application/pdf' });
}

/**
 * Liefert die PDF-Datei als Blob. list: [{ elements, bounds, padding, title }] in Seitenreihenfolge.
 * Gerendert wird Seite für Seite und jede Leinwand gleich wieder freigegeben: Sonst läge bei großen Boards alles zugleich im Speicher.
 */
export async function pdfFile(list, title, onPage = () => {}) {
  const maxSize = list.length > PDF_MANY_PAGES ? PDF_MAX_SIDE_MANY : PDF_MAX_SIDE;
  const pages = [];
  let total = 0;
  for (let i = 0; i < list.length; i++) {
    onPage(i + 1, list.length);
    const { elements, bounds, padding, title: name } = list[i];
    const { canvas, viewBox } = await renderCanvas(elements, { bounds, padding, scale: 2, maxSize, background: '#ffffff' });
    const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', PDF_QUALITY));
    if (!blob) throw new Error(T('Die Seite ist zu groß für diesen Browser.'));
    const px = { w: canvas.width, h: canvas.height };
    canvas.width = canvas.height = 0;
    total += blob.size;
    if (total > PDF_MAX_BYTES) throw new Error(T('Die PDF-Datei würde zu groß. Exportiere weniger Frames oder drucke das Board als PDF.'));
    // 96 Punkte je Zoll wie auf dem Board, zu große Frames werden auf das Höchstmaß des Formats verkleinert
    const fit = Math.min(0.75, PDF_MAX_PT / viewBox.w, PDF_MAX_PT / viewBox.h);
    pages.push({ jpeg: new Uint8Array(await blob.arrayBuffer()), px, pt: { w: viewBox.w * fit, h: viewBox.h * fit }, title: name });
  }
  return buildPdf(pages, title);
}

const PRINT_IMAGES_MS = 30000;

// document.images kennt die <image> in SVG nicht. Fehlerhafte Bilder und ein Zeitlimit halten den Druck nicht auf.
function imagesLoaded(doc) {
  const each = [...doc.querySelectorAll('image')].map((img) => new Promise((done) => {
    img.addEventListener('load', done, { once: true });
    img.addEventListener('error', done, { once: true });
  }));
  return Promise.race([Promise.all(each), new Promise((done) => setTimeout(done, PRINT_IMAGES_MS))]);
}

/* Jede Seite wird zu einer Druckseite. Die Seiten bleiben Vektorgrafik, so lässt sich der Text im Ergebnis markieren. */
export async function printFrames(list, rawTitle) {
  const title = esc(rawTitle);
  const win = window.open('', '_blank');
  if (!win) throw new Error(T('Pop-up wurde blockiert'));
  win.document.write(`<!doctype html><title>${title}</title><p style="font-family:sans-serif">${T('PDF wird vorbereitet …')}</p>`);
  // Der viewBox schneidet auf die Seite zu
  const pages = list.map(({ elements, bounds, padding }) => renderSvgDocument(elements, { bounds, padding }).svg);
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>
    @page { size: landscape; margin: 10mm; }
    body { margin: 0; }
    .p { page-break-after: always; display: flex; align-items: center; justify-content: center; height: 95vh; }
    .p:last-child { page-break-after: auto; }
    svg { max-width: 100%; max-height: 100%; width: auto; height: auto; }
  </style></head><body>${pages.map((p) => `<div class="p">${p}</div>`).join('')}</body></html>`;
  win.document.open();
  win.document.write(html);
  win.document.close();
  // Druckdialog von hier aus öffnen (Inline-Skripte im Druckfenster verbietet die Content-Security-Policy)
  await imagesLoaded(win.document);
  win.focus();
  win.print();
}
