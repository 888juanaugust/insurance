import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { isTenantSlug, slugProblem, slugFromHost, tenantPaths } from '../src/lib/tenant';

test('slugs: what an agency may be called', () => {
  assert.equal(isTenantSlug('bs'), true);
  assert.equal(isTenantSlug('exe-cheras'), true);
  assert.equal(isTenantSlug('a1'), true);
  assert.equal(isTenantSlug('BS'), false, 'uppercase');
  assert.equal(isTenantSlug('-bs'), false, 'leading hyphen');
  assert.equal(isTenantSlug('bs-'), false, 'trailing hyphen');
  assert.equal(isTenantSlug('b s'), false, 'space');
  assert.equal(isTenantSlug('bs.my'), false, 'dot');
  assert.equal(isTenantSlug('www'), false, 'reserved');
  assert.equal(isTenantSlug('portal'), false, 'reserved');
  assert.equal(isTenantSlug('x'.repeat(33)), false, 'too long');
});

test('slugs: a name that would walk out of the tenants directory is refused', () => {
  for (const bad of ['..', '../etc', 'a/b', 'a\\b', '.hidden', '']) {
    assert.equal(isTenantSlug(bad), false, bad);
    assert.notEqual(slugProblem(bad), null, bad);
    assert.throws(() => tenantPaths(bad));
  }
});

test('paths stay inside the tenants directory', () => {
  process.env.IH_TENANTS_DIR = '/var/lib/insurhelp/tenants';
  const t = tenantPaths('bs');
  assert.equal(t.dbPath, path.join('/var/lib/insurhelp/tenants', 'bs', 'insurhelp.db'));
  assert.equal(t.filesDir, path.join('/var/lib/insurhelp/tenants', 'bs', 'documents'));
  assert.ok(t.dbPath.startsWith('/var/lib/insurhelp/tenants/'));
  delete process.env.IH_TENANTS_DIR;
});

test('the address decides the agency', () => {
  const base = 'insurhelp.my';
  assert.equal(slugFromHost('bs.insurhelp.my', base), 'bs');
  assert.equal(slugFromHost('BS.Insurhelp.My', base), 'bs', 'case does not matter');
  assert.equal(slugFromHost('bs.insurhelp.my:443', base), 'bs', 'a port does not matter');
  assert.equal(slugFromHost('bs.insurhelp.my.', base), 'bs', 'a trailing dot does not matter');
  assert.equal(slugFromHost('insurhelp.my', base), null, 'the base domain is nobody');
  assert.equal(slugFromHost('www.insurhelp.my', base), null, 'reserved');
  assert.equal(slugFromHost('a.b.insurhelp.my', base), null, 'only one level');
  assert.equal(slugFromHost('bs.evil.example', base), null, 'another domain entirely');
  assert.equal(slugFromHost('bsinsurhelp.my', base), null, 'not a subdomain');
  assert.equal(slugFromHost('evil.example/bs.insurhelp.my', base), null);
  assert.equal(slugFromHost(null, base), null);
  assert.equal(slugFromHost('bs.insurhelp.my', ''), null, 'no base domain configured');
});
