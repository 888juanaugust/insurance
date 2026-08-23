import { redirect } from 'next/navigation';
import { currentPortalClient } from '@/lib/portal-session';
import PortalSignIn from '@/components/PortalSignIn';

export const dynamic = 'force-dynamic';

export default async function PortalLoginPage() {
  if (await currentPortalClient()) redirect('/portal');

  return (
    <div className="mx-auto max-w-md">
      <div className="panel px-6 py-7">
        <h1 className="text-[20px] font-semibold tracking-tight text-ink">Your insurance</h1>
        <p className="mt-1.5 text-[13.5px] text-ink-soft">
          See your policies, download your documents and ask for a renewal.
        </p>
        <PortalSignIn />
      </div>
      <p className="mt-4 px-1 text-[12.5px] text-muted">
        No access code? Your agency issues one — they will read it to you or hand it over in person.
        Codes are not sent by email.
      </p>
    </div>
  );
}
