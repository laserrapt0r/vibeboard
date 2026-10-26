'use strict';
// Einrichtung beim Start: Admin aus Umgebungsvariablen, Import alter JSON-Boards, Aufräumen
const fs = require('fs');
const path = require('path');
const db = require('./db');
const auth = require('./auth');
const { sanitizeElement, cleanJson } = require('./sanitize');

async function seedAdmin() {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  if (!username || !password) return;
  const exists = await db.one('SELECT id FROM users WHERE lower(username) = lower($1)', [username]);
  if (exists) return;
  const row = await db.one(
    `INSERT INTO users (username, email, password_hash, role, status, color) VALUES ($1, $2, $3, 'admin', 'active', $4) RETURNING id`,
    [auth.validateUsername(username), process.env.ADMIN_EMAIL || null, await auth.hashPassword(auth.validatePassword(password)), auth.randomColor()]);
  await db.query('UPDATE boards SET owner_id = $1 WHERE owner_id IS NULL', [row.id]);
  console.log(`Administrator „${username}“ angelegt`);
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
        const list = Object.values(b.elements || {}).map(sanitizeElement).filter(Boolean);
        if (list.length) {
          await c.query(`INSERT INTO elements (board_id, id, data) SELECT $1, e->>'id', e FROM jsonb_array_elements($2::jsonb) e ON CONFLICT DO NOTHING`, [b.id, JSON.stringify(list)]);
        }
        n++;
      });
    } catch (e) {
      console.error('Import fehlgeschlagen:', f, e.message);
    }
  }
  await db.query(`INSERT INTO settings (key, value) VALUES ('legacy_import', $1) ON CONFLICT (key) DO NOTHING`, [{ at: new Date().toISOString(), boards: n }]);
  if (n) console.log(`${n} Boards aus ${dir} in die Datenbank übernommen`);
}

function scheduleCleanup() {
  const run = () => {
    db.query('DELETE FROM sessions WHERE expires_at < now()').catch(() => {});
    db.query('DELETE FROM tokens WHERE expires_at < now()').catch(() => {});
  };
  run();
  setInterval(run, 3600000).unref();
}

module.exports = { seedAdmin, importLegacy, scheduleCleanup };
