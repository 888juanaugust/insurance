import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/session';
import { reportCompanyBreakdown } from '@/lib/queries';
import { money, num, today } from '@/lib/format';
import { Crumb, PageHeader } from '@/components/ui';
import FilterSelect from '@/components/FilterSelect';

export const dynamic = 'force-dynamic';

export default async function CompanyCommissionReport({
  searchParams,
}: {
  searchParams: Promise<{ [k: string]: string | string[] | undefined }>;
}) {
  const user = await currentUser();
  if (!user) redirect('/login');

  const sp = await searchParams;
  const thisYear = Number(today().slice(0, 4));
  const year = typeof sp.year === 'string' ? sp.year : String(thisYear);
  const rows = reportCompanyBreakdown(user.org_id, year);

  const totalPremium = rows.reduce((s, r) => s + r.total_premium, 0);
  const totalCommission = rows.reduce((s, r) => s + r.commission, 0);
  const totalCases = rows.reduce((s, r) => s + r.cases, 0);

  return (
    <div className="panel px-6 py-6">
      <Crumb items={[{ href: '/reports', label: 'Reports' }, { label: 'Company Commission Breakdown' }]} />
      <PageHeader
        title="Company Commission Breakdown"
        subtitle="Premium and commission by principal, showing where the book is concentrated."
        meta={`${totalCases} cases across ${rows.length} principals · ${money(totalPremium)} premium`}
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
              <th>Principal</th>
              <th className="num">Motor cases</th>
              <th className="num">Non-motor cases</th>
              <th className="num">Total cases</th>
              <th className="num">Gross premium</th>
              <th className="num">Total premium</th>
              <th className="num">Commission</th>
              <th className="num">Share of book</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.short_name}>
                <td>
                  <span className="font-semibold text-brand">{r.short_name}</span>
                  <span className="block text-[12px] text-muted">{r.name}</span>
                </td>
                <td className="num">{r.motor_cases}</td>
                <td className="num">{r.non_motor_cases}</td>
                <td className="num">{r.cases}</td>
                <td className="num">{money(r.gross_premium)}</td>
                <td className="num font-semibold">{money(r.total_premium)}</td>
                <td className="num">{money(r.commission)}</td>
                <td className="num text-ink-soft">
                  {num(totalPremium ? (r.total_premium / totalPremium) * 100 : 0, 1)}%
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="py-12 text-center text-[13px] text-muted">
                  No business written in {year}.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="bg-canvas font-semibold">
              <td className="px-3 py-2.5 text-ink">Total</td>
              <td className="num px-3 py-2.5">{rows.reduce((s, r) => s + r.motor_cases, 0)}</td>
              <td className="num px-3 py-2.5">{rows.reduce((s, r) => s + r.non_motor_cases, 0)}</td>
              <td className="num px-3 py-2.5">{totalCases}</td>
              <td className="num px-3 py-2.5">{money(rows.reduce((s, r) => s + r.gross_premium, 0))}</td>
              <td className="num px-3 py-2.5">{money(totalPremium)}</td>
              <td className="num px-3 py-2.5">{money(totalCommission)}</td>
              <td className="num px-3 py-2.5">100.0%</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
