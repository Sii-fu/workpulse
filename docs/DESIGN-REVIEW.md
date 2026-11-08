# WorkPulse design review (Stage 1: audit and direction)

Branch: `design/overhaul`. Date: 2026-11-08. No source code was changed for this review.

## 0. How this was done, and what it can and cannot tell you

- The app ran locally (`npm run dev`) and was captured with Playwright at 1440x900 and 390x844, in all 7 theme and mode combinations (modern dark and light, minimalist light and dark, compact dark and light, matrix dark). Screens: Timeline, Tasks, Analytics, Settings, AI Standup modal, EOD modal, search palette, first run, and empty states.
- The browser's OS colour scheme was fixed to light for the main set so that `dark:` variant leaks would show. A second run used an OS set to dark.
- Screenshots live **outside the repo**, in the session scratchpad folder `...\scratchpad\shots\` (about 180 files). References below use the file stem, for example `timeline_modern_dark_desktop`. The paths will not resolve for other readers. If you want images in the repo, I can put a handful under `docs/`.
- Contrast numbers for tokens are computed from `src/index.css` (section 2). Contrast numbers for hard-coded colours come from computed colours in the screenshots or from the Tailwind palette values.
- I viewed 4 screenshots myself (modern dark Timeline, matrix Timeline, minimalist light Tasks, and minimalist light Timeline under an OS set to dark). The rest were reviewed by three subagents who looked at the images and ran browser checks. Their findings are reported below as they stated them; findings that rest only on a code reading are marked **(code)**.
- The Impeccable detector found one item: the decorative grid background in Compact (`index.css:206`). Its other rules did not match any file, so a clean detector result says little about quality here.
- Three claims from the earlier code audit were checked in the browser (see 3.7).
- Not checked: Bangla (or other non-Latin) text rendering, real Gemini and Google Sheets success paths (no key or script URL was configured), and Safari or Firefox.

## 1. Design problems

Severity: **High** blocks use or fails accessibility. **Med** hurts speed or clarity daily. **Low** polish.

### 1.1 Cross-cutting

| ID | Problem | Where | Screenshot | Sev |
|---|---|---|---|---|
| D1 | **Every theme shares one modern-style shell.** The top bar (logo tile, "Local Mode" pill, pill-shaped nav, indigo "AI Standup" button) is identical in minimalist, compact and matrix. Only the body below changes, so Minimalist and Compact read as "modern with a different list". | `TopBar.tsx` | `timeline_matrix_dark_desktop`, `tasks_minimalist_light_desktop` | High |
| D2 | **Tasks page mixes two design languages.** A modern card header ("Task Focus Workspace & 5-Stage Lifecycle", project picker with coloured pills) sits above a theme-specific list (Notion-style serif in Minimalist, PID monitor in Matrix). | `BacklogSection.tsx` | `tasks_minimalist_light_desktop`, `tasks_matrix_dark_desktop` | High |
| D3 | **Analytics has no theme treatment.** It is identical in all 7 combinations apart from the accent. The bar chart has no value labels or axis, and Mon to Thu bars are invisible stubs. | `AnalyticsView.tsx` | `analytics_*_desktop` | High |
| D4 | **Hard-coded status colours fail on light themes.** `text-amber-400` is 1.67:1 on white, `emerald-400` 1.92, `rose-400` 2.69, `blue-400` 2.54. The Active timer badge measured 1.53, "Blocker" text 1.92, minimalist "Resume" 1.84, compact `[IN_PROG]` 1.66 and `[B]` chip 1.37. | `BacklogSection.tsx` (210 hue-class lines), `TimelineFeed.tsx`, `CommandSidebar.tsx` | `tasks_modern_light_desktop`, `tasks_minimalist_light_desktop`, `tasks_compact_light_desktop` | High |
| D5 | **Text is too small.** Metadata, tags, hotkey chips and project labels are 10 to 11 px across all themes. | everywhere | `timeline_modern_dark_desktop`, `tasks_compact_dark_desktop` | High |
| D6 | **Three saturated accents compete.** Indigo "Commit Work Log", orange "Synthesize EOD Logs" (an amber gradient with a glow) and green "Completed" all shout at once. The orange button is the only non-green element in Matrix. | `TimelineFeed.tsx:307`, `DailyLogger.tsx` | `timeline_modern_dark_desktop`, `empty_tasks_matrix` | Med |
| D7 | **Generic AI-UI tells.** 15 Sparkles icons on every AI action, an accent-to-cyan gradient on the logo, body radial glows, `glass-panel` with `blur(16px)` as the default surface, glow shadows, colour emoji in modals (📱 💬 📊 ✅ 🚀), a decorative grid background, and Settings copy that advertises "glass cards… electric indigo glows". | `TopBar.tsx:64`, `index.css:48-93,206-213`, modals | `settings_modern_dark_desktop`, `standup_*_result` | Med |
| D8 | **Every log is the same rounded bordered card.** Nothing signals which log matters, and four unlabelled icons sit at the bottom right of each card. | `TimelineFeed.tsx` | `timeline_modern_dark_desktop` | Med |
| D9 | **Inflated titles and dev-speak.** "Settings & Architecture Console", "Task Focus Workspace & 5-Stage Lifecycle", "AI Standup & Communication Hub", "Sticky Context Locked", "OS HUB", "Notion editorial view · Zero card distraction". | various | `settings_*`, `tasks_*` | Med |
| D10 | **Status vocabulary differs by theme.** Completed, Done, `[DONE]`, `[COMPLETED]`, `[IN_PROG]`. | per-theme layouts | `timeline_*` | Med |
| D11 | **Toast is a bright white card in every theme.** It glares on dark themes and covers the Resume, To Queue and Done actions in Minimalist. | `ToastContainer.tsx` | `tasks_modern_dark_desktop_timer`, `tasks_minimalist_light_desktop_timer` | Med |
| D12 | **Empty or dead space.** Modern Tasks leaves a large empty area under the Planned Queue column, and the side panel ends at about y=555. Compact leaves about 500 px below the table. Minimalist has a 100 px dead area in the textarea. | various | `tasks_modern_dark_desktop`, `timeline_compact_dark_desktop`, `timeline_minimalist_light_desktop` | Low |

### 1.2 Modern (Timeline, `DailyLogger` and `TimelineFeed`)

- **High:** the composer is about 450 px of chrome (project, date, time, word counter, status pills, 8 tag pills, URL and screenshot attach, details expander) before "Commit Work Log" at y≈500. The log list starts at y≈730. The core action is buried (`timeline_modern_dark_desktop`).
- **Med:** the Tasks side panel truncates titles ("Complete Redis failover rehearsal an…") and crams "Log" plus two icons into each row. Project labels there are about 10 px.
- **Low:** the `⌘K` hint is almost invisible. The "Local Mode" pill carries no information.
- **Mobile:** the form takes about 450 px before any log, card headers wrap to three lines, and the Tasks panel falls below all logs (`timeline_modern_dark_mobile`).

### 1.3 Minimalist

- **High:** the "Done / Add Tag…" selects look like plain text with a chevron and do not read as controls. The disabled "Add Entry" is a faint grey (`timeline_minimalist_light_desktop`).
- **Med:** copy and delete appear only on hover, so touch users cannot reach them. Placeholder and the mono "⌘ + Enter to log" are about 3:1. The metadata line mixes proportional and mono type with only dots between items.
- **Med:** Tasks timer chip 1.53, "Resume" 1.84, PAUSED header 2.55, Blocked line 3.63, "Done" green 4.17.
- **Low:** the hover state is weak (no row background change). Mobile wraps dates ("2026-11-/08") and project names.
- The "Warm Paper / Charcoal" card in Settings promises a distinct identity, but the accent, type and borders match Modern (`settings_minimalist_light_desktop`).

### 1.4 Compact

- **High (mobile):** the log table and the Tasks table clip at 390 px. Status, minutes and actions are off-screen, and blocker text wraps one word per line (`timeline_compact_dark_mobile`, `tasks_compact_dark_mobile`).
- **High (light):** action chips are washed out and read as disabled (`[P] PAUSE`, `[B] BLOCK`).
- **Med:** project names truncate ("Core Platfor…") although the description column has room. `DUP` and `DEL` sit side by side and are always visible, so mis-clicks are easy. Status codes (`[BLOCK]`, `[IN_PROG]`) are cryptic.
- The font token is `'Plus Jakarta Sans', monospace`, so the "console" theme is not monospaced.

### 1.5 Matrix

- **High:** "AI Standup", "Save All Settings" and "Confirm & Push to Google Sheet" are dark-green text on bright-green fill with the scanline overlay running through the text. "Close", muted descriptions and `Palette:` lines are dim green on black, below readable contrast (`settings_matrix_dark_desktop`, `standup_matrix_*`, `eod_matrix_*`).
- **High:** non-green colours leak in (orange Synthesize button, amber AI banner, indigo, amber and cyan project squares, red BLOCKED badge, emerald WhatsApp button).
- **Med:** `[RM]` (delete) is as easy to hit as `[CLONE]`, but almost invisible by comparison. `[CRT: OLED]` is a badge, not a control. Boxes (`+---[ … ]---+`) wrap on mobile.
- The rest of the theme is consistent and is the strongest identity of the four.

### 1.6 Modals and palette

- **High:** the AI Standup and EOD modals have no focus handling (see 3.2). The search palette is mouse-only.
- **Med:** an empty search query lists every log with no hint. The mobile palette footer says "ESC to dismiss".
- **Med:** the EOD footer says "Offline mode (logs will be recorded to local timeline)" next to a primary button that says "Push to Google Sheet".
- **Med:** the AI fallback banner reads "AI failed: No Gemini API key provided… or set GEMINI_API_KEY" in amber, which is developer wording and alarming for an expected fallback.

## 2. The theme system

### 2.1 Do components use the theme variables?

No. Counts of lines (not occurrences) that bypass tokens, from a code search:

| Pattern | Lines | Files | Worst |
|---|---|---|---|
| Named hue classes (amber, emerald, rose, blue, indigo, cyan) | ~310 | 14 | `BacklogSection` 210, `EodSynthesizerModal` 22, `SettingsView` 15 |
| White, black, hex, rgba | ~182 | 18 | `BacklogSection` 86, `MatrixTuiLayout` 24 |
| Tailwind `dark:` variant | 51 | 8 | `BacklogSection` 26, `MinimalistZenLayout` 11 |

Concrete failures: `EodSynthesizerModal.tsx:284` hard-wires matrix green and a green glow, `:398` uses `border-white/10` (invisible on light) and an indigo focus ring, `:341-358` use `rose-400` and `amber-300` text (unreadable on light), `TopBar.tsx:64` ends the logo gradient in fixed cyan, `index.css:282-283` forces `#00ff66` on inputs.

### 2.2 The `dark:` variant follows the OS, not the app (confirmed in the browser)

Tailwind v4 has no `@custom-variant dark` in this project, so `dark:` uses `prefers-color-scheme`. With the OS set to dark and the app in Minimalist light, 7 borders on the Timeline and 5 on Tasks take the dark-mode value `rgb(51,51,51)` on a light page. With the OS set to light the same page has none. In Modern Tasks the measured borders were unaffected, so the visible damage is concentrated in Minimalist (which uses `dark:` with hex). A colleague whose OS is dark but who picks a light theme will see mismatched pieces.

### 2.3 Contrast (computed from `index.css` tokens, text on `--bg-surface` composited over `--bg-app`)

| Theme / mode | main | muted | subtle | accent as text | button text on accent | border vs surface |
|---|---|---|---|---|---|---|
| modern dark | 17.6 | 7.2 | **3.9** | **4.1** | 4.5 | **1.23** |
| modern light | 17.7 | 4.7 | **2.5** | 6.2 | 6.3 | **1.20** |
| minimalist light | 12.3 | 4.5 | **2.8** | **3.9** | **3.9** | **1.30** |
| minimalist dark | 13.9 | 6.1 | **3.4** | **4.3** | **3.7** | **1.26** |
| compact dark | 15.8 | 6.7 | **3.6** | **3.3** | 5.2 | **1.39** |
| compact light | 17.9 | 7.6 | **2.6** | 6.7 | 6.7 | **1.48** |
| matrix | 14.4 | 4.6 | **2.3** | 14.4 | 15.0 | **1.63** |

Bold means below 4.5:1 for text (below 3:1 for borders, where WCAG asks 3:1 for the boundary of a control). Findings:
- `--text-subtle` fails in **every** theme and mode, yet it is used for placeholders and metadata.
- Borders are 1.2 to 1.6:1 everywhere, so input and button outlines are close to invisible. Hairline dividers can stay low, but control borders need 3:1.
- Matrix accent fills with `#030704` text pass on paper, but the scanline overlay (`index.css:255-265`, opacity 0.65, z-index 9999) degrades small text in practice. The measured screenshots showed fuzzy 10 to 11 px text.
- Hard-coded status shades (D4) are not in this table; they are worse than the tokens.
- AA is therefore not met in any theme today.

### 2.4 Flash of the wrong theme on load (confirmed)

`index.html` has no pre-paint script. Theme attributes are set in a `useEffect` (`App.tsx:211-218`) from state that defaults to modern dark. With a saved matrix theme: at DOMContentLoaded `data-theme` is null, first paint at 220 ms shows **modern dark**, matrix applies at about 267 ms (about 3 frames). With 6x CPU throttle, first paint is at 616 ms and matrix arrives at about 1010 ms, so the wrong theme shows for about 400 ms. A saved light mode flashes dark first.

### 2.5 Switching, persistence, mid-session

- Switching is from Settings only, and **it is two steps**: a theme card only stages the choice, and nothing changes until "Save All Settings" is clicked (`SettingsView.tsx:363-370`). The light and dark toggle in the top bar, by contrast, applies at once. Once saved, the theme persists (`workpulse_settings`, `App.tsx:313-327`). *(Correction, found while writing the smoke test: an earlier version of this section said the switch applied immediately.)*
- The theme cards are plain `div`s with an `onClick`: no role, no tab stop, no keyboard activation. A keyboard user cannot change theme at all.
- I saw no breakage when switching, but the Tasks page, Analytics and the modals do not re-theme coherently (D2, D3, section 2.1).
- Matrix forces dark and ignores colour-mode changes. Switching away keeps `dark`, so leaving Matrix never restores a previous light choice.
- There is no theme control in the top bar, so comparing themes needs a trip to Settings each time.

### 2.6 Feature parity (code audit, **(code)**)

| Feature | Modern | Minimalist | Compact | Matrix |
|---|---|---|---|---|
| Log work | full | partial (no image) | partial (no tags, image, link) | partial (CLI flags) |
| **Edit log** | yes | **no** | **no** | **no** |
| Duplicate log | yes | **no** | yes | yes |
| Log search, filter, multi-select | yes | **no** | **no** | **no** |
| Tags | yes | one tag | **no** | **no** |
| Log-with-details from a task (sidebar) | yes | **no** | **no** | **no** |
| Task timers, stage moves, add task | yes | yes | yes | yes |
| AI Standup | header | header | header | header and `standup` command |
| EOD synthesis | Timeline and Tasks | Tasks only | Tasks only | Tasks only |
| Sheets sync (header) | xl+ only | xl+ only | xl+ only | xl+ only |
| Delete with undo | yes | yes (hover only) | yes | yes |
| Dark and light | yes | yes | yes | dark only by design |

The three non-modern layouts never receive `onEditLog`, so an incorrect log cannot be fixed in them. Search results only show a toast and never navigate to the log. Sheets sync is invisible below 1280 px.

### 2.7 Does each theme have a distinct identity?

| Theme | Verdict |
|---|---|
| Matrix | Distinct and intentional (terminal, mono, one hue), but execution fails (contrast, leaked colours, scanlines). |
| Compact | Partly. Dense table and square corners, but identical chrome, a non-mono "console" font, and a decorative grid. |
| Minimalist | Weak. Same chrome, same sans, same blue accent as Modern. Only the Timeline list differs. |
| Modern | Present, but built from the stock kit: glass, glow, indigo, Sparkles, identical rounded cards. |

Three of four themes are the same app recoloured, apart from the Timeline body.

## 3. UX problems

### 3.1 Core flow
- **Log work (Modern):** the textarea sits under 130 px of project and date controls, and the Commit button is far below. Ctrl+Enter exists but is only hinted in small grey text. In the other themes it is faster but loses tags, images and edit.
- **Timers:** the Start button is about the 16th Tab stop. Starting a second task starts a second concurrent timer ("2 ACTIVE") under copy that says "Currently Working (Active Focus)". Whether parallel timers are intended is a product question (section 6).
- **Moving tasks:** every stage change is a real button, so it is keyboard-reachable (verified: Enter on Pause moved in_progress to paused, Space on Start Work moved planned to in_progress). There is no drag and drop.
- **Jargon:** "[P] PAUSE" and "[S] START" labels advertise keyboard shortcuts that do not exist (`BacklogSection.tsx:1390` and others).

### 3.2 Keyboard and focus
- Escape closes the search palette and lightbox, but **not** the AI Standup or EOD modals.
- No modal has `role="dialog"`, `aria-modal` or a focus trap. Opening the Standup modal leaves focus on the trigger; 15 Tabs walk through the page behind it and never touch a modal control. Focus is not restored on close.
- The search palette: ArrowDown and Enter do nothing. Rows are click-only `div`s and the footer says "Navigate with click".
- Focus rings: none on the quick-log textarea or the palette input; the browser default shows on nav and top-bar buttons. About 31 inputs and selects remove the outline with no replacement. `focus-visible` is not used anywhere.

### 3.3 Accessibility
- No `aria-live` anywhere: toasts, AI errors, sync results and timers are silent to screen readers.
- Icon-only buttons rely on `title`, if anything. The tag delete `✕` in Settings has neither.
- Labels are not associated with inputs (no `htmlFor`).
- No `prefers-reduced-motion` handling. Idle pages run zero animations, but spinners and transitions run when active.
- Icon buttons are about 24 to 28 px. Only the mobile bottom nav meets 44 px.

### 3.4 Loading, error and empty states
- **AI Standup:** a spinner, then template text with an amber "AI failed: …" banner in developer wording. No retry. This is the expected path for anyone without a key.
- **EOD:** a hard-error panel with only Close, no Retry. Offline shows the raw `Failed to fetch`.
- **Sheets sync:** a toast on failure ("Saved locally; click Sync to retry"). With no script URL set, Sync is a silent no-op. The button is hidden below 1280 px. No `navigator.onLine` handling.
- **Empty Timeline:** shows "No logs match your filter criteria. Try adjusting your date range" even when there are no logs at all, with no call to action. "Synthesize EOD Logs" stays visible. The side panel says "All tasks completed for today!" with zero tasks, which is wrong. Empty Tasks copy is terse monospace that clashes with the sentence-case copy elsewhere.

### 3.5 Feedback and destructive actions
- Undo toasts exist for deleting a log, a task or a project. They last **6.05 s** with an action (3.5 s without); Undo was present at 2, 4 and 5.9 s. Six seconds is short for people who look away, and it is not announced.
- Native `window.confirm` guards reset, start fresh, import and fix dates, each preceded by an automatic backup download.
- **Tag deletion** exists only in Settings, via an unlabelled `✕`, with no confirmation, toast or undo.
- In Matrix and Compact, delete (`[RM]`, `DEL`) sits next to clone.

### 3.6 Mobile
- Timeline is very long and the Tasks panel is at the bottom, so the main workflow is buried. The mobile nav labels it "Stats" while the desktop label is "Analytics".
- Compact tables clip (1.4). Minimalist's actions are hover-only. Tab labels overflow in Modern Tasks ("Paused/Bloc…"). Matrix task titles truncate to "[1] Revi…".
- Sheets sync cannot be reached from the header.
- No horizontal page overflow and no console errors were found on any of the 28 mobile and desktop Timeline, Tasks and Analytics captures.

### 3.7 Claims from the code audit, checked
- "Keyboard-accessible stage moves": **true** (3.1).
- "Tag deletion exists": **true, but only in Settings, unlabelled** (3.5).
- "Toast duration": **6.05 s with action, 3.5 s without** (3.5).

### 3.8 First run for a new colleague
A fresh browser shows 6 demo logs, 5 demo tasks, 4 demo projects ("Core Platform & API" and others), a "1 task rolled over" banner and an "EOD Log" badge, with nothing to say it is sample data (`firstrun_desktop`). The only exit is Settings, Danger zone, "Start with empty data". Real logs mixed with demo logs would also sync to the shared Sheet.

Proposal:
1. Seed only when the storage key is **absent**, not when it is empty, so clearing data stays cleared.
2. Recognise demo items by their fixed ids (`proj-1..4`, `log-1..6`, `task-1..5`, `subtask-*`), so no new field and no data-model change is needed. (To confirm in Stage 2: that user-created items never reuse these ids.)
3. A first-run banner: "This is sample data so you can look around. Clear it and start your own." with two actions, "Clear sample data" and "Keep exploring". Show "Sample" markers on those rows.
4. Exclude demo logs from Sheets sync.
5. A short setup step after clearing: first project name, then optional Gemini key and Sheet URL.

### 3.9 Motion and performance
- `motion` is installed and never imported. The 7 `animate-in fade-in` classes do nothing (no animation plugin is installed). There is no purposeful motion today except transitions.
- While any timer runs, `App.tsx:261` calls `setBacklog` every second, and nothing is memoised, so the whole tree re-renders each second. It is fine at this data size today, but it is the reason motion must be CSS-only and why the live clock should be isolated.

## 4. Proposed design direction

**Mode:** Operate. People open this several times a day to record work and glance at the clock. Scanability, speed and consistency outrank expression. Personality lives in typography, spacing, one accent and a few precise details.

**Core idea: the daybook.** WorkPulse is a day-ordered ledger with a clock. Time is the organising axis, so: tabular figures everywhere, the day's entries read like ruled lines, and the **one** continuously moving element is the running timer. Everything else is still until acted on. One accent per theme marks "live now" and the primary action, never decoration. Status is carried by a word plus a shape, never by colour alone.

**What goes:** Sparkles on every AI action (AI buttons say what they do: "Draft standup", "Draft end-of-day report"), gradient logo and CTA, body glows, default glass, glow shadows, emoji, the decorative grid, `Local Mode` pill, inflated titles, the orange EOD button.

### 4.1 Shared tokens (apply to all four themes)

- **Type scale** (ratio about 1.2, rem against a 16 px root): 12 / 13 / 14 / 16 / 20 / 28. Minimum text is 12 px (today 10 to 11). Default UI 14 px, dense Compact 13. Line height 1.5 body, 1.25 headings, `font-variant-numeric: tabular-nums` on times and durations. Line length under 75 characters for log text.
- **Spacing:** 4 px base, steps 4 / 8 / 12 / 16 / 24 / 32 / 48. Row padding 8 px (Compact) to 16 px (Minimalist). Tap targets 44 px on touch and 32 px on desktop; hit areas may exceed the visible icon.
- **Colour tokens** (new, per theme and mode, all pairs checked against 4.5:1 text and 3:1 control borders at build time): `--text-subtle` raised to at least 4.5; `--border-hairline` (dividers) and `--border-control` (inputs, buttons, at least 3:1); semantic `--status-{planned,active,paused,blocked,done}-{fg,bg}` replacing every raw amber, emerald and rose; `--accent` and `--on-accent`; `--focus-ring`; `--danger`. `@custom-variant dark` is tied to `data-mode`, and the raw `dark:` hex pairs are deleted.
- **Fonts via `--font-family-theme`**, finally used by `body`. The exact families are proposals to be tried with screenshots in Phase 3 (all from Google Fonts, already the loading mechanism, no new dependency): Modern, Instrument Sans with JetBrains Mono for times; Minimalist, Newsreader headings with a humanist sans body; Compact, IBM Plex Sans with IBM Plex Mono for the grid; Matrix, JetBrains Mono. The current DM Sans and Plus Jakarta Sans are defaults I would retire.
- **Motion:** CSS only, 120 to 200 ms, `ease-out`, on `transform` and `opacity`. Used only to answer an action: a row settling into the list when logged, a status change cross-fade, a short tick when a task completes, a modal rising from its trigger. Never on load, never looping except the running timer's colon. `prefers-reduced-motion` reduces all of it to opacity changes.
- **Component patterns:** one `ModalShell` (dialog role, focus trap, Escape, restore focus), one `IconButton` (required label, 32/44 px), `StatusBadge`, `LogRow` (variants: ledger, table, tty, card), `EmptyState`, themed `Toast` (live region, Undo for 8 s, hover pauses the timer), `Field` (label bound to input), and a keyboard-driven `CommandPalette`.
- **Layout:** the composer collapses to a one-line entry (project, text, Log) that expands on focus for tags, links and details. A visible theme and mode switch lives in the top bar. A single page scaffold means Tasks, Analytics and Settings inherit the theme's voice instead of the Modern header.

### 4.2 A point of view for each theme

| | Modern: "Workbench" | Minimalist: "Daybook" | Compact: "Console" | Matrix: "TTY" |
|---|---|---|---|---|
| Feels like | A calm, dark-first workspace for focused people | A paper notebook with ruled lines | A dense grid you drive from the keyboard | A real terminal |
| Surface | Flat panels, 1 px control borders. Glass only on overlays (palette, modals) | Page and ink. No cards, hairline rules only | Square cells, sticky header | Black, one phosphor hue |
| Type | Instrument Sans, mono times | Serif headings, humanist sans body | Plex Sans 13 px, Plex Mono grid | JetBrains Mono only |
| Accent | A signal teal rather than the default indigo, used only for "live" and the primary button | Ink blue, links and focus only | A single cool blue for selection and focus | Phosphor green plus an in-palette amber for warnings |
| Signature | The running task pinned as a live strip at the top | Entries as ledger lines with times in a left margin | Real shortcuts (j/k, Enter, s, p, e) shown in a footer legend, and a column set | CRT scanlines as an **opt-in** toggle, readable dim tone, box-drawing only on section headers |
| Actions | Visible, labelled icons | Always visible, 44 px on touch | Row actions on focus or hover plus keyboard | Bracketed verbs; delete asks first |

Choices are made for the work: a timer that you glance at deserves one live element; a ledger fits a daily log; keyboard shortcuts belong in the dense theme; and the terminal is a joke worth keeping only if it stays readable.

## 5. Phased plan

Each phase ends with `npm run lint`, `npm test`, `npm run build`, before-and-after screenshots in all 7 combinations at both widths, a short summary, and a stop for your review. One commit per phase.

| Phase | Scope | Main files | Risk |
|---|---|---|---|
| **P0 Theme foundation** | Pre-paint theme script in `index.html` (reads `workpulse_settings`, no key change). `@custom-variant dark` on `data-mode`. New semantic and contrast-checked tokens. Replace raw hues with tokens across all components. Remove glass, glow and gradient defaults from the CSS. | `index.html`, `index.css`, tokens, `BacklogSection`, `EodSynthesizerModal`, `SettingsView`, `TimelineFeed`, `CommandSidebar`, `TopBar` | Medium: touches many lines, but mechanical. Gate: a script that computes contrast for all 7 combinations. |
| **P1 Accessibility and primitives** | `ModalShell` with focus trap, Escape and restore. `IconButton`, labelled controls, visible focus rings, `aria-live` toasts, reduced motion. Keyboard-driven `CommandPalette` with working Enter that navigates. 44 px touch targets. | `AiStandupModal`, `EodSynthesizerModal`, `SearchPaletteModal`, `ToastContainer`, `LightboxModal`, `TopBar`, `MobileNav` | Low to medium |
| **P2 Layout parity and de-duplication** | `useQuickLog` hook, shared `LogRow`, `StatusBadge`, `FeedLayoutProps` so layouts opt out explicitly. Edit, filter, tags, details, duplicate reachable in all four themes. Touch-usable actions. Search navigates to the log. Sheets sync reachable on mobile. Shared `NAV_TABS` and the pending-task filter. | `App.tsx`, `themes/*`, `TimelineFeed`, `TopBar`, `MobileNav`, utils | **High**: behaviour moves between files. Mitigation: unit tests for the pure parts, a parity checklist in the browser. |
| **P3 Per-theme identity** | Fonts, type scale, spacing, accents and component treatment per theme (4.2). Themed top bar. Retire gradients, Sparkles, emoji and the decorative grid. Rewrite inflated titles and AI button labels. Visible theme switch in the top bar. | `index.css`, `TopBar`, `themes/*`, `DailyLogger`, `TimelineFeed`, `AnalyticsView`, `SettingsView` | Medium. Taste risk, so screenshots for review before locking fonts. |
| **P4 Tasks view rebuild** | Split `BacklogSection` (about 2,900 lines) into shared state plus four themed views using `StatusBadge` and shared stage actions. Isolate the live timer so only the clock re-renders each second. Themed Analytics with labelled values. | `BacklogSection` (split), `AnalyticsView`, new timer component | **High**: largest file, most behaviour. Mitigation: keep the handlers, move only JSX, one theme at a time. |
| **P5 States, first run, mobile, polish** | First-run banner and sample-data handling (the proposal in 3.8, no data change). Honest empty, error and offline states, Retry, plain-language AI fallback. Undo 8 s. Mobile pass (composer, tables as cards, sticky running-task bar). Purposeful motion. | `storage.ts` (seed rule), `App.tsx`, modals, layouts | Medium. The seed rule is the one data-adjacent change, and needs your go-ahead. |

Order rationale: foundation first so nothing is redone, accessibility and parity before looks, identity once the structure is shared, the big file last because it is the riskiest and benefits from the shared pieces.

## 6. Decisions I need from you

1. **Product context:** Impeccable found no `PRODUCT.md`. Its redesign flow expects a short interview (who the colleagues are, how they use it, tone, anti-references). Do it at the start of Stage 2, or skip it and rely on this document?
2. **Demo data:** is the proposal in 3.8 acceptable? It changes when seeding happens, and adds no field and no localStorage key. It still needs a one-line check that your real items never reuse the demo ids.
3. **Parallel timers:** should starting a second task pause the first, or keep both running? Today both run under copy that implies one.
4. **Language:** do colleagues write logs in Bangla? If so, font choices must cover it and I need to test rendering. This review did not.
5. **AI actions:** "Standup" and "EOD" overlap in the UI. Keep both as separate actions, or fold them into one "Reports" entry point?
6. **Fonts and the teal accent** in 4.1 and 4.2 are proposals, not decisions. I will show 2 options per theme in P3 before locking.
7. Impeccable v4.8.1 is available (installed 4.5.2). I will not update mid-task unless you ask.
