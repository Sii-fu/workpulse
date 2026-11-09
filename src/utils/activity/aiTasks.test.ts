import { describe, it, expect } from 'vitest';
import { buildActivityPrompt, parseAiTasks, ACTIVITY_TASKS_SCHEMA } from './aiTasks';
import type { ActivityItem } from './types';

const item = (id: string, over: Partial<ActivityItem> = {}): ActivityItem => ({
  id, source: 'git', folder: '/p/app', time: '2026-11-09T04:00:00.000Z', text: `text ${id}`, ...over,
});

describe('buildActivityPrompt', () => {
  it('redacts secrets that slipped into item text', () => {
    const items = [item('git:1', { text: 'use key AIzaSyA1234567890abcdefghijklmnopqrstuv9 now' })];
    const { userPrompt } = buildActivityPrompt(items, { '/p/app': 'App' });
    expect(userPrompt).not.toContain('AIzaSyA1234567890');
  });
  it('caps one folder at 40 items, keeping the most recent', () => {
    const items = Array.from({ length: 55 }, (_, n) =>
      item(`git:${n}`, { time: new Date(Date.UTC(2026, 10, 9, 0, n)).toISOString() }),
    );
    const { shortToId } = buildActivityPrompt(items, { '/p/app': 'App' });
    const sent = Object.values(shortToId);
    expect(sent).toHaveLength(40);
    expect(sent).toContain('git:54');
    expect(sent).not.toContain('git:0');
  });
  it('gives every sent item a short id that maps back to the real id', () => {
    const items = [item('git:aaa', { text: 'fix bug' }), item('claude:s:u1', { source: 'claude', text: 'add tests' })];
    const { userPrompt, shortToId } = buildActivityPrompt(items, { '/p/app': 'App' });
    expect(Object.values(shortToId).sort()).toEqual(['claude:s:u1', 'git:aaa']);
    for (const short of Object.keys(shortToId)) expect(userPrompt).toContain(`[${short}]`);
    expect(userPrompt).not.toContain('git:aaa');
  });
  it('tells the model to reference ids, and never to state durations or projects', () => {
    const { systemInstruction } = buildActivityPrompt([item('git:1')], { '/p/app': 'App' });
    expect(systemInstruction).toMatch(/itemIds/);
    expect(systemInstruction).toMatch(/duration/i);
  });
});

describe('parseAiTasks', () => {
  const items = [item('git:1'), item('git:2'), item('git:3')];
  const shortToId = { i1: 'git:1', i2: 'git:2', i3: 'git:3' };

  it('maps short ids, ignores unknown ones, and counts an id only in the first task citing it', () => {
    const raw = { tasks: [{ text: 'A', itemIds: ['i1', 'i9'] }, { text: 'B', itemIds: ['i1', 'i2'] }] };
    const tasks = parseAiTasks(raw, shortToId, items);
    expect(tasks).toEqual([
      { text: 'A', itemIds: ['git:1', 'git:3'] }, // git:3 was not placed: it joins the first task of its folder
      { text: 'B', itemIds: ['git:2'] },
    ]);
  });
  it('drops tasks with empty text or no valid ids', () => {
    const raw = { tasks: [{ text: '  ', itemIds: ['i1'] }, { text: 'No ids', itemIds: ['zzz'] }, { text: 'Fine', itemIds: ['i1', 'i2', 'i3'] }] };
    expect(parseAiTasks(raw, shortToId, items)).toEqual([{ text: 'Fine', itemIds: ['git:1', 'git:2', 'git:3'] }]);
  });
  it('turns unreadable output into one "Other activity" task covering everything', () => {
    for (const raw of [null, 'oops', 42, {}, { tasks: 'nope' }]) {
      expect(parseAiTasks(raw, shortToId, items)).toEqual([{ text: 'Other activity', itemIds: ['git:1', 'git:2', 'git:3'] }]);
    }
  });
  it('adds items that were never sent to the model (over the cap) to the task of their folder', () => {
    const extra = [...items, item('git:4')];
    const raw = { tasks: [{ text: 'All', itemIds: ['i1', 'i2', 'i3'] }] };
    expect(parseAiTasks(raw, shortToId, extra)).toEqual([{ text: 'All', itemIds: ['git:1', 'git:2', 'git:3', 'git:4'] }]);
  });
  it('returns no tasks for no items', () => {
    expect(parseAiTasks({ tasks: [] }, {}, [])).toEqual([]);
  });
});

describe('parseAiTasks: stray ids in the wording', () => {
  const items = [item('git:1'), item('git:2')];
  const shortToId = { i1: 'git:1', i2: 'git:2' };
  it('removes [i1]-style references from the text', () => {
    const raw = { tasks: [{ text: 'Fixed the timer drift [i1] and added tests ([i2]).', itemIds: ['i1', 'i2'] }] };
    const [task] = parseAiTasks(raw, shortToId, items);
    expect(task.text).toBe('Fixed the timer drift and added tests.');
  });
  it('drops a task whose text was only references', () => {
    const raw = { tasks: [{ text: '[i1] [i2]', itemIds: ['i1', 'i2'] }] };
    expect(parseAiTasks(raw, shortToId, items)).toEqual([{ text: 'Other activity', itemIds: ['git:1', 'git:2'] }]);
  });
  it('tells the model not to put ids in the text', () => {
    expect(buildActivityPrompt([item('git:1')], { '/p/app': 'App' }).systemInstruction).toMatch(/do not (write|mention|include).*ids?/i);
  });
});

describe('ACTIVITY_TASKS_SCHEMA', () => {
  it('describes { tasks: [{ text, subtasks[], itemIds[] }] }', () => {
    expect(ACTIVITY_TASKS_SCHEMA).toMatchObject({
      type: 'object',
      required: ['tasks'],
      properties: { tasks: { type: 'array', items: { required: ['text', 'subtasks', 'itemIds'] } } },
    });
  });
});

describe('parseAiTasks: one log per project with sub-tasks', () => {
  const mk = (id: string, folder = '/p/app') => item(id, { folder });
  it('reads the sub-tasks of a task, cleaned, de-duplicated and capped at 12', () => {
    const many = Array.from({ length: 20 }, (_, n) => `Step ${n}`);
    const raw = { tasks: [{ text: 'T', itemIds: ['i1'], subtasks: ['  Fixed drift [i1] ', 'Fixed drift', '', 42, ...many] }] };
    const [task] = parseAiTasks(raw, { i1: 'git:1' }, [mk('git:1')]);
    expect(task.subtasks).toHaveLength(12);
    expect(task.subtasks![0]).toBe('Fixed drift');
    expect(task.subtasks).not.toContain('');
    expect(new Set(task.subtasks).size).toBe(task.subtasks!.length);
  });
  it('leaves sub-tasks out when there are none', () => {
    const [task] = parseAiTasks({ tasks: [{ text: 'T', itemIds: ['i1'] }] }, { i1: 'git:1' }, [mk('git:1')]);
    expect(task.subtasks).toBeUndefined();
  });
  it('attaches an unplaced item to the task that holds most of its folder', () => {
    const items = [mk('a1'), mk('a2'), mk('b1', '/p/site'), mk('a3')];
    const shortToId = { i1: 'a1', i2: 'a2', i3: 'b1', i4: 'a3' };
    const raw = { tasks: [{ text: 'Site', itemIds: ['i3'] }, { text: 'App', itemIds: ['i1', 'i2'] }] };
    const tasks = parseAiTasks(raw, shortToId, items);
    expect(tasks).toEqual([{ text: 'Site', itemIds: ['b1'] }, { text: 'App', itemIds: ['a1', 'a2', 'a3'] }]);
  });
  it('makes a task for the leftovers of a folder that has none', () => {
    const items = [mk('a1'), mk('b1', '/p/site'), mk('b2', '/p/site')];
    const raw = { tasks: [{ text: 'App', itemIds: ['i1'] }] };
    const tasks = parseAiTasks(raw, { i1: 'a1', i2: 'b1', i3: 'b2' }, items);
    expect(tasks).toEqual([{ text: 'App', itemIds: ['a1'] }, { text: 'Other activity', itemIds: ['b1', 'b2'] }]);
  });
});

describe('the instructions to the AI ask for one log per project', () => {
  const { systemInstruction } = buildActivityPrompt([item('git:1')], { '/p/app': 'App' });
  it('asks for one task per project unless the work is truly unrelated', () => {
    expect(systemInstruction).toMatch(/ONE task per project/);
    expect(systemInstruction).toMatch(/unrelated/i);
  });
  it('asks for short sub-tasks and says trivial prompts are left out', () => {
    expect(systemInstruction).toMatch(/subtasks/);
    expect(systemInstruction).toMatch(/confirmations|trivial/i);
  });
  it('requires subtasks in the answer schema', () => {
    expect((ACTIVITY_TASKS_SCHEMA as any).properties.tasks.items.required).toContain('subtasks');
  });
});
