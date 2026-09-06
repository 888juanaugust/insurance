import { readPdf } from './pdf';
import { extractWithRules, reconcilePremium, detectInsurer } from './rules';
import { extractWithClaude, claudeAvailable } from './claude';
import { pruneInvalid, checkPremiumConsistency, isValid } from './validate';
import { FIELD_KEYS, emptyFields, type ExtractionResult, type FieldKey, type FieldResult } from './types';

export { claudeAvailable } from './claude';
export type { ExtractionResult, FieldKey, FieldResult } from './types';
export { FIELD_KEYS, NUMERIC_FIELDS, DATE_FIELDS } from './types';

/** Loose equality — "TOYOTA  ALPHARD" and "Toyota Alphard" are the same answer. */
function sameValue(a: string | number | null, b: string | number | null): boolean {
  if (a === null || b === null) return false;
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) < 0.011;
  const norm = (v: string | number) =>
    String(v).toUpperCase().replace(/[^A-Z0-9]/g, '');
  return norm(a) === norm(b);
}

const RULE_TRUSTED = 0.85;

/**
 * Below this much text across the whole document there is nothing to pattern
 * match against — a schedule always runs to more than this. Kept lower than the
 * model pass's own threshold, which decides per opening-pages rather than for
 * the document as a whole.
 */
const SCANNED_BELOW_CHARS = 200;

/** How long one reading may take before it is abandoned. */
const BUDGET_MS = 30_000;

function withBudget<T>(work: Promise<T>, what: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${what} took longer than ${BUDGET_MS / 1000} seconds and was abandoned.`)),
      BUDGET_MS,
    );
    work.then((v) => { clearTimeout(timer); resolve(v); }, (e) => { clearTimeout(timer); reject(e); });
  });
}

export type ExtractOptions = {
  /** Set false to skip the model pass even when credentials exist. */
  useClaude?: boolean;
};

/**
 * Read a policy document. Rules run first — deterministic, free, and offline.
 * When credentials are configured the model reads the same document, and the
 * two are merged: agreement raises confidence, disagreement is surfaced rather
 * than silently resolved, and anything either pass produced that fails
 * validation is dropped so a person fills it in instead.
 */
export async function extractPolicy(
  pdfBytes: Uint8Array,
  options: ExtractOptions = {},
): Promise<ExtractionResult> {
  const doc = await withBudget(readPdf(pdfBytes), 'Reading the PDF');
  const ruleResult = extractWithRules(doc);

  /*
   * A PDF that is a photograph or a scan carries no text layer, and the rules
   * read text. Handing somebody an empty form with no explanation is the worst
   * outcome here: nothing is wrong with their document, and they cannot tell
   * that from the screen. The model pass reads the pages as images and does
   * cope, so say which of the two situations this is.
   */
  const scanned = doc.text.trim().length < SCANNED_BELOW_CHARS;

  const wantClaude = options.useClaude !== false && claudeAvailable();
  if (!wantClaude) {
    ruleResult.warnings.push(
      scanned
        ? 'This document has no text in it — it is a scan or a photograph, so the pattern rules ' +
          'have nothing to read and every field has come through blank. Reading a scan needs the ' +
          'model pass: set ANTHROPIC_API_KEY. Otherwise key the policy in by hand.'
        : 'Read using pattern rules only. Set ANTHROPIC_API_KEY to also read documents whose layout the rules do not cover.',
    );
    return ruleResult;
  }

  const ai = await withBudget(extractWithClaude(doc, pdfBytes), 'The model pass');
  if (!ai.ok) {
    ruleResult.warnings.push(
      scanned
        ? `This document is a scan, so only the model pass can read it — and that failed: ${ai.error}. ` +
          'Every field has come through blank. Key the policy in by hand, or try again.'
        : `Model-assisted reading unavailable: ${ai.error}`,
    );
    ruleResult.claudeError = ai.error;
    return ruleResult;
  }

  const merged = emptyFields();
  const warnings = [...ruleResult.warnings];
  const disagreements: string[] = [];

  for (const key of FIELD_KEYS) {
    const rule = ruleResult.fields[key];
    const raw = (ai.data as Record<string, unknown>)[key];
    const aiValue =
      raw === null || raw === undefined || raw === ''
        ? null
        : (raw as string | number);

    const aiUsable = aiValue !== null && isValid(key, aiValue);

    if (rule.value !== null && aiUsable) {
      if (sameValue(rule.value, aiValue)) {
        merged[key] = {
          value: rule.value,
          confidence: Math.min(0.99, Math.max(rule.confidence, 0.95)),
          source: 'rule',
          evidence: rule.evidence,
        };
      } else if (rule.confidence >= RULE_TRUSTED) {
        merged[key] = { ...rule, confidence: 0.6 };
        disagreements.push(key);
      } else {
        merged[key] = { value: aiValue, confidence: 0.7, source: 'claude' };
        disagreements.push(key);
      }
    } else if (rule.value !== null) {
      merged[key] = rule;
    } else if (aiUsable) {
      merged[key] = { value: aiValue, confidence: 0.85, source: 'claude' };
    }
  }

  pruneInvalid(merged);
  const clash = checkPremiumConsistency(merged);
  if (clash) warnings.push(clash);
  reconcilePremium(merged, warnings);

  if (disagreements.length) {
    warnings.push(
      `The pattern rules and the model read these differently — please confirm: ${disagreements
        .map((k) => k.replace(/_/g, ' '))
        .join(', ')}.`,
    );
  }

  const insurer = detectInsurer(doc.pages.slice(0, 4).flat().join('\n'));
  const aiPrincipal = typeof ai.data.principal === 'string' ? ai.data.principal.toUpperCase() : null;

  return {
    fields: merged,
    principal: insurer?.short ?? aiPrincipal,
    principalConfidence: insurer ? insurer.confidence : aiPrincipal ? 0.8 : 0,
    cls: ai.data.cls ?? ruleResult.cls,
    pageCount: doc.pageCount,
    usedClaude: true,
    warnings,
  };
}

/** Fields worth showing at the top of the review form. */
export const KEY_FIELDS: FieldKey[] = [
  'policy_no', 'cover_note_no', 'insured_name', 'nric', 'vehicle_no',
  'effective_date', 'expiry_date', 'sum_insured', 'gross_premium', 'total_payable',
];
