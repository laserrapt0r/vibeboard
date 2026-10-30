'use strict';
const log = require('./log').child('setup');
// Einrichtung beim Start: Admin aus Umgebungsvariablen, Import alter JSON-Boards, Aufräumen
const fs = require('fs');
const path = require('path');
const db = require('./db');
const auth = require('./auth');
const { sanitizeElement, cleanJson } = require('./sanitize');
const { checkPassword } = require('./password');
const scanner = require('./virusscan');
const uploads = require('./uploads');
const settings = require('./settings');

// Administrator aus ADMIN_EMAIL, ADMIN_PASSWORD und ADMIN_NAME (früher ADMIN_USERNAME) anlegen, falls es noch keinen gibt.
// Angemeldet wird mit der E-Mail-Adresse – ohne ADMIN_EMAIL wird niemand angelegt.
async function seedAdmin() {
  const email = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME || process.env.ADMIN_USERNAME || 'Admin';
  if (!password) return;
  if (!email) {
    log.warn('ADMIN_PASSWORD ist gesetzt, ADMIN_EMAIL aber nicht – die Anmeldung erfolgt per E-Mail-Adresse, daher wird kein Administrator angelegt');
    return;
  }
  // Nur zur Ersteinrichtung: Gibt es schon einen Administrator (z. B. mit inzwischen geänderter Adresse) oder ein Konto
  // mit dieser Adresse, wird niemand angelegt – sonst entstünde nach einer Adressänderung ein zweiter Admin
  const exists = await db.one(`SELECT id FROM users WHERE lower(email) = $1 OR (role = 'admin' AND status = 'active') LIMIT 1`, [email]);
  if (exists) return;
  const display = auth.validateName(name);
  const row = await db.one(
    `INSERT INTO users (username, display_name, email, password_hash, role, status, color, email_verified_at, password_changed_at)
     VALUES ($1, $1, $2, $3, 'admin', 'active', $4, now(), now()) RETURNING id`,
    [display, email, await auth.hashPassword(await checkPassword(password, { minLength: 12, username: display, email })), auth.randomColor()]);
  await db.query('UPDATE boards SET owner_id = $1 WHERE owner_id IS NULL', [row.id]);
  log.info('Administrator aus Umgebungsvariablen angelegt', { userId: row.id });
}

// Boards aus der früheren Dateiablage (data/boards/*.json) einmalig übernehmen
async function importLegacy(dataDir) {
  const dir = path.join(dataDir, 'boards');
  if (!fs.existsSync(dir)) return;
  if (await db.one(`SELECT 1 FROM settings WHERE key = 'legacy_import'`)) return;
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
  const owner = await db.one(`SELECT id FROM users WHERE role = 'admin' ORDER BY id LIMIT 1`);
  let n = 0;
  for (const f of files) {
    try {
      const b = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
      if (!/^[a-zA-Z0-9_-]{1,64}$/.test(b.id || '')) continue;
      const thumbFile = path.join(dataDir, 'thumbs', b.id + '.png');
      const thumb = fs.existsSync(thumbFile) ? fs.readFileSync(thumbFile) : null;
      await db.tx(async (c) => {
        const ins = await c.query(
          `INSERT INTO boards (id, name, owner_id, session, thumbnail, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, to_timestamp($6 / 1000.0), to_timestamp($7 / 1000.0)) ON CONFLICT (id) DO NOTHING RETURNING id`,
          [b.id, String(b.name || 'Importiertes Board').slice(0, 200), owner ? owner.id : null, JSON.stringify(cleanJson(b.session || {})), thumb, b.createdAt || Date.now(), b.updatedAt || Date.now()]);
        if (!ins.rowCount) return;
        let list = Object.values(b.elements || {}).map(sanitizeElement).filter(Boolean);
        // Bilder auch beim Import prüfen, sofern ein Virenscanner erreichbar ist
        if (scanner.configured()) {
          const bad = new Set((await uploads.checkElements(list, { kind: 'Import', lenient: true })).map((r) => r.id));
          list = list.filter((e) => !bad.has(e.id));
        }
        if (list.length) {
          await c.query(`INSERT INTO elements (board_id, id, data) SELECT $1, e->>'id', e FROM jsonb_array_elements($2::jsonb) e ON CONFLICT DO NOTHING`, [b.id, JSON.stringify(list)]);
        }
        n++;
      });
    } catch (e) {
      log.error('Import eines alten Boards fehlgeschlagen', { file: f, err: e });
    }
  }
  await db.query(`INSERT INTO settings (key, value) VALUES ('legacy_import', $1) ON CONFLICT (key) DO NOTHING`, [{ at: new Date().toISOString(), boards: n }]);
  if (n) log.info('Boards aus früherer Version übernommen', { count: n, dir });
}

function scheduleCleanup() {
  const run = () => {
    db.query('DELETE FROM sessions WHERE expires_at < now()').catch(() => {});
    db.query('DELETE FROM tokens WHERE expires_at < now()').catch(() => {});
    // Sicherheitsprotokoll ein Jahr aufbewahren
    db.query(`DELETE FROM audit_log WHERE at < now() - interval '365 days'`).catch(() => {});
    // nie bestätigte Registrierungen nach 14 Tagen entfernen
    db.query(`DELETE FROM users u WHERE email_verified_at IS NULL AND created_at < now() - interval '14 days'
               AND NOT EXISTS (SELECT 1 FROM boards b WHERE b.owner_id = u.id)`).catch(() => {});
    // Papierkorb: Boards nach Ablauf der Frist endgültig löschen
    settings.get().then((s) => require('./boards').purgeTrash(s.collab.trashDays))
      .catch((e) => log.error('Papierkorb konnte nicht geleert werden', { err: e }));
    require('./invites').cleanup().catch(() => {});
    // Nicht mehr verwendete Dateianhänge entfernen
    require('./files').cleanup().catch((e) => log.error('Dateianhänge konnten nicht aufgeräumt werden', { err: e }));
  };
  run();
  setInterval(run, 3600000).unref();
}

module.exports = { seedAdmin, importLegacy, scheduleCleanup };
