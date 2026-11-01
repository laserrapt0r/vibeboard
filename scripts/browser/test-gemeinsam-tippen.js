// Gemeinsames Tippen
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

  console.log('=== Notiz: Beide tippen');
  await mk(A, 'sticky', 'n1', { text: 'Basis' });
  await wait(400);
  await edit(A, 'n1', { at: 0 });
  await edit(B, 'n1', { at: 5 });
  await wait(150);
  await both('AAAA', 'BBBB');
  await idle();
  await wait(300);
  ok((await edVal(A)) === 'AAAABasisBBBB', 'Vorn und hinten getippt: Editor A', await edVal(A));
  ok((await edVal(B)) === 'AAAABasisBBBB', 'Editor B gleich', await edVal(B));
  await fourth('n1', 'text', 'AAAABasisBBBB', 'Alle drei sehen dasselbe, auch beim Tippen');
  await stop(A);
  await stop(B);
  await idle();
  await wait(300);
  await fourth('n1', 'text', 'AAAABasisBBBB', 'Nach dem Beenden unverändert');

  console.log('=== Dieselbe Stelle');
  await mk(A, 'sticky', 'n2', { text: 'XY' });
  await wait(400);
  await edit(A, 'n2', { at: 1 });
  await edit(B, 'n2', { at: 1 });
  await wait(150);
  await both('aaaaaaaa', 'bbbbbbbb');
  await idle();
  await wait(300);
  const v2 = await edVal(A);
  ok(v2 === (await edVal(B)), 'Beide Editoren gleich', [v2, await edVal(B)]);
  ok(
    v2.split('a').length === 9 && v2.split('b').length === 9 && v2.startsWith('X') && v2.endsWith('Y'),
    'Kein Zeichen verloren oder doppelt',
    v2,
  );
  await stop(A);
  await stop(B);

  console.log('=== Cursor');
  await mk(A, 'sticky', 'n3', { text: 'Wort' });
  await wait(400);
  await edit(A, 'n3', { at: 2 });
  await A.keyboard.type('m');
  await wait(400);
  await edit(B, 'n3', { at: 0 });
  await B.keyboard.type('Vorne ');
  await idle();
  await wait(300);
  await A.keyboard.type('n');
  await idle();
  await wait(300);
  ok((await edVal(A)) === 'Vorne Womnrt', 'Cursor bleibt beim eigenen Wort', await edVal(A));
  await stop(A);
  await stop(B);

  console.log('=== Alle Elementarten');
  await mk(A, 'shape', 's1', { text: '', y: 400 });
  await mk(A, 'text', 't1', { text: '', y: 800 });
  await mk(A, 'code', 'c1', { text: '', y: 1000 });
  await mk(A, 'frame', 'f1', { title: '', y: 1500 });
  await mk(A, 'sticky', 'm1', { y: 2600, mind: true, text: '' });
  await ev(A, async () => {
    const c = await import('/js/core.js');
    const a = c.makeElement('sticky', 0, 3000);
    a.id = 'la';
    const b = c.makeElement('sticky', 600, 3000);
    b.id = 'lb';
    c.setEl(a);
    c.setEl(b);
    const l = c.makeElement('connector', 0, 0);
    l.id = 'l1';
    l.from = { id: 'la' };
    l.to = { id: 'lb' };
    c.setEl(l);
  });
  await wait(500);
  for (const [eid, f, n] of [
    ['s1', 'text', 'Form'],
    ['t1', 'text', 'Textelement'],
    ['c1', 'text', 'Code'],
    ['f1', 'title', 'Frame-Titel'],
    ['m1', 'text', 'Mindmap-Knoten'],
    ['l1', 'label', 'Linienbeschriftung'],
  ]) {
    await edit(A, eid);
    await edit(B, eid);
    await wait(120);
    await A.keyboard.type('aa');
    await wait(250);
    await ev(B, () => {
      const e = document.getElementById('editor');
      e.setSelectionRange(e.value.length, e.value.length);
    });
    await both('ccc', 'ddd');
    await idle();
    await wait(300);
    const a = await edVal(A),
      b2 = await edVal(B);
    ok(a === b2 && a.split('c').length === 4 && a.split('d').length === 4 && a.split('a').length === 3, n + ': gemeinsam', [a, b2]);
    await stop(A);
    await stop(B);
    await idle();
    await wait(250);
    await fourth(eid, f, a, n + ': überall gleich');
  }
  console.log('=== Tabellenzelle');
  await ev(A, async () => {
    const c = await import('/js/core.js');
    const t = c.makeElement('table', 0, 4000);
    t.id = 'tb';
    t.rows = 3;
    t.cols = 2;
    t.cells = [
      ['Eins', 'Zwei'],
      ['', ''],
      ['', ''],
    ];
    c.setEl(t);
  });
  await wait(400);
  await edit(A, 'tb', { cell: [0, 0], at: 0 });
  await edit(B, 'tb', { cell: [0, 0], at: 4 });
  await wait(150);
  await both('aaa', 'bbb');
  await idle();
  await wait(300);
  ok((await edVal(A)) === 'aaaEinsbbb' && (await edVal(B)) === 'aaaEinsbbb', 'Zelle gemeinsam', [await edVal(A), await edVal(B)]);
  await stop(A);
  await stop(B);
  await idle();
  await wait(300);
  ok((await get(V, 'tb')).cells[0][0] === 'aaaEinsbbb', 'Zelle überall gleich', (await get(V, 'tb')).cells[0]);
  await edit(A, 'tb', { cell: [1, 1] });
  await A.keyboard.type('unten');
  await idle();
  await ev(B, async () => {
    const c = await import('/js/core.js');
    c.tableStruct(c.getEl('tb'), { action: 'insertRows', at: 0, count: 1, size: 40 });
  });
  await wait(500);
  await A.keyboard.type('!');
  await idle();
  await wait(400);
  const tbB = (await get(B, 'tb')).cells;
  ok(tbB[2][1] === 'unten!', 'Zeile eingefügt: Eingabe wandert mit', tbB);
  await stop(A);
  await idle();

  console.log('=== Andere Felder');
  await mk(A, 'text', 'h1', { text: 'a', y: 5000, w: 120 });
  await wait(400);
  await edit(A, 'h1');
  await ev(B, async () => {
    const c = await import('/js/core.js');
    c.act(() => c.updateEl('h1', { color: '#e03131' }));
  });
  await A.keyboard.type('Zeile eins und noch viel mehr Text, damit es umbricht');
  await idle();
  await wait(400);
  const h1 = await get(B, 'h1');
  ok(h1.color === '#e03131', 'Farbe von B bleibt', h1.color);
  ok(h1.h > 60 && h1.text.length > 30, 'Höhe und Text kommen an', [h1.h, h1.text.length]);
  await stop(A);
  await idle();

  console.log('=== Rückgängig');
  await mk(A, 'sticky', 'u1', { text: 'Start', y: 5400 });
  await wait(400);
  await ev(A, async () => {
    (await import('/js/core.js')).setSelection([]);
  });
  await edit(A, 'u1', { at: 5 });
  await A.keyboard.type(' Anton');
  await idle();
  await wait(300);
  await edit(B, 'u1', { at: 0 });
  await B.keyboard.type('Berta ');
  await idle();
  await wait(300);
  await stop(B);
  await stop(A);
  await idle();
  await wait(300);
  ok((await txt(A, 'u1')) === 'Berta Start Anton', 'Beide Texte da', await txt(A, 'u1'));
  await ev(A, async () => {
    (await import('/js/core.js')).undo();
  });
  await idle();
  await wait(400);
  ok((await txt(A, 'u1')) === 'Berta Start', 'Rückgängig nimmt nur die eigene Eingabe', await txt(A, 'u1'));
  ok((await txt(B, 'u1')) === 'Berta Start', 'auch bei der anderen Person', await txt(B, 'u1'));
  await ev(A, async () => {
    (await import('/js/core.js')).redo();
  });
  await idle();
  await wait(400);
  ok((await txt(B, 'u1')) === 'Berta Start Anton', 'Wiederholen', await txt(B, 'u1'));
  console.log('=== Weitertippen danach');
  await mk(A, 'sticky', 'u2', { text: '', y: 5800 });
  await wait(300);
  await ev(A, async () => {
    const c = await import('/js/core.js');
    c.setSelection([]);
  });
  await edit(A, 'u2');
  await A.keyboard.type('Erst');
  await idle();
  await stop(A);
  await idle();
  await edit(B, 'u2', { at: 4 });
  await B.keyboard.type(' dann');
  await stop(B);
  await idle();
  await wait(300);
  ok((await txt(A, 'u2')) === 'Erst dann', 'Nacheinander bearbeitet', await txt(A, 'u2'));

  console.log('=== Karte im Dialog');
  await ev(A, async () => {
    const c = await import('/js/core.js');
    const k = c.makeElement('card', 0, 6200);
    k.id = 'k1';
    k.description = 'Text';
    c.setEl(k);
    c.setSelection(['k1']);
    c.app.emit('editCard', 'k1');
  });
  await wait(500);
  await ev(B, async () => {
    const c = await import('/js/core.js');
    c.act(() => c.updateEl('k1', { description: 'Oben\nText' }));
  });
  await idle();
  await wait(400);
  await ev(A, () => {
    const t = document.querySelector('.modal textarea');
    t.value = t.value + '\nUnten';
    t.dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelector('.modal form').requestSubmit();
  });
  await idle();
  await wait(400);
  ok((await get(B, 'k1')).description === 'Oben\nText\nUnten', 'Beide Beschreibungen bleiben', (await get(B, 'k1')).description);

  console.log('=== Offline');
  await mk(A, 'sticky', 'o1', { text: 'Mitte', y: 6600 });
  await wait(400);
  await edit(A, 'o1', { at: 0 });
  await edit(B, 'o1', { at: 5 });
  await wait(150);
  await A.setOfflineMode(true);
  await wait(300);
  await A.keyboard.type('offline ');
  await B.keyboard.type(' online');
  await wait(800);
  ok((await edVal(A)).startsWith('offline Mitte'), 'Offline weiter tippen', await edVal(A));
  ok((await edVal(B)) === 'Mitte online', 'Die andere Seite tippt weiter', await edVal(B));
  await A.setOfflineMode(false);
  for (let i = 0; i < 60 && (await edVal(A)) !== 'offline Mitte online'; i++) await wait(250);
  await idle();
  await wait(400);
  ok((await edVal(A)) === 'offline Mitte online' && (await edVal(B)) === 'offline Mitte online', 'Nach der Rückkehr zusammengeführt', [
    await edVal(A),
    await edVal(B),
  ]);
  await stop(A);
  await stop(B);
  await idle();

  console.log('=== Long-Polling');
  await B.goto(BASE + '/board/' + id + '?transport=poll', { waitUntil: 'load' });
  await wait(1500);
  await B.bringToFront();
  {
    const c = await B.createCDPSession();
    await c.send('Emulation.setFocusEmulationEnabled', { enabled: true });
  }
  await mk(A, 'sticky', 'p1', { text: '', y: 7000 });
  await wait(1200);
  await edit(A, 'p1');
  await edit(B, 'p1');
  await wait(200);
  await both('eeee', 'ffff', 30);
  await idle();
  await wait(1000);
  const pa = await edVal(A);
  ok(pa === (await edVal(B)) && pa.split('e').length === 5 && pa.split('f').length === 5, 'Beide Transportwege gemeinsam', [
    pa,
    await edVal(B),
  ]);
  await stop(A);
  await stop(B);
  await B.goto(BASE + '/board/' + id, { waitUntil: 'load' });
  await wait(1200);
  {
    const c = await B.createCDPSession();
    await c.send('Emulation.setFocusEmulationEnabled', { enabled: true });
  }

  console.log('=== Löschen beim Tippen');
  await mk(A, 'sticky', 'd1', { text: 'weg', y: 7400 });
  await wait(400);
  await edit(B, 'd1');
  await B.keyboard.type('xx');
  await ev(A, async () => {
    (await import('/js/core.js')).deleteEls(['d1']);
  });
  await wait(800);
  ok(await ev(B, async () => !(await import('/js/core.js')).app.editing), 'Editor schließt');
  await idle();
  ok(!(await ev(B, async () => (await import('/js/core.js')).app.sync.pending)), 'Nichts bleibt hängen');

  console.log('=== Bearbeitungssperre');
  await mk(A, 'sticky', 'e1', { text: 'Sperre', y: 7800 });
  await wait(400);
  await edit(B, 'e1');
  await B.keyboard.type('vor ');
  await idle();
  await wait(300);
  await ev(A, async () => {
    (await import('/js/moderation.js')).setModeration({ active: true, editLock: true });
  });
  await wait(900);
  ok(await ev(B, async () => !(await import('/js/core.js')).app.editing), 'Sperre beendet das Bearbeiten');
  await ev(A, async () => {
    (await import('/js/moderation.js')).setModeration({ active: false });
  });
  await wait(900);
  await idle();
  ok((await txt(A, 'e1')) === (await txt(B, 'e1')), 'Text gleich', [await txt(A, 'e1'), await txt(B, 'e1')]);
  ok(!(await ev(B, async () => (await import('/js/core.js')).app.sync.pending)), 'Nichts bleibt hängen');

  console.log('=== Privatmodus');
  await ev(V, async () => {
    const c = await import('/js/core.js');
    window.__seen = [];
    c.app.sync.on('ops', (m) => window.__seen.push(JSON.stringify(m)));
  });
  await ev(A, async () => {
    const c = await import('/js/core.js');
    c.app.sync.op({ op: 'privateMode', active: true });
  });
  await wait(500);
  await mk(A, 'sticky', 'g1', { text: '', y: 8200 });
  await wait(500);
  await edit(A, 'g1');
  await A.keyboard.type('Geheimwort');
  await idle();
  await wait(500);
  await stop(A);
  await idle();
  ok(
    !(await ev(V, () => window.__seen.join('')).then((s) => s.includes('Geheimwort') || /Geheim/.test(s))),
    'Getipptes erreicht Dritte nicht',
  );
  ok((await txt(A, 'g1')) === 'Geheimwort', 'Der eigene Text ist da', await txt(A, 'g1'));
  await ev(A, async () => {
    const c = await import('/js/core.js');
    c.app.sync.op({ op: 'privateMode', active: false });
  });
  await wait(500);

  console.log('=== Neustart des Servers');
  await mk(A, 'sticky', 'r1', { text: 'vorher', y: 8600 });
  await wait(500);
  await edit(A, 'r1', { at: 6 });
  await A.keyboard.type(' A');
  await idle();
  server('restart');
  for (let i = 0; i < 80; i++) {
    await wait(250);
    if (await ev(A, async () => (await import('/js/core.js')).app.sync.connected)) break;
  }
  await wait(600);
  await A.keyboard.type(' B');
  await idle();
  await wait(800);
  await stop(A);
  await idle();
  await wait(500);
  await B.reload({ waitUntil: 'load' });
  await wait(1500);
  ok((await txt(B, 'r1')) === 'vorher A B', 'Tippen übersteht den Neustart', await txt(B, 'r1'));

  console.log('=== Nachprüfung');
  await mk(A, 'sticky', 'w1', { text: 'Hallo Welt', y: 9000 });
  await wait(500);
  await ev(A, async () => {
    (await import('/js/core.js')).setSelection([]);
  });
  await edit(A, 'w1', { at: 0 });
  await A.keyboard.type('foo ');
  await idle();
  await stop(A);
  await idle();
  await ev(A, async () => {
    (await import('/js/core.js')).undo();
  });
  await idle();
  await wait(400);
  ok((await txt(A, 'w1')) === 'Hallo Welt', 'Rückgängig allein', await txt(A, 'w1'));
  await edit(A, 'w1');
  await A.keyboard.type('!');
  await idle();
  await wait(300);
  await stop(A);
  await idle();
  await wait(300);
  ok((await txt(B, 'w1')) === 'Hallo Welt!', 'Danach an der richtigen Stelle getippt', await txt(B, 'w1'));
  await ev(A, async () => {
    const c = await import('/js/core.js');
    const t = c.makeElement('table', 0, 9400);
    t.id = 'tf';
    t.rows = 4;
    t.cols = 2;
    t.cells = [
      ['1', '2'],
      ['=A1+1', ''],
      ['', ''],
      ['', ''],
    ];
    c.setEl(t);
  });
  await wait(500);
  await edit(A, 'tf', { cell: [1, 0] });
  await wait(300);
  await ev(B, async () => {
    const c = await import('/js/core.js');
    c.tableStruct(c.getEl('tf'), { action: 'insertRows', at: 0, count: 1, size: 40 });
  });
  await wait(800);
  ok((await edVal(A)) === '=A2+1', 'Offene Formel folgt der neuen Zeile', await edVal(A));
  await A.keyboard.type('0');
  await idle();
  await wait(400);
  await stop(A);
  await idle();
  await wait(300);
  ok((await get(B, 'tf')).cells[2][0] === '=A2+10', 'Eingabe danach richtig', (await get(B, 'tf')).cells[2]);
  await A.setOfflineMode(true);
  await wait(200);
  await ev(A, async () => {
    const c = await import('/js/core.js');
    const s = c.makeElement('sticky', 0, 10000);
    s.id = 'nw';
    c.setEl(s);
    c.setSelection([]);
    c.startEdit('nw', { isNew: true, selectAll: false });
  });
  await A.keyboard.type('hell');
  await wait(600);
  await ev(A, async () => {
    const c = await import('/js/core.js');
    c.act(() => c.updateEl('nw', { fill: '#ffc9c9' }));
  });
  await A.keyboard.type('o');
  await wait(300);
  await A.setOfflineMode(false);
  for (let i = 0; i < 50 && (await txt(B, 'nw')) !== 'hello'; i++) await wait(200);
  await idle();
  await wait(500);
  ok((await txt(B, 'nw')) === 'hello', 'Neue Notiz offline: Text einmal', await txt(B, 'nw'));
  await stop(A);
  await idle();
  await mk(A, 'sticky', 'ime', { text: '', y: 10400 });
  await wait(400);
  await edit(A, 'ime');
  await ev(A, () => {
    const e = document.getElementById('editor');
    e.dispatchEvent(new CompositionEvent('compositionstart'));
    e.value = 'かな';
    e.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await wait(200);
  await stop(A);
  await idle();
  await wait(400);
  ok((await txt(B, 'ime')) === 'かな', 'Offene Komposition bleibt beim Beenden erhalten', await txt(B, 'ime'));
  const cl = await ev(A, async () => (await import('/js/core.js')).app.sync.clientId);
  const post = (o) => api(A, 'POST', `/api/boards/${id}/ops`, { clientId: cl, ops: o });
  await ev(A, async () => {
    const c = await import('/js/core.js');
    const i = c.makeElement('image', 0, 10800);
    i.id = 'im';
    i.src = '/favicon.svg';
    c.setEl(i);
  });
  await wait(500);
  let r = await post([{ op: 'ttext', id: 'im', field: 'text', ops: [{ p: 0, i: 'x' }], base: 0, opId: 'a1' }]);
  ok(r.status === 200, 'Text auf Bild: abgelehnt, kein Hänger', r.status);
  r = await post([
    { op: 'upsert', el: { ...(await get(A, 'ime')), text: 'k' }, edits: 'x', applied: 1 },
    { op: 'tpatch', id: 'tf', cells: [[0, 0, 'q']], edits: [null] },
    { op: 'timer', edits: 1, timer: null },
    { op: 'tsync', id: 'ime', field: '__proto__', base: 0 },
  ]);
  ok(r.status === 200, 'Gefälschte Felder richten nichts an', r.status);
  r = await post([
    { op: 'ttext', id: 'ime', field: 'text', ops: [null], base: 0, opId: 'a2' },
    { op: 'ttext', id: 'ime', field: 'text', ops: [{ p: 0, i: 'z' }], base: 'x', opId: 'a3' },
  ]);
  ok(r.status === 200, 'Ungültige Schritte werden ignoriert', r.status);

  console.log('=== Papierkorb-Layout');
  const del = (await api(A, 'POST', '/api/boards', { name: 'Lang' })).body.id;
  await api(A, 'DELETE', '/api/boards/' + del);
  await A.setViewport({ width: 1600, height: 900 });
  await A.goto(BASE + '/', { waitUntil: 'networkidle0' });
  await ev(A, () => [...document.querySelectorAll('button,a')].find((b) => /^Papierkorb/.test(b.textContent.trim()))?.click());
  await wait(600);
  for (const w of [2000, 1600, 1280, 800, 390]) {
    await A.setViewport({ width: w, height: 900 });
    await wait(200);
    const r = await ev(A, () =>
      [...document.querySelectorAll('.board-card.trashed')].map((c) => {
        const k = c.getBoundingClientRect();
        return [...c.querySelectorAll('.btn')].every((b) => {
          const q = b.getBoundingClientRect();
          return q.right <= k.right + 0.5 && q.left >= k.left;
        });
      }),
    );
    ok(r.length && r.every(Boolean), `Knöpfe bleiben in der Karte (${w} px)`, r);
  }
  await api(A, 'DELETE', '/api/trash/' + del);

  console.log('Fehler:', errs.length ? errs.slice(0, 5) : 'keine');
  ok(errs.length === 0, 'keine Browserfehler', errs.slice(0, 3));
  await b.close();
  console.log(f ? 'FAIL ' + f : 'ALLES OK');
  process.exit(f ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
