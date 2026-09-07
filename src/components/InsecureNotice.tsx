'use client';

import { useEffect, useState } from 'react';

/**
 * Shown on a sign-in page that opened over plain http.
 *
 * The server refuses such a sign-in too (see secureSignInProblem), but the
 * refusal comes after the password is typed; this says so before. Localhost is
 * exempt, as it is there — and in development nothing is Secure anyway.
 */
export default function InsecureNotice() {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    const { protocol, hostname, pathname } = window.location;
    const local =
      hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]' || hostname.endsWith('.localhost');
    if (protocol === 'http:' && !local) setUrl(`https://${hostname}${pathname}`);
  }, []);

  if (!url) return null;
  return (
    <p
      role="alert"
      className="mb-4 rounded border border-warn-line bg-warn-wash px-3 py-2.5 text-[12.5px] leading-relaxed text-warn"
    >
      This page opened over plain http, and a browser will not keep a sign-in made here. Use{' '}
      <a href={url} className="font-semibold underline">{url}</a>.
    </p>
  );
}
