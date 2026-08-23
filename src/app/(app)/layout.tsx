import Link from 'next/link';
import { redirect } from 'next/navigation';
import TopNav from '@/components/TopNav';
import { currentUser } from '@/lib/session';
import { logoutAction } from '@/lib/actions';
import { unreadNotifications, getOrg } from '@/lib/queries';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) redirect('/login');

  const unread = unreadNotifications(user.org_id).v;
  const orgName = getOrg(user.org_id)?.name ?? '';
  const year = new Date().getFullYear();

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <TopNav user={user} orgName={orgName} unread={unread} logout={logoutAction} />

      <main className="flex-1">
        <div className="mx-auto max-w-[1560px] px-4 py-6 sm:px-6">{children}</div>
      </main>

      <footer className="border-t border-line bg-white">
        <div className="mx-auto flex max-w-[1560px] flex-wrap items-center justify-between gap-2 px-4 py-4 text-[12.5px] text-muted sm:px-6">
          <span>© {year} Insurhelp</span>
          <span className="flex gap-4">
            <Link href="/terms-and-conditions" className="hover:text-brand">Terms</Link>
            <Link href="/privacy-policy" className="hover:text-brand">Privacy</Link>
            <Link href="/contact-us" className="hover:text-brand">Support</Link>
          </span>
        </div>
      </footer>
    </div>
  );
}
