// Import eigener Formenpakete: erkennt den Aufbau gängiger Symbol-Archive und plant, welche Dateien unter welchem Namen hineingehen.
// Reine Funktionen ohne Browserzugriff (Test: scripts/test-svg.js). Die Prüfung der Dateien selbst macht der Server (lib/svg-clean.js).
//
// Die Archive der Hersteller (AWS, Azure, Google Cloud, Cisco …) lädt die Administration selbst von deren Seiten.
// vibeboard liefert keine dieser Dateien mit: Ihre Nutzung richtet sich nach den Bedingungen des jeweiligen Herstellers.

const SIZE_DIR = /^(\d{2,4}|\d{2,4}px|svg|svgs|png|light|dark|res_\d{2}_(light|dark)|color|colour|mono)$/i;

const pretty = (s) => s.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();

// Größe aus Datei- oder Ordnernamen. Bevorzugt wird 64, dann die nächstgelegene.
function sizeOf(path) {
  const m = /(?:^|[/_-])(16|20|24|32|48|64|80|96|128|256|512)(?:px)?(?:[/_.-]|$)/i.exec(path);
  return m ? Number(m[1]) : 64;
}

function score(path) {
  let s = -Math.abs(Math.log2(sizeOf(path) / 64));
  if (/(^|[/_-])dark([/_.-]|$)/i.test(path)) s -= 5; // Weiße Linien, auf hellem Board unsichtbar
  if (/(^|[/_-])light([/_.-]|$)/i.test(path)) s += 0.5;
  return s;
}

function detect(paths) {
  if (paths.some((p) => /(^|\/)(Architecture-Service-Icons|Resource-Icons|Category-Icons)_|\/Arch_[^/]+\//.test(p))) return 'aws';
  if (paths.some((p) => /\d{5}-icon-service-/.test(p))) return 'azure';
  if (paths.some((p) => /(^|\/)(Unique|Category|Product) Icons\//.test(p) || /-512-color(-rgb)?\.svg$/i.test(p))) return 'gcp';
  return 'generic';
}

const VENDORS = {
  aws: { name: 'AWS Architecture Icons', source: 'Amazon Web Services, AWS Architecture Icons' },
  azure: { name: 'Azure', source: 'Microsoft, Azure Architecture Icons' },
  gcp: { name: 'Google Cloud', source: 'Google, Google Cloud Icons' },
};

function awsEntry(dirs, base) {
  const name = pretty(base.replace(/^(Arch|Res|Arch-Category)_/, '').replace(/_(16|32|48|64)(_(Light|Dark))?$/, ''));
  let group = '';
  for (const d of dirs) {
    let m;
    if ((m = /^Arch_(.+)$/.exec(d))) group = pretty(m[1]);
    else if (/^Res_General-Icons$/.test(d)) group = 'General';
    else if ((m = /^Res_(.+)$/.exec(d)) && !/^Res_\d/.test(d)) group = `${pretty(m[1])} (Resources)`;
    else if (/^Category-Icons/.test(d)) group = 'Categories';
    else if (/^Architecture-Group-Icons/.test(d)) group = 'Groups';
  }
  return { name, group };
}

function azureEntry(dirs, base) {
  const name = pretty(base.replace(/^\d+-icon-service-/, ''));
  const group = dirs.length ? pretty(dirs[dirs.length - 1]) : '';
  return { name, group: group.length > 3 ? group[0].toUpperCase() + group.slice(1) : group.toUpperCase() };
}

function gcpEntry(dirs, base) {
  // Aufbau: „Unique Icons/Cloud Run/SVG/CloudRun-512-color-rgb.svg“. Der Ordner trägt den lesbaren Namen.
  const named = dirs.filter((d) => !SIZE_DIR.test(d));
  const name = named.length >= 2 ? named[named.length - 1] : pretty(base.replace(/-\d+-color(-rgb)?$/i, ''));
  const top = named.length >= 2 ? named[named.length - 2] : named[0] || '';
  const kind = pretty(top.replace(/\s*Icons$/i, ''));
  return { name: pretty(name), group: { Unique: 'Products', Product: 'Products', Category: 'Categories' }[kind] || kind };
}

function genericEntry(dirs, base) {
  const name = pretty(base.replace(/[-_ ]?(@\dx|\d{2,4}(px)?)$/i, '').replace(/[-_](color|colour|rgb|light|dark|mono)$/i, '').replace(/[-_ ]?(@\dx|\d{2,4}(px)?)$/i, '')) || pretty(base);
  const named = dirs.filter((d) => !SIZE_DIR.test(d));
  return { name, group: named.length ? pretty(named[named.length - 1]) : '' };
}

/**
 * paths: Pfade im Archiv (oder Dateinamen bei einzeln gewählten Dateien). archive: Dateiname für den Vorschlag.
 * Liefert { vendor, name, source, items: [{ path, name, group }], skipped }.
 */
export function planImport(paths, archive = '') {
  const svgs = paths.filter((p) => /\.svg$/i.test(p) && !/(^|\/)__MACOSX\//.test(p) && !/(^|\/)\./.test(p));
  const vendor = detect(svgs);
  const entry = { aws: awsEntry, azure: azureEntry, gcp: gcpEntry, generic: genericEntry }[vendor];
  // Ein gemeinsamer Wurzelordner (Name des Archivs) ist keine Gruppe. Bei Google Cloud trägt er die Art (Produkte, Kategorien).
  const split = svgs.map((p) => p.split('/'));
  const common = vendor === 'generic' && split.length > 1 && split.every((s) => s.length > 1 && s[0] === split[0][0]) ? 1 : 0;
  const best = new Map();
  for (const parts of split) {
    const path = parts.join('/');
    const base = parts[parts.length - 1].replace(/\.svg$/i, '');
    const dirs = parts.slice(common, -1);
    const e = entry(dirs, base);
    const name = e.name.slice(0, 80) || 'Symbol';
    const group = e.group.slice(0, 60);
    const key = `${group.toLowerCase()}\n${name.toLowerCase()}`;
    const s = score(path);
    const prev = best.get(key);
    if (!prev || s > prev.s) best.set(key, { path, name, group, s });
  }
  const items = [...best.values()].sort((a, b) => a.group.localeCompare(b.group) || a.name.localeCompare(b.name)).map(({ path, name, group }) => ({ path, name, group }));
  const v = VENDORS[vendor];
  const fallback = pretty(String(archive).replace(/\.zip$/i, '').replace(/[_-]?\d{6,}.*$/, '')).slice(0, 80);
  return { vendor, name: v?.name || fallback, source: v?.source || '', items, skipped: paths.length - svgs.length };
}
