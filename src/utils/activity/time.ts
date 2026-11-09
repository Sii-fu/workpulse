const BREAK_MS = 30 * 60 * 1000;
const MIN_CLUSTER_MINUTES = 5;

/** The UTC range covering one LOCAL calendar day (start inclusive, end exclusive). */
export function localDayToUtcRange(date: string): { startIso: string; endIso: string } {
  const [y, m, d] = date.split('-').map(Number);
  return {
    startIso: new Date(y, m - 1, d).toISOString(),
    endIso: new Date(y, m - 1, d + 1).toISOString(),
  };
}

/**
 * Estimated minutes of work from activity timestamps. A gap over 30 minutes ends a cluster;
 * each cluster counts its first-to-last span, at least 5 minutes so a lone commit is not 0.
 */
export function estimateMinutes(timesIso: string[]): number {
  const times = timesIso.map((t) => new Date(t).getTime()).filter((t) => !Number.isNaN(t)).sort((a, b) => a - b);
  if (times.length === 0) return 0;
  let total = 0;
  let start = times[0];
  let prev = times[0];
  const closeCluster = () => {
    total += Math.max(MIN_CLUSTER_MINUTES, Math.round((prev - start) / 60000));
  };
  for (const t of times.slice(1)) {
    if (t - prev > BREAK_MS) {
      closeCluster();
      start = t;
    }
    prev = t;
  }
  closeCluster();
  return total;
}

/** "45m", "2h", "1h 10m". */
export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? (m > 0 ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
}

export function formatEstimate(minutes: number): string {
  if (minutes <= 0) return 'no duration';
  return `~${formatMinutes(minutes)} (estimated)`;
}
