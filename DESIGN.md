---
name: WorkPulse
description: A scoreboard for the office day. One layout, three themes (The Chase, Time Card, Graphite Console), all built around worked / to go / leave time.
colors:
  chase-pitch: "#0f3d2e"
  chase-chalk: "#f4f1e8"
  chase-paper: "#fbfaf5"
  chase-white: "#ffffff"
  chase-subtle: "#efebe1"
  chase-line: "#dcd8cb"
  chase-control-line: "#83806f"
  chase-ink: "#1d2b24"
  chase-ink-muted: "#5d6b63"
  chase-gold: "#f2b705"
  chase-gold-hover: "#dba603"
  chase-on-gold: "#1d1a0a"
  chase-clock-near: "#ffb347"
  chase-clock-due: "#ff8a3d"
  chase-clock-over: "#ff6b5a"
  chase-running-row: "#fff8e1"
  timecard-manila: "#efe6cf"
  timecard-page: "#f7f1e1"
  timecard-card: "#fffdf6"
  timecard-rule: "#c9bc9c"
  timecard-control-line: "#8a7d62"
  timecard-ink: "#1c1a17"
  timecard-ink-muted: "#665d4e"
  timecard-stamp-red: "#c4302b"
  timecard-amber: "#9a5b00"
  timecard-running-row: "#fff7dc"
  console-graphite: "#16181d"
  console-panel: "#1c1f25"
  console-raised: "#22262d"
  console-seam: "#2c3038"
  console-control-line: "#6c737e"
  console-ink: "#e6e8eb"
  console-ink-muted: "#8b929c"
  console-mint: "#7cc4a4"
  console-mint-hover: "#95d3b7"
  console-on-mint: "#0d1a14"
  console-amber: "#e5a84b"
  console-orange: "#f08a4b"
  console-red: "#e2685f"
  console-running-row: "#1e2a25"
typography:
  chase-figure:
    fontFamily: "Archivo, Noto Sans Bengali, system-ui, sans-serif"
    fontSize: "64px"
    fontWeight: 700
    lineHeight: 0.9
    letterSpacing: "-0.01em"
    fontFeature: "font-stretch 72%, tabular-nums"
  body:
    fontFamily: "Archivo, Noto Sans Bengali, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.4
  small:
    fontFamily: "Archivo, Noto Sans Bengali, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 600
  section-head:
    fontFamily: "Archivo, Noto Sans Bengali, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 700
    letterSpacing: "0.08em"
  timecard-figure:
    fontFamily: "Courier Prime, Noto Sans Bengali, ui-monospace, monospace"
    fontSize: "40px"
    fontWeight: 700
    lineHeight: 1
  console-figure:
    fontFamily: "Geist Mono, Noto Sans Bengali, ui-monospace, monospace"
    fontSize: "15px"
    fontWeight: 400
rounded:
  chase-card: "8px"
  chase-button: "6px"
  timecard: "0px"
  console: "6px"
  ribbon: "3px"
spacing:
  row-pad-chase: "14px"
  row-pad-timecard: "13px"
  row-pad-console: "13px"
  inset: "16px"
  header-row: "60px"
components:
  action-primary:
    backgroundColor: "{colors.chase-gold}"
    textColor: "{colors.chase-on-gold}"
    rounded: "{rounded.chase-button}"
    padding: "0 16px"
    height: "40px"
  action-primary-hover:
    backgroundColor: "{colors.chase-gold-hover}"
  band-button:
    backgroundColor: "{colors.chase-pitch}"
    textColor: "{colors.chase-chalk}"
    rounded: "{rounded.chase-button}"
    padding: "0 16px"
    height: "40px"
  row-button:
    backgroundColor: "{colors.chase-white}"
    textColor: "{colors.chase-ink}"
    rounded: "{rounded.chase-button}"
    padding: "0 12px"
    height: "32px"
  row-button-strong:
    backgroundColor: "{colors.chase-ink}"
    textColor: "{colors.chase-paper}"
  panel:
    backgroundColor: "{colors.chase-paper}"
    rounded: "{rounded.chase-card}"
    padding: "0 16px"
  input:
    backgroundColor: "{colors.chase-white}"
    textColor: "{colors.chase-ink}"
    rounded: "{rounded.chase-button}"
---

# Design System: WorkPulse

## Overview

**Creative North Star: "The Scorer's Book"**

The office day is a chase against an 8-hour target. The top band is a scoreboard that is glanced at, not a dashboard that is read: how long worked, how long to go, when to leave. Everything below the band is a plain ruled book of tasks and logs. There is no sidebar of navigation and no grid of stat cards.

One layout serves three themes. A theme changes type, palette, density, radius and one signature move; it never moves components around. The Chase (default) is a pitch-green band with gold and condensed numerals. Time Card is a manila punch-clock card with stamped figures. Graphite Console is a dark panel set split by hairline seams where colour only means state. Whichever theme is active, every figure is tabular, every project carries one ribbon colour on each row, ball and bar, and the band is its own surface with its own ink.

The user is one developer, at a desk most of the day, glancing at the band between tasks. Density is moderate: 13-14px row padding, 15px body, 13px small. Rank comes from case and weight, not size.

**Key Characteristics:**
- A band at the top that holds the day's state; the body is quiet.
- Three type sizes only for text: body 15, small 13, and the figure size (64 / 40 / 15 by theme, 40 / 28 / 15 on phones).
- Project colour is data: a 6px ribbon on every task and log row and the colour of each ball in the overs strip.
- Flat and opaque. Depth comes from 1px lines, tonal steps and the band, not shadows.
- Each theme sets every token itself, status colours included.

## Colors

Tokens are defined per theme in `src/index.css` under `[data-theme="chase"|"timecard"|"console"]`. The frontmatter holds all three sets under `chase-`, `timecard-` and `console-` prefixes. The role map is the same everywhere: app ground, surface, subtle, line, control line, main/muted ink, one accent, band ground/ink/line, four clock phases.

### Primary (the accent that means "live" and "do this")
- **Gold** (chase-gold): the one next-action button in the header, the live ball in the overs strip, calm clock numerals on the band.
- **Time Card Black Stamp** (timecard-ink): accent is the ink itself; strong buttons are filled black, the leave mark is red.
- **Console Mint** (console-mint): accent, focus ring, filled strong buttons, calm clock state.

### Secondary (the clock phases)
Large figures, the current ball, the dot and meter fills take `--clock`, which ClockBand switches by phase: calm, near, due, over as leave time approaches and passes.
- Chase: gold, #ffb347, #ff8a3d, #ff6b5a (chase-gold, chase-clock-near, chase-clock-due, chase-clock-over).
- Time Card: black, amber (timecard-amber), then red (timecard-stamp-red) for due and over.
- Console: mint, console-amber, console-orange, console-red.

### Neutral
- **Pitch Green** (chase-pitch): band ground in Chase, with chalk ink (chase-chalk) at 70% for muted band text.
- **Chalk and Paper** (chase-chalk page, chase-paper cards, chase-white inputs) with chase-line 1px borders and chase-control-line for input and button outlines (3:1).
- **Manila** (timecard-manila band, timecard-page ground, timecard-card surface) with timecard-rule lines and a 2px black band edge.
- **Graphite** (console-graphite ground and band, console-panel surface, console-raised) with console-seam hairlines.
- **Running row** tints: chase-running-row, timecard-running-row, console-running-row mark the task that is ticking.
- Status colours (success, warning, danger, info) are set per theme; light themes use deep tones for text, Console uses light tones. Solid status fills carry white text at 5:1 or better.

### Named Rules
**The Band Ink Rule.** Inside the band, text, hover and focus tokens are remapped to the band's own ink, muted, line and focus colour. Pitch-green accent text would vanish on the Chase band, so controls there focus in gold.
**The Large Figures Rule.** Clock phase colours near, due and over pass 3:1 only. They colour big numerals, balls, dots and meter fills, never small text; small red text uses `--danger`. In Console figures are body size, so they stay ink.
**The One Accent Rule.** Each theme has a single accent. Colour beyond it is a project colour (data) or a status (state), never decoration.

## Typography

**Chase:** Archivo throughout (display, body and figures), figures at 72% width, bold, tabular.
**Time Card:** Libre Franklin for text, Courier Prime for stamped figures at 100% width.
**Console:** Geist for text, Geist Mono for figures.
Every stack ends in Noto Sans Bengali then system-ui, because logs may contain Bengali.

**Character:** Chase reads like a scoreboard: tall, narrow, heavy numbers against a plain grotesque. Time Card is a stamped ledger. Console is a terminal-adjacent instrument.

### Hierarchy
- **Figure** (700, 64px Chase / 40px Time Card / 15px Console, line-height 0.9-1): WORKED and TO GO in the band; 40 / 28 / 15 under 640px. Use the `.num` class everywhere a number appears.
- **Body** (400-600, 15px): task titles, band statements, primary buttons.
- **Small** (600, 13px): row buttons, metas, labels. Minimum text size is 12px; nothing below 13px is used in v2.
- **Section head** (700, 15px Chase; 800, 13px Time Card; 600, 13px Console, uppercase, 0.08 / 0.14 / 0.1em tracking): "Today's tasks", "Suggested from your activity". The meta beside it is 13px, 500, sentence case, in muted ink.
- **Band label** (600-700, 13px, uppercase, 0.12-0.14em, muted band ink): WORKED TODAY, TO GO, IN, OUT AT.

### Named Rules
**The Three Sizes Rule.** Figure, body, small. Rank is made with case, weight and tracking, not with a fourth size.
**The Even Digits Rule.** Every figure is tabular so ticking clocks do not jitter.

## Layout

A sticky header band: row 1 is 60px (brand, nav tabs with counts, search, one primary action at the right). Below it the clock band, in the same colour. On Today the body is a 12-column grid on a 1440px max width, with 28px gaps: Today's tasks takes 7 columns, the activity suggestions card and Today's log take 5. Tasks uses a 960px column. Under lg the grid is one column; under md the band shows only Worked, To go with leave time, Clock out and a thin meter; a bottom nav replaces the header tabs on phones. Touch targets grow to 44px under coarse pointers and on phones; 24px minimum everywhere.

Rows use `--row-pad` (14 / 13 / 13px) with a 1px line between, and a 16px inset from the card edge (Time Card runs rows to the rule's ends). Rhythm: 4px steps, 8-12px inside rows, 28px between sections.

### Band by theme
- **Chase:** four columns: Worked, To go with leave time, the overs strip, Clock out. The overs strip shows on lg; below that a 6px meter.
- **Time Card:** ruled cells divided by 1px rules (In, Worked, To go, Out at) then a punched bar with a red leave tick, ending in Clock out.
- **Console:** a single dense line: "in" chip, worked, a 180px meter, left or over, Clock out.

### Named Rules
**The One Layout Rule.** Themes restyle; they do not restructure. A new screen is built once with `v2-panel`, `v2-row`, `v2-head` and the ribbon, and all three themes dress it.

## Elevation & Depth

Flat and opaque in all three themes. No shadows, glass, glow or gradients. Depth is tonal and linear: the band against the body, 1px lines between rows, paper cards on chalk, raised panels on graphite. Time Card removes the card entirely and uses ruled rows with 2px ink headers. The only gradient is the punched bar's repeating 2px dashes. Motion answers actions: dialogs and toasts rise 8px in 160ms; the current ball pulses (opacity, 1.6s); a log picked from search flashes once. All motion stops under prefers-reduced-motion.

### Named Rules
**The Flat Rule.** Hierarchy comes from lines, tone and the band, never from a shadow.

## Shapes

Chase uses gentle corners (8px cards, 6px buttons and inputs). Time Card is square everywhere (0px) with 1.5-2px ink borders. Console uses 6px with 2px ribbons. Project ribbons are 6px wide bars at the start of a row (3px radius Chase, 0 Time Card, 2px Console). Balls in the overs strip are 14px circles with a 1.5px border, in rows of three, six per over, one over per workday hour, with the hour label under each over.

## Components

### Header and navigation
The band row holds the brand (Time Card uppercase tracked, Console lowercase), tabs with counts, search and the primary action. Tab inactive is muted band ink; active is chalk on a faint white pill (Chase), a 3px red underline (Time Card), or a surface panel with a 1px seam (Console).

### Buttons
- **Primary action:** one per screen in the header. Gold on near-black ink, 6px radius, 40px high (44 on phones), 15px bold (`action-primary`). Time Card and Console fill it with their own accent.
- **Band button:** outlined in band ink at 1.5px (Chase), 2px uppercase tracked (Time Card, with a red outline for Clock out), 1px seam (Console).
- **Row button:** outlined, 13px, 600, 32px high. The running task's button is filled with ink (`v2-btn-strong`); in Console that fill is mint. Time Card buttons are uppercase, tracked, 1.5px black outline, transparent.

### Panels and rows
Panel: paper surface, 1px line, 8px radius (Time Card: no fill, no border). Row: ribbon, title, project and meta, clock, row button, overflow menu. The running row takes the running tint and a live clock (never raw elapsed seconds; clocks read the timer store).

### Inputs
Quick-add and fields: elevated surface, 1px control line, 6px radius, muted placeholder, border shifts to the focus colour (pitch green, black, mint). Global focus ring reads `--accent-text`.

### Overs strip (signature)
The workday as overs of six 10-minute balls, coloured by the project tracked in each. Untracked balls are an outline at 35% band ink; the current ball is gold and pulses. It has an accessible summary ("N of M hours, X of Y slots tracked").

### Punched bar (signature, Time Card)
A 26px bordered bar filled with 2px punches every 9px in the clock colour, with a red tick at the target.

## Do's and Don'ts

### Do:
- **Do** use `.num` for every figure and keep the three text sizes (15, 13, figure).
- **Do** carry a project's ribbon colour on every task and log row, ball and bar.
- **Do** keep one accent per theme and one gold (or ink, or mint) primary action in the header.
- **Do** set any new token in all three theme blocks, status colours included, and check AA (4.5:1 text, 3:1 large figures and control outlines).
- **Do** make dialogs with ModalShell and icon buttons with IconButton.

### Don't:
- **Don't** add a sidebar of navigation or a grid of stat cards; the band is the dashboard.
- **Don't** put clock phase colours (near, due, over) on small text.
- **Don't** use shadows, glass, glow or gradients for depth.
- **Don't** change layout per theme; change only type, palette, density, radius and the signature move.
- **Don't** use `text-[10px]` or any text under 12px.

## Not canonized

None of the observed build is carried as a defect in this record. Pre-existing drift noted: `.v2-running` base tint (#fff8e1) is a hardcoded value rather than a per-theme token, and project colours in seed data are generic palette values (#10b981, #6366f1, #f59e0b, #06b6d4) with no project-colour rule in code.
