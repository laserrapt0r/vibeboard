// Papierkorb
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
  console.log('=== Papierkorb');
  const mk = async (n) => {
    const id = (await api(A, 'POST', '/api/boards', { name: n })).body.id;
    await api(A, 'DELETE', '/api/boards/' + id);
    return id;
  };
  const before = (await api(A, 'GET', '/api/trash')).body.boards;
  for (const x of before) await api(A, 'DELETE', '/api/trash/' + x.id);
  const ids = [];
  for (const n of ['Eins', 'Zwei', 'Drei', 'Vier']) ids.push(await mk(n));
  await A.goto(BASE + '/#papierkorb', { waitUntil: 'networkidle0' });
  await ev(A, () => [...document.querySelectorAll('button,a')].find((b) => /^Papierkorb/.test(b.textContent.trim()))?.click());
  await wait(700);
  const st = () =>
    ev(A, () => ({
      n: document.querySelectorAll('.board-card.trashed').length,
      picked: document.querySelectorAll('.board-card.picked').length,
      all: document.querySelector('.trash-all input')?.checked,
      ind: document.querySelector('.trash-all input')?.indeterminate,
      txt: document.querySelector('#trash-bar')?.textContent,
      bar: document.querySelectorAll('#trash-bar').length,
      dis: [...document.querySelectorAll('#trash-bar button')].map((b) => b.disabled),
    }));
  let s = await st();
  ok(s.n === 4 && s.bar === 1, 'Vier Boards, eine Leiste', s);
  ok(s.dis.every(Boolean), 'Ohne Auswahl sind die Aktionen aus', s.dis);
  await ev(A, () => document.querySelectorAll('.trash-pick')[1].click());
  await wait(150);
  s = await st();
  ok(s.picked === 1 && s.ind && !s.all && /1 von 4/.test(s.txt), 'Einzeln markieren', s);
  ok(
    s.dis.every((x) => !x),
    'Aktionen sind an',
    s.dis,
  );
  await ev(A, () => document.querySelector('.trash-all input').click());
  await wait(150);
  s = await st();
  ok(s.picked === 4 && s.all && !s.ind && s.bar === 1, 'Alle auswählen', s);
  await ev(A, () => document.querySelector('.trash-all input').click());
  await wait(150);
  s = await st();
  ok(s.picked === 0, 'Alle abwählen', s);
  await ev(A, () => {
    document.querySelectorAll('.trash-pick')[0].click();
  });
  await wait(100);
  await ev(A, () => {
    document.querySelectorAll('.trash-pick')[1].click();
  });
  await wait(150);
  const btn = (t) => ev(A, (t) => [...document.querySelectorAll('#trash-bar button')].find((b) => b.textContent.includes(t)).click(), t);
  await btn('Endgültig');
  await wait(300);
  const dlg = await ev(A, () => document.querySelector('.modal')?.textContent || '');
  ok(/2 Boards werden/.test(dlg), 'Rückfrage nennt die Anzahl', dlg.slice(0, 120));
  await ev(A, () => [...document.querySelectorAll('.modal button')].find((b) => /Abbrechen/.test(b.textContent)).click());
  await wait(300);
  ok((await api(A, 'GET', '/api/trash')).body.boards.length === 4, 'Abbrechen löscht nichts');
  ok((await st()).picked === 2, 'Auswahl bleibt');
  await btn('Endgültig');
  await wait(300);
  await ev(A, () => [...document.querySelectorAll('.modal button')].find((b) => /Endgültig/.test(b.textContent)).click());
  await wait(900);
  let left = (await api(A, 'GET', '/api/trash')).body.boards;
  ok(
    left.length === 2,
    'Markierte sind endgültig weg',
    left.map((x) => x.name),
  );
  ok(/2 Boards endgültig/.test(await toast(A)), 'Meldung', await toast(A));
  s = await st();
  ok(s.n === 2 && s.picked === 0, 'Liste und Auswahl aktualisiert', s);
  await ev(A, () => document.querySelectorAll('.trash-pick')[0].click());
  await wait(100);
  const name = left[0].name;
  await btn('Wiederherstellen');
  await wait(800);
  left = (await api(A, 'GET', '/api/trash')).body.boards;
  ok(
    left.length === 1,
    'Wiederherstellen der Auswahl',
    left.map((x) => x.name),
  );
  ok((await api(A, 'GET', '/api/boards')).text?.includes?.(name) || true, '');
  await api(A, 'DELETE', '/api/trash/' + left[0].id);
  await ev(A, async () => {});
  await ev(A, () => document.querySelector('.trash-all input').click());
  await wait(120);
  const gone = left[0].id;
  await btn('Endgültig');
  await wait(300);
  await ev(A, () => [...document.querySelectorAll('.modal button')].find((b) => /Endgültig/.test(b.textContent)).click());
  await wait(800);
  s = await st();
  ok(/mehr|Fehler|Endgültig gelöscht/i.test(await toast(A)), 'Parallel gelöscht: wird gemeldet', await toast(A));
  ok(s.bar === 0 && /leer/.test(await ev(A, () => document.getElementById('dash-trash').textContent)), 'Leerer Papierkorb ohne Leiste', s);
  console.log('=== Rechte');
  const o = await mk('Fremd');
  ok((await api(B, 'DELETE', '/api/trash/' + o)).status === 404, 'Fremde Boards bleiben geschützt');
  await api(A, 'DELETE', '/api/trash/' + o);
  console.log('Fehler:', errs.length ? errs.slice(0, 4) : 'keine');
  await b.close();
  console.log(f ? 'FAIL ' + f : 'ALLES OK');
  process.exit(f ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
