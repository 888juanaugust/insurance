import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/session';
import { listQuotations, quotationCounts } from '@/lib/queries';
import { money, longDate, classLabel, policyHref } from '@/lib/format';
import { PageHeader, StatusBadge } from '@/components/ui';

export const dynamic = 'force-dynamic';

const TABS: { key: string; label: string }[] = [
  { key: 'draft', label: 'Drafts' },
  { key: 'sent', label: 'Sent' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'converted', label: 'Converted' },
  { key: '', label: 'All' },
];

export default async function QuotationsPage({
  searchParams,
}: {
  searchParams: Promise<{ [k: string]: string | string[] | undefined }>;
}) {
  const user = await currentUser();
  if (!user) redirect('/login');

  const sp = await searchParams;
  const tab = typeof sp.tab === 'string' && TABS.some((t) => t.key === sp.tab) ? sp.tab : '';
  const rows = listQuotations(user.org_id, tab);
  const counts = quotationCounts(user.org_id);
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  const value = rows.reduce((s, r) => s + Number(r.total_payable), 0);

  return (
    <div className="panel px-6 py-6">
      <PageHeader
        title="Quotations"
        subtitle="Quote pipeline, from draft through to conversion into a policy."
        meta={`${rows.length} shown · ${money(value)} of premium quoted`}
        actions={
          <>
            <Link href="/insurance/general-motor/new?from=quote" className="btn btn-ghost">
              New motor quote
            </Link>
            <Link href="/insurance/non-motor/new?from=quote" className="btn btn-primary">
              New non-motor quote
            </Link>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap gap-x-5 border-b border-line">
        {TABS.map((t) => {
          const n = t.key === '' ? total : (counts.get(t.key) ?? 0);
          return (
            <Link
              key={t.label}
              href={t.key ? `/insurance/quotations?tab=${t.key}` : '/insurance/quotations'}
              className={`-mb-px border-b-2 py-2.5 text-[13px] ${
                tab === t.key
                  ? 'border-accent font-semibold text-accent'
                  : 'border-transparent text-ink-soft hover:text-ink'
              }`}
            >
              {t.label} ({n})
            </Link>
          );
        })}
      </div>

      <div className="scroll-x rounded border border-line">
        <table className="tbl">
          <thead>
            <tr>
              <th>Quote no.</th>
              <th>Status</th>
              <th>Type</th>
              <th>Client</th>
              <th>Principal</th>
              <th className="num">Total payable</th>
              <th>Valid until</th>
              <th>Updated</th>
              <th>Note</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((q) => (
              <tr key={q.id}>
                <td>
                  {q.policy_id ? (
                    <Link href={policyHref(q.class, q.policy_id)} className="link-red">
                      {q.quote_no}
                    </Link>
                  ) : (
                    <span className="font-semibold text-ink">{q.quote_no}</span>
                  )}
                </td>
                <td><StatusBadge status={q.status} /></td>
                <td className="text-ink-soft">{classLabel(q.class)}</td>
                <td>
                  <Link href={`/clients/${q.client_id}`} className="link-red">
                    {q.client_name}
                  </Link>
                </td>
                <td className="font-semibold text-brand">{q.principal}</td>
                <td className="num font-semibold">{money(q.total_payable)}</td>
                <td className="text-ink-soft">{longDate(q.valid_until)}</td>
                <td className="text-ink-soft">{longDate(q.updated_at)}</td>
                <td className="wrap text-ink-soft">{q.note ?? '—'}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="py-12 text-center text-[13px] text-muted">
                  No quotations in this stage.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
