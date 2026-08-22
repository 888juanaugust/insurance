'use client';

import { useActionState } from 'react';
import { loginAction } from '@/lib/actions';
import { Logo } from '@/components/icons';

export default function LoginPage() {
  const [state, action, pending] = useActionState(loginAction, null as { error?: string } | null);

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-[400px]">
        <div className="mb-6 flex items-center justify-center gap-2">
          <Logo className="h-9 w-9" />
          <span className="text-[26px] font-semibold tracking-tight text-ink">Insurance Helper</span>
        </div>

        <div className="panel px-7 py-8 shadow-sm">
          <h1 className="text-lg font-semibold text-ink">Sign in to your account</h1>
          <p className="mt-1 mb-6 text-[13px] text-muted">
            Use the login ID registered under your agency subscription.
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
              <p role="alert" className="rounded border border-[#f3c9c5] bg-[#fdeceb] px-3 py-2 text-[13px] text-[#b32b21]">
                {state.error}
              </p>
            )}

            <button type="submit" disabled={pending} className="btn btn-primary w-full justify-center disabled:opacity-60">
              {pending ? 'Signing in…' : 'Login'}
            </button>
          </form>

          <div className="mt-6 rounded border border-line bg-[#f8f9fb] px-3 py-2.5 text-[12px] leading-relaxed text-muted">
            <span className="font-semibold text-ink-soft">Demo login</span>
            <br />
            exemaster3@gmail.com &nbsp;/&nbsp; 12345Abcdefg
          </div>
        </div>

        <p className="mt-6 text-center text-[12px] text-muted">
          © 2026 Simplicity Consulting Sdn Bhd
        </p>
      </div>
    </main>
  );
}
