/**
 * Agencies, from the command line.
 *
 *   npm run tenant -- list
 *   npm run tenant -- create --slug bs --name "BS Agency Sdn Bhd" \
 *                            --admin "Boon Seng" --email owner@bs.my --password 'Sturdy-pass-77'
 *
 * Creating an agency is deliberately not something a web request can do: an
 * unknown subdomain must be a 404, not an invitation to make a new agency. It
 * happens here, on the server, by someone with a shell.
 */
import fs from 'node:fs';
import path from 'node:path';
import { openTenantDb } from '../src/lib/db';
import { seedTenant } from '../src/lib/seed-tenant';
import { passwordProblem } from '../src/lib/passwords';
import {
  listTenants, multiTenant, nextFreePort, slugProblem, tenantExists, tenantPaths,
  tenantPort, tenantPortFile, tenantsRoot,
} from '../src/lib/tenant';

function arg(name: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? (process.argv[i + 1] ?? '').trim() : '';
}

function die(message: string): never {
  console.error(`\n  ${message}\n`);
  process.exit(1);
}

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

  const base = process.env.IH_BASE_DOMAIN || '<your base domain>';
  console.log(`
  Agency created.

    Name       ${name}
    Address    https://${slug}.${base}
    Database   ${paths.dbPath}
    Documents  ${paths.filesDir}
    Port       ${port}
    Sign in as ${email}

  Two steps to put it on the air:

    pm2 start ecosystem.config.cjs && pm2 save
    npm run tenant -- nginx > /etc/nginx/sites-available/insurhelp && nginx -t && systemctl reload nginx

  Then point ${slug}.${base} at this server (a wildcard A record covers every
  agency at once) and run certbot for it.

  Its register is empty and its rate card is at each insurer's default —
  correct those under Settings → Rates and insurers before the first policy.
`);
}

function list(): void {
  const slugs = listTenants();
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
        `${documents} document${documents === 1 ? '' : 's'}`,
    );
  }
  console.log('');
}

/** The whole nginx server set, one block per agency, ready to install. */
function nginx(): void {
  const base = process.env.IH_BASE_DOMAIN || 'example.com';
  const slugs = listTenants();
  if (!slugs.length) die('No agencies yet, so there is nothing to serve.');

  const blocks = slugs.map((slug) => {
    const port = tenantPort(slug);
    if (!port) die(`The agency "${slug}" has no port recorded. Write one into ${tenantPortFile(slug)}.`);
    return `
server {
    listen 80;
    listen [::]:80;
    server_name ${slug}.${base};
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name ${slug}.${base};

    # certbot fills these in:
    # ssl_certificate     /etc/letsencrypt/live/${base}/fullchain.pem;
    # ssl_certificate_key /etc/letsencrypt/live/${base}/privkey.pem;

    client_max_body_size 20m;

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
  });

  console.log(`# Insurhelp — generated by: npm run tenant -- nginx
# One server block per agency, each proxying to that agency's own process.
# Anything not named here gets nothing: an unknown subdomain must not land on
# some other agency's book.

server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;
    return 444;
}
${blocks.join('\n')}`);
}

function main(): void {
  if (!multiTenant()) {
    die('IH_TENANTS_DIR is not set, so this install has one shared database. See DEPLOY.md.');
  }
  const command = process.argv[2];
  if (command === 'create') return create();
  if (command === 'list') return list();
  if (command === 'nginx') return nginx();
  die('Usage: npm run tenant -- list | nginx | create --slug <name> --name "<agency>" --admin "<person>" --email <address> --password <password>');
}

main();
