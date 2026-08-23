/**
 * Rendering a notice, and getting it to the client.
 *
 * Delivery sits behind an adapter because an agency's channel is whatever they
 * already use. The default one records the message and leaves it for a person
 * to send — which is not a stub: a small Malaysian agency sends renewal
 * notices from the owner's own WhatsApp, and a list of exactly what to send to
 * whom, with the text ready to copy, is most of the value. Wiring a provider
 * later turns the same queue automatic without changing anything above it.
 */

export type Channel = 'whatsapp' | 'email' | 'sms';

export const CHANNEL_LABEL: Record<Channel, string> = {
  whatsapp: 'WhatsApp',
  email: 'Email',
  sms: 'SMS',
};

export function isChannel(v: string): v is Channel {
  return v === 'whatsapp' || v === 'email' || v === 'sms';
}

/* ------------------------------------------------------------- templates */

export type MergeFields = {
  client_name: string;
  policy_no: string;
  vehicle_no: string;
  make_model: string;
  principal: string;
  expiry_date: string;
  days_left: string;
  total_premium: string;
  ncd_pct: string;
  agency_name: string;
  agency_phone: string;
};

export const MERGE_FIELDS: Array<{ key: keyof MergeFields; describes: string }> = [
  { key: 'client_name', describes: 'the insured' },
  { key: 'policy_no', describes: 'the policy number' },
  { key: 'vehicle_no', describes: 'the registration number' },
  { key: 'make_model', describes: 'the vehicle' },
  { key: 'principal', describes: 'the insurer' },
  { key: 'expiry_date', describes: 'when cover ends' },
  { key: 'days_left', describes: 'days until expiry' },
  { key: 'total_premium', describes: 'last year’s premium' },
  { key: 'ncd_pct', describes: 'the no-claim discount' },
  { key: 'agency_name', describes: 'your agency' },
  { key: 'agency_phone', describes: 'your number' },
];

/**
 * Substitutes {field} placeholders. An unknown placeholder is left exactly as
 * written rather than blanked: a client receiving "Dear {custmer_name}" tells
 * the agency their template has a typo, whereas "Dear " tells them nothing.
 */
export function render(template: string, fields: MergeFields): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) =>
    key in fields ? String(fields[key as keyof MergeFields] ?? '') : whole,
  );
}

/** Placeholders in a template that are not fields — shown when editing it. */
export function unknownFields(template: string): string[] {
  const known = new Set(MERGE_FIELDS.map((f) => f.key as string));
  const found = new Set<string>();
  for (const m of template.matchAll(/\{(\w+)\}/g)) {
    if (!known.has(m[1])) found.add(m[1]);
  }
  return [...found];
}

export const DEFAULT_TEMPLATES: Record<number, { name: string; subject: string; body: string }> = {
  60: {
    name: 'Two months before expiry',
    subject: 'Your {principal} cover for {vehicle_no} ends {expiry_date}',
    body:
      'Hi {client_name}, your {principal} policy {policy_no} for {vehicle_no} expires on {expiry_date} — '
      + '{days_left} days away.\n\nWe can start comparing renewal quotes now. Last year you paid {total_premium} '
      + 'and you have earned {ncd_pct}% no-claim discount.\n\n{agency_name} · {agency_phone}',
  },
  30: {
    name: 'One month before expiry',
    subject: 'Renewal due: {vehicle_no} on {expiry_date}',
    body:
      'Hi {client_name}, a reminder that cover on {vehicle_no} ({policy_no}) ends in {days_left} days, '
      + 'on {expiry_date}.\n\nShall we go ahead with the renewal? Send us a message and we will prepare it.\n\n'
      + '{agency_name} · {agency_phone}',
  },
  14: {
    name: 'Two weeks before expiry',
    subject: 'Two weeks left on {vehicle_no}',
    body:
      'Hi {client_name}, {vehicle_no} is uninsured from {expiry_date} unless we renew — {days_left} days away.\n\n'
      + 'Driving without cover is an offence and your {ncd_pct}% no-claim discount is lost if the policy lapses.\n\n'
      + '{agency_name} · {agency_phone}',
  },
  7: {
    name: 'Final week',
    subject: 'Last week: {vehicle_no} expires {expiry_date}',
    body:
      '{client_name}, this is the last week. {vehicle_no} loses cover on {expiry_date}.\n\n'
      + 'Call us today and we will have it renewed before then.\n\n{agency_name} · {agency_phone}',
  },
};

/* -------------------------------------------------------------- delivery */

export type Outgoing = {
  channel: Channel;
  to: string;
  subject: string | null;
  body: string;
};

export type DeliveryResult =
  | { sent: true; by: string }
  | { sent: false; by: string; error: string };

export type Adapter = {
  name: string;
  /** Whether this adapter is configured well enough to try. */
  ready: () => boolean;
  send: (message: Outgoing) => Promise<DeliveryResult>;
};

/**
 * The default. It sends nothing and says so — the message stays queued for a
 * person to send by hand from the outbox, and is never marked delivered on a
 * promise that was not kept.
 */
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

/**
 * A provider is reached over HTTP with the details in the environment. Left
 * deliberately generic: agencies use whichever WhatsApp Business reseller they
 * already pay, and they all take a POST.
 *
 * IH_WHATSAPP_URL / IH_EMAIL_URL / IH_SMS_URL, with IH_*_TOKEN as a bearer.
 */
function httpAdapter(channel: Channel): Adapter {
  const key = channel.toUpperCase();
  const url = () => process.env[`IH_${key}_URL`];
  const token = () => process.env[`IH_${key}_TOKEN`];

  return {
    name: `http:${channel}`,
    ready: () => Boolean(url()),
    async send(message) {
      const endpoint = url();
      if (!endpoint) {
        return { sent: false, by: `http:${channel}`, error: `IH_${key}_URL is not set.` };
      }
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            ...(token() ? { authorization: `Bearer ${token()}` } : {}),
          },
          body: JSON.stringify({
            to: message.to,
            subject: message.subject,
            text: message.body,
          }),
          // A hanging provider must not hold up the whole run.
          signal: AbortSignal.timeout(15_000),
        });
        if (!res.ok) {
          const detail = (await res.text().catch(() => '')).slice(0, 200);
          return { sent: false, by: `http:${channel}`, error: `Provider returned ${res.status}. ${detail}`.trim() };
        }
        return { sent: true, by: `http:${channel}` };
      } catch (error) {
        return {
          sent: false,
          by: `http:${channel}`,
          error: error instanceof Error ? error.message : 'The provider could not be reached.',
        };
      }
    },
  };
}

export function adapterFor(channel: Channel): Adapter {
  const http = httpAdapter(channel);
  return http.ready() ? http : manual;
}

/** For the settings screen: which channels can actually deliver on their own. */
export function configuredChannels(): Record<Channel, boolean> {
  return {
    whatsapp: httpAdapter('whatsapp').ready(),
    email: httpAdapter('email').ready(),
    sms: httpAdapter('sms').ready(),
  };
}

export async function deliver(message: Outgoing): Promise<DeliveryResult> {
  if (!message.to) {
    return { sent: false, by: 'none', error: 'No address on file for this channel.' };
  }
  return adapterFor(message.channel).send(message);
}
