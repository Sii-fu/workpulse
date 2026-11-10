import { describe, it, expect, vi, afterEach } from 'vitest';
import { testSheetConnection, toSheetLog } from './sheetsSync';

afterEach(() => vi.unstubAllGlobals());

describe('testSheetConnection', () => {
  const answer = (body: unknown) =>
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => body })));
  const URL_ = 'https://script.google.com/macros/s/AKfyc123/exec';

  it('version 3 is current', async () => {
    answer({ status: 'ok', version: 3, message: 'WorkPulse Google Sheets Sync is active and connected!' });
    expect(await testSheetConnection(URL_)).toEqual({ success: true, message: 'WorkPulse Google Sheets Sync is active and connected!' });
  });
  it('version 2 still syncs logs but is old for the phone features', async () => {
    answer({ status: 'ok', version: 2, message: 'active' });
    const r = await testSheetConnection(URL_);
    expect(r.success).toBe(true);
    expect(r.message).toMatch(/Log sync works, but the phone page and evening email need the latest script/);
  });
  it('version 1 (no number) keeps the duplicate-rows message', async () => {
    answer({ status: 'ok' });
    expect((await testSheetConnection(URL_)).message).toMatch(/stop duplicate rows/);
  });
});
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
