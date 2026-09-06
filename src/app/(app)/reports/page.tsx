import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/session';
import { PageHeader } from '@/components/ui';
import { today } from '@/lib/format';

export const dynamic = 'force-dynamic';

const REPORTS = [
  {
    href: '/reports/agent-commission',
    title: 'Agent Commission',
    desc: 'Commission earned by each sub agent, split into pending, approved and paid.',
  },
  {
    href: '/reports/monthly-sales',
    title: 'Monthly Sales',
    desc: 'Cases and premium written each month, split by motor and non-motor.',
  },
  {
    href: '/reports/company-commission',
    title: 'Company Commission Breakdown',
    desc: 'Premium and commission by principal, showing where the book is concentrated.',
  },
  {
    href: '/reports/outstanding-premium',
    title: 'Outstanding Premium',
    desc: 'Aged analysis of premium not yet collected from clients.',
  },
];

export default async function ReportsPage() {
  const user = await currentUser();
  if (!user) redirect('/login');

  return (
    <div className="panel px-6 py-6">
      <PageHeader
        title="Reports"
        subtitle="Standard management reports for the agency portfolio."
        meta={`Performance year ${today().slice(0, 4)}`}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        {REPORTS.map((r) => (
          <Link
            key={r.href}
            href={r.href}
            className="rounded border border-line px-5 py-4 transition-colors hover:border-accent hover:bg-brand-wash"
          >
            <h3 className="text-[15px] font-semibold text-ink">{r.title}</h3>
            <p className="mt-1 text-[13px] text-ink-soft">{r.desc}</p>
            <span className="mt-2.5 inline-block text-[12.5px] font-semibold text-link">View report →</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
