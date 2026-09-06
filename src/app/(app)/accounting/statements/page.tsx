import Link from 'next/link';
import { requireAdmin } from '@/lib/guard';
import { statementSummaries } from '@/lib/statement-run';
import { statementExposure } from '@/lib/queries';
import { longDate, money } from '@/lib/format';
import { PageHeader, EmptyState, Help } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function StatementsPage() {
  const user = await requireAdmin({ action: 'statement.list', entity: 'statement' });

  const rows = statementSummaries(user.org_id);
  const exposure = statementExposure(user.org_id);

  return (
    <div className="space-y-4">
      <div className="panel px-6 py-6">
        <PageHeader
          title="Commission statements"
          subtitle="What each insurer said it paid, against what the register says it owed."
          meta={
            rows.length
              ? `${exposure.open} open · ${money(exposure.paid)} paid on them · ${money(exposure.expected)} booked`
              : 'No statement has been checked yet.'
          }
          actions={<Link href="/accounting/statements/new" className="btn btn-primary">Check a statement</Link>}
        />

        {rows.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded border border-line px-5 py-4">
              <span className="sec-label">Open statements</span>
              <p className="mt-2 text-[22px] font-semibold tracking-tight text-ink">{exposure.open}</p>
            </div>
            <div className={`rounded border px-5 py-4 ${exposure.gap < -0.01 ? 'border-danger-line bg-danger-wash' : 'border-line'}`}>
              <span className="sec-label">Paid against booked</span>
              <p className={`mt-2 text-[22px] font-semibold tracking-tight ${exposure.gap < -0.01 ? 'text-danger' : 'text-ink'}`}>
                {money(exposure.gap)}
              </p>
              <p className="mt-1 text-[12px] text-muted">
                {exposure.gap < -0.01
                  ? 'Less has come in than the register expected.'
                  : 'The open statements are level or ahead.'}
              </p>
            </div>
            <div className={`rounded border px-5 py-4 ${exposure.unresolved ? 'border-warn-line bg-warn-wash' : 'border-line'}`}>
              <span className="sec-label">Lines still to place</span>
              <p className={`mt-2 text-[22px] font-semibold tracking-tight ${exposure.unresolved ? 'text-warn' : 'text-ink'}`}>
                {exposure.unresolved}
              </p>
              <p className="mt-1 text-[12px] text-muted">Paid for something not found on the register.</p>
            </div>
          </div>
        )}
      </div>

      <div className="panel">
        <div className="panel-head">
          Statements
          <Help text="A statement is stored exactly as the insurer sent it. Matching a line to a policy, or accepting a difference, changes the reconciliation — never the register." />
        </div>
        {rows.length === 0 ? (
          <EmptyState
            label="No statement has been checked yet"
            hint="Save the insurer's commission statement as CSV and check it against the register."
          />
        ) : (
          <div className="scroll-x">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Insurer</th>
                  <th>Period</th>
                  <th className="num">Lines</th>
                  <th className="num">Paid</th>
                  <th className="num">Booked</th>
                  <th className="num">Difference</th>
                  <th>State</th>
                  <th>Imported</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <Link href={`/accounting/statements/${s.id}`} className="link-red">
                        {s.reference}
                      </Link>
                      {s.filename && <span className="block text-[11px] text-muted">{s.filename}</span>}
                    </td>
                    <td className="font-semibold text-brand">{s.principal}</td>
                    <td className="text-ink-soft">
                      {longDate(s.period_start)} — {longDate(s.period_end)}
                    </td>
                    <td className="num">{s.line_count}</td>
                    <td className="num">{money(s.total_paid)}</td>
                    <td className="num text-ink-soft">{money(s.total_expected)}</td>
                    <td className={`num ${s.gap < -0.01 ? 'font-semibold text-danger' : s.gap > 0.01 ? 'text-info' : 'text-muted'}`}>
                      {Math.abs(s.gap) <= 0.01 ? '—' : money(s.gap)}
                    </td>
                    <td>
                      <span className={`badge ${s.status === 'settled' ? 'badge-green' : 'badge-amber'}`}>
                        {s.status === 'settled' ? 'settled' : 'open'}
                      </span>
                    </td>
                    <td className="text-ink-soft">
                      {longDate(s.imported_at.slice(0, 10))}
                      {s.imported_by && <span className="block text-[11px] text-muted">by {s.imported_by}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
