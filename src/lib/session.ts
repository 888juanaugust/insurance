import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { getDb } from './db';

const COOKIE = 'simsuite_session';
const SECRET = process.env.SIMSUITE_SECRET ?? 'simsuite-dev-secret-change-me';

export type SessionUser = {
  id: string;
  org_id: string;
  email: string;
  name: string;
  role: string;
  agent_code: string | null;
};

function sign(value: string): string {
  const mac = crypto.createHmac('sha256', SECRET).update(value).digest('hex');
  return `${value}.${mac}`;
}

function unsign(signed: string): string | null {
  const idx = signed.lastIndexOf('.');
  if (idx < 0) return null;
  const value = signed.slice(0, idx);
  const mac = signed.slice(idx + 1);
  const expected = crypto.createHmac('sha256', SECRET).update(value).digest('hex');
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
