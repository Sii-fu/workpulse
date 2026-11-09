process.env.TZ = 'Asia/Dhaka';

import { describe, it, expect } from 'vitest';
import {
  consumedIds,
  dropConsumed,
  trackedMinutesFor,
  buildSuggestions,
  templateTasks,
  suggestionToLogData,
} from './suggestions';
import type { ActivityFolder, ActivityItem, Suggestion } from './types';
import type { BacklogTask, Project, WorkLog } from '../../types';

const DATE = '2026-11-09';
const at = (hm: string) => `2026-11-09T${hm}:00.000Z`;

const item = (id: string, time: string, over: Partial<ActivityItem> = {}): ActivityItem => ({
  id, source: 'git', folder: '/p/app', time, text: `text ${id}`, ...over,
});
const log = (over: Partial<WorkLog> = {}): WorkLog => ({
  id: 'log-1', date: DATE, time: '10:00', projectId: 'proj-a', projectName: 'A',
  description: 'x', status: 'completed', tags: [], createdAt: 'c', ...over,
});
const task = (over: Partial<BacklogTask> = {}): BacklogTask => ({
  id: 't1', title: 't', projectId: 'proj-a', dueDate: DATE, completed: false,
  originalDate: DATE, isRolledOver: false, ...over,
});
const projects: Project[] = [
  { id: 'proj-a', name: 'Alpha', color: '#fff', isArchived: false },
  { id: 'proj-b', name: 'Beta', color: '#000', isArchived: false },
];
const folders: ActivityFolder[] = [
  { path: '/p/app', projectId: 'proj-a' },
  { path: '/p/api', projectId: 'proj-a' },
  { path: '/p/site', projectId: 'proj-b' },
  { path: '/p/gone', projectId: 'deleted' },
];
const ctx = { date: DATE, folders, projects, logs: [] as WorkLog[], backlog: [] as BacklogTask[] };

describe('consumedIds / dropConsumed', () => {
  const items = [item('git:1', at('04:00')), item('git:2', at('04:05'))];
  it('removes items already used by a log', () => {
    const consumed = consumedIds([log({ sourceIds: ['git:1'] }), log({ id: 'log-2' })]);
    expect(dropConsumed(items, consumed).map((i) => i.id)).toEqual(['git:2']);
  });
  it('frees the items again once that log is gone', () => {
    const logs = [log({ sourceIds: ['git:1'] })];
    expect(dropConsumed(items, consumedIds(logs))).toHaveLength(1);
    expect(dropConsumed(items, consumedIds([]))).toHaveLength(2);
  });
});

describe('trackedMinutesFor', () => {
  it('adds logged minutes and not-yet-logged timer time for the same project and date', () => {
    const logs = [log({ durationMinutes: 60 })];
    const backlog = [task({ elapsedSeconds: 1800, loggedSeconds: 600 })];
    expect(trackedMinutesFor(DATE, 'proj-a', logs, backlog)).toBe(80);
  });
  it('does not count timer time already written into a log', () => {
    expect(trackedMinutesFor(DATE, 'proj-a', [], [task({ elapsedSeconds: 600, loggedSeconds: 600 })])).toBe(0);
    expect(trackedMinutesFor(DATE, 'proj-a', [], [task({ elapsedSeconds: 600, loggedSeconds: 900 })])).toBe(0);
  });
  it('ignores other projects and other dates', () => {
    const logs = [log({ projectId: 'proj-b', durationMinutes: 30 }), log({ id: 'l2', date: '2026-11-08', durationMinutes: 30 })];
    const backlog = [task({ projectId: 'proj-b', elapsedSeconds: 3600 }), task({ id: 't2', dueDate: '2026-11-08', elapsedSeconds: 3600 })];
    expect(trackedMinutesFor(DATE, 'proj-a', logs, backlog)).toBe(0);
  });
  it('treats a log without a duration as 0', () => {
    expect(trackedMinutesFor(DATE, 'proj-a', [log()], [])).toBe(0);
  });
});

describe('buildSuggestions', () => {
  it('merges two folders that map to the same project into one suggestion', () => {
    const items = [item('git:1', at('04:00')), item('git:2', at('04:10'), { folder: '/p/api' })];
    const s = buildSuggestions([{ text: 'Did both', itemIds: ['git:1', 'git:2'] }], items, ctx);
    expect(s).toHaveLength(1);
    expect(s[0]).toMatchObject({ projectId: 'proj-a', projectName: 'Alpha', text: 'Did both' });
    expect(s[0].itemIds.sort()).toEqual(['git:1', 'git:2']);
  });
  it('splits a task that spans two projects into one suggestion per project', () => {
    const items = [item('git:1', at('04:00')), item('git:2', at('04:10'), { folder: '/p/site' })];
    const s = buildSuggestions([{ text: 'Both', itemIds: ['git:1', 'git:2'] }], items, ctx);
    expect(s.map((x) => x.projectId).sort()).toEqual(['proj-a', 'proj-b']);
  });
  it('estimates minutes with the cluster rule', () => {
    const items = [item('git:1', at('10:00')), item('git:2', at('10:10')), item('git:3', at('12:00'))];
    const s = buildSuggestions([{ text: 'T', itemIds: ['git:1', 'git:2', 'git:3'] }], items, ctx);
    expect(s[0].minutes).toBe(15);
  });
  it('names a project that no longer exists "Unassigned"', () => {
    const items = [item('git:1', at('04:00'), { folder: '/p/gone' })];
    const s = buildSuggestions([{ text: 'T', itemIds: ['git:1'] }], items, ctx);
    expect(s[0]).toMatchObject({ projectId: 'deleted', projectName: 'Unassigned' });
  });
  it('describes the evidence as commits and distinct Claude sessions', () => {
    const items = [
      item('git:1', at('04:00')), item('git:2', at('04:01')), item('git:3', at('04:02')),
      item('claude:s1:u1', at('04:03'), { source: 'claude' }),
      item('claude:s1:u2', at('04:04'), { source: 'claude' }),
      item('claude:s2:u1', at('04:05'), { source: 'claude' }),
    ];
    const s = buildSuggestions([{ text: 'T', itemIds: items.map((i) => i.id) }], items, ctx);
    expect(s[0].evidence).toBe('3 commits, 2 Claude sessions');
  });
  it('uses singular wording and omits an absent source', () => {
    const s = buildSuggestions([{ text: 'T', itemIds: ['git:1'] }], [item('git:1', at('04:00'))], ctx);
    expect(s[0].evidence).toBe('1 commit');
  });
  it('carries the tracked-time warning for its project and date', () => {
    const s = buildSuggestions([{ text: 'T', itemIds: ['git:1'] }], [item('git:1', at('04:00'))], { ...ctx, logs: [log({ durationMinutes: 45 })] });
    expect(s[0].trackedMinutes).toBe(45);
  });
  it('carries the sub-tasks of the task', () => {
    const s = buildSuggestions([{ text: 'T', subtasks: ['Step one', 'Step two'], itemIds: ['git:1'] }], [item('git:1', at('04:00'))], ctx);
    expect(s[0].subtasks).toEqual(['Step one', 'Step two']);
  });
  it('has an empty sub-task list when the task has none', () => {
    expect(buildSuggestions([{ text: 'T', itemIds: ['git:1'] }], [item('git:1', at('04:00'))], ctx)[0].subtasks).toEqual([]);
  });
  it('skips tasks whose items cannot be found', () => {
    expect(buildSuggestions([{ text: 'T', itemIds: ['nope'] }], [], ctx)).toEqual([]);
  });
});

describe('templateTasks', () => {
  it('makes one task per folder: a short summary, with the commit subjects as sub-tasks', () => {
    const items = [
      item('git:1', at('04:00'), { text: 'fix timer' }),
      item('git:2', at('04:05'), { text: 'add export' }),
      item('git:3', at('04:06'), { folder: '/p/site', text: 'tweak css' }),
    ];
    const tasks = templateTasks(items, { '/p/app': 'Alpha' });
    expect(tasks).toHaveLength(2);
    expect(tasks[0].text).toBe('Worked on Alpha');
    expect(tasks[0].subtasks).toEqual(['fix timer', 'add export']);
    expect(tasks[0].itemIds).toEqual(['git:1', 'git:2']);
    expect(tasks[1].text).toBe('Worked on site'); // no project name given: the folder's name
    expect(tasks[1].itemIds).toEqual(['git:3']);
  });
  it('uses the prompts as sub-tasks when there are no commits, and skips session titles and file edits', () => {
    const items = [
      item('claude:s:u1', at('04:00'), { source: 'claude', text: 'Fix the login bug' }),
      item('claude:s:title', at('04:00'), { source: 'claude', text: 'Session: Login work' }),
      item('claude:s:a1:0', at('04:01'), { source: 'claude', text: 'Edited Login.tsx' }),
    ];
    const [task] = templateTasks(items);
    expect(task.subtasks).toEqual(['Fix the login bug']);
    expect(task.itemIds).toHaveLength(3);
  });
  it('caps the sub-tasks at 12', () => {
    const items = Array.from({ length: 20 }, (_, n) => item(`git:${n}`, at('04:00'), { text: `change ${n}` }));
    expect(templateTasks(items)[0].subtasks).toHaveLength(12);
  });
  it('returns nothing for no items', () => expect(templateTasks([])).toEqual([]));
});

describe('suggestionToLogData', () => {
  const s: Suggestion = {
    key: 'git:1', folder: '/p/app', projectId: 'proj-a', projectName: 'Alpha',
    text: 'Suggested text', subtasks: [], minutes: 25, itemIds: ['git:1', 'git:2'], evidence: '2 commits', trackedMinutes: 0,
  };
  it('uses the edited text, minutes and project and records the source ids', () => {
    const d = suggestionToLogData(s, DATE, 40, 'Edited text', 'proj-b', 'Beta', []);
    expect(d).toMatchObject({
      date: DATE, projectId: 'proj-b', projectName: 'Beta', description: 'Edited text',
      durationMinutes: 40, status: 'completed', tags: [], sourceIds: ['git:1', 'git:2'],
    });
    expect(d.time).toMatch(/^\d{2}:\d{2}$/);
  });
  it('leaves the duration out when minutes is 0', () => {
    expect(suggestionToLogData(s, DATE, 0, 't', 'proj-a', 'Alpha', []).durationMinutes).toBeUndefined();
  });
  it('does not alias the suggestion\'s item id list', () => {
    const d = suggestionToLogData(s, DATE, 5, 't', 'proj-a', 'Alpha', []);
    d.sourceIds!.push('x');
    expect(s.itemIds).toEqual(['git:1', 'git:2']);
  });
});

describe('buildSuggestions: minutes are not counted twice', () => {
  it('shares one project cluster between interleaved tasks instead of counting it per task', () => {
    // six commits across one hour, 10 minutes apart, split by the AI into three interleaved tasks
    const times = ['10:00', '10:10', '10:20', '10:30', '10:40', '10:50'];
    const items = times.map((t, i) => item(`git:${i}`, at(t)));
    const tasks = [
      { text: 'A', itemIds: ['git:0', 'git:3'] },
      { text: 'B', itemIds: ['git:1', 'git:4'] },
      { text: 'C', itemIds: ['git:2', 'git:5'] },
    ];
    const s = buildSuggestions(tasks, items, ctx);
    const total = s.reduce((sum, x) => sum + x.minutes, 0);
    expect(total).toBe(50); // one cluster, 10:00 to 10:50: not 3 x 30
    expect(s.map((x) => x.minutes)).toEqual([17, 17, 16]);
  });
  it('keeps a lone suggestion at its own estimate', () => {
    const items = [item('git:1', at('10:00')), item('git:2', at('10:10'))];
    expect(buildSuggestions([{ text: 'T', itemIds: ['git:1', 'git:2'] }], items, ctx)[0].minutes).toBe(10);
  });
  it('does not mix different projects', () => {
    const items = [item('git:1', at('10:00')), item('git:2', at('10:20'), { folder: '/p/site' })];
    const s = buildSuggestions([{ text: 'A', itemIds: ['git:1'] }, { text: 'B', itemIds: ['git:2'] }], items, ctx);
    expect(s.map((x) => x.minutes)).toEqual([5, 5]);
  });
  it('keeps separate work sessions of the same project separate (a long gap is not filled in)', () => {
    const items = [item('git:1', at('09:00')), item('git:2', at('09:10')), item('git:3', at('14:00')), item('git:4', at('14:20'))];
    const tasks = [{ text: 'Morning', itemIds: ['git:1', 'git:2'] }, { text: 'Afternoon', itemIds: ['git:3', 'git:4'] }];
    const s = buildSuggestions(tasks, items, ctx);
    expect(s.map((x) => x.minutes)).toEqual([10, 20]);
  });
});

describe('suggestionToLogData: sub-tasks become the log\'s underlying tasks', () => {
  const s: Suggestion = {
    key: 'git:1', folder: '/p/app', projectId: 'proj-a', projectName: 'Alpha',
    text: 'T', subtasks: ['ignored: the edited list wins'], minutes: 25, itemIds: ['git:1'], evidence: '1 commit', trackedMinutes: 0,
  };
  it('saves the edited sub-tasks as done tasks with no tracked time', () => {
    const d = suggestionToLogData(s, DATE, 25, 'T', 'proj-a', 'Alpha', ['Fixed drift', 'Added tests']);
    expect(d.underlyingTasks).toEqual([
      { id: 'sub-git:1-0', title: 'Fixed drift', stage: 'done', elapsedSeconds: 0 },
      { id: 'sub-git:1-1', title: 'Added tests', stage: 'done', elapsedSeconds: 0 },
    ]);
  });
  it('ignores blank sub-tasks and leaves the field out when none are left', () => {
    expect(suggestionToLogData(s, DATE, 25, 'T', 'proj-a', 'Alpha', ['  ', '']).underlyingTasks).toBeUndefined();
    expect(suggestionToLogData(s, DATE, 25, 'T', 'proj-a', 'Alpha', ['  Kept  ']).underlyingTasks?.[0].title).toBe('Kept');
  });
});
