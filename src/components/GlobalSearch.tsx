'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { SearchHit } from '@/lib/search';

const KIND_TONE: Record<string, string> = {
  policy: 'bg-info-wash text-info',
  client: 'bg-ok-wash text-ok',
  claim: 'bg-warn-wash text-warn',
  endorsement: 'bg-info-wash text-info',
  agent: 'bg-sunken text-muted',
  document: 'bg-sunken text-muted',
};

const KIND_SHORT: Record<string, string> = {
  policy: 'policy', client: 'client', claim: 'claim',
  endorsement: 'endt', agent: 'agent', document: 'doc',
};

export default function GlobalSearch({ collapsed = false }: { collapsed?: boolean }) {
  const router = useRouter();
  const [term, setTerm] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Ctrl/Cmd+K from anywhere, the shortcut people already have in their hands.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  /*
   * Debounced, and every response carries the term it was for: replies can
   * arrive out of order, and a slow request for "wx" landing after a fast one
   * for "wxy4471" would replace the right answers with stale ones.
   */
  useEffect(() => {
    const q = term.trim();
    if (q.length < 2) {
      setHits([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: controller.signal });
        if (!res.ok) return;
        const data = (await res.json()) as { hits: SearchHit[] };
        setHits(data.hits ?? []);
        setActive(0);
        setOpen(true);
      } catch {
        /* aborted or offline — the box simply shows nothing */
      } finally {
        setLoading(false);
      }
    }, 180);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [term]);

  function go(hit: SearchHit) {
    setOpen(false);
    setTerm('');
    router.push(hit.href);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') { setOpen(false); inputRef.current?.blur(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((a) => Math.min(a + 1, hits.length - 1)); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); return; }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (open && hits[active]) go(hits[active]);
      else if (term.trim()) { setOpen(false); router.push(`/search?q=${encodeURIComponent(term.trim())}`); }
    }
  }

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => router.push('/search')}
        title="Search (Ctrl+K)"
        aria-label="Search"
        className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-sunken hover:text-ink"
      >
        <SearchGlyph />
      </button>
    );
  }

  return (
    <div ref={boxRef} className="relative mb-3 px-2">
      <div className="relative">
        <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted">
          <SearchGlyph />
        </span>
        <input
          ref={inputRef}
          type="search"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => hits.length && setOpen(true)}
          placeholder="Search"
          aria-label="Search everything"
          aria-expanded={open}
          aria-controls="search-results"
          role="combobox"
          className="w-full rounded-xl border border-line bg-canvas py-1.5 pl-8 pr-9 text-[13px] text-ink placeholder:text-muted focus:border-accent focus:bg-white focus:outline-none"
        />
        <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md border border-line bg-white px-1 py-0.5 text-[10px] font-medium text-muted">
          ⌘K
        </kbd>
      </div>

      {open && (
        <div
          id="search-results"
          role="listbox"
          className="absolute left-2 right-2 z-40 mt-1 max-h-[60vh] overflow-y-auto rounded border border-line bg-white shadow-lg"
        >
          {hits.length === 0 ? (
            <p className="px-3 py-3 text-[12.5px] text-muted">
              {loading ? 'Searching…' : `Nothing matches “${term.trim()}”.`}
            </p>
          ) : (
            <>
              {hits.map((hit, i) => (
                <button
                  key={`${hit.kind}-${hit.id}`}
                  type="button"
                  role="option"
                  aria-selected={i === active}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => go(hit)}
                  className={`block w-full border-b border-line px-3 py-2 text-left last:border-0 ${
                    i === active ? 'bg-[#f2f6fb]' : 'hover:bg-[#fafbfc]'
                  }`}
                >
                  <div className="flex items-baseline gap-2">
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${KIND_TONE[hit.kind] ?? ''}`}>
                      {KIND_SHORT[hit.kind] ?? hit.kind}
                    </span>
                    <span className="truncate text-[13px] font-semibold text-ink">{hit.title}</span>
                  </div>
                  <p className="mt-0.5 truncate text-[12px] text-muted">{hit.subtitle}</p>
                </button>
              ))}
              <button
                type="button"
                onClick={() => { setOpen(false); router.push(`/search?q=${encodeURIComponent(term.trim())}`); }}
                className="block w-full px-3 py-2 text-left text-[12px] font-medium text-accent hover:bg-[#fafbfc]"
              >
                See all results for “{term.trim()}”
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function SearchGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-[15px] w-[15px]">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" strokeLinecap="round" />
    </svg>
  );
}
