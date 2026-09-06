/**
 * Per-insurer reading of the schedule, by shape rather than by label.
 *
 * The generic matchers in rules.ts find a label and take what follows it,
 * which is right for a schedule that says "Chassis No. : ABC123". The real
 * documents do not oblige. Liberty prints the plate on a line of its own,
 * three lines below a label that shares its row with two other labels.
 * Allianz prints "L15ZF9307373 1498.00 CC" — engine number and capacity on
 * one line with no label at all — and the insured's name wedged between
 * INSURED and "Date of Issue". Lonpac puts two labelled values on one line,
 * so the generic reader takes the make and the chassis label together and
 * the validator throws the lot away.
 *
 * Each profile below was written against a real document from that insurer
 * and is scored against it by the harness. A profile runs before the generic
 * matchers and only for its own insurer, so it can be exact about a layout
 * without being wrong about another. A layout no profile covers still gets
 * the generic pass — this narrows nothing, it only reads more.
 */

import type { FieldKey } from './types';

export type ProfileHit = {
  key: FieldKey;
  value: string;
  evidence: string;
  confidence: number;
};

export type Profile = {
  /** The short name detectInsurer() returns. */
  insurer: string;
  read: (lines: string[]) => ProfileHit[];
};

const PLATE = String.raw`[A-Z]{1,3}\s?\d{1,4}\s?[A-Z]?`;
// With or without thousands separators: Allianz prints "Premium 2674.38".
const MONEY = String.raw`\d[\d,]*\.\d{2}`;

/* ---------------------------------------------------------------- helpers */

/** First line matching `pick`, anywhere. */
function scan(lines: string[], pick: RegExp): { m: RegExpMatchArray; line: string } | null {
  for (const line of lines) {
    const m = line.match(pick);
    if (m) return { m, line };
  }
  return null;
}

/**
 * First line matching `pick` within `span` lines after a line matching
 * `label` — for schedules that stack a value under its heading, or two or
 * three headings above a row of values.
 */
function after(
  lines: string[], label: RegExp, span: number, pick: RegExp,
): { m: RegExpMatchArray; line: string; evidence: string } | null {
  for (let i = 0; i < lines.length; i++) {
    if (!label.test(lines[i])) continue;
    for (let j = i + 1; j <= Math.min(i + span, lines.length - 1); j++) {
      const m = lines[j].match(pick);
      if (m) return { m, line: lines[j], evidence: `${lines[i]} / ${lines[j]}` };
    }
  }
  return null;
}

/** Like `after`, but the value may sit a few lines above the label as well. */
function around(
  lines: string[], label: RegExp, before: number, span: number, pick: RegExp,
): { m: RegExpMatchArray; line: string; evidence: string } | null {
  for (let i = 0; i < lines.length; i++) {
    if (!label.test(lines[i])) continue;
    for (let j = Math.max(0, i - before); j <= Math.min(i + span, lines.length - 1); j++) {
      if (j === i) continue;
      const m = lines[j].match(pick);
      if (m) return { m, line: lines[j], evidence: `${lines[i]} / ${lines[j]}` };
    }
  }
  return null;
}

function hit(key: FieldKey, value: string | undefined, evidence: string, confidence = 0.92): ProfileHit | null {
  const v = (value ?? '').trim();
  return v ? { key, value: v, evidence, confidence } : null;
}

/** A 12-digit NRIC as the register writes it: 850101-05-1234. */
function dashNric(digits: string): string {
  return `${digits.slice(0, 6)}-${digits.slice(6, 8)}-${digits.slice(8)}`;
}

/* --------------------------------------------------------------- Liberty */

/**
 * Liberty's private car schedule (form UW-PW-S009). Labels sit in a row, the
 * values sit in a row beneath, and the two rows do not line up, so nearly
 * every value is a line on its own somewhere below the label that names it.
 */
const liberty: Profile = {
  insurer: 'LIBERTY',
  read(lines) {
    const out: ProfileHit[] = [];

    // "JME1063847 01-C2" — the number, then an issue suffix. The number is
    // what the insurer's statement will quote.
    const policy = after(lines, /Policy No\.\s*\/\s*No\.\s*Polisi/i, 2, /^([A-Z]{2,4}\d{6,})\b/);
    out.push(hit('policy_no', policy?.m[1], policy?.evidence ?? '')!);

    // The I.C. or business registration sits within a few lines of its
    // label, above or below, and for a company it is under "Bus. Regn. No".
    const ic = around(lines, /I\.C\.\s*No\.\s*\/\s*No\.\s*Kad Pengenalan/i, 6, 3, /^(\d{12})\b|^(\d{5,}-[A-Z0-9]{1,2})$/);
    if (ic) out.push(hit('nric', ic.m[1] ? dashNric(ic.m[1]) : ic.m[2], ic.evidence)!);

    const plate = after(lines, /No\.\s*Pendaftaran\s+Pendaftaran/i, 6, new RegExp(`^(${PLATE})$`));
    out.push(hit('vehicle_no', plate?.m[1], plate?.evidence ?? '')!);

    // "TOYOTA ALPHARD / 4D VAN"
    const make = after(
      lines, /Make\s*&\s*Type of Body/i, 4,
      /^([A-Z][A-Z0-9 .'-]{2,}?)\s*\/\s*([A-Z0-9][A-Z0-9 ()-]{1,20})$/,
    );
    if (make && !/Buatan|Premium|Jadual/i.test(make.line)) {
      out.push(hit('make_model', make.m[1], make.evidence)!);
      out.push(hit('body_type', make.m[2], make.evidence)!);
    }

    // Seating is a bare small number under "Muatan Tempat Duduk"; the engine
    // capacity nearby is "2994.00 CC" and must not be taken for it.
    const seats = after(lines, /Muatan Tempat Duduk/i, 8, /^(\d{1,2})(?:\s|$)/);
    out.push(hit('seating', seats?.m[1], seats?.evidence ?? '')!);

    const year = after(lines, /Tahun Diperbuat/i, 4, /^((?:19|20)\d{2})$/);
    out.push(hit('year_make', year?.m[1], year?.evidence ?? '')!);

    // Windscreen cover carries its own sum insured, printed under the
    // "Diinsuranskan (RM)" heading only when the cover is taken.
    const ws = scan(lines, new RegExp(String.raw`Diinsuranskan \(RM\)\s+(${MONEY})`));
    out.push(hit('windscreen_si', ws?.m[1], ws?.line ?? '')!);

    const basic = scan(lines, new RegExp(String.raw`Premium\s*\/\s*Premium\s+RM\s*(${MONEY})`));
    out.push(hit('basic_premium', basic?.m[1], basic?.line ?? '')!);

    // The certificate page states the excess cleanly; the schedule page puts
    // the label on a row shared with the stamp duty.
    const excess = scan(lines, new RegExp(String.raw`Excess\s*:\s*RM\s*(${MONEY})`));
    out.push(hit('excess', excess?.m[1], excess?.line ?? '')!);

    // "Total Due / Jumlah Berbayar RM 1,913.44" — and not the (OTC) line
    // under it, which is the same figure rounded to five sen for the till.
    const total = scan(lines, new RegExp(String.raw`^Total Due\s*\/\s*Jumlah Berbayar\s+RM\s*(${MONEY})`));
    out.push(hit('total_payable', total?.m[1], total?.line ?? '')!);

    return out.filter(Boolean);
  },
};

/* ---------------------------------------------------------------- Lonpac */

/** Lonpac's cover note: "Label : value Label : value" on one line. */
const lonpac: Profile = {
  insurer: 'LONPAC',
  read(lines) {
    const out: ProfileHit[] = [];

    const issued = scan(lines, /\bDate\s*:\s*(\d{2}\/\d{2}\/\d{4})/);
    out.push(hit('issue_date', issued?.m[1], issued?.line ?? '')!);

    const plate = scan(lines, new RegExp(String.raw`Vehicle Reg\.?\s*No\.?\s*:\s*(${PLATE})\s+Engine`));
    out.push(hit('vehicle_no', plate?.m[1], plate?.line ?? '')!);

    const make = scan(lines, /Make\s*&\s*Model\s*:\s*(.+?)\s+Chassis No/i);
    out.push(hit('make_model', make?.m[1], make?.line ?? '')!);

    const cc = scan(lines, /C\.C\s*\/\s*Watts\s*:\s*(\d{2,5})/i);
    out.push(hit('engine_cc', cc?.m[1], cc?.line ?? '')!);

    const year = scan(lines, /Year of Manufacture\s*:\s*((?:19|20)\d{2})/i);
    out.push(hit('year_make', year?.m[1], year?.line ?? '')!);

    return out.filter(Boolean);
  },
};

/* --------------------------------------------------------------- Allianz */

/**
 * Allianz's schedule prints most vehicle particulars as a row of bare values
 * under a row of headings: "L15ZF9307373 1498.00 CC" and
 * "PMHDG4880PD847374 5 2024". The shapes are distinctive enough to read
 * without the headings.
 */
const allianz: Profile = {
  insurer: 'ALLIANZ',
  read(lines) {
    const out: ProfileHit[] = [];

    const name = scan(lines, /^INSURED\s+(.+?)\s+Date of Issue/i);
    out.push(hit('insured_name', name?.m[1], name?.line ?? '')!);

    const ic = scan(lines, /^(\d{12})\s+Sum Insured/i);
    if (ic) out.push(hit('nric', dashNric(ic.m[1]), ic.line)!);

    // "HONDA WR-V 1.5L RS MDW9185 TOTAL DUE 2,304.77"
    const row = scan(lines, new RegExp(String.raw`^(.+?)\s+([A-Z]{1,3}\d{1,4}[A-Z]?)\s+TOTAL DUE`));
    if (row) {
      out.push(hit('make_model', row.m[1], row.line)!);
      out.push(hit('vehicle_no', row.m[2], row.line)!);
    }

    const engine = scan(lines, /^([A-Z0-9]{5,})\s+(\d{2,5})(?:\.\d+)?\s*CC$/i);
    if (engine) {
      out.push(hit('engine_no', engine.m[1], engine.line)!);
      out.push(hit('engine_cc', engine.m[2], engine.line)!);
    }

    const chassis = scan(lines, /^([A-Z0-9]{8,})\s+(\d{1,2})\s+((?:19|20)\d{2})$/i);
    if (chassis) {
      out.push(hit('chassis_no', chassis.m[1], chassis.line)!);
      out.push(hit('seating', chassis.m[2], chassis.line)!);
      out.push(hit('year_make', chassis.m[3], chassis.line)!);
    }

    const basic = scan(lines, new RegExp(String.raw`^Premium\s+(${MONEY})$`));
    out.push(hit('basic_premium', basic?.m[1], basic?.line ?? '')!);

    const excess = scan(lines, new RegExp(String.raw`Risk Excess\s*\/\s*LEBIHAN\s+(${MONEY})`, 'i'));
    out.push(hit('excess', excess?.m[1], excess?.line ?? '')!);

    return out.filter(Boolean);
  },
};

export const PROFILES: Profile[] = [liberty, lonpac, allianz];

export function profileFor(insurer: string | null | undefined): Profile | null {
  if (!insurer) return null;
  return PROFILES.find((p) => p.insurer === insurer) ?? null;
}
