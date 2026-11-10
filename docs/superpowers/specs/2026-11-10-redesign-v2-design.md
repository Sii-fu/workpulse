# WorkPulse v2 redesign: three themes, office clock, End my day

Date: 2026-11-10 · Branch: `design/v2` (from `feat/activity-suggestions`)

## Intent

WorkPulse is the user's own office record: one person, several projects at once, and a clear answer to
"what did I do, on which project, on which day". Writing logs by hand falls behind, so the app gathers
the day's work from git and Claude Code history, and Claude writes clean log text that the user approves.
Tasks plan the day and capture work the app cannot see (meetings, off-computer work). Done tasks become logs.
The Google Sheet is the durable record.

The current UI was built with another AI and does not feel right to the user. They asked for the old
design to be forgotten and replaced with one that is pleasant to use every day, has the best UX in the
app, and does not look AI-generated. They gave the design decisions to the builder and said features
may be stripped.

**This is project 1 of 3.** Project 2 (phone access with shared data) and project 3 (evening email)
come later and are out of scope here, but nothing in this design should block them.

## Goals

1. **One app layout, three themes.** The user picked three directions and wants all three, switchable in Settings:
   - **The Chase** (default): the office day as an innings. Pitch green top band with scoreboard numerals; light chalk body.
   - **Time Card**: the punch-clock attendance card. Manila card, black stamped figures, red for the leave mark.
   - **Graphite Console**: a dark graphite working surface with hairline seams; colour only means state.
   The approved first-screen sketches are `.impeccable/mocks/decision/{assigned,model-pick,challenger-console}.html`.
   Themes change type, palette, density, and the signature move only. The layout, navigation and controls are the same in all three.
2. **Office clock.** Clock in on arrival and clock out when leaving. The top band always shows time worked, time left until
   the 8-hour mark, and the leave time. The colour changes as the leave time gets close.
3. **End my day.** One guided flow: suggestions from activity → done tasks become logs → review today's log → sync to the Sheet → clock out.
4. **Four clear screens** instead of today's sprawl: Today, Tasks, History, Settings.
5. **Phone layout** that is pleasant at 390 px (bottom nav, compact clock).

## Non-goals

- Shared or cloud data, the phone reading the Sheet (project 2). The email summary (project 3).
- Any change to the Sheet columns or the Apps Script.
- New npm dependencies.

## Anti-goals (a failure even if it works)

- It looks like a template: gradients, glass, glowing accents, rounded cards in rounded cards, icon tiles.
- A theme that only recolours. Each must be recognisable with the content removed.
- Cricket as a costume (bats, balls, stumps clip-art). The Chase uses numerals, overs and colour only.
- Losing existing user data, or any number that is not real tracked time (estimates stay labelled "estimated").

## Information architecture

Top band (every screen): brand, nav tabs, **one next action**, and the office clock band.

| Screen | Holds | Replaces |
|---|---|---|
| **Today** | Today's tasks (quick add, start/pause/done, "Log it"), suggestions from activity, today's log with quick-add, End my day | Timeline (Modern), CommandSidebar, the three theme layouts, RunningStrip |
| **Tasks** | All open tasks across days (overdue, today, upcoming, blocked), recently done; add with project and due date; filter by project | the four `*TasksView`s and `TasksHeader` |
| **History** | Week strip (hours per project per day, previous/next week), logs grouped by day with search and project filter, select logs → Standup / Timesheet / Export (CSV, Markdown, print) | Analytics, the timeline's history and filter bar |
| **Settings** | Theme (three preview tiles), office day (target hours), Google Sheet, AI (Gemini key, activity AI), activity folders and sources, data and backup, sample data | SettingsView (restyled and regrouped) |

**The one next action** (a raise from the airport-sign direction): exactly one primary button in the top bar, chosen by state:
not clocked in → "Clock in"; suggestions waiting → "Review N suggestions"; done tasks not logged → "Log N done tasks";
last hour of the day → "End my day"; otherwise → "Add log". The other actions stay where they are on the screen.

**Nav tabs show counts** (a raise from the manual tab-board direction): Today shows hours logged, Tasks shows open tasks.

Search (Ctrl+K) stays as a palette over all logs and tasks.

## The office clock

- **Data.** New localStorage key `workpulse_workdays`: `Record<YYYY-MM-DD, { clockIn: ISO; clockOut?: ISO }>` (local date).
  New optional setting `AppSettings.workdayHours` (absent = 8). Both go in backups. Follow the `data-model-change` skill.
- **Leave time** = clockIn + workdayHours (wall clock, so lunch counts, which is what the user described).
- **Worked** = now − clockIn (or clockOut − clockIn once out).
- **Colour states**, defined per theme as tokens: `calm` (more than 60 min left), `near` (60 to 15 min), `due` (15 to 0 min),
  `over` (past the leave time, counting up as "+0:12 over"). Reduced motion: no pulsing.
- **Clock out by mistake**: after clock-out the band offers "Resume" for that day (clears `clockOut`).
- **Forgot to clock in**: "Clock in" offers "I came in at…" with a time field (defaults to now).
- **Forgot to clock out**: a past day with no clockOut shows in History as "no clock-out"; never invent one.
- **The overs strip (The Chase's signature move)**: from clockIn to the leave time, each hour is an over of six 10-minute balls.
  A ball is filled with the project's colour when a task timer ran during that slot (the project that ran longest wins),
  gold when it is the slot happening now, and empty otherwise. This needs real timer segments:
  new optional `BacklogTask.segments?: { start: ISO; end?: ISO }[]`, appended when a timer starts and closed when it pauses or finishes.
  Old tasks have none, so their balls stay empty (honest). Time Card shows the same day as a punched bar.
  Console shows it as a thin meter. On phones every theme shows a compact meter.
- **A running timer when clocking out**: the clock-out step warns and offers to pause it.

## End my day

A full-screen dialog (ModalShell) with a step rail. Steps that have nothing to do are shown as done and skipped:

1. **From your activity**: the existing activity pipeline (data notice still required first), tick and add.
2. **Done tasks**: done tasks with unlogged time → the existing EOD synthesis (Claude/Gemini text, template fallback), edit, add.
3. **Today's log**: a review list. Edit or delete any entry and see the day total.
4. **Sync**: send unsynced logs to the Sheet. If no Sheet URL is set, say so and skip.
5. **Clock out**: shows worked time against the target. Pauses running timers (with a warning).

The existing Standup dialog stays, opened from History (selected logs) and from Today's log menu.

## Themes in detail

Tokens per theme in `src/index.css` under `[data-theme=chase|timecard|console]`: ground, surface, ink, muted, line,
accent (primary action), the four clock-state colours, and type families. Project colours come from `Project.color`
(a raise from the character-catalog direction: one fixed ribbon colour per project everywhere: overs, task rows, logs, week chart).

| | The Chase | Time Card | Graphite Console |
|---|---|---|---|
| Type | Archivo (variable width: condensed 72% for numerals, 100% for text) | Libre Franklin + Courier Prime (stamped figures) | Geist + Geist Mono |
| Band | pitch green `#0f3d2e`, chalk text, gold `#f2b705` accent | manila `#efe6cf`, ink, red `#c4302b` leave mark, 2px ink rule | graphite `#16181d`, hairline seams, mint `#7cc4a4` |
| Body | chalk `#f4f1e8`, paper cards with 1px line | light card `#f7f1e1`, ruled rows, no cards | panels split by 1px seams, no shadows |
| Signature | overs strip | IN / WORKED / TO GO / OUT stamped cells and the punched bar | clock as mono readout with a state dot |
| Mode | light body, dark band | light | dark |

All fonts keep the Noto Sans Bengali fallback. **Three type sizes only** per theme (a raise from the timetable direction):
body (15 px), small (13 px, never below 12 px), and display numerals. Rank comes from weight, case and colour.
WCAG 2.2 AA in all three themes. Visible focus, 24 px minimum targets (44 px on phones), reduced motion respected.

**Theme migration**: `ThemeId` becomes `'chase' | 'timecard' | 'console'`. Stored `modern`/`compact` map to `chase`,
`minimalist` to `timecard`, `matrix` to `console`. `colorMode` and `crtEffect` are no longer used (kept in stored data, ignored).
The pre-paint script in `index.html` is updated to match.

## What is removed

- The four per-theme layouts and four task views, `CommandSidebar`, `TimelineFeed`, `RunningStrip`, `ThemeMenu`,
  `AnalyticsView`, Matrix CRT, the light/dark toggle (the theme decides).
- From the log form: the energy rating and screenshot attachment inputs (existing values stay in data and in the Sheet; a log
  that has a screenshot still shows it).
- Kept as they are (restyled): toasts, ModalShell, IconButton, search palette, Standup dialog, EOD synthesis logic,
  activity pipeline and folders settings, backup reminder, sample data banner, offline notice.

## Constraints

- `App.tsx` keeps owning state and handlers. The new screens are presentational, as today. Running clocks read `timerStore`
  (never `elapsedSeconds` in JSX), and the clock band ticks itself so the whole app does not re-render each second.
- Dates stay local (`src/utils/dates.ts`). Durations only come from tracked time.
- Existing unit tests keep passing. New pure helpers (workday maths, overs slots, next-action choice, theme migration) get unit tests.
- `tests/smoke/smoke.py` is rewritten for the new screens and three themes, and keeps the activity data-notice check.
- CLAUDE.md and PRODUCT.md are updated to describe v2.

## Decisions made after the builder check (designer's calls)

1. **No background scanning.** Activity is only read when the user asks (the data notice still comes first). Until the user
   checks activity that day, the next action reads "Check activity" with no number. After a check, the suggestions not
   added yet are kept in memory for the session, and their count drives "Review N suggestions".
2. **Workday date = the local date of clockIn.** An open workday from an earlier date shows in the band as
   "Clocked in since <day> <time>" with Clock out. "Clock in for today" is offered beside it, and nothing is ever closed automatically.
   **Next-action order** (first match wins): not clocked in → Clock in; 60 min or less to the leave time, or past it → End my day;
   suggestions waiting → Review N suggestions; done tasks with unlogged time → Log N done tasks; not checked today and
   activity folders set → Check activity; otherwise → Add log.
3. **The clock and timers are independent.** Starting a timer never clocks the user in, and timers may run after clock-out.
   The overs strip only covers clockIn to max(leave time, now), and segments outside it are not drawn.
4. **Projects and tags** are a Settings section ("Projects"): rename, colour (a fixed swatch set of eight, chosen to work in all
   three themes), and archive. Tags sit there too. The log form keeps: description, project, status, duration, tags,
   link, and the read-only sub-task list.
5. **History's week strip counts logged minutes** (`durationMinutes`) per project per day. Logs are the record. Timer
   segments are only used for the overs strip.
6. **Spec vs sketches:** the spec decides layout and behaviour. The sketches decide visual style (palette, type, density,
   signature). The sketches show desktop only; the phone layout follows the spec.

## Left to the builder

Exact component split and file names under `src/components/`, spacing scale, icon choices (lucide), motion (short, purposeful,
off under reduced motion), copy wording within the plain-sentence rule, and how History's export menu is laid out.
