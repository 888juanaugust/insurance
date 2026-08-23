/**
 * Mid-term changes to a policy, and the money they move.
 *
 * Plain module: both server actions and client components read it, and a
 * `'use server'` file may only export async functions.
 */

export const ENDORSEMENT_TYPES = [
  { value: 'vehicle_change', label: 'Change of vehicle', effect: 'either' },
  { value: 'sum_insured', label: 'Change of sum insured', effect: 'either' },
  { value: 'named_driver', label: 'Named driver added or removed', effect: 'either' },
  { value: 'extension', label: 'Extension added', effect: 'additional' },
  { value: 'hire_purchase', label: 'Hire purchase interest', effect: 'nil' },
  { value: 'ownership', label: 'Transfer of ownership', effect: 'either' },
  { value: 'address', label: 'Change of address or particulars', effect: 'nil' },
  { value: 'cancellation', label: 'Cancellation', effect: 'refund' },
  { value: 'other', label: 'Other', effect: 'either' },
] as const;

export const TYPE_LABEL: Record<string, string> = Object.fromEntries(
  ENDORSEMENT_TYPES.map((t) => [t.value, t.label]),
);

export const ENDORSEMENT_STATUSES = [
  { value: 'draft', label: 'Draft' },
  { value: 'submitted', label: 'Submitted to insurer' },
  { value: 'issued', label: 'Issued' },
  { value: 'cancelled', label: 'Cancelled' },
] as const;

export const STATUS_LABEL: Record<string, string> = Object.fromEntries(
  ENDORSEMENT_STATUSES.map((s) => [s.value, s.label]),
);

export function isEndorsementType(v: string): boolean {
  return ENDORSEMENT_TYPES.some((t) => t.value === v);
}
export function isEndorsementStatus(v: string): boolean {
  return ENDORSEMENT_STATUSES.some((s) => s.value === v);
}

export const SERVICE_TAX_PCT = 8;
/** Stamp duty is a flat RM10 on an endorsement that charges additional premium. */
export const STAMP_DUTY = 10;

const DAY = 86_400_000;

export function daysBetween(from: string, to: string): number {
  const a = Date.parse(from);
  const b = Date.parse(to);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.round((b - a) / DAY);
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * The customary Malaysian motor short-period scale: the percentage of the
 * annual premium the insurer keeps for the time the policy was on risk.
 *
 * A cancellation refund is NOT pro-rata. Someone who cancels after four months
 * gets back 50%, not the 67% the calendar would suggest — the insurer keeps
 * the difference because most of the risk of a year sits in its early months
 * and the administration is already done. Quoting a client the pro-rata figure
 * and paying them the short-period one is a complaint every time.
 *
 * Insurers publish their own tables and a few differ; this is the scale in
 * common use, and the endorsement records which basis was applied.
 */
const SHORT_PERIOD: Array<{ maxDays: number; retainedPct: number; label: string }> = [
  { maxDays: 7, retainedPct: 10, label: 'not exceeding 1 week' },
  { maxDays: 30, retainedPct: 20, label: 'not exceeding 1 month' },
  { maxDays: 60, retainedPct: 30, label: 'not exceeding 2 months' },
  { maxDays: 90, retainedPct: 40, label: 'not exceeding 3 months' },
  { maxDays: 120, retainedPct: 50, label: 'not exceeding 4 months' },
  { maxDays: 150, retainedPct: 60, label: 'not exceeding 5 months' },
  { maxDays: 180, retainedPct: 70, label: 'not exceeding 6 months' },
  { maxDays: 210, retainedPct: 75, label: 'not exceeding 7 months' },
  { maxDays: 240, retainedPct: 80, label: 'not exceeding 8 months' },
  { maxDays: 270, retainedPct: 85, label: 'not exceeding 9 months' },
];

export function shortPeriodRetained(daysOnRisk: number): { pct: number; label: string } {
  if (daysOnRisk <= 0) return { pct: 0, label: 'no period on risk' };
  for (const band of SHORT_PERIOD) {
    if (daysOnRisk <= band.maxDays) return { pct: band.retainedPct, label: band.label };
  }
  return { pct: 100, label: 'exceeding 9 months — no refund' };
}

export type PremiumWorking = {
  basis: 'pro_rata' | 'short_period' | 'nil';
  /** Negative for a refund. */
  gross: number;
  serviceTax: number;
  stampDuty: number;
  total: number;
  daysOnRisk: number;
  daysUnexpired: number;
  coverDays: number;
  /** Plain sentences a person can read back to the client. */
  explanation: string[];
};

/**
 * Works out what an endorsement costs or returns.
 *
 * `annualDifference` is the change in annual premium the endorsement causes —
 * positive when cover goes up, negative when it comes down. For a cancellation
 * it is ignored and the whole annual premium is refunded on the short-period
 * scale instead.
 */
export function calculateEndorsement(args: {
  type: string;
  effectiveDate: string;
  policyStart: string;
  policyEnd: string;
  annualDifference: number;
  annualPremium: number;
}): PremiumWorking {
  const { type, effectiveDate, policyStart, policyEnd, annualDifference, annualPremium } = args;

  const coverDays = Math.max(1, daysBetween(policyStart, policyEnd));
  const daysOnRisk = Math.max(0, Math.min(coverDays, daysBetween(policyStart, effectiveDate)));
  const daysUnexpired = Math.max(0, coverDays - daysOnRisk);

  if (type === 'cancellation') {
    const { pct, label } = shortPeriodRetained(daysOnRisk);
    const retained = r2((annualPremium * pct) / 100);
    const gross = r2(-(annualPremium - retained));
    // Tax follows the premium back. Stamp duty does not — it was paid once on
    // the policy and is not refundable.
    const serviceTax = r2((gross * SERVICE_TAX_PCT) / 100);
    return {
      basis: 'short_period',
      gross,
      serviceTax,
      stampDuty: 0,
      total: r2(gross + serviceTax),
      daysOnRisk,
      daysUnexpired,
      coverDays,
      explanation: [
        `On risk ${daysOnRisk} of ${coverDays} days (${label}).`,
        `The insurer keeps ${pct}% of the annual premium — ${retained.toFixed(2)} of ${annualPremium.toFixed(2)}.`,
        `Refund ${Math.abs(gross).toFixed(2)} plus ${Math.abs(serviceTax).toFixed(2)} service tax.`,
        'Short-period scale, not pro-rata: the refund is smaller than the calendar suggests. Stamp duty is not refundable.',
      ],
    };
  }

  if (!annualDifference) {
    return {
      basis: 'nil',
      gross: 0, serviceTax: 0, stampDuty: 0, total: 0,
      daysOnRisk, daysUnexpired, coverDays,
      explanation: ['No change in premium — the endorsement records the change only.'],
    };
  }

  // Mid-term changes are charged on the unexpired part of the year.
  const gross = r2((annualDifference * daysUnexpired) / coverDays);
  const serviceTax = r2((gross * SERVICE_TAX_PCT) / 100);
  const stampDuty = gross > 0 ? STAMP_DUTY : 0;

  return {
    basis: 'pro_rata',
    gross,
    serviceTax,
    stampDuty,
    total: r2(gross + serviceTax + stampDuty),
    daysOnRisk,
    daysUnexpired,
    coverDays,
    explanation: [
      `${daysUnexpired} of ${coverDays} days unexpired from ${effectiveDate}.`,
      `${annualDifference > 0 ? 'Additional' : 'Return'} premium ${Math.abs(annualDifference).toFixed(2)} a year, pro-rated: ` +
        `${Math.abs(annualDifference).toFixed(2)} × ${daysUnexpired}/${coverDays} = ${Math.abs(gross).toFixed(2)}.`,
      `Service tax at ${SERVICE_TAX_PCT}% is ${Math.abs(serviceTax).toFixed(2)}.`,
      gross > 0
        ? `Stamp duty ${STAMP_DUTY.toFixed(2)} applies to an additional premium.`
        : 'No stamp duty on a return premium.',
    ],
  };
}
