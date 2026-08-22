import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/session';
import { renewalsDue } from '@/lib/queries';
import { money, longDate, classLabel } from '@/lib/format';
import { PageHeader } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function RenewalsPage() {
  const user = await currentUser();
  if (!user) redirect('/login');

  const due = renewalsDue(user.org_id, 120);
  const buckets = [
    { label: 'Expiring within 30 days', rows: due.filter((r) => r.days_left <= 30) },
    { label: '31 – 60 days', rows: due.filter((r) => r.days_left > 30 && r.days_left <= 60) },
    { label: '61 – 120 days', rows: due.filter((r) => r.days_left > 60) },
  ];

  return (
    <div className="space-y-4">
      <div className="panel px-6 py-6">
        <PageHeader
          title="Renewals"
          subtitle="Policies approaching expiry, so the renewal can be quoted before cover lapses."
          meta={`${due.length} policies expiring in the next 120 days · ${money(due.reduce((s, r) => s + r.total_premium, 0))} of premium at risk`}
        />
        <div className="grid gap-4 sm:grid-cols-3">
          {buckets.map((b) => (
            <div key={b.label} className="rounded border border-line px-5 py-4">
              <p className="sec-label">{b.label}</p>
              <p className="mt-2 text-[22px] font-semibold tracking-tight text-ink">{b.rows.length}</p>
              <p className="mt-1 text-[12px] text-muted">
                {money(b.rows.reduce((s, r) => s + r.total_premium, 0))} premium
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">Expiring policies</div>
        <div className="scroll-x">
          <table className="tbl">
            <thead>
              <tr>
                <th>Policy no</th><th>Insured</th><th>Principal</th><th>Class</th>
                <th>Vehicle</th><th>Expires</th><th className="num">Days left</th>
                <th className="num">Last premium</th><th>Contact</th><th>Action</th>
              </tr>
            </thead>
            <tbody>
              {due.map((r) => (
                <tr key={r.id}>
                  <td>
                    <Link href={`/insurance/${r.class === 'motor' ? 'motor' : 'non-motor'}/${r.id}`} className="link-red">
                      {r.policy_no}
                    </Link>
                  </td>
                  <td className="text-ink">{r.insured}</td>
                  <td className="font-semibold text-brand">{r.principal}</td>
                  <td className="text-ink-soft">{classLabel(r.class)}</td>
                  <td className="text-ink-soft">{r.vehicle_no ?? '—'}</td>
                  <td className="text-ink-soft">{longDate(r.expiry_date)}</td>
                  <td className="num">
                    <span className={`badge ${r.days_left <= 30 ? 'badge-red' : r.days_left <= 60 ? 'badge-amber' : 'badge-grey'}`}>
                      {r.days_left}
                    </span>
                  </td>
                  <td className="num">{money(r.total_premium)}</td>
                  <td className="text-ink-soft">{r.phone}</td>
                  <td>
                    <Link
                      href={`/insurance/${r.class === 'motor' ? 'motor' : 'non-motor'}/upload`}
                      className="btn btn-ghost px-2.5 py-1 text-[12px]"
                    >
                      Upload renewal
                    </Link>
                  </td>
                </tr>
              ))}
              {due.length === 0 && (
                <tr><td colSpan={10} className="py-12 text-center text-[13px] text-muted">Nothing due in the next 120 days.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
