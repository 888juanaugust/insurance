'use client';

import { useState } from 'react';

type Changes = Record<string, [unknown, unknown]>;

function show(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'yes' : 'no';
  return String(v);
}

/**
 * The before-and-after for one event, folded away by default. A trail that
 * opens with thirty field diffs per row cannot be scanned, and scanning is
 * what it is for.
 */
export default function AuditChanges({ json }: { json: string | null }) {
  const [open, setOpen] = useState(false);
  if (!json) return null;

  let changes: Changes;
  try {
    changes = JSON.parse(json) as Changes;
  } catch {
    return null;
  }
  const keys = Object.keys(changes);
  if (!keys.length) return null;

  return (
    <div className="mt-1.5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="text-[12px] font-medium text-accent hover:underline"
      >
        {open ? 'Hide' : `${keys.length} ${keys.length === 1 ? 'field' : 'fields'} changed`}
      </button>
      {open && (
        <dl className="mt-1.5 grid gap-x-3 gap-y-1 rounded border border-line bg-[#fafbfc] px-3 py-2 text-[12px] sm:grid-cols-[auto_1fr]">
          {keys.map((k) => (
            <div key={k} className="contents">
              <dt className="font-medium text-ink-soft">{k.replace(/_/g, ' ')}</dt>
              <dd className="text-muted">
                <span className="line-through">{show(changes[k][0])}</span>
                <span className="mx-1.5 text-ink">→</span>
                <span className="font-medium text-ink">{show(changes[k][1])}</span>
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
