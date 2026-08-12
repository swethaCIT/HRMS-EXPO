import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';

/** Org-wide headcount, attendance and attrition — not employee-level data. */
@ApiTags('analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Roles(UserRole.MANAGER, UserRole.HR, UserRole.ADMIN)
  @Get('summary')
  @ApiOperation({
    summary: 'Org analytics summary',
    description:
      "Headcount, department and gender split, 7-day attendance trend, leave distribution, presence today, new joiners, this month's celebrations and attrition. Cached 60s.",
  })
  summary() {
    return this.analytics.summary();
  }

  @Roles(UserRole.MANAGER, UserRole.HR, UserRole.ADMIN)
  @Get('directory')
  @ApiOperation({
    summary: 'Employee directory with live presence',
    description: "Every employee with where they are TODAY (in office / remote / on leave / not in), derived from today's attendance row and any approved leave covering today, plus their pending request count. Cached 30s.",
  })
  directory() {
    return this.analytics.directory();
  }
}
