import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { listOrgs } from '@/lib/queries';
import { generateRenewalNotices, sendQueued } from '@/lib/renewal-notices';
import { audit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

/**
 * The daily run, for cron:
 *   0 9 * * *  curl -fsS -H "authorization: Bearer $IH_CRON_SECRET" \
 *                https://…/api/cron/renewal-notices
 *
 * It has no session, so it is guarded by its own secret. Without IH_CRON_SECRET
 * set the route refuses outright rather than running unauthenticated — an open
 * endpoint that messages clients is not something to leave to a default.
 */
export async function POST(request: Request) {
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

  const runs: Array<Record<string, unknown>> = [];
  for (const org of listOrgs()) {
    const built = generateRenewalNotices(org.id);
    const sent = await sendQueued(org.id);
    runs.push({ org: org.name, ...built, ...sent });

    await audit(
      { id: '', org_id: org.id, name: 'Scheduled run', role: 'system' },
      {
        action: 'notice.cron', entity: 'message',
        summary:
          `Scheduled renewal run: ${built.queued} notices built, ${sent.sent} sent, `
          + `${sent.waiting} waiting on a provider, ${sent.failed} failed.`,
      },
    );
  }

  return NextResponse.json({ ok: true, runs }, { headers: { 'Cache-Control': 'no-store' } });
}

/** GET says whether it is wired up, without doing anything. */
export async function GET() {
  const configured = Boolean(process.env.IH_CRON_SECRET && process.env.IH_CRON_SECRET.length >= 16);
  return NextResponse.json(
    { configured, hint: configured ? 'POST with the bearer token to run.' : 'Set IH_CRON_SECRET to enable.' },
    { status: configured ? 200 : 503 },
  );
}
