// Format übertragen
const { launch, BASE } = require('./lib');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
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
      return r.json().catch(() => null);
    },
    m,
    u,
    b,
  );
(async () => {
  const b = await launch();
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(BASE + '/login', { waitUntil: 'networkidle0' });
  await api(p, 'POST', '/api/auth/login', { login: 'admin@test.example', password: 'Rotkehlchen-Wolke-47' });
  const id = (await api(p, 'POST', '/api/boards', { name: 'F' })).id;
  await p.goto(BASE + '/board/' + id, { waitUntil: 'load' });
  await wait(1200);
  await p.evaluate(async () => {
    const c = await import('/js/core.js');
    const a = c.makeElement('shape', 0, 0, {
      shape: 'ellipse',
      fill: '#ff0000',
      stroke: '#00ff00',
      strokeWidth: 6,
      dash: true,
      textColor: '#0000ff',
      fontSize: 32,
      bold: true,
      italic: true,
      underline: true,
      align: 'left',
      valign: 'top',
    });
    a.id = 'a';
    a.text = 'A';
    c.setEl(a);
    const n = c.makeElement('shape', 400, 0, { shape: 'rect' });
    n.id = 'b';
    n.text = 'B';
    c.setEl(n);
    const m = c.makeElement('sticky', 800, 0);
    m.id = 'n';
    m.text = 'N';
    c.setEl(m);
    c.fitAll(false);
    c.setSelection([]);
  });
  await wait(500);
  const sc = (id) =>
    p.evaluate(async (id) => {
      const c = await import('/js/core.js');
      const e = c.getEl(id);
      return c.toScreen(e.x + e.w / 2, e.y + e.h / 2);
    }, id);
  const toast = () =>
    p.evaluate(() => {
      const t = document.getElementById('toast');
      return t && t.classList.contains('show') ? t.textContent : '';
    });
  let q = await sc('a');
  await p.mouse.click(q.x, q.y, { button: 'right' });
  await wait(250);
  await p.evaluate(() =>
    [...document.querySelectorAll('.context-menu .menu-item')].find((x) => x.textContent.includes('Format übertragen')).click(),
  );
  await wait(200);
  q = await sc('b');
  await p.mouse.click(q.x, q.y);
  await wait(350);
  const e = await p.evaluate(async () => {
    const c = await import('/js/core.js');
    return JSON.parse(JSON.stringify(c.getEl('b')));
  });
  for (const [k, v] of Object.entries({
    shape: 'ellipse',
    fill: '#ff0000',
    stroke: '#00ff00',
    strokeWidth: 6,
    dash: true,
    textColor: '#0000ff',
    fontSize: 32,
    bold: true,
    italic: true,
    underline: true,
    align: 'left',
    valign: 'top',
    text: 'B',
    w: 200,
    h: 140,
  }))
    ok(e[k] === v, 'Form → Form: ' + k, e[k]);
  ok(!/gemeinsam/.test(await toast()), 'gleiche Art: kein Hinweis', await toast());
  await p.evaluate(async () => {
    const c = await import('/js/core.js');
    c.setSelection(['a']);
    c.startBrush(false);
  });
  await wait(150);
  q = await sc('n');
  await p.mouse.click(q.x, q.y);
  await wait(300);
  ok(/gemeinsam/.test(await toast()), 'Form → Notiz: Hinweis', await toast());
  const get = (id) =>
    p.evaluate(async (id) => {
      const c = await import('/js/core.js');
      return JSON.parse(JSON.stringify(c.getEl(id)));
    }, id);
  ok((await get('n')).textColor === '#0000ff', 'Notiz übernimmt die Schriftfarbe', (await get('n')).textColor);
  ok((await get('n')).bold === true && (await get('n')).fontSize === 32, 'Notiz übernimmt Schriftstil');
  // Quelle mit automatischer Farbe: Ziel verliert seine feste Farbe
  await p.evaluate(async () => {
    const c = await import('/js/core.js');
    const s = c.makeElement('shape', 1200, 0);
    s.id = 'auto';
    s.text = 'X';
    c.setEl(s);
    c.setSelection(['auto']);
    c.copyFormat();
    c.setSelection(['b']);
    c.pasteFormat();
  });
  await wait(300);
  ok((await get('b')).textColor === undefined, 'automatische Schriftfarbe wird übertragen', (await get('b')).textColor);
  // Text ↔ Form
  await p.evaluate(async () => {
    const c = await import('/js/core.js');
    const t = c.makeElement('text', 0, 400);
    t.id = 't';
    t.text = 'T';
    c.setEl(t);
    c.updateEl('a', { textColor: '#123456' });
    c.setSelection(['a']);
    c.copyFormat();
    c.setSelection(['t']);
    c.pasteFormat();
  });
  await wait(250);
  ok((await get('t')).color === '#123456', 'Form → Text: Schriftfarbe', (await get('t')).color);
  await p.evaluate(async () => {
    const c = await import('/js/core.js');
    c.updateEl('t', { color: '#654321' });
    c.setSelection(['t']);
    c.copyFormat();
    c.setSelection(['b']);
    c.pasteFormat();
  });
  await wait(250);
  ok((await get('b')).textColor === '#654321', 'Text → Form: Schriftfarbe', (await get('b')).textColor);
  await p.evaluate(async () => {
    const c = await import('/js/core.js');
    c.setSelection(['n']);
  });
  await wait(300);
  await p.evaluate(() => document.querySelector('#ctxbar [title="Text"]').click());
  await wait(200);
  ok(await p.evaluate(() => !!document.querySelector('#ctxbar [title="Textfarbe"]')), 'Notiz hat Schaltfläche für die Textfarbe');
  ok(errs.length === 0, 'keine Browserfehler', errs.slice(0, 3));
  await b.close();
  console.log('Fehlschläge:', f);
  process.exit(f ? 1 : 0);
})().catch((e) => {
  console.error('ABBRUCH', e.message);
  process.exit(2);
});
