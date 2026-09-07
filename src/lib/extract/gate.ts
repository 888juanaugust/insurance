import type { ExtractionResult, FieldKey } from './types';

/**
 * Whether the rules read enough that the model need not be paid to look.
 *
 * The model pass used to run on every upload, including the three insurers
 * whose schedules the rules read exactly. That was a second opinion bought
 * for every document; most of the bill was for documents that did not need
 * one. Now the rules go first and the model is sent for only when they fell
 * short — and this is the one place that decides what "short" means, so it
 * can be read, argued with, and changed.
 *
 * Short is any of: the document is a scan (the rules read text, and there is
 * none); the insurer was not recognised (no profile, no learned labels, and
 * a layout nobody has seen); a field the register cannot do without is
 * missing or came from a weak match; or too few of the fields a schedule
 * usually carries were read at all. IH_MODEL_PASS=always sends everything
 * regardless, for an agency that wants the cross-check on every document.
 */

/** A rule hit below this came from a fallback matcher, not a labelled field. */
const CORE_MIN = 0.8;

const MOTOR_USUAL: FieldKey[] = [
  'policy_no', 'insured_name', 'nric', 'vehicle_no', 'make_model', 'engine_no', 'chassis_no',
  'effective_date', 'expiry_date', 'sum_insured', 'gross_premium', 'total_payable', 'type_of_cover',
];
const NON_MOTOR_USUAL: FieldKey[] = [
  'policy_no', 'insured_name', 'nric', 'effective_date', 'expiry_date',
  'sum_insured', 'gross_premium', 'total_payable', 'type_of_cover', 'product',
];
/** Fewer than this many of the usual fields read, and the model gets a look. */
const USUAL_MIN = { motor: 10, non_motor: 6 };

/** Why the rules alone will not do for this document — or null when they will. */
export function rulesFellShort(result: ExtractionResult, scanned: boolean): string | null {
  if (scanned) return 'the document is a scan with no text to match';
  if (!result.principal) return 'the insurer was not recognised';

  const f = result.fields;
  const solid = (key: FieldKey) => f[key].value !== null && f[key].confidence >= CORE_MIN;
  const either = (a: FieldKey, b: FieldKey) => solid(a) || solid(b);

  const missing: string[] = [];
  if (!either('policy_no', 'cover_note_no')) missing.push('policy or cover note number');
  if (!solid('insured_name')) missing.push('insured name');
  if (!solid('effective_date') || !solid('expiry_date')) missing.push('period of insurance');
  if (!either('total_payable', 'gross_premium')) missing.push('premium');
  if (result.cls === 'motor' && !solid('vehicle_no')) missing.push('vehicle number');
  if (missing.length) return `${missing.join(', ')} not read with confidence`;

  const usual = result.cls === 'motor' ? MOTOR_USUAL : NON_MOTOR_USUAL;
  const read = usual.filter((key) => f[key].value !== null).length;
  const need = USUAL_MIN[result.cls];
  if (read < need) return `only ${read} of the ${usual.length} usual fields were read`;

  return null;
}
