import { WorkLog } from '../types';

export interface SyncResult {
  success: boolean;
  message: string;
  count?: number;
}

export async function testSheetConnection(scriptUrl: string): Promise<SyncResult> {
  if (!scriptUrl || !scriptUrl.trim()) {
    return { success: false, message: 'Google Apps Script Web App URL is empty.' };
  }

  try {
    const res = await fetch('/api/sheets/proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scriptUrl: scriptUrl.trim(),
        action: 'ping',
        method: 'GET',
      }),
    });

    const data = await res.json();
    // Only the script's own { status: 'ok' } counts: any other page that answers HTTP 200 does not.
    if (res.ok && data.status === 'ok') {
      const version = typeof data.version === 'number' ? data.version : 1;
      // Version 2 still syncs logs; only the phone page and the evening email need version 3.
      let message: string = data.message || 'Connection to Google Sheet verified successfully!';
      if (version < 2) {
        message = 'Connected. Your script is an older version: re-paste the latest script below and redeploy it to stop duplicate rows.';
      } else if (version < 3) {
        message =
          'Connected. Log sync works, but the phone page and evening email need the latest script: re-paste it below, then update your existing deployment (Deploy, Manage deployments, edit, New version).';
      }
      return { success: true, message };
    }
    return { success: false, message: data.error || data.message || 'Unexpected response from Google Sheet script.' };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Failed to connect to Google Sheet Web App.' };
  }
}

// What is sent for one log: the image becomes a flag (keeps the sheet fast) and the activity
// source ids stay on this device.
export function toSheetLog(log: WorkLog) {
  const { sourceIds: _omit, ...rest } = log;
  return { ...rest, imageBase64: log.imageBase64 ? 'true' : '' };
}

export async function syncSingleLogToSheet(scriptUrl: string, log: WorkLog): Promise<SyncResult> {
  if (!scriptUrl || !scriptUrl.trim()) {
    // If not configured, we gracefully remain in local-storage mode
    return { success: true, message: 'Saved to local storage (Google Sheet URL not configured).' };
  }

  try {
    const res = await fetch('/api/sheets/proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scriptUrl: scriptUrl.trim(),
        action: 'appendLog',
        method: 'POST',
        payload: {
          action: 'appendLog',
          log: toSheetLog(log),
        },
      }),
    });

    const data = await res.json();
    if (res.ok && data.status === 'ok') {
      return { success: true, message: 'Synchronized with Google Sheet.' };
    }
    return { success: false, message: data.message || data.error || 'Sheet sync response was not OK.' };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Network error syncing to Google Sheet.' };
  }
}

export async function syncBatchLogsToSheet(scriptUrl: string, logs: WorkLog[]): Promise<SyncResult> {
  if (!scriptUrl || !scriptUrl.trim()) {
    return { success: false, message: 'Google Apps Script Web App URL is not configured in Settings.' };
  }

  try {
    const sanitizedLogs = logs.map(toSheetLog);

    const res = await fetch('/api/sheets/proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scriptUrl: scriptUrl.trim(),
        action: 'batchSync',
        method: 'POST',
        payload: {
          action: 'batchSync',
          logs: sanitizedLogs,
        },
      }),
    });

    const data = await res.json();
    if (res.ok && data.status === 'ok') {
      return {
        success: true,
        message: `Successfully synced ${data.syncedCount || logs.length} logs to Google Sheet!`,
        count: data.syncedCount || logs.length,
      };
    }
    return { success: false, message: data.message || data.error || 'Batch sync failed.' };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Error during batch synchronization.' };
  }
}
