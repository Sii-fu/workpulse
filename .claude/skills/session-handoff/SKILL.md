---
name: session-handoff
description: Use when the user says they are ending, wrapping up, or pausing the session (e.g. "I'm done for today", "wrap up", "handoff", "end session"). Writes a short .claude/HANDOFF.md so the next session can pick up where this one left off.
---

# Session handoff

Write `.claude/HANDOFF.md`, **replacing** its entire contents. Never append and never keep old
sections: it describes only the current state. Keep it **under 30 lines**.

## Steps
1. Gather facts, don't recall them from memory:
   - `git status --short` and `git diff --stat` (plus `git log --oneline -5` for commits made this session)
   - the current branch (`git branch --show-current`)
   - whether `npm run lint` passes (run it if code changed since it last ran)
2. Write the file with exactly these sections, using bullets and keeping each one short:

```markdown
# Handoff — <YYYY-MM-DD> · branch `<branch>`

## Done
- <what was completed this session, outcome-focused>

## Pending
- <unfinished work, next step first; include any open question for the user>

## Files changed
- `path/to/file` — <one-line why>

## Please test
- <concrete manual checks the user should run, e.g. "Tasks tab: start a timer, reload, confirm elapsed time persists">
- Lint: <passes / fails with N errors>
```

3. Use "None" for an empty section rather than dropping it.
4. Don't paste code, secrets, or `.env*` contents. Don't commit the file unless the user asks.
5. Finish by telling the user, in one or two lines, that the handoff was written and what the top pending item is.
