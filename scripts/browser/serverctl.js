'use strict';
// Startet und stoppt den Testserver für die Browsertests. Aufruf: serverctl.js start|stop|restart
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PID_FILE = process.env.VB_PID_FILE || path.join(os.tmpdir(), 'vb-browser-server.pid');
const LOG_FILE = process.env.VB_LOG_FILE || path.join(os.tmpdir(), 'vb-browser-server.log');
const PORT = process.env.PORT || '3310';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const running = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

async function stop(hard = false) {
  if (!fs.existsSync(PID_FILE)) return;
  const pid = Number(fs.readFileSync(PID_FILE, 'utf8'));
  fs.unlinkSync(PID_FILE);
  if (!running(pid)) return;
  process.kill(pid, hard ? 'SIGKILL' : 'SIGTERM');
  for (let i = 0; i < 100 && running(pid); i++) await wait(100);
}

async function start() {
  const log = fs.openSync(LOG_FILE, 'a');
  const child = spawn(process.execPath, [path.join(__dirname, '..', '..', 'server.js')], {
    detached: true, stdio: ['ignore', log, log], env: { ...process.env, PORT },
  });
  fs.writeFileSync(PID_FILE, String(child.pid));
  child.unref();
  for (let i = 0; i < 150; i++) {
    const up = await fetch(`http://127.0.0.1:${PORT}/healthz`).then((r) => r.ok).catch(() => false);
    if (up) return;
    await wait(200);
  }
  throw new Error(`Testserver startet nicht, siehe ${LOG_FILE}`);
}

(async () => {
  const action = process.argv[2];
  if (action === 'stop') await stop(true); // wie ein Absturz: Die Tests prüfen genau diesen Fall
  else if (action === 'start') await start();
  else if (action === 'restart') {
    await stop();
    await start();
  } else throw new Error('start, stop oder restart');
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
