import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/session';
import { listRenewalSettings, renewalsDue } from '@/lib/queries';
import { classLabel, longDate, money, policyHref } from '@/lib/format';
import { Crumb, PageHeader } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function RenewalSettingPage() {
  const user = await currentUser();
  if (!user) redirect('/login');

  const settings = listRenewalSettings(user.org_id);
  const due = renewalsDue(user.org_id, 90);

  return (
    <div className="space-y-4">
      <div className="panel px-6 py-6">
        <Crumb items={[{ href: '/settings', label: 'Settings' }, { label: 'Renewal Setting' }]} />
        <PageHeader
          title="Renewal reminders"
          subtitle="Renewal notices sent to the insured before a policy expires."
          meta={`${settings.filter((s) => s.enabled).length} active reminder rules · ${due.length} policies expiring in the next 90 days`}
        />

        <div className="scroll-x rounded border border-line">
          <table className="tbl">
            <thead>
              <tr>
                <th>Send</th>
                <th>Channel</th>
                <th>Message template</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {settings.map((s) => (
                <tr key={s.id}>
                  <td className="font-semibold text-ink">{s.days_before} days before expiry</td>
                  <td className="text-ink-soft capitalize">{s.channel}</td>
                  <td className="wrap text-ink-soft">{s.template}</td>
                  <td>
                    <span className={`badge ${s.enabled ? 'badge-green' : 'badge-grey'}`}>
                      {s.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">Policies falling due (next 90 days)</div>
        <div className="scroll-x">
          <table className="tbl">
            <thead>
              <tr>
                <th>Policy no</th>
                <th>Insured</th>
                <th>Principal</th>
                <th>Class</th>
                <th>Product</th>
                <th>Vehicle</th>
                <th>Expires</th>
                <th className="num">Days left</th>
                <th className="num">Last premium</th>
                <th>Contact</th>
              </tr>
            </thead>
            <tbody>
              {due.map((r) => (
                <tr key={r.id}>
                  <td>
                    <Link
                      href={policyHref(r.class, r.id)}
                      className="link-red"
                    >
                      {r.policy_no}
                    </Link>
                  </td>
                  <td className="text-ink">{r.insured}</td>
                  <td className="font-semibold text-brand">{r.principal}</td>
                  <td className="text-ink-soft">{classLabel(r.class)}</td>
                  <td className="text-ink-soft">{r.product}</td>
                  <td className="text-ink-soft">{r.vehicle_no ?? '—'}</td>
                  <td className="text-ink-soft">{longDate(r.expiry_date)}</td>
                  <td className="num">
                    <span className={`badge ${r.days_left <= 30 ? 'badge-red' : r.days_left <= 60 ? 'badge-amber' : 'badge-grey'}`}>
                      {r.days_left}
                    </span>
                  </td>
                  <td className="num">{money(r.total_premium)}</td>
                  <td className="text-ink-soft">
                    {r.phone}
                    <span className="block text-[12px] text-muted">{r.email}</span>
                  </td>
                </tr>
              ))}
              {due.length === 0 && (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-[13px] text-muted">
                    No policies expiring in the next 90 days.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
