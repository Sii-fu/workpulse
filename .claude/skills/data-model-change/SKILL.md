---
name: data-model-change
description: Use whenever a field is added, removed, renamed, or retyped in src/types.ts (WorkLog, BacklogTask, Project, AppSettings, or related types). Walks every place the field must be handled so existing users' localStorage data keeps loading, seed data and Google Sheets sync stay consistent, and all 4 theme layouts display it.
---

# Data model change checklist (WorkPulse)

All user data lives in browser localStorage. Users already have saved data **without** your new field,
so every change must load old data safely. Work through each step; skip only the ones that clearly
don't apply, and say which ones you skipped and why.

## 1. Types — `src/types.ts`
- Update the interface (`WorkLog`, `BacklogTask`, `Project`, `AppSettings`, or the unions `TaskStatus`, `TaskStage`, `ThemeId`, …).
- Prefer an **optional** field (`foo?: T`) for new data; old records won't have it.
- For a rename or retype, note the old shape: you will need it for the migration in step 2.
- `ActiveDraft` (the unsaved logger draft) lives in `src/utils/storage.ts`, not `types.ts`.

## 2. Migration — `src/utils/storage.ts` → `loadStoredData()`
- Keys: `workpulse_logs`, `workpulse_backlog`, `workpulse_projects`, `workpulse_tags`, `workpulse_settings`, `workpulse_active_draft` (`KEYS` object).
- **Backlog** already has a normalisation pass (`backlog.map(...)` that fills `stage`, `elapsedSeconds`, `isRunning`, and does rollover). Add defaults / rename handling there.
- **Logs and projects** are parsed with a bare `JSON.parse` cast and **no** normalisation. If old records need a default, rename or type conversion, add a `.map()` after parsing.
- **Settings** are merged as `{ ...DEFAULT_SETTINGS, ...stored }`, so a new `AppSettings` field gets its default automatically once it's in `DEFAULT_SETTINGS` (step 3). Renames still need explicit handling.
- If you migrate, write the result back (as the backlog branch does with `localStorage.setItem`) so it only runs once.
- Never throw: the `catch` falls back to seed data, which would look like data loss to the user.

## 3. Seed and default data — `src/data/seedData.ts`
- `INITIAL_PROJECTS`, `INITIAL_TAGS`, `DEFAULT_SETTINGS`, and `getInitialSeedData()` (sample logs and backlog tasks with dates relative to today).
- Add realistic values to the sample records if the field should show up in the demo.
- **Also** update the hard-coded initial `settings` in `useState<AppSettings>({...})` at the top of `src/App.tsx`, which duplicates `DEFAULT_SETTINGS`.

## 4. Places that create records — `src/App.tsx` and components
New `WorkLog` objects are built in several places. Set the field (or leave it undefined on purpose) in each:
- `App.tsx`: `handleAddLog`, `handleDuplicateLog`, `handleConvertTaskToLog`, `handleConfirmEodPush`
- `components/DailyLogger.tsx` (main form, plus the `ActiveDraft` it saves)
- `components/themes/MinimalistZenLayout.tsx`, `CompactConsoleLayout.tsx`, `MatrixTuiLayout.tsx` (each has its own quick-log input; Matrix parses `log -m "..." -s <status>`)
- `components/EodSynthesizerModal.tsx` (`SynthesizedLogItem`, mapped into `WorkLog` in `handleConfirmEodPush`)

`BacklogTask` objects: `handleAddBacklogTask`, `handleUpdateTaskStage`, `handleReopenTask`, `handleToggleBacklogTask` in `App.tsx`.

## 5. Google Sheets sync (only `WorkLog`s sync)
- `src/utils/sheetsSync.ts` (`syncSingleLogToSheet`, `syncBatchLogsToSheet`) spreads the whole log, so a new field is **sent** automatically. Only `imageBase64` is rewritten. Exclude or transform large or sensitive fields here.
- `src/utils/googleAppsScriptTemplate.ts` (`GOOGLE_APPS_SCRIPT_CODE`) writes **fixed columns**. To store the field, update all three in the same column order:
  1. `appendRow([...])` in the `appendLog` branch of `doPost`
  2. `rows.push([...])` in the `batchSync` branch
  3. the `headers` array in `getOrCreateLogsSheet()`
  Keep the `Id` column **last** (12th): the script upserts rows by it (`upsertRows`, `ID_COL`), so new columns go before it only if `ID_COL` moves too. `WorkLog.syncedAt` is set by the app after a confirmed sync, and manual Sync sends only logs that need it (`src/utils/syncStatus.ts`).
- Tell the user: an already-deployed Apps Script must be **re-pasted and redeployed**. An existing `WorkPulse_Logs` sheet keeps its old header row, because headers are only written when the sheet is first created, so the header needs adding manually.

## 6. Display (check every theme)
- `components/TimelineFeed.tsx`: three separate render branches (compact table, Matrix CRT log, card view).
- `components/themes/MinimalistZenLayout.tsx`, `CompactConsoleLayout.tsx`, `MatrixTuiLayout.tsx`: each renders its own feed.
- `components/BacklogSection.tsx` (~2,900 lines: **search it**, don't read it whole) for `BacklogTask` fields.
- `components/AnalyticsView.tsx`: stats `useMemo` and `handleExportMarkdown`.
- `components/SearchPaletteModal.tsx`: add the field to the search filter if it's text worth searching.
- `components/CommandSidebar.tsx` for backlog and project fields.

## 7. AI reports (if the field should influence them)
- `src/utils/aiGenerator.ts`: `generateAiReport` (the `logsSummary` line builder) and `generateFallbackTemplate` (offline templates).
- `server.ts`, `app.post('/api/synthesize-eod')`: `promptPayload` (task fields sent to Gemini), the JSON schema inside `systemInstruction`, `generateFallback()`, and the `finalResults` mapping.

## 8. Verify
- `npm run lint` must pass (tsc --noEmit).
- In the browser at http://localhost:3000 (`npm run dev`), **keep your existing localStorage data**: confirm old records still load and render in all 4 themes (Settings → Appearance), and that new records save the field.
- If sync changed, test it against a scratch Google Sheet.
