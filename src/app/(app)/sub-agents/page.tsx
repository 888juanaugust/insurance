import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/session';
import { listSubAgents } from '@/lib/queries';
import { money, longDate, num } from '@/lib/format';
import { PageHeader, StatusBadge, Help } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function SubAgentsPage() {
  const user = await currentUser();
  if (!user) redirect('/login');

  const agents = listSubAgents(user.org_id);
  const active = agents.filter((a) => a.status === 'active').length;
  const commission = agents.reduce((s, a) => s + Number(a.commission_total ?? 0), 0);

  return (
    <div className="space-y-4">
      <div className="panel px-6 py-6">
        <PageHeader
          title="Sub Agents"
          subtitle="User access, commission structure and e-Invoice details for self-billed payouts."
          meta={`${agents.length} sub agent${agents.length === 1 ? '' : 's'} · ${active} active · ${money(commission)} commission earned to date`}
        />

        <div className="scroll-x rounded border border-line">
          <table className="tbl">
            <thead>
              <tr>
                <th>Name</th>
                <th>Agent code</th>
                <th>Rank</th>
                <th>Contact</th>
                <th className="num">
                  <span className="inline-flex items-center gap-1">
                    Motor % <Help text="Share of gross motor premium paid to this sub agent." />
                  </span>
                </th>
                <th className="num">Non-motor %</th>
                <th className="num">Override %</th>
                <th className="num">Cases</th>
                <th className="num">Premium</th>
                <th className="num">Commission</th>
                <th>Joined</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((a) => (
                <tr key={a.id}>
                  <td className="font-semibold text-ink">{a.name}</td>
                  <td className="text-ink-soft">{a.agent_code}</td>
                  <td className="text-ink-soft">{a.rank}</td>
                  <td className="text-ink-soft">
                    {a.phone}
                    <span className="block text-[12px] text-muted">{a.email}</span>
                  </td>
                  <td className="num">{num(a.motor_rate, 1)}</td>
                  <td className="num">{num(a.non_motor_rate, 1)}</td>
                  <td className="num">{num(a.override_rate, 1)}</td>
                  <td className="num">{a.policy_count}</td>
                  <td className="num">{money(a.premium_total)}</td>
                  <td className="num">{money(a.commission_total)}</td>
                  <td className="text-ink-soft">{longDate(a.join_date)}</td>
                  <td><StatusBadge status={a.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          e-Invoice &amp; payout details
          <Help text="Bank and TIN details used when the agency issues a self-billed e-Invoice for sub agent commission." />
        </div>
        <div className="scroll-x">
          <table className="tbl">
            <thead>
              <tr>
                <th>Sub agent</th>
                <th>NRIC</th>
                <th>TIN</th>
                <th>Bank</th>
                <th>Account number</th>
                <th>Self-billed e-Invoice</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((a) => (
                <tr key={a.id}>
                  <td className="font-semibold text-ink">{a.name}</td>
                  <td className="text-ink-soft">{a.nric}</td>
                  <td className="text-ink-soft">{a.einvoice_tin}</td>
                  <td className="text-ink-soft">{a.bank_name}</td>
                  <td className="text-ink-soft">{a.bank_account}</td>
                  <td>
                    <span className={`badge ${a.self_billed ? 'badge-green' : 'badge-grey'}`}>
                      {a.self_billed ? 'Enabled' : 'Not enabled'}
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
