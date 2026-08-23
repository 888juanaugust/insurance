import { requireAdmin } from '@/lib/guard';
import { claimPolicyOptions, nextClaimNo } from '@/lib/queries';
import { Crumb, PageHeader } from '@/components/ui';
import ClaimForm from '@/components/ClaimForm';
import { today } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function NewClaimPage({
  searchParams,
}: {
  searchParams: Promise<{ policy?: string }>;
}) {
  const user = await requireAdmin();
  const { policy } = await searchParams;
  const policies = claimPolicyOptions(user.org_id);

  return (
    <div className="space-y-4">
      <div className="panel px-6 py-6">
        <Crumb items={[{ href: '/claims', label: 'Claims' }, { label: 'Open a claim' }]} />
        <PageHeader
          title="Open a claim"
          subtitle="Take the details while the insured is still on the phone. The police report and the workshop can follow."
        />
      </div>

      <ClaimForm
        mode="create"
        policies={policies}
        initial={{
          claim_no: nextClaimNo(user.org_id),
          policy_id: policy && policies.some((p) => p.id === policy) ? policy : '',
          status: 'notified',
          type: 'own_damage',
          incident_date: today(),
          notified_date: today(),
        }}
      />
    </div>
  );
}
