import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import Database from 'better-sqlite3';
import { multiTenant, tenantsRoot } from './tenant';
import { TRUST_ACROSS, type LearnedLabel, type NewLabel, type SharedLabel } from './extract/learned';

/**
 * The shared label library: what every agency on this server has taught the
 * document reader, pooled.
 *
 * A label is the text printed beside a value on an insurer's schedule —
 * "No. Sijil Insurans", "Jumlah Perlu Dibayar" — and nothing else: no
 * client, no policy number, no premium is in here. So it is the one thing an
 * agency's saved documents produce that can be shared without sharing
 * anything of the agency's, and pooling it means a new agency reads every
 * insurer the others already taught from its very first upload.
 *
 * It lives in its own SQLite file beside the agencies, not in any agency's
 * database and not in the landlord's: every agency process writes to it and
 * reads from it, and the landlord's console curates it. SQLite's own locking
 * handles the many writers; WAL and a busy timeout keep them from tripping
 * over each other.
 *
 * Trust is by AGENCY, not by document. One agency can confirm a label to
 * itself with two of its own documents (see learned-labels.ts); for everyone
 * else the label stays provisional — used, but with the model still checking
 * — until a SECOND agency has taught the same pairing. A wrong correction at
 * one agency is then read as a suggestion by the others, never as a fact.
 *
 * A label the landlord removes stays in the table, marked: it is not served,
 * and an agency teaching it again does not bring it back. What the landlord
 * has judged wrong should not be voted back in by the mistake recurring.
 */
const SCHEMA = `
CREATE TABLE IF NOT EXISTS shared_label (
  id          TEXT PRIMARY KEY,
  insurer     TEXT NOT NULL,        -- as detectInsurer names it, or UNKNOWN
  field_key   TEXT NOT NULL,
  label       TEXT NOT NULL,
  placement   TEXT NOT NULL,        -- same | below
  created_at  TEXT NOT NULL,
  removed_at  TEXT,                 -- set by the landlord; not served while set
  removed_by  TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_shared_label ON shared_label(insurer, field_key, label, placement);

-- Which agencies taught each label, and how many of their documents did.
CREATE TABLE IF NOT EXISTS shared_label_source (
  label_id    TEXT NOT NULL REFERENCES shared_label(id) ON DELETE CASCADE,
  agency      TEXT NOT NULL,
  seen        INTEGER NOT NULL DEFAULT 1,
  first_seen  TEXT NOT NULL,
  last_seen   TEXT NOT NULL,
  PRIMARY KEY (label_id, agency)
);
`;

const UNKNOWN = 'UNKNOWN';

export function sharedLabelsPath(): string {
  return path.join(tenantsRoot(), 'shared-labels.db');
}

let cached: { path: string; db: Database.Database } | null = null;

/** The library, or null on a single-agency install, where there is nobody to share with. */
export function sharedStore(): Database.Database | null {
  if (!multiTenant()) return null;
  const file = sharedLabelsPath();
  if (cached && cached.path === file) return cached.db;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file, { timeout: 5000 });
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA);
  cached = { path: file, db };
  return db;
}

/** Tests move the tenants directory around; the cache must follow. */
export function closeSharedStore(): void {
  cached?.db.close();
  cached = null;
}

type LabelRow = {
  id: string; insurer: string; field_key: string; label: string; placement: 'same' | 'below';
  seen: number; agencies: number; removed_at: string | null;
};

// A label and its standing: how many documents taught it, at how many agencies.
const COLUMNS = `l.id, l.insurer, l.field_key, l.label, l.placement, l.removed_at,
                 SUM(s.seen) AS seen, COUNT(s.agency) AS agencies`;
const TAUGHT = 'FROM shared_label l JOIN shared_label_source s ON s.label_id = l.id';

/** What the library offers the reader for one insurer: never a removed label, never one nobody taught. */
export function listSharedLabels(insurer: string | null): SharedLabel[] {
  const db = sharedStore();
  if (!db) return [];
  const rows = db
    .prepare(`SELECT ${COLUMNS} ${TAUGHT} WHERE l.insurer = ? AND l.removed_at IS NULL GROUP BY l.id ORDER BY agencies DESC, seen DESC`)
    .all(insurer ?? UNKNOWN) as LabelRow[];
  return rows.map((r) => ({
    insurer: r.insurer, key: r.field_key as LearnedLabel['key'], label: r.label, placement: r.placement,
    seen: r.seen, agencies: r.agencies,
  }));
}

/** What one agency's saved document taught, into the pool under that agency's name. */
export function contributeSharedLabels(agency: string, insurer: string | null, labels: NewLabel[]): void {
  const db = sharedStore();
  if (!db || !labels.length) return;
  const now = new Date().toISOString();
  const find = db.prepare('SELECT id FROM shared_label WHERE insurer = ? AND field_key = ? AND label = ? AND placement = ?');
  const insert = db.prepare(
    'INSERT INTO shared_label (id, insurer, field_key, label, placement, created_at) VALUES (?, ?, ?, ?, ?, ?)',
  );
  const source = db.prepare(
    `INSERT INTO shared_label_source (label_id, agency, seen, first_seen, last_seen) VALUES (?, ?, 1, ?, ?)
     ON CONFLICT(label_id, agency) DO UPDATE SET seen = seen + 1, last_seen = excluded.last_seen`,
  );
  db.transaction(() => {
    for (const l of labels) {
      const ins = insurer ?? UNKNOWN;
      let id = (find.get(ins, l.key, l.label, l.placement) as { id: string } | undefined)?.id;
      if (!id) {
        id = crypto.randomUUID();
        insert.run(id, ins, l.key, l.label, l.placement, now);
      }
      source.run(id, agency, now, now);
    }
  })();
}

/** An agency that is gone taught nothing any more; a label only it taught disappears with it. */
export function forgetAgencyContributions(agency: string): number {
  const db = sharedStore();
  if (!db) return 0;
  const gone = db.prepare('DELETE FROM shared_label_source WHERE agency = ?').run(agency).changes;
  db.prepare('DELETE FROM shared_label WHERE id NOT IN (SELECT label_id FROM shared_label_source)').run();
  return gone;
}

/* ------------------------------------------------------------ the console */

export type LibraryEntry = {
  id: string;
  insurer: string;
  key: LearnedLabel['key'];
  label: string;
  placement: 'same' | 'below';
  /** Documents, all agencies together. */
  seen: number;
  /** The agencies that taught it, by slug. */
  agencies: string[];
  trusted: boolean;
  removedAt: string | null;
  lastSeen: string;
};

/** Everything in the library, removed labels included, for the landlord. */
export function sharedLibrary(): LibraryEntry[] {
  const db = sharedStore();
  if (!db) return [];
  const rows = db
    .prepare(
      `SELECT ${COLUMNS}, GROUP_CONCAT(s.agency, ' ') AS taught_by, MAX(s.last_seen) AS last_seen
       ${TAUGHT} GROUP BY l.id ORDER BY l.insurer, l.field_key, agencies DESC, seen DESC`,
    )
    .all() as Array<LabelRow & { taught_by: string; last_seen: string }>;
  return rows.map((r) => ({
    id: r.id, insurer: r.insurer, key: r.field_key as LearnedLabel['key'], label: r.label, placement: r.placement,
    seen: r.seen, agencies: r.taught_by.split(' ').sort(),
    trusted: r.agencies >= TRUST_ACROSS, removedAt: r.removed_at, lastSeen: r.last_seen,
  }));
}

export function sharedLibraryCounts(): { labels: number; trusted: number; insurers: number; removed: number } {
  const all = sharedLibrary();
  const live = all.filter((l) => !l.removedAt);
  return {
    labels: live.length,
    trusted: live.filter((l) => l.trusted).length,
    insurers: new Set(live.map((l) => l.insurer)).size,
    removed: all.length - live.length,
  };
}

/** The landlord's judgement: not served from now on, and not revived by being taught again. */
export function removeSharedLabel(id: string, by: string): LibraryEntry | null {
  const db = sharedStore();
  if (!db) return null;
  const before = sharedLibrary().find((l) => l.id === id);
  if (!before) return null;
  db.prepare('UPDATE shared_label SET removed_at = ?, removed_by = ? WHERE id = ?').run(new Date().toISOString(), by, id);
  return before;
}

export function restoreSharedLabel(id: string): LibraryEntry | null {
  const db = sharedStore();
  if (!db) return null;
  const before = sharedLibrary().find((l) => l.id === id);
  if (!before) return null;
  db.prepare('UPDATE shared_label SET removed_at = NULL, removed_by = NULL WHERE id = ?').run(id);
  return before;
}
