'use strict';
// PostgreSQL-Anbindung und Schema-Migrationen
const { Pool } = require('pg');

// Entweder DATABASE_URL oder die Standard-Variablen PGHOST, PGUSER, PGPASSWORD, PGDATABASE, PGPORT
const DATABASE_URL = process.env.DATABASE_URL || (process.env.PGHOST ? '' : 'postgres://dlzboard:dlzboard@localhost:5432/dlzboard');

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
];

async function migrate() {
  await query('CREATE TABLE IF NOT EXISTS schema_migrations (version INT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())');
  const done = new Set((await query('SELECT version FROM schema_migrations')).rows.map((r) => r.version));
  for (let i = 0; i < MIGRATIONS.length; i++) {
    const v = i + 1;
    if (done.has(v)) continue;
    await tx(async (c) => {
      await c.query(MIGRATIONS[i]);
      await c.query('INSERT INTO schema_migrations (version) VALUES ($1)', [v]);
    });
    console.log(`Datenbank-Migration ${v} angewendet`);
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

module.exports = { pool, query, one, tx, migrate, waitForDb, DATABASE_URL };
