import type { ClockState } from './workday';

export type NextAction =
  | { kind: 'clock-in' }
  | { kind: 'end-day' }
  | { kind: 'review-suggestions'; count: number }
  | { kind: 'log-done'; count: number }
  | { kind: 'check-activity' }
  | { kind: 'add-log' };

export interface NextActionInput {
  clock: ClockState;
  pendingSuggestions: number;
  doneUnloggedTasks: number;
  checkedActivityToday: boolean;
  hasActivityFolders: boolean;
}

// The one thing worth doing next. First match wins; phase `out` behaves like calm.
export function chooseNextAction(i: NextActionInput): NextAction {
  const { phase } = i.clock;
  if (phase === 'off') return { kind: 'clock-in' };
  if (phase === 'near' || phase === 'due' || phase === 'over') return { kind: 'end-day' };
  if (i.pendingSuggestions > 0) return { kind: 'review-suggestions', count: i.pendingSuggestions };
  if (i.doneUnloggedTasks > 0) return { kind: 'log-done', count: i.doneUnloggedTasks };
  if (!i.checkedActivityToday && i.hasActivityFolders) return { kind: 'check-activity' };
  return { kind: 'add-log' };
}

export function nextActionLabel(a: NextAction): string {
  switch (a.kind) {
    case 'clock-in': return 'Clock in';
    case 'end-day': return 'End my day';
    case 'review-suggestions': return `Review ${a.count} ${a.count === 1 ? 'suggestion' : 'suggestions'}`;
    case 'log-done': return `Log ${a.count} done ${a.count === 1 ? 'task' : 'tasks'}`;
    case 'check-activity': return 'Check activity';
    case 'add-log': return 'Add log';
  }
}
