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
import { ProjectsService } from './projects.service';
import { SprintsService } from './sprints.service';
import { ReportsService } from './reports.service';
import {
  AddTeamMemberDto,
  AddTeamMembersDto,
  CreateProjectDto,
  CreateSprintDto,
  CreateTeamDto,
  UpdateProjectDto,
  UpdateTeamMemberDto,
} from './dto/project.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User, UserRole } from '../users/entities/user.entity';

/**
 * Project boards ("Goals") and the teams inside them.
 *
 * A project holds any number of teams; each team has its own manager, its own
 * roster and its own sprint burndown. Reading is open to every signed-in user;
 * creating and restructuring is a manager/HR/admin action.
 */
@ApiTags('projects')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('projects')
export class ProjectsController {
  constructor(
    private readonly projects: ProjectsService,
    private readonly sprints: SprintsService,
    private readonly reports: ReportsService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List projects',
    description: 'Every project with its rollups: progress, item counts, team/member counts and the current sprint.',
  })
  findAll() {
    return this.projects.findAll();
  }

  @Post()
  @Roles(UserRole.MANAGER, UserRole.HR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a project (manager/HR/admin)', description: 'The short key (e.g. ATLAS) is derived from the name when omitted.' })
  @ApiBody({ type: CreateProjectDto })
  @ApiForbiddenResponse({ description: 'Employees cannot create projects' })
  async create(@Body() dto: CreateProjectDto, @CurrentUser() user: User) {
    const name = await this.projects.displayName(user);
    return this.projects.create(dto, { id: user?.id, name });
  }

  /* ── Team routes are declared before ':id' so "teams" is never read as an id ── */

  @Get('teams/:teamId')
  @ApiOperation({
    summary: 'Team detail',
    description: "The squad's roster with each member's access level and workload, plus the team's sprints and delivery stats.",
  })
  @ApiParam({ name: 'teamId' })
  @ApiNotFoundResponse({ description: 'Team not found' })
  teamDetail(@Param('teamId') teamId: string) {
    return this.projects.teamDetail(teamId);
  }

  @Get('teams/:teamId/my-access')
  @ApiOperation({
    summary: 'My access level on this team',
    description: 'Returns `read`, `contribute` or `manage` for the signed-in user, so the app can hide actions they cannot perform.',
  })
  @ApiParam({ name: 'teamId' })
  async myAccess(@Param('teamId') teamId: string, @CurrentUser() user: User) {
    return { accessLevel: await this.projects.accessFor(teamId, user) };
  }

  @Delete('teams/:teamId')
  @Roles(UserRole.MANAGER, UserRole.HR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete a team', description: 'Its work items fall back to the project backlog rather than being deleted.' })
  @ApiParam({ name: 'teamId' })
  removeTeam(@Param('teamId') teamId: string) {
    return this.projects.removeTeam(teamId);
  }

  @Post('teams/:teamId/members')
  @Roles(UserRole.MANAGER, UserRole.HR, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Add an employee to a team',
    description: 'The manager picks the access level here — `read`, `contribute` (default) or `manage`.',
  })
  @ApiParam({ name: 'teamId' })
  @ApiBody({ type: AddTeamMemberDto })
  async addMember(@Param('teamId') teamId: string, @Body() dto: AddTeamMemberDto, @CurrentUser() user: User) {
    const name = await this.projects.displayName(user);
    return this.projects.addMember(teamId, dto, { id: user?.id, name });
  }

  @Post('teams/:teamId/members/batch')
  @Roles(UserRole.MANAGER, UserRole.HR, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Add several employees at once',
    description: 'Used by the mobile member picker. Returns what was added and what was skipped (e.g. already on the team) rather than failing the whole batch.',
  })
  @ApiParam({ name: 'teamId' })
  @ApiBody({ type: AddTeamMembersDto })
  async addMembers(@Param('teamId') teamId: string, @Body() dto: AddTeamMembersDto, @CurrentUser() user: User) {
    const name = await this.projects.displayName(user);
    return this.projects.addMembers(teamId, dto.members, { id: user?.id, name });
  }

  @Patch('teams/members/:memberId')
  @Roles(UserRole.MANAGER, UserRole.HR, UserRole.ADMIN)
  @ApiOperation({
    summary: "Change a member's access, role or capacity",
    description: 'This is the manager granting or revoking access inside their team. Recorded in the audit trail.',
  })
  @ApiParam({ name: 'memberId' })
  @ApiBody({ type: UpdateTeamMemberDto })
  async updateMember(@Param('memberId') memberId: string, @Body() dto: UpdateTeamMemberDto, @CurrentUser() user: User) {
    const name = await this.projects.displayName(user);
    return this.projects.updateMember(memberId, dto, { id: user?.id, name });
  }

  @Delete('teams/members/:memberId')
  @Roles(UserRole.MANAGER, UserRole.HR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Remove someone from a team' })
  @ApiParam({ name: 'memberId' })
  async removeMember(@Param('memberId') memberId: string, @CurrentUser() user: User) {
    const name = await this.projects.displayName(user);
    return this.projects.removeMember(memberId, { id: user?.id, name });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Project detail', description: 'Header, every team with its roster, all sprints and the state rollup.' })
  @ApiParam({ name: 'id' })
  @ApiNotFoundResponse({ description: 'Project not found' })
  findOne(@Param('id') id: string) {
    return this.projects.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.MANAGER, UserRole.HR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Update a project' })
  @ApiParam({ name: 'id' })
  @ApiBody({ type: UpdateProjectDto })
  async update(@Param('id') id: string, @Body() dto: UpdateProjectDto, @CurrentUser() user: User) {
    const name = await this.projects.displayName(user);
    return this.projects.update(id, dto, { id: user?.id, name });
  }

  @Delete(':id')
  @Roles(UserRole.MANAGER, UserRole.HR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete a project', description: 'Removes its teams, sprints, work items and logs. Not reversible.' })
  @ApiParam({ name: 'id' })
  remove(@Param('id') id: string) {
    return this.projects.remove(id);
  }

  @Get(':id/activity')
  @ApiOperation({
    summary: 'Project audit feed',
    description: 'Everything that happened on this board, newest first — who created or updated what, state changes, assignments, roster and access changes.',
  })
  @ApiParam({ name: 'id' })
  @ApiQuery({ name: 'limit', required: false, description: 'Max entries (default 100, cap 300)' })
  activity(@Param('id') id: string, @Query('limit') limit?: string) {
    return this.projects.activityFeed(id, limit ? +limit : undefined);
  }

  @Get(':id/teams')
  @ApiOperation({ summary: "A project's teams", description: 'Each team with its roster. A project can have as many teams as it needs.' })
  @ApiParam({ name: 'id' })
  listTeams(@Param('id') id: string) {
    return this.projects.listTeams(id);
  }

  @Post(':id/teams')
  @Roles(UserRole.MANAGER, UserRole.HR, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Create a team inside a project',
    description: 'Give it a name and a manager. The named manager is added to the roster automatically with `manage` access.',
  })
  @ApiParam({ name: 'id' })
  @ApiBody({ type: CreateTeamDto })
  async createTeam(@Param('id') id: string, @Body() dto: CreateTeamDto, @CurrentUser() user: User) {
    const name = await this.projects.displayName(user);
    return this.projects.createTeam(id, dto, { id: user?.id, name });
  }

  @Get(':id/sprints')
  @ApiOperation({ summary: "A project's sprints", description: 'Each with its own completion and effort rollup.' })
  @ApiParam({ name: 'id' })
  listSprints(@Param('id') id: string) {
    return this.sprints.findByProject(id);
  }

  @Post(':id/sprints')
  @Roles(UserRole.MANAGER, UserRole.HR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a sprint', description: 'Optionally scoped to one team via `teamId`.' })
  @ApiParam({ name: 'id' })
  @ApiBody({ type: CreateSprintDto })
  async createSprint(@Param('id') id: string, @Body() dto: CreateSprintDto, @CurrentUser() user: User) {
    const name = await this.projects.displayName(user);
    return this.sprints.create(id, dto, { id: user?.id, name });
  }

  @Get(':id/report')
  @ApiOperation({
    summary: 'Project report',
    description: 'Delivery health: state/type/priority mix, effort, velocity per sprint, weekly effort and per-team delivery.',
  })
  @ApiParam({ name: 'id' })
  @ApiOkResponse({ description: 'Aggregated project analytics' })
  report(@Param('id') id: string) {
    return this.reports.projectReport(id);
  }

  @Get(':id/report/members')
  @ApiOperation({
    summary: 'Per-person report',
    description:
      'For everyone on the project: items assigned vs closed, hours logged, share of total effort, days engaged, on-time %, average cycle time and estimate accuracy.',
  })
  @ApiParam({ name: 'id' })
  memberReports(@Param('id') id: string) {
    return this.reports.memberReports(id);
  }

  @Get(':id/report/members/:employeeId')
  @ApiOperation({ summary: 'One person’s contribution', description: 'Their work items on this project plus every time entry.' })
  @ApiParam({ name: 'id' })
  @ApiParam({ name: 'employeeId' })
  memberDetail(@Param('id') id: string, @Param('employeeId') employeeId: string) {
    return this.reports.memberDetail(id, employeeId);
  }
}
