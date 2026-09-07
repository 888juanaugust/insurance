'use server';

import fs from 'node:fs';
import { revalidatePath } from 'next/cache';
import { authorise } from './guard';
import { audit } from './audit';
import { isLandlordProcess, isSuspended, isTenantSlug, suspendedFile, tenantExists } from './tenant';

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
