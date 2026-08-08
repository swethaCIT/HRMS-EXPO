# HRMS — Human Resource Management System

A role-based HR platform: a React Native app for Android and iOS, backed by a NestJS API and PostgreSQL.
One codebase serves four distinct experiences — **Employee, Manager, HR and Admin** — each with its own
navigation, dashboards and permissions, chosen automatically from the signed-in user's role.

| | |
|---|---|
| **Roles** | 4 (Employee · Manager · HR · Admin) |
| **Backend feature modules** | 21 |
| **REST endpoints** | ~118, all documented in Swagger |
| **Database tables** | 23 |
| **Mobile screens** | 54 |
| **Tests** | 29 (unit, no database required) |

---

## Contents

- [Tech stack](#tech-stack)
- [Features](#features)
  - [Employee self-service](#employee-self-service)
  - [Manager](#manager)
  - [HR](#hr)
  - [Admin](#admin)
  - [Goals — project management board](#goals--project-management-board)
  - [Team calendar](#team-calendar)
  - [Shared across roles](#shared-across-roles)
- [Security model](#security-model)
- [Project structure](#project-structure)
- [Quick start](#quick-start)
- [Database migrations](#database-migrations)
- [Seeding demo data](#seeding-demo-data)
- [API reference](#api-reference)
- [Environment variables](#environment-variables)
- [Testing](#testing)
- [Docker](#docker)
- [CI/CD](#cicd)
- [Known limitations](#known-limitations)

---

## Tech stack

| Layer | Technology |
|---|---|
| Mobile | React Native 0.86 + TypeScript (one codebase → Android & iOS) |
| State | Redux Toolkit (5 slices) |
| Navigation | React Navigation — role-based tabs + per-tab stacks |
| Charts & icons | `react-native-svg` — hand-built charts and a custom line-icon set, no chart library |
| Backend | NestJS 11 + TypeScript |
| Database | PostgreSQL (Supabase or self-hosted) via TypeORM |
| Cache | In-memory by default; Redis when `REDIS_URL` is set |
| Auth | JWT + Passport, bcrypt password hashing |
| File storage | Supabase Storage |
| Email | Nodemailer (SMTP/Gmail); logs to console when unconfigured |
| Push | Firebase Cloud Messaging (optional — disabled when credentials are absent) |
| Scheduling | `@nestjs/schedule` (calendar reminders, notification retries) |
| API docs | Swagger / OpenAPI at `/api/docs` |
| Hardening | Helmet, CORS allow-list, per-route rate limiting, global validation |

---

## Features

### Employee self-service

| Feature | What it does |
|---|---|
| **Home dashboard** | Live attendance card, leave balance, announcements, next holiday, quick actions, weekly view |
| **Punch in / out** | Office or work-from-home; prevents double punches; carries a `source` field so biometric/geofence punches can be added later |
| **Leave** | Calendar view, apply for leave, withdraw a pending request, live balance by type with annual allocations |
| **Timesheet** | Weekly attendance grid plus attendance-correction (regularization) requests |
| **Payslip** | Monthly payslip with earnings/deductions breakdown, salary-composition donut, and real salary history from your own records |
| **Tickets** | Guided raise-a-ticket wizard (department → category → priority), my tickets, detail with status tracker |
| **Assets** | Company assets assigned to you — serial numbers, condition, assignment date |
| **Documents** | Your contracts, ID proofs, certificates and payslips |
| **Requests** | Ask HR for documents, letters or profile changes |
| **Profile** | Full employment, personal, statutory, bank and emergency-contact record |

### Manager

| Feature | What it does |
|---|---|
| **Team dashboard** | Team pulse, pending-approval summary, KPIs, who's away |
| **Approvals inbox** | Unified queue of leave, ticket and regularization requests. Approve/reject writes to the database and **reverts with an error if the server rejects it** — decisions are never silently dropped. Bulk approve reports exactly how many actually saved |
| **Team directory** | Members with presence, search and filters; drill into a member |
| **Insights** | Attendance trend, leave distribution, headcount, top performers |

### HR

| Feature | What it does |
|---|---|
| **HR dashboard** | Org pulse, pending requests, new joiners, celebrations |
| **Requests inbox** | Employee document/letter/profile/onboarding requests — issue or reject |
| **People directory** | Full company directory with department filters and search |
| **Employee onboarding** | Invite a new hire by personal email with a one-time code; they self-register, and the system provisions a permanent company email and employee ID |
| **Holidays & announcements** | Publish the company holiday calendar and org-wide announcements |
| **Org insights** | Attrition, diversity and headcount by department |

### Admin

| Feature | What it does |
|---|---|
| **Admin dashboard** | System status, user counts, users by role |
| **User management** | List users, change roles, activate/deactivate, remove — with last-admin lockout protection |

### Goals — project management board

An Azure Boards-style delivery board built into the app.

```
Project → Teams → Sprints → Epic → Feature → User Story → Task / Bug
```

- **Projects** with a short key (`ATLAS`), owner, status and progress rollups.
- **Multiple teams per project**, each with its own manager, roster and burndown.
- **Team access levels** granted by the manager per person:
  `read` (view only) · `contribute` (create/edit/log time) · `manage` (also roster and sprints).
  A team's named manager is added automatically with `manage`.
- **Work items** with the full Azure workflow — **New → Active → Resolved → Closed** (plus Removed) —
  priority, story points, and an effort model of original estimate / completed / remaining.
  Parent-child type rules are enforced (an Epic holds Features, a Feature holds Stories, a Story holds Tasks/Bugs).
- **Backlog tree** with effort and completion rolled up from every descendant.
- **Kanban board** by state, and **my work items** across all projects.
- **Time logging** against work items — this is what the individual reports count.
- **Sprint burndown**: ideal vs actual, reconstructed from real close timestamps and stopping at today
  rather than projecting the future. Effort unit falls back hours → story points → item count.
- **Combined multi-team graph**: every team's curve plus the project total on shared axes, with an
  ahead/behind standings table.
- **Project report** — state/type/priority mix, velocity per sprint, weekly effort, per-team delivery.
- **Individual report** — assigned vs closed, hours logged, share of total project effort, days engaged,
  on-time %, average cycle time and estimate accuracy.
- **Audit trail** — every create, edit, state change, assignment, work log and roster/access change is
  recorded with who did it and the exact old → new value per field. Visible as a History timeline on each
  work item and as a project-wide feed.
- **Permissions** — anyone may create a work item (an employee must be able to raise their own task or bug);
  only Manager/HR/Admin may delete, and the deletion is written to the audit trail first.
- **Assignment notifications** — in-app, email and push, with the ref, project, type, state, priority,
  estimate and due date.

### Team calendar

- Month grid and agenda views, with company holidays overlaid.
- Meetings with **Online / Offline / Hybrid** modes, location or meeting link.
- **Recurrence** — daily, weekly, monthly (correctly clamped for short months) with an end date.
- **Participant picker** with live busy/free detection, excluding the meeting being edited.
- **RSVP** — accept / decline / tentative.
- **Conflict detection** when scheduling over someone's existing meeting.
- **Reminders** — a per-minute job notifies participants ~10 minutes before, deduplicated per occurrence.

### Shared across roles

- Role-aware navigation — the correct tabs appear automatically.
- Notification centre — in-app, email and push, deep-linking to the relevant screen.
- Persistent login, with a real sign-out on token expiry that clears all cached user data.
- Pull-to-refresh and live polling on screens where other people's actions matter.
- Consistent UI — deep-indigo headers, custom SVG icons, cards and charts.

---

## Security model

Authorization answers two separate questions, because roles alone are not enough:

1. **What kind of user is this?** — `@Roles()` on the route.
2. **Is this *their* record?** — `AccessControlService.assertSelfOr(...)`.

Without the second, every `/:employeeId` route is an IDOR. Concretely:

| Data | Who can read | Who can write |
|---|---|---|
| Payslips | Yourself, or HR/Admin | HR/Admin only |
| Attendance | Yourself; managers/HR/Admin for the team | Yourself (HR/Admin may correct) |
| Leave | Yourself; managers/HR/Admin to approve | Yourself; approvals are Manager/HR/Admin |
| Documents, assets | Yourself, or HR/Admin | HR/Admin only |
| Employee directory | Any signed-in user | HR/Admin (delete: Admin) |
| Tickets | Yours via `/mine`; all for Manager/HR/Admin | Cancel: the raiser. Status: Manager/HR/Admin |
| Users, raw push | Admin | Admin |

Also enforced:

- **Public registration cannot choose a role** — it is forced to `employee`.
- **Approver identity comes from the token**, never the request body.
- **JWT fails closed** — the app refuses to start without `JWT_SECRET` rather than accepting a default.
- **Every endpoint has a validated DTO.** Nest skips validation entirely when a handler takes `any`,
  which also allowed an `id` in the body to turn an insert into an overwrite. There are zero such handlers.
- **One-time codes use `crypto.randomInt`**, with a 5-attempt cap and single use.
- **Rate limits**: 300 req/min globally; login 10/min; forgot-password 5 per 5 min.
- Helmet, CORS allow-list, 1 MB body cap, bcrypt hashing, `@Exclude()` on password and token fields.

---

## Project structure

```
HRMS/
├── apps/
│   ├── backend/                  # NestJS API
│   │   └── src/
│   │       ├── auth/  users/  employees/
│   │       ├── attendance/  leaves/  regularizations/
│   │       ├── payroll/  assets/  documents/  requests/
│   │       ├── tickets/  onboarding/  holidays/  announcements/
│   │       ├── projects/         # Goals board: projects, teams, sprints, work items, reports, audit
│   │       ├── team-calendar/    # meetings, recurrence, RSVP, reminders
│   │       ├── notifications/  mail/  storage/  analytics/
│   │       ├── common/           # guards, access control, pagination, interceptors
│   │       ├── config/           # database, cache
│   │       ├── migrations/       # TypeORM migrations
│   │       ├── data-source.ts    # migration CLI DataSource
│   │       ├── seed.ts  seed-calendar.ts
│   │       └── main.ts
│   └── mobile/                   # React Native app
│       └── src/
│           ├── navigation/       # role-based tabs + shared leaf screens
│           ├── screens/          # admin, hr, manager, dashboard, projects, calendar, …
│           ├── store/slices/     # auth, approvals, hrRequests, notifications, calendar
│           ├── services/api.ts   # one axios client, one export per module
│           ├── config/env.ts     # API host (set before shipping a release build)
│           ├── components/       # custom SVG icon set
│           └── data/             # shared design tokens
├── .github/workflows/            # backend + mobile CI
├── docker-compose.yml            # full stack
└── docker-compose.dev.yml        # Postgres + Redis only
```

---

## Quick start

### Prerequisites

- **Node.js 22+** — required for everything below
- **Docker Desktop** — only if you want a local Postgres (otherwise use a hosted one)
- **Java 17 + Android Studio** (or Xcode on macOS) — only to run the mobile app

### 1. Install

```bash
npm install          # from the repo root — this is an npm workspaces monorepo
```

### 2. Configure

```bash
cp .env.example apps/backend/.env
```

At minimum set `DATABASE_URL` and `JWT_SECRET`. The API will not start without `JWT_SECRET`.

### 3. Database

Either start one locally:

```bash
docker-compose -f docker-compose.dev.yml up -d     # Postgres + Redis
```

…or point `DATABASE_URL` at a hosted Postgres (e.g. Supabase). If you use Supabase, also set
`DIRECT_URL` to the **session** pooler (port 5432) for migrations and seeding.

### 4. Run the API

```bash
npm run backend                    # from the repo root
# API      → http://localhost:3000/api/v1
# Swagger  → http://localhost:3000/api/docs
# Health   → http://localhost:3000/api/v1/health
```

### 5. Run the mobile app

```bash
cd apps/mobile
npx react-native run-android       # or: run-ios (macOS only)
```

> **Before shipping a release build**, set `PRODUCTION_API_BASE_URL` in
> `apps/mobile/src/config/env.ts`. Debug builds point at a dev machine
> (`10.0.2.2` on the Android emulator, `localhost` on iOS). A release build with
> no host configured fails loudly rather than silently showing empty screens.

---

## Database migrations

Development uses `synchronize: true`, so the schema follows the entities automatically.
**Production sets `synchronize: false`** — the schema there is applied only by migrations.

```bash
cd apps/backend

# After changing an entity, generate a migration from the diff (needs a DB to compare against)
npm run migration:generate -- src/migrations/DescribeTheChange

# Apply pending migrations — run this on every deploy, before the app starts
npm run migration:run

# Inspect / undo
npm run migration:show
npm run migration:revert
```

DDL uses `DIRECT_URL` when set. On Supabase that must be the **session** pooler
(port 5432) — the transaction pooler (6543) cannot reliably run schema changes.

> `GET /health` returns **503** if the database is reachable but the schema is
> missing, so a deploy that skipped `migration:run` fails its readiness probe
> instead of silently accepting traffic and erroring on every request.

---

## Seeding demo data

```bash
npm run seed --workspace=apps/backend            # users, employees, HR data, projects board
npm run seed:calendar --workspace=apps/backend   # meetings, participants, RSVPs
```

Both are idempotent. Demo logins (password `Admin@123`):

| Email | Role |
|---|---|
| `admin@hrms.com` | Admin |
| `hr@hrms.com` | HR |
| `manager@hrms.com` | Manager |
| `employee@hrms.com` | Employee |

---

## API reference

Swagger UI at **`/api/docs`** is the source of truth — every endpoint carries a description,
parameter docs and response codes. Base path is `/api/v1`.

| Module | Highlights |
|---|---|
| `auth` | login, register, `/me`, forgot/reset password |
| `users` | CRUD, role and activation (Admin) |
| `employees` | directory (all), create/update (HR/Admin), delete (Admin) |
| `attendance` | check-in, check-out, today, history |
| `leaves` | apply, list, balance, approve, reject, cancel |
| `regularizations` | attendance corrections + approvals |
| `payroll` | generate, list, per-employee payslips, mark paid |
| `tickets` | raise, mine, all, approve/reject, status, cancel |
| `assets` | register, per-employee, assign, return |
| `documents` | per-employee, upload, delete |
| `requests` | create, mine, all, issue, reject |
| `onboarding` | invite, verify, complete, list |
| `holidays`, `announcements` | list, create, delete |
| `notifications` | list, unread count, mark read, push |
| `analytics` | org summary |
| `projects` | projects, teams, members, access, sprints, reports, activity feed |
| `work-items` | tree, board, CRUD, state, work logs, history |
| `sprints` | burndown, per-team burndown, update, delete |
| `calendar` | events, range, upcoming, RSVP, participant search |

---

## Environment variables

See `.env.example`. The ones that matter:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string. Required |
| `DIRECT_URL` | Session-pooler URL used for migrations and seeding (Supabase) |
| `DB_SCHEMA` | Schema to use. TypeORM does **not** read `?schema=` from the URL |
| `JWT_SECRET` | Signing key. **The API refuses to start without it** |
| `JWT_EXPIRES_IN` | Token lifetime (default `7d`) |
| `PORT` | API port (default 3000) |
| `CORS_ORIGINS` | Comma-separated allow-list; all origins allowed when unset (dev only) |
| `REDIS_URL` / `CACHE_DRIVER=redis` | Opt into shared Redis cache. Required if running more than one replica |
| `SMTP_HOST` / `SMTP_USER` / `SMTP_PASS` | Email. Unset ⇒ emails are logged, not sent |
| `FIREBASE_*` | Push notifications. Unset ⇒ push is disabled |
| `SUPABASE_*` | File storage |
| `EXPOSE_DEV_OTP` | Local only — returns one-time codes in the HTTP response. Never set in production |

---

## Testing

```bash
npm run test --workspace=apps/backend        # 29 unit tests, no database needed
npx tsc --noEmit -p apps/backend             # backend typecheck
npx tsc --noEmit -p apps/mobile              # mobile typecheck
```

Coverage focuses on the logic that is easy to get subtly wrong: sprint burndown maths,
backlog roll-ups, work-item state transitions and hierarchy rules, report aggregation,
team access resolution, the audit trail, and the record-ownership rules themselves.

---

## Docker

```bash
docker-compose up --build     # full stack
docker-compose down
```

The backend image builds from the **repo root** (npm workspaces hoists the lockfile there),
installs only the backend workspace, and runs as a non-root user.

---

## CI/CD

- **backend-ci.yml** — lint → test → build → Docker image on `main`
- **mobile-ci.yml** — typecheck → test → Android APK on `main`

Both install from the hoisted root lockfile, as npm workspaces requires.

---

## Known limitations

Honest list of what is not finished:

- **No migration files yet.** The migration tooling is in place, but a baseline migration still has to be
  generated against a live database. Until then, production comes up with an empty schema — though
  `/health` now returns 503 rather than pretending to be ready.
- **No refresh tokens.** A single 7-day JWT, no rotation or revocation. A leaked token stays valid.
- **Some manager/HR dashboard analytics are still placeholder data** — team pulse, attrition, diversity
  and celebrations render from fixtures rather than the API.
- **Not yet verified end-to-end against a live database.** Everything is covered by unit tests, typechecks
  and builds; the full run against real Postgres is still outstanding.
