import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/session';
import { PageHeader } from '@/components/ui';

export const dynamic = 'force-dynamic';

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 border-b border-[#eff1f4] py-2.5 last:border-0">
      <span className="w-[190px] shrink-0 sec-label pt-[3px]">{label}</span>
      <span className="text-[13.5px] text-ink">{value}</span>
    </div>
  );
}

export default async function ContactUsPage() {
  const user = await currentUser();
  if (!user) redirect('/login');

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <div className="panel px-6 py-6">
        <PageHeader title="Contact Us" subtitle="Support and account enquiries for your Insurance Helper subscription." />
        <div>
          <Row label="Company" value="Simplicity Consulting Sdn. Bhd." />
          <Row
            label="Address"
            value={
              <>
                D-1-13 The Capers
                <br />
                Jalan Sentul Sejahtera
                <br />
                51000 Kuala Lumpur
              </>
            }
          />
          <Row label="Telephone" value={<a href="tel:+60125762417" className="text-link hover:underline">012-576 2417</a>} />
          <Row
            label="Email"
            value={
              <a href="mailto:tssaw@simplicity.com.my" className="text-link hover:underline">
                tssaw@simplicity.com.my
              </a>
            }
          />
          <Row label="Support hours" value="Monday to Friday, 9.00 am – 6.00 pm (MYT)" />
        </div>
      </div>

      <div className="panel px-6 py-6">
        <h2 className="text-[16px] font-semibold text-ink">Payment instruction</h2>
        <p className="mt-1.5 text-[13px] text-ink-soft">
          Cheques should be crossed and made payable to Simplicity Consulting Sdn. Bhd.
        </p>
        <div className="mt-4">
          <Row label="Bank" value="Maybank Berhad — Taman Tun Dr. Ismail (TTDI)" />
          <Row label="Account number" value="5642 7654 0010" />
          <Row label="Swift code" value="MBBEMYKL" />
          <Row
            label="Send payment slip to"
            value={
              <a href="mailto:tssaw@simplicity.com.my" className="text-link hover:underline">
                tssaw@simplicity.com.my
              </a>
            }
          />
        </div>
        <p className="mt-5 rounded border border-line bg-[#f8f9fb] px-4 py-3 text-[12.5px] leading-relaxed text-ink-soft">
          Subscription is billed monthly in advance. The minimum contract is 12 months from the agreed
          kick start date, renewing automatically for successive 12-month terms unless terminated by
          notice in accordance with the agreement.
        </p>
      </div>
    </div>
  );
}
