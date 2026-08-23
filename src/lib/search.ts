/**
 * What someone actually types into a search box, and what they mean by it.
 *
 * The identifiers in this domain are written inconsistently everywhere: a
 * plate is "WXY 4471" on the schedule and "WXY4471" in a text message, an NRIC
 * comes with or without dashes, a policy number carries slashes one insurer
 * uses and another does not. Comparing the raw strings misses all of that, so
 * every identifier is reduced to letters and digits on both sides before it is
 * matched.
 */

export type SearchKind =
  | 'client' | 'policy' | 'claim' | 'endorsement' | 'agent' | 'document';

export type SearchHit = {
  kind: SearchKind;
  id: string;
  title: string;
  subtitle: string;
  meta?: string;
  href: string;
  /** Higher wins. Exact identifier matches float above text matches. */
  score: number;
  /** Which field matched, so the result can say why it is there. */
  matched: string;
};

export const KIND_LABEL: Record<SearchKind, string> = {
  client: 'Clients',
  policy: 'Policies',
  claim: 'Claims',
  endorsement: 'Endorsements',
  agent: 'Sub agents',
  document: 'Documents',
};

/** Letters and digits only, upper-cased. */
export function squash(value: string | null | undefined): string {
  return (value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * A Malaysian plate: one to three letters, one to four digits, sometimes a
 * trailing letter. Recognising the shape lets a bare "WXY4471" go straight to
 * the vehicle rather than being treated as free text.
 */
const PLATE = /^[A-Z]{1,3}\d{1,4}[A-Z]?$/;
const NRIC = /^\d{12}$/;
const DIGITS = /^\d+$/;

export type QueryShape = {
  raw: string;
  squashed: string;
  lower: string;
  looksLikePlate: boolean;
  looksLikeNric: boolean;
  looksNumeric: boolean;
};

export function readQuery(raw: string): QueryShape {
  const trimmed = raw.trim();
  const squashed = squash(trimmed);
  return {
    raw: trimmed,
    squashed,
    lower: trimmed.toLowerCase(),
    looksLikePlate: PLATE.test(squashed),
    looksLikeNric: NRIC.test(squashed),
    looksNumeric: DIGITS.test(squashed),
  };
}

/* Scores, highest first. The ordering is the whole value of the feature: an
 * agent who types a plate wants that vehicle, not every client whose address
 * happens to contain the letters. */
export const SCORE = {
  identifierExact: 100,
  identifierPrefix: 80,
  nameExact: 70,
  namePrefix: 55,
  identifierContains: 40,
  nameContains: 30,
  textContains: 15,
} as const;

/** Score one candidate field against the query. Returns 0 for no match. */
export function scoreField(
  value: string | null | undefined,
  q: QueryShape,
  kind: 'identifier' | 'name' | 'text',
): number {
  // An empty query has to match nothing. Without this every name scores a
  // prefix hit, because "".startsWith("") is true — the search box would
  // return the entire book the moment it was cleared.
  if (!value || !q.raw) return 0;

  if (kind === 'identifier') {
    const v = squash(value);
    if (!v || !q.squashed) return 0;
    if (v === q.squashed) return SCORE.identifierExact;
    if (v.startsWith(q.squashed)) return SCORE.identifierPrefix;
    if (q.squashed.length >= 3 && v.includes(q.squashed)) return SCORE.identifierContains;
    return 0;
  }

  const v = value.toLowerCase();
  if (kind === 'name') {
    if (v === q.lower) return SCORE.nameExact;
    if (v.startsWith(q.lower)) return SCORE.namePrefix;
    if (q.lower.length >= 2 && v.includes(q.lower)) return SCORE.nameContains;
    return 0;
  }

  return q.lower.length >= 3 && v.includes(q.lower) ? SCORE.textContains : 0;
}

/** The best-scoring field of a record, and its name. */
export function best(
  fields: Array<[label: string, value: string | null | undefined, kind: 'identifier' | 'name' | 'text']>,
  q: QueryShape,
): { score: number; matched: string } {
  let score = 0;
  let matched = '';
  for (const [label, value, kind] of fields) {
    const s = scoreField(value, q, kind);
    if (s > score) {
      score = s;
      matched = label;
    }
  }
  return { score, matched };
}
