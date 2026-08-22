'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { currentUser } from './session';
import { setRenewalStatus, requestRenewal } from './queries';
import { classSlug } from './format';

/** Inbox and expiring-tab row actions on the renewals screen. */
export async function renewalActionForm(fd: FormData) {
  const user = await currentUser();
  if (!user) redirect('/login');

  const id = String(fd.get('id') ?? '');
  const policyId = String(fd.get('policy_id') ?? '');
  const cls = String(fd.get('cls') ?? 'motor');
  const op = String(fd.get('op') ?? '');

  if (op === 'request' && policyId) {
    requestRenewal(user.org_id, policyId, 'Expiry watch');
    revalidatePath('/insurance/renewals');
    return;
  }

  if (op === 'process' && id) setRenewalStatus(id, user.org_id, 'completed');
  if (op === 'reject' && id) setRenewalStatus(id, user.org_id, 'rejected');

  revalidatePath('/insurance/renewals');

  if (op === 'quote' && policyId) {
    if (id) setRenewalStatus(id, user.org_id, 'processing');
    redirect(`/insurance/${classSlug(cls)}/new?renewal=${policyId}`);
  }
}
