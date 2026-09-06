import Link from 'next/link';

/** A page that is not there, in the application's own clothes. */
export default function NotFound() {
  return (
    <main className="mx-auto max-w-[560px] px-6 py-16">
      <div className="panel px-7 py-8">
        <p className="sec-label">Not found</p>
        <h1 className="mt-2 text-[22px] font-semibold tracking-tight text-ink">There is nothing at this address</h1>
        <p className="mt-3 text-[13.5px] leading-relaxed text-ink-soft">
          The record may have been deleted, or the link may be wrong. Search for it, or start again
          from Home.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/" className="btn btn-primary">Back to Home</Link>
          <Link href="/search" className="btn btn-ghost">Search</Link>
        </div>
      </div>
    </main>
  );
}
