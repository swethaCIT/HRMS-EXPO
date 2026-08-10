# API test harness

Exercises **every** HRMS endpoint over HTTP, as each of the four roles, and tells you
what passed, what was refused, and what isn't covered.

It lives outside `apps/` on purpose: nothing in the backend or the mobile app imports it,
so it cannot change how the product behaves. Delete this folder and the app is unaffected.

## Run it

```bash
# 1. start the API
npm run backend

# 2. in another terminal
node tools/api-test/run.mjs
```

Options:

```bash
node tools/api-test/run.mjs --url http://localhost:3001/api/v1   # different host
node tools/api-test/run.mjs --only projects,leaves               # one or more groups
node tools/api-test/run.mjs --json report.json                   # machine-readable output
```

Exit code is `0` when every assertion passes, `1` on any failure, `2` if it couldn't run
(usually: the API isn't up, or the database hasn't been seeded).

## What it does

1. **Reads the live OpenAPI spec** from `/api/docs-json`. The endpoint list comes from the
   running app, not from a list maintained here — so a new endpoint shows up as
   *uncovered* until someone writes a case for it. That diff is the point.
2. **Signs in as all four roles** (`admin`, `hr`, `manager`, `employee` — password `Admin@123`)
   and keeps every token. This is the role-based part: each endpoint is called with the
   token of the role that should be allowed, **and** with one that shouldn't.
3. **Resolves real ids** from seeded data — the employee and manager records, a project,
   a team, the current sprint.
4. **Creates its own fixtures** (a leave, ticket, payslip, asset, request, work item and
   meeting), exercises everything against them, then removes what it can.
5. **Prints a coverage report**: covered / deliberately skipped / uncovered.

## What "covered" means

Roughly a third of the assertions are **negative**: they prove the API says *no* to the
wrong role. Those matter more than the happy path — an endpoint that returns 200 to
everyone still "works" in a naive test. Examples the harness asserts:

- an employee reading a colleague's payslip, attendance, leave or documents → **403**
- an employee punching in as someone else → **403** (no buddy-punching)
- an employee generating payroll, setting a ticket's status, or reading the asset register → **403**
- a manager reading payroll → **403** (running a team doesn't imply seeing pay)
- HR reading the audit log → **403** (admin-only)
- registering with `"role":"admin"` → account created as **employee**, then 403 on `/users`
- deactivating a manager → they are **still a manager** afterwards
- a duplicate payroll period → **409**, not a 500
- bad enum / non-numeric salary / preset `status` in the body → **400**

## Files

| File | Purpose |
|---|---|
| `run.mjs` | The runner: spec fetch, login, fixtures, execution, report |
| `policy.mjs` | What to send where, as whom, and what to expect. Edit this to add cases |

## Adding a case

Add an entry to the right group in `policy.mjs`:

```js
{ op: 'GET /my-new-endpoint', as: 'manager', expect: 200 },
{ op: 'GET /my-new-endpoint', as: 'employee', expect: 403, note: 'manager-only' },
```

`op` must match the spec path exactly (without the `/api/v1` prefix). Use `{placeholders}`
for ids — the runner substitutes them from resolved context, and reports `SKIP` rather than
guessing if one is missing. Anything genuinely not worth testing goes in `SKIP` **with a
reason**, so a skipped endpoint is a decision rather than an oversight.

## Notes

- It writes to whatever database the API is pointed at. Fine against the dev/seeded
  database; **don't point it at production.**
- Leave, ticket, payslip, asset and request fixtures are left behind — those records have
  no delete endpoint by design, because they're auditable. Meetings, work items and the
  temporary project/team/user it creates are cleaned up.
- Two bugs were found by writing this: HR couldn't edit an employee's work mode, address,
  emergency contact, PAN, UAN or bank details (the DTO whitelisted 11 of ~25 entity
  fields, so `forbidNonWhitelisted` rejected the rest with 400), and a duplicate payroll
  period escaped as an unhandled 500 instead of a 409.
