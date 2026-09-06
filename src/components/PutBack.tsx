'use client';

import { useActionState } from 'react';
import { resumeChaseAction, type FollowUpState } from '@/lib/followup-actions';

/**
 * The way back on to the chase list, for a case marked "Call back later" or
 * "Not renewing" by mistake. Reversible by nature — it only ever adds a line —
 * so it asks nothing before it acts.
 */
export default function PutBack({ policyId, clientId }: { policyId: string; clientId: string | null }) {
  const [state, action, pending] = useActionState(resumeChaseAction, null as FollowUpState | null);

  return (
    <form action={action} className="inline-flex flex-wrap items-center gap-2">
      <input type="hidden" name="policy_id" value={policyId} />
      {clientId && <input type="hidden" name="client_id" value={clientId} />}
      <button type="submit" disabled={pending} className="btn btn-ghost px-2.5 py-1 text-[12px] disabled:opacity-60">
        {pending ? 'Putting back…' : 'Put it back on the list'}
      </button>
      {state?.error && (
        <span role="alert" className="text-[11.5px] font-medium text-danger">{state.error}</span>
      )}
    </form>
  );
}
