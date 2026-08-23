import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/guard';
import { getEndorsement, policyOptions } from '@/lib/queries';
import { Crumb, PageHeader } from '@/components/ui';
import EndorsementForm from '@/components/EndorsementForm';

export const dynamic = 'force-dynamic';

export default async function EditEndorsementPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin();
  const { id } = await params;

  const e = getEndorsement(id, user.org_id);
  if (!e) notFound();

  return (
    <div className="space-y-4">
      <div className="panel px-6 py-6">
        <Crumb
          items={[
            { href: '/endorsements', label: 'Endorsements' },
            { href: `/endorsements/${id}`, label: e.endorsement_no },
            { label: 'Edit' },
          ]}
        />
        <PageHeader title={`Edit ${e.endorsement_no}`} subtitle={`${e.policy_no} · ${e.client_name}`} />
      </div>

      <EndorsementForm
        mode="edit"
        policies={policyOptions(user.org_id)}
        initial={{ ...e, endorsement_id: e.id }}
      />
    </div>
  );
}
