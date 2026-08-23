import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/session';
import { listNotifications } from '@/lib/queries';
import { longDate } from '@/lib/format';
import { Crumb, PageHeader, StatusBadge } from '@/components/ui';
import { markNotificationsReadAction } from '@/lib/actions';

export const dynamic = 'force-dynamic';

const AUDIENCE: Record<string, string> = {
  all: 'Everyone',
  sub_agent: 'Sub agents',
  client: 'Insured clients',
};

export default async function NotificationsPage() {
  const user = await currentUser();
  if (!user) redirect('/login');

  const rows = listNotifications(user.org_id);
  const unread = rows.filter((r) => !r.read_flag).length;

  return (
    <div className="panel px-6 py-6">
      <Crumb items={[{ href: '/setting', label: 'Setting' }, { label: 'Schedule Notification' }]} />
      <PageHeader
        title="Broadcasts"
        subtitle="Broadcast messages to everyone in the system, including sub agents and insured clients."
        meta={`${rows.length} messages · ${unread} unread`}
        actions={
          unread > 0 ? (
            <form action={markNotificationsReadAction}>
              <button type="submit" className="btn btn-ghost">Mark all as read</button>
            </form>
          ) : null
        }
      />

      <div className="scroll-x rounded border border-line">
        <table className="tbl">
          <thead>
            <tr>
              <th>Title</th>
              <th>Message</th>
              <th>Audience</th>
              <th>Channel</th>
              <th>Scheduled for</th>
              <th>Status</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((n) => (
              <tr key={n.id} className={n.read_flag ? '' : 'bg-[#fbfcfe]'}>
                <td className="font-semibold text-ink">
                  {!n.read_flag && <span className="mr-1.5 inline-block h-[7px] w-[7px] rounded-full bg-brand align-middle" />}
                  {n.title}
                </td>
                <td className="wrap text-ink-soft">{n.body}</td>
                <td className="text-ink-soft">{AUDIENCE[n.audience] ?? n.audience}</td>
                <td className="text-ink-soft capitalize">{n.channel}</td>
                <td className="text-ink-soft">{n.scheduled_at}</td>
                <td><StatusBadge status={n.status} /></td>
                <td className="text-ink-soft">{longDate(n.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
