'use server';

import { revalidatePath } from 'next/cache';
import { authorise } from './guard';
import { audit } from './audit';
import { hashPassword } from './auth';
import { passwordProblem } from './passwords';
import { ADMIN } from './permissions';
import {
  getAppUser, createAppUser, setAppUserStatus, setAppUserPassword,
  findAppUserByEmail, activeUserCount,
} from './queries';

export type AccountState = {
  ok?: boolean;
  error?: string;
  message?: string;
  /** Echoed so a refused form is not emptied by React's reset. */
  values?: { name: string; email: string };
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * The accounts that can sign in, managed from inside the application.
 *
 * Until this the only accounts were the seeded demo ones, whose passwords are
 * in the repository, and the only way to add a real account or retire a demo
 * one was a shell on the server. "Delete the demo accounts before go-live"
 * is advice nobody can follow without a way to do it; this is the way.
 */
export async function addAccountAction(_prev: unknown, fd: FormData): Promise<AccountState> {
  const guard = await authorise({ action: 'account.create', entity: 'app_user' });
  if (!guard.ok) return { error: guard.message };
  const user = guard.user;

  const name = String(fd.get('name') ?? '').trim();
  const email = String(fd.get('email') ?? '').trim().toLowerCase();
  const password = String(fd.get('password') ?? '');
  const confirm = String(fd.get('confirm') ?? '');
  const values = { name, email };
  const refuse = (error: string): AccountState => ({ error, values });

  if (!name) return refuse('Give the account a name — the person, as it will appear on the audit trail.');
  if (!EMAIL.test(email)) return refuse('That is not an email address.');
  if (findAppUserByEmail(email)) return refuse('An account with that email already exists.');
  const problem = passwordProblem(password);
  if (problem) return refuse(problem);
  if (password !== confirm) return refuse('The password and its confirmation do not match.');

  const id = createAppUser({
    org_id: user.org_id, email, name, role: ADMIN, password_hash: hashPassword(password),
  });
  await audit(user, {
    action: 'account.create', entity: 'app_user', entityId: id, entityLabel: name,
    summary: `Sign-in account created for ${name} (${email}).`,
  });

  revalidatePath('/team');
  return { ok: true, message: `${name} can sign in now with ${email}.` };
}

/** Disable or re-enable an account. Never your own, never the last one. */
export async function setAccountStatusAction(_prev: unknown, fd: FormData): Promise<AccountState> {
  const id = String(fd.get('id') ?? '');
  const to = String(fd.get('status') ?? '') === 'active' ? 'active' : 'disabled';
  const guard = await authorise({ action: `account.${to === 'active' ? 'enable' : 'disable'}`, entity: 'app_user', entityId: id });
  if (!guard.ok) return { error: guard.message };
  const user = guard.user;

  const target = getAppUser(id, user.org_id);
  if (!target) return { error: 'That account is not in your agency.' };

  if (to === 'disabled') {
    if (target.id === user.id) {
      return { error: 'You cannot disable the account you are signed in with. Ask another administrator to.' };
    }
    if (target.status === 'active' && activeUserCount(user.org_id) <= 1) {
      return { error: 'That is the last active account in the agency. Add another before disabling it.' };
    }
  }

  setAppUserStatus(id, user.org_id, to);
  await audit(user, {
    action: `account.${to === 'active' ? 'enable' : 'disable'}`, entity: 'app_user', entityId: id, entityLabel: target.name,
    summary: to === 'active'
      ? `${target.name} (${target.email}) can sign in again.`
      : `${target.name} (${target.email}) can no longer sign in. Any session they hold ends at their next request.`,
    changes: { status: [target.status, to] },
  });

  revalidatePath('/team');
  return { ok: true, message: to === 'active' ? `${target.name} re-enabled.` : `${target.name} disabled.` };
}

/** Set another account's password — the reset a locked-out colleague needs. */
export async function resetPasswordAction(_prev: unknown, fd: FormData): Promise<AccountState> {
  const id = String(fd.get('id') ?? '');
  const guard = await authorise({ action: 'account.reset_password', entity: 'app_user', entityId: id });
  if (!guard.ok) return { error: guard.message };
  const user = guard.user;

  const target = getAppUser(id, user.org_id);
  if (!target) return { error: 'That account is not in your agency.' };

  const password = String(fd.get('password') ?? '');
  const confirm = String(fd.get('confirm') ?? '');
  const problem = passwordProblem(password);
  if (problem) return { error: problem };
  if (password !== confirm) return { error: 'The password and its confirmation do not match.' };

  setAppUserPassword(id, user.org_id, hashPassword(password));
  await audit(user, {
    action: 'account.reset_password', entity: 'app_user', entityId: id, entityLabel: target.name,
    summary: `${user.name} set a new password for ${target.name} (${target.email}).`,
  });

  revalidatePath('/team');
  return { ok: true, message: `New password set for ${target.name}. Tell them in person, not by email.` };
}
