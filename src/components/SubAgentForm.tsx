'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { saveSubAgentAction, type SubAgentFormState } from '@/lib/subagent-actions';

/*
 * Field and Section live at module scope on purpose. Declared inside the
 * component they become a new type on every render, and React remounts every
 * input — which quietly empties whatever has been typed.
 */

type FieldProps = {
  name: string;
  label: string;
  type?: string;
  span?: number;
  required?: boolean;
  placeholder?: string;
  hint?: string;
  suffix?: string;
  step?: string;
  maxLength?: number;
  error?: string;
  defaultValue?: string;
};

function Field({
  name, label, type = 'text', span = 1, required, placeholder, hint, suffix, step, maxLength,
  error, defaultValue,
}: FieldProps) {
  return (
    <div className={span === 2 ? 'sm:col-span-2' : ''}>
      <label htmlFor={name} className="mb-1 block text-[12px] font-semibold text-ink-soft">
        {label}
        {required && <span className="ml-0.5 text-brand">*</span>}
      </label>
      <div className="relative">
        <input
          id={name}
          name={name}
          type={type}
          step={step}
          required={required}
          placeholder={placeholder}
          maxLength={maxLength}
          key={`${name}-${defaultValue ?? ''}`}
          defaultValue={defaultValue}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${name}-error` : hint ? `${name}-hint` : undefined}
          className={`inp ${suffix ? 'pr-8' : ''} ${error ? 'border-brand' : ''}`}
        />
        {suffix && (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-muted">
            {suffix}
          </span>
        )}
      </div>
      {error ? (
        <p id={`${name}-error`} className="mt-1 text-[12px] font-medium text-brand">{error}</p>
      ) : hint ? (
        <p id={`${name}-hint`} className="mt-1 text-[12px] text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

function Section({
  title, note, children,
}: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="panel">
      <div className="panel-head">{title}</div>
      {note && <p className="border-b border-line px-5 py-2.5 text-[12.5px] text-muted">{note}</p>}
      <div className="grid gap-4 px-5 py-5 sm:grid-cols-2 xl:grid-cols-4">{children}</div>
    </section>
  );
}

const RANKS = ['Agent', 'Senior Agent', 'Unit Manager', 'Agency Manager'];

export default function SubAgentForm({
  mode,
  initial,
  ceilings,
  policyCount = 0,
}: {
  mode: 'create' | 'edit';
  initial: Record<string, string | number | null>;
  ceilings: { motor: number; nonMotor: number };
  policyCount?: number;
}) {
  const [state, action, pending] = useActionState(saveSubAgentAction, null as SubAgentFormState | null);
  const [selfBilled, setSelfBilled] = useState(Number(initial.self_billed) === 1);
  const [echoSeen, setEchoSeen] = useState<string | null>(null);

  // A rejected submission echoes the toggle back, so it survives the round trip.
  if (state?.values && echoSeen !== JSON.stringify(state.values.self_billed ?? '')) {
    setEchoSeen(JSON.stringify(state.values.self_billed ?? ''));
    setSelfBilled(Boolean(state.values.self_billed));
  }

  const v = (k: string) => {
    const echoed = state?.values?.[k];
    if (echoed !== undefined) return echoed;
    return initial[k] === null || initial[k] === undefined ? '' : String(initial[k]);
  };
  const err = (k: string) => (state?.field === k ? state.error : undefined);

  return (
    <form action={action} className="space-y-4">
      {mode === 'edit' && <input type="hidden" name="agent_id" value={v('agent_id')} />}

      <Section title="Who they are">
        <Field name="name" label="Full name" span={2} required maxLength={100}
          defaultValue={v('name')} error={err('name')} placeholder="Lim Wei Sheng" />
        <Field name="agent_code" label="Agent code" defaultValue={v('agent_code')} error={err('agent_code')}
          placeholder="EXE-A01" hint="Unique within your agency" maxLength={20} />
        <div>
          <label htmlFor="rank" className="mb-1 block text-[12px] font-semibold text-ink-soft">Rank</label>
          <select id="rank" name="rank" key={`rank-${v('rank')}`} defaultValue={v('rank')} className="inp cursor-pointer">
            <option value="">Not set</option>
            {RANKS.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
        <Field name="nric" label="NRIC" defaultValue={v('nric')} error={err('nric')} placeholder="880101-14-5566" />
        <Field name="join_date" label="Joined" type="date" defaultValue={v('join_date')} error={err('join_date')} />
        <div>
          <label htmlFor="status" className="mb-1 block text-[12px] font-semibold text-ink-soft">Status</label>
          <select id="status" name="status" key={`status-${v('status')}`} defaultValue={v('status') || 'active'} className="inp cursor-pointer">
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <p className="mt-1 text-[12px] text-muted">Inactive agents keep their history but take no new cases.</p>
        </div>
      </Section>

      <Section title="How to reach them">
        <Field name="phone" label="Contact number" defaultValue={v('phone')} error={err('phone')} placeholder="012-345 6789" />
        <Field name="email" label="Email" type="email" span={2} defaultValue={v('email')} error={err('email')}
          placeholder="name@example.com" />
      </Section>

      <Section
        title="Commission"
        note={`Your share of each policy is what the insurer pays the agency less what you pay the agent. Insurers pay this agency up to ${ceilings.motor}% on motor and ${ceilings.nonMotor}% on non-motor.`}
      >
        <Field name="motor_rate" label="Motor rate" type="number" step="0.01" suffix="%"
          defaultValue={v('motor_rate') || '0'} error={err('motor_rate')} />
        <Field name="non_motor_rate" label="Non-motor rate" type="number" step="0.01" suffix="%"
          defaultValue={v('non_motor_rate') || '0'} error={err('non_motor_rate')} />
        <Field name="override_rate" label="Override" type="number" step="0.01" suffix="%"
          defaultValue={v('override_rate') || '0'} error={err('override_rate')}
          hint="Paid on top, usually to a manager" />
      </Section>

      <Section title="Payout">
        <Field name="bank_name" label="Bank" defaultValue={v('bank_name')} error={err('bank_name')} placeholder="Maybank Berhad" />
        <Field name="bank_account" label="Account number" defaultValue={v('bank_account')} error={err('bank_account')} />
        <Field name="einvoice_tin" label="TIN" defaultValue={v('einvoice_tin')} error={err('einvoice_tin')}
          placeholder="IG18455211070" />
        <div>
          <span className="mb-1 block text-[12px] font-semibold text-ink-soft">e-Invoice</span>
          {/*
            The visible box carries no name. A controlled checkbox loses its
            DOM state to the form reset React performs after a server action,
            and then submits nothing; the hidden input is what actually posts.
          */}
          <input type="hidden" name="self_billed" value={selfBilled ? 'on' : ''} />
          <label className="flex items-start gap-2.5 rounded border border-line px-3.5 py-2.5">
            <input
              type="checkbox"
              checked={selfBilled}
              onChange={(e) => setSelfBilled(e.target.checked)}
              className="mt-0.5 accent-brand"
            />
            <span className="text-[13px] text-ink-soft">
              Self-billed
              <span className="mt-0.5 block text-[12px] text-muted">
                The agency raises the invoice for their commission, so their TIN is required.
              </span>
            </span>
          </label>
        </div>
      </Section>

      {state?.error && (
        <p role="alert" className="rounded border border-[#f3c9c5] bg-danger-wash px-4 py-3 text-[13px] text-danger">
          {state.error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className="btn btn-primary disabled:opacity-60">
          {pending ? 'Saving…' : mode === 'edit' ? 'Save changes' : 'Add agent'}
        </button>
        <Link href="/team" className="btn btn-ghost">Cancel</Link>
        {mode === 'edit' && policyCount > 0 && (
          <span className="text-[12.5px] text-muted">
            {policyCount} {policyCount === 1 ? 'policy' : 'policies'} written, so this agent cannot be deleted —
            set them inactive instead.
          </span>
        )}
      </div>
    </form>
  );
}
