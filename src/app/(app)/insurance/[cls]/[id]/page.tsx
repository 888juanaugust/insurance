import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { currentUser } from '@/lib/session';
import { getPolicy } from '@/lib/queries';
import { money, longDate, num, classLabel } from '@/lib/format';
import { Crumb, StatusBadge, Help } from '@/components/ui';
import { recordPaymentAction } from '@/lib/actions';

export const dynamic = 'force-dynamic';

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="sec-label">{label}</dt>
      <dd className="mt-1 text-[13.5px] text-ink">{value ?? '—'}</dd>
    </div>
  );
}

function Line({
  label,
  value,
  strong,
  note,
}: {
  label: string;
  value: string;
  strong?: boolean;
  note?: string;
}) {
  return (
    <div
      className={`flex items-baseline justify-between gap-4 border-b border-[#eff1f4] px-5 py-2.5 last:border-0 ${
        strong ? 'bg-[#fafbfc] font-semibold text-ink' : 'text-ink-soft'
      }`}
    >
      <span className="text-[13px]">
        {label}
        {note && <span className="ml-1.5 text-[12px] text-muted">{note}</span>}
      </span>
      <span className="text-[13.5px] tabular-nums">{value}</span>
    </div>
  );
}

export default async function PolicyDetailPage({
  params,
}: {
  params: Promise<{ cls: string; id: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect('/login');

  const { cls: slug, id } = await params;
  const data = getPolicy(id);
  if (!data || data.policy.org_id !== user.org_id) notFound();

  const { policy, motor, nonMotor, extensions, payments, commission, client, principalRow } = data;
  const clientPay = payments.find((p) => p.kind === 'client');
  const principalPay = payments.find((p) => p.kind === 'principal');

  return (
    <div className="space-y-4">
      <div className="panel px-6 py-6">
        <Crumb
          items={[
            { href: `/insurance/${slug}`, label: slug === 'motor' ? 'General Motor' : 'General Non-Motor' },
            { label: policy.policy_no },
          ]}
        />
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-[24px] font-semibold tracking-tight text-ink">{policy.policy_no}</h1>
            <p className="mt-1 text-[13.5px] text-ink-soft">
              {policy.product} · {policy.type_of_cover} · {classLabel(policy.class)}
            </p>
            <p className="mt-1.5 text-[12.5px] text-muted">
              Issued {longDate(policy.issue_date)} · cover note {policy.cover_note_no ?? '—'} ·{' '}
              {policy.case_type === 'renewal' ? 'Renewal' : 'New business'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={policy.status} />
            <span className="badge badge-blue">{principalRow.short_name}</span>
          </div>
        </div>

        <dl className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <Field
            label="The insured"
            value={
              <Link href={`/clients/${client.id}`} className="link-red">
                {client.name}
              </Link>
            }
          />
          <Field label="NRIC / business reg no" value={client.nric || client.business_reg} />
          <Field
            label="Address"
            value={
              <>
                {client.address1}
                {client.address2 && <><br />{client.address2}</>}
                <br />
                {client.postcode} {client.city}, {client.state}
              </>
            }
          />
          <Field label="Occupation" value={client.occupation} />
          <Field
            label="Period of insurance"
            value={`${longDate(policy.effective_date)} to ${longDate(policy.expiry_date)}`}
          />
          <Field label="Sum insured" value={money(policy.sum_insured)} />
          <Field label="Excess" value={money(policy.excess)} />
          <Field label="Servicing agent" value={policy.agent_name} />
        </dl>

        {policy.remarks && (
          <p className="mt-5 rounded border border-line bg-[#f8f9fb] px-4 py-2.5 text-[12.5px] text-ink-soft">
            {policy.remarks}
          </p>
        )}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        {motor ? (
          <div className="panel">
            <div className="panel-head">Particulars of vehicle</div>
            <dl className="grid gap-5 px-6 py-5 sm:grid-cols-2">
              <Field label="Registration no" value={motor.vehicle_no} />
              <Field label="Make &amp; type of body" value={`${motor.make_model}${motor.body_type ? ` / ${motor.body_type}` : ''}`} />
              <Field label="Engine / motor no" value={motor.engine_no} />
              <Field label="Chassis no" value={motor.chassis_no} />
              <Field label="Engine capacity" value={`${motor.engine_cc} CC`} />
              <Field label="Year of manufacture" value={motor.year_make} />
              <Field label="Seating capacity incl. driver" value={String(motor.seating)} />
              <Field label="Hire purchase owner" value={motor.hire_purchase} />
              <Field label="Authorised drivers" value={motor.named_drivers} />
              <Field label="Windscreen sum insured" value={motor.windscreen_si ? money(motor.windscreen_si) : '—'} />
              <Field label="RTD code" value={motor.rtd_code} />
              <Field label="Endorsements" value={motor.extensions} />
            </dl>
          </div>
        ) : nonMotor ? (
          <div className="panel">
            <div className="panel-head">Particulars of risk</div>
            <dl className="grid gap-5 px-6 py-5 sm:grid-cols-2">
              <Field label="Class of risk" value={nonMotor.risk_type} />
              <Field label="Occupancy" value={nonMotor.occupancy} />
              <Field label="Situation of risk" value={nonMotor.risk_address} />
              <Field label="Period" value={nonMotor.period_desc} />
              <Field label="Benefits / sums insured" value={nonMotor.benefits} />
            </dl>
          </div>
        ) : null}

        <div className="panel">
          <div className="panel-head">
            Premium computation
            <Help text="Basic premium less no-claim discount, plus extra covers, service tax and stamp duty." />
          </div>
          <div>
            <Line label="Basic premium" value={money(policy.basic_premium)} />
            {policy.ncd_pct > 0 && (
              <Line
                label="Less: no claim discount"
                note={`${num(policy.ncd_pct, 2)}%`}
                value={`(${money(policy.ncd_amount)})`}
              />
            )}
            {policy.extra_premium > 0 && <Line label="Extra cover premium" value={money(policy.extra_premium)} />}
            <Line label="Gross premium" value={money(policy.gross_premium)} strong />
            <Line label="Service tax" note="8%" value={money(policy.service_tax)} />
            <Line label="Stamp duty" value={money(policy.stamp_duty)} />
            <Line label="Total payable" value={money(policy.total_premium)} strong />
            <Line
              label="Agency commission"
              note={`${num(policy.commission_rate, 0)}% of gross`}
              value={money(policy.commission_amt)}
            />
          </div>
        </div>
      </div>

      {extensions.length > 0 && (
        <div className="panel">
          <div className="panel-head">Extensions, endorsements and optional covers</div>
          <div className="scroll-x">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Cover</th>
                  <th className="num">Sum insured</th>
                  <th className="num">Premium</th>
                </tr>
              </thead>
              <tbody>
                {extensions.map((e) => (
                  <tr key={e.id}>
                    <td className="wrap text-ink">{e.name}</td>
                    <td className="num text-ink-soft">{e.sum_insured ? money(e.sum_insured) : '—'}</td>
                    <td className="num">{money(e.premium)}</td>
                  </tr>
                ))}
                <tr>
                  <td className="font-semibold text-ink">Total extra cover premium</td>
                  <td />
                  <td className="num font-semibold">{money(policy.extra_premium)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="panel">
          <div className="panel-head">Collection from client</div>
          {clientPay && (
            <>
              <dl className="grid gap-5 px-6 py-5 sm:grid-cols-2">
                <Field label="Amount due" value={money(clientPay.amount)} />
                <Field label="Amount received" value={money(clientPay.paid_amount)} />
                <Field label="Due date" value={longDate(clientPay.due_date)} />
                <Field label="Received on" value={clientPay.paid_date ? longDate(clientPay.paid_date) : '—'} />
                <Field label="Method" value={clientPay.method} />
                <Field label="Reference" value={clientPay.reference} />
                <Field label="Status" value={<StatusBadge status={clientPay.status} />} />
              </dl>
              {clientPay.status !== 'paid' && (
                <form action={recordPaymentAction} className="flex flex-wrap items-end gap-3 border-t border-line px-6 py-4">
                  <input type="hidden" name="payment_id" value={clientPay.id} />
                  <input type="hidden" name="back" value={`/insurance/${slug}/${policy.id}`} />
                  <div className="w-[130px]">
                    <label htmlFor="amount" className="sec-label mb-1 block">Amount</label>
                    <input
                      id="amount"
                      name="amount"
                      type="number"
                      step="0.01"
                      min="0.01"
                      defaultValue={(clientPay.amount - clientPay.paid_amount).toFixed(2)}
                      className="inp"
                      required
                    />
                  </div>
                  <div className="w-[150px]">
                    <label htmlFor="method" className="sec-label mb-1 block">Method</label>
                    <select id="method" name="method" className="inp" defaultValue="Online transfer">
                      <option>Online transfer</option>
                      <option>Cash</option>
                      <option>Cheque</option>
                      <option>Credit card</option>
                    </select>
                  </div>
                  <div className="w-[180px]">
                    <label htmlFor="reference" className="sec-label mb-1 block">Reference</label>
                    <input id="reference" name="reference" className="inp" placeholder="Receipt / FPX ref" />
                  </div>
                  <button type="submit" className="btn btn-primary">Record collection</button>
                </form>
              )}
            </>
          )}
        </div>

        <div className="panel">
          <div className="panel-head">Remittance to principal</div>
          {principalPay && (
            <dl className="grid gap-5 px-6 py-5 sm:grid-cols-2">
              <Field label="Amount due to principal" value={money(principalPay.amount)} />
              <Field label="Amount remitted" value={money(principalPay.paid_amount)} />
              <Field label="Due date" value={longDate(principalPay.due_date)} />
              <Field label="Remitted on" value={principalPay.paid_date ? longDate(principalPay.paid_date) : '—'} />
              <Field label="Status" value={<StatusBadge status={principalPay.status} />} />
              <Field label="Reference" value={principalPay.reference} />
            </dl>
          )}
          {commission && (
            <div className="border-t border-line px-6 py-5">
              <p className="sec-label mb-3">Sub agent commission</p>
              <dl className="grid gap-5 sm:grid-cols-2">
                <Field label="Commission" value={money(commission.gross_amount)} />
                <Field label="Override" value={money(commission.override_amt)} />
                <Field label="Net payable" value={money(commission.net_amount)} />
                <Field label="Status" value={<StatusBadge status={commission.status} />} />
              </dl>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
