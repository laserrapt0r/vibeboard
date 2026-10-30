// Export: SVG, PNG, JSON, PDF (Druck), Vorschaubilder
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

export async function pngDataUrl(elements, { scale = 2, maxSize = 8000, background = '#ffffff', bounds, padding, redactPrivate, seesConcealed = true } = {}) {
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
    return c.toDataURL('image/png');
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function thumbnail(elements) {
  if (!elements.length) return null;
  // Vorschaubilder sehen alle Mitglieder – private Inhalte und verborgene Bereiche bleiben verdeckt
  const hidden = globalThis.ConcealOps ? globalThis.ConcealOps.concealedIds(elements) : new Set();
  return pngDataUrl(elements.filter((e) => !hidden.has(e.id)), { scale: 1, maxSize: 480, padding: 20, redactPrivate: true, seesConcealed: false });
}

/* Jeder Frame wird zu einer Druckseite – über den Druckdialog als PDF speichern */
export async function printFrames(elements, frames, rawTitle) {
  const title = esc(rawTitle);
  const win = window.open('', '_blank');
  if (!win) throw new Error(T('Pop-up wurde blockiert'));
  win.document.write(`<!doctype html><title>${title}</title><p style="font-family:sans-serif">${T('PDF wird vorbereitet …')}</p>`);
  const pages = [];
  const list = frames.length ? frames : [null];
  for (const f of list) {
    const bounds = f ? { x: f.x, y: f.y, w: f.w, h: f.h } : undefined;
    // Alle Elemente rendern (Verbindungen brauchen ihre Ziele), der viewBox schneidet auf den Frame zu
    pages.push(await pngDataUrl(elements, { bounds, padding: f ? 0 : 40, scale: 2, maxSize: 4000 }));
  }
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>
    @page { size: landscape; margin: 10mm; }
    body { margin: 0; }
    .p { page-break-after: always; display: flex; align-items: center; justify-content: center; height: 95vh; }
    .p:last-child { page-break-after: auto; }
    img { max-width: 100%; max-height: 100%; }
  </style></head><body>${pages.map((p) => `<div class="p"><img src="${p}"></div>`).join('')}</body></html>`;
  win.document.open();
  win.document.write(html);
  win.document.close();
  // Druckdialog von hier aus öffnen (Inline-Skripte im Druckfenster verbietet die Content-Security-Policy)
  await Promise.all([...win.document.images].map((img) => img.decode().catch(() => {})));
  win.focus();
  win.print();
}
