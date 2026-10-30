// Dateianhänge: hochladen (Werkzeug oder Ablegen auf dem Board), Vorschau der ersten PDF-Seite, Betrachter
// (PDF über pdf.js, Text direkt) und Download. Geprüft wird alles auf dem Server (Typ, Größe, Virenscan).
import { h, ICONS, toast, modal } from './util.js';
import { app, getEl, act, updateEl, addElements, makeElement, viewCenter } from './core.js';
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
  if (app.viewOnly) return toast('Du darfst auf diesem Board keine Dateien anhängen.');
  if (!/\.[a-z0-9]{1,5}$/i.test(file.name) || !ACCEPT.split(',').some((x) => file.name.toLowerCase().endsWith(x))) {
    return toast(`„${file.name}“: Dieser Dateityp wird nicht unterstützt (PDF, Office, OpenDocument, Text, CSV, JSON).`, 5000);
  }
  toast(`„${file.name}“ wird hochgeladen und geprüft …`, 2500);
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

app.on('pickFile', () => picker.click());
app.on('dropFile', (f, at) => upload(f, at));

/* ---------------- Betrachter ---------------- */

app.on('openFile', async (id) => {
  const el = getEl(id);
  if (!el || el.hidden) return;
  const [label, color] = fileKind(el.name);
  const body = h('div', { class: 'file-viewer' });
  const dl = h('a', { class: 'btn small primary', href: el.fileId ? fileUrl(el) : '#', download: el.name || 'datei' }, h('span', { html: ICONS.download }), 'Herunterladen');
  const m = modal(el.name || 'Datei', h('div', {},
    h('div', { class: 'row' }, h('span', { class: 'file-kind', style: { background: color } }, label), h('span', { class: 'muted' }, fileSize(el.size) + (el.pages ? ` · ${el.pages} Seite${el.pages === 1 ? '' : 'n'}` : '')),
      h('span', { class: 'spacer' }), el.fileId ? dl : null),
    body), { wide: true });
  if (!el.fileId) {
    body.append(h('p', { class: 'muted pad' }, 'Die Datei ist auf diesem Board nicht vorhanden (z. B. aus einem Import ohne Anhänge).'));
    return;
  }
  try {
    if (/\.pdf$/i.test(el.name || '')) {
      body.append(h('p', { class: 'muted small' }, 'Vorschau wird geladen …'));
      const r = await fetch(fileUrl(el), { credentials: 'same-origin' });
      if (!r.ok) throw new Error('nicht gefunden');
      const doc = await openPdf(new Uint8Array(await r.arrayBuffer()));
      body.innerHTML = '';
      const width = Math.min(860, body.clientWidth || 760);
      const max = Math.min(doc.numPages, 50);
      for (let n = 1; n <= max; n++) {
        if (!document.body.contains(body)) return; // Dialog geschlossen
        const c = await renderPage(doc, n, width);
        c.className = 'pdf-page';
        c.style.width = width + 'px';
        c.setAttribute('aria-label', `Seite ${n}`);
        body.append(c);
      }
      if (doc.numPages > max) body.append(h('p', { class: 'muted pad' }, `Vorschau zeigt die ersten ${max} von ${doc.numPages} Seiten – die vollständige Datei gibt es per Download.`));
    } else if (TEXT.test(el.name || '')) {
      const r = await fetch(fileUrl(el), { credentials: 'same-origin' });
      if (!r.ok) throw new Error('nicht gefunden');
      const txt = decodeText(await r.arrayBuffer());
      body.append(h('pre', { class: 'file-text' }, txt.slice(0, 200000) + (txt.length > 200000 ? '\n…' : '')));
    } else {
      body.append(h('div', { class: 'file-noprev' }, h('span', { class: 'file-kind big', style: { background: color } }, label),
        h('p', { class: 'muted' }, 'Für Office-Dateien gibt es im Browser keine Vorschau. Lade die Datei herunter und öffne sie mit deinem Office-Programm.')));
    }
  } catch (e) {
    body.innerHTML = '';
    body.append(h('p', { class: 'muted pad' }, e.message === 'nicht gefunden' ? 'Die Datei ist auf diesem Board nicht vorhanden.' : 'Die Vorschau konnte nicht angezeigt werden. Die Datei lässt sich aber herunterladen.'));
  }
  void m;
});

// Kontextleiste: Öffnen und Herunterladen
app.on('ctxItems', (items, sel, { one, actBtn }) => {
  if (!one || one.type !== 'file') return;
  items.push(actBtn('search', 'Öffnen / Vorschau (Doppelklick)', () => app.emit('openFile', one.id)));
  if (one.fileId) {
    items.push(actBtn('download', 'Herunterladen', () => {
      const a = h('a', { href: fileUrl(one), download: one.name || 'datei' });
      document.body.append(a);
      a.click();
      a.remove();
    }));
  }
});
