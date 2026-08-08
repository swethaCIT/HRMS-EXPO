import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, In, Repository } from 'typeorm';
import { Project } from './entities/project.entity';
import { ALLOWED_CHILDREN, WorkItem, WorkItemState, WorkItemType } from './entities/work-item.entity';
import { WorkLog } from './entities/work-log.entity';
import { CreateWorkItemDto, LogWorkDto, SetStateDto, UpdateWorkItemDto } from './dto/project.dto';
import { round1 } from './util';
import { Employee } from '../employees/entities/employee.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/entities/notification.entity';
import { MailService } from '../mail/mail.service';
import { ActivityService } from './activity.service';
import { ActivityAction, ActivityEntity } from './entities/project-activity.entity';

export interface WorkItemFilter {
  projectId?: string;
  sprintId?: string;
  teamId?: string;
  assigneeId?: string;
  parentId?: string;
  type?: WorkItemType;
  state?: WorkItemState;
}

const TYPE_LABEL: Record<WorkItemType, string> = {
  [WorkItemType.EPIC]: 'Epic',
  [WorkItemType.FEATURE]: 'Feature',
  [WorkItemType.USER_STORY]: 'User Story',
  [WorkItemType.TASK]: 'Task',
  [WorkItemType.BUG]: 'Bug',
};

const STATE_LABEL: Record<WorkItemState, string> = {
  [WorkItemState.NEW]: 'New',
  [WorkItemState.ACTIVE]: 'Active',
  [WorkItemState.RESOLVED]: 'Resolved',
  [WorkItemState.CLOSED]: 'Closed',
  [WorkItemState.REMOVED]: 'Removed',
};

@Injectable()
export class WorkItemsService {
  private readonly logger = new Logger(WorkItemsService.name);

  constructor(
    @InjectRepository(WorkItem) private readonly itemRepo: Repository<WorkItem>,
    @InjectRepository(WorkLog) private readonly logRepo: Repository<WorkLog>,
    @InjectRepository(Project) private readonly projectRepo: Repository<Project>,
    @InjectRepository(Employee) private readonly employeeRepo: Repository<Employee>,
    private readonly notifications: NotificationsService,
    private readonly mail: MailService,
    private readonly activity: ActivityService,
  ) {}

  /* ── Reads ── */

  async findAll(filter: WorkItemFilter) {
    const where: FindOptionsWhere<WorkItem> = {};
    if (filter.projectId) where.projectId = filter.projectId;
    if (filter.sprintId) where.sprintId = filter.sprintId;
    if (filter.teamId) where.teamId = filter.teamId;
    if (filter.assigneeId) where.assigneeId = filter.assigneeId;
    if (filter.parentId) where.parentId = filter.parentId;
    if (filter.type) where.type = filter.type;
    if (filter.state) where.state = filter.state;
    return this.itemRepo.find({ where, order: { priority: 'ASC', seq: 'DESC' } });
  }

  /**
   * The backlog tree: Epic → Feature → User Story → Task/Bug, with each level's
   * effort and completion rolled up from its descendants (an epic's progress is
   * the progress of everything underneath it, exactly like Azure Boards).
   */
  async tree(projectId: string, sprintId?: string) {
    const items = (await this.itemRepo.find({ where: { projectId }, order: { seq: 'ASC' } })).filter(
      (i) => i.state !== WorkItemState.REMOVED,
    );
    const scope = sprintId ? items.filter((i) => i.sprintId === sprintId) : items;
    const inScope = new Set(scope.map((i) => i.id));

    // Keep ancestors of in-scope items so a sprint filter still shows its tree.
    const byId = new Map(items.map((i) => [i.id, i]));
    if (sprintId) {
      for (const i of scope) {
        let p = i.parentId ? byId.get(i.parentId) : undefined;
        while (p) {
          inScope.add(p.id);
          p = p.parentId ? byId.get(p.parentId) : undefined;
        }
      }
    }

    const visible = items.filter((i) => inScope.has(i.id));
    const childrenOf = (parentId: string | null) =>
      visible.filter((i) => (parentId === null ? !i.parentId || !byId.has(i.parentId) : i.parentId === parentId));

    const build = (item: WorkItem): any => {
      const kids = childrenOf(item.id).map(build);
      const selfClosed = item.state === WorkItemState.CLOSED ? 1 : 0;
      const totalCount = 1 + kids.reduce((s, k) => s + k.rollup.total, 0);
      const closedCount = selfClosed + kids.reduce((s, k) => s + k.rollup.closed, 0);
      return {
        ...item,
        children: kids,
        rollup: {
          total: totalCount,
          closed: closedCount,
          progress: Math.round((closedCount / totalCount) * 100),
          estimated: round1((item.originalEstimate || 0) + kids.reduce((s, k) => s + k.rollup.estimated, 0)),
          remaining: round1((item.remainingWork || 0) + kids.reduce((s, k) => s + k.rollup.remaining, 0)),
          completed: round1((item.completedWork || 0) + kids.reduce((s, k) => s + k.rollup.completed, 0)),
          points: round1((item.storyPoints || 0) + kids.reduce((s, k) => s + k.rollup.points, 0)),
        },
      };
    };

    return childrenOf(null).map(build);
  }

  async findOne(id: string) {
    const item = await this.itemRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException('Work item not found');
    const [project, parent, children, logs] = await Promise.all([
      this.projectRepo.findOne({ where: { id: item.projectId } }),
      item.parentId ? this.itemRepo.findOne({ where: { id: item.parentId } }) : Promise.resolve(null),
      this.itemRepo.find({ where: { parentId: id }, order: { seq: 'ASC' } }),
      this.logRepo.find({ where: { workItemId: id }, order: { date: 'DESC' } }),
    ]);
    return {
      ...item,
      ref: project ? `${project.key}-${item.seq}` : `#${item.seq}`,
      projectName: project?.name,
      projectKey: project?.key,
      parent: parent ? { id: parent.id, title: parent.title, type: parent.type, seq: parent.seq } : null,
      children: children.filter((c) => c.state !== WorkItemState.REMOVED),
      logs,
      hoursLogged: round1(logs.reduce((s, l) => s + (l.hours || 0), 0)),
      allowedChildTypes: ALLOWED_CHILDREN[item.type],
    };
  }

  /** Everything assigned to one person, across every project. */
  async findMine(employeeId: string) {
    const items = await this.itemRepo.find({
      where: { assigneeId: employeeId },
      order: { state: 'ASC', priority: 'ASC' },
    });
    const live = items.filter((i) => i.state !== WorkItemState.REMOVED);
    if (!live.length) return { items: [], stats: { total: 0, active: 0, closed: 0, remaining: 0 } };
    const projects = await this.projectRepo.find({ where: { id: In([...new Set(live.map((i) => i.projectId))]) } });
    const keyOf = new Map(projects.map((p) => [p.id, p]));
    return {
      items: live.map((i) => ({
        ...i,
        ref: `${keyOf.get(i.projectId)?.key ?? '#'}-${i.seq}`,
        projectName: keyOf.get(i.projectId)?.name,
      })),
      stats: {
        total: live.length,
        active: live.filter((i) => i.state === WorkItemState.ACTIVE).length,
        closed: live.filter((i) => i.state === WorkItemState.CLOSED).length,
        remaining: round1(live.reduce((s, i) => s + (i.remainingWork || 0), 0)),
      },
    };
  }

  /* ── Writes ── */

  /** Highest existing number in the project, plus one. */
  private async nextSeq(projectId: string): Promise<number> {
    const last = await this.itemRepo.findOne({ where: { projectId }, order: { seq: 'DESC' } });
    return (last?.seq ?? 0) + 1;
  }

  /**
   * Save, re-numbering if another create claimed the same seq first. The unique
   * (projectId, seq) constraint turns that race into a 23505 rather than two
   * items sharing a display ref; a handful of retries settles it.
   */
  private async saveWithSeqRetry(item: WorkItem, attempts = 5): Promise<WorkItem> {
    for (let i = 0; i < attempts; i++) {
      try {
        return await this.itemRepo.save(item);
      } catch (err: any) {
        const isDuplicateSeq = err?.code === '23505' && String(err?.detail ?? err?.message).includes('seq');
        if (!isDuplicateSeq || i === attempts - 1) throw err;
        item.seq = await this.nextSeq(item.projectId);
      }
    }
    // Unreachable: the loop either returns or rethrows.
    throw new BadRequestException('Could not allocate a work item number — please retry.');
  }

  async create(dto: CreateWorkItemDto, actor?: { id: string; name?: string }) {
    const project = await this.projectRepo.findOne({ where: { id: dto.projectId } });
    if (!project) throw new NotFoundException('Project not found');

    let parent: WorkItem | null = null;
    if (dto.parentId) {
      parent = await this.itemRepo.findOne({ where: { id: dto.parentId } });
      if (!parent) throw new NotFoundException('Parent work item not found');
      if (!ALLOWED_CHILDREN[parent.type].includes(dto.type)) {
        throw new BadRequestException(
          `A ${TYPE_LABEL[parent.type]} cannot contain a ${TYPE_LABEL[dto.type]}. Allowed: ${ALLOWED_CHILDREN[parent.type]
            .map((t) => TYPE_LABEL[t])
            .join(', ') || 'nothing'}`,
        );
      }
    }

    const estimate = dto.originalEstimate ?? 0;

    const item = this.itemRepo.create({
      ...dto,
      seq: await this.nextSeq(dto.projectId),
      // Inherit the parent's sprint/team unless the caller pinned its own.
      sprintId: dto.sprintId ?? parent?.sprintId ?? undefined,
      teamId: dto.teamId ?? parent?.teamId ?? undefined,
      state: dto.state ?? WorkItemState.NEW,
      priority: dto.priority ?? 2,
      originalEstimate: estimate,
      // Remaining starts at the estimate — that's what makes a burndown start full.
      remainingWork: dto.remainingWork ?? estimate,
      completedWork: 0,
      startDate: dto.startDate ? new Date(dto.startDate) : undefined,
      targetDate: dto.targetDate ? new Date(dto.targetDate) : undefined,
      createdById: actor?.id,
      createdByName: actor?.name,
      activatedAt: (dto.state ?? WorkItemState.NEW) === WorkItemState.ACTIVE ? new Date() : undefined,
    });

    const saved = await this.saveWithSeqRetry(item);

    await this.activity.record({
      projectId: saved.projectId,
      entityType: ActivityEntity.WORK_ITEM,
      entityId: saved.id,
      entityTitle: saved.title,
      action: ActivityAction.CREATED,
      actor,
      summary: `${actor?.name || 'Someone'} created this ${TYPE_LABEL[saved.type]}`,
    });
    if (saved.assigneeId) {
      await this.activity.record({
        projectId: saved.projectId,
        entityType: ActivityEntity.WORK_ITEM,
        entityId: saved.id,
        entityTitle: saved.title,
        action: ActivityAction.ASSIGNED,
        actor,
        changes: [{ field: 'Assigned to', from: null, to: saved.assigneeName ?? null }],
      });
      void this.notifyAssignee(saved, project.key, 'assigned', actor?.name);
    }
    return saved;
  }

  async update(id: string, dto: UpdateWorkItemDto, actor?: { id?: string; name?: string }) {
    const item = await this.itemRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException('Work item not found');

    if (dto.parentId && dto.parentId !== item.parentId) {
      if (dto.parentId === id) throw new BadRequestException('A work item cannot be its own parent');
      const parent = await this.itemRepo.findOne({ where: { id: dto.parentId } });
      if (!parent) throw new NotFoundException('Parent work item not found');
      const childType = dto.type ?? item.type;
      if (!ALLOWED_CHILDREN[parent.type].includes(childType)) {
        throw new BadRequestException(`A ${TYPE_LABEL[parent.type]} cannot contain a ${TYPE_LABEL[childType]}`);
      }
    }

    const previousAssignee = item.assigneeId;
    const previousState = item.state;
    // Snapshot before mutating so the history can show old → new per field.
    const before = { ...item };

    Object.assign(item, {
      ...dto,
      startDate: dto.startDate ? new Date(dto.startDate) : item.startDate,
      targetDate: dto.targetDate ? new Date(dto.targetDate) : item.targetDate,
      updatedById: actor?.id ?? item.updatedById,
      updatedByName: actor?.name ?? item.updatedByName,
    });
    if (dto.state && dto.state !== previousState) this.stampState(item, dto.state);

    const saved = await this.itemRepo.save(item);

    const changes = this.activity.diff(before, saved as any);
    if (changes.length) {
      await this.activity.record({
        projectId: saved.projectId,
        entityType: ActivityEntity.WORK_ITEM,
        entityId: saved.id,
        entityTitle: saved.title,
        action:
          saved.assigneeId !== previousAssignee
            ? ActivityAction.ASSIGNED
            : dto.state && dto.state !== previousState
              ? ActivityAction.STATE_CHANGED
              : ActivityAction.UPDATED,
        actor,
        changes,
      });
    }

    if (saved.assigneeId && saved.assigneeId !== previousAssignee) {
      const project = await this.projectRepo.findOne({ where: { id: saved.projectId } });
      void this.notifyAssignee(saved, project?.key ?? '', 'assigned', actor?.name);
    }
    return saved;
  }

  async setState(id: string, dto: SetStateDto, actor?: { id?: string; name?: string }) {
    const item = await this.itemRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException('Work item not found');
    if (item.state === dto.state) return item;
    const previousState = item.state;
    this.stampState(item, dto.state);
    if (dto.reason) item.reason = dto.reason;
    item.updatedById = actor?.id ?? item.updatedById;
    item.updatedByName = actor?.name ?? item.updatedByName;
    const saved = await this.itemRepo.save(item);

    await this.activity.record({
      projectId: saved.projectId,
      entityType: ActivityEntity.WORK_ITEM,
      entityId: saved.id,
      entityTitle: saved.title,
      action: ActivityAction.STATE_CHANGED,
      actor,
      changes: [{ field: 'State', from: previousState, to: dto.state }],
    });

    const project = await this.projectRepo.findOne({ where: { id: saved.projectId } });
    void this.notifyAssignee(saved, project?.key ?? '', 'state', actor?.name, previousState);
    return saved;
  }

  /**
   * Apply the state transition and its side effects:
   * Active stamps the start, Resolved/Closed stamp the finish, and closing
   * zeroes the remaining work so it drops out of the burndown.
   */
  private stampState(item: WorkItem, state: WorkItemState) {
    item.state = state;
    const now = new Date();
    if (state === WorkItemState.ACTIVE) {
      if (!item.activatedAt) item.activatedAt = now;
      item.resolvedAt = null as any;
      item.closedAt = null as any;
      if (!item.remainingWork && item.originalEstimate) item.remainingWork = item.originalEstimate;
    } else if (state === WorkItemState.RESOLVED) {
      if (!item.activatedAt) item.activatedAt = now;
      item.resolvedAt = now;
      item.closedAt = null as any;
    } else if (state === WorkItemState.CLOSED) {
      if (!item.activatedAt) item.activatedAt = now;
      if (!item.resolvedAt) item.resolvedAt = now;
      item.closedAt = now;
      item.remainingWork = 0;
    } else if (state === WorkItemState.NEW) {
      item.activatedAt = null as any;
      item.resolvedAt = null as any;
      item.closedAt = null as any;
    } else if (state === WorkItemState.REMOVED) {
      item.remainingWork = 0;
    }
  }

  /** Children are re-parented to this item's parent, never orphaned. */
  async remove(id: string, actor?: { id?: string; name?: string }) {
    const item = await this.itemRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException('Work item not found');
    await this.itemRepo.update({ parentId: id }, { parentId: (item.parentId ?? null) as any });
    await this.logRepo.delete({ workItemId: id });
    await this.itemRepo.delete({ id });
    // Recorded after the fact so the deletion still shows in the project feed
    // even though the item row is gone.
    await this.activity.record({
      projectId: item.projectId,
      entityType: ActivityEntity.WORK_ITEM,
      entityId: item.id,
      entityTitle: item.title,
      action: ActivityAction.DELETED,
      actor,
      summary: `${actor?.name || 'Someone'} deleted ${TYPE_LABEL[item.type]} "${item.title}"`,
    });
    return { success: true };
  }

  /* ── Time tracking ── */

  async logWork(id: string, dto: LogWorkDto, actor?: { employeeId?: string; name?: string; userId?: string }) {
    const item = await this.itemRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException('Work item not found');
    const employeeId = dto.employeeId || actor?.employeeId || item.assigneeId;
    if (!employeeId) throw new BadRequestException('No employee to log this time against');

    const log = await this.logRepo.save(
      this.logRepo.create({
        workItemId: id,
        projectId: item.projectId,
        employeeId,
        employeeName: dto.employeeName || actor?.name || item.assigneeName,
        hours: dto.hours,
        date: dto.date ? new Date(dto.date) : new Date(),
        note: dto.note,
      }),
    );

    item.completedWork = round1((item.completedWork || 0) + dto.hours);
    item.remainingWork =
      dto.remainingWork != null ? round1(dto.remainingWork) : round1(Math.max(0, (item.remainingWork || 0) - dto.hours));
    // Logging time against an untouched item means work has actually started.
    if (item.state === WorkItemState.NEW) this.stampState(item, WorkItemState.ACTIVE);
    item.updatedById = actor?.userId ?? item.updatedById;
    item.updatedByName = actor?.name ?? item.updatedByName;
    await this.itemRepo.save(item);

    await this.activity.record({
      projectId: item.projectId,
      entityType: ActivityEntity.WORK_ITEM,
      entityId: item.id,
      entityTitle: item.title,
      action: ActivityAction.WORK_LOGGED,
      actor: { id: actor?.userId, name: dto.employeeName || actor?.name },
      summary: `${dto.employeeName || actor?.name || 'Someone'} logged ${dto.hours}h · ${item.remainingWork}h remaining`,
    });

    return { log, item };
  }

  /** History for one work item — the "who changed what, when" trail. */
  history(id: string) {
    return this.activity.forEntity(id);
  }

  listLogs(id: string) {
    return this.logRepo.find({ where: { workItemId: id }, order: { date: 'DESC' } });
  }

  /**
   * Tell the assignee, on every channel: in-app notification, email and push.
   * Never breaks the write that triggered it — a mail outage must not stop
   * someone from assigning work.
   */
  private async notifyAssignee(
    item: WorkItem,
    projectKey: string,
    kind: 'assigned' | 'state',
    actorName?: string,
    previousState?: WorkItemState,
  ) {
    try {
      if (!item.assigneeId) return;
      const [employee, project] = await Promise.all([
        this.employeeRepo.findOne({ where: { id: item.assigneeId }, relations: { user: true } }),
        this.projectRepo.findOne({ where: { id: item.projectId } }),
      ]);
      const user = employee?.user;
      if (!user?.id) return;

      const ref = `${projectKey ? `${projectKey}-` : '#'}${item.seq}`;
      const who = actorName || 'Your manager';
      const typeLabel = TYPE_LABEL[item.type];
      const firstName = employee?.firstName ? ` ${employee.firstName}` : '';

      const title =
        kind === 'assigned'
          ? `${who} assigned you a ${typeLabel}`
          : `${ref} moved to ${STATE_LABEL[item.state]}`;

      // Short line for the in-app list and the push payload.
      const shortBody = `${ref} · ${typeLabel}: ${item.title}`;

      // Fuller, human email — this is the "he assigned this to you" mail.
      const lines =
        kind === 'assigned'
          ? [
              `Hi${firstName},`,
              ``,
              `${who} has assigned the following ${typeLabel.toLowerCase()} to you.`,
              ``,
              `  ${ref} — ${item.title}`,
              `  Project:  ${project?.name ?? '—'}`,
              `  Type:     ${typeLabel}`,
              `  State:    ${STATE_LABEL[item.state]}`,
              `  Priority: P${item.priority}`,
              item.originalEstimate ? `  Estimate: ${item.originalEstimate}h` : '',
              item.targetDate ? `  Due:      ${new Date(item.targetDate).toDateString()}` : '',
              item.description ? `\n${item.description}` : '',
              ``,
              `Open the HRMS app → Goals → ${project?.name ?? 'your project'} to pick it up.`,
            ]
          : [
              `Hi${firstName},`,
              ``,
              `${who} moved ${ref} (${item.title}) from ${STATE_LABEL[previousState ?? WorkItemState.NEW]} to ${STATE_LABEL[item.state]}.`,
              item.reason ? `Reason: ${item.reason}` : '',
              ``,
              `Open the HRMS app → Goals to see the board.`,
            ];
      const emailBody = lines.filter((l) => l !== '').join('\n');

      await this.notifications.createForUser(user.id, title, shortBody, NotificationType.WORK_ITEM);
      if (user.email) await this.mail.send(user.email, title, emailBody);
      if (user.fcmToken) {
        await this.notifications.sendToDevice(user.fcmToken, title, shortBody, { type: 'workItem', workItemId: item.id });
      }
    } catch (err: any) {
      this.logger.error(`Failed to notify work-item assignee: ${err?.message}`);
    }
  }
}
