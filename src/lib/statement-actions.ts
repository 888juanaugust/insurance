'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { authorise } from './guard';
import { audit } from './audit';
import { money } from './format';
import { readStatement, reconcile, type Reconciliation, type StatementRow } from './statements';
import { statementView } from './statement-run';
import {
  bookForStatement, saveStatement, findStatement, listPrincipals,
  assignStatementLine, acceptStatementLine, getStatementLine, getStatement,
  setStatementStatus, deleteStatement, recomputeStatementTotals,
} from './queries';

const MAX_BYTES = 5 * 1024 * 1024;
/** A month's statement from a large insurer, with room to spare. */
const MAX_LINES = 5000;
const ISO = /^\d{4}-\d{2}-\d{2}$/;

export type StatementPreview = {
  principal_id: string;
  principal: string;
  reference: string;
  period_start: string;
  period_end: string;
  statement_date: string;
  note: string;
  filename: string;
  unrecognised: string[];
  ragged: Array<{ line: number; got: number }>;
  rows: StatementRow[];
  result: Reconciliation;
};

export type StatementHeader = {
  principal_id: string;
  reference: string;
  period_start: string;
  period_end: string;
  statement_date: string;
  note: string;
};

export type StatementState = {
  ok?: boolean;
  error?: string;
  /** What was read, so the form can be shown again with the values in it. */
  form?: StatementHeader;
  preview?: StatementPreview;
  /** The file, carried through so committing needs no second upload. */
  text?: string;
};

function formValues(fd: FormData): StatementHeader {
  return {
    principal_id: String(fd.get('principal_id') ?? ''),
    reference: String(fd.get('reference') ?? '').trim(),
    period_start: String(fd.get('period_start') ?? '').trim(),
    period_end: String(fd.get('period_end') ?? '').trim(),
    statement_date: String(fd.get('statement_date') ?? '').trim(),
    note: String(fd.get('note') ?? '').trim(),
  };
}

/**
 * Everything the header needs before the file is worth reading. The period
 * decides which cases the statement is answerable for, so a wrong one reports
 * half the book as unpaid — it is checked, not defaulted.
 */
function validateHeader(form: StatementHeader): string | null {
  if (!form.principal_id) return 'Choose the insurer this statement came from.';
  if (!form.reference) return 'Give the statement a reference — the number the insurer put on it.';
  if (!ISO.test(form.period_start) || !ISO.test(form.period_end)) {
    return 'Set the period the statement covers.';
  }
  if (form.period_end < form.period_start) return 'The period ends before it starts.';
  if (form.statement_date && !ISO.test(form.statement_date)) return 'The statement date is not a date.';
  return null;
}

/** Read the file and show what it would say. Writes nothing. */
export async function previewStatementAction(_prev: unknown, fd: FormData): Promise<StatementState> {
  const guard = await authorise({ action: 'statement.preview', entity: 'statement' });
  if (!guard.ok) return { error: guard.message };
  const user = guard.user;

  const form = formValues(fd);
  const headerError = validateHeader(form);
  if (headerError) return { error: headerError, form };

  const file = fd.get('file');
  if (!(file instanceof File) || file.size === 0) return { error: 'Choose the statement file.', form };
  if (file.size > MAX_BYTES) {
    return { error: `That file is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is 5 MB.`, form };
  }
  if (!/\.csv$/i.test(file.name) && file.type !== 'text/csv') {
    return {
      error: 'Reconciliation takes a CSV. Insurer portals offer one; from a PDF statement, save the table as CSV first.',
      form,
    };
  }

  const duplicate = findStatement(user.org_id, form.principal_id, form.reference);
  if (duplicate) {
    return {
      error: `Statement ${duplicate.reference} from this insurer is already in. Importing it twice would double every figure on it — open the one on file, or use a different reference.`,
      form,
    };
  }

  const text = await file.text();
  const reading = readStatement(text);
  if (reading.fatal) return { error: reading.fatal, form };
  if (reading.rows.length > MAX_LINES) {
    return { error: `That file has ${reading.rows.length} lines. The limit is ${MAX_LINES}.`, form };
  }

  const book = bookForStatement(user.org_id, form.principal_id, form.period_start, form.period_end);
  const result = reconcile(reading.rows, book);
  const principal = listPrincipals().find((p) => p.id === form.principal_id);

  await audit(user, {
    action: 'statement.preview',
    entity: 'statement',
    entityLabel: form.reference,
    summary:
      `${file.name} read against ${principal?.short_name ?? 'the insurer'} for ${form.period_start} to ${form.period_end} — ` +
      `${reading.rows.length} lines, ${result.outcomes.length} matched, ${result.unmatched.length} unmatched, ` +
      `${result.missing.length} case${result.missing.length === 1 ? '' : 's'} left off. Nothing written.`,
  });

  return {
    ok: true,
    text,
    form,
    preview: {
      ...form,
      principal: principal?.short_name ?? '',
      filename: file.name,
      unrecognised: reading.unrecognised,
      ragged: reading.ragged,
      rows: reading.rows,
      result,
    },
  };
}

/** Store the statement, its lines, and the matches the preview showed. */
export async function commitStatementAction(_prev: unknown, fd: FormData): Promise<StatementState> {
  const guard = await authorise({ action: 'statement.import', entity: 'statement' });
  if (!guard.ok) return { error: guard.message };
  const user = guard.user;

  const form = formValues(fd);
  const headerError = validateHeader(form);
  if (headerError) return { error: headerError, form };

  const text = String(fd.get('text') ?? '');
  if (!text) return { error: 'The uploaded file was lost. Upload it again.', form };

  const duplicate = findStatement(user.org_id, form.principal_id, form.reference);
  if (duplicate) {
    return { error: `Statement ${duplicate.reference} from this insurer is already in.`, form };
  }

  // Re-read and re-matched rather than trusting the preview: a policy may have
  // been added or corrected in between, and the stored matches have to be the
  // ones the book supports now.
  const reading = readStatement(text);
  if (reading.fatal) return { error: reading.fatal, form };

  const book = bookForStatement(user.org_id, form.principal_id, form.period_start, form.period_end);
  const result = reconcile(reading.rows, book);

  const id = saveStatement(
    user.org_id,
    {
      principal_id: form.principal_id,
      reference: form.reference,
      period_start: form.period_start,
      period_end: form.period_end,
      statement_date: form.statement_date || null,
      filename: String(fd.get('filename') ?? '') || null,
      note: form.note || null,
      total_paid: result.totals.paid,
      total_expected: result.totals.expected,
      imported_by: user.name,
    },
    result.lines.map((l) => ({
      row_no: l.line,
      policy_no: l.policy_no || null,
      cover_note_no: l.cover_note_no || null,
      insured: l.insured || null,
      vehicle_no: l.vehicle_no || null,
      effective_date: l.effective_date || null,
      gross_premium: l.gross_premium,
      commission_rate: l.commission_rate,
      commission: l.commission ?? 0,
      reference: l.reference || null,
      policy_id: l.policy_id,
      basis: l.basis,
      decided: 0,
      accepted: 0,
      accepted_note: null,
    })),
  );

  const principal = listPrincipals().find((p) => p.id === form.principal_id);
  await audit(user, {
    action: 'statement.import',
    entity: 'statement',
    entityId: id,
    entityLabel: form.reference,
    summary:
      `Statement ${form.reference} from ${principal?.short_name ?? 'the insurer'} imported — ` +
      `${result.lines.length} lines worth ${money(result.totals.paid)} against ${money(result.totals.expected)} on the book. ` +
      `${result.outcomes.filter((o) => o.state === 'short').length} short paid, ` +
      `${result.unmatched.length} unmatched, ${result.missing.length} left off.`,
  });

  revalidatePath('/accounting/statements');
  revalidatePath('/accounting');
  redirect(`/accounting/statements/${id}`);
}

export type LineState = { ok?: boolean; error?: string; message?: string };

/** Point an unmatched line at a case, or record that it is not the agency's. */
export async function assignLineAction(_prev: unknown, fd: FormData): Promise<LineState> {
  const guard = await authorise({ action: 'statement.assign', entity: 'statement_line' });
  if (!guard.ok) return { error: guard.message };
  const user = guard.user;

  const lineId = String(fd.get('line_id') ?? '');
  const statementId = String(fd.get('statement_id') ?? '');
  const policyId = String(fd.get('policy_id') ?? '');

  const line = getStatementLine(lineId, user.org_id);
  if (!line) return { error: 'That line is not on any statement of yours.' };

  const target = policyId === '__none__' ? null : policyId;
  if (policyId === '') return { error: 'Choose the policy this line belongs to, or mark it as not yours.' };

  if (!assignStatementLine(lineId, user.org_id, target)) {
    return { error: 'That policy is not on your register, so the line was left as it was.' };
  }
  recomputeStatementTotals(statementId, user.org_id);

  await audit(user, {
    action: 'statement.assign',
    entity: 'statement_line',
    entityId: lineId,
    entityLabel: line.policy_no ?? `line ${line.row_no}`,
    summary: target
      ? `Statement line ${line.row_no} (${money(line.commission)}) assigned to a policy by hand.`
      : `Statement line ${line.row_no} (${money(line.commission)}) marked as not this agency's business.`,
  });

  revalidatePath(`/accounting/statements/${statementId}`);
  revalidatePath('/accounting/statements');
  return { ok: true, message: target ? 'Line assigned.' : 'Line set aside.' };
}

/** Write off a difference the agency has looked at and accepted. */
export async function acceptLineAction(_prev: unknown, fd: FormData): Promise<LineState> {
  const guard = await authorise({ action: 'statement.accept', entity: 'statement_line' });
  if (!guard.ok) return { error: guard.message };
  const user = guard.user;

  const lineId = String(fd.get('line_id') ?? '');
  const statementId = String(fd.get('statement_id') ?? '');
  const note = String(fd.get('note') ?? '').trim();
  const undo = String(fd.get('undo') ?? '') === '1';

  const line = getStatementLine(lineId, user.org_id);
  if (!line) return { error: 'That line is not on any statement of yours.' };

  if (!undo && !note) {
    // Without a reason the write-off is untraceable a month later, which is
    // exactly when somebody asks why the statement was signed off short.
    return { error: 'Say why it is being accepted. A written-off difference with no reason cannot be answered for later.' };
  }

  if (!acceptStatementLine(lineId, user.org_id, note, !undo)) {
    return { error: 'The line could not be updated.' };
  }

  await audit(user, {
    action: undo ? 'statement.accept_undo' : 'statement.accept',
    entity: 'statement_line',
    entityId: lineId,
    entityLabel: line.policy_no ?? `line ${line.row_no}`,
    summary: undo
      ? `Acceptance of statement line ${line.row_no} (${money(line.commission)}) withdrawn.`
      : `Statement line ${line.row_no} (${money(line.commission)}) accepted as it stands — ${note}`,
  });

  revalidatePath(`/accounting/statements/${statementId}`);
  return { ok: true, message: undo ? 'Acceptance withdrawn.' : 'Difference accepted.' };
}

/** Close a statement off, or reopen one that was closed too early. */
export async function settleStatementAction(fd: FormData): Promise<void> {
  const guard = await authorise({ action: 'statement.settle', entity: 'statement' });
  if (!guard.ok) return;
  const user = guard.user;

  const id = String(fd.get('id') ?? '');
  const to = String(fd.get('to') ?? '') === 'open' ? 'open' : 'settled';
  const statement = getStatement(id, user.org_id);
  if (!statement) return;

  /*
   * Closing checks. A statement RM 5,000 short with a dozen unplaced lines
   * used to close as happily as a clean one, and once closed nobody looked
   * again. Short is still allowed — an agency can decide a difference is not
   * worth chasing — but only when the form says so, and the trail says it did.
   */
  let shortNote = '';
  if (to === 'settled') {
    const view = statementView(id, user.org_id);
    if (view && !view.clean) {
      if (String(fd.get('acknowledge') ?? '') !== '1') {
        await audit(user, {
          action: 'statement.settle', entity: 'statement', entityId: id, entityLabel: statement.reference,
          outcome: 'denied',
          summary: `Statement ${statement.reference} not closed: ${money(view.totals.outstanding)} unaccounted for and the shortfall was not acknowledged.`,
        });
        redirect(`/accounting/statements/${id}?blocked=1`);
      }
      shortNote =
        ` with ${money(view.totals.outstanding)} unaccounted for` +
        ` (${view.short.length} short-paid, ${view.unmatched.length} unplaced, ${view.missing.length} left off) — closed short by ${user.name}`;
    }
  }

  if (setStatementStatus(id, user.org_id, to)) {
    await audit(user, {
      action: 'statement.settle',
      entity: 'statement',
      entityId: id,
      entityLabel: statement.reference,
      summary:
        to === 'settled'
          ? `Statement ${statement.reference} closed off at ${money(statement.total_paid)}${shortNote}.`
          : `Statement ${statement.reference} reopened.`,
    });
  }

  revalidatePath(`/accounting/statements/${id}`);
  revalidatePath('/accounting/statements');
}

/** Remove a statement imported by mistake — the wrong file, the wrong period. */
export async function deleteStatementAction(fd: FormData): Promise<void> {
  const guard = await authorise({ action: 'statement.delete', entity: 'statement' });
  if (!guard.ok) return;
  const user = guard.user;

  const id = String(fd.get('id') ?? '');
  const statement = getStatement(id, user.org_id);
  if (!statement) return;

  if (deleteStatement(id, user.org_id)) {
    await audit(user, {
      action: 'statement.delete',
      entity: 'statement',
      entityId: id,
      entityLabel: statement.reference,
      summary:
        `Statement ${statement.reference} from ${statement.principal} deleted — ` +
        `${statement.line_count} lines worth ${money(statement.total_paid)}, imported by ${statement.imported_by ?? 'unknown'}.`,
    });
  }

  revalidatePath('/accounting/statements');
  redirect('/accounting/statements');
}
