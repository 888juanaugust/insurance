import { redirect } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Topbar from '@/components/Topbar';
import { currentUser } from '@/lib/session';
import { logoutAction } from '@/lib/actions';
import { unreadNotifications } from '@/lib/queries';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) redirect('/login');

  const unread = unreadNotifications(user.org_id).v;

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar logout={logoutAction} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar user={user} unread={unread} />
        <main className="flex-1 overflow-y-auto bg-canvas px-6 py-6">{children}</main>
      </div>
    </div>
  );
}
