/**
 * The premium arithmetic, on its own.
 *
 * Every premium the system stores comes through here — from the review form,
 * from Create Policy, from a batch of thirty — so it is one function with no
 * form, no database and no session, which means it can be tested with plain
 * values and every rule below can be asserted in a line.
 */
export const r2 = (n: number): number => Math.round(n * 100) / 100;

/** A form value as a number, with thousands separators tolerated; 0 when blank. */
export function readNumber(raw: string | null | undefined): number {
  const n = Number(String(raw ?? '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

export type PremiumFigures = {
  gross_premium: number;
  service_tax: number;
  stamp_duty: number;
  total_premium: number;
  commission_rate: number;
  commission_amt: number;
  ncd_pct: number;
  extra_premium: number;
  basic_premium: number;
  ncd_amount: number;
};

/**
 * `get(name)` returns the raw form value, or '' when the field was absent.
 *
 * - Total payable: as typed; otherwise gross + tax + stamp.
 * - Commission: as typed — and a typed 0 IS a figure, the nil-commission
 *   case (a staff policy, an accommodation case); only a blank means
 *   "work it out from the rate".
 * - Basic premium: as typed; otherwise worked back from gross and the NCD.
 */
export function policyFigures(get: (name: string) => string): PremiumFigures {
  const gross = readNumber(get('gross_premium'));
  const tax = readNumber(get('service_tax'));
  const stamp = readNumber(get('stamp_duty'));
  const totalField = readNumber(get('total_premium'));
  const total = totalField > 0 ? totalField : r2(gross + tax + stamp);

  const commissionRate = readNumber(get('commission_rate'));
  const commissionAmt = get('commission_amt').trim() === ''
    ? r2(gross * (commissionRate / 100))
    : readNumber(get('commission_amt'));

  const ncdPct = readNumber(get('ncd_pct'));
  const extra = readNumber(get('extra_premium'));
  const basicField = readNumber(get('basic_premium'));
  const basic = basicField > 0 ? basicField : ncdPct < 100 ? r2((gross - extra) / (1 - ncdPct / 100)) : gross;

  return {
    gross_premium: gross,
    service_tax: tax,
    stamp_duty: stamp,
    total_premium: total,
    commission_rate: commissionRate,
    commission_amt: commissionAmt,
    ncd_pct: ncdPct,
    extra_premium: extra,
    basic_premium: basic,
    ncd_amount: r2(basic - (gross - extra)),
  };
}
