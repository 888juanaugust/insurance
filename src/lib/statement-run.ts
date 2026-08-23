/**
 * A saved statement, set against the book as it stands now.
 *
 * The import decides the matches; this is what the agency sees every time it
 * opens one afterwards, including after somebody has moved a line by hand. The
 * per-case comparison itself is `groupOutcomes`, shared with the preview, so
 * the screen can never show a variance the import did not.
 */

import {
  bookForStatement, statementLines, getStatement, listStatements,
  type BookPolicyRow,
} from './queries';
import { groupOutcomes, TOLERANCE, type PolicyOutcome } from './statements';

export type ResolvedLine = ReturnType<typeof statementLines>[number] & {
  /** The case-level outcome this line belongs to, if it is matched. */
  outcome: PolicyOutcome | null;
};

export type StatementView = {
  statement: NonNullable<ReturnType<typeof getStatement>>;
  lines: ResolvedLine[];
  outcomes: PolicyOutcome[];
  short: PolicyOutcome[];
  over: PolicyOutcome[];
  agreed: PolicyOutcome[];
  /** Lines with no case behind them, still waiting on somebody's decision. */
  unmatched: ResolvedLine[];
  /** …and the ones an agent has looked at and written off. */
  accepted: ResolvedLine[];
  missing: BookPolicyRow[];
  totals: {
    paid: number;
    expected: number;
    shortfall: number;
    overpaid: number;
    unmatchedValue: number;
    missingValue: number;
    /** What is left to chase, once the accepted lines are set aside. */
    outstanding: number;
  };
  /** Nothing left for anyone to decide. */
  clean: boolean;
};

export function statementView(id: string, orgId: string): StatementView | null {
  const statement = getStatement(id, orgId);
  if (!statement) return null;

  const rows = statementLines(id, orgId);
  const book = bookForStatement(orgId, statement.principal_id, statement.period_start, statement.period_end);

  /*
   * A line can point at a policy written outside the statement's period — an
   * agent assigns one by hand, or the insurer pays late — so the lookup cannot
   * be limited to the book. The join on the line already carries what is
   * needed, and the expected figure comes off the policy itself.
   */
  const expected = new Map<string, { policy_no: string; insured: string; commission_amt: number }>();
  for (const p of book) {
    expected.set(p.id, { policy_no: p.policy_no, insured: p.insured, commission_amt: p.commission_amt });
  }
  for (const l of rows) {
    if (l.policy_id && !expected.has(l.policy_id)) {
      expected.set(l.policy_id, {
        policy_no: l.book_policy_no ?? l.policy_no ?? '',
        insured: l.book_insured ?? l.insured ?? '',
        commission_amt: l.book_commission_amt ?? 0,
      });
    }
  }

  const outcomes = groupOutcomes(
    rows.map((l) => ({ line: l.row_no, policy_id: l.policy_id, commission: l.commission })),
    (pid) => expected.get(pid),
  );
  const outcomeByPolicy = new Map(outcomes.map((o) => [o.policy_id, o]));

  const lines: ResolvedLine[] = rows.map((l) => ({
    ...l,
    outcome: l.policy_id ? outcomeByPolicy.get(l.policy_id) ?? null : null,
  }));

  const reached = new Set(outcomes.map((o) => o.policy_id));
  const missing = book.filter((p) => !reached.has(p.id) && Math.abs(p.commission_amt) > TOLERANCE);

  const unresolved = lines.filter((l) => !l.policy_id && l.accepted === 0);
  const accepted = lines.filter((l) => !l.policy_id && l.accepted === 1);

  const short = outcomes.filter((o) => o.state === 'short');
  const over = outcomes.filter((o) => o.state === 'over');
  const agreed = outcomes.filter((o) => o.state === 'agreed');

  const shortfall = round2(short.reduce((s, o) => s + o.variance, 0));
  const overpaid = round2(over.reduce((s, o) => s + o.variance, 0));
  const unmatchedValue = round2(unresolved.reduce((s, l) => s + l.commission, 0));
  const missingValue = round2(missing.reduce((s, p) => s + p.commission_amt, 0));

  return {
    statement,
    lines,
    outcomes,
    short,
    over,
    agreed,
    unmatched: unresolved,
    accepted,
    missing,
    totals: {
      paid: round2(lines.reduce((s, l) => s + l.commission, 0)),
      expected: round2(outcomes.reduce((s, o) => s + o.expected, 0)),
      shortfall,
      overpaid,
      unmatchedValue,
      missingValue,
      // Short payments and cases left off the statement are both money the
      // insurer has not handed over. Overpayments are not netted against them:
      // an insurer that overpaid one case will take that back on its own, and
      // netting hides the shortfall that has to be chased this week.
      outstanding: round2(Math.abs(shortfall) + missingValue),
    },
    clean: short.length === 0 && unresolved.length === 0 && missing.length === 0,
  };
}

/** The line every statement in the list carries. */
export function statementSummaries(orgId: string) {
  return listStatements(orgId).map((s) => ({
    ...s,
    gap: round2(s.total_paid - s.total_expected),
  }));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
