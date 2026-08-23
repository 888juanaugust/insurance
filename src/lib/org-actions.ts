'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { currentUser } from './session';
import {
  updateOrg, updateCommissionRates, listCommissionRatesWithCeiling,
  ORG_FIELDS, type OrgPanel,
} from './queries';

export type OrgFormState = {
  ok?: boolean;
  error?: string;
  field?: string;
  /** Saved but worth reading — a rate change that does not touch history. */
  note?: string;
  /**
   * What was submitted, echoed back. React resets the form once a server
   * action returns, so without this a rejection empties the panel.
   */
  values?: Record<string, string>;
};

function submitted(fd: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of fd.entries()) {
    if (typeof value === 'string' && !key.startsWith('$')) out[key] = value;
  }
  return out;
}

function str(fd: FormData, key: string): string {
  const value = String(fd.get(key) ?? '').trim();
  // A dash or N/A on a form means "we have none of these", which is a blank
  // column, not a value to validate.
  return /^(-+|n\/?a)$/i.test(value) ? '' : value;
}

function reject(fd: FormData, field: string, error: string): OrgFormState {
  return { field, error, values: submitted(fd) };
}

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/;
const POSTCODE = /^\d{5}$/;
/**
 * SSM registration. Companies registered before 2019 carry both numbers, and
 * their documents print them together — `201901004455 (1315678-V)` — so the
 * combined form has to be accepted as typed rather than made to choose.
 */
const OLD_REG = String.raw`\d{6,8}-[A-Z0-9]{1,2}`;
const BUSINESS_REG = new RegExp(`^(\\d{12}|${OLD_REG})(\\s*\\(\\s*${OLD_REG}\\s*\\))?$`, 'i');
/** LHDN TIN: a letter prefix (C for company, IG for individual) then digits. */
const TIN = /^[A-Z]{1,2}\d{9,13}$/i;
/** SST registration: two letters, a dash, then 14 digits — e.g. W10-1808-31000000. */
const SST = /^[A-Z]\d{2}-\d{4}-\d{8}$/i;
const MSIC = /^\d{5}$/;
const URL_RE = /^https?:\/\/\S+$/i;

/** Panels share columns, so each save writes only the fields it displays. */
function collect(fd: FormData, panel: OrgPanel): Record<string, string> {
  const out: Record<string, string> = {};
  for (const field of ORG_FIELDS[panel]) {
    if (fd.has(field)) out[field] = str(fd, field);
  }
  return out;
}

/* ------------------------------------------------- company particulars */

export async function saveOrgProfileAction(_prev: unknown, fd: FormData): Promise<OrgFormState> {
  const user = await currentUser();
  if (!user) redirect('/login');

  const values = collect(fd, 'profile');

  if (!values.name) return reject(fd, 'name', 'Enter the company name.');
  if (values.name.length > 120) {
    return reject(fd, 'name', 'That name is too long — 120 characters at most.');
  }
  if (values.ssm_no && !BUSINESS_REG.test(values.ssm_no)) {
    return reject(fd, 'ssm_no', 'SSM registration numbers look like 201901234567 or 123456-A.');
  }
  if (values.tin_no && !TIN.test(values.tin_no)) {
    return reject(fd, 'tin_no', 'A TIN is a letter prefix then digits, like C20880123456.');
  }
  if (values.sst_no && !SST.test(values.sst_no)) {
    return reject(fd, 'sst_no', 'SST registration numbers look like W10-1808-31000000.');
  }
  if (values.msic_code && !MSIC.test(values.msic_code)) {
    return reject(fd, 'msic_code', 'MSIC codes are five digits — 66221 for insurance agents.');
  }
  if (values.email && !EMAIL.test(values.email)) {
    return reject(fd, 'email', 'Enter a valid email address.');
  }
  if (values.postcode && !POSTCODE.test(values.postcode)) {
    return reject(fd, 'postcode', 'A Malaysian postcode is five digits.');
  }

  values.ssm_no = values.ssm_no.toUpperCase();
  values.tin_no = values.tin_no.toUpperCase();
  values.sst_no = values.sst_no.toUpperCase();

  updateOrg(user.org_id, 'profile', values);
  revalidatePath('/organisation');
  revalidatePath('/settings/global');
  return { ok: true, values: submitted(fd) };
}

/* --------------------------------------------------- invoice letterhead */

export async function saveOrgInvoiceAction(_prev: unknown, fd: FormData): Promise<OrgFormState> {
  const user = await currentUser();
  if (!user) redirect('/login');

  const values = collect(fd, 'invoice');

  if (!values.name) return reject(fd, 'name', 'Enter the company name.');
  if (values.email && !EMAIL.test(values.email)) {
    return reject(fd, 'email', 'Enter a valid email address.');
  }
  if (values.email2 && !EMAIL.test(values.email2)) {
    return reject(fd, 'email2', 'Enter a valid second email address, or leave it blank.');
  }
  if (values.ssm_no && !BUSINESS_REG.test(values.ssm_no)) {
    return reject(fd, 'ssm_no', 'SSM registration numbers look like 201901234567 or 123456-A.');
  }
  if (values.sst_no && !SST.test(values.sst_no)) {
    return reject(fd, 'sst_no', 'SST registration numbers look like W10-1808-31000000.');
  }
  if (values.logo_url && !URL_RE.test(values.logo_url)) {
    return reject(fd, 'logo_url', 'The logo needs a full URL starting http:// or https://.');
  }
  if (values.website && !URL_RE.test(values.website)) {
    return reject(fd, 'website', 'The website needs a full URL starting http:// or https://.');
  }

  values.ssm_no = values.ssm_no.toUpperCase();
  values.sst_no = values.sst_no.toUpperCase();

  updateOrg(user.org_id, 'invoice', values);
  revalidatePath('/organisation');
  revalidatePath('/settings/global');
  return { ok: true, values: submitted(fd) };
}

/* ------------------------------------- collection account and numbering */

export async function saveOrgBankAction(_prev: unknown, fd: FormData): Promise<OrgFormState> {
  const user = await currentUser();
  if (!user) redirect('/login');

  const values = collect(fd, 'bank');
  const account = values.bank_account_number.replace(/[\s-]/g, '');

  // This account is printed on every letter of collection. A client paying a
  // wrong number sends the agency's premium to a stranger, so a partly filled
  // account is refused rather than half-printed.
  const filled = [values.bank_name, values.bank_account_name, account].filter(Boolean).length;
  if (filled > 0 && filled < 3) {
    return reject(
      fd,
      !values.bank_name ? 'bank_name' : !values.bank_account_name ? 'bank_account_name' : 'bank_account_number',
      'The collection account is printed on every letter of collection — it needs the bank, the account name and the account number together, or none of them.',
    );
  }
  if (account && !/^\d{8,20}$/.test(account)) {
    return reject(fd, 'bank_account_number', 'A Malaysian account number is 8 to 20 digits.');
  }
  if (values.loc_prefix && !/^[A-Z0-9/-]{1,12}$/i.test(values.loc_prefix)) {
    return reject(fd, 'loc_prefix', 'A prefix is up to 12 letters, digits, dashes or slashes.');
  }
  if (values.pos_prefix && !/^[A-Z0-9/-]{1,12}$/i.test(values.pos_prefix)) {
    return reject(fd, 'pos_prefix', 'A prefix is up to 12 letters, digits, dashes or slashes.');
  }

  values.bank_account_number = account;
  values.loc_prefix = values.loc_prefix.toUpperCase();
  values.pos_prefix = values.pos_prefix.toUpperCase();

  updateOrg(user.org_id, 'bank', values);
  revalidatePath('/organisation');
  return { ok: true, values: submitted(fd) };
}

/* ------------------------------------------------------ commission rates */

export async function saveCommissionRatesAction(_prev: unknown, fd: FormData): Promise<OrgFormState> {
  const user = await currentUser();
  if (!user) redirect('/login');

  const current = listCommissionRatesWithCeiling(user.org_id);
  const changes: Array<{ id: string; rate: number }> = [];

  for (const row of current) {
    const raw = str(fd, `rate_${row.id}`);
    if (raw === '') return reject(fd, `rate_${row.id}`, `Enter a rate for ${row.short_name}, or leave the existing one in place.`);

    const rate = Number(raw);
    if (!Number.isFinite(rate) || rate < 0) {
      return reject(fd, `rate_${row.id}`, `${row.short_name} needs a rate of zero or more.`);
    }
    if (rate > row.ceiling) {
      return reject(
        fd,
        `rate_${row.id}`,
        `${row.short_name} pays ${row.ceiling}% on ${row.class === 'motor' ? 'motor' : 'non-motor'}. A rate of ${rate}% would book commission the insurer never pays.`,
      );
    }
    if (Math.round(rate * 100) !== rate * 100) {
      return reject(fd, `rate_${row.id}`, `${row.short_name}: rates carry at most two decimal places.`);
    }
    if (rate !== row.rate) changes.push({ id: row.id, rate });
  }

  if (!changes.length) return { ok: true, note: 'Nothing changed.', values: submitted(fd) };

  updateCommissionRates(user.org_id, changes);
  revalidatePath('/settings/global');
  return {
    ok: true,
    note: `${changes.length} rate${changes.length === 1 ? '' : 's'} updated. Policies already written keep the rate they were written at — this applies to the next policy created.`,
    values: submitted(fd),
  };
}
