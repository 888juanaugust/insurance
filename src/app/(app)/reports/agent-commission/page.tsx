import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/session';
import { reportAgentCommission } from '@/lib/queries';
import { money, today } from '@/lib/format';
import { Crumb, PageHeader } from '@/components/ui';
import FilterSelect from '@/components/FilterSelect';

export const dynamic = 'force-dynamic';

export default async function AgentCommissionReport({
  searchParams,
}: {
  searchParams: Promise<{ [k: string]: string | string[] | undefined }>;
}) {
  const user = await currentUser();
  if (!user) redirect('/login');

  const sp = await searchParams;
  const thisYear = Number(today().slice(0, 4));
  const year = typeof sp.year === 'string' ? sp.year : String(thisYear);
  const rows = reportAgentCommission(user.org_id, year);

  const t = rows.reduce(
    (a, r) => ({
      cases: a.cases + r.cases,
      gross: a.gross + r.gross_premium,
      commission: a.commission + r.commission,
      override: a.override + r.override_amt,
      net: a.net + r.net_amount,
      pending: a.pending + r.pending,
      approved: a.approved + r.approved,
      paid: a.paid + r.paid,
    }),
    { cases: 0, gross: 0, commission: 0, override: 0, net: 0, pending: 0, approved: 0, paid: 0 },
  );

  return (
    <div className="panel px-6 py-6">
      <Crumb items={[{ href: '/reports', label: 'Reports' }, { label: 'Agent Commission' }]} />
      <PageHeader
        title="Agent Commission"
        subtitle="Commission earned by each sub agent on business created in the selected year."
        actions={
          <FilterSelect
            name="year"
            label="Performance year"
            value={year}
            className="w-[130px]"
            options={[thisYear, thisYear - 1, thisYear - 2].map((y) => ({ value: String(y), label: String(y) }))}
          />
        }
      />

      <div className="scroll-x rounded border border-line">
        <table className="tbl">
          <thead>
            <tr>
              <th>Sub agent</th>
              <th>Code</th>
              <th>Rank</th>
              <th className="num">Cases</th>
              <th className="num">Gross premium</th>
              <th className="num">Commission</th>
              <th className="num">Override</th>
              <th className="num">Net payable</th>
              <th className="num">Pending</th>
              <th className="num">Approved</th>
              <th className="num">Paid</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="font-semibold text-ink">{r.name}</td>
                <td className="text-ink-soft">{r.agent_code}</td>
                <td className="text-ink-soft">{r.rank}</td>
                <td className="num">{r.cases}</td>
                <td className="num">{money(r.gross_premium)}</td>
                <td className="num">{money(r.commission)}</td>
                <td className="num">{money(r.override_amt)}</td>
                <td className="num font-semibold">{money(r.net_amount)}</td>
                <td className="num text-ink-soft">{money(r.pending)}</td>
                <td className="num text-ink-soft">{money(r.approved)}</td>
                <td className="num text-ink-soft">{money(r.paid)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-canvas font-semibold">
              <td colSpan={3} className="px-3 py-2.5 text-ink">Total</td>
              <td className="num px-3 py-2.5">{t.cases}</td>
              <td className="num px-3 py-2.5">{money(t.gross)}</td>
              <td className="num px-3 py-2.5">{money(t.commission)}</td>
              <td className="num px-3 py-2.5">{money(t.override)}</td>
              <td className="num px-3 py-2.5">{money(t.net)}</td>
              <td className="num px-3 py-2.5">{money(t.pending)}</td>
              <td className="num px-3 py-2.5">{money(t.approved)}</td>
              <td className="num px-3 py-2.5">{money(t.paid)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
