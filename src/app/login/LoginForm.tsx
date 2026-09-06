'use client';

import { useActionState } from 'react';
import { loginAction } from '@/lib/actions';
import { Logo } from '@/components/icons';

export default function LoginForm({
  agency, noAgencyMessage,
}: {
  /** The agency this address belongs to, null when it belongs to none. */
  agency: string | null;
  noAgencyMessage: string;
}) {
  const [state, action, pending] = useActionState(loginAction, null as { error?: string } | null);

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-[400px]">
        <div className="mb-6 flex items-center justify-center gap-2">
          <Logo className="h-9 w-9" />
          <span className="text-[26px] font-semibold tracking-tight text-ink">Insurhelp</span>
        </div>

        <div className="panel px-7 py-8 shadow-sm">
          <h1 className="text-lg font-semibold text-ink">Sign in to your account</h1>
          <p className="mt-1 mb-6 text-[13px] text-muted">
            {agency ? <>{agency} · use the login ID your agency registered.</> : 'Use the login ID registered under your agency subscription.'}
          </p>

          <form action={action} className="space-y-4">
            <div>
              <label htmlFor="email" className="mb-1.5 block text-[13px] font-semibold text-ink-soft">
                Login ID (email address)
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="username"
                required
                className="inp"
                placeholder="name@example.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-1.5 block text-[13px] font-semibold text-ink-soft">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="inp"
                placeholder="••••••••"
              />
            </div>

            {state?.error && (
              <p role="alert" className="rounded border border-danger-line bg-danger-wash px-3 py-2 text-[13px] text-danger">
                {state.error}
              </p>
            )}

            <button type="submit" disabled={pending} className="btn btn-primary w-full justify-center disabled:opacity-60">
              {pending ? 'Signing in…' : 'Login'}
            </button>
          </form>

          {agency === null ? (
            <p role="alert" className="mt-6 rounded border border-warn-line bg-warn-wash px-3 py-2.5 text-[12.5px] leading-relaxed text-warn">
              {noAgencyMessage}
            </p>
          ) : (
            <p className="mt-6 text-[12px] leading-relaxed text-muted">
              Forgotten your password? An administrator at your agency can reset it under
              Team and agency.
            </p>
          )}
        </div>

        <p className="mt-6 text-center text-[12px] text-muted">
          © 2026 Insurhelp
        </p>
      </div>
    </main>
  );
}
