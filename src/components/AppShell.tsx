'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import SideNav, { type NavCounts } from './SideNav';
import { Logo, IconBell, IconChevron, IconLogout } from './icons';
import type { SessionUser } from '@/lib/session';

/**
 * The frame every signed-in screen sits in: a 56px white top bar, a white
 * collapsible rail, and the page. The top bar is where a person finds
 * themselves — the agency, the bell, their own name and the way out — and
 * on a phone it is also where the rail is opened from, so the drawer state
 * lives here, above both.
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
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDrawer(false);
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const initials = user.name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  const year = new Date().getFullYear();

  return (
    <div className="flex min-h-screen bg-canvas">
      <SideNav counts={counts} />

      {drawer && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="h-full">
            <SideNav counts={counts} drawer onCloseDrawer={() => setDrawer(false)} />
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

            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((o) => !o)}
                aria-expanded={menuOpen}
                aria-haspopup="menu"
                className="flex items-center gap-2 rounded-xl px-1.5 py-1 hover:bg-sunken"
              >
                <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-brand text-[11.5px] font-bold text-white">
                  {initials}
                </span>
                <span className="hidden min-w-0 text-left sm:block">
                  <span className="block max-w-[160px] truncate text-[12.5px] font-semibold text-ink">{user.name}</span>
                  <span className="block max-w-[160px] truncate text-[11px] text-muted">{orgName}</span>
                </span>
                <IconChevron className={`hidden h-[12px] w-[12px] shrink-0 text-muted sm:block ${menuOpen ? '-rotate-90' : 'rotate-90'}`} />
              </button>

              {menuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 top-[calc(100%+6px)] z-50 w-[224px] overflow-hidden rounded-2xl border border-line bg-white shadow-lg"
                >
                  <div className="border-b border-line px-4 py-2.5">
                    <p className="truncate text-[13px] font-semibold text-ink">{user.name}</p>
                    <p className="truncate text-[11.5px] text-muted">{user.email}</p>
                  </div>
                  {[
                    ['/settings', 'Your profile'],
                    ['/organisation', 'Organisation'],
                    ['/user-guide', 'User guide'],
                    ['/contact-us', 'Support'],
                  ].map(([href, label]) => (
                    <Link key={href} href={href} role="menuitem" className="block px-4 py-2 text-[13px] text-ink-soft hover:bg-canvas">
                      {label}
                    </Link>
                  ))}
                  <form action={logout} className="border-t border-line">
                    <button
                      type="submit"
                      role="menuitem"
                      className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-[13px] font-medium text-brand hover:bg-brand-wash"
                    >
                      <IconLogout className="h-[15px] w-[15px]" />
                      Sign out
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>
        </header>

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
