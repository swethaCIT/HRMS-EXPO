/**
 * Database seed — creates the schema (via synchronize) and inserts working logins
 * for all four roles plus realistic sample data, against DATABASE_URL (Supabase).
 *
 * Run with:  npm run seed --workspace=apps/backend
 * Idempotent: re-running will not duplicate users (keyed by email).
 *
 * Logins (all share the same password):
 *   admin@hrms.com / Admin@123      → Admin
 *   hr@hrms.com / Admin@123         → HR
 *   manager@hrms.com / Admin@123    → Manager
 *   employee@hrms.com / Admin@123   → Employee
 */
import 'reflect-metadata';
import * as dotenv from 'dotenv';
import * as bcrypt from 'bcrypt';
import { DataSource } from 'typeorm';

import { User, UserRole } from './users/entities/user.entity';
import { Employee, EmploymentType, EmploymentStatus } from './employees/entities/employee.entity';
import { Attendance, AttendanceStatus } from './attendance/entities/attendance.entity';
import { Leave, LeaveType, LeaveStatus } from './leaves/entities/leave.entity';
import { Payroll, PayrollStatus } from './payroll/entities/payroll.entity';
import { Notification, NotificationType } from './notifications/entities/notification.entity';
import { Ticket } from './tickets/entities/ticket.entity';
import { Asset } from './assets/entities/asset.entity';
import { Request } from './requests/entities/request.entity';
import { Holiday } from './holidays/entities/holiday.entity';
import { Announcement } from './announcements/entities/announcement.entity';
import { Project, ProjectStatus } from './projects/entities/project.entity';
import { ProjectTeam, ProjectTeamMember } from './projects/entities/project-team.entity';
import { Sprint, SprintStatus } from './projects/entities/sprint.entity';
import { WorkItem, WorkItemState, WorkItemType } from './projects/entities/work-item.entity';
import { WorkLog } from './projects/entities/work-log.entity';

dotenv.config();

const PASSWORD = 'Admin@123';

interface SeedPerson {
  email: string;
  role: UserRole;
  employeeId: string;
  firstName: string;
  lastName: string;
  department: string;
  designation: string;
  notifications: { title: string; body: string; type: NotificationType }[];
}

const PEOPLE: SeedPerson[] = [
  {
    email: 'admin@hrms.com', role: UserRole.ADMIN, employeeId: 'EMP001',
    firstName: 'Admin', lastName: 'User', department: 'IT', designation: 'System Administrator',
    notifications: [
      { title: 'New user awaiting approval', body: 'joseph.p@hrms.com signed up and needs a role.', type: NotificationType.SYSTEM },
      { title: 'Backup completed', body: 'Nightly database backup finished successfully.', type: NotificationType.SYSTEM },
      { title: 'Security review due', body: 'Quarterly access review is due this week.', type: NotificationType.INFO },
    ],
  },
  {
    email: 'hr@hrms.com', role: UserRole.HR, employeeId: 'EMP002',
    firstName: 'Meera', lastName: 'Iyer', department: 'People', designation: 'HR Manager',
    notifications: [
      { title: 'New document request', body: 'Rahul Verma requested an Experience Letter.', type: NotificationType.APPROVAL },
      { title: 'Onboarding pending', body: 'Joseph Paul — Day-1 documents to verify.', type: NotificationType.INFO },
      { title: 'Birthday today 🎂', body: 'Sneha Thomas has a birthday today.', type: NotificationType.INFO },
    ],
  },
  {
    email: 'manager@hrms.com', role: UserRole.MANAGER, employeeId: 'EMP003',
    firstName: 'Arjun', lastName: 'Menon', department: 'Engineering', designation: 'Engineering Manager',
    notifications: [
      { title: 'Leave request', body: 'Arjun Mehta requested 3 days annual leave.', type: NotificationType.LEAVE },
      { title: 'Timesheet regularization', body: 'Rahul Verma submitted a missed punch-out.', type: NotificationType.APPROVAL },
      { title: 'Team attendance', body: 'Your team is at 96% attendance this week.', type: NotificationType.INFO },
    ],
  },
  {
    email: 'employee@hrms.com', role: UserRole.EMPLOYEE, employeeId: 'EMP004',
    firstName: 'Rahul', lastName: 'Verma', department: 'Engineering', designation: 'Software Engineer',
    notifications: [
      { title: 'Leave approved ✅', body: 'Your annual leave (10–12 Jul) was approved.', type: NotificationType.LEAVE },
      { title: 'Payslip available', body: 'Your June 2026 payslip is ready to view.', type: NotificationType.PAYROLL },
      { title: 'Ticket update', body: 'TKT-1043 is now In Progress with IT Helpdesk.', type: NotificationType.TICKET },
    ],
  },
];

async function main() {
  // Mirrors config/database.config.ts: DATABASE_URL (hosted, e.g. Supabase) if
  // set, otherwise fall back to the local Docker Postgres discrete DB_* vars.
  const url = process.env.DATABASE_URL;
  const entities = [
    User, Employee, Attendance, Leave, Payroll, Notification, Ticket, Asset, Request, Holiday, Announcement,
    Project, ProjectTeam, ProjectTeamMember, Sprint, WorkItem, WorkLog,
  ];

  const ds = url
    ? new DataSource({
        type: 'postgres',
        url,
        ssl: { rejectUnauthorized: false },
        entities,
        synchronize: true,
      })
    : new DataSource({
        type: 'postgres',
        host: process.env.DB_HOST || 'localhost',
        port: Number(process.env.DB_PORT) || 5432,
        username: process.env.DB_USERNAME || 'hrms_user',
        password: process.env.DB_PASSWORD || 'hrms_password',
        database: process.env.DB_NAME || 'hrms_db',
        entities,
        synchronize: true,
      });

  await ds.initialize();
  console.log('✅ Connected + schema synced (incl. tickets, assets, requests)');

  const userRepo = ds.getRepository(User);
  const employeeRepo = ds.getRepository(Employee);
  const attendanceRepo = ds.getRepository(Attendance);
  const leaveRepo = ds.getRepository(Leave);
  const payrollRepo = ds.getRepository(Payroll);
  const notificationRepo = ds.getRepository(Notification);
  const ticketRepo = ds.getRepository(Ticket);
  const assetRepo = ds.getRepository(Asset);
  const requestRepo = ds.getRepository(Request);
  const holidayRepo = ds.getRepository(Holiday);
  const announcementRepo = ds.getRepository(Announcement);

  const hashed = await bcrypt.hash(PASSWORD, 10);

  for (const p of PEOPLE) {
    let user = await userRepo.findOne({ where: { email: p.email } });
    if (!user) {
      user = await userRepo.save(userRepo.create({ email: p.email, password: hashed, role: p.role, isActive: true }));
      console.log(`✅ user ${p.email} (${p.role})`);
    } else {
      // Keep role in sync and guarantee these demo logins are always usable —
      // a disabled seed account would otherwise silently lock the demo out.
      let dirty = false;
      if (user.role !== p.role) { user.role = p.role; dirty = true; }
      if (!user.isActive) { user.isActive = true; dirty = true; }
      if (dirty) await userRepo.save(user);
      console.log(`ℹ️  user ${p.email} exists${dirty ? ' (re-synced role/active)' : ''}`);
    }

    let emp = await employeeRepo.findOne({ where: { employeeId: p.employeeId } });
    if (!emp) {
      emp = await employeeRepo.save(employeeRepo.create({
        user,
        employeeId: p.employeeId,
        firstName: p.firstName,
        lastName: p.lastName,
        phone: '+91 90000 0000' + p.employeeId.slice(-1),
        department: p.department,
        designation: p.designation,
        dateOfJoining: new Date('2024-01-15'),
        employmentType: EmploymentType.FULL_TIME,
        status: EmploymentStatus.ACTIVE,
      }));

      // attendance today
      await attendanceRepo.save(attendanceRepo.create({
        employee: emp, date: new Date(), checkIn: new Date(), status: AttendanceStatus.PRESENT,
      }));

      // a leave (pending for non-admins so the manager has something to approve)
      await leaveRepo.save(leaveRepo.create({
        employee: emp,
        type: LeaveType.ANNUAL,
        startDate: new Date('2026-07-10'),
        endDate: new Date('2026-07-12'),
        totalDays: 3,
        reason: 'Personal',
        status: p.role === UserRole.EMPLOYEE ? LeaveStatus.PENDING : LeaveStatus.APPROVED,
      }));

      // payroll for June 2026
      await payrollRepo.save(payrollRepo.create({
        employee: emp, month: 6, year: 2026,
        basicSalary: 60000, allowances: 15000, deductions: 5000, tax: 8000, netSalary: 62000,
        status: PayrollStatus.PAID, paymentDate: new Date('2026-06-30'),
      }));

      console.log(`   ↳ employee ${p.employeeId} + attendance/leave/payroll`);
    }

    // enterprise HR fields (idempotent — fills once)
    if (emp && !emp.grade) {
      Object.assign(emp, {
        grade: p.role === UserRole.MANAGER ? 'L5 · Lead' : p.role === UserRole.HR ? 'L4 · Manager' : 'L3 · Senior',
        workLocation: 'Bengaluru, IN',
        workMode: 'Hybrid',
        reportingManager: p.role === UserRole.EMPLOYEE ? 'Arjun Menon' : 'Divya Nair (VP)',
        gender: 'Not disclosed',
        bloodGroup: 'O+',
        maritalStatus: 'Single',
        nationality: 'Indian',
        dateOfBirth: new Date('1996-05-14'),
        personalEmail: p.email.replace('@hrms.com', '@gmail.com'),
        address: '12 MG Road, Bengaluru, Karnataka 560001',
        emergencyContactName: 'Priya Verma',
        emergencyContactPhone: '+91 90000 11111',
        pan: 'ABCDE1234F',
        uan: '1001234567' + p.employeeId.slice(-2),
        bankName: 'HDFC Bank',
        bankLast4: '48' + p.employeeId.slice(-2),
      });
      await employeeRepo.save(emp);
      console.log(`   ↳ enterprise fields for ${p.employeeId}`);
    }

    // assets (idempotent — also seeds for pre-existing employees)
    if (emp && (await assetRepo.count({ where: { employeeId: emp.id } })) === 0) {
      const tag = p.employeeId.slice(-2);
      await assetRepo.save([
        assetRepo.create({ employeeId: emp.id, assetTag: `LAP-20${tag}`, name: 'MacBook Pro 14"', category: 'Laptop', serialNumber: `C02${p.employeeId}X`, condition: 'Good', status: 'assigned', assignedDate: new Date('2024-01-16') }),
        assetRepo.create({ employeeId: emp.id, assetTag: `MON-30${tag}`, name: 'Dell 27" Monitor', category: 'Monitor', serialNumber: `DM${p.employeeId}`, condition: 'Good', status: 'assigned', assignedDate: new Date('2024-01-16') }),
        assetRepo.create({ employeeId: emp.id, assetTag: `PHN-10${tag}`, name: 'iPhone 14', category: 'Phone', serialNumber: `IP${p.employeeId}`, condition: 'Fair', status: 'assigned', assignedDate: new Date('2024-02-01') }),
      ]);
      console.log(`   ↳ 3 assets for ${p.employeeId}`);
    }

    // notifications (only seed if this user has none yet)
    const existingNotifs = await notificationRepo.count({ where: { userId: user.id } });
    if (existingNotifs === 0) {
      for (const n of p.notifications) {
        await notificationRepo.save(notificationRepo.create({ userId: user.id, title: n.title, body: n.body, type: n.type }));
      }
      console.log(`   ↳ ${p.notifications.length} notifications`);
    }

    // a couple of tickets for the employee user
    if (p.role === UserRole.EMPLOYEE) {
      const existingTickets = await ticketRepo.count({ where: { createdById: user.id } });
      if (existingTickets === 0) {
        await ticketRepo.save(ticketRepo.create({
          ticketId: 'TKT-1043', subject: 'Laptop not powering on after update',
          dept: 'IT', category: 'Hardware', subCategory: 'Laptop Issue',
          priority: 'High', status: 'In Progress', approval: 'Approved',
          description: 'Laptop does not power on after the latest Windows update.',
          agent: 'IT Helpdesk', createdById: user.id,
        }));
        await ticketRepo.save(ticketRepo.create({
          ticketId: 'TKT-1039', subject: 'Form 16 for FY 2025-26 not available',
          dept: 'HR', category: 'Payroll & Benefits', subCategory: 'Form 16',
          priority: 'Medium', status: 'Open', approval: 'Pending',
          description: 'Form 16 is not showing up in the payroll portal.',
          createdById: user.id,
        }));
        console.log('   ↳ 2 tickets');
      }
    }
  }

  // HR document/profile/onboarding requests (created by the employee user)
  const empUser = await userRepo.findOne({ where: { email: 'employee@hrms.com' } });
  if (empUser && (await requestRepo.count()) === 0) {
    await requestRepo.save([
      requestRepo.create({
        kind: 'document', title: 'Experience Letter', subtitle: 'For home loan application', meta: 'EXP',
        employeeName: 'Rahul Verma', employeeId: 'EMP004', department: 'Engineering',
        reason: 'Bank requires an experience letter for loan processing.',
        detail: [{ k: 'Document', v: 'Experience Letter' }, { k: 'Purpose', v: 'Home loan' }, { k: 'Tenure', v: '2 yr 3 mo' }],
        status: 'pending', createdById: empUser.id,
      }),
      requestRepo.create({
        kind: 'profile', title: 'Bank Account Update', subtitle: 'New salary account', meta: 'BANK',
        employeeName: 'Rahul Verma', employeeId: 'EMP004', department: 'Engineering',
        reason: 'Switched banks, please update for next payroll run.',
        detail: [{ k: 'Field', v: 'Bank account' }, { k: 'New bank', v: 'HDFC ••• 4821' }],
        status: 'pending', createdById: empUser.id,
      }),
      requestRepo.create({
        kind: 'onboarding', title: 'Day-1 Onboarding', subtitle: 'Pending document verification', meta: 'NEW',
        employeeName: 'Joseph Paul', employeeId: 'EMP012', department: 'People',
        reason: 'New joiner — verify ID proofs and issue assets.',
        detail: [{ k: 'Stage', v: 'Document verification' }, { k: 'Joined', v: '26 Jun 2026' }],
        status: 'pending', createdById: empUser.id,
      }),
    ]);
    console.log('✅ 3 HR requests');
  }

  // Company holidays for 2026 (idempotent — only when the table is empty)
  if ((await holidayRepo.count()) === 0) {
    await holidayRepo.save([
      holidayRepo.create({ date: new Date('2026-01-01'), name: "New Year's Day", type: 'public' }),
      holidayRepo.create({ date: new Date('2026-01-26'), name: 'Republic Day', type: 'public' }),
      holidayRepo.create({ date: new Date('2026-04-03'), name: 'Good Friday', type: 'public' }),
      holidayRepo.create({ date: new Date('2026-05-01'), name: 'Labour Day', type: 'public' }),
      holidayRepo.create({ date: new Date('2026-08-15'), name: 'Independence Day', type: 'public' }),
      holidayRepo.create({ date: new Date('2026-10-02'), name: 'Gandhi Jayanti', type: 'public' }),
      holidayRepo.create({ date: new Date('2026-11-08'), name: 'Diwali', type: 'public' }),
      holidayRepo.create({ date: new Date('2026-12-25'), name: 'Christmas', type: 'public' }),
    ]);
    console.log('✅ 8 holidays for 2026');
  }

  // Company-wide announcements (idempotent — only when the table is empty)
  const adminUser = await userRepo.findOne({ where: { email: 'admin@hrms.com' } });
  if (adminUser && (await announcementRepo.count()) === 0) {
    await announcementRepo.save([
      announcementRepo.create({
        title: 'Welcome to the new HRMS portal',
        body: 'We are excited to launch the new HRMS portal. Explore leaves, payslips, tickets and more from one place.',
        category: 'general', authorId: adminUser.id, authorName: 'Admin User', pinned: true,
      }),
      announcementRepo.create({
        title: 'Q3 town hall on Friday',
        body: 'Join the company-wide Q3 town hall this Friday at 4 PM. Leadership will share updates and take questions.',
        category: 'event', authorId: adminUser.id, authorName: 'Admin User',
      }),
      announcementRepo.create({
        title: 'Updated leave policy',
        body: 'The leave policy has been updated effective this quarter. Please review the changes in the policy section.',
        category: 'policy', authorId: adminUser.id, authorName: 'Admin User',
      }),
    ]);
    console.log('✅ 3 announcements');
  }

  /* ── Project boards ("Goals"): projects → teams → sprints → epic/feature/story/task ── */
  const projectRepo = ds.getRepository(Project);
  const projectTeamRepo = ds.getRepository(ProjectTeam);
  const projectMemberRepo = ds.getRepository(ProjectTeamMember);
  const sprintRepo = ds.getRepository(Sprint);
  const workItemRepo = ds.getRepository(WorkItem);
  const workLogRepo = ds.getRepository(WorkLog);

  if ((await projectRepo.count()) === 0) {
    const emps = await employeeRepo.find();
    const byCode = (code: string) => emps.find((e) => e.employeeId === code);
    const nameOf = (e?: Employee) => (e ? `${e.firstName} ${e.lastName}` : 'Unassigned');
    const admin = byCode('EMP001');
    const hr = byCode('EMP002');
    const mgr = byCode('EMP003');
    const dev = byCode('EMP004');

    const DAY = 86_400_000;
    const day = (offset: number) => new Date(Date.now() + offset * DAY);
    const managerUser = await userRepo.findOne({ where: { email: 'manager@hrms.com' } });

    /** One backlog node — mirrors the Azure hierarchy and its effort fields. */
    interface Node {
      type: WorkItemType;
      title: string;
      description?: string;
      state: WorkItemState;
      points?: number;
      estimate?: number;
      who?: Employee;
      /** Days from today the item was closed (negative = in the past). */
      closedOffset?: number;
      priority?: number;
      children?: Node[];
    }

    const atlasBacklog: Node[] = [
      {
        type: WorkItemType.EPIC, title: 'Unified payments experience', state: WorkItemState.ACTIVE, priority: 1,
        description: 'One checkout flow across web and mobile, with saved cards and instant refunds.',
        children: [
          {
            type: WorkItemType.FEATURE, title: 'Card checkout', state: WorkItemState.ACTIVE, priority: 1, who: mgr,
            children: [
              {
                type: WorkItemType.USER_STORY, title: 'As a customer I can save a card for later', state: WorkItemState.ACTIVE,
                points: 5, who: dev, priority: 1,
                children: [
                  { type: WorkItemType.TASK, title: 'Tokenise card on save', state: WorkItemState.CLOSED, estimate: 8, who: dev, closedOffset: -5 },
                  { type: WorkItemType.TASK, title: 'Card vault API endpoint', state: WorkItemState.ACTIVE, estimate: 10, who: dev },
                  { type: WorkItemType.TASK, title: 'Saved-cards UI on checkout', state: WorkItemState.NEW, estimate: 6, who: hr },
                ],
              },
              {
                type: WorkItemType.USER_STORY, title: 'As a customer I complete 3-D Secure step-up', state: WorkItemState.RESOLVED,
                points: 8, who: mgr, priority: 2,
                children: [
                  { type: WorkItemType.TASK, title: 'Integrate ACS redirect', state: WorkItemState.CLOSED, estimate: 12, who: mgr, closedOffset: -4 },
                  { type: WorkItemType.BUG, title: 'Step-up loops on Safari 17', state: WorkItemState.ACTIVE, estimate: 5, who: dev, priority: 1 },
                ],
              },
            ],
          },
          {
            type: WorkItemType.FEATURE, title: 'Instant refunds', state: WorkItemState.NEW, priority: 2, who: mgr,
            children: [
              {
                type: WorkItemType.USER_STORY, title: 'As an agent I can issue a partial refund', state: WorkItemState.NEW,
                points: 5, who: hr,
                children: [
                  { type: WorkItemType.TASK, title: 'Partial refund calculation', state: WorkItemState.NEW, estimate: 8, who: hr },
                  { type: WorkItemType.TASK, title: 'Refund audit trail', state: WorkItemState.NEW, estimate: 4, who: admin },
                ],
              },
            ],
          },
        ],
      },
      {
        type: WorkItemType.EPIC, title: 'Platform reliability', state: WorkItemState.ACTIVE, priority: 2,
        description: 'Get the payments API to 99.95% availability.',
        children: [
          {
            type: WorkItemType.FEATURE, title: 'Observability baseline', state: WorkItemState.ACTIVE, who: admin,
            children: [
              {
                type: WorkItemType.USER_STORY, title: 'As an on-call engineer I get paged on error spikes', state: WorkItemState.CLOSED,
                points: 3, who: admin, closedOffset: -3,
                children: [
                  { type: WorkItemType.TASK, title: 'Structured request logging', state: WorkItemState.CLOSED, estimate: 6, who: admin, closedOffset: -6 },
                  { type: WorkItemType.TASK, title: 'Alert rules + escalation policy', state: WorkItemState.CLOSED, estimate: 4, who: admin, closedOffset: -3 },
                ],
              },
            ],
          },
        ],
      },
    ];

    const mobileBacklog: Node[] = [
      {
        type: WorkItemType.EPIC, title: 'Employee mobile revamp', state: WorkItemState.ACTIVE, priority: 1,
        children: [
          {
            type: WorkItemType.FEATURE, title: 'New home dashboard', state: WorkItemState.ACTIVE, who: dev,
            children: [
              {
                type: WorkItemType.USER_STORY, title: 'As an employee I see my day at a glance', state: WorkItemState.ACTIVE,
                points: 8, who: dev,
                children: [
                  { type: WorkItemType.TASK, title: 'Attendance card redesign', state: WorkItemState.CLOSED, estimate: 10, who: dev, closedOffset: -2 },
                  { type: WorkItemType.TASK, title: 'Goals section on home', state: WorkItemState.ACTIVE, estimate: 12, who: dev },
                  { type: WorkItemType.BUG, title: 'Pull-to-refresh flickers on Android 14', state: WorkItemState.NEW, estimate: 3, who: hr, priority: 3 },
                ],
              },
            ],
          },
        ],
      },
    ];

    const projects: {
      name: string; key: string; description: string; color: string; status: ProjectStatus;
      teams: { name: string; manager?: Employee; description: string; members: { emp?: Employee; role: string }[]; backlog: Node[] }[];
    }[] = [
      {
        name: 'Atlas Payments Platform', key: 'ATLAS', color: '#4F46E5', status: ProjectStatus.ACTIVE,
        description: 'Next-generation payments platform — checkout, refunds and reconciliation.',
        teams: [
          {
            name: 'Payments Core', manager: mgr, description: 'Owns the payments API and the checkout flow.',
            members: [
              { emp: mgr, role: 'Tech Lead' },
              { emp: dev, role: 'Backend Engineer' },
              { emp: admin, role: 'DevOps Engineer' },
            ],
            backlog: atlasBacklog,
          },
          {
            name: 'Mobile Experience', manager: hr, description: 'Ships the employee and customer mobile apps.',
            members: [
              { emp: hr, role: 'Product Owner' },
              { emp: dev, role: 'Mobile Engineer' },
            ],
            backlog: mobileBacklog,
          },
        ],
      },
      {
        name: 'Insight Analytics', key: 'INSIG', color: '#0EA5E9', status: ProjectStatus.ACTIVE,
        description: 'Self-serve dashboards and exports for people analytics.',
        teams: [
          {
            name: 'Data Platform', manager: mgr, description: 'Warehouse, pipelines and the reporting API.',
            members: [
              { emp: mgr, role: 'Engineering Manager' },
              { emp: admin, role: 'Data Engineer' },
            ],
            backlog: [
              {
                type: WorkItemType.EPIC, title: 'Attrition insights', state: WorkItemState.ACTIVE, priority: 2,
                children: [
                  {
                    type: WorkItemType.FEATURE, title: 'Attrition trend report', state: WorkItemState.ACTIVE, who: admin,
                    children: [
                      {
                        type: WorkItemType.USER_STORY, title: 'As HR I see attrition by department', state: WorkItemState.ACTIVE,
                        points: 5, who: admin,
                        children: [
                          { type: WorkItemType.TASK, title: 'Headcount snapshot job', state: WorkItemState.CLOSED, estimate: 8, who: admin, closedOffset: -4 },
                          { type: WorkItemType.TASK, title: 'Trend endpoint + caching', state: WorkItemState.ACTIVE, estimate: 6, who: mgr },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ];

    for (const p of projects) {
      const project = await projectRepo.save(projectRepo.create({
        name: p.name, key: p.key, description: p.description, color: p.color, status: p.status,
        startDate: day(-45), targetDate: day(75),
        ownerId: managerUser?.id, ownerName: nameOf(mgr),
      }));

      // Three iterations: one finished, one running now, one queued up.
      const [prevSprint, curSprint, nextSprint] = await sprintRepo.save([
        sprintRepo.create({ projectId: project.id, name: `${p.key} Sprint 1`, goal: 'Foundations and plumbing', startDate: day(-28), endDate: day(-15), status: SprintStatus.COMPLETED }),
        sprintRepo.create({ projectId: project.id, name: `${p.key} Sprint 2`, goal: 'Ship the core flow end to end', startDate: day(-7), endDate: day(6), status: SprintStatus.CURRENT }),
        sprintRepo.create({ projectId: project.id, name: `${p.key} Sprint 3`, goal: 'Hardening and rollout', startDate: day(7), endDate: day(20), status: SprintStatus.FUTURE }),
      ]);

      let seq = 0;
      for (const t of p.teams) {
        const team = await projectTeamRepo.save(projectTeamRepo.create({
          projectId: project.id, name: t.name, description: t.description,
          managerEmployeeId: t.manager?.id, managerName: nameOf(t.manager),
        }));
        for (const m of t.members) {
          if (!m.emp) continue;
          await projectMemberRepo.save(projectMemberRepo.create({
            teamId: team.id, projectId: project.id, employeeId: m.emp.id, name: nameOf(m.emp), role: m.role, capacityHoursPerDay: 8,
          }));
        }

        // Walk the tree depth-first so parents always exist before their children.
        const createNode = async (node: Node, parentId?: string): Promise<void> => {
          const closed = node.state === WorkItemState.CLOSED;
          const started = closed || node.state === WorkItemState.ACTIVE || node.state === WorkItemState.RESOLVED;
          const closedAt = closed ? day(node.closedOffset ?? -1) : undefined;
          const estimate = node.estimate ?? 0;
          const item = await workItemRepo.save(workItemRepo.create({
            projectId: project.id,
            teamId: team.id,
            // Closed history lives in the finished sprint; everything else is in flight.
            sprintId: closed && (node.closedOffset ?? 0) <= -15 ? prevSprint.id : curSprint.id,
            parentId,
            seq: ++seq,
            type: node.type,
            title: node.title,
            description: node.description,
            state: node.state,
            priority: node.priority ?? 2,
            assigneeId: node.who?.id,
            assigneeName: node.who ? nameOf(node.who) : undefined,
            storyPoints: node.points ?? 0,
            originalEstimate: estimate,
            remainingWork: closed ? 0 : estimate,
            completedWork: closed ? estimate : node.state === WorkItemState.ACTIVE ? Math.round(estimate * 0.4) : 0,
            startDate: started ? day(-7) : undefined,
            targetDate: day(6),
            createdById: managerUser?.id,
            createdByName: nameOf(mgr),
            // Back-dated so the burndown has real history to draw from.
            activatedAt: started ? day(-6) : undefined,
            resolvedAt: closed || node.state === WorkItemState.RESOLVED ? closedAt ?? day(-2) : undefined,
            closedAt,
          }));

          // Time entries — these are what the individual reports total up.
          if (node.who && (closed || node.state === WorkItemState.ACTIVE) && estimate > 0) {
            const spread = closed ? [-6, -5, -4] : [-3, -2, -1];
            const per = Math.max(1, Math.round((closed ? estimate : estimate * 0.4) / spread.length));
            for (const offset of spread) {
              await workLogRepo.save(workLogRepo.create({
                workItemId: item.id, projectId: project.id,
                employeeId: node.who.id, employeeName: nameOf(node.who),
                hours: per, date: day(offset),
                note: closed ? 'Implementation + tests' : 'In progress',
              }));
            }
          }

          for (const child of node.children ?? []) await createNode(child, item.id);
        };

        for (const root of t.backlog) await createNode(root);
      }

      console.log(`✅ project ${p.key} — ${p.teams.length} team(s), 3 sprints, ${seq} work items (next: ${nextSprint.name})`);
    }
  } else {
    console.log('ℹ️  projects already seeded');
  }

  await ds.destroy();
  console.log('\n🎉 Seed complete. Logins (password: ' + PASSWORD + '):');
  PEOPLE.forEach((p) => console.log(`   ${p.email}  → ${p.role}`));
}

main().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
