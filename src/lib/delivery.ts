import nodemailer from 'nodemailer';
import type { Channel, DeliveryResult, Outgoing } from './messaging';

/**
 * Getting a notice to the client. Server-only: this pulls in an SMTP client,
 * and messaging.ts — which a client component imports for its labels — must
 * stay free of it.
 *
 * Each channel tries, in order: a real provider wired here (SMTP for email,
 * the WhatsApp Cloud API for WhatsApp), then the generic HTTP hook an agency
 * may already have, then "manual" — which sends nothing and says so, leaving
 * the message in the outbox for a person to send by hand. Nothing is ever
 * marked delivered on a promise that was not kept.
 *
 * On a server with several agencies the settings are the landlord's — one
 * mailbox, one WhatsApp number — and every agency's notices go out through
 * them as part of the service.
 */

export type Adapter = {
  name: string;
  /** Whether this adapter is configured well enough to try. */
  ready: () => boolean;
  send: (message: Outgoing) => Promise<DeliveryResult>;
};

const env = (name: string) => (process.env[name] ?? '').trim();

/* ---------------------------------------------------------------- manual */

const manual: Adapter = {
  name: 'manual',
  ready: () => true,
  async send() {
    return {
      sent: false,
      by: 'manual',
      error: 'No provider is configured for this channel, so the message is waiting to be sent by hand.',
    };
  },
};

/* ------------------------------------------------------------------ SMTP */

/**
 * Email over SMTP: IH_SMTP_HOST, IH_SMTP_PORT (587), IH_SMTP_USER and
 * IH_SMTP_PASS if the server wants them, IH_SMTP_FROM for the sender. Any
 * mailbox works — the hosting company's, Gmail with an app password, a
 * transactional service's SMTP relay.
 */
export function smtpSettings() {
  const host = env('IH_SMTP_HOST');
  const port = Number(env('IH_SMTP_PORT') || 587);
  const user = env('IH_SMTP_USER');
  const pass = env('IH_SMTP_PASS');
  const from = env('IH_SMTP_FROM') || user;
  const secure = env('IH_SMTP_SECURE') === '1' || port === 465;
  return { host, port, user, pass, from, secure };
}

const smtp: Adapter = {
  name: 'smtp',
  ready: () => Boolean(smtpSettings().host && smtpSettings().from),
  async send(message) {
    const s = smtpSettings();
    if (!s.host) return { sent: false, by: 'smtp', error: 'IH_SMTP_HOST is not set.' };
    if (!s.from) return { sent: false, by: 'smtp', error: 'IH_SMTP_FROM (or IH_SMTP_USER) is not set.' };
    try {
      const transport = nodemailer.createTransport({
        host: s.host,
        port: s.port,
        secure: s.secure,
        auth: s.user ? { user: s.user, pass: s.pass } : undefined,
        // A mail server that stops answering must not hold up the run.
        connectionTimeout: 15_000,
        greetingTimeout: 15_000,
        socketTimeout: 30_000,
      });
      await transport.sendMail({
        from: s.from,
        to: message.to,
        subject: message.subject ?? 'A notice from your insurance agency',
        text: message.body,
      });
      return { sent: true, by: 'smtp' };
    } catch (error) {
      return { sent: false, by: 'smtp', error: error instanceof Error ? error.message : 'The mail server could not be reached.' };
    }
  },
};

/* ------------------------------------------------------- WhatsApp Cloud */

/**
 * A phone number as WhatsApp wants it: digits only, country code first, no
 * plus. Malaysian numbers are written 012-345 6789 on a client's record;
 * that is 60123456789 on the wire. IH_WHATSAPP_COUNTRY_CODE covers an
 * agency somewhere else.
 */
export function whatsappNumber(raw: string, countryCode = env('IH_WHATSAPP_COUNTRY_CODE') || '60'): string {
  let digits = raw.replace(/\D/g, '');
  if (raw.trim().startsWith('+')) return digits;
  if (digits.startsWith('00')) digits = digits.slice(2);
  else if (digits.startsWith('0')) digits = countryCode + digits.slice(1);
  return digits;
}

/**
 * A template body parameter may not carry a newline, a tab, or four spaces in
 * a row; a notice written in paragraphs has to become one line.
 */
export function oneLine(text: string): string {
  return text.replace(/\r?\n\s*\r?\n/g, ' — ').replace(/\s*\r?\n\s*/g, ' ').replace(/\t/g, ' ').replace(/ {4,}/g, '   ').trim();
}

/**
 * WhatsApp Business through Meta's Cloud API.
 *
 * IH_WHATSAPP_PHONE_ID is the sender's phone number ID from the Meta business
 * dashboard and IH_WHATSAPP_TOKEN a system-user access token. A renewal
 * notice is a message the business starts, and WhatsApp only delivers those
 * as an APPROVED TEMPLATE; IH_WHATSAPP_TEMPLATE names one whose body is a
 * single {{1}} parameter, which carries the whole notice. Without a template
 * the notice is sent as free text, which WhatsApp delivers only inside the 24
 * hours after the client last wrote to the number — so a template is not
 * optional in practice.
 */
export function whatsappSettings() {
  return {
    phoneId: env('IH_WHATSAPP_PHONE_ID'),
    token: env('IH_WHATSAPP_TOKEN'),
    template: env('IH_WHATSAPP_TEMPLATE'),
    language: env('IH_WHATSAPP_TEMPLATE_LANG') || 'en',
    apiBase: env('IH_WHATSAPP_API_BASE') || 'https://graph.facebook.com',
    apiVersion: env('IH_WHATSAPP_API_VERSION') || 'v21.0',
  };
}

const whatsappCloud: Adapter = {
  name: 'whatsapp-cloud',
  ready: () => Boolean(whatsappSettings().phoneId && whatsappSettings().token),
  async send(message) {
    const s = whatsappSettings();
    const by = 'whatsapp-cloud';
    if (!s.phoneId || !s.token) return { sent: false, by, error: 'IH_WHATSAPP_PHONE_ID and IH_WHATSAPP_TOKEN are not both set.' };
    const to = whatsappNumber(message.to);
    if (to.length < 8) return { sent: false, by, error: `"${message.to}" is not a usable phone number.` };

    const payload = s.template
      ? {
          messaging_product: 'whatsapp', to, type: 'template',
          template: {
            name: s.template,
            language: { code: s.language },
            components: [{ type: 'body', parameters: [{ type: 'text', text: oneLine(message.body) }] }],
          },
        }
      : { messaging_product: 'whatsapp', to, type: 'text', text: { preview_url: false, body: message.body } };

    try {
      const res = await fetch(`${s.apiBase}/${s.apiVersion}/${s.phoneId}/messages`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${s.token}` },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15_000),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: { message?: string; code?: number }; messages?: Array<{ id: string }> };
      if (!res.ok || !json.messages?.length) {
        const why = json.error?.message ?? `WhatsApp returned ${res.status}.`;
        return { sent: false, by, error: json.error?.code ? `${why} (error ${json.error.code})` : why };
      }
      return { sent: true, by };
    } catch (error) {
      return { sent: false, by, error: error instanceof Error ? error.message : 'WhatsApp could not be reached.' };
    }
  },
};

/* ------------------------------------------------------------ HTTP hook */

/**
 * A provider reached over HTTP with the details in the environment. Left
 * deliberately generic: agencies use whichever WhatsApp Business reseller
 * they already pay, and they all take a POST.
 *
 * IH_WHATSAPP_URL / IH_EMAIL_URL / IH_SMS_URL, with IH_*_TOKEN as a bearer.
 */
function httpAdapter(channel: Channel): Adapter {
  const key = channel.toUpperCase();
  const url = () => env(`IH_${key}_URL`);
  const token = () => env(`IH_${key}_TOKEN`);

  return {
    name: `http:${channel}`,
    ready: () => Boolean(url()),
    async send(message) {
      const endpoint = url();
      if (!endpoint) return { sent: false, by: `http:${channel}`, error: `IH_${key}_URL is not set.` };
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            ...(token() ? { authorization: `Bearer ${token()}` } : {}),
          },
          body: JSON.stringify({ to: message.to, subject: message.subject, text: message.body }),
          signal: AbortSignal.timeout(15_000),
        });
        if (!res.ok) {
          const detail = (await res.text().catch(() => '')).slice(0, 200);
          return { sent: false, by: `http:${channel}`, error: `Provider returned ${res.status}. ${detail}`.trim() };
        }
        return { sent: true, by: `http:${channel}` };
      } catch (error) {
        return { sent: false, by: `http:${channel}`, error: error instanceof Error ? error.message : 'The provider could not be reached.' };
      }
    },
  };
}

/* --------------------------------------------------------------- choose */

export function adapterFor(channel: Channel): Adapter {
  const candidates: Adapter[] =
    channel === 'email' ? [smtp, httpAdapter('email')]
    : channel === 'whatsapp' ? [whatsappCloud, httpAdapter('whatsapp')]
    : [httpAdapter('sms')];
  return candidates.find((a) => a.ready()) ?? manual;
}

/** Which channels can deliver on their own, and through what. */
export function configuredChannels(): Record<Channel, boolean> {
  return {
    whatsapp: adapterFor('whatsapp').name !== 'manual',
    email: adapterFor('email').name !== 'manual',
    sms: adapterFor('sms').name !== 'manual',
  };
}

/** The provider each channel would use, for the settings screen. */
export function providerNames(): Record<Channel, string | null> {
  const name = (c: Channel) => { const a = adapterFor(c); return a.name === 'manual' ? null : a.name; };
  return { whatsapp: name('whatsapp'), email: name('email'), sms: name('sms') };
}

export async function deliver(message: Outgoing): Promise<DeliveryResult> {
  if (!message.to) return { sent: false, by: 'none', error: 'No address on file for this channel.' };
  return adapterFor(message.channel).send(message);
}
