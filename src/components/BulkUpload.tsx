'use client';

import Link from 'next/link';
import { useActionState, useRef, useState } from 'react';
import {
  readForBatchAction, saveBatchAction, discardReadingAction,
  type BatchItem, type BatchSaveResult,
} from '@/lib/bulk-actions';
import { money, longDate, classSlug } from '@/lib/format';

const MAX_FILES = 40;
const MAX_MB = 15;

type Row = BatchItem & { key: string; state: 'waiting' | 'reading' | 'done'; chosen: boolean; discarded?: boolean };

const TONE: Record<string, { badge: string; label: string }> = {
  ready: { badge: 'badge-green', label: 'ready' },
  review: { badge: 'badge-amber', label: 'needs a look' },
  duplicate: { badge: 'badge-blue', label: 'already on file' },
  failed: { badge: 'badge-red', label: 'could not read' },
};

export default function BulkUpload({ cls }: { cls: 'motor' | 'non_motor' }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState('');
  const [saveState, save, saving] = useActionState(saveBatchAction, null as BatchSaveResult | null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function read(files: File[]) {
    setError('');
    const usable = files.filter((f) => /\.pdf$/i.test(f.name) || f.type === 'application/pdf');
    const rejected = files.length - usable.length;
    if (rejected > 0) {
      setError(`${rejected} file${rejected === 1 ? ' was' : 's were'} not a PDF and ${rejected === 1 ? 'was' : 'were'} left out.`);
    }
    if (usable.length > MAX_FILES) {
      setError(`That is ${usable.length} files. Do them ${MAX_FILES} at a time.`);
      return;
    }
    if (!usable.length) return;

    setBusy(true);
    setProgress({ done: 0, total: usable.length });
    setRows(usable.map((f, i) => ({
      key: `${f.name}-${i}`, filename: f.name, verdict: 'review', reasons: [],
      state: 'waiting', chosen: false,
    })));

    /*
     * One request per file, in order. A batch posted as one body would be
     * rejected whole for being too large, and a spinner over thirty files
     * tells the agent nothing; this way each row fills in as it lands and a
     * file that cannot be read costs only itself.
     */
    for (let i = 0; i < usable.length; i++) {
      setRows((rs) => rs.map((r, j) => (j === i ? { ...r, state: 'reading' } : r)));
      const fd = new FormData();
      fd.set('file', usable[i]);
      let item: BatchItem;
      try {
        item = await readForBatchAction(fd);
      } catch {
        item = { filename: usable[i].name, verdict: 'failed', reasons: ['the upload did not complete'] };
      }
      setRows((rs) => rs.map((r, j) => (
        j === i ? { ...r, ...item, state: 'done', chosen: item.verdict === 'ready' } : r
      )));
      setProgress({ done: i + 1, total: usable.length });
    }
    setBusy(false);
  }

  const done = rows.filter((r) => r.state === 'done');
  const ready = done.filter((r) => r.verdict === 'ready');
  const chosen = done.filter((r) => r.chosen && r.documentId);
  const slug = classSlug(cls);

  /* ------------------------------------------------------------ finished */
  if (saveState && !saveState.error) {
    return (
      <div className="space-y-4">
        <div className="panel px-6 py-6">
          <p className="sec-label">Batch finished</p>
          <h2 className="mt-2 text-[20px] font-semibold tracking-tight text-ink">
            {saveState.saved} polic{saveState.saved === 1 ? 'y' : 'ies'} added to the register
          </h2>
          {saveState.failed.length > 0 ? (
            <p className="mt-2 text-[13.5px] text-ink-soft">
              {saveState.failed.length} could not be saved and {saveState.failed.length === 1 ? 'is' : 'are'} listed
              below. Nothing was written for {saveState.failed.length === 1 ? 'it' : 'them'}.
            </p>
          ) : (
            <p className="mt-2 text-[13.5px] text-ink-soft">Every one went in.</p>
          )}
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href={`/insurance/${slug}`} className="btn btn-primary">See the register</Link>
            <Link href={`/insurance/${slug}/upload?bulk=1`} className="btn btn-ghost">Read another batch</Link>
          </div>
        </div>

        {saveState.failed.length > 0 && (
          <section className="panel">
            <div className="panel-head">Left out</div>
            <div className="scroll-x">
              <table className="tbl">
                <thead><tr><th>File</th><th>Why</th></tr></thead>
                <tbody>
                  {saveState.failed.map((f, i) => (
                    <tr key={i}>
                      <td className="text-ink">{f.filename}</td>
                      <td className="wrap text-danger">{f.why}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    );
  }

  /* -------------------------------------------------------------- picker */
  return (
    <div className="space-y-4">
      <div className="panel px-6 py-6">
        <h2 className="text-[15px] font-semibold text-ink">Read a stack of schedules</h2>
        <p className="mt-1 text-[13px] text-ink-soft">
          Choose as many policy PDFs as you like. Each is read on its own and judged; the clean ones
          can go in together, and anything doubtful is sent to the check screen instead. Motor or
          non-motor is decided from each document, whichever register you started from. Nothing is
          saved until you say so.
        </p>

        <label
          htmlFor="files"
          className="mt-5 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-line px-6 py-10 text-center hover:border-brand hover:bg-brand-wash"
        >
          <span className="text-[13.5px] font-semibold text-ink">
            {rows.length ? `${rows.length} file${rows.length === 1 ? '' : 's'} chosen` : 'Choose PDF policy documents'}
          </span>
          <span className="mt-1 text-[12px] text-muted">
            Up to {MAX_FILES} at a time · {MAX_MB} MB each · any insurer
          </span>
          <input
            ref={inputRef}
            id="files"
            type="file"
            multiple
            accept="application/pdf,.pdf"
            className="sr-only"
            disabled={busy}
            onChange={(e) => {
              const chosenFiles = Array.from(e.target.files ?? []);
              // Let the same stack be chosen again after a reset.
              e.target.value = '';
              if (chosenFiles.length) void read(chosenFiles);
            }}
          />
        </label>

        {busy && (
          <div className="mt-4">
            <div className="h-[6px] w-full overflow-hidden rounded-full bg-sunken">
              <div
                className="h-full bg-brand transition-[width] duration-200"
                style={{ width: `${Math.round((progress.done / Math.max(1, progress.total)) * 100)}%` }}
              />
            </div>
            <p className="mt-2 text-[12.5px] text-ink-soft">
              Reading {progress.done} of {progress.total}…
            </p>
          </div>
        )}

        {error && (
          <p role="alert" className="mt-4 rounded-xl border border-danger-line bg-danger-wash px-4 py-3 text-[13px] text-danger">
            {error}
          </p>
        )}
        {saveState?.error && (
          <p role="alert" className="mt-4 rounded-xl border border-danger-line bg-danger-wash px-4 py-3 text-[13px] text-danger">
            {saveState.error}
          </p>
        )}
      </div>

      {done.length > 0 && (
        <>
          <div className="panel px-6 py-5">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {(['ready', 'review', 'duplicate', 'failed'] as const).map((v) => {
                const n = done.filter((r) => r.verdict === v).length;
                return (
                  <div key={v} className={`rounded-xl border px-4 py-3 ${n ? 'border-line' : 'border-line opacity-60'}`}>
                    <p className="text-[20px] font-semibold tabular-nums text-ink">{n}</p>
                    <p className="mt-0.5 text-[12px] text-ink-soft">{TONE[v].label}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <section className="panel">
            <div className="panel-head">
              What was read
              <span className="ml-auto text-[12px] font-normal text-muted">
                {chosen.length} of {done.length} selected
              </span>
            </div>
            <div className="scroll-x">
              <table className="tbl">
                <thead>
                  <tr>
                    <th className="w-10">
                      <input
                        type="checkbox"
                        aria-label="Select every reading that is ready"
                        checked={ready.length > 0 && ready.every((r) => r.chosen)}
                        onChange={(e) =>
                          setRows((rs) => rs.map((r) => (
                            r.verdict === 'ready' ? { ...r, chosen: e.target.checked } : r
                          )))
                        }
                      />
                    </th>
                    <th>File</th>
                    <th>Policy no</th>
                    <th>Insured</th>
                    <th>Insurer</th>
                    <th>Class</th>
                    <th>Period</th>
                    <th className="num">Total</th>
                    <th>Verdict</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={r.key} className={r.verdict === 'failed' && r.state === 'done' ? 'bg-danger-wash' : undefined}>
                      <td>
                        {/* Only a ready reading can be ticked. A row that needs a
                            look used to be tickable and saved unreviewed; one
                            already on file could be ticked and always failed. */}
                        {r.state === 'done' && r.documentId && r.verdict === 'ready' && (
                          <input
                            type="checkbox"
                            aria-label={`Save ${r.filename}`}
                            checked={r.chosen}
                            onChange={(e) =>
                              setRows((rs) => rs.map((x, j) => (j === i ? { ...x, chosen: e.target.checked } : x)))
                            }
                          />
                        )}
                      </td>
                      <td className="max-w-[220px] truncate text-ink">
                        {r.filename}
                        {r.state === 'done' && r.found !== undefined && (
                          <span className="block text-[11px] text-muted">
                            {r.found} of {r.fieldCount} fields
                          </span>
                        )}
                      </td>
                      <td className="text-ink-soft">{r.policy_no ?? '—'}</td>
                      <td className="max-w-[200px] truncate text-ink-soft">{r.insured ?? '—'}</td>
                      <td className="font-semibold text-brand">{r.principal ?? '—'}</td>
                      <td className="text-ink-soft">
                        {r.state === 'done' && r.cls ? (r.cls === 'motor' ? 'Motor' : 'Non-motor') : '—'}
                      </td>
                      <td className="text-ink-soft">
                        {r.effective_date ? `${longDate(r.effective_date)} — ${longDate(r.expiry_date)}` : '—'}
                      </td>
                      <td className="num">{typeof r.total === 'number' ? money(r.total) : '—'}</td>
                      <td>
                        {r.state !== 'done' ? (
                          <span className="badge badge-grey">{r.state === 'reading' ? 'reading…' : 'waiting'}</span>
                        ) : (
                          <>
                            <span className={`badge ${TONE[r.verdict].badge}`}>{TONE[r.verdict].label}</span>
                            {r.reasons.length > 0 && (
                              <span className="mt-1 block max-w-[280px] whitespace-normal text-[11.5px] text-muted">
                                {r.reasons.join('; ')}
                              </span>
                            )}
                            {r.existingPolicyId && (
                              <Link
                                href={`/insurance/${r.cls ? classSlug(r.cls) : slug}/${r.existingPolicyId}`}
                                className="mt-0.5 block text-[11.5px] text-accent hover:underline"
                              >
                                Open the one on file
                              </Link>
                            )}
                            {r.verdict === 'review' && r.documentId && (
                              <Link
                                href={`/insurance/${r.cls ? classSlug(r.cls) : slug}/upload?doc=${r.documentId}`}
                                className="mt-0.5 block text-[11.5px] font-semibold text-accent hover:underline"
                              >
                                Open it on the check screen
                              </Link>
                            )}
                            {(r.verdict === 'review' || r.verdict === 'duplicate') && r.documentId && !r.discarded && (
                              <button
                                type="button"
                                onClick={async () => {
                                  const fd = new FormData();
                                  fd.set('document_id', r.documentId!);
                                  await discardReadingAction(fd);
                                  setRows((rs) => rs.map((x, j) => (j === i ? { ...x, discarded: true, chosen: false } : x)));
                                }}
                                className="mt-0.5 block text-[11.5px] text-muted hover:text-danger hover:underline"
                              >
                                Discard this reading
                              </button>
                            )}
                            {r.discarded && (
                              <span className="mt-0.5 block text-[11.5px] text-muted">Discarded — the file and the reading are gone.</span>
                            )}
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <form action={save} className="panel px-6 py-5">
            <input type="hidden" name="document_ids" value={chosen.map((r) => r.documentId).join(',')} />
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={busy || saving || chosen.length === 0}
                className="btn btn-primary disabled:opacity-60"
              >
                {saving ? 'Saving…' : `Save ${chosen.length} polic${chosen.length === 1 ? 'y' : 'ies'}`}
              </button>
              <span className="text-[12.5px] text-muted">
                Each selected reading becomes a policy, with its document attached and a client
                created where none is on file. Rows that need a look are not saved from here —
                open each on the check screen, where every field can be seen before it goes in.
              </span>
            </div>
          </form>
        </>
      )}
    </div>
  );
}
