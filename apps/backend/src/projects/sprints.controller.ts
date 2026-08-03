import { Body, Controller, Delete, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { SprintsService } from './sprints.service';
import { UpdateSprintDto } from './dto/project.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';

@ApiTags('sprints')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('sprints')
export class SprintsController {
  constructor(private readonly sprints: SprintsService) {}

  /** Burndown + sprint health for the sprint graph; `teamId` scopes it to one squad. */
  @Get(':id/burndown')
  @ApiQuery({ name: 'teamId', required: false })
  burndown(@Param('id') id: string, @Query('teamId') teamId?: string) {
    return this.sprints.burndown(id, teamId || undefined);
  }

  @Patch(':id')
  @Roles(UserRole.MANAGER, UserRole.HR, UserRole.ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateSprintDto) {
    return this.sprints.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.MANAGER, UserRole.HR, UserRole.ADMIN)
  remove(@Param('id') id: string) {
    return this.sprints.remove(id);
  }
}
