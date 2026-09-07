import { readPdf } from './extract/pdf';
import { detectInsurer, extractWithRules } from './extract/rules';
import { learnLabels } from './extract/learned';
import { sameValue } from './extract';
import { FIELD_KEYS, NUMERIC_FIELDS, type FieldKey } from './extract/types';
import { getDocument } from './queries';
import { readDocument } from './files';
import { listLearnedLabels, recordLearnedLabels } from './learned-labels';

/**
 * What a saved policy teaches the reader.
 *
 * Called after a policy is saved with its schedule attached — from the review
 * form and from a batch alike. The schedule is read again, rules only, to
 * see which fields the rules already had right; every other saved value is
 * looked for on the page and the label beside it is kept for that insurer.
 * A correction typed on the review form teaches the corrected value.
 *
 * It never fails the save: a schedule that cannot be re-read simply teaches
 * nothing, and says so in the log.
 */
export async function learnFromSave(
  orgId: string, documentId: string, get: (name: string) => string,
): Promise<{ added: number; confirmed: number } | null> {
  try {
    const doc = getDocument(documentId, orgId);
    if (!doc?.storage_key) return null;
    const bytes = readDocument(doc.storage_key);
    if (!bytes) return null;

    const pdf = await readPdf(new Uint8Array(bytes));
    const head = pdf.pages.slice(0, 4).flat();
    const insurer = detectInsurer(head.join('\n'))?.short ?? null;
    const baseline = extractWithRules(pdf, (short) => listLearnedLabels(orgId, short));

    // The form names one field differently from the reader.
    const saved: Partial<Record<FieldKey, string | number>> = {};
    for (const key of FIELD_KEYS) {
      const raw = get(key === 'total_payable' ? 'total_premium' : key).trim();
      if (!raw) continue;
      if (NUMERIC_FIELDS.includes(key)) {
        const n = Number(raw.replace(/,/g, ''));
        if (Number.isFinite(n)) saved[key] = n;
      } else {
        saved[key] = raw;
      }
    }

    // Fields the rules read correctly, and confidently, have nothing to teach.
    const alreadyRead = new Set<FieldKey>();
    for (const key of FIELD_KEYS) {
      const rule = baseline.fields[key];
      const kept = saved[key];
      if (rule.value !== null && kept !== undefined && rule.confidence >= 0.85 && sameValue(rule.value, kept)) {
        alreadyRead.add(key);
      }
    }

    const learned = learnLabels(head, saved, alreadyRead);
    if (!learned.length) return { added: 0, confirmed: 0 };
    return recordLearnedLabels(orgId, insurer, learned);
  } catch (error) {
    console.error(JSON.stringify({
      at: new Date().toISOString(), level: 'warn', job: 'learn-labels', document: documentId,
      message: error instanceof Error ? error.message : String(error),
    }));
    return null;
  }
}
