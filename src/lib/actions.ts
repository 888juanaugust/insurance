'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getDb } from './db';
import { verifyPassword } from './auth';
import { createSession, destroySession, currentUser } from './session';
import { setCommissionStatus, recordPayment } from './queries';

export async function loginAction(_prev: unknown, formData: FormData) {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');

  if (!email || !password) return { error: 'Please enter your email address and password.' };

  const user = getDb()
    .prepare('SELECT id, password_hash, status FROM app_user WHERE lower(email) = ?')
    .get(email) as { id: string; password_hash: string; status: string } | undefined;

  if (!user || !verifyPassword(password, user.password_hash)) {
    return { error: 'Invalid login ID or password.' };
  }
  if (user.status !== 'active') {
    return { error: 'This account is not active. Please contact your administrator.' };
  }

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
