'use client';

import { useActionState, useRef, useState } from 'react';
import { attachDocumentAction, deleteDocumentAction, type DocumentState } from '@/lib/document-actions';
import { DOCUMENT_KINDS, CLAIM_DOCUMENT_KINDS, KIND_LABEL } from '@/lib/document-kinds';

export type DocRow = {
  id: string;
  filename: string;
  byte_size: number;
  content_type: string | null;
  kind: string | null;
  note: string | null;
  uploaded_at: string;
  uploaded_by_name: string | null;
  page_count: number;
  used_claude: number;
};

function size(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function FileGlyph({ type }: { type: string | null }) {
  const image = type?.startsWith('image/');
  return (
    <span
      className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded text-[10px] font-bold ${
        image ? 'bg-info-wash text-info' : 'bg-danger-wash text-danger'
      }`}
      aria-hidden
    >
      {image ? 'IMG' : 'PDF'}
    </span>
  );
}

/**
 * The same store serves policies and claims: a schedule filed against the
 * policy, a police report and repair photos against the claim. Only the owner
 * differs, so the panel takes it rather than existing twice.
 */
export default function DocumentsPanel({
  owner, ownerId, ownerLabel, docs, back, emptyHint,
}: {
  owner: 'policy' | 'claim';
  ownerId: string;
  ownerLabel: string;
  docs: DocRow[];
  back: string;
  emptyHint: string;
}) {
  const [state, action, pending] = useActionState(attachDocumentAction, null as DocumentState | null);
  const [adding, setAdding] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div className="panel">
      <div className="panel-head">
        Documents
        <span className="ml-auto text-[12px] font-normal text-muted">
          {docs.length} on file
        </span>
      </div>

      {docs.length > 0 ? (
        <ul className="divide-y divide-line">
          {docs.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
              <FileGlyph type={d.content_type} />
              <div className="min-w-0 flex-1">
                <a
                  href={`/api/documents/${d.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="block truncate text-[13.5px] font-semibold text-brand hover:underline"
                >
                  {d.filename}
                </a>
                <p className="mt-0.5 text-[12px] text-muted">
                  {KIND_LABEL[d.kind ?? ''] ?? 'Document'} · {size(d.byte_size)}
                  {d.page_count > 0 && ` · ${d.page_count} page${d.page_count === 1 ? '' : 's'}`}
                  {' · '}added {d.uploaded_at}
                  {d.uploaded_by_name && ` by ${d.uploaded_by_name}`}
                  {d.used_claude === 1 && ' · read by the model'}
                </p>
                {d.note && <p className="mt-0.5 text-[12px] text-ink-soft">{d.note}</p>}
              </div>
              <div className="flex items-center gap-2.5 text-[12.5px]">
                <a href={`/api/documents/${d.id}?download`} className="text-link hover:underline">
                  Download
                </a>
                <form action={deleteDocumentAction}>
                  <input type="hidden" name="document_id" value={d.id} />
                  <input type="hidden" name="back" value={back} />
                  <button type="submit" className="text-danger hover:underline">Remove</button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-5 py-5 text-[13px] text-muted">
          Nothing on file for {ownerLabel}. {emptyHint}
        </p>
      )}

      <div className="border-t border-line px-5 py-3.5">
        {!adding ? (
          <button type="button" onClick={() => setAdding(true)} className="btn btn-ghost">
            Attach a document
          </button>
        ) : (
          <form
            action={action}
            onSubmit={() => setAdding(true)}
            className="flex flex-wrap items-end gap-3"
          >
            <input type="hidden" name="owner" value={owner} />
            <input type="hidden" name="owner_id" value={ownerId} />
            <div className="min-w-[220px] flex-1">
              <label htmlFor="file" className="sec-label mb-1 block">File</label>
              <input
                ref={fileRef}
                id="file"
                name="file"
                type="file"
                accept="application/pdf,image/jpeg,image/png"
                required
                className="inp text-[13px] file:mr-3 file:rounded file:border-0 file:bg-sunken file:px-3 file:py-1 file:text-[12.5px]"
              />
            </div>
            <div className="w-[170px]">
              <label htmlFor="kind" className="sec-label mb-1 block">What it is</label>
              <select
                id="kind"
                name="kind"
                defaultValue={owner === 'claim' ? 'police_report' : 'schedule'}
                className="inp cursor-pointer text-[13px]"
              >
                {(owner === 'claim' ? CLAIM_DOCUMENT_KINDS : DOCUMENT_KINDS).map((k) => (
                  <option key={k.value} value={k.value}>{k.label}</option>
                ))}
              </select>
            </div>
            <div className="min-w-[180px] flex-1">
              <label htmlFor="note" className="sec-label mb-1 block">Note</label>
              <input id="note" name="note" maxLength={120} className="inp text-[13px]" placeholder="Optional" />
            </div>
            <button type="submit" disabled={pending} className="btn btn-primary disabled:opacity-60">
              {pending ? 'Attaching…' : 'Attach'}
            </button>
            <button type="button" onClick={() => setAdding(false)} className="btn btn-ghost">
              Cancel
            </button>
          </form>
        )}

        {state?.error && (
          <p role="alert" className="mt-2.5 text-[12.5px] font-medium text-danger">{state.error}</p>
        )}
        {state?.ok && (
          <p role="status" className="mt-2.5 text-[12.5px] font-medium text-ok">{state.note}</p>
        )}
      </div>
    </div>
  );
}
