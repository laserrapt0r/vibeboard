'use strict';
// Browsertests: echte Tastatur und Maus, mehrere Personen, gegen einen echten Server mit PostgreSQL.
//   npm run test:browser                    alle Tests; startet den Server selbst (DATABASE_URL nötig, Chrome installiert)
//   npm run test:browser -- gemeinsam-tippen nur diesen
// Mit BASE und VB_SERVER_CMD laufen sie gegen einen fertigen Server, zum Beispiel einen Testcontainer.
// Jeder Test beginnt mit frisch gestartetem Server, sonst griffen die Anmeldegrenzen über die Tests hinweg.
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const TIMEOUT_MS = 300000;
const own = !process.env.BASE;
const env = {
  ...process.env,
  PORT: process.env.PORT || '3310',
  ADMIN_EMAIL: process.env.ADMIN_EMAIL || 'admin@test.example',
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || 'Rotkehlchen-Wolke-47',
};
env.BASE = env.BASE || `http://127.0.0.1:${env.PORT}`;

const ctl = (action) => {
  const cmd = process.env.VB_SERVER_CMD
    ? process.env.VB_SERVER_CMD.replace('{action}', action)
    : `${process.execPath} ${path.join(__dirname, 'serverctl.js')} ${action}`;
  const r = spawnSync(cmd, { shell: true, env, stdio: 'inherit' });
  if (r.status) throw new Error(`Server: ${action} gescheitert`);
};
const sleep = (ms) => spawnSync(process.execPath, ['-e', `setTimeout(() => {}, ${ms})`]);

const wanted = process.argv.slice(2);
const all = fs.readdirSync(__dirname).filter((f) => /^test-.*\.js$/.test(f)).map((f) => f.slice(5, -3)).sort();
const list = wanted.length ? all.filter((t) => wanted.includes(t)) : all;
if (wanted.length && list.length !== wanted.length) throw new Error(`Unbekannter Test. Vorhanden: ${all.join(', ')}`);

let failed = 0;
try {
  if (own) ctl('start');
  const seed = spawnSync(process.execPath, [path.join(__dirname, 'seed.js')], { env, stdio: 'inherit' });
  if (seed.status) throw new Error('Testkonten konnten nicht angelegt werden');
  for (const name of list) {
    ctl('restart');
    if (!own) sleep(6000);
    const r = spawnSync(process.execPath, [path.join(__dirname, `test-${name}.js`)], { env, encoding: 'utf8', timeout: TIMEOUT_MS, maxBuffer: 64 * 1024 * 1024 });
    const lines = String(r.stdout || '').split('\n');
    const ok = lines.filter((l) => l.startsWith('ok')).length;
    const bad = lines.filter((l) => l.startsWith('FAIL') && !/^FAIL \d+$/.test(l));
    const good = r.status === 0 && !bad.length;
    console.log(`${good ? 'ok  ' : 'FAIL'} ${name}: ${ok} Prüfungen${bad.length ? `, ${bad.length} fehlgeschlagen` : ''}${r.signal ? `, abgebrochen (${r.signal})` : ''}`);
    if (!good) {
      failed++;
      bad.slice(0, 10).forEach((l) => console.log(`     ${l.slice(0, 300)}`));
      if (r.stderr) console.log(String(r.stderr).split('\n').slice(0, 12).join('\n'));
    }
  }
} finally {
  if (own) ctl('stop');
}
console.log(failed ? `${failed} von ${list.length} Browsertests fehlgeschlagen` : `${list.length} Browsertests bestanden`);
process.exit(failed ? 1 : 0);
