import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/session';
import { listClients } from '@/lib/queries';
import { money, longDate } from '@/lib/format';
import { PageHeader } from '@/components/ui';
import SearchBox from '@/components/SearchBox';
import FilterSelect from '@/components/FilterSelect';
import { can } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ [k: string]: string | string[] | undefined }>;
}) {
  const user = await currentUser();
  if (!user) redirect('/login');

  const sp = await searchParams;
  const q = typeof sp.q === 'string' ? sp.q : '';
  const type = typeof sp.type === 'string' ? sp.type : '';
  const mayWrite = can(user.role, 'client.write');
  const rows = listClients(user.org_id, q, type);

  const outstanding = rows.reduce((s, r) => s + Number(r.outstanding ?? 0), 0);

  return (
    <div className="panel px-6 py-6">
      <PageHeader
        title="Clients"
        subtitle="Insured parties, their contact details and portal access."
        meta={`${rows.length} client${rows.length === 1 ? '' : 's'} · ${money(outstanding)} premium outstanding`}
        actions={
          <>
            {mayWrite && (
              <Link href="/clients/new" className="btn btn-primary">
                <span className="text-[15px] leading-none">+</span> Add client
              </Link>
            )}
            <FilterSelect
              name="type"
              label="Client type"
              value={type}
              className="w-[160px]"
              options={[
                { value: '', label: 'All client types' },
                { value: 'individual', label: 'Individual' },
                { value: 'company', label: 'Company' },
              ]}
            />
            <SearchBox placeholder="Search name, NRIC, reg no, phone…" className="w-[280px]" />
          </>
        }
      />

      <div className="scroll-x rounded border border-line">
        <table className="tbl">
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Group</th>
              <th>Identity</th>
              <th>Phone</th>
              <th>Email</th>
              <th>DOB</th>
              <th className="num">Policies</th>
              <th className="num">Outstanding</th>
              <th>Portal</th>
              <th>Registered</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id}>
                <td>
                  <Link href={`/clients/${c.id}`} className="link-red">
                    {c.name}
                  </Link>
                </td>
                <td className="text-ink-soft capitalize">{c.client_type}</td>
                <td className="text-ink-soft">{c.group_name ?? '—'}</td>
                <td className="text-ink-soft">{c.nric || c.business_reg || '—'}</td>
                <td className="text-ink-soft">{c.phone}</td>
                <td className="text-ink-soft">{c.email}</td>
                <td className="text-ink-soft">{c.dob ? longDate(c.dob) : '—'}</td>
                <td className="num">{c.policy_count}</td>
                <td className="num">
                  {Number(c.outstanding) > 0 ? (
                    <span className="badge badge-red">{money(c.outstanding)}</span>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </td>
                <td>
                  <span className={`badge ${c.portal_enabled ? 'badge-green' : 'badge-grey'}`}>
                    {c.portal_enabled ? 'Enabled' : 'Off'}
                  </span>
                </td>
                <td className="text-ink-soft">{longDate(c.created_at)}</td>
                <td>
                  <span className="flex gap-3 text-[12.5px]">
                    <Link href={`/clients/${c.id}`} className="text-link hover:underline">View</Link>
                    <Link href={`/clients/${c.id}/edit`} className="text-link hover:underline">Edit</Link>
                  </span>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={12} className="py-12 text-center text-[13px] text-muted">
                  No clients match your search.
                  {mayWrite && (
                    <>
                      {' '}
                      <Link href="/clients/new" className="text-link hover:underline">Add one</Link>.
                    </>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
