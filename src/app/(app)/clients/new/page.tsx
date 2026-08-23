import { requireAdmin } from '@/lib/guard';
import { listGroupOptions } from '@/lib/queries';
import { Crumb, PageHeader } from '@/components/ui';
import ClientForm from '@/components/ClientForm';

export const dynamic = 'force-dynamic';

export default async function NewClientPage() {
  const user = await requireAdmin();

  return (
    <div className="space-y-4">
      <div className="panel px-6 py-6">
        <Crumb items={[{ href: '/clients', label: 'Clients' }, { label: 'Add client' }]} />
        <PageHeader
          title="Add client"
          subtitle="The insured party a policy is written for. Only the name is required — the rest can follow."
        />
      </div>
      <ClientForm
        mode="create"
        groups={listGroupOptions(user.org_id)}
        initial={{ client_type: 'individual', country: 'MALAYSIA' }}
      />
    </div>
  );
}
