import { notFound, redirect } from 'next/navigation';
import { currentUser } from '@/lib/session';
import { getSubAgent, subAgentPolicyCount, principalRateCeiling } from '@/lib/queries';
import { Crumb, PageHeader } from '@/components/ui';
import SubAgentForm from '@/components/SubAgentForm';

export const dynamic = 'force-dynamic';

export default async function EditSubAgentPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) redirect('/login');

  const { id } = await params;
  const agent = getSubAgent(id);
  if (!agent || agent.org_id !== user.org_id) notFound();

  return (
    <div className="space-y-4">
      <div className="panel px-6 py-6">
        <Crumb items={[{ href: '/team', label: 'Agents' }, { label: agent.name }]} />
        <PageHeader title={`Edit ${agent.name}`} subtitle="Contact details, commission structure and payout." />
      </div>
      <SubAgentForm
        mode="edit"
        policyCount={subAgentPolicyCount(id)}
        ceilings={{ motor: principalRateCeiling('motor').hi, nonMotor: principalRateCeiling('non_motor').hi }}
        initial={{
          agent_id: agent.id,
          name: agent.name,
          email: agent.email,
          phone: agent.phone,
          nric: agent.nric,
          agent_code: agent.agent_code,
          rank: agent.rank,
          motor_rate: agent.motor_rate,
          non_motor_rate: agent.non_motor_rate,
          override_rate: agent.override_rate,
          bank_name: agent.bank_name,
          bank_account: agent.bank_account,
          einvoice_tin: agent.einvoice_tin,
          self_billed: agent.self_billed,
          join_date: agent.join_date,
          status: agent.status,
        }}
      />
    </div>
  );
}
