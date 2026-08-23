import Link from 'next/link';
import { currentPortalClient } from '@/lib/portal-session';
import { portalSignOutAction } from '@/lib/portal-actions';
import { Logo } from '@/components/icons';

export const dynamic = 'force-dynamic';

/**
 * The portal's own shell. None of the agency's navigation appears here — a
 * client should not even be shown the names of the screens they cannot reach.
 */
export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const client = await currentPortalClient();
  const year = new Date().getFullYear();

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <header className="border-b border-line bg-nav">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-4 px-4 py-3.5 sm:px-6">
          <Link href="/portal" className="flex items-center gap-2.5">
            <Logo className="h-7 w-7" />
            <span className="text-[16px] font-semibold tracking-tight text-white">Insurhelp</span>
            <span className="rounded bg-nav-soft px-2 py-0.5 text-[11px] font-medium text-nav-text">
              client portal
            </span>
          </Link>
          {client && (
            <div className="ml-auto flex items-center gap-3">
              <span className="hidden text-[13px] text-nav-text sm:inline">{client.name}</span>
              <form action={portalSignOutAction}>
                <button type="submit" className="text-[13px] text-nav-text hover:text-white">
                  Sign out
                </button>
              </form>
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6 sm:px-6">{children}</main>

      <footer className="border-t border-line bg-white">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-2 px-4 py-3.5 text-[12.5px] text-muted sm:px-6">
          <span>© {year} Insurhelp</span>
          <span>Questions about your cover? Speak to your agency.</span>
        </div>
      </footer>
    </div>
  );
}
