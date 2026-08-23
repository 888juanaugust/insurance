import { searchCandidates } from './queries';
import {
  readQuery, best, SCORE, type SearchHit, type SearchKind,
} from './search';
import { money, longDate, classSlug } from './format';
import { TYPE_LABEL as CLAIM_TYPE } from './claims';
import { TYPE_LABEL as END_TYPE } from './endorsements';
import { KIND_LABEL as DOC_KIND } from './document-kinds';

export type SearchResult = {
  hits: SearchHit[];
  byKind: Array<{ kind: SearchKind; hits: SearchHit[] }>;
  total: number;
  /** Set when the query resolves to exactly one obvious record. */
  jumpTo: SearchHit | null;
};

const ORDER: SearchKind[] = ['policy', 'client', 'claim', 'endorsement', 'agent', 'document'];

/**
 * Turns a typed string into ranked hits.
 *
 * The SQL has already narrowed to plausible rows; this decides what the person
 * meant. Ordering matters more than recall here — someone who types a plate
 * wants that vehicle first, not every remark containing those letters.
 */
export function runSearch(orgId: string, raw: string, limit = 50): SearchResult {
  const q = readQuery(raw);
  if (!q.raw) return { hits: [], byKind: [], total: 0, jumpTo: null };

  const c = searchCandidates(orgId, q.raw);
  const hits: SearchHit[] = [];

  for (const r of c.clients) {
    const { score, matched } = best(
      [
        ['NRIC', r.nric, 'identifier'],
        ['business registration', r.business_reg, 'identifier'],
        ['name', r.name, 'name'],
        ['phone', r.phone, 'identifier'],
        ['email', r.email, 'text'],
      ],
      q,
    );
    if (score) {
      hits.push({
        kind: 'client', id: r.id, score, matched,
        title: r.name,
        subtitle: r.nric || r.business_reg || (r.client_type === 'company' ? 'Company' : 'Individual'),
        meta: [r.phone, r.email].filter(Boolean).join(' · '),
        href: `/clients/${r.id}`,
      });
    }
  }

  for (const r of c.policies) {
    const { score, matched } = best(
      [
        ['policy number', r.policy_no, 'identifier'],
        ['vehicle', r.vehicle_no, 'identifier'],
        ['cover note', r.cover_note_no, 'identifier'],
        ['chassis', r.chassis_no, 'identifier'],
        ['engine', r.engine_no, 'identifier'],
        ['insured', r.client_name, 'name'],
        ['vehicle model', r.make_model, 'text'],
      ],
      q,
    );
    if (score) {
      hits.push({
        kind: 'policy', id: r.id, score, matched,
        title: r.policy_no,
        subtitle: [r.client_name, r.vehicle_no, r.make_model].filter(Boolean).join(' · '),
        meta: `${r.principal} · ${longDate(r.effective_date)} to ${longDate(r.expiry_date)} · ${money(r.total_premium)}`,
        href: `/insurance/${classSlug(r.class)}/${r.id}`,
      });
    }
  }

  for (const r of c.claims) {
    const { score, matched } = best(
      [
        ['claim number', r.claim_no, 'identifier'],
        ['insurer claim number', r.insurer_claim_no, 'identifier'],
        ['police report', r.police_report_no, 'identifier'],
        ['vehicle', r.vehicle_no, 'identifier'],
        ['insured', r.client_name, 'name'],
        ['description', r.description, 'text'],
      ],
      q,
    );
    if (score) {
      hits.push({
        kind: 'claim', id: r.id, score, matched,
        title: r.claim_no,
        subtitle: [CLAIM_TYPE[r.type] ?? r.type, r.client_name, r.vehicle_no].filter(Boolean).join(' · '),
        meta: `${r.policy_no} · incident ${longDate(r.incident_date)} · ${r.status}`,
        href: `/claims/${r.id}`,
      });
    }
  }

  for (const r of c.endorsements) {
    const { score, matched } = best(
      [
        ['endorsement number', r.endorsement_no, 'identifier'],
        ['insurer reference', r.insurer_ref, 'identifier'],
        ['insured', r.client_name, 'name'],
        ['description', r.description, 'text'],
      ],
      q,
    );
    if (score) {
      hits.push({
        kind: 'endorsement', id: r.id, score, matched,
        title: r.endorsement_no,
        subtitle: [END_TYPE[r.type] ?? r.type, r.client_name].filter(Boolean).join(' · '),
        meta: `${r.policy_no} · ${longDate(r.effective_date)}${r.total_amount ? ` · ${money(r.total_amount)}` : ''}`,
        href: `/endorsements/${r.id}`,
      });
    }
  }

  for (const r of c.agents) {
    const { score, matched } = best(
      [
        ['agent code', r.agent_code, 'identifier'],
        ['NRIC', r.nric, 'identifier'],
        ['name', r.name, 'name'],
        ['email', r.email, 'text'],
      ],
      q,
    );
    if (score) {
      hits.push({
        kind: 'agent', id: r.id, score, matched,
        title: r.name,
        subtitle: [r.agent_code, r.status].filter(Boolean).join(' · '),
        meta: [r.phone, r.email].filter(Boolean).join(' · '),
        href: `/team/${r.id}/edit`,
      });
    }
  }

  for (const r of c.documents) {
    const { score, matched } = best(
      [['filename', r.filename, 'name'], ['note', r.note, 'text']],
      q,
    );
    if (score) {
      hits.push({
        kind: 'document', id: r.id, score, matched,
        title: r.filename,
        subtitle: [DOC_KIND[r.kind ?? ''] ?? 'Document', r.policy_no].filter(Boolean).join(' · '),
        meta: `added ${r.uploaded_at}`,
        // The claim page when it belongs to one, otherwise the policy schedule.
        href: r.claim_id
          ? `/claims/${r.claim_id}`
          : r.policy_id
            ? `/insurance/${classSlug(r.class ?? 'motor')}/${r.policy_id}`
            : `/api/documents/${r.id}`,
      });
    }
  }

  hits.sort((a, b) => b.score - a.score || ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind)
    || a.title.localeCompare(b.title));

  const top = hits.slice(0, limit);

  const byKind = ORDER
    .map((kind) => ({ kind, hits: top.filter((h) => h.kind === kind) }))
    .filter((g) => g.hits.length);

  /*
   * One unambiguous answer means the person can be taken straight there — but
   * only on an identifier that belongs to a single record. A plate is shared:
   * it names the policy, every claim made under it and every endorsement, so
   * typing one legitimately has several exact matches and the right answer is
   * the list. A policy or claim number names exactly one thing.
   *
   * A name never jumps, however unique it looks today: being thrown onto the
   * wrong client is worse than one extra click.
   */
  const PRIMARY = new Set([
    'policy number', 'claim number', 'endorsement number', 'NRIC',
    'business registration', 'agent code',
  ]);
  const exact = hits.filter((h) => h.score >= SCORE.identifierExact && PRIMARY.has(h.matched));
  const jumpTo = exact.length === 1 ? exact[0] : null;

  return { hits: top, byKind, total: hits.length, jumpTo };
}
