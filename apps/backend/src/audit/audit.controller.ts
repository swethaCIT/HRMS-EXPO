import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AuditService } from './audit.service';
import { AuditAction } from './entities/audit-log.entity';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';

/**
 * The organisation's activity log. Admin-only: it necessarily reveals who
 * touched whose records, so it is more sensitive than the data it describes.
 */
@ApiTags('audit')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('audit')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @ApiOperation({
    summary: 'Activity log (Admin)',
    description: 'Every state-changing action across the system, newest first, with the actor, target and field-level changes. Refused attempts are recorded too.',
  })
  @ApiQuery({ name: 'actorId', required: false })
  @ApiQuery({ name: 'entityType', required: false, description: 'e.g. user, leave, payroll, document' })
  @ApiQuery({ name: 'entityId', required: false })
  @ApiQuery({ name: 'action', required: false, enum: AuditAction })
  @ApiQuery({ name: 'from', required: false, description: 'ISO date' })
  @ApiQuery({ name: 'to', required: false, description: 'ISO date' })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'offset', required: false })
  find(
    @Query('actorId') actorId?: string,
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
    @Query('action') action?: AuditAction,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.audit.find({
      actorId, entityType, entityId, action, from, to,
      limit: limit ? +limit : undefined,
      offset: offset ? +offset : undefined,
    });
  }

  @Get('stats')
  @ApiOperation({ summary: 'Activity counts by action (Admin)' })
  @ApiQuery({ name: 'days', required: false, description: 'Window in days (default 7)' })
  stats(@Query('days') days?: string) {
    return this.audit.stats(days ? +days : undefined);
  }

  @Get(':entityType/:entityId')
  @ApiOperation({ summary: 'Full history of one record (Admin)', description: 'e.g. /audit/user/<id> — everything that ever happened to that user.' })
  @ApiParam({ name: 'entityType' })
  @ApiParam({ name: 'entityId' })
  forEntity(@Param('entityType') entityType: string, @Param('entityId') entityId: string) {
    return this.audit.forEntity(entityType, entityId);
  }
}
