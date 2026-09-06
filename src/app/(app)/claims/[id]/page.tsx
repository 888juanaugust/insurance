import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { currentUser } from '@/lib/session';
import { getClaim, listClaimDocuments } from '@/lib/queries';
import { money, longDate } from '@/lib/format';
import { Crumb, Help } from '@/components/ui';
import {
  CLAIM_STATUSES, TYPE_LABEL, STATUS_LABEL, FAULT_LABEL, isClosed,
} from '@/lib/claims';
import { setClaimStatusAction, deleteClaimAction } from '@/lib/claim-actions';
import DocumentsPanel from '@/components/DocumentsPanel';

export const dynamic = 'force-dynamic';

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="sec-label">{label}</dt>
      <dd className="mt-1 text-[13.5px] text-ink">{value || '—'}</dd>
    </div>
  );
}

/** One form per control — a submit button's name is not carried into a Server
 *  Action's FormData from a server component. */
function StageButton({ id, status, label, primary }: { id: string; status: string; label: string; primary?: boolean }) {
  return (
    <form action={setClaimStatusAction}>
      <input type="hidden" name="claim_id" value={id} />
      <input type="hidden" name="status" value={status} />
      <button type="submit" className={`btn ${primary ? 'btn-primary' : 'btn-ghost'}`}>{label}</button>
    </form>
  );
}

export default async function ClaimPage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ blocked?: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect('/login');

  const { id } = await params;
  const { blocked } = await searchParams;
  const claim = getClaim(id, user.org_id);
  if (!claim) notFound();

  const docs = listClaimDocuments(id, user.org_id);
  const slug = claim.class === 'non_motor' ? 'non-motor' : 'general-motor';
  const closed = isClosed(claim.status);

  // The stage after this one, so the common move is one click.
  const order: string[] = CLAIM_STATUSES.map((s) => s.value);
  const at = order.indexOf(claim.status);
  const next = !closed && at >= 0 && at < order.indexOf('settled') ? order[at + 1] : null;

  // Days between the incident and the police report: over one and the insurer
  // has grounds to decline.
  const reportGap =
    claim.incident_date && claim.police_report_date
      ? Math.round(
          (new Date(claim.police_report_date).getTime() - new Date(claim.incident_date).getTime()) / 86400000,
        )
      : null;

  return (
    <div className="space-y-4">
      <div className="panel px-6 py-6">
        <Crumb items={[{ href: '/claims', label: 'Claims' }, { label: claim.claim_no }]} />

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-[24px] font-semibold tracking-tight text-ink">{claim.claim_no}</h1>
            <p className="mt-1 text-[13.5px] text-ink-soft">
              {TYPE_LABEL[claim.type] ?? claim.type} ·{' '}
              <Link href={`/insurance/${slug}/${claim.policy_id}`} className="link-red">{claim.policy_no}</Link>
              {' · '}
              <Link href={`/clients/${claim.client_id}`} className="link-red">{claim.client_name}</Link>
              {claim.vehicle_no && ` · ${claim.vehicle_no}`}
            </p>
            <p className="mt-1.5 text-[12.5px] text-muted">
              Incident {longDate(claim.incident_date)}
              {claim.incident_time && ` at ${claim.incident_time}`}
              {claim.location && ` · ${claim.location}`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`badge ${closed ? (claim.status === 'settled' ? 'badge-green' : 'badge-grey') : 'badge-blue'}`}>
              {STATUS_LABEL[claim.status] ?? claim.status}
            </span>
            <span className="badge badge-blue">{claim.principal}</span>
            <Link href={`/claims/${claim.id}/edit`} className="btn btn-ghost">Edit</Link>
            {claim.status !== 'settled' && (
              <form action={deleteClaimAction}>
                <input type="hidden" name="claim_id" value={claim.id} />
                <button type="submit" className="btn btn-ghost text-danger">Delete</button>
              </form>
            )}
          </div>
        </div>

        {blocked === 'settled' && (
          <p role="alert" className="mt-4 rounded border border-danger-line bg-danger-wash px-4 py-3 text-[13px] text-danger">
            A settled claim cannot be deleted — the settlement is the record that money was paid.
          </p>
        )}

        {!closed && (
          <div className="mt-5 flex flex-wrap items-center gap-2.5 border-t border-line pt-4">
            <span className="text-[12.5px] text-muted">Move this claim on:</span>
            {next && <StageButton id={claim.id} status={next} label={STATUS_LABEL[next]} primary />}
            <StageButton id={claim.id} status="settled" label="Settle…" />
            <StageButton id={claim.id} status="rejected" label="Rejected…" />
            <StageButton id={claim.id} status="withdrawn" label="Withdrawn…" />
            <span className="text-[12px] text-muted">
              Closing a claim needs the figure or the reason, so those open the form.
            </span>
          </div>
        )}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="panel">
          <div className="panel-head">
            The incident
            <Help text="What the adjuster reads. Keep the insured's own account of it." />
          </div>
          <dl className="grid gap-5 px-6 py-5 sm:grid-cols-2">
            <Field label="Date and time" value={`${longDate(claim.incident_date)}${claim.incident_time ? ` · ${claim.incident_time}` : ''}`} />
            <Field label="Where" value={claim.location} />
            <Field label="Fault" value={claim.fault ? FAULT_LABEL[claim.fault] : 'Not established'} />
            <Field label="Driver at the time" value={claim.driver_name} />
            <Field label="Driver NRIC" value={claim.driver_nric} />
            <Field label="Licence" value={claim.driver_licence} />
            <div className="sm:col-span-2">
              <dt className="sec-label">What happened</dt>
              <dd className="mt-1 whitespace-pre-line text-[13.5px] text-ink">{claim.description || '—'}</dd>
            </div>
          </dl>

          <div className="border-t border-line px-6 py-5">
            <p className="sec-label mb-3">Police report</p>
            <dl className="grid gap-5 sm:grid-cols-2">
              <Field label="Report no" value={claim.police_report_no} />
              <Field label="Report date" value={longDate(claim.police_report_date)} />
              <Field label="Station" value={claim.police_station} />
            </dl>
            {!claim.police_report_no ? (
              <p className="mt-3 rounded border border-warn-line bg-warn-wash px-4 py-2.5 text-[12.5px] text-warn">
                No police report recorded. Every Malaysian motor policy requires one within 24 hours of
                the incident — chase it before the insurer asks.
              </p>
            ) : reportGap !== null && reportGap > 1 ? (
              <p className="mt-3 rounded border border-warn-line bg-warn-wash px-4 py-2.5 text-[12.5px] text-warn">
                The report was made {reportGap} days after the incident. Beyond 24 hours the insurer can
                decline — have the insured's explanation ready.
              </p>
            ) : null}
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">Money</div>
          <dl className="grid gap-5 px-6 py-5 sm:grid-cols-2">
            <Field label="Repair estimate" value={claim.estimate_amount ? money(claim.estimate_amount) : '—'} />
            <Field label="Approved by insurer" value={claim.approved_amount ? money(claim.approved_amount) : '—'} />
            <Field label="Settled" value={claim.settled_amount ? money(claim.settled_amount) : '—'} />
            <Field label="Excess borne by the insured" value={claim.excess_borne ? money(claim.excess_borne) : '—'} />
          </dl>

          <div className="border-t border-line px-6 py-5">
            <p className="sec-label mb-3">Consequence at renewal</p>
            {claim.affects_ncd === 1 ? (
              <p className="text-[13px] text-ink-soft">
                This claim <strong className="text-ink">resets the no-claim discount</strong>. The insured
                currently earns {claim.ncd_pct}%
                {claim.ncd_pct > 0 && claim.gross_premium
                  ? ` — worth about ${money(Math.round(((claim.gross_premium as number) / (1 - claim.ncd_pct / 100)) * (claim.ncd_pct / 100) * 100) / 100)} a year`
                  : ''}
                , and will start again from zero at the next renewal.
              </p>
            ) : (
              <p className="text-[13px] text-ink-soft">
                The no-claim discount is <strong className="text-ink">not affected</strong>
                {claim.type === 'windscreen'
                  ? ' — a windscreen claim under the windscreen extension leaves it intact.'
                  : claim.fault === 'third_party'
                    ? ' — the third party was at fault, so nothing is claimed off this policy.'
                    : '.'}
              </p>
            )}
          </div>

          <div className="border-t border-line px-6 py-5">
            <p className="sec-label mb-3">Repair and survey</p>
            <dl className="grid gap-5 sm:grid-cols-2">
              <Field
                label="Workshop"
                value={
                  claim.workshop ? (
                    <>
                      {claim.workshop}
                      <span className={`ml-2 badge ${claim.workshop_panel === 1 ? 'badge-green' : 'badge-amber'}`}>
                        {claim.workshop_panel === 1 ? 'panel' : 'not panel'}
                      </span>
                    </>
                  ) : null
                }
              />
              <Field label="Adjuster" value={claim.adjuster} />
              <Field label="Survey date" value={longDate(claim.survey_date)} />
            </dl>
            {claim.workshop && claim.workshop_panel === 0 && (
              <p className="mt-3 text-[12.5px] text-muted">
                Off-panel repairs are reimbursed rather than paid direct, and betterment on replaced parts
                is charged to the insured. Say so before the car goes in.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">Progress</div>
        <dl className="grid gap-5 px-6 py-5 sm:grid-cols-2 xl:grid-cols-4">
          <Field label="Notified to us" value={longDate(claim.notified_date)} />
          <Field label="Submitted to insurer" value={longDate(claim.submitted_date)} />
          <Field label="Settled on" value={longDate(claim.settled_date)} />
          <Field label="Insurer claim no" value={claim.insurer_claim_no} />
          {claim.closed_reason && (
            <div className="sm:col-span-2 xl:col-span-4">
              <dt className="sec-label">Closing reason</dt>
              <dd className="mt-1 text-[13.5px] text-ink">{claim.closed_reason}</dd>
            </div>
          )}
          {claim.remarks && (
            <div className="sm:col-span-2 xl:col-span-4">
              <dt className="sec-label">Remarks</dt>
              <dd className="mt-1 whitespace-pre-line text-[13.5px] text-ink">{claim.remarks}</dd>
            </div>
          )}
        </dl>
      </div>

      <DocumentsPanel
        owner="claim"
        ownerId={claim.id}
        ownerLabel={claim.claim_no}
        emptyHint="Attach the police report, the claim form, the photographs and the repair quotation — the insurer will ask for all four."
        docs={docs.map((d) => ({
          id: d.id, filename: d.filename, byte_size: d.byte_size, content_type: d.content_type,
          kind: d.kind, note: d.note, uploaded_at: d.uploaded_at,
          uploaded_by_name: d.uploaded_by_name, page_count: d.page_count, used_claude: d.used_claude,
        }))}
        back={`/claims/${claim.id}`}
      />
    </div>
  );
}
