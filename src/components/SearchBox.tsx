'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { IconSearch } from './icons';

export default function SearchBox({
  name = 'q',
  placeholder,
  className = '',
}: {
  name?: string;
  placeholder: string;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [value, setValue] = useState(params.get(name) ?? '');
  const [, start] = useTransition();

  useEffect(() => {
    const id = setTimeout(() => {
      const current = params.get(name) ?? '';
      if (value === current) return;
      const sp = new URLSearchParams(params.toString());
      if (value) sp.set(name, value);
      else sp.delete(name);
      start(() => router.replace(`${pathname}?${sp.toString()}`));
    }, 280);
    return () => clearTimeout(id);
  }, [value, name, params, pathname, router]);

  return (
    <div className={`relative ${className}`}>
      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="inp pr-9"
        aria-label={placeholder}
      />
      <IconSearch className="pointer-events-none absolute right-2.5 top-1/2 h-[15px] w-[15px] -translate-y-1/2 text-muted" />
    </div>
  );
}
