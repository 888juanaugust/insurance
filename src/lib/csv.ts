/**
 * A CSV reader for files agencies actually send.
 *
 * Splitting on commas fails on the first address field, which is why this
 * walks the text instead: quoted fields carry commas, newlines and doubled
 * quotes; Excel writes CRLF and a UTF-8 BOM; and a trailing newline must not
 * produce a phantom empty row.
 */

export type CsvTable = {
  headers: string[];
  rows: string[][];
  /** Rows whose column count differs from the header — usually a stray comma. */
  ragged: Array<{ line: number; got: number }>;
};

export function parseCsv(text: string): CsvTable {
  // Excel prefixes a BOM; left in place it becomes part of the first header
  // and every lookup for that column silently misses.
  const src = text.replace(/^﻿/, '');

  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  let started = false;   // this row has content, so it is a real row

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];

    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; }   // escaped quote
        else quoted = false;
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') { quoted = true; started = true; continue; }
    if (ch === ',') { row.push(field); field = ''; started = true; continue; }
    if (ch === '\r') continue;                            // CRLF
    if (ch === '\n') {
      row.push(field);
      if (started || row.some((c) => c !== '')) rows.push(row);
      row = []; field = ''; started = false;
      continue;
    }
    field += ch;
    if (ch.trim() !== '') started = true;
  }

  // Whatever is left when the text runs out.
  row.push(field);
  if (started || row.some((c) => c !== '')) rows.push(row);

  if (!rows.length) return { headers: [], rows: [], ragged: [] };

  const headers = rows[0].map((h) => h.trim());
  const body = rows.slice(1);
  const ragged: Array<{ line: number; got: number }> = [];

  const normalised = body.map((r, idx) => {
    if (r.length !== headers.length) ragged.push({ line: idx + 2, got: r.length });
    // Pad or trim so every row can be read by column index without checking.
    const out = r.slice(0, headers.length).map((c) => c.trim());
    while (out.length < headers.length) out.push('');
    return out;
  });

  return { headers, rows: normalised, ragged };
}

/** Turn a header into something comparable: letters and digits, lower case. */
export function normaliseHeader(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Quote only what needs it, so a corrections file opens cleanly in Excel and
 * still round-trips through this parser.
 */
export function toCsv(headers: string[], rows: string[][]): string {
  const cell = (v: string) =>
    /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  return [headers, ...rows].map((r) => r.map(cell).join(',')).join('\r\n');
}
