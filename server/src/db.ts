import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { seed } from './seed.ts';

export const DB_PATH = process.env.DB_PATH ?? fileURLToPath(new URL('../../data/bloomily.db', import.meta.url));

/**
 * Relational schema. Every relationship is a real foreign key:
 *   parents 1──* children     (children.parent_id)
 *   parents 1──* bookings     (bookings.parent_id)
 *   children 1──* bookings    (bookings.child_id)
 *   sessions 1──* bookings    (bookings.session_id)
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
`;

mkdirSync(dirname(DB_PATH), { recursive: true });
export const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
db.exec(DDL);

const { n } = db.prepare('SELECT COUNT(*) AS n FROM sessions').get() as { n: number };
if (n === 0) {
  transaction(() => seed(db));
  console.log('[db] seeded demo data');
}

/** Runs fn inside a write transaction, rolling back on any thrown error. */
export function transaction<T>(fn: () => T): T {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}
