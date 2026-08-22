import Link from 'next/link';
import { IconBell, IconMonitor, IconUser } from './icons';
import type { SessionUser } from '@/lib/session';

export default function Topbar({ user, unread }: { user: SessionUser; unread: number }) {
  return (
    <header className="flex h-[62px] shrink-0 items-center justify-end gap-4 border-b border-line bg-white px-6">
      <Link href="/user-guide" title="User guide" className="text-[#4a6fa5] hover:text-accent">
        <IconMonitor className="h-[21px] w-[21px]" />
      </Link>

      <Link href="/setting/notifications" title="Notifications" className="relative text-[#4a6fa5] hover:text-accent">
        <IconBell className="h-[20px] w-[20px]" />
        {unread > 0 && (
          <span className="absolute -right-2 -top-2 flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold text-white">
            {unread}
          </span>
        )}
      </Link>

      <Link href="/organisation" className="flex items-center gap-1.5 text-[13.5px] font-semibold text-[#2b6cb8] hover:underline">
        <IconUser className="h-[17px] w-[17px]" />
        {user.name}
      </Link>

      <span className="rounded bg-[#eef0f3] px-2 py-[3px] text-[12px] font-medium text-ink-soft">
        {user.role === 'master' ? 'agent' : user.role}
      </span>
    </header>
  );
}
