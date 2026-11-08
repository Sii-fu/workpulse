import { WorkLog } from '../types';

// A log still needs sending to the Google Sheet when it has no syncedAt and was created strictly
// after sync tracking began (logs made in the same instant, e.g. demo data, are not counted). Older logs may or may not already be in the sheet, so they are never
// re-sent automatically (that is what caused duplicate rows).
export function isUnsynced(log: WorkLog, trackingSince?: string): boolean {
  // Edited after the last sync (or edited and never synced): send it again, whatever its age.
  if (log.editedAt && (!log.syncedAt || log.syncedAt < log.editedAt)) return true;
  if (log.syncedAt) return false;
  return !trackingSince || log.createdAt > trackingSince;
}

export function unsyncedLogs(logs: WorkLog[], trackingSince?: string): WorkLog[] {
  return logs.filter((l) => isUnsynced(l, trackingSince));
}
