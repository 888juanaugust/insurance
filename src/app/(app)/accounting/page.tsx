import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/session';
import { listCommissions, commissionTotals } from '@/lib/queries';
import { classLabel, longDate, money, policyHref } from '@/lib/format';
import { PageHeader, StatusBadge, Help } from '@/components/ui';
import { approveCommissionAction, bulkCommissionAction } from '@/lib/actions';
import FilterSelect from '@/components/FilterSelect';
import { commissionByAgent } from '@/lib/queries';

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

/** One form per control — see RenewalButton for why the op is a hidden input. */
function BulkButton({ op, label, primary }: { op: string; label: string; primary?: boolean }) {
  return (
    <form action={bulkCommissionAction}>
      <input type="hidden" name="op" value={op} />
      <button type="submit" className={`btn ${primary ? 'btn-primary' : 'btn-ghost'}`}>
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
  const tab = sp.tab === 'einvoice' ? 'einvoice' : 'monthly';
  const rows = listCommissions(user.org_id, status);
  const totals = commissionTotals(user.org_id);
  const byAgent = commissionByAgent(user.org_id);

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

      <div className="panel px-6 py-2">
        <div className="flex flex-wrap gap-x-5 border-b border-line">
          {[
            ['monthly', 'Monthly reports (audit)'],
            ['einvoice', 'e-Invoice · Agent commission'],
          ].map(([key, label]) => (
            <Link
              key={key}
              href={key === 'monthly' ? '/accounting' : '/accounting?tab=einvoice'}
              className={`-mb-px border-b-2 py-2.5 text-[13px] ${
                tab === key
                  ? 'border-accent font-semibold text-accent'
                  : 'border-transparent text-ink-soft hover:text-ink'
              }`}
            >
              {label}
            </Link>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2.5 py-3">
          <BulkButton op="regenerate" label="Generate / update reports" />
          <BulkButton op="force" label="Force regenerate…" />
          <BulkButton op="approve" label="Bulk approve (all pending)" primary />
          <BulkButton op="reject" label="Bulk reject (all pending)" />
        </div>
      </div>

      {tab === 'einvoice' && (
        <div className="panel">
          <div className="panel-head">
            Agent commission — e-Invoice
            <Help text="Self-billed e-Invoice is raised by the agency on the sub agent's behalf, so the agency needs their TIN on file." />
          </div>
          <div className="scroll-x">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Agent</th>
                  <th className="num">Total Amount</th>
                  <th className="num">Policies</th>
                  <th>Audit</th>
                  <th>Payout status</th>
                  <th className="num">Scheduled</th>
                  <th className="num">Paid</th>
                  <th>Last generated</th>
                  <th>E-invoice</th>
                </tr>
              </thead>
              <tbody>
                {byAgent.map((a) => (
                  <tr key={a.id}>
                    <td className="font-semibold text-ink">
                      {a.name}
                      <span className="block text-[12px] text-muted">{a.agent_code}</span>
                    </td>
                    <td className="num font-semibold">{money(a.total_amount)}</td>
                    <td className="num">{a.policies}</td>
                    <td className="text-ink-soft">
                      {a.einvoice_tin ? (
                        <span className="badge badge-green">TIN on file</span>
                      ) : (
                        <span className="badge badge-amber">TIN missing</span>
                      )}
                    </td>
                    <td>
                      <StatusBadge status={a.pending > 0 ? 'pending' : a.scheduled > 0 ? 'approved' : 'paid'} />
                    </td>
                    <td className="num">{money(a.scheduled)}</td>
                    <td className="num">{money(a.paid)}</td>
                    <td className="text-ink-soft">{a.last_generated ? longDate(a.last_generated) : '—'}</td>
                    <td>
                      <span className={`badge ${a.self_billed ? 'badge-blue' : 'badge-grey'}`}>
                        {a.self_billed ? 'Self-billed' : 'Not enabled'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
                      href={policyHref(r.class, r.policy_id)}
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
