"""WorkPulse smoke test: core flows, run after every design phase.

Runs real Playwright (Python, headless Chromium) against a running app. It does not
touch the repo or the user's browser profile: every check starts in a fresh, empty
browser context. Screenshots are only written when --shots DIR is given.

From the repo root (starts and stops the dev server for you):

    python .claude/skills/webapp-testing/scripts/with_server.py --server "npm run dev" --port 3000 --timeout 60 -- python tests/smoke/smoke.py

Or against a server that is already running:

    python tests/smoke/smoke.py --url http://localhost:3000

Options:  --only NAME[,NAME]   run only these checks      --list   list checks
          --shots DIR          save a screenshot on failure and after theme switches
          --headed             show the browser

Exit code: 0 when every check passes (or fails only as an expected failure), 1 otherwise.
Expected failures are listed in EXPECTED_FAIL with the phase that fixes them. When one starts
passing it is reported as XPASS: delete it from EXPECTED_FAIL so a regression is caught.
"""
import argparse
import io
import json
import os
import re
import sys
import traceback

from playwright.sync_api import sync_playwright, expect

try:  # Windows consoles default to cp1252 and choke on the app's symbols
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
except Exception:
    pass

# ---------------------------------------------------------------------------
# Selector map. When a phase renames a label, change it here, in one place.
# ---------------------------------------------------------------------------
SEL = {
    "nav": {"feed": "Timeline", "backlog": "Tasks", "analytics": "Analytics", "settings": "Settings"},
    "mobile_nav": {"feed": "Timeline", "backlog": "Tasks", "analytics": "Stats", "settings": "Settings"},
    "log_textarea": "textarea",                       # first visible textarea on the Timeline
    "commit_log": "Commit Work Log",                  # button name
    "edit_log": "Edit log",                           # button title
    "save_edit": "Save changes",
    "mode_toggle": 'button[title^="Switch to"]',   # its aria-label ("Toggle Light/Dark Mode") hides the title from role queries
    "standup_trigger": 'button[title^="Generate AI Standup"]',
    "standup_heading": "AI Standup",
    "eod_trigger": 'button[title*="ynthesize"]',      # Timeline (modern) and Tasks tab
    "eod_heading": "End-of-Day",
    "palette_trigger_key": "Control+k",
    "palette_input": 'input[placeholder^="Search all past work logs"]',
    "settings_section_appearance": re.compile(r"Appearance"),
    "settings_save": "Save All Settings",
    "theme_cards": {
        "modern": "Modern SaaS",
        "minimalist": "Minimalist (Zen",
        "compact": "Compact (Power",
        "matrix": "Matrix CLI",
    },
    "add_task_input": 'input[placeholder^="Add a task for"]',   # buttons are matched by visible text; icon-only ones by title
    "add_task_queue": re.compile(r"^Add to Queue$"),
    "start": re.compile(r"^Start Work$"),             # planned task
    "pause": re.compile(r"^Pause$"),
    "resume": re.compile(r"^Resume$"),
    "to_queue": re.compile(r"^Back to Queue$"),       # in-progress task back to planned
    "block": re.compile(r"^Block$"),
    "block_reason_input": 'input[placeholder^="e.g. Awaiting"]',
    "block_confirm": "Confirm Blocked",
    "unblock": re.compile(r"^Unblock"),
    "complete": re.compile(r"^Mark Done$"),           # in-progress task to done
}

# check name -> phase that is expected to fix it
EXPECTED_FAIL = {
    "modal_escape:standup": "P1 (modal shell: Escape, focus trap)",
    "modal_escape:eod": "P1 (modal shell: Escape, focus trap)",
}

THEMES = ["modern", "minimalist", "compact", "matrix"]
SEED_SETTINGS = {
    "googleScriptUrl": "", "geminiApiKey": "", "defaultTone": "casual",
    "lastDismissedReminderDate": "2999-01-01",  # keep the reminder banner out of the way
}
IGNORED_CONSOLE = (re.compile(r"favicon", re.I),)

CHECKS = []


def check(name):
    def deco(fn):
        CHECKS.append((name, fn))
        return fn
    return deco


# ---------------------------------------------------------------------------
# Plumbing
# ---------------------------------------------------------------------------
class Session:
    """A fresh browser context with console-error capture."""

    def __init__(self, pw, url, theme="modern", mode="dark", width=1440, height=900, headed=False):
        self.url = url
        self.browser = pw.chromium.launch(headless=not headed)
        self.ctx = self.browser.new_context(viewport={"width": width, "height": height}, color_scheme="light")
        settings = dict(SEED_SETTINGS, theme=theme, colorMode=mode)
        self.ctx.add_init_script(
            "try{ if(!localStorage.getItem('workpulse_settings')) "
            "localStorage.setItem('workpulse_settings', %s) }catch(e){}" % json.dumps(json.dumps(settings))
        )
        self.errors = []
        self.page = self.ctx.new_page()
        self.page.on("console", self._on_console)
        self.page.on("pageerror", lambda e: self.errors.append(f"pageerror: {e}"))
        self.page.goto(url)
        self.page.wait_for_load_state("networkidle")
        self.page.wait_for_timeout(300)

    def _on_console(self, msg):
        if msg.type == "error" and not any(p.search(msg.text) for p in IGNORED_CONSOLE):
            self.errors.append(f"console.error: {msg.text}")

    def close(self):
        self.browser.close()

    # -- helpers ----------------------------------------------------------
    def ls(self, key):
        raw = self.page.evaluate("k => localStorage.getItem(k)", key)
        return json.loads(raw) if raw else None

    def tab(self, name):
        labels = SEL["nav"] if self.page.viewport_size["width"] >= 768 else SEL["mobile_nav"]
        loc = self.page.get_by_role("button", name=labels[name], exact=True)
        for i in range(loc.count()):
            if loc.nth(i).is_visible():
                loc.nth(i).click()
                self.page.wait_for_timeout(250)
                return
        raise AssertionError(f"navigation button '{labels[name]}' not found or not visible")

    def set_theme(self, theme):
        self.tab("settings")
        self.page.get_by_role("button", name=SEL["settings_section_appearance"]).first.click()
        self.page.get_by_text(SEL["theme_cards"][theme]).first.click()
        # the card only stages the choice; it is applied by the save button
        btn(self.page, SEL["settings_save"]).first.click()
        self.page.wait_for_timeout(300)

    def html_attrs(self):
        return self.page.evaluate(
            "()=>[document.documentElement.getAttribute('data-theme'),document.documentElement.getAttribute('data-mode')]"
        )

    def no_errors(self):
        assert not self.errors, "browser errors:\n  " + "\n  ".join(self.errors[:5])


def btn(page, name):
    """A button by accessible name (substring, case-insensitive) or by regex.
    Icon-only buttons get their name from the title attribute."""
    return page.get_by_role("button", name=name)


def task_row(page, title):
    """The nearest ancestor of the task title that holds action buttons."""
    return page.locator(f"xpath=(//*[normalize-space(text())='{title}'])[1]/ancestor::*[.//button][1]")


def stage_of(s, title):
    tasks = s.ls("workpulse_backlog") or []
    t = next((t for t in tasks if t.get("title") == title), None)
    assert t is not None, f"task '{title}' not found in workpulse_backlog"
    return t.get("stage") or ("done" if t.get("completed") else "planned")


# ---------------------------------------------------------------------------
# Checks
# ---------------------------------------------------------------------------
@check("app_loads")
def app_loads(s):
    assert s.html_attrs() == ["modern", "dark"], f"unexpected html attrs {s.html_attrs()}"
    assert s.page.locator("body").inner_text().strip(), "blank page"
    s.no_errors()


@check("log_work")
def log_work(s):
    before = btn(s.page, SEL["edit_log"]).count()   # one per log on screen (storage is empty until the first change)
    text = "Smoke: wrote a log entry"
    ta = s.page.locator(SEL["log_textarea"]).first
    ta.fill(text)
    btn(s.page, SEL["commit_log"]).first.click()
    s.page.wait_for_timeout(400)
    logs = s.ls("workpulse_logs")
    assert len(logs) == before + 1, f"expected {before + 1} logs, got {len(logs)}"
    assert any(l["description"] == text for l in logs), "new log not persisted"
    expect(s.page.get_by_text(text).first).to_be_visible()
    assert ta.input_value() == "", "composer was not cleared after logging"
    s.no_errors()


@check("edit_log")
def edit_log(s):
    count = btn(s.page, SEL["edit_log"]).count()
    # whichever log is first on screen is the one edited
    btn(s.page, SEL["edit_log"]).first.click()
    s.page.wait_for_timeout(300)
    ta = s.page.locator(SEL["log_textarea"]).first
    original = ta.input_value()
    assert original, "edit mode did not load the log text"
    edited = original + " (edited by smoke)"
    ta.fill(edited)
    btn(s.page, SEL["save_edit"]).first.click()
    s.page.wait_for_timeout(400)
    after = s.ls("workpulse_logs")
    assert len(after) == count, "editing changed the number of logs"
    assert any(l["description"] == edited for l in after), "edited text not persisted"
    assert any(l["description"] == edited and l.get("editedAt") for l in after), "editedAt not set (Sheet sync needs it)"
    s.no_errors()


@check("timer_start_stop")
def timer_start_stop(s):
    s.tab("backlog")
    clock = re.compile(r"\b\d{2}:\d{2}:\d{2}\b")
    # The seed has one task already in progress. Read its clock twice.
    first = clock.findall(s.page.locator("body").inner_text())
    assert first, "no running timer shown on the Tasks tab"
    s.page.wait_for_timeout(2300)
    second = clock.findall(s.page.locator("body").inner_text())
    assert first != second, f"timer did not tick ({first} -> {second})"
    # Stop it (pause), then confirm it stops ticking and persists.
    btn(s.page, SEL["pause"]).first.click()
    s.page.wait_for_timeout(300)
    frozen = clock.findall(s.page.locator("body").inner_text())
    s.page.wait_for_timeout(2200)
    still = clock.findall(s.page.locator("body").inner_text())
    assert frozen == still, f"timer kept ticking after pause ({frozen} -> {still})"
    paused = [t for t in s.ls("workpulse_backlog") if t.get("stage") == "paused"]
    assert paused and (paused[0].get("elapsedSeconds") or 0) > 0, "paused task lost its elapsed time"
    s.no_errors()


@check("task_every_stage")
def task_every_stage(s):
    s.tab("backlog")
    title = "Smoke stage task"
    s.page.locator(SEL["add_task_input"]).first.fill(title)
    btn(s.page, SEL["add_task_queue"]).first.click()
    s.page.wait_for_timeout(300)
    assert stage_of(s, title) == "planned", "new task should start as planned"

    def press(label, expected):
        row = task_row(s.page, title)
        btn(row, label).first.click()
        s.page.wait_for_timeout(350)
        got = stage_of(s, title)
        assert got == expected, f"after '{label}': expected {expected}, got {got}"

    press(SEL["start"], "in_progress")
    s.page.wait_for_timeout(1300)
    press(SEL["pause"], "paused")
    press(SEL["resume"], "in_progress")
    # block: a reason prompt appears
    btn(task_row(s.page, title), SEL["block"]).first.click()
    s.page.wait_for_timeout(300)
    s.page.locator(SEL["block_reason_input"]).first.fill("waiting on smoke reviewer")
    btn(s.page, SEL["block_confirm"]).first.click()
    s.page.wait_for_timeout(350)
    assert stage_of(s, title) == "blocked", f"expected blocked, got {stage_of(s, title)}"
    press(SEL["unblock"], "in_progress")
    press(SEL["to_queue"], "planned")
    press(SEL["start"], "in_progress")
    press(SEL["complete"], "done")
    s.no_errors()


@check("themes_and_modes")
def themes_and_modes(s, shots=None):
    for theme in THEMES:
        s.set_theme(theme)
        got_theme, got_mode = s.html_attrs()
        assert got_theme == theme, f"switching to {theme} left data-theme={got_theme}"
        modes = ["dark"] if theme == "matrix" else ["dark", "light"]
        for mode in modes:
            if theme != "matrix" and got_mode != mode:
                s.page.locator(SEL["mode_toggle"]).first.click()
                s.page.wait_for_timeout(250)
            got_theme, got_mode = s.html_attrs()
            assert (got_theme, got_mode) == (theme, mode), f"{theme}/{mode}: html is {got_theme}/{got_mode}"
            for tab in ("feed", "backlog", "analytics", "settings"):
                s.tab(tab)
                assert s.page.locator("main, body").first.inner_text().strip(), f"{theme}/{mode}/{tab}: blank"
                over = s.page.evaluate("document.documentElement.scrollWidth - innerWidth")
                assert over <= 0, f"{theme}/{mode}/{tab}: horizontal overflow {over}px"
            if shots:
                s.tab("feed")
                s.page.screenshot(path=os.path.join(shots, f"smoke_{theme}_{mode}.png"))
            got_mode = mode
    # persistence across reload, in the last state (matrix/dark)
    s.page.reload()
    s.page.wait_for_load_state("networkidle")
    assert s.html_attrs() == ["matrix", "dark"], f"theme not restored after reload: {s.html_attrs()}"
    settings = s.ls("workpulse_settings")
    assert settings["theme"] == "matrix", "theme not persisted in workpulse_settings"
    s.no_errors()


def _escape_closes(s, open_fn, visible_loc, label):
    open_fn()
    expect(visible_loc).to_be_visible(timeout=3000)
    s.page.keyboard.press("Escape")
    s.page.wait_for_timeout(300)
    assert visible_loc.count() == 0 or not visible_loc.first.is_visible(), f"{label}: Escape did not close it"


def _modal_escape(kind):
    def run(s):
        s.tab("feed")
        if kind == "standup":
            _escape_closes(s, lambda: s.page.locator(SEL["standup_trigger"]).click(),
                           s.page.get_by_role("heading", name=re.compile(SEL["standup_heading"])), "AI Standup")
        elif kind == "eod":
            if not s.page.locator(SEL["eod_trigger"]).first.is_visible():
                s.tab("backlog")
            _escape_closes(s, lambda: s.page.locator(SEL["eod_trigger"]).first.click(),
                           s.page.get_by_role("heading", name=re.compile(SEL["eod_heading"])), "EOD synthesizer")
        elif kind == "palette":
            _escape_closes(s, lambda: s.page.keyboard.press(SEL["palette_trigger_key"]),
                           s.page.locator(SEL["palette_input"]), "search palette")
        s.no_errors()
    return run


for _kind in ("standup", "eod", "palette"):
    CHECKS.append((f"modal_escape:{_kind}", _modal_escape(_kind)))


@check("modal_escape_all_themes")
def modal_escape_all_themes(s):
    """The search palette must open and close with the keyboard in every theme."""
    for theme in THEMES:
        s.set_theme(theme)
        s.tab("feed")
        _escape_closes(s, lambda: s.page.keyboard.press(SEL["palette_trigger_key"]),
                       s.page.locator(SEL["palette_input"]), f"search palette in {theme}")
    s.no_errors()


# ---------------------------------------------------------------------------
# Runner
# ---------------------------------------------------------------------------
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", default=os.environ.get("WP_URL", "http://localhost:3000"))
    ap.add_argument("--only", default="")
    ap.add_argument("--list", action="store_true")
    ap.add_argument("--shots", default="")
    ap.add_argument("--headed", action="store_true")
    args = ap.parse_args()

    if args.list:
        for name, _ in CHECKS:
            print(name + ("   [expected to fail until " + EXPECTED_FAIL[name] + "]" if name in EXPECTED_FAIL else ""))
        return 0

    only = {n.strip() for n in args.only.split(",") if n.strip()}
    if args.shots:
        os.makedirs(args.shots, exist_ok=True)
    rows, bad = [], 0
    with sync_playwright() as pw:
        for name, fn in CHECKS:
            if only and name not in only:
                continue
            session, err = None, None
            try:
                session = Session(pw, args.url, headed=args.headed)
                if name == "themes_and_modes":
                    fn(session, shots=args.shots or None)
                else:
                    fn(session)
            except Exception as e:  # AssertionError, playwright timeouts, anything
                err = e
                if session and args.shots:
                    try:
                        session.page.screenshot(path=os.path.join(args.shots, f"FAIL_{name.replace(':', '_')}.png"))
                    except Exception:
                        pass
            finally:
                if session:
                    session.close()
            expected = name in EXPECTED_FAIL
            if err is None:
                status = "XPASS" if expected else "PASS"
            else:
                status = "XFAIL" if expected else "FAIL"
                if not expected:
                    bad += 1
            detail = ""
            if err is not None:
                first_line = str(err).strip().splitlines()[0] if str(err).strip() else type(err).__name__
                detail = first_line[:200]
                if status == "XFAIL":
                    detail = f"(expected until {EXPECTED_FAIL[name]}) " + detail
            elif status == "XPASS":
                detail = "now passes: remove it from EXPECTED_FAIL"
            rows.append((status, name, detail))
            print(f"{status:5}  {name}  {detail}".rstrip(), flush=True)

    counts = {k: sum(1 for r in rows if r[0] == k) for k in ("PASS", "FAIL", "XFAIL", "XPASS")}
    print("\nsummary: " + ", ".join(f"{v} {k}" for k, v in counts.items()))
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
