import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { currentUser } from '@/lib/session';
import { getEndorsement } from '@/lib/queries';
import { money, longDate } from '@/lib/format';
import { Crumb, Help } from '@/components/ui';
import { TYPE_LABEL, STATUS_LABEL, calculateEndorsement } from '@/lib/endorsements';
import { deleteEndorsementAction } from '@/lib/endorsement-actions';

export const dynamic = 'force-dynamic';

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="sec-label">{label}</dt>
      <dd className="mt-1 text-[13.5px] text-ink">{value || '—'}</dd>
    </div>
  );
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between gap-4 border-b border-line-soft px-5 py-2.5 last:border-0 ${
      strong ? 'bg-canvas font-semibold text-ink' : 'text-ink-soft'
    }`}>
      <span className="text-[13px]">{label}</span>
      <span className="text-[13.5px] tabular-nums">{value}</span>
    </div>
  );
}

export default async function EndorsementPage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ blocked?: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect('/login');

  const { id } = await params;
  const { blocked } = await searchParams;
  const e = getEndorsement(id, user.org_id);
  if (!e) notFound();

  const slug = e.class === 'non_motor' ? 'non-motor' : 'general-motor';
  const refund = e.total_amount < 0;

  // Re-derive the working purely to show it. The stored figures are what
  // counts; this explains how they were reached.
  const working = calculateEndorsement({
    type: e.type,
    effectiveDate: e.effective_date,
    policyStart: String(e.policy_start ?? e.effective_date),
    policyEnd: String(e.policy_end ?? e.effective_date),
    annualDifference: e.annual_difference,
    annualPremium: Number(e.gross_premium ?? 0),
  });

  return (
    <div className="space-y-4">
      <div className="panel px-6 py-6">
        <Crumb items={[{ href: '/endorsements', label: 'Endorsements' }, { label: e.endorsement_no }]} />

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-[24px] font-semibold tracking-tight text-ink">{e.endorsement_no}</h1>
            <p className="mt-1 text-[13.5px] text-ink-soft">
              {TYPE_LABEL[e.type] ?? e.type} ·{' '}
              <Link href={`/insurance/${slug}/${e.policy_id}`} className="link-red">{e.policy_no}</Link>
              {' · '}
              <Link href={`/clients/${e.client_id}`} className="link-red">{e.client_name}</Link>
              {e.vehicle_no && ` · ${e.vehicle_no}`}
            </p>
            <p className="mt-1.5 text-[12.5px] text-muted">
              Effective {longDate(e.effective_date)}
              {e.issued_date && ` · issued ${longDate(e.issued_date)}`}
              {e.insurer_ref && ` · insurer ref ${e.insurer_ref}`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`badge ${
              e.status === 'issued' ? 'badge-green' : e.status === 'cancelled' ? 'badge-grey'
                : e.status === 'submitted' ? 'badge-blue' : 'badge-amber'
            }`}>
              {STATUS_LABEL[e.status] ?? e.status}
            </span>
            <span className="badge badge-blue">{e.principal}</span>
            <Link href={`/endorsements/${e.id}/edit`} className="btn btn-ghost">Edit</Link>
            {e.status !== 'issued' && (
              <form action={deleteEndorsementAction}>
                <input type="hidden" name="endorsement_id" value={e.id} />
                <button type="submit" className="btn btn-ghost text-danger">Delete</button>
              </form>
            )}
          </div>
        </div>

        {blocked === 'issued' && (
          <p role="alert" className="mt-4 rounded border border-danger-line bg-danger-wash px-4 py-3 text-[13px] text-danger">
            An issued endorsement cannot be deleted — the cover has already changed. Raise a cancelling
            endorsement instead, so both sides of the record agree.
          </p>
        )}

        <div className="mt-6 rounded border border-line px-4 py-3">
          <p className="sec-label">What changed</p>
          <p className="mt-1 whitespace-pre-line text-[13.5px] text-ink">{e.description}</p>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="panel">
          <div className="panel-head">
            {refund ? 'Return premium' : e.total_amount ? 'Additional premium' : 'Premium'}
            <Help text="Additional premium is charged only for the unexpired part of the year. A cancellation is refunded on the short-period scale instead." />
          </div>
          <div className="border-b border-line px-5 py-3">
            <p className="sec-label mb-2">
              {e.basis === 'short_period' ? 'Short-period scale' : e.basis === 'pro_rata' ? 'Pro-rata' : 'No premium change'}
            </p>
            <ul className="space-y-1 text-[12.5px] text-ink-soft">
              {working.explanation.map((line, i) => <li key={i}>{line}</li>)}
            </ul>
          </div>
          <Line label={refund ? 'Return premium' : 'Additional premium'} value={money(Math.abs(e.gross_amount))} />
          <Line label="Service tax at 8%" value={money(Math.abs(e.service_tax))} />
          <Line label="Stamp duty" value={money(e.stamp_duty)} />
          <Line
            label={refund ? 'Refund to the client' : e.total_amount ? 'Payable by the client' : 'Nothing to collect'}
            value={money(Math.abs(e.total_amount))}
            strong
          />
        </div>

        <div className="panel">
          <div className="panel-head">The policy it alters</div>
          <dl className="grid gap-5 px-6 py-5 sm:grid-cols-2">
            <Field label="Policy" value={
              <Link href={`/insurance/${slug}/${e.policy_id}`} className="link-red">{e.policy_no}</Link>
            } />
            <Field label="Insurer" value={e.principal} />
            <Field label="Cover period" value={`${longDate(e.policy_start)} to ${longDate(e.policy_end)}`} />
            <Field label="Annual gross premium" value={money(Number(e.gross_premium ?? 0))} />
            <Field label="Change in annual premium"
              value={e.annual_difference ? money(e.annual_difference) : 'None'} />
            <Field label="Unexpired at the effective date"
              value={e.cover_days ? `${e.days_unexpired} of ${e.cover_days} days` : '—'} />
            <Field label="Vehicle" value={e.vehicle_no ? `${e.vehicle_no} · ${e.make_model ?? ''}` : '—'} />
            <Field label="Raised" value={longDate(e.created_at)} />
          </dl>

          {e.remarks && (
            <div className="border-t border-line px-6 py-5">
              <p className="sec-label">Remarks</p>
              <p className="mt-1 whitespace-pre-line text-[13.5px] text-ink">{e.remarks}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
