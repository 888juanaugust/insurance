import { test } from 'node:test';
import assert from 'node:assert/strict';
import { passwordProblem, MIN_PASSWORD, DEMO_PASSWORD } from '../src/lib/passwords';
import { ipFromHeaders, safeBack } from '../src/lib/request';
import { checkRate, recordFailure, clearFailures, rateLimitSize, checkUploadRate } from '../src/lib/rate-limit';
import { toCsv } from '../src/lib/csv';
import { hashPassword, verifyPassword, needsRehash, hashPasswordSync } from '../src/lib/auth';
import { isCalendarDate } from '../src/lib/dates';

test('passwords: the one rule', () => {
  assert.match(passwordProblem('short1') ?? '', new RegExp(`${MIN_PASSWORD} characters`));
  assert.match(passwordProblem('nodigitsatall') ?? '', /letter and one number/);
  assert.match(passwordProblem('1234567890123') ?? '', /letter and one number/);
  assert.match(passwordProblem(DEMO_PASSWORD) ?? '', /demo password/);
  assert.equal(passwordProblem('Sturdy-pass-77'), null);
});

test('client address: X-Real-IP first, then the end nginx appended, never the start', () => {
  const h = (map: Record<string, string>) => (name: string) => map[name] ?? null;
  assert.equal(ipFromHeaders(h({ 'x-real-ip': '203.0.113.9', 'x-forwarded-for': '1.1.1.1, 203.0.113.9' })), '203.0.113.9');
  assert.equal(ipFromHeaders(h({ 'x-forwarded-for': '1.1.1.1, 203.0.113.9' })), '203.0.113.9', 'the appended, real address');
  assert.equal(ipFromHeaders(h({ 'x-forwarded-for': 'spoofed' })), 'spoofed', 'nothing better on offer');
  assert.equal(ipFromHeaders(h({})), null);
});

test('safeBack: only a path on this site', () => {
  assert.equal(safeBack('/insurance/general-motor', '/'), '/insurance/general-motor');
  assert.equal(safeBack('https://evil.example/', '/'), '/');
  assert.equal(safeBack('//evil.example/', '/'), '/');
  assert.equal(safeBack('/\\evil.example', '/'), '/');
  assert.equal(safeBack('/ok\r\nSet-Cookie: x', '/'), '/');
  assert.equal(safeBack(undefined, '/x'), '/x');
});

test('sign-in throttle: eight failures block, success clears', () => {
  const key = `test:${Math.random()}`;
  for (let i = 0; i < 7; i++) recordFailure(key);
  assert.equal(checkRate(key).allowed, true);
  recordFailure(key);
  assert.equal(checkRate(key).allowed, false);
  clearFailures(key);
  assert.equal(checkRate(key).allowed, true);
});

test('sign-in throttle: the map is bounded even when every key is live', () => {
  for (let i = 0; i < 6000; i++) recordFailure(`flood:${i}`);
  assert.ok(rateLimitSize() <= 5000, `held ${rateLimitSize()} keys`);
});

test('upload throttle: counts every reading', () => {
  const key = `up:${Math.random()}`;
  let allowed = 0;
  for (let i = 0; i < 120; i++) if (checkUploadRate(key).allowed) allowed++;
  assert.equal(allowed, 100);
});

test('csv: a cell that would run as a formula is disarmed', () => {
  const out = toCsv(['a', 'b'], [['=1+1', 'plain'], ['+cmd', '"quoted"'], ['-5', '@x']]);
  const lines = out.split('\r\n');
  assert.equal(lines[1], "'=1+1,plain");
  assert.equal(lines[2], `'+cmd,"""quoted"""`);
  assert.equal(lines[3], "'-5,'@x");
});

test('passwords hash and verify, and old hashes are recognised for rehash', async () => {
  const stored = await hashPassword('Sturdy-pass-77');
  assert.ok(stored.startsWith('scrypt2:131072:8:1:'));
  assert.equal(await verifyPassword('Sturdy-pass-77', stored), true);
  assert.equal(await verifyPassword('Sturdy-pass-78', stored), false);
  assert.equal(needsRehash(stored), false);

  const sync = hashPasswordSync('Sturdy-pass-77');
  assert.equal(await verifyPassword('Sturdy-pass-77', sync), true);

  // A hash from before the parameters were explicit: library defaults.
  const crypto = await import('node:crypto');
  const salt = 'abcd';
  const legacy = `scrypt:${salt}:${crypto.scryptSync('old-pass-99', salt, 64).toString('hex')}`;
  assert.equal(await verifyPassword('old-pass-99', legacy), true);
  assert.equal(needsRehash(legacy), true);
  assert.equal(await verifyPassword('x', 'garbage'), false);
});

test('calendar dates: shape is not enough', () => {
  assert.equal(isCalendarDate('2026-02-28'), true);
  assert.equal(isCalendarDate('2026-02-31'), false);
  assert.equal(isCalendarDate('2026-13-40'), false);
  assert.equal(isCalendarDate('31/02/2026'), false);
});
