import fs from 'fs';
import os from 'os';
import path from 'path';
import readline from 'readline';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { localDayToUtcRange } from '../utils/activity/time';
import { clip, redactSecrets } from '../utils/activity/sanitize';
import type {
  ActivityItem,
  ActivitySource,
  ScanRequest,
  ScanResponse,
  SourceStatus,
} from '../utils/activity/types';

const execFileAsync = promisify(execFile);

interface Range {
  startIso: string;
  endIso: string;
}

const TEXT_MAX = 200;
const WRITE_TOOLS = new Set(['Write', 'Edit', 'MultiEdit']);

// --- folder matching -------------------------------------------------------------------------

const norm = (p: string): string => p.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();

/** True when `cwd` is `folder` or inside it. Case-insensitive, slash-agnostic, separator-bounded. */
export function isUnderFolder(cwd: string, folder: string): boolean {
  const c = norm(cwd);
  const f = norm(folder);
  return c === f || c.startsWith(`${f}/`);
}

/** The listed folder that contains `cwd`; when listed folders nest, the deepest one. */
export function deepestFolder(cwd: string, folders: string[]): string | null {
  let best: string | null = null;
  for (const f of folders) {
    if (isUnderFolder(cwd, f) && (best === null || norm(f).length > norm(best).length)) best = f;
  }
  return best;
}

const inRange = (iso: string, r: Range): boolean => {
  const t = Date.parse(iso);
  return !Number.isNaN(t) && t >= Date.parse(r.startIso) && t < Date.parse(r.endIso);
};

// --- Claude Code history -----------------------------------------------------------------------

// First meaningful line of a user message, or null when it is not something the user typed
// (system reminders, task notifications, command wrappers). A pasted prompt keeps the text
// inside its <pasted_content> wrapper.
function promptText(content: string): string | null {
  let text = content.trim();
  if (text.startsWith('<pasted_content')) text = text.replace(/^<pasted_content[^>]*>/, '').trim();
  else if (text.startsWith('<')) return null;
  const first = text.split(/\r?\n/).map((l) => l.trim()).find((l) => l.length > 0);
  return first ? clip(redactSecrets(first), TEXT_MAX) : null;
}

/**
 * Turns Claude Code session lines (JSONL) into activity items for the given day and folders.
 * Claude's file format is internal and can change, so every line is parsed defensively:
 * anything unexpected is skipped, never thrown.
 */
export async function parseClaudeLines(
  lines: AsyncIterable<string> | Iterable<string>,
  args: { folders: string[]; startIso: string; endIso: string },
): Promise<ActivityItem[]> {
  const items: ActivityItem[] = [];
  const titles = new Map<string, string>();
  const firstSeen = new Map<string, { time: string; folder: string }>();

  const note = (sessionId: string, time: string, folder: string) => {
    const seen = firstSeen.get(sessionId);
    if (!seen || time < seen.time) firstSeen.set(sessionId, { time, folder });
  };

  for await (const raw of lines) {
    let o: any;
    try {
      o = JSON.parse(raw);
    } catch {
      continue;
    }
    if (!o || typeof o !== 'object') continue;

    if (o.type === 'ai-title' && typeof o.sessionId === 'string' && typeof o.aiTitle === 'string') {
      titles.set(o.sessionId, o.aiTitle);
      continue;
    }
    if (o.type !== 'user' && o.type !== 'assistant') continue;
    if (o.isSidechain === true || o.isMeta === true) continue;
    if (typeof o.timestamp !== 'string' || typeof o.cwd !== 'string' || typeof o.sessionId !== 'string' || typeof o.uuid !== 'string') continue;
    if (!inRange(o.timestamp, args)) continue;
    const folder = deepestFolder(o.cwd, args.folders);
    if (!folder) continue;
    const time = new Date(o.timestamp).toISOString();

    if (o.type === 'user') {
      const content = o.message?.content;
      if (typeof content !== 'string') continue;
      const text = promptText(content);
      if (!text) continue;
      items.push({ id: `claude:${o.sessionId}:${o.uuid}`, source: 'claude', folder, time, text });
      note(o.sessionId, time, folder);
    } else if (Array.isArray(o.message?.content)) {
      let n = 0;
      for (const block of o.message.content) {
        if (block?.type !== 'tool_use' || !WRITE_TOOLS.has(block.name)) continue;
        const file = block.input?.file_path;
        if (typeof file !== 'string') continue;
        // Only the file's name is kept: never its contents.
        items.push({
          id: `claude:${o.sessionId}:${o.uuid}:${n++}`,
          source: 'claude',
          folder,
          time,
          text: clip(redactSecrets(`Edited ${path.win32.basename(file)}`), TEXT_MAX),
        });
        note(o.sessionId, time, folder);
      }
    }
  }

  for (const [sessionId, seen] of firstSeen) {
    const title = titles.get(sessionId);
    if (!title) continue;
    items.push({
      id: `claude:${sessionId}:title`,
      source: 'claude',
      folder: seen.folder,
      time: seen.time,
      text: clip(redactSecrets(`Session: ${title}`), TEXT_MAX),
    });
  }

  return items.sort((a, b) => a.time.localeCompare(b.time));
}

/** Reads this day's Claude Code activity for the listed folders from `<claudeDir>/projects`. */
export async function readClaudeHistory(
  folders: string[],
  range: Range,
  opts: { claudeDir?: string } = {},
): Promise<{ items: ActivityItem[]; status: SourceStatus }> {
  const projectsDir = path.join(opts.claudeDir ?? path.join(os.homedir(), '.claude'), 'projects');
  if (!fs.existsSync(projectsDir)) {
    return { items: [], status: { ok: true, count: 0, note: 'No Claude Code history found on this computer' } };
  }
  const startMs = Date.parse(range.startIso);
  const items: ActivityItem[] = [];
  let unreadable = 0;
  try {
    for (const entry of fs.readdirSync(projectsDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const dir = path.join(projectsDir, entry.name);
      for (const name of fs.readdirSync(dir)) {
        if (!name.endsWith('.jsonl')) continue;
        const file = path.join(dir, name);
        try {
          // A session file not touched since before this day cannot hold activity from it.
          if (fs.statSync(file).mtimeMs < startMs) continue;
          const rl = readline.createInterface({ input: fs.createReadStream(file), crlfDelay: Infinity });
          items.push(...(await parseClaudeLines(rl, { folders, ...range })));
        } catch {
          unreadable++;
        }
      }
    }
  } catch {
    return { items: [], status: { ok: false, count: 0, note: "Couldn't read Claude Code history" } };
  }
  items.sort((a, b) => a.time.localeCompare(b.time));
  return {
    items,
    status: {
      ok: true,
      count: items.length,
      note: unreadable > 0 ? `${unreadable} history file(s) could not be read` : undefined,
    },
  };
}

// --- git ---------------------------------------------------------------------------------------

const hasGit = (dir: string): boolean => fs.existsSync(path.join(dir, '.git'));

// Each listed folder itself (if it is a repo) plus its immediate child repos.
function findRepos(folders: string[]): string[] {
  const seen = new Set<string>();
  const repos: string[] = [];
  const add = (dir: string) => {
    const key = norm(dir);
    if (!seen.has(key)) {
      seen.add(key);
      repos.push(dir);
    }
  };
  for (const folder of folders) {
    if (hasGit(folder)) add(folder);
    try {
      for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
        if (entry.isDirectory() && hasGit(path.join(folder, entry.name))) add(path.join(folder, entry.name));
      }
    } catch {
      // unreadable folder: nothing to add
    }
  }
  return repos;
}

/** Commits made today across the listed folders' repos (all branches), by the repo's git user. */
export async function readGitCommits(
  folders: string[],
  range: Range,
  opts: { env?: NodeJS.ProcessEnv } = {},
): Promise<{ items: ActivityItem[]; status: SourceStatus }> {
  const env = opts.env ?? process.env;
  const byId = new Map<string, ActivityItem>();
  let note: string | undefined;

  for (const repo of findRepos(folders)) {
    const folder = deepestFolder(repo, folders);
    if (!folder) continue;
    let userName = '';
    try {
      userName = (await execFileAsync('git', ['config', 'user.name'], { cwd: repo, env })).stdout.trim();
    } catch {
      userName = '';
    }
    if (!userName) note ??= `git user.name is not set in ${repo}: showing commits from all authors`;

    const args = [
      'log', '--all',
      `--since=${range.startIso}`, `--until=${range.endIso}`,
      '--pretty=format:%H%x1f%cI%x1f%s',
      ...(userName ? ['--fixed-strings', `--author=${userName}`] : []),
    ];
    let stdout = '';
    try {
      stdout = (await execFileAsync('git', args, { cwd: repo, env, maxBuffer: 10 * 1024 * 1024 })).stdout;
    } catch {
      continue; // empty repo or git failure: no items, not an error
    }
    for (const row of stdout.split('\n')) {
      const [hash, iso, subject] = row.split('\x1f');
      if (!hash || !iso || subject === undefined) continue;
      const id = `git:${hash}`;
      if (byId.has(id)) continue;
      const time = new Date(iso);
      if (Number.isNaN(time.getTime())) continue;
      byId.set(id, { id, source: 'git', folder, time: time.toISOString(), text: clip(redactSecrets(subject), TEXT_MAX) });
    }
  }

  const items = [...byId.values()].sort((a, b) => a.time.localeCompare(b.time));
  return { items, status: { ok: true, count: items.length, note } };
}

// --- one scan ---------------------------------------------------------------------------------

const OFF: SourceStatus = { ok: true, count: 0, note: 'Turned off in Settings' };

/** Reads every switched-on source for one local day. Throws a plain-sentence Error on a bad folder. */
export async function scanActivity(
  req: ScanRequest,
  opts: { claudeDir?: string; env?: NodeJS.ProcessEnv } = {},
): Promise<ScanResponse> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(req.date)) throw new Error('Pick a valid date.');
  // A malformed path is a bug in the request and is refused. A folder that is simply gone (deleted,
  // drive unplugged) must not cost the user the other folders' suggestions: it is skipped and reported.
  const paths: string[] = [];
  const skipped: string[] = [];
  for (const f of req.folders) {
    if (typeof f?.path !== 'string' || !path.isAbsolute(f.path)) {
      throw new Error(`Enter the full folder path, like E:\\projects\\app. (${String(f?.path)})`);
    }
    let isDir = false;
    try {
      isDir = fs.statSync(f.path).isDirectory();
    } catch {
      isDir = false;
    }
    if (isDir) paths.push(f.path);
    else skipped.push(f.path);
  }

  const range = localDayToUtcRange(req.date);
  const claude = req.sources.claude ? await readClaudeHistory(paths, range, { claudeDir: opts.claudeDir }) : { items: [], status: OFF };
  const git = req.sources.git ? await readGitCommits(paths, range, { env: opts.env }) : { items: [], status: OFF };

  const status: Record<ActivitySource, SourceStatus> = { claude: claude.status, git: git.status };
  if (skipped.length > 0) {
    // Said once, on the first source that is switched on.
    const carrier = req.sources.git ? 'git' : req.sources.claude ? 'claude' : null;
    if (carrier) {
      const note = `Folder not found, skipped: ${skipped.join(', ')}`;
      status[carrier] = { ...status[carrier], note: [status[carrier].note, note].filter(Boolean).join('. ') };
    }
  }
  const items = [...claude.items, ...git.items].sort((a, b) => a.time.localeCompare(b.time));
  return { items, status };
}
