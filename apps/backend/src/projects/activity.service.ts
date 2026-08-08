import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActivityAction, ActivityEntity, ProjectActivity } from './entities/project-activity.entity';

export interface Actor {
  id?: string;
  name?: string;
}

export interface FieldChange {
  field: string;
  from?: string | null;
  to?: string | null;
}

/** Fields worth recording in history, with the label shown in the feed. */
const TRACKED: Record<string, string> = {
  title: 'Title',
  description: 'Description',
  state: 'State',
  type: 'Type',
  priority: 'Priority',
  assigneeName: 'Assigned to',
  sprintId: 'Sprint',
  teamId: 'Team',
  parentId: 'Parent',
  storyPoints: 'Story points',
  originalEstimate: 'Original estimate',
  remainingWork: 'Remaining work',
  completedWork: 'Completed work',
  targetDate: 'Target date',
  startDate: 'Start date',
  reason: 'Reason',
  name: 'Name',
  status: 'Status',
  accessLevel: 'Access level',
  role: 'Role',
  managerName: 'Manager',
  goal: 'Goal',
};

const asText = (v: any): string | null => {
  if (v === null || v === undefined || v === '') return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v);
};

@Injectable()
export class ActivityService {
  private readonly logger = new Logger(ActivityService.name);

  constructor(
    @InjectRepository(ProjectActivity)
    private readonly repo: Repository<ProjectActivity>,
  ) {}

  /**
   * Compare two snapshots and return only the tracked fields that actually
   * changed. Used so an edit records "State: New → Active" rather than a dump
   * of every column.
   */
  diff(before: Record<string, any>, after: Record<string, any>): FieldChange[] {
    const changes: FieldChange[] = [];
    for (const key of Object.keys(TRACKED)) {
      if (!(key in after)) continue;
      const from = asText(before?.[key]);
      const to = asText(after?.[key]);
      if (from !== to) changes.push({ field: TRACKED[key], from, to });
    }
    return changes;
  }

  /**
   * Append one history entry. Never throws: an audit write must not be able to
   * fail the user's actual action, so problems are logged and swallowed.
   */
  async record(entry: {
    projectId: string;
    entityType: ActivityEntity;
    entityId: string;
    entityTitle?: string;
    action: ActivityAction;
    actor?: Actor;
    changes?: FieldChange[];
    summary?: string;
  }): Promise<void> {
    try {
      if (!entry.projectId || !entry.entityId) return;
      await this.repo.save(
        this.repo.create({
          projectId: entry.projectId,
          entityType: entry.entityType,
          entityId: entry.entityId,
          entityTitle: entry.entityTitle,
          action: entry.action,
          actorId: entry.actor?.id,
          actorName: entry.actor?.name || 'Someone',
          changes: entry.changes?.length ? entry.changes : undefined,
          summary: entry.summary || this.describe(entry.action, entry.changes, entry.actor?.name),
        }),
      );
    } catch (err: any) {
      this.logger.error(`Failed to record activity: ${err?.message}`);
    }
  }

  /** One-line rendering of an entry, e.g. "Priya changed State from New to Active". */
  private describe(action: ActivityAction, changes?: FieldChange[], actorName?: string): string {
    const who = actorName || 'Someone';
    switch (action) {
      case ActivityAction.CREATED:
        return `${who} created this`;
      case ActivityAction.DELETED:
        return `${who} deleted this`;
      case ActivityAction.STATE_CHANGED: {
        const c = changes?.find((x) => x.field === 'State');
        return c ? `${who} moved it from ${c.from ?? '—'} to ${c.to ?? '—'}` : `${who} changed the state`;
      }
      case ActivityAction.ASSIGNED: {
        const c = changes?.find((x) => x.field === 'Assigned to');
        return c ? `${who} assigned it to ${c.to ?? '—'}` : `${who} changed the assignee`;
      }
      case ActivityAction.UNASSIGNED:
        return `${who} removed the assignee`;
      case ActivityAction.WORK_LOGGED:
        return `${who} logged work`;
      case ActivityAction.MEMBER_ADDED:
        return `${who} added a team member`;
      case ActivityAction.MEMBER_REMOVED:
        return `${who} removed a team member`;
      case ActivityAction.ACCESS_CHANGED: {
        const c = changes?.find((x) => x.field === 'Access level');
        return c ? `${who} changed access from ${c.from ?? '—'} to ${c.to ?? '—'}` : `${who} changed access`;
      }
      case ActivityAction.SPRINT_CHANGED:
        return `${who} moved it to a different sprint`;
      default: {
        if (!changes?.length) return `${who} made an update`;
        const first = changes[0];
        const rest = changes.length > 1 ? ` (+${changes.length - 1} more)` : '';
        return `${who} changed ${first.field} from ${first.from ?? '—'} to ${first.to ?? '—'}${rest}`;
      }
    }
  }

  /** Full history for one record (work item detail "History" tab). */
  forEntity(entityId: string) {
    return this.repo.find({ where: { entityId }, order: { createdAt: 'DESC' }, take: 200 });
  }

  /** Recent activity across a whole project (the project's audit feed). */
  forProject(projectId: string, limit = 100) {
    return this.repo.find({ where: { projectId }, order: { createdAt: 'DESC' }, take: Math.min(limit, 300) });
  }
}
