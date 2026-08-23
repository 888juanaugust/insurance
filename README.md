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

Sign in with:

| Login ID | Password | Organisation |
| --- | --- | --- |
| `exemaster3@gmail.com` | `12345Abcdefg` | EXE Cheras |
| `exemaster1@gmail.com` | `12345Abcdefg` | EXE Cheras |
| `boonseng_agent@yahoo.com` | `12345Abcdefg` | BS Agency |

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
| Import | `/import` | Bring an existing book across from a spreadsheet. Every row is checked and shown before anything is written. |
| Search | `/search`, and a box in the rail | One box over policies, clients, claims, endorsements, sub agents and documents. Ctrl/⌘+K from anywhere. |
| Executive strategic performance | `/` | KPI cards, birthday reminders, outstanding payment (client / principal tabs with search), recent sales. Filters by organisation and agent. |
| Audit trail | `/audit` | Every change, refusal and sign-in. |
| Sub Agents | `/team`, `/team/new`, `/team/[id]/edit` | Add, edit, deactivate and delete sub agents. Commission structure per agent plus bank and TIN details for self-billed e-Invoice. Agent codes are unique, a rate that would pay out more than the principal pays in is refused, and an agent carrying policies cannot be deleted. |
| Organisation | `/organisation` | Editable company particulars, invoice letterhead and collection account, plus subscription terms and quota usage. Each panel saves on its own, so a shared field edited in either place lands in the same column. |
| Clients | `/clients`, `/clients/new`, `/clients/[id]`, `/clients/[id]/edit` | Add, edit and delete clients — individual or company. NRIC fills the date of birth, duplicate identification is refused, and a client carrying policies cannot be deleted. |
| Grouping Client | `/client-groups` | Group accounts and their members. |
| Client Planning | `/client-planning` | Life and medical plans held alongside the general book. |
| Insurance | `/insurance/general-motor`, `/insurance/non-motor` | Policy registers, 25 columns: principal chips (20 insurers), 15 class-of-business tabs on non-motor, date-range / vehicle / insured / NRIC search, sortable columns, totals row, pagination, CSV export, and bulk client/principal settlement. |
| Upload PDF | `/insurance/[cls]/upload` | Read a policy document of any layout and add it to the register. The file itself is kept — see below. |
| Create / edit policy | `/insurance/[cls]/new`, `/insurance/[cls]/[id]/edit` | Key a policy in or correct one. |
| Quotations, Reconcile, Renewals, Employee Benefits | `/insurance/…` | Open quotations, receivable-vs-payable position, expiring cover, group schemes. |
| Policy schedule | `/insurance/[cls]/[id]` | Full schedule: parties, vehicle or risk particulars, premium computation, extensions, collection and remittance. Collection can be recorded from this page, and a policy nothing has been paid on can be deleted — see below. |
| Reports | `/reports/...` | Agent commission, monthly sales, company commission breakdown, outstanding premium ageing. |
| Accounting | `/accounting` | Approve commission and mark it paid. |
| Setting | `/settings` | Per-user e-Invoice billing identity and password change. Organisation-wide settings sit under `/settings/global` (editable commission rates per insurer and class, the letterhead, the insurer list), `/settings/renewal` and `/settings/notifications`. |
| Endorsements | `/endorsements`, `/endorsements/new`, `/endorsements/[id]`, `/endorsements/[id]/edit` | Mid-term changes to cover, with the additional or return premium worked out and shown before saving. |
| Claims | `/claims`, `/claims/new`, `/claims/[id]`, `/claims/[id]/edit` | Motor and non-motor claims from the first phone call to settlement, with the no-claim-discount consequence stated on every one. |
| Quotations | `/insurance/quotations` | Quote pipeline: drafts, sent, accepted, rejected, converted. |
| Renewals | `/insurance/renewals` | Inbox, expiring and history, with create-quotation / process / reject. |
| Documents | `/documents/loc/[id]`, `/documents/receipt/[id]` | Letter of collection and receipt, laid out for printing to PDF. |
| User Guide / Contact Us | `/user-guide`, `/contact-us` | Module reference and support details. |

## Reading policy documents

`Upload PDF` on either register takes the PDF the insurer issued — schedule, cover note or
certificate — reads it, fills in the form, and lets you confirm before anything is saved.

It runs in two passes:

1. **Pattern rules** (always, offline, free). The PDF is re-laid-out by text position so each
   visual row becomes one line, then bilingual English/Bahasa Malaysia label patterns pull out
   the fields. Every value is validated — a plate has to look like a plate, a premium has to be
   a plausible amount, `gross + tax + stamp` has to equal the total — and anything that fails is
   discarded rather than shown. A wrong value that survives review is worse than a blank one.
2. **The model** (when `ANTHROPIC_API_KEY` is set). Insurers that print labels and values in
   separate columns, and scanned documents with no text layer at all, defeat pattern matching.
   The same document goes to Claude — as text when there is a text layer, as a PDF `document`
   block when there is not — and the two readings are merged: agreement raises confidence,
   only-one-has-it fills the gap, and **disagreement is surfaced for you rather than settled
   silently**.

The review screen labels every field with where its value came from — `confirmed` (both passes
agree), `read`, `read by model`, `calculated` (derived from the other premium figures),
`check this` (low confidence or a disagreement), `not found`. Duplicate policy numbers are
flagged, and an insured who is already on file is matched to the existing client rather than
duplicated.

Without credentials the upload still works; layouts the rules do not cover simply arrive with
more blanks to fill in. Configure the model pass with:

```bash
export ANTHROPIC_API_KEY=sk-ant-...        # enables the second pass
export IH_EXTRACT_MODEL=claude-opus-5  # optional, this is the default
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

The seeded organisation **EXE Cheras** reproduces the reference dashboard exactly:
RM 429.23 collected in 30 days, 3 cases created, RM 6,662.79 premium collected YTD 2026,
RM 0.00 commission received, 17 client-outstanding items totalling MYR 21,375.64, 21
outstanding to principal, and the same top-10 recent sales.

A second organisation, **BS Agency Sdn Bhd**, holds four policies transcribed from real
policy documents — Liberty `WQK100`, Lonpac `DDS 7898`, Allianz `MDW9185` and Liberty
`NCF9240` — including their extensions and exact premium breakdowns. Switch to it with the
organisation selector on the dashboard, or sign in as `boonseng_agent@yahoo.com`.

Everything else is fabricated demo data.

## Layout

```
src/
  app/
    (app)/          authenticated pages, wrapped in the left-rail shell
    login/          sign-in page
  components/       SideNav, forms, icons, filters, shared UI
  lib/
    db.ts           schema and connection; seeds on first use
    seed.ts         the seed dataset
    queries.ts      all data access
    nav.ts          the navigation tree
    actions.ts      server actions (login, record payment, approve commission)
    session.ts      signed-cookie session
    format.ts       currency and date helpers
```

Navigation is a left rail (`src/components/SideNav.tsx`), driven by `src/lib/nav.ts`.
Nineteen flat destinations are grouped into eight sections — Overview, Clients, Policies,
Renewals, Accounts, Reports, Team, Settings — each holding the screens you move between
while doing one job, so a task stays inside one section instead of crossing the whole menu.
The section covering the current page expands on its own; the rest stay shut. Sections that
can be behind — renewals due, money outstanding, quotations open — carry a live count from
`navCounts()`, so the rail says what needs attention without a page load. The rail collapses
to icons (remembered in `localStorage`) and becomes a drawer below `lg`.

## Known gaps

- **Employee Benefits** is served from `/insurance/endorsement` to match the live route, but
  the live build renders the Renewals screen there — a wiring bug noted in the teardown. This
  clone implements the module rather than reproducing the bug.
- **Reports** is a set of four browsable reports here; the live app is a generator that takes a
  report type and a date range. The captured session never opened the type list, so the options
  are unknown.
- **Reconcile** was never opened during capture, so its contents are a reasonable
  reading of the payment state the registers already track, not a copy.
- LOC and receipt documents render as print-ready pages rather than generated PDF files.

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
