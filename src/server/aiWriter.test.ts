import { describe, it, expect, vi } from 'vitest';
import { CLAUDE_LOCAL_ONLY_MESSAGE, claudeWriterGuard, eodViaClaude, mayAnswer, standupViaClaude, writerFromRequest } from './aiWriter';
import { isLocalOnlyRequest } from './activityGuard';
import { buildBuckets } from '../utils/eodSynthesis';

describe('writerFromRequest', () => {
  it('is Claude unless the request asks for Gemini', () => {
    expect(writerFromRequest(undefined)).toBe('claude');
    expect(writerFromRequest('claude')).toBe('claude');
    expect(writerFromRequest('gemini')).toBe('gemini');
  });
});

describe('isLocalOnlyRequest / mayAnswer', () => {
  it('answers Claude only in the local setup', () => {
    expect(isLocalOnlyRequest('127.0.0.1', 'localhost:3000', 3000)).toBe(true);
    expect(isLocalOnlyRequest('127.0.0.1', '127.0.0.1:3000', 3000)).toBe(true);
    expect(isLocalOnlyRequest('127.0.0.1', 'evil.com:3000', 3000)).toBe(false);
    expect(isLocalOnlyRequest('127.0.0.1', 'localhost', 3000)).toBe(false);
    expect(isLocalOnlyRequest('0.0.0.0', 'localhost:3000', 3000)).toBe(false);
    expect(mayAnswer('claude', '0.0.0.0', 'localhost:3000', 3000)).toBe(false);
    expect(mayAnswer('claude', '127.0.0.1', 'evil.com', 3000)).toBe(false);
    expect(mayAnswer('claude', '127.0.0.1', 'localhost:3000', 3000)).toBe(true);
  });
  it('leaves Gemini requests alone', () => {
    expect(mayAnswer('gemini', '0.0.0.0', 'anything', 3000)).toBe(true);
  });
});

describe('claudeWriterGuard', () => {
  const run = (bindHost: string, host: string | undefined, body: unknown) => {
    const next = vi.fn();
    const json = vi.fn();
    const res: any = { status: vi.fn(() => ({ json })) };
    claudeWriterGuard(bindHost, 3000)({ headers: { host }, body } as any, res, next);
    return { next, status: res.status, json };
  };
  it('refuses a Claude request (explicit or default) on a foreign Host or a LAN bind with 403', () => {
    for (const body of [{ provider: 'claude' }, {}, undefined]) {
      const r = run('127.0.0.1', 'evil.com:3000', body);
      expect(r.next).not.toHaveBeenCalled();
      expect(r.status).toHaveBeenCalledWith(403);
      expect(r.json.mock.calls[0][0].error).toBe(CLAUDE_LOCAL_ONLY_MESSAGE);
    }
    expect(run('0.0.0.0', 'localhost:3000', { provider: 'claude' }).status).toHaveBeenCalledWith(403);
  });
  it("rejects provider 'none' with 400 instead of running Claude", () => {
    for (const host of ['localhost:3000', 'evil.com:3000']) {
      const r = run('127.0.0.1', host, { provider: 'none' });
      expect(r.next).not.toHaveBeenCalled();
      expect(r.status).toHaveBeenCalledWith(400);
    }
  });
  it('lets a local Claude request and any Gemini request through', () => {
    expect(run('127.0.0.1', 'localhost:3000', { provider: 'claude' }).next).toHaveBeenCalledOnce();
    expect(run('0.0.0.0', 'example.com', { provider: 'gemini' }).next).toHaveBeenCalledOnce();
  });
});

describe('standupViaClaude', () => {
  it('sends system text and prompt together with a { text } schema and returns the trimmed text', async () => {
    const runner = vi.fn().mockResolvedValue({ ok: true, data: { text: '  Done today\n' } });
    const r = await standupViaClaude(runner, 'the logs', 'be brief');
    expect(r).toEqual({ ok: true, text: 'Done today' });
    const arg = runner.mock.calls[0][0];
    expect(arg.prompt).toContain('be brief');
    expect(arg.prompt).toContain('the logs');
    expect(arg.schema.required).toEqual(['text']);
  });
  it('passes on the reason when Claude Code is missing, signed out or slow', async () => {
    const runner = vi.fn().mockResolvedValue({ ok: false, reason: 'Claude Code is not signed in.' });
    expect(await standupViaClaude(runner, 'p', 's')).toEqual({ ok: false, reason: 'Claude Code is not signed in.' });
  });
  it('rejects an answer without usable text', async () => {
    for (const data of [{}, { text: '   ' }, { text: 5 }, null]) {
      const r = await standupViaClaude(vi.fn().mockResolvedValue({ ok: true, data }), 'p', 's');
      expect(r.ok).toBe(false);
    }
  });
});

describe('eodViaClaude', () => {
  const tasks = [
    { id: 't1', title: 'Fix login', projectId: 'p1', stage: 'done', completed: true, elapsedSeconds: 1800 },
    { id: 't2', title: 'Write docs', projectId: 'p2', stage: 'blocked', elapsedSeconds: 600, blockReason: 'waiting' },
  ];
  const buckets = buildBuckets(tasks, [
    { id: 'p1', name: 'Alpha', color: '#111' },
    { id: 'p2', name: 'Beta', color: '#222' },
  ]);

  it('merges Claude text per group and falls back to the template for a group it skipped', async () => {
    const first = buckets[0];
    const runner = vi.fn().mockResolvedValue({
      ok: true,
      data: {
        synthesized: [
          { splitId: first.splitId, projectId: first.projectId, status: first.status, summaryBullets: '• Shipped the login fix.', tags: ['#auth'] },
        ],
      },
    });
    const r = await eodViaClaude(runner, buckets, '2026-11-11');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.logs).toHaveLength(buckets.length);
    expect(r.logs[0].summaryBullets).toBe('• Shipped the login fix.');
    expect(r.logs[0].source).toBe('ai');
    expect(r.fallbackSplitIds).toEqual([buckets[1].splitId]);
    expect(r.logs[1].source).toBe('template');
    expect(runner.mock.calls[0][0].prompt).toContain('2026-11-11');
    expect(runner.mock.calls[0][0].schema.required).toEqual(['synthesized']);
  });
  it('reports a failed or unreadable Claude run so the route can use the templates', async () => {
    const slow = vi.fn().mockResolvedValue({ ok: false, reason: 'Claude Code took too long to answer.' });
    expect(await eodViaClaude(slow, buckets, 'd')).toEqual({ ok: false, reason: 'Claude Code took too long to answer.' });
    const bad = await eodViaClaude(vi.fn().mockResolvedValue({ ok: true, data: { nope: 1 } }), buckets, 'd');
    expect(bad.ok).toBe(false);
  });
});
