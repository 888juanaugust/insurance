import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/session';
import { listGroups, listGroupMembers } from '@/lib/queries';
import { money } from '@/lib/format';
import { PageHeader } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function GroupingClientPage() {
  const user = await currentUser();
  if (!user) redirect('/login');

  const groups = listGroups(user.org_id);
  const members = listGroupMembers(user.org_id);
  const ungrouped = members.filter((m) => !m.group_id);

  return (
    <div className="space-y-4">
      <div className="panel px-6 py-6">
        <PageHeader
          title="Client groups"
          subtitle="Roll several insured parties into a single account so fleets and group schemes are handled together."
          meta={`${groups.length} groups · ${members.length - ungrouped.length} grouped clients · ${ungrouped.length} ungrouped`}
        />

        <div className="scroll-x rounded border border-line">
          <table className="tbl">
            <thead>
              <tr>
                <th>Group</th>
                <th>Description</th>
                <th>Person in charge</th>
                <th className="num">Members</th>
                <th className="num">Policies</th>
                <th className="num">Premium</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <tr key={g.id}>
                  <td className="font-semibold text-ink">{g.name}</td>
                  <td className="wrap text-ink-soft">{g.description}</td>
                  <td className="text-ink-soft">
                    {g.pic_name}
                    <span className="block text-[12px] text-muted">{g.pic_phone}</span>
                  </td>
                  <td className="num">{g.member_count}</td>
                  <td className="num">{g.policy_count}</td>
                  <td className="num">{money(g.premium_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {groups.map((g) => {
          const list = members.filter((m) => m.group_id === g.id);
          return (
            <div key={g.id} className="panel">
              <div className="panel-head">{g.name}</div>
              <ul className="divide-y divide-line-soft">
                {list.map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <Link href={`/clients/${m.id}`} className="link-red text-[13px]">
                      {m.name}
                    </Link>
                    <span className="text-[12px] text-muted">{m.phone}</span>
                  </li>
                ))}
                {list.length === 0 && (
                  <li className="px-4 py-6 text-center text-[13px] text-muted">No members assigned.</li>
                )}
              </ul>
            </div>
          );
        })}

        <div className="panel">
          <div className="panel-head">Ungrouped clients ({ungrouped.length})</div>
          <ul className="scroll-y max-h-[320px] divide-y divide-line-soft">
            {ungrouped.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <Link href={`/clients/${m.id}`} className="link-red text-[13px]">
                  {m.name}
                </Link>
                <span className="text-[12px] text-muted capitalize">{m.client_type}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
