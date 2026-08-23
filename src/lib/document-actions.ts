'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { authorise, forbid } from './guard';
import { audit } from './audit';
import {
  recordUpload, setDocumentStorageKey, deleteDocumentRow, getPolicy,
  findDocumentByHash, getClaim, setDocumentClaim,
} from './queries';
import {
  contentTypeFor, storageKeyFor, writeDocument, deleteDocument, sha256, ACCEPTED,
} from './files';
import { classSlug } from './format';
import { isKind } from './document-kinds';

const MAX_BYTES = 15 * 1024 * 1024;


export type DocumentState = { ok?: boolean; error?: string; note?: string };

function kindOf(value: string): string {
  return isKind(value) ? value : 'other';
}

/** Attach a document to a policy or a claim that already exists. */
export async function attachDocumentAction(_prev: unknown, fd: FormData): Promise<DocumentState> {
  const owner = String(fd.get('owner') ?? 'policy') === 'claim' ? 'claim' : 'policy';
  const ownerId = String(fd.get('owner_id') ?? '');
  const guard = await authorise({
    action: 'document.attach', entity: 'policy_document', entityId: ownerId,
  });
  if (!guard.ok) return { error: guard.message };
  const user = guard.user;

  // A claim's papers hang off the claim, but they still belong to the policy
  // underneath it, so the row carries both — deleting either takes them.
  let policyId = ownerId;
  let claimId: string | null = null;
  let label: string;
  let back: string;

  if (owner === 'claim') {
    const claim = getClaim(ownerId, user.org_id);
    if (!claim) return { error: 'That claim could not be found.' };
    policyId = claim.policy_id;
    claimId = claim.id;
    label = claim.claim_no;
    back = `/claims/${claim.id}`;
  } else {
    const data = getPolicy(ownerId);
    if (!data || data.policy.org_id !== user.org_id) return { error: 'That policy could not be found.' };
    label = data.policy.policy_no as string;
    back = `/insurance/${classSlug(data.policy.class as string)}/${ownerId}`;
  }

  const file = fd.get('file');
  if (!(file instanceof File) || file.size === 0) return { error: 'Choose a file to attach.' };
  if (file.size > MAX_BYTES) {
    return { error: `That file is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is 15 MB.` };
  }

  const type = contentTypeFor(file);
  if (!type) {
    return {
      error: `Attach a PDF, JPEG or PNG. ${Object.values(ACCEPTED).join(', ')} are the formats a policy file needs.`,
    };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const hash = sha256(bytes);
  const same = findDocumentByHash(user.org_id, hash);

  const id = recordUpload({
    org_id: user.org_id,
    policy_id: policyId,
    filename: file.name,
    byte_size: file.size,
    page_count: 0,
    principal_detected: null,
    used_claude: 0,
    field_count: 0,
    warnings: '[]',
    extracted_json: '',
    uploaded_by: user.id,
    storage_key: null,
    content_type: type,
    sha256: hash,
    kind: kindOf(String(fd.get('kind') ?? '')),
    note: String(fd.get('note') ?? '').trim() || null,
  });

  const key = storageKeyFor(user.org_id, id, type);
  try {
    writeDocument(key, bytes);
    setDocumentStorageKey(id, user.org_id, key);
  } catch (error) {
    console.error('storing an attached document failed', error);
    deleteDocumentRow(id, user.org_id);
    return { error: 'The file could not be stored. Check the server has room and try again.' };
  }

  if (claimId) setDocumentClaim(id, user.org_id, claimId);

  await audit(user, {
    action: 'document.attach', entity: 'policy_document', entityId: id, entityLabel: file.name,
    summary: `${file.name} attached to ${label}.`,
  });

  revalidatePath(back);
  return {
    ok: true,
    note: same
      ? `Attached. The same file is already on record${same.policy_no ? ` against ${same.policy_no}` : ''} — check this is not a duplicate.`
      : 'Attached.',
  };
}

export async function deleteDocumentAction(fd: FormData) {
  const id = String(fd.get('document_id') ?? '');
  const guard = await authorise({ action: 'document.delete', entity: 'policy_document', entityId: id });
  if (!guard.ok) forbid(guard.message);
  const user = guard.user;

  const row = deleteDocumentRow(id, user.org_id);
  const back = String(fd.get('back') ?? '/');
  if (!row) redirect(back);

  if (row.storage_key) deleteDocument(row.storage_key);
  await audit(user, {
    action: 'document.delete', entity: 'policy_document', entityId: id, entityLabel: row.filename,
    summary: `${row.filename} removed from the file.`,
  });

  revalidatePath(back);
  redirect(back);
}
