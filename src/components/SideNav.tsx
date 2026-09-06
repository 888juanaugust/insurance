'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { NAV, sectionFor, type CountKey, type IconKey, type NavSection } from '@/lib/nav';
import {
  Logo, IconHome, IconClients, IconShield, IconClipboard, IconAccounting,
  IconReports, IconUsers, IconSetting, IconChevron, IconUpload,
} from './icons';
import GlobalSearch from './GlobalSearch';
import UserMenu from './UserMenu';
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
  upload: IconUpload,
};

const COLLAPSE_KEY = 'insurhelp:nav-collapsed';

export type NavCounts = Record<CountKey, number> & { notifications: number };

/** Which child of a section the current path belongs to, if any. */
function activeChild(pathname: string, children: { href: string }[]): string | null {
  let best: string | null = null;
  for (const c of children) {
    if ((pathname === c.href || pathname.startsWith(c.href + '/')) && c.href.length > (best?.length ?? 0)) {
      best = c.href;
    }
  }
  return best;
}

/**
 * The rail. White, like every other surface, and collapsible to icons. It
 * carries the sections and the search and nothing else: who is signed in
 * and their notifications live in the top bar, where the design puts them,
 * so the rail is only ever a list of places to go.
 *
 * On small screens the shell renders this same component inside a drawer;
 * `drawer` and `onCloseDrawer` are how the shell drives that.
 */
export default function SideNav({
  counts,
  user,
  orgName,
  logout,
  drawer = false,
  onCloseDrawer,
}: {
  counts: NavCounts;
  user: SessionUser;
  orgName: string;
  logout: () => Promise<void>;
  drawer?: boolean;
  onCloseDrawer?: () => void;
}) {
  const pathname = usePathname();
  const active = sectionFor(pathname);

  const [collapsed, setCollapsed] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>({});

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
    onCloseDrawer?.();
    // The shell owns the drawer; this only asks it to shut on navigation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  /** Expanded when explicitly opened, or when it holds the current page. */
  const isOpen = (s: NavSection) => open[s.key] ?? active?.key === s.key;

  // In the drawer the rail is always at full width; collapsing is a desktop
  // convenience that would leave a phone with a column of unlabelled icons.
  const narrow = collapsed && !drawer;

  const rail = (
    <div
      className={`flex h-full flex-col border-r border-line bg-nav ${
        narrow ? 'w-[64px]' : 'w-[244px]'
      } transition-[width] duration-150`}
    >
      <div className="flex h-[56px] shrink-0 items-center gap-2.5 border-b border-line px-4">
        <Link href="/" className="flex items-center gap-2.5 overflow-hidden">
          <Logo className="h-[26px] w-[26px] shrink-0" />
          {!narrow && (
            <span className="truncate text-[17px] font-bold tracking-tight text-ink">Insurhelp</span>
          )}
        </Link>
      </div>

      <GlobalSearch collapsed={narrow} />

      <nav aria-label="Sections" className="flex-1 overflow-y-auto px-2 pb-3">
        {NAV.map((s) => {
          const Icon = ICONS[s.icon];
          const on = active?.key === s.key;
          const sectionCount = s.count ? counts[s.count] : 0;
          const expandable = Boolean(s.children);
          const expanded = expandable && isOpen(s) && !narrow;

          /*
           * The one entry that starts work rather than listing it. A rail
           * where every row looks the same is a filing cabinet; putting a
           * policy in is the thing an agent came here to do, so it looks
           * like a button and not like a folder.
           */
          if (s.primary) {
            return (
              <Link
                key={s.key}
                href={s.href}
                title={narrow ? s.label : undefined}
                aria-current={on ? 'page' : undefined}
                className={`mb-2 mt-0.5 flex items-center gap-3 rounded-xl bg-brand px-2.5 py-2 text-[13.5px] font-semibold text-white hover:bg-brand-dark ${
                  narrow ? 'justify-center' : ''
                }`}
              >
                <Icon className="h-[17px] w-[17px] shrink-0" />
                {!narrow && <span className="truncate">{s.label}</span>}
              </Link>
            );
          }

          return (
            <div key={s.key} className="mb-0.5">
              <div className="group relative flex items-center">
                <Link
                  href={s.href}
                  title={narrow ? s.label : undefined}
                  aria-current={on ? 'page' : undefined}
                  className={`flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2.5 py-2 text-[13.5px] ${
                    on ? 'bg-nav-soft font-semibold text-brand' : 'text-nav-text hover:bg-sunken hover:text-ink'
                  }`}
                >
                  <span className="relative shrink-0">
                    <Icon className="h-[17px] w-[17px]" />
                    {narrow && sectionCount > 0 && (
                      <span className="absolute -right-1.5 -top-1.5 h-[7px] w-[7px] rounded-full bg-brand" />
                    )}
                  </span>
                  {!narrow && <span className="truncate">{s.label}</span>}
                  {!narrow && sectionCount > 0 && !expanded && (
                    <span className="ml-auto rounded-md bg-brand px-1.5 py-0.5 text-[10.5px] font-bold text-white">
                      {sectionCount}
                    </span>
                  )}
                </Link>

                {expandable && !narrow && (
                  <button
                    type="button"
                    onClick={() => setOpen((o) => ({ ...o, [s.key]: !isOpen(s) }))}
                    aria-expanded={expanded}
                    aria-label={`${expanded ? 'Collapse' : 'Expand'} ${s.label}`}
                    className="ml-0.5 rounded-lg p-1.5 text-muted hover:bg-sunken hover:text-ink"
                  >
                    <IconChevron className={`h-[12px] w-[12px] transition-transform ${expanded ? 'rotate-90' : ''}`} />
                  </button>
                )}
              </div>

              {expanded && s.children && (
                <div className="mb-1 ml-[19px] border-l border-line pl-2">
                  {s.children.map((c) => {
                    /* Longest match, not any match: /accounting/statements sits
                       under /accounting, and a plain prefix test lights up both
                       entries at once. */
                    const childOn = activeChild(pathname, s.children!) === c.href;
                    const childCount = c.count ? counts[c.count] : 0;
                    return (
                      <Link
                        key={c.href}
                        href={c.href}
                        title={c.hint}
                        aria-current={childOn ? 'page' : undefined}
                        className={`flex items-center gap-2 rounded-lg px-2.5 py-[7px] text-[12.5px] ${
                          childOn ? 'font-semibold text-brand' : 'text-nav-text hover:text-ink'
                        }`}
                      >
                        <span className="truncate">{c.label}</span>
                        {childCount > 0 && (
                          <span className="ml-auto rounded-md bg-brand px-1.5 py-0.5 text-[10px] font-bold text-white">
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

      <div className="shrink-0 border-t border-line px-2 py-2">
        <UserMenu user={user} orgName={orgName} logout={logout} collapsed={narrow} />
        {!drawer && (
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label={narrow ? 'Expand navigation' : 'Collapse navigation'}
            className="mt-1 flex w-full items-center gap-3 rounded-lg px-2.5 py-1.5 text-[12px] text-muted hover:bg-sunken hover:text-ink"
          >
            <IconChevron className={`h-[13px] w-[13px] shrink-0 ${narrow ? '' : 'rotate-180'}`} />
            {!narrow && <span>Collapse</span>}
          </button>
        )}
      </div>
    </div>
  );

  if (drawer) return rail;

  return <aside className="sticky top-0 hidden h-screen shrink-0 lg:block">{rail}</aside>;
}
