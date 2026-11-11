import { EventEmitter } from 'events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PICK_FOLDER_SCRIPT, createFolderPicker, isAllowedPickOrigin, pickFolderArgs } from './folderPicker';

class FakeChild extends EventEmitter {
  stdout = new EventEmitter();
  kill = vi.fn(() => {
    this.emit('close', null);
    return true;
  });
  finish(output: string, code = 0) {
    if (output) this.stdout.emit('data', Buffer.from(output));
    this.emit('close', code);
  }
}

function picker(opts: { platform?: NodeJS.Platform; timeoutMs?: number } = {}) {
  const children: FakeChild[] = [];
  const spawnFn = vi.fn(() => {
    const c = new FakeChild();
    children.push(c);
    return c;
  });
  const p = createFolderPicker({ platform: opts.platform ?? 'win32', spawnFn: spawnFn as never, timeoutMs: opts.timeoutMs });
  return { p, children, spawnFn };
}

describe('createFolderPicker', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('returns the chosen path, trimmed', async () => {
    const { p, children } = picker();
    const call = p.pick();
    children[0].finish('  C:\\work\\HMIS\r\n');
    expect(await call.result).toEqual({ status: 200, body: { path: 'C:\\work\\HMIS' } });
  });

  it('treats empty output as cancelled', async () => {
    const { p, children } = picker();
    const call = p.pick();
    children[0].finish('');
    expect(await call.result).toEqual({ status: 200, body: { cancelled: true } });
  });

  it('answers 500 in plain words when PowerShell fails', async () => {
    const { p, children } = picker();
    const call = p.pick();
    children[0].finish('', 1);
    const r = await call.result;
    expect(r.status).toBe(500);
    expect(JSON.stringify(r.body)).toContain('Type the folder path instead.');
  });

  it('kills the child on timeout', async () => {
    const { p, children } = picker({ timeoutMs: 1000 });
    const call = p.pick();
    vi.advanceTimersByTime(1000);
    expect((await call.result).status).toBe(504);
    expect(children[0].kill).toHaveBeenCalled();
  });

  it('kills the child when the caller cancels, and frees the slot', async () => {
    const { p, children } = picker();
    const call = p.pick();
    call.cancel();
    await call.result;
    expect(children[0].kill).toHaveBeenCalled();
    const next = p.pick();
    children[1].finish('C:\\x');
    expect((await next.result).status).toBe(200);
  });

  it('answers 409 to a second request while one dialog is open, then frees the slot', async () => {
    const { p, children, spawnFn } = picker();
    const first = p.pick();
    const second = p.pick();
    expect((await second.result).status).toBe(409);
    expect(spawnFn).toHaveBeenCalledTimes(1);
    children[0].finish('C:\\a');
    await first.result;
    p.pick();
    expect(spawnFn).toHaveBeenCalledTimes(2);
  });

  it('answers 501 off Windows without starting anything', async () => {
    const { p, spawnFn } = picker({ platform: 'linux' });
    expect(await p.pick().result).toEqual({ status: 501, body: { error: 'Type the folder path instead.' } });
    expect(spawnFn).not.toHaveBeenCalled();
  });
});

describe('pickFolderArgs', () => {
  it('passes the fixed script as an encoded command', () => {
    const args = pickFolderArgs();
    expect(args).toContain('-STA');
    const encoded = args[args.indexOf('-EncodedCommand') + 1];
    expect(Buffer.from(encoded, 'base64').toString('utf16le')).toBe(PICK_FOLDER_SCRIPT);
    expect(PICK_FOLDER_SCRIPT).toContain('TopMost');
    expect(PICK_FOLDER_SCRIPT).toContain('ShowDialog($owner)');
  });
});

describe('isAllowedPickOrigin', () => {
  it('allows a missing Origin and this server only', () => {
    expect(isAllowedPickOrigin(undefined, 3000)).toBe(true);
    expect(isAllowedPickOrigin('http://localhost:3000', 3000)).toBe(true);
    expect(isAllowedPickOrigin('http://127.0.0.1:3000', 3000)).toBe(true);
    expect(isAllowedPickOrigin('http://localhost:3001', 3000)).toBe(false);
    expect(isAllowedPickOrigin('https://localhost:3000', 3000)).toBe(false);
    expect(isAllowedPickOrigin('http://evil.example', 3000)).toBe(false);
    expect(isAllowedPickOrigin('null', 3000)).toBe(false);
  });
});
