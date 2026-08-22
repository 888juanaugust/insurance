import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/session';
import { listRenewalRequests, renewalCounts } from '@/lib/queries';
import { longDate, classLabel, policyHref } from '@/lib/format';
import { PageHeader, StatusBadge } from '@/components/ui';
import { renewalActionForm } from '@/lib/renewal-actions';

export const dynamic = 'force-dynamic';

const TABS = ['inbox', 'expiring', 'history'] as const;
const LABELS: Record<string, string> = { inbox: 'Inbox', expiring: 'Expiring', history: 'History' };

/**
 * Each action is its own form: a submit button's name/value is not carried into
 * a server action's FormData, so the operation travels as a hidden input.
 */
function RenewalButton({
  op, id, policyId, cls, label, primary,
}: {
  op: string;
  id?: string;
  policyId: string;
  cls: string;
  label: string;
  primary?: boolean;
}) {
  return (
    <form action={renewalActionForm}>
      <input type="hidden" name="op" value={op} />
      {id && <input type="hidden" name="id" value={id} />}
      <input type="hidden" name="policy_id" value={policyId} />
      <input type="hidden" name="cls" value={cls} />
      <button type="submit" className={`btn ${primary ? 'btn-primary' : 'btn-ghost'} px-2.5 py-1 text-[12px]`}>
        {label}
      </button>
    </form>
  );
}

export default async function RenewalsPage({
  searchParams,
}: {
  searchParams: Promise<{ [k: string]: string | string[] | undefined }>;
}) {
  const user = await currentUser();
  if (!user) redirect('/login');

  const sp = await searchParams;
  const tab = (TABS as readonly string[]).includes(String(sp.tab)) ? (sp.tab as (typeof TABS)[number]) : 'inbox';
  const rows = listRenewalRequests(user.org_id, tab);
  const counts = renewalCounts(user.org_id);

  return (
    <div className="panel px-6 py-6">
      <PageHeader
        title="Renewals"
        subtitle="Renewal requests raised from Home, the client portal and the expiry scheduler."
        meta={`${counts.inbox} in the inbox · ${counts.expiring} expiring within 60 days`}
      />

      <div className="mb-4 flex flex-wrap gap-x-5 border-b border-line">
        {TABS.map((t) => (
          <Link
            key={t}
            href={`/insurance/renewals?tab=${t}`}
            className={`-mb-px border-b-2 py-2.5 text-[13px] ${
              tab === t ? 'border-accent font-semibold text-accent' : 'border-transparent text-ink-soft hover:text-ink'
            }`}
          >
            {LABELS[t]} ({counts[t]})
          </Link>
        ))}
      </div>

      <div className="scroll-x rounded border border-line">
        <table className="tbl">
          <thead>
            <tr>
              <th>Policy No</th>
              <th>Client</th>
              <th>Principal</th>
              <th>Requested</th>
              <th>Source</th>
              <th>Note</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>
                  <Link href={policyHref(r.class, r.policy_id)} className="link-red">
                    {r.policy_no}
                  </Link>
                </td>
                <td className="text-ink">{r.client_name}</td>
                <td className="font-semibold text-brand">{r.principal}</td>
                <td className="text-ink-soft">{r.requested_at ? longDate(r.requested_at) : '—'}</td>
                <td className="text-ink-soft">{r.source}</td>
                <td className="wrap text-ink-soft">{r.note ?? '—'}</td>
                <td>
                  {tab === 'history' ? (
                    <StatusBadge status={r.status} />
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {tab === 'expiring' ? (
                        <>
                          <RenewalButton op="request" policyId={r.policy_id} cls={r.class} label="Request renewal" />
                          <Link href={policyHref(r.class, r.policy_id)} className="btn btn-ghost px-2.5 py-1 text-[12px]">
                            View policy
                          </Link>
                        </>
                      ) : (
                        <>
                          <RenewalButton op="quote" id={r.id} policyId={r.policy_id} cls={r.class} label="Create quotation" primary />
                          <RenewalButton op="process" id={r.id} policyId={r.policy_id} cls={r.class} label="Process renewal" />
                          <RenewalButton op="reject" id={r.id} policyId={r.policy_id} cls={r.class} label="Reject" />
                        </>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="py-12 text-center text-[13px] text-muted">
                  Nothing in {LABELS[tab].toLowerCase()}.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
