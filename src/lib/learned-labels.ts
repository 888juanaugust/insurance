import crypto from 'node:crypto';
import { getDb } from './db';
import { TRUST_AFTER, type LearnedLabel, type NewLabel } from './extract/learned';

/**
 * Where learned labels live: one row per agency, insurer, field and label.
 *
 * Per agency, because the documents are the agency's and so is what they
 * taught. Learning the same pairing again does not add a row — it counts
 * the document, and that count is what promotes a label from provisional
 * to trusted (see extract/learned.ts).
 */
const UNKNOWN = 'UNKNOWN';

type Row = {
  insurer: string; field_key: string; label: string; placement: 'same' | 'below'; seen: number;
};

export function listLearnedLabels(orgId: string, insurer: string | null): LearnedLabel[] {
  const rows = getDb()
    .prepare(
      `SELECT insurer, field_key, label, placement, seen FROM learned_label
        WHERE org_id = ? AND insurer = ? ORDER BY seen DESC, last_seen DESC`,
    )
    .all(orgId, insurer ?? UNKNOWN) as Row[];
  return rows.map((r) => ({
    insurer: r.insurer, key: r.field_key as LearnedLabel['key'], label: r.label, placement: r.placement, seen: r.seen,
  }));
}

/** Learn (or confirm) what one saved document taught. */
export function recordLearnedLabels(
  orgId: string, insurer: string | null, labels: NewLabel[],
): { added: number; confirmed: number } {
  const db = getDb();
  const now = new Date().toISOString();
  const upsert = db.prepare(
    `INSERT INTO learned_label (id, org_id, insurer, field_key, label, placement, seen, created_at, last_seen)
     VALUES (@id, @org_id, @insurer, @field_key, @label, @placement, 1, @now, @now)
     ON CONFLICT(org_id, insurer, field_key, label, placement)
     DO UPDATE SET seen = seen + 1, last_seen = @now`,
  );
  const existing = db.prepare(
    'SELECT 1 FROM learned_label WHERE org_id = ? AND insurer = ? AND field_key = ? AND label = ? AND placement = ?',
  );
  let added = 0;
  let confirmed = 0;
  const run = db.transaction(() => {
    for (const l of labels) {
      const was = existing.get(orgId, insurer ?? UNKNOWN, l.key, l.label, l.placement);
      upsert.run({
        id: crypto.randomUUID(), org_id: orgId, insurer: insurer ?? UNKNOWN,
        field_key: l.key, label: l.label, placement: l.placement, now,
      });
      if (was) confirmed++;
      else added++;
    }
  });
  run();
  return { added, confirmed };
}

/** What has been learned so far, for the settings screen. */
export function learnedLabelSummary(orgId: string): Array<{ insurer: string; labels: number; trusted: number }> {
  return getDb()
    .prepare(
      `SELECT insurer, COUNT(*) AS labels, SUM(CASE WHEN seen >= ? THEN 1 ELSE 0 END) AS trusted
         FROM learned_label WHERE org_id = ? GROUP BY insurer ORDER BY labels DESC`,
    )
    .all(TRUST_AFTER, orgId) as Array<{ insurer: string; labels: number; trusted: number }>;
}
