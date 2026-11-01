// Hinweise, wer gerade woran arbeitet
const { launch, BASE, TMP } = require('./lib');
let f = 0;
const ok = (c, m, x) => {
  console.log((c ? 'ok  ' : 'FAIL') + ' ' + m + (c || x === undefined ? '' : ' → ' + JSON.stringify(x).slice(0, 240)));
  if (!c) f++;
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
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
const login = async (p, e, pw) => {
  await p.goto(BASE + '/login', { waitUntil: 'networkidle0' });
  const r = await api(p, 'POST', '/api/auth/login', { login: e, password: pw });
  if (r.status >= 300) throw new Error('login ' + r.status);
};
const tag = (p) => p.evaluate(() => [...document.querySelectorAll('.peer-tag text')].map((t) => t.textContent));
const ss = (p, n) => p.screenshot({ path: TMP + '/' + n + '.png' });
const center = (p, id) =>
  p.evaluate(async (id) => {
    const c = await import('/js/core.js');
    const e = c.getEl(id);
    const s = c.toScreen(e.x + e.w / 2, e.y + e.h / 2);
    return s;
  }, id);
(async () => {
  const b = await launch();
  const errs = [];
  const A = await b.newPage();
  await login(A, 'admin@test.example', 'Rotkehlchen-Wolke-47');
  const email = 'h' + Date.now() + '@example.org';
  await api(A, 'POST', '/api/admin/users', { name: 'Bea', email, password: 'Gewitter-Laterne-83', role: 'user' });
  const c2 = await b.createBrowserContext();
  const B = await c2.newPage();
  await login(B, email, 'Gewitter-Laterne-83');
  for (const tr of ['', '?transport=poll']) {
    console.log('=== ' + (tr || 'SSE'));
    const id = (await api(A, 'POST', '/api/boards', { name: 'H' })).body.id;
    await api(A, 'POST', `/api/boards/${id}/members`, { email, role: 'editor' });
    for (const [n, p] of [
      ['A', A],
      ['B', B],
    ]) {
      p.removeAllListeners('pageerror');
      p.on('pageerror', (e) => errs.push(n + ' ' + e.message));
      await p.goto(BASE + '/board/' + id + tr, { waitUntil: 'load' });
    }
    await wait(1500);
    await A.evaluate(async () => {
      const c = await import('/js/core.js');
      const s = c.makeElement('sticky', 0, 0);
      s.id = 's1';
      c.setEl(s);
      const k = c.makeElement('card', 350, 0);
      k.id = 'k1';
      k.title = 'Karte';
      c.setEl(k);
      c.fitAll?.(false);
    });
    await wait(600);
    await B.evaluate(async () => {
      const c = await import('/js/core.js');
      c.fitAll?.(false);
    });
    await A.bringToFront();
    await wait(300);
    const s = await center(A, 's1');
    // Ziehen
    await A.evaluate(async () => {
      const c = await import('/js/core.js');
      c.setSelection(['s1']);
    });
    await wait(300);
    await A.mouse.move(s.x, s.y);
    await A.mouse.down();
    await A.mouse.move(s.x + 2, s.y + 1);
    await wait(250);
    ok(!(await tag(B)).some((t) => /verschiebt/.test(t)), 'kein Hinweis, solange nur geklickt wird', await tag(B));
    await A.mouse.move(s.x + 70, s.y + 50, { steps: 6 });
    await wait(400);
    let t = await tag(B);
    ok(
      t.some((x) => /Admin verschiebt/.test(x)),
      'B sieht „verschiebt“ während des Ziehens',
      t,
    );
    if (!tr) {
      await B.bringToFront();
      await ss(B, 'busy-move');
      await A.bringToFront();
    }
    await A.mouse.up();
    await wait(400);
    t = await tag(B);
    ok(!t.some((x) => /verschiebt/.test(x)), 'Hinweis endet nach dem Loslassen', t);
    // Größe
    await A.evaluate(async () => {
      const c = await import('/js/core.js');
      c.setSelection(['s1']);
    });
    await wait(300);
    const hd = await A.evaluate(() => {
      const e = document.querySelector('[data-handle="se"]');
      if (!e) return null;
      const r = e.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    if (hd) {
      await A.mouse.move(hd.x, hd.y);
      await A.mouse.down();
      await A.mouse.move(hd.x + 30, hd.y + 30, { steps: 4 });
      await wait(400);
      t = await tag(B);
      ok(
        t.some((x) => /ändert die Größe/.test(x)),
        'B sieht „ändert die Größe“',
        t,
      );
      await A.mouse.up();
      await wait(400);
      ok(!(await tag(B)).some((x) => /Größe/.test(x)), 'Größe: Hinweis endet');
    } else ok(false, 'Griff gefunden');
    // Kartendialog: beide
    await A.evaluate(async () => {
      const c = await import('/js/core.js');
      c.setSelection([]);
      c.app.emit('editCard', 'k1');
    });
    await wait(300);
    const hasA = await A.evaluate(() => !!document.querySelector('.modal-back'));
    ok(hasA, 'Kartendialog offen bei A');
    await wait(300);
    t = await tag(B);
    ok(
      t.some((x) => /bearbeitet die Karte/.test(x)),
      'B sieht „bearbeitet die Karte“',
      t,
    );
    await B.evaluate(async () => {
      const c = await import('/js/core.js');
      c.app.emit('editCard', 'k1');
    });
    await wait(500);
    let note = await B.evaluate(() => document.querySelector('.modal [role=status]')?.textContent);
    ok(/geöffnet bei: Admin/.test(note || ''), 'B sieht im Dialog, dass A die Karte offen hat', note);
    note = await A.evaluate(() => document.querySelector('.modal [role=status]')?.textContent);
    ok(/geöffnet bei: Bea/.test(note || ''), 'A erfährt, dass B dazukam', note);
    if (!tr) {
      await B.bringToFront();
      await ss(B, 'busy-card');
      await A.bringToFront();
    }
    await A.keyboard.press('Escape');
    await wait(500);
    note = await B.evaluate(() => document.querySelector('.modal [role=status]')?.textContent);
    ok(!note, 'Hinweis verschwindet, wenn A schließt', note);
    await B.keyboard.press('Escape');
    await B.evaluate(() => document.querySelector('.modal-back') && document.querySelector('.modal .btn')?.click());
    await wait(300);
    // Spätere Person sieht es dank Wiederholung; Abbruch: Hinweis läuft aus
    await A.evaluate(async () => {
      const c = await import('/js/core.js');
      c.setBusy('move', ['s1']);
    });
    await wait(300);
    ok(
      (await tag(B)).some((x) => /verschiebt/.test(x)),
      'Hinweis gesetzt',
    );
    await wait(6500);
    ok(
      (await tag(B)).some((x) => /verschiebt/.test(x)),
      'Wiederholung hält den Hinweis aktiv',
    );
    await A.setOfflineMode(true);
    await wait(13500);
    ok(!(await tag(B)).some((x) => /verschiebt/.test(x)), 'Verbindung weg: Hinweis läuft aus');
    await A.setOfflineMode(false);
    await A.evaluate(async () => {
      const c = await import('/js/core.js');
      c.clearBusy();
    });
    await wait(500);
    // Anonym: kein Hinweis
    await A.evaluate(async () => {
      const c = await import('/js/core.js');
      c.app.sync.op({ op: 'privateMode', active: true, anonymous: true });
    });
    await wait(500);
    await A.evaluate(async () => {
      const c = await import('/js/core.js');
      c.setBusy('move', ['s1']);
    });
    await wait(400);
    ok(!(await tag(B)).some((x) => /verschiebt/.test(x)), 'anonymes Sammeln: kein Hinweis', await tag(B));
    await A.evaluate(async () => {
      const c = await import('/js/core.js');
      c.clearBusy();
      c.app.sync.op({ op: 'privateMode', active: false });
    });
    await wait(400);
    // Unsinnige Signale
    const sig = (d) =>
      A.evaluate(async (d) => {
        const { app } = await import('/js/core.js');
        const r = await fetch(location.pathname.replace('/board/', '/api/boards/') + '/signal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Vibeboard': '1' },
          body: JSON.stringify({ clientId: app.sync.clientId, kind: 'busy', data: d }),
        });
        return r.status;
      }, d);
    for (const d of [null, 5, { what: 'x', ids: ['s1'] }, { what: 'move', ids: 's1' }, { what: 'move', ids: [1, {}] }, { what: 'move' }])
      await sig(d);
    await wait(300);
    ok(!(await tag(B)).some((x) => /verschiebt/.test(x)), 'unsinnige Signale werden ignoriert', await tag(B));
  }
  ok(errs.length === 0, 'keine Browserfehler', errs.slice(0, 4));
  await b.close();
  console.log('Fehlschläge:', f);
  process.exit(f ? 1 : 0);
})().catch((e) => {
  console.error('ABBRUCH', e);
  process.exit(2);
});
