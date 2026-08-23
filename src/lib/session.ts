import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { getDb } from './db';

const COOKIE = 'ih_session';

/**
 * The session cookie is only as good as this secret. A public deployment that
 * fell back to the development value would let anyone who has read this
 * repository mint a session for any user, so refuse to serve instead.
 *
 * Resolved per call rather than at import: `next build` runs with
 * NODE_ENV=production, and throwing there would fail the build on a machine
 * that has no business holding the production secret.
 */
function sessionSecret(): string {
  const configured = process.env.IH_SECRET;
  if (configured && configured.length >= 16) return configured;

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'IH_SECRET is not set, or is shorter than 16 characters. Set it to a long random ' +
        'value before starting Insurhelp in production — for example: openssl rand -hex 32',
    );
  }
  return 'insurhelp-dev-secret-change-me';
}

export type SessionUser = {
  id: string;
  org_id: string;
  email: string;
  name: string;
  role: string;
  agent_code: string | null;
};

function sign(value: string): string {
  const mac = crypto.createHmac('sha256', sessionSecret()).update(value).digest('hex');
  return `${value}.${mac}`;
}

function unsign(signed: string): string | null {
  const idx = signed.lastIndexOf('.');
  if (idx < 0) return null;
  const value = signed.slice(0, idx);
  const mac = signed.slice(idx + 1);
  const expected = crypto.createHmac('sha256', sessionSecret()).update(value).digest('hex');
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return value;
}

export async function createSession(userId: string) {
  const jar = await cookies();
  jar.set(COOKIE, sign(userId), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 8,
  });
}

export async function destroySession() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function currentUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const raw = jar.get(COOKIE)?.value;
  if (!raw) return null;
  const userId = unsign(raw);
  if (!userId) return null;
  const row = getDb()
    .prepare('SELECT id, org_id, email, name, role, agent_code FROM app_user WHERE id = ? AND status = ?')
    .get(userId, 'active') as SessionUser | undefined;
  return row ?? null;
}
