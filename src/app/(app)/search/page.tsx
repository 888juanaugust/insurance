import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/session';
import { runSearch } from '@/lib/search-run';
import { KIND_LABEL } from '@/lib/search';
import { PageHeader } from '@/components/ui';

export const dynamic = 'force-dynamic';

const TONE: Record<string, string> = {
  policy: 'badge-blue',
  client: 'badge-green',
  claim: 'badge-amber',
  endorsement: 'badge-blue',
  agent: 'badge-grey',
  document: 'badge-grey',
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; go?: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect('/login');

  const { q = '', go } = await searchParams;
  const result = runSearch(user.org_id, q, 80);

  // One exact identifier match and nothing else: go straight there, unless the
  // person asked to see the list.
  if (result.jumpTo && go !== 'list') redirect(result.jumpTo.href);

  return (
    <div className="space-y-4">
      <div className="panel px-6 py-6">
        <PageHeader
          title={q ? `Results for “${q}”` : 'Search'}
          subtitle="Policies, clients, claims, endorsements, sub agents and documents."
          meta={q ? `${result.total} ${result.total === 1 ? 'match' : 'matches'}` : undefined}
        />
        <form action="/search" className="mt-5 flex flex-wrap items-center gap-2.5">
          <input
            type="search"
            name="q"
            defaultValue={q}
            autoFocus
            placeholder="Plate, policy number, NRIC, name, claim or report number"
            aria-label="Search everything"
            className="inp h-10 w-full max-w-xl text-[14px]"
          />
          <button type="submit" className="btn btn-primary h-10">Search</button>
        </form>
        <p className="mt-2.5 text-[12px] text-muted">
          Identifiers are matched however they are written — <code>WXY 4471</code>,{' '}
          <code>wxy4471</code> and <code>WXY-4471</code> all find the same vehicle, and an NRIC
          matches with or without its dashes.
        </p>
      </div>

      {q && !result.total && (
        <div className="panel px-6 py-12 text-center">
          <p className="text-[14px] text-ink">Nothing matches “{q}”.</p>
          <p className="mt-1.5 text-[13px] text-muted">
            Try part of a name, a plate, or a policy number. Two characters is the minimum for a
            name, three for a phrase inside a remark.
          </p>
        </div>
      )}

      {result.byKind.map((group) => (
        <div key={group.kind} className="panel">
          <div className="panel-head">
            {KIND_LABEL[group.kind]}
            <span className="ml-auto text-[12px] font-normal text-muted">
              {group.hits.length}
            </span>
          </div>
          <ul className="divide-y divide-line">
            {group.hits.map((hit) => (
              <li key={`${hit.kind}-${hit.id}`}>
                <Link href={hit.href} className="block px-5 py-3 hover:bg-[#fafbfc]">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="text-[14px] font-semibold text-brand">{hit.title}</span>
                    <span className={`badge ${TONE[hit.kind] ?? 'badge-grey'}`}>
                      matched on {hit.matched}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[13px] text-ink-soft">{hit.subtitle}</p>
                  {hit.meta && <p className="mt-0.5 text-[12px] text-muted">{hit.meta}</p>}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
