'use client';

import { useState } from 'react';
import { markSentByHandAction, cancelMessageAction } from '@/lib/notice-actions';
import { CHANNEL_LABEL, type Channel } from '@/lib/messaging';

export type OutboxMessage = {
  id: string; channel: string; to_address: string | null; subject: string | null;
  body: string; status: string; error: string | null; delivered_by: string | null;
  scheduled_for: string | null; sent_at: string | null; attempts: number;
  client_name: string | null; policy_no: string | null; vehicle_no: string | null;
};

const TONE: Record<string, string> = {
  queued: 'badge-amber', sent: 'badge-green', failed: 'badge-red', cancelled: 'badge-grey',
};

export default function OutboxRow({ m }: { m: OutboxMessage }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(m.body);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard refused (no permission, insecure origin) — open the text so
      // it can be selected by hand rather than leaving nothing to do.
      setOpen(true);
    }
  }

  return (
    <li className="px-5 py-3.5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13.5px] font-semibold text-ink">
            {m.client_name ?? 'Unknown client'}
            <span className="ml-2 font-normal text-muted">{m.to_address}</span>
          </p>
          <p className="mt-0.5 text-[12.5px] text-ink-soft">
            {[m.policy_no, m.vehicle_no].filter(Boolean).join(' · ')}
            {m.subject && ` · ${m.subject}`}
          </p>
          {m.error && m.status !== 'sent' && (
            <p className="mt-1 text-[12px] text-warn">{m.error}</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="badge badge-blue">{CHANNEL_LABEL[m.channel as Channel] ?? m.channel}</span>
          <span className={`badge ${TONE[m.status] ?? 'badge-grey'}`}>{m.status}</span>
          {m.delivered_by && <span className="text-[11px] text-muted">{m.delivered_by}</span>}
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2.5 text-[12.5px]">
        <button type="button" onClick={() => setOpen((o) => !o)} className="text-link hover:underline">
          {open ? 'Hide message' : 'Read message'}
        </button>
        {m.status === 'queued' && (
          <>
            <button type="button" onClick={copy} className="text-link hover:underline">
              {copied ? 'Copied' : 'Copy text'}
            </button>
            <form action={markSentByHandAction}>
              <input type="hidden" name="message_id" value={m.id} />
              <button type="submit" className="text-link hover:underline">I sent this</button>
            </form>
            <form action={cancelMessageAction}>
              <input type="hidden" name="message_id" value={m.id} />
              <button type="submit" className="text-danger hover:underline">Cancel</button>
            </form>
          </>
        )}
      </div>

      {open && (
        <pre className="mt-2 whitespace-pre-wrap rounded border border-line bg-canvas px-4 py-3 text-[12.5px] leading-relaxed text-ink-soft">
          {m.body}
        </pre>
      )}
    </li>
  );
}
