import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/session';
import { PageHeader } from '@/components/ui';

export const dynamic = 'force-dynamic';

const CLAUSES: [string, string][] = [
  [
    'What we hold',
    'The service stores the client, policy and financial records your agency enters: insured particulars, identification numbers, contact details, vehicle and risk particulars, premium and commission figures, and the payment records attached to each policy.',
  ],
  [
    'Why we hold it',
    'Personal data is processed solely to administer the policies placed through your agency — issuing and renewing cover, collecting premium, remitting to principals, and calculating commission.',
  ],
  [
    'Consent for third parties',
    'Where you submit data about directors, shareholders, authorised signatories, employees or other insured persons, you confirm that you have obtained their consent for that data to be used in connection with the insurance placed on their behalf.',
  ],
  [
    'Access and correction',
    'Clients with portal access can view the policies recorded against them. Requests to correct personal data should be raised with your agency, which can amend the record directly.',
  ],
  [
    'Retention',
    'Policy and financial records are retained for the period required by the insurers you place business with and by Malaysian law, and are removed once that period lapses.',
  ],
  [
    'Enquiries',
    'Questions about how data is handled in this system can be directed to Simplicity Consulting Sdn. Bhd. using the details under Contact Us.',
  ],
];

export default async function PrivacyPage() {
  const user = await currentUser();
  if (!user) redirect('/login');

  return (
    <div className="panel px-6 py-6">
      <PageHeader
        title="Privacy Notice"
        subtitle="How personal data recorded in Insurance Helper is handled."
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
