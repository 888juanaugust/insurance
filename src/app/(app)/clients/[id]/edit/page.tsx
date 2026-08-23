import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/guard';
import { getClient, listGroupOptions, clientPolicyCount } from '@/lib/queries';
import { Crumb, PageHeader } from '@/components/ui';
import ClientForm from '@/components/ClientForm';

export const dynamic = 'force-dynamic';

export default async function EditClientPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin();

  const { id } = await params;
  const client = getClient(id);
  if (!client || client.org_id !== user.org_id) notFound();

  return (
    <div className="space-y-4">
      <div className="panel px-6 py-6">
        <Crumb
          items={[
            { href: '/clients', label: 'Clients' },
            { href: `/clients/${id}`, label: client.name },
            { label: 'Edit' },
          ]}
        />
        <PageHeader title={`Edit ${client.name}`} subtitle="Correct the details held for this client." />
      </div>
      <ClientForm
        mode="edit"
        groups={listGroupOptions(user.org_id)}
        policyCount={clientPolicyCount(id)}
        initial={{
          client_id: client.id,
          name: client.name,
          client_type: client.client_type,
          nric: client.nric,
          business_reg: client.business_reg,
          email: client.email,
          phone: client.phone,
          address1: client.address1,
          address2: client.address2,
          postcode: client.postcode,
          city: client.city,
          state: client.state,
          country: client.country,
          dob: client.dob,
          occupation: client.occupation,
          group_id: client.group_id,
          portal_enabled: client.portal_enabled,
        }}
      />
    </div>
  );
}
