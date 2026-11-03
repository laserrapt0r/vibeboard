// Allgemeine Symbole: Laden bei Bedarf, Panel, Suche, Einfügen, Format, zwei Personen, Exporte, Rechte, unbekannte Namen
const { launch, BASE } = require('./lib');
const fs = require('fs');
const path = require('path');
let f = 0;
const ok = (c, m, x) => {
  console.log((c ? 'ok  ' : 'FAIL') + ' ' + m + (c || x === undefined ? '' : ' → ' + JSON.stringify(x).slice(0, 300)));
  if (!c) f++;
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const SHOTS = process.env.SHOTS || '';
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
const ev = (p, fn, ...a) => p.evaluate(fn, ...a);
const shot = async (p, name) => SHOTS && p.screenshot({ path: path.join(SHOTS, name + '.png') });
const board = async (p, name) => {
  const id = (await api(p, 'POST', '/api/boards', { name })).body.id;
  await p.goto(BASE + '/board/' + id, { waitUntil: 'load' });
  await wait(1200);
  await ev(p, () => document.querySelector('#empty-start .btn:last-child')?.click());
  return id;
};
const icons = (p) => ev(p, async () => [...(await import('/js/core.js')).app.els.values()].filter((e) => e.type === 'shape' && String(e.shape).startsWith('ti-')).map((e) => JSON.parse(JSON.stringify(e))));
const painted = (p, id) => ev(p, (id) => {
  const g = document.querySelector(`[data-id="${id}"] g[transform] path`)?.parentElement;
  return g ? { paths: g.querySelectorAll('path').length, stroke: g.getAttribute('stroke'), sw: g.getAttribute('stroke-width'), t: g.getAttribute('transform') } : null;
}, id);
const openPanel = (p) => ev(p, async () => {
  const s = await import('/js/shapes-panel.js');
  const t0 = performance.now();
  s.openShapesPanel();
  await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
  return Math.round(performance.now() - t0);
});
const iconsReady = (p) => p.waitForFunction(async () => (await import('/js/icons.js')).iconsLoaded(), { timeout: 8000 });
const hits = async (p, q) => {
  await ev(p, () => {
    const i = document.querySelector('.shape-search input');
    i.value = '';
    i.focus();
  });
  await p.keyboard.type(q);
  await wait(80);
  return ev(p, () => [...document.querySelectorAll('#sidepanel .shape-btn')].filter((b) => b.offsetParent).map((b) => b.dataset.shape));
};
const button = (p, k) => ev(p, (k) => {
  const r = document.querySelector(`#sidepanel .shape-btn[data-shape="${k}"]`)?.getBoundingClientRect();
  return r ? { x: r.x + r.width / 2, y: r.y + r.height / 2 } : null;
}, k);
const ctxTitles = (p) => ev(p, () => [...document.querySelectorAll('#ctxbar button')].map((x) => x.title).filter(Boolean));
const screenOf = (p, id) => ev(p, (id) => {
  const r = document.querySelector(`[data-id="${id}"] .hit`).getBoundingClientRect();
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
}, id);

(async () => {
  const b = await launch();
  const errs = [];
  const A = await b.newPage();
  A.on('pageerror', (e) => errs.push('A ' + e.message));
  await A.setViewport({ width: 1400, height: 950 });
  await login(A, 'admin@test.example', 'Rotkehlchen-Wolke-47');
  await api(A, 'PUT', '/api/admin/settings', { design: { shapePacksOff: '' } });
  await api(A, 'PUT', '/api/auth/me/shape-packs', { off: [] });
  const fetched = [];
  A.on('response', (r) => /vendor\/icons|icon-motive/.test(r.url()) && fetched.push(r.url()));

  console.log('=== Laden nur bei Bedarf');
  const boardId = await board(A, 'Symbole');
  await wait(800);
  ok(fetched.length === 0, 'Eine Boardseite lädt die Symboldatei nicht', fetched);
  const startSize = await ev(A, () => performance.getEntriesByType('resource').filter((r) => /icons\.js/.test(r.name)).map((r) => r.decodedBodySize));
  // Seit 4.19.0 kennt das Modul mehrere Symbolsätze, Daten bringt es weiter keine mit
  ok(startSize.length === 1 && startSize[0] < 10000, 'Im Start bleibt nur das kleine Modul', startSize);

  console.log('=== Panel');
  const first = await openPanel(A);
  console.log('    erstes Öffnen ms: ' + first);
  ok(first < 200, 'Panel öffnet unter 200 ms, auch beim ersten Mal', first);
  await iconsReady(A);
  await wait(100);
  ok(fetched.some((u) => /tabler-outline/.test(u)), 'Das Panel lädt die Symboldatei', fetched);
  const file = fetched.find((u) => /tabler-outline/.test(u));
  const head = await ev(A, async (u) => {
    const r = await fetch(u, { cache: 'reload' });
    const data = await r.clone().json();
    return { cache: r.headers.get('cache-control'), enc: r.headers.get('content-encoding'), type: r.headers.get('content-type'), n: data.icons.length, version: data.version, license: data.license, comp: performance.getEntriesByName(u).pop()?.encodedBodySize };
  }, file);
  console.log('    Datei: ' + JSON.stringify(head));
  ok(head.n > 4500 && head.license === 'MIT' && /immutable/.test(head.cache) && head.enc === 'gzip', 'Datei ist gepackt, dauerhaft cachebar, MIT', head);
  const csp = await ev(A, async () => (await fetch(location.href)).headers.get('content-security-policy'));
  ok(/script-src 'self'(;|$)/.test(csp) && !/unsafe-eval/.test(csp), 'CSP unverändert streng', csp);
  const subs = await ev(A, () => [...document.querySelectorAll('.shape-sub-head .shape-group-name')].map((x) => x.textContent));
  ok(subs.length === 14 && ['Pfeile und Navigation', 'Kommunikation', 'Personen', 'Dateien', 'Geräte', 'Geschäft', 'Wetter', 'Zeit'].every((n) => subs.includes(n)), 'Untergruppen sind da', subs);
  await ev(A, () => [...document.querySelectorAll('.shape-sub-head[aria-expanded="false"]')].forEach((x) => x.click()));
  await wait(150);
  const open = await ev(A, () => ({ all: document.querySelectorAll('#sidepanel .shape-btn').length, tip: document.querySelector('.shape-sub .shape-btn')?.dataset.tip }));
  ok(open.all < 14 * 60 + 200, 'Auch alle Gruppen offen: nur die ersten Knöpfe stehen im DOM', open);
  await shot(A, 'panel-hell');
  await ev(A, () => document.querySelector('#sidepanel .shape-more:not([hidden])').scrollIntoView({ block: 'center' }));
  await wait(300);
  const later = await ev(A, () => document.querySelectorAll('#sidepanel .shape-btn').length);
  ok(later > open.all, 'Beim Scrollen kommen weitere Symbole dazu', [open.all, later]);
  await ev(A, () => [...document.querySelectorAll('.shape-sub-head[aria-expanded="true"]')].slice(1).forEach((x) => x.click()));
  await ev(A, async () => (await import('/js/ui.js')).toggleSidePanel('shapes'));
  const again = await openPanel(A);
  console.log('    erneutes Öffnen ms: ' + again);
  ok(again < 200, 'Erneutes Öffnen unter 200 ms', again);

  console.log('=== Suche');
  const de = { glocke: 'ti-bell', telefon: 'ti-phone', 'daumen hoch': 'ti-thumb-up', haus: 'ti-home', person: 'ti-user', mail: 'ti-mail', kalender: 'ti-calendar', ordner: 'ti-folder', schloss: 'ti-lock', stern: 'ti-star', sprechblase: 'ti-message', pfeil: 'ti-arrow-right' };
  for (const [q, k] of Object.entries(de)) {
    const r = await hits(A, q);
    ok(r.slice(0, 40).includes(k), `„${q}“ findet ${k}`, r.slice(0, 12));
  }
  let r = await hits(A, 'sprechblase');
  ok(r.includes('callout') && r.some((k) => k.startsWith('ti-')), 'Formen und Symbole stehen zusammen in den Treffern', r.slice(0, 8));
  r = await hits(A, 'klingl');
  ok(r.includes('ti-bell'), 'Vertipper auf Deutsch', r.slice(0, 8));
  r = await hits(A, 'bell');
  ok(r.filter((k) => k.startsWith('ti-'))[0] === 'ti-bell', 'Englisch: genauer Name zuerst', r.slice(0, 8));
  r = await hits(A, 'notification');
  ok(r.includes('ti-bell'), 'Englisch über die Stichwörter', r.slice(0, 8));
  r = await hits(A, 'campana');
  ok(r.includes('ti-bell'), 'Spanisch für häufige Motive', r.slice(0, 8));
  r = await hits(A, 'cloche');
  ok(r.includes('ti-bell'), 'Französisch für häufige Motive', r.slice(0, 8));
  const speed = await ev(A, async () => {
    const s = await import('/js/shapes-panel.js');
    const out = [];
    for (const q of ['p', 'pf', 'glocke', 'arrow right', 'kalendr']) {
      const t0 = performance.now();
      s.searchIcons(q);
      out.push(Math.round(performance.now() - t0));
    }
    return out;
  });
  console.log('    Suche ms: ' + speed);
  ok(Math.max(...speed) < 120, 'Suche über alle Symbole bleibt flüssig', speed);
  const list = await ev(A, async () => {
    const m = await import('/js/icon-motive.js');
    return Object.keys(m.MOTIVE).length;
  });
  ok(list >= 400, 'Deutsche Liste hat mindestens 400 Motive', list);
  await hits(A, 'glocke');
  const tip = await ev(A, () => document.querySelector('#sidepanel .shape-btn[data-shape="ti-bell"]').dataset.tip);
  ok(tip === 'Glocke', 'Tooltip nennt den Namen', tip);

  console.log('=== Einfügen');
  let p = await button(A, 'ti-bell');
  await A.mouse.click(p.x, p.y);
  await wait(100);
  await A.mouse.click(500, 300);
  await wait(500);
  let els = await icons(A);
  ok(els.length === 1 && els[0].shape === 'ti-bell', 'Klick und Klick aufs Board', els);
  ok(els[0].w === 96 && els[0].h === 96 && els[0].fill === 'transparent', 'Standardwerte', els[0]);
  ok(!(await ev(A, async () => (await import('/js/core.js')).app.editing)), 'Kein Texteditor nach dem Einfügen');
  const one = els[0].id;
  let look = await painted(A, one);
  ok(look && look.paths === 2 && look.stroke === '#1a1a1a', 'Pfade aus der Datei, Linienfarbe gesetzt', look);
  await hits(A, 'telefon');
  p = await button(A, 'ti-phone');
  await A.mouse.move(p.x, p.y);
  await A.mouse.down();
  await A.mouse.move(p.x - 200, p.y, { steps: 3 });
  await A.mouse.move(800, 500, { steps: 5 });
  await A.mouse.up();
  await wait(500);
  els = await icons(A);
  const dropped = await ev(A, () => {
    const r = [...document.querySelectorAll('[data-id] g[transform]')].map((g) => g.getBoundingClientRect()).find((x) => x.x > 700 && x.x < 900);
    return r ? { x: r.x + r.width / 2, y: r.y + r.height / 2 } : null;
  });
  ok(els.length === 2 && els.some((e) => e.shape === 'ti-phone') && dropped && Math.abs(dropped.x - 800) < 30 && Math.abs(dropped.y - 500) < 30, 'Ziehen aufs Board legt das Symbol unter dem Zeiger ab', [els.map((e) => [e.shape, e.x, e.y]), dropped]);
  await hits(A, 'stern');
  await ev(A, () => document.querySelector('#sidepanel .shape-btn[data-shape="ti-star"]').focus());
  await A.keyboard.press('Enter');
  await wait(500);
  els = await icons(A);
  ok(els.some((e) => e.shape === 'ti-star'), 'Enter legt in die Mitte', els.map((e) => e.shape));
  const recent = await ev(A, async () => (await import('/js/core.js')).app.toolOpts.recentShapes);
  ok(recent.includes('ti-bell') && recent.includes('ti-star'), 'Zuletzt verwendet merkt sich Symbole', recent);
  await ev(A, async () => (await import('/js/ui.js')).toggleSidePanel('shapes'));
  const star = els.find((e) => e.shape === 'ti-star').id;

  console.log('=== Rückgängig');
  await ev(A, async () => (await import('/js/core.js')).setSelection([]));
  await A.mouse.click(1000, 800);
  await A.keyboard.down('Control');
  await A.keyboard.press('z');
  await A.keyboard.up('Control');
  await wait(300);
  ok(!(await icons(A)).some((e) => e.shape === 'ti-star'), 'Rückgängig entfernt das Symbol');
  await A.keyboard.down('Control');
  await A.keyboard.press('y');
  await A.keyboard.up('Control');
  await wait(300);
  ok((await icons(A)).some((e) => e.id === star) && (await painted(A, star))?.paths > 0, 'Wiederholen bringt es zurück');

  console.log('=== Farbe und Größe');
  const pos = await screenOf(A, one);
  await A.mouse.click(pos.x, pos.y);
  await wait(300);
  await ev(A, () => [...document.querySelectorAll('#ctxbar button')].find((x) => x.title === 'Farbe').click());
  await wait(200);
  const bar = await ctxTitles(A);
  ok(bar.includes('Linienfarbe') && bar.includes('Linienstärke') && !bar.includes('Füllfarbe') && !bar.includes('Linienstil'), 'Leiste zeigt Linie, keine Füllung', bar);
  await ev(A, () => [...document.querySelectorAll('#ctxbar button')].find((x) => x.title === 'Linienfarbe').click());
  await wait(150);
  const color = await ev(A, () => [...document.querySelectorAll('.popover .swatch[data-color]')].map((x) => x.dataset.color).find((c) => !['#1a1a1a', '#ffffff', '#e6e6e6', '#f1f1f1'].includes(c)));
  await ev(A, (c) => document.querySelector(`.popover .swatch[data-color="${c}"]`).click(), color);
  await wait(300);
  ok((await painted(A, one)).stroke === color, 'Linienfarbe ändert das Symbol', [color, await painted(A, one)]);
  if (!(await ctxTitles(A)).includes('Linienstärke')) await ev(A, () => [...document.querySelectorAll('#ctxbar button')].find((x) => x.title === 'Farbe').click());
  await wait(150);
  await ev(A, () => [...document.querySelectorAll('#ctxbar button')].find((x) => x.title === 'Linienstärke').click());
  await wait(150);
  await ev(A, () => [...document.querySelectorAll('.popover [role^=menuitem]')].find((x) => /Fett/.test(x.textContent)).click());
  await wait(300);
  ok((await painted(A, one)).sw === '3', 'Strichstärke', await painted(A, one));
  await ev(A, async (id) => {
    const c = await import('/js/core.js');
    c.act(() => c.setEl({ ...c.getEl(id), w: 192, h: 240 }));
  }, one);
  await wait(300);
  look = await painted(A, one);
  ok(/scale\(8\)/.test(look.t), 'Größe: gleichmäßig skaliert, nicht verzerrt', look);
  const anchor = await ev(A, async (id) => {
    const r = await import('/js/render.js');
    const c = await import('/js/core.js');
    const e = c.getEl(id);
    return { right: r.sideAnchor(e, 'right'), e: [e.x, e.y, e.w, e.h] };
  }, one);
  ok(anchor.right.x === anchor.e[0] + anchor.e[2], 'Andockpunkte liegen auf dem Rahmen', anchor);
  const line = await ev(A, async (id) => {
    const c = await import('/js/core.js');
    const r = await import('/js/render.js');
    const l = c.makeElement('connector', 0, 0, { id: 'lin1', from: { id, side: 'right' }, to: { x: 1200, y: 300 } });
    c.addElements([l], { select: false });
    return !!r.connectorGeom(c.getEl('lin1'), c.getEl);
  }, one);
  ok(line, 'Linie dockt am Symbol an');

  console.log('=== Beschriftung, Kopie, Format');
  await ev(A, async (id) => (await import('/js/core.js')).startEdit(id), one);
  await wait(200);
  await A.keyboard.type('Hinweis');
  await A.keyboard.press('Escape');
  await wait(400);
  const label = await ev(A, (id) => {
    const t = document.querySelector(`[data-id="${id}"] text`);
    return { text: t?.textContent, y: t?.getBoundingClientRect().y, bottom: document.querySelector(`[data-id="${id}"] .hit`).getBoundingClientRect().bottom };
  }, one);
  ok(label.text === 'Hinweis' && label.y >= label.bottom, 'Beschriftung steht unter dem Symbol', label);
  await ev(A, async (id) => {
    const c = await import('/js/core.js');
    c.setSelection([id]);
    c.duplicateEls([c.getEl(id)], 300, 0);
  }, one);
  await wait(400);
  els = await icons(A);
  const dup = els.find((e) => e.id !== one && e.text === 'Hinweis');
  ok(dup && dup.stroke === color && (await painted(A, dup.id))?.paths === 2, 'Kopie behält Symbol, Farbe und Text', dup);
  const fmt = await ev(A, async ({ one, star }) => {
    const c = await import('/js/core.js');
    const rect = c.makeElement('shape', 0, 0, { id: 'rect1', shape: 'rect', x: 1000, y: 600, fill: '#ffd43b', stroke: '#e03131', strokeWidth: 8 });
    c.addElements([rect], { select: false });
    c.setSelection([one]);
    c.copyFormat();
    c.setSelection([star]);
    c.pasteFormat();
    c.setSelection(['rect1']);
    c.pasteFormat();
    const toRect = { ...c.getEl('rect1') }, toIcon = { ...c.getEl(star) };
    c.copyFormat();
    c.setSelection([star]);
    c.pasteFormat();
    return { toRect, toIcon, back: { ...c.getEl(star) } };
  }, { one, star });
  ok(fmt.toIcon.shape === 'ti-star' && fmt.toIcon.stroke === color && fmt.toIcon.fill === 'transparent', 'Format übertragen: Symbol nimmt die Linie an und bleibt ein Symbol', fmt.toIcon);
  ok(fmt.toRect.shape === 'rect' && fmt.toRect.fill === '#ffd43b' && fmt.toRect.stroke === color, 'Format übertragen auf eine Form: Sie bleibt Form und behält die Füllung', fmt.toRect);
  ok(fmt.back.shape === 'ti-star' && fmt.back.fill === 'transparent', 'Format von einer Form auf ein Symbol: keine Füllung', fmt.back);
  const menu = await ev(A, async (star) => {
    const c = await import('/js/core.js');
    c.setSelection([star]);
    await new Promise((r) => setTimeout(r, 200));
    document.querySelector('#ctxbar [data-more]').click();
    await new Promise((r) => setTimeout(r, 150));
    const t = [...document.querySelectorAll('.popover [role^=menuitem]')].map((x) => x.textContent);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    return t;
  }, star);
  ok(!menu.some((t) => /Form ändern/.test(t)), 'Symbole bieten kein „Form ändern“', menu);
  await A.keyboard.press('Escape');

  console.log('=== Kontrast');
  const ink = await ev(A, async () => {
    const c = await import('/js/core.js');
    const dark = c.makeElement('shape', 0, 0, { id: 'dunkel', shape: 'rect', x: -600, y: 100, w: 300, h: 300, fill: '#1a1a1a', stroke: '#1a1a1a' });
    const on = c.makeElement('shape', 0, 0, { id: 'aufdunkel', shape: 'ti-bell', x: -500, y: 200 });
    c.addElements([dark, on], { select: false });
    await new Promise((r) => setTimeout(r, 300));
    return document.querySelector('[data-id="aufdunkel"] g[transform]').getAttribute('stroke');
  });
  ok(ink === '#ffffff', 'Auf dunkler Fläche wird die Linie hell', ink);
  await wait(1000);
  await shot(A, 'board-hell');

  console.log('=== Zwei Personen');
  const c2 = await b.createBrowserContext();
  const B = await c2.newPage();
  B.on('pageerror', (e) => errs.push('B ' + e.message));
  await login(B, 'anna@example.org', 'Gewitter-Laterne-83');
  await api(A, 'POST', `/api/boards/${boardId}/members`, { email: 'anna@example.org', role: 'editor' });
  await B.goto(BASE + '/board/' + boardId + '?transport=poll', { waitUntil: 'load' });
  await wait(1800);
  ok((await painted(B, one))?.paths === 2, 'Zweite Person sieht das Symbol, ohne das Panel zu öffnen (Rückfall-Transport)', await painted(B, one));
  await A.bringToFront();
  await ev(A, async () => {
    const c = await import('/js/core.js');
    c.addElements([c.makeElement('shape', 0, 0, { id: 'neu2', shape: 'ti-home', x: 100, y: 600 })], { select: false });
  });
  await wait(1800);
  ok((await painted(B, 'neu2'))?.paths > 0, 'Neues Symbol kommt bei der zweiten Person an', await painted(B, 'neu2'));
  await ev(B, async () => {
    const c = await import('/js/core.js');
    c.act(() => c.setEl({ ...c.getEl('neu2'), stroke: '#12b886' }));
  });
  await wait(1800);
  ok((await painted(A, 'neu2'))?.stroke === '#12b886', 'Farbänderung kommt zurück', await painted(A, 'neu2'));

  console.log('=== Neu laden');
  // Ohne Service Worker, sonst läuft die Anfrage an der Unterbrechung vorbei
  await A.setBypassServiceWorker(true);
  await A.setRequestInterception(true);
  let held = null;
  const hold = (q) => {
    if (/tabler-outline/.test(q.url())) held = q;
    else q.continue();
  };
  A.on('request', hold);
  await A.reload({ waitUntil: 'load' });
  await wait(1500);
  const waiting = await ev(A, (id) => ({ dashed: !!document.querySelector(`[data-id="${id}"] rect[stroke-dasharray]`), hit: !!document.querySelector(`[data-id="${id}"] .hit`), label: document.querySelector(`[data-id="${id}"] text`)?.textContent }), one);
  ok(held && waiting.dashed && waiting.hit && waiting.label === 'Hinweis', 'Solange die Datei fehlt: Platzhalter mit Beschriftung', waiting);
  // Exporte müssen warten: Noch während die Datei unterwegs ist, startet ein PNG. Es endet erst nach der Antwort.
  const pending = await A.evaluateHandle(async () => {
    const ex = await import('/js/exporter.js');
    const c = await import('/js/core.js');
    const out = { done: false };
    out.p = ex.pngDataUrl([...c.app.els.values()], { scale: 1 }).then((u) => {
      out.done = true;
      return u;
    });
    return out;
  });
  await wait(400);
  ok(!(await pending.evaluate((o) => o.done)), 'Export wartet auf die Symboldatei');
  A.off('request', hold);
  await held.continue();
  await A.setRequestInterception(false);
  await A.setBypassServiceWorker(false);
  await iconsReady(A);
  await wait(400);
  ok((await painted(A, one))?.paths === 2 && !(await ev(A, (id) => !!document.querySelector(`[data-id="${id}"] rect[stroke-dasharray]`), one)), 'Danach steht das Symbol ohne weiteres Zutun', await painted(A, one));
  ok((await pending.evaluate((o) => o.p)).length > 3000, 'Export läuft danach durch');
  ok(await pending.evaluate((o) => o.done), 'Export ist fertig');
  await pending.dispose();

  console.log('=== Exporte');
  const exp = await ev(A, async () => {
    const r = await import('/js/render.js');
    const c = await import('/js/core.js');
    const ex = await import('/js/exporter.js');
    const px = await import('/js/pptx-export.js');
    const zip = await import('/js/zip.js');
    const els = r.sortForRender([...c.app.els.values()]);
    const svg = ex.svgString(els);
    const parsed = new DOMParser().parseFromString(svg, 'image/svg+xml');
    const url = await ex.pngDataUrl(els.filter((e) => e.id === 'neu2'), { scale: 1, padding: 0, background: '#ffffff' });
    const img = new Image();
    img.src = url;
    await img.decode();
    const cv = document.createElement('canvas');
    cv.width = img.width;
    cv.height = img.height;
    const g = cv.getContext('2d');
    g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, cv.width, cv.height).data;
    let inkPx = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i] < 200) inkPx++;
    const list = [{ elements: els, bounds: r.renderSvgDocument(els).viewBox, padding: 0, title: 'S' }];
    const pdf = await ex.pdfFile(list, 'S');
    const bounds = { x: -700, y: 0, w: 2200, h: 900 };
    const pptx = await px.buildPptx([{ bounds, elements: els, title: 'Symbole' }], c.getEl);
    const text = new TextDecoder('latin1').decode(new Uint8Array(await pptx.arrayBuffer()));
    return {
      svgOk: !parsed.querySelector('parsererror'), svgIcon: (svg.match(/stroke-linecap="round" stroke-linejoin="round"><path/g) || []).length, svgWhite: /aufdunkel/.test(svg), dark: svg.includes('stroke="#ffffff"'),
      inkPx, pdf: await pdf.slice(0, 5).text(), pdfSize: pdf.size, pptx: pptx.size, media: (text.match(/ppt\/media\/image\d+\.png/g) || []).length, keys: Object.keys(zip).length,
    };
  });
  console.log('    ' + JSON.stringify(exp));
  ok(exp.svgOk && exp.svgIcon >= 5, 'SVG enthält die Symbole als Vektor', exp);
  ok(exp.dark, 'SVG: Symbol auf dunkler Fläche ist hell', exp);
  ok(exp.inkPx > 100, 'PNG zeigt das Symbol', exp.inkPx);
  ok(exp.pdf === '%PDF-' && exp.pdfSize > 3000, 'PDF', exp.pdfSize);
  ok(exp.media >= 5, 'PPTX enthält die Symbole als Bilder', exp.media);

  console.log('=== Vorlagen');
  const tpl = await api(A, 'POST', '/api/templates', { name: 'Symbolprobe', description: '', icon: '🔔', elements: [{ id: 'tplS', type: 'shape', shape: 'ti-bell', x: 0, y: 0, w: 96, h: 96, fill: 'transparent', stroke: '#1a1a1a', strokeWidth: 2, text: 'V' }] });
  const back = (await api(A, 'GET', '/api/templates/' + tpl.body?.id)).body;
  ok(tpl.status < 300 && JSON.stringify(back || {}).includes('ti-bell'), 'Vorlage behält das Symbol', [tpl.status]);
  const inserted = await ev(A, async () => {
    const c = await import('/js/core.js');
    const u = await import('/js/ui.js');
    u.placeElements([{ id: 'tplS', type: 'shape', shape: 'ti-bell', x: 0, y: 0, w: 96, h: 96, fill: 'transparent', stroke: '#1a1a1a', strokeWidth: 2, text: 'V' }], { select: true });
    await new Promise((r) => setTimeout(r, 400));
    return [...c.app.sel].map((id) => c.getEl(id)?.shape);
  });
  ok(inserted.includes('ti-bell'), 'Einfügen aus einer Vorlage', inserted);
  if (tpl.body?.id) await api(A, 'DELETE', '/api/templates/' + tpl.body.id);

  console.log('=== Prüfung auf dem Server, unbekannte Namen');
  await ev(A, async () => {
    const c = await import('/js/core.js');
    c.app.sync.op({ op: 'upsert', el: { id: 'ungueltig1', type: 'shape', shape: 'ti-Evil"x', x: 0, y: 1000, w: 96, h: 96 } });
    c.app.sync.op({ op: 'upsert', el: { id: 'ungueltig2', type: 'shape', shape: 'ti--x', x: 200, y: 1000, w: 96, h: 96 } });
    c.app.sync.op({ op: 'upsert', el: { id: 'mitpfad', type: 'shape', shape: 'ti-bell', x: 400, y: 1000, w: 96, h: 96, paths: ['M0 0'], svg: '<script>', d: 'M0 0' } });
    c.app.sync.op({ op: 'upsert', el: { id: 'fremd', type: 'shape', shape: 'ti-gibt-es-nicht', x: 600, y: 1000, w: 96, h: 96 } });
  });
  await wait(900);
  await A.reload({ waitUntil: 'load' });
  await wait(1500);
  const stored = await ev(A, async () => {
    const c = await import('/js/core.js');
    await (await import('/js/icons.js')).loadIcons(true);
    await new Promise((r) => setTimeout(r, 300));
    const e = (id) => JSON.parse(JSON.stringify(c.getEl(id)));
    return { a: e('ungueltig1').shape, b: e('ungueltig2').shape, p: e('mitpfad'), unknown: { shape: e('fremd').shape, text: document.querySelector('[data-id="fremd"] text')?.textContent, dashed: !!document.querySelector('[data-id="fremd"] rect[stroke-dasharray]') } };
  });
  ok(stored.a === 'rect' && stored.b === 'rect', 'Ungültige Namen werden zu rect', stored);
  ok(!('paths' in stored.p) && !('svg' in stored.p) && !('d' in stored.p), 'Mitgeschickte Pfade entfallen', stored.p);
  ok(stored.unknown.shape === 'ti-gibt-es-nicht' && stored.unknown.dashed && /gibt-es/.test(stored.unknown.text), 'Unbekanntes Symbol: Platzhalter mit Namen', stored.unknown);

  console.log('=== Symboldatei nicht erreichbar');
  await A.setBypassServiceWorker(true);
  await A.setRequestInterception(true);
  const refuse = (q) => (/tabler-outline/.test(q.url()) ? q.abort() : q.continue());
  A.on('request', refuse);
  await A.reload({ waitUntil: 'load' });
  await wait(1200);
  const broken = await ev(A, async () => {
    const c = await import('/js/core.js');
    const ex = await import('/js/exporter.js');
    const err = await ex.pngDataUrl([c.getEl('neu2')]).then(() => '', (e) => e.message);
    (await import('/js/shapes-panel.js')).openShapesPanel();
    await new Promise((r) => setTimeout(r, 400));
    return { err, status: document.querySelector('.shape-status')?.textContent, shapes: document.querySelectorAll('#sidepanel .shape-btn').length };
  });
  ok(/Symbole konnten nicht geladen/.test(broken.err), 'Export meldet das, statt Platzhalter auszugeben', broken);
  ok(/konnten nicht geladen/.test(broken.status) && broken.shapes > 20, 'Panel zeigt die Formen und bietet einen neuen Versuch an', broken);
  A.off('request', refuse);
  await A.setRequestInterception(false);
  await A.setBypassServiceWorker(false);
  await ev(A, () => [...document.querySelectorAll('.shape-status button')][0].click());
  await iconsReady(A);
  await wait(300);
  ok((await ev(A, () => document.querySelectorAll('.shape-sub-head').length)) === 14 && (await painted(A, 'neu2'))?.paths > 0, 'Neuer Versuch klappt, das Board zeichnet nach');
  await ev(A, async () => (await import('/js/ui.js')).toggleSidePanel('shapes'));

  console.log('=== Gäste');
  await api(A, 'PUT', '/api/admin/settings', { security: { requireVirusScan: false }, collab: { guestLinks: true, guestContributions: true, guestNoteLimit: 5 } });
  const link = await api(A, 'POST', `/api/boards/${boardId}/guest-links`, { role: 'contributor', days: 1 });
  const c3 = await b.createBrowserContext();
  const G = await c3.newPage();
  await G.goto(BASE + '/login', { waitUntil: 'load' });
  const joined = await api(G, 'POST', '/api/guest/join', { token: link.body.token, name: 'Gerda', consent: true });
  ok(joined.status === 200, 'Gast tritt bei', joined);
  await G.goto(BASE + '/board/' + boardId, { waitUntil: 'load' });
  await wait(1500);
  const panelGuest = await ev(G, async () => {
    (await import('/js/shapes-panel.js')).openShapesPanel();
    return !!document.querySelector('#sidepanel .shapes-panel');
  });
  ok(!panelGuest, 'Das Panel öffnet für Gäste nicht');
  const client = 'probe' + Math.random().toString(36).slice(2, 14);
  await api(G, 'GET', `/api/boards/${boardId}/events?client=${client}&transport=poll`);
  const sent = await api(G, 'POST', `/api/boards/${boardId}/ops`, { clientId: client, ops: [{ op: 'upsert', el: { id: 'gastsymbol', type: 'shape', shape: 'ti-bell', x: 0, y: 0, w: 96, h: 96, z: 1 } }] });
  ok(sent.body?.blocked === 'contributor' || sent.status === 403, 'Server lehnt ein Symbol von Gästen ab', sent);
  await wait(400);
  ok(!(await ev(A, async () => !!(await import('/js/core.js')).getEl('gastsymbol'))), 'Es kommt nicht aufs Board');
  await c3.close();
  await A.bringToFront();

  console.log('=== Verwaltung');
  const res = await api(A, 'PUT', '/api/auth/me/shape-packs', { off: ['icons'] });
  ok(res.status < 300, 'Paket lässt sich persönlich abwählen', res);
  const fresh = [];
  const onResp = (x) => /tabler-outline/.test(x.url()) && fresh.push(x.url());
  const id2 = await board(A, 'Ohne Symbole');
  A.on('response', onResp);
  await A.reload({ waitUntil: 'load' });
  await wait(1200);
  await openPanel(A);
  await wait(500);
  const offNow = await ev(A, () => ({ head: [...document.querySelectorAll('.shape-group-head')].some((x) => /Allgemeine Symbole/.test(x.textContent)) }));
  ok(!offNow.head && fresh.length === 0, 'Abgewählt: kein Paket und keine Symboldatei', [offNow, fresh]);
  r = await hits(A, 'glocke');
  ok(!r.some((k) => k.startsWith('ti-')), 'Abgewählt: Suche findet keine Symbole', r.slice(0, 5));
  await api(A, 'PUT', '/api/auth/me/shape-packs', { off: [] });
  await api(A, 'PUT', '/api/admin/settings', { design: { shapePacksOff: 'icons' } });
  const set = await api(A, 'GET', '/api/admin/settings');
  ok(/icons/.test(set.body?.design?.shapePacksOff || JSON.stringify(set.body).match(/shapePacksOff":"[^"]*/)?.[0] || ''), 'Administration kann das Paket abwählen');
  await A.reload({ waitUntil: 'load' });
  await wait(1200);
  await openPanel(A);
  await wait(300);
  ok(!(await ev(A, () => [...document.querySelectorAll('.shape-group-head')].some((x) => /Allgemeine Symbole/.test(x.textContent)))), 'Administration: Paket ist für alle weg');
  await api(A, 'PUT', '/api/admin/settings', { design: { shapePacksOff: '' } });
  A.off('response', onResp);

  console.log('=== Befehlssuche');
  await A.goto(BASE + '/board/' + boardId, { waitUntil: 'load' });
  await wait(1500);
  await api(A, 'DELETE', '/api/boards/' + id2);
  await ev(A, async () => (await import('/js/core.js')).setSelection([]));
  await A.mouse.click(1200, 700);
  await A.keyboard.down('Control');
  await A.keyboard.press('k');
  await A.keyboard.up('Control');
  await wait(300);
  await A.keyboard.type('glocke');
  await wait(300);
  const pal = await ev(A, () => [...document.querySelectorAll('.palette-item')].map((x) => x.textContent));
  ok(!pal.some((t) => /^Glocke/.test(t)), 'Palette listet keine einzelnen Symbole', pal);
  await ev(A, () => {
    const i = document.querySelector('.palette-input');
    i.value = '';
    i.dispatchEvent(new Event('input'));
  });
  await A.keyboard.type('symbole');
  await wait(300);
  const pal2 = await ev(A, () => [...document.querySelectorAll('.palette-item')].map((x) => x.textContent));
  ok(pal2.some((t) => /Alle Formen/.test(t)), 'Die Palette führt über „Alle Formen“ zu den Symbolen', pal2);
  await A.keyboard.press('Escape');

  if (SHOTS) {
    console.log('=== Dunkel');
    await A.evaluate(async () => {
      const c = await import('/js/core.js');
      const u = await import('/js/ui.js');
      document.body.classList.add('dark');
      c.app.settings.dark = true;
      c.rerenderAll();
      u.toggleSidePanel('shapes');
      c.fitAll(false);
    });
    await iconsReady(A);
    await wait(700);
    await shot(A, 'panel-dunkel');
  }

  console.log('Fehler:', errs.length ? errs.slice(0, 5) : 'keine');
  ok(errs.length === 0, 'keine Browserfehler', errs.slice(0, 3));
  await A.goto(BASE + '/', { waitUntil: 'load' });
  await api(A, 'DELETE', '/api/boards/' + boardId);
  await b.close();
  console.log(f ? 'FAIL ' + f : 'ALLES OK');
  process.exit(f ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
