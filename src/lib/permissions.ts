/**
 * Who may do what.
 *
 * The split follows how a small Malaysian agency actually divides work, not a
 * generic admin/user ladder. The rule doing the most work here is that an
 * agent cannot approve or pay their own commission — they are paid by it, so
 * the approval has to come from someone else. Everything else falls out of
 * that same idea: the person who writes the business is not the person who
 * settles the money, and neither of them changes the commission rates.
 */

export const ROLES = ['master', 'manager', 'finance', 'agent', 'viewer'] as const;
export type Role = (typeof ROLES)[number];

export const PERMISSIONS = [
  'client.view', 'client.write', 'client.delete',
  'policy.view', 'policy.write', 'policy.delete',
  'payment.record',
  'commission.approve', 'commission.pay',
  'agent.view', 'agent.write', 'agent.delete',
  'renewal.process',
  'report.view',
  'org.settings', 'rates.write',
  'user.manage', 'audit.view',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const VIEWER: Permission[] = ['client.view', 'policy.view', 'agent.view', 'report.view'];

const AGENT: Permission[] = [
  ...VIEWER,
  'client.write',
  'policy.write',
  'renewal.process',
  // Collections from clients are taken at the counter by whoever wrote the
  // policy, so recording one is part of the job.
  'payment.record',
];

const FINANCE: Permission[] = [
  ...VIEWER,
  'payment.record',
  'commission.approve',
  'commission.pay',
];

const MANAGER: Permission[] = [
  ...AGENT,
  'client.delete',
  'policy.delete',
  'agent.write',
  // A manager writes no business of their own, so approving commission is not
  // self-approval. Paying it out stays with finance.
  'commission.approve',
];

const MASTER: Permission[] = [
  ...new Set<Permission>([
    ...MANAGER, ...FINANCE,
    'agent.delete', 'org.settings', 'rates.write', 'user.manage', 'audit.view',
  ]),
];

const GRANTS: Record<Role, ReadonlySet<Permission>> = {
  master: new Set(MASTER),
  manager: new Set(MANAGER),
  finance: new Set(FINANCE),
  agent: new Set(AGENT),
  viewer: new Set(VIEWER),
};

export const ROLE_LABEL: Record<Role, string> = {
  master: 'Master',
  manager: 'Manager',
  finance: 'Finance',
  agent: 'Agent',
  viewer: 'Viewer',
};

export const ROLE_DESCRIPTION: Record<Role, string> = {
  master:
    'The agency principal. Everything, including organisation particulars, commission rates, user roles and the audit trail.',
  manager:
    'Runs the book: clients, policies, renewals and sub agents, and approves commission. Cannot change organisation settings or rates.',
  finance:
    'The money side: records collections and remittances, approves and pays commission. Writes no policies.',
  agent:
    'Writes and services business: clients, policies, renewals and client collections. Cannot approve commission — they are paid by it.',
  viewer:
    'Reads the registers and reports. Changes nothing.',
};

/** An unknown role grants nothing, so a typo in the table cannot open a door. */
export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

export function can(role: string, permission: Permission): boolean {
  return isRole(role) ? GRANTS[role].has(permission) : false;
}

export function permissionsOf(role: string): Permission[] {
  return isRole(role) ? [...GRANTS[role]] : [];
}

/** What to tell someone who is refused, in terms of the job rather than the flag. */
export const DENIAL: Record<Permission, string> = {
  'client.view': 'view clients',
  'client.write': 'add or edit clients',
  'client.delete': 'delete clients',
  'policy.view': 'view policies',
  'policy.write': 'add or edit policies',
  'policy.delete': 'delete policies',
  'payment.record': 'record payments',
  'commission.approve': 'approve commission',
  'commission.pay': 'pay commission out',
  'agent.view': 'view sub agents',
  'agent.write': 'add or edit sub agents',
  'agent.delete': 'delete sub agents',
  'renewal.process': 'process renewals',
  'report.view': 'view reports',
  'org.settings': 'change organisation settings',
  'rates.write': 'change commission rates',
  'user.manage': 'change user roles',
  'audit.view': 'read the audit trail',
};

export function denialMessage(role: string, permission: Permission): string {
  const label = isRole(role) ? ROLE_LABEL[role] : role;
  return `Your role (${label}) cannot ${DENIAL[permission]}. Ask a Master user if this is wrong.`;
}
