import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/session';
import { listMessages, messageCounts } from '@/lib/queries';
import { generateNoticesAction, sendQueuedAction } from '@/lib/notice-actions';
import { configuredChannels, CHANNEL_LABEL, type Channel } from '@/lib/messaging';
import { Crumb, PageHeader, Help } from '@/components/ui';
import FilterSelect from '@/components/FilterSelect';
import OutboxRow from '@/components/OutboxRow';

export const dynamic = 'force-dynamic';

export default async function NoticesPage({
  searchParams,
}: {
  searchParams: Promise<{ [k: string]: string | string[] | undefined }>;
}) {
  const user = await currentUser();
  if (!user) redirect('/login');

  const sp = await searchParams;
  const str = (k: string) => (typeof sp[k] === 'string' ? (sp[k] as string) : '');

  const messages = listMessages(user.org_id, {
    status: str('status'), channel: str('channel'), search: str('q'),
  });
  const counts = messageCounts(user.org_id);
  const configured = configuredChannels();
  const anyProvider = Object.values(configured).some(Boolean);

  return (
    <div className="space-y-4">
      <div className="panel px-6 py-6">
        <Crumb items={[{ href: '/insurance/renewals', label: 'Renewals' }, { label: 'Notices' }]} />
        <PageHeader
          title="Renewal notices"
          subtitle="What is going out to clients whose cover is running down, and what has already gone."
          meta={`${counts.queued} waiting · ${counts.sent} sent · ${counts.failed} failed`}
        />

        {(str('generated') || str('sent') || str('waiting') || str('failed')) && (
          <p role="status" className="mt-4 rounded border border-line bg-ok-wash px-4 py-3 text-[13px] text-ok">
            {str('generated') && <>{str('generated')} notice{str('generated') === '1' ? '' : 's'} built. </>}
            {str('skipped') && str('skipped') !== '0' && (
              <>{str('skipped')} polic{str('skipped') === '1' ? 'y' : 'ies'} skipped for want of a phone number or email. </>
            )}
            {str('declined') && str('declined') !== '0' && (
              <>{str('declined')} left out because the client said they are not renewing. </>
            )}
            {str('sent') && <>{str('sent')} sent. </>}
            {str('waiting') && str('waiting') !== '0' && (
              <>{str('waiting')} waiting for someone to send by hand. </>
            )}
            {str('failed') && str('failed') !== '0' && <>{str('failed')} failed. </>}
          </p>
        )}

        {!anyProvider && (
          <p className="mt-4 rounded border border-warn-line bg-warn-wash px-4 py-3 text-[12.5px] text-warn">
            No delivery provider is configured, so notices are prepared and left here for you to send.
            Open one, copy the text into WhatsApp, then mark it sent. To have Insurhelp send them,
            set <code>IH_WHATSAPP_URL</code> (or <code>IH_EMAIL_URL</code>, <code>IH_SMS_URL</code>) —
            see <Link href="/user-guide" className="underline">the guide</Link>.
          </p>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-2.5">
          <form action={generateNoticesAction}>
            <button type="submit" className="btn btn-primary">Build today’s notices</button>
          </form>
          <form action={sendQueuedAction}>
            <button type="submit" disabled={counts.queued === 0} className="btn btn-ghost disabled:opacity-50">
              Send what is queued
            </button>
          </form>
          <span className="text-[12px] text-muted">
            Building never sends. It only prepares what is due today.
          </span>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2.5">
          <form action="/renewals/notices" className="contents">
            <input type="search" name="q" defaultValue={str('q')} placeholder="Client, policy or vehicle"
              aria-label="Search notices" className="inp h-9 w-64 text-[13px]" />
            <button type="submit" className="btn btn-ghost h-9">Search</button>
          </form>
          <FilterSelect name="status" value={str('status')} label="Status" className="w-40"
            options={[
              { value: '', label: 'Any status' },
              { value: 'queued', label: 'Waiting' },
              { value: 'sent', label: 'Sent' },
              { value: 'failed', label: 'Failed' },
              { value: 'cancelled', label: 'Cancelled' },
            ]} />
          <FilterSelect name="channel" value={str('channel')} label="Channel" className="w-40"
            options={[
              { value: '', label: 'Any channel' },
              ...(['whatsapp', 'email', 'sms'] as Channel[]).map((c) => ({
                value: c,
                label: `${CHANNEL_LABEL[c]}${configured[c] ? '' : ' (manual)'}`,
              })),
            ]} />
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          Outbox
          <Help text="A notice stays queued until it is actually delivered. Nothing is marked sent on a promise that was not kept." />
        </div>
        {messages.length ? (
          <ul className="divide-y divide-line">
            {messages.map((m) => (
              <OutboxRow
                key={m.id}
                m={{
                  id: m.id, channel: m.channel, to_address: m.to_address, subject: m.subject,
                  body: m.body, status: m.status, error: m.error, delivered_by: m.delivered_by,
                  scheduled_for: m.scheduled_for, sent_at: m.sent_at, attempts: m.attempts,
                  client_name: m.client_name, policy_no: m.policy_no, vehicle_no: m.vehicle_no,
                }}
              />
            ))}
          </ul>
        ) : (
          <p className="px-5 py-8 text-center text-[13px] text-muted">
            {str('status') || str('channel') || str('q')
              ? 'Nothing matches those filters.'
              : 'Nothing waiting. Build today’s notices to see what is due.'}
          </p>
        )}
      </div>
    </div>
  );
}
