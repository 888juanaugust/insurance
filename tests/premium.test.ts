import { test } from 'node:test';
import assert from 'node:assert/strict';
import { policyFigures, readNumber } from '../src/lib/premium';

const form = (values: Record<string, string>) => (name: string) => values[name] ?? '';

test('readNumber tolerates thousands separators and blanks', () => {
  assert.equal(readNumber('1,913.44'), 1913.44);
  assert.equal(readNumber(''), 0);
  assert.equal(readNumber('abc'), 0);
});

test('total payable is gross + service tax + stamp duty when not typed', () => {
  const f = policyFigures(form({ gross_premium: '1000', service_tax: '80', stamp_duty: '10' }));
  assert.equal(f.total_premium, 1090);
});

test('a typed total wins over the sum', () => {
  const f = policyFigures(form({ gross_premium: '1000', service_tax: '80', stamp_duty: '10', total_premium: '1090.05' }));
  assert.equal(f.total_premium, 1090.05);
});

test('commission is worked out from the rate when blank', () => {
  const f = policyFigures(form({ gross_premium: '1000', commission_rate: '10' }));
  assert.equal(f.commission_amt, 100);
});

test('a typed 0 commission is nil, not blank', () => {
  const f = policyFigures(form({ gross_premium: '1000', commission_rate: '10', commission_amt: '0' }));
  assert.equal(f.commission_amt, 0);
});

test('a typed commission figure is kept as typed', () => {
  const f = policyFigures(form({ gross_premium: '1000', commission_rate: '10', commission_amt: '87.65' }));
  assert.equal(f.commission_amt, 87.65);
});

test('basic premium is worked back from gross and the NCD', () => {
  // 25% NCD: gross 750 came from a basic of 1000.
  const f = policyFigures(form({ gross_premium: '750', ncd_pct: '25' }));
  assert.equal(f.basic_premium, 1000);
  assert.equal(f.ncd_amount, 250);
});

test('extra cover premium is not discounted', () => {
  // gross 850 = 750 after NCD on a 1000 basic, plus 100 of extras.
  const f = policyFigures(form({ gross_premium: '850', ncd_pct: '25', extra_premium: '100' }));
  assert.equal(f.basic_premium, 1000);
  assert.equal(f.ncd_amount, 250);
});

test('a 100% NCD does not divide by zero', () => {
  const f = policyFigures(form({ gross_premium: '500', ncd_pct: '100' }));
  assert.equal(f.basic_premium, 500);
});

test('an OTC-rounded total typed on the form is kept, commission from gross', () => {
  // A schedule prints a counter-rounded total due; what was typed is what is
  // stored, and commission still comes from the gross premium.
  const f = policyFigures(form({ gross_premium: '1753.67', service_tax: '140.29', stamp_duty: '10', total_premium: '1903.95', commission_rate: '10' }));
  assert.equal(f.total_premium, 1903.95);
  assert.equal(f.commission_amt, 175.37);
});
