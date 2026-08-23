'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { authorise, forbid } from './guard';
import { audit, diff } from './audit';
import {
  createEndorsement, updateEndorsement, deleteEndorsement, getEndorsement,
  findEndorsementByNumber, getPolicy, type EndorsementInput,
} from './queries';
import {
  isEndorsementType, isEndorsementStatus, calculateEndorsement,
} from './endorsements';
import { money } from './format';

export type EndorsementFormState = {
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
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}
function reject(fd: FormData, field: string, error: string): EndorsementFormState {
  return { field, error, values: submitted(fd) };
}

export async function saveEndorsementAction(_prev: unknown, fd: FormData): Promise<EndorsementFormState> {
  const id = str(fd, 'endorsement_id');
  const guard = await authorise({
    action: id ? 'endorsement.update' : 'endorsement.create',
    entity: 'endorsement', entityId: id || null,
  });
  if (!guard.ok) return { error: guard.message, values: submitted(fd) };
  const user = guard.user;

  const policyId = str(fd, 'policy_id');
  if (!policyId) return reject(fd, 'policy_id', 'Choose the policy this endorsement alters.');

  const data = getPolicy(policyId);
  if (!data || data.policy.org_id !== user.org_id) {
    return reject(fd, 'policy_id', 'That policy could not be found.');
  }
  const policy = data.policy as Record<string, any>;

  const no = str(fd, 'endorsement_no').toUpperCase();
  if (!no) return reject(fd, 'endorsement_no', 'Enter an endorsement reference.');
  const clash = findEndorsementByNumber(user.org_id, no, id);
  if (clash) return reject(fd, 'endorsement_no', `${no} is already used by another endorsement.`);

  const type = str(fd, 'type');
  if (!isEndorsementType(type)) return reject(fd, 'type', 'Choose what the endorsement changes.');

  const status = str(fd, 'status');
  if (!isEndorsementStatus(status)) return reject(fd, 'status', 'Choose the stage this endorsement is at.');

  const effective = str(fd, 'effective_date');
  if (!effective) return reject(fd, 'effective_date', 'Enter the date the change takes effect.');

  // An endorsement alters cover that is running. Outside the period there is
  // nothing to alter, and the usual cause is the wrong policy off the list.
  if (policy.effective_date && effective < policy.effective_date) {
    return reject(fd, 'effective_date',
      `The change is dated before cover started on ${policy.effective_date}. There is nothing to endorse yet.`);
  }
  if (policy.expiry_date && effective > policy.expiry_date) {
    return reject(fd, 'effective_date',
      `The change is dated after cover ended on ${policy.expiry_date}. Endorse the renewal instead.`);
  }

  const description = str(fd, 'description');
  if (!description) {
    return reject(fd, 'description', 'Say what is changing. The insurer endorses the wording, not the category.');
  }

  const annualDifference = numOf(fd, 'annual_difference');
  if (type === 'cancellation' && annualDifference !== 0) {
    return reject(fd, 'annual_difference',
      'A cancellation refunds the policy on the short-period scale — leave the annual difference at zero.');
  }

  // The figures are recomputed here rather than trusted from the form: the
  // browser shows the working, but what gets stored is what the server worked
  // out, so a posted total cannot disagree with the policy dates.
  const working = calculateEndorsement({
    type,
    effectiveDate: effective,
    policyStart: String(policy.effective_date ?? effective),
    policyEnd: String(policy.expiry_date ?? effective),
    annualDifference,
    annualPremium: Number(policy.gross_premium ?? 0),
  });

  const input: EndorsementInput = {
    policy_id: policyId,
    endorsement_no: no,
    insurer_ref: str(fd, 'insurer_ref') || null,
    type,
    status,
    effective_date: effective,
    description,
    annual_difference: annualDifference,
    basis: working.basis,
    days_on_risk: working.daysOnRisk,
    days_unexpired: working.daysUnexpired,
    cover_days: working.coverDays,
    gross_amount: working.gross,
    service_tax: working.serviceTax,
    stamp_duty: working.stampDuty,
    total_amount: working.total,
    issued_date: str(fd, 'issued_date') || (status === 'issued' ? effective : null),
    remarks: str(fd, 'remarks') || null,
  };

  if (id) {
    const before = getEndorsement(id, user.org_id);
    if (!before) return { error: 'That endorsement could not be found.', values: submitted(fd) };
    updateEndorsement(id, user.org_id, input);
    await audit(user, {
      action: 'endorsement.update', entity: 'endorsement', entityId: id, entityLabel: no,
      summary: `Endorsement ${no} on ${policy.policy_no} edited.`,
      changes: diff(before as unknown as Record<string, unknown>,
        input as unknown as Record<string, unknown>, Object.keys(input)),
    });
    revalidatePath('/endorsements');
    revalidatePath(`/endorsements/${id}`);
    redirect(`/endorsements/${id}`);
  }

  const newId = createEndorsement(user.org_id, input);
  await audit(user, {
    action: 'endorsement.create', entity: 'endorsement', entityId: newId, entityLabel: no,
    summary:
      `Endorsement ${no} raised on ${policy.policy_no} — ${type.replace(/_/g, ' ')}, effective ${effective}` +
      (working.total === 0
        ? ', no premium change.'
        : working.total > 0
          ? `, additional ${money(working.total)}.`
          : `, refund ${money(Math.abs(working.total))}.`),
  });
  revalidatePath('/endorsements');
  redirect(`/endorsements/${newId}`);
}

export async function deleteEndorsementAction(fd: FormData) {
  const id = str(fd, 'endorsement_id');
  const guard = await authorise({ action: 'endorsement.delete', entity: 'endorsement', entityId: id });
  if (!guard.ok) forbid(guard.message);
  const user = guard.user;

  const row = getEndorsement(id, user.org_id);
  if (!row) redirect('/endorsements');

  // An issued endorsement has changed the cover and moved money. Deleting it
  // would leave the policy saying one thing and the insurer's records another.
  if (row.status === 'issued') {
    await audit(user, {
      action: 'endorsement.delete', entity: 'endorsement', entityId: id, entityLabel: row.endorsement_no,
      outcome: 'refused',
      summary: `Deletion of ${row.endorsement_no} refused — it has been issued, so the cover has already changed. Cancel it instead.`,
    });
    redirect(`/endorsements/${id}?blocked=issued`);
  }

  deleteEndorsement(id, user.org_id);
  await audit(user, {
    action: 'endorsement.delete', entity: 'endorsement', entityId: id, entityLabel: row.endorsement_no,
    summary: `Endorsement ${row.endorsement_no} deleted before it was issued.`,
  });
  revalidatePath('/endorsements');
  redirect('/endorsements?deleted=1');
}
