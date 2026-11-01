// Gleichzeitige Änderungen am selben Element, auch mit verzögerten Antworten
const { launch, BASE } = require('./lib');
let f = 0;
const ok = (c, m, x) => {
  console.log((c ? 'ok  ' : 'FAIL') + ' ' + m + (c || x === undefined ? '' : ' → ' + JSON.stringify(x).slice(0, 300)));
  if (!c) f++;
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const ADMIN = ['admin@test.example', 'Rotkehlchen-Wolke-47'];
const PW = 'Gewitter-Laterne-83';
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
  if (r.status >= 300) throw new Error('login ' + r.status + JSON.stringify(r.body));
};
// fetch-Hülle: hält Anfragen und Antworten von /ops zurück, unabhängig vom Live-Stream
const hook = () => {
  const of = window.fetch;
  window.__req = 0;
  window.__res = 0;
  window.__ops = [];
  window.fetch = async (u, o) => {
    if (String(u).endsWith('/ops')) {
      if (window.__fail) throw new TypeError('offline');
      window.__ops.push(JSON.parse(o.body).ops);
      if (window.__req) await new Promise((r) => setTimeout(r, window.__req));
      const r = await of(u, o);
      if (window.__res) await new Promise((r) => setTimeout(r, window.__res));
      return r;
    }
    return of(u, o);
  };
};
const els = (p) =>
  p.evaluate(async () => {
    const { app } = await import('/js/core.js');
    const o = {};
    for (const [k, v] of app.els) if (!v.draft) o[k] = v;
    return JSON.parse(JSON.stringify(o));
  });
const call = (p, fn, ...a) =>
  p.evaluate(
    async (fn, a) => {
      const c = await import('/js/core.js');
      return JSON.parse(JSON.stringify(c[fn](...a) ?? null));
    },
    fn,
    a,
  );
const set = (p, id, patch) => call(p, 'updateEl', id, patch);
const sort = (x) =>
  Array.isArray(x)
    ? x.map(sort)
    : x && typeof x === 'object'
      ? Object.fromEntries(
          Object.keys(x)
            .sort()
            .map((k) => [k, sort(x[k])]),
        )
      : x;
const same = (a, b) => JSON.stringify(sort(a)) === JSON.stringify(sort(b));
const settle = async (...ps) => {
  for (let i = 0; i < 60; i++) {
    await wait(100);
    const busy = await Promise.all(
      ps.map((p) =>
        p.evaluate(async () => {
          const { app } = await import('/js/core.js');
          return app.sync.pending || app.sync.sending.length > 0;
        }),
      ),
    );
    if (!busy.some(Boolean)) return wait(150);
  }
};
(async () => {
  const b = await launch();
  const errs = [];
  const adm = await b.newPage();
  await login(adm, ...ADMIN);
  await api(adm, 'PUT', '/api/admin/settings', { security: { requireVirusScan: false }, collab: { guestLinks: true } });
  const email = 'p2' + Date.now() + '@example.org';
  ok((await api(adm, 'POST', '/api/admin/users', { name: 'Zweite', email, password: PW, role: 'user' })).status < 300, 'Zweite Person');
  const c2 = await b.createBrowserContext();
  for (const tr of ['', '?transport=poll']) {
    console.log('\n=== Transport: ' + (tr || 'SSE'));
    const id = (await api(adm, 'POST', '/api/boards', { name: 'Sync' + tr })).body.id;
    const sh = await api(adm, 'POST', `/api/boards/${id}/members`, { email, role: 'editor' });
    ok(sh.status < 300, 'geteilt', sh);
    const A = await b.newPage(),
      B = await c2.newPage();
    for (const [n, p] of [
      ['A', A],
      ['B', B],
    ]) {
      p.on('pageerror', (e) => errs.push(n + ' ' + e.message));
      p.on('console', (m) => {
        if (m.type() === 'error' && !/Failed to load resource|ERR_/.test(m.text())) errs.push(n + ' ' + m.text());
      });
      await p.evaluateOnNewDocument(hook);
    }
    if (tr === '') await login(B, email, PW);
    await A.goto(BASE + '/board/' + id + tr, { waitUntil: 'load' });
    await B.goto(BASE + '/board/' + id + tr, { waitUntil: 'load' });
    await wait(1500);
    // Elemente
    await A.evaluate(async () => {
      const c = await import('/js/core.js');
      for (const [i, t] of [
        ['s1', 'sticky'],
        ['s2', 'sticky'],
        ['s3', 'sticky'],
        ['s4', 'sticky'],
      ]) {
        const e = c.makeElement(t, 100 + 200 * Number(i[1]), 100);
        e.id = i;
        c.setEl(e);
      }
    });
    await settle(A, B);
    const ids = await els(B);
    ok(
      ['s1', 's2', 's3', 's4'].every((k) => ids[k]),
      'neue Elemente kommen als Ganzes an',
    );
    const lastOps = await A.evaluate(() => window.__ops.at(-1).map((o) => o.op));
    ok(lastOps.includes('upsert'), 'neu → upsert', lastOps);
    const fresh = async () => {
      const p = await b.newPage();
      await p.goto(BASE + '/board/' + id + tr, { waitUntil: 'load' });
      await wait(900);
      const e = await els(p);
      await p.close();
      return e;
    };
    const agree = async (name) => {
      await settle(A, B);
      const [a, bb, s] = [await els(A), await els(B), await fresh()];
      ok(
        same(a, bb) && same(a, s),
        name,
        same(a, bb)
          ? { a: Object.keys(a), s: Object.keys(s) }
          : Object.keys(a)
              .filter((k) => !same(a[k], bb[k]))
              .map((k) => ({ k, a: a[k]?.cells, ar: a[k]?.rows, b: bb[k]?.cells, br: bb[k]?.rows, sr: s[k]?.rows, s: s[k]?.cells })),
      );
      return s;
    };

    // Nur geänderte Felder gehen raus
    await set(A, 's1', { text: 'hallo' });
    await settle(A);
    const pk = await A.evaluate(() => window.__ops.at(-1));
    ok(pk.length === 1 && pk[0].op === 'patch' && Object.keys(pk[0].set).join() === 'text', 'Änderung geht als Patch', pk);

    // 1. Gleiches Feld gleichzeitig, Antwort an A kommt spät: B zuerst am Server, A danach? beide Reihenfolgen
    for (const [x, y, n] of [
      [A, B, 'A spät'],
      [B, A, 'B spät'],
    ]) {
      await x.evaluate(() => {
        window.__res = 400;
      });
      await Promise.all([set(x, 's1', { color: '#111111' }), set(y, 's1', { color: '#222222' })]);
      await wait(40);
      await agree('gleiches Feld, ' + n);
      await x.evaluate(() => {
        window.__res = 0;
      });
    }
    // Viele Runden Wettlauf am selben Feld
    for (let i = 0; i < 8; i++) {
      await A.evaluate(
        (d) => {
          window.__req = d;
          window.__res = d ? 0 : 120;
        },
        (i % 3) * 30,
      );
      await B.evaluate(
        (d) => {
          window.__req = d;
          window.__res = d ? 60 : 0;
        },
        (2 - (i % 3)) * 20,
      );
      await Promise.all([set(A, 's2', { text: 'A' + i }), set(B, 's2', { text: 'B' + i })]);
      await wait(i % 2 ? 5 : 60);
      await set(A, 's2', { text: 'A2' + i });
    }
    await A.evaluate(() => {
      window.__req = 0;
      window.__res = 0;
    });
    await B.evaluate(() => {
      window.__req = 0;
      window.__res = 0;
    });
    await agree('8 Runden Wettlauf am selben Feld');

    // 2. Verschiedene Felder
    await A.evaluate(() => {
      window.__res = 300;
    });
    await Promise.all([set(A, 's3', { x: 777 }), set(B, 's3', { text: 'von B' })]);
    const s = await agree('verschiedene Felder gleichzeitig');
    ok(s.s3.x === 777 && s.s3.text === 'von B', 'beide Änderungen erhalten', s.s3);
    await A.evaluate(() => {
      window.__res = 0;
    });

    // 3. Löschen gegen Bearbeiten
    await A.evaluate(() => {
      window.__req = 200;
    });
    await Promise.all([set(A, 's4', { text: 'noch' }), call(B, 'deleteEl', 's4')]);
    const s4 = await agree('Löschen gegen Bearbeiten');
    ok(!s4.s4, 'gelöscht bleibt gelöscht', s4.s4);
    await A.evaluate(() => {
      window.__req = 0;
    });

    // 4. Rückgängig nach fremder Änderung
    await A.evaluate(async () => {
      const c = await import('/js/core.js');
      c.begin?.();
      c.updateEl('s3', { y: 555 });
      c.commit?.();
    });
    await settle(A, B);
    await set(B, 's3', { text: 'B danach' });
    await settle(A, B);
    await A.evaluate(async () => {
      const c = await import('/js/core.js');
      c.undo();
    });
    await agree('Rückgängig nach fremder Änderung');

    // 5. Tabelle: Zelle, Zeile, verschieben gleichzeitig
    await A.evaluate(async () => {
      const c = await import('/js/core.js');
      const e = c.makeElement('table', 100, 400);
      e.id = 't1';
      c.setEl(e);
    });
    await settle(A, B);
    await A.evaluate(() => {
      window.__res = 250;
    });
    await Promise.all([
      A.evaluate(async () => {
        const c = await import('/js/core.js');
        c.tablePatch(c.getEl('t1'), { cells: [[0, 0, 'A-Zelle']] });
        c.tableStruct(c.getEl('t1'), { action: 'addRow', at: 1, count: 1 });
      }),
      B.evaluate(async () => {
        const c = await import('/js/core.js');
        c.updateEl('t1', { x: 333 });
        c.tablePatch(c.getEl('t1'), { cells: [[1, 1, 'B-Zelle']] });
      }),
    ]);
    const t = await agree('Tabelle: Zelle, Zeile und Verschieben gleichzeitig');
    const tb = t.t1;
    ok(
      tb.x === 333 && JSON.stringify(tb.cells).includes('A-Zelle') && JSON.stringify(tb.cells).includes('B-Zelle'),
      'Tabelle: nichts verloren',
      tb,
    );
    await A.evaluate(() => {
      window.__res = 0;
    });

    // 6. Offline
    if (tr === '') {
      await A.setOfflineMode(true);
      await wait(300);
      await set(A, 's1', { text: 'offline A' });
      await set(A, 's2', { color: '#333333' });
      await set(B, 's1', { x: 123 });
      await call(B, 'deleteEl', 's2');
      await settle(B);
      await wait(500);
      await A.setOfflineMode(false);
      await wait(6000);
      const o = await agree('nach Unterbrechung gleicher Stand');
      ok(o.s1?.text === 'offline A' && o.s1?.x === 123, 'offline: eigene und fremde Felder erhalten', o.s1);
      ok(!o.s2, 'Löschung live gesehen: gelöscht bleibt gelöscht', o.s2);
      // Echter Ausfall: beide Kanäle stehen, A bekommt die Löschung nicht mit
      await A.evaluate(async () => {
        const { app } = await import('/js/core.js');
        window.__fail = true;
        const d = app.sync.dispatch.bind(app.sync);
        window.__d = d;
        app.sync.dispatch = (m) => {
          if (m.type === 'ops') return;
          d(m);
        };
      });
      await set(A, 's3', { color: '#555555' });
      await wait(300);
      await call(B, 'deleteEl', 's3');
      await settle(B);
      await wait(300);
      ok((await els(A)).s3, 'A sieht das Element noch');
      await A.evaluate(async () => {
        const { app } = await import('/js/core.js');
        window.__fail = false;
        app.sync.dispatch = window.__d;
      });
      await wait(2500);
      const o2 = await agree('Ausfall: gleicher Stand');
      ok(o2.s3?.color === '#555555', 'Ausfall, fremd gelöscht: Arbeit bleibt erhalten', o2.s3);
    }

    // Felder leeren (Prüfbefund): erreicht Server und andere
    await set(A, 's1', { link: 'https://example.org', priority: 'high' });
    await settle(A, B);
    await A.evaluate(async () => {
      const c = await import('/js/core.js');
      c.updateEl('s1', { link: undefined, priority: undefined });
    });
    const cl = await agree('Feld leeren kommt überall an');
    ok(cl.s1 && !('link' in cl.s1) && !('priority' in cl.s1), 'geleerte Felder sind auf dem Server weg', cl.s1);
    // Verborgener Bereich aufdecken
    await A.evaluate(async () => {
      const c = await import('/js/core.js');
      const e = c.makeElement('frame', 1500, 0);
      e.id = 'f1';
      e.concealed = true;
      c.setEl(e);
    });
    await settle(A, B);
    await A.evaluate(async () => {
      const c = await import('/js/core.js');
      c.updateEl('f1', { concealed: undefined });
    });
    const fr = await agree('Bereich aufdecken');
    ok(fr.f1 && !fr.f1.concealed, 'aufgedeckt auf dem Server', fr.f1);
    // Abgelaufene Sitzung: Arbeit bleibt
    await A.evaluate(() => {
      const f = window.fetch;
      window.__of = f;
      window.fetch = async (u, o) => {
        if (String(u).endsWith('/ops') && window.__n401 > 0) {
          window.__n401--;
          return new Response('{"error":"x"}', { status: 401, headers: { 'Content-Type': 'application/json' } });
        }
        return f(u, o);
      };
      window.__n401 = 1;
    });
    await set(A, 's1', { fontSize: 22 });
    await wait(300);
    ok((await els(A)).s1.fontSize === 22, '401: Anzeige bleibt');
    await wait(17000);
    await A.evaluate(() => {
      window.fetch = window.__of;
    });
    const se = await agree('401: später erneut gesendet');
    ok(se.s1.fontSize === 22, '401: kommt auf dem Server an', se.s1);
    // Upload-Prüfung: Patch macht aus Notiz ein Bild, unzulässiger Inhalt
    const evil = 'data:image/png;base64,' + Buffer.from('<script>alert(1)</script>').toString('base64');
    const up = await A.evaluate(
      async (bid, evil) => {
        const { app } = await import('/js/core.js');
        const post = (ops) =>
          window
            .fetch(`/api/boards/${bid}/ops`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'X-Vibeboard': '1' },
              body: JSON.stringify({ clientId: app.sync.clientId, ops }),
            })
            .then((r) => r.json());
        const a = await post([{ op: 'patch', id: 's1', set: { src: evil }, unset: [] }]);
        const b = await post([{ op: 'patch', id: 's1', set: { type: 'image' }, unset: [] }]);
        return { a, b };
      },
      id,
      evil,
    );
    const su = await fresh();
    ok(!(su.s1?.type === 'image' && su.s1?.src === evil), 'Patch-Umweg über Typwechsel: unzulässiges Bild nicht übernommen', {
      u: up.b,
      s: su.s1,
    });
    await wait(300);
    // 7. Editor offen: fremde Änderung stört die Eingabe nicht
    await B.evaluate(async () => {
      const c = await import('/js/core.js');
      c.startEdit('s1');
    });
    await wait(150);
    await B.bringToFront();
    await B.keyboard.type('xyz');
    await set(A, 's1', { x: 50 });
    await settle(A, B);
    await wait(200);
    const typing = await B.evaluate(() => document.activeElement?.value);
    ok(/xyz/.test(typing || ''), 'Eingabe bleibt beim Verschieben durch andere', typing);
    await B.keyboard.press('Escape');
    await B.mouse.click(1000, 700);
    await agree('nach dem Bearbeiten');

    // 8. Moderation sperrt: Änderung wird zurückgenommen
    await A.evaluate(async () => {
      const { app } = await import('/js/core.js');
      app.sync.op({ op: 'moderation', active: true, editLock: true });
    });
    await settle(A);
    await wait(300);
    const before = (await els(A)).s1.text;
    await B.evaluate(async () => {
      const { app } = await import('/js/core.js');
      app.sync.upsert({ ...app.els.get('s1'), text: 'gesperrt' }, app.els.get('s1'));
    });
    await set(B, 's1', { color: '#444444' });
    await wait(600);
    await A.evaluate(async () => {
      const { app } = await import('/js/core.js');
      app.sync.op({ op: 'moderation', active: false });
    });
    const m = await agree('Bearbeitungssperre: abgelehnt und zurückgenommen');
    ok(m.s1.text === before && m.s1.color !== '#444444', 'Sperre: Server unverändert', m.s1);

    // 9. Privater Modus: Kennzeichen bleibt nach Bestätigung
    await A.evaluate(async () => {
      const { app } = await import('/js/core.js');
      app.sync.op({ op: 'privateMode', active: true });
    });
    await settle(A, B);
    await wait(300);
    await A.evaluate(async () => {
      const c = await import('/js/core.js');
      const e = c.makeElement('sticky', 900, 500);
      e.id = 'p1';
      e.text = 'GEHEIM-A';
      c.setEl(e);
    });
    await settle(A, B);
    await wait(300);
    const pa = (await els(A)).p1;
    ok(pa?.priv, 'privat: Kennzeichen beim Absender', pa);
    await set(A, 'p1', { x: 901 });
    await settle(A, B);
    await wait(200);
    const pa2 = (await els(A)).p1,
      pb = (await els(B)).p1;
    ok(pa2?.priv && pa2.text === 'GEHEIM-A', 'privat bleibt nach Patch', pa2);
    ok(!pb || pb.text !== 'GEHEIM-A', 'B sieht den privaten Text nicht', pb);
    // Fremder Patch auf privates Element: abgelehnt, kein Leck in Antwort, kein Überschreiben
    const raw = await B.evaluate(async (bid) => {
      const { app } = await import('/js/core.js');
      const r = await window.fetch(`/api/boards/${bid}/ops`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Vibeboard': '1' },
        body: JSON.stringify({
          clientId: app.sync.clientId,
          ops: [{ op: 'patch', id: 'p1', set: { x: 1, __proto__x: 1 }, unset: ['text'] }],
        }),
      });
      return await r.text();
    }, id);
    ok(!raw.includes('GEHEIM-A'), 'fremder Patch: kein Leck', raw);
    await set(A, 'p1', { y: 600 });
    await settle(A, B);
    ok((await els(A)).p1.text === 'GEHEIM-A', 'fremder Patch: Text unverändert');
    await A.evaluate(async () => {
      const { app } = await import('/js/core.js');
      app.sync.op({ op: 'privateMode', active: false });
    });
    await settle(A, B);
    // Handgebautes Paket: Zelle, Zeile und Löschen derselben Tabelle; Patch-Flut auf ein Element
    const hand = await B.evaluate(async (bid) => {
      const c = await import('/js/core.js');
      const { app } = c;
      const e = c.makeElement('table', 100, 900);
      e.id = 't9';
      c.setEl(e);
      await app.sync.flush();
      const post = (ops) =>
        window
          .fetch(`/api/boards/${bid}/ops`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Vibeboard': '1' },
            body: JSON.stringify({ clientId: app.sync.clientId, ops }),
          })
          .then((r) => r.status);
      const a = await post([
        { op: 'tpatch', id: 't9', cells: [[0, 0, 'x']] },
        { op: 'tstruct', id: 't9', action: 'addRow', at: 1, count: 1 },
        { op: 'delete', id: 't9' },
      ]);
      app.sync.merge.forget('t9');
      app.els.delete('t9');
      const t = performance.now();
      const x = app.els.get('s1').x;
      const b = await post(Array.from({ length: 50000 }, () => ({ op: 'patch', id: 's1', set: { x }, unset: [] })));
      return { a, b, ms: performance.now() - t };
    }, id);
    ok(hand.a === 200, 'Paket mit Zelle, Zeile und Löschen: kein Serverfehler', hand);
    ok(hand.b === 200 && hand.ms < 4000, 'Patch-Flut bleibt harmlos', hand);
    // kaputte Patches
    const bad = await B.evaluate(async (bid) => {
      const { app } = await import('/js/core.js');
      const out = [];
      for (const o of [
        { op: 'patch', id: 's1', set: null },
        { op: 'patch', id: 's1', set: [1] },
        { op: 'patch', id: 'nix', set: { x: 1 } },
        { op: 'patch', id: 's1', set: { id: 'neu' } },
        { op: 'patch', id: 's1', set: JSON.parse('{"__proto__":{"x":1}}') },
        { op: 'patch', id: 's1', set: {}, unset: [1, null, {}] },
      ]) {
        const r = await window.fetch(`/api/boards/${bid}/ops`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Vibeboard': '1' },
          body: JSON.stringify({ clientId: app.sync.clientId, ops: [o] }),
        });
        out.push(r.status);
      }
      return out;
    }, id);
    ok(
      bad.every((s) => s === 200),
      'kaputte Patches werden ohne Fehler verworfen',
      bad,
    );
    await agree('Ende');
    await A.close();
    await B.close();
  }
  ok(errs.length === 0, 'keine Browserfehler', errs.slice(0, 6));
  await b.close();
  console.log('\nFehlschläge:', f);
  process.exit(f ? 1 : 0);
})().catch((e) => {
  console.error('ABBRUCH', e);
  process.exit(2);
});
