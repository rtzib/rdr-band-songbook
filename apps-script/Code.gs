/**
 * Rey de Reyes Songbook - backend for the web app (file "Reader.gs" in the RDR Songbook Apps Script project).
 *
 * Everything lives in one Google Sheet that works like a database (tabs):
 *   Songs, Albums, Artists, Genres, Themes, EventTypes, Members, Events, SetList
 * A song has one genre (the rhythm, like Soca) and any number of themes (the occasion, like Wedding), saved as "Wedding, Birthday".
 * The app reads it all at once (action=data) and writes with the band PIN.
 *
 * One-time setup:
 *   - setupBand()       makes the sheet (if missing), all tabs, and the band PIN. Prints both in the Execution log.
 *   - migrateFromDoc()  copies the songs from the old song Google Doc into the Songs tab (skips songs already there).
 * Change the PIN: put it in NEW_PIN, run changePin(), then set NEW_PIN back to "".
 * After changing this file: Deploy > Manage deployments > pencil > Version: New version > Deploy (same /exec link).
 * The PIN is saved in the script's settings, not in this file, so this file is safe on GitHub.
 */
var DOC_ID = "1h71apax-e4iVCXoxrhq3wtUltAUcRPk51wqIVKMSCT0";   // old song doc (only used by migrateFromDoc)
var CACHE_SECONDS = 60;
var SHEET_NAME = "RDRB - Tracker | Band Database";
var BAND_FOLDERS = ["04 – Rey de Reyes Band", "04 - Rey de Reyes Band"];
var NEW_PIN = "";                                                 // only used by changePin(); leave empty

var TABLES = {
  Songs:   ["ID", "Title", "Album", "Type", "Artist", "Key", "BPM", "Time", "Genre", "Themes", "Link", "Lyrics", "Created", "Updated"],
  Albums:  ["Name", "Year"],
  Artists: ["Name"],
  Genres:  ["Name"],
  Themes:  ["Name"],
  EventTypes: ["Name"],
  Members: ["ID", "Name", "Instruments", "Active"],
  Events:  ["ID", "Title", "Type", "Date", "Time", "Location", "Notes", "Updated", "Players", "Status", "StatusNote"],
  SetList: ["EventID", "Order", "SongTitle", "SongID", "Note", "Key"]
};
var START_GENRES = ["Adoracion", "Balada", "Cumbia", "Jubilo", "Parranda", "Punta", "Reggae", "Rock", "Soca", "Waltz"];
var START_THEMES = ["Birthday", "September Celebration", "Wedding"];
var START_EVENT_TYPES = ["Service", "Rehearsal", "Wedding", "Campaign", "Youth", "Funeral", "Birthday", "Other"];
var START_ARTISTS = ["Rey de Reyes Band", "Ilasmos", "Juan Carlos Alvarado", "Marcos Witt", "Miel San Marcos", "Miguel Leal"];
var BAND_ARTIST = "Rey de Reyes Band";

/* ================= web entry point ================= */
function doGet(e) {
  var p = (e && e.parameter) || {};
  var body;
  try {
    var a = p.action || "";
    var needPin = { save: 1, "delete": 1, part: 1, savesong: 1, deletesong: 1, listop: 1 };
    if (needPin[a] && !checkPin_(p.pin)) body = JSON.stringify({ ok: false, error: "wrong_pin" });
    else if (a === "data") body = dataJson_(p.fresh);
    else if (a === "events") body = JSON.stringify({ ok: true, events: listEvents_() });
    else if (a === "ping") body = JSON.stringify({ ok: true, pinOk: checkPin_(p.pin) });
    else if (a === "part") body = JSON.stringify(savePart_(p));
    else if (a === "save") body = JSON.stringify(write_(function () { return saveEvent_(payload_(p)); }));
    else if (a === "delete") body = JSON.stringify(write_(function () { return deleteEvent_(String(p.id || "")); }));
    else if (a === "savesong") body = JSON.stringify(write_(function () { return saveSong_(payload_(p)); }));
    else if (a === "deletesong") body = JSON.stringify(write_(function () { return deleteSong_(String(p.id || "")); }));
    else if (a === "listop") body = JSON.stringify(write_(function () { return listOp_(payload_(p)); }));
    else body = JSON.stringify({ ok: false, error: "old_app", message: "Please reload the app to get the newest version." });
  } catch (err) {
    body = JSON.stringify({ ok: false, error: String(err && err.message || err) });
  }
  var cb = p.callback;
  if (cb && /^[A-Za-z_$][\w$]*$/.test(cb)) {
    return ContentService.createTextOutput(cb + "(" + body + ");").setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(body).setMimeType(ContentService.MimeType.JSON);
}

function payload_(p) { return JSON.parse(p.data || joinParts_(p.key) || "{}"); }

// every change: one at a time, then forget the cached copy so everyone sees it
function write_(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try { var r = fn(); cacheClear_(); return r; }
  finally { lock.releaseLock(); }
}

/* ================= setup ================= */
function setupBand() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty("EVENTS_SHEET_ID"), ss = null;
  if (id) { try { ss = SpreadsheetApp.openById(id); } catch (e) { ss = null; } }
  if (!ss) {
    ss = SpreadsheetApp.create(SHEET_NAME);
    props.setProperty("EVENTS_SHEET_ID", ss.getId());
    for (var i = 0; i < BAND_FOLDERS.length; i++) {
      var it = DriveApp.getFoldersByName(BAND_FOLDERS[i]);
      if (it.hasNext()) { DriveApp.getFileById(ss.getId()).moveTo(it.next()); break; }
    }
  }
  if (ss.getName() !== SHEET_NAME) ss.rename(SHEET_NAME);
  Object.keys(TABLES).forEach(function (t) { table_(ss, t); });
  var first = ss.getSheets()[0];
  if (first.getName() === "Sheet1" && first.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(first);
  // starting lists
  var g = rows_(ss, "Genres").map(function (r) { return low_(r.Name); });
  START_GENRES.forEach(function (n) { if (g.indexOf(low_(n)) < 0) appendRow_(ss, "Genres", { Name: n }); });
  var ar = rows_(ss, "Artists").map(function (r) { return low_(r.Name); });
  START_ARTISTS.forEach(function (n) { if (ar.indexOf(low_(n)) < 0) appendRow_(ss, "Artists", { Name: n }); });
  START_THEMES.forEach(function (n) { addToList_(ss, "Themes", n); });
  eventTypes_(ss);
  if (!props.getProperty("BAND_PIN")) props.setProperty("BAND_PIN", String(Math.floor(1000 + Math.random() * 9000)));
  cacheClear_();
  Logger.log("Database sheet: " + ss.getUrl());
  Logger.log("Band PIN: " + props.getProperty("BAND_PIN"));
}

function changePin() {
  if (!/^\d{4,8}$/.test(NEW_PIN)) throw new Error("Put a 4 to 8 digit PIN in NEW_PIN first.");
  PropertiesService.getScriptProperties().setProperty("BAND_PIN", NEW_PIN);
  Logger.log("PIN changed. Now set NEW_PIN back to \"\" and save.");
}

/* ================= PIN ================= */
function checkPin_(pin) {
  var real = PropertiesService.getScriptProperties().getProperty("BAND_PIN");
  if (!real) return false;
  var cache = CacheService.getScriptCache(), bad = parseInt(cache.get("badpin") || "0", 10);
  if (bad >= 20) return false;                                   // too many wrong tries: wait an hour
  if (String(pin || "") === real) return true;
  cache.put("badpin", String(bad + 1), 3600);
  return false;
}

/* ================= tables (find columns by header name) ================= */
function sheet_() {
  var id = PropertiesService.getScriptProperties().getProperty("EVENTS_SHEET_ID");
  if (!id) throw new Error("not_set_up");
  return SpreadsheetApp.openById(id);
}
function table_(ss, name) {
  var cols = TABLES[name], sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, cols.length).setValues([cols]).setFontWeight("bold");
    sh.getRange(1, 1, sh.getMaxRows(), cols.length).setNumberFormat("@");
    sh.setFrozenRows(1);
  }
  var lastCol = Math.max(sh.getLastColumn(), 1);
  var head = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) { return String(h).trim(); });
  cols.forEach(function (c) {
    if (head.indexOf(c) < 0) {
      var blank = head.indexOf("");
      var at = blank >= 0 ? blank : head.length;
      head[at] = c;
      sh.getRange(1, at + 1).setValue(c).setFontWeight("bold");
      sh.getRange(1, at + 1, sh.getMaxRows(), 1).setNumberFormat("@");
    }
  });
  var map = {};
  head.forEach(function (h, i) { if (h) map[h] = i; });
  return { sh: sh, map: map, n: head.length };
}
function text_(v, isTime) {
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), isTime ? "HH:mm" : "yyyy-MM-dd");
  return String(v == null ? "" : v);
}
function rows_(ss, name) {
  var t = table_(ss, name), last = t.sh.getLastRow();
  if (last < 2) return [];
  var vals = t.sh.getRange(2, 1, last - 1, t.n).getValues();
  return vals.map(function (r, i) {
    var o = { _row: i + 2 };
    Object.keys(t.map).forEach(function (k) { o[k] = text_(r[t.map[k]], k === "Time"); });
    return o;
  });
}
function appendRow_(ss, name, obj) {
  var t = table_(ss, name), row = new Array(t.n).fill("");
  Object.keys(obj).forEach(function (k) { if (t.map[k] != null) row[t.map[k]] = obj[k]; });
  t.sh.getRange(t.sh.getLastRow() + 1, 1, 1, t.n).setNumberFormat("@").setValues([row]);
}
function updateRow_(ss, name, rowNum, obj) {
  var t = table_(ss, name), rng = t.sh.getRange(rowNum, 1, 1, t.n), row = rng.getValues()[0];
  Object.keys(obj).forEach(function (k) { if (t.map[k] != null) row[t.map[k]] = obj[k]; });
  rng.setNumberFormat("@").setValues([row]);
}
function clean_(s, max) { return String(s == null ? "" : s).replace(/[\u0000-\u0009\u000b-\u001f]+/g, " ").trim().slice(0, max); }
function low_(s) { return String(s || "").toLowerCase().replace(/\s+/g, " ").trim(); }
function norm_(s) { return String(s || "").replace(/&/g, " y ").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[’'\x60´]/g, "").replace(/[^a-z0-9#]+/g, " ").trim(); }
function slug_(s) { return norm_(s).replace(/#/g, "").replace(/\s+/g, "-") || "song"; }

/* ================= read everything ================= */
function dataJson_(fresh) {
  var body = fresh ? null : cacheGet_();
  if (body) return body;
  var ss = sheet_();
  var songs = rows_(ss, "Songs").filter(function (r) { return r.ID && r.Title; }).map(function (r) {
    return { id: r.ID, title: r.Title, album: r.Album, type: r.Type || "Original", artist: r.Artist, key: r.Key, bpm: r.BPM, time: r.Time,
             genre: r.Genre, themes: themes_(r.Themes), link: r.Link, lyrics: r.Lyrics, updated: r.Updated };
  });
  var albums = rows_(ss, "Albums").filter(function (r) { return r.Name; }).map(function (r) { return { name: r.Name, year: r.Year }; });
  var artists = rows_(ss, "Artists").filter(function (r) { return r.Name; }).map(function (r) { return r.Name; });
  var genres = rows_(ss, "Genres").filter(function (r) { return r.Name; }).map(function (r) { return r.Name; });
  var themes = rows_(ss, "Themes").filter(function (r) { return r.Name; }).map(function (r) { return r.Name; });
  var eventTypes = eventTypes_(ss);
  var members = rows_(ss, "Members").filter(function (r) { return r.ID && r.Name; }).map(function (r) {
    return { id: r.ID, name: r.Name, instruments: r.Instruments, active: r.Active !== "no" };
  });
  body = JSON.stringify({ ok: true, version: 2, read: new Date().toISOString(), songs: songs, albums: albums, artists: artists, genres: genres, themes: themes, eventTypes: eventTypes, members: members, events: listEvents_(ss) });
  cachePut_(body);
  return body;
}

/* ================= songs ================= */
function saveSong_(s) {
  var ss = sheet_();
  var title = clean_(s.title, 100);
  if (!title) return { ok: false, error: "no_title" };
  var all = rows_(ss, "Songs");
  var id = clean_(s.id, 120);
  var mine = id ? all.filter(function (r) { return r.ID === id; })[0] : null;
  if (all.some(function (r) { return r.ID !== id && norm_(r.Title) === norm_(title); })) return { ok: false, error: "exists" };
  var vals = {
    Title: title, Album: clean_(s.album, 100), Type: /cover/i.test(s.type || "") ? "Cover" : "Original", Artist: clean_(s.artist, 80),
    Key: clean_(s.key, 10), BPM: clean_(s.bpm, 5).replace(/[^\d]/g, ""), Time: clean_(s.time, 6), Genre: clean_(s.genre, 40),
    Themes: themesText_(s.themes), Link: clean_(s.link, 500), Lyrics: String(s.lyrics || "").replace(/\r\n?/g, "\n").slice(0, 40000), Updated: new Date().toISOString()
  };
  if (mine) { updateRow_(ss, "Songs", mine._row, vals); }
  else {
    var base = slug_(title), newId = base, k = 2, ids = all.map(function (r) { return r.ID; });
    while (ids.indexOf(newId) >= 0) newId = base + "-" + (k++);
    id = newId; vals.ID = id; vals.Created = vals.Updated;
    appendRow_(ss, "Songs", vals);
  }
  addToList_(ss, "Artists", vals.Artist);
  addToList_(ss, "Genres", vals.Genre);
  themes_(vals.Themes).forEach(function (t) { addToList_(ss, "Themes", t); });
  if (vals.Album && !rows_(ss, "Albums").some(function (r) { return low_(r.Name) === low_(vals.Album); })) appendRow_(ss, "Albums", { Name: vals.Album });
  return { ok: true, id: id };
}
function deleteSong_(id) {
  var ss = sheet_(), r = rows_(ss, "Songs").filter(function (x) { return x.ID === id; })[0];
  if (!r) return { ok: false, error: "not_found" };
  table_(ss, "Songs").sh.deleteRow(r._row);
  return { ok: true };
}
// themes are saved in one cell as "Wedding, Birthday"
function themes_(v) {
  var seen = {}, out = [];
  (Array.isArray(v) ? v : String(v || "").split(",")).forEach(function (t) { t = clean_(t, 40).replace(/,/g, ""); if (t && !seen[low_(t)]) { seen[low_(t)] = 1; out.push(t); } });
  return out.slice(0, 12);
}
function themesText_(v) { return themes_(v).join(", "); }
function addToList_(ss, name, value) {
  if (!value) return;
  if (!rows_(ss, name).some(function (r) { return low_(r.Name) === low_(value); })) appendRow_(ss, name, { Name: value });
}

/* ================= event types ================= */
// the first time, fill the EventTypes tab with the starting list (and any type an event already uses)
// locked: true when called from inside write_ (it already holds the lock)
function eventTypes_(ss, locked) {
  function names() { return rows_(ss, "EventTypes").filter(function (r) { return r.Name; }).map(function (r) { return r.Name; }); }
  var list = names();
  if (list.length) return list;
  var lock = locked ? null : LockService.getScriptLock();
  if (lock && !lock.tryLock(10000)) return START_EVENT_TYPES.slice();
  try {
    list = names();
    if (list.length) return list;
    var all = START_EVENT_TYPES.slice();
    rows_(ss, "Events").forEach(function (r) { var t = clean_(r.Type, 30); if (t && !all.some(function (x) { return low_(x) === low_(t); })) all.push(t); });
    all.forEach(function (n) { appendRow_(ss, "EventTypes", { Name: n }); });
    return all;
  } finally { if (lock) lock.releaseLock(); }
}
function eventTypeOp_(ss, d) {
  var op = String(d.op || ""), name = clean_(d.name, 30), old = clean_(d.old, 30);
  eventTypes_(ss, true);
  var list = rows_(ss, "EventTypes"), events = rows_(ss, "Events");
  if (op === "add") {
    if (!name) return { ok: false, error: "no_name" };
    if (list.some(function (r) { return low_(r.Name) === low_(name); })) return { ok: false, error: "exists" };
    appendRow_(ss, "EventTypes", { Name: name });
    return { ok: true };
  }
  var row = list.filter(function (r) { return low_(r.Name) === low_(old); })[0];
  if (!row) return { ok: false, error: "not_found" };
  function uses(e) { return low_(e.Type) === low_(old); }
  if (op === "rename") {
    if (!name) return { ok: false, error: "no_name" };
    if (low_(name) !== low_(old) && list.some(function (r) { return low_(r.Name) === low_(name); })) return { ok: false, error: "exists" };
    updateRow_(ss, "EventTypes", row._row, { Name: name });
    events.forEach(function (e) { if (uses(e)) updateRow_(ss, "Events", e._row, { Type: name }); });
    return { ok: true };
  }
  if (op === "delete") {
    var used = events.filter(uses).length;
    if (used && !d.force) return { ok: false, error: "in_use", count: used };
    table_(ss, "EventTypes").sh.deleteRow(row._row);
    events.forEach(function (e) { if (uses(e)) updateRow_(ss, "Events", e._row, { Type: "" }); });
    return { ok: true };
  }
  return { ok: false, error: "bad_op" };
}

/* ================= albums / artists / genres / members ================= */
function listOp_(d) {
  var ss = sheet_(), kind = String(d.kind || ""), op = String(d.op || "");
  if (kind === "EventTypes") return eventTypeOp_(ss, d);
  var name = clean_(d.name, 100), old = clean_(d.old, 100);
  var songCol = { Albums: "Album", Artists: "Artist", Genres: "Genre", Themes: "Themes" }[kind];
  // a song can have many themes, so check and change them one by one
  function uses(s) { return kind === "Themes" ? themes_(s.Themes).some(function (t) { return low_(t) === low_(old); }) : low_(s[songCol]) === low_(old); }
  function swap(s, to) {
    var o = {};
    if (kind === "Themes") o.Themes = themesText_(themes_(s.Themes).map(function (t) { return low_(t) === low_(old) ? to : t; }));
    else o[songCol] = to;
    updateRow_(ss, "Songs", s._row, o);
  }
  if (kind === "Members") {
    var mem = rows_(ss, "Members");
    if (op === "add") {
      if (!name) return { ok: false, error: "no_name" };
      appendRow_(ss, "Members", { ID: Utilities.getUuid().replace(/-/g, "").slice(0, 8), Name: name, Instruments: clean_(d.instruments, 120), Active: "yes" });
      return { ok: true };
    }
    var m = mem.filter(function (r) { return r.ID === d.id; })[0];
    if (!m) return { ok: false, error: "not_found" };
    if (op === "update") { updateRow_(ss, "Members", m._row, { Name: name || m.Name, Instruments: clean_(d.instruments, 120), Active: d.active === false ? "no" : "yes" }); return { ok: true }; }
    if (op === "delete") { table_(ss, "Members").sh.deleteRow(m._row); return { ok: true }; }
    return { ok: false, error: "bad_op" };
  }
  if (!songCol) return { ok: false, error: "bad_kind" };
  var list = rows_(ss, kind);
  if (op === "add") {
    if (!name) return { ok: false, error: "no_name" };
    if (list.some(function (r) { return low_(r.Name) === low_(name); })) return { ok: false, error: "exists" };
    appendRow_(ss, kind, kind === "Albums" ? { Name: name, Year: clean_(d.year, 4) } : { Name: name });
    return { ok: true };
  }
  var row = list.filter(function (r) { return low_(r.Name) === low_(old); })[0];
  if (!row) return { ok: false, error: "not_found" };
  var songs = rows_(ss, "Songs");
  if (op === "rename") {
    if (!name) return { ok: false, error: "no_name" };
    if (low_(name) !== low_(old) && list.some(function (r) { return low_(r.Name) === low_(name); })) return { ok: false, error: "exists" };
    updateRow_(ss, kind, row._row, kind === "Albums" ? { Name: name, Year: d.year != null ? clean_(d.year, 4) : row.Year } : { Name: name });
    songs.forEach(function (s) { if (uses(s)) swap(s, name); });
    return { ok: true };
  }
  if (op === "delete") {
    var used = songs.filter(uses).length;
    if (used && !d.force) return { ok: false, error: "in_use", count: used };
    table_(ss, kind).sh.deleteRow(row._row);
    songs.forEach(function (s) { if (uses(s)) swap(s, ""); });
    return { ok: true };
  }
  return { ok: false, error: "bad_op" };
}

/* ================= events ================= */
function listEvents_(ss) {
  ss = ss || sheet_();
  var byEvent = {};
  rows_(ss, "SetList").forEach(function (r) {
    if (!r.EventID) return;
    (byEvent[r.EventID] = byEvent[r.EventID] || []).push({ order: Number(r.Order) || 0, title: r.SongTitle, id: r.SongID, note: r.Note, key: r.Key });
  });
  return rows_(ss, "Events").filter(function (r) { return r.ID; }).map(function (r) {
    var players = [];
    try { players = r.Players ? JSON.parse(r.Players) : []; } catch (e) { players = []; }
    return { id: r.ID, title: r.Title, type: r.Type, date: r.Date, time: r.Time, location: r.Location, notes: r.Notes, updated: r.Updated, players: players,
             status: /cancel/i.test(r.Status || "") ? "canceled" : "", statusNote: r.StatusNote || "",
             songs: (byEvent[r.ID] || []).sort(function (a, b) { return a.order - b.order; }).map(function (s) { return { id: s.id, title: s.title, note: s.note, key: s.key }; }) };
  });
}
function saveEvent_(e) {
  var title = clean_(e.title, 100), date = clean_(e.date, 10), time = clean_(e.time, 5);
  if (!title) return { ok: false, error: "no_title" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, error: "bad_date" };
  if (time && !/^\d{2}:\d{2}$/.test(time)) return { ok: false, error: "bad_time" };
  var songs = (e.songs || []).slice(0, 60).map(function (s) { return { id: clean_(s.id, 120), title: clean_(s.title, 120), note: clean_(s.note, 200), key: clean_(s.key, 6) }; })
    .filter(function (s) { return s.title; });
  var players = (e.players || []).slice(0, 30).map(function (p) { return { id: clean_(p.id, 20), name: clean_(p.name, 60), role: clean_(p.role, 60) }; }).filter(function (p) { return p.name; });
  var ss = sheet_();
  var id = clean_(e.id, 20) || Utilities.getUuid().replace(/-/g, "").slice(0, 10);
  var vals = { ID: id, Title: title, Type: clean_(e.type, 30), Date: date, Time: time, Location: clean_(e.location, 150), Notes: clean_(e.notes, 1000),
               Updated: new Date().toISOString(), Players: JSON.stringify(players),
               Status: e.status === "canceled" ? "Canceled" : "", StatusNote: e.status === "canceled" ? clean_(e.statusNote, 200) : "" };
  var mine = rows_(ss, "Events").filter(function (r) { return r.ID === id; })[0];
  if (mine) updateRow_(ss, "Events", mine._row, vals); else appendRow_(ss, "Events", vals);
  eventTypes_(ss, true);
  addToList_(ss, "EventTypes", vals.Type);
  writeSetList_(ss, id, songs);
  return { ok: true, id: id };
}
function deleteEvent_(id) {
  if (!id) return { ok: false, error: "no_id" };
  var ss = sheet_(), mine = rows_(ss, "Events").filter(function (r) { return r.ID === id; })[0];
  if (mine) table_(ss, "Events").sh.deleteRow(mine._row);
  writeSetList_(ss, id, []);
  return { ok: true };
}
// replace one event's songs, keep everyone else's
function writeSetList_(ss, id, songs) {
  var t = table_(ss, "SetList"), sh = t.sh, last = sh.getLastRow();
  var keep = last > 1 ? sh.getRange(2, 1, last - 1, t.n).getValues().filter(function (r) { var e = String(r[t.map.EventID]); return e && e !== id; }) : [];
  songs.forEach(function (s, i) {
    var row = new Array(t.n).fill("");
    row[t.map.EventID] = id; row[t.map.Order] = String(i + 1); row[t.map.SongTitle] = s.title; row[t.map.SongID] = s.id; row[t.map.Note] = s.note; row[t.map.Key] = s.key;
    keep.push(row);
  });
  if (last > 1) sh.getRange(2, 1, last - 1, t.n).clearContent();
  if (keep.length) sh.getRange(2, 1, keep.length, t.n).setNumberFormat("@").setValues(keep);
}

/* ================= long messages come in pieces ================= */
function savePart_(p) {
  var key = String(p.key || "").replace(/[^\w]/g, "").slice(0, 40), i = parseInt(p.i, 10), n = parseInt(p.n, 10);
  if (!key || !(i >= 0) || !(n > 0) || n > 60 || i >= n) return { ok: false, error: "bad_part" };
  var c = CacheService.getScriptCache();
  c.put("part_" + key + "_" + i, String(p.chunk || ""), 600);
  c.put("part_" + key + "_n", String(n), 600);
  return { ok: true };
}
function joinParts_(key) {
  key = String(key || "").replace(/[^\w]/g, "").slice(0, 40);
  if (!key) return "";
  var c = CacheService.getScriptCache(), n = parseInt(c.get("part_" + key + "_n"), 10), out = "";
  if (!n) return "";
  for (var i = 0; i < n; i++) { var x = c.get("part_" + key + "_" + i); if (x == null) throw new Error("missing_part"); out += x; }
  return out;
}

/* ================= cache (stored in pieces, ~100 KB max per piece) ================= */
function cachePut_(s) {
  try {
    var c = CacheService.getScriptCache(), size = 90000, parts = {}, n = Math.ceil(s.length / size);
    if (n > 20) return;
    for (var i = 0; i < n; i++) parts["db_" + i] = s.slice(i * size, (i + 1) * size);
    parts["db_n"] = String(n);
    c.putAll(parts, CACHE_SECONDS);
  } catch (e) {}
}
function cacheGet_() {
  try {
    var c = CacheService.getScriptCache(), n = parseInt(c.get("db_n"), 10);
    if (!n) return null;
    var keys = []; for (var i = 0; i < n; i++) keys.push("db_" + i);
    var got = c.getAll(keys), out = "";
    for (var j = 0; j < n; j++) { if (got["db_" + j] == null) return null; out += got["db_" + j]; }
    return out;
  } catch (e) { return null; }
}
function cacheClear_() { try { CacheService.getScriptCache().remove("db_n"); } catch (e) {} }

/* ================= one-time: occasions out of Genres and into Themes (2026-10-16) ================= */
// Boda (now Wedding) and Birthday become themes, Independence Day becomes "September Celebration". Safe to run again.
function moveGenresToThemes() {
  var ss = sheet_(), MOVE = { "boda": "Wedding", "birthday": "Birthday", "independence day": "September Celebration", "september celebration": "September Celebration" };
  START_THEMES.forEach(function (n) { addToList_(ss, "Themes", n); });
  var moved = 0;
  rows_(ss, "Songs").forEach(function (s) {
    var to = MOVE[low_(s.Genre)];
    if (!to) return;
    updateRow_(ss, "Songs", s._row, { Genre: "", Themes: themesText_(themes_(s.Themes).concat([to])) });
    moved++;
  });
  var g = table_(ss, "Genres").sh, list = rows_(ss, "Genres");
  for (var i = list.length - 1; i >= 0; i--) if (MOVE[low_(list[i].Name)]) g.deleteRow(list[i]._row);
  cacheClear_();
  Logger.log("Songs moved to themes: " + moved);
}

/* ================= one-time move from the old Google Doc ================= */
function migrateFromDoc() {
  var ss = sheet_();
  Object.keys(TABLES).forEach(function (t) { table_(ss, t); });
  var doc = DocumentApp.openById(DOC_ID), tabs = [];
  (function walk(list, parent) {
    (list || []).forEach(function (t) {
      if (t.getType() === DocumentApp.TabType.DOCUMENT_TAB) tabs.push({ title: t.getTitle(), parent: parent, body: t.asDocumentTab().getBody() });
      walk(t.getChildTabs(), t.getTitle());
    });
  })(doc.getTabs(), "");
  var have = rows_(ss, "Songs"), haveIds = have.map(function (r) { return r.ID; }), haveTitles = have.map(function (r) { return norm_(r.Title); });
  var added = 0, skipped = 0, albums = [], now = new Date().toISOString();
  tabs.forEach(function (tab) {
    var songs = docSongs_(tab.body);
    if (!songs.length) return;
    var isCovers = /other artists/i.test(tab.title);
    var album = isCovers ? "" : tab.title;
    if (album && albums.indexOf(album) < 0) albums.push(album);
    songs.forEach(function (s) {
      if (haveTitles.indexOf(norm_(s.title)) >= 0) { skipped++; return; }
      var id = slug_(s.title), base = id, k = 2;
      while (haveIds.indexOf(id) >= 0) id = base + "-" + (k++);
      haveIds.push(id); haveTitles.push(norm_(s.title));
      var m = s.meta, bpm = (String(m.tempo || "").match(/(\d+)\s*bpm/i) || [])[1] || "", tm = (String(m.tempo || "").match(/(\d+\s*\/\s*\d+)/) || [])[1] || "";
      if (bpm === "0" || /^0+$/.test(bpm)) bpm = "";
      var type = /cover/i.test(m.type || "") || isCovers ? "Cover" : "Original";
      var artist = m.artist || (type === "Original" ? BAND_ARTIST : "");
      if (/^rey de reyes$/i.test(artist)) artist = BAND_ARTIST;
      var genre = m.genre || "";
      if (/^worship$/i.test(genre)) genre = "Adoracion";
      appendRow_(ss, "Songs", { ID: id, Title: s.title, Album: album, Type: type, Artist: artist, Key: m.key || "", BPM: bpm, Time: tm.replace(/\s+/g, ""),
                                Genre: genre, Link: "", Lyrics: s.lyrics, Created: now, Updated: now });
      addToList_(ss, "Artists", artist);
      addToList_(ss, "Genres", genre);
      added++;
    });
  });
  var haveAlbums = rows_(ss, "Albums").map(function (r) { return low_(r.Name); });
  albums.forEach(function (a) {
    if (haveAlbums.indexOf(low_(a)) >= 0) return;
    var y = (a.match(/\((\d{4})\)/) || [])[1] || "";
    appendRow_(ss, "Albums", { Name: a, Year: y });
  });
  cacheClear_();
  Logger.log("Songs added: " + added + ", already there: " + skipped + ", albums: " + albums.join(", "));
}

// pull the songs out of one doc tab: title line + info table, then the lyrics until a page break / line
function docSongs_(body) {
  var ET = DocumentApp.ElementType, els = [], out = [];
  for (var i = 0; i < body.getNumChildren(); i++) els.push(body.getChild(i));
  function isPara(el) { var t = el.getType(); return t === ET.PARAGRAPH || t === ET.LIST_ITEM; }
  function brk(el) {
    if (el.getType() !== ET.PARAGRAPH) return false;
    var p = el.asParagraph();
    for (var j = 0; j < p.getNumChildren(); j++) { var ct = p.getChild(j).getType(); if (ct === ET.HORIZONTAL_RULE || ct === ET.PAGE_BREAK) return true; }
    return /^\s*_{8,}\s*$/.test(p.getText());
  }
  function label(s) {
    var n = norm_(s);
    if (/^(type|tipo)\b/.test(n)) return "type"; if (/^(artist|artista)\b/.test(n)) return "artist"; if (/^(key|tono)\b/.test(n)) return "key";
    if (/^tempo\b/.test(n)) return "tempo"; if (/^(genre|genero)\b/.test(n)) return "genre"; if (/^instrument/.test(n)) return "instruments"; return null;
  }
  function metaTable(el) {
    if (!el || el.getType() !== ET.TABLE) return null;
    var tb = el.asTable(), m = {}, hits = 0;
    for (var r = 0; r < tb.getNumRows(); r++) {
      var row = tb.getRow(r); if (row.getNumCells() < 1) continue;
      var k = label(row.getCell(0).getText());
      if (k) { hits++; var v = row.getNumCells() > 1 ? row.getCell(1).getText().split(/[\r\n\u000b]+/).map(function (x) { return x.trim(); }).filter(Boolean)[0] || "" : ""; if (v && /^(intro|introduccion|verso|verse|coro|chorus|pre-?coro|puente|instrumental|outro|final)\b/i.test(v)) v = ""; if (v && !m[k]) m[k] = v; }
    }
    return hits >= 2 ? m : null;
  }
  var k = 0;
  while (k < els.length) {
    var el = els[k], meta = null, tj = -1;
    if (isPara(el) && el.getText().trim() && el.getText().trim().length <= 80) {
      for (var j = k + 1; j < els.length && j <= k + 4; j++) {
        if (isPara(els[j]) && !els[j].getText().trim() && !brk(els[j])) continue;
        meta = metaTable(els[j]); if (meta) tj = j; break;
      }
    }
    if (!meta) { k++; continue; }
    var title = el.getText().replace(/\s+/g, " ").trim(), lines = [], e = tj + 1;
    for (; e < els.length; e++) {
      var x = els[e];
      if (brk(x)) break;
      if (isPara(x) && x.getText().trim()) {
        var nx = -1;
        for (var q = e + 1; q < els.length && q <= e + 4; q++) { if (isPara(els[q]) && !els[q].getText().trim()) continue; if (metaTable(els[q])) nx = q; break; }
        if (nx > 0) break;                                       // next song starts here
      }
      if (x.getType() === ET.TABLE_OF_CONTENTS) break;
      if (isPara(x)) x.getText().split(/[\r\u000b]/).forEach(function (l) { lines.push(l.replace(/\s+$/, "")); });
      else if (x.getType() === ET.TABLE) lines.push(x.getText());
    }
    // tidy: no blank lines at the start/end, never more than one blank line in a row
    var tidy = [], prevBlank = true;
    lines.forEach(function (l) { var b = !l.trim(); if (b && prevBlank) return; tidy.push(l); prevBlank = b; });
    while (tidy.length && !tidy[tidy.length - 1].trim()) tidy.pop();
    out.push({ title: title, meta: meta, lyrics: tidy.join("\n") });
    k = e;
  }
  return out;
}
