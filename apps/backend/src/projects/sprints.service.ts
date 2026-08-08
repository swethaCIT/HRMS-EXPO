import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Sprint, SprintStatus } from './entities/sprint.entity';
import { WorkItem, WorkItemState } from './entities/work-item.entity';
import { WorkLog } from './entities/work-log.entity';
import { Project } from './entities/project.entity';
import { ProjectTeam } from './entities/project-team.entity';
import { CreateSprintDto, UpdateSprintDto } from './dto/project.dto';
import { round1 } from './util';

const DAY_MS = 86_400_000;
const startOfDay = (d: Date | string) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};
const endOfDay = (d: Date) => new Date(startOfDay(d).getTime() + DAY_MS - 1);

@Injectable()
export class SprintsService {
  constructor(
    @InjectRepository(Sprint) private readonly sprintRepo: Repository<Sprint>,
    @InjectRepository(WorkItem) private readonly itemRepo: Repository<WorkItem>,
    @InjectRepository(WorkLog) private readonly logRepo: Repository<WorkLog>,
    @InjectRepository(Project) private readonly projectRepo: Repository<Project>,
    @InjectRepository(ProjectTeam) private readonly teamRepo: Repository<ProjectTeam>,
  ) {}

  /**
   * Every team's burndown for one sprint, plus the combined project curve —
   * this is what the "all teams" comparison chart draws. Each series shares the
   * same day labels so they can be overlaid directly.
   */
  async burndownByTeam(sprintId: string) {
    const sprint = await this.sprintRepo.findOne({ where: { id: sprintId } });
    if (!sprint) throw new NotFoundException('Sprint not found');

    const teams = await this.teamRepo.find({ where: { projectId: sprint.projectId }, order: { createdAt: 'ASC' } });
    const combined = await this.burndown(sprintId);

    const series = await Promise.all(
      teams.map(async (t) => {
        const b = await this.burndown(sprintId, t.id);
        return {
          teamId: t.id,
          name: t.name,
          managerName: t.managerName,
          unit: b.unit,
          total: b.total,
          actual: b.actual,
          ideal: b.ideal,
          currentRemaining: b.currentRemaining,
          variance: b.variance,
          itemsTotal: b.itemsTotal,
          itemsClosed: b.itemsClosed,
          itemsActive: b.itemsActive,
          hoursLogged: b.hoursLogged,
          progress: b.itemsTotal ? Math.round((b.itemsClosed / b.itemsTotal) * 100) : 0,
        };
      }),
    );

    return {
      sprint,
      labels: combined.labels,
      daysTotal: combined.daysTotal,
      daysElapsed: combined.daysElapsed,
      daysLeft: combined.daysLeft,
      combined: {
        unit: combined.unit,
        total: combined.total,
        ideal: combined.ideal,
        actual: combined.actual,
        currentRemaining: combined.currentRemaining,
        variance: combined.variance,
        itemsTotal: combined.itemsTotal,
        itemsClosed: combined.itemsClosed,
        progress: combined.itemsTotal ? Math.round((combined.itemsClosed / combined.itemsTotal) * 100) : 0,
      },
      // Teams with nothing in this sprint are dropped — an empty flat line adds noise.
      teams: series.filter((s) => s.itemsTotal > 0),
      teamsWithoutWork: series.filter((s) => s.itemsTotal === 0).map((s) => ({ teamId: s.teamId, name: s.name })),
    };
  }

  /** Sprint list for a project, each with its own completion rollup. */
  async findByProject(projectId: string) {
    const sprints = await this.sprintRepo.find({ where: { projectId }, order: { startDate: 'ASC' } });
    if (!sprints.length) return [];
    const items = await this.itemRepo.find({ where: { projectId } });
    return sprints.map((s) => {
      const own = items.filter((i) => i.sprintId === s.id && i.state !== WorkItemState.REMOVED);
      const closed = own.filter((i) => i.state === WorkItemState.CLOSED);
      return {
        ...s,
        itemsTotal: own.length,
        itemsClosed: closed.length,
        itemsActive: own.filter((i) => i.state === WorkItemState.ACTIVE).length,
        pointsTotal: round1(own.reduce((a, i) => a + (i.storyPoints || 0), 0)),
        pointsClosed: round1(closed.reduce((a, i) => a + (i.storyPoints || 0), 0)),
        estimated: round1(own.reduce((a, i) => a + (i.originalEstimate || 0), 0)),
        remaining: round1(own.reduce((a, i) => a + (i.remainingWork || 0), 0)),
        completed: round1(own.reduce((a, i) => a + (i.completedWork || 0), 0)),
        progress: own.length ? Math.round((closed.length / own.length) * 100) : 0,
      };
    });
  }

  async create(projectId: string, dto: CreateSprintDto, actor?: { id?: string; name?: string }) {
    const project = await this.projectRepo.findOne({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Project not found');
    const sprint = this.sprintRepo.create({
      ...dto,
      projectId,
      startDate: new Date(dto.startDate),
      endDate: new Date(dto.endDate),
      status: dto.status ?? this.statusFor(new Date(dto.startDate), new Date(dto.endDate)),
      createdById: actor?.id,
      createdByName: actor?.name,
    });
    const saved = await this.sprintRepo.save(sprint);
    // Only one sprint can be "current" per project — demote any other.
    if (saved.status === SprintStatus.CURRENT) await this.demoteOthers(projectId, saved.id);
    return saved;
  }

  async update(id: string, dto: UpdateSprintDto) {
    const sprint = await this.sprintRepo.findOne({ where: { id } });
    if (!sprint) throw new NotFoundException('Sprint not found');
    Object.assign(sprint, {
      ...dto,
      startDate: dto.startDate ? new Date(dto.startDate) : sprint.startDate,
      endDate: dto.endDate ? new Date(dto.endDate) : sprint.endDate,
    });
    const saved = await this.sprintRepo.save(sprint);
    if (saved.status === SprintStatus.CURRENT) await this.demoteOthers(saved.projectId, saved.id);
    return saved;
  }

  async remove(id: string) {
    const sprint = await this.sprintRepo.findOne({ where: { id } });
    if (!sprint) throw new NotFoundException('Sprint not found');
    // Items move back to the backlog rather than disappearing with the sprint.
    await this.itemRepo.update({ sprintId: id }, { sprintId: null as any });
    await this.sprintRepo.delete({ id });
    return { success: true };
  }

  private statusFor(start: Date, end: Date): SprintStatus {
    const now = startOfDay(new Date()).getTime();
    if (now < startOfDay(start).getTime()) return SprintStatus.FUTURE;
    if (now > startOfDay(end).getTime()) return SprintStatus.COMPLETED;
    return SprintStatus.CURRENT;
  }

  private async demoteOthers(projectId: string, keepId: string) {
    const others = await this.sprintRepo.find({ where: { projectId, status: SprintStatus.CURRENT } });
    for (const s of others) {
      if (s.id === keepId) continue;
      s.status = startOfDay(s.endDate).getTime() < startOfDay(new Date()).getTime() ? SprintStatus.COMPLETED : SprintStatus.FUTURE;
      await this.sprintRepo.save(s);
    }
  }

  /**
   * Sprint burndown. There are no nightly snapshots in the schema, so the actual
   * line is reconstructed from the work items themselves: an item contributes
   * its effort to a given day when it already existed that day and had not yet
   * been closed. That yields a truthful curve from real close timestamps, and it
   * stops at today (the future is left blank rather than faked).
   */
  async burndown(id: string, teamId?: string) {
    const sprint = await this.sprintRepo.findOne({ where: { id } });
    if (!sprint) throw new NotFoundException('Sprint not found');

    // `teamId` narrows the curve to one squad — that's the per-team sprint graph.
    const where = teamId ? { sprintId: id, teamId } : { sprintId: id };
    const items = (await this.itemRepo.find({ where })).filter((i) => i.state !== WorkItemState.REMOVED);
    const logs = await this.logRepo.find({ where: { projectId: sprint.projectId } });
    const sprintItemIds = new Set(items.map((i) => i.id));
    const sprintLogs = logs.filter((l) => sprintItemIds.has(l.workItemId));

    // Effort basis: hours when the team estimates in hours, else story points,
    // else a flat 1 per item so the chart still means something.
    const hours = items.reduce((s, i) => s + (i.originalEstimate || 0), 0);
    const points = items.reduce((s, i) => s + (i.storyPoints || 0), 0);
    const unit: 'hours' | 'points' | 'items' = hours > 0 ? 'hours' : points > 0 ? 'points' : 'items';
    const effortOf = (i: WorkItem) => (unit === 'hours' ? i.originalEstimate || 0 : unit === 'points' ? i.storyPoints || 0 : 1);

    const start = startOfDay(sprint.startDate);
    const end = startOfDay(sprint.endDate);
    const totalDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / DAY_MS) + 1);
    const today = startOfDay(new Date());
    const total = round1(items.reduce((s, i) => s + effortOf(i), 0));

    // The day an item entered the sprint: the earliest timestamp recorded against
    // it. Normally that is createdAt, but a back-dated activation/closure (data
    // import, seeded history) proves it existed earlier — an item can't be closed
    // before it existed, so taking the minimum keeps the curve honest either way.
    const entryOf = (i: WorkItem) => {
      const stamps = [i.createdAt, i.startDate, i.activatedAt, i.resolvedAt, i.closedAt]
        .filter(Boolean)
        .map((d) => new Date(d).getTime());
      return stamps.length ? Math.min(...stamps) : 0;
    };

    const labels: string[] = [];
    const ideal: number[] = [];
    const actual: (number | null)[] = [];
    const loggedPerDay: number[] = [];

    for (let d = 0; d < totalDays; d++) {
      const day = new Date(start.getTime() + d * DAY_MS);
      const cut = endOfDay(day);
      labels.push(`${day.getDate()}/${day.getMonth() + 1}`);
      ideal.push(round1(total * (1 - d / Math.max(1, totalDays - 1))));

      if (day.getTime() <= today.getTime()) {
        const remaining = items
          .filter((i) => entryOf(i) <= cut.getTime())
          .filter((i) => !(i.closedAt && new Date(i.closedAt).getTime() <= cut.getTime()))
          .reduce((s, i) => s + effortOf(i), 0);
        actual.push(round1(remaining));
        loggedPerDay.push(
          round1(sprintLogs.filter((l) => startOfDay(l.date).getTime() === day.getTime()).reduce((s, l) => s + (l.hours || 0), 0)),
        );
      } else {
        actual.push(null);
        loggedPerDay.push(0);
      }
    }

    const closed = items.filter((i) => i.state === WorkItemState.CLOSED);
    const elapsed = Math.min(totalDays, Math.max(0, Math.round((today.getTime() - start.getTime()) / DAY_MS) + 1));
    const liveActual = actual.filter((v): v is number => v !== null);
    const currentRemaining = liveActual.length ? liveActual[liveActual.length - 1] : total;
    const expected = ideal[Math.max(0, Math.min(ideal.length - 1, elapsed - 1))] ?? 0;

    return {
      sprint,
      unit,
      labels,
      ideal,
      actual,
      loggedPerDay,
      total,
      currentRemaining,
      // Positive = ahead of the ideal line, negative = behind.
      variance: round1(expected - currentRemaining),
      daysTotal: totalDays,
      daysElapsed: elapsed,
      daysLeft: Math.max(0, totalDays - elapsed),
      itemsTotal: items.length,
      itemsClosed: closed.length,
      itemsActive: items.filter((i) => i.state === WorkItemState.ACTIVE).length,
      itemsNew: items.filter((i) => i.state === WorkItemState.NEW).length,
      itemsResolved: items.filter((i) => i.state === WorkItemState.RESOLVED).length,
      pointsTotal: round1(items.reduce((s, i) => s + (i.storyPoints || 0), 0)),
      pointsClosed: round1(closed.reduce((s, i) => s + (i.storyPoints || 0), 0)),
      hoursLogged: round1(sprintLogs.reduce((s, l) => s + (l.hours || 0), 0)),
      estimated: round1(items.reduce((s, i) => s + (i.originalEstimate || 0), 0)),
      completed: round1(items.reduce((s, i) => s + (i.completedWork || 0), 0)),
      remaining: round1(items.reduce((s, i) => s + (i.remainingWork || 0), 0)),
    };
  }
}
