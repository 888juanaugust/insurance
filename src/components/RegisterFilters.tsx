'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { IconSearch } from './icons';

export default function RegisterFilters({
  chips, slug,
}: {
  chips: { short_name: string; n: number }[];
  slug: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const active = params.get('principal') ?? '';
  const [vehicle, setVehicle] = useState(params.get('vehicle') ?? '');
  const [insured, setInsured] = useState(params.get('insured') ?? '');
  const [nric, setNric] = useState(params.get('nric') ?? '');
  const [dateField, setDateField] = useState(params.get('dateField') ?? 'uploaded_at');
  const [from, setFrom] = useState(params.get('from') ?? '');
  const [to, setTo] = useState(params.get('to') ?? '');

  function apply(extra: Record<string, string> = {}) {
    const sp = new URLSearchParams(params.toString());
    const next: Record<string, string> = { vehicle, insured, nric, dateField, from, to, ...extra, page: '1' };
    for (const [k, v] of Object.entries(next)) {
      if (v) sp.set(k, v);
      else sp.delete(k);
    }
    router.push(`${pathname}?${sp.toString()}`);
  }

  function pickPrincipal(name: string) {
    const sp = new URLSearchParams(params.toString());
    if (name) sp.set('principal', name);
    else sp.delete('principal');
    sp.set('page', '1');
    router.push(`${pathname}?${sp.toString()}`);
  }

  const exportHref = `/insurance/${slug}/export?${params.toString()}`;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => pickPrincipal('')}
          className={`rounded px-3.5 py-1.5 text-[12.5px] font-semibold ${
            active === '' ? 'bg-accent text-white' : 'border border-line bg-surface text-ink-soft hover:border-accent hover:text-accent'
          }`}
        >
          All
        </button>
        {chips.map((c) => (
          <button
            key={c.short_name}
            type="button"
            onClick={() => pickPrincipal(c.short_name)}
            title={`${c.n} ${c.n === 1 ? 'policy' : 'policies'}`}
            className={`rounded px-3.5 py-1.5 text-[12.5px] font-semibold ${
              active === c.short_name
                ? 'bg-accent text-white'
                : `border border-line bg-surface hover:border-accent hover:text-accent ${
                    c.n === 0 ? 'text-faint' : 'text-ink-soft'
                  }`
            }`}
          >
            {c.short_name}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <select
          aria-label="Date field"
          value={dateField}
          onChange={(e) => setDateField(e.target.value)}
          className="inp w-[150px] cursor-pointer"
        >
          <option value="uploaded_at">Upload Date</option>
          <option value="issue_date">Issue Date</option>
          <option value="effective_date">Effective Date</option>
        </select>
        <input
          type="date"
          aria-label="From date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="inp w-[150px]"
        />
        <span className="text-muted">→</span>
        <input
          type="date"
          aria-label="To date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="inp w-[150px]"
        />
        <input
          aria-label="Vehicle number"
          placeholder="Vehicle Number"
          value={vehicle}
          onChange={(e) => setVehicle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && apply()}
          className="inp w-[170px]"
        />
        <input
          aria-label="Insured name"
          placeholder="Insured Name"
          value={insured}
          onChange={(e) => setInsured(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && apply()}
          className="inp w-[190px]"
        />
        <input
          aria-label="NRIC, passport or business registration number"
          placeholder="NRIC / Passport / BRN"
          value={nric}
          onChange={(e) => setNric(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && apply()}
          className="inp w-[190px]"
        />
        <button type="button" onClick={() => apply()} className="btn btn-primary">
          <IconSearch className="h-[14px] w-[14px]" />
          Search
        </button>
        <Link href={exportHref} className="btn btn-ghost">Export CSV</Link>
      </div>
    </div>
  );
}
