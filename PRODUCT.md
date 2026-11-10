# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
A single user: a developer who keeps their own office record, often on several projects at once. They use their own browser on **one** office desktop with open internet; a phone is occasional (a page to check the day and jot a task, never a second place to keep the record). Logs and tasks are in English. They open WorkPulse through the working day: they clock in on arrival, plan the day (Plan your day), time tasks, let the app gather what they did from git and Claude Code, and close the day with End my day before clocking out. A lead reads the shared Google Sheet the logs go to.

They chose the look themselves: three themes, switchable in Settings. The Chase is the default; Time Card and Graphite Console are the alternatives.

## Product Purpose
The user's own office record: a clear answer to "what did I do, on which project, on which day". Writing logs by hand falls behind, so the app collects the day's work from git commits and Claude Code prompts and an AI drafts log lines the user approves. Tasks plan the day, run timers, and capture work the app cannot see (meetings, off-computer work); done tasks become logs. An office clock tracks the workday against its target hours, and End my day walks through suggestions, done tasks, the day's log, Sheet sync and clock-out. Standups and timesheets are drafted from the logs. A phone page shows today's tasks and logs and takes tasks typed on the go, and an evening email summarises the day. Success is that the day's record is complete with little typing, the numbers come only from tracked time, and the Sheet holds the durable record.

## Positioning
All data stays in the person's own browser (localStorage). There is no account and no backend database. AI (the user's own Claude Code login, or Gemini), Google Sheets sync, the phone page and the evening email are optional add-ons, not requirements. The phone page and the email run inside the user's own Google script (no server of ours); the page is behind a 4-digit PIN and a private link. Activity is read only from folders the user lists, only when they ask, and only after they have accepted a data notice. Standups and EOD reports are built from what the person logged, with offline templates when AI is unavailable.

## Operating Context
- The server is a thin Express proxy: AI generation, EOD synthesis, activity scanning of local git and Claude Code history, and a CORS-avoiding proxy to the user's own Google Apps Script URL. It binds 127.0.0.1 by default.
- Logs sync to a **shared Google Sheet that a manager or lead reviews**. Each person's rows are upserted by log Id. Sync sends only unsynced logs and never re-sends history.
- The phone page and evening email need the Sheet script at version 3. Updating it means pasting it again and editing the **existing** deployment (New version), so the link stays the same. Setup guide and first-deployment checklist: `docs/phone-and-email-setup.md`.
- Dates are the user's local date (UTC+6). Work at 02:00 counts for that day. Pending tasks keep their own date: nothing rolls them over to today.
- Durations come only from tracked time (no invented defaults or minimums). Activity suggestions carry an estimate, always labelled "estimated" and editable before adding.
- The workday is wall-clock time from clock-in (lunch counts). A forgotten clock-out is shown, never invented.
- Standup (a message to send) and EOD (a timesheet to confirm and push to the Sheet) are two separate actions.

## Capabilities and Constraints
- Four screens: Today (tasks with a quiet "Earlier, still pending" block, activity suggestions, today's log), Tasks (today, one group per earlier date, upcoming, done recently), History (week strip, logs by day, export), Settings. One "next action" button in the top band.
- Log work, edit and delete logs with undo, duplicate logs, tag, search and filter, attach a link. Logs that already have a screenshot still show it.
- Task lifecycle: planned, in progress, paused, blocked, done; "Log it" turns a done task into a log. **Several timers may run at the same time** (confirmed). Duration already written into a log is not logged twice.
- Office clock: clock in (or "I came in at…"), worked and to-go time with the leave time, clock out, resume.
- Plan your day: after the first clock-in of a date (and from a button on Today) pick earlier pending tasks to carry to today, see tasks that arrived from the phone, and type new ones. Skip changes nothing. Tasks otherwise move to today only when the user says so ("Move to today", "Move all to today") or starts them.
- Phone page (PIN, tasks and logs to read, a task to add, today or tomorrow) and an optional evening email (hours worked, logs by project, tasks done and still open, sent only on days with activity). One computer sends the data; a second one is warned about.
- End my day: one guided flow from activity suggestions to clock-out.
- Three themes (The Chase, Time Card, Graphite Console). Each theme decides its own palette and mode; the layout and controls are the same in all three.
- Search palette (Ctrl+K), standup, end-of-day timesheet, backup and export (CSV, Markdown, print).
- No stored data format or localStorage key changes without asking first. No new dependencies without asking.
- Demo data: the app ships sample projects, logs and tasks. Confirmed approach: seed only when storage is absent, recognise sample items by their fixed ids, show a visible "Sample data" label, offer a one-click "Clear sample data", and never sync sample logs to the Sheet.
- Standup opens from Today's log and from History (selected logs); the end-of-day timesheet lives in End my day and in Tasks (selected done tasks). They stay separate.

## Evidence on Hand
No real user research, analytics or testimonials exist. Observations come from the user's own answers and the v2 design spec (`docs/superpowers/specs/2026-11-10-redesign-v2-design.md`). Nothing about the user's habits beyond those should be assumed.

## Product Principles
1. **The record comes first.** Getting the day's work into the log, typed or collected from activity, is the easiest thing on the screen.
2. **Honest numbers.** Time shown is tracked time. The interface never invents or hides it.
3. **Nothing is lost silently.** Deletes are undoable, failed syncs say so and can be retried, and local data has an obvious backup path.
4. **Every theme is a full app.** Themes change type, palette and density only; no feature or readability is lost in any of them.
5. **Works without the extras.** No AI, no Sheet URL, no activity folders and no network are normal states with a clear message, not errors.
6. **Nothing happens behind the user's back.** Activity is read only on request; nothing is clocked out, logged or moved to another day automatically.

## Accessibility & Inclusion
Target WCAG 2.2 AA in all three themes (text 4.5:1, control boundaries 3:1), full keyboard operation, visible focus, labelled icon buttons, 44 px targets on phones, and reduced-motion support. Logs are English, but every theme's font stack includes a Bangla-capable fallback (Noto Sans Bengali) so any Bangla text still renders legibly. The user's assistive technology use is not known; this has not been asked.
