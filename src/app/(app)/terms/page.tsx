import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/session';
import { PageHeader } from '@/components/ui';

export const dynamic = 'force-dynamic';

const CLAUSES: [string, string][] = [
  [
    'Term',
    'The initial term runs for one (1) year from the date of the agreement and renews automatically at the expiry of the initial term for successive terms of twelve (12) calendar months each, until terminated by notice in accordance with the agreement.',
  ],
  [
    'Subscription and quota',
    'The standard package covers up to 350 policy transactions per month across motor and non-motor, including quotations and renewals. Exceeding the quota in any month requires an upgrade to the next tier; downgrades are not permitted once upgraded.',
  ],
  [
    'Named users',
    'The standard package includes two named users. Additional named users are charged at RM50 per user per month.',
  ],
  [
    'Storage',
    'The standard subscription includes 20 GB of storage. Additional storage is purchased in 20 GB increments at RM50 per month; 20 GB is both the minimum add-on and the fixed increment for subsequent top-ups.',
  ],
  [
    'Payment',
    'Fees are payable monthly in advance. Cheques should be crossed and made payable to Simplicity Consulting Sdn. Bhd., with the payment slip emailed to the address shown under Contact Us.',
  ],
  [
    'Confidentiality',
    'All materials made available through the service are private and confidential, and remain the property of Simplicity Consulting Sdn. Bhd.',
  ],
];

export default async function TermsPage() {
  const user = await currentUser();
  if (!user) redirect('/login');

  return (
    <div className="panel px-6 py-6">
      <PageHeader
        title="Terms of Service"
        subtitle="Summary of the SimSuite SaaS cloud service subscription terms."
        meta="Copyright © 2020–2026 Simplicity Consulting Sdn. Bhd. All rights reserved."
      />
      <div className="max-w-[820px] space-y-5">
        {CLAUSES.map(([title, body]) => (
          <section key={title}>
            <h2 className="text-[14.5px] font-semibold text-ink">{title}</h2>
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-soft">{body}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
