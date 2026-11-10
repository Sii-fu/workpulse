import { describe, expect, it } from 'vitest';
import { END_DAY_STEPS, StepEmpty, nextOpenStep, prevOpenStep, stepAfterDoneTasks, stepStatus } from './endDaySteps';

const none: StepEmpty = { activity: false, tasks: false, log: false, sync: false, clock: false };
const idx = (id: (typeof END_DAY_STEPS)[number]) => END_DAY_STEPS.indexOf(id);

describe('End my day step order', () => {
  it('starts on the first step with something to do', () => {
    expect(nextOpenStep(none, 0)).toBe(0);
    expect(nextOpenStep({ ...none, activity: true }, 0)).toBe(idx('tasks'));
  });

  it('skips empty steps going forward and lands on clock out at the end', () => {
    expect(nextOpenStep({ ...none, log: true, sync: true }, idx('tasks') + 1)).toBe(idx('clock'));
    expect(nextOpenStep({ activity: true, tasks: true, log: true, sync: true, clock: false }, 0)).toBe(idx('clock'));
  });

  it('goes back to the previous step with something to do, or -1', () => {
    expect(prevOpenStep({ ...none, tasks: true }, idx('log'))).toBe(idx('activity'));
    expect(prevOpenStep({ ...none, activity: true }, idx('tasks'))).toBe(-1);
  });

  it("after adding logs from done tasks, goes to Today's log even if the day had no logs before", () => {
    // The emptiness seen when the confirm started: no logs, nothing to sync.
    const stale: StepEmpty = { ...none, log: true, sync: true };
    expect(nextOpenStep(stale, idx('tasks') + 1)).toBe(idx('clock')); // the bug: the new entries were skipped
    expect(stepAfterDoneTasks()).toBe(idx('log'));
  });

  it('status: empty is done, then the step rule, then the user mark', () => {
    expect(stepStatus('log', { ...none, log: true }, {}, false)).toBe('done');
    expect(stepStatus('tasks', none, {}, true)).toBe('done');
    expect(stepStatus('sync', none, { sync: 'skipped' }, false)).toBe('skipped');
    expect(stepStatus('sync', none, {}, false)).toBe('todo');
  });
});
