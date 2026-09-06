'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { IconChevron, IconLogout, IconUser, IconSun, IconMoon, IconMonitor } from './icons';
import type { SessionUser } from '@/lib/session';

export type Theme = 'light' | 'dark' | 'system';
const THEME_KEY = 'insurhelp:theme';

/**
 * Applies the choice to the document.
 *
 * "System" means removing the attribute entirely rather than writing
 * data-theme="system": the stylesheet answers a machine set to dark through a
 * media query, and an attribute sitting on the root would have to be excluded
 * from every rule to let it through.
 */
function apply(theme: Theme) {
  const root = document.documentElement;
  if (theme === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', theme);
}

const CHOICES: Array<{ value: Theme; label: string; Icon: (p: { className?: string }) => React.ReactElement }> = [
  { value: 'light', label: 'Light', Icon: IconSun },
  { value: 'dark', label: 'Dark', Icon: IconMoon },
  { value: 'system', label: 'Match the computer', Icon: IconMonitor },
];

/**
 * Who is signed in, at the foot of the rail, opening upward.
 *
 * It sits here rather than in the top bar because it is not navigation and it
 * is not a task: it is the answer to "which account am I in", wanted rarely
 * and glanced at often, and the foot of the rail is where that belongs.
 */
export default function UserMenu({
  user, orgName, logout, collapsed,
}: {
  user: SessionUser;
  orgName: string;
  logout: () => Promise<void>;
  collapsed: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>('system');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(THEME_KEY) as Theme | null;
      if (saved === 'light' || saved === 'dark' || saved === 'system') setTheme(saved);
    } catch {
      /* storage unavailable — the inline script already settled on a look */
    }
  }, []);

  function choose(next: Theme) {
    setTheme(next);
    apply(next);
    try {
      window.localStorage.setItem(THEME_KEY, next);
    } catch {
      // The look changes for this page either way; only remembering it is lost.
    }
  }

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const initials = user.name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

  return (
    <div className="relative" ref={ref}>
      {open && (
        <div
          role="menu"
          className="absolute bottom-[calc(100%+8px)] left-0 z-50 w-[248px] overflow-hidden rounded-2xl border border-line bg-surface shadow-lg"
        >
          <Link
            href="/settings"
            role="menuitem"
            className="flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-ink-soft hover:bg-canvas"
          >
            <IconUser className="h-[16px] w-[16px]" />
            Profile
          </Link>

          <div
            role="group"
            aria-label="Appearance"
            className="flex gap-1 border-y border-line px-2 py-2"
          >
            {CHOICES.map(({ value, label, Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => choose(value)}
                aria-pressed={theme === value}
                title={label}
                aria-label={label}
                className={`flex flex-1 items-center justify-center rounded-lg py-1.5 ${
                  theme === value
                    ? 'bg-brand-wash text-brand'
                    : 'text-muted hover:bg-canvas hover:text-ink'
                }`}
              >
                <Icon className="h-[16px] w-[16px]" />
              </button>
            ))}
          </div>

          <form action={logout}>
            <button
              type="submit"
              role="menuitem"
              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-[13px] text-ink-soft hover:bg-brand-wash hover:text-brand"
            >
              <IconLogout className="h-[16px] w-[16px]" />
              Sign out
            </button>
          </form>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        title={collapsed ? `${user.name} · ${orgName}` : undefined}
        className={`flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left hover:bg-sunken ${
          collapsed ? 'justify-center' : ''
        }`}
      >
        <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-brand text-[11.5px] font-bold text-white">
          {initials}
        </span>
        {!collapsed && (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12.5px] font-semibold text-ink">{user.name}</span>
              <span className="block truncate text-[11px] text-muted">{orgName}</span>
            </span>
            <IconChevron className={`h-[12px] w-[12px] shrink-0 text-muted ${open ? 'rotate-90' : '-rotate-90'}`} />
          </>
        )}
      </button>
    </div>
  );
}

/**
 * Settles the look before the first paint.
 *
 * Without this the page renders light, then flips to dark once React has
 * mounted and read the stored choice — a white flash on every navigation for
 * anybody who chose dark. Inlined in the document head so it runs first.
 */
export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem('${THEME_KEY}');if(t==='light'||t==='dark'){document.documentElement.setAttribute('data-theme',t);}}catch(e){}})();`;
