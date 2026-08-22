import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/session';
import { listCommissionRates, listPrincipals, getOrg } from '@/lib/queries';
import { num, classLabel } from '@/lib/format';
import { Crumb, PageHeader, Help } from '@/components/ui';

export const dynamic = 'force-dynamic';

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="sec-label">{label}</dt>
      <dd className="mt-1 text-[13.5px] text-ink">{value || '—'}</dd>
    </div>
  );
}

export default async function GlobalSettingPage() {
  const user = await currentUser();
  if (!user) redirect('/login');

  const org = getOrg(user.org_id)!;
  const rates = listCommissionRates(user.org_id);
  const principals = listPrincipals();

  return (
    <div className="space-y-4">
      <div className="panel px-6 py-6">
        <Crumb items={[{ href: '/setting', label: 'Setting' }, { label: 'Global' }]} />
        <PageHeader
          title="Global"
          subtitle="Commission rates, company e-Invoice particulars and insurance company records."
        />
      </div>

      <div className="panel">
        <div className="panel-head">
          Commission rates setting
          <Help text="Default rate applied to gross premium when a policy is created for this principal." />
        </div>
        <div className="scroll-x">
          <table className="tbl">
            <thead>
              <tr>
                <th>Principal</th>
                <th>Class</th>
                <th className="num">Rate %</th>
              </tr>
            </thead>
            <tbody>
              {rates.map((r) => (
                <tr key={r.id}>
                  <td>
                    <span className="font-semibold text-brand">{r.short_name}</span>
                    <span className="block text-[12px] text-muted">{r.name}</span>
                  </td>
                  <td className="text-ink-soft">{classLabel(r.class)}</td>
                  <td className="num font-semibold">{num(r.rate, 2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">Company e-Invoice setting</div>
        <dl className="grid gap-5 px-6 py-5 sm:grid-cols-2 xl:grid-cols-4">
          <Field label="Company name" value={org.name} />
          <Field label="TIN number" value={org.tin_no} />
          <Field label="SSM registration no" value={org.ssm_no} />
          <Field label="SST number" value={org.sst_no} />
          <Field label="MSIC code" value={org.msic_code} />
          <Field label="Business activity description" value={org.business_desc} />
          <Field label="Invoice email" value={org.email} />
          <Field label="Invoice contact" value={org.phone} />
        </dl>
        <p className="border-t border-line px-6 py-3 text-[12.5px] text-muted">
          These particulars are printed on customer e-Invoices and on the self-billed e-Invoices issued
          to sub agents for commission payouts.
        </p>
      </div>

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
