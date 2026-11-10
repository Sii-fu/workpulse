import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  pullInbox,
  pushState,
  ackInbox,
  setPhonePin,
  setEmailSchedule,
  sendTestEmail,
  resetPhoneAccess,
  getScriptVersion,
} from './phoneApi';
import type { PhoneSnapshot } from './phoneSync';

const URL_ = 'https://script.google.com/macros/s/AKfyc123/exec';

function stubFetch(impl: (url: string, init: RequestInit) => Promise<unknown> | unknown) {
  const fn = vi.fn(async (url: string, init: RequestInit) => impl(url, init));
  vi.stubGlobal('fetch', fn);
  return fn;
}

const reply = (body: unknown, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
const sentBody = (fn: ReturnType<typeof stubFetch>) => JSON.parse(String(fn.mock.calls[0][1].body));

afterEach(() => vi.unstubAllGlobals());

describe('phoneApi', () => {
  it('pullInbox posts the token (no pin) to the proxy and parses items', async () => {
    const items = [{ id: 'phone-1', title: 'T', projectId: 'p', projectName: 'P', dueDate: '2026-11-12', createdAt: 'x' }];
    const f = stubFetch(() => reply({ status: 'ok', items }));
    const r = await pullInbox(URL_, 'tok123');
    expect(r.ok).toBe(true);
    expect(r.data?.items).toEqual(items);
    expect(f.mock.calls[0][0]).toBe('/api/sheets/proxy');
    expect(sentBody(f)).toEqual({
      scriptUrl: URL_,
      action: 'pullInbox',
      method: 'POST',
      payload: { action: 'pullInbox', token: 'tok123' },
    });
    expect(JSON.stringify(sentBody(f))).not.toContain('"pin"');
  });

  it('turns a network failure into a plain sentence', async () => {
    stubFetch(() => Promise.reject(new TypeError('Failed to fetch')));
    const r = await pullInbox(URL_, 't');
    expect(r.ok).toBe(false);
    expect(r.message).not.toMatch(/failed to fetch/i);
    expect(r.message.length).toBeGreaterThan(10);
  });

  it('surfaces the script error code and its own message', async () => {
    stubFetch(() => reply({ status: 'error', code: 'locked', message: 'Phone access is locked for 15 minutes.' }));
    const r = await pullInbox(URL_, 't');
    expect(r).toEqual({ ok: false, code: 'locked', message: 'Phone access is locked for 15 minutes.' });
  });

  it('falls back to a plain sentence for a coded error with no message', async () => {
    stubFetch(() => reply({ status: 'error', code: 'bad_token' }));
    const r = await pullInbox(URL_, 't');
    expect(r.code).toBe('bad_token');
    expect(r.message).toMatch(/not linked/);
  });

  it('treats a proxy error body and a non-JSON answer as failures', async () => {
    stubFetch(() => reply({ error: 'Only Google Apps Script URLs are allowed' }, 400));
    expect((await ackInbox(URL_, 't', ['a'])).ok).toBe(false);
    stubFetch(() => ({ ok: true, status: 200, json: async () => { throw new SyntaxError('Unexpected token <'); } }));
    const r = await ackInbox(URL_, 't', ['a']);
    expect(r.ok).toBe(false);
    expect(r.code).toBe('bad_response');
  });

  it('refuses an empty script URL without calling fetch', async () => {
    const f = stubFetch(() => reply({ status: 'ok' }));
    const r = await sendTestEmail('  ', 't');
    expect(r.ok).toBe(false);
    expect(f).not.toHaveBeenCalled();
  });

  it('keeps the PIN out of every URL and sends it only in the body', async () => {
    const f = stubFetch(() => reply({ status: 'ok', token: 'newtoken' }));
    const r = await setPhonePin(URL_, '4821', { oldPin: '1111' });
    expect(r.data?.token).toBe('newtoken');
    await resetPhoneAccess(URL_, '4821', '9999');
    for (const call of f.mock.calls) {
      expect(String(call[0])).not.toContain('?');
      expect(String(call[0])).not.toContain('4821');
    }
    expect(JSON.parse(String(f.mock.calls[0][1].body)).payload).toEqual({ action: 'setPin', pin: '4821', oldPin: '1111' });
    expect(JSON.parse(String(f.mock.calls[1][1].body)).payload).toEqual({ action: 'resetAccess', pin: '4821', newPin: '9999' });
  });

  it('sends the other actions with the expected payloads', async () => {
    const f = stubFetch(() => reply({ status: 'ok' }));
    await setEmailSchedule(URL_, 'tok', { enabled: true, hour: 18, minute: 0, tz: 'Asia/Dhaka' });
    await sendTestEmail(URL_, 'tok');
    await ackInbox(URL_, 'tok', ['a', 'b']);
    const snap = { tasks: [], logs: [], workdays: {}, projects: [], workdayHours: 8, tz: 'Asia/Dhaka', deviceId: 'd', today: '2026-11-11' } as PhoneSnapshot;
    await pushState(URL_, 'tok', snap);
    const payloads = f.mock.calls.map((c) => JSON.parse(String(c[1].body)).payload);
    expect(payloads[0]).toEqual({ action: 'setEmail', token: 'tok', enabled: true, hour: 18, minute: 0, tz: 'Asia/Dhaka' });
    expect(payloads[1]).toEqual({ action: 'sendTestEmail', token: 'tok' });
    expect(payloads[2]).toEqual({ action: 'ackInbox', token: 'tok', ids: ['a', 'b'] });
    expect(payloads[3]).toEqual({ action: 'pushState', token: 'tok', ...snap });
  });

  it('getScriptVersion reads the ping version, or null when unreachable or not the script', async () => {
    const f = stubFetch(() => reply({ status: 'ok', version: 3 }));
    expect(await getScriptVersion(URL_)).toBe(3);
    expect(sentBody(f)).toEqual({ scriptUrl: URL_, action: 'ping', method: 'GET' });
    stubFetch(() => reply({ status: 'ok' }));
    expect(await getScriptVersion(URL_)).toBe(1);
    stubFetch(() => reply({ error: 'x' }, 502));
    expect(await getScriptVersion(URL_)).toBeNull();
    stubFetch(() => Promise.reject(new Error('down')));
    expect(await getScriptVersion(URL_)).toBeNull();
  });
});
