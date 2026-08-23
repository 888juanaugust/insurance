'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import {
  analyseImportAction, commitImportAction, type ImportState,
} from '@/lib/import-actions';
import { fieldsFor, KIND_LABEL, type ImportKind } from '@/lib/import-spec';

const MAX_MB = 5;

function Counts({ c }: { c: { total: number; ok: number; errors: number; duplicates: number; warnings: number } }) {
  const tile = (label: string, value: number, tone: string) => (
    <div key={label} className={`rounded border px-4 py-3 ${tone}`}>
      <p className="text-[20px] font-semibold tabular-nums">{value}</p>
      <p className="mt-0.5 text-[12px]">{label}</p>
    </div>
  );
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {tile('rows in the file', c.total, 'border-line text-ink')}
      {tile('ready to import', c.ok, 'border-[#bfe0cd] bg-ok-wash text-ok')}
      {tile('with problems', c.errors, c.errors ? 'border-[#f3c9c5] bg-danger-wash text-danger' : 'border-line text-muted')}
      {tile('already on file', c.duplicates, c.duplicates ? 'border-[#f0dcb4] bg-warn-wash text-warn' : 'border-line text-muted')}
    </div>
  );
}

export default function ImportWorkbench() {
  const [state, analyseAction, analysing] = useActionState(analyseImportAction, null as ImportState | null);
  const [commitState, commitAction, committing] = useActionState(commitImportAction, null as ImportState | null);
  const [kind, setKind] = useState<ImportKind>('clients');
  const [fileName, setFileName] = useState('');
  const [sizeError, setSizeError] = useState('');
  const [showAll, setShowAll] = useState(false);

  const done = commitState?.written;
  const analysis = commitState?.analysis ?? state?.analysis;

  if (done) {
    return (
      <div className="space-y-4">
        <div className="panel px-6 py-6">
          <p className="sec-label">Import finished</p>
          <h2 className="mt-2 text-[20px] font-semibold tracking-tight text-ink">
            {done.inserted} {done.inserted === 1 ? KIND_LABEL[done.kind].slice(0, -1).toLowerCase() : KIND_LABEL[done.kind].toLowerCase()} imported
          </h2>
          {done.skipped > 0 ? (
            <p className="mt-2 text-[13.5px] text-ink-soft">
              {done.skipped} row{done.skipped === 1 ? ' was' : 's were'} left out because of the problems
              below. Nothing was written for {done.skipped === 1 ? 'it' : 'them'} — correct the file and
              import again.
            </p>
          ) : (
            <p className="mt-2 text-[13.5px] text-ink-soft">Every row went in.</p>
          )}

          <div className="mt-5 flex flex-wrap gap-3">
            <Link href={done.kind === 'clients' ? '/clients' : '/insurance/general-motor'} className="btn btn-primary">
              See the {done.kind === 'clients' ? 'clients' : 'register'}
            </Link>
            <Link href="/import" className="btn btn-ghost">Import another file</Link>
          </div>
        </div>

        {commitState?.correctionsCsv && (
          <div className="panel">
            <div className="panel-head">Rows left out</div>
            <p className="border-b border-line px-5 py-2.5 text-[12.5px] text-muted">
              Copy this into a file, correct the problem column, and import it on its own.
            </p>
            <pre className="scroll-x max-h-64 overflow-y-auto px-5 py-4 text-[12px] leading-relaxed text-ink-soft">
              {commitState.correctionsCsv}
            </pre>
          </div>
        )}
      </div>
    );
  }

  /* ---------------------------------------------------------- the preview */
  if (state?.ok && analysis && state.text) {
    const shown = showAll ? analysis.rows : analysis.rows.slice(0, 50);
    const mapped = fieldsFor(analysis.kind).filter((f) => analysis.mapping[f.key] !== undefined);

    /*
     * Which columns the preview shows. Required fields identify the row, and
     * after them come the fields the import CHANGED — dates rewritten from
     * 01/03/2026, amounts stripped of their commas. Those are the values most
     * worth a second look, and showing the first few mapped columns instead
     * hides exactly the ones a day-first misreading would ruin.
     */
    const transformed = new Set<string>();
    for (const row of analysis.rows) {
      for (const f of mapped) {
        if (row.raw?.[f.key] && row.values[f.key] && row.raw[f.key] !== row.values[f.key]) {
          transformed.add(f.key);
        }
      }
    }
    const fields = [
      ...mapped.filter((f) => f.required),
      ...mapped.filter((f) => !f.required && transformed.has(f.key)),
      ...mapped.filter((f) => !f.required && !transformed.has(f.key)),
    ].slice(0, 7);

    return (
      <div className="space-y-4">
        <div className="panel px-6 py-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-[16px] font-semibold text-ink">Check before importing</h2>
              <p className="mt-1 text-[13px] text-ink-soft">
                Nothing has been written. {analysis.counts.ok} of {analysis.counts.total} rows are ready.
              </p>
            </div>
            <Link href="/import" className="btn btn-ghost">Start again</Link>
          </div>

          <div className="mt-5"><Counts c={analysis.counts} /></div>

          {analysis.unmatched.length > 0 && (
            <p className="mt-4 rounded border border-[#f0dcb4] bg-[#fdf8ec] px-4 py-2.5 text-[12.5px] text-[#7a5a10]">
              {analysis.unmatched.length} column{analysis.unmatched.length === 1 ? '' : 's'} in the file
              {analysis.unmatched.length === 1 ? ' is' : ' are'} not being imported:{' '}
              <strong>{analysis.unmatched.join(', ')}</strong>. Rename{' '}
              {analysis.unmatched.length === 1 ? 'it' : 'them'} if the data is wanted.
            </p>
          )}

          <div className="mt-4 rounded border border-line px-4 py-3">
            <p className="sec-label mb-2">Columns being read</p>
            <ul className="grid gap-1 text-[12.5px] text-ink-soft sm:grid-cols-2 xl:grid-cols-3">
              {fields.map((f) => (
                <li key={f.key}>
                  <span className="font-medium text-ink">{analysis.headers[analysis.mapping[f.key]]}</span>
                  {' → '}{f.label}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            Rows
            <span className="ml-auto text-[12px] font-normal text-muted">
              showing {shown.length} of {analysis.rows.length}
            </span>
          </div>
          <div className="scroll-x">
            <table className="tbl">
              <thead>
                <tr>
                  <th className="w-16">Line</th>
                  <th className="w-24">State</th>
                  {fields.map((f) => (
                    <th key={f.key}>
                      {f.label}
                      {transformed.has(f.key) && (
                        <span className="ml-1 text-[10px] font-normal text-muted">converted</span>
                      )}
                    </th>
                  ))}
                  <th>Problems</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((row) => (
                  <tr key={row.line} className={row.ok ? undefined : 'bg-danger-wash'}>
                    <td className="text-muted tabular-nums">{row.line}</td>
                    <td>
                      <span className={`badge ${row.ok ? (row.problems.length ? 'badge-amber' : 'badge-green') : 'badge-red'}`}>
                        {row.ok ? (row.problems.length ? 'check' : 'ready') : 'blocked'}
                      </span>
                    </td>
                    {fields.map((f) => (
                      <td key={f.key} className="max-w-[200px] truncate text-ink-soft">
                        {row.values[f.key] || '—'}
                        {row.raw?.[f.key] && row.raw[f.key] !== row.values[f.key] && (
                          <span className="block text-[11px] text-muted" title="as it was in the file">
                            was {row.raw[f.key]}
                          </span>
                        )}
                      </td>
                    ))}
                    <td className="wrap text-[12px]">
                      {row.problems.length ? (
                        <ul className="space-y-0.5">
                          {row.problems.map((p, i) => (
                            <li key={i} className={p.severity === 'error' ? 'text-danger' : 'text-warn'}>
                              {p.message}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {analysis.rows.length > shown.length && (
            <div className="border-t border-line px-5 py-3">
              <button type="button" onClick={() => setShowAll(true)} className="btn btn-ghost h-8">
                Show all {analysis.rows.length} rows
              </button>
            </div>
          )}
        </div>

        <form action={commitAction} className="panel px-6 py-5">
          <input type="hidden" name="kind" value={analysis.kind} />
          <input type="hidden" name="text" value={state.text} />
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={committing || analysis.counts.ok === 0}
              className="btn btn-primary disabled:opacity-60"
            >
              {committing
                ? 'Importing…'
                : `Import ${analysis.counts.ok} ${analysis.counts.ok === 1 ? 'row' : 'rows'}`}
            </button>
            {analysis.counts.errors > 0 && (
              <span className="text-[12.5px] text-muted">
                The {analysis.counts.errors} blocked row{analysis.counts.errors === 1 ? '' : 's'} will be
                left out and given back to you.
              </span>
            )}
            {analysis.counts.ok === 0 && (
              <span className="text-[12.5px] font-medium text-danger">
                No row can be imported as it stands.
              </span>
            )}
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
    <form action={analyseAction} className="panel max-w-[760px] px-6 py-6">
      <h2 className="text-[15px] font-semibold text-ink">Import from a spreadsheet</h2>
      <p className="mt-1 text-[13px] text-ink-soft">
        Save the sheet as CSV and drop it in. Every row is checked and shown to you before anything
        is written.
      </p>

      <fieldset className="mt-5">
        <legend className="sec-label mb-2">What the file holds</legend>
        <div className="flex flex-wrap gap-2.5" role="radiogroup" aria-label="What the file holds">
          {(['clients', 'policies'] as ImportKind[]).map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={kind === k}
              onClick={() => setKind(k)}
              className={`rounded border px-4 py-2 text-[13px] ${
                kind === k ? 'border-brand bg-brand-wash font-semibold text-brand' : 'border-line text-ink-soft'
              }`}
            >
              {KIND_LABEL[k]}
            </button>
          ))}
        </div>
        {/* The visible buttons carry no name: a controlled input loses its DOM
            state to the form reset React performs after a server action. */}
        <input type="hidden" name="kind" value={kind} />
      </fieldset>

      <label
        htmlFor="file"
        className="mt-5 flex cursor-pointer flex-col items-center justify-center rounded border-2 border-dashed border-line px-6 py-10 text-center hover:border-accent hover:bg-[#f8fbff]"
      >
        <span className="text-[13.5px] font-semibold text-ink">{fileName || 'Choose a CSV file'}</span>
        <span className="mt-1 text-[12px] text-muted">Up to {MAX_MB} MB · 5,000 rows</span>
        <input
          id="file"
          name="file"
          type="file"
          accept=".csv,text/csv"
          required
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
          {fieldsFor(kind).map((f) => f.label).join(' · ')}
        </p>
        <p className="mt-1.5 text-[12px] text-muted">
          Headers are matched loosely — <code>Policy No.</code>, <code>policy number</code> and{' '}
          <code>No Polisi</code> all find the same field. Required:{' '}
          {fieldsFor(kind).filter((f) => f.required).map((f) => f.label).join(', ')}.
        </p>
      </div>

      {(state?.error || sizeError) && (
        <p role="alert" className="mt-4 rounded border border-[#f3c9c5] bg-danger-wash px-4 py-3 text-[13px] text-danger">
          {sizeError || state?.error}
        </p>
      )}

      <button type="submit" disabled={analysing || Boolean(sizeError)} className="btn btn-primary mt-5 disabled:opacity-60">
        {analysing ? 'Reading…' : 'Check the file'}
      </button>
    </form>
  );
}
