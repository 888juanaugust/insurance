/**
 * Nineteen flat menu entries is a filing cabinet, not navigation. These group
 * into eight sections a person can hold in their head, with the detail moving
 * to a contextual second row that only appears where there is more than one
 * screen underneath.
 */
export type NavChild = { href: string; label: string; hint?: string; count?: CountKey };
export type NavSection = {
  key: string;
  href: string;
  label: string;
  icon: IconKey;
  children?: NavChild[];
  /** Rolls the children's counts up onto the section when collapsed. */
  count?: CountKey;
};

/** Which live figure, if any, this entry carries. */
export type CountKey = 'renewals' | 'accounts' | 'quotations' | 'claims' | 'endorsements';

export type IconKey =
  | 'overview' | 'clients' | 'policies' | 'renewals'
  | 'accounts' | 'reports' | 'team' | 'settings';

export const NAV: NavSection[] = [
  { key: 'overview', href: '/', label: 'Overview', icon: 'overview' },
  {
    key: 'clients',
    href: '/clients',
    label: 'Clients',
    icon: 'clients',
    children: [
      { href: '/clients', label: 'All clients', hint: 'Individuals and companies' },
      { href: '/import', label: 'Import', hint: 'Bring a book across from a spreadsheet' },
      { href: '/client-groups', label: 'Groups', hint: 'Fleets, families, affinity blocks' },
      { href: '/client-planning', label: 'Life planning', hint: 'Plans held alongside the general book' },
    ],
  },
  {
    key: 'policies',
    href: '/insurance/general-motor',
    label: 'Policies',
    icon: 'policies',
    count: 'quotations',
    children: [
      { href: '/insurance/general-motor', label: 'Motor', hint: 'Private car, commercial, motorcycle' },
      { href: '/insurance/non-motor', label: 'Non-motor', hint: 'Fire, PA, medical, liability' },
      { href: '/insurance/quotations', label: 'Quotations', hint: 'Quote pipeline', count: 'quotations' },
      { href: '/claims', label: 'Claims', hint: 'From the first call to settlement', count: 'claims' },
      { href: '/endorsements', label: 'Endorsements', hint: 'Mid-term changes to cover', count: 'endorsements' },
      { href: '/insurance/endorsement', label: 'Employee benefits', hint: 'Group schemes' },
    ],
  },
  {
    key: 'renewals',
    href: '/insurance/renewals',
    label: 'Renewals',
    icon: 'renewals',
    count: 'renewals',
    children: [
      { href: '/insurance/renewals', label: 'Due and expiring', hint: 'What needs working', count: 'renewals' },
      { href: '/renewals/notices', label: 'Notices', hint: 'What is going out to clients' },
      { href: '/reports/retention', label: 'Retention', hint: 'What was kept, and what walked' },
    ],
  },
  {
    key: 'accounts',
    href: '/accounting',
    label: 'Accounts',
    icon: 'accounts',
    count: 'accounts',
    children: [
      { href: '/accounting', label: 'Commission payout', hint: 'Approve and pay agents', count: 'accounts' },
      { href: '/accounting/statements', label: 'Insurer statements', hint: 'What each insurer actually paid' },
      { href: '/insurance/reconcile', label: 'Reconcile', hint: 'Receivable against payable' },
    ],
  },
  { key: 'reports', href: '/reports', label: 'Reports', icon: 'reports' },
  {
    key: 'team',
    href: '/team',
    label: 'Team',
    icon: 'team',
    children: [
      { href: '/team', label: 'Agents', hint: 'Downline and commission structure' },
      { href: '/organisation', label: 'Organisation', hint: 'Company profile and billing identity' },
    ],
  },
  {
    key: 'settings',
    href: '/settings',
    label: 'Settings',
    icon: 'settings',
    children: [
      { href: '/settings', label: 'Your profile', hint: 'e-Invoice identity and password' },
      { href: '/settings/global', label: 'Rates and insurers', hint: 'Commission rates, principals' },
      { href: '/settings/renewal', label: 'Renewal reminders', hint: 'When notices go out' },
      { href: '/settings/notifications', label: 'Broadcasts', hint: 'Scheduled messages' },
      { href: '/audit', label: 'Audit trail', hint: 'Who changed what' },
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
