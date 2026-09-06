import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { listOrgs, abandonedUploads, deleteDocumentRows } from '@/lib/queries';
import { deleteDocument } from '@/lib/files';
import { purgeExpiredSessions } from '@/lib/session-store';
import { generateRenewalNotices, sendQueued } from '@/lib/renewal-notices';
import { audit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

/**
 * The daily run, for cron — a POST:
 *   0 9 * * *  curl -fsS -X POST -H "authorization: Bearer $IH_CRON_SECRET" \
 *                https://…/api/cron/renewal-notices
 *
 * It has no session, so it is guarded by its own secret. Without IH_CRON_SECRET
 * set the route refuses outright rather than running unauthenticated — an open
 * endpoint that messages clients is not something to leave to a default.
 *
 * It is also where housekeeping runs: uploads read but never saved, per
 * agency, and sessions past their expiry. Neither belongs on a request path.
 */
function authorised(request: Request): NextResponse | null {
  const secret = process.env.IH_CRON_SECRET;
  if (!secret || secret.length < 16) {
    return NextResponse.json(
      { error: 'IH_CRON_SECRET is not set, or is shorter than 16 characters. The scheduled run is disabled.' },
      { status: 503 },
    );
  }
  const offered = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  const a = Buffer.from(offered);
  const b = Buffer.from(secret);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return NextResponse.json({ error: 'Not authorised.' }, { status: 401 });
  }
  return null;
}

export async function POST(request: Request) {
  const refused = authorised(request);
  if (refused) return refused;

  const runs: Array<Record<string, unknown>> = [];
  for (const org of listOrgs()) {
    const built = generateRenewalNotices(org.id);
    const sent = await sendQueued(org.id);

    // This agency's abandoned uploads, files and rows together.
    const stale = abandonedUploads(org.id, 7);
    if (stale.length) {
      deleteDocumentRows(stale.map((d) => d.id));
      for (const d of stale) deleteDocument(d.storage_key);
    }

    runs.push({ org: org.name, ...built, ...sent, swept: stale.length });

    await audit(
      { id: '', org_id: org.id, name: 'Scheduled run', role: 'system' },
      {
        action: 'notice.cron', entity: 'message',
        summary:
          `Scheduled renewal run: ${built.queued} notices built, ${sent.sent} sent, `
          + `${sent.waiting} waiting on a provider, ${sent.failed} failed`
          + (stale.length ? `; ${stale.length} abandoned upload${stale.length === 1 ? '' : 's'} removed` : '')
          + '.',
      },
    );
  }

  const sessions = purgeExpiredSessions();
  return NextResponse.json({ ok: true, runs, expiredSessionsRemoved: sessions }, { headers: { 'Cache-Control': 'no-store' } });
}

/**
 * GET answers only to the same bearer, and only that the route is wired up.
 * It used to tell anyone whether the secret was configured; that is nobody
 * else's business.
 */
export async function GET(request: Request) {
  const refused = authorised(request);
  if (refused) return refused;
  return NextResponse.json({ ok: true, hint: 'POST with the same bearer to run.' }, { headers: { 'Cache-Control': 'no-store' } });
}
