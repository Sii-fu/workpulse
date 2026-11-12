import { SCRIPT_CORE } from './appsScript/core';
import { SCRIPT_EMAIL } from './appsScript/email';
import { SCRIPT_PHONE } from './appsScript/phonePage';
import { SCRIPT_BACKUP } from './appsScript/backup';

const HEADER = `/**
 * =========================================================================
 * WorkPulse - Google Sheets Sync Backend (version 3)
 * =========================================================================
 *
 * INSTRUCTIONS TO DEPLOY (first time):
 * 1. In your Google Sheet, click on "Extensions" > "Apps Script".
 * 2. Delete all existing code in the editor, and paste this entire script.
 * 3. Click the disk icon (Save).
 * 4. Click the blue "Deploy" button (top right) > "New deployment".
 * 5. Click the gear icon next to "Select type" and choose "Web app".
 * 6. Set:
 *    - Description: "WorkPulse Sync API"
 *    - Execute as: "Me (your email)"
 *    - Who has access: "Anyone" (crucial for WorkPulse to connect)
 * 7. Click "Deploy". Grant permissions if prompted by Google.
 * 8. Copy the "Web app URL" (ends in /exec) and paste it into WorkPulse Settings!
 *
 * UPDATING FROM AN OLDER VERSION (keeps your link working):
 * 1. Paste this entire script over the old code and click Save.
 * 2. Click "Deploy" > "Manage deployments", click the pencil (edit) icon on your
 *    existing deployment, set "Version" to "New version" and click "Deploy".
 *    Do NOT use "New deployment": it makes a new URL and breaks the link saved in WorkPulse.
 * 3. Google asks for permissions again. This version can also send you an evening
 *    email (to your own address) and run a daily timer for it; allow both.
 * 4. In WorkPulse Settings, set the phone PIN.
 */
`;

// The log sync code of version 2, unchanged: appendLog / batchSync into the 12-column WorkPulse_Logs tab
// with the Id upsert. doPost (in SCRIPT_CORE) hands every action it does not know to handleLogAction_.
const LOGS_SCRIPT = `
function handleLogAction_(action, contents) {
  var sheet = getOrCreateLogsSheet();

  if (action === 'appendLog') {
    var log = contents.log;
    if (!log) {
      throw new Error('No log payload provided');
    }

    upsertRows(sheet, [[
      log.createdAt || new Date().toISOString(),
      log.date || '',
      log.time || '',
      log.projectName || '',
      log.description || '',
      log.status || 'completed',
      (log.tags || []).join(', '),
      log.linkUrl || '',
      log.durationMinutes || 0,
      log.energyRating || 0,
      log.imageBase64 ? 'Yes (Image Attached)' : 'None',
      log.id || ''
    ]]);

    return ContentService.createTextOutput(JSON.stringify({
      status: 'ok',
      message: 'Log successfully saved to Google Sheet',
      id: log.id
    })).setMimeType(ContentService.MimeType.JSON);
  }

  if (action === 'batchSync') {
    var logs = contents.logs || [];
    var rows = [];

    for (var i = 0; i < logs.length; i++) {
      var l = logs[i];
      rows.push([
        l.createdAt || new Date().toISOString(),
        l.date || '',
        l.time || '',
        l.projectName || '',
        l.description || '',
        l.status || 'completed',
        (l.tags || []).join(', '),
        l.linkUrl || '',
        l.durationMinutes || 0,
        l.energyRating || 0,
        l.imageBase64 ? 'Yes (Image Attached)' : 'None',
        l.id || ''
      ]);
    }

    upsertRows(sheet, rows);

    return ContentService.createTextOutput(JSON.stringify({
      status: 'ok',
      syncedCount: rows.length
    })).setMimeType(ContentService.MimeType.JSON);
  }

  return ContentService.createTextOutput(JSON.stringify({
    status: 'ok',
    message: 'Action completed'
  })).setMimeType(ContentService.MimeType.JSON);
}

function getOrCreateLogsSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('WorkPulse_Logs');

  if (!sheet) {
    sheet = ss.insertSheet('WorkPulse_Logs');
    var headers = [
      'Timestamp',
      'Date',
      'Time',
      'Project',
      'Description',
      'Status',
      'Tags',
      'Link',
      'Duration_Minutes',
      'Energy_Rating',
      'Proof_Attached',
      'Id'
    ];
    sheet.appendRow(headers);
    var headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setFontWeight('bold');
    headerRange.setBackground('#F3F4F6');
    sheet.setFrozenRows(1);
    sheet.autoResizeColumns(1, headers.length);
  }

  // Older sheets: make sure the Id column (12th) exists and has its header.
  if (sheet.getMaxColumns() < ID_COL) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), ID_COL - sheet.getMaxColumns());
  }
  if (!sheet.getRange(1, ID_COL).getValue()) {
    sheet.getRange(1, ID_COL).setValue('Id').setFontWeight('bold').setBackground('#F3F4F6');
  }

  return sheet;
}

// Column 12 holds the WorkPulse log id. Rows are updated in place when the id already exists,
// so sending the same log twice never creates a duplicate row.
var ID_COL = 12;

function upsertRows(sheet, rows) {
  if (rows.length === 0) return;
  var index = {};
  var last = sheet.getLastRow();
  if (last >= 2) {
    var ids = sheet.getRange(2, ID_COL, last - 1, 1).getValues();
    for (var i = 0; i < ids.length; i++) {
      if (ids[i][0]) index[ids[i][0]] = i + 2;
    }
  }
  var fresh = [];
  for (var r = 0; r < rows.length; r++) {
    var id = rows[r][ID_COL - 1];
    if (id && index[id]) {
      sheet.getRange(index[id], 1, 1, rows[r].length).setValues([rows[r]]);
    } else {
      fresh.push(rows[r]);
    }
  }
  if (fresh.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, fresh.length, fresh[0].length).setValues(fresh);
  }
}
`;

export const GOOGLE_APPS_SCRIPT_CODE = HEADER + LOGS_SCRIPT + SCRIPT_CORE + SCRIPT_EMAIL + SCRIPT_BACKUP + SCRIPT_PHONE;
