'use client';

import { useActionState, useState } from 'react';
import { savePolicyAction } from '@/lib/policy-actions';
import type { ExtractionResult, FieldKey } from '@/lib/extract';

export type Option = { value: string; label: string };

export type PolicyFormProps = {
  mode: 'create' | 'edit' | 'review';
  cls: 'motor' | 'non_motor';
  clients: Option[];
  principals: Array<Option & { motor_rate: number; non_motor_rate: number }>;
  agents: Option[];
  initial: Partial<Record<string, string | number | null>>;
  /** Present after an upload — drives the per-field provenance chips. */
  extraction?: ExtractionResult;
  matchedClientId?: string | null;
  isDuplicate?: boolean;
  sourceFile?: string;
};

function chipFor(f: { value: unknown; confidence: number; source: string } | undefined) {
  if (!f || f.value === null) {
    return { label: 'not found', cls: 'badge-grey', title: 'The document did not state this — please enter it.' };
  }
  if (f.confidence >= 0.95) {
    return { label: 'confirmed', cls: 'badge-green', title: 'Both the pattern rules and the model read the same value.' };
  }
  if (f.confidence >= 0.8) {
    return {
      label: f.source === 'claude' ? 'read by model' : 'read',
      cls: 'badge-blue',
      title: f.source === 'claude' ? 'Read from the document by the model.' : 'Matched against a labelled field in the document.',
    };
  }
  if (f.source === 'derived') {
    return { label: 'calculated', cls: 'badge-amber', title: 'Not stated in the document — worked out from the other premium figures.' };
  }
  return { label: 'check this', cls: 'badge-amber', title: 'Low confidence, or the two readings disagreed. Please confirm.' };
}

export default function PolicyForm({
  mode, cls, clients, principals, agents, initial, extraction, matchedClientId, isDuplicate, sourceFile,
}: PolicyFormProps) {
  const [state, action, pending] = useActionState(savePolicyAction, null as { error?: string } | null);
  const [useExisting, setUseExisting] = useState(Boolean(matchedClientId));
  const [allowDuplicate, setAllowDuplicate] = useState(false);

  const v = (k: string) => {
    const raw = initial[k];
    return raw === null || raw === undefined ? '' : String(raw);
  };

  const Field = ({
    name, label, type = 'text', span = 1, required, placeholder, step,
  }: {
    name: string; label: string; type?: string; span?: number; required?: boolean;
    placeholder?: string; step?: string;
  }) => {
    const meta = extraction?.fields[name as FieldKey];
    const chip = extraction ? chipFor(meta) : null;
    return (
      <div className={span === 2 ? 'sm:col-span-2' : ''}>
        <div className="mb-1 flex items-center justify-between gap-2">
          <label htmlFor={name} className="text-[12px] font-semibold text-ink-soft">
            {label}
            {required && <span className="ml-0.5 text-brand">*</span>}
          </label>
          {chip && (
            <span className={`badge ${chip.cls}`} title={chip.title}>
              {chip.label}
            </span>
          )}
        </div>
        <input
          id={name}
          name={name}
          type={type}
          step={step}
          required={required}
          placeholder={placeholder}
          defaultValue={v(name)}
          className="inp"
        />
        {meta?.evidence && meta.confidence < 0.95 && (
          <p className="mt-1 truncate text-[11px] text-muted" title={meta.evidence}>
            from: {meta.evidence}
          </p>
        )}
      </div>
    );
  };

  const Select = ({
    name, label, options, defaultValue, span = 1,
  }: { name: string; label: string; options: Option[]; defaultValue?: string; span?: number }) => (
    <div className={span === 2 ? 'sm:col-span-2' : ''}>
      <label htmlFor={name} className="mb-1 block text-[12px] font-semibold text-ink-soft">{label}</label>
      <select id={name} name={name} defaultValue={defaultValue ?? v(name)} className="inp cursor-pointer">
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <section className="panel">
      <div className="panel-head">{title}</div>
      <div className="grid gap-4 px-5 py-5 sm:grid-cols-2 xl:grid-cols-4">{children}</div>
    </section>
  );

  return (
    <form action={action} className="space-y-4">
      {mode === 'edit' && <input type="hidden" name="policy_id" value={v('policy_id')} />}
      <input type="hidden" name="class" value={cls} />
      {sourceFile && <input type="hidden" name="source_file" value={sourceFile} />}
      {extraction?.principal && <input type="hidden" name="principal_detected" value={extraction.principal} />}
      {allowDuplicate && <input type="hidden" name="allow_duplicate" value="1" />}

      <Section title="Policy">
        <Field name="policy_no" label="Policy no" required />
        <Field name="cover_note_no" label="Cover note no" />
        <Select
          name="principal_id"
          label="Principal"
          defaultValue={v('principal_id')}
          options={[{ value: '', label: 'Select principal…' }, ...principals]}
        />
        <Select
          name="sub_agent_id"
          label="Servicing agent"
          options={[{ value: '', label: 'Unassigned' }, ...agents]}
        />
        <Field name="product" label="Product" placeholder={cls === 'motor' ? 'Private Car' : 'Fire & Perils'} />
        <Field name="type_of_cover" label="Type of cover" placeholder="Comprehensive" />
        <Select
          name="status"
          label="Status"
          options={[
            { value: 'active', label: 'Active' },
            { value: 'quotation', label: 'Quotation' },
            { value: 'expired', label: 'Expired' },
            { value: 'cancelled', label: 'Cancelled' },
          ]}
        />
        <Select
          name="case_type"
          label="Case type"
          options={[
            { value: 'new', label: 'New business' },
            { value: 'renewal', label: 'Renewal' },
            { value: 'endorsement', label: 'Endorsement' },
          ]}
        />
        <Field name="issue_date" label="Issue date" type="date" />
        <Field name="effective_date" label="Effective date" type="date" required />
        <Field name="expiry_date" label="Expiry date" type="date" required />
      </Section>

      <Section title="Insured">
        <div className="sm:col-span-2 xl:col-span-4">
          <div className="mb-2 flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-[13px] text-ink-soft">
              <input
                type="radio"
                name="client_mode"
                checked={useExisting}
                onChange={() => setUseExisting(true)}
                disabled={clients.length === 0}
              />
              Use an existing client
            </label>
            <label className="flex items-center gap-2 text-[13px] text-ink-soft">
              <input type="radio" name="client_mode" checked={!useExisting} onChange={() => setUseExisting(false)} />
              Create a new client from this policy
            </label>
            {matchedClientId && (
              <span className="badge badge-green" title="An existing client matched the insured on this document.">
                matched an existing client
              </span>
            )}
          </div>
        </div>

        {useExisting ? (
          <div className="sm:col-span-2">
            <label htmlFor="client_id" className="mb-1 block text-[12px] font-semibold text-ink-soft">Client</label>
            <select id="client_id" name="client_id" defaultValue={matchedClientId ?? v('client_id')} className="inp cursor-pointer">
              <option value="">Select client…</option>
              {clients.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
        ) : (
          <>
            <Field name="insured_name" label="Insured name" span={2} required />
            <Field name="nric" label="NRIC / business reg no" />
            <Field name="occupation" label="Occupation" />
            <Field name="address" label="Address" span={2} />
          </>
        )}
      </Section>

      {cls === 'motor' ? (
        <Section title="Vehicle">
          <Field name="vehicle_no" label="Registration no" />
          <Field name="make_model" label="Make & model" span={2} />
          <Field name="body_type" label="Body type" />
          <Field name="engine_no" label="Engine no" />
          <Field name="chassis_no" label="Chassis no" />
          <Field name="engine_cc" label="Engine capacity (CC)" />
          <Field name="year_make" label="Year of manufacture" />
          <Field name="seating" label="Seating capacity" type="number" />
          <Field name="hire_purchase" label="Hire purchase owner" />
          <Field name="named_drivers" label="Authorised drivers" span={2} />
          <Field name="windscreen_si" label="Windscreen sum insured" type="number" step="0.01" />
        </Section>
      ) : (
        <Section title="Risk">
          <Field name="risk_type" label="Class of risk" span={2} />
          <Field name="occupancy" label="Occupancy" span={2} />
          <Field name="risk_address" label="Situation of risk" span={2} />
          <Field name="period_desc" label="Period" />
          <Field name="benefits" label="Benefits / sums insured" span={2} />
        </Section>
      )}

      <Section title="Premium and commission">
        <Field name="sum_insured" label="Sum insured" type="number" step="0.01" />
        <Field name="ncd_pct" label="NCD %" type="number" step="0.01" />
        <Field name="excess" label="Excess" type="number" step="0.01" />
        <Field name="extra_premium" label="Extra cover premium" type="number" step="0.01" />
        <Field name="basic_premium" label="Basic premium" type="number" step="0.01" />
        <Field name="gross_premium" label="Gross premium" type="number" step="0.01" />
        <Field name="service_tax" label="Service tax" type="number" step="0.01" />
        <Field name="stamp_duty" label="Stamp duty" type="number" step="0.01" />
        <Field name="total_premium" label="Total payable" type="number" step="0.01" />
        <Field name="commission_rate" label="Commission rate %" type="number" step="0.01" />
        <Field name="commission_amt" label="Total commission" type="number" step="0.01" />
        <Field name="agent_commission" label="Agent commission" type="number" step="0.01" />
        <Field name="referral_fee" label="Referral fee" type="number" step="0.01" />
        <Field name="remarks" label="Remarks" span={2} />
      </Section>

      {isDuplicate && (
        <label className="flex items-center gap-2 rounded border border-[#f3c9c5] bg-[#fdeceb] px-4 py-3 text-[13px] text-[#b32b21]">
          <input type="checkbox" checked={allowDuplicate} onChange={(e) => setAllowDuplicate(e.target.checked)} />
          A policy with this number already exists — save it anyway.
        </label>
      )}

      {state?.error && (
        <p role="alert" className="rounded border border-[#f3c9c5] bg-[#fdeceb] px-4 py-3 text-[13px] text-[#b32b21]">
          {state.error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="btn btn-primary disabled:opacity-60">
          {pending ? 'Saving…' : mode === 'edit' ? 'Save changes' : 'Save policy'}
        </button>
        <a href={`/insurance/${cls === 'motor' ? 'motor' : 'non-motor'}`} className="btn btn-ghost">Cancel</a>
      </div>
    </form>
  );
}
