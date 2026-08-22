import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { seed } from './seed';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_PATH = process.env.SIMSUITE_DB ?? path.join(DATA_DIR, 'simsuite.db');

const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS organisation (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  code           TEXT NOT NULL,
  ssm_no         TEXT,
  tin_no         TEXT,
  sst_no         TEXT,
  msic_code      TEXT,
  business_desc  TEXT,
  contact_person TEXT,
  email          TEXT,
  phone          TEXT,
  address1       TEXT,
  address2       TEXT,
  postcode       TEXT,
  city           TEXT,
  state          TEXT,
  country        TEXT,
  kick_start_date TEXT,
  plan_name      TEXT,
  plan_price     REAL,
  plan_sst_pct   REAL,
  policy_quota   INTEGER,
  storage_gb     INTEGER,
  named_users    INTEGER
);

CREATE TABLE IF NOT EXISTS app_user (
  id            TEXT PRIMARY KEY,
  org_id        TEXT NOT NULL REFERENCES organisation(id),
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name          TEXT NOT NULL,
  role          TEXT NOT NULL,          -- master | agent | client
  agent_code    TEXT,
  phone         TEXT,
  status        TEXT NOT NULL DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS sub_agent (
  id              TEXT PRIMARY KEY,
  org_id          TEXT NOT NULL REFERENCES organisation(id),
  name            TEXT NOT NULL,
  email           TEXT,
  phone           TEXT,
  nric            TEXT,
  agent_code      TEXT,
  rank            TEXT,
  motor_rate      REAL NOT NULL DEFAULT 0,
  non_motor_rate  REAL NOT NULL DEFAULT 0,
  override_rate   REAL NOT NULL DEFAULT 0,
  bank_name       TEXT,
  bank_account    TEXT,
  einvoice_tin    TEXT,
  self_billed     INTEGER NOT NULL DEFAULT 0,
  join_date       TEXT,
  status          TEXT NOT NULL DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS client_group (
  id          TEXT PRIMARY KEY,
  org_id      TEXT NOT NULL REFERENCES organisation(id),
  name        TEXT NOT NULL,
  description TEXT,
  pic_name    TEXT,
  pic_phone   TEXT
);

CREATE TABLE IF NOT EXISTS client (
  id             TEXT PRIMARY KEY,
  org_id         TEXT NOT NULL REFERENCES organisation(id),
  group_id       TEXT REFERENCES client_group(id),
  name           TEXT NOT NULL,
  client_type    TEXT NOT NULL,     -- individual | company
  nric           TEXT,
  business_reg   TEXT,
  email          TEXT,
  phone          TEXT,
  address1       TEXT,
  address2       TEXT,
  postcode       TEXT,
  city           TEXT,
  state          TEXT,
  country        TEXT DEFAULT 'MALAYSIA',
  dob            TEXT,
  occupation     TEXT,
  portal_enabled INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT
);

CREATE TABLE IF NOT EXISTS principal (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  short_name     TEXT NOT NULL,
  code           TEXT,
  motor_rate     REAL NOT NULL DEFAULT 0,
  non_motor_rate REAL NOT NULL DEFAULT 0,
  contact_person TEXT,
  phone          TEXT,
  status         TEXT NOT NULL DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS policy (
  id              TEXT PRIMARY KEY,
  org_id          TEXT NOT NULL REFERENCES organisation(id),
  client_id       TEXT NOT NULL REFERENCES client(id),
  principal_id    TEXT NOT NULL REFERENCES principal(id),
  sub_agent_id    TEXT REFERENCES sub_agent(id),
  policy_no       TEXT NOT NULL,
  cover_note_no   TEXT,
  class           TEXT NOT NULL,       -- motor | non_motor
  product         TEXT,
  type_of_cover   TEXT,
  status          TEXT NOT NULL,       -- active | quotation | expired | cancelled | renewal
  case_type       TEXT,                -- new | renewal | endorsement
  effective_date  TEXT,
  expiry_date     TEXT,
  issue_date      TEXT,
  created_date    TEXT,
  sum_insured     REAL NOT NULL DEFAULT 0,
  basic_premium   REAL NOT NULL DEFAULT 0,
  ncd_pct         REAL NOT NULL DEFAULT 0,
  ncd_amount      REAL NOT NULL DEFAULT 0,
  extra_premium   REAL NOT NULL DEFAULT 0,
  gross_premium   REAL NOT NULL DEFAULT 0,
  service_tax     REAL NOT NULL DEFAULT 0,
  stamp_duty      REAL NOT NULL DEFAULT 0,
  total_premium   REAL NOT NULL DEFAULT 0,
  commission_rate REAL NOT NULL DEFAULT 0,
  commission_amt  REAL NOT NULL DEFAULT 0,
  excess          REAL NOT NULL DEFAULT 0,
  remarks         TEXT
);

CREATE TABLE IF NOT EXISTS motor_detail (
  policy_id        TEXT PRIMARY KEY REFERENCES policy(id) ON DELETE CASCADE,
  vehicle_no       TEXT,
  make_model       TEXT,
  body_type        TEXT,
  engine_no        TEXT,
  chassis_no       TEXT,
  engine_cc        TEXT,
  year_make        TEXT,
  seating          INTEGER,
  hire_purchase    TEXT,
  windscreen_si    REAL DEFAULT 0,
  named_drivers    TEXT,
  extensions       TEXT,
  rtd_code         TEXT
);

CREATE TABLE IF NOT EXISTS non_motor_detail (
  policy_id     TEXT PRIMARY KEY REFERENCES policy(id) ON DELETE CASCADE,
  risk_type     TEXT,
  risk_address  TEXT,
  occupancy     TEXT,
  period_desc   TEXT,
  benefits      TEXT
);

CREATE TABLE IF NOT EXISTS policy_extension (
  id         TEXT PRIMARY KEY,
  policy_id  TEXT NOT NULL REFERENCES policy(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  sum_insured REAL DEFAULT 0,
  premium    REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS payment (
  id         TEXT PRIMARY KEY,
  policy_id  TEXT NOT NULL REFERENCES policy(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL,        -- client (client -> agency) | principal (agency -> principal)
  amount     REAL NOT NULL,
  paid_amount REAL NOT NULL DEFAULT 0,
  due_date   TEXT,
  paid_date  TEXT,
  method     TEXT,
  reference  TEXT,
  status     TEXT NOT NULL         -- outstanding | partial | paid
);

CREATE TABLE IF NOT EXISTS commission (
  id            TEXT PRIMARY KEY,
  policy_id     TEXT NOT NULL REFERENCES policy(id) ON DELETE CASCADE,
  sub_agent_id  TEXT REFERENCES sub_agent(id),
  gross_amount  REAL NOT NULL DEFAULT 0,
  override_amt  REAL NOT NULL DEFAULT 0,
  net_amount    REAL NOT NULL DEFAULT 0,
  status        TEXT NOT NULL,     -- pending | approved | paid
  approved_date TEXT,
  payout_date   TEXT
);

CREATE TABLE IF NOT EXISTS life_plan (
  id            TEXT PRIMARY KEY,
  org_id        TEXT NOT NULL REFERENCES organisation(id),
  client_id     TEXT NOT NULL REFERENCES client(id),
  plan_name     TEXT NOT NULL,
  provider      TEXT,
  plan_type     TEXT,
  sum_assured   REAL DEFAULT 0,
  premium       REAL DEFAULT 0,
  frequency     TEXT,
  start_date    TEXT,
  maturity_date TEXT,
  status        TEXT NOT NULL DEFAULT 'in force',
  notes         TEXT
);

CREATE TABLE IF NOT EXISTS notification (
  id           TEXT PRIMARY KEY,
  org_id       TEXT NOT NULL REFERENCES organisation(id),
  title        TEXT NOT NULL,
  body         TEXT,
  audience     TEXT NOT NULL,   -- all | sub_agent | client
  channel      TEXT NOT NULL,   -- email | whatsapp | in-app
  scheduled_at TEXT,
  status       TEXT NOT NULL,   -- scheduled | sent | draft
  read_flag    INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT
);

CREATE TABLE IF NOT EXISTS renewal_setting (
  id            TEXT PRIMARY KEY,
  org_id        TEXT NOT NULL REFERENCES organisation(id),
  days_before   INTEGER NOT NULL,
  channel       TEXT NOT NULL,
  template      TEXT,
  enabled       INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS commission_rate (
  id           TEXT PRIMARY KEY,
  org_id       TEXT NOT NULL REFERENCES organisation(id),
  principal_id TEXT NOT NULL REFERENCES principal(id),
  class        TEXT NOT NULL,
  rate         REAL NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_policy_org     ON policy(org_id);
CREATE INDEX IF NOT EXISTS idx_policy_client  ON policy(client_id);
CREATE INDEX IF NOT EXISTS idx_policy_created ON policy(created_date);
CREATE INDEX IF NOT EXISTS idx_payment_policy ON payment(policy_id);
CREATE INDEX IF NOT EXISTS idx_client_org     ON client(org_id);
`;

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;

  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const db = new Database(DB_PATH);
  db.exec(SCHEMA);

  const seeded = db.prepare('SELECT COUNT(*) AS n FROM organisation').get() as { n: number };
  if (seeded.n === 0) {
    seed(db);
  }

  _db = db;
  return db;
}
