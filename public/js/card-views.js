// Kanban und Zeitleiste: andere Ansichten derselben Karten. Jede Änderung landet direkt am Element auf dem Board.
import { T, LOCALE } from './i18n.js';
import { h, modal, toast, initials, readableOn, throttle } from './util.js';
import { app, getEl, act, updateEl, bounds, fitTo, setSelection, isLocked } from './core.js';
import { DONE_RE } from './planning.js';

const DAY = 86400000;
const NO_STATUS = '';
let view = 'kanban';

const cards = () => [...app.els.values()].filter((e) => e.type === 'card' && !e.hidden);
const statusOf = (c) => String(c.status || '').trim();
const signature = () => JSON.stringify(cards().map((c) => [c.id, c.title, c.status, c.assignee, c.start, c.due, c.color, c.key]));

function columns(list, extra) {
  const seen = [...new Set(list.map(statusOf))];
  const named = [...new Set([...seen.filter(Boolean), ...extra])];
  const open = named.filter((s) => !DONE_RE.test(s));
  const done = named.filter((s) => DONE_RE.test(s));
  return [...(seen.includes(NO_STATUS) ? [NO_STATUS] : []), ...open, ...done];
}

function jump(id, close) {
  const el = getEl(id);
  if (!el) return;
  close();
  setSelection([id]);
  fitTo(bounds(el), { maxZ: 1.5, pad: 200 });
}

const setStatus = (id, status) => act(() => updateEl(id, { status: status || undefined }));

function kanban(close, added, rerender) {
  const list = cards();
  const cols = columns(list, added);
  if (!cols.length) cols.push(NO_STATUS);
  const board = h('div', { class: 'kanban' });
  for (const col of cols) {
    const inCol = list.filter((c) => statusOf(c) === col);
    const body = h('div', { class: 'kanban-body' });
    for (const c of inCol) {
      const move = h('select', { 'aria-label': T`Status von „${c.title || T('Neue Karte')}“`, disabled: readOnly(c), onchange: (e) => setStatus(c.id, e.target.value) },
        cols.map((s) => h('option', { value: s, selected: s === col }, s || T('Ohne Status'))));
      const card = h('article', { class: 'kanban-card', draggable: readOnly(c) ? null : 'true', style: { borderTopColor: c.color || '#4262ff' } },
        c.key ? h('div', { class: 'muted small' }, c.key) : null,
        h('button', { class: 'kanban-title', title: T('Auf dem Board zeigen'), onclick: () => jump(c.id, close) }, c.title || T('Neue Karte')),
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
    const column = h('section', { class: 'kanban-col', 'aria-label': col || T('Ohne Status') },
      h('h3', {}, col || T('Ohne Status'), ' ', h('span', { class: 'muted small' }, inCol.length)), body);
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
  }
  if (!app.viewOnly) {
    const input = h('input', { type: 'text', placeholder: T('Neue Spalte'), 'aria-label': T('Neue Spalte'), maxlength: 40 });
    board.append(h('form', { class: 'kanban-add', onsubmit: (e) => {
      e.preventDefault();
      const v = input.value.trim();
      if (v && !added.includes(v)) added.push(v);
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
    const start = h('input', { type: 'date', value: c.start || '', disabled: readOnly(c), 'aria-label': T`Beginn von „${c.title || T('Neue Karte')}“`, onchange: (e) => dates({ start: e.target.value || undefined }, start) });
    const due = h('input', { type: 'date', value: c.due || '', disabled: readOnly(c), 'aria-label': T`Fälligkeit von „${c.title || T('Neue Karte')}“`, onchange: (e) => dates({ due: e.target.value }, due) });
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
    }
    rows.append(h('div', { class: 'tl-row' },
      h('button', { class: 'tl-name', title: T('Auf dem Board zeigen'), onclick: () => jump(c.id, close) }, c.title || T('Neue Karte')), start, due, track));
  }
  return h('div', { class: 'timeline' }, list.length ? null : h('p', { class: 'muted pad' }, T('Auf diesem Board gibt es noch keine Karten.')),
    h('div', { class: 'tl-scroll' }, h('div', { class: 'tl-head' }, h('span', {}, T('Karte')), h('span', {}, T('Beginn')), h('span', {}, T('Fällig am')), head), rows));
}

app.on('openCardViews', () => {
  const body = h('div', { class: 'card-views' });
  const added = [];
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
    const label = document.activeElement?.getAttribute?.('aria-label');
    body.innerHTML = '';
    body.append(h('div', { class: 'row', role: 'tablist', 'aria-label': T('Ansicht') }, tab('kanban', T('Kanban')), tab('timeline', T('Zeitleiste'))),
      h('div', { id: 'view-panel', role: 'tabpanel', 'aria-labelledby': 'view-tab-' + view, class: 'view-panel' }, view === 'kanban' ? kanban(() => m.close(), added, render) : timeline(() => m.close())));
    const next = body.querySelector('.kanban, .tl-scroll');
    if (next && pos) [next.scrollLeft, next.scrollTop] = pos;
    if (label) [...body.querySelectorAll('[aria-label]')].find((e) => e.getAttribute('aria-label') === label)?.focus();
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
