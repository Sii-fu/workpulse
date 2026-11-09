import { describe, it, expect } from 'vitest';
import { toSheetLog } from './sheetsSync';
import type { WorkLog } from '../types';

const log = (over: Partial<WorkLog> = {}): WorkLog => ({
  id: 'log-1', date: '2026-11-09', time: '10:00', projectId: 'p', projectName: 'P',
  description: 'x', status: 'completed', tags: [], createdAt: 'c', ...over,
});

describe('toSheetLog', () => {
  it('never sends the activity source ids to the sheet', () => {
    const out = toSheetLog(log({ sourceIds: ['git:abc', 'claude:s:u'] }));
    expect(JSON.stringify(out)).not.toContain('sourceIds');
    expect(JSON.stringify(out)).not.toContain('git:abc');
  });
  it('still replaces the image with a flag', () => {
    expect(toSheetLog(log({ imageBase64: 'AAAA' })).imageBase64).toBe('true');
    expect(toSheetLog(log()).imageBase64).toBe('');
  });
});
