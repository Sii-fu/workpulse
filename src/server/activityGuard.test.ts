import { describe, it, expect, vi } from 'vitest';
import { activityGuard } from './activityGuard';

const run = (bindHost: string, port: number, host: string | undefined) => {
  const next = vi.fn();
  const json = vi.fn();
  const res: any = { status: vi.fn(() => ({ json })) };
  activityGuard(bindHost, port)({ headers: { host } } as any, res, next);
  return { next, status: res.status, json };
};

describe('activityGuard', () => {
  it('lets a local request through when bound to 127.0.0.1', () => {
    const r = run('127.0.0.1', 3000, 'localhost:3000');
    expect(r.next).toHaveBeenCalledOnce();
    expect(r.status).not.toHaveBeenCalled();
  });
  it('refuses a foreign Host header with 403', () => {
    const r = run('127.0.0.1', 3000, 'evil.com:3000');
    expect(r.next).not.toHaveBeenCalled();
    expect(r.status).toHaveBeenCalledWith(403);
    expect(r.json.mock.calls[0][0].error).toMatch(/this computer/i);
  });
  it('refuses a good Host header when the server listens beyond localhost', () => {
    const r = run('0.0.0.0', 3000, 'localhost:3000');
    expect(r.next).not.toHaveBeenCalled();
    expect(r.status).toHaveBeenCalledWith(403);
  });
  it('is not widened by ALLOWED_HOSTS', () => {
    const before = process.env.ALLOWED_HOSTS;
    process.env.ALLOWED_HOSTS = 'evil.com';
    try {
      expect(run('127.0.0.1', 3000, 'evil.com:3000').status).toHaveBeenCalledWith(403);
    } finally {
      if (before === undefined) delete process.env.ALLOWED_HOSTS;
      else process.env.ALLOWED_HOSTS = before;
    }
  });
});
