import { NextResponse } from 'next/server';
import { currentPortalClient } from '@/lib/portal-session';
import { portalDocument } from '@/lib/queries';
import { readDocument } from '@/lib/files';

export const dynamic = 'force-dynamic';

/**
 * Serves a document to the client it belongs to.
 *
 * The lookup joins through the policy to this client and restricts the kind,
 * so a document id from another client — or an internal one like an adjuster's
 * report — is not found rather than refused. Nothing is decided by the id alone.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const client = await currentPortalClient();
  if (!client) return new NextResponse('Sign in first.', { status: 401 });

  const { id } = await params;
  const row = portalDocument(id, client.id);
  if (!row) return new NextResponse('Not found.', { status: 404 });

  const bytes = readDocument(row.storage_key);
  if (!bytes) return new NextResponse('That file is recorded but missing from storage.', { status: 410 });

  const disposition = new URL(request.url).searchParams.has('download') ? 'attachment' : 'inline';
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      'Content-Type': row.content_type ?? 'application/octet-stream',
      'Content-Disposition': `${disposition}; filename="${row.filename.replace(/["\r\n]/g, '')}"`,
      'Content-Length': String(bytes.length),
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
