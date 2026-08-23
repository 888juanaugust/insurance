import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/session';
import { ACCESS_DENIED, ROLE_LABEL, ROLE_DESCRIPTION } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

export default async function ForbiddenPage({
  searchParams,
}: {
  searchParams: Promise<{ why?: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect('/login');
  const { why } = await searchParams;

  return (
    <div className="panel mx-auto max-w-2xl px-6 py-8">
      <p className="sec-label">Not permitted</p>
      <h1 className="mt-2 text-[22px] font-semibold tracking-tight text-ink">
        This account cannot do that
      </h1>
      <p className="mt-3 text-[14px] text-ink-soft">{why || ACCESS_DENIED}</p>

      <div className="mt-6 rounded border border-line px-4 py-4">
        <p className="text-[13px] font-semibold text-ink">
          Signed in as {user.name} · role on the account: {user.role || 'none'}
        </p>
        <p className="mt-1 text-[13px] text-ink-soft">
          Insurhelp has one role, <strong>{ROLE_LABEL}</strong>. {ROLE_DESCRIPTION} An account
          set to anything else can sign in but cannot use the agency screens — which is what has
          happened here.
        </p>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link href="/" className="btn btn-primary">Back to the dashboard</Link>
        <Link href="/contact-us" className="btn btn-ghost">Ask for access</Link>
      </div>
    </div>
  );
}
