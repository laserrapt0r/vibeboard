// Zahlenformate und Formen
const { launch, login, BASE, ctxMore, boardMenu } = require('./lib');
const fs = require('fs');
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
  await login(A, 'admin@test.example', 'Rotkehlchen-Wolke-47');
  const cl = await A.createCDPSession();
  await cl.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: process.cwd() }).catch(() => {});
  const PNG =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mNk+M9Qz0AEYBxVSFIhAJbzBA3rQ8u4AAAAAElFTkSuQmCC';
  const id = (
    await api(A, 'POST', '/api/boards', {
      name: 'Fix',
      elements: [
        {
          id: 'tb',
          type: 'table',
          x: 0,
          y: 0,
          w: 300,
          h: 100,
          rows: 3,
          cols: 2,
          header: true,
          cells: [
            ['M', 'W'],
            ['a', '2.000'],
            ['b', '1.234.567'],
          ],
        },
        { id: 'ch', type: 'chart', sourceId: 'tb', chartKind: 'bar', x: 400, y: 0, w: 400, h: 250 },
        { id: 'im', type: 'image', x: 0, y: 400, w: 200, h: 200, src: PNG },
        { id: 'k', type: 'card', x: 0, y: 700, w: 300, h: 140, title: 'Z', start: '2026-11-05', due: '2026-11-10' },
        { id: 'lk', type: 'card', x: 400, y: 700, w: 300, h: 140, title: 'Gesperrt', status: 'Offen', locked: true },
      ],
    })
  ).body.id;
  await A.goto(BASE + '/board/' + id, { waitUntil: 'load' });
  await sleep(2500);
  const J = (fn, ...a) => A.evaluate(fn, ...a);
  const n = await J(async () => {
    const { cellNumber: c } = await import('/js/render.js');
    return ['2.000', '1.234', '1.234.567', '1,234,567', '1.234,5', '1,234.5', '0.125', '3,5', '12 %', '7 €', '-4'].map(c);
  });
  console.log('   ', n);
  ok(JSON.stringify(n) === JSON.stringify([2000, 1234, 1234567, 1234567, 1234.5, 1234.5, 0.125, 3.5, 12, 7, -4]), 'Zahlen', n);
  const rc = await J(async () => {
    const { recognize: r } = await import('/js/board-tools.js');
    const circ = (R, ry, noise = 0) =>
      Array.from({ length: 80 }, (_, i) => {
        const a = (i / 79) * 6.2832;
        return [R * (1 + noise * Math.sin(a * 7)) * Math.cos(a) + R, ry * (1 + noise * Math.sin(a * 5)) * Math.sin(a) + ry];
      });
    const poly = (pts) =>
      pts
        .flatMap((p, i) => {
          const q = pts[(i + 1) % pts.length];
          return Array.from({ length: 12 }, (_, k) => [p[0] + ((q[0] - p[0]) * k) / 12, p[1] + ((q[1] - p[1]) * k) / 12]);
        })
        .concat([pts[0]]);
    const star = poly(
      Array.from({ length: 10 }, (_, i) => {
        const a = (i / 10) * 6.2832,
          R = i % 2 ? 40 : 100;
        return [100 + R * Math.cos(a), 100 + R * Math.sin(a)];
      }),
    );
    const hex = poly(Array.from({ length: 6 }, (_, i) => [100 + 100 * Math.cos((i / 6) * 6.2832), 100 + 100 * Math.sin((i / 6) * 6.2832)]));
    const eight = Array.from({ length: 80 }, (_, i) => {
      const a = (i / 79) * 6.2832;
      return [100 + 100 * Math.sin(a), 100 + 60 * Math.sin(2 * a)];
    });
    const back = [
      ...Array.from({ length: 20 }, (_, i) => [i * 10, i]),
      ...Array.from({ length: 20 }, (_, i) => [190 - i * 10, 19 - i + 2]),
    ];
    return {
      c: r(circ(100, 100)),
      e: r(circ(150, 80)),
      n: r(circ(100, 100, 0.03)),
      sq: r(
        poly([
          [0, 0],
          [100, 0],
          [100, 100],
          [0, 100],
        ]),
      ),
      rc: r(
        poly([
          [0, 0],
          [200, 0],
          [200, 80],
          [0, 80],
        ]),
      ),
      t: r(
        poly([
          [50, 0],
          [100, 100],
          [0, 100],
        ]),
      ),
      d: r(
        poly([
          [50, 0],
          [100, 50],
          [50, 100],
          [0, 50],
        ]),
      ),
      star: r(star),
      hex: r(hex),
      eight: r(eight),
      back: r(back),
    };
  });
  console.log('   ', JSON.stringify(rc));
  ok(rc.c?.kind === 'ellipse' && rc.e?.kind === 'ellipse' && rc.n?.kind === 'ellipse', 'Kreise', rc);
  ok(rc.sq?.kind === 'rect' && rc.rc?.kind === 'rect', 'Rechtecke', rc);
  ok(rc.t?.kind === 'triangle' && rc.d?.kind === 'diamond', 'Dreieck, Raute', rc);
  ok(!rc.star && !rc.hex && !rc.eight && !rc.back, 'Stern, Sechseck, Acht, Hin-und-zurück bleiben Linien', rc);
  // Zeitleiste
  await J(async () => {
    (await import('/js/core.js')).app.emit('openCardViews');
  });
  await sleep(400);
  await J(() => [...document.querySelectorAll('[role=tab]')].find((b) => /Zeitleiste|Timeline/.test(b.textContent)).click());
  await sleep(400);
  ok(!!(await A.$('[role=tabpanel]')), 'tabpanel');
  const bar = await J(() => {
    const r = document.querySelector('.tl-bar').getBoundingClientRect();
    const d = parseFloat(document.querySelector('.tl-bar').style.width) / 6;
    return { x: r.x + r.width / 2, y: r.y + r.height / 2, d };
  });
  await A.mouse.move(bar.x, bar.y);
  await A.mouse.down();
  await A.mouse.move(bar.x + bar.d * 2, bar.y, { steps: 4 });
  await A.mouse.up();
  await sleep(600);
  let c = await J(async () => {
    const k = (await import('/js/core.js')).getEl('k');
    return [k.start, k.due];
  });
  ok(c[0] === '2026-11-07' && c[1] === '2026-11-12', 'Balken +2 Tage', c);
  const seq = await J(() => {
    const i = [...document.querySelectorAll('.tl-row input')];
    return i.map((x) => x.disabled);
  });
  ok(seq.filter(Boolean).length === 2, 'gesperrte Karte: Felder aus', seq);
  await A.keyboard.press('Escape');
  await sleep(200);
  // Zuschnitt mit verändertem Bild
  await J(async () => {
    const m = await import('/js/core.js');
    m.setSelection(['im']);
  });
  await sleep(400);
  await J(async () => {
    const m = await import('/js/core.js');
    m.act(() => m.updateEl('im', { x: 500 }));
  });
  await sleep(300);
  await ctxMore(A, 'Zuschneiden');
  await sleep(300);
  await J(() => {
    const i = document.querySelector('.modal input[type=number]');
    i.value = 50;
    i.dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelector('.modal form').requestSubmit();
  });
  await sleep(500);
  let im = await J(async () => {
    const e = (await import('/js/core.js')).getEl('im');
    return { x: e.x, w: e.w, c: e.crop };
  });
  ok(im.x === 600 && im.w === 100, 'Zuschnitt nutzt aktuellen Stand', im);
  await ctxMore(A, 'Zuschneiden');
  await sleep(300);
  ok((await J(() => document.querySelector('.modal input[type=number]').value)) === '50', 'erneut zuschneiden zeigt den Zuschnitt');
  await A.keyboard.press('Escape');
  // Export über das Menü
  await J(async () => {
    (await import('/js/core.js')).setSelection(['ch']);
  });
  await sleep(200);
  const part = await J(async () => {
    const c = await import('/js/core.js');
    const { svgString } = await import('/js/exporter.js');
    return svgString([c.getEl('ch')]);
  });
  ok(!/Keine Zahlen|No numbers/.test(part), 'Diagramm im Teilexport hat Daten');
  for (const f0 of fs.readdirSync('.').filter((x) => x.endsWith('.pptx') && x.startsWith('Fix'))) fs.unlinkSync(f0);
  await boardMenu(A, 'Exportieren', 'PowerPoint-Datei');
  await sleep(2500);
  ok(
    fs.existsSync('Fix.pptx'),
    'PowerPoint über das Menü heruntergeladen',
    fs.readdirSync('.').filter((x) => /pptx/.test(x)),
  );
  await J(async () => {
    (await import('/js/core.js')).deleteEls(['tb']);
  });
  await sleep(500);
  ok(
    await J(() => /Tabelle zu diesem Diagramm fehlt/.test(document.querySelector('g[data-id="ch"]').textContent)),
    'Tabelle gelöscht: Hinweis im Diagramm',
  );
  ok(!errs.length, 'keine Skriptfehler', errs);
  await b.close();
  console.log(f ? f + ' FEHLER' : 'ALLE OK');
})().catch((e) => {
  console.log('ABBRUCH', e);
  process.exit(1);
});
