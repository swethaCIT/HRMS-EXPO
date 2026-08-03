/**
 * Unit tests for the board logic that is easy to get subtly wrong: the sprint
 * burndown curve, the backlog roll-up, state-transition side effects and the
 * hierarchy rules. Repositories are mocked, so these run without a database.
 */
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { FindOperator } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Project } from './entities/project.entity';
import { ProjectTeam, ProjectTeamMember } from './entities/project-team.entity';
import { Sprint, SprintStatus } from './entities/sprint.entity';
import { WorkItem, WorkItemState, WorkItemType } from './entities/work-item.entity';
import { WorkLog } from './entities/work-log.entity';
import { Employee } from '../employees/entities/employee.entity';
import { ProjectsService } from './projects.service';
import { SprintsService } from './sprints.service';
import { WorkItemsService } from './work-items.service';
import { ReportsService } from './reports.service';
import { NotificationsService } from '../notifications/notifications.service';
import { MailService } from '../mail/mail.service';

const DAY = 86_400_000;
const day = (offset: number) => new Date(Date.now() + offset * DAY);
const iso = (offset: number) => day(offset).toISOString().slice(0, 10);

/** Minimal in-memory stand-in for a TypeORM repository. */
function repo(rows: any[] = []) {
  const matches = (row: any, where: any): boolean =>
    Object.entries(where ?? {}).every(([k, v]) => {
      // `In([...])` and friends arrive as FindOperator instances.
      if (v instanceof FindOperator) return ([] as any[]).concat((v as any).value).includes(row[k]);
      if (v && typeof v === 'object' && 'id' in (v as any)) return row[k]?.id === (v as any).id;
      return row[k] === v;
    });
  return {
    rows,
    find: jest.fn(async (opts: any = {}) => rows.filter((r) => matches(r, opts.where))),
    findOne: jest.fn(async (opts: any = {}) => rows.find((r) => matches(r, opts.where)) ?? null),
    count: jest.fn(async (opts: any = {}) => rows.filter((r) => matches(r, opts.where)).length),
    create: jest.fn((data: any) => ({ ...data })),
    save: jest.fn(async (data: any) => {
      const list = Array.isArray(data) ? data : [data];
      for (const entity of list) {
        if (!entity.id) entity.id = `id-${rows.length + 1}`;
        if (!entity.createdAt) entity.createdAt = new Date();
        if (!rows.includes(entity)) rows.push(entity);
      }
      return data;
    }),
    update: jest.fn(async () => ({ affected: 1 })),
    delete: jest.fn(async () => ({ affected: 1 })),
  };
}

const item = (over: Partial<WorkItem> = {}): any => ({
  id: 'wi',
  seq: 1,
  projectId: 'p1',
  sprintId: 's1',
  teamId: 't1',
  parentId: null,
  type: WorkItemType.TASK,
  title: 'Task',
  state: WorkItemState.NEW,
  priority: 2,
  storyPoints: 0,
  originalEstimate: 0,
  remainingWork: 0,
  completedWork: 0,
  createdAt: day(-10),
  ...over,
});

async function build(rows: {
  projects?: any[]; teams?: any[]; members?: any[]; sprints?: any[]; items?: any[]; logs?: any[]; employees?: any[];
}) {
  const repos = {
    projects: repo(rows.projects ?? []),
    teams: repo(rows.teams ?? []),
    members: repo(rows.members ?? []),
    sprints: repo(rows.sprints ?? []),
    items: repo(rows.items ?? []),
    logs: repo(rows.logs ?? []),
    employees: repo(rows.employees ?? []),
  };
  const moduleRef = await Test.createTestingModule({
    providers: [
      ProjectsService, SprintsService, WorkItemsService, ReportsService,
      { provide: getRepositoryToken(Project), useValue: repos.projects },
      { provide: getRepositoryToken(ProjectTeam), useValue: repos.teams },
      { provide: getRepositoryToken(ProjectTeamMember), useValue: repos.members },
      { provide: getRepositoryToken(Sprint), useValue: repos.sprints },
      { provide: getRepositoryToken(WorkItem), useValue: repos.items },
      { provide: getRepositoryToken(WorkLog), useValue: repos.logs },
      { provide: getRepositoryToken(Employee), useValue: repos.employees },
      { provide: NotificationsService, useValue: { createForUser: jest.fn(), sendToDevice: jest.fn(), sendToMultiple: jest.fn() } },
      { provide: MailService, useValue: { send: jest.fn() } },
      { provide: CACHE_MANAGER, useValue: { get: jest.fn(), set: jest.fn(), del: jest.fn() } },
    ],
  }).compile();

  return {
    repos,
    projects: moduleRef.get(ProjectsService),
    sprints: moduleRef.get(SprintsService),
    items: moduleRef.get(WorkItemsService),
    reports: moduleRef.get(ReportsService),
  };
}

const SPRINT = {
  id: 's1', projectId: 'p1', name: 'Sprint 1', startDate: iso(-6), endDate: iso(7), status: SprintStatus.CURRENT,
};

describe('SprintsService.burndown', () => {
  it('burns down as items close, and leaves the future blank', async () => {
    const { sprints } = await build({
      sprints: [SPRINT],
      items: [
        item({ id: 'a', originalEstimate: 10, state: WorkItemState.CLOSED, closedAt: day(-4), remainingWork: 0 }),
        item({ id: 'b', originalEstimate: 10, state: WorkItemState.CLOSED, closedAt: day(-2), remainingWork: 0 }),
        item({ id: 'c', originalEstimate: 10, state: WorkItemState.ACTIVE, remainingWork: 10 }),
      ],
    });

    const burn = await sprints.burndown('s1');

    expect(burn.unit).toBe('hours');
    expect(burn.total).toBe(30);
    expect(burn.daysTotal).toBe(14);
    // Ideal line runs from the full commitment down to zero.
    expect(burn.ideal[0]).toBe(30);
    expect(burn.ideal[burn.ideal.length - 1]).toBe(0);
    // Actual starts full, drops as each item closes, and is null after today.
    expect(burn.actual[0]).toBe(30);
    expect(burn.actual[burn.actual.length - 1]).toBeNull();
    expect(burn.currentRemaining).toBe(10);
    expect(burn.itemsClosed).toBe(2);
    // 7 of 14 days elapsed, so ~15h should remain — being at 10h is ahead.
    expect(burn.variance).toBeGreaterThan(0);
  });

  it('falls back to story points, then to a per-item count, when hours are absent', async () => {
    const points = await build({
      sprints: [SPRINT],
      items: [item({ id: 'a', storyPoints: 5 }), item({ id: 'b', storyPoints: 3 })],
    });
    expect((await points.sprints.burndown('s1')).unit).toBe('points');

    const bare = await build({ sprints: [SPRINT], items: [item({ id: 'a' }), item({ id: 'b' })] });
    const burn = await bare.sprints.burndown('s1');
    expect(burn.unit).toBe('items');
    expect(burn.total).toBe(2);
  });

  it('excludes removed items and scopes to a team when asked', async () => {
    const { sprints } = await build({
      sprints: [SPRINT],
      items: [
        item({ id: 'a', teamId: 't1', originalEstimate: 8 }),
        item({ id: 'b', teamId: 't2', originalEstimate: 8 }),
        item({ id: 'c', teamId: 't1', originalEstimate: 8, state: WorkItemState.REMOVED }),
      ],
    });

    expect((await sprints.burndown('s1')).total).toBe(16);
    expect((await sprints.burndown('s1', 't1')).total).toBe(8);
  });
});

describe('WorkItemsService', () => {
  it('rolls effort and completion up the epic → feature → story → task tree', async () => {
    const { items } = await build({
      items: [
        item({ id: 'epic', seq: 1, type: WorkItemType.EPIC, parentId: null }),
        item({ id: 'feat', seq: 2, type: WorkItemType.FEATURE, parentId: 'epic' }),
        item({ id: 'story', seq: 3, type: WorkItemType.USER_STORY, parentId: 'feat', storyPoints: 5 }),
        item({ id: 'task1', seq: 4, parentId: 'story', originalEstimate: 8, completedWork: 8, remainingWork: 0, state: WorkItemState.CLOSED }),
        item({ id: 'task2', seq: 5, parentId: 'story', originalEstimate: 4, completedWork: 1, remainingWork: 3 }),
      ],
    });

    const tree = await items.tree('p1');
    expect(tree).toHaveLength(1);

    const epic = tree[0];
    expect(epic.id).toBe('epic');
    expect(epic.rollup.total).toBe(5);   // itself + 4 descendants
    expect(epic.rollup.closed).toBe(1);
    expect(epic.rollup.estimated).toBe(12);
    expect(epic.rollup.completed).toBe(9);
    expect(epic.rollup.remaining).toBe(3);
    expect(epic.rollup.points).toBe(5);
    expect(epic.children[0].children[0].children).toHaveLength(2);
  });

  it('rejects an illegal parent/child pairing', async () => {
    const { items } = await build({
      projects: [{ id: 'p1', key: 'ATLAS', name: 'Atlas' }],
      items: [item({ id: 'task', type: WorkItemType.TASK })],
    });

    await expect(
      items.create({ projectId: 'p1', type: WorkItemType.EPIC, title: 'Nope', parentId: 'task' } as any),
    ).rejects.toThrow(/cannot contain/i);
  });

  it('seeds remaining work from the estimate and numbers items per project', async () => {
    const { items } = await build({
      projects: [{ id: 'p1', key: 'ATLAS', name: 'Atlas' }],
      items: [item({ id: 'existing', seq: 7 })],
    });

    const created: any = await items.create({
      projectId: 'p1', type: WorkItemType.TASK, title: 'New task', originalEstimate: 6,
    } as any);

    expect(created.seq).toBe(8);
    expect(created.remainingWork).toBe(6);
    expect(created.completedWork).toBe(0);
    expect(created.state).toBe(WorkItemState.NEW);
  });

  it('stamps timestamps and zeroes remaining work when an item closes', async () => {
    const { items } = await build({
      projects: [{ id: 'p1', key: 'ATLAS', name: 'Atlas' }],
      items: [item({ id: 'wi', originalEstimate: 8, remainingWork: 8, state: WorkItemState.NEW })],
    });

    const closed: any = await items.setState('wi', { state: WorkItemState.CLOSED } as any);
    expect(closed.closedAt).toBeInstanceOf(Date);
    expect(closed.activatedAt).toBeInstanceOf(Date);
    expect(closed.remainingWork).toBe(0);

    // Re-opening clears the finish stamps and restores the outstanding work.
    const reopened: any = await items.setState('wi', { state: WorkItemState.ACTIVE } as any);
    expect(reopened.closedAt).toBeNull();
    expect(reopened.remainingWork).toBe(8);
  });

  it('logging work moves a new item to active and shifts remaining into completed', async () => {
    const { items, repos } = await build({
      projects: [{ id: 'p1', key: 'ATLAS', name: 'Atlas' }],
      items: [item({ id: 'wi', originalEstimate: 8, remainingWork: 8, assigneeId: 'e1' })],
    });

    const { item: updated } = await items.logWork('wi', { hours: 3 } as any, { employeeId: 'e1', name: 'Rahul' });

    expect(updated.completedWork).toBe(3);
    expect(updated.remainingWork).toBe(5);
    expect(updated.state).toBe(WorkItemState.ACTIVE);
    expect(repos.logs.rows).toHaveLength(1);
    expect(repos.logs.rows[0].hours).toBe(3);
  });
});

describe('ReportsService', () => {
  it('reports project health, effort and per-person contribution', async () => {
    const { reports } = await build({
      projects: [{ id: 'p1', key: 'ATLAS', name: 'Atlas' }],
      teams: [{ id: 't1', projectId: 'p1', name: 'Core', managerName: 'Arjun' }],
      members: [{ id: 'm1', teamId: 't1', projectId: 'p1', employeeId: 'e1', name: 'Rahul', role: 'Developer' }],
      sprints: [SPRINT],
      items: [
        item({
          id: 'a', assigneeId: 'e1', assigneeName: 'Rahul', originalEstimate: 10, completedWork: 10, remainingWork: 0,
          state: WorkItemState.CLOSED, activatedAt: day(-5), closedAt: day(-3), targetDate: iso(-2), storyPoints: 5,
        }),
        item({ id: 'b', assigneeId: 'e1', assigneeName: 'Rahul', originalEstimate: 6, completedWork: 2, remainingWork: 4, state: WorkItemState.ACTIVE }),
        item({ id: 'c', type: WorkItemType.BUG, state: WorkItemState.NEW, originalEstimate: 2, remainingWork: 2 }),
        item({ id: 'd', state: WorkItemState.REMOVED, originalEstimate: 99, remainingWork: 99 }),
      ],
      logs: [
        { id: 'l1', workItemId: 'a', projectId: 'p1', employeeId: 'e1', employeeName: 'Rahul', hours: 6, date: day(-4) },
        { id: 'l2', workItemId: 'b', projectId: 'p1', employeeId: 'e1', employeeName: 'Rahul', hours: 2, date: day(-1) },
      ],
    });

    const report = await reports.projectReport('p1');
    // The removed item is excluded from every total.
    expect(report.summary.itemsTotal).toBe(3);
    expect(report.summary.removed).toBe(1);
    expect(report.summary.closed).toBe(1);
    expect(report.summary.progress).toBe(33);
    expect(report.summary.bugsOpen).toBe(1);
    expect(report.summary.onTimePct).toBe(100);   // closed 3 days ago, due 2 days ago
    expect(report.summary.avgCycleDays).toBe(2);
    expect(report.effort).toMatchObject({ estimated: 18, completed: 12, remaining: 6, logged: 8 });
    expect(report.weeklyEffort).toHaveLength(8);
    expect(report.byTeam[0]).toMatchObject({ name: 'Core', itemsTotal: 3, itemsClosed: 1 });

    const { members } = await reports.memberReports('p1');
    const rahul = members.find((m) => m.employeeId === 'e1')!;
    expect(rahul).toMatchObject({
      name: 'Rahul', assigned: 2, closed: 1, active: 1, hoursLogged: 8,
      effortSharePct: 100, completionPct: 50, storyPoints: 5,
    });
    expect(rahul.daysEngaged).toBe(2);
    expect(rahul.avgHoursPerDay).toBe(4);
  });
});

describe('ProjectsService', () => {
  it('derives a project key from the name and de-duplicates a clash', async () => {
    const { projects, repos } = await build({ projects: [] });

    const first: any = await projects.create({ name: 'Atlas Payments Platform' } as any);
    expect(first.key).toBe('APP');

    // A second project with the same initials gets a numeric suffix.
    const second: any = await projects.create({ name: 'Atlas Payments Platform' } as any);
    expect(second.key).toBe('APP2');
    expect(repos.projects.rows).toHaveLength(2);
  });

  it('rolls project cards up without an N+1 query per project', async () => {
    const { projects, repos } = await build({
      projects: [{ id: 'p1', key: 'ATLAS', name: 'Atlas', status: 'active', createdAt: new Date() }],
      teams: [{ id: 't1', projectId: 'p1', name: 'Core' }],
      members: [{ id: 'm1', projectId: 'p1', teamId: 't1', employeeId: 'e1', name: 'Rahul' }],
      sprints: [SPRINT],
      items: [
        item({ id: 'a', state: WorkItemState.CLOSED }),
        item({ id: 'b', state: WorkItemState.ACTIVE }),
        item({ id: 'c', state: WorkItemState.REMOVED }),
      ],
    });

    const list: any[] = await projects.findAll();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ itemsTotal: 2, itemsClosed: 1, itemsActive: 1, progress: 50, teamCount: 1, memberCount: 1 });
    expect(list[0].currentSprint).toMatchObject({ name: 'Sprint 1' });
    // One grouped query per table, regardless of how many projects there are.
    expect(repos.items.find).toHaveBeenCalledTimes(1);
    expect(repos.teams.find).toHaveBeenCalledTimes(1);
  });
});
