import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/session';
import { PageHeader } from '@/components/ui';

export const dynamic = 'force-dynamic';

const SECTIONS = [
  {
    href: '/setting/global',
    title: 'Global',
    desc: 'Commission rates, company e-Invoice details and the insurance companies you place business with.',
  },
  {
    href: '/setting/renewal',
    title: 'Renewal Setting',
    desc: 'When and how renewal notices reach the insured, plus the policies falling due.',
  },
  {
    href: '/setting/notifications',
    title: 'Schedule Notification',
    desc: 'Broadcast messages to everyone in the system, including sub agents and insured clients.',
  },
];

export default async function SettingPage() {
  const user = await currentUser();
  if (!user) redirect('/login');

  return (
    <div className="panel px-6 py-6">
      <PageHeader title="Setting" subtitle="System configuration for this organisation." />
      <div className="grid gap-4 sm:grid-cols-3">
        {SECTIONS.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="rounded border border-line px-5 py-4 transition-colors hover:border-accent hover:bg-[#f8fbff]"
          >
            <h3 className="text-[15px] font-semibold text-ink">{s.title}</h3>
            <p className="mt-1 text-[13px] text-ink-soft">{s.desc}</p>
            <span className="mt-2.5 inline-block text-[12.5px] font-semibold text-link">Open →</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
