import { test } from 'node:test';
import assert from 'node:assert/strict';
import { learnLabels, learnedPattern, printedForms, type LearnedLabel } from '../src/lib/extract/learned';
import { extractWithRules } from '../src/lib/extract/rules';
import { rulesFellShort } from '../src/lib/extract/gate';
import type { PdfDoc } from '../src/lib/extract/pdf';

const doc = (lines: string[]): PdfDoc => ({ pageCount: 1, pages: [lines], lines, text: lines.join('\n') });

test('a label on the same line as the value is learned, without its colon', () => {
  const lines = [
    'Policy Number : ABC12345',
    'Nama Pemegang Polisi : AHMAD BIN ALI',
    'Jumlah Perlu Dibayar RM 1,234.56',
  ];
  const learned = learnLabels(lines, { policy_no: 'ABC12345', insured_name: 'AHMAD BIN ALI', total_payable: 1234.56 }, new Set());
  assert.deepEqual(learned, [
    { key: 'policy_no', label: 'Policy Number', placement: 'same' },
    { key: 'insured_name', label: 'Nama Pemegang Polisi', placement: 'same' },
    { key: 'total_payable', label: 'Jumlah Perlu Dibayar', placement: 'same' },
  ]);
});

test('a value that opens its line learns the label above it', () => {
  const lines = ['No. Sijil Insurans', 'XYZ99887', 'Tarikh Mula', '01/07/2026'];
  const learned = learnLabels(lines, { policy_no: 'XYZ99887', effective_date: '2026-07-01' }, new Set());
  assert.deepEqual(learned, [
    { key: 'policy_no', label: 'No. Sijil Insurans', placement: 'below' },
    { key: 'effective_date', label: 'Tarikh Mula', placement: 'below' },
  ]);
});

test('another field\'s value on the same line is cut out of the label', () => {
  const lines = ['Make & Model : TOYOTA ALPHARD Chassis No : PMHDG4880PD847374'];
  const learned = learnLabels(lines, { make_model: 'TOYOTA ALPHARD', chassis_no: 'PMHDG4880PD847374' }, new Set());
  assert.deepEqual(learned.find((l) => l.key === 'chassis_no'), { key: 'chassis_no', label: 'Chassis No', placement: 'same' });
  assert.deepEqual(learned.find((l) => l.key === 'make_model'), { key: 'make_model', label: 'Make & Model', placement: 'same' });
});

test('fields the rules already read right teach nothing, and a value inside a longer token is not the value', () => {
  const lines = ['Seats 2012 Year 2012'];
  assert.deepEqual(learnLabels(lines, { policy_no: 'ABC12345' }, new Set(['policy_no'])), []);
  // "12" would sit inside "2012"; nothing to learn for seating here.
  assert.deepEqual(learnLabels(lines, { seating: 12 }, new Set()), []);
});

test('the printed forms of a value cover how Malaysian schedules write it', () => {
  assert.deepEqual(printedForms('effective_date', '2026-07-01'), ['01/07/2026', '01-07-2026', '01 JUL 2026', '01-JUL-2026', '2026-07-01']);
  assert.deepEqual(printedForms('total_payable', 1234.5), ['1,234.50', '1234.50', '1234.5']);
  assert.deepEqual(printedForms('nric', '900101-14-5555'), ['900101-14-5555', '900101145555']);
  assert.deepEqual(printedForms('vehicle_no', 'WXY1234'), ['WXY1234', 'WXY 1234']);
  assert.deepEqual(printedForms('vehicle_no', 'wxy 1234 a'), ['WXY1234A', 'WXY 1234A', 'WXY1234 A', 'WXY 1234 A']);
});

test('a stacked label only matches a line that is the label and nothing else', () => {
  const p = learnedPattern({ label: 'No. Sijil Insurans', placement: 'below' });
  assert.ok(p.test('No. Sijil Insurans'));
  assert.ok(p.test('  No.  Sijil   Insurans :'));
  assert.ok(!p.test('No. Sijil Insurans XYZ99887'));
});

/*
 * The whole loop on an insurer the rules have no profile for and whose labels
 * they do not know: the rules fall short, the saved policy teaches the
 * labels, a provisional label still leaves the gate open, a confirmed one
 * closes it.
 */
const unfamiliar = doc([
  'MSIG Insurance (Malaysia) Bhd',
  'Insurans Kenderaan Persendirian — Jadual',
  'Nombor Polisi : MS1234567',
  'Nama Yang Dilindungi : LIM AH KOW',
  'Nombor Kenderaan : WXY1234',
  'Tempoh Insurans : 01/07/2026 hingga 30/06/2027',
  'Jumlah Perlu Dibayar RM 1,234.56',
]);

test('rules alone fall short on an unfamiliar layout', () => {
  const r = extractWithRules(unfamiliar);
  assert.equal(r.principal, 'MSIG');
  assert.equal(r.fields.policy_no.value, null);
  assert.equal(r.fields.insured_name.value, null);
  assert.equal(r.fields.vehicle_no.value, null);
  assert.equal(r.fields.effective_date.value, '2026-07-01', 'the period is generic enough to read');
  assert.match(rulesFellShort(r, false) ?? '', /not read with confidence/);
});

test('what was saved teaches the labels, and two documents make them trusted', () => {
  const baseline = extractWithRules(unfamiliar);
  const alreadyRead = new Set(
    (['effective_date', 'expiry_date'] as const).filter((k) => baseline.fields[k].value !== null),
  );
  const taught = learnLabels(
    unfamiliar.lines,
    { policy_no: 'MS1234567', insured_name: 'LIM AH KOW', vehicle_no: 'WXY1234', total_payable: 1234.56 },
    alreadyRead,
  );
  assert.equal(taught.length, 4);

  const provisional: LearnedLabel[] = taught.map((t) => ({ ...t, insurer: 'MSIG', seen: 1 }));
  const once = extractWithRules(unfamiliar, () => provisional);
  assert.equal(once.fields.policy_no.value, 'MS1234567');
  assert.equal(once.fields.insured_name.value, 'LIM AH KOW');
  assert.equal(once.fields.vehicle_no.value, 'WXY1234');
  assert.equal(once.fields.total_payable.value, 1234.56);
  assert.equal(once.fields.policy_no.confidence, 0.75);
  assert.match(rulesFellShort(once, false) ?? '', /not read with confidence/, 'provisional: the model still checks');
  assert.match(once.notes.join(' '), /learned from/);

  const trusted = provisional.map((l) => ({ ...l, seen: 2 }));
  const twice = extractWithRules(unfamiliar, () => trusted);
  assert.equal(twice.fields.policy_no.confidence, 0.88);
  const short = rulesFellShort(twice, false);
  // Everything the register needs is read; what remains short is the count of
  // usual motor fields, which this small synthetic schedule does not carry.
  assert.ok(short === null || /usual fields/.test(short), short ?? 'gate satisfied');
});

test('the gate: a scan, an unknown insurer, and a missing essential each send for the model', () => {
  const r = extractWithRules(unfamiliar);
  assert.match(rulesFellShort(r, true) ?? '', /scan/);
  assert.match(rulesFellShort({ ...r, principal: null }, false) ?? '', /insurer/);
});
