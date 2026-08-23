'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getDb } from './db';
import { verifyPassword } from './auth';
import { createSession, destroySession, currentUser } from './session';
import { checkRate, recordFailure, clearFailures } from './rate-limit';
import { headers } from 'next/headers';
import { setCommissionStatus, recordPayment } from './queries';

export async function loginAction(_prev: unknown, formData: FormData) {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');

  if (!email || !password) return { error: 'Please enter your email address and password.' };

  // Throttle per address and per email, so neither one account nor one source
  // can be worked through at network speed.
  const hdrs = await headers();
  const ip = (hdrs.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown';
  const keys = [`ip:${ip}`, `email:${email}`];

  for (const key of keys) {
    const verdict = checkRate(key);
    if (!verdict.allowed) {
      const mins = Math.ceil(verdict.retryAfterSec / 60);
      return { error: `Too many sign-in attempts. Try again in ${mins} minute${mins === 1 ? '' : 's'}.` };
    }
  }

  const user = getDb()
    .prepare('SELECT id, password_hash, status FROM app_user WHERE lower(email) = ?')
    .get(email) as { id: string; password_hash: string; status: string } | undefined;

  if (!user || !verifyPassword(password, user.password_hash)) {
    for (const key of keys) recordFailure(key);
    return { error: 'Invalid login ID or password.' };
  }
  if (user.status !== 'active') {
    return { error: 'This account is not active. Please contact your administrator.' };
  }

  for (const key of keys) clearFailures(key);
  await createSession(user.id);
  redirect('/');
}

export async function logoutAction() {
  await destroySession();
  redirect('/login');
}

export async function approveCommissionAction(formData: FormData) {
  const user = await currentUser();
  if (!user) redirect('/login');
  const id = String(formData.get('id') ?? '');
  const status = String(formData.get('status') ?? '');
  if (id && ['pending', 'approved', 'paid'].includes(status)) setCommissionStatus(id, status);
  revalidatePath('/accounting');
}

export async function recordPaymentAction(formData: FormData) {
  const user = await currentUser();
  if (!user) redirect('/login');
  const id = String(formData.get('payment_id') ?? '');
  const amount = Number(formData.get('amount') ?? 0);
  const method = String(formData.get('method') ?? '');
  const reference = String(formData.get('reference') ?? '');
  if (id && amount > 0) recordPayment(id, amount, method, reference);
  revalidatePath('/');
  revalidatePath(String(formData.get('back') ?? '/'));
}

export async function markNotificationsReadAction() {
  const user = await currentUser();
  if (!user) redirect('/login');
  getDb().prepare('UPDATE notification SET read_flag = 1 WHERE org_id = ?').run(user.org_id);
  revalidatePath('/setting/notifications');
}

/**
 * The bulk controls on Accounting. Approve and reject move every pending
 * commission at once; the report actions recompute the payout run.
 */
export async function bulkCommissionAction(formData: FormData) {
  const user = await currentUser();
  if (!user) redirect('/login');

  const op = String(formData.get('op') ?? '');
  const { bulkSetCommissionStatus } = await import('./queries');

  if (op === 'approve') bulkSetCommissionStatus(user.org_id, 'pending', 'approved');
  if (op === 'reject') bulkSetCommissionStatus(user.org_id, 'approved', 'pending');
  // "Generate" and "Force regenerate" recompute the same figures the payout
  // table already derives, so there is nothing to persist for them here.

  revalidatePath('/accounting');
}
