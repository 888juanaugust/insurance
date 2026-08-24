import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/session';
import {
  getKpis, listOrgs, listOutstanding, recentSales, upcomingBirthdays, listAgentOptions, getOrg,
  productionSummary, motorCompliance, renewalsDue, expiringBuckets,
} from '@/lib/queries';
import { classLabel, classSlug, longDate, money, policyHref, today } from '@/lib/format';
import FilterSelect from '@/components/FilterSelect';
import OutstandingPanel from '@/components/OutstandingPanel';
import { Help, SectionLabel, EmptyState } from '@/components/ui';
import { Production, MotorCompliance, Calendar } from '@/components/HomeSections';
import { IconGift, IconClipboard, IconUpload, IconSearch } from '@/components/icons';

export const dynamic = 'force-dynamic';

type Search = { [k: string]: string | string[] | undefined };

const KPIS = [
  { key: 'collection30',  label: 'Collected, last 30 days',         help: 'Premium collected from clients in the last 30 days.' },
  { key: 'cases30',       label: 'New cases, last 30 days',         help: 'Policies and quotations created in the last 30 days.' },
  { key: 'premiumYtd',    label: 'Premium collected',               help: 'Premium collected from clients since 1 January.' },
  { key: 'commissionYtd', label: 'Commission paid out',             help: 'Commission actually paid out since 1 January.' },
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
  const production = productionSummary(orgId, year, validAgent);
  const compliance = motorCompliance(orgId, 12);
  const expiring = expiringBuckets(orgId);
  // The desk shows what has to be acted on; the full ninety days is a click away.
  const needsDoing = [...expiring.piles.lapsed, ...expiring.piles.week, ...expiring.piles.month];
  const justAdded = recentSales(orgId, validAgent, 6);

  // Expiries falling in the current month, for the calendar.
  const marks = new Map<string, number>();
  for (const r of renewalsDue(orgId, 400)) {
    if (String(r.expiry_date).slice(0, 7) !== today().slice(0, 7)) continue;
    marks.set(r.expiry_date, (marks.get(r.expiry_date) ?? 0) + 1);
  }

  const values: Record<string, string> = {
    collection30: money(kpis.collection30),
    cases30: String(kpis.cases30),
    premiumYtd: money(kpis.premiumYtd),
    commissionYtd: money(kpis.commissionYtd),
  };

  // Registers hold names in capitals. Shouting GOOD DAY, TAN at somebody is
  // not a greeting, so the first name is cased down to look like one.
  const raw = user.name.split(/\s+/)[0] ?? '';
  const first = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
  const urgentTone =
    expiring.piles.lapsed.length > 0 ? 'bad' : expiring.urgent > 0 ? 'warn' : 'good';

  return (
    <div className="space-y-4">
      {/* ------------------------------------------------------ the desk */}
      <div className="panel px-6 py-6">
        <h1 className="text-[25px] font-semibold leading-tight tracking-tight text-ink">
          Good day, {first}
        </h1>
        <p className="mt-1 text-[13.5px] text-ink-soft">
          {expiring.urgent === 0
            ? 'Nothing is running out that needs chasing today.'
            : `${expiring.urgent} ${expiring.urgent === 1 ? 'policy needs' : 'policies need'} attention — the rest can wait.`}
        </p>

        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          <Link
            href="/insurance/general-motor/upload"
            className="flex items-start gap-3.5 rounded border border-brand bg-brand-wash px-5 py-4 hover:brightness-[0.98]"
          >
            <IconUpload className="mt-0.5 h-[20px] w-[20px] shrink-0 text-brand" />
            <span className="min-w-0">
              <span className="block text-[14.5px] font-semibold text-brand">Add a policy</span>
              <span className="mt-0.5 block text-[12.5px] text-ink-soft">
                Upload the schedule and Insurhelp reads it — or key it in by hand.
              </span>
            </span>
          </Link>

          <form action="/search" className="rounded border border-line px-5 py-4">
            <label htmlFor="desk-q" className="flex items-center gap-2 text-[14.5px] font-semibold text-ink">
              <IconSearch className="h-[18px] w-[18px] text-ink-soft" />
              Find a client or policy
            </label>
            <div className="mt-2 flex gap-2">
              <input
                id="desk-q"
                name="q"
                type="search"
                placeholder="Name, NRIC, policy no or vehicle"
                className="inp"
              />
              <button type="submit" className="btn btn-ghost shrink-0">Go</button>
            </div>
          </form>

          <Link
            href="/expiring"
            className={`flex items-start gap-3.5 rounded border px-5 py-4 hover:brightness-[0.98] ${
              urgentTone === 'bad' ? 'border-[#f3c9c5] bg-danger-wash'
                : urgentTone === 'warn' ? 'border-[#f0dcb4] bg-warn-wash'
                : 'border-[#bfe0cd] bg-ok-wash'
            }`}
          >
            <IconClipboard className={`mt-0.5 h-[20px] w-[20px] shrink-0 ${
              urgentTone === 'bad' ? 'text-danger' : urgentTone === 'warn' ? 'text-warn' : 'text-ok'
            }`} />
            <span className="min-w-0">
              <span className={`block text-[14.5px] font-semibold ${
                urgentTone === 'bad' ? 'text-danger' : urgentTone === 'warn' ? 'text-warn' : 'text-ok'
              }`}>
                {expiring.urgent} expiring soon
              </span>
              <span className="mt-0.5 block text-[12.5px] text-ink-soft">
                {expiring.piles.lapsed.length > 0
                  ? `${expiring.piles.lapsed.length} already ran out. Cover may have lapsed.`
                  : 'Within the next 30 days, worst first.'}
              </span>
            </span>
          </Link>
        </div>
      </div>

      {/* ------------------------------------------- what has to be done */}
      {needsDoing.length > 0 && (
        <section className="panel">
          <div className="panel-head">
            Running out
            <Link href="/expiring" className="ml-auto text-[12px] font-normal text-accent hover:underline">
              All {expiring.rows.length} within 90 days
            </Link>
          </div>
          <div className="scroll-x">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Client</th><th>Policy no</th><th>Vehicle or cover</th>
                  <th>Expires</th><th>When</th><th>Do</th>
                </tr>
              </thead>
              <tbody>
                {needsDoing.slice(0, 8).map((r) => (
                  <tr key={r.id} className={r.days_left < 0 ? 'bg-danger-wash' : undefined}>
                    <td>
                      <Link href={`/clients/${r.client_id}`} className="text-ink hover:underline">
                        {r.insured}
                      </Link>
                      {r.phone && <span className="block text-[11px] text-muted">{r.phone}</span>}
                    </td>
                    <td>
                      <Link href={policyHref(r.class, r.id)} className="link-red">{r.policy_no}</Link>
                    </td>
                    <td className="text-ink-soft">{r.vehicle_no ?? r.product ?? '—'}</td>
                    <td className="text-ink-soft">{longDate(r.expiry_date)}</td>
                    <td>
                      <span className={`badge ${
                        r.days_left < 0 ? 'badge-red' : r.days_left <= 7 ? 'badge-amber' : 'badge-blue'
                      }`}>
                        {r.days_left < 0
                          ? `${Math.abs(r.days_left)}d ago`
                          : r.days_left === 0 ? 'today' : `in ${r.days_left}d`}
                      </span>
                    </td>
                    <td>
                      <Link
                        href={`/insurance/${classSlug(r.class)}/new?renewal=${r.id}`}
                        className="btn btn-primary px-2.5 py-1 text-[12px]"
                      >
                        Renew
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ------------------------------------------------- your own work */}
      <section className="panel">
        <div className="panel-head">
          Just added
          <Link href="/insurance/general-motor" className="ml-auto text-[12px] font-normal text-accent hover:underline">
            The whole register
          </Link>
        </div>
        <div className="scroll-x">
          <table className="tbl">
            <thead>
              <tr>
                <th>Policy no</th><th>Insured</th><th>Insurer</th><th>Class</th>
                <th>Added</th><th className="num">Premium</th>
              </tr>
            </thead>
            <tbody>
              {justAdded.map((s) => (
                <tr key={s.id}>
                  <td><Link href={policyHref(s.class, s.id)} className="link-red">{s.policy_no}</Link></td>
                  <td className="text-ink">{s.insured}</td>
                  <td className="font-semibold text-brand">{s.principal}</td>
                  <td className="text-ink-soft">{classLabel(s.class)}</td>
                  <td className="text-ink-soft">{longDate(s.created_date ?? s.issue_date)}</td>
                  <td className="num">{money(s.total_premium)}</td>
                </tr>
              ))}
              {justAdded.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-[13px] text-muted">
                    No policy has been added yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ------------------------------------------------ agency figures */}
      <div className="panel px-6 py-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-[19px] font-semibold leading-tight tracking-tight text-ink">
            How the agency is doing
          </h2>
          <p className="mt-1 text-[13.5px] text-ink-soft">
            What is owed, what was written, and what falls due next. Nothing here needs doing today.
          </p>
          <p className="mt-1.5 text-[12.5px] text-muted">
            {org.name} · figures to {longDate(today())}
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
          <Link
            href={`/insurance/general-motor/export?${validAgent ? `agent=${validAgent}` : ''}`}
            className="btn btn-ghost"
          >
            Export CSV
          </Link>
          <Link href="/insurance/renewals?tab=expiring" className="btn btn-primary">
            Request renewal
          </Link>
        </div>
      </div>

      <SectionLabel>This year at a glance</SectionLabel>
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

      <SectionLabel>Today&rsquo;s work</SectionLabel>
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
                        href={policyHref(s.class, s.id)}
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

      <div className="mt-7">
        <SectionLabel>What you wrote</SectionLabel>
        <Production rows={production} />
      </div>

      {/* What falls due lives on its own page now, worked rather than watched;
          the calendar stays because a month at a glance is a different thing. */}
      <div className="mt-7 max-w-[440px]">
        <SectionLabel>This month</SectionLabel>
        <Calendar today={today()} marks={marks} />
      </div>

      <div className="mt-7">
        <SectionLabel>Road tax and inspection</SectionLabel>
        <MotorCompliance rows={compliance} />
      </div>
      </div>
    </div>
  );
}
