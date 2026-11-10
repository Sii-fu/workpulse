# Phone, Inbox, Evening Email and Date-Grouped Tasks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tasks added on the user's phone reach the desktop app, a PIN-protected phone page shows tasks and logs, an evening email summarises the day, and pending tasks stay under their own date with a Plan your day step after clock-in.

**Architecture:** The user's Google Apps Script (version 3) is the only backend: new Sheet tabs hold a snapshot the desktop pushes, a phone inbox the desktop pulls, and recent logs; the script also serves the phone page and sends the email from a daily trigger. The desktop side is pure, tested logic (`phoneSync.ts`, `phoneApi.ts`) plus one hook in App. The task list change (no automatic rollover, date groups) is independent and comes first.

**Tech Stack:** React 19, TypeScript, Tailwind v4 tokens (v2 themes), Vitest, Google Apps Script (plain JS inside a TS string), Python Playwright smoke test.

**Spec:** `docs/superpowers/specs/2026-11-11-phone-and-email-design.md`. Read it first, including "Decisions made after the builder check": that section wins where it disagrees with earlier text. Mockups: `.impeccable/mocks/phone-email/phone.html` and `email.html`. Design system: `DESIGN.md`.

## Global Constraints

- No new npm dependencies. No QR code. The phone page and the email are plain HTML/CSS/JS inside script strings.
- The Apps Script must stay valid Apps Script in the existing style: `var` and `function` declarations, no modules, no `import`, no arrow functions or `let/const` (matches the current script). Existing actions (`ping`, `appendLog`, `batchSync`), the 12 log columns and the `Id`-upsert behaviour do not change. `ping` returns `version: 3`.
- `src/utils/phoneSync.ts`, `src/utils/phoneApi.ts` and the script contain no `window`, no React and no `localStorage`.
- Dates are local `YYYY-MM-DD` strings (`src/utils/dates.ts`). Never `toISOString().split('T')[0]`. Tests that touch dates set `process.env.TZ = 'Asia/Dhaka'`. Payloads carry local dates as text; the script normalises every date read from a Sheet with `Utilities.formatDate(value, spreadsheetTimeZone, 'yyyy-MM-dd')` and writes new-tab date columns as plain text (`setNumberFormat('@')`).
- Security rules: every new script action needs the phone PIN or the desktop token (except the first `setPin`); only wrong **PIN** attempts count toward the lockout (5 tries, 15 minutes); the PIN and token are only ever sent in a POST body; PIN is stored as a SHA-256 hash, the token as a hash too; the failure counter, inbox writes and state replacement run under `LockService.getScriptLock()`. All user text put into HTML (phone page and email) is escaped or set with `textContent`.
- Data-model changes are optional fields only (`data-model-change` skill): `BacklogTask.fromPhone?`, `AppSettings.phoneToken?`, `phoneSyncAt?`, `phoneDeviceId?`, `phoneLastError?`, `emailEnabled?`, `emailTime?` (`"HH:MM"`). `buildBackup` omits `phoneToken`, `phoneSyncAt`, `phoneDeviceId`, `phoneLastError`; `parseBackup` clears them on import.
- v2 UI rules apply to new desktop UI: three type sizes (`--fs-body` 15px, `--fs-small` 13px, numerals), flat surfaces, no gradients or glass, WCAG AA, `ModalShell` for dialogs, `IconButton` with a `label` for icon-only buttons, 44px targets under 640px, plain-sentence copy. Screens given `backlog` stay memoized (`sameTasksIgnoringLiveTime`) and handlers go through `useStableCallback`.
- Commit messages end with a blank line then `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Never commit `.impeccable/` (except the mock folder already committed), `.claude/HANDOFF.md` or `.superpowers/`.

## Review Focus

1. **Wrong PINs must not lock the desktop out.** Five bad PIN attempts lock only phone PIN checks; `pushState`/`pullInbox`/`ackInbox` with the token still work (Task 4 test).
2. **A phone task is never duplicated or lost.** If `ackInbox` fails or the page closes after the merge, the next pull creates no second task; if saving locally fails, nothing is acked (Task 3 and Task 8 tests).
3. **Text injection.** A task title or log text containing `<script>`, `"` or `&` renders as text in the email and on the phone page (Tasks 5 and 6 tests).
4. **Day boundaries.** A task added "Tomorrow" at 23:30, the email near midnight, a Sheet that turned `2026-11-10` into a Date in another time zone, and a timer running across midnight all land on the right day (Tasks 1, 4 and 5 tests).
5. **Nothing moves silently.** Existing tasks that were already rolled over keep their date; unfinished tasks stay on their day; only a started/resumed task or a timer running at midnight moves to today (Task 1 tests).

---

### Task 1: Task dates stay put (no automatic rollover)

**Files:**
- Create: `src/utils/taskDates.ts`, `src/utils/taskDates.test.ts`
- Modify: `src/utils/storage.ts` (`rollOverTasks`), `src/utils/storage.test.ts`, `src/utils/taskSections.ts`, `src/utils/taskSections.test.ts`, `src/utils/todayTasks.ts` (+ its test), `src/App.tsx` (handlers named below, the midnight interval)

**Interfaces:**
- Produces (`taskDates.ts`):
  - `moveTasksToDay(backlog: BacklogTask[], ids: string[], day: string): BacklogTask[]` sets `dueDate = day` on pending tasks whose id is in `ids` and whose `dueDate !== day`; returns the same array when nothing changes.
  - `moveRunningToDay(backlog: BacklogTask[], day: string): BacklogTask[]` same, for tasks that are running (`isRunningTask`) with `dueDate !== day`.
  - `dayHeading(date: string, today: string): string`: `"Today"`, `"Tomorrow"`, `"Yesterday"`, otherwise `dayLabelLong(date)` (`"Mon 9 Nov"`).
- Produces (`taskSections.ts`): `TaskSections` becomes `{ today: BacklogTask[]; earlier: { date: string; tasks: BacklogTask[] }[]; upcoming: { date: string; tasks: BacklogTask[] }[]; doneRecently: BacklogTask[] }`. `earlier` holds pending tasks due before today, newest date first; blocked tasks stay inside their date group (no separate section). `upcoming` is due after today, oldest first. Within a group the existing ranking applies (running, in-progress/paused/blocked, planned). `sectionProjectIds` and `filterByProject` are updated to the new shape. `overdue`, `overdueAdded`, `blocked` are removed.
- Produces (`todayTasks.ts`): `todaysTasks(backlog, today)` now returns tasks that are pending and (running or due `today`), plus those done today; it no longer includes earlier-dated pending tasks (they appear in the Earlier groups). Add `earlierPending(backlog: BacklogTask[], today: string): { date: string; tasks: BacklogTask[] }[]` returning the same `earlier` grouping used by `groupTasks`.
- Modifies `rollOverTasks(backlog, todayStr, nowIso?)`: keeps normalising `stage`/`completed`/`elapsedSeconds`/`isRunning` and the `ensureOpenSegment` call for running tasks, but **never changes `dueDate`**; `changed` is true only when a segment was added. Existing `isRolledOver`/`originalDate` stay on records and are ignored for placement.

- [ ] **Step 1: Write the failing tests.**
  - `taskDates.test.ts` (TZ Asia/Dhaka): `moveTasksToDay` moves only listed pending tasks, leaves done tasks, returns the identical array when nothing changes; `moveRunningToDay` moves a running task due yesterday and leaves a paused one; `dayHeading('2026-11-09','2026-11-10') === 'Yesterday'`, `('2026-11-11', ...) === 'Tomorrow'`, `('2026-11-05', ...) === 'Thu 5 Nov'`.
  - `storage.test.ts`: a planned task due `2026-11-09` with today `2026-11-10` keeps `dueDate '2026-11-09'` and `changed === false`; a task already marked `isRolledOver` with `dueDate` today stays today; a running task without an open segment still gets one (`changed === true`).
  - `taskSections.test.ts`: `groupTasks` with tasks due today, yesterday, two days ago, tomorrow and a blocked yesterday task gives `today` length 1, `earlier` = `[{date:'…-09', tasks:[planned, blocked]},{date:'…-08', …}]` newest first, `upcoming` one group; done tasks only in `doneRecently` within 7 days; project filter drops empty groups.
  - `todayTasks.test.ts`: yesterday's pending task is not in `todaysTasks`; `earlierPending` returns it grouped.
- [ ] **Step 2: Run** `npx vitest run src/utils/taskDates.test.ts src/utils/storage.test.ts src/utils/taskSections.test.ts src/utils/todayTasks.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the helpers and shape changes above. Fix every compile error the new `TaskSections` shape causes (`TasksScreen.tsx` is rewritten in Task 7; here keep it compiling by adapting it minimally to the new shape, rendering `earlier` groups where `overdue` was, and mapping `blocked` out; Task 7 refines the UI).
- [ ] **Step 4: Wire `App.tsx`.** In `handleUpdateTaskStage` (stage `in_progress`), `handleReopenTask` (target `in_progress`) and `handleAddBacklogTask` (stage `in_progress`): set `dueDate` to today's local date in the same update. Replace the midnight effect's `rollOverTasks` call with `moveRunningToDay` (run when the local date changes; save the backlog). Add a handler `handleMoveToToday(ids: string[])` using `moveTasksToDay`, a toast `"N task(s) moved to today"` with an Undo action that restores the previous `dueDate`s, exposed as `h.moveToToday` (via `useStableCallback`). Do not change anything else.
- [ ] **Step 5: Run** `npm test` and `npm run lint`. Expected: PASS.
- [ ] **Step 6: Commit** `feat(tasks): pending tasks keep their own date`.

### Task 2: Settings and data model for phone and email

**Files:**
- Modify: `src/types.ts`, `src/utils/backup.ts`, `src/utils/backup.test.ts`, `src/utils/storage.ts` (loader keeps unknown optional fields; no change needed beyond tests), `src/utils/storage.test.ts`
- Create: `src/utils/phoneSettings.ts`, `src/utils/phoneSettings.test.ts`

**Interfaces:**
- Produces (`types.ts`): `BacklogTask.fromPhone?: boolean`; `AppSettings.phoneToken?: string`, `phoneSyncAt?: string` (ISO), `phoneDeviceId?: string`, `phoneLastError?: string`, `emailEnabled?: boolean`, `emailTime?: string` (`"HH:MM"`).
- Produces (`phoneSettings.ts`):
  - `DEFAULT_EMAIL_TIME = '18:00'`
  - `parseEmailTime(v: unknown): { hour: number; minute: number } | null` accepts `"HH:MM"` 00:00 to 23:59 only.
  - `ensureDeviceId(settings: AppSettings): AppSettings` returns settings with a random `phoneDeviceId` (`dev-` + 12 random chars) when absent, else the same object.
  - `phoneLink(scriptUrl: string): string | null` returns the script URL with `?page=phone` appended (keeps existing query parameters), or null when the URL is not an `https://script.google.com/macros/s/…` URL.
- [ ] **Step 1: Write the failing tests**: `parseEmailTime` accepts `"18:00"`, `"07:05"`, rejects `"24:00"`, `"7:5"`, `""`, a number; `ensureDeviceId` adds once and is stable; `phoneLink('https://script.google.com/macros/s/ABC/exec')` ends with `/exec?page=phone`, returns null for `https://example.com`; `buildBackup` output has none of the four device-only keys even when set, but keeps `emailEnabled` and `emailTime`; `parseBackup` clears them if present in a file.
- [ ] **Step 2: Run** them. Expected: FAIL. **Step 3: Implement** types and helpers. **Step 4:** `npm test` and `npm run lint` pass. **Step 5: Commit** `feat(phone): settings fields and helpers`.

### Task 3: Desktop sync logic and script client

**Files:**
- Create: `src/utils/phoneSync.ts`, `src/utils/phoneSync.test.ts`, `src/utils/phoneApi.ts`, `src/utils/phoneApi.test.ts`

**Interfaces:**
- Produces (`phoneSync.ts`):
  - `interface SnapshotTask { id: string; title: string; projectId: string; project: string; dueDate: string; stage: TaskStage; trackedMinutes: number; completedAt?: string; fromPhone: boolean }`
  - `interface SnapshotLog { id: string; date: string; time: string; project: string; projectId: string; description: string; status: string; minutes: number }`
  - `interface PhoneSnapshot { tasks: SnapshotTask[]; logs: SnapshotLog[]; workdays: Workdays; projects: { id: string; name: string; color: string }[]; workdayHours: number; tz: string; deviceId: string; today: string }`
  - `buildSnapshot(i: { backlog: BacklogTask[]; logs: WorkLog[]; projects: Project[]; workdays: Workdays; workdayHours?: number; tz: string; deviceId: string; today: string }): PhoneSnapshot`: tasks are all pending tasks plus tasks done within the last 7 local days; `trackedMinutes = Math.floor(elapsedSeconds / 60)`; logs are those dated within the last 14 days including today (`lastNDays(today, 14)`); `workdays` only the last 14 days; archived projects omitted; `workdayHours` defaults to 8; sample-data items (`isSampleLog`/sample task ids from `src/data/sampleData.ts`) are excluded.
  - `snapshotSignature(s: PhoneSnapshot): string`: a stable string over everything **except** `trackedMinutes`, `tz` and `deviceId`.
  - `interface InboxItem { id: string; title: string; projectId: string; projectName: string; dueDate: string; createdAt: string }`
  - `mergeInbox(backlog: BacklogTask[], projects: Project[], items: InboxItem[], today: string): { backlog: BacklogTask[]; added: BacklogTask[]; takenIds: string[] }`: for each item whose id is not already a task id, append a `BacklogTask` with `id = item.id`, `title` trimmed (empty titles skipped), `projectId` = the item's project if it exists and is not archived, else the project with the same name, else the first non-archived project, `dueDate = item.dueDate`, `originalDate = item.dueDate`, `stage: 'planned'`, `completed: false`, `isRolledOver: false`, `elapsedSeconds: 0`, `isRunning: false`, `fromPhone: true`. `takenIds` lists **every** item id (including ones that already existed), so a retried ack clears them.
- Produces (`phoneApi.ts`), all calling `POST /api/sheets/proxy` with `{ scriptUrl, action, method: 'POST', payload: { action, ... } }`:
  - `interface PhoneApiResult<T = unknown> { ok: boolean; message: string; code?: string; data?: T }`
  - `setPhonePin(url: string, pin: string, auth: { token?: string; oldPin?: string }): Promise<PhoneApiResult<{ token: string }>>`
  - `pushState(url: string, token: string, snapshot: PhoneSnapshot): Promise<PhoneApiResult>`
  - `pullInbox(url: string, token: string): Promise<PhoneApiResult<{ items: InboxItem[] }>>`
  - `ackInbox(url: string, token: string, ids: string[]): Promise<PhoneApiResult>`
  - `setEmailSchedule(url: string, token: string, cfg: { enabled: boolean; hour: number; minute: number; tz: string }): Promise<PhoneApiResult>`
  - `sendTestEmail(url: string, token: string): Promise<PhoneApiResult>`
  - `resetPhoneAccess(url: string, pin: string, newPin: string): Promise<PhoneApiResult<{ token: string }>>`
  - `getScriptVersion(url: string): Promise<number | null>` via the existing `ping` GET.
  - All map network errors and `{ status: 'error' }` bodies to `{ ok: false, message: plainSheetMessage(...), code }` (use `src/utils/aiErrors.ts`); no raw "Failed to fetch".
- [ ] **Step 1: Write the failing tests** (TZ Asia/Dhaka).
  - `buildSnapshot`: includes a pending task due yesterday, a task done 3 days ago, excludes one done 10 days ago and a sample task; log from 15 days ago excluded, 13 days ago included; `trackedMinutes` floors 119 s to 1; archived project omitted.
  - `snapshotSignature`: equal when only `elapsedSeconds` (→ `trackedMinutes`) changes; different when a title or stage changes.
  - `mergeInbox`: two new items become two tasks with `fromPhone: true`; an item whose id already exists adds nothing but still appears in `takenIds`; an unknown project id falls back to the same-named project then the first active one; a blank title is skipped (and still in `takenIds`); the input array is not mutated.
  - `phoneApi`: with a stubbed `fetch`, `pullInbox` posts the expected body (`action: 'pullInbox'`, `token`, no `pin`), parses `items`; a network rejection gives `ok: false` with a plain sentence not containing "Failed to fetch"; `{status:'error', code:'locked'}` surfaces `code: 'locked'`; the PIN never appears in any URL (assert `fetch` URL has no query string with the pin).
- [ ] **Step 2: Run** `npx vitest run src/utils/phoneSync.test.ts src/utils/phoneApi.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** both modules. **Step 4: Run** `npm test` and `npm run lint`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(phone): snapshot, inbox merge and script client`.

### Task 4: Apps Script v3 core (auth, state, inbox) with a Node test harness

**Files:**
- Create: `src/utils/appsScript/core.ts` (exports `SCRIPT_CORE: string`), `src/test/appsScriptHarness.ts`, `src/utils/appsScript/core.test.ts`
- Modify: `src/utils/googleAppsScriptTemplate.ts` (split the existing code into `LOGS_SCRIPT` unchanged, compose `GOOGLE_APPS_SCRIPT_CODE = HEADER + LOGS_SCRIPT + SCRIPT_CORE` with the new routing; keep the exported name), `src/utils/sheetsSync.ts` (`testSheetConnection` treats `version < 3` as "old for phone features" with a separate message; log sync keeps working)

**Interfaces:**
- Produces (script, in `SCRIPT_CORE`; all plain ES5 functions):
  - `doPost` routes these new actions before the existing ones: `setPin`, `pushState`, `pullInbox`, `ackInbox`, `setEmail`, `sendTestEmail`, `resetAccess`. Responses: `{status:'ok', …}` or `{status:'error', code, message}` with codes `no_pin`, `bad_pin`, `bad_token`, `locked`, `bad_request`.
  - `doGet(e)`: `e.parameter.page === 'phone'` → `servePhonePage()` (defined in Task 6; until then returns a placeholder HtmlOutput); `action === 'ping'` returns `version: 3`.
  - `checkToken(token)`, `checkPin(pin)` (counts failures, locks after 5 for 15 min, resets on success; lock state stored in Script Properties under `lockUntil`/`failCount`), `hashSecret(s)` (SHA-256 hex via `Utilities.computeDigest`), all inside `withLock(fn)` (`LockService.getScriptLock().waitLock(20000)` … `releaseLock()` in `finally`).
  - Sheet tabs created on first use: `WorkPulse_Tasks`, `WorkPulse_Days`, `WorkPulse_Recent`, `WorkPulse_Inbox`, `WorkPulse_Projects` with the columns in the spec (date columns plain text). Script Properties keys: `pinHash`, `tokenHash`, `failCount`, `lockUntil`, `meta` (JSON: `pushedAt` ISO, `tz`, `deviceId`, `workdayHours`, `today`, `deviceChanged` boolean), `email` (JSON).
  - Phone-facing server functions (called by the page through `google.script.run`): `phoneData(pin)` returns `{ ok, tasks, logs, workdays, projects, pushedAt, today, workdayHours, pending: InboxItem-like[] }` (tasks not done, logs from `WorkPulse_Recent`, inbox items still `pending`) or `{ ok:false, code, message, lockedUntil? }`; `phoneAddTask(pin, task)` where `task = { title, projectId, day: 'today'|'tomorrow' }` appends an inbox row (`id = 'phone-' + timestamp + '-' + random`, `dueDate` = today or tomorrow in `meta.tz`, title trimmed to 200 chars, rejected if empty, at most 500 pending items) and returns `{ ok, item }`; `phoneOlderLogs(pin, beforeDate)` returns the next 14 days of logs older than `beforeDate` read from `WorkPulse_Logs` with dates normalised.
- Produces (harness `src/test/appsScriptHarness.ts`): `createScriptHarness(opts?: { spreadsheetTz?: string; now?: Date }): { call(action: string, payload?: object): any; get(params: object): any; run(fn: string, ...args: unknown[]): any; sheets: Record<string, any[][]>; props: Record<string, string>; mails: { to: string; subject: string; htmlBody: string; body: string }[]; triggers: { fn: string; hour?: number; minute?: number; tz?: string }[]; lockCalls: number; setNow(d: Date): void }` loading `GOOGLE_APPS_SCRIPT_CODE` with `new Function` and fakes for `SpreadsheetApp` (tabs as 2D arrays, `getRange().getValues()/setValues()`, `setNumberFormat`, `getLastRow`, `insertSheet`, `getSheetByName`, `clearContents`/`deleteRows` as the code needs), `PropertiesService.getScriptProperties()`, `LockService`, `Utilities` (`computeDigest`, `formatDate`, `base64Encode`, `getUuid`), `ContentService`, `HtmlService`, `MailApp`, `ScriptApp`, `Session` (`getEffectiveUser().getEmail()` → `'owner@gmail.com'`, `getScriptTimeZone()`). Real SHA-256 via `node:crypto`.
- [ ] **Step 1: Write the harness and the failing tests** in `core.test.ts`:
  - `ping` reports `version: 3`; existing `appendLog` still upserts by Id (regression).
  - `setPin('1234')` with no existing PIN returns a token (≥32 chars); a second `setPin` without token/oldPin → `bad_token`; with the token and a new PIN → ok and the old PIN stops working, the new one works; the hash (not the PIN) is in `props`.
  - `phoneData` with a wrong PIN → `bad_pin`; five wrong PINs → `locked` on the sixth even with the right PIN; **while locked, `pushState` with the token still succeeds** (Review Focus 1); after `setNow` +16 min the right PIN works and the counter is reset.
  - `pushState` writes `WorkPulse_Tasks`, `WorkPulse_Days`, `WorkPulse_Recent`, `WorkPulse_Projects` and `meta` (replacing a previous push fully); a push with a different `deviceId` sets `meta.deviceChanged`.
  - `phoneAddTask` with `day:'tomorrow'` at 23:30 Dhaka stores the next Dhaka date (Review Focus 4); empty title rejected; a title of 300 chars is cut to 200; the 501st pending item is rejected; `pullInbox` returns pending items only; `ackInbox` marks them `taken` and a second `pullInbox` returns none; `ackInbox` with an unknown id is ignored.
  - A Sheet whose log Date cell is a `Date` object (spreadsheet tz `America/New_York`) is normalised to the right `yyyy-MM-dd` in `phoneOlderLogs` and does not shift a day.
  - Every state-changing path called `LockService` (`lockCalls > 0`) and released it even when the body throws.
  - Task text containing `<img src=x onerror=1>` round-trips unchanged as data (escaping is the page's and the email's job).
- [ ] **Step 2: Run** `npx vitest run src/utils/appsScript/core.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the core, the composition in `googleAppsScriptTemplate.ts`, and the `sheetsSync` version message.
- [ ] **Step 4: Run** `npm test` and `npm run lint`. Expected: PASS (the existing script tests, if any, still pass).
- [ ] **Step 5: Commit** `feat(script): v3 core with PIN, token, state tabs and phone inbox`.

### Task 5: Evening email in the script

**Files:**
- Create: `src/utils/appsScript/email.ts` (exports `SCRIPT_EMAIL: string`), `src/utils/appsScript/email.test.ts`
- Modify: `src/utils/googleAppsScriptTemplate.ts` (append `SCRIPT_EMAIL` to the composition), `src/utils/appsScript/core.ts` only if `setEmail`/`sendTestEmail` stubs from Task 4 need filling in

**Interfaces:**
- Produces (script): `buildEveningEmail(data)` (pure; `data = { date, tz, tasks, logs, workday, workdayHours, pushedAt, pendingPhoneCount }`) returns `{ skip: boolean, subject, html, text }`; `sendEveningEmail()` reads the tabs and `meta`, calls `buildEveningEmail`, and sends with `MailApp.sendEmail({ to: Session.getEffectiveUser().getEmail(), subject, htmlBody, body })` unless `skip`; `setEmail` (action) deletes existing `sendEveningEmail` triggers then, when enabled, creates `ScriptApp.newTrigger('sendEveningEmail').timeBased().atHour(h).nearMinute(m).everyDays(1).inTimezone(tz).create()` and stores `email` props; `sendTestEmail` sends today's email immediately and never skips (a test on an empty day sends an email saying there is no data yet).
- Email content (follow the mockup `.impeccable/mocks/phone-email/email.html`): subject `WorkPulse · Tue 10 Nov · 8:04 worked · 5 logs`; header block (date, worked time against the target, in/out, or "still clocked in" / "not clocked in"); a line `Data from your PC as of 17:52.` when `pushedAt` is today (in `tz`), `No data from your PC today.` otherwise; logs grouped by project with minutes and descriptions and the day total; tasks done today; still-open tasks grouped by date with `Today`/`Yesterday`/`Mon 9 Nov` headings; a warning line when phone tasks are still pending; a footer stating the send time and where to change it. Inline styles only; Chase colours (`#0f3d2e` header, `#f2b705` figure). Skip rule: `skip: true` when the day has no log and no clock-in.
- [ ] **Step 1: Write the failing tests** (via the harness; fixed `now`, tz `Asia/Dhaka`): subject text exactly as above for 5 logs and 484 minutes; HTML contains each project heading and every description **escaped** (a description `<script>alert(1)</script> & "x"` appears as `&lt;script&gt;…` and never as a raw tag; Review Focus 3); plain text version has no tags; skip rule (no logs, no clock-in → `mails.length === 0`; clock-in only → sent); stale push (`pushedAt` yesterday) shows `No data from your PC today.`; open tasks from yesterday are listed under `Yesterday`; `setEmail enabled` leaves exactly one trigger (calling it twice does not add a second) with the given hour/minute/tz; `enabled:false` removes it; `sendTestEmail` on an empty day sends one email; mail recipient equals the effective user.
- [ ] **Step 2: Run** `npx vitest run src/utils/appsScript/email.test.ts`. Expected: FAIL. **Step 3: Implement.** **Step 4: Run** `npm test` and `npm run lint`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(script): evening email and its daily trigger`.

### Task 6: The phone page

**Files:**
- Create: `src/utils/appsScript/phonePage.ts` (exports `PHONE_PAGE_HTML: string` and `SCRIPT_PHONE: string` containing `servePhonePage()`), `src/utils/appsScript/phonePage.test.ts`, `tests/smoke/phone_page.py`
- Modify: `src/utils/googleAppsScriptTemplate.ts` (append `SCRIPT_PHONE`), `src/utils/appsScript/core.ts` (replace the Task 4 placeholder so `doGet?page=phone` serves the page)

**Interfaces:**
- Produces (script): `servePhonePage()` returns `HtmlService.createHtmlOutput(PHONE_PAGE_HTML).setTitle('WorkPulse').addMetaTag('viewport', 'width=device-width, initial-scale=1')`; the page HTML is embedded as a JSON-escaped string.
- Page behaviour (match `.impeccable/mocks/phone-email/phone.html`): PIN screen with a 4-digit keypad that auto-submits, remembers the PIN in `localStorage` best-effort (wrapped in try/catch; works without it) and offers Lock; three tabs Tasks / Log / Add; Tasks grouped by `Today`, `Tomorrow`, `Yesterday`, older dates (newest first), pending tasks only, project colour ribbon, phone-added items marked "waiting for your PC"; the band shows worked time so far today from `workdays[today].clockIn` (or "Not clocked in"); Log tab grouped by day with minutes and an "Earlier" button calling `phoneOlderLogs`; Add tab with title, project select, Today/Tomorrow switch, submit; after submit the task appears at once; "Data from your PC as of HH:MM · Refresh"; lockout message with the time; wrong-PIN message with tries left is not shown (the script does not report tries; show "Wrong PIN."). No external scripts or fonts (system font stack). All server data inserted with `textContent` or an `esc()` helper; no `innerHTML` with data.
- [ ] **Step 1: Write the failing tests** in `phonePage.test.ts`: `PHONE_PAGE_HTML` contains no `src="http` / `href="http` external resource, no `innerHTML` assignment fed from data (assert the page script only uses `textContent`, `createElement` or the `esc` helper: a simple regex that `innerHTML` is absent), has the `google.script.run` calls `phoneData`, `phoneAddTask`, `phoneOlderLogs`; the harness `get({parameter:{page:'phone'}})` returns an output whose title is `WorkPulse` and viewport meta is set; the composed script string is under 200 KB.
- [ ] **Step 2: Write `tests/smoke/phone_page.py`** (Python Playwright; load the page HTML text with a stubbed `window.google.script.run` chain that returns canned `phoneData` including a task titled `<img src=x onerror=window.__pwned=1>`; at 390×844 assert: PIN screen first; a correct PIN shows Tasks with groups Today and Yesterday; the hostile title renders as text and `window.__pwned` is undefined; Add submits `phoneAddTask` with `day:'tomorrow'` when Tomorrow is chosen; Log tab shows day totals; a `locked` response shows the lockout text; no horizontal scroll; screenshots to the path given as argv[1]). It is run by hand (not part of `npm run test:smoke`) and its command is noted in the Task 9 docs.
- [ ] **Step 3: Run** `npx vitest run src/utils/appsScript/phonePage.test.ts`. Expected: FAIL. **Step 4: Implement the page.** Design floor: read `C:\Users\DELL\.claude\skills\impeccable\reference\craft-floor.md` first; Chase look from `DESIGN.md`. **Step 5:** run `python tests/smoke/phone_page.py <scratch dir>` (write the screenshot path under the scratchpad, not the repo) and look at the screenshots; fix what is wrong. **Step 6: Run** `npm test` and `npm run lint`. Expected: PASS.
- [ ] **Step 7: Commit** `feat(script): PIN-protected phone page`.

### Task 7: Tasks and Today screens group pending tasks by date

**Files:**
- Modify: `src/components/v2/tasks/TasksScreen.tsx`, `src/components/v2/today/TodayTasks.tsx`, `src/components/v2/today/TodayScreen.tsx`, `src/components/v2/today/TaskRow.tsx`, `src/App.tsx` (pass `onMoveToToday`)

**Interfaces:**
- Consumes: `groupTasks`, `dayHeading`, `earlierPending` (Task 1), `h.moveToToday(ids: string[])` (Task 1).
- Produces: `TaskRowProps` gains optional `onMoveToToday?(id: string): void`: when given, the row menu shows "Move to today" (hidden for done tasks and for tasks already due today); rows with `fromPhone` show a small muted "from phone" text on the meta line. `TasksScreenProps` and `TodayScreenProps` gain `onMoveToToday(ids: string[]): void`.
- Layout: **Tasks** sections in order Today, then one section per earlier date newest first with the heading `dayHeading` plus the count and a "Move all to today" text button, then Upcoming day groups, then Done recently; the project filter still applies. **Today** tasks card: today's tasks, then a quiet "Earlier, still pending" block with the same date groups (collapsed to the 3 most recent days with a "Show N more days" button when there are more) and "Move all to today" per group. Empty states keep the v2 one-sentence style. Blocked tasks show their blocked state inline in their date group.
- [ ] **Step 1: Write failing unit tests** only where logic is added (none expected in components; the helpers are tested in Task 1). Instead extend `tests/smoke/smoke.py` in Task 9; here verify in the browser.
- [ ] **Step 2: Implement** the UI. Read `DESIGN.md` and `craft-floor.md` first. Keep the screens memoized.
- [ ] **Step 3: Browser check** (webapp-testing pattern, `with_server.py`, scratch scripts outside the repo): seed tasks due yesterday and two days ago (set `workpulse_backlog` before load via `add_init_script`), confirm the groups and headings in Chase and Time Card at 1440×900 and 390×844, "Move to today" and "Move all to today" move them and the Undo toast restores them, a started old task jumps to today. Save screenshots in the scratchpad.
- [ ] **Step 4: Run** `npm test`, `npm run lint`, `npm run build`, and the current `npm run test:smoke` (update any selector the new headings break; the Tasks "Overdue" section no longer exists). Expected: PASS.
- [ ] **Step 5: Commit** `feat(tasks): date groups, move to today`.

### Task 8: Plan your day, phone sync hook and Settings section

**Files:**
- Create: `src/components/v2/PlanYourDayDialog.tsx`, `src/hooks/usePhoneSync.ts`, `src/components/v2/settings/PhoneEmailSection.tsx`, `src/utils/planYourDay.ts`, `src/utils/planYourDay.test.ts`
- Modify: `src/App.tsx`, `src/components/SettingsView.tsx` (add the section after Google Sheet), `src/components/v2/today/TodayTasks.tsx` (a "Plan your day" text button)

**Interfaces:**
- Produces (`planYourDay.ts`): `planCandidates(backlog: BacklogTask[], today: string): { carry: BacklogTask[]; defaultCheckedIds: string[] }`: pending tasks due before today; `defaultCheckedIds` is every one except tasks whose stage is `blocked`. `applyPlan(backlog: BacklogTask[], carryIds: string[], today: string): BacklogTask[]` = `moveTasksToDay`.
- Produces (`usePhoneSync.ts`): `usePhoneSync(args: { settings: AppSettings; saveSettings(next: AppSettings): void; backlog: BacklogTask[]; logs: WorkLog[]; projects: Project[]; workdays: Workdays; today: string; mergeAndSaveBacklog(next: BacklogTask[]): boolean; onTasksAdded(added: BacklogTask[]): void }): { syncNow(): Promise<void>; pullNow(): Promise<BacklogTask[]>; status: { lastPushAt?: string; lastError?: string; busy: boolean } }`. Active only when `googleScriptUrl` and `phoneToken` are set. **Push:** compute `buildSnapshot` + `snapshotSignature` (timezone `Intl.DateTimeFormat().resolvedOptions().timeZone`, `settings.phoneDeviceId`); push when the signature changed since the last successful push, debounced 5 s, and at most every 5 minutes while a timer runs and the signature is unchanged; on success store `phoneSyncAt`; on failure store `phoneLastError` (one short plain sentence) and retry on the next cycle without a toast. **Pull:** at load (after data is loaded), on window focus and every 60 s while the page is visible: `pullInbox`, `mergeInbox`, then call `mergeAndSaveBacklog(next)`; **only if it returned true (saved)** call `ackInbox(takenIds)`; then `onTasksAdded(added)` (App toasts "N tasks added from your phone"). One pull/push in flight at a time.
- Produces (`PlanYourDayDialog`): `PlanYourDayDialog: React.FC<{ isOpen: boolean; onClose(): void; today: string; phoneTasks: BacklogTask[]; candidates: BacklogTask[]; defaultCheckedIds: string[]; projects: Project[]; onStart(r: { carryIds: string[]; newTasks: { title: string; projectId: string }[] }): void }>` (ModalShell). Parts: "From your phone" read-only list (hidden when empty); "Still pending from earlier days" with a checkbox per task and the date as meta; "Add today's tasks" textarea where each non-empty line becomes a task and a trailing `#project` picks the project by name prefix (reuse `splitProjectTag` from `src/utils/projects.ts`; default project is the first active one); "Start the day" calls `onStart`; "Skip" and Escape close without changes.
- Produces (`PhoneEmailSection`): sections inside Settings: **Phone**: status line (script version, "Last sent from this computer 17:40" or the last error), "Set PIN" (new PIN twice, 4 to 8 digits; on success store the returned token, show "PIN saved. Open the phone link and enter it once."), "Change PIN", "Reset phone access" (asks for the current PIN and a new PIN, stores the new token), the phone link with "Copy link" and "Open"; the note "Use this on one computer only."; the setup help (paste the new script, **edit the existing deployment and choose a new version**, accept permissions). **Evening email**: switch, time field default `18:00`, "Save", "Send a test email", result sentence. When the script version is below 3, the section shows only the re-paste help.
- App wiring: `handleClockIn` — after a first clock-in for a date (not Resume), call `pullNow()` (wait up to 3 s), then open `PlanYourDayDialog` with that pull's added tasks as `phoneTasks`; `onStart` applies `applyPlan` and `handleAddBacklogTask` for each new task (one state update each) and shows a toast. The mid-day "Plan your day" button on the Today tasks card opens the same dialog with `phoneTasks = []`. The next-action order is unchanged. New props passed to memoized screens are stable (`useStableCallback`).
- [ ] **Step 1: Write the failing tests** `planYourDay.test.ts`: candidates exclude today's and done tasks; blocked tasks are not in `defaultCheckedIds`; `applyPlan` moves only the given ids. For the hook, extract its decision logic into pure functions in `usePhoneSync.ts` and test them: `shouldPush({ signature, lastSignature, lastPushAtMs, nowMs, running })` (true on change; false when unchanged and no timer; true when unchanged, a timer runs and ≥5 min passed), and `pullAndMerge(deps)` (an injectable async function taking `{ pull, merge, save, ack }`) so the test shows: a successful save then ack; **a failed save means ack is not called** and nothing is lost; an ack failure leaves the tasks in place and a second `pullAndMerge` with the same items adds no duplicates (Review Focus 2).
- [ ] **Step 2: Run** `npx vitest run src/utils/planYourDay.test.ts src/hooks`. Expected: FAIL.
- [ ] **Step 3: Implement.** Read `DESIGN.md` and `craft-floor.md` first; follow `ClockInDialog` and `EndDayDialog` for dialog and Settings section conventions.
- [ ] **Step 4: Browser check** (stub `/api/sheets/proxy` with Playwright routes serving canned `pullInbox`/`pushState` answers): clock in → Plan your day opens with a phone task and yesterday's tasks; carrying moves them; Skip changes nothing; resume does not reopen it; Settings: set PIN stores a token and shows the link; the status line updates after a push; a failing proxy shows one quiet error and no toast. Screenshots in the scratchpad.
- [ ] **Step 5: Run** `npm test`, `npm run lint`, `npm run build`, `npm run test:smoke`. Expected: PASS.
- [ ] **Step 6: Commit** `feat(phone): plan your day, phone sync and Settings section`.

### Task 9: Smoke test, docs and the real-deployment checklist

**Files:**
- Modify: `tests/smoke/smoke.py`, `CLAUDE.md`, `PRODUCT.md`, `.claude/skills/data-model-change/SKILL.md`
- Create: `docs/phone-and-email-setup.md`

- [ ] **Step 1: Extend the smoke test** (keep the AiGuard idea: stub the proxy so no request reaches Google): pending tasks stay under their date after a reload with seeded old tasks; "Move to today" works; clock-in opens Plan your day only once per date and Skip changes nothing; with a stubbed proxy returning two inbox items, the tasks appear (once, even after a second pull) with "from phone"; the Settings Phone & evening email section saves a PIN (stubbed `setPin`), shows the link, and a stubbed `sendTestEmail` shows the result sentence; a safety net fails the run if any request to a real `script.google.com` host is made. Run `npm run test:smoke` (port 3000 free; after a run check `curl localhost:3000/api/health` and stop any leftover `tsx`/`node` process for E:\workpulse). Expected: all pass.
- [ ] **Step 2: Write `docs/phone-and-email-setup.md`:** the one-time setup steps in order (open the Sheet's Apps Script; paste the script from Settings; **Deploy → Manage deployments → edit existing → New version** so the URL stays; accept permissions: the Sheet, sending email, running a daily trigger; set the PIN and the email time in WorkPulse Settings; open the phone link and add it to the phone's home screen) and a **manual verification checklist** for the first real deployment: ping shows version 3; the phone page opens, PIN works, a wrong PIN says so; a task added on the phone appears in WorkPulse within a minute and only once; after the desktop pushes, the phone shows today's tasks and logs; "Send a test email" arrives from the user's own address; the trigger exists (Apps Script → Triggers); a day with no activity sends nothing. Note the commands for the offline tests (`npm test`, `python tests/smoke/phone_page.py <dir>`).
- [ ] **Step 3: Update docs:** `CLAUDE.md` (Architecture: phone sync, script v3 tabs and modules under `src/utils/appsScript/`, the harness, Plan your day, date-grouped tasks and the no-rollover rule, new settings and which are device-only, the redeploy gotcha; remove the rollover description); `PRODUCT.md` (phone page, evening email, Plan your day, single computer); `.claude/skills/data-model-change/SKILL.md` (new optional fields, the script composition files, the backup omissions).
- [ ] **Step 4: Run** `npm test`, `npm run lint`, `npm run build`. Expected: PASS.
- [ ] **Step 5: Commit** `test(phone): smoke coverage; setup guide and docs`.
- [ ] **Step 6 (controller, not a subagent task):** run the impeccable detector over the new UI, capture screenshots of the Settings section, Plan your day and the Tasks groups in the three themes plus the phone page at 390 px into `.impeccable/review/`, spawn the finish reviewer, then a whole-branch code review, as for the redesign.
