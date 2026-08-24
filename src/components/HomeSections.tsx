import Link from 'next/link';
import { money, longDate, MONTHS, policyHref } from '@/lib/format';
import { Help, SectionLabel } from './ui';
import { IconClipboard, IconCar, IconReports } from './icons';

/* ------------------------------------------------------------- production */

export function Production({ rows }: { rows: Array<Record<string, any>> }) {
  const label = (period: string) => {
    const [y, m] = period.split('-');
    return `${MONTHS[Number(m) - 1]} ${y}`;
  };
  const totals = rows.reduce(
    (a, r) => ({
      motorCases: a.motorCases + r.motorCases,
      nonMotorCases: a.nonMotorCases + r.nonMotorCases,
      motorPremium: a.motorPremium + r.motorPremium,
      nonMotorPremium: a.nonMotorPremium + r.nonMotorPremium,
      totalPremium: a.totalPremium + r.totalPremium,
      grossPremium: a.grossPremium + r.grossPremium,
      totalCommission: a.totalCommission + r.totalCommission,
      agentCommission: a.agentCommission + r.agentCommission,
      consultantCommission: a.consultantCommission + r.consultantCommission,
    }),
    {
      motorCases: 0, nonMotorCases: 0, motorPremium: 0, nonMotorPremium: 0,
      totalPremium: 0, grossPremium: 0, totalCommission: 0, agentCommission: 0, consultantCommission: 0,
    },
  );

  return (
    <section className="panel">
      <div className="panel-head">
        <IconReports className="h-[17px] w-[17px] text-[#4a6fa5]" />
        Production
        <Help text="Cases written and the commission split, by month of creation." />
      </div>
      <div className="scroll-x">
        <table className="tbl">
          <thead>
            <tr>
              <th>Created</th>
              <th>Sub-category</th>
              <th className="num">Non-Motor Cases</th>
              <th className="num">Motor Cases</th>
              <th className="num">Non-Motor Premium (MYR)</th>
              <th className="num">Motor Premium (MYR)</th>
              <th className="num">Gross Premium (MYR)</th>
              <th className="num">Total Premium (MYR)</th>
              <th className="num">Total Commission (MYR)</th>
              <th className="num">Agent/Broker Commission (MYR)</th>
              <th className="num">Sales Consultant Commission (MYR)</th>
              <th className="num">Policies</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.period}>
                <td className="font-semibold text-ink">{label(r.period)}</td>
                <td className="text-ink-soft">All classes</td>
                <td className="num">{r.nonMotorCases}</td>
                <td className="num">{r.motorCases}</td>
                <td className="num">{money(r.nonMotorPremium, '')}</td>
                <td className="num">{money(r.motorPremium, '')}</td>
                <td className="num">{money(r.grossPremium, '')}</td>
                <td className="num font-semibold">{money(r.totalPremium, '')}</td>
                <td className="num">{money(r.totalCommission, '')}</td>
                <td className="num">{money(r.agentCommission, '')}</td>
                <td className="num">{money(r.consultantCommission, '')}</td>
                <td className="num">{r.motorCases + r.nonMotorCases}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={12} className="py-10 text-center text-[13px] text-muted">
                  No business written this year.
                </td>
              </tr>
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="bg-[#fafbfc] font-semibold">
                <td colSpan={2} className="px-3 py-2.5 text-ink">Total</td>
                <td className="num px-3 py-2.5">{totals.nonMotorCases}</td>
                <td className="num px-3 py-2.5">{totals.motorCases}</td>
                <td className="num px-3 py-2.5">{money(totals.nonMotorPremium, '')}</td>
                <td className="num px-3 py-2.5">{money(totals.motorPremium, '')}</td>
                <td className="num px-3 py-2.5">{money(totals.grossPremium, '')}</td>
                <td className="num px-3 py-2.5">{money(totals.totalPremium, '')}</td>
                <td className="num px-3 py-2.5">{money(totals.totalCommission, '')}</td>
                <td className="num px-3 py-2.5">{money(totals.agentCommission, '')}</td>
                <td className="num px-3 py-2.5">{money(totals.consultantCommission, '')}</td>
                <td className="num px-3 py-2.5">{totals.motorCases + totals.nonMotorCases}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------- renewal watch */

export function MotorCompliance({ rows }: { rows: Array<Record<string, any>> }) {
  return (
    <section className="panel">
      <div className="panel-head">
        <IconCar className="h-[17px] w-[17px] text-[#3d7d4f]" />
        Motor compliance
        <Help text="Road tax and inspection fall due with the policy period, so an expiring policy usually means both are due too." />
      </div>
      <div className="scroll-x max-h-[340px] overflow-y-auto">
        <table className="tbl">
          <thead className="sticky top-0 z-10">
            <tr>
              <th>Vehicle No</th>
              <th>E-Hailing</th>
              <th>JPJ / Road Tax</th>
              <th>PUSPAKOM</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const due = r.days_left <= 30;
              return (
                <tr key={r.id}>
                  <td className="font-semibold text-ink">
                    {r.vehicle_no}
                    <span className="block text-[12px] font-normal text-muted">{r.insured}</span>
                  </td>
                  <td>
                    <span className="badge badge-grey">Not registered</span>
                  </td>
                  <td>
                    <span className={`badge ${due ? 'badge-amber' : 'badge-green'}`}>
                      {due ? `Due ${longDate(r.expiry_date)}` : `Valid to ${longDate(r.expiry_date)}`}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${due ? 'badge-amber' : 'badge-grey'}`}>
                      {due ? 'Inspection due' : 'Not due'}
                    </span>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="py-10 text-center text-[13px] text-muted">
                  No motor policies on cover.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- calendar */

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

/** Month grid marking the days that carry a renewal or an expiry. */
export function Calendar({ today: iso, marks }: { today: string; marks: Map<string, number> }) {
  const [y, m] = iso.split('-').map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const lead = first.getUTCDay();
  const cells: (number | null)[] = [
    ...Array<number | null>(lead).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const todayDay = Number(iso.slice(8, 10));

  return (
    <section className="panel">
      <div className="panel-head">
        {MONTHS[m - 1]} {y}
        <Help text="Days carrying a policy expiry this month." />
      </div>
      <div className="px-4 pb-4 pt-3">
        <div className="grid grid-cols-7 gap-1 text-center">
          {DAYS.map((d) => (
            <div key={d} className="sec-label py-1">{d}</div>
          ))}
          {cells.map((d, i) => {
            if (d === null) return <div key={i} />;
            const key = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const n = marks.get(key) ?? 0;
            const isToday = d === todayDay;
            return (
              <div
                key={i}
                title={n ? `${n} polic${n === 1 ? 'y' : 'ies'} expiring` : undefined}
                className={`rounded py-1.5 text-[12.5px] ${
                  isToday
                    ? 'bg-accent font-semibold text-white'
                    : n > 0
                      ? 'bg-[#fdeceb] font-semibold text-[#b32b21]'
                      : 'text-ink-soft'
                }`}
              >
                {d}
                {n > 0 && !isToday && <span className="ml-0.5 text-[10px]">·{n}</span>}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
