// Ergänzungen im Board: Reaktionen auf Elemente, Schlagwörter und Filteransicht, verborgene Bereiche,
// Speichern als eigene Vorlage
import { T, LOCALE } from './i18n.js';
import { h, api, ICONS, toast, modal } from './util.js';
import { app, getEl, act, updateEl, rerenderAll, collectForCopy, $ } from './core.js';
import { popover, closePop, showSidePanel, toggleSidePanel, currentSidePanel, renderSidePanel } from './ui.js';
import { REACTIONS, cardTags } from './render.js';

const REACT_TYPES = new Set(['sticky', 'card', 'shape', 'text', 'image', 'file', 'code', 'table']);

/* ================================================================== */
/* Reaktionen                                                          */
/* ================================================================== */

function react(el, emoji) {
  app.sync.op({ op: 'react', id: el.id, emoji });
}

function reactPicker(anchor, el) {
  popover(anchor, h('div', { class: 'react-row' }, REACTIONS.map((r) => h('button', {
    class: 'emoji-btn' + (el.reactions && el.reactions[r] && el.reactions[r][String(app.user.id)] ? ' active' : ''), title: T('Reagieren mit ') + r,
    onclick: () => {
      react(el, r);
      closePop();
    },
  }, r))));
}

app.on('reactMenu', (el, e) => {
  if (!REACT_TYPES.has(el.type)) return;
  // Unsichtbarer Anker an der Mausposition
  const a = h('span', { style: { position: 'fixed', left: e.clientX + 'px', top: e.clientY + 'px', width: '1px', height: '1px' } });
  document.body.append(a);
  reactPicker(a, el);
  setTimeout(() => a.remove(), 0);
});

// Klick auf eine Reaktion schaltet die eigene an oder ab
$('#stage').addEventListener('click', (e) => {
  const chip = e.target.closest && e.target.closest('.reaction-chip');
  const g = chip && chip.closest('g[data-id]');
  const el = g && getEl(g.dataset.id);
  if (el) react(el, chip.dataset.emoji);
});

/* ================================================================== */
/* Schlagwörter                                                        */
/* ================================================================== */

function allTags() {
  const set = new Map();
  for (const el of app.els.values()) for (const t of cardTags(el)) set.set(t.toLowerCase(), t);
  return [...set.values()].sort((a, b) => a.localeCompare(b, LOCALE));
}

function tagEditor(anchor, sel) {
  const common = cardTags(sel[0]).filter((t) => sel.every((e) => cardTags(e).includes(t)));
  const input = h('input', { type: 'text', value: common.join(', '), placeholder: T('z. B. Bug, Idee, Prozess'), 'aria-label': T('Schlagwörter, durch Komma getrennt') });
  const save = (list) => {
    const tags = [...new Set(list.map((t) => t.trim()).filter(Boolean))].slice(0, 8);
    act(() => sel.forEach((e) => updateEl(e.id, { tags: [...new Set([...cardTags(e).filter((t) => !common.includes(t)), ...tags])].slice(0, 8) })));
  };
  const known = allTags().filter((t) => !common.includes(t)).slice(0, 20);
  popover(anchor, h('form', { class: 'tag-pop', onsubmit: (e) => {
    e.preventDefault();
    save(input.value.split(','));
    closePop();
  } },
  h('div', { class: 'pop-title' }, T('Schlagwörter')),
  input,
  known.length ? h('div', { class: 'tag-chips' }, known.map((t) => h('button', { type: 'button', class: 'tag-chip', onclick: () => {
    input.value = [...input.value.split(',').map((x) => x.trim()).filter(Boolean), t].join(', ');
  } }, '+ ' + t))) : null,
  h('div', { class: 'row' }, h('span', { class: 'muted small' }, T('Bis zu 8, durch Komma getrennt')), h('span', { class: 'spacer' }), h('button', { type: 'submit', class: 'btn small primary' }, T('Übernehmen')))), { placement: 'top' });
  setTimeout(() => input.focus(), 0);
}

/* ================================================================== */
/* Filter: nicht passende Elemente abblenden (nur in der eigenen Ansicht) */
/* ================================================================== */

const filter = { tags: new Set(), colors: new Set(), authors: new Set(), reactions: false, actions: false };
const active = () => filter.tags.size || filter.colors.size || filter.authors.size || filter.reactions || filter.actions;

function matches(el) {
  if (filter.tags.size && !cardTags(el).some((t) => filter.tags.has(t.toLowerCase()))) return false;
  if (filter.colors.size && !filter.colors.has(String(el.fill || el.color || '').toLowerCase())) return false;
  if (filter.authors.size && !(el.author && !el.anon && filter.authors.has(el.author))) return false;
  if (filter.reactions && !(el.reactions && Object.keys(el.reactions).length)) return false;
  if (filter.actions && !(el.type === 'card' && el.action)) return false;
  return true;
}

function applyFilter() {
  app.filter = active() ? matches : null;
  document.getElementById('btn-filter')?.classList.toggle('active', !!app.filter);
  rerenderAll();
  renderFilterBanner();
}

const fbanner = h('div', { id: 'filter-banner', class: 'panel chrome hidden', role: 'status' });
document.body.append(fbanner);

function renderFilterBanner() {
  fbanner.classList.toggle('hidden', !app.filter);
  if (!app.filter) return;
  const list = [...app.els.values()].filter((e) => !['frame', 'connector'].includes(e.type) && !e.hidden);
  const n = list.filter(matches).length;
  fbanner.innerHTML = '';
  fbanner.append(h('span', { html: ICONS.filter }), h('span', {}, h('b', {}, T('Filter aktiv')), T` · ${n} von ${list.length} Elementen passen`),
    h('button', { class: 'btn small', onclick: () => showSidePanel('filter') }, T('Ändern')),
    h('button', { class: 'btn small', onclick: reset }, T('Aufheben')));
}

function reset() {
  filter.tags.clear();
  filter.colors.clear();
  filter.authors.clear();
  filter.reactions = false;
  filter.actions = false;
  applyFilter();
  if (currentSidePanel() === 'filter') renderSidePanel();
}

app.on('renderPanel', (kind, side, close) => {
  if (kind !== 'filter') return;
  side.append(h('div', { class: 'side-head' }, h('h3', {}, T('Filter')), h('span', { class: 'spacer' }), close));
  side.append(h('p', { class: 'muted pad small' }, T('Blendet nicht passende Elemente ab – nur in deiner Ansicht. Innerhalb einer Gruppe genügt ein Treffer, zwischen den Gruppen müssen alle passen.')));
  const toggle = (set, key) => {
    if (set.has(key)) set.delete(key);
    else set.add(key);
    applyFilter();
    renderSidePanel();
  };
  const tags = allTags();
  side.append(h('div', { class: 'filter-group' }, h('div', { class: 'label' }, T('Schlagwörter')),
    tags.length ? h('div', { class: 'tag-chips' }, tags.map((t) => h('button', { class: 'tag-chip' + (filter.tags.has(t.toLowerCase()) ? ' active' : ''), 'aria-pressed': String(filter.tags.has(t.toLowerCase())), onclick: () => toggle(filter.tags, t.toLowerCase()) }, t)))
      : h('p', { class: 'muted small' }, T('Noch keine Schlagwörter. Sticky Note auswählen → Etikett-Symbol.'))));
  const colors = [...new Set([...app.els.values()].filter((e) => e.type === 'sticky' && !e.hidden).map((e) => String(e.fill || '#fff9b1').toLowerCase()))];
  if (colors.length) {
    side.append(h('div', { class: 'filter-group' }, h('div', { class: 'label' }, T('Farbe (Sticky Notes)')),
      h('div', { class: 'tag-chips' }, colors.map((c) => h('button', { class: 'swatch' + (filter.colors.has(c) ? ' active' : ''), title: c, 'aria-pressed': String(filter.colors.has(c)), style: { background: c }, onclick: () => toggle(filter.colors, c) })))));
  }
  const authors = [...new Set([...app.els.values()].filter((e) => e.author && !e.anon && !e.hidden).map((e) => e.author))].sort();
  if (authors.length) {
    side.append(h('div', { class: 'filter-group' }, h('div', { class: 'label' }, T('Erstellt von')),
      h('div', { class: 'tag-chips' }, authors.map((a) => h('button', { class: 'tag-chip' + (filter.authors.has(a) ? ' active' : ''), onclick: () => toggle(filter.authors, a) }, a)))));
  }
  side.append(h('div', { class: 'filter-group' }, h('div', { class: 'label' }, T('Weitere')),
    h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: filter.reactions, onchange: (e) => { filter.reactions = e.target.checked; applyFilter(); renderSidePanel(); } }), T('Nur mit Reaktionen')),
    h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: filter.actions, onchange: (e) => { filter.actions = e.target.checked; applyFilter(); renderSidePanel(); } }), T('Nur Maßnahmen'))));
  if (active()) side.append(h('div', { class: 'side-actions' }, h('button', { class: 'btn small', onclick: reset }, T('Filter aufheben'))));
});

app.on('render', () => app.filter && renderFilterBanner());

app.on('buildCollabTools', (box) => {
  const b = h('button', { class: 'icon-btn', id: 'btn-filter', title: T('Filter (Schlagwörter, Farbe, Person)'), html: ICONS.filter, 'data-panel': 'filter', onclick: () => toggleSidePanel('filter') });
  box.append(b);
});

/* ================================================================== */
/* Kontextleiste: Schlagwörter, Reaktion, verborgener Bereich          */
/* ================================================================== */

app.on('ctxItems', (items, sel, { locked, one, actBtn, toggleBtn }) => {
  if (!locked && sel.length && sel.every((e) => e.type === 'sticky' || e.type === 'card' || e.type === 'shape')) {
    const tb = actBtn('tag', T('Schlagwörter'), () => tagEditor(tb, sel));
    items.push(tb);
  }
  if (one && REACT_TYPES.has(one.type)) {
    const rb = actBtn('smile', T('Reagieren'), () => reactPicker(rb, one));
    items.push(rb);
  }
  if (one && one.type === 'frame' && app.isFacilitator) {
    items.push(toggleBtn('eyeOff', !!one.concealed, one.concealed ? T('Bereich für Teilnehmende aufdecken') : T('Bereich für Teilnehmende verbergen'), () => {
      act(() => updateEl(one.id, { concealed: !one.concealed || undefined }));
      toast(one.concealed ? T('Bereich aufgedeckt – alle sehen den Inhalt') : T('Bereich verborgen – nur Moderierende sehen den Inhalt'), 3500);
    }));
  }
});

/* ================================================================== */
/* Als eigene Vorlage speichern                                        */
/* ================================================================== */

app.on('saveTemplate', async (selectionOnly) => {
  const els = selectionOnly ? collectForCopy([...app.sel]) : [...app.els.values()];
  const usable = els.filter((e) => !e.hidden && !e.priv && !['comment', 'file'].includes(e.type));
  if (!usable.length) return toast(T('Nichts zum Speichern – Kommentare und Dateianhänge werden nicht in Vorlagen übernommen.'));
  let teams = [];
  try {
    teams = (await api('/api/teams')).teams;
  } catch {}
  const name = h('input', { type: 'text', required: true, maxlength: 80, value: selectionOnly ? '' : app.name });
  const desc = h('input', { type: 'text', maxlength: 200, placeholder: T('Wofür ist die Vorlage gedacht?') });
  const icon = h('input', { type: 'text', maxlength: 4, value: '⭐', style: { width: '64px' } });
  const scope = h('select', {}, h('option', { value: '' }, T('Nur für mich')), teams.map((t) => h('option', { value: t.id }, T`Team „${t.name}“`)));
  const form = h('form', { class: 'form', onsubmit: async (e) => {
    e.preventDefault();
    try {
      // Inhalte ohne Autorschaft, Reaktionen und Zuweisungen speichern
      const clean = usable.map(({ reactions, author, anon, task, modLock, concealed, ...rest }) => rest);
      await api('/api/templates', { method: 'POST', body: { name: name.value.trim(), description: desc.value.trim(), icon: icon.value.trim(), teamId: scope.value || null, elements: clean } });
      m.close();
      toast(T`Vorlage „${name.value.trim()}“ gespeichert – sie erscheint in der Vorlagengalerie unter „Eigene Vorlagen“`, 4500);
    } catch (ex) {
      toast(ex.message, 5000);
    }
  } },
  h('p', { class: 'muted' }, T`Elemente: ${usable.length}. Kommentare, Dateianhänge, Reaktionen und Namen der Autorinnen und Autoren werden nicht übernommen.`),
  h('div', { class: 'form-row' }, h('label', {}, T('Name'), name), h('label', {}, T('Symbol'), icon)),
  h('label', {}, T('Beschreibung'), desc),
  h('label', {}, T('Sichtbar für'), scope),
  h('div', { class: 'form-actions' }, h('button', { type: 'button', class: 'btn', onclick: () => m.close() }, T('Abbrechen')), h('button', { type: 'submit', class: 'btn primary' }, T('Vorlage speichern'))));
  const m = modal(selectionOnly ? T('Auswahl als Vorlage speichern') : T('Board als Vorlage speichern'), form);
  setTimeout(() => name.focus(), 0);
});
