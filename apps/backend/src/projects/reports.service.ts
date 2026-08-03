import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from './entities/project.entity';
import { ProjectTeam, ProjectTeamMember } from './entities/project-team.entity';
import { Sprint, SprintStatus } from './entities/sprint.entity';
import { WorkItem, WorkItemState, WorkItemType } from './entities/work-item.entity';
import { WorkLog } from './entities/work-log.entity';
import { round1 } from './util';

const DAY_MS = 86_400_000;
const startOfDay = (d: Date | string) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Project) private readonly projectRepo: Repository<Project>,
    @InjectRepository(ProjectTeam) private readonly teamRepo: Repository<ProjectTeam>,
    @InjectRepository(ProjectTeamMember) private readonly memberRepo: Repository<ProjectTeamMember>,
    @InjectRepository(Sprint) private readonly sprintRepo: Repository<Sprint>,
    @InjectRepository(WorkItem) private readonly itemRepo: Repository<WorkItem>,
    @InjectRepository(WorkLog) private readonly logRepo: Repository<WorkLog>,
  ) {}

  /** Project-level analytics: state/type mix, effort, velocity and weekly effort. */
  async projectReport(projectId: string) {
    const project = await this.projectRepo.findOne({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Project not found');

    const [all, sprints, teams, logs] = await Promise.all([
      this.itemRepo.find({ where: { projectId } }),
      this.sprintRepo.find({ where: { projectId }, order: { startDate: 'ASC' } }),
      this.teamRepo.find({ where: { projectId } }),
      this.logRepo.find({ where: { projectId } }),
    ]);
    const items = all.filter((i) => i.state !== WorkItemState.REMOVED);

    const today = startOfDay(new Date());
    const countState = (s: WorkItemState) => items.filter((i) => i.state === s).length;
    const closed = items.filter((i) => i.state === WorkItemState.CLOSED);

    // Cycle time = activated → closed, averaged over everything that finished.
    const cycles = closed
      .filter((i) => i.activatedAt && i.closedAt)
      .map((i) => (new Date(i.closedAt).getTime() - new Date(i.activatedAt).getTime()) / DAY_MS);
    const avgCycleDays = cycles.length ? round1(cycles.reduce((s, v) => s + v, 0) / cycles.length) : 0;

    // On time = closed on or before its target date (items without one are ignored).
    const withTarget = closed.filter((i) => i.targetDate);
    const onTime = withTarget.filter((i) => new Date(i.closedAt) <= new Date(new Date(i.targetDate).getTime() + DAY_MS - 1));

    // Effort logged per week for the last 8 weeks (Monday-anchored).
    const weeks: { label: string; hours: number }[] = [];
    const monday = startOfDay(new Date());
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    for (let w = 7; w >= 0; w--) {
      const from = new Date(monday.getTime() - w * 7 * DAY_MS);
      const to = new Date(from.getTime() + 7 * DAY_MS);
      const hours = logs
        .filter((l) => {
          const t = startOfDay(l.date).getTime();
          return t >= from.getTime() && t < to.getTime();
        })
        .reduce((s, l) => s + (l.hours || 0), 0);
      weeks.push({ label: `${from.getDate()}/${from.getMonth() + 1}`, hours: round1(hours) });
    }

    return {
      project,
      generatedAt: new Date().toISOString(),
      summary: {
        itemsTotal: items.length,
        closed: closed.length,
        active: countState(WorkItemState.ACTIVE),
        resolved: countState(WorkItemState.RESOLVED),
        new: countState(WorkItemState.NEW),
        removed: all.length - items.length,
        progress: items.length ? Math.round((closed.length / items.length) * 100) : 0,
        overdue: items.filter((i) => i.targetDate && startOfDay(i.targetDate) < today && i.state !== WorkItemState.CLOSED).length,
        bugsOpen: items.filter((i) => i.type === WorkItemType.BUG && i.state !== WorkItemState.CLOSED).length,
        avgCycleDays,
        onTimePct: withTarget.length ? Math.round((onTime.length / withTarget.length) * 100) : 0,
        contributors: new Set(logs.map((l) => l.employeeId)).size,
      },
      effort: {
        estimated: round1(items.reduce((s, i) => s + (i.originalEstimate || 0), 0)),
        completed: round1(items.reduce((s, i) => s + (i.completedWork || 0), 0)),
        remaining: round1(items.reduce((s, i) => s + (i.remainingWork || 0), 0)),
        logged: round1(logs.reduce((s, l) => s + (l.hours || 0), 0)),
        pointsTotal: round1(items.reduce((s, i) => s + (i.storyPoints || 0), 0)),
        pointsClosed: round1(closed.reduce((s, i) => s + (i.storyPoints || 0), 0)),
      },
      byState: [WorkItemState.NEW, WorkItemState.ACTIVE, WorkItemState.RESOLVED, WorkItemState.CLOSED].map((state) => ({
        state,
        count: countState(state),
      })),
      byType: [WorkItemType.EPIC, WorkItemType.FEATURE, WorkItemType.USER_STORY, WorkItemType.TASK, WorkItemType.BUG].map(
        (type) => {
          const own = items.filter((i) => i.type === type);
          return {
            type,
            count: own.length,
            closed: own.filter((i) => i.state === WorkItemState.CLOSED).length,
          };
        },
      ),
      byPriority: [1, 2, 3, 4].map((priority) => ({
        priority,
        count: items.filter((i) => i.priority === priority).length,
        open: items.filter((i) => i.priority === priority && i.state !== WorkItemState.CLOSED).length,
      })),
      velocity: sprints
        .filter((s) => s.status !== SprintStatus.FUTURE)
        .map((s) => {
          const own = items.filter((i) => i.sprintId === s.id);
          const done = own.filter((i) => i.state === WorkItemState.CLOSED);
          return {
            sprintId: s.id,
            name: s.name,
            status: s.status,
            committed: round1(own.reduce((a, i) => a + (i.storyPoints || 0), 0)) || own.length,
            completed: round1(done.reduce((a, i) => a + (i.storyPoints || 0), 0)) || done.length,
            itemsTotal: own.length,
            itemsClosed: done.length,
          };
        }),
      weeklyEffort: weeks,
      byTeam: teams.map((t) => {
        const own = items.filter((i) => i.teamId === t.id);
        const done = own.filter((i) => i.state === WorkItemState.CLOSED);
        const teamItemIds = new Set(own.map((i) => i.id));
        return {
          teamId: t.id,
          name: t.name,
          managerName: t.managerName,
          itemsTotal: own.length,
          itemsClosed: done.length,
          progress: own.length ? Math.round((done.length / own.length) * 100) : 0,
          hoursLogged: round1(logs.filter((l) => teamItemIds.has(l.workItemId)).reduce((s, l) => s + (l.hours || 0), 0)),
          remaining: round1(own.reduce((s, i) => s + (i.remainingWork || 0), 0)),
        };
      }),
    };
  }

  /**
   * Per-person report — assigned vs closed, hours logged, estimate accuracy and
   * how quickly they finish. Covers both squad members and anyone assigned work
   * without being on a roster.
   */
  async memberReports(projectId: string) {
    const project = await this.projectRepo.findOne({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Project not found');

    const [items, logs, members, teams] = await Promise.all([
      this.itemRepo.find({ where: { projectId } }),
      this.logRepo.find({ where: { projectId } }),
      this.memberRepo.find({ where: { projectId } }),
      this.teamRepo.find({ where: { projectId } }),
    ]);
    const live = items.filter((i) => i.state !== WorkItemState.REMOVED);
    const teamName = new Map(teams.map((t) => [t.id, t.name]));

    // Union of roster members, assignees and anyone who logged time.
    const people = new Map<string, { employeeId: string; name: string; role?: string; teamName?: string }>();
    for (const m of members) {
      people.set(m.employeeId, { employeeId: m.employeeId, name: m.name, role: m.role, teamName: teamName.get(m.teamId) });
    }
    for (const i of live) {
      if (i.assigneeId && !people.has(i.assigneeId)) {
        people.set(i.assigneeId, { employeeId: i.assigneeId, name: i.assigneeName || 'Unassigned', teamName: teamName.get(i.teamId) });
      }
    }
    for (const l of logs) {
      if (!people.has(l.employeeId)) people.set(l.employeeId, { employeeId: l.employeeId, name: l.employeeName || 'Contributor' });
    }

    const totalHours = logs.reduce((s, l) => s + (l.hours || 0), 0) || 1;
    const today = startOfDay(new Date());

    const rows = [...people.values()].map((p) => {
      const mine = live.filter((i) => i.assigneeId === p.employeeId);
      const done = mine.filter((i) => i.state === WorkItemState.CLOSED);
      const myLogs = logs.filter((l) => l.employeeId === p.employeeId);
      const hours = myLogs.reduce((s, l) => s + (l.hours || 0), 0);
      const estimated = mine.reduce((s, i) => s + (i.originalEstimate || 0), 0);
      const actual = mine.reduce((s, i) => s + (i.completedWork || 0), 0);
      const cycles = done
        .filter((i) => i.activatedAt && i.closedAt)
        .map((i) => (new Date(i.closedAt).getTime() - new Date(i.activatedAt).getTime()) / DAY_MS);
      const withTarget = done.filter((i) => i.targetDate);
      const onTime = withTarget.filter((i) => new Date(i.closedAt) <= new Date(new Date(i.targetDate).getTime() + DAY_MS - 1));
      const days = new Set(myLogs.map((l) => startOfDay(l.date).getTime())).size;

      return {
        ...p,
        assigned: mine.length,
        new: mine.filter((i) => i.state === WorkItemState.NEW).length,
        active: mine.filter((i) => i.state === WorkItemState.ACTIVE).length,
        resolved: mine.filter((i) => i.state === WorkItemState.RESOLVED).length,
        closed: done.length,
        overdue: mine.filter((i) => i.targetDate && startOfDay(i.targetDate) < today && i.state !== WorkItemState.CLOSED).length,
        bugs: mine.filter((i) => i.type === WorkItemType.BUG).length,
        storyPoints: round1(done.reduce((s, i) => s + (i.storyPoints || 0), 0)),
        estimated: round1(estimated),
        actual: round1(actual),
        remaining: round1(mine.reduce((s, i) => s + (i.remainingWork || 0), 0)),
        hoursLogged: round1(hours),
        daysEngaged: days,
        avgHoursPerDay: days ? round1(hours / days) : 0,
        /** Share of the project's total logged effort — "how much they put in". */
        effortSharePct: Math.round((hours / totalHours) * 100),
        completionPct: mine.length ? Math.round((done.length / mine.length) * 100) : 0,
        onTimePct: withTarget.length ? Math.round((onTime.length / withTarget.length) * 100) : 0,
        avgCycleDays: cycles.length ? round1(cycles.reduce((s, v) => s + v, 0) / cycles.length) : 0,
        /** >100% means it took longer than estimated. */
        estimateAccuracyPct: estimated ? Math.round((actual / estimated) * 100) : 0,
      };
    });

    rows.sort((a, b) => b.hoursLogged - a.hoursLogged || b.closed - a.closed);
    return { project, generatedAt: new Date().toISOString(), members: rows };
  }

  /** One person's timeline of logged effort across a project. */
  async memberDetail(projectId: string, employeeId: string) {
    const logs = await this.logRepo.find({ where: { projectId, employeeId }, order: { date: 'DESC' } });
    const items = await this.itemRepo.find({ where: { projectId, assigneeId: employeeId } });
    const itemById = new Map(items.map((i) => [i.id, i]));
    return {
      employeeId,
      hoursLogged: round1(logs.reduce((s, l) => s + (l.hours || 0), 0)),
      logs: logs.map((l) => ({ ...l, workItemTitle: itemById.get(l.workItemId)?.title })),
      items: items.filter((i) => i.state !== WorkItemState.REMOVED),
    };
  }
}
