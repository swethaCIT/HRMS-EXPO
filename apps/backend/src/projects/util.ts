/** Hours/points are reported to one decimal — keeps chart axes and totals clean. */
export function round1(n: number): number {
  return Math.round((n || 0) * 10) / 10;
}
