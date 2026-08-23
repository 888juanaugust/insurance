import { parseCsv } from './csv';
import {
  fieldsFor, mapColumns, readDate, readNumber, type ImportKind,
} from './import-spec';
import {
  findClientByIdentification, findPolicyByNumber, findPrincipalByName,
  findClientByIdentity, listPrincipals,
} from './queries';

export type RowProblem = { field: string; message: string; severity: 'error' | 'warning' };

export type AnalysedRow = {
  line: number;
  values: Record<string, string>;
  /** As typed in the spreadsheet, so the preview can show what changed. */
  raw: Record<string, string>;
  problems: RowProblem[];
  /** Set when this row would land on a record already on file. */
  duplicateOf: string | null;
  ok: boolean;
};

export type Analysis = {
  kind: ImportKind;
  headers: string[];
  mapping: Record<string, number>;
  unmatched: string[];
  missingRequired: string[];
  rows: AnalysedRow[];
  counts: { total: number; ok: number; errors: number; duplicates: number; warnings: number };
  ragged: Array<{ line: number; got: number }>;
};

/**
 * Reads the file and says what would happen. Nothing is written here — an
 * import that surprises the agency is worse than one that refuses, so every
 * row is judged and shown before a single insert.
 */
export function analyse(orgId: string, kind: ImportKind, text: string): Analysis {
  const table = parseCsv(text);
  const fields = fieldsFor(kind);
  const { mapping, unmatched, missingRequired } = mapColumns(table.headers, kind);

  // Principals are matched by name; loading the list once beats a query a row.
  const principals = listPrincipals();

  const rows: AnalysedRow[] = table.rows.map((cells, i) => {
    const line = i + 2;                       // header is line 1
    const values: Record<string, string> = {};
    const raw: Record<string, string> = {};
    const problems: RowProblem[] = [];

    for (const field of fields) {
      const idx = mapping[field.key];
      const cell = idx === undefined ? '' : (cells[idx] ?? '');
      const trimmed = cell.trim();
      raw[field.key] = trimmed;

      if (field.required && !trimmed) {
        problems.push({ field: field.key, message: `${field.label} is required.`, severity: 'error' });
      }
      if (trimmed && field.validate) {
        const message = field.validate(trimmed, values);
        if (message) problems.push({ field: field.key, message, severity: 'error' });
      }
      values[field.key] = trimmed && field.clean ? field.clean(trimmed) : trimmed;
    }

    let duplicateOf: string | null = null;

    if (kind === 'clients') {
      const identifier = values.nric || values.business_reg;
      if (!identifier) {
        problems.push({
          field: 'nric',
          message: 'No NRIC or business registration. The client will be created, but a later import cannot tell it apart from a namesake.',
          severity: 'warning',
        });
      } else {
        const existing = findClientByIdentification(orgId, identifier);
        if (existing) {
          duplicateOf = existing.name;
          problems.push({
            field: 'nric',
            message: `${existing.name} is already on file with this identifier.`,
            severity: 'error',
          });
        }
      }
      // An identifier that looks like a company overrides a blank or wrong type.
      if (values.business_reg && !values.nric) values.client_type = 'company';
      else if (values.nric) values.client_type = 'individual';
    }

    if (kind === 'policies') {
      if (values.policy_no) {
        const existing = findPolicyByNumber(orgId, values.policy_no);
        if (existing) {
          duplicateOf = existing.policy_no as string;
          problems.push({
            field: 'policy_no',
            message: `Policy ${values.policy_no} is already on the register.`,
            severity: 'error',
          });
        }
      }

      if (values.principal) {
        const match = findPrincipalByName(values.principal)
          ?? principals.find((p) => p.short_name.toUpperCase() === values.principal.toUpperCase());
        if (!match) {
          problems.push({
            field: 'principal',
            message: `No insurer matches “${values.principal}”. Add it under Setting → Global, or correct the spelling.`,
            severity: 'error',
          });
        } else {
          values.principal_id = match.id as string;
        }
      }

      // Cover that ends before it starts is a transposed pair of columns, and
      // it would quietly produce a policy that never renews.
      const from = values.effective_date;
      const to = values.expiry_date;
      if (from && to && to <= from) {
        problems.push({
          field: 'expiry_date',
          message: 'Expiry falls on or before the effective date — check the two columns are the right way round.',
          severity: 'error',
        });
      }

      // Premium that does not add up is worth flagging without refusing: the
      // agency may be importing figures it already reconciled elsewhere.
      const gross = readNumber(values.gross_premium) ?? 0;
      const tax = readNumber(values.service_tax) ?? 0;
      const stamp = readNumber(values.stamp_duty) ?? 0;
      const total = readNumber(values.total_premium) ?? 0;
      if (gross && total && Math.abs(gross + tax + stamp - total) > 0.05) {
        problems.push({
          field: 'total_premium',
          message: `Gross + tax + duty is ${(gross + tax + stamp).toFixed(2)}, not the ${total.toFixed(2)} given.`,
          severity: 'warning',
        });
      }

      // Match the insured to a client that already exists.
      const client = findClientByIdentity(orgId, values.insured_name || null, values.nric || null);
      if (client) values.client_id = client.id as string;
    }

    const ok = !problems.some((p) => p.severity === 'error');
    return { line, values, raw, problems, duplicateOf, ok };
  });

  // A ragged row is a stray comma; say so on the row rather than in a corner.
  for (const r of table.ragged) {
    const row = rows.find((x) => x.line === r.line);
    row?.problems.push({
      field: '',
      message: `This line has ${r.got} columns, not ${table.headers.length} — usually an unquoted comma.`,
      severity: 'warning',
    });
  }

  return {
    kind,
    headers: table.headers,
    mapping,
    unmatched,
    missingRequired: missingRequired.map((f) => f.label),
    rows,
    counts: {
      total: rows.length,
      ok: rows.filter((r) => r.ok).length,
      errors: rows.filter((r) => !r.ok).length,
      duplicates: rows.filter((r) => r.duplicateOf).length,
      warnings: rows.filter((r) => r.ok && r.problems.length).length,
    },
    ragged: table.ragged,
  };
}

/** Dates are already normalised by the field cleaners; this is for clarity. */
export { readDate, readNumber };
