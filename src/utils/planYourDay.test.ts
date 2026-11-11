import { describe, it, expect } from 'vitest';
import type { BacklogTask, Project } from '../types';
import { planCandidates, applyPlan, parsePlanLines, planSummary } from './planYourDay';

process.env.TZ = 'Asia/Dhaka';

const TODAY = '2026-11-11';

const task = (id: string, dueDate: string, extra: Partial<BacklogTask> = {}): BacklogTask => ({
  id,
  title: id,
  projectId: 'p1',
  dueDate,
  completed: false,
  stage: 'planned',
  originalDate: dueDate,
  isRolledOver: false,
  ...extra,
});

const projects: Project[] = [
  { id: 'p0', name: 'Old', color: '#000000', isArchived: true },
  { id: 'p1', name: 'Bengal Grid', color: '#10b981', isArchived: false },
  { id: 'p2', name: 'Payroll', color: '#6366f1', isArchived: false },
];

describe('planCandidates', () => {
  const backlog = [
    task('today', TODAY),
    task('yesterday', '2026-11-10'),
    task('older', '2026-11-08'),
    task('blocked', '2026-11-09', { stage: 'blocked' }),
    task('done', '2026-11-10', { stage: 'done', completed: true }),
    task('tomorrow', '2026-11-12'),
  ];

  it('lists only planned tasks due before today, newest date first', () => {
    const { carry } = planCandidates(backlog, TODAY);
    expect(carry.map((t) => t.id)).toEqual(['yesterday', 'older']);
  });

  it("leaves out today's, upcoming, done, paused and blocked tasks (paused and blocked show on Today already)", () => {
    const list = [...backlog, task('paused', '2026-11-09', { stage: 'paused' })];
    const ids = planCandidates(list, TODAY).carry.map((t) => t.id);
    for (const gone of ['today', 'tomorrow', 'done', 'blocked', 'paused']) expect(ids).not.toContain(gone);
  });

  it('ticks every candidate', () => {
    expect(planCandidates(backlog, TODAY).defaultCheckedIds).toEqual(['yesterday', 'older']);
  });

  it('leaves out a running task (it already belongs to today)', () => {
    const running = task('run', '2026-11-10', { stage: 'in_progress', isRunning: true });
    expect(planCandidates([running], TODAY).carry).toEqual([]);
  });
});

describe('applyPlan', () => {
  it('moves only the given ids to today', () => {
    const backlog = [task('a', '2026-11-10'), task('b', '2026-11-09'), task('c', '2026-11-08')];
    const next = applyPlan(backlog, ['a', 'c'], TODAY);
    expect(next.map((t) => [t.id, t.dueDate])).toEqual([
      ['a', TODAY],
      ['b', '2026-11-09'],
      ['c', TODAY],
    ]);
  });

  it('returns the same array when nothing is carried', () => {
    const backlog = [task('a', '2026-11-10')];
    expect(applyPlan(backlog, [], TODAY)).toBe(backlog);
  });
});

describe('parsePlanLines', () => {
  it('makes one task per non-empty line, in the first active project by default', () => {
    expect(parsePlanLines('Write report\n\n  \n  Call Rahim  ', projects)).toEqual([
      { title: 'Write report', projectId: 'p1' },
      { title: 'Call Rahim', projectId: 'p1' },
    ]);
  });

  it('a trailing #project picks the project by name prefix', () => {
    expect(parsePlanLines('Run payroll #pay\nReview PR #212', projects)).toEqual([
      { title: 'Run payroll', projectId: 'p2' },
      { title: 'Review PR #212', projectId: 'p1' },
    ]);
  });
});

describe('parsePlanLines with a default project', () => {
  it('uses the given default for lines without a tag, and the tag for the rest', () => {
    expect(parsePlanLines('Write report\nRun payroll #pay', projects, 'p1')).toEqual([
      { title: 'Write report', projectId: 'p1' },
      { title: 'Run payroll', projectId: 'p2' },
    ]);
  });
});

describe('planSummary', () => {
  it('counts only the tasks that really moved', () => {
    const before = [task('a', '2026-11-10'), task('b', '2026-11-09', { stage: 'done', completed: true })];
    const after = applyPlan(before, ['a', 'b', 'gone'], TODAY);
    expect(planSummary(before, after, 0)).toBe('Day planned: 1 carried to today.');
  });

  it('names the added tasks, or just starts the day', () => {
    const before = [task('a', '2026-11-10')];
    expect(planSummary(before, applyPlan(before, ['a'], TODAY), 2)).toBe('Day planned: 1 carried to today, 2 added.');
    expect(planSummary(before, before, 0)).toBe('Day started.');
  });
});
