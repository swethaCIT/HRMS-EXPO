#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════════════════
   HRMS API test harness — role-based, end-to-end, outside the app.

   Nothing here is imported by the backend or the mobile app. It talks to a
   RUNNING API over HTTP exactly as a client would, so it cannot change how
   the app behaves; delete this folder and the product is unaffected.

   What it does:
     1. Reads the live OpenAPI spec from /api/docs-json, so the endpoint list
        comes from the running app rather than a list someone maintains here.
     2. Signs in as admin / hr / manager / employee and keeps all four tokens.
     3. Resolves real ids from seeded data (employees, project, sprint, …).
     4. Creates its own fixtures, exercises every covered endpoint as the
        right role AND asserts the wrong role is refused, then deletes what
        it created.
     5. Prints a coverage report: which spec endpoints were tested, which
        were deliberately skipped and why, and which are NOT covered at all.

   Usage:
     node tools/api-test/run.mjs
     node tools/api-test/run.mjs --url http://localhost:3001/api/v1
     node tools/api-test/run.mjs --only projects,leaves
     node tools/api-test/run.mjs --json report.json
   ════════════════════════════════════════════════════════════════════════ */

import { CASES, LIFECYCLE, SKIP } from './policy.mjs';

/* ── args ── */
const argv = process.argv.slice(2);
const arg = (name, dflt) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt;
};
const BASE = (arg('url', process.env.API_URL || 'http://localhost:3001/api/v1')).replace(/\/$/, '');
const DOCS_JSON = BASE.replace(/\/api\/v\d+$/, '') + '/api/docs-json';
const ONLY = arg('only', '').split(',').filter(Boolean);
const JSON_OUT = arg('json', '');
const PASSWORD = process.env.DEMO_PASSWORD || 'Admin@123';

/* ── tiny console helpers (no dependencies) ── */
const C = { g: '\x1b[32m', r: '\x1b[31m', y: '\x1b[33m', d: '\x1b[90m', b: '\x1b[1m', x: '\x1b[0m' };
const ok = (s) => `${C.g}${s}${C.x}`;
const bad = (s) => `${C.r}${s}${C.x}`;
const dim = (s) => `${C.d}${s}${C.x}`;
const warn = (s) => `${C.y}${s}${C.x}`;

/* ── state ── */
const tokens = {};
const vars = {};
const results = [];
const createdEvents = [];

async function http(method, path, { token, body, query } = {}) {
  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(query ?? {})) if (v !== undefined) url.searchParams.set(k, String(v));
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let parsed = null;
  try { parsed = JSON.parse(text); } catch { /* empty or non-JSON body */ }
  return { status: res.status, body: parsed, text };
}

/** Substitute {placeholders} from resolved context. */
const fill = (s) => String(s).replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? vars[k] : m));

async function login(email) {
  const r = await http('POST', '/auth/login', { body: { email, password: PASSWORD } });
  if (r.status !== 200 || !r.body?.access_token) {
    throw new Error(`login failed for ${email}: HTTP ${r.status} ${r.text.slice(0, 160)}`);
  }
  return r.body.access_token;
}

/* ── phase 1: spec ── */
async function loadSpec() {
  const res = await fetch(DOCS_JSON);
  if (!res.ok) throw new Error(`could not read the OpenAPI spec at ${DOCS_JSON} (HTTP ${res.status})`);
  const spec = await res.json();
  const ops = [];
  for (const [p, methods] of Object.entries(spec.paths ?? {})) {
    // The spec reports fully-prefixed paths (/api/v1/projects) while the policy
    // is written against the route (/projects), so strip the global prefix —
    // otherwise every endpoint reads as "not covered".
    const route = p.replace(/^\/api\/v\d+/, '') || '/';
    for (const m of Object.keys(methods)) {
      if (['get', 'post', 'patch', 'put', 'delete'].includes(m)) ops.push(`${m.toUpperCase()} ${route}`);
    }
  }
  return [...new Set(ops)].sort();
}

/* ── phase 2: context from real seeded data ── */
async function resolveContext() {
  for (const role of ['admin', 'hr', 'manager', 'employee']) {
    tokens[role] = await login(`${role}@hrms.com`);
  }

  const me = await http('GET', '/auth/me', { token: tokens.employee });
  vars.employeeId = me.body?.employee?.id;
  vars.userId = me.body?.user?.id;

  const mgr = await http('GET', '/auth/me', { token: tokens.manager });
  vars.managerEmployeeId = mgr.body?.employee?.id;

  const projects = await http('GET', '/projects', { token: tokens.manager });
  const project = (projects.body ?? []).find((p) => (p.itemsTotal ?? 0) > 0) ?? projects.body?.[0];
  vars.projectId = project?.id;

  if (vars.projectId) {
    const detail = await http('GET', `/projects/${vars.projectId}`, { token: tokens.manager });
    vars.teamId = detail.body?.teams?.[0]?.id;
    const sprints = await http('GET', `/projects/${vars.projectId}/sprints`, { token: tokens.manager });
    vars.sprintId = (sprints.body ?? []).find((s) => s.status === 'current')?.id ?? sprints.body?.[0]?.id;
  }

  const missing = ['employeeId', 'userId', 'managerEmployeeId', 'projectId'].filter((k) => !vars[k]);
  if (missing.length) {
    throw new Error(
      `could not resolve ${missing.join(', ')} from seeded data — run the seeds first:\n` +
        '  npm run seed --workspace=apps/backend',
    );
  }
}

/* ── phase 3: fixtures this harness owns ── */
async function createFixtures() {
  for (const [name, def] of Object.entries(LIFECYCLE)) {
    const { method, path, as, body } = def.create;
    const r = await http(method, fill(path), { token: tokens[as], body: body(vars) });
    const id = def.idFrom(r.body);
    if (!id) {
      console.log(warn(`  ! fixture "${name}" not created (HTTP ${r.status}) — cases needing it will be skipped`));
      continue;
    }
    vars[`${name}Id`] = id;
    if (name === 'event') createdEvents.push(id);
    console.log(dim(`  + ${name} ${String(id).slice(0, 8)}…`));
  }
}

/* ── phase 4: run the cases ── */
function matches(expect, status) {
  return Array.isArray(expect) ? expect.includes(status) : expect === status;
}

const ctx = {
  vars,
  get: (path, as) => http('GET', path, { token: tokens[as] }),
  /** Decode a JWT payload and look the user up, to prove what role was granted. */
  roleOfToken: async (token) => {
    const me = await http('GET', '/auth/me', { token });
    return me.body?.user?.role;
  },
};

async function runGroup(group, cases) {
  console.log(`\n${C.b}${group}${C.x}`);
  for (const c of cases) {
    const [method, specPath] = c.op.split(' ');
    let path = specPath;
    for (const [k, v] of Object.entries(c.params ?? {})) path = path.replace(`{${k}}`, fill(v));

    // Any unresolved placeholder means a fixture is missing — report, don't guess.
    const unresolved = path.match(/\{(\w+)\}/);
    if (unresolved) {
      results.push({ group, op: c.op, status: 'skipped', reason: `no value for ${unresolved[0]}` });
      console.log(`  ${warn('SKIP')} ${c.op} ${dim(`(no ${unresolved[0]})`)}`);
      continue;
    }

    const query = Object.fromEntries(Object.entries(c.query ?? {}).map(([k, v]) => [k, fill(v)]));
    const r = await http(method, path, {
      token: c.as ? tokens[c.as] : undefined,
      body: c.body ? c.body(vars) : undefined,
      query,
    });

    let pass = matches(c.expect, r.status);
    let detail = '';
    if (pass && c.assert) {
      const verdict = await c.assert(r.body, ctx);
      if (verdict !== true) { pass = false; detail = typeof verdict === 'string' ? verdict : 'assertion failed'; }
    }
    if (pass && c.capture) {
      vars[c.capture] = c.captureFrom ? c.captureFrom(r.body) : r.body?.id;
    }

    const label = `${c.op}${c.as ? dim(` as ${c.as}`) : dim(' anonymous')}`;
    const expectStr = Array.isArray(c.expect) ? c.expect.join('/') : c.expect;
    if (pass) {
      console.log(`  ${ok('PASS')} ${label} ${dim(`→ ${r.status}`)}${c.note ? dim(`  · ${c.note}`) : ''}`);
    } else {
      console.log(`  ${bad('FAIL')} ${label} → got ${bad(r.status)}, expected ${expectStr}` +
        (detail ? `\n         ${bad(detail)}` : '') +
        (r.body?.message ? dim(`\n         server: ${JSON.stringify(r.body.message).slice(0, 200)}`) : ''));
    }
    results.push({ group, op: c.op, as: c.as, status: pass ? 'pass' : 'fail', got: r.status, expect: c.expect, detail, note: c.note });
  }
}

/* ── phase 5: clean up what we created ── */
async function cleanup() {
  const del = async (label, method, path, as) => {
    const r = await http(method, fill(path), { token: tokens[as] });
    console.log(dim(`  - ${label}: ${r.status}`));
  };
  for (const id of createdEvents) await del('meeting', 'DELETE', `/calendar/events/${id}`, 'manager');
  if (vars.workItemId) await del('work item', 'DELETE', `/work-items/${vars.workItemId}`, 'manager');
  if (vars.tempProjectId) await del('temp project', 'DELETE', `/projects/${vars.tempProjectId}`, 'manager');
  console.log(dim('  note: leave/ticket/payroll/asset/request fixtures are left in place —'));
  console.log(dim('        they have no delete endpoint by design (records are auditable).'));
}

/* ── report ── */
function report(specOps) {
  const tested = new Set(results.filter((r) => r.status !== 'skipped').map((r) => r.op));
  const pass = results.filter((r) => r.status === 'pass').length;
  const fail = results.filter((r) => r.status === 'fail');
  const skip = results.filter((r) => r.status === 'skipped');

  const covered = specOps.filter((o) => tested.has(o));
  const skipped = specOps.filter((o) => SKIP[o]);
  const uncovered = specOps.filter((o) => !tested.has(o) && !SKIP[o]);

  console.log(`\n${C.b}────────────── SUMMARY ──────────────${C.x}`);
  console.log(`  assertions : ${ok(`${pass} passed`)}${fail.length ? `, ${bad(`${fail.length} failed`)}` : ''}${skip.length ? `, ${warn(`${skip.length} skipped`)}` : ''}`);
  console.log(`  endpoints  : ${covered.length}/${specOps.length} covered, ${skipped.length} deliberately skipped, ${uncovered.length} uncovered`);

  if (fail.length) {
    console.log(`\n${bad('FAILURES')}`);
    fail.forEach((f) => console.log(`  · ${f.op}${f.as ? ` as ${f.as}` : ''} — got ${f.got}, expected ${Array.isArray(f.expect) ? f.expect.join('/') : f.expect}${f.detail ? ` · ${f.detail}` : ''}`));
  }
  if (skipped.length) {
    console.log(`\n${dim('DELIBERATELY SKIPPED')}`);
    skipped.forEach((o) => console.log(dim(`  · ${o} — ${SKIP[o]}`)));
  }
  if (uncovered.length) {
    console.log(`\n${warn('NOT COVERED — no case defined in policy.mjs')}`);
    uncovered.forEach((o) => console.log(warn(`  · ${o}`)));
  }

  if (JSON_OUT) {
    const fs = require('node:fs');
    fs.writeFileSync(JSON_OUT, JSON.stringify({ base: BASE, at: new Date().toISOString(), summary: { pass, fail: fail.length, skip: skip.length, specOps: specOps.length, covered: covered.length, uncovered }, results }, null, 2));
    console.log(dim(`\n  wrote ${JSON_OUT}`));
  }
  return fail.length === 0;
}

/* ── main ── */
(async () => {
  console.log(`${C.b}HRMS API test harness${C.x}`);
  console.log(dim(`  target: ${BASE}`));

  let specOps = [];
  try {
    specOps = await loadSpec();
    console.log(dim(`  spec:   ${specOps.length} endpoints from ${DOCS_JSON}`));
  } catch (e) {
    console.log(warn(`  spec:   unavailable (${e.message}) — coverage will not be reported`));
  }

  console.log(dim('\nresolving context…'));
  await resolveContext();
  console.log(dim(`  employee=${vars.employeeId.slice(0, 8)}… manager=${vars.managerEmployeeId.slice(0, 8)}… project=${vars.projectId.slice(0, 8)}…`));

  console.log(dim('\ncreating fixtures…'));
  await createFixtures();

  const groups = Object.entries(CASES).filter(([g]) => !ONLY.length || ONLY.includes(g));
  for (const [group, cases] of groups) await runGroup(group, cases);

  console.log(dim('\ncleaning up…'));
  await cleanup();

  const green = report(specOps);
  process.exit(green ? 0 : 1);
})().catch((e) => {
  console.error(`\n${bad('harness could not run:')} ${e.message}`);
  console.error(dim('  is the API running?  npm run backend'));
  process.exit(2);
});
