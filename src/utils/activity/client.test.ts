import { describe, it, expect, vi, afterEach } from 'vitest';
import { scanActivityApi, suggestTasksApi } from './client';

const req = { date: '2026-11-09', folders: [], sources: { claude: false, git: true } };
const reply = (status: number, body: unknown) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

afterEach(() => vi.unstubAllGlobals());

describe('scanActivityApi', () => {
  it('turns a network failure into a plain sentence', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    const err = await scanActivityApi(req).catch((e) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err.message).not.toMatch(/failed to fetch/i);
    expect(err.message.length).toBeGreaterThan(10);
  });
  it('surfaces the server message on a non-OK answer', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply(403, { error: 'Only works on this computer.' })));
    await expect(scanActivityApi(req)).rejects.toThrow('Only works on this computer.');
  });
  it('returns the parsed body on success and posts the request as JSON', async () => {
    const body = { items: [], status: { claude: { ok: true, count: 0 }, git: { ok: true, count: 0 } } };
    const f = vi.fn().mockResolvedValue(reply(200, body));
    vi.stubGlobal('fetch', f);
    await expect(scanActivityApi(req)).resolves.toEqual(body);
    expect(f.mock.calls[0][0]).toBe('/api/activity/scan');
    expect(JSON.parse(f.mock.calls[0][1].body)).toEqual(req);
  });
});

describe('suggestTasksApi', () => {
  it('returns null tasks and the notice when the server falls back', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply(200, { tasks: null, notice: 'No key' })));
    await expect(suggestTasksApi({ items: [], projectNameByFolder: {}, customApiKey: '', provider: 'claude' as const })).resolves.toEqual({ tasks: null, notice: 'No key' });
  });
  it('turns a network failure into a plain sentence', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    const err = await suggestTasksApi({ items: [], projectNameByFolder: {}, customApiKey: '', provider: 'claude' as const }).catch((e) => e);
    expect(err.message).not.toMatch(/failed to fetch/i);
  });
});
