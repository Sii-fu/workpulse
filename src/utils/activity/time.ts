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

/** One stretch of work: its first and last activity (ms since epoch) and its estimated minutes. */
export interface TimeCluster {
  start: number;
  end: number;
  minutes: number;
}

/**
 * Groups activity timestamps into stretches of work. A gap over 30 minutes ends a stretch; each
 * stretch counts its first-to-last span, at least 5 minutes so a lone commit is not 0.
 */
export function clusterTimes(timesIso: string[]): TimeCluster[] {
  const times = timesIso.map((t) => new Date(t).getTime()).filter((t) => !Number.isNaN(t)).sort((a, b) => a - b);
  if (times.length === 0) return [];
  const clusters: TimeCluster[] = [];
  let start = times[0];
  let prev = times[0];
  const close = () =>
    clusters.push({ start, end: prev, minutes: Math.max(MIN_CLUSTER_MINUTES, Math.round((prev - start) / 60000)) });
  for (const t of times.slice(1)) {
    if (t - prev > BREAK_MS) {
      close();
      start = t;
    }
    prev = t;
  }
  close();
  return clusters;
}

/** Estimated minutes of work from activity timestamps (the sum of their clusters). */
export function estimateMinutes(timesIso: string[]): number {
  return clusterTimes(timesIso).reduce((sum, c) => sum + c.minutes, 0);
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
