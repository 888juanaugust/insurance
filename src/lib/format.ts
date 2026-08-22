export const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/** RM 1,234.56 */
export function money(n: number | null | undefined, prefix = 'RM '): string {
  const v = Number(n ?? 0);
  return prefix + v.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** 1,234.56 — no currency prefix */
export function num(n: number | null | undefined, dp = 2): string {
  return Number(n ?? 0).toLocaleString('en-MY', { minimumFractionDigits: dp, maximumFractionDigits: dp });
}

/** 2026-08-22 -> 22 Aug 2026 */
export function longDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-');
  if (!y || !m || !d) return iso;
  return `${Number(d)} ${MONTHS[Number(m) - 1]} ${y}`;
}

/** 2026-08-22 -> 22/08/2026 */
export function shortDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

/** Server "today" as an ISO date string; overridable so the demo data stays put. */
export function today(): string {
  return process.env.SIMSUITE_TODAY ?? new Date().toISOString().slice(0, 10);
}

export function classLabel(cls: string): string {
  return cls === 'motor' ? 'Motor' : 'Non-motor';
}

export function titleCase(s: string): string {
  return s.replace(/(^|[\s_-])(\w)/g, (_, p, c) => (p === '_' || p === '-' ? ' ' : p) + c.toUpperCase());
}
