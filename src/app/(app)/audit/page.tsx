import Link from 'next/link';
import { requirePermission } from '@/lib/guard';
import { listAuditEvents, auditFacets, type AuditRow } from '@/lib/queries';
import { PageHeader, Help } from '@/components/ui';
import FilterSelect from '@/components/FilterSelect';
import AuditSearch from '@/components/AuditSearch';
import AuditChanges from '@/components/AuditChanges';

export const dynamic = 'force-dynamic';

const PER_PAGE = 50;

/** Where a record still exists, the trail links back to it. */
function entityHref(row: AuditRow): string | null {
  if (!row.entity_id) return null;
  switch (row.entity) {
    case 'client': return `/clients/${row.entity_id}`;
    case 'sub_agent': return `/team/${row.entity_id}/edit`;
    case 'organisation': return '/organisation';
    case 'commission_rate': return '/settings/global';
    default: return null;
  }
}

function OutcomeBadge({ outcome }: { outcome: string }) {
  const tone =
    outcome === 'denied' ? 'badge-red' : outcome === 'refused' ? 'badge-amber' : 'badge-green';
  const label = outcome === 'denied' ? 'blocked' : outcome === 'refused' ? 'refused' : 'done';
  return <span className={`badge ${tone}`}>{label}</span>;
}

function when(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
    time: d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
  };
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ [k: string]: string | string[] | undefined }>;
}) {
  const user = await requirePermission('audit.view');
  const sp = await searchParams;
  const str = (k: string) => (typeof sp[k] === 'string' ? (sp[k] as string) : '');

  const page = Math.max(1, Number(str('page')) || 1);
  const filter = {
    user: str('who'),
    entity: str('entity'),
    outcome: str('outcome'),
    from: str('from'),
    to: str('to'),
    search: str('q'),
  };
  const { rows, total } = listAuditEvents(user.org_id, filter, PER_PAGE, (page - 1) * PER_PAGE);
  const facets = auditFacets(user.org_id);
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));

  const qs = (next: Record<string, string>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...Object.fromEntries(
      Object.entries({ who: filter.user, entity: filter.entity, outcome: filter.outcome,
        from: filter.from, to: filter.to, q: filter.search }).filter(([, v]) => v),
    ), ...next })) if (v) p.set(k, v);
    return `/audit?${p.toString()}`;
  };

  return (
    <div className="space-y-4">
      <div className="panel px-6 py-6">
        <PageHeader
          title="Audit trail"
          subtitle="Who changed what, and when. Refusals are kept alongside successes — an attempt that was turned away is the thing you usually came here to find."
          meta={`${total.toLocaleString('en-GB')} recorded ${total === 1 ? 'event' : 'events'}`}
        />

        <div className="mt-5 flex flex-wrap items-center gap-2.5">
          <AuditSearch defaultValue={filter.search} />
          <FilterSelect
            name="who"
            value={filter.user}
            label="User"
            className="w-48"
            options={[
              { value: '', label: 'Everyone' },
              ...facets.users.map((u) => ({ value: u.id, label: `${u.name} (${u.n})` })),
            ]}
          />
          <FilterSelect
            name="entity"
            value={filter.entity}
            label="Record type"
            className="w-44"
            options={[
              { value: '', label: 'Every record' },
              ...facets.entities.map((e) => ({
                value: e.entity,
                label: `${e.entity.replace(/_/g, ' ')} (${e.n})`,
              })),
            ]}
          />
          <FilterSelect
            name="outcome"
            value={filter.outcome}
            label="Outcome"
            className="w-40"
            options={[
              { value: '', label: 'Any outcome' },
              { value: 'ok', label: 'Done' },
              { value: 'denied', label: 'Blocked by role' },
              { value: 'refused', label: 'Refused by a rule' },
            ]}
          />
          <label className="flex items-center gap-1.5 text-[12.5px] text-muted">
            From
            <input type="date" name="from" defaultValue={filter.from} form="audit-range" className="inp h-8 w-36 text-[13px]" />
          </label>
          <label className="flex items-center gap-1.5 text-[12.5px] text-muted">
            to
            <input type="date" name="to" defaultValue={filter.to} form="audit-range" className="inp h-8 w-36 text-[13px]" />
          </label>
          <form id="audit-range" action="/audit" className="contents">
            {filter.user && <input type="hidden" name="who" value={filter.user} />}
            {filter.entity && <input type="hidden" name="entity" value={filter.entity} />}
            {filter.outcome && <input type="hidden" name="outcome" value={filter.outcome} />}
            {filter.search && <input type="hidden" name="q" value={filter.search} />}
            <button type="submit" className="btn btn-ghost h-8">Apply dates</button>
          </form>
          {(filter.user || filter.entity || filter.outcome || filter.from || filter.to || filter.search) && (
            <Link href="/audit" className="text-[12.5px] link-red">Clear</Link>
          )}
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          Events
          <Help text="The actor's name and role are kept as they stood at the time, so the trail still reads correctly after someone is renamed or removed." />
        </div>
        <div className="scroll-x">
          <table className="tbl">
            <thead>
              <tr>
                <th className="w-40">When</th>
                <th className="w-44">Who</th>
                <th className="w-40">Action</th>
                <th>What happened</th>
                <th className="w-24">Outcome</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const t = when(row.at);
                const href = entityHref(row);
                return (
                  <tr key={row.id} className="align-top">
                    <td className="whitespace-nowrap">
                      <span className="text-ink">{t.date}</span>
                      <span className="block text-[12px] text-muted tabular-nums">{t.time}</span>
                    </td>
                    <td>
                      <span className="font-semibold text-ink">{row.user_name}</span>
                      <span className="block text-[12px] text-muted capitalize">{row.user_role}</span>
                    </td>
                    <td>
                      <code className="text-[12px] text-ink-soft">{row.action}</code>
                      {row.ip && <span className="block text-[12px] text-muted">{row.ip}</span>}
                    </td>
                    <td className="text-ink-soft">
                      {href ? (
                        <Link href={href} className="link-red">{row.summary}</Link>
                      ) : (
                        row.summary
                      )}
                      <AuditChanges json={row.changes} />
                    </td>
                    <td><OutcomeBadge outcome={row.outcome} /></td>
                  </tr>
                );
              })}
              {!rows.length && (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-[13px] text-muted">
                    Nothing recorded for those filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {pages > 1 && (
          <div className="flex items-center justify-between border-t border-line px-5 py-3 text-[12.5px] text-muted">
            <span>Page {page} of {pages}</span>
            <div className="flex gap-2">
              {page > 1 && <Link href={qs({ page: String(page - 1) })} className="btn btn-ghost h-8">Newer</Link>}
              {page < pages && <Link href={qs({ page: String(page + 1) })} className="btn btn-ghost h-8">Older</Link>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
