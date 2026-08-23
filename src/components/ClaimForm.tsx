'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { saveClaimAction, type ClaimFormState } from '@/lib/claim-actions';
import {
  CLAIM_TYPES, CLAIM_STATUSES, FAULT, ncdDefaultFor, isClosed,
} from '@/lib/claims';

/*
 * Field and Section sit at module scope on purpose. Declared inside the
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
  prefix?: string;
  step?: string;
  maxLength?: number;
  rows?: number;
  error?: string;
  defaultValue?: string;
};

function Field({
  name, label, type = 'text', span = 1, required, placeholder, hint, prefix, step,
  maxLength, rows, error, defaultValue,
}: FieldProps) {
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
          <textarea
            id={name} name={name} rows={rows} required={required} placeholder={placeholder}
            maxLength={maxLength} key={`${name}-${defaultValue ?? ''}`} defaultValue={defaultValue}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${name}-error` : hint ? `${name}-hint` : undefined}
            className={`inp ${error ? 'border-brand' : ''}`}
          />
        ) : (
          <input
            id={name} name={name} type={type} step={step} required={required} placeholder={placeholder}
            maxLength={maxLength} key={`${name}-${defaultValue ?? ''}`} defaultValue={defaultValue}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${name}-error` : hint ? `${name}-hint` : undefined}
            className={`inp ${prefix ? 'pl-10' : ''} ${error ? 'border-brand' : ''}`}
          />
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
  id: string;
  policy_no: string;
  client_name: string;
  vehicle_no: string | null;
  effective_date: string | null;
  expiry_date: string | null;
  ncd_pct: number;
};

export default function ClaimForm({
  mode, initial, policies, closing,
}: {
  mode: 'create' | 'edit';
  initial: Record<string, string | number | null>;
  policies: PolicyOption[];
  /** Set when arriving from the quick control to close a claim. */
  closing?: string;
}) {
  const [state, action, pending] = useActionState(saveClaimAction, null as ClaimFormState | null);

  const v = (k: string) => {
    const echoed = state?.values?.[k];
    if (echoed !== undefined) return echoed;
    const raw = initial[k];
    return raw === null || raw === undefined ? '' : String(raw);
  };
  const err = (k: string) => (state?.field === k ? state.error : undefined);

  const [type, setType] = useState(v('type') || 'own_damage');
  const [fault, setFault] = useState(v('fault'));
  const [status, setStatus] = useState(closing || v('status') || 'notified');
  const [ncd, setNcd] = useState(
    mode === 'edit' ? Number(initial.affects_ncd) === 1 : ncdDefaultFor('own_damage', ''),
  );
  const [panel, setPanel] = useState(mode === 'edit' ? Number(initial.workshop_panel) === 1 : true);
  const [touchedNcd, setTouchedNcd] = useState(false);
  const [policyId, setPolicyId] = useState(v('policy_id'));

  /*
   * React resets the form after a server action. A controlled <select> loses
   * its DOM value to that reset while React's own value stays put, so the
   * control goes blank and the next submission posts nothing — the policy
   * chosen before a rejection simply disappears.
   *
   * The selects below are therefore uncontrolled, keyed on the echoed value so
   * they remount with what was submitted, and this re-syncs the state that
   * drives the NCD rule and the cover dates.
   */
  const [echoSeen, setEchoSeen] = useState<string | null>(null);
  if (state?.values) {
    const stamp = JSON.stringify([
      state.values.policy_id, state.values.type, state.values.status, state.values.fault,
      state.values.affects_ncd, state.values.workshop_panel,
    ]);
    if (echoSeen !== stamp) {
      setEchoSeen(stamp);
      setPolicyId(state.values.policy_id ?? '');
      setType(state.values.type || 'own_damage');
      setStatus(state.values.status || 'notified');
      setFault(state.values.fault ?? '');
      setNcd(Boolean(state.values.affects_ncd));
      setPanel(Boolean(state.values.workshop_panel));
    }
  }

  // The rule follows the type and fault until somebody overrides it by hand,
  // after which their answer stands.
  function retype(next: string) {
    setType(next);
    if (!touchedNcd) setNcd(ncdDefaultFor(next, fault));
  }
  function refault(next: string) {
    setFault(next);
    if (!touchedNcd) setNcd(ncdDefaultFor(type, next));
  }

  const policy = policies.find((p) => p.id === policyId);
  const closingNow = isClosed(status);

  return (
    <form action={action} className="space-y-4">
      {mode === 'edit' && <input type="hidden" name="claim_id" value={v('claim_id')} />}

      <Section
        title="The policy"
        note="A claim belongs to the cover that was in force on the day. Picking the renewal by mistake is the commonest way a claim gets rejected."
      >
        <div className="sm:col-span-2 xl:col-span-4">
          <label htmlFor="policy_id" className="mb-1 block text-[12px] font-semibold text-ink-soft">
            Policy<span className="ml-0.5 text-brand">*</span>
          </label>
          <select
            id="policy_id"
            name="policy_id"
            required
            key={`policy-${policyId}`}
            defaultValue={policyId}
            onChange={(e) => setPolicyId(e.target.value)}
            aria-invalid={err('policy_id') ? true : undefined}
            className={`inp cursor-pointer ${err('policy_id') ? 'border-brand' : ''}`}
          >
            <option value="">Choose the policy…</option>
            {policies.map((p) => (
              <option key={p.id} value={p.id}>
                {p.policy_no} · {p.client_name}
                {p.vehicle_no ? ` · ${p.vehicle_no}` : ''}
              </option>
            ))}
          </select>
          {err('policy_id') ? (
            <p className="mt-1 text-[12px] font-medium text-brand">{err('policy_id')}</p>
          ) : policy ? (
            <p className="mt-1 text-[12px] text-muted">
              Cover {policy.effective_date} to {policy.expiry_date}
              {policy.ncd_pct > 0 && ` · NCD ${policy.ncd_pct}% currently earned`}
            </p>
          ) : null}
        </div>

        <Field name="claim_no" label="Claim reference" required maxLength={30}
          defaultValue={v('claim_no')} error={err('claim_no')} hint="Your own sequence" />
        <Field name="insurer_claim_no" label="Insurer claim no" maxLength={40}
          defaultValue={v('insurer_claim_no')} hint="Once they assign one" />

        <div>
          <label htmlFor="type" className="mb-1 block text-[12px] font-semibold text-ink-soft">
            Type<span className="ml-0.5 text-brand">*</span>
          </label>
          <select id="type" name="type" key={`type-${type}`} defaultValue={type}
            onChange={(e) => retype(e.target.value)}
            className={`inp cursor-pointer ${err('type') ? 'border-brand' : ''}`}>
            {CLAIM_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          {err('type') && <p className="mt-1 text-[12px] font-medium text-brand">{err('type')}</p>}
        </div>

        <div>
          <label htmlFor="status" className="mb-1 block text-[12px] font-semibold text-ink-soft">
            Stage<span className="ml-0.5 text-brand">*</span>
          </label>
          <select id="status" name="status" key={`status-${status}`} defaultValue={status}
            onChange={(e) => setStatus(e.target.value)}
            className={`inp cursor-pointer ${err('status') ? 'border-brand' : ''}`}>
            {CLAIM_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          {err('status') && <p className="mt-1 text-[12px] font-medium text-brand">{err('status')}</p>}
        </div>
      </Section>

      <Section title="What happened">
        <Field name="incident_date" label="Incident date" type="date" required
          defaultValue={v('incident_date')} error={err('incident_date')} />
        <Field name="incident_time" label="Time" type="time" defaultValue={v('incident_time')} />
        <Field name="location" label="Where" span={2} maxLength={160} defaultValue={v('location')}
          placeholder="Jalan Tun Razak, near the Ampang junction" />
        <Field name="description" label="What happened" span={4} rows={3} maxLength={800}
          defaultValue={v('description')}
          hint="In the insured's own words where you have them — the adjuster reads this" />

        <div>
          <label htmlFor="fault" className="mb-1 block text-[12px] font-semibold text-ink-soft">Fault</label>
          <select id="fault" name="fault" key={`fault-${fault}`} defaultValue={fault}
            onChange={(e) => refault(e.target.value)} className="inp cursor-pointer">
            {FAULT.map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
        </div>
        <Field name="driver_name" label="Driver at the time" maxLength={100} defaultValue={v('driver_name')} />
        <Field name="driver_nric" label="Driver NRIC" defaultValue={v('driver_nric')}
          error={err('driver_nric')} placeholder="880101-14-5566" />
        <Field name="driver_licence" label="Licence no" maxLength={30} defaultValue={v('driver_licence')} />
      </Section>

      <Section
        title="Police report"
        note="A report within 24 hours of the incident is a condition of every Malaysian motor policy. Without it the insurer can decline."
      >
        <Field name="police_report_no" label="Report no" maxLength={40} defaultValue={v('police_report_no')} />
        <Field name="police_report_date" label="Report date" type="date"
          defaultValue={v('police_report_date')} error={err('police_report_date')} />
        <Field name="police_station" label="Station" span={2} maxLength={80} defaultValue={v('police_station')} />
      </Section>

      <Section title="Repair and survey">
        <Field name="workshop" label="Workshop" span={2} maxLength={120} defaultValue={v('workshop')} />
        <div className="sm:col-span-2">
          <span className="mb-1 block text-[12px] font-semibold text-ink-soft">Workshop type</span>
          {/*
            The visible box carries no name. A controlled checkbox loses its DOM
            state to the form reset React performs after a server action, and
            then submits nothing; the hidden input is what actually posts.
          */}
          <input type="hidden" name="workshop_panel" value={panel ? 'on' : ''} />
          <label className="flex items-start gap-2.5 rounded border border-line px-3.5 py-2.5">
            <input type="checkbox" checked={panel} onChange={(e) => setPanel(e.target.checked)}
              className="mt-0.5 accent-brand" />
            <span className="text-[13px] text-ink-soft">
              On the insurer's panel
              <span className="mt-0.5 block text-[12px] text-muted">
                Panel workshops are paid direct and betterment is not charged to the insured.
              </span>
            </span>
          </label>
        </div>
        <Field name="adjuster" label="Adjuster" span={2} maxLength={120} defaultValue={v('adjuster')} />
        <Field name="survey_date" label="Survey date" type="date" defaultValue={v('survey_date')} />
      </Section>

      <Section title="Money">
        <Field name="estimate_amount" label="Repair estimate" type="number" step="0.01" prefix="RM"
          defaultValue={v('estimate_amount')} />
        <Field name="approved_amount" label="Approved by insurer" type="number" step="0.01" prefix="RM"
          defaultValue={v('approved_amount')} error={err('approved_amount')} />
        <Field name="settled_amount" label="Settled" type="number" step="0.01" prefix="RM"
          defaultValue={v('settled_amount')} error={err('settled_amount')} />
        <Field name="excess_borne" label="Excess borne by insured" type="number" step="0.01" prefix="RM"
          defaultValue={v('excess_borne')} />

        <div className="sm:col-span-2 xl:col-span-4">
          <span className="mb-1 block text-[12px] font-semibold text-ink-soft">No-claim discount</span>
          <input type="hidden" name="affects_ncd" value={ncd ? 'on' : ''} />
          <label className="flex items-start gap-2.5 rounded border border-line px-3.5 py-2.5">
            <input
              type="checkbox"
              checked={ncd}
              onChange={(e) => { setNcd(e.target.checked); setTouchedNcd(true); }}
              className="mt-0.5 accent-brand"
            />
            <span className="text-[13px] text-ink-soft">
              This claim resets the NCD at renewal
              <span className="mt-0.5 block text-[12px] text-muted">
                {type === 'windscreen'
                  ? 'A windscreen claim under the windscreen extension does not — that is what the extension is for.'
                  : fault === 'third_party'
                    ? 'Nothing is claimed off this policy when the third party is at fault, so the discount survives.'
                    : 'On a 55% discount this is the most expensive consequence of the claim. Tell the insured before they decide.'}
              </span>
            </span>
          </label>
        </div>
      </Section>

      <Section title="Dates and notes">
        <Field name="notified_date" label="Notified to us" type="date" defaultValue={v('notified_date')} />
        <Field name="submitted_date" label="Submitted to insurer" type="date" defaultValue={v('submitted_date')} />
        <Field name="settled_date" label="Settled on" type="date" defaultValue={v('settled_date')} />
        {/*
          Deliberately not `required`. The browser would block the submit with
          its own "please fill out this field", and the person would never see
          why it matters — the server's refusal says what the reason is for.
        */}
        <Field name="closed_reason" label={closingNow ? 'Why it closed this way' : 'Closing reason'}
          span={closingNow ? 4 : 1} maxLength={200} defaultValue={v('closed_reason')}
          error={err('closed_reason')}
          hint={status === 'rejected' || status === 'withdrawn' ? 'Needed to close this way' : undefined} />
        <Field name="remarks" label="Remarks" span={4} rows={2} maxLength={500} defaultValue={v('remarks')} />
      </Section>

      {state?.error && !state.field && (
        <p role="alert" className="rounded border border-[#f3c9c5] bg-danger-wash px-4 py-3 text-[13px] text-danger">
          {state.error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className="btn btn-primary disabled:opacity-60">
          {pending ? 'Saving…' : mode === 'edit' ? 'Save changes' : 'Open claim'}
        </button>
        <Link href={mode === 'edit' ? `/claims/${v('claim_id')}` : '/claims'} className="btn btn-ghost">
          Cancel
        </Link>
      </div>
    </form>
  );
}
