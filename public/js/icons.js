// Allgemeine Symbole (Tabler Icons, MIT, siehe public/vendor/icons/LICENSE): Daten laden und nachschlagen.
// Dieses Modul ist klein und liegt in jedem Board. Die Symboldatei selbst kommt erst, wenn das Panel oder ein Symbol auf dem Board sie braucht.
// Auf dem Board steht nur der Name (Form „ti-…“). Pfade kommen immer aus der Symboldatei, nie vom Element.
import { T } from './i18n.js';

const ICON_FILE = '/vendor/icons/tabler-outline-3.50.0.json';
const RETRY_MS = 30000;

const ICON_RE = /^ti-[a-z0-9]+(?:-[a-z0-9]+)*$/; // Gleiche Prüfung in lib/sanitize.js
export const isIconKey = (k) => typeof k === 'string' && k.length <= 40 && ICON_RE.test(k);
export const hasIcons = (elements) => elements.some((e) => e.type === 'shape' && isIconKey(e.shape));

// Startwerte eines neuen Symbols: Ohne Füllung folgt die Linie dem Untergrund
export const ICON_DEFAULTS = { w: 96, h: 96, fill: 'transparent', stroke: '#1a1a1a', strokeWidth: 2, fontSize: 14 };

let store = null, groups = [], loading = null, failedAt = 0, motives = {};
const waiting = new Set();

export const iconsLoaded = () => !!store;
export const onIconsLoaded = (fn) => waiting.add(fn);
export const iconList = () => (store ? [...store.values()] : []);
export const iconGroups = () => groups;

function fill(data, motive) {
  groups = data.groups;
  motives = motive;
  store = new Map(data.icons.map(([name, group, tags, paths]) => ['ti-' + name, { k: 'ti-' + name, name, group: data.groups[group], tags, paths, body: '' }]));
}

async function fetchIcons() {
  const [res, motive] = await Promise.all([fetch(ICON_FILE), import('./icon-motive.js')]);
  if (!res.ok) throw new Error(String(res.status));
  fill(await res.json(), motive);
  for (const fn of waiting) fn();
}

// Schlägt das Laden fehl, gilt der nächste Versuch erst nach einer Pause: Jedes Neuzeichnen fragt hier nach
export function loadIcons(force = false) {
  if (store) return Promise.resolve();
  if (!force && !loading && Date.now() - failedAt < RETRY_MS) return Promise.reject(new Error('icons'));
  loading ||= fetchIcons().catch((e) => {
    failedAt = Date.now();
    throw e;
  }).finally(() => {
    loading = null;
  });
  return loading;
}

// Für Exporte: Sie zeichnen erst, wenn die Pfade da sind
export const iconsFor = async (elements) => {
  if (!hasIcons(elements)) return;
  await loadIcons(true).catch(() => {
    throw new Error(T('Die Symbole konnten nicht geladen werden.'));
  });
};

export const iconReady = (k) => !!store?.has(k);

// SVG-Pfade im Raster 24 × 24. Gefüllte Punkte nehmen die Linienfarbe über „color“ der umgebenden Gruppe.
export function iconBody(k) {
  const it = store?.get(k);
  if (!it) return '';
  it.body ||= it.paths.map((d) => (d[0] === '*' ? `<path d="${d.slice(1)}" fill="currentColor"/>` : `<path d="${d}"/>`)).join('');
  return it.body;
}

const words = (name) => name.split('-');

// Deutsche und weitere Suchwörter aus der gepflegten Liste: je Wort des Namens und für Paare wie „thumb-up“
export function iconMotives(it) {
  const parts = words(it.name), out = [];
  const add = (key) => {
    const de = motives.MOTIVE?.[key], more = motives.MOTIVE_INTL?.[key];
    if (de) out.push(de);
    if (more) out.push(more);
  };
  parts.forEach((w, i) => {
    add(w);
    if (i) add(`${parts[i - 1]}-${w}`);
  });
  return out.join(' ');
}

const title = (s) => s[0].toUpperCase() + s.slice(1);

// Anzeigename. Auf Deutsch der Begriff aus der Liste, wenn es ihn für genau dieses Symbol gibt.
export function iconLabel(k, german = false) {
  const name = String(k).replace(/^ti-/, '');
  const de = german ? motives.MOTIVE?.[name]?.split(' ')[0] : '';
  return title((de || name).replace(/-/g, ' '));
}
