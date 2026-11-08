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
      const outdated = typeof data.version === 'number' ? data.version < 2 : true;
      return {
        success: true,
        message: outdated
          ? 'Connected. Your script is an older version: re-paste the latest script below and redeploy it to stop duplicate rows.'
          : data.message || 'Connection to Google Sheet verified successfully!',
      };
    }
    return { success: false, message: data.error || data.message || 'Unexpected response from Google Sheet script.' };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Failed to connect to Google Sheet Web App.' };
  }
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
          log: {
            ...log,
            // Keep base64 truncated or indicator to keep sheet performant
            imageBase64: log.imageBase64 ? 'true' : '',
          },
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
    const sanitizedLogs = logs.map((l) => ({
      ...l,
      imageBase64: l.imageBase64 ? 'true' : '',
    }));

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
