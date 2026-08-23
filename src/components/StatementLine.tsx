'use client';

import { useActionState } from 'react';
import { assignLineAction, acceptLineAction, type LineState } from '@/lib/statement-actions';
import { money, longDate } from '@/lib/format';

export type PickerPolicy = {
  id: string; policy_no: string; insured: string;
  effective_date: string | null; vehicle_no: string | null; commission_amt: number;
};

export type UnplacedLine = {
  id: string;
  row_no: number;
  policy_no: string | null;
  cover_note_no: string | null;
  insured: string | null;
  vehicle_no: string | null;
  effective_date: string | null;
  commission: number;
  accepted: number;
  accepted_note: string | null;
};

/**
 * One line the matcher could not place, and the two things that can be done
 * about it: point it at a case, or write it off with a reason.
 *
 * Both are decisions a person makes, and both are recorded as such — a line
 * set aside without a reason is one nobody can answer for when the insurer
 * asks about it three months later.
 */
export default function StatementLine({
  line, statementId, policies,
}: {
  line: UnplacedLine; statementId: string; policies: PickerPolicy[];
}) {
  const [assignState, assign, assigning] = useActionState(assignLineAction, null as LineState | null);
  const [acceptState, accept, accepting] = useActionState(acceptLineAction, null as LineState | null);

  const identified = line.policy_no || line.cover_note_no || line.vehicle_no || '—';
  const error = assignState?.error || acceptState?.error;

  return (
    <div className="border-b border-line px-5 py-4 last:border-b-0">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <p className="text-[13.5px] font-semibold text-ink">
            {identified}
            <span className="ml-2 text-[12px] font-normal text-muted">line {line.row_no}</span>
          </p>
          <p className="mt-0.5 text-[12.5px] text-ink-soft">
            {line.insured || 'no name on the line'}
            {line.effective_date && ` · ${longDate(line.effective_date)}`}
            {line.vehicle_no && ` · ${line.vehicle_no}`}
          </p>
        </div>
        <p className="text-[15px] font-semibold tabular-nums text-ink">{money(line.commission)}</p>
      </div>

      {line.accepted === 1 ? (
        <div className="mt-3 flex flex-wrap items-center gap-3 rounded border border-line bg-sunken px-4 py-2.5">
          <span className="badge badge-grey">set aside</span>
          <span className="text-[12.5px] text-ink-soft">{line.accepted_note}</span>
          <form action={accept} className="ml-auto">
            <input type="hidden" name="line_id" value={line.id} />
            <input type="hidden" name="statement_id" value={statementId} />
            <input type="hidden" name="undo" value="1" />
            <button type="submit" disabled={accepting} className="btn btn-ghost h-8 disabled:opacity-60">
              {accepting ? 'Undoing…' : 'Put it back'}
            </button>
          </form>
        </div>
      ) : (
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <form action={assign} className="rounded border border-line px-4 py-3">
            <label
              htmlFor={`policy-${line.id}`}
              className="mb-1 block text-[12px] font-semibold text-ink-soft"
            >
              It belongs to
            </label>
            <input type="hidden" name="line_id" value={line.id} />
            <input type="hidden" name="statement_id" value={statementId} />
            <select id={`policy-${line.id}`} name="policy_id" defaultValue="" className="inp cursor-pointer">
              <option value="">Choose a policy…</option>
              <option value="__none__">Not this agency&rsquo;s business</option>
              {policies.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.policy_no} · {p.insured}
                  {p.vehicle_no ? ` · ${p.vehicle_no}` : ''} · {money(p.commission_amt)}
                </option>
              ))}
            </select>
            <button type="submit" disabled={assigning} className="btn btn-primary mt-3 h-8 disabled:opacity-60">
              {assigning ? 'Assigning…' : 'Assign'}
            </button>
          </form>

          <form action={accept} className="rounded border border-line px-4 py-3">
            <label
              htmlFor={`note-${line.id}`}
              className="mb-1 block text-[12px] font-semibold text-ink-soft"
            >
              Or set it aside, with the reason
            </label>
            <input type="hidden" name="line_id" value={line.id} />
            <input type="hidden" name="statement_id" value={statementId} />
            <input
              id={`note-${line.id}`}
              name="note"
              className="inp"
              placeholder="e.g. written by the Ipoh branch, not us"
            />
            <button type="submit" disabled={accepting} className="btn btn-ghost mt-3 h-8 disabled:opacity-60">
              {accepting ? 'Saving…' : 'Set aside'}
            </button>
          </form>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-2 text-[12.5px] font-medium text-danger">{error}</p>
      )}
    </div>
  );
}
