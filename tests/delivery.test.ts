import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import { SMTPServer } from 'smtp-server';
import { adapterFor, deliver, whatsappNumber, oneLine, providerNames } from '../src/lib/delivery';

/*
 * The adapters against real listeners on this machine: an SMTP server that
 * keeps what it is handed, and an HTTP server standing in for Meta's Cloud
 * API. Nothing here reaches the internet.
 */

const DELIVERY_VARS = [
  'IH_SMTP_HOST', 'IH_SMTP_PORT', 'IH_SMTP_USER', 'IH_SMTP_PASS', 'IH_SMTP_FROM', 'IH_SMTP_SECURE',
  'IH_WHATSAPP_PHONE_ID', 'IH_WHATSAPP_TOKEN', 'IH_WHATSAPP_TEMPLATE', 'IH_WHATSAPP_TEMPLATE_LANG',
  'IH_WHATSAPP_API_BASE', 'IH_WHATSAPP_API_VERSION', 'IH_WHATSAPP_COUNTRY_CODE',
  'IH_WHATSAPP_URL', 'IH_WHATSAPP_TOKEN', 'IH_EMAIL_URL', 'IH_EMAIL_TOKEN', 'IH_SMS_URL', 'IH_SMS_TOKEN',
];
function clearEnv() { for (const v of DELIVERY_VARS) delete process.env[v]; }

async function freePort(): Promise<number> {
  return new Promise((resolve) => {
    const s = net.createServer();
    s.listen(0, '127.0.0.1', () => { const { port } = s.address() as net.AddressInfo; s.close(() => resolve(port)); });
  });
}

/* ------------------------------------------------------------------ SMTP */

let smtpPort = 0;
let smtpServer: SMTPServer;
const received: Array<{ from: string; to: string[]; raw: string }> = [];

before(async () => {
  smtpPort = await freePort();
  smtpServer = new SMTPServer({
    authOptional: true,
    disabledCommands: ['STARTTLS'],
    onData(stream, session, done) {
      let raw = '';
      stream.on('data', (c) => { raw += c; });
      stream.on('end', () => {
        received.push({
          from: session.envelope.mailFrom ? session.envelope.mailFrom.address : '',
          to: session.envelope.rcptTo.map((r) => r.address),
          raw,
        });
        done();
      });
    },
  });
  await new Promise<void>((resolve) => smtpServer.listen(smtpPort, '127.0.0.1', resolve));
});
after(() => new Promise<void>((resolve) => smtpServer.close(resolve)));

test('with nothing configured every channel is manual, and a notice waits rather than fails', async () => {
  clearEnv();
  assert.deepEqual(providerNames(), { whatsapp: null, email: null, sms: null });
  const r = await deliver({ channel: 'email', to: 'a@b.my', subject: 'x', body: 'y' });
  assert.equal(r.sent, false);
  assert.equal(r.by, 'manual');
});

test('an email goes out over SMTP with the subject, the body and the sender configured', async () => {
  clearEnv();
  process.env.IH_SMTP_HOST = '127.0.0.1';
  process.env.IH_SMTP_PORT = String(smtpPort);
  process.env.IH_SMTP_FROM = 'notices@agency.example';
  assert.equal(adapterFor('email').name, 'smtp');

  received.length = 0;
  const r = await deliver({
    channel: 'email', to: 'client@example.my',
    subject: 'Renewal due: WXY 1234 on 30 June 2027',
    body: 'Hi Lim, your policy ends soon.\n\nAgency · 012-345 6789',
  });
  assert.deepEqual(r, { sent: true, by: 'smtp' });
  assert.equal(received.length, 1);
  assert.equal(received[0].from, 'notices@agency.example');
  assert.deepEqual(received[0].to, ['client@example.my']);
  assert.match(received[0].raw, /Subject: Renewal due: WXY 1234 on 30 June 2027/);
  assert.match(received[0].raw, /Hi Lim, your policy ends soon\./);
});

test('a mail server that is not there is a failure, not a hang and not a lie', async () => {
  clearEnv();
  process.env.IH_SMTP_HOST = '127.0.0.1';
  process.env.IH_SMTP_PORT = String(await freePort());   // nobody listening
  process.env.IH_SMTP_FROM = 'notices@agency.example';
  const r = await deliver({ channel: 'email', to: 'client@example.my', subject: 's', body: 'b' });
  assert.equal(r.sent, false);
  assert.equal(r.by, 'smtp');
  assert.ok(r.sent === false && r.error.length > 0);
});

/* --------------------------------------------------------- WhatsApp Cloud */

test('phone numbers become what WhatsApp wants: digits, country code first, no plus', () => {
  assert.equal(whatsappNumber('012-345 6789'), '60123456789');
  assert.equal(whatsappNumber('0123456789'), '60123456789');
  assert.equal(whatsappNumber('+60 12-345 6789'), '60123456789');
  assert.equal(whatsappNumber('60123456789'), '60123456789');
  assert.equal(whatsappNumber('0060123456789'), '60123456789');
  assert.equal(whatsappNumber('0812345678', '65'), '65812345678', 'another country code');
});

test('a notice written in paragraphs becomes one line for a template parameter', () => {
  assert.equal(oneLine('Hi Lim,\nyour policy ends.\n\nAgency · 012'), 'Hi Lim, your policy ends. — Agency · 012');
  // Tabs become spaces and a run of four or more spaces is cut to three: what
  // a template parameter may carry, no more.
  assert.equal(oneLine('a\t\tb      c'), 'a  b   c');
  assert.doesNotMatch(oneLine('x\n\n\ny     z\tw'), /[\n\t]| {4}/);
});

async function withMetaMock(
  status: number, reply: unknown,
  run: (base: string, seen: Array<{ path: string; auth: string | undefined; body: unknown }>) => Promise<void>,
) {
  const seen: Array<{ path: string; auth: string | undefined; body: unknown }> = [];
  const server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => {
      seen.push({ path: req.url ?? '', auth: req.headers.authorization, body: raw ? JSON.parse(raw) : null });
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(JSON.stringify(reply));
    });
  });
  const port = await freePort();
  await new Promise<void>((resolve) => server.listen(port, '127.0.0.1', resolve));
  try {
    await run(`http://127.0.0.1:${port}`, seen);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

test('a WhatsApp notice is sent as an approved template with the whole notice as its one parameter', async () => {
  await withMetaMock(200, { messages: [{ id: 'wamid.1' }] }, async (base, seen) => {
    clearEnv();
    process.env.IH_WHATSAPP_PHONE_ID = '123456789';
    process.env.IH_WHATSAPP_TOKEN = 'EAAG-test-token';
    process.env.IH_WHATSAPP_TEMPLATE = 'renewal_notice';
    process.env.IH_WHATSAPP_API_BASE = base;
    assert.equal(adapterFor('whatsapp').name, 'whatsapp-cloud');

    const r = await deliver({ channel: 'whatsapp', to: '012-345 6789', subject: null, body: 'Hi Lim,\nyour cover ends.\n\nAgency' });
    assert.deepEqual(r, { sent: true, by: 'whatsapp-cloud' });
    assert.equal(seen.length, 1);
    assert.equal(seen[0].path, '/v21.0/123456789/messages');
    assert.equal(seen[0].auth, 'Bearer EAAG-test-token');
    assert.deepEqual(seen[0].body, {
      messaging_product: 'whatsapp', to: '60123456789', type: 'template',
      template: {
        name: 'renewal_notice', language: { code: 'en' },
        components: [{ type: 'body', parameters: [{ type: 'text', text: 'Hi Lim, your cover ends. — Agency' }] }],
      },
    });
  });
});

test('without a template the notice goes as free text, which WhatsApp only delivers inside the service window', async () => {
  await withMetaMock(200, { messages: [{ id: 'wamid.2' }] }, async (base, seen) => {
    clearEnv();
    process.env.IH_WHATSAPP_PHONE_ID = '123456789';
    process.env.IH_WHATSAPP_TOKEN = 't';
    process.env.IH_WHATSAPP_API_BASE = base;
    const r = await deliver({ channel: 'whatsapp', to: '0123456789', subject: null, body: 'Hello' });
    assert.equal(r.sent, true);
    assert.deepEqual(seen[0].body, { messaging_product: 'whatsapp', to: '60123456789', type: 'text', text: { preview_url: false, body: 'Hello' } });
  });
});

test("WhatsApp's refusal comes back as the failure it is, with Meta's own reason", async () => {
  await withMetaMock(400, { error: { message: 'Template name does not exist in the translation', code: 132001 } }, async (base) => {
    clearEnv();
    process.env.IH_WHATSAPP_PHONE_ID = '123456789';
    process.env.IH_WHATSAPP_TOKEN = 't';
    process.env.IH_WHATSAPP_TEMPLATE = 'missing';
    process.env.IH_WHATSAPP_API_BASE = base;
    const r = await deliver({ channel: 'whatsapp', to: '0123456789', subject: null, body: 'Hello' });
    assert.equal(r.sent, false);
    assert.equal(r.by, 'whatsapp-cloud');
    assert.ok(r.sent === false && /Template name does not exist.*\(error 132001\)/.test(r.error), r.sent === false ? r.error : '');
  });
});

test('a real provider outranks the generic hook, and the hook outranks manual', () => {
  clearEnv();
  process.env.IH_EMAIL_URL = 'http://127.0.0.1:9/hook';
  assert.equal(adapterFor('email').name, 'http:email');
  process.env.IH_SMTP_HOST = '127.0.0.1';
  process.env.IH_SMTP_FROM = 'a@b';
  assert.equal(adapterFor('email').name, 'smtp');
  process.env.IH_WHATSAPP_URL = 'http://127.0.0.1:9/hook';
  assert.equal(adapterFor('whatsapp').name, 'http:whatsapp');
  process.env.IH_WHATSAPP_PHONE_ID = '1';
  process.env.IH_WHATSAPP_TOKEN = 't';
  assert.equal(adapterFor('whatsapp').name, 'whatsapp-cloud');
  assert.equal(adapterFor('sms').name, 'manual');
  assert.deepEqual(providerNames(), { whatsapp: 'whatsapp-cloud', email: 'smtp', sms: null });
  clearEnv();
});
