'use strict';
const log = require('./log').child('upgrade');
// Versionsverwaltung und automatisches Upgrade beim Start:
// Downgrade-Schutz → Sicherung (pg_dump) → Migrationen → Eintrag in der Versionshistorie
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const db = require('./db');
const pkg = require('../package.json');

const VERSION = pkg.version;
const KEEP_BACKUPS = Number(process.env.BACKUP_KEEP) || 10;

// Vergleich nach Semantic Versioning (MAJOR.MINOR.PATCH); Vorabversionen werden nicht verwendet
function compare(a, b) {
  const pa = String(a).split('.').map(Number), pb = String(b).split('.').map(Number);
  for (let i = 0; i < 3; i++) if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0);
  return 0;
}

async function lastVersion() {
  try {
    const r = await db.one('SELECT version FROM app_versions ORDER BY id DESC LIMIT 1');
    return r ? r.version : null;
  } catch {
    return null; // Tabelle existiert vor Schema 3 noch nicht
  }
}

async function history(limit = 20) {
  try {
    return (await db.query('SELECT version, previous, schema, backup, started_at FROM app_versions ORDER BY id DESC LIMIT $1', [limit])).rows;
  } catch {
    return [];
  }
}

function pgDump(file) {
  return new Promise((resolve, reject) => {
    const args = ['--format=custom', '--no-owner', `--file=${file}`];
    if (process.env.DATABASE_URL) args.push(`--dbname=${process.env.DATABASE_URL}`);
    execFile('pg_dump', args, { timeout: 15 * 60000, env: process.env }, (err, stdout, stderr) => {
      if (err) reject(new Error((stderr || err.message).trim().split('\n').pop()));
      else resolve();
    });
  });
}

// Sicherung vor dem Anwenden von Migrationen. Ohne BACKUP_DIR wird keine Sicherung erstellt.
async function backupBeforeUpgrade(from, schema) {
  const dir = process.env.BACKUP_DIR;
  if (!dir || process.env.BACKUP_BEFORE_UPGRADE === '0') {
    log.warn('Keine Sicherung vor dem Upgrade – BACKUP_DIR ist nicht gesetzt');
    return null;
  }
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const file = path.join(dir, `vibeboard-${from || 'unbekannt'}-schema${schema}-vor-${VERSION}-${stamp}.dump`);
  log.info('Erstelle Sicherung vor dem Upgrade', { file });
  try {
    await pgDump(file);
  } catch (e) {
    fs.rmSync(file, { force: true });
    throw new Error(`Sicherung vor dem Upgrade fehlgeschlagen (${e.message}). Das Upgrade wurde nicht durchgeführt, die Datenbank ist unverändert. ` +
      'Zum Überspringen der Sicherung BACKUP_BEFORE_UPGRADE=0 setzen.');
  }
  // Nur die neuesten Sicherungen behalten
  const old = fs.readdirSync(dir).filter((f) => /^vibeboard-.*\.dump$/.test(f)).sort().reverse().slice(KEEP_BACKUPS);
  for (const f of old) fs.rmSync(path.join(dir, f), { force: true });
  return path.basename(file);
}

// Wird beim Start aufgerufen. Wirft einen Fehler, wenn ein Upgrade nicht sicher möglich ist.
async function upgrade() {
  return db.withMigrationLock(async () => {
    const state = await db.schemaState();
    if (state.current > state.target) {
      throw new Error(`Die Datenbank hat Schemaversion ${state.current}, vibeboard ${VERSION} kennt nur bis ${state.target}. ` +
        'Sie wurde mit einer neueren Version verwendet – bitte diese starten. Ein Downgrade wird nicht unterstützt.');
    }
    const from = await lastVersion();
    if (from && compare(from, VERSION) > 0 && process.env.ALLOW_DOWNGRADE !== '1') {
      throw new Error(`Die Datenbank wurde zuletzt mit vibeboard ${from} betrieben, gestartet wird ${VERSION}. ` +
        'Ein Downgrade wird nicht unterstützt (Überschreiben mit ALLOW_DOWNGRADE=1).');
    }
    let backup = null;
    if (state.pending.length && !state.empty) backup = await backupBeforeUpgrade(from, state.current);
    const applied = await db.migrate();
    if (from !== VERSION) {
      await db.query('INSERT INTO app_versions (version, previous, schema, backup) VALUES ($1, $2, $3, $4)', [VERSION, from, db.SCHEMA_VERSION, backup]);
      if (from) {
        log.info(`Upgrade von ${from} auf ${VERSION} abgeschlossen`, { from, to: VERSION, migrations: applied.length ? applied : 'keine' });
        require('./audit').log(null, 'app_upgraded', { details: { from, to: VERSION, migrations: applied, backup } });
      }
    }
    return { from, to: VERSION, migrations: applied, backup };
  });
}

module.exports = { VERSION, compare, upgrade, history };
