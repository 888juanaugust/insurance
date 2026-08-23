'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { IconCash, IconSearch } from './icons';
import { Help } from './ui';
import { classLabel, money, policyHref, shortDate } from '@/lib/format';

export type OutRow = {
  id: string; policy_no: string; class: string; insured: string; principal: string;
  outstanding: number; due_date: string; days: number; vehicle_no: string | null;
};

export default function OutstandingPanel({
  clientRows,
  principalRows,
}: {
  clientRows: OutRow[];
  principalRows: OutRow[];
}) {
  const [tab, setTab] = useState<'client' | 'principal'>('client');
  const [q, setQ] = useState('');

  const rows = tab === 'client' ? clientRows : principalRows;

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((r) =>
      [r.policy_no, r.insured, r.principal, r.vehicle_no ?? ''].some((f) =>
        f.toLowerCase().includes(needle),
      ),
    );
  }, [rows, q]);

  const total = filtered.reduce((s, r) => s + r.outstanding, 0);

  return (
    <section className="panel flex min-h-[430px] flex-col">
      <div className="panel-head">
        <IconCash className="h-[17px] w-[17px] text-[#3d7d4f]" />
        Money outstanding
        <Help text="Premium not yet collected from clients, and premium not yet remitted to principals." />
      </div>

      <div className="flex gap-5 border-b border-line px-4">
        {(
          [
            ['client', `From clients (${clientRows.length})`, 'Premium the agency has not yet collected from the insured.'],
            ['principal', `To insurers (${principalRows.length})`, 'Premium collected or due that the agency has not yet remitted to the insurer.'],
          ] as const
        ).map(([key, label, help]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`-mb-px flex items-center gap-1.5 border-b-2 py-2.5 text-[13px] ${
              tab === key
                ? 'border-accent font-semibold text-accent'
                : 'border-transparent text-ink-soft hover:text-ink'
            }`}
          >
            {label}
            <Help text={help} />
          </button>
        ))}
      </div>

      <div className="px-4 pb-2 pt-3">
        <div className="relative">
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search policy no, insured, principal, vehicle..."
            aria-label="Search outstanding payments"
            className="inp pr-9"
          />
          <IconSearch className="pointer-events-none absolute right-2.5 top-1/2 h-[15px] w-[15px] -translate-y-1/2 text-muted" />
        </div>
        <p className="mt-2 text-[12.5px] text-ink-soft">
          Total outstanding: <span className="font-semibold text-ink">{money(total, 'MYR ')}</span>
        </p>
      </div>

      <div className="scroll-y scroll-x max-h-[330px] flex-1">
        <table className="tbl">
          <thead className="sticky top-0 z-10">
            <tr>
              <th>Policy no</th>
              <th>Insured</th>
              <th>Principal</th>
              <th>
                <span className="inline-flex items-center gap-1">
                  Type <Help text="Motor or non-motor class of business." />
                </span>
              </th>
              <th className="num">
                <span className="inline-flex items-center gap-1">
                  # of days <Help text="Days elapsed since the premium became due." />
                </span>
              </th>
              <th>Pay By</th>
              <th className="num">Outstanding</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id}>
                <td>
                  <Link
                    href={policyHref(r.class, r.id)}
                    className="link-red"
                  >
                    {r.policy_no}
                  </Link>
                </td>
                <td className="link-red">{r.insured}</td>
                <td className="font-semibold text-brand">{r.principal}</td>
                <td className="text-ink-soft">{classLabel(r.class)}</td>
                <td className="num text-ink-soft">{r.days}</td>
                <td className="text-ink-soft">{shortDate(r.due_date)}</td>
                <td className="num">
                  <span className="badge badge-red">Premium {money(r.outstanding, 'RM ')}</span>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="py-10 text-center text-[13px] text-muted">
                  No outstanding records match your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
