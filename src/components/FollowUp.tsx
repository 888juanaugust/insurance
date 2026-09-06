'use client';

import { useActionState, useState } from 'react';
import { logFollowUpAction, type FollowUpState } from '@/lib/followup-actions';
import { FOLLOW_UP_OUTCOMES, OUTCOME_LABEL } from '@/lib/follow-up';
import { longDate } from '@/lib/format';

export type LastNote = {
  at: string;
  outcome: string;
  note: string | null;
  next_at: string | null;
  by_name: string;
} | null;

const BADGE: Record<string, string> = {
  reached: 'badge-green',
  quoted: 'badge-blue',
  no_answer: 'badge-grey',
  callback: 'badge-amber',
  not_renewing: 'badge-red',
  back_on_list: 'badge-grey',
};

/**
 * One line about a client, recorded from the worklist itself.
 *
 * It opens in place rather than on a page of its own: an agent working down a
 * list of forty will not navigate away and back for each one, and a note that
 * is a nuisance to write does not get written.
 */
export default function FollowUp({
  policyId, clientId, last,
}: {
  policyId: string;
  clientId: string | null;
  last: LastNote;
}) {
  const [state, action, pending] = useActionState(logFollowUpAction, null as FollowUpState | null);
  const [open, setOpen] = useState(false);
  const [outcome, setOutcome] = useState('');

  /*
   * React resets the form after the action returns, so a refusal wipes every
   * field. The echoed values are put back as defaults, keyed so React rebuilds
   * the inputs around them, and the local outcome — which decides whether the
   * date field is shown at all — is re-synced from the same echo.
   */
  const echo = state?.values;
  const stamp = echo ? `${echo.outcome}|${echo.note}|${echo.next_at}` : '';
  if (echo && echo.outcome !== outcome) setOutcome(echo.outcome);

  // Closing on success would hide the confirmation; the row re-renders from
  // the server anyway, so the panel just goes quiet.
  const done = state?.ok;

  if (!open) {
    return (
      <div className="min-w-[190px]">
        {last ? (
          <>
            <span className={`badge ${BADGE[last.outcome] ?? 'badge-grey'}`}>
              {OUTCOME_LABEL[last.outcome] ?? last.outcome}
            </span>
            <span className="mt-1 block text-[11px] text-muted">
              {longDate(last.at)} · {last.by_name}
              {last.next_at && <> · call back {longDate(last.next_at)}</>}
            </span>
            {last.note && (
              <span className="mt-0.5 block max-w-[220px] whitespace-normal text-[11.5px] text-ink-soft">
                {last.note}
              </span>
            )}
          </>
        ) : (
          <span className="text-[11.5px] text-muted">Not contacted yet</span>
        )}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-1 text-[11.5px] font-semibold text-accent hover:underline"
        >
          {last ? 'Add a note' : 'Record a call'}
        </button>
      </div>
    );
  }

  return (
    <form action={action} className="min-w-[250px] space-y-2">
      <input type="hidden" name="policy_id" value={policyId} />
      {clientId && <input type="hidden" name="client_id" value={clientId} />}

      <select
        name="outcome"
        aria-label="What happened"
        key={`outcome-${stamp}`}
        defaultValue={echo?.outcome ?? ''}
        onChange={(e) => setOutcome(e.target.value)}
        className="inp py-1 text-[12px]"
      >
        <option value="">What happened…</option>
        {FOLLOW_UP_OUTCOMES.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>

      <input
        name="note"
        aria-label="Note"
        key={`note-${stamp}`}
        defaultValue={echo?.note ?? ''}
        placeholder={outcome === 'not_renewing' ? 'Why not? (required)' : 'What was said'}
        className="inp py-1 text-[12px]"
      />

      {/* Only where a date is the point of the note. */}
      {(outcome === 'callback' || outcome === 'no_answer' || outcome === 'quoted') && (
        <label className="block text-[11px] text-muted">
          Raise it again on
          <input
            name="next_at"
            type="date"
            key={`next-${stamp}`}
            defaultValue={echo?.next_at ?? ''}
            className="inp mt-0.5 py-1 text-[12px]"
          />
        </label>
      )}

      <div className="flex items-center gap-2">
        <button type="submit" disabled={pending} className="btn btn-primary px-2.5 py-1 text-[12px] disabled:opacity-60">
          {pending ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-[11.5px] text-muted hover:text-ink"
        >
          Cancel
        </button>
      </div>

      {state?.error && (
        <p role="alert" className="whitespace-normal text-[11.5px] font-medium text-danger">{state.error}</p>
      )}
      {done && <p className="text-[11.5px] text-ok">{state?.message}</p>}
    </form>
  );
}
