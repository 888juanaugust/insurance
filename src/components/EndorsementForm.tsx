'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { saveEndorsementAction, type EndorsementFormState } from '@/lib/endorsement-actions';
import {
  ENDORSEMENT_TYPES, ENDORSEMENT_STATUSES, calculateEndorsement,
} from '@/lib/endorsements';

/* Field and Section at module scope: declared inside the component they become
 * a new type each render and React remounts every input, emptying it. */

function Field({
  name, label, type = 'text', span = 1, required, placeholder, hint, prefix, step,
  maxLength, rows, error, defaultValue, onChange,
}: {
  name: string; label: string; type?: string; span?: number; required?: boolean;
  placeholder?: string; hint?: string; prefix?: string; step?: string;
  maxLength?: number; rows?: number; error?: string; defaultValue?: string;
  /** For the fields the live calculation watches. */
  onChange?: (value: string) => void;
}) {
  const cls = span === 2 ? 'sm:col-span-2' : span === 4 ? 'sm:col-span-2 xl:col-span-4' : '';
  return (
    <div className={cls}>
      <label htmlFor={name} className="mb-1 block text-[12px] font-semibold text-ink-soft">
        {label}
        {required && <span className="ml-0.5 text-brand">*</span>}
      </label>
      <div className="relative">
        {prefix && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-muted">
            {prefix}
          </span>
        )}
        {rows ? (
          <textarea id={name} name={name} rows={rows} required={required} placeholder={placeholder}
            maxLength={maxLength} key={`${name}-${defaultValue ?? ''}`} defaultValue={defaultValue}
            onChange={onChange ? (e) => onChange(e.target.value) : undefined}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${name}-error` : hint ? `${name}-hint` : undefined}
            className={`inp ${error ? 'border-brand' : ''}`} />
        ) : (
          <input id={name} name={name} type={type} step={step} required={required} placeholder={placeholder}
            maxLength={maxLength} key={`${name}-${defaultValue ?? ''}`} defaultValue={defaultValue}
            onChange={onChange ? (e) => onChange(e.target.value) : undefined}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${name}-error` : hint ? `${name}-hint` : undefined}
            className={`inp ${prefix ? 'pl-10' : ''} ${error ? 'border-brand' : ''}`} />
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

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="panel">
      <div className="panel-head">{title}</div>
      {note && <p className="border-b border-line px-5 py-2.5 text-[12.5px] text-muted">{note}</p>}
      <div className="grid gap-4 px-5 py-5 sm:grid-cols-2 xl:grid-cols-4">{children}</div>
    </section>
  );
}

export type PolicyOption = {
  id: string; policy_no: string; client_name: string; vehicle_no: string | null;
  effective_date: string | null; expiry_date: string | null; gross_premium: number;
};

const rm = (n: number) =>
  `${n < 0 ? '−' : ''}RM ${Math.abs(n).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function EndorsementForm({
  mode, initial, policies,
}: {
  mode: 'create' | 'edit';
  initial: Record<string, string | number | null>;
  policies: PolicyOption[];
}) {
  const [state, action, pending] = useActionState(saveEndorsementAction, null as EndorsementFormState | null);

  const v = (k: string) => {
    const echoed = state?.values?.[k];
    if (echoed !== undefined) return echoed;
    const raw = initial[k];
    return raw === null || raw === undefined ? '' : String(raw);
  };
  const err = (k: string) => (state?.field === k ? state.error : undefined);

  const [policyId, setPolicyId] = useState(v('policy_id'));
  const [type, setType] = useState(v('type') || 'sum_insured');
  const [status, setStatus] = useState(v('status') || 'draft');
  const [effective, setEffective] = useState(v('effective_date'));
  const [annual, setAnnual] = useState(v('annual_difference') || '0');

  /*
   * React resets the form after a server action, and that reset blanks a
   * controlled <select> while React's own value stays put — the control goes
   * empty and the next submission posts nothing. The selects are therefore
   * uncontrolled and keyed on the echoed value; this re-syncs the state that
   * drives the calculation.
   */
  const [echoSeen, setEchoSeen] = useState<string | null>(null);
  if (state?.values) {
    const stamp = JSON.stringify([
      state.values.policy_id, state.values.type, state.values.status,
      state.values.effective_date, state.values.annual_difference,
    ]);
    if (echoSeen !== stamp) {
      setEchoSeen(stamp);
      setPolicyId(state.values.policy_id ?? '');
      setType(state.values.type || 'sum_insured');
      setStatus(state.values.status || 'draft');
      setEffective(state.values.effective_date ?? '');
      setAnnual(state.values.annual_difference ?? '0');
    }
  }

  const policy = policies.find((p) => p.id === policyId);
  const cancelling = type === 'cancellation';

  // The same function the server uses, so the person sees what will be stored
  // rather than an approximation of it.
  const working =
    policy && effective && policy.effective_date && policy.expiry_date
      ? calculateEndorsement({
          type,
          effectiveDate: effective,
          policyStart: policy.effective_date,
          policyEnd: policy.expiry_date,
          annualDifference: cancelling ? 0 : Number(annual) || 0,
          annualPremium: policy.gross_premium,
        })
      : null;

  return (
    <form action={action} className="space-y-4">
      {mode === 'edit' && <input type="hidden" name="endorsement_id" value={v('endorsement_id')} />}

      <Section
        title="What is being endorsed"
        note="An endorsement changes cover that is already running. It has to fall inside the policy period it alters."
      >
        <div className="sm:col-span-2 xl:col-span-4">
          <label htmlFor="policy_id" className="mb-1 block text-[12px] font-semibold text-ink-soft">
            Policy<span className="ml-0.5 text-brand">*</span>
          </label>
          <select id="policy_id" name="policy_id" required key={`policy-${policyId}`}
            defaultValue={policyId} onChange={(e) => setPolicyId(e.target.value)}
            aria-invalid={err('policy_id') ? true : undefined}
            aria-describedby={err('policy_id') ? 'policy_id-error' : undefined}
            className={`inp cursor-pointer ${err('policy_id') ? 'border-brand' : ''}`}>
            <option value="">Choose the policy…</option>
            {policies.map((p) => (
              <option key={p.id} value={p.id}>
                {p.policy_no} · {p.client_name}{p.vehicle_no ? ` · ${p.vehicle_no}` : ''}
              </option>
            ))}
          </select>
          {err('policy_id') ? (
            <p id="policy_id-error" className="mt-1 text-[12px] font-medium text-brand">{err('policy_id')}</p>
          ) : policy ? (
            <p className="mt-1 text-[12px] text-muted">
              Cover {policy.effective_date} to {policy.expiry_date} · gross premium {rm(policy.gross_premium)} a year
            </p>
          ) : null}
        </div>

        <Field name="endorsement_no" label="Endorsement no" required maxLength={30}
          defaultValue={v('endorsement_no')} error={err('endorsement_no')} hint="Your own sequence" />
        <Field name="insurer_ref" label="Insurer reference" maxLength={40} defaultValue={v('insurer_ref')}
          hint="Once they issue one" />

        <div>
          <label htmlFor="type" className="mb-1 block text-[12px] font-semibold text-ink-soft">
            Change<span className="ml-0.5 text-brand">*</span>
          </label>
          <select id="type" name="type" key={`type-${type}`} defaultValue={type}
            onChange={(e) => setType(e.target.value)}
            aria-describedby={err('type') ? 'type-error' : undefined}
            className={`inp cursor-pointer ${err('type') ? 'border-brand' : ''}`}>
            {ENDORSEMENT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          {err('type') && <p id="type-error" className="mt-1 text-[12px] font-medium text-brand">{err('type')}</p>}
        </div>

        <div>
          <label htmlFor="status" className="mb-1 block text-[12px] font-semibold text-ink-soft">
            Stage<span className="ml-0.5 text-brand">*</span>
          </label>
          <select id="status" name="status" key={`status-${status}`} defaultValue={status}
            onChange={(e) => setStatus(e.target.value)} className="inp cursor-pointer">
            {ENDORSEMENT_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="effective_date" className="mb-1 block text-[12px] font-semibold text-ink-soft">
            Effective from<span className="ml-0.5 text-brand">*</span>
          </label>
          <input id="effective_date" name="effective_date" type="date" required
            key={`eff-${effective}`} defaultValue={effective}
            onChange={(e) => setEffective(e.target.value)}
            aria-invalid={err('effective_date') ? true : undefined}
            aria-describedby={err('effective_date') ? 'effective_date-error' : undefined}
            className={`inp ${err('effective_date') ? 'border-brand' : ''}`} />
          {err('effective_date') && (
            <p id="effective_date-error" className="mt-1 text-[12px] font-medium text-brand">
              {err('effective_date')}
            </p>
          )}
        </div>
        <Field name="issued_date" label="Issued on" type="date" defaultValue={v('issued_date')} />

        <Field name="description" label="What is changing" span={4} rows={2} maxLength={400}
          defaultValue={v('description')} error={err('description')}
          placeholder="Sum insured increased from RM 48,000 to RM 62,000 following the market valuation."
          hint="The insurer endorses this wording, not the category above" />
      </Section>

      <Section
        title="Premium"
        note={
          cancelling
            ? 'A cancellation is refunded on the short-period scale, so the annual difference does not apply.'
            : 'Enter the change in ANNUAL premium. What the client pays now is worked out from the unexpired period.'
        }
      >
        {!cancelling && (
          <Field name="annual_difference" label="Change in annual premium" type="number" step="0.01" prefix="RM"
            defaultValue={annual} error={err('annual_difference')} onChange={setAnnual}
            hint="Positive when cover goes up, negative when it comes down" />
        )}
        {cancelling && <input type="hidden" name="annual_difference" value="0" />}

        <div className={cancelling ? 'sm:col-span-2 xl:col-span-4' : 'sm:col-span-2 xl:col-span-3'}>
          {working ? (
            <div className="rounded border border-line bg-canvas px-4 py-3">
              <p className="sec-label mb-2">
                {working.basis === 'short_period'
                  ? 'Short-period refund'
                  : working.basis === 'pro_rata'
                    ? 'Pro-rata calculation'
                    : 'No premium change'}
              </p>
              <ul className="space-y-1 text-[12.5px] text-ink-soft">
                {working.explanation.map((line, i) => <li key={i}>{line}</li>)}
              </ul>
              {working.total !== 0 && (
                <dl className="mt-3 grid gap-x-6 gap-y-1 border-t border-line pt-2.5 text-[13px] sm:grid-cols-2">
                  <div className="flex justify-between">
                    <dt className="text-ink-soft">{working.gross < 0 ? 'Return premium' : 'Additional premium'}</dt>
                    <dd className="font-medium tabular-nums text-ink">{rm(working.gross)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-ink-soft">Service tax</dt>
                    <dd className="font-medium tabular-nums text-ink">{rm(working.serviceTax)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-ink-soft">Stamp duty</dt>
                    <dd className="font-medium tabular-nums text-ink">{rm(working.stampDuty)}</dd>
                  </div>
                  <div className="flex justify-between border-t border-line pt-1 sm:border-0 sm:pt-0">
                    <dt className="font-semibold text-ink">
                      {working.total < 0 ? 'Refund to client' : 'Payable by client'}
                    </dt>
                    <dd className="font-semibold tabular-nums text-ink">{rm(Math.abs(working.total))}</dd>
                  </div>
                </dl>
              )}
              <p className="mt-2.5 text-[12px] text-muted">
                Recomputed on the server when you save, so what is stored always matches the policy dates.
              </p>
            </div>
          ) : (
            <div className="rounded border border-dashed border-line px-4 py-6 text-center text-[12.5px] text-muted">
              Choose a policy and an effective date to see the working.
            </div>
          )}
        </div>

        <Field name="remarks" label="Remarks" span={4} rows={2} maxLength={400} defaultValue={v('remarks')} />
      </Section>

      {state?.error && !state.field && (
        <p role="alert" className="rounded border border-danger-line bg-danger-wash px-4 py-3 text-[13px] text-danger">
          {state.error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className="btn btn-primary disabled:opacity-60">
          {pending ? 'Saving…' : mode === 'edit' ? 'Save changes' : 'Raise endorsement'}
        </button>
        <Link href={mode === 'edit' ? `/endorsements/${v('endorsement_id')}` : '/endorsements'} className="btn btn-ghost">
          Cancel
        </Link>
      </div>
    </form>
  );
}
