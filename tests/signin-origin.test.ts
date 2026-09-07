import { test } from 'node:test';
import assert from 'node:assert/strict';
import { insecureSignIn } from '../src/lib/request';

const h = (headers: Record<string, string>) => (name: string) => headers[name] ?? null;

test('a sign-in the proxy marks as https is fine', () => {
  assert.equal(insecureSignIn(h({ host: 'srv1960422.hstgr.cloud', 'x-forwarded-proto': 'https', origin: 'https://srv1960422.hstgr.cloud' })), null);
});

test('a sign-in the proxy marks as http is refused, with the https address', () => {
  assert.equal(
    insecureSignIn(h({ host: 'srv1960422.hstgr.cloud', 'x-forwarded-proto': 'http', origin: 'http://srv1960422.hstgr.cloud' })),
    'https://srv1960422.hstgr.cloud/login',
  );
});

test('without a proxy the Origin header decides', () => {
  assert.equal(insecureSignIn(h({ host: '203.0.113.7:3000', origin: 'http://203.0.113.7:3000' })), 'https://203.0.113.7/login');
  assert.equal(insecureSignIn(h({ host: 'app.agency.my', origin: 'https://app.agency.my' })), null);
});

test('the proxy outranks the Origin header', () => {
  // A misconfigured proxy that says https for a plain connection is its own
  // problem; the point is that a proxy that says http is believed.
  assert.equal(insecureSignIn(h({ host: 'a.b', 'x-forwarded-proto': 'http', origin: 'https://a.b' })), 'https://a.b/login');
});

test('localhost is exempt: browsers treat it as secure', () => {
  for (const host of ['localhost:3000', '127.0.0.1:4101', '[::1]:3000', 'dev.localhost']) {
    assert.equal(insecureSignIn(h({ host, origin: `http://${host}` })), null, host);
  }
});

test('the portal gets its own path in the address', () => {
  assert.equal(insecureSignIn(h({ host: 'srv.example', 'x-forwarded-proto': 'http' }), '/portal/login'), 'https://srv.example/portal/login');
});

test('no signal at all is not refused', () => {
  assert.equal(insecureSignIn(h({ host: 'srv.example' })), null);
});
