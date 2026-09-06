'use client';

import { useActionState } from 'react';
import { saveBillingProfileAction, changePasswordAction, type ProfileState } from '@/lib/settings-actions';

function Notice({ state, done }: { state: ProfileState | null; done: string }) {
  if (!state) return null;
  if (state.error) {
    return (
      <p role="alert" className="rounded border border-danger-line bg-danger-wash px-4 py-2.5 text-[13px] text-danger">
        {state.error}
      </p>
    );
  }
  if (state.ok) {
    return (
      <p role="status" className="rounded border border-ok-line bg-ok-wash px-4 py-2.5 text-[13px] text-ok">
        {done}
      </p>
    );
  }
  return null;
}

const BILLING: { name: string; label: string; span?: number }[] = [
  { name: 'name', label: 'Billing name', span: 2 },
  { name: 'person_name', label: 'Person name' },
  { name: 'tin_number', label: 'TIN number' },
  { name: 'brn', label: 'Business registration no' },
  { name: 'nric_number', label: 'NRIC number' },
  { name: 'sst_registration_number', label: 'SST registration no' },
  { name: 'email', label: 'Email' },
  { name: 'contact', label: 'Contact number' },
  { name: 'address_line0', label: 'Address line 1', span: 2 },
  { name: 'address_line1', label: 'Address line 2', span: 2 },
  { name: 'address_line2', label: 'Address line 3', span: 2 },
  { name: 'postal_code', label: 'Postal code' },
  { name: 'city', label: 'City' },
  { name: 'state', label: 'State' },
  { name: 'country', label: 'Country' },
];

export function BillingProfileForm({ initial }: { initial: Record<string, string> }) {
  const [state, action, pending] = useActionState(saveBillingProfileAction, null as ProfileState | null);

  return (
    <form action={action} className="space-y-4 px-6 py-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {BILLING.map((f) => (
          <div key={f.name} className={f.span === 2 ? 'sm:col-span-2' : ''}>
            <label htmlFor={f.name} className="mb-1 block text-[12px] font-semibold text-ink-soft">
              {f.label}
              {f.name === 'name' && <span className="ml-0.5 text-brand">*</span>}
            </label>
            <input
              id={f.name}
              name={f.name}
              defaultValue={initial[f.name] ?? ''}
              className="inp"
              required={f.name === 'name'}
            />
          </div>
        ))}
      </div>

      <Notice state={state} done="Billing profile saved." />

      <button type="submit" disabled={pending} className="btn btn-primary disabled:opacity-60">
        {pending ? 'Saving…' : 'Save billing profile'}
      </button>
    </form>
  );
}

export function PasswordForm() {
  const [state, action, pending] = useActionState(changePasswordAction, null as ProfileState | null);

  return (
    <form action={action} className="space-y-4 px-6 py-5">
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          ['currentPassword', 'Current password'],
          ['newPassword', 'New password'],
          ['confirmPassword', 'Confirm new password'],
        ].map(([name, label]) => (
          <div key={name}>
            <label htmlFor={name} className="mb-1 block text-[12px] font-semibold text-ink-soft">{label}</label>
            <input
              id={name}
              name={name}
              type="password"
              autoComplete={name === 'currentPassword' ? 'current-password' : 'new-password'}
              className="inp"
              required
            />
          </div>
        ))}
      </div>

      <Notice state={state} done="Password changed." />

      <button type="submit" disabled={pending} className="btn btn-primary disabled:opacity-60">
        {pending ? 'Saving…' : 'Change Password'}
      </button>
    </form>
  );
}
