'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { authorise, forbid } from './guard';
import { audit, diff } from './audit';
import { extractPolicy, type ExtractionResult, type FieldKey } from './extract';
import {
  createPolicyWithLinks, clientBelongsToOrg, subAgentBelongsToOrg,
  createPolicy, updatePolicy, deletePolicy, policyDeleteBlock, bulkMarkPaid, recordUpload,
  findClientByIdentity, createClientFromPolicy, findPolicyByNumber, findPrincipalByName,
  listPrincipals, getPolicy, attachDocumentToPolicy, findDocumentByHash,
  policyStorageKeys, setDocumentStorageKey, abandonedUploads, deleteDocumentRows,
  linkRenewal, type PolicyInput,
} from './queries';
import {
  contentTypeFor, storageKeyFor, writeDocument, deleteDocument, sha256,
} from './files';
import { classSlug, today, money } from './format';
import { checkUploadRate } from './rate-limit';
import { safeBack } from './request';
import { policyFigures } from './premium';

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

export type UploadState = {
  ok: boolean;
  error?: string;
  filename?: string;
  /** The stored document, so saving the reviewed policy can attach it. */
  documentId?: string;
  /** The same file already on record — usually means the policy is too. */
  sameFileAs?: { filename: string; uploaded_at: string; policy_no: string | null } | null;
  result?: ExtractionResult;
  duplicateOf?: { id: string; policy_no: string };
  matchedClient?: { id: string; name: string } | null;
};

/** Read an uploaded policy document and return what it contains for review. */
export async function uploadPolicyAction(_prev: unknown, formData: FormData): Promise<UploadState> {
  const guard = await authorise({ action: 'policy.upload', entity: 'policy' });
  if (!guard.ok) return { ok: false, error: guard.message };
  const user = guard.user;

  // Housekeeping, here because this is the only place documents arrive: a
  // review that was read and then abandoned leaves a file nothing references.
  await sweepAbandonedUploads(user);

  // Reading a PDF is CPU on the one process, and the model pass is paid for.
  // Sixty readings in fifteen minutes is a whole afternoon's stack; past
  // that the person is asked to wait rather than the server made to.
  const uploads = checkUploadRate(`upload:${user.id}`);
  if (!uploads.allowed) {
    const mins = Math.ceil(uploads.retryAfterSec / 60);
    return { ok: false, error: `That is a lot of documents in a short time. Try again in ${mins} minute${mins === 1 ? '' : 's'}.` };
  }

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: 'Choose a PDF policy document to upload.' };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, error: `That file is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is 15 MB.` };
  }
  const isPdf =
    file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  if (!isPdf) {
    return { ok: false, error: 'Only PDF policy documents can be read. Use Create Policy to key one in by hand.' };
  }

  const type = contentTypeFor(file);
  if (type !== 'application/pdf') {
    return { ok: false, error: 'Only PDF policy documents can be read. Use Create Policy to key one in by hand.' };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const hash = sha256(bytes);

  let result: ExtractionResult;
  try {
    result = await extractPolicy(bytes);
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? `That PDF could not be read: ${error.message}`
          : 'That PDF could not be read.',
    };
  }

  const policyNo = result.fields.policy_no.value;
  const duplicateOf =
    typeof policyNo === 'string' ? findPolicyByNumber(user.org_id, policyNo) : undefined;

  const insured = result.fields.insured_name.value;
  const nric = result.fields.nric.value;
  const client = findClientByIdentity(
    user.org_id,
    typeof insured === 'string' ? insured : null,
    typeof nric === 'string' ? nric : null,
  );

  // Matching on the content hash catches the same schedule sent twice even
  // when it has been renamed — which is how one policy becomes two rows.
  const sameFile = findDocumentByHash(user.org_id, hash);

  const found = Object.values(result.fields).filter((f) => f.value !== null).length;
  const documentId = recordUpload({
    org_id: user.org_id,
    policy_id: null,
    filename: file.name,
    byte_size: file.size,
    page_count: result.pageCount,
    principal_detected: result.principal,
    used_claude: result.usedClaude ? 1 : 0,
    field_count: found,
    warnings: JSON.stringify(result.warnings),
    extracted_json: JSON.stringify(result.fields),
    detected_class: result.cls,
    uploaded_by: user.id,
    storage_key: null,
    content_type: type,
    sha256: hash,
    kind: 'schedule',
    note: null,
  });

  // The row is written first so the file is named after it; a file with no row
  // is unreachable, while a row with no file degrades to a broken link the
  // page can report.
  const key = storageKeyFor(user.org_id, documentId, type);
  try {
    writeDocument(key, bytes);
    setDocumentStorageKey(documentId, user.org_id, key);
  } catch (error) {
    console.error('storing the uploaded document failed', error);
    // Reading it still worked, so the review goes ahead — losing the file copy
    // must not cost the extraction the person is waiting for.
  }

  await audit(user, {
    action: 'policy.upload', entity: 'policy_document', entityId: documentId, entityLabel: file.name,
    summary: `${file.name} read — ${found} field${found === 1 ? '' : 's'} found across ${result.pageCount} page${result.pageCount === 1 ? '' : 's'}${result.principal ? `, principal detected as ${result.principal}` : ''}.`,
  });

  return {
    ok: true,
    filename: file.name,
    documentId,
    result,
    duplicateOf,
    sameFileAs: sameFile
      ? { filename: sameFile.filename, uploaded_at: sameFile.uploaded_at, policy_no: sameFile.policy_no }
      : null,
    matchedClient: client ? { id: client.id, name: client.name } : null,
  };
}

/**
 * Removes uploads that were read but never turned into a policy. Deleting
 * somebody's document is worth a line in the trail even when nobody asked for
 * it, so the sweep records what it took.
 */
const lastSweep = new Map<string, number>();
const SWEEP_EVERY_MS = 60 * 60 * 1000;

async function sweepAbandonedUploads(user: { id: string; org_id: string; name: string; role: string }) {
  // Once an hour per agency, not on every file of a thirty-file batch; and
  // only this agency's uploads — it used to remove every organisation's.
  const now = Date.now();
  if (now - (lastSweep.get(user.org_id) ?? 0) < SWEEP_EVERY_MS) return;
  lastSweep.set(user.org_id, now);
  try {
    const stale = abandonedUploads(user.org_id, 7);
    if (!stale.length) return;
    deleteDocumentRows(stale.map((d) => d.id));
    for (const d of stale) deleteDocument(d.storage_key);
    await audit(user, {
      action: 'document.sweep', entity: 'policy_document',
      summary: `${stale.length} upload${stale.length === 1 ? '' : 's'} read but never saved to a policy, older than 7 days, removed.`,
    });
  } catch (error) {
    // Tidying up must never cost the upload the person is waiting on.
    console.error('sweeping abandoned uploads failed', error);
  }
}

/* ------------------------------------------------------------------ save */

function str(fd: FormData, key: string): string {
  return String(fd.get(key) ?? '').trim();
}
function numOf(fd: FormData, key: string): number {
  const n = Number(String(fd.get(key) ?? '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

/**
 * Shared with the batch importer, so a policy saved one at a time and one
 * saved in a stack of thirty cannot disagree about the arithmetic.
 */
export async function buildInputFrom(
  fd: FormData, orgId: string, clientId: string, principalId: string,
): Promise<PolicyInput> {
  return buildInput(fd, orgId, clientId, principalId);
}

function buildInput(fd: FormData, orgId: string, clientId: string, principalId: string): PolicyInput {
  const cls = str(fd, 'class') === 'non_motor' ? 'non_motor' : 'motor';
  // The arithmetic lives in premium.ts, where it can be tested with plain
  // values; this only maps the form onto the row.
  const f = policyFigures((name) => String(fd.get(name) ?? ''));

  return {
    org_id: orgId,
    client_id: clientId,
    principal_id: principalId,
    sub_agent_id: str(fd, 'sub_agent_id') || null,
    policy_no: str(fd, 'policy_no'),
    cover_note_no: str(fd, 'cover_note_no') || null,
    class: cls,
    product: str(fd, 'product') || (cls === 'motor' ? 'Private Car' : 'General'),
    type_of_cover: str(fd, 'type_of_cover') || 'Comprehensive',
    status: str(fd, 'status') || 'active',
    case_type: str(fd, 'case_type') || 'new',
    effective_date: str(fd, 'effective_date'),
    expiry_date: str(fd, 'expiry_date'),
    issue_date: str(fd, 'issue_date') || str(fd, 'effective_date'),
    sum_insured: numOf(fd, 'sum_insured'),
    basic_premium: f.basic_premium,
    ncd_pct: f.ncd_pct,
    ncd_amount: f.ncd_amount,
    extra_premium: f.extra_premium,
    gross_premium: f.gross_premium,
    service_tax: f.service_tax,
    stamp_duty: f.stamp_duty,
    total_premium: f.total_premium,
    commission_rate: f.commission_rate,
    commission_amt: f.commission_amt,
    agent_commission: numOf(fd, 'agent_commission'),
    referral_fee: numOf(fd, 'referral_fee'),
    excess: numOf(fd, 'excess'),
    remarks: str(fd, 'remarks') || null,
    source_file: str(fd, 'source_file') || null,
    motor:
      cls === 'motor'
        ? {
            vehicle_no: str(fd, 'vehicle_no'),
            make_model: str(fd, 'make_model'),
            body_type: str(fd, 'body_type') || null,
            engine_no: str(fd, 'engine_no'),
            chassis_no: str(fd, 'chassis_no'),
            engine_cc: str(fd, 'engine_cc'),
            year_make: str(fd, 'year_make'),
            seating: numOf(fd, 'seating'),
            hire_purchase: str(fd, 'hire_purchase') || null,
            windscreen_si: numOf(fd, 'windscreen_si'),
            named_drivers: str(fd, 'named_drivers') || null,
            extensions: str(fd, 'extensions') || null,
            rtd_code: str(fd, 'rtd_code') || null,
          }
        : undefined,
    nonMotor:
      cls === 'non_motor'
        ? {
            risk_type: str(fd, 'risk_type') || str(fd, 'product'),
            risk_address: str(fd, 'risk_address'),
            occupancy: str(fd, 'occupancy'),
            period_desc: str(fd, 'period_desc') || '12 months',
            benefits: str(fd, 'benefits'),
          }
        : undefined,
  };
}

export type SaveState = {
  error?: string;
  /**
   * What was submitted, echoed back. React resets the form once a server
   * action returns, so without this a rejected save empties every field —
   * including a whole policy just read out of a PDF.
   */
  values?: Record<string, string>;
};

function submitted(fd: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of fd.entries()) {
    if (typeof value === 'string' && !key.startsWith('$')) out[key] = value;
  }
  return out;
}

/** Persist a reviewed policy — from the upload review form or Create Policy. */
export async function savePolicyAction(_prev: unknown, fd: FormData): Promise<SaveState> {
  const guard = await authorise({
    action: str(fd, 'policy_id') ? 'policy.update' : 'policy.create',
    entity: 'policy',
    entityId: str(fd, 'policy_id') || null,
    entityLabel: str(fd, 'policy_no') || null,
  });
  if (!guard.ok) return { error: guard.message, values: submitted(fd) };
  const user = guard.user;

  const policyNo = str(fd, 'policy_no');
  if (!policyNo) return { error: 'Policy number is required.' , values: submitted(fd) };
  if (!str(fd, 'effective_date') || !str(fd, 'expiry_date')) {
    return { error: 'Both the effective and expiry dates are required.' , values: submitted(fd) };
  }
  if (str(fd, 'expiry_date') <= str(fd, 'effective_date')) {
    return { error: 'The expiry date must fall after the effective date.' , values: submitted(fd) };
  }
  if (numOf(fd, 'total_premium') <= 0 && numOf(fd, 'gross_premium') <= 0) {
    return { error: 'Enter the gross premium or the total payable.' , values: submitted(fd) };
  }

  // Resolve the principal, by id when picked or by detected name from a document.
  let principalId = str(fd, 'principal_id');
  if (!principalId) {
    const detected = findPrincipalByName(str(fd, 'principal_detected'));
    if (detected) principalId = detected.id as string;
  }
  if (!principalId) {
    const first = listPrincipals()[0];
    if (!first) return { error: 'No insurance companies are configured. Add one under More → Settings → Rates and insurers.' , values: submitted(fd) };
    return { error: 'Choose the principal for this policy.' , values: submitted(fd) };
  }

  // Resolve the client: an existing one, or create from what the document gave.
  // An id posted from the form has to be one of this agency's — a client id
  // from another agency would have put their name and NRIC on this policy's page.
  let clientId = str(fd, 'client_id');
  if (clientId && !clientBelongsToOrg(clientId, user.org_id)) {
    return { error: 'That client is not on your register.', values: submitted(fd) };
  }
  const subAgentId = str(fd, 'sub_agent_id');
  if (subAgentId && !subAgentBelongsToOrg(subAgentId, user.org_id)) {
    return { error: 'That servicing agent is not one of yours.', values: submitted(fd) };
  }
  if (!clientId) {
    const name = str(fd, 'insured_name');
    if (!name) return { error: 'Enter the insured name, or pick an existing client.' , values: submitted(fd) };
    const nric = str(fd, 'nric') || null;
    const existing = findClientByIdentity(user.org_id, name, nric);
    clientId = existing
      ? (existing.id as string)
      : createClientFromPolicy(user.org_id, name, nric, str(fd, 'address') || null, str(fd, 'occupation') || null);
  }

  const editingId = str(fd, 'policy_id');
  const input = buildInput(fd, user.org_id, clientId, principalId);

  // The sub agent's share cannot exceed what the agency earns on the case.
  if (input.agent_commission > input.commission_amt + 0.005) {
    return {
      error: `Agent commission of ${money(input.agent_commission)} is more than the ${money(input.commission_amt)} the agency earns on this policy.`,
      values: submitted(fd),
    };
  }

  if (editingId) {
    // The same duplicate check as on create: a policy number changed on edit
    // to one already on file went straight in, and the statement matcher then
    // booked the insurer's payment against whichever row it reached first.
    const clash = findPolicyByNumber(user.org_id, policyNo);
    if (clash && clash.id !== editingId && str(fd, 'allow_duplicate') !== '1') {
      return {
        error: `Policy ${policyNo} already exists. Tick "save anyway" to record it a second time.`,
        values: submitted(fd),
      };
    }
    const documentId = str(fd, 'document_id');
    if (documentId) attachDocumentToPolicy(documentId, editingId, user.org_id);
    const previous = getPolicy(editingId, user.org_id)?.policy as Record<string, unknown> | undefined;
    const ok = updatePolicy(editingId, user.org_id, input);
    if (!ok) return { error: 'That policy could not be found.' , values: submitted(fd) };
    await audit(user, {
      action: 'policy.update', entity: 'policy', entityId: editingId, entityLabel: policyNo,
      summary: `Policy ${policyNo} edited.`,
      changes: previous
        ? diff(previous, input as unknown as Record<string, unknown>, Object.keys(input as object))
        : null,
    });
    revalidatePath('/insurance/general-motor');
    revalidatePath('/insurance/non-motor');
    redirect(`/insurance/${classSlug(input.class)}/${editingId}`);
  }

  if (findPolicyByNumber(user.org_id, policyNo) && str(fd, 'allow_duplicate') !== '1') {
    return {
      error: `Policy ${policyNo} already exists. Tick "save anyway" to record it a second time.`,
      values: submitted(fd),
    };
  }

  // The document was stored before the policy existed, so this is where the
  // two are tied together — in the same transaction as the policy, so the
  // schedule it was read from can never be on disk but unreachable. The
  // renewal link likewise: it is the only thing distinguishing a renewal from
  // a lapse afterwards.
  const documentId = str(fd, 'document_id');
  const renewedFrom = str(fd, 'renewed_from');
  const { id, attached } = createPolicyWithLinks(input, {
    uploadedAt: today(), documentId: documentId || null, renewedFrom: renewedFrom || null,
  });

  await audit(user, {
    action: 'policy.create', entity: 'policy', entityId: id, entityLabel: policyNo,
    summary:
      `Policy ${policyNo} created — ${money(input.total_premium)} total payable`
      + (renewedFrom ? ', renewing an earlier policy' : '')
      + (attached ? ', with its source document attached' : '') + '.',
  });
  revalidatePath('/insurance/general-motor');
  revalidatePath('/insurance/non-motor');
  revalidatePath('/');
  redirect(`/insurance/${classSlug(input.class)}/${id}`);
}

export async function deletePolicyAction(fd: FormData) {
  const id = String(fd.get('id') ?? '');
  const cls = String(fd.get('cls') ?? 'motor');
  const guard = await authorise({ action: 'policy.delete', entity: 'policy', entityId: id });
  if (!guard.ok) forbid(guard.message);
  const user = guard.user;
  if (!id) redirect(`/insurance/${cls}`);

  // The page hides the button when the policy cannot go, but the page it was
  // rendered from may be minutes old — a collection recorded in between has to
  // stop the delete, not be discovered afterwards.
  const existing = getPolicy(id, user.org_id)?.policy as { policy_no: string; total_premium: number } | undefined;
  const blocked = policyDeleteBlock(id, user.org_id);
  if (blocked) {
    await audit(user, {
      action: 'policy.delete', entity: 'policy', entityId: id,
      entityLabel: existing?.policy_no ?? null, outcome: 'refused', summary: blocked,
    });
    redirect(`/insurance/${cls}/${id}?blocked=${encodeURIComponent(blocked)}`);
  }

  // Collect the storage keys before the rows go, then remove the files after
  // the database change succeeds — a file deleted first would be lost even if
  // the delete then failed.
  const keys = policyStorageKeys(id);
  deletePolicy(id, user.org_id);
  for (const key of keys) deleteDocument(key);

  await audit(user, {
    action: 'policy.delete', entity: 'policy', entityId: id, entityLabel: existing?.policy_no ?? null,
    summary: `Policy ${existing?.policy_no ?? id} deleted, with its payment and commission records${keys.length ? ` and ${keys.length} document${keys.length === 1 ? '' : 's'}` : ''}.`,
  });
  revalidatePath(`/insurance/${cls}`);
  revalidatePath('/');
  redirect(`/insurance/${cls}?deleted=1`);
}

export async function bulkPaidAction(fd: FormData) {
  const kind = String(fd.get('kind') ?? '') === 'principal' ? 'principal' : 'client';
  const guard = await authorise({
    action: `payment.bulk_${kind}`, entity: 'payment',
  });
  if (!guard.ok) forbid(guard.message);

  const ids = fd.getAll('selected').map(String).filter(Boolean);
  const n = bulkMarkPaid(ids, guard.user.org_id, kind);
  if (n > 0) {
    await audit(guard.user, {
      action: `payment.bulk_${kind}`, entity: 'payment',
      summary: `${n} ${kind === 'client' ? 'client collection' : 'principal remittance'}${n === 1 ? '' : 's'} marked settled across ${ids.length} ${ids.length === 1 ? 'policy' : 'policies'}.`,
    });
  }
  revalidatePath(safeBack(fd.get('back'), '/insurance/general-motor'));
  revalidatePath('/');
}

export type { FieldKey };
