'use strict';
const log = require('./log').child('db');
// PostgreSQL-Anbindung und Schema-Migrationen
const { Pool } = require('pg');

// Entweder DATABASE_URL oder die Standard-Variablen PGHOST, PGUSER, PGPASSWORD, PGDATABASE, PGPORT
const DATABASE_URL = process.env.DATABASE_URL || (process.env.PGHOST ? '' : 'postgres://vibeboard:vibeboard@localhost:5432/vibeboard');

const pool = new Pool({ ...(DATABASE_URL ? { connectionString: DATABASE_URL } : {}), max: Number(process.env.DB_POOL_SIZE) || 10 });
pool.on('error', (err) => log.error('Datenbankfehler im Verbindungspool', err));

const query = (text, params) => pool.query(text, params);

async function one(text, params) {
  const r = await pool.query(text, params);
  return r.rows[0] || null;
}

async function tx(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const res = await fn(client);
    await client.query('COMMIT');
    return res;
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

// Jede Migration läuft genau einmal (Version in schema_migrations)
const MIGRATIONS = [
  `CREATE TABLE users (
     id            BIGSERIAL PRIMARY KEY,
     username      TEXT NOT NULL,
     email         TEXT,
     display_name  TEXT,
     color         TEXT NOT NULL DEFAULT '#4262ff',
     password_hash TEXT NOT NULL,
     role          TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
     status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending', 'disabled')),
     created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
     last_login_at TIMESTAMPTZ
   );
   CREATE UNIQUE INDEX users_username_key ON users (lower(username));
   CREATE UNIQUE INDEX users_email_key ON users (lower(email)) WHERE email IS NOT NULL;

   CREATE TABLE sessions (
     token_hash  TEXT PRIMARY KEY,
     user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
     expires_at  TIMESTAMPTZ NOT NULL,
     user_agent  TEXT
   );
   CREATE INDEX sessions_user_idx ON sessions (user_id);

   CREATE TABLE tokens (
     token_hash  TEXT PRIMARY KEY,
     user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     purpose     TEXT NOT NULL,
     expires_at  TIMESTAMPTZ NOT NULL
   );

   CREATE TABLE settings (
     key   TEXT PRIMARY KEY,
     value JSONB NOT NULL
   );

   CREATE TABLE boards (
     id          TEXT PRIMARY KEY,
     name        TEXT NOT NULL,
     owner_id    BIGINT REFERENCES users(id) ON DELETE SET NULL,
     link_access TEXT NOT NULL DEFAULT 'private' CHECK (link_access IN ('private', 'view', 'edit')),
     session     JSONB NOT NULL DEFAULT '{}'::jsonb,
     thumbnail   BYTEA,
     created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
     updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
   );
   CREATE INDEX boards_owner_idx ON boards (owner_id);

   CREATE TABLE board_members (
     board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
     user_id  BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     role     TEXT NOT NULL CHECK (role IN ('editor', 'viewer')),
     added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
     PRIMARY KEY (board_id, user_id)
   );
   CREATE INDEX board_members_user_idx ON board_members (user_id);

   CREATE TABLE board_visits (
     board_id   TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
     user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     visited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
     PRIMARY KEY (board_id, user_id)
   );

   CREATE TABLE elements (
     board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
     id       TEXT NOT NULL,
     data     JSONB NOT NULL,
     PRIMARY KEY (board_id, id)
   );`,

  // 2: E-Mail-Bestätigung, Zwei-Faktor-Anmeldung, Sitzungsdetails, Sicherheitsprotokoll
  `ALTER TABLE users
     ADD COLUMN email_verified_at   TIMESTAMPTZ,
     ADD COLUMN pending_email       TEXT,
     ADD COLUMN totp_secret         TEXT,
     ADD COLUMN totp_pending        TEXT,
     ADD COLUMN totp_enabled        BOOLEAN NOT NULL DEFAULT false,
     ADD COLUMN totp_last_counter   BIGINT NOT NULL DEFAULT -1,
     ADD COLUMN recovery_codes      TEXT[] NOT NULL DEFAULT '{}',
     ADD COLUMN password_changed_at TIMESTAMPTZ;
   -- bestehende Konten gelten als bestätigt
   UPDATE users SET email_verified_at = created_at;
   UPDATE users SET email = lower(email) WHERE email IS NOT NULL;

   ALTER TABLE sessions
     ADD COLUMN last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
     ADD COLUMN ip TEXT;

   ALTER TABLE tokens ADD COLUMN data TEXT;
   CREATE INDEX tokens_user_idx ON tokens (user_id);

   CREATE TABLE audit_log (
     id         BIGSERIAL PRIMARY KEY,
     at         TIMESTAMPTZ NOT NULL DEFAULT now(),
     event      TEXT NOT NULL,
     user_id    BIGINT REFERENCES users(id) ON DELETE SET NULL,
     actor_id   BIGINT REFERENCES users(id) ON DELETE SET NULL,
     ip         TEXT,
     user_agent TEXT,
     details    JSONB
   );
   CREATE INDEX audit_log_at_idx ON audit_log (at DESC);
   CREATE INDEX audit_log_user_idx ON audit_log (user_id);`,
];

// Migration 3: Versionshistorie der Anwendung
MIGRATIONS.push(`CREATE TABLE app_versions (
     id         BIGSERIAL PRIMARY KEY,
     version    TEXT NOT NULL,
     previous   TEXT,
     schema     INT NOT NULL,
     backup     TEXT,
     started_at TIMESTAMPTZ NOT NULL DEFAULT now()
   );`);

// Migration 4: Versionen (Sicherungspunkte) von Boards
MIGRATIONS.push(`CREATE TABLE board_versions (
     id            BIGSERIAL PRIMARY KEY,
     board_id      TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
     kind          TEXT NOT NULL DEFAULT 'manual' CHECK (kind IN ('manual', 'auto', 'restore')),
     label         TEXT,
     name          TEXT NOT NULL,
     element_count INT NOT NULL DEFAULT 0,
     created_by    BIGINT REFERENCES users(id) ON DELETE SET NULL,
     created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
     data          JSONB NOT NULL
   );
   CREATE INDEX board_versions_board_idx ON board_versions (board_id, created_at DESC);
   CREATE INDEX elements_card_assignee_idx ON elements (lower(data->>'assignee')) WHERE data->>'type' = 'card';`);

// Migration 5: Zusammenarbeit im Team – Rolle „Kommentieren“, Benachrichtigungen, Aktivitätsverlauf, Gastzugang,
// Teams und Ordner, Aufzeichnungen
MIGRATIONS.push(`ALTER TABLE board_members DROP CONSTRAINT board_members_role_check;
   ALTER TABLE board_members ADD CONSTRAINT board_members_role_check CHECK (role IN ('editor', 'commenter', 'viewer'));
   ALTER TABLE boards DROP CONSTRAINT boards_link_access_check;
   ALTER TABLE boards ADD CONSTRAINT boards_link_access_check CHECK (link_access IN ('private', 'view', 'comment', 'edit'));
   ALTER TABLE users DROP CONSTRAINT users_role_check;
   ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'user', 'guest'));
   ALTER TABLE users
     ADD COLUMN notify_email     BOOLEAN NOT NULL DEFAULT true,
     ADD COLUMN guest_link_id    BIGINT,
     ADD COLUMN guest_expires_at TIMESTAMPTZ;
   ALTER TABLE board_visits ADD COLUMN previous_visit_at TIMESTAMPTZ;

   CREATE TABLE notifications (
     id         BIGSERIAL PRIMARY KEY,
     user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     board_id   TEXT REFERENCES boards(id) ON DELETE CASCADE,
     kind       TEXT NOT NULL CHECK (kind IN ('mention', 'reply', 'task')),
     actor_id   BIGINT REFERENCES users(id) ON DELETE SET NULL,
     actor_name TEXT,
     element_id TEXT,
     excerpt    TEXT,
     created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
     read_at    TIMESTAMPTZ
   );
   CREATE INDEX notifications_user_idx ON notifications (user_id, created_at DESC);

   CREATE TABLE board_activity (
     id           BIGSERIAL PRIMARY KEY,
     board_id     TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
     user_id      BIGINT REFERENCES users(id) ON DELETE SET NULL,
     user_name    TEXT,
     user_color   TEXT,
     kind         TEXT NOT NULL,
     element_id   TEXT,
     element_type TEXT,
     label        TEXT,
     count        INT NOT NULL DEFAULT 1,
     at           TIMESTAMPTZ NOT NULL DEFAULT now()
   );
   CREATE INDEX board_activity_board_idx ON board_activity (board_id, at DESC);

   CREATE TABLE guest_links (
     id         BIGSERIAL PRIMARY KEY,
     board_id   TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
     token_hash TEXT NOT NULL UNIQUE,
     role       TEXT NOT NULL CHECK (role IN ('viewer', 'commenter')),
     label      TEXT,
     created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
     created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
     expires_at TIMESTAMPTZ NOT NULL,
     revoked_at TIMESTAMPTZ
   );
   CREATE INDEX guest_links_board_idx ON guest_links (board_id);
   -- Gastkonten verschwinden mit ihrem Link (und damit auch ihre Sitzungen)
   ALTER TABLE users ADD CONSTRAINT users_guest_link_fk FOREIGN KEY (guest_link_id) REFERENCES guest_links(id) ON DELETE CASCADE;

   CREATE TABLE teams (
     id         BIGSERIAL PRIMARY KEY,
     name       TEXT NOT NULL,
     created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
     created_at TIMESTAMPTZ NOT NULL DEFAULT now()
   );
   CREATE TABLE team_members (
     team_id  BIGINT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
     user_id  BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     role     TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
     added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
     PRIMARY KEY (team_id, user_id)
   );
   CREATE INDEX team_members_user_idx ON team_members (user_id);
   ALTER TABLE boards
     ADD COLUMN team_id   BIGINT REFERENCES teams(id) ON DELETE SET NULL,
     ADD COLUMN team_role TEXT NOT NULL DEFAULT 'editor' CHECK (team_role IN ('editor', 'commenter', 'viewer'));
   CREATE INDEX boards_team_idx ON boards (team_id);

   CREATE TABLE folders (
     id         BIGSERIAL PRIMARY KEY,
     name       TEXT NOT NULL,
     user_id    BIGINT REFERENCES users(id) ON DELETE CASCADE,
     team_id    BIGINT REFERENCES teams(id) ON DELETE CASCADE,
     created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
     CHECK ((user_id IS NULL) <> (team_id IS NULL))
   );
   CREATE INDEX folders_user_idx ON folders (user_id);
   CREATE INDEX folders_team_idx ON folders (team_id);
   CREATE TABLE folder_boards (
     folder_id BIGINT NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
     board_id  TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
     PRIMARY KEY (folder_id, board_id)
   );
   CREATE INDEX folder_boards_board_idx ON folder_boards (board_id);

   CREATE TABLE board_recordings (
     id          BIGSERIAL PRIMARY KEY,
     board_id    TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
     created_by  BIGINT REFERENCES users(id) ON DELETE SET NULL,
     author_name TEXT,
     title       TEXT NOT NULL,
     duration_ms INT NOT NULL,
     track       JSONB NOT NULL,
     audio       BYTEA,
     audio_type  TEXT,
     created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
   );
   CREATE INDEX board_recordings_board_idx ON board_recordings (board_id, created_at DESC);`);

// Migration 6: Anmeldung nur per E-Mail – der Name ist ein Anzeigename und muss nicht eindeutig sein;
// Team-Mitgliedschaft erst nach angenommener Einladung
MIGRATIONS.push(`DROP INDEX users_username_key;
   CREATE INDEX users_username_idx ON users (lower(username));
   UPDATE users SET display_name = username WHERE display_name IS NULL OR btrim(display_name) = '';

   CREATE TABLE team_invitations (
     team_id    BIGINT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
     user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     role       TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
     invited_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
     created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
     PRIMARY KEY (team_id, user_id)
   );
   CREATE INDEX team_invitations_user_idx ON team_invitations (user_id);

   ALTER TABLE notifications DROP CONSTRAINT notifications_kind_check;
   ALTER TABLE notifications ADD CONSTRAINT notifications_kind_check CHECK (kind IN ('mention', 'reply', 'task', 'team_invite'));
   ALTER TABLE notifications ADD COLUMN team_id BIGINT REFERENCES teams(id) ON DELETE CASCADE;`);

// Migration 7: Papierkorb und Retro-Serien, eigene Vorlagen, Dateianhänge, Umfrage-Ergebnisse, Webhooks
MIGRATIONS.push(`ALTER TABLE boards
     ADD COLUMN deleted_at    TIMESTAMPTZ,
     ADD COLUMN deleted_by    BIGINT REFERENCES users(id) ON DELETE SET NULL,
     ADD COLUMN prev_retro_id TEXT REFERENCES boards(id) ON DELETE SET NULL;
   CREATE INDEX boards_deleted_idx ON boards (deleted_at) WHERE deleted_at IS NOT NULL;
   CREATE INDEX boards_prev_retro_idx ON boards (prev_retro_id);

   CREATE TABLE user_templates (
     id          BIGSERIAL PRIMARY KEY,
     name        TEXT NOT NULL,
     description TEXT NOT NULL DEFAULT '',
     icon        TEXT NOT NULL DEFAULT '⭐',
     owner_id    BIGINT REFERENCES users(id) ON DELETE CASCADE,
     team_id     BIGINT REFERENCES teams(id) ON DELETE CASCADE,
     data        JSONB NOT NULL,
     created_by  BIGINT REFERENCES users(id) ON DELETE SET NULL,
     created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
     CHECK ((owner_id IS NULL) <> (team_id IS NULL))
   );
   CREATE INDEX user_templates_owner_idx ON user_templates (owner_id);
   CREATE INDEX user_templates_team_idx ON user_templates (team_id);

   CREATE TABLE board_files (
     board_id   TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
     id         TEXT NOT NULL,
     name       TEXT NOT NULL,
     mime       TEXT NOT NULL,
     size       INT NOT NULL,
     sha256     TEXT NOT NULL,
     data       BYTEA NOT NULL,
     preview    BYTEA,
     created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
     created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
     PRIMARY KEY (board_id, id)
   );

   CREATE TABLE board_polls (
     id           BIGSERIAL PRIMARY KEY,
     board_id     TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
     kind         TEXT NOT NULL,
     question     TEXT NOT NULL DEFAULT '',
     results      JSONB NOT NULL,
     participants INT NOT NULL DEFAULT 0,
     created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
   );
   CREATE INDEX board_polls_board_idx ON board_polls (board_id, created_at);

   CREATE TABLE webhooks (
     id          BIGSERIAL PRIMARY KEY,
     user_id     BIGINT REFERENCES users(id) ON DELETE CASCADE,
     team_id     BIGINT REFERENCES teams(id) ON DELETE CASCADE,
     name        TEXT NOT NULL DEFAULT '',
     url         TEXT NOT NULL,
     format      TEXT NOT NULL DEFAULT 'generic' CHECK (format IN ('generic', 'slack', 'teams', 'matrix')),
     events      TEXT[] NOT NULL DEFAULT '{}',
     created_by  BIGINT REFERENCES users(id) ON DELETE SET NULL,
     created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
     last_at     TIMESTAMPTZ,
     last_status TEXT,
     failures    INT NOT NULL DEFAULT 0,
     CHECK ((user_id IS NULL) <> (team_id IS NULL))
   );
   CREATE INDEX webhooks_user_idx ON webhooks (user_id);
   CREATE INDEX webhooks_team_idx ON webhooks (team_id);`);

const SCHEMA_VERSION = MIGRATIONS.length;
const MIGRATION_LOCK = 72617001; // fester Schlüssel für pg_advisory_lock

async function appliedMigrations(c) {
  await c.query('CREATE TABLE IF NOT EXISTS schema_migrations (version INT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())');
  return new Set((await c.query('SELECT version FROM schema_migrations')).rows.map((r) => r.version));
}

// Wendet ausstehende Migrationen an – jede in einer eigenen Transaktion, in fester Reihenfolge.
// upTo: nur bis zu dieser Schemaversion (für den Upgrade-Test).
async function migrateWith(p, { upTo = SCHEMA_VERSION, log: report = (m) => log.info(m) } = {}) {
  const client = await p.connect();
  try {
    const done = await appliedMigrations(client);
    const applied = [];
    for (let v = 1; v <= upTo; v++) {
      if (done.has(v)) continue;
      await client.query('BEGIN');
      try {
        await client.query(MIGRATIONS[v - 1]);
        await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [v]);
        await client.query('COMMIT');
      } catch (e) {
        await client.query('ROLLBACK').catch(() => {});
        throw new Error(`Datenbank-Migration ${v} fehlgeschlagen und zurückgerollt: ${e.message}`);
      }
      applied.push(v);
      report(`Datenbank-Migration ${v} angewendet`);
    }
    return applied;
  } finally {
    client.release();
  }
}

async function migrate() {
  return migrateWith(pool);
}

// Exklusive Sperre während des Upgrades (mehrere gleichzeitig startende Instanzen)
async function withMigrationLock(fn) {
  const client = await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK]);
    return await fn();
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK]).catch(() => {});
    client.release();
  }
}

async function schemaState() {
  const client = await pool.connect();
  try {
    const done = await appliedMigrations(client);
    const max = done.size ? Math.max(...done) : 0;
    const pending = [];
    for (let v = 1; v <= SCHEMA_VERSION; v++) if (!done.has(v)) pending.push(v);
    return { current: max, target: SCHEMA_VERSION, pending, empty: !done.size };
  } finally {
    client.release();
  }
}

async function waitForDb(retries = 30) {
  for (let i = 1; ; i++) {
    try {
      await query('SELECT 1');
      return;
    } catch (e) {
      if (i >= retries) throw e;
      log.warn('Warte auf Datenbank …', { reason: e.code || e.message });
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}

module.exports = { pool, query, one, tx, migrate, migrateWith, withMigrationLock, schemaState, waitForDb, DATABASE_URL, MIGRATIONS, SCHEMA_VERSION };
