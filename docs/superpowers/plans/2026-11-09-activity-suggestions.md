# Activity Suggestions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** At end of day, WorkPulse reads git commits (and, if the user opts in, Claude Code prompts) from user-listed folders and suggests logs the user can tick and add.

**Architecture:** The Express server (browser cannot read files) reads and normalises activity into `ActivityItem`s (`/api/activity/scan`) and asks Gemini to group item ids into tasks (`/api/activity/suggest`). All numbers (minutes, project, evidence, already-logged warning, de-dup) are computed client-side in pure, unit-tested helpers; Gemini only writes text and picks which item ids belong together. A `ModalShell` dialog shows suggestions; accepted ones go through the existing `handleAddLog`.

**Tech Stack:** TypeScript, React 19, Express, Vitest (node env, `process.env.TZ = 'Asia/Dhaka'` in date tests), `@google/genai` via the existing `GEMINI_MODEL_CASCADE`, `child_process.execFile` for git, `readline` streams for Claude history.

**Spec:** `docs/superpowers/specs/2026-11-09-activity-suggestions-design.md`. This plan overrides the spec on one point: **terminal history is dropped for v1** (no timestamps, so it cannot be scoped to a day; basename matching is unreliable; line-hash ids break de-dup for repeated commands). The spec's "My calls" bullet about terminal history and its Sources decision are superseded. Also superseded: Claude history is now opt-in and off by default (the spec had it on).

## Global Constraints

- Dates are LOCAL (UTC+6): use `localDateStr`, `localTimeStr`, `localDateOfIso` from `src/utils/dates.ts`; never `toISOString().split('T')[0]`; compare dates as strings.
- Sources for v1: `claude` and `git` only. Git commits are **on by default**; Claude Code prompts are **opt-in, off by default** ("Include Claude Code prompts" in Settings).
- Estimated minutes: a cluster ends when the gap between consecutive timestamps exceeds 30 minutes; each cluster contributes `max(5, spanMinutes)`; shown as "~1h 20m (estimated)" and editable before adding. Every item has a timestamp, so any non-empty task gets at least 5 minutes.
- Server stays bound to `127.0.0.1`. Both `/api/activity/*` routes return 403 when `HOST !== '127.0.0.1'`, **and** return 403 unless the `Host` header is exactly `localhost:<PORT>` or `127.0.0.1:<PORT>` (DNS-rebinding protection; `ALLOWED_HOSTS` does not widen this).
- Never read file contents of the user's source files or `.env*`; Claude Write/Edit entries contribute file paths only.
- Sent to Gemini: commit subjects; and only if the Claude source is on: first line of user prompts (clipped to 200 chars), session titles, edited file names; plus project names. Never file contents or command output. Secret-looking strings are redacted first. The data notice shown before the first scan lists only the sources that are switched on.
- Gemini never returns minutes or a project; tasks are `{ text, itemIds[] }`.
- Use `ModalShell` for the dialog and `IconButton` (with `label`) for icon buttons; minimum text size 12 px (`text-xs`), no `text-[10px]`; works at phone width and in all 4 themes.
- Failures shown as plain sentences via `src/utils/aiErrors.ts` (`plainAiMessage`); no raw "Failed to fetch".
- Do not give any new item an id like `log-1`; real ids include a timestamp.
- Never read or print `.env.local` / `.env`.
- Work on branch `feat/activity-suggestions`; **commit after each task** (commit messages end with the attribution line from the session reminder).

## Review Focus

- A listed folder `E:\work` must not match a session whose `cwd` is `E:\workpulse` (prefix match needs a path-separator boundary; Windows paths are case-insensitive, trailing slash ignored). Pinned in Task 2.
- Activity at 00:30 or 23:30 local belongs to that local day, not the UTC day. Pinned in Task 1.
- A JSONL file with garbage lines, truncated last line, or unknown line types must not fail the scan; a `.jsonl` file last modified before the day starts must not be opened at all. Pinned in Task 2.
- A repo with no `user.name` configured returns all authors with a visible note instead of nothing; a commit reachable from two listed paths or several branches appears once. Pinned in Task 2.
- A request with a foreign `Host` header (`evil.com:3000`, wrong port, no port) is refused on both activity routes. Pinned in Task 4.
- Gemini returns unknown ids, the same id in two tasks, or leaves items out: unknown ignored, an id counts only in the first task that cites it, leftovers become one "Other activity" suggestion. Pinned in Task 3.
- Nothing found (empty day, folder not a repo, folder deleted, both sources off): dialog shows an empty state with a reason per source, not an error. Pinned in Tasks 2 and 6.
- Second run after accepting: consumed ids are dropped, and deleting the log frees them. Pinned in Task 3.
- Prompt text containing a key/token must be redacted before it leaves the machine. Pinned in Task 1.
- Timer time not yet written into a log counts toward the overlap warning, and time already written into a log is not counted twice. Pinned in Task 3.

## File Structure

- Create `src/utils/activity/types.ts`: shared types (below).
- Create `src/utils/activity/time.ts`: `localDayToUtcRange`, `estimateMinutes`, `formatEstimate`.
- Create `src/utils/activity/sanitize.ts`: `redactSecrets`, `clip`.
- Create `src/utils/activity/suggestions.ts`: `consumedIds`, `dropConsumed`, `buildSuggestions`, `templateTasks`, `suggestionToLogData`, `trackedMinutesFor`.
- Create `src/utils/activity/aiTasks.ts`: `buildActivityPrompt`, `parseAiTasks` (id shortening, dedupe, leftovers).
- Create `src/server/activityReaders.ts`: `parseClaudeLines`, `readClaudeHistory`, `readGitCommits`, `scanActivity`.
- Create `src/server/activityGuard.ts`: `activityGuard(host: string, port: number)` Express-style middleware; strict-host helper `isStrictLocalHost` lives in `src/utils/hostCheck.ts` next to the existing checks.
- Modify `server.ts`: two routes behind the guard.
- Create `src/utils/activity/client.ts`: `scanActivityApi`, `suggestTasksApi` fetch wrappers.
- Modify `src/types.ts`, `src/utils/backup.ts`, `src/components/SettingsView.tsx`, `src/App.tsx`, `src/components/EodSynthesizerModal.tsx`, `src/components/TopBar.tsx` (entry button), `CLAUDE.md`, `tests/smoke/smoke.py`.
- Create `src/components/activity/ActivitySuggestionsDialog.tsx`, `src/components/activity/ActivityFoldersSettings.tsx`.
- Tests next to each util: `*.test.ts`; fixtures built in-test (temp dirs via `fs.mkdtempSync`).

## Shared types (`src/utils/activity/types.ts`, produced by Task 1, used by all later tasks)

```ts
export type ActivitySource = 'claude' | 'git';
export interface ActivityFolder { path: string; projectId: string }
export interface ActivitySources { claude: boolean; git: boolean }
export interface ActivityItem {
  id: string;            // git:<hash> | claude:<sessionId>:<messageUuid>[:<n>]
  source: ActivitySource;
  folder: string;        // the listed ActivityFolder.path this item belongs to (deepest match)
  time: string;          // ISO UTC
  text: string;          // already redacted and clipped
}
export interface SourceStatus { ok: boolean; count: number; note?: string }
export interface ScanRequest { date: string; folders: ActivityFolder[]; sources: ActivitySources }
export interface ScanResponse { items: ActivityItem[]; status: Record<ActivitySource, SourceStatus> }
export interface AiTask { text: string; itemIds: string[] }
export interface SuggestResponse { tasks: AiTask[] | null; notice?: string; apiKeyMissing?: boolean }
export interface Suggestion {
  key: string;           // stable for React: first itemId
  folder: string; projectId: string; projectName: string;
  text: string; minutes: number;
  itemIds: string[];
  evidence: string;                    // e.g. "3 commits, 2 Claude sessions"
  trackedMinutes: number;              // logged + not-yet-logged timer time, same date + project
}
```

---

### Task 0: Branch

- [x] **Step 1: Create `feat/activity-suggestions`. Done.** The user chose to branch from `design/overhaul` instead of `main` (`main` is 9 commits behind, and the files this plan edits exist in their current form only there). The user's uncommitted work was committed first as `afc02bc` on `design/overhaul`, then the branch was created and the design and plan docs committed (`58d2d2a`). Confirm with `git branch --show-current`.

### Task 1: Data model, settings fields, pure time and sanitize helpers

**Files:**
- Modify: `src/types.ts` (`WorkLog.sourceIds?: string[]`; `AppSettings.activityFolders?: ActivityFolder[]`, `AppSettings.activityUseClaude?: boolean` (absent = off), `AppSettings.activityUseGit?: boolean` (absent = on; only `false` turns it off)), `src/utils/backup.ts`
- Create: `src/utils/activity/types.ts`, `time.ts`, `sanitize.ts`
- Test: `src/utils/activity/time.test.ts`, `sanitize.test.ts`, `src/utils/backup.test.ts` (extend)

**Interfaces:**
- Produces: the shared types above; `localDayToUtcRange(date: string): { startIso: string; endIso: string }`; `estimateMinutes(timesIso: string[]): number`; `formatEstimate(minutes: number): string`; `redactSecrets(text: string): string`; `clip(text: string, max: number): string`.

- [ ] **Step 1: Invoke the `data-model-change` skill** and follow it for the new optional fields (all optional, so no migration; confirm seed data, Sheets sync columns and the 4 themes need no change; `sourceIds` is not sent to the Sheet).
- [ ] **Step 2: Write failing tests** (`TZ=Asia/Dhaka`):
  - `localDayToUtcRange('2026-11-09')` equals `{ startIso: '2026-11-08T18:00:00.000Z', endIso: '2026-11-09T18:00:00.000Z' }`; an item at `2026-11-08T18:30:00.000Z` (00:30 local on the 9th) and one at `2026-11-09T17:30:00.000Z` (23:30 local) are both inside the range.
  - `estimateMinutes([])` is 0; one timestamp is 5; timestamps 10:00, 10:20, 10:40 give 40; 10:00, 10:10, then 12:00, 12:03 give `10 + 5` = 15 (30-min gap splits, second cluster span 3 floored to 5); unsorted input gives the same as sorted.
  - `formatEstimate(80)` is `'~1h 20m (estimated)'`; `formatEstimate(45)` is `'~45m (estimated)'`; `formatEstimate(0)` is `'no duration'`.
  - `redactSecrets('key AIzaSyA1234567890abcdefghijklmnopqrstuv9 and token ghp_abcdefghijklmnopqrstuvwxyz0123456789')` contains `[redacted]` twice and neither secret; also covers `sk-...`, `Bearer xxx`, and `password=hunter2`. Plain text is unchanged.
  - `clip('a'.repeat(300), 200)` has length 200 and ends with `…`.
  - `buildBackup` output never contains `activityFolders` (device-specific paths), and `parseBackup` result has `activityFolders: undefined`.
- [ ] **Step 3: Run `npx vitest run src/utils/activity src/utils/backup.test.ts`** and confirm the new tests fail.
- [ ] **Step 4: Implement** the files with the signatures above. `localDayToUtcRange` builds local midnight via `new Date(y, m-1, d)` and `new Date(y, m-1, d+1)`. Backup omits and clears `activityFolders` like `lastBackupAt`.
- [ ] **Step 5: Run the same command, then `npm run lint`.** Expected: all pass.
- [ ] **Step 6: Commit** `feat(activity): data model and pure time/sanitize helpers`.

### Task 2: Server-side readers (Claude history, git)

**Files:**
- Create: `src/server/activityReaders.ts`
- Test: `src/server/activityReaders.test.ts`

**Interfaces:**
- Consumes: `localDayToUtcRange`, `redactSecrets`, `clip`, types from Task 1.
- Produces:
  - `isUnderFolder(cwd: string, folder: string): boolean` (case-insensitive, `\` and `/` equal, trailing slash ignored, boundary-safe).
  - `deepestFolder(cwd: string, folders: string[]): string | null`.
  - `parseClaudeLines(lines: AsyncIterable<string> | Iterable<string>, args: { folders: string[]; startIso: string; endIso: string }): Promise<ActivityItem[]>`
  - `readClaudeHistory(folders: string[], range: { startIso: string; endIso: string }, opts?: { claudeDir?: string }): Promise<{ items: ActivityItem[]; status: SourceStatus }>`: walks `*.jsonl` under `<claudeDir>/projects/*/` (default `~/.claude`); **skips any file whose `mtime` is earlier than `startIso` without opening it**; reads the rest **line by line with `readline.createInterface({ input: fs.createReadStream(file) })`**, never `readFileSync`.
  - `readGitCommits(folders: string[], range: { startIso: string; endIso: string }, opts?: { env?: NodeJS.ProcessEnv }): Promise<{ items: ActivityItem[]; status: SourceStatus }>`: for each folder and each immediate child directory containing `.git`, run in that directory `git config user.name` (via `execFile`, cwd = that repo), then `git log --all --since <startIso> --until <endIso> --pretty=format:%H%x1f%cI%x1f%s` plus `--fixed-strings --author <name>` **only when user.name is non-empty**; when empty, no `--author` filter and `status.note = 'git user.name is not set in <repo>: showing commits from all authors'`. Items are de-duplicated by hash across all repos and branches. Non-repo or git failure yields no items, not an error.
  - `scanActivity(req: ScanRequest, opts?: { claudeDir?: string; env?: NodeJS.ProcessEnv }): Promise<ScanResponse>`; throws `Error` with a plain message when a folder path is not absolute or not an existing directory. A source whose switch is off is not read and gets `status { ok: true, count: 0, note: 'Turned off in Settings' }`.

- [ ] **Step 1: Write failing tests:**
  - `isUnderFolder('E:\\workpulse\\src', 'E:\\workpulse')` true; `isUnderFolder('E:\\workpulse', 'E:\\work')` false; `isUnderFolder('e:/WorkPulse/', 'E:\\workpulse')` true; `deepestFolder` picks the longer of two nested listed folders.
  - `parseClaudeLines` with a fixture of: a real user prompt (string content) inside the range; a user line whose content is an array (tool result) and one starting with `<system-reminder>` or `<pasted_content` (both skipped); an assistant `tool_use` `Write` with `input.file_path` (becomes an item `Edited <basename>`, id ending `:0`); a line outside the range; a line with `cwd` outside every folder; a line of invalid JSON; an unknown `type`; a truncated last line. Expect only the right items, ids `claude:<sessionId>:<uuid>`, text clipped and redacted; an `ai-title` line becomes one item `Session: <title>` only if that session has at least one in-range item. Works with both an array and an async iterable of lines.
  - `readClaudeHistory` with a temp `claudeDir`: a file with in-range content and a recent mtime yields its items; **a file with identical in-range content but `fs.utimesSync` set to before the day starts yields nothing**, and a `jest/vitest` spy on `fs.createReadStream` shows it was never called for that path; a missing `projects` directory returns `ok: true`, no items.
  - `readGitCommits` against temp repos created in the test (`git init`, `GIT_AUTHOR_DATE`/`GIT_COMMITTER_DATE` inside and outside the range): (a) only the in-range commit comes back as `git:<hash>`; (b) a commit on a second branch is included (`--all`); (c) the same repo reached via a listed parent and a listed child appears once; (d) with `user.name` set locally, a commit by a different author is excluded; (e) with no `user.name` (test env sets `GIT_CONFIG_GLOBAL` to an empty file and `GIT_CONFIG_NOSYSTEM=1`), all authors are returned and `status.note` contains `user.name is not set`; (f) a temp folder that is not a repo returns `[]` with `ok: true`.
  - `scanActivity` throws for `'relative/path'` and for a non-existent absolute path, never throws for an empty day, and with `sources.claude === false` never touches `claudeDir` (status note `Turned off in Settings`).
- [ ] **Step 2: Run `npx vitest run src/server`**, confirm failing.
- [ ] **Step 3: Implement** per the signatures. Parsing is defensive: wrap each `JSON.parse` in try/catch and skip. A user prompt is a line with `type === 'user'`, `typeof message.content === 'string'`, not starting with `<`, using the first non-empty line, clipped to 200. Write/Edit items use only `input.file_path`. Use `execFile` with an argument array (never a shell string).
- [ ] **Step 4: Run the tests and `npm run lint`.** Expected: pass.
- [ ] **Step 5: Commit** `feat(activity): read Claude history and git activity`.

### Task 3: Suggestion building, AI task parsing, de-dup, tracked-time warning

**Files:**
- Create: `src/utils/activity/suggestions.ts`, `aiTasks.ts`
- Test: `src/utils/activity/suggestions.test.ts`, `aiTasks.test.ts`

**Interfaces:**
- Consumes: Task 1 types and helpers; `WorkLog`, `BacklogTask`, `Project`; `unloggedSeconds(t: BacklogTask): number` from `src/utils/taskLogging.ts`; `minutesFromSeconds` from `src/utils/duration.ts`.
- Produces:
  - `consumedIds(logs: WorkLog[]): Set<string>` (union of every log's `sourceIds`).
  - `dropConsumed(items: ActivityItem[], consumed: Set<string>): ActivityItem[]`.
  - `buildActivityPrompt(items: ActivityItem[], projectNameByFolder: Record<string, string>): { systemInstruction: string; userPrompt: string; shortToId: Record<string, string> }` (each item gets a short id `i1..iN`; at most 40 items per folder, most recent first; text clipped to 200 and redacted again).
  - `parseAiTasks(raw: unknown, shortToId: Record<string, string>, items: ActivityItem[]): AiTask[]` (accepts `{ tasks: [{ text, itemIds }] }`; maps short ids to real; ignores unknown ids; an id counts only in the first task citing it; drops tasks left with no ids or empty text; appends one `Other activity` task with all uncited items, if any).
  - `templateTasks(items: ActivityItem[]): AiTask[]` (one task per folder: joined commit subjects, else first prompts).
  - `trackedMinutesFor(date: string, projectId: string, logs: WorkLog[], backlog: BacklogTask[]): number`: sum of `durationMinutes` of logs with that `date` and `projectId`, **plus** `minutesFromSeconds(unloggedSeconds(t))` for each backlog task with that `projectId` and `dueDate === date` (so tracked time already written into a log is counted once, via the log).
  - `buildSuggestions(tasks: AiTask[], items: ActivityItem[], args: { date: string; folders: ActivityFolder[]; projects: Project[]; logs: WorkLog[]; backlog: BacklogTask[] }): Suggestion[]` (a task whose items span several folders is split into one suggestion per folder; folders mapping to the same project are merged by code before the task is split; project from `folder.projectId`, name from `projects`, fallback `'Unassigned'` if the project is gone; `minutes = estimateMinutes(times of its items)`; evidence like `"3 commits, 2 Claude sessions"` counting distinct session ids; `trackedMinutes = trackedMinutesFor(...)`).
  - `suggestionToLogData(s: Suggestion, date: string, minutes: number, text: string, projectId: string, projectName: string): Omit<WorkLog, 'id' | 'createdAt'>` (`status: 'completed'`, `tags: []`, `time: localTimeStr()`, `durationMinutes: minutes || undefined`, `sourceIds: s.itemIds`).

- [ ] **Step 1: Write failing tests:**
  - `parseAiTasks` with ids `i1,i2,i3` where Gemini returns task A `[i1,i9]`, task B `[i1,i2]`: result A has only `i1`'s real id; B has only `i2`'s; an `Other activity` task has `i3`; an empty-text task and a no-ids task are dropped. Non-object `raw` returns just the `Other activity` task covering everything.
  - `buildActivityPrompt` output never contains a raw `AIza...` key, caps a folder at 40 items, and `shortToId` round-trips.
  - `consumedIds` + `dropConsumed`: items whose ids are in a log's `sourceIds` are removed; after that log is removed from the array the items return.
  - `buildSuggestions`: two folders mapped to the same project merge into one suggestion; minutes use the cluster rule (10:00 and 10:10 plus 12:00 gives 15); unknown projectId yields `projectName: 'Unassigned'`; evidence is `"3 commits, 2 Claude sessions"` for 3 git items and Claude items from 2 session ids.
  - `trackedMinutesFor`: a log of 60 min plus a backlog task with `elapsedSeconds: 1800, loggedSeconds: 600` (same project, `dueDate` = date) gives `60 + 20 = 80`; a task with `loggedSeconds >= elapsedSeconds` adds 0; a task for another project or another `dueDate` adds 0; a log on another date adds 0.
  - `suggestionToLogData` copies `itemIds` into `sourceIds`, uses the user-edited minutes/text/project, and omits `durationMinutes` when minutes is 0.
- [ ] **Step 2: Run `npx vitest run src/utils/activity`**, confirm failing.
- [ ] **Step 3: Implement** with the signatures above.
- [ ] **Step 4: Run tests and `npm run lint`.** Expected: pass.
- [ ] **Step 5: Commit** `feat(activity): suggestion building, de-dup and tracked-time warning`.

### Task 4: Guard, server routes and client wrappers

**Files:**
- Modify: `server.ts` (add after `/api/synthesize-eod`), `src/utils/hostCheck.ts`
- Create: `src/server/activityGuard.ts`, `src/utils/activity/client.ts`
- Test: `src/utils/hostCheck.test.ts` (extend), `src/server/activityGuard.test.ts`, `src/utils/activity/client.test.ts` (mock `fetch`)

**Interfaces:**
- Consumes: `scanActivity` (Task 2), `buildActivityPrompt`, `parseAiTasks`, `templateTasks` (Task 3), `generateWithCascade`, `GoogleGenAI`.
- Produces:
  - `isStrictLocalHost(hostHeader: string | undefined, port: number): boolean`: true only for exactly `localhost:<port>` or `127.0.0.1:<port>` (case-insensitive hostname).
  - `activityGuard(bindHost: string, port: number): (req, res, next) => void`: responds `403 { error }` when `bindHost !== '127.0.0.1'` or `!isStrictLocalHost(req.headers.host, port)`; otherwise `next()`.
  - `POST /api/activity/scan` body `ScanRequest` returns `ScanResponse`; 400 `{ error }` with the plain message on a bad folder.
  - `POST /api/activity/suggest` body `{ items: ActivityItem[], projectNameByFolder, customApiKey }` returns `SuggestResponse`. No key returns `{ tasks: null, apiKeyMissing: true, notice }`; Gemini failure or unparseable JSON returns `{ tasks: null, notice }` (same wording style as `/api/synthesize-eod`); success returns `{ tasks: parseAiTasks(...) }`. Uses `responseMimeType: 'application/json'`, `temperature: 0.3`. Items from `req.body` are re-sanitised (redact + clip) server-side before prompting.
  - Both routes mounted as `app.post(path, activityGuard(HOST, PORT), handler)`.
  - Client: `scanActivityApi(req: ScanRequest): Promise<ScanResponse>` and `suggestTasksApi(args): Promise<SuggestResponse>`; both throw `Error(plainAiMessage(...))` on network or non-OK responses.

- [ ] **Step 1: Write failing tests:**
  - `isStrictLocalHost('localhost:3000', 3000)` and `('127.0.0.1:3000', 3000)` true; `('LOCALHOST:3000', 3000)` true; false for `'evil.com:3000'`, `'localhost:3001'`, `'localhost'`, `'127.0.0.1'`, `'localhost:3000.evil.com'`, `'[::1]:3000'`, `undefined`, and `'localhost:3000'` when the port argument is 4000.
  - `activityGuard` with fake `req`/`res`: calls `next` for host `localhost:3000` on bind `127.0.0.1`; responds 403 and does not call `next` for host `evil.com:3000`, and for a good host when `bindHost` is `0.0.0.0`; `ALLOWED_HOSTS` env does not change the result.
  - Client: a mocked `fetch` rejecting with `TypeError('Failed to fetch')` makes `scanActivityApi` throw an error whose message does not contain `Failed to fetch`; a 403 body surfaces its `error` text; a 200 body is returned as parsed.
- [ ] **Step 2: Run `npx vitest run src/utils/hostCheck.test.ts src/server src/utils/activity/client.test.ts`**, confirm failing.
- [ ] **Step 3: Implement** the helper, guard, client and two routes. Gemini prompt wording is the builder's call, but it must say: group related items into tasks, write one or two plain sentences per task in past tense, reference items only by the given short ids, never state durations or projects, respond with JSON `{ "tasks": [{ "text": string, "itemIds": string[] }] }`.
- [ ] **Step 4: Run tests and `npm run lint`.** Then start `npm run dev` and, from a second shell: `curl -s -X POST localhost:3000/api/activity/scan -H "content-type: application/json" -d '{"date":"<today>","folders":[{"path":"E:\\workpulse","projectId":"x"}],"sources":{"claude":false,"git":true}}'` expects JSON with git `items` and a `status` per source; the same request with `-H "Host: evil.com:3000"` expects 403; a relative folder path expects 400 with a plain message. Stop the server afterwards.
- [ ] **Step 5: Commit** `feat(activity): guarded scan and suggest routes`.

### Task 5: Settings section for folders and sources

**Files:**
- Create: `src/components/activity/ActivityFoldersSettings.tsx`
- Modify: `src/components/SettingsView.tsx` (new section id `'activity'`, label `Activity suggestions`, added to the nav list at `SettingsView.tsx:287` and the `SettingsSection` type at line 61)

**Interfaces:**
- Consumes: `AppSettings.activityFolders`, `activityUseClaude`, `activityUseGit`, `Project[]`; the existing settings save path in `SettingsView` (follow how `geminiApiKey` is saved, around line 112).
- Produces: `ActivityFoldersSettings: React.FC<{ folders: ActivityFolder[]; sources: ActivitySources; projects: Project[]; onChange: (folders: ActivityFolder[], sources: ActivitySources) => void }>`. The caller maps `sources.git` to `activityUseGit` (store `false` only when off) and `sources.claude` to `activityUseClaude`.

- [ ] **Step 1: Implement** a list of rows (path text, project `<select>` of non-archived projects, remove `IconButton` with `label="Remove folder"`), an "Add folder" input with the absolute-path check (`/^[A-Za-z]:[\\/]/` or starts with `/`; plain-sentence error "Enter the full folder path, like E:\\projects\\app."), and two checkboxes: "Include git commits" (checked by default) and "Include Claude Code prompts" (unchecked by default), with a note under the second: "Reads your Claude Code session history for these folders. First lines of your prompts, session titles and edited file names are sent to Gemini; file contents never are." and a general note: "Only these folders are read."
- [ ] **Step 2: Wire into `SettingsView`** so changes are saved with the same save handler as other settings.
- [ ] **Step 3: Verify** `npm run lint`, then a browser check: add and remove a folder in each theme, flip both toggles, reload and confirm they persist (git on and Claude off on a fresh profile), confirm Export backup JSON lacks `activityFolders`.
- [ ] **Step 4: Commit** `feat(activity): folders and source toggles in Settings`.

### Task 6: Suggestions dialog and entry points

**Files:**
- Create: `src/components/activity/ActivitySuggestionsDialog.tsx`
- Modify: `src/App.tsx` (state `isActivityOpen`, render dialog near `EodSynthesizerModal` at ~line 1228, pass `logs`, `backlog`, `projects`, `settings`, `handleAddLog`), `src/components/TopBar.tsx` (button "Suggest logs" at `onOpenActivity`), `src/components/EodSynthesizerModal.tsx` (prop `onOpenActivity?: () => void` and a button "Suggest from my activity" at the top of the modal body)

**Interfaces:**
- Consumes: `scanActivityApi`, `suggestTasksApi`, `consumedIds`, `dropConsumed`, `buildSuggestions`, `templateTasks`, `suggestionToLogData`, `formatEstimate`, `ModalShell`, `handleAddLog(newLogData)`.
- Produces: `ActivitySuggestionsDialog: React.FC<{ isOpen: boolean; onClose: () => void; logs: WorkLog[]; backlog: BacklogTask[]; projects: Project[]; folders: ActivityFolder[]; sources: ActivitySources; geminiApiKey: string; onAddLog: (d: Omit<WorkLog, 'id' | 'createdAt'>) => Promise<void> | void; onOpenSettings: () => void }>`.

- [ ] **Step 1: Implement the flow** on open and on date change (date input defaulting to `localDateStr()`; a past date allowed): if no folders, or both sources off, empty state with a button to Settings; else show the data notice once with Continue, listing only the sources switched on ("Commit subjects go to Gemini to be grouped." plus, only if Claude is on, "First lines of your Claude Code prompts, session titles and edited file names go to Gemini too."; "File contents never do."). Then `scanActivityApi` → `dropConsumed(items, consumedIds(logs))` → `suggestTasksApi` (`tasks === null` falls back to `templateTasks`, and the `notice` is shown) → `buildSuggestions`. Loading, per-source status lines when a source found nothing, failed or has a note (e.g. the git `user.name` note), and retry on failure (plain sentences).
- [ ] **Step 2: Rows**: checkbox, textarea (editable text), project select, minutes input with the `formatEstimate` tag ("~1h 20m (estimated)" beside an editable number), the evidence line, and a warning when `trackedMinutes > 0`: "You already have Xh Ym tracked or logged for this project on this date." Footer: "Add N selected" calls `onAddLog(suggestionToLogData(...))` for each ticked row in sequence, then removes them from the list and shows one toast; Escape and focus trap come from `ModalShell`.
- [ ] **Step 3: Wire entry points** (TopBar button visible in all four themes; EOD modal button opens the same dialog, closing nothing, so the added logs persist; use `useStableCallback` if the handler is passed into a memoized screen).
- [ ] **Step 4: Verify** `npm run lint`; browser check in the four themes at desktop and phone width: open from TopBar and from End of day, scan today's data from this repo with git on and Claude off, then with Claude on; edit a row, add two, confirm they appear in the feed with the duration, reopen the dialog and confirm those items are not suggested again, delete one log and confirm its items return after reopen; with an invalid or missing Gemini key confirm the template fallback and notice; with both sources off confirm the Settings empty state; Escape closes.
- [ ] **Step 5: Commit** `feat(activity): suggestions dialog and entry points`.

### Task 7: Smoke test, CLAUDE.md, final verification

**Files:**
- Modify: `tests/smoke/smoke.py` (add to its `SEL` map; stub `POST /api/activity/scan` and `/suggest` with Playwright `route.fulfill` so the test does not depend on the machine's history), `CLAUDE.md`

- [ ] **Step 1: Extend the smoke test**: open the dialog from TopBar, assert 2 stubbed suggestions, tick one, add, assert the log in the feed and that the dialog no longer lists it, assert Escape closes.
- [ ] **Step 2: Update CLAUDE.md**: (a) change the "Durations come only from tracked time" bullet to state the exception: estimates exist only on activity suggestions, are labelled "estimated" and editable, use a 30-minute break rule and a 5-minute floor per cluster, and become a plain number once added; (b) add one bullet describing the activity feature (endpoints, `src/server/activityReaders.ts`, `src/utils/activity/`, `WorkLog.sourceIds`, device-only `activityFolders` excluded from backups, git on by default and Claude prompts opt-in, loopback-only plus strict `Host` header 403 guard, terminal history deliberately not supported, Claude's JSONL format being unstable so parsing stays defensive).
- [ ] **Step 3: Run the full verification**: `npm test`, `npm run lint`, `npm run build`, then stop any server on port 3000 and run `npm run test:smoke`. Expected: all pass; report any failure honestly.
- [ ] **Step 4: Run the `session-handoff` skill** before ending, per project rules.
- [ ] **Step 5: Commit** `feat(activity): smoke test and docs`.

## Self-review notes

- Spec coverage: sources git + opt-in Claude (Tasks 2, 5), Settings folders and source toggles (5), Gemini by item ids with template fallback (3, 4), both entry points (6), estimated and editable duration with floor and break rule (1, 6), overlap warning including unlogged timer time (3, 6), de-dup with `sourceIds` and freeing on delete (3, 6), subfolder and cwd-prefix rules (2), loopback plus strict Host guard (4), privacy and redaction (1, 2, 4, 6), CLAUDE.md exception (7), data-model skill (1).
- Confirmed by the user: suggestions are ordinary logs added via `handleAddLog`, so they sync to the Sheet like every other log; the End of day timesheet itself still comes from tasks only.
- Decided by the user: no "estimated" marker on the saved log. The estimate is labelled only while reviewing it in the dialog; once added, the log holds a plain number.
