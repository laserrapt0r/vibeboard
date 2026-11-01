// Lesbarkeit im dunklen Design, Ebenen und Reihenfolge der Frames, Leisten, Texte
const { launch, login, BASE } = require('./lib');
let f = 0;
const ok = (c, m, x) => {
  console.log((c ? 'ok  ' : 'FAIL') + ' ' + m + (c || x === undefined ? '' : ' → ' + JSON.stringify(x).slice(0, 300)));
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
const ratio = (a, b) => {
  const l = (hex) => {
    const n = parseInt(hex.slice(1), 16);
    const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const [x, y] = [l(a), l(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};
const dark = (p, on) =>
  p.evaluate(async (on) => {
    const c = await import('/js/core.js');
    c.app.settings.dark = on;
    c.saveSettings();
    await new Promise((r) => setTimeout(r, 120));
  }, on);
// Farbe des ersten Texts im Element
const ink = (p, id) => p.evaluate((id) => document.querySelector(`g[data-id="${id}"] text`)?.getAttribute('fill'), id);
const move = (p, id, patch) =>
  p.evaluate(
    async (id, patch) => {
      const c = await import('/js/core.js');
      c.setEl({ ...c.getEl(id), ...patch });
      await new Promise((r) => setTimeout(r, 120));
    },
    id,
    patch,
  );
const select = (p, ...ids) =>
  p.evaluate(async (ids) => {
    const c = await import('/js/core.js');
    c.setSelection(ids);
    document.activeElement?.blur();
  }, ids);
const order = (p) => p.evaluate(() => [...document.querySelectorAll('g[data-id]')].map((g) => g.dataset.id));
const el = (p, id) =>
  p.evaluate(async (id) => {
    const c = await import('/js/core.js');
    return JSON.parse(JSON.stringify(c.getEl(id) || null));
  }, id);
const frameList = (p) =>
  p.evaluate(async () => {
    const c = await import('/js/core.js');
    return c.frames().map((x) => ({ id: x.id, title: x.title, order: x.order, x: x.x, y: x.y, w: x.w, h: x.h }));
  });
const openBoard = async (p, elements, name = 'L') => {
  const id = (await api(p, 'POST', '/api/boards', { name, elements })).body.id;
  await p.goto(BASE + '/board/' + id, { waitUntil: 'load' });
  await wait(1200);
  return id;
};
const clickBtn = (p, rx) =>
  p.evaluate((s) => {
    const r = new RegExp(s);
    [...document.querySelectorAll('button')].find((b) => r.test(b.textContent.trim()))?.click();
  }, rx);
(async () => {
  // Chrome ohne Oberfläche meldet sich sonst als Gerät ohne Hover
  const b = await launch(['--blink-settings=primaryHoverType=2,availableHoverTypes=2,primaryPointerType=4,availablePointerTypes=4']);
  const errs = [];
  const A = await b.newPage();
  A.on('pageerror', (e) => errs.push('A ' + e.message));
  await login(A, 'admin@test.example', 'Rotkehlchen-Wolke-47');
  const c2 = await b.createBrowserContext();
  const B = await c2.newPage();
  B.on('pageerror', (e) => errs.push('B ' + e.message));
  await login(B, 'anna@example.org', 'Gewitter-Laterne-83');

  console.log('=== Automatische Farbe im dunklen Design');
  await openBoard(A, [
    { id: 'white', type: 'shape', shape: 'rect', x: 0, y: 0, w: 300, h: 200, fill: '#ffffff', stroke: '#1a1a1a', z: 1, text: '' },
    { id: 'yel', type: 'sticky', x: 500, y: 0, w: 200, h: 200, fill: '#fff9b1', text: '', z: 2 },
    { id: 't1', type: 'text', x: 50, y: 80, w: 200, h: 38, text: 'auf Weiß', fontSize: 24, color: '#1a1a1a', z: 3 },
    { id: 't2', type: 'text', x: 520, y: 80, w: 160, h: 38, text: 'auf Gelb', fontSize: 24, color: '#1a1a1a', z: 3 },
    { id: 't3', type: 'text', x: 1000, y: 80, w: 200, h: 38, text: 'frei', fontSize: 24, color: '#1a1a1a', z: 4 },
    { id: 't4', type: 'text', x: 60, y: 400, w: 200, h: 38, text: 'verdeckt', fontSize: 24, color: '#1a1a1a', z: 1 },
    { id: 'over', type: 'sticky', x: 0, y: 320, w: 300, h: 200, fill: '#ffffff', text: '', z: 9 },
    { id: 'black', type: 'shape', shape: 'rect', x: 1400, y: 0, w: 300, h: 200, fill: '#1a1a1a', stroke: 'none', z: 1, text: '' },
    { id: 't5', type: 'text', x: 1450, y: 80, w: 200, h: 38, text: 'auf Schwarz', fontSize: 24, color: '#1a1a1a', z: 5 },
    { id: 'open', type: 'shape', shape: 'rect', x: 1000, y: 400, w: 200, h: 100, fill: 'transparent', stroke: '#1a1a1a', text: 'ohne Füllung', z: 6 },
    { id: 'fr', type: 'frame', x: 2000, y: 0, w: 600, h: 400, title: 'Rahmen', fill: '#ffffff', z: 1, order: 1 },
    { id: 'open2', type: 'shape', shape: 'rect', x: 2200, y: 100, w: 200, h: 100, fill: 'none', stroke: '#1a1a1a', text: 'im Frame', z: 6 },
  ]);
  await dark(A, true);
  ok((await ink(A, 't1')) === '#1a1a1a', 'Text auf weißer Form ist dunkel', await ink(A, 't1'));
  ok((await ink(A, 't2')) === '#1a1a1a', 'Text auf Notiz ist dunkel', await ink(A, 't2'));
  ok((await ink(A, 't3')) === '#f1f1f1', 'Text auf dem Board bleibt hell', await ink(A, 't3'));
  ok((await ink(A, 't5')) === '#ffffff', 'Text auf schwarzer Form ist hell', await ink(A, 't5'));
  ok((await ink(A, 't4')) === '#f1f1f1', 'Fläche über dem Text zählt nicht als Untergrund', await ink(A, 't4'));
  await move(A, 'white', { x: 3000 });
  ok((await ink(A, 't1')) === '#f1f1f1', 'Form weggeschoben: Text folgt dem neuen Untergrund', await ink(A, 't1'));
  await move(A, 'white', { x: 0 });
  ok((await ink(A, 't1')) === '#1a1a1a', 'Form zurück: Text wieder dunkel', await ink(A, 't1'));
  await move(A, 'white', { fill: '#1a1a1a' });
  ok((await ink(A, 't1')) === '#ffffff', 'Form umgefärbt: Text folgt', await ink(A, 't1'));
  await move(A, 'white', { fill: '#ffffff' });
  await move(A, 't3', { x: 30, y: 80 });
  ok((await ink(A, 't3')) === '#1a1a1a', 'Text auf die Form geschoben: dunkel', await ink(A, 't3'));

  console.log('=== Form ohne Füllung');
  ok((await ink(A, 'open')) === '#f1f1f1', 'Ohne Füllung: hell auf dem dunklen Board', await ink(A, 'open'));
  ok((await ink(A, 'open2')) === '#1a1a1a', 'Ohne Füllung im weißen Frame: dunkel', await ink(A, 'open2'));
  await select(A, 'open');
  await A.keyboard.press('Enter');
  await wait(200);
  const editColor = await A.evaluate(() => getComputedStyle(document.querySelector('#editor, textarea.editor, textarea')).color);
  ok(editColor === 'rgb(241, 241, 241)', 'Der Editor zeigt dieselbe Farbe', editColor);
  await A.keyboard.press('Escape');

  console.log('=== Frame-Titel');
  const title = await A.evaluate(() => document.querySelector('g[data-id="fr"] .frame-title-text').getAttribute('fill'));
  ok(ratio(title, '#1e1f24') >= 4.5, 'Titel im dunklen Design erreicht 4,5:1', title);
  const exported = await A.evaluate(async () => {
    const r = await import('/js/render.js');
    const c = await import('/js/core.js');
    return r.renderSvgDocument([c.getEl('fr')]).svg;
  });
  ok(/frame-title-text[^>]*fill="#6b6b6b"/.test(exported), 'Export bleibt beim hellen Titel');
  await dark(A, false);
  ok((await A.evaluate(() => document.querySelector('g[data-id="fr"] .frame-title-text').getAttribute('fill'))) === '#6b6b6b', 'Helles Design unverändert');
  ok((await ink(A, 't3')) === '#1a1a1a' && (await ink(A, 'open')) === '#1a1a1a', 'Helles Design: Text bleibt dunkel');

  console.log('=== Viele Elemente');
  await A.evaluate(async () => {
    const c = await import('/js/core.js');
    c.app.settings.dark = true;
    c.saveSettings();
    const list = [];
    for (let i = 0; i < 3000; i++) list.push({ id: 'n' + i, type: i % 2 ? 'sticky' : 'text', x: (i % 60) * 220, y: 2000 + Math.floor(i / 60) * 220, w: 200, h: 200, z: 100 + i, fill: '#fff9b1', text: 't', color: '#1a1a1a', fontSize: 16 });
    c.loadElements?.(Object.fromEntries(list.map((e) => [e.id, e])));
  });
  const perf = await A.evaluate(async () => {
    const c = await import('/js/core.js');
    if (c.app.els.size < 3000) return null;
    await new Promise((r) => setTimeout(r, 1500));
    let sum = 0;
    for (let i = 0; i < 20; i++) {
      c.setEl({ ...c.getEl('n1'), x: c.getEl('n1').x + 5 }, false);
      const t = performance.now();
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      sum += performance.now() - t;
    }
    return { mean: sum / 20, n: c.app.els.size };
  });
  if (perf) ok(perf.mean < 120, 'Verschieben auf großem Board bleibt flüssig: ' + Math.round(perf.mean) + ' ms je zwei Bilder', perf);
  else console.log('ok   (Lastprobe übersprungen: loadElements nicht exportiert)');

  console.log('=== contrastText');
  const ct = await A.evaluate(async () => {
    const u = await import('/js/util.js');
    return ['#f59f00', '#12b886', '#e64980', '#4262ff', '#1098ad', '#868e96', '#ffffff', '#1a1a1a', '#fff'].map((c) => [c, u.contrastText(c)]);
  });
  for (const [bg, t] of ct) {
    const other = t === '#ffffff' ? '#1a1a1a' : '#ffffff';
    const hex = bg.length === 4 ? '#ffffff' : bg;
    ok(ratio(hex, t) >= ratio(hex, other), `${bg}: ${t} hat den höheren Kontrast`);
  }

  console.log('=== Mindmap');
  await dark(A, false);
  await openBoard(A, [{ id: 'root', type: 'shape', shape: 'pill', x: 0, y: 0, w: 260, h: 90, fill: '#1a1a1a', stroke: 'none', text: 'Thema', mind: true, z: 1 }]);
  await A.evaluate(async () => {
    const c = await import('/js/core.js');
    c.mindAddChild(c.getEl('root'));
    await new Promise((r) => setTimeout(r, 150));
  });
  const kids = await A.evaluate(async () => {
    const c = await import('/js/core.js');
    return [...c.app.els.values()].filter((e) => e.type === 'shape' && e.id !== 'root').map((e) => ({ tc: e.textColor, fill: e.fill }));
  });
  ok(kids.length > 0 && kids.every((k) => k.tc == null), 'Äste erzwingen keine Schriftfarbe', kids);
  const tpl = await A.evaluate(async () => {
    const { TEMPLATES } = await import('/js/templates.js');
    return TEMPLATES.find((t) => t.id === 'mindmap').build().filter((e) => e.mind && e.type === 'shape').map((e) => e.textColor);
  });
  ok(tpl.length > 0 && tpl.every((x) => x == null), 'Mindmap-Vorlage ebenso', tpl);

  console.log('=== Sperren und Ebenen');
  const id = await openBoard(A, [
    { id: 'under', type: 'sticky', x: 100, y: 100, w: 200, h: 200, fill: '#fff9b1', text: 'u', z: 1, author: 'x' },
    { id: 'mid', type: 'shape', shape: 'rect', x: 150, y: 150, w: 200, h: 200, fill: '#a6ccf5', stroke: '#1a1a1a', z: 2, author: 'x' },
    { id: 'top', type: 'sticky', x: 200, y: 200, w: 200, h: 200, fill: '#93d275', text: 't', z: 3, author: 'x' },
    { id: 'alt', type: 'shape', shape: 'rect', x: 900, y: 100, w: 500, h: 400, fill: '#eaf3fd', stroke: 'none', locked: true, z: 9 },
    { id: 'neu', type: 'shape', shape: 'rect', x: 900, y: 600, w: 500, h: 400, fill: '#eaf3fd', stroke: 'none', locked: 'text', backdrop: true, z: 9 },
    { id: 'o1', type: 'sticky', x: 950, y: 150, w: 100, h: 100, fill: '#fff9b1', text: '', z: 5, author: 'x' },
    { id: 'o2', type: 'sticky', x: 950, y: 650, w: 100, h: 100, fill: '#fff9b1', text: '', z: 5, author: 'x' },
    { id: 'same1', type: 'sticky', x: 100, y: 700, w: 100, h: 100, fill: '#fff9b1', text: '', z: 7, author: 'x' },
    { id: 'same2', type: 'sticky', x: 120, y: 720, w: 100, h: 100, fill: '#fff9b1', text: '', z: 7, author: 'x' },
  ]);
  await api(A, 'POST', `/api/boards/${id}/members`, { email: 'anna@example.org', role: 'editor' });
  await B.goto(BASE + '/board/' + id, { waitUntil: 'load' });
  await wait(1300);
  await A.bringToFront();
  const before = await order(A);
  ok(JSON.stringify(before) === JSON.stringify(await order(B)), 'Beide sehen dieselbe Reihenfolge, auch bei gleichem z', [before, await order(B)]);
  ok(before.indexOf('alt') < before.indexOf('o1') && before.indexOf('neu') < before.indexOf('o2'), 'Vorlagenflächen liegen unter den Inhalten (alt und neu)', before);
  await select(A, 'mid');
  await A.keyboard.down('Control');
  await A.keyboard.press('l');
  await A.keyboard.up('Control');
  await wait(700);
  ok((await el(A, 'mid')).locked === true, 'Strg+L sperrt');
  ok(JSON.stringify(await order(A)) === JSON.stringify(before), 'Sperren ändert die Ebene nicht', await order(A));
  ok(JSON.stringify(await order(B)) === JSON.stringify(before), 'Auch nicht bei der anderen Person', await order(B));
  await A.reload({ waitUntil: 'load' });
  await wait(1300);
  ok(JSON.stringify(await order(A)) === JSON.stringify(before), 'Auch nicht nach dem Neuladen', await order(A));

  console.log('=== Ebenen per Tastatur');
  await select(A, 'mid');
  const z0 = (await el(A, 'mid')).z;
  await A.keyboard.down('Control');
  await A.keyboard.press(']');
  await A.keyboard.up('Control');
  await wait(200);
  ok((await el(A, 'mid')).z === z0, 'Strg+] lässt Gesperrtes liegen');
  ok(/unverändert/.test(await A.evaluate(() => document.getElementById('toast')?.textContent)), 'Das wird gemeldet');
  await A.keyboard.down('Control');
  await A.keyboard.press('[');
  await A.keyboard.up('Control');
  await wait(200);
  ok((await el(A, 'mid')).z === z0, 'Strg+[ ebenso');
  await select(A, 'mid', 'under');
  await A.keyboard.down('Control');
  await A.keyboard.press(']');
  await A.keyboard.up('Control');
  await wait(300);
  ok((await el(A, 'mid')).z === z0 && (await el(A, 'under')).z > 9, 'Gemischte Auswahl: Nur Freies wandert', [await el(A, 'under')]);

  console.log('=== Frames aus Vorlagen');
  const vor = ['Links', 'Mitte', 'Rechts'].map((t, i) => ({ id: 'v' + i, type: 'frame', x: i * 1400, y: 0, w: 1280, h: 720, title: t, fill: '#ffffff', z: i + 1 }));
  await openBoard(A, vor);
  await A.evaluate(() => document.querySelector('[data-panel=frames]')?.click());
  await wait(300);
  const titles0 = (await frameList(A)).map((x) => x.title);
  await clickBtn(A, '^Frame$');
  await wait(900);
  let fl = await frameList(A);
  ok(fl.length === 4 && fl.at(-1).title === 'Frame 4', 'Neuer Frame steht hinten', fl);
  ok(JSON.stringify(fl.slice(0, 3).map((x) => x.title)) === JSON.stringify(titles0), 'Die Lage bestimmt die übrigen Plätze');
  ok(fl.every((x, i) => x.order === i + 1), 'Fehlende Nummern sind aufgefüllt', fl.map((x) => x.order));
  const side = await A.evaluate(() => [...document.querySelectorAll('.frame-name')].map((n) => n.textContent));
  ok(JSON.stringify(side) === JSON.stringify(fl.map((x) => x.title)), 'Liste zeigt dieselbe Reihenfolge', side);
  const last = fl[2], nw = fl[3];
  ok(nw.x >= last.x + last.w && nw.y === last.y, 'Neben dem letzten Frame', [last, nw]);
  await clickBtn(A, '^Frame$');
  await wait(600);
  fl = await frameList(A);
  const cross = (p, q) => p.x < q.x + q.w && q.x < p.x + p.w && p.y < q.y + q.h && q.y < p.y + p.h;
  ok(!fl.some((p, i) => fl.some((q, j) => i < j && cross(p, q))), 'Keine zwei Frames liegen aufeinander', fl);
  await A.evaluate(async () => {
    const c = await import('/js/core.js');
    c.undo();
    c.undo();
  });
  await wait(300);
  ok((await frameList(A)).length === 3, 'Rückgängig nimmt die neuen Frames in einem Schritt je Frame zurück', await frameList(A));

  console.log('=== Nummern und Kopien');
  await openBoard(A, [1, 2, 3].map((n) => ({ id: 'f' + n, type: 'frame', x: n * 1400, y: 0, w: 1280, h: 720, title: 'Frame ' + n, fill: '#ffffff', order: n, z: n })));
  await A.evaluate(async () => {
    const c = await import('/js/core.js');
    c.deleteEl('f2');
  });
  await A.evaluate(() => document.querySelector('[data-panel=frames]')?.click());
  await wait(300);
  await clickBtn(A, '^Frame$');
  await wait(700);
  fl = await frameList(A);
  ok(new Set(fl.map((x) => x.title)).size === fl.length, 'Nach dem Löschen keine doppelten Namen', fl.map((x) => x.title));
  await select(A, 'f1');
  await A.keyboard.down('Control');
  await A.keyboard.press('d');
  await A.keyboard.up('Control');
  await wait(700);
  fl = await frameList(A);
  ok(fl[0].id === 'f1' && fl[1].id !== 'f3' && fl[2].id === 'f3', 'Kopie steht direkt hinter dem Original', fl.map((x) => x.title));
  ok(new Set(fl.map((x) => x.title)).size === fl.length, 'Kopie hat einen eigenen Namen', fl.map((x) => x.title));
  ok(new Set(fl.map((x) => x.order)).size === fl.length, 'Jede Stelle gibt es einmal', fl.map((x) => x.order));
  await move(A, 'f3', { title: 'Mein Titel 7' });
  await select(A, 'f3');
  await A.keyboard.down('Control');
  await A.keyboard.press('d');
  await A.keyboard.up('Control');
  await wait(500);
  ok((await frameList(A)).filter((x) => x.title === 'Mein Titel 7').length === 2, 'Frei benannte Titel bleiben');

  console.log('=== Präsentation');
  await A.evaluate(async () => {
    const c = await import('/js/core.js');
    c.setSelection([]);
    c.app.emit('present', null);
  });
  await wait(400);
  const bar = () =>
    A.evaluate(() => {
      const p = document.getElementById('present-bar');
      return { o: Number(getComputedStyle(p).opacity), idle: p.classList.contains('idle'), hoverNone: matchMedia('(hover: none)').matches, t: p.querySelector('span').textContent, next: p.querySelectorAll('button')[1].disabled, back: p.querySelectorAll('button')[0].disabled };
    });
  let s = await bar();
  ok(s.o === 1, 'Leiste beim Start voll sichtbar', s);
  ok(s.back && !s.next, 'Erste Folie: Zurück aus, Weiter an', s);
  const seen = [];
  const total = (await frameList(A)).length;
  for (let i = 0; i < total; i++) {
    seen.push((await bar()).t.split('· ')[1]);
    if (i < total - 1) {
      await A.keyboard.press('ArrowRight');
      await wait(120);
    }
  }
  ok(JSON.stringify(seen) === JSON.stringify((await frameList(A)).map((x) => x.title)), 'Folien folgen der Liste', seen);
  s = await bar();
  ok(s.next && !s.back, 'Letzte Folie: Weiter ist aus', s);
  await wait(3500);
  s = await bar();
  ok(s.o < 0.3, 'Ohne Aktivität tritt die Leiste zurück', s);
  await A.mouse.move(300, 300);
  await A.mouse.move(320, 320);
  await wait(350);
  ok((await bar()).o === 1, 'Mausbewegung zeigt sie wieder');
  await wait(3500);
  await A.keyboard.press('Tab');
  await wait(350);
  ok((await bar()).o === 1, 'Tastatur zeigt sie wieder');
  await wait(3500);
  ok((await bar()).o === 1 || (await A.evaluate(() => !document.getElementById('present-bar').contains(document.activeElement))), 'Solange der Fokus in der Leiste steht, bleibt sie sichtbar');
  await A.keyboard.press('Escape');
  await wait(300);

  console.log('=== Einpassen');
  await openBoard(A, [{ id: 'wide', type: 'sticky', x: 0, y: 0, w: 2400, h: 1200, fill: '#fff9b1', text: '', z: 1 }]);
  await A.keyboard.down('Shift');
  await A.keyboard.press('Digit1');
  await A.keyboard.up('Shift');
  await wait(600);
  const fit = () =>
    A.evaluate(() => {
      const r = document.querySelector('g[data-id="wide"]').getBoundingClientRect();
      const box = (s) => document.querySelector(s).getBoundingClientRect();
      return { l: r.left, t: r.top, b: r.bottom, tools: box('#tools').right, top: box('#topbar').bottom, low: box('#bottom-left').top };
    });
  let fi = await fit();
  ok(fi.l >= fi.tools, 'Nichts liegt unter der Werkzeugleiste', fi);
  ok(fi.t >= fi.top && fi.b <= fi.low, 'Auch nicht unter Kopf- und Fußzeile', fi);

  console.log('=== Handy');
  const P = await b.newPage();
  P.on('pageerror', (e) => errs.push('P ' + e.message));
  await P.goto(BASE + '/login', { waitUntil: 'load' });
  const cook = await A.cookies();
  await P.setCookie(...cook);
  await P.emulate({ viewport: { width: 390, height: 844, isMobile: true, hasTouch: true }, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile' });
  const hid = await openBoard(P, [
    { id: 'n', type: 'sticky', x: 0, y: 0, w: 200, h: 200, fill: '#fff9b1', text: 'x', z: 1 },
    { id: 'pf', type: 'frame', x: 0, y: 400, w: 800, h: 600, title: 'Frame 1', fill: '#ffffff', order: 1, z: 1 },
  ]);
  await P.evaluate(async () => {
    const c = await import('/js/core.js');
    c.fitAll(false);
    c.setSelection(['n']);
    document.querySelector('[data-panel=frames]')?.click();
  });
  await wait(500);
  const top = await P.evaluate(() => {
    const bar = document.getElementById('ctxbar').getBoundingClientRect();
    const hit = document.elementFromPoint(bar.left + bar.width / 2, bar.top + bar.height / 2);
    return { sidepanel: !!hit?.closest('#sidepanel'), ctx: !!hit?.closest('#ctxbar'), hasBar: bar.height > 0 };
  });
  ok(!top.ctx, 'Die Kontextleiste liegt nicht über dem Panel', top);
  await P.evaluate(async () => {
    const c = await import('/js/core.js');
    c.setSelection([]);
    document.querySelector('[data-panel=frames]')?.click();
    await new Promise((r) => setTimeout(r, 150));
    c.fitAll(false);
  });
  await wait(300);
  const pf = await P.evaluate(() => {
    const r = document.querySelector('g[data-id="pf"]').getBoundingClientRect();
    return { t: r.top, b: r.bottom, tools: document.getElementById('tools').getBoundingClientRect().top, head: document.getElementById('topright').getBoundingClientRect().bottom };
  });
  ok(pf.b <= pf.tools && pf.t >= pf.head - 40, 'Einpassen auf dem Handy lässt die Leisten frei', pf);
  await P.evaluate(async () => {
    const c = await import('/js/core.js');
    c.app.emit('present', null);
  });
  await wait(3600);
  const touch = await P.evaluate(() => {
    const p = document.getElementById('present-bar');
    return { idle: p.classList.contains('idle'), o: getComputedStyle(p).opacity, none: matchMedia('(hover: none)').matches };
  });
  ok(touch.idle && touch.none && touch.o === '1', 'Touch: Die Leiste bleibt voll sichtbar', touch);
  await P.evaluate(() => document.exitFullscreen?.().catch(() => {}));
  await P.keyboard.press('Escape');
  await P.goto(BASE + '/board/' + hid, { waitUntil: 'load' });
  await wait(1000);
  const overlap = async (p) => {
    await p.evaluate(async () => {
      const c = await import('/js/collab.js');
      c.setVoting({ active: true, votesPerUser: 3, title: 'Eine Abstimmung mit etwas längerem Titel', votes: {} });
      const u = await import('/js/util.js');
      u.toast('Meldung', 4000);
    });
    await wait(350);
    return p.evaluate(() => {
      const t = document.getElementById('toast').getBoundingClientRect();
      const v = document.getElementById('voting-banner').getBoundingClientRect();
      return { toast: [t.top, t.bottom], banner: [v.top, v.bottom] };
    });
  };
  let lap = await overlap(P);
  ok(lap.toast[1] <= lap.banner[0], 'Handy: Meldung liegt über dem Banner', lap);
  await P.evaluate(async () => {
    const c = await import('/js/collab.js');
    c.setVoting(null);
  });
  await P.close();

  console.log('=== Meldung und Banner');
  await A.bringToFront();
  await A.goto(BASE + '/board/' + hid, { waitUntil: 'load' });
  await wait(1000);
  lap = await overlap(A);
  ok(lap.toast[1] <= lap.banner[0], 'Meldung liegt über dem Banner', lap);
  await A.evaluate(async () => {
    const c = await import('/js/collab.js');
    c.setVoting(null);
  });
  await wait(200);

  console.log('=== Dialoge');
  await A.evaluate(async () => {
    const u = await import('/js/ui.js');
    u.openTemplates();
  });
  await wait(400);
  const ring = await A.evaluate(() => {
    const i = document.querySelector('.tpl-search');
    i.focus();
    const s = i.closest('.tpl-side').getBoundingClientRect(), r = i.getBoundingClientRect(), cs = getComputedStyle(i);
    return { top: r.top - s.top, left: r.left - s.left, need: parseFloat(cs.outlineWidth) + parseFloat(cs.outlineOffset) };
  });
  ok(ring.top >= ring.need && ring.left >= ring.need, 'Fokusring des Suchfelds passt in den Bereich', ring);
  await A.keyboard.press('Escape');
  await wait(250);
  await A.evaluate(async () => {
    document.activeElement?.blur();
    const u = await import('/js/ui.js');
    u.openShortcuts();
  });
  await wait(400);
  const keys = await A.evaluate(() => {
    const rows = [...document.querySelectorAll('.shortcuts tr')];
    const bad = rows.filter((r) => r.querySelector('kbd').getBoundingClientRect().right > r.children[1].getBoundingClientRect().left + 0.5).map((r) => r.textContent);
    return { bad, text: document.querySelector('.shortcuts').textContent };
  });
  ok(!keys.bad.length, 'Spalten überlappen sich nicht', keys.bad);
  ok(/Ganz nach vorn \/ ganz nach hinten/.test(keys.text) && !/Vorder-\/Hintergrund|Nach vorne/.test(keys.text), 'Kürzel sind zusammengelegt und richtig benannt');
  await A.keyboard.press('Escape');
  await wait(250);

  console.log('=== Texte');
  await openBoard(A, [{ id: 'one', type: 'frame', x: 0, y: 0, w: 800, h: 600, title: 'Frame 1', fill: '#ffffff', order: 1, z: 1 }]);
  await A.keyboard.down('Control');
  await A.keyboard.press('k');
  await A.keyboard.up('Control');
  await wait(300);
  await A.keyboard.type('Mermaid');
  await wait(300);
  const row = await A.evaluate(() => {
    const li = document.querySelector('.palette-item');
    return { label: li?.querySelector('.palette-label').textContent, hint: li?.querySelector('.small').textContent };
  });
  ok(/Mermaid-Syntax/.test(row.label) && row.hint !== 'Mermaid-Syntax', 'Klammern ohne Kürzel bleiben im Namen', row);
  await A.keyboard.press('Escape');
  await wait(200);
  await A.keyboard.down('Control');
  await A.keyboard.press('k');
  await A.keyboard.up('Control');
  await wait(300);
  await A.keyboard.type('Suchen');
  await wait(300);
  const row2 = await A.evaluate(() => [...document.querySelectorAll('.palette-item')].map((li) => [li.querySelector('.palette-label').textContent, li.querySelector('.small').textContent]));
  ok(row2.some(([l, h]) => l === 'Suchen' && h === 'Strg+F'), 'Echte Kürzel stehen weiter in der Kürzelspalte', row2);
  await A.keyboard.press('Escape');
  await wait(200);
  const words = await A.evaluate(async () => {
    const src = await (await fetch('/js/retro.js')).text();
    const ui = await (await fetch('/js/ui.js')).text();
    return { retro: /\(1 Stimme\)/.test(src), ui: /1 Folie exportiert/.test(ui) };
  });
  ok(words.retro && words.ui, 'Einzahl als eigener Satz im Code', words);
  const en = await A.evaluate(async () => {
    const d = await (await fetch('/i18n/en.json')).json();
    return [d['1 Folie exportiert'], d['{0}: Ø {1} (1 Stimme)'], d['Frame {0}']];
  });
  ok(en.every(Boolean), 'Übersetzungen vorhanden', en);

  console.log('Fehler:', errs.length ? errs.slice(0, 4) : 'keine');
  ok(!errs.length, 'Keine Fehler im Browser', errs);
  await b.close();
  console.log(f ? 'FAIL ' + f : 'ALLES OK');
  process.exit(f ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
