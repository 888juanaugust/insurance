import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/session';
import { expiringBuckets, EXPIRING_BUCKETS, type ExpiringWithNote } from '@/lib/queries';
import { longDate, money, policyHref, classSlug } from '@/lib/format';
import { PageHeader, EmptyState } from '@/components/ui';
import FollowUp from '@/components/FollowUp';
import PutBack from '@/components/PutBack';

export const dynamic = 'force-dynamic';

/**
 * The worklist. One page answering the question an agent opens the site to
 * ask — whose cover is running out — sorted by how much trouble it is, with
 * the phone number already on screen so the next step is a call, not a hunt
 * through the client record.
 */

const TONE: Record<string, { border: string; wash: string; text: string; badge: string }> = {
  lapsed: { border: 'border-danger-line', wash: 'bg-danger-wash', text: 'text-danger', badge: 'badge-red' },
  week:   { border: 'border-warn-line', wash: 'bg-warn-wash',   text: 'text-warn',   badge: 'badge-amber' },
  month:  { border: 'border-line',      wash: '',               text: 'text-ink',    badge: 'badge-blue' },
  later:  { border: 'border-line',      wash: '',               text: 'text-ink',    badge: 'badge-grey' },
};

function daysLabel(days: number): string {
  if (days < 0) return `${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} ago`;
  if (days === 0) return 'today';
  return `in ${days} day${days === 1 ? '' : 's'}`;
}

function Row({ r, tone }: { r: ExpiringWithNote; tone: string }) {
  const t = TONE[tone];
  return (
    <tr>
      <td>
        <Link href={policyHref(r.class, r.id)} className="link-red">{r.policy_no}</Link>
        <span className="block text-[11px] text-muted">{r.principal}</span>
      </td>
      <td>
        <Link href={`/clients/${r.client_id}`} className="text-ink hover:underline">{r.insured}</Link>
        {r.phone && <span className="block text-[11px] text-muted">{r.phone}</span>}
      </td>
      <td className="text-ink-soft">
        {r.vehicle_no ?? r.product ?? '—'}
        {r.vehicle_no && r.make_model && (
          <span className="block text-[11px] text-muted">{r.make_model}</span>
        )}
      </td>
      <td className="text-ink-soft">{longDate(r.expiry_date)}</td>
      <td>
        <span className={`badge ${t.badge}`}>{daysLabel(r.days_left)}</span>
      </td>
      <td className="num">{money(r.total_premium)}</td>
      <td className="wrap">
        <FollowUp
          policyId={r.id}
          clientId={r.client_id}
          last={r.follow_up ? {
            at: r.follow_up.at, outcome: r.follow_up.outcome, note: r.follow_up.note,
            next_at: r.follow_up.next_at, by_name: r.follow_up.by_name,
          } : null}
        />
      </td>
      <td>
        <div className="flex flex-wrap gap-1.5">
          {/* Straight into a pre-filled new policy: the renewal loop the
              register already knows how to run. */}
          <Link
            href={`/insurance/${classSlug(r.class)}/new?renewal=${r.id}`}
            className="btn btn-primary px-2.5 py-1 text-[12px]"
          >
            Renew
          </Link>
          {r.phone && (
            <a href={`tel:${r.phone.replace(/\s/g, '')}`} className="btn btn-ghost px-2.5 py-1 text-[12px]">
              Call
            </a>
          )}
        </div>
      </td>
    </tr>
  );
}

export default async function ExpiringPage() {
  const user = await currentUser();
  if (!user) redirect('/login');

  const { rows, piles, urgent, waiting, settled } = expiringBuckets(user.org_id);

  return (
    <div className="space-y-4">
      <div className="panel px-6 py-6">
        <PageHeader
          title="Expiring soon"
          subtitle="Every policy running out, worst first — including the ones that already have."
          meta={
            rows.length || waiting.length || settled.length
              ? `${urgent} need${urgent === 1 ? 's' : ''} attention now · ${rows.length} to chase`
                + (waiting.length ? ` · ${waiting.length} waiting on a date the client asked for` : '')
                + (settled.length ? ` · ${settled.length} not renewing` : '')
              : 'Nothing is running out in the next 90 days.'
          }
          actions={
            <Link href="/renewals/notices" className="btn btn-ghost">Notices going out</Link>
          }
        />

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {EXPIRING_BUCKETS.map((b) => {
            const n = piles[b.key].length;
            const t = TONE[b.key];
            return (
              <div key={b.key} className={`rounded border px-5 py-4 ${n ? `${t.border} ${t.wash}` : 'border-line'}`}>
                <span className="sec-label">{b.label}</span>
                <p className={`mt-2 text-[24px] font-semibold leading-none tracking-tight ${n ? t.text : 'text-muted'}`}>
                  {n}
                </p>
                <p className="mt-1.5 text-[12px] text-muted">{b.note}</p>
              </div>
            );
          })}
        </div>
      </div>

      {rows.length === 0 && (
        <div className="panel">
          <EmptyState
            label="Nothing is running out"
            hint="Policies expiring in the next 90 days — and any that already have — appear here."
          />
        </div>
      )}

      {EXPIRING_BUCKETS.map((b) =>
        piles[b.key].length === 0 ? null : (
          <section key={b.key} className="panel">
            <div className="panel-head">
              {b.label}
              <span className="ml-auto text-[12px] font-normal text-muted">{b.note}</span>
            </div>
            <div className="scroll-x">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Policy no</th>
                    <th>Client</th>
                    <th>Vehicle or cover</th>
                    <th>Expires</th>
                    <th>When</th>
                    <th className="num">Premium</th>
                    <th>Last contact</th>
                    <th>Do</th>
                  </tr>
                </thead>
                <tbody>
                  {piles[b.key].map((r) => <Row key={r.id} r={r} tone={b.key} />)}
                </tbody>
              </table>
            </div>
          </section>
        ),
      )}

      {waiting.length > 0 && (
        <section className="panel">
          <div className="panel-head">
            Waiting until the client asked
            <span className="ml-auto text-[12px] font-normal text-muted">
              off the chase list until the day comes round
            </span>
          </div>
          <div className="scroll-x">
            <table className="tbl">
              <thead>
                <tr><th>Policy no</th><th>Client</th><th>Expires</th><th>Call back</th><th>What they said</th><th>Do</th></tr>
              </thead>
              <tbody>
                {waiting.map((r) => (
                  <tr key={r.id}>
                    <td><Link href={policyHref(r.class, r.id)} className="link-red">{r.policy_no}</Link></td>
                    <td className="text-ink">{r.insured}</td>
                    <td className="text-ink-soft">{longDate(r.expiry_date)}</td>
                    <td><span className="badge badge-amber">{longDate(r.follow_up?.next_at)}</span></td>
                    <td className="wrap text-ink-soft">{r.follow_up?.note ?? '—'}</td>
                    <td>
                      {/* Marked by mistake, or the client rang first: a way
                          back that does not wait for the date. */}
                      <div className="flex flex-wrap items-start gap-2">
                        <PutBack policyId={r.id} clientId={r.client_id} />
                        <FollowUp policyId={r.id} clientId={r.client_id} last={null} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {settled.length > 0 && (
        <section className="panel">
          <div className="panel-head">
            Not renewing
            <span className="ml-auto text-[12px] font-normal text-muted">
              said so themselves — kept here so the reason is not lost, and no reminder goes to them
            </span>
          </div>
          <div className="scroll-x">
            <table className="tbl">
              <thead>
                <tr><th>Policy no</th><th>Client</th><th>Expires</th><th>Told us</th><th>Why</th><th>Do</th></tr>
              </thead>
              <tbody>
                {settled.map((r) => (
                  <tr key={r.id}>
                    <td><Link href={policyHref(r.class, r.id)} className="link-red">{r.policy_no}</Link></td>
                    <td className="text-ink">{r.insured}</td>
                    <td className="text-ink-soft">{longDate(r.expiry_date)}</td>
                    <td className="text-ink-soft">{longDate(r.follow_up?.at)}</td>
                    <td className="wrap text-ink-soft">{r.follow_up?.note ?? '—'}</td>
                    <td><PutBack policyId={r.id} clientId={r.client_id} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
