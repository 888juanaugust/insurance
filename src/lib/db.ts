import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { seed } from './seed';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_PATH = process.env.IH_DB ?? path.join(DATA_DIR, 'insurhelp.db');

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
  named_users    INTEGER,
  logo_url       TEXT,
  phone2         TEXT,
  email2         TEXT,
  website        TEXT,
  former_name    TEXT,
  bank_name      TEXT,
  bank_account_name TEXT,
  bank_account_number TEXT,
  remark1        TEXT,
  remark2        TEXT,
  loc_prefix     TEXT,
  pos_prefix     TEXT,
  invoice_template TEXT
);

CREATE TABLE IF NOT EXISTS app_user (
  id            TEXT PRIMARY KEY,
  org_id        TEXT NOT NULL REFERENCES organisation(id),
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name          TEXT NOT NULL,
  role          TEXT NOT NULL,          -- admin (the agency application) | client (the portal)
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
  created_at     TEXT,
  -- Portal access. The code is hashed like a password: an agency that reads
  -- its own database still should not be able to sign in as a client.
  portal_code_hash TEXT,
  portal_code_set  TEXT,
  portal_last_seen TEXT
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
  referral_fee    REAL NOT NULL DEFAULT 0,
  agent_commission REAL NOT NULL DEFAULT 0,
  consultant_commission REAL NOT NULL DEFAULT 0,
  loc_no          TEXT,
  renewed_from_policy_id TEXT REFERENCES policy(id) ON DELETE SET NULL,
  uploaded_at     TEXT,
  source_file     TEXT,
  remarks         TEXT
);

CREATE TABLE IF NOT EXISTS policy_document (
  id            TEXT PRIMARY KEY,
  org_id        TEXT NOT NULL REFERENCES organisation(id),
  policy_id     TEXT REFERENCES policy(id) ON DELETE SET NULL,
  filename      TEXT NOT NULL,
  byte_size     INTEGER NOT NULL DEFAULT 0,
  page_count    INTEGER NOT NULL DEFAULT 0,
  principal_detected TEXT,
  used_claude   INTEGER NOT NULL DEFAULT 0,
  field_count   INTEGER NOT NULL DEFAULT 0,
  warnings      TEXT,
  extracted_json TEXT,
  uploaded_by   TEXT,
  uploaded_at   TEXT NOT NULL,
  -- The file itself lives on disk under this key; the row is the index into it.
  storage_key   TEXT,
  content_type  TEXT,
  sha256        TEXT,
  kind          TEXT,          -- schedule | cover_note | receipt | endorsement | correspondence | other
  note          TEXT,
  claim_id      TEXT REFERENCES claim(id) ON DELETE CASCADE
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
  class_of_business TEXT,
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

CREATE TABLE IF NOT EXISTS billing_profile (
  user_id                 TEXT PRIMARY KEY REFERENCES app_user(id) ON DELETE CASCADE,
  name                    TEXT,
  person_name             TEXT,
  tin_number              TEXT,
  brn                     TEXT,
  nric_number             TEXT,
  state                   TEXT,
  city                    TEXT,
  postal_code             TEXT,
  address_line0           TEXT,
  address_line1           TEXT,
  address_line2           TEXT,
  country                 TEXT,
  email                   TEXT,
  contact                 TEXT,
  sst_registration_number TEXT
);

CREATE TABLE IF NOT EXISTS quotation (
  id           TEXT PRIMARY KEY,
  org_id       TEXT NOT NULL REFERENCES organisation(id),
  client_id    TEXT NOT NULL REFERENCES client(id),
  principal_id TEXT NOT NULL REFERENCES principal(id),
  policy_id    TEXT REFERENCES policy(id) ON DELETE SET NULL,
  quote_no     TEXT NOT NULL,
  class        TEXT NOT NULL,          -- motor | non_motor
  product      TEXT,
  status       TEXT NOT NULL,          -- draft | sent | accepted | rejected | converted
  total_payable REAL NOT NULL DEFAULT 0,
  valid_until  TEXT,
  created_at   TEXT,
  updated_at   TEXT,
  note         TEXT
);

CREATE TABLE IF NOT EXISTS renewal_request (
  id           TEXT PRIMARY KEY,
  org_id       TEXT NOT NULL REFERENCES organisation(id),
  policy_id    TEXT NOT NULL REFERENCES policy(id) ON DELETE CASCADE,
  status       TEXT NOT NULL,          -- inbox | processing | rejected | completed
  source       TEXT NOT NULL,          -- home | client portal | agent | scheduler
  requested_at TEXT NOT NULL,
  note         TEXT
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
  enabled       INTEGER NOT NULL DEFAULT 1,
  name          TEXT,
  subject       TEXT
);

CREATE TABLE IF NOT EXISTS message (
  id            TEXT PRIMARY KEY,
  org_id        TEXT NOT NULL REFERENCES organisation(id),
  client_id     TEXT REFERENCES client(id) ON DELETE SET NULL,
  policy_id     TEXT REFERENCES policy(id) ON DELETE SET NULL,
  kind          TEXT NOT NULL,   -- renewal_notice | …
  channel       TEXT NOT NULL,   -- whatsapp | email | sms
  to_address    TEXT,
  subject       TEXT,
  body          TEXT NOT NULL,
  status        TEXT NOT NULL,   -- queued | sent | failed | cancelled
  attempts      INTEGER NOT NULL DEFAULT 0,
  error         TEXT,
  /* How it went out. 'manual' means an agent copied it and sent it themselves,
     which is what a small agency does before wiring up a provider. */
  delivered_by  TEXT,
  scheduled_for TEXT,
  sent_at       TEXT,
  created_at    TEXT NOT NULL,
  /* One notice per policy per reminder cycle. The generator runs daily and
     must not send the same thing twice. */
  dedupe_key    TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_message_dedupe ON message(dedupe_key);
CREATE INDEX IF NOT EXISTS idx_message_org ON message(org_id, status, scheduled_for);

CREATE TABLE IF NOT EXISTS commission_statement (
  id            TEXT PRIMARY KEY,
  org_id        TEXT NOT NULL REFERENCES organisation(id),
  principal_id  TEXT NOT NULL REFERENCES principal(id),
  reference     TEXT NOT NULL,        -- the insurer's own statement number
  period_start  TEXT NOT NULL,
  period_end    TEXT NOT NULL,
  statement_date TEXT,
  filename      TEXT,
  /* What the insurer said it paid — the sum of the file, and the one figure
     here that never changes. */
  total_paid    REAL NOT NULL DEFAULT 0,
  /* What the book says it owed. Recomputed whenever a line is moved by hand,
     so the total on the list and the lines on the detail can never tell the
     agency two different stories about the same statement. */
  total_expected REAL NOT NULL DEFAULT 0,
  line_count    INTEGER NOT NULL DEFAULT 0,
  status        TEXT NOT NULL,        -- open | settled
  imported_by   TEXT,
  imported_at   TEXT NOT NULL,
  settled_at    TEXT,
  note          TEXT
);

CREATE TABLE IF NOT EXISTS statement_line (
  id            TEXT PRIMARY KEY,
  org_id        TEXT NOT NULL REFERENCES organisation(id),
  statement_id  TEXT NOT NULL REFERENCES commission_statement(id) ON DELETE CASCADE,
  row_no        INTEGER NOT NULL,     -- the line in the file it came from

  -- As it appears on the insurer's paper, kept verbatim.
  policy_no     TEXT,
  cover_note_no TEXT,
  insured       TEXT,
  vehicle_no    TEXT,
  effective_date TEXT,
  gross_premium REAL,
  commission_rate REAL,
  commission    REAL NOT NULL DEFAULT 0,
  reference     TEXT,

  -- What it was matched to, and how sure that is.
  policy_id     TEXT REFERENCES policy(id) ON DELETE SET NULL,
  basis         TEXT NOT NULL,        -- policy_no | cover_note | vehicle | manual | none
  /* Set when an agent has ruled on the line by hand. A re-match must not
     overwrite a person's decision with a guess. */
  decided       INTEGER NOT NULL DEFAULT 0,
  /* An agreed difference: the agency has looked and accepted the insurer's
     figure. Kept apart from a match so the reason survives. */
  accepted      INTEGER NOT NULL DEFAULT 0,
  accepted_note TEXT
);

CREATE INDEX IF NOT EXISTS idx_statement_org  ON commission_statement(org_id, period_end DESC);
CREATE INDEX IF NOT EXISTS idx_stmt_line      ON statement_line(statement_id, row_no);
CREATE INDEX IF NOT EXISTS idx_stmt_line_pol  ON statement_line(policy_id);

CREATE TABLE IF NOT EXISTS follow_up (
  id         TEXT PRIMARY KEY,
  org_id     TEXT NOT NULL REFERENCES organisation(id),
  policy_id  TEXT NOT NULL REFERENCES policy(id) ON DELETE CASCADE,
  client_id  TEXT REFERENCES client(id) ON DELETE SET NULL,
  at         TEXT NOT NULL,          -- the day the conversation happened
  outcome    TEXT NOT NULL,          -- reached | no_answer | quoted | callback | not_renewing
  note       TEXT,
  /* When to raise it again. A client who says "ring me after payday" should
     drop off today's list and come back on its own, not be chased tomorrow
     and annoyed. */
  next_at    TEXT,
  by_user    TEXT,
  /* Denormalised for the same reason the audit trail does it: "(deleted
     user) spoke to the client" has lost the point of writing it down. */
  by_name    TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_followup_policy ON follow_up(policy_id, at DESC);
CREATE INDEX IF NOT EXISTS idx_followup_org    ON follow_up(org_id, next_at);

CREATE TABLE IF NOT EXISTS commission_rate (
  id           TEXT PRIMARY KEY,
  org_id       TEXT NOT NULL REFERENCES organisation(id),
  principal_id TEXT NOT NULL REFERENCES principal(id),
  class        TEXT NOT NULL,
  rate         REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS endorsement (
  id             TEXT PRIMARY KEY,
  org_id         TEXT NOT NULL REFERENCES organisation(id),
  policy_id      TEXT NOT NULL REFERENCES policy(id) ON DELETE CASCADE,
  endorsement_no TEXT NOT NULL,
  insurer_ref    TEXT,
  type           TEXT NOT NULL,   -- vehicle_change | sum_insured | named_driver | extension | …
  status         TEXT NOT NULL,   -- draft | submitted | issued | cancelled
  effective_date TEXT NOT NULL,
  description    TEXT,

  -- The change in ANNUAL premium the endorsement causes. The charged figure is
  -- worked out from it and the unexpired period, so both are kept: the second
  -- cannot be re-derived once the policy is renewed or altered again.
  annual_difference REAL NOT NULL DEFAULT 0,
  basis          TEXT,            -- pro_rata | short_period | nil
  days_on_risk   INTEGER NOT NULL DEFAULT 0,
  days_unexpired INTEGER NOT NULL DEFAULT 0,
  cover_days     INTEGER NOT NULL DEFAULT 0,

  gross_amount   REAL NOT NULL DEFAULT 0,   -- negative for a return premium
  service_tax    REAL NOT NULL DEFAULT 0,
  stamp_duty     REAL NOT NULL DEFAULT 0,
  total_amount   REAL NOT NULL DEFAULT 0,

  issued_date    TEXT,
  remarks        TEXT,
  created_at     TEXT NOT NULL,
  updated_at     TEXT
);

CREATE INDEX IF NOT EXISTS idx_endorsement_org    ON endorsement(org_id, status);
CREATE INDEX IF NOT EXISTS idx_endorsement_policy ON endorsement(policy_id);

CREATE TABLE IF NOT EXISTS claim (
  id              TEXT PRIMARY KEY,
  org_id          TEXT NOT NULL REFERENCES organisation(id),
  policy_id       TEXT NOT NULL REFERENCES policy(id) ON DELETE CASCADE,
  claim_no        TEXT NOT NULL,          -- the agency's reference
  insurer_claim_no TEXT,                  -- the one the insurer assigns later
  type            TEXT NOT NULL,          -- own_damage | third_party | theft | windscreen | flood | act_of_god | other
  status          TEXT NOT NULL,          -- notified | documents | submitted | surveyed | approved | repairing | settled | rejected | withdrawn
  fault           TEXT,                   -- own | third_party | shared | undetermined

  incident_date   TEXT,
  incident_time   TEXT,
  location        TEXT,
  description     TEXT,
  driver_name     TEXT,
  driver_nric     TEXT,
  driver_licence  TEXT,

  -- A police report within 24 hours is a condition of the policy in Malaysia.
  police_report_no   TEXT,
  police_report_date TEXT,
  police_station     TEXT,

  workshop        TEXT,
  workshop_panel  INTEGER NOT NULL DEFAULT 1,   -- panel workshops avoid betterment
  adjuster        TEXT,
  survey_date     TEXT,

  estimate_amount REAL NOT NULL DEFAULT 0,
  approved_amount REAL NOT NULL DEFAULT 0,
  settled_amount  REAL NOT NULL DEFAULT 0,
  excess_borne    REAL NOT NULL DEFAULT 0,

  -- An own-damage claim normally resets the no-claim discount at renewal.
  affects_ncd     INTEGER NOT NULL DEFAULT 1,

  notified_date   TEXT,
  submitted_date  TEXT,
  settled_date    TEXT,
  closed_reason   TEXT,
  remarks         TEXT,
  created_at      TEXT NOT NULL,
  updated_at      TEXT
);

CREATE INDEX IF NOT EXISTS idx_claim_org    ON claim(org_id, status);
CREATE INDEX IF NOT EXISTS idx_claim_policy ON claim(policy_id);

CREATE TABLE IF NOT EXISTS audit_event (
  id         TEXT PRIMARY KEY,
  org_id     TEXT NOT NULL REFERENCES organisation(id),
  at         TEXT NOT NULL,          -- ISO 8601, UTC
  -- The actor is denormalised on purpose. An audit trail that reads
  -- "(deleted user) approved RM 4,200" has lost the thing it exists to
  -- record, so the name and role are kept as they stood at the time.
  user_id    TEXT,
  user_name  TEXT NOT NULL,
  user_role  TEXT NOT NULL,
  action     TEXT NOT NULL,          -- policy.create, commission.approve, …
  entity     TEXT NOT NULL,          -- policy | client | commission | …
  entity_id  TEXT,
  entity_label TEXT,                 -- policy number, client name, …
  outcome    TEXT NOT NULL,          -- ok | denied | refused
  summary    TEXT NOT NULL,
  changes    TEXT,                   -- JSON: { field: [before, after] }
  ip         TEXT
);

CREATE INDEX IF NOT EXISTS idx_audit_org  ON audit_event(org_id, at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_event(user_id);
CREATE INDEX IF NOT EXISTS idx_policy_org     ON policy(org_id);
CREATE INDEX IF NOT EXISTS idx_policy_client  ON policy(client_id);
CREATE INDEX IF NOT EXISTS idx_policy_created ON policy(created_date);
CREATE INDEX IF NOT EXISTS idx_payment_policy ON payment(policy_id);
CREATE INDEX IF NOT EXISTS idx_client_org     ON client(org_id);
`;

/**
 * CREATE TABLE IF NOT EXISTS leaves existing tables alone, so columns added
 * after a database was first created have to be applied by hand.
 */
function migrate(db: Database.Database) {
  const columns = new Set(
    (db.prepare('PRAGMA table_info(policy)').all() as { name: string }[]).map((c) => c.name),
  );
  const added: [string, string][] = [
    ['referral_fee', 'REAL NOT NULL DEFAULT 0'],
    ['agent_commission', 'REAL NOT NULL DEFAULT 0'],
    ['uploaded_at', 'TEXT'],
    ['source_file', 'TEXT'],
    ['consultant_commission', 'REAL NOT NULL DEFAULT 0'],
    ['loc_no', 'TEXT'],
  ];
  for (const [name, decl] of added) {
    if (!columns.has(name)) db.exec(`ALTER TABLE policy ADD COLUMN ${name} ${decl}`);
  }

  const orgColumns = new Set(
    (db.prepare('PRAGMA table_info(organisation)').all() as { name: string }[]).map((c) => c.name),
  );
  for (const [name, decl] of [
    ['logo_url', 'TEXT'], ['phone2', 'TEXT'], ['email2', 'TEXT'], ['website', 'TEXT'],
    ['former_name', 'TEXT'], ['bank_name', 'TEXT'], ['bank_account_name', 'TEXT'],
    ['bank_account_number', 'TEXT'], ['remark1', 'TEXT'], ['remark2', 'TEXT'],
    ['loc_prefix', 'TEXT'], ['pos_prefix', 'TEXT'], ['invoice_template', 'TEXT'],
  ] as [string, string][]) {
    if (!orgColumns.has(name)) db.exec(`ALTER TABLE organisation ADD COLUMN ${name} ${decl}`);
  }

  const nmColumns = new Set(
    (db.prepare('PRAGMA table_info(non_motor_detail)').all() as { name: string }[]).map((c) => c.name),
  );
  if (!nmColumns.has('class_of_business')) {
    db.exec('ALTER TABLE non_motor_detail ADD COLUMN class_of_business TEXT');
  }

  /*
   * Insurhelp used to grade users as master / manager / finance / agent /
   * viewer. It now has one role, admin, and any other value grants nothing —
   * so a database written before this change would lock every one of its
   * users out of the application on the next start. Everyone who already had
   * a working account keeps one.
   *
   * `client` is left alone: it is the role the (unbuilt) client portal will
   * use, and those accounts were never meant to reach the agency screens.
   */
  const policyRenewCols = new Set(
    (db.prepare('PRAGMA table_info(policy)').all() as { name: string }[]).map((c) => c.name),
  );
  // Which policy this one renewed. Without it there is no way to tell a policy
  // that lapsed from one that was renewed elsewhere in the book, and no
  // retention rate can be computed at all.
  if (!policyRenewCols.has('renewed_from_policy_id')) {
    db.exec('ALTER TABLE policy ADD COLUMN renewed_from_policy_id TEXT');
  }

  const settingCols = new Set(
    (db.prepare('PRAGMA table_info(renewal_setting)').all() as { name: string }[]).map((c) => c.name),
  );
  for (const [name, decl] of [['name', 'TEXT'], ['subject', 'TEXT']] as [string, string][]) {
    if (!settingCols.has(name)) db.exec(`ALTER TABLE renewal_setting ADD COLUMN ${name} ${decl}`);
  }

  const clientColumns = new Set(
    (db.prepare('PRAGMA table_info(client)').all() as { name: string }[]).map((c) => c.name),
  );
  for (const [name, decl] of [
    ['portal_code_hash', 'TEXT'], ['portal_code_set', 'TEXT'], ['portal_last_seen', 'TEXT'],
  ] as [string, string][]) {
    if (!clientColumns.has(name)) db.exec(`ALTER TABLE client ADD COLUMN ${name} ${decl}`);
  }

  const docColumns = new Set(
    (db.prepare('PRAGMA table_info(policy_document)').all() as { name: string }[]).map((c) => c.name),
  );
  for (const [name, decl] of [
    ['storage_key', 'TEXT'], ['content_type', 'TEXT'], ['sha256', 'TEXT'],
    ['kind', 'TEXT'], ['note', 'TEXT'], ['claim_id', 'TEXT'],
  ] as [string, string][]) {
    if (!docColumns.has(name)) db.exec(`ALTER TABLE policy_document ADD COLUMN ${name} ${decl}`);
  }

  const legacyRoles = ['master', 'manager', 'finance', 'agent', 'viewer'];
  const stale = db
    .prepare(
      `SELECT COUNT(*) n FROM app_user WHERE role IN (${legacyRoles.map(() => '?').join(',')})`,
    )
    .get(...legacyRoles) as { n: number };
  if (stale.n > 0) {
    db.prepare(
      `UPDATE app_user SET role = 'admin' WHERE role IN (${legacyRoles.map(() => '?').join(',')})`,
    ).run(...legacyRoles);
    console.log(`Insurhelp: moved ${stale.n} user${stale.n === 1 ? '' : 's'} to the admin role.`);
  }
}

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;

  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const db = new Database(DB_PATH);
  db.exec(SCHEMA);

  migrate(db);

  const seeded = db.prepare('SELECT COUNT(*) AS n FROM organisation').get() as { n: number };
  if (seeded.n === 0) {
    seed(db);
  }

  _db = db;
  return db;
}
