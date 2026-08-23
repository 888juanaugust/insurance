import Link from 'next/link';
import { redirect } from 'next/navigation';
import SideNav from '@/components/SideNav';
import { currentUser } from '@/lib/session';
import { logoutAction } from '@/lib/actions';
import { navCounts, getOrg } from '@/lib/queries';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) redirect('/login');

  const counts = navCounts(user.org_id);
  const orgName = getOrg(user.org_id)?.name ?? '';
  const year = new Date().getFullYear();

  return (
    <div className="flex min-h-screen bg-canvas lg:flex-row">
      <SideNav user={user} orgName={orgName} counts={counts} logout={logoutAction} />

      <div className="flex min-w-0 flex-1 flex-col">
        <main className="flex-1 px-4 py-6 sm:px-6">{children}</main>

        <footer className="border-t border-line bg-white">
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3.5 text-[12.5px] text-muted sm:px-6">
            <span>© {year} Insurhelp</span>
            <span className="flex gap-4">
              <Link href="/terms-and-conditions" className="hover:text-brand">Terms</Link>
              <Link href="/privacy-policy" className="hover:text-brand">Privacy</Link>
              <Link href="/contact-us" className="hover:text-brand">Support</Link>
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
}
