'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { authorise, forbid } from './guard';
import { audit } from './audit';
import { getUser, setUserRole, countMasters } from './queries';
import { ROLE_LABEL, isRole, type Role } from './permissions';

const USERS = '/team/users';

function back(message?: string): never {
  redirect(message ? `${USERS}?msg=${encodeURIComponent(message)}` : USERS);
}

export async function setUserRoleAction(fd: FormData) {
  const id = String(fd.get('user_id') ?? '');
  const role = String(fd.get('role') ?? '');

  const guard = await authorise('user.manage', { action: 'user.role', entity: 'app_user', entityId: id });
  if (!guard.ok) forbid(guard.message);
  const actor = guard.user;

  if (!id || !isRole(role)) back('That is not a role Insurhelp knows.');

  const target = getUser(id, actor.org_id);
  if (!target) back('That user is not in your organisation.');
  if (target.role === role) back();

  // Removing the last Master would leave nobody able to grant the role back —
  // every screen that could is behind the permission only a Master holds. The
  // organisation would be locked out of its own settings for good.
  if (target.role === 'master' && role !== 'master' && countMasters(actor.org_id, id) === 0) {
    await audit(actor, {
      action: 'user.role', entity: 'app_user', entityId: id, entityLabel: target.name,
      outcome: 'refused',
      summary: `Refused to change ${target.name} from Master — the only one left, and nobody could grant it back.`,
    });
    back(`${target.name} is the only Master. Promote someone else first, or the agency locks itself out of its own settings.`);
  }

  setUserRole(id, actor.org_id, role);
  await audit(actor, {
    action: 'user.role', entity: 'app_user', entityId: id, entityLabel: target.name,
    summary: `${target.name} changed from ${label(target.role)} to ${ROLE_LABEL[role as Role]}.`,
    changes: { role: [target.role, role] },
  });
  revalidatePath(USERS);
  back(`${target.name} is now ${ROLE_LABEL[role as Role]}.`);
}

function label(role: string): string {
  return isRole(role) ? ROLE_LABEL[role] : role;
}
