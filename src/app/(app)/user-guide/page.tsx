import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/session';
import { PageHeader } from '@/components/ui';

export const dynamic = 'force-dynamic';

const MODULES = [
  {
    href: '/team',
    title: 'Team and agency',
    body: 'Sub agent roster and commission structure, the accounts that can sign in, and the e-Invoice details used for self-billed payouts.',
  },
  {
    href: '/clients',
    title: 'Clients',
    body: 'Stores insured and client details, and provides the portal through which a client logs in to view their own policy details.',
  },
  {
    href: '/insurance/general-motor',
    title: 'Insurance — General Motor',
    body: 'Holds motor policy details: vehicle particulars, period of insurance, sums insured, NCD, extensions and the full premium computation.',
  },
  {
    href: '/insurance/non-motor',
    title: 'Insurance — General Non-Motor',
    body: 'Holds non-motor policy details across fire, personal accident, medical, liability and other classes.',
  },
  {
    href: '/reports',
    title: 'Reports',
    body: 'Agent commission, monthly sales, company commission breakdown and outstanding premium.',
  },
  {
    href: '/accounting',
    title: 'Accounting',
    body: 'Approve commission payouts and maintain the billing details used for e-Invoice and commission payment.',
  },
  {
    href: '/settings/notifications',
    title: 'Broadcasts',
    body: 'Send or broadcast a message to all users in the system, including sub agents and insured clients.',
  },
  {
    href: '/settings/renewal',
    title: 'Renewal reminders',
    body: 'Set the renewal notification sent to the insured and review the policies falling due.',
  },
  {
    href: '/settings/global',
    title: 'Rates and insurers',
    body: 'Commission rates per insurer and class, company e-Invoice particulars and insurance company records.',
  },
];

export default async function UserGuidePage() {
  const user = await currentUser();
  if (!user) redirect('/login');

  return (
    <div className="space-y-4">
      <div className="panel px-6 py-6">
        <PageHeader
          title="User Guide"
          subtitle="What each module does and where to find it."
        />

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {MODULES.map((m) => (
            <Link
              key={m.href}
              href={m.href}
              className="rounded border border-line px-5 py-4 transition-colors hover:border-accent hover:bg-brand-wash"
            >
              <h3 className="text-[14.5px] font-semibold text-ink">{m.title}</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-ink-soft">{m.body}</p>
            </Link>
          ))}
        </div>
      </div>

      <div className="panel px-6 py-6">
        <h2 className="text-[16px] font-semibold text-ink">Getting started</h2>
        <ol className="mt-3 space-y-2.5 text-[13.5px] leading-relaxed text-ink-soft">
          <li>
            <span className="font-semibold text-ink">1. Set up your organisation.</span> Confirm the company
            particulars, TIN and SST numbers under Organisation — they are printed on every e-Invoice.
          </li>
          <li>
            <span className="font-semibold text-ink">2. Add your insurance companies and rates.</span> More →
            Settings → Rates and insurers holds the principals you place business with and the default commission
            rate per class.
          </li>
          <li>
            <span className="font-semibold text-ink">3. Register sub agents.</span> Each sub agent carries their own
            motor, non-motor and override rates, plus bank and TIN details for self-billed payouts.
          </li>
          <li>
            <span className="font-semibold text-ink">4. Create clients, then policies.</span> A policy always belongs
            to a client and a principal; the premium computation and commission follow from the class of business.
          </li>
          <li>
            <span className="font-semibold text-ink">5. Track collection.</span> The dashboard shows what is
            outstanding from clients and what is still owed to principals.
          </li>
          <li>
            <span className="font-semibold text-ink">6. Approve commission.</span> Accounting releases commission for
            payout once the case is settled.
          </li>
        </ol>
      </div>
    </div>
  );
}
