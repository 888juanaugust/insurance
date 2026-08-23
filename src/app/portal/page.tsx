import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentPortalClient } from '@/lib/portal-session';
import { portalPolicies, portalClaims, portalDocuments } from '@/lib/queries';
import { portalRequestRenewalAction } from '@/lib/portal-actions';
import { money, longDate } from '@/lib/format';
import { TYPE_LABEL as CLAIM_TYPE, STATUS_LABEL as CLAIM_STATUS } from '@/lib/claims';
import { KIND_LABEL as DOC_KIND } from '@/lib/document-kinds';

export const dynamic = 'force-dynamic';

const DAY = 86_400_000;

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  return Math.round((Date.parse(iso) - Date.parse(new Date().toISOString().slice(0, 10))) / DAY);
}

export default async function PortalHome({
  searchParams,
}: {
  searchParams: Promise<{ requested?: string }>;
}) {
  const client = await currentPortalClient();
  if (!client) redirect('/portal/login');

  const { requested } = await searchParams;
  const policies = portalPolicies(client.id);
  const claims = portalClaims(client.id);
  const documents = portalDocuments(client.id);

  const owing = policies
    .filter((p) => p.payment_status && p.payment_status !== 'paid')
    .reduce((sum, p) => sum + (p.total_premium - (p.paid ?? 0)), 0);

  return (
    <div className="space-y-4">
      <div className="panel px-6 py-6">
        <p className="sec-label">Your account</p>
        <h1 className="mt-2 text-[22px] font-semibold tracking-tight text-ink">{client.name}</h1>
        <p className="mt-1.5 text-[13.5px] text-ink-soft">
          {policies.length} {policies.length === 1 ? 'policy' : 'policies'} ·{' '}
          {claims.length} {claims.length === 1 ? 'claim' : 'claims'} ·{' '}
          {documents.length} {documents.length === 1 ? 'document' : 'documents'}
          {owing > 0 && (
            <> · <span className="font-semibold text-brand">{money(owing)} outstanding</span></>
          )}
        </p>

        {requested && (
          <p role="status" className="mt-4 rounded border border-line bg-ok-wash px-4 py-3 text-[13px] text-ok">
            Your agency has been told you want <strong>{requested}</strong> renewed. They will be in
            touch with a quotation.
          </p>
        )}
      </div>

      <div className="panel">
        <div className="panel-head">Your policies</div>
        {policies.length ? (
          <ul className="divide-y divide-line">
            {policies.map((p) => {
              const days = daysUntil(p.expiry_date);
              const expiring = days !== null && days <= 60 && days >= 0;
              const expired = days !== null && days < 0;
              const outstanding = p.payment_status && p.payment_status !== 'paid'
                ? p.total_premium - (p.paid ?? 0)
                : 0;
              return (
                <li key={p.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link href={`/portal/policy/${p.id}`} className="text-[15px] font-semibold text-brand hover:underline">
                        {p.policy_no}
                      </Link>
                      <p className="mt-0.5 text-[13px] text-ink-soft">
                        {[p.product, p.vehicle_no, p.make_model].filter(Boolean).join(' · ')}
                      </p>
                      <p className="mt-0.5 text-[12.5px] text-muted">
                        {p.principal} · cover to {longDate(p.expiry_date)}
                        {p.ncd_pct > 0 && ` · ${p.ncd_pct}% no-claim discount`}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {expired ? (
                        <span className="badge badge-red">expired</span>
                      ) : expiring ? (
                        <span className="badge badge-amber">
                          {days === 0 ? 'expires today' : `${days} days left`}
                        </span>
                      ) : (
                        <span className="badge badge-green">in force</span>
                      )}
                      {outstanding > 0 && (
                        <span className="badge badge-red">{money(outstanding)} due</span>
                      )}
                    </div>
                  </div>

                  {(expiring || expired) && (
                    <form action={portalRequestRenewalAction} className="mt-3">
                      <input type="hidden" name="policy_id" value={p.id} />
                      <button type="submit" className="btn btn-primary h-8 text-[12.5px]">
                        Ask my agency to renew this
                      </button>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="px-5 py-6 text-[13px] text-muted">
            Nothing on file yet. If you believe that is wrong, speak to your agency.
          </p>
        )}
      </div>

      {claims.length > 0 && (
        <div className="panel">
          <div className="panel-head">Your claims</div>
          <ul className="divide-y divide-line">
            {claims.map((c) => (
              <li key={c.id} className="px-5 py-3.5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[13.5px] font-semibold text-ink">{c.claim_no}</p>
                    <p className="mt-0.5 text-[13px] text-ink-soft">
                      {CLAIM_TYPE[c.type] ?? c.type} · {longDate(c.incident_date)}
                      {c.vehicle_no && ` · ${c.vehicle_no}`}
                    </p>
                    {c.workshop && <p className="mt-0.5 text-[12.5px] text-muted">At {c.workshop}</p>}
                  </div>
                  <div className="text-right">
                    <span className="badge badge-blue">{CLAIM_STATUS[c.status] ?? c.status}</span>
                    {c.settled_amount > 0 && (
                      <p className="mt-1 text-[12.5px] text-muted">settled {money(c.settled_amount)}</p>
                    )}
                  </div>
                </div>
                {c.affects_ncd === 1 && (
                  <p className="mt-2 text-[12px] text-muted">
                    This claim resets your no-claim discount at renewal.
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="panel">
        <div className="panel-head">Your documents</div>
        {documents.length ? (
          <ul className="divide-y divide-line">
            {documents.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <a
                    href={`/api/portal/documents/${d.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="block truncate text-[13.5px] font-semibold text-brand hover:underline"
                  >
                    {d.filename}
                  </a>
                  <p className="mt-0.5 text-[12px] text-muted">
                    {DOC_KIND[d.kind ?? ''] ?? 'Document'} · {d.policy_no} · added {d.uploaded_at}
                  </p>
                </div>
                <a href={`/api/portal/documents/${d.id}?download`} className="text-[12.5px] text-link hover:underline">
                  Download
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-5 py-6 text-[13px] text-muted">
            No documents shared yet. Ask your agency to upload your schedule.
          </p>
        )}
      </div>
    </div>
  );
}
