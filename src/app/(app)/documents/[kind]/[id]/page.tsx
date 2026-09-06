import { notFound, redirect } from 'next/navigation';
import { currentUser } from '@/lib/session';
import { getPolicy, getOrg } from '@/lib/queries';
import { money, longDate, today } from '@/lib/format';
import PrintButton from '@/components/PrintButton';

export const dynamic = 'force-dynamic';

const KINDS: Record<string, string> = {
  loc: 'Letter of Collection',
  receipt: 'Official Receipt',
};

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <tr>
      <td className="w-[220px] py-1.5 pr-4 align-top text-[12.5px] text-muted">{label}</td>
      <td className="py-1.5 text-[13px] text-ink">{value}</td>
    </tr>
  );
}

export default async function DocumentPage({
  params,
}: {
  params: Promise<{ kind: string; id: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect('/login');

  const { kind, id } = await params;
  const title = KINDS[kind];
  if (!title) notFound();

  const data = getPolicy(id);
  if (!data || data.policy.org_id !== user.org_id) notFound();

  const { policy, motor, client, principalRow, payments } = data;
  const org = getOrg(user.org_id)!;
  const clientPay = payments.find((p) => p.kind === 'client');
  const isReceipt = kind === 'receipt';
  const locNo = (policy as unknown as { loc_no: string | null }).loc_no;

  if (isReceipt && clientPay?.status !== 'paid') {
    return (
      <div className="panel mx-auto max-w-[760px] px-8 py-10 text-center">
        <h1 className="text-[18px] font-semibold text-ink">No receipt yet</h1>
        <p className="mt-2 text-[13.5px] text-ink-soft">
          A receipt is issued once the premium for {policy.policy_no} has been collected. This
          policy is still showing as outstanding.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[820px]">
      <div className="mb-3 flex items-center justify-between print:hidden">
        <p className="text-[13px] text-muted">
          Print or save this page as PDF from your browser.
        </p>
        <PrintButton />
      </div>

      <article className="panel px-10 py-10 print:border-0">
        <header className="flex items-start justify-between gap-6 border-b-2 border-ink pb-5">
          <div>
            <h1 className="text-[20px] font-semibold tracking-tight text-ink">{org.name}</h1>
            <p className="mt-1 whitespace-pre-line text-[12.5px] leading-relaxed text-ink-soft">
              {org.address1}
              {'\n'}
              {org.address2}
              {'\n'}
              {org.postcode} {org.city}, {org.state}
              {'\n'}
              Tel {org.phone} · {org.email}
            </p>
            <p className="mt-1.5 text-[12px] text-muted">
              SSM {org.ssm_no} · SST {org.sst_no}
            </p>
          </div>
          <div className="text-right">
            <h2 className="text-[16px] font-semibold uppercase tracking-[0.08em] text-ink">{title}</h2>
            <p className="mt-1.5 text-[12.5px] text-ink-soft">
              No. {isReceipt ? (clientPay?.reference ?? `RCP-${policy.id.slice(-6).toUpperCase()}`) : (locNo ?? `LOC-${policy.id.slice(-6).toUpperCase()}`)}
            </p>
            <p className="text-[12.5px] text-ink-soft">Date {longDate(isReceipt ? clientPay?.paid_date : today())}</p>
          </div>
        </header>

        <section className="mt-6">
          <p className="sec-label mb-2">{isReceipt ? 'Received from' : 'Billed to'}</p>
          <p className="text-[14px] font-semibold text-ink">{client.name}</p>
          <p className="whitespace-pre-line text-[12.5px] leading-relaxed text-ink-soft">
            {client.address1}
            {client.address2 ? `\n${client.address2}` : ''}
            {'\n'}
            {client.postcode} {client.city}, {client.state}
          </p>
          {(client.nric || client.business_reg) && (
            <p className="mt-1 text-[12px] text-muted">{client.nric || client.business_reg}</p>
          )}
        </section>

        <section className="mt-6 rounded border border-line px-5 py-4">
          <table className="w-full">
            <tbody>
              <Row label="Policy number" value={policy.policy_no} />
              {policy.cover_note_no && <Row label="Cover note" value={policy.cover_note_no} />}
              <Row label="Insurer" value={principalRow.name as string} />
              <Row label="Class" value={`${policy.product} — ${policy.type_of_cover}`} />
              {motor && <Row label="Vehicle" value={`${motor.vehicle_no} · ${motor.make_model}`} />}
              <Row
                label="Period of insurance"
                value={`${longDate(policy.effective_date)} to ${longDate(policy.expiry_date)}`}
              />
              <Row label="Sum insured" value={money(policy.sum_insured)} />
            </tbody>
          </table>
        </section>

        <section className="mt-6">
          <table className="w-full text-[13px]">
            <tbody>
              <tr className="border-b border-line-soft">
                <td className="py-2 text-ink-soft">Gross premium</td>
                <td className="py-2 text-right tabular-nums text-ink">{money(policy.gross_premium)}</td>
              </tr>
              <tr className="border-b border-line-soft">
                <td className="py-2 text-ink-soft">Service tax (8%)</td>
                <td className="py-2 text-right tabular-nums text-ink">{money(policy.service_tax)}</td>
              </tr>
              <tr className="border-b border-line-soft">
                <td className="py-2 text-ink-soft">Stamp duty</td>
                <td className="py-2 text-right tabular-nums text-ink">{money(policy.stamp_duty)}</td>
              </tr>
              <tr className="border-b-2 border-ink">
                <td className="py-2.5 font-semibold text-ink">
                  {isReceipt ? 'Total received' : 'Total payable'}
                </td>
                <td className="py-2.5 text-right text-[15px] font-semibold tabular-nums text-ink">
                  {money(policy.total_premium)}
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        {isReceipt ? (
          <p className="mt-5 text-[12.5px] text-ink-soft">
            Received by {clientPay?.method ?? 'transfer'}
            {clientPay?.reference ? ` · reference ${clientPay.reference}` : ''} on{' '}
            {longDate(clientPay?.paid_date)}. This receipt is computer generated and needs no signature.
          </p>
        ) : (
          <div className="mt-5 space-y-2 text-[12.5px] leading-relaxed text-ink-soft">
            <p>
              Payment is due by {longDate(clientPay?.due_date)}. Cover is subject to the premium
              being received within the period allowed under the Financial Services Act 2013.
            </p>
            <p>
              Please make payment to <strong className="text-ink">{org.name}</strong>, and email the
              payment slip to {org.email}.
            </p>
          </div>
        )}
      </article>
    </div>
  );
}
