'use server';

import fs from 'node:fs';
import { revalidatePath } from 'next/cache';
import { authorise } from './guard';
import { audit } from './audit';
import { isLandlordProcess, isSuspended, isTenantSlug, suspendedFile, tenantExists } from './tenant';
import { removeSharedLabel, restoreSharedLabel, type LibraryEntry } from './shared-labels';
import { fieldName } from './extract/field-names';

/**
 * What the landlord can do to an agency from the console: suspend it, and
 * bring it back. Removing one stays a command on the server, with a final
 * copy taken first — the console is for the reversible.
 *
 * Suspension is a marker file. The agency's own process refuses every request
 * the moment the file exists, so this takes effect at once whatever PM2 and
 * nginx are doing; stopping the process and serving the page from nginx are
 * tidy-ups the tenant command prints.
 */
export type LandlordState = { ok?: boolean; error?: string; message?: string };

async function landlordOnly(action: string, slug: string) {
  if (!isLandlordProcess()) return { error: 'This is not the landlord console.' } as const;
  const guard = await authorise({ action, entity: 'agency', entityId: slug, entityLabel: slug });
  if (!guard.ok) return { error: guard.message } as const;
  if (!isTenantSlug(slug) || !tenantExists(slug)) return { error: `There is no agency "${slug}".` } as const;
  return { user: guard.user } as const;
}

export async function suspendAgencyAction(fd: FormData): Promise<LandlordState> {
  const slug = String(fd.get('slug') ?? '').trim().toLowerCase();
  const gate = await landlordOnly('agency.suspend', slug);
  if ('error' in gate) return { error: gate.error };
  if (isSuspended(slug)) return { ok: true, message: `${slug} was already suspended.` };

  fs.writeFileSync(suspendedFile(slug), `${new Date().toISOString()}\n`);
  await audit(gate.user, {
    action: 'agency.suspend', entity: 'agency', entityId: slug, entityLabel: slug,
    summary: `Agency ${slug} suspended from the landlord console.`,
  });
  revalidatePath('/landlord');
  return { ok: true, message: `${slug} is suspended. Its address now says so.` };
}

export async function resumeAgencyAction(fd: FormData): Promise<LandlordState> {
  const slug = String(fd.get('slug') ?? '').trim().toLowerCase();
  const gate = await landlordOnly('agency.resume', slug);
  if ('error' in gate) return { error: gate.error };
  if (!isSuspended(slug)) return { ok: true, message: `${slug} was not suspended.` };

  fs.rmSync(suspendedFile(slug), { force: true });
  await audit(gate.user, {
    action: 'agency.resume', entity: 'agency', entityId: slug, entityLabel: slug,
    summary: `Agency ${slug} resumed from the landlord console.`,
  });
  revalidatePath('/landlord');
  return {
    ok: true,
    message: `${slug} is back. If its process was stopped, run on the server: pm2 start ecosystem.config.cjs --only insurhelp-${slug}`,
  };
}

/* ------------------------------------------------------- the reader library */

/**
 * The shared label library is the landlord's to curate: a label that reads
 * the wrong thing at every agency is removed here, and stays removed however
 * often an agency teaches it again. Nothing in any agency's own table moves —
 * what an agency taught itself is its own.
 */
async function librarian(action: string, id: string) {
  if (!isLandlordProcess()) return { error: 'This is not the landlord console.' } as const;
  if (!id) return { error: 'Which label?' } as const;
  const guard = await authorise({ action, entity: 'label', entityId: id });
  if (!guard.ok) return { error: guard.message } as const;
  return { user: guard.user } as const;
}

const describe = (l: LibraryEntry) => `"${l.label}" as ${fieldName(l.key)} on ${l.insurer} schedules`;

export async function removeSharedLabelAction(fd: FormData): Promise<LandlordState> {
  const id = String(fd.get('id') ?? '').trim();
  const gate = await librarian('label.remove', id);
  if ('error' in gate) return { error: gate.error };
  const was = removeSharedLabel(id, gate.user.name);
  if (!was) return { error: 'That label is not in the library.' };
  await audit(gate.user, {
    action: 'label.remove', entity: 'label', entityId: id, entityLabel: `${was.insurer} · ${was.key} · ${was.label}`,
    summary: `Removed ${describe(was)} from the shared reader library; it had been taught by ${was.agencies.join(', ')}.`,
  });
  revalidatePath('/landlord/labels');
  return { ok: true, message: `${describe(was)} is no longer read anywhere on this server. Agencies' own learning is untouched.` };
}

export async function restoreSharedLabelAction(fd: FormData): Promise<LandlordState> {
  const id = String(fd.get('id') ?? '').trim();
  const gate = await librarian('label.restore', id);
  if ('error' in gate) return { error: gate.error };
  const was = restoreSharedLabel(id);
  if (!was) return { error: 'That label is not in the library.' };
  await audit(gate.user, {
    action: 'label.restore', entity: 'label', entityId: id, entityLabel: `${was.insurer} · ${was.key} · ${was.label}`,
    summary: `Restored ${describe(was)} to the shared reader library.`,
  });
  revalidatePath('/landlord/labels');
  return { ok: true, message: `${describe(was)} is read again.` };
}
