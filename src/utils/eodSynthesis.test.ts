import { describe, it, expect } from 'vitest';
import { buildBuckets, mergeSynthesis, templateLog } from './eodSynthesis';

const projects = [
  { id: 'a', name: 'Alpha', color: '#111' },
  { id: 'b', name: 'Beta', color: '#222' },
];
const t = (o: any) => ({ id: 'x', title: 'Task', projectId: 'a', stage: 'done', completed: true, elapsedSeconds: 600, ...o });

describe('buildBuckets', () => {
  it('splits by project and status', () => {
    const b = buildBuckets(
      [
        t({ id: '1' }),
        t({ id: '2', stage: 'blocked', completed: false }),
        t({ id: '3', projectId: 'b', stage: 'in_progress', completed: false }),
      ],
      projects,
    );
    expect(b.map((x) => x.splitId).sort()).toEqual(['a_blocked', 'a_completed', 'b_in_progress']);
  });

  it('keeps a planned task that has tracked time (B14) but skips one with none', () => {
    const b = buildBuckets(
      [
        t({ id: '1', stage: 'planned', completed: false, elapsedSeconds: 900 }),
        t({ id: '2', stage: 'planned', completed: false, elapsedSeconds: 0 }),
      ],
      projects,
    );
    expect(b).toHaveLength(1);
    expect(b[0].status).toBe('in_progress');
    expect(b[0].tasks.map((x) => x.id)).toEqual(['1']);
  });
});

describe('mergeSynthesis (B9)', () => {
  const buckets = () =>
    buildBuckets(
      [t({ id: '1' }), t({ id: '2', projectId: 'b' }), t({ id: '3', projectId: 'b', stage: 'blocked', completed: false })],
      projects,
    );

  it('keeps every group when the AI returns fewer than it was given', () => {
    const { logs, fallbackSplitIds } = mergeSynthesis(buckets(), [
      { splitId: 'a_completed', summaryBullets: '• Shipped it', durationMinutes: 45, tags: ['#x'] },
    ]);
    expect(logs).toHaveLength(3);
    expect(logs.find((l) => l.splitId === 'a_completed')).toMatchObject({
      source: 'ai',
      durationMinutes: 45,
      summaryBullets: '• Shipped it',
    });
    expect(fallbackSplitIds.sort()).toEqual(['b_blocked', 'b_completed']);
    expect(logs.filter((l) => l.source === 'template')).toHaveLength(2);
  });

  it('falls back for a group whose AI text is empty or not a string', () => {
    const { fallbackSplitIds } = mergeSynthesis(buckets(), [
      { splitId: 'a_completed', summaryBullets: '   ' },
      { splitId: 'b_completed', summaryBullets: 42 },
      { splitId: 'b_blocked', summaryBullets: '• ok' },
    ]);
    expect(fallbackSplitIds.sort()).toEqual(['a_completed', 'b_completed']);
  });

  it('ignores AI groups it was never given and non-object junk', () => {
    const { logs } = mergeSynthesis(buckets(), [null, 'x', { splitId: 'zzz_completed', summaryBullets: '• ghost' }]);
    expect(logs).toHaveLength(3);
    expect(logs.every((l) => l.source === 'template')).toBe(true);
  });

  it('the AI cannot rename the project', () => {
    const { logs } = mergeSynthesis(buckets(), [{ splitId: 'a_completed', projectName: 'Hacked', summaryBullets: '• ok' }]);
    expect(logs.find((l) => l.splitId === 'a_completed')!.projectName).toBe('Alpha');
  });

  it('works when the AI returns nothing usable', () => {
    expect(mergeSynthesis(buckets(), undefined as any).logs).toHaveLength(3);
  });
});

describe('templateLog', () => {
  it('mentions the blocker reason', () => {
    const b = buildBuckets([t({ stage: 'blocked', completed: false, blockReason: 'waiting on DevOps' })], projects)[0];
    expect(templateLog(b).summaryBullets).toContain('waiting on DevOps');
  });
});
