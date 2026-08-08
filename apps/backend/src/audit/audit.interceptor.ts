import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SKIP_AUDIT } from './skip-audit.decorator';
import { Observable, tap } from 'rxjs';
import { AuditAction } from './entities/audit-log.entity';
import { AuditService } from './audit.service';

/**
 * Records every state-changing request automatically.
 *
 * Services also log important domain events explicitly (with human summaries
 * and field diffs). This interceptor is the safety net underneath that: it
 * guarantees no mutation goes unrecorded just because someone forgot to add a
 * line, and it captures the ones an explicit call never sees — refused
 * attempts. A 403 on "delete this user" is precisely the event an auditor
 * cares about, and it never reaches the service at all.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  /** Reads change nothing; logging them would bury the signal in noise. */
  private static readonly MUTATING = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

  /** Endpoints that log themselves with better detail, or are pure noise. */
  private static readonly SKIP = [/\/auth\/login$/, /\/notifications\/.*\/read$/, /\/notifications\/read-all$/];

  constructor(
    private readonly audit: AuditService,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    if (context.getType() !== 'http') return next.handle();

    const req = context.switchToHttp().getRequest();
    const method: string = req.method;
    const path: string = req.route?.path ?? req.url;

    if (!AuditInterceptor.MUTATING.has(method)) return next.handle();
    if (AuditInterceptor.SKIP.some((re) => re.test(path))) return next.handle();

    // Handlers that log themselves with real detail opt out of the generic
    // entry, so the feed doesn't show a vague duplicate above the good one.
    // Failures still get recorded: a refused attempt never reaches the service.
    const selfLogs = this.reflector.getAllAndOverride<boolean>(SKIP_AUDIT, [
      context.getHandler(),
      context.getClass(),
    ]);

    const write = (statusCode: number, success: boolean) => {
      const res = context.switchToHttp().getResponse();
      void this.audit.record({
        action: this.actionFor(method, path),
        entityType: this.entityFor(path),
        entityId: req.params?.id ?? req.params?.employeeId ?? undefined,
        actor: {
          id: req.user?.id,
          name: req.user?.email?.split('@')[0],
          role: req.user?.role,
        },
        method,
        path: req.originalUrl ?? path,
        ip: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip,
        userAgent: req.headers['user-agent'],
        statusCode: statusCode ?? res?.statusCode,
        success,
        summary: success ? undefined : `Refused: ${method} ${path} (${statusCode})`,
      });
    };

    // `tap` observes the stream without altering it. Passing a bare observer
    // object to pipe() instead would break the response pipeline entirely —
    // pipe takes operator functions, not observers.
    return next.handle().pipe(
      tap({
        next: () => { if (!selfLogs) write(context.switchToHttp().getResponse()?.statusCode, true); },
        error: (err) => write(err?.status ?? err?.statusCode ?? 500, false),
      }),
    );
  }

  /** Map HTTP + route shape onto a domain verb. */
  private actionFor(method: string, path: string): AuditAction {
    if (/\/approve$/.test(path)) return AuditAction.APPROVED;
    if (/\/reject$/.test(path)) return AuditAction.REJECTED;
    if (/\/cancel$/.test(path)) return AuditAction.CANCELLED;
    if (/\/issue$/.test(path)) return AuditAction.ISSUED;
    if (/\/upload$/.test(path)) return AuditAction.UPLOADED;
    if (method === 'POST') return AuditAction.CREATED;
    if (method === 'DELETE') return AuditAction.DELETED;
    return AuditAction.UPDATED;
  }

  /** First path segment after the version prefix: /api/v1/leaves/:id → "leave". */
  private entityFor(path: string): string {
    const seg = path.replace(/^\/?api\/v\d+\//, '').split('/')[0] || 'unknown';
    return seg.endsWith('s') ? seg.slice(0, -1) : seg;
  }
}
