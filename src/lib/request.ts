/**
 * Two facts about the request that several places need and each used to
 * work out for itself, differently.
 */

/**
 * The caller's address, as nginx saw it.
 *
 * nginx sets X-Real-IP to the connecting address and APPENDS that address to
 * whatever X-Forwarded-For arrived with — so the first element of
 * X-Forwarded-For is whatever the client chose to send. Reading that end let
 * anyone rotate the sign-in throttle's bucket by rotating a header, and put an
 * address of their choosing on every audit line. X-Real-IP is the one nginx
 * fully controls; failing that, the LAST element of X-Forwarded-For is the
 * one the proxy appended.
 */
export function ipFromHeaders(get: (name: string) => string | null): string | null {
  const real = (get('x-real-ip') ?? '').trim();
  if (real) return real;
  const forwarded = (get('x-forwarded-for') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  return forwarded.length ? forwarded[forwarded.length - 1] : null;
}

export async function clientIp(): Promise<string | null> {
  try {
    // Imported here rather than at the top so the pure helpers above can be
    // tested in plain Node, where there is no request to ask about.
    const { headers } = await import('next/headers');
    const hdrs = await headers();
    return ipFromHeaders((name) => hdrs.get(name));
  } catch {
    // Outside a request (a script, a test) there are no headers.
    return null;
  }
}

/**
 * A "where to go back to" that came off a form, made safe to redirect to.
 *
 * Only a path on this site will do — one leading slash, no scheme, no host —
 * so a form field cannot send a person to another site after the action ran.
 */
export function safeBack(raw: unknown, fallback: string): string {
  const s = typeof raw === 'string' ? raw.trim() : '';
  if (!s.startsWith('/') || s.startsWith('//') || s.startsWith('/\\') || /[\r\n]/.test(s)) return fallback;
  return s;
}
