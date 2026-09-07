# Deploying Insurhelp to Hostinger

## Which Hostinger plan

**You need a VPS.** Insurhelp is a Node.js server with a native module
(`better-sqlite3`) and a long-running process that owns a SQLite file.

| Plan | Works? | Why |
| --- | --- | --- |
| Shared (Premium / Business) | **No** | PHP-oriented. No persistent Node process, and native modules cannot be compiled. |
| Cloud hosting | **No** | Same runtime as shared, with more resources. |
| **VPS (KVM 1 and up)** | **Yes** | Full root, your own Node, your own process manager. |

KVM 1 (1 vCPU, 4 GB) is comfortable for a single agency.

### What to install on it

Hostinger asks this while the VPS is being created ("Choose what to install").
Stay on the **Plain OS** tab and choose **Ubuntu**, then **24.04 LTS**.

- Everything below is `apt`, NodeSource and nginx, so **Debian 12** works
  unchanged too. AlmaLinux, Rocky and CentOS need every `apt` line rewritten
  as `dnf`.
- **Do not pick a control panel** (CyberPanel, cPanel, Plesk). They take over
  nginx and ports 80/443, which fights `deploy/nginx.conf`, and they add a
  second administrator login to keep secured.
- **Do not pick the Node.js application template** either. It pins its own
  Node version and process manager; step 1 below installs Node 22 and PM2.

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
git clone -b <the branch you deploy> <your-repo-url> insurhelp
chown -R insurhelp:insurhelp /var/www/insurhelp
```

A public repository clones over HTTPS with no credentials on the server at
all, which is one fewer secret to keep. A private one needs either a **deploy
key** (`ssh-keygen -t ed25519`, the public half added to the repository's
Deploy keys, cloned over `git@github.com:...`) or a personal access token in
the URL; the deploy key is the better of the two, being read-only and scoped
to the one repository.

Either way, nothing secret goes *into* the repository. `.env.production` is
created in the next step inside this working tree and is ignored by git
(`.env.*` is, `.env.example` is not) — that is what keeps `IH_SECRET`, the
first administrator's password and any API key out of a public clone. Check it
stayed that way after any change to `.gitignore`:

```bash
git check-ignore -v .env.production      # must print a matching rule
```

### 3. Configure

```bash
cp .env.example .env.production
openssl rand -hex 32        # paste into IH_SECRET
nano .env.production
chmod 600 .env.production
chown insurhelp:insurhelp .env.production
```

Three of these decide whether the first start works at all:

| Variable | Why it cannot be skipped |
| --- | --- |
| `IH_SECRET` | The app throws on start-up in production without it, rather than fall back to the development value, which is in this repository. |
| `IH_ADMIN_EMAIL` | Your login ID. |
| `IH_ADMIN_PASSWORD` | Your password — 10+ characters with a letter and a number. |
| `IH_AGENCY_NAME` | Optional. The agency's name, shown in the top bar; "My agency" if left blank. Change it later under Team and agency → Company profile. |

The admin pair create the one administrator when the database is created, and
are read only then. **Without them the app refuses to create a database**, so
the first page load fails rather than seeding the demo accounts whose password
is in this repository. Delete both lines once you have signed in.

What that first database holds is **an empty register**: the Malaysian
insurers with their default commission rates, the four renewal reminders, one
organisation named from `IH_AGENCY_NAME`, and your administrator. Not the demo
book — the hundred policies under two invented agencies are development data,
and a demo policy in a real register is indistinguishable from a mistake.

Leave `IH_TENANTS_DIR` commented out. It is the switch for one database per
agency, and setting it means this process serves no agency at all until
`IH_TENANT` names one — every request then fails. A single agency uses `IH_DB`
and `IH_FILES`, which are already filled in. "Several agencies on one server"
below is what to read when a second agency turns up; nothing here has to
change first.

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

The run is a **POST** with the bearer token; a GET answers only to the same
bearer and only says it is wired up. Besides building and sending notices, the
run removes each agency's uploads read but never saved (after seven days) and
sessions past their expiry.

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

The database is created on the first request, with your administrator in it.
If `pm2 logs insurhelp` shows *"will not create its first database in
production without an administrator"*, `IH_ADMIN_EMAIL` and
`IH_ADMIN_PASSWORD` did not reach the process: check them in
`.env.production`, then `pm2 reload ecosystem.config.cjs --update-env`.

### 5. Put Nginx in front

```bash
cp deploy/nginx.conf /etc/nginx/sites-available/insurhelp
sed -i 's/insurhelp\.example\.com/YOUR.DOMAIN/' /etc/nginx/sites-available/insurhelp
ln -sf /etc/nginx/sites-available/insurhelp /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
```

Point your domain's A record at the VPS in Hostinger's DNS panel, wait for it to
resolve, then:

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d insurhelp.example.com
```

If certbot answers **"The requested nginx plugin does not appear to be
installed"**, `python3-certbot-nginx` is missing or certbot came from snap,
which the apt plugin cannot reach (`which -a certbot` says which). Install the
plugin, or drop to the webroot method, which needs no plugin — the shipped
config serves the challenge from `/var/www/certbot` for exactly this case:

```bash
mkdir -p /var/www/certbot
certbot certonly --webroot -w /var/www/certbot -d insurhelp.example.com
```

That writes the certificate but does not touch nginx, so add the TLS block by
hand: copy the port 80 server block, change `listen 80` to `listen 443 ssl`,
add the two `ssl_certificate` lines certbot printed, and leave a port 80 block
that keeps the acme-challenge location and redirects everything else.

**The supplied config has no TLS block, on purpose.** `listen 443 ssl` without
a certificate is a fatal error rather than a warning, so a file that ships the
HTTPS half fails `nginx -t` before certbot can run — and `certbot --nginx`
cannot run against a config that will not parse. Certbot writes that half
itself: it rewrites the port 80 block to listen on 443 with the certificate,
adds a redirect block on 80, and keeps both at renewal.

The `client_max_body_size 20m` in the supplied config is deliberate — Nginx
defaults to 1 MB, which rejects a typical policy PDF before the app sees it.

**You cannot sign in until the certificate is in place.** In production the
session cookie is `Secure` with the `__Host-` prefix, and a browser will not
store such a cookie from a plain `http://` origin. What that looked like was
worse than "nothing": the sign-in action renders the next page inside its own
response, where the just-set cookie is still visible, so **Home appeared once
with every tab and the bell — and the next click landed on the sign-in page**,
with no error anywhere. The app now refuses a sign-in that arrives over plain
http (from the proxy's `X-Forwarded-Proto`, or the browser's `Origin` when
there is no proxy) and names the `https://` address to use; the sign-in page
shows the same warning before anything is typed. Get the domain resolving and
certbot run first, then sign in over `https://`.

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

## Several agencies on one server

Set `IH_TENANTS_DIR=/var/lib/insurhelp/tenants` in `.env.production` and each
agency gets its own database, its own documents, its own port and its own
process. Skip this section for a single agency.

```bash
mkdir -p /var/lib/insurhelp/tenants
chown -R insurhelp:insurhelp /var/lib/insurhelp

su - insurhelp -s /bin/bash
cd /var/www/insurhelp
npm run tenant -- create --slug bs --name "BS Agency Sdn Bhd" \
                  --admin "Boon Seng" --email owner@bs.my --password 'a real one'
exit
```

That prints the agency's port and its address. Then, as root:

```bash
pm2 start ecosystem.config.cjs && pm2 save        # one process per agency
npm run tenant -- nginx > /etc/nginx/sites-available/insurhelp
nginx -t && systemctl reload nginx
```

`ecosystem.config.cjs` reads the tenants directory, so adding an agency and
running `pm2 start` again picks it up without moving the others. The generated
nginx set has one server block per agency and answers anything else with 444 —
an unknown subdomain must not land on somebody's book.

**DNS and the certificate.** A wildcard `A` record (`*.insurhelp.my`) covers
every agency at once. A wildcard certificate needs a DNS-01 challenge:

```bash
certbot certonly --manual --preferred-challenges dns \
        -d 'insurhelp.my' -d '*.insurhelp.my'
```

Per-agency certificates work too (`certbot --nginx -d bs.insurhelp.my`) and
need no DNS API, at the cost of one run per agency.

**Backups** are per agency: `deploy/backup.sh` writes `<agency>-<stamp>.db.gz`
and `<agency>-documents-<stamp>.tar.gz` for each, so restoring one agency
never touches another.

**Sizing.** Each agency is a Node process at roughly 100–150 MB. KVM 1 (4 GB)
comfortably holds a handful; count on about 8 agencies per free gigabyte and
move to a larger plan before that is tight.

## Before you let anyone else in

**A production database is never created with the demo accounts.** On the
first start, with `NODE_ENV=production`, the seed creates one administrator
from `IH_ADMIN_EMAIL` and `IH_ADMIN_PASSWORD` and no demo accounts at all;
without those variables (and without `IH_SEED_DEMO=1`, which you should not
set) the process refuses to create a database and says so. Set the two
variables for the first start, sign in as that account, then remove them —
they are read only when the database is created.

Further accounts are added, disabled and reset under **More → Team and agency
→ Sign-in accounts**. Passwords are ten characters or more with a letter and
a number; the demo password is refused. Nothing is emailed: tell people
their password in person.

If you already have a database that was seeded with the demo accounts
(`exemaster3@gmail.com`, `exemaster1@gmail.com`, `boonseng_agent@yahoo.com`,
all `12345Abcdefg`, all in the repository): Home shows a red banner while any
of them can sign in. Add your own account, sign in as yourself, and
**Disable** them from the same panel. The BS Agency one belongs to the other
seeded organisation; sign in as it and disable it, or:

```bash
sqlite3 /var/www/insurhelp/data/insurhelp.db \
  "UPDATE app_user SET status = 'disabled' WHERE email = 'boonseng_agent@yahoo.com';"
```

A disabled account is refused at sign-in and every session it holds ends at
once.

### Sessions, cookies and headers

Sessions are rows in the database, not signed cookies: the cookie is a random
token, the row has an eight-hour expiry (two for the client portal), and the
row is deleted on sign-out, on a password change (every other session of that
user), when an account is disabled, and when a portal code is withdrawn or
reissued. A cookie copied from a browser is worthless once any of those has
happened. In production both cookies are `Secure`, `HttpOnly`, `SameSite=Lax`
and carry the `__Host-` prefix, so a browser will not send them over plain
HTTP nor accept one set by another host.

Every response carries a Content-Security-Policy with a per-response nonce
(`frame-ancestors 'none'`, `form-action 'self'`, scripts only with the nonce),
HSTS for a year, `X-Frame-Options: DENY`, `nosniff` and a strict referrer
policy. The shipped `deploy/nginx.conf` answers port 80 with a redirect to
HTTPS and nothing else.

The application reads the caller's address from `X-Real-IP`, which nginx sets
from the connection; do not remove that line from the proxy block, or the
sign-in throttle falls back to the end of `X-Forwarded-For`.

Password hashes are scrypt with N=2^17; a hash made under the old parameters
is upgraded the next time that person signs in.

Also worth knowing before real clients are on it:

- **Sign-in is throttled** to 8 attempts per 15 minutes, per address and per
  email, and document readings to 100 per 15 minutes per user. Both counts are
  held in memory and bounded, so they reset on restart. One process per agency
  is exactly right for this: each agency's throttle is its own. Do not run two
  processes for the same agency without moving the counters to the database.
- **Unique keys are enforced by the database** — claim numbers, endorsement
  numbers, agent codes, statement references per insurer, and policy numbers
  per period — once the indexes are created on the first start after this
  version. A database that already holds duplicates cannot take an index; the
  log says which, the index is skipped, and the application-level checks carry
  on. Fix the duplicates and restart.
- **Errors are logged.** Every error a request produces is one JSON line on
  stderr (`pm2 logs`) with the path, the route and the reference shown to the
  person; the person sees an Insurhelp page with a way back, not the
  framework's.
- **Every change is recorded.** `/audit` holds who did what, including refused
  attempts, with the actor's name and role denormalised so a deleted user does
  not erase the history.
- **There is one role, `admin`.** Every signed-in user can see and do everything
  within their own organisation, including approving their own commission. What
  they cannot do is reach another organisation's data: every query is scoped by
  `org_id`, and an id posted from a form is checked against it.
- **Password reset is done by an administrator**, under Team and agency →
  Sign-in accounts, and told to the person in person. There is no self-service
  reset by email, because nothing is wired up to send one.
- **Nothing irreversible happens on one click.** Bulk settlement, bulk approval,
  marking commission paid, deleting or closing a statement, withdrawing portal
  access and removing a document each ask first, with the figures in the
  question; closing a short statement has to be acknowledged and is recorded as
  closed short.
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
| Home appears after sign-in, then every click returns to the sign-in page | You are on plain `http://`. The browser refused the `Secure` cookie; the page rendered once from inside the sign-in response. Newer builds refuse the sign-in and say so. Run certbot, use `https://`. |
| "Invalid Server Actions request" on every sign-in | The proxy rewrote `Host` without its port (nginx `$host` on a non-443 port). The shipped config uses `$http_host`. |
| Exits immediately, `IH_SECRET is not set` | `.env.production` missing or not read. Check `env_file` in `ecosystem.config.cjs`. |
| `SQLITE_CANTOPEN` | `data/` does not exist or is not writable by `insurhelp`. |
| `413` when uploading a PDF | `client_max_body_size` is missing from the Nginx config. |
| Upload hangs, no error | The Server Action body limit. It is set to 16 MB in `next.config.mjs`; do not lower it below the 15 MB the upload form advertises. |
| `invalid ELF header` from better-sqlite3 | `node_modules` was copied from another machine. Delete it and `npm ci` on the server. |
