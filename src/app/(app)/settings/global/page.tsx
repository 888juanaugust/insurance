import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/session';
import { listCommissionRatesWithCeiling, listPrincipals, getOrg, policiesAtRate } from '@/lib/queries';
import { num } from '@/lib/format';
import { Crumb, PageHeader } from '@/components/ui';
import CommissionRatesForm from '@/components/CommissionRatesForm';
import { OrgInvoicePanel } from '@/components/OrgForms';

export const dynamic = 'force-dynamic';

export default async function GlobalSettingPage() {
  const user = await currentUser();
  if (!user) redirect('/login');

  const org = getOrg(user.org_id)!;
  const rates = listCommissionRatesWithCeiling(user.org_id).map((r) => ({
    ...r,
    policies: policiesAtRate(user.org_id, r.principal_id, r.class),
  }));
  const principals = listPrincipals();

  return (
    <div className="space-y-4">
      <div className="panel px-6 py-6">
        <Crumb items={[{ href: '/setting', label: 'Setting' }, { label: 'Global' }]} />
        <PageHeader
          title="Rates and insurers"
          subtitle="Commission rates, company e-Invoice particulars and insurance company records."
        />
      </div>

      <CommissionRatesForm rows={rates} />

      <OrgInvoicePanel org={org} />

      <div className="panel">
        <div className="panel-head">Insurance companies setting</div>
        <div className="scroll-x">
          <table className="tbl">
            <thead>
              <tr>
                <th>Short name</th>
                <th>Registered name</th>
                <th>Agency code</th>
                <th className="num">Motor %</th>
                <th className="num">Non-motor %</th>
                <th>Contact</th>
                <th>Phone</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {principals.map((p) => (
                <tr key={p.id}>
                  <td className="font-semibold text-brand">{p.short_name}</td>
                  <td className="text-ink">{p.name}</td>
                  <td className="text-ink-soft">{p.code}</td>
                  <td className="num">{num(p.motor_rate, 1)}</td>
                  <td className="num">{num(p.non_motor_rate, 1)}</td>
                  <td className="text-ink-soft">{p.contact_person}</td>
                  <td className="text-ink-soft">{p.phone}</td>
                  <td>
                    <span className={`badge ${p.status === 'active' ? 'badge-green' : 'badge-grey'}`}>
                      {p.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
