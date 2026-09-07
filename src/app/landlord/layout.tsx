import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { currentUser } from '@/lib/session';
import { logoutAction } from '@/lib/actions';
import { isLandlordProcess } from '@/lib/tenant';
import { Logo } from '@/components/icons';

export const dynamic = 'force-dynamic';

/**
 * The landlord's console: the same application, running as the landlord's
 * own process at the base domain. In any agency's process this does not
 * exist — a 404, not a screen that checks a role — so no tenant can reach a
 * view of the other tenants by guessing a path.
 */
export default async function LandlordLayout({ children }: { children: React.ReactNode }) {
  if (!isLandlordProcess()) notFound();
  const user = await currentUser();
  if (!user) redirect('/login');

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <header className="topbar sticky top-0 z-40 flex items-center gap-3 px-4 sm:px-6">
        <Link href="/landlord" className="flex items-center gap-2">
          <Logo className="h-[22px] w-[22px]" />
          <span className="text-[16px] font-bold text-ink">Insurhelp</span>
          <span className="text-[13px] font-semibold text-muted">· landlord console</span>
        </Link>
        <div className="ml-auto flex items-center gap-3 text-[13px] text-ink-soft">
          <span className="hidden sm:inline">{user.name}</span>
          <form action={logoutAction}>
            <button type="submit" className="btn btn-ghost">Sign out</button>
          </form>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1180px] flex-1 px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
