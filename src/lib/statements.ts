/**
 * Reading an insurer's commission statement and setting it against the book.
 *
 * The agency books the commission it expects when it writes the policy. The
 * insurer pays a month or two later, on a statement of its own, and the two
 * disagree more often than anyone would like: a policy is left off, a rate is
 * applied at 10% instead of 15%, a cancellation claws back a case that was
 * never paid in the first place. Nobody notices, because checking a
 * three-hundred-line statement by eye against a register is a day's work that
 * pays nothing when it agrees.
 *
 * Everything here is arithmetic on values passed in — no database, no session
 * — so the matching can be exercised on its own before a screen exists.
 */

import { parseCsv, normaliseHeader } from './csv';
import { readDate } from './import-spec';

/**
 * A sen. Insurers round their own way and half of them truncate, so a
 * one-sen gap is not a discrepancy — it is two computers disagreeing about
 * the last digit, and chasing it costs more than it recovers.
 */
export const TOLERANCE = 0.01;

/* --------------------------------------------------------------- columns */

type ColumnSpec = {
  key: string;
  label: string;
  aliases: string[];
  hint?: string;
};

/**
 * Header spellings taken from the statements insurers actually send, in both
 * languages. Nothing is guessed beyond the header: a column that is not
 * recognised is listed on the preview so it can be seen and ignored
 * deliberately rather than by accident.
 */
const COLUMNS: ColumnSpec[] = [
  {
    key: 'policy_no',
    label: 'Policy number',
    aliases: ['policy no', 'policy number', 'policy', 'no polisi', 'nombor polisi', 'polisi', 'certificate no', 'sijil'],
  },
  {
    key: 'cover_note_no',
    label: 'Cover note',
    aliases: ['cover note', 'cover note no', 'covernote', 'cn no', 'nota lindung', 'no nota lindung'],
  },
  {
    key: 'insured',
    label: 'Insured',
    aliases: ['insured', 'insured name', 'name', 'client', 'client name', 'nama', 'nama yang diinsuranskan', 'participant'],
  },
  {
    key: 'vehicle_no',
    label: 'Vehicle',
    aliases: ['vehicle no', 'vehicle', 'registration no', 'reg no', 'no kenderaan', 'no pendaftaran', 'plate'],
  },
  {
    key: 'effective_date',
    label: 'Effective date',
    aliases: ['effective date', 'effective', 'inception date', 'period from', 'from', 'start date', 'tarikh mula', 'tarikh kuat kuasa'],
    hint: 'yyyy-mm-dd or dd/mm/yyyy',
  },
  {
    key: 'gross_premium',
    label: 'Gross premium',
    aliases: ['gross premium', 'premium', 'gross', 'premium amount', 'premium kasar', 'premium amt'],
  },
  /*
   * The amount is looked for before the rate. Punctuation is stripped when
   * headers are compared, which makes "Commission %" and "Commission" the same
   * string — and a rate column read as the amount would set a 10 against an
   * expected 1,200 and report every case in the book as short paid. So the
   * amount takes the plain spelling first, and a header carrying a per cent
   * sign is refused to it outright (see mapStatementColumns).
   */
  {
    key: 'commission',
    label: 'Commission paid',
    aliases: [
      'commission', 'commission amount', 'comm amount', 'comm amt', 'commission paid',
      'komisen', 'jumlah komisen', 'brokerage', 'agency commission', 'net commission',
    ],
  },
  {
    key: 'commission_rate',
    label: 'Rate',
    aliases: ['commission rate', 'comm rate', 'kadar komisen', 'comm %', 'commission %', 'rate', 'kadar'],
  },
  {
    key: 'reference',
    label: 'Insurer reference',
    aliases: ['reference', 'ref', 'ref no', 'document no', 'doc no', 'transaction no', 'rujukan'],
  },
];

export const STATEMENT_COLUMNS = COLUMNS.map((c) => ({ key: c.key, label: c.label, hint: c.hint }));

/** Which spreadsheet column, if any, holds each field. */
export function mapStatementColumns(headers: string[]) {
  const normalised = headers.map(normaliseHeader);
  // A per cent sign says the column holds a rate whatever it is called, and
  // that is the one thing a money column must never be confused with.
  const percent = headers.map((h) => h.includes('%'));
  const mapping: Record<string, number> = {};
  const taken = new Set<number>();

  for (const col of COLUMNS) {
    const money = col.key === 'commission' || col.key === 'gross_premium';
    for (const alias of col.aliases) {
      const wanted = normaliseHeader(alias);
      const idx = normalised.findIndex(
        (h, i) => h === wanted && !taken.has(i) && !(money && percent[i]),
      );
      if (idx !== -1) {
        mapping[col.key] = idx;
        taken.add(idx);
        break;
      }
    }
  }

  const unrecognised = headers.filter((_, i) => !taken.has(i) && headers[i].trim() !== '');
  return { mapping, unrecognised };
}

/* ---------------------------------------------------------------- values */

/**
 * Statement amounts are not import amounts: a cancellation claws commission
 * back, so a negative figure is ordinary here, and accounting exports write
 * those in brackets.
 *
 * CR and DR suffixes are deliberately *not* read. On a payable statement a
 * credit is money coming to the agency; on a ledger export of the same figures
 * it is the opposite, and the file does not say which it is. Guessing wrong
 * reverses the sign of every clawback in silence, so a value carrying one is
 * refused and reported on the line instead.
 */
export function readMoney(value: string): number | null {
  let v = value.trim().replace(/^RM\s*/i, '').replace(/[,\s]/g, '');
  if (!v) return null;

  let sign = 1;
  const bracketed = v.match(/^\((.*)\)$/);
  if (bracketed) { sign = -1; v = bracketed[1]; }
  if (v.startsWith('-')) { sign = -sign; v = v.slice(1); }
  if (!/^\d*\.?\d*$/.test(v) || v === '' || v === '.') return null;

  const n = Number(v);
  return Number.isFinite(n) ? Math.round(sign * n * 100) / 100 : null;
}

/** A rate written as 10, 10%, or 0.10 — all meaning ten per cent. */
export function readRate(value: string): number | null {
  const v = value.trim().replace('%', '');
  if (!v) return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return null;
  // Nobody writes a 0.1% commission rate, and everybody writes 0.10 for ten.
  return Math.round((n > 0 && n < 1 ? n * 100 : n) * 100) / 100;
}

/* ------------------------------------------------------------ the reading */

export type StatementRow = {
  /** Line in the file, header counted, so a problem can be pointed at. */
  line: number;
  policy_no: string;
  cover_note_no: string;
  insured: string;
  vehicle_no: string;
  effective_date: string;
  gross_premium: number | null;
  commission_rate: number | null;
  commission: number | null;
  reference: string;
  problems: string[];
};

export type StatementReading = {
  headers: string[];
  mapping: Record<string, number>;
  unrecognised: string[];
  rows: StatementRow[];
  /** Why the file cannot be used at all, if it cannot. */
  fatal: string | null;
  total: number;
  ragged: Array<{ line: number; got: number }>;
};

/**
 * A statement needs two things to be worth reading: something to identify the
 * case by, and the amount paid. Everything else is context.
 */
export function readStatement(text: string): StatementReading {
  const table = parseCsv(text);
  const { mapping, unrecognised } = mapStatementColumns(table.headers);

  const empty: StatementReading = {
    headers: table.headers, mapping, unrecognised, rows: [], fatal: null, total: 0,
    ragged: table.ragged,
  };

  if (!table.headers.length) {
    return { ...empty, fatal: 'That file is empty.' };
  }

  const identifiers = ['policy_no', 'cover_note_no', 'vehicle_no'].filter((k) => k in mapping);
  if (!identifiers.length) {
    return {
      ...empty,
      fatal:
        'No column identifies the case. The statement needs a policy number, a cover note number or a vehicle registration.',
    };
  }
  if (!('commission' in mapping)) {
    return {
      ...empty,
      fatal: 'No column holds the commission paid. Add it — a statement without an amount cannot be checked against anything.',
    };
  }

  const cell = (cells: string[], key: string) =>
    mapping[key] === undefined ? '' : (cells[mapping[key]] ?? '').trim();

  const rows = table.rows.map((cells, i): StatementRow => {
    const line = i + 2;
    const problems: string[] = [];

    const rawCommission = cell(cells, 'commission');
    const commission = readMoney(rawCommission);
    if (rawCommission && commission === null) {
      problems.push(`“${rawCommission}” is not an amount.`);
    }

    const rawGross = cell(cells, 'gross_premium');
    const gross = readMoney(rawGross);
    if (rawGross && gross === null) problems.push(`Gross premium “${rawGross}” is not an amount.`);

    const rawDate = cell(cells, 'effective_date');
    const effective = readDate(rawDate);
    if (rawDate && !effective) problems.push(`“${rawDate}” is not a date Insurhelp can read.`);

    const policyNo = cell(cells, 'policy_no');
    const coverNote = cell(cells, 'cover_note_no');
    const vehicle = cell(cells, 'vehicle_no');
    if (!policyNo && !coverNote && !vehicle) {
      problems.push('The line carries no policy number, cover note or vehicle, so there is nothing to match it on.');
    }
    if (commission === null && !rawCommission) {
      problems.push('No commission amount on this line.');
    }

    return {
      line,
      policy_no: policyNo,
      cover_note_no: coverNote,
      insured: cell(cells, 'insured'),
      vehicle_no: vehicle,
      effective_date: effective ?? '',
      gross_premium: gross,
      commission_rate: readRate(cell(cells, 'commission_rate')),
      commission,
      reference: cell(cells, 'reference'),
      problems,
    };
  });

  // Statements carry a total line — "TOTAL 12,480.00" with no policy — and
  // spacer rows between sections. Read as data, the first becomes a case the
  // agency has never heard of carrying the value of the whole statement, and
  // the second becomes a line with nothing on it and two complaints attached.
  const body = rows.filter((r) => !isBlank(r) && !looksLikeTotal(r));

  return {
    ...empty,
    rows: body,
    total: round2(body.reduce((s, r) => s + (r.commission ?? 0), 0)),
    fatal: body.length ? null : 'That file has a header but no lines.',
  };
}

/** Nothing was read from this line at all — a spacer between sections. */
function isBlank(row: StatementRow): boolean {
  return (
    !row.policy_no && !row.cover_note_no && !row.vehicle_no && !row.insured.trim() &&
    !row.reference.trim() && !row.effective_date &&
    row.commission === null && row.gross_premium === null && row.commission_rate === null
  );
}

const TOTAL_WORD = /^(GRAND\s*)?(SUB\s*)?(TOTAL|JUMLAH|KESELURUHAN)$/;

/**
 * A summary line. Statements end with one, and read as data it becomes a case
 * the agency has never heard of, carrying the value of the whole statement.
 * The word lands in whichever column the insurer felt like putting it in.
 */
function looksLikeTotal(row: StatementRow): boolean {
  if (row.commission === null) return false;

  const labelled = [row.policy_no, row.cover_note_no, row.vehicle_no, row.insured, row.reference]
    .some((v) => TOTAL_WORD.test(v.trim().toUpperCase()));
  if (labelled) return true;

  // Or no label at all: an amount on a line that identifies nothing.
  return !row.policy_no && !row.cover_note_no && !row.vehicle_no && !row.insured.trim();
}

/* ------------------------------------------------------------- the match */

export type BookPolicy = {
  id: string;
  policy_no: string;
  cover_note_no: string | null;
  vehicle_no: string | null;
  insured: string;
  effective_date: string | null;
  /** What the agency booked as its own commission on this case. */
  commission_amt: number;
  gross_premium: number;
};

export type MatchBasis = 'policy_no' | 'cover_note' | 'vehicle' | 'none';

export type MatchedLine = StatementRow & {
  policy_id: string | null;
  basis: MatchBasis;
  /** Filled from the book, so the screen can show what was matched to. */
  matched_policy_no: string | null;
  matched_insured: string | null;
};

export type PolicyOutcome = {
  policy_id: string;
  policy_no: string;
  insured: string;
  expected: number;
  paid: number;
  variance: number;
  state: 'agreed' | 'short' | 'over';
  lines: number[];
};

export type Reconciliation = {
  lines: MatchedLine[];
  outcomes: PolicyOutcome[];
  /** Lines on the insurer's paper that match nothing in the book. */
  unmatched: MatchedLine[];
  /** Cases in the book, for this insurer and period, that the statement left out. */
  missing: BookPolicy[];
  totals: {
    paid: number;
    expected: number;
    agreed: number;
    shortfall: number;
    overpaid: number;
    unmatchedValue: number;
    missingValue: number;
  };
};

/**
 * Matches on the strongest identifier first. A policy number is the insurer's
 * own reference and settles the question; a cover note only appears before the
 * policy is issued; a registration is a last resort, because a car changes
 * insurer and the same plate can sit on several years of cover.
 */
export function matchLine(row: StatementRow, book: BookPolicy[]): { policy: BookPolicy | null; basis: MatchBasis } {
  const byPolicy = squash(row.policy_no);
  if (byPolicy) {
    const hit = book.find((p) => squash(p.policy_no) === byPolicy);
    if (hit) return { policy: hit, basis: 'policy_no' };
  }

  const byNote = squash(row.cover_note_no);
  if (byNote) {
    const hit = book.find((p) => squash(p.cover_note_no) === byNote);
    if (hit) return { policy: hit, basis: 'cover_note' };
  }

  const byVehicle = squash(row.vehicle_no);
  if (byVehicle) {
    const hits = book.filter((p) => squash(p.vehicle_no) === byVehicle);
    if (hits.length === 1) return { policy: hits[0], basis: 'vehicle' };
    if (hits.length > 1 && row.effective_date) {
      // Several years of cover on one plate: the effective date decides.
      const exact = hits.filter((p) => p.effective_date === row.effective_date);
      if (exact.length === 1) return { policy: exact[0], basis: 'vehicle' };
    }
    // Two candidates and nothing to choose between them is not a match. A
    // guess here books the money against the wrong year and hides both.
  }

  return { policy: null, basis: 'none' };
}

/**
 * Several lines can land on one case — an instalment statement pays a policy
 * twice, a cancellation reverses part of it — so the comparison is per case,
 * on the sum, never per line.
 *
 * Taken separately from `reconcile` because a statement is compared twice: once
 * on the preview, against the file, and again every time the saved one is
 * opened after somebody has moved a line by hand. Two implementations of this
 * would eventually disagree, and the screen showing a variance the import did
 * not is exactly the thing that stops the agency trusting the number.
 */
export function groupOutcomes(
  lines: Array<{ line: number; policy_id: string | null; commission: number | null }>,
  lookup: (policyId: string) => { policy_no: string; insured: string; commission_amt: number } | undefined,
): PolicyOutcome[] {
  const grouped = new Map<string, Array<{ line: number; commission: number | null }>>();
  for (const l of lines) {
    if (!l.policy_id) continue;
    const list = grouped.get(l.policy_id) ?? [];
    list.push(l);
    grouped.set(l.policy_id, list);
  }

  const outcomes: PolicyOutcome[] = [];
  for (const [policyId, group] of grouped) {
    const policy = lookup(policyId);
    if (!policy) continue;
    const paid = round2(group.reduce((s, l) => s + (l.commission ?? 0), 0));
    const expected = round2(policy.commission_amt);
    const variance = round2(paid - expected);
    outcomes.push({
      policy_id: policyId,
      policy_no: policy.policy_no,
      insured: policy.insured,
      expected,
      paid,
      variance,
      state: Math.abs(variance) <= TOLERANCE ? 'agreed' : variance < 0 ? 'short' : 'over',
      lines: group.map((l) => l.line).sort((a, b) => a - b),
    });
  }

  // Worst first: the money the agency is owed is the reason to open the page.
  return outcomes.sort((a, b) => a.variance - b.variance);
}

/**
 * `book` is what the agency holds for this insurer over the statement period;
 * anything in it that no line reaches is money the insurer has not paid.
 * `overrides` lets an agent settle a line the matcher could not.
 */
export function reconcile(
  rows: StatementRow[],
  book: BookPolicy[],
  overrides: Record<number, string | null> = {},
): Reconciliation {
  const byId = new Map(book.map((p) => [p.id, p]));

  const lines: MatchedLine[] = rows.map((row) => {
    // An override of null is an explicit "this is not ours", set by hand, and
    // must survive a re-run that the matcher would otherwise win.
    const override = Object.prototype.hasOwnProperty.call(overrides, row.line)
      ? overrides[row.line]
      : undefined;

    let policy: BookPolicy | null = null;
    let basis: MatchBasis = 'none';

    if (override === undefined) {
      ({ policy, basis } = matchLine(row, book));
    } else if (override) {
      policy = byId.get(override) ?? null;
      basis = policy ? 'policy_no' : 'none';
    }

    return {
      ...row,
      policy_id: policy?.id ?? null,
      basis,
      matched_policy_no: policy?.policy_no ?? null,
      matched_insured: policy?.insured ?? null,
    };
  });

  const outcomes = groupOutcomes(lines, (id) => byId.get(id));
  const reached = new Set(outcomes.map((o) => o.policy_id));

  const unmatched = lines.filter((l) => !l.policy_id);
  const missing = book.filter((p) => !reached.has(p.id) && Math.abs(p.commission_amt) > TOLERANCE);

  const shortfall = round2(
    outcomes.filter((o) => o.state === 'short').reduce((s, o) => s + o.variance, 0),
  );
  const overpaid = round2(
    outcomes.filter((o) => o.state === 'over').reduce((s, o) => s + o.variance, 0),
  );

  return {
    lines,
    outcomes,
    unmatched,
    missing,
    totals: {
      paid: round2(lines.reduce((s, l) => s + (l.commission ?? 0), 0)),
      expected: round2(outcomes.reduce((s, o) => s + o.expected, 0)),
      agreed: outcomes.filter((o) => o.state === 'agreed').length,
      shortfall,
      overpaid,
      unmatchedValue: round2(unmatched.reduce((s, l) => s + (l.commission ?? 0), 0)),
      missingValue: round2(missing.reduce((s, p) => s + p.commission_amt, 0)),
    },
  };
}

function squash(value: string | null | undefined): string {
  return (value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
