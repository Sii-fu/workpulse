// The one rule for turning tracked time into logged minutes (B12): real tracked time only.
// No invented minimums or defaults: no tracked time means no duration.
export function minutesFromSeconds(seconds: number): number {
  if (!(seconds > 0)) return 0;
  return Math.max(1, Math.round(seconds / 60));
}
