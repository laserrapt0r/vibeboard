// Kanban und Zeitleiste: andere Ansichten derselben Karten. Jede Änderung landet direkt am Element auf dem Board.
import { T, LOCALE } from './i18n.js';
import { h, modal, toast, initials, readableOn, throttle, columnName, SVGNS } from './util.js';
import { app, getEl, act, updateEl, bounds, fitTo, setSelection, isLocked, boardColumns, cardToColumn, addBoardColumn, addCardToColumn, cardBlockers } from './core.js';
import { DONE_RE } from './planning.js';

const DAY = 86400000;
const NO_STATUS = '';
let view = 'kanban';

const cards = () => [...app.els.values()].filter((e) => e.type === 'card' && !e.hidden);
const statusOf = (c) => String(c.status || '').trim();
const signature = () => JSON.stringify([boardColumns(), cards().map((c) => [c.id, c.title, c.status, c.assignee, c.start, c.due, c.color, c.key, c.points, c.blockedBy])]);

// Spalten des Boards in dessen Reihenfolge, dahinter alles andere: offen vor erledigt
function columns(list, onBoard, extra) {
  const seen = [...new Set(list.map(statusOf))];
  const named = [...new Set([...seen.filter(Boolean), ...extra])].filter((s) => !onBoard.includes(s));
  const open = named.filter((s) => !DONE_RE.test(s));
  const done = named.filter((s) => DONE_RE.test(s));
  return [...(seen.includes(NO_STATUS) ? [NO_STATUS] : []), ...new Set(onBoard), ...open, ...done];
}

function jump(id, close) {
  const el = getEl(id);
  if (!el) return;
  close();
  setSelection([id]);
  fitTo(bounds(el), { maxZ: 1.5, pad: 200 });
}

const setStatus = (id, status) => act(() => {
  updateEl(id, { status: status || undefined });
  if (status) cardToColumn(id, status);
});

// Nur Zahlen zählen: T-Shirt-Größen und „?“ lassen sich nicht addieren. Ohne Zahlen gibt es keine Summe.
function pointsSum(list) {
  const nums = list.map((c) => Number(String(c.points ?? '').trim().replace(',', '.'))).filter((n, i) => String(list[i].points ?? '').trim() && Number.isFinite(n));
  return nums.length ? Math.round(nums.reduce((s, n) => s + n, 0) * 100) / 100 : null;
}

const blockedText = (list) => T`Blockiert durch: ${list.map((c) => c.title || T('Neue Karte')).join(', ')}`;
const stillBlocked = (list) => list.some((c) => !DONE_RE.test(statusOf(c)));

function kanban(close, added, rerender, adding) {
  const list = cards();
  // Spalten des Boards bleiben auch leer erhalten, sonst ließe sich eine Karte nicht zurückschieben
  const onBoard = boardColumns();
  const cols = columns(list, onBoard, added);
  if (!cols.length) cols.push(NO_STATUS);
  const board = h('div', { class: 'kanban' });
  cols.forEach((col, index) => {
    const inCol = list.filter((c) => statusOf(c) === col);
    const body = h('div', { class: 'kanban-body' });
    for (const c of inCol) {
      const by = cardBlockers(c);
      const move = h('select', { 'data-focus': c.id + ':status', 'aria-label': T`Status von „${c.title || T('Neue Karte')}“`, disabled: readOnly(c), onchange: (e) => setStatus(c.id, e.target.value) },
        cols.map((s) => h('option', { value: s, selected: s === col }, s || T('Ohne Status'))));
      const card = h('article', { class: 'kanban-card', draggable: readOnly(c) ? null : 'true', style: { borderTopColor: c.color || '#4262ff' } },
        c.key ? h('div', { class: 'muted small' }, c.key) : null,
        h('button', { 'data-focus': c.id + ':title', class: 'kanban-title', title: T('Auf dem Board zeigen'), onclick: () => jump(c.id, close) }, c.title || T('Neue Karte')),
        by.length ? h('div', { class: 'kanban-blocked' + (stillBlocked(by) ? ' open' : '') }, blockedText(by)) : null,
        h('div', { class: 'kanban-meta' },
          c.assignee ? h('span', { class: 'avatar xs', title: c.assignee }, initials(c.assignee)) : null,
          c.due ? h('span', { class: 'muted small' }, new Date(c.due + 'T00:00').toLocaleDateString(LOCALE)) : null,
          h('span', { class: 'spacer' }),
          readOnly(c) ? null : h('button', { class: 'btn small', onclick: () => app.emit('editCard', c.id) }, T('Bearbeiten'))),
        move);
      card.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/x-card', c.id);
        e.dataTransfer.effectAllowed = 'move';
      });
      body.append(card);
    }
    const name = col || T('Ohne Status');
    const sum = pointsSum(inCol);
    const newCard = () => {
      adding.add(col);
      rerender();
      document.querySelector(`[data-focus="new:${index}"]`)?.focus();
    };
    const input = h('input', { type: 'text', 'data-focus': 'new:' + index, 'data-own-esc': '1', maxlength: 200, placeholder: T('Titel der Karte'), 'aria-label': T`Titel der neuen Karte in „${name}“`, onkeydown: (e) => {
      if (e.key !== 'Escape') return;
      adding.delete(col);
      rerender();
      document.querySelector(`[data-focus="plus:${index}"]`)?.focus();
    } });
    const quick = adding.has(col) && !app.viewOnly ? h('form', { class: 'kanban-new', onsubmit: (e) => {
      e.preventDefault();
      const title = input.value.trim();
      if (title) addCardToColumn(title, col);
      else adding.delete(col);
      // Der Fokus bleibt im Feld, so entstehen mehrere Karten hintereinander
      rerender();
    } }, input, h('button', { class: 'btn small', type: 'submit' }, T('Anlegen'))) : null;
    const column = h('section', { class: 'kanban-col', 'aria-label': name },
      h('div', { class: 'kanban-head' }, h('h3', {}, name, ' ', h('span', { class: 'muted small' }, inCol.length)),
        sum === null ? null : h('span', { class: 'kanban-points', title: T`Summe der Story Points: ${sum.toLocaleString(LOCALE)}` }, `Σ ${sum.toLocaleString(LOCALE)}`),
        h('span', { class: 'spacer' }),
        app.viewOnly ? null : h('button', { class: 'icon-btn small kanban-plus', 'data-focus': 'plus:' + index, title: T`Karte in „${name}“ anlegen`, onclick: newCard }, '+')),
      !inCol.length && added.includes(col) ? h('p', { class: 'muted small' }, T('Vorläufig: Die Spalte bleibt nur, wenn eine Karte in ihr liegt.')) : null, body, quick);
    if (!app.viewOnly) {
      column.addEventListener('dragenter', (e) => e.preventDefault());
      column.addEventListener('dragover', (e) => {
        e.preventDefault();
        column.classList.add('over');
      });
      column.addEventListener('dragleave', (e) => {
        if (!column.contains(e.relatedTarget)) column.classList.remove('over');
      });
      column.addEventListener('drop', (e) => {
        e.preventDefault();
        column.classList.remove('over');
        const id = e.dataTransfer.getData('text/x-card');
        const target = id && getEl(id);
        if (target && !isLocked(target) && statusOf(target) !== col) setStatus(id, col);
      });
    }
    board.append(column);
  });
  if (!app.viewOnly) {
    const input = h('input', { type: 'text', placeholder: T('Neue Spalte'), 'aria-label': T('Neue Spalte'), maxlength: 40 });
    board.append(h('form', { class: 'kanban-add', onsubmit: (e) => {
      e.preventDefault();
      // Der Name steht so auch in der Überschrift: Zusätze nach „·“ zählen dort nicht
      const v = columnName(input.value);
      const same = cols.find((s) => s.toLowerCase() === v.toLowerCase());
      if (v && !onBoard.some((s) => s.toLowerCase() === v.toLowerCase()) && !addBoardColumn(same || v) && !same) added.push(v);
      rerender();
      document.querySelector('.kanban-add input')?.focus();
    } }, input, h('button', { class: 'btn small', type: 'submit' }, T('Hinzufügen'))));
  }
  return board;
}

const readOnly = (c) => app.viewOnly || isLocked(c);
const toDay = (s) => Math.floor(new Date(s + 'T12:00Z').getTime() / DAY);
const fromDay = (d) => new Date(d * DAY).toISOString().slice(0, 10);

function timeline(close) {
  const list = cards().sort((a, b) => String(a.start || a.due || '9999').localeCompare(String(b.start || b.due || '9999')));
  const dated = list.flatMap((c) => [c.start, c.due]).filter(Boolean).map(toDay);
  const today = Math.floor(Date.now() / DAY);
  const first = (dated.length ? Math.min(...dated, today) : today) - 3;
  const last = (dated.length ? Math.max(...dated, today) : today + 30) + 7;
  const days = last - first + 1;
  const dayW = Math.max(8, Math.min(36, 900 / days));
  const width = days * dayW;
  const head = h('div', { class: 'tl-months', style: { width: width + 'px' } });
  for (let d = first; d <= last; d++) {
    const date = new Date(d * DAY);
    if (date.getUTCDate() === 1 || d === first) {
      head.append(h('span', { style: { left: (d - first) * dayW + 'px' } }, date.toLocaleDateString(LOCALE, { month: 'short', year: 'numeric', timeZone: 'UTC' })));
    }
  }
  const rows = h('div', { class: 'tl-rows' });
  const bars = new Map();
  for (const c of list) {
    const dates = (patch, input) => {
      const s = 'start' in patch ? patch.start : c.start, d = 'due' in patch ? patch.due : c.due;
      if (s && d && s > d) {
        toast(T('Der Beginn muss vor der Fälligkeit liegen.'));
        input.value = input === start ? c.start || '' : c.due || '';
        return;
      }
      act(() => updateEl(c.id, patch));
    };
    const start = h('input', { 'data-focus': c.id + ':start', type: 'date', value: c.start || '', disabled: readOnly(c), 'aria-label': T`Beginn von „${c.title || T('Neue Karte')}“`, onblur: (e) => e.target.value !== (c.start || '') && dates({ start: e.target.value || undefined }, start) });
    const due = h('input', { 'data-focus': c.id + ':due', type: 'date', value: c.due || '', disabled: readOnly(c), 'aria-label': T`Fälligkeit von „${c.title || T('Neue Karte')}“`, onblur: (e) => e.target.value !== (c.due || '') && dates({ due: e.target.value }, due) });
    const track = h('div', { class: 'tl-track', style: { width: width + 'px' } }, h('span', { class: 'tl-today', style: { left: (today - first) * dayW + 'px' } }));
    const a = c.start || c.due, b = c.due || c.start;
    if (a) {
      const from = toDay(a), to = Math.max(from, toDay(b));
      const color = c.color || '#4262ff';
      const bar = h('div', { class: 'tl-bar', title: `${a} – ${b}`, style: { left: (from - first) * dayW + 'px', width: Math.max(dayW, (to - from + 1) * dayW) + 'px', background: color, color: readableOn(color) } }, c.title || '');
      if (!readOnly(c)) {
        const grip = h('span', { class: 'tl-grip' });
        bar.append(grip);
        // Ziehen verschiebt die Karte, der rechte Griff ändert nur die Fälligkeit
        bar.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          const end = e.target === grip;
          const x0 = e.clientX;
          bar.setPointerCapture(e.pointerId);
          let shift = 0;
          const move = (ev) => {
            shift = Math.round((ev.clientX - x0) / dayW);
            if (end) bar.style.width = Math.max(dayW, (Math.max(from, to + shift) - from + 1) * dayW) + 'px';
            else bar.style.left = (from + shift - first) * dayW + 'px';
          };
          const up = () => {
            bar.removeEventListener('pointermove', move);
            if (!shift) return;
            if (end) act(() => updateEl(c.id, { due: fromDay(Math.max(from, to + shift)) }));
            else act(() => updateEl(c.id, { ...(c.start ? { start: fromDay(from + shift) } : {}), ...(c.due ? { due: fromDay(toDay(c.due) + shift) } : {}) }));
          };
          bar.addEventListener('pointermove', move);
          bar.addEventListener('pointerup', up, { once: true });
        });
      }
      track.append(bar);
      bars.set(c.id, bar);
    }
    const by = cardBlockers(c);
    rows.append(h('div', { class: 'tl-row' },
      h('button', { class: 'tl-name', title: T('Auf dem Board zeigen'), onclick: () => jump(c.id, close) },
        by.length ? h('span', { class: 'tl-blocked', role: 'img', title: blockedText(by), 'aria-label': blockedText(by) }, stillBlocked(by) ? '⛔ ' : '☑ ') : null, c.title || T('Neue Karte')), start, due, track));
  }
  // Die Lage der Balken steht erst fest, wenn die Zeilen im Dialog liegen
  requestAnimationFrame(() => drawLinks(rows, list, bars));
  return h('div', { class: 'timeline' }, list.length ? null : h('p', { class: 'muted pad' }, T('Auf diesem Board gibt es noch keine Karten.')),
    h('div', { class: 'tl-scroll' }, h('div', { class: 'tl-head' }, h('span', {}, T('Karte')), h('span', {}, T('Beginn')), h('span', {}, T('Fällig am')), head), rows));
}

// Pfeile vom Ende der blockierenden Karte zum Beginn der blockierten. Startet sie zu früh, wird der Pfeil rot.
function drawLinks(rows, list, bars) {
  if (!rows.isConnected) return;
  const box = rows.getBoundingClientRect();
  const svg = document.createElementNS(SVGNS, 'svg');
  svg.setAttribute('class', 'tl-links');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('width', rows.scrollWidth);
  svg.setAttribute('height', rows.scrollHeight);
  const tip = (id) => {
    const m = document.createElementNS(SVGNS, 'marker');
    for (const [k, v] of Object.entries({ id, viewBox: '0 0 8 8', refX: 7, refY: 4, markerWidth: 7, markerHeight: 7, orient: 'auto' })) m.setAttribute(k, v);
    const p = document.createElementNS(SVGNS, 'path');
    p.setAttribute('d', 'M0,0 L8,4 L0,8 Z');
    m.append(p);
    return m;
  };
  svg.append(tip('tl-tip'), tip('tl-tip-late'));
  for (const c of list) {
    const to = bars.get(c.id);
    for (const b of cardBlockers(c)) {
      const from = bars.get(b.id);
      if (!from || !to) continue;
      const r1 = from.getBoundingClientRect(), r2 = to.getBoundingClientRect();
      const x1 = r1.right - box.left, y1 = r1.top + r1.height / 2 - box.top;
      const x2 = r2.left - box.left, y2 = r2.top + r2.height / 2 - box.top;
      const late = x2 < x1 + 16;
      const d = late ? `M${x1},${y1} h8 V${(y1 + y2) / 2} H${x2 - 8} V${y2} H${x2}` : `M${x1},${y1} H${x2 - 8} V${y2} H${x2}`;
      const path = document.createElementNS(SVGNS, 'path');
      path.setAttribute('d', d);
      path.setAttribute('class', 'tl-link' + (late ? ' late' : ''));
      path.setAttribute('marker-end', `url(#${late ? 'tl-tip-late' : 'tl-tip'})`);
      path.dataset.from = b.id;
      path.dataset.to = c.id;
      svg.append(path);
    }
  }
  rows.append(svg);
}

app.on('openCardViews', () => {
  const body = h('div', { class: 'card-views' });
  const added = [];
  const adding = new Set();
  let sig = '';
  const show = (id) => {
    view = id;
    render();
    body.querySelector('[aria-selected=true]')?.focus();
  };
  const tab = (id, label) => h('button', { role: 'tab', id: 'view-tab-' + id, 'aria-selected': String(view === id), 'aria-controls': 'view-panel', tabindex: view === id ? '0' : '-1', class: 'tpl-cat' + (view === id ? ' active' : ''), onclick: () => show(id),
    onkeydown: (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      show(view === 'kanban' ? 'timeline' : 'kanban');
    } }, label);
  const render = () => {
    sig = signature();
    const scroller = body.querySelector('.kanban, .tl-scroll');
    const pos = scroller ? [scroller.scrollLeft, scroller.scrollTop] : null;
    // Nach dem Neuaufbau bleibt der Fokus auf demselben Feld
    const ae = document.activeElement;
    const key = ae && body.contains(ae) ? ae.dataset.focus || (ae.getAttribute('role') === 'tab' ? 'tab' : 'other') : null;
    body.innerHTML = '';
    body.append(h('div', { class: 'row', role: 'tablist', 'aria-label': T('Ansicht') }, tab('kanban', T('Kanban')), tab('timeline', T('Zeitleiste'))),
      h('div', { id: 'view-panel', role: 'tabpanel', 'aria-labelledby': 'view-tab-' + view, class: 'view-panel' }, view === 'kanban' ? kanban(() => m.close(), added, render, adding) : timeline(() => m.close())));
    const next = body.querySelector('.kanban, .tl-scroll');
    if (next && pos) [next.scrollLeft, next.scrollTop] = pos;
    if (key) (body.querySelector(`[data-focus="${key}"]`) || body.querySelector('[aria-selected=true]'))?.focus();
  };
  const m = modal(T('Kanban und Zeitleiste'), body, { wide: true, onClose: () => app.off?.('render', watch) });
  m.box.classList.add('views');
  render();
  // Änderungen anderer erscheinen sofort, außer es wird gerade ein Feld bearbeitet
  const watch = throttle(() => {
    if (!body.isConnected || signature() === sig) return;
    // Beim Tippen in ein Feld nicht dazwischenfunken; der Stand folgt, sobald es verlassen wird
    const ae = document.activeElement;
    if (ae && body.contains(ae) && ae.tagName === 'INPUT') return;
    render();
  }, 500);
  app.on('render', watch);
  body.addEventListener('focusout', () => setTimeout(watch, 0));
});
