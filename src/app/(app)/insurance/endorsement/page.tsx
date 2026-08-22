import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/session';
import { listPolicies, listGroups } from '@/lib/queries';
import { money, longDate } from '@/lib/format';
import { PageHeader, StatusBadge, EmptyState } from '@/components/ui';

export const dynamic = 'force-dynamic';

/** Group schemes: non-motor cover written for a corporate client or grouping. */
const SCHEME_PRODUCTS = /medical|personal accident|group|hospitalisation|employee/i;

export default async function EmployeeBenefitsPage() {
  const user = await currentUser();
  if (!user) redirect('/login');

  const rows = listPolicies(user.org_id, { cls: 'non_motor' }).filter((p) =>
    SCHEME_PRODUCTS.test(`${p.product} ${p.type_of_cover}`),
  );
  const groups = listGroups(user.org_id);
  const lives = rows.length;
  const premium = rows.reduce((s, r) => s + r.total_premium, 0);

  return (
    <div className="space-y-4">
      <div className="panel px-6 py-6">
        <PageHeader
          title="Employee Benefits"
          subtitle="Group medical and personal accident schemes written for corporate clients."
          meta={`${lives} schemes · ${money(premium)} premium · ${groups.length} group accounts`}
          actions={<Link href="/insurance/non-motor/upload" className="btn btn-primary">Upload PDF</Link>}
        />
        {rows.length === 0 ? (
          <EmptyState label="No employee benefit schemes recorded" hint="Group medical and PA policies appear here." />
        ) : (
          <div className="scroll-x rounded border border-line">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Policy no</th><th>Client</th><th>Principal</th><th>Scheme</th>
                  <th>Cover</th><th>Period</th><th className="num">Sum insured</th>
                  <th className="num">Premium</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id}>
                    <td><Link href={`/insurance/non-motor/${p.id}`} className="link-red">{p.policy_no}</Link></td>
                    <td className="text-ink">{p.client_name}</td>
                    <td className="font-semibold text-brand">{p.principal}</td>
                    <td className="text-ink-soft">{p.product}</td>
                    <td className="text-ink-soft">{p.type_of_cover}</td>
                    <td className="text-ink-soft">{longDate(p.effective_date)} – {longDate(p.expiry_date)}</td>
                    <td className="num">{money(p.sum_insured)}</td>
                    <td className="num font-semibold">{money(p.total_premium)}</td>
                    <td><StatusBadge status={p.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="panel">
        <div className="panel-head">Group accounts</div>
        <div className="scroll-x">
          <table className="tbl">
            <thead>
              <tr><th>Group</th><th>Person in charge</th><th className="num">Members</th><th className="num">Policies</th><th className="num">Premium</th></tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <tr key={g.id}>
                  <td className="font-semibold text-ink">{g.name}</td>
                  <td className="text-ink-soft">{g.pic_name}</td>
                  <td className="num">{g.member_count}</td>
                  <td className="num">{g.policy_count}</td>
                  <td className="num">{money(g.premium_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
