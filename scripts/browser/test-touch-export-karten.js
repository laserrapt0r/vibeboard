// Touch-Auswahl, Handy-Ansicht, PDF und PowerPoint, Schätzrunde mit Warteschlange, Abhängigkeiten, Schnelleingabe für Karten
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { launch, login, BASE, TMP, boardMenu, pickMenu } = require('./lib');
let f = 0;
const ok = (c, m, x) => {
  console.log((c ? 'ok  ' : 'FAIL') + ' ' + m + (c || x === undefined ? '' : ' → ' + JSON.stringify(x).slice(0, 300)));
  if (!c) f++;
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const PW = 'Gewitter-Laterne-83';
const api = (p, m, u, b) =>
  p.evaluate(async (m, u, b) => {
    const r = await fetch(u, { method: m, headers: { 'Content-Type': 'application/json', 'X-Vibeboard': '1' }, body: b ? JSON.stringify(b) : undefined });
    let j = null;
    try {
      j = await r.json();
    } catch {}
    return { status: r.status, body: j };
  }, m, u, b);
const core = (p, fn, ...a) => p.evaluate(`(async () => (${fn})(await import('/js/core.js'), ...${JSON.stringify(a)}))()`);
const get = (p, id) => core(p, (c, id) => JSON.parse(JSON.stringify(c.getEl(id) || null)), id);
const sel = (p) => core(p, (c) => [...c.app.sel].sort());
const toastText = (p) => p.evaluate(() => {
  const t = document.getElementById('toast');
  return t && t.classList.contains('show') ? t.textContent : '';
});
const newBoard = async (p, name, elements, members = []) => {
  const id = (await api(p, 'POST', '/api/boards', { name, elements })).body.id;
  for (const email of members) await api(p, 'POST', `/api/boards/${id}/members`, { email, role: 'editor' });
  return id;
};
const open = async (p, id, q = '') => {
  await p.goto(`${BASE}/board/${id}${q}`, { waitUntil: 'load' });
  await p.waitForSelector('#tools button', { timeout: 8000 });
  await wait(1100);
};
const center = (p, id) => p.evaluate((id) => {
  const r = document.querySelector(`g[data-id="${id}"]`).getBoundingClientRect();
  return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
}, id);
const fileIn = async (dir, ext, ms = 15000) => {
  for (const end = Date.now() + ms; Date.now() < end; await wait(150)) {
    const hit = fs.readdirSync(dir).find((n) => n.endsWith(ext));
    if (hit) return path.join(dir, hit);
  }
  return null;
};
const note = (id, x, y, text) => ({ id, type: 'sticky', x, y, w: 120, h: 120, text, fill: '#fff9b1', z: 1 });
const card = (id, x, y, title, o = {}) => ({ id, type: 'card', x, y, w: 300, h: 140, title, z: 2, ...o });

(async () => {
  const b = await launch();
  const errs = [];
  const A = await b.newPage();
  A.on('pageerror', (e) => errs.push('A ' + e.message));
  A.on('console', (m) => /Content Security Policy|Content-Security-Policy/.test(m.text()) && errs.push('CSP ' + m.text()));
  await login(A, 'admin@test.example', 'Rotkehlchen-Wolke-47');
  const c2 = await b.createBrowserContext();
  const B = await c2.newPage();
  B.on('pageerror', (e) => errs.push('B ' + e.message));
  await login(B, 'anna@example.org', PW);

  console.log('=== Touch: Auswahlmodus');
  const tid = await newBoard(A, 'Touch', [note('n1', 0, 0, 'eins'), note('n2', 200, 0, 'zwei'), note('n3', 0, 200, 'drei'), note('n4', 200, 200, 'vier'),
    { id: 'hg', type: 'shape', shape: 'rect', x: -50, y: 520, w: 500, h: 300, fill: '#e9ecef', locked: true, z: 0 }, note('n5', 0, 560, 'fünf'), note('n6', 200, 560, 'sechs')], ['anna@example.org']);
  await open(A, tid);
  ok(!(await A.$('#btn-touch-pick')), 'Mit Maus gibt es keinen Auswahlmodus');
  const c5 = await b.createBrowserContext();
  const M = await c5.newPage();
  M.on('pageerror', (e) => errs.push('M ' + e.message));
  await M.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await login(M, 'anna@example.org', PW);
  await open(M, tid);
  const cdp = await M.createCDPSession();
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
  const tap = async (pt) => {
    await touch('touchStart', [pt]);
    await wait(40);
    await touch('touchEnd', []);
    await wait(350);
  };
  const swipe = async (a, z) => {
    await touch('touchStart', [a]);
    await wait(40);
    for (let i = 1; i <= 5; i++) {
      await touch('touchMove', [{ x: a.x + ((z.x - a.x) * i) / 5, y: a.y + ((z.y - a.y) * i) / 5 }]);
      await wait(30);
    }
    await touch('touchEnd', []);
    await wait(300);
  };
  await core(M, (c) => c.fitTo({ x: -60, y: -20, w: 520, h: 860 }, { maxZ: 0.6 }));
  await wait(400);
  await tap(await center(M, 'n1'));
  await tap(await center(M, 'n2'));
  ok((await sel(M)).join() === 'n2', 'Ohne Modus ersetzt der zweite Tipp die Auswahl', await sel(M));
  ok(await M.$('#btn-touch-pick'), 'Auf Touch-Geräten gibt es den Schalter');
  await M.$eval('#btn-touch-pick', (x) => x.click());
  ok((await M.$eval('#btn-touch-pick', (x) => x.getAttribute('aria-pressed'))) === 'true', 'Der Schalter zeigt seinen Zustand');
  await tap(await center(M, 'n1'));
  ok((await sel(M)).join() === 'n1,n2', 'Tippen fügt hinzu', await sel(M));
  await tap(await center(M, 'n2'));
  ok((await sel(M)).join() === 'n1', 'Tippen nimmt wieder heraus', await sel(M));
  const c3 = await center(M, 'n3'), c4 = await center(M, 'n4');
  await tap({ x: 370, y: 300 });
  ok((await sel(M)).join() === 'n1', 'Tipp auf leere Fläche behält die Auswahl', await sel(M));
  await swipe({ x: c3.x - 40, y: c3.y - 45 }, { x: c4.x + 15, y: c4.y + 15 });
  ok((await sel(M)).join() === 'n1,n3,n4', 'Ein Rahmen auf leerer Fläche erweitert die Auswahl', await sel(M));
  await core(M, (c) => c.setSelection([]));
  const c6 = await center(M, 'n6');
  await tap(await core(M, (c) => c.toScreen(-30, 790)));
  ok(!(await sel(M)).length, 'Gesperrte Fläche wird nicht mitgewählt', await sel(M));
  const c5a = await center(M, 'n5');
  await tap(c5a);
  await swipe({ x: c6.x - 40, y: c6.y + 60 }, { x: c6.x + 10, y: c6.y - 10 });
  ok((await sel(M)).join() === 'n5,n6', 'Der Rahmen lässt die gesperrte Fläche aus', await sel(M));
  await M.$eval('#btn-touch-pick', (x) => x.click());
  await core(M, (c) => c.setSelection([]));
  await tap(await center(M, 'n1'));
  await tap(await center(M, 'n2'));
  ok((await sel(M)).join() === 'n2', 'Ausgeschaltet wählt Tippen wieder einzeln', await sel(M));

  console.log('=== Handy: Retro und Abstimmung für Teilnehmende');
  await open(A, tid);
  await core(A, (c) => {
    c.app.sync.op({ op: 'retro', action: 'start', steps: ['collect', 'group', 'vote', 'close'], opts: {} });
    c.app.sync.op({ op: 'retro', action: 'step', step: 1 });
  });
  await wait(900);
  await open(M, tid);
  const layout = () => M.evaluate(() => {
    const r = (s) => {
      const e = document.querySelector(s);
      if (!e || !e.getClientRects().length) return null;
      const b = e.getBoundingClientRect();
      return { top: Math.round(b.top), bottom: Math.round(b.bottom), left: Math.round(b.left), right: Math.round(b.right), h: Math.round(b.height) };
    };
    return { retro: r('#retro-bar'), vote: r('#voting-banner'), tools: r('#tools'), left: r('#bottom-left'), top: r('#topright'), toast: r('#toast'), pm: r('#private-banner'), mod: r('#moderation-banner'), hint: r('#retro-bar .retro-hint') };
  });
  let l = await layout();
  ok(l.retro && l.retro.h < 110, 'Die Retro-Leiste ist für Teilnehmende schmal', l.retro);
  ok(await M.evaluate(() => /Mehrere auswählen/.test(document.querySelector('#retro-bar').textContent)), 'Der Schritt Gruppieren bietet die Auswahl an');
  await M.evaluate(() => [...document.querySelectorAll('#retro-bar button')].find((x) => /Mehrere auswählen/.test(x.textContent)).click());
  await core(M, (c) => c.fitTo({ x: -60, y: -20, w: 520, h: 400 }, { maxZ: 0.6 }));
  await wait(300);
  await tap(await center(M, 'n1'));
  await tap(await center(M, 'n2'));
  await wait(200);
  ok((await sel(M)).join() === 'n1,n2', 'Beiträge lassen sich am Handy auswählen', await sel(M));
  ok(await M.evaluate(() => !!document.querySelector('#ctxbar:not(.hidden)')), 'Die Kontextleiste erscheint dazu');
  await M.$eval('#ctxbar [data-more]', (x) => x.click()).catch(() => {});
  await wait(200);
  const inMenu = await M.evaluate(() => /Themengruppe bilden/.test(document.querySelector('#ctxbar').textContent + [...document.querySelectorAll('.popover')].map((x) => x.textContent).join('')));
  ok(inMenu, '„Themengruppe bilden“ ist erreichbar');
  await M.keyboard.press('Escape');
  await core(M, (c) => {
    c.setTouchPick(false);
    c.setSelection([]);
  });
  await core(A, (c) => {
    c.app.sync.op({ op: 'voting', voting: { active: true, votesPerUser: 3, votes: {}, title: 'Was wollen wir besprechen?', by: 'Admin', startedAt: Date.now() } });
    c.app.sync.op({ op: 'privateMode', active: true });
  });
  await wait(900);
  l = await layout();
  ok(l.vote && l.retro && l.vote.h < 60 && l.retro.h + l.vote.h < 170, 'Abstimmung und Retro brauchen zusammen wenig Höhe', l);
  ok(l.vote.bottom <= l.retro.top && l.retro.bottom <= l.tools.top, 'Die Leisten überdecken sich nicht', l);
  ok(l.left && l.left.bottom <= l.vote.top, 'Rückgängig bleibt erreichbar', l);
  ok(l.pm && l.pm.h < 60 && l.pm.top >= l.top.bottom, 'Der private Modus steht eingeklappt unter der Kopfzeile', l);
  await wait(3200);
  await M.$eval('#voting-banner .banner-fold', (x) => x.click());
  await wait(300);
  const open2 = await layout();
  ok(open2.vote.h > l.vote.h && (await M.$eval('#voting-banner .banner-fold', (x) => x.getAttribute('aria-expanded'))) === 'true', 'Das Banner klappt auf', [l.vote, open2.vote]);
  ok(open2.vote.bottom <= open2.retro.top, 'Der Stapel rückt mit', open2);
  await M.$eval('#retro-bar .banner-fold', (x) => x.click());
  await wait(300);
  ok(await M.evaluate(() => getComputedStyle(document.querySelector('#retro-bar .retro-hint > span')).display !== 'none'), 'Die Retro-Leiste zeigt aufgeklappt den Hinweis');
  await M.evaluate(async () => (await import('/js/util.js')).toast('Testmeldung', 3000));
  await wait(350);
  l = await layout();
  ok(l.toast && l.toast.top >= l.top.bottom && l.toast.bottom < l.vote.top, 'Meldungen stehen oben und verdecken keine Leiste', l);
  await A.setViewport({ width: 1280, height: 900 });
  ok(await A.$eval('#voting-banner .banner-fold', (x) => getComputedStyle(x).display === 'none'), 'Am Rechner gibt es keinen Knopf zum Einklappen');
  ok(await A.$eval('#retro-bar', (x) => /Weiter/.test(x.textContent)), 'Die Leitung behält „Weiter“');
  await core(A, (c) => {
    c.app.sync.op({ op: 'privateMode', active: false });
    c.app.sync.op({ op: 'voting', voting: null });
    c.app.sync.op({ op: 'retro', action: 'stop' });
  });
  await wait(600);
  await M.close();

  console.log('=== PDF-Datei');
  const dir = path.join(TMP, 'pdf');
  fs.mkdirSync(dir, { recursive: true });
  const dl = await A.createCDPSession();
  await dl.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: dir });
  const pid = await newBoard(A, 'Folien Ü', [
    { id: 'f1', type: 'frame', x: 2000, y: 0, w: 800, h: 450, title: 'Zweite Folie', order: 2, z: 1 },
    { id: 'f2', type: 'frame', x: 0, y: 0, w: 1600, h: 900, title: 'Erste Folie äöü', order: 1, z: 2 },
    note('p1', 100, 100, 'Sichtbar auf Seite 1'),
    { ...note('p2', 2100, 100, 'Seite 2'), z: 3 },
  ]);
  await open(A, pid);
  const requests = [];
  const onReq = (r) => requests.push(r.url());
  A.on('request', onReq);
  await boardMenu(A, 'Exportieren', 'Als PDF-Datei');
  const pdf = await fileIn(dir, '.pdf');
  A.off('request', onReq);
  ok(!!pdf, 'Die PDF-Datei kommt ohne Druckdialog an');
  const bytes = fs.readFileSync(pdf);
  const raw = bytes.toString('latin1');
  ok(raw.startsWith('%PDF-') && raw.trimEnd().endsWith('%%EOF'), 'Die Datei ist ein PDF');
  ok((raw.match(/\/Type \/Page\b/g) || []).length === 2 && /\/Count 2/.test(raw), 'Je Frame eine Seite', (raw.match(/\/Type \/Page\b/g) || []).length);
  ok(/\/MediaBox \[0 0 1200 675\][\s\S]*\/MediaBox \[0 0 600 337\.5\]/.test(raw), 'Reihenfolge und Größe folgen den Frames', raw.match(/\/MediaBox \[[^\]]*\]/g));
  const hexOf = (s) => [...s].map((c) => c.charCodeAt(0).toString(16).padStart(4, '0').toUpperCase()).join('');
  ok(raw.includes('FEFF' + hexOf('Erste Folie äöü')) && raw.includes('FEFF' + hexOf('Zweite Folie')), 'Folientitel sind Lesezeichen');
  ok(raw.indexOf('FEFF' + hexOf('Erste Folie äöü')) < raw.indexOf('FEFF' + hexOf('Zweite Folie')), 'Lesezeichen in Folgenreihenfolge');
  ok(!requests.some((u) => /\.(js|mjs|wasm)(\?|$)/.test(u) && !u.startsWith(BASE + '/js/')) && !requests.some((u) => !u.startsWith(BASE) && !u.startsWith('blob:') && !u.startsWith('data:')), 'Es wird nichts nachgeladen', requests.slice(0, 5));
  try {
    const info = execFileSync('pdfinfo', [pdf], { encoding: 'utf8' });
    ok(/Pages:\s+2/.test(info), 'pdfinfo liest zwei Seiten', info);
    ok(/Title:\s+Folien Ü/.test(info), 'Dokumenttitel gesetzt', info);
  } catch (e) {
    if (e.code === 'ENOENT') console.log('     (pdfinfo nicht installiert, zweite Prüfung entfällt)');
    else ok(false, 'pdfinfo lehnt die Datei ab', String(e.message));
  }
  fs.rmSync(pdf);
  // Ohne Frames: das ganze Board; Privates bleibt draußen
  const nid = await newBoard(A, 'Ohne', [note('o1', 0, 0, 'Eins'), note('o2', 4000, 3000, 'Zwei')]);
  await open(A, nid);
  await boardMenu(A, 'Exportieren', 'Als PDF-Datei');
  const pdf2 = await fileIn(dir, '.pdf');
  const raw2 = fs.readFileSync(pdf2).toString('latin1');
  ok((raw2.match(/\/Type \/Page\b/g) || []).length === 1, 'Ohne Frames eine Seite');
  const width = Number(/\/Width (\d+)/.exec(raw2)[1]);
  ok(width <= 2400, 'Die Auflösung bleibt begrenzt', width);
  fs.rmSync(pdf2);
  const lots = await A.evaluate(async () => {
    const { buildPdf } = await import('/js/exporter.js');
    const jpeg = new Uint8Array([255, 216, 255, 217]);
    const pages = Array.from({ length: 40 }, (_, i) => ({ jpeg, px: { w: 1, h: 1 }, pt: { w: 100, h: 100 }, title: 'S' + i }));
    const text = new TextDecoder('latin1').decode(await buildPdf(pages, 'x').arrayBuffer());
    const start = Number(/startxref\n(\d+)/.exec(text)[1]);
    const first = text.slice(start + 'xref\n0 '.length).split('\n').slice(2, 6).map((l) => Number(l.slice(0, 10)));
    return { xref: text.slice(start, start + 4), objects: first.map((o) => text.slice(o, o + 7)) };
  });
  ok(lots.xref === 'xref' && lots.objects[0].startsWith('1 0 obj') && lots.objects[3].startsWith('4 0 obj'), 'Die Verweistabelle stimmt', lots);
  // Druckvariante: Der Text bleibt Text
  await open(A, pid);
  const popup = new Promise((res) => b.once('targetcreated', res));
  await boardMenu(A, 'Exportieren', 'PDF drucken (Text markierbar)');
  const win = await (await popup).page();
  await wait(1500);
  ok(/Sichtbar/.test(await win.evaluate(() => [...document.querySelectorAll('svg text')].map((x) => x.textContent).join(' '))), 'Die Druckvariante enthält echten Text');
  ok(await win.evaluate(() => document.querySelectorAll('.p').length === 2 && !document.images.length), 'Je Frame eine Druckseite ohne Bild der Seite');
  await win.close();
  // Bilder: nur auf ihrer Seite, und gedruckt wird erst, wenn sie geladen sind
  await api(A, 'PUT', '/api/admin/settings', { security: { requireVirusScan: false } });
  const iid = await newBoard(A, 'Bilddruck', [{ id: 'if1', type: 'frame', x: 0, y: 0, w: 400, h: 300, title: 'Eins', z: 1 }, { id: 'if2', type: 'frame', x: 600, y: 0, w: 400, h: 300, title: 'Zwei', z: 2 }]);
  await open(A, iid);
  await core(A, (c) => {
    const pic = (seed) => {
      const k = document.createElement('canvas');
      k.width = k.height = 900;
      const x = k.getContext('2d');
      for (let i = 0; i < 4000; i++) {
        x.fillStyle = `hsl(${(i * seed) % 360} 80% 50%)`;
        x.fillRect((i * 7) % 900, (i * 13) % 900, 9, 9);
      }
      return k.toDataURL('image/png');
    };
    [['im1', 50, 7], ['im2', 650, 11], ['im3', 1500, 13]].forEach(([id, x, s]) => c.setEl({ id, type: 'image', x, y: 50, w: 200, h: 200, z: 5, src: pic(s), name: id }));
  });
  await wait(900);
  await A.evaluate(() => {
    const real = window.open;
    window.open = (...a) => {
      const w = real.apply(window, a);
      w.print = () => {
        const list = [...w.document.querySelectorAll('.p')].map((p) => [...p.querySelectorAll('image')].map((img) => {
          const k = w.document.createElement('canvas');
          k.width = k.height = 20;
          const x = k.getContext('2d');
          try {
            x.drawImage(img, 0, 0, 20, 20);
            return x.getImageData(0, 0, 20, 20).data.some((v) => v > 0);
          } catch (e) {
            return String(e);
          }
        }));
        window.__printed = { list, html: w.document.documentElement.outerHTML.length };
        w.close();
      };
      return w;
    };
  });
  await boardMenu(A, 'Exportieren', 'PDF drucken (Text markierbar)');
  for (let i = 0; i < 40 && !(await A.evaluate(() => !!window.__printed)); i++) await wait(150);
  const printed = await A.evaluate(() => window.__printed);
  ok(JSON.stringify(printed?.list) === '[[true],[true]]', 'Jede Seite enthält nur ihr Bild, und es ist beim Drucken geladen', printed?.list);
  const single = await core(A, (c) => c.getEl('im1').src.length);
  ok(printed?.html < single * 3, 'Das Bild außerhalb der Seiten kostet nichts', [printed?.html, single]);
  await open(A, pid);

  console.log('=== Folientitel in PowerPoint');
  await boardMenu(A, 'Exportieren', 'Als PowerPoint-Datei');
  const pptx = await fileIn(dir, '.pptx');
  ok(!!pptx, 'PowerPoint-Datei kommt an');
  const read = `import sys,zipfile,xml.dom.minidom as m
z=zipfile.ZipFile(sys.argv[1])
for n in z.namelist():
    if n.endswith('.xml') or n.endswith('.rels'): m.parseString(z.read(n))
print(z.read('ppt/slides/slide1.xml').decode())
print('@@')
print(z.read('ppt/slideLayouts/slideLayout1.xml').decode())`;
  const [slide, layoutXml] = execFileSync('python3', ['-I', '-c', read, pptx], { encoding: 'utf8', maxBuffer: 1 << 26 }).split('@@');
  ok(/<p:ph type="title"\/>[\s\S]*Erste Folie äöü/.test(slide), 'Der Frame-Titel steht im Titelfeld', slide.slice(0, 400));
  ok(/type="titleOnly"/.test(layoutXml) && /<p:ph type="title"\/>/.test(layoutXml), 'Das Layout kennt das Titelfeld');
  const noteY = Number(/name="Notiz \d+"[\s\S]*?<a:off x="\d+" y="(\d+)"/.exec(slide)[1]);
  ok(noteY > 84 * 9525, 'Der Inhalt liegt unter dem Titel', noteY);

  console.log('=== Schätzrunde mit Warteschlange');
  const eid = await newBoard(A, 'Poker', [card('k1', 0, 0, 'Erste'), card('k2', 400, 0, 'Zweite'), card('k3', 800, 0, 'Dritte'), card('k4', 1200, 0, 'Fertig', { points: '5' }), card('k5', 1600, 0, 'Vierte')], ['anna@example.org']);
  await open(A, eid);
  await open(B, eid);
  await A.evaluate(() => document.getElementById('btn-moderate').click());
  await pickMenu(A, 'Schätzrunde');
  await wait(200);
  const labels = await A.evaluate(() => [...document.querySelectorAll('.popover .mi-label')].map((x) => x.textContent));
  ok(labels.includes('Alle ohne Schätzung (4)') && labels.includes('Mehrere Karten wählen …') && labels.includes('Erste'), 'Das Menü bietet die Warteschlange an', labels);
  await pickMenu(A, 'Alle ohne Schätzung');
  await A.waitForSelector('.modal-back form');
  ok(/4 Karten nacheinander/.test(await A.$eval('.modal-back form', (x) => x.textContent)), 'Der Dialog nennt die Karten');
  await A.$eval('.modal-back button[type=submit]', (x) => x.click());
  await wait(600);
  const est = (p) => p.$eval('#estimation', (x) => x.textContent);
  ok(/Karte 1 von 4/.test(await est(B)) && /Erste/.test(await est(B)), 'Der Fortschritt ist für alle sichtbar', await est(B));
  const click = (p, re) => p.evaluate((src) => {
    const btn = [...document.querySelectorAll('#estimation button')].find((x) => new RegExp(src).test(x.textContent));
    if (!btn) throw new Error('Kein Knopf ' + src);
    btn.click();
  }, re);
  await click(A, '^8$');
  await click(B, '^8$');
  await wait(400);
  await click(A, 'Aufdecken');
  await wait(400);
  // Die Meldung zum Start der Runde steht noch 2,2 Sekunden: Zählen soll nur, was ab hier erscheint
  await B.evaluate(() => {
    const t = document.getElementById('toast');
    if (t) {
      t.classList.remove('show');
      t.textContent = '';
    }
  });
  await click(A, '8 übernehmen');
  await wait(800);
  ok((await get(A, 'k1')).points === '8', 'Die Schätzung steht auf der ersten Karte');
  ok(/Karte 2 von 4/.test(await est(B)) && /Zweite/.test(await est(B)), 'Danach geht es von selbst weiter', await est(B));
  ok(!/gestartet$/.test(await toastText(B)) && !/hat eine Schätzrunde gestartet/.test(await toastText(B)), 'Keine Meldung über eine neue Runde', await toastText(B));
  ok(!/\b8 übernehmen/.test(await est(A)), 'Die Werte der vorigen Karte sind weg');
  await click(A, 'Nächste Karte');
  await wait(500);
  ok(/Karte 3 von 4/.test(await est(A)) && (await get(A, 'k2')).points === undefined, 'Nächste Karte überspringt ohne Wert', await est(A));
  await core(A, (c) => c.deleteEls(['k5']));
  await wait(500);
  ok(/Karte 3 von 3/.test(await est(B)), 'Gelöschte Karten verlassen die Warteschlange', await est(B));
  // Die erste Karte einer Runde wird gelöscht: Es geht weiter, eine neue Runde ist das nicht
  const eid2 = await newBoard(A, 'Poker 2', [card('p1', 0, 0, 'Weg'), card('p2', 400, 0, 'Bleibt')], ['anna@example.org']);
  await open(A, eid2);
  await open(B, eid2);
  await core(A, (c) => c.app.sync.op({ op: 'estimation', action: 'start', elId: 'p1', deck: 'fib', queue: ['p2'] }));
  await wait(2800); // Meldung zum Start ist vorbei
  await core(A, (c) => c.deleteEls(['p1']));
  await wait(500);
  ok(/Bleibt/.test(await est(B)) && !/gestartet/.test(await toastText(B)), 'Erste Karte gelöscht: keine Meldung über eine neue Runde', await toastText(B));
  await core(A, (c) => c.app.sync.op({ op: 'estimation', action: 'close' }));
  await wait(200);
  await open(A, eid);
  await open(B, eid);
  await core(A, (c) => c.deleteEls(['k3']));
  await wait(500);
  ok(!(await B.$eval('#estimation', (x) => !x.classList.contains('hidden'))), 'Ist die letzte Karte gelöscht, endet die Runde');
  // Der Server prüft: Fremde private Karten und Unsinn kommen nicht in die Schlange
  await core(B, (c) => c.app.sync.op({ op: 'privateMode', active: true }));
  await wait(300);
  await core(B, (c) => c.setEl(c.makeElement('card', 0, 400, { id: 'geheim1', title: 'Geheim' })));
  await wait(600);
  await core(B, (c) => c.app.sync.op({ op: 'privateMode', active: false, keep: true }));
  const q = await A.evaluate(async (id) => {
    const { app } = await import('/js/core.js');
    app.sync.op({ op: 'estimation', action: 'start', elId: 'k1', deck: 'fib', queue: ['k2', 'k2', 'gibtsnicht', '__proto__', 'k1', 'k4'] });
    await new Promise((r) => setTimeout(r, 500));
    return app.session.estimation;
  }, eid);
  ok(JSON.stringify(q.queue) === '["k2","k4"]', 'Die Warteschlange enthält nur gültige Karten', q);
  await core(A, (c) => c.app.sync.op({ op: 'estimation', action: 'close' }));

  console.log('=== Abhängigkeiten');
  const did = await newBoard(A, 'Abh', [card('a', 0, 0, 'Basis', { start: '2026-11-02', due: '2026-11-05', status: 'Offen' }), card('b', 400, 0, 'Mitte', { start: '2026-11-08', due: '2026-11-12', status: 'Offen' }), card('c', 800, 0, 'Oben', { start: '2026-11-03', due: '2026-11-04', status: 'Offen', points: '3' })], ['anna@example.org']);
  await open(A, did);
  await open(B, did);
  const editCard = (id) => core(A, (c, id) => c.app.emit('editCard', id), id);
  await editCard('b');
  await A.waitForSelector('.blocker-field select');
  const options = () => A.$$eval('.blocker-field select option', (o) => o.map((x) => x.value).filter(Boolean));
  ok((await options()).sort().join() === 'a,c', 'Wählbar sind die anderen Karten', await options());
  await A.select('.blocker-field select', 'a');
  await wait(100);
  ok(/Basis/.test(await A.$eval('.blocker-list', (x) => x.textContent)) && !(await options()).includes('a'), 'Die Wahl erscheint in der Liste');
  await A.$eval('.modal-back button[type=submit]', (x) => x.click());
  await wait(500);
  ok(JSON.stringify((await get(B, 'b')).blockedBy) === '["a"]', 'Abhängigkeit kommt bei allen an', await get(B, 'b'));
  await editCard('a');
  await A.waitForSelector('.blocker-field select');
  ok(!(await options()).includes('b'), 'Kreise stehen nicht zur Wahl', await options());
  await A.select('.blocker-field select', 'c');
  await A.$eval('.modal-back button[type=submit]', (x) => x.click());
  await wait(400);
  await editCard('c');
  await A.waitForSelector('.blocker-field select');
  ok(!(await options()).length && (await A.$eval('.blocker-field select', (x) => x.disabled)), 'Auch über mehrere Stufen nicht', await options());
  await A.keyboard.press('Escape');
  await wait(200);
  // Der Server lässt sich nicht umgehen
  await core(B, (c) => {
    const k = c.getEl('c');
    c.setEl({ ...k, blockedBy: ['b'] });
  });
  await wait(700);
  ok(!(await get(A, 'c')).blockedBy && !(await get(B, 'c')).blockedBy, 'Der Server lehnt Kreise ab, auch beim Absender', await get(B, 'c'));
  await core(B, (c) => {
    const k = c.getEl('c');
    c.setEl({ ...k, blockedBy: ['c', 'gibtsnicht', '__proto__', 7, 'a b', 'n1'] });
  });
  await wait(700);
  ok(!(await get(B, 'c')).blockedBy, 'Bezug auf sich selbst und Unbekanntes entfällt', await get(B, 'c'));
  await open(B, did);
  ok(JSON.stringify((await get(B, 'b')).blockedBy) === '["a"]', 'Nach dem Neuladen ist das Feld noch da', await get(B, 'b'));
  await core(A, (c) => c.app.emit('openCardViews'));
  await A.waitForSelector('.kanban');
  ok(/Blockiert durch: Basis/.test(await A.$eval('.kanban', (x) => x.textContent)), 'Kanban zeigt die Abhängigkeit');
  ok(await A.$eval('.kanban-blocked', (x) => x.classList.contains('open')), 'Offene Blockierer sind hervorgehoben');
  await A.$eval('#view-tab-timeline', (x) => x.click());
  await wait(500);
  const links = await A.$$eval('.tl-link', (l) => l.map((p) => [p.dataset.from, p.dataset.to, p.classList.contains('late'), p.getAttribute('d')]));
  ok(links.some(([x, y, late]) => x === 'a' && y === 'b' && !late), 'Die Zeitleiste zeichnet den Pfeil', links);
  ok(links.some(([x, y, late]) => x === 'c' && y === 'a' && late), 'Ein zu früher Beginn ist markiert', links);
  ok(await A.evaluate(() => [...document.querySelectorAll('.tl-blocked')].some((x) => /Basis/.test(x.getAttribute('aria-label')))), 'Auch ohne Pfeil lesbar');
  await A.$eval('#view-tab-kanban', (x) => x.click());
  await core(A, (c) => {
    c.setSelection(['a']);
  });
  const dup = await core(A, (c) => c.duplicateEls([c.getEl('a'), c.getEl('b')]).length);
  await wait(400);
  const copies = await core(A, (c) => [...c.app.els.values()].filter((e) => e.type === 'card' && !['a', 'b', 'c'].includes(e.id)).map((e) => ({ id: e.id, t: e.title, by: e.blockedBy })));
  const copyA = copies.find((e) => e.t === 'Basis'), copyB = copies.find((e) => e.t === 'Mitte');
  ok(dup !== 0 && copyB && copyB.by[0] === copyA.id, 'Kopien hängen aneinander', copies);
  await core(A, (c, ids) => c.deleteEls(['c', ...ids]), copies.map((e) => e.id));
  await wait(700);
  await core(A, (c) => c.deleteEls(['a']));
  await wait(600);
  ok(!/Basis/.test(await A.$eval('.kanban-blocked', (x) => x.textContent).catch(() => '')), 'Gelöschte Karten verschwinden aus der Anzeige');
  await A.keyboard.press('Escape');
  await wait(300);
  await editCard('b');
  await A.waitForSelector('.blocker-field select');
  ok(!(await A.$eval('.blocker-list', (x) => x.textContent)), 'Und aus dem Dialog');
  await A.keyboard.press('Escape');
  await wait(200);
  const json = await core(A, (c) => JSON.stringify(c.getEl('b')));
  ok(JSON.parse(json).blockedBy, 'Im Backup bleibt das Feld erhalten', json);

  // Rückgängig von „Karte und Blockierer gelöscht“: Die Reihenfolge der Ankunft darf den Bezug nicht kosten
  const uid2 = await newBoard(A, 'Rück', [card('rA', 0, 0, 'Abhängig', { blockedBy: ['rB'] }), card('rB', 400, 0, 'Blockierer')], ['anna@example.org']);
  await open(A, uid2);
  await open(B, uid2);
  const [savedA, savedB] = [await get(A, 'rA'), await get(A, 'rB')];
  ok(JSON.stringify(savedA.blockedBy) === '["rB"]', 'Ausgangslage: Bezug steht', savedA);
  await core(A, (c) => c.deleteEls(['rA', 'rB']));
  await wait(500);
  await core(A, (c, el) => c.app.sync.op({ op: 'upsert', el }), savedA);
  await wait(400);
  ok(JSON.stringify((await get(B, 'rA')).blockedBy) === '["rB"]', 'A kommt vor B an: Der Bezug bleibt', await get(B, 'rA'));
  await core(A, (c, el) => c.app.sync.op({ op: 'upsert', el }), savedB);
  await wait(1400);
  await open(A, uid2);
  await open(B, uid2);
  ok(JSON.stringify((await get(B, 'rA')).blockedBy) === '["rB"]' && !!(await get(B, 'rB')), 'Beide wieder da, Bezug gespeichert', await get(B, 'rA'));
  await core(A, (c) => {
    c.setEl({ ...c.getEl('rB'), blockedBy: ['rA'] });
  });
  await wait(500);
  ok(!(await get(A, 'rB')).blockedBy, 'Kreise bleiben auch danach ausgeschlossen', await get(A, 'rB'));
  await open(A, did);
  await open(B, did);

  console.log('=== Schnelleingabe');
  const qid = await newBoard(A, 'Schnell', [note('z', 0, 0, 'Daneben')], ['anna@example.org']);
  await open(A, qid);
  await open(B, qid, '?transport=poll'); // Der Rückfall-Transport trägt die Eingabe genauso
  const cards = (p) => core(p, (c) => [...c.app.els.values()].filter((e) => e.type === 'card').map((e) => ({ id: e.id, title: e.title, status: e.status, points: e.points })));
  await A.keyboard.press('k');
  await wait(150);
  await A.mouse.click(700, 500);
  await wait(300);
  ok(!(await A.$('.modal-back')), 'Das Werkzeug öffnet keinen Dialog');
  ok(await A.evaluate(() => document.activeElement?.id === 'editor'), 'Der Fokus steht im Titel');
  await A.keyboard.type('Direkt getippt');
  await wait(400);
  ok((await cards(B))[0]?.title === 'Direkt getippt', 'Andere sehen den Titel beim Tippen', await cards(B));
  await A.keyboard.press('Enter');
  await wait(300);
  const q1 = (await cards(A))[0];
  ok(q1.title === 'Direkt getippt' && !(await core(A, (c) => !!c.app.editing)), 'Enter schließt die Eingabe', q1);
  ok(await A.evaluate(() => [...document.querySelectorAll('#ctxbar button')].some((x) => /Karte bearbeiten/.test(x.title + x.getAttribute('aria-label') + x.dataset.tip))), '„Karte bearbeiten“ steht in der Kontextleiste');
  await core(A, (c) => c.undo());
  await wait(300);
  ok(!(await cards(A)).length, 'Rückgängig nimmt Anlegen und Titel zusammen zurück');
  await core(A, (c) => c.redo());
  await wait(300);
  // Titel im Dialog bei offener Schnelleingabe: Er läuft über die Eingabe, ein anderer Weg erreichte den Server nicht
  await A.keyboard.press('k');
  await wait(100);
  await A.mouse.click(1000, 720);
  await wait(300);
  await (await A.evaluateHandle(() => [...document.querySelectorAll('#ctxbar button')].find((x) => /Karte bearbeiten/.test(x.title + x.getAttribute('aria-label') + x.dataset.tip)))).click();
  await A.waitForSelector('.modal-back form');
  await wait(200);
  await A.keyboard.type('Titel aus dem Dialog');
  await A.click('.modal-back button[type=submit]');
  await wait(800);
  ok((await cards(B)).some((c) => c.title === 'Titel aus dem Dialog'), 'Titel aus dem Dialog erreicht alle', await cards(B));
  ok(!(await core(A, (c) => !!c.app.editing)), 'Speichern beendet die Eingabe');
  const fromDialog = (await cards(A)).find((c) => c.title === 'Titel aus dem Dialog');
  await open(B, qid, '?transport=poll');
  ok((await cards(B)).some((c) => c.id === fromDialog?.id && c.title === 'Titel aus dem Dialog'), 'Auch nach dem Neuladen, der Server hat ihn', await cards(B));
  await core(A, (c, id) => c.deleteEls([id]), fromDialog?.id);
  await wait(300);
  // Leer verlassen
  const undoBefore = await core(A, (c) => c.canUndo());
  await A.keyboard.press('k');
  await wait(100);
  await A.mouse.click(300, 700);
  await wait(250);
  await A.keyboard.press('Escape');
  await wait(400);
  ok((await cards(A)).length === 1 && (await cards(B)).length === 1, 'Ohne Titel verschwindet die Karte wieder', await cards(B));
  ok((await core(A, (c) => c.canUndo())) === undoBefore, 'und hinterlässt nichts im Verlauf');
  // Während der Eingabe hängt jemand etwas an die Karte: Sie bleibt
  await A.keyboard.press('k');
  await wait(100);
  await A.mouse.click(300, 700);
  await wait(300);
  const wip = (await cards(A)).find((c) => !c.title);
  await core(B, (c, id) => c.updateEl(id, { status: 'Offen' }), wip.id);
  await wait(500);
  await A.keyboard.press('Escape');
  await wait(400);
  ok((await cards(A)).some((c) => c.id === wip.id), 'Hat jemand die Karte schon genutzt, bleibt sie', await cards(A));
  // Gemeinsam tippen
  await A.keyboard.press('k');
  await wait(100);
  await A.mouse.click(1000, 300);
  await wait(300);
  await A.keyboard.type('ab');
  await wait(300);
  const shared = (await cards(B)).find((c) => c.title === 'ab');
  ok(shared, 'Der Titel ist bei B angekommen', await cards(B));
  const ttext = await B.evaluate(async (id, board) => {
    const client = 'b' + Date.now();
    const hello = await (await fetch(`/api/boards/${board}/events?client=${client}&transport=poll`)).json();
    const r = await fetch(`/api/boards/${board}/ops`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Vibeboard': '1' }, body: JSON.stringify({ clientId: client, ops: [{ op: 'ttext', id, field: 'title', ops: [{ p: 0, i: 'X' }], base: hello.messages[0].seq, opId: 'q1' }] }) });
    return r.status;
  }, shared.id, qid);
  await wait(500);
  ok(ttext === 200 && /^Xab/.test((await get(B, shared.id)).title), 'Der Server nimmt Eingabeschritte für Kartentitel an', { ttext, now: await get(B, shared.id) });
  await A.keyboard.type('c');
  await wait(600);
  await A.keyboard.press('Enter');
  await wait(600);
  const merged = (await cards(A)).find((c) => c.id === shared.id).title;
  ok(merged === 'Xabc', 'Gleichzeitiges Tippen bleibt erhalten', merged);
  ok(((await cards(B)).find((c) => c.id === shared.id).title) === merged, 'Beide sehen denselben Titel', await cards(B));

  console.log('=== Kanban: Schnelleingabe und Summe');
  const kid = await newBoard(A, 'Kan', [card('k1', 0, 0, 'Eins', { status: 'Offen', points: '5' }), card('k2', 400, 0, 'Zwei', { status: 'Offen', points: '3,5' }), card('k3', 800, 0, 'Drei', { status: 'Offen', points: 'M' }), card('k4', 1200, 0, 'Vier', { status: 'Fertig' })]);
  await open(A, kid);
  await core(A, (c) => c.app.emit('openCardViews'));
  await A.waitForSelector('.kanban');
  const heads = () => A.$$eval('.kanban-head', (x) => x.map((y) => y.textContent));
  ok((await heads()).some((t) => /Offen/.test(t) && /Σ 8,5/.test(t)), 'Der Spaltenkopf zeigt die Summe der Zahlen', await heads());
  ok((await heads()).some((t) => /Fertig/.test(t) && !/Σ/.test(t)), 'Ohne Zahlen keine Summe', await heads());
  await A.evaluate(() => [...document.querySelectorAll('.kanban-col')].find((x) => /Fertig/.test(x.querySelector('h3').textContent)).querySelector('.kanban-plus').click());
  await wait(200);
  ok(await A.evaluate(() => document.activeElement?.closest('.kanban-new') !== null), 'Das Plus setzt den Fokus ins Titelfeld');
  await A.keyboard.type('Verworfen');
  await A.keyboard.press('Escape');
  await wait(200);
  ok((await A.$('.kanban')) && !(await A.$('.kanban-new')), 'Esc schließt nur das Feld, die Ansicht bleibt');
  ok(await A.evaluate(() => document.activeElement?.classList.contains('kanban-plus')), 'Der Fokus steht wieder auf dem Plus');
  ok(!(await cards(A)).some((c) => c.title === 'Verworfen'), 'Es entsteht keine Karte');
  await A.keyboard.press('Enter');
  await wait(200);
  ok(await A.evaluate(() => document.activeElement?.closest('.kanban-new') !== null), 'Das Plus öffnet das Feld wieder');
  await A.keyboard.type('Aus der Spalte');
  await A.keyboard.press('Enter');
  await wait(300);
  await A.keyboard.type('Noch eine');
  await A.keyboard.press('Enter');
  await wait(400);
  const made = await cards(A);
  ok(made.filter((c) => c.status === 'Fertig').length === 3 && made.some((c) => c.title === 'Noch eine'), 'Enter legt an, der Fokus bleibt im Feld', made);
  ok(/Aus der Spalte/.test(await A.$eval('.kanban', (x) => x.textContent)), 'Die Spalte zeigt die neue Karte');
  await A.keyboard.press('Escape');

  console.log('=== Gäste der Stufe Beiträge');
  await api(A, 'PUT', '/api/admin/settings', { collab: { guestLinks: true, guestContributions: true, guestNoteLimit: 5 } });
  const r = await api(A, 'POST', `/api/boards/${kid}/guest-links`, { role: 'contributor', days: 1 });
  const token = r.body.token;
  const c6c = await b.createBrowserContext();
  const G = await c6c.newPage();
  G.on('pageerror', (e) => errs.push('G ' + e.message));
  await G.goto(BASE + '/login', { waitUntil: 'load' });
  const j = await api(G, 'POST', '/api/guest/join', { token, name: 'Gerda', consent: true });
  ok(j.status === 200, 'Gast tritt bei', j);
  await open(G, kid);
  ok(!(await G.$('[data-tool="card"]')), 'Kein Karten-Werkzeug');
  await core(G, (c) => c.app.emit('openCardViews'));
  await G.waitForSelector('.kanban');
  ok(!(await G.$('.kanban-plus')), 'Kein Plus in der Kanban-Ansicht');
  const guestOps = await G.evaluate(async (id) => {
    const client = 'g' + Date.now();
    const hello = await (await fetch(`/api/boards/${id}/events?client=${client}&transport=poll`)).json();
    const seq = hello.messages[0].seq;
    const send = (ops) => fetch(`/api/boards/${id}/ops`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Vibeboard': '1' }, body: JSON.stringify({ clientId: client, ops }) }).then((x) => x.json());
    return [await send([{ op: 'ttext', id: 'k1', field: 'title', ops: [{ p: 0, i: 'x' }], base: seq, opId: 'g1' }]), await send([{ op: 'upsert', el: { id: 'gkarte', type: 'card', x: 0, y: 0, w: 300, h: 140, title: 'Gast' } }])];
  }, kid);
  await wait(500);
  ok((await get(A, 'k1')).title === 'Eins' && !(await get(A, 'gkarte')), 'Der Server lehnt Karten von Gästen ab', guestOps);

  ok(!errs.length, 'Keine Fehler im Browser', errs);
  await b.close();
  console.log(f ? `${f} fehlgeschlagen` : 'alles ok');
  process.exit(f ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
