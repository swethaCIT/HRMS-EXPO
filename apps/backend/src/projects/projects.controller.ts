import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ProjectsService } from './projects.service';
import { SprintsService } from './sprints.service';
import { ReportsService } from './reports.service';
import { AddTeamMemberDto, CreateProjectDto, CreateSprintDto, CreateTeamDto, UpdateProjectDto } from './dto/project.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User, UserRole } from '../users/entities/user.entity';

/**
 * Project boards ("Goals"). Everyone signed in can read the boards; creating and
 * restructuring a project is a manager/HR/admin action.
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
  findAll() {
    return this.projects.findAll();
  }

  @Post()
  @Roles(UserRole.MANAGER, UserRole.HR, UserRole.ADMIN)
  async create(@Body() dto: CreateProjectDto, @CurrentUser() user: User) {
    const name = await this.projects.displayName(user);
    return this.projects.create(dto, { id: user?.id, name });
  }

  /* ── Team routes are declared before ':id' so "teams" is never read as an id ── */

  @Get('teams/:teamId')
  teamDetail(@Param('teamId') teamId: string) {
    return this.projects.teamDetail(teamId);
  }

  @Delete('teams/:teamId')
  @Roles(UserRole.MANAGER, UserRole.HR, UserRole.ADMIN)
  removeTeam(@Param('teamId') teamId: string) {
    return this.projects.removeTeam(teamId);
  }

  @Post('teams/:teamId/members')
  @Roles(UserRole.MANAGER, UserRole.HR, UserRole.ADMIN)
  addMember(@Param('teamId') teamId: string, @Body() dto: AddTeamMemberDto) {
    return this.projects.addMember(teamId, dto);
  }

  @Delete('teams/members/:memberId')
  @Roles(UserRole.MANAGER, UserRole.HR, UserRole.ADMIN)
  removeMember(@Param('memberId') memberId: string) {
    return this.projects.removeMember(memberId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.projects.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.MANAGER, UserRole.HR, UserRole.ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateProjectDto) {
    return this.projects.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.MANAGER, UserRole.HR, UserRole.ADMIN)
  remove(@Param('id') id: string) {
    return this.projects.remove(id);
  }

  @Get(':id/teams')
  listTeams(@Param('id') id: string) {
    return this.projects.listTeams(id);
  }

  @Post(':id/teams')
  @Roles(UserRole.MANAGER, UserRole.HR, UserRole.ADMIN)
  createTeam(@Param('id') id: string, @Body() dto: CreateTeamDto) {
    return this.projects.createTeam(id, dto);
  }

  @Get(':id/sprints')
  listSprints(@Param('id') id: string) {
    return this.sprints.findByProject(id);
  }

  @Post(':id/sprints')
  @Roles(UserRole.MANAGER, UserRole.HR, UserRole.ADMIN)
  createSprint(@Param('id') id: string, @Body() dto: CreateSprintDto) {
    return this.sprints.create(id, dto);
  }

  @Get(':id/report')
  report(@Param('id') id: string) {
    return this.reports.projectReport(id);
  }

  @Get(':id/report/members')
  memberReports(@Param('id') id: string) {
    return this.reports.memberReports(id);
  }

  @Get(':id/report/members/:employeeId')
  memberDetail(@Param('id') id: string, @Param('employeeId') employeeId: string) {
    return this.reports.memberDetail(id, employeeId);
  }
}
