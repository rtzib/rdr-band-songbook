/**
 * Rey de Reyes Songbook - reads the band's song Google Doc and hands it to the web app.
 *
 * Setup (one time):
 * 1. Go to script.google.com > New project. Name it "RDR Songbook".
 * 2. Replace everything in Code.gs with this file. Save.
 * 3. Run the "test" function once and allow access (it only reads the doc).
 * 4. Deploy > New deployment > type "Web app". Execute as: Me. Who has access: Anyone.
 * 5. Copy the link that ends in /exec and put it in SCRIPT_URL at the top of index.html.
 *
 * After changing this file: Deploy > Manage deployments > edit (pencil) > Version: New version > Deploy.
 * The /exec link stays the same.
 *
 * Read-only. It never changes the document. There's no secret in here, so it's fine on GitHub.
 */
var DOC_ID = "1h71apax-e4iVCXoxrhq3wtUltAUcRPk51wqIVKMSCT0";
var CACHE_SECONDS = 60;   // how long a copy is reused before reading the doc again

function doGet(e) {
  var p = (e && e.parameter) || {};
  var body;
  try {
    var cache = CacheService.getScriptCache();
    body = p.fresh ? null : cache.get("doc");
    if (!body) {
      body = JSON.stringify(readDoc_());
      if (body.length < 95000) cache.put("doc", body, CACHE_SECONDS);
    }
  } catch (err) {
    body = JSON.stringify({ ok: false, error: String(err) });
  }
  var cb = p.callback;
  if (cb && /^[A-Za-z_$][\w$]*$/.test(cb)) {
    return ContentService.createTextOutput(cb + "(" + body + ");").setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(body).setMimeType(ContentService.MimeType.JSON);
}

// run this once from the editor to give permission and see what the app will get
function test() {
  var d = readDoc_();
  Logger.log("Tabs: " + d.tabs.map(function (t) { return t.title + " (" + t.blocks.length + ")"; }).join(", "));
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
      if (hasBreak_(par)) out.push({ t: "hr" });
      var text = par.getText();
      if (text || !hasBreak_(par)) out.push({ t: "p", text: text, h: String(par.getHeading()) });
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
