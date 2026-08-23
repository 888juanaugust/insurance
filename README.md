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
| Sub Agents | `/team` | Commission structure per agent plus bank and TIN details for self-billed e-Invoice. |
| Organisation | `/organisation` | Company particulars, subscription terms and quota usage. |
| Clients | `/clients`, `/clients/[id]` | Client register with search; detail view lists the client's policies and life plans. |
| Grouping Client | `/client-groups` | Group accounts and their members. |
| Client Planning | `/client-planning` | Life and medical plans held alongside the general book. |
| Insurance | `/insurance/general-motor`, `/insurance/non-motor` | Policy registers, 25 columns: principal chips (20 insurers), 15 class-of-business tabs on non-motor, date-range / vehicle / insured / NRIC search, sortable columns, totals row, pagination, CSV export, and bulk client/principal settlement. |
| Upload PDF | `/insurance/[cls]/upload` | Read a policy document of any layout and add it to the register. See below. |
| Create / edit policy | `/insurance/[cls]/new`, `/insurance/[cls]/[id]/edit` | Key a policy in or correct one. |
| Quotations, Reconcile, Renewals, Employee Benefits | `/insurance/…` | Open quotations, receivable-vs-payable position, expiring cover, group schemes. |
| Policy schedule | `/insurance/[cls]/[id]` | Full schedule: parties, vehicle or risk particulars, premium computation, extensions, collection and remittance. Collection can be recorded from this page. |
| Reports | `/reports/...` | Agent commission, monthly sales, company commission breakdown, outstanding premium ageing. |
| Accounting | `/accounting` | Approve commission and mark it paid. |
| Setting | `/settings` | Per-user e-Invoice billing identity and password change, as on the live app. Organisation-wide settings (commission rates, insurance companies, renewal reminders, scheduled broadcasts) sit under `/settings/global`, `/settings/renewal` and `/settings/notifications`. |
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
    (app)/          authenticated pages, wrapped in the sidebar + topbar shell
    login/          sign-in page
  components/       sidebar, topbar, icons, filters, shared UI
  lib/
    db.ts           schema and connection; seeds on first use
    seed.ts         the seed dataset
    queries.ts      all data access
    actions.ts      server actions (login, record payment, approve commission)
    session.ts      signed-cookie session
    format.ts       currency and date helpers
```

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
- `IH_SECRET` signs the session cookie. The server refuses to start in production
  without it — see `src/instrumentation.ts`.
- Sign-in allows 8 failures per 15 minutes, per address and per email. The counter is
  in memory, so it resets on restart and does not span multiple instances.
- Passwords are hashed with scrypt. This is a demo application, not a production system —
  it has no rate limiting, audit trail, or multi-tenant hardening beyond scoping every query
  to the signed-in user's organisation.
