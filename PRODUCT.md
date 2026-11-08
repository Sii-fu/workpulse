# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
A small group of office colleagues, mostly developers and designers, working in one team. Each person uses their own browser on one device, and nobody shares a profile. Logs and tasks are in English. They open WorkPulse through the working day: they log after each piece of work, and start, pause and stop task timers as they go. Most use it on an office desktop with open internet. A phone is occasional.

Colleagues choose their own theme (Modern, Minimalist, Compact, Matrix). A new person should land on Modern, and the other three are opt-in.

## Product Purpose
Single-user daily work tracker, used by each colleague for themselves. It records what was done and how long it took, runs task timers, and produces an AI-drafted standup and an end-of-day timesheet. Success is that logging takes seconds, the numbers come only from tracked time, and the end-of-day report needs no retyping.

## Positioning
All data stays in the person's own browser (localStorage). There is no account and no backend database. AI (Gemini) and Google Sheets sync are optional add-ons, not requirements. Standups and EOD reports are built from what the person logged, with offline templates when AI is unavailable.

## Operating Context
- The server is a thin Express proxy: AI generation, EOD synthesis, and a CORS-avoiding proxy to the user's own Google Apps Script URL. It binds 127.0.0.1 by default.
- Logs sync to a **shared Google Sheet that a manager or lead reviews**. Each person's rows are upserted by log Id. Sync sends only unsynced logs and never re-sends history.
- Dates are the user's local date (UTC+6). Work at 02:00 counts for that day.
- Durations come only from tracked time (no invented defaults or minimums).
- Standup (a message to send) and EOD (a timesheet to confirm and push to the Sheet) are two separate actions.

## Capabilities and Constraints
- Log work, edit and delete logs with undo, duplicate logs, tag and filter, attach a link or screenshot.
- Task lifecycle: planned, in progress, paused, blocked, done. **Several timers may run at the same time** (confirmed). Duration already written into a log is not logged twice.
- Four themes with light and dark modes where they apply (Matrix is dark only). Every feature should be reachable in every theme.
- Search palette (Ctrl+K), analytics, backup and export, Settings.
- No stored data format or localStorage key changes without asking first. No new dependencies without asking.
- Demo data: the app ships sample projects, logs and tasks. Confirmed approach: seed only when storage is absent, recognise sample items by their fixed ids, show a visible "Sample data" label, offer a one-click "Clear sample data", and never sync sample logs to the Sheet.
- Open: whether Standup and EOD need any change beyond being clearly grouped and easy to find (they stay separate).

## Evidence on Hand
No real user research, analytics or testimonials exist. Observations come from a design audit of the current build (`docs/DESIGN-REVIEW.md`). Nothing about colleagues' habits beyond the answers above should be assumed.

## Product Principles
1. **The log comes first.** Writing a log entry is the fastest thing on the screen, in every theme.
2. **Honest numbers.** Time shown is tracked time. The interface never invents or hides it.
3. **Nothing is lost silently.** Deletes are undoable, failed syncs say so and can be retried, and local data has an obvious backup path.
4. **Every theme is a full app.** A colleague who picks Compact or Matrix loses no feature and no readability.
5. **Works without the extras.** No AI key, no Sheet URL and no network are normal states with a clear message, not errors.

## Accessibility & Inclusion
Target WCAG 2.2 AA in every theme and mode (text 4.5:1, control boundaries 3:1), full keyboard operation, visible focus, labelled icon buttons, and reduced-motion support. Logs are English, but every theme's font stack should include a Bangla-capable fallback so any Bangla text still renders legibly. Colleagues' disabilities or assistive technology use are not known; this has not been asked.
