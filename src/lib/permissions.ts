/**
 * One role: admin. Everyone who can sign in to the agency application can do
 * everything in it.
 *
 * The check is kept rather than removed, because it still decides one real
 * thing: an account whose role is anything else grants nothing. That covers a
 * stale row, a hand-edited database, and the `client` role the unbuilt portal
 * would use — none of which should reach the agency screens. It fails closed,
 * which is the only sensible direction for a default.
 *
 * Bringing graded roles back means widening `isAdmin` into a permission
 * lookup and giving `authorise` a permission argument again; every mutation
 * already routes through it, so nothing else has to move.
 */

export const ADMIN = 'admin';

export function isAdmin(role: string): boolean {
  return role === ADMIN;
}

export const ROLE_LABEL = 'Administrator';

export const ROLE_DESCRIPTION =
  'Full access to clients, policies, renewals, collections, commission, sub agents, ' +
  'organisation settings and the audit trail.';

export const ACCESS_DENIED =
  'This account is not an administrator, so it cannot use the agency application. ' +
  'Ask whoever set the account up to check its role.';
