import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/session';
import { getOrg } from '@/lib/queries';
import { PageHeader } from '@/components/ui';

export const dynamic = 'force-dynamic';

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 border-b border-line py-2.5 last:border-0">
      <span className="sec-label w-[170px] shrink-0 pt-[3px]">{label}</span>
      <span className="text-[13.5px] text-ink">{value}</span>
    </div>
  );
}

export default async function ContactUsPage() {
  const user = await currentUser();
  if (!user) redirect('/login');

  const org = getOrg(user.org_id)!;
  const address = [org.address1, org.address2, `${org.postcode} ${org.city}`.trim(), org.state]
    .filter(Boolean);

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <div className="panel px-6 py-6">
        <PageHeader
          title="Support"
          subtitle="How to reach us, and the details we hold for your agency."
        />
        <div>
          <Row label="Product support" value={<a href="mailto:support@insurhelp.my" className="text-link hover:underline">support@insurhelp.my</a>} />
          <Row label="Billing enquiries" value={<a href="mailto:billing@insurhelp.my" className="text-link hover:underline">billing@insurhelp.my</a>} />
          <Row label="Support hours" value="Monday to Friday, 9.00 am – 6.00 pm (MYT)" />
          <Row label="Response target" value="Within one working day" />
        </div>
        <p className="mt-5 rounded border border-line bg-sunken px-4 py-3 text-[12.5px] leading-relaxed text-ink-soft">
          Set your own support addresses under Settings → Rates and insurers before you invite
          your agents, so these point at your team rather than ours.
        </p>
      </div>

      <div className="panel px-6 py-6">
        <h2 className="text-[16px] font-semibold text-ink">Your agency</h2>
        <p className="mt-1.5 text-[13px] text-ink-soft">
          Printed on the letters of collection and receipts your clients receive. Change it under
          Organisation.
        </p>
        <div className="mt-4">
          <Row label="Registered name" value={org.name} />
          <Row label="Business registration" value={org.ssm_no || '—'} />
          <Row label="Address" value={address.length ? address.map((l, i) => <span key={i}>{l}<br /></span>) : '—'} />
          <Row label="Telephone" value={org.phone || '—'} />
          <Row label="Email" value={org.email || '—'} />
          <Row label="Collection account" value={org.bank_account_number ? `${org.bank_name} · ${org.bank_account_number}` : 'Not set'} />
        </div>
      </div>
    </div>
  );
}
