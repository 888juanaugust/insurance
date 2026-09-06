import crypto from 'node:crypto';

/**
 * Password hashing.
 *
 * scrypt with explicit parameters — N=2^17, r=8, p=1, a 64-byte key — and
 * the parameters written into the stored value, so they can be raised later
 * and an old hash still verifies. A hash from before the parameters were
 * explicit carries the `scrypt:` prefix and verifies at the library defaults;
 * `needsRehash` says so, and the sign-in path replaces it the next time the
 * password is presented.
 *
 * The request paths use the asynchronous form, which runs the derivation off
 * the event loop: a synchronous scrypt at this cost stalls the single Node
 * process for a third of a second per attempt, which is exactly what a login
 * flood would want. The synchronous form exists for the seed, which runs once
 * with no request waiting.
 */
const KEYLEN = 64;
const PARAMS = { N: 2 ** 17, r: 8, p: 1 } as const;
// 128 × N × r bytes, plus headroom — the library's default ceiling is too low for N=2^17.
const MAXMEM = 256 * 1024 * 1024;
const CURRENT = 'scrypt2';

function encode(salt: string, derived: Buffer): string {
  return `${CURRENT}:${PARAMS.N}:${PARAMS.r}:${PARAMS.p}:${salt}:${derived.toString('hex')}`;
}

type Parsed = { N: number; r: number; p: number; salt: string; digest: Buffer } | null;

function parse(stored: string): Parsed {
  const parts = stored.split(':');
  if (parts[0] === CURRENT && parts.length === 6) {
    const [, N, r, p, salt, digest] = parts;
    return { N: Number(N), r: Number(r), p: Number(p), salt, digest: Buffer.from(digest, 'hex') };
  }
  if (parts[0] === 'scrypt' && parts.length === 3) {
    // The original format: library defaults, N=16384, r=8, p=1.
    return { N: 16384, r: 8, p: 1, salt: parts[1], digest: Buffer.from(parts[2], 'hex') };
  }
  return null;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = await new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(password, salt, KEYLEN, { ...PARAMS, maxmem: MAXMEM }, (err, key) =>
      err ? reject(err) : resolve(key),
    );
  });
  return encode(salt, derived);
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const p = parse(stored);
  if (!p) return false;
  const derived = await new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(password, p.salt, KEYLEN, { N: p.N, r: p.r, p: p.p, maxmem: MAXMEM }, (err, key) =>
      err ? reject(err) : resolve(key),
    );
  });
  if (p.digest.length !== derived.length) return false;
  return crypto.timingSafeEqual(derived, p.digest);
}

/** True when the stored hash predates the current parameters. */
export function needsRehash(stored: string): boolean {
  const p = parse(stored);
  return !p || p.N !== PARAMS.N || p.r !== PARAMS.r || p.p !== PARAMS.p || !stored.startsWith(`${CURRENT}:`);
}

/** For the seed only — see the note at the top. */
export function hashPasswordSync(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, KEYLEN, { ...PARAMS, maxmem: MAXMEM });
  return encode(salt, derived);
}
