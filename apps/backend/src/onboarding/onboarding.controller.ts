import { Controller, Get, Post, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { OnboardingService } from './onboarding.service';
import { CompleteOnboardingDto, InviteCandidateDto, VerifyInviteDto } from './dto/onboarding.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('onboarding')
@Controller('onboarding')
export class OnboardingController {
  constructor(private readonly onboarding: OnboardingService) {}

  /* ── HR/Admin: create + list invites ── */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.HR, UserRole.ADMIN)
  @ApiBearerAuth()
  @Post('invite')
  invite(@Body() dto: InviteCandidateDto, @CurrentUser('id') hrId: string) {
    return this.onboarding.invite(dto, hrId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.HR, UserRole.ADMIN)
  @ApiBearerAuth()
  @Get()
  list() {
    return this.onboarding.findAll();
  }

  /* ── Public: candidate self-registration ── */
  @Post('verify')
  @HttpCode(HttpStatus.OK)
  verify(@Body() dto: VerifyInviteDto) {
    return this.onboarding.verify(dto.personalEmail, dto.code);
  }

  @Post('complete')
  @HttpCode(HttpStatus.OK)
  complete(@Body() dto: CompleteOnboardingDto) {
    return this.onboarding.complete(dto);
  }
}
