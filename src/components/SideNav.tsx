'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { navFor, sectionFor, type CountKey, type IconKey, type NavSection } from '@/lib/nav';
import {
  Logo, IconHome, IconClients, IconShield, IconClipboard, IconAccounting,
  IconReports, IconUsers, IconSetting, IconChevron, IconBell, IconLogout,
} from './icons';
import type { SessionUser } from '@/lib/session';

const ICONS: Record<IconKey, (p: { className?: string }) => React.ReactElement> = {
  overview: IconHome,
  clients: IconClients,
  policies: IconShield,
  renewals: IconClipboard,
  accounts: IconAccounting,
  reports: IconReports,
  team: IconUsers,
  settings: IconSetting,
};

const COLLAPSE_KEY = 'insurhelp:nav-collapsed';

export type NavCounts = Record<CountKey, number> & { notifications: number };

export default function SideNav({
  user,
  orgName,
  counts,
  logout,
}: {
  user: SessionUser;
  orgName: string;
  counts: NavCounts;
  logout: () => Promise<void>;
}) {
  const pathname = usePathname();
  // The rail is built from the signed-in role, so a section this person could
  // only be refused from never appears.
  const sections = navFor(user.role);
  const active = sectionFor(pathname, sections);

  const [collapsed, setCollapsed] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [menuOpen, setMenuOpen] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Remembering the rail width is a per-browser convenience, and a blocked
  // or empty store just means it starts expanded.
  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(COLLAPSE_KEY) === '1');
    } catch {
      /* storage unavailable — keep the default */
    }
  }, []);

  function toggleCollapsed() {
    setCollapsed((c) => {
      const next = !c;
      try {
        window.localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0');
      } catch {
        /* not worth failing the interaction over */
      }
      return next;
    });
  }

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

  /** Expanded when explicitly opened, or when it holds the current page. */
  const isOpen = (s: NavSection) => open[s.key] ?? active?.key === s.key;

  const initials = user.name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

  const rail = (
    <div className={`flex h-full flex-col bg-nav ${collapsed ? 'w-[64px]' : 'w-[244px]'} transition-[width] duration-150`}>
      <div className="flex h-[58px] shrink-0 items-center gap-2.5 px-4">
        <Link href="/" className="flex items-center gap-2.5 overflow-hidden">
          <Logo className="h-[26px] w-[26px] shrink-0" />
          {!collapsed && (
            <span className="truncate text-[17px] font-semibold tracking-tight text-white">Insurhelp</span>
          )}
        </Link>
      </div>

      <nav aria-label="Sections" className="flex-1 overflow-y-auto px-2 pb-3">
        {sections.map((s) => {
          const Icon = ICONS[s.icon];
          const on = active?.key === s.key;
          const sectionCount = s.count ? counts[s.count] : 0;
          const expandable = Boolean(s.children);
          const expanded = expandable && isOpen(s) && !collapsed;

          return (
            <div key={s.key} className="mb-0.5">
              <div className="group relative flex items-center">
                <Link
                  href={s.href}
                  title={collapsed ? s.label : undefined}
                  aria-current={on ? 'page' : undefined}
                  className={`flex min-w-0 flex-1 items-center gap-3 rounded px-2.5 py-2 text-[13.5px] ${
                    on ? 'bg-nav-soft font-semibold text-white' : 'text-nav-text hover:bg-nav-soft hover:text-white'
                  }`}
                >
                  <span className="relative shrink-0">
                    <Icon className="h-[17px] w-[17px]" />
                    {collapsed && sectionCount > 0 && (
                      <span className="absolute -right-1.5 -top-1.5 h-[7px] w-[7px] rounded-full bg-brand" />
                    )}
                  </span>
                  {!collapsed && <span className="truncate">{s.label}</span>}
                  {!collapsed && sectionCount > 0 && !expanded && (
                    <span className="ml-auto rounded bg-brand px-1.5 py-0.5 text-[10.5px] font-bold text-white">
                      {sectionCount}
                    </span>
                  )}
                </Link>

                {expandable && !collapsed && (
                  <button
                    type="button"
                    onClick={() => setOpen((o) => ({ ...o, [s.key]: !isOpen(s) }))}
                    aria-expanded={expanded}
                    aria-label={`${expanded ? 'Collapse' : 'Expand'} ${s.label}`}
                    className="ml-0.5 rounded p-1.5 text-nav-text hover:bg-nav-soft hover:text-white"
                  >
                    <IconChevron className={`h-[12px] w-[12px] transition-transform ${expanded ? 'rotate-90' : ''}`} />
                  </button>
                )}
              </div>

              {expanded && s.children && (
                <div className="mb-1 ml-[19px] border-l border-[#39404b] pl-2">
                  {s.children.map((c) => {
                    const childOn = pathname === c.href || pathname.startsWith(c.href + '/');
                    const childCount = c.count ? counts[c.count] : 0;
                    return (
                      <Link
                        key={c.href}
                        href={c.href}
                        title={c.hint}
                        aria-current={childOn ? 'page' : undefined}
                        className={`flex items-center gap-2 rounded px-2.5 py-[7px] text-[12.5px] ${
                          childOn ? 'font-semibold text-white' : 'text-nav-text hover:text-white'
                        }`}
                      >
                        <span className="truncate">{c.label}</span>
                        {childCount > 0 && (
                          <span className="ml-auto rounded bg-brand px-1.5 py-0.5 text-[10px] font-bold text-white">
                            {childCount}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="shrink-0 border-t border-[#2f353f] px-2 py-2">
        <Link
          href="/settings/notifications"
          title={collapsed ? 'Notifications' : undefined}
          className="flex items-center gap-3 rounded px-2.5 py-2 text-[13px] text-nav-text hover:bg-nav-soft hover:text-white"
        >
          <span className="relative shrink-0">
            <IconBell className="h-[17px] w-[17px]" />
            {collapsed && counts.notifications > 0 && (
              <span className="absolute -right-1.5 -top-1.5 h-[7px] w-[7px] rounded-full bg-brand" />
            )}
          </span>
          {!collapsed && (
            <>
              <span>Notifications</span>
              {counts.notifications > 0 && (
                <span className="ml-auto rounded bg-brand px-1.5 py-0.5 text-[10.5px] font-bold text-white">
                  {counts.notifications}
                </span>
              )}
            </>
          )}
        </Link>

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            title={collapsed ? user.name : undefined}
            className="flex w-full items-center gap-2.5 rounded px-2 py-2 text-left text-nav-text hover:bg-nav-soft"
          >
            <span className="flex h-[28px] w-[28px] shrink-0 items-center justify-center rounded-full bg-brand text-[11.5px] font-semibold text-white">
              {initials}
            </span>
            {!collapsed && (
              <>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px] font-medium text-white">{user.name}</span>
                  <span className="block truncate text-[11px]">{orgName}</span>
                </span>
                <IconChevron className={`h-[12px] w-[12px] shrink-0 ${menuOpen ? 'rotate-90' : '-rotate-90'}`} />
              </>
            )}
          </button>

          {menuOpen && (
            <div
              role="menu"
              className="absolute bottom-[calc(100%+6px)] left-0 z-50 w-[218px] overflow-hidden rounded-md border border-line bg-white shadow-lg"
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

        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
          className="mt-1 flex w-full items-center gap-3 rounded px-2.5 py-1.5 text-[12px] text-nav-text hover:bg-nav-soft hover:text-white"
        >
          <IconChevron className={`h-[13px] w-[13px] shrink-0 ${collapsed ? '' : 'rotate-180'}`} />
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </div>
  );

  return (
    <>
      <aside className="sticky top-0 hidden h-screen shrink-0 lg:block">{rail}</aside>

      {/* small screens: a bar that opens the same rail as a drawer */}
      <div className="sticky top-0 z-40 flex h-[54px] items-center gap-3 bg-nav px-4 lg:hidden">
        <button
          type="button"
          onClick={() => setDrawer(true)}
          aria-label="Open navigation"
          className="rounded p-1.5 text-nav-text hover:bg-nav-soft hover:text-white"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
          </svg>
        </button>
        <Link href="/" className="flex items-center gap-2">
          <Logo className="h-[22px] w-[22px]" />
          <span className="text-[16px] font-semibold text-white">Insurhelp</span>
        </Link>
      </div>

      {drawer && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="h-full">{rail}</div>
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setDrawer(false)}
            className="flex-1 bg-black/40"
          />
        </div>
      )}
    </>
  );
}
