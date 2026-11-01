// Neue Funktionen mit zwei Personen, Live-Stream und Long-Polling
// Neue Funktionen mit zwei Personen, SSE und Long-Polling
const { launch, BASE } = require('./lib');
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
  if (r.status >= 300) throw new Error('login');
};
const els = (p) =>
  p.evaluate(async () => {
    const { app } = await import('/js/core.js');
    return JSON.parse(JSON.stringify([...app.els.values()]));
  });
(async () => {
  const b = await launch();
  const errs = [];
  const A = await b.newPage();
  await login(A, 'admin@test.example', 'Rotkehlchen-Wolke-47');
  const email = 'z' + Date.now() + '@example.org';
  await api(A, 'POST', '/api/admin/users', { name: 'Zoe', email, password: 'Gewitter-Laterne-83', role: 'user' });
  const c2 = await b.createBrowserContext();
  const B = await c2.newPage();
  await login(B, email, 'Gewitter-Laterne-83');
  for (const tr of ['', '?transport=poll']) {
    console.log('=== ' + (tr || 'SSE'));
    const id = (await api(A, 'POST', '/api/boards', { name: 'Z' })).body.id;
    await api(A, 'POST', `/api/boards/${id}/members`, { email, role: 'editor' });
    for (const [n, p] of [
      ['A', A],
      ['B', B],
    ]) {
      p.removeAllListeners('pageerror');
      p.on('pageerror', (e) => errs.push(n + ' ' + e.message));
      await p.goto(BASE + '/board/' + id + tr, { waitUntil: 'load' });
    }
    await wait(1400);
    await A.evaluate(async () => {
      const u = await import('/js/ui.js');
      const { templateById } = await import('/js/templates.js');
      u.placeElements(templateById('kanban').build());
    });
    await wait(900);
    let be = await els(B);
    ok(be.some((e) => e.statusCol) && be.some((e) => e.locked === 'text'), 'B erhält Spalten und Fixierung');
    // B benennt um, während A eine Karte zieht
    const head = be.find((e) => e.locked === 'text' && /In Arbeit/.test(e.text));
    await B.evaluate(async (id) => {
      const c = await import('/js/core.js');
      c.updateEl(id, { text: 'Läuft' });
    }, head.id);
    await wait(500);
    const r = await A.evaluate(async () => {
      const c = await import('/js/core.js');
      c.fitAll(false);
      await new Promise((r) => setTimeout(r, 200));
      const card = [...c.app.els.values()].find((e) => e.type === 'card' && /Ideen/.test(e.title));
      const zone = [...c.app.els.values()].filter((e) => e.statusCol).sort((a, b) => a.x - b.x)[2];
      c.setSelection([card.id]);
      await new Promise((r) => setTimeout(r, 100));
      return {
        id: card.id,
        from: c.toScreen(card.x + card.w / 2, card.y + card.h / 2),
        to: c.toScreen(zone.x + zone.w / 2, zone.y + zone.h - 150),
      };
    });
    await A.bringToFront();
    await A.mouse.move(r.from.x, r.from.y);
    await A.mouse.down();
    await A.mouse.move(r.to.x, r.to.y, { steps: 8 });
    await A.mouse.up();
    await wait(800);
    ok(
      (await els(B)).find((e) => e.id === r.id).status === 'Läuft',
      'Status bei B angekommen, mit dem Namen von B',
      (await els(B)).find((e) => e.id === r.id).status,
    );
    // Tab bei A, B sieht Notiz; leer verworfene verschwindet bei B
    await A.evaluate(async () => {
      const c = await import('/js/core.js');
      const s = c.makeElement('sticky', 3000, 0);
      s.id = 'n1';
      s.text = 'a';
      c.setEl(s);
      c.startEdit('n1');
    });
    await wait(300);
    await A.keyboard.press('Tab');
    await wait(500);
    const n = (await els(B)).filter((e) => e.type === 'sticky').length;
    await A.keyboard.press('Escape');
    await wait(700);
    ok((await els(B)).filter((e) => e.type === 'sticky').length === n - 1, 'leer verworfene Tab-Notiz verschwindet auch bei B');
    // Frame samt Inhalt
    await A.evaluate(async () => {
      const c = await import('/js/core.js');
      const f = [...c.app.els.values()].find((e) => e.type === 'frame');
      c.setSelection([f.id]);
      c.deleteFramesWithContent();
    });
    await wait(900);
    ok(!(await els(B)).some((e) => e.statusCol), 'Frame samt Inhalt auch bei B weg');
    await A.evaluate(async () => {
      const c = await import('/js/core.js');
      c.undo();
    });
    await wait(1000);
    const [a, bb] = [await els(A), await els(B)];
    const canon = (l) => JSON.stringify(l.map((e) => [e.id, e.x, e.status, e.locked, e.text]).sort());
    ok(canon(a) === canon(bb) && a.some((e) => e.statusCol), 'nach Rückgängig gleicher Stand bei beiden');
    // Betrachter: Halten greift nicht
  }
  ok(errs.length === 0, 'keine Browserfehler', errs.slice(0, 4));
  await b.close();
  console.log('Fehlschläge:', f);
  process.exit(f ? 1 : 0);
})().catch((e) => {
  console.error('ABBRUCH', e);
  process.exit(2);
});
