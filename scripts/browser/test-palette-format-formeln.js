// Befehlspalette, Format übertragen, Formeln
const { launch, BASE, TMP, ctxMore } = require('./lib');
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
  if (r.status >= 300) throw new Error('login');
};
const el = (p, id) =>
  p.evaluate(async (id) => {
    const c = await import('/js/core.js');
    return JSON.parse(JSON.stringify(c.getEl(id) || null));
  }, id);
const cellText = (p, id) => p.evaluate((id) => [...document.querySelectorAll(`g[data-id="${id}"] text`)].map((t) => t.textContent), id);
const paletteOpen = (p) => p.evaluate(() => !!document.querySelector('.palette-list'));
const items = (p) => p.evaluate(() => [...document.querySelectorAll('.palette-item')].map((li) => li.textContent));
(async () => {
  const b = await launch();
  const errs = [];
  const A = await b.newPage();
  await login(A, 'admin@test.example', 'Rotkehlchen-Wolke-47');
  A.on('pageerror', (e) => errs.push('A ' + e.message));
  A.on('console', (m) => {
    if (m.type() === 'error' && !/Failed to load|ERR_/.test(m.text())) errs.push('A ' + m.text());
  });
  const email = 'f' + Date.now() + '@example.org';
  await api(A, 'POST', '/api/admin/users', { name: 'Fee', email, password: 'Gewitter-Laterne-83', role: 'user' });
  const c2 = await b.createBrowserContext();
  const B = await c2.newPage();
  await login(B, email, 'Gewitter-Laterne-83');
  B.on('pageerror', (e) => errs.push('B ' + e.message));
  for (const tr of ['', '?transport=poll']) {
    console.log('=== ' + (tr || 'SSE'));
    const id = (await api(A, 'POST', '/api/boards', { name: 'F' })).body.id;
    await api(A, 'POST', `/api/boards/${id}/members`, { email, role: 'editor' });
    await A.goto(BASE + '/board/' + id + tr, { waitUntil: 'load' });
    await B.goto(BASE + '/board/' + id + tr, { waitUntil: 'load' });
    await wait(1400);
    await A.bringToFront();
    // Tabelle
    await A.evaluate(async () => {
      const c = await import('/js/core.js');
      const t = c.makeElement('table', 0, 0);
      t.id = 't1';
      c.setEl(t);
      c.fitAll(false);
      c.setSelection(['t1']);
    });
    await wait(400);
    const t0 = await el(A, 't1');
    await A.evaluate(async () => {
      const c = await import('/js/core.js');
      const t = c.getEl('t1');
      c.tablePatch(t, {
        cells: [
          [0, 0, 'Name'],
          [0, 1, 'Wert'],
          [1, 0, 'a'],
          [1, 1, '10'],
          [2, 0, 'b'],
          [2, 1, '20,5'],
        ],
      });
    });
    await wait(300);
    // Eingabe mit Klick auf Zellen
    const pos = (r, c) =>
      A.evaluate(
        async (r, c) => {
          const co = await import('/js/core.js');
          const rd = await import('/js/render.js');
          const t = co.getEl('t1');
          const { xs, ys } = rd.tableLayout(t);
          return co.toScreen((xs[c] + xs[c + 1]) / 2, (ys[r] + ys[r + 1]) / 2);
        },
        r,
        c,
      );
    await A.evaluate(async () => {
      const c = await import('/js/core.js');
      c.startEdit('t1', { cell: [2, 2] });
    });
    await wait(200);
    await A.keyboard.type('=');
    await wait(250);
    const heads = await A.evaluate(() =>
      [...document.querySelectorAll('#stage text')].map((t) => t.textContent).filter((t) => /^[A-C]$|^[1-3]$/.test(t)),
    );
    ok(heads.includes('A') && heads.includes('B') && heads.includes('2'), 'Formelmodus zeigt Spalten- und Zeilennamen', heads.slice(0, 8));
    const a = await pos(1, 1),
      bb = await pos(2, 1);
    await A.mouse.move(a.x, a.y);
    await A.mouse.down();
    await A.mouse.up();
    await wait(150);
    ok(
      await A.evaluate(async () => {
        const c = await import('/js/core.js');
        return !!c.app.editing && document.activeElement.tagName === 'TEXTAREA' && document.activeElement.value === '=B2';
      }),
      'Klick fügt Bezug ein, Eingabe bleibt',
      await A.evaluate(() => document.activeElement.value),
    );
    await A.keyboard.type('*2+');
    await A.mouse.move(a.x, a.y);
    await A.mouse.down();
    await A.mouse.move(bb.x, bb.y, { steps: 4 });
    await A.mouse.up();
    await wait(150);
    ok(
      (await A.evaluate(() => document.activeElement.value)) === '=B2*2+B2:B3',
      'Ziehen fügt Bereich ein',
      await A.evaluate(() => document.activeElement.value),
    );
    await A.keyboard.down('Control');
    await A.keyboard.press('KeyA');
    await A.keyboard.up('Control');
    await A.keyboard.type('=SUMME(B2:B3)*2');
    await A.keyboard.press('Escape');
    await wait(400);
    let tx = await cellText(A, 't1');
    ok(tx.includes('61'), 'Ergebnis steht in der Zelle', tx);
    ok((await el(A, 't1')).cells[2][2] === '=SUMME(B2:B3)*2', 'gespeichert wird die Formel');
    await wait(400);
    ok((await cellText(B, 't1')).includes('61'), 'B sieht das Ergebnis');
    // Abschluss per Klick: nach vollständigem Bezug beendet ein Klick
    await A.evaluate(async () => {
      const c = await import('/js/core.js');
      c.startEdit('t1', { cell: [0, 2] });
    });
    await wait(150);
    await A.keyboard.type('=B2');
    await wait(100);
    const a2 = await pos(1, 0);
    await A.mouse.click(a2.x, a2.y);
    await wait(250);
    ok(
      await A.evaluate(async () => {
        const c = await import('/js/core.js');
        return !c.app.editing;
      }),
      'nach fertigem Bezug beendet ein Klick die Eingabe',
    );
    ok((await el(A, 't1')).cells[0][2] === '=B2', 'Formel unverändert');
    await A.evaluate(async () => {
      const c = await import('/js/core.js');
      c.tablePatch(c.getEl('t1'), { cells: [[0, 2, '']] });
    });
    await wait(200);
    // Tab in eine Formelzelle, Klick auf andere Zelle: Formel bleibt
    await A.evaluate(async () => {
      const c = await import('/js/core.js');
      c.startEdit('t1', { cell: [2, 1] });
    });
    await wait(150);
    await A.keyboard.press('Tab');
    await wait(200);
    const a3 = await pos(1, 0);
    await A.mouse.click(a3.x, a3.y);
    await wait(300);
    ok((await el(A, 't1')).cells[2][2] === '=SUMME(B2:B3)*2', 'Tab und Klick lassen die Formel unverändert', (await el(A, 't1')).cells[2]);
    await A.keyboard.press('Escape');
    await wait(120);
    // Zeile einfügen
    await A.evaluate(async () => {
      const c = await import('/js/core.js');
      c.act(() => c.tableStruct(c.getEl('t1'), { action: 'insertRows', at: 2, count: 1 }));
    });
    await wait(600);
    ok((await el(A, 't1')).cells[3][2] === '=SUMME(B2:B4)*2', 'Zeile einfügen: Bezug wächst', (await el(A, 't1')).cells[3][2]);
    ok((await el(B, 't1')).cells[3][2] === '=SUMME(B2:B4)*2', 'bei B ebenso');
    await A.evaluate(async () => {
      const c = await import('/js/core.js');
      c.undo();
    });
    await wait(500);
    ok((await el(A, 't1')).cells[2][2] === '=SUMME(B2:B3)*2', 'Rückgängig stellt die Formel her', (await el(A, 't1')).cells[2]);
    // Σ
    await A.evaluate(async () => {
      const c = await import('/js/core.js');
      c.app.cellSel = { id: 't1', r0: 1, c0: 1, r1: 2, c1: 1 };
      c.setSelection(['t1']);
      c.app.cellSel = { id: 't1', r0: 1, c0: 1, r1: 2, c1: 1 };
      c.tableAggregate('SUMME');
    });
    await wait(400);
    ok((await el(A, 't1')).cells[3][1] === '=SUMME(B2:B3)', 'Σ schreibt unter die Spalte', (await el(A, 't1')).cells[3]);
    await A.evaluate(async () => {
      const c = await import('/js/core.js');
      const t = c.getEl('t1');
      c.tablePatch(t, { cells: [[3, 1, '']] });
      c.app.cellSel = { id: 't1', r0: 3, c0: 1, r1: 3, c1: 1 };
      c.setSelection(['t1']);
      c.app.cellSel = { id: 't1', r0: 3, c0: 1, r1: 3, c1: 1 };
      c.tableAggregate('MITTELWERT');
    });
    await wait(400);
    ok(
      (await el(A, 't1')).cells[3][1] === '=MITTELWERT(B2:B3)',
      'Σ in leerer Zelle nimmt die Zahlen darüber',
      (await el(A, 't1')).cells[3],
    );
    // Diagramm
    const ch = await A.evaluate(async () => {
      const r = await import('/js/render.js');
      const c = await import('/js/core.js');
      const d = r.chartData(c.getEl('t1'));
      return d && d.series.map((s) => s.values);
    });
    ok(ch && ch.flat().some((v) => Math.abs(v - 61) < 1e-9), 'Diagramm nutzt berechnete Werte', ch);
    // Formatpinsel
    await A.evaluate(async () => {
      const c = await import('/js/core.js');
      const s = c.makeElement('shape', 800, 0, { fill: '#ff0000', stroke: '#00ff00', strokeWidth: 5, textColor: '#0000ff', bold: true });
      s.id = 's1';
      s.text = 'A';
      c.setEl(s);
      const n = c.makeElement('sticky', 800, 300);
      n.id = 'n1';
      n.text = 'B';
      c.setEl(n);
      const x = c.makeElement('text', 1100, 300);
      x.id = 'x1';
      x.text = 'C';
      c.setEl(x);
      const k = c.makeElement('card', 1100, 0);
      k.id = 'k1';
      c.setEl(k);
      const l = c.makeElement('sticky', 1400, 300);
      l.id = 'l1';
      l.locked = true;
      c.setEl(l);
      c.fitAll(false);
      c.setSelection(['s1']);
    });
    await wait(500);
    const sc = (id) =>
      A.evaluate(async (id) => {
        const c = await import('/js/core.js');
        const e = c.getEl(id);
        return c.toScreen(e.x + e.w / 2, e.y + e.h / 2);
      }, id);
    await ctxMore(A, 'Format übertragen');
    await wait(200);
    ok(!!(await A.$('#ctxbar [title^="Format übertragen beenden"]')), 'Pinsel zeigt sich in der Kontextleiste, solange er läuft');
    ok(await A.evaluate(() => document.getElementById('stage').dataset.brush === '1'), 'Pinsel aktiv');
    let p = await sc('n1');
    await A.mouse.click(p.x, p.y);
    await wait(300);
    let e = await el(A, 'n1');
    ok(e.fill === '#ff0000' && e.bold === true && e.text === 'B', 'Notiz übernimmt Farbe und Schrift, Text bleibt', e);
    ok(await A.evaluate(() => !document.getElementById('stage').dataset.brush), 'Pinsel endet nach einem Klick');
    await A.evaluate(async () => {
      const c = await import('/js/core.js');
      c.setSelection(['s1']);
      c.startBrush(true);
    });
    await wait(150);
    p = await sc('x1');
    await A.mouse.click(p.x, p.y);
    await wait(200);
    p = await sc('k1');
    await A.mouse.click(p.x, p.y);
    await wait(200);
    e = await el(A, 'x1');
    ok(e.color === '#0000ff' && e.fill === '#ff0000', 'Text: Textfarbe und Fläche', e);
    e = await el(A, 'k1');
    ok(e.color === '#ff0000', 'Karte: Fläche wird Kartenfarbe', e);
    p = await sc('l1');
    await A.mouse.click(p.x, p.y);
    await wait(200);
    e = await el(A, 'l1');
    ok(e.fill !== '#ff0000', 'gesperrtes Element bleibt', e.fill);
    await A.keyboard.press('Escape');
    await wait(100);
    ok(await A.evaluate(() => !document.getElementById('stage').dataset.brush), 'Esc beendet den gehaltenen Pinsel');
    await A.evaluate(async () => {
      const c = await import('/js/core.js');
      c.undo();
    });
    await wait(250);
    e = await el(A, 'k1');
    ok(e.color !== '#ff0000', 'Übertragen ist rückgängig machbar', e.color);
    // Doppelklick auf den Pinsel hält ihn; Esc bei aktiver Zellauswahl beendet sofort
    await A.evaluate(async () => {
      const c = await import('/js/core.js');
      c.setSelection(['s1']);
    });
    await wait(250);
    await ctxMore(A, 'Format mehrfach übertragen');
    await wait(150);
    ok(
      await A.evaluate(async () => {
        const c = await import('/js/core.js');
        return c.app.brushing && c.app.brushHold;
      }),
      'Doppelklick hält den Pinsel',
    );
    await A.evaluate(async () => {
      const c = await import('/js/core.js');
      c.app.cellSel = { id: 't1', r0: 0, c0: 0, r1: 0, c1: 0 };
    });
    await A.keyboard.press('Escape');
    await wait(120);
    ok(
      await A.evaluate(async () => {
        const c = await import('/js/core.js');
        c.app.cellSel = null;
        return !c.app.brushing;
      }),
      'Esc beendet den Pinsel sofort',
    );
    // Text ohne Hintergrund nimmt der Notiz nicht die Farbe
    await A.evaluate(async () => {
      const c = await import('/js/core.js');
      const t = c.makeElement('text', 2000, 0);
      t.id = 'x2';
      t.text = 'Y';
      c.setEl(t);
      c.updateEl('n1', { fill: '#00ff00' });
      c.setSelection(['x2']);
      c.copyFormat();
      c.setSelection(['n1']);
      c.pasteFormat();
    });
    await wait(200);
    ok((await el(A, 'n1')).fill === '#00ff00', 'Fläche bleibt bei Quelle ohne Farbe', (await el(A, 'n1')).fill);
    await A.evaluate(async () => {
      const c = await import('/js/core.js');
      c.updateEl('n1', { fill: '#ff0000' });
      c.setSelection(['s1']);
      c.deleteEl('x2');
    });
    await wait(120);
    // Tastatur
    await A.evaluate(async () => {
      const c = await import('/js/core.js');
      c.setSelection(['n1']);
    });
    await wait(100);
    await A.keyboard.down('Control');
    await A.keyboard.down('Alt');
    await A.keyboard.press('KeyC');
    await A.keyboard.up('Alt');
    await A.keyboard.up('Control');
    await A.evaluate(async () => {
      const c = await import('/js/core.js');
      c.updateEl('k1', { color: '#123456' });
      c.setSelection(['k1']);
    });
    await wait(100);
    await A.keyboard.down('Control');
    await A.keyboard.down('Alt');
    await A.keyboard.press('KeyV');
    await A.keyboard.up('Alt');
    await A.keyboard.up('Control');
    await wait(250);
    ok((await el(A, 'k1')).color === '#ff0000', 'Strg+Alt+C/V', (await el(A, 'k1')).color);
    ok((await el(B, 'k1')).color === '#ff0000', 'Format kommt bei B an');
    // Palette
    await A.evaluate(async () => {
      const c = await import('/js/core.js');
      c.setSelection(['s1']);
    });
    await A.mouse.move(600, 700);
    await wait(150);
    await A.keyboard.down('Control');
    await A.keyboard.press('KeyK');
    await A.keyboard.up('Control');
    await wait(350);
    ok(await paletteOpen(A), 'Strg+K öffnet die Palette');
    ok(
      await A.evaluate(() => {
        const i = document.querySelector('.palette-input');
        return document.activeElement === i && i.getAttribute('role') === 'combobox' && !!i.getAttribute('aria-activedescendant');
      }),
      'Fokus und Bildschirmleser-Rollen',
    );
    if (!tr) await A.screenshot({ path: S + 'palette.png' });
    await A.type('.palette-input', 'stcky'.replace('stc', 'stic'));
    await wait(250);
    let it = await items(A);
    ok(
      it.some((x) => /^Notiz/.test(x)),
      'Suche findet Werkzeug',
      it.slice(0, 4),
    );
    await A.evaluate(() => {
      const i = document.querySelector('.palette-input');
      i.value = 'retro mad';
      i.dispatchEvent(new Event('input'));
    });
    await wait(200);
    it = await items(A);
    ok(/Mad/.test(it[0] || ''), 'Vorlage per Suche', it.slice(0, 3));
    await A.evaluate(() => {
      const i = document.querySelector('.palette-input');
      i.value = 'duplizieren';
      i.dispatchEvent(new Event('input'));
    });
    await wait(200);
    const before = await A.evaluate(async () => {
      const c = await import('/js/core.js');
      return c.app.els.size;
    });
    await A.keyboard.press('Enter');
    await wait(450);
    ok(
      (await A.evaluate(async () => {
        const c = await import('/js/core.js');
        return c.app.els.size;
      })) ===
        before + 1,
      'Enter führt aus (Duplizieren)',
    );
    ok(!(await paletteOpen(A)), 'Palette schließt danach');
    await A.keyboard.down('Control');
    await A.keyboard.press('KeyK');
    await A.keyboard.up('Control');
    await wait(300);
    ok(/Duplizieren/.test((await items(A))[0] || ''), 'zuletzt Benutztes steht oben', (await items(A)).slice(0, 2));
    await A.evaluate(() => {
      const i = document.querySelector('.palette-input');
      i.value = 'zzzqq';
      i.dispatchEvent(new Event('input'));
    });
    await wait(150);
    await A.keyboard.press('Enter');
    await wait(150);
    ok(await paletteOpen(A), 'nichts gefunden: Enter tut nichts');
    await A.keyboard.press('Escape');
    await wait(200);
    ok(!(await paletteOpen(A)), 'Esc schließt');
    await A.evaluate(() => {
      const b = [...document.querySelectorAll('#topbar button')].find((x) => /Befehle/.test(x.getAttribute('aria-label')));
      b.click();
    });
    await wait(250);
    ok(await paletteOpen(A), 'Schaltfläche öffnet die Palette');
    await A.keyboard.press('Escape');
    await wait(150);
    // Rechte: Betrachter
    const rr = await api(A, 'PATCH', `/api/boards/${id}/members/${encodeURIComponent(email)}`, { role: 'viewer' });
    if (rr.status >= 300) await api(A, 'POST', `/api/boards/${id}/members`, { email, role: 'viewer' });
    await wait(1800);
    await B.reload({ waitUntil: 'load' }).catch(() => {});
    await wait(2500);
    await B.bringToFront();
    await B.evaluate(async () => {
      const c = await import('/js/core.js');
      c.app.emit('openPalette');
    });
    await wait(300);
    await B.evaluate(() => {
      const i = document.querySelector('.palette-input');
      i.value = 'retro mad';
      i.dispatchEvent(new Event('input'));
    });
    await wait(250);
    const vi = await items(B);
    ok((await paletteOpen(B)) && !vi.some((x) => /Mad/.test(x)), 'Betrachter: keine Vorlagen', vi.slice(0, 4));
    await B.evaluate(() => {
      const i = document.querySelector('.palette-input');
      i.value = 'sticky';
      i.dispatchEvent(new Event('input'));
    });
    await wait(250);
    ok(
      !(await items(B)).some((x) => /Notiz/.test(x) && /\(N\)|Werkzeug/.test(x)),
      'Betrachter: keine Bearbeitungswerkzeuge',
      (await items(B)).slice(0, 4),
    );
    await B.keyboard.press('Escape');
    await A.bringToFront();
  }
  ok(errs.length === 0, 'keine Browserfehler', errs.slice(0, 5));
  await b.close();
  console.log('Fehlschläge:', f);
  process.exit(f ? 1 : 0);
})().catch((e) => {
  console.error('ABBRUCH', e);
  process.exit(2);
});
