import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Employee } from '../../employees/entities/employee.entity';
import { UserRole } from '../../users/entities/user.entity';

export interface RequestUser {
  id: string;
  role?: UserRole | string;
}

/**
 * Ownership checks for per-employee records.
 *
 * `@Roles()` alone only answers "what kind of user is this?" — it cannot answer
 * "is this THEIR record?". Without that second question every `:employeeId`
 * route is an IDOR: any signed-in employee could read a colleague's payslip or
 * punch in on their behalf simply by changing the id in the URL. Every such
 * route funnels through here instead.
 */
@Injectable()
export class AccessControlService {
  constructor(
    @InjectRepository(Employee)
    private readonly employeeRepo: Repository<Employee>,
  ) {}

  /** People-ops roles that legitimately see the whole organisation. */
  static readonly ORG_WIDE: string[] = [UserRole.ADMIN, UserRole.HR];
  /** Adds managers, who need their team's leave/attendance to approve it. */
  static readonly ORG_WIDE_WITH_MANAGERS: string[] = [UserRole.ADMIN, UserRole.HR, UserRole.MANAGER];

  has(user: RequestUser | undefined, roles: string[]): boolean {
    return !!user?.role && roles.includes(user.role as string);
  }

  /** The employee record behind a signed-in user (null when they have none). */
  async employeeIdOf(user?: RequestUser): Promise<string | null> {
    if (!user?.id) return null;
    const emp = await this.employeeRepo.findOne({ where: { user: { id: user.id } }, select: { id: true } });
    return emp?.id ?? null;
  }

  async isSelf(user: RequestUser | undefined, employeeId: string): Promise<boolean> {
    if (!employeeId) return false;
    return (await this.employeeIdOf(user)) === employeeId;
  }

  /**
   * Allow when the caller owns the record, or holds one of `privilegedRoles`.
   * Throws 403 otherwise. Defaults to HR/Admin — pass
   * `ORG_WIDE_WITH_MANAGERS` for data a manager must see to do their job.
   */
  async assertSelfOr(
    user: RequestUser | undefined,
    employeeId: string,
    privilegedRoles: string[] = AccessControlService.ORG_WIDE,
    what = 'this record',
  ): Promise<void> {
    if (this.has(user, privilegedRoles)) return;
    if (await this.isSelf(user, employeeId)) return;
    throw new ForbiddenException(`You can only access your own ${what}.`);
  }
}
