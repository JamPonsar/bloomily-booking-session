import pg from 'pg';
import { AsyncLocalStorage } from 'node:async_hooks';
import { seed } from './seed.ts';

/** Created on first use, so a missing DATABASE_URL becomes a readable API error instead of a crashed function. */
let poolInstance: pg.Pool | null = null;
export function getPool(): pg.Pool {
  if (poolInstance) return poolInstance;
  const rawUrl = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
  if (!rawUrl) {
    throw Object.assign(
      new Error('DATABASE_URL is not set. Add it in Vercel → Settings → Environment Variables (the Neon integration does this), then redeploy. Locally, copy .env.example to .env.'),
      { code: 'NO_DATABASE_URL' },
    );
  }
  // Neon's strings say sslmode=require; pg warns about its future meaning, so pin the strict mode it already uses.
  const connectionString = rawUrl.replace('sslmode=require', 'sslmode=verify-full');
  // Serverless instances are short-lived, so keep the pool small; Neon's pooler does the real pooling.
  poolInstance = new pg.Pool({ connectionString, max: process.env.VERCEL ? 3 : 8 });
  // Neon closes idle connections; without this handler that would crash the process.
  poolInstance.on('error', (err) => console.error('[db] idle client error:', err.message));
  return poolInstance;
}

type Row = Record<string, unknown>;
const txStore = new AsyncLocalStorage<pg.PoolClient>();
const executor = () => txStore.getStore() ?? getPool();

/** SQL is written with `?` placeholders; Postgres wants $1, $2, … */
const toPg = (sql: string) => {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
};

/** Runs a query and returns all rows. Uses the surrounding transaction when there is one. */
export async function all<T = Row>(sql: string, params: unknown[] = []): Promise<T[]> {
  const res = await executor().query(toPg(sql), params);
  return res.rows as T[];
}

export async function get<T = Row>(sql: string, params: unknown[] = []): Promise<T | undefined> {
  return (await all<T>(sql, params))[0];
}

/** Runs a write and returns the number of affected rows. */
export async function run(sql: string, params: unknown[] = []): Promise<number> {
  const res = await executor().query(toPg(sql), params);
  return res.rowCount ?? 0;
}

/**
 * Runs fn inside a transaction. Every all()/get()/run() call made while fn is
 * executing (however deeply nested) uses the same connection, and rolls back on any thrown error.
 */
export async function transaction<T>(fn: () => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await txStore.run(client, fn);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Relational schema. Every relationship is a real foreign key:
 *   parents 1──* children     (children.parent_id)
 *   parents 1──* bookings     (bookings.parent_id)
 *   children 1──* bookings    (bookings.child_id)
 *   sessions 1──* bookings    (bookings.session_id)
 * Timestamps are ISO-8601 UTC strings so they sort and compare as text.
 */
const DDL = `
CREATE TABLE IF NOT EXISTS parents (
  id                      TEXT PRIMARY KEY,
  first_name              TEXT NOT NULL,
  last_name               TEXT NOT NULL,
  email                   TEXT NOT NULL UNIQUE,
  phone                   TEXT NOT NULL DEFAULT '',
  address                 TEXT NOT NULL DEFAULT '',
  emergency_contact_name  TEXT NOT NULL DEFAULT '',
  emergency_contact_phone TEXT NOT NULL DEFAULT '',
  created_at              TEXT NOT NULL,
  updated_at              TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS children (
  id                   TEXT PRIMARY KEY,
  parent_id            TEXT NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
  first_name           TEXT NOT NULL,
  last_name            TEXT NOT NULL,
  date_of_birth        TEXT NOT NULL,
  dietary_restrictions TEXT NOT NULL DEFAULT '[]',
  medical_notes        TEXT NOT NULL DEFAULT '',
  created_at           TEXT NOT NULL,
  updated_at           TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_children_parent ON children(parent_id);

CREATE TABLE IF NOT EXISTS sessions (
  id              TEXT PRIMARY KEY,
  title           TEXT NOT NULL,
  description     TEXT NOT NULL DEFAULT '',
  instructor_name TEXT NOT NULL,
  category        TEXT NOT NULL,
  location        TEXT NOT NULL,
  starts_at       TEXT NOT NULL,
  ends_at         TEXT NOT NULL,
  capacity        INTEGER NOT NULL CHECK (capacity > 0),
  min_age         INTEGER NOT NULL,
  max_age         INTEGER NOT NULL,
  price_cents     INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL,
  CHECK (ends_at > starts_at),
  CHECK (max_age >= min_age)
);
CREATE INDEX IF NOT EXISTS idx_sessions_starts_at ON sessions(starts_at);

CREATE TABLE IF NOT EXISTS bookings (
  id                TEXT PRIMARY KEY,
  session_id        TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  child_id          TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  parent_id         TEXT NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
  status            TEXT NOT NULL CHECK (status IN ('confirmed', 'cancelled')),
  consent_shared_at TEXT NOT NULL,
  created_at        TEXT NOT NULL,
  cancelled_at      TEXT
);
CREATE INDEX IF NOT EXISTS idx_bookings_session ON bookings(session_id);
CREATE INDEX IF NOT EXISTS idx_bookings_parent ON bookings(parent_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_bookings_active_child
  ON bookings(session_id, child_id) WHERE status = 'confirmed';

CREATE TABLE IF NOT EXISTS presence (
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  client_id  TEXT NOT NULL,
  seen_at    TEXT NOT NULL,
  PRIMARY KEY (session_id, client_id)
);
`;

/** Reseed when fewer than this many sessions are still ahead, so a hosted demo never goes stale. */
const MIN_UPCOMING_SESSIONS = 15;
const SETUP_LOCK = 727274;

async function setup({ force }: { force: boolean }): Promise<void> {
  await transaction(async () => {
    // One instance at a time: concurrent cold starts must not race on DDL or seeding.
    await all('SELECT pg_advisory_xact_lock(?)', [SETUP_LOCK]);
    await executor().query(DDL);
    const { n } = (await get<{ n: string }>('SELECT COUNT(*) AS n FROM sessions WHERE ends_at > ?', [new Date().toISOString()]))!;
    if (force || Number(n) < MIN_UPCOMING_SESSIONS) {
      await run('TRUNCATE bookings, children, sessions, parents, presence');
      await seed();
      console.log('[db] seeded demo data');
    }
  });
}

let readyPromise: Promise<void> | null = null;

/** Creates tables and demo data on first use (and again if the demo schedule has run out). Safe to call on every request. */
export function ready(): Promise<void> {
  return (readyPromise ??= setup({ force: false }).catch((err) => {
    readyPromise = null;
    throw err;
  }));
}

/** Wipes everything and re-creates the demo data (npm run db:reset). */
export function resetDemoData(): Promise<void> {
  return setup({ force: true });
}
