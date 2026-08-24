import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/session';
import { navCounts } from '@/lib/queries';
import { MORE } from '@/lib/nav';
import { PageHeader } from '@/components/ui';

export const dynamic = 'force-dynamic';

/**
 * Everything the rail no longer carries.
 *
 * An agency does have to approve commission, check an insurer's statement and
 * file a claim — none of that was removed when the rail was cut back to the
 * daily job. It was moved here, in one page, so a screen that exists is a
 * screen somebody can find.
 */
export default async function MorePage() {
  const user = await currentUser();
  if (!user) redirect('/login');

  const counts = navCounts(user.org_id);

  return (
    <div className="space-y-4">
      <div className="panel px-6 py-6">
        <PageHeader
          title="Everything else"
          subtitle="The rest of the agency — claims, money, reports and settings. Nothing here is part of the daily round."
        />
      </div>

      {MORE.map((group) => (
        <section key={group.title} className="panel">
          <div className="panel-head">
            {group.title}
            <span className="ml-auto text-[12px] font-normal text-muted">{group.note}</span>
          </div>
          <div className="grid gap-px bg-line sm:grid-cols-2 xl:grid-cols-3">
            {group.links.map((l) => {
              const count = l.count ? counts[l.count] : 0;
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className="flex items-start gap-3 bg-white px-5 py-4 hover:bg-[#f8fbff]"
                >
                  <div className="min-w-0">
                    <p className="text-[13.5px] font-semibold text-ink">{l.label}</p>
                    {l.hint && <p className="mt-0.5 text-[12.5px] text-ink-soft">{l.hint}</p>}
                  </div>
                  {count > 0 && (
                    <span className="ml-auto shrink-0 rounded bg-brand px-1.5 py-0.5 text-[10.5px] font-bold text-white">
                      {count}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
