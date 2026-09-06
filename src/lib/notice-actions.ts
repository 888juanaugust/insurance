'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { authorise, forbid } from './guard';
import { audit } from './audit';
import { generateRenewalNotices, sendQueued } from './renewal-notices';
import {
  getMessage, markMessage, updateRenewalSetting, listRenewalSettingsFull,
} from './queries';
import { isChannel, unknownFields } from './messaging';

export type NoticeState = { ok?: boolean; error?: string; note?: string };

/** Build today's notices. Sends nothing. */
export async function generateNoticesAction(): Promise<void> {
  const guard = await authorise({ action: 'notice.generate', entity: 'message' });
  if (!guard.ok) forbid(guard.message);

  const result = generateRenewalNotices(guard.user.org_id);
  const noContact = result.skipped.filter((s) => s.because === 'no_contact').length;
  const declined = result.skipped.filter((s) => s.because === 'not_renewing').length;
  await audit(guard.user, {
    action: 'notice.generate', entity: 'message',
    summary:
      `Renewal notices built: ${result.queued} queued from ${result.considered} policies due`
      + (noContact ? `, ${noContact} skipped for want of a contact detail` : '')
      + (declined ? `, ${declined} left out because the client said they are not renewing` : '')
      + '.',
  });

  revalidatePath('/renewals/notices');
  redirect(`/renewals/notices?generated=${result.queued}&skipped=${noContact}&declined=${declined}`);
}

/** Try to deliver what is queued. */
export async function sendQueuedAction(): Promise<void> {
  const guard = await authorise({ action: 'notice.send', entity: 'message' });
  if (!guard.ok) forbid(guard.message);

  const result = await sendQueued(guard.user.org_id);
  await audit(guard.user, {
    action: 'notice.send', entity: 'message',
    summary:
      `Outbox run: ${result.sent} sent, ${result.waiting} waiting on a provider, ${result.failed} failed, `
      + `from ${result.attempted} queued.`,
  });

  revalidatePath('/renewals/notices');
  redirect(`/renewals/notices?sent=${result.sent}&waiting=${result.waiting}&failed=${result.failed}`);
}

/** An agent sent it themselves — the honest way to close a message off. */
export async function markSentByHandAction(fd: FormData): Promise<void> {
  const id = String(fd.get('message_id') ?? '');
  const guard = await authorise({ action: 'notice.mark_sent', entity: 'message', entityId: id });
  if (!guard.ok) forbid(guard.message);

  const m = getMessage(id, guard.user.org_id);
  if (!m) redirect('/renewals/notices');

  markMessage(id, guard.user.org_id, { status: 'sent', error: null, deliveredBy: 'by hand' });
  await audit(guard.user, {
    action: 'notice.mark_sent', entity: 'message', entityId: id,
    summary: `${guard.user.name} sent the ${m.kind.replace(/_/g, ' ')} to ${m.to_address} by hand.`,
  });
  revalidatePath('/renewals/notices');
  redirect('/renewals/notices');
}

export async function cancelMessageAction(fd: FormData): Promise<void> {
  const id = String(fd.get('message_id') ?? '');
  const guard = await authorise({ action: 'notice.cancel', entity: 'message', entityId: id });
  if (!guard.ok) forbid(guard.message);

  const m = getMessage(id, guard.user.org_id);
  if (!m) redirect('/renewals/notices');

  markMessage(id, guard.user.org_id, { status: 'cancelled', error: null, countAttempt: false });
  await audit(guard.user, {
    action: 'notice.cancel', entity: 'message', entityId: id,
    summary: `Notice to ${m.to_address} cancelled before it went out.`,
  });
  revalidatePath('/renewals/notices');
  redirect('/renewals/notices');
}

/* -------------------------------------------------------- the templates */

export async function saveReminderAction(_prev: unknown, fd: FormData): Promise<NoticeState> {
  const id = String(fd.get('setting_id') ?? '');
  const guard = await authorise({ action: 'reminder.update', entity: 'renewal_setting', entityId: id });
  if (!guard.ok) return { error: guard.message };
  const user = guard.user;

  const before = listRenewalSettingsFull(user.org_id).find((s) => s.id === id);
  if (!before) return { error: 'That reminder could not be found.' };

  const days = Number(String(fd.get('days_before') ?? ''));
  if (!Number.isInteger(days) || days < 0 || days > 180) {
    return { error: 'Send between 0 and 180 days before expiry.' };
  }
  const channel = String(fd.get('channel') ?? '');
  if (!isChannel(channel)) return { error: 'Choose WhatsApp, email or SMS.' };

  const template = String(fd.get('template') ?? '').trim();
  if (!template) return { error: 'The message cannot be empty.' };

  // A misspelled placeholder reaches the client verbatim, so it is caught here
  // rather than discovered in a customer's WhatsApp.
  const unknown = unknownFields(template + ' ' + String(fd.get('subject') ?? ''));
  if (unknown.length) {
    return {
      error: `${unknown.map((u) => `{${u}}`).join(', ')} ${unknown.length === 1 ? 'is not a field' : 'are not fields'} Insurhelp knows. It would be sent to the client exactly as written.`,
    };
  }

  updateRenewalSetting(id, user.org_id, {
    days_before: days,
    channel,
    name: String(fd.get('name') ?? '').trim(),
    subject: String(fd.get('subject') ?? '').trim(),
    template,
    enabled: fd.get('enabled') ? 1 : 0,
  });

  await audit(user, {
    action: 'reminder.update', entity: 'renewal_setting', entityId: id,
    summary: `Renewal reminder at ${days} days (${channel}) updated.`,
    changes: {
      days_before: [before.days_before, days],
      channel: [before.channel, channel],
      enabled: [before.enabled, fd.get('enabled') ? 1 : 0],
    },
  });

  revalidatePath('/settings/renewal');
  return { ok: true, note: 'Saved.' };
}
