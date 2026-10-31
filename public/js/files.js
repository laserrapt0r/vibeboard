// Dateianhänge: hochladen (Werkzeug oder Ablegen auf dem Board), Vorschau der ersten PDF-Seite, Betrachter
// (PDF über pdf.js, Text direkt) und Download. Geprüft wird alles auf dem Server (Typ, Größe, Virenscan).
import { T } from './i18n.js';
import { h, api, ICONS, toast, modal } from './util.js';
import { app, getEl, act, updateEl, addElements, makeElement, viewCenter, fitTo, setSelection } from './core.js';
import { fileKind, fileSize } from './render.js';

const ACCEPT = '.pdf,.docx,.xlsx,.pptx,.odt,.ods,.odp,.doc,.xls,.ppt,.txt,.md,.csv,.json';
const TEXT = /\.(txt|md|csv|json)$/i;
const fileUrl = (el) => `/api/boards/${encodeURIComponent(app.boardId)}/files/${encodeURIComponent(el.fileId)}`;

let pdfjs = null;
async function loadPdfJs() {
  if (!pdfjs) {
    pdfjs = await import('/vendor/pdfjs/pdf.min.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc = '/vendor/pdfjs/pdf.worker.min.mjs';
  }
  return pdfjs;
}

// PDF öffnen – ohne eval (Content-Security-Policy) und ohne nachgeladene Schriften von außen
async function openPdf(data) {
  const lib = await loadPdfJs();
  return lib.getDocument({ data, isEvalSupported: false, disableFontFace: false }).promise;
}

async function renderPage(doc, n, width) {
  const page = await doc.getPage(n);
  const vp1 = page.getViewport({ scale: 1 });
  const vp = page.getViewport({ scale: (width / vp1.width) * (window.devicePixelRatio || 1) });
  const c = document.createElement('canvas');
  c.width = Math.ceil(vp.width);
  c.height = Math.ceil(vp.height);
  await page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
  return c;
}

// Text in der passenden Kodierung lesen (UTF-8, UTF-16 mit BOM, sonst Windows-1252 wie bei Excel-Exporten)
function decodeText(buf) {
  const b = new Uint8Array(buf);
  if (b[0] === 0xff && b[1] === 0xfe) return new TextDecoder('utf-16le').decode(buf);
  if (b[0] === 0xfe && b[1] === 0xff) return new TextDecoder('utf-16be').decode(buf);
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf);
  } catch {
    return new TextDecoder('windows-1252').decode(buf);
  }
}

async function upload(file, at) {
  if (app.viewOnly) return toast(T('Du darfst auf diesem Board keine Dateien anhängen.'));
  if (!/\.[a-z0-9]{1,5}$/i.test(file.name) || !ACCEPT.split(',').some((x) => file.name.toLowerCase().endsWith(x))) {
    return toast(T`„${file.name}“: Dieser Dateityp wird nicht unterstützt (PDF, Office, OpenDocument, Text, CSV, JSON).`, 5000);
  }
  toast(T`„${file.name}“ wird hochgeladen und geprüft …`, 2500);
  let info;
  try {
    const r = await fetch(`/api/boards/${encodeURIComponent(app.boardId)}/files`, {
      method: 'POST', credentials: 'same-origin', body: file,
      headers: { 'X-Vibeboard': '1', 'Content-Type': 'application/octet-stream', 'X-File-Name': encodeURIComponent(file.name) },
    });
    info = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(info.error || r.statusText);
  } catch (e) {
    return toast(`„${file.name}“: ${e.message}`, 6000);
  }
  const el = makeElement('file', at.x - 110, at.y - 130, { w: 220, h: 260, fileId: info.id, name: info.name, mime: info.mime, size: info.size });
  addElements([el]);
  if (/\.pdf$/i.test(info.name)) makePreview(el, file).catch(() => {});
}

// Vorschau der ersten Seite (PNG) – wird auf dem Server wie jedes Bild geprüft
async function makePreview(el, file) {
  const doc = await openPdf(new Uint8Array(await file.arrayBuffer()));
  const c = await renderPage(doc, 1, 420);
  const url = c.toDataURL('image/png');
  const r = await fetch(`${fileUrl(el)}/preview`, { method: 'PUT', credentials: 'same-origin', headers: { 'X-Vibeboard': '1', 'Content-Type': 'text/plain' }, body: url });
  if (!r.ok) return;
  const cur = getEl(el.id);
  if (cur) act(() => updateEl(el.id, { preview: true, pages: doc.numPages }));
}

const picker = h('input', { type: 'file', accept: ACCEPT, multiple: true, style: { display: 'none' } });
document.body.append(picker);
picker.addEventListener('change', () => {
  const c = viewCenter();
  [...picker.files].forEach((f, i) => upload(f, { x: c.x + i * 240, y: c.y }));
  picker.value = '';
});

/* ---------------- Seiten auf das Board legen ---------------- */

const OFFICE = /\.(docx?|xlsx?|pptx?|odt|ods|odp)$/i;
const MAX_PAGES = 50;
const MAX_PAGE_BYTES = 2 * 1024 * 1024;
const PAGE_WIDTH = 900;
const PAGES_PER_ROW = 4;
const PAGE_GAP = 40;
let converter = false;
api('/api/config', { quiet: true }).then((c) => (converter = !!c.officeConverter)).catch(() => {});

async function pdfBytes(el) {
  const pdf = /\.pdf$/i.test(el.name || '');
  const r = await fetch(fileUrl(el) + (pdf ? '' : '/pdf'), { credentials: 'same-origin' });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || T('Die Datei ist auf diesem Board nicht vorhanden.'));
  return new Uint8Array(await r.arrayBuffer());
}

// Jede Seite wird ein gesperrtes Bild in einem Frame: Darauf lässt sich kommentieren, zeichnen und der Frame kann zur Freigabe
async function placePages(el) {
  toast(T`„${el.name}“ wird vorbereitet …`, 3000);
  let doc;
  try {
    doc = await openPdf(await pdfBytes(el));
  } catch (e) {
    return toast(e.name === 'InvalidPDFException' ? T('Die PDF-Datei konnte nicht gelesen werden.') : e.message, 6000);
  }
  const pages = Math.min(doc.numPages, MAX_PAGES);
  const images = [];
  let rowH = 0, x = 0, y = 0, width = 0, height = 0;
  for (let n = 1; n <= pages; n++) {
    const page = await doc.getPage(n);
    const vp = page.getViewport({ scale: 1 });
    const c = await renderPage(doc, n, PAGE_WIDTH);
    const dispH = Math.round(vp.height * (PAGE_WIDTH / vp.width));
    if ((n - 1) % PAGES_PER_ROW === 0 && n > 1) {
      x = 0;
      y += rowH + PAGE_GAP;
      rowH = 0;
    }
    // Seiten mit vielen Bildern sparsamer speichern
    let src = c.toDataURL('image/jpeg', 0.85);
    if (src.length > MAX_PAGE_BYTES) src = c.toDataURL('image/jpeg', 0.6);
    images.push({ ...makeElement('image', 0, 0, { src, name: T`Seite ${n}`, fileRef: el.fileId, locked: true }), x, y, w: PAGE_WIDTH, h: dispH });
    x += PAGE_WIDTH + PAGE_GAP;
    rowH = Math.max(rowH, dispH);
    width = Math.max(width, x - PAGE_GAP);
    height = y + rowH;
  }
  const pad = 40;
  const at = { x: el.x + el.w + 80, y: el.y };
  const frame = { ...makeElement('frame', 0, 0, { title: el.name }), x: at.x, y: at.y, w: width + pad * 2, h: height + pad * 2 };
  for (const img of images) {
    img.x += at.x + pad;
    img.y += at.y + pad;
  }
  addElements([frame, ...images]);
  setSelection([frame.id]);
  fitTo({ x: frame.x, y: frame.y, w: frame.w, h: frame.h }, { maxZ: 1 });
  toast(doc.numPages > pages ? T`Die ersten ${pages} von ${doc.numPages} Seiten liegen auf dem Board.` : pages === 1 ? T('1 Seite liegt auf dem Board.') : T`${pages} Seiten liegen auf dem Board.`, 5000);
}

app.on('pickFile', () => picker.click());
app.on('dropFile', (f, at) => upload(f, at));

/* ---------------- Betrachter ---------------- */

app.on('openFile', async (id) => {
  const el = getEl(id);
  if (!el || el.hidden) return;
  const [label, color] = fileKind(el.name);
  const body = h('div', { class: 'file-viewer' });
  const dl = h('a', { class: 'btn small primary', href: el.fileId ? fileUrl(el) : '#', download: el.name || T('datei') }, h('span', { html: ICONS.download }), T('Herunterladen'));
  const m = modal(el.name || T('Datei'), h('div', {},
    h('div', { class: 'row' }, h('span', { class: 'file-kind', style: { background: color } }, label), h('span', { class: 'muted' }, fileSize(el.size) + (el.pages ? T` · Seiten: ${el.pages}` : '')),
      h('span', { class: 'spacer' }), el.fileId ? dl : null),
    body), { wide: true });
  if (!el.fileId) {
    body.append(h('p', { class: 'muted pad' }, T('Die Datei ist auf diesem Board nicht vorhanden (z. B. aus einem Import ohne Anhänge).')));
    return;
  }
  try {
    if (/\.pdf$/i.test(el.name || '')) {
      body.append(h('p', { class: 'muted small' }, T('Vorschau wird geladen …')));
      const r = await fetch(fileUrl(el), { credentials: 'same-origin' });
      if (!r.ok) throw Object.assign(new Error('missing'), { code: 'missing' });
      const doc = await openPdf(new Uint8Array(await r.arrayBuffer()));
      body.innerHTML = '';
      const width = Math.min(860, body.clientWidth || 760);
      const max = Math.min(doc.numPages, 50);
      for (let n = 1; n <= max; n++) {
        if (!document.body.contains(body)) return; // Dialog geschlossen
        const c = await renderPage(doc, n, width);
        c.className = 'pdf-page';
        c.style.width = width + 'px';
        c.setAttribute('aria-label', T`Seite ${n}`);
        body.append(c);
      }
      if (doc.numPages > max) body.append(h('p', { class: 'muted pad' }, T`Vorschau zeigt die ersten ${max} von ${doc.numPages} Seiten – die vollständige Datei gibt es per Download.`));
    } else if (TEXT.test(el.name || '')) {
      const r = await fetch(fileUrl(el), { credentials: 'same-origin' });
      if (!r.ok) throw Object.assign(new Error('missing'), { code: 'missing' });
      const txt = decodeText(await r.arrayBuffer());
      body.append(h('pre', { class: 'file-text' }, txt.slice(0, 200000) + (txt.length > 200000 ? '\n…' : '')));
    } else {
      body.append(h('div', { class: 'file-noprev' }, h('span', { class: 'file-kind big', style: { background: color } }, label),
        h('p', { class: 'muted' }, converter && !app.viewOnly && OFFICE.test(el.name || '') ? T('Über „Seiten auf das Board legen“ wird die Datei umgewandelt und lässt sich direkt auf dem Board prüfen.') : T('Für Office-Dateien gibt es im Browser keine Vorschau. Lade die Datei herunter und öffne sie mit deinem Office-Programm.'))));
    }
  } catch (e) {
    body.innerHTML = '';
    body.append(h('p', { class: 'muted pad' }, e.code === 'missing' ? T('Die Datei ist auf diesem Board nicht vorhanden.') : T('Die Vorschau konnte nicht angezeigt werden. Die Datei lässt sich aber herunterladen.')));
  }
  void m;
});

// Kontextleiste: Öffnen und Herunterladen
app.on('ctxItems', (items, sel, { one, actBtn }) => {
  if (!one || one.type !== 'file') return;
  items.push(actBtn('search', T('Öffnen / Vorschau (Doppelklick)'), () => app.emit('openFile', one.id)));
  if (one.fileId && !app.viewOnly && (/\.pdf$/i.test(one.name || '') || (converter && OFFICE.test(one.name || '')))) {
    items.push(actBtn('layers', T('Seiten auf das Board legen'), () => placePages(one)));
  }
  if (one.fileId) {
    items.push(actBtn('download', T('Herunterladen'), () => {
      const a = h('a', { href: fileUrl(one), download: one.name || 'datei' });
      document.body.append(a);
      a.click();
      a.remove();
    }));
  }
});
