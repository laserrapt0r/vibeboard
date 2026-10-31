import { T, LOCALE } from './i18n.js';
// Allgemeine Hilfsfunktionen

export const SVGNS = 'http://www.w3.org/2000/svg';
export const FONT = "'Helvetica Neue', Helvetica, Arial, sans-serif";

export function uid() {
  const a = new Uint8Array(9);
  crypto.getRandomValues(a);
  return btoa(String.fromCharCode(...a)).replace(/\+/g, '-').replace(/\//g, '_');
}

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function debounce(fn, ms) {
  let t;
  return (...a) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
}

export function throttle(fn, ms) {
  let last = 0, t = null, lastArgs;
  return (...a) => {
    lastArgs = a;
    const now = performance.now();
    if (now - last >= ms) {
      last = now;
      fn(...a);
    } else if (!t) {
      t = setTimeout(() => {
        t = null;
        last = performance.now();
        fn(...lastArgs);
      }, ms - (now - last));
    }
  };
}

export const clone = (o) => (o == null ? o : JSON.parse(JSON.stringify(o)));

/* ---------------- Farben ---------------- */

export const STICKY_COLORS = [
  '#fff9b1', '#f5d128', '#d5f692', '#c9df56', '#93d275', '#67c6c0',
  '#a6ccf5', '#6cd8fa', '#c9b2e8', '#ffcee0', '#f99fb1', '#ff9d48',
  '#ffffff', '#e6e6e6', '#9e9e9e', '#2b2b2b',
];

export const PALETTE = [
  'transparent', '#ffffff', '#e6e6e6', '#9e9e9e', '#4d4d4d', '#1a1a1a',
  '#fff9b1', '#f5d128', '#ff9d48', '#f16c7f', '#ef4444', '#c9b2e8',
  '#8b5cf6', '#a6ccf5', '#4262ff', '#2d9bf0', '#67c6c0', '#12b886',
  '#93d275', '#2f9e44', '#ffcee0', '#e64980', '#d4a373', '#7c4a1e',
];

export const USER_COLORS = ['#e64980', '#4262ff', '#12b886', '#f59f00', '#7048e8', '#f03e3e', '#1098ad', '#5c940d', '#d6336c', '#364fc7'];

export function luminance(hex) {
  if (!hex || hex === 'transparent' || hex[0] !== '#') return 1;
  let h = hex.slice(1);
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

export const contrastText = (bg) => (luminance(bg) < 0.35 ? '#ffffff' : '#1a1a1a');

/* ---------------- Textmessung & Umbruch ---------------- */

const mctx = document.createElement('canvas').getContext('2d');
const mcache = new Map();

export function measure(text, size, bold, italic) {
  const key = `${size}|${bold ? 1 : 0}${italic ? 1 : 0}|${text}`;
  let w = mcache.get(key);
  if (w === undefined) {
    mctx.font = `${italic ? T('italic ') : ''}${bold ? T('bold ') : ''}${size}px ${FONT}`;
    w = mctx.measureText(text).width;
    if (mcache.size > 20000) mcache.clear();
    mcache.set(key, w);
  }
  return w;
}

// Wörter dürfen nach einem Bindestrich umbrechen („KI-|Zusammenfassung“)
const chunksOf = (para) => para.split(' ').flatMap((word, i) => word.split(/(?<=-)(?=.)/).map((t, k) => ({ t, sp: i > 0 && k === 0 })));

export function wrap(text, maxW, size, bold, italic) {
  const lines = [];
  for (const para of String(text ?? '').split('\n')) {
    if (!para) {
      lines.push('');
      continue;
    }
    let line = '';
    for (const { t: word, sp } of chunksOf(para)) {
      const test = line ? line + (sp ? ' ' : '') + word : word;
      if (measure(test, size, bold, italic) <= maxW) {
        line = test;
        continue;
      }
      if (line) lines.push(line);
      if (measure(word, size, bold, italic) > maxW) {
        let part = '';
        for (const ch of word) {
          if (part && measure(part + ch, size, bold, italic) > maxW) {
            lines.push(part);
            part = ch;
          } else part += ch;
        }
        line = part;
      } else line = word;
    }
    lines.push(line);
  }
  return lines;
}

const FIT_SIZES = [96, 80, 64, 56, 48, 42, 36, 32, 28, 24, 22, 20, 18, 16, 14, 13, 12, 11, 10, 9, 8, 7, 6];
const fitCache = new Map();

export function fitText(text, w, h, bold, lh = 1.25) {
  const key = `${w}|${h}|${bold ? 1 : 0}|${text}`;
  const hit = fitCache.get(key);
  if (hit) return hit;
  let res = null;
  const maxSize = Math.max(6, Math.min(h * 0.45, w * 0.3));
  // Unterhalb dieser Größe wird ein langes Wort lieber umbrochen als weiter verkleinert
  const readable = Math.min(14, maxSize);
  const words = String(text || '').split(/\s+/).filter(Boolean).flatMap((wd) => wd.split(/(?<=-)(?=.)/));
  const passes = [[true, readable], [false, 0], [true, 0]];
  for (const [noBreak, minSize] of passes) {
    for (const s of FIT_SIZES) {
      if (s > maxSize || s < minSize) continue;
      if (noBreak && words.some((wd) => measure(wd, s, bold) > w)) continue;
      const lines = wrap(text || '', w, s, bold);
      if (lines.length * s * lh <= h && lines.every((l) => measure(l, s, bold) <= w + 0.5)) {
        res = { size: s, lines };
        break;
      }
    }
    if (res) break;
  }
  if (!res) res = { size: 6, lines: wrap(text || '', w, 6, bold) };
  if (fitCache.size > 5000) fitCache.clear();
  fitCache.set(key, res);
  return res;
}

/* ---------------- Geometrie ---------------- */

export function rectsIntersect(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function rectContains(outer, inner) {
  return inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.w <= outer.x + outer.w && inner.y + inner.h <= outer.y + outer.h;
}

export function unionRect(rects) {
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  for (const r of rects) {
    if (!r) continue;
    x1 = Math.min(x1, r.x);
    y1 = Math.min(y1, r.y);
    x2 = Math.max(x2, r.x + r.w);
    y2 = Math.max(y2, r.y + r.h);
  }
  if (x1 === Infinity) return null;
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

export function initials(name) {
  return String(name || '?')
    .replace(/\s*\([^()]*\)$/, '') // Zusatz wie „(Gast)“ zählt nicht
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('');
}

export function fmtDate(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString(LOCALE) + ' ' + d.toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' });
}

export function relTime(ts) {
  const s = (Date.now() - ts) / 1000;
  if (s < 60) return T('gerade eben');
  if (s < 3600) return T`vor ${Math.floor(s / 60)} Min.`;
  if (s < 86400) return T`vor ${Math.floor(s / 3600)} Std.`;
  if (s < 172800) return T('vor 1 Tag');
  if (s < 86400 * 7) return T`vor ${Math.floor(s / 86400)} Tagen`;
  return new Date(ts).toLocaleDateString(LOCALE);
}

/* ---------------- Server-API ---------------- */

// Alle Anfragen tragen den CSRF-Header; Fehler werden als Exception mit Meldung geworfen
// Fortschrittsbalken oben: nur bei Anfragen, die länger als 400 ms dauern (kein Flackern bei schnellen Antworten)
let busy = 0, busyTimer = null;
function progress(delta) {
  busy += delta;
  if (busy > 0 && !busyTimer && !document.querySelector('.top-progress')) {
    busyTimer = setTimeout(() => {
      busyTimer = null;
      if (busy > 0) document.body.append(h('div', { class: 'top-progress', role: 'progressbar', 'aria-label': T('Wird geladen') }));
    }, 400);
  }
  if (busy <= 0) {
    busy = 0;
    clearTimeout(busyTimer);
    busyTimer = null;
    document.querySelector('.top-progress')?.remove();
  }
}

// quiet: Hintergrundabfragen (regelmäßige Aktualisierung) ohne Fortschrittsbalken
export async function api(url, opts = {}) {
  if (opts.quiet) return request(url, opts);
  progress(1);
  try {
    return await request(url, opts);
  } finally {
    progress(-1);
  }
}

async function request(url, { method = 'GET', body, raw } = {}) {
  const opts = { method, headers: { 'X-Vibeboard': '1' }, credentials: 'same-origin' };
  if (body !== undefined) {
    if (typeof body === 'string') opts.body = body;
    else {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
  }
  const r = await fetch(url, opts);
  if (r.status === 401 && !url.startsWith('/api/auth/')) {
    location.href = '/login?next=' + encodeURIComponent(location.pathname + location.search);
    throw Object.assign(new Error(T('Nicht angemeldet')), { code: 'auth' });
  }
  if (raw) return r;
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const err = new Error(data.error || r.statusText);
    err.status = r.status;
    err.code = data.code;
    throw err;
  }
  return data;
}

export async function logout() {
  const r = await api('/api/auth/logout', { method: 'POST' }).catch(() => null);
  location.href = (r && r.redirect) || '/login?loggedout=1';
}

export function loadPref(key, def) {
  try {
    const v = localStorage.getItem('vibeboard.' + key);
    return v == null ? def : JSON.parse(v);
  } catch {
    return def;
  }
}

export function savePref(key, val) {
  try {
    localStorage.setItem('vibeboard.' + key, JSON.stringify(val));
  } catch {}
}

/* ---------------- UI-Helfer ---------------- */

// Läuft ein asynchroner Handler noch, werden weitere Klicks bzw. Absendungen ignoriert
// und die Schaltflächen gesperrt – verhindert doppelte Anfragen
function guardAsync(el, fn) {
  return (e) => {
    if (el._busy) {
      e.preventDefault();
      return;
    }
    const r = fn(e);
    if (!r || typeof r.then !== 'function') return;
    const btns = el.tagName === 'FORM' ? [...el.querySelectorAll('button')] : [el];
    const prev = btns.map((b) => b.disabled);
    el._busy = true;
    btns.forEach((b) => (b.disabled = true));
    r.finally(() => {
      el._busy = false;
      btns.forEach((b, i) => (b.disabled = prev[i]));
    }).catch((err) => {
      console.error(err);
      toast(err.message || T('Aktion fehlgeschlagen'));
    });
  };
}

// Schrift mit dem besseren Kontrast auf einer frei gewählten Personenfarbe
export function readableOn(hex) {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex || '');
  if (!m) return '#ffffff';
  const [r, g, b] = m.slice(1).map((v) => {
    const c = parseInt(v, 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return 1.05 / (l + 0.05) >= (l + 0.05) / 0.05 ? '#ffffff' : '#000000';
}

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') {
      Object.assign(el.style, v);
      if (v.background && /\b(avatar|peer-name)\b/.test(attrs.class || '')) el.style.color = readableOn(v.background);
    }
    else if ((k === 'onsubmit' && tag === 'form') || (k === 'onclick' && tag === 'button')) el.addEventListener(k.slice(2), guardAsync(el, v));
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'html') el.innerHTML = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  // Schaltflächen nur mit Symbol: Der Tooltip ist zugleich der Name für Bildschirmleser
  if (tag === 'button' && attrs && attrs.title && !attrs['aria-label'] && !el.textContent.trim()) el.setAttribute('aria-label', attrs.title);
  return el;
}

// Element.append ohne null/false-Einträge (die sonst als Text "null" erscheinen)
export function append(parent, ...kids) {
  parent.append(...kids.flat().filter((k) => k != null && k !== false));
}

// Live-Region muss schon vor der ersten Meldung im Dokument stehen, sonst sagen Bildschirmleser sie nicht an
function toastRegion() {
  return document.body.appendChild(h('div', { id: 'toast', role: 'status', 'aria-live': 'polite' }));
}
if (document.body) toastRegion();

let toastTimer;
// action: optionaler Knopf { label, onClick }
export function toast(msg, ms = 2200, action) {
  let t = document.getElementById('toast');
  if (!t) {
    t = toastRegion();
  }
  t.textContent = msg;
  t.classList.toggle('with-action', !!action);
  if (action) {
    t.append(h('button', { class: 'btn small', onclick: () => {
      t.classList.remove('show', 'with-action');
      action.onClick();
    } }, action.label));
  }
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show', 'with-action'), ms);
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type=hidden]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';
const visibleIn = (root) => [...root.querySelectorAll(FOCUSABLE)].filter((el) => el.getClientRects().length);
let dialogCount = 0;

export function modal(title, content, { wide = false, onClose } = {}) {
  const opener = document.activeElement;
  const titleId = 'dialog-title-' + ++dialogCount;
  const close = () => {
    back.remove();
    document.removeEventListener('keydown', onKey, true);
    onClose && onClose();
    // Tastatur und Bildschirmleser dorthin zurückführen, wo der Dialog geöffnet wurde
    if (opener && opener.isConnected && !document.querySelector('.modal-back')) opener.focus();
  };
  const onKey = (e) => {
    // Bei gestapelten Dialogen reagiert nur der oberste
    if ([...document.querySelectorAll('.modal-back')].pop() !== back) return;
    if (e.key === 'Escape') {
      e.stopPropagation();
      close();
    } else if (e.key === 'Tab') {
      const items = visibleIn(box);
      if (!items.length) return e.preventDefault();
      const first = items[0], last = items[items.length - 1];
      const inside = box.contains(document.activeElement) && document.activeElement !== box;
      if (e.shiftKey && (!inside || document.activeElement === first)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (!inside || document.activeElement === last)) {
        e.preventDefault();
        first.focus();
      }
    }
  };
  const box = h('div', { class: 'modal' + (wide ? ' wide' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId, tabindex: '-1' },
    h('div', { class: 'modal-head' }, h('h2', { id: titleId }, title), h('button', { class: 'icon-btn', title: T('Schließen'), onclick: close, html: ICONS.close })),
    h('div', { class: 'modal-body' }, content));
  const back = h('div', { class: 'modal-back', onpointerdown: (e) => e.target === back && close() }, box);
  document.body.append(back);
  document.addEventListener('keydown', onKey, true);
  // Erstes Feld des Inhalts, sonst der Dialog selbst; Aufrufer dürfen danach ein bestimmtes Feld fokussieren
  (visibleIn(box.querySelector('.modal-body'))[0] || box).focus({ preventScroll: true });
  return { close, box };
}

export function promptDialog(title, label, value = '') {
  return new Promise((resolve) => {
    let done = false;
    const input = h('input', { type: 'text', value });
    const finish = (v) => {
      if (done) return;
      done = true;
      m.close();
      resolve(v);
    };
    const form = h('form', { class: 'form', onsubmit: (e) => { e.preventDefault(); finish(input.value); } },
      h('label', {}, label, input),
      h('div', { class: 'form-actions' },
        h('button', { type: 'button', class: 'btn', onclick: () => finish(null) }, T('Abbrechen')),
        h('button', { type: 'submit', class: 'btn primary' }, T('OK'))));
    const m = modal(title, form, { onClose: () => finish(null) });
    setTimeout(() => { input.focus(); input.select(); }, 0);
  });
}

export function confirmDialog(title, text, okLabel = T('OK'), danger = false) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (v) => {
      if (done) return;
      done = true;
      m.close();
      resolve(v);
    };
    const okBtn = h('button', { class: 'btn ' + (danger ? 'danger' : 'primary'), onclick: () => finish(true) }, okLabel);
    const m = modal(title, h('div', { class: 'form' }, h('p', {}, text),
      h('div', { class: 'form-actions' }, h('button', { class: 'btn', onclick: () => finish(false) }, T('Abbrechen')), okBtn)),
      { onClose: () => finish(false) });
    setTimeout(() => okBtn.focus(), 0);
  });
}

/* ---------------- Icons ----------------
 * Ein Teil der Pfade stammt aus bzw. basiert auf Lucide (https://lucide.dev, ISC-Lizenz)
 * und Feather (https://feathericons.com, MIT-Lizenz). Lizenztexte: THIRD_PARTY_NOTICES.md
 */

const I = (d, extra = '') =>
  `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" ${extra}>${d}</svg>`;

export const ICONS = {
  select: I('<path d="M4 3l7 17 2.5-7.5L21 10z"/>'),
  hand: I('<path d="M18 11V6a2 2 0 0 0-4 0v5M14 10V4a2 2 0 0 0-4 0v6M10 10.5V6a2 2 0 0 0-4 0v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.9-5.9-2.3l-3.6-3.6a2 2 0 0 1 2.8-2.8L7 15"/>'),
  sticky: I('<path d="M15.5 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8.5z"/><path d="M15 3v6h6"/>'),
  text: I('<path d="M4 7V4h16v3M9 20h6M12 4v16"/>'),
  shape: I('<rect x="3" y="3" width="10" height="10" rx="1"/><circle cx="16" cy="16" r="5"/>'),
  connector: I('<path d="M5 19L19 5"/><path d="M11 5h8v8"/>'),
  pen: I('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>'),
  highlighter: I('<path d="M9 11l-6 6v3h9l3-3"/><path d="M22 12l-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/>'),
  eraser: I('<path d="M7 21l-4.3-4.3a1 1 0 0 1 0-1.4l10-10a1 1 0 0 1 1.4 0l5.6 5.6a1 1 0 0 1 0 1.4L11 21z"/><path d="M22 21H7M5 11l9 9"/>'),
  frame: I('<path d="M22 6H2M22 18H2M6 2v20M18 2v20"/>'),
  comment: I('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>'),
  image: I('<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="M21 15l-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>'),
  card: I('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9h10M7 13h6"/>'),
  emoji: I('<circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><path d="M9 9h.01M15 9h.01"/>'),
  laser: I('<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>'),
  mindmap: I('<circle cx="12" cy="12" r="3"/><circle cx="4" cy="5" r="2"/><circle cx="20" cy="5" r="2"/><circle cx="4" cy="19" r="2"/><circle cx="20" cy="19" r="2"/><path d="M9.7 10.2L5.5 6.4M14.3 10.2l4.2-3.8M9.7 13.8l-4.2 3.8M14.3 13.8l4.2 3.8"/>'),
  table: I('<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>'),
  undo: I('<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>'),
  redo: I('<path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13"/>'),
  plus: I('<path d="M12 5v14M5 12h14"/>'),
  minus: I('<path d="M5 12h14"/>'),
  fit: I('<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>'),
  close: I('<path d="M18 6L6 18M6 6l12 12"/>'),
  trash: I('<path d="M3 6h18M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>'),
  copy: I('<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>'),
  lock: I('<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>'),
  unlock: I('<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>'),
  front: I('<rect x="8" y="8" width="13" height="13" rx="2" fill="currentColor" fill-opacity=".25"/><path d="M4 16V4h12"/>'),
  back: I('<rect x="3" y="3" width="13" height="13" rx="2"/><path d="M8 21h13V8" stroke-dasharray="2 2"/>'),
  template: I('<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>'),
  timer: I('<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M10 2h4"/>'),
  vote: I('<path d="M9 12l2 2 4-4"/><path d="M5 7c0-1.1.9-2 2-2h10a2 2 0 0 1 2 2v12H5z"/><path d="M22 19H2"/>'),
  share: I('<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/>'),
  download: I('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>'),
  upload: I('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>'),
  search: I('<circle cx="11" cy="11" r="8"/><path d="M21 21l-4.3-4.3"/>'),
  settings: I('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
  present: I('<path d="M2 3h20M21 3v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V3M7 21l5-5 5 5"/>'),
  list: I('<path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h.01M3 12h.01M3 18h.01"/>'),
  layers: I('<path d="M12 2L2 7l10 5 10-5z"/><path d="M2 17l10 5 10-5M2 12l10 5 10-5"/>'),
  home: I('<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>'),
  more: I('<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>'),
  alignLeft: I('<path d="M4 2v20M8 6h12v4H8zM8 14h7v4H8z"/>'),
  alignCenterH: I('<path d="M12 2v20M6 6h12v4H6zM8.5 14h7v4h-7z"/>'),
  alignRight: I('<path d="M20 2v20M4 6h12v4H4zM9 14h7v4H9z"/>'),
  alignTop: I('<path d="M2 4h20M6 8v12h4V8zM14 8v7h4V8z"/>'),
  alignMiddle: I('<path d="M2 12h20M6 6v12h4V6zM14 8.5v7h4v-7z"/>'),
  alignBottom: I('<path d="M2 20h20M6 4v12h4V4zM14 9v7h4V9z"/>'),
  distH: I('<path d="M4 2v20M20 2v20M9 7h6v10H9z"/>'),
  distV: I('<path d="M2 4h20M2 20h20M7 9h10v6H7z"/>'),
  grid: I('<path d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z"/>'),
  cluster: I('<circle cx="7" cy="7" r="3"/><circle cx="17" cy="7" r="3"/><circle cx="7" cy="17" r="3"/><circle cx="17" cy="17" r="3"/>'),
  bold: I('<path d="M6 4h8a4 4 0 0 1 0 8H6zM6 12h9a4 4 0 0 1 0 8H6z"/>'),
  italic: I('<path d="M19 4h-9M14 20H5M15 4L9 20"/>'),
  tAlignLeft: I('<path d="M17 10H3M21 6H3M21 14H3M17 18H3"/>'),
  tAlignCenter: I('<path d="M18 10H6M21 6H3M21 14H3M18 18H6"/>'),
  tAlignRight: I('<path d="M21 10H7M21 6H3M21 14H3M21 18H7"/>'),
  group: I('<rect x="3" y="3" width="18" height="18" rx="2" stroke-dasharray="3 3"/><rect x="7" y="7" width="6" height="6"/><rect x="11" y="11" width="6" height="6"/>'),
  link: I('<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>'),
  edit: I('<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4z"/>'),
  users: I('<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>'),
  play: I('<path d="M5 3l14 9-14 9z"/>'),
  pause: I('<path d="M6 4h4v16H6zM14 4h4v16h-4z"/>'),
  stop: I('<rect x="5" y="5" width="14" height="14" rx="1"/>'),
  chevLeft: I('<path d="M15 18l-6-6 6-6"/>'),
  chevRight: I('<path d="M9 18l6-6-6-6"/>'),
  chevUp: I('<path d="M18 15l-6-6-6 6"/>'),
  chevDown: I('<path d="M6 9l6 6 6-6"/>'),
  check: I('<path d="M20 6L9 17l-5-5"/>'),
  moon: I('<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>'),
  keyboard: I('<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h8"/>'),
  smile: I('<circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01"/>'),
  dash: I('<path d="M3 12h4M10 12h4M17 12h4"/>'),
  arrowEnd: I('<path d="M3 12h16M14 7l5 5-5 5"/>'),
  arrowStart: I('<path d="M21 12H5M10 7l-5 5 5 5"/>'),
  code: I('<path d="M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16"/>'),
  underline: I('<path d="M6 4v7a6 6 0 0 0 12 0V4M5 21h14"/>'),
  strike: I('<path d="M16 6c-.8-1.4-2.4-2-4-2-2.5 0-4.5 1.3-4.5 3.5 0 1.4.8 2.5 2.4 3.2M4 12h16M8 18c.9 1.3 2.4 2 4.3 2 2.6 0 4.7-1.4 4.7-3.6 0-.9-.3-1.7-.9-2.3"/>'),
  tasks: I('<path d="M9 6h12M9 12h12M9 18h12"/><path d="M3 6l1.5 1.5L7 5M3 12l1.5 1.5L7 11M3 18l1.5 1.5L7 17"/>'),
  history: I('<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>'),
  poker: I('<rect x="3" y="5" width="11" height="15" rx="2"/><path d="M10 4.2L11 3.6a2 2 0 0 1 2.7.7l6.5 11.3a2 2 0 0 1-.7 2.7l-3.4 2"/><path d="M8.5 10.5v4M6.5 12.5h4"/>'),
  eyeOff: I('<path d="M3 3l18 18"/><path d="M10.6 5.1A10 10 0 0 1 12 5c5 0 9 4.5 10 7-0.4 1-1.2 2.3-2.4 3.5M6.2 6.3C3.9 7.7 2.5 9.9 2 12c1 2.5 5 7 10 7 1.6 0 3.1-.4 4.4-1.1"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>'),
  diagram: I('<rect x="3" y="3" width="7" height="5" rx="1"/><rect x="14" y="16" width="7" height="5" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><path d="M10 5.5h4M6.5 8v10.5H14"/>'),
  bell: I('<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/>'),
  activity: I('<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>'),
  shield: I('<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>'),
  mic: I('<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M19 10v1a7 7 0 0 1-14 0v-1M12 18v4M8 22h8"/>'),
  record: I('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4" fill="currentColor"/>'),
  folder: I('<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>'),
  team: I('<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2.6"/><path d="M15.5 14.2A5 5 0 0 1 21 19"/>'),
  guest: I('<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/><path d="M12 2v2"/>'),
  file: I('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h4"/>'),
  filter: I('<path d="M3 5h18l-7 8v6l-4 2v-8z"/>'),
  tag: I('<path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9z"/><circle cx="8" cy="8" r="1.5"/>'),
  install: I('<path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M5 21h14"/>'),
  restore: I('<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>'),
};
