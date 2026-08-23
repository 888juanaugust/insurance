/**
 * Nineteen flat menu entries is a filing cabinet, not navigation. These group
 * into eight sections a person can hold in their head, with the detail moving
 * to a contextual second row that only appears where there is more than one
 * screen underneath.
 */
import { can, type Permission } from './permissions';

export type NavChild = {
  href: string; label: string; hint?: string; count?: CountKey;
  /** Hidden from roles that lack it. Absent means everyone who can sign in. */
  needs?: Permission;
};
export type NavSection = {
  key: string;
  href: string;
  label: string;
  icon: IconKey;
  children?: NavChild[];
  /** Rolls the children's counts up onto the section when collapsed. */
  count?: CountKey;
  needs?: Permission;
};

/** Which live figure, if any, this entry carries. */
export type CountKey = 'renewals' | 'accounts' | 'quotations';

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
      { href: '/insurance/endorsement', label: 'Employee benefits', hint: 'Group schemes' },
    ],
  },
  { key: 'renewals', href: '/insurance/renewals', label: 'Renewals', icon: 'renewals', count: 'renewals' },
  {
    key: 'accounts',
    href: '/accounting',
    label: 'Accounts',
    icon: 'accounts',
    count: 'accounts',
    children: [
      { href: '/accounting', label: 'Commission payout', hint: 'Approve and pay agents', count: 'accounts' },
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
      { href: '/team/users', label: 'Users and roles', hint: 'Who may do what', needs: 'user.manage' },
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
      { href: '/audit', label: 'Audit trail', hint: 'Who changed what', needs: 'audit.view' },
    ],
  },
];

/**
 * The rail for one role. A destination that would only greet the person with
 * a refusal is not navigation, so it is dropped rather than shown and denied —
 * but this is presentation only. Every action checks the same permission on
 * the server, because a hidden link is not access control.
 */
export function navFor(role: string): NavSection[] {
  return NAV.filter((s) => !s.needs || can(role, s.needs)).map((s) => {
    if (!s.children) return s;
    const children = s.children.filter((c) => !c.needs || can(role, c.needs));
    return children.length ? { ...s, children } : { ...s, children: undefined };
  });
}

/** The section a path belongs to, for highlighting the primary row. */
export function sectionFor(pathname: string, sections: NavSection[] = NAV): NavSection | undefined {
  if (pathname === '/') return sections[0];

  let best: NavSection | undefined;
  let bestLen = 0;

  for (const s of sections) {
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
