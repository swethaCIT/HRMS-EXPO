import { Controller, Get, Post, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { OnboardingService } from './onboarding.service';
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
  invite(@Body() body: any, @CurrentUser('id') hrId: string) {
    return this.onboarding.invite(body, hrId);
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
  verify(@Body('personalEmail') personalEmail: string, @Body('code') code: string) {
    return this.onboarding.verify(personalEmail, code);
  }

  @Post('complete')
  @HttpCode(HttpStatus.OK)
  complete(@Body() body: any) {
    return this.onboarding.complete(body);
  }
}
