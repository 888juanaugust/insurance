/**
 * The outcomes a renewal call can have.
 *
 * Its own module because the form that offers them runs in the browser, and
 * anything it imports comes with it. Living in queries.ts these constants
 * dragged better-sqlite3, node:fs and node:crypto into the client bundle and
 * the build stopped dead — the same trap as a constant exported from a
 * 'use server' file, arriving from the other direction.
 */
export const FOLLOW_UP_OUTCOMES = [
  { value: 'reached', label: 'Spoke to them', note: 'Contact made — say what was agreed.' },
  { value: 'no_answer', label: 'No answer', note: 'Tried, nobody picked up.' },
  { value: 'quoted', label: 'Quote sent', note: 'A renewal quote has gone out.' },
  { value: 'callback', label: 'Call back later', note: 'They asked for a specific day.' },
  { value: 'not_renewing', label: 'Not renewing', note: 'Sold the vehicle, went elsewhere, no longer needs it.' },
] as const;

/**
 * The one outcome the dropdown never offers. "Call back later" and "Not
 * renewing" take a case off the chase list, and a case taken off by mistake
 * needs a way back on; recording that as a line of its own keeps the history
 * honest — it says the case was put back, not that anyone spoke to the client.
 */
export const RESUME_OUTCOME = 'back_on_list';

export type FollowUpOutcome = (typeof FOLLOW_UP_OUTCOMES)[number]['value'] | typeof RESUME_OUTCOME;

export function isFollowUpOutcome(v: string): v is FollowUpOutcome {
  return v === RESUME_OUTCOME || FOLLOW_UP_OUTCOMES.some((o) => o.value === v);
}

export const OUTCOME_LABEL: Record<string, string> = {
  ...Object.fromEntries(FOLLOW_UP_OUTCOMES.map((o) => [o.value, o.label])),
  [RESUME_OUTCOME]: 'Back on the list',
};
