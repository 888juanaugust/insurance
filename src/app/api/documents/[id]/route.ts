import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/session';
import { getDocument } from '@/lib/queries';
import { readDocument } from '@/lib/files';

export const dynamic = 'force-dynamic';

/**
 * Serves a stored document.
 *
 * The row is fetched with the signed-in organisation as part of the lookup, so
 * a document id from another agency is simply not found — the file is never
 * reached by id alone. Guessing an id gets a 404, not someone else's policy
 * schedule.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await currentUser();
  if (!user) return new NextResponse('Sign in first.', { status: 401 });

  const { id } = await params;
  const row = getDocument(id, user.org_id);
  if (!row || !row.storage_key) return new NextResponse('Not found.', { status: 404 });

  const bytes = readDocument(row.storage_key);
  if (!bytes) {
    // The row survived but the file did not — say so plainly rather than
    // serving an empty document that looks like a corrupt PDF.
    return new NextResponse('That file is recorded but missing from storage.', { status: 410 });
  }

  // `inline` so a PDF opens in the viewer; `download` on the query string
  // forces the save dialog for someone who wants the file itself.
  const url = new URL(request.url);
  const disposition = url.searchParams.has('download') ? 'attachment' : 'inline';

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      'Content-Type': row.content_type ?? 'application/octet-stream',
      // The filename is quoted and stripped of quotes and newlines: it came
      // from a browser upload and would otherwise be able to forge headers.
      'Content-Disposition': `${disposition}; filename="${row.filename.replace(/["\r\n]/g, '')}"`,
      'Content-Length': String(bytes.length),
      // A policy document is somebody's personal data — no shared caching.
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
