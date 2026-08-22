import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/session';
import { reportOutstandingAging } from '@/lib/queries';
import { money, longDate, classLabel } from '@/lib/format';
import { Crumb, PageHeader } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function OutstandingPremiumReport() {
  const user = await currentUser();
  if (!user) redirect('/login');

  const { rows, buckets } = reportOutstandingAging(user.org_id);
  const total = rows.reduce((s, r) => s + r.outstanding, 0);

  return (
    <div className="space-y-4">
      <div className="panel px-6 py-6">
        <Crumb items={[{ href: '/reports', label: 'Reports' }, { label: 'Outstanding Premium' }]} />
        <PageHeader
          title="Outstanding Premium"
          subtitle="Aged analysis of premium not yet collected from clients."
          meta={`${rows.length} outstanding items · ${money(total)} total`}
        />

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {buckets.map((b) => (
            <div key={b.label} className="rounded border border-line px-5 py-4">
              <p className="sec-label">{b.label}</p>
              <p className="mt-2 text-[20px] font-semibold tracking-tight text-ink">{money(b.amount)}</p>
              <p className="mt-1 text-[12px] text-muted">{b.cases} case{b.cases === 1 ? '' : 's'}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">Outstanding items</div>
        <div className="scroll-x">
          <table className="tbl">
            <thead>
              <tr>
                <th>Policy no</th>
                <th>Insured</th>
                <th>Principal</th>
                <th>Class</th>
                <th>Vehicle</th>
                <th>Servicing agent</th>
                <th>Due date</th>
                <th className="num"># of days</th>
                <th className="num">Outstanding</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <Link
                      href={`/insurance/${r.class === 'motor' ? 'motor' : 'non-motor'}/${r.id}`}
                      className="link-red"
                    >
                      {r.policy_no}
                    </Link>
                  </td>
                  <td className="text-ink">{r.insured}</td>
                  <td className="font-semibold text-brand">{r.principal}</td>
                  <td className="text-ink-soft">{classLabel(r.class)}</td>
                  <td className="text-ink-soft">{r.vehicle_no ?? '—'}</td>
                  <td className="text-ink-soft">{r.agent_name ?? '—'}</td>
                  <td className="text-ink-soft">{longDate(r.due_date)}</td>
                  <td className="num">
                    <span className={`badge ${r.days > 90 ? 'badge-red' : r.days > 30 ? 'badge-amber' : 'badge-grey'}`}>
                      {r.days}
                    </span>
                  </td>
                  <td className="num font-semibold">{money(r.outstanding)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-[#fafbfc] font-semibold">
                <td colSpan={8} className="px-3 py-2.5 text-ink">Total outstanding</td>
                <td className="num px-3 py-2.5">{money(total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
