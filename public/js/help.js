// Hilfe: erste Schritte, Kurzanleitung und durchsuchbare Tastenkürzel
import { T } from './i18n.js';
import { h, modal } from './util.js';
import { app } from './core.js';

// Bewegen auf der Fläche kommt auch im einmaligen Tipp vor: Beide sagen dasselbe
const firstSteps = () => [
  app.viewOnly ? null : [T('Verbinden'), T('Wähle die Linie (L) und ziehe von einem Element zum anderen. Die Linie bleibt angedockt, wenn du Elemente verschiebst.')],
  app.guest ? null : [T('Teilen'), T('Über „Teilen“ oben rechts lädst du Personen ein oder erstellst einen Link.')],
  [T('Präsentieren'), T('Frames werden zu Folien. „Präsentieren“ oben rechts zeigt sie der Reihe nach, für alle oder nur für dich.')],
  [T('Bewegen auf der Fläche'), T('Strg+Mausrad zoomt, das Mausrad verschiebt die Ansicht. Mit Leertaste oder mittlerer Maustaste greifst du die Fläche und ziehst sie, die Taste H hält das fest. Ziehen mit dem Auswahlwerkzeug zieht auf leerer Fläche einen Rahmen auf. Umschalt+1 zeigt alles.')],
].filter(Boolean);

const guide = () => [
  app.contributor ? [T('Deine Notizen'), T('Die Taste N oder ein Doppelklick auf die Fläche legt eine Notiz an. Deine eigenen Notizen kannst du bearbeiten, verschieben und löschen. Andere Inhalte bleiben unverändert.')] : null,
  app.viewOnly ? null : [T('Anlegen'), T('Wähle links ein Werkzeug und klicke auf die Fläche. Ein Doppelklick auf die Fläche legt eine Notiz an.')],
  app.viewOnly ? null : [T('Bearbeiten'), T('Doppelklick oder Enter bearbeitet den Text. Die Leiste am Element ändert Farbe und Format, auch während du tippst.')],
  [T('Zusammenarbeiten'), T('Alle sehen Änderungen und Mauszeiger sofort. Taste C setzt einen Kommentar, die Taste / schreibt eine kurze Nachricht am Mauszeiger.')],
  [T('Finden'), T('Strg+K sucht Befehle und Inhalte, Strg+F sucht Text auf dem Board.')],
].filter(Boolean);

const shortcutGroups = () => [
  [T('Häufig'), [['V', T('Auswählen')], ['N', T('Notiz')], ['T', T('Text')], [T('H / Leertaste'), T('Ansicht verschieben')], [T('Strg+Z / Strg+Y'), T('Rückgängig / Wiederholen')], [T('Strg+C / X / V'), T('Kopieren / Ausschneiden / Einfügen')], [T('Strg+D'), T('Duplizieren')], [T('Strg+B / I / U'), T('Fett / Kursiv / Unterstrichen')], [T('Entf'), T('Löschen')], [T('Strg+K'), T('Befehle suchen')], [T('Strg+F'), T('Suchen')], [T('Strg + Mausrad'), T('Zoomen')]]],
  [T('Werkzeuge'), [['V', T('Auswählen')], [T('H / Leertaste'), T('Ansicht verschieben')], ['N', T('Notiz')], ['T', T('Text')], ['S', T('Form')], ['R / O', T('Rechteck / Ellipse')], ['L', T('Linie')], ['P', T('Stift')], ['E', T('Radierer')], ['F', T('Frame')], ['K', T('Karte')], ['B', T('Tabelle')], ['M', T('Mindmap')], ['D', T('Code')], ['C', T('Kommentar')], ['X', T('Laser')]]],
  [T('Bearbeiten'), [[T('Strg+Z / Strg+Y'), T('Rückgängig / Wiederholen')], [T('Strg+C / X / V'), T('Kopieren / Ausschneiden / Einfügen')], [T('Strg+D'), T('Duplizieren')], [T('Strg+B / I / U'), T('Fett / Kursiv / Unterstrichen (beim Tippen für das ganze Element, sonst für die Auswahl)')], [T('Strg+] / [ oder Strg+Bild↑ / Bild↓'), T('Ganz nach vorn / ganz nach hinten')], [T('Strg+Umschalt+↑ / ↓'), T('Ganz nach vorn / ganz nach hinten')], ['?', T('Diese Übersicht')], [T('Strg+Alt+C / V'), T('Format kopieren / einfügen')], [T('Strg+K'), T('Befehle suchen')], ['Alt+1 … 9', T('Gemerkte Ansichten')], [T('Tab (beim Tippen)'), T('Nächste Notiz oder Form daneben')], [T('Enter mit gewähltem Werkzeug'), T('Element in der Mitte der Ansicht anlegen')], [T('Doppelklick aufs Werkzeug / Umschalt+Taste'), T('Werkzeug bleibt aktiv')], [T('Alt + Ziehen'), T('Kopie ziehen')], [T('Entf'), T('Löschen')], [T('Strg+A'), T('Alles auswählen')], [T('Strg+G'), T('Gruppieren')], [T('Strg+Umschalt+G'), T('Gruppe auflösen')], [T('Strg+L'), T('Sperren')], [T('Pfeiltasten'), T('Verschieben (Umschalt: 10 px)')], [T('Enter / Doppelklick'), T('Text bearbeiten')], [T('Menütaste / Umschalt+F10'), T('Kontextmenü')], [T('Esc / Strg+Enter'), T('Bearbeitung beenden')]]],
  [T('Tabellen'), [[T('Klick in ausgewählte Tabelle'), T('Zelle wählen')], [T('Umschalt + Klick / Pfeil'), T('Bereich wählen')], [T('Pfeiltasten'), T('Zellauswahl bewegen')], [T('Enter / F2'), T('Zelle bearbeiten')], [T('Tippen'), T('Zelle überschreiben')], [T('Entf'), T('Inhalt leeren')], ['Tab', T('Nächste Zelle (beim Bearbeiten)')], [T('Linie ziehen'), T('Spaltenbreite / Zeilenhöhe')]]],
  [T('Verbinder'), [[T('Linie ziehen'), T('Biegen (Knickpunkt)')], [T('◦ auf der Linie ziehen'), T('Knickpunkt einfügen')], [T('Doppelklick auf ▪'), T('Knickpunkt entfernen')], [T('Beschriftung ziehen'), T('Entlang der Linie verschieben')], [T('Ende an Rand ziehen'), T('Fester Andockpunkt')], [T('Ende in Formmitte'), T('Automatisch andocken')]]],
  [T('Mindmap'), [['Tab', T('Unterknoten hinzufügen')], [T('Enter (beim Tippen)'), T('Geschwisterknoten')], [T('Umschalt+Enter'), T('Geschwisterknoten')]]],
  [T('Zusammenarbeit'), [['/', T('Cursor-Chat: Nachricht am Mauszeiger')], [T('Esc'), T('Cursor-Chat schließen')]]],
  [T('Verschieben & Größe'), [[T('Umschalt + Ziehen'), T('Nur waagerecht/senkrecht verschieben')], [T('Strg + Ziehen'), T('Ohne Einrasten')], [T('Seitengriff'), T('Nur Breite bzw. Höhe ändern')], [T('Umschalt + Griff'), T('Seitenverhältnis beibehalten')], [T('Alt + Griff'), T('Größe von der Mitte aus')], [T('Strg+D (wiederholt)'), T('Kopie mit zuletzt verwendetem Versatz')], [T('Klick in ausgewählte Gruppe'), T('Einzelnes Element der Gruppe wählen')], [T('Pfeiltasten'), T('Um 1 px (Umschalt: 10 px, mit Raster: eine Rasterweite) verschieben')], [T('Umschalt-/Strg-Klick'), T('Zur Auswahl hinzufügen bzw. entfernen (Ziehen verschiebt)')]]],
  [T('Präsentation'), [[T('→ / Leertaste'), T('Nächste Folie')], [T('← / Rücktaste'), T('Vorherige Folie')], ['Esc', T('Beenden')], [T('Esc (im Publikum)'), T('Selbst umsehen')]]],
  [T('Ansicht'), [[T('Strg + Mausrad'), T('Zoomen')], [T('Strg + / −'), T('Zoomen')], [T('Strg+0'), T('Auf 100 %')], [T('Umschalt+1'), T('Alles anzeigen')], [T('Umschalt+2'), T('Auswahl anzeigen')], [T('Strg+F'), T('Suchen')]]],
];

const steps = (list) => h('dl', { class: 'help-list' }, list.flatMap(([title, text]) => [h('dt', {}, title), h('dd', {}, text)]));

function keysView() {
  const none = h('p', { class: 'muted hidden' }, T('Kein Kürzel gefunden'));
  const groups = shortcutGroups().map(([title, list], i) => {
    const rows = list.map(([k, d]) => ({ text: `${k} ${d}`.toLowerCase(), row: h('tr', {}, h('td', {}, h('kbd', {}, k)), h('td', {}, d)) }));
    return { common: i === 0, rows, box: h('div', {}, h('h4', {}, title), h('table', {}, rows.map((r) => r.row))) };
  });
  const search = h('input', { type: 'search', class: 'help-search', placeholder: T('Kürzel suchen …'), 'aria-label': T('Kürzel suchen') });
  search.addEventListener('input', () => {
    const q = search.value.trim().toLowerCase();
    let found = 0;
    for (const g of groups) {
      // Beim Suchen stünde alles aus „Häufig“ doppelt da
      let n = 0;
      for (const r of g.rows) {
        const show = !q || (!g.common && r.text.includes(q));
        r.row.classList.toggle('hidden', !show);
        n += show ? 1 : 0;
      }
      g.box.classList.toggle('hidden', !n);
      found += n;
    }
    none.classList.toggle('hidden', found > 0);
  });
  return { node: [search, none, h('div', { class: 'shortcuts' }, groups.map((g) => g.box))], focus: () => search.focus() };
}

export function openHelp(tab = 'start') {
  const views = {
    start: [T('Erste Schritte'), () => ({ node: [steps(firstSteps())] })],
    guide: [T('Kurzanleitung'), () => ({ node: [steps(guide())] })],
    keys: [T('Tastenkürzel'), keysView],
  };
  const body = h('div', { class: 'help-body' });
  const buttons = Object.entries(views).map(([key, [label]]) => h('button', { type: 'button', class: 'btn small', 'data-help': key, onclick: () => show(key) }, label));
  const show = (key) => {
    const view = views[key][1]();
    for (const b of buttons) {
      b.classList.toggle('primary', b.dataset.help === key);
      b.setAttribute('aria-pressed', String(b.dataset.help === key));
    }
    body.replaceChildren(...view.node);
    return view;
  };
  const first = show(tab);
  modal(T('Hilfe'), h('div', { class: 'help' }, h('div', { class: 'row wrap help-tabs' }, buttons), body), { wide: true });
  first.focus?.();
}
