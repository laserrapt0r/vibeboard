'use strict';
/*
 * Upgrade-Test für Datenbank-Migrationen.
 *
 * Baut in einer Test-Datenbank zwei Schemata auf:
 *   – „frisch“:   alle Migrationen auf einmal (Neuinstallation)
 *   – „upgrade“:  Migration für Migration, nach jedem Schritt mit Beispieldaten (wie ein echtes Update)
 * und prüft, dass beide dieselbe Struktur haben und die Daten aus früheren Versionen erhalten bleiben.
 *
 * Aufruf:  DATABASE_URL=postgres://…/testdb node scripts/test-upgrade.js
 * ACHTUNG: nur gegen eine Test-Datenbank ausführen (legt Schemata vb_test_* an und löscht sie wieder).
 */
const { Pool } = require('pg');

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('Bitte DATABASE_URL auf eine Test-Datenbank setzen.');
  process.exit(2);
}
process.env.DATABASE_URL = url;
const { migrateWith, SCHEMA_VERSION } = require('../lib/db');

const FRESH = 'vb_test_fresh', UPGRADE = 'vb_test_upgrade';
const poolFor = (schema) => new Pool({ connectionString: url, options: `-c search_path=${schema}` });

// Beispieldaten, die nach der jeweiligen Schemaversion eingefügt werden
const SEEDS = {
  1: async (c) => {
    await c.query(`INSERT INTO users (id, username, email, password_hash, role) VALUES (1, 'alt', 'alt@example.org', 'scrypt$16384$8$1$x$y', 'admin')`);
    await c.query(`INSERT INTO boards (id, name, owner_id, session) VALUES ('b1', 'Altes Board', 1, '{"timer":null}')`);
    await c.query(`INSERT INTO elements (board_id, id, data) VALUES ('b1', 'e1', '{"id":"e1","type":"sticky","text":"Hallo"}')`);
    await c.query(`INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ('t1', 1, now() + interval '1 day')`);
    await c.query(`INSERT INTO settings (key, value) VALUES ('general', '{"siteName":"Test"}')`);
  },
  2: async (c) => {
    await c.query(`INSERT INTO audit_log (event, user_id, ip) VALUES ('login', 1, '127.0.0.1')`);
    await c.query(`UPDATE users SET totp_enabled = false, pending_email = NULL WHERE id = 1`);
  },
  3: async (c) => {
    await c.query(`INSERT INTO app_versions (version, previous, schema) VALUES ('3.1.0', '3.0.0', 3)`);
  },
  4: async (c) => {
    await c.query(`INSERT INTO board_versions (board_id, kind, name, element_count, created_by, data)
                   SELECT 'b1', 'manual', 'Altes Board', 1, 1, jsonb_agg(data) FROM elements WHERE board_id = 'b1'`);
  },
  5: async (c) => {
    await c.query(`INSERT INTO teams (id, name, created_by) VALUES (1, 'Team A', 1)`);
    await c.query(`INSERT INTO team_members (team_id, user_id, role) VALUES (1, 1, 'admin')`);
    await c.query(`UPDATE boards SET team_id = 1, team_role = 'commenter', link_access = 'comment' WHERE id = 'b1'`);
    await c.query(`INSERT INTO folders (id, name, team_id) VALUES (1, 'Workshops', 1)`);
    await c.query(`INSERT INTO folder_boards (folder_id, board_id) VALUES (1, 'b1')`);
    await c.query(`INSERT INTO notifications (user_id, board_id, kind, actor_name, element_id, excerpt) VALUES (1, 'b1', 'mention', 'alt', 'e1', 'Hallo')`);
    await c.query(`INSERT INTO board_activity (board_id, user_id, user_name, kind, element_id, element_type, label) VALUES ('b1', 1, 'alt', 'changed', 'e1', 'sticky', 'Hallo')`);
    await c.query(`INSERT INTO guest_links (board_id, token_hash, role, created_by, expires_at) VALUES ('b1', 'h1', 'viewer', 1, now() + interval '1 day')`);
    await c.query(`INSERT INTO board_recordings (board_id, created_by, author_name, title, duration_ms, track) VALUES ('b1', 1, 'alt', 'Rundgang', 1000, '[]')`);
  },
  6: async (c) => {
    await c.query(`INSERT INTO team_invitations (team_id, user_id, role, invited_by) VALUES (1, 1, 'member', 1)`);
    await c.query(`INSERT INTO notifications (user_id, kind, actor_name, team_id, excerpt) VALUES (1, 'team_invite', 'alt', 1, 'Team A')`);
  },
  7: async (c) => {
    await c.query(`INSERT INTO boards (id, name, owner_id, prev_retro_id) VALUES ('b2', 'Retro 2', 1, 'b1')`);
    await c.query(`UPDATE boards SET deleted_at = now(), deleted_by = 1 WHERE id = 'b2'`);
    await c.query(`INSERT INTO user_templates (name, owner_id, data) VALUES ('Meine Vorlage', 1, '[]')`);
    await c.query(`INSERT INTO user_templates (name, team_id, data) VALUES ('Team-Vorlage', 1, '[]')`);
    await c.query(`INSERT INTO board_files (board_id, id, name, mime, size, sha256, data) VALUES ('b1', 'f1', 'a.pdf', 'application/pdf', 4, 'x', '\\x25504446')`);
    await c.query(`INSERT INTO board_polls (board_id, kind, results, participants) VALUES ('b1', 'mood', '{"counts":{"4":2}}', 2)`);
    await c.query(`INSERT INTO webhooks (user_id, url, format, events) VALUES (1, 'https://example.org/h', 'slack', '{mention}')`);
    await c.query(`INSERT INTO webhooks (team_id, url) VALUES (1, 'https://example.org/t')`);
  },
  8: async (c) => {
    await c.query(`INSERT INTO pending_invites (email, board_id, role, invited_by, token_hash, expires_at) VALUES ('neu@example.org', 'b1', 'editor', 1, 'h1', now() + interval '30 days')`);
    await c.query(`INSERT INTO pending_invites (email, team_id, role, invited_by, token_hash, expires_at) VALUES ('neu@example.org', 1, 'member', 1, 'h2', now() + interval '30 days')`);
    await c.query(`UPDATE users SET locale = 'en' WHERE id = 1`);
  },
  9: async (c) => {
    await c.query(`INSERT INTO user_identities (provider, external_id, user_id) VALUES ('ldap', 'abc123', 1)`);
    await c.query(`UPDATE users SET recent_templates = '["kanban", "u1"]', external_link_ok = true WHERE id = 1`);
  },
};

async function structure(c, schema) {
  const cols = (await c.query(
    `SELECT table_name, column_name, data_type, is_nullable, column_default FROM information_schema.columns
      WHERE table_schema = $1 ORDER BY table_name, column_name`, [schema])).rows
    .map((r) => [r.table_name, r.column_name, r.data_type, r.is_nullable, String(r.column_default || '').replace(new RegExp(schema + '\\.', 'g'), '')].join('|'));
  const idx = (await c.query(`SELECT indexname, regexp_replace(indexdef, $1 || '\\.', '', 'g') AS def FROM pg_indexes WHERE schemaname = $1 ORDER BY indexname`, [schema])).rows
    .map((r) => r.indexname + '|' + r.def);
  const cons = (await c.query(
    `SELECT conname, pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE connamespace = $1::regnamespace ORDER BY conname`, [schema])).rows
    .map((r) => r.conname + '|' + r.def.replace(new RegExp(schema + '\\.', 'g'), ''));
  return { cols, idx, cons };
}

function diff(a, b) {
  const sa = new Set(a), sb = new Set(b);
  return { onlyFresh: a.filter((x) => !sb.has(x)), onlyUpgrade: b.filter((x) => !sa.has(x)) };
}

(async () => {
  const admin = new Pool({ connectionString: url });
  let ok = true;
  try {
    for (const s of [FRESH, UPGRADE]) {
      await admin.query(`DROP SCHEMA IF EXISTS ${s} CASCADE`);
      await admin.query(`CREATE SCHEMA ${s}`);
    }
    const fresh = poolFor(FRESH), up = poolFor(UPGRADE);
    const quiet = () => {};

    await migrateWith(fresh, { log: quiet });
    console.log(`✓ Neuinstallation: ${SCHEMA_VERSION} Migrationen angewendet`);

    for (let v = 1; v <= SCHEMA_VERSION; v++) {
      await migrateWith(up, { upTo: v, log: quiet });
      if (SEEDS[v]) await SEEDS[v](up);
      console.log(`✓ Upgrade auf Schema ${v}${SEEDS[v] ? ' (mit Beispieldaten)' : ''}`);
    }
    // Erneuter Lauf darf nichts ändern (idempotent)
    const again = await migrateWith(up, { log: quiet });
    if (again.length) { ok = false; console.error('✗ Erneuter Lauf hat Migrationen angewendet:', again); }
    else console.log('✓ Erneuter Lauf: keine Änderungen');

    const a = await structure(admin, FRESH), b = await structure(admin, UPGRADE);
    for (const k of ['cols', 'idx', 'cons']) {
      const d = diff(a[k], b[k]);
      if (d.onlyFresh.length || d.onlyUpgrade.length) {
        ok = false;
        console.error(`✗ Unterschied (${k}):`, JSON.stringify(d, null, 1));
      }
    }
    if (ok) console.log('✓ Struktur nach Upgrade identisch mit Neuinstallation');

    const data = (await up.query(`SELECT (SELECT count(*) FROM users)::int u, (SELECT count(*) FROM elements)::int e,
      (SELECT email_verified_at IS NOT NULL FROM users WHERE id = 1) verified, (SELECT text FROM (SELECT data->>'text' AS text FROM elements WHERE id = 'e1') x) t`)).rows[0];
    if (data.u !== 1 || data.e !== 1 || data.t !== 'Hallo' || !data.verified) { ok = false; console.error('✗ Daten nicht erhalten:', data); }
    else console.log('✓ Daten aus Version 1 erhalten (bestehende Konten gelten als bestätigt)');
    await fresh.end();
    await up.end();
  } catch (e) {
    ok = false;
    console.error('✗ Fehler:', e.message);
  } finally {
    for (const s of [FRESH, UPGRADE]) await admin.query(`DROP SCHEMA IF EXISTS ${s} CASCADE`).catch(() => {});
    await admin.end();
  }
  console.log(ok ? '\nUpgrade-Test bestanden.' : '\nUpgrade-Test FEHLGESCHLAGEN.');
  process.exit(ok ? 0 : 1);
})();
