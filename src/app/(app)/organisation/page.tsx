import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/session';
import { getOrg, orgUsage } from '@/lib/queries';
import { money, longDate } from '@/lib/format';
import { PageHeader, Help } from '@/components/ui';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="sec-label">{label}</dt>
      <dd className="mt-1 text-[13.5px] text-ink">{value || '—'}</dd>
    </div>
  );
}

export default async function OrganisationPage() {
  const user = await currentUser();
  if (!user) redirect('/login');

  const org = getOrg(user.org_id)!;
  const usage = orgUsage(user.org_id);
  const users = getDb()
    .prepare('SELECT name, email, role, agent_code, phone, status FROM app_user WHERE org_id = ? ORDER BY role, name')
    .all(user.org_id) as Array<Record<string, string>>;

  const gross = org.plan_price;
  const sst = Math.round(gross * (org.plan_sst_pct / 100) * 100) / 100;

  return (
    <div className="space-y-4">
      <div className="panel px-6 py-6">
        <PageHeader
          title="Organisation"
          subtitle="Company particulars registered against this SimSuite subscription."
          meta={`${org.name} · code ${org.code} · live since ${longDate(org.kick_start_date)}`}
        />
        <dl className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <Field label="Company name" value={org.name} />
          <Field label="SSM business registration no" value={org.ssm_no} />
          <Field label="TIN number" value={org.tin_no} />
          <Field label="SST number" value={org.sst_no} />
          <Field label="MSIC code" value={org.msic_code} />
          <Field label="Business activity" value={org.business_desc} />
          <Field label="Contact person" value={org.contact_person} />
          <Field label="Contact number" value={org.phone} />
          <Field label="Email address" value={org.email} />
          <Field
            label="Address"
            value={
              <>
                {org.address1}
                <br />
                {org.address2}
                <br />
                {org.postcode} {org.city}
                <br />
                {org.state}, {org.country}
              </>
            }
          />
          <Field label="Kick start date" value={longDate(org.kick_start_date)} />
        </dl>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="panel">
          <div className="panel-head">
            Invoice company info
            <Help text="Printed as the letterhead on letters of collection, receipts and e-Invoices." />
          </div>
          <dl className="grid gap-5 px-6 py-5 sm:grid-cols-2">
            <Field label="Company name" value={org.name} />
            <Field label="Former name" value={org.former_name} />
            <Field label="Logo URL" value={org.logo_url} />
            <Field label="Website" value={org.website} />
            <Field label="Phone" value={org.phone} />
            <Field label="Phone 2" value={org.phone2} />
            <Field label="Email" value={org.email} />
            <Field label="Email 2" value={org.email2} />
            <Field label="BRN" value={org.ssm_no} />
            <Field label="SST" value={org.sst_no} />
          </dl>
        </div>

        <div className="panel">
          <div className="panel-head">
            Bank account
            <Help text="Where clients remit premium, shown on the letter of collection." />
          </div>
          <dl className="grid gap-5 px-6 py-5 sm:grid-cols-2">
            <Field label="Bank name" value={org.bank_name} />
            <Field label="Account name" value={org.bank_account_name} />
            <Field label="Account number" value={org.bank_account_number} />
            <Field label="Remark 1" value={org.remark1} />
            <Field label="Remark 2" value={org.remark2} />
          </dl>

          <div className="border-t border-line px-6 py-5">
            <p className="sec-label mb-3">Document numbering</p>
            <dl className="grid gap-5 sm:grid-cols-2">
              <Field label="Letter of collection prefix" value={org.loc_prefix} />
              <Field label="POS prefix" value={org.pos_prefix} />
              <Field label="Invoice template" value={org.invoice_template} />
            </dl>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="panel">
          <div className="panel-head">
            Subscription
            <Help text="Standard package terms as set out in Schedule 2 of the onboarding pack." />
          </div>
          <dl className="grid gap-5 px-6 py-5 sm:grid-cols-2">
            <Field label="Plan" value={org.plan_name} />
            <Field
              label="Monthly charge"
              value={`${money(gross)} + ${org.plan_sst_pct}% SST = ${money(gross + sst)}`}
            />
            <Field label="Policy quota" value={`${org.policy_quota} policies per month`} />
            <Field label="Named users included" value={`${org.named_users} (additional users RM50 / month each)`} />
            <Field label="Storage included" value={`${org.storage_gb} GB (top-ups in 20 GB blocks at RM50 / month)`} />
            <Field label="Minimum contract" value="12 months from the agreed kick start date" />
          </dl>
        </div>

        <div className="panel">
          <div className="panel-head">Usage this month</div>
          <div className="grid gap-4 px-6 py-5 sm:grid-cols-2">
            {[
              ['Policies created this month', `${usage.monthPolicies} / ${org.policy_quota}`],
              ['Policies on file', String(usage.totalPolicies)],
              ['Clients', String(usage.clients)],
              ['Sub agents', String(usage.agents)],
              ['Named users', `${usage.users} / ${org.named_users}`],
            ].map(([label, value]) => (
              <div key={label} className="rounded border border-line px-4 py-3">
                <p className="sec-label">{label}</p>
                <p className="mt-1.5 text-[20px] font-semibold tracking-tight text-ink">{value}</p>
              </div>
            ))}
          </div>
          <div className="border-t border-line px-6 py-3 text-[12.5px] text-muted">
            Exceeding {org.policy_quota} policies in any month requires an upgrade to the next tier
            (RM750 for up to 450 policies). Downgrades are not permitted after an upgrade.
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">Named users</div>
        <div className="scroll-x">
          <table className="tbl">
            <thead>
              <tr>
                <th>Name</th>
                <th>Login ID</th>
                <th>Role</th>
                <th>Agent code</th>
                <th>Contact</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.email}>
                  <td className="font-semibold text-ink">{u.name}</td>
                  <td className="text-ink-soft">{u.email}</td>
                  <td className="text-ink-soft capitalize">{u.role}</td>
                  <td className="text-ink-soft">{u.agent_code}</td>
                  <td className="text-ink-soft">{u.phone}</td>
                  <td>
                    <span className={`badge ${u.status === 'active' ? 'badge-green' : 'badge-grey'}`}>
                      {u.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
