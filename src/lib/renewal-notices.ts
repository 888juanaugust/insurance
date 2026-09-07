import {
  policiesDueForNotice, queueMessage, queuedMessages, markMessage,
  listRenewalSettingsFull, getOrg, latestFollowUps,
} from './queries';
import {
  render, isChannel, DEFAULT_TEMPLATES, type Channel, type MergeFields,
} from './messaging';
import { deliver } from './delivery';
import { money, longDate, today } from './format';

export type GenerateResult = {
  considered: number;
  queued: number;
  skipped: Array<{ policy_no: string; why: string; because: 'no_contact' | 'not_renewing' }>;
};

export type SendResult = {
  attempted: number;
  sent: number;
  waiting: number;
  failed: number;
};

const DAY = 86_400_000;

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / DAY);
}

/** Squeeze runs of spaces, and spaces before punctuation, out of a rendered message. */
function tidy(text: string): string {
  return text.replace(/[ \t]{2,}/g, ' ').replace(/ +([,.!?])/g, '$1').trim();
}

function addressFor(channel: Channel, row: Record<string, any>): string {
  if (channel === 'email') return String(row.email ?? '');
  return String(row.phone ?? '');   // whatsapp and sms both use the number
}

/**
 * Builds the notices due today and puts them in the outbox.
 *
 * Nothing is sent here. Generating and sending are separate so a run that
 * queues the wrong thing can be cancelled before it reaches a client, and so
 * the agency can read what is about to go out.
 */
export function generateRenewalNotices(orgId: string): GenerateResult {
  const org = getOrg(orgId);
  const settings = listRenewalSettingsFull(orgId).filter((s) => s.enabled === 1);
  const result: GenerateResult = { considered: 0, queued: 0, skipped: [] };
  const stamp = today();
  const said = latestFollowUps(orgId);

  for (const setting of settings) {
    const channel: Channel = isChannel(setting.channel) ? setting.channel : 'whatsapp';
    const fallback = DEFAULT_TEMPLATES[setting.days_before];
    const body = setting.template || fallback?.body;
    const subject = setting.subject || fallback?.subject || null;
    if (!body) continue;

    for (const p of policiesDueForNotice(orgId, setting.days_before)) {
      result.considered++;

      /*
       * Somebody who told the agency a fortnight ago that they sold the car
       * must not get a WhatsApp saying they are about to be uninsured. The
       * worklist already keeps that answer; the scheduler reads it.
       */
      const last = said.get(p.id);
      if (last?.outcome === 'not_renewing') {
        result.skipped.push({
          policy_no: p.policy_no,
          why: `${p.client_name} told the agency they are not renewing${last.note ? ` — ${last.note}` : ''}.`,
          because: 'not_renewing',
        });
        continue;
      }

      const to = addressFor(channel, p);
      if (!to) {
        // Queued anyway would be a message with nowhere to go; saying so lets
        // the agency fix the contact detail rather than wonder.
        result.skipped.push({
          policy_no: p.policy_no,
          why: `${p.client_name} has no ${channel === 'email' ? 'email address' : 'phone number'} on file.`,
          because: 'no_contact',
        });
        continue;
      }

      /*
       * Non-motor policies have no vehicle, and the shipped wording leans on
       * one. Falling back to the product keeps the sentence whole — "your Fire
       * policy loses cover" rather than a gap where the plate should be.
       */
      const subjectNoun = p.vehicle_no || p.product || 'your policy';

      const fields: MergeFields = {
        client_name: p.client_name,
        policy_no: p.policy_no,
        vehicle_no: subjectNoun,
        make_model: p.make_model ?? '',
        principal: p.principal,
        expiry_date: longDate(p.expiry_date),
        days_left: String(daysBetween(stamp, p.expiry_date)),
        total_premium: money(p.total_premium),
        ncd_pct: String(p.ncd_pct ?? 0),
        agency_name: org?.name ?? '',
        agency_phone: org?.phone ?? '',
      };

      const queued = queueMessage({
        org_id: orgId,
        client_id: p.client_id,
        policy_id: p.id,
        kind: 'renewal_notice',
        channel,
        to_address: to,
        subject: subject ? tidy(render(subject, fields)) : null,
        // Collapse the gaps a blank field leaves behind, so a missing detail
        // never shows up as a double space in a client's WhatsApp.
        body: tidy(render(body, fields)),
        scheduled_for: stamp,
        // One per policy per reminder. Re-running the generator on the same
        // day, or twice in a day, adds nothing.
        dedupe_key: `renewal:${p.id}:${setting.id}:${p.expiry_date}`,
      });
      if (queued) result.queued++;
    }
  }

  return result;
}

/**
 * Tries to deliver what is queued.
 *
 * A message with no provider stays queued rather than being marked sent — the
 * outbox is then a worklist for someone to send by hand, and nothing is ever
 * recorded as delivered on a promise that was not kept.
 */
export async function sendQueued(orgId: string, limit = 100): Promise<SendResult> {
  const result: SendResult = { attempted: 0, sent: 0, waiting: 0, failed: 0 };

  for (const m of queuedMessages(orgId, limit)) {
    result.attempted++;
    const outcome = await deliver({
      channel: (isChannel(m.channel) ? m.channel : 'whatsapp'),
      to: m.to_address ?? '',
      subject: m.subject,
      body: m.body,
    });

    if (outcome.sent) {
      markMessage(m.id, orgId, { status: 'sent', error: null, deliveredBy: outcome.by });
      result.sent++;
    } else if (outcome.by === 'manual') {
      // Not a failure: there is simply nobody to hand it to yet.
      markMessage(m.id, orgId, { status: 'queued', error: outcome.error, countAttempt: false });
      result.waiting++;
    } else {
      markMessage(m.id, orgId, { status: 'failed', error: outcome.error, deliveredBy: outcome.by });
      result.failed++;
    }
  }

  return result;
}
