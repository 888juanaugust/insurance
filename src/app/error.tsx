'use client';

import Link from 'next/link';
import { useEffect } from 'react';

/**
 * What a person sees when a screen throws. Until this existed any error in a
 * server component reached them as the framework's own unstyled page, with no
 * way back into the application and nothing said about what happened.
 *
 * The error itself is reported by the server (see instrumentation.ts); this
 * page shows the digest so the two can be matched up.
 */
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // The browser console is the one place the person can be pointed to.
    console.error('Insurhelp screen error', error.digest ?? error.message);
  }, [error]);

  return (
    <main className="mx-auto max-w-[560px] px-6 py-16">
      <div className="panel px-7 py-8">
        <p className="sec-label">Something went wrong</p>
        <h1 className="mt-2 text-[22px] font-semibold tracking-tight text-ink">This screen could not be shown</h1>
        <p className="mt-3 text-[13.5px] leading-relaxed text-ink-soft">
          Nothing you did caused it, and nothing has been lost that was already saved. Try the
          screen again; if it keeps happening, tell whoever runs the server and quote the reference
          below.
        </p>
        {error.digest && (
          <p className="mt-3 font-mono text-[12px] text-muted">Reference {error.digest}</p>
        )}
        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" onClick={reset} className="btn btn-primary">Try again</button>
          <Link href="/" className="btn btn-ghost">Back to Home</Link>
        </div>
      </div>
    </main>
  );
}
