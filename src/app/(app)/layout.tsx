import { redirect } from 'next/navigation';
import AppShell from '@/components/AppShell';
import { currentUser } from '@/lib/session';
import { logoutAction } from '@/lib/actions';
import { navCounts, getOrg } from '@/lib/queries';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
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
