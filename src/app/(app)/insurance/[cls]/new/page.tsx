import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/guard';
import { policyFormOptions, CLASS_BY_SLUG } from '@/lib/form-data';
import { getPolicy } from '@/lib/queries';
import { Crumb, PageHeader } from '@/components/ui';
import PolicyForm from '@/components/PolicyForm';

export const dynamic = 'force-dynamic';

function addYear(iso: string): string {
  const d = new Date(iso);
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

export default async function NewPolicyPage({
  params, searchParams,
}: {
  params: Promise<{ cls: string }>;
  searchParams: Promise<{ renewal?: string; from?: string }>;
}) {
  const user = await requireAdmin();

  const { cls: slug } = await params;
  const { renewal, from } = await searchParams;
  /*
   * Reached from the Quotations screen. The form used to open with the status
   * on Active, so "New motor quote" wrote a live policy unless the person
   * noticed and changed it — which is the opposite of what the button said.
   */
  const quoting = from === 'quote';
  const cls = CLASS_BY_SLUG[slug];
  if (!cls) notFound();

  const options = policyFormOptions(user.org_id);
  const title = cls === 'motor' ? 'General Motor' : 'General Non-Motor';

  /*
   * A renewal is last year's policy with new dates. Prefilling from it is most
   * of the work, and carrying its id through is what lets the retention report
   * tell a renewal from a lapse — without the link the two are
   * indistinguishable afterwards.
   */
  const previous = renewal ? getPolicy(renewal, user.org_id) : undefined;
  const prior = previous && previous.policy.org_id === user.org_id ? previous : undefined;
  const p = prior?.policy as Record<string, any> | undefined;
  const motor = prior?.motor as Record<string, any> | undefined;

  const initial: Record<string, string | number | null> = p
    ? {
        status: 'active',
        case_type: 'renewal',
        renewed_from: p.id,
        client_id: p.client_id,
        principal_id: p.principal_id,
        sub_agent_id: p.sub_agent_id ?? '',
        product: p.product,
        type_of_cover: p.type_of_cover,
        // The new year runs from where the old one ended.
        effective_date: p.expiry_date,
        expiry_date: addYear(p.expiry_date),
        sum_insured: p.sum_insured,
        ncd_pct: p.ncd_pct,
        excess: p.excess,
        commission_rate: p.commission_rate,
        /*
         * Last year's figures, as a starting point rather than an answer. A
         * renewal premium moves — the discount steps up, or a claim has reset
         * it, and the sum insured depreciates — so the header says to check
         * them. An empty form would mean keying the whole policy again.
         */
        basic_premium: p.basic_premium,
        ncd_amount: p.ncd_amount,
        extra_premium: p.extra_premium,
        gross_premium: p.gross_premium,
        service_tax: p.service_tax,
        stamp_duty: p.stamp_duty,
        total_premium: p.total_premium,
        vehicle_no: motor?.vehicle_no ?? '',
        make_model: motor?.make_model ?? '',
        body_type: motor?.body_type ?? '',
        engine_no: motor?.engine_no ?? '',
        chassis_no: motor?.chassis_no ?? '',
        engine_cc: motor?.engine_cc ?? '',
        year_make: motor?.year_make ?? '',
        seating: motor?.seating ?? '',
        hire_purchase: motor?.hire_purchase ?? '',
        referral_fee: 0,
      }
    : { status: quoting ? 'quotation' : 'active', case_type: 'new', referral_fee: 0 };

  return (
    <div className="space-y-4">
      <div className="panel px-6 py-6">
        <Crumb items={[{ href: `/insurance/${slug}`, label: title }, { label: quoting ? 'New quotation' : 'Create Policy' }]} />
        <PageHeader
          title={p ? `Renew ${p.policy_no}` : quoting ? 'New quotation' : 'Create Policy'}
          subtitle={
            p
              ? `Carried over from last year. Check the premium and the no-claim discount — a claim may have reset it.`
              : quoting
                ? 'Saved with the status Quotation: it sits on the register as a quote, off the expiring list and the money reports, until you change it to Active.'
                : 'Key in a policy by hand.'
          }
        />
      </div>
      <PolicyForm
        mode="create"
        cls={cls}
        {...options}
        initial={initial}
      />
    </div>
  );
}
