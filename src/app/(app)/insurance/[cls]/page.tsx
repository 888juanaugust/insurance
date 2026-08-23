import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { currentUser } from '@/lib/session';
import {
  listRegister, principalChipCounts, listOrgs, listAgentOptions, getOrg, classOfBusinessCounts,
} from '@/lib/queries';
import { NON_MOTOR_CLASSES } from '@/lib/classes';
import { CLASS_BY_SLUG } from '@/lib/form-data';
import FilterSelect from '@/components/FilterSelect';
import RegisterFilters from '@/components/RegisterFilters';
import RegisterTable from '@/components/RegisterTable';
import { can } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

const TITLES: Record<string, string> = {
  'general-motor': 'Motor policies',
  'non-motor': 'Non-motor policies',
};

export default async function RegisterPage({
  params,
  searchParams,
}: {
  params: Promise<{ cls: string }>;
  searchParams: Promise<{ [k: string]: string | string[] | undefined }>;
}) {
  const user = await currentUser();
  if (!user) redirect('/login');

  const { cls: slug } = await params;
  const cls = CLASS_BY_SLUG[slug];
  if (!cls) notFound();

  const sp = await searchParams;
  const str = (k: string) => (typeof sp[k] === 'string' ? (sp[k] as string) : '');

  const orgs = listOrgs();
  const orgId = orgs.some((o) => o.id === str('org')) ? str('org') : user.org_id;
  const org = getOrg(orgId)!;
  const agents = listAgentOptions(orgId);

  const rows = listRegister(orgId, {
    cls,
    principal: str('principal'),
    agent: str('agent'),
    status: str('status'),
    dateField: (str('dateField') || 'uploaded_at') as 'uploaded_at' | 'issue_date' | 'effective_date',
    from: str('from'),
    to: str('to'),
    vehicle: str('vehicle'),
    insured: str('insured'),
    nric: str('nric'),
    cob: str('cob'),
    sort: str('sort'),
    dir: str('dir') === 'asc' ? 'asc' : 'desc',
  });

  const chips = principalChipCounts(orgId, cls);
  const cobCounts = cls === 'non_motor' ? classOfBusinessCounts(orgId) : null;
  const activeCob = str('cob');
  const page = Math.max(1, Number(str('page')) || 1);
  const perPage = [20, 50, 100].includes(Number(str('per'))) ? Number(str('per')) : 20;

  return (
    <div className="panel px-6 py-6">
      {str('deleted') && (
        <p role="status" className="mb-5 rounded border border-line bg-ok-wash px-4 py-3 text-[13px] text-ok">
          Policy deleted, along with its payment and commission records.
        </p>
      )}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[20px] font-semibold tracking-tight text-ink">{TITLES[slug]}</h1>
        <div className="flex flex-wrap items-center gap-2.5">
          <FilterSelect
            name="org"
            label="Organisation"
            value={orgId}
            className="w-[176px]"
            options={orgs.map((o) => ({ value: o.id, label: o.name }))}
          />
          <FilterSelect
            name="agent"
            label="Agent"
            value={agents.some((a) => a.id === str('agent')) ? str('agent') : ''}
            className="w-[210px]"
            options={[
              { value: '', label: 'All agents in organisation' },
              ...agents.map((a) => ({ value: a.id, label: a.name })),
            ]}
          />
          {can(user.role, 'policy.write') && (
            <>
              <Link href={`/insurance/${slug}/new`} className="btn btn-ghost">
                <span className="text-[15px] leading-none">+</span> Create Policy
              </Link>
              <Link href={`/insurance/${slug}/upload`} className="btn btn-primary">
                <UploadGlyph /> Upload PDF
              </Link>
            </>
          )}
        </div>
      </div>

      {cobCounts && (
        <ClassTabs counts={cobCounts} active={activeCob} search={sp} slug={slug} />
      )}

      <RegisterFilters chips={chips} slug={slug} />

      <div className="mt-4">
        <RegisterTable
          rows={rows}
          slug={slug}
          page={page}
          perPage={perPage}
          isMotor={cls === 'motor'}
          maySettle={can(user.role, 'payment.record')}
        />
      </div>

      <p className="mt-3 text-[12px] text-muted">
        Showing {org.name}. The C and P badges are the client and principal payment status for each policy.
      </p>
    </div>
  );
}

/** The 15 class-of-business tabs on the non-motor register. */
function ClassTabs({
  counts, active, search, slug,
}: {
  counts: Map<string, number>;
  active: string;
  search: { [k: string]: string | string[] | undefined };
  slug: string;
}) {
  const href = (cob: string) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(search)) {
      if (typeof v === 'string' && v && k !== 'cob' && k !== 'page') sp.set(k, v);
    }
    if (cob) sp.set('cob', cob);
    const qs = sp.toString();
    return `/insurance/${slug}${qs ? `?${qs}` : ''}`;
  };

  const total = [...counts.values()].reduce((a, b) => a + b, 0);

  return (
    <div className="mb-3 flex flex-wrap gap-x-5 gap-y-1 border-b border-line">
      <Link
        href={href('')}
        className={`-mb-px border-b-2 py-2 text-[13px] ${
          active === '' ? 'border-accent font-semibold text-accent' : 'border-transparent text-ink-soft hover:text-ink'
        }`}
      >
        All ({total})
      </Link>
      {NON_MOTOR_CLASSES.map((c) => {
        const n = counts.get(c) ?? 0;
        return (
          <Link
            key={c}
            href={href(c)}
            className={`-mb-px border-b-2 py-2 text-[13px] ${
              active === c
                ? 'border-accent font-semibold text-accent'
                : `border-transparent hover:text-ink ${n === 0 ? 'text-[#aab2be]' : 'text-ink-soft'}`
            }`}
          >
            {c} ({n})
          </Link>
        );
      })}
    </div>
  );
}

const UploadGlyph = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-[14px] w-[14px]">
    <path d="M12 15V4" strokeLinecap="round" />
    <path d="m8 7.5 4-3.5 4 3.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M4.5 15v3A1.5 1.5 0 0 0 6 19.5h12a1.5 1.5 0 0 0 1.5-1.5v-3" strokeLinecap="round" />
  </svg>
);
