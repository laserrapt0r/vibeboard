// Mehrere Personen auf einem Board
const { launch, login, BASE } = require('./lib');
let f = 0;
const ok = (c, m, x) => {
  console.log((c ? 'ok  ' : 'FAIL') + ' ' + m + (c || x === undefined ? '' : ' → ' + JSON.stringify(x)));
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
(async () => {
  const b = await launch();
  const errs = [];
  const A = await b.newPage();
  A.on('pageerror', (e) => errs.push('A ' + e.message));
  await login(A, 'leitung@test.example', 'Rotkehlchen-Wolke-47');
  const id = (await api(A, 'POST', '/api/boards', { name: 'Poll', link_access: 'edit', elements: [] })).body.id;
  await api(A, 'PATCH', '/api/boards/' + id, { linkAccess: 'edit' });
  const c2 = await b.createBrowserContext();
  const B = await c2.newPage();
  B.on('pageerror', (e) => errs.push('B ' + e.message));
  await B.setExtraHTTPHeaders({ 'Accept-Language': 'fr' });
  await B.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'languages', { get: () => ['fr-FR', 'fr'] });
    Object.defineProperty(navigator, 'language', { get: () => 'fr-FR' });
  });
  await B.goto(BASE + '/register', { waitUntil: 'networkidle0' });
  ok((await B.evaluate(() => document.documentElement.lang)) === 'fr', 'lang=fr im Browser');
  const email = 'poll' + Date.now() + '@example.org';
  // Zweite Person über Admin anlegen
  const u = await api(A, 'POST', '/api/admin/users', { name: 'Zweite', email, password: 'Gewitter-Laterne-83', role: 'user' });
  ok(u.status < 300, 'Zweite Person', u.status);
  await login(B, email, 'Gewitter-Laterne-83');
  const sh = await api(A, 'POST', `/api/boards/${id}/members`, { email, role: 'editor' });
  console.log('    share', sh.status, JSON.stringify(sh.body).slice(0, 90));
  await A.goto(BASE + '/board/' + id + '?transport=poll', { waitUntil: 'load' });
  await B.goto(BASE + '/board/' + id + '?transport=poll', { waitUntil: 'load' });
  await new Promise((r) => setTimeout(r, 2500));
  await A.bringToFront();
  await A.keyboard.press('n');
  await A.mouse.click(600, 400);
  await new Promise((r) => setTimeout(r, 400));
  await A.keyboard.press('Escape');
  await new Promise((r) => setTimeout(r, 2500));
  await B.bringToFront();
  await new Promise((r) => setTimeout(r, 1500));
  const n = await B.$$eval('#layer-els g[data-id]', (x) => x.length);
  ok(n >= 1, 'Änderung kommt im Rückfall-Transport bei der zweiten Person an', n);
  await B.evaluate(() => document.getElementById('btn-board-menu').click());
  await new Promise((r) => setTimeout(r, 200));
  const lbl = await B.evaluate(() => {
    const m = [...document.querySelectorAll('.popover .menu-item')].find((x) => x.innerHTML.includes('M8 6h13'));
    return m.querySelector('.mi-label').textContent;
  });
  await B.keyboard.press('Escape');
  ok(lbl === 'Liste des éléments', 'Elementliste übersetzt', lbl);
  ok(!errs.length, 'keine Skriptfehler', errs);
  await b.close();
  console.log(f ? f + ' FEHLER' : 'ALLE OK');
})().catch((e) => {
  console.log('ABBRUCH', e);
  process.exit(1);
});
