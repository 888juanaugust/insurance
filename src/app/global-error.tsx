'use client';

/**
 * The last resort, when the root layout itself has failed and nothing of the
 * application's own styling can be relied on — so this paints its own.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#F8FAFC', color: '#111827' }}>
        <main style={{ maxWidth: 560, margin: '64px auto', padding: '0 24px' }}>
          <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 24, padding: '32px 28px' }}>
            <p style={{ fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', color: '#64748B', margin: 0 }}>
              Something went wrong
            </p>
            <h1 style={{ fontSize: 22, margin: '8px 0 0' }}>Insurhelp could not be shown</h1>
            <p style={{ fontSize: 14, lineHeight: 1.6, color: '#475569' }}>
              Nothing already saved has been lost. Try again; if it keeps happening, tell whoever
              runs the server and quote the reference below.
            </p>
            {error.digest && (
              <p style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12, color: '#64748B' }}>
                Reference {error.digest}
              </p>
            )}
            <button
              type="button"
              onClick={reset}
              style={{
                marginTop: 16, background: '#4F46E5', color: '#fff', border: 0, borderRadius: 12,
                padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}
            >
              Try again
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
