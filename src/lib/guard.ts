import { redirect } from 'next/navigation';
import { currentUser, type SessionUser } from './session';
import { can, denialMessage, type Permission } from './permissions';
import { audit } from './audit';

export type Guard =
  | { ok: true; user: SessionUser }
  | { ok: false; user: SessionUser; message: string };

/**
 * The single place a mutation asks whether it is allowed. Every refusal is
 * written to the audit trail before it is returned — an attempt that was
 * turned away is exactly what the trail exists to show, and a system that
 * only records successes cannot answer the question anyone asks it.
 */
export async function authorise(
  permission: Permission,
  entry: { action: string; entity: string; entityId?: string | null; entityLabel?: string | null },
): Promise<Guard> {
  const user = await currentUser();
  if (!user) redirect('/login');

  if (can(user.role, permission)) return { ok: true, user };

  const message = denialMessage(user.role, permission);
  await audit(user, {
    action: entry.action,
    entity: entry.entity,
    entityId: entry.entityId,
    entityLabel: entry.entityLabel,
    outcome: 'denied',
    summary: message,
  });
  return { ok: false, user, message };
}

/** For actions with nowhere to return an error to — send them to the page that explains. */
export function forbid(message: string): never {
  redirect(`/forbidden?why=${encodeURIComponent(message)}`);
}

/**
 * Page-level: a route nobody with this role should reach at all.
 *
 * The refusal is recorded like any other. Someone walking the URL space
 * looking for a screen that forgot to check is precisely the behaviour the
 * trail should show, and a page guard that stays silent hides it.
 */
export async function requirePermission(
  permission: Permission,
  entry?: { action?: string; entity?: string },
): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) redirect('/login');
  if (can(user.role, permission)) return user;

  const message = denialMessage(user.role, permission);
  await audit(user, {
    action: entry?.action ?? `${permission}.page`,
    entity: entry?.entity ?? 'page',
    outcome: 'denied',
    summary: message,
  });
  forbid(message);
}
