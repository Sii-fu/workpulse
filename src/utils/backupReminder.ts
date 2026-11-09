import { BacklogTask, WorkLog } from '../types';
import { isSampleLog, isSampleTask } from '../data/sampleData';

// All data lives in this browser, so a backup file is the only safety net. After this many days
// without one the app gently says so.
export const BACKUP_REMIND_AFTER_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface BackupStatus {
  /** Whole days since the last backup; null when there has never been one (or the date is unreadable). */
  days: number | null;
  /** Show the reminder: there is real work to lose and the last backup is old or missing. */
  due: boolean;
}

export function backupStatus(
  lastBackupAt: string | undefined,
  logs: WorkLog[],
  backlog: BacklogTask[],
  now: number = Date.now(),
): BackupStatus {
  const then = lastBackupAt ? Date.parse(lastBackupAt) : NaN;
  const days = Number.isNaN(then) ? null : Math.max(0, Math.floor((now - then) / DAY_MS));
  // A new colleague with only the demo data has nothing to lose yet.
  const hasRealData = logs.some((l) => !isSampleLog(l)) || backlog.some((t) => !isSampleTask(t));
  return { days, due: hasRealData && (days === null || days >= BACKUP_REMIND_AFTER_DAYS) };
}

export function describeBackupAge(days: number | null): string {
  if (days === null) return 'No backup yet';
  if (days === 0) return 'Last backup today';
  if (days === 1) return 'Last backup yesterday';
  return `Last backup ${days} days ago`;
}
