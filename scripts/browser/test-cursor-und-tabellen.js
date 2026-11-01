// Fremde Cursor, Formelbezüge, Tabellenstruktur
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
  for (const p of [A, B, V]) {
    const c = await p.createCDPSession();
    await c.send('Emulation.setFocusEmulationEnabled', { enabled: true });
  }
  let id = await open();
  await V.goto(BASE + '/board/' + id, { waitUntil: 'load' });
  await wait(1000);
  const mk = (p, type, eid, opts = {}) =>
    ev(
      p,
      async (type, eid, opts) => {
        const c = await import('/js/core.js');
        const e = c.makeElement(type, opts.x || 0, opts.y || 0);
        e.id = eid;
        Object.assign(e, opts);
        c.setEl(e);
      },
      type,
      eid,
      opts,
    );
  const edit = (p, eid, o = {}) =>
    ev(
      p,
      async (eid, o) => {
        const c = await import('/js/core.js');
        c.setSelection([]);
        c.startEdit(eid, { selectAll: false, ...o });
        if (o.at !== undefined) document.getElementById('editor').setSelectionRange(o.at, o.at);
      },
      eid,
      o,
    );
  const stop = (p) =>
    ev(p, async () => {
      (await import('/js/core.js')).finishEdit();
    });
  const edVal = (p) => ev(p, () => document.getElementById('editor').value);
  const idle = async () => {
    for (let i = 0; i < 60; i++) {
      const b = await Promise.all([A, B].map((p) => ev(p, async () => (await import('/js/core.js')).app.sync.pending)));
      if (!b.some(Boolean)) return;
      await wait(100);
    }
  };
  const both = async (a, b, gap = 0) => {
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      await Promise.all([a[i] ? A.keyboard.type(a[i]) : 0, b[i] ? B.keyboard.type(b[i]) : 0]);
      if (gap) await wait(gap);
    }
  };
  const txt = async (p, eid, f = 'text') => (await get(p, eid))?.[f];
  const fourth = async (eid, f, want, name) => {
    await idle();
    await wait(400);
    const v = [await txt(A, eid, f), await txt(B, eid, f), await txt(V, eid, f)];
    ok(
      v.every((x) => x === want),
      name,
      v,
    );
  };

  const carets = (p) =>
    ev(p, () =>
      [...document.querySelectorAll('.text-caret')].map((c) => {
        const r = c.getBoundingClientRect();
        return { x: r.x, y: r.y, h: r.height, name: c.textContent, bg: c.style.background };
      }),
    );
  const marks = (p) => ev(p, () => document.querySelectorAll('.text-caret-mark').length);
  const rectOf = (p, i) =>
    ev(
      p,
      (i) => {
        const r = document.querySelector(`g[data-id="${i}"]`).getBoundingClientRect();
        return { x: r.x, y: r.y, w: r.width, h: r.height };
      },
      i,
    );
  const view = (p, x, y, z = 1) =>
    ev(
      p,
      async (x, y, z) => {
        const c = await import('/js/core.js');
        c.app.view.x = x;
        c.app.view.y = y;
        c.app.view.z = z;
        c.applyView();
      },
      x,
      y,
      z,
    );
  const nap = async (ms = 450) => {
    await wait(ms);
  };

  console.log('=== Fremde Cursor');
  await mk(A, 'sticky', 'n1', { text: 'aaaa\nbbbb', x: 300, y: 300 });
  await wait(500);
  await view(A, 0, 0);
  await view(B, 0, 0);
  await wait(200);
  await edit(B, 'n1', { at: 2 });
  await nap();
  let c = await carets(A);
  ok(c.length === 1, 'Cursor erscheint bei den anderen', c);
  ok(/Anna|anna/i.test(c[0]?.name || ''), 'mit Namen', c[0]?.name);
  const rA = await rectOf(A, 'n1');
  ok(c[0] && c[0].x > rA.x && c[0].x < rA.x + rA.w && c[0].y > rA.y && c[0].y < rA.y + rA.h, 'Cursor liegt im Element', [c[0], rA]);
  ok((await carets(B)).length === 0, 'Eigener Cursor wird nicht doppelt gezeigt');
  const x0 = c[0].x,
    y0 = c[0].y;
  await ev(B, () => document.getElementById('editor').setSelectionRange(7, 7));
  await nap();
  c = await carets(A);
  ok(c[0].y > y0 + 5, 'Zweite Zeile steht tiefer', [y0, c[0].y]);
  await ev(B, () => document.getElementById('editor').setSelectionRange(1, 3));
  await nap();
  ok((await marks(A)) === 1, 'Markierung wird gezeigt', await marks(A));
  await ev(B, () => document.getElementById('editor').setSelectionRange(2, 2));
  await nap();
  ok((await marks(A)) === 0, 'Markierung verschwindet', await marks(A));
  const tile = await ev(B, () => {
    const s = document.querySelector('g[data-id="n1"] text').getBoundingClientRect();
    return s.height;
  });
  await B.keyboard.type('xx');
  await nap();
  c = await carets(A);
  ok(c[0].x > x0, 'Cursor folgt dem Tippen', [x0, c[0].x]);
  console.log('=== Beide im selben Text');
  await edit(A, 'n1', { at: 0 });
  await nap(300);
  ok((await carets(A)).length === 1, 'Auch im eigenen Editor sichtbar');
  const before = (await carets(A))[0].x;
  await A.keyboard.type('nnn');
  await idle();
  await wait(600);
  const movedNow = (await carets(A))[0].x;
  ok(movedNow > before, 'Wandert mit, wenn man davor tippt', [before, movedNow]);
  ok((await carets(B)).length === 1, 'Gegenseitig');
  await stop(A);
  await idle();
  console.log('=== Zoomen');
  await view(A, 100, 50, 0.5);
  await nap(200);
  c = await carets(A);
  const r2 = await rectOf(A, 'n1');
  ok(c[0] && c[0].x > r2.x && c[0].x < r2.x + r2.w && c[0].h < (tile || 40), 'Bleibt beim Zoomen am Text', [c[0], r2]);
  await view(A, 0, 0);
  console.log('=== Ende');
  await stop(B);
  await nap();
  ok((await carets(A)).length === 0, 'Verschwindet beim Beenden', await carets(A));
  console.log('=== Andere Elementarten');
  await ev(A, async () => {
    const c = await import('/js/core.js');
    const t = c.makeElement('table', 0, 0);
    t.id = 'tb';
    t.x = 800;
    t.y = 200;
    t.rows = 3;
    t.cols = 2;
    t.cells = [
      ['Eins', 'Zwei'],
      ['', ''],
      ['', ''],
    ];
    c.setEl(t);
    const k = c.makeElement('code', 0, 0);
    k.id = 'cd';
    k.x = 800;
    k.y = 500;
    k.text = 'if (x) {\n  y();\n}';
    c.setEl(k);
  });
  await wait(500);
  await edit(B, 'tb', { cell: [0, 1], at: 2 });
  await nap();
  c = await carets(A);
  const rt = await rectOf(A, 'tb');
  ok(c.length === 1 && c[0].x > rt.x + rt.w / 2, 'In der richtigen Zelle', [c[0], rt]);
  await stop(B);
  await idle();
  await edit(B, 'cd', { at: 12 });
  await nap();
  c = await carets(A);
  ok(c.length === 1, 'Im Code', c.length);
  await stop(B);
  await idle();
  console.log('=== Abgeblendet');
  await edit(B, 'n1');
  await B.keyboard.type('y');
  await nap();
  ok(await ev(A, () => !document.querySelector('.text-caret')?.classList.contains('quiet')), 'Name sichtbar');
  await wait(3500);
  ok(await ev(A, () => document.querySelector('.text-caret')?.classList.contains('quiet')), 'Name blendet nach einer Pause aus');
  await stop(B);
  await idle();
  console.log('=== Anonym');
  await ev(A, async () => {
    const c = await import('/js/core.js');
    c.app.sync.op({ op: 'privateMode', active: true, anonymous: true });
  });
  await wait(600);
  await ev(B, async () => {
    const c = await import('/js/core.js');
    const s = c.makeElement('sticky', 1400, 200);
    s.id = 'an';
    c.setEl(s);
  });
  await wait(600);
  await ev(A, async () => {
    const c = await import('/js/core.js');
    c.app.sync.op({ op: 'privateMode', active: false });
  });
  await wait(800);
  await edit(B, 'an');
  await B.keyboard.type('still');
  await nap();
  ok((await carets(A)).length === 0, 'Anonyme Beiträge zeigen keinen Cursor', await carets(A));
  await stop(B);
  await idle();

  console.log('=== Nachprüfung Cursor');
  await view(A, 0, 0);
  await mk(A, 'sticky', 'v1', { text: 'hallo', x: 300, y: 300 });
  await wait(500);
  await edit(B, 'v1', { at: 2 });
  await nap();
  ok((await carets(A)).length === 1, 'Cursor da');
  const cid = await ev(B, async () => (await import('/js/core.js')).app.sync.clientId);
  await ev(
    B,
    async (id) => {
      await fetch(`/api/boards/${id}/signal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Vibeboard': '1' },
        body: JSON.stringify({
          clientId: (await import('/js/core.js')).app.sync.clientId,
          kind: 'caret',
          data: { id: 'tb', field: 'text', pos: 0, end: 0 },
        }),
      });
    },
    id,
  );
  await nap();
  await ev(B, () => document.getElementById('editor').setSelectionRange(3, 3));
  await nap();
  ok((await carets(A)).length === 1, 'Ungültiges Signal friert nichts ein', await carets(A));
  const peersBefore = await ev(A, async () => (await import('/js/core.js')).app.peers.size);
  await B.goto('about:blank');
  await wait(1800);
  ok((await carets(A)).length === 0, 'Cursor verschwindet, wenn die Person geht', await carets(A));
  await B.goto(BASE + '/board/' + id, { waitUntil: 'load' });
  await wait(1300);
  {
    const q = await B.createCDPSession();
    await q.send('Emulation.setFocusEmulationEnabled', { enabled: true });
  }
  await view(A, -200, -1800);
  await view(B, -200, -1800);
  await ev(A, async () => {
    const c = await import('/js/core.js');
    const t = c.makeElement('table', 0, 0);
    t.id = 'tc';
    t.x = 400;
    t.y = 2000;
    t.rows = 3;
    t.cols = 2;
    t.cells = [
      ['', 'x'],
      ['', 'y'],
      ['', 'z'],
    ];
    c.setEl(t);
  });
  await wait(500);
  await edit(B, 'tc', { cell: [1, 1], at: 1 });
  await nap();
  const y1 = (await carets(A))[0]?.y;
  await ev(A, async () => {
    const c = await import('/js/core.js');
    c.tableStruct(c.getEl('tc'), { action: 'insertRows', at: 0, count: 1, size: 40 });
  });
  await nap();
  const y2 = (await carets(A))[0]?.y;
  ok(y2 > y1, 'Eigene neue Zeile verschiebt den fremden Cursor', [y1, y2]);
  await stop(B);
  await idle();
  await ev(A, async () => {
    const c = await import('/js/core.js');
    const s = c.makeElement('sticky', 600, 2600);
    s.id = 'pv';
    c.setEl(s);
  });
  await wait(300);
  await ev(B, async () => {
    window.__c = [];
    const c = await import('/js/core.js');
    c.app.sync.on('signal', (m) => m.kind === 'caret' && window.__c.push(m));
  });
  await ev(A, async () => {
    const c = await import('/js/core.js');
    c.app.sync.op({ op: 'privateMode', active: true });
  });
  await wait(500);
  await ev(A, async () => {
    const c = await import('/js/core.js');
    const s = c.makeElement('sticky', 900, 2600);
    s.id = 'gh';
    c.setEl(s);
  });
  await wait(500);
  await edit(A, 'gh');
  await A.keyboard.type('geheim');
  await nap();
  await stop(A);
  await idle();
  await ev(A, async () => {
    const c = await import('/js/core.js');
    c.app.sync.op({ op: 'privateMode', active: false });
  });
  await wait(400);
  ok(await ev(B, () => !window.__c.some((m) => m.data && m.data.id === 'gh')), 'Private Texte melden keine Position');

  console.log('=== Bezug in der Formel');
  await ev(A, async () => {
    const c = await import('/js/core.js');
    const t = c.makeElement('table', 0, 0);
    t.id = 'tf';
    t.x = 200;
    t.y = 900;
    t.rows = 3;
    t.cols = 3;
    t.cells = [
      ['1', '2', '3'],
      ['', '', ''],
      ['', '', ''],
    ];
    c.setEl(t);
    c.app.view.x = 0;
    c.app.view.y = -600;
    c.app.view.z = 1;
    c.applyView();
  });
  await wait(500);
  await view(B, 0, -600);
  await edit(A, 'tf', { cell: [1, 0] });
  await A.keyboard.type('=A1+');
  await idle();
  await nap(200);
  await edit(B, 'tf', { cell: [1, 0], at: 0 });
  await wait(200);
  const rf = await rectOf(A, 'tf');
  const cw = rf.w / 3,
    ch = rf.h / 3;
  await A.mouse.move(rf.x + cw * 1.5, rf.y + ch * 0.5);
  await A.mouse.down();
  await wait(150);
  await B.keyboard.type('xx');
  await idle();
  await wait(400);
  await A.mouse.move(rf.x + cw * 2.5, rf.y + ch * 0.5, { steps: 4 });
  await A.mouse.up();
  await idle();
  await wait(300);
  const fv = await edVal(A);
  ok(fv === 'xx=A1+B1:C1', 'Bezug bleibt an seiner Stelle', fv);
  ok(fv === (await edVal(B)), 'Beide gleich', [fv, await edVal(B)]);
  await stop(A);
  await stop(B);
  await idle();

  console.log('=== Tabellenstruktur');
  const cells = async (p, i) => (await get(p, i)).cells;
  await ev(A, async () => {
    const c = await import('/js/core.js');
    const t = c.makeElement('table', 0, 0);
    t.id = 'ts';
    t.x = 0;
    t.y = 2000;
    t.rows = 4;
    t.cols = 2;
    t.cells = [
      ['a', 'b'],
      ['c', 'd'],
      ['e', 'f'],
      ['g', 'h'],
    ];
    c.setEl(t);
  });
  await wait(500);
  const slow = () => A.emulateNetworkConditions({ upload: 10000000, download: 10000000, latency: 900 });
  const fast = () => A.emulateNetworkConditions(null);
  await slow();
  await ev(A, async () => {
    const c = await import('/js/core.js');
    c.tablePatch(c.getEl('ts'), { cells: [[2, 1, 'NEU']] });
  });
  await ev(B, async () => {
    const c = await import('/js/core.js');
    c.tableStruct(c.getEl('ts'), { action: 'insertRows', at: 0, count: 1, size: 40 });
  });
  await wait(2500);
  await fast();
  await idle();
  await wait(500);
  let a = await cells(A, 'ts'),
    b2 = await cells(B, 'ts');
  ok(b2[3][1] === 'NEU' && a[3][1] === 'NEU', 'Zelländerung landet trotz neuer Zeile richtig', { a, b2 });
  ok(JSON.stringify(a) === JSON.stringify(b2), 'Alle gleich', { a, b2 });
  await slow();
  await ev(A, async () => {
    const c = await import('/js/core.js');
    c.tablePatch(c.getEl('ts'), { cells: [[1, 0, 'X']] });
  });
  await ev(B, async () => {
    const c = await import('/js/core.js');
    c.tableStruct(c.getEl('ts'), { action: 'deleteRows', at: 1, count: 1, size: 40 });
  });
  await wait(2500);
  await fast();
  await idle();
  await wait(500);
  a = await cells(A, 'ts');
  b2 = await cells(B, 'ts');
  ok(!JSON.stringify(a).includes('"X"') && JSON.stringify(a) === JSON.stringify(b2), 'Gelöschte Zeile gewinnt', { a, b2 });
  await ev(B, async () => {
    const c = await import('/js/core.js');
    c.tablePatch(c.getEl('ts'), { cells: [[0, 0, '=B1']] });
  });
  await wait(500);
  await slow();
  await ev(A, async () => {
    const c = await import('/js/core.js');
    c.tablePatch(c.getEl('ts'), { cells: [[2, 0, '=A1']] });
  });
  await ev(B, async () => {
    const c = await import('/js/core.js');
    c.tableStruct(c.getEl('ts'), { action: 'insertRows', at: 0, count: 1, size: 40 });
  });
  await wait(2500);
  await fast();
  await idle();
  await wait(500);
  ok((await cells(B, 'ts'))[3][0] === '=A2', 'Formel in der Zelle passt sich an', (await cells(B, 'ts'))[3]);
  console.log('=== Tippen unterwegs');
  await edit(A, 'ts', { cell: [3, 1], at: 0 });
  await idle();
  await nap(300);
  await slow();
  await A.keyboard.type('Zeile');
  await ev(B, async () => {
    const c = await import('/js/core.js');
    c.tableStruct(c.getEl('ts'), { action: 'insertRows', at: 0, count: 1, size: 40 });
  });
  await wait(2500);
  await fast();
  await idle();
  await wait(800);
  await stop(A);
  await idle();
  await wait(400);
  a = await cells(A, 'ts');
  b2 = await cells(B, 'ts');
  const rowOf = a.findIndex((r) => r[1].includes('Zeile'));
  ok(rowOf === 4 && JSON.stringify(a) === JSON.stringify(b2), 'Eingabe unterwegs landet in derselben Zeile', { a, b2 });
  ok(a[4][1].split('Zeile').length === 2, 'Nicht doppelt', a[4]);
  await edit(A, 'ts', { cell: [1, 1], at: 0 });
  await nap(400);
  await A.keyboard.type('!');
  await ev(A, async () => {
    const c = await import('/js/core.js');
    c.tableStruct(c.getEl('ts'), { action: 'insertCols', at: 0, count: 1, size: 80 });
  });
  await wait(800);
  await A.keyboard.type('?');
  await idle();
  await wait(600);
  await stop(A);
  await idle();
  await wait(400);
  a = await cells(A, 'ts');
  b2 = await cells(B, 'ts');
  ok(JSON.stringify(a) === JSON.stringify(b2) && a[1][2].includes('!?'), 'Eigene Spalte beim Tippen', { a: a[1], b: b2[1] });

  console.log('Fehler:', errs.length ? errs.slice(0, 5) : 'keine');
  ok(errs.length === 0, 'keine Browserfehler', errs.slice(0, 3));
  await b.close();
  console.log(f ? 'FAIL ' + f : 'ALLES OK');
  process.exit(f ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
