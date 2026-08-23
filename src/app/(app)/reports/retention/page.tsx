import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/session';
import { retention } from '@/lib/queries';
import { money, longDate, today } from '@/lib/format';
import { Crumb, PageHeader, Help } from '@/components/ui';

export const dynamic = 'force-dynamic';

function yearAgo(iso: string): string {
  const d = new Date(iso);
  d.setFullYear(d.getFullYear() - 1);
  return d.toISOString().slice(0, 10);
}

export default async function RetentionPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect('/login');

  const sp = await searchParams;
  const to = sp.to || today();
  const from = sp.from || yearAgo(to);
  const r = retention(user.org_id, from, to);

  return (
    <div className="space-y-4">
      <div className="panel px-6 py-6">
        <Crumb items={[{ href: '/reports', label: 'Reports' }, { label: 'Retention' }]} />
        <PageHeader
          title="Retention and lapses"
          subtitle="Which cover that expired was renewed, and what the rest cost you."
          meta={`${longDate(from)} to ${longDate(to)}`}
        />

        <form action="/reports/retention" className="mt-5 flex flex-wrap items-end gap-2.5">
          <label className="text-[12.5px] text-muted">
            From
            <input type="date" name="from" defaultValue={from} className="inp ml-2 h-9 w-40 text-[13px]" />
          </label>
          <label className="text-[12.5px] text-muted">
            to
            <input type="date" name="to" defaultValue={to} className="inp ml-2 h-9 w-40 text-[13px]" />
          </label>
          <button type="submit" className="btn btn-ghost h-9">Apply</button>
        </form>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded border border-line px-4 py-3">
            <p className="text-[24px] font-semibold tabular-nums text-ink">{r.rate}%</p>
            <p className="mt-0.5 text-[12px] text-muted">renewed</p>
          </div>
          <div className="rounded border border-[#bfe0cd] bg-ok-wash px-4 py-3">
            <p className="text-[24px] font-semibold tabular-nums text-ok">{r.renewed.length}</p>
            <p className="mt-0.5 text-[12px] text-ok">kept · {money(r.premiumKept)}</p>
          </div>
          <div className="rounded border border-[#f3c9c5] bg-danger-wash px-4 py-3">
            <p className="text-[24px] font-semibold tabular-nums text-danger">{r.lapsed.length}</p>
            <p className="mt-0.5 text-[12px] text-danger">lapsed · {money(r.premiumLost)}</p>
          </div>
          <div className="rounded border border-line px-4 py-3">
            <p className="text-[24px] font-semibold tabular-nums text-ink">{money(r.commissionLost)}</p>
            <p className="mt-0.5 text-[12px] text-muted">commission not earned</p>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          Lapsed — {r.lapsed.length}
          <Help text="Expired with no later policy pointing back at it. These are the clients to telephone." />
        </div>
        {r.lapsed.length ? (
          <div className="scroll-x">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Policy</th>
                  <th>Vehicle</th>
                  <th>Insurer</th>
                  <th>Expired</th>
                  <th className="num">Premium</th>
                  <th className="num">Commission</th>
                  <th>Phone</th>
                </tr>
              </thead>
              <tbody>
                {r.lapsed.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <Link href={`/clients/${p.client_id}`} className="link-red font-semibold">{p.client_name}</Link>
                    </td>
                    <td className="text-ink-soft">{p.policy_no}</td>
                    <td className="text-ink-soft">{p.vehicle_no ?? '—'}</td>
                    <td className="text-ink-soft">{p.principal}</td>
                    <td className="whitespace-nowrap text-ink-soft">{longDate(p.expiry_date)}</td>
                    <td className="num">{money(p.total_premium)}</td>
                    <td className="num text-muted">{money(p.commission_amt)}</td>
                    <td className="text-ink-soft">{p.phone ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="px-5 py-8 text-center text-[13px] text-muted">
            Nothing lapsed in this period.
          </p>
        )}
      </div>

      {r.renewed.length > 0 && (
        <div className="panel">
          <div className="panel-head">Renewed — {r.renewed.length}</div>
          <div className="scroll-x">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Expired policy</th>
                  <th>Renewed as</th>
                  <th>Renewed on</th>
                  <th className="num">Premium</th>
                </tr>
              </thead>
              <tbody>
                {r.renewed.map((p) => (
                  <tr key={p.id}>
                    <td className="text-ink">{p.client_name}</td>
                    <td className="text-ink-soft">{p.policy_no}</td>
                    <td>
                      <Link href={`/insurance/general-motor/${p.renewed_by_id}`} className="link-red">
                        {p.renewed_by_no}
                      </Link>
                    </td>
                    <td className="text-ink-soft">{longDate(p.renewed_on)}</td>
                    <td className="num">{money(p.total_premium)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
