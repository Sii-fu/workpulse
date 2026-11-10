import { describe, it, expect, beforeAll } from 'vitest';
import type { WorkLog } from '../types';
import { weekDays, weekTotals } from './weekTotals';

beforeAll(() => {
  process.env.TZ = 'Asia/Dhaka';
});

const log = (date: string, projectId: string, durationMinutes?: number): WorkLog => ({
  id: `${date}-${projectId}-${durationMinutes}`,
  date,
  time: '10:00',
  projectId,
  projectName: projectId,
  description: 'x',
  status: 'completed',
  tags: [],
  durationMinutes,
  createdAt: '2026-11-10T00:00:00.000Z',
});

describe('weekDays', () => {
  it('returns Monday to Sunday around a midweek date', () => {
    expect(weekDays('2026-11-12')).toEqual([
      '2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15',
    ]);
  });

  it('keeps a Sunday in the week that ends on it', () => {
    expect(weekDays('2026-11-15')[0]).toBe('2026-11-09');
    expect(weekDays('2026-11-09')[6]).toBe('2026-11-15');
  });
});

describe('weekTotals', () => {
  const days = weekDays('2026-11-12');

  it('sums per day and per project, biggest project first, undefined as zero', () => {
    const out = weekTotals([
      log('2026-11-10', 'a', 30),
      log('2026-11-10', 'b', 90),
      log('2026-11-10', 'a', undefined),
      log('2026-11-10', 'a', 15),
      log('2026-11-12', 'a', 60),
      log('2026-11-20', 'a', 500),
    ], days);
    expect(out).toHaveLength(7);
    expect(out[1]).toEqual({
      date: '2026-11-10',
      total: 135,
      byProject: [{ projectId: 'b', minutes: 90 }, { projectId: 'a', minutes: 45 }],
    });
    expect(out[3].total).toBe(60);
    expect(out[0]).toEqual({ date: '2026-11-09', total: 0, byProject: [] });
  });
});
