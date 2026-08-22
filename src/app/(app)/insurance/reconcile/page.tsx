import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/session';
import { listOutstanding } from '@/lib/queries';
import { classLabel, longDate, money, policyHref } from '@/lib/format';
import { PageHeader, Help } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function ReconcilePage() {
  const user = await currentUser();
  if (!user) redirect('/login');

  const client = listOutstanding(user.org_id, 'client');
  const principal = listOutstanding(user.org_id, 'principal');
  const owedToUs = client.reduce((s, r) => s + r.outstanding, 0);
  const owedByUs = principal.reduce((s, r) => s + r.outstanding, 0);

  const Side = ({ title, rows, help }: { title: string; rows: typeof client; help: string }) => (
    <section className="panel">
      <div className="panel-head">{title}<Help text={help} /></div>
      <div className="scroll-x">
        <table className="tbl">
          <thead>
            <tr>
              <th>Policy no</th><th>Insured</th><th>Principal</th><th>Class</th>
              <th>Due</th><th className="num">Days</th><th className="num">Outstanding</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>
                  <Link href={policyHref(r.class, r.id)} className="link-red">
                    {r.policy_no}
                  </Link>
                </td>
                <td className="text-ink">{r.insured}</td>
                <td className="font-semibold text-brand">{r.principal}</td>
                <td className="text-ink-soft">{classLabel(r.class)}</td>
                <td className="text-ink-soft">{longDate(r.due_date)}</td>
                <td className="num">
                  <span className={`badge ${r.days > 90 ? 'badge-red' : r.days > 30 ? 'badge-amber' : 'badge-grey'}`}>
                    {r.days}
                  </span>
                </td>
                <td className="num font-semibold">{money(r.outstanding)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={7} className="py-10 text-center text-[13px] text-muted">Nothing outstanding.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );

  return (
    <div className="space-y-4">
      <div className="panel px-6 py-6">
        <PageHeader
          title="Reconcile"
          subtitle="Match what clients owe the agency against what the agency owes its principals."
          meta={`${money(owedToUs)} receivable · ${money(owedByUs)} payable · net ${money(owedToUs - owedByUs)}`}
        />
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            ['Receivable from clients', money(owedToUs), `${client.length} items`],
            ['Payable to principals', money(owedByUs), `${principal.length} items`],
            ['Net position', money(owedToUs - owedByUs), owedToUs >= owedByUs ? 'In the agency’s favour' : 'Shortfall to fund'],
          ].map(([label, value, note]) => (
            <div key={label} className="rounded border border-line px-5 py-4">
              <p className="sec-label">{label}</p>
              <p className="mt-2 text-[22px] font-semibold tracking-tight text-ink">{value}</p>
              <p className="mt-1 text-[12px] text-muted">{note}</p>
            </div>
          ))}
        </div>
      </div>
      <Side title="Receivable from clients" rows={client} help="Premium the agency has not yet collected from the insured." />
      <Side title="Payable to principals" rows={principal} help="Premium the agency has not yet remitted to the insurer." />
    </div>
  );
}
