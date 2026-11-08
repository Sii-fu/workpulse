import { describe, it, expect, beforeAll } from 'vitest';
import { findMisdatedLogs, applyDateFixes } from './logDates';
import type { WorkLog } from '../types';

beforeAll(() => {
  process.env.TZ = 'Asia/Dhaka';
});

const log = (o: Partial<WorkLog>): WorkLog => ({
  id: 'l', date: '2026-11-07', time: '02:30', projectId: 'p', projectName: 'P', description: 'night work',
  status: 'completed', tags: [], createdAt: '2026-11-07T20:30:00.000Z', ...o, // 02:30 local on Nov 8
});

describe('findMisdatedLogs (B5 one-off fix)', () => {
  it('finds a log made at 02:30 local that was filed under the UTC date', () => {
    expect(findMisdatedLogs([log({})])).toEqual([
      { id: 'l', description: 'night work', from: '2026-11-07', to: '2026-11-08' },
    ]);
  });
  it('leaves a daytime log alone (UTC and local date agree)', () => {
    expect(findMisdatedLogs([log({ date: '2026-11-08', createdAt: '2026-11-08T05:00:00.000Z' })])).toEqual([]);
  });
  it('leaves a log the user dated by hand to another day alone', () => {
    expect(findMisdatedLogs([log({ date: '2026-11-01' })])).toEqual([]);
  });
  it('ignores logs with a missing or invalid createdAt', () => {
    expect(findMisdatedLogs([log({ createdAt: '' }), log({ createdAt: 'nope' })])).toEqual([]);
  });
  it('applyDateFixes changes only the date of the listed logs', () => {
    const a = log({ id: 'a' });
    const b = log({ id: 'b', date: '2026-11-01' });
    const out = applyDateFixes([a, b], findMisdatedLogs([a, b]));
    expect(out[0]).toMatchObject({ id: 'a', date: '2026-11-08', time: '02:30', description: 'night work' });
    expect(out[1]).toEqual(b);
  });
});
