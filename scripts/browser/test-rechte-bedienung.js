// Rechte im Zusammenspiel: Privatmodus, Grenzwerte, Leitung von Retro und Abstimmung, Einladungen, Freigaben, Long-Polling, verborgene Bereiche
const { launch, BASE } = require('./lib');
const PW = 'Gewitter-Laterne-83';
let f = 0;
const ok = (c, m, x) => {
  console.log((c ? 'ok  ' : 'FAIL') + ' ' + m + (c || x === undefined ? '' : ' → ' + JSON.stringify(x).slice(0, 300)));
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
const core = (p, fn, ...a) => p.evaluate(`(async()=>{const c=await import('/js/core.js');return (${fn.toString()})(c,...${JSON.stringify(a)})})()`);
const get = (p, id) => core(p, (c, id) => JSON.parse(JSON.stringify(c.getEl(id) || null)), id);
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
const op = (p, o) => core(p, (c, o) => c.app.sync.op(o), o);
const idle = async (ps) => {
  for (let i = 0; i < 60; i++) {
    const busy = await Promise.all(ps.map((p) => core(p, (c) => c.app.sync.pending || c.app.sync.sending.length > 0)));
    if (!busy.some(Boolean)) return;
    await wait(80);
  }
};
const edit = (p, id) => core(p, (c, id) => (c.setSelection([]), c.startEdit(id, { selectAll: false })), id);
const stop = (p) => core(p, (c) => c.finishEdit());
const session = (p) => core(p, (c) => JSON.parse(JSON.stringify(c.app.session)));
const open = async (p, id, q = '') => {
  await p.goto(BASE + '/board/' + id + q, { waitUntil: 'load' });
  await p.waitForFunction(async () => (await import('/js/core.js')).app.loaded === true, { timeout: 15000 });
  await wait(250);
  await p.evaluate(() => document.querySelector('#empty-start .btn:last-child')?.click());
  await core(p, (c) => {
    c.app.view.x = 0;
    c.app.view.y = 0;
    c.app.view.z = 1;
    c.applyView();
  });
};
const tap = (p) =>
  core(p, (c) => {
    window.__ops = [];
    const o = c.app.sync.dispatch.bind(c.app.sync);
    c.app.sync.dispatch = (m) => {
      window.__ops.push(m);
      return o(m);
    };
  });
const seen = (p, text) => p.evaluate((t) => window.__ops.filter((m) => JSON.stringify(m).includes(t)).length, text);
const texts = (p, sel) => p.evaluate((s) => [...document.querySelectorAll(s)].map((b) => b.textContent), sel);
const person = async (b, mail, pw = PW, opts = {}) => {
  const ctx = await b.createBrowserContext();
  const p = await ctx.newPage();
  if (opts.lang !== false) await p.setExtraHTTPHeaders({ 'Accept-Language': 'de' });
  p.on('dialog', (d) => d.accept());
  await p.goto(BASE + '/login', { waitUntil: 'networkidle0' });
  if (mail) {
    const r = await api(p, 'POST', '/api/auth/login', { login: mail, password: pw });
    if (r.status >= 300) throw new Error('Anmeldung ' + mail + ': ' + r.status);
  }
  const c = await p.createCDPSession();
  await c.send('Emulation.setFocusEmulationEnabled', { enabled: true });
  return p;
};
const board = async (owner, members, name = 'R') => {
  const id = (await api(owner, 'POST', '/api/boards', { name })).body.id;
  for (const [mail, role] of Object.entries(members)) await api(owner, 'POST', `/api/boards/${id}/members`, { email: mail, role });
  return id;
};

async function privat(A, B, C, q) {
  console.log('=== Privatmodus: leere Notizen ' + (q || 'sse'));
  const id = await board(A, { 'ben@example.org': 'editor', 'cleo@example.org': 'editor' });
  for (const p of [A, B, C]) await open(p, id, q);
  await tap(C);
  await mk(A, 'sticky', 'leer', { x: 200, y: 200, text: '' });
  await mk(A, 'sticky', 'voll', { x: 500, y: 200, text: 'Vorlage' });
  await mk(A, 'sticky', 'leer2', { x: 800, y: 200, text: '' });
  await mk(A, 'sticky', 'streit', { x: 200, y: 500, text: '' });
  await idle([A]);
  await wait(300);
  await op(A, { op: 'privateMode', active: true });
  await wait(400);
  await core(C, () => (window.__ops.length = 0));
  await edit(B, 'leer');
  await B.keyboard.type('Q');
  await idle([B]);
  await wait(400);
  const first = await get(C, 'leer');
  ok(first.hidden && !first.text, 'Der erste Buchstabe erreicht niemanden', first);
  ok(first.privName === 'Ben', 'Platzhalter nennt im normalen Privatmodus die Person', first.privName);
  ok((await C.evaluate(() => window.__ops.filter((m) => m.type === 'ops' && m.ops.some((o) => o.edits)).length)) === 0, 'Keine Eingabeschritte an andere');
  ok(String((await get(B, 'leer')).priv) === String((await api(B, 'GET', '/api/auth/me')).body.id ?? (await api(B, 'GET', '/api/auth/me')).body.user?.id), 'Absender bekommt die Marke');
  await B.keyboard.type('UELLE');
  await idle([B]);
  await wait(300);
  await stop(B);
  await idle([B]);
  await wait(300);
  ok((await seen(C, 'QUELLE')) === 0 && (await seen(C, 'UELLE')) === 0, 'Auch später nichts vom Text', await seen(C, 'UELLE'));
  ok((await get(B, 'leer')).text === 'QUELLE', 'Bei Ben steht der ganze Text', await get(B, 'leer'));
  const act = await api(C, 'GET', `/api/boards/${id}/activity?limit=50`);
  ok(!JSON.stringify(act.body).includes('QUELLE'), 'Verlauf verrät nichts');

  await edit(B, 'voll');
  await B.keyboard.type('X');
  await idle([B]);
  await wait(300);
  await stop(B);
  await idle([B]);
  await wait(300);
  const voll = await get(C, 'voll');
  ok(!voll.hidden && /X/.test(voll.text) && !voll.priv, 'Notiz mit Inhalt bleibt, wie sie ist', voll);

  console.log('--- gleichzeitig in derselben leeren Notiz');
  await edit(C, 'streit');
  await wait(150);
  await edit(B, 'streit');
  await B.keyboard.type('B');
  await idle([B]);
  await wait(500);
  ok((await get(C, 'streit')).hidden, 'Zuerst Schreibender gewinnt, die andere sieht den Platzhalter');
  ok(!(await core(C, (c) => !!c.app.editing)), 'Ihr Editor schließt sich');
  await stop(B);
  await idle([B]);

  console.log('--- anonym');
  await op(A, { op: 'privateMode', active: true, anonymous: true });
  await wait(500);
  await core(C, () => (window.__ops.length = 0));
  await edit(B, 'leer2');
  await B.keyboard.type('anonym');
  await idle([B]);
  await wait(400);
  await stop(B);
  await idle([B]);
  await wait(400);
  const an = await get(C, 'leer2');
  ok(an.hidden && an.priv === 'anon' && an.privName === '', 'Anonym: ohne Namen und Kennung', an);
  ok((await seen(C, '"Ben')) === 0, 'Anonym: Der Name kommt nicht an', await C.evaluate(() => window.__ops.filter((m) => JSON.stringify(m).includes('"Ben')).map((m) => m.type)));
  console.log('--- Name am Mauszeiger');
  const stage = await B.evaluate(() => {
    const r = document.getElementById('stage').getBoundingClientRect();
    return { x: r.x + 500, y: r.y + 450 };
  });
  await B.mouse.move(stage.x, stage.y);
  await B.mouse.move(stage.x + 30, stage.y + 20, { steps: 4 });
  await wait(600);
  const cur = await C.evaluate(() =>
    [...document.querySelectorAll('.peer-cursor')].map((c) => ({ anon: c.classList.contains('anon'), name: getComputedStyle(c.querySelector('.peer-name')).display })),
  );
  ok(cur.length && cur.every((c) => c.anon && c.name === 'none'), 'Anonym: kein Name am Zeiger', cur);

  await op(A, { op: 'privateMode', active: false });
  await wait(700);
  ok((await get(C, 'leer')).text === 'QUELLE', 'Aufdecken zeigt den Text', await get(C, 'leer'));
  const a2 = await get(C, 'leer2');
  ok(a2.text === 'anonym' && a2.anon && !a2.author, 'Aufdecken: anonym bleibt ohne Namen', a2);
  const cur2 = await C.evaluate(() => [...document.querySelectorAll('.peer-cursor')].map((c) => c.classList.contains('anon')));
  ok(cur2.every((x) => !x), 'Nach dem Aufdecken steht der Name wieder am Zeiger', cur2);
}

async function leitung(A, B, C, V) {
  console.log('=== Retro und Privatmodus: Leitung');
  const id = await board(A, { 'ben@example.org': 'editor', 'cleo@example.org': 'editor', 'dora@example.org': 'viewer' });
  for (const p of [A, B, C, V]) await open(p, id);
  await op(B, { op: 'retro', action: 'start', steps: ['checkin', 'collect', 'vote'], opts: {} });
  await wait(500);
  const barC = await texts(C, '#retro-bar button');
  ok(barC.length === 0, 'Andere sehen keine Steuerknöpfe', barC);
  ok((await texts(B, '#retro-bar button')).some((t) => /Weiter/.test(t)), 'Die Leitung sieht sie');
  ok((await texts(A, '#retro-bar button')).some((t) => /Weiter/.test(t)), 'Der Besitzer sieht sie');
  ok((await texts(C, '#retro-bar .retro-head')).join('').includes('geleitet von Ben'), 'Wer leitet, steht in der Leiste', await texts(C, '#retro-bar .retro-head'));
  await op(C, { op: 'retro', action: 'step', step: 1 });
  await wait(400);
  ok((await session(B)).retro.step === 0, 'Server lehnt den Schritt ab', (await session(B)).retro);
  ok((await session(C)).retro.step === 0, 'Auch bei der Absenderin bleibt der Stand');
  await op(C, { op: 'retro', action: 'stop' });
  await wait(300);
  ok((await session(B)).retro?.active, 'Server lehnt das Beenden ab');
  await op(C, { op: 'poll', action: 'start', kind: 'mood', question: 'x' });
  await wait(300);
  ok(!(await session(B)).poll, 'Umfragen gehören während der Retro zur Leitung');
  await op(B, { op: 'retro', action: 'step', step: 1 });
  await wait(300);
  ok((await session(C)).retro.step === 1, 'Die Leitung darf');
  await op(A, { op: 'retro', action: 'step', step: 2 });
  await wait(300);
  ok((await session(C)).retro.step === 2, 'Der Besitzer darf');
  console.log('--- Leitung und Besitzer gehen');
  await A.goto(BASE + '/login');
  await B.goto(BASE + '/login');
  await wait(800);
  ok((await texts(C, '#retro-bar button')).length > 0, 'Sind alle Leitenden weg, kann übernommen werden', await texts(C, '#retro-bar button'));
  await op(C, { op: 'retro', action: 'stop' });
  await wait(300);
  ok(!(await session(C)).retro?.active, 'Übernahme gilt auch auf dem Server');
  await open(A, id);
  await open(B, id);

  await op(B, { op: 'privateMode', active: true });
  await wait(400);
  const pm = await texts(C, '#private-banner button');
  ok(!pm.some((t) => /Aufdecken/.test(t)), 'Aufdecken: nicht für andere Bearbeitende', pm);
  ok((await texts(B, '#private-banner button')).some((t) => /Aufdecken/.test(t)), 'Aufdecken: für die startende Person');
  ok((await texts(A, '#private-banner button')).some((t) => /Aufdecken/.test(t)), 'Aufdecken: für den Besitzer');
  ok(!(await texts(V, '#private-banner button')).some((t) => /Aufdecken/.test(t)), 'Aufdecken: nicht für Betrachter');
  await op(C, { op: 'privateMode', active: false });
  await wait(300);
  ok((await session(A)).privateMode?.active, 'Server lehnt Aufdecken ab');
  await op(B, { op: 'privateMode', active: false });
  await wait(300);

  console.log('=== Abstimmung');
  await mk(A, 'sticky', 'n1', { x: 300, y: 300, w: 160, h: 160, text: 'eins' });
  await idle([A]);
  await wait(300);
  await core(B, (c) => c.app.sync.op({ op: 'voting', voting: { active: true, votesPerUser: 3, votes: {}, by: 'Fälschung', byId: '1', startedAt: 1234 } }));
  await wait(400);
  const v = (await session(A)).voting;
  ok(v.by === 'Ben', 'Name der startenden Person kommt vom Server', v);
  const btnC = await texts(C, '#voting-banner button');
  ok(!btnC.includes('Beenden'), 'Beenden: nicht für andere', btnC);
  ok(btnC.includes('Für mich pausieren'), 'Pausieren wirkt nur für einen selbst und sagt das', btnC);
  ok(!(await texts(V, '#voting-banner button')).includes('Beenden'), 'Beenden: nicht für Betrachter');
  ok((await texts(B, '#voting-banner button')).includes('Beenden'), 'Beenden: für die startende Person');
  ok((await texts(A, '#voting-banner button')).includes('Beenden'), 'Beenden: für den Besitzer');
  await op(C, { op: 'voting', voting: { ...v, active: false } });
  await wait(300);
  ok((await session(A)).voting?.active, 'Server lehnt Beenden ab');
  await op(C, { op: 'voting', voting: null });
  await wait(300);
  ok((await session(A)).voting?.active, 'Server lehnt Abbrechen ab');
  ok((await session(C)).voting?.active, 'Bei der Absenderin bleibt die Abstimmung');

  console.log('--- Stimme zurücknehmen');
  const r = await C.evaluate(() => {
    const b = document.querySelector('g[data-id="n1"]').getBoundingClientRect();
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  });
  await C.mouse.click(r.x, r.y);
  await wait(300);
  await C.mouse.click(r.x, r.y);
  await wait(400);
  const mine = (p) => core(p, (c) => Object.values(c.app.session.voting?.votes?.n1 || {})[0] || 0);
  ok((await mine(C)) === 2, 'Zwei Stimmen vergeben', await mine(C));
  const minus = await C.evaluate(() => {
    const b = document.querySelector('[data-unvote="n1"]')?.getBoundingClientRect();
    return b && { x: b.x + b.width / 2, y: b.y + b.height / 2, w: b.width };
  });
  ok(minus && minus.w >= 24, 'Minus an der eigenen Stimme, groß genug für den Finger', minus);
  await C.mouse.click(minus.x, minus.y);
  await wait(400);
  ok((await mine(C)) === 1, 'Minus nimmt eine Stimme zurück', await mine(C));
  ok((await C.evaluate(() => document.getElementById('voting-banner').textContent)).includes('Minus'), 'Hinweis nennt das Minus');

  console.log('--- Touch');
  const T = await C.browserContext().newPage();
  await T.setViewport({ width: 900, height: 700, hasTouch: true, isMobile: true });
  await open(T, id);
  const box = await T.evaluate(() => {
    const b = document.querySelector('g[data-id="n1"]').getBoundingClientRect();
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  });
  const votes = () => mine(T);
  const before = await votes();
  await T.touchscreen.touchStart(box.x, box.y);
  await wait(800);
  await T.touchscreen.touchEnd();
  await wait(400);
  ok((await votes()) === before, 'Langes Drücken zählt nicht als Stimme', [before, await votes()]);
  await T.keyboard.press('Escape');
  await wait(100);
  await T.touchscreen.tap(box.x, box.y);
  await wait(500);
  ok((await votes()) === before + 1, 'Kurzes Tippen zählt', [before, await votes()]);
  const m2 = await T.evaluate(() => {
    const b = document.querySelector('[data-unvote="n1"]')?.getBoundingClientRect();
    return b && { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  });
  await T.touchscreen.tap(m2.x, m2.y);
  await wait(500);
  ok((await votes()) === before, 'Minus geht auch mit dem Finger', [before, await votes()]);
  await T.close();

  await op(B, { op: 'voting', voting: { ...(await session(B)).voting, active: false } });
  await wait(300);
  ok(!(await session(A)).voting.active, 'Startende Person beendet');
}

async function freigabe(A, B, C, V) {
  console.log('=== Einladung und Freigabe');
  const conf = await api(A, 'GET', '/api/config');
  ok(conf.body.mailEnabled === false, 'Testinstanz hat keinen Mailserver', conf.body.mailEnabled);
  const id = await board(A, {}, 'Für Cleo');
  const r = await api(A, 'POST', `/api/boards/${id}/members`, { email: 'cleo@example.org', role: 'commenter' });
  ok(r.status === 200 && r.body.mailed === false, 'Eingeladen', r);
  const n = await api(C, 'GET', '/api/notifications');
  const hit = n.body.items.find((i) => i.kind === 'board_shared' && i.boardId === id);
  ok(hit && hit.excerpt === 'Für Cleo' && hit.actor === 'Anna', 'Benachrichtigung in der Glocke', n.body.items[0]);
  const again = await api(A, 'POST', `/api/boards/${id}/members`, { email: 'cleo@example.org', role: 'commenter' });
  ok(again.body.already, 'Nochmaliges Einladen ändert nichts');
  ok((await api(C, 'GET', '/api/notifications')).body.items.filter((i) => i.kind === 'board_shared' && i.boardId === id).length === 1, 'Und meldet nichts doppelt');
  await api(A, 'POST', `/api/boards/${id}/members`, { email: 'dora@example.org', role: 'viewer' });
  await open(A, id);
  await A.evaluate(() => [...document.querySelectorAll('.share-btn')][0].click());
  await A.waitForSelector('form.invite');
  const form = await A.evaluate(() => document.querySelector('form.invite').textContent);
  ok(!/Per E-Mail benachrichtigen/.test(form) && /Link/.test(form), 'Ohne Mailserver kein Häkchen, dafür ehrlicher Hinweis', form);
  await A.type('form.invite input[type=email]', 'ben@example.org');
  await A.keyboard.press('Enter');
  await wait(500);
  const t = await A.evaluate(() => document.getElementById('toast').textContent);
  ok(/Glocke/.test(t) && /Link selbst/.test(t), 'Meldung sagt, wie die Person davon erfährt', t);
  await A.keyboard.press('Escape');
  await wait(200);
  await A.evaluate(() => document.querySelector('.modal-back .modal-close, .modal-back [aria-label="Schließen"]')?.click());
  await wait(200);

  await mk(A, 'frame', 'fr', { x: 200, y: 200, w: 400, h: 300, title: 'Entwurf' });
  await idle([A]);
  await wait(300);
  await A.evaluate(async () => {
    const r = await import('/js/reviews.js');
    const c = await import('/js/core.js');
    r.requestReview(c.getEl('fr'));
  });
  await A.waitForSelector('.check-grid');
  const rows = await A.evaluate(() =>
    [...document.querySelectorAll('.check-grid label')].map((l) => ({ t: l.textContent, off: l.querySelector('input').disabled })),
  );
  ok(rows.find((x) => /Dora/.test(x.t))?.off && /Ansehen/.test(rows.find((x) => /Dora/.test(x.t)).t), 'Betrachter nicht wählbar, Rolle steht dabei', rows);
  ok(rows.find((x) => /Cleo/.test(x.t)) && !rows.find((x) => /Cleo/.test(x.t)).off && /Kommentieren/.test(rows.find((x) => /Cleo/.test(x.t)).t), 'Kommentierende sind wählbar', rows);
  const dora = (await api(A, 'GET', `/api/boards/${id}/people?roles=1`)).body.people.find((p) => p.displayName === 'Dora');
  const refused = await api(A, 'POST', `/api/boards/${id}/reviews`, { elementId: 'fr', reviewers: [dora.id] });
  ok(refused.status === 400 && /Dora/.test(refused.body.error || refused.body.message || JSON.stringify(refused.body)), 'Fehlermeldung nennt die Person', refused);
  await A.evaluate(() => document.querySelector('.modal-back .btn:not(.primary)')?.click());
  await wait(150);

  console.log('--- Zusammenfassung ohne Grundlage');
  await A.evaluate(async () => (await import('/js/retro.js')).openSummary());
  await A.waitForSelector('.summary-text');
  const btn = await texts(A, '.modal-back .btn');
  ok(!btn.some((x) => /Per E-Mail/.test(x)), 'Kein E-Mail-Knopf ohne Mailserver', btn);
  ok(!btn.some((x) => /Team-Kanal/.test(x)), 'Kein Team-Kanal ohne Team', btn);
  await A.evaluate(() => document.querySelector('.modal-back .modal-close, .modal-back [aria-label="Schließen"]')?.click());
  await A.keyboard.press('Escape');
}

async function verborgen(A, B, C) {
  console.log('=== Verborgene Bereiche');
  const id = await board(A, { 'ben@example.org': 'editor', 'cleo@example.org': 'viewer' });
  for (const p of [A, B]) await open(p, id);
  await mk(A, 'frame', 'f1', { x: 100, y: 100, w: 600, h: 400, title: 'Bereich' });
  await mk(A, 'sticky', 'in', { x: 200, y: 200, w: 120, h: 120, text: 'innen' });
  await mk(A, 'sticky', 'out', { x: 900, y: 200, w: 120, h: 120, text: 'aussen' });
  await core(A, (c) => {
    const l = c.makeElement('connector', 0, 0);
    Object.assign(l, { id: 'con', from: { id: 'out' }, to: { id: 'in' }, label: 'quer' });
    c.act(() => c.setEl(l));
  });
  await idle([A]);
  await wait(300);
  await core(A, (c) => c.updateEl('f1', { concealed: true }));
  await idle([A]);
  await wait(500);
  ok(!(await get(B, 'con')), 'Verbinder ins Verborgene ist weg');
  await core(A, (c) => c.updateEl('in', { x: 900, y: 500 }));
  await idle([A]);
  await wait(500);
  ok(!!(await get(B, 'in')), 'Herausgezogenes Element erscheint');
  ok((await get(B, 'con'))?.label === 'quer', 'Sein Verbinder erscheint, ohne dass jemand neu lädt', await get(B, 'con'));
  await core(A, (c) => c.updateEl('in', { x: 300, y: 300 }));
  await idle([A]);
  await wait(500);
  ok(!(await get(B, 'in')), 'Hineingezogenes Element verschwindet');
  ok(!(await get(B, 'con')), 'Sein Verbinder verschwindet mit', await get(B, 'con'));
  await core(A, (c) => c.updateEl('f1', { concealed: false }));
  await idle([A]);
  await wait(400);

  console.log('--- Kopie mit privatem Ende');
  await op(A, { op: 'privateMode', active: true });
  await wait(300);
  await mk(B, 'sticky', 'bp', { x: 900, y: 600, w: 120, h: 120, text: 'Bens Geheimnis' });
  await idle([B]);
  await wait(300);
  await core(A, (c) => {
    const l = c.makeElement('connector', 0, 0);
    Object.assign(l, { id: 'cp', from: { id: 'out' }, to: { id: 'bp' }, label: 'Bens Thema' });
    c.act(() => c.setEl(l));
  });
  await idle([A]);
  await wait(1400);
  const d = await api(A, 'POST', `/api/boards/${id}/duplicate`);
  const P = await A.browserContext().newPage();
  await open(P, d.body.id);
  const els = await core(P, (c) => JSON.stringify([...c.app.els.values()]));
  await P.close();
  ok(!els.includes('Bens Geheimnis'), 'Fremdes Privates kommt nicht mit');
  ok(!els.includes('Bens Thema'), 'Beschriftung des Verbinders auch nicht', els.slice(0, 200));
  ok(JSON.parse(els).some((e) => e.id === 'con'), 'Andere Verbinder bleiben');
  const v = await api(A, 'POST', `/api/boards/${id}/versions`, { label: 'v' });
  const cp = await api(A, 'POST', `/api/boards/${id}/versions/${v.body.id}/copy`);
  const Q = await A.browserContext().newPage();
  await open(Q, cp.body.id);
  const vels = await core(Q, (c) => JSON.stringify([...c.app.els.values()]));
  await Q.close();
  ok(!vels.includes('Bens Thema'), 'Versionskopie ebenso', vels.slice(0, 200));
  await op(A, { op: 'privateMode', active: false });
  await wait(300);
}

async function polling(A, B) {
  console.log('=== Long-Polling: letzte Nachrichten');
  const id = await board(A, { 'ben@example.org': 'editor' });
  const join = (p, bid, c) =>
    p.evaluate(
      async (bid, c) => {
        const r = await fetch(`/api/boards/${bid}/events?client=${c}&transport=poll`, { cache: 'no-store' });
        return r.status;
      },
      bid,
      c,
    );
  const poll = (p, bid, c) =>
    p.evaluate(
      async (bid, c) => {
        const r = await fetch(`/api/boards/${bid}/poll?client=${c}`, { cache: 'no-store' });
        return { status: r.status, body: r.status === 200 ? await r.json() : null };
      },
      bid,
      c,
    );
  ok((await join(B, id, 'pollben0001')) === 200, 'Verbunden');
  await api(A, 'PATCH', `/api/boards/${id}/members/${(await api(A, 'GET', `/api/boards/${id}/members`)).body.members[0].id}`, { role: 'viewer' });
  await wait(200);
  const r1 = await poll(B, id, 'pollben0001');
  ok(r1.status === 200 && r1.body.messages.some((m) => m.type === 'reload'), 'Neu laden kommt auch zwischen zwei Abfragen an', r1);
  ok((await poll(B, id, 'pollben0001')).status === 410, 'Danach ist die Verbindung zu Ende');
  ok((await join(B, id, 'pollben0002')) === 200, 'Wieder verbunden');
  await api(A, 'DELETE', `/api/boards/${id}`);
  await wait(200);
  const r2 = await poll(B, id, 'pollben0002');
  ok(r2.status === 200 && r2.body.messages.some((m) => m.type === 'deleted'), 'Löschen kommt an, obwohl der Kanal schon zu ist', r2);
}

async function grenzen(b, A) {
  console.log('=== Grenzwerte');
  const P = await person(b, null);
  let bad = 0;
  for (let i = 0; i < 40; i++) if ((await api(P, 'POST', '/api/auth/login', { login: 'cleo@example.org', password: PW })).status !== 200) bad++;
  ok(bad === 0, '40 Anmeldungen in Folge: Erfolge zählen nicht', bad);

  const id = await board(A, {}, 'Workshop');
  const { token } = (await api(A, 'POST', `/api/boards/${id}/guest-links`, { role: 'viewer', days: 1 })).body;
  const G = await person(b, null);
  bad = 0;
  for (let i = 0; i < 25; i++) {
    const r = await api(G, 'POST', '/api/guest/join', { token, name: 'Gast ' + i, consent: true });
    if (r.status !== 200) bad++;
  }
  ok(bad === 0, '25 Gäste über denselben Link hinter einer Adresse', bad);

  let last = null;
  for (let i = 0; i < 35; i++) last = await api(A, 'POST', `/api/boards/${id}/members`, { email: `neu${i}@example.org` });
  ok(last.status === 404, '35 Einladungen je Stunde gehen', last.status);

  let r;
  for (let i = 0; i < 11; i++) r = await api(P, 'POST', '/api/auth/login', { login: 'niemand@example.org', password: 'falsch-falsch' });
  ok(r.status === 429, 'Fehlversuche je Konto: nach zehn ist Schluss', r.status);
  ok(/Bitte warte (\d+ Minuten|eine Minute)\./.test(JSON.stringify(r.body)), 'Meldung nennt die Wartezeit', r.body);
  ok((await api(P, 'POST', '/api/auth/login', { login: 'cleo@example.org', password: PW })).status === 200, 'Andere Konten bleiben möglich');

  let g;
  for (let i = 0; i < 21; i++) g = await api(G, 'POST', '/api/guest/join', { token: 'x'.repeat(30) + i, name: 'Rate', consent: true });
  ok(g.status === 429, 'Gastlinks erraten: Fehlversuche je Adresse sind begrenzt', g.status);

  for (let i = 0; i < 25; i++) r = await api(P, 'POST', '/api/auth/login', { login: `rate${i}@example.org`, password: 'falsch-falsch' });
  ok(r.status === 429, 'Fehlversuche je Adresse: Quer über Konten ist auch Schluss', r.status);
}

(async () => {
  const b = await launch();
  const errs = [];
  const A = await person(b, 'anna@example.org');
  const B = await person(b, 'ben@example.org');
  const C = await person(b, 'cleo@example.org');
  const V = await person(b, 'dora@example.org');
  for (const [n, p] of [['A', A], ['B', B], ['C', C], ['V', V]]) p.on('pageerror', (e) => errs.push(n + ' ' + e.message));
  await privat(A, B, C, '');
  await privat(A, B, C, '?transport=poll');
  await leitung(A, B, C, V);
  await freigabe(A, B, C, V);
  await verborgen(A, B, C);
  await polling(A, B);
  await grenzen(b, A);
  ok(errs.length === 0, 'Keine Fehler in den Browsern', errs.slice(0, 5));
  await b.close();
  console.log(f ? 'FAIL ' + f : 'alles ok');
  process.exit(f ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
