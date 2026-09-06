import crypto from 'node:crypto';
import { getDb } from './db';

/**
 * Sessions live in the database, not in the cookie.
 *
 * The cookie used to be a signed user id: a value that never expired on the
 * server, that logout did not touch, that a password change did not touch,
 * and that was the same string every time. A copy taken once worked forever.
 * Now the cookie carries a random token; the server holds a row keyed by the
 * token's hash, with an expiry, and deletes it on sign-out, on a password
 * change, and when an account is disabled or a portal code withdrawn. A row
 * that is gone is a session that is over, whatever the browser still holds.
 *
 * Only the hash is stored, so a copy of the database is not a copy of every
 * live session.
 */
export type SessionKind = 'staff' | 'portal';

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/** Opens a session and returns the token for the cookie. */
export function issueSession(
  kind: SessionKind, subjectId: string, orgId: string, ttlSeconds: number, ip: string | null,
): string {
  const token = crypto.randomBytes(32).toString('base64url');
  const now = new Date();
  getDb()
    .prepare(
      `INSERT INTO session (id, kind, subject_id, org_id, created_at, expires_at, last_seen_at, ip)
       VALUES (@id, @kind, @subject_id, @org_id, @created_at, @expires_at, @created_at, @ip)`,
    )
    .run({
      id: hashToken(token), kind, subject_id: subjectId, org_id: orgId,
      created_at: now.toISOString(),
      expires_at: new Date(now.getTime() + ttlSeconds * 1000).toISOString(),
      ip,
    });
  return token;
}

/** The subject behind a token, or null when it is unknown, expired or ended. */
export function resolveSession(kind: SessionKind, token: string): { subject_id: string; org_id: string } | null {
  if (!token) return null;
  const db = getDb();
  const id = hashToken(token);
  const row = db
    .prepare('SELECT subject_id, org_id, expires_at, last_seen_at FROM session WHERE id = ? AND kind = ?')
    .get(id, kind) as { subject_id: string; org_id: string; expires_at: string; last_seen_at: string } | undefined;
  if (!row) return null;

  const now = Date.now();
  if (Date.parse(row.expires_at) <= now) {
    db.prepare('DELETE FROM session WHERE id = ?').run(id);
    return null;
  }
  // Touched at most every few minutes; a write on every request is a write
  // for nothing.
  if (now - Date.parse(row.last_seen_at) > 5 * 60 * 1000) {
    db.prepare('UPDATE session SET last_seen_at = ? WHERE id = ?').run(new Date(now).toISOString(), id);
  }
  return { subject_id: row.subject_id, org_id: row.org_id };
}

export function revokeSession(token: string): void {
  if (!token) return;
  getDb().prepare('DELETE FROM session WHERE id = ?').run(hashToken(token));
}

/** Ends every session a subject holds — optionally sparing the one in hand. */
export function revokeSessionsFor(kind: SessionKind, subjectId: string, exceptToken?: string): number {
  const keep = exceptToken ? hashToken(exceptToken) : '';
  return getDb()
    .prepare('DELETE FROM session WHERE kind = ? AND subject_id = ? AND id != ?')
    .run(kind, subjectId, keep).changes;
}

/** Housekeeping: rows past their expiry. */
export function purgeExpiredSessions(): number {
  return getDb().prepare('DELETE FROM session WHERE expires_at <= ?').run(new Date().toISOString()).changes;
}
