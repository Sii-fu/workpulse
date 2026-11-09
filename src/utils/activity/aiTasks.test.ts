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
      { text: 'A', itemIds: ['git:1'] },
      { text: 'B', itemIds: ['git:2'] },
      { text: 'Other activity', itemIds: ['git:3'] },
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
  it('puts items that were never sent to the model (over the cap) into "Other activity"', () => {
    const extra = [...items, item('git:4')];
    const raw = { tasks: [{ text: 'All', itemIds: ['i1', 'i2', 'i3'] }] };
    expect(parseAiTasks(raw, shortToId, extra)).toEqual([
      { text: 'All', itemIds: ['git:1', 'git:2', 'git:3'] },
      { text: 'Other activity', itemIds: ['git:4'] },
    ]);
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
  it('describes { tasks: [{ text, itemIds[] }] }', () => {
    expect(ACTIVITY_TASKS_SCHEMA).toMatchObject({
      type: 'object',
      required: ['tasks'],
      properties: { tasks: { type: 'array', items: { required: ['text', 'itemIds'] } } },
    });
  });
});
