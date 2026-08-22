import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { currentUser } from '@/lib/session';
import { listPolicies, listPrincipals, listAgentOptions } from '@/lib/queries';
import { money, longDate } from '@/lib/format';
import { PageHeader, StatusBadge } from '@/components/ui';
import SearchBox from '@/components/SearchBox';
import FilterSelect from '@/components/FilterSelect';

export const dynamic = 'force-dynamic';

const SLUGS: Record<string, { cls: string; title: string; subtitle: string }> = {
  motor: {
    cls: 'motor',
    title: 'General Motor',
    subtitle: 'Private car, commercial vehicle and motorcycle policies.',
  },
  'non-motor': {
    cls: 'non_motor',
    title: 'General Non-Motor',
    subtitle: 'Fire, personal accident, medical, liability and other non-motor policies.',
  },
};

export default async function PolicyRegisterPage({
  params,
  searchParams,
}: {
  params: Promise<{ cls: string }>;
  searchParams: Promise<{ [k: string]: string | string[] | undefined }>;
}) {
  const user = await currentUser();
  if (!user) redirect('/login');

  const { cls: slug } = await params;
  const conf = SLUGS[slug];
  if (!conf) notFound();

  const sp = await searchParams;
  const str = (k: string) => (typeof sp[k] === 'string' ? (sp[k] as string) : '');

  const rows = listPolicies(user.org_id, {
    cls: conf.cls,
    search: str('q'),
    status: str('status'),
    principal: str('principal'),
    agent: str('agent'),
  });

  const principals = listPrincipals();
  const agents = listAgentOptions(user.org_id);
  const premium = rows.reduce((s, r) => s + r.total_premium, 0);
  const commission = rows.reduce((s, r) => s + r.commission_amt, 0);
  const isMotor = conf.cls === 'motor';

  return (
    <div className="panel px-6 py-6">
      <PageHeader
        title={conf.title}
        subtitle={conf.subtitle}
        meta={`${rows.length} record${rows.length === 1 ? '' : 's'} · ${money(premium)} total premium · ${money(commission)} agency commission`}
        actions={
          <>
            <FilterSelect
              name="status"
              label="Status"
              value={str('status')}
              className="w-[140px]"
              options={[
                { value: '', label: 'All statuses' },
                { value: 'active', label: 'Active' },
                { value: 'quotation', label: 'Quotation' },
                { value: 'expired', label: 'Expired' },
                { value: 'cancelled', label: 'Cancelled' },
              ]}
            />
            <FilterSelect
              name="principal"
              label="Principal"
              value={str('principal')}
              className="w-[155px]"
              options={[
                { value: '', label: 'All principals' },
                ...principals.map((p) => ({ value: p.id, label: p.short_name })),
              ]}
            />
            <FilterSelect
              name="agent"
              label="Agent"
              value={str('agent')}
              className="w-[165px]"
              options={[{ value: '', label: 'All agents' }, ...agents.map((a) => ({ value: a.id, label: a.name }))]}
            />
            <SearchBox placeholder="Search policy, insured, vehicle…" className="w-[230px]" />
          </>
        }
      />

      <div className="scroll-x rounded border border-line">
        <table className="tbl">
          <thead>
            <tr>
              <th>Policy no</th>
              <th>Cover note</th>
              <th>Insured</th>
              <th>Principal</th>
              {isMotor ? <th>Vehicle no</th> : <th>Product</th>}
              {isMotor ? <th>Make &amp; model</th> : <th>Cover</th>}
              <th>Period of insurance</th>
              <th className="num">Sum insured</th>
              <th className="num">Gross premium</th>
              <th className="num">Total payable</th>
              <th className="num">Commission</th>
              <th>Agent</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id}>
                <td>
                  <Link href={`/insurance/${slug}/${p.id}`} className="link-red">
                    {p.policy_no}
                  </Link>
                </td>
                <td className="text-ink-soft">{p.cover_note_no ?? '—'}</td>
                <td>
                  <Link href={`/clients/${p.client_id}`} className="link-red">
                    {p.client_name}
                  </Link>
                </td>
                <td className="font-semibold text-brand">{p.principal}</td>
                {isMotor ? (
                  <td className="font-semibold text-ink">{p.vehicle_no ?? '—'}</td>
                ) : (
                  <td className="text-ink-soft">{p.product}</td>
                )}
                {isMotor ? (
                  <td className="text-ink-soft">{p.make_model ?? '—'}</td>
                ) : (
                  <td className="text-ink-soft">{p.type_of_cover}</td>
                )}
                <td className="text-ink-soft">
                  {longDate(p.effective_date)} – {longDate(p.expiry_date)}
                </td>
                <td className="num">{money(p.sum_insured)}</td>
                <td className="num">{money(p.gross_premium)}</td>
                <td className="num font-semibold">{money(p.total_premium)}</td>
                <td className="num">{money(p.commission_amt)}</td>
                <td className="text-ink-soft">{p.agent_name ?? '—'}</td>
                <td><StatusBadge status={p.status} /></td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={13} className="py-12 text-center text-[13px] text-muted">
                  No policies match the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
