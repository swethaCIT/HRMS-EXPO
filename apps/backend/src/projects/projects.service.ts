import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Project } from './entities/project.entity';
import { ProjectTeam, ProjectTeamMember } from './entities/project-team.entity';
import { Sprint, SprintStatus } from './entities/sprint.entity';
import { WorkItem, WorkItemState } from './entities/work-item.entity';
import { WorkLog } from './entities/work-log.entity';
import { AddTeamMemberDto, CreateProjectDto, CreateTeamDto, UpdateProjectDto, UpdateTeamMemberDto } from './dto/project.dto';
import { Employee } from '../employees/entities/employee.entity';
import { round1 } from './util';
import { TeamAccessLevel } from './entities/project-team.entity';
import { ActivityService, Actor } from './activity.service';
import { ActivityAction, ActivityEntity } from './entities/project-activity.entity';

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
    private readonly activity: ActivityService,
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
    const saved = await this.projectRepo.save(project);
    await this.activity.record({
      projectId: saved.id,
      entityType: ActivityEntity.PROJECT,
      entityId: saved.id,
      entityTitle: saved.name,
      action: ActivityAction.CREATED,
      actor: owner,
      summary: `${owner?.name || 'Someone'} created project "${saved.name}"`,
    });
    return saved;
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

  async update(id: string, dto: UpdateProjectDto, actor?: Actor): Promise<Project> {
    const project = await this.projectRepo.findOne({ where: { id } });
    if (!project) throw new NotFoundException('Project not found');
    const before = { ...project };
    Object.assign(project, {
      ...dto,
      startDate: dto.startDate ? new Date(dto.startDate) : project.startDate,
      targetDate: dto.targetDate ? new Date(dto.targetDate) : project.targetDate,
      updatedById: actor?.id ?? project.updatedById,
      updatedByName: actor?.name ?? project.updatedByName,
    });
    const saved = await this.projectRepo.save(project);

    const changes = this.activity.diff(before, saved as any);
    if (changes.length) {
      await this.activity.record({
        projectId: saved.id,
        entityType: ActivityEntity.PROJECT,
        entityId: saved.id,
        entityTitle: saved.name,
        action: ActivityAction.UPDATED,
        actor,
        changes,
      });
    }
    return saved;
  }

  /** Recent activity across the whole project — the audit feed. */
  activityFeed(projectId: string, limit?: number) {
    return this.activity.forProject(projectId, limit ?? 100);
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

  /**
   * Create one of a project's teams. A project can hold any number of them, each
   * with its own manager, roster and sprint burndown.
   */
  async createTeam(projectId: string, dto: CreateTeamDto, actor?: Actor) {
    const project = await this.projectRepo.findOne({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Project not found');
    const dup = await this.teamRepo.findOne({ where: { projectId, name: dto.name } });
    if (dup) throw new BadRequestException(`This project already has a team called "${dto.name}"`);

    const team = await this.teamRepo.save(
      this.teamRepo.create({ ...dto, projectId, createdById: actor?.id, createdByName: actor?.name }),
    );

    // The team's manager is automatically on the roster with full control —
    // otherwise nobody could administer the team they were just put in charge of.
    if (dto.managerEmployeeId) {
      await this.memberRepo.save(
        this.memberRepo.create({
          teamId: team.id,
          projectId,
          employeeId: dto.managerEmployeeId,
          name: dto.managerName || 'Team manager',
          role: 'Team Manager',
          accessLevel: TeamAccessLevel.MANAGE,
          addedById: actor?.id,
          addedByName: actor?.name,
        }),
      );
    }

    await this.activity.record({
      projectId,
      entityType: ActivityEntity.TEAM,
      entityId: team.id,
      entityTitle: team.name,
      action: ActivityAction.CREATED,
      actor,
      summary: `${actor?.name || 'Someone'} created team "${team.name}"`,
    });
    return team;
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

  /** Put an employee on a team, with the access level the manager chose. */
  async addMember(teamId: string, dto: AddTeamMemberDto, actor?: Actor) {
    const team = await this.teamRepo.findOne({ where: { id: teamId } });
    if (!team) throw new NotFoundException('Team not found');
    const exists = await this.memberRepo.findOne({ where: { teamId, employeeId: dto.employeeId } });
    if (exists) throw new BadRequestException(`${dto.name} is already on this team`);

    const member = await this.memberRepo.save(
      this.memberRepo.create({
        ...dto,
        teamId,
        projectId: team.projectId,
        accessLevel: dto.accessLevel ?? TeamAccessLevel.CONTRIBUTE,
        capacityHoursPerDay: dto.capacityHoursPerDay ?? 8,
        addedById: actor?.id,
        addedByName: actor?.name,
      }),
    );

    await this.activity.record({
      projectId: team.projectId,
      entityType: ActivityEntity.TEAM,
      entityId: teamId,
      entityTitle: team.name,
      action: ActivityAction.MEMBER_ADDED,
      actor,
      summary: `${actor?.name || 'Someone'} added ${dto.name} to ${team.name} with ${member.accessLevel} access`,
    });
    return member;
  }

  /** Batch version — the mobile picker adds a whole selection at once. */
  async addMembers(teamId: string, members: AddTeamMemberDto[], actor?: Actor) {
    const added: ProjectTeamMember[] = [];
    const skipped: { name: string; reason: string }[] = [];
    for (const m of members) {
      try {
        added.push(await this.addMember(teamId, m, actor));
      } catch (err: any) {
        // One duplicate shouldn't discard the rest of the selection.
        skipped.push({ name: m.name, reason: err?.message ?? 'Could not add' });
      }
    }
    return { added, skipped };
  }

  /** Change a member's access level / role / capacity — the manager's access control. */
  async updateMember(memberId: string, dto: UpdateTeamMemberDto, actor?: Actor) {
    const member = await this.memberRepo.findOne({ where: { id: memberId } });
    if (!member) throw new NotFoundException('Team member not found');
    const team = await this.teamRepo.findOne({ where: { id: member.teamId } });
    const before = { ...member };

    Object.assign(member, dto);
    const saved = await this.memberRepo.save(member);

    const changes = this.activity.diff(before, saved as any);
    if (changes.length) {
      await this.activity.record({
        projectId: member.projectId,
        entityType: ActivityEntity.TEAM,
        entityId: member.teamId,
        entityTitle: team?.name,
        action: dto.accessLevel ? ActivityAction.ACCESS_CHANGED : ActivityAction.UPDATED,
        actor,
        changes,
        summary:
          dto.accessLevel != null
            ? `${actor?.name || 'Someone'} set ${saved.name}'s access to ${saved.accessLevel}`
            : undefined,
      });
    }
    return saved;
  }

  async removeMember(memberId: string, actor?: Actor) {
    const member = await this.memberRepo.findOne({ where: { id: memberId } });
    if (!member) return { success: true };
    const team = await this.teamRepo.findOne({ where: { id: member.teamId } });
    await this.memberRepo.delete({ id: memberId });

    await this.activity.record({
      projectId: member.projectId,
      entityType: ActivityEntity.TEAM,
      entityId: member.teamId,
      entityTitle: team?.name,
      action: ActivityAction.MEMBER_REMOVED,
      actor,
      summary: `${actor?.name || 'Someone'} removed ${member.name} from ${team?.name ?? 'the team'}`,
    });
    return { success: true };
  }

  /**
   * What a given user may do on a team. Manager/HR/admin always get `manage`;
   * everyone else gets the level their roster row grants (or read-only when
   * they're not on the team at all).
   */
  async accessFor(teamId: string, user?: { id: string; role?: string }): Promise<TeamAccessLevel> {
    if (!user?.id) return TeamAccessLevel.READ;
    if (user.role && ['admin', 'hr', 'manager'].includes(user.role)) return TeamAccessLevel.MANAGE;
    const employeeId = await this.employeeIdOf(user);
    if (!employeeId) return TeamAccessLevel.READ;
    const member = await this.memberRepo.findOne({ where: { teamId, employeeId } });
    return member?.accessLevel ?? TeamAccessLevel.READ;
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
