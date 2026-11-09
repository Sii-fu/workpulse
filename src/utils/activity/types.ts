export type ActivitySource = 'claude' | 'git';

export interface ActivityFolder {
  path: string;
  projectId: string;
}

export interface ActivitySources {
  claude: boolean;
  git: boolean;
}

export interface ActivityItem {
  /** git:<hash> | claude:<sessionId>:<messageUuid>[:<n>] */
  id: string;
  source: ActivitySource;
  /** The listed ActivityFolder.path this item belongs to (deepest match). */
  folder: string;
  /** ISO UTC. */
  time: string;
  /** Already redacted and clipped. */
  text: string;
}

export interface SourceStatus {
  ok: boolean;
  count: number;
  note?: string;
}

export interface ScanRequest {
  date: string;
  folders: ActivityFolder[];
  sources: ActivitySources;
}

export interface ScanResponse {
  items: ActivityItem[];
  status: Record<ActivitySource, SourceStatus>;
}

export interface AiTask {
  text: string;
  itemIds: string[];
}

export interface SuggestResponse {
  tasks: AiTask[] | null;
  notice?: string;
  apiKeyMissing?: boolean;
}

export interface Suggestion {
  /** Stable for React: the first item id. */
  key: string;
  folder: string;
  projectId: string;
  projectName: string;
  text: string;
  minutes: number;
  itemIds: string[];
  /** e.g. "3 commits, 2 Claude sessions" */
  evidence: string;
  /** Logged minutes plus not-yet-logged timer time, same date and project. */
  trackedMinutes: number;
}
