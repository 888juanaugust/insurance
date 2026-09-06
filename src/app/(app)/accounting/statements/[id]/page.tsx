import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/guard';
import { statementView } from '@/lib/statement-run';
import { policyPickerFor } from '@/lib/queries';
import { settleStatementAction, deleteStatementAction } from '@/lib/statement-actions';
import { longDate, money } from '@/lib/format';
import { PageHeader, Crumb, Help } from '@/components/ui';
import StatementLine from '@/components/StatementLine';
import ConfirmSubmit from '@/components/Confirm';

export const dynamic = 'force-dynamic';

function Tile({ label, value, tone = 'plain', note }: {
  label: string; value: string; tone?: 'plain' | 'good' | 'bad' | 'warn'; note?: string;
}) {
  const tones = {
    plain: 'border-line',
    good: 'border-ok-line bg-ok-wash',
    bad: 'border-danger-line bg-danger-wash',
    warn: 'border-warn-line bg-warn-wash',
  };
  const text = { plain: 'text-ink', good: 'text-ok', bad: 'text-danger', warn: 'text-warn' };
  return (
    <div className={`rounded border px-5 py-4 ${tones[tone]}`}>
      <span className="sec-label">{label}</span>
      <p className={`mt-2 text-[21px] font-semibold tracking-tight tabular-nums ${text[tone]}`}>{value}</p>
      {note && <p className="mt-1 text-[12px] text-muted">{note}</p>}
    </div>
  );
}

export default async function StatementPage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ blocked?: string }>;
}) {
  const user = await requireAdmin({ action: 'statement.view', entity: 'statement' });
  const { id } = await params;
  const { blocked } = await searchParams;

  const view = statementView(id, user.org_id);
  if (!view) notFound();

  const { statement, totals } = view;
  const policies = policyPickerFor(user.org_id, statement.principal_id);
  const lineByNo = new Map(view.lines.map((l) => [l.row_no, l]));

  return (
    <div className="space-y-4">
      <div className="panel px-6 py-6">
        <Crumb
          items={[
            { href: '/accounting', label: 'Accounts' },
            { href: '/accounting/statements', label: 'Statements' },
            { label: statement.reference },
          ]}
        />
        <PageHeader
          title={statement.reference}
          subtitle={`${statement.principal_name} · business written ${longDate(statement.period_start)} to ${longDate(statement.period_end)}`}
          meta={
            `${statement.line_count} lines · imported ${longDate(statement.imported_at.slice(0, 10))}` +
            (statement.imported_by ? ` by ${statement.imported_by}` : '') +
            (statement.note ? ` · ${statement.note}` : '')
          }
          actions={
            <div className="flex flex-wrap gap-2.5">
              <form action={settleStatementAction}>
                <input type="hidden" name="id" value={statement.id} />
                <input type="hidden" name="to" value={statement.status === 'settled' ? 'open' : 'settled'} />
                {statement.status === 'settled' ? (
                  <button type="submit" className="btn btn-ghost">Reopen</button>
                ) : view.clean ? (
                  <ConfirmSubmit
                    label="Close it off"
                    className="btn btn-primary"
                    yes="Close it"
                    question={<>Close <strong>{statement.reference}</strong> off? Everything on it is accounted for. It can be reopened later.</>}
                  />
                ) : (
                  <>
                    {/* Closing a short statement is allowed — an agency may
                        decide a shortfall is not worth chasing — but it is
                        said out loud, and the action records that it was. */}
                    <input type="hidden" name="acknowledge" value="1" />
                    <ConfirmSubmit
                      label="Close it off anyway"
                      className="btn btn-ghost"
                      danger
                      yes="Close it short"
                      question={
                        <>
                          <strong>{money(totals.outstanding)}</strong> is still unaccounted for on{' '}
                          {statement.reference}: {view.short.length} short-paid case{view.short.length === 1 ? '' : 's'},{' '}
                          {view.unmatched.length} line{view.unmatched.length === 1 ? '' : 's'} not yet placed,{' '}
                          {view.missing.length} case{view.missing.length === 1 ? '' : 's'} left off. Close it anyway?
                          The audit trail will record that it was closed short.
                        </>
                      }
                    />
                  </>
                )}
              </form>
              <form action={deleteStatementAction}>
                <input type="hidden" name="id" value={statement.id} />
                <ConfirmSubmit
                  label="Delete"
                  className="btn btn-ghost"
                  danger
                  yes="Delete it"
                  question={
                    <>
                      Delete <strong>{statement.reference}</strong> — {statement.line_count} line{statement.line_count === 1 ? '' : 's'} worth{' '}
                      {money(statement.total_paid)}, and every assignment and set-aside anyone made against it? This cannot be undone.
                    </>
                  }
                />
              </form>
            </div>
          }
        />

        {blocked === '1' && (
          <p role="alert" className="mt-4 rounded-xl border border-danger-line bg-danger-wash px-4 py-3 text-[13px] text-danger">
            Not closed. {money(totals.outstanding)} is still unaccounted for on this statement — use{' '}
            <strong>Close it off anyway</strong> if that is a decision, not an oversight.
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Tile label="The insurer paid" value={money(totals.paid)} note={`${statement.line_count} lines`} />
          <Tile label="The register expected" value={money(totals.expected)} note={`${view.outcomes.length} cases matched`} />
          <Tile
            label="Short paid"
            value={money(Math.abs(totals.shortfall))}
            tone={view.short.length ? 'bad' : 'good'}
            note={`${view.short.length} case${view.short.length === 1 ? '' : 's'}`}
          />
          <Tile
            label="Left off the statement"
            value={money(totals.missingValue)}
            tone={view.missing.length ? 'warn' : 'good'}
            note={`${view.missing.length} case${view.missing.length === 1 ? '' : 's'}`}
          />
        </div>

        <p className="mt-4 text-[13px] text-ink-soft">
          {view.clean ? (
            <>
              Everything on this statement is accounted for. Nothing is outstanding against{' '}
              {statement.principal}.
            </>
          ) : (
            <>
              <strong className="text-danger">{money(totals.outstanding)}</strong> is unaccounted for —
              short payments and business this statement did not pay at all. Overpayments are not netted
              off: an insurer that overpaid one case takes it back on its own statement, and setting the
              two against each other hides what has to be chased.
            </>
          )}
        </p>
      </div>

      {view.short.length > 0 && (
        <section className="panel">
          <div className="panel-head">
            Paid less than the register expected
            <Help text="Compared per case, not per line: a statement that pays a policy in two instalments is judged on the sum of both." />
            <span className="ml-auto text-[12px] font-normal text-muted">
              {money(Math.abs(totals.shortfall))} across {view.short.length}
            </span>
          </div>
          <div className="scroll-x">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Policy no</th><th>Insured</th>
                  <th className="num">Expected</th><th className="num">Paid</th>
                  <th className="num">Short by</th><th>Lines</th>
                </tr>
              </thead>
              <tbody>
                {view.short.map((o) => (
                  <tr key={o.policy_id}>
                    <td>
                      <Link
                        href={`/insurance/${lineByNo.get(o.lines[0])?.book_class === 'non_motor' ? 'non-motor' : 'general-motor'}/${o.policy_id}`}
                        className="link-red"
                      >
                        {o.policy_no}
                      </Link>
                    </td>
                    <td className="text-ink-soft">{o.insured}</td>
                    <td className="num text-ink-soft">{money(o.expected)}</td>
                    <td className="num">{money(o.paid)}</td>
                    <td className="num font-semibold text-danger">{money(o.variance)}</td>
                    <td className="text-muted tabular-nums">{o.lines.join(', ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {view.missing.length > 0 && (
        <section className="panel">
          <div className="panel-head">
            Written in this period, not on the statement
            <Help text="Business the register says this insurer booked over the period, that no line on the statement pays for. Either it is on a later statement, or it has been missed." />
            <span className="ml-auto text-[12px] font-normal text-muted">
              {money(totals.missingValue)} across {view.missing.length}
            </span>
          </div>
          <div className="scroll-x">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Policy no</th><th>Insured</th><th>Effective</th><th>Vehicle</th>
                  <th className="num">Gross premium</th><th className="num">Commission due</th>
                </tr>
              </thead>
              <tbody>
                {view.missing.map((p) => (
                  <tr key={p.id}>
                    <td className="text-ink">{p.policy_no}</td>
                    <td className="text-ink-soft">{p.insured}</td>
                    <td className="text-ink-soft">{longDate(p.effective_date)}</td>
                    <td className="text-ink-soft">{p.vehicle_no ?? '—'}</td>
                    <td className="num text-ink-soft">{money(p.gross_premium)}</td>
                    <td className="num font-semibold">{money(p.commission_amt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {view.unmatched.length > 0 && (
        <section className="panel">
          <div className="panel-head">
            Paid for something not found on the register
            <Help text="The insurer paid on a case Insurhelp cannot find. It may be a policy typed differently, or business that is not this agency's at all." />
            <span className="ml-auto text-[12px] font-normal text-muted">
              {money(totals.unmatchedValue)} across {view.unmatched.length}
            </span>
          </div>
          {view.unmatched.map((l) => (
            <StatementLine
              key={l.id}
              statementId={statement.id}
              policies={policies}
              line={{
                id: l.id, row_no: l.row_no, policy_no: l.policy_no, cover_note_no: l.cover_note_no,
                insured: l.insured, vehicle_no: l.vehicle_no, effective_date: l.effective_date,
                commission: l.commission, accepted: l.accepted, accepted_note: l.accepted_note,
              }}
            />
          ))}
        </section>
      )}

      {view.over.length > 0 && (
        <section className="panel">
          <div className="panel-head">
            Paid more than the register expected
            <Help text="Usually a commission rate on file that is out of date. Worth correcting: the next statement will not repeat the mistake, and the book has been understating what it earns." />
            <span className="ml-auto text-[12px] font-normal text-muted">
              {money(totals.overpaid)} across {view.over.length}
            </span>
          </div>
          <div className="scroll-x">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Policy no</th><th>Insured</th>
                  <th className="num">Expected</th><th className="num">Paid</th><th className="num">Over by</th>
                </tr>
              </thead>
              <tbody>
                {view.over.map((o) => (
                  <tr key={o.policy_id}>
                    <td className="text-ink">{o.policy_no}</td>
                    <td className="text-ink-soft">{o.insured}</td>
                    <td className="num text-ink-soft">{money(o.expected)}</td>
                    <td className="num">{money(o.paid)}</td>
                    <td className="num font-semibold text-info">{money(o.variance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {view.accepted.length > 0 && (
        <section className="panel">
          <div className="panel-head">
            Set aside
            <span className="ml-auto text-[12px] font-normal text-muted">{view.accepted.length}</span>
          </div>
          {view.accepted.map((l) => (
            <StatementLine
              key={l.id}
              statementId={statement.id}
              policies={policies}
              line={{
                id: l.id, row_no: l.row_no, policy_no: l.policy_no, cover_note_no: l.cover_note_no,
                insured: l.insured, vehicle_no: l.vehicle_no, effective_date: l.effective_date,
                commission: l.commission, accepted: l.accepted, accepted_note: l.accepted_note,
              }}
            />
          ))}
        </section>
      )}

      <section className="panel">
        <div className="panel-head">
          Every line, as the insurer sent it
          <span className="ml-auto text-[12px] font-normal text-muted">{view.lines.length}</span>
        </div>
        <div className="scroll-x">
          <table className="tbl">
            <thead>
              <tr>
                <th className="w-14">Line</th>
                <th>Policy no</th><th>Insured</th><th>Effective</th>
                <th className="num">Gross premium</th><th className="num">Rate</th>
                <th className="num">Commission</th><th>Matched</th>
              </tr>
            </thead>
            <tbody>
              {view.lines.map((l) => (
                <tr key={l.id}>
                  <td className="text-muted tabular-nums">{l.row_no}</td>
                  <td className="text-ink">
                    {l.policy_no || l.cover_note_no || l.vehicle_no || '—'}
                    {l.book_policy_no && l.book_policy_no !== l.policy_no && (
                      <span className="block text-[11px] text-muted">on file as {l.book_policy_no}</span>
                    )}
                  </td>
                  <td className="max-w-[220px] truncate text-ink-soft">{l.insured || '—'}</td>
                  <td className="text-ink-soft">{longDate(l.effective_date)}</td>
                  <td className="num text-ink-soft">{l.gross_premium === null ? '—' : money(l.gross_premium)}</td>
                  <td className="num text-ink-soft">{l.commission_rate === null ? '—' : `${l.commission_rate}%`}</td>
                  <td className="num font-semibold">{money(l.commission)}</td>
                  <td>
                    {l.policy_id ? (
                      <span className={`badge ${l.outcome?.state === 'agreed' ? 'badge-green' : l.outcome?.state === 'short' ? 'badge-red' : 'badge-blue'}`}>
                        {l.outcome?.state ?? 'matched'}
                      </span>
                    ) : l.accepted ? (
                      <span className="badge badge-grey">set aside</span>
                    ) : (
                      <span className="badge badge-amber">no match</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
