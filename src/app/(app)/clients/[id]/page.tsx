import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { currentUser } from '@/lib/session';
import { getClient, listClientPolicies, listLifePlans } from '@/lib/queries';
import { classLabel, longDate, money, policyHref } from '@/lib/format';
import { Crumb, StatusBadge } from '@/components/ui';

export const dynamic = 'force-dynamic';

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="sec-label">{label}</dt>
      <dd className="mt-1 text-[13.5px] text-ink">{value || '—'}</dd>
    </div>
  );
}

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) redirect('/login');

  const { id } = await params;
  const client = getClient(id);
  if (!client || client.org_id !== user.org_id) notFound();

  const policies = listClientPolicies(id);
  const plans = listLifePlans(user.org_id).filter((p) => p.client_id === id);
  const premium = policies.reduce((s, p) => s + p.total_premium, 0);

  return (
    <div className="space-y-4">
      <div className="panel px-6 py-6">
        <Crumb items={[{ href: '/clients', label: 'Clients' }, { label: client.name }]} />
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-[24px] font-semibold tracking-tight text-ink">{client.name}</h1>
            <p className="mt-1 text-[13px] text-ink-soft capitalize">
              {client.client_type} · {client.nric || client.business_reg || 'No identifier on file'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`badge ${client.portal_enabled ? 'badge-green' : 'badge-grey'}`}>
              Client portal {client.portal_enabled ? 'enabled' : 'disabled'}
            </span>
          </div>
        </div>

        <dl className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <Field label="Email" value={client.email} />
          <Field label="Contact number" value={client.phone} />
          <Field label="Date of birth" value={client.dob ? longDate(client.dob) : '—'} />
          <Field label="Occupation" value={client.occupation} />
          <Field
            label="Address"
            value={
              <>
                {client.address1}
                {client.address2 && <><br />{client.address2}</>}
                <br />
                {client.postcode} {client.city}
                <br />
                {client.state}, {client.country}
              </>
            }
          />
          <Field label="Grouping" value={client.group_name ?? 'Not grouped'} />
          <Field label="Policies" value={`${policies.length} · ${money(premium)} total premium`} />
          <Field label="Registered" value={longDate(client.created_at)} />
        </dl>
      </div>

      <div className="panel">
        <div className="panel-head">Policies</div>
        <div className="scroll-x">
          <table className="tbl">
            <thead>
              <tr>
                <th>Policy no</th>
                <th>Principal</th>
                <th>Class</th>
                <th>Product</th>
                <th>Vehicle / risk</th>
                <th>Period</th>
                <th className="num">Total premium</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {policies.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link
                      href={policyHref(p.class, p.id)}
                      className="link-red"
                    >
                      {p.policy_no}
                    </Link>
                  </td>
                  <td className="font-semibold text-brand">{p.principal}</td>
                  <td className="text-ink-soft">{classLabel(p.class)}</td>
                  <td className="text-ink-soft">{p.product}</td>
                  <td className="text-ink-soft">{p.vehicle_no ?? '—'}</td>
                  <td className="text-ink-soft">
                    {longDate(p.effective_date)} – {longDate(p.expiry_date)}
                  </td>
                  <td className="num">{money(p.total_premium)}</td>
                  <td><StatusBadge status={p.status} /></td>
                </tr>
              ))}
              {policies.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-[13px] text-muted">
                    No policies recorded for this client.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {plans.length > 0 && (
        <div className="panel">
          <div className="panel-head">Life planning</div>
          <div className="scroll-x">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Plan</th>
                  <th>Provider</th>
                  <th>Type</th>
                  <th className="num">Sum assured</th>
                  <th className="num">Premium</th>
                  <th>Frequency</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {plans.map((p) => (
                  <tr key={p.id}>
                    <td className="font-semibold text-ink">{p.plan_name}</td>
                    <td className="text-ink-soft">{p.provider}</td>
                    <td className="text-ink-soft">{p.plan_type}</td>
                    <td className="num">{money(p.sum_assured)}</td>
                    <td className="num">{money(p.premium)}</td>
                    <td className="text-ink-soft">{p.frequency}</td>
                    <td><StatusBadge status={p.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
