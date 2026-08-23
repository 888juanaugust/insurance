import { requireAdmin } from '@/lib/guard';
import { policyOptions, nextEndorsementNo } from '@/lib/queries';
import { Crumb, PageHeader } from '@/components/ui';
import EndorsementForm from '@/components/EndorsementForm';
import { today } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function NewEndorsementPage({
  searchParams,
}: {
  searchParams: Promise<{ policy?: string }>;
}) {
  const user = await requireAdmin();
  const { policy } = await searchParams;

  const policies = policyOptions(user.org_id);

  return (
    <div className="space-y-4">
      <div className="panel px-6 py-6">
        <Crumb items={[{ href: '/endorsements', label: 'Endorsements' }, { label: 'Raise an endorsement' }]} />
        <PageHeader
          title="Raise an endorsement"
          subtitle="Change cover that is already running. The premium follows the unexpired period, and the working is shown before you save."
        />
      </div>

      <EndorsementForm
        mode="create"
        policies={policies}
        initial={{
          endorsement_no: nextEndorsementNo(user.org_id),
          policy_id: policy && policies.some((p) => p.id === policy) ? policy : '',
          type: 'sum_insured',
          status: 'draft',
          effective_date: today(),
          annual_difference: 0,
        }}
      />
    </div>
  );
}
