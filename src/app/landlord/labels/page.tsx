import { redirect } from 'next/navigation';
import { sharedLibrary, sharedLibraryCounts, type LibraryEntry } from '@/lib/shared-labels';
import { removeSharedLabelAction, restoreSharedLabelAction } from '@/lib/landlord-actions';
import { fieldName } from '@/lib/extract/field-names';
import { TRUST_ACROSS } from '@/lib/extract/learned';
import { PageHeader } from '@/components/ui';
import ConfirmSubmit from '@/components/Confirm';
import { longDate } from '@/lib/format';

export const dynamic = 'force-dynamic';

/*
 * What the reader has learned from every agency on the server, pooled — and
 * the landlord's one power over it: to take a label out. Adding is done by
 * agencies saving policies, never by hand here; a label typed in by nobody's
 * document would be a guess dressed as knowledge.
 */

async function remove(fd: FormData) {
  'use server';
  const r = await removeSharedLabelAction(fd);
  redirect(`/landlord/labels?note=${encodeURIComponent(r.message ?? r.error ?? '')}${r.error ? '&bad=1' : ''}`);
}

async function restore(fd: FormData) {
  'use server';
  const r = await restoreSharedLabelAction(fd);
  redirect(`/landlord/labels?note=${encodeURIComponent(r.message ?? r.error ?? '')}${r.error ? '&bad=1' : ''}`);
}

const insurerName = (short: string) => (short === 'UNKNOWN' ? 'Insurer not recognised' : short);

function Status({ l }: { l: LibraryEntry }) {
  if (l.removedAt) return <span className="badge badge-grey">removed</span>;
  if (l.trusted) return <span className="badge badge-green">trusted</span>;
  return <span className="badge badge-amber">suggestion</span>;
}

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const note = typeof params.note === 'string' ? params.note : '';
  const bad = params.bad === '1';

  const entries = sharedLibrary();
  const counts = sharedLibraryCounts();
  const byInsurer = new Map<string, LibraryEntry[]>();
  for (const e of entries) byInsurer.set(e.insurer, [...(byInsurer.get(e.insurer) ?? []), e]);

  return (
    <div className="space-y-4">
      <div className="panel px-6 py-6">
        <PageHeader
          title="Reader library"
          subtitle="Every label an agency's saved schedule has taught the document reader, pooled for all of them. A new agency reads the insurers the others already taught from its first upload."
          meta={`${counts.labels} label${counts.labels === 1 ? '' : 's'} across ${counts.insurers} insurer${counts.insurers === 1 ? '' : 's'} · ${counts.trusted} trusted${counts.removed ? ` · ${counts.removed} removed` : ''}`}
        />

        {note && (
          <p
            role={bad ? 'alert' : 'status'}
            className={`mt-4 rounded border px-4 py-3 text-[13px] ${
              bad ? 'border-danger-line bg-danger-wash text-danger' : 'border-ok-line bg-ok-wash text-ok'
            }`}
          >
            {note}
          </p>
        )}

        {entries.length === 0 ? (
          <p className="mt-5 text-[13.5px] text-ink-soft">
            Nothing yet. The library fills itself: each time someone at any agency saves a policy from a schedule the
            rules could not fully read, the labels beside the values they kept are recorded here.
          </p>
        ) : (
          [...byInsurer.entries()].map(([insurer, rows]) => (
            <section key={insurer} className="mt-6">
              <h2 className="mb-2 text-[15px] font-semibold text-ink">
                {insurerName(insurer)}
                <span className="ml-2 text-[12.5px] font-normal text-muted">
                  {rows.filter((r) => !r.removedAt).length} label{rows.filter((r) => !r.removedAt).length === 1 ? '' : 's'}
                </span>
              </h2>
              <div className="scroll-x rounded border border-line">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Field</th>
                      <th>Printed label</th>
                      <th>Value sits</th>
                      <th className="num">Documents</th>
                      <th>Taught by</th>
                      <th>Last taught</th>
                      <th>Standing</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((l) => (
                      <tr key={l.id} className={l.removedAt ? 'opacity-60' : ''}>
                        <td className="font-semibold text-ink">{fieldName(l.key)}</td>
                        <td className="font-mono text-[12.5px]">{l.label}</td>
                        <td className="text-ink-soft">{l.placement === 'same' ? 'beside it' : 'under it'}</td>
                        <td className="num tabular-nums">{l.seen}</td>
                        <td className="text-ink-soft">{l.agencies.join(', ')}</td>
                        <td>{longDate(l.lastSeen.slice(0, 10))}</td>
                        <td><Status l={l} /></td>
                        <td>
                          {l.removedAt ? (
                            <form action={restore}>
                              <input type="hidden" name="id" value={l.id} />
                              <button type="submit" className="text-link hover:underline">Restore</button>
                            </form>
                          ) : (
                            <form action={remove}>
                              <input type="hidden" name="id" value={l.id} />
                              <ConfirmSubmit
                                label="Remove"
                                className="text-link hover:underline"
                                danger
                                yes="Yes, remove"
                                question={
                                  <>
                                    Stop reading <strong>{l.label}</strong> as {fieldName(l.key)} on {insurerName(insurer)}{' '}
                                    schedules, everywhere on this server? It was taught by {l.agencies.join(' and ')}. Their own
                                    learning is not touched, and teaching it again will not bring it back; you can restore it here.
                                  </>
                                }
                              />
                            </form>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))
        )}

        <div className="mt-6 grid gap-4 text-[12.5px] text-muted sm:grid-cols-2">
          <p>
            <strong className="text-ink-soft">A suggestion becomes trusted</strong> when {TRUST_ACROSS} different agencies
            have taught the same label from their own documents. Until then the reader uses it but the model still
            checks the result, so one agency's wrong correction is never read as a fact by another.
          </p>
          <p>
            <strong className="text-ink-soft">What is here is labels only</strong> — the words printed beside a value,
            such as <span className="font-mono">No. Sijil Insurans</span>. No client, policy number or premium from
            anyone's book is in this library.
          </p>
        </div>
      </div>
    </div>
  );
}
