# "Suggested from your activity": how it works

This document explains the feature end to end: what the user sees, what data is read, what leaves the computer, how the
log lines are built, which numbers are estimates, and **where to change each behaviour**. File paths are relative to the
repo root.

## 1. What it does in one paragraph

Once a day (or whenever the user asks) WorkPulse reads what you did on this computer, **git commits** and, if you opt in,
**Claude Code prompts**, for the folders linked to your projects. An AI groups that raw activity into a few ready-made
log entries (one per project, with short sub-steps). You tick the ones you want, edit the text, minutes or project, and
press **Add**. Nothing is added without your ticking it, and nothing is scanned until you press a button and have accepted
a data notice. After that it also checks by itself every 5 minutes, and End my day merges your done tasks into the same suggestions.

## 2. What the user sees

| Place | What it is | Code |
|---|---|---|
| **Today → "Suggested from your activity"** | A compact card. Starts with a **Check activity** button (no automatic scan). | `src/components/v2/today/SuggestionsCard.tsx` → `ActivitySuggestionsPanel` (`compact`) |
| **End my day → "Suggested logs"** | The same panel embedded, with your done tasks merged in (see 9b). | `src/components/v2/endday/EndDayDialog.tsx` |
| **Dialog** (opened by the next-action button under 1024 px) | The full panel in a `ModalShell`; scans when opened; has a day picker. | `src/components/activity/ActivitySuggestionsDialog.tsx` |
| **Settings → Activity suggestions** | Source toggles (Git commits, Claude Code prompts) and a read-only folder list. | `src/components/activity/ActivityFoldersSettings.tsx` |
| **Settings → Projects & tags** | Where folders are linked to projects (each project row shows its folders). | `src/components/v2/settings/ProjectsSection.tsx` |
| **Settings → AI** | The one "AI writer" choice: Claude on this computer / Gemini key / None. | `src/components/SettingsView.tsx` |

Panel phases: **idle** (nothing read yet) → **notice** (the data notice, once per source+AI combination) → **loading** →
**ready** (rows to tick) or an error with a plain reason. After a scan the result **and the user's edits/ticks are kept for
the session** per local date (`src/utils/activity/sessionStore.ts`, in memory only), so leaving Today and coming back does
not rescan; "Scan again" does. The kept result is forgotten when folders, projects, sources or the AI writer change.

Each row shows: a tick box, the suggested text (editable), the project (changeable), the minutes (editable, labelled
"estimated"), the sub-steps (editable, one per line), the evidence ("4 commits, 2 Claude sessions") and a warning when
that project already has time on record for the day (see 7).

## 3. Settings that control it

All in `AppSettings` (`src/types.ts`):

| Setting | Meaning | Default |
|---|---|---|
| `activityFolders` | List of `{ path, projectId }`: a folder on this PC linked to a project. **In backups (file and Sheet); an import uses them only when this PC has none.** | none |
| `activityUseGit` | Read git commits. | on (off only if `=== false`) |
| `activityUseClaude` | Read Claude Code prompts. | on (off only if `=== false`) |
| `activityAutoScan` | Check for new activity every 5 minutes while Today or End my day is open. | on (off only if `=== false`) |
| `activityAi` | Who groups and words the text: `'claude'`, `'gemini'`, `'none'`. Shared with the standup and end-of-day writers. | claude (absent = claude) |
| `geminiApiKey` | Only used and only sent when the AI is `gemini`. | empty |

Helpers: `src/utils/activity/settings.ts` (`sourcesFromSettings`, `aiFromSettings`, `addActivityFolder`, `isFullFolderPath`).
A folder must be a full path such as `E:\projects\app`.

## 4. The pipeline, step by step

The whole client flow is `loadSuggestions()` in `src/utils/activity/pipeline.ts`:

```
scan (server)  →  drop already-used items  →  AI grouping (server)  →  build suggestions  →  rows in the panel
```

1. **Scan** – `POST /api/activity/scan` with `{ date, folders, sources }` (`src/utils/activity/client.ts`). A failed scan
   throws and the panel shows it. The `date` is a **local** day; `localDayToUtcRange()` (`src/utils/activity/time.ts`)
   turns it into the UTC range of that local day.
2. **Drop consumed** – items whose id is in any saved log's `sourceIds` are removed (`consumedIds`, `dropConsumed` in
   `suggestions.ts`). This is why adding a log means those commits/prompts are never suggested again, and deleting the log
   frees them.
3. **AI grouping** – `POST /api/activity/suggest` with `{ items, projectNameByFolder, provider, customApiKey? }`. If the
   AI is `none`, no call is made. If the AI fails for any reason the flow does **not** fail: `templateTasks()` builds plain
   wording and the panel shows the reason ("Showing plain wording instead").
4. **Build suggestions** – `buildSuggestions()` in `suggestions.ts` turns the AI's tasks (text + sub-steps + item ids) into
   suggestions, computing **minutes, project and evidence in code from the items**, never from the AI.

## 5. Where the data comes from (server side)

Routes live in `server.ts`; readers in `src/server/activityReaders.ts`.

### 5.1 Git commits (`readGitCommits`)
- For every repo found under the linked folders (`findRepos`), runs `git log --all --since=<day start> --until=<day end>`
  with format `hash, commit date, subject`.
- **Only your commits**: filtered with `--author=<git config user.name of that repo>` (fixed string). If `user.name` is
  not set, commits from all authors are shown with a note.
- `--all` means every branch, de-duplicated by commit hash. Item id = `git:<hash>`; text = the commit **subject** only
  (clipped to 200 characters, secrets redacted).
- A repo that errors or is empty gives no items, not an error.

### 5.2 Claude Code prompts (`readClaudeHistory`, `parseClaudeLines`) – opt-in
- Reads `~/.claude/projects/**/*.jsonl` (Claude Code's own session files). Files whose modified time is older than the
  day start are skipped without being opened; files are **streamed** line by line.
- Keeps only lines of the chosen local day whose `cwd` is inside a linked folder (`deepestFolder`: when folders nest, the
  deepest wins).
- From each **user prompt**: the **first meaningful line** (system reminders, task notifications and command wrappers are
  ignored; a pasted prompt keeps the text inside its pasted wrapper). Item `claude:<session>:<uuid>`.
- From each **assistant tool use** of Write/Edit/MultiEdit: only `Edited <file name>`, **never the file contents**.
- From each session with an AI title: `Session: <title>`.
- The file format is internal to Claude Code and may change, so every line is parsed defensively and unknown lines are
  skipped. Terminal history is deliberately not supported (no timestamps).

### 5.3 What is deliberately not read
File contents, diffs, full prompts (only the first line), anything outside the linked folders.

## 6. Privacy and safety rules

- **Data notice first.** Nothing is scanned until the user accepts the notice (phase `idle` → `notice`). It names the sources
  and the AI; it is shown again if that combination changes (`noticeSignature` in `pipeline.ts`). The smoke checks
  `activity_suggestions` and `activity_today_card` enforce this.
- **Checking.** Until the notice is accepted nothing is read (the Today card shows "Check activity"). After that the panel checks when it
  appears and every 5 minutes while the tab is visible (today only; Settings can switch this off). "Scan again" checks at once. A
  background check asks the AI again only if the activity changed, and it never replaces rows you have ticked or edited: it offers a
  "Refresh" button instead.
- **Redaction before text leaves the machine**: `redactSecrets()` (`src/utils/activity/sanitize.ts`) replaces API keys,
  GitHub/Slack/GitLab/AWS tokens, JWTs, private-key blocks, `Bearer …`, and "password/token/api key = …" with `[redacted]`.
  `clip()` limits each item to 200 characters. The server redacts again as a last stop.
- **Per-folder cap**: at most the **40 latest items per folder** go to the AI (`PER_FOLDER_CAP` in `aiTasks.ts`).
- **Local only.** `/api/activity/scan`, `/api/activity/suggest` (and `/api/pick-folder`) answer only when the server is bound to
  `127.0.0.1` **and** the `Host` header is exactly `localhost:<port>` or `127.0.0.1:<port>`
  (`src/server/activityGuard.ts`, `isStrictLocalHost`). Never relax this: the routes read local files.
- With **Claude on this computer** the text goes to your own Claude login (no API key); with **Gemini** it goes to Google;
  with **None** nothing leaves the machine. The Gemini key is sent to the server only when Gemini is chosen.

## 7. The AI step

**Provider "claude"** (`src/server/claudeCli.ts`, `runClaudeJson`): the server spawns the user's own
`claude -p` with the prompt on stdin, `--tools ""`, `--strict-mcp-config`, `--disable-slash-commands`,
`--setting-sources project`, `--no-session-persistence`, `--model haiku`, `--effort low` and a `--json-schema`, from the temp
folder (so no project instructions are picked up). About 4 seconds and under a cent per call; 60 s timeout. **Do not add
`--bare`** (it skips the keychain and the login stops working). Missing, signed out, slow or unreadable → plain wording
with the reason.

**Provider "gemini"**: the model cascade in `src/utils/geminiModels.ts`, JSON mime type, temperature 0.3.

**The prompt** (`buildActivityPrompt` and `SYSTEM_INSTRUCTION` in `src/utils/activity/aiTasks.ts`):
- Items are listed per project with **short ids** (`[i1]`, `[i2]`…) so the model never handles the real ids;
  `shortToId` maps them back.
- Rules given to the model: one task per project; a second task in the same project **only** for totally unrelated work;
  `text` = one or two past-tense sentences; `subtasks` = 2 to 8 short steps (≤10 words); trivial prompts ("yes", "go
  ahead", "ok") are ignored; refer to items only by short id; **do not state durations or choose projects**; no markdown or
  hashes.
- Required answer shape (`ACTIVITY_TASKS_SCHEMA`): `{ "tasks": [ { "text", "subtasks": [], "itemIds": [] } ] }`.

**Reading the answer defensively** (`parseAiTasks`): unknown ids are ignored; an id counts only in the first task that cites
it; tasks with no text or no ids are dropped; sub-steps are cleaned, de-duplicated, max 12; stray `[i3]` markers in text are
removed. **Items the AI did not place** (trivial prompts, or items cut by the cap) are *not* shown as their own rows: they
join the task that holds most of their folder, so their time still counts and they are not suggested again. A folder with
no task at all gets one "Other activity" task.

**Plain-wording fallback** (`templateTasks`): one task per folder, text "Worked on <project>", sub-steps = the commit
subjects (or, with no commits, the prompts, excluding `Session:` and `Edited` items), max 12.

## 8. How the numbers are produced

- **Project of a suggestion**: from the folder of its items via `activityFolders` (`projectOfFolder`). A task that spans
  several projects is split into one suggestion per project. Folders linked to the same project end up together. An unlinked
  folder shows as "Unassigned".
- **Minutes are an estimate** (`clusterTimes`, `estimateMinutes` in `time.ts`): the item timestamps of a project are sorted;
  a gap **over 30 minutes** ends a stretch of work; each stretch counts first-to-last span with a **5-minute minimum**; the
  minutes of the stretches add up. When the AI splits one project into several tasks, `minutesPerGroup` shares each
  stretch's minutes between the groups by how many items each holds, so the groups of a project add up to the project's real
  total and the same hour is never counted twice.
- Minutes are shown as "~1h 10m (estimated)" and are **editable before adding**. Once added, the log stores a plain number
  (`durationMinutes`). **This estimate is the only place in the app where minutes are not real tracked time**; do not reuse
  it elsewhere.
- **Already-on-record warning** (`trackedMinutesFor`): minutes already logged for that project and date plus tracked timer
  time not yet written to a log. If it is above zero the row warns, so you do not double count work you timed yourself.

## 9. Adding the logs

- The panel's **Add** calls `handleAddLogs` in `src/App.tsx` once with all ticked rows (not a loop over `handleAddLog`, which
  would start each call from the same stale list).
- Each ticked row becomes a `WorkLog` via `suggestionToLogData()` (`suggestions.ts`): `description` = the (edited) text,
  `projectId`/`projectName`, `durationMinutes` = the (edited) minutes, `status: 'completed'`, `date` = the scanned day,
  `time` = the **current clock time** (so a past day's logs get "now" as their time), `sourceIds` = the activity ids used,
  `underlyingTasks` = the sub-steps as done steps with no tracked time (shown as "N sub-tasks" and listed in the log form).
- `sourceIds` is never sent to the Google Sheet, and duplicating a log clears it.
- If a Sheet is linked the new logs sync like any others.

## 9b. Done tasks merged in (End my day)

End my day has one page, **Suggested logs**, instead of separate activity and done-task pages. Done tasks with unlogged timer time are
turned into items (`taskItems`, id `task:<taskId>`) and go through the same flow: the AI sees them as "(done task)" items next to the
commits and prompts of the same project and writes **one log per project**, with the task titles and the activity as its sub-steps.

- **Minutes** = the larger of (a) the done tasks' unlogged timer minutes and (b) the activity estimate (section 8). Task items do not
  count toward the estimate.
- **Evidence** reads like "2 done tasks, 4 commits".
- **Adding** such a log marks the tasks' tracked time as logged (`markTasksLogged`), so they are not offered again.
- A project with done tasks but no folder still gets a suggestion; with no folders at all, only the tasks are used.

## 10. File map

| Concern | Files |
|---|---|
| Types | `src/utils/activity/types.ts` |
| Whole client flow | `src/utils/activity/pipeline.ts` |
| Suggestion building, de-dup, minutes sharing, template | `src/utils/activity/suggestions.ts` |
| AI prompt, schema, answer parsing | `src/utils/activity/aiTasks.ts` |
| Minutes estimate, day range | `src/utils/activity/time.ts` |
| Redaction | `src/utils/activity/sanitize.ts` |
| Settings helpers, per-session result cache | `settings.ts`, `sessionStore.ts` (same folder) |
| API client | `src/utils/activity/client.ts` |
| Server readers (git, Claude) | `src/server/activityReaders.ts` |
| Local-only guard | `src/server/activityGuard.ts`, `src/utils/hostCheck.ts` |
| Claude runner | `src/server/claudeCli.ts`, `src/server/aiWriter.ts` |
| Routes | `server.ts` (`/api/activity/scan`, `/api/activity/suggest`) |
| UI | `src/components/activity/*`, `src/components/v2/today/SuggestionsCard.tsx` |
| Tests | `src/utils/activity/*.test.ts`, `src/server/activity*.test.ts`; smoke checks `activity_suggestions`, `activity_today_card` |

## 11. Cookbook: where to change what

| You want to… | Change |
|---|---|
| Treat a longer or shorter pause as a break | `BREAK_MS` in `time.ts` |
| Change the 5-minute minimum per stretch | `MIN_CLUSTER_MINUTES` in `time.ts` |
| Send more or fewer items per folder to the AI | `PER_FOLDER_CAP` in `aiTasks.ts` |
| Keep more of each prompt/commit text | `ITEM_TEXT_MAX` (`aiTasks.ts`) and `TEXT_MAX` (`activityReaders.ts`); keep them equal |
| Change how the log text is worded (tone, length, one log vs several per project) | `SYSTEM_INSTRUCTION` in `aiTasks.ts`; update `aiTasks.test.ts` |
| Allow more sub-steps | `MAX_SUBTASKS` and the "2 to 8 steps" wording in `aiTasks.ts` |
| Use a different Claude model or effort | `CLAUDE_MODEL` and `claudeArgs` in `claudeCli.ts` |
| Show commits from **all authors** | remove the `--author` filter in `readGitCommits` |
| Read only the current branch | drop `--all` in `readGitCommits` |
| Include commit bodies or changed file names | extend the `--pretty` format and the `text` built from it; keep redaction and clipping |
| Add a new source (for example calendar, browser history) | add an `ActivitySource` in `types.ts`, a reader in `activityReaders.ts`, a toggle in `ActivityFoldersSettings.tsx` and `settings.ts`, extend `noticeSignature` so the notice is shown again, and name it in the data notice |
| Make the log time the activity's time instead of "now" | `time` in `suggestionToLogData` (use the group's last item time) |
| Make minutes come from something else | `minutesPerGroup` in `suggestions.ts` (keep them labelled "estimated") |
| Scan automatically (not recommended) | would remove the "no background scanning" rule; update the smoke checks and CLAUDE.md first |
| Change which project an unlinked folder gets | `projectOfFolder` in `buildSuggestions` (currently "Unassigned") |
| Turn the AI off for this feature only | not supported: `activityAi` is shared with the standup and end-of-day writers |

## 12. Known limits

- Claude Code's session file format can change; unknown lines are skipped, so a format change shows as "nothing found".
- Only prompts typed in Claude Code are seen, not work done in other tools, and terminal commands are not recorded.
- Estimated minutes can be wrong when work happens away from git/Claude (meetings, reading); that is why they are editable.
- Past-day logs get the current clock time (see 9).
- The scan reads one local day at a time.
