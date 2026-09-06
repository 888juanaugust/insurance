import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/session';
import { claudeAvailable } from '@/lib/extract';
import { PageHeader } from '@/components/ui';
import { IconUpload, IconClipboard, IconCar, IconFire } from '@/components/icons';

export const dynamic = 'force-dynamic';

/**
 * Two ways in, given equal standing.
 *
 * Uploading the schedule is the quick way when there is one. But a cover note
 * phoned through, a policy from an insurer the reader has never seen, or a
 * scan with no key configured all end the same way — somebody types it. That
 * was always possible, buried on the upload screen; here it is a door of its
 * own, so an agent with a form in one hand and the phone in the other is not
 * made to start with a file they do not have.
 */
export default async function AddPolicyPage() {
  const user = await currentUser();
  if (!user) redirect('/login');

  const reads = claudeAvailable();

  const Door = ({
    href, icon, title, note,
  }: { href: string; icon: React.ReactNode; title: string; note: string }) => (
    <Link
      href={href}
      className="flex items-start gap-3 rounded-xl border border-line bg-surface px-4 py-3.5 hover:border-brand hover:bg-brand-wash"
    >
      <span className="mt-0.5 shrink-0 text-ink-soft">{icon}</span>
      <span className="min-w-0">
        <span className="block text-[13.5px] font-semibold text-ink">{title}</span>
        <span className="mt-0.5 block text-[12.5px] text-ink-soft">{note}</span>
      </span>
    </Link>
  );

  return (
    <div className="space-y-4">
      <div className="panel px-6 py-6">
        <PageHeader
          title="Add a policy"
          subtitle="From the document the insurer issued, or typed in by hand. Either way nothing is saved until you have seen it."
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="panel">
          <div className="panel-head">
            <IconUpload className="h-[17px] w-[17px] text-brand" />
            Upload the schedule
          </div>
          <p className="border-b border-line px-5 py-3 text-[12.5px] text-ink-soft">
            The PDF is read and the form filled in for you to check. Liberty, Lonpac and Allianz
            schedules are read field for field
            {reads
              ? '; other layouts are read by the model as well.'
              : '; other layouts come through with blanks to fill.'}
          </p>
          <div className="grid gap-3 p-5 sm:grid-cols-2">
            <Door
              href="/insurance/general-motor/upload"
              icon={<IconCar className="h-[18px] w-[18px]" />}
              title="Motor"
              note="Private car, commercial, motorcycle"
            />
            <Door
              href="/insurance/non-motor/upload"
              icon={<IconFire className="h-[18px] w-[18px]" />}
              title="Non-motor"
              note="Fire, PA, medical, liability"
            />
            <div className="sm:col-span-2">
              <Door
                href="/insurance/general-motor/upload?bulk=1"
                icon={<IconUpload className="h-[18px] w-[18px]" />}
                title="A whole stack at once"
                note="Read up to forty schedules in one sitting and add the clean ones together"
              />
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <IconClipboard className="h-[17px] w-[17px] text-brand" />
            Key it in by hand
          </div>
          <p className="border-b border-line px-5 py-3 text-[12.5px] text-ink-soft">
            No document, a cover note read over the phone, or an insurer the reader does not know.
            The premium arithmetic is worked out as you type.
          </p>
          <div className="grid gap-3 p-5 sm:grid-cols-2">
            <Door
              href="/insurance/general-motor/new"
              icon={<IconCar className="h-[18px] w-[18px]" />}
              title="Motor"
              note="Vehicle particulars, NCD, extensions"
            />
            <Door
              href="/insurance/non-motor/new"
              icon={<IconFire className="h-[18px] w-[18px]" />}
              title="Non-motor"
              note="Risk address, occupancy, benefits"
            />
          </div>
        </section>
      </div>
    </div>
  );
}
