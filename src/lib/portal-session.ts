import { cookies } from 'next/headers';
import { getDb } from './db';
import { issueSession, resolveSession, revokeSession, revokeSessionsFor } from './session-store';
import { requestAgency } from './tenant';

/**
 * The client portal's own session, deliberately separate from the agency's.
 *
 * A different cookie and a different session kind: a portal token resolves
 * only through the portal lookup, so an agency session can never be pasted in
 * as a portal one or the reverse. Like the agency's, it is a row on the
 * server with an expiry; withdrawing or reissuing a client's code ends every
 * session they hold.
 */
const SECURE = process.env.NODE_ENV === 'production';
export const COOKIE = SECURE ? '__Host-ih_portal' : 'ih_portal';
// Shorter than the agency's eight hours: a client signs in from a phone that
// is more likely to be shared or left unlocked.
const TTL_SECONDS = 60 * 60 * 2;

export type PortalClient = {
  id: string;
  org_id: string;
  name: string;
  client_type: string;
  nric: string | null;
  business_reg: string | null;
  email: string | null;
  phone: string | null;
};

export async function createPortalSession(clientId: string, orgId: string, ip: string | null) {
  const token = issueSession('portal', clientId, orgId, TTL_SECONDS, ip);
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    secure: SECURE,
    sameSite: 'lax',
    path: '/',
    maxAge: TTL_SECONDS,
  });
}

export async function destroyPortalSession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) revokeSession(token);
  jar.delete(COOKIE);
}

/** Ends every portal session a client holds — when their code changes or goes. */
export function revokePortalSessions(clientId: string) {
  revokeSessionsFor('portal', clientId);
}

export async function currentPortalClient(): Promise<PortalClient | null> {
  const resolved = await requestAgency();
  if (!resolved.ok && resolved.reason !== 'single-tenant') return null;

  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  const session = resolveSession('portal', token);
  if (!session) return null;

  // Access being withdrawn takes effect on the next request, not at the next
  // sign-in: the row is read every time rather than trusted from the session.
  const row = getDb()
    .prepare(
      `SELECT id, org_id, name, client_type, nric, business_reg, email, phone
         FROM client WHERE id = ? AND portal_enabled = 1 AND portal_code_hash IS NOT NULL`,
    )
    .get(session.subject_id) as PortalClient | undefined;
  return row ?? null;
}
