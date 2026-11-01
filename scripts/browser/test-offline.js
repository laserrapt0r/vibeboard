// Offline-Zustand und Wiederverbinden
// Bleibt ein Tab nach einer Störung offline? Fälle: echter Neustart; Proxy antwortet kurz mit 502; Abmeldung
const { launch, BASE, server } = require('./lib');
let f = 0;
const ok = (c, m, x) => {
  console.log((c ? 'ok  ' : 'FAIL') + ' ' + m + (c || x === undefined ? '' : ' → ' + JSON.stringify(x).slice(0, 240)));
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
const st = (p) =>
  p.evaluate(async () => {
    const { app } = await import('/js/core.js');
    return { ...app.sync.saveState(), conn: app.sync.connected, es: app.sync.es && app.sync.es.readyState, tr: app.sync.transport };
  });
const RESCUE = process.argv[2] === 'rescue';
(async () => {
  const b = await launch();
  const p = await b.newPage();
  await p.goto(BASE + '/login', { waitUntil: 'networkidle0' });
  await api(p, 'POST', '/api/auth/login', { login: 'admin@test.example', password: 'Rotkehlchen-Wolke-47' });
  for (const tr of process.env.ONLY_LOGOUT ? [] : ['', '?transport=poll']) {
    console.log('=== ' + (tr || 'SSE'));
    const id = (await api(p, 'POST', '/api/boards', { name: 'O' })).body.id;
    await p.setRequestInterception(true);
    let bad = 0;
    const h = (r) => {
      const u = r.url();
      if (bad && (u.includes('/events') || u.includes('/poll') || u.endsWith('/ops'))) {
        r.respond({ status: bad, contentType: 'text/html', body: '<h1>Bad Gateway</h1>' });
        return;
      }
      r.continue();
    };
    p.on('request', h);
    await p.goto(BASE + '/board/' + id + tr, { waitUntil: 'load' });
    await wait(1500);
    console.log('    Start', JSON.stringify(await st(p)));
    await p.evaluate(async () => {
      const c = await import('/js/core.js');
      const s = c.makeElement('sticky', 0, 0);
      s.id = 'a';
      c.setEl(s);
    });
    await wait(500);
    // Störung: Server neu, in der Zeit antwortet der „Proxy“ mit 502
    bad = 502;
    server('restart');
    await wait(1500);
    await p.evaluate(async () => {
      const c = await import('/js/core.js');
      for (const k of ['b', 'd', 'e']) {
        const s = c.makeElement('sticky', 300, 0);
        s.id = k;
        c.setEl(s);
      }
    });
    await wait(4000);
    console.log('    während Störung', JSON.stringify(await st(p)));
    await wait(3000);
    bad = 0;
    console.log('    Proxy wieder ok');
    await wait(tr ? 14000 : 20000);
    let s = await st(p);
    console.log('    danach', JSON.stringify(s));
    if (RESCUE && (s.state === 'offline' || s.state === 'error')) {
      await p.evaluate(async () => {
        const { app } = await import('/js/core.js');
        app.sync.connect();
      });
      await wait(6000);
      s = await st(p);
      console.log('    nach Rettungsbefehl', JSON.stringify(s));
    }
    ok(s.state === 'saved' || s.state === 'saving', 'Tab verbindet sich selbst wieder', s);
    if (!tr) {
      ok(s.tr === 'sse', 'bleibt beim Live-Stream', s.tr);
      ok(
        await p.evaluate(() => !/poll/.test(localStorage.getItem('vibeboard.transport') || '')),
        'Störung wird nicht für Tage gemerkt',
        await p.evaluate(() => localStorage.getItem('vibeboard.transport')),
      );
    }
    const q = await b.newPage();
    await q.goto(BASE + '/board/' + id, { waitUntil: 'load' });
    await wait(1500);
    const n = await q.evaluate(async () => {
      const { app } = await import('/js/core.js');
      return [...app.els.keys()].sort().join();
    });
    await q.close();
    ok(n === 'a,b,d,e', 'Änderungen aus der Störung sind auf dem Server', n);
    p.off('request', h);
    await p.setRequestInterception(false);
  }
  // Abgemeldet: Der Tab bleibt offline, ohne Verlust, und findet nach neuer Anmeldung zurück
  let dialogs = 0;
  p.on('dialog', (d) => {
    dialogs++;
    d.dismiss().catch(() => {});
  });
  console.log('=== Abmeldung');
  const c2 = await b.createBrowserContext();
  const id2 = (await api(p, 'POST', '/api/boards', { name: 'L' })).body.id;
  await p.goto(BASE + '/board/' + id2 + '?transport=sse', { waitUntil: 'load' });
  await wait(1500);
  const cookies = await p.cookies();
  await p.deleteCookie(...cookies);
  await p.evaluate(async () => {
    const c = await import('/js/core.js');
    c.app.sync.es.close();
    c.app.sync.connected = false;
    c.app.sync.reconnectLater();
    const s = c.makeElement('sticky', 0, 0);
    s.id = 'z';
    c.setEl(s);
  });
  await wait(5000);
  console.log('    abgemeldet', JSON.stringify(await st(p)));
  console.log('    Dialoge', dialogs, await p.url());
  ok((await st(p)).pending >= 1, 'Änderung wartet im Browser');
  await p.setCookie(...cookies);
  await p.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await wait(21000);
  const s3 = await st(p);
  console.log('    angemeldet', JSON.stringify(s3));
  ok(s3.state === 'saved' || s3.state === 'saving', 'nach erneuter Anmeldung geht es weiter', s3);
  await b.close();
  console.log('Fehlschläge:', f);
  process.exit(f ? 1 : 0);
})().catch((e) => {
  console.error('ABBRUCH', e.message);
  process.exit(2);
});
