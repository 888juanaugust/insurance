import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toNumber, toIsoDate } from '../src/lib/extract/rules';
import { isValid } from '../src/lib/extract/validate';

test('dates on Malaysian schedules are day-first', () => {
  assert.equal(toIsoDate('20/06/2025'), '2025-06-20');
  assert.equal(toIsoDate('20-06-2025'), '2025-06-20');
  assert.equal(toIsoDate('2025-06-20'), '2025-06-20');
  assert.equal(toIsoDate('not a date'), null);
});

test('amounts carry thousands separators and never a bare digit', () => {
  assert.equal(toNumber('1,913.44'), 1913.44);
  assert.equal(toNumber('RM 1,913.44'), 1913.44);
  assert.equal(toNumber(''), null);
});

test('validation refuses what cannot be a value', () => {
  assert.equal(isValid('nric', '900101-14-5555'), true);
  assert.equal(isValid('nric', 'not an nric'), false);
  assert.equal(isValid('expiry_date', '2026-13-40'), false);
  assert.equal(isValid('expiry_date', '2026-06-19'), true);
  assert.equal(isValid('gross_premium', -5), false);
  assert.equal(isValid('gross_premium', 1753.67), true);
});
