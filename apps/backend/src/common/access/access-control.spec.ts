/**
 * Ownership rules for per-employee records. These encode the fix for the IDOR
 * class of bug: `@Roles()` alone cannot express "is this THEIR record?", so
 * every `:employeeId` route funnels through AccessControlService.
 */
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException } from '@nestjs/common';
import { Employee } from '../../employees/entities/employee.entity';
import { UserRole } from '../../users/entities/user.entity';
import { AccessControlService } from './access-control.service';

/** Employee rows keyed by the user id that owns them. */
const EMPLOYEES = [
  { id: 'emp-rahul', user: { id: 'user-rahul' } },
  { id: 'emp-priya', user: { id: 'user-priya' } },
];

async function build() {
  const repo = {
    findOne: jest.fn(async (opts: any) => {
      const wantedUserId = opts?.where?.user?.id;
      return EMPLOYEES.find((e) => e.user.id === wantedUserId) ?? null;
    }),
  };
  const moduleRef = await Test.createTestingModule({
    providers: [AccessControlService, { provide: getRepositoryToken(Employee), useValue: repo }],
  }).compile();
  return moduleRef.get(AccessControlService);
}

const rahul = { id: 'user-rahul', role: UserRole.EMPLOYEE };
const priya = { id: 'user-priya', role: UserRole.EMPLOYEE };
const manager = { id: 'user-mgr', role: UserRole.MANAGER };
const hr = { id: 'user-hr', role: UserRole.HR };

describe('AccessControlService', () => {
  it('lets an employee reach their own record', async () => {
    const access = await build();
    await expect(access.assertSelfOr(rahul, 'emp-rahul')).resolves.toBeUndefined();
  });

  it("blocks an employee from another employee's record", async () => {
    const access = await build();
    // The exact IDOR: Rahul swaps Priya's employee id into the URL.
    await expect(access.assertSelfOr(rahul, 'emp-priya')).rejects.toThrow(ForbiddenException);
  });

  it('lets HR reach anyone (people-ops legitimately sees the org)', async () => {
    const access = await build();
    await expect(access.assertSelfOr(hr, 'emp-rahul')).resolves.toBeUndefined();
  });

  it('excludes managers from HR-only data such as payroll', async () => {
    const access = await build();
    // Default privilege set is HR/Admin — running a team does not imply seeing pay.
    await expect(access.assertSelfOr(manager, 'emp-rahul')).rejects.toThrow(ForbiddenException);
  });

  it('includes managers where their job requires it (leave, attendance)', async () => {
    const access = await build();
    await expect(
      access.assertSelfOr(manager, 'emp-rahul', AccessControlService.ORG_WIDE_WITH_MANAGERS),
    ).resolves.toBeUndefined();
  });

  it('denies a caller with no employee record and no privileged role', async () => {
    const access = await build();
    await expect(access.assertSelfOr({ id: 'ghost', role: UserRole.EMPLOYEE }, 'emp-rahul')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('denies an unauthenticated caller outright', async () => {
    const access = await build();
    await expect(access.assertSelfOr(undefined, 'emp-rahul')).rejects.toThrow(ForbiddenException);
  });

  it('names the record in the error so the client can show something useful', async () => {
    const access = await build();
    await expect(access.assertSelfOr(rahul, 'emp-priya', undefined, 'payslips')).rejects.toThrow(/own payslips/);
  });

  it('resolves the employee id behind a user, and null when there is none', async () => {
    const access = await build();
    expect(await access.employeeIdOf(priya)).toBe('emp-priya');
    expect(await access.employeeIdOf({ id: 'nobody' })).toBeNull();
  });
});
