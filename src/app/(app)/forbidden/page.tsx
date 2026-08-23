import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/session';
import { ROLE_LABEL, ROLE_DESCRIPTION, permissionsOf, isRole, DENIAL } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

export default async function ForbiddenPage({
  searchParams,
}: {
  searchParams: Promise<{ why?: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect('/login');
  const { why } = await searchParams;

  const role = isRole(user.role) ? user.role : null;
  const allowed = permissionsOf(user.role);

  return (
    <div className="panel mx-auto max-w-2xl px-6 py-8">
      <p className="sec-label">Not permitted</p>
      <h1 className="mt-2 text-[22px] font-semibold tracking-tight text-ink">
        That is not yours to do
      </h1>
      <p className="mt-3 text-[14px] text-ink-soft">
        {why || 'Your role does not allow that action.'}
      </p>

      {role && (
        <div className="mt-6 rounded border border-line px-4 py-4">
          <p className="text-[13px] font-semibold text-ink">
            You are signed in as {user.name} — {ROLE_LABEL[role]}
          </p>
          <p className="mt-1 text-[13px] text-ink-soft">{ROLE_DESCRIPTION[role]}</p>
          <p className="sec-label mt-4">What this role can do</p>
          <ul className="mt-2 grid gap-1 text-[13px] text-ink-soft sm:grid-cols-2">
            {allowed.map((p) => (
              <li key={p}>· {DENIAL[p][0].toUpperCase()}{DENIAL[p].slice(1)}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-3">
        <Link href="/" className="btn btn-primary">Back to the dashboard</Link>
        <Link href="/contact-us" className="btn btn-ghost">Ask for access</Link>
      </div>
    </div>
  );
}
