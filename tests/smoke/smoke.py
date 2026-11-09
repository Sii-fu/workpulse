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
    "standup_trigger": 'button[title^="Draft standup"]',   # the top bar's Standup button
    "standup_heading": "Draft standup",
    "eod_trigger": 'button[title^="End of day"]',      # the top bar's End of day button
    "eod_heading": "End-of-day timesheet",
    "palette_trigger_key": "Control+k",
    "palette_input": "input[role=combobox]",
    "settings_section_appearance": re.compile(r"Appearance"),
    "settings_save": "Save All Settings",
    "theme_cards": {
        "modern": "Modern",
        "minimalist": "Minimalist",
        "compact": "Compact",
        "matrix": "Matrix",
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
EXPECTED_FAIL = {}

THEMES = ["modern", "minimalist", "compact", "matrix"]
SEED_SETTINGS = {
    "googleScriptUrl": "", "geminiApiKey": "", "defaultTone": "casual",
    "lastDismissedReminderDate": "2999-01-01",  # keep the reminder banner out of the way
}
IGNORED_CONSOLE = (
    re.compile(r"favicon", re.I),
    # no Gemini key in the test environment: /api/gemini/generate answers 400 and the app
    # falls back to its offline template, which is the behaviour under test
    re.compile(r"Failed to load resource: the server responded with a status of 400"),
)

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

    def __init__(self, pw, url, theme="modern", mode="dark", width=1440, height=900, headed=False, touch=False):
        self.url = url
        self.browser = pw.chromium.launch(headless=not headed)
        self.ctx = self.browser.new_context(viewport={"width": width, "height": height}, color_scheme="light",
                                            has_touch=touch, is_mobile=touch)
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
        # the Tasks button on mobile carries its pending count in the name ("Tasks 3")
        loc = self.page.get_by_role("button", name=re.compile(rf"^{re.escape(labels[name])}( \d+)?$"))
        for i in range(loc.count()):
            if loc.nth(i).is_visible():
                loc.nth(i).click()
                self.page.wait_for_timeout(250)
                return
        raise AssertionError(f"navigation button '{labels[name]}' not found or not visible")

    def set_theme(self, theme):
        self.tab("settings")
        self.page.get_by_role("button", name=SEL["settings_section_appearance"]).first.click()
        self.page.get_by_role("radio", name=re.compile(rf"^{SEL['theme_cards'][theme]}")).click()
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
    # inside <main>: the running-task strip in the header also shows the title of a running task
    return page.locator(f"xpath=(//main//*[normalize-space(text())='{title}'])[1]/ancestor::*[.//button][1]")


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
    logs_before = len(s.ls("workpulse_logs") or [])
    press(SEL["complete"], "done")
    # Done only parks the task in Completed Today; the timesheet gets it when the user picks it.
    assert len(s.ls("workpulse_logs") or []) == logs_before, "marking a task done must not create a log"
    done = [t for t in s.ls("workpulse_backlog") if t.get("title") == title][0]
    assert done.get("completed") and not done.get("isSynthesized"), "done task should be waiting, not logged"
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


# -- accessibility of the shared dialog shell and keyboard flows (P1) -------------------------
IN_DIALOG = "() => !!document.activeElement && !!document.activeElement.closest('[role=dialog]')"


def _open_standup(s):
    s.tab("feed")
    trigger = s.page.locator(SEL["standup_trigger"])
    trigger.focus()
    trigger.click()
    return trigger


def _open_eod(s):
    if not s.page.locator(SEL["eod_trigger"]).first.is_visible():
        s.tab("backlog")
    trigger = s.page.locator(SEL["eod_trigger"]).first
    trigger.focus()
    trigger.click()
    return trigger


@check("dialog_a11y")
def dialog_a11y(s):
    """Each dialog: named role=dialog, focus moves in, Tab/Shift+Tab stay inside, Escape closes
    and focus returns to the control that opened it."""
    for label, opener in (("AI Standup", _open_standup), ("EOD synthesizer", _open_eod)):
        trigger = opener(s)
        dlg = s.page.get_by_role("dialog")
        expect(dlg).to_be_visible(timeout=3000)
        assert dlg.get_attribute("aria-modal") == "true", f"{label}: aria-modal missing"
        assert (dlg.get_attribute("aria-labelledby") or dlg.get_attribute("aria-label")), f"{label}: dialog has no name"
        assert s.page.evaluate(IN_DIALOG), f"{label}: focus did not move into the dialog"
        for i in range(20):
            s.page.keyboard.press("Tab")
            assert s.page.evaluate(IN_DIALOG), f"{label}: Tab #{i + 1} left the dialog"
        for i in range(20):
            s.page.keyboard.press("Shift+Tab")
            assert s.page.evaluate(IN_DIALOG), f"{label}: Shift+Tab #{i + 1} left the dialog"
        s.page.keyboard.press("Escape")
        s.page.wait_for_timeout(250)
        assert s.page.get_by_role("dialog").count() == 0, f"{label}: Escape did not close it"
        same = s.page.evaluate("(el) => document.activeElement === el", trigger.element_handle())
        assert same, f"{label}: focus did not return to the button that opened it"
    s.no_errors()


@check("palette_keyboard")
def palette_keyboard(s):
    """Ctrl+K, arrow keys move the highlighted result, Enter picks it and closes."""
    s.tab("feed")
    s.page.keyboard.press(SEL["palette_trigger_key"])
    inp = s.page.locator(SEL["palette_input"])
    expect(inp).to_be_visible(timeout=3000)
    assert s.page.evaluate("() => document.activeElement && document.activeElement.getAttribute('role')") == "combobox",         "search input is not focused on open"
    options = s.page.get_by_role("option")
    assert options.count() >= 2, "need at least two results to test arrow keys"
    selected = lambda: s.page.evaluate(
        "() => [...document.querySelectorAll('[role=option]')].findIndex(o => o.getAttribute('aria-selected') === 'true')")
    assert selected() == 0, "first result should start highlighted"
    s.page.keyboard.press("ArrowDown")
    assert selected() == 1, "ArrowDown did not move the highlight"
    active = s.page.evaluate("() => document.activeElement.getAttribute('aria-activedescendant')")
    assert active and s.page.locator(f"[id='{active}']").get_attribute("aria-selected") == "true",         "aria-activedescendant does not point at the highlighted option"
    s.page.keyboard.press("ArrowUp")
    assert selected() == 0, "ArrowUp did not move the highlight back"
    s.page.keyboard.press("Enter")
    s.page.wait_for_timeout(250)
    assert s.page.get_by_role("dialog").count() == 0, "Enter did not pick a result and close the palette"
    s.no_errors()


@check("toast_live_region")
def toast_live_region(s):
    """The notification region exists from the start, so screen readers announce what appears in it."""
    region = s.page.locator('[role=region][aria-label="Notifications"]')
    assert region.count() == 1, "no notifications region"
    assert region.get_attribute("aria-live") == "polite", "notifications region is not aria-live"
    s.no_errors()


@check("theme_cards_keyboard")
def theme_cards_keyboard(s):
    """Settings > Appearance: theme cards are a radio group; arrow keys move the choice."""
    s.tab("settings")
    s.page.get_by_role("button", name=SEL["settings_section_appearance"]).first.click()
    group = s.page.get_by_role("radiogroup", name="Theme")
    expect(group).to_be_visible(timeout=3000)
    radios = group.get_by_role("radio")
    assert radios.count() == 4, "expected four theme cards"
    checked = lambda: s.page.evaluate(
        "() => [...document.querySelectorAll('[role=radiogroup] [role=radio]')].findIndex(r => r.getAttribute('aria-checked') === 'true')")
    start = checked()
    radios.nth(start).focus()
    s.page.keyboard.press("ArrowRight")
    assert checked() == (start + 1) % 4, "ArrowRight did not move the theme choice"
    s.page.keyboard.press("ArrowLeft")
    assert checked() == start, "ArrowLeft did not move it back"
    s.no_errors()


# -- feed parity across themes (P2) ------------------------------------------------------------
ROWS = '[id^="log-row-"]'


def _quick_add(s, theme, text):
    """Write a log through the theme's own input and return its row."""
    p = s.page
    if theme == "minimalist":
        ta = p.get_by_label("What you worked on today")
        ta.fill(text)
        ta.press("Control+Enter")
    elif theme == "compact":
        inp = p.get_by_label("Quick log description")
        inp.fill(text)
        inp.press("Enter")
    elif theme == "matrix":
        inp = p.get_by_label("Command line")
        inp.fill(text)
        inp.press("Enter")
    else:
        p.locator(SEL["log_textarea"]).first.fill(text)
        btn(p, SEL["commit_log"]).first.click()
    p.wait_for_timeout(400)
    assert any(l["description"] == text for l in s.ls("workpulse_logs")), f"{theme}: log was not saved"
    row = p.locator(ROWS).filter(has_text=text)
    expect(row).to_have_count(1)
    return row


def _parity(theme):
    def run(s):
        p = s.page
        s.set_theme(theme)
        s.tab("feed")
        text = f"Parity {theme} entry"
        edited = text + " edited"

        row = _quick_add(s, theme, text)

        # filter: search narrows the list to the new log, and clearing brings the rest back
        total = p.locator(ROWS).count()
        assert total >= 2, f"{theme}: expected the seed logs plus the new one"
        p.get_by_role("searchbox", name="Search logs").fill(text)
        p.wait_for_timeout(200)
        assert p.locator(ROWS).count() == 1, f"{theme}: search did not narrow the list"
        btn(p, "Clear filters").first.click()
        p.wait_for_timeout(200)
        assert p.locator(ROWS).count() == total, f"{theme}: Clear filters did not restore the list"

        # edit: the same four actions exist in every theme
        row = p.locator(ROWS).filter(has_text=text)
        for name in ("Edit log", "Duplicate log", "Copy log text", "Delete log"):
            expect(row.get_by_role("button", name=name)).to_be_visible()
        row.get_by_role("button", name="Edit log").click()
        p.wait_for_timeout(300)
        if theme != "modern":
            expect(p.get_by_role("dialog")).to_be_visible(timeout=3000)
            ta = p.get_by_role("dialog").locator("textarea").first
        else:
            ta = p.locator(SEL["log_textarea"]).first
        expect(ta, f"{theme}: edit form did not load the log").to_have_value(text)
        ta.fill(edited)
        btn(p, SEL["save_edit"]).first.click()
        p.wait_for_timeout(400)
        assert any(l["description"] == edited and l.get("editedAt") for l in s.ls("workpulse_logs")), f"{theme}: edit not saved"
        assert p.get_by_role("dialog").count() == 0, f"{theme}: editor did not close after saving"
        row = p.locator(ROWS).filter(has_text=edited)
        expect(row).to_have_count(1)

        # select a log and write a standup from it
        row.get_by_label("Select log for standup").check()
        btn(p, "Standup from 1").first.click()
        expect(p.get_by_role("dialog")).to_be_visible(timeout=3000)
        p.keyboard.press("Escape")
        p.wait_for_timeout(250)
        btn(p, re.compile(r"^Clear$")).first.click()

        # search palette: pick the log from another screen while a filter hides it
        p.get_by_label("Filter by status").first.select_option("blocked")
        s.tab("settings")
        p.keyboard.press(SEL["palette_trigger_key"])
        p.locator(SEL["palette_input"]).fill(edited)
        p.keyboard.press("Enter")
        p.wait_for_timeout(700)
        target = p.locator(ROWS).filter(has_text=edited)
        expect(target).to_have_count(1)
        assert p.evaluate("() => document.activeElement && document.activeElement.id.startsWith('log-row-')"), \
            f"{theme}: palette did not take you to the log"
        assert p.get_by_label("Filter by status").first.input_value() == "all", f"{theme}: a filter still hides the picked log"

        # delete
        target.get_by_role("button", name="Delete log").click()
        p.wait_for_timeout(300)
        assert not any(l["description"] == edited for l in s.ls("workpulse_logs")), f"{theme}: delete did not remove it"
        s.no_errors()
    return run


for _t in THEMES:
    CHECKS.append((f"parity:{_t}", _parity(_t)))


@check("quick_log_details")
def quick_log_details(s):
    """Minimalist, Compact and Matrix: 'details' opens the full form with what was typed."""
    p = s.page
    for theme, field, opener in (
        ("minimalist", p.get_by_label("What you worked on today"), "Add details"),
        ("compact", p.get_by_label("Quick log description"), "Add details"),
        ("matrix", p.get_by_label("Command line"), "DETAILS"),
    ):
        s.set_theme(theme)
        s.tab("feed")
        text = f"Detailed {theme} entry"
        field.fill(text)
        btn(p, opener).first.click()
        dlg = p.get_by_role("dialog")
        expect(dlg).to_be_visible(timeout=3000)
        expect(dlg.locator("textarea").first, f"{theme}: typed text did not reach the full form").to_have_value(text)
        expect(dlg.get_by_label("Link to attach (PR, Jira, Figma, Docs)")).to_be_visible()  # the full form, not a one-liner
        btn(dlg, SEL["commit_log"]).first.click()
        p.wait_for_timeout(400)
        assert any(l["description"] == text for l in s.ls("workpulse_logs")), f"{theme}: detailed log not saved"
        assert p.get_by_role("dialog").count() == 0, f"{theme}: dialog stayed open after committing"
    s.no_errors()


@check("mobile_log_actions")
def mobile_log_actions(s):
    """On a phone (touch, 390 px) every theme shows a log's four actions inside the screen,
    each at least 44 px tall, with no sideways scrolling needed."""
    for theme in THEMES:
        settings = dict(SEED_SETTINGS, theme=theme, colorMode="dark")
        ctx = s.browser.new_context(viewport={"width": 390, "height": 844}, has_touch=True, is_mobile=True)
        ctx.add_init_script("try{ localStorage.setItem('workpulse_settings', %s) }catch(e){}" % json.dumps(json.dumps(settings)))
        page = ctx.new_page()
        try:
            page.goto(s.url)
            page.wait_for_load_state("networkidle")
            row = page.locator(ROWS).first
            expect(row).to_be_visible(timeout=3000)
            for name in ("Edit log", "Duplicate log", "Copy log text", "Delete log"):
                b = row.get_by_role("button", name=name)
                box = b.bounding_box()
                assert box, f"{theme}: '{name}' is not rendered"
                assert box["x"] >= 0 and box["x"] + box["width"] <= 391, f"{theme}: '{name}' is off screen ({box['x']:.0f}+{box['width']:.0f})"
                assert box["height"] >= 43.5 and box["width"] >= 43.5, f"{theme}: '{name}' is {box['width']:.0f}x{box['height']:.0f}, under 44 px"
                assert float(b.evaluate("e => getComputedStyle(e.parentElement).opacity")) > 0.9, f"{theme}: '{name}' is hidden on touch"
            overflow = page.evaluate("() => document.documentElement.scrollWidth - window.innerWidth")
            assert overflow <= 1, f"{theme}: page scrolls sideways by {overflow}px"
        finally:
            ctx.close()


@check("sheets_sync_below_xl")
def sheets_sync_below_xl(s):
    """With a Sheet linked, Sync is reachable on a narrow screen (the status pill only shows from xl)."""
    p = s.page
    settings = s.ls("workpulse_settings")
    settings["googleScriptUrl"] = "https://script.google.com/macros/s/AKfycbSMOKE/exec"
    p.evaluate("v => localStorage.setItem('workpulse_settings', v)", json.dumps(settings))
    p.set_viewport_size({"width": 1024, "height": 800})
    p.reload()
    p.wait_for_load_state("networkidle")
    expect(p.get_by_role("button", name=re.compile(r"^Sync to Google Sheet"))).to_be_visible(timeout=3000)
    s.no_errors()


# -- identity features (P3) --------------------------------------------------------------------
@check("running_strip")
def running_strip(s):
    """A running task shows on every screen with a live clock, and can be paused from there."""
    p = s.page
    strip = p.get_by_role("region", name="Running task")
    expect(strip).to_be_visible(timeout=3000)
    clock = re.compile(r"\b\d{2}:\d{2}:\d{2}\b")
    first = clock.findall(strip.inner_text())
    assert first, "no clock in the running strip"
    p.wait_for_timeout(2300)
    assert clock.findall(strip.inner_text()) != first, "the strip's clock did not tick"
    s.tab("settings")
    expect(strip).to_be_visible()  # still there on another screen
    strip.get_by_role("button", name=re.compile(r"^Pause running task")).click()
    p.wait_for_timeout(400)
    assert strip.count() == 0, "strip stayed after the only running task was paused"
    assert any(t.get("stage") == "paused" for t in s.ls("workpulse_backlog")), "pausing from the strip did not persist"
    s.no_errors()


@check("theme_menu")
def theme_menu(s):
    """The top bar switches theme at once, by keyboard too, and remembers it."""
    p = s.page
    p.get_by_role("button", name=re.compile(r"Theme|Switch theme|^Modern$")).first.click()
    menu = p.get_by_role("menu", name="Theme")
    expect(menu).to_be_visible(timeout=3000)
    assert p.evaluate("document.activeElement.getAttribute('role')") == "menuitemradio", "focus did not enter the menu"
    p.keyboard.press("Escape")
    expect(menu).to_have_count(0)
    p.get_by_role("button", name=re.compile(r"Theme|Switch theme|^Modern$")).first.click()
    p.keyboard.press("ArrowDown")
    p.keyboard.press("ArrowDown")
    p.keyboard.press("Enter")  # modern -> minimalist -> compact
    p.wait_for_timeout(300)
    assert s.html_attrs()[0] == "compact", f"expected compact, got {s.html_attrs()}"
    p.reload()
    p.wait_for_load_state("networkidle")
    assert s.html_attrs()[0] == "compact", "theme not remembered after reload"
    s.no_errors()


@check("compact_keyboard")
def compact_keyboard(s):
    """Compact: j moves the row cursor, e opens the editor for that row, / jumps to search."""
    p = s.page
    s.set_theme("compact")
    s.tab("feed")
    p.locator("body").click(position={"x": 5, "y": 400})
    p.keyboard.press("j")
    p.keyboard.press("j")
    cursor = p.locator('[id^="log-row-"][aria-current="true"]')
    expect(cursor).to_have_count(1)
    rows = p.locator('[id^="log-row-"]')
    assert rows.nth(1).get_attribute("aria-current") == "true", "j j should land on the second row"
    p.keyboard.press("e")
    expect(p.get_by_role("dialog")).to_be_visible(timeout=3000)
    p.keyboard.press("Escape")
    p.wait_for_timeout(250)
    p.keyboard.press("/")
    assert p.evaluate("document.activeElement && document.activeElement.type") == "search", "/ did not focus the search box"
    s.no_errors()


@check("matrix_scanlines_opt_in")
def matrix_scanlines_opt_in(s):
    """Matrix has no scanline overlay until it is switched on in Settings."""
    p = s.page
    s.set_theme("matrix")
    assert p.evaluate("document.documentElement.getAttribute('data-crt')") is None, "scanlines should be off by default"
    s.tab("settings")
    p.get_by_role("button", name=SEL["settings_section_appearance"]).first.click()
    p.get_by_role("checkbox", name=re.compile("Scanlines")).check()
    btn(p, SEL["settings_save"]).first.click()
    p.wait_for_timeout(300)
    assert p.evaluate("document.documentElement.getAttribute('data-crt')") == "on", "scanlines did not turn on"
    p.reload()
    p.wait_for_load_state("networkidle")
    assert p.evaluate("document.documentElement.getAttribute('data-crt')") == "on", "scanline setting not remembered"
    assert s.ls("workpulse_settings").get("crtEffect") is True
    s.no_errors()


# -- Tasks and Analytics (P4) ------------------------------------------------------------------
@check("tasks_all_themes")
def tasks_all_themes(s):
    """In every theme the running task's clock ticks, and a task can be logged with details."""
    p = s.page
    clock = re.compile(r"\b\d{2}:\d{2}:\d{2}\b")
    for theme in THEMES:
        s.set_theme(theme)
        s.tab("backlog")
        main = p.locator("main")
        first = clock.findall(main.inner_text())
        assert first, f"{theme}: no running clock on the Tasks screen"
        p.wait_for_timeout(2300)
        assert clock.findall(main.inner_text()) != first, f"{theme}: the Tasks clock did not tick"
        btn_ = main.get_by_role("button", name=re.compile(r"^Log with details: ")).first
        expect(btn_).to_be_visible()
        title = btn_.get_attribute("aria-label").split(": ", 1)[1]
        btn_.click()
        p.wait_for_timeout(400)
        if theme == "modern":
            ta = p.locator(SEL["log_textarea"]).first
        else:
            expect(p.get_by_role("dialog")).to_be_visible(timeout=3000)
            ta = p.get_by_role("dialog").locator("textarea").first
        expect(ta, f"{theme}: task title did not reach the log form").to_have_value(title)
        if theme != "modern":
            p.keyboard.press("Escape")
            p.wait_for_timeout(250)
    s.no_errors()


@check("analytics_labelled")
def analytics_labelled(s):
    """The daily chart has its values as text (a table for screen readers, labels on the bars)."""
    p = s.page
    s.tab("analytics")
    table = p.locator("table.sr-only")
    expect(table).to_have_count(1)
    assert table.locator("tbody tr").count() == 7, "expected one row per day for the last 7 days"
    assert p.get_by_text(re.compile(r"Busiest day:")).count() == 1
    s.no_errors()


# -- first run, failures and phones (P5) --------------------------------------------------------
@check("sample_data_flow")
def sample_data_flow(s):
    """A new colleague sees labelled sample data and can clear it in one click, keeping their own work."""
    p = s.page
    banner = p.get_by_role("region", name="Sample data")
    expect(banner).to_be_visible(timeout=3000)
    assert p.locator(ROWS).count() == 6, "expected the six sample logs"
    assert p.get_by_text("Sample data", exact=True).count() >= 6, "each sample log should carry a Sample data label"
    # one real log, then clear
    p.locator(SEL["log_textarea"]).first.fill("My own entry")
    btn(p, SEL["commit_log"]).first.click()
    p.wait_for_timeout(400)
    btn(p, "Clear sample data").first.click()
    p.wait_for_timeout(400)
    expect(banner).to_have_count(0)
    mine = [l for l in s.ls("workpulse_logs")]
    assert [l["description"] for l in mine] == ["My own entry"], f"only the real log should remain: {mine}"
    assert p.locator(ROWS).count() == 1
    assert s.ls("workpulse_projects"), "there must be a project left to log against"
    assert s.ls("workpulse_backlog") == [], "sample tasks should be gone"
    # undo brings the sample items back
    btn(p, "^Undo$" if False else re.compile(r"^Undo$")).first.click()
    p.wait_for_timeout(400)
    assert p.locator(ROWS).count() == 7, "undo should restore the sample logs next to the real one"
    expect(banner).to_be_visible()
    s.no_errors()


@check("backup_reminder")
def backup_reminder(s):
    """Quiet for demo data, shown for real work with an old or missing backup, cleared by a backup."""
    p = s.page
    reminder = p.get_by_role("region", name="Backup reminder")
    expect(reminder).to_have_count(0)  # a new colleague has nothing to lose yet
    p.locator(SEL["log_textarea"]).first.fill("Real work to protect")
    btn(p, SEL["commit_log"]).first.click()
    p.wait_for_timeout(400)
    p.reload()
    p.wait_for_load_state("networkidle")
    expect(reminder).to_be_visible(timeout=3000)
    expect(reminder).to_contain_text("No backup yet")
    # "Later" hides it for this visit only
    btn(reminder, "Later").click()
    expect(reminder).to_have_count(0)
    # an old backup date brings it back with the age in plain words
    settings = s.ls("workpulse_settings")
    settings["lastBackupAt"] = "2000-01-01T00:00:00.000Z"
    p.evaluate("v => localStorage.setItem('workpulse_settings', v)", json.dumps(settings))
    p.reload()
    p.wait_for_load_state("networkidle")
    expect(reminder).to_contain_text(re.compile(r"Last backup \d+ days ago"))
    # backing up from the reminder downloads the file, records the date and hides the reminder
    with p.expect_download() as dl:
        btn(reminder, "Back up now").click()
    name = dl.value.suggested_filename
    assert re.fullmatch(r"workpulse-backup-\d{4}-\d{2}-\d{2}\.json", name), f"unexpected file name {name}"
    expect(reminder).to_have_count(0)
    saved = s.ls("workpulse_settings")
    assert saved.get("lastBackupAt", "").startswith("20") and saved["lastBackupAt"] > "2026", "backup date not recorded"
    backup = json.load(open(dl.value.path(), encoding="utf-8"))
    assert "lastBackupAt" not in backup["settings"] and "geminiApiKey" not in backup["settings"], "device-only values leaked into the file"
    assert any(l["description"] == "Real work to protect" for l in backup["logs"]), "backup is missing the real log"
    # Settings shows the same fact
    s.tab("settings")
    btn(p, "Data & Backup").first.click()
    expect(p.get_by_test_id("last-backup")).to_have_text("Last backup today")
    s.no_errors()


@check("offline_notice")
def offline_notice(s):
    p = s.page
    notice = p.get_by_role("status").filter(has_text="You are offline")
    expect(notice).to_have_count(0)
    s.ctx.set_offline(True)
    expect(notice).to_be_visible(timeout=3000)
    s.ctx.set_offline(False)
    expect(notice).to_have_count(0, timeout=3000)
    s.no_errors()


@check("eod_error_retry")
def eod_error_retry(s):
    """When the synthesis request fails the message is plain and Try again works."""
    p = s.page
    handler = lambda route: route.abort()
    p.route("**/api/synthesize-eod", handler)
    p.locator(SEL["eod_trigger"]).first.click()
    err = p.get_by_text(re.compile(r"could not reach its server"))
    expect(err).to_be_visible(timeout=5000)
    assert p.get_by_text("Failed to fetch").count() == 0, "raw browser error leaked into the UI"
    p.unroute("**/api/synthesize-eod", handler)
    btn(p, "Try again").first.click()
    expect(p.get_by_role("button", name=re.compile(r"^Push \d+ to the Sheet"))).to_be_visible(timeout=8000)
    # the aborted request is logged by the browser and by the app on purpose
    s.errors = [e for e in s.errors if "ERR_FAILED" not in e and "Synthesis error" not in e]
    s.no_errors()


@check("mobile_first_run")
def mobile_first_run(s):
    """Phone: the log form starts short, tags and links are one tap away, the running task stays on screen."""
    settings = dict(SEED_SETTINGS, theme="modern", colorMode="dark")
    ctx = s.browser.new_context(viewport={"width": 390, "height": 844}, has_touch=True, is_mobile=True)
    ctx.add_init_script("try{ if(!localStorage.getItem('workpulse_settings')) localStorage.setItem('workpulse_settings', %s) }catch(e){}" % json.dumps(json.dumps(settings)))
    page = ctx.new_page()
    try:
        page.goto(s.url)
        page.wait_for_load_state("networkidle")
        tags = page.get_by_role("button", name="#bugfix").first
        assert not tags.is_visible(), "tag pills should be tucked away on a phone"
        toggle = page.get_by_role("button", name=re.compile(r"^Tags, link, screenshot"))
        expect(toggle).to_be_visible()
        toggle.click()
        expect(tags).to_be_visible()
        # the strip stays under the top bar after scrolling a long way
        page.mouse.wheel(0, 1500)
        page.wait_for_timeout(300)
        box = page.get_by_role("region", name="Running task").bounding_box()
        assert box and box["y"] < 90, f"running strip scrolled away (y={box and box['y']})"
        over = page.evaluate("() => document.documentElement.scrollWidth - window.innerWidth")
        assert over <= 1, f"page scrolls sideways by {over}px"
        # every control in the top bar fits on the screen at touch size (nothing clipped off the right edge)
        right_edges = page.evaluate("() => [...document.querySelectorAll('header button')].map(b => { const r = b.getBoundingClientRect(); return [b.getAttribute('aria-label') || b.textContent.trim(), Math.round(r.right), Math.round(r.height)]; })")
        for label, right, height in right_edges:
            if height == 0:
                continue  # the desktop tab row is hidden on a phone
            assert right <= 390, f"top bar control '{label}' is cut off (right edge {right}px)"
            assert height >= 43, f"top bar control '{label}' is only {height}px tall on touch"
    finally:
        ctx.close()


@check("toast_pauses_on_hover")
def toast_pauses_on_hover(s):
    """A toast goes away by itself, but not while the pointer is on it."""
    p = s.page
    p.locator(SEL["log_textarea"]).first.fill("Toast test entry")
    btn(p, SEL["commit_log"]).first.click()
    toast = p.get_by_role("status").filter(has_text="recorded")
    expect(toast).to_be_visible(timeout=3000)
    toast.hover()
    p.wait_for_timeout(5000)  # longer than the 3.5 s a toast normally lasts
    expect(toast).to_be_visible()
    p.mouse.move(5, 400)
    expect(toast).to_have_count(0, timeout=6000)
    s.no_errors()


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
