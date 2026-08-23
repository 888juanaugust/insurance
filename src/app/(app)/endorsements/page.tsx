import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/session';
import { listEndorsements, endorsementCounts } from '@/lib/queries';
import { money, longDate } from '@/lib/format';
import { PageHeader, Help } from '@/components/ui';
import FilterSelect from '@/components/FilterSelect';
import { ENDORSEMENT_TYPES, ENDORSEMENT_STATUSES, TYPE_LABEL, STATUS_LABEL } from '@/lib/endorsements';

export const dynamic = 'force-dynamic';

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === 'issued' ? 'badge-green'
      : status === 'cancelled' ? 'badge-grey'
      : status === 'submitted' ? 'badge-blue'
      : 'badge-amber';
  return <span className={`badge ${tone}`}>{STATUS_LABEL[status] ?? status}</span>;
}

/** Money in is black, money back is red — the direction matters more than the size. */
function Amount({ value }: { value: number }) {
  if (!value) return <span className="text-muted">—</span>;
  return (
    <span className={value < 0 ? 'font-semibold text-danger' : 'font-semibold text-ink'}>
      {value < 0 ? `(${money(Math.abs(value))})` : money(value)}
    </span>
  );
}

export default async function EndorsementsPage({
  searchParams,
}: {
  searchParams: Promise<{ [k: string]: string | string[] | undefined }>;
}) {
  const user = await currentUser();
  if (!user) redirect('/login');

  const sp = await searchParams;
  const str = (k: string) => (typeof sp[k] === 'string' ? (sp[k] as string) : '');

  const filter = { status: str('status'), type: str('type'), search: str('q'), effect: str('effect') };
  const rows = listEndorsements(user.org_id, filter);
  const counts = endorsementCounts(user.org_id);

  const additional = rows.filter((r) => r.total_amount > 0).reduce((s, r) => s + r.total_amount, 0);
  const refunded = rows.filter((r) => r.total_amount < 0).reduce((s, r) => s + r.total_amount, 0);

  return (
    <div className="space-y-4">
      <div className="panel px-6 py-6">
        <PageHeader
          title="Endorsements"
          subtitle="Mid-term changes to cover, and the premium each one moves."
          meta={`${counts.open} not yet issued · ${money(counts.additional)} additional · ${money(Math.abs(counts.refunded))} refunded`}
          actions={
            <Link href="/endorsements/new" className="btn btn-primary">
              <span className="text-[15px] leading-none">+</span> Raise an endorsement
            </Link>
          }
        />

        {str('deleted') && (
          <p role="status" className="mt-4 rounded border border-line bg-ok-wash px-4 py-3 text-[13px] text-ok">
            Endorsement deleted.
          </p>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-2.5">
          <form action="/endorsements" className="contents">
            <input type="search" name="q" defaultValue={filter.search}
              placeholder="Endorsement, policy, vehicle or insured"
              aria-label="Search endorsements" className="inp h-9 w-72 text-[13px]" />
            <button type="submit" className="btn btn-ghost h-9">Search</button>
          </form>
          <FilterSelect name="status" value={filter.status} label="Stage" className="w-48"
            options={[{ value: '', label: 'Any stage' },
              ...ENDORSEMENT_STATUSES.map((s) => ({ value: s.value, label: s.label }))]} />
          <FilterSelect name="type" value={filter.type} label="Change" className="w-56"
            options={[{ value: '', label: 'Any change' },
              ...ENDORSEMENT_TYPES.map((t) => ({ value: t.value, label: t.label }))]} />
          <FilterSelect name="effect" value={filter.effect} label="Effect" className="w-44"
            options={[
              { value: '', label: 'Any effect' },
              { value: 'additional', label: 'Additional premium' },
              { value: 'refund', label: 'Return premium' },
              { value: 'nil', label: 'No premium change' },
            ]} />
          {(filter.status || filter.type || filter.search || filter.effect) && (
            <Link href="/endorsements" className="text-[12.5px] link-red">Clear</Link>
          )}
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          {rows.length} {rows.length === 1 ? 'endorsement' : 'endorsements'}
          <Help text="Additional premium is charged on the unexpired period. A cancellation is refunded on the short-period scale, which returns less than the calendar would suggest." />
        </div>
        <div className="scroll-x">
          <table className="tbl">
            <thead>
              <tr>
                <th>Endorsement</th>
                <th>Policy</th>
                <th>Insured</th>
                <th>Change</th>
                <th>Effective</th>
                <th className="num">Unexpired</th>
                <th className="num">Gross</th>
                <th className="num">Tax</th>
                <th className="num">Duty</th>
                <th className="num">Total</th>
                <th>Stage</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <Link href={`/endorsements/${r.id}`} className="link-red font-semibold">{r.endorsement_no}</Link>
                    {r.insurer_ref && <span className="block text-[12px] text-muted">{r.insurer_ref}</span>}
                  </td>
                  <td>
                    <Link href={`/insurance/${r.class === 'non_motor' ? 'non-motor' : 'general-motor'}/${r.policy_id}`}
                      className="text-link hover:underline">{r.policy_no}</Link>
                    <span className="block text-[12px] text-muted">{r.principal}</span>
                  </td>
                  <td className="text-ink">{r.client_name}</td>
                  <td className="text-ink-soft">
                    {TYPE_LABEL[r.type] ?? r.type}
                    {r.description && (
                      <span className="block max-w-[280px] truncate text-[12px] text-muted" title={r.description}>
                        {r.description}
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap text-ink-soft">{longDate(r.effective_date)}</td>
                  <td className="num text-muted">
                    {r.cover_days ? `${r.days_unexpired}/${r.cover_days}` : '—'}
                  </td>
                  <td className="num"><Amount value={r.gross_amount} /></td>
                  <td className="num text-ink-soft">{r.service_tax ? money(r.service_tax) : '—'}</td>
                  <td className="num text-ink-soft">{r.stamp_duty ? money(r.stamp_duty) : '—'}</td>
                  <td className="num"><Amount value={r.total_amount} /></td>
                  <td><StatusBadge status={r.status} /></td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-[13px] text-muted">
                    {filter.search || filter.status || filter.type || filter.effect
                      ? 'No endorsements match those filters.'
                      : 'No endorsements on file. Raise one when cover changes mid-term.'}
                  </td>
                </tr>
              )}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={9} className="font-semibold text-ink">
                    Totals · {money(additional)} in, {money(Math.abs(refunded))} back
                  </td>
                  <td className="num"><Amount value={additional + refunded} /></td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
