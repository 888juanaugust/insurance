import { NextResponse, type NextRequest } from 'next/server';

/**
 * A Content-Security-Policy with a fresh nonce on every response.
 *
 * Nothing here decides who is signed in — every page and action checks that
 * for itself — so this middleware carries no authority that bypassing it
 * would gain. It exists to hand the browser one header: the policy below,
 * which keeps the application out of other sites' frames (so no overlay can
 * drive a server-action form with a signed-in person's cookie), keeps forms
 * posting to this origin only, and lets only scripts carrying this response's
 * nonce run. Next reads the nonce from the header and stamps its own inline
 * scripts with it; the theme script in layout.tsx takes it from the request.
 */
export function middleware(request: NextRequest) {
  const nonce = btoa(crypto.getRandomValues(new Uint8Array(16)).reduce((s, b) => s + String.fromCharCode(b), ''));
  const dev = process.env.NODE_ENV !== 'production';

  const csp = [
    "default-src 'self'",
    // 'strict-dynamic' lets a nonced script load what it needs; the 'unsafe-eval'
    // is only for development, where Next's hot reloading evaluates code.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ''}`,
    // Inline styles come from React (style={{}}) and from Next itself; the
    // font stylesheet from Google.
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', csp);
  return response;
}

export const config = {
  matcher: [
    /*
     * Everything except Next's own static files, the image optimiser and the
     * favicon — and except prefetches, which carry no document to protect.
     */
    {
      source: '/((?!_next/static|_next/image|favicon.ico).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
