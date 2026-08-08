import { Body, Controller, Delete, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { SprintsService } from './sprints.service';
import { UpdateSprintDto } from './dto/project.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';

/** Sprint iterations and the burndown charts drawn from them. */
@ApiTags('sprints')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('sprints')
export class SprintsController {
  constructor(private readonly sprints: SprintsService) {}

  @Get(':id/burndown')
  @ApiOperation({
    summary: 'Sprint burndown',
    description:
      'Ideal vs actual remaining effort per day, plus sprint health. The actual line is reconstructed from real close timestamps and stops at today rather than projecting the future. Effort unit falls back hours → story points → item count. Pass `teamId` to scope the curve to one squad.',
  })
  @ApiParam({ name: 'id', description: 'Sprint id' })
  @ApiQuery({ name: 'teamId', required: false, description: "Scope the burndown to a single team's work" })
  @ApiOkResponse({ description: 'labels[], ideal[], actual[] (null after today), and sprint totals' })
  @ApiNotFoundResponse({ description: 'Sprint not found' })
  burndown(@Param('id') id: string, @Query('teamId') teamId?: string) {
    return this.sprints.burndown(id, teamId || undefined);
  }

  @Get(':id/burndown/teams')
  @ApiOperation({
    summary: 'Burndown for every team, combined',
    description:
      "One series per team plus the combined project curve, all sharing the same day labels so they can be overlaid on a single chart. Teams with no work in this sprint are listed separately in `teamsWithoutWork` instead of drawing a flat line.",
  })
  @ApiParam({ name: 'id', description: 'Sprint id' })
  @ApiOkResponse({ description: 'labels[], combined{}, teams[] (one series each), teamsWithoutWork[]' })
  @ApiNotFoundResponse({ description: 'Sprint not found' })
  burndownByTeam(@Param('id') id: string) {
    return this.sprints.burndownByTeam(id);
  }

  @Patch(':id')
  @Roles(UserRole.MANAGER, UserRole.HR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Update a sprint', description: 'Marking one `current` demotes any other current sprint in the project.' })
  @ApiParam({ name: 'id', description: 'Sprint id' })
  @ApiBody({ type: UpdateSprintDto })
  update(@Param('id') id: string, @Body() dto: UpdateSprintDto) {
    return this.sprints.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.MANAGER, UserRole.HR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete a sprint', description: 'Its work items move back to the backlog rather than being deleted.' })
  @ApiParam({ name: 'id', description: 'Sprint id' })
  remove(@Param('id') id: string) {
    return this.sprints.remove(id);
  }
}
