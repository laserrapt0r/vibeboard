// Zusammenspiel: Rechte, verborgene Bereiche und Rückgängig, wenn mehrere Personen gleichzeitig arbeiten
const { launch, BASE } = require('./lib');

let f = 0;
const ok = (c, m, x) => {
  console.log((c ? 'ok  ' : 'FAIL') + ' ' + m + (c || x === undefined ? '' : ' → ' + JSON.stringify(x).slice(0, 260)));
  if (!c) f++;
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const api = (p, m, u, b) =>
  p.evaluate(
    async (m, u, b) => {
      const r = await fetch(u, { method: m, headers: { 'Content-Type': 'application/json', 'X-Vibeboard': '1' }, body: b ? JSON.stringify(b) : undefined });
      let j = null;
      try {
        j = await r.json();
      } catch {}
      return { status: r.status, body: j };
    },
    m, u, b,
  );
const signIn = async (p, login, password) => {
  await p.goto(BASE + '/login', { waitUntil: 'networkidle0' });
  const r = await api(p, 'POST', '/api/auth/login', { login, password });
  if (r.status >= 300) throw new Error('Anmeldung ' + r.status);
};
const run = (p, fn, ...a) => p.evaluate(`(async () => { const c = await import('/js/core.js'); return (${fn.toString()})(c, ...${JSON.stringify(a)}); })()`);
const el = (p, id) => p.evaluate(async (id) => JSON.parse(JSON.stringify((await import('/js/core.js')).getEl(id) || null)), id);

(async () => {
  const b = await launch();
  const errs = [];
  const person = async (mail, pw) => {
    const ctx = await b.createBrowserContext();
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errs.push(e.message));
    await signIn(p, mail, pw);
    const s = await p.createCDPSession();
    await s.send('Emulation.setFocusEmulationEnabled', { enabled: true });
    return p;
  };
  const A = await person('anna@example.org', 'Gewitter-Laterne-83');
  const B = await person('ben@example.org', 'Gewitter-Laterne-83');
  const open = async (benRole) => {
    const id = (await api(A, 'POST', '/api/boards', { name: 'Zusammenspiel' })).body.id;
    await api(A, 'POST', `/api/boards/${id}/members`, { email: 'ben@example.org', role: benRole });
    await A.goto(`${BASE}/board/${id}`, { waitUntil: 'load' });
    await B.goto(`${BASE}/board/${id}`, { waitUntil: 'load' });
    await wait(1300);
    await A.evaluate(() => document.querySelector('#empty-start .btn:last-child')?.click());
    return id;
  };

  console.log('=== Link zurückgenommen');
  let id = await open('viewer');
  await api(A, 'PATCH', `/api/boards/${id}`, { linkAccess: 'edit' });
  await wait(1800);
  ok((await run(B, (c) => c.app.viewOnly)) === false, 'Über den Link darf Ben bearbeiten');
  await run(A, (c) => {
    const s = c.makeElement('sticky', 0, 0);
    s.id = 'n';
    s.text = 'Stand';
    c.setEl(s);
  });
  await wait(500);
  const clientId = await run(B, (c) => c.app.sync.clientId);
  await api(A, 'PATCH', `/api/boards/${id}`, { linkAccess: 'view' });
  await wait(1800);
  const after = await run(B, (c) => [c.app.viewOnly, c.app.sync.clientId]);
  ok(after[0] === true, 'Ben verliert das Recht sofort', after);
  const tried = await api(B, 'POST', `/api/boards/${id}/ops`, { clientId: after[1] || clientId, ops: [{ op: 'upsert', el: { id: 'n', type: 'sticky', x: 0, y: 0, w: 200, h: 200, z: 1, text: 'UNERLAUBT' } }] });
  ok(tried.status === 403 || tried.status === 409, 'Der Server lehnt Schreiben ab', tried);
  await wait(300);
  ok((await el(A, 'n')).text === 'Stand', 'Text bleibt', (await el(A, 'n')).text);

  console.log('=== Verborgene Bereiche');
  id = await open('editor');
  await run(A, (c) => {
    const fr = c.makeElement('frame', 0, 0);
    fr.id = 'fr';
    fr.x = 0;
    fr.y = 0;
    fr.w = 600;
    fr.h = 400;
    c.setEl(fr);
    const s = c.makeElement('sticky', 0, 0);
    s.id = 's';
    s.x = 50;
    s.y = 50;
    s.text = 'Innen';
    c.setEl(s);
  });
  await wait(500);
  await run(A, (c) => {
    c.act(() => c.updateEl('fr', { concealed: true }));
    const l = c.makeElement('connector', 0, 0);
    l.id = 'l';
    l.from = { x: 100, y: 100 };
    l.to = { x: 300, y: 300 };
    l.label = 'GEHEIMWORT';
    c.setEl(l);
  });
  await wait(900);
  const log = await api(B, 'GET', `/api/boards/${id}/activity`);
  ok(!JSON.stringify(log.body).includes('GEHEIMWORT'), 'Verlauf verrät keine Beschriftung aus dem Bereich', log.body);
  await run(B, (c) => {
    const t = c.makeElement('table', 0, 0);
    t.id = 't';
    t.x = 1000;
    t.y = 1000;
    c.setEl(t);
  });
  await wait(500);
  await run(B, (c) => c.tablePatch(c.getEl('t'), { props: { x: 150, y: 100 } }));
  await wait(800);
  ok((await el(A, 't')).x === 1000, 'Tabelle lässt sich nicht hineinschieben', (await el(A, 't')).x);
  await run(A, (c) => c.act(() => c.updateEl('fr', { concealed: false })));
  await wait(700);

  console.log('=== Rückgängig und fremde Arbeit');
  id = await open('editor');
  await run(A, (c) => {
    const s = c.makeElement('sticky', 0, 0);
    s.id = 'x';
    s.x = 300;
    s.y = 300;
    s.text = 'Alt';
    c.setEl(s);
  });
  await wait(600);
  await run(A, (c) => {
    c.app.view.x = 0;
    c.app.view.y = 0;
    c.app.view.z = 1;
    c.applyView();
    c.setSelection([]);
  });
  await wait(200);
  await run(B, (c) => c.startEdit('x', { selectAll: false }));
  await wait(400);
  const r = await A.evaluate(() => {
    const q = document.querySelector('g[data-id="x"]').getBoundingClientRect();
    return { x: q.x + q.width / 2, y: q.y + 30 };
  });
  await A.mouse.move(r.x, r.y);
  await A.mouse.down();
  await A.mouse.move(r.x + 60, r.y + 40, { steps: 4 });
  await B.keyboard.type(' von Ben');
  await wait(600);
  await run(B, (c) => c.finishEdit());
  await wait(500);
  await A.mouse.move(r.x + 120, r.y + 60, { steps: 4 });
  await A.mouse.up();
  await wait(400);
  await run(A, (c) => c.undo());
  await wait(700);
  const u = await el(B, 'x');
  ok(u.text === 'Alt von Ben', 'Fremder Text bleibt nach Rückgängig', u.text);
  ok(u.x === 300, 'Die eigene Bewegung ist zurückgenommen', u.x);

  console.log('=== Autor bei gelöschtem Element');
  await run(A, (c) => {
    const s = c.makeElement('sticky', 0, 0);
    s.id = 'y';
    s.author = c.app.user.name;
    c.setEl(s);
  });
  await wait(500);
  await run(B, (c) => {
    c.setSelection([]);
    c.deleteEls(['y']);
  });
  await wait(500);
  await run(B, (c) => c.undo());
  await wait(700);
  ok((await el(A, 'y'))?.author === 'Anna', 'Autorschaft bleibt erhalten', (await el(A, 'y'))?.author);

  console.log('=== Gastlink im Papierkorb');
  const link = await api(A, 'POST', `/api/boards/${id}/guest-links`, { role: 'viewer', days: 1 });
  if (link.body?.url || link.body?.token) {
    const token = link.body.token || link.body.url.split('/').pop();
    ok((await api(A, 'GET', `/api/guest/${token}`)).body.valid === true, 'Gastlink gilt');
    // Offene Tabs bekommen beim Löschen ein Hinweisfenster: vorher das Board verlassen
    await B.goto('about:blank');
    await A.goto(`${BASE}/`, { waitUntil: 'load' });
    await api(A, 'DELETE', `/api/boards/${id}`);
    ok((await api(A, 'GET', `/api/guest/${token}`)).body.valid === false, 'Im Papierkorb gilt er nicht mehr');
  } else console.log('info Gastlink nicht verfügbar', link.status);

  console.log('Fehler:', errs.length ? errs.slice(0, 4) : 'keine');
  ok(errs.length === 0, 'keine Browserfehler', errs.slice(0, 3));
  await b.close();
  console.log(f ? 'FAIL ' + f : 'ALLES OK');
  process.exit(f ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
