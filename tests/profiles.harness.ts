/**
 * Scores the document reader against real schedules.
 *
 * The schedules themselves are not in the repository — they carry real
 * names and NRIC numbers — so this reads whatever is in tests/samples/
 * (gitignored): one PDF per case and a truth.json beside them, shaped as
 *
 *   { "WQK100POLICY.pdf": { "policy_no": "JME1063847", "gross_premium": 1753.67, ... }, ... }
 *
 * A field named in the truth is scored exactly (money to the sen); a field
 * the truth sets to null must come back blank. The score is printed per
 * document and in total, and the process exits non-zero below 100%.
 *
 *   npm run harness
 */
import fs from 'node:fs';
import path from 'node:path';
import { extractPolicy } from '../src/lib/extract';

const DIR = path.join(process.cwd(), 'tests', 'samples');
const TRUTH = path.join(DIR, 'truth.json');

async function main() {
  if (!fs.existsSync(TRUTH)) {
    console.log(`No samples: put policy PDFs and a truth.json in ${DIR} to score the reader.`);
    return;
  }
  const truth = JSON.parse(fs.readFileSync(TRUTH, 'utf8')) as Record<string, Record<string, string | number | null>>;

  let scored = 0;
  let right = 0;
  for (const [file, expected] of Object.entries(truth)) {
    const pdf = path.join(DIR, file);
    if (!fs.existsSync(pdf)) {
      console.log(`  skip ${file} (not present)`);
      continue;
    }
    const result = await extractPolicy(new Uint8Array(fs.readFileSync(pdf)), { useClaude: false });
    let docRight = 0;
    const misses: string[] = [];
    for (const [key, want] of Object.entries(expected)) {
      scored++;
      const got = result.fields[key as keyof typeof result.fields]?.value ?? null;
      const ok =
        want === null
          ? got === null
          : typeof want === 'number' && typeof got === 'number'
            ? Math.abs(want - got) < 0.005
            : String(got) === String(want);
      if (ok) { right++; docRight++; } else misses.push(`${key}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);
    }
    console.log(`  ${file}: ${docRight}/${Object.keys(expected).length}${misses.length ? '\n    ' + misses.join('\n    ') : ''}`);
  }
  console.log(`\n${right}/${scored} fields`);
  if (right !== scored) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(2); });
