#!/usr/bin/env node
'use strict';
// Prüft die Bereinigung hochgeladener SVG-Dateien (lib/svg-clean.js), die Erkennung von Symbol-Archiven (public/js/shape-import.js)
// und die mitgelieferten Symbolsätze (public/vendor/symbols/). Ohne Datenbank: npm run test:svg
const fs = require('fs');
const path = require('path');
const { cleanSvg, SvgError, TAGS, ALL_ATTRS } = require('../lib/svg-clean');

let failures = 0, checks = 0;
const check = (ok, msg) => {
  checks++;
  if (!ok) {
    failures++;
    console.error('✗ ' + msg);
  }
};
const clean = (svg) => cleanSvg(svg, 'cu-test-0');
const rejects = (svg, what) => {
  try {
    clean(svg);
    check(false, `${what}: sollte abgelehnt werden`);
  } catch (e) {
    check(e instanceof SvgError, `${what}: falscher Fehler ${e.message}`);
  }
};
const flat = (nodes) => JSON.stringify(nodes);

function walk(nodes, fn) {
  for (const n of nodes) {
    if (typeof n === 'string') continue;
    fn(n);
    walk(n.slice(2), fn);
  }
}

// Nur erlaubte Elemente und Attribute, Verweise nur innerhalb der Zeichnung
function safe(result, what) {
  walk(result.nodes, ([tag, attrs]) => {
    check(TAGS.has(tag), `${what}: Element ${tag} durchgekommen`);
    for (const [k, v] of Object.entries(attrs)) {
      check(ALL_ATTRS.has(k), `${what}: Attribut ${k} durchgekommen`);
      check(!/[<>]/.test(v), `${what}: spitze Klammer in ${k}`);
      if (/url\s*\(/i.test(v)) check(/^url\(#[\w.:-]+\)$/.test(v), `${what}: Verweis nach außen in ${k}: ${v}`);
      if (k === 'href') check(/^#[\w.:-]+$/.test(v), `${what}: href nach außen: ${v}`);
      check(!/javascript|data:|http/i.test(v), `${what}: verdächtiger Wert in ${k}: ${v}`);
    }
  });
}

/* ---------- Angriffe ---------- */

const attacks = {
  'Skript und Ereignisse': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" onload="alert(1)"><script>alert(1)</script><rect width="5" height="5" onclick="alert(2)" onmouseover="x()"/></svg>',
  'Link mit javascript:': '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 10 10"><a xlink:href="javascript:alert(1)" href="javascript:alert(1)"><rect width="5" height="5"/></a></svg>',
  'Fremdes HTML': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><foreignObject width="10" height="10"><div xmlns="http://www.w3.org/1999/xhtml"><img src="x" onerror="alert(1)"/></div></foreignObject><rect width="1" height="1"/></svg>',
  'Bilder und externe Verweise': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><image href="https://evil.example/x.png" width="5" height="5"/><use href="https://evil.example/a.svg#x"/><rect width="5" height="5" fill="url(https://evil.example/#g)" stroke="url(javascript:alert(1))" filter="url(#f)"/></svg>',
  'Stile mit Import und Ausdrücken': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><style>@import url(https://evil.example/x.css); .a{fill:url(https://evil.example/);behavior:url(x.htc);stroke:red} rect{background:url(javascript:alert(1))}</style><rect class="a" width="5" height="5" style="fill:expression(alert(1));stroke-width:2"/></svg>',
  'Animation und Ereignisse auf Kindern': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="5" height="5"><animate attributeName="href" to="javascript:alert(1)"/><set attributeName="onclick" to="alert(1)"/></rect></svg>',
  'Text mit Markup': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><text x="1" y="5">&lt;img src=x onerror=alert(1)&gt;</text></svg>',
  'Verweis auf fremde Kennung': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="5" height="5" fill="url(#gibtesnicht)" clip-path="url(#auchnicht)"/></svg>',
  'Kennungen mit Sonderzeichen': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><defs><linearGradient id="a&quot; onload=&quot;x"><stop offset="0" stop-color="red"/></linearGradient></defs><rect width="5" height="5" fill="url(#a&quot; onload=&quot;x)"/></svg>',
};
for (const [what, svg] of Object.entries(attacks)) {
  let r;
  try {
    r = clean(svg);
  } catch (e) {
    check(e instanceof SvgError, `${what}: unerwarteter Fehler ${e.message}`);
    continue;
  }
  safe(r, what);
  check(!/alert|evil|onload|onclick|onerror|script|foreignObject|image|animate/i.test(flat(r.nodes).replace(/"text",\{[^}]*\},"[^"]*"/g, '')), `${what}: Reste durchgekommen ${flat(r.nodes).slice(0, 200)}`);
}
// Text bleibt Text: Der Browser maskiert ihn beim Einsetzen (public/js/svg-nodes.js)
check(flat(clean(attacks['Text mit Markup']).nodes).includes('<img src=x onerror=alert(1)>'), 'Text wird nicht als Text übernommen');

// Verschachtelte Verweise würden die Arbeit des Browsers vervielfachen
const laughs = clean(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><defs><path id="a" d="M0 0h1"/>${Array.from({ length: 6 }, (_, i) => `<g id="l${i + 1}">${`<use href="#${i ? 'l' + i : 'a'}"/>`.repeat(10)}</g>`).join('')}</defs><use href="#l6"/><g id="self"><use href="#self"/></g></svg>`);
let uses = 0;
walk(laughs.nodes, ([tag]) => tag === 'use' && uses++);
check(uses <= 10, `Verschachtelte <use> begrenzt: ${uses}`);
const clones = clean(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><defs><path id="a" d="M0 0h1"/></defs><use href="#a"/><use href="#a" x="2"/></svg>`);
let kept = 0;
walk(clones.nodes, ([tag]) => tag === 'use' && kept++);
check(kept === 2, `Einfache Klone bleiben: ${kept}`);
rejects('<!DOCTYPE svg [<!ENTITY a "aaaaaaaaaa"><!ENTITY b "&a;&a;&a;&a;">]><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><text>&b;</text></svg>', 'Entitäten');
rejects('<!DOCTYPE svg [<!ENTITY x SYSTEM "file:///etc/passwd">]><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><text>&x;</text></svg>', 'Externe Entität');
rejects('<html><body>kein svg</body></html>', 'Kein SVG');
rejects('<svg xmlns="http://www.w3.org/2000/svg"><rect width="1" height="1"/></svg>', 'Ohne Größe');
rejects('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><script>x</script></svg>', 'Nur Skript');
rejects('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1">' + '<g>'.repeat(60) + '<rect width="1" height="1"/>' + '</g>'.repeat(60) + '</svg>', 'Zu tief');
rejects('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1">' + '<rect width="1" height="1"/>'.repeat(5000) + '</svg>', 'Zu viele Elemente');
rejects('<svg viewBox="0 0 1 1">' + ' '.repeat(600 * 1024) + '</svg>', 'Zu groß');
rejects('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><rect width="1" height="1"></svg>', 'Kaputtes XML');

// Laufzeit bei böswilligen Werten: Jede Prüfung muss linear bleiben
const slow = (what, svg) => {
  const t0 = Date.now();
  try {
    clean(svg);
  } catch {}
  check(Date.now() - t0 < 1500, `${what}: ${Date.now() - t0} ms`);
};
slow('transform mit vielen Leerzeichen', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><rect width="1" height="1" transform="${'translate(1)   '.repeat(400)}x"/></svg>`);
slow('Farbe mit vielen Leerzeichen', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><rect width="1" height="1" fill="rgb(${' 1'.repeat(9000)}"/></svg>`);
slow('Stil ohne Klammern', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><style>${'a'.repeat(200000)}</style><rect width="1" height="1"/></svg>`);
slow('Stil mit offenen Kommentaren', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><style>${'/*@'.repeat(60000)}</style><rect width="1" height="1"/></svg>`);
slow('Viele Zahlen im Pfad', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><path d="M${' 1.5'.repeat(4000)}"/></svg>`);
check(flat(clean('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="1" height="1" transform="translate(1 2) scale(2), rotate(45)"/></svg>').nodes).includes('translate(1 2) scale(2), rotate(45)'), 'Gültige Transformation bleibt');
check(!flat(clean('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="1" height="1" transform="translate(1) url(x)"/></svg>').nodes).includes('transform'), 'Ungültige Transformation entfällt');
check(flat(clean('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><style>/* x */ @import url(a.css); .a, .b { fill: #123456 } @media print { .a { fill: red } }</style><rect class="b" width="1" height="1"/></svg>').nodes).includes('#123456'), 'Stilregel nach @import und Kommentar erkannt');

/* ---------- Was erhalten bleibt ---------- */

const gradient = clean(`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="18mm" height="18mm" viewBox="0 0 18 18">
  <defs><linearGradient id="g1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0078d4"/><stop offset="1" style="stop-color:#5ea0ef"/></linearGradient>
  <clipPath id="c"><rect width="9" height="9"/></clipPath></defs>
  <style>.cls-1{fill:#ff9900;stroke:none}</style>
  <g transform="translate(1 1)" clip-path="url(#c)"><path class="cls-1" d="M1.123456,2.987654L3.5.5Z"/><circle cx="4" cy="4" r="3" fill="url(#g1)"/><use xlink:href="#g1"/></g>
  <text x="2" y="16" font-family="Segoe UI, sans-serif" font-size="4" text-anchor="middle">SQL</text></svg>`);
safe(gradient, 'Verlauf');
const g = flat(gradient.nodes);
check(gradient.vb.join() === '0,0,18,18', 'viewBox fehlt');
check(g.includes('"fill":"url(#cu-test-0-0)"') && g.includes('"id":"cu-test-0-0"'), 'Verlauf umbenannt und verbunden');
check(g.includes('"clip-path":"url(#cu-test-0-1)"'), 'Beschneidung umbenannt');
check(g.includes('"fill":"#ff9900"'), 'Stilregel der Klasse übernommen');
check(g.includes('"stop-color":"#5ea0ef"'), 'style="" übernommen');
check(g.includes('M1.1235,2.9877L3.5 0.5Z'), `Zahlen gekürzt, Kurzschreibweise getrennt: ${g.match(/"d":"[^"]*"/)}`);
check(g.includes('"SQL"'), 'Text erhalten');
check(clean('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="32"><rect width="64" height="32"/></svg>').vb.join() === '0,0,64,32', 'Größe aus width/height');

/* ---------- Archiv-Erkennung ---------- */

async function imports() {
  const { planImport } = await import(path.join(__dirname, '..', 'public', 'js', 'shape-import.js'));
  // Aufbau wie in den Archiven der Hersteller, nur die Pfade (keine Dateien der Hersteller im Repo)
  const aws = planImport([
    'Architecture-Service-Icons_07312026/Arch_Compute/16/Arch_Amazon-EC2_16.svg', 'Architecture-Service-Icons_07312026/Arch_Compute/64/Arch_Amazon-EC2_64.svg',
    'Architecture-Service-Icons_07312026/Arch_Compute/48/Arch_Amazon-EC2_48.svg', '__MACOSX/Architecture-Service-Icons_07312026/Arch_Compute/64/._Arch_Amazon-EC2_64.svg',
    'Resource-Icons_07312026/Res_General-Icons/Res_48_Dark/Res_User_48_Dark.svg', 'Resource-Icons_07312026/Res_General-Icons/Res_48_Light/Res_User_48_Light.svg',
    'Resource-Icons_07312026/Res_Storage/Res_Amazon-Simple-Storage-Service_Bucket_48.svg', 'Category-Icons_07312026/Arch-Category_64/Arch-Category_Compute_64.svg',
    'Architecture-Service-Icons_07312026/Arch_Compute/64/Arch_Amazon-EC2_64.png',
  ], 'Icon-package_07312026.zip');
  check(aws.vendor === 'aws' && aws.items.length === 4, `AWS: ${aws.vendor} ${aws.items.length}`);
  const ec2 = aws.items.find((i) => i.name === 'Amazon EC2');
  check(ec2?.group === 'Compute' && ec2.path.endsWith('_64.svg'), `AWS: Größe 64 bevorzugt ${JSON.stringify(ec2)}`);
  check(aws.items.find((i) => i.name === 'User')?.path.includes('Light'), 'AWS: helle Fassung bevorzugt');
  check(aws.items.some((i) => i.group === 'Storage (Resources)' && i.name === 'Amazon Simple Storage Service Bucket'), 'AWS: Ressourcen-Gruppe');
  const azure = planImport(['Azure_Public_Service_Icons/Icons/compute/10021-icon-service-Virtual-Machine.svg', 'Azure_Public_Service_Icons/Icons/iot/10182-icon-service-IoT-Hub.svg', 'Azure_Public_Service_Icons/Microsoft_Terms_of_Use.pdf'], 'x.zip');
  check(azure.vendor === 'azure' && azure.items[0].name === 'Virtual Machine' && azure.items[0].group === 'Compute' && azure.items[1].group === 'IOT' && azure.skipped === 1, `Azure: ${JSON.stringify(azure.items)}`);
  const gcp = planImport(['Unique Icons/Cloud Run/SVG/CloudRun-512-color-rgb.svg', 'Unique Icons/Cloud Run/PNG/CloudRun-512-color-rgb.png', 'Category Icons/AI _ Machine Learning/SVG/AIMachineLearning-512-color.svg'], 'core.zip');
  check(gcp.vendor === 'gcp' && gcp.items.some((i) => i.name === 'Cloud Run' && i.group === 'Products') && gcp.items.some((i) => i.name === 'AI Machine Learning' && i.group === 'Categories'), `Google Cloud: ${JSON.stringify(gcp.items)}`);
  const own = planImport(['meine-symbole/netz/router_64.svg', 'meine-symbole/netz/router_32.svg', 'meine-symbole/netz/switch-dark.svg', 'meine-symbole/.DS_Store'], 'meine-symbole.zip');
  check(own.vendor === 'generic' && own.items.length === 2 && own.items[0].group === 'netz' && own.items.find((i) => i.name === 'router').path.endsWith('_64.svg'), `Eigenes Archiv: ${JSON.stringify(own.items)}`);
  check(own.name === 'meine symbole', `Name aus dem Archiv: ${own.name}`);
}

/* ---------- Mitgelieferte Sätze ---------- */

function sets() {
  const ICON_RE = /^(?:(ti|cb|kc|el|pi)-[a-z0-9]+(?:-[a-z0-9]+)*|cu-[a-z0-9]{6,12}-[a-z0-9]{1,6})$/; // wie lib/sanitize.js
  const dir = path.join(__dirname, '..', 'public', 'vendor', 'symbols');
  const client = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'symbol-files.js'), 'utf8');
  for (const set of ['cb', 'kc', 'el', 'pi']) {
    const m = new RegExp(`'${set}': '/vendor/symbols/([a-z]+-[0-9a-f]{8}\\.json)'`).exec(client);
    check(!!m, `Satz ${set} fehlt in public/js/symbol-files.js`);
    if (!m) continue;
    const data = JSON.parse(fs.readFileSync(path.join(dir, m[1]), 'utf8'));
    check(data.set === set && data.icons.length > 30, `Satz ${set}: ${data.icons.length} Symbole`);
    const names = new Set();
    for (const [name, group, , , vb, nodes] of data.icons) {
      check(ICON_RE.test(`${set}-${name}`) && `${set}-${name}`.length <= 40, `Satz ${set}: Name ${name}`);
      check(!names.has(name), `Satz ${set}: doppelt ${name}`);
      names.add(name);
      check(data.groups[group], `Satz ${set}: Gruppe fehlt bei ${name}`);
      check(vb.length === 4 && vb[2] > 0 && vb[3] > 0, `Satz ${set}: viewBox ${name}`);
      safe({ nodes }, `Satz ${set} ${name}`);
    }
  }
}

(async () => {
  await imports();
  sets();
  if (failures) {
    console.error(`${failures} von ${checks} Prüfungen fehlgeschlagen`);
    process.exit(1);
  }
  console.log(`SVG-Prüfung: ${checks} Prüfungen bestanden`);
})();
