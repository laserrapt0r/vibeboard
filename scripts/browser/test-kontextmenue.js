// Kontextmenü, Fotos und Dateien
const { launch, BASE, FIXTURES } = require('./lib');
let f = 0;
const ok = (c, m, x) => {
  console.log((c ? 'ok  ' : 'FAIL') + ' ' + m + (c || x === undefined ? '' : ' → ' + JSON.stringify(x).slice(0, 240)));
  if (!c) f++;
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const U = FIXTURES;
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
const menuItems = (p) => p.evaluate(() => [...document.querySelectorAll('.context-menu .menu-item')].map((x) => x.textContent));
const clickItem = (p, t) =>
  p.evaluate((t) => [...document.querySelectorAll('.context-menu .menu-item')].find((x) => x.textContent.includes(t)).click(), t);
const els = (p) =>
  p.evaluate(async () => {
    const { app } = await import('/js/core.js');
    return JSON.parse(JSON.stringify([...app.els.values()]));
  });
(async () => {
  const b = await launch();
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('dialog', (d) => d.dismiss());
  await p.goto(BASE + '/login', { waitUntil: 'networkidle0' });
  await api(p, 'POST', '/api/auth/login', { login: 'admin@test.example', password: 'Rotkehlchen-Wolke-47' });
  await api(p, 'PUT', '/api/admin/settings', { security: { requireVirusScan: false } });
  const id = (await api(p, 'POST', '/api/boards', { name: 'K' })).body.id;
  await p.goto(BASE + '/board/' + id, { waitUntil: 'load' });
  await wait(1200);
  await p.evaluate(() => document.querySelector('#empty-start .btn:last-child')?.click());
  await wait(150);
  const pick = async (x, y, file) => {
    await p.mouse.click(x, y, { button: 'right' });
    await wait(300);
    console.log('    Menü', JSON.stringify((await menuItems(p)).slice(0, 12)).slice(0, 300));
    const [fc] = await Promise.all([p.waitForFileChooser({ timeout: 5000 }), clickItem(p, 'Bild oder Datei hier einfügen')]);
    await fc.accept([U + file]);
    await wait(1200);
  };
  await p.mouse.click(1000, 620, { button: 'right' });
  await wait(200);
  ok(
    (await menuItems(p)).some((x) => /Bild oder Datei hier/.test(x)),
    'leeres Board: Eintrag im Kontextmenü',
    await menuItems(p),
  );
  await p.keyboard.press('Escape');
  await wait(150);
  ok((await menuItems(p)).length === 0, 'Esc schließt das Kontextmenü');
  await pick(1000, 620, 'foto.png');
  const w = await p.evaluate(async () => {
    const c = await import('/js/core.js');
    return c.toWorld(1000, 620);
  });
  let e = await els(p);
  const img = e.find((x) => x.type === 'image');
  ok(
    img,
    'Foto eingefügt',
    e.map((x) => x.type),
  );
  ok(img && Math.hypot(img.x + img.w / 2 - w.x, img.y + img.h / 2 - w.y) < 160, 'an der Klickstelle', {
    img: img && [img.x, img.y, img.w, img.h],
    w,
  });
  await p.evaluate(async () => {
    const c = await import('/js/core.js');
    c.setSelection([]);
  });
  await pick(420, 300, 'doc.pdf');
  await wait(1200);
  e = await els(p);
  const pdf = e.find((x) => x.type === 'file');
  ok(
    pdf,
    'PDF eingefügt',
    e.map((x) => x.type),
  );
  // Im Frame
  await p.evaluate(async () => {
    const c = await import('/js/core.js');
    const f = c.makeElement('frame', 0, 0);
    f.id = 'fr';
    f.w = 2000;
    f.h = 1400;
    f.x = -3000;
    f.y = -3000;
    c.setEl(f);
    c.setSelection([]);
    c.fitTo(c.bounds(c.getEl('fr')), { animate: false, pad: 60 });
  });
  await wait(500);
  const s = await p.evaluate(async () => {
    const c = await import('/js/core.js');
    return c.toScreen(-2500, -2500);
  });
  await p.mouse.click(s.x, s.y, { button: 'right' });
  await wait(250);
  ok(
    (await menuItems(p)).some((x) => /Bild oder Datei hier/.test(x)),
    'im Frame: Eintrag vorhanden',
    await menuItems(p),
  );
  // Toolbar weiter in der Mitte, nicht an alter Stelle
  await clickItem(p, 'Kommentar');
  await wait(200);
  await p.keyboard.press('Escape');
  await wait(150);
  // Format im Kontextmenü
  await p.evaluate(async () => {
    const c = await import('/js/core.js');
    const a = c.makeElement('shape', -2800, -2800, { fill: '#ff0000' });
    a.id = 's1';
    c.setEl(a);
    const n = c.makeElement('sticky', -2300, -2800);
    n.id = 'n1';
    c.setEl(n);
    c.setSelection([]);
  });
  await wait(400);
  const sc = (id) =>
    p.evaluate(async (id) => {
      const c = await import('/js/core.js');
      const e = c.getEl(id);
      return c.toScreen(e.x + e.w / 2, e.y + e.h / 2);
    }, id);
  let q = await sc('s1');
  await p.mouse.click(q.x, q.y, { button: 'right' });
  await wait(250);
  const m = await menuItems(p);
  ok(m.some((x) => x.includes('Format übertragen')) && m.some((x) => x.includes('Format kopieren')), 'Format im Kontextmenü', m);
  await clickItem(p, 'Format übertragen');
  await wait(200);
  q = await sc('n1');
  await p.mouse.click(q.x, q.y);
  await wait(350);
  ok((await els(p)).find((x) => x.id === 'n1').fill === '#ff0000', 'Rechtsklick → Format übertragen → Klick aufs Ziel');
  await p.mouse.click(q.x, q.y, { button: 'right' });
  await wait(250);
  ok(
    (await menuItems(p)).some((x) => x.includes('Format einfügen')),
    'Format einfügen erscheint nach dem Kopieren',
  );
  await p.keyboard.press('Escape');
  ok(errs.length === 0, 'keine Browserfehler', errs.slice(0, 4));
  await b.close();
  console.log('Fehlschläge:', f);
  process.exit(f ? 1 : 0);
})().catch((e) => {
  console.error('ABBRUCH', e);
  process.exit(2);
});
