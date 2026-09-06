'use client';

import { useId, useState } from 'react';

/**
 * A submit button that asks first.
 *
 * Six controls in the application settled money, destroyed a statement or
 * withdrew a client's access the instant they were pressed, with nothing to
 * say what was about to happen and no way back afterwards. This puts one
 * question between the press and the action, and puts the consequence in the
 * question — "settle RM 4,120 across 3 policies", not "are you sure?" — so the
 * person confirming knows what they are confirming.
 *
 * It renders a real submit button once opened, inside whatever form it sits
 * in, so the form's action runs exactly as it would have; `name` and `value`
 * ride along for forms that decide the operation by which button was pressed.
 */
export default function ConfirmSubmit({
  label,
  question,
  yes = 'Yes, go ahead',
  name,
  value,
  className = 'btn btn-ghost',
  disabled = false,
  danger = false,
  pendingLabel,
}: {
  label: React.ReactNode;
  /** What is about to happen, with the figures in it. */
  question: React.ReactNode;
  yes?: string;
  name?: string;
  value?: string;
  className?: string;
  disabled?: boolean;
  /** Paints the confirming button red for what cannot be undone. */
  danger?: boolean;
  pendingLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();

  if (!open) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className={className}
      >
        {label}
      </button>
    );
  }

  return (
    <span
      role="dialog"
      aria-labelledby={id}
      className={`inline-flex max-w-[560px] flex-wrap items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-[12.5px] leading-snug text-ink ${
        danger ? 'border-danger-line bg-danger-wash' : 'border-warn-line bg-warn-wash'
      }`}
    >
      <span id={id} className="min-w-0 flex-1 basis-[220px]">{question}</span>
      <span className="flex shrink-0 items-center gap-2">
        <button
          type="submit"
          name={name}
          value={value}
          className={`btn px-3 py-1 text-[12px] ${danger ? 'btn-danger' : 'btn-primary'}`}
        >
          {pendingLabel ?? yes}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="btn btn-ghost px-3 py-1 text-[12px]"
        >
          Cancel
        </button>
      </span>
    </span>
  );
}
