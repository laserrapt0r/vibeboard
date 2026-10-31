// Befehlspalette (Strg+K): alles Erreichbare per Suche. Sichtbare Schaltflächen werden zur Laufzeit eingesammelt, statt eine zweite
// Liste zu pflegen: So gelten Rechte, Sprache und aktive Auswahl von selbst, und neue Funktionen erscheinen ohne Zutun.
import { T } from './i18n.js';
import { h, modal, loadPref, savePref, ICONS } from './util.js';
import {
  app, getEl, bounds, fitTo, frames, setSelection, selectedEls, saveSettings, bringToFront, sendToBack, duplicateEls, collectForCopy, groupSel,
  ungroupSel, toggleLock, togglePin, copyFormat, pasteFormat, hasCopiedFormat, canCopyFormat, deleteFramesWithContent, applyView, isLocked,
} from './core.js';
import { TEMPLATES } from './templates.js';
import { insertTemplate, elementText, openShortcuts } from './ui.js';
import { savedViews, goToView, saveCurrentView, headings, goToHeading } from './guide.js';

const SOURCES = [['#tools', () => T('Werkzeug')], ['#topbar', () => T('Board')], ['#topright', () => T('Board')], ['#bottom-left', () => T('Board')], ['#zoomctl', () => T('Ansicht')], ['#ctxbar', () => T('Auswahl')]];
const MAX_SHOWN = 40;
const RECENT_KEY = 'paletteRecent';

const plain = (s) => String(s).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

function fromButtons() {
  const seen = new Set(), out = [];
  for (const [selector, group] of SOURCES) {
    const root = document.querySelector(selector);
    if (!root) continue;
    for (const b of root.querySelectorAll('button')) {
      const title = b.title || b.getAttribute('aria-label') || '';
      if (!title || b.disabled || b.offsetParent === null) continue;
      // „Suchen (Strg+F)“ → Name und Tastenkürzel
      const m = /^(.*?)\s*\(([^()]{1,24})\)$/.exec(title);
      const label = m ? m[1] : title;
      if (seen.has(label)) continue;
      seen.add(label);
      out.push({ id: 'b:' + label, label, group: group(), hint: m ? m[2] : '', icon: b.querySelector('svg')?.outerHTML, run: () => b.isConnected && b.click() });
    }
  }
  return out;
}

function fromSelection() {
  if (app.viewOnly || !app.sel.size) return [];
  const sel = selectedEls();
  const group = T('Auswahl');
  const c = (id, label, hint, run, on = true) => (on ? { id, label, group, hint, run } : null);
  const free = !sel.every(isLocked);
  return [
    c('dup', T('Duplizieren'), T('Strg+D'), () => duplicateEls(collectForCopy([...app.sel])), free),
    c('front', T('In den Vordergrund'), T('Strg+]'), bringToFront, free),
    c('back', T('In den Hintergrund'), T('Strg+['), sendToBack, free),
    c('group', T('Gruppieren'), T('Strg+G'), groupSel, free && sel.length > 1),
    c('ungroup', T('Gruppierung aufheben'), T('Strg+Umschalt+G'), ungroupSel, free && sel.some((e) => e.groupId)),
    c('lock', T('Sperren oder entsperren'), T('Strg+L'), toggleLock),
    c('pin', T('Position fixieren (Text bleibt bearbeitbar)'), '', togglePin),
    c('fmtc', T('Format kopieren'), T('Strg+Alt+C'), copyFormat, sel.some(canCopyFormat)),
    c('fmtv', T('Format einfügen'), T('Strg+Alt+V'), pasteFormat, hasCopiedFormat()),
    c('frdel', T('Frame samt Inhalt löschen'), '', deleteFramesWithContent, sel.some((e) => e.type === 'frame')),
  ].filter(Boolean);
}

function fromSettings() {
  const toggle = (key, label) => ({ id: 'set:' + key, label, group: T('Einstellung'), run: () => {
    app.settings[key] = !app.settings[key];
    saveSettings();
    applyView(true);
  } });
  return [
    toggle('grid', T('Raster anzeigen')), toggle('dark', T('Dunkles Design')), toggle('snap', T('Am Raster einrasten')),
    toggle('smartGuides', T('Intelligente Hilfslinien')), toggle('showAuthor', T('Autor auf Sticky Notes')),
    toggle('hideCursors', T('Mauszeiger anderer ausblenden')),
    { id: 'help', label: T('Tastenkürzel'), group: T('Hilfe'), run: openShortcuts },
  ];
}

const jump = (id) => {
  const el = getEl(id);
  if (!el) return;
  setSelection([id]);
  fitTo(bounds(el), { maxZ: 1.5, pad: 160 });
};

// Inhalte nur einmal je Öffnen zusammenstellen: Die Suche läuft bei jedem Tastendruck
function boardTexts() {
  const out = [];
  for (const el of app.els.values()) {
    if (el.hidden || el.type === 'frame') continue;
    const text = elementText(el).replace(/\s+/g, ' ').trim();
    if (text) out.push({ id: 'e:' + el.id, label: text.slice(0, 80), search: text.slice(0, 2000), group: T('Auf dem Board'), low: true, run: () => jump(el.id) });
  }
  return out;
}

function fromBoard(q, texts) {
  const out = frames().filter((f) => !f.hidden).map((f) => ({ id: 'f:' + f.id, label: f.title || T('Frame'), group: T('Frame'), run: () => jump(f.id) }));
  out.push({ id: 'view:new', label: T('Aktuelle Ansicht merken'), group: T('Ansicht'), run: saveCurrentView });
  savedViews().forEach((v, i) => out.push({ id: 'view:' + v.name, label: v.name, group: T('Gemerkte Ansicht'), hint: i < 9 ? `Alt+${i + 1}` : '', run: () => goToView(v) }));
  // Überschriften, Inhalte und Vorlagen nur bei einer Suche: Sonst überdecken sie die Befehle
  if (q.length >= 2) {
    for (const el of headings()) out.push({ id: 'h:' + el.id, label: el.text, group: T('Überschrift'), run: () => goToHeading(el) });
    if (!app.viewOnly) for (const t of TEMPLATES) if (t.id !== 'blank') out.push({ id: 't:' + t.id, label: t.name, group: T('Vorlage'), run: () => insertTemplate(t) });
    out.push(...texts());
  }
  return out;
}

// Alle Wörter müssen vorkommen; Treffer am Anfang eines Wortes zählen mehr
function score(words, cmd) {
  const hay = plain(cmd.search || cmd.label);
  let total = 0;
  for (const w of words) {
    const at = hay.indexOf(w);
    if (at < 0) return 0;
    total += at === 0 ? 4 : /[\s(/-]/.test(hay[at - 1]) ? 3 : 1;
  }
  return total + (cmd.low ? 0 : 2);
}

function search(query, recent, texts) {
  const q = plain(query.trim());
  const all = [...fromSelection(), ...fromButtons(), ...fromBoard(q, texts), ...fromSettings()];
  const rank = (c) => {
    const i = recent.indexOf(c.id);
    return i < 0 ? 0 : (recent.length - i) / recent.length;
  };
  if (!q) return all.map((c, i) => ({ c, s: rank(c) * 10 - i / 1000 })).sort((a, b) => b.s - a.s).map((x) => x.c).slice(0, MAX_SHOWN);
  const words = q.split(/\s+/);
  return all.map((c) => ({ c, s: score(words, c) + rank(c) })).filter((x) => x.s > 0 && score(words, x.c) > 0).sort((a, b) => b.s - a.s).map((x) => x.c).slice(0, MAX_SHOWN);
}

function open() {
  if (document.querySelector('.modal-back')) return;
  const recent = loadPref(RECENT_KEY, []);
  let items = [], index = 0, cached = null;
  const texts = () => (cached = cached || boardTexts());
  const list = h('ul', { class: 'palette-list', id: 'palette-list', role: 'listbox', 'aria-label': T('Befehle') });
  const input = h('input', {
    class: 'palette-input', type: 'text', placeholder: T('Befehl, Frame, Vorlage oder Inhalt suchen …'), autocomplete: 'off', spellcheck: 'false',
    role: 'combobox', 'aria-expanded': 'true', 'aria-controls': 'palette-list', 'aria-autocomplete': 'list', 'aria-label': T('Befehl suchen'),
  });
  const run = (cmd) => {
    savePref(RECENT_KEY, [cmd.id, ...recent.filter((x) => x !== cmd.id)].slice(0, 8));
    m.close();
    // Erst schließen: Viele Befehle öffnen selbst Dialoge oder Menüs
    setTimeout(cmd.run, 0);
  };
  const mark = () => {
    [...list.children].forEach((li, i) => li.setAttribute('aria-selected', String(i === index)));
    const li = list.children[index];
    if (li) {
      li.scrollIntoView({ block: 'nearest' });
      input.setAttribute('aria-activedescendant', li.id);
    } else input.removeAttribute('aria-activedescendant');
  };
  const refresh = () => {
    items = search(input.value, recent, texts);
    index = 0;
    list.replaceChildren(...items.map((c, i) => h('li', { class: 'palette-item', id: 'palette-' + i, role: 'option', onclick: () => run(c) },
      h('span', { class: 'palette-icon', html: c.icon || ICONS.more || '' }),
      h('span', { class: 'palette-label' }, c.label),
      h('span', { class: 'muted small' }, c.hint || c.group))));
    if (!items.length) list.append(h('li', { class: 'muted pad' }, T('Nichts gefunden')));
    mark();
  };
  input.addEventListener('input', refresh);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!items.length) return;
      index = (index + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length;
      mark();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (items[index]) run(items[index]);
    }
  });
  const m = modal(T('Befehle'), h('div', {}, input, list));
  refresh();
  setTimeout(() => input.focus(), 0);
}

app.on('openPalette', open);
app.on('key', (e) => {
  if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    open();
  }
});
