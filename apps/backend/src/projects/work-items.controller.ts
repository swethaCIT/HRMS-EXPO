import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
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
 * Epics, features, user stories, tasks and bugs.
 *
 * Permissions, matching how the team actually works:
 *  - Everyone signed in can READ the board.
 *  - Everyone can CREATE items and move/log work on them — an employee must be
 *    able to raise a task or a bug for themselves.
 *  - Only manager/HR/admin can DELETE, so no employee can erase a record
 *    (and even then it's written to the project's audit trail first).
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
  @ApiOperation({
    summary: 'Backlog tree',
    description:
      'Epic → Feature → User Story → Task/Bug for a project, with effort and completion rolled up from every descendant. Pass `sprintId` to scope to one iteration (ancestors are kept so the tree still renders).',
  })
  @ApiQuery({ name: 'projectId', required: true, description: 'Project to build the tree for' })
  @ApiQuery({ name: 'sprintId', required: false, description: 'Optional sprint filter' })
  @ApiOkResponse({ description: 'Nested work items, each with a `rollup` summary' })
  tree(@Query('projectId') projectId: string, @Query('sprintId') sprintId?: string) {
    return this.items.tree(projectId, sprintId || undefined);
  }

  @Get('mine')
  @ApiOperation({
    summary: 'My work items',
    description: 'Everything assigned to the signed-in user across every project, with a small stats block.',
  })
  @ApiQuery({ name: 'employeeId', required: false, description: 'Look at someone else (managers/HR)' })
  async mine(@CurrentUser() user: User, @Query('employeeId') employeeId?: string) {
    const id = employeeId || (await this.projects.employeeIdOf(user));
    if (!id) return { items: [], stats: { total: 0, active: 0, closed: 0, remaining: 0 } };
    return this.items.findMine(id);
  }

  @Get()
  @ApiOperation({ summary: 'List work items', description: 'Flat, filterable list. All filters are optional and combine with AND.' })
  @ApiQuery({ name: 'projectId', required: false })
  @ApiQuery({ name: 'sprintId', required: false })
  @ApiQuery({ name: 'teamId', required: false })
  @ApiQuery({ name: 'assigneeId', required: false })
  @ApiQuery({ name: 'parentId', required: false })
  @ApiQuery({ name: 'type', required: false, enum: WorkItemType })
  @ApiQuery({ name: 'state', required: false, enum: WorkItemState })
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
  @ApiOperation({
    summary: 'Create a work item',
    description:
      'Any signed-in user may create. Parent/child rules are enforced (an Epic holds Features, a Feature holds User Stories, a Story holds Tasks/Bugs). If an assignee is set they get an in-app notification, an email and a push telling them it was assigned to them.',
  })
  @ApiBody({ type: CreateWorkItemDto })
  @ApiNotFoundResponse({ description: 'Project or parent work item not found' })
  async create(@Body() dto: CreateWorkItemDto, @CurrentUser() user: User) {
    const name = await this.projects.displayName(user);
    return this.items.create(dto, { id: user?.id, name });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Work item detail', description: 'Includes parent, children, work logs, who created it and who last updated it.' })
  @ApiParam({ name: 'id', description: 'Work item id' })
  @ApiNotFoundResponse({ description: 'Work item not found' })
  findOne(@Param('id') id: string) {
    return this.items.findOne(id);
  }

  @Get(':id/history')
  @ApiOperation({
    summary: 'Work item history',
    description: 'Full audit trail for this item — every create, edit, state change, assignment and work log, with who did it and the old → new values.',
  })
  @ApiParam({ name: 'id', description: 'Work item id' })
  history(@Param('id') id: string) {
    return this.items.history(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a work item', description: 'Partial update. Every changed field is written to the audit trail.' })
  @ApiParam({ name: 'id', description: 'Work item id' })
  @ApiBody({ type: UpdateWorkItemDto })
  async update(@Param('id') id: string, @Body() dto: UpdateWorkItemDto, @CurrentUser() user: User) {
    const name = await this.projects.displayName(user);
    return this.items.update(id, dto, { id: user?.id, name });
  }

  @Patch(':id/state')
  @ApiOperation({
    summary: 'Change state',
    description: 'Azure-style transition: New → Active → Resolved → Closed (or Removed). Closing zeroes remaining work; reopening restores it.',
  })
  @ApiParam({ name: 'id', description: 'Work item id' })
  @ApiBody({ type: SetStateDto })
  async setState(@Param('id') id: string, @Body() dto: SetStateDto, @CurrentUser() user: User) {
    const name = await this.projects.displayName(user);
    return this.items.setState(id, dto, { id: user?.id, name });
  }

  @Delete(':id')
  @Roles(UserRole.MANAGER, UserRole.HR, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Delete a work item (manager/HR/admin only)',
    description: 'Employees cannot delete. Children are re-parented to this item\'s parent rather than orphaned, and the deletion is recorded in the project audit trail.',
  })
  @ApiParam({ name: 'id', description: 'Work item id' })
  @ApiForbiddenResponse({ description: 'Employees are not allowed to delete work items' })
  async remove(@Param('id') id: string, @CurrentUser() user: User) {
    const name = await this.projects.displayName(user);
    return this.items.remove(id, { id: user?.id, name });
  }

  @Get(':id/logs')
  @ApiOperation({ summary: 'Work logs for an item' })
  @ApiParam({ name: 'id', description: 'Work item id' })
  logs(@Param('id') id: string) {
    return this.items.listLogs(id);
  }

  @Post(':id/logs')
  @ApiOperation({
    summary: 'Log time against an item',
    description: 'Adds hours to completed work and reduces remaining work. This is what the individual reports count as time spent.',
  })
  @ApiParam({ name: 'id', description: 'Work item id' })
  @ApiBody({ type: LogWorkDto })
  async logWork(@Param('id') id: string, @Body() dto: LogWorkDto, @CurrentUser() user: User) {
    const [employeeId, name] = await Promise.all([this.projects.employeeIdOf(user), this.projects.displayName(user)]);
    return this.items.logWork(id, dto, { employeeId, name, userId: user?.id });
  }
}
