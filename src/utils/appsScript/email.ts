// The evening email of the WorkPulse Apps Script: the pure builder, the daily send with its once-a-day
// guard, and the setEmail / sendTestEmail desktop actions. Plain ES5-style Apps Script text, appended
// after SCRIPT_CORE in googleAppsScriptTemplate.ts (it uses the core's helpers: readTab_, getMeta_, ...).
//
// Callable from google.script.run (no "_"): sendEveningEmail (a time trigger needs it public; it sends
// at most once per local date, only to the script owner) and buildEveningEmail (pure: it reads nothing
// and sends nothing). Everything else ends with "_".
// All user text is HTML-escaped in the HTML body; the plain-text body has no markup of its own.
export const SCRIPT_EMAIL = String.raw`
// =========================================================================
// Evening email
// =========================================================================

var EMAIL_FN = 'sendEveningEmail';

// ---- Desktop actions ----

// { token, enabled, hour, minute, tz }: one daily trigger when enabled, none when not.
function setEmailAction_(c) {
  var check = checkToken(c.token);
  if (!check.ok) return errorOf_(check);
  if (c.enabled !== true && c.enabled !== false) return badRequest_();
  var props = PropertiesService.getScriptProperties();
  var hour = c.hour;
  var minute = c.minute;
  var tz = str_(c.tz).slice(0, 100);
  if (c.enabled) {
    if (typeof hour !== 'number' || hour % 1 !== 0 || hour < 0 || hour > 23 ||
        typeof minute !== 'number' || minute % 1 !== 0 || minute < 0 || minute > 59) {
      return badRequest_('Pick a time of day between 00:00 and 23:59.');
    }
    if (!validZone_(tz)) return badRequest_('That time zone is not known.');
  }
  try {
    return withLock(function () {
      removeEmailTriggers_();
      var saved = {};
      try {
        saved = JSON.parse(props.getProperty('email') || '{}') || {};
      } catch (err) {}
      if (c.enabled) {
        ScriptApp.newTrigger(EMAIL_FN).timeBased().atHour(hour).nearMinute(minute).everyDays(1).inTimezone(tz).create();
        saved = { enabled: true, hour: hour, minute: minute, tz: tz };
      } else {
        saved.enabled = false;
      }
      props.setProperty('email', JSON.stringify(saved));
      return { status: 'ok', enabled: !!saved.enabled, hour: saved.hour, minute: saved.minute, tz: saved.tz };
    });
  } catch (error) {
    console.error(error);
    return { status: 'error', code: 'error', message: 'The Sheet script could not set up the daily timer. Paste the latest script, redeploy it as a new version and allow the permissions Google asks for.' };
  }
}

// { token }: today's email now, whatever the day holds. It does not use or change the once-a-day guard.
function sendTestEmailAction_(c) {
  var check = checkToken(c.token);
  if (!check.ok) return errorOf_(check);
  var mail = composeEmail_(true);
  var to = sendMail_(mail);
  return { status: 'ok', sent: true, to: to };
}

function removeEmailTriggers_() {
  var all = ScriptApp.getProjectTriggers();
  for (var i = 0; i < all.length; i++) {
    if (all[i].getHandlerFunction() === EMAIL_FN) ScriptApp.deleteTrigger(all[i]);
  }
}

function validZone_(tz) {
  if (!tz) return false;
  try {
    Utilities.formatDate(new Date(), tz, 'yyyy');
    return true;
  } catch (err) {
    return false;
  }
}

// ---- The daily send ----

// Run by the time trigger. It sends at most once per local date (lastEmailDate is set only after the mail
// went out), and only when the day has a log or a clock-in. google.script.run can call it too, so it
// never takes input and never sends anywhere but to the owner.
function sendEveningEmail() {
  return withLock(function () {
    var props = PropertiesService.getScriptProperties();
    var today = todayIn_(userTz_(getMeta_()));
    if (props.getProperty('lastEmailDate') === today) return { sent: false };
    var mail = composeEmail_(false);
    if (mail.skip) return { sent: false };
    sendMail_(mail);
    props.setProperty('lastEmailDate', today);
    return { sent: true };
  });
}

function sendMail_(mail) {
  var to = Session.getEffectiveUser().getEmail();
  MailApp.sendEmail({ to: to, subject: mail.subject, htmlBody: mail.html, body: mail.text });
  return to;
}

// Reads the Sheet and builds today's email (the date in the user's zone).
function composeEmail_(isTest) {
  var meta = getMeta_();
  var tz = userTz_(meta);
  var ssTz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
  var today = todayIn_(tz);
  var i;

  var tasks = [];
  var taskRows = readTab_('WorkPulse_Tasks');
  for (i = 0; i < taskRows.length; i++) {
    var t = taskRows[i];
    if (t[0] === '') continue;
    tasks.push({
      id: String(t[0]), title: String(t[1]), project: String(t[2]), dueDate: dateText_(t[4], ssTz),
      stage: String(t[5]), completedAt: isoText_(t[7])
    });
  }
  var logs = [];
  var logRows = readTab_('WorkPulse_Recent');
  for (i = 0; i < logRows.length; i++) {
    var l = logRows[i];
    if (l[0] === '') continue;
    logs.push({
      id: String(l[0]), date: dateText_(l[1], ssTz), time: timeText_(l[2], ssTz), project: String(l[3]),
      projectId: String(l[4]), description: String(l[5]), status: String(l[6]), minutes: num_(l[7])
    });
  }
  var workday = null;
  var dayRows = readTab_('WorkPulse_Days');
  for (i = 0; i < dayRows.length; i++) {
    if (dateText_(dayRows[i][0], ssTz) === today) {
      workday = { clockIn: isoText_(dayRows[i][1]), clockOut: isoText_(dayRows[i][2]) };
    }
  }
  return buildEveningEmail({
    date: today,
    tz: tz,
    tasks: tasks,
    logs: logs,
    projects: projectList_(),
    workday: workday,
    workdayHours: meta.workdayHours || DEFAULT_WORKDAY_HOURS,
    pushedAt: meta.pushedAt || '',
    pendingPhoneCount: pendingItems_().length,
    isTest: isTest === true
  });
}

// ---- The email itself (pure) ----

// data = { date, tz, tasks, logs, workday, workdayHours, pushedAt, pendingPhoneCount, projects?, isTest? }
// Returns { skip, subject, html, text }. skip is true when the day has no log and no clock-in.
function buildEveningEmail(data) {
  var date = data.date;
  var tz = data.tz;
  var now = new Date();
  var i;

  var logs = [];
  var all = data.logs || [];
  for (i = 0; i < all.length; i++) {
    if (all[i] && all[i].date === date) logs.push(all[i]);
  }
  var logMinutes = 0;
  for (i = 0; i < logs.length; i++) logMinutes += num_(logs[i].minutes);

  var clockIn = emailDate_(data.workday && data.workday.clockIn);
  var clockOut = emailDate_(data.workday && data.workday.clockOut);
  var noData = logs.length === 0 && !clockIn;

  // Worked time is the clocked time (to now while still clocked in); with no clock-in it is the logged time.
  var worked = logMinutes;
  if (clockIn) {
    var end = clockOut || now;
    worked = Math.max(0, Math.floor((end.getTime() - clockIn.getTime()) / 60000));
  }
  var hours = num_(data.workdayHours) > 0 ? num_(data.workdayHours) : DEFAULT_WORKDAY_HOURS;
  var target = Math.round(hours * 60);

  var clockLine;
  if (!clockIn) clockLine = 'not clocked in';
  else if (clockOut) clockLine = 'In ' + clockTime_(clockIn, tz) + ' · Out ' + clockTime_(clockOut, tz);
  else clockLine = 'In ' + clockTime_(clockIn, tz) + ' · still clocked in';

  var pushed = emailDate_(data.pushedAt);
  var dataLine;
  if (pushed && Utilities.formatDate(pushed, tz, 'yyyy-MM-dd') === date) {
    dataLine = 'Data from your PC as of ' + clockTime_(pushed, tz) + '.';
  } else {
    dataLine = 'No data from your PC today.';
    if (pushed) dataLine += ' The last data came on ' + Utilities.formatDate(pushed, tz, 'EEE d MMM') + ' at ' + clockTime_(pushed, tz) + '.';
  }

  var groups = logGroups_(logs, data.projects || []);

  var done = [];
  var open = [];
  var tasks = data.tasks || [];
  for (i = 0; i < tasks.length; i++) {
    var t = tasks[i];
    if (!t) continue;
    if (t.stage === 'done') {
      if (emailLocalDate_(t.completedAt, tz) === date) done.push(t);
    } else {
      open.push(t);
    }
  }
  var openGroups = openTaskGroups_(open, date);

  var pending = num_(data.pendingPhoneCount);
  var pendingLine = pending > 0
    ? pending + (pending === 1 ? ' task added on your phone is' : ' tasks added on your phone are') + ' not on your PC yet.'
    : '';

  var dayShort = dayText_(date, 'EEE d MMM');
  var dayLong = dayText_(date, 'EEEE d MMMM');
  var subject = noData
    ? 'WorkPulse · ' + dayShort + ' · no data yet'
    : 'WorkPulse · ' + dayShort + ' · ' + fmtHM_(worked) + ' worked · ' + logs.length + (logs.length === 1 ? ' log' : ' logs');

  var footer = (data.isTest ? 'This is a test email. ' : '') + 'Sent by your WorkPulse script at ' + clockTime_(now, tz) + ' (' + tz +
    '). Change the time or turn it off in WorkPulse Settings → Phone & evening email.';

  var model = {
    dayLong: dayLong, noData: noData, worked: worked, target: target, clockLine: clockLine, dataLine: dataLine,
    groups: groups, logCount: logs.length, logMinutes: logMinutes, done: done, openGroups: openGroups,
    openCount: open.length, pendingLine: pendingLine, footer: footer
  };
  return { skip: noData, subject: subject, html: emailHtml_(model), text: emailText_(model) };
}

// ---- Pieces ----

function emailDate_(iso) {
  if (!iso) return null;
  var d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

function clockTime_(d, tz) {
  return Utilities.formatDate(d, tz, 'HH:mm');
}

function emailLocalDate_(iso, tz) {
  var d = emailDate_(iso);
  return d ? Utilities.formatDate(d, tz, 'yyyy-MM-dd') : '';
}

// Minutes as H:MM.
function fmtHM_(minutes) {
  var m = Math.max(0, Math.round(minutes));
  var rest = m % 60;
  return Math.floor(m / 60) + ':' + (rest < 10 ? '0' : '') + rest;
}

// A 'yyyy-MM-dd' text in a pattern, with no zone shift.
function dayText_(dateText, pattern) {
  var p = dateText.split('-');
  return Utilities.formatDate(new Date(Date.UTC(Number(p[0]), Number(p[1]) - 1, Number(p[2]))), 'UTC', pattern);
}

function dayLabel_(d, today) {
  if (!isDateText_(d)) return d ? d : 'No date';
  if (d === today) return 'Today';
  if (d === addDays_(today, -1)) return 'Yesterday';
  if (d === addDays_(today, 1)) return 'Tomorrow';
  return dayText_(d, 'EEE d MMM');
}

function esc_(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// User text in the plain-text body: one line, and no angle brackets that could read as markup.
function plain_(v) {
  return String(v == null ? '' : v).replace(/\s+/g, ' ').replace(/</g, '‹').replace(/>/g, '›');
}

function safeColor_(c) {
  return typeof c === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(c) ? c : '#9aa59f';
}

// Logs by project, biggest project first, each project's logs by time.
function logGroups_(logs, projects) {
  var colors = {};
  for (var p = 0; p < projects.length; p++) colors['k' + projects[p].id] = projects[p].color;
  var groups = [];
  var index = {};
  var i;
  for (i = 0; i < logs.length; i++) {
    var name = String(logs[i].project || '') || 'No project';
    var key = 'k' + name;
    if (!index.hasOwnProperty(key)) {
      index[key] = groups.length;
      groups.push({ name: name, color: safeColor_(colors['k' + logs[i].projectId]), minutes: 0, logs: [], order: groups.length });
    }
    var g = groups[index[key]];
    g.minutes += num_(logs[i].minutes);
    g.logs.push(logs[i]);
  }
  for (i = 0; i < groups.length; i++) {
    groups[i].logs.sort(function (a, b) {
      return a.time < b.time ? -1 : a.time > b.time ? 1 : 0;
    });
  }
  groups.sort(function (a, b) {
    return b.minutes - a.minutes || a.order - b.order;
  });
  return groups;
}

// Open tasks by due date: today, then earlier days newest first, then later days, then no date.
function openTaskGroups_(open, today) {
  var byDate = {};
  var dates = [];
  for (var i = 0; i < open.length; i++) {
    var d = isDateText_(open[i].dueDate) ? open[i].dueDate : '';
    if (!byDate.hasOwnProperty('k' + d)) {
      byDate['k' + d] = [];
      dates.push(d);
    }
    byDate['k' + d].push(open[i]);
  }
  function rank(d) {
    if (d === '') return 3;
    if (d === today) return 0;
    return d < today ? 1 : 2;
  }
  dates.sort(function (a, b) {
    var ra = rank(a);
    var rb = rank(b);
    if (ra !== rb) return ra - rb;
    if (ra === 1) return a < b ? 1 : -1;
    return a < b ? -1 : a > b ? 1 : 0;
  });
  var out = [];
  for (var j = 0; j < dates.length; j++) {
    out.push({ label: dayLabel_(dates[j], today), tasks: byDate['k' + dates[j]] });
  }
  return out;
}

function stageNote_(task) {
  if (task.stage === 'blocked') return 'blocked';
  if (task.stage === 'paused') return 'paused';
  if (task.stage === 'in_progress') return 'in progress';
  return '';
}

// ---- HTML (inline styles only) ----

var EM_LABEL = 'font-size:13px;font-weight:bold;letter-spacing:.1em;text-transform:uppercase';

function emailHtml_(m) {
  var h = [];
  h.push('<!doctype html><html lang="en"><head><meta charset="utf-8"><title>WorkPulse</title></head>');
  h.push('<body style="margin:0;background:#e7e3d6;padding:24px;font-family:Arial,Helvetica,sans-serif;color:#1d2b24">');
  h.push('<table role="presentation" width="620" align="center" cellpadding="0" cellspacing="0" style="max-width:620px;margin:0 auto;background:#fbfaf5;border:1px solid #dcd8cb">');

  h.push('<tr><td style="background:#0f3d2e;color:#f4f1e8;padding:18px 24px">');
  h.push('<div style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#afbbb0;font-weight:bold">' + esc_(m.dayLong) + '</div>');
  if (m.noData) {
    h.push('<div style="font-size:30px;font-weight:bold;color:#f2b705;margin-top:6px;line-height:1">No data yet</div>');
    h.push('<div style="font-size:14px;margin-top:8px;color:#f4f1e8">Nothing logged and no clock-in so far today.</div>');
  } else {
    h.push('<div style="font-size:38px;font-weight:bold;color:#f2b705;margin-top:6px;line-height:1">' + esc_(fmtHM_(m.worked)) +
      ' <span style="font-size:15px;color:#f4f1e8;font-weight:normal">worked of ' + esc_(fmtHM_(m.target)) + '</span></div>');
    h.push('<div style="font-size:14px;margin-top:8px;color:#f4f1e8">' + esc_(m.clockLine).replace(/ · /g, ' &nbsp;&middot;&nbsp; ') + '</div>');
  }
  h.push('</td></tr>');

  h.push('<tr><td style="padding:6px 24px 0"><div style="font-size:12px;color:#5d6b63;padding:10px 0;border-bottom:1px solid #dcd8cb">' + esc_(m.dataLine) + '</div></td></tr>');

  h.push('<tr><td style="padding:16px 24px 4px"><div style="' + EM_LABEL + '">Logs &middot; ' + m.logCount + ' &middot; ' + esc_(fmtHM_(m.logMinutes)) + '</div></td></tr>');
  h.push('<tr><td style="padding:0 24px">');
  if (m.groups.length === 0) {
    h.push('<div style="border-top:2px solid #1d2b24;padding-top:8px;font-size:14px;color:#5d6b63">No logs yet today.</div>');
  } else {
    h.push('<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:2px solid #1d2b24">');
    for (var g = 0; g < m.groups.length; g++) {
      var grp = m.groups[g];
      h.push('<tr><td colspan="2" style="padding:' + (g === 0 ? '12px' : '14px') + ' 0 4px;font-size:15px;font-weight:bold"><span style="display:inline-block;width:10px;height:10px;background:' +
        esc_(grp.color) + ';margin-right:8px"></span>' + esc_(grp.name) + ' <span style="color:#5d6b63;font-weight:normal">&middot; ' + esc_(fmtHM_(grp.minutes)) + '</span></td></tr>');
      for (var k = 0; k < grp.logs.length; k++) {
        h.push('<tr><td style="padding:3px 0 3px 18px;font-size:14px">' + esc_(grp.logs[k].description) +
          '</td><td align="right" style="font-size:14px;font-weight:bold;white-space:nowrap">' + esc_(fmtHM_(num_(grp.logs[k].minutes))) + '</td></tr>');
      }
    }
    h.push('</table>');
  }
  h.push('</td></tr>');

  h.push('<tr><td style="padding:22px 24px 4px"><div style="' + EM_LABEL + '">Tasks done today &middot; ' + m.done.length + '</div>');
  if (m.done.length === 0) {
    h.push('<div style="border-top:2px solid #1d2b24;margin-top:6px;font-size:14px;padding-top:8px;color:#5d6b63">None yet.</div>');
  } else {
    var titles = [];
    for (var d = 0; d < m.done.length; d++) titles.push(esc_(m.done[d].title));
    h.push('<div style="border-top:2px solid #1d2b24;margin-top:6px;font-size:14px;line-height:1.7;padding-top:8px;color:#1d2b24">' + titles.join(' &middot; ') + '</div>');
  }
  h.push('</td></tr>');

  h.push('<tr><td style="padding:18px 24px 4px"><div style="' + EM_LABEL + '">Still open &middot; ' + m.openCount + '</div>');
  h.push('<div style="border-top:2px solid #1d2b24;margin-top:6px;padding-top:8px;font-size:14px;line-height:1.7">');
  if (m.openGroups.length === 0) {
    h.push('<span style="color:#5d6b63">Nothing open.</span>');
  }
  for (var o = 0; o < m.openGroups.length; o++) {
    h.push('<div style="font-weight:bold;margin-top:' + (o === 0 ? '0' : '8px') + '">' + esc_(m.openGroups[o].label) + '</div>');
    for (var q = 0; q < m.openGroups[o].tasks.length; q++) {
      var task = m.openGroups[o].tasks[q];
      var note = stageNote_(task);
      h.push('<div style="padding-left:18px">' + esc_(task.title) + (note ? ' <span style="color:#5d6b63">(' + note + ')</span>' : '') + '</div>');
    }
  }
  h.push('</div>');
  if (m.pendingLine) {
    h.push('<div style="font-size:13px;color:#7a5a00;margin-top:8px;font-weight:bold">' + esc_(m.pendingLine) + '</div>');
  }
  h.push('</td></tr>');

  h.push('<tr><td style="padding:22px 24px 20px;font-size:12px;color:#5d6b63;border-top:1px solid #dcd8cb">' + esc_(m.footer) + '</td></tr>');
  h.push('</table></body></html>');
  return h.join('');
}

// ---- Plain text ----

function emailText_(m) {
  var t = [];
  t.push('WorkPulse · ' + m.dayLong);
  if (m.noData) {
    t.push('No data yet. Nothing logged and no clock-in so far today.');
  } else {
    t.push(fmtHM_(m.worked) + ' worked of ' + fmtHM_(m.target));
    t.push(m.clockLine);
  }
  t.push(m.dataLine);
  t.push('');
  t.push('LOGS · ' + m.logCount + ' · ' + fmtHM_(m.logMinutes));
  if (m.groups.length === 0) t.push('No logs yet today.');
  for (var g = 0; g < m.groups.length; g++) {
    t.push(plain_(m.groups[g].name) + ' · ' + fmtHM_(m.groups[g].minutes));
    for (var k = 0; k < m.groups[g].logs.length; k++) {
      t.push('  - ' + plain_(m.groups[g].logs[k].description) + ' (' + fmtHM_(num_(m.groups[g].logs[k].minutes)) + ')');
    }
  }
  t.push('');
  t.push('TASKS DONE TODAY · ' + m.done.length);
  if (m.done.length === 0) t.push('None yet.');
  for (var d = 0; d < m.done.length; d++) t.push('  - ' + plain_(m.done[d].title));
  t.push('');
  t.push('STILL OPEN · ' + m.openCount);
  if (m.openGroups.length === 0) t.push('Nothing open.');
  for (var o = 0; o < m.openGroups.length; o++) {
    t.push(m.openGroups[o].label);
    for (var q = 0; q < m.openGroups[o].tasks.length; q++) {
      var task = m.openGroups[o].tasks[q];
      var note = stageNote_(task);
      t.push('  - ' + plain_(task.title) + (note ? ' (' + note + ')' : ''));
    }
  }
  if (m.pendingLine) t.push(m.pendingLine);
  t.push('');
  t.push(m.footer);
  return t.join('\n');
}
`;
