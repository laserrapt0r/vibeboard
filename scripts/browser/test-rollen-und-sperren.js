// Hinweise, Rollen und Sperren
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
  const url = await ev(A, () => location.href);
  const idOf = (p) => p.url().split('/board/')[1].split('#')[0];
  let id = await open();
  await ev(A, async () => {
    const c = await import('/js/core.js');
    const s = c.makeElement('sticky', 0, 0);
    s.id = 's';
    s.text = 'Hallo';
    c.setEl(s);
    const s2 = c.makeElement('sticky', 300, 0);
    s2.id = 's2';
    c.setEl(s2);
  });
  await wait(500);
  console.log('=== Moderation');
  await ev(B, async () => {});
  await ev(A, async () => {
    (await import('/js/moderation.js')).setModeration({ active: true, editLock: true });
  });
  await wait(900);
  const lk = await ev(B, async () => {
    const c = await import('/js/core.js');
    return {
      locked: document.body.classList.contains('edit-locked'),
      ro: document.getElementById('board-name').readOnly,
      view: c.app.viewOnly,
    };
  });
  ok(lk.locked && lk.ro, 'Sperre macht den Boardnamen schreibgeschützt', lk);
  await ev(B, async () => {
    const c = await import('/js/core.js');
    c.undo();
  });
  await wait(150);
  ok(/gesperrt/.test(await toast(B)), 'Rückgängig meldet die Sperre', await toast(B));
  await ev(B, async () => {
    const c = await import('/js/core.js');
    c.setSelection(['s', 's2']);
    c.groupSel();
  });
  await wait(150);
  ok(!/Gruppiert/.test(await toast(B)), 'Gruppieren täuscht unter Sperre nichts vor');
  await ev(B, async () => {
    const u = await import('/js/ui.js');
    u.openTemplates();
  });
  await wait(150);
  ok(/gesperrt/.test(await toast(B)), 'Vorlagen melden die Sperre');
  await ev(A, async () => {
    (await import('/js/moderation.js')).setModeration({ active: false });
  });
  await wait(900);
  ok(await ev(B, () => !document.getElementById('board-name').readOnly), 'Nach der Sperre wieder änderbar');
  console.log('=== Rollen');
  await V.goto(BASE + '/board/' + id, { waitUntil: 'load' });
  await wait(1300);
  const cm = await ev(V, async () => {
    const u = await import('/js/ui.js');
    const c = await import('/js/core.js');
    return { view: c.app.viewOnly, role: c.app.role };
  });
  ok(cm.view, 'zweite Person ist nur Betrachter/Kommentator', cm);
  await ev(V, async () => {
    const u = await import('/js/ui.js');
    u.showSidePanel('comments');
  });
  await wait(300);
  const cp = await ev(V, () => document.querySelector('#side-panel, .side-panel, #sidepanel')?.textContent || '');
  console.log('info Panel:', cp.slice(0, 120));
  ok(
    !/Mit dem Kom/.test(cp) || (await ev(V, async () => (await import('/js/core.js')).app.canComment)),
    'kein Werkzeughinweis ohne Kommentierrecht',
  );
  await ev(V, async () => {
    const c = await import('/js/core.js');
    c.undo();
  });
  await wait(150);
  ok(!/gesperrt/.test(await toast(V)), 'Betrachter bekommen keine falsche Sperrmeldung', await toast(V));
  console.log('=== Präsentation');
  await ev(A, async () => {
    const c = await import('/js/core.js');
    const f = c.makeElement('frame', 0, 2000);
    f.id = 'f1';
    c.setEl(f);
  });
  await wait(300);
  await ev(A, async () => {
    (await import('/js/core.js')).app.emit('present', null);
  });
  await wait(600);
  ok(await ev(A, () => document.body.classList.contains('presenting')), 'Präsentation läuft');
  const nA = (await all(A)).length;
  const tool0 = await ev(A, async () => (await import('/js/core.js')).app.tool);
  await A.keyboard.press('n');
  await wait(150);
  await A.keyboard.press('t');
  await wait(150);
  ok(
    (await ev(A, async () => (await import('/js/core.js')).app.tool)) === tool0 && (await all(A)).length === nA,
    'Buchstaben wechseln im Vortrag kein Werkzeug',
  );
  await A.keyboard.press('Escape');
  await wait(400);
  ok(await ev(A, () => !document.body.classList.contains('presenting')), 'Esc beendet');
  console.log('=== Abstimmung');
  await ev(A, async () => {
    document.getElementById('stage').classList.add('voting');
  });
  const sb = await ev(A, () => {
    const g = document.querySelector('g[data-id="s"]').getBoundingClientRect();
    return { x: g.x + g.width / 2, y: g.y + g.height / 2 };
  });
  await ev(A, async () => {
    const c = await import('/js/core.js');
    c.app.dummy = 0;
    const g = document.querySelector('g[data-id="s"]');
    g.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, clientX: 0, clientY: 0 }));
  });
  await wait(200);
  ok(await ev(A, async () => !(await import('/js/core.js')).app.editing), 'Doppelklick öffnet beim Abstimmen keinen Editor');
  await ev(A, () => document.getElementById('stage').classList.remove('voting'));
  console.log('=== Rückgängig');
  await ev(A, async () => {
    const c = await import('/js/core.js');
    c.app.emit('closeAll');
  });
  await A.keyboard.press('Escape');
  await A.keyboard.press('n');
  await wait(150);
  await A.mouse.click(900, 600);
  await wait(350);
  await A.keyboard.type('Neu');
  await A.mouse.click(100, 700);
  await wait(300);
  const nz = (await all(A)).filter((e) => e.text === 'Neu');
  ok(nz.length === 1, 'Notiz angelegt', nz.length);
  await ev(A, async () => {
    (await import('/js/core.js')).undo();
  });
  await wait(300);
  ok(!(await all(A)).some((e) => e.id === (nz[0] || {}).id), 'ein Rückgängig entfernt Notiz samt Text');
  console.log('=== Suche und Texte');
  await ev(A, async () => {
    const c = await import('/js/core.js');
    const t = c.makeElement('table', 0, 600);
    t.id = 'tb';
    t.cells = [
      ['2', '3'],
      ['=A1+B1', ''],
    ];
    c.setEl(t);
    const d = c.makeElement('file', 800, 600);
    d.id = 'd1';
    d.name = 'bericht-q3.pdf';
    c.setEl(d);
  });
  await wait(300);
  const st = await ev(A, async () => {
    const u = await import('/js/ui.js');
    const c = await import('/js/core.js');
    return { t: u.elementText(c.getEl('tb')), d: u.elementText(c.getEl('d1')) };
  });
  ok(/\b5\b/.test(st.t), 'Suche kennt Formelergebnisse', st.t);
  ok(/bericht-q3/.test(st.d), 'Suche kennt Dateinamen', st.d);
  await ev(A, async () => {
    const c = await import('/js/core.js');
    const h = c.makeElement('chart', 0, 1000);
    h.id = 'ch';
    h.sourceId = 'weg';
    c.setEl(h);
  });
  await wait(300);
  ok(/fehlt/.test(await ev(A, () => document.querySelector('g[data-id="ch"]')?.textContent || '')), 'Diagramm nennt die fehlende Tabelle');
  await ev(A, async () => {
    const c = await import('/js/core.js');
    c.setSelection(['s']);
  });
  const lnk = await ev(A, async () => {
    const c = await import('/js/core.js');
    const r = document.querySelector('g[data-id="s"]').getBoundingClientRect();
    document
      .querySelector('g[data-id="s"]')
      .dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: r.x + 5, clientY: r.y + 5 }));
    await new Promise((r) => setTimeout(r, 200));
    const l = [...document.querySelectorAll('.menu button, [role=menuitem]')].map((x) => x.textContent);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    return l;
  });
  ok(
    lnk.some((x) => /Link zu diesem Element/.test(x)),
    'Kontextmenü: Link zum Element',
    lnk.slice(0, 20),
  );
  await A.keyboard.press('Escape');
  const sh = await ev(A, async () => {
    (await import('/js/ui.js')).openShortcuts();
    await new Promise((r) => setTimeout(r, 200));
    const t = document.querySelector('.shortcuts').textContent;
    document.querySelector('.modal-close, .modal .close')?.click();
    return t;
  });
  ok(/Nächste Folie/.test(sh) && /Diese Übersicht/.test(sh), 'Kürzelübersicht ergänzt');
  await A.keyboard.press('Escape');
  console.log('=== Seiten');
  const T = await b.createBrowserContext();
  const Z = await T.newPage();
  const r1 = await Z.goto(BASE + '/g/kurz', { waitUntil: 'networkidle0' });
  ok(
    r1.status() === 200 && /nicht gültig/.test(await ev(Z, () => document.body.textContent)),
    'Abgeschnittener Gastlink erklärt sich',
    await ev(Z, () => document.body.textContent.slice(0, 200)),
  );
  const r2 = await Z.goto(BASE + '/gibtsnicht', { waitUntil: 'networkidle0' });
  ok(
    r2.status() === 404 && /Seite nicht gefunden/.test(await ev(Z, () => document.body.textContent)),
    'Unbekannte Seite: erklärend mit 404',
    r2.status(),
  );
  const r3 = await fetch(BASE + '/js/gibtsnicht.js');
  ok(r3.status === 404 && /text\/plain/.test(r3.headers.get('content-type')), 'Fehlende Datei bleibt schlicht');
  const r4 = await fetch(BASE + '/board/x/y');
  ok(r4.status === 404, 'Tiefer Pfad 404');
  await Z.goto(BASE + '/offline.html', { waitUntil: 'load' });
  await wait(300);
  ok((await ev(Z, () => document.getElementById('retry').getAttribute('href'))) === '/', 'Offline-Seite: Zurück zum Start');
  const src = await (await fetch(BASE + '/js/auth.js')).text();
  const pat = src.match(/pattern: '(\[0-9a-zA-Z[^']*)'/)[1].replace(/\\\\/g, '\\');
  await Z.goto(BASE + '/login', { waitUntil: 'load' });
  ok(
    await ev(
      Z,
      (pat) => {
        const i = document.createElement('input');
        i.pattern = pat;
        i.value = '!!';
        const bad = i.validity.patternMismatch;
        i.value = 'ab12-cd34';
        return bad && !i.validity.patternMismatch;
      },
      pat,
    ),
    '2FA-Muster greift im Browser',
    pat,
  );
  console.log('=== Palette');
  await ev(A, async () => {
    const c = await import('/js/core.js');
    c.app.emit('openPalette');
  });
  await wait(300);
  console.log('Fehler:', errs.length ? errs.slice(0, 5) : 'keine');
  ok(errs.length === 0, 'keine Seitenfehler', errs.slice(0, 3));
  await b.close();
  console.log(f ? 'FAIL ' + f : 'ALLES OK');
  process.exit(f ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
