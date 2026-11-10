process.env.TZ = 'Asia/Dhaka';
import { describe, it, expect } from 'vitest';
import { startSegment, endSegment, ensureOpenSegment, buildOvers } from './segments';
import type { BacklogTask, Project } from '../types';

const task = (over: Partial<BacklogTask> = {}): BacklogTask => ({
  id: 't1',
  title: 'T',
  projectId: 'pa',
  dueDate: '2026-11-10',
  completed: false,
  originalDate: '2026-11-10',
  isRolledOver: false,
  ...over,
});

// Dhaka is UTC+6: 09:00 local = 03:00Z.
const at = (hhmm: string) =>
  `2026-11-10T${String(Number(hhmm.slice(0, 2)) - 6).padStart(2, '0')}:${hhmm.slice(3)}:00.000Z`;
const ms = (hhmm: string) => Date.parse(at(hhmm));

describe('segments', () => {
  it('startSegment appends an open segment', () => {
    expect(startSegment(task(), 'A').segments).toEqual([{ start: 'A' }]);
  });
  it('startSegment twice does not add a second open segment', () => {
    const once = startSegment(task(), 'A');
    expect(startSegment(once, 'B').segments).toEqual([{ start: 'A' }]);
  });
  it('startSegment after a closed one appends', () => {
    const t = task({ segments: [{ start: 'A', end: 'B' }] });
    expect(startSegment(t, 'C').segments).toEqual([{ start: 'A', end: 'B' }, { start: 'C' }]);
  });
  it('endSegment closes the open segment', () => {
    expect(endSegment(task({ segments: [{ start: 'A' }] }), 'B').segments).toEqual([{ start: 'A', end: 'B' }]);
  });
  it('endSegment is a no-op with none open', () => {
    const t = task({ segments: [{ start: 'A', end: 'B' }] });
    expect(endSegment(t, 'C')).toBe(t);
    const none = task();
    expect(endSegment(none, 'C')).toBe(none);
  });
  it('ensureOpenSegment adds one only when none is open', () => {
    expect(ensureOpenSegment(task({ isRunning: true }), 'N').segments).toEqual([{ start: 'N' }]);
    const open = task({ segments: [{ start: 'A' }] });
    expect(ensureOpenSegment(open, 'N')).toBe(open);
  });
});

describe('buildOvers', () => {
  const rec = { clockIn: at('09:00') };
  const projects: Project[] = [
    { id: 'pa', name: 'Alpha', color: '#111111', isArchived: false },
    { id: 'pb', name: 'Beta', color: '#222222', isArchived: false },
  ];

  it('8h day at 10:25 has 8 overs of 6 balls, labelled by hour', () => {
    const overs = buildOvers(rec, 8, [], projects, ms('10:25'));
    expect(overs).toHaveLength(8);
    expect(overs.every((o) => o.balls.length === 6)).toBe(true);
    expect(overs[0].label).toBe('09');
    expect(overs[1].label).toBe('10');
  });

  it('a 09:00-09:40 segment fills balls 0-3 of over 0; the now slot is now; later is empty', () => {
    const t = task({ segments: [{ start: at('09:00'), end: at('09:40') }] });
    const overs = buildOvers(rec, 8, [t], projects, ms('10:25'));
    for (let i = 0; i < 4; i++) {
      expect(overs[0].balls[i]).toEqual({ kind: 'project', color: '#111111', projectName: 'Alpha' });
    }
    expect(overs[0].balls[4]).toEqual({ kind: 'empty' });
    expect(overs[0].balls[5]).toEqual({ kind: 'empty' });
    // 10:20 to 10:30 is slot 8 = over 1, ball 2 (over 1 starts at 10:00).
    expect(overs[1].balls[2]).toEqual({ kind: 'now' });
    expect(overs[1].balls[3]).toEqual({ kind: 'empty' });
    for (const o of overs.slice(2)) expect(o.balls.every((b) => b.kind === 'empty')).toBe(true);
  });

  it('the project with more overlap in a slot wins', () => {
    const a = task({ id: 'a', projectId: 'pa', segments: [{ start: at('09:00'), end: at('09:04') }] });
    const b = task({ id: 'b', projectId: 'pb', segments: [{ start: at('09:04'), end: at('09:10') }] });
    const overs = buildOvers(rec, 8, [a, b], projects, ms('10:25'));
    expect(overs[0].balls[0]).toMatchObject({ kind: 'project', projectName: 'Beta' });
  });

  it('an unknown project is Unassigned grey', () => {
    const t = task({ projectId: 'gone', segments: [{ start: at('09:00'), end: at('09:10') }] });
    expect(buildOvers(rec, 8, [t], projects, ms('10:25'))[0].balls[0]).toEqual({
      kind: 'project',
      color: '#8a8f98',
      projectName: 'Unassigned',
    });
  });

  it('an open segment runs to now', () => {
    const t = task({ segments: [{ start: at('10:00') }] });
    const overs = buildOvers(rec, 8, [t], projects, ms('10:25'));
    expect(overs[1].balls[0]).toMatchObject({ kind: 'project' });
    expect(overs[1].balls[1]).toMatchObject({ kind: 'project' });
    expect(overs[1].balls[2]).toEqual({ kind: 'now' });
  });

  it('70 minutes past leave gives 10 overs', () => {
    expect(buildOvers(rec, 8, [], projects, ms('18:10'))).toHaveLength(10);
  });

  it('no segments: everything empty except now', () => {
    const balls = buildOvers(rec, 8, [], projects, ms('10:25')).flatMap((o) => o.balls);
    expect(balls.filter((b) => b.kind === 'now')).toHaveLength(1);
    expect(balls.filter((b) => b.kind === 'empty')).toHaveLength(47);
  });
});
