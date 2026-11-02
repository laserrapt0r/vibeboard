// Befehlspalette (Strg+K): alles Erreichbare per Suche. Sichtbare Schaltflächen werden zur Laufzeit eingesammelt, statt eine zweite
// Liste zu pflegen: So gelten Rechte, Sprache und aktive Auswahl von selbst, und neue Funktionen erscheinen ohne Zutun.
import { T } from './i18n.js';
import { h, modal, loadPref, savePref, ICONS } from './util.js';
import {
  app, getEl, bounds, fitTo, frames, setSelection, saveSettings, applyView,
} from './core.js';
import { TEMPLATES } from './templates.js';
import { hideBuiltin } from './gallery.js';
import { insertTemplate, elementText, openShortcuts, exportItems, importItems, headerCommands, selectionCommands } from './ui.js';
import { retroItems } from './retro.js';
import { savedViews, goToView, saveCurrentView, headings, goToHeading } from './guide.js';

const SOURCES = [['#tools', () => T('Werkzeug')], ['#topbar', () => T('Board')], ['#topright', () => T('Board')], ['#bottom-left', () => T('Board')], ['#zoomctl', () => T('Ansicht')], ['#ctxbar', () => T('Auswahl')]];
const MAX_SHOWN = 40;
const RECENT_KEY = 'paletteRecent';

// Knöpfe, die in schmalen Fenstern hinter „Mehr“ gewandert sind, sind ausgeblendet, aber nicht verboten
const FOLDED = '.folded';

// Weitere Suchwörter je Knopf (Werkzeug, Kennung oder Beschriftung). Der Wortlaut der Oberfläche ist selten das, was man eintippt.
const synonyms = () => ({
  sticky: T('sticky haftnotiz zettel post-it'), text: T('schrift beschriftung'), shape: T('rechteck kreis ellipse figur'), connector: T('verbinden verbindung pfeil linie'),
  pen: T('zeichnen malen freihand'), highlighter: T('hervorheben markieren'), eraser: T('löschen wegradieren'), frame: T('folie rahmen bereich'),
  card: T('ticket todo'), table: T('zellen spalten zeilen'), code: T('programm quelltext'), mindmap: T('gedanken ideen'), comment: T('anmerkung rückmeldung'),
  emoji: T('smiley aufkleber'), image: T('foto datei upload pdf'), laser: T('zeiger pointer'), template: T('muster'), diagram: T('flussdiagramm mermaid'),
  vote: T('wählen punkte dot voting'), timer: T('stoppuhr countdown zeit'), retro: T('retrospektive umfrage'), private: T('verdeckt geheim anonym sammeln'),
  'btn-help': T('anleitung erste schritte einführung bewegen navigieren'), moderation: T('leiten sperren'), [T('Präsentieren')]: T('folien vortrag vorführen'), estimate: T('planning poker story points'), poll: T('schnellumfrage'),
  picker: T('rad glücksrad los'), order: T('reihenfolge reihum'), recording: T('rundgang video'), versions: T('versionsverlauf historie'), activity: T('protokoll wer hat geändert'),
});

const plain = (s) => String(s).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

function fromButtons() {
  const seen = new Set(), out = [];
  const also = synonyms();
  for (const [selector, group] of SOURCES) {
    const root = document.querySelector(selector);
    if (!root) continue;
    for (const b of root.querySelectorAll('button')) {
      const title = b.title || b.getAttribute('aria-label') || b.textContent.trim();
      // Auf dem Handy liegen Kollaborations-Knöpfe im Scrollbereich: sichtbar ist, was im Layout steckt
      if (!title || b.disabled || b.dataset.more || (b.offsetParent === null && getComputedStyle(b).position !== 'fixed' && !b.matches(FOLDED))) continue;
      // „Suchen (Strg+F)“ → Name und Tastenkürzel. Nicht jede Klammer ist ein Kürzel („… (Mermaid-Syntax)“)
      const m = /^(.*?)\s*\(([^()]{1,24})\)$/.exec(title);
      const key = m && /[+−]|^\S{1,6}$/.test(m[2]) ? m[2] : '';
      const label = key ? m[1] : title;
      if (seen.has(label)) continue;
      seen.add(label);
      out.push({ id: 'b:' + label, label, group: group(), hint: key, also: also[b.dataset.tool] || also[b.id] || also[label], icon: b.querySelector('svg')?.outerHTML, run: () => b.isConnected && b.click() });
    }
  }
  return out;
}

// Einträge aus Menüs: Die Überschrift wird zur Gruppe. Was die Rolle nicht darf, steht dort gar nicht oder deaktiviert.
// Untermenüs nur bei einer Suche: Sonst verdrängen ihre vielen Einträge die Befehle aus der Liste.
function fromMenu(items, deep = true, start = '') {
  let group = start;
  const out = [];
  const also = synonyms();
  for (const it of items) {
    if (!it || it === '-') continue;
    if (it.header) group = it.header;
    else if (it.items) out.push(...(deep ? fromMenu(typeof it.items === 'function' ? it.items() : it.items, deep, it.label) : []));
    else if (!it.disabled && it.onClick) out.push({ id: 'm:' + it.label, label: it.label, group, hint: it.hint, also: also[it.key], icon: ICONS[it.icon], run: it.onClick });
  }
  return out;
}

function fromCommands(deep) {
  const invite = app.role === 'owner' ? [{ id: 'invite', label: T('Personen einladen'), group: T('Board'), also: T('teilen freigeben mitglied'), icon: ICONS.share, run: () => app.emit('openShare') }] : [];
  return [...invite, ...fromMenu(exportItems()), ...fromMenu(importItems()), ...fromMenu(retroItems()), ...fromMenu(headerCommands(), deep)];
}

function fromSelection(deep) {
  return fromMenu(selectionCommands(), deep).map((c) => ({ ...c, group: T('Auswahl') }));
}

function fromSettings() {
  const toggle = (key, label) => ({ id: 'set:' + key, label, group: T('Einstellung'), run: () => {
    app.settings[key] = !app.settings[key];
    saveSettings();
    applyView(true);
  } });
  return [
    toggle('grid', T('Raster anzeigen')), toggle('dark', T('Dunkles Design')), toggle('snap', T('Am Raster einrasten')),
    toggle('smartGuides', T('Intelligente Hilfslinien')), toggle('showAuthor', T('Autor auf Notizen')),
    toggle('hideCursors', T('Mauszeiger anderer ausblenden')),
    { id: 'help', label: T('Tastenkürzel'), group: T('Hilfe'), also: T('tasten übersicht'), run: openShortcuts },
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
    if (!app.viewOnly && !hideBuiltin()) for (const t of TEMPLATES) if (t.id !== 'blank') out.push({ id: 't:' + t.id, label: t.name, group: T('Vorlage'), run: () => insertTemplate(t) });
    out.push(...texts());
  }
  return out;
}

// Alle Wörter müssen vorkommen; Treffer am Anfang eines Wortes zählen mehr, Gruppe und Suchwörter am wenigsten
function score(words, cmd) {
  const hay = plain(cmd.search || cmd.label);
  const more = cmd.low ? '' : plain(`${cmd.group} ${cmd.also || ''}`);
  let total = 0;
  for (const w of words) {
    const at = hay.indexOf(w);
    if (at < 0) {
      if (!more.includes(w)) return 0;
      total += 1;
      continue;
    }
    total += at === 0 ? 4 : /[\s(/-]/.test(hay[at - 1]) ? 3 : 1;
  }
  return total + (cmd.low ? 0 : 2);
}

function search(query, recent, texts) {
  const q = plain(query.trim());
  const seen = new Map();
  // Dasselbe steht oft in mehreren Menüs: Die Suche zeigt es nur einmal, findet es aber über alle Gruppen
  const all = [...fromSelection(q.length >= 2), ...fromButtons(), ...fromBoard(q, texts), ...fromCommands(q.length >= 2), ...fromSettings()].filter((c) => {
    if (c.low) return true;
    const first = seen.get(c.label);
    if (first) first.also = `${first.also || ''} ${c.group} ${c.also || ''}`;
    else seen.set(c.label, c);
    return !first;
  });
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
