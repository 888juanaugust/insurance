'use client';

import { useActionState, useState } from 'react';
import Link from 'next/link';
import { uploadPolicyAction, type UploadState } from '@/lib/policy-actions';
import PolicyForm, { type Option } from './PolicyForm';
import type { FieldKey } from '@/lib/extract';
import { classSlug } from '@/lib/format';

type Props = {
  cls: 'motor' | 'non_motor';
  clients: Option[];
  principals: Array<Option & { motor_rate: number; non_motor_rate: number }>;
  agents: Option[];
  claudeReady: boolean;
};

const MAX_MB = 15;

export default function UploadWorkbench({ cls, clients, principals, agents, claudeReady }: Props) {
  const [state, action, pending] = useActionState(uploadPolicyAction, null as UploadState | null);
  const [fileName, setFileName] = useState('');
  const [sizeError, setSizeError] = useState('');

  if (state?.ok && state.result) {
    return <Review state={state} cls={cls} clients={clients} principals={principals} agents={agents} />;
  }

  return (
    <div className="max-w-[720px]">
      <form action={action} className="panel px-6 py-6">
        <h2 className="text-[15px] font-semibold text-ink">Upload a policy document</h2>
        <p className="mt-1 text-[13px] text-ink-soft">
          Drop in the PDF the insurer issued — schedule, cover note or certificate. The document is
          read, the fields are filled in for you, and you confirm them before anything is saved.
        </p>

        <label
          htmlFor="file"
          className="mt-5 flex cursor-pointer flex-col items-center justify-center rounded border-2 border-dashed border-line px-6 py-10 text-center transition-colors hover:border-accent hover:bg-[#f8fbff]"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mb-3 h-8 w-8 text-muted">
            <path d="M12 16V4" strokeLinecap="round" />
            <path d="m7.5 8.5 4.5-4.5 4.5 4.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M4 15v3.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V15" strokeLinecap="round" />
          </svg>
          <span className="text-[13.5px] font-semibold text-ink">
            {fileName || 'Choose a PDF policy document'}
          </span>
          <span className="mt-1 text-[12px] text-muted">Any insurer, any layout · up to 15 MB</span>
          <input
            id="file"
            name="file"
            type="file"
            accept="application/pdf,.pdf"
            required
            className="sr-only"
            onChange={(e) => {
              const chosen = e.target.files?.[0];
              setFileName(chosen?.name ?? '');
              // Catch this here: an oversized body is rejected by the server
              // before the action runs, which surfaces as a hang rather than
              // a message.
              setSizeError(
                chosen && chosen.size > MAX_MB * 1024 * 1024
                  ? `That file is ${(chosen.size / 1024 / 1024).toFixed(1)} MB. The limit is ${MAX_MB} MB.`
                  : '',
              );
            }}
          />
        </label>

        {(sizeError || state?.error) && (
          <p role="alert" className="mt-4 rounded border border-[#f3c9c5] bg-[#fdeceb] px-4 py-3 text-[13px] text-[#b32b21]">
            {sizeError || state?.error}
          </p>
        )}

        <div className="mt-5 flex items-center gap-3">
          <button type="submit" disabled={pending || Boolean(sizeError)} className="btn btn-primary disabled:opacity-60">
            {pending ? 'Reading the document…' : 'Read document'}
          </button>
          <Link href={`/insurance/${classSlug(cls)}/new`} className="btn btn-ghost">
            Key it in instead
          </Link>
        </div>

        <div className="mt-5 rounded border border-line bg-[#f8f9fb] px-4 py-3 text-[12.5px] leading-relaxed text-ink-soft">
          <p className="font-semibold text-ink">How the document is read</p>
          <p className="mt-1">
            Labelled fields are matched against pattern rules covering the common Malaysian motor
            schedule layouts — this runs locally and needs no connection.
            {claudeReady ? (
              <> The document is then also read by the model, and the two readings are compared: agreement
              raises confidence, and disagreement is flagged for you rather than settled silently.</>
            ) : (
              <> Model-assisted reading is switched off because no <code>ANTHROPIC_API_KEY</code> is set, so
              layouts the rules do not cover will come through with blanks for you to fill.</>
            )}
          </p>
        </div>
      </form>
    </div>
  );
}

/* ------------------------------------------------------------------ review */

function Review({
  state, cls, clients, principals, agents,
}: { state: UploadState } & Omit<Props, 'claudeReady'>) {
  const result = state.result!;
  const found = Object.values(result.fields).filter((f) => f.value !== null).length;
  const total = Object.keys(result.fields).length;
  const needsAttention = Object.entries(result.fields).filter(
    ([, f]) => f.value !== null && f.confidence < 0.8,
  ).length;

  const val = (k: FieldKey) => result.fields[k].value;
  const principalMatch = principals.find(
    (p) => result.principal && p.label.toUpperCase() === result.principal.toUpperCase(),
  );
  const detectedCls = result.cls === 'non_motor' ? 'non_motor' : 'motor';
  const rate = principalMatch
    ? detectedCls === 'motor'
      ? principalMatch.motor_rate
      : principalMatch.non_motor_rate
    : 0;
  const gross = typeof val('gross_premium') === 'number' ? (val('gross_premium') as number) : 0;

  const initial: Record<string, string | number | null> = {
    policy_no: val('policy_no'), cover_note_no: val('cover_note_no'),
    principal_id: principalMatch?.value ?? '',
    product: val('product'), type_of_cover: val('type_of_cover'),
    status: 'active', case_type: 'new',
    issue_date: val('issue_date'), effective_date: val('effective_date'), expiry_date: val('expiry_date'),
    insured_name: val('insured_name'), nric: val('nric'), address: val('address'), occupation: val('occupation'),
    vehicle_no: val('vehicle_no'), make_model: val('make_model'), body_type: val('body_type'),
    engine_no: val('engine_no'), chassis_no: val('chassis_no'), engine_cc: val('engine_cc'),
    year_make: val('year_make'), seating: val('seating'), hire_purchase: val('hire_purchase'),
    named_drivers: val('named_drivers'), windscreen_si: val('windscreen_si'),
    sum_insured: val('sum_insured'), ncd_pct: val('ncd_pct'), excess: val('excess'),
    basic_premium: val('basic_premium'), gross_premium: val('gross_premium'),
    service_tax: val('service_tax'), stamp_duty: val('stamp_duty'), total_premium: val('total_payable'),
    commission_rate: rate,
    commission_amt: rate && gross ? Math.round(gross * (rate / 100) * 100) / 100 : '',
    agent_commission: '', referral_fee: 0,
  };

  return (
    <div className="space-y-4">
      <div className="panel px-6 py-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-[16px] font-semibold text-ink">Check what was read</h2>
            <p className="mt-1 text-[13px] text-ink-soft">
              {state.documentId ? (
                <a
                  href={`/api/documents/${state.documentId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-brand hover:underline"
                >
                  {state.filename}
                </a>
              ) : (
                state.filename
              )}{' '}
              · {result.pageCount} page{result.pageCount === 1 ? '' : 's'} ·{' '}
              <span className="font-semibold text-ink">{found} of {total}</span> fields found
              {result.principal && (
                <> · principal detected as <span className="font-semibold text-brand">{result.principal}</span></>
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`badge ${result.usedClaude ? 'badge-blue' : 'badge-grey'}`}>
              {result.usedClaude ? 'rules + model' : 'rules only'}
            </span>
            {needsAttention > 0 && (
              <span className="badge badge-amber">{needsAttention} to confirm</span>
            )}
            <Link href={`/insurance/${classSlug(cls)}/upload`} className="btn btn-ghost">
              Upload another
            </Link>
          </div>
        </div>

        {state.duplicateOf && (
          <p className="mt-4 rounded border border-[#f3c9c5] bg-[#fdeceb] px-4 py-2.5 text-[13px] text-[#b32b21]">
            Policy <strong>{state.duplicateOf.policy_no}</strong> is already on file.{' '}
            <Link href={`/insurance/${classSlug(cls)}/${state.duplicateOf.id}`} className="underline">
              Open the existing record
            </Link>
            , or tick the confirmation at the bottom to save this one as well.
          </p>
        )}

        {state.sameFileAs && (
          <p className="mt-4 rounded border border-[#f0dcb4] bg-[#fdf8ec] px-4 py-2.5 text-[13px] text-[#7a5a10]">
            This exact file is already on record as <strong>{state.sameFileAs.filename}</strong>,
            uploaded {state.sameFileAs.uploaded_at}
            {state.sameFileAs.policy_no && <> against policy <strong>{state.sameFileAs.policy_no}</strong></>}.
            Saving again would put the same policy on the register twice.
          </p>
        )}

        {result.warnings.length > 0 && (
          <ul className="mt-4 space-y-1.5">
            {result.warnings.map((w, i) => (
              <li key={i} className="rounded border border-[#f0dcb4] bg-[#fdf8ec] px-4 py-2 text-[12.5px] text-[#7a5a10]">
                {w}
              </li>
            ))}
          </ul>
        )}

        <p className="mt-4 text-[12.5px] text-muted">
          Nothing is saved until you press Save policy. Fields marked{' '}
          <span className="badge badge-grey">not found</span> were not stated in the document, and{' '}
          <span className="badge badge-amber">check this</span> means the reading was uncertain.
        </p>
      </div>

      <PolicyForm
        mode="review"
        cls={detectedCls}
        clients={clients}
        principals={principals}
        agents={agents}
        initial={initial}
        extraction={result}
        matchedClientId={state.matchedClient?.id ?? null}
        isDuplicate={Boolean(state.duplicateOf)}
        sourceFile={state.filename}
        documentId={state.documentId ?? null}
      />
    </div>
  );
}
