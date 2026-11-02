#!/usr/bin/env node
'use strict';
/*
 * Erzeugt aus dem npm-Paket @tabler/icons (MIT) die statische Symboldatei unter public/vendor/icons/.
 * Das Ergebnis liegt im Repo, im Betrieb läuft dieses Skript nicht. Es gehört nur ins Spiel, wenn das Paket aktualisiert wird:
 *   npm run build:icons
 *
 * Aufbau der Datei: { version, license, groups: [Kennung …], icons: [[Name, Gruppe, Stichwörter, [Pfad …]] …] }
 * Ein Pfad mit führendem * ist gefüllt statt gestrichelt gezeichnet (die Punkte in manchen Symbolen).
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PKG = path.join(ROOT, 'node_modules', '@tabler', 'icons');
const OUT_DIR = path.join(ROOT, 'public', 'vendor', 'icons');
const CLIENT = path.join(ROOT, 'public', 'js', 'icons.js');

// Logos sind Marken Dritter, die MIT-Lizenz räumt daran keine Rechte ein. Sie kommen nicht in die Datei.
const LEFT_OUT = new Set(['Brand']);
// Auch außerhalb dieser Kategorie stecken Marken und Figuren im Satz. Allgemeine Geräte bleiben, sie haben neutrale Namen
// (device-tablet, device-desktop); die Fassungen mit Produktnamen fehlen.
const NAME_OUT = /^(mickey|pacman|pokeball|lego|playstation-|xbox-|device-nintendo|steam$|device-vision-pro|device-airpods|airpods-|device-airtag|device-imac|device-ipad|bluetooth|earphone-bluetooth|creative-commons|coin-monero|currency-(dogecoin|ethereum|litecoin|monero|ripple|xrp|solana|tether)|device-usb$|usb$|nfc|file-excel|file-word)/;
// Suchwörter: Marken haben dort nichts zu suchen, auch wenn das Symbol selbst allgemein ist
const TAG_OUT = /^(microsoft|apple|google|sony|disney|nintendo|valve|android|ios|macbook|iphone|ipad|imac|excel|word|powerpoint|outlook|batman|minecraft|safari|linux)$/i;

// Untergruppen im Panel. Die Reihenfolge und die Kennungen stehen auch in public/js/shape-catalog.js (ICON_GROUPS).
const GROUPS = {
  arrows: ['Arrows'],
  comm: ['Communication'],
  people: ['Gender', 'Mood', 'Gestures'],
  files: ['Document'],
  devices: ['Devices', 'Computers', 'Electrical'],
  business: ['E-commerce', 'Currencies', 'Charts'],
  weather: ['Weather'],
  time: [],
  system: ['System', 'Extensions'],
  dev: ['Development', 'Database', 'Version control', 'Logic'],
  design: ['Design', 'Text', 'Media', 'Photography'],
  places: ['Map', 'Buildings', 'Vehicles'],
  nature: ['Nature', 'Animals', 'Food', 'Sport', 'Games', 'Health', 'Laundry', 'Zodiac'],
  signs: ['Shapes', 'Symbols', 'Letters', 'Numbers', 'Badges', 'Math'],
};
// Die Kategorien des Satzes sind grob: Glocke, Daumen, Uhr und Kalender stehen unter „System“. Der Name entscheidet dann.
const BY_NAME = [
  [/^(clock|calendar|alarm|hourglass|stopwatch|history|timeline)(-|$)/, 'time'],
  [/^(user|users|man|woman|friends|baby|mood|thumb|hand|accessible|walk|run|swimming|school)(-|$)/, 'people'],
  [/^(bell|mail|message|messages|phone|share|send|inbox|at|speakerphone|broadcast|antenna)(-|$)/, 'comm'],
  [/^(file|files|folder|folders|archive|paperclip)(-|$)/, 'files'],
  [/^(briefcase|building-bank|report|receipt|wallet|coin|coins|cash|chart|presentation)(-|$)/, 'business'],
];

const PATH_RE = /^[MmLlHhVvCcSsQqTtAaZz0-9 ,.\-eE]+$/;
const NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const groupOf = {};
for (const [g, cats] of Object.entries(GROUPS)) for (const c of cats) groupOf[c] = g;

function pathsOf(name, nodes) {
  return nodes.map(([tag, attrs]) => {
    if (tag !== 'path' || !PATH_RE.test(attrs.d)) throw new Error(`Unerwarteter Inhalt in ${name}`);
    return (attrs.fill === 'currentColor' ? '*' : '') + attrs.d;
  });
}

// Stichwörter als eine Zeichenkette, ohne das, was ohnehin im Namen steht
function keywords(name, meta) {
  const inName = new Set(name.split('-'));
  const words = new Set();
  for (const tag of [...(meta.tags || []).map(String).filter((t) => !t.split(/[\s-]+/).some((w) => TAG_OUT.test(w))), String(meta.category)]) {
    for (const w of tag.toLowerCase().split(/[^\p{L}\p{N}]+/u)) if (w && !inName.has(w)) words.add(w);
  }
  return [...words].join(' ');
}

function main() {
  const pkg = JSON.parse(fs.readFileSync(path.join(PKG, 'package.json'), 'utf8'));
  if (pkg.license !== 'MIT') throw new Error(`Lizenz des Pakets ist ${pkg.license}, erwartet wird MIT`);
  const meta = JSON.parse(fs.readFileSync(path.join(PKG, 'icons.json'), 'utf8'));
  const nodes = JSON.parse(fs.readFileSync(path.join(PKG, 'tabler-nodes-outline.json'), 'utf8'));
  const ids = Object.keys(GROUPS);
  const icons = [];
  for (const name of Object.keys(meta).sort()) {
    const m = meta[name];
    if (LEFT_OUT.has(m.category) || NAME_OUT.test(name) || !nodes[name]) continue;
    if (!NAME_RE.test(name) || name.length > 37) throw new Error(`Name passt nicht zur Prüfung in lib/sanitize.js: ${name}`);
    const group = BY_NAME.find(([re]) => re.test(name))?.[1] || groupOf[m.category];
    if (!group) throw new Error(`Kategorie ohne Untergruppe: ${m.category}`);
    icons.push([name, ids.indexOf(group), keywords(name, m), pathsOf(name, nodes[name])]);
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });
  for (const f of fs.readdirSync(OUT_DIR)) if (f.startsWith('tabler-outline-')) fs.unlinkSync(path.join(OUT_DIR, f));
  // Die Version steht im Dateinamen, damit Browser die Datei dauerhaft behalten dürfen
  const file = `tabler-outline-${pkg.version}.json`;
  const body = JSON.stringify({ version: pkg.version, license: pkg.license, groups: ids, icons });
  fs.writeFileSync(path.join(OUT_DIR, file), body);
  fs.copyFileSync(path.join(PKG, 'LICENSE'), path.join(OUT_DIR, 'LICENSE'));
  const js = fs.readFileSync(CLIENT, 'utf8');
  const next = js.replace(/const ICON_FILE = '[^']*';/, `const ICON_FILE = '/vendor/icons/${file}';`);
  if (!next.includes(file)) throw new Error('ICON_FILE in public/js/icons.js nicht gefunden');
  if (next !== js) fs.writeFileSync(CLIENT, next);
  const gz = require('zlib').gzipSync(body, { level: 9 }).length;
  process.stdout.write(`${icons.length} Symbole, Version ${pkg.version}: ${(body.length / 1e6).toFixed(2)} MB, gepackt ${(gz / 1e6).toFixed(2)} MB\n`);
}

main();
