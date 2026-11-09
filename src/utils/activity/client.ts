import { plainAiMessage } from '../aiErrors';
import type { ActivityItem, ScanRequest, ScanResponse, SuggestResponse } from './types';

async function post<T>(url: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw new Error(plainAiMessage(err instanceof Error ? err.message : undefined));
  }
  let data: any = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) {
    throw new Error(typeof data?.error === 'string' && data.error ? data.error : `Reading your activity failed (error ${res.status}).`);
  }
  return data as T;
}

/** Asks the local server to read this day's activity from the listed folders. */
export const scanActivityApi = (req: ScanRequest): Promise<ScanResponse> => post<ScanResponse>('/api/activity/scan', req);

/** Asks the server to group the items into tasks with Gemini. `tasks: null` means "use plain wording". */
export const suggestTasksApi = (args: {
  items: ActivityItem[];
  projectNameByFolder: Record<string, string>;
  customApiKey: string;
  provider: 'claude' | 'gemini';
}): Promise<SuggestResponse> => post<SuggestResponse>('/api/activity/suggest', args);
