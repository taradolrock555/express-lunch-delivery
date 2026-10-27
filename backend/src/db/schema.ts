export const SQLITE_SCHEMA = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS customers (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  phone       TEXT NOT NULL,
  address     TEXT NOT NULL,
  latitude    REAL NOT NULL,
  longitude   REAL NOT NULL,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS riders (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  name      TEXT NOT NULL,
  job_code  TEXT NOT NULL UNIQUE,
  status    TEXT NOT NULL DEFAULT 'available'
);

CREATE TABLE IF NOT EXISTS orders (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id  INTEGER NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  rider_id     INTEGER REFERENCES riders(id) ON DELETE SET NULL,
  assignment_mode TEXT NOT NULL DEFAULT 'auto' CHECK (assignment_mode IN ('auto', 'manual')),
  total_boxes  INTEGER NOT NULL CHECK (total_boxes BETWEEN 1 AND 3),
  status       TEXT NOT NULL DEFAULT 'pending',
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS route_plans (
  id            INTEGER PRIMARY KEY CHECK (id = 1),
  plan_json     TEXT NOT NULL,
  published_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
`;
