'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { NAV, sectionFor } from '@/lib/nav';
import { Logo, IconBell, IconChevron, IconSearch } from './icons';
import type { SessionUser } from '@/lib/session';

export default function TopNav({
  user,
  orgName,
  unread,
  logout,
}: {
  user: SessionUser;
  orgName: string;
  unread: number;
  logout: () => Promise<void>;
  }) {
  const pathname = usePathname();
  const section = sectionFor(pathname);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMenuOpen(false);
    setMobileOpen(false);
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

  const initials = user.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

  return (
    <header className="shrink-0">
      {/* primary bar */}
      <div className="bg-nav">
        <div className="mx-auto flex h-[58px] max-w-[1560px] items-center gap-2 px-4 sm:px-6">
          <Link href="/" className="mr-2 flex shrink-0 items-center gap-2.5">
            <Logo className="h-[26px] w-[26px]" />
            <span className="text-[18px] font-semibold tracking-tight text-white">Insurhelp</span>
          </Link>

          <nav aria-label="Primary" className="hidden flex-1 items-center gap-0.5 lg:flex">
            {NAV.map((s) => {
              const active = section?.key === s.key;
              return (
                <Link
                  key={s.key}
                  href={s.href}
                  aria-current={active ? 'page' : undefined}
                  className={`relative rounded px-3 py-2 text-[13.5px] font-medium transition-colors ${
                    active ? 'text-white' : 'text-nav-text hover:bg-nav-soft hover:text-white'
                  }`}
                >
                  {s.label}
                  {active && (
                    <span className="absolute inset-x-3 -bottom-[9px] h-[3px] rounded-t bg-brand" />
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="flex flex-1 items-center justify-end gap-1.5 lg:flex-none">
            <button
              type="button"
              onClick={() => setMobileOpen((o) => !o)}
              aria-label="Menu"
              aria-expanded={mobileOpen}
              className="rounded p-2 text-nav-text hover:bg-nav-soft hover:text-white lg:hidden"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
              </svg>
            </button>

            <Link
              href="/insurance/general-motor"
              title="Find a policy"
              className="rounded p-2 text-nav-text hover:bg-nav-soft hover:text-white"
            >
              <IconSearch className="h-[18px] w-[18px]" />
            </Link>

            <Link
              href="/settings/notifications"
              title="Notifications"
              className="relative rounded p-2 text-nav-text hover:bg-nav-soft hover:text-white"
            >
              <IconBell className="h-[18px] w-[18px]" />
              {unread > 0 && (
                <span className="absolute right-1 top-1 flex h-[16px] min-w-[16px] items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold text-white">
                  {unread}
                </span>
              )}
            </Link>

            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((o) => !o)}
                aria-expanded={menuOpen}
                aria-haspopup="menu"
                className="flex items-center gap-2 rounded py-1 pl-1 pr-2 text-nav-text hover:bg-nav-soft hover:text-white"
              >
                <span className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-brand text-[12px] font-semibold text-white">
                  {initials}
                </span>
                <span className="hidden text-left sm:block">
                  <span className="block text-[13px] font-medium leading-tight text-white">{user.name}</span>
                  <span className="block text-[11px] leading-tight text-nav-text">{orgName}</span>
                </span>
                <IconChevron className={`h-[13px] w-[13px] rotate-90 transition-transform ${menuOpen ? '-rotate-90' : ''}`} />
              </button>

              {menuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 top-[calc(100%+8px)] z-50 w-[230px] overflow-hidden rounded-md border border-line bg-white shadow-lg"
                >
                  <div className="border-b border-line px-4 py-3">
                    <p className="text-[13.5px] font-semibold text-ink">{user.name}</p>
                    <p className="text-[12px] text-muted">{user.email}</p>
                    <span className="mt-1.5 inline-block rounded bg-sunken px-1.5 py-0.5 text-[11px] font-medium text-ink-soft">
                      {user.role === 'master' ? 'Agency owner' : user.role}
                    </span>
                  </div>
                  {[
                    ['/settings', 'Your profile'],
                    ['/organisation', 'Organisation'],
                    ['/user-guide', 'User guide'],
                    ['/contact-us', 'Support'],
                  ].map(([href, label]) => (
                    <Link
                      key={href}
                      href={href}
                      role="menuitem"
                      className="block px-4 py-2 text-[13px] text-ink-soft hover:bg-canvas"
                    >
                      {label}
                    </Link>
                  ))}
                  <form action={logout} className="border-t border-line">
                    <button
                      type="submit"
                      role="menuitem"
                      className="w-full px-4 py-2.5 text-left text-[13px] font-medium text-brand hover:bg-brand-wash"
                    >
                      Sign out
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* contextual second row */}
      {section?.children && (
        <div className="border-b border-line bg-white">
          <div className="scroll-x mx-auto flex max-w-[1560px] gap-1 px-4 sm:px-6">
            {section.children.map((c) => {
              const active = pathname === c.href || pathname.startsWith(c.href + '/');
              return (
                <Link
                  key={c.href}
                  href={c.href}
                  title={c.hint}
                  aria-current={active ? 'page' : undefined}
                  className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2.5 text-[13px] ${
                    active
                      ? 'border-brand font-semibold text-brand'
                      : 'border-transparent text-ink-soft hover:text-ink'
                  }`}
                >
                  {c.label}
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* small screens: the whole tree, disclosed */}
      {mobileOpen && (
        <nav aria-label="All sections" className="border-b border-line bg-white lg:hidden">
          <div className="mx-auto max-w-[1560px] px-4 py-3 sm:px-6">
            {NAV.map((s) => (
              <div key={s.key} className="border-b border-line py-2 last:border-0">
                <Link href={s.href} className="block text-[14px] font-semibold text-ink">
                  {s.label}
                </Link>
                {s.children && (
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                    {s.children.map((c) => (
                      <Link key={c.href} href={c.href} className="text-[13px] text-muted hover:text-brand">
                        {c.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </nav>
      )}
    </header>
  );
}
