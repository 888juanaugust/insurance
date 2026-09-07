import type { UploadState } from './policy-actions';
import type { ExtractionResult, FieldKey, FieldResult } from './extract';
import { emptyFields } from './extract/types';
import {
  getDocument, findPolicyByNumber, findClientByIdentity, findDocumentByHash,
  type DocumentRow,
} from './queries';

/**
 * A reading, back from the document row it was stored on.
 *
 * Every upload writes what it read into the document row before anything is
 * shown, so a reading can be reopened — a row in a batch that "needs a look"
 * can be sent to the same check screen a single upload gets, and a batch save
 * can be judged again on the server from the stored reading rather than from
 * anything the browser sent.
 */
export function resultFromDocument(doc: DocumentRow): ExtractionResult {
  const stored = JSON.parse(doc.extracted_json || '{}') as Partial<Record<FieldKey, FieldResult>>;
  const fields = { ...emptyFields(), ...stored } as Record<FieldKey, FieldResult>;
  let warnings: string[] = [];
  try {
    const parsed = JSON.parse(doc.warnings || '[]');
    if (Array.isArray(parsed)) warnings = parsed.map(String);
  } catch {
    /* an unreadable warnings column is not worth failing the reading over */
  }
  // The class the reader judged, stored with the reading. Older rows have
  // none and fall back to what the fields say.
  const isMotor = doc.detected_class
    ? doc.detected_class === 'motor'
    : Boolean(fields.vehicle_no?.value || fields.chassis_no?.value || fields.engine_no?.value);
  return {
    fields,
    principal: doc.principal_detected,
    principalConfidence: doc.principal_detected ? 1 : 0,
    cls: isMotor ? 'motor' : 'non_motor',
    pageCount: doc.page_count,
    usedClaude: doc.used_claude === 1,
    warnings,
    // Notes are for the moment of reading; a reading brought back later has none.
    notes: [],
  };
}

/**
 * The state the check screen would have had, had this document just been
 * uploaded — duplicates and client matches looked up afresh, since the
 * register may have moved on since the reading was made.
 */
export function readingFromDocument(documentId: string, orgId: string): UploadState | null {
  const doc = getDocument(documentId, orgId);
  if (!doc || !doc.extracted_json) return null;

  const result = resultFromDocument(doc);
  const policyNo = result.fields.policy_no.value;
  const insured = result.fields.insured_name.value;
  const nric = result.fields.nric.value;

  const duplicateOf =
    typeof policyNo === 'string' ? findPolicyByNumber(orgId, policyNo) : undefined;
  const client = findClientByIdentity(
    orgId,
    typeof insured === 'string' ? insured : null,
    typeof nric === 'string' ? nric : null,
  );
  const sameFile = doc.sha256 ? findDocumentByHash(orgId, doc.sha256, doc.id) : undefined;

  return {
    ok: true,
    filename: doc.filename,
    documentId: doc.id,
    result,
    duplicateOf: duplicateOf ? { id: duplicateOf.id as string, policy_no: duplicateOf.policy_no as string } : undefined,
    sameFileAs: sameFile
      ? { filename: sameFile.filename, uploaded_at: sameFile.uploaded_at, policy_no: sameFile.policy_no }
      : null,
    matchedClient: client ? { id: client.id as string, name: client.name as string } : null,
  };
}
