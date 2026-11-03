// Symbolsätze: Daten laden und nachschlagen. Dieses Modul ist klein und liegt in jedem Board, die Daten kommen erst bei Bedarf.
// Auf dem Board steht nur ein Name mit Kürzel des Satzes. Zeichnungen kommen immer aus dem Satz, nie vom Element.
//   ti-…  Allgemeine Symbole (Tabler Icons, MIT, public/vendor/icons/)
//   cb-…  IT und Technik (IBM Carbon, Apache-2.0)        kc-…  Kubernetes (Kubernetes Icons Set, Apache-2.0)
//   el-…  Elektrotechnik (eigene Zeichnung, IEC 60617)    pi-…  Verfahrenstechnik (eigene Zeichnung, ISO 10628)
//   cu-<Paket>-<Nr>  Eigene Formenpakete der Administration (/api/shape-packs)
import { T, LANG } from './i18n.js';
import { SYMBOL_FILES } from './symbol-files.js';
import { nodesMarkup } from './svg-nodes.js';

const ICON_FILE = '/vendor/icons/tabler-outline-3.50.0.json';
const RETRY_MS = 30000;

// Gleiche Prüfung in lib/sanitize.js
const ICON_RE = /^(?:(ti|cb|kc|el|pi)-[a-z0-9]+(?:-[a-z0-9]+)*|cu-[a-z0-9]{6,12}-[a-z0-9]{1,6})$/;
export const isIconKey = (k) => typeof k === 'string' && k.length <= 40 && ICON_RE.test(k);
export const hasIcons = (elements) => elements.some((e) => e.type === 'shape' && isIconKey(e.shape));

// Satz eines Namens: „cu-abc123-4“ gehört zum Paket „cu-abc123“
export const setOf = (k) => (k.startsWith('cu-') ? k.slice(0, k.lastIndexOf('-')) : k.slice(0, 2));
const MODES = { ti: 'tabler', cb: 'fill', kc: 'color', el: 'stroke', pi: 'stroke' };
export const iconMode = (k) => MODES[setOf(k)] || 'color';

// Startwerte eines neuen Symbols: Ohne Füllung folgt die Linie dem Untergrund
export const ICON_DEFAULTS = { w: 96, h: 96, fill: 'transparent', stroke: '#1a1a1a', strokeWidth: 2, fontSize: 14 };

const sets = new Map(); // Satz → { items: Map, groups: [[Kennung, Name]], meta }
const loading = new Map(), failedAt = new Map();
let motives = {};
const waiting = new Set();

export const setLoaded = (id) => sets.has(id);
export const onIconsLoaded = (fn) => waiting.add(fn);
export const setItems = (id) => (sets.has(id) ? [...sets.get(id).items.values()] : []);
export const setGroups = (id) => sets.get(id)?.groups || [];
// Nur die Allgemeinen Symbole, wie bisher
export const iconsLoaded = () => sets.has('ti');
export const iconList = () => setItems('ti');

const groupName = (names) => (typeof names === 'string' ? names : names?.[LANG] || names?.en || names?.de || '');

function fillTabler(data) {
  const items = new Map(data.icons.map(([name, group, tags, paths]) => ['ti-' + name, { k: 'ti-' + name, name, group: data.groups[group], tags, paths, body: '' }]));
  return { items, groups: [] };
}

// Fachsymbole und eigene Pakete haben dasselbe Format (scripts/build-symbols.js, lib/routes/shape-packs.js)
function fillNodes(prefix, data) {
  const groups = data.groups.map(([id, names]) => [String(id), groupName(names)]);
  const items = new Map();
  for (const [name, group, label, tags, vb, nodes] of data.icons) {
    const k = `${prefix}-${name}`;
    if (!isIconKey(k)) continue;
    items.set(k, { k, name: String(name), group: groups[group]?.[0] || '', label, tags: String(tags || ''), vb, nodes, body: '' });
  }
  return { items, groups };
}

async function fetchSet(id) {
  if (id === 'ti') {
    const [res, motive] = await Promise.all([fetch(ICON_FILE), import('./icon-motive.js')]);
    if (!res.ok) throw new Error(String(res.status));
    motives = motive;
    sets.set(id, fillTabler(await res.json()));
  } else {
    const url = id.startsWith('cu-') ? `/api/shape-packs/${encodeURIComponent(id.slice(3))}` : SYMBOL_FILES[id];
    if (!url) throw new Error('unknown set');
    const [res, motive] = await Promise.all([fetch(url, { credentials: 'same-origin' }), id === 'cb' ? import('./icon-motive.js') : null]);
    // Gelöschtes eigenes Paket: leer merken, dann zeigen die Elemente einen Platzhalter statt immer neu zu fragen
    if (res.status === 404 && id.startsWith('cu-')) {
      sets.set(id, { items: new Map(), groups: [] });
      for (const fn of waiting) fn(id);
      return;
    }
    if (!res.ok) throw new Error(String(res.status));
    if (motive) motives = motive;
    sets.set(id, fillNodes(id, await res.json()));
  }
  for (const fn of waiting) fn(id);
}

// Schlägt das Laden fehl, gilt der nächste Versuch erst nach einer Pause: Jedes Neuzeichnen fragt hier nach
export function loadSet(id, force = false) {
  if (sets.has(id)) return Promise.resolve();
  if (!force && !loading.has(id) && Date.now() - (failedAt.get(id) || 0) < RETRY_MS) return Promise.reject(new Error('icons'));
  if (!loading.has(id)) {
    loading.set(id, fetchSet(id).catch((e) => {
      failedAt.set(id, Date.now());
      throw e;
    }).finally(() => loading.delete(id)));
  }
  return loading.get(id);
}
export const loadIcons = (force = false) => loadSet('ti', force);
export const loadFor = (k) => loadSet(setOf(k));

// Ein geändertes eigenes Paket wird beim nächsten Bedarf neu geladen
export function forgetSet(id) {
  sets.delete(id);
  failedAt.delete(id);
}

// Für Exporte: Sie zeichnen erst, wenn alle nötigen Sätze da sind
export const iconsFor = async (elements) => {
  const need = new Set(elements.filter((e) => e.type === 'shape' && isIconKey(e.shape)).map((e) => setOf(e.shape)));
  await Promise.all([...need].map((id) => loadSet(id, true).catch(() => {
    // Ein gelöschtes eigenes Paket erscheint als Platzhalter, das hält den Export nicht auf
    if (!id.startsWith('cu-')) throw new Error(T('Die Symbole konnten nicht geladen werden.'));
  })));
};

const record = (k) => sets.get(setOf(k))?.items.get(k);
export const iconReady = (k) => !!record(k);
// Satz geladen, Name aber unbekannt: ein Platzhalter mit Namen statt eines leeren Rahmens
export const iconMissing = (k) => sets.has(setOf(k)) && !record(k);

// Zeichenfläche: Tabler hat ein festes Raster von 24, alle anderen Sätze ihre eigene viewBox
export function iconBox(k) {
  const it = record(k);
  if (!it) return [0, 0, 24, 24];
  return it.vb || [0, 0, 24, 24];
}

// SVG-Inhalt. Tabler: Pfade im Raster 24 × 24, gefüllte Punkte nehmen die Linienfarbe über „color“.
export function iconBody(k) {
  const it = record(k);
  if (!it) return '';
  if (it.paths) it.body ||= it.paths.map((d) => (d[0] === '*' ? `<path d="${d.slice(1)}" fill="currentColor"/>` : `<path d="${d}"/>`)).join('');
  else it.body ||= nodesMarkup(it.nodes);
  return it.body;
}

// Standardgröße beim Ablegen: Elektro- und Verfahrenstechnik in ihrer gezeichneten Größe, alles andere passt in 96 × 96
export function iconDefaults(k) {
  const it = record(k);
  if (!it?.vb) return ICON_DEFAULTS;
  const [, , w, h] = it.vb;
  if (iconMode(k) === 'stroke') return { ...ICON_DEFAULTS, w: Math.round(w), h: Math.round(h) };
  const s = 96 / Math.max(w, h);
  return { ...ICON_DEFAULTS, w: Math.max(24, Math.round(w * s)), h: Math.max(24, Math.round(h * s)) };
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
  if (it.label && typeof it.label === 'object') out.push(...Object.values(it.label));
  return out.join(' ');
}

const title = (s) => s[0].toUpperCase() + s.slice(1);

// Anzeigename. Auf Deutsch der Begriff aus der Liste, wenn es ihn für genau dieses Symbol gibt.
export function iconLabel(k, german = false) {
  const it = record(k);
  if (it?.label && typeof it.label === 'object') return it.label[LANG] || it.label.en || it.name;
  const name = it?.name || String(k).replace(/^[a-z]{2}-/, '');
  const de = german ? motives.MOTIVE?.[name]?.split(' ')[0] : '';
  if (de) return title(de.replace(/-/g, ' '));
  if (typeof it?.label === 'string' && it.label) return it.label;
  return title(name.replace(/-/g, ' '));
}
