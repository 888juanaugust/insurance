import { redirect } from 'next/navigation';
import { currentUser, type SessionUser } from './session';
import { isAdmin, ACCESS_DENIED } from './permissions';
import { audit } from './audit';

export type Guard =
  | { ok: true; user: SessionUser }
  | { ok: false; user: SessionUser; message: string };

/**
 * The single place a mutation confirms who is asking. Every refusal is written
 * to the audit trail before it is returned — an attempt that was turned away
 * is exactly what the trail exists to show, and a system that records only
 * successes cannot answer the question anyone brings to it.
 */
export async function authorise(entry: {
  action: string;
  entity: string;
  entityId?: string | null;
  entityLabel?: string | null;
}): Promise<Guard> {
  const user = await currentUser();
  if (!user) redirect('/login');

  if (isAdmin(user.role)) return { ok: true, user };

  await audit(user, {
    action: entry.action,
    entity: entry.entity,
    entityId: entry.entityId,
    entityLabel: entry.entityLabel,
    outcome: 'denied',
    summary: `${ACCESS_DENIED} (role on the account: ${user.role || 'none'})`,
  });
  return { ok: false, user, message: ACCESS_DENIED };
}

/** For actions with nowhere to return an error to — send them to the page that explains. */
export function forbid(message: string): never {
  redirect(`/forbidden?why=${encodeURIComponent(message)}`);
}

/**
 * Page-level. The refusal is recorded like any other: someone walking the URL
 * space looking for a screen that forgot to check is precisely the behaviour
 * the trail should show, and a page guard that stays silent hides it.
 */
export async function requireAdmin(entry?: { action?: string; entity?: string }): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) redirect('/login');
  if (isAdmin(user.role)) return user;

  await audit(user, {
    action: entry?.action ?? 'page.view',
    entity: entry?.entity ?? 'page',
    outcome: 'denied',
    summary: `${ACCESS_DENIED} (role on the account: ${user.role || 'none'})`,
  });
  forbid(ACCESS_DENIED);
}
