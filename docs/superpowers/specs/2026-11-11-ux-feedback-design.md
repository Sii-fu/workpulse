# WorkPulse: readable task states, project picking, Claude instead of Gemini, projects from folders

Date: 2026-11-11 · Branch: `feat/ux-feedback` (from `feat/phone-and-email`; `design/v2` and `feat/phone-and-email` are not merged yet)

## Intent

The user has now used the redesigned app with real data and found four things that get in the way:

1. **Task states are unreadable.** On Today every task row looks the same and the state (running, paused, blocked,
   not started, done) is only small grey text. They "can't tell which task is paused, which is blocked and which hasn't
   started".
2. **No way to choose the project** in the quick inputs (Today's tasks, "What did you just finish?", Plan your day).
   `#project` works but gives no help while typing and silently does nothing when the name is not a real project.
3. **The app should use the Claude on their PC, not a Gemini key**, for the standup and the log text.
4. **Projects should come from folders.** Adding a project should let them pick a folder on the PC.

## Decisions the user made

- **Today layout:** Today shows tasks grouped by state — Running, Paused, Blocked — then a compact **Up next** list of
  tasks not started yet (with a Start button), then Done. The Tasks page also gets a right-hand **Plans** list.
- **Gemini stays as an optional fallback**; Claude on the PC becomes the default for everything.
- `#` completion: while typing, the available project names are listed below the box.
- Folder as project: "select the folder and the app will take the folder as project".

## Goals

1. **Readable states.** Group by state with clear headings and non-colour markers; each group's heading carries a count.
2. **A project field wherever a task or log is typed** and a `#` completion list that shows which project will be used.
3. **Standup, end-of-day log writing and log suggestions use `claude -p`** (the user's own login) by default.
4. **Add project from folder** in Settings with a Windows folder picker.

## Non-goals

- Changing the Chase/Time Card/Console design system, the phone page, the email, or the Sheet columns.
- Removing Gemini code (it stays as the optional provider), macOS/Linux folder pickers (a typed path stays as the fallback).
- Auto-creating projects from the folders of old logs.

## Anti-goals

- A state shown only by colour; a layout where one task appears in two places on the same screen.
- Silently choosing a project the user did not pick; a `#212` in "Review PR #212" being treated as a project.
- Any route that runs `claude` or opens a dialog being reachable from another computer or a web page.

## 1. Task states (Today and Tasks)

**Today screen** (`TodayTasks`): one card, groups in this order, each with a heading and a count (`RUNNING 2`,
`PAUSED 1`, `BLOCKED 1`, `UP NEXT 3`, `DONE 1`); empty groups are not shown.

- **Running / Paused / Blocked include every such task of any date** (a task paused yesterday is still paused work).
  A task whose date is not today shows a muted "from Yesterday" / "from Mon 9 Nov" on its meta line.
- **Up next** = tasks not started (stage `planned`) due **today**, ordered by list order. Each row has a Start button.
  Below the list, when earlier days still have not-started tasks, one line: `N more plans from earlier days` that
  switches to the Tasks page. (Their detail lives in the Plans list there.)
- **Done** = done today, as now. "Log it" stays.
- **Markers** (shown in the heading and repeated as a small mark at the start of each row, not by colour alone):
  running = filled dot (pulsing only without reduced motion), paused = two bars, blocked = a cross-in-circle,
  up next = hollow dot, done = check. Blocked rows show the reason as the first line of their meta.
- The `Earlier, still pending` block from the date-grouping work is **removed** from Today (older paused/blocked tasks
  are now in their state group; older not-started plans are in the Tasks page's Plans list). "Plan your day" stays.

**Tasks screen**: two columns on desktop (≥1024 px), one column on phones (Plans first).

- **Right column, "Plans":** only tasks not started (`planned`), by date: today first, then each earlier day newest
  first (`Yesterday`, `Mon 9 Nov`) with the existing "Move all to today" action, then upcoming days. Each row has Start
  and the row menu. This list is where a not-started plan lives.
- **Left column:** tasks that have been started or finished, by date as built: Running/Paused/Blocked tasks under
  their own date groups with a state mark, then Done recently. Nothing appears in both columns. The project filter
  applies to both.

## 2. Project field and `#` completion

A shared component `ProjectInput` (text field + project selector + completion list) is used by Today's task add
(`TodayTasks`), the quick log (`TodayLog`) and Plan your day's "Add today's tasks" (`PlanYourDayDialog`). The Tasks page
add row and the log form keep their existing project select.

- **Selector:** a compact project dropdown beside the field showing the current project (colour ribbon and name). It
  defaults to the last project the user used in any of these inputs (remembered as `AppSettings.lastProjectId?`,
  optional; falls back to the first non-archived project).
- **Completion:** when the last word of the text starts with `#` and is not purely digits, a list appears directly
  below the field with the projects whose names start with the typed letters (all active projects for a bare `#`), each
  with its colour ribbon. Up/Down move, Enter or Tab or a click picks: the `#word` is removed from the text and the
  selector switches to that project (so the user sees which project it takes). Escape closes the list.
- **No match:** the list shows one row `No project called "xyz" — Create it`; picking it creates the project (next
  unused swatch from `ProjectSwatches`, not archived) and selects it. Typing on, or a purely numeric word like `#212`,
  keeps the text as it is and shows no list. Submitting with an unmatched non-numeric `#word` still adds the task to the
  selected project, with the text unchanged.
- **Plan your day textarea** completes the `#word` on the current line; the selector sets the default for lines
  with no `#project`. The existing parsing (`splitProjectTag`) stays for submitted text.
- The list is an ARIA combobox/listbox, works with the keyboard and on phones (44 px rows), and never covers the field.

## 3. Claude on the PC replaces Gemini by default

- `AppSettings.activityAi` (`'claude' | 'gemini' | 'none'`, absent = claude) becomes the single "who writes the text"
  setting for **standup, end-of-day log writing and log suggestions**. Settings shows one control "AI writer" (Claude on
  this computer / Gemini key / None), moved out of the Activity section; the existing value is kept.
- **Server:** `/api/gemini/generate` and `/api/synthesize-eod` accept `provider` (`'claude'` default, `'gemini'`).
  `provider: 'claude'` runs `runClaudeJson` (`src/server/claudeCli.ts`) with a JSON schema (`{ text }` for the standup;
  the existing EOD result shape for end-of-day). If Claude is missing, signed out, slow or answers badly the response
  carries a plain reason and the client uses the offline template, as the activity suggestions already do.
  `none` skips the AI call entirely and uses the template.
- **Security:** a request with `provider: 'claude'` is only answered when the server is bound to 127.0.0.1 and the
  Host is exactly `localhost:<port>` or `127.0.0.1:<port>` (the existing `activityGuard`); otherwise 403. Nothing else
  changes in the Gemini path. The Gemini key is only sent to the server when Gemini is the chosen writer.
- **Client:** `generateAiReport` and the EOD synthesizer pass `provider` from the setting; UI copy that says
  "Gemini" becomes provider-neutral ("the AI", or names the active writer). Errors use `plainAiMessage`.
- Per call this takes about 4 s and costs under a cent (same as activity suggestions).

## 4. Add project from folder

- **Server:** `POST /api/pick-folder` (guarded by `activityGuard`) opens the Windows folder dialog by running
  PowerShell with `System.Windows.Forms.FolderBrowserDialog` in an STA thread and returns `{ path }`, or
  `{ cancelled: true }`. On other systems it returns 501 with "Type the folder path instead". The path is returned
  as chosen, never listed or read.
- **Settings → Projects:** a button "Add project from folder". It picks a folder, then in one step: creates a
  project named after the folder (the last path segment) with the next unused swatch and links the folder to it for
  activity suggestions (`addActivityFolder`, the existing `activityFolders` setting). If a project with that name
  already exists it is reused; if the folder is already linked the user is told which project owns it. A plain
  path field remains for non-Windows systems or when the dialog is unavailable.
- Folder links stay device-specific (not in backups), as today.

## Constraints

- No new npm dependencies. v2 UI rules apply (three type sizes, flat surfaces, WCAG AA, `ModalShell` for dialogs,
  44 px targets on phones, `IconButton` with a label, memoized screens with stable handlers).
- Data-model change is optional fields only (`AppSettings.lastProjectId?`); follow the `data-model-change` skill.
- Local dates and "tracked time only" rules are unchanged. Tests set `process.env.TZ = 'Asia/Dhaka'`.
- Existing smoke checks are updated for the new Today and Tasks layouts; the AI routes stay stubbed in smoke tests
  (never a real `claude` or Gemini call).

## Decisions made after the builder check (designer's calls; they win over earlier text)

1. **AI writer default.** An absent `activityAi` means Claude for everyone, including people who saved a Gemini key
   earlier; Gemini is used only when the user picks it in Settings. `none` now means "no AI" for all three flows
   (standup, end-of-day, suggestions). When the server is bound to 0.0.0.0 (LAN mode) the Claude routes answer 403 and
   the app falls back to the offline templates; this is accepted (the user runs it locally).
2. **`#` completion in Plan your day** keeps the tag in the text, per line: picking a project replaces the typed word
   with the full name (`#HMIS`) so each line carries its own project; the selector is only the default for lines with
   no tag. In the single-line inputs (Today's tasks, quick log) the `#word` is removed and the selector switches.
   `lastProjectId` is written only when a task or log is actually submitted, with the project it used.
3. **Tasks page left column.** `groupTasks` keeps counting a running task as today's. Paused and blocked tasks stay under
   their own date groups, running ones under Today, with Done recently below. Not-started (`planned`) tasks are only in
   the Plans column. "Move all to today" belongs to the Plans column's earlier-day groups (planned tasks only);
   each started task keeps "Move to today" in its row menu.
4. **Add project from folder is one action that saves at once.** `handleAddProjectFromFolder(path)` in App creates (or
   reuses, un-archiving it if archived) the project, saves it, and writes the folder link into `activityFolders` with
   `updateSettings`, without waiting for the Settings Save button; the Settings draft state is refreshed from it.
   The project name is the last path segment, or "<letter> drive" for a drive root such as `C:\`.
5. **Plan your day candidates** are only earlier tasks in the `planned` stage; paused and blocked tasks already show on
   Today in their state group and are not offered for carrying.
6. **Folder dialog behaviour.** PowerShell runs with a hidden TopMost owner form so the dialog comes to the front. The
   request times out after 5 minutes, the process is killed if the client disconnects, only one dialog can be open
   (a second request answers 409), and when an `Origin` header is present it must be `http://localhost:<port>` or
   `http://127.0.0.1:<port>`.

## Left to the builder

Component and file names, the exact markers' shapes (within the rules above), copy, how the Tasks page stacks on
narrow widths, and the PowerShell invocation details.
