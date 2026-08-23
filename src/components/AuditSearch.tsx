'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition } from 'react';

/** Free-text search over the summary, actor, action and record label. */
export default function AuditSearch({ defaultValue = '' }: { defaultValue?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [value, setValue] = useState(defaultValue);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const sp = new URLSearchParams(params.toString());
    if (value.trim()) sp.set('q', value.trim());
    else sp.delete('q');
    // A new search starts at the first page, or page 4 of the old result set
    // comes back empty and reads as "nothing found".
    sp.delete('page');
    start(() => router.push(`${pathname}?${sp.toString()}`));
  }

  return (
    <form onSubmit={submit} className="contents">
      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={pending}
        placeholder="Search the trail"
        aria-label="Search the audit trail"
        className="inp h-8 w-56 text-[13px]"
      />
    </form>
  );
}
