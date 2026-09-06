'use server';

import { revalidatePath } from 'next/cache';
import { authorise } from './guard';
import { audit } from './audit';
import { addFollowUp } from './queries';
import { isFollowUpOutcome, OUTCOME_LABEL, RESUME_OUTCOME } from './follow-up';
import { today } from './format';
import { isCalendarDate } from './dates';

export type FollowUpState = {
  ok?: boolean;
  error?: string;
  message?: string;
  /**
   * What was submitted, echoed back.
   *
   * React resets the form once the action returns, so a refusal empties every
   * field — including the outcome the person had just chosen. They then fill in
   * the missing date, press Save, and are told to choose an outcome they can
   * see on the screen. The form is rebuilt from this instead.
   */
  values?: { outcome: string; note: string; next_at: string };
};



/**
 * Record what happened when the client was contacted.
 *
 * The worklist hands an agent forty names and phone numbers and, until this,
 * remembered nothing: the same person was rung twice on Tuesday and the one
 * who said "call me after payday" was forgotten entirely. One line per call is
 * all it takes to stop both.
 */
export async function logFollowUpAction(_prev: unknown, fd: FormData): Promise<FollowUpState> {
  const guard = await authorise({ action: 'followup.log', entity: 'follow_up' });
  if (!guard.ok) return { error: guard.message };
  const user = guard.user;

  const policyId = String(fd.get('policy_id') ?? '');
  const clientId = String(fd.get('client_id') ?? '') || null;
  const outcome = String(fd.get('outcome') ?? '');
  const note = String(fd.get('note') ?? '').trim();
  const nextAt = String(fd.get('next_at') ?? '').trim();

  const values = { outcome, note, next_at: nextAt };
  const refuse = (error: string): FollowUpState => ({ error, values });

  if (!isFollowUpOutcome(outcome) || outcome === RESUME_OUTCOME) return refuse('Choose what happened.');
  if (nextAt && !isCalendarDate(nextAt)) return refuse('The call-back date is not a date.');
  if (nextAt && nextAt <= today()) {
    // A call-back in the past drops the case off nothing and raises it nowhere.
    return refuse('The call-back date has to be after today.');
  }
  if (outcome === 'callback' && !nextAt) {
    // Without the date it is not a call back, it is a note — and the case
    // would sit on the list being chased anyway.
    return refuse('Give the day they asked to be called back on.');
  }
  if (outcome === 'not_renewing' && !note) {
    return refuse('Say why they are not renewing. A lapse with no reason teaches the agency nothing.');
  }

  const id = addFollowUp(user.org_id, {
    policy_id: policyId,
    client_id: clientId,
    outcome,
    note: note || null,
    next_at: nextAt || null,
    by_user: user.id,
    by_name: user.name,
  });
  if (!id) return refuse('That policy is not on your register.');

  const label = OUTCOME_LABEL[outcome] ?? outcome;
  await audit(user, {
    action: 'followup.log',
    entity: 'follow_up',
    entityId: id,
    entityLabel: policyId,
    summary:
      `Renewal follow-up recorded — ${label.toLowerCase()}`
      + (nextAt ? `, to be raised again on ${nextAt}` : '')
      + (note ? `. ${note}` : '.'),
  });

  revalidatePath('/expiring');
  revalidatePath('/');
  return { ok: true, message: 'Noted.' };
}

/**
 * Put a case back on the chase list.
 *
 * "Call back later" and "Not renewing" take a case off the list, and until
 * this there was no way back: mark one by mistake and it stayed gone. The
 * return is written as a line of its own — "back on the list", by whom — so
 * the history shows what happened rather than pretending the earlier note
 * was never made.
 */
export async function resumeChaseAction(_prev: unknown, fd: FormData): Promise<FollowUpState> {
  const guard = await authorise({ action: 'followup.resume', entity: 'follow_up' });
  if (!guard.ok) return { error: guard.message };
  const user = guard.user;

  const policyId = String(fd.get('policy_id') ?? '');
  const clientId = String(fd.get('client_id') ?? '') || null;

  const id = addFollowUp(user.org_id, {
    policy_id: policyId,
    client_id: clientId,
    outcome: RESUME_OUTCOME,
    note: 'Put back on the chase list.',
    next_at: null,
    by_user: user.id,
    by_name: user.name,
  });
  if (!id) return { error: 'That policy is not on your register.' };

  await audit(user, {
    action: 'followup.resume',
    entity: 'follow_up',
    entityId: id,
    entityLabel: policyId,
    summary: 'Renewal follow-up: put back on the chase list.',
  });

  revalidatePath('/expiring');
  revalidatePath('/');
  return { ok: true, message: 'Back on the list.' };
}
