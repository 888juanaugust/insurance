import type { FieldKey, FieldResult } from './types';

/**
 * A wrongly-confident value is worse than a blank one: it survives review and
 * lands in the register. Every rule hit is checked here, and anything failing
 * is discarded so the Claude pass or the person reviewing supplies it instead.
 */

const LABEL_NOISE =
  /\b(No\.|Polisi|Pendaftaran|Perlindungan|Premium|Insured\s*\/|Dikeluarkan|Diinsuranskan|Jenis|Tarikh|Kenderaan|Casis|Enjin|Berbayar|shall pay|e-mail|Capacity|Engine|Issued|Registration|Signature|Tandatangan|Authorised|Account|Agent|Schedule|Jadual)\b/i;

const COVER_WORDS =
  /\b(COMPREHENSIVE|THIRD PARTY|ACT ONLY|TPFT|FIRE|THEFT|AKTA SAHAJA|PIHAK KETIGA)\b/i;

const PRODUCT_WORDS =
  /\b(PRIVATE CAR|COMMERCIAL|MOTORCYCLE|MOTOR CYCLE|GOODS|VAN|LORRY|BUS|TAXI|SECURE|E-ASSIST)\b/i;

const VALIDATORS: Partial<Record<FieldKey, (v: string | number) => boolean>> = {
  policy_no: (v) => typeof v === 'string' && /^[A-Z0-9][A-Z0-9/_.-]{4,39}$/i.test(v) && /\d/.test(v) && !LABEL_NOISE.test(v),
  cover_note_no: (v) => typeof v === 'string' && /^[A-Z0-9][A-Z0-9/_.-]{4,39}$/i.test(v) && /\d/.test(v) && !LABEL_NOISE.test(v),

  insured_name: (v) => {
    if (typeof v !== 'string') return false;
    // "A/L" and "A/P" are patronymic connectors in Malaysian names, not separators.
    const name = v.replace(/\bA\s*[/]\s*[LP]\b/gi, 'AL');
    return (
      name.length >= 3 && name.length <= 80 &&
      !LABEL_NOISE.test(name) &&
      !/[:/\\]/.test(name) &&
      /^[A-Za-z][A-Za-z .,'@()-]*$/.test(name) &&
      /[A-Za-z]{3}/.test(name)
    );
  },

  nric: (v) => typeof v === 'string' && (/^\d{6}-\d{2}-\d{4}$/.test(v) || /^\d{12}$/.test(v) || /^\d{6,}-[A-Z0-9]{1,3}$/i.test(v) || /^\d{12}\s*\(\d{6,}-[A-Z]\)$/i.test(v)),

  // Malaysian plates: 1–3 letters, 1–4 digits, optional trailing letter.
  vehicle_no: (v) => typeof v === 'string' && /^[A-Z]{1,3}\s?\d{1,4}\s?[A-Z]?$/.test(v.trim()),

  make_model: (v) =>
    typeof v === 'string' &&
    v.length >= 3 && v.length <= 60 &&
    !/[:]/.test(v) &&
    !/\d{1,3}(,\d{3})*\.\d{2}/.test(v) &&
    !LABEL_NOISE.test(v) &&
    /[A-Za-z]{3}/.test(v),

  engine_no: (v) => typeof v === 'string' && /^[A-Z0-9-]{5,25}$/i.test(v) && /\d/.test(v),
  chassis_no: (v) => typeof v === 'string' && /^[A-Z0-9-]{8,30}$/i.test(v) && /\d/.test(v),

  engine_cc: (v) => typeof v === 'number' && v >= 50 && v <= 30000,
  year_make: (v) => typeof v === 'number' && v >= 1950 && v <= new Date().getFullYear() + 1,
  seating: (v) => typeof v === 'number' && v >= 1 && v <= 80,

  sum_insured: (v) => typeof v === 'number' && v >= 100 && v <= 100_000_000,
  ncd_pct: (v) => typeof v === 'number' && v >= 0 && v <= 100,
  excess: (v) => typeof v === 'number' && v >= 0 && v <= 1_000_000,
  windscreen_si: (v) => typeof v === 'number' && v >= 0 && v <= 1_000_000,

  basic_premium: (v) => typeof v === 'number' && v > 0 && v <= 10_000_000,
  gross_premium: (v) => typeof v === 'number' && v > 0 && v <= 10_000_000,
  service_tax: (v) => typeof v === 'number' && v >= 0 && v <= 1_000_000,
  stamp_duty: (v) => typeof v === 'number' && v >= 0 && v <= 10_000,
  total_payable: (v) => typeof v === 'number' && v > 0 && v <= 10_000_000,

  type_of_cover: (v) => typeof v === 'string' && v.length <= 60 && COVER_WORDS.test(v),
  product: (v) => typeof v === 'string' && v.length <= 60 && PRODUCT_WORDS.test(v),

  issue_date: isDate,
  effective_date: isDate,
  expiry_date: isDate,

  hire_purchase: (v) => typeof v === 'string' && v.length <= 60 && !LABEL_NOISE.test(v),
  named_drivers: (v) => typeof v === 'string' && v.length <= 80,
  occupation: (v) => typeof v === 'string' && v.length <= 40 && !LABEL_NOISE.test(v) && /^[A-Za-z][A-Za-z ,.'-]*$/.test(v),
};

function isDate(v: string | number): boolean {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const year = Number(v.slice(0, 4));
  return year >= 1990 && year <= 2100;
}

/** True when the value is plausible for its field. */
export function isValid(key: FieldKey, value: string | number | null): boolean {
  if (value === null || value === '') return false;
  const check = VALIDATORS[key];
  return check ? check(value) : true;
}

/** Drop every field whose value fails its validator. */
export function pruneInvalid(
  fields: Record<FieldKey, FieldResult>,
): { pruned: FieldKey[] } {
  const pruned: FieldKey[] = [];
  for (const key of Object.keys(fields) as FieldKey[]) {
    const f = fields[key];
    if (f.value === null) continue;
    if (!isValid(key, f.value)) {
      pruned.push(key);
      fields[key] = { value: null, confidence: 0, source: 'none' };
    }
  }
  return { pruned };
}

/**
 * Cross-field sanity: a total that is not gross + tax + stamp means at least
 * one of the four was misread, so the least trustworthy one is dropped.
 */
export function checkPremiumConsistency(
  fields: Record<FieldKey, FieldResult>,
): string | null {
  const n = (k: FieldKey) => (typeof fields[k].value === 'number' ? (fields[k].value as number) : null);
  const gross = n('gross_premium');
  const tax = n('service_tax');
  const stamp = n('stamp_duty');
  const total = n('total_payable');
  if (gross === null || tax === null || stamp === null || total === null) return null;

  const sum = Math.round((gross + tax + stamp) * 100) / 100;
  if (Math.abs(sum - total) <= 0.05) return null;

  // Service tax is 8% of gross in Malaysia — use it to decide which figure lies.
  const taxLooksRight = Math.abs(gross * 0.08 - tax) <= Math.max(1, gross * 0.005);
  const suspect: FieldKey = taxLooksRight ? 'stamp_duty' : 'gross_premium';
  const label = suspect === 'stamp_duty' ? 'Stamp duty' : 'Gross premium';
  fields[suspect] = { value: null, confidence: 0, source: 'none' };

  return `${label} was dropped — ${gross.toFixed(2)} + ${tax.toFixed(2)} + ${stamp.toFixed(2)} does not equal the total payable of ${total.toFixed(2)}.`;
}
