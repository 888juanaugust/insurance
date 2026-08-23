import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/session';
import { PageHeader } from '@/components/ui';

export const dynamic = 'force-dynamic';

const CLAUSES: [string, string][] = [
  [
    'These terms',
    'They cover your agency\u2019s use of Insurhelp. Replace this page with the agreement your own counsel prepares before you take on a paying customer \u2014 what follows is a working outline, not legal advice.',
  ],
  [
    'Your data is yours',
    'Client records, policies and financial figures entered into Insurhelp belong to your agency. You can export the register to CSV at any time, and we will provide a full extract on request if you stop using the product.',
  ],
  [
    'What we do with it',
    'We process your data only to run the service. We do not sell it, and we do not use one agency\u2019s book to inform another\u2019s.',
  ],
  [
    'Availability',
    'We aim for the service to be available during Malaysian business hours and will give notice before planned maintenance. Set out any availability commitment you intend to be held to before you sign a customer.',
  ],
  [
    'Your responsibilities',
    'Keep sign-in credentials confidential, keep the records you enter accurate, and make sure you have the consent you need from the individuals whose details you record.',
  ],
  [
    'Ending the agreement',
    'State your notice period, what happens to data afterwards, and how long you retain it before deletion. Malaysian insurance record-keeping obligations will usually set the floor.',
  ],
];

export default async function TermsPage() {
  const user = await currentUser();
  if (!user) redirect('/login');

  return (
    <div className="panel px-6 py-6">
      <PageHeader
        title="Terms of Service"
        subtitle="The terms on which your agency uses Insurhelp."
        meta="A working outline — replace with your own agreement before launch."
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
