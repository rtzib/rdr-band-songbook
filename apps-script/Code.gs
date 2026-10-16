/**
 * Rey de Reyes Songbook - backend for the web app (file "Reader.gs" in the RDR Songbook project).
 *
 * - Reads the band's song Google Doc (read-only, never changes it).
 * - Reads and writes events + set lists in the Google Sheet "RDRB - Tracker | Band Events".
 *
 * One-time setup: run setupBand() once. It makes the sheet (in the band's Drive folder if it finds it)
 * and a 4-digit band PIN, and prints both in the Execution log. To change the PIN, put it in NEW_PIN,
 * run changePin(), then set NEW_PIN back to "". The PIN is saved in the script's settings, not in this file.
 *
 * After changing this file: Deploy > Manage deployments > pencil > Version: New version > Deploy (same /exec link).
 */
var DOC_ID = "1h71apax-e4iVCXoxrhq3wtUltAUcRPk51wqIVKMSCT0";
var CACHE_SECONDS = 60;                              // how long a copy of the doc is reused
var SHEET_NAME = "RDRB - Tracker | Band Events";
var BAND_FOLDERS = ["04 – Rey de Reyes Band", "04 - Rey de Reyes Band"];
var NEW_PIN = "";                                    // only used by changePin(); leave empty

function doGet(e) {
  var p = (e && e.parameter) || {};
  var body;
  try {
    if (p.action === "events") body = JSON.stringify(listEvents_());
    else if (p.action === "ping") body = JSON.stringify({ ok: true, pinOk: checkPin_(p.pin) });
    else if (p.action === "save") body = JSON.stringify(checkPin_(p.pin) ? saveEvent_(JSON.parse(p.data || "{}")) : { ok: false, error: "wrong_pin" });
    else if (p.action === "delete") body = JSON.stringify(checkPin_(p.pin) ? deleteEvent_(String(p.id || "")) : { ok: false, error: "wrong_pin" });
    else {
      body = p.fresh ? null : cacheGet_();
      if (!body) { body = JSON.stringify(readDoc_()); cachePut_(body); }
    }
  } catch (err) {
    body = JSON.stringify({ ok: false, error: String(err && err.message || err) });
  }
  var cb = p.callback;
  if (cb && /^[A-Za-z_$][\w$]*$/.test(cb)) {
    return ContentService.createTextOutput(cb + "(" + body + ");").setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(body).setMimeType(ContentService.MimeType.JSON);
}

/* ---------------- one-time setup ---------------- */
function setupBand() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty("EVENTS_SHEET_ID"), ss = null;
  if (id) { try { ss = SpreadsheetApp.openById(id); } catch (e) { ss = null; } }
  if (!ss) {
    ss = SpreadsheetApp.create(SHEET_NAME);
    var ev = ss.getSheets()[0];
    ev.setName("Events");
    ev.getRange(1, 1, 1, 7).setValues([["ID", "Title", "Type", "Date", "Time", "Notes", "Updated"]]).setFontWeight("bold");
    ev.getRange("A:G").setNumberFormat("@");
    ev.setFrozenRows(1);
    var sl = ss.insertSheet("SetList");
    sl.getRange(1, 1, 1, 5).setValues([["EventID", "Order", "SongTitle", "SongID", "Note"]]).setFontWeight("bold");
    sl.getRange("A:E").setNumberFormat("@");
    sl.setFrozenRows(1);
    props.setProperty("EVENTS_SHEET_ID", ss.getId());
    for (var i = 0; i < BAND_FOLDERS.length; i++) {
      var it = DriveApp.getFoldersByName(BAND_FOLDERS[i]);
      if (it.hasNext()) { DriveApp.getFileById(ss.getId()).moveTo(it.next()); break; }
    }
  }
  if (!props.getProperty("BAND_PIN")) props.setProperty("BAND_PIN", String(Math.floor(1000 + Math.random() * 9000)));
  Logger.log("Events sheet: " + ss.getUrl());
  Logger.log("Band PIN: " + props.getProperty("BAND_PIN"));
}

function changePin() {
  if (!/^\d{4,8}$/.test(NEW_PIN)) throw new Error("Put a 4 to 8 digit PIN in NEW_PIN first.");
  PropertiesService.getScriptProperties().setProperty("BAND_PIN", NEW_PIN);
  Logger.log("PIN changed. Now set NEW_PIN back to \"\" and save.");
}

// run from the editor to see what the app will get from the doc
function test() {
  var d = readDoc_();
  Logger.log("Tabs: " + d.tabs.map(function (t) { return t.title + " (" + t.blocks.length + ")"; }).join(", "));
}

/* ---------------- PIN (with a lock-out after many wrong tries) ---------------- */
function checkPin_(pin) {
  var real = PropertiesService.getScriptProperties().getProperty("BAND_PIN");
  if (!real) return false;
  var cache = CacheService.getScriptCache(), bad = parseInt(cache.get("badpin") || "0", 10);
  if (bad >= 20) return false;                       // too many wrong tries: wait an hour
  if (String(pin || "") === real) return true;
  cache.put("badpin", String(bad + 1), 3600);
  return false;
}

/* ---------------- events ---------------- */
function sheet_() {
  var id = PropertiesService.getScriptProperties().getProperty("EVENTS_SHEET_ID");
  if (!id) throw new Error("not_set_up");
  return SpreadsheetApp.openById(id);
}
function cellText_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), "yyyy-MM-dd");
  return String(v == null ? "" : v);
}
function timeText_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), "HH:mm");
  return String(v == null ? "" : v);
}

function listEvents_() {
  var ss = sheet_();
  var ev = ss.getSheetByName("Events").getDataRange().getValues().slice(1);
  var sl = ss.getSheetByName("SetList").getDataRange().getValues().slice(1);
  var byEvent = {};
  sl.forEach(function (r) {
    var id = String(r[0]); if (!id) return;
    (byEvent[id] = byEvent[id] || []).push({ order: Number(r[1]) || 0, title: String(r[2]), id: String(r[3]), note: String(r[4]) });
  });
  var events = ev.filter(function (r) { return String(r[0]); }).map(function (r) {
    var id = String(r[0]);
    var songs = (byEvent[id] || []).sort(function (a, b) { return a.order - b.order; }).map(function (s) { return { id: s.id, title: s.title, note: s.note }; });
    return { id: id, title: String(r[1]), type: String(r[2]), date: cellText_(r[3]), time: timeText_(r[4]), notes: String(r[5]), updated: String(r[6]), songs: songs };
  });
  return { ok: true, events: events };
}

function clean_(s, max) { return String(s == null ? "" : s).replace(/[\u0000-\u001f]+/g, " ").trim().slice(0, max); }

function saveEvent_(e) {
  var title = clean_(e.title, 100), date = clean_(e.date, 10), time = clean_(e.time, 5);
  if (!title) return { ok: false, error: "no_title" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, error: "bad_date" };
  if (time && !/^\d{2}:\d{2}$/.test(time)) return { ok: false, error: "bad_time" };
  var songs = (e.songs || []).slice(0, 60).map(function (s) { return { id: clean_(s.id, 120), title: clean_(s.title, 120), note: clean_(s.note, 200) }; })
    .filter(function (s) { return s.title; });
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var ss = sheet_(), ev = ss.getSheetByName("Events");
    var id = clean_(e.id, 20) || Utilities.getUuid().replace(/-/g, "").slice(0, 10);
    var row = [id, title, clean_(e.type, 30), date, time, clean_(e.notes, 1000), new Date().toISOString()];
    var ids = ev.getRange(1, 1, Math.max(ev.getLastRow(), 1), 1).getValues().map(function (r) { return String(r[0]); });
    var at = ids.indexOf(id);
    var rng = at > 0 ? ev.getRange(at + 1, 1, 1, 7) : ev.getRange(ev.getLastRow() + 1, 1, 1, 7);
    rng.setNumberFormat("@").setValues([row]);
    writeSetList_(ss.getSheetByName("SetList"), id, songs);
    return { ok: true, id: id };
  } finally {
    lock.releaseLock();
  }
}

function deleteEvent_(id) {
  if (!id) return { ok: false, error: "no_id" };
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var ss = sheet_(), ev = ss.getSheetByName("Events");
    var ids = ev.getRange(1, 1, Math.max(ev.getLastRow(), 1), 1).getValues().map(function (r) { return String(r[0]); });
    var at = ids.indexOf(id);
    if (at > 0) ev.deleteRow(at + 1);
    writeSetList_(ss.getSheetByName("SetList"), id, []);
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

// replace one event's songs, keep everyone else's
function writeSetList_(sh, id, songs) {
  var last = sh.getLastRow();
  var keep = last > 1 ? sh.getRange(2, 1, last - 1, 5).getValues().filter(function (r) { return String(r[0]) && String(r[0]) !== id; }) : [];
  songs.forEach(function (s, i) { keep.push([id, String(i + 1), s.title, s.id, s.note]); });
  if (last > 1) sh.getRange(2, 1, last - 1, 5).clearContent();
  if (keep.length) sh.getRange(2, 1, keep.length, 5).setNumberFormat("@").setValues(keep);
}

/* ---------------- the song doc ---------------- */
// the cache holds max ~100 KB per item, so the doc is stored in pieces
function cachePut_(s) {
  try {
    var c = CacheService.getScriptCache(), size = 90000, parts = {}, n = Math.ceil(s.length / size);
    if (n > 20) return;
    for (var i = 0; i < n; i++) parts["doc_" + i] = s.slice(i * size, (i + 1) * size);
    parts["doc_n"] = String(n);
    c.putAll(parts, CACHE_SECONDS);
  } catch (e) {}
}
function cacheGet_() {
  try {
    var c = CacheService.getScriptCache(), n = parseInt(c.get("doc_n"), 10);
    if (!n) return null;
    var keys = []; for (var i = 0; i < n; i++) keys.push("doc_" + i);
    var got = c.getAll(keys), out = "";
    for (var j = 0; j < n; j++) { if (got["doc_" + j] == null) return null; out += got["doc_" + j]; }
    return out;
  } catch (e) { return null; }
}

function readDoc_() {
  var doc = DocumentApp.openById(DOC_ID);
  var tabs = [];
  var top = doc.getTabs ? doc.getTabs() : [];
  if (top && top.length) walkTabs_(top, tabs, "");
  else tabs.push({ title: doc.getName(), blocks: readBody_(doc.getBody()) });
  var updated = "";
  try { updated = DriveApp.getFileById(DOC_ID).getLastUpdated().toISOString(); } catch (e) {}
  return { ok: true, name: doc.getName(), updated: updated, read: new Date().toISOString(), tabs: tabs };
}

function walkTabs_(list, out, parent) {
  list.forEach(function (tab) {
    if (tab.getType() === DocumentApp.TabType.DOCUMENT_TAB) {
      out.push({ title: tab.getTitle(), parent: parent, blocks: readBody_(tab.asDocumentTab().getBody()) });
    }
    var kids = tab.getChildTabs();
    if (kids && kids.length) walkTabs_(kids, out, tab.getTitle());
  });
}

function readBody_(body) {
  var out = [];
  var n = body.getNumChildren();
  for (var i = 0; i < n; i++) {
    var el = body.getChild(i);
    var type = el.getType();
    if (type === DocumentApp.ElementType.PARAGRAPH) {
      var par = el.asParagraph();
      var brk = hasBreak_(par);
      if (brk) out.push({ t: "hr" });
      var text = par.getText();
      if (text || !brk) out.push({ t: "p", text: text, h: String(par.getHeading()) });
    } else if (type === DocumentApp.ElementType.LIST_ITEM) {
      var li = el.asListItem();
      out.push({ t: "li", text: li.getText(), n: li.getNestingLevel() });
    } else if (type === DocumentApp.ElementType.TABLE) {
      var tb = el.asTable(), rows = [];
      for (var r = 0; r < tb.getNumRows(); r++) {
        var row = tb.getRow(r), cells = [];
        for (var c = 0; c < row.getNumCells(); c++) cells.push(row.getCell(c).getText());
        rows.push(cells);
      }
      out.push({ t: "table", rows: rows });
    } else if (type === DocumentApp.ElementType.TABLE_OF_CONTENTS) {
      out.push({ t: "toc" });
    } else if (el.getText) {
      out.push({ t: "p", text: el.getText(), h: "NORMAL" });
    }
  }
  return out;
}

// a paragraph holding a horizontal line or a page break marks the end of a song
function hasBreak_(par) {
  for (var j = 0; j < par.getNumChildren(); j++) {
    var ct = par.getChild(j).getType();
    if (ct === DocumentApp.ElementType.HORIZONTAL_RULE || ct === DocumentApp.ElementType.PAGE_BREAK) return true;
  }
  return false;
}
