/**
 * Sign-in throttling. Held in memory, which is enough for the single-process
 * deployment this ships as — move it to the database or Redis before running
 * more than one instance, or each instance will count separately.
 *
 * The map is bounded. It used to evict only entries whose window had expired,
 * so a flood of distinct keys inside one window — every one a different
 * spoofed address — grew it without limit until the process was restarted,
 * which also emptied the throttle. Past the cap the OLDEST entries go,
 * whatever their state: a throttle that forgets one attacker is better than
 * a process that forgets all of them.
 */
type Bucket = { hits: number; first: number; blockedUntil: number };

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 8;
const BLOCK_MS = 15 * 60 * 1000;
const MAX_KEYS = 5000;

const buckets = new Map<string, Bucket>();

function sweep(now: number) {
  for (const [key, b] of buckets) {
    if (now - b.first > WINDOW_MS && now > b.blockedUntil) buckets.delete(key);
  }
  if (buckets.size < MAX_KEYS) return;
  // Still full of live entries: drop the oldest until there is room. Map
  // iteration is insertion order, so the front is the oldest.
  const excess = buckets.size - MAX_KEYS + Math.ceil(MAX_KEYS / 10);
  let dropped = 0;
  for (const key of buckets.keys()) {
    if (dropped++ >= excess) break;
    buckets.delete(key);
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
  if (buckets.size >= MAX_KEYS) sweep(now);

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

/** For tests: how many keys are held. */
export function rateLimitSize(): number {
  return buckets.size;
}

/* ------------------------------------------------------------- uploads */

/**
 * A counting limit for document readings: every attempt counts, successful or
 * not, because it is the work itself that has to be bounded.
 */
const UPLOAD_WINDOW_MS = 15 * 60 * 1000;
const UPLOAD_MAX = 100;
const uploads = new Map<string, { hits: number; first: number }>();

export function checkUploadRate(key: string): RateVerdict {
  const now = Date.now();
  if (uploads.size >= MAX_KEYS) {
    for (const [k, b] of uploads) if (now - b.first > UPLOAD_WINDOW_MS) uploads.delete(k);
    if (uploads.size >= MAX_KEYS) uploads.delete(uploads.keys().next().value as string);
  }
  const b = uploads.get(key);
  if (!b || now - b.first > UPLOAD_WINDOW_MS) {
    uploads.set(key, { hits: 1, first: now });
    return { allowed: true };
  }
  b.hits += 1;
  if (b.hits > UPLOAD_MAX) {
    return { allowed: false, retryAfterSec: Math.ceil((b.first + UPLOAD_WINDOW_MS - now) / 1000) };
  }
  return { allowed: true };
}
