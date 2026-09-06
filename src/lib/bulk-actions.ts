'use server';

import { revalidatePath } from 'next/cache';
import { authorise } from './guard';
import { audit } from './audit';
import { uploadPolicyAction, buildInputFrom, type UploadState } from './policy-actions';
import {
  getDocument, findPolicyByNumber, findPrincipalByName, findDocumentByHash,
  findClientByIdentity, createClientFromPolicy, createPolicy,
  attachDocumentToPolicy, deleteDocumentRow,
} from './queries';
import { deleteDocument } from './files';
import { today, money } from './format';
import { resultFromDocument } from './reading';
import type { ExtractionResult, FieldKey } from './extract';

/**
 * Reading a stack of schedules in one sitting.
 *
 * The files are read ONE AT A TIME, each in its own request from the browser,
 * rather than posted together as one body. Thirty schedules is thirty or forty
 * megabytes and a Server Action body is capped well below that, so a batch sent
 * in one piece would be rejected whole — and with it the twenty-nine files that
 * were fine. One at a time also means the agent watches it happen instead of
 * staring at a spinner, and a file that cannot be read costs only itself.
 */

export type BatchVerdict = 'ready' | 'review' | 'duplicate' | 'failed';

export type BatchItem = {
  filename: string;
  verdict: BatchVerdict;
  /** Why it is not ready, in the agent's words. */
  reasons: string[];
  documentId?: string;
  policy_no?: string | null;
  insured?: string | null;
  vehicle_no?: string | null;
  principal?: string | null;
  effective_date?: string | null;
  expiry_date?: string | null;
  total?: number | null;
  cls?: 'motor' | 'non_motor';
  /** Found / total, so a thin reading is visible without opening it. */
  found?: number;
  fieldCount?: number;
  /** Set when the same policy number, or the same file, is already on record. */
  existingPolicyId?: string | null;
};

/** Everything a policy cannot be created without. */
const REQUIRED: FieldKey[] = ['policy_no', 'insured_name', 'effective_date', 'expiry_date'];

function valueOf(r: ExtractionResult, key: FieldKey): string | number | null {
  return r.fields[key]?.value ?? null;
}

/**
 * Whether this reading can be saved unattended.
 *
 * Deliberately strict. A batch save that quietly writes a policy with the
 * wrong premium is worse than one that asks about it, because nobody looks
 * again at a row that said "saved".
 */
function judge(
  r: ExtractionResult,
  state: Pick<UploadState, 'duplicateOf' | 'sameFileAs'>,
): { verdict: BatchVerdict; reasons: string[] } {
  const reasons: string[] = [];

  for (const key of REQUIRED) {
    if (valueOf(r, key) === null) reasons.push(`no ${key.replace(/_/g, ' ')}`);
  }

  const gross = valueOf(r, 'gross_premium');
  const total = valueOf(r, 'total_payable');
  if (typeof gross !== 'number' && typeof total !== 'number') reasons.push('no premium');

  const from = valueOf(r, 'effective_date');
  const to = valueOf(r, 'expiry_date');
  if (typeof from === 'string' && typeof to === 'string' && to <= from) {
    reasons.push('the period ends before it starts');
  }

  if (!r.principal || !findPrincipalByName(r.principal)) {
    reasons.push(r.principal ? `${r.principal} is not on the insurer list` : 'insurer not recognised');
  }

  /*
   * A cover note carries no policy number, so the reader takes the cover note's
   * own number and says so. That is the right reading and still wants an
   * agent's eye: the insurer will issue a different number later, and this row
   * has to be corrected when it does. Saying which of the two situations it is
   * beats "policy no uncertain", which tells nobody anything.
   */
  if (r.fields.policy_no.source === 'derived') {
    reasons.push('the number is the cover note — the insurer has not issued a policy number yet');
  }

  // Anything else the reader itself was unsure of.
  const shaky = REQUIRED.filter(
    (k) => r.fields[k].value !== null && r.fields[k].confidence < 0.8 && r.fields[k].source !== 'derived',
  );
  if (shaky.length) {
    reasons.push(`the ${shaky.map((k) => k.replace(/_/g, ' ')).join(', ')} reading is uncertain`);
  }

  // A warning from the reader is a question, and a question needs a person.
  if (r.warnings.some((w) => /does not reconcile|read these differently|dropped/i.test(w))) {
    reasons.push('the premium figures do not agree');
  }

  if (state.duplicateOf) return { verdict: 'duplicate', reasons: [`policy ${state.duplicateOf.policy_no} is already on the register`] };
  if (state.sameFileAs) return { verdict: 'duplicate', reasons: [`this exact file is already on record as ${state.sameFileAs.filename}`] };

  return { verdict: reasons.length ? 'review' : 'ready', reasons };
}

/** Read one file of a batch and say what would happen to it. */
export async function readForBatchAction(fd: FormData): Promise<BatchItem> {
  const filename = String((fd.get('file') as File | null)?.name ?? 'the file');

  const state = await uploadPolicyAction(null, fd);
  if (!state.ok || !state.result) {
    return { filename, verdict: 'failed', reasons: [state.error ?? 'could not be read'] };
  }

  const guard = await authorise({ action: 'policy.upload', entity: 'policy' });
  if (!guard.ok) return { filename, verdict: 'failed', reasons: [guard.message] };

  const r = state.result;
  const { verdict, reasons } = judge(r, state);
  const found = Object.values(r.fields).filter((f) => f.value !== null).length;

  return {
    filename: state.filename ?? filename,
    verdict,
    reasons,
    documentId: state.documentId,
    policy_no: valueOf(r, 'policy_no') as string | null,
    insured: valueOf(r, 'insured_name') as string | null,
    vehicle_no: valueOf(r, 'vehicle_no') as string | null,
    principal: r.principal,
    effective_date: valueOf(r, 'effective_date') as string | null,
    expiry_date: valueOf(r, 'expiry_date') as string | null,
    total: (valueOf(r, 'total_payable') ?? valueOf(r, 'gross_premium')) as number | null,
    cls: r.cls === 'non_motor' ? 'non_motor' : 'motor',
    found,
    fieldCount: Object.keys(r.fields).length,
    existingPolicyId: state.duplicateOf?.id ?? null,
  };
}

export type BatchSaveResult = {
  saved: number;
  failed: Array<{ filename: string; why: string }>;
  error?: string;
};

/**
 * Write the readings the agent accepted.
 *
 * The extraction is re-read from the stored document rather than taken from
 * the browser, and JUDGED AGAIN here: only a reading that is ready goes in.
 * What gets saved is then exactly what was read and shown, and no amount of
 * tampering with the page — ticking a row the screen would not offer — can
 * put a doubtful premium on a policy. A row that needs a look is saved from
 * the check screen, where somebody has looked.
 */
export async function saveBatchAction(_prev: unknown, fd: FormData): Promise<BatchSaveResult> {
  const guard = await authorise({ action: 'policy.bulk_create', entity: 'policy' });
  if (!guard.ok) return { saved: 0, failed: [], error: guard.message };
  const user = guard.user;

  const ids = String(fd.get('document_ids') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!ids.length) return { saved: 0, failed: [], error: 'Nothing was selected to save.' };

  const failed: BatchSaveResult['failed'] = [];
  let saved = 0;

  for (const documentId of ids) {
    const doc = getDocument(documentId, user.org_id);
    if (!doc) {
      failed.push({ filename: documentId, why: 'the reading was no longer on file' });
      continue;
    }
    if (doc.policy_id) {
      failed.push({ filename: doc.filename, why: 'this reading has already been saved to a policy' });
      continue;
    }
    try {
      const reading = resultFromDocument(doc);
      const fields = reading.fields;
      const val = (k: FieldKey) => fields[k]?.value ?? null;

      const policyNo = String(val('policy_no') ?? '');
      const duplicateOf = policyNo ? findPolicyByNumber(user.org_id, policyNo) : undefined;
      /*
       * The same file counts against this reading only once it is on a policy.
       * Two copies of one schedule in the same batch would otherwise refuse
       * each other — the first, judged clean when it was read, would be
       * turned away at save time for matching the second. Whichever copy is
       * saved first, the other then fails on the policy number, which is the
       * refusal that means something.
       */
      const sameFile = doc.sha256 ? findDocumentByHash(user.org_id, doc.sha256, doc.id) : undefined;
      const verdict = judge(reading, {
        duplicateOf,
        sameFileAs: sameFile && sameFile.policy_id
          ? { filename: sameFile.filename, uploaded_at: sameFile.uploaded_at, policy_no: sameFile.policy_no }
          : null,
      });
      if (verdict.verdict !== 'ready') {
        failed.push({
          filename: doc.filename,
          why: (verdict.verdict === 'review' ? 'needs a look before it can be saved: ' : '') + verdict.reasons.join('; '),
        });
        continue;
      }

      const principal = findPrincipalByName(doc.principal_detected ?? '');
      if (!principal) { failed.push({ filename: doc.filename, why: 'the insurer could not be matched' }); continue; }

      const name = String(val('insured_name') ?? '');
      if (!name) { failed.push({ filename: doc.filename, why: 'no insured name' }); continue; }
      const nric = val('nric') ? String(val('nric')) : null;
      const existing = findClientByIdentity(user.org_id, name, nric);
      const clientId = existing
        ? (existing.id as string)
        : createClientFromPolicy(
            user.org_id, name, nric,
            val('address') ? String(val('address')) : null,
            val('occupation') ? String(val('occupation')) : null,
          );

      /*
       * Motor or not, decided from what the document turned out to hold. The
       * document row's `kind` says 'schedule' for every upload, and the class
       * cannot come from the browser: it picks the register the policy lands
       * on and the commission rate it earns.
       */
      const isMotor = Boolean(val('vehicle_no') || val('chassis_no') || val('engine_no'));

      // Built through the same function the review form uses, so a policy
      // saved in a batch and one saved one at a time cannot disagree about
      // the arithmetic.
      const form = new FormData();
      const put = (k: string, v: unknown) => { if (v !== null && v !== undefined && v !== '') form.set(k, String(v)); };
      put('class', isMotor ? 'motor' : 'non_motor');
      for (const [key, target] of [
        ['policy_no', 'policy_no'], ['cover_note_no', 'cover_note_no'], ['product', 'product'],
        ['type_of_cover', 'type_of_cover'], ['issue_date', 'issue_date'],
        ['effective_date', 'effective_date'], ['expiry_date', 'expiry_date'],
        ['sum_insured', 'sum_insured'], ['ncd_pct', 'ncd_pct'], ['excess', 'excess'],
        ['basic_premium', 'basic_premium'], ['gross_premium', 'gross_premium'],
        ['service_tax', 'service_tax'], ['stamp_duty', 'stamp_duty'],
        ['total_payable', 'total_premium'],
        ['vehicle_no', 'vehicle_no'], ['make_model', 'make_model'], ['body_type', 'body_type'],
        ['engine_no', 'engine_no'], ['chassis_no', 'chassis_no'], ['engine_cc', 'engine_cc'],
        ['year_make', 'year_make'], ['seating', 'seating'], ['hire_purchase', 'hire_purchase'],
        ['named_drivers', 'named_drivers'], ['windscreen_si', 'windscreen_si'],
      ] as [FieldKey, string][]) {
        put(target, val(key));
      }
      put('commission_rate', isMotor ? principal.motor_rate : principal.non_motor_rate);
      put('status', 'active');
      put('case_type', 'new');
      put('source_file', doc.filename);

      const input = await buildInputFrom(form, user.org_id, clientId, principal.id as string);
      const id = createPolicy(input, { uploadedAt: today() });
      attachDocumentToPolicy(documentId, id, user.org_id);
      saved++;

      await audit(user, {
        action: 'policy.create', entity: 'policy', entityId: id, entityLabel: policyNo,
        summary: `Policy ${policyNo} created from ${doc.filename} in a batch — ${money(input.total_premium)} total payable, with its source document attached.`,
      });
    } catch (error) {
      failed.push({
        filename: doc.filename,
        why: error instanceof Error ? error.message : 'could not be saved',
      });
    }
  }

  await audit(user, {
    action: 'policy.bulk_create', entity: 'policy',
    summary:
      `${saved} polic${saved === 1 ? 'y' : 'ies'} created from a batch of ${ids.length}` +
      (failed.length ? `, ${failed.length} left out.` : '.'),
  });

  revalidatePath('/insurance/general-motor');
  revalidatePath('/insurance/non-motor');
  revalidatePath('/');
  return { saved, failed };
}

/** Throw away a reading the agent does not want — the row and the file. */
export async function discardReadingAction(fd: FormData): Promise<void> {
  const guard = await authorise({ action: 'document.discard', entity: 'policy_document' });
  if (!guard.ok) return;

  const id = String(fd.get('document_id') ?? '');
  const row = deleteDocumentRow(id, guard.user.org_id);
  if (!row) return;
  if (row.storage_key) deleteDocument(row.storage_key);

  await audit(guard.user, {
    action: 'document.discard', entity: 'policy_document', entityId: id, entityLabel: row.filename,
    summary: `${row.filename} discarded from a batch without being saved.`,
  });
}
