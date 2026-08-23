import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/session';
import { listClaims, claimCounts } from '@/lib/queries';
import { money, longDate } from '@/lib/format';
import { PageHeader, Help } from '@/components/ui';
import FilterSelect from '@/components/FilterSelect';
import { CLAIM_TYPES, CLAIM_STATUSES, TYPE_LABEL, STATUS_LABEL, isClosed } from '@/lib/claims';

export const dynamic = 'force-dynamic';

/** Live stages read as work in hand; the three ends read as finished. */
function StageBadge({ status }: { status: string }) {
  const tone =
    status === 'settled' ? 'badge-green'
      : status === 'rejected' ? 'badge-red'
      : status === 'withdrawn' ? 'badge-grey'
      : status === 'documents' ? 'badge-amber'
      : 'badge-blue';
  return <span className={`badge ${tone}`}>{STATUS_LABEL[status] ?? status}</span>;
}

export default async function ClaimsPage({
  searchParams,
}: {
  searchParams: Promise<{ [k: string]: string | string[] | undefined }>;
}) {
  const user = await currentUser();
  if (!user) redirect('/login');

  const sp = await searchParams;
  const str = (k: string) => (typeof sp[k] === 'string' ? (sp[k] as string) : '');

  const filter = { status: str('status'), type: str('type'), search: str('q'), open: str('open') || 'open' };
  const rows = listClaims(user.org_id, filter);
  const counts = claimCounts(user.org_id);

  const estimate = rows.reduce((s, r) => s + r.estimate_amount, 0);
  const settled = rows.reduce((s, r) => s + r.settled_amount, 0);
  const excess = rows.reduce((s, r) => s + r.excess_borne, 0);

  return (
    <div className="space-y-4">
      <div className="panel px-6 py-6">
        <PageHeader
          title="Claims"
          subtitle="Motor and non-motor claims from the first phone call to settlement."
          meta={`${counts.open} open · ${counts.awaitingReport} waiting on documents · ${money(counts.settledValue)} settled to date`}
          actions={
            <Link href="/claims/new" className="btn btn-primary">
              <span className="text-[15px] leading-none">+</span> Open a claim
            </Link>
          }
        />

        {str('deleted') && (
          <p role="status" className="mt-4 rounded border border-line bg-ok-wash px-4 py-3 text-[13px] text-ok">
            Claim deleted, along with anything filed against it.
          </p>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-2.5">
          <form action="/claims" className="contents">
            <input
              type="search"
              name="q"
              defaultValue={filter.search}
              placeholder="Claim, policy, vehicle, insured or report no"
              aria-label="Search claims"
              className="inp h-9 w-72 text-[13px]"
            />
            {filter.open && <input type="hidden" name="open" value={filter.open} />}
            <button type="submit" className="btn btn-ghost h-9">Search</button>
          </form>
          <FilterSelect
            name="open"
            value={filter.open}
            label="Which claims"
            className="w-44"
            options={[
              { value: 'open', label: 'Open claims' },
              { value: 'closed', label: 'Closed claims' },
              { value: 'all', label: 'Every claim' },
            ]}
          />
          <FilterSelect
            name="status"
            value={filter.status}
            label="Stage"
            className="w-48"
            options={[
              { value: '', label: 'Any stage' },
              ...CLAIM_STATUSES.map((s) => ({ value: s.value, label: s.label })),
            ]}
          />
          <FilterSelect
            name="type"
            value={filter.type}
            label="Type"
            className="w-44"
            options={[
              { value: '', label: 'Any type' },
              ...CLAIM_TYPES.map((t) => ({ value: t.value, label: t.label })),
            ]}
          />
          {(filter.status || filter.type || filter.search) && (
            <Link href="/claims" className="text-[12.5px] link-red">Clear</Link>
          )}
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          {rows.length} {rows.length === 1 ? 'claim' : 'claims'}
          <Help text="NCD shows what the insured stands to lose at renewal if the claim goes against the policy." />
        </div>
        <div className="scroll-x">
          <table className="tbl">
            <thead>
              <tr>
                <th>Claim</th>
                <th>Policy</th>
                <th>Insured</th>
                <th>Vehicle</th>
                <th>Type</th>
                <th>Incident</th>
                <th className="num">Estimate</th>
                <th className="num">Settled</th>
                <th className="num">Excess</th>
                <th>NCD</th>
                <th>Stage</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <Link href={`/claims/${r.id}`} className="link-red font-semibold">{r.claim_no}</Link>
                    {r.insurer_claim_no && (
                      <span className="block text-[12px] text-muted">{r.insurer_claim_no}</span>
                    )}
                  </td>
                  <td>
                    <Link href={`/insurance/${r.class === 'non_motor' ? 'non-motor' : 'general-motor'}/${r.policy_id}`}
                      className="text-link hover:underline">
                      {r.policy_no}
                    </Link>
                    <span className="block text-[12px] text-muted">{r.principal}</span>
                  </td>
                  <td className="text-ink">{r.client_name}</td>
                  <td className="text-ink-soft">{r.vehicle_no ?? '—'}</td>
                  <td className="text-ink-soft">{TYPE_LABEL[r.type] ?? r.type}</td>
                  <td className="whitespace-nowrap text-ink-soft">{longDate(r.incident_date)}</td>
                  <td className="num">{r.estimate_amount ? money(r.estimate_amount) : '—'}</td>
                  <td className="num font-semibold">{r.settled_amount ? money(r.settled_amount) : '—'}</td>
                  <td className="num text-ink-soft">{r.excess_borne ? money(r.excess_borne) : '—'}</td>
                  <td>
                    {r.affects_ncd === 1 ? (
                      <span className="badge badge-amber" title={`${r.ncd_pct}% at risk`}>
                        resets {r.ncd_pct > 0 ? `${r.ncd_pct}%` : ''}
                      </span>
                    ) : (
                      <span className="badge badge-green">kept</span>
                    )}
                  </td>
                  <td><StageBadge status={r.status} /></td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-[13px] text-muted">
                    {filter.search || filter.status || filter.type
                      ? 'No claims match those filters.'
                      : filter.open === 'open'
                        ? 'No open claims. Everything on file has been settled, rejected or withdrawn.'
                        : 'No claims on file yet.'}
                  </td>
                </tr>
              )}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={6} className="font-semibold text-ink">Totals</td>
                  <td className="num font-semibold">{money(estimate)}</td>
                  <td className="num font-semibold">{money(settled)}</td>
                  <td className="num font-semibold">{money(excess)}</td>
                  <td colSpan={2} className="text-[12px] text-muted">
                    {rows.filter((r) => !isClosed(r.status)).length} still open
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
