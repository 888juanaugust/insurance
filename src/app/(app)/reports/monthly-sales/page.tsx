import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/session';
import { reportMonthlySales } from '@/lib/queries';
import { money, today, MONTHS } from '@/lib/format';
import { Crumb, PageHeader } from '@/components/ui';
import FilterSelect from '@/components/FilterSelect';

export const dynamic = 'force-dynamic';

export default async function MonthlySalesReport({
  searchParams,
}: {
  searchParams: Promise<{ [k: string]: string | string[] | undefined }>;
}) {
  const user = await currentUser();
  if (!user) redirect('/login');

  const sp = await searchParams;
  const thisYear = Number(today().slice(0, 4));
  const year = typeof sp.year === 'string' ? sp.year : String(thisYear);
  const months = reportMonthlySales(user.org_id, year);

  const peak = Math.max(1, ...months.map((m) => m.premium));
  const total = months.reduce(
    (a, m) => ({
      cases: a.cases + m.cases,
      premium: a.premium + m.premium,
      commission: a.commission + m.commission,
      motorCases: a.motorCases + m.motorCases,
      nonMotorCases: a.nonMotorCases + m.nonMotorCases,
    }),
    { cases: 0, premium: 0, commission: 0, motorCases: 0, nonMotorCases: 0 },
  );

  return (
    <div className="panel px-6 py-6">
      <Crumb items={[{ href: '/reports', label: 'Reports' }, { label: 'Monthly Sales' }]} />
      <PageHeader
        title="Monthly Sales"
        subtitle="Cases and premium written each month, split by class of business."
        meta={`${total.cases} cases · ${money(total.premium)} premium · ${money(total.commission)} agency commission`}
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
              <th>Month</th>
              <th className="num">Motor cases</th>
              <th className="num">Motor premium</th>
              <th className="num">Non-motor cases</th>
              <th className="num">Non-motor premium</th>
              <th className="num">Total cases</th>
              <th className="num">Total premium</th>
              <th className="num">Commission</th>
              <th className="w-[220px]">Distribution</th>
            </tr>
          </thead>
          <tbody>
            {months.map((m, i) => (
              <tr key={m.mth}>
                <td className="font-semibold text-ink">{MONTHS[i]} {year}</td>
                <td className="num">{m.motorCases}</td>
                <td className="num">{money(m.motorPremium)}</td>
                <td className="num">{m.nonMotorCases}</td>
                <td className="num">{money(m.nonMotorPremium)}</td>
                <td className="num">{m.cases}</td>
                <td className="num font-semibold">{money(m.premium)}</td>
                <td className="num text-ink-soft">{money(m.commission)}</td>
                <td>
                  <div className="h-[8px] w-[190px] overflow-hidden rounded-full bg-line-soft">
                    <div
                      className="h-full rounded-full bg-accent"
                      style={{ width: `${Math.round((m.premium / peak) * 100)}%` }}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-canvas font-semibold">
              <td className="px-3 py-2.5 text-ink">Total</td>
              <td className="num px-3 py-2.5">{total.motorCases}</td>
              <td className="num px-3 py-2.5" />
              <td className="num px-3 py-2.5">{total.nonMotorCases}</td>
              <td className="num px-3 py-2.5" />
              <td className="num px-3 py-2.5">{total.cases}</td>
              <td className="num px-3 py-2.5">{money(total.premium)}</td>
              <td className="num px-3 py-2.5">{money(total.commission)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
