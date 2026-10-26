'use strict';
// PostgreSQL-Anbindung und Schema-Migrationen
const { Pool } = require('pg');

// Entweder DATABASE_URL oder die Standard-Variablen PGHOST, PGUSER, PGPASSWORD, PGDATABASE, PGPORT
const DATABASE_URL = process.env.DATABASE_URL || (process.env.PGHOST ? '' : 'postgres://vibeboard:vibeboard@localhost:5432/vibeboard');

const pool = new Pool({ ...(DATABASE_URL ? { connectionString: DATABASE_URL } : {}), max: Number(process.env.DB_POOL_SIZE) || 10 });
pool.on('error', (err) => console.error('Datenbankfehler (Pool):', err.message));

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

const SCHEMA_VERSION = MIGRATIONS.length;
const MIGRATION_LOCK = 72617001; // fester Schlüssel für pg_advisory_lock

async function appliedMigrations(c) {
  await c.query('CREATE TABLE IF NOT EXISTS schema_migrations (version INT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())');
  return new Set((await c.query('SELECT version FROM schema_migrations')).rows.map((r) => r.version));
}

// Wendet ausstehende Migrationen an – jede in einer eigenen Transaktion, in fester Reihenfolge.
// upTo: nur bis zu dieser Schemaversion (für den Upgrade-Test).
async function migrateWith(p, { upTo = SCHEMA_VERSION, log = console.log } = {}) {
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
      log(`Datenbank-Migration ${v} angewendet`);
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
      console.log(`Warte auf Datenbank … (${e.code || e.message})`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}

module.exports = { pool, query, one, tx, migrate, migrateWith, withMigrationLock, schemaState, waitForDb, DATABASE_URL, MIGRATIONS, SCHEMA_VERSION };
