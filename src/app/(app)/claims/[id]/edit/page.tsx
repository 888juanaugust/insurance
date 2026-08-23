import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/guard';
import { getClaim, claimPolicyOptions } from '@/lib/queries';
import { Crumb, PageHeader } from '@/components/ui';
import ClaimForm from '@/components/ClaimForm';

export const dynamic = 'force-dynamic';

export default async function EditClaimPage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ closing?: string }>;
}) {
  const user = await requireAdmin();
  const { id } = await params;
  const { closing } = await searchParams;

  const claim = getClaim(id, user.org_id);
  if (!claim) notFound();

  return (
    <div className="space-y-4">
      <div className="panel px-6 py-6">
        <Crumb
          items={[
            { href: '/claims', label: 'Claims' },
            { href: `/claims/${id}`, label: claim.claim_no },
            { label: 'Edit' },
          ]}
        />
        <PageHeader
          title={closing ? `Close ${claim.claim_no}` : `Edit ${claim.claim_no}`}
          subtitle={
            closing
              ? 'Closing a claim needs the figure that settles it, or the reason it went the other way.'
              : `${claim.policy_no} · ${claim.client_name}`
          }
        />
      </div>

      <ClaimForm
        mode="edit"
        policies={claimPolicyOptions(user.org_id)}
        closing={closing}
        initial={{ ...claim, claim_id: claim.id }}
      />
    </div>
  );
}
