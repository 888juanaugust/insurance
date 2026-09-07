# Insurhelp

A Next.js application for a Malaysian general-insurance agency: clients, motor and
non-motor policies, premium collection, remittance to principals, and sub agent
commission — with policy documents read straight out of the insurer's PDF.

Field lists and workflows follow how Malaysian agencies actually work — the money
trail, the statutory compliance dates, the split between what a client owes you and
what you owe the insurer.

Deploying it: see **[DEPLOY.md](DEPLOY.md)**.

## Running it

```bash
npm install
npm run dev          # http://localhost:3000
```

Sign in with one of the seeded accounts:

| Login ID | Password | Organisation |
| --- | --- | --- |
| `exemaster3@gmail.com` | `12345Abcdefg` | EXE Cheras |
| `exemaster1@gmail.com` | `12345Abcdefg` | EXE Cheras |
| `boonseng_agent@yahoo.com` | `12345Abcdefg` | BS Agency |

These are **demo accounts whose password is in this file**. The application knows
which they are: while any of them can still sign in, Home carries a red banner and
the Sign-in accounts panel under Team and agency flags them. Add your own account
there, sign in as yourself, and disable them before the site is reachable from
outside — see "Sign-in accounts" below and DEPLOY.md. The sign-in page itself
shows no credentials.

The SQLite database is created and seeded automatically at `data/insurhelp.db` on first
request. `npm run db:reset` deletes it so the next request reseeds from scratch.

```bash
npm run build && npm start   # production build
npm run typecheck            # tsc --noEmit
```

## What is in it

Routes and field lists follow a teardown of the SimSuite staging app, so paths match
(`/team`, `/client-groups`, `/insurance/general-motor`, `/settings`) rather than being
invented.

| Module | Route | Notes |
| --- | --- | --- |
| Client portal | `/portal`, `/portal/login`, `/portal/policy/[id]` | What a client sees of their own insurance. Separate sign-in, separate session, separate queries. |
| Import | `/import` | Bring an existing book across from a spreadsheet. Every row is checked and shown before anything is written. |
| Search | `/search`, and a box in the rail | One box over policies, clients, claims, endorsements, sub agents and documents. Ctrl/⌘+K from anywhere. |
| Home | `/` | The agent's desk: add a policy, find a client, and what is running out — then the agency figures underneath. |
| Add a policy | `/add` | Three doors: one schedule, a whole stack of them, or key it in by hand. |
| Read a batch | `/insurance/[cls]/upload?bulk=1` | Up to forty schedules in one sitting, judged one by one, saved together. |
| Expiring soon | `/expiring` | The worklist. Every policy running out, worst first, including the ones that already have. |
| Everything else | `/more` | Claims, money, reports and settings, in one page, off the daily path. |
| Audit trail | `/audit` | Every change, refusal and sign-in. |
| Sub Agents | `/team`, `/team/new`, `/team/[id]/edit` | Add, edit, deactivate and delete sub agents. Commission structure per agent plus bank and TIN details for self-billed e-Invoice. Agent codes are unique, a rate that would pay out more than the principal pays in is refused, and an agent carrying policies cannot be deleted. |
| Organisation | `/organisation` | Editable company particulars, invoice letterhead and collection account, plus subscription terms and quota usage. Each panel saves on its own, so a shared field edited in either place lands in the same column. |
| Clients | `/clients`, `/clients/new`, `/clients/[id]`, `/clients/[id]/edit` | Add, edit and delete clients — individual or company. NRIC fills the date of birth, duplicate identification is refused, and a client carrying policies cannot be deleted. |
| Grouping Client | `/client-groups` | Group accounts and their members. |
| Client Planning | `/client-planning` | Life and medical plans held alongside the general book. |
| Insurance | `/insurance/general-motor`, `/insurance/non-motor` | Policy registers, 25 columns: principal chips (20 insurers), 15 class-of-business tabs on non-motor, date-range / vehicle / insured / NRIC search, sortable columns, totals row, pagination, CSV export, and bulk client/principal settlement. |
| Upload PDF | `/insurance/[cls]/upload` | Read a policy document of any layout and add it to the register. The file itself is kept — see below. |
| Create / edit policy | `/insurance/[cls]/new`, `/insurance/[cls]/[id]/edit` | Key a policy in or correct one. |
| Renewal notices | `/renewals/notices` | The outbox: what is going out to clients whose cover is running down, and what has already gone. |
| Retention | `/reports/retention` | What was renewed, what lapsed, and what the lapses cost. |
| Quotations, Reconcile, Renewals, Employee Benefits | `/insurance/…` | Open quotations, receivable-vs-payable position, expiring cover, group schemes. |
| Policy schedule | `/insurance/[cls]/[id]` | Full schedule: parties, vehicle or risk particulars, premium computation, extensions, collection and remittance. Collection can be recorded from this page, and a policy nothing has been paid on can be deleted — see below. |
| Reports | `/reports/...` | Agent commission, monthly sales, company commission breakdown, outstanding premium ageing. |
| Accounting | `/accounting` | Approve commission and mark it paid. |
| Insurer statements | `/accounting/statements`, `/accounting/statements/new`, `/accounting/statements/[id]` | Check what an insurer actually paid against what the register booked. |
| Setting | `/settings` | Per-user e-Invoice billing identity and password change. Organisation-wide settings sit under `/settings/global` (editable commission rates per insurer and class, the letterhead, the insurer list), `/settings/renewal` and `/settings/notifications`. |
| Endorsements | `/endorsements`, `/endorsements/new`, `/endorsements/[id]`, `/endorsements/[id]/edit` | Mid-term changes to cover, with the additional or return premium worked out and shown before saving. |
| Claims | `/claims`, `/claims/new`, `/claims/[id]`, `/claims/[id]/edit` | Motor and non-motor claims from the first phone call to settlement, with the no-claim-discount consequence stated on every one. |
| Quotations | `/insurance/quotations` | Quote pipeline: drafts, sent, accepted, rejected, converted. |
| Renewals | `/insurance/renewals` | Inbox, expiring and history, with create-quotation / process / reject. |
| Documents | `/documents/loc/[id]`, `/documents/receipt/[id]` | Letter of collection and receipt, laid out for printing to PDF. |
| User Guide / Contact Us | `/user-guide`, `/contact-us` | Module reference and support details. |

## Reading policy documents

`Add a policy` offers two doors with equal standing: upload the schedule the insurer issued,
or key the policy in by hand. Both land on the same form, and nothing is saved until you have
seen it. The manual door is not a fallback — a cover note read over the phone, an insurer the
reader has never seen, or a scanned page with no model configured all end the same way, with
somebody typing, and that should not have to start with a file they do not have.

The upload runs in two passes:

1. **Pattern rules** (always, offline, free). The PDF is re-laid-out by text position so each
   visual row becomes one line. Then the insurer is identified from its signature, and if a
   **profile** exists for that insurer it reads the schedule by *shape* — Liberty prints the
   plate on a line of its own three rows below a label it shares with two others; Allianz
   prints `L15ZF9307373 1498.00 CC` with no label at all; Lonpac puts two labelled values on
   one line. Generic bilingual English/Bahasa Malaysia label matching fills whatever the
   profile did not, and everything for an insurer that has no profile yet. Every value is
   validated — a plate has to look like a plate, a premium has to be a plausible amount,
   `gross + tax + stamp` has to equal the total — and anything that fails is discarded
   rather than shown. A wrong value that survives review is worse than a blank one.
2. **The model** (when `ANTHROPIC_API_KEY` is set, and only when needed). Layouts no
   profile covers, and scanned documents with no text layer at all, defeat pattern matching.
   For those the same document goes to Claude — as text when there is a text layer, as a
   PDF `document` block when there is not — and the two readings are merged: agreement
   raises confidence, only-one-has-it fills the gap, and **disagreement is surfaced for you
   rather than settled silently**. The model is *not* sent a document the rules read well:
   `lib/extract/gate.ts` decides, and it says no when the insurer was recognised, the fields
   the register cannot do without were read from labelled matches, and most of the fields a
   schedule usually carries came through. The three profiled insurers pass that every time,
   so they cost nothing. `IH_MODEL_PASS=always` sends everything anyway.

### The reader learns

Whatever the model reads once, the rules should read next time. When a policy is saved with
its schedule attached — from the review form or from a batch — the saved value of every
field is looked for on the page, and the text that sat beside it, or on the line above, is
kept as a **learned label** for that insurer (`lib/extract/learned.ts`, stored per agency in
`learned_label`). It is learned from what the person *saved*, so a correction typed on the
review form teaches the corrected value, not the model's. A learned label is provisional
until a second saved document confirms it: it reads at a confidence below the gate's bar, so
the model still checks the next document of that insurer, and only when the two agree does
the label become trusted and the model stop being called. The review screen says when
learned labels were used and when the model was not needed.

### What it has been measured against

The four real policy documents in the seed — Liberty `WQK100` and `NCF9240`, Lonpac
`DDS7898`, Allianz `MDW9185` — are scored field by field against their hand transcription,
rules only, no API key. Before this pass the reader managed **58%** of the fields. Two bugs
accounted for a lot of it: the validators for engine capacity and year of manufacture only
accepted numbers while the values arrive as text, so both were thrown away on every
document; and a rule requiring the plate to appear twice killed every plate on a two-page
cover note. The rest was layout, and became the three profiles.

It now reads **95 of 95** — every stated field on all four documents, exact to the sen,
and every field a document does *not* state left blank. Three of those were only caught
once the harness stopped tolerating a one-sen difference: the reader had been taking
`Total Due (OTC) RM 1,913.45`, the figure rounded to five sen for a cash till, instead of
the `Total Due RM 1,913.44` above it — and the premium check, seeing gross + tax + stamp
≠ total, then "corrected" a gross that had been right. Counter-rounded lines are refused
now. That is the honest shape of the claim: those four layouts, field for field. An
insurer not in that list gets the generic pass, blanks where it fails, and the model pass
if configured. Send more documents and they can be added to the profiles and measured the
same way.

The review screen labels every field with where its value came from — `confirmed` (both passes
agree), `read`, `read by model`, `calculated` (derived from the other premium figures),
`check this` (low confidence or a disagreement), `not found` — and shows the line of the
document it was read from. Duplicate policy numbers are flagged, and an insured who is already
on file is matched to the existing client rather than duplicated.

Without credentials the upload still works; layouts the rules do not cover simply arrive with
more blanks to fill in, and a scan says plainly that it is a scan. Configure the model pass with:

```bash
export ANTHROPIC_API_KEY=sk-ant-...        # enables the second pass
export IH_MODEL_PASS=when-needed           # optional: when-needed (default) | always | never
export IH_EXTRACT_EFFORT=medium            # optional: low | medium (default) | high | xhigh | max
export IH_EXTRACT_MODEL=claude-opus-5      # optional, this is the default
export IH_FILES=/path/to/documents         # optional, defaults beside the database
```

## Roles

One role: **admin**. Everyone who can sign in to the agency application can do
everything in it — clients, policies, renewals, collections, commission, sub
agents, organisation settings and the audit trail.

The check is kept rather than removed, because it still decides one real thing:
**an account whose role is anything else grants nothing**. That covers a stale
row, a hand-edited database, and the `client` role the unbuilt portal will use —
none of which should reach the agency screens. It fails closed, which is the only
sensible direction for a default. A refused account is sent to a page that names
the role actually on it, and the attempt goes to the audit trail.

A database written before this change is migrated on the next start: `master`,
`manager`, `finance`, `agent` and `viewer` all become `admin`, so nobody who had
a working account loses it. `client` is deliberately left alone.

Bringing graded roles back means widening `isAdmin` in `src/lib/permissions.ts`
into a permission lookup and giving `authorise` a permission argument again.
Every mutation already routes through it, so nothing else has to move.

### Sessions

Sessions live in the `session` table (`src/lib/session-store.ts`). The cookie
carries a random 32-byte token and nothing else; the row, keyed by the token's
SHA-256, carries the expiry — eight hours for staff, two for the portal — and
is deleted on sign-out, on a password change (every other session that person
holds), when an account is disabled or reset, and when a portal code is
withdrawn or reissued. The old cookie was a signed user id: it never expired
on the server, sign-out did not touch it, a password change did not touch it,
and it was the same string every time, so a copy taken once worked forever.

In production the cookies are `Secure`, `HttpOnly`, `SameSite=Lax` with the
`__Host-` prefix. The caller's address comes from `X-Real-IP`, which nginx
sets from the connection; the first element of `X-Forwarded-For` is whatever
the client sent, which is why it is not used (`src/lib/request.ts`).

Passwords are scrypt with explicit parameters (N=2^17, r=8, p=1, a 64-byte key)
and the parameters written into the hash; an older hash verifies at the old
parameters and is replaced at the next sign-in (`src/lib/auth.ts`). The request
paths use the asynchronous form so a derivation does not stall the process.

### Headers

`src/middleware.ts` sets a Content-Security-Policy with a fresh nonce on every
response — scripts run only with the nonce, `frame-ancestors 'none'`,
`form-action 'self'`, `object-src 'none'` — and `next.config.mjs` adds HSTS,
`X-Frame-Options: DENY`, `nosniff`, a strict referrer policy and an empty
permissions policy. The middleware decides nothing about who is signed in;
every page and action checks that itself, so bypassing it gains nothing.
The inline theme script in the root layout takes its nonce from the request.

### One agency, one database

Setting `IH_TENANTS_DIR` gives every agency its own directory —

```
/var/lib/insurhelp/tenants/<agency>/insurhelp.db
/var/lib/insurhelp/tenants/<agency>/documents/
/var/lib/insurhelp/tenants/<agency>/port
```

— and its own Node process, pinned by `IH_TENANT`. A query that forgets its
organisation can then only reach rows the agency already owns; a backup is one
directory; a customer who leaves is one directory removed. The `org_id`
columns and every check on them stay exactly as they were: two defences that
fail differently is the point of having both.

**Why a process each rather than choosing the database per request.** Choosing
per request needs the agency bound before React begins rendering, and Next
gives no place to do that — an `AsyncLocalStorage` entered inside a page does
not reach the code the page then calls, which was measured, not assumed. A
pinned process reads its agency from the environment, synchronously, with
nothing to propagate and nothing to leak between requests. The isolation also
goes further than the file: separate memory, separate sign-in throttle,
separate crash. The cost is memory per agency, which is what a VPS plan is
sized by.

`IH_BASE_DOMAIN` turns the address into a check: a request for
`exe.insurhelp.my` that reaches the `bs` process is refused rather than
answered out of the wrong book, so a misconfigured proxy cannot silently cross
two agencies.

```bash
npm run tenant -- create --slug bs --name "BS Agency Sdn Bhd" \
                  --admin "Boon Seng" --email owner@bs.my --password '...'
npm run tenant -- list      # agencies, their ports, their sizes
npm run tenant -- nginx     # the whole nginx server set, one block per agency
```

Creating an agency is a shell command, never a web request: an unknown
subdomain must be a 404, not an invitation to make a new agency. A new agency
starts with the insurer list, a rate card at each insurer's default, the four
renewal reminders and one administrator — and an empty register.
`ecosystem.config.cjs` reads the tenants directory and defines one PM2 process
per agency, so `pm2 start` after creating one picks it up and nothing about
the others moves.

Without `IH_TENANTS_DIR` the application is exactly what it was: one database
at `IH_DB`. That is what development, the tests and a single-agency install
use.

### Tenant isolation

Every lookup that returns one record takes the organisation as part of the
query — `getPolicy(id, orgId)`, `getClient(id, orgId)` — rather than checking
it afterwards, so no call site can forget. Ids posted from forms (a client, a
sub agent, a client group, a policy to renew, a policy to request renewal on)
are checked against the caller's organisation before anything is written or
logged with their contents. The sweep of abandoned uploads is per agency and
runs at most hourly per agency and from the daily run, not on every file of a
batch. Record ids are UUIDs from the CSPRNG.

### First start in production

The seed will not create the demo accounts in production. It creates the
administrator named by `IH_ADMIN_EMAIL` and `IH_ADMIN_PASSWORD` instead, and
refuses to create a database at all if neither that nor `IH_SEED_DEMO=1` is
set. See DEPLOY.md.

### Sign-in accounts

**Team and agency → Sign-in accounts** lists everyone who can sign in to the
agency, and is where accounts are added, disabled, re-enabled and given a new
password. Until this existed the only accounts were the seeded ones and the only
way to retire one was a shell on the server; "delete the demo accounts before
go-live" was advice nobody could follow from inside the product.

- Passwords are at least 10 characters with a letter and a number, the same rule
  for a new account, a reset and a person changing their own (`src/lib/passwords.ts`).
  The seeded demo password is refused outright.
- You cannot disable the account you are signed in with, and you cannot disable
  the last active account in the agency — add another first.
- A disabled account is refused at sign-in and any session it holds ends at its
  next request.
- The seeded accounts are flagged **seeded demo account** while active; an
  account created by hand that still uses the seeded password is flagged
  **demo password** (the hash is checked against it on that page only). Home
  shows a banner while any seeded account in the agency can still sign in.
- Every one of these actions is on the audit trail, including refusals.

Passwords are never emailed. Tell the person theirs in person.

### Before it does anything irreversible

Six controls settled money, destroyed a statement or withdrew a client's access
the instant they were pressed. Each now asks first, and the question carries the
consequence — "record RM 4,120.00 as collected across 3 policies" — rather than
"are you sure" (`src/components/Confirm.tsx`):

| Control | What the question says |
| --- | --- |
| Bulk client paid / Bulk principal paid | The sum and count that would be settled, unpaid legs only |
| Approve everything pending | The count and sum being approved |
| Send approved back to pending | The count and sum going back (the old label, "Bulk reject (all pending)", said the opposite of what it did) |
| Mark paid on a commission row | That paid is final |
| Delete on a statement | The line count, the sum, and that every assignment made against it goes too |
| Close it off on a statement | See below |
| Withdraw access on a client's portal | That their code stops at their next click |
| Remove on an attached document | That the file is deleted from the server |

**Close it off** also checks. A clean statement closes with one confirmation. One
that is short, has unplaced lines or cases left off is offered **Close it off
anyway**, which names the unaccounted sum and posts an acknowledgement; the
server refuses to close a short statement without it (and records the refusal),
and the audit entry for a statement closed short says so and by whom.

The two report buttons on Accounting that did nothing have gone; the tables
recalculate on every visit.

## Audit trail

`/audit` records every mutation, every refusal, and every sign-in — who, what,
when, from where, and which fields changed.

Refusals are the point. A trail that only records successes cannot answer the
question people actually bring to it, so a blocked attempt is written before it is
turned away, and page-level refusals are recorded too — someone walking the URL
space looking for a screen that forgot to check is exactly what should show up.
Rules that refuse on their own terms — deleting a policy that has been paid,
deleting a client that still carries cover — are recorded the same way, marked
`refused` rather than `blocked`.

The actor's name and role are stored as they stood at the time. An audit trail
that reads *"(deleted user) approved RM 4,200"* has lost the thing it exists to
record.

Field-level changes are stored as a before/after diff of **only what moved** —
storing the whole record on every save buries the one changed field under thirty
that stayed the same, which is how a trail stops being read. Writing an entry can
never fail a save: a broken audit write is logged to the server and swallowed,
because a trail that can break the application is worse than no trail.

## Deleting a policy

A policy is the record that a payment relates to something. Once the client has paid, the
principal has been remitted, or commission has moved past `pending`, deleting it would leave
a payment pointing at nothing — so those policies refuse deletion and name the reason, and
the schedule is cancelled through the edit form instead. The status says what happened and
the money keeps its paper trail.

Where deletion is allowed, it takes the payments, commission, vehicle or risk detail,
extensions, documents and renewal requests with it, and detaches any quotation that
converted into it. The schema declares those cascades, but they only fire while
`PRAGMA foreign_keys` is on, and an orphaned commission row keeps counting towards its
agent's total on `/team` — so the children go explicitly rather than on trust. The check
runs again inside the action, because the page offering the button may be minutes old.

## Commission rates

`/settings/global` edits the rate the agency earns per insurer and class. The insurer's own
rate is the ceiling: above it the register would book commission that never arrives, so the
save is refused with the figure — *ALLIANZ pays 10% on motor. A rate of 15% would book
commission the insurer never pays.* Changing a rate sets the default for the **next** policy
created; policies already written keep the rate they were written at, and the confirmation
says so rather than leaving it to be discovered.

## Checking an insurer's statement

An agency books its commission when it writes the policy. The insurer pays a month or two
later, on a statement of its own, and the two disagree more often than anyone would like: a
case is left off, a rate is applied at the motor 10% when the class earns 25%, a cancellation
claws back a case that was never paid in the first place. Nobody notices, because reading a
three-hundred-line statement against a register by eye is a day's work that pays nothing on
the days it agrees.

`/accounting/statements/new` takes the statement as CSV, sets every line against the register
and shows the result before anything is stored. Headers are matched loosely and in both
languages — `Policy No.`, `No Polisi` and `Certificate No` all find the same column. A
statement needs two things to be worth reading: something to identify the case by (policy
number, cover note or vehicle registration) and the commission paid. Amounts in brackets are
read as negative, because that is how a clawback is written.

Lines are matched on the strongest identifier available, in that order. Punctuation is
ignored, so the register's `KG_Z0137577` and the insurer's `KG-Z0137577` are the same case. A
registration alone is the last resort and is refused when two years of cover sit on one plate
and nothing separates them — booking the money against the wrong year hides both.

The comparison is **per case, not per line**: an instalment statement that pays one policy
twice is judged on the sum of both. Four things can come out of it:

| | What it means |
| --- | --- |
| **Agreed** | Paid what the register expected, to the sen. |
| **Short paid** | Paid less. This is the money to chase, and the reason to open the page. |
| **Overpaid** | Paid more — usually a commission rate on file that is out of date. |
| **Left off** | Business the register says this insurer booked over the period, that no line pays for. |
| **Not on the register** | The insurer paid for a case Insurhelp cannot find. |

Short payments and business left off are added together as what is outstanding.
Overpayments are deliberately **not** netted against them: an insurer that overpaid one case
takes it back on a later statement of its own, and setting the two off against each other
hides the shortfall that has to be chased this week.

A line the matcher could not place is imported anyway and waits for a person: assign it to a
case by hand, or set it aside with a reason. The reason is required — a written-off difference
nobody can answer for three months later is worse than an open one. Both decisions stick: a
re-match does not overrule them.

Importing a statement changes nothing on the register. It is a reading of the two side by
side, kept so it can be shown to the insurer.

The period is the months of business the statement answers for, matched on production date
(issue date, falling back to created and then effective) rather than when the money arrived.
The same statement cannot be imported twice under one reference — doing so would double every
figure on it.

## Reading a stack at once

`/insurance/general-motor/upload?bulk=1` takes as many schedules as an agent
has to hand — a month of business, or a book being brought across.

The files are read **one at a time, each in its own request**. A batch posted
as one body would be rejected whole for exceeding the Server Action body limit,
and with it the twenty-nine files that were fine; one at a time also means the
rows fill in as they land rather than the agent watching a spinner, and a file
that cannot be read costs only itself.

Each reading is then judged, and only a clean one is offered for an unattended
save:

| Verdict | What it means | Can it be ticked? |
| --- | --- | --- |
| **ready** | Everything a policy needs, read confidently, no duplicate. | Yes, and ticked by default. |
| **needs a look** | Something is missing, uncertain, or the premium figures disagree. The reason is shown on the row. | No. The row links to **Open it on the check screen**, the same review a single upload gets. |
| **already on file** | The policy number, or the file itself, is on the register. | No. The row links to the one on file. |
| **could not read** | The PDF defeated both passes. | No. |

Motor or non-motor is decided from each document — anything with a vehicle,
chassis or engine number is motor — whichever register the batch was started
from, and the table says which in a Class column.

The judging is deliberately strict, because a batch save that quietly writes a
policy with the wrong premium is worse than one that asks: nobody looks again
at a row that said "saved". A cover note is always flagged, with the reason
that the number is the cover note's and the insurer has not issued a policy
number yet — that row will need correcting when it does.

Saving re-reads the extraction **from the stored document**, not from the
browser, **judges it again on the server**, and builds the policy through the
same function the review form uses. Only a reading that is ready goes in: a
document id smuggled into the form for a row the screen would not offer comes
back in the "Left out" list with the reason. What lands on the register is
therefore exactly what was read and shown, and a policy saved in a batch cannot
disagree with one saved on its own about the arithmetic.

A stored reading can be reopened on the check screen at
`/insurance/<class>/upload?doc=<document id>` (`src/lib/reading.ts` rebuilds
the upload state from the document row, looking duplicates and client matches up
afresh). A reading already saved to a policy redirects to that policy.

Uploads read but never saved are swept after seven days, measured on the
application's clock — `today()`, which `IH_TODAY` can pin — not the machine's.
Measured on the machine's clock, a pinned demo swept every reading on the very
next upload, and a batch of five kept only the last.

## What is running out

`/expiring` is the page the application is for. Every policy with cover running down, worst
first, in four piles:

| | |
| --- | --- |
| **Already expired** | Cover has run out and nobody renewed it. The client may be driving uninsured. |
| **Within 7 days** | Call today — a renewal quote takes time to come back. |
| **Within 30 days** | The usual window for getting a renewal out. |
| **31 to 90 days** | Worth a look, nothing urgent. |

Two decisions make it a worklist rather than a report.

It **looks backwards as well as forwards**. `renewalsDue()` only ever looked ahead, which is
the wrong shape: a policy that ran out last Tuesday is the most urgent thing on the desk and
would not have appeared on the list at all. `expiringWork()` runs from sixty days behind to
ninety ahead.

And it **drops work already done** — anything a later policy points at through
`renewed_from_policy_id` is gone from the list, so an agent is never chasing a renewal they
have already written.

Every row carries the client's phone number and two buttons: **Renew**, which opens a new
policy pre-filled from the old one, and **Call**. The badge on the rail counts the first
three piles only; counting ninety days of cover as work due today makes the number useless.

### Follow-ups — the worklist remembers

A list of forty names and phone numbers that remembers nothing gets the same client rung
twice on Tuesday, and forgets entirely the one who said "ring me after payday". One line per
call fixes both, recorded from the row itself rather than a page of its own — a note that is
a nuisance to write does not get written.

Five outcomes: spoke to them, no answer, quote sent, call back later, not renewing. Two of
them move the case off the chase list:

- **Call back later** requires the date they asked for, and the case drops into *Waiting
  until the client asked* until that day comes round. Without the date it is not a call back,
  it is a note, and the case would sit there being chased anyway — so the date is required.
- **Not renewing** requires a reason, and the case moves to a list of its own. A lapse with
  no reason teaches the agency nothing, and the retention report is the poorer for it.

Both lists have a way back. **Put it back on the list** records a line of its own — *back on
the list*, by whom — and the case returns to the chase; a case is never quietly un-marked, and
the note that took it off stays in the history. The waiting list also takes a follow-up, for the
client who rings first.

**The renewal-notice scheduler reads these.** A client whose latest note is *not renewing* is
left out when notices are built, and the run says how many were left out for that reason. Until
this, someone who had said a fortnight ago that they sold the car got a WhatsApp saying they
were about to be uninsured.

The rail badge and the header counts follow, so the number an agent sees is what is actually
left to do. Every note goes to the audit trail with who wrote it.

The seeded book includes one policy that expired twelve days ago and was never renewed. It
keeps its `active` status, because nobody goes through a register flipping statuses by hand
— which is exactly why a list that only looks forward misses it.

## Renewal notices

Renewals are where an agency's revenue lives, and the app had a list without a
way to act on it. `/renewals/notices` now builds the notices that are due and
holds them until they are actually delivered.

**Building never sends.** The two are separate steps so a run that queues the
wrong thing can be cancelled before it reaches a client, and so the agency can
read what is about to go out. Building twice adds nothing — each notice is keyed
to its policy, reminder and expiry date.

**Nothing is marked sent on a promise that was not kept.** With no provider
configured a notice stays queued and says why, and the outbox becomes a worklist:
open one, copy the text, send it from your own WhatsApp, mark it sent. That is
what a small Malaysian agency does anyway, and it is the honest default — the
alternative is a screen full of green ticks for messages nobody received.

Configuring a provider turns the same queue automatic without changing anything
above it. Set `IH_WHATSAPP_URL` (or `IH_EMAIL_URL`, `IH_SMS_URL`) and Insurhelp
POSTs `{to, subject, text}` with `IH_*_TOKEN` as a bearer. A provider failure is
recorded on the message with its reason; waiting for a provider that does not
exist is not counted as a failed attempt.

Templates are per reminder, with merge fields — `{client_name}`, `{vehicle_no}`,
`{days_left}`, `{ncd_pct}` and the rest. **An unknown placeholder is rejected when
the template is saved**, because a misspelled one reaches the client verbatim:
"Dear {custmer_name}". A field that is empty on a particular policy degrades
rather than leaving a hole — a non-motor policy reads "your Houseowner policy"
where a car would read "WXY 4471", and the rendered text is tidied so a missing
detail never shows up as a double space.

The daily run is `POST /api/cron/renewal-notices`, guarded by `IH_CRON_SECRET`.
Without the secret set it returns 503 rather than running unauthenticated; a GET
answers only to the same bearer. The run also sweeps each agency's abandoned
uploads and expired sessions.

## Retention and lapses

A policy now records which policy it renewed. Without that link a renewal and a
lapse are indistinguishable afterwards, and the number an agency most needs —
how much of the book walked — cannot be computed at all.

`/reports/retention` shows the rate, the premium kept, the premium lost and the
commission not earned, with the lapsed policies listed by name and telephone
number. Renewing through the app sets the link automatically: the renewal form
opens prefilled from last year's policy, with a header telling you to check the
premium and the no-claim discount, because a claim may have reset it.

## The client portal

`/portal` is what a client sees of their own insurance: their policies, what
they still owe, their claims, their documents, and a button asking the agency to
renew. The agency issues an access code from the client's page; there is no
self-registration, because anyone could otherwise type a stranger's NRIC and be
told whether it is on file.

Everything about it is built around one question — what must a client never
see?

- **Its own queries.** Every read the portal makes lives in its own set of
  functions, none of which select a commission, a sub agent, or another client's
  row. Reusing the agency's `getPolicy` would hand the client the commission the
  agency earns on them; one careless field on one page would leak it and nobody
  would notice.
- **Its own session.** A different cookie, and the signed payload carries a
  `portal:` purpose. The two surfaces share a secret, so without that purpose a
  valid agency cookie would also be a valid portal cookie. Both directions are
  tested.
- **Its own document route.** The lookup joins through the policy to this client
  *and* restricts the kind, so an adjuster's report filed against a claim is not
  found rather than refused. A schedule on their own policy is served.
- **Sessions are two hours**, not the agency's eight — a client signs in from a
  phone more likely to be shared or left unlocked — and the client row is read on
  every request, so withdrawing access takes effect at the next one rather than
  the next sign-in.

The access code is generated from an alphabet without ambiguous characters,
because it gets read down a telephone, and it is stored hashed: an agency
employee reading the database should not be able to sign in as a client. It is
shown once and cannot be recovered — the audit trail records that a code was
issued, never the code.

One failed sign-in looks exactly like another. A wrong code and an unknown NRIC
produce the same sentence, so the portal cannot be used to find out whether a
given person is insured here.

## Importing a book

An agency arriving from something else has its clients and policies in a
spreadsheet. `/import` takes a CSV of either and writes it — but only after
showing exactly what would happen.

**Nothing is written by the check.** Every row is parsed, validated and
displayed with its problems first; the commit is a separate, explicit step. That
matters more than it sounds: an import that surprises the agency is worse than
one that refuses, because they cannot tell what landed and running the file
again duplicates whatever did.

- **The CSV parser walks the text rather than splitting on commas**, which fails
  on the first address field. Quoted fields carry commas, newlines and doubled
  quotes; Excel's CRLF and UTF-8 BOM are handled (a BOM left in place becomes
  part of the first header and every lookup for that column silently misses);
  and a row whose column count differs from the header is reported rather than
  quietly misaligned.
- **Headers are matched loosely.** `Policy No.`, `policy number` and `No Polisi`
  all find the same field, by exact alias then prefix. Columns nothing claimed
  are listed back — a column silently left out is data the agency believes it
  imported.
- **The preview shows what was converted.** Dates arrive as `01/03/2026`,
  `1-3-26` and Excel serial numbers, and day-first is assumed because that is how
  Malaysia writes them. Ambiguity is real, so the converted columns are the ones
  the preview chooses to show, each with the original beneath it — showing the
  first few columns instead would hide exactly the values a misreading ruins.
- **Errors block a row; warnings do not.** A malformed NRIC, an unknown insurer,
  a policy number already on the register, an expiry on or before its effective
  date — those stop the row. A premium that does not add up, or a client with no
  identifier, are flagged and still imported.
- **A commit is one transaction.** All the good rows or none of them; the blocked
  rows come back as a CSV to correct and re-upload. The rows are re-analysed at
  commit rather than trusted from the preview, so a duplicate created in between
  is still caught.

## Search

One box, in the rail on every screen and behind Ctrl/⌘+K, over policies,
clients, claims, endorsements, sub agents and documents.

The work is in matching what people actually type. Identifiers in this domain
are written inconsistently everywhere: a plate is `WXY 4471` on the schedule and
`wxy4471` in a text message, an NRIC comes with or without dashes, a policy
number carries slashes one insurer uses and another does not. Every identifier
is reduced to letters and digits on both sides before comparison, so all of
those find the same record.

Ranking matters more than recall. An exact identifier match outranks a name,
which outranks a passing mention in a remark — someone who types a plate wants
that vehicle, not every client whose address contains those letters. Each result
says which field it matched on, so a surprising hit explains itself. Short
queries are held back deliberately: two characters match the start of a name or
an identifier, three are needed before a fragment inside free text counts, and an
empty query matches nothing at all.

A query that names exactly one record goes straight to it — a policy number, a
claim number, an NRIC. A **plate does not**, because it legitimately belongs to
the policy, every claim made under it and every endorsement: the list is the
honest answer, and `?go=list` forces it for the others.

The SQL narrows with a broad `LIKE` and the ranking happens in TypeScript, where
the normalisation lives. A leading-wildcard `LIKE` is a table scan, which is fine
for an agency's book and would not be for a million rows; that is the point at
which this wants SQLite's FTS5.

## Endorsements

A policy changes mid-term — the sum insured goes up, an extension is added, the
vehicle is sold. `/endorsements` records the change and works out the money.

The arithmetic is the point, and there are two different rules:

- **Additional or return premium is pro-rata on the unexpired period.** The
  change in *annual* premium is what gets entered; what the client pays now is
  `annual difference × unexpired days ÷ cover days`, plus 8% service tax, plus
  RM 10 stamp duty on an additional premium (a return premium carries none).
- **A cancellation is refunded on the short-period scale, not pro-rata.** Cancel
  after four months and the insurer keeps 50%, not the 33% the calendar
  suggests — most of a year's risk sits in its early months and the
  administration is already done. Quoting the client the pro-rata figure and
  paying the short-period one is a complaint every time, so the screen shows the
  band, the retained percentage and the resulting refund in words before
  anything is saved. Stamp duty is not refundable.

The form calculates live using the same function the server does, and the server
recomputes on save rather than trusting the posted figures — a total cannot end
up disagreeing with the policy dates it was derived from. Both the inputs
(annual difference) and the outputs (gross, tax, duty, days) are stored, because
the second cannot be re-derived once the policy is renewed or altered again.

An endorsement must fall inside the period it alters, and an issued one cannot
be deleted — the cover has already changed, so the way back is a cancelling
endorsement, not a quiet removal.

The seeded endorsements are costed by calling the same calculator at seed time,
so the fixtures cannot drift from the code.

## Claims

The register tracks policies and money; what clients actually telephone about is
a crash. `/claims` runs one from the first call to settlement — nine stages, with
the closing three (settled, rejected, withdrawn) reachable only through the form,
because closing a claim needs the figure or the reason and a one-click control
cannot ask for either.

What the module is really for is telling the insured the truth before they
decide:

- **The no-claim discount.** An own-damage claim resets it to zero at renewal. On
  a 55% discount that is the most expensive consequence of the whole claim —
  frequently more than the repair — so the screen states it in money, not as a
  flag. A **windscreen** claim made under the windscreen extension does not
  affect it: that is what the extension is for. Neither does a claim where the
  **third party was at fault**, since nothing is claimed off our policy. The form
  applies that rule as you pick the type and the fault, and stops applying it the
  moment someone overrides it by hand.
- **The police report.** Every Malaysian motor policy requires one within 24
  hours. A claim with none is flagged, and one reported later shows the gap in
  days — the insurer has grounds to decline, and the insured's explanation is
  wanted before they ask.
- **Panel versus off-panel.** Panel workshops are paid direct with no betterment;
  off-panel is reimbursed, and betterment on replaced parts is charged to the
  insured. Say so before the car goes in.

Refusals worth knowing about: a claim cannot be dated outside the cover it is
made under (picking the renewal by mistake is the commonest way a claim gets
rejected), a settlement cannot exceed what the insurer approved, and a settled
claim cannot be deleted — the settlement is the record that money was paid, the
same rule as a paid policy.

Claim paperwork uses the same document store as policies: the police report, the
claim form, photographs, the repair quotation, the adjuster's report and the
discharge voucher. The rows carry both the claim and the policy underneath it, so
deleting either takes the files.

## Keeping the documents

Reading a PDF used to discard it. The file is now kept, so the agency can produce
the schedule the insurer issued without going back to ask for it. Uploading a
policy stores the document and ties it to the policy the review creates;
`/insurance/[cls]/[id]` lists what is on file and takes more — a cover note, a
receipt, an endorsement, a photo of a signed proposal (PDF, JPEG or PNG).

Files live on disk under `IH_FILES` (default `data/documents`), not in the
database: a schedule runs to a megabyte or more, and hundreds of them would
multiply the size of every backup copy for bytes that never take part in a query.
The consequence is that **the database alone is not a complete backup** — restore
it without the documents directory and every policy shows an attachment that will
not open. `deploy/backup.sh` takes both.

Details that matter more than they look:

- **Files are named after the document id, never the upload's own name.** Two
  agencies both sending `policy.pdf` must not collide, and a filename from a
  browser is attacker-controlled — it can carry slashes and dots that would walk
  out of the directory.
- **The download route looks the row up with the signed-in organisation as part
  of the query**, so an id belonging to another agency is simply not found.
  Guessing an id gets a 404, not someone else's policy schedule.
- **The same file uploaded twice is flagged**, matched on a SHA-256 of the
  contents so a rename does not hide it. That is how one policy ends up on the
  register as two.
- **Uploads read but never saved are swept after a week.** A document is stored
  the moment the PDF is read — the review has to be able to show it — and reviews
  get abandoned. Without the sweep those files would sit there for good:
  unbounded storage, and somebody's personal data kept with nothing pointing at
  it. The sweep records what it took in the audit trail.
- **Deleting a policy takes its documents with it**, files as well as rows, and
  the files go only after the database change succeeds.

## How the money adds up

Premium is stored as a breakdown rather than a single figure, so a policy reconciles the
way a real schedule does:

```
gross premium = basic premium − no-claim discount + extra cover premium
total payable = gross premium + 8% service tax + stamp duty
```

Each policy carries two payment records — one for what the client owes the agency, one for
what the agency owes the principal — which is what drives the two tabs on the dashboard's
outstanding panel. Commission is derived from gross premium at the principal's rate, and the
sub agent's share is a separate record moving through `pending → approved → paid`.

## Seed data

One seeded policy is moved to have expired twelve days ago and left unrenewed, so the
expiring worklist has something in its most urgent pile on a fresh database; two more are
moved to expire in exactly 30 and 7 days. All three are relative to `today()` rather than a
fixed date — otherwise the demo stops demonstrating anything a month after it was written.

The seeded organisation **EXE Cheras** reproduces the reference dashboard exactly:
RM 429.23 collected in 30 days, 3 cases created, RM 6,662.79 premium collected YTD 2026,
RM 0.00 commission received, 17 client-outstanding items totalling MYR 21,375.64, 21
outstanding to principal, and the same top-10 recent sales.

A second organisation, **BS Agency Sdn Bhd**, holds four policies transcribed from real
policy documents — Liberty `WQK100`, Lonpac `DDS 7898`, Allianz `MDW9185` and Liberty
`NCF9240` — including their extensions and exact premium breakdowns. Switch to it with the
organisation selector on the dashboard, or sign in as `boonseng_agent@yahoo.com`.

One insurer commission statement is seeded with it — Berjaya Sompo's quarter to 30 June
2026 — and it is deliberately imperfect, because a reconciliation screen with nothing to
reconcile demonstrates nothing. One case is paid to the sen, one fire policy is short by
RM 283.33 because the 10% motor rate was applied to it instead of 25%, one case worth
RM 93.96 is left off the statement altogether, and one line of RM 96.30 is for a policy the
agency never wrote. The statement is built by running the seeded policies back through the
same reader and matcher the import uses, so its figures cannot drift from the book it is
checked against.

Everything else is fabricated demo data.

## Layout

```
src/
  app/
    (app)/          authenticated pages, wrapped in AppShell (top bar + rail)
    login/          sign-in page
  components/       AppShell, SideNav, forms, icons, filters, shared UI
  lib/
    db.ts           schema and connection; seeds on first use
    seed.ts         the seed dataset
    queries.ts      all data access
    extract/        the PDF reader: rules.ts (generic), profiles.ts (per insurer), claude.ts
    bulk-actions.ts reading a stack of schedules and saving the clean ones
    follow-up.ts    the outcomes a renewal call can have (no database import:
                    the form that offers them runs in the browser)
    nav.ts          the navigation tree
    actions.ts      server actions (login, record payment, approve commission)
    session.ts      signed-cookie session
    format.ts       currency and date helpers
```

The shell (`src/components/AppShell.tsx`) follows the supplied design system: a 56px top bar
carrying the agency and the bell; a collapsible rail; the page's first panel as the control
bar beneath. Containers are `rounded-3xl`, controls `rounded-xl`, the brand is indigo
`#4F46E5` on a `#F8FAFC` canvas with `#111827` text, and the face is Cairo — loaded by the
browser from Google Fonts with a system fallback, rather than fetched at build time, so a
box with no route out still builds.

**Who is signed in sits at the foot of the rail**, opening upward: Profile, an appearance
switcher, Sign out. It is neither navigation nor a task — it is the answer to "which account
am I in", and the bottom-left corner is where that belongs.

**Light, dark, or match the computer.** Every colour in the application is a token in
`src/app/globals.css`, which is what makes this a change of about sixty lines rather than a
rewrite; getting there meant replacing some hundred and thirty raw hex values scattered
through the components, since a literal `#fdeceb` cannot be themed. Dark is defined twice on
purpose: `:root[data-theme="dark"]` for an explicit choice, and a `prefers-color-scheme`
block guarded by `:not([data-theme="light"])` for "match the computer" — so choosing Light on
a machine set to dark actually gives light. A small inline script in the document head
settles it before the first paint, because otherwise anybody who chose dark gets a white
flash on every navigation. Errors stay red whatever the brand is.

Navigation is the rail (`src/components/SideNav.tsx`), driven by `src/lib/nav.ts`.

It carries six entries, and that is the point. Nineteen flat destinations became eight
sections of roughly equal weight, which reads as an ERP — a menu that gives commission
reconciliation the same standing as "find my client's policy" is saying they matter
equally, and they do not. What an agent does is put a policy in, find one, see what is
running out, and look after the clients. Those are the rail:

```
Home · Add a policy · Policies · Expiring soon · Clients · More
```

**Add a policy** is rendered as a button rather than a folder, because it starts work
instead of listing it. **Expiring soon** carries a live count of what needs attention
inside thirty days — not the full ninety, or the badge would cry wolf.

Everything else is real and stays reachable. Claims, endorsements, commission payout,
insurer statements, reports, sub agents, rates, the audit trail: all of it lives under
**More**, listed on one page (`/more`) in four groups. `sectionFor()` falls back to that
list, so walking straight to `/reports/retention` still lights the rail up rather than
leaving it blank. A screen that exists in no menu is a screen nobody finds.

The section covering the current page expands on its own; the rest stay shut. Entries that
can be behind — expiring cover, quotations open, claims running — carry a live count from
`navCounts()`, so the rail says what needs attention without a page load. The rail collapses
to icons (remembered in `localStorage`) and becomes a drawer below `lg`.

## Tests

```bash
npm test          # unit tests, node:test through tsx
npm run harness   # scores the document reader against tests/samples/*.pdf (not committed)
npm run check     # typecheck + tests, what CI runs before the build
```

The tests cover what is pure and what has bitten: statement reading and
matching (`statements.ts`), the premium arithmetic every policy goes through
(`premium.ts` — a typed 0 commission is nil, a blank is worked out), the
password rule, the address parse, the two throttles' bounds, the CSV formula
guard, hashing and rehashing, and the extractor's date and amount validators.
`.github/workflows/ci.yml` runs typecheck, tests and the build on every push.

The reader's harness needs the real schedules, which carry real names and are
never committed: put them in `tests/samples/` with a `truth.json` and run
`npm run harness`.

## Known gaps

- **Employee Benefits** is served from `/insurance/endorsement` to match the live route, but
  the live build renders the Renewals screen there — a wiring bug noted in the teardown. This
  clone implements the module rather than reproducing the bug.
- **Reports** is a set of four browsable reports here; the live app is a generator that takes a
  report type and a date range. The captured session never opened the type list, so the options
  are unknown.
- **Reconcile** was never opened during capture, so its contents are a reasonable
  reading of the payment state the registers already track, not a copy.
- **Money is stored as REAL.** Totals compared against a one-sen tolerance are
  rounded at the aggregate, but the columns are floating point; moving to
  integer sen is the durable fix.
- **Payments have no history.** One row per leg; instalments overwrite each
  other's method and reference.
- **One role, no soft delete, no PDPA tooling, no LHDN submission** — see
  DEPLOY.md's list of what is not built.
- LOC and receipt documents render as print-ready pages rather than generated PDF files.
- Quotations keyed in from the Quotations screen land on the policy register with status
  *Quotation*; the Quotations screen itself lists the separate quotation table and has no
  controls of its own.
- Reconcile, Renewal reminders, Client groups, Life planning, Employee benefits and the
  reports are look-only screens.

## Notes

- Set `IH_TODAY=2026-08-22` to pin "today" so the seeded figures stay put; otherwise
  the dashboard uses the real current date and the 30-day windows move with it.
- `IH_SECRET` signs the session cookie and should be set to a real secret outside of
  local development. `IH_DB` overrides the database path.
- Uploads are capped at 15 MB, enforced in the browser and again in the server action. Next.js
  caps Server Action bodies at 1 MB by default, so `serverActions.bodySizeLimit` is raised to
  match — lower it and larger PDFs fail before the action can report anything useful.
- A submit button's `name`/`value` is **not** carried into a Server Action's FormData from a
  server component — only from a client component, where React encodes the submitter itself.
  Forms in server components therefore pass the operation as a hidden input, one form per
  action. Getting this wrong fails silently: the POST returns 200 and nothing happens.
- An input that leaves the DOM posts nothing. The commission rate filter hides rows with CSS
  rather than unmounting them, because the action reads every rate on file and a filtered
  save would otherwise arrive looking like every hidden rate had been cleared.
- The organisation panels share columns, so each input's `id` carries its panel. Two elements
  with one `id` is invalid, and every `label for` on the page then points at whichever came
  first — clicking a label focuses the wrong field.
- Validators have to accept what real documents carry. A company registered before 2019
  prints both SSM numbers together — `201901004455 (1315678-V)` — and a dash in the SST field
  means "not registered", not a value to check.
- `IH_SECRET` signs the session cookie. The server refuses to start in production
  without it — see `src/instrumentation.ts`.
- Sign-in allows 8 failures per 15 minutes, per address and per email. The counter is
  in memory, so it resets on restart and does not span multiple instances.
- Passwords are hashed with scrypt.
- Commission and payment rows carry no `org_id` of their own — they hang off a policy — so
  every statement that touches them reaches the organisation through the join. Without it the
  id posted by a form is the only thing deciding whose money moves.
- A plain POST does not invoke a Next.js Server Action; it needs the `Next-Action` header. An
  HTTP probe that forges a form post therefore proves nothing about a server-side check,
  either way. Test the query layer instead.
- **Every export of a `'use server'` module must be an async function.** Next.js turns anything
  else into a server reference, so a constant exported from there arrives on the client as an
  opaque stub and the first `.map` over it throws. Typecheck and `next build` both pass; it
  fails only when the page renders. Shared constants live in a plain module —
  `src/lib/document-kinds.ts` is one.
- Playwright's `waitForURL` waits for the `load` event, which an App Router soft navigation
  never fires. Poll `location` instead, and don't wait on page text that also exists on the
  page you are leaving. Nor wait on an error selector that is already on screen from the
  previous attempt — wait for the text to *change*, or a submission that never happened
  reads as a pass.
- **React resets the form after a server action, and that reset blanks a controlled
  `<select>`** while React's own value stays put: the control goes empty and the next
  submission posts nothing. Every select that has to survive a validation error is therefore
  uncontrolled, keyed on the echoed value so it remounts with what was submitted, with state
  re-synced from the echo. The same applies to radios and checkboxes — see `ClaimForm`,
  `SubAgentForm` and `ClientForm`.
