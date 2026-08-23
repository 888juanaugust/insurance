'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { authorise, forbid } from './guard';
import { audit, diff } from './audit';
import { extractPolicy, type ExtractionResult, type FieldKey } from './extract';
import {
  createPolicy, updatePolicy, deletePolicy, policyDeleteBlock, bulkMarkPaid, recordUpload,
  findClientByIdentity, createClientFromPolicy, findPolicyByNumber, findPrincipalByName,
  listPrincipals, getPolicy, type PolicyInput,
} from './queries';
import { classSlug, today, money } from './format';

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

export type UploadState = {
  ok: boolean;
  error?: string;
  filename?: string;
  result?: ExtractionResult;
  duplicateOf?: { id: string; policy_no: string };
  matchedClient?: { id: string; name: string } | null;
};

/** Read an uploaded policy document and return what it contains for review. */
export async function uploadPolicyAction(_prev: unknown, formData: FormData): Promise<UploadState> {
  const guard = await authorise('policy.write', { action: 'policy.upload', entity: 'policy' });
  if (!guard.ok) return { ok: false, error: guard.message };
  const user = guard.user;

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

  let result: ExtractionResult;
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
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

  const found = Object.values(result.fields).filter((f) => f.value !== null).length;
  recordUpload({
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
    uploaded_by: user.id,
  });

  return {
    ok: true,
    filename: file.name,
    result,
    duplicateOf,
    matchedClient: client ? { id: client.id, name: client.name } : null,
  };
}

/* ------------------------------------------------------------------ save */

function str(fd: FormData, key: string): string {
  return String(fd.get(key) ?? '').trim();
}
function numOf(fd: FormData, key: string): number {
  const n = Number(String(fd.get(key) ?? '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}
const r2 = (n: number) => Math.round(n * 100) / 100;

function buildInput(fd: FormData, orgId: string, clientId: string, principalId: string): PolicyInput {
  const cls = str(fd, 'class') === 'non_motor' ? 'non_motor' : 'motor';
  const gross = numOf(fd, 'gross_premium');
  const tax = numOf(fd, 'service_tax');
  const stamp = numOf(fd, 'stamp_duty');
  const totalField = numOf(fd, 'total_premium');
  const total = totalField > 0 ? totalField : r2(gross + tax + stamp);

  const commissionRate = numOf(fd, 'commission_rate');
  const commissionAmt = numOf(fd, 'commission_amt') || r2(gross * (commissionRate / 100));

  const ncdPct = numOf(fd, 'ncd_pct');
  const extra = numOf(fd, 'extra_premium');
  const basicField = numOf(fd, 'basic_premium');
  const basic = basicField > 0 ? basicField : ncdPct < 100 ? r2((gross - extra) / (1 - ncdPct / 100)) : gross;

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
    basic_premium: basic,
    ncd_pct: ncdPct,
    ncd_amount: r2(basic - (gross - extra)),
    extra_premium: extra,
    gross_premium: gross,
    service_tax: tax,
    stamp_duty: stamp,
    total_premium: total,
    commission_rate: commissionRate,
    commission_amt: commissionAmt,
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
  const guard = await authorise('policy.write', {
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
    if (!first) return { error: 'No insurance companies are configured. Add one under Setting → Global.' , values: submitted(fd) };
    return { error: 'Choose the principal for this policy.' , values: submitted(fd) };
  }

  // Resolve the client: an existing one, or create from what the document gave.
  let clientId = str(fd, 'client_id');
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

  if (editingId) {
    const previous = getPolicy(editingId)?.policy as Record<string, unknown> | undefined;
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

  const id = createPolicy(input, { uploadedAt: today() });
  await audit(user, {
    action: 'policy.create', entity: 'policy', entityId: id, entityLabel: policyNo,
    summary: `Policy ${policyNo} created — ${money(input.total_premium)} total payable.`,
  });
  revalidatePath('/insurance/general-motor');
  revalidatePath('/insurance/non-motor');
  revalidatePath('/');
  redirect(`/insurance/${classSlug(input.class)}/${id}`);
}

export async function deletePolicyAction(fd: FormData) {
  const id = String(fd.get('id') ?? '');
  const cls = String(fd.get('cls') ?? 'motor');
  const guard = await authorise('policy.delete', { action: 'policy.delete', entity: 'policy', entityId: id });
  if (!guard.ok) forbid(guard.message);
  const user = guard.user;
  if (!id) redirect(`/insurance/${cls}`);

  // The page hides the button when the policy cannot go, but the page it was
  // rendered from may be minutes old — a collection recorded in between has to
  // stop the delete, not be discovered afterwards.
  const existing = getPolicy(id)?.policy as { policy_no: string; total_premium: number } | undefined;
  const blocked = policyDeleteBlock(id, user.org_id);
  if (blocked) {
    await audit(user, {
      action: 'policy.delete', entity: 'policy', entityId: id,
      entityLabel: existing?.policy_no ?? null, outcome: 'refused', summary: blocked,
    });
    redirect(`/insurance/${cls}/${id}?blocked=${encodeURIComponent(blocked)}`);
  }

  deletePolicy(id, user.org_id);
  await audit(user, {
    action: 'policy.delete', entity: 'policy', entityId: id, entityLabel: existing?.policy_no ?? null,
    summary: `Policy ${existing?.policy_no ?? id} deleted, with its payment and commission records.`,
  });
  revalidatePath(`/insurance/${cls}`);
  revalidatePath('/');
  redirect(`/insurance/${cls}?deleted=1`);
}

export async function bulkPaidAction(fd: FormData) {
  const kind = String(fd.get('kind') ?? '') === 'principal' ? 'principal' : 'client';
  const guard = await authorise('payment.record', {
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
  revalidatePath(String(fd.get('back') ?? '/insurance/general-motor'));
  revalidatePath('/');
}

export type { FieldKey };
