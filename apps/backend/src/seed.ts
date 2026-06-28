/**
 * Database seed — creates the schema (via synchronize) and inserts a working
 * admin login plus a little sample data, against whatever DATABASE_URL points to
 * (Supabase Postgres in our case).
 *
 * Run with:  npm run seed --workspace=apps/backend
 * Idempotent: re-running will not duplicate the admin user.
 */
import 'reflect-metadata';
import * as dotenv from 'dotenv';
import * as bcrypt from 'bcrypt';
import { DataSource } from 'typeorm';

import { User, UserRole } from './users/entities/user.entity';
import {
  Employee,
  EmploymentType,
  EmploymentStatus,
} from './employees/entities/employee.entity';
import { Attendance, AttendanceStatus } from './attendance/entities/attendance.entity';
import { Leave, LeaveType, LeaveStatus } from './leaves/entities/leave.entity';
import { Payroll, PayrollStatus } from './payroll/entities/payroll.entity';

dotenv.config();

const ADMIN_EMAIL = 'admin@hrms.com';
const ADMIN_PASSWORD = 'Admin@123';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is not set in apps/backend/.env');
  }

  const ds = new DataSource({
    type: 'postgres',
    url,
    ssl: { rejectUnauthorized: false },
    entities: [User, Employee, Attendance, Leave, Payroll],
    synchronize: true, // creates all tables if they do not exist
  });

  await ds.initialize();
  console.log('✅ Connected to database and synced schema (users, employees, attendance, leaves, payrolls)');

  const userRepo = ds.getRepository(User);
  const employeeRepo = ds.getRepository(Employee);
  const attendanceRepo = ds.getRepository(Attendance);
  const leaveRepo = ds.getRepository(Leave);
  const payrollRepo = ds.getRepository(Payroll);

  // --- Admin user (idempotent) ---
  let admin = await userRepo.findOne({ where: { email: ADMIN_EMAIL } });
  if (!admin) {
    admin = await userRepo.save(
      userRepo.create({
        email: ADMIN_EMAIL,
        password: await bcrypt.hash(ADMIN_PASSWORD, 10),
        role: UserRole.ADMIN,
        isActive: true,
      }),
    );
    console.log(`✅ Created admin user: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
  } else {
    console.log(`ℹ️  Admin user already exists: ${ADMIN_EMAIL}`);
  }

  // --- Employee profile for the admin (idempotent) ---
  let employee = await employeeRepo.findOne({ where: { employeeId: 'EMP001' } });
  if (!employee) {
    employee = await employeeRepo.save(
      employeeRepo.create({
        user: admin,
        employeeId: 'EMP001',
        firstName: 'Admin',
        lastName: 'User',
        phone: '+91-9000000000',
        department: 'Engineering',
        designation: 'Software Engineer',
        dateOfJoining: new Date('2024-01-15'),
        employmentType: EmploymentType.FULL_TIME,
        status: EmploymentStatus.ACTIVE,
      }),
    );
    console.log('✅ Created employee profile EMP001');

    // --- Sample data tied to that employee ---
    await attendanceRepo.save(
      attendanceRepo.create({
        employee,
        date: new Date(),
        checkIn: new Date(),
        status: AttendanceStatus.PRESENT,
      }),
    );

    await leaveRepo.save(
      leaveRepo.create({
        employee,
        type: LeaveType.ANNUAL,
        startDate: new Date('2026-07-10'),
        endDate: new Date('2026-07-12'),
        totalDays: 3,
        reason: 'Family trip',
        status: LeaveStatus.PENDING,
      }),
    );

    await payrollRepo.save(
      payrollRepo.create({
        employee,
        month: 6,
        year: 2026,
        basicSalary: 60000,
        allowances: 15000,
        deductions: 5000,
        tax: 8000,
        netSalary: 62000,
        status: PayrollStatus.PAID,
        paymentDate: new Date('2026-06-30'),
      }),
    );
    console.log('✅ Inserted sample attendance, leave and payroll rows');
  } else {
    console.log('ℹ️  Employee EMP001 already exists — skipping sample data');
  }

  await ds.destroy();
  console.log('\n🎉 Seed complete. Log in from the app with:');
  console.log(`   email:    ${ADMIN_EMAIL}`);
  console.log(`   password: ${ADMIN_PASSWORD}`);
}

main().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
