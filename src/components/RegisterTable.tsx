'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { bulkPaidAction } from '@/lib/policy-actions';
import { money, shortDate } from '@/lib/format';

export type RegisterRow = Record<string, any>;

const COLUMNS: { key: string; label: string; num?: boolean; sortable?: boolean }[] = [
  { key: 'issue_date', label: 'Issue Date', sortable: true },
  { key: 'policy_no', label: 'Policy No', sortable: true },
  { key: 'principal', label: 'Principal', sortable: true },
  { key: 'vehicle_no', label: 'Veh.No', sortable: true },
  { key: 'insured', label: 'Insured Name', sortable: true },
  { key: 'ident', label: 'NRIC / Passport / BRN', sortable: true },
  { key: 'sum_insured', label: 'Sum Insured (MYR)', num: true, sortable: true },
  { key: 'gross_premium', label: 'Gross Premium (MYR)', num: true, sortable: true },
  { key: 'service_tax', label: 'Service Tax (MYR)', num: true, sortable: true },
  { key: 'stamp_duty', label: 'Stamp Duty (MYR)', num: true, sortable: true },
  { key: 'total_premium', label: 'Total Payable (MYR)', num: true, sortable: true },
  { key: 'referral_fee', label: 'Referral Fee (MYR)', num: true, sortable: true },
  { key: 'commission_amt', label: 'Total Commission (MYR)', num: true, sortable: true },
  { key: 'agent_commission', label: 'Agent/Broker Commission (MYR)', num: true, sortable: true },
];

const TOTALLED = new Set([
  'sum_insured', 'gross_premium', 'service_tax', 'stamp_duty',
  'total_premium', 'referral_fee', 'commission_amt', 'agent_commission',
]);

export default function RegisterTable({
  rows, slug, page, perPage,
}: {
  rows: RegisterRow[];
  slug: string;
  page: number;
  perPage: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [selected, setSelected] = useState<string[]>([]);

  const sort = params.get('sort') ?? 'issue_date';
  const dir = params.get('dir') === 'asc' ? 'asc' : 'desc';

  const pageCount = Math.max(1, Math.ceil(rows.length / perPage));
  const current = Math.min(page, pageCount);
  const visible = useMemo(
    () => rows.slice((current - 1) * perPage, current * perPage),
    [rows, current, perPage],
  );

  const totals = useMemo(() => {
    const acc: Record<string, number> = {};
    for (const key of TOTALLED) acc[key] = rows.reduce((s, r) => s + Number(r[key] ?? 0), 0);
    return acc;
  }, [rows]);

  function setParam(next: Record<string, string | null>) {
    const sp = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v === null || v === '') sp.delete(k);
      else sp.set(k, v);
    }
    router.push(`${pathname}?${sp.toString()}`);
  }

  function toggleSort(key: string) {
    if (sort === key) setParam({ sort: key, dir: dir === 'asc' ? 'desc' : 'asc', page: '1' });
    else setParam({ sort: key, dir: 'desc', page: '1' });
  }

  const allOnPage = visible.length > 0 && visible.every((r) => selected.includes(r.id));
  const toggleAll = () =>
    setSelected(allOnPage
      ? selected.filter((id) => !visible.some((r) => r.id === id))
      : [...new Set([...selected, ...visible.map((r) => r.id as string)])]);

  return (
    <form action={bulkPaidAction}>
      <input type="hidden" name="back" value={`/insurance/${slug}`} />
      {selected.map((id) => (
        <input key={id} type="hidden" name="selected" value={id} />
      ))}

      <div className="mb-3 flex flex-wrap items-center gap-2.5">
        <button
          type="submit"
          name="kind"
          value="client"
          disabled={selected.length === 0}
          className="btn btn-ghost disabled:opacity-50"
        >
          Bulk client paid
        </button>
        <button
          type="submit"
          name="kind"
          value="principal"
          disabled={selected.length === 0}
          className="btn btn-ghost disabled:opacity-50"
        >
          Bulk principal paid
        </button>
        {selected.length > 0 && (
          <span className="text-[12.5px] text-muted">{selected.length} selected</span>
        )}
      </div>

      <div className="scroll-x rounded border border-line">
        <table className="tbl">
          <thead>
            <tr>
              <th className="w-[34px]">
                <input
                  type="checkbox"
                  aria-label="Select all on this page"
                  checked={allOnPage}
                  onChange={toggleAll}
                />
              </th>
              <th>Action</th>
              {COLUMNS.map((c) => (
                <th key={c.key} className={c.num ? 'num' : ''}>
                  {c.sortable ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(c.key)}
                      className="inline-flex items-center gap-1 uppercase tracking-[0.055em] hover:text-ink"
                    >
                      {c.label}
                      <span className={sort === c.key ? 'text-accent' : 'text-[#c3cad6]'}>
                        {sort === c.key ? (dir === 'asc' ? '▲' : '▼') : '⇅'}
                      </span>
                    </button>
                  ) : (
                    c.label
                  )}
                </th>
              ))}
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr key={r.id}>
                <td>
                  <input
                    type="checkbox"
                    aria-label={`Select ${r.policy_no}`}
                    checked={selected.includes(r.id)}
                    onChange={() =>
                      setSelected((s) =>
                        s.includes(r.id) ? s.filter((x) => x !== r.id) : [...s, r.id],
                      )
                    }
                  />
                </td>
                <td>
                  <span className="flex items-center gap-2.5">
                    <Link href={`/insurance/${slug}/${r.id}/edit`} title="Edit" className="text-[#3f7fc4] hover:text-accent">
                      <PencilIcon />
                    </Link>
                    <Link href={`/insurance/${slug}/${r.id}`} title="View" className="text-[#3f7fc4] hover:text-accent">
                      <EyeIcon />
                    </Link>
                  </span>
                </td>
                <td className="text-ink-soft">{shortDate(r.issue_date)}</td>
                <td>
                  <Link href={`/insurance/${slug}/${r.id}`} className="link-red">{r.policy_no}</Link>
                </td>
                <td className="font-semibold text-brand">{r.principal}</td>
                <td className="font-semibold text-ink">{r.vehicle_no ?? '—'}</td>
                <td className="text-ink">{r.insured}</td>
                <td className="text-ink-soft">{r.ident || '—'}</td>
                <td className="num">{money(r.sum_insured, 'MYR ')}</td>
                <td className="num">{money(r.gross_premium, 'MYR ')}</td>
                <td className="num">{money(r.service_tax, 'MYR ')}</td>
                <td className="num">{money(r.stamp_duty, 'MYR ')}</td>
                <td className="num font-semibold">{money(r.total_premium, 'MYR ')}</td>
                <td className="num">{money(r.referral_fee, 'MYR ')}</td>
                <td className="num">{money(r.commission_amt, 'MYR ')}</td>
                <td className="num">{money(r.agent_commission, 'MYR ')}</td>
                <td>
                  <span className="flex gap-1">
                    <span
                      className={`badge ${r.client_paid === 'paid' ? 'badge-green' : 'badge-red'}`}
                      title={r.client_paid === 'paid' ? 'Premium collected from client' : 'Premium outstanding from client'}
                    >
                      C
                    </span>
                    <span
                      className={`badge ${r.principal_paid === 'paid' ? 'badge-green' : 'badge-red'}`}
                      title={r.principal_paid === 'paid' ? 'Remitted to principal' : 'Not yet remitted to principal'}
                    >
                      P
                    </span>
                  </span>
                </td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length + 3} className="py-12 text-center text-[13px] text-muted">
                  No policies match the current filters.
                </td>
              </tr>
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="bg-[#fafbfc] font-semibold">
                <td colSpan={8} className="px-3 py-2.5 text-ink">Total</td>
                {['sum_insured', 'gross_premium', 'service_tax', 'stamp_duty', 'total_premium',
                  'referral_fee', 'commission_amt', 'agent_commission'].map((k) => (
                  <td key={k} className="num px-3 py-2.5">{money(totals[k], 'MYR ')}</td>
                ))}
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-end gap-3 text-[13px] text-ink-soft">
        <span>{rows.length} {rows.length === 1 ? 'policy' : 'policies'}</span>
        <button
          type="button"
          onClick={() => setParam({ page: String(current - 1) })}
          disabled={current <= 1}
          className="btn btn-ghost px-2.5 py-1 disabled:opacity-40"
        >
          ‹
        </button>
        <span className="rounded border border-accent px-2.5 py-1 font-semibold text-accent">{current}</span>
        <button
          type="button"
          onClick={() => setParam({ page: String(current + 1) })}
          disabled={current >= pageCount}
          className="btn btn-ghost px-2.5 py-1 disabled:opacity-40"
        >
          ›
        </button>
        <select
          aria-label="Rows per page"
          value={String(perPage)}
          onChange={(e) => setParam({ per: e.target.value, page: '1' })}
          className="inp w-[110px] cursor-pointer"
        >
          {[20, 50, 100].map((n) => (
            <option key={n} value={n}>{n} / page</option>
          ))}
        </select>
      </div>
    </form>
  );
}

const PencilIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-[15px] w-[15px]">
    <path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17Z" strokeLinejoin="round" />
  </svg>
);
const EyeIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-[15px] w-[15px]">
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
    <circle cx="12" cy="12" r="2.6" />
  </svg>
);
