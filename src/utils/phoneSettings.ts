import type { AppSettings } from '../types';

export const DEFAULT_EMAIL_TIME = '18:00';

// "HH:MM" from 00:00 to 23:59, nothing else.
export function parseEmailTime(v: unknown): { hour: number; minute: number } | null {
  if (typeof v !== 'string') return null;
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(v);
  return m ? { hour: Number(m[1]), minute: Number(m[2]) } : null;
}

const ID_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789';

function randomId(length: number): string {
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < length; i++) out += ID_CHARS[bytes[i] % ID_CHARS.length];
  return out;
}

// Gives this device a random id the first time it is needed; afterwards returns the same object.
export function ensureDeviceId(settings: AppSettings): AppSettings {
  if (settings.phoneDeviceId) return settings;
  return { ...settings, phoneDeviceId: `dev-${randomId(12)}` };
}

// The phone page address: the deployed script URL with ?page=phone. Null when it is not a script URL.
export function phoneLink(scriptUrl: string): string | null {
  if (!/^https:\/\/script\.google\.com\/macros\/s\/[^?#\s]+/.test(scriptUrl)) return null;
  return scriptUrl + (scriptUrl.includes('?') ? '&' : '?') + 'page=phone';
}

// A backup import replaces settings, but some belong to this computer and are never in a backup:
// the Gemini key, the backup date and the phone link (its token, device id and sync status).
export function keepDeviceSettings(imported: AppSettings, current: AppSettings): AppSettings {
  return {
    ...imported,
    geminiApiKey: current.geminiApiKey,
    lastBackupAt: current.lastBackupAt,
    phoneToken: current.phoneToken,
    phoneDeviceId: current.phoneDeviceId,
    phoneSyncAt: current.phoneSyncAt,
    phoneLastError: current.phoneLastError,
  };
}
