'use client';

import { useActionState } from 'react';
import { portalSignInAction, type PortalSignInState } from '@/lib/portal-actions';
import InsecureNotice from './InsecureNotice';

export default function PortalSignIn() {
  const [state, action, pending] = useActionState(portalSignInAction, null as PortalSignInState | null);

  return (
    <form action={action} className="mt-6 space-y-4">
      <InsecureNotice />
      <div>
        <label htmlFor="identification" className="mb-1 block text-[12px] font-semibold text-ink-soft">
          NRIC or company registration number
        </label>
        <input
          id="identification"
          name="identification"
          required
          autoComplete="username"
          placeholder="880101-14-5566"
          className="inp"
        />
        <p className="mt-1 text-[12px] text-muted">Dashes optional.</p>
      </div>

      <div>
        <label htmlFor="code" className="mb-1 block text-[12px] font-semibold text-ink-soft">
          Access code
        </label>
        <input
          id="code"
          name="code"
          type="password"
          required
          autoComplete="one-time-code"
          placeholder="ABCDE-12345"
          className="inp font-mono tracking-wide"
        />
      </div>

      {state?.error && (
        <p role="alert" className="rounded border border-danger-line bg-danger-wash px-4 py-3 text-[13px] text-danger">
          {state.error}
        </p>
      )}

      <button type="submit" disabled={pending} className="btn btn-primary w-full disabled:opacity-60">
        {pending ? 'Checking…' : 'Sign in'}
      </button>
    </form>
  );
}
