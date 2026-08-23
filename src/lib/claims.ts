/**
 * Claim vocabulary, in a plain module so both server actions and client
 * components can read it. (A `'use server'` module may only export async
 * functions — anything else reaches the client as an opaque stub.)
 */

export const CLAIM_TYPES = [
  { value: 'own_damage', label: 'Own damage' },
  { value: 'third_party', label: 'Third party' },
  { value: 'theft', label: 'Theft' },
  { value: 'windscreen', label: 'Windscreen' },
  { value: 'flood', label: 'Flood / special perils' },
  { value: 'act_of_god', label: 'Act of God' },
  { value: 'other', label: 'Other' },
] as const;

/**
 * The order a claim actually moves through. `settled`, `rejected` and
 * `withdrawn` are ends; everything before them is live work.
 */
export const CLAIM_STATUSES = [
  { value: 'notified', label: 'Notified', hint: 'The insured has told us' },
  { value: 'documents', label: 'Documents pending', hint: 'Waiting on the police report or forms' },
  { value: 'submitted', label: 'Submitted to insurer', hint: 'Lodged, awaiting acknowledgement' },
  { value: 'surveyed', label: 'Surveyed', hint: 'Adjuster has inspected' },
  { value: 'approved', label: 'Approved', hint: 'Insurer has agreed the amount' },
  { value: 'repairing', label: 'Under repair', hint: 'With the workshop' },
  { value: 'settled', label: 'Settled', hint: 'Paid and closed' },
  { value: 'rejected', label: 'Rejected', hint: 'Declined by the insurer' },
  { value: 'withdrawn', label: 'Withdrawn', hint: 'The insured chose not to claim' },
] as const;

export const CLOSED_STATUSES = ['settled', 'rejected', 'withdrawn'] as const;

export const FAULT = [
  { value: '', label: 'Not established' },
  { value: 'own', label: 'Our insured at fault' },
  { value: 'third_party', label: 'Third party at fault' },
  { value: 'shared', label: 'Shared' },
  { value: 'undetermined', label: 'Undetermined' },
] as const;

export const TYPE_LABEL: Record<string, string> = Object.fromEntries(
  CLAIM_TYPES.map((t) => [t.value, t.label]),
);
export const STATUS_LABEL: Record<string, string> = Object.fromEntries(
  CLAIM_STATUSES.map((s) => [s.value, s.label]),
);
export const FAULT_LABEL: Record<string, string> = Object.fromEntries(
  FAULT.filter((f) => f.value).map((f) => [f.value, f.label]),
);

export function isClosed(status: string): boolean {
  return (CLOSED_STATUSES as readonly string[]).includes(status);
}

export function isClaimType(value: string): boolean {
  return CLAIM_TYPES.some((t) => t.value === value);
}

export function isClaimStatus(value: string): boolean {
  return CLAIM_STATUSES.some((s) => s.value === value);
}

/**
 * Whether a claim of this kind costs the insured their no-claim discount.
 *
 * A windscreen claim made under the windscreen extension does not — that is
 * the whole point of paying for the extension. Neither does a claim where the
 * third party was at fault and their insurer pays, because nothing is claimed
 * off our policy. Everything else resets the NCD to zero at renewal, which on
 * a 55% discount is the most expensive consequence of the whole claim, so it
 * is worth getting right rather than defaulting to yes.
 */
export function ncdDefaultFor(type: string, fault: string): boolean {
  if (type === 'windscreen') return false;
  if (fault === 'third_party') return false;
  return true;
}
