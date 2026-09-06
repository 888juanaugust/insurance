import { cookies } from 'next/headers';
import { getDb } from './db';
import { issueSession, resolveSession, revokeSession, revokeSessionsFor } from './session-store';
import { requestAgency } from './tenant';

/**
 * The agency's session cookie.
 *
 * The cookie holds a random token and nothing else; what it means is a row
 * in the session table (see session-store.ts), which is what expires and what
 * gets deleted. In production the cookie is `Secure` and carries the
 * `__Host-` prefix, so a browser will neither send it over plain HTTP nor
 * accept one set from any other host or path. The prefix is only honoured on
 * a secure cookie, which is why development uses the plain name.
 */
const SECURE = process.env.NODE_ENV === 'production';
export const COOKIE = SECURE ? '__Host-ih_session' : 'ih_session';
const TTL_SECONDS = 60 * 60 * 8;

export type SessionUser = {
  id: string;
  org_id: string;
  email: string;
  name: string;
  role: string;
  agent_code: string | null;
};

export async function createSession(userId: string, orgId: string, ip: string | null) {
  const token = issueSession('staff', userId, orgId, TTL_SECONDS, ip);
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    secure: SECURE,
    sameSite: 'lax',
    path: '/',
    maxAge: TTL_SECONDS,
  });
}

/** Ends this session on the server and forgets the cookie. */
export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) revokeSession(token);
  jar.delete(COOKIE);
}

/** The token in hand, so a password change can spare the session that made it. */
export async function currentSessionToken(): Promise<string | undefined> {
  const jar = await cookies();
  return jar.get(COOKIE)?.value;
}

/** Ends every other session this user holds — after a password change. */
export async function revokeOtherSessions(userId: string) {
  revokeSessionsFor('staff', userId, await currentSessionToken());
}

/** Ends every session an account holds — when it is disabled or reset. */
export function revokeAllSessions(userId: string) {
  revokeSessionsFor('staff', userId);
}

export async function currentUser(): Promise<SessionUser | null> {
  /*
   * The agency comes first: which database this session is even in depends on
   * it. An address that names no agency, or an agency that does not exist, is
   * nobody signed in — the sign-in page then says which of the two it is.
   */
  const resolved = await requestAgency();
  if (!resolved.ok && resolved.reason !== 'single-tenant') return null;

  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  const session = resolveSession('staff', token);
  if (!session) return null;
  // The account is read every time rather than trusted from the session, so
  // a disabled account stops at its next request.
  const row = getDb()
    .prepare('SELECT id, org_id, email, name, role, agent_code FROM app_user WHERE id = ? AND status = ?')
    .get(session.subject_id, 'active') as SessionUser | undefined;
  return row ?? null;
}
