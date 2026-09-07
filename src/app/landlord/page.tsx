import { redirect } from 'next/navigation';
import { agencySummaries } from '@/lib/landlord';
import { suspendAgencyAction, resumeAgencyAction } from '@/lib/landlord-actions';
import { PageHeader } from '@/components/ui';
import ConfirmSubmit from '@/components/Confirm';
import { longDate } from '@/lib/format';

export const dynamic = 'force-dynamic';

/*
 * The console has one screen: every agency on this server, what size it has
 * grown to, when anyone there was last signed in, and whether it is live.
 * Adding an agency stays a command on the server — an address that does not
 * exist must be a 404, never a form — and so does removing one.
 */

async function suspend(fd: FormData) {
  'use server';
  const r = await suspendAgencyAction(fd);
  redirect(`/landlord?note=${encodeURIComponent(r.message ?? r.error ?? '')}${r.error ? '&bad=1' : ''}`);
}

async function resume(fd: FormData) {
  'use server';
  const r = await resumeAgencyAction(fd);
  redirect(`/landlord?note=${encodeURIComponent(r.message ?? r.error ?? '')}${r.error ? '&bad=1' : ''}`);
}

const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

export default async function LandlordPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const note = typeof params.note === 'string' ? params.note : '';
  const bad = params.bad === '1';

  const agencies = agencySummaries();
  const live = agencies.filter((a) => !a.suspended).length;
  const policies = agencies.reduce((n, a) => n + a.policies, 0);
  const bytes = agencies.reduce((n, a) => n + a.bytes, 0);

  return (
    <div className="space-y-4">
      <div className="panel px-6 py-6">
        <PageHeader
          title="Agencies on this server"
          subtitle="Each one has its own database, its own documents and its own process. What is in their books is theirs; this shows the size and the pulse of each tenancy."
          meta={`${agencies.length} agenc${agencies.length === 1 ? 'y' : 'ies'} · ${live} live · ${policies} polic${policies === 1 ? 'y' : 'ies'} in all · ${mb(bytes)} on disk`}
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

        {agencies.length === 0 ? (
          <p className="mt-5 text-[13.5px] text-ink-soft">
            No agencies yet. Create the first one on the server:
            <code className="ml-1 rounded bg-sunken px-1.5 py-0.5 text-[12.5px]">npm run tenant -- create --slug … --name … --email … --password …</code>
          </p>
        ) : (
          <div className="scroll-x mt-5 rounded border border-line">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Agency</th>
                  <th>Address</th>
                  <th className="num">Policies</th>
                  <th className="num">Clients</th>
                  <th className="num">Users</th>
                  <th className="num">Documents</th>
                  <th className="num">On disk</th>
                  <th>Last signed in</th>
                  <th>Since</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {agencies.map((a) => (
                  <tr key={a.slug} className={a.suspended ? 'opacity-70' : ''}>
                    <td className="font-semibold text-ink">
                      {a.name}
                      <div className="text-[11.5px] font-normal text-muted">{a.slug}</div>
                      {a.problem && <div className="text-[11.5px] font-normal text-danger">could not read: {a.problem}</div>}
                    </td>
                    <td>
                      {a.address ? (
                        <a href={a.address} target="_blank" rel="noreferrer" className="text-link hover:underline">
                          {a.address.replace(/^https:\/\//, '')}
                        </a>
                      ) : (
                        <span className="text-muted">set IH_BASE_DOMAIN</span>
                      )}
                    </td>
                    <td className="num tabular-nums">{a.policies}</td>
                    <td className="num tabular-nums">{a.clients}</td>
                    <td className="num tabular-nums">{a.users}</td>
                    <td className="num tabular-nums">{a.documents}</td>
                    <td className="num tabular-nums">{mb(a.bytes)}</td>
                    <td>{a.lastSeen ? longDate(a.lastSeen.slice(0, 10)) : <span className="text-muted">never</span>}</td>
                    <td>{a.since ? longDate(a.since) : <span className="text-muted">—</span>}</td>
                    <td>
                      <span className={`badge ${a.suspended ? 'badge-red' : 'badge-green'}`}>
                        {a.suspended ? 'suspended' : 'live'}
                      </span>
                    </td>
                    <td>
                      {a.suspended ? (
                        <form action={resume}>
                          <input type="hidden" name="slug" value={a.slug} />
                          <button type="submit" className="text-link hover:underline">Resume</button>
                        </form>
                      ) : (
                        <form action={suspend}>
                          <input type="hidden" name="slug" value={a.slug} />
                          <ConfirmSubmit
                            label="Suspend"
                            className="text-link hover:underline"
                            danger
                            yes="Yes, suspend"
                            question={
                              <>
                                Suspend <strong>{a.name}</strong>? Everyone there is refused at sign-in from this
                                moment, and their address says the service is suspended. Nothing in their book is
                                touched, and you can resume at any time.
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
        )}

        <div className="mt-6 grid gap-4 text-[12.5px] text-muted sm:grid-cols-2">
          <p>
            <strong className="text-ink-soft">Adding an agency</strong> is done on the server, so that an address
            which does not exist is never an invitation:
            <code className="ml-1 block rounded bg-sunken px-2 py-1 text-[12px]">npm run tenant -- create --slug bs --name "BS Agency Sdn Bhd" --admin "Boon Seng" --email owner@bs.my --password '…'</code>
          </p>
          <p>
            <strong className="text-ink-soft">Removing one</strong> takes a final copy first and is also a command,
            never a button:
            <code className="ml-1 block rounded bg-sunken px-2 py-1 text-[12px]">npm run tenant -- remove bs --yes</code>
          </p>
        </div>
      </div>
    </div>
  );
}
