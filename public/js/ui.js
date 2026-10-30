// Benutzeroberfläche des Board-Editors
import {
  h, append, ICONS, esc, toast, modal, promptDialog, confirmDialog, STICKY_COLORS, PALETTE, USER_COLORS, unionRect,
  initials, relTime, rectsIntersect, throttle, uid, api,
} from './util.js';
import { SHAPES, SHAPE_GROUPS, shapeGeom, shapeDecor, renderSvgDocument, elBounds, safeLink, PRIORITIES, cardTags, ARROW_HEADS, headType, waypointsOf, cellStyle } from './render.js';
import { LANGUAGES } from './highlight.js';
import { templateGallery } from './gallery.js';
import { popover, closePop, menu } from './menu.js';
import { openShareDialog } from './share.js';
import { openProfileDialog, accountMenuItems } from './account.js';
import { legalLinks } from './footer.js';
import { bellButton, refresh as refreshBell } from './notifications.js';

export { popover, closePop, menu };
import {
  app, $, stage, getEl, bounds, setTool, saveToolOpts, selectedEls, selectionBounds, act, setEl, updateEl, deleteEls,
  undo, redo, canUndo, canRedo, zoomBy, zoomAt, fitAll, fitTo, toScreen, visibleRect, viewCenter, applyView, startEdit,
  duplicateEls, collectForCopy, bringToFront, sendToBack, groupSel, ungroupSel, toggleLock, alignSel, distributeSel,
  arrangeGrid, clusterByColor, frames, makeElement, addElements, nextZ, insertImageFile, setSelection, pasteElements,
  saveSettings, toWorld, scheduleRender, autoHeight, animateView, lastPointer, frameChildren,
  matchSize, packSel, snapSelToGrid, copySize, pasteSize, hasCopiedSize, setGeometry, gridSize,
  tableRange, formatCells, tableAction, applyRemoteOp, isLocked, toggleModLock, newComment,
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
  ['frame', 'Frame (F)'], ['card', 'Karte / Aufgabe (K)'], ['table', 'Tabelle'], ['code', 'Code-Block'], ['mindmap', 'Mindmap (M)'],
  ['comment', 'Kommentar (C)'], ['emoji', 'Sticker & Emojis'], ['image', 'Bild oder Datei hochladen (Bilder, PDF, Office, Text)'], ['laser', 'Laserpointer (X)'], '|',
  ['template', 'Vorlagen'], ['diagram', 'Diagramm aus Text (Mermaid-Syntax)'],
];

const EMOJIS = ['👍', '👎', '❤️', '⭐', '✅', '❌', '❓', '❗', '💡', '🔥', '🎉', '🚀', '😀', '😂', '😍', '🤔', '😢', '😡', '👏', '🙌', '💪', '👀', '🎯', '📌', '⚠️', '🏆', '💰', '📅', '🔒', '🧩', '☕', '🍕'];
const PEN_COLORS = ['#1a1a1a', '#e03131', '#f08c00', '#2f9e44', '#1971c2', '#7048e8', '#e64980', '#ffffff'];
const HL_COLORS = ['#f5d128', '#93d275', '#6cd8fa', '#ffcee0', '#ff9d48', '#c9b2e8'];

// Bilder werden Bild-Elemente, Dokumente (PDF, Office, Text) Dateianhänge
const fileInput = h('input', { type: 'file', accept: 'image/*,.pdf,.docx,.xlsx,.pptx,.odt,.ods,.odp,.doc,.xls,.ppt,.txt,.md,.csv,.json', multiple: true, style: { display: 'none' } });
document.body.append(fileInput);
fileInput.addEventListener('change', () => {
  const c = viewCenter();
  [...fileInput.files].forEach((f, i) => {
    if (f.type.startsWith('image/')) insertImageFile(f, { x: c.x + i * 40, y: c.y + i * 40 });
    else app.emit('dropFile', f, { x: c.x + i * 240, y: c.y });
  });
  fileInput.value = '';
});

// Neu aufbauen, wenn sich die Rechte während der Sitzung ändern (Bearbeitungssperre der Moderation)
export function rebuildTools() {
  buildTools();
  syncToolButtons();
  buildCtx();
}

function buildTools() {
  const nav = $('#tools');
  nav.innerHTML = '';
  for (const t of TOOLS) {
    if (t === '|') {
      nav.append(h('div', { class: 'tool-sep' }));
      continue;
    }
    const [id, title] = t;
    if (app.viewOnly && !['select', 'hand', 'laser'].includes(id) && !(id === 'comment' && app.canComment)) continue;
    const b = iconBtn(id === 'template' ? 'template' : id, title, () => {
      if (id === 'image') return fileInput.click();
      if (id === 'template') return openTemplates();
      if (id === 'diagram') return app.emit('openDiagramText');
      if (app.tool === id && hasFlyout(id)) return showFlyout(id, b);
      setTool(id);
    });
    b.dataset.tool = id;
    nav.append(b);
  }
}

function hasFlyout(id) {
  return ['sticky', 'shape', 'connector', 'pen', 'highlighter', 'emoji', 'code'].includes(id);
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
      content = h('div', { class: 'shape-pop' }, SHAPE_GROUPS.flatMap(([group, keys]) => [
        h('div', { class: 'pop-title' }, group),
        h('div', { class: 'shape-grid' }, keys.map((k) => h('button', {
          class: 'shape-btn' + (o.shape === k ? ' active' : ''), title: SHAPES.find((x) => x[0] === k)[1],
          html: shapePreview(k),
          onclick: () => { o.shape = k; done(); },
        }))),
      ]));
      break;
    case 'code':
      content = h('div', {}, h('div', { class: 'pop-title' }, 'Sprache für neue Code-Blöcke'), h('div', { class: 'lang-list' }, LANGUAGES.map(([k, l]) =>
        h('button', { class: 'btn small' + ((o.codeLang || 'js') === k ? ' primary' : ''), onclick: () => { o.codeLang = k; done(); } }, l))));
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

// Farbauswahl als Popover an einem beliebigen Anker (z. B. aus einem Menü heraus)
function colorBtnMenu(anchor, color, title, onPick) {
  const custom = h('input', { type: 'color', value: /^#[0-9a-f]{6}$/i.test(color) ? color : '#000000', oninput: (e) => onPick(e.target.value) });
  setTimeout(() => popover(anchor, h('div', {}, h('div', { class: 'pop-title' }, title), swatchGrid(PALETTE, color, (c) => { onPick(c); closePop(); }),
    h('label', { class: 'custom-color' }, 'Eigene Farbe ', custom)), { placement: 'top' }), 0);
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
  const locked = sel.every((e) => isLocked(e));
  const items = [];
  const f = sel[0];

  if (!locked) {
    if (only === 'sticky') {
      items.push(colorBtn(f.fill, 'Farbe', STICKY_COLORS, (c) => applySel({ fill: c })));
      items.push(selectBtn(f.fontSize ?? 'auto', [['auto', 'Auto'], ...FONT_SIZES], 'Schriftgröße', (v) => applySel({ fontSize: v })));
      items.push(...textStyleBtns(f));
      items.push(alignBtn(f.align || 'center'));
      items.push(valignBtn(f.valign || 'middle'));
    } else if (only === 'shape') {
      items.push(selectBtn(f.shape, SHAPES, 'Form', (v) => applySel({ shape: v }), 110));
      items.push(colorBtn(f.fill, 'Füllfarbe', PALETTE, (c) => applySel({ fill: c })));
      items.push(colorBtn(f.stroke === 'none' ? 'transparent' : f.stroke, 'Rahmenfarbe', PALETTE, (c) => applySel({ stroke: c === 'transparent' ? 'none' : c, strokeWidth: c === 'transparent' ? 0 : f.strokeWidth || 2 }), { ring: true }));
      items.push(selectBtn(f.strokeWidth ?? 2, STROKE_W, 'Rahmenstärke', (v) => applySel({ strokeWidth: v, stroke: v && f.stroke === 'none' ? '#1a1a1a' : f.stroke }), 60));
      items.push(selectBtn(f.dash || false, [[false, '──── Durchgezogen'], [true, '- - - Gestrichelt'], ['dotted', '····· Gepunktet']], 'Linienstil', (v) => applySel({ dash: v }), 46));
      items.push(sep());
      items.push(colorBtn(f.textColor || '#1a1a1a', 'Textfarbe', PALETTE.slice(1), (c) => applySel({ textColor: c }), { ring: false }));
      items.push(selectBtn(f.fontSize ?? 18, [['auto', 'Auto'], ...FONT_SIZES], 'Schriftgröße', (v) => applySel({ fontSize: v })));
      items.push(...textStyleBtns(f));
      items.push(alignBtn(f.align || 'center'));
      items.push(valignBtn(f.valign || 'middle'));
    } else if (only === 'text') {
      items.push(selectBtn(f.fontSize ?? 24, FONT_SIZES, 'Schriftgröße', (v) => applySel({ fontSize: v })));
      items.push(colorBtn(f.color || '#1a1a1a', 'Textfarbe', PALETTE.slice(1), (c) => applySel({ color: c })));
      items.push(...textStyleBtns(f));
      items.push(alignBtn(f.align || 'left'));
      items.push(colorBtn(f.fill || 'transparent', 'Hintergrund', PALETTE, (c) => applySel({ fill: c })));
    } else if (only === 'connector') {
      items.push(colorBtn(f.stroke, 'Linienfarbe', PALETTE.slice(1), (c) => applySel({ stroke: c })));
      items.push(selectBtn(f.strokeWidth || 2, STROKE_W.slice(1), 'Linienstärke', (v) => applySel({ strokeWidth: v }), 60));
      items.push(selectBtn(f.dash || false, [[false, '──── Durchgezogen'], [true, '- - - Gestrichelt'], ['dotted', '····· Gepunktet']], 'Linienstil', (v) => applySel({ dash: v }), 46));
      items.push(selectBtn(f.routing || 'curve', [['curve', '⤴ Kurve'], ['elbow', '⌐ Gewinkelt'], ['straight', '／ Gerade']], 'Linienführung', (v) => applySel({ routing: v }), 100));
      items.push(selectBtn(headType(f.arrowStart, 'none'), ARROW_HEADS, 'Linienende am Anfang', (v) => applySel({ arrowStart: v }), 70));
      items.push(selectBtn(headType(f.arrowEnd, 'arrow'), ARROW_HEADS, 'Linienende am Ende', (v) => applySel({ arrowEnd: v }), 70));
      if (one) items.push(actBtn('text', 'Beschriftung (Doppelklick auf die Linie)', () => startEdit(one.id)));
      if (one) {
        const routeBtn = actBtn('more', 'Verlauf & Andocken', () => menu(routeBtn, [
          { header: 'Verlauf' },
          { label: 'Knickpunkte entfernen (Pfad zurücksetzen)', icon: 'undo', disabled: !waypointsOf(one).length, onClick: () => applySel({ waypoints: [] }) },
          { label: 'Beschriftung in die Mitte', icon: 'text', disabled: one.labelPos == null || one.labelPos === 0.5, onClick: () => applySel({ labelPos: 0.5 }) },
          { label: 'Richtung umkehren', icon: 'arrowEnd', onClick: () => applySel((c) => ({ from: c.to, to: c.from, arrowStart: headType(c.arrowEnd, 'arrow'), arrowEnd: headType(c.arrowStart, 'none'), waypoints: waypointsOf(c).reverse(), labelPos: c.labelPos == null ? undefined : 1 - Number(c.labelPos) })) },
          '-',
          { header: 'Andocken' },
          { label: 'Beide Enden automatisch andocken', icon: 'fit', disabled: !(one.from.id || one.to.id), onClick: () => applySel((c) => ({ from: c.from.id ? { id: c.from.id } : c.from, to: c.to.id ? { id: c.to.id } : c.to })) },
        ], { placement: 'top' }));
        items.push(routeBtn);
      }
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
      items.push(selectBtn(f.priority || '', [['', 'Ohne Priorität'], ...Object.entries(PRIORITIES).map(([k, p]) => [k, `${p.icon} ${p.label}`])], 'Priorität', (v) => applySel({ priority: v || undefined }), 90));
      if (one) items.push(actBtn('edit', 'Karte bearbeiten', () => app.emit('editCard', one.id)));
      if (one) items.push(actBtn('poker', 'Schätzrunde starten', () => app.emit('startEstimation', one.id)));
    } else if (only === 'code') {
      items.push(selectBtn(f.lang || 'plain', LANGUAGES, 'Sprache', (v) => applySel({ lang: v }), 120));
      items.push(toggleBtn('moon', f.theme !== 'light', 'Dunkles Farbschema', () => applySel({ theme: f.theme === 'light' ? 'dark' : 'light' })));
      items.push(selectBtn(f.fontSize || 14, FONT_SIZES.slice(1, 8), 'Schriftgröße', (v) => applySel({ fontSize: v })));
      items.push(toggleBtn('<b style="font-size:11px">1 2</b>', f.lineNumbers !== false, 'Zeilennummern', () => applySel({ lineNumbers: f.lineNumbers === false })));
      if (one) items.push(actBtn('edit', 'Code bearbeiten (Enter)', () => startEdit(one.id, { selectAll: false })));
      if (one) items.push(actBtn('copy', 'Code kopieren', () => navigator.clipboard.writeText(one.text || '').then(() => toast('Code kopiert'), () => toast('Kopieren nicht möglich'))));
    } else if (only === 'table' && one) {
      // Formatierung gilt für die ausgewählten Zellen – ohne Zellauswahl für die ganze Tabelle
      const rg = tableRange();
      const st = cellStyle(one, rg.r0, rg.c0);
      const colName = (c) => { let n = ''; c += 1; while (c > 0) { const m = (c - 1) % 26; n = String.fromCharCode(65 + m) + n; c = Math.floor((c - 1) / 26); } return n; };
      const where = rg.whole ? 'Ganze Tabelle' : rg.r0 === rg.r1 && rg.c0 === rg.c1 ? `Zelle ${colName(rg.c0)}${rg.r0 + 1}` : `${colName(rg.c0)}${rg.r0 + 1}:${colName(rg.c1)}${rg.r1 + 1}`;
      items.push(h('span', { class: 'ctx-label', title: 'Klick in die ausgewählte Tabelle wählt eine Zelle, Umschalt-Klick oder Umschalt+Pfeil einen Bereich' }, where));
      items.push(toggleBtn('bold', st.bold, 'Fett', () => formatCells({ b: !st.bold })));
      items.push(toggleBtn('italic', st.italic, 'Kursiv', () => formatCells({ i: !st.italic })));
      items.push(toggleBtn('underline', st.underline, 'Unterstrichen', () => formatCells({ u: !st.underline })));
      items.push(toggleBtn('strike', st.strike, 'Durchgestrichen', () => formatCells({ s: !st.strike })));
      items.push(selectBtn(st.align, [['left', '⯇ Links'], ['center', '≡ Mitte'], ['right', '⯈ Rechts']], 'Ausrichtung waagerecht', (v) => formatCells({ al: v }), 74));
      items.push(selectBtn(st.valign, [['top', '⯅ Oben'], ['middle', '≡ Mitte'], ['bottom', '⯆ Unten']], 'Ausrichtung senkrecht', (v) => formatCells({ va: v }), 74));
      items.push(selectBtn(st.size, FONT_SIZES.slice(0, 10), 'Schriftgröße', (v) => formatCells({ fs: v })));
      items.push(colorBtn(st.color, 'Textfarbe', PALETTE.slice(1), (c) => formatCells({ c })));
      items.push(colorBtn(st.bg || 'transparent', 'Zellenfarbe', PALETTE, (c) => formatCells({ bg: c === 'transparent' ? undefined : c })));
      const tb = actBtn('table', 'Zeilen & Spalten', () => menu(tb, [
        { header: rg.whole ? 'Am Ende der Tabelle' : 'An der Auswahl' },
        { label: 'Zeile oberhalb einfügen', icon: 'plus', disabled: rg.whole, onClick: () => tableAction('rowAbove') },
        { label: rg.whole ? 'Zeile anhängen' : 'Zeile unterhalb einfügen', icon: 'plus', onClick: () => tableAction('rowBelow') },
        { label: 'Spalte links einfügen', icon: 'plus', disabled: rg.whole, onClick: () => tableAction('colLeft') },
        { label: rg.whole ? 'Spalte anhängen' : 'Spalte rechts einfügen', icon: 'plus', onClick: () => tableAction('colRight') },
        '-',
        { label: rg.r0 === rg.r1 ? 'Zeile löschen' : `${rg.r1 - rg.r0 + 1} Zeilen löschen`, icon: 'trash', danger: true, disabled: rg.whole, onClick: () => tableAction('deleteRows') },
        { label: rg.c0 === rg.c1 ? 'Spalte löschen' : `${rg.c1 - rg.c0 + 1} Spalten löschen`, icon: 'trash', danger: true, disabled: rg.whole, onClick: () => tableAction('deleteCols') },
        { label: 'Inhalt leeren', icon: 'close', onClick: () => tableAction('clear') },
        { label: 'Formatierung entfernen', icon: 'undo', onClick: () => tableAction('clearFormat') },
        '-',
        { label: 'Spaltenbreiten angleichen', icon: 'distH', onClick: () => tableAction('equalCols') },
        { label: 'Zeilenhöhen angleichen', icon: 'distV', onClick: () => tableAction('equalRows') },
        { label: one.header !== false ? 'Kopfzeile ausschalten' : 'Kopfzeile einschalten', icon: 'table', onClick: () => applySel({ header: one.header === false }) },
        { label: 'Farbe der Kopfzeile …', icon: 'table', onClick: () => colorBtnMenu(tb, one.headerFill || '#eef1ff', 'Kopfzeile', (c) => applySel({ headerFill: c === 'transparent' ? '#ffffff' : c })) },
        { label: 'Farbe der Linien …', icon: 'table', onClick: () => colorBtnMenu(tb, one.stroke || '#b9b9b9', 'Linien', (c) => applySel({ stroke: c === 'transparent' ? '#ffffff' : c })) },
      ], { placement: 'top' }));
      items.push(tb);
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
        { label: 'Horizontal verteilen (gleiche Abstände)', icon: 'distH', onClick: () => distributeSel('h') },
        { label: 'Vertikal verteilen (gleiche Abstände)', icon: 'distV', onClick: () => distributeSel('v') },
        { label: 'Lückenlos nebeneinander', icon: 'distH', onClick: () => packSel('h', 0) },
        { label: 'Lückenlos untereinander', icon: 'distV', onClick: () => packSel('v', 0) },
        { label: 'Mit festem Abstand anordnen …', icon: 'distH', onClick: () => packWithGap() },
        { label: 'Als Raster anordnen', icon: 'grid', onClick: () => arrangeGrid() },
        '-',
        { header: 'Größe angleichen (an das zuerst ausgewählte Element)' },
        { label: 'Gleiche Breite', icon: 'alignCenterH', onClick: () => matchSize('w') },
        { label: 'Gleiche Höhe', icon: 'alignMiddle', onClick: () => matchSize('h') },
        { label: 'Gleiche Größe', icon: 'fit', onClick: () => matchSize('both') },
        { label: `Position & Größe am Raster (${gridSize()} px) ausrichten`, icon: 'grid', onClick: () => snapSelToGrid() },
      ], { placement: 'top' }));
      items.push(ab);
    }
    if (items.length) items.push(sep());
  }
  if (one && !locked && ['sticky', 'shape', 'text', 'card', 'image', 'emoji', 'frame', 'code'].includes(one.type)) {
    items.push(toggleBtn('link', !!one.link, one.link ? 'Link: ' + one.link : 'Link hinzufügen', async () => {
      const v = await promptDialog('Link', 'Adresse (leer lassen zum Entfernen)', one.link || 'https://');
      if (v === null) return;
      const href = safeLink(v);
      if (v.trim() && v.trim() !== 'https://' && !href) return toast('Bitte eine gültige http(s)-Adresse angeben');
      applySel({ link: href || undefined });
    }));
  }
  if (!locked && sel.some((e) => e.type !== 'connector' && e.type !== 'comment')) {
    const gb = actBtn('<b style="font-size:11px">B×H</b>', 'Position & Größe (exakte Werte)', () => openGeometry(gb));
    items.push(gb);
  }
  const grouped = sel.some((e) => e.groupId);
  if (sel.length > 1 && !locked) items.push(actBtn('group', grouped ? 'Gruppierung aufheben (Strg+Umschalt+G)' : 'Gruppieren (Strg+G)', grouped ? ungroupSel : groupSel));
  const modLocked = sel.every((e) => e.modLock);
  if (!(modLocked && !app.isFacilitator)) {
    const own = sel.every((e) => e.locked);
    items.push(toggleBtn(own ? 'lock' : 'unlock', own, own ? 'Entsperren (Strg+L)' : 'Sperren (Strg+L)', toggleLock));
  }
  if (app.isFacilitator && sel.some((e) => e.type !== 'comment')) {
    items.push(toggleBtn('shield', modLocked, modLocked ? 'Für Teilnehmende freigeben' : 'Für Teilnehmende sperren (nur Moderierende können ändern)', toggleModLock));
  }
  // Erweiterungen anderer Module (Retro, Dateien, Schlagwörter, verborgene Bereiche)
  app.emit('ctxItems', items, sel, { locked, one, only, actBtn, toggleBtn, sep });
  if (!locked) {
    items.push(actBtn('comment', 'Kommentieren', () => {
      const b = selectionBounds();
      newComment({ x: b.x + b.w, y: b.y });
    }));
    const more = actBtn('more', 'Mehr', () => menu(more, [
      { label: 'Duplizieren', icon: 'copy', hint: 'Strg+D', onClick: () => duplicateEls(collectForCopy([...app.sel])) },
      { label: 'In den Vordergrund', icon: 'front', hint: 'Strg+]', onClick: bringToFront },
      { label: 'In den Hintergrund', icon: 'back', hint: 'Strg+[', onClick: sendToBack },
      { label: 'Auswahl einpassen', icon: 'fit', hint: 'Umschalt+2', onClick: () => fitTo(selectionBounds(), { maxZ: 2 }) },
      { label: 'Größe kopieren', icon: 'copy', onClick: copySize },
      { label: 'Größe übernehmen', icon: 'fit', disabled: !hasCopiedSize(), onClick: () => pasteSize('both') },
      { label: 'Nur Breite übernehmen', icon: 'alignCenterH', disabled: !hasCopiedSize(), onClick: () => pasteSize('w') },
      { label: 'Nur Höhe übernehmen', icon: 'alignMiddle', disabled: !hasCopiedSize(), onClick: () => pasteSize('h') },
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

// Exakte Position und Größe eingeben (bei Mehrfachauswahl: X/Y der Auswahl, B/H für jedes Element)
function openGeometry(anchor) {
  const sel = selectedEls().filter((e) => e.type !== 'connector' && e.type !== 'comment');
  const b = selectionBounds();
  const multi = sel.length > 1;
  const sameW = sel.every((e) => Math.round(e.w) === Math.round(sel[0].w)), sameH = sel.every((e) => Math.round(e.h) === Math.round(sel[0].h));
  // Nur Felder, die tatsächlich geändert wurden, werden übernommen
  const num = (v, ph) => {
    const inp = h('input', { type: 'number', step: 'any', value: v === '' ? '' : Math.round(v * 100) / 100, placeholder: ph, class: 'geo-input' });
    inp.addEventListener('input', () => (inp.dataset.dirty = '1'));
    return inp;
  };
  const ix = num(b.x), iy = num(b.y);
  const iw = num(multi ? (sameW ? sel[0].w : '') : sel[0].w, multi ? 'gemischt' : '');
  const ih = num(multi ? (sameH ? sel[0].h : '') : sel[0].h, multi ? 'gemischt' : '');
  const ratio = h('input', { type: 'checkbox' });
  const MAX = 1e6;
  const apply = () => {
    const val = (inp) => (inp.dataset.dirty && inp.value !== '' ? Number(inp.value) : NaN);
    const vals = { x: val(ix), y: val(iy), w: val(iw), h: val(ih) };
    for (const [k, v] of Object.entries(vals)) {
      if (Number.isNaN(v)) continue;
      if (!Number.isFinite(v) || Math.abs(v) > MAX) return toast('Bitte Werte bis ' + MAX.toLocaleString('de-DE') + ' eingeben'), false;
      if ((k === 'w' || k === 'h') && v < 1) return toast('Breite und Höhe müssen mindestens 1 sein'), false;
    }
    setGeometry({ ...vals, keepRatio: ratio.checked });
    buildCtx();
    return true;
  };
  const form = h('form', { class: 'geo-form', onsubmit: (e) => { e.preventDefault(); if (apply()) closePop(); } },
    h('div', { class: 'pop-title' }, multi ? `Position & Größe (${sel.length} Elemente)` : 'Position & Größe'),
    h('div', { class: 'geo-grid' }, h('label', {}, 'X', ix), h('label', {}, 'Y', iy), h('label', {}, 'Breite', iw), h('label', {}, 'Höhe', ih)),
    h('label', { class: 'check' }, ratio, 'Seitenverhältnis beibehalten'),
    multi ? h('p', { class: 'muted small' }, 'X/Y verschieben die ganze Auswahl; Breite/Höhe gelten für jedes Element.') : null,
    h('div', { class: 'row' }, h('button', { type: 'submit', class: 'btn primary small' }, 'Übernehmen')));
  form.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Escape') closePop();
  });
  popover(anchor, form, { placement: 'top' });
  setTimeout(() => iw.focus(), 0);
}

async function packWithGap() {
  const v = await promptDialog('Mit festem Abstand anordnen', 'Abstand in Pixeln (Richtung wird aus der Anordnung erkannt)', '20');
  if (v === null) return;
  const gap = Number(String(v).replace(',', '.')) || 0; // negativ = überlappend
  const b = selectionBounds();
  packSel(b.w >= b.h ? 'h' : 'v', gap);
}

function textStyleBtns(f) {
  return [
    toggleBtn('bold', f.bold, 'Fett', () => applySel({ bold: !f.bold })),
    toggleBtn('italic', f.italic, 'Kursiv', () => applySel({ italic: !f.italic })),
    toggleBtn('underline', f.underline, 'Unterstrichen', () => applySel({ underline: !f.underline })),
    toggleBtn('strike', f.strike, 'Durchgestrichen', () => applySel({ strike: !f.strike })),
  ];
}

function valignBtn(cur) {
  return selectBtn(cur, [['top', '⯅ Oben'], ['middle', '≡ Mitte'], ['bottom', '⯆ Unten']], 'Ausrichtung senkrecht', (v) => applySel({ valign: v }), 70);
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
  // nicht über die Werkzeugleiste links legen (auf schmalen Bildschirmen liegt sie unten)
  x = Math.max(innerWidth > 760 ? 72 : 8, Math.min(innerWidth - cw - 8, x));
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
  // Beim Bearbeiten einer Tabellenzelle bleibt die Leiste sichtbar (Formatierung der Zelle)
  ctxHidden = on && !(app.editing && app.editing.cell);
  if (on && app.editing && app.editing.cell) buildCtx();
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
  if (!el || el.hidden) return;
  let color = el.color || '#4262ff';
  const title = h('input', { type: 'text', value: el.title || '' });
  const desc = h('textarea', { rows: 4 }, el.description || '');
  const assignee = h('input', { type: 'text', value: el.assignee || '', placeholder: 'Name', list: 'assignee-list' });
  // Zuständige Person aus dem Board wählen (eindeutig per ID – Namen können doppelt vorkommen)
  let assigneeId = el.assigneeId || '';
  const who = h('select', { 'aria-label': 'Person auswählen' }, h('option', { value: '' }, '– Person wählen –'));
  boardPeople().then((people) => {
    for (const p of people.filter((x) => !x.guest)) who.append(h('option', { value: p.id, selected: p.id === assigneeId }, p.displayName + (p.id === myId() ? ' (du)' : '')));
  });
  who.addEventListener('change', () => {
    assigneeId = who.value;
    if (who.value) assignee.value = who.selectedOptions[0].textContent.replace(/ \(du\)$/, '');
  });
  assignee.addEventListener('input', () => {
    assigneeId = '';
    who.value = '';
  });
  const due = h('input', { type: 'date', value: el.due || '' });
  const status = h('input', { type: 'text', value: el.status || '', placeholder: 'z. B. In Arbeit', list: 'status-list' });
  const key = h('input', { type: 'text', value: el.key || '', placeholder: 'z. B. VB-42', maxlength: 40 });
  const prio = h('select', {}, h('option', { value: '' }, 'Ohne'), Object.entries(PRIORITIES).map(([k, p]) => h('option', { value: k, selected: el.priority === k }, `${p.icon} ${p.label}`)));
  const points = h('input', { type: 'text', value: el.points ?? '', placeholder: 'z. B. 5', maxlength: 5 });
  const tags = h('input', { type: 'text', value: cardTags(el).join(', '), placeholder: 'z. B. Backend, Bug' });
  const names = [...new Set([app.user.name, ...[...app.peers.values()].map((p) => p.name), ...[...app.els.values()].filter((e) => e.assignee).map((e) => e.assignee)].filter(Boolean))];
  const sw = swatchGrid(PALETTE.slice(6), color, (c) => {
    color = c;
    sw.querySelectorAll('.swatch').forEach((s) => s.classList.toggle('active', s.title === c));
  });
  const form = h('form', { class: 'form', onsubmit: (e) => {
    e.preventDefault();
    act(() => updateEl(id, {
      title: title.value, description: desc.value, assignee: assignee.value.trim(), assigneeId: assigneeId || undefined, due: due.value, status: status.value.trim(), color,
      key: key.value.trim() || undefined, priority: prio.value || undefined, points: points.value.trim() || undefined,
      tags: tags.value.split(',').map((t) => t.trim()).filter(Boolean).slice(0, 8),
    }));
    m.close();
    buildCtx();
  } },
  h('label', {}, 'Titel', title),
  h('label', {}, 'Beschreibung', desc),
  h('div', { class: 'form-row' }, h('label', {}, 'Zuständig', who, assignee), h('label', {}, 'Fällig am', due)),
  h('div', { class: 'form-row' }, h('label', {}, 'Status', status), h('label', {}, 'Priorität', prio)),
  h('div', { class: 'form-row' }, h('label', {}, 'Schlüssel / Ticket', key), h('label', {}, 'Story Points', points)),
  h('label', {}, 'Labels (durch Komma getrennt)', tags),
  h('datalist', { id: 'assignee-list' }, names.map((n) => h('option', { value: n }))),
  h('datalist', { id: 'status-list' }, ['Offen', 'In Arbeit', 'Review', 'Test', 'Blockiert', 'Fertig'].map((n) => h('option', { value: n }))),
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

// Personen mit Bezug zum Board (für @Erwähnungen und Zuweisungen); kurz zwischengespeichert
let peopleCache = null;
export async function boardPeople() {
  if (!peopleCache || Date.now() - peopleCache.t > 60000) {
    try {
      peopleCache = { t: Date.now(), list: (await api(`/api/boards/${app.boardId}/people`)).people };
    } catch {
      peopleCache = { t: Date.now(), list: [] };
    }
  }
  return peopleCache.list;
}

const commentOp = (action, id, extra = {}) => app.sync.op({ op: 'comment', action, id, ...extra });
const myId = () => String(app.user.id);
const fmtDate = (d) => (d ? new Date(d + 'T00:00').toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '');

function openComment(id, isNew) {
  closeComment();
  const el = getEl(id);
  if (!el) return;
  const box = h('div', { class: 'comment-pop panel' });
  // Tasten im Kommentarfenster (auch in Auswahllisten und Datumsfeldern) nie als Board-Kürzel auswerten
  box.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Escape') closeComment();
  });
  document.body.append(box);
  commentPop = { id, box, sig: null, taskForm: false };
  renderCommentPop();
  positionComment();
  if (isNew) box.querySelector('textarea')?.focus();
  // Benachrichtigungen zu diesem Kommentar gelten als gelesen
  if (!app.guest && !el.draft) app.emit('readNotifications', { boardId: app.boardId, elementId: id });
}

// @Erwähnung: Vorschläge beim Tippen von „@“; Pfeiltasten wählen, Enter/Tab übernimmt
function mentionInput(input, picked = new Map()) {
  const list = h('div', { class: 'mention-list hidden', role: 'listbox' });
  let items = [], active = 0;
  const query = () => {
    const m = /@([\p{L}\p{N}._-]*)$/u.exec(input.value.slice(0, input.selectionStart));
    return m ? m[1].toLowerCase() : null;
  };
  const close = () => {
    list.classList.add('hidden');
    items = [];
  };
  // Namen sind nicht eindeutig: ausgewählte Personen merken und ihre IDs mitschicken
  const pick = (p) => {
    const pos = input.selectionStart;
    picked.set(p.id, p.displayName);
    const before = input.value.slice(0, pos).replace(/@([\p{L}\p{N}._-]*)$/u, '@' + p.displayName + ' ');
    input.value = before + input.value.slice(pos);
    input.selectionStart = input.selectionEnd = before.length;
    close();
    input.focus();
  };
  const show = async () => {
    const q = query();
    if (q === null) return close();
    const people = await boardPeople();
    items = people.filter((p) => p.displayName.toLowerCase().includes(q)).slice(0, 6);
    if (!items.length) return close();
    active = Math.min(active, items.length - 1);
    list.innerHTML = '';
    items.forEach((p, i) => list.append(h('button', {
      type: 'button', class: 'mention-item' + (i === active ? ' active' : ''), onmousedown: (e) => { e.preventDefault(); pick(p); },
    }, h('span', { class: 'avatar xs', style: { background: p.color } }, initials(p.displayName)), h('span', {}, p.displayName), p.guest ? h('span', { class: 'muted small' }, 'Gast') : null)));
    list.classList.remove('hidden');
  };
  input.addEventListener('input', show);
  input.addEventListener('blur', () => setTimeout(close, 150));
  // true = Taste wurde für die Vorschlagsliste verwendet
  const onKey = (e) => {
    if (!items.length || list.classList.contains('hidden')) return false;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      active = (active + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length;
      show();
      return true;
    }
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      pick(items[active]);
      return true;
    }
    if (e.key === 'Escape') {
      close();
      return true;
    }
    return false;
  };
  // IDs der ausgewählten Personen, deren „@Name“ noch im Text steht
  const mentions = () => [...picked].filter(([, name]) => input.value.toLowerCase().includes('@' + name.toLowerCase())).map(([id]) => id);
  const reset = () => picked.clear();
  return { list, onKey, mentions, reset };
}

// Kommentartext mit hervorgehobenen Erwähnungen (eigene besonders)
function commentHtml(m) {
  const me = myId();
  if (!Array.isArray(m.mentions) || !m.mentions.length) {
    // ältere Kommentare: „@Wort“ hervorheben
    const self = String(app.user.name).replace(/\s+/g, '').toLowerCase();
    return esc(m.text).replace(/@([\p{L}\p{N}._-]+)/gu, (all, n) => `<span class="mention${n.toLowerCase() === self ? ' me' : ''}">@${n}</span>`);
  }
  const names = [...m.mentions].sort((a, b) => b.name.length - a.name.length);
  const re = new RegExp('@(' + names.map((x) => x.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')', 'giu');
  let out = '', last = 0;
  for (const hit of String(m.text).matchAll(re)) {
    const who = names.find((x) => x.name.toLowerCase() === hit[1].toLowerCase());
    out += esc(m.text.slice(last, hit.index)) + `<span class="mention${who && who.id === me ? ' me' : ''}">${esc(hit[0])}</span>`;
    last = hit.index + hit[0].length;
  }
  return out + esc(m.text.slice(last));
}

function renderCommentPop() {
  if (!commentPop) return;
  const el = getEl(commentPop.id);
  if (!el) return closeComment();
  const thread = el.thread || [];
  const sig = JSON.stringify([thread.length, thread.at(-1)?.pending, el.resolved, el.task || null, commentPop.taskForm]);
  if (commentPop.sig === sig) return;
  commentPop.sig = sig;
  const box = commentPop.box;
  // Entwurf, Fokus und Cursorposition über den Neuaufbau retten (z. B. wenn jemand anderes antwortet)
  const old = box.querySelector('textarea');
  const draft = old?.value || '';
  const focused = old && document.activeElement === old ? [old.selectionStart, old.selectionEnd] : null;
  box.innerHTML = '';
  const input = h('textarea', { rows: 2, placeholder: thread.length ? 'Antworten … (@ erwähnt jemanden)' : 'Kommentar schreiben … (@ erwähnt jemanden)' }, draft);
  const mention = mentionInput(input, (commentPop.picked ||= new Map()));
  const send = () => {
    const t = input.value.trim();
    if (!t) return;
    const cur = getEl(commentPop.id);
    // Sofort anzeigen; der Server ergänzt Autor und Zeitpunkt und schickt den gültigen Stand
    applyRemoteOp({ op: 'upsert', el: { ...cur, thread: [...(cur.thread || []), { author: app.user.name, color: app.user.color, text: t, ts: Date.now(), pending: true }] } });
    commentOp('add', cur.id, { x: cur.x, y: cur.y, text: t, mentions: mention.mentions() });
    mention.reset();
    input.value = '';
    renderCommentPop();
  };
  input.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (mention.onKey(e)) return;
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
    if (e.key === 'Escape') closeComment();
  });
  const own = thread.length && thread.every((m) => m.uid === myId());
  const canDelete = !el.draft && (!app.viewOnly || (app.canComment && own));
  const setLocal = (patch) => applyRemoteOp({ op: 'upsert', el: { ...getEl(el.id), ...patch } });
  append(box,
    h('div', { class: 'comment-head' },
      h('strong', {}, el.resolved ? 'Erledigt' : 'Kommentar'),
      h('span', { class: 'spacer' }),
      app.canComment && !el.draft ? iconBtn(el.resolved ? 'undo' : 'check', el.resolved ? 'Wieder öffnen' : 'Als erledigt markieren', () => {
        setLocal({ resolved: !el.resolved });
        commentOp('resolve', el.id, { resolved: !el.resolved });
        renderCommentPop();
      }) : null,
      canDelete ? iconBtn('trash', 'Kommentar löschen', () => {
        commentOp('delete', el.id);
        applyRemoteOp({ op: 'delete', id: el.id });
        closeComment();
      }) : null,
      iconBtn('close', 'Schließen', closeComment)),
    taskRow(el),
    h('div', { class: 'comment-list' }, thread.map((m) => h('div', { class: 'comment-msg' + (m.pending ? ' pending' : '') },
      h('div', { class: 'comment-meta' }, h('span', { class: 'avatar xs', style: { background: m.color || '#888' } }, initials(m.author)), h('b', {}, m.author), h('span', { class: 'muted' }, m.pending ? 'wird gesendet …' : relTime(m.ts))),
      h('div', { class: 'comment-text', html: commentHtml(m) })))),
    app.canComment ? h('div', { class: 'comment-input' }, h('div', { class: 'mention-wrap' }, input, mention.list), h('button', { class: 'btn primary small', onclick: send }, 'Senden')) : null,
  );
  const list = box.querySelector('.comment-list');
  list.scrollTop = list.scrollHeight;
  if (focused) {
    input.focus();
    input.setSelectionRange(focused[0], focused[1]);
  }
}

// Kommentar als Aufgabe: Zuständigkeit und Fälligkeit (erscheint unter „Meine Aufgaben“)
function taskRow(el) {
  if (el.draft) return null;
  const t = el.task;
  if (!commentPop.taskForm) {
    if (!t) return app.canComment && (el.thread || []).length ? h('div', { class: 'comment-task-row' }, h('button', { class: 'btn small', onclick: () => { commentPop.taskForm = true; renderCommentPop(); } }, h('span', { html: ICONS.tasks }), 'Als Aufgabe zuweisen')) : null;
    const overdue = t.due && !el.resolved && t.due < new Date().toISOString().slice(0, 10);
    return h('div', { class: 'comment-task' + (el.resolved ? ' done' : '') },
      h('span', { html: ICONS.tasks }),
      h('span', {}, h('b', {}, t.assignee), t.due ? h('span', { class: overdue ? 'overdue' : 'muted' }, ` · fällig ${fmtDate(t.due)}`) : null, el.resolved ? h('span', { class: 'muted' }, ' · erledigt') : null),
      h('span', { class: 'spacer' }),
      app.canComment ? h('button', { class: 'btn small', onclick: () => { commentPop.taskForm = true; renderCommentPop(); } }, 'Ändern') : null);
  }
  const who = h('select', {}, h('option', { value: '' }, 'Person wählen …'));
  const due = h('input', { type: 'date', value: t?.due || '' });
  boardPeople().then((people) => people.forEach((p) => who.append(h('option', { value: p.id, selected: t && t.assigneeId === p.id }, p.displayName + (p.id === myId() ? ' (du)' : '') + (p.guest ? ' (Gast)' : '')))));
  return h('form', { class: 'comment-task-form', onsubmit: (e) => {
    e.preventDefault();
    if (!who.value) return toast('Bitte eine Person wählen');
    commentOp('task', el.id, { assigneeId: who.value, due: due.value });
    commentPop.taskForm = false;
    renderCommentPop();
  } },
  h('div', { class: 'row' }, who, due),
  h('div', { class: 'row' },
    h('button', { type: 'submit', class: 'btn primary small' }, 'Zuweisen'),
    t ? h('button', { type: 'button', class: 'btn small', onclick: () => { commentOp('task', el.id, { assigneeId: null }); commentPop.taskForm = false; renderCommentPop(); } }, 'Zuweisung entfernen') : null,
    h('button', { type: 'button', class: 'btn small', onclick: () => { commentPop.taskForm = false; renderCommentPop(); } }, 'Abbrechen')));
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
  // Nie abgeschickter Entwurf: lokalen Platzhalter entfernen
  if (el && el.draft && !(el.thread || []).length) applyRemoteOp({ op: 'delete', id });
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
    const mine = all.filter((e) => e.task && e.task.assigneeId === String(app.user.id) && !e.resolved);
    side.append(h('div', { class: 'side-head' }, h('h3', {}, `Kommentare (${open.length} offen)`), h('span', { class: 'spacer' }), close));
    const filters = [['open', 'Offen'], ['mine', `Mir zugewiesen${mine.length ? ` (${mine.length})` : ''}`], ['all', 'Alle']];
    const f = app.settings.commentFilter || (app.settings.hideResolved ? 'open' : 'all');
    side.append(h('div', { class: 'side-actions' }, h('div', { class: 'seg' }, filters.map(([k, l]) => h('button', { class: 'btn small' + (f === k ? ' active' : ''), onclick: () => {
      app.settings.commentFilter = k;
      app.settings.hideResolved = k !== 'all';
      saveSettings();
      renderSidePanel();
    } }, l)))));
    const list = (f === 'mine' ? mine : f === 'open' ? open : all).sort((a, b) => (b.thread.at(-1)?.ts || 0) - (a.thread.at(-1)?.ts || 0));
    if (!list.length) side.append(h('p', { class: 'muted pad' }, f === 'mine' ? 'Dir sind keine offenen Kommentare zugewiesen.' : 'Keine Kommentare. Mit dem Kommentar-Werkzeug (C) kannst du überall auf dem Board Feedback hinterlassen und mit @Name jemanden erwähnen.'));
    for (const c of list) {
      const first = c.thread[0], last = c.thread.at(-1);
      side.append(h('div', { class: 'comment-card' + (c.resolved ? ' resolved' : ''), onclick: () => {
        fitTo({ x: c.x - 200, y: c.y - 200, w: 400, h: 400 }, { maxZ: 1.5 });
        setTimeout(() => openComment(c.id), 320);
      } },
      h('div', { class: 'comment-meta' }, h('span', { class: 'avatar xs', style: { background: first.color || '#888' } }, initials(first.author)), h('b', {}, first.author), h('span', { class: 'muted' }, relTime(last.ts))),
      h('div', { class: 'comment-text' }, first.text),
      c.task ? h('div', { class: 'comment-task small' }, h('span', { html: ICONS.tasks }), h('span', {}, c.task.assignee + (c.task.due ? ` · fällig ${fmtDate(c.task.due)}` : ''))) : null,
      c.thread.length > 1 ? h('div', { class: 'muted small' }, `${c.thread.length - 1} Antwort${c.thread.length > 2 ? 'en' : ''}`) : null));
    }
  } else if (sidePanel === 'votes') {
    app.emit('renderVotesPanel', side, close);
  } else {
    app.emit('renderPanel', sidePanel, side, close);
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
  if (placeElements(t.build())) toast(`Vorlage „${t.name}“ eingefügt`);
}

// Fügt fertige Elemente (Vorlage, Diagramm, Import) in der Ansichtsmitte ein, ohne Bestehendes zu überdecken
export function placeElements(els, { select = false } = {}) {
  if (!els.length) return false;
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
  setSelection(select ? moved.filter((e) => e.type !== 'connector').map((e) => e.id) : []);
  fitTo({ x: b.x + tx, y: b.y + ty, w: b.w, h: b.h }, { maxZ: 1 });
  return true;
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
  const data = { format: 'vibeboard', version: 1, name: app.name, exportedAt: new Date().toISOString(), elements: [...app.els.values()].filter((e) => !e.hidden) };
  download(safeName(app.name) + '.vibeboard.json', new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' }));
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
    // Eine JSON-Datei ohne Board-Elemente ist kein Export, sondern ein Dokument – als Dateianhang ablegen
    if (!list.length || !list.every((e) => e && typeof e === 'object' && typeof e.type === 'string')) return app.emit('dropFile', file, viewCenter());
    const n = list.filter((e) => e && e.type !== 'comment').length;
    if (!n) return toast('Keine Elemente gefunden (Kommentare werden nicht importiert)');
    pasteElements(list, viewCenter());
    fitTo(selectionBounds(), { maxZ: 1 });
    toast(`${n} Elemente importiert${n < list.length ? ' – Kommentare werden nicht übernommen' : ''}`);
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
    { label: 'Karten aus CSV / Jira-Export …', icon: 'card', disabled: app.viewOnly, onClick: () => app.emit('openCsvImport') },
    { label: 'Diagramm aus Text (Mermaid) …', icon: 'diagram', disabled: app.viewOnly, onClick: () => app.emit('openDiagramText') },
    { label: 'Bild hochladen', icon: 'image', disabled: app.viewOnly, onClick: () => fileInput.click() },
    { label: 'Datei anhängen (PDF, Office, Text)', icon: 'file', disabled: app.viewOnly, onClick: () => app.emit('pickFile') },
    '-',
    { header: 'Vorlagen' },
    { label: 'Board als Vorlage speichern …', icon: 'template', disabled: app.guest, onClick: () => app.emit('saveTemplate', false) },
    { label: 'Auswahl als Vorlage speichern …', icon: 'template', disabled: app.guest || !app.sel.size, onClick: () => app.emit('saveTemplate', true) },
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

let legal = {};
legalLinks().then((l) => (legal = l));

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
    t('hideCursors', 'Mauszeiger anderer ausblenden'),
    { label: 'Filter …', icon: 'filter', onClick: () => showSidePanel('filter') },
    { label: 'Retro & Umfragen …', icon: 'vote', onClick: () => app.emit('retroMenu', anchor) },
    { header: 'Bearbeitung' },
    t('snap', 'Am Raster einrasten'),
    { label: `Rastergröße: ${gridSize()} px`, icon: 'grid', keep: true, onClick: () => {
      const sizes = [10, 20, 40, 50];
      s.gridSize = sizes[(sizes.indexOf(gridSize()) + 1) % sizes.length];
      saveSettings();
      applyView(true);
      openSettings(anchor);
    } },
    t('smartGuides', 'Intelligente Hilfslinien'),
    t('wheelZoom', 'Mausrad zoomt (statt verschieben)'),
    { label: 'Tastenkürzel', icon: 'keyboard', onClick: openShortcuts },
    '-',
    ...accountMenuItems(app.me, profileSaved),
    ...(legal.imprint || legal.privacy ? ['-'] : []),
    legal.imprint ? { label: 'Impressum', icon: 'link', onClick: () => window.open('/impressum', '_blank', 'noopener') } : null,
    legal.privacy ? { label: 'Datenschutz', icon: 'link', onClick: () => window.open('/datenschutz', '_blank', 'noopener') } : null,
  ], { placement: 'bottom' });
}

export function openShortcuts() {
  const groups = [
    ['Werkzeuge', [['V', 'Auswählen'], ['H / Leertaste', 'Verschieben'], ['N', 'Sticky Note'], ['T', 'Text'], ['S', 'Form'], ['R / O', 'Rechteck / Ellipse'], ['L', 'Verbindungslinie'], ['P', 'Stift'], ['E', 'Radierer'], ['F', 'Frame'], ['K', 'Karte'], ['M', 'Mindmap'], ['C', 'Kommentar'], ['X', 'Laserpointer']]],
    ['Bearbeiten', [['Strg+Z / Strg+Y', 'Rückgängig / Wiederholen'], ['Strg+C / X / V', 'Kopieren / Ausschneiden / Einfügen'], ['Strg+D', 'Duplizieren'], ['Alt + Ziehen', 'Kopie ziehen'], ['Entf', 'Löschen'], ['Strg+A', 'Alles auswählen'], ['Strg+G', 'Gruppieren'], ['Strg+Umschalt+G', 'Gruppe auflösen'], ['Strg+L', 'Sperren'], ['Strg+] / [', 'Vorder-/Hintergrund'], ['Pfeiltasten', 'Verschieben (Umschalt: 10 px)'], ['Enter / Doppelklick', 'Text bearbeiten'], ['Esc / Strg+Enter', 'Bearbeitung beenden']]],
    ['Tabellen', [['Klick in ausgewählte Tabelle', 'Zelle wählen'], ['Umschalt + Klick / Pfeil', 'Bereich wählen'], ['Pfeiltasten', 'Zellauswahl bewegen'], ['Enter / F2', 'Zelle bearbeiten'], ['Tippen', 'Zelle überschreiben'], ['Entf', 'Inhalt leeren'], ['Tab', 'Nächste Zelle (beim Bearbeiten)'], ['Linie ziehen', 'Spaltenbreite / Zeilenhöhe']]],
    ['Verbinder', [['Linie ziehen', 'Biegen (Knickpunkt)'], ['◦ auf der Linie ziehen', 'Knickpunkt einfügen'], ['Doppelklick auf ▪', 'Knickpunkt entfernen'], ['Beschriftung ziehen', 'Entlang der Linie verschieben'], ['Ende an Rand ziehen', 'Fester Andockpunkt'], ['Ende in Formmitte', 'Automatisch andocken']]],
    ['Mindmap', [['Tab', 'Unterknoten hinzufügen'], ['Enter (beim Tippen)', 'Geschwisterknoten'], ['Umschalt+Enter', 'Geschwisterknoten']]],
    ['Zusammenarbeit', [['/', 'Cursor-Chat: Nachricht am Mauszeiger'], ['Esc', 'Cursor-Chat schließen']]],
    ['Verschieben & Größe', [['Umschalt + Ziehen', 'Nur waagerecht/senkrecht verschieben'], ['Strg + Ziehen', 'Ohne Einrasten'], ['Seitengriff', 'Nur Breite bzw. Höhe ändern'], ['Umschalt + Griff', 'Seitenverhältnis beibehalten'], ['Alt + Griff', 'Größe von der Mitte aus'], ['Strg+D (wiederholt)', 'Kopie mit zuletzt verwendetem Versatz'], ['Klick in ausgewählte Gruppe', 'Einzelnes Element der Gruppe wählen'], ['Pfeiltasten', 'Um 1 px (Umschalt: 10 px, mit Raster: eine Rasterweite) verschieben'], ['Umschalt-/Strg-Klick', 'Zur Auswahl hinzufügen bzw. entfernen (Ziehen verschiebt)']]],
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
  const g = e.target.closest && e.target.closest('g[data-id]');
  const el = g && getEl(g.dataset.id);
  // Betrachter: nur Reaktionen auf Elemente
  if (app.viewOnly) {
    if (el && !el.hidden) app.emit('reactMenu', el, e);
    return;
  }
  closeContextMenu();
  const w = toWorld(e.clientX, e.clientY);
  if (el && !app.sel.has(el.id)) setSelection([el.id]);
  const has = app.sel.size > 0;
  const items = has ? [
    { label: 'Kopieren', hint: 'Strg+C', onClick: () => document.execCommand('copy') },
    { label: 'Duplizieren', hint: 'Strg+D', onClick: () => duplicateEls(collectForCopy([...app.sel])) },
    { label: 'In den Vordergrund', hint: 'Strg+]', onClick: bringToFront },
    { label: 'In den Hintergrund', hint: 'Strg+[', onClick: sendToBack },
    { label: selectedEls().every((x) => x.locked) ? 'Entsperren' : 'Sperren', hint: 'Strg+L', onClick: toggleLock },
    app.isFacilitator ? { label: selectedEls().every((x) => x.modLock) ? 'Für Teilnehmende freigeben' : 'Für Teilnehmende sperren', onClick: toggleModLock } : null,
    app.sel.size > 1 ? { label: 'Gruppieren', hint: 'Strg+G', onClick: groupSel } : null,
    selectedEls().some((x) => x.groupId) ? { label: 'Gruppierung aufheben', onClick: ungroupSel } : null,
    { label: 'Kommentar hinzufügen', onClick: () => newComment(w) },
    el && app.sel.size === 1 ? { label: 'Reagieren …', onClick: () => app.emit('reactMenu', el, e) } : null,
    '-',
    { label: 'Löschen', hint: 'Entf', danger: true, onClick: () => deleteEls([...app.sel]) },
  ] : [
    { label: 'Sticky Note hier', onClick: () => { const s = makeElement('sticky', w.x, w.y); addElements([s]); startEdit(s.id, { isNew: true }); } },
    { label: 'Text hier', onClick: () => { const s = makeElement('text', w.x, w.y); act(() => setEl(s)); startEdit(s.id, { isNew: true }); } },
    { label: 'Kommentar hier', onClick: () => newComment(w) },
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
  // Ansichten der anderen Teilnehmenden
  mctx.lineWidth = 1.5 * devicePixelRatio;
  for (const p of app.peers.values()) {
    if (!p.view || p.away) continue;
    mctx.strokeStyle = p.color;
    mctx.strokeRect(p.view.x * s + ox, p.view.y * s + oy, p.view.w * s, p.view.h * s);
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
app.on('peers', drawMinimap);

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
    document.title = n + ' – vibeboard';
    app.sync.op({ op: 'rename', name: n });
  });
  nameInput.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') nameInput.blur();
  });
  app.on('name', () => {
    nameInput.value = app.name;
    document.title = app.name + ' – vibeboard';
  });
  const status = saveIndicator();
  append(top,
    h('a', { href: '/', class: 'icon-btn brand', title: 'Alle Boards', html: '<svg viewBox="0 0 32 32" width="26" height="26"><rect x="2" y="2" width="28" height="28" rx="7" fill="#4262ff"/><rect x="8" y="8" width="9" height="9" rx="1.5" fill="#fff9b1"/><rect x="15" y="15" width="9" height="9" rx="1.5" fill="#ffcee0"/></svg>' }),
    nameInput, status,
    app.guest ? h('span', { class: 'badge guest', title: 'Du bist als Gast auf diesem Board' }, 'Gast') : null,
    app.role === 'viewer' ? h('span', { class: 'badge' }, 'Nur ansehen') : app.role === 'commenter' ? h('span', { class: 'badge', title: 'Du kannst ansehen und kommentieren' }, 'Kommentieren') : null,
    h('span', { class: 'top-sep' }),
    app.viewOnly ? null : iconBtn('template', 'Vorlagen', openTemplates),
    iconBtn('frame', 'Frames & Präsentation', () => toggleSidePanel('frames'), { 'data-panel': 'frames' }),
    iconBtn('comment', 'Kommentare', () => toggleSidePanel('comments'), { 'data-panel': 'comments' }),
    iconBtn('tasks', 'Aufgaben auf diesem Board', () => toggleSidePanel('tasks'), { 'data-panel': 'tasks' }),
    iconBtn('activity', 'Aktivität – wer hat was geändert?', () => toggleSidePanel('activity'), { 'data-panel': 'activity' }),
    app.viewOnly ? null : iconBtn('history', 'Versionsverlauf', () => toggleSidePanel('versions'), { 'data-panel': 'versions' }),
    iconBtn('search', 'Suchen (Strg+F)', openSearch),
    iconBtn('download', 'Exportieren & Importieren', (e) => openExportMenu(e.currentTarget)),
  );
  const right = $('#topright');
  const tools = h('div', { class: 'collab-tools' });
  append(right, tools, h('div', { id: 'avatars' }),
    app.guest ? null : bellButton({ open: (n) => app.emit('openNotification', n) }),
    app.guest ? null : h('button', { class: 'btn primary small share-btn', onclick: openShare }, h('span', { html: ICONS.share }), 'Teilen'),
    iconBtn('settings', 'Einstellungen', (e) => openSettings(e.currentTarget)));
  if (!app.guest) {
    refreshBell();
    setInterval(refreshBell, 60000);
  }
  app.emit('buildCollabTools', tools);
}

// Speicherstatus: zeigt, ob alle eigenen Änderungen auf dem Server gespeichert sind.
// „Wird gespeichert …“ erscheint erst nach kurzer Verzögerung, damit die Anzeige bei schnellen Antworten nicht flackert;
// Bildschirmleser bekommen nur die wichtigen Wechsel (offline, Fehler, wieder gespeichert) angesagt.
function saveIndicator() {
  const dot = h('span', { class: 'save-dot', 'aria-hidden': 'true' });
  const text = h('span', { class: 'save-text' });
  const chip = h('span', { id: 'conn-status', class: 'save-chip connecting', tabindex: '0' }, dot, text);
  const live = h('span', { class: 'sr-only', role: 'status', 'aria-live': 'polite' });
  chip.append(live);
  let shown = null, prev = null, delay = null;
  const clock = (t) => new Date(t).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  const LABEL = {
    connecting: ['Verbinde …', 'Verbindung zum Server wird aufgebaut …'],
    offline: ['Offline', 'Keine Verbindung zum Server – wird automatisch wiederhergestellt. Änderungen werden gesendet, sobald die Verbindung steht.'],
    saving: ['Wird gespeichert …', 'Deine Änderungen werden gerade gespeichert.'],
    error: ['Speichern verzögert', 'Die letzten Änderungen sind noch nicht gespeichert – es wird automatisch erneut versucht. Bitte die Seite noch nicht schließen.'],
    saved: ['Gespeichert', 'Alle Änderungen sind auf dem Server gespeichert.'],
    live: ['Verbunden', 'Verbunden – du siehst Änderungen anderer live.'],
  };
  const paint = (st) => {
    let kind = st.state;
    if (kind === 'saved' && app.viewOnly && !app.canComment) kind = 'live';
    shown = kind;
    chip.className = 'save-chip ' + kind;
    let [label, title] = LABEL[kind];
    if (kind === 'offline' && st.pending) label = `Offline – ${st.pending} ausstehend`;
    if (kind === 'saved' && st.at) title += ` Zuletzt gespeichert um ${clock(st.at)} Uhr.`;
    text.textContent = label;
    chip.title = title;
    chip.setAttribute('aria-label', title);
    // Ansage nur bei wichtigen Wechseln: Verbindung/Speichern gestört und wieder in Ordnung
    const bad = kind === 'offline' || kind === 'error';
    if (kind !== prev && (bad || ((kind === 'saved' || kind === 'live') && (prev === 'offline' || prev === 'error')))) {
      live.textContent = bad ? title : 'Alle Änderungen gespeichert.';
    }
    if (kind !== 'saving') prev = kind;
  };
  app.on('saveState', (st) => {
    clearTimeout(delay);
    if (st.state === 'saving' && shown === 'saved') delay = setTimeout(() => paint(app.sync.saveState()), 400);
    else paint(st);
  });
  paint({ state: 'connecting' });
  return chip;
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

// Vorschau einer Form in der Formenauswahl; Flächen in Hintergrundfarbe, damit sich überlappende Teile verdecken
function shapePreview(k) {
  const tall = ['rack', 'mobile'].includes(k);
  const [x, y, w, h] = tall ? [11, 2, 18, 26] : k === 'forkbar' ? [3, 12, 34, 6] : [3, 3, 34, 24];
  const deco = shapeDecor(k, x, y, w, h, { fill: 'none', stroke: 'currentColor', sw: 1.6, full: true, cls: 'pv-fill' });
  return `<svg viewBox="0 0 40 30" width="40" height="30">${deco.before}${shapeGeom(k, x, y, w, h, true)} class="pv-fill" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>${deco.after}</svg>`;
}
