/**
 * Clamp list-endpoint paging so a single request can never ask the database for
 * an unbounded result set (a classic way to OOM the process or pin the pool when
 * a table grows large). Callers may page past DEFAULT_LIMIT via `offset`.
 */
export const DEFAULT_LIMIT = 50;
export const MAX_LIMIT = 200;

export function clampPaging(limit?: number, offset?: number) {
  const take = Math.min(
    Math.max(1, Number.isFinite(limit as number) && (limit as number) > 0 ? (limit as number) : DEFAULT_LIMIT),
    MAX_LIMIT,
  );
  const skip = Number.isFinite(offset as number) && (offset as number) > 0 ? (offset as number) : 0;
  return { take, skip };
}
