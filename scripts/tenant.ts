/**
 * Agencies, from the command line.
 *
 *   npm run tenant -- list
 *   npm run tenant -- create --slug bs --name "BS Agency Sdn Bhd" \
 *                            --admin "Boon Seng" --email owner@bs.my --password 'Sturdy-pass-77'
 *   npm run tenant -- suspend bs        # refuse the agency, keep its data
 *   npm run tenant -- resume bs
 *   npm run tenant -- remove bs --yes   # final copy under .removed/, then gone
 *   npm run tenant -- landlord --email you@yourdomain.my --password '...'
 *   npm run tenant -- nginx             # the whole nginx server set
 *   npm run tenant -- cron              # the daily reminder run, every agency
 *
 * Creating an agency is deliberately not something a web request can do: an
 * unknown subdomain must be a 404, not an invitation to make a new agency. It
 * happens here, on the server, by someone with a shell. Suspending and
 * resuming can also be done from the landlord console.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { loadEnvFile } from '../src/lib/env-file';

// The same settings the application reads — IH_TENANTS_DIR, IH_BASE_DOMAIN,
// IH_CRON_SECRET — from the same file, so the documented flow works as
// documented. A value already in the shell wins.
loadEnvFile(path.join(process.cwd(), '.env.production'));

import Database from 'better-sqlite3';
import { openTenantDb } from '../src/lib/db';
import { forgetAgencyContributions, sharedLibraryCounts } from '../src/lib/shared-labels';
import { seedTenant } from '../src/lib/seed-tenant';
import { hashPasswordSync } from '../src/lib/auth';
import { passwordProblem } from '../src/lib/passwords';
import {
  LANDLORD, isSuspended, landlordExists, landlordPaths, landlordPort, landlordPortFile,
  listTenants, multiTenant, nextFreePort, slugProblem, suspendedFile, tenantExists, tenantPaths,
  tenantPort, tenantPortFile, tenantsRoot,
} from '../src/lib/tenant';

function arg(name: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? (process.argv[i + 1] ?? '').trim() : '';
}

function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function die(message: string): never {
  console.error(`\n  ${message}\n`);
  process.exit(1);
}

const base = () => process.env.IH_BASE_DOMAIN || '<your base domain>';

/** The named agency, or an explanation. */
function existing(slug: string): string {
  const bad = slugProblem(slug);
  if (bad) die(bad);
  if (!tenantExists(slug)) die(`There is no agency "${slug}" in ${tenantsRoot()}. See: npm run tenant -- list`);
  return slug;
}

/**
 * PM2 is asked directly when it is here — the tenant processes belong to the
 * same user this runs as — and the command is printed when it is not, so the
 * data change never waits on the process change.
 */
function pm2(args: string[]): boolean {
  try {
    execFileSync('pm2', args, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/* ---------------------------------------------------------------- create */

function create(): void {
  const slug = arg('slug').toLowerCase();
  const name = arg('name');
  const adminName = arg('admin') || 'Administrator';
  const email = arg('email').toLowerCase();
  const password = arg('password');

  const badSlug = slugProblem(slug);
  if (badSlug) die(badSlug);
  if (!name) die('Give the agency its full name: --name "BS Agency Sdn Bhd"');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) die('Give the administrator an email address: --email owner@agency.my');
  const badPassword = passwordProblem(password);
  if (badPassword) die(badPassword);
  if (tenantExists(slug)) die(`The agency "${slug}" already exists at ${tenantPaths(slug).dbPath}`);

  const paths = tenantPaths(slug);
  fs.mkdirSync(path.dirname(paths.dbPath), { recursive: true });
  fs.mkdirSync(paths.filesDir, { recursive: true });

  const db = openTenantDb(paths.dbPath, (fresh) => {
    seedTenant(fresh, { slug, name, admin: { name: adminName, email, password } });
  });
  db.close();

  // The port this agency's process listens on, written down so PM2 and nginx
  // agree on it and adding an agency never moves another's.
  const port = nextFreePort();
  fs.writeFileSync(tenantPortFile(slug), `${port}\n`);

  console.log(`
  Agency created.

    Name       ${name}
    Address    https://${slug}.${base()}
    Database   ${paths.dbPath}
    Documents  ${paths.filesDir}
    Port       ${port}
    Sign in as ${email}

  Two steps to put it on the air:

    pm2 start ecosystem.config.cjs && pm2 save
    npm run tenant -- nginx > /etc/nginx/sites-available/insurhelp && nginx -t && systemctl reload nginx

  Then point ${slug}.${base()} at this server (a wildcard A record covers every
  agency at once) and run certbot for it.

  Its register is empty and its rate card is at each insurer's default —
  correct those under Settings → Rates and insurers before the first policy.
`);
}

/* ------------------------------------------------------------------ list */

function list(): void {
  const slugs = listTenants();
  if (landlordExists()) {
    console.log(`\n  Landlord console  https://${base()}  port ${landlordPort() ?? '—'}`);
  } else {
    console.log('\n  No landlord console yet: npm run tenant -- landlord --email <you> --password <...>');
  }
  const library = sharedLibraryCounts();
  console.log(
    library.labels
      ? `  Reader library    ${library.labels} label${library.labels === 1 ? '' : 's'} for ${library.insurers} insurer${library.insurers === 1 ? '' : 's'}, ${library.trusted} trusted — https://${base()}/landlord/labels`
      : '  Reader library    empty — it fills as agencies save policies from schedules',
  );
  if (!slugs.length) {
    console.log(`\n  No agencies yet in ${tenantsRoot()}. Create one with: npm run tenant -- create --slug ...\n`);
    return;
  }
  console.log(`\n  ${slugs.length} agenc${slugs.length === 1 ? 'y' : 'ies'} in ${tenantsRoot()}:\n`);
  for (const slug of slugs) {
    const paths = tenantPaths(slug);
    const bytes = fs.statSync(paths.dbPath).size;
    let documents = 0;
    try {
      documents = fs.readdirSync(paths.filesDir).length;
    } catch {
      /* no documents directory yet */
    }
    const port = tenantPort(slug);
    console.log(
      `    ${slug.padEnd(20)} port ${String(port ?? '—').padEnd(6)} ${(bytes / 1024 / 1024).toFixed(1)} MB   ` +
        `${documents} document${documents === 1 ? '' : 's'}${isSuspended(slug) ? '   SUSPENDED' : ''}`,
    );
  }
  console.log('');
}

/* ------------------------------------------------------ suspend / resume */

function suspend(): void {
  const slug = existing((process.argv[3] ?? '').toLowerCase());
  if (isSuspended(slug)) die(`"${slug}" is already suspended.`);
  fs.writeFileSync(suspendedFile(slug), `${new Date().toISOString()}\n`);
  const stopped = pm2(['stop', `insurhelp-${slug}`]);
  console.log(`
  ${slug} is suspended. Its address now says so, its data is untouched, and
  the daily run leaves it out.

    ${stopped ? `Its process is stopped (pm2 stop insurhelp-${slug}).` : `To free its memory:  pm2 stop insurhelp-${slug}`}
    To serve the suspended page from nginx rather than the app (as root):
      npm run tenant -- nginx > /etc/nginx/sites-available/insurhelp && nginx -t && systemctl reload nginx

  Resume with:  npm run tenant -- resume ${slug}
`);
}

function resume(): void {
  const slug = existing((process.argv[3] ?? '').toLowerCase());
  if (!isSuspended(slug)) die(`"${slug}" is not suspended.`);
  fs.rmSync(suspendedFile(slug), { force: true });
  const started = pm2(['start', 'ecosystem.config.cjs', '--only', `insurhelp-${slug}`]);
  console.log(`
  ${slug} is back.

    ${started ? `Its process is running again.` : `Start its process:  pm2 start ecosystem.config.cjs --only insurhelp-${slug}`}
    If nginx was serving the suspended page (as root):
      npm run tenant -- nginx > /etc/nginx/sites-available/insurhelp && nginx -t && systemctl reload nginx
`);
}

/* ---------------------------------------------------------------- remove */

/**
 * Gone, but not without a copy. The database is copied with SQLite's own
 * backup (consistent even if something still holds it open) and the documents
 * directory with it, into .removed/ beside the agencies — a directory the
 * listing ignores — and only then is the agency's directory deleted. A
 * customer removed by mistake is a directory moved back.
 */
async function remove(): Promise<void> {
  const slug = existing((process.argv[3] ?? '').toLowerCase());
  if (!flag('yes')) {
    die(`This deletes the agency "${slug}" — its register, its documents, its accounts — after taking a final copy.\n  Run it again with --yes to confirm.`);
  }
  const paths = tenantPaths(slug);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const keep = path.join(tenantsRoot(), '.removed', `${slug}-${stamp}`);
  fs.mkdirSync(keep, { recursive: true });

  const db = new Database(paths.dbPath, { readonly: true });
  await db.backup(path.join(keep, 'insurhelp.db'));
  db.close();
  if (fs.existsSync(paths.filesDir)) fs.cpSync(paths.filesDir, path.join(keep, 'documents'), { recursive: true });

  const deleted = pm2(['delete', `insurhelp-${slug}`]);
  fs.rmSync(path.dirname(paths.dbPath), { recursive: true, force: true });
  // What it taught the shared reader library goes with it; a label only it taught is gone.
  const forgotten = forgetAgencyContributions(slug);

  console.log(`
  ${slug} is removed.

    Final copy   ${keep}${forgotten ? `\n    Its ${forgotten} label${forgotten === 1 ? '' : 's'} in the reader library ${forgotten === 1 ? 'is' : 'are'} forgotten.` : ''}
    ${deleted ? `Its process is gone (pm2 delete insurhelp-${slug}).` : `Remove its process:  pm2 delete insurhelp-${slug} && pm2 save`}
    Take its address out of nginx (as root):
      npm run tenant -- nginx > /etc/nginx/sites-available/insurhelp && nginx -t && systemctl reload nginx

  To bring it back: move ${keep} to ${path.dirname(paths.dbPath)},
  write a port into ${tenantPortFile(slug)}, and pm2 start ecosystem.config.cjs.
`);
}

/* -------------------------------------------------------------- landlord */

/**
 * The landlord's console: a database of its own under the tenants directory,
 * signed into with the same screen as everything else, served at the base
 * domain. Running it again with a password resets the landlord's password —
 * there is no other way to, and a landlord locked out is a service nobody can
 * manage.
 */
function landlord(): void {
  const email = arg('email').toLowerCase();
  const password = arg('password');
  const name = arg('name') || 'Landlord';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) die('Give the landlord a login: --email you@yourdomain.my');
  const bad = passwordProblem(password);
  if (bad) die(bad);

  const paths = landlordPaths();
  const fresh = !fs.existsSync(paths.dbPath);
  fs.mkdirSync(path.dirname(paths.dbPath), { recursive: true });
  fs.mkdirSync(paths.filesDir, { recursive: true });

  const db = openTenantDb(paths.dbPath, (created) => {
    seedTenant(created, { slug: LANDLORD, name: 'Insurhelp — landlord', admin: { name, email, password } });
  });
  if (!fresh) {
    const hash = hashPasswordSync(password);
    const changed = db.prepare('UPDATE app_user SET password_hash = ?, status = ? WHERE lower(email) = ?').run(hash, 'active', email).changes;
    if (!changed) {
      const org = db.prepare('SELECT id FROM organisation ORDER BY rowid LIMIT 1').get() as { id: string };
      db.prepare(
        `INSERT INTO app_user (id, org_id, email, password_hash, name, role, agent_code, phone, status)
         VALUES (?, ?, ?, ?, ?, 'admin', NULL, NULL, 'active')`,
      ).run(`usr-landlord-${Date.now()}`, org.id, email, hash, name);
    }
  }
  db.close();

  if (!fs.existsSync(landlordPortFile())) fs.writeFileSync(landlordPortFile(), `${nextFreePort()}\n`);

  console.log(`
  Landlord console ${fresh ? 'created' : 'updated'}.

    Address    https://${base()}/landlord
    Sign in as ${email}
    Database   ${paths.dbPath}
    Port       ${landlordPort()}

  To put it on the air:

    pm2 start ecosystem.config.cjs && pm2 save
    npm run tenant -- nginx > /etc/nginx/sites-available/insurhelp && nginx -t && systemctl reload nginx

  The base domain (${base()}, and www.) points at it; every agency is a subdomain.
`);
}

/* ----------------------------------------------------------------- nginx */

const ACME = `
    # Certbot's HTTP-01 challenge, before the proxy below claims it. Without
    # this, certbot --webroot hands the challenge to the application, which
    # knows nothing about it, and the certificate is refused. The nginx plugin
    # does not need this; the fallback when that plugin is unavailable does.
    # The ^~ makes it win over the "location /" prefix match.
    location ^~ /.well-known/acme-challenge/ {
        root /var/www/certbot;
        default_type "text/plain";
        access_log off;
    }
`;

function proxyBlock(names: string, port: number): string {
  return `
server {
    listen 80;
    listen [::]:80;
    server_name ${names};
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name ${names};

    # certbot fills these in:
    # ssl_certificate     /etc/letsencrypt/live/${base()}/fullchain.pem;
    # ssl_certificate_key /etc/letsencrypt/live/${base()}/privkey.pem;

    client_max_body_size 20m;
${ACME}
    location / {
        proxy_pass         http://127.0.0.1:${port};
        proxy_http_version 1.1;
        proxy_set_header   Host              $http_host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
    }
}`;
}

/** A suspended agency's address: the same certificate, and a page that says so. */
function suspendedBlock(names: string): string {
  const page =
    '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Insurhelp</title>' +
    '<meta name="viewport" content="width=device-width, initial-scale=1"></head>' +
    '<body style="font-family: system-ui, sans-serif; max-width: 34rem; margin: 6rem auto; padding: 0 1.5rem; color: #111827">' +
    '<h1 style="font-size: 1.25rem">This agency&#39;s access is suspended</h1>' +
    '<p>Please contact whoever provides your Insurhelp service.</p></body></html>';
  return `
server {
    listen 80;
    listen [::]:80;
    server_name ${names};
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name ${names};

    # certbot fills these in:
    # ssl_certificate     /etc/letsencrypt/live/${base()}/fullchain.pem;
    # ssl_certificate_key /etc/letsencrypt/live/${base()}/privkey.pem;
${ACME}
    # Suspended: nothing reaches the application.
    location / {
        default_type text/html;
        return 503 '${page}';
    }
}`;
}

/** The whole nginx server set, one block per agency, ready to install. */
function nginx(): void {
  const slugs = listTenants();
  if (!slugs.length && !landlordExists()) die('No agencies yet, so there is nothing to serve.');

  const blocks: string[] = [];
  if (landlordExists()) {
    const port = landlordPort();
    if (!port) die(`The landlord has no port recorded. Write one into ${landlordPortFile()}.`);
    blocks.push(proxyBlock(`${base()} www.${base()}`, port));
  }
  for (const slug of slugs) {
    const names = `${slug}.${base()}`;
    if (isSuspended(slug)) {
      blocks.push(suspendedBlock(names));
      continue;
    }
    const port = tenantPort(slug);
    if (!port) die(`The agency "${slug}" has no port recorded. Write one into ${tenantPortFile(slug)}.`);
    blocks.push(proxyBlock(names, port));
  }

  console.log(`# Insurhelp — generated by: npm run tenant -- nginx
# One server block per agency, each proxying to that agency's own process;
# the base domain to the landlord console; a suspended agency to a page that
# says so. Anything not named here gets nothing: an unknown subdomain must
# not land on some other agency's book.

server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;
    return 444;
}
${blocks.join('\n')}`);
}

/* ------------------------------------------------------------------ cron */

/**
 * The daily run, for every agency.
 *
 * Each agency is its own process, and the scheduled route serves the agency
 * of the process it lands on — so one call reaches one book. A reminder
 * service with ten tenants and one cron line would remind one of them. This
 * visits each agency's process on its own port, with the same bearer the
 * route demands, and says per agency what went out. It is what the crontab
 * should call on a multi-agency server:
 *
 *   0 9 * * *  cd /var/www/insurhelp && npm run tenant -- cron >> /var/log/insurhelp/cron.log 2>&1
 */
async function cron(): Promise<void> {
  const secret = process.env.IH_CRON_SECRET ?? '';
  if (secret.length < 16) die('IH_CRON_SECRET is not set (or is shorter than 16 characters), so the scheduled run is disabled. Set it in .env.production.');
  const slugs = listTenants();
  if (!slugs.length) die('No agencies yet, so there is nothing to run.');

  let failed = 0;
  let ran = 0;
  for (const slug of slugs) {
    if (isSuspended(slug)) { console.log(`  ${slug.padEnd(20)} suspended — left out`); continue; }
    const port = tenantPort(slug);
    if (!port) { console.log(`  ${slug.padEnd(20)} no port recorded — skipped`); failed++; continue; }
    ran++;
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/cron/renewal-notices`, {
        method: 'POST',
        headers: { authorization: `Bearer ${secret}` },
        signal: AbortSignal.timeout(5 * 60 * 1000),
      });
      const body = (await res.json().catch(() => ({}))) as {
        runs?: Array<{ queued?: number; sent?: number; waiting?: number; failed?: number; swept?: number }>;
        expiredSessionsRemoved?: number; error?: string;
      };
      if (!res.ok) { console.log(`  ${slug.padEnd(20)} HTTP ${res.status}${body.error ? ` — ${body.error}` : ''}`); failed++; continue; }
      const sum = (k: 'queued' | 'sent' | 'waiting' | 'failed' | 'swept') => (body.runs ?? []).reduce((n, r) => n + (r[k] ?? 0), 0);
      console.log(
        `  ${slug.padEnd(20)} ${sum('queued')} built, ${sum('sent')} sent, ${sum('waiting')} waiting, ` +
          `${sum('failed')} failed; ${sum('swept')} abandoned upload${sum('swept') === 1 ? '' : 's'} removed, ` +
          `${body.expiredSessionsRemoved ?? 0} expired session${body.expiredSessionsRemoved === 1 ? '' : 's'}`,
      );
      if (sum('failed') > 0) failed++;
    } catch (error) {
      console.log(`  ${slug.padEnd(20)} could not be reached on port ${port}: ${error instanceof Error ? error.message : String(error)}`);
      failed++;
    }
  }
  console.log(`\n  ${new Date().toISOString()}  ${ran} agenc${ran === 1 ? 'y' : 'ies'} run, ${failed} with a problem`);
  if (failed) process.exit(1);
}

/* ------------------------------------------------------------------ main */

async function main(): Promise<void> {
  if (!multiTenant()) {
    die('IH_TENANTS_DIR is not set, so this install has one shared database. See DEPLOY.md.');
  }
  const command = process.argv[2];
  if (command === 'create') return create();
  if (command === 'list') return list();
  if (command === 'suspend') return suspend();
  if (command === 'resume') return resume();
  if (command === 'remove') return remove();
  if (command === 'landlord') return landlord();
  if (command === 'nginx') return nginx();
  if (command === 'cron') return cron();
  die(
    'Usage: npm run tenant -- list | nginx | cron\n' +
    '       npm run tenant -- create --slug <name> --name "<agency>" --admin "<person>" --email <address> --password <password>\n' +
    '       npm run tenant -- suspend <slug> | resume <slug> | remove <slug> --yes\n' +
    '       npm run tenant -- landlord --email <address> --password <password> [--name "<person>"]',
  );
}

main().catch((error) => die(error instanceof Error ? error.message : String(error)));
