import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { currentPortalClient } from '@/lib/portal-session';
import { portalPolicy } from '@/lib/queries';
import { portalRequestRenewalAction } from '@/lib/portal-actions';
import { money, longDate } from '@/lib/format';

export const dynamic = 'force-dynamic';

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-[#eff1f4] px-5 py-2.5 last:border-0">
      <span className="text-[13px] text-ink-soft">{label}</span>
      <span className="text-[13.5px] text-ink">{value || '—'}</span>
    </div>
  );
}

export default async function PortalPolicyPage({ params }: { params: Promise<{ id: string }> }) {
  const client = await currentPortalClient();
  if (!client) redirect('/portal/login');

  const { id } = await params;
  // portalPolicy looks only within this client's own policies, so another
  // client's id is simply not found rather than refused.
  const p = portalPolicy(id, client.id);
  if (!p) notFound();

  const outstanding = p.payment_status && p.payment_status !== 'paid'
    ? p.total_premium - (p.paid ?? 0)
    : 0;

  return (
    <div className="space-y-4">
      <div className="panel px-6 py-6">
        <Link href="/portal" className="text-[12.5px] text-link hover:underline">← All your policies</Link>
        <h1 className="mt-3 text-[22px] font-semibold tracking-tight text-ink">{p.policy_no}</h1>
        <p className="mt-1.5 text-[13.5px] text-ink-soft">
          {[p.product, p.type_of_cover].filter(Boolean).join(' · ')} · {p.principal_name}
        </p>
        <p className="mt-1 text-[12.5px] text-muted">
          Cover from {longDate(p.effective_date)} to {longDate(p.expiry_date)}
        </p>

        <form action={portalRequestRenewalAction} className="mt-5">
          <input type="hidden" name="policy_id" value={p.id} />
          <button type="submit" className="btn btn-primary">Ask my agency to renew this</button>
        </form>
      </div>

      {p.vehicle_no && (
        <div className="panel">
          <div className="panel-head">Your vehicle</div>
          <Row label="Registration" value={p.vehicle_no} />
          <Row label="Make and model" value={p.make_model} />
          <Row label="Sum insured" value={money(p.sum_insured)} />
          <Row label="Excess you pay on a claim" value={p.excess ? money(p.excess) : 'None'} />
          <Row label="No-claim discount" value={p.ncd_pct ? `${p.ncd_pct}%` : 'None yet'} />
        </div>
      )}

      <div className="panel">
        <div className="panel-head">What you paid</div>
        <Row label="Premium" value={money(p.gross_premium)} />
        <Row label="Service tax" value={money(p.service_tax)} />
        <Row label="Stamp duty" value={money(p.stamp_duty)} />
        <Row label="Total" value={<strong>{money(p.total_premium)}</strong>} />
        <Row label="Received" value={money(p.paid ?? 0)} />
        {outstanding > 0 && (
          <div className="border-t border-line px-5 py-3.5">
            <p className="text-[13px] font-semibold text-brand">{money(outstanding)} still outstanding</p>
            <p className="mt-1 text-[12.5px] text-muted">
              Due {longDate(p.due_date)}. Your agency will tell you where to send it.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
