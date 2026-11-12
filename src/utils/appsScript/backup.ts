// The full backup of the WorkPulse Apps Script (version 4): the desktop sends its backup file text and
// this keeps the newest few copies in the WorkPulse_Backup tab, split into chunks because a Sheets cell
// holds at most 50,000 characters. Plain ES5-style Apps Script text, appended after SCRIPT_EMAIL in
// googleAppsScriptTemplate.ts (it uses the core's helpers: getTab_, writeRows_, checkToken, withLock ...).
//
// Nothing here is callable from google.script.run: every function ends with "_" and is reached only
// through doPost, after the desktop token check.
//
// A copy is written as new rows first, then the backupVersions Script Property is updated, then older
// copies are pruned. A reader goes by that property (under the same lock), so it never sees a copy
// that is still being written; rows of a copy the property does not list are leftovers and are removed
// at the next save.
export const SCRIPT_BACKUP = String.raw`
// =========================================================================
// Version 4: full backup in the Sheet
// =========================================================================

var BACKUP_TAB = 'WorkPulse_Backup';
var BACKUP_CHUNK = 40000;
var BACKUP_KEEP = 3;
var BACKUP_BATCH = 50;
var BACKUP_MAX = 20 * 1024 * 1024;

// The saved copies, oldest first: [{ version, savedAt, counts }].
function backupList_() {
  try {
    var list = JSON.parse(PropertiesService.getScriptProperties().getProperty('backupVersions') || '[]');
    return isArray_(list) ? list : [];
  } catch (err) {
    return [];
  }
}

function backupCounts_(counts) {
  var c = isObject_(counts) ? counts : {};
  return { logs: num_(c.logs), tasks: num_(c.tasks), projects: num_(c.projects) };
}

// Deletes every data row whose Version is not in keep (a map of version text to true). Rows of one copy
// sit together, so runs are deleted from the bottom up.
function pruneBackupRows_(sheet, keep) {
  var last = sheet.getLastRow();
  if (last < 2) return;
  var vals = sheet.getRange(2, 1, last - 1, 1).getValues();
  var end = -1;
  for (var i = vals.length - 1; i >= -1; i--) {
    var drop = i >= 0 && keep[String(vals[i][0])] !== true;
    if (drop) {
      if (end < 0) end = i;
    } else if (end >= 0) {
      var n = end - i;
      // A sheet cannot lose all its rows below the header.
      if (sheet.getMaxRows() - n < 2) sheet.insertRowsAfter(sheet.getMaxRows(), 1);
      sheet.deleteRows(i + 3, n);
      end = -1;
    }
  }
}

function keepMap_(list) {
  var keep = {};
  for (var i = 0; i < list.length; i++) keep[String(list[i].version)] = true;
  return keep;
}

// { token, backup, meta: { counts, exportedAt } }
function saveBackupAction_(c) {
  var check = checkToken(c.token);
  if (!check.ok) return errorOf_(check);
  if (typeof c.backup !== 'string' || c.backup === '') {
    return badRequest_('The backup from your PC was empty. Update WorkPulse and try again.');
  }
  if (c.backup.length > BACKUP_MAX) {
    return badRequest_('This backup is larger than 20 MB, which is too big for the Sheet. Delete old screenshots or logs, or use Download JSON backup.');
  }
  return withLock(function () {
    var sheet = getTab_(BACKUP_TAB);
    var list = backupList_();
    pruneBackupRows_(sheet, keepMap_(list));
    var version = list.length > 0 ? num_(list[list.length - 1].version) + 1 : 1;
    var savedAt = new Date().toISOString();
    var counts = backupCounts_(c.meta && c.meta.counts);
    var total = Math.max(1, Math.ceil(c.backup.length / BACKUP_CHUNK));
    var rows = [];
    for (var i = 0; i < total; i++) {
      rows.push([String(version), String(i), String(total), c.backup.slice(i * BACKUP_CHUNK, (i + 1) * BACKUP_CHUNK), savedAt, i === 0 ? JSON.stringify(counts) : '']);
    }
    var start = Math.max(2, sheet.getLastRow() + 1);
    for (var b = 0; b < rows.length; b += BACKUP_BATCH) {
      writeRows_(sheet, start + b, rows.slice(b, b + BACKUP_BATCH));
    }
    list.push({ version: version, savedAt: savedAt, counts: counts });
    while (list.length > BACKUP_KEEP) list.shift();
    PropertiesService.getScriptProperties().setProperty('backupVersions', JSON.stringify(list));
    pruneBackupRows_(sheet, keepMap_(list));
    return { status: 'ok', version: version, savedAt: savedAt };
  });
}

// { token }: the saved copies, newest first.
function backupInfoAction_(c) {
  var check = checkToken(c.token);
  if (!check.ok) return errorOf_(check);
  return withLock(function () {
    var list = backupList_();
    var versions = [];
    for (var i = list.length - 1; i >= 0; i--) {
      versions.push({ version: list[i].version, savedAt: list[i].savedAt, counts: backupCounts_(list[i].counts) });
    }
    return { status: 'ok', versions: versions };
  });
}

// { token, version? }: the copy put back together (the newest when no version is given).
function loadBackupAction_(c) {
  var check = checkToken(c.token);
  if (!check.ok) return errorOf_(check);
  return withLock(function () {
    var list = backupList_();
    if (list.length === 0) return badRequest_('There is no backup in the Sheet yet.');
    var entry = null;
    for (var i = 0; i < list.length; i++) {
      if (c.version == null ? i === list.length - 1 : num_(list[i].version) === num_(c.version)) entry = list[i];
    }
    if (!entry) return badRequest_('That saved copy is not in the Sheet any more. Pick another one.');
    var broken = badRequest_('That saved copy in the Sheet is incomplete. Pick another one, or back up again from the computer that has your data.');
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(BACKUP_TAB);
    if (!sheet || sheet.getLastRow() < 2) return broken;
    var want = String(entry.version);
    var versions = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
    var first = -1;
    var last = -1;
    for (var r = 0; r < versions.length; r++) {
      if (String(versions[r][0]) === want) {
        if (first < 0) first = r;
        last = r;
      }
    }
    if (first < 0) return broken;
    var block = sheet.getRange(first + 2, 1, last - first + 1, 4).getValues();
    var parts = [];
    var total = 0;
    var seen = 0;
    for (var k = 0; k < block.length; k++) {
      if (String(block[k][0]) !== want) continue;
      total = num_(block[k][2]);
      var idx = num_(block[k][1]);
      if (parts[idx] !== undefined) return broken;
      parts[idx] = String(block[k][3]);
      seen++;
    }
    if (total < 1 || seen !== total) return broken;
    for (var p = 0; p < total; p++) {
      if (parts[p] === undefined) return broken;
    }
    return { status: 'ok', backup: parts.join(''), savedAt: entry.savedAt, version: entry.version };
  });
}
`;
