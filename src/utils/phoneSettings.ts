import type { AppSettings } from '../types';

export const DEFAULT_EMAIL_TIME = '18:00';

// "HH:MM" from 00:00 to 23:59, nothing else.
export function parseEmailTime(v: unknown): { hour: number; minute: number } | null {
  if (typeof v !== 'string') return null;
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(v);
  return m ? { hour: Number(m[1]), minute: Number(m[2]) } : null;
}

// The evening email may be scheduled from 00:30 to 23:29: a trigger close to midnight can fire after
// midnight, when the new day has no data yet.
export function emailTimeAllowed(hhmm: string): boolean {
  const t = parseEmailTime(hhmm);
  if (!t) return false;
  const minutes = t.hour * 60 + t.minute;
  return minutes >= 30 && minutes <= 23 * 60 + 29;
}

// Recipients typed as "a@x.com, b@y.com": the cleaned text ('' = none, meaning the script owner), or null when an address is invalid or there are over 5.
export function cleanRecipients(text: string): string | null {
  const out: string[] = [];
  for (const raw of text.split(',')) {
    const a = raw.trim();
    if (!a) continue;
    if (a.length > 200 || !/^[^\s@,;<>"]+@[^\s@,;<>"]+\.[^\s@,;<>"]+$/.test(a)) return null;
    out.push(a);
  }
  return out.length > 5 ? null : out.join(', ');
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
// the Gemini key, the backup dates, the phone link (its token, device id and sync status).
export function keepDeviceSettings(imported: AppSettings, current: AppSettings): AppSettings {
  return {
    ...imported,
    geminiApiKey: current.geminiApiKey,
    lastBackupAt: current.lastBackupAt,
    // The phone token belongs to this Sheet link, so the link stays with it.
    googleScriptUrl: current.googleScriptUrl || imported.googleScriptUrl,
    phoneToken: current.phoneToken,
    phoneDeviceId: current.phoneDeviceId,
    phoneSyncAt: current.phoneSyncAt,
    phoneLastError: current.phoneLastError,
    // This computer's own folder links win; a computer with none takes the ones in the backup.
    activityFolders: current.activityFolders && current.activityFolders.length > 0 ? current.activityFolders : imported.activityFolders,
    sheetBackupAt: current.sheetBackupAt,
    sheetBackupError: current.sheetBackupError,
    widgets: current.widgets,
  };
}
