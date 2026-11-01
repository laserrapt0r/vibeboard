// Datenverlust-Fälle mit zwei Personen
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
const key = async (p, mod, k) => {
  await p.keyboard.down(mod);
  await p.keyboard.press(k);
  await p.keyboard.up(mod);
};
const toast = (p) =>
  p.evaluate(() => {
    const t = document.getElementById('toast');
    return t && t.classList.contains('show') ? t.textContent : '';
  });
(async () => {
  const b = await launch();
  const errs = [];
  const A = await b.newPage();
  await login(A, 'admin@test.example', 'Rotkehlchen-Wolke-47');
  A.on('pageerror', (e) => errs.push('A ' + e.message));
  const email = 'anna@example.org';
  const c2 = await b.createBrowserContext();
  const B = await c2.newPage();
  await login(B, email, 'Gewitter-Laterne-83');
  B.on('pageerror', (e) => errs.push('B ' + e.message));
  const c3 = await b.createBrowserContext();
  const C = await c3.newPage();
  await login(C, 'ben@example.org', 'Gewitter-Laterne-83');
  const open = async (tr = '') => {
    const id = (await api(A, 'POST', '/api/boards', { name: 'U' })).body.id;
    for (const m of ['anna', 'ben']) await api(A, 'POST', `/api/boards/${id}/members`, { email: m + '@example.org', role: 'editor' });
    await A.goto(BASE + '/board/' + id + tr, { waitUntil: 'load' });
    await B.goto(BASE + '/board/' + id + tr, { waitUntil: 'load' });
    await wait(1300);
    await A.bringToFront();
    await ev(A, () => document.querySelector('#empty-start .btn:last-child')?.click());
    return id;
  };
  console.log('=== Rückgängig');
  await open();
  await ev(A, async () => {
    const c = await import('/js/core.js');
    const s = c.makeElement('sticky', 0, 0);
    s.id = 'n';
    s.text = 'T';
    c.setEl(s);
  });
  await wait(400);
  await ev(A, async () => {
    const c = await import('/js/core.js');
    c.act(() => c.updateEl('n', { x: 500 }));
  });
  await wait(300);
  await ev(B, async () => {
    const c = await import('/js/core.js');
    c.updateEl('n', { text: 'BEN' });
  });
  await wait(400);
  await ev(A, async () => {
    const c = await import('/js/core.js');
    c.undo();
  });
  await wait(400);
  let n = await get(B, 'n');
  ok(n.text === 'BEN' && n.x !== 500, 'Rückgängig lässt fremden Text, nimmt eigene Lage zurück', n);
  await ev(A, async () => {
    const c = await import('/js/core.js');
    c.redo();
  });
  await wait(400);
  n = await get(B, 'n');
  ok(n.text === 'BEN' && n.x === 500, 'Wiederholen ebenso', n);
  await ev(A, async () => {
    const c = await import('/js/core.js');
    const s = c.makeElement('sticky', 600, 0);
    s.id = 'm';
    s.text = 'a';
    c.act(() => c.setEl(s));
  });
  await wait(300);
  await ev(B, async () => {
    const c = await import('/js/core.js');
    c.updateEl('m', { text: 'BEN2' });
  });
  await wait(300);
  await ev(A, async () => {
    const c = await import('/js/core.js');
    c.undo();
  });
  await wait(300);
  await ev(A, async () => {
    const c = await import('/js/core.js');
    c.redo();
  });
  await wait(400);
  ok((await get(B, 'm'))?.text === 'BEN2', 'Rückgängig und Wiederholen eines neuen Elements behält fremden Text', await get(B, 'm'));
  console.log('=== Tabelle');
  await ev(A, async () => {
    const c = await import('/js/core.js');
    const t = c.makeElement('table', 0, 500);
    t.id = 't';
    c.setEl(t);
  });
  await wait(400);
  await ev(A, async () => {
    const c = await import('/js/core.js');
    c.act(() => c.tablePatch(c.getEl('t'), { cells: [[1, 0, 'ANNA']] }));
  });
  await wait(300);
  await ev(B, async () => {
    const c = await import('/js/core.js');
    c.act(() => c.tableStruct(c.getEl('t'), { action: 'insertRows', at: 3, count: 1 }));
    c.tablePatch(c.getEl('t'), { cells: [[3, 1, 'BENZEILE']] });
  });
  await wait(400);
  await ev(A, async () => {
    const c = await import('/js/core.js');
    c.undo();
  });
  await wait(400);
  let t = await get(B, 't');
  ok(
    JSON.stringify(t.cells).includes('BENZEILE') && !JSON.stringify(t.cells).includes('ANNA'),
    'Zelle zurück, fremde Zeile bleibt',
    t.cells,
  );
  const rows = t.rows;
  await ev(A, async () => {
    const c = await import('/js/core.js');
    c.act(() => c.tableStruct(c.getEl('t'), { action: 'insertRows', at: 0, count: 1 }));
  });
  await wait(300);
  await ev(B, async () => {
    const c = await import('/js/core.js');
    c.tablePatch(c.getEl('t'), { cells: [[2, 2, 'FREMD']] });
  });
  await wait(300);
  await ev(A, async () => {
    const c = await import('/js/core.js');
    c.undo();
  });
  await wait(300);
  t = await get(A, 't');
  ok(
    JSON.stringify(t.cells).includes('FREMD') && t.rows === rows + 1,
    'eigene Zeile: Rückgängig verweigert statt fremde Zelle zu löschen',
    { r: t.rows, c: t.cells.length },
  );
  ok(/Struktur/.test(await toast(A)), 'Hinweis erklärt das', await toast(A));
  console.log('=== Ausrichten');
  await open();
  await ev(A, async () => {
    const c = await import('/js/core.js');
    for (let i = 0; i < 4; i++) {
      const s = c.makeElement('sticky', i * 300, i * 50);
      s.id = 's' + i;
      c.setEl(s);
    }
    const k = c.makeElement('comment', 50, 800);
    k.id = 'k';
    k.thread = [{ id: '1', text: 'x' }];
    c.setEl(k);
    c.fitAll(false);
  });
  await wait(400);
  await A.mouse.click(1000, 700);
  await key(A, 'Control', 'KeyA');
  await wait(150);
  for (const a of ['arrangeGrid', 'distributeSel', 'alignSel']) {
    await ev(
      A,
      async (a) => {
        const c = await import('/js/core.js');
        if (a === 'alignSel') c.alignSel('right');
        else if (a === 'distributeSel') c.distributeSel('h');
        else c.arrangeGrid();
      },
      a,
    );
    await wait(250);
  }
  let e = await all(A);
  ok(
    e.every((x) => x.type === 'connector' || (Number.isFinite(x.x) && Number.isFinite(x.y))),
    'keine kaputten Positionen',
    e.map((x) => [x.x, x.y]),
  );
  await A.reload({ waitUntil: 'load' });
  await wait(1200);
  e = await all(A);
  ok(
    new Set(e.filter((x) => x.type === 'sticky').map((x) => x.y + '/' + x.x)).size >= 1 && e.some((x) => x.x !== 0),
    'nach Neuladen nicht auf (0,0)',
  );
  await ev(A, async () => {
    const c = await import('/js/core.js');
    const f = c.makeElement('frame', 2000, 0);
    f.id = 'f';
    f.x = 2000;
    f.y = 0;
    f.w = 500;
    f.h = 400;
    c.setEl(f);
    const s = c.makeElement('sticky', 2200, 200);
    s.id = 'kid';
    c.setEl(s);
    const o = c.makeElement('sticky', 2000, 900);
    o.id = 'oth';
    c.setEl(o);
    const g1 = c.makeElement('sticky', 3000, 0);
    g1.id = 'g1';
    g1.groupId = 'gg';
    const g2 = c.makeElement('sticky', 3300, 50);
    g2.id = 'g2';
    g2.groupId = 'gg';
    c.setEl(g1);
    c.setEl(g2);
    const h = c.makeElement('sticky', 3000, 900);
    h.id = 'h';
    c.setEl(h);
  });
  await wait(300);
  const k0 = await get(A, 'kid');
  await ev(A, async () => {
    const c = await import('/js/core.js');
    c.setSelection(['f', 'oth']);
    c.updateEl('oth', { x: 1500 });
    c.setSelection(['f', 'oth']);
    c.alignSel('left');
  });
  await wait(300);
  const kk = await get(A, 'kid'),
    ff = await get(A, 'f');
  ok(kk.x - ff.x === k0.x - 2000 && ff.x === 1500 - 0, 'Frame nimmt Inhalt mit', { kk: kk.x, ff: ff.x, k0: k0.x });
  const dx0 = (await get(A, 'g2')).x - (await get(A, 'g1')).x;
  await ev(A, async () => {
    const c = await import('/js/core.js');
    c.setSelection(['g1', 'g2', 'h']);
    c.updateEl('h', { x: 2600 });
    c.setSelection(['g1', 'g2', 'h']);
    c.alignSel('left');
  });
  await wait(300);
  ok((await get(A, 'g2')).x - (await get(A, 'g1')).x === dx0, 'Gruppe bleibt zusammen');
  console.log('=== Sperren');
  await open();
  await ev(A, async () => {
    const c = await import('/js/core.js');
    const s = c.makeElement('sticky', 0, 0);
    s.id = 'l';
    s.locked = true;
    c.setEl(s);
    const p = c.makeElement('sticky', 300, 0);
    p.id = 'p';
    p.locked = 'text';
    c.setEl(p);
    const q = c.makeElement('sticky', 600, 0);
    q.id = 'q';
    c.setEl(q);
    c.fitAll(false);
  });
  await wait(400);
  await A.mouse.click(1000, 700);
  await key(A, 'Control', 'KeyA');
  await wait(100);
  await key(A, 'Control', 'KeyX');
  await wait(350);
  e = await all(A);
  ok(
    e.some((x) => x.id === 'l') && e.some((x) => x.id === 'p') && !e.some((x) => x.id === 'q'),
    'Strg+X lässt Gesperrtes stehen',
    e.map((x) => x.id),
  );
  const pos = await ev(A, async () => {
    const c = await import('/js/core.js');
    const e = c.getEl('l');
    return c.toScreen(e.x + e.w / 2, e.y + e.h / 2);
  });
  await A.mouse.click(pos.x, pos.y, { button: 'right' });
  await wait(250);
  const items = await ev(A, () => [...document.querySelectorAll('.context-menu .menu-item')].map((x) => x.textContent));
  ok(
    !items.some((x) => /^Löschen/.test(x) || /Duplizieren/.test(x) || /Vordergrund/.test(x)),
    'Kontextmenü bietet bei Gesperrtem kein Löschen',
    items,
  );
  await A.keyboard.press('Escape');
  await ev(A, async () => {
    const c = await import('/js/core.js');
    const s = c.makeElement('sticky', 600, 0);
    s.id = 'q2';
    c.setEl(s);
    c.setSelection(['l', 'q2']);
  });
  await wait(300);
  await ev(A, () => document.querySelector('#ctxbar .ctx-btn[title^="Löschen"]').click());
  await wait(300);
  e = await all(A);
  ok(
    e.some((x) => x.id === 'l') && !e.some((x) => x.id === 'q2'),
    'Papierkorb bei gemischter Auswahl',
    e.map((x) => x.id),
  );
  await ev(A, async () => {
    const c = await import('/js/core.js');
    const f = c.makeElement('frame', 0, 600);
    f.id = 'fx';
    f.x = 0;
    f.y = 600;
    f.w = 600;
    f.h = 500;
    c.setEl(f);
    const s = c.makeElement('sticky', 200, 800);
    s.id = 'in';
    c.setEl(s);
    c.setSelection(['fx']);
  });
  await wait(300);
  await A.mouse.click(1000, 700);
  await ev(A, async () => {
    const c = await import('/js/core.js');
    c.setSelection(['fx']);
  });
  await key(A, 'Control', 'KeyX');
  await wait(350);
  e = await all(A);
  ok(
    !e.some((x) => x.id === 'in'),
    'Strg+X auf Frame nimmt Inhalt mit',
    e.map((x) => x.id),
  );
  await key(A, 'Control', 'KeyV').catch(() => {});
  console.log('=== Vorlage');
  await open();
  await ev(A, async () => {
    const c = await import('/js/core.js');
    const s = c.makeElement('sticky', 0, 0);
    s.id = 'o';
    s.text = 'Original';
    c.setEl(s);
    const t = c.makeElement('sticky', 0, 300);
    t.id = 'o2';
    c.setEl(t);
    const l = c.makeElement('connector', 0, 0, { from: { x: 0, y: 600 }, to: { x: 400, y: 600 }, waypoints: [{ x: 200, y: 700 }] });
    l.id = 'ln';
    c.setEl(l);
  });
  await wait(300);
  await ev(A, async () => {
    const u = await import('/js/ui.js');
    const c = await import('/js/core.js');
    const els = JSON.parse(JSON.stringify([...c.app.els.values()]));
    c.updateEl('o', { text: 'Neu bearbeitet' });
    u.placeElements(els);
    u.placeElements(els);
  });
  await wait(500);
  e = await all(A);
  ok(e.filter((x) => x.type === 'sticky').length === 6, 'jedes Einfügen ergibt eine neue Kopie', e.length);
  ok((await get(A, 'o')).text === 'Neu bearbeitet', 'Original bleibt');
  const ln = e.filter((x) => x.type === 'connector' && x.id !== 'ln');
  ok(
    ln.every((l) => Math.abs(l.waypoints[0].x - l.from.x - 200) < 1 && Math.abs(l.waypoints[0].y - l.from.y - 100) < 1),
    'Knickpunkte wandern mit',
    ln.map((l) => [l.from, l.waypoints]),
  );
  console.log('=== Kopieren');
  await ev(A, async () => {
    const c = await import('/js/core.js');
    const s = c.makeElement('shape', 5000, 0);
    s.id = 'sh';
    c.setEl(s);
    const q = c.makeElement('shape', 5400, 0);
    q.id = 'sh2';
    c.setEl(q);
    const l = c.makeElement('connector', 0, 0, { from: { id: 'sh' }, to: { id: 'sh2' } });
    l.id = 'dk';
    c.setEl(l);
  });
  await wait(300);
  const before = (await all(A)).length;
  const cp = await ev(A, async () => {
    const c = await import('/js/core.js');
    return c.duplicateEls([c.getEl('dk')]).length;
  });
  await wait(300);
  ok(cp === 1 && (await all(A)).length === before + 1, 'angedockte Linie lässt sich duplizieren', cp);
  console.log('=== Neuladen');
  const id5 = await open();
  await A.bringToFront();
  await A.mouse.click(900, 700);
  let dialogs = 0;
  const dl = (d) => {
    dialogs++;
    d.dismiss();
  };
  A.on('dialog', dl);
  await A.emulateNetworkConditions({ upload: 20000, download: 5000000, latency: 1500 });
  await ev(A, async () => {
    const c = await import('/js/core.js');
    const s = c.makeElement('text', 0, 0);
    s.id = 'big';
    s.text = 'x'.repeat(100000);
    c.setEl(s);
    c.app.sync.flush();
  });
  await A.reload({ waitUntil: 'load', timeout: 4000 }).catch(() => {});
  await wait(300);
  ok(dialogs >= 1, 'großes Paket: Browser fragt nach', dialogs);
  await A.emulateNetworkConditions(null);
  A.off('dialog', dl);
  const leave = (d) => d.accept();
  A.on('dialog', leave);
  await A.reload({ waitUntil: 'load' }).catch(() => {});
  await wait(1000);
  A.off('dialog', leave);
  console.log('=== Sitzung');
  await open();
  const cookies = await A.cookies();
  await ev(A, async () => {
    const c = await import('/js/core.js');
    const s = c.makeElement('sticky', 0, 0);
    s.id = 'sess';
    s.text = 'wichtig';
    c.setEl(s);
  });
  await wait(400);
  await A.deleteCookie(...cookies);
  await ev(A, async () => {
    const c = await import('/js/core.js');
    c.updateEl('sess', { text: 'wichtig 2' });
  });
  await wait(300);
  await ev(A, async () => {
    const { api } = await import('/js/util.js');
    await api('/api/boards').catch(() => {});
  });
  await wait(500);
  ok(/board/.test(A.url()), 'Seite bleibt stehen', A.url());
  ok(/abgemeldet/.test(await toast(A)), 'Hinweis zur Anmeldung', await toast(A));
  await A.setCookie(...cookies);
  await wait(17000);
  ok(
    (await ev(A, async () => {
      const { app } = await import('/js/core.js');
      return app.sync.saveState().state;
    })) === 'saved',
    'nach Anmeldung gespeichert',
  );
  const rid = A.url().split('/board/')[1];
  const q = await B.goto(BASE + '/board/' + rid, { waitUntil: 'load' });
  await wait(1200);
  ok((await get(B, 'sess'))?.text === 'wichtig 2', 'Änderung liegt auf dem Server', await get(B, 'sess'));
  console.log('=== Moderation');
  const id6 = (await api(A, 'POST', '/api/boards', { name: 'M' })).body.id;
  for (const m of ['anna', 'ben']) await api(A, 'POST', `/api/boards/${id6}/members`, { email: m + '@example.org', role: 'editor' });
  await B.goto(BASE + '/board/' + id6, { waitUntil: 'load' });
  await C.goto(BASE + '/board/' + id6, { waitUntil: 'load' });
  await wait(1200);
  await ev(B, async () => {
    const { app } = await import('/js/core.js');
    app.sync.op({ op: 'moderation', active: true, editLock: true });
  });
  await wait(600);
  await B.goto('about:blank');
  await wait(1500);
  await C.reload({ waitUntil: 'load' });
  await wait(1400);
  const ban = await ev(
    C,
    () =>
      document.querySelector('#mod-banner, .mod-banner, [id*=moder]')?.textContent ||
      [...document.querySelectorAll('.panel')].map((x) => x.textContent).find((t) => /Moderation/.test(t)) ||
      '',
  );
  ok(/Anna/.test(ban), 'Banner nennt, wer gestartet hat', ban.slice(0, 120));
  const clicked = await ev(C, () => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent === 'Moderation beenden');
    if (b) b.click();
    return !!b;
  });
  ok(clicked, 'Bearbeitende bekommen „Moderation beenden“');
  await wait(700);
  ok(
    !(await ev(C, async () => {
      const { app } = await import('/js/core.js');
      return !!app.session.moderation;
    })),
    'Moderation ist beendet',
  );
  ok(
    !(await ev(C, async () => {
      const { app } = await import('/js/core.js');
      return app.viewOnly;
    })),
    'Sperre ist weg',
  );
  await ev(C, async () => {
    const { app } = await import('/js/core.js');
    app.sync.op({ op: 'moderation', active: true, editLock: true });
  });
  await wait(500);
  await B.goto(BASE + '/board/' + id6, { waitUntil: 'load' });
  await wait(1300);
  const r = await ev(B, async () => {
    const { app } = await import('/js/core.js');
    return !![...document.querySelectorAll('button')].find((x) => x.textContent === 'Moderation beenden');
  });
  ok(!r, 'solange jemand moderiert: kein Knopf');
  console.log('=== Pinch');
  const T = await c2.newPage();
  await T.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  const te = [];
  T.on('pageerror', (e) => te.push(e.message));
  await T.goto(BASE + '/board/' + id6, { waitUntil: 'load' });
  await wait(1500);
  const z0 = await ev(T, async () => {
    const { app } = await import('/js/core.js');
    return app.view.z;
  });
  const s = await T.createCDPSession();
  const pt = (a, b) => [
    { x: 195 - a, y: 400, id: 1 },
    { x: 195 + a, y: 400, id: 2 },
  ];
  await s.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(40) });
  for (let i = 1; i < 12; i++) {
    await s.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(40 + i * 10) });
    await wait(20);
  }
  await s.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await wait(400);
  const z1 = await ev(T, async () => {
    const { app } = await import('/js/core.js');
    return app.view.z;
  });
  ok(z1 > z0 * 1.3, 'Pinch zoomt', { z0, z1 });
  ok(te.length === 0, 'Pinch ohne Fehler', te.slice(0, 2));
  ok(errs.length === 0, 'keine Browserfehler', errs.slice(0, 4));
  await b.close();
  console.log('Fehlschläge:', f);
  process.exit(f ? 1 : 0);
})().catch((e) => {
  console.error('ABBRUCH', e);
  process.exit(2);
});
