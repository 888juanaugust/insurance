import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/session';
import { listCommissions, commissionTotals } from '@/lib/queries';
import { money, longDate, classLabel } from '@/lib/format';
import { PageHeader, StatusBadge, Help } from '@/components/ui';
import { approveCommissionAction } from '@/lib/actions';
import FilterSelect from '@/components/FilterSelect';

export const dynamic = 'force-dynamic';

function StatusButton({
  id,
  status,
  label,
  ghost,
}: {
  id: string;
  status: string;
  label: string;
  ghost?: boolean;
}) {
  return (
    <form action={approveCommissionAction}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={status} />
      <button type="submit" className={`btn ${ghost ? 'btn-ghost' : 'btn-primary'} py-1 px-2.5 text-[12px]`}>
        {label}
      </button>
    </form>
  );
}

export default async function AccountingPage({
  searchParams,
}: {
  searchParams: Promise<{ [k: string]: string | string[] | undefined }>;
}) {
  const user = await currentUser();
  if (!user) redirect('/login');

  const sp = await searchParams;
  const status = typeof sp.status === 'string' ? sp.status : '';
  const rows = listCommissions(user.org_id, status);
  const totals = commissionTotals(user.org_id);

  return (
    <div className="space-y-4">
      <div className="panel px-6 py-6">
        <PageHeader
          title="Accounting"
          subtitle="Approve sub agent commission payouts and maintain the billing details used for e-Invoice."
          meta={`${money(totals.pending)} pending approval · ${money(totals.approved)} approved and awaiting payout · ${money(totals.paid)} paid`}
          actions={
            <FilterSelect
              name="status"
              label="Commission status"
              value={status}
              className="w-[190px]"
              options={[
                { value: '', label: 'All commission records' },
                { value: 'pending', label: 'Pending approval' },
                { value: 'approved', label: 'Approved' },
                { value: 'paid', label: 'Paid' },
              ]}
            />
          }
        />

        <div className="grid gap-4 sm:grid-cols-3">
          {[
            ['Pending approval', money(totals.pending), '#e0a33a'],
            ['Approved — awaiting payout', money(totals.approved), '#2b7fd4'],
            ['Paid out', money(totals.paid), '#3d8f5b'],
          ].map(([label, value, dot]) => (
            <div key={label} className="rounded border border-line px-5 py-4">
              <div className="flex items-center gap-2">
                <span className="h-[8px] w-[8px] shrink-0 rounded-full" style={{ background: dot }} />
                <span className="sec-label">{label}</span>
              </div>
              <p className="mt-2 text-[22px] font-semibold tracking-tight text-ink">{value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          Commission payout
          <Help text="Approve a commission record to release it for payout. Marking it paid records the payout date and feeds the commission-received indicator." />
        </div>
        <div className="scroll-x">
          <table className="tbl">
            <thead>
              <tr>
                <th>Policy no</th>
                <th>Insured</th>
                <th>Principal</th>
                <th>Class</th>
                <th>Sub agent</th>
                <th className="num">Gross premium</th>
                <th className="num">Commission</th>
                <th className="num">Override</th>
                <th className="num">Net payable</th>
                <th>Status</th>
                <th>Approved</th>
                <th>Paid</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <Link
                      href={`/insurance/${r.class === 'motor' ? 'motor' : 'non-motor'}/${r.policy_id}`}
                      className="link-red"
                    >
                      {r.policy_no}
                    </Link>
                  </td>
                  <td className="text-ink">{r.insured}</td>
                  <td className="font-semibold text-brand">{r.principal}</td>
                  <td className="text-ink-soft">{classLabel(r.class)}</td>
                  <td className="text-ink-soft">
                    {r.agent_name ?? '—'}
                    {r.self_billed ? (
                      <span className="ml-1.5 badge badge-blue">self-billed</span>
                    ) : null}
                  </td>
                  <td className="num">{money(r.gross_premium)}</td>
                  <td className="num">{money(r.gross_amount)}</td>
                  <td className="num">{money(r.override_amt)}</td>
                  <td className="num font-semibold">{money(r.net_amount)}</td>
                  <td><StatusBadge status={r.status} /></td>
                  <td className="text-ink-soft">{r.approved_date ? longDate(r.approved_date) : '—'}</td>
                  <td className="text-ink-soft">{r.payout_date ? longDate(r.payout_date) : '—'}</td>
                  <td>
                    <div className="flex gap-1.5">
                      {r.status === 'pending' && (
                        <StatusButton id={r.id} status="approved" label="Approve" />
                      )}
                      {r.status === 'approved' && (
                        <>
                          <StatusButton id={r.id} status="paid" label="Mark paid" />
                          <StatusButton id={r.id} status="pending" label="Revert" ghost />
                        </>
                      )}
                      {r.status === 'paid' && <span className="text-[12px] text-muted">Settled</span>}
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={13} className="py-12 text-center text-[13px] text-muted">
                    No commission records for this filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
