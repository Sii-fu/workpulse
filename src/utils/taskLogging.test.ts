import { describe, it, expect } from 'vitest';
import { loggedSecondsOf, unloggedSeconds, withUnloggedTime, isEodCandidate, isPendingTask } from './taskLogging';
import type { BacklogTask } from '../types';

const TODAY = '2026-11-08';
const task = (o: Partial<BacklogTask> = {}): BacklogTask => ({
  id: 't', title: 'T', projectId: 'p', dueDate: TODAY, completed: false, stage: 'in_progress',
  originalDate: TODAY, isRolledOver: false, elapsedSeconds: 0, ...o,
});

describe('unlogged time', () => {
  it('legacy synthesized task (no loggedSeconds) counts all tracked time as logged', () => {
    const t = task({ isSynthesized: true, elapsedSeconds: 3600 });
    expect(loggedSecondsOf(t)).toBe(3600);
    expect(unloggedSeconds(t)).toBe(0);
  });
  it('complete (60 min) -> reopen -> 30 more min leaves only 30 min unlogged', () => {
    const t = task({ stage: 'done', completed: true, isSynthesized: false, loggedSeconds: 3600, elapsedSeconds: 5400 });
    expect(unloggedSeconds(t)).toBe(1800);
    expect(withUnloggedTime(t).elapsedSeconds).toBe(1800);
  });
  it('never negative', () => {
    expect(unloggedSeconds(task({ loggedSeconds: 500, elapsedSeconds: 100 }))).toBe(0);
  });
});

describe('isEodCandidate', () => {
  it('a task already logged by "complete" is not offered to EOD again (B3)', () => {
    const t = task({ stage: 'done', completed: true, isSynthesized: true, loggedSeconds: 3600, elapsedSeconds: 3600 });
    expect(isEodCandidate(t, TODAY, false)).toBe(false);
    expect(isEodCandidate(t, TODAY, true)).toBe(false);
  });
  it('a custom selection skips fully logged tasks but keeps active ones (B4)', () => {
    expect(isEodCandidate(task({ isSynthesized: true, loggedSeconds: 60, elapsedSeconds: 60 }), TODAY, true)).toBe(false);
    expect(isEodCandidate(task({ elapsedSeconds: 600 }), TODAY, true)).toBe(true);
  });
  it('new time after a log makes the task a candidate again', () => {
    expect(isEodCandidate(task({ isSynthesized: true, loggedSeconds: 600, elapsedSeconds: 1200 }), TODAY, false)).toBe(true);
  });
  it('planned task with no work is never a candidate', () => {
    expect(isEodCandidate(task({ stage: 'planned' }), TODAY, false)).toBe(false);
    expect(isEodCandidate(task({ stage: 'planned' }), TODAY, true)).toBe(false);
  });
  it('default scope requires today', () => {
    expect(isEodCandidate(task({ dueDate: '2026-01-01', originalDate: '2026-01-01', elapsedSeconds: 60 }), TODAY, false)).toBe(false);
  });
});

describe('isPendingTask', () => {
  it('is true until the task is checked off or reaches Done', () => {
    expect(isPendingTask(task({ stage: 'planned' }))).toBe(true);
    expect(isPendingTask(task({ stage: 'blocked' }))).toBe(true);
    expect(isPendingTask(task({ completed: true }))).toBe(false);
    expect(isPendingTask(task({ stage: 'done' }))).toBe(false);
  });
});
