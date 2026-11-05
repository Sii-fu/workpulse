export const GOOGLE_APPS_SCRIPT_CODE = `/**
 * =========================================================================
 * WorkPulse - Google Sheets Sync Backend
 * =========================================================================
 * 
 * INSTRUCTIONS TO DEPLOY:
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
 */

function doGet(e) {
  try {
    var action = e.parameter.action || 'ping';
    
    if (action === 'ping') {
      return ContentService.createTextOutput(JSON.stringify({
        status: 'ok',
        message: 'WorkPulse Google Sheets Sync is active and connected!',
        timestamp: new Date().toISOString()
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    if (action === 'getLogs') {
      var sheet = getOrCreateLogsSheet();
      var data = sheet.getDataRange().getValues();
      var logs = [];
      
      if (data.length > 1) {
        var headers = data[0];
        for (var i = 1; i < data.length; i++) {
          var row = data[i];
          var log = {};
          for (var j = 0; j < headers.length; j++) {
            log[headers[j]] = row[j];
          }
          logs.push(log);
        }
      }
      
      return ContentService.createTextOutput(JSON.stringify({
        status: 'ok',
        logs: logs
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      status: 'ok',
      message: 'Unknown action'
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    var contents = {};
    if (e.postData && e.postData.contents) {
      try {
        contents = JSON.parse(e.postData.contents);
      } catch (err) {}
    }
    var action = contents.action || (e.parameter && e.parameter.action) || 'ping';
    
    if (action === 'ping') {
      return ContentService.createTextOutput(JSON.stringify({
        status: 'ok',
        message: 'WorkPulse Google Sheets Sync is active and connected!',
        timestamp: new Date().toISOString()
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    var sheet = getOrCreateLogsSheet();
    
    if (action === 'appendLog') {
      var log = contents.log;
      if (!log) {
        throw new Error('No log payload provided');
      }
      
      sheet.appendRow([
        new Date().toISOString(),
        log.date || '',
        log.time || '',
        log.projectName || '',
        log.description || '',
        log.status || 'completed',
        (log.tags || []).join(', '),
        log.linkUrl || '',
        log.durationMinutes || 0,
        log.energyRating || 0,
        log.imageBase64 ? 'Yes (Image Attached)' : 'None'
      ]);
      
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
          l.imageBase64 ? 'Yes (Image Attached)' : 'None'
        ]);
      }
      
      if (rows.length > 0) {
        sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
      }
      
      return ContentService.createTextOutput(JSON.stringify({
        status: 'ok',
        syncedCount: rows.length
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      status: 'ok',
      message: 'Action completed'
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
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
      'Proof_Attached'
    ];
    sheet.appendRow(headers);
    var headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setFontWeight('bold');
    headerRange.setBackground('#F3F4F6');
    sheet.setFrozenRows(1);
    sheet.autoResizeColumns(1, headers.length);
  }
  
  return sheet;
}
`;
