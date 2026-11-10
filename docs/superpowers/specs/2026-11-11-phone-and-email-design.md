# WorkPulse: phone page, phone inbox, evening email, date-grouped pending tasks

Date: 2026-11-11 · Branch: `feat/phone-and-email` (from `design/v2`, which is not merged yet)

## Intent

WorkPulse is one person's record of their office day. The v2 redesign made the desktop app the place where that
record is made. This project adds the two things around it that the user asked for:

- **The phone.** On the commute the user plans the day ("this, this and this today") on their phone. Those tasks
  must be waiting on the PC when the app opens. The user can also look at their tasks and logs from the phone.
- **The evening email.** A daily summary of the office day, sent to the user at a set time.

Alongside, the user changed how pending tasks should behave: they stay under the day they were assigned, grouped by
date, and a short "Plan your day" step after clocking in lets the user carry them to today.

The user plans to turn the app into a desktop app later (always visible, showing time in, time left and the
day's work at a glance). That is not part of this project, but nothing here may make it harder.

## Decisions the user made

- **Phone does:** view logs, view pending tasks, add tasks. Nothing else (no timers, no clock, no writing logs).
- **Storage:** the user's Google Sheet, on a **personal Gmail** account. No new server.
- **Phone security:** a secret link plus a **PIN**.
- **Evening email:** to the user only, at a **fixed time** set in Settings.
- **Phone task date:** **Today or Tomorrow**.
- **Pending tasks:** stay under their own date, grouped by date (today first, then yesterday, then older days).
  After clock-in, a **Plan your day** step lists the unfinished earlier tasks and the phone tasks; the user carries
  each to today or leaves it. Nothing moves on its own.
- The user said they will answer any question about requirements.

## Goals

1. A phone page, served by the user's own Google Apps Script, opened from a private link and a PIN.
2. A phone inbox: tasks added on the phone reach the desktop app when it is connected, once each, without loss.
3. An evening email with hours, logs by project, tasks done and tasks still open.
4. Pending tasks grouped by date on the Today and Tasks screens; the automatic rollover to today is removed.
5. The Plan your day step after clock-in.
6. The desktop sync code is plain logic with no browser-only assumptions, so a tray app can run it later.

## Non-goals

- Starting or stopping timers, clocking in or out, or writing logs from the phone.
- The desktop app itself, push notifications, live (real-time) sync, more than one user.
- Changes to the log columns in the Sheet. Existing script users keep working for log sync without upgrading.
- Generating a QR code (no new dependencies); the link is copied or typed.

## Anti-goals (a failure even if it works)

- The phone page or any new script action answers without the PIN.
- A phone task appears twice on the desktop, or is lost when the Sheet or the network fails mid-way.
- The email claims more recent data than it has. It must say when the desktop last sent its data.
- A task silently moves day or disappears. Tracked time rules do not change.
- The phone page looks like a pasted-in afterthought: it uses the Chase look (pitch band, chalk ground, gold).

## How it works

### The Google script (version 3)

`GOOGLE_APPS_SCRIPT_CODE` in `src/utils/googleAppsScriptTemplate.ts` gains these. The existing log actions, the
12 log columns and `ping` stay exactly as they are; `ping` reports `version: 3`. Users still on version 2 keep
syncing logs; the new features tell them to re-paste and redeploy the script.

New tabs, created on first use:

| Tab | Columns | Written by |
|---|---|---|
| `WorkPulse_Tasks` | Id, Title, Project, ProjectId, DueDate, Stage, TrackedMinutes, CompletedAt, FromPhone | desktop, replaced as a whole on each push |
| `WorkPulse_Days` | Date, ClockIn, ClockOut | desktop, replaced as a whole on each push |
| `WorkPulse_Inbox` | Id, CreatedAt, Title, ProjectId, ProjectName, DueDate, Status (`pending` / `taken`) | phone adds; desktop marks `taken` |

Config lives in the script's Script Properties: the PIN hash, the failed-attempt counter and lock time, the
project list (JSON), the email settings, the time of the last desktop push, and the user's time zone.

**PIN rule.** Every new action needs the PIN except the first `setPin`. The PIN is stored as a SHA-256 hash.
Setting a PIN when none exists is allowed (the secret link is the first factor); changing it needs the old PIN.
After 5 wrong PINs the script refuses all PIN checks for 15 minutes. The PIN is always sent in a POST body,
never in a URL.

New actions (POST, JSON; all return `{ status: 'ok', ... }` or `{ status: 'error', message }`):

- `setPin { pin, oldPin? }`
- `pushState { pin, tasks[], workdays{}, projects[], tz }`: replaces `WorkPulse_Tasks` and `WorkPulse_Days`, stores
  the project list, the zone and the push time.
- `pullInbox { pin }` returns the `pending` inbox items. `ackInbox { pin, ids[] }` marks them `taken`.
- `setEmail { pin, enabled, hour, minute, tz }`: deletes the script's existing `sendEveningEmail` triggers and, when
  enabled, creates one daily time-based trigger in `tz` near that time (Google fires it within about 15 minutes).
- `sendTestEmail { pin }`: sends today's email right now.

The phone page is served by `doGet?page=phone` (HtmlService, one self-contained file with a viewport tag). It
calls two server functions with `google.script.run`: `phoneData(pin)` (open tasks, recent logs, today's clock-in,
projects, last-push time, inbox items still pending) and `phoneAddTask(pin, task)`. `phoneData` reads logs from the
existing `WorkPulse_Logs` tab, the last 14 days.

### The phone page

One page at 390 px, Chase look (pitch-green band, chalk ground, gold action, system font stack with Archivo when
available). Steps: PIN screen (the PIN is remembered on that phone; a Lock link forgets it, three wrong PINs show
the lockout time), then three tabs.

- **Tasks:** the band shows worked time so far today (from today's clock-in) when clocked in, otherwise "Not
  clocked in". Pending tasks are grouped by date: Today, Tomorrow (if any), Yesterday, then older dates. Done
  tasks are not listed. Tasks added on the phone and not yet taken by the desktop show a "waiting for your PC" mark.
- **Log:** logs of today and the previous days, grouped by day with the day's total minutes, project colour ribbons.
- **Add:** title, project (from the pushed list), a Today / Tomorrow switch, Add. After adding the task shows
  at once under Tasks with the waiting mark. A one-line "as of 17:40" shows when the desktop last sent its data.

The phone shows a refresh button (no automatic polling). Everything else is read-only.

### The desktop side

- **Pure logic in `src/utils/phoneSync.ts` (unit-tested):** `buildSnapshot(backlog, workdays, projects)` (tasks as
  rows: title, project, due date, stage, tracked minutes rounded down, not `done` older than 7 days);
  `snapshotSignature(...)` (ignores `elapsedSeconds`, so a running timer does not change it);
  `mergeInbox(backlog, projects, items, today)` returns new `BacklogTask`s (id = the inbox id, stage `planned`,
  `dueDate` and `originalDate` = the item's date, `fromPhone: true`) and skips ids already present.
- **A `usePhoneSync` hook in App** runs when a Sheet URL and a PIN are set. **Push:** after data is loaded and
  whenever the signature changes, debounced 5 s; also every 5 minutes while a timer runs, so the email's tracked
  minutes stay close. **Pull:** at load, when the window gains focus, and every 60 s while visible. After a pull it
  saves the merged backlog and only then calls `ackInbox`; if the ack fails, the next pull skips the duplicates
  (the ids already exist). A toast says "3 tasks added from your phone". Failures set a quiet status in Settings
  ("Last phone sync 17:40 · failed once") and retry on the next cycle; they never show an error toast per cycle.
- **The proxy** `/api/sheets/proxy` is reused unchanged: all new calls are `POST` with a payload.
- **Settings gets a "Phone & evening email" section:** the PIN (set or change; shown once on set, not kept readable),
  the phone link ("Copy link" and "Open"; the link is the script URL with `?page=phone`), the email switch, a time
  field (default 18:00), "Send a test email", the script version with "re-paste and redeploy" help when it is below
  3, and the last-sync status. **Device-only settings** (not in backups, like the Gemini key): `phonePin`,
  `phoneSyncAt`. In backups: `emailEnabled`, `emailTime` (`"HH:MM"`).

### Pending tasks by date (desktop)

- `rollOverTasks` in `storage.ts` still normalises `stage` / `completed` / running state, but **no longer moves
  `dueDate`**. The midnight interval in `App.tsx` that only existed for the move is removed. Tasks that were already
  rolled over keep their current `dueDate` (no migration); `isRolledOver` and `originalDate` stay on the type but are no
  longer used to place tasks.
- **Tasks screen:** sections are Today, then earlier days newest first (label "Yesterday", then "Mon 9 Nov"), then
  Upcoming days oldest first, then Done recently. Every pending task sits under its own date; blocked tasks show
  their blocked state inline. Each earlier group has "Move all to today"; each task has "Move to today" in its menu.
- **Today screen:** the tasks card shows today's tasks, then "Earlier, still pending" with the same date groups.
- **Plan your day** (`PlanYourDayDialog`, ModalShell): opens right after the user's first clock-in of a date
  (not after Resume), after the app tries one inbox pull (up to 3 s). It has three parts: phone tasks just taken
  ("From your phone", read-only list); earlier pending tasks, each with a checkbox, all ticked by default
  ("Carry to today"); and a box where each line becomes a task for today (`#project` picks the project). "Start the
  day" applies the carries and the new tasks; Skip or Escape closes it without changes. It is also reachable later
  from the Today tasks card ("Plan your day").
- The next-action order (v2 spec, Decision 2) is unchanged.

### The evening email

The script function `sendEveningEmail()` builds today's summary (the date in the user's zone) from the Sheet and
sends it with `MailApp` to the script owner's own address, as both an HTML body (inline styles, Chase colours) and a
plain-text fallback.

- Subject: `WorkPulse · Tue 10 Nov · 8:04 worked · 5 logs`.
- Top lines: in and out times (or "still clocked in" / "not clocked in"), worked time against the target, and
  "Data from your PC as of 17:40" (the last push time, or "no data from your PC today" when older than today).
- Logs grouped by project with minutes and each log's description; the day total.
- Tasks done today, then tasks still open grouped by date, then a count of phone tasks not yet taken.
- **Send rule:** the email is sent only if the day has at least one log or a clock-in; otherwise nothing is sent
  (rest days, holidays).
- The target hours come from the pushed state (`workdayHours`, default 8).

### One-time setup the user does (once, with the new script version)

Paste the new script into Apps Script, redeploy the web app, accept the permissions Google asks for (the Sheet,
sending email, running a daily trigger), then set the PIN and the email time in Settings. Settings explains each step.

## Constraints

- No new npm dependencies. The phone page and email are plain HTML, CSS and JavaScript inside the script string.
- The script must stay valid Apps Script (ES5-compatible style, like the existing code).
- The data model changes follow the `data-model-change` skill: `BacklogTask.fromPhone?`, `AppSettings.phonePin?`,
  `phoneSyncAt?`, `emailEnabled?`, `emailTime?`; all optional, so old data loads unchanged. `buildBackup` leaves out
  `phonePin` and `phoneSyncAt` and `parseBackup` clears them on import.
- Dates are the user's local dates (`src/utils/dates.ts`); the script uses the zone the desktop sends.
- The Apps Script cannot be tested against real Google from here. It is tested in Node with fakes for
  `SpreadsheetApp`, `PropertiesService`, `MailApp`, `ScriptApp`, `HtmlService` and `Utilities`, loading the script
  text from `GOOGLE_APPS_SCRIPT_CODE`. The user's first real deployment follows a short manual checklist
  (written into the plan), because the phone page, `google.script.run` from an anonymous page, and the trigger need
  real Google to confirm.
- `src/utils/phoneSync.ts` and the script contain no `window` or React imports.
- v2 rules still apply: three type sizes, flat surfaces, WCAG AA, plain-sentence copy, `ModalShell` for dialogs.

## Decisions made after the builder check (designer's calls)

These change or sharpen the text above; where they disagree, this section wins.

1. **Two secrets, not one.** The phone PIN and a **desktop token** are separate. When `setPin` succeeds the script
   creates a long random token and returns it once; the desktop keeps it (`AppSettings.phoneToken`, device-only, never in
   backups) and uses it for `pushState`, `pullInbox`, `ackInbox`, `setEmail`, `sendTestEmail` and changing the PIN. Only
   wrong **PIN** attempts (the phone) count toward the 5-tries / 15-minute lockout, so someone guessing PINs can never
   block the desktop's sync. The failure counter, the inbox writes and the state replacement run inside
   `LockService.getScriptLock()`. Setting a first PIN is still allowed without a secret (the secret link is the first
   factor). Losing the token (new PC, cleared data) is recovered with "Reset phone access" in Settings, which asks for
   the current PIN, and issues a new token.
2. **Logs on the phone and in the email come from the desktop's own list.** `pushState` also sends the logs of the last
   14 days (id, date, time, project, description, status, minutes) into a new tab `WorkPulse_Recent`, replaced as a whole.
   So edits and deletes show on the phone and in the email as they are on the PC, with no change to the 12 log columns.
   The phone's Log tab shows those 14 days and an "Earlier" button that reads older days read-only from
   `WorkPulse_Logs`, 14 days at a time, so the user can still see everything in the Sheet.
3. **A task being worked on belongs to today.** Starting or resuming a task (stage becomes `in_progress`) sets its
   `dueDate` to today. A timer still running when the date changes moves to the new day. Pausing, blocking or finishing
   does not change the date. `isEodCandidate` and the End my day task step keep working because the tasks a person
   worked on today are dated today; tasks left on earlier days are not offered for today's timesheet.
4. **One computer (confirmed by the user).** The design assumes the user runs WorkPulse on one computer (its data lives in that browser).
   Settings says so under "Phone & evening email", and the script remembers a random device id sent with each push;
   if a push arrives from a different device id, Settings shows "Another computer is also sending data to this Sheet.
   Only one computer should." and the push still happens. (If the user answers that they use two computers, this
   becomes a separate design.)
5. **Plan your day** leaves tasks whose stage is `blocked` unticked; every other earlier pending task is ticked.
6. **Apps Script details the builder must use:**
   - `doGet?page=phone` returns `HtmlService.createHtmlOutput(html).setTitle('WorkPulse').addMetaTag('viewport',
     'width=device-width, initial-scale=1')` (a viewport tag inside the HTML is ignored in the sandboxed frame).
   - The PIN is "remembered on this phone" as best effort (browsers may drop that storage after about a week); entering
     it again must stay quick (4 digits, number keypad, auto-submit).
   - Every date read from a Sheet is normalised with `Utilities.formatDate(value, spreadsheetTimeZone, 'yyyy-MM-dd')`;
     the date columns of the new tabs are plain text (`setNumberFormat('@')`).
   - The project list goes in the state tab `WorkPulse_Tasks` header area or its own small tab (`WorkPulse_Projects`), not in
     one Script Property (9 KB limit). Script Properties hold only small values.
   - Setup help says: update the **existing** deployment (Deploy → Manage deployments → edit → new version). "New
     deployment" creates a new URL and breaks the link saved in WorkPulse.
7. **Phone and desktop agree on dates** by sending the local date as text (`YYYY-MM-DD`) in every payload; the script
   never derives a day from a timestamp except for the email, where it uses the zone the desktop last sent.

## Left to the builder

File and component names, the exact HTML and CSS of the phone page and the email (within the look above), copy,
the layout of the new Settings section, the debounce plumbing, and how the Node harness fakes the Apps Script globals.
