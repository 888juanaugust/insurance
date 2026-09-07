import { DATE_FIELDS, NUMERIC_FIELDS, type FieldKey } from './types';

/**
 * Labels learned from documents a person has already saved.
 *
 * The pattern rules know the labels that were read off real schedules from
 * three insurers. Everyone else's layout reaches the model pass, which costs
 * money on every document — forever, unless something remembers what the
 * model found. This does. When a policy is saved, the saved value for each
 * field is looked for on the page; the text that sat beside it, or on the
 * line above, is a label the rules can use next time for that insurer.
 *
 * Two safeguards keep a learned label from becoming a learned mistake:
 *
 *   - It is learned from what the PERSON SAVED, not from what the model said.
 *     A value corrected on the review form teaches the correction.
 *   - It is provisional until a second document confirms it. A provisional
 *     label reads at a confidence below the bar the gate trusts, so the model
 *     still runs on the next document of that insurer; when the two agree the
 *     label is confirmed, and from the third document on the rules manage
 *     alone. One odd document cannot silence the model by itself.
 *
 * Nothing here touches the database: the store is in ../learned-labels.ts,
 * and this file is plain functions the tests can run in Node.
 */
export type Placement = 'same' | 'below';

export type LearnedLabel = {
  /** The insurer the label was seen on, as detectInsurer names it, or UNKNOWN. */
  insurer: string;
  key: FieldKey;
  /** As printed, whitespace squashed: "No. Sijil Insurans". */
  label: string;
  /** Whether the value followed the label on the same line or sat beneath it. */
  placement: Placement;
  /** Documents this pairing has been learned from. */
  seen: number;
  /** Taught by another agency on the server, not by this one's own documents. */
  shared?: boolean;
};

export type NewLabel = Pick<LearnedLabel, 'key' | 'label' | 'placement'>;

/** A label read on this many saved documents is trusted like a rule. */
export const TRUST_AFTER = 2;

/** Below the gate's bar until confirmed, so the model still checks it once. */
export function learnedConfidence(l: Pick<LearnedLabel, 'seen'>): number {
  return l.seen >= TRUST_AFTER ? 0.88 : 0.75;
}

/* --------------------------------------------------- the shared library */

/** A label from the server-wide library: what every agency's saving has taught, pooled. */
export type SharedLabel = LearnedLabel & {
  /** How many different agencies have taught this pairing. */
  agencies: number;
};

/**
 * Trusted across agencies once this many DIFFERENT agencies have taught the
 * same pairing. Two documents at one agency confirm a label to that agency;
 * to everyone else it stays a suggestion — used, with the model still checking
 * — until a second agency, reading its own documents, agrees.
 */
export const TRUST_ACROSS = 2;

/**
 * An agency's own labels with the library's behind them, as one list for the
 * reader. Its own come first and keep their own count; a library label the
 * agency also learned itself raises that count when the library trusts it,
 * and a library label it never learned joins the list marked as shared, with
 * a count that says whether the library trusts it. Trusted labels lead, so
 * the reader — which takes the first label that matches for a field — tries
 * the surest first.
 */
export function mergeLabels(own: LearnedLabel[], shared: SharedLabel[]): LearnedLabel[] {
  const at = (l: Pick<LearnedLabel, 'key' | 'label' | 'placement'>) => `${l.key}\u0000${l.label.toUpperCase()}\u0000${l.placement}`;
  const merged = new Map<string, LearnedLabel>(own.map((l) => [at(l), { ...l }]));
  for (const s of shared) {
    const seen = s.agencies >= TRUST_ACROSS ? TRUST_AFTER : 1;
    const mine = merged.get(at(s));
    if (mine) mine.seen = Math.max(mine.seen, seen);
    else merged.set(at(s), { insurer: s.insurer, key: s.key, label: s.label, placement: s.placement, seen, shared: true });
  }
  // Stable: trusted before provisional, and at the same count the agency's own before the library's.
  return [...merged.values()].sort((a, b) => (b.seen >= TRUST_AFTER ? 1 : 0) - (a.seen >= TRUST_AFTER ? 1 : 0));
}

/* ------------------------------------------------------------ the shapes */

const MONEY_RE = /\d[\d,]*\.\d{2}/;
const DATE_RE = /\b\d{1,2}[/-]\d{1,2}[/-]\d{4}\b|\b\d{4}-\d{2}-\d{2}\b/;
const NRIC_RE = /\b\d{6}-?\d{2}-?\d{4}\b/;
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

/** Every way the saved value might have been printed on the page. */
export function printedForms(key: FieldKey, value: string | number): string[] {
  if (typeof value === 'number') {
    if (NUMERIC_FIELDS.includes(key) && !['seating', 'ncd_pct'].includes(key)) {
      const fixed = value.toFixed(2);
      const grouped = value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      return [...new Set([grouped, fixed, String(value)])];
    }
    return [String(value)];
  }
  const s = value.trim();
  if (DATE_FIELDS.includes(key) && /^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split('-');
    const mon = MONTHS[Number(m) - 1] ?? m;
    return [`${d}/${m}/${y}`, `${d}-${m}-${y}`, `${d} ${mon} ${y}`, `${d}-${mon}-${y}`, s];
  }
  if (key === 'nric' && /^\d{6}-\d{2}-\d{4}$/.test(s)) return [s, s.replace(/-/g, '')];
  // A plate is printed "WXY 1234" as often as "WXY1234", and saved either way.
  if (key === 'vehicle_no') {
    const m = s.toUpperCase().match(/^([A-Z]{1,3})\s?(\d{1,4})\s?([A-Z]{0,3})$/);
    if (m) {
      const tail = m[3] ? [`${m[3]}`, ` ${m[3]}`] : [''];
      return [...new Set(tail.flatMap((t) => [`${m[1]}${m[2]}${t}`, `${m[1]} ${m[2]}${t}`]))];
    }
  }
  return [s];
}

/** The value pattern to expect after a learned label, by what the field holds. */
export function valueShapeFor(key: FieldKey): RegExp | undefined {
  if (DATE_FIELDS.includes(key)) return /\d{1,2}[/-]\d{1,2}[/-]\d{4}|\d{1,2}[ -][A-Za-z]{3}[a-z]*[ -]\d{4}|\d{4}-\d{2}-\d{2}/;
  if (['seating', 'ncd_pct', 'engine_cc', 'year_make'].includes(key)) return /\d{1,5}/;
  if (NUMERIC_FIELDS.includes(key)) return MONEY_RE;
  if (key === 'vehicle_no') return /[A-Z]{1,3}\s?\d{1,4}\s?[A-Z]{0,3}/i;
  if (key === 'nric') return /\d{6}-?\d{2}-?\d{4}|\d{5,}-[A-Z0-9]{1,2}/i;
  if (key === 'engine_no' || key === 'chassis_no') return /[A-Z0-9-]{5,}/i;
  if (key === 'policy_no' || key === 'cover_note_no') return /[A-Z0-9][A-Z0-9/_.-]{4,}/i;
  return undefined;
}

/* ------------------------------------------------------------- learning */

const squash = (s: string) => s.replace(/\s+/g, ' ').trim();

/** Text that could be a label: words, not a value, not a sentence. */
function usableLabel(s: string, forms: string[]): boolean {
  const t = squash(s);
  if (t.length < 3 || t.length > 60) return false;
  if (!/[A-Za-z]{3}/.test(t)) return false;
  if (/^\d/.test(t)) return false;
  if (MONEY_RE.test(t) || DATE_RE.test(t) || NRIC_RE.test(t)) return false;
  if (forms.some((f) => t.toUpperCase().includes(f.toUpperCase()))) return false;
  return true;
}

/**
 * The label for a value that shares its line. Everything before the value,
 * back to the previous "label : value" pair — and with any OTHER saved value
 * cut out, so "Make & Model : TOYOTA ALPHARD Chassis No" learns "Chassis No"
 * and not a label with somebody's car in it.
 */
function sameLineLabel(before: string, others: string[]): string {
  // The label's own trailing colon goes first, or it would be the boundary.
  let seg = before.replace(/[\s:\-–]+$/, '').split(':').pop() ?? '';
  for (const o of others) {
    const at = seg.toUpperCase().lastIndexOf(o.toUpperCase());
    if (at >= 0) seg = seg.slice(at + o.length);
  }
  return squash(seg.replace(/[\s:\-–]+$/, ''));
}

/**
 * What the page teaches: for each saved field the rules did not already have
 * right, the label that sat beside or above its value.
 *
 * `lines` are the opening pages, as readPdf lays them out; `saved` is what the
 * person kept; `alreadyRead` names the fields the rules read correctly
 * without help, which have nothing to teach.
 */
export function learnLabels(
  lines: string[],
  saved: Partial<Record<FieldKey, string | number | null>>,
  alreadyRead: ReadonlySet<FieldKey>,
): NewLabel[] {
  const out: NewLabel[] = [];
  const entries = (Object.entries(saved) as [FieldKey, string | number | null][])
    .filter(([, v]) => v !== null && v !== undefined && v !== '');
  const allForms = entries.flatMap(([k, v]) => printedForms(k, v as string | number)).filter((f) => f.length >= 3);

  for (const [key, value] of entries) {
    if (alreadyRead.has(key)) continue;
    const forms = printedForms(key, value as string | number);
    const others = allForms.filter((f) => !forms.includes(f));

    let found: NewLabel | null = null;
    for (let i = 0; i < lines.length && !found; i++) {
      const line = lines[i];
      const upper = line.toUpperCase();
      for (const form of forms) {
        const at = upper.indexOf(form.toUpperCase());
        if (at < 0) continue;
        // A value inside a longer token is not this value: "12" in "2012".
        const endsAt = at + form.length;
        if (/[A-Z0-9]/i.test(line[at - 1] ?? ' ') || /[A-Z0-9]/i.test(line[endsAt] ?? ' ')) continue;

        const before = line.slice(0, at).replace(/\bRM\s*$/i, '');
        if (before.trim()) {
          const label = sameLineLabel(before, others);
          if (usableLabel(label, forms)) found = { key, label, placement: 'same' };
        } else {
          // The value opens its line: the label is the nearest line above.
          for (let j = i - 1; j >= Math.max(0, i - 2); j--) {
            const above = squash(lines[j]);
            if (!above) continue;
            if (usableLabel(above, forms)) found = { key, label: above, placement: 'below' };
            break;
          }
        }
        break;
      }
    }
    if (found) out.push(found);
  }
  return out;
}

/** The learned label as a pattern the rules can run: whitespace-tolerant, anchored for a stacked label. */
export function learnedPattern(l: Pick<LearnedLabel, 'label' | 'placement'>): RegExp {
  const escaped = l.label.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&').replace(/\s+/g, String.raw`\s+`);
  return new RegExp(l.placement === 'below' ? String.raw`^\s*${escaped}\s*[:\-–]?\s*$` : escaped, 'i');
}
