'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { saveClientAction, type ClientFormState } from '@/lib/client-actions';

/** The 13 states and 3 federal territories, as they appear on an NRIC address. */
const STATES = [
  'Johor', 'Kedah', 'Kelantan', 'Melaka', 'Negeri Sembilan', 'Pahang', 'Perak', 'Perlis',
  'Pulau Pinang', 'Sabah', 'Sarawak', 'Selangor', 'Terengganu',
  'Wilayah Persekutuan Kuala Lumpur', 'Wilayah Persekutuan Labuan', 'Wilayah Persekutuan Putrajaya',
];

export type ClientFormProps = {
  mode: 'create' | 'edit';
  groups: Array<{ id: string; name: string }>;
  initial: Record<string, string | number | null>;
  policyCount?: number;
};


type FieldProps = {
  name: string;
  label: string;
  type?: string;
  span?: number;
  required?: boolean;
  placeholder?: string;
  hint?: string;
  maxLength?: number;
  error?: string;
  /** Omit for an uncontrolled field carrying defaultValue. */
  value?: string;
  defaultValue?: string;
  onChange?: (v: string) => void;
};

function Field({
  name, label, type = 'text', span = 1, required, placeholder, hint, maxLength,
  error, value, defaultValue, onChange,
}: FieldProps) {
  const controlled = value !== undefined;
  return (
    <div className={span === 2 ? 'sm:col-span-2' : ''}>
      <label htmlFor={name} className="mb-1 block text-[12px] font-semibold text-ink-soft">
        {label}
        {required && <span className="ml-0.5 text-brand">*</span>}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        maxLength={maxLength}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${name}-error` : hint ? `${name}-hint` : undefined}
        className={`inp ${error ? 'border-brand' : ''}`}
        {...(controlled
          ? { value, onChange: (e) => onChange?.(e.target.value) }
          : { key: `${name}-${defaultValue ?? ''}`, defaultValue })}
      />
      {error ? (
        <p id={`${name}-error`} className="mt-1 text-[12px] font-medium text-brand">{error}</p>
      ) : hint ? (
        <p id={`${name}-hint`} className="mt-1 text-[12px] text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="panel">
      <div className="panel-head">{title}</div>
      <div className="grid gap-4 px-5 py-5 sm:grid-cols-2 xl:grid-cols-4">{children}</div>
    </section>
  );
}

export default function ClientForm({ mode, groups, initial, policyCount = 0 }: ClientFormProps) {
  const [state, action, pending] = useActionState(saveClientAction, null as ClientFormState | null);
  const [type, setType] = useState<'individual' | 'company'>(
    initial.client_type === 'company' ? 'company' : 'individual',
  );
  const [restoredType, setRestoredType] = useState<string | null>(null);

  // A rejected submission echoes back which type was chosen.
  const echoedType = state?.values?.client_type;
  if (echoedType && echoedType !== restoredType) {
    setRestoredType(echoedType);
    if (echoedType !== type) setType(echoedType === 'company' ? 'company' : 'individual');
  }
  const [nric, setNric] = useState(String(initial.nric ?? ''));
  const [dob, setDob] = useState(String(initial.dob ?? ''));

  /** Echoed submission wins, so a validation error does not empty the form. */
  const v = (k: string) => {
    const echoed = state?.values?.[k];
    if (echoed !== undefined) return echoed;
    return initial[k] === null || initial[k] === undefined ? '' : String(initial[k]);
  };
  const errorFor = (field: string) => (state?.field === field ? state.error : undefined);

  /** Typing a full NRIC fills the date of birth, which it already contains. */
  function onNricChange(next: string) {
    setNric(next);
    const digits = next.replace(/[^0-9]/g, '');
    if (digits.length !== 12) return;

    const yy = Number(digits.slice(0, 2));
    const mm = Number(digits.slice(2, 4));
    const dd = Number(digits.slice(4, 6));
    if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return;

    const iso = (y: number) => `${y}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
    const todayIso = new Date().toISOString().slice(0, 10);
    const guess = iso(2000 + yy) > todayIso ? iso(1900 + yy) : iso(2000 + yy);

    const d = new Date(`${guess}T00:00:00Z`);
    if (!Number.isNaN(d.getTime()) && d.getUTCDate() === dd) setDob(guess);
  }

  return (
    <form action={action} className="space-y-4">
      {mode === 'edit' && <input type="hidden" name="client_id" value={v('client_id')} />}

      <Section title="Who this is">
        <div className="sm:col-span-2 xl:col-span-4">
          <span id="client-type-label" className="mb-1.5 block text-[12px] font-semibold text-ink-soft">
            Client type
          </span>
          {/*
            Buttons plus a hidden input rather than radio inputs: React resets
            the form after a server action, which leaves a controlled radio's
            DOM state out of step with React's, and the wrong value posts.
          */}
          <input type="hidden" name="client_type" value={type} />
          <div role="radiogroup" aria-labelledby="client-type-label" className="flex flex-wrap gap-2">
            {([
              ['individual', 'Individual', 'A person, identified by NRIC'],
              ['company', 'Company', 'A business, identified by registration number'],
            ] as const).map(([value, label, hint]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={type === value}
                title={hint}
                onClick={() => setType(value)}
                className={`flex items-center gap-2 rounded border px-3.5 py-2 text-[13px] ${
                  type === value
                    ? 'border-brand bg-brand-wash font-semibold text-brand'
                    : 'border-line bg-white text-ink-soft hover:border-brand-tint'
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`flex h-[14px] w-[14px] items-center justify-center rounded-full border ${
                    type === value ? 'border-brand' : 'border-[#c3cad6]'
                  }`}
                >
                  {type === value && <span className="h-[7px] w-[7px] rounded-full bg-brand" />}
                </span>
                {label}
              </button>
            ))}
          </div>
        </div>

        <Field
          name="name" error={errorFor("name")} defaultValue={v("name")}
          label={type === 'company' ? 'Registered company name' : 'Full name as per NRIC'}
          span={2}
          required
          maxLength={120}
          placeholder={type === 'company' ? 'Moomoo Security Sdn Bhd' : 'Tan Mei Ling'}
        />

        {type === 'individual' ? (
          <>
            <Field
              name="nric" error={errorFor("nric")}
              label="NRIC"
              placeholder="880101-14-5566"
              value={nric}
              onChange={onNricChange}
              hint="Fills the date of birth for you"
            />
            <Field
              name="dob" error={errorFor("dob")}
              label="Date of birth"
              type="date"
              value={dob}
              onChange={setDob}
            />
            <Field name="occupation" error={errorFor("occupation")} defaultValue={v("occupation")} label="Occupation" placeholder="Engineer" />
          </>
        ) : (
          <>
            <Field
              name="business_reg" error={errorFor("business_reg")} defaultValue={v("business_reg")}
              label="Business registration no"
              placeholder="201901004455"
              hint="New 12-digit or old 462119-D format"
            />
            <Field name="occupation" error={errorFor("occupation")} defaultValue={v("occupation")} label="Business activity" span={2} placeholder="Security services" />
          </>
        )}
      </Section>

      <Section title="How to reach them">
        <Field name="phone" error={errorFor("phone")} defaultValue={v("phone")} label="Contact number" placeholder="012-345 6789" />
        <Field name="email" error={errorFor("email")} defaultValue={v("email")} label="Email" type="email" placeholder="name@example.com" />
        <Field name="address1" error={errorFor("address1")} defaultValue={v("address1")} label="Address line 1" span={2} />
        <Field name="address2" error={errorFor("address2")} defaultValue={v("address2")} label="Address line 2" span={2} />
        <Field name="postcode" error={errorFor("postcode")} defaultValue={v("postcode")} label="Postcode" placeholder="43200" maxLength={5} />
        <Field name="city" error={errorFor("city")} defaultValue={v("city")} label="City" placeholder="Cheras" />
        <div>
          <label htmlFor="state" className="mb-1 block text-[12px] font-semibold text-ink-soft">State</label>
          <select id="state" name="state" key={`state-${v('state')}`} defaultValue={v('state')} className="inp cursor-pointer">
            <option value="">Select state…</option>
            {STATES.map((st) => (
              <option key={st} value={st}>{st}</option>
            ))}
          </select>
        </div>
        <Field name="country" error={errorFor("country")} defaultValue={v("country")} label="Country" placeholder="Malaysia" />
      </Section>

      <Section title="Filing">
        <div className="sm:col-span-2">
          <label htmlFor="group_id" className="mb-1 block text-[12px] font-semibold text-ink-soft">Group</label>
          <select id="group_id" name="group_id" key={`group-${v('group_id')}`} defaultValue={v('group_id')} className="inp cursor-pointer">
            <option value="">Not grouped</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
          <p className="mt-1 text-[12px] text-muted">
            Fleets, families and affinity blocks are billed and reviewed together.
          </p>
        </div>

        <div className="sm:col-span-2">
          <span className="mb-1 block text-[12px] font-semibold text-ink-soft">Client portal</span>
          <label className="flex items-start gap-2.5 rounded border border-line px-3.5 py-2.5">
            <input
              type="checkbox"
              name="portal_enabled"
              key={`portal-${state?.values ? state.values.portal_enabled ?? '' : initial.portal_enabled}`}
              defaultChecked={
                state?.values ? state.values.portal_enabled === 'on' : Number(initial.portal_enabled) === 1
              }
              className="mt-0.5 accent-brand"
            />
            <span className="text-[13px] text-ink-soft">
              Mark this client for portal access
              <span className="mt-0.5 block text-[12px] text-muted">
                The portal is not live yet — this records who should get it when it is.
              </span>
            </span>
          </label>
        </div>
      </Section>

      {state?.error && !state.field && (
        <p role="alert" className="rounded border border-[#f3c9c5] bg-danger-wash px-4 py-3 text-[13px] text-danger">
          {state.error}
        </p>
      )}

      {state?.field && (
        <p role="alert" className="rounded border border-[#f3c9c5] bg-danger-wash px-4 py-3 text-[13px] text-danger">
          {state.error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className="btn btn-primary disabled:opacity-60">
          {pending ? 'Saving…' : mode === 'edit' ? 'Save changes' : 'Add client'}
        </button>
        <Link href={mode === 'edit' ? `/clients/${v('client_id')}` : '/clients'} className="btn btn-ghost">
          Cancel
        </Link>
        {mode === 'edit' && policyCount > 0 && (
          <span className="text-[12.5px] text-muted">
            {policyCount} {policyCount === 1 ? 'policy' : 'policies'} on file, so this client cannot be deleted.
          </span>
        )}
      </div>
    </form>
  );
}
