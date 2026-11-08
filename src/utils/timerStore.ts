import { BacklogTask } from '../types';

// The live seconds of running tasks, kept outside React state so that only the clocks that show
// them re-render each second. The app's own state still holds the same numbers (that is what gets
// saved and logged); this is a read-only mirror published after every tick.

/** A task whose clock is advancing: the 1-second timer in App adds time to exactly these. */
export function isRunningTask(t: BacklogTask): boolean {
  return t.stage === 'in_progress' && t.isRunning !== false;
}

const live = new Map<string, number>();
const listeners = new Set<() => void>();

export function publishTimers(backlog: BacklogTask[]): void {
  live.clear();
  for (const t of backlog) if (isRunningTask(t)) live.set(t.id, t.elapsedSeconds || 0);
  listeners.forEach((l) => l());
}

export function subscribeTimers(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Seconds to show for a task: the live value while it runs, its saved value otherwise. */
export function liveSecondsOf(t: BacklogTask): number {
  return isRunningTask(t) && live.has(t.id) ? (live.get(t.id) as number) : t.elapsedSeconds || 0;
}

/** True when two task lists differ only in the elapsed time of tasks that are running. */
export function sameTasksIgnoringLiveTime(a: BacklogTask[], b: BacklogTask[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    if (x === y) continue;
    // A clock going from 0 to more than 0 changes what is drawn (the clock appears), so it counts.
    const ticking = isRunningTask(x) && isRunningTask(y) && (x.elapsedSeconds || 0) > 0 && (y.elapsedSeconds || 0) > 0;
    if (!ticking) return false;
    const keys = new Set([...Object.keys(x), ...Object.keys(y)]);
    for (const k of keys) {
      if (k === 'elapsedSeconds') continue;
      if (!Object.is((x as unknown as Record<string, unknown>)[k], (y as unknown as Record<string, unknown>)[k])) return false;
    }
  }
  return true;
}
