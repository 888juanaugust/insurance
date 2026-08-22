'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  IconHome, IconUsers, IconGlobe, IconClients, IconGroup, IconPlanning, IconShield,
  IconReports, IconAccounting, IconSetting, IconGuide, IconContact, IconLogout,
  IconChevron, Logo,
} from './icons';

type Item = {
  href: string;
  label: string;
  icon: (p: { className?: string }) => React.ReactElement;
  children?: { href: string; label: string }[];
};

const ITEMS: Item[] = [
  { href: '/', label: 'Home', icon: IconHome },
  { href: '/team', label: 'Sub Agents', icon: IconUsers },
  { href: '/organisation', label: 'Organisation', icon: IconGlobe },
  { href: '/clients', label: 'Clients', icon: IconClients },
  { href: '/client-groups', label: 'Grouping Client', icon: IconGroup },
  { href: '/client-planning', label: 'Client Planning (Life Insurance)', icon: IconPlanning },
  {
    href: '/insurance',
    label: 'Insurance',
    icon: IconShield,
    children: [
      { href: '/insurance/quotations', label: 'Quotations' },
      { href: '/insurance/general-motor', label: 'General Motor' },
      { href: '/insurance/non-motor', label: 'General Non-Motor' },
      { href: '/insurance/reconcile', label: 'Reconcile' },
      { href: '/insurance/renewals', label: 'Renewals' },
      { href: '/insurance/endorsement', label: 'Employee Benefits' },
    ],
  },
  { href: '/reports', label: 'Reports', icon: IconReports },
  { href: '/accounting', label: 'Accounting', icon: IconAccounting },
  { href: '/settings', label: 'Setting', icon: IconSetting },
  { href: '/user-guide', label: 'User Guide', icon: IconGuide },
  { href: '/contact-us', label: 'Contact Us', icon: IconContact },
];

export default function Sidebar({ logout }: { logout: () => Promise<void> }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [openInsurance, setOpenInsurance] = useState(pathname.startsWith('/insurance'));

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href + '/');

  return (
    <aside
      className={`relative flex shrink-0 flex-col border-r border-line bg-white transition-[width] duration-200 ${
        collapsed ? 'w-[62px]' : 'w-[218px]'
      }`}
    >
      <div className="flex h-[62px] items-center gap-2 px-4">
        <Logo className="h-7 w-7 shrink-0" />
        {!collapsed && <span className="truncate text-[19px] font-semibold tracking-tight">Sim Suite</span>}
      </div>

      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
        className="absolute right-[-11px] top-[92px] z-10 flex h-[22px] w-[22px] items-center justify-center rounded-full border border-line bg-white text-muted shadow-sm hover:text-ink"
      >
        <IconChevron className={`h-[13px] w-[13px] ${collapsed ? '' : 'rotate-180'}`} />
      </button>

      <nav className="flex-1 overflow-y-auto px-2 pb-4 pt-2">
        {ITEMS.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;

          if (item.children) {
            return (
              <div key={item.href}>
                <button
                  type="button"
                  onClick={() => setOpenInsurance((o) => !o)}
                  title={collapsed ? item.label : undefined}
                  className={`flex w-full items-center gap-3 rounded px-3 py-[9px] text-[13.5px] ${
                    active ? 'bg-[#f2f6fc] font-semibold text-accent' : 'text-ink-soft hover:bg-[#f6f7f9]'
                  }`}
                >
                  <Icon className="h-[17px] w-[17px] shrink-0" />
                  {!collapsed && (
                    <>
                      <span className="flex-1 truncate text-left">{item.label}</span>
                      <IconChevron className={`h-[13px] w-[13px] ${openInsurance ? 'rotate-90' : ''}`} />
                    </>
                  )}
                </button>
                {!collapsed && openInsurance && (
                  <div className="mb-1 ml-[30px] border-l border-line pl-2">
                    {item.children.map((c) => (
                      <Link
                        key={c.href}
                        href={c.href}
                        className={`block rounded px-3 py-[7px] text-[13px] ${
                          pathname === c.href || pathname.startsWith(c.href + '/')
                            ? 'font-semibold text-accent'
                            : 'text-ink-soft hover:bg-[#f6f7f9]'
                        }`}
                      >
                        {c.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={`flex items-center gap-3 rounded px-3 py-[9px] text-[13.5px] ${
                active ? 'bg-[#f2f6fc] font-semibold text-accent' : 'text-ink-soft hover:bg-[#f6f7f9]'
              }`}
            >
              <Icon className="h-[17px] w-[17px] shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}

        <form action={logout}>
          <button
            type="submit"
            title={collapsed ? 'Logout' : undefined}
            className="flex w-full items-center gap-3 rounded px-3 py-[9px] text-[13.5px] text-ink-soft hover:bg-[#f6f7f9]"
          >
            <IconLogout className="h-[17px] w-[17px] shrink-0" />
            {!collapsed && <span>Logout</span>}
          </button>
        </form>
      </nav>

      {!collapsed && (
        <div className="border-t border-line px-4 py-3 text-[11px] leading-relaxed text-muted">
          © 2026 Simplicity Consulting Sdn Bhd
          <div className="mt-1">
            <Link href="/terms-and-conditions" className="text-link hover:underline">Terms</Link>
            <span className="px-1 text-line">|</span>
            <Link href="/privacy-policy" className="text-link hover:underline">Privacy</Link>
          </div>
        </div>
      )}
    </aside>
  );
}
