'use client';

import { useActionState, useState } from 'react';
import { savePolicyAction, type SaveState } from '@/lib/policy-actions';
import type { ExtractionResult, FieldKey } from '@/lib/extract';
import { classSlug } from '@/lib/format';

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
  /** The stored upload, so saving ties the file to the policy it produced. */
  documentId?: string | null;
};

function chipFor(f: { value: unknown; confidence: number; source: string } | undefined, key: string) {
  if (!f || f.value === null) {
    return { label: 'not found', cls: 'badge-grey', title: 'The document did not state this — please enter it.' };
  }
  /*
   * A cover note carries no policy number, so the reader stands the cover
   * note's number in and says so. That is not "worked out from the other
   * premium figures", and a tooltip that said it was taught people to
   * distrust the badge — this one says what actually happened.
   */
  if (f.source === 'derived' && key === 'policy_no') {
    return {
      label: 'from cover note',
      cls: 'badge-amber',
      title: 'No policy number has been issued yet; the cover note number is standing in. Correct it when the insurer issues one.',
    };
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


type PFieldProps = {
  name: string;
  label: string;
  type?: string;
  span?: number;
  required?: boolean;
  placeholder?: string;
  step?: string;
  defaultValue?: string;
  chip?: { label: string; cls: string; title: string } | null;
  evidence?: string;
};

function PField({
  name, label, type = 'text', span = 1, required, placeholder, step, defaultValue, chip, evidence,
}: PFieldProps) {
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
        key={`${name}-${defaultValue ?? ''}`}
        defaultValue={defaultValue}
        className="inp"
      />
      {evidence && (
        <p className="mt-1 truncate text-[11px] text-muted" title={evidence}>
          from: {evidence}
        </p>
      )}
    </div>
  );
}

function PSelect({
  name, label, options, defaultValue, span = 1,
}: { name: string; label: string; options: Option[]; defaultValue?: string; span?: number }) {
  return (
    <div className={span === 2 ? 'sm:col-span-2' : ''}>
      <label htmlFor={name} className="mb-1 block text-[12px] font-semibold text-ink-soft">{label}</label>
      <select
        id={name}
        name={name}
        key={`${name}-${defaultValue ?? ''}`}
        defaultValue={defaultValue}
        className="inp cursor-pointer"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

function PSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="panel">
      <div className="panel-head">{title}</div>
      <div className="grid gap-4 px-5 py-5 sm:grid-cols-2 xl:grid-cols-4">{children}</div>
    </section>
  );
}

export default function PolicyForm({
  mode, cls, clients, principals, agents, initial, extraction, matchedClientId, isDuplicate, sourceFile,
  documentId,
}: PolicyFormProps) {
  const [state, action, pending] = useActionState(savePolicyAction, null as SaveState | null);
  /*
   * A renewal arrives with the client already known, the same as an upload that
   * matched one. Without this the form opens on "create a new client" with an
   * empty required name, and the browser blocks the submit with no explanation
   * — no server error, no navigation, nothing to read.
   */
  const [useExisting, setUseExisting] = useState(Boolean(matchedClientId || initial.client_id));
  const [allowDuplicate, setAllowDuplicate] = useState(false);

  /** Echoed submission wins, so a rejected save does not empty the form. */
  const v = (k: string) => {
    const echoed = state?.values?.[k];
    if (echoed !== undefined) return echoed;
    const raw = initial[k];
    return raw === null || raw === undefined ? '' : String(raw);
  };


  /*
   * The form calls the total `total_premium`, the column it is stored in; the
   * reader calls it `total_payable`, the words on the schedule. Looked up by
   * form name alone, the total's badge could only ever say "not found".
   */
  const READ_AS: Record<string, FieldKey> = { total_premium: 'total_payable' };

  const fieldProps = (name: string) => {
    const meta = extraction?.fields[READ_AS[name] ?? (name as FieldKey)];
    return {
      defaultValue: v(name),
      chip: extraction ? chipFor(meta, READ_AS[name] ?? name) : null,
      evidence: meta?.evidence && meta.confidence < 0.95 ? meta.evidence : undefined,
    };
  };

  return (
    <form action={action} className="space-y-4">
      {mode === 'edit' && <input type="hidden" name="policy_id" value={v('policy_id')} />}
      <input type="hidden" name="class" value={cls} />
      {sourceFile && <input type="hidden" name="source_file" value={sourceFile} />}
      {documentId && <input type="hidden" name="document_id" value={documentId} />}
      {v('renewed_from') && <input type="hidden" name="renewed_from" value={v('renewed_from')} />}
      {extraction?.principal && <input type="hidden" name="principal_detected" value={extraction.principal} />}
      {allowDuplicate && <input type="hidden" name="allow_duplicate" value="1" />}

      <PSection title="Policy">
        <PField name="policy_no" {...fieldProps("policy_no")} label="Policy no" required />
        <PField name="cover_note_no" {...fieldProps("cover_note_no")} label="Cover note no" />
        <PSelect name="principal_id"
          label="Principal"
          defaultValue={v('principal_id')}
          options={[{ value: '', label: 'Select principal…' }, ...principals]}
        />
        <PSelect name="sub_agent_id"
          defaultValue={v('sub_agent_id')}
          label="Servicing agent"
          options={[{ value: '', label: 'Unassigned' }, ...agents]}
        />
        <PField name="product" {...fieldProps("product")} label="Product" placeholder={cls === 'motor' ? 'Private Car' : 'Fire & Perils'} />
        <PField name="type_of_cover" {...fieldProps("type_of_cover")} label="Type of cover" placeholder="Comprehensive" />
        <PSelect name="status"
          defaultValue={v('status')}
          label="Status"
          options={[
            { value: 'active', label: 'Active' },
            { value: 'quotation', label: 'Quotation' },
            { value: 'expired', label: 'Expired' },
            { value: 'cancelled', label: 'Cancelled' },
          ]}
        />
        <PSelect name="case_type"
          defaultValue={v('case_type')}
          label="Case type"
          options={[
            { value: 'new', label: 'New business' },
            { value: 'renewal', label: 'Renewal' },
            { value: 'endorsement', label: 'Endorsement' },
          ]}
        />
        <PField name="issue_date" {...fieldProps("issue_date")} label="Issue date" type="date" />
        <PField name="effective_date" {...fieldProps("effective_date")} label="Effective date" type="date" required />
        <PField name="expiry_date" {...fieldProps("expiry_date")} label="Expiry date" type="date" required />
      </PSection>

      <PSection title="Insured">
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
            <PField name="insured_name" {...fieldProps("insured_name")} label="Insured name" span={2} required />
            <PField name="nric" {...fieldProps("nric")} label="NRIC / business reg no" />
            <PField name="occupation" {...fieldProps("occupation")} label="Occupation" />
            <PField name="address" {...fieldProps("address")} label="Address" span={2} />
          </>
        )}
      </PSection>

      {cls === 'motor' ? (
        <PSection title="Vehicle">
          <PField name="vehicle_no" {...fieldProps("vehicle_no")} label="Registration no" />
          <PField name="make_model" {...fieldProps("make_model")} label="Make & model" span={2} />
          <PField name="body_type" {...fieldProps("body_type")} label="Body type" />
          <PField name="engine_no" {...fieldProps("engine_no")} label="Engine no" />
          <PField name="chassis_no" {...fieldProps("chassis_no")} label="Chassis no" />
          <PField name="engine_cc" {...fieldProps("engine_cc")} label="Engine capacity (CC)" />
          <PField name="year_make" {...fieldProps("year_make")} label="Year of manufacture" />
          <PField name="seating" {...fieldProps("seating")} label="Seating capacity" type="number" />
          <PField name="hire_purchase" {...fieldProps("hire_purchase")} label="Hire purchase owner" />
          <PField name="named_drivers" {...fieldProps("named_drivers")} label="Authorised drivers" span={2} />
          <PField name="windscreen_si" {...fieldProps("windscreen_si")} label="Windscreen sum insured" type="number" step="0.01" />
        </PSection>
      ) : (
        <PSection title="Risk">
          <PField name="risk_type" {...fieldProps("risk_type")} label="Class of risk" span={2} />
          <PField name="occupancy" {...fieldProps("occupancy")} label="Occupancy" span={2} />
          <PField name="risk_address" {...fieldProps("risk_address")} label="Situation of risk" span={2} />
          <PField name="period_desc" {...fieldProps("period_desc")} label="Period" />
          <PField name="benefits" {...fieldProps("benefits")} label="Benefits / sums insured" span={2} />
        </PSection>
      )}

      <PSection title="Premium and commission">
        <PField name="sum_insured" {...fieldProps("sum_insured")} label="Sum insured" type="number" step="0.01" />
        <PField name="ncd_pct" {...fieldProps("ncd_pct")} label="NCD %" type="number" step="0.01" />
        <PField name="excess" {...fieldProps("excess")} label="Excess" type="number" step="0.01" />
        <PField name="extra_premium" {...fieldProps("extra_premium")} label="Extra cover premium" type="number" step="0.01" />
        <PField name="basic_premium" {...fieldProps("basic_premium")} label="Basic premium" type="number" step="0.01" />
        <PField name="gross_premium" {...fieldProps("gross_premium")} label="Gross premium" type="number" step="0.01" />
        <PField name="service_tax" {...fieldProps("service_tax")} label="Service tax" type="number" step="0.01" />
        <PField name="stamp_duty" {...fieldProps("stamp_duty")} label="Stamp duty" type="number" step="0.01" />
        <PField name="total_premium" {...fieldProps("total_premium")} label="Total payable" type="number" step="0.01" />
        <PField name="commission_rate" {...fieldProps("commission_rate")} label="Commission rate %" type="number" step="0.01" />
        <PField name="commission_amt" {...fieldProps("commission_amt")} label="Total commission" type="number" step="0.01" />
        <PField name="agent_commission" {...fieldProps("agent_commission")} label="Agent commission" type="number" step="0.01" />
        <PField name="referral_fee" {...fieldProps("referral_fee")} label="Referral fee" type="number" step="0.01" />
        <PField name="remarks" {...fieldProps("remarks")} label="Remarks" span={2} />
      </PSection>

      {isDuplicate && (
        <label className="flex items-center gap-2 rounded border border-danger-line bg-danger-wash px-4 py-3 text-[13px] text-danger">
          <input type="checkbox" checked={allowDuplicate} onChange={(e) => setAllowDuplicate(e.target.checked)} />
          A policy with this number already exists — save it anyway.
        </label>
      )}

      {state?.error && (
        <p role="alert" className="rounded border border-danger-line bg-danger-wash px-4 py-3 text-[13px] text-danger">
          {state.error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="btn btn-primary disabled:opacity-60">
          {pending ? 'Saving…' : mode === 'edit' ? 'Save changes' : 'Save policy'}
        </button>
        <a href={`/insurance/${classSlug(cls)}`} className="btn btn-ghost">Cancel</a>
      </div>
    </form>
  );
}
