/**
 * Nineteen flat menu entries is a filing cabinet, not navigation. These group
 * into eight sections a person can hold in their head, with the detail moving
 * to a contextual second row that only appears where there is more than one
 * screen underneath.
 */
export type NavChild = { href: string; label: string; hint?: string };
export type NavSection = { key: string; href: string; label: string; children?: NavChild[] };

export const NAV: NavSection[] = [
  { key: 'overview', href: '/', label: 'Overview' },
  {
    key: 'clients',
    href: '/clients',
    label: 'Clients',
    children: [
      { href: '/clients', label: 'All clients', hint: 'Individuals and companies' },
      { href: '/client-groups', label: 'Groups', hint: 'Fleets, families, affinity blocks' },
      { href: '/client-planning', label: 'Life planning', hint: 'Plans held alongside the general book' },
    ],
  },
  {
    key: 'policies',
    href: '/insurance/general-motor',
    label: 'Policies',
    children: [
      { href: '/insurance/general-motor', label: 'Motor', hint: 'Private car, commercial, motorcycle' },
      { href: '/insurance/non-motor', label: 'Non-motor', hint: 'Fire, PA, medical, liability' },
      { href: '/insurance/quotations', label: 'Quotations', hint: 'Quote pipeline' },
      { href: '/insurance/endorsement', label: 'Employee benefits', hint: 'Group schemes' },
    ],
  },
  { key: 'renewals', href: '/insurance/renewals', label: 'Renewals' },
  {
    key: 'accounts',
    href: '/accounting',
    label: 'Accounts',
    children: [
      { href: '/accounting', label: 'Commission payout', hint: 'Approve and pay agents' },
      { href: '/insurance/reconcile', label: 'Reconcile', hint: 'Receivable against payable' },
    ],
  },
  { key: 'reports', href: '/reports', label: 'Reports' },
  {
    key: 'team',
    href: '/team',
    label: 'Team',
    children: [
      { href: '/team', label: 'Agents', hint: 'Downline and commission structure' },
      { href: '/organisation', label: 'Organisation', hint: 'Company profile and billing identity' },
    ],
  },
  {
    key: 'settings',
    href: '/settings',
    label: 'Settings',
    children: [
      { href: '/settings', label: 'Your profile', hint: 'e-Invoice identity and password' },
      { href: '/settings/global', label: 'Rates and insurers', hint: 'Commission rates, principals' },
      { href: '/settings/renewal', label: 'Renewal reminders', hint: 'When notices go out' },
      { href: '/settings/notifications', label: 'Broadcasts', hint: 'Scheduled messages' },
    ],
  },
];

/** The section a path belongs to, for highlighting the primary row. */
export function sectionFor(pathname: string): NavSection | undefined {
  if (pathname === '/') return NAV[0];

  let best: NavSection | undefined;
  let bestLen = 0;

  for (const s of NAV) {
    const candidates = [s.href, ...(s.children ?? []).map((c) => c.href)];
    for (const href of candidates) {
      if (href === '/') continue;
      if ((pathname === href || pathname.startsWith(href + '/')) && href.length > bestLen) {
        best = s;
        bestLen = href.length;
      }
    }
  }
  return best;
}
