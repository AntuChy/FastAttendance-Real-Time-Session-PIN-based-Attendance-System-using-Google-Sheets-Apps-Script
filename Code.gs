/**
 * FAST ATTENDANCE — Google Apps Script backend
 * ------------------------------------------------------------------
 * Each section is one TAB in the spreadsheet.
 *   Row 1 (headers): Roll | Name | <date columns added automatically, e.g. 19-May>
 *   Row 2+         : one student per row
 * A tab named "Sessions" is created and managed automatically.
 * ------------------------------------------------------------------
 */

var CONFIG = {
  SPREADSHEET_ID: '',          // leave '' when the script is bound to the sheet
  SESSIONS_SHEET: 'Sessions',
  PRESENT_MARK:  'P',
  ABSENT_MARK:   'A',
  DATE_FORMAT:   'd-MMM'       // produces labels like "19-May"
};

/* ===================== ENTRY POINT ===================== */
function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Fast Attendance')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/* ============== ONE-TIME SETUP (run from editor) ============== */
function setTeacherPassword() {
  // 1) Change the password below.  2) Run this function once.  3) Authorize.
  PropertiesService.getScriptProperties().setProperty('TEACHER_PASSWORD', 'changeme123');
}

/* ===================== HELPERS ===================== */
function ss_() {
  return CONFIG.SPREADSHEET_ID
    ? SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID)
    : SpreadsheetApp.getActiveSpreadsheet();
}
function tz_() { return ss_().getSpreadsheetTimeZone(); }

function todayLabel_() {
  return Utilities.formatDate(new Date(), tz_(), CONFIG.DATE_FORMAT);
}

function normRoll_(v) {                 // "05" and 5 both become "5"
  var s = String(v).trim();
  return /^\d+$/.test(s) ? String(parseInt(s, 10)) : s.toLowerCase();
}

function checkPw_(pw) {
  var stored = PropertiesService.getScriptProperties().getProperty('TEACHER_PASSWORD');
  return !!stored && String(pw) === stored;
}

function findDateColumn_(sheet, label) {
  var lastCol = sheet.getLastColumn();
  if (lastCol < 1) return 0;
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var tz = tz_();
  for (var i = 0; i < headers.length; i++) {
    var h = headers[i];
    var hLabel = (h instanceof Date)
      ? Utilities.formatDate(h, tz, CONFIG.DATE_FORMAT)
      : String(h).trim();
    if (hLabel.toLowerCase() === String(label).toLowerCase()) return i + 1;
  }
  return 0;
}

function ensureDateColumn_(sheet, label) {
  var col = findDateColumn_(sheet, label);
  if (col) return col;
  col = sheet.getLastColumn() + 1;
  sheet.getRange(1, col).setValue(label).setFontWeight('bold');
  return col;
}

function findRollRow_(sheet, roll) {
  var last = sheet.getLastRow();
  if (last < 2) return 0;
  var col = sheet.getRange(2, 1, last - 1, 1).getValues();
  var target = normRoll_(roll);
  for (var i = 0; i < col.length; i++) {
    if (col[i][0] !== '' && normRoll_(col[i][0]) === target) return i + 2;
  }
  return 0;
}

function sessionsSheet_() {
  var ss = ss_();
  var sh = ss.getSheetByName(CONFIG.SESSIONS_SHEET);
  if (!sh) {
    sh = ss.insertSheet(CONFIG.SESSIONS_SHEET);
    sh.appendRow(['Section', 'Date', 'PIN', 'Expiry', 'OpenedAt', 'Status']);
    sh.setFrozenRows(1);
  }
  return sh;
}

function activeSession_(section) {
  var sh = sessionsSheet_();
  if (sh.getLastRow() < 2) return null;
  var rows = sh.getRange(2, 1, sh.getLastRow() - 1, 6).getValues();
  var now = new Date();
  for (var i = rows.length - 1; i >= 0; i--) {            // newest wins
    var sec = rows[i][0], pin = rows[i][2], expiry = rows[i][3], status = rows[i][5];
    if (sec === section && status === 'OPEN' &&
        expiry instanceof Date && expiry > now) {
      return { section: sec, date: rows[i][1], pin: String(pin), expiry: expiry };
    }
  }
  return null;
}

function closeOpenRows_(section) {
  var sh = sessionsSheet_();
  if (sh.getLastRow() < 2) return;
  var rng  = sh.getRange(2, 1, sh.getLastRow() - 1, 6);
  var rows = rng.getValues(), changed = false;
  rows.forEach(function (r) {
    if (r[0] === section && r[5] === 'OPEN') { r[5] = 'CLOSED'; changed = true; }
  });
  if (changed) rng.setValues(rows);
}

/* ===================== CLIENT-CALLED API ===================== */

/** All section tab names (excluding the Sessions tab). */
function getSections() {
  return ss_().getSheets()
    .map(function (s) { return s.getName(); })
    .filter(function (n) { return n !== CONFIG.SESSIONS_SHEET; });
}

/** Sections that currently have an open, non-expired session. */
function getOpenSections() {
  var sh = sessionsSheet_();
  if (sh.getLastRow() < 2) return [];
  var rows = sh.getRange(2, 1, sh.getLastRow() - 1, 6).getValues();
  var now = new Date(), out = [];
  rows.forEach(function (r) {
    if (r[5] === 'OPEN' && r[3] instanceof Date && r[3] > now &&
        out.indexOf(r[0]) < 0) out.push(r[0]);
  });
  return out;
}

/** Roll list for a section's dropdown. */
function getRolls(section) {
  var sheet = ss_().getSheetByName(section);
  if (!sheet || sheet.getLastRow() < 2) return [];
  var vals = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues();
  return vals.filter(function (r) { return String(r[0]).trim() !== ''; })
             .map(function (r) {
               return { roll: String(r[0]).trim(), name: String(r[1] || '').trim() };
             });
}

/** TEACHER: open an attendance session for `minutes`, returns a PIN. */
function openSession(pw, section, minutes) {
  if (!checkPw_(pw)) return { ok: false, msg: 'Wrong teacher password.' };
  var sheet = ss_().getSheetByName(section);
  if (!sheet) return { ok: false, msg: 'Section "' + section + '" not found.' };
  minutes = Math.max(1, Math.min(240, Number(minutes) || 10));

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    closeOpenRows_(section);                       // only one open session per section
    var label = todayLabel_();
    ensureDateColumn_(sheet, label);               // create today's column up front
    var pin    = String(Math.floor(1000 + Math.random() * 9000));
    var expiry = new Date(Date.now() + minutes * 60000);
    sessionsSheet_().appendRow([section, label, pin, expiry, new Date(), 'OPEN']);
    return { ok: true, section: section, date: label, pin: pin,
             expiry: expiry.getTime(), minutes: minutes,
             msg: 'Session open for ' + minutes + ' minute(s).' };
  } finally { lock.releaseLock(); }
}

/** TEACHER: close the open session for a section. */
function closeSession(pw, section) {
  if (!checkPw_(pw)) return { ok: false, msg: 'Wrong teacher password.' };
  closeOpenRows_(section);
  return { ok: true, msg: 'Session closed for ' + section + '.' };
}

/** STUDENT: mark a roll Present. The core "find row, find column, write P". */
function markPresent(section, roll, pin) {
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var sess = activeSession_(section);
    if (!sess) return { ok: false,
      msg: 'No open session for this section. Ask your teacher to start one.' };
    if (String(pin).trim() !== sess.pin)
      return { ok: false, msg: 'Incorrect session PIN.' };

    var sheet = ss_().getSheetByName(section);
    if (!sheet) return { ok: false, msg: 'Section not found.' };

    var col = ensureDateColumn_(sheet, todayLabel_());
    if (!col) return { ok: false, msg: 'Date column "' + sess.date + '" missing.' };

    var row = findRollRow_(sheet, roll);
    if (!row) return { ok: false,
      msg: 'Roll "' + roll + '" not found in ' + section + '.' };

    var cell = sheet.getRange(row, col);
    if (String(cell.getValue()).trim().toUpperCase() === CONFIG.PRESENT_MARK)
      return { ok: true, already: true,
        msg: 'Roll ' + roll + ' is already Present for ' + sess.date + '.' };

    cell.setValue(CONFIG.PRESENT_MARK);
    return { ok: true,
      msg: 'Roll ' + roll + ' marked Present for ' + sess.date + '.' };
  } finally { lock.releaseLock(); }
}

/** TEACHER: live present / absent breakdown. */
function sessionStatus(pw, section) {
  if (!checkPw_(pw)) return { ok: false, msg: 'Wrong teacher password.' };
  var sheet = ss_().getSheetByName(section);
  if (!sheet) return { ok: false, msg: 'Section not found.' };
  var sess  = activeSession_(section);
  var label = sess ? sess.date : todayLabel_();
  var col   = findDateColumn_(sheet, label);
  var last  = sheet.getLastRow();
  var present = [], absent = [];
  if (last >= 2) {
    var rolls = sheet.getRange(2, 1, last - 1, 1).getValues();
    var marks = col ? sheet.getRange(2, col, last - 1, 1).getValues() : null;
    for (var i = 0; i < rolls.length; i++) {
      var roll = String(rolls[i][0]).trim();
      if (!roll) continue;
      var m = marks ? String(marks[i][0]).trim().toUpperCase() : '';
      (m === CONFIG.PRESENT_MARK ? present : absent).push(roll);
    }
  }
  return { ok: true, date: label, total: present.length + absent.length,
           presentCount: present.length, present: present, absent: absent,
           open: !!sess, expiry: sess ? sess.expiry.getTime() : 0 };
}

/** TEACHER: write A in every blank cell for today (run after the session). */
function markRemainingAbsent(pw, section) {
  if (!checkPw_(pw)) return { ok: false, msg: 'Wrong teacher password.' };
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var sheet = ss_().getSheetByName(section);
    if (!sheet) return { ok: false, msg: 'Section not found.' };
    var col  = ensureDateColumn_(sheet, todayLabel_());
    var last = sheet.getLastRow();
    if (last < 2) return { ok: true, msg: 'No students.' };
    var rolls = sheet.getRange(2, 1, last - 1, 1).getValues();
    var rng   = sheet.getRange(2, col, last - 1, 1);
    var vals  = rng.getValues(), n = 0;
    for (var i = 0; i < vals.length; i++) {
      if (String(rolls[i][0]).trim() === '') continue;
      if (String(vals[i][0]).trim().toUpperCase() !== CONFIG.PRESENT_MARK) {
        vals[i][0] = CONFIG.ABSENT_MARK; n++;
      }
    }
    rng.setValues(vals);
    return { ok: true, msg: 'Marked ' + n + ' student(s) Absent for ' + todayLabel_() + '.' };
  } finally { lock.releaseLock(); }
}

/** TEACHER: create a new section tab with an optional roll list. */
function createSection(pw, name, rollsText) {
  if (!checkPw_(pw)) return { ok: false, msg: 'Wrong teacher password.' };
  name = String(name).trim();
  if (!name) return { ok: false, msg: 'Section name required.' };
  var ss = ss_();
  if (ss.getSheetByName(name))
    return { ok: false, msg: 'A section "' + name + '" already exists.' };
  var sheet = ss.insertSheet(name);
  sheet.getRange(1, 1, 1, 2).setValues([['Roll', 'Name']]).setFontWeight('bold');
  sheet.setFrozenRows(1);
  sheet.setFrozenColumns(2);
  var lines = String(rollsText || '').split(/\r?\n/)
                .map(function (l) { return l.trim(); })
                .filter(Boolean);
  if (lines.length) {
    var data = lines.map(function (l) {
      var idx = l.indexOf(',');
      return idx < 0 ? [l, ''] : [l.slice(0, idx).trim(), l.slice(idx + 1).trim()];
    });
    sheet.getRange(2, 1, data.length, 2).setValues(data);
  }
  return { ok: true,
    msg: 'Section "' + name + '" created with ' + lines.length + ' student(s).' };
}
