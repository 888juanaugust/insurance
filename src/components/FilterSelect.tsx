'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';

export default function FilterSelect({
  name,
  value,
  options,
  label,
  className = '',
}: {
  name: string;
  value: string;
  options: { value: string; label: string }[];
  label?: string;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();

  function change(next: string) {
    const sp = new URLSearchParams(params.toString());
    if (next) sp.set(name, next);
    else sp.delete(name);
    start(() => router.push(`${pathname}?${sp.toString()}`));
  }

  return (
    <select
      aria-label={label ?? name}
      value={value}
      disabled={pending}
      onChange={(e) => change(e.target.value)}
      className={`inp cursor-pointer bg-surface ${className}`}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
