import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { currentTenant } from './tenant';

/*
 * Where uploaded documents live.
 *
 * On disk rather than in SQLite: a policy schedule runs to a megabyte or more,
 * and putting hundreds of them in the database would multiply the size of
 * every backup copy of it, for bytes that never take part in a query. The
 * directory sits beside the database so the two are backed up together — see
 * deploy/backup.sh.
 */
const DB_PATH = process.env.IH_DB ?? path.join(process.cwd(), 'data', 'insurhelp.db');
const SINGLE_FILES_DIR = process.env.IH_FILES ?? path.join(path.dirname(DB_PATH), 'documents');

/**
 * Where this request's documents live: the agency's own directory when
 * agencies have their own databases, otherwise the one shared directory.
 * A schedule belongs to the agency whose database has the row pointing at it,
 * so the two must live or be deleted together.
 */
function filesDir(): string {
  return currentTenant()?.filesDir ?? SINGLE_FILES_DIR;
}

export const ACCEPTED = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/png': '.png',
} as const;

export type AcceptedType = keyof typeof ACCEPTED;

export function isAccepted(type: string): type is AcceptedType {
  return type in ACCEPTED;
}

/**
 * Guess from the name when the browser sends nothing useful — some send
 * application/octet-stream for a PDF picked from a file manager.
 */
export function contentTypeFor(file: { type: string; name: string }): AcceptedType | null {
  if (isAccepted(file.type)) return file.type;
  const ext = path.extname(file.name).toLowerCase();
  if (ext === '.pdf') return 'application/pdf';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.png') return 'image/png';
  return null;
}

/**
 * Files are keyed by document id, not by the name they were uploaded under.
 * Two agencies both sending "policy.pdf" must not collide, and a filename from
 * a browser is attacker-controlled — it can carry slashes and dots that would
 * walk out of the directory.
 */
function storagePath(key: string): string {
  const safe = path.basename(key);
  return path.join(filesDir(), safe);
}

export function storageKeyFor(orgId: string, docId: string, type: AcceptedType): string {
  // The org id is in the name as well as the row, so a file found on its own
  // still says who it belongs to.
  return `${orgId}__${docId}${ACCEPTED[type]}`;
}

export function writeDocument(key: string, bytes: Uint8Array): void {
  fs.mkdirSync(filesDir(), { recursive: true });
  fs.writeFileSync(storagePath(key), bytes);
}

export function readDocument(key: string): Buffer | null {
  try {
    return fs.readFileSync(storagePath(key));
  } catch {
    // A row whose file has gone is a broken link, not a crash — the caller
    // reports it as missing and the rest of the page still renders.
    return null;
  }
}

export function deleteDocument(key: string): void {
  try {
    fs.unlinkSync(storagePath(key));
  } catch {
    /* already gone — nothing to undo */
  }
}

export function documentExists(key: string): boolean {
  return fs.existsSync(storagePath(key));
}

export function sha256(bytes: Uint8Array): string {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

/** For the deployment notes and the storage figure on Organisation. */
export function storageDir(): string {
  return filesDir();
}

export function storageUsedBytes(): number {
  try {
    const dir = filesDir();
    return fs
      .readdirSync(dir)
      .reduce((sum, name) => sum + fs.statSync(path.join(dir, name)).size, 0);
  } catch {
    return 0;
  }
}
