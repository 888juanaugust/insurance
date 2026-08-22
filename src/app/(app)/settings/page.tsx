import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/session';
import { getBillingProfile } from '@/lib/queries';
import { PageHeader, Help } from '@/components/ui';
import { BillingProfileForm, PasswordForm } from '@/components/SettingsForms';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const user = await currentUser();
  if (!user) redirect('/login');

  const profile = (getBillingProfile(user.id) ?? {}) as Record<string, string>;

  return (
    <div className="space-y-4">
      <div className="panel px-6 py-6">
        <PageHeader
          title="Setting"
          subtitle="Your own e-Invoice billing identity and password. These are per user, not per organisation."
          meta={`Signed in as ${user.name} · ${user.email}`}
        />
        <div className="flex flex-wrap gap-3 text-[13px]">
          <Link href="/settings/global" className="text-link hover:underline">Organisation-wide settings →</Link>
          <Link href="/settings/renewal" className="text-link hover:underline">Renewal reminders →</Link>
          <Link href="/settings/notifications" className="text-link hover:underline">Scheduled notifications →</Link>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          e-Invoice billing
          <Help text="Used when the agency raises a self-billed e-Invoice for the commission it pays you." />
        </div>
        <BillingProfileForm initial={profile} />
      </div>

      <div className="panel">
        <div className="panel-head">Password</div>
        <PasswordForm />
      </div>
    </div>
  );
}
