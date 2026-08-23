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

| Login ID | Password |
| --- | --- |
| `exemaster3@gmail.com` | `12345Abcdefg` |
| `boonseng_agent@yahoo.com` | `12345Abcdefg` |

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
| Executive strategic performance | `/` | KPI cards, birthday reminders, outstanding payment (client / principal tabs with search), recent sales. Filters by organisation and agent. |
| Sub Agents | `/team`, `/team/new`, `/team/[id]/edit` | Add, edit, deactivate and delete sub agents. Commission structure per agent plus bank and TIN details for self-billed e-Invoice. Agent codes are unique, a rate that would pay out more than the principal pays in is refused, and an agent carrying policies cannot be deleted. |
| Organisation | `/organisation` | Editable company particulars, invoice letterhead and collection account, plus subscription terms and quota usage. Each panel saves on its own, so a shared field edited in either place lands in the same column. |
| Clients | `/clients`, `/clients/new`, `/clients/[id]`, `/clients/[id]/edit` | Add, edit and delete clients — individual or company. NRIC fills the date of birth, duplicate identification is refused, and a client carrying policies cannot be deleted. |
| Grouping Client | `/client-groups` | Group accounts and their members. |
| Client Planning | `/client-planning` | Life and medical plans held alongside the general book. |
| Insurance | `/insurance/general-motor`, `/insurance/non-motor` | Policy registers, 25 columns: principal chips (20 insurers), 15 class-of-business tabs on non-motor, date-range / vehicle / insured / NRIC search, sortable columns, totals row, pagination, CSV export, and bulk client/principal settlement. |
| Upload PDF | `/insurance/[cls]/upload` | Read a policy document of any layout and add it to the register. See below. |
| Create / edit policy | `/insurance/[cls]/new`, `/insurance/[cls]/[id]/edit` | Key a policy in or correct one. |
| Quotations, Reconcile, Renewals, Employee Benefits | `/insurance/…` | Open quotations, receivable-vs-payable position, expiring cover, group schemes. |
| Policy schedule | `/insurance/[cls]/[id]` | Full schedule: parties, vehicle or risk particulars, premium computation, extensions, collection and remittance. Collection can be recorded from this page, and a policy nothing has been paid on can be deleted — see below. |
| Reports | `/reports/...` | Agent commission, monthly sales, company commission breakdown, outstanding premium ageing. |
| Accounting | `/accounting` | Approve commission and mark it paid. |
| Setting | `/settings` | Per-user e-Invoice billing identity and password change. Organisation-wide settings sit under `/settings/global` (editable commission rates per insurer and class, the letterhead, the insurer list), `/settings/renewal` and `/settings/notifications`. |
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
```

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
- Passwords are hashed with scrypt. This is a demo application, not a production system —
  it has no audit trail, role permissions, or multi-tenant hardening beyond scoping every
  query to the signed-in user's organisation.
