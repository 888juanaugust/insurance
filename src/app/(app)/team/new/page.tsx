import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/session';
import { principalRateCeiling } from '@/lib/queries';
import { Crumb, PageHeader } from '@/components/ui';
import SubAgentForm from '@/components/SubAgentForm';

export const dynamic = 'force-dynamic';

export default async function NewSubAgentPage() {
  const user = await currentUser();
  if (!user) redirect('/login');

  return (
    <div className="space-y-4">
      <div className="panel px-6 py-6">
        <Crumb items={[{ href: '/team', label: 'Agents' }, { label: 'Add agent' }]} />
        <PageHeader
          title="Add agent"
          subtitle="Someone in your downline who writes business and takes a share of the commission."
        />
      </div>
      <SubAgentForm
        mode="create"
        initial={{ status: 'active', motor_rate: 0, non_motor_rate: 0, override_rate: 0, self_billed: 0 }}
        ceilings={{ motor: principalRateCeiling('motor').hi, nonMotor: principalRateCeiling('non_motor').hi }}
      />
    </div>
  );
}
