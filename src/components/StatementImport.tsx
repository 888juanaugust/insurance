'use client';

import Link from 'next/link';
import { useActionState, useEffect, useState } from 'react';
import {
  previewStatementAction, commitStatementAction, type StatementState,
} from '@/lib/statement-actions';
import { STATEMENT_COLUMNS } from '@/lib/statements';
import { money, longDate } from '@/lib/format';

const MAX_MB = 5;

type Principal = { id: string; short_name: string; name: string };

/* At module scope on purpose: declared inside the component, Field becomes a
 * new type every render and React remounts each input, emptying it. */
function Field({
  name, label, type = 'text', required, hint, error, defaultValue, placeholder, span,
}: {
  name: string; label: string; type?: string; required?: boolean; hint?: string;
  error?: boolean; defaultValue?: string; placeholder?: string; span?: number;
}) {
  return (
    <div className={span === 2 ? 'sm:col-span-2' : undefined}>
      <label htmlFor={name} className="mb-1 block text-[12px] font-semibold text-ink-soft">
        {label}
        {required && <span className="ml-0.5 text-brand">*</span>}
      </label>
      {/* Uncontrolled and keyed to the echoed value: React resets the form
          after a server action, and an input keeping its value only in React
          state comes back from a refusal blank. */}
      <input
        id={name}
        name={name}
        type={type}
        placeholder={placeholder}
        key={`${name}-${defaultValue ?? ''}`}
        defaultValue={defaultValue}
        className={`inp ${error ? 'border-brand' : ''}`}
      />
      {hint && <p className="mt-1 text-[12px] text-muted">{hint}</p>}
    </div>
  );
}

function Tile({ label, value, tone = 'plain', note }: {
  label: string; value: string; tone?: 'plain' | 'good' | 'bad' | 'warn'; note?: string;
}) {
  const tones = {
    plain: 'border-line text-ink',
    good: 'border-[#bfe0cd] bg-ok-wash text-ok',
    bad: 'border-[#f3c9c5] bg-danger-wash text-danger',
    warn: 'border-[#f0dcb4] bg-warn-wash text-warn',
  };
  return (
    <div className={`rounded border px-4 py-3 ${tones[tone]}`}>
      <p className="text-[19px] font-semibold tabular-nums">{value}</p>
      <p className="mt-0.5 text-[12px]">{label}</p>
      {note && <p className="mt-0.5 text-[11px] opacity-80">{note}</p>}
    </div>
  );
}

const BASIS_LABEL: Record<string, string> = {
  policy_no: 'policy no',
  cover_note: 'cover note',
  vehicle: 'vehicle',
  manual: 'by hand',
  none: '—',
};

export default function StatementImport({ principals }: { principals: Principal[] }) {
  const [state, previewAction, previewing] = useActionState(
    previewStatementAction, null as StatementState | null,
  );
  const [commitState, commitAction, committing] = useActionState(
    commitStatementAction, null as StatementState | null,
  );
  const [fileName, setFileName] = useState('');
  const [sizeError, setSizeError] = useState('');
  const [showAll, setShowAll] = useState(false);

  const form = commitState?.form ?? state?.form;
  const preview = state?.preview;

  /*
   * React resets the form once the action returns, and a reset empties a file
   * input — no page is allowed to put a file back. So after a refusal the file
   * really is gone while every other field still holds what was typed, and a
   * label going on naming it sends somebody round the loop a second time
   * wondering why it now says the file is missing.
   */
  useEffect(() => { setFileName(''); }, [state]);

  /* ---------------------------------------------------------- the preview */
  if (state?.ok && preview && state.text) {
    const { result } = preview;
    const shown = showAll ? preview.rows : preview.rows.slice(0, 60);
    const lineByNo = new Map(result.lines.map((l) => [l.line, l]));
    const outcomeByPolicy = new Map(result.outcomes.map((o) => [o.policy_id, o]));
    const short = result.outcomes.filter((o) => o.state === 'short');

    return (
      <div className="space-y-4">
        <div className="panel px-6 py-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-[16px] font-semibold text-ink">Check before importing</h2>
              <p className="mt-1 text-[13px] text-ink-soft">
                Nothing has been written. {preview.filename} · {preview.principal} ·{' '}
                {longDate(preview.period_start)} to {longDate(preview.period_end)}
              </p>
            </div>
            <Link href="/accounting/statements/new" className="btn btn-ghost">Start again</Link>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Tile label="lines on the statement" value={String(preview.rows.length)} />
            <Tile label="the insurer says it paid" value={money(result.totals.paid)} />
            <Tile
              label="short paid"
              value={money(Math.abs(result.totals.shortfall))}
              tone={short.length ? 'bad' : 'good'}
              note={`${short.length} case${short.length === 1 ? '' : 's'}`}
            />
            <Tile
              label="left off the statement"
              value={money(result.totals.missingValue)}
              tone={result.missing.length ? 'warn' : 'good'}
              note={`${result.missing.length} case${result.missing.length === 1 ? '' : 's'}`}
            />
          </div>

          {result.unmatched.length > 0 && (
            <p className="mt-4 rounded border border-[#f0dcb4] bg-warn-wash px-4 py-2.5 text-[12.5px] text-warn">
              {result.unmatched.length} line{result.unmatched.length === 1 ? '' : 's'} worth{' '}
              <strong>{money(result.totals.unmatchedValue)}</strong> could not be matched to anything on
              the register. {result.unmatched.length === 1 ? 'It' : 'They'} will be imported and can be
              assigned by hand afterwards.
            </p>
          )}

          {preview.unrecognised.length > 0 && (
            <p className="mt-3 text-[12.5px] text-muted">
              Columns not read: <strong>{preview.unrecognised.join(', ')}</strong>.
            </p>
          )}
          {preview.ragged.length > 0 && (
            <p className="mt-2 text-[12.5px] text-warn">
              {preview.ragged.length} line{preview.ragged.length === 1 ? ' has' : 's have'} a different
              number of columns from the header — usually a stray comma. Check{' '}
              {preview.ragged.slice(0, 5).map((r) => r.line).join(', ')}.
            </p>
          )}
        </div>

        <div className="panel">
          <div className="panel-head">
            Lines
            <span className="ml-auto text-[12px] font-normal text-muted">
              showing {shown.length} of {preview.rows.length}
            </span>
          </div>
          <div className="scroll-x">
            <table className="tbl">
              <thead>
                <tr>
                  <th className="w-14">Line</th>
                  <th>Policy no</th>
                  <th>Insured</th>
                  <th className="num">Paid</th>
                  <th className="num">On the book</th>
                  <th className="num">Difference</th>
                  <th>Matched on</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((row) => {
                  const line = lineByNo.get(row.line);
                  const outcome = line?.policy_id ? outcomeByPolicy.get(line.policy_id) : undefined;
                  const bad = !line?.policy_id || outcome?.state === 'short';
                  return (
                    <tr key={row.line} className={bad ? 'bg-danger-wash' : undefined}>
                      <td className="text-muted tabular-nums">{row.line}</td>
                      <td className="text-ink">{row.policy_no || row.cover_note_no || row.vehicle_no || '—'}</td>
                      <td className="max-w-[220px] truncate text-ink-soft">
                        {row.insured || '—'}
                        {line?.matched_insured && line.matched_insured !== row.insured && (
                          <span className="block text-[11px] text-muted">on file as {line.matched_insured}</span>
                        )}
                      </td>
                      <td className="num">{money(row.commission ?? 0)}</td>
                      <td className="num text-ink-soft">{outcome ? money(outcome.expected) : '—'}</td>
                      <td className={`num ${outcome && outcome.state !== 'agreed' ? 'font-semibold text-danger' : 'text-muted'}`}>
                        {outcome ? (outcome.state === 'agreed' ? '—' : money(outcome.variance)) : '—'}
                      </td>
                      <td>
                        {line?.policy_id ? (
                          <span className="badge badge-green">{BASIS_LABEL[line.basis]}</span>
                        ) : (
                          <span className="badge badge-amber">no match</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {preview.rows.length > shown.length && (
            <div className="border-t border-line px-5 py-3">
              <button type="button" onClick={() => setShowAll(true)} className="btn btn-ghost h-8">
                Show all {preview.rows.length} lines
              </button>
            </div>
          )}
        </div>

        {result.missing.length > 0 && (
          <div className="panel">
            <div className="panel-head">
              Written in this period, not on the statement
              <span className="ml-auto text-[12px] font-normal text-muted">
                {money(result.totals.missingValue)} across {result.missing.length}
              </span>
            </div>
            <div className="scroll-x">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Policy no</th><th>Insured</th><th>Effective</th>
                    <th className="num">Gross premium</th><th className="num">Commission due</th>
                  </tr>
                </thead>
                <tbody>
                  {result.missing.map((p) => (
                    <tr key={p.id}>
                      <td className="text-ink">{p.policy_no}</td>
                      <td className="text-ink-soft">{p.insured}</td>
                      <td className="text-ink-soft">{longDate(p.effective_date)}</td>
                      <td className="num text-ink-soft">{money(p.gross_premium)}</td>
                      <td className="num font-semibold">{money(p.commission_amt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <form action={commitAction} className="panel px-6 py-5">
          <input type="hidden" name="text" value={state.text} />
          <input type="hidden" name="filename" value={preview.filename} />
          <input type="hidden" name="principal_id" value={preview.principal_id} />
          <input type="hidden" name="reference" value={preview.reference} />
          <input type="hidden" name="period_start" value={preview.period_start} />
          <input type="hidden" name="period_end" value={preview.period_end} />
          <input type="hidden" name="statement_date" value={preview.statement_date} />
          <input type="hidden" name="note" value={preview.note} />
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" disabled={committing} className="btn btn-primary disabled:opacity-60">
              {committing ? 'Importing…' : `Import ${preview.rows.length} lines`}
            </button>
            <span className="text-[12.5px] text-muted">
              The statement is stored as it stands. Nothing on the register is changed by importing it.
            </span>
          </div>
          {commitState?.error && (
            <p role="alert" className="mt-3 text-[12.5px] font-medium text-danger">{commitState.error}</p>
          )}
        </form>
      </div>
    );
  }

  /* ----------------------------------------------------------- the upload */
  return (
    <form action={previewAction} className="panel max-w-[820px] px-6 py-6">
      <h2 className="text-[15px] font-semibold text-ink">Check a commission statement</h2>
      <p className="mt-1 text-[13px] text-ink-soft">
        Save the insurer&rsquo;s statement as CSV and drop it in. Every line is set against the register
        and shown to you before anything is stored.
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="principal_id" className="mb-1 block text-[12px] font-semibold text-ink-soft">
            Insurer<span className="ml-0.5 text-brand">*</span>
          </label>
          <select
            id="principal_id"
            name="principal_id"
            key={`principal-${form?.principal_id ?? ''}`}
            defaultValue={form?.principal_id ?? ''}
            className="inp cursor-pointer"
          >
            <option value="">Choose the insurer…</option>
            {principals.map((p) => (
              <option key={p.id} value={p.id}>{p.short_name} — {p.name}</option>
            ))}
          </select>
        </div>
        <Field
          name="reference" label="Statement reference" required
          defaultValue={form?.reference}
          placeholder="e.g. AZ/COMM/2026/03"
          hint="The number the insurer put on it, so the same statement is never imported twice."
        />
        <Field
          name="period_start" label="Period from" type="date" required
          defaultValue={form?.period_start}
        />
        <Field
          name="period_end" label="Period to" type="date" required
          defaultValue={form?.period_end}
          hint="The months of business the statement is answering for — not when it was paid."
        />
        <Field name="statement_date" label="Statement date" type="date" defaultValue={form?.statement_date} />
        <Field name="note" label="Note" defaultValue={form?.note} placeholder="Optional" />
      </div>

      <label
        htmlFor="file"
        className="mt-5 flex cursor-pointer flex-col items-center justify-center rounded border-2 border-dashed border-line px-6 py-10 text-center hover:border-accent hover:bg-[#f8fbff]"
      >
        <span className="text-[13.5px] font-semibold text-ink">{fileName || 'Choose a CSV file'}</span>
        <span className="mt-1 text-[12px] text-muted">Up to {MAX_MB} MB · 5,000 lines</span>
        <input
          id="file"
          name="file"
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          onChange={(e) => {
            const chosen = e.target.files?.[0];
            setFileName(chosen?.name ?? '');
            setSizeError(
              chosen && chosen.size > MAX_MB * 1024 * 1024
                ? `That file is ${(chosen.size / 1024 / 1024).toFixed(1)} MB. The limit is ${MAX_MB} MB.`
                : '',
            );
          }}
        />
      </label>

      <div className="mt-4 rounded border border-line bg-[#fafbfc] px-4 py-3">
        <p className="sec-label mb-1.5">Columns it looks for</p>
        <p className="text-[12.5px] text-ink-soft">
          {STATEMENT_COLUMNS.map((c) => c.label).join(' · ')}
        </p>
        <p className="mt-1.5 text-[12px] text-muted">
          Headers are matched loosely — <code>Policy No.</code>, <code>No Polisi</code> and{' '}
          <code>Certificate No</code> all find the same column. A statement needs at least something to
          identify the case by and the commission paid; a clawback in brackets is read as a negative.
        </p>
      </div>

      {(state?.error || sizeError) && (
        <div role="alert" className="mt-4 rounded border border-[#f3c9c5] bg-danger-wash px-4 py-3 text-[13px] text-danger">
          <p>{sizeError || state?.error}</p>
          {state?.error && !sizeError && (
            <p className="mt-1 text-[12.5px] opacity-80">
              Everything else you typed is still here — choose the file again and submit.
            </p>
          )}
        </div>
      )}

      <button type="submit" disabled={previewing || Boolean(sizeError)} className="btn btn-primary mt-5 disabled:opacity-60">
        {previewing ? 'Reading…' : 'Check the statement'}
      </button>
    </form>
  );
}
