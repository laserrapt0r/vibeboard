// Anordnung neuer Elemente, Kanban und Karten, Live-Listen, Automatikfarbe im hellen Design
const fs = require('fs');
const { launch, BASE, TMP, boardMenu } = require('./lib');
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
const login = async (p, e, pw) => {
  await p.goto(BASE + '/login', { waitUntil: 'networkidle0' });
  const r = await api(p, 'POST', '/api/auth/login', { login: e, password: pw });
  if (r.status >= 300) throw new Error('login ' + e);
};
// Führt fn(core, ...args) im Browser aus
const core = (p, fn, ...a) => p.evaluate(`(async()=>{const c=await import('/js/core.js');return (${fn})(c,...${JSON.stringify(a)})})()`);
const els = (p) => core(p, (c) => JSON.parse(JSON.stringify([...c.app.els.values()])));
const get = (p, id) => core(p, (c, id) => JSON.parse(JSON.stringify(c.getEl(id) || null)), id);
const mk = (p, type, o) =>
  core(
    p,
    (c, type, o) => {
      const e = { ...c.makeElement(type, 0, 0), ...o };
      c.act(() => c.setEl(e));
      return e.id;
    },
    type,
    o,
  );
const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const anyOverlap = (list) => {
  const out = [];
  list.forEach((a, i) => list.slice(i + 1).forEach((b) => overlap(a, b) && out.push([a.text, b.text])));
  return out;
};
const key = (p, k) => p.keyboard.press(k);
const toast = (p) => p.evaluate(() => document.getElementById('toast')?.textContent || '');
const template = (p, id) =>
  p.evaluate(async (t) => {
    const m = await import('/js/templates.js');
    return JSON.parse(JSON.stringify(m.TEMPLATES.find((x) => x.id === t).build()));
  }, id);

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
  const open = async (name, { elements, both = false, transport = '' } = {}) => {
    const id = (await api(A, 'POST', '/api/boards', { name, elements })).body.id;
    await api(A, 'POST', `/api/boards/${id}/members`, { email: 'anna@example.org', role: 'editor' });
    await A.goto(BASE + '/board/' + id + transport, { waitUntil: 'load' });
    if (both) await B.goto(BASE + '/board/' + id + transport, { waitUntil: 'load' });
    await wait(1200);
    await A.bringToFront();
    await A.evaluate(() => document.querySelector('#empty-start .btn:last-child')?.click());
    await wait(150);
    return id;
  };

  console.log('=== Mindmap: Äste überlappen nicht');
  await open('Mindmap');
  const root = await mk(A, 'shape', { mind: true, shape: 'roundrect', x: 0, y: 0, w: 220, h: 64, text: 'Wurzel', bold: true });
  await core(A, (c, id) => c.mindAddChild(c.getEl(id)), root);
  const type = async (t, then) => {
    await A.keyboard.type(t);
    if (then) await key(A, then);
    await wait(60);
  };
  // Äste 1 bis 3 mit Enter, Ast 1 und Ast 3 mit Unterknoten
  await type('Ast1', 'Enter');
  await type('Ast2', 'Enter');
  await type('Ast3', 'Escape');
  const mind = async () => (await els(A)).filter((e) => e.mind && e.type === 'shape');
  const nodeOf = async (t) => (await mind()).find((e) => e.text === t);
  const addKids = async (parent, names) => {
    await core(A, (c, id) => c.mindAddChild(c.getEl(id)), (await nodeOf(parent)).id);
    for (let i = 0; i < names.length; i++) await type(names[i], i < names.length - 1 ? 'Enter' : 'Escape');
  };
  const before = await nodeOf('Ast1');
  await addKids('Ast1', ['K1a', 'K1b', 'K1c', 'K1d']);
  await addKids('Ast3', ['K3a', 'K3b']);
  await addKids('Ast2', ['K2a', 'K2b', 'K2c']);
  await addKids('K1b', ['E1', 'E2', 'E3']);
  let m = await mind();
  ok(m.length === 16 && !anyOverlap(m).length, 'Keine Überlappung nach dem Ausbau', anyOverlap(m));
  ok((await nodeOf('Ast1')).y === before.y, 'Oberster Ast bleibt, wo er war');
  // Ein vom Nutzer weit weggezogener Ast stört nicht und wird nicht bewegt
  const far = await nodeOf('K3b');
  await core(A, (c, id) => c.act(() => c.updateEl(id, { x: 3000, y: -2000 })), far.id);
  const own = await nodeOf('K2a');
  const gap = (await nodeOf('K3b')).y - (await nodeOf('Ast3')).y;
  await addKids('Ast1', ['K1e']);
  ok((await nodeOf('K3b')).x === 3000 && (await nodeOf('K3b')).y - (await nodeOf('Ast3')).y === gap && (await nodeOf('K2a')).y === own.y, 'Unbeteiligte Lagen bleiben, Unterknoten folgen ihrem Ast', await nodeOf('K3b'));
  // Verworfener Knoten: beiseitegeschobene Äste kehren zurück, kein Verlaufseintrag
  const posBefore = JSON.stringify((await mind()).map((e) => [e.id, e.y]).sort());
  await core(A, (c, id) => c.mindAddChild(c.getEl(id)), (await nodeOf('K1a')).id);
  await wait(100);
  await key(A, 'Escape');
  await wait(200);
  ok(JSON.stringify((await mind()).map((e) => [e.id, e.y]).sort()) === posBefore, 'Esc auf neuem Knoten stellt die Lagen wieder her');
  // Rückgängig nimmt Knoten und Verschiebung zusammen zurück
  await core(A, (c, id) => c.mindAddChild(c.getEl(id)), (await nodeOf('K1a')).id);
  await type('K1a1', 'Escape');
  await wait(100);
  ok(!anyOverlap(await mind()).length, 'Unterknoten mitten im Ast schiebt den Rest beiseite', anyOverlap(await mind()));
  await core(A, (c) => c.undo());
  await wait(200);
  ok(JSON.stringify((await mind()).map((e) => [e.id, e.y]).sort()) === posBefore, 'Rückgängig: ein Schritt für Knoten und Verschiebung');

  console.log('=== Kanban: volle Spalte, Reihenfolge, neue Spalten');
  const kb = await template(A, 'kanban');
  await open('Kanban', { elements: kb });
  const names = await core(A, (c) => c.boardColumns());
  ok(names.length === 4, 'Spalten erkannt', names);
  const ids = [];
  for (let i = 0; i < 14; i++) ids.push(await mk(A, 'card', { x: -3000, y: i * 10, title: 'Viele ' + i }));
  await core(A, (c, ids, s) => c.act(() => ids.forEach((i) => { c.updateEl(i, { status: s }); c.cardToColumn(i, s); })), ids, names[1]);
  await wait(200);
  let all = await els(A);
  const stack = all.filter((e) => e.type === 'card' && e.status === names[1]);
  ok(new Set(stack.map((e) => e.y)).size === stack.length && !anyOverlap(stack.map((e) => ({ ...e, text: e.title }))).length, 'Karten stapeln sich nicht', stack.map((e) => e.y));
  const zone = all.filter((e) => e.statusCol).sort((a, b) => a.x - b.x)[1];
  const inZone = stack.every((e) => e.y + e.h <= zone.y + zone.h && e.x >= zone.x && e.x + e.w <= zone.x + zone.w);
  const frame = all.find((e) => e.type === 'frame');
  ok(inZone, 'Die Spalte wächst mit', { zone, last: Math.max(...stack.map((e) => e.y + e.h)) });
  ok(zone.y + zone.h <= frame.y + frame.h, 'Der Frame wächst mit', { zone: zone.y + zone.h, frame: frame.y + frame.h });
  // Rückgängig: Karten und Spalte zusammen
  await core(A, (c) => c.undo());
  await wait(200);
  const undone = await get(A, zone.id);
  ok(undone.h === 840, 'Rückgängig setzt auch die Spalte zurück', undone.h);
  await core(A, (c) => c.redo());
  await wait(200);
  // Ansicht: feste Reihenfolge, Fremdes dahinter
  await mk(A, 'card', { x: -3000, y: 900, title: 'Fremd', status: 'Aaa Fremd' });
  await core(A, (c) => c.app.emit('openCardViews'));
  await wait(400);
  const heads = () => A.evaluate(() => [...document.querySelectorAll('.kanban-col')].map((c) => c.getAttribute('aria-label')));
  let h = await heads();
  ok(JSON.stringify(h) === JSON.stringify([...names, 'Aaa Fremd']), 'Spalten wie auf dem Board, Fremdes dahinter', h);
  // Neue Spalte legt eine echte Spalte an
  await A.type('.kanban-add input', 'Prüfung');
  await key(A, 'Enter');
  await wait(300);
  h = await heads();
  ok(h[4] === 'Prüfung' && h[5] === 'Aaa Fremd', 'Neue Spalte steht auf dem Board', h);
  ok(JSON.stringify(await core(A, (c) => c.boardColumns())) === JSON.stringify([...names, 'Prüfung']), 'Board kennt die Spalte');
  await A.type('.kanban-add input', 'prüfung');
  await key(A, 'Enter');
  await wait(300);
  ok((await heads()).filter((x) => /prüfung/i.test(x)).length === 1, 'Andere Schreibweise legt keine zweite Spalte an', await heads());
  await key(A, 'Escape');
  await wait(300);
  await core(A, (c) => c.app.emit('openCardViews'));
  await wait(400);
  ok((await heads()).includes('Prüfung'), 'Spalte bleibt nach dem Schließen');
  await key(A, 'Escape');
  await wait(200);
  all = await els(A);
  const newZone = all.filter((e) => e.statusCol).sort((a, b) => a.x - b.x)[4];
  const fr = all.find((e) => e.type === 'frame');
  ok(newZone.x + newZone.w <= fr.x + fr.w && newZone.locked && newZone.y === zone.y, 'Neue Spalte liegt im Frame, gesperrt wie die anderen', { newZone, fr });
  await core(A, (c, s) => { const e = c.makeElement('card', -3000, 0); c.act(() => { c.setEl(e); c.updateEl(e.id, { status: s }); c.cardToColumn(e.id, s); }); }, 'Prüfung');
  await wait(100);
  all = await els(A);
  const moved = all.find((e) => e.status === 'Prüfung');
  ok(moved.x >= newZone.x && moved.x + moved.w <= newZone.x + newZone.w, 'Karte wandert in die neue Spalte', moved);

  // Board ohne Spalten: ehrlich als vorläufig gekennzeichnet
  await open('Ohne Spalten');
  await mk(A, 'card', { x: 0, y: 0, title: 'Ohne' });
  await core(A, (c) => c.app.emit('openCardViews'));
  await wait(400);
  await A.type('.kanban-add input', 'Später');
  await key(A, 'Enter');
  await wait(300);
  const note = await A.evaluate(() => [...document.querySelectorAll('.kanban-col')].find((c) => c.getAttribute('aria-label') === 'Später')?.textContent);
  ok(/Vorläufig/.test(note || ''), 'Vorläufig gekennzeichnet', note);
  await key(A, 'Escape');
  await wait(200);

  console.log('=== Neue Karte');
  await open('Karten', { elements: kb });
  const zones = (await els(A)).filter((e) => e.statusCol).sort((a, b) => a.x - b.x);
  // Klick in die Spalte mit dem Kartenwerkzeug
  const cardIn = async (z) => {
    await core(A, (c, z) => { c.fitTo({ x: z.x, y: z.y, w: z.w, h: z.h }, { animate: false, pad: 80 }); c.setTool('card'); }, z);
    await wait(150);
    const p = await core(A, (c, z) => c.toScreen(z.x + z.w / 2, z.y + z.h - 120), z);
    const r = await A.evaluate(() => { const b = document.getElementById('stage') || document.querySelector('#stage'); const q = b.getBoundingClientRect(); return { l: q.left, t: q.top }; });
    await A.mouse.click(p.x + r.l, p.y + r.t);
    await wait(300);
  };
  const cardsNow = async () => (await els(A)).filter((e) => e.type === 'card');
  const n0 = (await cardsNow()).length;
  await cardIn(zones[2]);
  const inDlg = () => A.evaluate(() => {
    const i = document.querySelector('.modal input[type=text]');
    return i ? { v: i.value, s: i.selectionStart, e: i.selectionEnd, f: document.activeElement === i } : null;
  });
  // Das Kartenwerkzeug legt die Karte an, der Titel entsteht direkt auf ihr
  const inEditor = () => A.evaluate(() => ({ f: document.activeElement?.id === 'editor', v: document.getElementById('editor').value, dialog: !!document.querySelector('.modal') }));
  const d = await inEditor();
  ok(d.f && d.v === '' && !d.dialog, 'Der Fokus steht im Titel, ohne Dialog', d);
  await A.keyboard.type('Login mit SSO');
  ok((await inEditor()).v === 'Login mit SSO', 'Tippen schreibt den Titel', await inEditor());
  await key(A, 'Enter');
  await wait(300);
  const made = (await cardsNow()).find((e) => e.title === 'Login mit SSO');
  ok(made && made.status === names[2], 'Neue Karte hat den Status der Spalte', made);
  // Esc und Klick daneben: unveränderte neue Karte verschwindet
  const beforeUndo = await core(A, (c) => c.canUndo());
  await core(A, (c) => c.undo());
  await wait(200);
  const nBack = (await cardsNow()).length;
  await core(A, (c) => c.redo());
  await wait(200);
  await cardIn(zones[0]);
  await key(A, 'Escape');
  await wait(300);
  ok((await cardsNow()).length === n0 + 1, 'Esc entfernt die unveränderte neue Karte', (await cardsNow()).length);
  await core(A, (c) => c.undo());
  await wait(200);
  ok(beforeUndo && (await cardsNow()).length === nBack, 'Kein Eintrag im Verlauf: Rückgängig trifft die Karte davor', (await cardsNow()).length);
  await core(A, (c) => c.redo());
  await wait(200);
  await cardIn(zones[0]);
  await A.mouse.click(30, 450);
  await wait(300);
  ok((await cardsNow()).length === n0 + 1, 'Klick daneben entfernt sie ebenso');
  // Mit Eingabe bleibt sie, bestehende Karten bleiben immer
  await cardIn(zones[0]);
  await A.keyboard.type('Getippt');
  await key(A, 'Escape');
  await wait(300);
  ok((await cardsNow()).length === n0 + 2, 'Mit Eingabe bleibt die Karte stehen');
  await core(A, (c, id) => c.startEdit(id), made.id);
  await wait(300);
  const e2 = await inDlg();
  ok(e2.s === e2.e, 'Bestehende Karte: Titel nicht markiert', e2);
  await key(A, 'Escape');
  await wait(300);
  ok(await get(A, made.id), 'Bestehende Karte bleibt bei Esc');
  // Status im Dialog: Auswahl, Schreibweise, Mitwandern
  await core(A, (c, id) => c.startEdit(id), made.id);
  await wait(300);
  const opts = await A.evaluate(() => [...document.querySelectorAll('#status-list option')].map((o) => o.value));
  ok(names.every((n) => opts.includes(n)), 'Spalten stehen zur Auswahl', opts);
  const low = names[3].toLowerCase();
  await A.evaluate((v) => {
    const i = document.querySelector('.modal input[list=status-list]');
    i.value = v;
    i.dispatchEvent(new Event('change', { bubbles: true }));
    document.querySelector('.modal button[type=submit]').click();
  }, low);
  await wait(300);
  const went = await get(A, made.id);
  ok(went.status === names[3], 'Schreibweise folgt der Spalte', went.status);
  ok(went.x >= zones[3].x && went.x + went.w <= zones[3].x + zones[3].w, 'Karte wandert mit', went);
  await core(A, (c) => c.app.emit('openCardViews'));
  await wait(400);
  ok((await heads()).length === new Set((await heads()).map((x) => x.toLowerCase())).size, 'Keine doppelte Spalte', await heads());
  await key(A, 'Escape');
  await wait(200);

  console.log('=== Tab: Bereich wird zeilenweise gefüllt');
  await open('Tab');
  const fr2 = await mk(A, 'frame', { x: 0, y: 0, w: 460, h: 700, title: 'Eng' });
  const first = await mk(A, 'sticky', { x: 20, y: 40, text: 'n0' });
  await core(A, (c, id) => { c.fitTo({ x: -100, y: -100, w: 700, h: 900 }, { animate: false }); c.startEdit(id); }, first);
  for (let i = 1; i <= 5; i++) {
    await key(A, 'Tab');
    await wait(120);
    await A.keyboard.type('n' + i);
  }
  await key(A, 'Escape');
  await wait(200);
  const stickies = (await els(A)).filter((e) => e.type === 'sticky').sort((a, b) => a.text.localeCompare(b.text));
  ok(JSON.stringify(stickies.map((s) => [s.x, s.y])) === JSON.stringify([[20, 40], [240, 40], [20, 260], [240, 260], [20, 480], [240, 480]]), 'Zeilenweise im Frame, ohne ihn zu verlassen', stickies.map((s) => [s.x, s.y]));
  // Frame voll: läuft unten über, bleibt in der Breite
  await key(A, 'Escape');
  await core(A, (c, id) => c.startEdit(id), stickies[5].id);
  await wait(100);
  await A.keyboard.type('x');
  await key(A, 'Tab');
  await wait(150);
  await A.keyboard.type('n6');
  await key(A, 'Escape');
  await wait(150);
  const over = (await els(A)).find((e) => e.text === 'n6');
  ok(over.y > 480 && over.x >= 0 && over.x + over.w <= 460, 'Voller Frame läuft unten über', over);
  // Ohne Rahmen: Umbruch
  await open('Reihe');
  const s0 = await mk(A, 'sticky', { x: 0, y: 0, text: 'r0' });
  await core(A, (c, id) => c.startEdit(id), s0);
  for (let i = 1; i <= 11; i++) {
    await key(A, 'Tab');
    await wait(100);
    await A.keyboard.type('r' + i);
  }
  await key(A, 'Escape');
  await wait(200);
  const row = (await els(A)).filter((e) => e.type === 'sticky');
  ok(new Set(row.map((s) => s.x)).size === 5 && new Set(row.map((s) => s.y)).size === 3, 'Ohne Rahmen bricht die Reihe nach fünf um', row.map((s) => [s.text, s.x, s.y]));
  ok(!anyOverlap(row).length, 'Dabei überlappt nichts');
  const seen = await core(A, (c) => { const v = c.visibleRect(); const e = [...c.app.els.values()].filter((x) => x.text === 'r11')[0]; return e.x >= v.x && e.y >= v.y && e.x + e.w <= v.x + v.w && e.y + e.h <= v.y + v.h; });
  ok(seen, 'Die letzte Notiz liegt im Blick');

  console.log('=== Griffpunkte');
  await open('Griff');
  const src = await mk(A, 'sticky', { x: 800, y: 300, text: 'Quelle' });
  const clickQc = async (side) => {
    await core(A, (c, id) => { c.setSelection([id]); }, src);
    await wait(250);
    const pt = await A.evaluate((s) => { const r = document.querySelector(`[data-qc="${s}"]`)?.getBoundingClientRect(); return r && { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, side);
    await A.mouse.click(pt.x, pt.y);
    await wait(300);
  };
  await core(A, (c, id) => { const e = c.getEl(id); c.fitTo({ x: e.x, y: e.y, w: e.w, h: e.h }, { animate: false, maxZ: 1, pad: 40 }); c.app.view.x += 420; c.applyView(); }, src);
  await wait(150);
  await clickQc('right');
  const off = await core(A, (c) => {
    const e = c.getEl([...c.app.sel][0]);
    const s = document.getElementById('stage').getBoundingClientRect();
    const p = c.toScreen(e.x + e.w, e.y + e.h), q = c.toScreen(e.x, e.y);
    return { in: q.x >= 0 && q.y >= 0 && p.x <= s.width && p.y <= s.height, edit: !!c.app.editing };
  });
  ok(off.in && off.edit, 'Per Griff angelegte Notiz liegt im Fenster', off);
  await key(A, 'Escape');
  await wait(300);
  all = await els(A);
  ok(all.length === 1 && all[0].id === src, 'Esc entfernt leere Notiz samt Linie', all.map((e) => e.type));
  await clickQc('right');
  await A.keyboard.type('Ziel');
  await key(A, 'Escape');
  await wait(300);
  ok((await els(A)).length === 3, 'Mit Text bleiben Notiz und Linie');
  await core(A, (c) => c.undo());
  await wait(200);
  ok((await els(A)).length === 1, 'Rückgängig nimmt Anlegen und Text in einem Schritt');

  console.log('=== Bilder und Dateien suchen freien Platz');
  await open('Hochladen');
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mNk+M9Qz0AEYBxVSF+FAP5FDvcfRYWgAAAAAElFTkSuQmCC', 'base64');
  fs.writeFileSync(TMP + '/klein.png', png);
  fs.writeFileSync(TMP + '/notiz.txt', 'Hallo');
  const blocker = await mk(A, 'sticky', { x: -50, y: -50, w: 1400, h: 900, text: 'Bestand' });
  await core(A, (c, id) => { const e = c.getEl(id); c.fitTo({ x: e.x + 300, y: e.y + 200, w: 400, h: 300 }, { animate: false }); }, blocker);
  await wait(200);
  const input = await A.$$('input[type=file]');
  // Der Bild-Knopf nutzt das Feld für Bilder, das für Anhänge liegt in files.js
  const upload = async (accept, path) => {
    for (const i of input) {
      const a = await i.evaluate((x) => x.accept);
      if (accept(a)) return i.uploadFile(path);
    }
    throw new Error('Kein Feld');
  };
  await upload((a) => a === 'image/*' || a.includes('image'), TMP + '/klein.png');
  await wait(800);
  let image = (await els(A)).find((e) => e.type === 'image');
  const box = await get(A, blocker);
  ok(image && !overlap(image, box), 'Bild liegt nicht auf vorhandenem Inhalt', image && { x: image.x, y: image.y, w: image.w, h: image.h });
  await upload((a) => a === '.pdf,.docx,.xlsx,.pptx,.odt,.ods,.odp,.doc,.xls,.ppt,.txt,.md,.csv,.json', TMP + '/notiz.txt');
  await wait(1500);
  const file = (await els(A)).find((e) => e.type === 'file');
  ok(file && !overlap(file, box) && !overlap(file, image), 'Datei ebenso', file && { x: file.x, y: file.y });

  console.log('=== Werkzeug und Einfügen: nichts deckungsgleich');
  await open('Doppelt');
  await A.mouse.click(640, 450);
  for (let i = 0; i < 2; i++) {
    await core(A, (c) => c.setTool('sticky'));
    await key(A, 'Enter');
    await wait(200);
    await A.keyboard.type('Notiz');
    await key(A, 'Escape');
    await core(A, (c) => c.setSelection([]));
    await wait(150);
  }
  const notes = (await els(A)).filter((e) => e.type === 'sticky');
  ok(notes.length === 2 && notes[0].x !== notes[1].x, 'Notiz per Enter zweimal: versetzt', notes.map((e) => [e.x, e.y]));
  const enterShape = async () => {
    await core(A, (c) => { c.setTool('card'); });
    await key(A, 'Enter');
    await wait(250);
    await A.keyboard.type('Eins');
    await key(A, 'Enter');
    await wait(250);
  };
  await enterShape();
  await A.evaluate(() => document.activeElement?.blur());
  await enterShape();
  const twins = (await els(A)).filter((e) => e.type === 'card');
  ok(twins.length === 2 && twins[0].x !== twins[1].x && twins[0].y !== twins[1].y, 'Enter zweimal: versetzt', twins.map((e) => [e.x, e.y]));
  ok(Math.abs(twins[1].x - twins[0].x) === 20, 'Um ein Rastermaß', twins.map((e) => [e.x, e.y]));
  await core(A, (c, id) => c.setSelection([id]), twins[0].id);
  // Einfügen an derselben Stelle
  const paste = () =>
    core(A, (c) => {
      const l = c.collectForCopy([...c.app.sel]);
      const b = c.getEl(l[0].id);
      c.pasteElements(l, { x: 2000 + b.w / 2, y: 2000 + b.h / 2 });
    });
  await paste();
  await core(A, (c, id) => c.setSelection([id]), twins[0].id);
  await paste();
  await wait(200);
  const pasted = (await els(A)).filter((e) => e.type === 'card' && e.x >= 2000);
  ok(pasted.length === 2 && pasted[0].x !== pasted[1].x, 'Einfügen zweimal: versetzt', pasted.map((e) => [e.x, e.y]));
    await A.evaluate(async () => {
    const c = await import('/js/core.js');
    c.pasteText('Doppelt', { x: 3000, y: 3000 });
    c.pasteText('Doppelt', { x: 3000, y: 3000 });
  });
  await wait(200);
  const texts = (await els(A)).filter((e) => e.text === 'Doppelt');
  ok(texts.length === 2 && texts[0].x !== texts[1].x, 'Text zweimal: versetzt', texts.map((e) => [e.x, e.y]));

  console.log('=== Verbinder in ein anderes Board');
  await open('Quelle');
  const p1 = await mk(A, 'shape', { x: 0, y: 0, w: 100, h: 60, text: 'P1' });
  const p2 = await mk(A, 'shape', { x: 400, y: 0, w: 100, h: 60, text: 'P2' });
  const cn = await core(A, (c, a, b) => { const e = c.makeElement('connector', 0, 0, { from: { id: a }, to: { id: b } }); c.act(() => c.setEl(e)); return e.id; }, p1, p2);
  const clip = await core(A, (c, a, cn) => JSON.parse(JSON.stringify(c.collectForCopy([a, cn]))), p1, cn);
  ok(clip.some((e) => e.type === 'connector' && e.from.id && !e.to.id && Number.isFinite(e.to.x)), 'Kopie merkt sich die Stelle des fehlenden Endes', clip);
  await open('Ziel');
  await core(A, (c, l) => c.pasteElements(l, { x: 500, y: 500 }), clip);
  await wait(250);
  const arrived = await els(A);
  const line = arrived.find((e) => e.type === 'connector');
  ok(arrived.length === 2 && line && line.from.id && Number.isFinite(line.to.x), 'Verbinder kommt mit freiem Ende an', arrived.map((e) => [e.type, e.from, e.to]));

  console.log('=== Frame mit fremdem privatem Beitrag');
  const near = (a, b) => Math.abs(a - b) < 0.5;
  for (const transport of ['', '?transport=poll']) {
    console.log(transport ? 'Rückfall-Transport' : 'Live-Stream');
    await open('Privat', { both: true, transport });
    const pf = await mk(A, 'frame', { x: 0, y: 0, w: 600, h: 400, title: 'Rahmen' });
    await wait(300);
    await core(A, (c) => c.app.sync.op({ op: 'privateMode', active: true }));
    await wait(500);
    await B.bringToFront();
    const secret = await mk(B, 'sticky', { x: 100, y: 100, w: 200, h: 200, text: 'GEHEIM-B' });
    const outside = await mk(B, 'sticky', { x: 1000, y: 100, w: 200, h: 200, text: 'GEHEIM-D' });
    await wait(transport ? 1500 : 600);
    await A.bringToFront();
    const hid = await get(A, secret);
    ok(hid && hid.hidden && !hid.text, 'A sieht nur den Platzhalter', hid);
    await core(A, (c) => { c.setSelection([]); c.fitTo({ x: -200, y: -200, w: 1600, h: 800 }, { animate: false, pad: 40 }); });
    await wait(250);
    // Echtes Ziehen am Titel, quer über den zweiten Beitrag
    const tp = await core(A, (c, id) => { const e = c.getEl(id); const s = document.getElementById('stage').getBoundingClientRect(); const p = c.toScreen(e.x + 30, e.y - 8); return { x: p.x + s.left, y: p.y + s.top, z: c.app.view.z }; }, pf);
    await A.mouse.move(tp.x, tp.y);
    await A.mouse.down();
    await A.mouse.move(tp.x + 40, tp.y + 10, { steps: 3 });
    await wait(200);
    await A.mouse.move(tp.x + 600 * tp.z, tp.y + 0, { steps: 6 });
    await wait(300);
    await A.mouse.move(tp.x + 300 * tp.z, tp.y + 100 * tp.z, { steps: 6 });
    await wait(300);
    await A.mouse.up();
    await wait(transport ? 1500 : 700);
    const fNow = await get(A, pf);
    const dx = fNow.x, dy = fNow.y;
    const sNow = await get(A, secret), oNow = await get(A, outside);
    ok(dx > 100 && near(sNow.x, 100 + dx) && near(sNow.y, 100 + dy), 'Fremder Beitrag wandert mit dem Frame', { dx, dy, x: sNow.x, y: sNow.y });
    ok(oNow.x === 1000 && oNow.y === 100, 'Nur Überstrichenes bleibt liegen', oNow);
    ok(sNow.hidden && !sNow.text, 'A erfährt dabei nichts', sNow);
    const atB = await get(B, secret);
    ok(atB.text === 'GEHEIM-B' && near(atB.x, 100 + dx), 'B sieht den eigenen Beitrag mitgewandert', atB);
    // Rückgängig nimmt ihn zurück
    await core(A, (c) => c.undo());
    await wait(transport ? 1500 : 700);
    const backS = await get(A, secret);
    ok(near(backS.x, 100) && (await get(A, pf)).x === 0, 'Rückgängig: Frame und Beitrag zurück', backS);
    await core(A, (c) => c.app.sync.op({ op: 'privateMode', active: false }));
    await wait(transport ? 1500 : 700);
    const shown = await get(A, secret);
    ok(shown.text === 'GEHEIM-B' && near(shown.x, 100), 'Nach dem Aufdecken an der richtigen Stelle', shown);
  }

  console.log('=== Suche und Elementliste folgen dem Board');
  await open('Listen', { both: true });
  const t1 = await mk(A, 'sticky', { x: 0, y: 0, text: 'Apfel eins' });
  const t2 = await mk(A, 'sticky', { x: 300, y: 0, text: 'Apfel zwei' });
  await wait(500);
  await core(A, (c) => c.setSelection([]));
  await A.mouse.click(640, 650);
  await A.keyboard.down('Control');
  await A.keyboard.press('f');
  await A.keyboard.up('Control');
  await wait(200);
  await A.keyboard.type('apfel');
  await wait(300);
  const cnt = () => A.evaluate(() => document.querySelector('#search-box .muted.small, .muted.small')?.parentElement?.querySelector('span.muted.small')?.textContent);
  ok((await cnt()) === '1 / 2', 'Trefferzahl', await cnt());
  await core(B, (c, id) => c.act(() => c.deleteEl(id)), t2);
  await wait(1000);
  ok((await cnt()) === '1 / 1', 'Fremdes Löschen senkt die Trefferzahl', await cnt());
  await core(B, (c, id) => c.act(() => c.deleteEl(id)), t1);
  await wait(1000);
  ok((await cnt()) === '0 Treffer', 'Letzter Treffer weg', await cnt());
  await mk(B, 'sticky', { x: 0, y: 400, text: 'Apfel drei' });
  await wait(1000);
  ok(/Treffer|1 \/ 1/.test(await cnt()) && (await core(A, (c) => c.app.searchHits.length)) === 1, 'Neuer Treffer erscheint', await cnt());
  await key(A, 'Escape');
  await wait(100);
  await boardMenu(A, 'Elementliste');
  await wait(300);
  const liste = () => A.evaluate(() => [...document.querySelectorAll('.element-list button')].map((b) => b.textContent));
  ok((await liste()).length === 1, 'Elementliste zeigt den Stand', await liste());
  const t3 = await mk(B, 'sticky', { x: 300, y: 400, text: 'Birne' });
  await wait(1000);
  ok((await liste()).length === 2, 'Neues erscheint in der offenen Liste', await liste());
  // Klick im selben Moment, in dem das Element verschwindet: Die Liste hat noch den alten Stand
  await A.evaluate(async (id) => {
    const c = await import('/js/core.js');
    const btn = document.querySelector(`.element-list button[data-id="${id}"]`);
    c.applyRemoteOp({ op: 'delete', id });
    btn.click();
  }, t3);
  await wait(200);
  ok(/gibt es nicht mehr/.test(await toast(A)), 'Gelöschtes Element wird gemeldet, nicht ausgewählt', await toast(A));
  ok((await core(A, (c) => c.app.sel.size)) === 0 && (await A.$('.modal')), 'Liste bleibt offen, nichts ausgewählt');
  await key(A, 'Escape');
  await wait(200);

  console.log('=== Antwortentwurf bei gelöschtem Kommentar');
  await open('Kommentar', { both: true });
  const cid = await core(A, (c) => new Promise((res) => {
    c.newComment({ x: 200, y: 200 });
    setTimeout(() => res([...c.app.els.values()].find((e) => e.type === 'comment').id), 100);
  }));
  await A.keyboard.type('Erster');
  await key(A, 'Enter');
  await wait(800);
  const pop = () => A.evaluate(() => document.querySelector('.comment-pop')?.textContent || '');
  ok((await pop()).includes('Erster'), 'Kommentar offen', await pop());
  await A.type('.comment-pop textarea', 'Mein Entwurf');
  await B.bringToFront();
  await core(B, (c, id) => c.act(() => c.deleteEl(id)), cid);
  await wait(1000);
  await A.bringToFront();
  await wait(200);
  const gone = await A.evaluate(() => ({ t: document.querySelector('.comment-pop')?.textContent || '', v: document.querySelector('.comment-pop textarea')?.value, ro: document.querySelector('.comment-pop textarea')?.readOnly }));
  ok(/wurde gelöscht/.test(gone.t) && gone.v === 'Mein Entwurf' && gone.ro, 'Hinweis erscheint, Entwurf bleibt lesbar', gone);
  await A.mouse.click(900, 700);
  await wait(200);
  ok(await A.$('.comment-pop'), 'Ein Klick daneben schließt den Hinweis nicht');
  await A.evaluate(() => [...document.querySelectorAll('.comment-pop button')].find((b) => /Schließen/.test(b.textContent)).click());
  await wait(200);
  ok(!(await A.$('.comment-pop')), 'Schließen beendet ihn');
  // Ohne Entwurf schließt das Fenster wie bisher
  const cid2 = await core(A, (c) => new Promise((res) => {
    c.newComment({ x: 400, y: 200 });
    setTimeout(() => res([...c.app.els.values()].find((e) => e.type === 'comment').id), 100);
  }));
  await A.keyboard.type('Zweiter');
  await key(A, 'Enter');
  await wait(800);
  await core(B, (c, id) => c.act(() => c.deleteEl(id)), cid2);
  await wait(1000);
  ok(!(await A.$('.comment-pop')), 'Ohne Entwurf schließt das Fenster');

  console.log('=== Automatikfarbe im hellen Design');
  await open('Hell');
  await core(A, (c) => { c.app.settings.dark = false; c.saveSettings(); });
  await wait(150);
  const dunkel = await mk(A, 'shape', { shape: 'rect', x: 0, y: 0, w: 400, h: 300, fill: '#1a2b4c' });
  await mk(A, 'shape', { shape: 'rect', x: 600, y: 0, w: 400, h: 300, fill: '#ffffff' });
  const auf = await mk(A, 'text', { x: 40, y: 40, w: 200, text: 'Lesbar', color: '#1a1a1a' });
  const auf2 = await mk(A, 'text', { x: 640, y: 40, w: 200, text: 'Lesbar', color: '#1a1a1a' });
  const frei = await mk(A, 'text', { x: 40, y: 500, w: 200, text: 'Lesbar', color: '#1a1a1a' });
  await core(A, (c) => c.setSelection([]));
  await wait(300);
  const ink = (id) => A.evaluate((id) => document.querySelector(`g[data-id="${id}"] text`)?.getAttribute('fill'), id);
  ok((await ink(auf)) === '#ffffff', 'Text auf dunkler Form ist hell', await ink(auf));
  ok((await ink(auf2)) === '#1a1a1a', 'Text auf heller Form bleibt dunkel', await ink(auf2));
  ok((await ink(frei)) === '#1a1a1a', 'Text auf dem Board bleibt dunkel', await ink(frei));
  await core(A, (c, id) => { c.setEl({ ...c.getEl(id), x: 2000 }); }, dunkel);
  await wait(300);
  ok((await ink(auf)) === '#1a1a1a', 'Form weggezogen: Text wird wieder dunkel', await ink(auf));

  ok(!errs.length, 'Keine Fehler in der Seite', errs.slice(0, 4));
  await b.close();
  console.log(f ? 'FAIL ' + f : 'ALLES OK');
  process.exit(f ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
