// Mehrsprachigkeit im Browser. Quellsprache ist Deutsch: Texte stehen im Code auf Deutsch und werden mit T markiert,
// die Wörterbücher (public/i18n/*.json) ordnen ihnen die Übersetzung zu. Die Sprache folgt dem Browser;
// wird keine der Browsersprachen unterstützt, gilt Englisch.
//   T('Speichern')           einfacher Text
//   T`${n} Elemente`         Text mit Werten – Schlüssel im Wörterbuch: „{0} Elemente“
const LANGS = ['en', 'de', 'es', 'fr'];
const wanted = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || 'en'];
const match = wanted.find((l) => LANGS.includes(String(l).toLowerCase().split('-')[0]));

export const LANG = match ? match.toLowerCase().split('-')[0] : 'en';
// Regionale Schreibweise (Datum, Zahlen) aus der Browsersprache
export const LOCALE = match || 'en';

// Dezimaltrennzeichen der Sprache
export const DEC = (1.5).toLocaleString(LOCALE).charAt(1);

let dict = {};
if (LANG !== 'de') {
  try {
    dict = await (await fetch(`/i18n/${LANG}.json`, { credentials: 'same-origin' })).json();
  } catch {
    dict = {}; // ohne Wörterbuch bleibt die Oberfläche bedienbar (deutsche Quelltexte)
  }
}

export function T(s, ...values) {
  if (Array.isArray(s) && s.raw) {
    const key = s.reduce((a, part, i) => a + part + (i < s.length - 1 ? `{${i}}` : ''), '');
    return (dict[key] ?? key).replace(/\{(\d+)\}/g, (m, i) => values[i] ?? '');
  }
  return dict[s] ?? s;
}

// Der Server speichert Gastnamen mit „ (Gast)“ – in der eigenen Sprache anzeigen
export const guestName = (n) => String(n ?? '').replace(/ \(Gast\)$/, T(' (Gast)'));

// Feste Texte in den HTML-Seiten (Bezeichnungen, Platzhalter, Tooltips)
function translateDom(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const s = n.nodeValue.trim();
    if (s && dict[s]) n.nodeValue = n.nodeValue.replace(s, dict[s]);
  }
  for (const el of root.querySelectorAll('[title],[placeholder],[aria-label]')) {
    for (const a of ['title', 'placeholder', 'aria-label']) if (dict[el.getAttribute(a)]) el.setAttribute(a, dict[el.getAttribute(a)]);
  }
}

document.documentElement.lang = LANG;
if (dict[document.title]) document.title = dict[document.title];
if (LANG !== 'de') translateDom(document.body);
