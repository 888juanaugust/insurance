import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import type { PdfDoc } from './pdf';
import { FIELD_KEYS, type FieldKey } from './types';

/**
 * Rule-based extraction only reaches formats we have patterns for. Insurers
 * that print labels and values in separate columns — or issue scanned
 * documents with no text layer at all — need a reader that understands the
 * page rather than the string. This is that reader; it is optional, and the
 * pipeline degrades to rules plus manual review when no credentials are set.
 */

const PolicySchema = z.object({
  policy_no: z.string().nullable(),
  cover_note_no: z.string().nullable(),
  issue_date: z.string().nullable(),
  effective_date: z.string().nullable(),
  expiry_date: z.string().nullable(),
  insured_name: z.string().nullable(),
  nric: z.string().nullable(),
  address: z.string().nullable(),
  occupation: z.string().nullable(),
  vehicle_no: z.string().nullable(),
  make_model: z.string().nullable(),
  body_type: z.string().nullable(),
  engine_no: z.string().nullable(),
  chassis_no: z.string().nullable(),
  engine_cc: z.number().nullable(),
  year_make: z.number().nullable(),
  seating: z.number().nullable(),
  hire_purchase: z.string().nullable(),
  named_drivers: z.string().nullable(),
  sum_insured: z.number().nullable(),
  ncd_pct: z.number().nullable(),
  excess: z.number().nullable(),
  windscreen_si: z.number().nullable(),
  basic_premium: z.number().nullable(),
  gross_premium: z.number().nullable(),
  service_tax: z.number().nullable(),
  stamp_duty: z.number().nullable(),
  total_payable: z.number().nullable(),
  type_of_cover: z.string().nullable(),
  product: z.string().nullable(),
  principal: z.string().nullable(),
  cls: z.enum(['motor', 'non_motor']).nullable(),
});

export type ClaudePolicy = z.infer<typeof PolicySchema>;

const SYSTEM = `You read Malaysian general-insurance documents — motor policy schedules, cover notes, certificates of insurance, and non-motor schedules — and return the data they contain.

These documents are bilingual (English and Bahasa Malaysia) and every insurer lays them out differently. Labels are often printed in a separate column from their values, so match on meaning, not position.

Rules:
- Return exactly what the document states. Never invent, guess, or carry a value over from a similar document.
- Any field the document does not state must be null.
- Dates: return ISO yyyy-mm-dd. Malaysian documents write dd/mm/yyyy or dd-mm-yyyy — the day comes first.
- Money and numbers: return a plain number with no currency symbol, thousands separator, or percent sign.
- effective_date and expiry_date are the start and end of the period of insurance ("Period of Insurance" / "Tempoh Insurans", or "from ... to ..."). issue_date is when the document was issued.
- gross_premium is the premium after any no-claim discount and including extra covers, before service tax and stamp duty. total_payable is the final amount due, including tax and stamp duty.
- ncd_pct is the no-claim discount percentage (NCD / NCB / Diskaun Tanpa Tuntutan) as a number, e.g. 55 for 55%.
- nric is the Malaysian identity number (formatted 000000-00-0000) for an individual, or the business registration number for a company.
- type_of_cover is the scope of cover, e.g. "Comprehensive", "Comprehensive Plus", "Third Party, Fire and Theft", "Act Only". Do not take this from legal boilerplate that merely mentions third-party risks — use the stated type of cover for this policy.
- principal is the insurer that issued the document, as a short recognisable name, e.g. LIBERTY, LONPAC, ALLIANZ, MSIG, TOKIO, ETIQA, ZURICH, GENERALI, RHB, BERJAYA SOMPO.
- cls is "motor" for any vehicle policy, "non_motor" for everything else.`;

/** A document with no meaningful text layer is a scan — send the pages as images. */
const TEXT_LAYER_MIN_CHARS = 400;
const DOCUMENT_MODE_MAX_PAGES = 10;

export type ClaudeOutcome =
  | { ok: true; data: ClaudePolicy; model: string; mode: 'text' | 'document' }
  | { ok: false; error: string };

export function claudeAvailable(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

/**
 * How hard the model thinks about a schedule. Extraction is bounded work —
 * the fields are named, the document is short — and `medium` reads it well
 * at a fraction of what `high` spends on thinking tokens. IH_EXTRACT_EFFORT
 * raises or lowers it.
 */
const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'] as const;
type Effort = (typeof EFFORTS)[number];

export function extractEffort(): Effort {
  const v = (process.env.IH_EXTRACT_EFFORT ?? '').trim().toLowerCase() as Effort;
  return EFFORTS.includes(v) ? v : 'medium';
}

/** The models that accept a server-side refusal fallback. */
const FALLBACK_MODELS = /^claude-(opus-5|fable-5)/;

export async function extractWithClaude(doc: PdfDoc, pdfBytes: Uint8Array): Promise<ClaudeOutcome> {
  if (!claudeAvailable()) {
    return { ok: false, error: 'No Anthropic credentials configured (set ANTHROPIC_API_KEY).' };
  }

  const client = new Anthropic();
  const model = process.env.IH_EXTRACT_MODEL ?? 'claude-opus-5';

  // The schedule always sits in the opening pages; the rest is policy wording.
  const head = doc.pages.slice(0, 5).flat().join('\n');
  const useDocument = head.trim().length < TEXT_LAYER_MIN_CHARS;

  // A scan is sent as the whole file, page images and all. Past ten pages
  // that is a large paid request for a document that is almost certainly not
  // a schedule, and there is no metering on this path other than this.
  if (useDocument && doc.pageCount > DOCUMENT_MODE_MAX_PAGES) {
    return {
      ok: false,
      error: `This scan is ${doc.pageCount} pages; scans of more than ${DOCUMENT_MODE_MAX_PAGES} are not sent to the model. Key the policy in by hand.`,
    };
  }

  const content: Anthropic.Beta.BetaContentBlockParam[] = useDocument
    ? [
        {
          type: 'document',
          source: {
            type: 'base64',
            media_type: 'application/pdf',
            data: Buffer.from(pdfBytes).toString('base64'),
          },
        },
        { type: 'text', text: 'Extract the policy data from this insurance document.' },
      ]
    : [
        {
          type: 'text',
          text:
            'Extract the policy data from this insurance document. The text below preserves the ' +
            'visual line layout of the original pages.\n\n' +
            '<document>\n' + head + '\n</document>',
        },
      ];

  try {
    /*
     * A schedule is full of names and identity numbers, and a safety
     * classifier can decline such a request on sight. With `fallbacks` the
     * API re-runs a declined request on another model inside the same call,
     * so a decline becomes a read rather than a blank form. Only the models
     * that accept the parameter get it; an override to an older model does
     * not have the request rejected for it.
     */
    const fallbackable = FALLBACK_MODELS.test(model);
    const response = await client.beta.messages.parse({
      model,
      max_tokens: 16000,
      system: SYSTEM,
      messages: [{ role: 'user', content }],
      output_config: { format: betaZodOutputFormat(PolicySchema), effort: extractEffort() },
      ...(fallbackable ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {}),
    });

    if (response.stop_reason === 'refusal') {
      return { ok: false, error: 'The extraction request was declined.' };
    }
    if (!response.parsed_output) {
      return { ok: false, error: 'The model did not return a parseable result.' };
    }
    return { ok: true, data: response.parsed_output, model: response.model, mode: useDocument ? 'document' : 'text' };
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      return { ok: false, error: 'Anthropic credentials were rejected.' };
    }
    if (error instanceof Anthropic.RateLimitError) {
      return { ok: false, error: 'Rate limited by the Anthropic API — try again shortly.' };
    }
    if (error instanceof Anthropic.APIError) {
      return { ok: false, error: `Anthropic API error ${error.status}: ${error.message}` };
    }
    return { ok: false, error: error instanceof Error ? error.message : 'Extraction failed.' };
  }
}

export const CLAUDE_FIELD_KEYS: FieldKey[] = [...FIELD_KEYS];
