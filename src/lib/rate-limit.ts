/**
 * Sign-in throttling. Held in memory, which is enough for the single-process
 * deployment this ships as — move it to the database or Redis before running
 * more than one instance, or each instance will count separately.
 */
type Bucket = { hits: number; first: number; blockedUntil: number };

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 8;
const BLOCK_MS = 15 * 60 * 1000;
const MAX_KEYS = 5000;

const buckets = new Map<string, Bucket>();

function sweep(now: number) {
  if (buckets.size < MAX_KEYS) return;
  for (const [key, b] of buckets) {
    if (now - b.first > WINDOW_MS && now > b.blockedUntil) buckets.delete(key);
  }
}

export type RateVerdict = { allowed: true } | { allowed: false; retryAfterSec: number };

/** Call before checking a password. */
export function checkRate(key: string): RateVerdict {
  const now = Date.now();
  const b = buckets.get(key);

  if (!b) return { allowed: true };
  if (now < b.blockedUntil) {
    return { allowed: false, retryAfterSec: Math.ceil((b.blockedUntil - now) / 1000) };
  }
  if (now - b.first > WINDOW_MS) {
    buckets.delete(key);
    return { allowed: true };
  }
  return { allowed: true };
}

/** Call when a password check fails. */
export function recordFailure(key: string) {
  const now = Date.now();
  sweep(now);

  const b = buckets.get(key);
  if (!b || now - b.first > WINDOW_MS) {
    buckets.set(key, { hits: 1, first: now, blockedUntil: 0 });
    return;
  }

  b.hits += 1;
  if (b.hits >= MAX_ATTEMPTS) b.blockedUntil = now + BLOCK_MS;
}

/** Call when a password check succeeds. */
export function clearFailures(key: string) {
  buckets.delete(key);
}
