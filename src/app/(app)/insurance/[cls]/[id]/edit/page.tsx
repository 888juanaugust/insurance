import { notFound, redirect } from 'next/navigation';
import { currentUser } from '@/lib/session';
import { getPolicy } from '@/lib/queries';
import { policyFormOptions, CLASS_BY_SLUG } from '@/lib/form-data';
import { Crumb, PageHeader } from '@/components/ui';
import PolicyForm from '@/components/PolicyForm';

export const dynamic = 'force-dynamic';

export default async function EditPolicyPage({
  params,
}: {
  params: Promise<{ cls: string; id: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect('/login');

  const { cls: slug, id } = await params;
  if (!CLASS_BY_SLUG[slug]) notFound();

  const data = getPolicy(id);
  if (!data || data.policy.org_id !== user.org_id) notFound();

  const { policy, motor, nonMotor } = data;
  const options = policyFormOptions(user.org_id);

  const initial: Record<string, string | number | null> = {
    policy_id: policy.id,
    policy_no: policy.policy_no, cover_note_no: policy.cover_note_no,
    principal_id: policy.principal_id, sub_agent_id: policy.sub_agent_id,
    client_id: policy.client_id,
    product: policy.product, type_of_cover: policy.type_of_cover,
    status: policy.status, case_type: policy.case_type,
    issue_date: policy.issue_date, effective_date: policy.effective_date, expiry_date: policy.expiry_date,
    sum_insured: policy.sum_insured, ncd_pct: policy.ncd_pct, excess: policy.excess,
    basic_premium: policy.basic_premium, extra_premium: policy.extra_premium,
    gross_premium: policy.gross_premium, service_tax: policy.service_tax,
    stamp_duty: policy.stamp_duty, total_premium: policy.total_premium,
    commission_rate: policy.commission_rate, commission_amt: policy.commission_amt,
    agent_commission: (policy as unknown as { agent_commission: number }).agent_commission ?? 0,
    referral_fee: (policy as unknown as { referral_fee: number }).referral_fee ?? 0,
    remarks: policy.remarks,
    ...(motor
      ? {
          vehicle_no: motor.vehicle_no, make_model: motor.make_model, body_type: motor.body_type,
          engine_no: motor.engine_no, chassis_no: motor.chassis_no, engine_cc: motor.engine_cc,
          year_make: motor.year_make, seating: motor.seating, hire_purchase: motor.hire_purchase,
          named_drivers: motor.named_drivers, windscreen_si: motor.windscreen_si,
        }
      : {}),
    ...(nonMotor
      ? {
          risk_type: nonMotor.risk_type, risk_address: nonMotor.risk_address,
          occupancy: nonMotor.occupancy, period_desc: nonMotor.period_desc, benefits: nonMotor.benefits,
        }
      : {}),
  };

  return (
    <div className="space-y-4">
      <div className="panel px-6 py-6">
        <Crumb
          items={[
            { href: `/insurance/${slug}`, label: slug === 'motor' ? 'General Motor' : 'General Non-Motor' },
            { href: `/insurance/${slug}/${policy.id}`, label: policy.policy_no },
            { label: 'Edit' },
          ]}
        />
        <PageHeader title={`Edit ${policy.policy_no}`} subtitle="Correct the details recorded for this policy." />
      </div>
      <PolicyForm
        mode="edit"
        cls={policy.class === 'non_motor' ? 'non_motor' : 'motor'}
        {...options}
        initial={initial}
      />
    </div>
  );
}
