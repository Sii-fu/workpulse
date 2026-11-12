import { describe, it, expect } from 'vitest';
import type { BacklogTask, Project } from '../types';
import { planCandidates, applyPlan, parsePlanLines, firstWordMatches, completeFirstWord, planSummary } from './planYourDay';

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
  const P = (id: string, name: string, extra: Partial<Project> = {}): Project => ({ id, name, color: '#000000', isArchived: false, ...extra });
  const list = [
    P('hmis', 'HMIS'),
    P('hmisp', 'HMIS Portal'),
    P('fe', 'Frontend & Design System'),
    P('pay', 'Payroll'),
    P('pat', 'Patient Records'),
    P('old', 'Legacy', { isArchived: true }),
    P('bin', 'Binned', { trashedAt: '2026-11-01T00:00:00.000Z' }),
  ];
  const parse = (t: string) => parsePlanLines(t, list);

  it('reads the project first, then the task', () => {
    expect(parse('HMIS fix deploy check').tasks).toEqual([{ title: 'fix deploy check', projectId: 'hmis' }]);
  });

  it('handles multi-word names, ignoring case and spacing', () => {
    expect(parse('Frontend & Design System menu bug').tasks).toEqual([{ title: 'menu bug', projectId: 'fe' }]);
    expect(parse('frontend&designsystem menu bug').tasks).toEqual([{ title: 'menu bug', projectId: 'fe' }]);
    expect(parse('hmisportal   login').tasks).toEqual([{ title: 'login', projectId: 'hmisp' }]);
  });

  it('the longest matching name wins', () => {
    expect(parse('HMIS Portal fix login').tasks).toEqual([{ title: 'fix login', projectId: 'hmisp' }]);
    expect(parse('HMIS portalish thing').tasks).toEqual([{ title: 'portalish thing', projectId: 'hmis' }]);
  });

  it('a name must end at a word edge', () => {
    const r = parse('HMISX thing');
    expect(r.tasks).toEqual([]);
    expect(r.problems).toEqual([{ line: 1, kind: 'no-project' }]);
  });

  it('accepts an optional colon or dash after the name', () => {
    expect(parse('HMIS: fix it').tasks).toEqual([{ title: 'fix it', projectId: 'hmis' }]);
    expect(parse('Payroll - run report').tasks).toEqual([{ title: 'run report', projectId: 'pay' }]);
    expect(parse('Payroll-run report').tasks).toEqual([{ title: 'run report', projectId: 'pay' }]);
  });

  it('a first word that is a unique prefix of one name is accepted; an ambiguous one is not', () => {
    expect(parse('pay run report').tasks).toEqual([{ title: 'run report', projectId: 'pay' }]);
    expect(parse('Pat: check queue').tasks).toEqual([{ title: 'check queue', projectId: 'pat' }]);
    // "h" starts both HMIS and HMIS Portal
    expect(parse('h something').problems).toEqual([{ line: 1, kind: 'no-project' }]);
  });

  it('skips archived and trashed projects', () => {
    expect(parse('Legacy fix').problems).toEqual([{ line: 1, kind: 'no-project' }]);
    expect(parse('Binned fix').problems).toEqual([{ line: 1, kind: 'no-project' }]);
  });

  it('ignores blank lines and numbers the flagged ones by their line', () => {
    const r = parse(['HMIS one', '', '   ', 'Nobody two', 'Payroll three', 'Payroll'].join('\n'));
    expect(r.tasks).toEqual([
      { title: 'one', projectId: 'hmis' },
      { title: 'three', projectId: 'pay' },
    ]);
    expect(r.problems).toEqual([
      { line: 4, kind: 'no-project' },
      { line: 6, kind: 'no-task' },
    ]);
  });

  it('empty text has no tasks and no problems', () => {
    expect(parse('')).toEqual({ tasks: [], problems: [] });
  });
});

describe('first-word completion', () => {
  const list: Project[] = [
    { id: 'a', name: 'HMIS Portal', color: '#000', isArchived: false },
    { id: 'b', name: 'Payroll', color: '#000', isArchived: false },
    { id: 'c', name: 'Old', color: '#000', isArchived: true },
  ];

  it('matches active names by the first word typed on the caret line', () => {
    expect(firstWordMatches('h', list).map((p) => p.id)).toEqual(['a']);
    expect(firstWordMatches('HMIS fix\npa', list).map((p) => p.id)).toEqual(['b']);
    expect(firstWordMatches('o', list)).toEqual([]);
  });

  it('is closed with an empty word or once the caret is past the first word', () => {
    expect(firstWordMatches('', list)).toEqual([]);
    expect(firstWordMatches('HMIS ', list)).toEqual([]);
    expect(firstWordMatches('HMIS fi', list)).toEqual([]);
  });

  it('replaces the typed word with the full name and a space', () => {
    expect(completeFirstWord('hm', list[0])).toBe('HMIS Portal ');
    expect(completeFirstWord('x\ny\n pa', list[1])).toBe('x\ny\n Payroll ');
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
