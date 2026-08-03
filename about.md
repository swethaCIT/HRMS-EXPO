# HRMS — Human Resource Management System
### Product & Feature Documentation (for scoping / pricing)

**Prepared for:** Management / pricing review
**Product type:** Cross-platform mobile HRMS (employee self-service + manager/HR/admin consoles) with a cloud backend and database.

---

## 1. Executive summary

HRMS is a **production-style, role-based Human Resource Management application** consisting of:

- A **mobile app** (Android/iOS from one codebase) used by four different kinds of users.
- A **cloud backend API** (secure, authenticated) that powers the app.
- A **hosted PostgreSQL database** (Supabase) storing all HR data.

The app supports **four distinct user experiences from a single codebase** — **Employee, Manager, HR, and Admin** — each with its own dashboard, navigation, and permissions. Users log in once and automatically get the right experience for their role.

**What makes it substantial:** it is not a set of static screens. Core workflows run **end-to-end** — a user performs an action on the phone, it is saved to the database through a secured API, and other users see the result. Example: an employee applies for leave → it appears in the manager's approval inbox → the manager approves → the database is updated and the employee is notified.

---

## 2. Technology stack

| Layer | Technology |
|---|---|
| **Mobile app** | React Native 0.86 + TypeScript (one codebase → Android & iOS) |
| **State management** | Redux Toolkit |
| **Navigation** | React Navigation (role-based tab + stack navigation) |
| **Charts & icons** | react-native-svg (custom donut/bar/line charts + a hand-built professional line-icon system) |
| **Backend API** | NestJS 11 + TypeScript (enterprise Node.js framework) |
| **Database** | PostgreSQL, hosted on **Supabase** |
| **ORM** | TypeORM |
| **Authentication** | JWT tokens + Passport, bcrypt password hashing |
| **File storage** | Supabase Storage (configured) |
| **Push notifications** | Firebase Cloud Messaging (integration-ready) |
| **API docs** | Swagger / OpenAPI (auto-generated) |
| **Security** | Role-based access control, Helmet security headers, rate limiting, request validation |

---

## 3. Scope at a glance

| Metric | Count |
|---|---|
| **User roles** | 4 (Employee, Manager, HR, Admin) |
| **Mobile screens** | ~22 distinct screens |
| **Backend feature modules** | 11 (auth, users, employees, attendance, leaves, payroll, tickets, assets, requests, notifications, storage) |
| **REST API endpoints** | ~50 |
| **Database tables** | 9 (users, employees, attendance, leaves, payrolls, notifications, tickets, assets, requests) |
| **Data-backed workflows** | Login, profile, punch in/out, leave apply→approve, tickets, notifications, assets, user management, and more |

---

## 4. User roles & what each can do

The app detects the user's role at login and shows the matching experience with its own bottom-tab navigation.

### 4.1 Employee
The self-service experience for a regular staff member.

| Feature | What it does |
|---|---|
| **Home dashboard** | Live "Today's Attendance" card, personal overview (leave balance, attendance %, assets, support), quick actions, weekly view |
| **Punch In / Punch Out** | Real attendance clock-in/out with **Office / Work-from-home** choice; times saved to the database; prevents double punch |
| **Leave** | Calendar view + apply-for-leave form (type, date range, reason) that creates a real leave request |
| **Tickets** | Raise a support ticket (guided wizard: department → category → priority → description), view my tickets, ticket detail with status/approval tracker |
| **Payslip** | Monthly payslip with net pay, gross, deductions, and a salary-composition donut chart |
| **Timesheet** | Weekly attendance view + regularization requests |
| **Assets** | List of company assets assigned to me (laptop, monitor, phone…) with serial numbers, condition, assignment date |
| **Notifications** | Personal notification center; each notification is tappable and opens the relevant screen |
| **Profile** | Full employee record (see §5) |

### 4.2 Manager
Everything a team lead needs to run their team.

| Feature | What it does |
|---|---|
| **Team dashboard** | Live "Team Pulse" (present/remote/on-leave), pending-approvals summary, team KPIs, who's away today |
| **Approvals inbox** | Unified queue of **leave / ticket / regularization / expense** requests; **Approve / Reject** each (writes to DB), bulk "Approve all", Pending/Approved/Rejected tabs, live count badge |
| **Team directory** | Team members with live presence, search, filters; drill into a member |
| **Member detail** | Performance snapshot (attendance / utilization / review rings), contact actions, projects |
| **Insights** | Team analytics — attendance trend, leave distribution donut, headcount, top performers |

### 4.3 HR
Organization-wide people operations.

| Feature | What it does |
|---|---|
| **HR dashboard** | Org pulse (headcount, availability, departments), pending-requests summary, new joiners, celebrations (birthdays/anniversaries) |
| **Requests inbox** | Employee requests — **document/letter, profile change, onboarding, leave**; Issue/Approve or Reject; process-all; status tabs |
| **People directory** | Full company directory pulled from the database, department filters, search |
| **Employee onboarding** | Invite and onboard a **new hire before they join** — HR sends a one-time invite; the candidate self-registers and fills their own details; on completion the employee is provisioned a permanent company email + employee ID (full workflow in §5.1) |
| **Org insights** | Attrition trend, gender-diversity donut, headcount by department |

#### 5.1 Employee onboarding workflow (new-hire invite & self-registration)

A guided flow that lets HR onboard employees **who have not yet joined the company**, and shifts data entry to the employee themselves:

1. **HR initiates onboarding** for a new hire by entering a **temporary employee ID** and the candidate's **personal email address**.
2. The system **emails the candidate** a secure **one-time registration invite** (a one-time link / OTP tied to that personal email).
3. The candidate uses that **one-time credential to register** and **fill in their own details** — personal information, address, emergency contact, bank & statutory details, and documents.
4. **HR reviews and confirms** the submitted information.
5. On completion, the employee is **provisioned their permanent company email and official employee ID**, and their temporary invite converts into a normal, active employee login.

**Value:** removes repetitive HR data-entry, captures accurate data directly from the employee, and uses a secure credential that **expires after registration** (one-time use). It plugs directly into the existing People directory, Profile record, and Requests inbox.

> **Status:** the onboarding **request type and HR inbox handling are in place**; the full invite-email + one-time self-registration + auto-provisioning flow is the **next build item** (see §11 roadmap).

### 4.4 Admin
System administration and access control.

| Feature | What it does |
|---|---|
| **Admin dashboard** | System status (API/DB/Storage/Auth), user counts, users-by-role breakdown |
| **User management** | Live list of all users from the database; **change a user's role**, **activate/deactivate** accounts — all persisted |
| **People / Insights** | Org directory and analytics |

### 4.5 Goals — project management board (Azure Boards-style PMS)

A full delivery-management module reachable from a **"Goals" section on every role's home screen**. It mirrors the structure teams already know from Azure Boards / Jira, on a phone.

**Hierarchy:** Project → Teams → Sprints (iterations) → **Epic → Feature → User Story → Task / Bug**

| Screen | What it does |
|---|---|
| **Goals section (home)** | Portfolio roll-up (% delivered, active items), horizontal strip of project cards, "assigned to me" shortcut |
| **Projects list** | Every project with progress, team/member counts, running sprint and overdue count; managers/HR/admin can create a project |
| **Project board home** | Health hero, state mix (New/Active/Resolved/Closed), effort roll-up, live **sprint burndown**, team cards, iteration list |
| **Backlog** | Collapsible **Epic → Feature → Story → Task** tree; every parent shows progress, effort and points **rolled up from all descendants**; filter by type or sprint |
| **Board (kanban)** | One column per state; tap a card's arrow to move it through the workflow (writes straight to the DB) |
| **Work item detail** | Azure-style card: state stepper, priority, assignee, **Original Estimate / Completed / Remaining**, story points, parent & children, dates, **log work** + time-entry history |
| **Sprints** | Iteration list with completion; create a sprint (auto-queued after the previous one) |
| **Sprint detail** | **Burndown (actual vs ideal)**, ahead/behind variance, effort logged per day, state mix, load per person, sprint backlog |
| **Team detail** | The squad's manager, members with per-person workload, and the **team's own sprint burndown** (burndown scoped to that team) |
| **Reports → Project** | Completion %, on-time %, avg cycle time, open bugs, contributors, effort (estimated/completed/remaining/logged), state donut, breakdown by type and priority, **velocity (committed vs completed per sprint)**, hours logged per week, per-team delivery |
| **Reports → People** | Individual report per person: assigned / closed / active / overdue, points delivered, **hours logged**, share of total project effort, days engaged, avg hours per active day, on-time %, avg cycle time and estimate accuracy |
| **Member report** | One person's full contribution — hours per day (14-day chart), assigned work and every time entry |
| **My work items** | Everything assigned to the signed-in user across all boards, filterable by state |

**States:** New · Active · Resolved · Closed · Removed — with timestamps captured on each transition, which is what powers cycle time, on-time reporting and the burndown curve.

**Effort model:** original estimate, remaining work and completed work per item (hours), plus story points. Time entries are recorded against work items, so both project cost and individual contribution are real data, not estimates.

**Permissions:** every signed-in user can read the boards, move items and log their own time; creating/deleting projects, teams, sprints and work items is restricted to Manager / HR / Admin. Assigning someone a work item notifies them in-app, by email and via push.

### 4.6 Shared across roles
- **Role-aware navigation** — the correct tabs appear for each role.
- **"Switch view"** — managers/HR/admins can flip between their management console and their own personal employee view.
- **Notification center** — common to all roles, actionable.
- **Persistent login** — users stay signed in across app restarts.
- **Consistent professional UI** — deep-indigo headers, custom line icons, cards, charts; the bottom navigation bar stays visible on every screen.

---

## 5. The employee Profile (enterprise record)

A full HR record, organized into sections and driven by real data:

- **Header:** photo/initials, name, designation · department, role, employee ID, active status.
- **Employment:** Employee ID, designation, department, grade/band, employment type, work mode, work location, reporting manager, date of joining + tenure, status.
- **Personal:** date of birth, gender, blood group, marital status, nationality.
- **Statutory & Bank:** PAN, UAN (PF), bank, masked account number.
- **Contact & Emergency:** work email, personal email, phone (tap to call), address, emergency contact.
- **Account:** notifications, privacy & security, help & support, sign out.

---

## 6. Key end-to-end workflows (fully working against the database)

These are complete, multi-user flows — the strongest indicator of real product depth:

1. **Authentication** — login issues a secure token; the app loads the user + their employee record; sessions persist across restarts; invalid/expired sessions are handled.
2. **Attendance** — employee punches in (office/WFH) and out; saved to DB; dashboard reflects live status; designed to later accept punches from a **biometric machine or geofence** (a data field is already in place for the source).
3. **Leave lifecycle** — employee submits leave → stored in DB → appears in manager's approval inbox → manager approves/rejects → DB updated (verified end-to-end).
4. **Tickets** — employee raises a ticket → stored → listed; managers can approve/reject.
5. **Notifications** — per-user notifications stored in DB; unread badges; tapping a notification opens the related module (payslip, leave, ticket, etc.).
6. **User administration** — admin lists users, changes roles, enables/disables accounts — persisted and permission-protected.
7. **Assets / People / Payslip / Requests** — read real records from the database.

---

## 7. Security & access control

- **JWT authentication** on every protected endpoint.
- **Role-based access control (RBAC):** privileged actions are locked to the correct role — e.g., only Admin can manage users; only Manager/HR/Admin can approve leave. (Verified: an employee is blocked with "403 Forbidden" from admin actions.)
- **Password hashing** (bcrypt).
- **API hardening:** Helmet security headers, request **rate limiting**, configurable **CORS**, and strict input validation.
- **Secrets management:** credentials kept in environment configuration, not in the code.

---

## 8. Backend API surface (summary)

Auto-documented via Swagger. Major endpoint groups:

- **Auth** — login, register, current-user profile (`/auth/me`)
- **Users** — CRUD + role / activation (admin-only)
- **Employees** — directory, profile, update
- **Attendance** — check-in, check-out, today's status, history
- **Leaves** — create, list, approve, reject
- **Payroll** — payslips per employee, generate, mark paid
- **Tickets** — create, list, mine, approve, reject, status
- **Assets** — list, by employee, assign, return
- **Requests** — create, list, issue, reject (HR documents/letters)
- **Notifications** — list, unread count, mark read, mark-all-read, push-send
- **Storage** — file upload (Supabase)

---

## 9. Database (9 tables)

`users`, `employees`, `attendance`, `leaves`, `payrolls`, `notifications`, `tickets`, `assets`, `requests` — with relationships (e.g., an employee links to a user; attendance/leaves/payroll/assets link to an employee). Hosted on Supabase PostgreSQL. A **seed process** creates demo logins for all four roles with realistic sample data.

**Demo logins** (password `Admin@123`): `admin@hrms.com`, `hr@hrms.com`, `manager@hrms.com`, `employee@hrms.com`.

---

## 10. Integration readiness (built to extend)

| Integration | Status |
|---|---|
| **Supabase Postgres** | Live — all data is stored here |
| **Supabase Storage** | Configured — ready for document/photo upload |
| **Biometric punch machine / geofenced attendance** | Data model ready (attendance records carry a "source" so machine/GPS punches can be added without rework) |
| **Firebase push notifications (FCM)** | Integration-ready (turns on with Firebase credentials) |
| **Transactional email (onboarding invites, OTP)** | Planned — powers the new-hire onboarding invite & one-time registration (§5.1) |
| **Azure storage** | Placeholder for future migration |

---

## 11. Delivery status — honest breakdown

**Fully working & database-connected:** authentication, persistent login, role-based navigation & security, employee profile, punch in/out, leave apply→approve, tickets, notifications (with deep-linking), assets, people directory, admin user management, payslip figures.

**Built and polished, currently shown with representative data** (backend can be connected next): some dashboard analytics/insight charts, timesheet weekly grid, parts of the payslip breakdown, and HR document templates.

**Planned next (roadmap — future value):**
- **Employee onboarding — full new-hire invite & self-registration** (HR sends a one-time email invite with a temporary employee ID → candidate self-registers and fills their details → auto-provision permanent company email + employee ID). *(See §5.1.)*
- Finish connecting all analytics to live data; list pagination.
- Leave-balance accrual, forgot/reset password, live push notifications.
- Audit log, org chart, performance reviews, holiday calendar, payroll run generation, reports/exports.
- Visual polish pass (loading states, dark mode, branding), profile photo upload.
- Production hardening: database migrations, automated tests + CI, error monitoring.

---

## 12. Why this represents significant work (for pricing context)

- **4 complete role-based products** in one app, not a single interface.
- **~22 screens** with consistent, custom, professional UI (custom chart and icon systems, not off-the-shelf).
- **A full secured backend** (~50 endpoints, 11 modules) with **role-based permissions**, not just a front-end mockup.
- **A real cloud database** with 9 related tables and multi-user workflows proven end-to-end.
- **Enterprise concerns addressed**: authentication, authorization, security hardening, session management, and extension points for biometric attendance and push notifications.

---

*This document reflects the current state of the HRMS application and is intended to help assess scope and pricing. A live walkthrough on a device can be provided on request.*
