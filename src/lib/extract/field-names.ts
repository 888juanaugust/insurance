import type { FieldKey } from './types';

/** The reader's field keys as a person reads them. */
const NAMES: Partial<Record<FieldKey, string>> = {
  policy_no: 'Policy number', cover_note_no: 'Cover note number', issue_date: 'Issue date',
  effective_date: 'Effective date', expiry_date: 'Expiry date', insured_name: 'Insured name',
  nric: 'NRIC / registration', address: 'Address', occupation: 'Occupation',
  vehicle_no: 'Vehicle number', make_model: 'Make and model', body_type: 'Body type',
  engine_no: 'Engine number', chassis_no: 'Chassis number', engine_cc: 'Engine cc',
  year_make: 'Year of make', seating: 'Seating', hire_purchase: 'Hire purchase', named_drivers: 'Named drivers',
  sum_insured: 'Sum insured', ncd_pct: 'NCD %', excess: 'Excess', windscreen_si: 'Windscreen sum insured',
  basic_premium: 'Basic premium', gross_premium: 'Gross premium', service_tax: 'Service tax',
  stamp_duty: 'Stamp duty', total_payable: 'Total payable', type_of_cover: 'Type of cover', product: 'Product',
};

export function fieldName(key: FieldKey): string {
  return NAMES[key] ?? key.replace(/_/g, ' ');
}
