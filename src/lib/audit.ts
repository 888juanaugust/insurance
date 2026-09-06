import crypto from 'node:crypto';
import { clientIp } from './request';
import { getDb } from './db';
import type { SessionUser } from './session';

export type AuditOutcome = 'ok' | 'denied' | 'refused';

export type AuditEntry = {
  action: string;
  entity: string;
  entityId?: string | null;
  entityLabel?: string | null;
  summary: string;
  outcome?: AuditOutcome;
  changes?: Record<string, [unknown, unknown]> | null;
};

/**
 * Only what actually moved. Storing the whole record on every save buries the
 * one field someone changed under thirty that stayed the same, which is how
 * an audit trail stops being read.
 */
export function diff(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  fields?: string[],
): Record<string, [unknown, unknown]> {
  const keys = fields ?? [...new Set([...Object.keys(before), ...Object.keys(after)])];
  const out: Record<string, [unknown, unknown]> = {};
  for (const key of keys) {
    const a = before[key] ?? '';
    const b = after[key] ?? '';
    // Loose compare: a form posts "10" where the column holds 10, and that is
    // not a change anyone wants logged.
    if (String(a) !== String(b)) out[key] = [before[key] ?? null, after[key] ?? null];
  }
  return out;
}

async function callerIp(): Promise<string | null> {
  // Outside a request (a script, a test) there are no headers, and a missing
  // address must never cost the entry itself — clientIp returns null then.
  return clientIp();
}

/**
 * Records one event. Never throws: an audit trail that can fail a save would
 * make the application less reliable than having no trail at all, so a broken
 * write is logged to the server and swallowed.
 */
export async function audit(
  user: Pick<SessionUser, 'id' | 'org_id' | 'name' | 'role'>,
  entry: AuditEntry,
): Promise<void> {
  try {
    const changes = entry.changes && Object.keys(entry.changes).length ? JSON.stringify(entry.changes) : null;
    getDb()
      .prepare(
        `INSERT INTO audit_event
           (id, org_id, at, user_id, user_name, user_role, action, entity, entity_id,
            entity_label, outcome, summary, changes, ip)
         VALUES
           (@id, @org_id, @at, @user_id, @user_name, @user_role, @action, @entity, @entity_id,
            @entity_label, @outcome, @summary, @changes, @ip)`,
      )
      .run({
        id: `aud-${crypto.randomUUID()}`,
        org_id: user.org_id,
        at: new Date().toISOString(),
        user_id: user.id,
        user_name: user.name,
        user_role: user.role,
        action: entry.action,
        entity: entry.entity,
        entity_id: entry.entityId ?? null,
        entity_label: entry.entityLabel ?? null,
        outcome: entry.outcome ?? 'ok',
        summary: entry.summary,
        changes,
        ip: await callerIp(),
      });
  } catch (err) {
    console.error('audit write failed', entry.action, err);
  }
}

/**
 * A sign-in attempt has no session yet, and a failed one has no user at all —
 * which is exactly the event worth keeping.
 */
export async function auditAuth(
  orgId: string,
  actor: { id: string | null; name: string; role: string },
  action: 'auth.login' | 'auth.login_failed' | 'auth.logout',
  summary: string,
): Promise<void> {
  await audit(
    { id: actor.id ?? '', org_id: orgId, name: actor.name, role: actor.role },
    { action, entity: 'session', entityId: actor.id, summary, outcome: action === 'auth.login_failed' ? 'refused' : 'ok' },
  );
}
