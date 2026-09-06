import { getDocumentProxy } from 'unpdf';

export type PdfDoc = {
  pageCount: number;
  /** Text of each page, reconstructed into visual lines. */
  pages: string[][];
  /** Every line across the document, in reading order. */
  lines: string[];
  /** All lines joined with newlines. */
  text: string;
};

/**
 * Policy schedules are label/value layouts — a flat text dump loses which value
 * belongs to which label. Group text items by their y position so each visual
 * row comes back as one line, which is what the field matchers key off.
 */
/**
 * Nothing downstream reads past the opening pages — a schedule is the first
 * few, the rest is policy wording — and a 2 MB file can declare tens of
 * thousands of pages. Parsing is synchronous CPU on the one process every
 * other user is waiting on, so the reader stops here.
 */
export const MAX_PAGES = 40;

export async function readPdf(data: Uint8Array): Promise<PdfDoc> {
  // pdf.js transfers the buffer it is handed, detaching it for the caller.
  // The upload path reads the same bytes again to send the document onward,
  // so give pdf.js a copy and leave the caller's buffer intact.
  const pdf = await getDocumentProxy(new Uint8Array(data));
  const pages: string[][] = [];

  for (let n = 1; n <= Math.min(pdf.numPages, MAX_PAGES); n++) {
    const page = await pdf.getPage(n);
    const content = await page.getTextContent();

    const rows = new Map<number, { x: number; s: string }[]>();
    for (const item of content.items as Array<{ str?: string; transform?: number[] }>) {
      if (!item.str || !item.str.trim() || !item.transform) continue;
      // Round y to a 3pt band so items on the same visual row group together.
      const y = Math.round(item.transform[5] / 3) * 3;
      const bucket = rows.get(y);
      if (bucket) bucket.push({ x: item.transform[4], s: item.str });
      else rows.set(y, [{ x: item.transform[4], s: item.str }]);
    }

    const lines = [...rows.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([, items]) =>
        items
          .sort((a, b) => a.x - b.x)
          .map((i) => i.s)
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim(),
      )
      .filter(Boolean);

    pages.push(lines);
  }

  const all = pages.flat();
  return { pageCount: pdf.numPages, pages, lines: all, text: all.join('\n') };
}
