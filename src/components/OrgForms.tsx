'use client';

import { useActionState } from 'react';
import {
  saveOrgProfileAction, saveOrgInvoiceAction, saveOrgBankAction,
  type OrgFormState,
} from '@/lib/org-actions';

/*
 * Field and Panel live at module scope on purpose. Declared inside a
 * component they become a new type on every render, and React remounts every
 * input — which quietly empties whatever has been typed.
 */

type Spec = {
  name: string;
  label: string;
  type?: string;
  span?: number;
  required?: boolean;
  placeholder?: string;
  hint?: string;
  maxLength?: number;
  rows?: number;
  options?: string[];
};

function Field({
  spec, value, error, prefix,
}: { spec: Spec; value: string; error?: string; prefix: string }) {
  const { name, label, type = 'text', span = 1, required, placeholder, hint, maxLength, rows, options } = spec;
  /*
   * The panels share columns — the company name and phone sit on the
   * particulars and on the letterhead — so the input id carries the panel.
   * Two elements with one id is invalid, and every `label for` on the page
   * then points at whichever came first.
   */
  const id = `${prefix}-${name}`;
  const described = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div className={span === 2 ? 'sm:col-span-2' : span === 4 ? 'sm:col-span-2 xl:col-span-4' : ''}>
      <label htmlFor={id} className="mb-1 block text-[12px] font-semibold text-ink-soft">
        {label}
        {required && <span className="ml-0.5 text-brand">*</span>}
      </label>
      {options ? (
        <select
          id={id}
          name={name}
          key={`${id}-${value}`}
          defaultValue={value}
          aria-invalid={error ? true : undefined}
          aria-describedby={described}
          className={`inp cursor-pointer ${error ? 'border-brand' : ''}`}
        >
          <option value="">Not set</option>
          {options.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      ) : rows ? (
        <textarea
          id={id}
          name={name}
          rows={rows}
          required={required}
          placeholder={placeholder}
          maxLength={maxLength}
          key={`${id}-${value}`}
          defaultValue={value}
          aria-invalid={error ? true : undefined}
          aria-describedby={described}
          className={`inp ${error ? 'border-brand' : ''}`}
        />
      ) : (
        <input
          id={id}
          name={name}
          type={type}
          required={required}
          placeholder={placeholder}
          maxLength={maxLength}
          key={`${id}-${value}`}
          defaultValue={value}
          aria-invalid={error ? true : undefined}
          aria-describedby={described}
          className={`inp ${error ? 'border-brand' : ''}`}
        />
      )}
      {error ? (
        <p id={`${id}-error`} className="mt-1 text-[12px] font-medium text-brand">{error}</p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1 text-[12px] text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

/**
 * One panel, one save. The panels on this page overlap — the company name and
 * phone appear on the letterhead as well as the particulars — so saving one
 * leaves the others untouched rather than writing back whatever they happen
 * to be showing.
 */
function Panel({
  title, note, fields, initial, action, label, prefix,
}: {
  title: string;
  note?: string;
  fields: Spec[];
  initial: Record<string, string | number | null>;
  action: (prev: unknown, fd: FormData) => Promise<OrgFormState>;
  label: string;
  prefix: string;
}) {
  const [state, formAction, pending] = useActionState(action, null as OrgFormState | null);

  const v = (k: string) => {
    const echoed = state?.values?.[k];
    if (echoed !== undefined) return echoed;
    const raw = initial[k];
    return raw === null || raw === undefined ? '' : String(raw);
  };
  const err = (k: string) => (state?.field === k ? state.error : undefined);

  return (
    <form action={formAction} className="panel">
      <div className="panel-head">{title}</div>
      {note && <p className="border-b border-line px-5 py-2.5 text-[12.5px] text-muted">{note}</p>}

      <div className="grid gap-4 px-5 py-5 sm:grid-cols-2 xl:grid-cols-4">
        {fields.map((f) => (
          <Field key={f.name} spec={f} value={v(f.name)} error={err(f.name)} prefix={prefix} />
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-line px-5 py-3.5">
        <button type="submit" disabled={pending} className="btn btn-primary disabled:opacity-60">
          {pending ? 'Saving…' : label}
        </button>
        {state?.error && (
          <span role="alert" className="text-[12.5px] font-medium text-danger">{state.error}</span>
        )}
        {state?.ok && (
          <span role="status" className="text-[12.5px] font-medium text-ok">
            {state.note ?? 'Saved.'}
          </span>
        )}
      </div>
    </form>
  );
}

const STATES = [
  'Johor', 'Kedah', 'Kelantan', 'Melaka', 'Negeri Sembilan', 'Pahang', 'Perak',
  'Perlis', 'Pulau Pinang', 'Sabah', 'Sarawak', 'Selangor', 'Terengganu',
  'W.P. Kuala Lumpur', 'W.P. Labuan', 'W.P. Putrajaya',
];

const PROFILE: Spec[] = [
  { name: 'name', label: 'Company name', span: 2, required: true, maxLength: 120 },
  { name: 'ssm_no', label: 'SSM registration no', placeholder: '201901234567', maxLength: 20 },
  { name: 'tin_no', label: 'TIN number', placeholder: 'C20880123456', hint: 'LHDN tax identification', maxLength: 20 },
  { name: 'sst_no', label: 'SST number', placeholder: 'W10-1808-31000000', maxLength: 24 },
  { name: 'msic_code', label: 'MSIC code', placeholder: '66221', hint: '66221 — insurance agents', maxLength: 5 },
  { name: 'business_desc', label: 'Business activity', span: 2, maxLength: 160 },
  { name: 'contact_person', label: 'Contact person', maxLength: 100 },
  { name: 'phone', label: 'Contact number', placeholder: '03-9013 2688', maxLength: 30 },
  { name: 'email', label: 'Email address', type: 'email', span: 2, maxLength: 120 },
  { name: 'address1', label: 'Address line 1', span: 2, maxLength: 120 },
  { name: 'address2', label: 'Address line 2', span: 2, maxLength: 120 },
  { name: 'postcode', label: 'Postcode', placeholder: '56100', maxLength: 5 },
  { name: 'city', label: 'City', maxLength: 60 },
  { name: 'state', label: 'State', options: STATES },
  { name: 'country', label: 'Country', maxLength: 60 },
];

const INVOICE: Spec[] = [
  { name: 'name', label: 'Company name', span: 2, required: true, maxLength: 120 },
  { name: 'former_name', label: 'Former name', span: 2, hint: 'Printed under the current name while clients still know the old one', maxLength: 120 },
  { name: 'logo_url', label: 'Logo URL', span: 2, placeholder: 'https://…', maxLength: 300 },
  { name: 'website', label: 'Website', span: 2, placeholder: 'https://…', maxLength: 200 },
  { name: 'phone', label: 'Phone', maxLength: 30 },
  { name: 'phone2', label: 'Phone 2', maxLength: 30 },
  { name: 'email', label: 'Email', type: 'email', maxLength: 120 },
  { name: 'email2', label: 'Email 2', type: 'email', maxLength: 120 },
  { name: 'ssm_no', label: 'BRN', placeholder: '201901234567', maxLength: 20 },
  { name: 'sst_no', label: 'SST', placeholder: 'W10-1808-31000000', maxLength: 24 },
];

const BANK: Spec[] = [
  { name: 'bank_name', label: 'Bank name', span: 2, placeholder: 'Maybank Berhad', maxLength: 80 },
  { name: 'bank_account_name', label: 'Account name', span: 2, hint: 'Exactly as the bank holds it', maxLength: 120 },
  { name: 'bank_account_number', label: 'Account number', span: 2, placeholder: '512345678901', maxLength: 24 },
  { name: 'remark1', label: 'Remark 1', span: 2, maxLength: 120 },
  { name: 'remark2', label: 'Remark 2', span: 2, maxLength: 120 },
  { name: 'loc_prefix', label: 'Letter of collection prefix', placeholder: 'LOC', maxLength: 12 },
  { name: 'pos_prefix', label: 'POS prefix', placeholder: 'POS', maxLength: 12 },
  { name: 'invoice_template', label: 'Invoice template', maxLength: 60 },
];

type OrgRow = Record<string, string | number | null>;

export function OrgProfilePanel({ org }: { org: OrgRow }) {
  return (
    <Panel
      title="Company particulars"
      note="Identity used on e-Invoices submitted to LHDN. The TIN, SSM and MSIC code have to match what is registered, or the submission is rejected."
      fields={PROFILE}
      initial={org}
      action={saveOrgProfileAction}
      label="Save particulars"
      prefix="org"
    />
  );
}

export function OrgInvoicePanel({ org }: { org: OrgRow }) {
  return (
    <Panel
      title="Invoice company info"
      note="The letterhead on letters of collection, receipts and e-Invoices."
      fields={INVOICE}
      initial={org}
      action={saveOrgInvoiceAction}
      label="Save letterhead"
      prefix="inv"
    />
  );
}

export function OrgBankPanel({ org }: { org: OrgRow }) {
  return (
    <Panel
      title="Collection account and numbering"
      note="Printed on every letter of collection. A wrong number sends a client's premium to a stranger, so the bank, account name and number are saved together or not at all."
      fields={BANK}
      initial={org}
      action={saveOrgBankAction}
      label="Save account"
      prefix="bank"
    />
  );
}
