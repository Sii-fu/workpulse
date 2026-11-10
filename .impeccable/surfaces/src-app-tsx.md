---
version: 1
slug: "src-app-tsx"
primary_target: "src/App.tsx"
related_targets: []
---

Scope: the whole WorkPulse app shell and its four screens (Today, Tasks, History, Settings), plus End my day. Mode: Operate.
Audience: one developer in an office, several projects at once, desktop through the day, phone occasionally.
Job: start and stop task timers, approve logs drafted from git/Claude activity, see the office day against an 8-hour target, end the day with everything logged and synced.
Constraints: one shared layout; themes change type, palette, density and signature move only. Three themes: chase (default), timecard, console. Spec: docs/superpowers/specs/2026-11-10-redesign-v2-design.md. Approved sketches: .impeccable/mocks/decision/assigned.html (chase), model-pick.html (timecard), challenger-console.html (console).
Memorable moment: the overs strip filling ball by ball in project colours as the day is played, and the band turning as leave time nears.

## Direction contract

THESIS: The office day is a chase against a target. The top band is a scoreboard you glance at, not a dashboard you read; it refuses the category default of a sidebar of nav plus a grid of stat cards.

OWN-WORLD: Pitch green band (#0f3d2e) with chalk (#f4f1e8) text and gold (#f2b705) for the primary action and the live ball; chalk body with paper cards on 1px #dcd8cb lines; Archivo, condensed 72% bold tabular numerals for every figure; one ribbon colour per project carried on every row, ball and bar. Three type sizes only.

STORY: The user sees at once how long they have worked, how long is left and when they can leave, what is running, and what activity is waiting to become logs; they start/pause tasks, approve suggestions, and end the day in one flow.

FIRST VIEWPORT: Row 1 (60px, green): brand, nav tabs with counts, one gold next-action button at right. Row 2 (green chase band): WORKED (gold 64px numerals), TO GO with leave time, the overs strip (one over per hour, six balls each), Clock out. Body on chalk: left 7/12 Today's tasks card with quick-add and the running task highlighted; right 5/12 Suggested from your activity card, then Today's log.

FORM: Scoreboard/scorer's-book innings, position 4 on the grounded list, seed key ffbe3ffc. Alternate themes from the same round: Time Card (pick) and Graphite Console (challenger), both user-requested.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
