import type { PdfDoc } from './pdf';
import { emptyFields, type ExtractionResult, type FieldKey, type FieldResult } from './types';
import { isValid, pruneInvalid, checkPremiumConsistency } from './validate';
import { profileFor } from './profiles';

/* ------------------------------------------------------------------ *
 * Value normalisers
 * ------------------------------------------------------------------ */

const MONTHS: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
};

/** Malaysian policies write dates as dd/mm/yyyy, dd-mm-yyyy or dd-MMM-yyyy. */
export function toIsoDate(raw: string): string | null {
  const s = raw.trim();

  let m = s.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;

  m = s.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b/);
  if (m) {
    const d = m[1].padStart(2, '0');
    const mo = m[2].padStart(2, '0');
    if (Number(mo) >= 1 && Number(mo) <= 12 && Number(d) >= 1 && Number(d) <= 31) {
      return `${m[3]}-${mo}-${d}`;
    }
  }

  m = s.match(/\b(\d{1,2})[ -]([A-Za-z]{3})[a-z]*[ -](\d{4})\b/);
  if (m) {
    const mo = MONTHS[m[2].toLowerCase()];
    if (mo) return `${m[3]}-${mo}-${m[1].padStart(2, '0')}`;
  }
  return null;
}

export function toNumber(raw: string): number | null {
  const m = raw.replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : null;
}

const MONEY = String.raw`\d{1,3}(?:,\d{3})*(?:\.\d{2})?|\d+\.\d{2}`;

/** A cash-rounded amount for the counter, never the policy total. */
const OTC = /\bOTC\b|Kaunter|ROUNDED|Dibundarkan/i;

/* ------------------------------------------------------------------ *
 * Insurer detection
 * ------------------------------------------------------------------ */

const INSURER_SIGNATURES: { short: string; patterns: RegExp[] }[] = [
  { short: 'LIBERTY',       patterns: [/liberty general insurance/i, /\bauto365\b/i, /kurnia insurans/i] },
  { short: 'LONPAC',        patterns: [/lonpac insurance/i, /lonpac\.com/i] },
  { short: 'ALLIANZ',       patterns: [/allianz general insurance/i, /allianz malaysia/i] },
  { short: 'MSIG',          patterns: [/msig insurance/i, /\bmsig\b/i] },
  { short: 'BERJAYA SOMPO', patterns: [/berjaya sompo/i] },
  { short: 'TOKIO',         patterns: [/tokio marine/i] },
  { short: 'RHB',           patterns: [/rhb insurance/i] },
  { short: 'GENERALI',      patterns: [/generali insurance/i, /generali malaysia/i] },
  { short: 'ETIQA',         patterns: [/etiqa general/i, /etiqa insurance/i] },
  { short: 'ZURICH',        patterns: [/zurich general/i, /zurich malaysia/i] },
  { short: 'AIA',           patterns: [/\baia bhd\b/i, /aia general/i] },
  { short: 'AIG',           patterns: [/aig malaysia/i] },
  { short: 'CHUBB',         patterns: [/chubb insurance/i] },
  { short: 'GREAT EASTERN GENERAL', patterns: [/great eastern general/i] },
  { short: 'PACIFIC',       patterns: [/pacific insurance/i] },
  { short: 'PROGRESSIVE',   patterns: [/progressive insurance/i] },
  { short: 'QBE',           patterns: [/\bqbe\b/i] },
  { short: 'TAKAFUL IKHLAS',patterns: [/takaful ikhlas/i] },
  { short: 'ETIQA GENERAL TAKAFUL', patterns: [/etiqa general takaful/i] },
  { short: 'TUNE',          patterns: [/tune insurance/i, /tune protect/i] },
  { short: 'P&O',           patterns: [/pacific & orient/i, /\bp&o insurance\b/i] },
];

export function detectInsurer(text: string): { short: string; confidence: number } | null {
  for (const ins of INSURER_SIGNATURES) {
    for (const p of ins.patterns) {
      if (p.test(text)) return { short: ins.short, confidence: 0.95 };
    }
  }
  return null;
}

/* ------------------------------------------------------------------ *
 * Label matching
 * ------------------------------------------------------------------ */

/**
 * Pull the value that follows a label. Handles the three shapes these
 * schedules use: "Label : Value", "Label Value", and a label whose value
 * sits on the following line.
 */
function labelled(lines: string[], label: RegExp, valuePattern?: RegExp, sameLine = false, exclude?: RegExp): { value: string; evidence: string } | null {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (exclude && exclude.test(line)) continue;
    const m = line.match(label);
    if (!m) continue;

    const after = line.slice((m.index ?? 0) + m[0].length).replace(/^\s*[:\-–]\s*/, '').trim();
    if (after) {
      if (valuePattern) {
        const v = after.match(valuePattern);
        if (v) return { value: v[0].trim(), evidence: line };
      } else if (after.length > 0 && !/^[:\-–\s]*$/.test(after)) {
        return { value: after, evidence: line };
      }
    }

    if (sameLine) continue;

    // Value on a following line (labels stacked above their values).
    for (let j = i + 1; j < Math.min(i + 3, lines.length); j++) {
      const next = lines[j].trim();
      if (!next) continue;
      if (valuePattern) {
        const v = next.match(valuePattern);
        if (v) return { value: v[0].trim(), evidence: `${line} / ${next}` };
      } else {
        return { value: next, evidence: `${line} / ${next}` };
      }
      break;
    }
  }
  return null;
}

/** First value anywhere in the document matching a pattern. */
function anywhere(lines: string[], pattern: RegExp): { value: string; evidence: string } | null {
  for (const line of lines) {
    const m = line.match(pattern);
    if (m) return { value: (m[1] ?? m[0]).trim(), evidence: line };
  }
  return null;
}

type Matcher = {
  label?: RegExp;
  value?: RegExp;
  /** Reject values that appear on a later line than the label. */
  sameLine?: boolean;
  /** Skip lines matching this — e.g. a superseded policy number. */
  exclude?: RegExp;
  /** Applied to the whole document rather than after a label. */
  scan?: RegExp;
  confidence: number;
};

/**
 * The Bahasa half of a bilingual label, matched generically.
 *
 * Malaysian schedules label nearly every field twice — "Sum Insured / Jumlah
 * Diinsuranskan" — and insurers word the Bahasa half differently for the same
 * English term. The specific pairings below were read off real documents and
 * stay first because they are known good; this covers the ones nobody has seen
 * yet. Bounded and colon-free so it cannot swallow the value it precedes.
 */
const BM = String.raw`(?:\s*\/\s*[^:\n]{1,45})?`;

/** An English label followed by whatever Bahasa wording an insurer chose. */
function bilingual(english: string): RegExp {
  return new RegExp(english + BM + String.raw`\s*:`, 'i');
}

/**
 * Bilingual label patterns. Malaysian motor schedules print English and Bahasa
 * Malaysia labels together, and insurers word them differently, so each field
 * carries several alternatives tried in order of reliability.
 */
const MATCHERS: Partial<Record<FieldKey, Matcher[]>> = {
  policy_no: [
    { label: /Policy(?:\/Endorsement)? No\.?(?:\s*\/\s*No\.?\s*Polisi)?/i, value: /[A-Z0-9][A-Z0-9/_.-]{4,}/i, exclude: /Replacing|Renewal of|Gantian|Pembaharuan|Issued in lieu/i, confidence: 0.9 },
    { label: /No\.?\s*Polisi/i, value: /[A-Z0-9][A-Z0-9/_.-]{4,}/i, exclude: /Replacing|Renewal of|Gantian|Pembaharuan|Issued in lieu/i, confidence: 0.8 },
    { label: /Certificate No\.?(?:\s*\/\s*No\.?\s*Sijil)?/i, value: /[A-Z0-9][A-Z0-9/_.-]{4,}/i, confidence: 0.5 },
  ],
  cover_note_no: [
    { label: /(?:e-)?Cover(?:ing)? Note No\.?(?:\s*\/\s*No\.?\s*Nota(?:\s*Perlindungan)?)?/i, value: /[A-Z0-9][A-Z0-9/_.-]{4,}/i, confidence: 0.9 },
    { label: /No\.?\s*Nota Perlindungan/i, value: /[A-Z0-9][A-Z0-9/_.-]{4,}/i, confidence: 0.8 },
  ],
  issue_date: [
    { label: /Date of Issue(?:\s*\/\s*Time)?|Tarikh Dikeluarkan/i, confidence: 0.9 },
    { label: /^\s*Date\b(?!\s*of Proposal)/i, confidence: 0.6 },
  ],
  insured_name: [
    { label: /The Insured(?:\s*\/\s*Pemegang Polisi)?/i, confidence: 0.85 },
    { label: /Name of Policyholder(?:\s*\/\s*Nama Pemegang Polisi)?/i, confidence: 0.9 },
    { label: /^\s*Name\s*(?:\/\s*Nama)?\s*:/i, confidence: 0.85 },
    { label: /Insured(?:\s*\/\s*Pemunya)?\s*:/i, confidence: 0.8 },
    // Seen in the wild: "Insured / Nama Yang Diinsuranskan".
    { label: bilingual(String.raw`(?:The\s+)?Insured(?:'?s)?(?:\s+Name)?`), confidence: 0.7 },
    { label: bilingual(String.raw`Nama\s+(?:Yang\s+)?Diinsuranskan`), confidence: 0.7 },
  ],
  nric: [
    { scan: /\b(\d{6}-\d{2}-\d{4})\b/, confidence: 0.9 },
    { label: /I\.?C\.? No\.?|NRIC|No\.? Kad Pengenalan|Bus\.? Regn\.? No|No Pendaftaran Perniagaan/i, value: /[A-Z0-9][A-Z0-9-]{5,}/i, confidence: 0.7 },
  ],
  vehicle_no: [
    { label: /Vehicle Reg\.? No\.?|Registration No\.?(?:\s*\/\s*No\.?\s*Pendaftaran)?|No\.?\s*Pendaftaran/i, value: /[A-Z]{1,3}\s?\d{1,4}\s?[A-Z]{0,3}/i, confidence: 0.85 },
    // Seen in the wild: "Vehicle No / No. Kenderaan".
    { label: bilingual(String.raw`Vehicle\s*(?:Reg\.?)?\s*No\.?`), value: /[A-Z]{1,3}\s?\d{1,4}\s?[A-Z]{0,3}/i, confidence: 0.7 },
    { label: bilingual(String.raw`No\.?\s*Kenderaan`), value: /[A-Z]{1,3}\s?\d{1,4}\s?[A-Z]{0,3}/i, confidence: 0.7 },
  ],
  make_model: [
    // Stop at the next label on the line — "TOYOTA ALPHARD Chassis No. : …"
    // is a make followed by somebody else's field.
    { label: /Make (?:&|and) (?:Type of Body|Model)(?:\s*\/\s*Buatan(?:\s*(?:&|dan)\s*Jenis Badan)?)?/i, value: /^.+?(?=\s+(?:Chassis|Engine|Registration|Reg\.|Year|Vehicle)\b|$)/i, confidence: 0.85 },
    { label: /Buatan (?:&|dan) Jenis Badan/i, confidence: 0.75 },
    { label: bilingual(String.raw`Make\s*(?:&|and)\s*Model`), confidence: 0.7 },
    { label: bilingual(String.raw`Model\s*Kenderaan`), confidence: 0.65 },
  ],
  engine_no: [
    { label: /Engine(?:\/Motor)? No\.?(?:\s*\/\s*No\.?\s*Enjin(?:\/Motor)?)?/i, value: /[A-Z0-9-]{5,}/i, confidence: 0.85 },
    { label: bilingual(String.raw`Engine\s*No\.?`), value: /[A-Z0-9-]{5,}/i, confidence: 0.7 },
  ],
  chassis_no: [
    { label: /Chassis No\.?(?:\s*\/\s*No\.?\s*Casis)?/i, value: /[A-Z0-9-]{8,}/i, confidence: 0.85 },
    { label: bilingual(String.raw`Chassis\s*No\.?`), value: /[A-Z0-9-]{8,}/i, confidence: 0.7 },
  ],
  engine_cc: [
    { scan: /\b(\d{2,5})(?:\.\d+)?\s*CC\b/i, confidence: 0.8 },
    { label: /C\.?C\.?\s*\/\s*Watts?|Engine C\.?C|Keupayaan Enjin/i, value: /\d{2,5}/, confidence: 0.7 },
  ],
  year_make: [
    { label: /Year of Manufacture(?:\s*\/\s*Tahun\s*(?:Diperbuat|Dibuat))?|Tahun Diperbuat|Tahun Dibuat/i, value: /(?:19|20)\d{2}/, confidence: 0.9 },
    { label: bilingual(String.raw`Year\s*of\s*Manufacture`), value: /(?:19|20)\d{2}/, confidence: 0.75 },
  ],
  seating: [
    { label: /Seating Capacity(?:\s*Incl\.? Driver)?|Muatan Tempat Duduk|Carrying or Seating/i, value: /\d{1,2}\b/, sameLine: true, confidence: 0.8 },
  ],
  hire_purchase: [
    { label: /Hire Purchase (?:Owner|Company)(?:\s*\/\s*Pemilik Sewa Beli)?|Pemilik Sewa Beli/i, sameLine: true, confidence: 0.7 },
  ],
  named_drivers: [
    { label: /Named Drivers?(?:\s*\/\s*Pemandu Yang Dinamakan)?|Authorised Driver/i, confidence: 0.6 },
  ],
  sum_insured: [
    { label: /Sum Insured(?:\s*\/\s*Jumlah(?:\s*Diinsuranskan)?)?|Jumlah Diinsuranskan/i, value: new RegExp(MONEY), confidence: 0.85 },
    { label: bilingual(String.raw`Sum\s*Insured`), value: new RegExp(MONEY), confidence: 0.7 },
  ],
  ncd_pct: [
    { scan: /(?:NCD|NCB|Diskaun Tanpa Tuntutan)[^\d%]{0,40}(\d{1,3}(?:\.\d{1,2})?)\s*%/i, confidence: 0.85 },
  ],
  excess: [
    { label: /Compulsory Excess/i, value: new RegExp(MONEY), confidence: 0.75 },
    { label: /Excess(?:\s*\/\s*Lebihan)?|Lebihan/i, value: new RegExp(MONEY), confidence: 0.6 },
  ],
  windscreen_si: [
    { scan: /Windscreen[^\d]{0,80}?(?:RM\s*)?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/i, confidence: 0.7 },
  ],
  basic_premium: [
    { label: /\bPremium\s*\/\s*Premium\b/i, value: new RegExp(MONEY), sameLine: true, confidence: 0.8 },
    { label: /Basic Premium(?:\s*\/\s*Premium Asas)?|Premium Asas/i, value: new RegExp(MONEY), sameLine: true, confidence: 0.8 },
  ],
  gross_premium: [
    { label: /Gross Premium(?:\s*\/\s*Premium Kasar)?|Premium Kasar|GROSS PREM/i, value: new RegExp(MONEY), confidence: 0.9 },
  ],
  service_tax: [
    { label: /Service Tax(?:\s*\/\s*Cukai Perkhidmatan)?(?:\s*\d+%)?|Cukai Perkhidmatan/i, value: new RegExp(MONEY), confidence: 0.9 },
  ],
  stamp_duty: [
    { label: /Stamp Duty(?:\s*\/\s*Duti Setem)?|Duti Setem/i, value: new RegExp(MONEY), confidence: 0.9 },
  ],
  /*
   * Never the over-the-counter figure. Liberty prints "Total Due RM 1,913.44"
   * and beneath it "Total Due (OTC) / Jumlah Berbayar Di Kaunter RM 1,913.45"
   * — the same amount rounded to five sen for a cash till; Allianz prints
   * "AMOUNT PAYABLE 2,304.75 (ROUNDED)" under "TOTAL DUE 2,304.77". The
   * rounded one is not the premium, and taking it does worse than being a
   * sen out: the premium check then sees gross + tax + stamp ≠ total and
   * "corrects" a figure that was right.
   */
  total_payable: [
    { label: /Total\s*Due(?:\s*\/\s*Jumlah Berbayar)?/i, value: new RegExp(MONEY), exclude: OTC, confidence: 0.9 },
    { label: /Total Payable(?:\s*\/\s*Jumlah Berbayar)?/i, value: new RegExp(MONEY), exclude: OTC, confidence: 0.9 },
    { label: /Premium Payable|AMOUNT PAYABLE|Jumlah Berbayar/i, value: new RegExp(MONEY), exclude: OTC, confidence: 0.8 },
    { label: bilingual(String.raw`Total\s*(?:Amount\s*)?Payable`), value: new RegExp(MONEY), exclude: OTC, confidence: 0.75 },
    { label: bilingual(String.raw`Jumlah\s*(?:Perlu\s*)?Dibayar`), value: new RegExp(MONEY), exclude: OTC, confidence: 0.75 },
  ],
  type_of_cover: [
    { label: /Type of Cover(?:\s*\/\s*Jenis Perlindungan)?|Jenis Perlindungan/i, value: /(?:COMPREHENSIVE(?: PLUS)?|THIRD PARTY(?:,? FIRE (?:AND|&) THEFT)?|ACT ONLY)/i, confidence: 0.85 },
    { scan: /\b(COMPREHENSIVE(?: PLUS)?|THIRD PARTY(?:,? FIRE (?:AND|&) THEFT)?|ACT ONLY)\b/i, confidence: 0.6 },
  ],
  product: [
    { label: /Class of Policy|Jenis Insurans|Vehicle Class/i, confidence: 0.8 },
    { scan: /\b(PRIVATE CAR(?: EX(?:CLUDING)? GOODS)?|COMMERCIAL VEHICLE|MOTORCYCLE|MOTOR CYCLE)\b/i, confidence: 0.6 },
  ],
  occupation: [
    { label: /Occupation(?:\s*\/\s*Pekerjaan)?|Pekerjaan/i, confidence: 0.5 },
  ],
};

/* ------------------------------------------------------------------ *
 * Period of insurance — its own shape, not a simple label
 * ------------------------------------------------------------------ */

const DATE_RE = String.raw`\d{1,2}[/-]\d{1,2}[/-]\d{4}|\d{1,2}[ -][A-Za-z]{3}[a-z]*[ -]\d{4}|\d{4}-\d{2}-\d{2}`;

function extractPeriod(lines: string[]): { from: string; to: string; evidence: string } | null {
  const patterns = [
    new RegExp(String.raw`From\s*(?:/\s*Dari\s*)?.{0,20}?(${DATE_RE})\s*(?:To|Hingga|hours on|midnight on)?.{0,30}?(${DATE_RE})`, 'i'),
    new RegExp(String.raw`from\s+[\d:]*\s*hours on\s+(${DATE_RE})\s+to\s+midnight on\s+(${DATE_RE})`, 'i'),
    new RegExp(String.raw`Period of Insurance.{0,40}?(${DATE_RE}).{0,30}?(${DATE_RE})`, 'i'),
    new RegExp(String.raw`Tempoh Insurans.{0,40}?(${DATE_RE}).{0,30}?(${DATE_RE})`, 'i'),
  ];
  for (const line of lines) {
    for (const p of patterns) {
      const m = line.match(p);
      if (m) {
        const from = toIsoDate(m[1]);
        const to = toIsoDate(m[2]);
        if (from && to && to > from) return { from, to, evidence: line };
      }
    }
  }

  // Some layouts stack the two dates on consecutive lines under the heading.
  for (let i = 0; i < lines.length; i++) {
    if (!/Period of Insurance|Tempoh Insurans/i.test(lines[i])) continue;
    const window = lines.slice(i, i + 6).join(' ');
    const found = [...window.matchAll(new RegExp(DATE_RE, 'gi'))]
      .map((m) => toIsoDate(m[0]))
      .filter((d): d is string => Boolean(d));
    if (found.length >= 2) {
      const sorted = [...new Set(found)].sort();
      const from = sorted[0];
      const to = sorted[sorted.length - 1];
      if (to > from) return { from, to, evidence: lines[i] };
    }
  }
  return null;
}

/* ------------------------------------------------------------------ *
 * Runner
 * ------------------------------------------------------------------ */

function coerce(key: FieldKey, raw: string): string | number | null {
  if (key === 'issue_date' || key === 'effective_date' || key === 'expiry_date') return toIsoDate(raw);
  if (
    key === 'sum_insured' || key === 'ncd_pct' || key === 'excess' || key === 'windscreen_si' ||
    key === 'seating' || key === 'basic_premium' || key === 'gross_premium' ||
    key === 'service_tax' || key === 'stamp_duty' || key === 'total_payable'
  ) {
    return toNumber(raw);
  }
  const cleaned = raw.replace(/\s+/g, ' ').trim();
  // Allianz and Liberty print the NRIC as twelve bare digits; the register,
  // the search and the client record all write it 850101-05-1234.
  if (key === 'nric' && /^\d{12}$/.test(cleaned)) {
    return `${cleaned.slice(0, 6)}-${cleaned.slice(6, 8)}-${cleaned.slice(8)}`;
  }
  return cleaned.length ? cleaned : null;
}

export function extractWithRules(doc: PdfDoc): ExtractionResult {
  const fields = emptyFields();
  const warnings: string[] = [];

  // Only the first few pages carry the schedule; the rest is policy wording
  // that produces false matches.
  const lines = doc.pages.slice(0, 4).flat();
  const head = lines.join('\n');

  // The insurer decides the layout, and a layout that has been read against a
  // real document gets its own reader first. Generic matching fills whatever
  // the profile did not — and everything, for an insurer without one.
  const insurer = detectInsurer(head);
  const profile = profileFor(insurer?.short);
  if (profile) {
    for (const h of profile.read(lines)) {
      if (fields[h.key].value !== null) continue;
      const value = coerce(h.key, h.value);
      if (value === null || value === '' || !isValid(h.key, value)) continue;
      fields[h.key] = { value, confidence: h.confidence, source: 'rule', evidence: h.evidence };
    }
  }

  for (const [key, matchers] of Object.entries(MATCHERS) as [FieldKey, Matcher[]][]) {
    if (fields[key].value !== null) continue;
    for (const m of matchers) {
      const hit = m.scan ? anywhere(lines, m.scan) : m.label ? labelled(lines, m.label, m.value, m.sameLine, m.exclude) : null;
      if (!hit) continue;
      const value = coerce(key, hit.value);
      if (value === null || value === '' || !isValid(key, value)) continue;
      fields[key] = { value, confidence: m.confidence, source: 'rule', evidence: hit.evidence };
      break;
    }
  }

  const period = extractPeriod(lines);
  if (period) {
    fields.effective_date = { value: period.from, confidence: 0.9, source: 'rule', evidence: period.evidence };
    fields.expiry_date = { value: period.to, confidence: 0.9, source: 'rule', evidence: period.evidence };
  } else {
    warnings.push('Period of insurance could not be read from the document.');
  }

  pruneInvalid(fields);

  // Cover notes carry no policy number until the policy issues, and the
  // register is keyed on the number the insurer actually gave the case.
  if (fields.policy_no.value === null && fields.cover_note_no.value !== null) {
    fields.policy_no = {
      value: fields.cover_note_no.value,
      confidence: 0.7,
      source: 'derived',
      evidence: 'taken from the cover note number — no policy number issued yet',
    };
  }

  // A genuine registration number is repeated across the schedule and the
  // certificate of insurance; a one-off match is neighbouring text.
  const plate = fields.vehicle_no.value;
  if (typeof plate === 'string' && fields.vehicle_no.confidence < 0.85 && doc.pageCount > 3) {
    const bare = plate.replace(/\s+/g, '');
    const occurrences = doc.text.replace(/\s+/g, '').split(bare).length - 1;
    if (occurrences < 2) {
      fields.vehicle_no = { value: null, confidence: 0, source: 'none' };
    }
  }
  const clash = checkPremiumConsistency(fields);
  if (clash) warnings.push(clash);
  reconcilePremium(fields, warnings);

  const cls = /motor|vehicle|kenderaan|private car|motorcycle/i.test(head) ? 'motor' : 'non_motor';

  return {
    fields,
    principal: insurer?.short ?? null,
    principalConfidence: insurer?.confidence ?? 0,
    cls,
    pageCount: doc.pageCount,
    usedClaude: false,
    warnings,
  };
}

/**
 * The premium figures must satisfy gross + tax + stamp = total. When three of
 * the four are present the fourth is derivable, and when all four are present a
 * mismatch means at least one was misread.
 */
export function reconcilePremium(fields: Record<FieldKey, FieldResult>, warnings: string[]) {
  const num = (k: FieldKey) => (typeof fields[k].value === 'number' ? (fields[k].value as number) : null);
  const gross = num('gross_premium');
  const tax = num('service_tax');
  const stamp = num('stamp_duty');
  const total = num('total_payable');
  const r2 = (n: number) => Math.round(n * 100) / 100;

  const known = [gross, tax, stamp, total].filter((v) => v !== null).length;

  if (gross !== null && tax !== null && stamp !== null && total !== null) {
    if (Math.abs(r2(gross + tax + stamp) - total) > 0.05) {
      warnings.push(
        `Premium does not reconcile: ${gross.toFixed(2)} + ${tax.toFixed(2)} + ${stamp.toFixed(2)} = ` +
          `${r2(gross + tax + stamp).toFixed(2)}, but total payable reads ${total.toFixed(2)}. Please check.`,
      );
    }
    return;
  }

  if (known < 3) return;

  if (total === null && gross !== null && tax !== null && stamp !== null) {
    fields.total_payable = { value: r2(gross + tax + stamp), confidence: 0.6, source: 'derived', evidence: 'gross + tax + stamp duty' };
  } else if (gross === null && total !== null && tax !== null && stamp !== null) {
    fields.gross_premium = { value: r2(total - tax - stamp), confidence: 0.6, source: 'derived', evidence: 'total − tax − stamp duty' };
  } else if (tax === null && total !== null && gross !== null && stamp !== null) {
    fields.service_tax = { value: r2(total - gross - stamp), confidence: 0.6, source: 'derived', evidence: 'total − gross − stamp duty' };
  } else if (stamp === null && total !== null && gross !== null && tax !== null) {
    fields.stamp_duty = { value: r2(total - gross - tax), confidence: 0.6, source: 'derived', evidence: 'total − gross − tax' };
  }
}
