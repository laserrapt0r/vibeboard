'use strict';
// Prüft, dass Fehler auf einer Verbindung den Prozess nicht beenden: echte HTTP-Antworten, die schon beendet oder abgerissen sind.
const assert = require('assert');
const http = require('http');
const { safeWrite, isConnectionError } = require('../lib/http');

let uncaught = null;
process.on('uncaughtException', (e) => (uncaught = e));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const seen = [];
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/event-stream' });
    res.write(': hallo\n\n');
    seen.push(res);
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address();
  const open = () => new Promise((resolve) => {
    const req = http.get({ port, path: '/' }, (res) => resolve({ req, res }));
  });

  // Beendete Antwort: Das ungeschützte write löst hier genau die Ausnahme aus
  const a = await open();
  const ended = seen.at(-1);
  ended.end();
  assert.strictEqual(safeWrite(ended, 'data: x\n\n'), false, 'beendete Antwort wird nicht beschrieben');
  await wait(50);
  assert.strictEqual(uncaught, null, 'kein Absturz nach beendeter Antwort');
  a.req.destroy();

  // Gegenprobe: Ohne Schutz gibt es den Fehler wirklich, sonst prüft dieser Test nichts
  const c = await open();
  const raw = seen.at(-1);
  raw.end();
  raw.write('data: x\n\n');
  await wait(50);
  assert.ok(isConnectionError(uncaught), `ungeschütztes Schreiben ist ein Verbindungsfehler: ${uncaught?.code}`);
  uncaught = null;
  c.req.destroy();

  // Vom Gegenüber abgerissen
  const b = await open();
  const torn = seen.at(-1);
  b.req.destroy();
  await wait(50);
  for (let i = 0; i < 5; i++) safeWrite(torn, 'data: x\n\n');
  await wait(50);
  assert.strictEqual(uncaught, null, 'kein Absturz nach abgerissener Verbindung');

  for (const code of ['EPIPE', 'ECONNRESET', 'ERR_STREAM_WRITE_AFTER_END']) assert.ok(isConnectionError({ code }), code);
  assert.ok(!isConnectionError(new TypeError('Programmfehler')), 'Programmfehler zählen nicht als Verbindungsfehler');
  assert.ok(!isConnectionError(null));
  server.closeAllConnections();
  server.close();
  console.log('Robustheit: bestanden');
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
