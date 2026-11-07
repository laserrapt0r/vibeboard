// Vorlagen und Automatismen
const { launch, BASE, TMP } = require('./lib');
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
const S = TMP + '/';
const els = (p) =>
  p.evaluate(async () => {
    const { app } = await import('/js/core.js');
    return JSON.parse(JSON.stringify([...app.els.values()]));
  });
const insert = (p, id) =>
  p.evaluate(async (id) => {
    const c = await import('/js/core.js');
    const { templateById } = await import('/js/templates.js');
    const u = await import('/js/ui.js');
    const t = templateById(id);
    const made = u.placeElements(t.build());
    c.app.emit('templateOffer', t.offer);
    return !!made;
  }, id);
const screenOf = (p, kind, txt) =>
  p.evaluate(
    async (kind, txt) => {
      const c = await import('/js/core.js');
      const e = [...c.app.els.values()].find((x) =>
        kind === 'head' ? x.locked === 'text' && (x.text || '').includes(txt) : x.type === 'card' && (x.title || '').includes(txt),
      );
      const s = c.toScreen(e.x + e.w / 2, e.y + e.h / 2);
      return { x: s.x, y: s.y, id: e.id };
    },
    kind,
    txt,
  );
const toastText = (p) =>
  p.evaluate(() => {
    const t = document.getElementById('toast');
    return t && t.classList.contains('show') ? t.textContent : '';
  });
(async () => {
  const b = await launch();
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('dialog', (d) => d.accept());
  await p.goto(BASE + '/login', { waitUntil: 'networkidle0' });
  await api(p, 'POST', '/api/auth/login', { login: 'admin@test.example', password: 'Rotkehlchen-Wolke-47' });
  const nb = async (n) => {
    const id = (await api(p, 'POST', '/api/boards', { name: n })).body.id;
    await p.goto(BASE + '/board/' + id, { waitUntil: 'load' });
    await wait(1100);
    return id;
  };
  const fit = () =>
    p.evaluate(async () => {
      const c = await import('/js/core.js');
      c.fitAll(false);
    });
  // Vorlagen-Sperren
  const counts = await p.evaluate(async () => {
    const { TEMPLATES } = await import('/js/templates.js');
    let lockedText = 0,
      text = 0,
      bg = 0;
    for (const t of TEMPLATES)
      for (const e of t.build()) {
        if (e.locked === true && String(e.text || '').trim()) lockedText++;
        if (e.locked === 'text') text++;
        if (e.locked === true) bg++;
      }
    return { lockedText, text, bg, n: TEMPLATES.length };
  });
  ok(counts.lockedText === 0 && counts.text > 200 && counts.bg > 100, 'Vorlagen: Beschriftungen fixiert, Hintergründe gesperrt', counts);
  await nb('K');
  await insert(p, 'kanban');
  await wait(500);
  await fit();
  await wait(500);
  // Spalte umbenennen per Doppelklick
  let h = await screenOf(p, 'head', 'In Arbeit');
  await p.mouse.click(h.x, h.y, { count: 2 });
  await wait(250);
  ok(
    await p.evaluate(async () => {
      const c = await import('/js/core.js');
      return !!c.app.editing;
    }),
    'Doppelklick bearbeitet fixierte Überschrift',
  );
  await p.keyboard.down('Control');
  await p.keyboard.press('KeyA');
  await p.keyboard.up('Control');
  await p.keyboard.type('In Umsetzung');
  await p.keyboard.press('Escape');
  await wait(250);
  ok(
    (await els(p)).some((e) => e.text === 'In Umsetzung' && e.locked === 'text'),
    'Überschrift umbenannt, bleibt fixiert',
  );
  // Fixiert nicht ziehbar, nicht per Entf löschbar
  const before = (await els(p)).find((e) => e.text === 'In Umsetzung');
  await p.mouse.move(h.x, h.y);
  await p.mouse.down();
  await p.mouse.move(h.x + 90, h.y + 60, { steps: 5 });
  await p.mouse.up();
  await wait(200);
  const after = (await els(p)).find((e) => e.text === 'In Umsetzung');
  ok(after.x === before.x && after.y === before.y, 'fixiert: Ziehen bewegt nicht');
  await p.evaluate(async (id) => {
    const c = await import('/js/core.js');
    c.setSelection([id]);
  }, after.id);
  await p.keyboard.press('Delete');
  await wait(200);
  ok(
    (await els(p)).some((e) => e.id === after.id),
    'fixiert: Entf löscht nicht',
  );
  // Hintergrund bleibt voll gesperrt
  const zone = (await els(p)).find((e) => e.statusCol);
  ok(zone.locked === true, 'Spalte hat Status-Kennzeichen und ist gesperrt');
  // Karte in Spalte ziehen
  const card = await screenOf(p, 'card', 'Ideen');
  const cols = (await els(p)).filter((e) => e.statusCol).sort((a, b) => a.x - b.x);
  const target = await p.evaluate(async (z) => {
    const c = await import('/js/core.js');
    return c.toScreen(z.x + z.w / 2, z.y + z.h - 150);
  }, cols[2]);
  await p.mouse.move(card.x, card.y);
  await p.mouse.down();
  await p.mouse.move(target.x, target.y, { steps: 10 });
  await p.mouse.up();
  await wait(350);
  let cd = (await els(p)).find((e) => e.id === card.id);
  ok(cd.status === 'In Umsetzung', 'Karte in Spalte: Status folgt der umbenannten Überschrift', cd.status);
  ok(/Status: In Umsetzung/.test(await toastText(p)), 'Hinweis zum Status', await toastText(p));
  await p.keyboard.down('Control');
  await p.keyboard.press('KeyZ');
  await p.keyboard.up('Control');
  await wait(250);
  cd = (await els(p)).find((e) => e.id === card.id);
  ok(cd.status === 'Backlog', 'Rückgängig nimmt Lage und Status zusammen zurück', { s: cd.status, x: cd.x });
  // Kein Wechsel: Status bleibt; Tracker-Karte bleibt unberührt
  const cc = await screenOf(p, 'card', 'Ideen');
  await p.evaluate(async (id) => {
    const c = await import('/js/core.js');
    c.updateEl(id, { status: 'Sonderstatus' });
  }, cc.id);
  await wait(150);
  await p.mouse.move(cc.x, cc.y);
  await p.mouse.down();
  await p.mouse.move(cc.x + 12, cc.y + 22, { steps: 4 });
  await p.mouse.up();
  await wait(250);
  ok((await els(p)).find((e) => e.id === cc.id).status === 'Sonderstatus', 'Zug innerhalb der Spalte lässt den Status');
  const cc2 = await screenOf(p, 'card', 'Ideen');
  await p.evaluate(async (id) => {
    const c = await import('/js/core.js');
    c.updateEl(id, { ext: { kind: 'jira', key: 'X-1' } });
  }, cc.id);
  await wait(150);
  await p.mouse.move(cc2.x, cc2.y);
  await p.mouse.down();
  await p.mouse.move(target.x, target.y, { steps: 8 });
  await p.mouse.up();
  await wait(250);
  ok((await els(p)).find((e) => e.id === cc.id).status === 'Sonderstatus', 'Tracker-Karte: Spaltenwechsel ändert den Status nicht');
  await p.evaluate(async (id) => {
    const c = await import('/js/core.js');
    c.updateEl(id, { ext: undefined, status: 'Backlog' });
  }, cc.id);
  // Frame verschieben nimmt Gesperrtes mit
  const f0 = (await els(p)).find((e) => e.type === 'frame');
  const zb = (await els(p)).filter((e) => e.locked).map((e) => [e.id, e.x]);
  await p.evaluate(async (id) => {
    const c = await import('/js/core.js');
    c.setSelection([id]);
  }, f0.id);
  await wait(200);
  await p.keyboard.press('ArrowRight');
  await wait(300);
  const moved = await els(p);
  ok(
    zb.every(([i, x]) => moved.find((e) => e.id === i).x === x + 1),
    'Frame bewegt: gesperrte und fixierte Teile kommen mit',
  );
  await p.keyboard.press('ArrowLeft');
  await wait(250);
  // Frame samt Inhalt
  const fr = (await els(p)).find((e) => e.type === 'frame');
  const n0 = (await els(p)).length;
  await p.evaluate(async (id) => {
    const c = await import('/js/core.js');
    c.setSelection([id]);
    c.deleteFramesWithContent();
  }, fr.id);
  await wait(300);
  ok((await els(p)).length === 0, 'Frame samt Inhalt: nichts bleibt liegen', (await els(p)).length);
  await p.evaluate(async () => {
    const c = await import('/js/core.js');
    c.undo();
  });
  await wait(300);
  ok((await els(p)).length === n0, 'rückgängig stellt alles her', (await els(p)).length);
  // Moderationssperre geht vor
  const r = await p.evaluate(async (id) => {
    const c = await import('/js/core.js');
    const e = c.getEl(id);
    const was = c.app.isFacilitator;
    c.app.isFacilitator = false;
    const a = c.canEdit({ ...e, modLock: true });
    c.app.isFacilitator = was;
    return { a, b: c.canEdit(e) };
  }, after.id);
  ok(!r.a && r.b, 'Moderationssperre geht vor Fixierung', r);
  // Tab
  await nb('T');
  await p.evaluate(async () => {
    const c = await import('/js/core.js');
    const s = c.makeElement('sticky', 0, 0, { fill: '#ffcce5' });
    s.id = 'a1';
    s.fill = '#ffcce5';
    c.setEl(s);
    c.fitAll(false);
    c.startEdit('a1');
  });
  await wait(250);
  await p.keyboard.type('eins');
  await p.keyboard.press('Tab');
  await wait(300);
  await p.keyboard.type('zwei');
  await p.keyboard.press('Tab');
  await wait(300);
  await p.keyboard.press('Tab');
  await wait(250);
  let st = (await els(p)).filter((e) => e.type === 'sticky');
  ok(
    st.length === 3 && st[1].text === 'zwei' && st[1].fill === '#ffcce5',
    'Tab: nächste Notiz gleicher Farbe; leer entsteht keine weitere',
    st.map((e) => [e.text, e.fill]),
  );
  ok(
    st[1].x > st[0].x + st[0].w - 1,
    'Tab: liegt daneben',
    st.map((e) => e.x),
  );
  await p.keyboard.type('a');
  await p.keyboard.press('Enter');
  await p.keyboard.type('b');
  await wait(100);
  ok(
    (await p.evaluate(async () => {
      const c = await import('/js/core.js');
      return c.getEl(c.app.editing.id).text;
    })) === 'a\nb',
    'Enter bleibt Zeilenumbruch in Notizen',
  );
  await p.keyboard.press('Tab');
  await wait(300);
  await p.keyboard.press('Escape');
  await wait(300);
  st = (await els(p)).filter((e) => e.type === 'sticky');
  ok(
    st.length === 3,
    'leer gebliebene Tab-Notiz verschwindet',
    st.map((e) => e.text),
  );
  // Undo nach Tab: ein Schritt
  const c0 = (await els(p)).filter((e) => e.type === 'sticky').length;
  await p.evaluate(async () => {
    const c = await import('/js/core.js');
    const e = [...c.app.els.values()].find((x) => x.type === 'sticky' && x.text);
    c.startEdit(e.id);
  });
  await wait(150);
  await p.keyboard.press('Tab');
  await wait(200);
  await p.keyboard.type('neu');
  await p.keyboard.press('Escape');
  await wait(200);
  await p.keyboard.down('Control');
  await p.keyboard.press('KeyZ');
  await p.keyboard.up('Control');
  await wait(250);
  ok((await els(p)).filter((e) => e.type === 'sticky').length === c0, 'Tab: Rückgängig nimmt Notiz samt Text in einem Schritt');
  await p.evaluate(async () => {
    const c = await import('/js/core.js');
    const e = [...c.app.els.values()].find((x) => x.type === 'sticky' && x.text);
    c.startEdit(e.id);
  });
  await wait(150);
  await p.keyboard.press('Tab');
  await wait(200);
  await p.keyboard.press('Escape');
  await wait(200);
  ok(
    await p.evaluate(async () => {
      const c = await import('/js/core.js');
      const before = c.app.els.size;
      c.undo();
      await new Promise((r) => setTimeout(r, 80));
      const same = c.app.els.size === before;
      return same || c.app.els.size < before;
    }),
    'verworfene Notiz hinterlässt kein leeres Objekt im Verlauf',
  );
  // Fixierter Text: Tab, Leeren
  await p.evaluate(async () => {
    const c = await import('/js/core.js');
    c.app.sync && 0;
    const l = c.makeElement('text', 900, 900);
    l.id = 'fx1';
    l.text = 'Fest';
    l.locked = 'text';
    c.setEl(l);
    c.startEdit('fx1');
  });
  await wait(200);
  await p.keyboard.press('Tab');
  await wait(200);
  ok((await els(p)).filter((e) => e.text === '').length === 0, 'fixierter Text: Tab legt nichts an');
  await p.keyboard.down('Control');
  await p.keyboard.press('KeyA');
  await p.keyboard.up('Control');
  await p.keyboard.press('Delete');
  await p.keyboard.press('Escape');
  await wait(200);
  ok(
    (await els(p)).some((e) => e.id === 'fx1'),
    'fixierter Text: Leeren löscht nicht',
  );
  // Tab in Spalte bleibt in Spalte
  await nb('T2');
  await insert(p, 'retro-ssc');
  await wait(500);
  await fit();
  await wait(400);
  const res = await p.evaluate(async () => {
    const c = await import('/js/core.js');
    const z = [...c.app.els.values()].filter((e) => e.locked === true && e.type === 'shape' && e.w > 200).sort((a, b) => a.x - b.x)[0];
    const s = [...c.app.els.values()].find((e) => e.type === 'sticky' && e.x >= z.x && e.x + e.w <= z.x + z.w);
    c.startEdit(s.id);
    return { z, id: s.id };
  });
  await wait(200);
  for (let i = 0; i < 7; i++) {
    await p.keyboard.type('x' + i);
    await p.keyboard.press('Tab');
    await wait(120);
  }
  await p.keyboard.press('Escape');
  await wait(250);
  const inz = (await els(p)).filter((e) => e.type === 'sticky' && /^x\d/.test(e.text || ''));
  const z = res.z;
  console.log(
    '    Zone',
    JSON.stringify({ x: z.x, y: z.y, w: z.w, h: z.h, text: z.text, sc: z.statusCol }),
    'Bereiche',
    JSON.stringify((await els(p)).filter((e) => e.locked === true && e.type === 'shape').map((e) => [e.x, e.y, e.w, e.h])),
    'Frame',
    JSON.stringify((await els(p)).filter((e) => e.type === 'frame').map((e) => [e.x, e.y, e.w, e.h])),
  );
  ok(
    inz.length === 7 && inz.every((e) => e.x >= z.x && e.x + e.w <= z.x + z.w),
    'Tab bleibt in der Spalte, auch wenn sie voll ist',
    inz.map((e) => [e.x, e.y]),
  );
  const ov = inz.some((a, i) => inz.some((b, j) => i < j && a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h));
  ok(!ov, 'neue Notizen überlappen sich nicht');
  // Mindmap
  await nb('M');
  await p.evaluate(async () => {
    const c = await import('/js/core.js');
    const s = c.makeElement('shape', 0, 0, { mind: true, shape: 'pill', text: 'Wurzel', w: 260, h: 90 });
    s.id = 'm1';
    c.setEl(s);
    c.fitAll(false);
    c.startEdit('m1');
  });
  await wait(250);
  ok(/Mindmap:/.test(await toastText(p)), 'Hinweis beim ersten Mindmap-Knoten', await toastText(p));
  await p.keyboard.press('Tab');
  await wait(300);
  await p.keyboard.press('Enter');
  await wait(200);
  await p.keyboard.press('Tab');
  await wait(200);
  let mm = (await els(p)).filter((e) => e.mind && e.type === 'shape');
  ok(mm.length === 2, 'leerer neuer Knoten erzeugt keinen weiteren', mm.length);
  await p.keyboard.type('Ast');
  await p.keyboard.press('Enter');
  await wait(300);
  await p.keyboard.press('Escape');
  await wait(300);
  mm = (await els(p)).filter((e) => e.mind && e.type === 'shape');
  const co = (await els(p)).filter((e) => e.type === 'connector');
  ok(mm.length === 2 && co.length === 1, 'leerer Knoten verschwindet samt Verbindung', { m: mm.map((e) => e.text), c: co.length });
  // Werkzeug halten
  await nb('W');
  const btn = await p.$('#tools [data-tool="sticky"]');
  const bb = await btn.boundingBox();
  await p.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2, { count: 2 });
  await wait(250);
  await p.keyboard.press('Escape');
  await wait(150);
  let held = await p.evaluate(async () => {
    const { app } = await import('/js/core.js');
    return { t: app.tool, h: app.toolHeld, cl: document.querySelector('#tools [data-tool="sticky"]').classList.contains('held') };
  });
  console.log('    nach Doppelklick+Esc', JSON.stringify(held));
  await p.evaluate(async () => {
    const c = await import('/js/core.js');
    c.closePop?.();
  });
  await p.mouse.click(1000, 700);
  await wait(100);
  await p.keyboard.press('Shift+KeyN').catch(() => {});
  await p.keyboard.down('Shift');
  await p.keyboard.press('n');
  await p.keyboard.up('Shift');
  await wait(200);
  held = await p.evaluate(async () => {
    const { app } = await import('/js/core.js');
    return { t: app.tool, h: app.toolHeld, cl: document.querySelector('#tools [data-tool="sticky"]').classList.contains('held') };
  });
  ok(held.t === 'sticky' && held.h && held.cl, 'Umschalt+Taste hält das Werkzeug, sichtbar an der Schaltfläche', held);
  await p.keyboard.press('Escape');
  await p.mouse.click(600, 300);
  await wait(250);
  await p.keyboard.type('n1');
  await p.keyboard.press('Escape');
  await wait(150);
  await p.mouse.click(1000, 300);
  await wait(250);
  await p.keyboard.type('n2');
  await p.keyboard.press('Escape');
  await wait(150);
  console.log(
    '    nach zwei Klicks',
    JSON.stringify(
      await p.evaluate(async () => {
        const { app } = await import('/js/core.js');
        return { t: app.tool, h: app.toolHeld, n: app.els.size };
      }),
    ),
  );
  await p.keyboard.press('Escape');
  await wait(100);
  const end = await p.evaluate(async () => {
    const { app } = await import('/js/core.js');
    return { t: app.tool, h: app.toolHeld };
  });
  ok(end.t === 'select' && !end.h, 'Esc beendet', end);
  // Ohne Halten kehrt es zurück
  await p.keyboard.press('n');
  await wait(100);
  await p.keyboard.press('Escape');
  await p.keyboard.press('n');
  await p.mouse.click(600, 600);
  await wait(250);
  await p.keyboard.press('Escape');
  await wait(100);
  ok(
    (await p.evaluate(async () => {
      const { app } = await import('/js/core.js');
      return app.tool;
    })) === 'select',
    'ohne Halten zurück zur Auswahl',
  );
  // Zuletzt verwendet
  await p.evaluate(async () => {
    const { app } = await import('/js/core.js');
    app.toolOpts.recentShapes = [];
    app.toolOpts.shape = 'hexagon';
  });
  await p.keyboard.press('s');
  await wait(250);
  await p.keyboard.press('Escape');
  await p.keyboard.press('s');
  await wait(250);
  await p.mouse.click(850, 500);
  await wait(250);
  await p.keyboard.press('Escape');
  await wait(100);
  const rec = await p.evaluate(async () => {
    const { app } = await import('/js/core.js');
    return app.toolOpts.recentShapes;
  });
  ok(rec && rec[0] === 'hexagon', 'Form wird gemerkt', rec);
  await p.keyboard.press('s');
  await wait(350);
  ok(
    await p.evaluate(() => [...document.querySelectorAll('.pop-title')].some((e) => /Zuletzt verwendet/.test(e.textContent))),
    'Formen-Menü zeigt „Zuletzt verwendet“',
  );
  await p.screenshot({ path: S + 'shapes.png' });
  await p.keyboard.press('Escape');
  await p.keyboard.press('Escape');
  // Angebote
  await nb('O');
  await insert(p, 'retro-ssc');
  await wait(300);
  ok(/Retro-Ablauf starten/.test(await toastText(p)), 'Retro-Vorlage bietet Ablauf an', await toastText(p));
  let s0 = await p.evaluate(async () => {
    const { app } = await import('/js/core.js');
    return { r: app.session.retro && app.session.retro.active, t: app.session.timer, pm: app.session.privateMode };
  });
  ok(!s0.r && !s0.t && !(s0.pm && s0.pm.active), 'nichts startet von selbst', s0);
  await p.evaluate(() => document.querySelector('#toast button').click());
  await wait(350);
  ok(
    await p.evaluate(() => /Retro-Ablauf starten/.test(document.querySelector('.modal')?.textContent || '')),
    'Klick öffnet den Retro-Dialog',
  );
  await p.keyboard.press('Escape');
  await wait(200);
  await nb('O2');
  await insert(p, 'brainstorm');
  await wait(300);
  ok(/Timer \(10 Min\.\) und Privatmodus/.test(await toastText(p)), 'Brainstorming bietet Timer an', await toastText(p));
  await p.evaluate(() => document.querySelector('#toast button').click());
  await wait(600);
  s0 = await p.evaluate(async () => {
    const { app } = await import('/js/core.js');
    return { t: app.session.timer, pm: app.session.privateMode };
  });
  ok(s0.t && s0.pm && s0.pm.active, 'Klick startet Timer und Privatmodus', s0);
  await p.evaluate(async () => {
    const { app } = await import('/js/core.js');
    app.sync.op({ op: 'privateMode', active: false });
  });
  await wait(300);
  await insert(p, 'crazy8');
  await wait(300);
  ok(!/Timer/.test(await toastText(p)), 'läuft schon ein Timer: kein weiteres Angebot', await toastText(p));
  // Angebot beim neuen Board
  await p.evaluate(async () => {
    const r = await fetch('/api/boards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Vibeboard': '1' },
      body: JSON.stringify({ name: 'N' }),
    });
    const j = await r.json();
    sessionStorage.setItem('vibeboard.offer.' + j.id, '{"retro":true}');
    location.href = '/board/' + j.id;
  });
  await wait(2200);
  ok(/Retro-Ablauf starten/.test(await toastText(p)), 'neues Board aus Vorlage: Angebot beim Öffnen', await toastText(p));
  await p.reload({ waitUntil: 'load' });
  await wait(1500);
  ok(!/Retro-Ablauf/.test(await toastText(p)), 'Angebot kommt nur einmal');
  // WIP und nicht-Kanban
  const st2 = await p.evaluate(async () => {
    const { templateById } = await import('/js/templates.js');
    const d = templateById('dev-kanban').build();
    const sp = templateById('sprint-planning').build();
    return {
      st: d.filter((e) => e.type === 'card').map((e) => e.status),
      zones: d.filter((e) => e.statusCol).length,
      spz: sp.filter((e) => e.statusCol).length,
      sps: sp.filter((e) => e.type === 'card').map((e) => e.status),
    };
  });
  ok(
    !st2.st.some((x) => /WIP/.test(x || '')) && st2.zones > 0 && st2.spz === 0,
    'WIP-Zusatz nicht im Status, nur Kanban hat Status-Spalten',
    st2,
  );
  // Gantt/Zeitleiste
  await nb('G');
  await insert(p, 'gantt');
  await wait(500);
  await fit();
  await wait(500);
  await p.screenshot({ path: S + 'gantt.png' });
  const g = (await els(p)).filter((e) => e.type === 'card');
  ok(
    g.length === 6 && g.every((c) => c.start && c.due && c.start <= c.due),
    'Gantt: Karten mit Terminen',
    g.map((c) => [c.start, c.due]),
  );
  await nb('Z');
  await insert(p, 'timeline');
  await wait(500);
  await fit();
  await wait(500);
  await p.screenshot({ path: S + 'timeline.png' });
  const zc = (await els(p)).filter((e) => e.type === 'card');
  ok(zc.length === 6 && zc.every((c) => c.due), 'Zeitleiste: Karten mit Termin', zc.length);
  ok(errs.length === 0, 'keine Browserfehler', errs.slice(0, 5));
  await b.close();
  console.log('Fehlschläge:', f);
  process.exit(f ? 1 : 0);
})().catch((e) => {
  console.error('ABBRUCH', e);
  process.exit(2);
});
