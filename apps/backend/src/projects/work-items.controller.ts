import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { WorkItemsService } from './work-items.service';
import { ProjectsService } from './projects.service';
import { CreateWorkItemDto, LogWorkDto, SetStateDto, UpdateWorkItemDto } from './dto/project.dto';
import { WorkItemState, WorkItemType } from './entities/work-item.entity';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User, UserRole } from '../users/entities/user.entity';

/**
 * Epics, features, user stories, tasks and bugs. Any signed-in user can read the
 * board and move/log work on items; creating and deleting items is a
 * manager/HR/admin action, matching how the rest of the app gates authoring.
 */
@ApiTags('work-items')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('work-items')
export class WorkItemsController {
  constructor(
    private readonly items: WorkItemsService,
    private readonly projects: ProjectsService,
  ) {}

  /* ── Static paths first so they aren't swallowed by ':id' ── */

  @Get('tree')
  @ApiQuery({ name: 'projectId', required: true })
  @ApiQuery({ name: 'sprintId', required: false })
  tree(@Query('projectId') projectId: string, @Query('sprintId') sprintId?: string) {
    return this.items.tree(projectId, sprintId || undefined);
  }

  /** Work assigned to the signed-in user (or to `employeeId` when given). */
  @Get('mine')
  @ApiQuery({ name: 'employeeId', required: false })
  async mine(@CurrentUser() user: User, @Query('employeeId') employeeId?: string) {
    const id = employeeId || (await this.projects.employeeIdOf(user));
    if (!id) return { items: [], stats: { total: 0, active: 0, closed: 0, remaining: 0 } };
    return this.items.findMine(id);
  }

  @Get()
  findAll(
    @Query('projectId') projectId?: string,
    @Query('sprintId') sprintId?: string,
    @Query('teamId') teamId?: string,
    @Query('assigneeId') assigneeId?: string,
    @Query('parentId') parentId?: string,
    @Query('type') type?: WorkItemType,
    @Query('state') state?: WorkItemState,
  ) {
    return this.items.findAll({ projectId, sprintId, teamId, assigneeId, parentId, type, state });
  }

  @Post()
  @Roles(UserRole.MANAGER, UserRole.HR, UserRole.ADMIN)
  async create(@Body() dto: CreateWorkItemDto, @CurrentUser() user: User) {
    const name = await this.projects.displayName(user);
    return this.items.create(dto, { id: user?.id, name });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.items.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateWorkItemDto) {
    return this.items.update(id, dto);
  }

  /** Azure-style state change: New → Active → Resolved → Closed (or Removed). */
  @Patch(':id/state')
  setState(@Param('id') id: string, @Body() dto: SetStateDto) {
    return this.items.setState(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.MANAGER, UserRole.HR, UserRole.ADMIN)
  remove(@Param('id') id: string) {
    return this.items.remove(id);
  }

  @Get(':id/logs')
  logs(@Param('id') id: string) {
    return this.items.listLogs(id);
  }

  /** Log time against an item — this is what the individual reports count. */
  @Post(':id/logs')
  async logWork(@Param('id') id: string, @Body() dto: LogWorkDto, @CurrentUser() user: User) {
    const [employeeId, name] = await Promise.all([this.projects.employeeIdOf(user), this.projects.displayName(user)]);
    return this.items.logWork(id, dto, { employeeId, name });
  }
}
