# Activity suggestions: design

Date: 2026-11-09. Status: draft for approval.

## Intent

At the end of the day the user should not have to remember or retype what they did. WorkPulse reads the
user's own activity on this PC (Claude Code history, git commits, terminal history), turns it into suggested
log entries, and lets the user tick the ones they want. Ticked suggestions become normal `WorkLog`s.

Why: logging by hand at 6 pm is the part of the day people skip. The raw material already exists on the machine.

## Goals

- A "Suggest from my activity" button on the main screen, and the same step inside the End of day flow.
  Works for today by default; a date picker allows a past date.
- Sources: Claude Code session history, git commits, PowerShell history. All three chosen by the user.
- Gemini groups activity by project and writes the log sentences. If there is no key or the call fails, fall
  back to plain templates (commit subjects, Claude prompt first lines) with the reason shown, as the existing
  EOD synthesis does (`aiErrors.ts`, `plainAiMessage`).
- Each suggestion shows: text, project, duration, and the evidence behind it (e.g. "3 commits, 2 Claude sessions").
  The user can edit text, project and duration before adding.
- Accepted suggestions are saved as ordinary logs and never suggested again for that date.

## Non-goals

- No continuous background tracking, no daemon, no screen or window capture.
- No reading of anything outside folders the user listed.
- No automatic adding. Nothing becomes a log without a tick.
- No support for other AI tools' histories (Cursor, Copilot) in this version.
- Not for LAN use: the scan endpoints must refuse to run when `HOST=0.0.0.0` is set (see Constraints).

## Anti-goals (would make it a failure even if it works)

- Silently wrong durations that look like tracked time.
- Reading or sending files, code or secrets the user did not expect. Raw file contents and command output
  must never be sent to Gemini; only short summaries of activity (see Privacy).
- Duplicate logs when the user runs it twice.

## Decisions made with the user

| Topic | Decision |
|---|---|
| Sources | Claude Code history, git commits, terminal history |
| Which folders | User lists folders in Settings. Nothing else is read. |
| Folder to project | Each listed folder is linked to one WorkPulse project; suggestions inherit it |
| Wording | Gemini summarises (recommended option chosen); template fallback |
| Where | Both a standalone button and a step in End of day |
| Duration | Estimated from activity span; shown as "~1h 20m (estimated)"; editable before adding |
| Size of one suggestion | Gemini decides the split into logical tasks (user choice). See "Turning it into suggestions" for how minutes stay computable |
| Existing logs the same day | Warn only: show "already logged Xh Ym for this project today" beside the suggestion; never hide or subtract |

## My calls (not yet confirmed by the user, except where noted)

- **Break rule:** estimate = sum of activity clusters per project, where a gap over 30 minutes ends a cluster.
  Each cluster adds its first-to-last span, with a 5 minute floor per cluster so a single commit is not 0. (My call; the user was asked and did not object.)
- **Terminal history is supporting detail only.** `ConsoleHost_history.txt` has no timestamps, so it never
  contributes timing and cannot be tied to a date. It is used only as a short "commands run" hint, limited to
  the last N lines that mention a listed folder name, and is optional. (My call; the user was asked and did not object.)
- **De-duplication (my call, from the builder check):** the accepted log stores the list of activity item ids it
  consumed (`WorkLog.sourceIds`, optional string array: commit hashes, session id + message uuid). The scan drops
  already-consumed ids before grouping, so a second run at 6 pm suggests only the new work. Deleting a log frees
  its ids, so that activity can be suggested again. Not shown to the user.
- **Listed folders (my call):** a listed folder covers itself, any git repo one level below it, and Claude
  sessions whose `cwd` is at or below it (match by `cwd` prefix, not by the encoded directory name). If listed
  folders nest, an item belongs to the deepest listed folder. Settings rejects non-absolute or missing paths.
- **Folders that map to the same project** are merged by code before Gemini sees anything.
- **End of day order (my call):** the suggestions step comes before timesheet generation, and logs added in it
  are included in the timesheet.
- Gemini input is capped (e.g. 40 items per folder) and truncated per item.
- The scan runs on demand only, when the user presses the button.

## Constraint: this contradicts an existing rule

`CLAUDE.md` says "Durations come only from tracked time (`minutesFromSeconds`): no invented defaults or
minimums." The user explicitly chose estimated durations. The agreed exception: an estimate is allowed only on
suggested logs, must be labelled "estimated" in the UI before adding, and must be editable. Once added it is a
plain number on the log, which is the user's own decision. CLAUDE.md must be updated in the same change to state
this exception, so the rule stays true. The 5 minute floor above is also an "invented minimum", so it must be
called out in that same CLAUDE.md note. If the user dislikes it, drop the floor and show a single commit as
"no duration".

## How it works

### Reading (server side only; the browser cannot read files)

New endpoint `POST /api/activity/scan`, body `{ date: "YYYY-MM-DD", folders: [{ path, projectId }], includeTerminal }`.
Dates are local (`localDateStr`, UTC+6) per the existing gotcha; the server converts the local day to a UTC range
before filtering ISO timestamps.

1. **Claude history:** read `~/.claude/projects/<folder encoded>/*.jsonl`. Folder name encoding replaces path
   separators and the drive colon with `-` (e.g. `E:\workpulse` becomes `E--workpulse`). Lines of type `user`
   (string content, real prompts only, not tool results or pasted system text) and `assistant` carry `timestamp`,
   `cwd` and `sessionId`. `ai-title` lines give a session title. Assistant `tool_use` entries named Write/Edit give
   changed file paths. Only entries whose local date matches are used. This is Claude Code's internal format and is
   not a stable public contract: parse defensively, skip unknown lines, and show "couldn't read Claude history" if
   nothing parses, never fail the whole scan.
2. **Git:** run `git log --since/--until --author=<configured git user>` in each folder with a fixed argument
   list (no shell string), reading hash, ISO time and subject. Folder that is not a repo returns nothing.
3. **Terminal:** read the last part of PSReadLine's `ConsoleHost_history.txt` (`%APPDATA%\Microsoft\Windows\PowerShell\PSReadLine\`) only if `includeTerminal`.

The response is a list of normalised activity items `{ source, time?, folder, text, id }` plus per-source status.

### Turning it into suggestions

New helper in `src/utils` (pure, unit tested): groups items per folder, computes clusters and the estimated
minutes, and builds the plain-template suggestions. A second endpoint or a mode of the existing synthesis
(`POST /api/activity/suggest`) sends the grouped summaries to Gemini using `GEMINI_MODEL_CASCADE`, with the same
template fallback. Gemini decides how the day splits into tasks, but it does so by **referencing item ids**: each activity item
is sent with a short id, and Gemini returns tasks as `{ text, itemIds[] }`. Code then computes each task's
minutes from the timestamps of its items (same cluster rule as above), its project from the folder, and its
evidence counts. So Gemini never states a number of minutes or a project, and every suggestion stays traceable
to real items. Items Gemini leaves out or invents ids for are ignored, and leftover items are offered as one
"Other activity" suggestion so nothing is silently lost. Items without timestamps (terminal lines) can be cited
as evidence but add no minutes. The template fallback (no key, or Gemini failure) makes one suggestion per
folder per day. The "already logged" warning is computed in code from existing logs for that date and project.

### UI

- **Settings:** a "Activity folders" section: add or remove a folder path, choose the linked WorkPulse project,
  a checkbox for "include terminal history". Stored in `AppSettings` (new optional fields; follows the
  `data-model-change` skill: migration, seed data, Sheets sync check, all 4 themes).
- **Suggestions screen:** a `ModalShell` dialog (uses the shared primitive). One row per suggestion: checkbox,
  editable text, project select, duration field with the "estimated" tag, and an expandable "why" with the
  evidence. "Add selected" creates logs through the existing log-creation handler in `App.tsx`. Empty state when
  nothing was found, with the reason per source.
- Entry points: a button reachable in all four themes (top bar or the shared quick-log area, builder's choice) and a step in
  `EodSynthesizerModal`.
- Must work with Escape, focus trap, 12 px minimum text, and be usable on a phone-width screen.

## Privacy and security constraints

- Server must stay bound to `127.0.0.1`. The scan endpoint returns 403 when started with `HOST=0.0.0.0`
  (no authentication exists on the LAN mode).
- The endpoint only reads paths the client lists, but the client is the same user. Still: resolve and normalise
  paths, require them to be absolute, existing directories; never read `.env*`, never read file contents of the user's
  source files. Only file paths from Claude Write/Edit entries are used, not contents.
- Sent to Gemini: commit subjects, first line of user prompts (truncated), session titles, file names, folder
  project names. Not sent: file contents, command output, terminal commands unless the user ticked terminal.
  Before first use the dialog says plainly what will be sent to Gemini.
- Prompts typed into Claude can contain secrets. Truncate prompts and run a simple redaction for strings that look
  like keys or tokens before anything is sent.

## Testing

- Unit tests (Vitest, `process.env.TZ = 'Asia/Dhaka'`): cluster/estimate maths, local-day to UTC-range
  conversion including 00:30 and 23:30 edges, JSONL parsing with garbage lines, de-duplication keys, redaction.
- Server endpoint tests with fixture jsonl and a temp git repo.
- UI: `npm run lint`, and extend `tests/smoke/smoke.py` (select suggestions, add, verify logs, Escape).

## Left to the builder

File layout and names, exact endpoint shape, the Gemini prompt wording, the button's placement, the cap
numbers, how many terminal lines to read, row styling per theme.

## Open risks

- Claude's history format may change between versions. Mitigation: defensive parsing and a per-source status.
- Estimates are rough. Mitigation: labelled and editable.
