// Benutzeroberfläche des Board-Editors
import {
  h, append, ICONS, esc, toast, modal, promptDialog, confirmDialog, STICKY_COLORS, PALETTE, USER_COLORS, unionRect,
  initials, relTime, rectsIntersect, throttle, uid,
} from './util.js';
import { SHAPES, shapeGeom, renderSvgDocument, elBounds, safeLink } from './render.js';
import { templateGallery } from './gallery.js';
import { popover, closePop, menu } from './menu.js';
import { openShareDialog } from './share.js';
import { openProfileDialog, accountMenuItems } from './account.js';

export { popover, closePop, menu };
import {
  app, $, stage, getEl, bounds, setTool, saveToolOpts, selectedEls, selectionBounds, act, setEl, updateEl, deleteEls,
  undo, redo, canUndo, canRedo, zoomBy, zoomAt, fitAll, fitTo, toScreen, visibleRect, viewCenter, applyView, startEdit,
  duplicateEls, collectForCopy, bringToFront, sendToBack, groupSel, ungroupSel, toggleLock, alignSel, distributeSel,
  arrangeGrid, clusterByColor, frames, makeElement, addElements, nextZ, insertImageFile, setSelection, pasteElements,
  saveSettings, toWorld, scheduleRender, autoHeight, animateView, lastPointer, frameChildren,
} from './core.js';
import { download, safeName, svgString, pngDataUrl, printFrames } from './exporter.js';

/* ================================================================== */
/* Allgemeine Popover / Menüs                                          */
/* ================================================================== */

document.addEventListener('pointerdown', (e) => {
  if (ctxMenu && !ctxMenu.contains(e.target)) closeContextMenu();
}, true);

const iconBtn = (icon, title, onclick, extra = {}) => h('button', { class: 'icon-btn ' + (extra.class || ''), title, 'aria-label': title, onclick, html: ICONS[icon] || icon, ...extra, class: 'icon-btn ' + (extra.class || '') });

/* ================================================================== */
/* Werkzeugleiste links                                                */
/* ================================================================== */

const TOOLS = [
  ['select', 'Auswählen (V)'], ['hand', 'Verschieben (H / Leertaste)'], '|',
  ['sticky', 'Sticky Note (N)'], ['text', 'Text (T)'], ['shape', 'Formen (S, R, O)'], ['connector', 'Verbindungslinie (L)'],
  ['pen', 'Stift (P)'], ['highlighter', 'Textmarker'], ['eraser', 'Radierer (E)'], '|',
  ['frame', 'Frame (F)'], ['card', 'Karte / Aufgabe (K)'], ['table', 'Tabelle'], ['mindmap', 'Mindmap (M)'],
  ['comment', 'Kommentar (C)'], ['emoji', 'Sticker & Emojis'], ['image', 'Bild hochladen'], ['laser', 'Laserpointer (X)'], '|',
  ['template', 'Vorlagen'],
];

const EMOJIS = ['👍', '👎', '❤️', '⭐', '✅', '❌', '❓', '❗', '💡', '🔥', '🎉', '🚀', '😀', '😂', '😍', '🤔', '😢', '😡', '👏', '🙌', '💪', '👀', '🎯', '📌', '⚠️', '🏆', '💰', '📅', '🔒', '🧩', '☕', '🍕'];
const PEN_COLORS = ['#1a1a1a', '#e03131', '#f08c00', '#2f9e44', '#1971c2', '#7048e8', '#e64980', '#ffffff'];
const HL_COLORS = ['#f5d128', '#93d275', '#6cd8fa', '#ffcee0', '#ff9d48', '#c9b2e8'];

const fileInput = h('input', { type: 'file', accept: 'image/*', multiple: true, style: { display: 'none' } });
document.body.append(fileInput);
fileInput.addEventListener('change', () => {
  const c = viewCenter();
  [...fileInput.files].forEach((f, i) => insertImageFile(f, { x: c.x + i * 40, y: c.y + i * 40 }));
  fileInput.value = '';
});

function buildTools() {
  const nav = $('#tools');
  nav.innerHTML = '';
  for (const t of TOOLS) {
    if (t === '|') {
      nav.append(h('div', { class: 'tool-sep' }));
      continue;
    }
    const [id, title] = t;
    if (app.viewOnly && !['select', 'hand', 'laser'].includes(id)) continue;
    const b = iconBtn(id === 'template' ? 'template' : id, title, () => {
      if (id === 'image') return fileInput.click();
      if (id === 'template') return openTemplates();
      if (app.tool === id && hasFlyout(id)) return showFlyout(id, b);
      setTool(id);
    });
    b.dataset.tool = id;
    nav.append(b);
  }
}

function hasFlyout(id) {
  return ['sticky', 'shape', 'connector', 'pen', 'highlighter', 'emoji'].includes(id);
}

function swatchGrid(colors, current, onPick, cls = '') {
  return h('div', { class: 'swatches ' + cls }, colors.map((c) => h('button', {
    class: 'swatch' + (c === current ? ' active' : '') + (c === 'transparent' ? ' transparent' : ''),
    style: { background: c === 'transparent' ? '' : c },
    title: c === 'transparent' ? 'Keine Füllung' : c,
    onclick: () => onPick(c),
  })));
}

function showFlyout(id, anchor) {
  const o = app.toolOpts;
  const done = () => {
    saveToolOpts();
    closePop();
    syncToolButtons();
  };
  let content;
  switch (id) {
    case 'sticky':
      content = h('div', {}, h('div', { class: 'pop-title' }, 'Farbe der Sticky Note'), swatchGrid(STICKY_COLORS, o.stickyColor, (c) => { o.stickyColor = c; done(); }));
      break;
    case 'shape':
      content = h('div', {}, h('div', { class: 'pop-title' }, 'Form wählen'), h('div', { class: 'shape-grid' }, SHAPES.map(([k, label]) => h('button', {
        class: 'shape-btn' + (o.shape === k ? ' active' : ''), title: label,
        html: `<svg viewBox="0 0 40 30" width="40" height="30">${shapeGeom(k, 3, 3, 34, 24)} fill="none" stroke="currentColor" stroke-width="2"/></svg>`,
        onclick: () => { o.shape = k; done(); },
      }))));
      break;
    case 'connector':
      content = h('div', {}, h('div', { class: 'pop-title' }, 'Linienart'), h('div', { class: 'row' }, [['curve', 'Kurve'], ['elbow', 'Gewinkelt'], ['straight', 'Gerade']].map(([k, l]) =>
        h('button', { class: 'btn small' + (o.routing === k ? ' primary' : ''), onclick: () => { o.routing = k; done(); } }, l))));
      break;
    case 'pen':
    case 'highlighter': {
      const hl = id === 'highlighter';
      content = h('div', {}, h('div', { class: 'pop-title' }, hl ? 'Textmarker' : 'Stift'),
        swatchGrid(hl ? HL_COLORS : PEN_COLORS, hl ? o.hlColor : o.penColor, (c) => { if (hl) o.hlColor = c; else o.penColor = c; done(); }),
        hl ? null : h('div', { class: 'row', style: { marginTop: '8px' } }, [2, 3, 5, 8, 12].map((wd) => h('button', {
          class: 'width-btn' + (o.penWidth === wd ? ' active' : ''), title: wd + ' px',
          html: `<span style="width:${wd + 2}px;height:${wd + 2}px"></span>`, onclick: () => { o.penWidth = wd; done(); },
        }))));
      break;
    }
    case 'emoji':
      content = h('div', {}, h('div', { class: 'pop-title' }, 'Sticker'), h('div', { class: 'emoji-grid' }, EMOJIS.map((em) => h('button', { class: 'emoji-btn' + (o.emoji === em ? ' active' : ''), onclick: () => { o.emoji = em; done(); } }, em))));
      break;
  }
  popover(anchor, content, { placement: 'right' });
}

function syncToolButtons() {
  for (const b of document.querySelectorAll('#tools [data-tool]')) {
    b.classList.toggle('active', b.dataset.tool === app.tool);
    const id = b.dataset.tool;
    if (id === 'sticky') b.style.setProperty('--tool-accent', app.toolOpts.stickyColor);
    if (id === 'pen') b.style.setProperty('--tool-accent', app.toolOpts.penColor);
  }
}

app.on('tool', (t) => {
  syncToolButtons();
  const b = document.querySelector(`#tools [data-tool="${t}"]`);
  if (b && hasFlyout(t) && !app.viewOnly) showFlyout(t, b);
  else closePop();
});

/* ================================================================== */
/* Kontext-Werkzeugleiste                                              */
/* ================================================================== */

const ctxbar = $('#ctxbar');
let ctxHidden = false;

function applySel(patch, filter) {
  act(() => {
    for (const el of selectedEls()) {
      if (filter && !filter(el)) continue;
      const p = typeof patch === 'function' ? patch(el) : patch;
      if (p) setEl(autoHeight({ ...el, ...p }));
    }
  });
  buildCtx();
}

function colorBtn(color, title, palette, onPick, { ring = false } = {}) {
  const b = h('button', { class: 'ctx-btn color-btn', title });
  b.append(h('span', { class: 'color-dot' + (ring ? ' ring' : '') + (color === 'transparent' ? ' transparent' : ''), style: ring ? { borderColor: color } : { background: color === 'transparent' ? '' : color } }));
  b.onclick = () => {
    const custom = h('input', { type: 'color', value: /^#[0-9a-f]{6}$/i.test(color) ? color : '#000000', oninput: (e) => onPick(e.target.value) });
    popover(b, h('div', {}, h('div', { class: 'pop-title' }, title), swatchGrid(palette, color, (c) => { onPick(c); closePop(); }),
      h('label', { class: 'custom-color' }, 'Eigene Farbe ', custom)), { placement: 'top' });
  };
  return b;
}

function selectBtn(value, options, title, onPick, width = 64) {
  const label = (options.find((o) => o[0] === value) || [value, String(value)])[1];
  const b = h('button', { class: 'ctx-btn select-btn', title, style: { minWidth: width + 'px' } }, h('span', {}, label), h('span', { class: 'caret', html: ICONS.chevDown }));
  b.onclick = () => menu(b, options.map(([v, l]) => ({ label: l, checked: v === value, onClick: () => onPick(v) })), { placement: 'top' });
  return b;
}

function toggleBtn(icon, active, title, onClick) {
  return h('button', { class: 'ctx-btn' + (active ? ' active' : ''), title, html: ICONS[icon] || icon, onclick: onClick });
}

const actBtn = (icon, title, onClick, cls = '') => h('button', { class: 'ctx-btn ' + cls, title, html: ICONS[icon] || icon, onclick: onClick });
const sep = () => h('span', { class: 'ctx-sep' });

const FONT_SIZES = [[10, '10'], [12, '12'], [14, '14'], [16, '16'], [18, '18'], [20, '20'], [24, '24'], [28, '28'], [32, '32'], [40, '40'], [48, '48'], [64, '64'], [80, '80'], [96, '96'], [128, '128']];
const STROKE_W = [[0, 'Ohne'], [1, '1 px'], [2, '2 px'], [3, '3 px'], [4, '4 px'], [6, '6 px'], [8, '8 px'], [12, '12 px']];

export function buildCtx() {
  ctxbar.innerHTML = '';
  const sel = selectedEls();
  if (!sel.length || app.viewOnly || app.tool !== 'select') {
    ctxbar.classList.add('hidden');
    return;
  }
  const types = new Set(sel.map((e) => e.type));
  const one = sel.length === 1 ? sel[0] : null;
  const only = types.size === 1 ? [...types][0] : null;
  const locked = sel.every((e) => e.locked);
  const items = [];
  const f = sel[0];

  if (!locked) {
    if (only === 'sticky') {
      items.push(colorBtn(f.fill, 'Farbe', STICKY_COLORS, (c) => applySel({ fill: c })));
      items.push(selectBtn(f.fontSize, [['auto', 'Auto'], ...FONT_SIZES], 'Schriftgröße', (v) => applySel({ fontSize: v })));
      items.push(toggleBtn('bold', f.bold, 'Fett', () => applySel({ bold: !f.bold })));
      items.push(alignBtn(f.align || 'center'));
    } else if (only === 'shape') {
      items.push(selectBtn(f.shape, SHAPES, 'Form', (v) => applySel({ shape: v }), 110));
      items.push(colorBtn(f.fill, 'Füllfarbe', PALETTE, (c) => applySel({ fill: c })));
      items.push(colorBtn(f.stroke === 'none' ? 'transparent' : f.stroke, 'Rahmenfarbe', PALETTE, (c) => applySel({ stroke: c === 'transparent' ? 'none' : c, strokeWidth: c === 'transparent' ? 0 : f.strokeWidth || 2 }), { ring: true }));
      items.push(selectBtn(f.strokeWidth ?? 2, STROKE_W, 'Rahmenstärke', (v) => applySel({ strokeWidth: v, stroke: v && f.stroke === 'none' ? '#1a1a1a' : f.stroke }), 60));
      items.push(selectBtn(f.dash || false, [[false, '──── Durchgezogen'], [true, '- - - Gestrichelt'], ['dotted', '····· Gepunktet']], 'Linienstil', (v) => applySel({ dash: v }), 46));
      items.push(sep());
      items.push(colorBtn(f.textColor || '#1a1a1a', 'Textfarbe', PALETTE.slice(1), (c) => applySel({ textColor: c }), { ring: false }));
      items.push(selectBtn(f.fontSize ?? 18, [['auto', 'Auto'], ...FONT_SIZES], 'Schriftgröße', (v) => applySel({ fontSize: v })));
      items.push(toggleBtn('bold', f.bold, 'Fett', () => applySel({ bold: !f.bold })));
      items.push(alignBtn(f.align || 'center'));
    } else if (only === 'text') {
      items.push(selectBtn(f.fontSize ?? 24, FONT_SIZES, 'Schriftgröße', (v) => applySel({ fontSize: v })));
      items.push(colorBtn(f.color || '#1a1a1a', 'Textfarbe', PALETTE.slice(1), (c) => applySel({ color: c })));
      items.push(toggleBtn('bold', f.bold, 'Fett', () => applySel({ bold: !f.bold })));
      items.push(toggleBtn('italic', f.italic, 'Kursiv', () => applySel({ italic: !f.italic })));
      items.push(alignBtn(f.align || 'left'));
      items.push(colorBtn(f.fill || 'transparent', 'Hintergrund', PALETTE, (c) => applySel({ fill: c })));
    } else if (only === 'connector') {
      items.push(colorBtn(f.stroke, 'Linienfarbe', PALETTE.slice(1), (c) => applySel({ stroke: c })));
      items.push(selectBtn(f.strokeWidth || 2, STROKE_W.slice(1), 'Linienstärke', (v) => applySel({ strokeWidth: v }), 60));
      items.push(selectBtn(f.dash || false, [[false, '──── Durchgezogen'], [true, '- - - Gestrichelt'], ['dotted', '····· Gepunktet']], 'Linienstil', (v) => applySel({ dash: v }), 46));
      items.push(selectBtn(f.routing || 'curve', [['curve', '⤴ Kurve'], ['elbow', '⌐ Gewinkelt'], ['straight', '／ Gerade']], 'Linienführung', (v) => applySel({ routing: v }), 100));
      items.push(toggleBtn('arrowStart', !!f.arrowStart, 'Pfeil am Anfang', () => applySel({ arrowStart: !f.arrowStart })));
      items.push(toggleBtn('arrowEnd', f.arrowEnd !== false, 'Pfeil am Ende', () => applySel({ arrowEnd: f.arrowEnd === false })));
      if (one) items.push(actBtn('text', 'Beschriftung', () => startEdit(one.id)));
    } else if (only === 'pen') {
      items.push(colorBtn(f.stroke, 'Farbe', PALETTE.slice(1), (c) => applySel({ stroke: c })));
      items.push(selectBtn(f.strokeWidth, [[1, '1 px'], [2, '2 px'], [3, '3 px'], [5, '5 px'], [8, '8 px'], [12, '12 px'], [20, '20 px'], [32, '32 px']], 'Stärke', (v) => applySel({ strokeWidth: v }), 60));
    } else if (only === 'frame') {
      items.push(colorBtn(f.fill || '#ffffff', 'Hintergrund', PALETTE, (c) => applySel({ fill: c })));
      if (one) {
        items.push(actBtn('edit', 'Umbenennen', () => startEdit(one.id)));
        items.push(selectBtn('', [['16:9', 'Präsentation 16:9'], ['4:3', 'Präsentation 4:3'], ['a4', 'A4 Hochformat'], ['a4l', 'A4 Querformat'], ['1:1', 'Quadrat'], ['phone', 'Smartphone']], 'Format', (v) => {
          const sizes = { '16:9': [1280, 720], '4:3': [1024, 768], a4: [794, 1123], a4l: [1123, 794], '1:1': [1000, 1000], phone: [390, 844] };
          const [w, hh] = sizes[v];
          applySel({ w, h: hh });
        }, 80));
        items.push(actBtn('present', 'Ab hier präsentieren', () => app.emit('present', one.id)));
      }
    } else if (only === 'card') {
      items.push(colorBtn(f.color || '#4262ff', 'Farbe', PALETTE.slice(2), (c) => applySel({ color: c })));
      if (one) items.push(actBtn('edit', 'Karte bearbeiten', () => app.emit('editCard', one.id)));
    } else if (only === 'table' && one) {
      items.push(actBtn('<b style="font-size:12px">+Z</b>', 'Zeile hinzufügen', () => applySel((t) => ({ rows: t.rows + 1, h: t.h + t.h / t.rows, cells: [...t.cells.map((r) => [...r]), Array(t.cols).fill('')] }))));
      items.push(actBtn('<b style="font-size:12px">+S</b>', 'Spalte hinzufügen', () => applySel((t) => ({ cols: t.cols + 1, w: t.w + t.w / t.cols, cells: t.cells.map((r) => [...r, '']) }))));
      items.push(actBtn('<b style="font-size:12px">−Z</b>', 'Letzte Zeile entfernen', () => applySel((t) => (t.rows > 1 ? { rows: t.rows - 1, h: t.h - t.h / t.rows, cells: t.cells.slice(0, -1) } : null))));
      items.push(actBtn('<b style="font-size:12px">−S</b>', 'Letzte Spalte entfernen', () => applySel((t) => (t.cols > 1 ? { cols: t.cols - 1, w: t.w - t.w / t.cols, cells: t.cells.map((r) => r.slice(0, -1)) } : null))));
      items.push(toggleBtn('<b style="font-size:12px">K</b>', f.header !== false, 'Kopfzeile', () => applySel({ header: f.header === false })));
      items.push(selectBtn(f.fontSize || 14, FONT_SIZES.slice(0, 8), 'Schriftgröße', (v) => applySel({ fontSize: v })));
    } else if (only === 'emoji') {
      items.push(actBtn('<span style="font-size:18px">' + esc(f.char) + '</span>', 'Sticker ändern', (e) => {
        const b = e.currentTarget;
        popover(b, h('div', { class: 'emoji-grid' }, EMOJIS.map((em) => h('button', { class: 'emoji-btn', onclick: () => { applySel({ char: em }); closePop(); } }, em))), { placement: 'top' });
      }));
    } else if (only === 'image' && one) {
      items.push(actBtn('download', 'Bild herunterladen', () => download(one.name || 'bild.png', one.src)));
    }
    if (types.has('sticky') && sel.length > 1) items.push(actBtn('cluster', 'Nach Farbe clustern', clusterByColor));
    if (sel.length > 1) {
      const ab = actBtn('alignLeft', 'Ausrichten & Verteilen', () => menu(ab, [
        { label: 'Links ausrichten', icon: 'alignLeft', onClick: () => alignSel('left') },
        { label: 'Horizontal zentrieren', icon: 'alignCenterH', onClick: () => alignSel('centerH') },
        { label: 'Rechts ausrichten', icon: 'alignRight', onClick: () => alignSel('right') },
        { label: 'Oben ausrichten', icon: 'alignTop', onClick: () => alignSel('top') },
        { label: 'Vertikal zentrieren', icon: 'alignMiddle', onClick: () => alignSel('middle') },
        { label: 'Unten ausrichten', icon: 'alignBottom', onClick: () => alignSel('bottom') },
        '-',
        { label: 'Horizontal verteilen', icon: 'distH', onClick: () => distributeSel('h') },
        { label: 'Vertikal verteilen', icon: 'distV', onClick: () => distributeSel('v') },
        { label: 'Als Raster anordnen', icon: 'grid', onClick: () => arrangeGrid() },
      ], { placement: 'top' }));
      items.push(ab);
    }
    if (items.length) items.push(sep());
  }
  if (one && !locked && ['sticky', 'shape', 'text', 'card', 'image', 'emoji', 'frame'].includes(one.type)) {
    items.push(toggleBtn('link', !!one.link, one.link ? 'Link: ' + one.link : 'Link hinzufügen', async () => {
      const v = await promptDialog('Link', 'Adresse (leer lassen zum Entfernen)', one.link || 'https://');
      if (v === null) return;
      const href = safeLink(v);
      if (v.trim() && v.trim() !== 'https://' && !href) return toast('Bitte eine gültige http(s)-Adresse angeben');
      applySel({ link: href || undefined });
    }));
  }
  const grouped = sel.some((e) => e.groupId);
  if (sel.length > 1 && !locked) items.push(actBtn('group', grouped ? 'Gruppierung aufheben (Strg+Umschalt+G)' : 'Gruppieren (Strg+G)', grouped ? ungroupSel : groupSel));
  items.push(toggleBtn(locked ? 'lock' : 'unlock', locked, locked ? 'Entsperren (Strg+L)' : 'Sperren (Strg+L)', toggleLock));
  if (!locked) {
    items.push(actBtn('comment', 'Kommentieren', () => {
      const b = selectionBounds();
      const c = makeElement('comment', b.x + b.w, b.y);
      act(() => setEl(c));
      setSelection([c.id]);
      app.emit('openComment', c.id, true);
    }));
    const more = actBtn('more', 'Mehr', () => menu(more, [
      { label: 'Duplizieren', icon: 'copy', hint: 'Strg+D', onClick: () => duplicateEls(collectForCopy([...app.sel])) },
      { label: 'In den Vordergrund', icon: 'front', hint: 'Strg+]', onClick: bringToFront },
      { label: 'In den Hintergrund', icon: 'back', hint: 'Strg+[', onClick: sendToBack },
      { label: 'Auswahl einpassen', icon: 'fit', hint: 'Umschalt+2', onClick: () => fitTo(selectionBounds(), { maxZ: 2 }) },
      { label: 'Als PNG exportieren', icon: 'download', onClick: () => exportPng(true) },
      '-',
      { label: 'Löschen', icon: 'trash', danger: true, hint: 'Entf', onClick: () => deleteEls([...app.sel]) },
    ], { placement: 'top' }));
    items.push(more);
    items.push(actBtn('trash', 'Löschen (Entf)', () => deleteEls([...app.sel])));
  }
  ctxbar.append(...items);
  ctxbar.classList.remove('hidden');
  positionCtx();
}

function alignBtn(cur) {
  const icons = { left: 'tAlignLeft', center: 'tAlignCenter', right: 'tAlignRight' };
  const next = { left: 'center', center: 'right', right: 'left' };
  return actBtn(icons[cur], 'Textausrichtung', () => applySel({ align: next[cur] }));
}

function positionCtx() {
  if (ctxbar.classList.contains('hidden')) return;
  const b = selectionBounds();
  if (!b || ctxHidden) {
    ctxbar.style.visibility = 'hidden';
    return;
  }
  ctxbar.style.visibility = '';
  const sr = stage.getBoundingClientRect();
  const p1 = toScreen(b.x, b.y), p2 = toScreen(b.x + b.w, b.y + b.h);
  const cw = ctxbar.offsetWidth, ch = ctxbar.offsetHeight;
  let x = sr.left + (p1.x + p2.x) / 2 - cw / 2;
  let y = sr.top + p1.y - ch - 40;
  if (y < 64) y = sr.top + p2.y + 40;
  if (y + ch > innerHeight - 8) y = Math.max(64, sr.top + p1.y + 8);
  x = Math.max(8, Math.min(innerWidth - cw - 8, x));
  ctxbar.style.left = x + 'px';
  ctxbar.style.top = y + 'px';
}

app.on('selection', buildCtx);
app.on('tool', buildCtx);
app.on('overlay', positionCtx);
app.on('dragging', (d) => {
  ctxHidden = d;
  positionCtx();
});
app.on('editing', (on) => {
  ctxHidden = on;
  positionCtx();
});
app.on('history', () => {
  $('#btn-undo').disabled = !canUndo();
  $('#btn-redo').disabled = !canRedo();
});

/* ================================================================== */
/* Karten-Dialog                                                       */
/* ================================================================== */

app.on('editCard', (id) => {
  const el = getEl(id);
  if (!el) return;
  let color = el.color || '#4262ff';
  const title = h('input', { type: 'text', value: el.title || '' });
  const desc = h('textarea', { rows: 4 }, el.description || '');
  const assignee = h('input', { type: 'text', value: el.assignee || '', placeholder: 'Name', list: 'assignee-list' });
  const due = h('input', { type: 'date', value: el.due || '' });
  const status = h('input', { type: 'text', value: el.status || '', placeholder: 'z. B. In Arbeit', list: 'status-list' });
  const names = [...new Set([app.user.name, ...[...app.peers.values()].map((p) => p.name), ...[...app.els.values()].filter((e) => e.assignee).map((e) => e.assignee)].filter(Boolean))];
  const sw = swatchGrid(PALETTE.slice(6), color, (c) => {
    color = c;
    sw.querySelectorAll('.swatch').forEach((s) => s.classList.toggle('active', s.title === c));
  });
  const form = h('form', { class: 'form', onsubmit: (e) => {
    e.preventDefault();
    act(() => updateEl(id, { title: title.value, description: desc.value, assignee: assignee.value.trim(), due: due.value, status: status.value.trim(), color }));
    m.close();
  } },
  h('label', {}, 'Titel', title),
  h('label', {}, 'Beschreibung', desc),
  h('div', { class: 'form-row' }, h('label', {}, 'Zuständig', assignee), h('label', {}, 'Fällig am', due)),
  h('label', {}, 'Status / Label', status),
  h('datalist', { id: 'assignee-list' }, names.map((n) => h('option', { value: n }))),
  h('datalist', { id: 'status-list' }, ['Offen', 'In Arbeit', 'Review', 'Blockiert', 'Fertig', 'Hoch', 'Mittel', 'Niedrig'].map((n) => h('option', { value: n }))),
  h('div', {}, h('div', { class: 'label' }, 'Farbe'), sw),
  h('div', { class: 'form-actions' }, h('button', { type: 'button', class: 'btn', onclick: () => m.close() }, 'Abbrechen'), h('button', { type: 'submit', class: 'btn primary' }, 'Speichern')));
  const m = modal('Karte bearbeiten', form);
  setTimeout(() => title.focus(), 0);
});

/* ================================================================== */
/* Kommentare                                                          */
/* ================================================================== */

let commentPop = null;

app.on('openComment', (id, isNew) => openComment(id, isNew));

function openComment(id, isNew) {
  closeComment();
  const el = getEl(id);
  if (!el) return;
  const box = h('div', { class: 'comment-pop panel' });
  document.body.append(box);
  commentPop = { id, box, len: -1, resolved: null };
  renderCommentPop();
  positionComment();
  if (isNew) box.querySelector('textarea')?.focus();
}

function renderCommentPop() {
  if (!commentPop) return;
  const el = getEl(commentPop.id);
  if (!el) return closeComment();
  const thread = el.thread || [];
  if (commentPop.len === thread.length && commentPop.resolved === el.resolved) return;
  commentPop.len = thread.length;
  commentPop.resolved = el.resolved;
  const box = commentPop.box;
  const draft = box.querySelector('textarea')?.value || '';
  box.innerHTML = '';
  const input = h('textarea', { rows: 2, placeholder: thread.length ? 'Antworten …' : 'Kommentar schreiben … (@Name erwähnen)' }, draft);
  const send = () => {
    const t = input.value.trim();
    if (!t) return;
    const cur = getEl(commentPop.id);
    act(() => setEl({ ...cur, thread: [...(cur.thread || []), { author: app.user.name || 'Gast', color: app.user.color, text: t, ts: Date.now() }] }));
    input.value = '';
    renderCommentPop();
  };
  input.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
    if (e.key === 'Escape') closeComment();
  });
  append(box,
    h('div', { class: 'comment-head' },
      h('strong', {}, el.resolved ? 'Erledigt' : 'Kommentar'),
      h('span', { class: 'spacer' }),
      app.viewOnly ? null : iconBtn(el.resolved ? 'undo' : 'check', el.resolved ? 'Wieder öffnen' : 'Als erledigt markieren', () => {
        act(() => updateEl(el.id, { resolved: !el.resolved }));
        renderCommentPop();
      }),
      app.viewOnly ? null : iconBtn('trash', 'Kommentar löschen', () => {
        deleteEls([el.id]);
        closeComment();
      }),
      iconBtn('close', 'Schließen', closeComment)),
    h('div', { class: 'comment-list' }, thread.map((m) => h('div', { class: 'comment-msg' },
      h('div', { class: 'comment-meta' }, h('span', { class: 'avatar xs', style: { background: m.color || '#888' } }, initials(m.author)), h('b', {}, m.author), h('span', { class: 'muted' }, relTime(m.ts))),
      h('div', { class: 'comment-text', html: esc(m.text).replace(/@([\wäöüÄÖÜß.-]+)/g, '<span class="mention">@$1</span>') })))),
    app.viewOnly ? null : h('div', { class: 'comment-input' }, input, h('button', { class: 'btn primary small', onclick: send }, 'Senden')),
  );
  const list = box.querySelector('.comment-list');
  list.scrollTop = list.scrollHeight;
}

function positionComment() {
  if (!commentPop) return;
  const el = getEl(commentPop.id);
  if (!el) return closeComment();
  const sr = stage.getBoundingClientRect();
  const p = toScreen(el.x, el.y);
  const box = commentPop.box;
  let x = sr.left + p.x + 44, y = sr.top + p.y - 40;
  x = Math.min(innerWidth - box.offsetWidth - 8, x);
  y = Math.max(64, Math.min(innerHeight - box.offsetHeight - 8, y));
  box.style.left = x + 'px';
  box.style.top = y + 'px';
}

function closeComment() {
  if (!commentPop) return;
  const el = getEl(commentPop.id);
  commentPop.box.remove();
  const id = commentPop.id;
  commentPop = null;
  if (el && !(el.thread || []).length && !app.viewOnly) deleteEls([id]);
}

app.on('render', () => {
  renderCommentPop();
  if (sidePanel === 'comments') renderSidePanel();
});
app.on('view', positionComment);
app.on('overlay', positionComment);
document.addEventListener('pointerdown', (e) => {
  if (commentPop && !commentPop.box.contains(e.target) && !(e.target.closest && e.target.closest('.el-comment'))) closeComment();
}, true);

/* ================================================================== */
/* Seitenpanel (Frames, Kommentare)                                    */
/* ================================================================== */

let sidePanel = null;
const side = $('#sidepanel');

export function toggleSidePanel(kind) {
  sidePanel = sidePanel === kind ? null : kind;
  renderSidePanel();
}

export function showSidePanel(kind) {
  sidePanel = kind;
  renderSidePanel();
}

export const currentSidePanel = () => sidePanel;

const renderSideThrottled = throttle(() => renderSidePanel(), 500);
app.on('render', () => sidePanel === 'frames' && renderSideThrottled());

export function renderSidePanel() {
  side.classList.toggle('hidden', !sidePanel);
  document.querySelectorAll('[data-panel]').forEach((b) => b.classList.toggle('active', b.dataset.panel === sidePanel));
  if (!sidePanel) return;
  // Nicht neu aufbauen, während jemand in ein Textfeld des Panels tippt (Checkboxen sind unkritisch)
  const ae = document.activeElement;
  if (side.contains(ae) && ae.tagName === 'INPUT' && ae.type !== 'checkbox') return;
  side.innerHTML = '';
  const close = iconBtn('close', 'Schließen', () => toggleSidePanel(sidePanel));
  if (sidePanel === 'frames') {
    const list = frames();
    side.append(h('div', { class: 'side-head' }, h('h3', {}, 'Frames'), h('span', { class: 'spacer' }), close));
    side.append(h('div', { class: 'side-actions' },
      h('button', { class: 'btn primary small', disabled: !list.length, onclick: () => app.emit('present', null) }, h('span', { html: ICONS.present }), 'Präsentieren'),
      app.viewOnly ? null : h('button', { class: 'btn small', onclick: () => {
        const c = viewCenter();
        const f = makeElement('frame', c.x, c.y);
        addElements([f]);
        fitTo({ x: f.x, y: f.y, w: f.w, h: f.h });
      } }, h('span', { html: ICONS.plus }), 'Frame')));
    if (!list.length) side.append(h('p', { class: 'muted pad' }, 'Noch keine Frames. Frames gliedern dein Board in Bereiche und dienen als Folien im Präsentationsmodus.'));
    const ul = h('div', { class: 'frame-list' });
    list.forEach((f, i) => {
      const prev = h('div', { class: 'frame-thumb' });
      const kids = frameChildren(f);
      const ids = new Set(kids.map((k) => k.id));
      for (const c of app.els.values()) if (c.type === 'connector' && c.from.id && c.to.id && ids.has(c.from.id) && ids.has(c.to.id)) kids.push(c);
      prev.innerHTML = renderSvgDocument([f, ...kids], { bounds: { x: f.x, y: f.y, w: f.w, h: f.h }, padding: 0 }).svg;
      ul.append(h('div', { class: 'frame-item' + (app.sel.has(f.id) ? ' active' : ''), onclick: () => {
        setSelection([f.id]);
        fitTo({ x: f.x, y: f.y, w: f.w, h: f.h }, { pad: 40, maxZ: 4 });
      } },
      h('span', { class: 'frame-no' }, i + 1), prev,
      h('span', { class: 'frame-name' }, f.title || 'Frame'),
      app.viewOnly ? null : h('span', { class: 'frame-ord' },
        iconBtn('chevUp', 'Nach oben', (e) => { e.stopPropagation(); moveFrame(list, i, -1); }, { disabled: i === 0 }),
        iconBtn('chevDown', 'Nach unten', (e) => { e.stopPropagation(); moveFrame(list, i, 1); }, { disabled: i === list.length - 1 }))));
    });
    side.append(ul);
  } else if (sidePanel === 'comments') {
    const all = [...app.els.values()].filter((e) => e.type === 'comment' && (e.thread || []).length);
    const open = all.filter((e) => !e.resolved);
    side.append(h('div', { class: 'side-head' }, h('h3', {}, `Kommentare (${open.length} offen)`), h('span', { class: 'spacer' }), close));
    const toggle = h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: !app.settings.hideResolved, onchange: (e) => {
      app.settings.hideResolved = !e.target.checked;
      saveSettings();
      renderSidePanel();
    } }), 'Erledigte anzeigen');
    side.append(h('div', { class: 'side-actions' }, toggle));
    const list = (app.settings.hideResolved ? open : all).sort((a, b) => (b.thread.at(-1)?.ts || 0) - (a.thread.at(-1)?.ts || 0));
    if (!list.length) side.append(h('p', { class: 'muted pad' }, 'Keine Kommentare. Mit dem Kommentar-Werkzeug (C) kannst du überall auf dem Board Feedback hinterlassen.'));
    for (const c of list) {
      const first = c.thread[0], last = c.thread.at(-1);
      side.append(h('div', { class: 'comment-card' + (c.resolved ? ' resolved' : ''), onclick: () => {
        fitTo({ x: c.x - 200, y: c.y - 200, w: 400, h: 400 }, { maxZ: 1.5 });
        setTimeout(() => openComment(c.id), 320);
      } },
      h('div', { class: 'comment-meta' }, h('span', { class: 'avatar xs', style: { background: first.color || '#888' } }, initials(first.author)), h('b', {}, first.author), h('span', { class: 'muted' }, relTime(last.ts))),
      h('div', { class: 'comment-text' }, first.text),
      c.thread.length > 1 ? h('div', { class: 'muted small' }, `${c.thread.length - 1} Antwort${c.thread.length > 2 ? 'en' : ''}`) : null));
    }
  } else if (sidePanel === 'votes') {
    app.emit('renderVotesPanel', side, close);
  }
}

function moveFrame(list, i, d) {
  const arr = [...list];
  const [f] = arr.splice(i, 1);
  arr.splice(i + d, 0, f);
  act(() => arr.forEach((fr, k) => fr.order !== k + 1 && setEl({ ...getEl(fr.id), order: k + 1 })));
  renderSidePanel();
}

/* ================================================================== */
/* Vorlagen                                                            */
/* ================================================================== */

export function openTemplates() {
  if (app.viewOnly) return;
  const m = modal('Vorlage einfügen', templateGallery((t) => {
    m.close();
    insertTemplate(t);
  }, { showBlank: false }), { wide: true });
}

function insertTemplate(t) {
  const els = t.build();
  if (!els.length) return;
  const b = unionRect(els.map((e) => elBounds(e, (id) => els.find((x) => x.id === id))));
  const c = viewCenter();
  let tx = c.x - (b.x + b.w / 2), ty = c.y - (b.y + b.h / 2);
  // Nicht über bestehende Inhalte legen
  const target = { x: b.x + tx, y: b.y + ty, w: b.w, h: b.h };
  const existing = [...app.els.values()].map(bounds);
  if (existing.some((r) => rectsIntersect(r, target))) {
    const all = unionRect(existing);
    // rechts daneben oder darunter – je nachdem, was das Board kompakter hält
    if (all.w > all.h * 1.6) {
      tx = all.x - b.x;
      ty = all.y + all.h + 200 - b.y;
    } else {
      tx = all.x + all.w + 200 - b.x;
      ty = all.y - b.y;
    }
  }
  const moved = els.map((e) => {
    const n = { ...e, z: nextZ() };
    if (n.type === 'connector') {
      if (!n.from.id) n.from = { x: n.from.x + tx, y: n.from.y + ty };
      if (!n.to.id) n.to = { x: n.to.x + tx, y: n.to.y + ty };
    } else {
      n.x += tx;
      n.y += ty;
    }
    if (n.type === 'sticky') n.author = app.user.name || '';
    return n;
  });
  addElements(moved, { select: false });
  setSelection([]);
  fitTo({ x: b.x + tx, y: b.y + ty, w: b.w, h: b.h }, { maxZ: 1 });
  toast(`Vorlage „${t.name}“ eingefügt`);
}

/* ================================================================== */
/* Export / Import                                                     */
/* ================================================================== */

async function exportPng(selection = false) {
  try {
    const els = selection ? collectForCopy([...app.sel]) : [...app.els.values()];
    if (!els.length) return toast('Nichts zu exportieren');
    toast('PNG wird erstellt …');
    const url = await pngDataUrl(els, { scale: 2, background: app.settings.dark ? '#1e1f24' : '#ffffff' });
    download(safeName(app.name) + '.png', url);
  } catch (e) {
    toast('Export fehlgeschlagen: ' + e.message);
  }
}

function exportSvg() {
  const els = [...app.els.values()];
  if (!els.length) return toast('Nichts zu exportieren');
  download(safeName(app.name) + '.svg', new Blob([svgString(els)], { type: 'image/svg+xml' }));
}

function exportJson() {
  const data = { format: 'dlzboard', version: 1, name: app.name, exportedAt: new Date().toISOString(), elements: [...app.els.values()] };
  download(safeName(app.name) + '.dlzboard.json', new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' }));
}

async function exportPdf() {
  try {
    await printFrames([...app.els.values()], frames(), app.name);
  } catch (e) {
    toast(e.message);
  }
}

const importInput = h('input', { type: 'file', accept: '.json,application/json', style: { display: 'none' } });
document.body.append(importInput);
importInput.addEventListener('change', () => {
  if (importInput.files[0]) importFile(importInput.files[0]);
  importInput.value = '';
});

async function importFile(file) {
  if (app.viewOnly) return toast('Du darfst dieses Board nur ansehen.');
  try {
    const data = JSON.parse(await file.text());
    const list = Array.isArray(data) ? data : Array.isArray(data.elements) ? data.elements : Object.values(data.elements || {});
    if (!list.length) return toast('Keine Elemente gefunden');
    pasteElements(list, viewCenter());
    fitTo(selectionBounds(), { maxZ: 1 });
    toast(`${list.length} Elemente importiert`);
  } catch {
    toast('Datei konnte nicht importiert werden');
  }
}
app.on('importFile', importFile);

function openExportMenu(anchor) {
  menu(anchor, [
    { header: 'Exportieren' },
    { label: 'Als PNG-Bild', icon: 'image', onClick: () => exportPng(false) },
    { label: 'Auswahl als PNG', icon: 'image', disabled: !app.sel.size, onClick: () => exportPng(true) },
    { label: 'Als SVG-Vektorgrafik', icon: 'shape', onClick: exportSvg },
    { label: 'Als PDF (Frames als Seiten)', icon: 'present', onClick: exportPdf },
    { label: 'Als JSON-Datei (Backup)', icon: 'download', onClick: exportJson },
    '-',
    { header: 'Importieren' },
    { label: 'JSON-Datei importieren', icon: 'upload', disabled: app.viewOnly, onClick: () => importInput.click() },
    { label: 'Bild hochladen', icon: 'image', disabled: app.viewOnly, onClick: () => fileInput.click() },
  ]);
}

/* ================================================================== */
/* Teilen, Profil, Einstellungen, Hilfe                                */
/* ================================================================== */

function openShare() {
  openShareDialog(app.boardId, { me: app.me });
}

// Profil wurde gespeichert: Anzeige und Echtzeit-Identität aktualisieren
function profileSaved(user) {
  app.me = user;
  app.user = { id: user.id, name: user.displayName, color: user.color };
  app.sync.reconnectAs(app.user);
  app.emit('peers');
}

export function openProfile() {
  openProfileDialog(app.me, profileSaved);
}

function openSettings(anchor) {
  const s = app.settings;
  const t = (key, label) => ({ label, checked: !!s[key], keep: true, onClick: () => {
    s[key] = !s[key];
    saveSettings();
    openSettings(anchor);
  } });
  menu(anchor, [
    { header: 'Ansicht' },
    t('grid', 'Raster anzeigen'),
    t('dark', 'Dunkles Design'),
    t('showAuthor', 'Autor auf Sticky Notes'),
    t('hideResolved', 'Erledigte Kommentare ausblenden'),
    { header: 'Bearbeitung' },
    t('snap', 'Am Raster einrasten'),
    t('smartGuides', 'Intelligente Hilfslinien'),
    t('wheelZoom', 'Mausrad zoomt (statt verschieben)'),
    { label: 'Tastenkürzel', icon: 'keyboard', onClick: openShortcuts },
    '-',
    ...accountMenuItems(app.me, profileSaved),
  ], { placement: 'bottom' });
}

export function openShortcuts() {
  const groups = [
    ['Werkzeuge', [['V', 'Auswählen'], ['H / Leertaste', 'Verschieben'], ['N', 'Sticky Note'], ['T', 'Text'], ['S', 'Form'], ['R / O', 'Rechteck / Ellipse'], ['L', 'Verbindungslinie'], ['P', 'Stift'], ['E', 'Radierer'], ['F', 'Frame'], ['K', 'Karte'], ['M', 'Mindmap'], ['C', 'Kommentar'], ['X', 'Laserpointer']]],
    ['Bearbeiten', [['Strg+Z / Strg+Y', 'Rückgängig / Wiederholen'], ['Strg+C / X / V', 'Kopieren / Ausschneiden / Einfügen'], ['Strg+D', 'Duplizieren'], ['Alt + Ziehen', 'Kopie ziehen'], ['Entf', 'Löschen'], ['Strg+A', 'Alles auswählen'], ['Strg+G', 'Gruppieren'], ['Strg+Umschalt+G', 'Gruppe auflösen'], ['Strg+L', 'Sperren'], ['Strg+] / [', 'Vorder-/Hintergrund'], ['Pfeiltasten', 'Verschieben (Umschalt: 10px)'], ['Enter / Doppelklick', 'Text bearbeiten'], ['Esc / Strg+Enter', 'Bearbeitung beenden']]],
    ['Mindmap', [['Tab', 'Unterknoten hinzufügen'], ['Enter (beim Tippen)', 'Geschwisterknoten'], ['Umschalt+Enter', 'Geschwisterknoten']]],
    ['Ansicht', [['Strg + Mausrad', 'Zoomen'], ['Strg + / −', 'Zoomen'], ['Strg+0', 'Auf 100 %'], ['Umschalt+1', 'Alles anzeigen'], ['Umschalt+2', 'Auswahl anzeigen'], ['Strg+F', 'Suchen']]],
  ];
  modal('Tastenkürzel', h('div', { class: 'shortcuts' }, groups.map(([t, list]) => h('div', {}, h('h4', {}, t), h('table', {}, list.map(([k, d]) => h('tr', {}, h('td', {}, h('kbd', {}, k)), h('td', {}, d))))))), { wide: true });
}

/* ================================================================== */
/* Suche                                                               */
/* ================================================================== */

const searchBox = $('#search-box');

function textOf(el) {
  return [el.text, el.title, el.description, el.label, el.assignee, el.status, ...(el.thread || []).map((m) => m.text), ...(el.cells || []).flat()].filter(Boolean).join(' ');
}

export function openSearch() {
  searchBox.classList.remove('hidden');
  searchBox.innerHTML = '';
  const count = h('span', { class: 'muted small' });
  const input = h('input', { type: 'search', placeholder: 'Auf dem Board suchen …' });
  const go = (d) => {
    if (!app.searchHits.length) return;
    app.searchIndex = (app.searchIndex + d + app.searchHits.length) % app.searchHits.length;
    const el = getEl(app.searchHits[app.searchIndex]);
    if (el) fitTo(bounds(el), { maxZ: 1.5, pad: 200 });
    count.textContent = `${app.searchIndex + 1} / ${app.searchHits.length}`;
    scheduleRender(true);
  };
  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    app.searchHits = q ? [...app.els.values()].filter((e) => textOf(e).toLowerCase().includes(q)).map((e) => e.id) : [];
    app.searchIndex = -1;
    count.textContent = q ? `${app.searchHits.length} Treffer` : '';
    scheduleRender(true);
    if (app.searchHits.length) go(1);
  });
  input.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') go(e.shiftKey ? -1 : 1);
    if (e.key === 'Escape') closeSearch();
  });
  searchBox.append(h('span', { html: ICONS.search, class: 'muted' }), input, count,
    iconBtn('chevUp', 'Vorheriger', () => go(-1)), iconBtn('chevDown', 'Nächster', () => go(1)), iconBtn('close', 'Schließen', closeSearch));
  input.focus();
}

function closeSearch() {
  searchBox.classList.add('hidden');
  app.searchHits = [];
  app.searchIndex = -1;
  scheduleRender(true);
}

/* ================================================================== */
/* Kontextmenü                                                         */
/* ================================================================== */

let ctxMenu = null;

function closeContextMenu() {
  if (ctxMenu) ctxMenu.remove();
  ctxMenu = null;
}

stage.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  if (app.viewOnly) return;
  closeContextMenu();
  const w = toWorld(e.clientX, e.clientY);
  const g = e.target.closest && e.target.closest('g[data-id]');
  const el = g && getEl(g.dataset.id);
  if (el && !app.sel.has(el.id)) setSelection([el.id]);
  const has = app.sel.size > 0;
  const items = has ? [
    { label: 'Kopieren', hint: 'Strg+C', onClick: () => document.execCommand('copy') },
    { label: 'Duplizieren', hint: 'Strg+D', onClick: () => duplicateEls(collectForCopy([...app.sel])) },
    { label: 'In den Vordergrund', hint: 'Strg+]', onClick: bringToFront },
    { label: 'In den Hintergrund', hint: 'Strg+[', onClick: sendToBack },
    { label: selectedEls().every((x) => x.locked) ? 'Entsperren' : 'Sperren', hint: 'Strg+L', onClick: toggleLock },
    app.sel.size > 1 ? { label: 'Gruppieren', hint: 'Strg+G', onClick: groupSel } : null,
    selectedEls().some((x) => x.groupId) ? { label: 'Gruppierung aufheben', onClick: ungroupSel } : null,
    { label: 'Kommentar hinzufügen', onClick: () => {
      const c = makeElement('comment', w.x, w.y);
      act(() => setEl(c));
      app.emit('openComment', c.id, true);
    } },
    '-',
    { label: 'Löschen', hint: 'Entf', danger: true, onClick: () => deleteEls([...app.sel]) },
  ] : [
    { label: 'Sticky Note hier', onClick: () => { const s = makeElement('sticky', w.x, w.y); addElements([s]); startEdit(s.id, { isNew: true }); } },
    { label: 'Text hier', onClick: () => { const s = makeElement('text', w.x, w.y); act(() => setEl(s)); startEdit(s.id, { isNew: true }); } },
    { label: 'Kommentar hier', onClick: () => { const c = makeElement('comment', w.x, w.y); act(() => setEl(c)); app.emit('openComment', c.id, true); } },
    { label: 'Vorlage einfügen …', onClick: openTemplates },
    '-',
    { label: 'Alles auswählen', hint: 'Strg+A', onClick: () => setSelection([...app.els.keys()]) },
    { label: 'Alles anzeigen', hint: 'Umschalt+1', onClick: () => fitAll() },
  ];
  const list = h('div', { class: 'menu' }, items.filter(Boolean).map((it) => it === '-' ? h('div', { class: 'menu-sep' }) : h('button', { class: 'menu-item' + (it.danger ? ' danger' : ''), onclick: () => { closeContextMenu(); it.onClick(); } },
    h('span', { class: 'mi-label' }, it.label), it.hint ? h('span', { class: 'mi-hint' }, it.hint) : null)));
  ctxMenu = h('div', { class: 'popover panel context-menu' }, list);
  document.body.append(ctxMenu);
  const r = ctxMenu.getBoundingClientRect();
  ctxMenu.style.left = Math.min(e.clientX, innerWidth - r.width - 8) + 'px';
  ctxMenu.style.top = Math.min(e.clientY, innerHeight - r.height - 8) + 'px';
});

/* ================================================================== */
/* Minimap & Zoom                                                      */
/* ================================================================== */

const mini = $('#minimap canvas');
const mctx = mini.getContext('2d');
let miniState = null;

const drawMinimap = throttle(() => {
  if ($('#minimap').classList.contains('hidden')) return;
  const W = mini.width = mini.clientWidth * devicePixelRatio;
  const H = mini.height = mini.clientHeight * devicePixelRatio;
  const vr = visibleRect();
  const all = unionRect([...[...app.els.values()].map(bounds), vr]);
  const pad = Math.max(all.w, all.h) * 0.05;
  const wb = { x: all.x - pad, y: all.y - pad, w: all.w + pad * 2, h: all.h + pad * 2 };
  const s = Math.min(W / wb.w, H / wb.h);
  const ox = (W - wb.w * s) / 2 - wb.x * s, oy = (H - wb.h * s) / 2 - wb.y * s;
  miniState = { s, ox, oy };
  mctx.clearRect(0, 0, W, H);
  const list = [...app.els.values()].sort((a, b) => (a.type === 'frame' ? -1 : 0) - (b.type === 'frame' ? -1 : 0));
  for (const el of list) {
    if (el.type === 'connector' || el.type === 'comment') continue;
    const b = bounds(el);
    let fill = el.fill;
    if (el.type === 'frame') fill = app.settings.dark ? '#3a3b42' : '#ffffff';
    else if (el.type === 'pen') fill = el.stroke;
    else if (el.type === 'card' || el.type === 'table' || el.type === 'image') fill = el.type === 'image' ? '#adb5bd' : '#ffffff';
    else if (!fill || fill === 'transparent') fill = '#ced4da';
    mctx.fillStyle = fill;
    mctx.fillRect(b.x * s + ox, b.y * s + oy, Math.max(1, b.w * s), Math.max(1, b.h * s));
    if (el.type === 'frame') {
      mctx.strokeStyle = '#ced4da';
      mctx.strokeRect(b.x * s + ox, b.y * s + oy, b.w * s, b.h * s);
    }
  }
  mctx.strokeStyle = '#4262ff';
  mctx.lineWidth = 2 * devicePixelRatio;
  mctx.fillStyle = 'rgba(66,98,255,0.08)';
  mctx.fillRect(vr.x * s + ox, vr.y * s + oy, vr.w * s, vr.h * s);
  mctx.strokeRect(vr.x * s + ox, vr.y * s + oy, vr.w * s, vr.h * s);
}, 120);

function miniNavigate(e) {
  if (!miniState) return;
  const r = mini.getBoundingClientRect();
  const px = (e.clientX - r.left) * devicePixelRatio, py = (e.clientY - r.top) * devicePixelRatio;
  const wx = (px - miniState.ox) / miniState.s, wy = (py - miniState.oy) / miniState.s;
  const sr = stage.getBoundingClientRect();
  app.view.x = sr.width / 2 - wx * app.view.z;
  app.view.y = sr.height / 2 - wy * app.view.z;
  applyView();
}

mini.addEventListener('pointerdown', (e) => {
  mini.setPointerCapture(e.pointerId);
  miniNavigate(e);
  const mv = (ev) => miniNavigate(ev);
  const up = () => {
    mini.removeEventListener('pointermove', mv);
    mini.removeEventListener('pointerup', up);
    mini.removeEventListener('pointercancel', up);
    mini.removeEventListener('lostpointercapture', up);
  };
  mini.addEventListener('pointermove', mv);
  mini.addEventListener('pointerup', up);
  mini.addEventListener('pointercancel', up);
  mini.addEventListener('lostpointercapture', up);
});

app.on('render', drawMinimap);
app.on('view', drawMinimap);

function buildZoom() {
  const z = $('#zoomctl');
  const pct = h('button', { class: 'zoom-pct', title: 'Zoomstufe' }, '100 %');
  z.append(
    iconBtn('minus', 'Verkleinern (Strg −)', () => zoomBy(1 / 1.25)),
    pct,
    iconBtn('plus', 'Vergrößern (Strg +)', () => zoomBy(1.25)),
    iconBtn('fit', 'Alles anzeigen (Umschalt+1)', () => fitAll()),
    iconBtn('layers', 'Minimap ein/aus', () => {
      $('#minimap').classList.toggle('hidden');
      drawMinimap();
    }),
  );
  pct.onclick = () => menu(pct, [25, 50, 100, 150, 200, 400].map((p) => ({ label: p + ' %', onClick: () => {
    const r = stage.getBoundingClientRect();
    zoomAt(r.left + r.width / 2, r.top + r.height / 2, p / 100);
  } })).concat(['-', { label: 'Alles anzeigen', onClick: () => fitAll() }]), { placement: 'top' });
  app.on('view', () => (pct.textContent = Math.round(app.view.z * 100) + ' %'));
}

/* ================================================================== */
/* Kopfzeile                                                           */
/* ================================================================== */

function buildTopbar() {
  const top = $('#topbar');
  const nameInput = h('input', { id: 'board-name', type: 'text', value: app.name, title: 'Board umbenennen', readonly: app.viewOnly });
  nameInput.addEventListener('change', () => {
    const n = nameInput.value.trim() || 'Unbenanntes Board';
    app.name = n;
    document.title = n + ' – dlzboard';
    app.sync.op({ op: 'rename', name: n });
  });
  nameInput.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') nameInput.blur();
  });
  app.on('name', () => {
    nameInput.value = app.name;
    document.title = app.name + ' – dlzboard';
  });
  const status = h('span', { id: 'conn-status', title: 'Verbindung' });
  app.on('status', (ok) => {
    status.classList.toggle('ok', ok);
    status.title = ok ? 'Verbunden – Änderungen werden live gespeichert' : 'Verbindung unterbrochen – wird wiederhergestellt …';
  });
  append(top,
    h('a', { href: '/', class: 'icon-btn brand', title: 'Alle Boards', html: '<svg viewBox="0 0 32 32" width="26" height="26"><rect x="2" y="2" width="28" height="28" rx="7" fill="#4262ff"/><rect x="8" y="8" width="9" height="9" rx="1.5" fill="#fff9b1"/><rect x="15" y="15" width="9" height="9" rx="1.5" fill="#ffcee0"/></svg>' }),
    nameInput, status,
    app.viewOnly ? h('span', { class: 'badge' }, 'Nur ansehen') : null,
    h('span', { class: 'top-sep' }),
    app.viewOnly ? null : iconBtn('template', 'Vorlagen', openTemplates),
    iconBtn('frame', 'Frames & Präsentation', () => toggleSidePanel('frames'), { 'data-panel': 'frames' }),
    iconBtn('comment', 'Kommentare', () => toggleSidePanel('comments'), { 'data-panel': 'comments' }),
    iconBtn('search', 'Suchen (Strg+F)', openSearch),
    iconBtn('download', 'Exportieren & Importieren', (e) => openExportMenu(e.currentTarget)),
  );
  const right = $('#topright');
  const tools = h('div', { class: 'collab-tools' });
  right.append(tools, h('div', { id: 'avatars' }),
    h('button', { class: 'btn primary small share-btn', onclick: openShare }, h('span', { html: ICONS.share }), 'Teilen'),
    iconBtn('settings', 'Einstellungen', (e) => openSettings(e.currentTarget)));
  app.emit('buildCollabTools', tools);
}

function buildBottomLeft() {
  const bl = $('#bottom-left');
  bl.append(
    iconBtn('undo', 'Rückgängig (Strg+Z)', undo, { id: 'btn-undo', disabled: true }),
    iconBtn('redo', 'Wiederholen (Strg+Y)', redo, { id: 'btn-redo', disabled: true }),
    h('span', { class: 'top-sep' }),
    iconBtn('keyboard', 'Tastenkürzel', openShortcuts),
  );
  if (app.viewOnly) bl.querySelectorAll('#btn-undo,#btn-redo').forEach((b) => b.remove());
}

app.on('key', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
    e.preventDefault();
    openSearch();
  } else if (e.key === '?') {
    e.preventDefault();
    openShortcuts();
  }
});

export function initUI() {
  buildTopbar();
  buildTools();
  buildZoom();
  buildBottomLeft();
  syncToolButtons();
  window.addEventListener('resize', () => {
    positionCtx();
    drawMinimap();
  });
}
