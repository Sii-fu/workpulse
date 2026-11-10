import { describe, it, expect } from 'vitest';
import { addDays, localDateStr } from './dates';
import { loadStoredData, saveLogs, saveWorkdays, rollOverTasks, CURRENT_SCHEMA_VERSION } from './storage';

const log = (id: string) => ({
  id,
  date: '2026-01-01',
  time: '10:00',
  projectId: 'p1',
  projectName: 'P',
  description: 'd',
  status: 'completed',
  tags: [],
  createdAt: '2026-01-01T10:00:00.000Z',
});
const task = (id: string) => ({
  id,
  title: 't',
  projectId: 'p1',
  dueDate: '2999-01-01',
  completed: false,
  stage: 'planned',
  originalDate: '2026-01-01',
  isRolledOver: false,
});

const corruptKeys = (prefix: string) =>
  Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i) as string).filter((k) =>
    k.startsWith(prefix),
  );

describe('loadStoredData', () => {
  it('corrupt tags key does not affect logs or backlog', () => {
    localStorage.setItem('workpulse_logs', JSON.stringify([log('a')]));
    localStorage.setItem('workpulse_backlog', JSON.stringify([task('t1')]));
    localStorage.setItem('workpulse_tags', '{bad');
    const before = localStorage.getItem('workpulse_logs');

    const r = loadStoredData();

    expect(r.logs.map((l) => l.id)).toEqual(['a']);
    expect(r.backlog.map((t) => t.id)).toEqual(['t1']);
    expect(r.tags).toEqual([]);
    expect(r.warnings).toHaveLength(1);
    expect(corruptKeys('workpulse_tags_corrupt_')).toHaveLength(1);
    expect(localStorage.getItem(corruptKeys('workpulse_tags_corrupt_')[0])).toBe('{bad');
    expect(localStorage.getItem('workpulse_logs')).toBe(before);
  });

  it('a timer left running across midnight loads under today and is saved; a paused task keeps its date', () => {
    const yesterday = addDays(localDateStr(), -1);
    const open = [{ start: '2026-11-08T01:00:00.000Z' }];
    localStorage.setItem(
      'workpulse_backlog',
      JSON.stringify([
        { ...task('run'), dueDate: yesterday, stage: 'in_progress', isRunning: true, segments: open },
        { ...task('paused'), dueDate: yesterday, stage: 'paused' },
      ]),
    );
    const r = loadStoredData();
    expect(r.backlog.find((t) => t.id === 'run')?.dueDate).toBe(localDateStr());
    expect(r.backlog.find((t) => t.id === 'paused')?.dueDate).toBe(yesterday);
    const saved = JSON.parse(localStorage.getItem('workpulse_backlog') as string);
    expect(saved.find((t: { id: string }) => t.id === 'run').dueDate).toBe(localDateStr());
  });

  it('valid JSON of the wrong type is treated as corrupt, without throwing', () => {
    localStorage.setItem('workpulse_logs', 'null');
    localStorage.setItem('workpulse_backlog', '{}');
    const r = loadStoredData();
    expect(r.logs).toEqual([]);
    expect(r.backlog).toEqual([]);
    expect(r.warnings).toHaveLength(2);
  });

  it('first run (no keys) returns seed data and no warnings', () => {
    const r = loadStoredData();
    expect(r.logs.length).toBeGreaterThan(0);
    expect(r.warnings).toEqual([]);
  });

  it('a corrupt key is never replaced by seed data', () => {
    localStorage.setItem('workpulse_backlog', '{bad');
    expect(loadStoredData().backlog).toEqual([]);
  });

  it('workdays: absent key gives an empty object and no warning', () => {
    const r = loadStoredData();
    expect(r.workdays).toEqual({});
    expect(r.warnings).toEqual([]);
  });

  it('workdays: a stored valid object round-trips through saveWorkdays', () => {
    const w = { '2026-11-10': { clockIn: '2026-11-10T03:48:00.000Z', clockOut: '2026-11-10T11:00:00.000Z' } };
    expect(saveWorkdays(w).ok).toBe(true);
    expect(loadStoredData().workdays).toEqual(w);
  });

  it('workdays: garbage is quarantined with a warning and does not touch other keys', () => {
    localStorage.setItem('workpulse_logs', JSON.stringify([log('a')]));
    localStorage.setItem('workpulse_workdays', '{bad');
    const r = loadStoredData();
    expect(r.workdays).toEqual({});
    expect(r.logs.map((l) => l.id)).toEqual(['a']);
    expect(r.warnings).toHaveLength(1);
    const keys = corruptKeys('workpulse_workdays_corrupt_');
    expect(keys).toHaveLength(1);
    expect(localStorage.getItem(keys[0])).toBe('{bad');
  });

  it('workdays: valid JSON of the wrong shape is quarantined too', () => {
    localStorage.setItem('workpulse_workdays', JSON.stringify({ '2026-11-10': { clockIn: 7 } }));
    expect(loadStoredData().workdays).toEqual({});
    expect(corruptKeys('workpulse_workdays_corrupt_')).toHaveLength(1);
  });

  it('maps a stored legacy theme to its v2 theme', () => {
    localStorage.setItem('workpulse_settings', JSON.stringify({ theme: 'matrix' }));
    expect(loadStoredData().settings.theme).toBe('console');
    localStorage.setItem('workpulse_settings', JSON.stringify({ theme: 'minimalist' }));
    expect(loadStoredData().settings.theme).toBe('timecard');
  });

  it('a stored workdayHours outside 1-16 or not a number loads as undefined', () => {
    for (const bad of [0, 17, -3, 'x', null, 1e999]) {
      localStorage.setItem('workpulse_settings', JSON.stringify({ workdayHours: bad }));
      expect(loadStoredData().settings.workdayHours).toBeUndefined();
    }
    localStorage.setItem('workpulse_settings', JSON.stringify({ workdayHours: 7.5 }));
    expect(loadStoredData().settings.workdayHours).toBe(7.5);
  });

  it('writes the schema version', () => {
    loadStoredData();
    expect(localStorage.getItem('workpulse_schema_version')).toBe(String(CURRENT_SCHEMA_VERSION));
  });
});

describe('save*', () => {
  it('returns ok:false when setItem throws', () => {
    (globalThis as any).localStorage.setItem = () => {
      throw new DOMException('full', 'QuotaExceededError');
    };
    expect(saveLogs([]).ok).toBe(false);
  });
  it('returns ok:true on success', () => {
    expect(saveLogs([]).ok).toBe(true);
  });
});

describe('rollOverTasks (C3)', () => {
  const base = { id: 't', title: 'T', projectId: 'p', dueDate: '2999-01-01', originalDate: '2026-01-01', isRolledOver: false } as any;
  it('completed:true with a stale stage becomes stage done', () => {
    const { tasks } = rollOverTasks([{ ...base, completed: true, stage: 'in_progress' }]);
    expect(tasks[0]).toMatchObject({ stage: 'done', completed: true, isRunning: false });
  });
  it('stage done with completed:false becomes completed', () => {
    const { tasks } = rollOverTasks([{ ...base, completed: false, stage: 'done' }]);
    expect(tasks[0]).toMatchObject({ stage: 'done', completed: true });
  });
  it('a task with no stage gets one from completed', () => {
    expect(rollOverTasks([{ ...base, completed: false }]).tasks[0]).toMatchObject({ stage: 'planned', completed: false });
  });
  it('never changes dueDate: a planned task due yesterday stays there and is not a change', () => {
    const { tasks, changed } = rollOverTasks([{ ...base, dueDate: '2026-11-09', completed: false, stage: 'planned' }]);
    expect(tasks[0].dueDate).toBe('2026-11-09');
    expect(changed).toBe(false);
  });
  it('a task already marked rolled over keeps its current date', () => {
    const { tasks } = rollOverTasks(
      [{ ...base, dueDate: '2026-11-10', isRolledOver: true, originalDate: '2026-11-08', completed: false, stage: 'planned' }],
    );
    expect(tasks[0].dueDate).toBe('2026-11-10');
  });
  it('a running task due on an earlier day keeps that date but still gets an open segment', () => {
    const { tasks, changed } = rollOverTasks(
      [{ ...base, dueDate: '2026-11-01', completed: false, stage: 'in_progress' }],
      '2026-11-08T05:00:00.000Z',
    );
    expect(changed).toBe(true);
    expect(tasks[0]).toMatchObject({ dueDate: '2026-11-01', isRunning: true });
  });
  it('a running task with no open segment gets one starting now, and that counts as changed', () => {
    const now = '2026-11-08T05:00:00.000Z';
    const { tasks, changed } = rollOverTasks([{ ...base, completed: false, stage: 'in_progress' }], now);
    expect(changed).toBe(true);
    expect(tasks[0].segments).toEqual([{ start: now }]);
  });
  it('a running task that already has an open segment is left alone and is not a change', () => {
    const segments = [{ start: '2026-11-08T01:00:00.000Z' }];
    const { tasks, changed } = rollOverTasks(
      [{ ...base, completed: false, stage: 'in_progress', segments }],
      '2026-11-08T05:00:00.000Z',
    );
    expect(changed).toBe(false);
    expect(tasks[0].segments).toEqual(segments);
  });
  it('tasks that are not running get no segment', () => {
    const { tasks, changed } = rollOverTasks([{ ...base, completed: false, stage: 'paused' }]);
    expect(changed).toBe(false);
    expect(tasks[0].segments).toBeUndefined();
  });
});
