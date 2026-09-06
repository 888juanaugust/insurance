'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import SideNav, { type NavCounts } from './SideNav';
import { Logo, IconBell } from './icons';
import type { SessionUser } from '@/lib/session';

/**
 * The frame every signed-in screen sits in: a 56px top bar, a collapsible
 * rail, and the page.
 *
 * Who is signed in lives at the FOOT OF THE RAIL, not up here. It is neither
 * navigation nor a task — it is the answer to "which account am I in", and
 * the bottom-left corner is where that has always belonged. The top bar keeps
 * the agency name and the bell, and on a phone it is where the rail is opened
 * from, so the drawer state lives here, above both.
 */
export default function AppShell({
  user,
  orgName,
  counts,
  logout,
  children,
}: {
  user: SessionUser;
  orgName: string;
  counts: NavCounts;
  logout: () => Promise<void>;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [drawer, setDrawer] = useState(false);
  useEffect(() => {
    setDrawer(false);
  }, [pathname]);

  const year = new Date().getFullYear();

  return (
    <div className="flex min-h-screen bg-canvas">
      <SideNav counts={counts} user={user} orgName={orgName} logout={logout} />

      {drawer && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="h-full">
            <SideNav
              counts={counts}
              user={user}
              orgName={orgName}
              logout={logout}
              drawer
              onCloseDrawer={() => setDrawer(false)}
            />
          </div>
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setDrawer(false)}
            className="flex-1 bg-black/30"
          />
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="topbar sticky top-0 z-40 flex items-center gap-3 px-4 sm:px-6">
          <button
            type="button"
            onClick={() => setDrawer(true)}
            aria-label="Open navigation"
            className="rounded-lg p-1.5 text-ink-soft hover:bg-sunken lg:hidden"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
            </svg>
          </button>
          <Link href="/" className="flex items-center gap-2 lg:hidden">
            <Logo className="h-[22px] w-[22px]" />
            <span className="text-[16px] font-bold text-ink">Insurhelp</span>
          </Link>

          <span className="hidden truncate text-[13px] font-semibold text-ink-soft lg:block">{orgName}</span>

          <div className="ml-auto flex items-center gap-1.5">
            <Link
              href="/settings/notifications"
              aria-label={
                counts.notifications > 0
                  ? `${counts.notifications} unread notification${counts.notifications === 1 ? '' : 's'}`
                  : 'Notifications'
              }
              className="relative rounded-lg p-2 text-ink-soft hover:bg-sunken hover:text-ink"
            >
              <IconBell className="h-[18px] w-[18px]" />
              {counts.notifications > 0 && (
                <span className="absolute right-1 top-1 flex h-[16px] min-w-[16px] items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold text-white">
                  {counts.notifications}
                </span>
              )}
            </Link>

          </div>
        </header>

        <main className="flex-1 px-4 py-6 sm:px-6">{children}</main>

        <footer className="border-t border-line bg-surface">
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
