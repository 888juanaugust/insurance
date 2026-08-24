/**
 * What an insurance agent does on a Tuesday, and everything else.
 *
 * This started as nineteen flat entries, then became eight sections of
 * roughly equal weight — which reads as an ERP, because a menu that gives
 * commission reconciliation the same standing as "find my client's policy"
 * is telling you they matter equally. They do not.
 *
 * Four things are the job: put a policy in, find one, see what is running
 * out, look after the clients. Those are the rail. Everything under them is
 * real and stays reachable — an agency does have to approve commission and
 * check a statement — but it lives under More, where it does not stand
 * between an agent and the work.
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
  /** Set on the one entry that starts a piece of work rather than listing it. */
  primary?: boolean;
};

/** Which live figure, if any, this entry carries. */
export type CountKey = 'expiring' | 'renewals' | 'accounts' | 'quotations' | 'claims' | 'endorsements';

export type IconKey =
  | 'overview' | 'clients' | 'policies' | 'renewals'
  | 'accounts' | 'reports' | 'team' | 'settings' | 'upload';

export const NAV: NavSection[] = [
  { key: 'overview', href: '/', label: 'Home', icon: 'overview' },
  {
    key: 'upload',
    href: '/insurance/general-motor/upload',
    label: 'Add a policy',
    icon: 'upload',
    primary: true,
  },
  {
    key: 'policies',
    href: '/insurance/general-motor',
    label: 'Policies',
    icon: 'policies',
    children: [
      { href: '/insurance/general-motor', label: 'Motor', hint: 'Private car, commercial, motorcycle' },
      { href: '/insurance/non-motor', label: 'Non-motor', hint: 'Fire, PA, medical, liability' },
      { href: '/insurance/quotations', label: 'Quotations', hint: 'Quotes not yet taken up', count: 'quotations' },
    ],
  },
  {
    key: 'expiring',
    href: '/expiring',
    label: 'Expiring soon',
    icon: 'renewals',
    count: 'expiring',
  },
  {
    key: 'clients',
    href: '/clients',
    label: 'Clients',
    icon: 'clients',
    children: [
      { href: '/clients', label: 'All clients', hint: 'Individuals and companies' },
      { href: '/client-groups', label: 'Groups', hint: 'Fleets, families, affinity blocks' },
      { href: '/client-planning', label: 'Life planning', hint: 'Plans held alongside the general book' },
      { href: '/import', label: 'Import', hint: 'Bring a book across from a spreadsheet' },
    ],
  },
  {
    key: 'more',
    href: '/more',
    label: 'More',
    icon: 'settings',
    children: [
      { href: '/claims', label: 'Claims', hint: 'From the first call to settlement', count: 'claims' },
      { href: '/endorsements', label: 'Endorsements', hint: 'Mid-term changes to cover', count: 'endorsements' },
      { href: '/insurance/renewals', label: 'Renewal requests', hint: 'What clients have asked for', count: 'renewals' },
      { href: '/renewals/notices', label: 'Notices', hint: 'What is going out to clients' },
      { href: '/accounting', label: 'Accounts', hint: 'Commission, payouts and insurer statements', count: 'accounts' },
      { href: '/reports', label: 'Reports', hint: 'Production, retention, outstanding premium' },
      { href: '/team', label: 'Team and agency', hint: 'Sub agents, company profile' },
      { href: '/settings', label: 'Settings', hint: 'Your profile, rates, reminders, audit trail' },
    ],
  },
];

/**
 * Everything that is not on the rail, for the More page to list. Kept beside
 * NAV rather than derived from it: a screen that exists but appears in no
 * menu is one nobody finds, and this is the list that proves none do.
 */
export type MoreGroup = { title: string; note: string; links: NavChild[] };

export const MORE: MoreGroup[] = [
  {
    title: 'Cover that changes',
    note: 'What happens to a policy after it is written.',
    links: [
      { href: '/claims', label: 'Claims', hint: 'Motor and non-motor, first call to settlement', count: 'claims' },
      { href: '/endorsements', label: 'Endorsements', hint: 'Mid-term changes, with the premium worked out', count: 'endorsements' },
      { href: '/insurance/renewals', label: 'Renewal requests', hint: 'Raised from Home, the portal and the scheduler', count: 'renewals' },
      { href: '/renewals/notices', label: 'Renewal notices', hint: 'The outbox of reminders to clients' },
      { href: '/insurance/endorsement', label: 'Employee benefits', hint: 'Group schemes' },
    ],
  },
  {
    title: 'Money',
    note: 'What the agency is owed, and what it owes.',
    links: [
      { href: '/accounting', label: 'Commission payout', hint: 'Approve and pay sub agents', count: 'accounts' },
      { href: '/accounting/statements', label: 'Insurer statements', hint: 'What each insurer actually paid' },
      { href: '/insurance/reconcile', label: 'Receivable and payable', hint: 'Client collection against insurer remittance' },
    ],
  },
  {
    title: 'How the book is doing',
    note: 'Nothing here needs doing today.',
    links: [
      { href: '/reports/monthly-sales', label: 'Monthly sales', hint: 'Cases and premium by month' },
      { href: '/reports/retention', label: 'Retention', hint: 'What was kept, and what walked' },
      { href: '/reports/outstanding-premium', label: 'Outstanding premium', hint: 'Ageing of what clients owe' },
      { href: '/reports/agent-commission', label: 'Agent commission', hint: 'Per sub agent' },
      { href: '/reports/company-commission', label: 'Company commission', hint: 'Per insurer and class' },
    ],
  },
  {
    title: 'The agency itself',
    note: 'Set once, changed rarely.',
    links: [
      { href: '/team', label: 'Sub agents', hint: 'Downline and commission structure' },
      { href: '/organisation', label: 'Company profile', hint: 'Letterhead, billing identity, subscription' },
      { href: '/settings', label: 'Your profile', hint: 'e-Invoice identity and password' },
      { href: '/settings/global', label: 'Rates and insurers', hint: 'Commission rates per insurer and class' },
      { href: '/settings/renewal', label: 'Renewal reminders', hint: 'When notices go out, and what they say' },
      { href: '/settings/notifications', label: 'Broadcasts', hint: 'Scheduled messages' },
      { href: '/audit', label: 'Audit trail', hint: 'Who changed what' },
      { href: '/user-guide', label: 'User guide', hint: 'What each screen is for' },
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

  /*
   * Everything reachable from the More page belongs to More, even where no
   * rail entry names it — otherwise walking to /reports/retention lights up
   * nothing and the rail looks broken.
   */
  if (!best) {
    const under = MORE.flatMap((g) => g.links).some(
      (l) => pathname === l.href || pathname.startsWith(l.href + '/'),
    );
    if (under) return NAV.find((s) => s.key === 'more');
  }
  return best;
}
