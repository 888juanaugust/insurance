'use server';

import crypto from 'node:crypto';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { clientIp, secureSignInProblem } from './request';
import { requestAgency, NO_AGENCY } from './tenant';
import { hashPassword, verifyPassword } from './auth';
import { checkRate, recordFailure, clearFailures } from './rate-limit';
import { createPortalSession, destroyPortalSession, currentPortalClient, revokePortalSessions } from './portal-session';
import { authorise, forbid } from './guard';
import { audit } from './audit';
import {
  findClientsForPortal, setPortalCode, touchPortalSeen, portalRenewalState,
  requestRenewal, getClient,
} from './queries';

export type PortalSignInState = { error?: string };

/**
 * Clients sign in with the identifier the agency already holds for them and a
 * code the agency issues. No self-registration: anyone could otherwise type a
 * stranger's NRIC and be told whether it is on file.
 */
export async function portalSignInAction(_prev: unknown, fd: FormData): Promise<PortalSignInState> {
  const insecure = await secureSignInProblem('/portal/login');
  if (insecure) return { error: insecure };

  const identification = String(fd.get('identification') ?? '').trim();
  const code = String(fd.get('code') ?? '').trim();
  if (!identification || !code) return { error: 'Enter your NRIC or company registration number and your access code.' };

  const tenant = await requestAgency();
  if (!tenant.ok && tenant.reason !== 'single-tenant') return { error: NO_AGENCY };

  const ip = (await clientIp()) ?? 'unknown';
  const keys = [`portal-ip:${ip}`, `portal-id:${identification.replace(/[^A-Za-z0-9]/g, '')}`];
  for (const key of keys) {
    const verdict = checkRate(key);
    if (!verdict.allowed) {
      const mins = Math.ceil(verdict.retryAfterSec / 60);
      return { error: `Too many attempts. Try again in ${mins} minute${mins === 1 ? '' : 's'}.` };
    }
  }

  /*
   * One message for every failure. Saying "no such client" would turn the
   * portal into a way of checking whether a given NRIC is insured by this
   * agency, which is not something a stranger should be able to find out.
   */
  const refuse = () => {
    for (const key of keys) recordFailure(key);
    return { error: 'Those details do not match an account. Ask the agency to check your access code.' };
  };

  // Two agencies can hold the same NRIC. The code is checked against each
  // client the identifier could mean, and the one it opens is the one.
  let client: { id: string; org_id: string } | null = null;
  for (const c of findClientsForPortal(identification)) {
    if (!c.portal_enabled || !c.portal_code_hash) continue;
    if (await verifyPassword(code, c.portal_code_hash)) { client = c; break; }
  }
  if (!client) return refuse();

  for (const key of keys) clearFailures(key);
  touchPortalSeen(client.id);
  await createPortalSession(client.id, client.org_id, ip === 'unknown' ? null : ip);
  redirect('/portal');
}

export async function portalSignOutAction() {
  await destroyPortalSession();
  redirect('/portal/login');
}

/** A client asking the agency to renew a policy. */
export async function portalRequestRenewalAction(fd: FormData) {
  const client = await currentPortalClient();
  if (!client) redirect('/portal/login');

  const policyId = String(fd.get('policy_id') ?? '');
  const state = portalRenewalState(policyId, client.id);
  // Not theirs, or not a policy — the same answer either way.
  if (!state) redirect('/portal');

  if (!state.pending) {
    requestRenewal(client.org_id, policyId, 'Client portal');
    await audit(
      { id: client.id, org_id: client.org_id, name: client.name, role: 'client' },
      {
        action: 'portal.renewal_request', entity: 'renewal_request', entityId: policyId,
        entityLabel: state.policy.policy_no,
        summary: `${client.name} asked for ${state.policy.policy_no} to be renewed, through the portal.`,
      },
    );
  }
  revalidatePath('/portal');
  redirect(`/portal?requested=${encodeURIComponent(state.policy.policy_no)}`);
}

/* --------------------------------------------------------- agency side */

export type PortalAdminState = { ok?: boolean; error?: string; code?: string };

/**
 * Issues an access code. It is shown once and stored hashed, so the agency
 * has to hand it over there and then — a code sitting readable in the database
 * is one an agency employee could use to sign in as the client.
 */
export async function issuePortalCodeAction(_prev: unknown, fd: FormData): Promise<PortalAdminState> {
  const clientId = String(fd.get('client_id') ?? '');
  const guard = await authorise({ action: 'portal.issue_code', entity: 'client', entityId: clientId });
  if (!guard.ok) return { error: guard.message };
  const user = guard.user;

  const client = getClient(clientId, user.org_id);
  if (!client || client.org_id !== user.org_id) return { error: 'That client could not be found.' };
  if (!client.nric && !client.business_reg) {
    return {
      error: 'The client needs an NRIC or company registration number first — that is what they sign in with.',
    };
  }

  // Ambiguous characters left out: this gets read down a telephone.
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const code = Array.from(crypto.randomBytes(10))
    .map((b) => alphabet[b % alphabet.length])
    .join('')
    .replace(/(.{5})(.{5})/, '$1-$2');

  setPortalCode(clientId, user.org_id, await hashPassword(code));
  // A new code ends whatever the old one opened.
  revokePortalSessions(clientId);
  await audit(user, {
    action: 'portal.issue_code', entity: 'client', entityId: clientId, entityLabel: client.name,
    summary: `Portal access code issued to ${client.name}. The code itself is stored hashed and is not recoverable.`,
  });
  revalidatePath(`/clients/${clientId}`);
  return { ok: true, code };
}

export async function revokePortalAccessAction(fd: FormData) {
  const clientId = String(fd.get('client_id') ?? '');
  const guard = await authorise({ action: 'portal.revoke', entity: 'client', entityId: clientId });
  if (!guard.ok) forbid(guard.message);
  const user = guard.user;

  const client = getClient(clientId, user.org_id);
  if (!client || client.org_id !== user.org_id) redirect('/clients');

  setPortalCode(clientId, user.org_id, null);
  revokePortalSessions(clientId);
  await audit(user, {
    action: 'portal.revoke', entity: 'client', entityId: clientId, entityLabel: client.name,
    summary: `Portal access withdrawn from ${client.name}. Any session they hold stops at their next request.`,
  });
  revalidatePath(`/clients/${clientId}`);
  redirect(`/clients/${clientId}`);
}
