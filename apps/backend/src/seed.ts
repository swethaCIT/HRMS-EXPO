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
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set in apps/backend/.env');

  const ds = new DataSource({
    type: 'postgres',
    url,
    ssl: { rejectUnauthorized: false },
    entities: [User, Employee, Attendance, Leave, Payroll, Notification, Ticket],
    synchronize: true,
  });

  await ds.initialize();
  console.log('✅ Connected + schema synced (users, employees, attendance, leaves, payrolls, notifications, tickets)');

  const userRepo = ds.getRepository(User);
  const employeeRepo = ds.getRepository(Employee);
  const attendanceRepo = ds.getRepository(Attendance);
  const leaveRepo = ds.getRepository(Leave);
  const payrollRepo = ds.getRepository(Payroll);
  const notificationRepo = ds.getRepository(Notification);
  const ticketRepo = ds.getRepository(Ticket);

  const hashed = await bcrypt.hash(PASSWORD, 10);

  for (const p of PEOPLE) {
    let user = await userRepo.findOne({ where: { email: p.email } });
    if (!user) {
      user = await userRepo.save(userRepo.create({ email: p.email, password: hashed, role: p.role, isActive: true }));
      console.log(`✅ user ${p.email} (${p.role})`);
    } else {
      // keep role in sync with the seed definition
      if (user.role !== p.role) { user.role = p.role; await userRepo.save(user); }
      console.log(`ℹ️  user ${p.email} exists`);
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

  await ds.destroy();
  console.log('\n🎉 Seed complete. Logins (password: ' + PASSWORD + '):');
  PEOPLE.forEach((p) => console.log(`   ${p.email}  → ${p.role}`));
}

main().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
