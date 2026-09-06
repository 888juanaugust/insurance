'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { bulkPaidAction } from '@/lib/policy-actions';
import { money, shortDate } from '@/lib/format';
import { StatusBadge } from './ui';
import ConfirmSubmit from './Confirm';

export type RegisterRow = Record<string, any>;

type Col = {
  key: string;
  label: string;
  num?: boolean;
  sortable?: boolean;
  /** Motor-only columns drop away on the non-motor register. */
  motorOnly?: boolean;
};

const COLUMNS: Col[] = [
  { key: 'issue_date', label: 'Issue Date', sortable: true },
  { key: 'policy_no', label: 'Policy No', sortable: true },
  { key: 'principal', label: 'Principal', sortable: true },
  { key: 'vehicle_no', label: 'Veh. No', sortable: true, motorOnly: true },
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
  { key: 'consultant_commission', label: 'Sales Consultant Commission (MYR)', num: true, sortable: true },
  { key: 'nett_amount', label: 'Nett Amount (MYR)', num: true, sortable: true },
  { key: 'principal_nett_amount', label: 'Principal Nett Amount (MYR)', num: true, sortable: true },
  { key: 'effective_date', label: 'Inception Date', sortable: true },
  { key: 'expiry_date', label: 'Expiry Date', sortable: true },
  { key: 'status', label: 'Policy Status', sortable: true },
  { key: 'uploaded_at', label: 'Upload Date', sortable: true },
  { key: 'client_paid', label: 'Client Paid' },
  { key: 'principal_paid', label: 'Paid Principal' },
];

const TOTALLED = [
  'sum_insured', 'gross_premium', 'service_tax', 'stamp_duty', 'total_premium',
  'referral_fee', 'commission_amt', 'agent_commission', 'consultant_commission',
  'nett_amount', 'principal_nett_amount',
];

export default function RegisterTable({
  rows, slug, page, perPage, isMotor,
}: {
  rows: RegisterRow[];
  slug: string;
  page: number;
  perPage: number;
  isMotor: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [selected, setSelected] = useState<string[]>([]);

  const columns = useMemo(() => COLUMNS.filter((c) => isMotor || !c.motorOnly), [isMotor]);
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

  /*
   * What the two bulk buttons would actually settle, so the question they ask
   * carries a figure and a count rather than "are you sure". Only the unpaid
   * leg counts: a policy already settled on that side is untouched.
   */
  const chosen = useMemo(() => rows.filter((r) => selected.includes(r.id)), [rows, selected]);
  const owed = (leg: 'client' | 'principal') => {
    const open = chosen.filter((r) => (leg === 'client' ? r.client_paid : r.principal_paid) !== 'paid');
    const sum = open.reduce(
      (s, r) => s + Number((leg === 'client' ? r.total_premium : r.principal_nett_amount) ?? 0), 0,
    );
    return { n: open.length, sum };
  };
  const clientLeg = owed('client');
  const principalLeg = owed('principal');

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
        <ConfirmSubmit
          name="kind"
          value="client"
          disabled={selected.length === 0}
          className="btn btn-ghost disabled:opacity-50"
          label="Bulk client paid"
          yes={`Settle ${clientLeg.n} collection${clientLeg.n === 1 ? '' : 's'}`}
          question={
            clientLeg.n === 0
              ? `Every one of the ${selected.length} selected is already marked paid by the client. Nothing would change.`
              : <>Record <strong>{money(clientLeg.sum, 'MYR ')}</strong> as collected from the client across{' '}
                <strong>{clientLeg.n}</strong> polic{clientLeg.n === 1 ? 'y' : 'ies'}, paid in full today? There is no undo.</>
          }
        />
        <ConfirmSubmit
          name="kind"
          value="principal"
          disabled={selected.length === 0}
          className="btn btn-ghost disabled:opacity-50"
          label="Bulk principal paid"
          yes={`Settle ${principalLeg.n} remittance${principalLeg.n === 1 ? '' : 's'}`}
          question={
            principalLeg.n === 0
              ? `Every one of the ${selected.length} selected is already marked paid to the principal. Nothing would change.`
              : <>Record <strong>{money(principalLeg.sum, 'MYR ')}</strong> as remitted to the insurer across{' '}
                <strong>{principalLeg.n}</strong> polic{principalLeg.n === 1 ? 'y' : 'ies'}, paid in full today? There is no undo.</>
          }
        />
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
              {columns.map((c) => (
                <th key={c.key} className={c.num ? 'num' : ''}>
                  {c.sortable ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(c.key)}
                      className="inline-flex items-center gap-1 uppercase tracking-[0.055em] hover:text-ink"
                    >
                      {c.label}
                      <span className={sort === c.key ? 'text-accent' : 'text-line'}>
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
                    <Link href={`/insurance/${slug}/${r.id}/edit`} title="Update" className="text-info hover:text-accent">
                      <PencilIcon />
                    </Link>
                    <Link href={`/insurance/${slug}/${r.id}`} title="View" className="text-info hover:text-accent">
                      <EyeIcon />
                    </Link>
                    <Link href={`/documents/loc/${r.id}`} title="Letter of collection" target="_blank" className="text-info hover:text-accent">
                      <DocIcon />
                    </Link>
                    <Link href={`/documents/receipt/${r.id}`} title="Receipt" target="_blank" className="text-info hover:text-accent">
                      <ReceiptIcon />
                    </Link>
                  </span>
                </td>
                {columns.map((c) => (
                  <td key={c.key} className={cellClass(c)}>
                    {renderCell(c, r, slug)}
                  </td>
                ))}
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={columns.length + 2} className="py-12 text-center text-[13px] text-muted">
                  No policies match the current filters.
                </td>
              </tr>
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="bg-canvas font-semibold">
                <td colSpan={2} className="px-3 py-2.5 text-ink">Total</td>
                {columns.map((c) => (
                  <td key={c.key} className={c.num ? 'num px-3 py-2.5' : 'px-3 py-2.5'}>
                    {c.num && TOTALLED.includes(c.key) ? money(totals[c.key], 'MYR ') : ''}
                  </td>
                ))}
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

function cellClass(c: Col): string {
  if (c.num) return 'num';
  if (c.key === 'policy_no' || c.key === 'vehicle_no') return 'font-semibold text-ink';
  if (c.key === 'principal') return 'font-semibold text-brand';
  return 'text-ink-soft';
}

function renderCell(c: Col, r: RegisterRow, slug: string): React.ReactNode {
  const v = r[c.key];

  if (c.num) return money(v, 'MYR ');

  switch (c.key) {
    case 'issue_date':
    case 'effective_date':
    case 'expiry_date':
    case 'uploaded_at':
      return shortDate(v);
    case 'policy_no':
      return (
        <Link href={`/insurance/${slug}/${r.id}`} className="link-red">
          {v}
        </Link>
      );
    case 'status':
      return <StatusBadge status={String(v)} />;
    case 'client_paid':
    case 'principal_paid':
      return (
        <span className={`badge ${v === 'paid' ? 'badge-green' : 'badge-red'}`}>
          {v === 'paid' ? 'Paid' : 'Unpaid'}
        </span>
      );
    default:
      return v === null || v === undefined || v === '' ? '—' : String(v);
  }
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
const DocIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-[15px] w-[15px]">
    <path d="M6 3.5h8l4 4v13H6Z" strokeLinejoin="round" />
    <path d="M14 3.5V8h4" />
    <path d="M9 13h6M9 16.5h4" strokeLinecap="round" />
  </svg>
);
const ReceiptIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-[15px] w-[15px]">
    <path d="M5 3.5h14v17l-2.3-1.5-2.4 1.5-2.3-1.5-2.4 1.5L7 19l-2 1.5Z" strokeLinejoin="round" />
    <path d="M9 8.5h6M9 12h6" strokeLinecap="round" />
  </svg>
);
