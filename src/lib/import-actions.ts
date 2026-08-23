'use server';

import { revalidatePath } from 'next/cache';
import { authorise } from './guard';
import { audit } from './audit';
import { analyse, type Analysis } from './import-run';
import { readNumber, type ImportKind } from './import-spec';
import {
  importClients, importPolicies, createClientFromPolicy,
  type ImportedClient, type ImportedPolicy,
} from './queries';
import { toCsv } from './csv';

const MAX_BYTES = 5 * 1024 * 1024;
/** Enough for an agency's whole book; beyond it the preview stops being readable. */
const MAX_ROWS = 5000;

export type ImportState = {
  ok?: boolean;
  error?: string;
  analysis?: Analysis;
  /** The file, carried through the preview so committing needs no second upload. */
  text?: string;
  kind?: ImportKind;
  /** Set after a commit. */
  written?: { inserted: number; skipped: number; kind: ImportKind };
  correctionsCsv?: string;
};

function isKind(v: string): v is ImportKind {
  return v === 'clients' || v === 'policies';
}

/** Read the file and report what would happen. Writes nothing. */
export async function analyseImportAction(_prev: unknown, fd: FormData): Promise<ImportState> {
  const guard = await authorise({ action: 'import.analyse', entity: 'import' });
  if (!guard.ok) return { error: guard.message };
  const user = guard.user;

  const kindRaw = String(fd.get('kind') ?? '');
  if (!isKind(kindRaw)) return { error: 'Choose whether the file holds clients or policies.' };

  const file = fd.get('file');
  if (!(file instanceof File) || file.size === 0) return { error: 'Choose a CSV file.' };
  if (file.size > MAX_BYTES) {
    return { error: `That file is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is 5 MB.` };
  }
  if (!/\.csv$/i.test(file.name) && file.type !== 'text/csv') {
    return {
      error: 'Import takes a CSV. Save the spreadsheet as CSV first — Excel offers it under Save As.',
    };
  }

  const text = await file.text();
  const analysis = analyse(user.org_id, kindRaw, text);

  if (!analysis.rows.length) {
    return { error: 'That file has a header but no rows.', kind: kindRaw };
  }
  if (analysis.rows.length > MAX_ROWS) {
    return { error: `That file has ${analysis.rows.length} rows. Split it into files of ${MAX_ROWS} or fewer.` };
  }
  if (analysis.missingRequired.length) {
    return {
      error: `The file has no column for ${analysis.missingRequired.join(', ')}. Add ${analysis.missingRequired.length === 1 ? 'it' : 'them'} and upload again.`,
      analysis, kind: kindRaw, text,
    };
  }

  await audit(user, {
    action: 'import.analyse', entity: 'import', entityLabel: file.name,
    summary: `${file.name} read for import — ${analysis.counts.total} rows, ${analysis.counts.ok} ready, ${analysis.counts.errors} with problems. Nothing written.`,
  });

  return { ok: true, analysis, kind: kindRaw, text };
}

/** Write the rows that passed. Rows with errors are left out and returned. */
export async function commitImportAction(_prev: unknown, fd: FormData): Promise<ImportState> {
  const guard = await authorise({ action: 'import.commit', entity: 'import' });
  if (!guard.ok) return { error: guard.message };
  const user = guard.user;

  const kindRaw = String(fd.get('kind') ?? '');
  const text = String(fd.get('text') ?? '');
  if (!isKind(kindRaw) || !text) return { error: 'The uploaded file was lost. Upload it again.' };

  // Re-analysed rather than trusting the preview: the register may have moved
  // on since, and a duplicate that appeared in between must still be caught.
  const analysis = analyse(user.org_id, kindRaw, text);
  const good = analysis.rows.filter((r) => r.ok);
  const bad = analysis.rows.filter((r) => !r.ok);

  if (!good.length) {
    return { error: 'No row is ready to import. Fix the problems listed and upload again.', analysis, kind: kindRaw, text };
  }

  let inserted = 0;
  if (kindRaw === 'clients') {
    const rows: ImportedClient[] = good.map((r) => ({
      name: r.values.name,
      client_type: r.values.client_type || 'individual',
      nric: r.values.nric || null,
      business_reg: r.values.business_reg || null,
      email: r.values.email || null,
      phone: r.values.phone || null,
      address1: r.values.address1 || null,
      address2: r.values.address2 || null,
      postcode: r.values.postcode || null,
      city: r.values.city || null,
      state: r.values.state || null,
      occupation: r.values.occupation || null,
      dob: r.values.dob || null,
    }));
    inserted = importClients(user.org_id, rows);
  } else {
    const rows: ImportedPolicy[] = good.map((r) => {
      // An insured with no client on file gets one, so the policy is never
      // orphaned — the same thing the PDF upload does.
      const clientId = r.values.client_id
        || createClientFromPolicy(user.org_id, r.values.insured_name, r.values.nric || null, null, null);
      const gross = readNumber(r.values.gross_premium) ?? 0;
      const tax = readNumber(r.values.service_tax) ?? 0;
      const stamp = readNumber(r.values.stamp_duty) ?? 0;
      const total = readNumber(r.values.total_premium) ?? Math.round((gross + tax + stamp) * 100) / 100;
      return {
        policy_no: r.values.policy_no,
        client_id: clientId,
        principal_id: r.values.principal_id,
        class: r.values.class || 'motor',
        product: r.values.product || null,
        effective_date: r.values.effective_date,
        expiry_date: r.values.expiry_date,
        sum_insured: readNumber(r.values.sum_insured) ?? 0,
        gross_premium: gross,
        service_tax: tax,
        stamp_duty: stamp,
        total_premium: total,
        ncd_pct: readNumber(r.values.ncd_pct) ?? 0,
        remarks: r.values.remarks || null,
        vehicle_no: r.values.vehicle_no || null,
        make_model: r.values.make_model || null,
      };
    });
    inserted = importPolicies(user.org_id, rows);
  }

  // What went wrong, as a file the agency can correct and re-upload.
  const correctionsCsv = bad.length
    ? toCsv(
        ['line', 'problem', ...analysis.headers],
        bad.map((r) => [
          String(r.line),
          r.problems.filter((p) => p.severity === 'error').map((p) => p.message).join(' '),
          ...analysis.headers.map((_, i) => {
            const key = Object.keys(analysis.mapping).find((k) => analysis.mapping[k] === i);
            return key ? (r.values[key] ?? '') : '';
          }),
        ]),
      )
    : '';

  await audit(user, {
    action: 'import.commit', entity: 'import',
    summary: `${inserted} ${kindRaw} imported${bad.length ? `, ${bad.length} row${bad.length === 1 ? '' : 's'} left out for correction` : ''}.`,
  });

  revalidatePath('/clients');
  revalidatePath('/insurance/general-motor');
  revalidatePath('/insurance/non-motor');
  revalidatePath('/');

  return {
    ok: true,
    written: { inserted, skipped: bad.length, kind: kindRaw },
    analysis,
    kind: kindRaw,
    correctionsCsv,
  };
}
