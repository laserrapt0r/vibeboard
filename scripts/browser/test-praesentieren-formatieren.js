// Präsentieren für alle (mehrere Personen, auch im Rückfall-Transport), Formatieren beim Tippen, Hilfe
const { launch, BASE, server } = require('./lib');
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
    m,
    u,
    b,
  );
const login = async (p, e, pw) => {
  await p.goto(BASE + '/login', { waitUntil: 'networkidle0' });
  const r = await api(p, 'POST', '/api/auth/login', { login: e, password: pw });
  if (r.status >= 300) throw new Error('login ' + e);
};
const core = (p, fn, ...a) => p.evaluate(`(async () => { const c = await import('/js/core.js'); return (${fn})(c, ...${JSON.stringify(a)}); })()`);
const until = async (fn, ms = 5000) => {
  const end = Date.now() + ms;
  for (;;) {
    const v = await fn();
    if (v || Date.now() > end) return v;
    await wait(80);
  }
};
const mk = (p, type, id, o = {}) =>
  core(
    p,
    (c, type, id, o) => {
      const e = c.makeElement(type, o.x || 0, o.y || 0);
      e.id = id;
      Object.assign(e, o);
      c.act(() => c.setEl(e));
    },
    type,
    id,
    o,
  );
const el = (p, id) => core(p, (c, id) => JSON.parse(JSON.stringify(c.getEl(id) || null)), id);
const open = async (p, id, extra = '') => {
  await p.goto(BASE + '/board/' + id + extra, { waitUntil: 'load' });
  await p.waitForFunction(async () => (await import('/js/core.js')).app.loaded === true, { timeout: 15000 });
  await wait(200);
  await p.evaluate(() => document.querySelector('#empty-start .btn:last-child')?.click());
};
const clickAt = async (p, sel, text) => {
  await p.bringToFront();
  const r = await p.evaluate(
    (sel, text) => {
      const b = [...document.querySelectorAll(sel)].find((x) => !text || x.textContent.trim() === text || x.title === text);
      if (!b) return null;
      const q = b.getBoundingClientRect();
      return { x: q.left + q.width / 2, y: q.top + q.height / 2 };
    },
    sel,
    text,
  );
  if (!r) throw new Error('Kein Knopf: ' + sel + ' ' + text);
  await p.mouse.click(r.x, r.y);
};
const inAudience = (p) => p.evaluate(() => document.body.classList.contains('audience'));
const barText = (p) => p.evaluate(() => (document.querySelector('#audience-bar:not(.hidden)') || {}).textContent || '');
const toastText = (p) => p.evaluate(() => {
  const t = document.getElementById('toast');
  return t && t.classList.contains('show') ? t.textContent : '';
});
const session = (p) => core(p, (c) => c.app.session.presentation || null);
const centered = (p, id) =>
  core(
    p,
    (c, id) => {
      const e = c.getEl(id);
      const a = c.toScreen(e.x, e.y), b = c.toScreen(e.x + e.w, e.y + e.h);
      const s = c.stage.getBoundingClientRect();
      return Math.abs((a.x + b.x) / 2 - s.width / 2) < 4 && Math.abs((a.y + b.y) / 2 - s.height / 2) < 4;
    },
    id,
  );
const present = async (p, how) => {
  await p.bringToFront();
  await p.evaluate(() => document.getElementById('btn-present').click());
  await wait(200);
  await clickAt(p, '.modal-back .btn', how);
};
const clientOp = (p, op) =>
  core(
    p,
    async (c, op) => {
      const r = await fetch(`/api/boards/${c.app.boardId}/ops`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Vibeboard': '1' }, body: JSON.stringify({ clientId: c.app.sync.clientId, ops: [op] }) });
      return { status: r.status, body: await r.json().catch(() => null) };
    },
    op,
  );

(async () => {
  const b = await launch();
  const errs = [];
  const person = async (mail, pw, label) => {
    const ctx = await b.createBrowserContext();
    const p = await ctx.newPage();
    await login(p, mail, pw);
    p.on('pageerror', (e) => errs.push(label + ' ' + e.message));
    return p;
  };
  const A = await person('admin@test.example', 'Rotkehlchen-Wolke-47', 'A');
  const B = await person('anna@example.org', 'Gewitter-Laterne-83', 'B');
  const V = await person('ben@example.org', 'Gewitter-Laterne-83', 'V');
  const C = await person('cleo@example.org', 'Gewitter-Laterne-83', 'C');
  const board = async (name) => {
    const id = (await api(A, 'POST', '/api/boards', { name })).body.id;
    await api(A, 'POST', `/api/boards/${id}/members`, { email: 'anna@example.org', role: 'editor' });
    await api(A, 'POST', `/api/boards/${id}/members`, { email: 'ben@example.org', role: 'viewer' });
    await api(A, 'POST', `/api/boards/${id}/members`, { email: 'cleo@example.org', role: 'commenter' });
    return id;
  };

  const presentation = async (label, extra) => {
    console.log(`=== Präsentieren ${label}`);
    const id = await board('Vortrag ' + label);
    await open(A, id, extra);
    for (let i = 0; i < 3; i++) await mk(A, 'frame', 'f' + i, { x: i * 1500, y: 0, w: 1000, h: 600, title: 'Folie ' + i, order: i + 1 });
    await mk(A, 'sticky', 'note', { x: 100, y: 100, text: 'Zettel' });
    await mk(A, 'sticky', 'drag', { x: 300, y: 300, text: 'Zieh mich' });
    await wait(300);
    await open(B, id, extra);
    await open(V, id, extra);

    await A.bringToFront();
    await A.evaluate(() => document.getElementById('btn-present').click());
    await wait(250);
    const dlg = await A.evaluate(() => ({ t: document.querySelector('.modal h2')?.textContent, b: [...document.querySelectorAll('.modal-back .btn')].map((x) => x.textContent) }));
    ok(dlg.t === 'Für alle präsentieren?' && dlg.b.join() === 'Nur für mich,Für alle', 'Beim Start kommt die Frage', dlg);
    await clickAt(A, '.modal-back .btn', 'Nur für mich');
    await wait(500);
    ok(await A.evaluate(() => document.body.classList.contains('presenting')), 'Nur für mich: Präsentation läuft');
    ok(!(await session(B)) && !(await inAudience(B)), 'Nur für mich: Niemand wird mitgenommen');
    await A.keyboard.press('Escape');
    await wait(300);

    await present(A, 'Für alle');
    ok(await until(() => inAudience(B)), 'Für alle: Bearbeitende folgen ohne Zutun');
    ok(await until(() => inAudience(V)), 'Für alle: Betrachter folgen ohne Zutun');
    await wait(200);
    ok(await centered(B, 'f0'), 'Publikum sieht die erste Folie');
    const chrome = await B.evaluate(() => ['#tools', '#topbar', '#topright', '#bottom-left'].map((s) => getComputedStyle(document.querySelector(s)).display));
    ok(chrome.every((d) => d === 'none'), 'Reduzierte Ansicht ohne Werkzeugleisten', chrome);
    ok(/präsentiert · 1 \/ 3 · Folie 0/.test(await barText(B)) && /Selbst umsehen/.test(await barText(B)), 'Hinweis nennt, wer präsentiert', await barText(B));
    ok(!/beenden/.test(await barText(B)), 'Nur die Leitung sieht „Für alle beenden“');
    await A.bringToFront();
    await A.keyboard.press('ArrowRight');
    ok(await until(() => core(B, (c) => c.app.session.presentation?.slide?.i === 1)), 'Folienwechsel kommt an');
    await wait(200);
    ok(await centered(B, 'f1') && (await centered(V, 'f1')), 'Alle folgen dem Folienwechsel');
    await B.bringToFront();
    const n0 = await core(B, (c) => c.app.els.size);
    await B.keyboard.press('n');
    await B.keyboard.press('Delete');
    await B.mouse.click(600, 400);
    await wait(150);
    ok((await core(B, (c) => c.app.tool)) === 'select' && (await core(B, (c) => c.app.els.size)) === n0, 'Publikum legt nichts an und verändert nichts');

    console.log('--- Selbst umsehen');
    await clickAt(B, '#audience-bar button', 'Selbst umsehen');
    await wait(150);
    ok(!(await inAudience(B)) && (await B.evaluate(() => getComputedStyle(document.querySelector('#tools')).display !== 'none')), 'Selbst umsehen gibt die Oberfläche frei');
    ok(/Wieder folgen/.test(await barText(B)), 'Der Knopf heißt jetzt „Wieder folgen“', await barText(B));
    await A.bringToFront();
    await A.keyboard.press('ArrowRight');
    await until(() => core(V, (c) => c.app.session.presentation?.slide?.i === 2));
    await wait(250);
    ok(await centered(V, 'f2'), 'Andere folgen weiter');
    ok(!(await centered(B, 'f2')), 'Wer sich umsieht, bleibt, wo er ist');
    await clickAt(B, '#audience-bar button', 'Wieder folgen');
    await wait(200);
    ok((await inAudience(B)) && (await centered(B, 'f2')), 'Wieder folgen springt zur aktuellen Folie');
    await B.bringToFront();
    await B.keyboard.press('Escape');
    await wait(150);
    ok(!(await inAudience(B)), 'Esc im Publikum: Selbst umsehen');
    await clickAt(B, '#audience-bar button', 'Wieder folgen');
    await wait(150);

    console.log('--- Später dazukommen');
    await open(C, id, extra);
    ok(await until(() => inAudience(C)), 'Wer später kommt, wird mitgenommen');
    await wait(400);
    ok(await centered(C, 'f2'), 'und sieht die aktuelle Folie');

    console.log('--- Ende');
    await A.bringToFront();
    await A.keyboard.press('Escape');
    ok(await until(async () => !(await inAudience(B)) && !(await inAudience(V)) && !(await inAudience(C))), 'Ende gilt für alle');
    ok(/beendet/.test(await toastText(V)), 'Meldung am Ende', await toastText(V));
    ok(!(await barText(B)), 'Der Hinweis verschwindet');
    ok(await B.evaluate(() => getComputedStyle(document.querySelector('#tools')).display !== 'none' && !document.body.classList.contains('presenting')), 'Oberfläche ist zurück');
    await C.goto('about:blank');

    console.log('--- Offene Arbeit bleibt');
    await core(B, (c) => {
      c.setSelection(['note']);
      c.fitTo({ x: 0, y: 0, w: 1000, h: 800 }, { pad: 0, maxZ: 1 });
    });
    await wait(500);
    await B.bringToFront();
    await B.keyboard.press('Enter');
    await wait(150);
    await B.keyboard.type(' ist offen');
    await present(A, 'Für alle');
    await wait(900);
    ok(!(await inAudience(B)) && (await core(B, (c) => !!c.app.editing)), 'Offene Eingabe bleibt offen');
    ok(/sobald du hier fertig bist/.test(await barText(B)), 'Hinweis erklärt das Warten', await barText(B));
    const sameBar = await B.evaluate(async () => {
      const btn = document.querySelector('#audience-bar button');
      await new Promise((r) => setTimeout(r, 800));
      return btn.isConnected && btn === document.querySelector('#audience-bar button');
    });
    ok(sameBar, 'Beim Warten bleibt der Knopf derselbe, ein Klick geht nicht verloren');
    await B.bringToFront();
    await B.keyboard.type(' und bleibt');
    await wait(100);
    ok((await B.evaluate(() => document.getElementById('editor').value)) === 'Zettel ist offen und bleibt', 'Tippen geht weiter');
    await B.keyboard.press('Escape');
    ok(await until(() => inAudience(B), 2000), 'Nach der Eingabe kommt das Folgen');
    ok((await until(async () => (await el(V, 'note')).text === 'Zettel ist offen und bleibt')), 'Eingabe ist bei allen angekommen');
    await A.bringToFront();
    await A.keyboard.press('Escape');
    await until(async () => !(await inAudience(B)));

    await core(B, (c) => c.app.emit('openPalette'));
    await wait(200);
    await present(A, 'Für alle');
    await wait(800);
    ok(!(await inAudience(B)) && (await B.evaluate(() => !!document.querySelector('.modal-back'))), 'Offener Dialog bleibt offen');
    await B.bringToFront();
    await B.keyboard.press('Escape');
    ok(await until(() => inAudience(B), 2000), 'Nach dem Dialog kommt das Folgen');
    await A.bringToFront();
    await A.keyboard.press('Escape');
    await until(async () => !(await inAudience(B)));

    await core(B, (c) => {
      c.setSelection([]);
      c.fitTo({ x: 0, y: 0, w: 1000, h: 800 }, { pad: 0, maxZ: 1 });
    });
    await wait(500);
    const start = await core(B, (c) => {
      const s = c.toScreen(380, 380);
      const r = c.stage.getBoundingClientRect();
      return { x: s.x + r.left, y: s.y + r.top };
    });
    const x0 = (await el(B, 'drag')).x;
    await B.bringToFront();
    await B.mouse.move(start.x, start.y);
    await B.mouse.down();
    await B.mouse.move(start.x + 40, start.y + 20, { steps: 3 });
    await present(A, 'Für alle');
    await wait(800);
    ok(!(await inAudience(B)), 'Laufendes Ziehen wird nicht unterbrochen');
    await B.bringToFront();
    await B.mouse.move(start.x + 80, start.y + 20, { steps: 3 });
    await B.mouse.up();
    ok(await until(() => inAudience(B), 2000), 'Nach dem Ziehen kommt das Folgen');
    ok((await el(B, 'drag')).x > x0 + 20, 'Das Ziehen ist angekommen', await el(B, 'drag'));

    console.log('--- Verbindung weg');
    await B.setOfflineMode(true);
    await V.evaluate(() => 1);
    ok(await until(async () => !(await inAudience(B)), 12000), 'Abbruch hält niemanden in der reduzierten Ansicht fest');
    ok(/Verbindung/.test(await toastText(B)), 'Meldung dazu', await toastText(B));
    await B.setOfflineMode(false);
    ok(await until(() => inAudience(B), 15000), 'Nach dem Wiederverbinden geht es weiter');

    console.log('--- Präsentierende Person geht');
    await A.goto('about:blank');
    ok(await until(async () => !(await inAudience(B)) && !(await inAudience(V)), 12000), 'Geht die präsentierende Person, endet es für alle');
    ok(!(await session(V)), 'Der Zustand ist auch in der Sitzung weg');
    await open(A, id, extra);
    await wait(300);
    ok(!(await inAudience(A)), 'Keine Reste nach der Rückkehr');
    return id;
  };

  const id1 = await presentation('(Server-Sent Events)', '');
  await presentation('(Long-Polling)', '?transport=poll');

  console.log('=== Rechte');
  await open(A, id1);
  await open(B, id1);
  await open(V, id1);
  const slide = { id: 'f0', i: 0, n: 3, x: 0, y: 0, w: 1000, h: 600 };
  ok((await clientOp(V, { op: 'presentation', action: 'start', slide })).status === 403, 'Betrachter dürfen nicht für alle präsentieren');
  await V.evaluate(() => document.getElementById('btn-present').click());
  await wait(250);
  ok(!(await V.evaluate(() => !!document.querySelector('.modal-back'))) && (await V.evaluate(() => document.body.classList.contains('presenting'))), 'Betrachter: keine Frage, nur für sich');
  await V.bringToFront();
  await V.keyboard.press('Escape');
  await wait(200);
  ok(!(await session(A)), 'Ohne Rolle entsteht keine Präsentation');
  await core(A, (c) => c.app.sync.op({ op: 'moderation', active: true }));
  await until(() => core(B, (c) => !!c.app.session.moderation));
  const res = await clientOp(B, { op: 'presentation', action: 'start', slide });
  await wait(200);
  ok(res.body?.blocked === 'reserved' && !(await session(A)), 'Werkzeuge vorbehalten: Der Server lehnt ab', res.body);
  await B.evaluate(() => document.getElementById('btn-present').click());
  await wait(250);
  ok(!(await B.evaluate(() => !!document.querySelector('.modal-back'))), 'Werkzeuge vorbehalten: keine Frage');
  await B.bringToFront();
  await B.keyboard.press('Escape');
  await wait(200);
  await core(A, (c) => c.app.sync.op({ op: 'moderation', active: false }));
  await until(() => core(B, (c) => !c.app.session.moderation));
  await present(B, 'Für alle');
  ok(await until(() => inAudience(V)), 'Bearbeitende dürfen für alle präsentieren');
  ok((await clientOp(A, { op: 'presentation', action: 'slide', slide: { ...slide, i: 2 } })).body?.session?.[0]?.presentation?.slide?.i === 0, 'Fremde Folienwechsel lehnt der Server ab');
  ok((await clientOp(A, { op: 'presentation', action: 'start', slide })).body?.blocked === 'presenting', 'Eine zweite Präsentation löst die laufende nicht ab');
  ok((await clientOp(V, { op: 'presentation', action: 'stop' })).status === 403, 'Betrachter beenden keine Präsentation');
  for (const bad of [{ ...slide, w: -1 }, { ...slide, x: 'a' }, { ...slide, i: 9 }, null]) await clientOp(B, { op: 'presentation', action: 'slide', slide: bad });
  ok((await session(V)).slide.w === 1000, 'Ungültige Folien übernimmt der Server nicht');
  ok(/Für alle beenden/.test(await barText(A)), 'Der Besitzer kann fremde Präsentationen beenden', await barText(A));
  await clickAt(A, '#audience-bar button', 'Für alle beenden');
  ok(await until(async () => !(await inAudience(V))), 'Das gilt für alle');
  ok(await until(() => B.evaluate(() => document.body.classList.contains('presenting'))), 'Die präsentierende Person behält ihre Folien');
  await B.bringToFront();
  await B.keyboard.press('Escape');
  await wait(200);

  console.log('=== Neustart des Servers');
  await present(A, 'Für alle');
  await until(() => inAudience(B));
  server('restart');
  await wait(4000);
  ok(await until(async () => core(A, (c) => c.app.sync.connected) && core(B, (c) => c.app.sync.connected), 15000), 'Alle verbinden sich wieder');
  await wait(7000);
  ok((await session(B))?.active && (await inAudience(B)), 'Die Präsentation übersteht den Neustart', await session(B));
  await A.bringToFront();
  await A.keyboard.press('Escape');
  ok(await until(async () => !(await inAudience(B))), 'und endet danach normal');
  await V.goto('about:blank');

  console.log('=== Formatieren beim Tippen');
  const fid = await board('Formate');
  await open(A, fid);
  await mk(A, 'sticky', 's1', { x: 300, y: 300, text: 'Hallo Welt' });
  await mk(A, 'sticky', 's2', { x: 600, y: 300, text: 'Zwei' });
  await mk(A, 'table', 't1', { x: 300, y: 600, w: 300, h: 120, rows: 3, cols: 3, cells: [['a', 'b', 'c'], ['d', 'e', 'f'], ['g', 'h', 'i']], styles: undefined });
  await wait(300);
  await open(B, fid);
  await core(B, (c) => {
    c.app.view.x = 0;
    c.app.view.y = 0;
    c.app.view.z = 1;
    c.applyView();
  });
  await core(A, (c) => {
    c.app.view.x = 0;
    c.app.view.y = 0;
    c.app.view.z = 1;
    c.applyView();
    c.setSelection(['s1']);
  });
  await A.bringToFront();
  await A.keyboard.press('Enter');
  await wait(200);
  const caret = () => A.evaluate(() => { const e = document.getElementById('editor'); return { a: e === document.activeElement, s: e.selectionStart, v: e.value, w: getComputedStyle(e).fontWeight, st: getComputedStyle(e).fontStyle, d: getComputedStyle(e).textDecorationLine, disp: e.style.display }; });
  await A.keyboard.press('ArrowLeft');
  await A.keyboard.press('ArrowLeft');
  const c0 = await caret();
  await A.keyboard.down('Control');
  await A.keyboard.press('b');
  await A.keyboard.up('Control');
  await wait(100);
  let c1 = await caret();
  ok((await el(A, 's1')).bold === true, 'Strg+B gilt für das ganze Element');
  ok(c1.w === '700' && c1.a && c1.s === c0.s, 'Editor zeigt es sofort, Einfügestelle bleibt', c1);
  ok(await until(async () => (await el(B, 's1')).bold === true), 'Die andere Person sieht es');
  await A.keyboard.down('Control');
  await A.keyboard.press('i');
  await A.keyboard.press('u');
  await A.keyboard.up('Control');
  await wait(100);
  c1 = await caret();
  ok(c1.st === 'italic' && /underline/.test(c1.d) && (await el(A, 's1')).underline === true, 'Strg+I und Strg+U ebenso', c1);
  await A.keyboard.down('Control');
  await A.keyboard.press('u');
  await A.keyboard.up('Control');
  await wait(100);
  ok(!(await el(A, 's1')).underline && !/underline/.test((await caret()).d), 'Zweimal schaltet wieder aus');
  const layout = await A.evaluate(() => {
    const q = document.getElementById('ctxbar').getBoundingClientRect(), r = document.getElementById('editor').getBoundingClientRect();
    return { vis: getComputedStyle(document.getElementById('ctxbar')).visibility, hid: document.getElementById('ctxbar').classList.contains('hidden'), apart: q.bottom <= r.top || q.top >= r.bottom || q.right <= r.left || q.left >= r.right };
  });
  ok(layout.vis === 'visible' && !layout.hid && layout.apart, 'Kontextleiste bleibt sichtbar und verdeckt den Editor nicht', layout);
  await clickAt(A, '#ctxbar button', 'Text');
  await wait(150);
  c1 = await caret();
  ok(c1.a && c1.s === c0.s && c1.disp === 'block', 'Klick in die Leiste nimmt dem Editor nicht den Fokus', c1);
  await clickAt(A, '#ctxbar button', 'Durchgestrichen');
  await wait(100);
  c1 = await caret();
  ok((await el(A, 's1')).strike === true && /line-through/.test(c1.d) && c1.a && c1.s === c0.s, 'Knopf wirkt sofort, Einfügestelle bleibt', c1);
  await clickAt(A, '#ctxbar button', 'Durchgestrichen');
  await wait(100);
  await clickAt(A, '#ctxbar button', 'Schriftgröße');
  await wait(200);
  await clickAt(A, '.popover .menu-item', '32');
  await wait(200);
  c1 = await caret();
  ok((await el(A, 's1')).fontSize === 32 && c1.a && c1.s === c0.s, 'Auch Menüs der Leiste behalten die Eingabe', c1);
  await clickAt(A, '#ctxbar button', 'Textfarbe');
  await wait(200);
  await A.evaluate(() => {});
  const swatch = await A.evaluate(() => {
    const q = document.querySelector('.popover button')?.getBoundingClientRect();
    return q && { x: q.left + q.width / 2, y: q.top + q.height / 2 };
  });
  await A.mouse.click(swatch.x, swatch.y);
  await wait(200);
  c1 = await caret();
  ok(c1.a && c1.s === c0.s && c1.disp === 'block', 'Farbwahl behält die Eingabe', c1);
  await A.keyboard.type('XY');
  await wait(150);
  ok((await caret()).v === 'Hallo WeXYlt', 'Weiterschreiben an derselben Stelle', (await caret()).v);
  ok(await until(async () => (await el(B, 's1')).text === 'Hallo WeXYlt'), 'Text kommt an');

  console.log('--- Gemeinsam tippen');
  await core(B, (c) => c.setSelection(['s1']));
  await B.bringToFront();
  await B.keyboard.press('Enter');
  await wait(200);
  await B.keyboard.down('Control');
  await B.keyboard.press('End');
  await B.keyboard.up('Control');
  await B.keyboard.type('!');
  await wait(300);
  await A.bringToFront();
  ok(await until(() => A.evaluate(() => !!document.querySelector('.text-caret'))), 'Fremder Cursor bleibt sichtbar');
  await A.keyboard.down('Control');
  await A.keyboard.press('i');
  await A.keyboard.up('Control');
  await A.keyboard.type('1');
  await B.bringToFront();
  await B.keyboard.type('2');
  await wait(600);
  const ta = (await el(A, 's1')).text, tb = (await el(B, 's1')).text;
  ok(ta === tb && ta === 'Hallo WeXY1lt!2', 'Formatieren stört das gemeinsame Tippen nicht', [ta, tb]);
  ok((await el(B, 's1')).italic === false && (await B.evaluate(() => getComputedStyle(document.getElementById('editor')).fontStyle)) === 'normal', 'Der Editor der anderen Person zeigt das Format auch', await el(B, 's1'));
  await B.keyboard.press('Escape');
  await A.bringToFront();
  await A.keyboard.press('Escape');
  await wait(250);
  const before = await el(A, 's1');
  ok(before.bold === true, 'Format bleibt nach dem Beenden');

  console.log('--- Auswahl und Tabelle');
  await core(A, (c) => c.setSelection(['s1', 's2']));
  await A.bringToFront();
  await wait(100);
  await A.keyboard.down('Control');
  await A.keyboard.press('i');
  await A.keyboard.up('Control');
  await wait(150);
  ok((await el(A, 's1')).italic === true && (await el(A, 's2')).italic === true, 'Außerhalb gilt das Kürzel für die Auswahl');
  await A.keyboard.down('Control');
  await A.keyboard.press('z');
  await A.keyboard.up('Control');
  await wait(150);
  ok(!(await el(A, 's2')).italic, 'Rückgängig nimmt es zurück');
  await core(A, (c) => {
    c.setSelection(['t1']);
    c.startEdit('t1', { cell: [1, 1], selectAll: false });
  });
  await wait(200);
  await A.keyboard.down('Control');
  await A.keyboard.press('b');
  await A.keyboard.up('Control');
  await wait(150);
  let t = await el(A, 't1');
  ok(t.styles?.[1]?.[1]?.b === true && !t.styles?.[1]?.[0]?.b, 'In der Zelle gilt das Kürzel für die Zelle', t.styles);
  c1 = await caret();
  ok(c1.w === '700' && c1.a, 'Zellen-Editor zeigt es sofort', c1);
  await A.keyboard.type('x');
  await A.keyboard.press('Escape');
  await wait(250);
  ok((await el(A, 't1')).cells[1][1] === 'ex', 'Zelleneingabe geht weiter', (await el(A, 't1')).cells);
  await core(A, (c) => {
    c.app.cellSel = null;
    c.setSelection(['t1']);
  });
  await A.keyboard.down('Control');
  await A.keyboard.press('i');
  await A.keyboard.up('Control');
  await wait(150);
  t = await el(A, 't1');
  ok(t.styles?.[2]?.[2]?.i === true && t.styles?.[0]?.[0]?.i === true, 'Ausgewählte Tabelle: gilt für die ganze Tabelle', t.styles);
  await core(A, (c) => c.setSelection(['s2']));
  await open(V, fid);
  await core(V, (c) => c.setSelection(['s2']));
  await V.bringToFront();
  await V.keyboard.down('Control');
  await V.keyboard.press('b');
  await V.keyboard.up('Control');
  await wait(200);
  ok(!(await el(V, 's2')).bold, 'Betrachter formatieren nichts');

  console.log('--- Ebenen');
  const z0 = await core(A, (c) => {
    c.setSelection(['s2']);
    return { z: c.getEl('s2').z, max: Math.max(...[...c.app.els.values()].map((e) => e.z || 0)) };
  });
  await A.bringToFront();
  await A.keyboard.down('Control');
  await A.keyboard.down('Shift');
  await A.keyboard.press('ArrowUp');
  await A.keyboard.up('Shift');
  await A.keyboard.up('Control');
  await wait(120);
  const z1 = (await el(A, 's2')).z;
  ok(z1 > z0.max, 'Strg+Umschalt+Pfeil hoch: ganz nach vorn', [z0, z1]);
  await A.keyboard.down('Control');
  await A.keyboard.down('Shift');
  await A.keyboard.press('ArrowDown');
  await A.keyboard.up('Shift');
  await A.keyboard.up('Control');
  await wait(120);
  ok((await el(A, 's2')).z < z0.z, 'Strg+Umschalt+Pfeil runter: ganz nach hinten', await el(A, 's2'));

  console.log('=== Hilfe');
  await A.evaluate(() => document.activeElement?.blur());
  await clickAt(A, '#btn-help');
  await wait(250);
  let txt = await A.evaluate(() => document.querySelector('.modal').textContent);
  ok(/Hilfe/.test(txt) && /Verbinden/.test(txt) && /Teilen/.test(txt) && /Präsentieren/.test(txt) && /Bewegen auf der Fläche/.test(txt), 'Knopf unten links öffnet die ersten Schritte', txt.slice(0, 200));
  await clickAt(A, '.help-tabs .btn', 'Kurzanleitung');
  await wait(150);
  ok(/Zusammenarbeiten/.test(await A.evaluate(() => document.querySelector('.modal').textContent)), 'Kurzanleitung');
  await clickAt(A, '.help-tabs .btn', 'Tastenkürzel');
  await wait(150);
  const heads = await A.evaluate(() => [...document.querySelectorAll('.shortcuts h4')].map((x) => x.textContent));
  ok(heads[0] === 'Häufig', 'Häufiges steht zuerst', heads);
  await A.focus('.help-search');
  await A.keyboard.type('kursiv');
  await wait(150);
  const rows = await A.evaluate(() => [...document.querySelectorAll('.shortcuts tr:not(.hidden)')].map((x) => x.textContent));
  ok(rows.length === 1 && /Strg\+B/.test(rows[0]), 'Suchfeld filtert die Kürzel', rows);
  await A.keyboard.type('xyz');
  await wait(100);
  ok(await A.evaluate(() => !document.querySelector('.help-body > p').classList.contains('hidden')), 'Ohne Treffer ein Hinweis');
  await A.keyboard.press('Escape');
  await wait(200);
  await A.evaluate(() => document.activeElement?.blur());
  await A.keyboard.press('?');
  await wait(250);
  ok(await A.evaluate(() => document.activeElement?.classList.contains('help-search')), 'Taste ? führt direkt zu den Kürzeln');
  await A.keyboard.press('Escape');
  await wait(200);
  await core(A, (c) => c.app.emit('openPalette'));
  await wait(250);
  await A.keyboard.type('Hilfe');
  await wait(250);
  const pal = await A.evaluate(() => [...document.querySelectorAll('.palette-item .palette-label')].map((x) => x.textContent));
  ok(pal.some((x) => x === 'Hilfe'), 'Befehlssuche findet „Hilfe“', pal.slice(0, 6));
  await A.keyboard.press('Escape');
  await wait(200);

  console.log('--- Tipp zum Bewegen');
  const G = await person('dora@example.org', 'Gewitter-Laterne-83', 'G');
  await api(A, 'POST', `/api/boards/${fid}/members`, { email: 'dora@example.org', role: 'editor' });
  await open(G, fid);
  await G.bringToFront();
  await G.mouse.move(640, 300);
  await G.keyboard.down('Control');
  await G.mouse.wheel({ deltaY: -100 });
  await G.keyboard.up('Control');
  await wait(200);
  ok(/Strg\+Mausrad zoomt/.test(await toastText(G)), 'Erstes Zoomen erklärt die Bewegung', await toastText(G));
  await G.evaluate(() => document.getElementById('toast').classList.remove('show'));
  await G.mouse.move(1100, 700);
  await G.keyboard.down('Control');
  await G.mouse.wheel({ deltaY: 100 });
  await G.keyboard.up('Control');
  await wait(200);
  ok(!/Strg\+Mausrad/.test(await toastText(G)), 'Der Tipp kommt nur einmal');

  console.log('Fehler:', errs.length ? errs.slice(0, 4) : 'keine');
  ok(!errs.length, 'Keine Fehler in den Seiten', errs.slice(0, 4));
  await b.close();
  console.log(f ? 'FAIL ' + f : 'ALLES OK');
  process.exit(f ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
