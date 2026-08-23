'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { authorise, forbid } from './guard';
import { audit } from './audit';
import { setRenewalStatus, requestRenewal, getPolicy } from './queries';
import { classSlug } from './format';

/** Inbox and expiring-tab row actions on the renewals screen. */
export async function renewalActionForm(fd: FormData) {
  const id = String(fd.get('id') ?? '');
  const policyId = String(fd.get('policy_id') ?? '');
  const cls = String(fd.get('cls') ?? 'motor');
  const op = String(fd.get('op') ?? '');

  const guard = await authorise('renewal.process', {
    action: `renewal.${op || 'unknown'}`, entity: 'renewal_request', entityId: id || policyId || null,
  });
  if (!guard.ok) forbid(guard.message);
  const user = guard.user;

  const label = policyId ? (getPolicy(policyId)?.policy?.policy_no ?? null) : null;

  if (op === 'request' && policyId) {
    requestRenewal(user.org_id, policyId, 'Expiry watch');
    await audit(user, {
      action: 'renewal.request', entity: 'renewal_request', entityId: policyId, entityLabel: label,
      summary: `Renewal requested for ${label ?? policyId}.`,
    });
    revalidatePath('/insurance/renewals');
    return;
  }

  if (op === 'process' && id) {
    setRenewalStatus(id, user.org_id, 'completed');
    await audit(user, {
      action: 'renewal.process', entity: 'renewal_request', entityId: id, entityLabel: label,
      summary: `Renewal ${label ? `for ${label} ` : ''}marked completed.`,
    });
  }
  if (op === 'reject' && id) {
    setRenewalStatus(id, user.org_id, 'rejected');
    await audit(user, {
      action: 'renewal.reject', entity: 'renewal_request', entityId: id, entityLabel: label,
      summary: `Renewal ${label ? `for ${label} ` : ''}rejected.`,
    });
  }

  revalidatePath('/insurance/renewals');

  if (op === 'quote' && policyId) {
    if (id) setRenewalStatus(id, user.org_id, 'processing');
    await audit(user, {
      action: 'renewal.quote', entity: 'renewal_request', entityId: id || policyId, entityLabel: label,
      summary: `Quotation started for the renewal of ${label ?? policyId}.`,
    });
    redirect(`/insurance/${classSlug(cls)}/new?renewal=${policyId}`);
  }
}
