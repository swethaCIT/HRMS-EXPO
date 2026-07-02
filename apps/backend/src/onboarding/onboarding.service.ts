import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { OnboardingInvite } from './entities/onboarding-invite.entity';
import { User, UserRole } from '../users/entities/user.entity';
import { Employee, EmploymentType, EmploymentStatus } from '../employees/entities/employee.entity';
import { MailService } from '../mail/mail.service';

@Injectable()
export class OnboardingService {
  private readonly logger = new Logger(OnboardingService.name);

  constructor(
    @InjectRepository(OnboardingInvite) private readonly inviteRepo: Repository<OnboardingInvite>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Employee) private readonly employeeRepo: Repository<Employee>,
    private readonly jwt: JwtService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  private otp() { return String(Math.floor(100000 + Math.random() * 900000)); }
  private isDev() { return this.config.get('NODE_ENV') !== 'production'; }

  /** HR sends an onboarding invite to a candidate's personal email. */
  async invite(dto: { personalEmail: string; firstName?: string; lastName?: string; department?: string; designation?: string }, hrId: string) {
    const existing = await this.userRepo.findOne({ where: { email: dto.personalEmail } });
    if (existing) throw new BadRequestException('A user with this email already exists');

    const code = this.otp();
    const invite = await this.inviteRepo.save(this.inviteRepo.create({
      tempEmployeeId: 'ONB-' + Math.floor(1000 + Math.random() * 9000),
      personalEmail: dto.personalEmail,
      tokenHash: await bcrypt.hash(code, 10),
      firstName: dto.firstName,
      lastName: dto.lastName,
      department: dto.department,
      designation: dto.designation,
      status: 'sent',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      createdById: hrId,
    }));

    await this.mail.send(
      dto.personalEmail,
      'Welcome to HRMS — complete your onboarding',
      `You've been invited to onboard.\n\nTemporary ID: ${invite.tempEmployeeId}\nYour one-time code: ${code}\n\nOpen the HRMS app → "Have an invite? Register", enter your email and this code, then complete your profile. The code expires in 7 days.`,
    );

    return {
      id: invite.id,
      tempEmployeeId: invite.tempEmployeeId,
      personalEmail: invite.personalEmail,
      status: invite.status,
      ...(this.isDev() ? { devCode: code } : {}),
    };
  }

  private async findValidInvite(personalEmail: string, code: string) {
    const invite = await this.inviteRepo.findOne({ where: { personalEmail, status: 'sent' } });
    if (!invite) throw new BadRequestException('No pending invite for this email');
    if (new Date(invite.expiresAt).getTime() < Date.now()) {
      invite.status = 'expired'; await this.inviteRepo.save(invite);
      throw new BadRequestException('Invite has expired');
    }
    if (!(await bcrypt.compare(code, invite.tokenHash))) throw new BadRequestException('Invalid code');
    return invite;
  }

  /** Candidate verifies their invite; returns pre-filled data for the form. */
  async verify(personalEmail: string, code: string) {
    const inv = await this.findValidInvite(personalEmail, code);
    return {
      valid: true,
      tempEmployeeId: inv.tempEmployeeId,
      personalEmail: inv.personalEmail,
      firstName: inv.firstName ?? '',
      lastName: inv.lastName ?? '',
      department: inv.department ?? '',
      designation: inv.designation ?? '',
    };
  }

  private async uniqueCompanyEmail(first: string, last: string): Promise<string> {
    const base = `${(first || 'user').toLowerCase()}.${(last || '').toLowerCase()}`.replace(/[^a-z.]/g, '') || 'user';
    let email = `${base}@hrms.com`;
    let n = 1;
    while (await this.userRepo.findOne({ where: { email } })) email = `${base}${n++}@hrms.com`;
    return email;
  }

  /** Candidate completes onboarding → provisions real account + employee record + auto-login token. */
  async complete(dto: {
    personalEmail: string; code: string; password: string;
    firstName: string; lastName: string; phone?: string; dateOfBirth?: string;
    address?: string; emergencyContactName?: string; emergencyContactPhone?: string;
  }) {
    const invite = await this.findValidInvite(dto.personalEmail, dto.code);
    if (!dto.password || dto.password.length < 8) throw new BadRequestException('Password must be at least 8 characters');

    const first = dto.firstName || invite.firstName || 'New';
    const last = dto.lastName || invite.lastName || 'Hire';
    const companyEmail = await this.uniqueCompanyEmail(first, last);

    // Create the real user account
    const user = await this.userRepo.save(this.userRepo.create({
      email: companyEmail,
      password: await bcrypt.hash(dto.password, 10),
      role: UserRole.EMPLOYEE,
      isActive: true,
    }));

    // Permanent employee id: EMP + zero-padded sequence
    const count = await this.employeeRepo.count();
    const employeeId = 'EMP' + String(count + 1).padStart(3, '0');

    const employee = await this.employeeRepo.save(this.employeeRepo.create({
      user,
      employeeId,
      firstName: first,
      lastName: last,
      phone: dto.phone,
      department: invite.department || 'General',
      designation: invite.designation || 'Associate',
      employmentType: EmploymentType.FULL_TIME,
      status: EmploymentStatus.ACTIVE,
      dateOfJoining: new Date(),
      dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
      personalEmail: dto.personalEmail,
      address: dto.address,
      emergencyContactName: dto.emergencyContactName,
      emergencyContactPhone: dto.emergencyContactPhone,
      workMode: 'Hybrid',
      nationality: 'Indian',
    }));

    invite.status = 'completed';
    invite.provisionedEmail = companyEmail;
    invite.provisionedEmployeeId = employeeId;
    await this.inviteRepo.save(invite);

    await this.mail.send(
      dto.personalEmail,
      'Your HRMS account is ready',
      `Welcome aboard, ${first}!\n\nYour company account is active:\n• Company email (username): ${companyEmail}\n• Employee ID: ${employeeId}\n\nYou can now sign in with the password you just set.`,
    );

    const access_token = this.jwt.sign({ sub: user.id, email: user.email });
    return {
      access_token,
      user: { id: user.id, email: user.email, role: user.role },
      employee: { id: employee.id, employeeId, firstName: first, lastName: last },
      provisionedEmail: companyEmail,
    };
  }

  /** HR: list all onboarding invites. */
  findAll(): Promise<OnboardingInvite[]> {
    return this.inviteRepo.find({ order: { createdAt: 'DESC' } });
  }
}
