// Einstieg und Orientierung
const { launch, BASE, TMP } = require('./lib');
let f = 0;
const ok = (c, m, x) => {
  console.log((c ? 'ok  ' : 'FAIL') + ' ' + m + (c || x === undefined ? '' : ' → ' + JSON.stringify(x).slice(0, 240)));
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
  if (r.status >= 300) throw new Error('login');
};
const vis = (p) =>
  p.evaluate(() => {
    const e = document.getElementById('empty-start');
    return !!e && !e.classList.contains('hidden');
  });
const toastT = (p) =>
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
  const email = 'g' + Date.now() + '@example.org';
  await api(A, 'POST', '/api/admin/users', { name: 'Gert', email, password: 'Gewitter-Laterne-83', role: 'user' });
  const c2 = await b.createBrowserContext();
  const B = await c2.newPage();
  await login(B, email, 'Gewitter-Laterne-83');
  B.on('pageerror', (e) => errs.push('B ' + e.message));
  for (const tr of ['', '?transport=poll']) {
    console.log('=== ' + (tr || 'SSE'));
    const id = (await api(A, 'POST', '/api/boards', { name: 'E' })).body.id;
    await api(A, 'POST', `/api/boards/${id}/members`, { email, role: 'viewer' });
    await A.evaluate(() => localStorage.clear());
    await A.goto(BASE + '/board/' + id + tr, { waitUntil: 'load' });
    await B.goto(BASE + '/board/' + id + tr, { waitUntil: 'load' });
    await wait(1400);
    await A.bringToFront();
    ok(await vis(A), 'leeres Board zeigt den Einstieg');
    ok(!(await vis(B)), 'Betrachter sehen ihn nicht');
    if (!tr) await A.screenshot({ path: S + 'start.png' });
    const n = await A.evaluate(() => document.querySelectorAll('#empty-start .empty-choice').length);
    ok(n === 3, 'drei Möglichkeiten für Besitzer', n);
    await A.evaluate(() => document.querySelector('#empty-start .empty-choice').click());
    await wait(400);
    ok(
      await A.evaluate(async () => {
        const c = await import('/js/core.js');
        return c.app.els.size === 1 && !!c.app.editing;
      }),
      'Notiz angelegt, Eingabe offen',
    );
    ok(!(await vis(A)), 'Einstieg verschwindet');
    if (!tr) ok(/Tab legt/.test(await toastT(A)), 'Hinweis zu Tab', await toastT(A));
    await A.keyboard.type('Hallo');
    await A.keyboard.press('Escape');
    await wait(300);
    await A.evaluate(async () => {
      const c = await import('/js/core.js');
      c.deleteEls([...c.app.els.keys()]);
    });
    await wait(400);
    ok(await vis(A), 'leer gewordenes Board zeigt ihn wieder');
    await A.keyboard.press('n');
    await wait(200);
    ok(!(await vis(A)), 'Werkzeug gewählt: Einstieg verdeckt die Zeichenfläche nicht');
    await A.keyboard.press('Escape');
    await wait(200);
    await A.keyboard.press('Escape');
    await wait(200);
    ok(await vis(A), 'Auswahlwerkzeug: Einstieg wieder da');
    await A.evaluate(() => document.getElementById('empty-start').dispatchEvent(new DragEvent('dragenter', { bubbles: true })));
    await wait(200);
    ok(!(await vis(A)), 'Datei hereinziehen schließt den Einstieg');
    await A.evaluate(async () => {
      const c = await import('/js/core.js');
      const f = c.makeElement('frame', 0, 0);
      f.title = 'Abschnitt';
      f.w = 600;
      f.h = 400;
      c.setEl(f);
      const t = c.makeElement('text', 2000, 2000);
      t.text = 'Große Überschrift';
      t.fontSize = 44;
      c.setEl(t);
      const s = c.makeElement('text', 2000, 2300);
      s.text = 'klein';
      s.fontSize = 16;
      c.setEl(s);
      const k = c.makeElement('card', 0, 800);
      k.title = 'K1';
      k.status = 'Offen';
      c.setEl(k);
      const k2 = c.makeElement('card', 0, 1000);
      k2.title = 'K2';
      k2.status = 'Fertig';
      c.setEl(k2);
      c.fitAll(false);
    });
    await wait(400);
    await A.evaluate(async () => {
      const u = await import('/js/ui.js');
      u.showSidePanel('frames');
    });
    await wait(350);
    const pan = await A.evaluate(() => document.getElementById('sidepanel').textContent);
    ok(/Große Überschrift/.test(pan) && !/klein/.test(pan), 'Gliederung zeigt große Texte', pan.slice(0, 160));
    if (!tr) await A.screenshot({ path: S + 'outline.png' });
    const before = await A.evaluate(async () => {
      const c = await import('/js/core.js');
      return { ...c.app.view };
    });
    await A.evaluate(() => [...document.querySelectorAll('#sidepanel .outline-link')].find((x) => /Große/.test(x.textContent)).click());
    await wait(600);
    ok(
      await A.evaluate(async (v) => {
        const c = await import('/js/core.js');
        return c.app.view.x !== v.x;
      }, before),
      'Klick springt zur Überschrift',
    );
    // Ansicht merken
    await A.evaluate(() =>
      [...document.querySelectorAll('#sidepanel button')].find((x) => /Aktuelle Ansicht merken/.test(x.textContent)).click(),
    );
    await wait(300);
    await A.keyboard.down('Control');
    await A.keyboard.press('KeyA');
    await A.keyboard.up('Control');
    await A.keyboard.type('Oben links');
    await A.keyboard.press('Enter');
    await wait(400);
    ok(await A.evaluate(() => /Oben links/.test(document.getElementById('sidepanel').textContent)), 'Ansicht steht in der Liste');
    const names = await A.evaluate(async () => {
      const g = await import('/js/guide.js');
      const c = await import('/js/core.js');
      const k = 'views.' + c.app.boardId;
      const u = await import('/js/util.js');
      u.savePref(k, [{ name: 'Ansicht 2', rect: { x: 0, y: 0, w: 1, h: 1 } }]);
      const p = g.saveCurrentView();
      await new Promise((r) => setTimeout(r, 200));
      const v = document.querySelector('.modal input').value;
      document.querySelector('.modal .btn.primary').click();
      await p;
      return { v, l: g.savedViews().map((x) => x.name) };
    });
    ok(names.v === 'Ansicht 3' && names.l.join() === 'Ansicht 2,Ansicht 3', 'Vorschlag trifft keine bestehende Ansicht', names);
    await A.evaluate(async () => {
      const c = await import('/js/core.js');
      const u = await import('/js/util.js');
      u.savePref('views.' + c.app.boardId, [{ name: 'Oben links', rect: c.visibleRect() }]);
      const ui = await import('/js/ui.js');
      ui.renderSidePanel();
    });
    await wait(200);
    const saved = await A.evaluate(async () => {
      const c = await import('/js/core.js');
      return { ...c.app.view };
    });
    await A.evaluate(async () => {
      const c = await import('/js/core.js');
      c.fitAll(false);
      c.setSelection([]);
    });
    await wait(500);
    await A.mouse.click(900, 700);
    await wait(100);
    await A.keyboard.down('Alt');
    await A.keyboard.press('Digit1');
    await A.keyboard.up('Alt');
    await wait(600);
    const now = await A.evaluate(async () => {
      const c = await import('/js/core.js');
      return { ...c.app.view };
    });
    ok(Math.abs(now.z - saved.z) < 0.05 * saved.z, 'Alt+1 springt zurück', { now, saved });
    await A.keyboard.down('Control');
    await A.keyboard.press('KeyK');
    await A.keyboard.up('Control');
    await wait(250);
    await A.type('.palette-input', 'oben');
    await wait(200);
    ok(
      (await A.evaluate(() => [...document.querySelectorAll('.palette-item')].map((x) => x.textContent))).some((x) => /Oben links/.test(x)),
      'Palette findet die Ansicht',
    );
    await A.keyboard.press('Escape');
    await wait(200);
    await A.evaluate(() => [...document.querySelectorAll('#sidepanel .outline-item .icon-btn')][0].click());
    await wait(250);
    ok(await A.evaluate(() => !/Oben links/.test(document.getElementById('sidepanel').textContent)), 'Ansicht entfernen');
    // Status-Filter
    await A.evaluate(async () => {
      const u = await import('/js/ui.js');
      u.showSidePanel('filter');
    });
    await wait(300);
    await A.evaluate(() => [...document.querySelectorAll('#sidepanel .tag-chip')].find((x) => x.textContent === 'Offen').click());
    await wait(300);
    const d = await A.evaluate(() => ({
      dim: [...document.querySelectorAll('g.el-card')].filter((g) => g.classList.contains('dimmed')).length,
      all: document.querySelectorAll('g.el-card').length,
      b: document.getElementById('filter-banner').textContent,
    }));
    ok(d.dim === 1 && d.all === 2, 'Statusfilter blendet die andere Karte ab', d);
    await A.evaluate(() => [...document.querySelectorAll('#filter-banner button')].pop().click());
    await wait(200);
  }
  // Große Boards: Ausblenden, ohne dass etwas fehlt
  console.log('=== Ausblenden');
  const id = (await api(A, 'POST', '/api/boards', { name: 'Gross' })).body.id;
  await A.goto(BASE + '/board/' + id, { waitUntil: 'load' });
  await wait(1200);
  await A.evaluate(async () => {
    const c = await import('/js/core.js');
    c.act(() => {
      for (let i = 0; i < 400; i++) {
        const s = c.makeElement('sticky', (i % 20) * 300, Math.floor(i / 20) * 300);
        s.id = 'z' + i;
        s.text = 'N' + i;
        c.setEl(s);
      }
    });
    c.fitTo(c.bounds(c.getEl('z0')), { maxZ: 1, pad: 300, animate: false });
  });
  await wait(800);
  const st = () =>
    A.evaluate(() => {
      const g = [...document.querySelectorAll('#stage g[data-id]')];
      return { all: g.length, on: g.filter((x) => x.style.display !== 'none').length };
    });
  let v = await st();
  ok(v.all === 400 && v.on < 200 && v.on > 0, 'weit Entferntes ist ausgeblendet, Knoten bleiben', v);
  await A.evaluate(async () => {
    const c = await import('/js/core.js');
    c.fitAll(false);
  });
  await wait(800);
  v = await st();
  ok(v.on === 400, 'herausgezoomt alles sichtbar', v);
  await A.evaluate(async () => {
    const c = await import('/js/core.js');
    c.fitTo(c.bounds(c.getEl('z399')), { maxZ: 1, pad: 300, animate: false });
  });
  await wait(600);
  ok(
    await A.evaluate(
      () =>
        document.querySelector('#stage g[data-id="z399"]').style.display !== 'none' &&
        document.querySelector('#stage g[data-id="z0"]').style.display === 'none',
    ),
    'Sprung zeigt das Ziel',
  );
  // neues Element bleibt sichtbar, verschobenes aus der Ferne erscheint
  await A.evaluate(async () => {
    const c = await import('/js/core.js');
    const v = c.visibleRect();
    c.updateEl('z0', { x: v.x + 100, y: v.y + 100 });
    const n = c.makeElement('sticky', v.x + 400, v.y + 100);
    n.id = 'new1';
    c.setEl(n);
  });
  await wait(400);
  ok(
    await A.evaluate(
      () =>
        document.querySelector('#stage g[data-id="z0"]').style.display !== 'none' &&
        document.querySelector('#stage g[data-id="new1"]').style.display !== 'none',
    ),
    'Verschobenes und Neues erscheinen sofort',
  );
  const ex = await A.evaluate(async () => {
    const c = await import('/js/core.js');
    const e = await import('/js/exporter.js');
    const r = await import('/js/render.js');
    const s = e.svgString ? e.svgString([...c.app.els.values()]) : '';
    return { ok: typeof s === 'string' && /N1\b/.test(s) && /N200/.test(s), n: s.length };
  }).catch((e) => ({ err: e.message }));
  ok(ex.ok, 'Export enthält auch ausgeblendete Elemente', ex);
  ok(errs.length === 0, 'keine Browserfehler', errs.slice(0, 4));
  await b.close();
  console.log('Fehlschläge:', f);
  process.exit(f ? 1 : 0);
})().catch((e) => {
  console.error('ABBRUCH', e);
  process.exit(2);
});
