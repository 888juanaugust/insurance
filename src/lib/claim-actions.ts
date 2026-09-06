'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { authorise, forbid } from './guard';
import { audit, diff } from './audit';
import {
  createClaim, updateClaim, deleteClaim, getClaim, findClaimByNumber,
  claimStorageKeys, getPolicy, type ClaimInput,
} from './queries';
import { deleteDocument } from './files';
import { isClaimType, isClaimStatus, isClosed } from './claims';
import { money } from './format';

export type ClaimFormState = {
  error?: string;
  field?: string;
  /** React resets the form after an action, so a rejection echoes it back. */
  values?: Record<string, string>;
};

function submitted(fd: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of fd.entries()) {
    if (typeof value === 'string' && !key.startsWith('$')) out[key] = value;
  }
  return out;
}

function str(fd: FormData, key: string): string {
  return String(fd.get(key) ?? '').trim();
}
function numOf(fd: FormData, key: string): number {
  const n = Number(str(fd, key).replace(/,/g, ''));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : 0;
}
function reject(fd: FormData, field: string, error: string): ClaimFormState {
  return { field, error, values: submitted(fd) };
}

const NRIC = /^\d{6}-\d{2}-\d{4}$/;

export async function saveClaimAction(_prev: unknown, fd: FormData): Promise<ClaimFormState> {
  const id = str(fd, 'claim_id');
  const guard = await authorise({
    action: id ? 'claim.update' : 'claim.create', entity: 'claim', entityId: id || null,
  });
  if (!guard.ok) return { error: guard.message, values: submitted(fd) };
  const user = guard.user;

  const policyId = str(fd, 'policy_id');
  if (!policyId) return reject(fd, 'policy_id', 'Choose the policy this claim is made under.');

  const policyData = getPolicy(policyId, user.org_id);
  if (!policyData || policyData.policy.org_id !== user.org_id) {
    return reject(fd, 'policy_id', 'That policy could not be found.');
  }
  const policy = policyData.policy as Record<string, any>;

  const claimNo = str(fd, 'claim_no').toUpperCase();
  if (!claimNo) return reject(fd, 'claim_no', 'Enter a claim reference.');
  const clash = findClaimByNumber(user.org_id, claimNo, id);
  if (clash) return reject(fd, 'claim_no', `${claimNo} is already used by another claim on file.`);

  const type = str(fd, 'type');
  if (!isClaimType(type)) return reject(fd, 'type', 'Choose what kind of claim this is.');

  const status = str(fd, 'status');
  if (!isClaimStatus(status)) return reject(fd, 'status', 'Choose the stage this claim has reached.');

  const incidentDate = str(fd, 'incident_date');
  if (!incidentDate) return reject(fd, 'incident_date', 'Enter the date of the incident.');

  // A claim cannot predate the cover it is made under, and cannot fall after
  // the policy expired — either way the insurer will not entertain it, and the
  // usual cause is the wrong policy picked from the list.
  if (policy.effective_date && incidentDate < policy.effective_date) {
    return reject(fd, 'incident_date',
      `The incident is dated before cover started on ${policy.effective_date}. Check the date, or whether this belongs to the previous policy.`);
  }
  if (policy.expiry_date && incidentDate > policy.expiry_date) {
    return reject(fd, 'incident_date',
      `The incident is dated after cover ended on ${policy.expiry_date}. Check the date, or whether it belongs to the renewal.`);
  }

  const reportDate = str(fd, 'police_report_date');
  if (reportDate && reportDate < incidentDate) {
    return reject(fd, 'police_report_date', 'The police report cannot be dated before the incident.');
  }

  const nric = str(fd, 'driver_nric').toUpperCase();
  if (nric && !NRIC.test(nric)) {
    return reject(fd, 'driver_nric', 'An NRIC looks like 880101-14-5566.');
  }

  const estimate = numOf(fd, 'estimate_amount');
  const approved = numOf(fd, 'approved_amount');
  const settled = numOf(fd, 'settled_amount');

  // The insurer cannot settle more than it approved. Getting this the wrong
  // way round means the recovery on the books is money that never arrived.
  if (approved > 0 && settled > approved + 0.005) {
    return reject(fd, 'settled_amount',
      `Settled ${money(settled)} is more than the ${money(approved)} approved. One of the two is wrong.`);
  }

  // Closing a claim without the figure that closes it leaves the register
  // saying an amount was paid when none was recorded.
  if (status === 'settled' && settled <= 0) {
    return reject(fd, 'settled_amount', 'A settled claim needs the amount that was paid.');
  }
  if ((status === 'rejected' || status === 'withdrawn') && !str(fd, 'closed_reason')) {
    return reject(fd, 'closed_reason', `Say why the claim was ${status}. It is the first thing anyone asks later.`);
  }

  const input: ClaimInput = {
    policy_id: policyId,
    claim_no: claimNo,
    insurer_claim_no: str(fd, 'insurer_claim_no') || null,
    type,
    status,
    fault: str(fd, 'fault') || null,
    incident_date: incidentDate,
    incident_time: str(fd, 'incident_time') || null,
    location: str(fd, 'location') || null,
    description: str(fd, 'description') || null,
    driver_name: str(fd, 'driver_name') || null,
    driver_nric: nric || null,
    driver_licence: str(fd, 'driver_licence') || null,
    police_report_no: str(fd, 'police_report_no') || null,
    police_report_date: reportDate || null,
    police_station: str(fd, 'police_station') || null,
    workshop: str(fd, 'workshop') || null,
    workshop_panel: fd.get('workshop_panel') ? 1 : 0,
    adjuster: str(fd, 'adjuster') || null,
    survey_date: str(fd, 'survey_date') || null,
    estimate_amount: estimate,
    approved_amount: approved,
    settled_amount: settled,
    excess_borne: numOf(fd, 'excess_borne'),
    affects_ncd: fd.get('affects_ncd') ? 1 : 0,
    notified_date: str(fd, 'notified_date') || incidentDate,
    submitted_date: str(fd, 'submitted_date') || null,
    settled_date: str(fd, 'settled_date') || (status === 'settled' ? incidentDate : null),
    closed_reason: str(fd, 'closed_reason') || null,
    remarks: str(fd, 'remarks') || null,
  };

  if (id) {
    const before = getClaim(id, user.org_id);
    if (!before) return { error: 'That claim could not be found.', values: submitted(fd) };
    updateClaim(id, user.org_id, input);
    await audit(user, {
      action: 'claim.update', entity: 'claim', entityId: id, entityLabel: claimNo,
      summary: `Claim ${claimNo} on ${policy.policy_no} edited.`,
      changes: diff(before as unknown as Record<string, unknown>,
        input as unknown as Record<string, unknown>, Object.keys(input)),
    });
    revalidatePath('/claims');
    revalidatePath(`/claims/${id}`);
    redirect(`/claims/${id}`);
  }

  const newId = createClaim(user.org_id, input);
  await audit(user, {
    action: 'claim.create', entity: 'claim', entityId: newId, entityLabel: claimNo,
    summary: `Claim ${claimNo} opened on ${policy.policy_no} — ${input.type.replace(/_/g, ' ')}, incident ${incidentDate}.`,
  });
  revalidatePath('/claims');
  redirect(`/claims/${newId}`);
}

/** Move a claim one stage without opening the whole form. */
export async function setClaimStatusAction(fd: FormData) {
  const id = str(fd, 'claim_id');
  const status = str(fd, 'status');
  const guard = await authorise({ action: 'claim.status', entity: 'claim', entityId: id });
  if (!guard.ok) forbid(guard.message);
  const user = guard.user;

  const claim = getClaim(id, user.org_id);
  if (!claim || !isClaimStatus(status)) redirect('/claims');

  // The closing stages need figures or reasons the quick control cannot ask
  // for, so they are only reachable through the form.
  if (isClosed(status)) {
    redirect(`/claims/${id}/edit?closing=${status}`);
  }

  updateClaim(id, user.org_id, {
    ...(claim as unknown as ClaimInput),
    status,
    submitted_date: status === 'submitted' && !claim.submitted_date
      ? new Date().toISOString().slice(0, 10)
      : claim.submitted_date,
  });
  await audit(user, {
    action: 'claim.status', entity: 'claim', entityId: id, entityLabel: claim.claim_no,
    summary: `Claim ${claim.claim_no} moved to ${status.replace(/_/g, ' ')}.`,
    changes: { status: [claim.status, status] },
  });
  revalidatePath('/claims');
  revalidatePath(`/claims/${id}`);
  redirect(`/claims/${id}`);
}

export async function deleteClaimAction(fd: FormData) {
  const id = str(fd, 'claim_id');
  const guard = await authorise({ action: 'claim.delete', entity: 'claim', entityId: id });
  if (!guard.ok) forbid(guard.message);
  const user = guard.user;

  const claim = getClaim(id, user.org_id);
  if (!claim) redirect('/claims');

  // A settled claim is the record of money that moved. Deleting it would
  // leave the payment with nothing to point at, exactly as with a paid policy.
  if (claim.status === 'settled') {
    await audit(user, {
      action: 'claim.delete', entity: 'claim', entityId: id, entityLabel: claim.claim_no,
      outcome: 'refused',
      summary: `Deletion of ${claim.claim_no} refused — it is settled, and the settlement is a record of money paid.`,
    });
    redirect(`/claims/${id}?blocked=settled`);
  }

  const keys = claimStorageKeys(id);
  deleteClaim(id, user.org_id);
  for (const key of keys) deleteDocument(key);

  await audit(user, {
    action: 'claim.delete', entity: 'claim', entityId: id, entityLabel: claim.claim_no,
    summary: `Claim ${claim.claim_no} deleted${keys.length ? ` with ${keys.length} document${keys.length === 1 ? '' : 's'}` : ''}.`,
  });
  revalidatePath('/claims');
  redirect('/claims?deleted=1');
}
