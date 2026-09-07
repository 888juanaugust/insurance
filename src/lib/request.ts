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

/**
 * Whether a sign-in arrived over plain HTTP — and the address to use instead.
 *
 * In production the session cookie is `Secure`, so a browser silently discards
 * one set over http://. And because the sign-in action renders the next page
 * inside its own response, where the just-set cookie is still visible, the
 * person sees Home once and is back at the sign-in page on their next click,
 * with no error anywhere. Refusing here, with the https address in the
 * message, turns that into something a person can act on.
 *
 * The proxy's word (X-Forwarded-Proto) comes first; without a proxy, the
 * browser's Origin header on the action request says the same thing. Localhost
 * is exempt: browsers treat it as secure, and it is where development and the
 * tests run.
 */
export function insecureSignIn(get: (name: string) => string | null, path = '/login'): string | null {
  const host = (get('host') ?? '').trim().toLowerCase();
  const name = host.startsWith('[') ? host.slice(0, host.indexOf(']') + 1) : host.split(':')[0];
  if (!name || name === 'localhost' || name === '127.0.0.1' || name === '[::1]' || name.endsWith('.localhost')) {
    return null;
  }
  const proto = (get('x-forwarded-proto') ?? '').split(',')[0].trim().toLowerCase();
  const origin = (get('origin') ?? '').trim().toLowerCase();
  const plain = proto ? proto === 'http' : origin.startsWith('http://');
  return plain ? `https://${name}${path}` : null;
}

/** The message to refuse a sign-in with, or null when the connection is fine. */
export async function secureSignInProblem(path = '/login'): Promise<string | null> {
  if (process.env.NODE_ENV !== 'production') return null;
  try {
    const { headers } = await import('next/headers');
    const hdrs = await headers();
    const url = insecureSignIn((name) => hdrs.get(name), path);
    return url
      ? `Insurhelp can only sign you in over a secure connection. Open ${url} instead of the plain http address.`
      : null;
  } catch {
    return null;
  }
}
