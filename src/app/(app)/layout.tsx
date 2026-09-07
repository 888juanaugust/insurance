import { redirect } from 'next/navigation';
import AppShell from '@/components/AppShell';
import { currentUser } from '@/lib/session';
import { logoutAction } from '@/lib/actions';
import { navCounts, getOrg } from '@/lib/queries';
import { isLandlordProcess } from '@/lib/tenant';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // The landlord's process has no agency screens; its one place is the console.
  if (isLandlordProcess()) redirect('/landlord');
  const user = await currentUser();
  if (!user) redirect('/login');

  const counts = navCounts(user.org_id);
  const orgName = getOrg(user.org_id)?.name ?? '';

  return (
    <AppShell user={user} orgName={orgName} counts={counts} logout={logoutAction}>
      {children}
    </AppShell>
  );
}
