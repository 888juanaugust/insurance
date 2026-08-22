# SimSuite — insurance agency management (clone)

A working clone of the SimSuite agency portal: a Next.js application for a Malaysian
general-insurance agency that tracks clients, motor and non-motor policies, premium
collection, remittance to principals, and sub agent commission.

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

The SQLite database is created and seeded automatically at `data/simsuite.db` on first
request. `npm run db:reset` deletes it so the next request reseeds from scratch.

```bash
npm run build && npm start   # production build
npm run typecheck            # tsc --noEmit
```

## What is in it

| Module | Route | Notes |
| --- | --- | --- |
| Executive strategic performance | `/` | KPI cards, birthday reminders, outstanding payment (client / principal tabs with search), recent sales. Filters by organisation and agent. |
| Sub Agents | `/sub-agents` | Commission structure per agent plus bank and TIN details for self-billed e-Invoice. |
| Organisation | `/organisation` | Company particulars, subscription terms and quota usage. |
| Clients | `/clients`, `/clients/[id]` | Client register with search; detail view lists the client's policies and life plans. |
| Grouping Client | `/grouping-client` | Group accounts and their members. |
| Client Planning | `/client-planning` | Life and medical plans held alongside the general book. |
| Insurance | `/insurance/motor`, `/insurance/non-motor` | Policy registers with status, principal, agent and free-text filters. |
| Policy schedule | `/insurance/[cls]/[id]` | Full schedule: parties, vehicle or risk particulars, premium computation, extensions, collection and remittance. Collection can be recorded from this page. |
| Reports | `/reports/...` | Agent commission, monthly sales, company commission breakdown, outstanding premium ageing. |
| Accounting | `/accounting` | Approve commission and mark it paid. |
| Setting | `/setting/global`, `/setting/renewal`, `/setting/notifications` | Commission rates, e-Invoice particulars, insurance companies, renewal reminders, scheduled broadcasts. |
| User Guide / Contact Us | `/user-guide`, `/contact-us` | Module reference and support details. |

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

## Notes

- Set `SIMSUITE_TODAY=2026-08-22` to pin "today" so the seeded figures stay put; otherwise
  the dashboard uses the real current date and the 30-day windows move with it.
- `SIMSUITE_SECRET` signs the session cookie and should be set to a real secret outside of
  local development. `SIMSUITE_DB` overrides the database path.
- Passwords are hashed with scrypt. This is a demo application, not a production system —
  it has no rate limiting, audit trail, or multi-tenant hardening beyond scoping every query
  to the signed-in user's organisation.
