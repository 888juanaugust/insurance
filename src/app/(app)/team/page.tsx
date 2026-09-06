import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/session';
import { listSubAgents, getOrg, listAppUsers } from '@/lib/queries';
import { verifyPassword } from '@/lib/auth';
import { DEMO_PASSWORD } from '@/lib/passwords';
import AccountsPanel from '@/components/AccountsPanel';
import { money, longDate, num } from '@/lib/format';
import Link from 'next/link';
import { PageHeader, StatusBadge, Help } from '@/components/ui';
import { setSubAgentStatusAction, deleteSubAgentAction } from '@/lib/subagent-actions';
import { subAgentPolicyCount } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export default async function SubAgentsPage() {
  const user = await currentUser();
  if (!user) redirect('/login');

  const agents = listSubAgents(user.org_id);
  const orgName = getOrg(user.org_id)?.name ?? '';

  /*
   * The hash never reaches the browser. It is checked here against the one
   * password everyone who has seen the code knows, so an account created by
   * hand with that same password is flagged as loudly as a seeded one.
   */
  const accounts = listAppUsers(user.org_id).map(({ password_hash, ...a }) => ({
    id: a.id, name: a.name, email: a.email, status: a.status, demo: a.demo,
    demoPassword: a.status === 'active' && verifyPassword(DEMO_PASSWORD, password_hash),
  }));
  const active = agents.filter((a) => a.status === 'active').length;
  const commission = agents.reduce((s, a) => s + Number(a.commission_total ?? 0), 0);

  return (
    <div className="space-y-4">
      <AccountsPanel accounts={accounts} me={user.id} />

      <div className="panel px-6 py-6">
        <PageHeader
          title="Agents"
          subtitle="Downline agent roster with commission structure, activation control and e-Invoice details for self-billed payouts."
          meta={`${agents.length} agent${agents.length === 1 ? '' : 's'} · ${active} active · ${money(commission)} commission earned to date`}
          actions={
            <Link href="/team/new" className="btn btn-primary">
              <span className="text-[15px] leading-none">+</span> Add agent
            </Link>
          }
        />

        <div className="scroll-x rounded border border-line">
          <table className="tbl">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Organisation</th>
                <th>Contact number</th>
                <th>Contact email</th>
                <th className="num">
                  <span className="inline-flex items-center gap-1">
                    Motor % <Help text="Share of gross motor premium paid to this sub agent." />
                  </span>
                </th>
                <th className="num">Non-motor %</th>
                <th className="num">Override %</th>
                <th>Status</th>
                <th className="num">Cases</th>
                <th className="num">Premium</th>
                <th className="num">Commission</th>
                <th>Joined</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((a) => (
                <tr key={a.id}>
                  <td className="font-semibold text-ink">
                    {a.name}
                    <span className="block text-[12px] text-muted">{a.agent_code} · {a.rank}</span>
                  </td>
                  <td className="text-ink-soft">{a.email}</td>
                  <td className="text-ink-soft">{orgName}</td>
                  <td className="text-ink-soft">{a.phone}</td>
                  <td className="text-ink-soft">{a.email}</td>
                  <td className="num">{num(a.motor_rate, 1)}</td>
                  <td className="num">{num(a.non_motor_rate, 1)}</td>
                  <td className="num">{num(a.override_rate, 1)}</td>
                  <td><StatusBadge status={a.status} /></td>
                  <td className="num">{a.policy_count}</td>
                  <td className="num">{money(a.premium_total)}</td>
                  <td className="num">{money(a.commission_total)}</td>
                  <td className="text-ink-soft">{longDate(a.join_date)}</td>
                  <td>
                    <span className="flex flex-wrap items-center gap-2.5 text-[12.5px]">
                      <Link href={`/team/${a.id}/edit`} className="text-link hover:underline">Edit</Link>
                      <form action={setSubAgentStatusAction}>
                        <input type="hidden" name="id" value={a.id} />
                        <input type="hidden" name="status" value={a.status === 'active' ? 'inactive' : 'active'} />
                        <button type="submit" className="text-link hover:underline">
                          {a.status === 'active' ? 'Deactivate' : 'Activate'}
                        </button>
                      </form>
                      {subAgentPolicyCount(a.id) === 0 && (
                        <form action={deleteSubAgentAction}>
                          <input type="hidden" name="id" value={a.id} />
                          <button type="submit" className="text-danger hover:underline">Delete</button>
                        </form>
                      )}
                    </span>
                  </td>
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
