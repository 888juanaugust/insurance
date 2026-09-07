export const FIELD_KEYS = [
  'policy_no', 'cover_note_no', 'issue_date', 'effective_date', 'expiry_date',
  'insured_name', 'nric', 'address', 'occupation',
  'vehicle_no', 'make_model', 'body_type', 'engine_no', 'chassis_no',
  'engine_cc', 'year_make', 'seating', 'hire_purchase', 'named_drivers',
  'sum_insured', 'ncd_pct', 'excess', 'windscreen_si',
  'basic_premium', 'gross_premium', 'service_tax', 'stamp_duty', 'total_payable',
  'type_of_cover', 'product',
] as const;

export type FieldKey = (typeof FIELD_KEYS)[number];

export const NUMERIC_FIELDS: FieldKey[] = [
  'sum_insured', 'ncd_pct', 'excess', 'windscreen_si', 'seating',
  'basic_premium', 'gross_premium', 'service_tax', 'stamp_duty', 'total_payable',
];

export const DATE_FIELDS: FieldKey[] = ['issue_date', 'effective_date', 'expiry_date'];

export type FieldResult = {
  value: string | number | null;
  /** 0–1. Rules that matched an explicit label score high; inferred values score lower. */
  confidence: number;
  source: 'rule' | 'claude' | 'derived' | 'none';
  evidence?: string;
};

export type ExtractionResult = {
  fields: Record<FieldKey, FieldResult>;
  /** Short name of the detected insurer, e.g. "LIBERTY". */
  principal: string | null;
  principalConfidence: number;
  /** motor | non_motor */
  cls: 'motor' | 'non_motor';
  pageCount: number;
  usedClaude: boolean;
  claudeError?: string;
  /** Why the model did not read this document, when it did not. */
  modelSkipped?: 'not needed' | 'unavailable' | 'off';
  warnings: string[];
  /** What happened when nothing is wrong: learned labels used, the model not needed. */
  notes: string[];
};

export function emptyFields(): Record<FieldKey, FieldResult> {
  return Object.fromEntries(
    FIELD_KEYS.map((k) => [k, { value: null, confidence: 0, source: 'none' as const }]),
  ) as Record<FieldKey, FieldResult>;
}
