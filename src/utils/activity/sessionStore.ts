import type { PipelineResult } from './pipeline';
import type { Suggestion } from './types';

// The activity check of each local day, kept in memory for the session (not saved): the scan result
// and the suggestions not added yet, with the user's edits. Today's card, the Suggest dialog and
// End my day all read and write it, so a check done in one shows in the others and nothing is
// scanned again just because a screen was reopened. Same pattern as timerStore: module state
// plus listeners.

/** One suggestion as the user is editing it. */
export interface ActivitySessionRow {
  suggestion: Suggestion;
  checked: boolean;
  text: string;
  projectId: string;
  minutes: string;
  /** One sub-task per line. */
  subtasks: string;
}

export interface ActivitySession {
  result: PipelineResult;
  /** Suggestions not added yet. */
  rows: ActivitySessionRow[];
  /** Logs added from this check. */
  addedCount: number;
  checked: true;
}

const sessions = new Map<string, ActivitySession>();
const listeners = new Set<() => void>();

export function getActivitySession(date: string): ActivitySession | null {
  return sessions.get(date) ?? null;
}

export function setActivitySession(date: string, s: ActivitySession): void {
  sessions.set(date, s);
  listeners.forEach((l) => l());
}

export function subscribeActivitySession(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Suggestions from the day's check that are not added yet (0 before any check). */
export function pendingCount(date: string): number {
  return sessions.get(date)?.rows.length ?? 0;
}

/** True once the day's activity has been checked in this session, even if nothing was found. */
export function checkedToday(date: string): boolean {
  return sessions.get(date)?.checked === true;
}

/** Tests only: forget every session. */
export function resetActivitySessions(): void {
  sessions.clear();
  listeners.forEach((l) => l());
}
