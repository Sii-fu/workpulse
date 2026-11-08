# WorkPulse Review Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix every finding in `docs/REVIEW.md`, phase by phase, safest data-protection work first.

**Architecture:** Add Vitest and pure, testable helpers (`storage.ts` loaders, `image.ts`, `backup.ts`, `scriptUrl.ts`) before changing handlers in `App.tsx`. Storage functions return results instead of swallowing errors; App turns those into toasts. Each phase is its own branch, one commit per task, merged to `main` only after the user approves.

**Tech Stack:** React 19, TypeScript 7, Vite 8, Express 4, localStorage, Vitest (new dev dependency).

**Spec:** `docs/REVIEW.md` (finding IDs below refer to it).

## Global Constraints

- All user data lives in browser localStorage, keys `workpulse_logs|backlog|projects|tags|settings|active_draft`. Stored shapes must stay loadable (old data without new fields).
- "Today" stays UTC until Phase 3 (CLAUDE.md gotcha). Do not change date logic in other phases.
- `npm run lint` (tsc --noEmit) must pass after every task. The Stop hook runs it.
- Surgical changes: touch only what the task needs; match existing style (functional components, Tailwind, theme CSS variables).
- Never read or print `.env.local` / `.env`.
- Ask the user before: changing stored data shape beyond additive fields, redeploying Apps Script, major dependency upgrades, or any behaviour change that removes a feature.
- Commit messages end with the attribution line from the session's system reminder.

## Review Focus

- Corrupt JSON in one key, others valid: other keys untouched, corrupt value preserved under `workpulse_<key>_corrupt_<ts>`, app loads with empty lists (not demo data).
- Valid JSON of the wrong type (`null`, `{}`, `"x"`) for an array key: no crash, treated as corrupt.
- `setItem` throws `QuotaExceededError`: `save*` returns `{ ok: false }`, no success toast, one error toast (not one per timer tick).
- Imported backup that is malformed, missing keys, or contains an API key: rejected with a clear message / key ignored; existing data untouched on failure.
- Sheets proxy URL like `https://script.google.com.evil.com/macros/s/x`, `http://…`, `https://script.google.com/other`: rejected.

---

## Phase 1: Data safety (branch `fix/phase-1-data-safety`)

### Task 1: Vitest setup + storage safety (D2)

**Files:**
- Modify: `package.json` (devDependency `vitest`, script `"test": "vitest run"`), `CLAUDE.md` (commands table: tests exist now)
- Create: `vitest.config.ts`, `src/test/localStorageStub.ts`, `src/utils/storage.test.ts`
- Modify: `src/utils/storage.ts`

**Interfaces:**
- Produces:
  - `export const CURRENT_SCHEMA_VERSION = 1`
  - `export type SaveResult = { ok: true } | { ok: false; error: string }`
  - `export function isLogArray(v: unknown): v is WorkLog[]` (same for `isBacklogArray`, `isProjectArray`, `isStringArray`, `isSettingsObject`; array checks verify `Array.isArray` and that each item is an object with a string `id`; strings check each item is a string)
  - `loadStoredData()` now also returns `warnings: string[]`
  - every `save*` returns `SaveResult`

- [ ] **Step 1:** `npm i -D vitest` (pick the release whose peer range includes Vite 8; check with `npm view vitest peerDependencies`). `vitest.config.ts`: `environment: 'node'`, `include: ['src/**/*.test.ts']`, `setupFiles: ['src/test/localStorageStub.ts']`. The stub installs an in-memory `globalThis.localStorage` (Map-backed `getItem/setItem/removeItem/clear/key/length`) reset in `beforeEach`.
- [ ] **Step 2: Write failing tests** in `storage.test.ts`:
  - `corrupt tags key does not affect logs/backlog`: set valid logs + backlog, `tags='{bad'`; after load, `logs`/`backlog` equal the stored ones, `tags` is `[]`, `workpulse_tags_corrupt_*` exists holding `'{bad'`, `warnings.length === 1`, and `localStorage.getItem('workpulse_logs')` is unchanged.
  - `null / object in array key`: `logs='null'` and `backlog='{}'` → no throw, empty arrays, two warnings.
  - `no keys at all` (first run) → seed data returned, no warnings.
  - `corrupt key is never replaced by seed data`: after load with `backlog='{bad'`, `backlog` is `[]` (not seed).
  - `save* returns failure when setItem throws`: stub `setItem` to throw → `saveLogs([])` returns `{ ok:false }`.
  - `schema version written on first load` equals `'1'`.
- [ ] **Step 3: Run `npm test`** → FAIL.
- [ ] **Step 4: Implement** in `storage.ts`: a private `readKey<T>(key, guard, absentFallback, corruptFallback, warnings)` that handles absent (use seed), parse error or guard failure (copy raw to `${key}_corrupt_${Date.now()}`, push a warning naming the key, return corruptFallback). Settings: `{ ...DEFAULT_SETTINGS, ...parsed }` only when `isSettingsObject`. Keep the existing backlog normalisation/rollover but run it on the validated array. Remove the outer catch-all fallback to seed. Add `runMigrations(stored: number)` (no-op hook) and write `workpulse_schema_version`. Change every `save*` to return `SaveResult`; `loadActiveDraft` keeps returning null on bad data.
- [ ] **Step 5:** Wire `App.tsx` initial load: if `warnings.length`, `addToast(warnings.join(' '), 'error')`. (Save-result handling comes in Task 2.)
- [ ] **Step 6:** `npm test` PASS; `npm run lint` PASS; update the CLAUDE.md "no test runner" line.
- [ ] **Step 7: Commit** `fix: load stored data per key and quarantine corrupt values (D2)`.

### Task 2: Visible save failures + screenshot downscale (D1)

**Files:** Create `src/utils/image.ts`, `src/utils/image.test.ts`. Modify `src/App.tsx`, `src/components/DailyLogger.tsx`, `src/types.ts` (none expected).

**Interfaces:**
- Produces:
  - `export const MAX_IMAGE_BYTES = 300 * 1024`
  - `export function fitWithin(w: number, h: number, max: number): { width: number; height: number }` (scale down only, keep aspect ratio, integers)
  - `export function dataUrlBytes(dataUrl: string): number` (decoded size of the base64 part)
  - `export async function downscaleImage(file: File, maxDim = 1280, quality = 0.7): Promise<string>` (canvas → JPEG data URL; throws `Error('Image is still too large after resizing')` when over `MAX_IMAGE_BYTES`)
- Consumes: `SaveResult` from Task 1.

- [ ] **Step 1: Failing tests:** `fitWithin(4000,2000,1280)` → `{1280,640}`; `fitWithin(800,600,1280)` unchanged; `dataUrlBytes('data:image/jpeg;base64,AAAA')` → `3`.
- [ ] **Step 2:** Implement helpers; run tests (PASS).
- [ ] **Step 3:** `DailyLogger.handleImageUpload`: replace the `FileReader` with `downscaleImage`; on error show `alert(err.message)` and clear the input.
- [ ] **Step 4:** `App.tsx`: add `persist(result: SaveResult, what: string)` that shows `addToast('Could not save <what> — browser storage is full or blocked. Export a backup now.', 'error')`, at most once per 30 s (ref timestamp). Use it for the results of every `saveLogs/saveBacklog/saveProjects/saveTags/saveSettings` call, including the timer tick. In `handleAddLog` / `handleDuplicateLog`, show the success toast only when the save succeeded.
- [ ] **Step 5:** `npm run lint`; browser check (webapp-testing script): upload a >2 MB generated PNG, confirm stored image is < 300 KB; simulate full storage by filling localStorage and confirm the error toast appears and no success toast.
- [ ] **Step 6: Commit** `fix: surface failed saves and downscale screenshots (D1)`.

### Task 3: Backup import, safe reset, no key in exports (D4 + S4 part 1)

**Files:** Create `src/utils/backup.ts`, `src/utils/backup.test.ts`. Modify `src/components/SettingsView.tsx`, `src/App.tsx`.

**Interfaces:**
- Produces:
  - `export interface BackupData { logs: WorkLog[]; backlog: BacklogTask[]; projects: Project[]; tags: string[]; settings: AppSettings }`
  - `export function buildBackup(d: BackupData): string` (pretty JSON with `exportedAt`, `schemaVersion`, and `settings.geminiApiKey` removed)
  - `export function parseBackup(text: string): { ok: true; data: BackupData } | { ok: false; error: string }` (uses Task 1 guards; settings merged over `DEFAULT_SETTINGS`)
- Consumes: guards from `storage.ts`.

- [ ] **Step 1: Failing tests:** round trip `parseBackup(buildBackup(x))` equals `x` minus api key; `buildBackup` output contains no `geminiApiKey` value; `parseBackup('{bad')`, `parseBackup('{"logs":null}')` and a backup missing `projects` return `ok:false` with an error string.
- [ ] **Step 2:** Implement; tests PASS.
- [ ] **Step 3:** `SettingsView`: export JSON uses `buildBackup`; add an "Import backup" file input → `parseBackup` → `window.confirm` showing counts → new prop `onImportBackup(data)`. Add `handleImportBackup` in `App.tsx`: set state, save all keys, keep the current `geminiApiKey`, toast result.
- [ ] **Step 4:** `handleResetSeedData`: before replacing anything, download `workpulse-pre-reset-<date>.json` via `buildBackup`; update the confirm text to say projects and tags are also replaced and a backup file is downloaded first.
- [ ] **Step 5:** `npm run lint`, `npm test`, browser check (export → reset → import restores).
- [ ] **Step 6: Commit** `feat: JSON import, backup before reset, no API key in exports (D4, S4)`.

### Task 4: Undo toast for deletes (D3)

**Files:** Modify `src/types.ts` (`ToastMessage.action?: { label: string; onClick: () => void }`), `src/components/ToastContainer.tsx`, `src/App.tsx`. Project delete handler location found by grep for `onUpdateProjects`/delete in `SettingsView.tsx` / `CommandSidebar.tsx`.

- [ ] **Step 1:** `addToast(message, type, action?)` with an optional action; action toasts stay ~6 s (other toasts keep their current timing); `ToastContainer` renders the action as a button that runs `onClick` and dismisses.
- [ ] **Step 2:** `handleDeleteLog`, `handleDeleteBacklogTask` and project deletion keep the removed item and its index, and toast `Undo`, which reinserts at the same index and saves again. Keep the existing selection cleanup.
- [ ] **Step 3:** `npm run lint`; browser check: delete a log, click Undo within 6 s and confirm it returns at the same position with its image; let it expire and confirm the delete sticks after reload.
- [ ] **Step 4: Commit** `feat: undo toast for deleting logs, tasks and projects (D3)`.

### Task 5: Localhost binding and proxy allow-list (S1 + S2)

**Files:** Create `src/utils/scriptUrl.ts`, `src/utils/scriptUrl.test.ts`. Modify `server.ts`, `CLAUDE.md` gotcha line.

**Interfaces:** Produces `export function isAllowedScriptUrl(url: string): boolean` — true only for `https:` + hostname exactly `script.google.com` + pathname starting `/macros/s/`.

- [ ] **Step 1: Failing tests:** accepts `https://script.google.com/macros/s/ABC/exec`; rejects `http://script.google.com/macros/s/x`, `https://script.google.com.evil.com/macros/s/x`, `https://script.google.com/other`, `https://127.0.0.1:3000/`, `not a url`.
- [ ] **Step 2:** Implement; tests PASS.
- [ ] **Step 3:** `server.ts`: `const HOST = process.env.HOST || '127.0.0.1'`; listen on `HOST`; log it. In `/api/sheets/proxy`, return 400 `{ error: 'Only Google Apps Script URLs (https://script.google.com/macros/s/…) are allowed' }` when `!isAllowedScriptUrl(scriptUrl)`.
- [ ] **Step 4:** Verify: `npm run dev` listens only on 127.0.0.1 (`netstat`), `curl` proxy with `http://127.0.0.1:3000/api/health` as scriptUrl → 400; `run.bat` health poll still opens the app.
- [ ] **Step 5: Commit** `fix: bind to localhost by default and allow-list the Sheets proxy (S1, S2)`.

### Task 6: `.env` key fix (B11)

**Files:** Modify `run.bat` (CRLF, line ~66), `.env.example`.

- [ ] **Step 1:** `run.bat`: write `# GEMINI_API_KEY=your-key-here` (commented) instead of `GEMINI_API_KEY=`. `.env.example`: `GEMINI_API_KEY=` (empty, no fake value).
- [ ] **Step 2:** Verify in a temp dir copy: dotenv with `.env.local` containing only the comment and `.env` containing a key returns the key. Check that `run.bat` keeps CRLF line endings.
- [ ] **Step 3: Commit** `fix: stop empty GEMINI_API_KEY in .env.local shadowing .env (B11)`.

### Task 7: Phase 1 verification and handoff

- [ ] `npm run lint`, `npm test`, `npm run build`; smoke test all 4 themes × 4 tabs (`.claude/skills/webapp-testing`), 0 console errors.
- [ ] Report to the user; merge `fix/phase-1-data-safety` into `main` only on their go-ahead. Then detail Phase 2.

---

## Phase 2: Timesheet accuracy (outline; detailed after Phase 1 merges)

1. **B1 + P1:** `runningSince` field + migration; elapsed = accumulated + (now − runningSince); tick only redraws; save on stage change / ~30 s / `visibilitychange`; ★ tab-title timer. Fake-timer tests. **Ask first:** new stored field.
2. **B3, B4:** mark converted tasks logged; log only time since last log on re-complete; clear EOD items/selection per run. Tests for the EOD candidate filter.
3. **B2 + U2 + B10:** `Id` column + upsert in Apps Script, `syncedAt` per log, error toasts, "Retry unsynced", strict test-connection. **Ask first:** needs the user to redeploy their Apps Script.
4. **B9, U1, P2, C1, B12, B14:** per-group merge with template fallback, surface AI errors, abortable timeouts, one model list, one duration helper, same planned-task rule on server and client.

## Phase 3: Dates (outline)

**Decision gate:** confirm "local date everywhere" with the user first. Then B5 (`localDateStr()`, rollover on date change, one-off migration of past log dates from `createdAt` — **ask before running on real data**), then B6, B7, B8 with `TZ=Asia/Dhaka` tests.

## Phase 4: UX and cleanup (outline)

U3, U4, U5, U6/U7, B13, B15, B16, B17, S3, S5, then C2 (dead code, one commit), C3, C4, C5, safe dependency bumps (vite, tailwind, esbuild `^0.28.2`; defer express 5 and @google/genai 3). Deleting files or removing packages: **list and confirm with the user first.**

## Self-review

- Coverage: Phase 1 covers D1, D2, D3, D4, S1, S2, S4 (key in export; the `getLogs` removal is Phase 2 with the Apps Script redeploy), B11. S3 (host-check) is deliberately left for Phase 4 as it is low risk once S1 is done. Phases 2–4 cover the rest by ID.
- Types consistent: `SaveResult`, guards (Task 1) are consumed by Tasks 2 and 3 under the same names.
