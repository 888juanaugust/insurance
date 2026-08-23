import { normaliseHeader } from './csv';

/**
 * What a spreadsheet column means, and what makes a value acceptable.
 *
 * Agencies export from whatever they were using before, so a column is matched
 * on any of several names people actually write. Nothing is guessed beyond the
 * header: a value that cannot be read is reported, never quietly dropped.
 */

export type FieldSpec = {
  key: string;
  label: string;
  /** Header spellings seen in the wild, normalised for comparison. */
  aliases: string[];
  required?: boolean;
  /** Returns an error message, or null when the value is acceptable. */
  validate?: (value: string, row: Record<string, string>) => string | null;
  /** Tidy a value before it is stored. */
  clean?: (value: string) => string;
  hint?: string;
};

export type ImportKind = 'clients' | 'policies';

const NRIC = /^\d{6}-\d{2}-\d{4}$/;
const BUSINESS_REG = /^(\d{12}|\d{6,8}-[A-Z0-9]{1,2})$/i;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/;
const POSTCODE = /^\d{5}$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const upper = (v: string) => v.toUpperCase();
const asIs = (v: string) => v;

/**
 * Dates arrive as 01/03/2026, 1-3-26, 2026-03-01 and Excel serial numbers.
 * Day-first is assumed because that is how Malaysia writes them; an ambiguous
 * value is still converted, so the preview showing the result matters.
 */
export function readDate(value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  if (ISO_DATE.test(v)) return v;

  // Excel serial: days since 1899-12-30.
  if (/^\d{5}$/.test(v)) {
    const ms = (Number(v) - 25569) * 86400000;
    const d = new Date(ms);
    return Number.isFinite(ms) ? d.toISOString().slice(0, 10) : null;
  }

  const m = v.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (m) {
    const day = Number(m[1]);
    const month = Number(m[2]);
    let year = Number(m[3]);
    if (year < 100) year += year < 70 ? 2000 : 1900;
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }
  return null;
}

export function readNumber(value: string): number | null {
  const v = value.replace(/[,\s]/g, '').replace(/^RM/i, '');
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

const dateField = (key: string, label: string, aliases: string[], required = false): FieldSpec => ({
  key, label, aliases: aliases.map(normaliseHeader), required,
  validate: (v) => (!v ? null : readDate(v) ? null : `“${v}” is not a date Insurhelp can read. Use 2026-03-01 or 01/03/2026.`),
  clean: (v) => readDate(v) ?? '',
  hint: 'yyyy-mm-dd or dd/mm/yyyy',
});

const moneyField = (key: string, label: string, aliases: string[]): FieldSpec => ({
  key, label, aliases: aliases.map(normaliseHeader),
  validate: (v) => (!v ? null : readNumber(v) === null ? `“${v}” is not an amount.` : readNumber(v)! < 0 ? 'An amount cannot be negative.' : null),
  clean: (v) => String(readNumber(v) ?? ''),
});

export const CLIENT_FIELDS: FieldSpec[] = [
  {
    key: 'name', label: 'Name', required: true,
    aliases: ['name', 'client name', 'insured', 'insured name', 'nama'].map(normaliseHeader),
    validate: (v) => (v.length > 120 ? 'Longer than 120 characters.' : null),
  },
  {
    key: 'client_type', label: 'Type',
    aliases: ['type', 'client type', 'individual or company'].map(normaliseHeader),
    clean: (v) => (/comp|sdn|bhd|business/i.test(v) ? 'company' : 'individual'),
    hint: 'individual or company — inferred from the identifier when blank',
  },
  {
    key: 'nric', label: 'NRIC',
    aliases: ['nric', 'ic', 'ic no', 'nric no', 'identity card', 'no kad pengenalan'].map(normaliseHeader),
    clean: upper,
    validate: (v) => (!v || NRIC.test(v) ? null : `“${v}” is not an NRIC. The format is 880101-14-5566.`),
  },
  {
    key: 'business_reg', label: 'Business registration',
    aliases: ['business reg', 'business registration', 'ssm', 'ssm no', 'company no', 'brn', 'roc'].map(normaliseHeader),
    clean: upper,
    validate: (v) => (!v || BUSINESS_REG.test(v) ? null : `“${v}” is not an SSM number. Use 201901234567 or 123456-A.`),
  },
  {
    key: 'email', label: 'Email',
    aliases: ['email', 'e-mail', 'email address'].map(normaliseHeader),
    validate: (v) => (!v || EMAIL.test(v) ? null : `“${v}” is not an email address.`),
  },
  { key: 'phone', label: 'Phone', aliases: ['phone', 'contact', 'mobile', 'tel', 'no telefon'].map(normaliseHeader) },
  { key: 'address1', label: 'Address line 1', aliases: ['address', 'address 1', 'address line 1', 'alamat'].map(normaliseHeader) },
  { key: 'address2', label: 'Address line 2', aliases: ['address 2', 'address line 2'].map(normaliseHeader) },
  {
    key: 'postcode', label: 'Postcode',
    aliases: ['postcode', 'post code', 'poskod', 'zip'].map(normaliseHeader),
    validate: (v) => (!v || POSTCODE.test(v) ? null : 'A Malaysian postcode is five digits.'),
  },
  { key: 'city', label: 'City', aliases: ['city', 'town', 'bandar'].map(normaliseHeader) },
  { key: 'state', label: 'State', aliases: ['state', 'negeri'].map(normaliseHeader) },
  { key: 'occupation', label: 'Occupation', aliases: ['occupation', 'pekerjaan', 'job'].map(normaliseHeader) },
  dateField('dob', 'Date of birth', ['dob', 'date of birth', 'birth date', 'tarikh lahir']),
];

export const POLICY_FIELDS: FieldSpec[] = [
  {
    key: 'policy_no', label: 'Policy number', required: true,
    aliases: ['policy no', 'policy number', 'policy', 'no polisi'].map(normaliseHeader),
    clean: upper,
  },
  {
    key: 'insured_name', label: 'Insured', required: true,
    aliases: ['insured', 'insured name', 'client', 'client name', 'name'].map(normaliseHeader),
  },
  {
    key: 'nric', label: 'Insured NRIC or SSM',
    aliases: ['nric', 'ic', 'nric no', 'business reg', 'ssm'].map(normaliseHeader),
    clean: upper,
    hint: 'Used to match an existing client before one is created',
  },
  {
    key: 'principal', label: 'Insurer', required: true,
    aliases: ['insurer', 'principal', 'company', 'underwriter'].map(normaliseHeader),
    hint: 'Matched against the insurer list by short or full name',
  },
  {
    key: 'class', label: 'Class',
    aliases: ['class', 'class of business', 'category'].map(normaliseHeader),
    clean: (v) => (/non.?motor|fire|pa|medical|liability|marine/i.test(v) ? 'non_motor' : 'motor'),
    hint: 'motor or non-motor — motor when blank',
  },
  { key: 'product', label: 'Product', aliases: ['product', 'plan', 'cover type', 'type of cover'].map(normaliseHeader) },
  { key: 'vehicle_no', label: 'Vehicle number', aliases: ['vehicle', 'vehicle no', 'registration no', 'plate', 'no kenderaan'].map(normaliseHeader), clean: upper },
  { key: 'make_model', label: 'Make and model', aliases: ['make model', 'make and model', 'vehicle model', 'model'].map(normaliseHeader) },
  dateField('effective_date', 'Effective date', ['effective', 'effective date', 'inception', 'start date', 'from'], true),
  dateField('expiry_date', 'Expiry date', ['expiry', 'expiry date', 'end date', 'to'], true),
  moneyField('sum_insured', 'Sum insured', ['sum insured', 'si', 'jumlah diinsuranskan']),
  moneyField('gross_premium', 'Gross premium', ['gross premium', 'gross', 'premium']),
  moneyField('service_tax', 'Service tax', ['service tax', 'sst', 'tax']),
  moneyField('stamp_duty', 'Stamp duty', ['stamp duty', 'stamp', 'duti setem']),
  moneyField('total_premium', 'Total payable', ['total', 'total payable', 'total premium', 'amount']),
  {
    key: 'ncd_pct', label: 'NCD %',
    aliases: ['ncd', 'ncd %', 'no claim discount'].map(normaliseHeader),
    validate: (v) => {
      if (!v) return null;
      const n = readNumber(v.replace('%', ''));
      if (n === null) return `“${v}” is not a percentage.`;
      return n < 0 || n > 100 ? 'An NCD is between 0 and 100%.' : null;
    },
    clean: (v) => String(readNumber(v.replace('%', '')) ?? ''),
  },
  { key: 'remarks', label: 'Remarks', aliases: ['remarks', 'notes', 'note'].map(normaliseHeader) },
];

export function fieldsFor(kind: ImportKind): FieldSpec[] {
  return kind === 'clients' ? CLIENT_FIELDS : POLICY_FIELDS;
}

export const KIND_LABEL: Record<ImportKind, string> = {
  clients: 'Clients',
  policies: 'Policies',
};

/**
 * Match spreadsheet headers to fields. Returns the column index per field, and
 * the headers nothing claimed — those are shown rather than ignored, because a
 * column silently left out is data the agency believes it imported.
 */
export function mapColumns(headers: string[], kind: ImportKind) {
  const fields = fieldsFor(kind);
  const norm = headers.map(normaliseHeader);
  const mapping: Record<string, number> = {};
  const claimed = new Set<number>();

  for (const field of fields) {
    // Exact alias first, then a header that starts with one — "Policy No (new)"
    // should still find the policy number.
    let idx = norm.findIndex((h, i) => !claimed.has(i) && field.aliases.includes(h));
    if (idx < 0) {
      idx = norm.findIndex(
        (h, i) => !claimed.has(i) && field.aliases.some((a) => a.length >= 4 && h.startsWith(a)),
      );
    }
    if (idx >= 0) {
      mapping[field.key] = idx;
      claimed.add(idx);
    }
  }

  const unmatched = headers.filter((_, i) => !claimed.has(i));
  const missingRequired = fields.filter((f) => f.required && mapping[f.key] === undefined);

  return { mapping, unmatched, missingRequired };
}
