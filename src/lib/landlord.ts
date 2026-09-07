import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { isSuspended, listTenants, tenantPaths, tenantPort } from './tenant';

/**
 * What the landlord sees of each agency: enough to know who is active, who
 * has grown, who has gone quiet — and nothing of what is in anyone's book.
 *
 * Each agency's database is opened READ-ONLY, for counts and dates only, and
 * closed again. No name of a client, no policy number, no premium leaves
 * this function; the landlord's console is about the tenancy, not the
 * tenant's business.
 */
export type AgencySummary = {
  slug: string;
  name: string;
  address: string;
  port: number | null;
  suspended: boolean;
  policies: number;
  clients: number;
  users: number;
  documents: number;
  /** Database plus documents, in bytes. */
  bytes: number;
  /** When someone at the agency last had a live session, ISO, or null. */
  lastSeen: string | null;
  /** The day the agency was created. */
  since: string | null;
  /** Set when the database could not be read — the row still lists. */
  problem?: string;
};

function dirBytes(dir: string): number {
  let total = 0;
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      total += entry.isDirectory() ? dirBytes(full) : fs.statSync(full).size;
    }
  } catch {
    /* no such directory */
  }
  return total;
}

export function agencySummaries(baseDomain = process.env.IH_BASE_DOMAIN ?? ''): AgencySummary[] {
  return listTenants().map((slug) => {
    const paths = tenantPaths(slug);
    const summary: AgencySummary = {
      slug,
      name: slug,
      address: baseDomain ? `https://${slug}.${baseDomain}` : '',
      port: tenantPort(slug),
      suspended: isSuspended(slug),
      policies: 0, clients: 0, users: 0, documents: 0,
      bytes: 0,
      lastSeen: null,
      since: null,
    };
    try {
      summary.bytes = fs.statSync(paths.dbPath).size + dirBytes(paths.filesDir);
      const db = new Database(paths.dbPath, { readonly: true, fileMustExist: true });
      try {
        const count = (table: string) => (db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;
        const org = db.prepare('SELECT name, kick_start_date FROM organisation ORDER BY rowid LIMIT 1').get() as
          | { name: string; kick_start_date: string | null } | undefined;
        summary.name = org?.name ?? slug;
        summary.since = org?.kick_start_date ?? null;
        summary.policies = count('policy');
        summary.clients = count('client');
        summary.users = (db.prepare("SELECT COUNT(*) AS n FROM app_user WHERE status = 'active'").get() as { n: number }).n;
        summary.documents = (db.prepare('SELECT COUNT(*) AS n FROM policy_document WHERE storage_key IS NOT NULL').get() as { n: number }).n;
        const seen = db.prepare("SELECT MAX(last_seen_at) AS at FROM session WHERE kind = 'staff'").get() as { at: string | null };
        summary.lastSeen = seen.at;
      } finally {
        db.close();
      }
    } catch (error) {
      summary.problem = error instanceof Error ? error.message : String(error);
    }
    return summary;
  });
}
