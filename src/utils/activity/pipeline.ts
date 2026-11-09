import { scanActivityApi, suggestTasksApi } from './client';
import { buildSuggestions, consumedIds, dropConsumed, templateTasks } from './suggestions';
import type { BacklogTask, Project, WorkLog } from '../../types';
import type {
  ActivityFolder,
  ActivitySource,
  ActivitySources,
  ScanRequest,
  ScanResponse,
  SourceStatus,
  SuggestResponse,
  Suggestion,
  ActivityItem,
} from './types';

export interface PipelineArgs {
  date: string;
  folders: ActivityFolder[];
  sources: ActivitySources;
  projects: Project[];
  logs: WorkLog[];
  backlog: BacklogTask[];
  geminiApiKey: string;
}

export interface PipelineResult {
  suggestions: Suggestion[];
  status: ScanResponse['status'];
  /** Set when the AI was not used: why, in a plain sentence. */
  notice?: string;
}

interface Deps {
  scan: (req: ScanRequest) => Promise<ScanResponse>;
  suggest: (args: { items: ActivityItem[]; projectNameByFolder: Record<string, string>; customApiKey: string }) => Promise<SuggestResponse>;
}

const REAL: Deps = { scan: scanActivityApi, suggest: suggestTasksApi };

/**
 * The whole flow behind the dialog: read the day's activity, drop what a saved log already used,
 * let the AI group it (plain wording when it can't), and build the suggestions. A failed scan
 * throws (the dialog shows it); a failed AI call never does.
 */
export async function loadSuggestions(args: PipelineArgs, deps: Deps = REAL): Promise<PipelineResult> {
  const scanned = await deps.scan({ date: args.date, folders: args.folders, sources: args.sources });
  const items = dropConsumed(scanned.items, consumedIds(args.logs));
  if (items.length === 0) return { suggestions: [], status: scanned.status };

  const projectNameByFolder: Record<string, string> = {};
  for (const f of args.folders) {
    projectNameByFolder[f.path] = args.projects.find((p) => p.id === f.projectId)?.name ?? 'Unassigned';
  }

  let tasks = null as SuggestResponse['tasks'];
  let notice: string | undefined;
  try {
    const answer = await deps.suggest({ items, projectNameByFolder, customApiKey: args.geminiApiKey });
    tasks = answer.tasks;
    notice = answer.notice;
  } catch (err) {
    const why = err instanceof Error ? err.message : 'The AI could not be reached.';
    notice = `${why} Showing plain wording instead.`;
  }

  const suggestions = buildSuggestions(tasks ?? templateTasks(items), items, {
    date: args.date,
    folders: args.folders,
    projects: args.projects,
    logs: args.logs,
    backlog: args.backlog,
  });
  return { suggestions, status: scanned.status, notice: tasks ? undefined : notice };
}

const LABEL: Record<ActivitySource, string> = { claude: 'Claude Code prompts', git: 'Git commits' };

/** One plain line per switched-on source: how much was found, and any note about it. */
export function describeSources(sources: ActivitySources, status: Record<ActivitySource, SourceStatus>): string[] {
  const lines: string[] = [];
  for (const source of ['claude', 'git'] as const) {
    if (!sources[source]) continue;
    const s = status[source];
    const head = !s.ok ? "couldn't read." : s.count === 0 ? 'nothing found.' : `${s.count} found.`;
    lines.push(`${LABEL[source]}: ${head}${s.note ? ` ${s.note}` : ''}`);
  }
  return lines;
}

/** Identifies which sources the data notice covered, so it is shown again when one is switched on. */
export function noticeSignature(sources: ActivitySources): string {
  return [sources.git ? 'git' : '', sources.claude ? 'claude' : ''].filter(Boolean).join('+');
}
