import { describe, it, expect } from 'vitest';
import { chooseNextAction, nextActionLabel, type NextActionInput } from './nextAction';
import type { ClockPhase, ClockState } from './workday';

const clock = (phase: ClockPhase): ClockState =>
  ({ phase, workedSec: 0, leftSec: 0, overSec: 0, leaveAtMs: null, clockInMs: null });

const input = (phase: ClockPhase, over: Partial<NextActionInput> = {}): NextActionInput => ({
  clock: clock(phase),
  pendingSuggestions: 0,
  doneUnloggedTasks: 0,
  checkedActivityToday: true,
  hasActivityFolders: false,
  ...over,
});

describe('chooseNextAction', () => {
  it('clocks in when the day has not started, whatever else is pending', () => {
    expect(chooseNextAction(input('off', { pendingSuggestions: 2, doneUnloggedTasks: 1 }))).toEqual({ kind: 'clock-in' });
  });

  it.each(['near', 'due', 'over'] as const)('ends the day in phase %s', phase => {
    expect(chooseNextAction(input(phase))).toEqual({ kind: 'end-day' });
  });

  it('near with 3 suggestions still ends the day', () => {
    expect(chooseNextAction(input('near', { pendingSuggestions: 3 }))).toEqual({ kind: 'end-day' });
  });

  it('reviews suggestions when calm', () => {
    expect(chooseNextAction(input('calm', { pendingSuggestions: 3, doneUnloggedTasks: 2 })))
      .toEqual({ kind: 'review-suggestions', count: 3 });
  });

  it('logs done tasks when there are no suggestions', () => {
    expect(chooseNextAction(input('calm', { doneUnloggedTasks: 2, hasActivityFolders: true, checkedActivityToday: false })))
      .toEqual({ kind: 'log-done', count: 2 });
  });

  it('out with 2 done tasks logs them', () => {
    expect(chooseNextAction(input('out', { doneUnloggedTasks: 2 }))).toEqual({ kind: 'log-done', count: 2 });
  });

  it('checks activity when folders are set and it has not been checked today', () => {
    expect(chooseNextAction(input('calm', { hasActivityFolders: true, checkedActivityToday: false })))
      .toEqual({ kind: 'check-activity' });
  });

  it('does not check activity without folders or after a check', () => {
    expect(chooseNextAction(input('calm', { hasActivityFolders: false, checkedActivityToday: false }))).toEqual({ kind: 'add-log' });
    expect(chooseNextAction(input('calm', { hasActivityFolders: true, checkedActivityToday: true }))).toEqual({ kind: 'add-log' });
  });

  it('falls back to add-log, also when out', () => {
    expect(chooseNextAction(input('calm'))).toEqual({ kind: 'add-log' });
    expect(chooseNextAction(input('out'))).toEqual({ kind: 'add-log' });
  });
});

describe('nextActionLabel', () => {
  it('words every action', () => {
    expect(nextActionLabel({ kind: 'clock-in' })).toBe('Clock in');
    expect(nextActionLabel({ kind: 'end-day' })).toBe('End my day');
    expect(nextActionLabel({ kind: 'review-suggestions', count: 3 })).toBe('Review 3 suggestions');
    expect(nextActionLabel({ kind: 'review-suggestions', count: 1 })).toBe('Review 1 suggestion');
    expect(nextActionLabel({ kind: 'log-done', count: 2 })).toBe('Log 2 done tasks');
    expect(nextActionLabel({ kind: 'log-done', count: 1 })).toBe('Log 1 done task');
    expect(nextActionLabel({ kind: 'check-activity' })).toBe('Check activity');
    expect(nextActionLabel({ kind: 'add-log' })).toBe('Add log');
  });
});
