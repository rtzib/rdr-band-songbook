/**
 * ONE-TIME layout fix for the band song doc (songs that are already in it).
 *
 * How to run:
 * 1. In the same Apps Script project as Code.gs: click + next to Files > Script, name it FixLayout, paste this file, save.
 * 2. Pick "previewFixes" and click Run. Open "Execution log" and read the list of changes. Nothing is changed yet.
 * 3. If it looks right, pick "applyFixes" and click Run. It FIRST saves a backup copy of the doc in your Drive
 *    ("RDRB - Song | Song Doc Backup <date>"), then makes the changes.
 * RUN ON THE REAL DOC 2026-10-16 (done). Kept for reference; don't run applyFixes again unless the layout drifts.
 * Works tab by tab. Tabs with no songs (Playlists, Patriotic Songs) are left alone.
 *
 * What it changes:
 * - Every song's info table becomes the same 5 rows: Type, Artist, Key, Tempo/Time Signature, Genre.
 *   Type = Original or Cover. Artist = "Rey de Reyes" for our songs. Key = just the chord (G, Am).
 *   Tempo = "100 BPM - 4/4". Anything stuck inside the table (like "Intro") moves below it.
 *   Missing values stay blank. It never makes up a key, tempo or genre.
 * - Song titles become Heading 2.
 * - Part names: Introduccion -> Intro, Verse -> Verso, Final -> Outro, Verso 1 -> Verso I, etc.
 *   When a song has two different verses (or choruses) with no numbers, they get numbered (Verso I, Verso II).
 * - Chord runs like "C - Am - F - G" get brackets: "[C] - [Am] - [F] - [G]". Chords above the words are left alone.
 * - A horizontal line between every song. A blank line before a part name when it's missing.
 * - Extra blank lines are trimmed (max 2 in a row inside a song, none between songs).
 * - Old song lists and tables of contents are removed (REMOVE_OLD_SONG_LISTS). The Docs outline lists the Heading 2 titles instead.
 * - A "Set Lists" heading (with a line above it) goes before "Playlist for Special Events". Set lists aren't touched.
 * - A line goes before the "Our Country / Sovereign and Strong" list so it isn't read as part of a song.
 * Lyrics are never changed.
 */
var FIX_DOC_ID = "1h71apax-e4iVCXoxrhq3wtUltAUcRPk51wqIVKMSCT0";
var REMOVE_OLD_SONG_LISTS = true;
var OUR_ARTIST = "Rey de Reyes";

function previewFixes() { fixLayout_(false).forEach(function (x) { console.log(x); }); }
function applyFixes() { fixLayout_(true).forEach(function (x) { console.log(x); }); }

/* ---------------- helpers that don't touch the doc ---------------- */
var FX = (function () {
  var CHORD_BODY = "[A-G](?:#|b)?(?:maj|min|m|M|dim|aug|sus|add)?\\d*(?:(?:sus|add|maj|b|#)\\d+)*(?:\\/[A-G](?:#|b)?)?";
  var CHORD_RE = new RegExp("^" + CHORD_BODY + "$");
  var CHORD_G = new RegExp("(^|[^A-Za-z#\\[])(" + CHORD_BODY + ")(?![A-Za-z#\\]])", "g");
  var WORDS = "intro(?:ducci[oó]n)?|pre[\\s-]?coro|pre[\\s-]?chorus|verso|verse|estrofa|coro|chorus|estribillo|puente|bridge|interludio|interlude|instrumental|drum solo|outro|final|cierre";
  var HEAD_RE = new RegExp("^(\\s*)(" + WORDS + ")(?![a-z])(\\s*((?:[IVX]+|\\d+)(?![a-z])))?\\s*(.*)$", "i");
  var ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"];
  var ARAB = { "1": "I", "2": "II", "3": "III", "4": "IV", "5": "V", "6": "VI" };

  function norm(s) { return String(s || "").replace(/&/g, " y ").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[’'\x60´]/g, "").replace(/[^a-z0-9#]+/g, " ").trim(); }
  function metaKey(s) {
    var n = norm(s);
    if (/^(type|tipo)\b/.test(n)) return "type";
    if (/^(artist|artista|autor)\b/.test(n)) return "artist";
    if (/^(key|tono|tonalidad)\b/.test(n)) return "key";
    if (/^(tempo|bpm)\b/.test(n)) return "tempo";
    if (/^(genre|genero|ritmo|estilo)\b/.test(n)) return "genre";
    if (/^instrument/.test(n)) return "instruments";
    return null;
  }
  function isChordLine(line) {
    var s = String(line).replace(/\t/g, "    ").trim(); if (!s) return false;
    var toks = s.split(/[\s\-–—|,]+/), n = 0;
    for (var i = 0; i < toks.length; i++) {
      var c = toks[i].replace(/^[\[\(\/:]+|[\]\)\/:.]+$/g, "");
      if (!c || /^x\d+$/i.test(c)) continue;
      if (!CHORD_RE.test(c)) return false;
      n++;
    }
    return n > 0;
  }
  // "C - Am - F - G" -> "[C] - [Am] - [F] - [G]"; returns null when nothing should change
  function bracketChords(line) {
    var t = String(line);
    if (!isChordLine(t) || t.indexOf("[") >= 0 || /^\s{2,}/.test(t) || /\S\s{3,}\S/.test(t) || t.indexOf("-") < 0) return null;
    CHORD_G.lastIndex = 0;
    var out = t.replace(CHORD_G, function (all, pre, ch) { return pre + "[" + ch + "]"; });
    return out === t ? null : out;
  }
  function parseHeader(line) {
    var s = String(line || "");
    if (!s.trim() || s.trim().length > 48) return null;
    var m = s.match(HEAD_RE); if (!m) return null;
    var rest = m[5] || "";
    if (rest && !/^[\(\-–—:\[]/.test(rest)) return null;
    var w = norm(m[2]), word, kind;
    if (/^intro/.test(w)) { word = "Intro"; kind = "intro"; }
    else if (/^pre/.test(w)) { word = "Pre-Coro"; kind = "pre"; }
    else if (/^(verso|verse|estrofa)/.test(w)) { word = "Verso"; kind = "verse"; }
    else if (/^(coro|chorus|estribillo)/.test(w)) { word = "Coro"; kind = "chorus"; }
    else if (/^(puente|bridge)/.test(w)) { word = "Puente"; kind = "bridge"; }
    else if (/^drum/.test(w)) { word = "Drum Solo"; kind = "inst"; }
    else if (/^(instrumental|interlud)/.test(w)) { word = "Instrumental"; kind = "inst"; }
    else { word = "Outro"; kind = "outro"; }
    var num = m[4] ? (ARAB[m[4]] || m[4].toUpperCase()) : "";
    var oldPrefix = m[2] + (m[3] || "");
    return { lead: m[1].length, oldPrefix: oldPrefix, word: word, num: num, kind: kind,
             newPrefix: function (n) { return word + (n ? " " + n : ""); } };
  }
  function normKey(k) {
    var s = String(k || "").trim(); if (!s) return "";
    var m = s.match(/^([A-Ga-g])\s*([#b♯♭])?\s*(m(?!aj|ayor)|min(?:or)?|menor)?/);
    if (!m) return s;
    var acc = m[2] ? (m[2] === "♯" ? "#" : m[2] === "♭" ? "b" : m[2]) : "";
    var minor = !!m[3] || /\b(minor|menor)\b/i.test(s);
    return m[1].toUpperCase() + acc + (minor ? "m" : "");
  }
  function normTempo(t) {
    var s = String(t || "").replace(/\s+/g, " ").trim(); if (!s) return "";
    var b = s.match(/(\d+)\s*bpm/i), ts = s.match(/(\d+)\s*\/\s*(\d+)/);
    if (!b && !ts) return s;
        var out = (b ? b[1] + " BPM" : "BPM");
    if (ts) out += " - " + ts[1] + "/" + ts[2];
    return out;
  }
  function lineKey(l) { return norm(String(l).replace(/\/+/g, " ").replace(/\(\s*x\s*\d+\s*\)/gi, " ")); }
  function similar(a, b) {
    if (!a.length || !b.length) return false;
    var set = {}, shared = 0;
    a.forEach(function (x) { set[x] = 1; });
    b.forEach(function (x) { if (set[x]) shared++; });
    return shared / Math.min(a.length, b.length) >= 0.6;
  }
  // headers: [{h, lines}] in song order; sets h.newNum where numbering is needed
  function numberParts(headers) {
    ["verse", "chorus", "pre"].forEach(function (kind) {
      var list = headers.filter(function (x) { return x.h.kind === kind; });
      if (list.length < 2 || list.some(function (x) { return x.h.num; })) return;
      var groups = [];
      list.forEach(function (x) {
        if (!x.lines.length) { x.g = 1; return; }
        var g = null;
        for (var i = 0; i < groups.length; i++) if (similar(groups[i].lines, x.lines)) { g = groups[i]; break; }
        if (!g) { g = { lines: x.lines, n: groups.length + 1 }; groups.push(g); }
        x.g = g.n;
      });
      if (groups.length < 2) return;
      list.forEach(function (x) { x.h.newNum = ROMAN[x.g - 1]; });
    });
  }
  return { norm: norm, metaKey: metaKey, isChordLine: isChordLine, bracketChords: bracketChords, parseHeader: parseHeader,
           normKey: normKey, normTempo: normTempo, lineKey: lineKey, numberParts: numberParts };
})();

/* ---------------- the doc work ---------------- */
function fixLayout_(apply) {
  var log = [apply ? "APPLYING CHANGES" : "PREVIEW ONLY (nothing changed). Run applyFixes to make these changes."];
  var ET = DocumentApp.ElementType;
  if (apply) {
    var stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH.mm");
    var copy = DriveApp.getFileById(FIX_DOC_ID).makeCopy("RDRB - Song | Song Doc Backup " + stamp);
    log.push("Backup saved: " + copy.getName() + " (" + copy.getUrl() + ")");
  }
  var doc = DocumentApp.openById(FIX_DOC_ID);
  var tabs = [];
  (function walk(list) {
    (list || []).forEach(function (t) {
      if (t.getType() === DocumentApp.TabType.DOCUMENT_TAB) tabs.push(t);
      walk(t.getChildTabs());
    });
  })(doc.getTabs ? doc.getTabs() : []);
  if (!tabs.length) { fixBody_(doc.getBody(), apply, log, doc.getName()); }
  tabs.forEach(function (t) { fixBody_(t.asDocumentTab().getBody(), apply, log, t.getTitle()); });
  log.push("Done. Next: in each song tab, Insert > Table of contents at the top. Check the app's Help page for songs still missing a key, tempo or genre.");
  return log;
}

function fixBody_(body, apply, log, tabTitle) {
  var ET = DocumentApp.ElementType;
  var n = body.getNumChildren(), els = [];
  for (var i = 0; i < n; i++) els.push(body.getChild(i));

  function isPara(el) { var t = el.getType(); return t === ET.PARAGRAPH || t === ET.LIST_ITEM; }
  function textOf(el) { return isPara(el) || el.getType() === ET.TABLE ? el.getText() : ""; }
  function hasBreak(el) {
    if (el.getType() !== ET.PARAGRAPH) return false;
    var p = el.asParagraph();
    for (var j = 0; j < p.getNumChildren(); j++) {
      var ct = p.getChild(j).getType();
      if (ct === ET.HORIZONTAL_RULE || ct === ET.PAGE_BREAK) return true;
    }
    return /^\s*_{8,}\s*$/.test(p.getText());
  }
  function isBlank(el) {
    if (!isPara(el) || hasBreak(el)) return false;
    var p = el.getType() === ET.LIST_ITEM ? el.asListItem() : el.asParagraph();
    if (p.getText().trim() !== "") return false;
    for (var j = 0; j < p.getNumChildren(); j++) if (p.getChild(j).getType() !== ET.TEXT) return false;
    return true;
  }
  function isMetaTable(el) {
    if (!el || el.getType() !== ET.TABLE) return false;
    var tb = el.asTable(), hits = 0;
    for (var r = 0; r < tb.getNumRows(); r++) if (tb.getRow(r).getNumCells() && FX.metaKey(tb.getRow(r).getCell(0).getText())) hits++;
    return hits >= 2;
  }
  function tableAfterTitle(k) {
    var el = els[k];
    if (!isPara(el)) return -1;
    var t = el.getText().trim();
    if (!t || t.length > 80 || FX.parseHeader(t) || FX.metaKey(t)) return -1;
    for (var j = k + 1; j < els.length && j <= k + 4; j++) {
      if (isBlank(els[j])) continue;
      return isMetaTable(els[j]) ? j : -1;
    }
    return -1;
  }
  function isTocHeading(el) { return isPara(el) && /^\s*table of contents\s*$/i.test(el.getText()); }
  function isSetListStart(el) { return isPara(el) && /^\s*(playlist for special events|set lists?)\s*$/i.test(el.getText()); }
  function isOddList(el) { return isPara(el) && /^\s*(1\.\s*)?our country, the land of the free/i.test(el.getText()); }

  // ---- 1. find the songs ----
  var songs = [];
  for (var k = 0; k < els.length; k++) {
    var tj = tableAfterTitle(k);
    if (tj >= 0) { songs.push({ t: k, tb: tj, title: els[k].getText().trim() }); k = tj; }
  }
  var setStart = -1, oddList = -1;
  for (var q = 0; q < els.length; q++) {
    if (setStart < 0 && isSetListStart(els[q])) setStart = q;
    if (oddList < 0 && isOddList(els[q])) oddList = q;
  }
  var END = setStart >= 0 ? setStart : els.length;
  songs = songs.filter(function (s) { return s.t < END; });
  songs.forEach(function (s, idx) {
    var stop = idx + 1 < songs.length ? songs[idx + 1].t : END;
    var e = s.tb + 1;
    while (e < stop && !hasBreak(els[e]) && els[e].getType() !== ET.TABLE_OF_CONTENTS && !isTocHeading(els[e]) && e !== oddList) e++;
    s.end = e;  // song body = (tb, end)
  });
  if (!songs.length) { log.push("=== Tab \"" + tabTitle + "\": no songs, left as is"); return; }
  log.push("=== Tab \"" + tabTitle + "\": " + songs.length + " song(s)" + (setStart >= 0 ? "; set lists start at \"" + els[setStart].getText().trim() + "\"" : ""));
  var titleKeys = {};
  songs.forEach(function (s) { titleKeys[FX.norm(s.title)] = 1; });

  // ---- 2. work from the bottom of the doc up, so positions above stay right ----
  // set lists heading
  if (setStart >= 0 && !/^\s*set lists?\s*$/i.test(els[setStart].getText())) {
    var prevBreak = false;
    for (var b = setStart - 1; b >= 0 && isBlank(els[b]); b--) {}
    if (b >= 0 && hasBreak(els[b])) prevBreak = true;
    log.push("Add a \"Set Lists\" heading" + (prevBreak ? "" : " and a line") + " before \"" + els[setStart].getText().trim() + "\"");
    if (apply) {
      var hd = body.insertParagraph(setStart, "Set Lists");
      hd.setHeading(DocumentApp.ParagraphHeading.HEADING1);
      if (!prevBreak) body.insertHorizontalRule(setStart);
    }
  }

  for (var si = songs.length - 1; si >= 0; si--) {
    var s = songs[si], prevEnd = si > 0 ? songs[si - 1].end : 0;
    var nextStart = si + 1 < songs.length ? songs[si + 1].t : END;
    var slog = [];

    // gap after this song (between its end and the next song / set lists): old song lists, extra blanks, odd list
    var gapOps = [];
    for (var g = nextStart - 1; g >= s.end; g--) {
      var el = els[g];
      if (g === oddList) {
        var brk = false;
        for (var x = g - 1; x >= s.end; x--) if (hasBreak(els[x])) brk = true;
        if (!brk) { slog.push("Add a line before the \"Our Country...\" list (so it's not read as lyrics)"); gapOps.push({ i: g, op: "hr" }); }
      }
    }
    if (REMOVE_OLD_SONG_LISTS) collectOldLists_(s.end, nextStart, gapOps, slog);
    // blanks between songs
    if (si + 1 < songs.length) {
      var nb = 0;
      for (var g2 = s.end; g2 < nextStart; g2++) if (isBlank(els[g2]) && !gapOps.some(function (o) { return o.i === g2; })) { gapOps.push({ i: g2, op: "remove" }); nb++; }
      // line before the next song
      var hasLine = false;
      for (var g3 = s.end; g3 < nextStart; g3++) if (hasBreak(els[g3])) hasLine = true;
      if (!hasLine) { log.push("[" + songs[si + 1].title + "] add a line before this song"); gapOps.push({ i: nextStart, op: "hr" }); }
    }
    gapOps.sort(function (a, c) { return c.i - a.i || (a.op === "hr" ? -1 : 1); });
    if (apply) gapOps.forEach(function (o) {
      if (o.op === "remove") { safeRemove_(els[o.i]); }
      else if (o.op === "hr") { body.insertHorizontalRule(o.i); }
    });

    // song body
    var bodyIdx = [];
    for (var z = s.tb + 1; z < s.end; z++) bodyIdx.push(z);
    var headers = [], cur = null;
    bodyIdx.forEach(function (z) {
      var e2 = els[z];
      if (!isPara(e2)) return;
      var tx = e2.getText(), h = FX.parseHeader(tx);
      if (h) { cur = { i: z, h: h, lines: [] }; headers.push(cur); return; }
      if (cur && tx.trim() && !FX.isChordLine(tx)) cur.lines.push(FX.lineKey(tx));
    });
    FX.numberParts(headers);
    var ops = [];
    headers.forEach(function (x) {
      var want = x.h.newPrefix(x.h.newNum || x.h.num);
      if (want !== x.h.oldPrefix) { ops.push({ i: x.i, op: "rename", h: x.h, to: want }); slog.push("\"" + els[x.i].getText().trim() + "\" -> \"" + want + els[x.i].getText().trim().slice(x.h.oldPrefix.length) + "\""); }
      // blank line before a part name
      if (x.i - 1 > s.tb && isPara(els[x.i - 1]) && !isBlank(els[x.i - 1]) && !hasBreak(els[x.i - 1])) { ops.push({ i: x.i, op: "blank" }); slog.push("blank line before \"" + els[x.i].getText().trim() + "\""); }
    });
    bodyIdx.forEach(function (z) {
      if (!isPara(els[z])) return;
      var nb2 = FX.bracketChords(els[z].getText());
      if (nb2) { ops.push({ i: z, op: "set", to: nb2 }); slog.push("chords \"" + els[z].getText().trim() + "\" -> \"" + nb2.trim() + "\""); }
    });
    // blanks: none at the end of a song, max 2 in a row inside
    var run = [], trailing = true, nTrim = 0;
    for (var z2 = s.end - 1; z2 > s.tb; z2--) {
      if (isBlank(els[z2])) { if (trailing) { ops.push({ i: z2, op: "remove" }); nTrim++; } else run.push(z2); }
      else {
        trailing = false;
        if (run.length > 2) run.slice(2).forEach(function (r) { ops.push({ i: r, op: "remove" }); nTrim++; });
        run = [];
      }
    }
    if (run.length > 2) run.slice(2).forEach(function (r) { ops.push({ i: r, op: "remove" }); nTrim++; });
    if (nTrim) slog.push("trim " + nTrim + " extra blank line(s)");

    // table
    var tfix = planTable_(els[s.tb].asTable());
    tfix.changes.forEach(function (c) { slog.push(c); });
    if (tfix.spill.length) slog.push("move out of the table: " + tfix.spill.map(function (x) { return "\"" + x + "\""; }).join(", "));

    // title
    var titleEl = els[s.t], needHead = titleEl.getType() === ET.PARAGRAPH && titleEl.asParagraph().getHeading() !== DocumentApp.ParagraphHeading.HEADING2;
    if (needHead) slog.push("title -> Heading 2");

    if (apply) {
      ops.sort(function (a, c) { return c.i - a.i || (a.op === "blank" ? 1 : -1); });
      ops.forEach(function (o) {
        var e3 = els[o.i];
        if (o.op === "remove") safeRemove_(e3);
        else if (o.op === "blank") body.insertParagraph(o.i, "");
        else if (o.op === "set") (e3.getType() === ET.LIST_ITEM ? e3.asListItem() : e3.asParagraph()).setText(o.to);
        else if (o.op === "rename") renamePrefix_(e3, o.h, o.to);
      });
      // things stuck inside the table go right under it, styled like the first part name
      if (tfix.spill.length) {
        var style = headers.length ? els[headers[0].i].getAttributes() : null;
        for (var sp = tfix.spill.length - 1; sp >= 0; sp--) {
          var np = body.insertParagraph(s.tb + 1, tfix.spill[sp]);
          if (style) { try { np.setAttributes(style); } catch (e) {} }
        }
        body.insertParagraph(s.tb + 1, "");
      }
      tfix.write();
      if (needHead) titleEl.asParagraph().setHeading(DocumentApp.ParagraphHeading.HEADING2);
    }
    if (slog.length) log.push("[" + s.title + "]\n  - " + slog.join("\n  - "));
  }

  // above the first song: old song lists and the "Table of Contents" labels
  if (REMOVE_OLD_SONG_LISTS && songs.length) {
    var topOps = [], tlog = [];
    collectOldLists_(0, songs[0].t, topOps, tlog);
    topOps.sort(function (a, c) { return c.i - a.i; });
    if (apply) topOps.forEach(function (o) { safeRemove_(els[o.i]); });
    if (tlog.length) log.push("[top of the doc]\n  - " + tlog.join("\n  - "));
  }
  return;

  // old typed song lists: "Table of Contents" labels, real TOC blocks, and runs of lines that are mostly song titles
  function collectOldLists_(from, to, ops, lg) {
    var runIdx = [];
    function flush() {
      if (!runIdx.length) return;
      var hits = runIdx.filter(function (r) { return titleKeys[FX.norm(els[r].getText())]; }).length;
      if (hits && hits * 2 >= runIdx.length) {
        runIdx.forEach(function (r) { ops.push({ i: r, op: "remove" }); });
        lg.push("remove old song list: " + runIdx.map(function (r) { return els[r].getText().trim(); }).join(" / "));
      }
      runIdx = [];
    }
    for (var a = from; a < to; a++) {
      var e = els[a];
      if (a === oddList) { flush(); continue; }
      if (e.getType() === ET.TABLE_OF_CONTENTS) { flush(); ops.push({ i: a, op: "remove" }); lg.push("remove table of contents"); continue; }
      if (isTocHeading(e)) { flush(); ops.push({ i: a, op: "remove" }); lg.push("remove \"Table of Contents\" label"); continue; }
      if (isPara(e) && e.getText().trim() && !hasBreak(e)) runIdx.push(a);
      else if (!isBlank(e)) flush();
    }
    flush();
  }
}

// rename just the part-name words at the start of a line, keeping the line's formatting
function renamePrefix_(el, h, to) {
  var txt = el.editAsText();
  var full = txt.getText();
  var start = h.lead, endIncl = h.lead + h.oldPrefix.length - 1;
  var attrs = full.length ? txt.getAttributes(start) : null;
  if (start === 0 && endIncl >= full.length - 1) { txt.setText(to); }
  else { txt.insertText(endIncl + 1, to); txt.deleteText(start, endIncl); }
  if (attrs) { try { txt.setAttributes(start, start + to.length - 1, attrs); } catch (e) {} }
}

// work out the new 5-row table; write() applies it
function planTable_(table) {
  var ET = DocumentApp.ElementType;
  var m = {}, spill = [], changes = [], oldRows = [];
  for (var r = 0; r < table.getNumRows(); r++) {
    var row = table.getRow(r), cells = [];
    for (var c = 0; c < row.getNumCells(); c++) cells.push(row.getCell(c).getText());
    oldRows.push(cells);
    for (var c2 = 0; c2 < cells.length; c2 += 2) {
      var key = FX.metaKey(cells[c2]);
      var lines = String(cells[c2 + 1] || "").split(/[\r\n\u000b]+/).map(function (x) { return x.trim(); }).filter(function (x) { return x && !/^_{5,}$/.test(x); });
      var v = lines.shift() || "";
      if (v && FX.parseHeader(v)) { lines.unshift(v); v = ""; }   // a part name like "Intro" is not a value
      if (key) { if (m[key] === undefined || (!m[key] && v)) m[key] = v; }
      else if (String(cells[c2]).trim()) {
        String(cells[c2]).split(/[\r\n\u000b]+/).map(function (x) { return x.trim(); }).filter(function (x) { return x && !/^_{5,}$/.test(x); }).forEach(function (x) { spill.push(x); });
        if (v) spill.push(v);
      }
      lines.forEach(function (x) { spill.push(x); });
    }
  }
  if (m.key && /\d+\s*bpm/i.test(m.key) && !m.tempo) { m.tempo = m.key; m.key = ""; }   // repair: tempo landed in the Key row
  if (m.instruments) spill.unshift("Instruments: " + m.instruments);
  var artist = m.artist || "";
  var ours = !artist || /^(rey de reyes|rdr)\b/i.test(FX.norm(artist));
  var type = /cover/i.test(m.type || "") ? "Cover" : /original/i.test(m.type || "") ? "Original" : (ours ? "Original" : "Cover");
  if (!artist && type === "Original") artist = OUR_ARTIST;
  var want = [["Type", type], ["Artist", artist], ["Key", FX.normKey(m.key)], ["Tempo/Time Signature", FX.normTempo(m.tempo)], ["Genre", (m.genre || "").replace(/\s+/g, " ").trim()]];
  var same = oldRows.length === 5 && want.every(function (w, i) { return oldRows[i][0].trim() === w[0] && String(oldRows[i][1] || "").trim() === w[1]; });
  if (!same) {
    var before = oldRows.map(function (o) { return o[0].trim() + ": " + String(o[1] || "").replace(/\s+/g, " ").trim(); }).join(" | ");
    var after = want.map(function (w) { return w[0] + ": " + (w[1] || "(blank)"); }).join(" | ");
    changes.push("table  " + before + "\n      -> " + after);
  }
  return {
    spill: spill, changes: changes,
    write: function () {
      if (same) return;
      var template = table.getRow(0).copy();
      var have = table.getNumRows();
      for (var i = 0; i < want.length; i++) {
        var row = i < have ? table.getRow(i) : table.appendTableRow(template.copy());
        while (row.getNumCells() < 2) row.appendTableCell("");
        setCell_(row.getCell(0), want[i][0]);
        setCell_(row.getCell(1), want[i][1]);
      }
      for (var j = table.getNumRows() - 1; j >= want.length; j--) table.removeRow(j);
    }
  };
}

// put one line of text in a table cell, keeping the look of its first line
function setCell_(cell, text) {
  for (var k = cell.getNumChildren() - 1; k >= 1; k--) cell.getChild(k).removeFromParent();
  var first = cell.getChild(0);
  if (first.getType() !== DocumentApp.ElementType.PARAGRAPH) { cell.setText(text); return; }
  var p = first.asParagraph();
  for (var c = p.getNumChildren() - 1; c >= 0; c--) {
    if (p.getChild(c).getType() !== DocumentApp.ElementType.TEXT) p.getChild(c).removeFromParent();
  }
  var tx = p.editAsText(), old = tx.getText();
  var attrs = old.length ? tx.getAttributes(0) : null;
  if (text.length) p.setText(text); else p.clear();
  if (attrs && text.length) { try { p.editAsText().setAttributes(0, text.length - 1, attrs); } catch (e) {} }
}

// the last paragraph of a tab can't be removed; empty it instead
function safeRemove_(el) {
  try { el.removeFromParent(); }
  catch (e) { if (el.getType() === DocumentApp.ElementType.PARAGRAPH) { try { el.asParagraph().clear(); } catch (e2) {} } }
}
