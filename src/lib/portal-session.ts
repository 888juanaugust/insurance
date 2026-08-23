import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { getDb } from './db';

/**
 * The client portal's own session, deliberately separate from the agency's.
 *
 * Different cookie, and the signed payload carries a `portal:` purpose so an
 * agency cookie cannot be pasted in as a portal one or the reverse — the two
 * share a secret, and without a purpose in the signed value a valid signature
 * from one surface would be a valid signature for the other.
 */
const COOKIE = 'ih_portal';
const PURPOSE = 'portal';

function sessionSecret(): string {
  const configured = process.env.IH_SECRET;
  if (configured && configured.length >= 16) return configured;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('IH_SECRET is not set. See src/instrumentation.ts.');
  }
  return 'insurhelp-dev-secret-change-me';
}

function sign(value: string): string {
  const payload = `${PURPOSE}:${value}`;
  const mac = crypto.createHmac('sha256', sessionSecret()).update(payload).digest('hex');
  return `${payload}.${mac}`;
}

function unsign(signed: string): string | null {
  const idx = signed.lastIndexOf('.');
  if (idx < 0) return null;
  const payload = signed.slice(0, idx);
  const mac = signed.slice(idx + 1);
  const expected = crypto.createHmac('sha256', sessionSecret()).update(payload).digest('hex');
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  if (!payload.startsWith(`${PURPOSE}:`)) return null;
  return payload.slice(PURPOSE.length + 1);
}

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

export async function createPortalSession(clientId: string) {
  const jar = await cookies();
  jar.set(COOKIE, sign(clientId), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    // Shorter than the agency's eight hours: a client signs in from a phone
    // that is more likely to be shared or left unlocked.
    maxAge: 60 * 60 * 2,
  });
}

export async function destroyPortalSession() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function currentPortalClient(): Promise<PortalClient | null> {
  const jar = await cookies();
  const raw = jar.get(COOKIE)?.value;
  if (!raw) return null;
  const clientId = unsign(raw);
  if (!clientId) return null;

  // Access being withdrawn takes effect on the next request, not at the next
  // sign-in: the row is read every time rather than trusted from the cookie.
  const row = getDb()
    .prepare(
      `SELECT id, org_id, name, client_type, nric, business_reg, email, phone
         FROM client WHERE id = ? AND portal_enabled = 1 AND portal_code_hash IS NOT NULL`,
    )
    .get(clientId) as PortalClient | undefined;
  return row ?? null;
}
