# Deploying Insurhelp to Hostinger

## Which Hostinger plan

**You need a VPS.** Insurhelp is a Node.js server with a native module
(`better-sqlite3`) and a long-running process that owns a SQLite file.

| Plan | Works? | Why |
| --- | --- | --- |
| Shared (Premium / Business) | **No** | PHP-oriented. No persistent Node process, and native modules cannot be compiled. |
| Cloud hosting | **No** | Same runtime as shared, with more resources. |
| **VPS (KVM 1 and up)** | **Yes** | Full root, your own Node, your own process manager. |

KVM 1 (1 vCPU, 4 GB) is comfortable for a single agency. Pick Ubuntu 22.04 or
24.04 when you create it.

If you would rather not run a server, this also deploys unchanged to Railway,
Render or Fly.io — all three build on the host, which is what the native module
needs. Vercel is the one place it will *not* work as-is: its filesystem is
read-only and does not survive between requests, so the SQLite database would
be lost. Moving to Postgres is what that would need.

## First deploy

Everything below is run over SSH as root, then as a non-root `insurhelp` user.

### 1. Prepare the server

```bash
adduser --system --group --home /var/www/insurhelp insurhelp
apt update && apt install -y curl git nginx sqlite3 build-essential

curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs
npm install -g pm2

mkdir -p /var/log/insurhelp
chown insurhelp:insurhelp /var/log/insurhelp
```

`build-essential` matters: `better-sqlite3` falls back to compiling from source
if no prebuilt binary matches your Node version.

### 2. Get the code

```bash
cd /var/www
git clone <your-repo-url> insurhelp
cd insurhelp
chown -R insurhelp:insurhelp /var/www/insurhelp
```

### 3. Configure

```bash
cp .env.example .env.production
openssl rand -hex 32        # paste into IH_SECRET
nano .env.production
chmod 600 .env.production
chown insurhelp:insurhelp .env.production
```

`IH_SECRET` is not optional — the app throws on start-up in production without
it rather than fall back to the development value, which is in this repository.

Create the data directories:

```bash
mkdir -p /var/www/insurhelp/data/documents
chown -R insurhelp:insurhelp /var/www/insurhelp/data
```

`data/documents` holds the policy PDFs the insurers issued. They are kept on
disk rather than in the database — a schedule runs to a megabyte or more, and
hundreds of them would multiply the size of every backup copy for bytes that
never take part in a query. The consequence is that **the database is not a
complete backup on its own**: restore it without the documents directory and
every policy shows an attachment that will not open. `deploy/backup.sh` takes
both.

### The daily renewal run

Renewal notices are built and sent by a scheduled call. Add to the app user's
crontab, after setting `IH_CRON_SECRET` in `.env.production`:

```cron
0 9 * * *  curl -fsS -X POST -H "authorization: Bearer $IH_CRON_SECRET" \
             https://insurhelp.example.my/api/cron/renewal-notices >/dev/null
```

Without `IH_CRON_SECRET` the route returns 503 and does nothing — an endpoint
that messages clients is not left open by default. `GET` on the same path says
whether it is configured, without running.

### 4. Build and start

```bash
su - insurhelp -s /bin/bash
cd /var/www/insurhelp
npm ci
npm run build
pm2 start ecosystem.config.cjs
pm2 save
exit

pm2 startup systemd -u insurhelp --hp /var/www/insurhelp   # as root
```

The database is created and seeded on the first request.

### 5. Put Nginx in front

```bash
cp deploy/nginx.conf /etc/nginx/sites-available/insurhelp
# edit server_name to your domain
ln -s /etc/nginx/sites-available/insurhelp /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

Point your domain's A record at the VPS in Hostinger's DNS panel, wait for it to
resolve, then:

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d insurhelp.example.com
```

The `client_max_body_size 20m` in the supplied config is deliberate — Nginx
defaults to 1 MB, which rejects a typical policy PDF before the app sees it.

### 6. Lock the box down

```bash
ufw allow OpenSSH && ufw allow 'Nginx Full' && ufw enable
```

Port 3000 stays closed; only Nginx reaches it.

## Updating

```bash
su - insurhelp -s /bin/bash
cd /var/www/insurhelp
./deploy/deploy.sh
```

The build runs on the server on purpose. `better-sqlite3` compiles against the
Node version and CPU architecture it will run on, so a bundle built on your
laptop will not load on the VPS.

## Backups

The whole system is one SQLite file. Losing it loses everything.

```bash
crontab -e -u insurhelp
# 0 2 * * * /var/www/insurhelp/deploy/backup.sh
```

`deploy/backup.sh` uses `sqlite3 .backup`, which takes a consistent snapshot
while the app is running — copying the file directly can capture a half-written
transaction. It keeps 30 days and gzips each one. Copy them off the server too;
a backup on the same disk is not a backup.

## Before you let anyone else in

The seeded demo accounts (`exemaster3@gmail.com` and `boonseng_agent@yahoo.com`,
both `12345Abcdefg`) are in the seed file and therefore in your repository.
Delete them and create your own before the site is reachable:

```bash
sqlite3 /var/www/insurhelp/data/insurhelp.db \
  "DELETE FROM app_user WHERE email IN ('exemaster3@gmail.com','boonseng_agent@yahoo.com');"
```

Also worth knowing before real clients are on it:

- **Sign-in is throttled** to 8 attempts per 15 minutes, per address and per
  email. That count is held in memory, so it resets on restart and does not
  work across multiple instances. Run one instance, or move the counter to the
  database before running two.
- **Every change is recorded.** `/audit` holds who did what, including refused
  attempts, with the actor's name and role denormalised so a deleted user does
  not erase the history.
- **There is one role, `admin`.** Every signed-in user can see and do everything
  within their own organisation, including approving their own commission. What
  they cannot do is reach another organisation's data: every query is scoped by
  `org_id`, and an id posted from a form is checked against it.
- **Password reset does not exist.** A locked-out user needs you to reset their
  hash directly. Building it needs SMTP, which is not wired up.
- **e-Invoice is not submitted to LHDN.** The billing identity, TIN and
  self-billed flags are captured, but nothing is filed with MyInvois. If the
  agency is over the turnover threshold this has to be handled outside
  Insurhelp.
- **PDPA consent and retention are not tracked.** Nothing records what a client
  agreed to, and nothing ages data out.
- **A batch import reads files one at a time from the browser**, so the 16 MB
  Server Action body limit in `next.config.mjs` is never the constraint — but
  each individual PDF still has to fit under it. Leave `bodySizeLimit` alone.
- **Reading a policy PDF is exact for Liberty, Lonpac and Allianz schedules**
  — measured at 95 of 95 fields on real documents, rules only — and needs
  `ANTHROPIC_API_KEY` to cover every other layout. Without it an unfamiliar
  layout comes through with blanks to fill, and a scanned or photographed PDF
  comes through empty and says so. Keying a policy in by hand is always there.
  See "Reading policy documents" in the README.
- **Restore has not been rehearsed.** `deploy/backup.sh` is written and takes
  both the database and the documents directory, but nobody has yet restored
  from one onto a clean box. Do that once, deliberately, before you rely on it.

## If something breaks

```bash
pm2 logs insurhelp --lines 100     # application errors
pm2 restart insurhelp
tail -f /var/log/nginx/error.log   # proxy errors
```

| Symptom | Cause |
| --- | --- |
| Exits immediately, `IH_SECRET is not set` | `.env.production` missing or not read. Check `env_file` in `ecosystem.config.cjs`. |
| `SQLITE_CANTOPEN` | `data/` does not exist or is not writable by `insurhelp`. |
| `413` when uploading a PDF | `client_max_body_size` is missing from the Nginx config. |
| Upload hangs, no error | The Server Action body limit. It is set to 16 MB in `next.config.mjs`; do not lower it below the 15 MB the upload form advertises. |
| `invalid ELF header` from better-sqlite3 | `node_modules` was copied from another machine. Delete it and `npm ci` on the server. |
