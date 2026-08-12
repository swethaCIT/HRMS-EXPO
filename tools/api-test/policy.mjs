/* ════════════════════════════════════════════════════════════════════════
   What to send to each endpoint, as which role, and what to expect back.

   Keyed by `METHOD /path` exactly as the OpenAPI spec reports it, so the
   runner can diff this against the live spec and tell you which endpoints
   are NOT yet covered. That diff is the point: coverage is measured against
   the running app, not against this file.

   Placeholders resolved by the runner from real seeded data:
     {employeeId} {managerEmployeeId} {userId}
     {projectId} {teamId} {sprintId} {workItemId} {memberId}
     {leaveId} {ticketId} {payrollId} {assetId} {requestId} {documentId}
     {eventId} {notificationId}

   `expect` may be a number or an array of acceptable codes.
   `negative` cases assert that the WRONG role is refused — the rules that
   matter most are the ones that say no.
   ════════════════════════════════════════════════════════════════════════ */

/** Resources the runner creates first, reuses, then deletes at the end. */
export const LIFECYCLE = {
  leave: {
    create: { method: 'POST', path: '/leaves', as: 'employee', body: (c) => ({
      employeeId: c.employeeId, type: 'casual',
      startDate: '2026-11-03', endDate: '2026-11-04', reason: 'api-test harness',
    }) },
    idFrom: (b) => b?.id,
  },
  ticket: {
    create: { method: 'POST', path: '/tickets', as: 'employee', body: () => ({
      subject: 'api-test harness ticket', dept: 'IT', category: 'Hardware',
      subCategory: 'Laptop Issue', priority: 'Low', description: 'created by the api-test harness',
    }) },
    idFrom: (b) => b?.id,
  },
  payroll: {
    create: { method: 'POST', path: '/payroll/generate', as: 'hr', body: (c) => ({
      employeeId: c.employeeId, month: 11, year: 2026, basicSalary: 42000,
    }) },
    idFrom: (b) => b?.id,
  },
  asset: {
    create: { method: 'POST', path: '/assets', as: 'hr', body: (c) => ({
      assetTag: `APITEST-${Date.now()}`, name: 'Harness Laptop', category: 'Laptop',
      serialNumber: 'HARNESS-1', employeeId: c.employeeId, assignedDate: '2026-08-01',
    }) },
    idFrom: (b) => b?.id,
  },
  request: {
    create: { method: 'POST', path: '/requests', as: 'employee', body: () => ({
      kind: 'document', title: 'api-test harness request', reason: 'harness',
      detail: [{ k: 'Purpose', v: 'testing' }],
    }) },
    idFrom: (b) => b?.id,
  },
  workItem: {
    create: { method: 'POST', path: '/work-items', as: 'manager', body: (c) => ({
      projectId: c.projectId, type: 'task', title: 'api-test harness task',
      originalEstimate: 3, priority: 3, assigneeId: c.employeeId, assigneeName: 'Rahul Verma',
    }) },
    idFrom: (b) => b?.id,
  },
  event: {
    create: { method: 'POST', path: '/calendar/events', as: 'manager', body: (c) => ({
      title: 'api-test harness meeting',
      startDateTime: '2026-11-05T10:00:00.000Z', endDateTime: '2026-11-05T11:00:00.000Z',
      meetingMode: 'Online', meetingLink: 'https://meet.hrms.com/harness',
      participantIds: [c.employeeId],
    }) },
    idFrom: (b) => b?.eventId,
  },
};

/** Everything the harness asserts, grouped by module for a readable report. */
export const CASES = {
  auth: [
    { op: 'POST /auth/login', as: null, body: () => ({ email: 'employee@hrms.com', password: 'Admin@123' }), expect: 200, note: 'valid credentials' },
    { op: 'POST /auth/login', as: null, body: () => ({ email: 'employee@hrms.com', password: 'WrongPassword1' }), expect: 401, note: 'wrong password refused' },
    { op: 'GET /auth/me', as: 'employee', expect: 200 },
    { op: 'GET /auth/me', as: null, expect: 401, note: 'no token refused' },
    { op: 'POST /auth/register', as: null, body: () => ({ email: `harness.${Date.now()}@hrms.com`, password: 'Password123', role: 'admin' }), expect: 201,
      assert: (b, ctx) => ctx.roleOfToken(b.access_token).then((r) => r === 'employee' || `privilege escalation: got role ${r}`),
      note: 'asks for admin, must be created as employee' },
    { op: 'POST /auth/forgot-password', as: null, body: () => ({ email: 'employee@hrms.com' }), expect: 200 },
    { op: 'POST /auth/reset-password', as: null, body: () => ({ email: 'employee@hrms.com', otp: '000000', password: 'Whatever123' }), expect: 400, note: 'bad OTP refused' },
  ],

  users: [
    { op: 'GET /users', as: 'admin', expect: 200 },
    { op: 'GET /users', as: 'employee', expect: 403, note: 'admin-only' },
    { op: 'GET /users/{id}', as: 'admin', params: { id: '{userId}' }, expect: 200 },
    { op: 'POST /users', as: 'admin', body: () => ({ email: `harness.user.${Date.now()}@hrms.com`, password: 'Password123', role: 'employee' }), expect: 201, capture: 'tempUserId' },
    { op: 'PATCH /users/{id}', as: 'admin', params: { id: '{tempUserId}' }, body: () => ({ role: 'manager' }), expect: 200 },
    { op: 'PATCH /users/{id}', as: 'admin', params: { id: '{tempUserId}' }, body: () => ({ isActive: false }), expect: 200,
      assert: async (_b, ctx) => {
        const r = await ctx.get(`/users/${ctx.vars.tempUserId}`, 'admin');
        return r.body?.role === 'manager' || `deactivating changed role to ${r.body?.role} (should stay manager)`;
      },
      note: 'deactivate must NOT silently demote' },
    { op: 'DELETE /users/{id}', as: 'admin', params: { id: '{tempUserId}' }, expect: 200 },
    { op: 'DELETE /users/{id}', as: 'employee', params: { id: '{userId}' }, expect: 403 },
  ],

  employees: [
    { op: 'GET /employees', as: 'employee', expect: 200, note: 'directory readable by all' },
    { op: 'GET /employees/{id}', as: 'employee', params: { id: '{employeeId}' }, expect: 200 },
    { op: 'PATCH /employees/{id}', as: 'employee', params: { id: '{employeeId}' }, body: () => ({ phone: '+91 90000 00000' }), expect: 403, note: 'writes are HR/Admin' },
    { op: 'PATCH /employees/{id}', as: 'hr', params: { id: '{employeeId}' }, body: () => ({ workMode: 'Hybrid' }), expect: 200 },
    { op: 'DELETE /employees/{id}', as: 'hr', params: { id: '{employeeId}' }, expect: 403, note: 'delete is Admin-only' },
  ],

  attendance: [
    { op: 'GET /attendance', as: 'manager', expect: 200 },
    { op: 'GET /attendance', as: 'employee', expect: 403 },
    { op: 'GET /attendance/today/{employeeId}', as: 'employee', params: { employeeId: '{employeeId}' }, expect: 200 },
    { op: 'GET /attendance/{employeeId}', as: 'employee', params: { employeeId: '{employeeId}' }, expect: 200 },
    { op: 'GET /attendance/{employeeId}', as: 'employee', params: { employeeId: '{managerEmployeeId}' }, expect: 403, note: "can't read a colleague's attendance" },
    { op: 'POST /attendance/{employeeId}/check-in', as: 'employee', params: { employeeId: '{employeeId}' }, body: () => ({ mode: 'office' }), expect: [201, 200] },
    { op: 'POST /attendance/{employeeId}/check-in', as: 'employee', params: { employeeId: '{managerEmployeeId}' }, body: () => ({ mode: 'office' }), expect: 403, note: 'no buddy-punching' },
    { op: 'POST /attendance/{employeeId}/check-out', as: 'employee', params: { employeeId: '{employeeId}' }, expect: [200, 201, 404] },
  ],

  leaves: [
    { op: 'GET /leaves', as: 'manager', expect: 200 },
    { op: 'GET /leaves', as: 'employee', expect: 403 },
    { op: 'GET /leaves/employee/{employeeId}', as: 'employee', params: { employeeId: '{employeeId}' }, expect: 200 },
    { op: 'GET /leaves/employee/{employeeId}', as: 'employee', params: { employeeId: '{managerEmployeeId}' }, expect: 403 },
    { op: 'GET /leaves/balance/{employeeId}', as: 'employee', params: { employeeId: '{employeeId}' }, expect: 200 },
    { op: 'POST /leaves', as: 'employee', body: (c) => ({ employeeId: c.managerEmployeeId, type: 'casual', startDate: '2026-11-10', endDate: '2026-11-10', reason: 'x' }), expect: 403, note: "can't file in someone else's name" },
    { op: 'PATCH /leaves/{id}/approve', as: 'manager', params: { id: '{leaveId}' }, expect: 200 },
    { op: 'PATCH /leaves/{id}/approve', as: 'employee', params: { id: '{leaveId}' }, expect: 403 },
    { op: 'PATCH /leaves/{id}/reject', as: 'manager', params: { id: '{leaveId}' }, body: () => ({ reason: 'harness' }), expect: 200 },
    { op: 'PATCH /leaves/{id}/cancel', as: 'employee', params: { id: '{leaveId}' }, expect: [200, 400], note: 'only pending leaves cancel' },
  ],

  regularizations: [
    { op: 'GET /regularizations', as: 'manager', expect: 200 },
    { op: 'GET /regularizations', as: 'employee', expect: 403 },
    { op: 'GET /regularizations/employee/{employeeId}', as: 'employee', params: { employeeId: '{employeeId}' }, expect: 200 },
    { op: 'POST /regularizations', as: 'employee', body: (c) => ({ employeeId: c.managerEmployeeId, date: '2026-11-02', reason: 'x' }), expect: 403 },
    { op: 'POST /regularizations', as: 'employee', body: (c) => ({ employeeId: c.employeeId, date: '2026-11-02', requestedCheckIn: '2026-11-02T09:00:00.000Z', requestedCheckOut: '2026-11-02T18:00:00.000Z', reason: 'harness correction' }), expect: 201, capture: 'regId' },
    { op: 'PATCH /regularizations/{id}/approve', as: 'manager', params: { id: '{regId}' }, expect: 200 },
    { op: 'PATCH /regularizations/{id}/reject', as: 'manager', params: { id: '{regId}' }, body: () => ({ reason: 'harness' }), expect: 200 },
  ],

  payroll: [
    { op: 'GET /payroll', as: 'hr', expect: 200 },
    { op: 'GET /payroll', as: 'employee', expect: 403, note: 'salary data is HR/Admin' },
    { op: 'GET /payroll', as: 'manager', expect: 403, note: 'managers deliberately excluded' },
    { op: 'GET /payroll/employee/{employeeId}', as: 'employee', params: { employeeId: '{employeeId}' }, expect: 200 },
    { op: 'GET /payroll/employee/{employeeId}', as: 'employee', params: { employeeId: '{managerEmployeeId}' }, expect: 403 },
    { op: 'POST /payroll/generate', as: 'employee', body: (c) => ({ employeeId: c.employeeId, month: 12, year: 2026, basicSalary: 99999 }), expect: 403 },
    { op: 'POST /payroll/generate', as: 'hr', body: (c) => ({ employeeId: c.employeeId, month: 11, year: 2026, basicSalary: 42000 }), expect: 409, note: 'duplicate period rejected cleanly, not as a 500' },
    { op: 'POST /payroll/generate', as: 'hr', body: (c) => ({ employeeId: c.employeeId, month: 12, year: 2026, basicSalary: 'abc' }), expect: 400, note: 'non-numeric salary rejected' },
    { op: 'PATCH /payroll/{id}/pay', as: 'hr', params: { id: '{payrollId}' }, expect: 200 },
  ],

  tickets: [
    { op: 'POST /tickets', as: 'employee', body: () => ({ subject: 'harness direct ticket', dept: 'IT', category: 'Hardware', subCategory: 'Laptop Issue', priority: 'Low', description: 'x' }), expect: 201 },
    { op: 'GET /tickets', as: 'manager', expect: 200 },
    { op: 'GET /tickets', as: 'employee', expect: 403 },
    { op: 'GET /tickets/mine', as: 'employee', expect: 200 },
    { op: 'PATCH /tickets/{id}/approve', as: 'manager', params: { id: '{ticketId}' }, expect: 200 },
    { op: 'PATCH /tickets/{id}/reject', as: 'manager', params: { id: '{ticketId}' }, expect: 200 },
    { op: 'PATCH /tickets/{id}/status', as: 'employee', params: { id: '{ticketId}' }, body: () => ({ status: 'Closed' }), expect: 403 },
    { op: 'PATCH /tickets/{id}/status', as: 'manager', params: { id: '{ticketId}' }, body: () => ({ status: 'Resolved' }), expect: 200 },
    { op: 'PATCH /tickets/{id}/status', as: 'manager', params: { id: '{ticketId}' }, body: () => ({ status: 'NotAStatus' }), expect: 400 },
    { op: 'PATCH /tickets/{id}/cancel', as: 'employee', params: { id: '{ticketId}' }, expect: 200, note: 'raiser may cancel' },
  ],

  assets: [
    { op: 'GET /assets', as: 'hr', expect: 200 },
    { op: 'GET /assets', as: 'employee', expect: 403 },
    { op: 'GET /assets/employee/{employeeId}', as: 'employee', params: { employeeId: '{employeeId}' }, expect: 200 },
    { op: 'POST /assets', as: 'employee', body: (c) => ({ assetTag: 'X', name: 'Y', category: 'Laptop', employeeId: c.employeeId }), expect: 403 },
    { op: 'POST /assets', as: 'hr', body: (c) => ({ assetTag: `BAD-${Date.now()}`, name: 'Z', category: 'Spaceship', employeeId: c.employeeId }), expect: 400, note: 'bad category rejected' },
    { op: 'PATCH /assets/{id}/return', as: 'hr', params: { id: '{assetId}' }, expect: 200 },
  ],

  documents: [
    { op: 'GET /documents/employee/{employeeId}', as: 'employee', params: { employeeId: '{employeeId}' }, expect: 200 },
    { op: 'GET /documents/employee/{employeeId}', as: 'employee', params: { employeeId: '{managerEmployeeId}' }, expect: 403 },
    { op: 'POST /documents', as: 'employee', body: (c) => ({ employeeId: c.employeeId, name: 'x', url: 'http://x/y' }), expect: 403 },
  ],

  requests: [
    { op: 'GET /requests', as: 'hr', expect: 200 },
    { op: 'GET /requests', as: 'employee', expect: 403 },
    { op: 'GET /requests/mine', as: 'employee', expect: 200 },
    { op: 'POST /requests', as: 'employee', body: () => ({ kind: 'document', title: 'harness', status: 'issued' }), expect: 400, note: 'caller cannot preset status' },
    { op: 'PATCH /requests/{id}/issue', as: 'hr', params: { id: '{requestId}' }, expect: 200 },
    { op: 'PATCH /requests/{id}/reject', as: 'hr', params: { id: '{requestId}' }, expect: 200 },
  ],

  onboarding: [
    { op: 'GET /onboarding', as: 'hr', expect: 200 },
    { op: 'GET /onboarding', as: 'employee', expect: 403 },
    { op: 'POST /onboarding/invite', as: 'hr', body: () => ({ personalEmail: `cand.${Date.now()}@example.com`, firstName: 'Cand', lastName: 'Idate' }), expect: 201, capture: 'inviteEmail', captureFrom: (b) => b?.personalEmail },
    { op: 'POST /onboarding/invite', as: 'employee', body: () => ({ personalEmail: `x.${Date.now()}@example.com` }), expect: 403 },
    { op: 'POST /onboarding/verify', as: null, body: () => ({ personalEmail: 'nobody@example.com', code: '000000' }), expect: 400 },
    { op: 'POST /onboarding/complete', as: null, body: () => ({ personalEmail: 'nobody@example.com', code: '000000', password: 'Password123', firstName: 'A', lastName: 'B' }), expect: 400 },
  ],

  holidays_announcements: [
    { op: 'GET /holidays', as: 'employee', expect: 200 },
    { op: 'POST /holidays', as: 'employee', body: () => ({ date: '2026-12-31', name: 'Nope' }), expect: 403 },
    { op: 'POST /holidays', as: 'hr', body: () => ({ date: '2026-12-30', name: 'Harness Holiday', type: 'company' }), expect: 201, capture: 'holidayId' },
    { op: 'DELETE /holidays/{id}', as: 'hr', params: { id: '{holidayId}' }, expect: 200 },
    { op: 'GET /announcements', as: 'employee', expect: 200 },
    { op: 'POST /announcements', as: 'employee', body: () => ({ title: 'Nope', body: 'Nope' }), expect: 403 },
    { op: 'POST /announcements', as: 'hr', body: () => ({ title: 'Harness announcement', body: 'from the api-test harness', category: 'general' }), expect: 201, capture: 'announcementId' },
    { op: 'DELETE /announcements/{id}', as: 'hr', params: { id: '{announcementId}' }, expect: 200 },
  ],

  notifications: [
    { op: 'GET /notifications', as: 'employee', expect: 200, capture: 'notificationId', captureFrom: (b) => b?.[0]?.id },
    { op: 'GET /notifications/unread-count', as: 'employee', expect: 200 },
    { op: 'PATCH /notifications/read-all', as: 'employee', expect: 200 },
    { op: 'POST /notifications/send', as: 'employee', body: () => ({ token: 'x', title: 'x', body: 'x' }), expect: 403, note: 'raw push is Admin-only' },
    { op: 'PATCH /notifications/fcm-token', as: 'employee', body: () => ({ token: 'harness-fcm-token' }), expect: [200, 201] },
    { op: 'PATCH /notifications/{id}/read', as: 'employee', params: { id: '{notificationId}' }, expect: 200 },
  ],

  analytics_audit: [
    { op: 'GET /analytics/summary', as: 'manager', expect: 200 },
    { op: 'GET /analytics/summary', as: 'employee', expect: 403 },
    { op: 'GET /analytics/directory', as: 'hr', expect: 200 },
    { op: 'GET /analytics/directory', as: 'employee', expect: 403 },
    { op: 'GET /audit', as: 'admin', expect: 200 },
    { op: 'GET /audit', as: 'hr', expect: 403, note: 'activity log is Admin-only' },
    { op: 'GET /audit/stats', as: 'admin', expect: 200 },
    { op: 'GET /audit/{entityType}/{entityId}', as: 'admin', params: { entityType: 'user', entityId: '{userId}' }, expect: 200 },
  ],

  projects: [
    { op: 'GET /projects', as: 'employee', expect: 200 },
    { op: 'GET /projects/{id}', as: 'employee', params: { id: '{projectId}' }, expect: 200 },
    { op: 'POST /projects', as: 'employee', body: () => ({ name: 'Nope' }), expect: 403 },
    { op: 'POST /projects', as: 'manager', body: () => ({ name: `Harness Project ${Date.now()}` }), expect: 201, capture: 'tempProjectId' },
    { op: 'PATCH /projects/{id}', as: 'manager', params: { id: '{tempProjectId}' }, body: () => ({ description: 'updated by harness' }), expect: 200 },
    { op: 'GET /projects/{id}/activity', as: 'manager', params: { id: '{projectId}' }, expect: 200 },
    { op: 'GET /projects/{id}/report', as: 'manager', params: { id: '{projectId}' }, expect: 200 },
    { op: 'GET /projects/{id}/report/members', as: 'manager', params: { id: '{projectId}' }, expect: 200 },
    { op: 'GET /projects/{id}/report/members/{employeeId}', as: 'manager', params: { id: '{projectId}', employeeId: '{employeeId}' }, expect: 200 },
    { op: 'GET /projects/{id}/teams', as: 'employee', params: { id: '{projectId}' }, expect: 200 },
    { op: 'POST /projects/{id}/teams', as: 'manager', params: { id: '{tempProjectId}' }, body: () => ({ name: 'Harness Squad', managerName: 'Arjun Menon' }), expect: 201, capture: 'tempTeamId' },
    { op: 'GET /projects/teams/{teamId}', as: 'employee', params: { teamId: '{teamId}' }, expect: 200 },
    { op: 'GET /projects/teams/{teamId}/my-access', as: 'employee', params: { teamId: '{teamId}' }, expect: 200 },
    { op: 'POST /projects/teams/{teamId}/members', as: 'manager', params: { teamId: '{tempTeamId}' }, body: (c) => ({ employeeId: c.employeeId, name: 'Rahul Verma', role: 'Developer', accessLevel: 'contribute' }), expect: 201, capture: 'tempMemberId' },
    { op: 'POST /projects/teams/{teamId}/members/batch', as: 'manager', params: { teamId: '{tempTeamId}' }, body: (c) => ({ members: [{ employeeId: c.managerEmployeeId, name: 'Arjun Menon', role: 'Tech Lead' }] }), expect: 201 },
    { op: 'PATCH /projects/teams/members/{memberId}', as: 'manager', params: { memberId: '{tempMemberId}' }, body: () => ({ accessLevel: 'read' }), expect: 200 },
    { op: 'DELETE /projects/teams/members/{memberId}', as: 'manager', params: { memberId: '{tempMemberId}' }, expect: 200 },
    { op: 'DELETE /projects/teams/{teamId}', as: 'manager', params: { teamId: '{tempTeamId}' }, expect: 200 },
    { op: 'GET /projects/{id}/sprints', as: 'employee', params: { id: '{projectId}' }, expect: 200 },
    { op: 'POST /projects/{id}/sprints', as: 'manager', params: { id: '{tempProjectId}' }, body: () => ({ name: 'Harness Sprint', startDate: '2026-11-01', endDate: '2026-11-14' }), expect: 201, capture: 'tempSprintId' },
    { op: 'DELETE /projects/{id}', as: 'manager', params: { id: '{tempProjectId}' }, expect: 200, note: 'cleans up the harness project' },
  ],

  sprints: [
    { op: 'GET /sprints/{id}/burndown', as: 'employee', params: { id: '{sprintId}' }, expect: 200 },
    { op: 'GET /sprints/{id}/burndown/teams', as: 'manager', params: { id: '{sprintId}' }, expect: 200 },
    { op: 'PATCH /sprints/{id}', as: 'employee', params: { id: '{sprintId}' }, body: () => ({ goal: 'nope' }), expect: 403 },
  ],

  workItems: [
    { op: 'POST /work-items', as: 'employee', body: (c) => ({ projectId: c.projectId, type: 'bug', title: 'harness bug raised by employee', priority: 3 }), expect: 201, capture: 'empWorkItemId',
      note: 'employees MAY create their own work items' },
    { op: 'GET /work-items', as: 'employee', expect: 200 },
    { op: 'GET /work-items/tree', as: 'employee', query: { projectId: '{projectId}' }, expect: 200 },
    { op: 'GET /work-items/mine', as: 'employee', expect: 200 },
    { op: 'GET /work-items/{id}', as: 'employee', params: { id: '{workItemId}' }, expect: 200 },
    { op: 'GET /work-items/{id}/history', as: 'employee', params: { id: '{workItemId}' }, expect: 200 },
    { op: 'GET /work-items/{id}/logs', as: 'employee', params: { id: '{workItemId}' }, expect: 200 },
    { op: 'PATCH /work-items/{id}', as: 'employee', params: { id: '{workItemId}' }, body: () => ({ description: 'updated by harness' }), expect: 200, note: 'employees may edit' },
    { op: 'PATCH /work-items/{id}/state', as: 'employee', params: { id: '{workItemId}' }, body: () => ({ state: 'active' }), expect: 200 },
    { op: 'POST /work-items/{id}/logs', as: 'employee', params: { id: '{workItemId}' }, body: () => ({ hours: 1.5, note: 'harness' }), expect: 201 },
    { op: 'DELETE /work-items/{id}', as: 'employee', params: { id: '{workItemId}' }, expect: 403, note: 'employees may never delete' },
  ],

  calendar: [
    { op: 'GET /calendar/events', as: 'employee', query: { start: '2026-11-01', end: '2026-11-30' }, expect: 200 },
    { op: 'GET /calendar/upcoming', as: 'employee', expect: 200 },
    { op: 'GET /calendar/employees/search', as: 'manager', query: { q: 'Rahul' }, expect: 200 },
    { op: 'GET /calendar/events/{id}', as: 'employee', params: { id: '{eventId}' }, expect: 200 },
    { op: 'PUT /calendar/events/{id}', as: 'manager', params: { id: '{eventId}' }, body: () => ({ title: 'api-test harness meeting (edited)' }), expect: 200 },
    { op: 'PUT /calendar/events/{id}/rsvp', as: 'employee', params: { id: '{eventId}' }, body: () => ({ status: 'Accepted' }), expect: 200 },
    { op: 'POST /calendar/events', as: 'manager', body: (c) => ({ title: 'Missing link', startDateTime: '2026-11-06T10:00:00.000Z', endDateTime: '2026-11-06T11:00:00.000Z', meetingMode: 'Online', participantIds: [c.employeeId] }), expect: 400, note: 'online meeting needs a link' },
  ],

  health: [
    { op: 'GET /health', as: null, expect: 200 },
    { op: 'GET /', as: null, expect: [200, 404] },
  ],
};

/**
 * Endpoints intentionally NOT exercised, with the reason. Listed so the
 * coverage report can distinguish "deliberately skipped" from "forgotten".
 */
export const SKIP = {
  'POST /documents/upload': 'multipart upload — needs a real file and Supabase Storage reachable',
  'DELETE /documents/{id}': 'would delete a real seeded HR document',
  'DELETE /calendar/events/{id}': 'covered by harness cleanup instead',
  'DELETE /sprints/{id}': 'would remove a seeded sprint the reports rely on',
  'POST /employees': 'creating employees without a user account leaves orphan rows',
  'PATCH /notifications/{id}/read': 'depends on a notification existing for this user',
};
