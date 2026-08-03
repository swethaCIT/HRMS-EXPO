import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Project } from './entities/project.entity';
import { ProjectTeam, ProjectTeamMember } from './entities/project-team.entity';
import { Sprint, SprintStatus } from './entities/sprint.entity';
import { WorkItem, WorkItemState } from './entities/work-item.entity';
import { WorkLog } from './entities/work-log.entity';
import { AddTeamMemberDto, CreateProjectDto, CreateTeamDto, UpdateProjectDto } from './dto/project.dto';
import { Employee } from '../employees/entities/employee.entity';
import { round1 } from './util';

/** Deterministic accent colour so a project always renders the same shade. */
const COLORS = ['#4F46E5', '#0EA5E9', '#10B981', '#F59E0B', '#EC4899', '#7C3AED', '#14B8A6', '#EF4444'];

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project) private readonly projectRepo: Repository<Project>,
    @InjectRepository(ProjectTeam) private readonly teamRepo: Repository<ProjectTeam>,
    @InjectRepository(ProjectTeamMember) private readonly memberRepo: Repository<ProjectTeamMember>,
    @InjectRepository(Sprint) private readonly sprintRepo: Repository<Sprint>,
    @InjectRepository(WorkItem) private readonly itemRepo: Repository<WorkItem>,
    @InjectRepository(WorkLog) private readonly logRepo: Repository<WorkLog>,
    @InjectRepository(Employee) private readonly employeeRepo: Repository<Employee>,
  ) {}

  /**
   * A display name for the signed-in user. The JWT only carries the user id and
   * email, so fall back to the email local-part when there's no employee record.
   */
  async displayName(user?: { id: string; email?: string }): Promise<string | undefined> {
    if (!user?.id) return undefined;
    const emp = await this.employeeRepo.findOne({ where: { user: { id: user.id } }, relations: { user: true } });
    if (emp) return `${emp.firstName ?? ''} ${emp.lastName ?? ''}`.trim() || emp.employeeId;
    return user.email?.split('@')[0];
  }

  /** The employee record behind the signed-in user (used to log work as "me"). */
  async employeeIdOf(user?: { id: string }): Promise<string | undefined> {
    if (!user?.id) return undefined;
    const emp = await this.employeeRepo.findOne({ where: { user: { id: user.id } }, relations: { user: true } });
    return emp?.id;
  }

  /** "Atlas Payments Platform" → "ATLAS". Falls back to a numeric suffix on clash. */
  private async deriveKey(name: string, explicit?: string): Promise<string> {
    const base = (explicit || name)
      .replace(/[^a-zA-Z0-9 ]/g, '')
      .trim()
      .split(/\s+/)
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 5) || 'PRJ';
    const key = explicit ? explicit.toUpperCase().slice(0, 8) : (base.length > 1 ? base : name.slice(0, 4).toUpperCase());
    const taken = await this.projectRepo.count({ where: { key } });
    return taken ? `${key}${taken + 1}` : key;
  }

  private colorFor(seed: string): string {
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
    return COLORS[h % COLORS.length];
  }

  async create(dto: CreateProjectDto, owner?: { id: string; name?: string }): Promise<Project> {
    const key = await this.deriveKey(dto.name, dto.key);
    const project = this.projectRepo.create({
      ...dto,
      key,
      color: dto.color || this.colorFor(dto.name),
      startDate: dto.startDate ? new Date(dto.startDate) : new Date(),
      targetDate: dto.targetDate ? new Date(dto.targetDate) : undefined,
      ownerId: owner?.id,
      ownerName: owner?.name,
    });
    return this.projectRepo.save(project);
  }

  /**
   * Project list with the rollups the cards need (progress, item counts, active
   * sprint, team size). Aggregated in two grouped queries rather than N+1 per
   * project so the list stays cheap as the board grows.
   */
  async findAll() {
    const projects = await this.projectRepo.find({ order: { createdAt: 'DESC' } });
    if (!projects.length) return [];
    const ids = projects.map((p) => p.id);

    // Only the columns the cards need — the description/notes are dead weight here.
    const items = await this.itemRepo.find({
      where: { projectId: In(ids) },
      select: {
        id: true, projectId: true, state: true, type: true,
        originalEstimate: true, remainingWork: true, completedWork: true, targetDate: true,
      },
    });
    const teams = await this.teamRepo.find({ where: { projectId: In(ids) } });
    const members = await this.memberRepo.find({ where: { projectId: In(ids) } });
    const sprints = await this.sprintRepo.find({ where: { projectId: In(ids) } });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return projects.map((p) => {
      const own = items.filter((i) => i.projectId === p.id && i.state !== WorkItemState.REMOVED);
      const closed = own.filter((i) => i.state === WorkItemState.CLOSED).length;
      const active = own.filter((i) => i.state === WorkItemState.ACTIVE).length;
      const blockedish = own.filter(
        (i) => i.targetDate && new Date(i.targetDate) < today && i.state !== WorkItemState.CLOSED,
      ).length;
      const current = sprints.find((s) => s.projectId === p.id && s.status === SprintStatus.CURRENT);
      return {
        ...p,
        itemsTotal: own.length,
        itemsClosed: closed,
        itemsActive: active,
        overdue: blockedish,
        progress: own.length ? Math.round((closed / own.length) * 100) : 0,
        teamCount: teams.filter((t) => t.projectId === p.id).length,
        memberCount: new Set(members.filter((m) => m.projectId === p.id).map((m) => m.employeeId)).size,
        sprintCount: sprints.filter((s) => s.projectId === p.id).length,
        currentSprint: current ? { id: current.id, name: current.name, endDate: current.endDate } : null,
      };
    });
  }

  /** Full project header: teams (with members), sprints and state rollups. */
  async findOne(id: string) {
    const project = await this.projectRepo.findOne({ where: { id } });
    if (!project) throw new NotFoundException('Project not found');

    const [teams, members, sprints, items] = await Promise.all([
      this.teamRepo.find({ where: { projectId: id }, order: { createdAt: 'ASC' } }),
      this.memberRepo.find({ where: { projectId: id }, order: { createdAt: 'ASC' } }),
      this.sprintRepo.find({ where: { projectId: id }, order: { startDate: 'ASC' } }),
      this.itemRepo.find({ where: { projectId: id } }),
    ]);

    const live = items.filter((i) => i.state !== WorkItemState.REMOVED);
    const byState = (s: WorkItemState) => live.filter((i) => i.state === s).length;

    return {
      ...project,
      teams: teams.map((t) => {
        const mem = members.filter((m) => m.teamId === t.id);
        const teamItems = live.filter((i) => i.teamId === t.id);
        return {
          ...t,
          members: mem,
          memberCount: mem.length,
          itemsTotal: teamItems.length,
          itemsClosed: teamItems.filter((i) => i.state === WorkItemState.CLOSED).length,
          itemsActive: teamItems.filter((i) => i.state === WorkItemState.ACTIVE).length,
        };
      }),
      sprints,
      currentSprint: sprints.find((s) => s.status === SprintStatus.CURRENT) || null,
      stats: {
        itemsTotal: live.length,
        new: byState(WorkItemState.NEW),
        active: byState(WorkItemState.ACTIVE),
        resolved: byState(WorkItemState.RESOLVED),
        closed: byState(WorkItemState.CLOSED),
        progress: live.length ? Math.round((byState(WorkItemState.CLOSED) / live.length) * 100) : 0,
        estimated: round1(live.reduce((s, i) => s + (i.originalEstimate || 0), 0)),
        completed: round1(live.reduce((s, i) => s + (i.completedWork || 0), 0)),
        remaining: round1(live.reduce((s, i) => s + (i.remainingWork || 0), 0)),
        storyPoints: round1(live.reduce((s, i) => s + (i.storyPoints || 0), 0)),
      },
    };
  }

  async update(id: string, dto: UpdateProjectDto): Promise<Project> {
    const project = await this.projectRepo.findOne({ where: { id } });
    if (!project) throw new NotFoundException('Project not found');
    Object.assign(project, {
      ...dto,
      startDate: dto.startDate ? new Date(dto.startDate) : project.startDate,
      targetDate: dto.targetDate ? new Date(dto.targetDate) : project.targetDate,
    });
    return this.projectRepo.save(project);
  }

  /** Deleting a project removes everything hanging off it (no orphan rows). */
  async remove(id: string) {
    const project = await this.projectRepo.findOne({ where: { id } });
    if (!project) throw new NotFoundException('Project not found');
    await this.logRepo.delete({ projectId: id });
    await this.itemRepo.delete({ projectId: id });
    await this.sprintRepo.delete({ projectId: id });
    await this.memberRepo.delete({ projectId: id });
    await this.teamRepo.delete({ projectId: id });
    await this.projectRepo.delete({ id });
    return { success: true };
  }

  /* ── Teams ── */

  async listTeams(projectId: string) {
    const teams = await this.teamRepo.find({ where: { projectId }, order: { createdAt: 'ASC' } });
    const members = await this.memberRepo.find({ where: { projectId } });
    return teams.map((t) => ({ ...t, members: members.filter((m) => m.teamId === t.id) }));
  }

  async createTeam(projectId: string, dto: CreateTeamDto) {
    const project = await this.projectRepo.findOne({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Project not found');
    return this.teamRepo.save(this.teamRepo.create({ ...dto, projectId }));
  }

  async removeTeam(teamId: string) {
    const team = await this.teamRepo.findOne({ where: { id: teamId } });
    if (!team) throw new NotFoundException('Team not found');
    await this.memberRepo.delete({ teamId });
    // Work items survive the squad — they just fall back to the project backlog.
    await this.itemRepo.update({ teamId }, { teamId: null as any });
    await this.sprintRepo.update({ teamId }, { teamId: null as any });
    await this.teamRepo.delete({ id: teamId });
    return { success: true };
  }

  async addMember(teamId: string, dto: AddTeamMemberDto) {
    const team = await this.teamRepo.findOne({ where: { id: teamId } });
    if (!team) throw new NotFoundException('Team not found');
    const exists = await this.memberRepo.findOne({ where: { teamId, employeeId: dto.employeeId } });
    if (exists) throw new BadRequestException('That person is already on this team');
    return this.memberRepo.save(
      this.memberRepo.create({ ...dto, teamId, projectId: team.projectId, capacityHoursPerDay: dto.capacityHoursPerDay ?? 8 }),
    );
  }

  async removeMember(memberId: string) {
    await this.memberRepo.delete({ id: memberId });
    return { success: true };
  }

  /** Team detail — members, their workload and the team's sprints. */
  async teamDetail(teamId: string) {
    const team = await this.teamRepo.findOne({ where: { id: teamId } });
    if (!team) throw new NotFoundException('Team not found');
    const [project, members, items, sprints, logs] = await Promise.all([
      this.projectRepo.findOne({ where: { id: team.projectId } }),
      this.memberRepo.find({ where: { teamId }, order: { createdAt: 'ASC' } }),
      this.itemRepo.find({ where: { teamId } }),
      this.sprintRepo.find({ where: { projectId: team.projectId }, order: { startDate: 'ASC' } }),
      this.logRepo.find({ where: { projectId: team.projectId } }),
    ]);

    const live = items.filter((i) => i.state !== WorkItemState.REMOVED);
    return {
      ...team,
      projectName: project?.name,
      projectKey: project?.key,
      sprints: sprints.filter((s) => !s.teamId || s.teamId === teamId),
      stats: {
        itemsTotal: live.length,
        active: live.filter((i) => i.state === WorkItemState.ACTIVE).length,
        closed: live.filter((i) => i.state === WorkItemState.CLOSED).length,
        remaining: round1(live.reduce((s, i) => s + (i.remainingWork || 0), 0)),
        completed: round1(live.reduce((s, i) => s + (i.completedWork || 0), 0)),
        progress: live.length ? Math.round((live.filter((i) => i.state === WorkItemState.CLOSED).length / live.length) * 100) : 0,
      },
      members: members.map((m) => {
        const mine = live.filter((i) => i.assigneeId === m.employeeId);
        const hours = logs.filter((l) => l.employeeId === m.employeeId).reduce((s, l) => s + (l.hours || 0), 0);
        const closed = mine.filter((i) => i.state === WorkItemState.CLOSED).length;
        return {
          ...m,
          assigned: mine.length,
          active: mine.filter((i) => i.state === WorkItemState.ACTIVE).length,
          closed,
          hoursLogged: round1(hours),
          remaining: round1(mine.reduce((s, i) => s + (i.remainingWork || 0), 0)),
          completionPct: mine.length ? Math.round((closed / mine.length) * 100) : 0,
        };
      }),
    };
  }
}
