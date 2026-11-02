// Gaststufe „Beiträge“ (mit Angriffen direkt auf /ops), Prüfungen in „Meine Aufgaben“, Runden einer Prüfung
const crypto = require('crypto');
const { launch, BASE, server } = require('./lib');
let f = 0;
const ok = (c, m, x) => {
  console.log((c ? 'ok  ' : 'FAIL') + ' ' + m + (c || x === undefined ? '' : ' → ' + JSON.stringify(x).slice(0, 300)));
  if (!c) f++;
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const api = (p, m, u, b) => p.evaluate(async (m, u, b) => {
  const r = await fetch(u, { method: m, headers: { 'Content-Type': 'application/json', 'X-Vibeboard': '1' }, body: b ? JSON.stringify(b) : undefined });
  let j = null;
  try {
    j = await r.json();
  } catch {}
  return { status: r.status, body: j };
}, m, u, b);
const login = async (p, e, pw) => {
  await p.goto(BASE + '/login', { waitUntil: 'networkidle0' });
  if ((await api(p, 'POST', '/api/auth/login', { login: e, password: pw })).status >= 300) throw new Error('login ' + e);
};
const PW = 'Gewitter-Laterne-83';
const toast = (p) => p.evaluate(() => {
  const t = document.getElementById('toast');
  return t && t.classList.contains('show') ? t.textContent : '';
});
const cid = () => 'probe' + Math.random().toString(36).slice(2, 14);
// Eigene Verbindung wie der Browser, aber mit frei gewählten Operationen
const connect = async (p, id) => {
  const client = cid();
  const r = await api(p, 'GET', `/api/boards/${id}/events?client=${client}&transport=poll`);
  const hello = r.body.messages[0];
  return { hello, ops: (ops) => api(p, 'POST', `/api/boards/${id}/ops`, { clientId: client, ops }), poll: () => api(p, 'GET', `/api/boards/${id}/poll?client=${client}`) };
};
// Kennung wie im Browser (uid in public/js/util.js): Ohne Bearbeitungsrecht gibt es nur eigene
const makeId = (key) => {
  const r = crypto.randomBytes(9).toString('base64url');
  return `g${r}${crypto.createHash('sha256').update(`${key}:${r}`).digest('hex').slice(0, 16)}`;
};
const center = (p, id) => p.evaluate((id) => {
  const r = document.querySelector(`g[data-id="${id}"]`)?.getBoundingClientRect();
  return r ? { x: r.x + r.width / 2, y: r.y + r.height / 2 } : null;
}, id);
const local = (p, id) => p.evaluate(async (id) => {
  const c = await import('/js/core.js');
  return JSON.parse(JSON.stringify(c.getEl(id) || null));
}, id);
const newest = (p) => p.evaluate(async () => {
  const c = await import('/js/core.js');
  return [...c.app.mine].at(-1) || null;
});
const drag = async (p, from, to) => {
  await p.mouse.move(from.x, from.y);
  await p.mouse.down();
  await p.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 4 });
  await p.mouse.move(to.x, to.y, { steps: 4 });
  await p.mouse.up();
};
const joinGuest = async (b, token, name) => {
  const c = await b.createBrowserContext();
  const G = await c.newPage();
  await G.goto(BASE + '/login', { waitUntil: 'load' });
  const r = await api(G, 'POST', '/api/guest/join', { token, name, consent: true });
  if (r.status !== 200) throw new Error('Beitritt: ' + JSON.stringify(r));
  return G;
};

(async () => {
  const b = await launch();
  const errs = [];
  const A = await b.newPage();
  await login(A, 'admin@test.example', 'Rotkehlchen-Wolke-47');
  A.on('pageerror', (e) => errs.push('A ' + e.message));
  const reviewer = await (await b.createBrowserContext()).newPage();
  await login(reviewer, 'anna@example.org', PW);
  reviewer.on('pageerror', (e) => errs.push('Anna ' + e.message));
  const annaId = (await api(reviewer, 'GET', '/api/auth/me')).body.user.id;
  const ben = await (await b.createBrowserContext()).newPage();
  await login(ben, 'ben@example.org', PW);
  const benId = (await api(ben, 'GET', '/api/auth/me')).body.user.id;
  const meA = (await api(A, 'GET', '/api/auth/me')).body.user.id;
  const settings = (collab) => api(A, 'PUT', '/api/admin/settings', { security: { requireVirusScan: false }, collab: { guestLinks: true, ...collab } });

  console.log('=== Abschaltbar');
  await settings({ guestContributions: false, guestNoteLimit: 5 });
  const id = (await api(A, 'POST', '/api/boards', { name: 'Workshop', elements: [
    { id: 'fremd1', type: 'sticky', x: 500, y: 200, w: 200, h: 200, text: 'Fremde Notiz', fill: '#fff9b1', z: 1, author: 'Admin' },
    { id: 'tab1', type: 'table', x: 800, y: 0, w: 300, h: 100, rows: 1, cols: 1, cells: [['a']], z: 2 },
    { id: 'karte1', type: 'card', x: 800, y: 200, w: 300, h: 140, title: 'Karte', z: 3 },
    { id: 'rahmen1', type: 'frame', x: 1200, y: 0, w: 400, h: 300, title: 'Frame', z: 4 },
  ] })).body.id;
  let r = await api(A, 'POST', `/api/boards/${id}/guest-links`, { role: 'contributor', days: 1 });
  ok(r.status === 403, 'Abgeschaltet: Keine Gastlinks mit der Stufe', r.status);
  ok((await api(A, 'GET', `/api/boards/${id}`)).body.features.guestContributions === false, 'Standard bleibt aus');
  await A.goto(`${BASE}/board/${id}`, { waitUntil: 'load' });
  await wait(1200);
  await A.evaluate(() => document.querySelector('.share-btn').click());
  await A.waitForSelector('.guest-links', { timeout: 5000 });
  ok(!(await A.evaluate(() => [...document.querySelectorAll('.share-block select option')].some((o) => o.value === 'contributor'))), 'Abgeschaltet: Der Teilen-Dialog bietet die Stufe nicht an');
  await A.evaluate(() => document.querySelector('.modal-back .modal-close, .modal-back [aria-label]')?.click());
  await settings({ guestContributions: true, guestNoteLimit: 5 });

  console.log('=== Teilen und Beitritt');
  await A.reload({ waitUntil: 'load' });
  await wait(1200);
  await A.evaluate(() => document.querySelector('.share-btn').click());
  await A.waitForSelector('.guest-contrib-hint', { timeout: 5000 });
  ok(/nur diese/.test(await A.$eval('.guest-contrib-hint', (e) => e.textContent)), 'Der Dialog erklärt die Stufe in einem Satz');
  const token = await A.evaluate(async () => {
    const box = [...document.querySelectorAll('.share-block')].find((x) => x.querySelector('.guest-links'));
    const sel = box.querySelector('select');
    sel.value = 'contributor';
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    [...box.querySelectorAll('button')].find((x) => /Gastlink erstellen/.test(x.textContent)).click();
    for (let i = 0; i < 50 && !box.querySelector('.hint input'); i++) await new Promise((r) => setTimeout(r, 100));
    return box.querySelector('.hint input').value.split('/g/')[1];
  });
  ok(/darf Notizen beitragen/.test(await A.evaluate(() => document.querySelector('.guest-links').textContent)), 'Die Liste nennt die Stufe');
  await A.keyboard.press('Escape');
  const gc = await b.createBrowserContext();
  const G = await gc.newPage();
  G.on('pageerror', (e) => errs.push('Gast ' + e.message));
  await G.goto(`${BASE}/g/${token}`, { waitUntil: 'networkidle0' });
  const text = await G.$eval('#guest', (e) => e.textContent);
  ok(/bis zu 5 eigene Notizen/.test(text) && /Andere Inhalte bleiben unverändert/.test(text), 'Beitrittsseite sagt, was geht', text.slice(0, 300));
  await G.type('input[type=text]', 'Gerda');
  await G.click('input[type=checkbox]');
  await Promise.all([G.waitForNavigation({ waitUntil: 'load' }), G.keyboard.press('Enter')]);
  await G.waitForSelector('g[data-id="fremd1"]', { timeout: 8000 });
  await wait(800);

  console.log('=== Werkzeuge');
  const tools = await G.evaluate(() => [...document.querySelectorAll('[data-tool]')].map((x) => x.dataset.tool).filter((t) => t));
  ok(['select', 'hand', 'sticky', 'comment', 'laser'].every((t) => tools.includes(t)) && !['frame', 'shape', 'text', 'connector', 'pen', 'card', 'table', 'image', 'template', 'mindmap'].some((t) => tools.includes(t)), 'Nur Werkzeuge, die gehen', tools);
  ok(!(await G.evaluate(() => !!document.querySelector('.share-btn'))), 'Kein Teilen');
  ok(await G.evaluate(() => [...document.querySelectorAll('.badge')].some((x) => /Beiträge/.test(x.textContent))), 'Kennzeichen „Beiträge“');
  ok(await G.evaluate(() => !!document.querySelector('#btn-undo')), 'Rückgängig steht bereit');

  console.log('=== Eigene Notiz mit Maus und Tastatur');
  await G.mouse.move(300, 300);
  await G.keyboard.press('n');
  await G.mouse.click(300, 300);
  await wait(400);
  await G.keyboard.type('Meine Idee');
  await G.keyboard.press('Escape');
  await wait(900);
  const mine = await newest(G);
  ok(!!mine, 'Notiz liegt auf dem Board', mine);
  let seen = await local(A, mine);
  ok(seen?.text === 'Meine Idee', 'Andere sehen die Notiz', seen);
  ok(/Gerda \(Gast\)/.test(seen?.author || ''), 'Autor ist der Gast', seen?.author);
  ok(seen && !('ownerId' in seen), 'Eigentum steht nicht am Element', seen);
  await G.mouse.click(300, 300);
  await wait(300);
  const bar = await G.evaluate(() => [...document.querySelectorAll('#ctxbar button')].map((x) => x.title));
  ok(bar.some((t) => /Löschen/.test(t)) && !bar.some((t) => /Sperren|Mehr|Link/.test(t)), 'Leiste zeigt nur, was geht', bar);
  const p0 = await center(G, mine);
  await drag(G, p0, { x: p0.x + 120, y: p0.y + 40 });
  await wait(800);
  const moved = await local(A, mine);
  ok(moved.x !== seen.x && moved.y !== seen.y, 'Verschieben kommt an', moved);
  const p1 = await center(G, mine);
  await G.mouse.click(p1.x, p1.y, { count: 2 });
  await wait(400);
  await G.keyboard.down('Control');
  await G.keyboard.press('a');
  await G.keyboard.up('Control');
  await G.keyboard.type('Neuer Text');
  await G.keyboard.press('Escape');
  await wait(900);
  ok((await local(A, mine)).text === 'Neuer Text', 'Text über gemeinsames Tippen geändert', await local(A, mine));
  await G.mouse.click(p1.x, p1.y);
  await wait(200);
  await G.keyboard.press('ArrowRight');
  await wait(800);
  ok((await local(A, mine)).x !== moved.x, 'Pfeiltaste verschiebt die eigene Notiz');
  await G.keyboard.press('Delete');
  await wait(800);
  ok(!(await local(A, mine)), 'Entf löscht die eigene Notiz');
  await G.keyboard.down('Control');
  await G.keyboard.press('z');
  await G.keyboard.up('Control');
  await wait(900);
  seen = await local(A, mine);
  ok(seen?.text === 'Neuer Text' && /Gerda/.test(seen.author), 'Rückgängig holt sie samt Autor zurück', seen);
  await G.evaluate(() => document.activeElement?.blur());
  await G.keyboard.press('Escape');
  await wait(200);
  await G.evaluate(() => { document.activeElement?.blur(); });
  const pm = await center(G, mine);
  await G.mouse.click(pm.x, pm.y);
  await wait(300);
  const st = await center(G, 'fremd1');
  await G.mouse.click(st.x, st.y);
  await wait(200);
  ok(await G.evaluate(async () => (await import('/js/core.js')).app.sel.size === 0), 'Klick auf Fremdes wählt nichts aus und hebt die Auswahl auf');
  await drag(G, st, { x: st.x + 100, y: st.y + 100 });
  await wait(600);
  ok((await local(A, 'fremd1')).x === 500, 'Fremde Notiz lässt sich nicht ziehen');
  const st2 = await center(G, 'fremd1'); // Ziehen auf Fremdem verschiebt die Ansicht
  await G.mouse.click(st2.x, st2.y, { count: 2 });
  await wait(300);
  ok(/eigene Notizen/.test(await toast(G)), 'Doppelklick auf Fremdes erklärt die Stufe', await toast(G));
  ok(!(await G.evaluate(async () => !!(await import('/js/core.js')).app.editing)), 'Fremdes öffnet keinen Editor');
  await G.keyboard.down('Control');
  await G.keyboard.press('a');
  await G.keyboard.up('Control');
  await wait(200);
  ok(await G.evaluate(async (m) => { const c = await import('/js/core.js'); return c.app.sel.size === 1 && c.app.sel.has(m); }, mine), 'Strg+A wählt nur Eigenes');
  await G.keyboard.press('Escape');

  console.log('=== Kommentieren und Abstimmen');
  const gs = await connect(G, id);
  // Kennungen des Gastes: je Name eine, damit die Prüfungen unten lesbar bleiben
  const named = {};
  const own = (name) => (named[name] = named[name] || makeId(gs.hello.idKey));
  ok(/^[0-9a-f]{64}$/.test(gs.hello.idKey || ''), 'Der Gast bekommt seinen Schlüssel für Kennungen', gs.hello.idKey);
  ok(/^g[\w-]{12}[0-9a-f]{16}$/.test(mine), 'Die Oberfläche vergibt solche Kennungen', mine);
  ok(gs.hello.mine.includes(mine), 'Der Server nennt die eigenen Notizen', gs.hello.mine);
  r = await gs.ops([{ op: 'comment', action: 'add', id: own('gastkommentar'), x: 10, y: 10, text: 'Hallo vom Gast' }]);
  ok(r.status === 200 && !!(await local(A, own('gastkommentar'))), 'Kommentieren geht', r);
  r = await gs.ops([{ op: 'comment', action: 'add', id: own('gastkommentar'), text: 'Noch ein Satz' }]);
  ok((await local(A, own('gastkommentar')))?.thread?.length === 2, 'Antworten geht');
  let as = await connect(A, id);
  await as.ops([{ op: 'comment', action: 'add', id: 'teamkommentar', x: 20, y: 20, text: 'Vom Team' }]);
  r = await gs.ops([{ op: 'comment', action: 'resolve', id: 'teamkommentar', resolved: true }]);
  ok(r.body?.error && !(await local(A, 'teamkommentar'))?.resolved, 'Fremden Kommentar erledigen geht nicht', r.body);
  r = await gs.ops([{ op: 'comment', action: 'task', id: 'teamkommentar', assigneeId: String(meA) }]);
  ok(r.body?.error && !(await local(A, 'teamkommentar'))?.task, 'Zuweisen geht nicht', r.body);
  r = await gs.ops([{ op: 'comment', action: 'delete', id: 'teamkommentar' }]);
  ok(r.body?.error && !!(await local(A, 'teamkommentar')), 'Fremden Kommentar löschen geht nicht', r.body);
  await as.ops([{ op: 'voting', voting: { active: true, startedAt: 1, votesPerUser: 3, target: 'all' } }]);
  await gs.ops([{ op: 'vote', elId: 'fremd1', delta: 1 }]);
  let state = await connect(A, id);
  ok(Object.keys(state.hello.board.session.voting?.votes?.fremd1 || {}).length === 1, 'Abstimmen geht, auch auf Fremdes', state.hello.board.session.voting);
  await as.ops([{ op: 'voting', voting: null }]);

  console.log('=== Eingabeschritte nur für eigene Notizen');
  await as.ops([{ op: 'ttext', id: 'fremd1', field: 'text', ops: [{ p: 0, i: 'Wieder gelöscht ' }], base: as.hello.seq, opId: 'schritt1' }, { op: 'ttext', id: mine, field: 'text', ops: [{ p: 0, i: 'Team: ' }], base: as.hello.seq, opId: 'schritt2' }]);
  await wait(200);
  await (await connect(A, id)).ops([{ op: 'ttext', id: 'fremd1', field: 'text', ops: [{ p: 0, d: 16 }], base: (await connect(A, id)).hello.seq, opId: 'schritt3' }]);
  await wait(200);
  await gs.poll();
  await gs.ops([{ op: 'tsync', id: 'fremd1', field: 'text', base: gs.hello.seq }, { op: 'tsync', id: mine, field: 'text', base: gs.hello.seq }]);
  const answers = (await gs.poll()).body.messages.filter((m) => m.type === 'tsync');
  const foreignAnswer = answers.find((m) => m.key.includes('fremd1')), ownAnswer = answers.find((m) => m.key.includes(mine));
  ok(foreignAnswer?.text === 'Fremde Notiz' && !foreignAnswer.entries && !JSON.stringify(answers).includes('Wieder gelöscht'), 'Fremde Notiz: nur der Text, keine Schritte', answers);
  ok(ownAnswer?.entries?.length > 0, 'Eigene Notiz: Schritte wie bisher', answers);

  console.log('=== Zuständig ist nur, wer erledigen darf');
  const guestUser = String(gs.hello.me.userId);
  const people = async (q) => (await api(A, 'GET', `/api/boards/${id}/people${q}`)).body.people.map((p) => p.id);
  ok((await people('')).includes(guestUser), 'Erwähnen geht weiter');
  ok(!(await people('?assignable=1')).includes(guestUser) && (await people('?assignable=1')).includes(String(meA)), 'Nicht als zuständig wählbar', await people('?assignable=1'));
  r = await as.ops([{ op: 'comment', action: 'task', id: 'teamkommentar', assigneeId: guestUser }]);
  ok(/erledigen/.test(r.body?.error || '') && !(await local(A, 'teamkommentar'))?.task, 'Auch der Server lehnt ab', r.body);

  console.log('=== Angriffe über POST /ops');
  const snap = async () => (await connect(A, id)).hello.board;
  const before = await snap();
  const same = (now, ids) => ids.every((x) => JSON.stringify(now.elements[x]) === JSON.stringify(before.elements[x]));
  const foreign = ['fremd1', 'tab1', 'karte1', 'rahmen1'];
  const attacks = {
    'upsert auf fremde Notiz': [{ op: 'upsert', el: { ...before.elements.fremd1, text: 'übernommen' } }],
    'upsert fremde Notiz mit ownerId': [{ op: 'upsert', el: { ...before.elements.fremd1, text: 'übernommen', ownerId: String(gs.hello.me.userId) } }],
    'patch fremd': [{ op: 'patch', id: 'fremd1', set: { x: 9, text: 'x' } }],
    'patch fremd, ownerId': [{ op: 'patch', id: 'fremd1', set: { ownerId: gs.hello.me.userId } }],
    'patch Frame': [{ op: 'patch', id: 'rahmen1', set: { title: 'x' } }],
    'patch Karte': [{ op: 'patch', id: 'karte1', set: { title: 'x' } }],
    'ttext fremd': [{ op: 'ttext', id: 'fremd1', field: 'text', ops: [{ p: 0, i: 'x' }], base: gs.hello.seq, opId: 'a1' }],
    'ttext Frame-Titel': [{ op: 'ttext', id: 'rahmen1', field: 'title', ops: [{ p: 0, i: 'x' }], base: gs.hello.seq, opId: 'a2' }],
    'ttext Zelle': [{ op: 'ttext', id: 'tab1', cell: [0, 0], ops: [{ p: 0, i: 'x' }], base: gs.hello.seq, opId: 'a3' }],
    'delete fremd': [{ op: 'delete', id: 'fremd1' }],
    'delete Tabelle': [{ op: 'delete', id: 'tab1' }],
    'tpatch': [{ op: 'tpatch', id: 'tab1', cells: [[0, 0, 'x']] }],
    'tstruct': [{ op: 'tstruct', id: 'tab1', action: 'insertRows', at: 0, count: 1 }],
  };
  for (const [name, ops] of Object.entries(attacks)) {
    r = await gs.ops(ops);
    ok(r.status === 200 || r.status === 403, `${name}: Antwort`, r);
    ok(same(await snap(), foreign), `${name}: nichts geändert`, r.body);
    ok(r.body?.blocked === 'contributor', `${name}: abgelehnt`, r.body);
  }
  await as.ops([{ op: 'privateMode', active: true }, { op: 'upsert', el: { id: 'geheimes', type: 'sticky', x: 0, y: 3000, w: 100, h: 100, text: 'x', z: 2 } }, { op: 'patch', id: 'geheimes', set: { text: 'Privat' } }]);
  r = await gs.ops([{ op: 'delete', id: 'geheimes' }]);
  ok(r.body?.blocked === 'contributor' && !!(await snap()).elements.geheimes, 'Fremde private Notiz: Die Ablehnung erreicht den Browser', r.body);
  await as.ops([{ op: 'delete', id: 'geheimes' }, { op: 'privateMode', active: false }]);
  await wait(200);
  const noteId = (n) => 'angriff' + n;
  const kinds = { shape: { shape: 'rect' }, text: { text: 'x' }, card: { title: 'x' }, frame: { title: 'x' }, table: { rows: 1, cols: 1, cells: [['x']] }, code: { text: 'x' }, connector: { from: { x: 0, y: 0 }, to: { x: 1, y: 1 } }, pen: { points: [[0, 0], [1, 1]] }, image: { src: 'data:image/png;base64,iVBORw0KGgo=' }, file: { name: 'a.pdf' }, emoji: { text: '😀' } };
  for (const [type, extra] of Object.entries(kinds)) {
    await gs.ops([{ op: 'upsert', el: { id: noteId(type), type, x: 0, y: 900, w: 50, h: 50, z: 50, ...extra } }]);
  }
  let now = await snap();
  ok(!Object.keys(now.elements).some((x) => x.startsWith('angriff')), 'Keine anderen Elementarten', Object.keys(now.elements));
  const session = JSON.stringify(now.session);
  const sessionOps = {
    rename: { op: 'rename', name: 'Gekapert' },
    moderation: { op: 'moderation', active: true, editLock: true },
    privateMode: { op: 'privateMode', active: true },
    timer: { op: 'timer', timer: { running: true, endAt: 1 } },
    voting: { op: 'voting', voting: { active: true, startedAt: 2 } },
    estimation: { op: 'estimation', action: 'start', elId: 'karte1' },
    presentation: { op: 'presentation', action: 'start', slide: { id: null, i: 0, n: 1, x: 0, y: 0, w: 10, h: 10 } },
    retro: { op: 'retro', action: 'start' },
    unbekannt: { op: 'irgendetwas', id: 'fremd1' },
    poll: { op: 'poll', action: 'start', question: 'x', options: ['a', 'b'] },
    discussion: { op: 'discussion', action: 'start' },
    pick: { op: 'randomPick', names: ['x'] },
  };
  for (const [name, op] of Object.entries(sessionOps)) {
    r = await gs.ops([op]);
    now = await snap();
    ok(r.body?.blocked === 'contributor', `${name}: abgelehnt`, r.body);
    ok(JSON.stringify(now.session) === session && now.name === before.name, `${name}: Sitzung unverändert`, now.session);
  }
  r = await connect(G, id);
  const E1 = own('eigen1');
  await r.ops([{ op: 'upsert', el: { id: E1, type: 'sticky', x: 0, y: 500, w: 200, h: 200, text: 'gut', z: 60, ownerId: '1', author: 'Admin', locked: true, modLock: true, link: 'https://example.org', groupId: 'g1', anon: true, priv: '1', concealed: true, reactions: { '👍': { 1: 'Admin' } }, tags: ['a'], ext: { c: 'x' }, huge: 'x'.repeat(5000), src: 'x' } }]);
  now = await snap();
  const e1 = now.elements[E1];
  ok(!!e1 && /Gerda/.test(e1.author), 'Der Name kommt vom Server', e1);
  await r.ops([{ op: 'patch', id: E1, set: { fontSize: 200000 } }]);
  ok((await snap()).elements[E1].fontSize === 128, 'Schriftgröße begrenzt', (await snap()).elements[E1].fontSize);
  await r.ops([{ op: 'patch', id: E1, set: { fontSize: 1e300 } }]);
  ok((await snap()).elements[E1].fontSize === 128, 'Auch bei 1e300', (await snap()).elements[E1].fontSize);
  await r.ops([{ op: 'patch', id: E1, set: { fontSize: -5 } }]);
  ok((await snap()).elements[E1].fontSize === 1, 'Nach unten ebenso', (await snap()).elements[E1].fontSize);
  await r.ops([{ op: 'patch', id: E1, set: { fontSize: 16 } }]);
  // Ältere Boards können solche Werte enthalten
  const huge = await G.evaluate(async () => {
    const { textLayout, safeEl } = await import('/js/render.js');
    const text = 'Wort '.repeat(800);
    const t0 = performance.now();
    const sizes = [1e300, 200000, 'Infinity', -3].map((fontSize) => textLayout({ type: 'sticky', fontSize, text }, { x: 0, y: 0, w: 180, h: 180 }).size);
    return { sizes, ms: performance.now() - t0, safe: safeEl({ type: 'sticky', fontSize: 1e300 }).fontSize };
  });
  ok(huge.sizes.every((s) => s >= 1 && s <= 128) && huge.safe === 128 && huge.ms < 500, 'Darstellung fängt Ausreißer ab', huge);
  ok(e1 && !['ownerId', 'locked', 'modLock', 'link', 'groupId', 'anon', 'priv', 'concealed', 'reactions', 'tags', 'ext', 'huge', 'src'].some((k) => k in e1), 'Fremde Felder werden nicht übernommen', e1);
  await r.ops([{ op: 'patch', id: E1, set: { type: 'image', src: 'data:image/png;base64,iVBORw0KGgo=' } }]);
  await r.ops([{ op: 'patch', id: E1, set: { locked: true, link: 'https://example.org', author: 'Admin', bold: { a: 'x'.repeat(100) }, align: 'x' } }]);
  now = await snap();
  ok(now.elements[E1].type === 'sticky' && !now.elements[E1].src && !now.elements[E1].locked && !now.elements[E1].link && /Gerda/.test(now.elements[E1].author) && now.elements[E1].bold === true && !now.elements[E1].align, 'Auch eigene Notizen bleiben Notizen', now.elements[E1]);
  await r.ops([{ op: 'patch', id: E1, set: { text: 'y'.repeat(5001) } }]);
  ok((await snap()).elements[E1].text === 'gut', 'Textgrenze', (await snap()).elements[E1].text.length);
  r = await r.ops([{ op: 'patch', id: E1, set: { w: 1e7 } }]);
  ok(r.body?.blocked === 'noteSize', 'Größengrenze', r.body);

  console.log('=== Gesperrtes, Verborgenes, gelöschte Kennungen');
  const gx = await connect(G, id);
  await as.ops([{ op: 'patch', id: E1, set: { locked: true } }]);
  await gx.ops([{ op: 'patch', id: E1, set: { text: 'trotzdem' } }]);
  await gx.ops([{ op: 'delete', id: E1 }]);
  now = await snap();
  ok(now.elements[E1]?.text === 'gut', 'Vom Team gesperrt: Auch die eigene Notiz bleibt', now.elements[E1]);
  await as.ops([{ op: 'patch', id: E1, set: {}, unset: ['locked'] }]);
  await as.ops([{ op: 'upsert', el: { id: 'versteck', type: 'frame', x: 3000, y: 0, w: 500, h: 500, title: 'Geheim', concealed: true, z: 70 } }]);
  r = await gx.ops([{ op: 'patch', id: E1, set: { x: 3100, y: 100 } }]);
  ok(r.body?.blocked === 'concealed', 'Nicht in verborgene Bereiche', r.body);
  const trick = own('trick');
  r = await gx.ops([{ op: 'upsert', el: { id: trick, type: 'sticky', x: 3100, y: 100, w: 1e7, h: 1e7, text: 'x', z: 1 } }]);
  ok(!(await snap()).elements[trick], 'Auch nicht über eine Riesengröße', r.body);
  await as.ops([{ op: 'delete', id: 'versteck' }]);
  await as.ops([{ op: 'upsert', el: { id: 'gelöscht'.replace('ö', 'oe'), type: 'sticky', x: 0, y: 0, w: 100, h: 100, text: 'von Admin', author: 'x', z: 80 } }]);
  await as.ops([{ op: 'delete', id: 'geloescht' }]);
  r = await gx.ops([{ op: 'upsert', el: { id: 'geloescht', type: 'sticky', x: 0, y: 0, w: 100, h: 100, text: 'untergeschoben', z: 80 } }]);
  ok(!(await snap()).elements.geloescht && r.body?.blocked === 'contributor', 'Kennung einer fremden gelöschten Notiz bringt keine fremde Autorschaft', r.body);
  // Bezüge bleiben stehen, wenn das Ziel gelöscht wird
  await as.ops([{ op: 'upsert', el: { id: 'bezug', type: 'sticky', x: 2000, y: 2000, w: 100, h: 100, text: 'Ziel', z: 81 } }, { op: 'upsert', el: { id: 'kante', type: 'connector', x: 0, y: 0, w: 0, h: 0, z: 82, from: { id: 'bezug' }, to: { x: 0, y: 0 } } }]);
  await as.ops([{ op: 'comment', action: 'add', id: 'angeheftet', x: 2000, y: 2000, text: 'Am Ziel', anchor: { id: 'bezug', rx: 0.5, ry: 0.5 } }]);
  await as.ops([{ op: 'delete', id: 'bezug' }]);
  const bezugTried = [await gx.ops([{ op: 'upsert', el: { id: 'bezug', type: 'sticky', x: 2000, y: 2000, w: 100, h: 100, text: 'Gast', z: 83 } }]), await gx.ops([{ op: 'comment', action: 'add', id: 'bezug', x: 2000, y: 2000, text: 'Gast' }])];
  ok(bezugTried[0].body?.blocked === 'contributor' && bezugTried[1].body?.error && !(await snap()).elements.bezug, 'Ziel eines Verbinders und Kommentars lässt sich nicht übernehmen', bezugTried.map((x) => x.body));
  await as.ops([{ op: 'delete', id: 'kante' }, { op: 'delete', id: 'angeheftet' }]);
  await as.ops([{ op: 'moderation', active: true, editLock: true }]);
  await wait(300);
  r = await gx.ops([{ op: 'patch', id: E1, set: { x: 5 } }]);
  ok(r.body?.blocked === 'editLock' && (await snap()).elements[E1].x === 0, 'Bearbeitungssperre gilt', r.body);
  ok(await G.evaluate(async () => (await import('/js/core.js')).app.notesOpen === false), 'Die Oberfläche folgt der Sperre');
  await as.ops([{ op: 'moderation', addFacilitator: String(gx.hello.me.userId) }]);
  r = await gx.ops([{ op: 'moderation', editLock: false }]);
  ok(r.body?.blocked === 'contributor', 'Als Moderation eingetragen: trotzdem keine Moderation', r.body);
  r = await gx.ops([{ op: 'patch', id: E1, set: { x: 6 } }]);
  ok(r.body?.blocked === 'editLock', 'Als Moderation eingetragen: Sperre gilt weiter', r.body);
  await as.ops([{ op: 'moderation', active: false }]);
  await wait(300);

  console.log('=== Andere Schnittstellen');
  for (const [m, u, body] of [
    ['POST', `/api/boards/${id}/recordings`, { durationMs: 1000, track: [] }], ['POST', `/api/boards/${id}/files`, {}], ['PUT', `/api/boards/${id}/thumb`, {}],
    ['PATCH', `/api/boards/${id}`, { name: 'x' }], ['DELETE', `/api/boards/${id}`], ['POST', `/api/boards/${id}/duplicate`, {}], ['POST', `/api/boards/${id}/versions`, {}],
    ['GET', `/api/boards/${id}/versions`], ['POST', `/api/boards/${id}/members`, { email: 'x@example.org' }], ['GET', `/api/boards/${id}/guest-links`], ['POST', `/api/boards/${id}/guest-links`, { role: 'contributor' }],
    ['GET', `/api/boards/${id}/reviews`], ['POST', '/api/templates', { name: 'x', elements: [] }], ['POST', '/api/boards', { name: 'x' }], ['GET', '/api/tasks'],
  ]) {
    r = await api(G, m, u, body);
    ok(r.status === 403, `${m} ${u.replace(id, ':id')} abgelehnt`, r.status);
  }
  r = await api(G, 'POST', `/api/boards/${id}/signal`, { clientId: 'gibtsnicht0001', kind: 'summon' });
  ok(r.status === 409 || r.status === 403, 'Keine Signale ohne Verbindung', r.status);

  console.log('=== Grenze je Gast');
  let n = (await connect(G, id)).hello.mine.length;
  const gl = await connect(G, id);
  for (let i = n; i < 5; i++) await gl.ops([{ op: 'upsert', el: { id: own('menge' + i), type: 'sticky', x: 1000 + i * 10, y: 800, w: 100, h: 100, text: 'x', z: 90 + i } }]);
  r = await gl.ops([{ op: 'upsert', el: { id: own('zuviel'), type: 'sticky', x: 0, y: 800, w: 100, h: 100, text: 'x', z: 99 } }]);
  ok(r.body?.blocked === 'noteLimit' && !(await snap()).elements[own('zuviel')], 'Die sechste Notiz wird abgelehnt', r.body);
  ok((r.body.revert || []).some((o) => o.op === 'delete' && o.id === own('zuviel')), 'Der Browser nimmt sie zurück', r.body);
  await G.reload({ waitUntil: 'load' });
  await wait(1200);
  await G.mouse.click(120, 700);
  await G.keyboard.press('n');
  await G.mouse.click(200, 700);
  await wait(900);
  ok(/höchste Zahl/.test(await toast(G)), 'Die Oberfläche nennt den Grund', await toast(G));
  await G.keyboard.press('Escape');
  await gl.ops([{ op: 'delete', id: own('menge4') }]);
  r = await gl.ops([{ op: 'upsert', el: { id: own('platz'), type: 'sticky', x: 0, y: 800, w: 100, h: 100, text: 'x', z: 99 } }]);
  ok(!!(await snap()).elements[own('platz')], 'Löschen macht Platz', r.body);
  const G2 = await joinGuest(b, token, 'Gustav');
  const g2 = await connect(G2, id);
  r = await g2.ops([{ op: 'patch', id: own('platz'), set: { text: 'fremder Gast' } }, { op: 'delete', id: E1 }]);
  now = await snap();
  ok(now.elements[own('platz')].text === 'x' && !!now.elements[E1], 'Notizen anderer Gäste sind fremd', r.body);
  ok(!g2.hello.mine.length && !JSON.stringify(g2.hello).includes('ownerId'), 'Ein Gast erfährt nichts über fremdes Eigentum', g2.hello.mine);
  ok(!JSON.stringify(await connect(A, id).then((c) => c.hello)).includes('"mine"'), 'Bearbeitende bekommen keine Eigentumsliste');
  ok(!('idKey' in (await connect(A, id)).hello) && g2.hello.idKey !== gs.hello.idKey, 'Der Schlüssel gilt nur für eine Person');

  console.log('=== Gelöschte Kennungen, auch nach einem Neustart');
  const wiederholen = (c) => c.ops([{ op: 'upsert', el: { id: own('platz'), type: 'sticky', x: 0, y: 800, w: 100, h: 100, text: 'von Gustav', z: 99 } }]);
  await gl.ops([{ op: 'delete', id: own('platz') }]);
  r = await wiederholen(g2);
  ok(r.body?.blocked === 'contributor' && !(await snap()).elements[own('platz')], 'Die gelöschte Notiz eines Gastes bleibt für andere gesperrt', r.body);
  await wait(1400);
  server('restart');
  for (let i = 0; i < 60 && !(await api(A, 'GET', '/api/auth/me').catch(() => ({}))).body?.user; i++) await wait(500);
  await wait(3000);
  const g3 = await connect(G2, id);
  r = await wiederholen(g3);
  ok(r.body?.blocked === 'contributor' && !(await snap()).elements[own('platz')], 'Neustart: bleibt gesperrt', r.body);
  r = await g3.ops([{ op: 'upsert', el: { id: 'bezug', type: 'sticky', x: 2000, y: 2000, w: 100, h: 100, text: 'Gast', z: 83 } }]);
  ok(r.body?.blocked === 'contributor', 'Neustart: Auch ohne Merkliste keine fremde Kennung', r.body);
  const gg = await connect(G, id);
  ok(gg.hello.idKey === gs.hello.idKey, 'Neustart: Der Schlüssel bleibt, das Geheimnis liegt in der Datenbank');
  r = await wiederholen(gg);
  ok(!r.body?.blocked && !!(await snap()).elements[own('platz')], 'Die eigene Kennung geht weiter (Rückgängig nach dem Neustart)', r.body);
  as = await connect(A, id);

  console.log('=== Drosselung eigener Änderungen');
  const G4 = await joinGuest(b, token, 'Greta');
  const g4 = await connect(G4, id);
  const g4Id = makeId(g4.hello.idKey);
  await g4.ops([{ op: 'upsert', el: { id: g4Id, type: 'sticky', x: 3000, y: 800, w: 100, h: 100, text: 'Start', z: 130 } }]);
  const edits = (n, text) => Array.from({ length: n }, () => ({ op: 'patch', id: g4Id, set: { text } }));
  r = await g4.ops(edits(2900, 'zügig'));
  ok(!r.body?.error && (await snap()).elements[g4Id].text === 'zügig', 'Fast 50 Änderungen je Sekunde gehen durch', r.body?.error);
  r = await g4.ops(edits(100, 'am Limit'));
  ok(!r.body?.error && (await snap()).elements[g4Id].text === 'am Limit', 'Bis zur Grenze geht alles durch', r.body?.error);
  r = await g4.ops(edits(5, 'zu viel'));
  ok(/Zu viele Versuche|Too many/.test(r.body?.error || '') && (await snap()).elements[g4Id].text === 'am Limit', 'Darüber greift die Drosselung', r.body?.error);
  ok((r.body?.revert || []).some((o) => o.el?.id === g4Id && o.el.text === 'am Limit'), 'Der Browser bekommt den gültigen Stand', (r.body?.revert || []).length);
  r = await gg.ops([{ op: 'patch', id: own('platz'), set: { text: 'andere bleiben frei' } }]);
  ok(r.status === 200 && !r.body?.error && (await snap()).elements[own('platz')].text === 'andere bleiben frei', 'Die Drosselung gilt je Gast', r.body);
  await G4.close();

  console.log('=== Long-Polling');
  const P = await joinGuest(b, token, 'Paula');
  P.on('pageerror', (e) => errs.push('Poll ' + e.message));
  await P.goto(`${BASE}/board/${id}?transport=poll`, { waitUntil: 'load' });
  await P.waitForSelector('g[data-id="fremd1"]', { timeout: 8000 });
  await wait(1000);
  await P.mouse.click(250, 650);
  await P.keyboard.press('n');
  await P.mouse.click(250, 650);
  await wait(500);
  await P.keyboard.type('Über Polling');
  await P.keyboard.press('Escape');
  await wait(1200);
  const pn = await newest(P);
  ok((await local(A, pn))?.text === 'Über Polling', 'Notiz über Long-Polling', await local(A, pn));
  await as.ops([{ op: 'patch', id: pn, set: { fill: '#ffcee0' } }]);
  await wait(800);
  ok((await local(P, pn))?.fill === '#ffcee0', 'Änderungen anderer kommen an');
  r = await P.evaluate(async (id) => {
    const c = await import('/js/core.js');
    return c.app.sync.transport || 'poll';
  }, id);
  ok(r === 'poll', 'Rückfall-Transport läuft', r);

  console.log('=== Versionen, Kopien, Export');
  const ver = await api(A, 'POST', `/api/boards/${id}/versions`, { label: 'Stand' });
  const copy = await api(A, 'POST', `/api/boards/${id}/duplicate`, {});
  const vcopy = await api(A, 'POST', `/api/boards/${id}/versions/${ver.body.id}/copy`, {});
  for (const [name, bid] of [['Kopie', copy.body.id], ['Versionskopie', vcopy.body.id]]) {
    const c = await connect(A, bid);
    ok(!!c.hello.board.elements[E1] && !JSON.stringify(c.hello).includes('ownerId'), `${name}: Inhalt da, kein Eigentum`);
    ok((await api(G, 'GET', `/api/boards/${bid}`)).status === 403, `${name}: Für den Gast fremd`);
  }
  r = await api(A, 'POST', '/api/boards', { name: 'Import', elements: [{ id: 'imp1', type: 'sticky', x: 0, y: 0, w: 100, h: 100, text: 'i', ownerId: String(gx.hello.me.userId) }] });
  ok(!JSON.stringify((await connect(A, r.body.id)).hello).includes('ownerId'), 'Import übernimmt kein Eigentum');
  r = await api(A, 'POST', `/api/boards/${id}/versions/${ver.body.id}/restore`, {});
  ok(r.status === 200, 'Version wiederhergestellt', r);
  await wait(1500);
  const gr = await connect(G, id);
  ok(gr.hello.mine.length === 0, 'Nach dem Wiederherstellen gehört einem Gast nichts mehr', gr.hello.mine);
  await gr.ops([{ op: 'patch', id: E1, set: { text: 'nach Version' } }]);
  ok((await snap()).elements[E1].text !== 'nach Version', 'Der Gast ändert sie nicht mehr');
  const lim = await api(A, 'GET', '/api/boards/' + id);
  ok(lim.body.features.guestNoteLimit === 5, 'Grenze steht in den Angaben');

  console.log('=== Ende des Zugangs');
  const gn = await connect(G, id);
  await gn.ops([{ op: 'upsert', el: { id: own('bleibt'), type: 'sticky', x: 0, y: 950, w: 100, h: 100, text: 'bleibt', z: 120 } }]);
  await api(A, 'POST', `/api/boards/${id}/versions`, { label: 'flush' });
  await wait(1400);
  const link = (await api(A, 'GET', `/api/boards/${id}/guest-links`)).body.links.find((l) => l.role === 'contributor');
  r = await api(A, 'POST', `/api/boards/${id}/guest-links`, { role: 'commenter', days: 1 });
  const commenterToken = r.body.token;
  await settings({ guestContributions: false });
  await wait(600);
  ok((await api(A, 'GET', `/api/boards/${id}/guest-links`)).body.links.find((l) => l.id === link.id)?.revoked === true, 'Abschalten sperrt die Links der Stufe');
  ok((await api(G, 'GET', `/api/boards/${id}`)).status === 401, 'Abschalten meldet die Gäste ab', (await api(G, 'GET', `/api/boards/${id}`)).status);
  ok((await api(A, 'GET', `/api/guest/${commenterToken}`)).body.valid === true, 'Kommentier-Links bleiben gültig');
  now = await snap();
  ok(now.elements[own('bleibt')]?.text === 'bleibt' && /Gerda/.test(now.elements[own('bleibt')].author), 'Beiträge bleiben mit Namen erhalten', now.elements[own('bleibt')]);
  await settings({ guestContributions: true });

  console.log('=== Zu prüfen');
  const rb = (await api(A, 'POST', '/api/boards', { name: 'Prüfboard', elements: [
    { id: 'pf1', type: 'frame', x: 0, y: 0, w: 400, h: 300, title: 'Entwurf', z: 1 },
    { id: 'pf2', type: 'frame', x: 500, y: 0, w: 400, h: 300, title: 'Bald verborgen', z: 2 },
    { id: 'pf3', type: 'frame', x: 2000, y: 0, w: 400, h: 300, title: 'Weit weg', z: 3 },
  ] })).body.id;
  for (const e of ['anna@example.org', 'ben@example.org']) await api(A, 'POST', `/api/boards/${rb}/members`, { email: e, role: 'commenter' });
  r = await api(A, 'POST', `/api/boards/${rb}/reviews`, { elementId: 'pf1', reviewers: [annaId, benId], note: 'Bitte ansehen' });
  ok(r.status === 201, 'Prüfung angefordert', r);
  await api(A, 'POST', `/api/boards/${rb}/reviews`, { elementId: 'pf2', reviewers: [annaId] });
  await api(A, 'POST', `/api/boards/${rb}/reviews`, { elementId: 'pf3', reviewers: [annaId] });
  const tb = (await api(A, 'POST', '/api/boards', { name: 'Papierkorbboard', elements: [{ id: 'pt', type: 'frame', x: 0, y: 0, w: 400, h: 300, title: 'Im Papierkorb', z: 1 }] })).body.id;
  await api(A, 'POST', `/api/boards/${tb}/members`, { email: 'anna@example.org', role: 'commenter' });
  await api(A, 'POST', `/api/boards/${tb}/reviews`, { elementId: 'pt', reviewers: [annaId] });
  const waiting = async (p = reviewer) => (await api(p, 'GET', '/api/tasks')).body.reviews.filter((x) => [rb, tb].includes(x.boardId)).map((x) => x.elementId).sort();
  ok(JSON.stringify(await waiting()) === JSON.stringify(['pf1', 'pf2', 'pf3', 'pt']), 'Alle offenen stehen in den Aufgaben', await waiting());
  ok(JSON.stringify(await waiting(ben)) === JSON.stringify(['pf1']), 'Nur die eigenen', await waiting(ben));
  ok(!(await waiting(A)).length, 'Wer vorgelegt hat, prüft nicht');
  const ar = await connect(A, rb);
  await ar.ops([{ op: 'upsert', el: { id: 'pf2', type: 'frame', x: 500, y: 0, w: 400, h: 300, title: 'Bald verborgen', z: 2, concealed: true } }]);
  ok(!(await waiting()).includes('pf2'), 'Verborgene Bereiche verschwinden', await waiting());
  // Vorgelegt und danach verborgen: Für Teilnehmende gibt es die Prüfung nicht mehr, auch nicht für die Prüfenden
  const hiddenReview = (await api(A, 'GET', `/api/boards/${rb}/reviews`)).body.reviews.find((x) => x.elementId === 'pf2');
  ok(!!hiddenReview, 'Der Besitzer sieht sie weiter');
  r = await api(reviewer, 'GET', `/api/boards/${rb}/reviews`);
  ok(!r.body.reviews.some((x) => x.elementId === 'pf2') && !JSON.stringify(r.body).includes('Bald verborgen'), 'Liste nennt die verborgene Prüfung nicht', r.body.reviews.map((x) => x.elementId));
  r = await api(reviewer, 'POST', `/api/boards/${rb}/reviews/${hiddenReview.id}/decision`, { decision: 'approved' });
  ok(r.status === 404, 'Blind entscheiden geht nicht', r);
  await api(A, 'PATCH', `/api/boards/${rb}/members/${benId}`, { role: 'editor' });
  await ar.ops([{ op: 'upsert', el: { id: 'pf4', type: 'frame', x: 3000, y: 0, w: 400, h: 300, title: 'Von Ben', z: 4 } }]);
  r = await api(ben, 'POST', `/api/boards/${rb}/reviews`, { elementId: 'pf4', reviewers: [annaId] });
  ok(r.status === 201, 'Ben legt selbst vor', r);
  const benReview = (await api(ben, 'GET', `/api/boards/${rb}/reviews`)).body.reviews.find((x) => x.elementId === 'pf4');
  await api(reviewer, 'POST', `/api/boards/${rb}/reviews/${benReview.id}/decision`, { decision: 'approved' });
  await ar.ops([{ op: 'upsert', el: { id: 'pf4', type: 'frame', x: 3000, y: 0, w: 400, h: 300, title: 'Von Ben', z: 4, concealed: true } }]);
  r = await api(ben, 'POST', `/api/boards/${rb}/reviews/${benReview.id}/restart`, {});
  ok(r.status === 404, 'Erneut vorlegen setzt verborgene Entscheidungen nicht zurück', r);
  ok((await api(A, 'GET', `/api/boards/${rb}/reviews`)).body.reviews.find((x) => x.elementId === 'pf4').people[0].decision === 'approved', 'Die Entscheidung steht noch');
  await api(A, 'PATCH', `/api/boards/${rb}/members/${benId}`, { role: 'commenter' });
  await api(A, 'DELETE', `/api/boards/${rb}/reviews/${benReview.id}`);
  await ar.ops([{ op: 'upsert', el: { id: 'hülle'.replace('ü', 'ue'), type: 'frame', x: 1900, y: -100, w: 800, h: 600, title: 'Hülle', concealed: true, z: 0 } }]);
  ok(!(await waiting()).includes('pf3'), 'Auch was in einem verborgenen Bereich liegt', await waiting());
  await ar.ops([{ op: 'delete', id: 'huelle' }]);
  ok((await waiting()).includes('pf3'), 'Aufgedeckt erscheint es wieder', await waiting());
  await api(A, 'DELETE', `/api/boards/${tb}`);
  ok(!(await waiting()).includes('pt'), 'Boards im Papierkorb verschwinden', await waiting());
  r = await api(reviewer, 'GET', '/api/notifications');
  ok(!r.body.items.some((n) => ['Im Papierkorb', 'Bald verborgen'].includes(n.excerpt)), 'Auch in der Glocke', r.body.items.map((n) => n.excerpt));
  await api(A, 'DELETE', `/api/boards/${rb}/members/${benId}`);
  ok(!(await waiting(ben)).length, 'Ohne Zugriff verschwindet die Prüfung', await waiting(ben));
  await api(A, 'POST', `/api/boards/${rb}/members`, { email: 'ben@example.org', role: 'viewer' });
  ok(!(await waiting(ben)).length, 'Nur noch Ansehen: kann nicht prüfen, steht nicht da', await waiting(ben));
  await api(A, 'PATCH', `/api/boards/${rb}/members/${benId}`, { role: 'commenter' });

  await reviewer.goto(BASE + '/#aufgaben', { waitUntil: 'networkidle0' });
  await reviewer.waitForSelector('#dash-reviews', { timeout: 5000 });
  const list = await reviewer.$eval('#dash-reviews', (e) => e.textContent);
  ok(/Zu prüfen/.test(list) && /Entwurf/.test(list) && /Prüfboard/.test(list) && !/Bald verborgen/.test(list), 'Eigener Bereich „Zu prüfen“', list);
  const href = await reviewer.evaluate(() => [...document.querySelectorAll('#dash-reviews a')].find((a) => /Entwurf/.test(a.textContent)).getAttribute('href'));
  ok(href.endsWith('#review=pf1'), 'Direktsprung', href);
  await Promise.all([reviewer.waitForNavigation({ waitUntil: 'load' }), reviewer.evaluate(() => [...document.querySelectorAll('#dash-reviews a')].find((a) => /Entwurf/.test(a.textContent)).click())]);
  await reviewer.waitForSelector('.review-item.focus', { timeout: 8000 });
  ok((await reviewer.$eval('.review-item.focus', (e) => e.dataset.review)) === 'pf1', 'Panel öffnet beim richtigen Element');
  ok(await reviewer.evaluate(async () => (await import('/js/core.js')).app.sel.has('pf1')), 'Element ist ausgewählt');

  console.log('=== Entscheidung und Benachrichtigung');
  const review = async (p, bid = rb, el = 'pf1') => (await api(p, 'GET', `/api/boards/${bid}/reviews`)).body.reviews.find((x) => x.elementId === el);
  const rid = (await review(A)).id;
  await A.goto(`${BASE}/board/${rb}`, { waitUntil: 'load' });
  await wait(1200);
  await api(reviewer, 'POST', `/api/boards/${rb}/reviews/${rid}/decision`, { decision: 'rejected', comment: 'Titel fehlt' });
  await wait(500);
  r = (await api(A, 'GET', '/api/notifications')).body.items[0];
  ok(r.kind === 'review_rejected' && r.actor === 'Anna', 'Meldung nennt Ergebnis und Name', r);
  ok(/hat deine Prüfung abgelehnt/.test(await toast(A)), 'Live-Meldung nennt das Ergebnis', await toast(A));
  ok(!(await waiting(ben)).includes('pf1'), 'Nach einer Ablehnung wartet nichts mehr', await waiting(ben));
  await A.evaluate(() => document.querySelector('.bell').click());
  await A.waitForSelector('.notif-item', { timeout: 4000 });
  ok(/Anna hat deine Prüfung abgelehnt/.test(await A.$eval('.notif-item', (e) => e.textContent)), 'Glocke nennt Ergebnis und Name', await A.$eval('.notif-item', (e) => e.textContent));
  await A.evaluate(() => document.querySelector('.notif-item').click());
  await A.waitForSelector('.review-item.focus', { timeout: 4000 });
  ok((await A.$eval('.review-item.focus', (e) => e.dataset.review)) === 'pf1', 'Klick öffnet das Panel beim Element');

  console.log('=== Runden');
  const restartBtn = () => A.evaluate(() => [...document.querySelectorAll('.review-item.focus button')].find((x) => x.textContent === 'Erneut vorlegen').click());
  await restartBtn();
  await A.waitForSelector('.modal-back textarea', { timeout: 3000 });
  await A.type('.modal-back textarea', 'Titel ergänzt');
  await A.evaluate(() => document.querySelector('.modal-back button[type=submit]').click());
  await wait(900);
  let rv = await review(A);
  ok(rv.round === 2 && rv.status === 'open' && rv.note === 'Titel ergänzt', 'Neue Runde mit Hinweis', rv);
  ok(rv.rounds.length === 1 && rv.rounds[0].round === 1 && rv.rounds[0].note === 'Bitte ansehen', 'Frühere Runde bleibt', rv.rounds);
  const annaOld = rv.rounds[0].people.find((p) => p.id === String(annaId));
  ok(annaOld?.decision === 'rejected' && annaOld.comment === 'Titel fehlt', 'Begründung bleibt erhalten', rv.rounds[0]);
  ok(rv.rounds[0].people.find((p) => p.id === String(benId))?.decision === null, 'Ausstehende stehen mit drin', rv.rounds[0]);
  ok(rv.people.every((p) => !p.decision), 'Aktuelle Runde ist offen', rv.people);
  r = await api(A, 'POST', `/api/boards/${rb}/reviews/${rid}/restart`, {});
  rv = await review(A);
  ok(rv.round === 2 && rv.rounds.length === 1 && rv.note === 'Titel ergänzt', 'Ohne Entscheidung keine leere Runde', rv);
  await api(reviewer, 'POST', `/api/boards/${rb}/reviews/${rid}/decision`, { decision: 'approved', comment: 'Passt' });
  await api(ben, 'POST', `/api/boards/${rb}/reviews/${rid}/decision`, { decision: 'approved' });
  rv = await review(A);
  ok(rv.status === 'approved', 'Zweite Runde genehmigt', rv.status);
  r = (await api(A, 'GET', '/api/notifications')).body.items[0];
  ok(r.kind === 'review_approved', 'Genehmigt wird gemeldet', r);
  await A.reload({ waitUntil: 'load' });
  await wait(1200);
  await A.evaluate(() => document.querySelector('[data-panel="reviews"]').click());
  await A.waitForSelector('.review-rounds', { timeout: 4000 });
  await A.evaluate(() => document.querySelector('.review-rounds summary').click());
  await wait(200);
  const shown = await A.$eval('.review-rounds', (e) => e.textContent);
  ok(/1 frühere Runde/.test(shown) && /Titel fehlt/.test(shown) && /Anna/.test(shown) && /hat abgelehnt/.test(shown), 'Panel zeigt die frühere Runde', shown);
  ok(!/freigegeben/.test(await A.$eval('[data-review="pf1"]', (e) => e.textContent)), 'Panel spricht von Genehmigen');
  const audit = await api(A, 'GET', '/api/admin/audit?action=review_restarted');
  ok(audit.status === 200 && JSON.stringify(audit.body).includes('"round"'), 'Protokoll nennt die Runde', audit.status);
  const cleo = await (await b.createBrowserContext()).newPage();
  await login(cleo, 'cleo@example.org', PW);
  const empty = await cleo.evaluate(() => fetch('/api/notifications').then((x) => x.json()));
  if (!empty.items.length) {
    await cleo.goto(BASE + '/', { waitUntil: 'networkidle0' });
    await cleo.evaluate(() => document.querySelector('.bell').click());
    await wait(400);
    ok(/Prüfung/.test(await cleo.evaluate(() => document.querySelector('.notif-list')?.textContent || '')), 'Leere Glocke erwähnt Prüfungen');
  }
  console.log('=== Glocke und kalte Boards');
  // Eigenes Konto: Die Datenbank der Testinstanz enthält Meldungen früherer Läufe
  const coldMail = `kalt${Date.now()}@example.org`;
  const coldUser = (await api(A, 'POST', '/api/admin/users', { name: 'Kalt', email: coldMail, password: PW, role: 'user' })).body.id;
  const cold = await (await b.createBrowserContext()).newPage();
  await login(cold, coldMail, PW);
  const offen = (await api(A, 'POST', '/api/boards', { name: 'Kalt offen', elements: [{ id: 'k1', type: 'frame', x: 0, y: 0, w: 400, h: 300, title: 'Kalt sichtbar', z: 1 }] })).body.id;
  const zu = (await api(A, 'POST', '/api/boards', { name: 'Kalt verborgen', elements: [{ id: 'k2', type: 'frame', x: 0, y: 0, w: 400, h: 300, title: 'Kalt geheim', z: 1 }] })).body.id;
  for (const x of [offen, zu]) await api(A, 'POST', `/api/boards/${x}/members`, { email: coldMail, role: 'commenter' });
  await api(A, 'POST', `/api/boards/${offen}/reviews`, { elementId: 'k1', reviewers: [coldUser] });
  await api(A, 'POST', `/api/boards/${zu}/reviews`, { elementId: 'k2', reviewers: [coldUser] });
  const az = await connect(A, zu);
  await az.ops([{ op: 'upsert', el: { id: 'k2', type: 'frame', x: 0, y: 0, w: 400, h: 300, title: 'Kalt geheim', z: 1, concealed: true } }]);
  await wait(1500);
  await A.goto(BASE + '/', { waitUntil: 'load' });
  await reviewer.goto(BASE + '/', { waitUntil: 'load' });
  await cold.goto(BASE + '/login', { waitUntil: 'load' });
  server('restart');
  for (let i = 0; i < 60 && !(await api(A, 'GET', '/api/auth/me').catch(() => ({}))).body?.user; i++) await wait(500);
  await wait(1000);
  const inMemory = async () => (await api(A, 'GET', '/api/admin/metrics')).body.realtime.boardsInMemory;
  const coldBefore = await inMemory();
  const bell = (await api(cold, 'GET', '/api/notifications')).body.items.map((n) => n.excerpt);
  ok(bell.includes('Kalt sichtbar') && !bell.includes('Kalt geheim'), 'Die Glocke entscheidet richtig', bell);
  const coldAfter = await inMemory();
  ok(coldAfter - coldBefore === 1, 'Geladen wird nur, was einen verborgenen Bereich hat', [coldBefore, coldAfter]);

  ok(errs.length === 0, 'Keine Seitenfehler', errs);
  await b.close();
  console.log(f ? `\n${f} Fehler` : '\nAlles bestanden');
  process.exit(f ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
