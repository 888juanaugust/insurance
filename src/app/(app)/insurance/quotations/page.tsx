import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/session';
import { listPolicies } from '@/lib/queries';
import { money, longDate, classLabel } from '@/lib/format';
import { PageHeader, StatusBadge } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function QuotationsPage() {
  const user = await currentUser();
  if (!user) redirect('/login');

  const rows = listPolicies(user.org_id, { status: 'quotation' });
  const value = rows.reduce((s, r) => s + r.total_premium, 0);

  return (
    <div className="panel px-6 py-6">
      <PageHeader
        title="Quotations"
        subtitle="Quotations issued but not yet converted into cover."
        meta={`${rows.length} open · ${money(value)} of premium quoted`}
        actions={
          <>
            <Link href="/insurance/motor/upload" className="btn btn-ghost">Upload PDF</Link>
            <Link href="/insurance/motor/new" className="btn btn-primary">Create Policy</Link>
          </>
        }
      />
      <div className="scroll-x rounded border border-line">
        <table className="tbl">
          <thead>
            <tr>
              <th>Quotation no</th><th>Insured</th><th>Principal</th><th>Class</th>
              <th>Product</th><th>Vehicle</th><th>Quoted for</th>
              <th className="num">Total payable</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id}>
                <td>
                  <Link href={`/insurance/${p.class === 'motor' ? 'motor' : 'non-motor'}/${p.id}`} className="link-red">
                    {p.policy_no}
                  </Link>
                </td>
                <td className="text-ink">{p.client_name}</td>
                <td className="font-semibold text-brand">{p.principal}</td>
                <td className="text-ink-soft">{classLabel(p.class)}</td>
                <td className="text-ink-soft">{p.product}</td>
                <td className="text-ink-soft">{p.vehicle_no ?? '—'}</td>
                <td className="text-ink-soft">{longDate(p.effective_date)}</td>
                <td className="num font-semibold">{money(p.total_premium)}</td>
                <td><StatusBadge status={p.status} /></td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={9} className="py-12 text-center text-[13px] text-muted">No open quotations.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
