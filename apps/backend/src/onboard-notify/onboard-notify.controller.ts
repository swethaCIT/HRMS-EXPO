import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { OnboardNotifyService } from './onboard-notify.service';
import { CreateOnboardingRecordDto } from './dto/create-onboarding-record.dto';
import { ReviewDecisionDto } from './dto/review-decision.dto';
import { ForwardDecisionDto } from './dto/forward-decision.dto';
import { OnboardStatus } from './entities/onboarding-record.entity';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SkipAudit } from '../audit/skip-audit.decorator';
import { User, UserRole } from '../users/entities/user.entity';
import { AuditActor } from '../audit/audit.service';

function actorOf(user: User): AuditActor {
  return { id: user.id, name: user.email?.split('@')[0], role: user.role };
}

/** HR/Admin-only management of pre-onboarding candidate records. Public, unauthenticated endpoints live in onboard-notify-public.controller.ts. */
@ApiTags('onboard-notify')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.HR, UserRole.ADMIN)
@Controller('onboard-notify')
export class OnboardNotifyController {
  constructor(private readonly service: OnboardNotifyService) {}

  @Post()
  @SkipAudit()
  create(@Body() dto: CreateOnboardingRecordDto, @CurrentUser() user: User) {
    return this.service.create(dto, actorOf(user));
  }

  @Get()
  findAll(@Query('status') status?: OnboardStatus, @Query('limit') limit?: string, @Query('offset') offset?: string) {
    return this.service.findAll(status, limit ? +limit : undefined, offset ? +offset : undefined);
  }

  @Get('field-catalog')
  fieldCatalog() {
    return this.service.fieldCatalog();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post(':id/resend')
  @SkipAudit()
  resend(@Param('id') id: string, @CurrentUser() user: User) {
    return this.service.resend(id, actorOf(user));
  }

  @Post(':id/review')
  @SkipAudit()
  review(@Param('id') id: string, @Body() dto: ReviewDecisionDto, @CurrentUser() user: User) {
    return this.service.review(id, dto, actorOf(user));
  }

  @Post(':id/forward')
  @SkipAudit()
  forward(@Param('id') id: string, @Body() dto: ForwardDecisionDto, @CurrentUser() user: User) {
    return this.service.forward(id, dto, actorOf(user));
  }

  @Patch(':id/complete')
  @SkipAudit()
  complete(@Param('id') id: string, @CurrentUser() user: User) {
    return this.service.complete(id, actorOf(user));
  }
}
