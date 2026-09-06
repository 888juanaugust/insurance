import { AsyncLocalStorage } from 'node:async_hooks';
import fs from 'node:fs';
import path from 'node:path';

/**
 * One agency, one database file.
 *
 * Agencies were separated by `org_id` inside a single SQLite file: correct as
 * far as it went, and one forgotten `WHERE org_id = ?` away from showing one
 * agency another's book. Each agency now has a directory of its own —
 *
 *   <IH_TENANTS_DIR>/<slug>/insurhelp.db
 *   <IH_TENANTS_DIR>/<slug>/documents/
 *
 * — and a request opens exactly one of them. A query that forgets its
 * organisation can now only reach rows the agency already owns; a backup is
 * one directory; a customer who leaves is one directory removed. The `org_id`
 * columns and every check on them stay exactly as they were, because two
 * defences that fail differently are the point.
 *
 * Setting `IH_TENANTS_DIR` turns this on, and `IH_TENANT` says which agency
 * THIS PROCESS serves: one Node process per agency, with nginx sending each
 * subdomain to its own port. That is deliberate rather than reluctant —
 *
 *   - it is deterministic. Choosing the database per request needs the agency
 *     bound before React begins rendering, and Next gives no place to do that
 *     (an AsyncLocalStorage entered inside a page does not reach the code the
 *     page then calls). A pinned process reads its agency from the
 *     environment, synchronously, with nothing to propagate and nothing to
 *     leak between requests.
 *   - the isolation goes further than the file: separate memory, separate
 *     sign-in throttle, separate crash. One agency's runaway PDF cannot stall
 *     another's afternoon.
 *
 * The cost is memory per agency, which is what a KVM plan is sized by. Without
 * `IH_TENANTS_DIR` the application behaves exactly as it did — one database at
 * `IH_DB` — which is what development, the tests and a single-agency install use.
 */
export type Tenant = {
  slug: string;
  dbPath: string;
  filesDir: string;
};

export function tenantsRoot(): string {
  return process.env.IH_TENANTS_DIR ?? '';
}

/** True when agencies are separate databases rather than rows in one. */
export function multiTenant(): boolean {
  return tenantsRoot() !== '';
}

/*
 * A slug is a directory name and a subdomain label at once, so it is narrow on
 * purpose: lowercase letters, digits and inner hyphens. That excludes every
 * character that could walk out of the tenants directory ('.', '/', '\') and
 * everything a DNS label cannot carry.
 */
const SLUG = /^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$/;

/** Names that belong to the service, not to an agency. */
const RESERVED = new Set([
  'www', 'api', 'admin', 'app', 'mail', 'smtp', 'imap', 'ftp', 'ns1', 'ns2',
  'static', 'assets', 'cdn', 'status', 'help', 'support', 'portal', 'billing',
]);

export function isTenantSlug(value: string): boolean {
  return SLUG.test(value) && !RESERVED.has(value);
}

/** Why this slug will not do, or null when it will. */
export function slugProblem(value: string): string | null {
  if (!value) return 'Give the agency a short name for its address.';
  if (value !== value.toLowerCase()) return 'Use lowercase letters only.';
  if (!SLUG.test(value)) {
    return 'Use 1 to 32 characters: lowercase letters, digits and hyphens, starting and ending with a letter or digit.';
  }
  if (RESERVED.has(value)) return `"${value}" is reserved for the service itself. Choose another.`;
  return null;
}

/**
 * The agency a request is for, from the address it arrived at.
 *
 * `bs.insurhelp.my` under a base domain of `insurhelp.my` is the agency `bs`.
 * The base domain on its own is nobody's agency — it returns null, and the
 * caller shows the "which agency?" page rather than picking one.
 */
export function slugFromHost(host: string | null, baseDomain: string): string | null {
  if (!host || !baseDomain) return null;
  const name = host.split(':')[0].trim().toLowerCase().replace(/\.$/, '');
  const base = baseDomain.trim().toLowerCase().replace(/^\./, '');
  if (name === base || !name.endsWith(`.${base}`)) return null;
  const label = name.slice(0, -(base.length + 1));
  // Only one level: a.b.insurhelp.my is not agency "a.b".
  if (label.includes('.')) return null;
  return isTenantSlug(label) ? label : null;
}

/** Where an agency's port is recorded, so nginx and PM2 agree on it. */
export function tenantPortFile(slug: string): string {
  return path.join(tenantsRoot(), slug, 'port');
}

export function tenantPort(slug: string): number | null {
  try {
    const n = Number(fs.readFileSync(tenantPortFile(slug), 'utf8').trim());
    return Number.isInteger(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

/**
 * The next port for a new agency. Ports are written down rather than derived
 * from position, so adding or removing an agency never moves another one's.
 */
export function nextFreePort(base = 3001): number {
  const used = new Set(listTenants().map(tenantPort).filter((p): p is number => p !== null));
  let port = base;
  while (used.has(port)) port++;
  return port;
}

export function tenantPaths(slug: string): Tenant {
  const root = tenantsRoot();
  if (!root) throw new Error('IH_TENANTS_DIR is not set, so there are no per-agency databases.');
  if (!isTenantSlug(slug)) throw new Error(`"${slug}" is not a usable agency name.`);
  const dir = path.join(root, slug);
  return { slug, dbPath: path.join(dir, 'insurhelp.db'), filesDir: path.join(dir, 'documents') };
}

/** An agency exists when its database file does. Nothing is created by looking. */
export function tenantExists(slug: string): boolean {
  if (!isTenantSlug(slug) || !tenantsRoot()) return false;
  return fs.existsSync(tenantPaths(slug).dbPath);
}

export function listTenants(): string[] {
  const root = tenantsRoot();
  if (!root) return [];
  try {
    return fs
      .readdirSync(root, { withFileTypes: true })
      .filter((e) => e.isDirectory() && isTenantSlug(e.name))
      .map((e) => e.name)
      .filter(tenantExists)
      .sort();
  } catch {
    return [];
  }
}

/* ------------------------------------------------------- the request's own */

const store = new AsyncLocalStorage<Tenant>();

/** The agency this process was started for, from the environment. */
export function pinnedTenant(): Tenant | null {
  if (!multiTenant()) return null;
  const slug = (process.env.IH_TENANT ?? '').trim().toLowerCase();
  return slug && isTenantSlug(slug) ? tenantPaths(slug) : null;
}

/**
 * Which agency the code running now belongs to: the one a command-line or
 * scheduled job wrapped itself in, otherwise the one this process serves.
 * Read synchronously, so `getDb` can call it.
 */
export function currentTenant(): Tenant | null {
  return store.getStore() ?? pinnedTenant();
}

/** Run something for one agency — the scheduled run, the command line. */
export function runInTenant<T>(slug: string, fn: () => T): T {
  return store.run(tenantPaths(slug), fn);
}

/** What a person is told when the address belongs to no agency. */
export const NO_AGENCY =
  'This address does not belong to an agency. Check the web address your agency gave you.';

export type TenantResolution =
  | { ok: true; tenant: Tenant }
  | { ok: false; reason: 'single-tenant' | 'no-agency' | 'wrong-agency'; slug?: string };

/**
 * Check that this request belongs where it arrived.
 *
 * The process already knows its agency; this is the guard against a
 * misconfigured proxy sending one agency's traffic to another's process. When
 * `IH_BASE_DOMAIN` is set the host has to name this agency, or the request is
 * refused rather than answered out of the wrong book. It resolves nothing and
 * binds nothing — the pin does that, before any request arrives.
 */
export function checkRequestAgency(host: string | null): TenantResolution {
  if (!multiTenant()) return { ok: false, reason: 'single-tenant' };

  const tenant = currentTenant();
  if (!tenant) return { ok: false, reason: 'no-agency' };
  if (!tenantExists(tenant.slug)) return { ok: false, reason: 'no-agency', slug: tenant.slug };

  const base = process.env.IH_BASE_DOMAIN ?? '';
  if (base) {
    const asked = slugFromHost(host, base);
    if (asked && asked !== tenant.slug) {
      return { ok: false, reason: 'wrong-agency', slug: asked };
    }
  }
  return { ok: true, tenant };
}

/** The same check, reading the host from the request. */
export async function requestAgency(): Promise<TenantResolution> {
  if (!multiTenant()) return { ok: false, reason: 'single-tenant' };
  let host: string | null = null;
  try {
    // Imported here so the pure helpers above can be tested in plain Node.
    const { headers } = await import('next/headers');
    host = (await headers()).get('host');
  } catch {
    /* outside a request — the pin alone decides */
  }
  return checkRequestAgency(host);
}
