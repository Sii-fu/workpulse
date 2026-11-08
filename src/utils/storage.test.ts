import { describe, it, expect } from 'vitest';
import { loadStoredData, saveLogs, rollOverTasks, CURRENT_SCHEMA_VERSION } from './storage';

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
    const { tasks } = rollOverTasks([{ ...base, completed: true, stage: 'in_progress' }], '2026-11-08');
    expect(tasks[0]).toMatchObject({ stage: 'done', completed: true, isRunning: false });
  });
  it('stage done with completed:false becomes completed', () => {
    const { tasks } = rollOverTasks([{ ...base, completed: false, stage: 'done' }], '2026-11-08');
    expect(tasks[0]).toMatchObject({ stage: 'done', completed: true });
  });
  it('a task with no stage gets one from completed', () => {
    expect(rollOverTasks([{ ...base, completed: false }], '2026-11-08').tasks[0]).toMatchObject({ stage: 'planned', completed: false });
  });
  it('past-due unfinished tasks roll over to today and finished ones do not', () => {
    const { tasks, changed } = rollOverTasks(
      [{ ...base, id: 'a', dueDate: '2026-11-01', completed: false, stage: 'in_progress' }, { ...base, id: 'b', dueDate: '2026-11-01', completed: true, stage: 'done' }],
      '2026-11-08',
    );
    expect(changed).toBe(true);
    expect(tasks[0]).toMatchObject({ dueDate: '2026-11-08', isRolledOver: true, isRunning: true });
    expect(tasks[1].dueDate).toBe('2026-11-01');
  });
});
