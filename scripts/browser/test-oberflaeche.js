// Aufgeräumte Oberfläche: Kopfzeile, Menüs, Kontextleiste, Werkzeugleiste, Begriffe, Tooltips und Befehlssuche
const { launch, BASE, pickMenu, boardMenu, ctxMore } = require('./lib');
let f = 0;
const ok = (c, m, x) => {
  console.log((c ? 'ok  ' : 'FAIL') + ' ' + m + (c || x === undefined ? '' : ' → ' + JSON.stringify(x).slice(0, 260)));
  if (!c) f++;
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
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
const open = async (p, id) => {
  await p.goto(BASE + '/board/' + id, { waitUntil: 'load' });
  await wait(1200);
};
const labels = (p) => p.evaluate(() => [...document.querySelectorAll('.popover .mi-label')].map((x) => x.textContent));
const heads = (p) => p.evaluate(() => [...document.querySelectorAll('.popover .menu-header')].map((x) => x.textContent));
const openMenu = async (p, sel) => {
  await p.evaluate((s) => document.querySelector(s).click(), sel);
  await wait(200);
};
const esc = async (p) => {
  await p.keyboard.press('Escape');
  await wait(120);
};
const toast = (p) => p.evaluate(() => document.getElementById('toast')?.textContent || '');
const visible = (p, sel) =>
  p.evaluate((s) => {
    const b = document.querySelector(s);
    if (!b) return false;
    const r = b.getBoundingClientRect();
    if (!r.width || r.right > innerWidth || r.left < 0) return false;
    return b.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
  }, sel);
const selectEls = (p, ids) =>
  p.evaluate(async (ids) => {
    (await import('/js/core.js')).setSelection(ids);
  }, ids);
const ctxTitles = (p) => p.evaluate(() => [...document.querySelectorAll('#ctxbar .ctx-row:first-child button')].map((b) => b.title));
const palette = async (p, q) => {
  await p.keyboard.down('Control');
  await p.keyboard.press('k');
  await p.keyboard.up('Control');
  await wait(250);
  await p.type('.palette-input', q);
  await wait(250);
  const list = await p.$$eval('.palette-label', (x) => x.map((e) => e.textContent));
  await esc(p);
  return list;
};

(async () => {
  const b = await launch();
  const A = await b.newPage();
  const errs = [];
  A.on('pageerror', (e) => errs.push(e.message));
  await login(A, 'admin@test.example', 'Rotkehlchen-Wolke-47');
  await api(A, 'PUT', '/api/admin/settings', { security: { requireVirusScan: false }, collab: { guestLinks: true, recordings: true } });
  const id = (await api(A, 'POST', '/api/boards', { name: 'Oberfläche' })).body.id;
  await api(A, 'POST', `/api/boards/${id}/members`, { email: 'ben@example.org', role: 'viewer' });
  await open(A, id);
  await A.evaluate(() => document.querySelector('#empty-start .btn:last-child')?.click());
  await A.evaluate(async () => {
    const c = await import('/js/core.js');
    const s = c.makeElement('sticky', 100, 100);
    const r = c.makeElement('shape', 400, 100, { shape: 'rect' });
    const k = c.makeElement('card', 700, 100);
    Object.assign(s, { id: 's1', text: 'Apfel' });
    Object.assign(r, { id: 'r1' });
    Object.assign(k, { id: 'k1', title: 'Karte eins' });
    c.addElements([s, r, k], { select: false });
    c.setSelection([]);
  });
  await wait(400);

  console.log('=== Kopfzeile');
  ok(await A.evaluate(() => !document.querySelector('#topbar button[title], #topright .icon-btn[title], #tools [title]')), 'Kein Browser-title in Kopfzeile und Werkzeugleiste');
  ok(await A.evaluate(() => /Moderieren/.test(document.getElementById('btn-moderate').textContent)), 'Moderieren ist beschriftet');
  ok(await A.evaluate(() => !document.querySelector('#topbar [aria-label="Vorlagen"]')), 'Vorlagen steht nicht mehr oben');
  await openMenu(A, '#btn-moderate');
  const mod = await labels(A);
  for (const w of ['Timer', 'Abstimmung', 'Retro', 'Privater Modus', 'Moderation', 'Schätzrunde …', 'Umfrage …', 'Zufallsauswahl …', 'Aufzeichnung']) ok(mod.includes(w), `Moderieren enthält ${w}`, mod);
  await pickMenu(A, 'Retro');
  ok((await labels(A)).includes('Zurück') && (await labels(A)).includes('Maßnahmen'), 'Untermenü mit Zurück', await labels(A));
  await A.keyboard.press('ArrowLeft');
  await wait(150);
  ok((await labels(A)).includes('Timer'), 'Pfeil links führt zurück', await labels(A));
  await esc(A);
  await openMenu(A, '#btn-moderate');
  await pickMenu(A, 'Schätzrunde');
  ok((await labels(A)).includes('Karte eins'), 'Schätzrunde ohne Auswahl fragt nach der Karte', await labels(A));
  await esc(A);
  await selectEls(A, ['k1']);
  await wait(150);
  await openMenu(A, '#btn-moderate');
  await pickMenu(A, 'Schätzrunde');
  ok(await A.evaluate(() => /Schätzrunde starten/.test(document.querySelector('.modal')?.textContent || '')), 'Mit gewählter Karte startet der Dialog');
  await esc(A);
  await selectEls(A, []);

  console.log('=== Boardmenü');
  await openMenu(A, '#btn-board-menu');
  const board = await labels(A);
  for (const w of ['Exportieren', 'Importieren', 'Board als Vorlage speichern …', 'Verlauf', 'Aktivität', 'Elementliste', 'Board duplizieren', 'In Ordner verschieben …', 'Board löschen …']) ok(board.includes(w), `Boardmenü enthält ${w}`, board);
  await pickMenu(A, 'Exportieren');
  const exp = await labels(A);
  ok(exp.includes('Als PDF-Datei') && exp.includes('PDF drucken (Text markierbar)') && !exp.some((x) => /importieren/i.test(x)), 'Export ohne Import', exp);
  await esc(A);
  await boardMenu(A, 'Importieren');
  const imp = await labels(A);
  ok(imp.some((x) => /^Inhalte aus Datei importieren/.test(x)) && imp.some((x) => /^Datei als Anhang einfügen/.test(x)) && imp.includes('Bild oder Datei einfügen'), 'Import und Anhang klar benannt', imp);
  await esc(A);
  await boardMenu(A, 'Verlauf');
  await wait(300);
  ok(await A.evaluate(() => !document.getElementById('sidepanel').classList.contains('hidden')), 'Verlauf öffnet das Panel');
  await esc(A);
  await boardMenu(A, 'Exportieren', 'Als JSON-Datei');
  await wait(300);
  ok(/JSON-Datei exportiert/.test(await toast(A)), 'JSON meldet das Ergebnis', await toast(A));
  await boardMenu(A, 'Exportieren', 'Als SVG');
  await wait(300);
  ok(/SVG exportiert/.test(await toast(A)), 'SVG meldet das Ergebnis', await toast(A));
  const before = (await api(A, 'GET', '/api/boards')).body.owned.length;
  await boardMenu(A, 'Board duplizieren');
  await wait(600);
  ok((await api(A, 'GET', '/api/boards')).body.owned.length === before + 1, 'Board wird dupliziert');
  await api(A, 'POST', '/api/folders', { name: 'Ablage' });
  await boardMenu(A, 'In Ordner verschieben');
  await wait(400);
  ok(await A.evaluate(() => /Ablage/.test(document.querySelector('.modal')?.textContent || '')), 'Ordnerdialog zeigt die Ordner');
  await A.evaluate(() => document.querySelector('.modal .folder-pick').click());
  await wait(400);
  const folder = (await api(A, 'GET', '/api/boards')).body.owned.find((x) => x.id === id);
  ok(folder.folders.length === 1, 'Board liegt im Ordner', folder.folders);

  console.log('=== Zahnrad und Konto');
  await openMenu(A, '#btn-settings');
  const set = await labels(A);
  ok(set.includes('Raster anzeigen') && set.includes('Am Raster einrasten'), 'Zahnrad: Ansicht und Bearbeitung', set);
  ok(!set.some((x) => /Abmelden|Filter|Retro|Tastenkürzel|Profil/.test(x)), 'Zahnrad ohne Konto, Filter und Retro', set);
  await esc(A);
  await openMenu(A, '#btn-account');
  const acc = await labels(A);
  ok(acc.includes('Abmelden') && acc.includes('Profil bearbeiten') && acc.includes('Tastenkürzel'), 'Avatar ist das Kontomenü', acc);
  await esc(A);

  console.log('=== Überlauf');
  for (const [w, h] of [[1920, 1080], [1366, 768], [1280, 800], [1024, 768], [390, 844]]) {
    await A.setViewport({ width: w, height: h });
    await wait(400);
    ok((await visible(A, '.share-btn')) && (await visible(A, '#btn-present')), `${w} px: Teilen und Präsentieren sichtbar`);
    ok(await A.evaluate(() => document.documentElement.scrollWidth <= innerWidth && !['topbar', 'topright', 'tools'].some((i) => {
      const e = document.getElementById(i);
      return e.scrollWidth > e.clientWidth + 1;
    })), `${w} px: Keine Leiste läuft über`);
    const t = await A.evaluate(() => [document.getElementById('topbar').getBoundingClientRect(), document.getElementById('topright').getBoundingClientRect()].map((r) => [r.left, r.right, r.top, r.bottom]));
    ok(t[0][1] <= t[1][0] || t[0][3] <= t[1][2], `${w} px: Kopfleisten überdecken sich nicht`, t);
    const folded = await A.evaluate(() => [...document.querySelectorAll('.top-strip .folded')].map((x) => x.dataset.tip));
    if (folded.length || w <= 760) {
      ok(await visible(A, '#btn-top-more'), `${w} px: Mehr ist da`);
      await openMenu(A, '#btn-top-more');
      const more = await labels(A);
      ok(folded.every((x) => more.includes(x)), `${w} px: Mehr nennt alles Ausgeblendete`, more);
      if (w === 390) ok(more.includes('Moderieren') && more.includes('Einstellungen') && more.includes('Filter'), 'Handy: Moderieren, Zahnrad und Filter im Mehr-Menü', more);
      await esc(A);
    } else ok(await A.evaluate(() => document.getElementById('btn-top-more').classList.contains('folded')), `${w} px: Kein leeres Mehr`);
  }
  await openMenu(A, '#btn-top-more');
  await pickMenu(A, 'Filter');
  await wait(250);
  ok(await A.evaluate(() => /Filter/.test(document.getElementById('sidepanel').textContent)), 'Handy: Filter aus Mehr wirkt');
  await esc(A);
  await A.setViewport({ width: 1280, height: 900 });
  await wait(400);

  console.log('=== Werkzeugleiste');
  const order = await A.evaluate(() => [...document.querySelectorAll('#tools > *')].map((x) => (x.classList.contains('tool-sep') ? '|' : x.dataset.tool || x.id)));
  ok(order.join(' ').startsWith('template | select hand | sticky text shape connector image | pen highlighter eraser | frame card table mindmap code diagram emoji | comment laser'), 'Reihenfolge nach Häufigkeit', order);
  await A.mouse.click(1000, 800);
  await A.keyboard.press('b');
  await wait(100);
  ok((await A.evaluate(async () => (await import('/js/core.js')).app.tool)) === 'table', 'Taste B wählt die Tabelle');
  await A.keyboard.press('d');
  await wait(100);
  ok((await A.evaluate(async () => (await import('/js/core.js')).app.tool)) === 'code', 'Taste D wählt den Code');
  await esc(A);
  await A.keyboard.press('v');
  await A.keyboard.press('?');
  await wait(250);
  const keys = await A.evaluate(() => document.querySelector('.shortcuts').textContent);
  ok(/BTabelle/.test(keys) && /DCode/.test(keys) && /Ansicht verschieben/.test(keys), 'Kürzelübersicht führt B, D und Ansicht verschieben');
  await esc(A);
  await A.setViewport({ width: 1280, height: 560 });
  await wait(400);
  const low = await A.evaluate(() => [...document.querySelectorAll('#tools [data-tool].folded')].map((b) => b.dataset.tool));
  ok(low.includes('diagram') && !low.includes('select') && !low.includes('sticky'), 'Wenig Höhe: Seltenes wandert hinter Mehr', low);
  ok(await visible(A, '#tools-more'), 'Werkzeug-Mehr ist sichtbar');
  await openMenu(A, '#tools-more');
  ok((await labels(A)).includes('Code'), 'Werkzeug-Mehr nennt die Werkzeuge', await labels(A));
  await pickMenu(A, 'Code');
  await wait(150);
  ok((await A.evaluate(async () => (await import('/js/core.js')).app.tool)) === 'code', 'Werkzeug aus Mehr wird aktiv');
  ok(await A.evaluate(() => document.getElementById('tools-more').classList.contains('active')), 'Mehr zeigt das aktive Werkzeug an');
  await esc(A);
  await A.keyboard.press('v');
  await A.setViewport({ width: 1280, height: 900 });
  await wait(400);

  console.log('=== Tooltips');
  // Jeder Knopf, nicht nur einer mit Kürzel: Ohne Kürzel stand hier einmal „null“
  const everyTip = await A.evaluate(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const out = [];
    for (const b of document.querySelectorAll('[data-tip]')) {
      if (!b.offsetParent) continue;
      b.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, pointerType: 'mouse' }));
      // Der erste Tooltip kommt verzögert, die folgenden sofort
      let box = null;
      for (let i = 0; i < 25 && !box; i++) {
        await wait(25);
        box = document.querySelector('.tooltip:not(.hidden)');
      }
      out.push({ tip: b.dataset.tip, text: box?.textContent ?? '' });
    }
    document.body.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, pointerType: 'mouse' }));
    return out;
  });
  ok(everyTip.length > 15, 'Alle Tooltips geprüft', everyTip.length);
  ok(everyTip.every((t) => t.text && !/null|undefined/.test(t.text)), 'Kein Tooltip zeigt null oder undefined', everyTip.filter((t) => /null|undefined/.test(t.text) || !t.text).slice(0, 6));
  await A.mouse.move(640, 500);
  await wait(900); // Kurz nach einem Tooltip erscheint der nächste absichtlich sofort
  const stray = await A.evaluate(() => (document.body.innerText.match(/(^|\s)(null|undefined|NaN|\[object Object\])(\s|$)/g) || []).slice(0, 5));
  ok(!stray.length, 'Im sichtbaren Text steht kein null, undefined oder NaN', stray);
  const bb = await (await A.$('#tools [data-tool="sticky"]')).boundingBox();
  await A.mouse.move(bb.x + 10, bb.y + 10);
  await wait(60);
  ok(await A.evaluate(() => !document.querySelector('.tooltip:not(.hidden)')), 'Tooltip erscheint nicht sofort');
  await wait(500);
  ok((await A.evaluate(() => document.querySelector('.tooltip:not(.hidden)')?.textContent)) === 'NotizN', 'Tooltip nennt Name und Kürzel');
  await A.mouse.move(600, 500);
  await wait(100);
  ok(await A.evaluate(() => !document.querySelector('.tooltip:not(.hidden)')), 'Tooltip verschwindet');
  const probe = () => A.evaluate(() => {
    document.getElementById('tip-probe')?.remove();
    const x = document.createElement('button');
    x.id = 'tip-probe';
    x.dataset.tip = 'Probe';
    x.style.cssText = 'position:fixed;left:600px;top:400px;width:60px;height:40px;z-index:9999';
    document.body.append(x);
  });
  await probe();
  await A.mouse.move(630, 420);
  await wait(500);
  ok(/Probe/.test(await A.evaluate(() => document.querySelector('.tooltip:not(.hidden)')?.textContent || '')), 'Tooltip am Probeknopf');
  await A.evaluate(() => document.getElementById('tip-probe').replaceWith(document.createElement('span')));
  await wait(400);
  ok(await A.evaluate(() => !document.querySelector('.tooltip:not(.hidden)')), 'Ersetzter Knopf: Der Tooltip verschwindet ohne Mausbewegung');
  await A.mouse.move(100, 500);
  await probe();
  await A.mouse.move(630, 420);
  await wait(500);
  // Puppeteer kann den Zeiger nicht aus dem Fenster bewegen: das Ereignis, das der Browser dabei auslöst
  await A.evaluate(() => document.getElementById('tip-probe').dispatchEvent(new PointerEvent('pointerout', { bubbles: true, relatedTarget: null })));
  await wait(50);
  ok(await A.evaluate(() => !document.querySelector('.tooltip:not(.hidden)')), 'Zeiger verlässt das Fenster: Der Tooltip verschwindet');
  await A.evaluate(() => document.getElementById('tip-probe').remove());
  await A.mouse.move(600, 500);
  await A.focus('#btn-board-menu');
  await A.keyboard.press('Tab');
  await A.keyboard.down('Shift');
  await A.keyboard.press('Tab');
  await A.keyboard.up('Shift');
  await wait(500);
  ok(/Boardmenü/.test(await A.evaluate(() => document.querySelector('.tooltip:not(.hidden)')?.textContent || '')), 'Tooltip auch bei Tastaturfokus');
  await A.evaluate(() => document.activeElement.blur());

  console.log('=== Kontextleiste');
  await selectEls(A, ['s1']);
  await wait(250);
  const t1 = await ctxTitles(A);
  ok(t1.length <= 7 && ['Farbe', 'Text', 'Link hinzufügen', 'Kommentieren', 'Sperren (Strg+L)', 'Mehr', 'Löschen (Entf)'].every((x) => t1.includes(x)), 'Notiz: nur die Grundknöpfe', t1);
  ok(await A.evaluate(() => !document.querySelector('#ctxbar .emoji-icon') && !/B×H/.test(document.getElementById('ctxbar').textContent)), 'Keine Farb-Emojis und kein B×H');
  ok(await A.evaluate(() => !document.querySelector('#ctxbar [title="Fett"]')), 'Textformat erst nach Klick auf Text');
  await A.evaluate(() => document.querySelector('#ctxbar [title="Text"]').click());
  await wait(150);
  await A.evaluate(() => document.querySelector('#ctxbar [title="Fett"]').click());
  await wait(200);
  ok(await A.evaluate(async () => (await import('/js/core.js')).getEl('s1').bold === true), 'Fett wirkt');
  ok(await A.evaluate(() => !!document.querySelector('#ctxbar [title="Fett"]')), 'Zusatzzeile bleibt nach der Änderung offen');
  await A.evaluate(() => document.querySelector('#ctxbar [title="Farbe"]').click());
  await wait(200);
  const swatch = await A.evaluate(() => [...document.querySelectorAll('.popover .swatch')].map((s) => s.title));
  ok(swatch.includes('Hellgelb') && !swatch.some((t) => t.startsWith('#')), 'Farbfelder nennen Farbnamen', swatch.slice(0, 6));
  await esc(A);
  await openMenu(A, '#ctxbar [data-more]');
  const groups = await heads(A);
  const idx = ['Bearbeiten', 'Anordnen', 'Format', 'Größe', 'Exportieren'].map((g) => groups.indexOf(g));
  ok(idx.every((x, i) => x >= 0 && (!i || x > idx[i - 1])), '„Mehr“ ist gruppiert', groups);
  const m1 = await labels(A);
  ok(['Kopieren', 'Ausschneiden', 'Duplizieren', 'Position und Größe …', 'Als PNG exportieren'].every((x) => m1.includes(x)), '„Mehr“ enthält alles Nötige', m1);
  ok(m1.includes('Themengruppe bilden'), 'Retro-Einträge stehen ohne Retro im Mehr-Menü', m1);
  await pickMenu(A, 'Position und Größe');
  await wait(200);
  ok(await A.evaluate(() => !!document.querySelector('.popover .geo-form')), 'Position und Größe öffnet die Eingabe');
  await esc(A);
  ok(!(await ctxTitles(A)).includes('Themengruppe bilden'), 'Ohne Retro kein Retro-Knopf in der Leiste');
  await ctxMore(A, 'Duplizieren');
  await wait(300);
  ok((await A.evaluate(async () => [...(await import('/js/core.js')).app.els.values()].filter((e) => e.type === 'sticky').length)) === 2, 'Duplizieren aus Mehr wirkt');
  await A.evaluate(async () => {
    const c = await import('/js/core.js');
    c.app.session.retro = { active: true, byId: String(c.app.user.id), step: 'collect', steps: ['collect'] };
    c.setSelection([]);
    c.setSelection(['s1']);
  });
  await wait(200);
  ok((await ctxTitles(A)).includes('Themengruppe bilden'), 'Bei laufender Retro steht der Knopf in der Leiste', await ctxTitles(A));
  await A.evaluate(async () => {
    const c = await import('/js/core.js');
    c.app.session.retro = null;
    c.setSelection([]);
  });
  await wait(150);

  console.log('=== Rechtsklick');
  await selectEls(A, ['r1']);
  await A.evaluate(async () => (await import('/js/core.js')).fitAll());
  await wait(600);
  const rr = await A.evaluate(() => {
    const r = document.querySelector('g[data-id="r1"]').getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  await A.mouse.click(rr.x, rr.y, { button: 'right' });
  await wait(250);
  const ctxHeads = await heads(A);
  ok(['Bearbeiten', 'Anordnen', 'Format', 'Größe', 'Exportieren'].every((g) => ctxHeads.includes(g)), 'Rechtsklick hat dieselben Gruppen', ctxHeads);
  ok(await A.evaluate(() => [...document.querySelectorAll('.popover .menu > *')].every((x, i, all) => !x.classList.contains('menu-header') || (all[i + 1] && all[i + 1].classList.contains('menu-item')))), 'Keine leeren Gruppen');
  await esc(A);
  await selectEls(A, []);

  console.log('=== Vorlagen');
  await A.evaluate(() => document.querySelector('#tools [data-tool="template"]').click());
  await wait(400);
  ok(await A.evaluate(() => /Board als Vorlage speichern/.test(document.querySelector('.tpl-save')?.textContent || '')), 'Vorlagen-Dialog bietet Speichern');
  await A.evaluate(() => document.querySelector('.tpl-save .btn').click());
  await wait(400);
  ok(await A.evaluate(() => /Board als Vorlage speichern/.test(document.querySelector('.modal')?.textContent || '')), 'Speichern-Dialog öffnet');
  await esc(A);

  console.log('=== Befehlssuche');
  for (const [q, want] of [['verlauf', /^Verlauf$/], ['elementliste', /Elementliste/], ['aktivität', /Aktivität/], ['schätzrunde', /Schätzrunde/], ['zufall', /Zufallsauswahl/], ['aufzeichnung', /Aufzeichnungen ansehen/], ['rundgang', /Neuen Rundgang/], ['duplizieren', /Board duplizieren/], ['json', /JSON/], ['importieren', /Inhalte aus Datei/], ['filter', /Filter/], ['raster', /Raster/]]) {
    const list = await palette(A, q);
    ok(list.some((x) => want.test(x)), `Suche „${q}“ findet ${want}`, list.slice(0, 6));
  }
  await selectEls(A, ['r1']);
  await wait(200);
  for (const [q, want] of [['position und', /Position und Größe/], ['rechteck', /Rechteck/], ['schlagwörter', /Schlagwörter/]]) {
    const list = await palette(A, q);
    ok(list.some((x) => want.test(x)), `Mit Auswahl: „${q}“ findet ${want}`, list.slice(0, 6));
  }
  await selectEls(A, []);

  console.log('=== Rollen');
  const V = await (await b.createBrowserContext()).newPage();
  V.on('pageerror', (e) => errs.push('V: ' + e.message));
  await login(V, 'ben@example.org', 'Gewitter-Laterne-83');
  await open(V, id);
  await openMenu(V, '#btn-board-menu');
  const vb = await labels(V);
  ok(vb.includes('Exportieren') && vb.includes('Aktivität') && vb.includes('Board duplizieren'), 'Betrachter: Exportieren, Aktivität, Kopie', vb);
  ok(!vb.some((x) => /Importieren|Verlauf|Board löschen/.test(x)), 'Betrachter: nichts, was die Rolle nicht kann', vb);
  await esc(V);
  const vm = await V.evaluate(() => {
    const b = document.getElementById('btn-moderate');
    return { none: b.classList.contains('none') };
  });
  if (!vm.none) {
    await openMenu(V, '#btn-moderate');
    const l = await labels(V);
    ok(!l.some((x) => /Timer|Privater Modus|Moderation|Umfrage …|Zufall|Schätzrunde/.test(x)), 'Betrachter: Moderieren nur mit Erlaubtem', l);
    await pickMenu(V, 'Retro');
    const r = await labels(V);
    ok(!r.some((x) => /Retro-Ablauf|Nächste Retro/.test(x)), 'Betrachter: Retro ohne Steuerung', r);
    await esc(V);
  }
  ok(!(await V.evaluate(() => document.querySelector('#tools [data-tool="template"]'))), 'Betrachter: keine Vorlagen');
  ok(await visible(V, '.share-btn'), 'Betrachter sieht Teilen');
  await V.close();

  const G = await (await b.createBrowserContext()).newPage();
  G.on('pageerror', (e) => errs.push('G: ' + e.message));
  const link = await api(A, 'POST', `/api/boards/${id}/guest-links`, { role: 'viewer', days: 1 });
  await G.goto(BASE + '/login', { waitUntil: 'networkidle0' });
  const join = await api(G, 'POST', '/api/guest/join', { token: link.body.token, name: 'Gerd', consent: true });
  ok(join.status === 200, 'Gast beigetreten', join);
  await open(G, id);
  ok(await G.evaluate(() => !document.getElementById('btn-account').disabled && !document.querySelector('.share-btn')), 'Gast: Avatar aktiv, kein Teilen');
  await openMenu(G, '#btn-account');
  const ga = await labels(G);
  ok(ga.includes('Gastzugang beenden'), 'Gast: Kontomenü', ga);
  await esc(G);
  await openMenu(G, '#btn-board-menu');
  const gb = await labels(G);
  ok(!gb.some((x) => /duplizieren|Ordner|Vorlage|löschen/.test(x)), 'Gast: keine Konto-Funktionen im Boardmenü', gb);
  await G.close();

  console.log('=== Löschen');
  await A.bringToFront();
  await boardMenu(A, 'Board löschen');
  await wait(300);
  const gone = A.waitForNavigation({ timeout: 8000 }).catch((e) => console.log('info', e.message));
  await A.evaluate(() => [...document.querySelectorAll('.modal button')].find((x) => /In den Papierkorb/.test(x.textContent)).click());
  await gone;
  await wait(500);
  ok(new URL(A.url()).pathname === '/', 'Nach dem Löschen zur Startseite', A.url());
  ok(!(await api(A, 'GET', '/api/boards')).body.owned.some((x) => x.id === id), 'Board liegt nicht mehr in der Liste');

  ok(!errs.length, 'keine Skriptfehler', errs.slice(0, 3));
  await b.close();
  console.log(f ? f + ' FEHLER' : 'ALLE OK');
  process.exit(f ? 1 : 0);
})().catch((e) => {
  console.log('ABBRUCH', e);
  process.exit(1);
});
