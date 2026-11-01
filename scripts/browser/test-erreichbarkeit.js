// Erreichbarkeit und sichtbare Fehler
const { launch, BASE, TMP, server } = require('./lib');
let f = 0;
const ok = (c, m, x) => {
  console.log((c ? 'ok  ' : 'FAIL') + ' ' + m + (c || x === undefined ? '' : ' → ' + JSON.stringify(x).slice(0, 260)));
  if (!c) f++;
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const S = TMP + '/';
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
  if (r.status >= 300) throw new Error('login ' + e);
};
const get = (p, id) =>
  p.evaluate(async (id) => {
    const c = await import('/js/core.js');
    return JSON.parse(JSON.stringify(c.getEl(id) || null));
  }, id);
const all = (p) =>
  p.evaluate(async () => {
    const c = await import('/js/core.js');
    return JSON.parse(JSON.stringify([...c.app.els.values()]));
  });
const ev = (p, fn, ...a) => p.evaluate(fn, ...a);
const toast = (p) =>
  ev(p, () => {
    const t = document.getElementById('toast');
    return t && t.classList.contains('show') ? t.textContent : '';
  });
(async () => {
  const b = await launch();
  const errs = [];
  const A = await b.newPage();
  await login(A, 'admin@test.example', 'Rotkehlchen-Wolke-47');
  A.on('pageerror', (e) => errs.push('A ' + e.message));
  const c2 = await b.createBrowserContext();
  const B = await c2.newPage();
  await login(B, 'anna@example.org', 'Gewitter-Laterne-83');
  B.on('pageerror', (e) => errs.push('B ' + e.message));
  const c3 = await b.createBrowserContext();
  const V = await c3.newPage();
  await login(V, 'ben@example.org', 'Gewitter-Laterne-83');
  const open = async (extra = '') => {
    const id = (await api(A, 'POST', '/api/boards', { name: 'P' })).body.id;
    await api(A, 'POST', `/api/boards/${id}/members`, { email: 'anna@example.org', role: 'editor' });
    await api(A, 'POST', `/api/boards/${id}/members`, { email: 'ben@example.org', role: 'viewer' });
    await A.goto(BASE + '/board/' + id + extra, { waitUntil: 'load' });
    await B.goto(BASE + '/board/' + id + extra, { waitUntil: 'load' });
    await wait(1300);
    await A.bringToFront();
    await ev(A, () => document.querySelector('#empty-start .btn:last-child')?.click());
    return id;
  };
  let id = await open();
  console.log('=== Fenster');
  const seen = (p) =>
    ev(
      p,
      () =>
        [...document.querySelectorAll('#tools [data-tool]')].filter((b) => {
          const r = b.getBoundingClientRect(),
            t = document.getElementById('tools').getBoundingClientRect();
          return r.bottom <= t.bottom + 1 && r.top >= t.top - 1 && r.bottom <= innerHeight;
        }).length +
        '/' +
        document.querySelectorAll('#tools [data-tool]').length,
    );
  for (const [w, h] of [
    [1366, 650],
    [1366, 768],
    [1400, 900],
    [1024, 600],
  ]) {
    await A.setViewport({ width: w, height: h });
    await wait(250);
    const r = await seen(A);
    const [a, t] = r.split('/');
    ok(a === t, `${w}×${h}: alle Werkzeuge sichtbar`, r);
  }
  await A.setViewport({ width: 800, height: 768 });
  await ev(A, async () => {
    const c = await import('/js/core.js');
    const s = c.makeElement('sticky', 0, 0);
    s.id = 's';
    c.setEl(s);
    c.setSelection(['s']);
  });
  await wait(350);
  const cb = await ev(A, () => {
    const r = document.getElementById('ctxbar').getBoundingClientRect();
    return {
      l: r.left,
      r: r.right,
      w: innerWidth,
      sw: document.getElementById('ctxbar').scrollWidth,
      cw: document.getElementById('ctxbar').clientWidth,
    };
  });
  ok(cb.r <= cb.w && cb.l >= 0, 'Kontextleiste bleibt im Fenster', cb);
  await A.setViewport({ width: 1280, height: 900 });
  await wait(200);
  const M = await c2.newPage();
  await M.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await M.goto(BASE + '/board/' + id, { waitUntil: 'load' });
  await wait(1400);
  ok(
    await ev(M, () => {
      const b = document.getElementById('btn-timer');
      return !!b && b.offsetParent !== null;
    }),
    'Handy: Timer erreichbar',
  );
  await M.screenshot({ path: S + 'm1.png' });
  await ev(M, async () => {
    const c = await import('/js/core.js');
    c.app.emit('openPalette');
  });
  await wait(300);
  await ev(M, () => {
    const i = document.querySelector('.palette-input');
    i.value = 'timer';
    i.dispatchEvent(new Event('input'));
  });
  await wait(200);
  ok((await ev(M, () => document.querySelectorAll('.palette-item').length)) > 0, 'Handy: Palette findet Timer');
  await M.close();
  console.log('=== Tastatur');
  await A.bringToFront();
  await A.mouse.click(1100, 700);
  await wait(100);
  await A.keyboard.press('Escape');
  const n0 = (await all(A)).length;
  await A.keyboard.press('n');
  await wait(200);
  await A.keyboard.press('Escape');
  await A.keyboard.press('n');
  await wait(150);
  await A.keyboard.press('Enter');
  await wait(400);
  ok((await all(A)).length === n0 + 1, 'Enter legt die Notiz an', (await all(A)).length - n0);
  await A.keyboard.type('per Tastatur');
  await A.keyboard.press('Escape');
  await wait(250);
  ok(
    (await all(A)).some((e) => e.text === 'per Tastatur'),
    'Text eingegeben',
  );
  await ev(A, async () => {
    const c = await import('/js/core.js');
    const t = c.makeElement('table', 0, 600);
    t.id = 't';
    c.setEl(t);
    c.setSelection(['t']);
    c.startEdit('t', { cell: [1, 0] });
  });
  await wait(250);
  await A.keyboard.type('7');
  await A.keyboard.press('Enter');
  await wait(250);
  const t1 = await get(A, 't');
  ok(t1.cells[1][0] === '7', 'Enter speichert ohne Zeilenumbruch', t1.cells[1][0]);
  ok(
    await ev(A, async () => {
      const { app } = await import('/js/core.js');
      return !app.editing && app.cellSel.r0 === 2;
    }),
    'Auswahl geht eine Zeile tiefer',
  );
  await A.keyboard.press('Escape');
  await A.keyboard.press('Escape');
  await ev(A, async () => {
    const u = await import('/js/ui.js');
    u.showSidePanel('frames');
  });
  await wait(250);
  await A.keyboard.press('Escape');
  await wait(200);
  ok(await ev(A, () => document.getElementById('sidepanel').classList.contains('hidden')), 'Esc schließt das Panel');
  console.log('=== Design');
  const inkT = (p, id) =>
    ev(
      p,
      (id) =>
        document.querySelector(`g[data-id="${id}"] text`)?.getAttribute('fill') ||
        document.querySelector(`g[data-id="${id}"] tspan`)?.getAttribute('fill'),
      id,
    );
  await ev(A, async () => {
    const c = await import('/js/core.js');
    const t = c.makeElement('text', 2000, 2000);
    t.id = 'tx';
    t.text = 'Hallo';
    c.setEl(t);
    const r = c.makeElement('text', 3000, 2000, { color: '#e03131' });
    r.id = 'rot';
    r.text = 'rot';
    c.setEl(r);
    const f = c.makeElement('frame', 4000, 2000);
    f.id = 'fr';
    f.x = 4000;
    f.y = 2000;
    f.w = 600;
    f.h = 400;
    c.setEl(f);
    const i = c.makeElement('text', 4100, 2100);
    i.id = 'in';
    i.text = 'drin';
    c.setEl(i);
    const l = c.makeElement('connector', 0, 0, { from: { x: 2000, y: 2300 }, to: { x: 2300, y: 2300 } });
    l.id = 'ln';
    c.setEl(l);
  });
  await wait(400);
  await ev(B, async () => {
    const c = await import('/js/core.js');
    c.app.settings.dark = true;
    c.saveSettings();
    c.rerenderAll();
    document.body.classList.add('dark');
  });
  await wait(500);
  const dk = await ev(B, () => ({
    tx: document.querySelector('g[data-id="tx"]')?.innerHTML.match(/fill="(#[0-9a-f]+)"/i)?.[1],
    rot: document.querySelector('g[data-id="rot"]')?.innerHTML.match(/fill="(#[0-9a-f]+)"/i)?.[1],
    inn: document.querySelector('g[data-id="in"]')?.innerHTML.match(/fill="(#[0-9a-f]+)"/i)?.[1],
    ln: document.querySelector('g[data-id="ln"]')?.innerHTML.match(/stroke="(#[0-9a-f]+)"/gi),
  }));
  ok(dk.tx === '#f1f1f1', 'Dunkel: Text wird hell', dk);
  ok(dk.rot === '#e03131', 'bewusste Farbe bleibt', dk.rot);
  ok(dk.inn && dk.inn.toLowerCase() !== '#f1f1f1', 'im Frame dunkel', dk.inn);
  ok(JSON.stringify(dk.ln).includes('f1f1f1'), 'Linie hell', dk.ln);
  ok((await get(B, 'tx')).color === '#1a1a1a', 'gespeicherte Farbe bleibt neutral');
  await ev(B, async () => {
    const c = await import('/js/core.js');
    c.app.settings.dark = false;
    c.saveSettings();
    document.body.classList.remove('dark');
    c.rerenderAll();
  });
  console.log('=== Entwürfe');
  await ev(A, async () => {
    const c = await import('/js/core.js');
    const k = c.makeElement('card', 0, 1200);
    k.id = 'k';
    c.setEl(k);
    c.app.emit('editCard', 'k');
  });
  await wait(300);
  await A.type('.modal textarea', 'Beschreibung');
  await A.mouse.click(30, 30);
  await wait(250);
  ok(await ev(A, () => !!document.querySelector('.modal')), 'Klick daneben schließt den Dialog nicht');
  await ev(B, async () => {
    const c = await import('/js/core.js');
    c.deleteEl('k');
  });
  await wait(500);
  ok(/gelöscht/.test(await ev(A, () => document.querySelector('.modal')?.textContent || '')), 'Dialog sagt, dass die Karte gelöscht wurde');
  await A.keyboard.press('Escape');
  await wait(200);
  await A.bringToFront();
  const before = (await all(A)).filter((e) => e.type === 'comment').length;
  await ev(A, async () => {
    const c = await import('/js/core.js');
    c.setTool('comment');
  });
  await wait(150);
  await A.mouse.click(700, 300);
  await wait(350);
  const pop = await ev(A, () => !!document.querySelector('.comment-pop textarea, .comment-popover textarea, textarea[placeholder]'));
  if (pop) {
    await A.keyboard.type('Mein Kommentar');
    await A.mouse.click(1000, 700);
    await wait(300);
    ok(
      await ev(A, () => [...document.querySelectorAll('textarea')].some((t) => t.value === 'Mein Kommentar')),
      'angefangener Kommentar bleibt',
    );
    await A.keyboard.press('Escape');
  } else ok(false, 'Kommentar-Popover gefunden');
  await ev(A, async () => {
    const c = await import('/js/core.js');
    c.setTool('select');
  });
  await A.reload({ waitUntil: 'load' }).catch(() => {});
  await wait(1200);
  await ev(A, async () => {
    const c = await import('/js/core.js');
    const s = c.makeElement('sticky', -1000, 0);
    s.id = 'del';
    c.setEl(s);
    c.fitTo(c.bounds(c.getEl('del')), { animate: false, maxZ: 1 });
    c.startEdit('del');
  });
  await wait(300);
  await A.keyboard.type('Text');
  await wait(200);
  await ev(B, async () => {
    const c = await import('/js/core.js');
    await new Promise((r) => setTimeout(r, 300));
    c.deleteEl('del');
  });
  await wait(500);
  ok(/gelöscht/.test(await toast(A)), 'Hinweis bei fremdem Löschen', await toast(A));
  await A.keyboard.type('mehr');
  await wait(200);
  ok(
    await ev(A, async () => {
      const { app } = await import('/js/core.js');
      return app.tool === 'select';
    }),
    'weitere Tasten schalten keine Werkzeuge um',
  );
  console.log('=== Kanban');
  await ev(A, async () => {
    const u = await import('/js/ui.js');
    const { templateById } = await import('/js/templates.js');
    u.placeElements(templateById('kanban').build());
  });
  await wait(500);
  const cardId = (await all(A)).find((e) => e.type === 'card' && /Ideen/.test(e.title)).id;
  await ev(A, async () => {
    const c = await import('/js/core.js');
    c.app.emit('openCardViews');
  });
  await wait(400);
  await ev(
    A,
    (id) => {
      const s = document.querySelector(`select[data-focus="${id}:status"]`);
      s.value = 'Erledigt';
      s.dispatchEvent(new Event('change', { bubbles: true }));
    },
    cardId,
  );
  await wait(450);
  const heads = await ev(A, () => [...document.querySelectorAll('.kanban-col h3')].map((h) => h.textContent));
  ok(
    heads.some((h) => /Backlog/.test(h)),
    'leere Spalte bleibt in der Ansicht',
    heads,
  );
  const k2 = await get(A, cardId);
  const z = (await all(A)).filter((e) => e.statusCol).sort((a, b) => a.x - b.x)[3];
  ok(k2.status === 'Erledigt' && k2.x >= z.x && k2.x + k2.w <= z.x + z.w, 'Karte zieht auf dem Board mit', { x: k2.x, z: z.x });
  await A.keyboard.press('Escape');
  await wait(200);
  console.log('=== Rollen');
  await V.goto(BASE + '/board/' + id, { waitUntil: 'load' });
  await wait(1200);
  await ev(A, async () => {
    const c = await import('/js/core.js');
    const col = await import('/js/collab.js');
    col.setTimer({ running: true, endsAt: Date.now() + 600000, duration: 600000 });
  });
  await wait(600);
  ok(
    (await ev(V, () => document.querySelectorAll('#timer-widget button').length)) === 0,
    'Betrachter sehen keine Timer-Knöpfe',
    await ev(V, () => document.querySelectorAll('#timer-widget button').length),
  );
  ok(await ev(V, () => !document.getElementById('timer-widget').classList.contains('hidden')), 'Timer aber sichtbar');
  console.log('=== Ausfall');
  await ev(A, async () => {
    const col = await import('/js/collab.js');
    col.setTimer(null);
  });
  await wait(400);
  server('stop');
  await wait(600);
  await ev(A, async () => {
    const col = await import('/js/collab.js');
    col.setTimer({ running: true, endsAt: Date.now() + 900000, duration: 900000 });
  });
  await wait(400);
  server('start');
  await wait(9000);
  const tA = await ev(A, async () => {
    const { app } = await import('/js/core.js');
    return { t: !!app.session.timer, st: app.sync.saveState().state };
  });
  ok(tA.t, 'Timer aus dem Ausfall bleibt bei der handelnden Person', tA);
  console.log('=== Format/Export');
  await A.goto(BASE + '/board/' + id, { waitUntil: 'load' }).catch(() => {});
  await wait(1400);
  await ev(A, async () => {
    const c = await import('/js/core.js');
    const t = c.makeElement('table', -3000, 0);
    t.id = 'ta';
    c.setEl(t);
    const u = c.makeElement('table', -2000, 0);
    u.id = 'tb';
    c.setEl(u);
    c.tablePatch(c.getEl('ta'), { styles: [[1, 0, { b: true, c: '#e03131' }]] });
    c.setSelection(['ta']);
    c.copyFormat();
    c.setSelection(['tb']);
    c.pasteFormat();
  });
  await wait(350);
  ok(JSON.stringify((await get(A, 'tb')).styles).includes('e03131'), 'Tabelle übernimmt Zellenformat', (await get(A, 'tb')).styles?.[1]);
  const p = await ev(A, async () => {
    const e = await import('/js/pptx-export.js');
    const c = await import('/js/core.js');
    const t = c.makeElement('text', 0, 0, { color: '#e03131' });
    t.text = 'Rot';
    t.italic = true;
    t.underline = true;
    const f = c.makeElement('frame', 0, 0);
    f.title = 'Titel';
    const fn = Object.keys(e);
    return fn;
  });
  console.log('    pptx-Exporte', JSON.stringify(p));
  const q = await ev(A, async () => {
    const c = await import('/js/core.js');
    const s = c.makeElement('connector', 0, 0, { from: { x: 1, y: 1 }, to: { x: 9, y: 9 } });
    s.id = 'cn';
    c.setEl(s);
    c.setSelection([]);
    const g = c.toScreen(5, 5);
    return g;
  });
  await wait(300);
  ok(errs.length === 0, 'keine Browserfehler', errs.slice(0, 4));
  await b.close();
  console.log('Fehlschläge:', f);
  process.exit(f ? 1 : 0);
})().catch((e) => {
  console.error('ABBRUCH', e);
  process.exit(2);
});
