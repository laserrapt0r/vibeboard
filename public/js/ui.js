// Benutzeroberfläche des Board-Editors
import { T, LOCALE, guestName } from './i18n.js';
import {
  h, append, ICONS, esc, toast, modal, promptDialog, confirmDialog, STICKY_COLORS, PALETTE, USER_COLORS, unionRect,
  initials, relTime, rectsIntersect, throttle, uid, api,
} from './util.js';
import { sortForRender, SHAPES, SHAPE_GROUPS, shapeGeom, shapeDecor, renderSvgDocument, elBounds, safeLink, PRIORITIES, cardTags, ARROW_HEADS, headType, waypointsOf, cellStyle } from './render.js';
import { LANGUAGES } from './highlight.js';
import { templateGallery, markTemplateUsed } from './gallery.js';
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
  ['select', T('Auswählen (V)')], ['hand', T('Verschieben (H / Leertaste)')], '|',
  ['sticky', T('Sticky Note (N)')], ['text', T('Text (T)')], ['shape', T('Formen (S, R, O)')], ['connector', T('Verbindungslinie (L)')],
  ['pen', T('Stift (P)')], ['highlighter', T('Textmarker')], ['eraser', T('Radierer (E)')], '|',
  ['frame', T('Frame (F)')], ['card', T('Karte / Aufgabe (K)')], ['table', T('Tabelle')], ['code', T('Code-Block')], ['mindmap', T('Mindmap (M)')],
  ['comment', T('Kommentar (C)')], ['emoji', T('Sticker & Emojis')], ['image', T('Bild oder Datei hochladen (Bilder, PDF, Office, Text)')], ['laser', T('Laserpointer (X)')], '|',
  ['template', T('Vorlagen')], ['diagram', T('Diagramm aus Text (Mermaid-Syntax)')],
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
    title: c === 'transparent' ? T('Keine Füllung') : c,
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
      content = h('div', {}, h('div', { class: 'pop-title' }, T('Farbe der Sticky Note')), swatchGrid(STICKY_COLORS, o.stickyColor, (c) => { o.stickyColor = c; done(); }));
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
      content = h('div', {}, h('div', { class: 'pop-title' }, T('Sprache für neue Code-Blöcke')), h('div', { class: 'lang-list' }, LANGUAGES.map(([k, l]) =>
        h('button', { class: 'btn small' + ((o.codeLang || 'js') === k ? ' primary' : ''), onclick: () => { o.codeLang = k; done(); } }, l))));
      break;
    case 'connector':
      content = h('div', {}, h('div', { class: 'pop-title' }, T('Linienart')), h('div', { class: 'row' }, [['curve', T('Kurve')], ['elbow', T('Gewinkelt')], ['straight', T('Gerade')]].map(([k, l]) =>
        h('button', { class: 'btn small' + (o.routing === k ? ' primary' : ''), onclick: () => { o.routing = k; done(); } }, l))));
      break;
    case 'pen':
    case 'highlighter': {
      const hl = id === 'highlighter';
      content = h('div', {}, h('div', { class: 'pop-title' }, hl ? T('Textmarker') : T('Stift')),
        swatchGrid(hl ? HL_COLORS : PEN_COLORS, hl ? o.hlColor : o.penColor, (c) => { if (hl) o.hlColor = c; else o.penColor = c; done(); }),
        hl ? null : h('div', { class: 'row', style: { marginTop: '8px' } }, [2, 3, 5, 8, 12].map((wd) => h('button', {
          class: 'width-btn' + (o.penWidth === wd ? ' active' : ''), title: wd + T(' px'),
          html: `<span style="width:${wd + 2}px;height:${wd + 2}px"></span>`, onclick: () => { o.penWidth = wd; done(); },
        }))));
      break;
    }
    case 'emoji':
      content = h('div', {}, h('div', { class: 'pop-title' }, T('Sticker')), h('div', { class: 'emoji-grid' }, EMOJIS.map((em) => h('button', { class: 'emoji-btn' + (o.emoji === em ? ' active' : ''), onclick: () => { o.emoji = em; done(); } }, em))));
      break;
  }
  popover(anchor, content, { placement: 'right' });
}

function syncToolButtons() {
  for (const b of document.querySelectorAll('#tools [data-tool]')) {
    b.classList.toggle('active', b.dataset.tool === app.tool);
    b.setAttribute('aria-pressed', String(b.dataset.tool === app.tool));
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
      h('label', { class: 'custom-color' }, T('Eigene Farbe '), custom)), { placement: 'top' });
  };
  return b;
}

// Farbauswahl als Popover an einem beliebigen Anker (z. B. aus einem Menü heraus)
function colorBtnMenu(anchor, color, title, onPick) {
  const custom = h('input', { type: 'color', value: /^#[0-9a-f]{6}$/i.test(color) ? color : '#000000', oninput: (e) => onPick(e.target.value) });
  setTimeout(() => popover(anchor, h('div', {}, h('div', { class: 'pop-title' }, title), swatchGrid(PALETTE, color, (c) => { onPick(c); closePop(); }),
    h('label', { class: 'custom-color' }, T('Eigene Farbe '), custom)), { placement: 'top' }), 0);
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
const STROKE_W = [[0, T('Ohne')], [1, T('1 px')], [2, T('2 px')], [3, T('3 px')], [4, T('4 px')], [6, T('6 px')], [8, T('8 px')], [12, T('12 px')]];

export function buildCtx() {
  // Nach dem Neuaufbau bleibt der Tastaturfokus auf demselben Knopf
  const focused = ctxbar.contains(document.activeElement) ? document.activeElement.title : null;
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
      items.push(colorBtn(f.fill, T('Farbe'), STICKY_COLORS, (c) => applySel({ fill: c })));
      items.push(selectBtn(f.fontSize ?? 'auto', [['auto', T('Auto')], ...FONT_SIZES], T('Schriftgröße'), (v) => applySel({ fontSize: v })));
      items.push(...textStyleBtns(f));
      items.push(alignBtn(f.align || 'center'));
      items.push(valignBtn(f.valign || 'middle'));
    } else if (only === 'shape') {
      items.push(selectBtn(f.shape, SHAPES, T('Form'), (v) => applySel({ shape: v }), 110));
      items.push(colorBtn(f.fill, T('Füllfarbe'), PALETTE, (c) => applySel({ fill: c })));
      items.push(colorBtn(f.stroke === 'none' ? 'transparent' : f.stroke, T('Rahmenfarbe'), PALETTE, (c) => applySel({ stroke: c === 'transparent' ? 'none' : c, strokeWidth: c === 'transparent' ? 0 : f.strokeWidth || 2 }), { ring: true }));
      items.push(selectBtn(f.strokeWidth ?? 2, STROKE_W, T('Rahmenstärke'), (v) => applySel({ strokeWidth: v, stroke: v && f.stroke === 'none' ? '#1a1a1a' : f.stroke }), 60));
      items.push(selectBtn(f.dash || false, [[false, T('──── Durchgezogen')], [true, T('- - - Gestrichelt')], ['dotted', T('····· Gepunktet')]], T('Linienstil'), (v) => applySel({ dash: v }), 46));
      items.push(sep());
      items.push(colorBtn(f.textColor || '#1a1a1a', T('Textfarbe'), PALETTE.slice(1), (c) => applySel({ textColor: c }), { ring: false }));
      items.push(selectBtn(f.fontSize ?? 18, [['auto', T('Auto')], ...FONT_SIZES], T('Schriftgröße'), (v) => applySel({ fontSize: v })));
      items.push(...textStyleBtns(f));
      items.push(alignBtn(f.align || 'center'));
      items.push(valignBtn(f.valign || 'middle'));
    } else if (only === 'text') {
      items.push(selectBtn(f.fontSize ?? 24, FONT_SIZES, T('Schriftgröße'), (v) => applySel({ fontSize: v })));
      items.push(colorBtn(f.color || '#1a1a1a', T('Textfarbe'), PALETTE.slice(1), (c) => applySel({ color: c })));
      items.push(...textStyleBtns(f));
      items.push(alignBtn(f.align || 'left'));
      items.push(colorBtn(f.fill || 'transparent', T('Hintergrund'), PALETTE, (c) => applySel({ fill: c })));
    } else if (only === 'connector') {
      items.push(colorBtn(f.stroke, T('Linienfarbe'), PALETTE.slice(1), (c) => applySel({ stroke: c })));
      items.push(selectBtn(f.strokeWidth || 2, STROKE_W.slice(1), T('Linienstärke'), (v) => applySel({ strokeWidth: v }), 60));
      items.push(selectBtn(f.dash || false, [[false, T('──── Durchgezogen')], [true, T('- - - Gestrichelt')], ['dotted', T('····· Gepunktet')]], T('Linienstil'), (v) => applySel({ dash: v }), 46));
      items.push(selectBtn(f.routing || 'curve', [['curve', T('⤴ Kurve')], ['elbow', T('⌐ Gewinkelt')], ['straight', T('／ Gerade')]], T('Linienführung'), (v) => applySel({ routing: v }), 100));
      items.push(selectBtn(headType(f.arrowStart, 'none'), ARROW_HEADS, T('Linienende am Anfang'), (v) => applySel({ arrowStart: v }), 70));
      items.push(selectBtn(headType(f.arrowEnd, 'arrow'), ARROW_HEADS, T('Linienende am Ende'), (v) => applySel({ arrowEnd: v }), 70));
      if (one) items.push(actBtn('text', T('Beschriftung (Doppelklick auf die Linie)'), () => startEdit(one.id)));
      if (one) {
        const routeBtn = actBtn('more', T('Verlauf & Andocken'), () => menu(routeBtn, [
          { header: T('Verlauf') },
          { label: T('Knickpunkte entfernen (Pfad zurücksetzen)'), icon: 'undo', disabled: !waypointsOf(one).length, onClick: () => applySel({ waypoints: [] }) },
          { label: T('Beschriftung in die Mitte'), icon: 'text', disabled: one.labelPos == null || one.labelPos === 0.5, onClick: () => applySel({ labelPos: 0.5 }) },
          { label: T('Richtung umkehren'), icon: 'arrowEnd', onClick: () => applySel((c) => ({ from: c.to, to: c.from, arrowStart: headType(c.arrowEnd, 'arrow'), arrowEnd: headType(c.arrowStart, 'none'), waypoints: waypointsOf(c).reverse(), labelPos: c.labelPos == null ? undefined : 1 - Number(c.labelPos) })) },
          '-',
          { header: T('Andocken') },
          { label: T('Beide Enden automatisch andocken'), icon: 'fit', disabled: !(one.from.id || one.to.id), onClick: () => applySel((c) => ({ from: c.from.id ? { id: c.from.id } : c.from, to: c.to.id ? { id: c.to.id } : c.to })) },
        ], { placement: 'top' }));
        items.push(routeBtn);
      }
    } else if (only === 'pen') {
      items.push(colorBtn(f.stroke, T('Farbe'), PALETTE.slice(1), (c) => applySel({ stroke: c })));
      items.push(selectBtn(f.strokeWidth, [[1, T('1 px')], [2, T('2 px')], [3, T('3 px')], [5, T('5 px')], [8, T('8 px')], [12, T('12 px')], [20, T('20 px')], [32, T('32 px')]], T('Stärke'), (v) => applySel({ strokeWidth: v }), 60));
    } else if (only === 'frame') {
      items.push(colorBtn(f.fill || '#ffffff', T('Hintergrund'), PALETTE, (c) => applySel({ fill: c })));
      if (one) {
        items.push(actBtn('edit', T('Umbenennen'), () => startEdit(one.id)));
        items.push(selectBtn('', [['16:9', T('Präsentation 16:9')], ['4:3', T('Präsentation 4:3')], ['a4', T('A4 Hochformat')], ['a4l', T('A4 Querformat')], ['1:1', T('Quadrat')], ['phone', T('Smartphone')]], T('Format'), (v) => {
          const sizes = { '16:9': [1280, 720], '4:3': [1024, 768], a4: [794, 1123], a4l: [1123, 794], '1:1': [1000, 1000], phone: [390, 844] };
          const [w, hh] = sizes[v];
          applySel({ w, h: hh });
        }, 80));
        items.push(actBtn('present', T('Ab hier präsentieren'), () => app.emit('present', one.id)));
      }
    } else if (only === 'card') {
      items.push(colorBtn(f.color || '#4262ff', T('Farbe'), PALETTE.slice(2), (c) => applySel({ color: c })));
      items.push(selectBtn(f.priority || '', [['', T('Ohne Priorität')], ...Object.entries(PRIORITIES).map(([k, p]) => [k, `${p.icon} ${p.label}`])], T('Priorität'), (v) => applySel({ priority: v || undefined }), 90));
      if (one) items.push(actBtn('edit', T('Karte bearbeiten'), () => app.emit('editCard', one.id)));
      if (one) items.push(actBtn('poker', T('Schätzrunde starten'), () => app.emit('startEstimation', one.id)));
    } else if (only === 'code') {
      items.push(selectBtn(f.lang || 'plain', LANGUAGES, T('Sprache'), (v) => applySel({ lang: v }), 120));
      items.push(toggleBtn('moon', f.theme !== 'light', T('Dunkles Farbschema'), () => applySel({ theme: f.theme === 'light' ? 'dark' : 'light' })));
      items.push(selectBtn(f.fontSize || 14, FONT_SIZES.slice(1, 8), T('Schriftgröße'), (v) => applySel({ fontSize: v })));
      items.push(toggleBtn('<b style="font-size:11px">1 2</b>', f.lineNumbers !== false, T('Zeilennummern'), () => applySel({ lineNumbers: f.lineNumbers === false })));
      if (one) items.push(actBtn('edit', T('Code bearbeiten (Enter)'), () => startEdit(one.id, { selectAll: false })));
      if (one) items.push(actBtn('copy', T('Code kopieren'), () => navigator.clipboard.writeText(one.text || '').then(() => toast(T('Code kopiert')), () => toast(T('Kopieren nicht möglich')))));
    } else if (only === 'table' && one) {
      // Formatierung gilt für die ausgewählten Zellen – ohne Zellauswahl für die ganze Tabelle
      const rg = tableRange();
      const st = cellStyle(one, rg.r0, rg.c0);
      const colName = (c) => { let n = ''; c += 1; while (c > 0) { const m = (c - 1) % 26; n = String.fromCharCode(65 + m) + n; c = Math.floor((c - 1) / 26); } return n; };
      const where = rg.whole ? T('Ganze Tabelle') : rg.r0 === rg.r1 && rg.c0 === rg.c1 ? T`Zelle ${colName(rg.c0)}${rg.r0 + 1}` : `${colName(rg.c0)}${rg.r0 + 1}:${colName(rg.c1)}${rg.r1 + 1}`;
      items.push(h('span', { class: 'ctx-label', title: T('Klick in die ausgewählte Tabelle wählt eine Zelle, Umschalt-Klick oder Umschalt+Pfeil einen Bereich') }, where));
      items.push(toggleBtn('bold', st.bold, T('Fett'), () => formatCells({ b: !st.bold })));
      items.push(toggleBtn('italic', st.italic, T('Kursiv'), () => formatCells({ i: !st.italic })));
      items.push(toggleBtn('underline', st.underline, T('Unterstrichen'), () => formatCells({ u: !st.underline })));
      items.push(toggleBtn('strike', st.strike, T('Durchgestrichen'), () => formatCells({ s: !st.strike })));
      items.push(selectBtn(st.align, [['left', T('⯇ Links')], ['center', T('≡ Mitte')], ['right', T('⯈ Rechts')]], T('Ausrichtung waagerecht'), (v) => formatCells({ al: v }), 74));
      items.push(selectBtn(st.valign, [['top', T('⯅ Oben')], ['middle', T('≡ Mitte')], ['bottom', T('⯆ Unten')]], T('Ausrichtung senkrecht'), (v) => formatCells({ va: v }), 74));
      items.push(selectBtn(st.size, FONT_SIZES.slice(0, 10), T('Schriftgröße'), (v) => formatCells({ fs: v })));
      items.push(colorBtn(st.color, T('Textfarbe'), PALETTE.slice(1), (c) => formatCells({ c })));
      items.push(colorBtn(st.bg || 'transparent', T('Zellenfarbe'), PALETTE, (c) => formatCells({ bg: c === 'transparent' ? undefined : c })));
      const tb = actBtn('table', T('Zeilen & Spalten'), () => menu(tb, [
        { header: rg.whole ? T('Am Ende der Tabelle') : T('An der Auswahl') },
        { label: T('Zeile oberhalb einfügen'), icon: 'plus', disabled: rg.whole, onClick: () => tableAction('rowAbove') },
        { label: rg.whole ? T('Zeile anhängen') : T('Zeile unterhalb einfügen'), icon: 'plus', onClick: () => tableAction('rowBelow') },
        { label: T('Spalte links einfügen'), icon: 'plus', disabled: rg.whole, onClick: () => tableAction('colLeft') },
        { label: rg.whole ? T('Spalte anhängen') : T('Spalte rechts einfügen'), icon: 'plus', onClick: () => tableAction('colRight') },
        '-',
        { label: rg.r0 === rg.r1 ? T('Zeile löschen') : T`${rg.r1 - rg.r0 + 1} Zeilen löschen`, icon: 'trash', danger: true, disabled: rg.whole, onClick: () => tableAction('deleteRows') },
        { label: rg.c0 === rg.c1 ? T('Spalte löschen') : T`${rg.c1 - rg.c0 + 1} Spalten löschen`, icon: 'trash', danger: true, disabled: rg.whole, onClick: () => tableAction('deleteCols') },
        { label: T('Inhalt leeren'), icon: 'close', onClick: () => tableAction('clear') },
        { label: T('Formatierung entfernen'), icon: 'undo', onClick: () => tableAction('clearFormat') },
        '-',
        { label: T('Spaltenbreiten angleichen'), icon: 'distH', onClick: () => tableAction('equalCols') },
        { label: T('Zeilenhöhen angleichen'), icon: 'distV', onClick: () => tableAction('equalRows') },
        { label: one.header !== false ? T('Kopfzeile ausschalten') : T('Kopfzeile einschalten'), icon: 'table', onClick: () => applySel({ header: one.header === false }) },
        { label: T('Farbe der Kopfzeile …'), icon: 'table', onClick: () => colorBtnMenu(tb, one.headerFill || '#eef1ff', T('Kopfzeile'), (c) => applySel({ headerFill: c === 'transparent' ? '#ffffff' : c })) },
        { label: T('Farbe der Linien …'), icon: 'table', onClick: () => colorBtnMenu(tb, one.stroke || '#b9b9b9', T('Linien'), (c) => applySel({ stroke: c === 'transparent' ? '#ffffff' : c })) },
      ], { placement: 'top' }));
      items.push(tb);
    } else if (only === 'emoji') {
      items.push(actBtn('<span style="font-size:18px">' + esc(f.char) + '</span>', T('Sticker ändern'), (e) => {
        const b = e.currentTarget;
        popover(b, h('div', { class: 'emoji-grid' }, EMOJIS.map((em) => h('button', { class: 'emoji-btn', onclick: () => { applySel({ char: em }); closePop(); } }, em))), { placement: 'top' });
      }));
    } else if (only === 'image' && one) {
      items.push(actBtn('download', T('Bild herunterladen'), () => download(one.name || T('bild') + '.png', one.src)));
    }
    if (types.has('sticky') && sel.length > 1) items.push(actBtn('cluster', T('Nach Farbe clustern'), clusterByColor));
    if (sel.length > 1) {
      const ab = actBtn('alignLeft', T('Ausrichten & Verteilen'), () => menu(ab, [
        { label: T('Links ausrichten'), icon: 'alignLeft', onClick: () => alignSel('left') },
        { label: T('Horizontal zentrieren'), icon: 'alignCenterH', onClick: () => alignSel('centerH') },
        { label: T('Rechts ausrichten'), icon: 'alignRight', onClick: () => alignSel('right') },
        { label: T('Oben ausrichten'), icon: 'alignTop', onClick: () => alignSel('top') },
        { label: T('Vertikal zentrieren'), icon: 'alignMiddle', onClick: () => alignSel('middle') },
        { label: T('Unten ausrichten'), icon: 'alignBottom', onClick: () => alignSel('bottom') },
        '-',
        { label: T('Horizontal verteilen (gleiche Abstände)'), icon: 'distH', onClick: () => distributeSel('h') },
        { label: T('Vertikal verteilen (gleiche Abstände)'), icon: 'distV', onClick: () => distributeSel('v') },
        { label: T('Lückenlos nebeneinander'), icon: 'distH', onClick: () => packSel('h', 0) },
        { label: T('Lückenlos untereinander'), icon: 'distV', onClick: () => packSel('v', 0) },
        { label: T('Mit festem Abstand anordnen …'), icon: 'distH', onClick: () => packWithGap() },
        { label: T('Als Raster anordnen'), icon: 'grid', onClick: () => arrangeGrid() },
        '-',
        { header: T('Größe angleichen (an das zuerst ausgewählte Element)') },
        { label: T('Gleiche Breite'), icon: 'alignCenterH', onClick: () => matchSize('w') },
        { label: T('Gleiche Höhe'), icon: 'alignMiddle', onClick: () => matchSize('h') },
        { label: T('Gleiche Größe'), icon: 'fit', onClick: () => matchSize('both') },
        { label: T`Position & Größe am Raster (${gridSize()} px) ausrichten`, icon: 'grid', onClick: () => snapSelToGrid() },
      ], { placement: 'top' }));
      items.push(ab);
    }
    if (items.length) items.push(sep());
  }
  if (one && !locked && ['sticky', 'shape', 'text', 'card', 'image', 'emoji', 'frame', 'code'].includes(one.type)) {
    items.push(toggleBtn('link', !!one.link, one.link ? T('Link: ') + one.link : T('Link hinzufügen'), async () => {
      const v = await promptDialog(T('Link'), T('Adresse (leer lassen zum Entfernen)'), one.link || 'https://');
      if (v === null) return;
      const href = safeLink(v);
      if (v.trim() && v.trim() !== 'https://' && !href) return toast(T('Bitte eine gültige http(s)-Adresse angeben'));
      applySel({ link: href || undefined });
    }));
  }
  if (!locked && sel.some((e) => e.type !== 'connector' && e.type !== 'comment')) {
    const gb = actBtn(`<b style="font-size:11px">${T('B×H')}</b>`, T('Position & Größe (exakte Werte)'), () => openGeometry(gb));
    items.push(gb);
  }
  const grouped = sel.some((e) => e.groupId);
  if (sel.length > 1 && !locked) items.push(actBtn('group', grouped ? T('Gruppierung aufheben (Strg+Umschalt+G)') : T('Gruppieren (Strg+G)'), grouped ? ungroupSel : groupSel));
  const modLocked = sel.every((e) => e.modLock);
  if (!(modLocked && !app.isFacilitator)) {
    const own = sel.every((e) => e.locked);
    items.push(toggleBtn(own ? 'lock' : 'unlock', own, own ? T('Entsperren (Strg+L)') : T('Sperren (Strg+L)'), toggleLock));
  }
  if (app.isFacilitator && sel.some((e) => e.type !== 'comment')) {
    items.push(toggleBtn('shield', modLocked, modLocked ? T('Für Teilnehmende freigeben') : T('Für Teilnehmende sperren (nur Moderierende können ändern)'), toggleModLock));
  }
  // Erweiterungen anderer Module (Retro, Dateien, Schlagwörter, verborgene Bereiche)
  app.emit('ctxItems', items, sel, { locked, one, only, actBtn, toggleBtn, sep });
  if (!locked) {
    items.push(actBtn('comment', T('Kommentieren'), () => {
      const b = selectionBounds();
      newComment({ x: b.x + b.w, y: b.y });
    }));
    const more = actBtn('more', T('Mehr'), () => menu(more, [
      { label: T('Duplizieren'), icon: 'copy', hint: T('Strg+D'), onClick: () => duplicateEls(collectForCopy([...app.sel])) },
      { label: T('In den Vordergrund'), icon: 'front', hint: T('Strg+]'), onClick: bringToFront },
      { label: T('In den Hintergrund'), icon: 'back', hint: T('Strg+['), onClick: sendToBack },
      { label: T('Auswahl einpassen'), icon: 'fit', hint: T('Umschalt+2'), onClick: () => fitTo(selectionBounds(), { maxZ: 2 }) },
      { label: T('Größe kopieren'), icon: 'copy', onClick: copySize },
      { label: T('Größe übernehmen'), icon: 'fit', disabled: !hasCopiedSize(), onClick: () => pasteSize('both') },
      { label: T('Nur Breite übernehmen'), icon: 'alignCenterH', disabled: !hasCopiedSize(), onClick: () => pasteSize('w') },
      { label: T('Nur Höhe übernehmen'), icon: 'alignMiddle', disabled: !hasCopiedSize(), onClick: () => pasteSize('h') },
      { label: T('Als PNG exportieren'), icon: 'download', onClick: () => exportPng(true) },
      '-',
      { label: T('Löschen'), icon: 'trash', danger: true, hint: T('Entf'), onClick: () => deleteEls([...app.sel]) },
    ], { placement: 'top' }));
    items.push(more);
    items.push(actBtn('trash', T('Löschen (Entf)'), () => deleteEls([...app.sel])));
  }
  ctxbar.append(...items);
  ctxbar.classList.remove('hidden');
  if (focused) [...ctxbar.querySelectorAll('button')].find((b) => b.title === focused)?.focus();
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
      if (!Number.isFinite(v) || Math.abs(v) > MAX) return toast(T('Bitte Werte bis ') + MAX.toLocaleString(LOCALE) + T(' eingeben')), false;
      if ((k === 'w' || k === 'h') && v < 1) return toast(T('Breite und Höhe müssen mindestens 1 sein')), false;
    }
    setGeometry({ ...vals, keepRatio: ratio.checked });
    buildCtx();
    return true;
  };
  const form = h('form', { class: 'geo-form', onsubmit: (e) => { e.preventDefault(); if (apply()) closePop(); } },
    h('div', { class: 'pop-title' }, multi ? T`Position & Größe (${sel.length} Elemente)` : T('Position & Größe')),
    h('div', { class: 'geo-grid' }, h('label', {}, 'X', ix), h('label', {}, 'Y', iy), h('label', {}, T('Breite'), iw), h('label', {}, T('Höhe'), ih)),
    h('label', { class: 'check' }, ratio, T('Seitenverhältnis beibehalten')),
    multi ? h('p', { class: 'muted small' }, T('X/Y verschieben die ganze Auswahl; Breite/Höhe gelten für jedes Element.')) : null,
    h('div', { class: 'row' }, h('button', { type: 'submit', class: 'btn primary small' }, T('Übernehmen'))));
  form.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Escape') closePop();
  });
  popover(anchor, form, { placement: 'top' });
  setTimeout(() => iw.focus(), 0);
}

async function packWithGap() {
  const v = await promptDialog(T('Mit festem Abstand anordnen'), T('Abstand in Pixeln (Richtung wird aus der Anordnung erkannt)'), '20');
  if (v === null) return;
  const gap = Number(String(v).replace(',', '.')) || 0; // negativ = überlappend
  const b = selectionBounds();
  packSel(b.w >= b.h ? 'h' : 'v', gap);
}

function textStyleBtns(f) {
  return [
    toggleBtn('bold', f.bold, T('Fett'), () => applySel({ bold: !f.bold })),
    toggleBtn('italic', f.italic, T('Kursiv'), () => applySel({ italic: !f.italic })),
    toggleBtn('underline', f.underline, T('Unterstrichen'), () => applySel({ underline: !f.underline })),
    toggleBtn('strike', f.strike, T('Durchgestrichen'), () => applySel({ strike: !f.strike })),
  ];
}

function valignBtn(cur) {
  return selectBtn(cur, [['top', T('⯅ Oben')], ['middle', T('≡ Mitte')], ['bottom', T('⯆ Unten')]], T('Ausrichtung senkrecht'), (v) => applySel({ valign: v }), 70);
}

function alignBtn(cur) {
  const icons = { left: 'tAlignLeft', center: 'tAlignCenter', right: 'tAlignRight' };
  const next = { left: 'center', center: 'right', right: 'left' };
  return actBtn(icons[cur], T('Textausrichtung'), () => applySel({ align: next[cur] }));
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
  const assignee = h('input', { type: 'text', value: el.assignee || '', placeholder: T('Name'), list: 'assignee-list' });
  // Zuständige Person aus dem Board wählen (eindeutig per ID – Namen können doppelt vorkommen)
  let assigneeId = el.assigneeId || '';
  const who = h('select', { 'aria-label': T('Person auswählen') }, h('option', { value: '' }, T('– Person wählen –')));
  boardPeople().then((people) => {
    for (const p of people.filter((x) => !x.guest)) who.append(h('option', { value: p.id, selected: p.id === assigneeId }, p.displayName + (p.id === myId() ? T(' (du)') : '')));
  });
  who.addEventListener('change', () => {
    assigneeId = who.value;
    if (who.value) boardPeople().then((list) => (assignee.value = list.find((p) => p.id === who.value)?.displayName || ''));
  });
  assignee.addEventListener('input', () => {
    assigneeId = '';
    who.value = '';
  });
  const due = h('input', { type: 'date', value: el.due || '' });
  const start = h('input', { type: 'date', value: el.start || '' });
  const status = h('input', { type: 'text', value: el.status || '', placeholder: T('z. B. In Arbeit'), list: 'status-list' });
  const key = h('input', { type: 'text', value: el.key || '', placeholder: T('z. B. VB-42'), maxlength: 40 });
  const prio = h('select', {}, h('option', { value: '' }, T('Ohne')), Object.entries(PRIORITIES).map(([k, p]) => h('option', { value: k, selected: el.priority === k }, `${p.icon} ${p.label}`)));
  const points = h('input', { type: 'text', value: el.points ?? '', placeholder: T('z. B. 5'), maxlength: 5 });
  const tags = h('input', { type: 'text', value: cardTags(el).join(', '), placeholder: T('z. B. Backend, Bug') });
  const names = [...new Set([app.user.name, ...[...app.peers.values()].map((p) => p.name), ...[...app.els.values()].filter((e) => e.assignee).map((e) => e.assignee)].filter(Boolean))];
  const sw = swatchGrid(PALETTE.slice(6), color, (c) => {
    color = c;
    sw.querySelectorAll('.swatch').forEach((s) => s.classList.toggle('active', s.title === c));
  });
  const form = h('form', { class: 'form', onsubmit: (e) => {
    e.preventDefault();
    if (start.value && due.value && start.value > due.value) return toast(T('Der Beginn muss vor der Fälligkeit liegen.'));
    const next = {
      title: title.value, description: desc.value, assignee: assignee.value.trim(), assigneeId: assigneeId || undefined, due: due.value, start: start.value || undefined, status: status.value.trim(), color,
      key: key.value.trim() || undefined, priority: prio.value || undefined, points: points.value.trim() || undefined,
      tags: tags.value.split(',').map((t) => t.trim()).filter(Boolean).slice(0, 8),
    };
    // Nur Geändertes schreiben: Sonst überschriebe der offene Dialog, was andere inzwischen an der Karte geändert haben
    const patch = Object.fromEntries(Object.entries(next).filter(([k, v]) => JSON.stringify(v ?? '') !== JSON.stringify(el[k] ?? '')));
    if (Object.keys(patch).length) act(() => updateEl(id, patch));
    m.close();
    buildCtx();
  } },
  h('label', {}, T('Titel'), title),
  h('label', {}, T('Beschreibung'), desc),
  h('div', { class: 'form-row' }, h('label', {}, T('Zuständig'), who, assignee), h('div', { class: 'form' }, h('label', {}, T('Beginn'), start), h('label', {}, T('Fällig am'), due))),
  h('div', { class: 'form-row' }, h('label', {}, T('Status'), status), h('label', {}, T('Priorität'), prio)),
  h('div', { class: 'form-row' }, h('label', {}, T('Schlüssel / Ticket'), key), h('label', {}, T('Story Points'), points)),
  h('label', {}, T('Labels (durch Komma getrennt)'), tags),
  h('datalist', { id: 'assignee-list' }, names.map((n) => h('option', { value: n }))),
  h('datalist', { id: 'status-list' }, [T('Offen'), T('In Arbeit'), T('Review'), T('Test'), T('Blockiert'), T('Fertig')].map((n) => h('option', { value: n }))),
  h('div', {}, h('div', { class: 'label' }, T('Farbe')), sw),
  h('div', { class: 'form-actions' }, h('button', { type: 'button', class: 'btn', onclick: () => m.close() }, T('Abbrechen')), h('button', { type: 'submit', class: 'btn primary' }, T('Speichern'))));
  const m = modal(T('Karte bearbeiten'), form);
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
const fmtDate = (d) => (d ? new Date(d + 'T00:00').toLocaleDateString(LOCALE, { day: '2-digit', month: '2-digit', year: 'numeric' }) : '');

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
    }, h('span', { class: 'avatar xs', style: { background: p.color } }, initials(p.displayName)), h('span', {}, p.displayName), p.guest ? h('span', { class: 'muted small' }, T('Gast')) : null)));
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
    return esc(m.text).replace(/@([\p{L}\p{N}._-]+)/gu, (all, n) => `<span class="mention${n.toLowerCase() === self ? T(' me') : ''}">@${n}</span>`);
  }
  const names = [...m.mentions].sort((a, b) => b.name.length - a.name.length);
  const re = new RegExp('@(' + names.map((x) => x.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')', 'giu');
  let out = '', last = 0;
  for (const hit of String(m.text).matchAll(re)) {
    const who = names.find((x) => x.name.toLowerCase() === hit[1].toLowerCase());
    out += esc(m.text.slice(last, hit.index)) + `<span class="mention${who && who.id === me ? T(' me') : ''}">${esc(hit[0])}</span>`;
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
  const input = h('textarea', { rows: 2, placeholder: thread.length ? T('Antworten … (@ erwähnt jemanden)') : T('Kommentar schreiben … (@ erwähnt jemanden)') }, draft);
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
      h('strong', {}, el.resolved ? T('Erledigt') : T('Kommentar')),
      h('span', { class: 'spacer' }),
      app.canComment && !el.draft ? iconBtn(el.resolved ? 'undo' : 'check', el.resolved ? T('Wieder öffnen') : T('Als erledigt markieren'), () => {
        setLocal({ resolved: !el.resolved });
        commentOp('resolve', el.id, { resolved: !el.resolved });
        renderCommentPop();
      }) : null,
      canDelete ? iconBtn('trash', T('Kommentar löschen'), () => {
        commentOp('delete', el.id);
        app.sync.forget(el.id);
        applyRemoteOp({ op: 'delete', id: el.id });
        closeComment();
      }) : null,
      iconBtn('close', T('Schließen'), closeComment)),
    taskRow(el),
    h('div', { class: 'comment-list' }, thread.map((m) => h('div', { class: 'comment-msg' + (m.pending ? ' pending' : '') },
      h('div', { class: 'comment-meta' }, h('span', { class: 'avatar xs', style: { background: m.color || '#888' } }, initials(m.author)), h('b', {}, guestName(m.author)), h('span', { class: 'muted' }, m.pending ? T('wird gesendet …') : relTime(m.ts))),
      h('div', { class: 'comment-text', html: commentHtml(m) })))),
    app.canComment ? h('div', { class: 'comment-input' }, h('div', { class: 'mention-wrap' }, input, mention.list), h('button', { class: 'btn primary small', onclick: send }, T('Senden'))) : null,
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
    if (!t) return app.canComment && (el.thread || []).length ? h('div', { class: 'comment-task-row' }, h('button', { class: 'btn small', onclick: () => { commentPop.taskForm = true; renderCommentPop(); } }, h('span', { html: ICONS.tasks }), T('Als Aufgabe zuweisen'))) : null;
    const overdue = t.due && !el.resolved && t.due < new Date().toISOString().slice(0, 10);
    return h('div', { class: 'comment-task' + (el.resolved ? ' done' : '') },
      h('span', { html: ICONS.tasks }),
      h('span', {}, h('b', {}, t.assignee), t.due ? h('span', { class: overdue ? 'overdue' : 'muted' }, T` · fällig ${fmtDate(t.due)}`) : null, el.resolved ? h('span', { class: 'muted' }, T(' · erledigt')) : null),
      h('span', { class: 'spacer' }),
      app.canComment ? h('button', { class: 'btn small', onclick: () => { commentPop.taskForm = true; renderCommentPop(); } }, T('Ändern')) : null);
  }
  const who = h('select', {}, h('option', { value: '' }, T('Person wählen …')));
  const due = h('input', { type: 'date', value: t?.due || '' });
  boardPeople().then((people) => people.forEach((p) => who.append(h('option', { value: p.id, selected: t && t.assigneeId === p.id }, p.displayName + (p.id === myId() ? T(' (du)') : '') + (p.guest ? T(' (Gast)') : '')))));
  return h('form', { class: 'comment-task-form', onsubmit: (e) => {
    e.preventDefault();
    if (!who.value) return toast(T('Bitte eine Person wählen'));
    commentOp('task', el.id, { assigneeId: who.value, due: due.value });
    commentPop.taskForm = false;
    renderCommentPop();
  } },
  h('div', { class: 'row' }, who, due),
  h('div', { class: 'row' },
    h('button', { type: 'submit', class: 'btn primary small' }, T('Zuweisen')),
    t ? h('button', { type: 'button', class: 'btn small', onclick: () => { commentOp('task', el.id, { assigneeId: null }); commentPop.taskForm = false; renderCommentPop(); } }, T('Zuweisung entfernen')) : null,
    h('button', { type: 'button', class: 'btn small', onclick: () => { commentPop.taskForm = false; renderCommentPop(); } }, T('Abbrechen'))));
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
  document.querySelectorAll('[data-panel]').forEach((b) => {
    b.classList.toggle('active', b.dataset.panel === sidePanel);
    b.setAttribute('aria-pressed', String(b.dataset.panel === sidePanel));
  });
  if (!sidePanel) return;
  // Nicht neu aufbauen, während jemand in ein Textfeld des Panels tippt (Checkboxen sind unkritisch)
  const ae = document.activeElement;
  if (side.contains(ae) && ae.tagName === 'INPUT' && ae.type !== 'checkbox') return;
  side.innerHTML = '';
  const close = iconBtn('close', T('Schließen'), () => toggleSidePanel(sidePanel));
  if (sidePanel === 'frames') {
    const list = frames();
    side.append(h('div', { class: 'side-head' }, h('h3', {}, T('Frames')), h('span', { class: 'spacer' }), close));
    side.append(h('div', { class: 'side-actions' },
      h('button', { class: 'btn primary small', disabled: !list.length, onclick: () => app.emit('present', null) }, h('span', { html: ICONS.present }), T('Präsentieren')),
      app.viewOnly ? null : h('button', { class: 'btn small', onclick: () => {
        const c = viewCenter();
        const f = makeElement('frame', c.x, c.y);
        addElements([f]);
        fitTo({ x: f.x, y: f.y, w: f.w, h: f.h });
      } }, h('span', { html: ICONS.plus }), T('Frame'))));
    if (!list.length) side.append(h('p', { class: 'muted pad' }, T('Noch keine Frames. Frames gliedern dein Board in Bereiche und dienen als Folien im Präsentationsmodus.')));
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
      h('span', { class: 'frame-name' }, f.title || T('Frame')),
      app.viewOnly ? null : h('span', { class: 'frame-ord' },
        iconBtn('chevUp', T('Nach oben'), (e) => { e.stopPropagation(); moveFrame(list, i, -1); }, { disabled: i === 0 }),
        iconBtn('chevDown', T('Nach unten'), (e) => { e.stopPropagation(); moveFrame(list, i, 1); }, { disabled: i === list.length - 1 }))));
    });
    side.append(ul);
  } else if (sidePanel === 'comments') {
    const all = [...app.els.values()].filter((e) => e.type === 'comment' && (e.thread || []).length);
    const open = all.filter((e) => !e.resolved);
    const mine = all.filter((e) => e.task && e.task.assigneeId === String(app.user.id) && !e.resolved);
    side.append(h('div', { class: 'side-head' }, h('h3', {}, T`Kommentare (${open.length} offen)`), h('span', { class: 'spacer' }), close));
    const filters = [['open', T('Offen')], ['mine', T`Mir zugewiesen${mine.length ? ` (${mine.length})` : ''}`], ['all', T('Alle')]];
    const f = app.settings.commentFilter || (app.settings.hideResolved ? 'open' : 'all');
    side.append(h('div', { class: 'side-actions' }, h('div', { class: 'seg' }, filters.map(([k, l]) => h('button', { class: 'btn small' + (f === k ? ' active' : ''), onclick: () => {
      app.settings.commentFilter = k;
      app.settings.hideResolved = k !== 'all';
      saveSettings();
      renderSidePanel();
    } }, l)))));
    const list = (f === 'mine' ? mine : f === 'open' ? open : all).sort((a, b) => (b.thread.at(-1)?.ts || 0) - (a.thread.at(-1)?.ts || 0));
    if (!list.length) side.append(h('p', { class: 'muted pad' }, f === 'mine' ? T('Dir sind keine offenen Kommentare zugewiesen.') : T('Keine Kommentare. Mit dem Kommentar-Werkzeug (C) kannst du überall auf dem Board Feedback hinterlassen und mit @Name jemanden erwähnen.')));
    for (const c of list) {
      const first = c.thread[0], last = c.thread.at(-1);
      side.append(h('div', { class: 'comment-card' + (c.resolved ? ' resolved' : ''), onclick: () => {
        fitTo({ x: c.x - 200, y: c.y - 200, w: 400, h: 400 }, { maxZ: 1.5 });
        setTimeout(() => openComment(c.id), 320);
      } },
      h('div', { class: 'comment-meta' }, h('span', { class: 'avatar xs', style: { background: first.color || '#888' } }, initials(first.author)), h('b', {}, guestName(first.author)), h('span', { class: 'muted' }, relTime(last.ts))),
      h('div', { class: 'comment-text' }, first.text),
      c.task ? h('div', { class: 'comment-task small' }, h('span', { html: ICONS.tasks }), h('span', {}, c.task.assignee + (c.task.due ? T` · fällig ${fmtDate(c.task.due)}` : ''))) : null,
      c.thread.length > 1 ? h('div', { class: 'muted small' }, T`Antworten: ${c.thread.length - 1}`) : null));
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
  const m = modal(T('Vorlage einfügen'), templateGallery((t) => {
    m.close();
    insertTemplate(t);
  }, { showBlank: false }), { wide: true });
}

function insertTemplate(t) {
  if (!placeElements(t.build())) return;
  markTemplateUsed(t);
  toast(T`Vorlage „${t.name}“ eingefügt`);
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
    if (!els.length) return toast(T('Nichts zu exportieren'));
    toast(T('PNG wird erstellt …'));
    const url = await pngDataUrl(els, { scale: 2, background: app.settings.dark ? '#1e1f24' : '#ffffff' });
    download(safeName(app.name) + '.png', url);
  } catch (e) {
    toast(T('Export fehlgeschlagen: ') + e.message);
  }
}

function exportSvg() {
  const els = [...app.els.values()];
  if (!els.length) return toast(T('Nichts zu exportieren'));
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

// Datei aus draw.io oder PowerPoint: wird zu normalen, bearbeitbaren Elementen
async function importForeign(file) {
  if (app.viewOnly) return toast(T('Du darfst dieses Board nur ansehen.'));
  toast(T`„${file.name}“ wird importiert …`);
  try {
    const { readForeign } = await import('./import-file.js');
    const { elements, skipped } = await readForeign(file);
    if (!elements.length) return toast(T('Keine Elemente gefunden'));
    pasteElements(elements, viewCenter());
    fitTo(selectionBounds(), { maxZ: 1 });
    toast(skipped ? T`${elements.length} Elemente importiert, ${skipped} nicht übernommen (z. B. Diagramme oder SmartArt)` : T`${elements.length} Elemente importiert`, 5000);
  } catch (e) {
    toast(e.message, 6000);
  }
}

async function exportPptx() {
  toast(T('PowerPoint-Datei wird erstellt …'));
  try {
    const { buildPptx } = await import('./pptx-export.js');
    // Die Datei verlässt die Anwendung: Privates und verborgene Bereiche bleiben außen vor
    const hidden = globalThis.ConcealOps ? globalThis.ConcealOps.concealedIds([...app.els.values()]) : new Set();
    const open = (e) => !e.hidden && !e.priv && !hidden.has(e.id);
    // Ein Diagramm trägt die Werte seiner Tabelle
    const usable = (e) => open(e) && e.type !== 'comment' && !(e.type === 'chart' && getEl(e.sourceId) && !open(getEl(e.sourceId)));
    const all = [...app.els.values()].filter(usable);
    const list = frames().filter((f) => usable(f) && !f.concealed);
    const withLines = (els) => {
      const ids = new Set(els.map((e) => e.id));
      return sortForRender([...els.filter(usable), ...all.filter((e) => e.type === 'connector' && e.from.id && e.to.id && ids.has(e.from.id) && ids.has(e.to.id) && !ids.has(e.id))]);
    };
    const slides = list.length
      ? list.map((f) => ({ bounds: { x: f.x, y: f.y, w: f.w, h: f.h }, elements: withLines(frameChildren(f)) }))
      : [{ bounds: unionRect(all.map(bounds)), elements: sortForRender(all) }];
    if (!all.length) return toast(T('Nichts zu exportieren'));
    download(safeName(app.name) + '.pptx', await buildPptx(slides, getEl));
    toast(T`${slides.length} Folien exportiert`);
  } catch (e) {
    toast(T('Export fehlgeschlagen: ') + e.message);
  }
}

const importInput = h('input', { type: 'file', accept: '.json,application/json,.drawio,.pptx', style: { display: 'none' } });
document.body.append(importInput);
importInput.addEventListener('change', () => {
  if (importInput.files[0]) importFile(importInput.files[0]);
  importInput.value = '';
});

async function importFile(file) {
  if (app.viewOnly) return toast(T('Du darfst dieses Board nur ansehen.'));
  if (/\.(drawio|pptx)$/i.test(file.name)) return importForeign(file);
  try {
    const data = JSON.parse(await file.text());
    const list = Array.isArray(data) ? data : Array.isArray(data.elements) ? data.elements : Object.values(data.elements || {});
    // Eine JSON-Datei ohne Board-Elemente ist kein Export, sondern ein Dokument – als Dateianhang ablegen
    if (!list.length || !list.every((e) => e && typeof e === 'object' && typeof e.type === 'string')) return app.emit('dropFile', file, viewCenter());
    const n = list.filter((e) => e && e.type !== 'comment').length;
    if (!n) return toast(T('Keine Elemente gefunden (Kommentare werden nicht importiert)'));
    pasteElements(list, viewCenter());
    fitTo(selectionBounds(), { maxZ: 1 });
    toast(T`${n} Elemente importiert${n < list.length ? T(' – Kommentare werden nicht übernommen') : ''}`);
  } catch {
    toast(T('Datei konnte nicht importiert werden'));
  }
}
app.on('importFile', importFile);

function openExportMenu(anchor) {
  menu(anchor, [
    { header: T('Exportieren') },
    { label: T('Als PNG-Bild'), icon: 'image', onClick: () => exportPng(false) },
    { label: T('Auswahl als PNG'), icon: 'image', disabled: !app.sel.size, onClick: () => exportPng(true) },
    { label: T('Als SVG-Vektorgrafik'), icon: 'shape', onClick: exportSvg },
    { label: T('Als PDF (Frames als Seiten)'), icon: 'present', onClick: exportPdf },
    { label: T('Als PowerPoint-Datei'), icon: 'present', onClick: exportPptx },
    { label: T('Als JSON-Datei (Backup)'), icon: 'download', onClick: exportJson },
    '-',
    { header: T('Importieren') },
    { label: T('Datei importieren (JSON, draw.io, PowerPoint)'), icon: 'upload', disabled: app.viewOnly, onClick: () => importInput.click() },
    { label: T('Karten aus CSV / Jira-Export …'), icon: 'card', disabled: app.viewOnly, onClick: () => app.emit('openCsvImport') },
    { label: T('Jira / Azure DevOps verbinden …'), icon: 'link', disabled: app.viewOnly || app.guest, onClick: () => app.emit('openTracker') },
    { label: T('Diagramm aus Text (Mermaid) …'), icon: 'diagram', disabled: app.viewOnly, onClick: () => app.emit('openDiagramText') },
    { label: T('Bild hochladen'), icon: 'image', disabled: app.viewOnly, onClick: () => fileInput.click() },
    { label: T('Datei anhängen (PDF, Office, Text)'), icon: 'file', disabled: app.viewOnly, onClick: () => app.emit('pickFile') },
    '-',
    { header: T('Vorlagen') },
    { label: T('Board als Vorlage speichern …'), icon: 'template', disabled: app.guest, onClick: () => app.emit('saveTemplate', false) },
    { label: T('Auswahl als Vorlage speichern …'), icon: 'template', disabled: app.guest || !app.sel.size, onClick: () => app.emit('saveTemplate', true) },
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
    { header: T('Ansicht') },
    t('grid', T('Raster anzeigen')),
    t('dark', T('Dunkles Design')),
    t('showAuthor', T('Autor auf Sticky Notes')),
    t('hideResolved', T('Erledigte Kommentare ausblenden')),
    t('hideCursors', T('Mauszeiger anderer ausblenden')),
    { label: T('Filter …'), icon: 'filter', onClick: () => showSidePanel('filter') },
    { label: T('Retro & Umfragen …'), icon: 'vote', onClick: () => app.emit('retroMenu', anchor) },
    { header: T('Bearbeitung') },
    t('snap', T('Am Raster einrasten')),
    { label: T`Rastergröße: ${gridSize()} px`, icon: 'grid', keep: true, onClick: () => {
      const sizes = [10, 20, 40, 50];
      s.gridSize = sizes[(sizes.indexOf(gridSize()) + 1) % sizes.length];
      saveSettings();
      applyView(true);
      openSettings(anchor);
    } },
    t('smartGuides', T('Intelligente Hilfslinien')),
    t('wheelZoom', T('Mausrad zoomt (statt verschieben)')),
    { label: T('Tastenkürzel'), icon: 'keyboard', onClick: openShortcuts },
    '-',
    ...accountMenuItems(app.me, profileSaved),
    ...(legal.imprint || legal.privacy ? ['-'] : []),
    legal.imprint ? { label: T('Impressum'), icon: 'link', onClick: () => window.open('/impressum', '_blank', 'noopener') } : null,
    legal.privacy ? { label: T('Datenschutz'), icon: 'link', onClick: () => window.open('/datenschutz', '_blank', 'noopener') } : null,
  ], { placement: 'bottom' });
}

export function openShortcuts() {
  const groups = [
    [T('Werkzeuge'), [['V', T('Auswählen')], [T('H / Leertaste'), T('Verschieben')], ['N', T('Sticky Note')], ['T', T('Text')], ['S', T('Form')], ['R / O', T('Rechteck / Ellipse')], ['L', T('Verbindungslinie')], ['P', T('Stift')], ['E', T('Radierer')], ['F', T('Frame')], ['K', T('Karte')], ['M', T('Mindmap')], ['C', T('Kommentar')], ['X', T('Laserpointer')]]],
    [T('Bearbeiten'), [[T('Strg+Z / Strg+Y'), T('Rückgängig / Wiederholen')], [T('Strg+C / X / V'), T('Kopieren / Ausschneiden / Einfügen')], [T('Strg+D'), T('Duplizieren')], [T('Alt + Ziehen'), T('Kopie ziehen')], [T('Entf'), T('Löschen')], [T('Strg+A'), T('Alles auswählen')], [T('Strg+G'), T('Gruppieren')], [T('Strg+Umschalt+G'), T('Gruppe auflösen')], [T('Strg+L'), T('Sperren')], [T('Strg+] / ['), T('Vorder-/Hintergrund')], [T('Pfeiltasten'), T('Verschieben (Umschalt: 10 px)')], [T('Enter / Doppelklick'), T('Text bearbeiten')], [T('Esc / Strg+Enter'), T('Bearbeitung beenden')]]],
    [T('Tabellen'), [[T('Klick in ausgewählte Tabelle'), T('Zelle wählen')], [T('Umschalt + Klick / Pfeil'), T('Bereich wählen')], [T('Pfeiltasten'), T('Zellauswahl bewegen')], [T('Enter / F2'), T('Zelle bearbeiten')], [T('Tippen'), T('Zelle überschreiben')], [T('Entf'), T('Inhalt leeren')], ['Tab', T('Nächste Zelle (beim Bearbeiten)')], [T('Linie ziehen'), T('Spaltenbreite / Zeilenhöhe')]]],
    [T('Verbinder'), [[T('Linie ziehen'), T('Biegen (Knickpunkt)')], [T('◦ auf der Linie ziehen'), T('Knickpunkt einfügen')], [T('Doppelklick auf ▪'), T('Knickpunkt entfernen')], [T('Beschriftung ziehen'), T('Entlang der Linie verschieben')], [T('Ende an Rand ziehen'), T('Fester Andockpunkt')], [T('Ende in Formmitte'), T('Automatisch andocken')]]],
    [T('Mindmap'), [['Tab', T('Unterknoten hinzufügen')], [T('Enter (beim Tippen)'), T('Geschwisterknoten')], [T('Umschalt+Enter'), T('Geschwisterknoten')]]],
    [T('Zusammenarbeit'), [['/', T('Cursor-Chat: Nachricht am Mauszeiger')], [T('Esc'), T('Cursor-Chat schließen')]]],
    [T('Verschieben & Größe'), [[T('Umschalt + Ziehen'), T('Nur waagerecht/senkrecht verschieben')], [T('Strg + Ziehen'), T('Ohne Einrasten')], [T('Seitengriff'), T('Nur Breite bzw. Höhe ändern')], [T('Umschalt + Griff'), T('Seitenverhältnis beibehalten')], [T('Alt + Griff'), T('Größe von der Mitte aus')], [T('Strg+D (wiederholt)'), T('Kopie mit zuletzt verwendetem Versatz')], [T('Klick in ausgewählte Gruppe'), T('Einzelnes Element der Gruppe wählen')], [T('Pfeiltasten'), T('Um 1 px (Umschalt: 10 px, mit Raster: eine Rasterweite) verschieben')], [T('Umschalt-/Strg-Klick'), T('Zur Auswahl hinzufügen bzw. entfernen (Ziehen verschiebt)')]]],
    [T('Ansicht'), [[T('Strg + Mausrad'), T('Zoomen')], [T('Strg + / −'), T('Zoomen')], [T('Strg+0'), T('Auf 100 %')], [T('Umschalt+1'), T('Alles anzeigen')], [T('Umschalt+2'), T('Auswahl anzeigen')], [T('Strg+F'), T('Suchen')]]],
  ];
  modal(T('Tastenkürzel'), h('div', { class: 'shortcuts' }, groups.map(([t, list]) => h('div', {}, h('h4', {}, t), h('table', {}, list.map(([k, d]) => h('tr', {}, h('td', {}, h('kbd', {}, k)), h('td', {}, d))))))), { wide: true });
}

/* ================================================================== */
/* Suche                                                               */
/* ================================================================== */

const searchBox = $('#search-box');

function textOf(el) {
  return [el.text, el.title, el.description, el.label, el.assignee, el.status, ...(el.thread || []).map((m) => m.text), ...(el.cells || []).flat()].filter(Boolean).join(' ');
}

/* ================================================================== */
/* Elementliste: Der Boardinhalt als Text, für Tastatur und Bildschirmleser */
/* ================================================================== */

const TYPE_NAMES = {
  chart: T('Diagramm'), sticky: T('Haftnotiz'), text: T('Text'), shape: T('Form'), connector: T('Verbindung'), image: T('Bild'), pen: T('Zeichnung'), highlighter: T('Markierung'),
  frame: T('Frame'), comment: T('Kommentar'), card: T('Karte'), table: T('Tabelle'), code: T('Code'), emoji: T('Emoji'), file: T('Datei'), mindmap: T('Mindmap-Knoten'),
};
const describeEl = (el) => {
  const text = (el.title || textOf(el) || '').trim().replace(/\s+/g, ' ').slice(0, 120);
  return `${TYPE_NAMES[el.type] || T('Element')}${text ? `: ${text}` : ''}`;
};

function openElementList() {
  const els = [...app.els.values()].filter((e) => !e.hidden).sort((a, b) => (a.y - b.y) || (a.x - b.x));
  const list = h('ul', { class: 'element-list' }, els.map((el) => h('li', {}, h('button', { class: 'btn block', onclick: () => {
    m.close();
    setSelection([el.id]);
    fitTo(bounds(el), { maxZ: 1.5, pad: 200 });
    stage.focus({ preventScroll: true }); // Pfeiltasten und Eingabe wirken jetzt auf das Element
  } }, describeEl(el)))));
  const m = modal(T('Elementliste'), h('div', { class: 'form' },
    h('p', { class: 'muted' }, els.length ? T('Wähle ein Element aus. Danach verschieben es die Pfeiltasten, Eingabe bearbeitet den Text, Entf löscht es.') : T('Dieses Board ist noch leer.')), list));
}

// Geänderte Auswahl ansagen: Das Board selbst ist eine Zeichenfläche ohne lesbare Struktur
function selectionAnnouncer() {
  const live = h('div', { class: 'sr-only', role: 'status', 'aria-live': 'polite' });
  document.body.append(live);
  app.on('selection', () => {
    const n = app.sel.size;
    const first = n === 1 ? getEl([...app.sel][0]) : null;
    live.textContent = !n ? '' : first ? T`Ausgewählt: ${describeEl(first)}` : T`${n} Elemente ausgewählt`;
  });
}
selectionAnnouncer();

export function openSearch() {
  searchBox.classList.remove('hidden');
  searchBox.innerHTML = '';
  const count = h('span', { class: 'muted small' });
  const input = h('input', { type: 'search', placeholder: T('Auf dem Board suchen …') });
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
    count.textContent = q ? T`${app.searchHits.length} Treffer` : '';
    scheduleRender(true);
    if (app.searchHits.length) go(1);
  });
  input.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') go(e.shiftKey ? -1 : 1);
    if (e.key === 'Escape') closeSearch();
  });
  searchBox.append(h('span', { html: ICONS.search, class: 'muted' }), input, count,
    iconBtn('chevUp', T('Vorheriger'), () => go(-1)), iconBtn('chevDown', T('Nächster'), () => go(1)), iconBtn('close', T('Schließen'), closeSearch));
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
    { label: T('Kopieren'), hint: T('Strg+C'), onClick: () => document.execCommand('copy') },
    { label: T('Duplizieren'), hint: T('Strg+D'), onClick: () => duplicateEls(collectForCopy([...app.sel])) },
    { label: T('In den Vordergrund'), hint: T('Strg+]'), onClick: bringToFront },
    { label: T('In den Hintergrund'), hint: T('Strg+['), onClick: sendToBack },
    { label: selectedEls().every((x) => x.locked) ? T('Entsperren') : T('Sperren'), hint: T('Strg+L'), onClick: toggleLock },
    app.isFacilitator ? { label: selectedEls().every((x) => x.modLock) ? T('Für Teilnehmende freigeben') : T('Für Teilnehmende sperren'), onClick: toggleModLock } : null,
    app.sel.size > 1 ? { label: T('Gruppieren'), hint: T('Strg+G'), onClick: groupSel } : null,
    selectedEls().some((x) => x.groupId) ? { label: T('Gruppierung aufheben'), onClick: ungroupSel } : null,
    { label: T('Kommentar hinzufügen'), onClick: () => newComment(w) },
    el && app.sel.size === 1 ? { label: T('Reagieren …'), onClick: () => app.emit('reactMenu', el, e) } : null,
    '-',
    { label: T('Löschen'), hint: T('Entf'), danger: true, onClick: () => deleteEls([...app.sel]) },
  ] : [
    { label: T('Sticky Note hier'), onClick: () => { const s = makeElement('sticky', w.x, w.y); addElements([s]); startEdit(s.id, { isNew: true }); } },
    { label: T('Text hier'), onClick: () => { const s = makeElement('text', w.x, w.y); act(() => setEl(s)); startEdit(s.id, { isNew: true }); } },
    { label: T('Kommentar hier'), onClick: () => newComment(w) },
    { label: T('Vorlage einfügen …'), onClick: openTemplates },
    '-',
    { label: T('Alles auswählen'), hint: T('Strg+A'), onClick: () => setSelection([...app.els.keys()]) },
    { label: T('Alles anzeigen'), hint: T('Umschalt+1'), onClick: () => fitAll() },
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
  const pct = h('button', { class: 'zoom-pct', title: T('Zoomstufe') }, '100 %');
  z.append(
    iconBtn('minus', T('Verkleinern (Strg −)'), () => zoomBy(1 / 1.25)),
    pct,
    iconBtn('plus', T('Vergrößern (Strg +)'), () => zoomBy(1.25)),
    iconBtn('fit', T('Alles anzeigen (Umschalt+1)'), () => fitAll()),
    iconBtn('layers', T('Minimap ein/aus'), () => {
      $('#minimap').classList.toggle('hidden');
      drawMinimap();
    }),
  );
  pct.onclick = () => menu(pct, [25, 50, 100, 150, 200, 400].map((p) => ({ label: p + ' %', onClick: () => {
    const r = stage.getBoundingClientRect();
    zoomAt(r.left + r.width / 2, r.top + r.height / 2, p / 100);
  } })).concat(['-', { label: T('Alles anzeigen'), onClick: () => fitAll() }]), { placement: 'top' });
  app.on('view', () => (pct.textContent = Math.round(app.view.z * 100) + ' %'));
}

/* ================================================================== */
/* Kopfzeile                                                           */
/* ================================================================== */

function buildTopbar() {
  const top = $('#topbar');
  const nameInput = h('input', { 'aria-label': T('Name des Boards'), id: 'board-name', type: 'text', value: app.name, title: T('Board umbenennen'), readonly: app.viewOnly });
  nameInput.addEventListener('change', () => {
    const n = nameInput.value.trim() || T('Unbenanntes Board');
    app.name = n;
    document.title = n + T(' – vibeboard');
    app.sync.op({ op: 'rename', name: n });
  });
  nameInput.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') nameInput.blur();
  });
  app.on('name', () => {
    nameInput.value = app.name;
    document.title = app.name + T(' – vibeboard');
  });
  const status = saveIndicator();
  append(top,
    h('a', { href: '/', class: 'icon-btn brand', title: T('Alle Boards'), html: '<svg viewBox="0 0 32 32" width="26" height="26"><rect x="2" y="2" width="28" height="28" rx="7" fill="#4262ff"/><rect x="8" y="8" width="9" height="9" rx="1.5" fill="#fff9b1"/><rect x="15" y="15" width="9" height="9" rx="1.5" fill="#ffcee0"/></svg>' }),
    nameInput, status,
    app.guest ? h('span', { class: 'badge guest', title: T('Du bist als Gast auf diesem Board') }, T('Gast')) : null,
    app.role === 'viewer' ? h('span', { class: 'badge' }, T('Nur ansehen')) : app.role === 'commenter' ? h('span', { class: 'badge', title: T('Du kannst ansehen und kommentieren') }, T('Kommentieren')) : null,
    h('span', { class: 'top-sep' }),
    app.viewOnly ? null : iconBtn('template', T('Vorlagen'), openTemplates),
    iconBtn('frame', T('Frames & Präsentation'), () => toggleSidePanel('frames'), { 'data-panel': 'frames' }),
    iconBtn('comment', T('Kommentare'), () => toggleSidePanel('comments'), { 'data-panel': 'comments' }),
    iconBtn('tasks', T('Aufgaben auf diesem Board'), () => toggleSidePanel('tasks'), { 'data-panel': 'tasks' }),
    iconBtn('kanban', T('Kanban und Zeitleiste'), () => app.emit('openCardViews')),
    app.guest ? null : iconBtn('check', T('Freigaben'), () => toggleSidePanel('reviews'), { 'data-panel': 'reviews' }),
    iconBtn('activity', T('Aktivität – wer hat was geändert?'), () => toggleSidePanel('activity'), { 'data-panel': 'activity' }),
    app.viewOnly ? null : iconBtn('history', T('Versionsverlauf'), () => toggleSidePanel('versions'), { 'data-panel': 'versions' }),
    iconBtn('search', T('Suchen (Strg+F)'), openSearch),
    iconBtn('list', T('Elementliste'), openElementList),
    iconBtn('download', T('Exportieren & Importieren'), (e) => openExportMenu(e.currentTarget)),
  );
  const right = $('#topright');
  // Die Leiste links darf rechts nichts verdecken: Passt nicht alles hinein, lässt sie sich waagerecht scrollen
  const fitTop = () => {
    const stacked = getComputedStyle(right).top !== getComputedStyle(top).top;
    top.style.maxWidth = stacked ? '' : `calc(100vw - ${right.offsetWidth + 44}px)`;
  };
  new ResizeObserver(fitTop).observe(right);
  addEventListener('resize', fitTop);
  const tools = h('div', { class: 'collab-tools' });
  append(right, tools, h('div', { id: 'avatars' }),
    app.guest ? null : bellButton({ open: (n) => app.emit('openNotification', n) }),
    app.guest ? null : h('button', { class: 'btn primary small share-btn', onclick: openShare }, h('span', { html: ICONS.share }), T('Teilen')),
    iconBtn('settings', T('Einstellungen'), (e) => openSettings(e.currentTarget)));
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
  const chip = h('span', { id: 'conn-status', class: 'save-chip connecting', role: 'group', 'aria-label': T('Speicherstatus'), tabindex: '0' }, dot, text);
  const live = h('span', { class: 'sr-only', role: 'status', 'aria-live': 'polite' });
  chip.append(live);
  let shown = null, prev = null, delay = null;
  const clock = (t) => new Date(t).toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' });
  const LABEL = {
    connecting: [T('Verbinde …'), T('Verbindung zum Server wird aufgebaut …')],
    offline: [T('Offline'), T('Keine Verbindung zum Server – wird automatisch wiederhergestellt. Änderungen werden gesendet, sobald die Verbindung steht.')],
    saving: [T('Wird gespeichert …'), T('Deine Änderungen werden gerade gespeichert.')],
    error: [T('Speichern verzögert'), T('Die letzten Änderungen sind noch nicht gespeichert – es wird automatisch erneut versucht. Bitte die Seite noch nicht schließen.')],
    saved: [T('Gespeichert'), T('Alle Änderungen sind auf dem Server gespeichert.')],
    live: [T('Verbunden'), T('Verbunden – du siehst Änderungen anderer live.')],
  };
  const paint = (st) => {
    let kind = st.state;
    if (kind === 'saved' && app.viewOnly && !app.canComment) kind = 'live';
    shown = kind;
    chip.className = 'save-chip ' + kind;
    let [label, title] = LABEL[kind];
    if (kind === 'offline' && st.pending) label = T`Offline – ${st.pending} ausstehend`;
    if (kind === 'saved' && st.at) title += T` Zuletzt gespeichert um ${clock(st.at)} Uhr.`;
    text.textContent = label;
    chip.title = title;
    chip.setAttribute('aria-label', title);
    // Ansage nur bei wichtigen Wechseln: Verbindung/Speichern gestört und wieder in Ordnung
    const bad = kind === 'offline' || kind === 'error';
    if (kind !== prev && (bad || ((kind === 'saved' || kind === 'live') && (prev === 'offline' || prev === 'error')))) {
      live.textContent = bad ? title : T('Alle Änderungen gespeichert.');
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
    iconBtn('undo', T('Rückgängig (Strg+Z)'), undo, { id: 'btn-undo', disabled: true }),
    iconBtn('redo', T('Wiederholen (Strg+Y)'), redo, { id: 'btn-redo', disabled: true }),
    h('span', { class: 'top-sep' }),
    iconBtn('keyboard', T('Tastenkürzel'), openShortcuts),
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
