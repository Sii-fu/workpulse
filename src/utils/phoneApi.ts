import { plainSheetMessage } from './aiErrors';
import type { InboxItem, PhoneSnapshot } from './phoneSync';

// Calls to the user's Google Apps Script through the local /api/sheets/proxy. The PIN and the token
// travel only in the POST body, never in a URL.

export interface PhoneApiResult<T = unknown> {
  ok: boolean;
  message: string;
  code?: string;
  data?: T;
}

const online = (): boolean => typeof navigator === 'undefined' || navigator.onLine !== false;

const CODE_MESSAGES: Record<string, string> = {
  no_pin: 'No phone PIN is set yet. Set one in Settings.',
  bad_pin: 'That PIN is not right.',
  bad_token: 'This computer is not linked to the phone page any more. Set the PIN again in Settings.',
  locked: 'Too many wrong PINs. Try again in 15 minutes.',
  bad_request: 'The Sheet script did not understand the request. Update and redeploy the script.',
};

function failure(raw: string | undefined, code?: string): PhoneApiResult<never> {
  // A message the script wrote itself is already a plain sentence; only technical text from the
  // network or the proxy goes through plainSheetMessage.
  const own = (raw || '').trim();
  const message = code ? own || CODE_MESSAGES[code] || plainSheetMessage('', online()) : plainSheetMessage(raw, online());
  const result: PhoneApiResult<never> = { ok: false, message: message.length > 200 ? `${message.slice(0, 197)}...` : message };
  if (code) result.code = code;
  return result;
}

async function call<T>(
  url: string,
  action: string,
  fields: Record<string, unknown>,
  okMessage: string,
): Promise<PhoneApiResult<T>> {
  const scriptUrl = (url || '').trim();
  if (!scriptUrl) return failure('Google Apps Script Web App URL is not set in Settings.', 'no_url');

  let res: Response;
  try {
    res = await fetch('/api/sheets/proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scriptUrl, action, method: 'POST', payload: { action, ...fields } }),
    });
  } catch (err: any) {
    return failure(err?.message || 'Failed to fetch');
  }

  let body: any = null;
  try {
    body = await res.json();
  } catch {
    // not JSON: handled below
  }
  if (!body || typeof body !== 'object') {
    return failure('The Sheet script did not answer. Check the script URL and that it is deployed for "Anyone".', 'bad_response');
  }
  if (res.ok && body.status === 'ok') return { ok: true, message: okMessage, data: body as T };
  const code = typeof body.code === 'string' ? body.code : undefined;
  return failure(body.message || body.error, code);
}

export function setPhonePin(
  url: string,
  pin: string,
  auth: { token?: string; oldPin?: string },
): Promise<PhoneApiResult<{ token: string }>> {
  const fields: Record<string, unknown> = { pin };
  if (auth.token) fields.token = auth.token;
  if (auth.oldPin) fields.oldPin = auth.oldPin;
  return call(url, 'setPin', fields, 'Phone PIN saved.');
}

export function pushState(url: string, token: string, snapshot: PhoneSnapshot): Promise<PhoneApiResult> {
  return call(url, 'pushState', { token, ...snapshot }, 'Phone page updated.');
}

export function pullInbox(url: string, token: string): Promise<PhoneApiResult<{ items: InboxItem[] }>> {
  return call(url, 'pullInbox', { token }, 'Inbox checked.');
}

export function ackInbox(url: string, token: string, ids: string[]): Promise<PhoneApiResult> {
  return call(url, 'ackInbox', { token, ids }, 'Inbox cleared.');
}

export function setEmailSchedule(
  url: string,
  token: string,
  cfg: { enabled: boolean; hour: number; minute: number; tz: string },
): Promise<PhoneApiResult> {
  return call(url, 'setEmail', { token, ...cfg }, cfg.enabled ? 'Evening email is on.' : 'Evening email is off.');
}

export function sendTestEmail(url: string, token: string): Promise<PhoneApiResult> {
  return call(url, 'sendTestEmail', { token }, 'Test email sent.');
}

export function resetPhoneAccess(
  url: string,
  pin: string,
  newPin: string,
): Promise<PhoneApiResult<{ token: string }>> {
  return call(url, 'resetAccess', { pin, newPin }, 'Phone access reset.');
}

// The script's version from its ping, or null when it cannot be reached or is not WorkPulse's script.
export async function getScriptVersion(url: string): Promise<number | null> {
  const scriptUrl = (url || '').trim();
  if (!scriptUrl) return null;
  try {
    const res = await fetch('/api/sheets/proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scriptUrl, action: 'ping', method: 'GET' }),
    });
    const body = await res.json();
    if (res.ok && body && body.status === 'ok') return typeof body.version === 'number' ? body.version : 1;
    return null;
  } catch {
    return null;
  }
}
