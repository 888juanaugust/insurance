import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/session';
import {
  getKpis, listOrgs, listOutstanding, recentSales, upcomingBirthdays, listAgentOptions, getOrg,
} from '@/lib/queries';
import { money, longDate, today, classLabel } from '@/lib/format';
import FilterSelect from '@/components/FilterSelect';
import OutstandingPanel from '@/components/OutstandingPanel';
import { Help, SectionLabel, EmptyState } from '@/components/ui';
import { IconGift, IconClipboard } from '@/components/icons';

export const dynamic = 'force-dynamic';

type Search = { [k: string]: string | string[] | undefined };

const KPIS = [
  { key: 'collection30',  label: '30 days collection',              help: 'Premium collected from clients in the last 30 days.' },
  { key: 'cases30',       label: '30 day created case',             help: 'Policies and quotations created in the last 30 days.' },
  { key: 'premiumYtd',    label: 'Total premium collected',         help: 'Premium collected from clients since 1 January.' },
  { key: 'commissionYtd', label: 'Total commission received',       help: 'Commission actually paid out since 1 January.' },
] as const;

export default async function DashboardPage({ searchParams }: { searchParams: Promise<Search> }) {
  const user = await currentUser();
  if (!user) redirect('/login');

  const sp = await searchParams;
  const orgs = listOrgs();
  const orgId = typeof sp.org === 'string' && orgs.some((o) => o.id === sp.org) ? sp.org : user.org_id;
  const agentId = typeof sp.agent === 'string' ? sp.agent : '';

  const org = getOrg(orgId)!;
  const agents = listAgentOptions(orgId);
  const validAgent = agents.some((a) => a.id === agentId) ? agentId : '';

  const kpis = getKpis(orgId, validAgent);
  const year = today().slice(0, 4);
  const birthdays = upcomingBirthdays(orgId, 30);
  const outClient = listOutstanding(orgId, 'client', validAgent);
  const outPrincipal = listOutstanding(orgId, 'principal', validAgent);
  const sales = recentSales(orgId, validAgent, 10);

  const values: Record<string, string> = {
    collection30: money(kpis.collection30),
    cases30: String(kpis.cases30),
    premiumYtd: money(kpis.premiumYtd),
    commissionYtd: money(kpis.commissionYtd),
  };

  return (
    <div className="panel px-6 py-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[25px] font-semibold leading-tight tracking-tight text-ink">
            Executive strategic performance
          </h1>
          <p className="mt-1 text-[13.5px] text-ink-soft">
            Agency performance, collections, and portfolio view — reporting layout.
          </p>
          <p className="mt-1.5 text-[12.5px] text-muted">
            Data as of {longDate(today())} · {org.name} · Performance year {year}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2.5">
          <FilterSelect
            name="org"
            label="Organisation"
            value={orgId}
            className="w-[176px]"
            options={orgs.map((o) => ({ value: o.id, label: o.name }))}
          />
          <FilterSelect
            name="agent"
            label="Agent"
            value={validAgent}
            className="w-[210px]"
            options={[
              { value: '', label: 'All agents in organisation' },
              ...agents.map((a) => ({ value: a.id, label: a.name })),
            ]}
          />
        </div>
      </div>

      <SectionLabel>Key indicators</SectionLabel>
      <div className="mb-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {KPIS.map((k) => (
          <div key={k.key} className="rounded border border-line bg-white px-5 py-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <div className="flex items-start gap-1.5">
              <span className="sec-label">
                {k.label}
                {(k.key === 'premiumYtd' || k.key === 'commissionYtd') && ` (YTD ${year})`}
              </span>
              <Help text={k.help} />
            </div>
            <p className="mt-2.5 text-[26px] font-semibold leading-none tracking-tight text-ink">
              {values[k.key]}
            </p>
          </div>
        ))}
      </div>

      <SectionLabel>Operations</SectionLabel>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)_minmax(0,1.3fr)]">
        <section className="panel flex min-h-[430px] flex-col">
          <div className="panel-head">
            <IconGift className="h-[17px] w-[17px] text-[#b06fb0]" />
            Birthday reminders
          </div>
          {birthdays.length === 0 ? (
            <div className="flex flex-1 items-center justify-center">
              <EmptyState label="No upcoming birthdays" hint="Client birthdays in the next 30 days appear here." />
            </div>
          ) : (
            <ul className="divide-y divide-[#eff1f4]">
              {birthdays.map((b) => (
                <li key={b.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <Link href={`/clients/${b.id}`} className="link-red block truncate text-[13px]">
                      {b.name}
                    </Link>
                    <p className="text-[12px] text-muted">
                      {longDate(b.dob)} · turning {b.turning}
                    </p>
                  </div>
                  <span className="badge badge-blue shrink-0">
                    {b.in_days === 0 ? 'Today' : `in ${b.in_days}d`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <OutstandingPanel clientRows={outClient as never} principalRows={outPrincipal as never} />

        <section className="panel flex min-h-[430px] flex-col">
          <div className="panel-head">
            <IconClipboard className="h-[17px] w-[17px] text-[#4a6fa5]" />
            Recent sales (top 10)
          </div>
          <p className="border-b border-line px-4 py-2.5 text-[12.5px] text-muted">
            Sorted by most recent created date (fallback to issue date).
          </p>
          <div className="scroll-x flex-1">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Policy no</th>
                  <th>Principal</th>
                  <th>Insured</th>
                  <th>Type</th>
                  <th className="num">Premium</th>
                </tr>
              </thead>
              <tbody>
                {sales.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <Link
                        href={`/insurance/${s.class === 'motor' ? 'motor' : 'non-motor'}/${s.id}`}
                        className="link-red"
                      >
                        {s.policy_no}
                      </Link>
                    </td>
                    <td className="font-semibold text-brand">{s.principal}</td>
                    <td className="text-ink-soft">{s.insured}</td>
                    <td className="text-ink-soft">{classLabel(s.class)}</td>
                    <td className="num">{money(s.total_premium)}</td>
                  </tr>
                ))}
                {sales.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-[13px] text-muted">
                      No sales recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
