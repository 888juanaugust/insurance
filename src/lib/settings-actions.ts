'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { currentUser } from './session';
import { hashPassword, verifyPassword } from './auth';
import { saveBillingProfile, changePassword, getUserPasswordHash } from './queries';

export type ProfileState = { ok?: boolean; error?: string };

const FIELDS = [
  'name', 'person_name', 'tin_number', 'brn', 'nric_number', 'state', 'city',
  'postal_code', 'address_line0', 'address_line1', 'address_line2', 'country',
  'email', 'contact', 'sst_registration_number',
];

export async function saveBillingProfileAction(_prev: unknown, fd: FormData): Promise<ProfileState> {
  const user = await currentUser();
  if (!user) redirect('/login');

  const values: Record<string, string> = {};
  for (const f of FIELDS) values[f] = String(fd.get(f) ?? '').trim();

  if (!values.name) return { error: 'Billing name is required.' };
  if (values.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(values.email)) {
    return { error: 'Enter a valid email address.' };
  }

  saveBillingProfile(user.id, values);
  revalidatePath('/settings');
  return { ok: true };
}

export async function changePasswordAction(_prev: unknown, fd: FormData): Promise<ProfileState> {
  const user = await currentUser();
  if (!user) redirect('/login');

  const current = String(fd.get('currentPassword') ?? '');
  const next = String(fd.get('newPassword') ?? '');
  const confirm = String(fd.get('confirmPassword') ?? '');

  if (!current || !next || !confirm) return { error: 'Fill in all three password fields.' };
  if (next !== confirm) return { error: 'The new password and its confirmation do not match.' };
  if (next.length < 8) return { error: 'The new password must be at least 8 characters.' };
  if (next === current) return { error: 'The new password must differ from the current one.' };

  const stored = getUserPasswordHash(user.id);
  if (!stored || !verifyPassword(current, stored)) {
    return { error: 'The current password is not correct.' };
  }

  changePassword(user.id, hashPassword(next));
  return { ok: true };
}
