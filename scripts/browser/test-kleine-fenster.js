// Bedienung in kleinen Fenstern
const { launch, login, BASE } = require('./lib');
let f = 0;
const ok = (c, m, x) => {
  console.log((c ? 'ok  ' : 'FAIL') + ' ' + m + (c || x === undefined ? '' : ' → ' + JSON.stringify(x).slice(0, 300)));
  if (!c) f++;
};
const api = (p, m, u, b) =>
  p.evaluate(
    async (m, u, b) => {
      const r = await fetch(u, {
        method: m,
        headers: { 'Content-Type': 'application/json', 'X-Vibeboard': '1' },
        body: b ? JSON.stringify(b) : undefined,
      });
      let j = null;
      try {
        j = await r.json();
      } catch {}
      return { status: r.status, body: j };
    },
    m,
    u,
    b,
  );
const sleep = (n) => new Promise((r) => setTimeout(r, n));
(async () => {
  const b = await launch();
  const A = await b.newPage();
  const errs = [];
  A.on('pageerror', (e) => errs.push(e.message));
  await A.setViewport({ width: 1366, height: 768 });
  await login(A, 'admin@test.example', 'Rotkehlchen-Wolke-47');
  const PNG =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mNk+M9Qz0AEYBxVSFIhAJbzBA3rQ8u4AAAAAElFTkSuQmCC';
  const id = (
    await api(A, 'POST', '/api/boards', {
      name: 'Ein ziemlich langer Boardname fuer die Kopfleiste',
      elements: [
        { id: 'f1', type: 'frame', x: 0, y: 0, w: 600, h: 400, title: 'F', z: 1 },
        { id: 'p1', type: 'image', x: 50, y: 50, w: 100, h: 100, src: PNG, fileRef: 'x', locked: true, z: 2 },
        { id: 'k', type: 'card', x: 0, y: 600, w: 300, h: 140, title: 'K', status: 'Offen' },
      ],
    })
  ).body.id;
  await A.goto(BASE + '/board/' + id, { waitUntil: 'load' });
  await sleep(2500);
  const J = (fn, ...a) => A.evaluate(fn, ...a);
  const cover = await J(() => {
    const t = document.getElementById('topbar').getBoundingClientRect(),
      r = document.getElementById('topright').getBoundingClientRect();
    return { t: t.right, r: r.left };
  });
  ok(cover.t <= cover.r, 'Kopfleiste überdeckt rechte Leiste nicht (1366 px)', cover);
  const reach = await J(() => {
    const b = document.querySelector('#topbar [aria-label*="Exportieren"]');
    b.scrollIntoView({ inline: 'nearest' });
    const r = b.getBoundingClientRect();
    const e = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return b.contains(e);
  });
  ok(reach, 'Export-Knopf erreichbar');
  await J(async () => {
    (await import('/js/core.js')).setSelection(['f1']);
  });
  await sleep(300);
  await A.keyboard.press('ArrowRight');
  await sleep(400);
  let m = await J(async () => {
    const c = await import('/js/core.js');
    return [c.getEl('f1').x, c.getEl('p1').x];
  });
  ok(m[0] > 0 && m[1] === 50 + m[0], 'Pfeil nimmt Seite mit', m);
  const n = await J(async () => {
    const { cellNumber: c } = await import('/js/render.js');
    return ['1e3', '1,5k', '(300)', '12 %', '7 €', '1.234,5 EUR', 'abc'].map(c);
  });
  ok(JSON.stringify(n) === JSON.stringify([null, null, -300, 12, 7, 1234.5, null]), 'Zahlen streng', n);
  // Kartendialog
  await J(async () => {
    (await import('/js/core.js')).app.emit('editCard', 'k');
  });
  await sleep(300);
  await J(async () => {
    const c = await import('/js/core.js');
    c.act(() => c.updateEl('k', { status: 'Fremd' }));
  });
  await sleep(200);
  await J(() => {
    const t = document.querySelector('.modal input[type=text]');
    t.value = 'Neu';
    t.dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelector('.modal form').requestSubmit();
  });
  await sleep(400);
  const k = await J(async () => {
    const e = (await import('/js/core.js')).getEl('k');
    return [e.title, e.status];
  });
  ok(k[0] === 'Neu' && k[1] === 'Fremd', 'Dialog überschreibt fremde Änderung nicht', k);
  // Esc schließt Farbmenü, Pptx-Farben
  const col = await J(async () => {
    const { parsePptx } = await import('/js/pptx-import.js');
    const { writeZip } = await import('/js/zip.js');
    const NS =
      'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
    const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
    const blob = await writeZip([
      {
        name: 'ppt/presentation.xml',
        data: `<p:presentation ${NS}><p:sldIdLst><p:sldId id="256" r:id="rId1"/></p:sldIdLst><p:sldSz cx="9525000" cy="5715000"/></p:presentation>`,
      },
      {
        name: 'ppt/_rels/presentation.xml.rels',
        data: `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${REL}/slide" Target="slides/slide1.xml"/></Relationships>`,
      },
      {
        name: 'ppt/theme/theme1.xml',
        data: `<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:themeElements><a:clrScheme name="x"><a:accent1><a:srgbClr val="4472C4"/></a:accent1><a:accent2><a:srgbClr val="ED7D31"/></a:accent2></a:clrScheme></a:themeElements></a:theme>`,
      },
      {
        name: 'ppt/slides/slide1.xml',
        data: `<p:sld ${NS}><p:cSld><p:spTree><p:sp><p:nvSpPr><p:cNvPr id="2" name="s"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="952500" cy="952500"/></a:xfrm><a:prstGeom prst="rect"/></p:spPr><p:style><a:lnRef idx="2"><a:schemeClr val="accent1"/></a:lnRef><a:fillRef idx="1"><a:schemeClr val="accent1"/></a:fillRef></p:style></p:sp><p:sp><p:nvSpPr><p:cNvPr id="3" name="t"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="952500" cy="952500"/></a:xfrm><a:prstGeom prst="rect"/><a:solidFill><a:schemeClr val="accent2"><a:lumMod val="40000"/><a:lumOff val="60000"/></a:schemeClr></a:solidFill></p:spPr></p:sp></p:spTree></p:cSld></p:sld>`,
      },
    ]);
    const r = await parsePptx(await blob.arrayBuffer());
    return r.elements.filter((e) => e.type === 'shape').map((e) => e.fill);
  });
  console.log('   ', col);
  ok(col[0] === '#4472C4' && col[1] && col[1].toLowerCase() === '#f8cbad', 'Farben aus Stil und aufgehellt', col);
  ok(!errs.length, 'keine Skriptfehler', errs);
  await b.close();
  console.log(f ? f + ' FEHLER' : 'ALLE OK');
})().catch((e) => {
  console.log('ABBRUCH', e);
  process.exit(1);
});
