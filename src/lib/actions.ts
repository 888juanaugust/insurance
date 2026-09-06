'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getDb } from './db';
import { verifyPassword, hashPassword, needsRehash } from './auth';
import { clientIp, safeBack } from './request';
import { createSession, destroySession, currentUser } from './session';
import { checkRate, recordFailure, clearFailures } from './rate-limit';
import {
  setCommissionStatus, recordPayment, getCommissionForOrg, getPaymentForOrg,
} from './queries';
import { authorise, forbid } from './guard';
import { audit, auditAuth } from './audit';
import { money } from './format';

export async function loginAction(_prev: unknown, formData: FormData) {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');

  if (!email || !password) return { error: 'Please enter your email address and password.' };

  // Throttle per address and per email, so neither one account nor one source
  // can be worked through at network speed. The address is the one the proxy
  // vouches for, not one the client wrote into a header.
  const ip = (await clientIp()) ?? 'unknown';
  const keys = [`ip:${ip}`, `email:${email}`];

  for (const key of keys) {
    const verdict = checkRate(key);
    if (!verdict.allowed) {
      const mins = Math.ceil(verdict.retryAfterSec / 60);
      return { error: `Too many sign-in attempts. Try again in ${mins} minute${mins === 1 ? '' : 's'}.` };
    }
  }

  const user = getDb()
    .prepare('SELECT id, org_id, name, role, password_hash, status FROM app_user WHERE lower(email) = ?')
    .get(email) as
    | { id: string; org_id: string; name: string; role: string; password_hash: string; status: string }
    | undefined;

  if (!user || !(await verifyPassword(password, user.password_hash))) {
    for (const key of keys) recordFailure(key);
    // A failed attempt against a real account is the one worth keeping — an
    // unknown address has no organisation to file it under.
    if (user) {
      await auditAuth(user.org_id, { id: user.id, name: user.name, role: user.role },
        'auth.login_failed', `Failed sign-in for ${email} from ${ip}.`);
    }
    return { error: 'Invalid login ID or password.' };
  }
  if (user.status !== 'active') {
    await auditAuth(user.org_id, { id: user.id, name: user.name, role: user.role },
      'auth.login_failed', `Sign-in refused for ${email}: the account is ${user.status}.`);
    return { error: 'This account is not active. Please contact your administrator.' };
  }

  for (const key of keys) clearFailures(key);

  // A hash made under older parameters is replaced now, while the password
  // is in hand — the only moment it can be.
  if (needsRehash(user.password_hash)) {
    getDb().prepare('UPDATE app_user SET password_hash = ? WHERE id = ?').run(await hashPassword(password), user.id);
  }

  await auditAuth(user.org_id, { id: user.id, name: user.name, role: user.role },
    'auth.login', `Signed in from ${ip}.`);
  await createSession(user.id, user.org_id, ip === 'unknown' ? null : ip);
  redirect('/');
}

export async function logoutAction() {
  const user = await currentUser();
  if (user) {
    await auditAuth(user.org_id, { id: user.id, name: user.name, role: user.role },
      'auth.logout', 'Signed out.');
  }
  await destroySession();
  redirect('/login');
}

export async function approveCommissionAction(formData: FormData) {
  const id = String(formData.get('id') ?? '');
  const status = String(formData.get('status') ?? '');
  if (!id || !['pending', 'approved', 'paid'].includes(status)) redirect('/accounting');

  const guard = await authorise({ action: `commission.${status}`, entity: 'commission', entityId: id });
  if (!guard.ok) forbid(guard.message);

  const before = getCommissionForOrg(id, guard.user.org_id);
  if (!before) redirect('/accounting');

  if (setCommissionStatus(id, status, guard.user.org_id)) {
    await audit(guard.user, {
      action: `commission.${status}`,
      entity: 'commission',
      entityId: id,
      entityLabel: before.policy_no,
      summary: `${before.agent_name ?? 'Agency'} commission of ${money(before.net_amount)} on ${before.policy_no} set to ${status}.`,
      changes: { status: [before.status, status] },
    });
  }
  revalidatePath('/accounting');
}

export async function recordPaymentAction(formData: FormData) {
  const id = String(formData.get('payment_id') ?? '');
  const amount = Number(formData.get('amount') ?? 0);
  const method = String(formData.get('method') ?? '');
  const reference = String(formData.get('reference') ?? '');

  const guard = await authorise({ action: 'payment.record', entity: 'payment', entityId: id });
  if (!guard.ok) forbid(guard.message);
  const back = safeBack(formData.get('back'), '/');
  if (!id || !(amount > 0)) redirect(back);

  const before = getPaymentForOrg(id, guard.user.org_id);
  const result = recordPayment(id, amount, method, reference, guard.user.org_id);
  if (before && result) {
    const leg = before.kind === 'client' ? 'from the client' : 'to the principal';
    await audit(guard.user, {
      action: 'payment.record',
      entity: 'payment',
      entityId: id,
      entityLabel: before.policy_no,
      summary: `${money(amount)} recorded ${leg} on ${before.policy_no}${reference ? ` (${method || 'payment'} ${reference})` : ''}.`,
      changes: { paid_amount: [before.paid_amount, result.paid], status: [before.status, result.status] },
    });
  }
  revalidatePath('/');
  revalidatePath(back);
}

export async function markNotificationsReadAction() {
  const user = await currentUser();
  if (!user) redirect('/login');
  // Reading your own notifications changes nothing anyone would audit, and
  // needs no permission — everyone who can sign in has notifications.
  getDb().prepare('UPDATE notification SET read_flag = 1 WHERE org_id = ?').run(user.org_id);
  revalidatePath('/setting/notifications');
}

/**
 * The two bulk controls on Accounting. Approve moves every pending commission
 * to approved; revert sends every approved one back. Nothing here touches a
 * record already paid — paid is final and the button says so.
 */
export async function bulkCommissionAction(formData: FormData) {
  const op = String(formData.get('op') ?? '');
  const guard = await authorise({
    action: `commission.bulk_${op || 'unknown'}`, entity: 'commission',
  });
  if (!guard.ok) forbid(guard.message);
  const user = guard.user;

  const { bulkSetCommissionStatus } = await import('./queries');

  if (op === 'approve') {
    const n = bulkSetCommissionStatus(user.org_id, 'pending', 'approved');
    await audit(user, {
      action: 'commission.bulk_approve', entity: 'commission',
      summary: `${n} pending commission ${n === 1 ? 'entry' : 'entries'} approved in bulk.`,
    });
  }
  if (op === 'revert') {
    const n = bulkSetCommissionStatus(user.org_id, 'approved', 'pending');
    await audit(user, {
      action: 'commission.bulk_revert', entity: 'commission',
      summary: `${n} approved commission ${n === 1 ? 'entry' : 'entries'} sent back to pending.`,
    });
  }

  revalidatePath('/accounting');
}
