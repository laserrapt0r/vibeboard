// Bedienung: Kontextmenü mit Tastatur, Befehlssuche, Präsentieren ohne Frames, Rollenhinweis, Frame löschen, Benutzer anlegen
const { launch, BASE } = require('./lib');
const PW = 'Gewitter-Laterne-83';
let f = 0;
const ok = (c, m, x) => {
  console.log((c ? 'ok  ' : 'FAIL') + ' ' + m + (c || x === undefined ? '' : ' → ' + JSON.stringify(x).slice(0, 400)));
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
const open = async (p, id) => {
  await p.goto(BASE + '/board/' + id, { waitUntil: 'load' });
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
const person = async (b, mail, pw = PW) => {
  const ctx = await b.createBrowserContext();
  const p = await ctx.newPage();
  await p.goto(BASE + '/login', { waitUntil: 'networkidle0' });
  const r = await api(p, 'POST', '/api/auth/login', { login: mail, password: pw });
  if (r.status >= 300) throw new Error('Anmeldung ' + mail);
  const c = await p.createCDPSession();
  await c.send('Emulation.setFocusEmulationEnabled', { enabled: true });
  return p;
};
const center = (p, id) =>
  p.evaluate((id) => {
    const b = document.querySelector(`g[data-id="${id}"]`).getBoundingClientRect();
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  }, id);
const menu = (p) => p.evaluate(() => [...document.querySelectorAll('.context-menu .menu-item, .context-menu .menu-sep')].map((x) => (x.classList.contains('menu-sep') ? '-' : x.querySelector('.mi-label').textContent)));
const toast = (p) => p.evaluate(() => (document.getElementById('toast')?.classList.contains('show') ? document.getElementById('toast').textContent : ''));
const search = async (p, q) => {
  await p.evaluate((q) => {
    const i = document.querySelector('.palette-input');
    i.value = q;
    i.dispatchEvent(new Event('input'));
  }, q);
  await wait(120);
  return p.evaluate(() => [...document.querySelectorAll('.palette-item .palette-label')].map((x) => x.textContent));
};
const palette = async (p, on) => {
  await p.evaluate(async (on) => {
    const c = await import('/js/core.js');
    if (on) c.app.emit('openPalette');
    else document.querySelector('.modal-back .modal-close, .modal-back [aria-label="Schließen"]')?.click();
  }, on);
  await wait(200);
};

(async () => {
  const b = await launch();
  const errs = [];
  const A = await person(b, 'anna@example.org');
  const V = await person(b, 'dora@example.org');
  const C = await person(b, 'cleo@example.org');
  for (const [n, p] of [['A', A], ['V', V], ['C', C]]) p.on('pageerror', (e) => errs.push(n + ' ' + e.message));
  const id = (await api(A, 'POST', '/api/boards', { name: 'M' })).body.id;
  await api(A, 'POST', `/api/boards/${id}/members`, { email: 'dora@example.org', role: 'viewer' });
  await api(A, 'POST', `/api/boards/${id}/members`, { email: 'cleo@example.org', role: 'commenter' });
  for (const p of [A, V, C]) await open(p, id);

  console.log('=== Präsentieren ohne Frames');
  const present = (p) => p.evaluate(() => document.getElementById('btn-present').click());
  await mk(A, 'sticky', 'n1', { x: 400, y: 300, text: 'Hallo' });
  await wait(400);
  await present(A);
  await wait(250);
  const dlg = await A.evaluate(() => [...document.querySelectorAll('.modal-back .btn')].map((x) => x.textContent));
  ok(dlg.includes('Frame anlegen') && dlg.includes('Ganzes Board zeigen'), 'Dialog bietet beide Wege', dlg);
  await A.evaluate(() => [...document.querySelectorAll('.modal-back .btn')].find((x) => x.textContent === 'Ganzes Board zeigen').click());
  await wait(250);
  await A.evaluate(() => [...document.querySelectorAll('.modal-back .btn')].find((x) => x.textContent === 'Nur für mich').click());
  await wait(500);
  ok(await A.evaluate(() => document.body.classList.contains('presenting')), 'Präsentation läuft');
  ok((await A.evaluate(() => document.getElementById('present-bar').textContent)).includes('Ganzes Board'), 'Leiste nennt die Ansicht');
  await A.keyboard.press('Escape');
  await wait(300);
  ok(!(await A.evaluate(() => document.body.classList.contains('presenting'))), 'Esc beendet');
  await present(A);
  await wait(250);
  await A.evaluate(() => [...document.querySelectorAll('.modal-back .btn')].find((x) => x.textContent === 'Frame anlegen').click());
  await wait(250);
  ok((await core(A, (c) => c.app.tool)) === 'frame', 'Frame anlegen wählt das Werkzeug');
  await core(A, (c) => c.setTool('select'));
  await present(V);
  await wait(250);
  const dv = await V.evaluate(() => [...document.querySelectorAll('.modal-back .btn')].map((x) => x.textContent));
  ok(!dv.includes('Frame anlegen') && dv.includes('Ganzes Board zeigen'), 'Betrachter: nur die Ansicht', dv);
  await V.evaluate(() => [...document.querySelectorAll('.modal-back .btn')].find((x) => x.textContent === 'Abbrechen').click());
  await wait(200);

  console.log('=== Kontextmenü');
  const r = await center(A, 'n1');
  const before = await get(A, 'n1');
  await A.mouse.click(r.x, r.y, { button: 'right' });
  await wait(250);
  const items = await menu(A);
  console.log('    ' + JSON.stringify(items));
  ok(items[0] === 'Text bearbeiten', 'Text bearbeiten steht oben', items);
  const at = (t) => items.indexOf(t);
  ok(at('Kopieren') < at('In den Vordergrund') && at('In den Vordergrund') < at('Sperren') && at('Sperren') < at('Kommentar hinzufügen') && at('Kommentar hinzufügen') < at('Löschen'), 'Reihenfolge: Bearbeiten, Zwischenablage, Anordnen, Sperren, Zusammenarbeit, Löschen', items);
  ok(!items.some((x, i) => x === '-' && items[i + 1] === '-') && items.at(-1) !== '-', 'Keine doppelten Trenner', items);
  ok(await A.evaluate(() => document.querySelector('.context-menu [role=menu]') && document.querySelector('.context-menu [role=menuitem]') && document.querySelector('.context-menu svg')), 'Rollen und Symbole');
  ok(await A.evaluate(() => document.activeElement?.closest?.('.context-menu')?.querySelector('[role=menuitem]') === document.activeElement), 'Fokus liegt auf dem ersten Eintrag');
  await A.keyboard.press('ArrowDown');
  await wait(80);
  const second = await A.evaluate(() => document.activeElement.querySelector('.mi-label')?.textContent);
  ok(second && second !== 'Text bearbeiten', 'Pfeiltaste wandert im Menü', second);
  const after = await get(A, 'n1');
  ok(after.x === before.x && after.y === before.y, 'Element dahinter bewegt sich nicht', [before.x, after.x]);
  await A.keyboard.press('Delete');
  await wait(150);
  ok(!!(await get(A, 'n1')), 'Entf im Menü löscht nichts');
  await A.keyboard.press('Home');
  await A.keyboard.press('Enter');
  await wait(300);
  ok(await core(A, (c) => c.app.editing?.id === 'n1'), 'Enter führt den Eintrag aus: Text bearbeiten', await core(A, (c) => c.app.editing));
  await core(A, (c) => c.finishEdit());
  await A.mouse.click(r.x, r.y, { button: 'right' });
  await wait(200);
  await A.keyboard.press('Escape');
  await wait(150);
  ok((await menu(A)).length === 0, 'Esc schließt');
  await A.mouse.click(r.x, r.y, { button: 'right' });
  await wait(200);
  await A.mouse.click(1000, 700);
  await wait(150);
  ok((await menu(A)).length === 0, 'Klick daneben schließt');
  await core(A, (c) => c.setSelection(['n1']));
  await A.evaluate(() => document.activeElement?.blur?.());
  await A.keyboard.down('Shift');
  await A.keyboard.press('F10');
  await A.keyboard.up('Shift');
  await wait(250);
  ok((await menu(A))[0] === 'Text bearbeiten', 'Umschalt+F10 öffnet es per Tastatur', await menu(A));
  await A.keyboard.press('Escape');

  console.log('=== Frame samt Inhalt löschen');
  await mk(A, 'frame', 'fr', { x: 800, y: 200, w: 300, h: 300, title: 'F' });
  await mk(A, 'sticky', 'inn', { x: 850, y: 250, w: 100, h: 100, text: 'drin' });
  await wait(300);
  await core(A, (c) => {
    c.setSelection(['fr']);
    c.deleteFramesWithContent();
  });
  await wait(300);
  ok(!(await get(A, 'fr')) && !(await get(A, 'inn')), 'Frame und Inhalt sind weg');
  ok(/2 Elemente gelöscht/.test(await toast(A)), 'Meldung nennt die Menge', await toast(A));
  ok(await A.evaluate(() => [...document.querySelectorAll('#toast button')].some((x) => x.textContent === 'Rückgängig')), 'Meldung hat Rückgängig');
  await A.evaluate(() => [...document.querySelectorAll('#toast button')].find((x) => x.textContent === 'Rückgängig').click());
  await wait(400);
  ok(!!(await get(A, 'fr')) && !!(await get(A, 'inn')), 'Rückgängig stellt alles wieder her');

  console.log('=== Befehlssuche bei 1280 px');
  await palette(A, true);
  const want = { notiz: /^Notiz/, einladen: /Personen einladen/, umfrage: /Umfrage/, verbinden: /Linie/, hilfe: /^Hilfe/, tastenkürzel: /Tastenkürzel/, pdf: /PDF/, retro: /Retro/, filter: /Filter/, exportieren: /PNG/, 'png': /PNG/ };
  for (const [q, re] of Object.entries(want)) {
    const list = await search(A, q);
    ok(list.some((x) => re.test(x)), `„${q}“ findet ${re}`, list.slice(0, 6));
  }
  const li = await search(A, 'notiz');
  ok(/^Notiz/.test(li[0]), 'Werkzeug steht vor Inhalten', li.slice(0, 4));
  await search(A, 'moderation');
  await A.evaluate(() => {
    const it = [...document.querySelectorAll('.palette-item')].find((x) => /^Moderation/.test(x.querySelector('.palette-label').textContent));
    it.click();
  });
  await wait(300);
  const pos = await A.evaluate(() => {
    const m = document.querySelector('.popover .menu');
    const r = m?.getBoundingClientRect();
    return r && { x: r.x, y: r.y };
  });
  ok(pos && pos.x > 100, 'Ausgeblendeter Knopf: Menü steht nicht in der Ecke', pos);
  await A.keyboard.press('Escape');
  await wait(150);
  await palette(V, true);
  for (const q of ['einladen', 'umfrage', 'notiz']) {
    const list = await search(V, q);
    ok(!list.some((x) => /Personen einladen|Umfrage …|^Notiz$/.test(x)), `Betrachter: „${q}“ bietet nichts an, was die Rolle nicht kann`, list.slice(0, 6));
  }
  ok((await search(V, 'pdf')).some((x) => /PDF/.test(x)), 'Betrachter dürfen exportieren');
  ok(!(await search(V, 'importieren')).some((x) => /Datei importieren/.test(x)), 'Betrachter importieren nicht');
  await palette(V, false);

  console.log('=== Hinweis zur Rolle');
  const vr = await center(V, 'n1');
  await V.mouse.click(vr.x, vr.y, { count: 2 });
  await wait(250);
  ok(/nur ansehen/.test(await toast(V)), 'Doppelklick: Betrachter erfahren, was geht', await toast(V));
  await V.evaluate(() => document.getElementById('toast').classList.remove('show'));
  await V.keyboard.press('n');
  await wait(200);
  ok((await toast(V)) === '', 'Der Hinweis kommt nur einmal', await toast(V));
  await C.keyboard.press('n');
  await wait(200);
  ok(/kommentieren/.test(await toast(C)), 'Taste N: Kommentierende bekommen ihren Hinweis', await toast(C));
  const { token } = (await api(A, 'POST', `/api/boards/${id}/guest-links`, { role: 'viewer', days: 1 })).body;
  const ctx = await b.createBrowserContext();
  const G = await ctx.newPage();
  await G.goto(BASE + '/login', { waitUntil: 'networkidle0' });
  const j = await api(G, 'POST', '/api/guest/join', { token, name: 'Gerd', consent: true });
  ok(j.status === 200, 'Gast beigetreten', j);
  await open(G, id);
  const c = await G.createCDPSession();
  await c.send('Emulation.setFocusEmulationEnabled', { enabled: true });
  await G.keyboard.press('n');
  await wait(250);
  ok(/Als Gast/.test(await toast(G)), 'Gäste bekommen ihren Hinweis', await toast(G));

  console.log('=== Benutzer anlegen ohne Mailserver');
  const Ad = await person(b, 'admin@test.example', 'Rotkehlchen-Wolke-47');
  await Ad.goto(BASE + '/admin', { waitUntil: 'networkidle0' });
  await wait(600);
  await Ad.evaluate(() => [...document.querySelectorAll('.nav-item, a, button')].find((x) => /^Benutzer$/.test(x.textContent.trim()))?.click());
  await wait(600);
  await Ad.evaluate(() => [...document.querySelectorAll('button')].find((x) => /Benutzer anlegen/.test(x.textContent))?.click());
  await wait(500);
  const form = await Ad.evaluate(() => {
    const m = document.querySelector('.modal-back');
    return m && { text: m.textContent, checked: m.querySelector('input[type=radio]:checked')?.parentElement.textContent, pw: !m.querySelector('input[type=password]').disabled };
  });
  ok(form && !/Einladung per E-Mail –/.test(form.text), 'Keine Mail-Einladung ohne Mailserver', form);
  ok(form && /Kennwort jetzt festlegen/.test(form.checked) && form.pw, 'Kennwort ist vorgewählt und eingebbar', form);

  ok(errs.length === 0, 'Keine Fehler in den Browsern', errs.slice(0, 5));
  await b.close();
  console.log(f ? 'FAIL ' + f : 'alles ok');
  process.exit(f ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
