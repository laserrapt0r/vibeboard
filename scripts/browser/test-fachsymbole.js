// Fachsymbole und eigene Formenpakete: Kubernetes, IT und Technik, Elektro- und Verfahrenstechnik, Import in der Administration,
// Bereinigung, zwei Personen (eine davon im Rückfall-Transport), Format, Exporte, Löschen eines Pakets
const { launch, BASE } = require('./lib');
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
let f = 0;
const ok = (c, m, x) => {
  console.log((c ? 'ok  ' : 'FAIL') + ' ' + m + (c || x === undefined ? '' : ' → ' + JSON.stringify(x).slice(0, 300)));
  if (!c) f++;
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const api = (p, m, u, b) => p.evaluate(async (m, u, b) => {
  const r = await fetch(u, { method: m, headers: { 'Content-Type': 'application/json', 'X-Vibeboard': '1' }, body: b ? JSON.stringify(b) : undefined });
  let j = null;
  try {
    j = await r.json();
  } catch {}
  return { status: r.status, body: j };
}, m, u, b);
const login = async (p, e, pw) => {
  await p.goto(BASE + '/login', { waitUntil: 'networkidle0' });
  const r = await api(p, 'POST', '/api/auth/login', { login: e, password: pw });
  if (r.status >= 300) throw new Error('login ' + e);
};
const ev = (p, fn, ...a) => p.evaluate(fn, ...a);
const els = (p) => ev(p, async () => [...(await import('/js/core.js')).app.els.values()].filter((e) => e.type === 'shape').map((e) => JSON.parse(JSON.stringify(e))));
const groupNames = (p) => ev(p, () => [...document.querySelectorAll('#sidepanel .shape-group > .shape-group-head .shape-group-name')].map((x) => x.textContent));
const hits = async (p, q) => {
  await ev(p, () => {
    const i = document.querySelector('.shape-search input');
    i.value = '';
    i.focus();
  });
  await p.keyboard.type(q);
  // Die Fachsätze laden erst mit der ersten Suche
  await p.waitForFunction(() => !document.querySelector('#sidepanel .shape-status'), { timeout: 8000 }).catch(() => {});
  await wait(120);
  return ev(p, () => [...document.querySelectorAll('#sidepanel .shape-btn')].filter((b) => b.offsetParent).map((b) => b.dataset.shape));
};
const clearSearch = (p) => ev(p, () => {
  const i = document.querySelector('.shape-search input');
  i.value = '';
  i.dispatchEvent(new Event('input'));
});
// Klick auf den Knopf im Panel, dann aufs Board: legt die Form an dieser Stelle ab
const place = async (p, k, x, y) => {
  const r = await ev(p, (k) => {
    const b = [...document.querySelectorAll(`#sidepanel .shape-btn[data-shape="${k}"]`)].find((x) => x.offsetParent);
    if (!b) return null;
    b.scrollIntoView({ block: 'center' });
    const q = b.getBoundingClientRect();
    return { x: q.x + q.width / 2, y: q.y + q.height / 2 };
  }, k);
  if (!r) return false;
  await p.mouse.click(r.x, r.y);
  await wait(100);
  await p.mouse.click(x, y);
  await wait(250);
  return true;
};
const drawn = (p, id) => ev(p, (id) => {
  const g = document.querySelector(`[data-id="${id}"] g[transform]`);
  return g ? { kids: g.querySelectorAll('*').length, fill: g.getAttribute('fill'), stroke: g.getAttribute('stroke'), colors: [...new Set([...g.querySelectorAll('[fill]')].map((x) => x.getAttribute('fill')))].slice(0, 6), html: g.innerHTML.slice(0, 20000) } : null;
}, id);
const ctxTitles = (p) => ev(p, () => [...document.querySelectorAll('#ctxbar button')].map((x) => x.title || x.getAttribute('aria-label')).filter(Boolean));
const selectEl = (p, id) => ev(p, async (id) => {
  const c = await import('/js/core.js');
  c.setSelection([id]);
}, id);

// Kleines ZIP ohne Kompression: Aufbau wie das Archiv eines Herstellers, Inhalt selbst gezeichnet
function crc32(buf) {
  let c, crc = 0xffffffff;
  for (const b of buf) {
    c = (crc ^ b) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function zip(files) {
  const parts = [], central = [];
  let offset = 0;
  for (const [name, text] of files) {
    const data = Buffer.from(text), n = Buffer.from(name), crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt32LE(crc, 14); local.writeUInt32LE(data.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(n.length, 26);
    const cen = Buffer.alloc(46);
    cen.writeUInt32LE(0x02014b50, 0); cen.writeUInt16LE(20, 4); cen.writeUInt16LE(20, 6); cen.writeUInt32LE(crc, 16); cen.writeUInt32LE(data.length, 20); cen.writeUInt32LE(data.length, 24); cen.writeUInt16LE(n.length, 28); cen.writeUInt32LE(offset, 42);
    parts.push(local, n, data);
    central.push(cen, n);
    offset += 30 + n.length + data.length;
  }
  const cd = Buffer.concat(central), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, cd, end]);
}
void zlib;

const SVG = (body, vb = '0 0 64 64') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}">${body}</svg>`;
const ARCHIVE = [
  ['Architecture-Service-Icons_01012026/Arch_Compute/64/Arch_Test-Rechner_64.svg', SVG('<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff9900"/><stop offset="1" stop-color="#c45500"/></linearGradient></defs><rect width="64" height="64" fill="url(#g)"/><path d="M16 16h32v32H16z" fill="#ffffff"/>')],
  ['Architecture-Service-Icons_01012026/Arch_Compute/16/Arch_Test-Rechner_16.svg', SVG('<rect width="16" height="16" fill="#000"/>', '0 0 16 16')],
  ['Architecture-Service-Icons_01012026/Arch_Storage/64/Arch_Test-Speicher_64.svg', SVG('<rect width="64" height="64" fill="#3f8624"/><circle cx="32" cy="32" r="14" fill="#fff"/>')],
  // Böswillig: Skript, Ereignis, externes Bild. Die Zeichnung bleibt, der Rest fällt weg.
  ['Architecture-Service-Icons_01012026/Arch_Storage/64/Arch_Test-Falle_64.svg', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" onload="window.__pwned=1"><script>window.__pwned=2</script><image href="https://example.invalid/x.png" width="64" height="64"/><rect width="64" height="64" fill="#dd344c" onclick="window.__pwned=3"/></svg>'],
  // Kaputt: wird mit Grund abgelehnt
  ['Architecture-Service-Icons_01012026/Arch_Storage/64/Arch_Test-Kaputt_64.svg', '<svg xmlns="http://www.w3.org/2000/svg"><rect width="1" height="1"/></svg>'],
  ['Architecture-Service-Icons_01012026/Arch_Compute/64/Arch_Test-Rechner_64.png', 'kein svg'],
];

(async () => {
  const b = await launch();
  const errs = [];
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vb-symbole-'));
  const A = await b.newPage();
  A.on('pageerror', (e) => errs.push('A ' + e.message));
  await A.setViewport({ width: 1400, height: 950 });
  await login(A, 'admin@test.example', 'Rotkehlchen-Wolke-47');
  await api(A, 'PUT', '/api/admin/settings', { design: { shapePacksOff: '' } });
  await api(A, 'PUT', '/api/auth/me/shape-packs', { off: [] });
  // Pakete aus früheren Läufen
  for (const p of (await api(A, 'GET', '/api/shape-packs')).body || []) if (/^Test/.test(p.name)) await api(A, 'DELETE', '/api/admin/shape-packs/' + p.id);

  /* ---------- Import in der Administration ---------- */
  await A.goto(BASE + '/admin#brand', { waitUntil: 'networkidle0' });
  await A.waitForFunction(() => [...document.querySelectorAll('h2')].some((h) => /Eigene Formenpakete/.test(h.textContent)), { timeout: 8000 });
  const file = path.join(tmp, 'Test-Paket_01012026.zip');
  fs.writeFileSync(file, zip(ARCHIVE));
  const [chooser] = await Promise.all([A.waitForFileChooser(), ev(A, () => [...document.querySelectorAll('.custom-packs button')].find((x) => /Formenpaket importieren/.test(x.textContent)).click())]);
  await chooser.accept([file]);
  await A.waitForSelector('.modal input[type=text]', { timeout: 8000 });
  const dlg = await ev(A, () => ({ text: document.querySelector('.modal').textContent, name: document.querySelector('.modal input[type=text]').value }));
  ok(/4 Symbole erkannt/.test(dlg.text) && /Aufbau erkannt: AWS/.test(dlg.text), 'Import erkennt den Aufbau und wählt je Symbol eine Größe', dlg.text.slice(0, 200));
  ok(/1 andere Dateien|andere Dateien werden übersprungen/.test(dlg.text), 'Andere Dateien werden übersprungen');
  await ev(A, () => {
    const i = document.querySelector('.modal input[type=text]');
    i.value = 'Test Cloud';
  });
  await ev(A, () => document.querySelector('.modal button[type=submit]').click());
  await A.waitForFunction(() => /Import abgeschlossen/.test(document.querySelector('.modal')?.textContent || ''), { timeout: 15000 });
  const result = await ev(A, () => document.querySelector('.modal').textContent);
  ok(/3 Symbole wurden übernommen/.test(result) && /1 Datei wurde abgelehnt/.test(result) && /Kaputt/.test(result) && /keine Größenangabe/.test(result), 'Ergebnis nennt Übernommene und Abgelehnte mit Grund', result.slice(0, 300));
  await A.keyboard.press('Escape');
  const packs = (await api(A, 'GET', '/api/shape-packs')).body;
  const pack = packs.find((p) => p.name === 'Test Cloud');
  ok(pack && pack.count === 3 && pack.source === 'Amazon Web Services, AWS Architecture Icons', 'Paket mit Herkunft angelegt', packs);
  const data = (await api(A, 'GET', '/api/shape-packs/' + pack.id)).body;
  ok(data.groups.map((g) => g[1]).join() === 'Compute,Storage' && data.icons.map((i) => i[2]).sort().join() === 'Test Falle,Test Rechner,Test Speicher', 'Gruppen und Namen aus dem Archiv', data.groups);
  const trap = JSON.stringify(data.icons.find((i) => i[2] === 'Test Falle'));
  ok(!/pwned|script|onload|onclick|image|example\.invalid/.test(trap) && /dd344c/.test(trap), 'Böswillige Teile entfernt, Zeichnung erhalten', trap);
  const rechner = data.icons.find((i) => i[2] === 'Test Rechner');
  ok(rechner[4].join() === '0,0,64,64', 'Größe 64 statt 16 übernommen', rechner[4]);
  // Nicht-Admins dürfen nichts anlegen
  // Eigener Kontext: Sonst teilen sich beide Seiten die Anmeldung
  const Bp = await (await b.createBrowserContext()).newPage();
  Bp.on('pageerror', (e) => errs.push('B ' + e.message));
  await Bp.setViewport({ width: 1300, height: 900 });
  await login(Bp, 'anna@example.org', 'Gewitter-Laterne-83');
  ok((await api(Bp, 'POST', '/api/admin/shape-packs', { name: 'X' })).status === 403, 'Anlegen nur für die Administration');
  ok((await api(Bp, 'GET', '/api/shape-packs/' + pack.id)).status === 200, 'Lesen für alle Angemeldeten');

  /* ---------- Panel ---------- */
  const id = (await api(A, 'POST', '/api/boards', { name: 'Fachsymbole' })).body.id;
  await api(A, 'POST', `/api/boards/${id}/members`, { email: 'anna@example.org', role: 'editor' });
  await A.goto(BASE + '/board/' + id, { waitUntil: 'load' });
  await wait(1200);
  await ev(A, () => document.querySelector('#empty-start .btn:last-child')?.click());
  await ev(A, async () => (await import('/js/shapes-panel.js')).openShapesPanel());
  await A.waitForFunction(() => [...document.querySelectorAll('#sidepanel .shape-group-name')].some((x) => x.textContent === 'Test Cloud'), { timeout: 8000 });
  const names = await groupNames(A);
  for (const n of ['Kubernetes', 'IT und Technik', 'Elektrotechnik', 'Verfahrenstechnik', 'Test Cloud']) ok(names.includes(n), `Paket im Panel: ${n}`, names);
  // Fachpakete sind anfangs zu und laden erst beim Aufklappen
  const closed = await ev(A, () => [...document.querySelectorAll('#sidepanel .shape-group > .shape-group-head')].filter((x) => x.getAttribute('aria-expanded') === 'false').map((x) => x.querySelector('.shape-group-name').textContent));
  ok(['Kubernetes', 'IT und Technik', 'Elektrotechnik', 'Verfahrenstechnik', 'Test Cloud'].every((n) => closed.includes(n)) && !closed.includes('Allgemeine Symbole'), 'Fachpakete starten zugeklappt', closed);
  ok(!(await ev(A, async () => (await import('/js/icons.js')).setLoaded('cb'))), 'IT-Symbole noch nicht geladen');
  await ev(A, () => [...document.querySelectorAll('#sidepanel .shape-group-head')].find((x) => x.textContent.includes('Kubernetes')).click());
  await A.waitForFunction(() => document.querySelectorAll('#sidepanel .shape-btn[data-shape^="kc-"]').length > 0, { timeout: 8000 }).catch(() => {});
  const kc = await ev(A, () => [...document.querySelectorAll('#sidepanel .shape-sub-head .shape-group-name')].map((x) => x.textContent));
  ok(kc.includes('Workloads') && kc.includes('Zugriff und Rechte'), 'Kubernetes aufgeklappt zeigt seine Gruppen', kc);
  const preview = await ev(A, () => document.querySelector('#sidepanel .shape-btn[data-shape^="kc-"] svg')?.innerHTML.length || 0);
  ok(preview > 100, 'Vorschau im Knopf gezeichnet', preview);

  // Suche über alle Sätze, auch auf Deutsch
  const s1 = await hits(A, 'Widerstand');
  ok(s1[0] === 'el-resistor' && s1.includes('el-resistor-variable'), 'Suche „Widerstand“ findet Elektrosymbole', s1.slice(0, 10));
  const s2 = await hits(A, 'Kreiselpumpe');
  ok(s2[0] === 'pi-pump-centrifugal', 'Suche „Kreiselpumpe“', s2.slice(0, 5));
  const s3 = await hits(A, 'machine learning');
  ok(s3.some((k) => k.startsWith('cb-machine-learning')), 'Suche „machine learning“ findet IT-Symbole', s3.slice(0, 8));
  const s4 = await hits(A, 'Ingress');
  ok(s4.includes('kc-ingress'), 'Suche „Ingress“ findet Kubernetes', s4.slice(0, 8));
  const s5 = await hits(A, 'Rechner');
  ok(s5.some((k) => k.startsWith(`cu-${pack.id}-`)), 'Suche findet Symbole aus eigenem Paket', s5.slice(0, 8));

  // Ablegen: je ein Symbol aus jedem Satz
  // Das Panel liegt links: Abgelegt wird rechts davon
  const want = [['el-resistor', 560, 300], ['pi-pump-centrifugal', 760, 300], ['kc-pod', 960, 300], ['cb-machine-learning-model', 1160, 300]];
  for (const [k, x, y] of want) {
    await hits(A, { 'el-resistor': 'Widerstand', 'pi-pump-centrifugal': 'Kreiselpumpe', 'kc-pod': 'Pod', 'cb-machine-learning-model': 'machine learning model' }[k]);
    ok(await place(A, k, x, y), `Knopf für ${k} gefunden`);
  }
  await hits(A, 'Test Falle');
  const trapKey = (await ev(A, () => [...document.querySelectorAll('#sidepanel .shape-btn')].map((b) => b.dataset.shape)))[0];
  ok(await place(A, trapKey, 760, 550), 'Eigenes Symbol abgelegt');
  await clearSearch(A);
  await wait(400);
  const list = await els(A);
  const byShape = Object.fromEntries(list.map((e) => [e.shape, e]));
  for (const [k] of want) ok(byShape[k], `${k} liegt auf dem Board`, list.map((e) => e.shape));
  ok(byShape['el-resistor']?.w === 96 && byShape['el-resistor']?.h === 32, 'Elektrosymbol in gezeichneter Größe', byShape['el-resistor']);
  ok(byShape['kc-pod']?.w <= 96 && byShape['kc-pod']?.h <= 96, 'Kubernetes passt in 96 × 96', byShape['kc-pod']);
  const r = await drawn(A, byShape['el-resistor']?.id);
  ok(r && r.stroke && r.fill === 'none' && r.kids >= 2, 'Elektrosymbol als Linien gezeichnet', r);
  const c = await drawn(A, byShape['cb-machine-learning-model']?.id);
  ok(c && c.fill && c.fill !== 'none' && c.stroke === 'none', 'IT-Symbol als Fläche in Linienfarbe', c);
  const k8 = await drawn(A, byShape['kc-pod']?.id);
  ok(k8 && k8.colors.some((x) => /326ce5/i.test(x)), 'Kubernetes behält seine Farben', k8?.colors);
  const t = await drawn(A, byShape[trapKey]?.id);
  ok(t && /dd344c/.test(t.html) && !/script|onload|onclick|image/i.test(t.html), 'Eigenes Symbol ohne Skript gezeichnet', t?.html.slice(0, 200));
  ok(!(await ev(A, () => window.__pwned)), 'Nichts aus der Datei ausgeführt');

  // Format: Linienstärke nur bei Liniensymbolen, Farben nicht bei farbigen
  await selectEl(A, byShape['el-resistor'].id);
  await wait(200);
  // Mehrere Regler stecken hinter „Farbe“
  await ev(A, () => [...document.querySelectorAll('#ctxbar button')].find((x) => x.title === 'Farbe')?.click());
  await wait(150);
  const tEl = await ctxTitles(A);
  ok(tEl.includes('Linienfarbe') && tEl.includes('Linienstärke'), 'Elektrosymbol: Linienfarbe und -stärke', tEl);
  await selectEl(A, byShape['cb-machine-learning-model'].id);
  await wait(200);
  const tCb = await ctxTitles(A);
  ok(tCb.includes('Symbolfarbe') && !tCb.includes('Linienstärke'), 'IT-Symbol: nur die Farbe', tCb);
  await selectEl(A, byShape['kc-pod'].id);
  await wait(200);
  const tKc = await ctxTitles(A);
  ok(!tKc.some((x) => /farbe|Linienstärke/i.test(x)), 'Kubernetes: keine Farbwahl', tKc);
  await A.keyboard.press('Escape');

  /* ---------- Zweite Person im Rückfall-Transport ---------- */
  await Bp.goto(BASE + '/board/' + id + '?transport=poll', { waitUntil: 'load' });
  await Bp.waitForFunction((n) => document.querySelectorAll('[data-id] g[transform]').length >= n, { timeout: 12000 }, 5).catch(() => {});
  for (const [k] of [...want, [trapKey]]) {
    const d = await drawn(Bp, byShape[k].id);
    ok(d && d.kids > 0, `Zweite Person sieht ${k}`, d);
  }
  ok(!(await ev(Bp, () => window.__pwned)), 'Auch bei der zweiten Person nichts ausgeführt');

  /* ---------- Exporte ---------- */
  const exp = await ev(A, async () => {
    const c = await import('/js/core.js');
    const x = await import('/js/exporter.js');
    const all = [...c.app.els.values()];
    const svg = x.svgString(all, {});
    const png = await x.pngDataUrl(all, { scale: 1 });
    return { svg: svg.length, hasRes: /path/.test(svg), png: png.length };
  }).catch((e) => ({ error: String(e) }));
  ok(exp.png > 1000 && exp.hasRes, 'SVG- und PNG-Export mit Fachsymbolen', exp);

  /* ---------- Persönliche Auswahl ---------- */
  await api(A, 'PUT', '/api/auth/me/shape-packs', { off: ['electrical', 'cu-' + pack.id] });
  await A.reload({ waitUntil: 'load' });
  await wait(1200);
  await ev(A, async () => (await import('/js/shapes-panel.js')).openShapesPanel());
  await wait(800);
  const names2 = await groupNames(A);
  ok(!names2.includes('Elektrotechnik') && !names2.includes('Test Cloud') && names2.includes('Verfahrenstechnik'), 'Abgewählte Pakete fehlen im Panel', names2);
  ok(!(await hits(A, 'Widerstand')).some((k) => k.startsWith('el-')), 'Abgewählte Pakete fehlen in der Suche');
  ok(await drawn(A, byShape['el-resistor'].id), 'Vorhandene Elemente bleiben sichtbar');
  await api(A, 'PUT', '/api/auth/me/shape-packs', { off: [] });

  /* ---------- Verwaltung zeigt Herkunft ---------- */
  await clearSearch(A);
  await ev(A, () => [...document.querySelectorAll('#sidepanel button')].find((x) => /Formen verwalten/.test(x.textContent)).click());
  await wait(200);
  const manage = await ev(A, () => document.querySelector('.shape-manage').textContent);
  ok(/Kubernetes Icons Set/.test(manage) && /Apache-2\.0/.test(manage) && /IEC 60617/.test(manage) && /ISO 10628/.test(manage) && /Tabler Icons/.test(manage), 'Herkunft und Lizenz in der Verwaltung', manage.slice(0, 400));
  await ev(A, () => [...document.querySelectorAll('#sidepanel button')].find((x) => /Zurück zu den Formen/.test(x.textContent)).click());

  /* ---------- Paket löschen ---------- */
  ok((await api(A, 'DELETE', '/api/admin/shape-packs/' + pack.id)).status === 200, 'Paket gelöscht');
  await Bp.reload({ waitUntil: 'load' });
  await wait(2500);
  const ph = await ev(Bp, (id) => document.querySelector(`[data-id="${id}"]`)?.textContent || '', byShape[trapKey].id);
  ok(/Symbol fehlt/.test(ph), 'Gelöschtes Paket: Platzhalter mit Hinweis', ph);
  // Unbekannte Namen landen nicht als Inhalt auf dem Server
  const bad = await ev(A, async () => {
    const c = await import('/js/core.js');
    const send = (el) => fetch(`/api/boards/${c.app.boardId}/ops`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Vibeboard': '1' }, body: JSON.stringify({ clientId: c.app.sync.clientId, ops: [{ op: 'upsert', el }] }) }).then((r) => r.status);
    const a = c.makeElement('shape', 0, 0, { shape: 'cu-zz"><script>' });
    const b = c.makeElement('shape', 50, 0, { shape: 'cu-zzzzzz-1' });
    return { ids: [a.id, b.id], status: [await send(a), await send({ ...b, svg: '<script>', nodes: [['script', {}]], d: 'M0 0' })] };
  });
  // Die eigene Änderung kommt nicht zurück: Was der Server gespeichert hat, sieht die zweite Person
  await wait(1500);
  const now = await els(Bp);
  const e1 = now.find((e) => e.id === bad.ids[0]), e2 = now.find((e) => e.id === bad.ids[1]);
  ok(bad.status.every((x) => x < 300) && e1?.shape === 'rect', 'Ungültiger Symbolname wird zum Rechteck', [bad, e1?.shape]);
  ok(e2?.shape === 'cu-zzzzzz-1' && !e2.svg && !e2.nodes && !e2.d, 'Mitgeschickter Inhalt eines Symbols entfällt', e2);

  // Erst weg vom Board: Die Seite der Besitzerin wechselt sonst beim Löschen mitten im Aufruf
  await A.goto(BASE + '/', { waitUntil: 'load' });
  await api(A, 'DELETE', '/api/boards/' + id);
  ok(!errs.length, 'Keine Fehler in den Seiten', errs);
  fs.rmSync(tmp, { recursive: true, force: true });
  await b.close();
  console.log(f ? `${f} fehlgeschlagen` : 'alles ok');
  process.exit(f ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
