import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/session';
import { listLifePlans } from '@/lib/queries';
import { money, longDate } from '@/lib/format';
import { PageHeader, StatusBadge } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function ClientPlanningPage() {
  const user = await currentUser();
  if (!user) redirect('/login');

  const plans = listLifePlans(user.org_id);
  const inForce = plans.filter((p) => p.status === 'in force');
  const sumAssured = inForce.reduce((s, p) => s + Number(p.sum_assured), 0);
  const annualised = inForce.reduce(
    (s, p) => s + Number(p.premium) * (p.frequency === 'Monthly' ? 12 : p.frequency === 'Quarterly' ? 4 : 1),
    0,
  );

  return (
    <div className="panel px-6 py-6">
      <PageHeader
        title="Life planning"
        subtitle="Life and medical plans held alongside the general insurance portfolio."
        meta={`${plans.length} plans · ${inForce.length} in force · ${money(sumAssured)} sum assured · ${money(annualised)} annualised premium`}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ['Plans in force', String(inForce.length)],
          ['Total sum assured', money(sumAssured)],
          ['Annualised premium', money(annualised)],
          ['Requiring follow-up', String(plans.length - inForce.length)],
        ].map(([label, value]) => (
          <div key={label} className="rounded border border-line px-5 py-4">
            <p className="sec-label">{label}</p>
            <p className="mt-2 text-[22px] font-semibold tracking-tight text-ink">{value}</p>
          </div>
        ))}
      </div>

      <div className="scroll-x rounded border border-line">
        <table className="tbl">
          <thead>
            <tr>
              <th>Client</th>
              <th>Plan</th>
              <th>Provider</th>
              <th>Type</th>
              <th className="num">Sum assured</th>
              <th className="num">Premium</th>
              <th>Frequency</th>
              <th>Commenced</th>
              <th>Maturity</th>
              <th>Status</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {plans.map((p) => (
              <tr key={p.id}>
                <td>
                  <Link href={`/clients/${p.client_id}`} className="link-red">
                    {p.client_name}
                  </Link>
                </td>
                <td className="font-semibold text-ink">{p.plan_name}</td>
                <td className="text-ink-soft">{p.provider}</td>
                <td className="text-ink-soft">{p.plan_type}</td>
                <td className="num">{money(p.sum_assured)}</td>
                <td className="num">{money(p.premium)}</td>
                <td className="text-ink-soft">{p.frequency}</td>
                <td className="text-ink-soft">{longDate(p.start_date)}</td>
                <td className="text-ink-soft">{longDate(p.maturity_date)}</td>
                <td><StatusBadge status={p.status} /></td>
                <td className="wrap text-ink-soft">{p.notes}</td>
              </tr>
            ))}
            {plans.length === 0 && (
              <tr>
                <td colSpan={11} className="py-12 text-center text-[13px] text-muted">
                  No life plans recorded.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
