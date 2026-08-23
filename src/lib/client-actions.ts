'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { authorise, forbid } from './guard';
import { audit, diff } from './audit';
import {
  createClient, updateClient, deleteClient, getClient, clientPolicyCount,
  findClientByIdentification, dobFromNric, type ClientInput,
} from './queries';

export type ClientFormState = {
  error?: string;
  field?: string;
  /**
   * What was submitted, echoed back. React resets the form after a server
   * action runs, so without this a validation error empties every field the
   * person had already filled in.
   */
  values?: Record<string, string>;
};

/** Every text value on the form, so a rejection can repopulate it. */
function submitted(fd: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of fd.entries()) {
    if (typeof value === 'string' && !key.startsWith('$')) out[key] = value;
  }
  return out;
}

const NRIC = /^\d{6}-\d{2}-\d{4}$/;
/** Old style 123456-A / 123456-X, or the 12-digit number issued since 2019. */
const BUSINESS_REG = /^(\d{6,8}-[A-Z0-9]{1,2}|\d{12})$/i;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/;
const POSTCODE = /^\d{5}$/;

function str(fd: FormData, key: string): string {
  return String(fd.get(key) ?? '').trim();
}

function reject(fd: FormData, field: string, error: string): ClientFormState {
  return { field, error, values: submitted(fd) };
}

export async function saveClientAction(_prev: unknown, fd: FormData): Promise<ClientFormState> {
  const id = str(fd, 'client_id');
  const guard = await authorise('client.write', {
    action: id ? 'client.update' : 'client.create', entity: 'client', entityId: id || null,
  });
  if (!guard.ok) return { error: guard.message, values: submitted(fd) };
  const user = guard.user;

  const type = str(fd, 'client_type') === 'company' ? 'company' : 'individual';
  const name = str(fd, 'name');
  const nric = str(fd, 'nric').toUpperCase();
  const businessReg = str(fd, 'business_reg').toUpperCase();
  const email = str(fd, 'email');
  const postcode = str(fd, 'postcode');
  const dob = str(fd, 'dob');

  if (!name) return reject(fd, 'name', 'Enter the client name.');
  if (name.length > 120) return reject(fd, 'name', 'That name is too long — 120 characters at most.');

  if (type === 'individual') {
    if (nric && !NRIC.test(nric)) {
      return reject(fd, 'nric', 'NRIC should look like 880101-14-5566.');
    }
  } else if (businessReg && !BUSINESS_REG.test(businessReg)) {
    return reject(fd, 'business_reg', 'Business registration should look like 201901004455 or 462119-D.');
  }

  if (email && !EMAIL.test(email)) return reject(fd, 'email', 'That email address does not look right.');
  if (postcode && !POSTCODE.test(postcode)) return reject(fd, 'postcode', 'A Malaysian postcode is five digits.');

  if (dob) {
    if (dob > new Date().toISOString().slice(0, 10)) {
      return reject(fd, 'dob', 'Date of birth cannot be in the future.');
    }
    // An NRIC states the date of birth, so a contradiction is a typo in one of them.
    const fromNric = type === 'individual' && nric ? dobFromNric(nric) : null;
    if (fromNric && fromNric !== dob) {
      return reject(
        fd,
        'dob',
        `The NRIC gives a date of birth of ${fromNric}. Correct one of the two so they agree.`,
      );
    }
  }

  const identification = type === 'individual' ? nric : businessReg;
  if (identification) {
    const clash = findClientByIdentification(user.org_id, identification, id || undefined);
    if (clash) {
      return reject(
        fd,
        type === 'individual' ? 'nric' : 'business_reg',
        `${clash.name} is already on file with this identification.`,
      );
    }
  }

  const input: ClientInput = {
    name,
    client_type: type,
    nric: type === 'individual' ? nric || null : null,
    business_reg: type === 'company' ? businessReg || null : null,
    email: email || null,
    phone: str(fd, 'phone') || null,
    address1: str(fd, 'address1') || null,
    address2: str(fd, 'address2') || null,
    postcode: postcode || null,
    city: str(fd, 'city') || null,
    state: str(fd, 'state') || null,
    country: str(fd, 'country') || 'MALAYSIA',
    // Only a person has one, and it follows from the NRIC when that is given.
    dob: type === 'individual' ? dob || (nric ? dobFromNric(nric) : null) : null,
    occupation: str(fd, 'occupation') || null,
    group_id: str(fd, 'group_id') || null,
    portal_enabled: fd.get('portal_enabled') ? 1 : 0,
  };

  if (id) {
    const existing = getClient(id);
    if (!existing || existing.org_id !== user.org_id) {
      return { error: 'That client could not be found.', values: submitted(fd) };
    }
    updateClient(id, user.org_id, input);
    await audit(user, {
      action: 'client.update', entity: 'client', entityId: id, entityLabel: name,
      summary: `Client ${name} edited.`,
      changes: diff(existing as Record<string, unknown>, input as Record<string, unknown>, Object.keys(input)),
    });
    revalidatePath('/clients');
    revalidatePath(`/clients/${id}`);
    redirect(`/clients/${id}`);
  }

  const newId = createClient(user.org_id, input);
  await audit(user, {
    action: 'client.create', entity: 'client', entityId: newId, entityLabel: name,
    summary: `Client ${name} added as ${type === 'company' ? 'a company' : 'an individual'}.`,
  });
  revalidatePath('/clients');
  redirect(`/clients/${newId}`);
}

export async function deleteClientAction(fd: FormData) {
  const id = String(fd.get('id') ?? '');
  const guard = await authorise('client.delete', { action: 'client.delete', entity: 'client', entityId: id });
  if (!guard.ok) forbid(guard.message);
  const user = guard.user;

  if (!id) redirect('/clients');

  const existing = getClient(id);
  if (!existing || existing.org_id !== user.org_id) redirect('/clients');

  // A client carrying policies is history, not a mistake — keep it.
  if (clientPolicyCount(id) > 0) {
    await audit(user, {
      action: 'client.delete', entity: 'client', entityId: id, entityLabel: existing.name,
      outcome: 'refused',
      summary: `Deletion of ${existing.name} refused — the client still carries policies.`,
    });
    redirect(`/clients/${id}?error=has-policies`);
  }

  deleteClient(id, user.org_id);
  await audit(user, {
    action: 'client.delete', entity: 'client', entityId: id, entityLabel: existing.name,
    summary: `Client ${existing.name} deleted.`,
  });
  revalidatePath('/clients');
  redirect('/clients');
}
