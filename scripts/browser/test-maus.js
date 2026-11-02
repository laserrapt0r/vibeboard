// Maus: rechte Taste verschiebt die Ansicht, Rechtsklick öffnet das Menü, das Rad zoomt
const { launch, BASE } = require('./lib');

let f = 0;
const ok = (c, m, x) => {
  console.log((c ? 'ok  ' : 'FAIL') + ' ' + m + (c || x === undefined ? '' : ' → ' + JSON.stringify(x).slice(0, 240)));
  if (!c) f++;
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const b = await launch();
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(BASE + '/login', { waitUntil: 'networkidle0' });
  await p.evaluate(() => fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Vibeboard': '1' }, body: JSON.stringify({ login: 'anna@example.org', password: 'Gewitter-Laterne-83' }) }));
  const id = await p.evaluate(async () => (await (await fetch('/api/boards', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Vibeboard': '1' }, body: JSON.stringify({ name: 'Maus' }) })).json()).id);
  await p.goto(`${BASE}/board/${id}`, { waitUntil: 'load' });
  await wait(1200);
  await p.evaluate(() => document.querySelector('#empty-start .btn:last-child')?.click());
  const run = (fn, ...a) => p.evaluate(`(async () => { const c = await import('/js/core.js'); return (${fn.toString()})(c, ...${JSON.stringify(a)}); })()`);
  await run((c) => {
    const s = c.makeElement('sticky', 0, 0);
    s.id = 'n';
    s.x = 500;
    s.y = 300;
    s.text = 'Notiz';
    c.setEl(s);
    c.setSelection([]);
    c.app.view.x = 0;
    c.app.view.y = 0;
    c.app.view.z = 1;
    c.applyView();
  });
  await wait(300);
  const view = () => run((c) => ({ ...c.app.view }));
  const menu = () => p.evaluate(() => [...document.querySelectorAll('.menu')].filter((m) => m.offsetParent).length);
  const closeMenu = async () => {
    await p.keyboard.press('Escape');
    await wait(150);
  };

  console.log('=== Rechte Taste ziehen');
  await p.mouse.move(800, 600);
  await p.mouse.down({ button: 'right' });
  await wait(100);
  ok((await menu()) === 0, 'Beim Drücken noch kein Menü');
  await p.mouse.move(860, 640, { steps: 5 });
  const v1 = await view();
  ok(v1.x === 60 && v1.y === 40, 'Ansicht folgt schon beim Ziehen', v1);
  await p.mouse.up({ button: 'right' });
  await wait(250);
  ok((await menu()) === 0, 'Nach dem Ziehen kein Kontextmenü', await menu());

  console.log('=== Windows-Reihenfolge: Menü kommt erst nach dem Loslassen');
  await p.mouse.move(800, 600);
  await p.mouse.down({ button: 'right' });
  await p.mouse.move(830, 600, { steps: 3 });
  await p.mouse.up({ button: 'right' });
  await p.evaluate(() => document.getElementById('stage').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 830, clientY: 600 })));
  await wait(200);
  ok((await menu()) === 0, 'Auch dann kein Menü nach dem Ziehen');
  await wait(450);

  console.log('=== Über einem Element');
  const x0 = (await run((c) => c.getEl('n').x));
  const r = await p.evaluate(() => {
    const q = document.querySelector('g[data-id="n"]').getBoundingClientRect();
    return { x: q.x + q.width / 2, y: q.y + q.height / 2 };
  });
  const vb = await view();
  await p.mouse.move(r.x, r.y);
  await p.mouse.down({ button: 'right' });
  await p.mouse.move(r.x + 50, r.y, { steps: 4 });
  await p.mouse.up({ button: 'right' });
  await wait(250);
  ok((await run((c) => c.getEl('n').x)) === x0, 'Das Element bleibt liegen');
  ok((await view()).x === vb.x + 50, 'Stattdessen wandert die Ansicht');

  console.log('=== Rechtsklick');
  const vc = await view();
  await p.mouse.move(900, 500);
  await p.mouse.click(900, 500, { button: 'right' });
  await wait(300);
  ok((await menu()) === 1, 'Klick ins Leere öffnet das Menü', await menu());
  ok(JSON.stringify(await view()) === JSON.stringify(vc), 'Ansicht bleibt');
  await closeMenu();
  const q = await p.evaluate(() => {
    const e = document.querySelector('g[data-id="n"]').getBoundingClientRect();
    return { x: e.x + e.width / 2, y: e.y + e.height / 2 };
  });
  await p.mouse.click(q.x, q.y, { button: 'right' });
  await wait(300);
  ok((await menu()) === 1, 'Klick auf ein Element öffnet sein Menü');
  ok(await run((c) => c.app.sel.has('n')), 'Das Element ist ausgewählt');
  await closeMenu();
  await p.mouse.move(900, 500);
  await p.mouse.down({ button: 'right' });
  await p.mouse.move(901, 501);
  await p.mouse.up({ button: 'right' });
  await wait(250);
  ok((await menu()) === 1, 'Kleines Zittern bleibt ein Klick');
  await closeMenu();

  console.log('=== Mittlere Taste');
  const vm = await view();
  await p.mouse.move(700, 500);
  await p.mouse.down({ button: 'middle' });
  await p.mouse.move(740, 530, { steps: 4 });
  await p.mouse.up({ button: 'middle' });
  await wait(200);
  const vm2 = await view();
  ok(vm2.x === vm.x + 40 && vm2.y === vm.y + 30, 'Verschiebt weiter', vm2);

  console.log('=== Mausrad');
  await run((c) => {
    c.app.view.x = 0;
    c.app.view.y = 0;
    c.app.view.z = 1;
    c.applyView();
  });
  const wheel = (o) => p.evaluate((o) => document.getElementById('stage').dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, clientX: 640, clientY: 450, deltaMode: 0, ...o })), o);
  // WheelEvent setzt wheelDeltaY nicht aus dem Konstruktor: Das Rad rastet in Vielfachen von 120, das wird hier nachgebildet
  const mouseWheel = (deltaY, extra = {}) => p.evaluate((deltaY, extra) => {
    const e = new WheelEvent('wheel', { bubbles: true, cancelable: true, clientX: 640, clientY: 450, deltaY, deltaMode: 0, ...extra });
    Object.defineProperty(e, 'wheelDeltaY', { value: -Math.sign(deltaY) * 120 });
    document.getElementById('stage').dispatchEvent(e);
  }, deltaY, extra);
  await mouseWheel(100);
  await wait(100);
  const w1 = await view();
  ok(w1.z < 1, 'Rad nach unten zoomt heraus', w1);
  await mouseWheel(-100);
  await mouseWheel(-100);
  await wait(100);
  const w2 = await view();
  ok(w2.z > w1.z, 'Rad nach oben zoomt hinein', w2);
  const screenY = await p.evaluate(async () => {
    const c = await import('/js/core.js');
    return c.toScreen((640 - c.app.view.x) / c.app.view.z, 0).x;
  });
  ok(Math.abs(screenY - 640) < 1, 'Der Punkt unter dem Zeiger bleibt', screenY);
  const w3 = await view();
  await mouseWheel(100, { shiftKey: true });
  await wait(100);
  const w4 = await view();
  ok(w4.z === w3.z && w4.x !== w3.x, 'Umschalt + Rad verschiebt waagerecht', w4);

  console.log('=== Trackpad');
  await wait(400);
  const t1 = await view();
  await wheel({ deltaX: 12, deltaY: 7 });
  await wheel({ deltaY: 5 });
  await wait(100);
  const t2 = await view();
  ok(t2.z === t1.z && (t2.x !== t1.x || t2.y !== t1.y), 'Zwei Finger verschieben', t2);
  await wheel({ deltaY: 10, ctrlKey: true });
  await wait(100);
  ok((await view()).z !== t2.z, 'Pinch zoomt');
  await wait(400);

  console.log('=== Einstellung');
  await run((c) => {
    c.app.settings.wheelPan = true;
  });
  const s1 = await view();
  await mouseWheel(100);
  await wait(100);
  const s2 = await view();
  ok(s2.z === s1.z && s2.y !== s1.y, 'Lässt sich auf Verschieben umstellen', s2);

  console.log('Fehler:', errs.length ? errs.slice(0, 4) : 'keine');
  ok(errs.length === 0, 'keine Browserfehler', errs.slice(0, 3));
  await b.close();
  console.log(f ? 'FAIL ' + f : 'ALLES OK');
  process.exit(f ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
