import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, FindOptionsWhere, Repository } from 'typeorm';
import { AuditAction, AuditLog } from './entities/audit-log.entity';
import { clampPaging } from '../common/utils/pagination';

export interface AuditActor {
  id?: string;
  name?: string;
  role?: string;
}

export interface AuditEntry {
  action: AuditAction;
  entityType: string;
  entityId?: string;
  entityLabel?: string;
  actor?: AuditActor;
  subjectId?: string;
  subjectName?: string;
  changes?: { field: string; from?: string | null; to?: string | null }[];
  summary?: string;
  method?: string;
  path?: string;
  ip?: string;
  userAgent?: string;
  statusCode?: number;
  success?: boolean;
}

export interface AuditQuery {
  actorId?: string;
  entityType?: string;
  entityId?: string;
  action?: AuditAction;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

const asText = (v: any): string | null => {
  if (v === null || v === undefined || v === '') return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
};

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditLog)
    private readonly repo: Repository<AuditLog>,
  ) {}

  /**
   * Append an entry. Never throws and never awaited by callers on the hot path:
   * an audit write must not be able to fail the action it is recording.
   */
  async record(entry: AuditEntry): Promise<void> {
    try {
      await this.repo.save(
        this.repo.create({
          action: entry.action,
          entityType: entry.entityType,
          entityId: entry.entityId,
          entityLabel: entry.entityLabel,
          actorId: entry.actor?.id,
          actorName: entry.actor?.name ?? 'System',
          actorRole: entry.actor?.role,
          subjectId: entry.subjectId,
          subjectName: entry.subjectName,
          changes: entry.changes?.length ? entry.changes : undefined,
          summary: entry.summary ?? this.describe(entry),
          method: entry.method,
          path: entry.path,
          ip: entry.ip,
          userAgent: entry.userAgent?.slice(0, 300),
          statusCode: entry.statusCode,
          success: entry.success ?? true,
        }),
      );
    } catch (err: any) {
      this.logger.error(`Failed to write audit entry: ${err?.message}`);
    }
  }

  /** Only the fields that actually changed, as before/after pairs. */
  diff(before: Record<string, any>, after: Record<string, any>, fields: Record<string, string>) {
    const changes: { field: string; from?: string | null; to?: string | null }[] = [];
    for (const [key, label] of Object.entries(fields)) {
      if (!(key in after)) continue;
      const from = asText(before?.[key]);
      const to = asText(after?.[key]);
      if (from !== to) changes.push({ field: label, from, to });
    }
    return changes;
  }

  /** "Meera Iyer approved leave for Rahul Verma" */
  private describe(e: AuditEntry): string {
    const who = e.actor?.name ?? 'Someone';
    const what = e.entityLabel ? `${e.entityType} "${e.entityLabel}"` : e.entityType;
    const to = e.subjectName ? ` for ${e.subjectName}` : '';
    const verb: Record<string, string> = {
      [AuditAction.CREATED]: 'created',
      [AuditAction.UPDATED]: 'updated',
      [AuditAction.DELETED]: 'deleted',
      [AuditAction.APPROVED]: 'approved',
      [AuditAction.REJECTED]: 'rejected',
      [AuditAction.ASSIGNED]: 'assigned',
      [AuditAction.CANCELLED]: 'cancelled',
      [AuditAction.ISSUED]: 'issued',
      [AuditAction.ROLE_CHANGED]: 'changed the role of',
      [AuditAction.ACTIVATED]: 'activated',
      [AuditAction.DEACTIVATED]: 'deactivated',
      [AuditAction.LOGIN]: 'signed in',
      [AuditAction.LOGIN_FAILED]: 'failed to sign in',
      [AuditAction.PASSWORD_RESET]: 'reset the password for',
      [AuditAction.UPLOADED]: 'uploaded',
      [AuditAction.DOWNLOADED]: 'downloaded',
      [AuditAction.ACCESS_CHANGED]: 'changed access on',
      [AuditAction.VIEWED]: 'viewed',
    };
    if (e.action === AuditAction.LOGIN || e.action === AuditAction.LOGIN_FAILED) return `${who} ${verb[e.action]}`;
    return `${who} ${verb[e.action] ?? e.action} ${what}${to}`;
  }

  /** Filtered, paged feed for the admin activity screen. */
  async find(q: AuditQuery) {
    const { take, skip } = clampPaging(q.limit, q.offset);
    const where: FindOptionsWhere<AuditLog> = {};
    if (q.actorId) where.actorId = q.actorId;
    if (q.entityType) where.entityType = q.entityType;
    if (q.entityId) where.entityId = q.entityId;
    if (q.action) where.action = q.action;
    if (q.from && q.to) where.createdAt = Between(new Date(q.from), new Date(q.to));

    const [items, total] = await this.repo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      take,
      skip,
    });
    return { items, total, limit: take, offset: skip };
  }

  /** Everything that ever happened to one record. */
  forEntity(entityType: string, entityId: string) {
    return this.repo.find({ where: { entityType, entityId }, order: { createdAt: 'DESC' }, take: 200 });
  }

  /** Counts by action over a window — powers the admin dashboard summary. */
  async stats(days = 7) {
    const since = new Date(Date.now() - days * 86_400_000);
    const rows = await this.repo
      .createQueryBuilder('a')
      .select('a.action', 'action')
      .addSelect('COUNT(*)::int', 'count')
      .where('a.createdAt >= :since', { since })
      .groupBy('a.action')
      .orderBy('count', 'DESC')
      .getRawMany();
    const failures = await this.repo.count({ where: { success: false } });
    const total = rows.reduce((s, r) => s + Number(r.count), 0);
    return { days, total, failures, byAction: rows };
  }
}
