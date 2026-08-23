'use client';

import { useActionState, useState } from 'react';
import { saveCommissionRatesAction, type OrgFormState } from '@/lib/org-actions';
import { classLabel } from '@/lib/format';

export type RateRow = {
  id: string;
  class: string;
  rate: number;
  principal_id: string;
  short_name: string;
  name: string;
  status: string;
  ceiling: number;
  policies: number;
};

export default function CommissionRatesForm({
  rows, readOnly = false,
}: {
  rows: RateRow[];
  /** Everyone can see what the agency earns; only a Master can change it. */
  readOnly?: boolean;
}) {
  const [state, action, pending] = useActionState(saveCommissionRatesAction, null as OrgFormState | null);
  const [filter, setFilter] = useState('');

  const v = (row: RateRow) => {
    const echoed = state?.values?.[`rate_${row.id}`];
    return echoed !== undefined ? echoed : String(row.rate);
  };
  const err = (row: RateRow) => (state?.field === `rate_${row.id}` ? state.error : undefined);

  /*
   * No `max` on the inputs. The browser would block the submit with its own
   * bubble, and the person would never see which insurer pays what — the
   * server's refusal names the figure and the consequence.
   */

  /*
   * Filtering hides rows with CSS rather than unmounting them. An input that
   * leaves the DOM posts nothing, and the action reads every rate on file —
   * so a filtered save would arrive looking like every hidden rate was
   * cleared.
   */
  const needle = filter.trim().toLowerCase();
  const matches = (r: RateRow) =>
    !needle || r.short_name.toLowerCase().includes(needle) || r.name.toLowerCase().includes(needle);
  const hits = rows.filter(matches).length;

  return (
    <form action={action} className="panel">
      <div className="panel-head">
        Commission rates
        <input
          type="search"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter insurers"
          aria-label="Filter insurers"
          className="inp ml-auto h-8 w-48 text-[13px]"
        />
      </div>

      <p className="border-b border-line px-5 py-2.5 text-[12.5px] text-muted">
        What the agency earns on gross premium, per insurer and class. The insurer&rsquo;s own rate is the
        ceiling — above it the register would book commission that never arrives. Changing a rate sets the
        default for the <em>next</em> policy created; policies already written keep the rate they were
        written at.
      </p>

      <div className="scroll-x">
        <table className="tbl">
          <thead>
            <tr>
              <th>Principal</th>
              <th>Class</th>
              <th className="num">Rate %</th>
              <th className="num">Insurer pays</th>
              <th className="num">On file</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const error = err(row);
              const shown = matches(row) || Boolean(error);
              return (
                <tr
                  key={row.id}
                  className={`${shown ? '' : 'hidden '}${error ? 'bg-danger-wash' : ''}`.trim() || undefined}
                >
                  <td>
                    <span className="font-semibold text-brand">{row.short_name}</span>
                    <span className="block text-[12px] text-muted">{row.name}</span>
                  </td>
                  <td className="text-ink-soft">{classLabel(row.class)}</td>
                  <td className="num">
                    {readOnly ? (
                      <span className="font-semibold tabular-nums">{Number(v(row)).toFixed(2)}</span>
                    ) : (
                    <input
                      name={`rate_${row.id}`}
                      type="number"
                      step="0.01"
                      min="0"
                      inputMode="decimal"
                      key={`rate_${row.id}-${v(row)}`}
                      defaultValue={v(row)}
                      aria-label={`${row.short_name} ${classLabel(row.class)} rate`}
                      aria-invalid={error ? true : undefined}
                      className={`inp h-8 w-24 text-right text-[13px] ${error ? 'border-brand' : ''}`}
                    />
                    )}
                    {error && <p className="mt-1 text-[12px] font-medium text-brand">{error}</p>}
                  </td>
                  <td className="num text-muted">{row.ceiling.toFixed(2)}</td>
                  <td className="num text-muted">{row.policies || '—'}</td>
                </tr>
              );
            })}
            {hits === 0 && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-[13px] text-muted">
                  No insurer matches “{filter}”.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-line px-5 py-3.5">
        {readOnly ? (
          <span className="text-[12.5px] text-muted">
            Rates are set by a Master. These are what the agency currently earns.
          </span>
        ) : (
          <button type="submit" disabled={pending} className="btn btn-primary disabled:opacity-60">
            {pending ? 'Saving…' : 'Save rates'}
          </button>
        )}
        {needle && (
          <span className="text-[12.5px] text-muted">
            Filtering hides rows but still saves all {rows.length} of them.
          </span>
        )}
        {state?.error && (
          <span role="alert" className="text-[12.5px] font-medium text-danger">{state.error}</span>
        )}
        {state?.ok && (
          <span role="status" className="text-[12.5px] font-medium text-ok">{state.note ?? 'Saved.'}</span>
        )}
      </div>
    </form>
  );
}
