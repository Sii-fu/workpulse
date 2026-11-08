import { BacklogTask } from '../types';
import { localDateOfIso } from './dates';

// Seconds of a task's tracked time already written into a log. Tasks logged before this field
// existed only have isSynthesized, so for them everything tracked so far counts as logged.
export function loggedSecondsOf(t: BacklogTask): number {
  if (t.loggedSeconds !== undefined) return t.loggedSeconds;
  return t.isSynthesized ? t.elapsedSeconds || 0 : 0;
}

export function unloggedSeconds(t: BacklogTask): number {
  return Math.max(0, (t.elapsedSeconds || 0) - loggedSecondsOf(t));
}

// A copy of the task whose elapsedSeconds is only the not-yet-logged time (sent to the EOD synthesizer).
export function withUnloggedTime(t: BacklogTask): BacklogTask {
  return { ...t, elapsedSeconds: unloggedSeconds(t) };
}

// Which tasks the EOD synthesizer may log. Fully logged tasks are never offered again, even when
// the user selects them by hand; a task with new tracked time since its last log is offered again.
export function isEodCandidate(t: BacklogTask, todayStr: string, isCustomSelection: boolean): boolean {
  const unlogged = unloggedSeconds(t);
  if (t.isSynthesized && unlogged === 0) return false;
  if (t.stage === 'planned' && !t.completed && unlogged === 0) return false;
  if (isCustomSelection) return true;

  const isToday =
    t.dueDate === todayStr ||
    t.originalDate === todayStr ||
    (!!t.completedAt && localDateOfIso(t.completedAt) === todayStr) ||
    (!!t.startedAt && localDateOfIso(t.startedAt) === todayStr);
  const hasActivity = unlogged > 0 || t.completed || t.stage !== 'planned';
  return isToday && hasActivity;
}
