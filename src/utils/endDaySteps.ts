// Step order for End my day. Steps with nothing to do count as done and are passed over by Next/Back.

export const END_DAY_STEPS = ['suggest', 'log', 'sync', 'clock'] as const;
export type StepId = (typeof END_DAY_STEPS)[number];
export type StepStatus = 'todo' | 'done' | 'skipped';
/** True when a step has nothing to do. */
export type StepEmpty = Record<StepId, boolean>;

/** The first step at or after `from` with something to do; the last step (clock out) when none. */
export function nextOpenStep(empty: StepEmpty, from: number): number {
  for (let i = from; i < END_DAY_STEPS.length; i++) if (!empty[END_DAY_STEPS[i]]) return i;
  return END_DAY_STEPS.length - 1;
}

/** The last step before `current` with something to do, or -1. */
export function prevOpenStep(empty: StepEmpty, current: number): number {
  for (let i = current - 1; i >= 0; i--) if (!empty[END_DAY_STEPS[i]]) return i;
  return -1;
}

/**
 * Where to go once suggested logs were added: always Today's log, to review the new entries.
 * Not computed from the emptiness map, which still holds the values from before the logs were added.
 */
export function stepAfterSuggestions(): number {
  return END_DAY_STEPS.indexOf('log');
}

/** Empty steps are done; then the step's own rule (`finished`); then what the user pressed (Next/Skip). */
export function stepStatus(
  id: StepId,
  empty: StepEmpty,
  marks: Partial<Record<StepId, StepStatus>>,
  finished: boolean,
): StepStatus {
  if (empty[id] || finished) return 'done';
  return marks[id] ?? 'todo';
}
