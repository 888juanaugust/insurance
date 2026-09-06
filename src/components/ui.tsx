import Link from 'next/link';

export function Help({ text }: { text: string }) {
  return (
    <span
      title={text}
      className="inline-flex h-[15px] w-[15px] shrink-0 cursor-help items-center justify-center rounded-full border border-line text-[10px] font-bold leading-none text-muted"
    >
      ?
    </span>
  );
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h2 className="sec-label mb-2.5">{children}</h2>;
}

export function PageHeader({
  title,
  subtitle,
  meta,
  actions,
}: {
  title: string;
  subtitle?: string;
  meta?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-[25px] font-semibold leading-tight tracking-tight text-ink">{title}</h1>
        {subtitle && <p className="mt-1 text-[13.5px] text-ink-soft">{subtitle}</p>}
        {meta && <p className="mt-1.5 text-[12.5px] text-muted">{meta}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2.5">{actions}</div>}
    </div>
  );
}

export function EmptyState({ label, hint }: { label: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <svg viewBox="0 0 64 48" className="mb-3 h-[52px] w-[68px]" aria-hidden="true">
        <path d="M6 18h13l4 7h18l4-7h13v22a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4Z" fill="var(--color-line-soft)" stroke="var(--color-line)" strokeWidth="1.5" />
        <path d="M13 18V7a3 3 0 0 1 3-3h32a3 3 0 0 1 3 3v11" fill="none" stroke="var(--color-line)" strokeWidth="1.5" />
      </svg>
      <p className="text-[13px] text-muted">{label}</p>
      {hint && <p className="mt-1 text-[12px] text-faint">{hint}</p>}
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: 'badge-green',
    quotation: 'badge-amber',
    expired: 'badge-grey',
    cancelled: 'badge-red',
    paid: 'badge-green',
    approved: 'badge-blue',
    pending: 'badge-amber',
    outstanding: 'badge-red',
    partial: 'badge-amber',
    'in force': 'badge-green',
    lapsed: 'badge-red',
    scheduled: 'badge-blue',
    sent: 'badge-green',
    draft: 'badge-grey',
    inactive: 'badge-grey',
  };
  const label = status.charAt(0).toUpperCase() + status.slice(1);
  return <span className={`badge ${map[status] ?? 'badge-grey'}`}>{label}</span>;
}

export function Crumb({ items }: { items: { href?: string; label: string }[] }) {
  return (
    <nav className="mb-3 flex flex-wrap items-center gap-1.5 text-[12.5px] text-muted">
      {items.map((it, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <span className="text-line">/</span>}
          {it.href ? (
            <Link href={it.href} className="text-link hover:underline">
              {it.label}
            </Link>
          ) : (
            <span className="text-ink-soft">{it.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
