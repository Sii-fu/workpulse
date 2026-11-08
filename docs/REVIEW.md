# WorkPulse — Codebase Review

Reviewed 2026-11-08 at commit `ba61739`. This is a review only: no code was changed. Every finding below was
checked in the code. "Fix risk" says whether a fix touches stored localStorage data or code shared by many screens.

## 1. Summary

WorkPulse builds, type-checks cleanly, and all 4 themes × 4 tabs render with no console errors. The real risks
are in **data safety and timesheet accuracy**, not crashes:

- **Saved data can be lost without warning.** Screenshots are stored inline with no size limit, and a failed save
  only logs to the console, so the app keeps showing data that is gone after a reload (D1). One corrupted storage
  key makes the app load demo data, which then overwrites your real backlog within a second (D2).
- **Recorded time is unreliable.** The task timer counts ticks instead of reading the clock, so it under-counts
  in a background tab, during sleep, or with the tab closed (B1).
- **The same work can be logged or synced more than once.** EOD/convert paths can log work twice (B3, B4), and
  every manual Google Sheets sync re-appends the entire history (B2).
- **AI and Sheets failures are mostly invisible.** You get a template or nothing, with no reason given (U1, U2).
- **UTC dates are off for UTC+6.** All "today" logic is UTC, which is wrong between 00:00 and 06:00 local, and
  two date-range calculations are off by one or more days (B5–B7).
- **Security is fine for home use.** The main exposure is LAN-only (S1, S2), so binding to 127.0.0.1 closes most
  of it.

**Checks run**

| Check | Result |
|---|---|
| `npm run lint` | Pass. TS 7.0.2 enables strict by default; `--strict` also gives 0 errors. |
| `npm run build` | Pass. One 499 KB JS chunk (122 KB gzip), fine for local use. |
| `npm audit` | 1 low: esbuild GHSA-g7r4-m6w7-qqqr. Not exploitable here (S5). |
| `npm outdated` | Patch updates available for vite 8.3.6 and tailwind 4.3.5. Majors available for @google/genai 3, express 5, lucide-react 1, dotenv 18, motion 14 and @types/*; none is security-driven. Express 5 would break `app.get('*')` at server.ts:467. |
| Smoke test (webapp-testing, fresh profile) | Timeline / Tasks / Analytics / Settings in modern, minimalist, compact and matrix: 16/16 screens rendered, **0 console errors**. Only cosmetic issue: the compact table cuts project names off without an ellipsis. |

## 2. Findings

Format: **ID · Severity · Title**, followed by where it is, the impact, the fix, effort (S/M/L) and fix risk.

### Data-loss risks

**D1 · Critical · Screenshots have no size limit, and failed saves are silent**
- Where: `DailyLogger.tsx:153-168` checks only the file type, then `reader.readAsDataURL(file)`; `storage.ts:86-90` `console.error('Error saving logs:', e)`; `App.tsx:225-227` shows a success toast anyway.
- Impact: once `workpulse_logs` exceeds the ~5 MB quota (a single large phone screenshot can do it), every later save fails. Logs still appear and the success toast still shows, but everything since then is gone after a reload. Duplicating a log (`App.tsx:247`) also copies its image. Backlog saves fail silently too.
- Fix: downscale images through a canvas (e.g. max 1280 px, JPEG 0.7) and reject anything over ~300 KB. Have `save*` return success/failure, and show an error toast instead of a success toast when a save fails.
- Effort S–M · Risk: changes storage.ts, which every handler uses; stored data shape is unchanged.

**D2 · High · One unreadable key makes demo data overwrite all your real data**
- Where: `storage.ts:79-81` `return seed && { ...seed, settings: DEFAULT_SETTINGS };`. The demo backlog has a running task (`seedData.ts:148-153` `stage: 'in_progress' … isRunning: true`), and the timer saves it (`App.tsx:172-186`).
- Impact: if any key fails `JSON.parse`, even tags or settings, every key falls back to demo data. Within 1 s the timer saves the demo backlog over your real one. Logs are overwritten on the next add or delete. Settings drop to defaults, so the next theme change wipes your Gemini key and Script URL. A key holding valid JSON of the wrong type (e.g. `null`) instead crashes the page: `logs.some` at `App.tsx:553` throws and the screen goes blank.
- Fix: load each key in its own try/catch and check its shape (`Array.isArray`). On failure, copy the raw value to `workpulse_<key>_corrupt_<ts>`, show a toast, and never write the fallback over a key that exists.
- Effort S–M · Risk: changes how all stored data is loaded. Add a Vitest test first.

**D3 · Medium · Deletes have no confirmation and no undo**
- Where: `App.tsx:238-243` `logs.filter((l) => l.id !== id)` runs immediately, and the same pattern is used for tasks (`:476-480`). Delete buttons: `TimelineFeed.tsx:760`, `CompactConsoleLayout.tsx:257`, `MatrixTuiLayout.tsx:247`, `BacklogSection.tsx:1002`, `CommandSidebar.tsx:287`. The only `confirm()` is the one before reset.
- Impact: one misclick permanently deletes a log (with its screenshot) or a task (with its tracked time).
- Fix: an "Undo" toast that keeps the deleted item for ~6 s (better than a confirm dialog for a daily-use app).
- Effort S · Risk: shared handlers only.

**D4 · Medium · Backups only go one way, and reset destroys data without a backup**
- Where: `SettingsView.tsx:169-186` has JSON and CSV export but **no import anywhere**. `App.tsx:504-515` resets to the demo data, also replacing projects and tags, which the confirm text doesn't mention. There's no schema version on any key (`storage.ts:4-11`).
- Impact: an exported backup can't be restored, and "reset" is the only bulk action available.
- Fix: add a JSON import that validates the data (reusing D2's loaders), make reset take an automatic backup first, and add a `workpulse_schema_version` key as the base for future migrations.
- Effort M · Risk: import writes all stored data. Validate it and test it.

### Bugs

**B1 · High · The task timer counts ticks, not clock time**
- Where: `App.tsx:172-180` `elapsedSeconds: (t.elapsedSeconds || 0) + 1`. `startedAt` is never used to work out elapsed time.
- Impact: Chrome slows timers in hidden or minimized tabs (to about once a minute after 5 minutes hidden), so an hour of work while you're in your IDE can be recorded as a few minutes. Sleep, and time with the tab closed, are never counted; after a reload the timer resumes from the last saved second.
- Fix: store `runningSince` when a task starts; elapsed time is accumulated time plus (now − runningSince), and the 1 s tick only redraws the display. Use the data-model-change skill to add the field.
- Effort M · Risk: new task field plus a migration.

**B2 · High · Every manual "Sync Google Sheet" re-appends your entire history**
- Where: `App.tsx:527` `syncBatchLogsToSheet(settings.googleScriptUrl, logs)`; the script appends rows (`googleAppsScriptTemplate.ts:137`) and has no Id column (headers `:165-177`).
- Impact: each sync duplicates every row, including logs that were already auto-synced, so totals in the sheet double-count. It also pushes the demo logs if they're still there.
- Fix: add an `Id` column and upsert by id in the script, and/or a per-log `syncedAt` so only unsynced logs are sent.
- Effort M · Risk: new log field (migration), and you'd need to redeploy the Apps Script.

**B3 · Medium · Task time can be logged twice**
- Where: `handleConvertTaskToLog` (`App.tsx:361-389`) never sets `isSynthesized`, which is the only thing EOD checks (`EodSynthesizerModal.tsx:109` `if (t.isSynthesized) return false;`). Reopening a task (`App.tsx:331-341`) doesn't reset `elapsedSeconds`.
- Impact: completing a task logs it, then EOD logs it again. Complete (60 min), reopen, work 30 more minutes, complete: that logs 60 + 90 minutes.
- Fix: mark converted tasks as synthesized or logged, and when a task is completed again, log only the time since its last log.
- Effort S–M · Risk: changes saved task fields.

**B4 · Medium · The EOD modal can push the same items again**
- Where: `EodSynthesizerModal.tsx:125-133` returns early with an error but keeps the previous `synthesizedItems` and `selectedLogIds` (nothing in the file ever clears them), and Confirm is disabled only by `selectedLogIds.size === 0` (`:614`). Backlog selection (`BacklogSection.tsx:82`, `:307`) is never cleared after a push, and custom selection skips the `isSynthesized` check (`EodSynthesizerModal.tsx:103-105`).
- Impact: reopening the modal, or clicking "Synthesize Selected (3)" again, can push duplicate logs and duplicate Sheet rows.
- Fix: clear items and selection at the start of each synthesis, disable Confirm while an error is shown, and clear the backlog selection after a push.
- Effort S · Risk: none.

**B5 · Medium · Dates are UTC but times are local (you're on UTC+6)**
- Where:
  - `App.tsx:250-251` (same pattern at `:369-370` and `:413-417`): `date: new Date().toISOString().split('T')[0], time: new Date().toTimeString().slice(0, 5)`.
  - `storage.ts:35`: rollover runs only when the app loads.
  - `DailyLogger.tsx:54`.
  - `MinimalistZenLayout.tsx:35` vs `:78`: the header shows the local date.
  - `TimelineFeed.tsx:82-87`: UTC "today" mixed with a local start of week.
- Impact:
  - Work done between 00:00 and 06:00 local is filed under yesterday, with a local time on that wrong date.
  - Tasks created then get yesterday's due date.
  - Rollover happens only after 06:00 local, and only on a reload.
  - On Monday mornings, new logs drop out of "This Week".
- Ruled out: the 5 PM reminder (17:00 local is 11:00 UTC on the same date).
- Fix: make one deliberate decision (see Phase 3): a single `localDateStr()` helper used everywhere, a rollover check when the date changes, and a one-off fix of past log dates using each log's `createdAt` timestamp.
- Effort M · Risk: changes how stored dates are read; touches many screens.

**B6 · Medium · "This Month" filter is wrong in the first days of a month**
- Where: `TimelineFeed.tsx:86-89` `new Date(today.setDate(diffToMonday))` mutates `today`, and `startOfMonth` is then built from the mutated date.
- Impact: whenever this week's Monday falls in the previous month (e.g. on Dec 3), "This Month" starts on Nov 1.
- Fix: compute the start of the month from a fresh `new Date()`. · Effort S · Risk: none.

**B7 · Medium · Analytics "Last 7 Days" totals cover 8 days, and bar labels can be off by one day**
- Where: `AnalyticsView.tsx:42-46`: the cutoff is `getDate() - daysLimit` at local midnight, compared with `new Date(l.date)` (UTC midnight). `:59-64` takes the bar key from the UTC date and the label from the local date.
- Impact: totals, the project breakdown and the Markdown export include one extra day compared with the chart. Between 00:00 and 06:00, each bar shows the previous day's data.
- Fix: use `daysLimit - 1`, compare date strings with date strings, and build labels from the key. · Effort S · Risk: none.

**B8 · Medium · The logger can file today's work under an old date**
- Where: `DailyLogger.tsx:57` sets `useState(today)` once, `:90` restores `if (draft.date) setDate(draft.date)`, and the date is never reset after you submit.
- Impact: a draft started yesterday, or the Feed tab left open overnight, saves logs with yesterday's date.
- Fix: restore the draft's date only if it is today, and reset the date to today after each submit. · Effort S · Risk: none.

**B9 · Medium · EOD AI results can silently drop projects**
- Where: `server.ts:346` `synthesizedList.map(...)` builds results only from what the model returned, and `:372-373` sets `isAIGenerated: true` even when `generateFallback()` was used.
- Impact: if Gemini returns fewer groups than it was given, that project's work is missing from the timesheet with no warning. Template text can be labelled "Synthesized via <model>".
- Fix: loop over every group, use the AI text by `splitId` where it exists and the template otherwise, and set the flag correctly. · Effort S–M · Risk: server only.

**B10 · Medium · "Test connection" reports success for any page that returns HTTP 200**
- Where: `server.ts:438` `return res.json({ success: response.ok, raw: text })` is accepted by `sheetsSync.ts:26` `data.status === 'ok' || data.success`.
- Impact: a Google sign-in page (script not set to "Anyone") or a wrong URL counts as "verified", and every sync after that fails silently (U2).
- Fix: require `status === 'ok'`, and make the proxy return failure for non-JSON responses. · Effort S · Risk: none.

**B11 · Low · Gemini key from `.env` is ignored, and the example key is treated as real**
- Where: `run.bat:62-68` writes `GEMINI_API_KEY=` to `.env.local`, which wins over `.env` (`server.ts:10`; reproduced with dotenv 17.4.2: the value comes back as `""`). `.env.example:4` contains `"MY_GEMINI_API_KEY"`.
- Impact: a key put in `.env` is silently ignored. A copied example file sends a fake key, and the error then shows up as "high demand".
- Fix: have run.bat write `# GEMINI_API_KEY=` (commented out), and change the example to an empty `GEMINI_API_KEY=`. · Effort S · Risk: none.

**B12 · Low · Durations are made up or inflated**
- Where: `App.tsx:363-365` logs 30 min when no time was tracked and rounds anything under 5 min up to 5. `server.ts:190` falls back to `Math.max(…, tasks.length * 20, 15)`. Minimalist always uses 30 (`MinimalistZenLayout.tsx:57`). EOD uses three different formulas (`server.ts:190`, `:358`, `EodSynthesizerModal.tsx:233`).
- Impact: timesheet hours depend on which path created the log and whether the AI call succeeded.
- Fix: one shared duration helper, and log 0 (or ask) instead of guessing. · Effort S · Risk: none.

**B13 · Low · Archived and deleted projects get mixed up**
- Where: `DailyLogger.tsx:59` defaults to `projects[0]` even if it's archived (the dropdown hides archived projects, `:247`). The theme dropdowns list archived projects. `App.tsx:362`, `:372` fall back to `projects[0]`'s name for a deleted project.
- Impact: logs saved under the wrong or a hidden project, so project stats are wrong.
- Fix: default to the first non-archived project, filter archived projects everywhere, and name a missing project "General". · Effort S · Risk: none.

**B14 · Low · The server drops "planned" tasks that have tracked time; the client keeps them**
- Where: `server.ts:115` `if (stage === 'planned' && !t.completed)` vs `EodSynthesizerModal.tsx:112`, `:120`.
- Impact: time on a task that was moved back to Planned vanishes from the EOD timesheet.
- Fix: use the client's rule on the server too. · Effort S · Risk: none.

**B15 · Low · Matrix `log` command misreads input**
- Where: `MatrixTuiLayout.tsx:137-145` `cmd.match(/-m\s+([^\s]+)/)`; the prefix check is case-sensitive; `cmd.includes('-s blocked')`.
- Impact: `log -m fixed the bug` saves just "fixed". Without `-m`, it saves the raw command text. Typing "-s blocked" inside the message changes the status.
- Fix: a small tokenizer for the command. · Effort S · Risk: none.

**B16 · Low · CSV export breaks on quotes**
- Where: `SettingsView.tsx:194` `"${l.projectName}"` and the link field are not escaped.
- Impact: a `"` in a project name or URL shifts the columns in Excel.
- Fix: escape every field the same way the description already is. · Effort S · Risk: none.

**B17 · Low · run.bat doesn't check enough**
- Where: `run.bat:35` `if !NODE_MAJOR! LSS 20` (Vite 8 needs 20.19 or newer); `:44-49` compares only `package.json`.
- Impact: Node 20.0–20.18 fails with an unclear error. If only `package-lock.json` changes (e.g. after a pull), dependencies aren't reinstalled.
- Fix: check the minor version too, and compare the lockfile as well. · Effort S · Risk: none.

### Security (rated for local, single-user use)

**S1 · Medium · Server accepts connections from your whole network, with no authentication**
- Where: `server.ts:472` `httpServer.listen(PORT, '0.0.0.0'`; the key fallback `:31` is `customApiKey?.trim() || process.env.GEMINI_API_KEY`; `/api/health` (`:451`) shows whether a key is set.
- Impact: on shared or public Wi-Fi, anyone on the network can use your `.env` Gemini quota. Low risk at home.
- Fix: bind to `127.0.0.1` by default and add an environment-variable opt-in for LAN access. · Effort S · Risk: none.

**S2 · Medium · `/api/sheets/proxy` will fetch any URL and return the response**
- Where: `server.ts:399` `new URL(scriptUrl)`; the body is returned as `raw` (`:438`).
- Impact: with S1, someone on your network can read pages that only your PC can reach (router admin, local-only services).
- Fix: allow only `https://script.google.com/macros/s/…` (the redirect to googleusercontent is followed by fetch). · Effort S · Risk: none.

**S3 · Low · API routes skip Vite's host checks (DNS rebinding)**
- Where: every `/api/*` route is registered before `app.use(vite.middlewares)` (`server.ts:464`).
- Impact: a malicious website could reach S1/S2 through DNS rebinding. Direct cross-site calls are blocked (they need a JSON preflight, and no CORS headers are sent).
- Fix: add a Host/Origin allow-list check in front of `/api`. · Effort S · Risk: none.

**S4 · Low · Secrets are stored in plain text, including in backups**
- Where: `SettingsView.tsx:175` exports `settings`, which contains `geminiApiKey`. The Apps Script must be shared with "Anyone" and has a `getLogs` action (`googleAppsScriptTemplate.ts:32`).
- Impact: anyone with your backup file gets the API key, and anyone with the Script URL can read and append to your sheet. The key sitting in localStorage is acceptable for local use.
- Fix: leave the key (and optionally the URL) out of exports, and remove the unused `getLogs` action. · Effort S · Risk: the script needs redeploying.

**S5 · Low (informational) · esbuild advisory**
- Where: `package.json:31` `"esbuild": "^0.27.0"` resolves to 0.27.7, which is in the affected range.
- Impact: none in practice. The advisory affects esbuild's own `serve()`, which nothing here uses: Vite 8 middleware mode doesn't, and tsx uses its own esbuild 0.28.2.
- Fix: bump to `^0.28.2`. · Effort S · Risk: none.

### Performance

**P1 · Low · Every second, the whole app re-renders and the full backlog is saved**
- Where: `App.tsx:173-188` calls `setBacklog` and `saveBacklog(updated)` while any task runs; nothing is memoized. `MatrixTuiLayout.tsx:42-45` runs its own 1 s clock even when no task is running.
- Impact: fine today. Completed tasks are never pruned, so the per-second save grows with your history.
- Fix: save on stage changes and every ~30 s, plus on `visibilitychange`; move the clocks into small child components. Do this alongside B1. · Effort S–M · Risk: low.

**P2 · Low · AI calls have no proper timeout**
- Where: `server.ts:49`: the standup call has no timeout. EOD's `Promise.race` timeout (`:300`) doesn't cancel the underlying request, and its timer is never cleared.
- Impact: the standup spinner can hang indefinitely; EOD can take up to 4 × 18 s = 72 s before it falls back.
- Fix: cancel calls with an AbortController (or the SDK's timeout option) and clear the timer. · Effort S · Risk: none.

### Code health

**C1 · Low · Model names are hard-coded in 5 places, and the standup has no fallback model**
- Where: `server.ts:50` `'gemini-3.8-flash'`; `:237` `MODEL_CASCADE`; UI labels at `AiStandupModal.tsx:235` and `EodSynthesizerModal.tsx:164`, `:173`.
- Fix: one shared model list used by both endpoints, with `modelUsed` returned for the UI to display. · Effort S · Risk: none.

**C2 · Low · Dead code**
- Never used: `SettingsModal.tsx`, `ThemeSelector.tsx` (imported nowhere); the `motion` and `autoprefixer` packages; empty `bun.lock`; `metadata.json`, `.aistudio/`, `DISABLE_HMR` in vite.config.
- Never runs: `TimelineFeed.tsx:342-566` (its compact and matrix branches; App only renders TimelineFeed for modern, `App.tsx:660`).
- Saved but never read: `defaultRecipientName` (`SettingsView.tsx:96`).
- Fix: delete in one cleanup commit. · Effort S · Risk: none.

**C3 · Low · The data model has two answers to "is this done?"**
- Where: `types.ts:33-34` has both `completed: boolean` and `stage?: TaskStage`; logs store `projectName` copied from the project, so it goes stale if the project changes.
- Impact: today's handlers keep the two in sync, but imported or hand-edited data can disagree (timer uses `stage`, counts use both).
- Fix: derive `completed` from `stage` during the schema-version migration (D4). · Effort M · Risk: stored data.

**C4 · Low · Unchecked data at the boundaries**
- Where: `EodSynthesizerModal.tsx:153` `(item: any)`, then `item.underlyingTasks.filter` (`:263`) throws if the field is missing. `storage.ts` trusts whatever `JSON.parse` returns. There are 7 `any` in `src` and 16 in `server.ts`.
- Fix: small runtime checks on stored data and AI JSON, and add `"strict": true` explicitly to tsconfig (TS 7 enables it by default today). · Effort S · Risk: none.

**C5 · Low · Some package scripts are misleading**
- Where: `package.json:8-11`: `start` runs dev mode unless NODE_ENV is set; `preview` serves `dist` with no API (every `/api` call 404s); `clean` uses `rm -rf` (fails in cmd); `tsx` is a devDependency but `start` needs it.
- Fix: make `start` set production mode, remove `preview`, make `clean` use Node, and move `tsx` to dependencies. · Effort S · Risk: none.

### UX

**U1 · Medium · AI failures are hidden behind templates**
- Where: `aiGenerator.ts:74-82` (`if (res.ok)` has no else; the server's `error` and `needsKey` are dropped), and the only sign is a small template label (`AiStandupModal.tsx:235`). EOD always says "high demand" (`server.ts:334`) and never shows `apiError`.
- Impact: a bad key or a retired model looks like a temporary outage, and you may send template text thinking it's AI output.
- Fix: return the error reason and show "AI failed: <reason> — showing template". · Effort S · Risk: none.

**U2 · Medium · Google Sheets sync failures are silent**
- Where: `App.tsx:230-234` (and `:403-407`) toast only on success. `EodSynthesizerModal.tsx:130` says "already logged to Google Sheet" even when the push failed or no sheet is linked.
- Impact: logs never reach the sheet and you aren't told. The only recovery today is a full sync, which causes the B2 duplicates.
- Fix: show an error toast on failure, keep a per-log sync status, and offer "Retry unsynced" (shares the `syncedAt` field with B2). · Effort S–M · Risk: stored-data field.

**U3 · Medium · Demo data on first launch, and no way to start empty**
- Where: `storage.ts:29`, `:32` fall back to the demo data; the only reset (`App.tsx:504`) reloads the demo data.
- Impact: 6 fake logs, 5 fake tasks (one with its timer running) and 4 fake projects mix into your standups, EOD and Sheet.
- Fix: a "Start fresh" action (empty data plus one "General" project), and/or a first-run choice. · Effort S · Risk: writes stored data (behind a confirm).

**U4 · Medium · The AI Standup modal shows a stale report**
- Where: `AiStandupModal.tsx:50-54` generates only `if (... !generatedReport)`, which is never reset; `:62` falls back to `logs.slice(0, 5)`.
- Impact: reopening the modal shows the earlier report, which you might copy and send. With no logs today, Regenerate reports 5 older logs as today's work.
- Fix: reset the report when the modal closes, and show an empty state instead of using old logs. · Effort S · Risk: none.

**U5 · Low · Logs can't be edited**
- Where: `TimelineFeed.tsx` never calls `onEditLog`, and `App.tsx:682` wires it to a toast only.
- Impact: fixing a typo means deleting the log (with no undo, D3) and logging it again.
- Fix: inline edit, or prefill DailyLogger in an edit mode. · Effort M · Risk: none.

**U6 · Low · The four themes don't behave the same**
- Where: quick-logs force tags (`CompactConsoleLayout.tsx:63` `#deep-work`, `MatrixTuiLayout.tsx:161` `#terminal`). Minimalist has no duration input. Compact and Matrix never show screenshots or links (Compact ignores its `onOpenImage` prop; Matrix isn't given it). The reminder's "Log Work" button does nothing outside modern Feed (`App.tsx:593`; `loggerRef` exists only at `:665`). The three alternate themes have no feed filters.
- Fix: stop forcing tags, add an attachment indicator, switch to the Feed tab and focus the input on "Log Work". · Effort S–M · Risk: themes only.

**U7 · Low · Small misleading feedback**
- Where:
  - The reopen toast says "Active Focus" even when the task goes to Planned (`App.tsx:355`).
  - "Copied!" appears without waiting for the clipboard write to succeed (`AnalyticsView.tsx:141`).
  - Compact shows hotkey tooltips for keys that do nothing (`CompactConsoleLayout.tsx:252`, `:259`).
  - Project names are cut off without an ellipsis (smoke test).
- Fix: correct the text, `await` the clipboard write, and remove the fake hints. · Effort S · Risk: none.

## 3. Improvement suggestions

These are features rather than defects, based on what the app already does. ★ marks a quick win (S).

- **★ Running timer in the tab title**, e.g. `▶ 00:42 · Redis failover`. You can see it from any window, and it pairs with the B1 fix (`document.title` is never set today).
- **★ Daily target hours**: a progress bar in the top bar ("5.5 / 8 h") built from today's logs and running timers.
- **★ "Away time" prompt**: once B1 records clock time, a timer that ran through sleep asks "You were away 47 min — keep or discard?". It turns the B1 fix into a feature.
- **★ Weekly reminder to export a backup**, plus a "last backup" date in Settings (pairs with D4's import).
- **★ Energy and focus trends**: you already record `energyRating`, but Analytics never uses it (0 references). Average energy by weekday or by project is cheap to add.
- **Weekly timesheet view**: a projects × days grid of hours with CSV export. Reuses the AnalyticsView code once B7 is fixed.
- **Standup in yesterday/today/blockers form**: yesterday's logs, plus today's planned tasks, plus blocked tasks. The Slack format already has those three sections, but it is filled only from today's logs.
- **Recurring tasks or templates** (daily standup, code review hour) that add themselves to the backlog each day.
- **Store data in a local file through the Express server you already run** (a JSON file or SQLite) instead of localStorage, with screenshots saved as image files. This removes the quota problem (D1) for good, survives clearing browser data, and makes backups a simple file copy. Effort L; it is the long-term fix for the whole data-safety group.

## 4. Recommended order

**Phase 1 — Data safety and critical fixes (do these first)**
1. **Set up Vitest** (dev dependency). Write the safety tests before touching storage: `loadStoredData` with one corrupt key and with wrong-typed values (no other key changes, nothing written); `save*` when `setItem` throws.
2. **D2** Per-key safe loading, quarantine of corrupt values, and an Array check. Also add the `workpulse_schema_version` key and a `migrate()` hook, which later field changes (B1, B2, U2) depend on.
3. **D1** Show save failures (`save*` returns a result, error toast) **and** cap/downscale screenshots.
4. **D4** JSON import (validated with D2's loaders), automatic backup before reset; strip the key from exports (**S4**, part 1).
5. **D3** Undo toast for deleting logs, tasks and projects.
6. **S1 + S2** Bind to 127.0.0.1 and allow-list the proxy URL. Small, and touches no stored data.
7. **B11** `.env.local` / `.env.example` key fix (one line each).

**Phase 2 — Timesheet accuracy and duplicates** (needs Phase 1's migration hook)
- **B1** Clock-based timer (data-model-change skill; Vitest with fake timers), then **P1** (save less often) and ★ tab-title timer.
- **B3, B4** Stop double logging and EOD re-pushes (tests for the EOD candidate filter).
- **B2 + U2 + B10** One Sheets change: an `Id` column with upserts, a per-log `syncedAt`, error toasts with "Retry unsynced", and a real connection test. Needs an Apps Script redeploy.
- **B9, U1, P2, C1, B12, B14** EOD/AI correctness: merge per group with fallback, show AI errors, abortable timeouts, one model list, one duration helper. Pull the bucket and merge logic into pure functions so they can be tested.

**Phase 3 — Dates (needs a decision from you first)**
- **B5** Decide "local date everywhere". Then one `localDateStr()` helper, a rollover check when the date changes, and a migration that corrects past dates from `createdAt`. Tests run with `TZ=Asia/Dhaka` around 00:00–06:00.
- **B6, B7, B8** Range and draft-date fixes. These can be done before B5 on their own, but are simpler after it.

**Phase 4 — UX and cleanup**
- **U3** Start fresh · **U4** Fresh standup · **U5** Edit logs · **U6/U7** Theme consistency and wording · **B13, B15, B16, B17**.
- **C2** Remove dead code · **C3** Single source of truth for task stage (with a migration) · **C4** Runtime checks and explicit `strict` · **C5** Script fixes.
- Dependencies: vite 8.3.6, tailwind 4.3.5 and esbuild `^0.28.2` (**S5**) are safe. Remove `motion` (C2). Defer express 5 (needs the route change at `server.ts:467`) and @google/genai 3 (check the API) to separate, tested upgrades.
- Suggestions from section 3, quick wins first. The local-file storage backend is a separate project after Phase 2.
