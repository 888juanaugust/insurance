import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseEnvFile, loadEnvFile } from '../src/lib/env-file';

test('parses the shapes .env.example uses', () => {
  const parsed = parseEnvFile(`
# a comment
IH_SECRET=abc123
IH_TENANTS_DIR=/var/lib/insurhelp/tenants
IH_BASE_DOMAIN="insurhelp.my"
IH_AGENCY_NAME='My agency'
IH_CRON_SECRET=deadbeefdeadbeef   # trailing comment
export IH_TODAY=2026-08-22
# IH_MODEL_PASS=always
EMPTY=
not a line
=nokey
`);
  assert.deepEqual(parsed, {
    IH_SECRET: 'abc123',
    IH_TENANTS_DIR: '/var/lib/insurhelp/tenants',
    IH_BASE_DOMAIN: 'insurhelp.my',
    IH_AGENCY_NAME: 'My agency',
    IH_CRON_SECRET: 'deadbeefdeadbeef',
    IH_TODAY: '2026-08-22',
    EMPTY: '',
  });
});

test('a value with = inside survives, and a # inside quotes is not a comment', () => {
  const parsed = parseEnvFile('IH_WHATSAPP_URL=https://x.example/send?a=1&b=2\nPW="pa#ss=word"');
  assert.equal(parsed.IH_WHATSAPP_URL, 'https://x.example/send?a=1&b=2');
  assert.equal(parsed.PW, 'pa#ss=word');
});

test('loading never overrides what the shell already set, and a missing file is nothing', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ih-env-'));
  const file = path.join(dir, '.env.production');
  fs.writeFileSync(file, 'IH_ENV_TEST_A=from-file\nIH_ENV_TEST_B=from-file\n');
  process.env.IH_ENV_TEST_A = 'from-shell';
  delete process.env.IH_ENV_TEST_B;

  assert.equal(loadEnvFile(file), 1);
  assert.equal(process.env.IH_ENV_TEST_A, 'from-shell');
  assert.equal(process.env.IH_ENV_TEST_B, 'from-file');
  assert.equal(loadEnvFile(path.join(dir, 'nope')), 0);

  delete process.env.IH_ENV_TEST_A;
  delete process.env.IH_ENV_TEST_B;
  fs.rmSync(dir, { recursive: true, force: true });
});
