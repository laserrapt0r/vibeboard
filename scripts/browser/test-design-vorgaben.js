// Design-Vorgaben der Administration und ausgeblendete Vorlagen
const { launch, login, BASE } = require('./lib');
const fs = require('fs'),
  zlib = require('zlib');
let f = 0;
const ok = (c, m, x) => {
  console.log((c ? 'ok  ' : 'FAIL') + ' ' + m + (c || x === undefined ? '' : ' → ' + JSON.stringify(x).slice(0, 400)));
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
const DRAW = `<mxfile><diagram name="Seite"><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>
<mxCell id="a" value="Start &lt;b&gt;fett&lt;/b&gt;" style="ellipse;fillColor=#dae8fc;strokeColor=#6c8ebf;" vertex="1" parent="1"><mxGeometry x="100" y="100" width="120" height="60" as="geometry"/></mxCell>
<mxCell id="b" value="Prüfen?" style="rhombus;whiteSpace=wrap;html=1;" vertex="1" parent="1"><mxGeometry x="300" y="100" width="120" height="80" as="geometry"/></mxCell>
<mxCell id="c" value="Text" style="text;html=1;" vertex="1" parent="1"><mxGeometry x="100" y="300" width="100" height="30" as="geometry"/></mxCell>
<mxCell id="sw" value="Gruppe" style="swimlane;" vertex="1" parent="1"><mxGeometry x="500" y="100" width="300" height="200" as="geometry"/></mxCell>
<mxCell id="d" value="Innen" style="rounded=1;" vertex="1" parent="sw"><mxGeometry x="20" y="40" width="100" height="50" as="geometry"/></mxCell>
<mxCell id="e1" value="ja" style="edgeStyle=orthogonalEdgeStyle;endArrow=classic;" edge="1" parent="1" source="a" target="b"><mxGeometry relative="1" as="geometry"/></mxCell>
<mxCell id="e2" style="endArrow=none;dashed=1;" edge="1" parent="1" source="b" target="d"><mxGeometry relative="1" as="geometry"><Array as="points"><mxPoint x="450" y="200"/></Array></mxGeometry></mxCell>
<mxCell id="lbl" value="nein" style="edgeLabel;" vertex="1" connectable="0" parent="e2"><mxGeometry relative="1" as="geometry"/></mxCell>
</root></mxGraphModel></diagram></mxfile>`;
const INNER = encodeURIComponent(DRAW.match(/<mxGraphModel>.*<\/mxGraphModel>/s)[0]);
const COMP = `<mxfile><diagram name="Komprimiert">${zlib.deflateRawSync(Buffer.from(INNER)).toString('base64')}</diagram></mxfile>`;
(async () => {
  const b = await launch();
  const A = await b.newPage();
  const errs = [];
  A.on('pageerror', (e) => errs.push(e.message));
  await login(A, 'leitung@test.example', 'Rotkehlchen-Wolke-47');
  const id = (await api(A, 'POST', '/api/boards', { name: 'T101', elements: [] })).body.id;
  await A.goto(BASE + '/board/' + id, { waitUntil: 'load' });
  await sleep(2000);
  const J = (fn, ...a) => A.evaluate(fn, ...a);
  const dr = await J(async (t) => {
    const { parseDrawio } = await import('/js/import-drawio.js');
    const l = await parseDrawio(t);
    return l.map((e) => ({
      t: e.type,
      s: e.shape,
      x: e.x,
      y: e.y,
      txt: e.text || e.title || e.label,
      from: !!e.from?.id,
      to: !!e.to?.id,
      r: e.routing,
      a: e.arrowEnd,
      d: e.dash,
    }));
  }, DRAW);
  console.log(dr);
  ok(
    dr.filter((e) => e.t === 'connector').length === 2 && dr.every((e) => e.t !== 'connector' || (e.from && e.to)),
    'draw.io: Verbindungen bleiben angedockt',
    dr,
  );
  ok(dr.find((e) => e.txt === 'Innen')?.x === 520, 'draw.io: Kinder relativ zum Eltern-Element');
  ok(dr.find((e) => e.s === 'diamond') && dr.find((e) => e.t === 'frame') && dr.find((e) => e.t === 'text'), 'draw.io: Formen');
  ok(
    dr.find((e) => e.txt === 'nein'),
    'draw.io: Beschriftung an Kante',
  );
  ok(dr[0].txt === 'Start fett', 'HTML wird Text', dr[0].txt);
  ok(
    (await J(async (t) => (await (await import('/js/import-drawio.js')).parseDrawio(t)).length, COMP)) === dr.length,
    'draw.io: komprimierte Datei',
  );
  ok(
    (await J(async () =>
      (await import('/js/import-file.js')).readForeign(new File(['kein xml'], 'x.drawio')).then(
        () => 'ok',
        (e) => e.message,
      ),
    )) !== 'ok',
    'kaputte Datei: klare Meldung',
  );
  // Export
  const made = await J(async () => {
    const c = await import('/js/core.js');
    const png = 'iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mNk+M9Qz0AEYBxVSFIhAJbzBA3rQ8u4AAAAAElFTkSuQmCC';
    const els = [
      { id: 'f', type: 'frame', x: 0, y: 0, w: 960, h: 540, title: 'Folie 1', order: 1, z: 1 },
      { id: 'st', type: 'sticky', x: 40, y: 40, w: 200, h: 200, text: 'Notiz <&> äöü', fill: '#fff9b1', z: 2 },
      {
        id: 'sh',
        type: 'shape',
        shape: 'ellipse',
        x: 300,
        y: 40,
        w: 200,
        h: 120,
        text: 'Kreis',
        fill: '#a6ccf5',
        stroke: '#1a1a1a',
        strokeWidth: 2,
        z: 3,
      },
      { id: 'tx', type: 'text', x: 40, y: 300, w: 300, h: 40, text: 'Freier Text', fontSize: 24, z: 4 },
      { id: 'im', type: 'image', x: 560, y: 40, w: 100, h: 100, src: 'data:image/png;base64,' + png, z: 5 },
      {
        id: 'tb',
        type: 'table',
        x: 560,
        y: 200,
        w: 300,
        h: 120,
        rows: 2,
        cols: 2,
        header: true,
        fontSize: 14,
        cells: [
          ['A', 'B'],
          ['1', '2'],
        ],
        z: 6,
      },
      { id: 'cn', type: 'connector', from: { id: 'st' }, to: { id: 'sh' }, routing: 'straight', z: 7 },
      { id: 'cd', type: 'card', x: 40, y: 360, w: 300, h: 140, title: 'Karte', z: 8 },
      { id: 'f2', type: 'frame', x: 1100, y: 0, w: 800, h: 600, title: 'Folie 2', order: 2, z: 9 },
      { id: 'n2', type: 'sticky', x: 1200, y: 100, w: 200, h: 200, text: 'Zweite', fill: '#93d275', z: 10 },
    ];
    c.act(() => els.forEach((e) => c.setEl(e)));
    return true;
  });
  await sleep(500);
  const px = await J(async () => {
    const c = await import('/js/core.js');
    const { buildPptx } = await import('/js/pptx-export.js');
    const { readZip } = await import('/js/zip.js');
    const { sortForRender } = await import('/js/render.js');
    const fr = c.frames();
    const all = [...c.app.els.values()];
    const slides = fr.map((f) => {
      const k = c.frameChildren(f);
      const ids = new Set(k.map((e) => e.id));
      return {
        bounds: { x: f.x, y: f.y, w: f.w, h: f.h },
        elements: sortForRender([
          ...k.filter((e) => e.type !== 'connector'),
          ...all.filter((e) => e.type === 'connector' && ids.has(e.from.id) && ids.has(e.to.id)),
        ]),
      };
    });
    const blob = await buildPptx(slides, c.getEl);
    const buf = await blob.arrayBuffer();
    const z = await readZip(buf);
    const s1 = await z.text('ppt/slides/slide1.xml');
    const doc = new DOMParser().parseFromString(s1, 'application/xml');
    const { parsePptx } = await import('/js/pptx-import.js');
    const back = await parsePptx(buf);
    let bin = '';
    const u = new Uint8Array(buf);
    for (let i = 0; i < u.length; i += 32768) bin += String.fromCharCode(...u.subarray(i, i + 32768));
    return {
      slides: fr.length,
      names: z.names.length,
      err: !!doc.querySelector('parsererror'),
      s1: s1.length,
      back: back.elements.map((e) => ({ t: e.type, x: Math.round(e.x), txt: e.text || e.title || '' })),
      skipped: back.skipped,
      b64: btoa(bin),
    };
  });
  console.log('   ', px.slides, px.names, px.s1, JSON.stringify(px.back).slice(0, 700), px.skipped);
  fs.writeFileSync('out.pptx', Buffer.from(px.b64, 'base64'));
  ok(px.slides === 2 && !px.err, 'PowerPoint: zwei Folien, gültiges XML');
  ok(px.back.filter((e) => e.t === 'frame').length === 2, 'Rückimport: Folien als Frames');
  ok(
    px.back.some((e) => e.txt === 'Notiz <&> äöü'),
    'Text und Umlaute bleiben',
  );
  ok(
    px.back.some((e) => e.t === 'image'),
    'Bild bleibt',
  );
  ok(
    px.back.some((e) => e.t === 'table'),
    'Tabelle bleibt',
  );
  ok(
    px.back.some((e) => e.t === 'connector'),
    'Linie bleibt',
  );
  ok(
    px.back.some((e) => e.t === 'shape'),
    'Form bleibt',
  );
  // Design und zentrale Vorlagen
  let p = await api(A, 'PUT', '/api/admin/settings', {
    design: { accent: '#ffcc00', palette: '#112233 #445566', stickyColors: '#fff9b1 #a6ccf5', hideBuiltin: true },
  });
  ok(p.status === 200, 'Design gespeichert', p.status);
  p = await api(A, 'PUT', '/api/admin/settings', { design: { accent: 'gelb' } });
  ok(p.status === 400, 'ungültige Farbe abgelehnt');
  // Reste abgebrochener Läufe stören die Zählung unten
  for (const old of (await api(A, 'GET', '/api/templates')).body?.templates || []) if (old.name === 'Firmenvorlage') await api(A, 'DELETE', '/api/templates/' + old.id);
  const t = await api(A, 'POST', '/api/templates', {
    name: 'Firmenvorlage',
    org: true,
    elements: [{ id: 'x', type: 'sticky', x: 0, y: 0, w: 100, h: 100, text: 'Hi' }],
  });
  ok(t.status === 201, 'zentrale Vorlage', t);
  const email = 'nutzer' + Date.now() + '@example.org';
  await api(A, 'POST', '/api/admin/users', { name: 'Nutzer', email, password: 'Gewitter-Laterne-83', role: 'user' });
  const c2 = await b.createBrowserContext();
  const B = await c2.newPage();
  await login(B, email, 'Gewitter-Laterne-83');
  const tl = (await api(B, 'GET', '/api/templates')).body.templates;
  ok(
    tl.some((x) => x.scope === 'org' && !x.canDelete),
    'alle sehen zentrale Vorlage',
    tl,
  );
  ok(
    (await api(B, 'POST', '/api/templates', { name: 'X', org: true, elements: [{ id: 'x', type: 'sticky', x: 0, y: 0, w: 100, h: 100 }] }))
      .status === 403,
    'Normale Person darf keine zentrale Vorlage anlegen',
  );
  ok((await api(B, 'DELETE', '/api/templates/' + t.body.id)).status === 403, 'und keine löschen');
  await B.reload({ waitUntil: 'networkidle0' });
  await sleep(600);
  const css = await B.evaluate(() => {
    const s = getComputedStyle(document.documentElement);
    return {
      a: s.getPropertyValue('--accent').trim(),
      on: s.getPropertyValue('--on-accent').trim(),
      t: s.getPropertyValue('--accent-text').trim(),
    };
  });
  console.log('   ', css);
  ok(css.a === '#ffcc00' && css.on === '#000000', 'Akzent und lesbare Schrift', css);
  await B.click('#dash-all-templates');
  await sleep(700);
  const g = await B.$$eval('.tpl-grid .tpl-name', (x) => x.map((e) => e.textContent));
  console.log('   ', g);
  ok(g.length === 2 && g.some((n) => /Firmenvorlage/.test(n)), 'nur zentrale und leere Vorlage', g);
  const strip = await B.$$eval('#dash-templates .tpl-name', (x) => x.map((e) => e.textContent));
  console.log('   ', strip);
  ok(strip.length <= 2, 'Startseite respektiert die Vorgabe', strip);
  await B.keyboard.press('Escape');
  const bid = (await api(B, 'POST', '/api/boards', { name: 'Farben', elements: [] })).body.id;
  await B.goto(BASE + '/board/' + bid, { waitUntil: 'load' });
  await sleep(2000);
  const pal = await B.evaluate(async () => {
    const u = await import('/js/util.js');
    await u.designReady;
    return [u.PALETTE, u.STICKY_COLORS];
  });
  ok(pal[0].includes('#112233') && pal[0].length === 3 && pal[1].length === 2, 'Farbauswahl begrenzt', pal);
  await api(A, 'PUT', '/api/admin/settings', { design: { accent: '', palette: '', stickyColors: '', hideBuiltin: false } });
  ok(!errs.length, 'keine Skriptfehler', errs);
  await api(A, 'DELETE', '/api/templates/' + t.body.id);
  await b.close();
  console.log(f ? f + ' FEHLER' : 'ALLE OK');
})().catch((e) => {
  console.log('ABBRUCH', e);
  process.exit(1);
});
