import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  closeSharedStore, contributeSharedLabels, forgetAgencyContributions, listSharedLabels,
  removeSharedLabel, restoreSharedLabel, sharedLibrary, sharedLibraryCounts, sharedStore,
} from '../src/lib/shared-labels';
import { learnedConfidence, mergeLabels, TRUST_ACROSS, TRUST_AFTER, type LearnedLabel, type SharedLabel } from '../src/lib/extract/learned';

/*
 * The library is a file beside the agencies; each test gets a fresh tenants
 * directory and the store's cache is dropped so it follows.
 */
function inLibrary(fn: (root: string) => void) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ih-library-'));
  const before = process.env.IH_TENANTS_DIR;
  process.env.IH_TENANTS_DIR = root;
  closeSharedStore();
  try {
    fn(root);
  } finally {
    closeSharedStore();
    if (before === undefined) delete process.env.IH_TENANTS_DIR;
    else process.env.IH_TENANTS_DIR = before;
    fs.rmSync(root, { recursive: true, force: true });
  }
}

const POLICY_NO = { key: 'policy_no' as const, label: 'Nombor Polisi', placement: 'same' as const };
const TOTAL = { key: 'total_payable' as const, label: 'Jumlah Perlu Dibayar', placement: 'same' as const };

test('without a tenants directory there is no library: nothing is listed and teaching goes nowhere', () => {
  const before = process.env.IH_TENANTS_DIR;
  delete process.env.IH_TENANTS_DIR;
  closeSharedStore();
  try {
    assert.equal(sharedStore(), null);
    assert.doesNotThrow(() => contributeSharedLabels('bs', 'MSIG', [POLICY_NO]));
    assert.deepEqual(listSharedLabels('MSIG'), []);
    assert.deepEqual(sharedLibrary(), []);
    assert.equal(forgetAgencyContributions('bs'), 0);
  } finally {
    if (before !== undefined) process.env.IH_TENANTS_DIR = before;
  }
});

test('one agency teaching a label makes it a suggestion for everyone; a second agency makes it trusted', () => {
  inLibrary((root) => {
    contributeSharedLabels('bs', 'MSIG', [POLICY_NO]);
    assert.ok(fs.existsSync(path.join(root, 'shared-labels.db')), 'the library is a file beside the agencies');

    let [l] = listSharedLabels('MSIG');
    assert.equal(l.agencies, 1);
    assert.equal(l.seen, 1);
    let [m] = mergeLabels([], listSharedLabels('MSIG'));
    assert.equal(m.shared, true);
    assert.equal(learnedConfidence(m), 0.75, 'one agency: provisional, the model still checks');

    // The same agency again: more documents, still one voice.
    contributeSharedLabels('bs', 'MSIG', [POLICY_NO]);
    [l] = listSharedLabels('MSIG');
    assert.equal(l.seen, 2);
    assert.equal(l.agencies, 1);
    [m] = mergeLabels([], listSharedLabels('MSIG'));
    assert.equal(learnedConfidence(m), 0.75, 'two documents at one agency do not make it trusted for the others');

    // A second agency agrees.
    contributeSharedLabels('exe', 'MSIG', [POLICY_NO]);
    [l] = listSharedLabels('MSIG');
    assert.equal(l.agencies, TRUST_ACROSS);
    [m] = mergeLabels([], listSharedLabels('MSIG'));
    assert.equal(m.seen, TRUST_AFTER);
    assert.equal(learnedConfidence(m), 0.88, 'two agencies: trusted like a rule');

    assert.deepEqual(listSharedLabels('LIBERTY'), [], 'a label is for its insurer only');
    assert.deepEqual(listSharedLabels(null), [], 'and an unrecognised insurer has its own shelf');
  });
});

test("an agency's own count is never lowered by the library, and is raised when the library trusts", () => {
  const own = (seen: number): LearnedLabel => ({ insurer: 'MSIG', ...POLICY_NO, seen });
  const shared = (agencies: number): SharedLabel => ({ insurer: 'MSIG', ...POLICY_NO, seen: agencies, agencies });

  let [m] = mergeLabels([own(2)], [shared(1)]);
  assert.equal(m.seen, 2, 'trusted at home stays trusted');
  assert.equal(m.shared, undefined, "and is still the agency's own");

  [m] = mergeLabels([own(1)], [shared(2)]);
  assert.equal(m.seen, TRUST_AFTER, 'provisional at home, confirmed by the library');
  assert.equal(m.shared, undefined);

  // Case does not make two labels of one.
  [m] = mergeLabels([own(1)], [{ ...shared(2), label: 'NOMBOR POLISI' }]);
  assert.equal(m.seen, TRUST_AFTER);
  assert.equal(mergeLabels([own(1)], [{ ...shared(2), label: 'NOMBOR POLISI' }]).length, 1);
});

test("trusted labels lead, and at the same standing the agency's own come before the library's", () => {
  const list = mergeLabels(
    [{ insurer: 'MSIG', key: 'policy_no', label: 'Own Provisional', placement: 'same', seen: 1 },
     { insurer: 'MSIG', key: 'policy_no', label: 'Own Trusted', placement: 'same', seen: 2 }],
    [{ insurer: 'MSIG', key: 'policy_no', label: 'Shared Trusted', placement: 'same', seen: 3, agencies: 2 },
     { insurer: 'MSIG', key: 'policy_no', label: 'Shared Provisional', placement: 'same', seen: 1, agencies: 1 }],
  );
  assert.deepEqual(list.map((l) => l.label), ['Own Trusted', 'Shared Trusted', 'Own Provisional', 'Shared Provisional']);
  assert.deepEqual(list.map((l) => l.shared ?? false), [false, true, false, true]);
});

test('a label the landlord removes is not served, is not revived by being taught again, and comes back on restore', () => {
  inLibrary(() => {
    contributeSharedLabels('bs', 'MSIG', [POLICY_NO, TOTAL]);
    contributeSharedLabels('exe', 'MSIG', [POLICY_NO]);
    const entry = sharedLibrary().find((l) => l.label === POLICY_NO.label)!;
    assert.deepEqual(entry.agencies, ['bs', 'exe']);
    assert.equal(entry.trusted, true);

    const was = removeSharedLabel(entry.id, 'The Landlord');
    assert.equal(was?.label, POLICY_NO.label);
    assert.deepEqual(listSharedLabels('MSIG').map((l) => l.label), [TOTAL.label], 'removed: not served');

    // A third agency teaches the same thing: still removed — the landlord's judgement stands.
    contributeSharedLabels('kl', 'MSIG', [POLICY_NO]);
    assert.deepEqual(listSharedLabels('MSIG').map((l) => l.label), [TOTAL.label]);
    const still = sharedLibrary().find((l) => l.id === entry.id)!;
    assert.ok(still.removedAt, 'kept in the library, marked');
    assert.deepEqual(still.agencies, ['bs', 'exe', 'kl'], 'and it goes on counting who teaches it');

    assert.deepEqual(sharedLibraryCounts(), { labels: 1, trusted: 0, insurers: 1, removed: 1 });

    assert.equal(restoreSharedLabel(entry.id)?.id, entry.id);
    const back = listSharedLabels('MSIG').find((l) => l.label === POLICY_NO.label)!;
    assert.equal(back.agencies, 3);
    assert.equal(removeSharedLabel('no-such-id', 'x'), null);
  });
});

test("a removed agency's teaching is forgotten, and a label only it taught goes with it", () => {
  inLibrary(() => {
    contributeSharedLabels('bs', 'MSIG', [POLICY_NO, TOTAL]);
    contributeSharedLabels('exe', 'MSIG', [POLICY_NO]);
    assert.equal(forgetAgencyContributions('bs'), 2);
    const left = sharedLibrary();
    assert.deepEqual(left.map((l) => [l.label, l.agencies]), [[POLICY_NO.label, ['exe']]]);
    assert.equal(left[0].trusted, false, 'one voice again');
    assert.equal(forgetAgencyContributions('nobody'), 0);
  });
});
