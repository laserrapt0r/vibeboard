// Formen: Katalog, Panel „Alle Formen“, Paketauswahl, Administration, unbekannte Formen, Exporte
const { launch, BASE } = require('./lib');
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
const login = async (p, e, pw) => {
  await p.goto(BASE + '/login', { waitUntil: 'networkidle0' });
  const r = await api(p, 'POST', '/api/auth/login', { login: e, password: pw });
  if (r.status >= 300) throw new Error('login ' + e);
};
const ev = (p, fn, ...a) => p.evaluate(fn, ...a);
const board = async (p, name) => {
  const id = (await api(p, 'POST', '/api/boards', { name })).body.id;
  await p.goto(BASE + '/board/' + id, { waitUntil: 'load' });
  await wait(1200);
  await ev(p, () => document.querySelector('#empty-start .btn:last-child')?.click());
  return id;
};
const panelOpen = (p) => ev(p, () => !document.querySelector('#sidepanel').classList.contains('hidden') && !!document.querySelector('#sidepanel .shapes-panel'));
const shown = (p) => ev(p, () => [...document.querySelectorAll('#sidepanel .shape-btn')].filter((b) => b.offsetParent).map((b) => b.dataset.shape));
const search = async (p, q) => {
  await ev(p, () => {
    const i = document.querySelector('.shape-search input');
    i.value = '';
    i.focus();
  });
  await p.keyboard.type(q);
  await wait(100);
  return shown(p);
};

(async () => {
  const b = await launch();
  const errs = [];
  const A = await b.newPage();
  A.on('pageerror', (e) => errs.push('A ' + e.message));
  await A.setViewport({ width: 1400, height: 950 });
  await login(A, 'admin@test.example', 'Rotkehlchen-Wolke-47');
  await api(A, 'PUT', '/api/admin/settings', { design: { shapePacksOff: '' } });
  await api(A, 'PUT', '/api/auth/me/shape-packs', { off: [] });
  const boardId = await board(A, 'Formen');

  console.log('=== Katalog');
  const cat = await ev(A, async () => {
    const r = await import('/js/render.js');
    const k = await import('/js/shape-catalog.js');
    const keys = r.SHAPES.map((x) => x[0]);
    const packed = new Set(k.SHAPE_PACKS.flatMap((p) => p.keys));
    return { keys, n: keys.length, dup: keys.length - new Set(keys).size, unknown: [...packed].filter((x) => !keys.includes(x)), lost: keys.filter((x) => !packed.has(x)), packs: k.SHAPE_PACKS.map((p) => [p.id, p.keys.length]) };
  });
  console.log('    Pakete: ' + cat.packs.map(([a, n]) => `${a} ${n}`).join(', ') + `, zusammen ${cat.n}`);
  ok(cat.n >= 140 && !cat.dup, 'Mindestens 140 Formen ohne doppelte Namen', cat.n);
  ok(!cat.unknown.length && !cat.lost.length, 'Pakete und Formenliste passen zusammen', [cat.unknown, cat.lost]);
  const required = ['pentagon', 'octagon', 'callout', 'doublearrow', 'leftarrow', 'braceleft', 'braceright', 'chevron', 'arrowflag', 'barprocess', 'cloudround', 'snipcorner', 'document', 'multidoc', 'preparation', 'manualinput', 'manualop', 'parallelogram', 'cylinder', 'directstorage', 'internalstorage', 'delay', 'display', 'punchcard', 'punchtape', 'fcor', 'fcsum', 'fcsort', 'fcmerge', 'fcextract', 'storeddata', 'fcconnector', 'offpage', 'annotleft', 'annotright', 'seqaccess', 'eventmsg', 'endcancel', 'intertimer', 'taskuser', 'taskmanual', 'bpmnsub', 'gatewayevent', 'gatewaycomplex', 'dataobject', 'datastore', 'pool', 'lane', 'umlinterface', 'umlobject', 'lifeline', 'activation', 'fragment', 'erweak', 'erkey', 'ertable', 'dfdprocess', 'dfdstore', 'vsmprocess', 'vsmsupplier', 'vsminventory', 'vsmwarehouse', 'vsmkaizen', 'vsmpush', 'vsmpull', 'vsmdata', 'archlayer', 'archservice', 'archboundary'];
  ok(required.every((k) => cat.keys.includes(k)), 'Alle verlangten Formen sind da', required.filter((k) => !cat.keys.includes(k)));

  console.log('=== Jede Form zeichnen');
  const geo = await ev(A, async () => {
    const c = await import('/js/core.js');
    const r = await import('/js/render.js');
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('width', '1000');
    svg.setAttribute('height', '1000');
    svg.style.cssText = 'position:fixed;left:0;top:0;opacity:0';
    document.body.append(svg);
    const res = { noArea: [], outside: [], textOut: [], anchorsBad: [], threw: [], small: [] };
    for (const [kind] of r.SHAPES) {
      for (const scale of [1, 2.5, 0.5]) {
        try {
          const d = r.SHAPE_DEFAULTS[kind] || {};
          const w = (d.w || 200) * scale, h = (d.h || 140) * scale;
          const el = c.makeElement('shape', 0, 0, { shape: kind, x: 100, y: 100, w, h, text: d.text || 'Abc', fontSize: 12 });
          svg.innerHTML = r.renderElement(el, { get: () => null });
          const paths = [...svg.querySelectorAll('path,rect,ellipse,polygon')].filter((n) => !n.classList.contains('hit'));
          const box = paths.map((n) => n.getBBox());
          const minX = Math.min(...box.map((q) => q.x)), minY = Math.min(...box.map((q) => q.y));
          const maxX = Math.max(...box.map((q) => q.x + q.width)), maxY = Math.max(...box.map((q) => q.y + q.height));
          if (!paths.length || maxX - minX < 3 || maxY - minY < 3) res.noArea.push(kind);
          const tol = 3;
          if (minX < 100 - tol - 2 || minY < 100 - tol - 2 || maxX > 100 + w + tol + 2 || maxY > 100 + h + tol + 2) res.outside.push([kind, scale, minX, minY, maxX, maxY]);
          // Der Textbereich liegt in der Form, außer die Beschriftung steht bewusst daneben
          const t = r.shapeTextBox(kind, 100, 100, w, h);
          if (t.w <= 0 || t.h <= 0) res.small.push(kind);
          const outsideLabel = r.labelOutside(kind) || r.textRotated(kind);
          if (!outsideLabel && (t.x < 100 - 1 || t.y < 100 - 1 || t.x + t.w > 100 + w + 1 || t.y + t.h > 100 + h + 1)) res.textOut.push([kind, scale]);
          if (scale === 1) {
            const text = [...svg.querySelectorAll('text')];
            for (const n of text) {
              const q = n.getBBox();
              if (r.textRotated(kind)) continue;
              if (!outsideLabel && !/umlclass/.test(kind) && (q.x < 100 - 4 || q.x + q.width > 100 + w + 4 || q.y < 100 - 4 || q.y + q.height > 100 + h + 4)) res.textOut.push([kind, 'gerendert', q.x, q.y, q.width, q.height]);
            }
            // Andockpunkte: vier Seiten auf oder in der Fläche der Form, alle verschieden
            const pts = ['top', 'right', 'bottom', 'left'].map((s) => r.sideAnchor({ ...el }, s));
            const bad = pts.some((p) => !Number.isFinite(p.x) || p.x < 100 - 1 || p.x > 100 + w + 1 || p.y < 100 - 1 || p.y > 100 + h + 1) || new Set(pts.map((p) => `${Math.round(p.x)},${Math.round(p.y)}`)).size < 4;
            if (bad) res.anchorsBad.push(kind);
          }
        } catch (e) {
          res.threw.push([kind, e.message]);
        }
      }
    }
    svg.remove();
    return res;
  });
  ok(!geo.threw.length, 'Keine Form wirft beim Zeichnen', geo.threw);
  ok(!geo.noArea.length, 'Jede Form hat Fläche', geo.noArea);
  ok(!geo.outside.length, 'Keine Form ragt aus ihrem Rahmen', geo.outside.slice(0, 8));
  ok(!geo.small.length, 'Jede Form hat einen Textbereich', geo.small);
  ok(!geo.textOut.length, 'Text bleibt im Textbereich', geo.textOut.slice(0, 8));
  ok(!geo.anchorsBad.length, 'Vier Andockpunkte je Form', geo.anchorsBad);

  console.log('=== Text, Andocken, Größe, Format auf neuen Formen');
  await ev(A, async () => {
    const c = await import('/js/core.js');
    c.addElements([c.makeElement('shape', 400, 300, { id: 'poolA', shape: 'pool', x: 300, y: 200, w: 500, h: 200, text: '' }), c.makeElement('shape', 500, 600, { id: 'gwA', shape: 'gatewaycomplex', x: 500, y: 600, text: '' })]);
    c.setSelection(['poolA']);
    c.fitTo({ x: 200, y: 150, w: 800, h: 600 }, { maxZ: 1 });
  });
  await wait(300);
  await ev(A, async () => (await import('/js/core.js')).startEdit('poolA'));
  await wait(150);
  ok(await ev(A, () => /rotate/.test(document.querySelector('#editor, textarea.editor, .text-editor')?.style.transform || [...document.querySelectorAll('textarea')].map((t) => t.style.transform).join(' '))), 'Pool: Editor steht gedreht im Kopfstreifen');
  await A.keyboard.type('Vertrieb');
  await A.keyboard.press('Escape');
  await wait(300);
  const poolText = await ev(A, async () => {
    const c = await import('/js/core.js');
    return { text: c.getEl('poolA').text, rot: !!document.querySelector('[data-id="poolA"] g[transform*="rotate"], g[transform*="rotate(-90"]') };
  });
  ok(poolText.text === 'Vertrieb', 'Text in Pool getippt', poolText);
  ok(poolText.rot, 'Pool-Beschriftung steht gedreht', poolText);
  const paste = await ev(A, async () => {
    const c = await import('/js/core.js');
    c.setSelection(['gwA']);
    c.copyFormat();
    const e = c.makeElement('shape', 900, 600, { id: 'rcA', shape: 'rect', x: 900, y: 600, fill: '#ffffff', text: 'r' });
    c.addElements([e]);
    c.setSelection(['rcA']);
    c.pasteFormat();
    return c.getEl('rcA').shape;
  });
  ok(paste === 'gatewaycomplex', 'Format übertragen übernimmt die neue Form', paste);
  const ink = await ev(A, async () => {
    const c = await import('/js/core.js');
    const e = c.makeElement('shape', 0, 0, { id: 'annA', shape: 'annotleft', text: 'InkTest', x: 300, y: 450 });
    const life = c.makeElement('shape', 0, 0, { id: 'lifeA', shape: 'lifeline', text: 'x', x: 500, y: 450 });
    c.addElements([e, life]);
    c.app.settings.dark = true;
    c.saveSettings();
    c.scheduleRender(true);
    await new Promise((r) => setTimeout(r, 300));
    const t = [...document.querySelectorAll('#stage text')].find((n) => n.textContent === 'InkTest');
    const out = { text: t?.getAttribute('fill'), dash: [...document.querySelectorAll('#stage path[stroke-dasharray]')].map((n) => n.getAttribute('stroke')) };
    c.app.settings.dark = false;
    c.saveSettings();
    c.deleteEls?.(['annA', 'lifeA']);
    return out;
  });
  ok(ink.text && ink.text !== '#1a1a1a', 'Offene Form: Text folgt dem dunklen Untergrund', ink);
  ok(ink.dash.length && ink.dash.every((x) => x !== '#1a1a1a'), 'Lebenslinie: Linie auf dem Board bleibt im Dunkeln sichtbar', ink);

  console.log('=== Popover und Panel');
  await A.keyboard.press('Escape');
  await A.mouse.click(700, 800);
  await A.keyboard.press('s');
  await wait(300);
  const pop = await ev(A, () => ({ all: !!document.querySelector('.shape-pop .shape-all'), titles: [...document.querySelectorAll('.shape-pop .pop-title')].map((t) => t.textContent), n: document.querySelectorAll('.shape-pop .shape-btn').length }));
  ok(pop.all && pop.titles.includes('Grundformen') && !pop.titles.includes('UML') && pop.n >= 20, 'Popover: Grundformen plus „Alle Formen“', pop);
  await ev(A, () => performance.mark('p'));
  const t0 = await ev(A, () => {
    const s = performance.now();
    document.querySelector('.shape-pop .shape-all').click();
    const inner = performance.now() - s;
    return new Promise((res) => requestAnimationFrame(() => setTimeout(() => res([inner, performance.now() - s]), 0)));
  });
  console.log('    Panel öffnet in ' + Math.round(t0[1]) + ' ms');
  ok(t0[1] < 200, 'Panel öffnet unter 200 ms', t0);
  ok(await panelOpen(A), 'Panel ist offen');
  const pos = await ev(A, () => {
    const r = document.querySelector('#sidepanel').getBoundingClientRect();
    return { left: r.left, right: r.right, popup: !!document.querySelector('.shape-pop'), focus: document.activeElement?.type };
  });
  ok(pos.left < 200 && pos.right < 500, 'Panel liegt links', pos);
  ok(!pos.popup, 'Popover ist zu', pos);
  ok(pos.focus === 'search', 'Fokus im Suchfeld', pos);
  const all = await shown(A);
  ok(all.length >= 120, 'Panel zeigt alle Gruppen', all.length);
  ok((await search(A, 'datenbank')).includes('cylinder'), 'Suche nach Namen im Paket (Datenbank)');
  ok((await search(A, 'swimlane')).includes('lane'), 'Suche nach Synonym (swimlane)');
  ok((await search(A, 'dokumnet')).includes('document'), 'Tippfehler wird toleriert (dokumnet)');
  ok((await search(A, 'gatewy')).some((k) => k.startsWith('gateway')), 'Tippfehler wird toleriert (gatewy)');
  ok((await search(A, 'xyzzyqq')).length === 0 && (await ev(A, () => /Keine passende/.test(document.querySelector('.shape-body').textContent))), 'Ohne Treffer ein Hinweis');
  // Tastatur: Suchfeld, Pfeile, Enter
  await search(A, 'ereignis nachricht');
  await A.keyboard.press('ArrowDown');
  await wait(50);
  const first = await ev(A, () => document.activeElement?.dataset?.shape);
  await A.keyboard.press('ArrowRight');
  await wait(50);
  const second = await ev(A, () => document.activeElement?.dataset?.shape);
  ok(first && second && first !== second, 'Pfeiltasten im Raster', [first, second]);
  await A.keyboard.press('ArrowLeft');
  await wait(50);
  ok((await ev(A, () => document.activeElement?.dataset?.shape)) === first, 'Pfeil zurück');
  const before = await ev(A, async () => (await import('/js/core.js')).app.els.size);
  await A.keyboard.press('Enter');
  await wait(300);
  const afterEnter = await ev(A, async () => {
    const c = await import('/js/core.js');
    return { n: c.app.els.size, editing: !!c.app.editing, sh: c.getEl(c.app.editing?.id)?.shape };
  });
  ok(afterEnter.n === before + 1 && afterEnter.sh === first && afterEnter.editing, 'Enter legt die Form in der Mitte an', afterEnter);
  await A.keyboard.press('Escape');
  await wait(200);
  // Esc: erst Suche leeren, dann schließen
  await ev(A, () => document.querySelector('.shape-search input').focus());
  await A.keyboard.press('Escape');
  await wait(100);
  ok((await ev(A, () => document.querySelector('.shape-search input').value)) === '' && (await panelOpen(A)), 'Esc leert zuerst die Suche');
  await A.keyboard.press('Escape');
  await wait(150);
  ok(!(await panelOpen(A)), 'Esc schließt das Panel');
  // Befehlssuche
  await A.keyboard.down('Control');
  await A.keyboard.press('k');
  await A.keyboard.up('Control');
  await wait(300);
  await A.keyboard.type('Alle Formen');
  await wait(300);
  await A.keyboard.press('Enter');
  await wait(400);
  ok(await panelOpen(A), 'Befehlssuche öffnet das Panel');
  // „Zuletzt verwendet“ steht oben
  const rec = await ev(A, () => ({ first: document.querySelector('.shape-body section')?.className, keys: [...document.querySelectorAll('.shape-recent .shape-btn')].map((b) => b.dataset.shape) }));
  ok(/shape-recent/.test(rec.first) && rec.keys[0] === first, 'Zuletzt verwendet oben', rec);
  // Gruppe klappen
  const collapse = await ev(A, () => {
    const h = [...document.querySelectorAll('.shape-group-head')].find((x) => /UML/.test(x.textContent));
    const before = h.nextElementSibling.offsetHeight;
    h.click();
    return { before, after: h.nextElementSibling.offsetHeight, exp: h.getAttribute('aria-expanded') };
  });
  ok(collapse.before > 0 && collapse.after === 0 && collapse.exp === 'false', 'Gruppe klappt zu', collapse);
  await ev(A, () => [...document.querySelectorAll('.shape-group-head')].find((x) => /UML/.test(x.textContent)).click());
  // Tooltip
  const btn = await ev(A, () => {
    const b = document.querySelector('.shape-group .shape-btn[data-shape="pentagon"]');
    b.scrollIntoView();
    const r = b.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  await A.mouse.move(btn.x, btn.y);
  await wait(500);
  ok((await ev(A, () => document.querySelector('.tooltip:not(.hidden)')?.textContent)) === 'Fünfeck', 'Tooltip nennt den Namen');
  // Maus: Klick wählt das Werkzeug, Klick aufs Board legt an
  await A.mouse.click(btn.x, btn.y);
  await wait(200);
  const tool = await ev(A, async () => {
    const c = await import('/js/core.js');
    return { tool: c.app.tool, shape: c.app.toolOpts.shape, pop: !!document.querySelector('.shape-pop') };
  });
  ok(tool.tool === 'shape' && tool.shape === 'pentagon' && !tool.pop, 'Klick wählt Werkzeug und Form', tool);
  await A.mouse.click(900, 500);
  await wait(300);
  const placed = await ev(A, async () => {
    const c = await import('/js/core.js');
    return c.getEl(c.app.editing?.id)?.shape;
  });
  ok(placed === 'pentagon', 'Klick aufs Board legt die Form an', placed);
  await A.keyboard.press('Escape');
  await wait(150);
  ok(await panelOpen(A), 'Panel bleibt beim Anlegen offen');
  // Ziehen aufs Board
  const lifeBtn = await ev(A, () => {
    const b = document.querySelector('.shape-group .shape-btn[data-shape="vsmkaizen"]');
    b.scrollIntoView({ block: 'center' });
    const r = b.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  await A.mouse.move(lifeBtn.x, lifeBtn.y);
  await A.mouse.down();
  await A.mouse.move(lifeBtn.x + 80, lifeBtn.y + 10, { steps: 4 });
  await A.mouse.move(1000, 350, { steps: 6 });
  ok(await ev(A, () => !!document.querySelector('.shape-ghost')), 'Beim Ziehen läuft eine Vorschau mit');
  await A.mouse.up();
  await wait(300);
  const dropped = await ev(A, async () => {
    const c = await import('/js/core.js');
    const e = [...c.app.els.values()].find((x) => x.shape === 'vsmkaizen');
    if (!e) return { keine: [...c.app.els.values()].map((x) => x.shape), tool: c.app.tool, sel: [...c.app.sel] };
    const s = c.toScreen(e.x + e.w / 2, e.y + e.h / 2), r = c.stage.getBoundingClientRect();
    return { shape: e.shape, x: s.x + r.left, y: s.y + r.top, ghost: !!document.querySelector('.shape-ghost') };
  });
  ok(dropped.shape === 'vsmkaizen' && Math.abs(dropped.x - 1000) < 30 && Math.abs(dropped.y - 350) < 30 && !dropped.ghost, 'Ziehen legt die Form an der Stelle ab', dropped);
  ok(await ev(A, async () => !!(await import('/js/core.js')).app.editing), 'Nach dem Ablegen läuft die Eingabe');
  await A.keyboard.press('Escape');
  await wait(100);

  console.log('=== Paketauswahl');
  await ev(A, () => [...document.querySelectorAll('.shape-foot button')].find((x) => /Formen verwalten/.test(x.textContent)).click());
  await wait(100);
  const packs = await ev(A, () => [...document.querySelectorAll('.shape-manage input')].map((i) => i.dataset.pack));
  // 15 eingebaute Pakete (seit 4.19.0 mit den Fachsymbolen), eigene Pakete der Administration kommen dazu
  ok(packs.filter((p) => !p.startsWith('cu-')).length === 15 && ['icons', 'kubernetes', 'carbon', 'electrical', 'process'].every((p) => packs.includes(p)) && !packs.includes('basic'), 'Verwaltung listet die abwählbaren Pakete', packs);
  await ev(A, () => document.querySelector('.shape-manage input[data-pack="vsm"]').click());
  await wait(300);
  await ev(A, () => [...document.querySelectorAll('.shape-foot button')].find((x) => /Zurück/.test(x.textContent)).click());
  await wait(150);
  const noVsm = await shown(A);
  ok(!noVsm.includes('vsmkaizen') || noVsm.filter((k) => k === 'vsmkaizen').length <= 1, 'Abgewähltes Paket verschwindet aus den Gruppen', noVsm.length);
  ok(!(await ev(A, () => [...document.querySelectorAll('.shape-group-head')].some((x) => /Value Stream/.test(x.textContent)))), 'Gruppe Value Stream ist weg');
  ok((await search(A, 'kaizen')).length === 0, 'Suche findet abgewählte Pakete nicht');
  await ev(A, () => {
    const i = document.querySelector('.shape-search input');
    i.value = '';
    i.dispatchEvent(new Event('input'));
  });
  const stored = (await api(A, 'GET', '/api/auth/me')).body.user.shapePacksOff;
  ok(JSON.stringify(stored) === '["vsm"]', 'Auswahl liegt im Konto (geräteübergreifend)', stored);
  ok((await ev(A, async () => [...(await import('/js/core.js')).app.els.values()].some((e) => e.shape === 'vsmkaizen'))), 'Vorhandenes Element bleibt');
  await api(A, 'PUT', '/api/auth/me/shape-packs', { off: ['vsm', 'quatsch', 'basic', 5] });
  const cleaned = (await api(A, 'GET', '/api/auth/me')).body.user.shapePacksOff;
  ok(JSON.stringify(cleaned) === '["vsm"]', 'Server nimmt nur bekannte Pakete an', cleaned);
  await api(A, 'PUT', '/api/auth/me/shape-packs', { off: [] });

  console.log('=== Administration');
  const adminPage = await b.newPage();
  await adminPage.goto(BASE + '/admin', { waitUntil: 'networkidle0' });
  await ev(adminPage, () => [...document.querySelectorAll('button,a')].find((x) => /^Design/.test(x.textContent.trim()))?.click());
  await wait(600);
  const adm = await ev(adminPage, () => [...document.querySelectorAll('input[data-pack]')].map((i) => [i.dataset.pack, i.checked]));
  ok(adm.length === 15 && adm.every(([, c]) => c), 'Administration: alle Pakete sind standardmäßig an', adm);
  adminPage.on('dialog', (d) => d.accept());
  await ev(adminPage, () => document.querySelector('input[data-pack="bpmn"]').click());
  await ev(adminPage, () => document.querySelector('input[data-pack="bpmn"]').closest('form').requestSubmit());
  await wait(1200);
  await adminPage.close();
  ok(((await api(A, 'GET', '/api/config')).body.design.shapePacksOff || []).includes('bpmn'), 'Abgeschaltetes Paket steht in der Konfiguration');
  ok((await api(A, 'PUT', '/api/admin/settings', { design: { shapePacksOff: 'bpmn <script>' } })).status === 200, 'Unsinn abgewiesen');
  ok(JSON.stringify((await api(A, 'GET', '/api/config')).body.design.shapePacksOff) === '["bpmn"]', 'Nur bekannte Pakete bleiben', 0);
  await A.reload({ waitUntil: 'load' });
  await wait(1200);
  await ev(A, async () => (await import('/js/shapes-panel.js')).openShapesPanel());
  await wait(200);
  const adminView = await ev(A, () => ({ heads: [...document.querySelectorAll('.shape-group-head')].map((x) => x.textContent), els: null }));
  ok(!adminView.heads.some((x) => /BPMN/.test(x)), 'Abgeschaltetes Paket fehlt im Panel', adminView.heads);
  await ev(A, () => [...document.querySelectorAll('.shape-foot button')].find((x) => /Formen verwalten/.test(x.textContent)).click());
  ok(!(await ev(A, () => !!document.querySelector('.shape-manage input[data-pack="bpmn"]'))), 'Abgeschaltetes Paket fehlt auch in der persönlichen Verwaltung');
  ok((await ev(A, async () => [...(await import('/js/core.js')).app.els.values()].some((e) => e.shape === 'gatewaycomplex'))), 'Elemente aus dem abgeschalteten Paket bleiben auf dem Board');
  await api(A, 'PUT', '/api/admin/settings', { design: { shapePacksOff: '' } });
  await ev(A, () => [...document.querySelectorAll('.shape-foot button')].find((x) => /Zurück/.test(x.textContent)).click());
  await ev(A, () => document.querySelector('#sidepanel .icon-btn')?.click());

  console.log('=== Unbekannte Form');
  await ev(A, async () => {
    const c = await import('/js/core.js');
    c.addElements([{ ...c.makeElement('shape', 300, 900, { id: 'unkA', x: 300, y: 900, w: 180, h: 90, text: 'Zukunft' }), shape: 'form-aus-der-zukunft' }]);
  });
  await wait(600);
  const unknown = await ev(A, async () => {
    const r = await import('/js/render.js');
    const c = await import('/js/core.js');
    const e = c.getEl('unkA');
    const m = r.renderElement(e, { get: () => null });
    return { rect: /<rect /.test(m), text: m.includes('Zukunft'), kept: e.shape };
  });
  ok(unknown.rect && unknown.text, 'Unbekannte Form erscheint als Rechteck mit Text', unknown);
  ok(unknown.kept === 'form-aus-der-zukunft', 'Der Name bleibt am Element erhalten', unknown);
  await A.reload({ waitUntil: 'load' });
  await wait(1200);
  ok(await ev(A, async () => (await import('/js/core.js')).getEl('unkA')?.shape === 'form-aus-der-zukunft'), 'Unbekannter Name übersteht den Server');
  const evil = await ev(A, async () => {
    const c = await import('/js/core.js');
    c.addElements([{ ...c.makeElement('shape', 300, 900, { id: 'badA', x: 300, y: 1100, w: 100, h: 90 }), shape: '"><script>x' }]);
    return true;
  });
  await wait(600);
  await A.reload({ waitUntil: 'load' });
  await wait(1200);
  ok(evil && (await ev(A, async () => (await import('/js/core.js')).getEl('badA')?.shape === 'rect')), 'Formname mit Markup wird beim Speichern zu rect');
  await A.waitForSelector('#stage');

  console.log('=== Exporte');
  const exp = await ev(A, async () => {
    const r = await import('/js/render.js');
    const c = await import('/js/core.js');
    const ex = await import('/js/exporter.js');
    const px = await import('/js/pptx-export.js');
    const zip = await import('/js/pptx-import.js');
    const els = r.SHAPES.map(([k], i) => c.makeElement('shape', 0, 0, { shape: k, x: (i % 16) * 220, y: Math.floor(i / 16) * 200, w: Math.min(r.SHAPE_DEFAULTS[k]?.w || 200, 200), h: Math.min(r.SHAPE_DEFAULTS[k]?.h || 140, 150), text: 'T' + i }));
    const doc = r.renderSvgDocument(els);
    const parsed = new DOMParser().parseFromString(doc.svg, 'image/svg+xml');
    const t0 = performance.now();
    const png = await ex.pngDataUrl(els, { scale: 0.4, maxSize: 3000, padding: 20 });
    const t1 = performance.now();
    // Stichprobe: Jede als Bild exportierte Form kostet einen eigenen Durchlauf durch die Zeichenfläche
    const few = els.filter((e) => ['pentagon', 'punchcard', 'eventmsg', 'taskuser', 'pool', 'lifeline', 'ertable', 'vsmkaizen', 'archlayer', 'gatewaycomplex', 'braceleft'].includes(e.shape));
    const get = (id) => few.find((e) => e.id === id);
    const blob = await px.buildPptx([{ bounds: { x: -20, y: -20, w: 3560, h: 2200 }, elements: few, title: 'Formen' }], get);
    const t2 = performance.now();
    const slides = await zip.parsePptx(await blob.arrayBuffer());
    return { ms: [t1 - t0, t2 - t1].map(Math.round), few: few.length, svgOk: !parsed.querySelector('parsererror'), missing: els.filter((e) => !doc.svg.includes(`>${e.text}<`)).map((e) => e.shape), size: doc.svg.length, png: png.length, pptx: blob.size, parsedN: (slides.elements || slides).length, n: few.length };
  });
  console.log('    PNG/PPTX ms: ' + exp.ms);
  ok(exp.svgOk && exp.missing.length <= 3, 'SVG ist gültig und enthält den Text (sehr schmale Formen brechen ihn um)', exp);
  ok(exp.png > 20000, 'PNG enthält Formen', exp.png);
  ok(exp.pptx > 20000 && exp.parsedN >= exp.n, 'PPTX lässt sich wieder lesen und enthält alle Formen', exp);

  const pdf = await ev(A, async () => {
    const r = await import('/js/render.js');
    const c = await import('/js/core.js');
    const ex = await import('/js/exporter.js');
    const els = ['pool', 'lifeline', 'endcancel', 'cloudthought'].map((k, i) => c.makeElement('shape', 0, 0, { shape: k, x: i * 800, y: 0, text: k }));
    const blob = await ex.pdfFile([{ elements: els, bounds: r.renderSvgDocument(els).viewBox, padding: 0, title: 'F' }], 'F');
    return { size: blob.size, head: await blob.slice(0, 5).text() };
  });
  ok(pdf.head === '%PDF-' && pdf.size > 3000, 'PDF-Datei mit neuen Formen', pdf);

  console.log('=== Vorlagen');
  const tpl = await api(A, 'POST', '/api/templates', { name: 'Formenprobe', description: '', icon: '📐', elements: [{ id: 'tplA', type: 'shape', shape: 'vsmkaizen', x: 0, y: 0, w: 200, h: 140, text: 'V' }] });
  const back = (await api(A, 'GET', '/api/templates/' + tpl.body?.id)).body;
  ok(tpl.status < 300 && JSON.stringify(back || {}).includes('vsmkaizen'), 'Vorlage behält die neue Form', [tpl.status, JSON.stringify(back).slice(0, 200)]);
  if (tpl.body?.id) await api(A, 'DELETE', '/api/templates/' + tpl.body.id);

  console.log('=== Import');
  const drawio = await ev(A, async () => {
    const { parseDrawio } = await import('/js/import-drawio.js');
    const xml = `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>
      <mxCell id="2" value="A" style="shape=mxgraph.flowchart.preparation;" vertex="1" parent="1"><mxGeometry x="10" y="10" width="100" height="60" as="geometry"/></mxCell>
      <mxCell id="3" value="B" style="shape=umlLifeline;" vertex="1" parent="1"><mxGeometry x="200" y="10" width="100" height="200" as="geometry"/></mxCell>
      <mxCell id="4" value="C" style="shape=unbekannt;" vertex="1" parent="1"><mxGeometry x="400" y="10" width="100" height="60" as="geometry"/></mxCell>
    </root></mxGraphModel>`;
    return (await parseDrawio(xml)).map((e) => e.shape);
  });
  ok(JSON.stringify(drawio) === '["preparation","lifeline","rect"]', 'draw.io-Import bildet neue Formen ab', drawio);

  console.log('=== Gemeinsam tippen');
  const c4 = await b.createBrowserContext();
  const T2 = await c4.newPage();
  await login(T2, 'anna@example.org', 'Gewitter-Laterne-83');
  await api(A, 'POST', `/api/boards/${boardId}/members`, { email: 'anna@example.org', role: 'editor' });
  await A.reload({ waitUntil: 'load' });
  await T2.goto(BASE + '/board/' + boardId, { waitUntil: 'load' });
  await wait(1400);
  await ev(A, async () => {
    const c = await import('/js/core.js');
    c.addElements([c.makeElement('shape', 0, 0, { id: 'lanA', shape: 'taskservice', x: 400, y: 300, text: '' })]);
  });
  await wait(700);
  await A.bringToFront();
  await ev(A, async () => (await import('/js/core.js')).startEdit('lanA'));
  await A.keyboard.type('Eins ');
  await wait(400);
  await T2.bringToFront();
  await ev(T2, async () => (await import('/js/core.js')).startEdit('lanA'));
  await wait(200);
  await T2.keyboard.press('End');
  await T2.keyboard.type('Zwei');
  await wait(800);
  await A.bringToFront();
  await A.keyboard.press('Escape');
  await T2.bringToFront();
  await T2.keyboard.press('Escape');
  await wait(800);
  const joint = await ev(T2, async () => (await import('/js/core.js')).getEl('lanA')?.text);
  ok(/Eins/.test(joint) && /Zwei/.test(joint), 'Zwei Personen tippen in dieselbe neue Form', joint);
  await T2.close();
  await A.bringToFront();

  console.log('=== Gäste und Rollen');
  const c2 = await b.createBrowserContext();
  const V = await c2.newPage();
  await login(V, 'ben@example.org', 'Gewitter-Laterne-83');
  await api(A, 'POST', `/api/boards/${boardId}/members`, { email: 'ben@example.org', role: 'viewer' });
  await V.goto(BASE + '/board/' + boardId, { waitUntil: 'load' });
  await wait(1200);
  const viewer = await ev(V, async () => {
    const p = await import('/js/shapes-panel.js');
    p.openShapesPanel();
    return { panel: !!document.querySelector('.shapes-panel'), tool: !!document.querySelector('#tools [data-tool="shape"]') };
  });
  ok(!viewer.panel && !viewer.tool, 'Nur-Lesen: kein Panel, kein Werkzeug', viewer);

  console.log('=== Handy');
  const c3 = await b.createBrowserContext();
  const M = await c3.newPage();
  M.on('pageerror', (e) => errs.push('M ' + e.message));
  await login(M, 'anna@example.org', 'Gewitter-Laterne-83');
  await api(A, 'POST', `/api/boards/${boardId}/members`, { email: 'anna@example.org', role: 'editor' });
  await M.setViewport({ width: 390, height: 780, isMobile: true, hasTouch: true });
  await M.goto(BASE + '/board/' + boardId, { waitUntil: 'load' });
  await wait(1400);
  await ev(M, async () => (await import('/js/shapes-panel.js')).openShapesPanel());
  await wait(250);
  const mob = await ev(M, () => {
    const s = document.querySelector('#sidepanel').getBoundingClientRect();
    const b = document.querySelector('.shape-group .shape-btn[data-shape="octagon"]').getBoundingClientRect();
    return { w: s.width, left: s.left, right: s.right, bx: b.left + b.width / 2, by: b.top + b.height / 2, sw: document.documentElement.scrollWidth, vw: innerWidth };
  });
  ok(mob.left >= 0 && mob.right <= mob.vw && mob.sw <= mob.vw, 'Handy: Panel passt ins Fenster', mob);
  await M.touchscreen.tap(mob.bx, mob.by);
  await wait(350);
  const armed = await ev(M, async () => {
    const c = await import('/js/core.js');
    return { tool: c.app.tool, sh: c.app.toolOpts.shape, open: !document.querySelector('#sidepanel').classList.contains('hidden') };
  });
  ok(armed.tool === 'shape' && armed.sh === 'octagon' && !armed.open, 'Handy: Antippen wählt die Form und macht das Board frei', armed);
  await M.touchscreen.tap(200, 420);
  await wait(450);
  ok(await ev(M, async () => [...(await import('/js/core.js')).app.els.values()].some((e) => e.shape === 'octagon')), 'Handy: Antippen des Boards legt die Form ab');

  await A.goto(BASE + '/', { waitUntil: 'load' });
  await api(A, 'DELETE', '/api/boards/' + boardId);
  console.log('Fehler:', errs.length ? errs.slice(0, 4) : 'keine');
  ok(!errs.length, 'Keine Fehler in der Seite', errs.slice(0, 3));
  await b.close();
  console.log(f ? 'FAIL ' + f : 'ALLES OK');
  process.exit(f ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
