import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/session';
import { runSearch } from '@/lib/search-run';

export const dynamic = 'force-dynamic';

/** Type-ahead for the rail. Scoped to the signed-in organisation. */
export async function GET(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ hits: [] }, { status: 401 });

  const q = new URL(request.url).searchParams.get('q') ?? '';
  if (q.trim().length < 2) return NextResponse.json({ hits: [], total: 0 });

  const { hits, total } = runSearch(user.org_id, q, 8);
  return NextResponse.json(
    { hits, total },
    // Somebody's client list; never cached beyond this response.
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}
