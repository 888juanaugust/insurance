import { notFound, redirect } from 'next/navigation';
import { currentUser } from '@/lib/session';
import { policyFormOptions, CLASS_BY_SLUG } from '@/lib/form-data';
import { Crumb, PageHeader } from '@/components/ui';
import PolicyForm from '@/components/PolicyForm';

export const dynamic = 'force-dynamic';

export default async function NewPolicyPage({ params }: { params: Promise<{ cls: string }> }) {
  const user = await currentUser();
  if (!user) redirect('/login');

  const { cls: slug } = await params;
  const cls = CLASS_BY_SLUG[slug];
  if (!cls) notFound();

  const options = policyFormOptions(user.org_id);
  const title = cls === 'motor' ? 'General Motor' : 'General Non-Motor';

  return (
    <div className="space-y-4">
      <div className="panel px-6 py-6">
        <Crumb items={[{ href: `/insurance/${slug}`, label: title }, { label: 'Create Policy' }]} />
        <PageHeader title="Create Policy" subtitle="Key in a policy by hand." />
      </div>
      <PolicyForm
        mode="create"
        cls={cls}
        {...options}
        initial={{ status: 'active', case_type: 'new', referral_fee: 0 }}
      />
    </div>
  );
}
