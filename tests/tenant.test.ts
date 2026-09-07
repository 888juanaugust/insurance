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

/*
 * Suspension and the landlord, on a tenants directory made for the purpose.
 * An agency "exists" when its database file does, so an empty file will do.
 */
import fs from 'node:fs';
import os from 'node:os';
import {
  checkRequestAgency, isSuspended, suspendedFile, landlordPaths, landlordExists, isLandlordProcess,
  listTenants, nextFreePort, SUSPENDED_MESSAGE, LANDLORD,
} from '../src/lib/tenant';

function scratchTenants(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ih-tenants-'));
  for (const slug of ['bs', 'exe']) {
    fs.mkdirSync(path.join(root, slug));
    fs.writeFileSync(path.join(root, slug, 'insurhelp.db'), '');
    fs.writeFileSync(path.join(root, slug, 'port'), slug === 'bs' ? '3001\n' : '3002\n');
  }
  return root;
}

function withEnv(vars: Record<string, string | undefined>, fn: () => void) {
  const before: Record<string, string | undefined> = {};
  for (const k of Object.keys(vars)) { before[k] = process.env[k]; if (vars[k] === undefined) delete process.env[k]; else process.env[k] = vars[k]; }
  try { fn(); } finally {
    for (const k of Object.keys(vars)) { if (before[k] === undefined) delete process.env[k]; else process.env[k] = before[k]; }
  }
}

test('a suspended agency is refused on sight, with its own reason, and resumes when the marker goes', () => {
  const root = scratchTenants();
  withEnv({ IH_TENANTS_DIR: root, IH_TENANT: 'bs', IH_BASE_DOMAIN: 'insurhelp.test', IH_LANDLORD: undefined }, () => {
    assert.equal(checkRequestAgency('bs.insurhelp.test').ok, true);
    fs.writeFileSync(suspendedFile('bs'), 'now\n');
    assert.equal(isSuspended('bs'), true);
    const r = checkRequestAgency('bs.insurhelp.test');
    assert.deepEqual(r, { ok: false, reason: 'suspended', slug: 'bs' });
    assert.match(SUSPENDED_MESSAGE, /suspended/);
    // The other agency is untouched, and the listing still knows both.
    withEnv({ IH_TENANT: 'exe' }, () => assert.equal(checkRequestAgency('exe.insurhelp.test').ok, true));
    assert.deepEqual(listTenants(), ['bs', 'exe']);
    fs.rmSync(suspendedFile('bs'));
    assert.equal(checkRequestAgency('bs.insurhelp.test').ok, true);
  });
  fs.rmSync(root, { recursive: true, force: true });
});

test('the landlord is a reserved name with a home of its own, served at the base domain only', () => {
  const root = scratchTenants();
  withEnv({ IH_TENANTS_DIR: root, IH_LANDLORD: '1', IH_TENANT: undefined, IH_BASE_DOMAIN: 'insurhelp.test' }, () => {
    assert.equal(isTenantSlug(LANDLORD), false, 'no agency may be called landlord');
    assert.equal(isLandlordProcess(), true);
    const paths = landlordPaths();
    assert.equal(paths.dbPath, path.join(root, 'landlord', 'landlord.db'));
    assert.equal(landlordExists(), false);
    assert.deepEqual(checkRequestAgency('insurhelp.test'), { ok: false, reason: 'no-agency', slug: LANDLORD }, 'no console until it is created');

    fs.mkdirSync(path.dirname(paths.dbPath), { recursive: true });
    fs.writeFileSync(paths.dbPath, '');
    fs.writeFileSync(path.join(root, 'landlord', 'port'), '3001\n');
    assert.equal(landlordExists(), true);
    assert.equal(checkRequestAgency('insurhelp.test').ok, true, 'the base domain');
    assert.equal(checkRequestAgency('www.insurhelp.test').ok, true, 'www is a reserved name, not an agency');
    assert.deepEqual(checkRequestAgency('bs.insurhelp.test'), { ok: false, reason: 'wrong-agency', slug: 'bs' }, "an agency's address has reached the wrong process");
    assert.deepEqual(listTenants(), ['bs', 'exe'], 'the landlord is not an agency');
    assert.equal(nextFreePort(), 3003, 'the landlord\'s port counts as taken');
  });
  fs.rmSync(root, { recursive: true, force: true });
});
