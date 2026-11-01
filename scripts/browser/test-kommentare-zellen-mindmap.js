// Kommentare am Element, Zellen, Mindmap, Long-Polling
const { launch, BASE, TMP } = require('./lib');
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
  B.on('dialog', (d) => d.accept());
  let id = await open();
  await wait(300);
  const add = (p, fn, ...a) => ev(p, fn, ...a);
  console.log('=== Kommentar am Element');
  await A.setViewport({ width: 1400, height: 900 });
  await add(A, async () => {
    const c = await import('/js/core.js');
    c.setView?.({ x: 0, y: 0, z: 1 });
    const s = c.makeElement('sticky', 400, 300);
    s.id = 'n1';
    s.text = 'Ziel';
    c.setEl(s);
    c.app.view.x = 0;
    c.app.view.y = 0;
    c.app.view.z = 1;
    c.applyView();
  });
  await wait(400);
  const box = async (p, id) =>
    ev(
      p,
      (id) => {
        const r = document.querySelector(`g[data-id="${id}"]`).getBoundingClientRect();
        return { x: r.x, y: r.y, w: r.width, h: r.height };
      },
      id,
    );
  const b1 = await box(A, 'n1');
  await A.keyboard.press('c');
  await wait(150);
  await A.mouse.click(b1.x + b1.w / 2, b1.y + b1.h / 2);
  await wait(350);
  await A.keyboard.type('Bitte prüfen');
  await wait(100);
  await A.keyboard.down('Control');
  await A.keyboard.press('Enter');
  await A.keyboard.up('Control');
  await wait(500);
  let cm = (await all(A)).find((e) => e.type === 'comment');
  if (cm && cm.draft) {
    await A.evaluate(() => document.querySelector('.comment-pop form button[type=submit], .comment-pop .btn.primary')?.click());
    await wait(500);
    cm = (await all(A)).find((e) => e.type === 'comment');
  }
  ok(cm && !cm.draft && cm.anchor && cm.anchor.id === 'n1', 'Kommentar hängt am Element', cm);
  await A.keyboard.press('Escape');
  await A.mouse.click(1200, 800);
  await wait(200);
  await A.keyboard.press('Escape');
  const cOf = (els) => els.find((e) => e.id === cm.id);
  await wait(500);
  ok(cOf(await all(B))?.anchor?.id === 'n1', 'Bezug kommt beim Server und den anderen an');
  const n1a = await get(A, 'n1');
  await ev(A, () => document.querySelector('.comment-pop .icon-btn[title="Schließen"]')?.click());
  await wait(150);
  await ev(A, async () => {
    const c = await import('/js/core.js');
    c.app.view.x = 0;
    c.app.view.y = 0;
    c.app.view.z = 1;
    c.applyView();
  });
  await wait(300);
  const b2 = await box(A, 'n1');
  const dx = 150,
    dy = 100;
  console.log(
    '   Box',
    JSON.stringify(b2),
    await ev(A, async () => {
      const c = await import('/js/core.js');
      return JSON.stringify([c.app.view, innerWidth, innerHeight]);
    }),
  );
  console.log(
    '   Lage',
    await ev(
      A,
      (p) => {
        const e = document.elementFromPoint(p.x, p.y);
        return e && (e.closest('[data-id]')?.dataset.id || e.tagName + '.' + e.className);
      },
      { x: b2.x + b2.w / 2, y: b2.y + 20 },
    ),
  );
  await A.mouse.move(b2.x + b2.w / 2, b2.y + 20);
  await A.mouse.down();
  await A.mouse.move(b2.x + b2.w / 2 + 40, b2.y + 40, { steps: 3 });
  const live = cOf(await all(A));
  await A.mouse.move(b2.x + b2.w / 2 + dx, b2.y + 20 + dy, { steps: 6 });
  await A.mouse.up();
  await wait(700);
  ok(live.x > cm.x, 'wandert schon beim Ziehen mit', [live.x, cm.x]);
  const n2 = await get(A, 'n1');
  const c2a = cOf(await all(A));
  ok(n2.x !== n1a.x && Math.abs(c2a.x - cm.x - (n2.x - n1a.x)) <= 1 && Math.abs(c2a.y - cm.y - (n2.y - n1a.y)) <= 1, 'folgt dem Element', {
    c: [c2a.x, cm.x],
    n: [n2.x, n1a.x],
  });
  ok(cOf(await all(B)).x === c2a.x, 'auch bei den anderen', [cOf(await all(B)).x, c2a.x]);
  await ev(A, async () => {
    const c = await import('/js/core.js');
    c.setSelection(['n1']);
    c.nudge(10, 0);
  });
  await wait(400);
  ok(cOf(await all(A)).x === c2a.x + 10, 'folgt auch den Pfeiltasten', cOf(await all(A)).x - c2a.x);
  await ev(A, async () => {
    const c = await import('/js/core.js');
    c.undo();
  });
  await wait(400);
  ok(cOf(await all(A)).x === c2a.x, 'Rückgängig nimmt ihn mit zurück', cOf(await all(A)).x - c2a.x);
  await ev(A, async () => {
    const c = await import('/js/core.js');
    const e = c.getEl('n1');
    c.act(() => c.setEl({ ...e, w: e.w * 2, h: e.h * 2 }));
  });
  await wait(400);
  const n3 = await get(A, 'n1');
  const cz = cOf(await all(A));
  ok(Math.abs(cz.x - (n3.x + cz.anchor.rx * n3.w)) <= 1, 'bleibt beim Skalieren an der Stelle', cz.anchor);
  await ev(A, async () => {
    const c = await import('/js/core.js');
    const e = c.getEl('n1');
    c.act(() => c.setEl({ ...e, w: e.w / 2, h: e.h / 2 }));
  });
  await wait(300);
  await ev(A, async () => {
    const c = await import('/js/core.js');
    c.setSelection([]);
  });
  const cb = await ev(
    A,
    (i) => {
      const r = document.querySelector(`g[data-id="${i}"]`).getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    },
    cm.id,
  );
  await A.mouse.move(cb.x, cb.y);
  await A.mouse.down();
  await A.mouse.move(1000, 780, { steps: 6 });
  await A.mouse.up();
  await wait(600);
  await A.keyboard.press('Escape');
  ok(!cOf(await all(A)).anchor, 'freigezogen: hängt nicht mehr', cOf(await all(A)));
  const b4 = await box(A, 'n1');
  await ev(A, async () => {
    document.querySelector('.comment-pop .icon-btn[title="Schließen"]')?.click();
  });
  const cb2 = await ev(
    A,
    (i) => {
      const r = document.querySelector(`g[data-id="${i}"]`).getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    },
    cm.id,
  );
  await A.mouse.move(cb2.x, cb2.y);
  await A.mouse.down();
  await A.mouse.move(b4.x + 30, b4.y + 30, { steps: 6 });
  await A.mouse.up();
  await wait(600);
  await A.keyboard.press('Escape');
  ok(cOf(await all(A)).anchor?.id === 'n1', 'aufs Element gezogen: hängt wieder daran', cOf(await all(A)));
  await A.goto(BASE + '/board/' + id, { waitUntil: 'load' });
  await wait(1000);
  ok(cOf(await all(A)).anchor?.id === 'n1', 'bleibt nach dem Neuladen');
  await ev(A, async () => {
    const c = await import('/js/core.js');
    c.deleteEls(['n1']);
  });
  await wait(400);
  ok(!!cOf(await all(A)), 'Element gelöscht: Kommentar bleibt erhalten');
  await ev(A, async () => {
    (await import('/js/core.js')).undo();
  });
  await wait(300);

  console.log('=== Mindmap');
  await ev(A, async () => {
    const c = await import('/js/core.js');
    const mk = (id, x, y) => {
      const e = c.makeElement('sticky', x, y, { id });
      e.id = id;
      c.setEl(e);
    };
    mk('m0', 100, 1200);
    mk('m1', 400, 1100);
    mk('m2', 700, 1100);
    const cn = (id, a, b) => {
      const k = c.makeElement('connector', 0, 0);
      k.id = id;
      k.mind = true;
      k.from = { id: a };
      k.to = { id: b };
      c.setEl(k);
    };
    cn('k1', 'm0', 'm1');
    cn('k2', 'm1', 'm2');
    c.app.view.x = 0;
    c.app.view.y = -900;
    c.app.view.z = 1;
    c.applyView();
  });
  await wait(500);
  const m0 = await get(A, 'm0'),
    m1o = await get(A, 'm1'),
    m2 = await get(A, 'm2');
  const mb = await box(A, 'm1');
  await A.mouse.move(mb.x + 40, mb.y + 40);
  await A.mouse.down();
  await A.mouse.move(mb.x + 40, mb.y + 200, { steps: 6 });
  await A.mouse.up();
  await wait(500);
  const m1b = await get(A, 'm1'),
    m2b = await get(A, 'm2');
  ok(m1b.y > m1o.y && m2b.y - m2.y === m1b.y - m1o.y, 'Ziehen nimmt die Unterknoten mit', [m1b.y, m2b.y]);
  ok((await get(A, 'm0')).y === m0.y, 'Elternknoten bleibt');
  await ev(A, async () => {
    const c = await import('/js/core.js');
    c.setSelection(['m0']);
    c.nudge(0, 20);
  });
  await wait(300);
  ok((await get(A, 'm2')).y === m2b.y + 20, 'Pfeiltasten nehmen die Unterknoten mit');
  await ev(A, async () => {
    const c = await import('/js/core.js');
    const e = c.getEl('m2');
    c.setEl({ ...e, locked: true });
    c.setSelection(['m1']);
    c.nudge(0, 20);
  });
  await wait(300);
  ok((await get(A, 'm2')).y === m2b.y + 20, 'Gesperrtes bleibt liegen');

  console.log('=== Zellen');
  await ev(A, async () => {
    const c = await import('/js/core.js');
    const t = c.makeElement('table', 0, 0);
    t.id = 'tb';
    t.x = 100;
    t.y = 1600;
    t.rows = 4;
    t.cols = 3;
    t.cells = [
      ['1', '2', '=A1+B1'],
      ['3', '4', '=A2+B2'],
      ['', '', ''],
      ['', '', ''],
    ];
    c.setEl(t);
    c.setSelection(['tb']);
    c.app.cellSel = { id: 'tb', r0: 0, c0: 0, r1: 0, c1: 0 };
  });
  await wait(300);
  const clip = (p, kind, data) =>
    ev(
      p,
      (kind, data) => {
        const dt = new DataTransfer();
        for (const k in data || {}) dt.setData(k, data[k]);
        document.dispatchEvent(new ClipboardEvent(kind, { clipboardData: dt, bubbles: true, cancelable: true }));
        return { plain: dt.getData('text/plain'), raw: dt.getData('text/x-vibeboard-cells') };
      },
      kind,
      data,
    );
  const sel = (r0, c0, r1, c1) =>
    ev(
      A,
      async (a) => {
        const c = await import('/js/core.js');
        c.setSelection(['tb']);
        c.app.cellSel = { id: 'tb', r0: a[0], c0: a[1], r1: a[2], c1: a[3] };
      },
      [r0, c0, r1, c1],
    );
  let cp = await clip(A, 'copy');
  ok(cp.plain === '1', 'Strg+C kopiert nur die Zelle', cp.plain.slice(0, 60));
  await sel(0, 0, 1, 2);
  cp = await clip(A, 'copy');
  ok(cp.plain === '1\t2\t3\n3\t4\t7', 'Bereich als Tabellentext mit Ergebnissen', cp.plain);
  const cells = async () => (await get(A, 'tb')).cells;
  await sel(0, 2, 0, 2);
  const cf = await clip(A, 'copy');
  await sel(1, 2, 1, 2);
  await sel(2, 2, 2, 2);
  await clip(A, 'paste', { 'text/plain': cf.plain, 'text/x-vibeboard-cells': cf.raw });
  await wait(250);
  ok((await cells())[2][2] === '=A3+B3', 'Formel wandert beim Einfügen mit', (await cells())[2][2]);
  await sel(3, 0, 3, 0);
  await clip(A, 'paste', { 'text/plain': 'x\ty\nüber\tlaufen\n' });
  await wait(250);
  ok((await cells())[3][0] === 'x' && (await cells())[3][1] === 'y', 'Text aus Excel füllt die Zellen', (await cells())[3]);
  ok(/passte/.test(await toast(A)), 'Überlauf wird gemeldet', await toast(A));
  const els0 = (await all(A)).length;
  await sel(2, 0, 2, 1);
  await clip(A, 'paste', { 'text/plain': '7' });
  await wait(250);
  ok((await cells())[2][0] === '7' && (await cells())[2][1] === '7', 'Ein Wert füllt die Auswahl', (await cells())[2]);
  ok((await all(A)).length === els0, 'Einfügen legt keine Notiz an');
  await sel(2, 0, 2, 0);
  const cu = await clip(A, 'cut');
  await wait(250);
  ok(cu.plain === '7' && (await cells())[2][0] === '', 'Ausschneiden leert die Zelle', (await cells())[2]);
  await ev(A, async () => {
    (await import('/js/core.js')).undo();
  });
  await wait(250);
  ok((await cells())[2][0] === '7', 'Rückgängig stellt sie wieder her');
  await ev(A, async () => {
    const c = await import('/js/core.js');
    c.app.cellSel = null;
    c.setSelection(['tb']);
  });
  const wh = await clip(A, 'copy');
  ok(wh.plain.startsWith('vibeboard-clipboard:'), 'Ohne Zellauswahl: die ganze Tabelle');

  console.log('=== Abgelehnte Kommentarlöschung');
  await V.goto(BASE + '/board/' + id, { waitUntil: 'load' });
  await wait(1200);
  await api(
    A,
    'PATCH',
    `/api/boards/${id}/members/${(await api(A, 'GET', `/api/boards/${id}/members`)).body.members.find((m) => /ben|Ben/.test(m.displayName)).id}`,
    { role: 'commenter' },
  );
  await wait(1500);
  await V.goto(BASE + '/board/' + id, { waitUntil: 'load' });
  await wait(1200);
  await ev(
    V,
    async (i) => {
      const c = await import('/js/core.js');
      c.app.sync.op({ op: 'comment', action: 'delete', id: i });
      c.app.sync.forget(i);
      c.applyRemoteOp({ op: 'delete', id: i });
      c.scheduleRender?.(true);
    },
    cm.id,
  );
  await wait(1000);
  ok(cOf(await all(V)), 'Abgelehnte Löschung erscheint wieder');
  ok(cOf(await all(A)), 'bei den anderen war sie nie weg');
  const asg = await api(A, 'GET', `/api/boards/${id}/people?assignable=1`);
  const all0 = await api(A, 'GET', `/api/boards/${id}/people`);

  console.log('=== Rollen und Einladungen');
  await api(
    A,
    'PATCH',
    `/api/boards/${id}/members/${(await api(A, 'GET', `/api/boards/${id}/members`)).body.members.find((m) => /ben|Ben/.test(m.displayName)).id}`,
    { role: 'viewer' },
  );
  await wait(700);
  const asg2 = await api(A, 'GET', `/api/boards/${id}/people?assignable=1`);
  ok(
    asg.body.people.some((p) => /ben/i.test(p.displayName)),
    'Kommentierende sind zuweisbar',
  );
  ok(
    !asg2.body.people.some((p) => /ben/i.test(p.displayName)) && asg2.body.people.length >= 2,
    'nur Ansehende fehlen in der Auswahl',
    asg2.body.people.map((p) => p.displayName),
  );
  const again = await api(A, 'POST', `/api/boards/${id}/members`, { email: 'anna@example.org', role: 'editor' });
  ok(again.body.already === true, 'Erneute Einladung: bereits Mitglied', again.body);
  await wait(800);
  ok(await ev(B, async () => (await import('/js/core.js')).app.sync.connected !== false), 'kein Hinauswurf aus dem offenen Board');
  const ch = await api(A, 'POST', `/api/boards/${id}/members`, { email: 'anna@example.org', role: 'commenter' });
  ok(ch.body.roleChanged === true, 'Rolle geändert wird gemeldet', ch.body);
  await api(A, 'POST', `/api/boards/${id}/members`, { email: 'anna@example.org', role: 'editor' });
  await wait(1500);

  console.log('=== Abwesenheit im Rückfall-Transport');
  await B.goto(BASE + '/board/' + id + '?transport=poll', { waitUntil: 'load' });
  await wait(1800);
  await A.goto(BASE + '/board/' + id, { waitUntil: 'load' });
  await wait(1500);
  const peers = () => ev(A, async () => (await import('/js/core.js')).app.peers.size);
  const p0 = await peers();
  await B.goto('about:blank');
  await wait(5500);
  const p1 = await peers();
  ok(p1 === p0 - 1, 'Weggegangene verschwinden nach wenigen Sekunden', [p0, p1]);
  for (let i = 0; i < 3; i++) {
    await B.goto(BASE + '/board/' + id + '?transport=poll', { waitUntil: 'load' });
    await wait(1500);
    const q0 = await peers();
    await B.goto('about:blank');
    await wait(5500);
    ok((await peers()) === q0 - 1, 'Auch wiederholt zuverlässig ' + i, [q0, await peers()]);
  }
  await B.goto(BASE + '/board/' + id + '?transport=poll', { waitUntil: 'load' });
  await wait(1500);
  const q1 = await peers();
  await wait(32000);
  ok((await peers()) === q1, 'Wer bleibt, bleibt über die Wartezeit hinaus', [q1, await peers()]);
  await B.goto(BASE + '/board/' + id, { waitUntil: 'load' });
  await wait(1500);

  console.log('=== Text in Formen');
  await ev(A, async () => {
    const c = await import('/js/core.js');
    const s = c.makeElement('sticky', 2000, 2000);
    s.id = 'lang';
    s.fontSize = 40;
    s.text = 'Sehr langer Text '.repeat(14);
    c.setEl(s);
    c.app.view.x = -1900;
    c.app.view.y = -1900;
    c.app.view.z = 1;
    c.applyView();
    const k = c.makeElement('sticky', 2400, 2000);
    k.id = 'kurz';
    k.fontSize = 24;
    k.text = 'Kurz';
    c.setEl(k);
  });
  await wait(500);
  const ov = await ev(A, () => {
    const g = document.querySelector('g[data-id="lang"]');
    const t = g.querySelector('text').getBoundingClientRect(),
      r = g.querySelector('rect').getBoundingClientRect();
    return { t: t.height, r: r.height, fs: g.querySelector('text').getAttribute('font-size') };
  });
  ok(ov.t <= ov.r && Number(ov.fs) < 40, 'Langer Text bleibt in der Notiz', ov);
  ok(
    (await ev(A, () => document.querySelector('g[data-id="kurz"] text').getAttribute('font-size'))) === '24',
    'Passender Text behält seine Größe',
  );
  ok((await get(A, 'lang')).fontSize === 40, 'die gewählte Größe bleibt gespeichert');

  console.log('=== Nachprüfung');
  await A.goto(BASE + '/board/' + id, { waitUntil: 'load' });
  await wait(1000);
  await ev(A, async () => {
    const c = await import('/js/core.js');
    const s = c.makeElement('sticky', 3000, 300);
    s.id = 'u1';
    c.setEl(s);
    const q = c.makeElement('shape', 3400, 300);
    q.id = 'fl';
    q.shape = 'rect';
    q.w = 200;
    q.h = 42;
    q.fontSize = 18;
    q.text = 'Flache Form';
    c.setEl(q);
    c.app.view.x = -2800;
    c.app.view.y = 0;
    c.app.view.z = 1;
    c.applyView();
  });
  await wait(400);
  ok(
    (await ev(A, () => document.querySelector('g[data-id="fl"] text').getAttribute('font-size'))) === '18',
    'Flache Form behält ihre Schrift',
  );
  await ev(A, async () => {
    const c = await import('/js/core.js');
    c.setSelection(['u1']);
    c.nudge(100, 0);
    c.setSelection([]);
  });
  await wait(300);
  const u = await get(A, 'u1');
  await ev(
    A,
    async (u) => {
      const c = await import('/js/core.js');
      c.newComment({ x: u.x + 10, y: u.y + 10 });
    },
    u,
  );
  await wait(300);
  await ev(A, () => {
    const i = document.querySelector('.comment-pop textarea, .comment-pop input');
    i && i.focus();
  });
  await A.keyboard.type('Danach');
  await A.keyboard.down('Control');
  await A.keyboard.press('Enter');
  await A.keyboard.up('Control');
  await wait(500);
  await ev(A, () => document.querySelector('.comment-pop .btn.primary')?.click());
  await wait(500);
  const uc = (await all(A)).find((e) => e.type === 'comment' && e.anchor?.id === 'u1');
  ok(uc && !uc.draft, 'Kommentar nach der Bewegung angehängt', uc);
  await ev(A, async () => {
    document.querySelector('.comment-pop .icon-btn[title="Schließen"]')?.click();
    const c = await import('/js/core.js');
    c.undo();
  });
  await wait(400);
  const u2 = await get(A, 'u1');
  const uc2 = (await all(A)).find((e) => e.id === uc.id);
  ok(u2.x === u.x - 100 && uc2.x === uc.x - 100, 'Rückgängig nimmt auch später angehängte Kommentare mit', [u2.x, uc2.x - uc.x]);
  await ev(A, async () => {
    const c = await import('/js/core.js');
    c.setSelection([]);
    c.redo();
  });
  await wait(300);
  await ev(
    A,
    async (i) => {
      const c = await import('/js/core.js');
      c.setSelection(['u1']);
      c.nudge(30, 0);
      c.setSelection([]);
      c.app.sync.op({ op: 'comment', action: 'delete', id: i });
      c.app.sync.forget(i);
      c.applyRemoteOp({ op: 'delete', id: i });
    },
    uc.id,
  );
  await wait(500);
  await ev(A, async () => {
    (await import('/js/core.js')).undo();
  });
  await wait(500);
  ok(!(await all(A)).some((e) => e.id === uc.id), 'Rückgängig holt gelöschte Kommentare nicht zurück');
  await ev(A, async () => {
    const c = await import('/js/core.js');
    const s = c.makeElement('sticky', 3000, 900);
    s.id = 'lk';
    s.locked = true;
    c.setEl(s);
    const k = c.makeElement('sticky', 3400, 900);
    k.id = 'lk2';
    c.setEl(k);
    const cn = c.makeElement('connector', 0, 0);
    cn.id = 'lkc';
    cn.mind = true;
    cn.from = { id: 'lk' };
    cn.to = { id: 'lk2' };
    c.setEl(cn);
    c.setSelection(['lk']);
    c.nudge(0, 50);
    c.setSelection([]);
  });
  await wait(300);
  ok((await get(A, 'lk2')).y === (await get(A, 'lk')).y, 'Pfeiltaste auf Gesperrtes bewegt Unterknoten nicht', [
    (await get(A, 'lk2')).y,
    (await get(A, 'lk')).y,
  ]);
  await ev(A, async () => {
    const c = await import('/js/core.js');
    const t = c.makeElement('table', 0, 0);
    t.id = 't3';
    t.rows = 3;
    t.cols = 2;
    t.cells = [
      ['"Zitat" Rest', 'x'],
      ['', ''],
      ['', ''],
    ];
    c.setEl(t);
    c.setSelection(['t3']);
    c.app.cellSel = { id: 't3', r0: 1, c0: 0, r1: 1, c1: 0 };
  });
  await ev(A, () => {
    const dt = new DataTransfer();
    dt.setData('text/plain', '"Zitat" Rest\tb\n"mit\nUmbruch"\tc');
    document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  });
  await wait(250);
  const t3 = (await get(A, 't3')).cells;
  ok(t3[1][0] === '"Zitat" Rest' && t3[1][1] === 'b' && t3[2][0] === 'mit\nUmbruch', 'Anführungszeichen wie in Tabellenprogrammen', t3);

  console.log('=== Abgeschaltete Dateien, Teams');
  const cur = (await api(A, 'GET', '/api/admin/settings')).body;
  await api(A, 'PUT', '/api/admin/settings', { collab: { files: false, teamCreation: 'admins' } });
  await wait(300);
  await B.goto(BASE + '/board/' + id, { waitUntil: 'load' });
  await wait(1200);
  const ctxLabels = await ev(B, async () => {
    const s = document.getElementById('stage');
    s.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 300, clientY: 300 }));
    await new Promise((r) => setTimeout(r, 250));
    const l = [...document.querySelectorAll('.menu button')].map((x) => x.textContent);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    return l;
  });
  ok(
    ctxLabels.some((x) => /Foto hier/.test(x)) && !ctxLabels.some((x) => /oder Datei/.test(x)),
    'Kontextmenü bietet nur Fotos an',
    ctxLabels.slice(0, 14),
  );
  ok(
    await ev(B, () => {
      const b = document.querySelector('[data-tool="image"]');
      return !b || /Bild hochladen/.test(b.title || b.getAttribute('aria-label') || '');
    }),
    'Werkzeug nennt keine Dateien',
  );
  await B.goto(BASE + '/', { waitUntil: 'networkidle0' });
  await wait(400);
  ok(await ev(B, () => !document.querySelector('.dash-nav-head button[title="Team erstellen"]')), 'Kein „+“ für Teams ohne Recht');
  await A.goto(BASE + '/', { waitUntil: 'networkidle0' });
  await wait(400);
  ok(await ev(A, () => !!document.querySelector('.dash-nav-head button[title="Team erstellen"]')), 'Administratoren sehen es');
  await api(A, 'PUT', '/api/admin/settings', { collab: { files: true, teamCreation: 'all' } });

  console.log('=== Langes Drücken');
  const c5 = await b.createBrowserContext();
  const MM = await c5.newPage();
  const M = MM;
  await M.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await login(M, 'anna@example.org', 'Gewitter-Laterne-83');
  await M.goto(BASE + '/board/' + id, { waitUntil: 'load' });
  await wait(1300);
  const cdp = await M.createCDPSession();
  const tch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
  const menuOpen = () => ev(M, () => !!document.querySelector('.menu'));
  await tch('touchStart', [{ x: 200, y: 400 }]);
  await wait(150);
  await tch('touchEnd', []);
  await wait(700);
  ok(!(await menuOpen()), 'Kurzes Tippen öffnet kein Menü');
  await tch('touchStart', [{ x: 200, y: 400 }]);
  await wait(100);
  await tch('touchMove', [{ x: 200, y: 480 }]);
  await wait(700);
  await tch('touchEnd', []);
  await wait(200);
  ok(!(await menuOpen()), 'Wischen öffnet kein Menü');
  await tch('touchStart', [{ x: 200, y: 400 }]);
  await wait(100);
  await tch('touchStart', [
    { x: 200, y: 400 },
    { x: 260, y: 500 },
  ]).catch(() => {});
  await wait(700);
  await tch('touchEnd', []);
  await wait(200);
  ok(!(await menuOpen()), 'Zwei Finger öffnen kein Menü');
  await tch('touchStart', [{ x: 200, y: 400 }]);
  await wait(750);
  ok(await menuOpen(), 'Langes Drücken öffnet das Kontextmenü');
  await tch('touchEnd', []);
  await wait(300);
  ok(await menuOpen(), 'Es bleibt nach dem Loslassen offen');
  await ev(M, () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
  await wait(200);
  await tch('touchStart', [{ x: 200, y: 400 }]);
  await wait(30);
  await tch('touchEnd', []);
  await wait(100);

  await ev(M, () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
  await wait(200);
  await ev(M, async () => {
    const c = await import('/js/core.js');
    const a = c.makeElement('sticky', 10000, 10000);
    a.id = 'ta';
    const b = c.makeElement('sticky', 10300, 10000);
    b.id = 'tb2';
    c.setEl(a);
    c.setEl(b);
    c.setSelection(['ta', 'tb2']);
    c.app.view.x = -9800;
    c.app.view.y = -9700;
    c.app.view.z = 0.5;
    c.applyView();
  });
  await wait(400);
  const mp = await ev(M, () => {
    const r = document.querySelector('g[data-id="ta"]').getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  await tch('touchStart', [mp]);
  await wait(750);
  await tch('touchEnd', []);
  await wait(300);
  ok(
    await ev(M, async () => (await import('/js/core.js')).app.sel.size === 2),
    'Loslassen ändert die Auswahl unter dem Menü nicht',
    await ev(M, async () => (await import('/js/core.js')).app.sel.size),
  );

  console.log('Fehler:', errs.length ? errs.slice(0, 5) : 'keine');
  ok(errs.length === 0, 'keine Browserfehler', errs.slice(0, 3));
  await b.close();
  console.log(f ? 'FAIL ' + f : 'ALLES OK');
  process.exit(f ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
