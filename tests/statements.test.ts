import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  readMoney, readRate, mapStatementColumns, readStatement, groupOutcomes, TOLERANCE,
} from '../src/lib/statements';

test('readMoney: plain, thousands, brackets, refusals', () => {
  assert.equal(readMoney('1234.50'), 1234.5);
  assert.equal(readMoney('RM 12,480.00'), 12480);
  assert.equal(readMoney('(320.75)'), -320.75);
  assert.equal(readMoney('-320.75'), -320.75);
  assert.equal(readMoney('0'), 0);
  assert.equal(readMoney('   '), null, 'blank is nothing, not zero');
  assert.equal(readMoney('120.00 CR'), null, 'CR is refused, not guessed');
  assert.equal(readMoney('N/A'), null);
});

test('readRate: per cent sign, fractions, blanks', () => {
  assert.equal(readRate('10'), 10);
  assert.equal(readRate('15%'), 15);
  assert.equal(readRate('0.10'), 10);
  assert.equal(readRate('1'), 1);
  assert.equal(readRate(''), null);
});

test('column mapping: bilingual headers, and the rate is never the money', () => {
  const m = mapStatementColumns(['Policy No.', 'Nama', 'No. Kenderaan', 'Premium Kasar', 'Komisen', 'Batch']);
  assert.deepEqual(m.mapping, { policy_no: 0, insured: 1, vehicle_no: 2, gross_premium: 3, commission: 4 });
  assert.deepEqual(m.unrecognised, ['Batch']);

  const pc = mapStatementColumns(['Policy No', 'Commission %', 'Commission']);
  assert.equal(pc.mapping.commission_rate, 1);
  assert.equal(pc.mapping.commission, 2);
  const pc2 = mapStatementColumns(['Policy No', 'Comm %', 'Comm Amt']);
  assert.deepEqual([pc2.mapping.commission_rate, pc2.mapping.commission], [1, 2]);
});

test('readStatement: refusals name what is missing', () => {
  assert.ok(readStatement('Amount\n100.00\n').fatal?.includes('identifies the case'));
  assert.ok(readStatement('Policy No,Premium\nPMV1,100\n').fatal?.includes('commission'));
  assert.equal(readStatement('Policy No,Commission\n').fatal, 'That file has a header but no lines.');
  assert.notEqual(readStatement('Policy No,Commission %\nPMV1,10\n').fatal, null, 'a rate alone is not a statement');
});

test('readStatement: quoted names, day-first dates, clawbacks, totals', () => {
  const csv = [
    'Policy No,Insured Name,Vehicle No,Effective Date,Gross Premium,Rate,Commission',
    'PMV/2026/0001,"TAN, AH KOW",WXY 4471,01/03/2026,"1,200.00",10%,120.00',
    'PMV/2026/0002,LIM SDN BHD,,15/04/2026,"2,000.00",10,150.00',
    'PMV/2026/0003,CANCELLED CASE,,01/02/2026,"800.00",10,(80.00)',
    ',,,,,,',
    'TOTAL,,,,,,190.00',
  ].join('\r\n');
  const read = readStatement(csv);
  assert.equal(read.fatal, null);
  assert.equal(read.rows.length, 3, 'the total line and the blank line are not cases');
  assert.equal(read.rows[0].insured, 'TAN, AH KOW');
  assert.equal(read.rows[0].effective_date, '2026-03-01');
  assert.equal(read.rows[2].commission, -80);
  assert.equal(read.total, 190);
});

test('groupOutcomes: judged per policy, to the sen', () => {
  const expected = new Map([
    ['p1', { policy_no: 'A', insured: 'One', commission_amt: 120 }],
    ['p2', { policy_no: 'B', insured: 'Two', commission_amt: 150 }],
    ['p3', { policy_no: 'C', insured: 'Three', commission_amt: 90 }],
  ]);
  const outcomes = groupOutcomes(
    [
      { line: 1, policy_id: 'p1', commission: 60 },
      { line: 2, policy_id: 'p1', commission: 60 },     // two instalments, agreed on the total
      { line: 3, policy_id: 'p2', commission: 149.99 },  // one sen short is still agreed
      { line: 4, policy_id: 'p3', commission: 80 },      // short by ten
    ],
    (pid) => expected.get(pid),
  );
  const byPolicy = Object.fromEntries(outcomes.map((o) => [o.policy_id, o]));
  assert.equal(byPolicy.p1.state, 'agreed');
  assert.deepEqual(byPolicy.p1.lines, [1, 2]);
  assert.equal(byPolicy.p2.state, 'agreed', `within the ${TOLERANCE} tolerance`);
  assert.equal(byPolicy.p3.state, 'short');
  assert.equal(byPolicy.p3.variance, -10);
});
