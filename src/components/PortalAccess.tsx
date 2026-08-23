'use client';

import { useActionState } from 'react';
import { issuePortalCodeAction, revokePortalAccessAction, type PortalAdminState } from '@/lib/portal-actions';

export default function PortalAccess({
  clientId, clientName, access,
}: {
  clientId: string;
  clientName: string;
  access: { portal_enabled: number; portal_code_set: string | null; portal_last_seen: string | null; has_code: number } | undefined;
}) {
  const [state, action, pending] = useActionState(issuePortalCodeAction, null as PortalAdminState | null);
  const live = Boolean(access?.has_code) && access?.portal_enabled === 1;

  return (
    <div className="panel">
      <div className="panel-head">Client portal</div>

      <div className="px-5 py-4">
        <p className="text-[13px] text-ink-soft">
          {live ? (
            <>
              {clientName} can sign in at <code>/portal</code> with their NRIC or company
              registration number and the code issued on {access?.portal_code_set}.
              {access?.portal_last_seen
                ? ` Last signed in ${access.portal_last_seen}.`
                : ' They have not signed in yet.'}
            </>
          ) : (
            <>No portal access. Issuing a code lets {clientName} see their own policies, download
            their documents and ask for a renewal — nothing else.</>
          )}
        </p>

        {state?.code && (
          <div className="mt-4 rounded border border-[#bfe0cd] bg-ok-wash px-4 py-3">
            <p className="text-[12px] font-semibold text-ok">Read this to the client now</p>
            <p className="mt-1.5 font-mono text-[20px] tracking-widest text-ink">{state.code}</p>
            <p className="mt-1.5 text-[12px] text-ok">
              It is stored hashed and cannot be shown again. If it is lost, issue a new one.
            </p>
          </div>
        )}

        {state?.error && (
          <p role="alert" className="mt-3 rounded border border-[#f3c9c5] bg-danger-wash px-4 py-2.5 text-[12.5px] text-danger">
            {state.error}
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2.5">
          <form action={action}>
            <input type="hidden" name="client_id" value={clientId} />
            <button type="submit" disabled={pending} className="btn btn-ghost disabled:opacity-60">
              {pending ? 'Issuing…' : live ? 'Issue a new code' : 'Issue an access code'}
            </button>
          </form>
          {live && (
            <form action={revokePortalAccessAction}>
              <input type="hidden" name="client_id" value={clientId} />
              <button type="submit" className="btn btn-ghost text-danger">Withdraw access</button>
            </form>
          )}
        </div>

        {live && (
          <p className="mt-2.5 text-[12px] text-muted">
            Issuing a new code replaces the old one. Withdrawing access stops any session they are
            holding at their next request.
          </p>
        )}
      </div>
    </div>
  );
}
