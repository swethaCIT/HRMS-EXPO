import { Controller, Get, HttpCode, HttpStatus, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

/**
 * Liveness/readiness probe. Not rate-limited (probes hit it constantly).
 *
 * `SELECT 1` alone was not enough: with `synchronize: false` in production and
 * no migrations, a fresh database connects fine and answers `SELECT 1`, so the
 * probe reported healthy, the orchestrator routed traffic, and then every
 * request failed with `relation "users" does not exist`. The probe now also
 * confirms the schema is actually present, and returns 503 when it is not, so a
 * bad deploy fails visibly instead of silently serving errors.
 */
@ApiTags('health')
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /** A table that must exist for the API to do anything useful. */
  private static readonly REQUIRED_TABLE = 'users';

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Liveness / readiness probe',
    description: 'Returns 503 when the database is unreachable or the schema has not been migrated.',
  })
  async check(@Res({ passthrough: true }) res: Response) {
    let db = false;
    let schema = false;
    let detail: string | undefined;

    try {
      await this.dataSource.query('SELECT 1');
      db = true;

      // to_regclass resolves a table name against the active search_path and
      // returns NULL rather than throwing when it does not exist.
      const rows = await this.dataSource.query('SELECT to_regclass($1) AS t', [
        HealthController.REQUIRED_TABLE,
      ]);
      schema = !!rows?.[0]?.t;
      if (!schema) detail = 'Database reachable but schema is missing — run migrations (npm run migration:run).';
    } catch (err: any) {
      detail = err?.message;
    }

    const ready = db && schema;
    if (!ready) res.status(HttpStatus.SERVICE_UNAVAILABLE);

    return {
      status: ready ? 'ok' : 'degraded',
      db,
      schema,
      ...(detail ? { detail } : {}),
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }
}
