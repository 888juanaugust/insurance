/**
 * A calendar date, as the application writes them: yyyy-mm-dd, and a day
 * that exists. 2026-02-31 is shaped like a date and is not one; a form can
 * post it, and a check that only looks at the shape would store it.
 */
export function isCalendarDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}
