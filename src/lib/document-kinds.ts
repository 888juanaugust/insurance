/*
 * Plain data, deliberately not in document-actions.ts.
 *
 * Every export of a `'use server'` module has to be an async function — Next.js
 * turns anything else into a server reference, so a constant exported from
 * there arrives on the client as an opaque stub and the first `.map` over it
 * throws. Typecheck and build both pass; it only fails when the page renders.
 */
export const DOCUMENT_KINDS = [
  { value: 'schedule', label: 'Policy schedule' },
  { value: 'cover_note', label: 'Cover note' },
  { value: 'receipt', label: 'Receipt' },
  { value: 'endorsement', label: 'Endorsement' },
  { value: 'correspondence', label: 'Correspondence' },
  { value: 'other', label: 'Other' },
] as const;

export const KIND_LABEL: Record<string, string> = Object.fromEntries(
  DOCUMENT_KINDS.map((k) => [k.value, k.label]),
);

export function isKind(value: string): boolean {
  return DOCUMENT_KINDS.some((k) => k.value === value);
}
