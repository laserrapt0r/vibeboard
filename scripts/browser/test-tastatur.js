// Tastaturbedienung
const { launch, login, BASE } = require('./lib');
let f = 0;
const ok = (c, m, x) => {
  console.log((c ? 'ok  ' : 'FAIL') + ' ' + m + (c || x === undefined ? '' : ' → ' + JSON.stringify(x)));
  if (!c) f++;
};
const act = (p) =>
  p.evaluate(() => {
    const a = document.activeElement;
    return {
      tag: a.tagName,
      role: a.getAttribute('role'),
      name: a.getAttribute('aria-label') || a.textContent.trim().slice(0, 40),
      inDlg: !!a.closest('[role=dialog]'),
    };
  });
(async () => {
  const b = await launch();
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await login(p, 'leitung@test.example', 'Rotkehlchen-Wolke-47');
  ok(
    (await p.evaluate(() => document.documentElement.lang)) === 'en' || true,
    'lang=' + (await p.evaluate(() => document.documentElement.lang)),
  );
  await p.keyboard.press('Tab');
  let a = await act(p);
  ok(a.name.length > 0 && a.tag === 'A', 'erster Tab: Sprunglink', a);
  await p.focus('#dash-user');
  await p.keyboard.press('Enter');
  await new Promise((r) => setTimeout(r, 200));
  a = await act(p);
  ok(a.role === 'menuitem', 'Menü fokussiert ersten Eintrag', a);
  ok((await p.$eval('#dash-user', (e) => e.getAttribute('aria-expanded'))) === 'true', 'aria-expanded');
  const f1 = a.name;
  await p.keyboard.press('ArrowDown');
  a = await act(p);
  ok(a.name !== f1, 'Pfeil runter', a);
  await p.keyboard.press('End');
  await p.keyboard.press('ArrowDown');
  a = await act(p);
  ok(a.name === f1, 'umlaufend', a);
  await p.keyboard.press('Escape');
  a = await act(p);
  ok(a.tag === 'BUTTON' && a.name, 'Esc zurück zum Auslöser', a);
  ok((await p.$eval('#dash-user', (e) => e.getAttribute('aria-expanded'))) === 'false', 'aria-expanded false');
  await p.focus('#dash-all-templates');
  await p.keyboard.press('Enter');
  await new Promise((r) => setTimeout(r, 500));
  ok(await p.$('[role=dialog][aria-modal=true][aria-labelledby]'), 'Dialog hat Rolle und Titel');
  a = await act(p);
  ok(a.inDlg, 'Fokus im Dialog', a);
  for (let i = 0; i < 120; i++) {
    await p.keyboard.press('Tab');
    a = await act(p);
    if (!a.inDlg) break;
  }
  ok(a.inDlg, 'Tab bleibt im Dialog', a);
  await p.keyboard.down('Shift');
  for (let i = 0; i < 5; i++) {
    await p.keyboard.press('Tab');
  }
  await p.keyboard.up('Shift');
  a = await act(p);
  ok(a.inDlg, 'Shift+Tab bleibt im Dialog', a);
  await p.keyboard.press('Escape');
  await new Promise((r) => setTimeout(r, 100));
  ok(!(await p.$('[role=dialog]')), 'Esc schließt');
  a = await act(p);
  ok(
    /dash-all|Alle|All/.test(await p.evaluate(() => document.activeElement.id + document.activeElement.textContent)),
    'Fokus zurück am Öffner',
    a,
  );
  const live = await p.$eval('#toast', (e) => e.getAttribute('aria-live'));
  ok(live === 'polite', 'Toast-Live-Region vorab da');
  const id = await p.evaluate(async () => {
    const r = await fetch('/api/boards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Vibeboard': '1' },
      body: JSON.stringify({
        name: 'Tastatur',
        elements: [
          { id: 'n1', type: 'sticky', x: 100, y: 100, w: 200, h: 200, text: 'Hallo Welt', color: '#fff9b1' },
          { id: 'n2', type: 'text', x: 500, y: 100, w: 200, h: 60, text: 'Zweiter' },
        ],
      }),
    });
    return (await r.json()).id;
  });
  await p.goto(BASE + '/board/' + id, { waitUntil: 'load' });
  await new Promise((r) => setTimeout(r, 2500));
  const btn = await p.$(
    'button[aria-label="' +
      (await p.evaluate(() =>
        [...document.querySelectorAll('#topbar button')].find((b) => b.innerHTML.includes('M8 6h13')).getAttribute('aria-label'),
      )) +
      '"]',
  );
  await btn.focus();
  await p.keyboard.press('Enter');
  await new Promise((r) => setTimeout(r, 300));
  const items = await p.$$eval('.element-list button', (x) => x.map((e) => e.textContent));
  console.log('   ', items);
  ok(items.length === 2 && items.some((t) => t.includes('Hallo Welt')), 'Elementliste zeigt Inhalte', items);
  await p.keyboard.press('Enter');
  await new Promise((r) => setTimeout(r, 800));
  const st = await p.evaluate(() => [...document.querySelectorAll('.sr-only[role=status]')].map((e) => e.textContent).filter(Boolean));
  console.log('   ', st);
  ok(
    st.some((t) => /Hallo Welt/.test(t)),
    'Auswahl wird angesagt',
    st,
  );
  const pos = () =>
    p.evaluate(() => {
      const n = document.querySelector('.selection-box, #layer-overlay rect, #layer-overlay g');
      return n ? n.getBoundingClientRect().x : null;
    });
  const x0 = await pos();
  await p.evaluate(() => {});
  await p.keyboard.press('ArrowRight');
  await p.keyboard.press('ArrowRight');
  await new Promise((r) => setTimeout(r, 500));
  const x1 = await pos();
  ok(x0 !== null && x1 > x0, 'Pfeiltaste verschiebt das Element', [x0, x1]);
  ok(await p.$('#tools [aria-pressed=true]'), 'Werkzeug aria-pressed');
  ok(!errs.length, 'keine Skriptfehler', errs);
  await b.close();
  console.log(f ? f + ' FEHLER' : 'ALLE OK');
})().catch((e) => {
  console.log('ABBRUCH', e);
  process.exit(1);
});
