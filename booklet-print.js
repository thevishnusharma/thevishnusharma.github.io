/* ============================================================================
   BOOKLET PRINT MODULE  (v3 — measurement fixed: runs inside the print
   window itself, using the real booklet CSS, so page heights are accurate)
   ----------------------------------------------------------------------------
   Structure enforced everywhere in this file:

     Landscape A4 Sheet
        └── Left Half  = one Logical Page  → 2 Question Columns
        └── Right Half = one Logical Page  → 2 Question Columns

   Pipeline:
     1. (Parent window) Collect questions + header HTML.
     2. Open the print window and hand it the raw data (header + question
        items + settings) as JSON.
     3. (Print window, its OWN document/CSS) Measure each question's real
        rendered height, distribute into Logical Pages, split each page
        into exactly 2 columns (Sequential or Balanced), stamp page
        numbers, pad to a multiple of 4 with blank pages, run booklet
        imposition (front/back, Left/Right) for ANY page count that's a
        multiple of 4, and render both preview modes.
     4. Print always prints the Imposition (landscape sheets) view.

   Why measurement happens inside the print window: the print window has
   its own compact stylesheet (small fonts, tight spacing, KaTeX). If a
   question's height were measured in the parent app window instead, it
   would use whatever default styling exists there — usually much taller
   — which makes the paginator think questions are bigger than they
   really are, cut pages short, and leave real, print-ready pages with a
   large empty gap at the bottom. Measuring in the same document that
   will actually render the content keeps the two in sync.
   ========================================================================= */
(function () {
  "use strict";

  /* -------------------------------------------------------------------- *
   *  Geometry (mm) — A4 landscape sheet, split into two halves            *
   *  (kept here too, only to compute mm-based CSS values for the          *
   *   stylesheet; the popup engine below has its own copy for measuring)  *
   * -------------------------------------------------------------------- */
  var HALF_H     = 210;
  var MARGIN     = 7;
  var GUTTER     = 5;
  var PAGE_NUM_H = 6;
  var COL_GAP    = 4;
  var COLS       = 2;
  var HALF_W     = 148;
  var CONTENT_W  = HALF_W - MARGIN * 2 - GUTTER;
  var CONTENT_H  = HALF_H - MARGIN * 2 - PAGE_NUM_H;
  var COL_W      = (CONTENT_W - COL_GAP * (COLS - 1)) / COLS;

  /* -------------------------------------------------------------------- *
   *  Settings (Column Mode + Page Number Position) — remembered per      *
   *  browser via localStorage, editable via the ⚙ Booklet Settings       *
   *  button next to the Booklet Print buttons.                           *
   * -------------------------------------------------------------------- */
  var SETTINGS_KEY = "bookletSettings";

  function getBookletSettings() {
    var s = {};
    try { s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}"); } catch (e) {}
    var columnMode = s.columnMode === "sequential" ? "sequential" : "balanced"; // default: Balanced
    var pos = ["bottom-left", "bottom-right", "bottom-center"].indexOf(s.pageNumberPos) !== -1
      ? s.pageNumberPos
      : "bottom-center"; // default: Bottom Center
    return { columnMode: columnMode, pageNumberPos: pos };
  }

  function saveBookletSettings(s) {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch (e) {}
  }

  window.openBookletSettings = function () {
    var existing = document.getElementById("bp-settings-overlay");
    if (existing) existing.remove();

    var cur = getBookletSettings();
    var overlay = document.createElement("div");
    overlay.id = "bp-settings-overlay";
    overlay.style.cssText =
      "position:fixed;inset:0;background:rgba(17,24,39,.55);z-index:99999;" +
      "display:flex;align-items:center;justify-content:center;";
    overlay.innerHTML =
      '<div style="background:#fff;border-radius:12px;padding:22px 24px;width:340px;max-width:92vw;' +
      'font-family:Inter,\'Noto Sans Devanagari\',sans-serif;box-shadow:0 12px 44px rgba(0,0,0,.4);">' +
        '<h3 style="margin:0 0 16px;font-size:15px;color:#1a0533;">📖 Booklet Print Settings</h3>' +

        '<label style="display:block;font-size:12px;font-weight:700;color:#374151;margin-bottom:5px;">Column Fill Mode</label>' +
        '<select id="bp-set-colmode" style="width:100%;padding:8px 9px;border:1px solid #d1d5db;border-radius:7px;margin-bottom:6px;font-size:13px;">' +
          '<option value="balanced">Balanced — dono columns barabar bharenge</option>' +
          '<option value="sequential">Sequential — pehle Column 1 poora bharega</option>' +
        '</select>' +
        '<p style="margin:0 0 14px;font-size:11px;color:#6b7280;">Default: Balanced</p>' +

        '<label style="display:block;font-size:12px;font-weight:700;color:#374151;margin-bottom:5px;">Page Number Position</label>' +
        '<select id="bp-set-pnpos" style="width:100%;padding:8px 9px;border:1px solid #d1d5db;border-radius:7px;margin-bottom:6px;font-size:13px;">' +
          '<option value="bottom-center">Bottom Center</option>' +
          '<option value="bottom-left">Bottom Left</option>' +
          '<option value="bottom-right">Bottom Right</option>' +
        '</select>' +
        '<p style="margin:0 0 18px;font-size:11px;color:#6b7280;">Default: Bottom Center</p>' +

        '<div style="display:flex;gap:8px;justify-content:flex-end;">' +
          '<button id="bp-set-cancel" style="padding:9px 16px;border:0;border-radius:7px;background:#e5e7eb;color:#111;font-weight:700;cursor:pointer;">Cancel</button>' +
          '<button id="bp-set-save" style="padding:9px 16px;border:0;border-radius:7px;background:#4a0e8f;color:#fff;font-weight:700;cursor:pointer;">Save</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(overlay);
    overlay.querySelector("#bp-set-colmode").value = cur.columnMode;
    overlay.querySelector("#bp-set-pnpos").value = cur.pageNumberPos;

    overlay.addEventListener("click", function (e) { if (e.target === overlay) overlay.remove(); });
    overlay.querySelector("#bp-set-cancel").onclick = function () { overlay.remove(); };
    overlay.querySelector("#bp-set-save").onclick = function () {
      saveBookletSettings({
        columnMode: overlay.querySelector("#bp-set-colmode").value,
        pageNumberPos: overlay.querySelector("#bp-set-pnpos").value
      });
      overlay.remove();
      if (typeof toast === "function") toast("✅ Booklet settings saved");
    };
  };

  /* -------------------------------------------------------------------- *
   *  STEP 1 — Collect questions + header (runs in the PARENT app window)  *
   * -------------------------------------------------------------------- */
  function collectQuestions() {
    // v229 Multiple Sets: jo set preview me chuna hai, usi set ke order + option order me print/export
    try {
      if (window.QGSets && typeof window.QGSets.flat === "function") return window.QGSets.flat();
    } catch (e) {}
    try {
      if (typeof isSectionMode === "function" && isSectionMode() && typeof getAllQuestionsFlat === "function") {
        return getAllQuestionsFlat();
      }
    } catch (e) {}
    try { if (typeof paperQuestions !== "undefined") return paperQuestions || []; } catch (e) {}
    return [];
  }

  function optionsHtml(q) {
    if (q.qType === "subjective") {
      var marks = (q.marks !== undefined && q.marks !== null && q.marks !== "") ? (q.marks + " marks") : "";
      return '<div class="bp-sub-badge">📝' + (marks ? " · " + marks : "") + '</div>';
    }
    var labels = typeof LABELS !== "undefined" ? LABELS : ["A", "B", "C", "D"];
    return (q.opts || []).map(function (opt, i) {
      return '<div class="bp-opt"><span class="bp-opt-tag">[' + labels[i] + ']</span><span class="math-text">' + opt + '</span></div>';
    }).join("");
  }

  function headerHtml() {
    var header = document.querySelector("#paper .paper-header");
    var instr = document.getElementById("paper-instr");
    var wrap = '<div class="bp-header-wrap">' + (window.SnapBrand && window.SnapBrand.printBar ? window.SnapBrand.printBar() : "");
    if (header) wrap += header.outerHTML;
    if (instr) wrap += instr.outerHTML;
    wrap += "</div>";
    return wrap;
  }

  function questionItemsHtml(questions) {
    return questions.map(function (q, i) {
      return '<div class="bp-item"><div class="bp-qhead"><span class="bp-num">' + (i + 1) + '.</span>' +
        '<span class="math-text">' + q.text + '</span></div>' +
        '<div class="bp-opts">' + optionsHtml(q) + '</div></div>';
    });
  }

  /* -------------------------------------------------------------------- *
   *  Stylesheet shared by the print window (Logical + Imposition views)   *
   * -------------------------------------------------------------------- */
  function stylesheet() {
    return [
      "@page{size:A4 landscape;margin:0}",
      "*{box-sizing:border-box}",
      'body{margin:0;font-family:"Inter","Noto Sans Devanagari",sans-serif;background:#525659}',

      ".bp-toolbar{position:sticky;top:0;z-index:9;background:#111827;color:#fff;display:flex;align-items:center;gap:16px;flex-wrap:wrap;padding:10px 18px;font-size:12.5px}",
      ".bp-toolbar b{color:#facc15}",
      ".bp-toolbar-hint{opacity:.85;font-size:11.5px}",
      ".bp-toolbar button{background:#4a0e8f;color:#fff;border:0;border-radius:6px;padding:8px 14px;font-weight:700;cursor:pointer;font-size:12px}",
      ".bp-toolbar > button{margin-left:auto}",
      ".bp-view-toggle{display:flex;gap:6px;margin-left:auto}",
      ".bp-view-toggle button{background:#374151;opacity:.8}",
      ".bp-view-toggle button.active{background:#4a0e8f;opacity:1}",

      ".bp-logical-view,.bp-imposition-view{display:flex;flex-direction:column;align-items:center;gap:14px;padding:14px 0 40px}",

      // ---- Imposition / print view: physical landscape sheets ----
      ".bp-sheet{width:297mm;height:210mm;background:#fff;display:flex;box-shadow:0 2px 10px rgba(0,0,0,.35);page-break-after:always;break-after:page}",
      ".bp-half{width:148.5mm;height:210mm;padding:" + MARGIN + "mm;overflow:hidden;position:relative}",
      ".bp-half-left{padding-right:" + (MARGIN + GUTTER) + "mm}",
      ".bp-half-right{padding-left:" + (MARGIN + GUTTER) + "mm}",
      ".bp-half-blank{background:repeating-linear-gradient(45deg,#fafafa,#fafafa 10px,#fff 10px,#fff 20px)}",
      ".bp-fold{width:0;border-left:1px dashed #cbd5e1}",
      ".bp-half-inner{width:" + CONTENT_W + "mm;height:" + CONTENT_H + "mm;overflow:hidden;position:relative}",

      // ---- Logical page preview: standalone cards, same proportions ----
      ".bp-logical-page{width:" + (CONTENT_W + MARGIN * 2 + GUTTER) + "mm;background:#fff;box-shadow:0 2px 10px rgba(0,0,0,.35);padding:" + MARGIN + "mm}",
      ".bp-logical-label{font-size:12px;font-weight:800;color:#4a0e8f;text-transform:uppercase;letter-spacing:.06em;margin-bottom:5px}",

      ".bp-header-wrap{margin:-2px -2px 6px;border-radius:4px;overflow:hidden}",
      ".paper-header{background:linear-gradient(135deg,#1a0533,#2d0a5e 50%,#1a0533);padding:0}",
      ".paper-header-top{display:flex;align-items:center;justify-content:space-between;padding:6px 8px 4px;gap:6px}",
      ".hbadge{background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.28);color:#fff;font-size:9.5px;font-weight:700;padding:2px 6px;border-radius:3px;white-space:nowrap}",
      ".htopic{color:#ffd700;font-size:11.5px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;text-align:center;flex:1}",
      ".paper-header-meta{display:flex;align-items:center;justify-content:center;gap:8px;padding:3px 8px 5px;color:rgba(255,255,255,.88);font-size:9.5px;font-weight:500;border-top:1px solid rgba(255,255,255,.1)}",
      ".sep{color:rgba(255,255,255,.3)}",
      ".paper-instructions{background:#fffbeb;border-left:2px solid #f59e0b;padding:4px 6px;font-size:9px;color:#78350f;line-height:1.4}",

      ".bp-cols{display:flex;gap:" + COL_GAP + "mm;align-items:flex-start;height:100%}",
      ".bp-col{width:" + COL_W + "mm;flex:0 0 " + COL_W + "mm;overflow:hidden}",
      ".bp-col:not(:first-child){border-left:1px dashed #d1d5db;padding-left:" + (COL_GAP / 2) + "mm;margin-left:-" + (COL_GAP / 2) + "mm}",
      ".bp-item{padding:4px 0;border-bottom:1px dashed #e2e8f0;break-inside:avoid;page-break-inside:avoid}",
      ".bp-item:last-child{border-bottom:none}",
      ".bp-qhead{display:flex;gap:4px;font-size:10px;line-height:1.4;color:#111827}",
      ".bp-num{font-weight:800;color:#4a0e8f;flex-shrink:0}",
      ".bp-opts{display:flex;flex-direction:column;gap:2px;padding-left:11px;margin-top:2px}",
      ".bp-opt{display:flex;gap:3px;font-size:9.5px;color:#1f2937;line-height:1.35}",
      ".bp-opt-tag{font-weight:700;color:#4a0e8f;flex-shrink:0}",
      ".bp-sub-badge{margin-left:11px;margin-top:2px;font-size:9.5px;color:#92400e;font-weight:600}",

      ".bp-pagenum{position:absolute;left:0;right:0;bottom:1.5mm;font-size:9px;font-weight:800;color:#4a0e8f}",
      ".bp-pn-bottom-center{text-align:center}",
      ".bp-pn-bottom-left{text-align:left;padding-left:2mm}",
      ".bp-pn-bottom-right{text-align:right;padding-right:2mm}",

      // shown briefly while the popup measures + paginates
      ".bp-loading{padding:40px;color:#fff;text-align:center;font-size:13px}",

      "@media print{",
      "body{background:#fff}",
      ".no-print{display:none!important}",
      ".bp-imposition-view{padding:0;gap:0}",
      ".bp-sheet{box-shadow:none}",
      "}"
    ].join("\n");
  }

  /* -------------------------------------------------------------------- *
   *  Engine that runs INSIDE the popup print window. Written as a plain   *
   *  source string so that, once injected into that window's <script>    *
   *  tag, every `document`/`window` reference inside it resolves to the  *
   *  POPUP's own document — which is what actually carries the           *
   *  stylesheet above. That's what makes measurement accurate.           *
   * -------------------------------------------------------------------- */
  function popupEngineSource() {
    return [
      '(function () {',
      '  "use strict";',
      '  var MM2PX = 3.7795275590551185;',
      '  var HALF_H = ' + HALF_H + ', MARGIN = ' + MARGIN + ', GUTTER = ' + GUTTER + ', PAGE_NUM_H = ' + PAGE_NUM_H + ', COL_GAP = ' + COL_GAP + ', HALF_W = ' + HALF_W + ';',
      '  var CONTENT_W = HALF_W - MARGIN * 2 - GUTTER;',
      '  var CONTENT_H = HALF_H - MARGIN * 2 - PAGE_NUM_H;',
      '  var CONTENT_W_PX = Math.floor(CONTENT_W * MM2PX);',
      '  var CONTENT_H_PX = Math.floor(CONTENT_H * MM2PX);',
      '  var COL_W_PX = Math.floor(((CONTENT_W - ' + COL_GAP + ' * 1) / 2) * MM2PX);',

      /* ---- pagination (measures using THIS document's real CSS) ---- */
      '  function buildLogicalPages(headerHtmlStr, itemsHtml, settings) {',
      '    var headerBox = document.createElement("div");',
      '    headerBox.style.cssText = "position:fixed;left:-9999px;top:0;width:" + CONTENT_W_PX + "px;visibility:hidden;pointer-events:none;";',
      '    document.body.appendChild(headerBox);',
      '    headerBox.innerHTML = headerHtmlStr || "";',
      '    var headerH = headerHtmlStr ? headerBox.getBoundingClientRect().height : 0;',
      '    headerBox.remove();',

      '    var measureBox = document.createElement("div");',
      '    measureBox.className = "bp-col";',
      '    measureBox.style.cssText = "position:fixed;left:-9999px;top:0;width:" + COL_W_PX + "px;visibility:hidden;pointer-events:none;";',
      '    document.body.appendChild(measureBox);',
      '    var heights = itemsHtml.map(function (html) {',
      '      measureBox.innerHTML = html;',
      '      return measureBox.getBoundingClientRect().height;',
      '    });',
      '    measureBox.remove();',

      '    var pages = [], idx = 0, n = itemsHtml.length, pageNum = 0;',
      '    while (idx < n) {',
      '      pageNum++;',
      '      var isFirstPage = pages.length === 0;',
      '      var avail = CONTENT_H_PX - (isFirstPage ? headerH : 0);',
      '      var budget = avail * 2;',

      '      var runEnd = idx, sum = 0;',
      '      while (runEnd < n) {',
      '        var h = heights[runEnd];',
      '        if (sum > 0 && sum + h > budget) break;',
      '        sum += h;',
      '        runEnd++;',
      '      }',
      '      if (runEnd === idx) runEnd = idx + 1;',

      '      var runItems = itemsHtml.slice(idx, runEnd);',
      '      var runHeights = heights.slice(idx, runEnd);',
      '      var left, right, splitAt, colH, i;',

      '      if (settings.columnMode === "sequential") {',
      '        colH = 0; splitAt = runItems.length;',
      '        for (i = 0; i < runItems.length; i++) {',
      '          if (colH > 0 && colH + runHeights[i] > avail) { splitAt = i; break; }',
      '          colH += runHeights[i];',
      '        }',
      '      } else {',
      '        var total = runHeights.reduce(function (a, b) { return a + b; }, 0);',
      '        var half = total / 2;',
      '        colH = 0; splitAt = runItems.length;',
      '        for (i = 0; i < runItems.length; i++) {',
      '          if (colH + runHeights[i] > avail) { splitAt = i; break; }',
      '          if (colH > 0 && colH + runHeights[i] > half) { splitAt = i; break; }',
      '          colH += runHeights[i];',
      '        }',
      '      }',
      '      left = runItems.slice(0, splitAt);',
      '      right = runItems.slice(splitAt);',

      '      pages.push({ num: pageNum, left: left, right: right, hasHeader: isFirstPage });',
      '      idx = runEnd;',
      '    }',
      '    if (!pages.length) pages.push({ num: 1, left: [], right: [], hasHeader: true });',
      '    return pages;',
      '  }',

      '  function renderPageInner(page, headerHtmlStr, settings) {',
      '    var cols = \'<div class="bp-cols"><div class="bp-col">\' + page.left.join("") + \'</div><div class="bp-col">\' + page.right.join("") + "</div></div>";',
      '    var header = page.hasHeader ? headerHtmlStr : "";',
      '    var pageNum = \'<div class="bp-pagenum bp-pn-\' + settings.pageNumberPos + \'">\' + page.num + "</div>";',
      '    return header + cols + pageNum;',
      '  }',

      '  function imposeBooklet(pages) {',
      '    var t = pages.slice();',
      '    while (t.length % 4 !== 0) t.push(null);',
      '    var a = t.length, sheets = [];',
      '    for (var n = 0; n < a / 4; n++) {',
      '      var s = a - 2 * n - 1, d = 2 * n, i = 2 * n + 1, o = a - 2 * n - 2;',
      '      sheets.push({ front: [t[s] || null, t[d] || null], back: [t[i] || null, t[o] || null] });',
      '    }',
      '    return sheets;',
      '  }',

      '  function renderHalf(page, headerHtmlStr, settings, side) {',
      '    var blank = !page;',
      '    var inner = blank ? "" : renderPageInner(page, headerHtmlStr, settings);',
      '    return \'<div class="bp-half bp-half-\' + side + (blank ? " bp-half-blank" : "") + \'"><div class="bp-half-inner">\' + inner + "</div></div>";',
      '  }',

      '  function renderSheet(sheetSide, headerHtmlStr, settings) {',
      '    return \'<div class="bp-sheet">\' + renderHalf(sheetSide[0], headerHtmlStr, settings, "left") + \'<div class="bp-fold"></div>\' + renderHalf(sheetSide[1], headerHtmlStr, settings, "right") + "</div>";',
      '  }',

      '  function renderLogicalView(pages, headerHtmlStr, settings) {',
      '    return pages.map(function (page) {',
      '      return \'<div class="bp-logical-page"><div class="bp-logical-label">Page \' + page.num + \'</div><div class="bp-half-inner">\' + renderPageInner(page, headerHtmlStr, settings) + "</div></div>";',
      '    }).join("");',
      '  }',

      '  function render() {',
      '    var data = window.__BOOKLET_DATA__;',
      '    var pages = buildLogicalPages(data.header, data.items, data.settings);',
      '    var sheets = imposeBooklet(pages);',
      '    var impositionHtml = sheets.map(function (sheet) {',
      '      return renderSheet(sheet.front, data.header, data.settings) + renderSheet(sheet.back, data.header, data.settings);',
      '    }).join("");',
      '    var logicalHtml = renderLogicalView(pages, data.header, data.settings);',

      '    document.getElementById("bp-logical-view").innerHTML = logicalHtml;',
      '    document.getElementById("bp-imposition-view").innerHTML = impositionHtml;',

      '    var modeLabel = data.settings.columnMode === "sequential" ? "Sequential" : "Balanced";',
      '    var posLabels = { "bottom-center": "Bottom Center", "bottom-left": "Bottom Left", "bottom-right": "Bottom Right" };',
      '    document.getElementById("bp-toolbar-info").textContent =',
      '      pages.length + " page" + (pages.length > 1 ? "s" : "") + " · " + sheets.length + " sheet" + (sheets.length > 1 ? "s" : "") +',
      '      " · 2 columns/page · " + modeLabel + " · Page #: " + posLabels[data.settings.pageNumberPos];',

      '    if (window.renderMathInElement) {',
      '      renderMathInElement(document.body, { delimiters: [{ left: "$$", right: "$$", display: true }, { left: "$", right: "$", display: false }], throwOnError: false });',
      '    }',
      '    bpShowView("imposition");',
      '  }',

      '  window.bpShowView = function (v) {',
      '    document.getElementById("bp-logical-view").style.display = v === "logical" ? "flex" : "none";',
      '    document.getElementById("bp-imposition-view").style.display = v === "imposition" ? "flex" : "none";',
      '    document.getElementById("bp-view-logical-btn").classList.toggle("active", v === "logical");',
      '    document.getElementById("bp-view-imposition-btn").classList.toggle("active", v === "imposition");',
      '  };',
      '  window.bpPrintNow = function () { bpShowView("imposition"); setTimeout(function () { window.print(); }, 60); };',
      '  window.bpRender = render;',

      '  if (document.readyState === "loading") {',
      '    document.addEventListener("DOMContentLoaded", render);',
      '  } else {',
      '    render();',
      '  }',
      '})();'
    ].join("\n");
  }

  /* -------------------------------------------------------------------- *
   *  Full HTML document assembly for the popup                            *
   * -------------------------------------------------------------------- */
  function escapeScriptClose(str) {
    return str.replace(/<\/script/gi, "<\\/script");
  }

  function buildDocument(header, items, settings) {
    var dataJson = escapeScriptClose(JSON.stringify({ header: header, items: items, settings: settings }));

    var head =
      '<meta charset="UTF-8"/><title>Booklet Print</title>' +
      '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Noto+Sans+Devanagari:wght@400;500;600;700&display=swap" rel="stylesheet"/>' +
      '<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.css"/>' +
      '<script src="https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.js"><\/script>' +
      '<script src="https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/contrib/auto-render.min.js"><\/script>' +
      '<style>' + stylesheet() + '</style>';

    var toolbar =
      '<div class="bp-toolbar no-print">' +
        '<div><b>📖 Booklet Print Ready</b> — <span id="bp-toolbar-info">calculating layout…</span></div>' +
        '<div class="bp-toolbar-hint">Print dialog mein: <b>Two-sided → Flip on Short Edge</b> · Paper <b>A4</b> · Layout <b>Landscape</b> · Margins <b>None</b></div>' +
        '<div class="bp-view-toggle">' +
          '<button id="bp-view-logical-btn" onclick="bpShowView(\'logical\')">🗂 Logical Pages</button>' +
          '<button id="bp-view-imposition-btn" class="active" onclick="bpShowView(\'imposition\')">🖨 Landscape / Print View</button>' +
        '</div>' +
        '<button onclick="bpPrintNow()">🖨️ Print Now</button>' +
      '</div>';

    var body =
      '<div id="bp-logical-view" class="bp-logical-view" style="display:none"><div class="bp-loading">Layout calculate ho raha hai…</div></div>' +
      '<div id="bp-imposition-view" class="bp-imposition-view"><div class="bp-loading">Layout calculate ho raha hai…</div></div>';

    var script =
      '<script>window.__BOOKLET_DATA__ = ' + dataJson + ';<\/script>' +
      '<script>' + escapeScriptClose(popupEngineSource()) + '<\/script>';

    return "<!DOCTYPE html><html><head>" + head + "</head><body>" + toolbar + body + script + "</body></html>";
  }

  /* -------------------------------------------------------------------- *
   *  Logical-page pagination for the WORD export.                        *
   *  Same measuring algorithm as buildLogicalPages() inside the print     *
   *  popup (see popupEngineSource above) — kept as a real, callable      *
   *  function here (instead of only a string run in the popup) so it     *
   *  can hand back QUESTION INDICES instead of rendered HTML. Word needs  *
   *  the original {q} objects (for docxQuestionBlock/math), not markup.  *
   *  NOTE: if you change the pagination logic in popupEngineSource, port  *
   *  the same change here so print and Word export stay in sync.         *
   * -------------------------------------------------------------------- */
  // Word (.docx) has no way to clip a table cell to an exact height the way
  // the print engine's CSS box can — if our height estimate runs even a
  // little optimistic, the real .docx overflows past the intended page
  // instead of being cropped. The estimate itself can never be pixel-exact
  // for Word specifically, because Word renders question/option text with
  // the WORD_BODY_SIZE compact font below (see exportBookletToWord) rather
  // than through the same browser layout used to measure heights here, and
  // native equation (fraction/radical) zones render at Word's own default
  // math size no matter what font size we ask for. WORD_SAFETY_FACTOR trims
  // the usable budget so a small estimation gap never turns into a question
  // or the "Page N" label spilling onto the next sheet. Only the Word export
  // uses this — the print/PDF popup's own buildLogicalPages() is unaffected
  // and keeps using the full measured budget, since there the same CSS does
  // both the measuring and the rendering, so it isn't a fit-guess.
  var WORD_SAFETY_FACTOR = 0.88;

  function buildLogicalPagesForWord(headerHtmlStr, itemsHtml, settings) {
    var MM2PX = 3.7795275590551185;
    var CONTENT_W_PX = Math.floor(CONTENT_W * MM2PX);
    var CONTENT_H_PX = Math.floor(CONTENT_H * MM2PX) * WORD_SAFETY_FACTOR;
    var COL_W_PX = Math.floor(((CONTENT_W - COL_GAP * 1) / 2) * MM2PX);

    // make sure measurement uses the same fonts/spacing as the real print
    if (!document.getElementById("bp-word-measure-style")) {
      var styleEl = document.createElement("style");
      styleEl.id = "bp-word-measure-style";
      styleEl.textContent = stylesheet();
      document.head.appendChild(styleEl);
    }

    var headerBox = document.createElement("div");
    headerBox.style.cssText = "position:fixed;left:-9999px;top:0;width:" + CONTENT_W_PX + "px;visibility:hidden;pointer-events:none;";
    document.body.appendChild(headerBox);
    headerBox.innerHTML = headerHtmlStr || "";
    var headerH = headerHtmlStr ? headerBox.getBoundingClientRect().height : 0;
    headerBox.remove();

    var measureBox = document.createElement("div");
    measureBox.className = "bp-col";
    measureBox.style.cssText = "position:fixed;left:-9999px;top:0;width:" + COL_W_PX + "px;visibility:hidden;pointer-events:none;";
    document.body.appendChild(measureBox);
    var heights = itemsHtml.map(function (html) {
      measureBox.innerHTML = html;
      return measureBox.getBoundingClientRect().height;
    });
    measureBox.remove();

    var pages = [], idx = 0, n = itemsHtml.length, pageNum = 0;
    while (idx < n) {
      pageNum++;
      var isFirstPage = pages.length === 0;
      var avail = CONTENT_H_PX - (isFirstPage ? headerH : 0);
      var budget = avail * 2;

      var runEnd = idx, sum = 0;
      while (runEnd < n) {
        var h = heights[runEnd];
        if (sum > 0 && sum + h > budget) break;
        sum += h;
        runEnd++;
      }
      if (runEnd === idx) runEnd = idx + 1;

      var runIdx = [];
      for (var k = idx; k < runEnd; k++) runIdx.push(k);
      var runHeights = heights.slice(idx, runEnd);
      var left, right, splitAt, colH, i;

      if (settings.columnMode === "sequential") {
        colH = 0; splitAt = runIdx.length;
        for (i = 0; i < runIdx.length; i++) {
          if (colH > 0 && colH + runHeights[i] > avail) { splitAt = i; break; }
          colH += runHeights[i];
        }
      } else {
        var total = runHeights.reduce(function (a, b) { return a + b; }, 0);
        var half = total / 2;
        colH = 0; splitAt = runIdx.length;
        for (i = 0; i < runIdx.length; i++) {
          if (colH + runHeights[i] > avail) { splitAt = i; break; }
          if (colH > 0 && colH + runHeights[i] > half) { splitAt = i; break; }
          colH += runHeights[i];
        }
      }
      left = runIdx.slice(0, splitAt);
      right = runIdx.slice(splitAt);

      pages.push({ num: pageNum, left: left, right: right, hasHeader: isFirstPage });
      idx = runEnd;
    }
    if (!pages.length) pages.push({ num: 1, left: [], right: [], hasHeader: true });
    return pages;
  }

  function docxNoBorders() {
    return {
      top: { style: docx.BorderStyle.NONE },
      bottom: { style: docx.BorderStyle.NONE },
      left: { style: docx.BorderStyle.NONE },
      right: { style: docx.BorderStyle.NONE },
      insideHorizontal: { style: docx.BorderStyle.NONE },
      insideVertical: { style: docx.BorderStyle.NONE }
    };
  }

  function docxPageNumberAlign(pos) {
    if (pos === "bottom-left") return docx.AlignmentType.LEFT;
    if (pos === "bottom-right") return docx.AlignmentType.RIGHT;
    return docx.AlignmentType.CENTER;
  }

  /* Content of ONE internal column (left or right half of a logical page).
   * `runOpts` (size/font) is threaded down to docxQuestionBlock so the
   * REAL rendered font matches what buildLogicalPagesForWord measured —
   * see WORD_BODY_SIZE in exportBookletToWord for why this exists. */
  function docxColumnChildren(idxArr, questions, runOpts) {
    var children = [];
    idxArr.forEach(function (qi) {
      children = children.concat(docxQuestionBlock(qi + 1, questions[qi], runOpts));
    });
    if (!children.length) children.push(new docx.Paragraph({ text: "" }));
    return children;
  }

  /* Content of ONE logical page = optional header + its own 2 columns + page no. */
  function docxLogicalPageChildren(page, questions, headerChildren, pageNumberPos, runOpts) {
    if (!page) return [new docx.Paragraph({ text: "" })];
    var children = [];
    if (page.hasHeader) children = children.concat(headerChildren);
    children.push(new docx.Table({
      width: { size: 100, type: docx.WidthType.PERCENTAGE },
      borders: docxNoBorders(),
      rows: [new docx.TableRow({
        children: [
          new docx.TableCell({
            width: { size: 50, type: docx.WidthType.PERCENTAGE },
            margins: { right: 120 },
            children: docxColumnChildren(page.left, questions, runOpts)
          }),
          new docx.TableCell({
            width: { size: 50, type: docx.WidthType.PERCENTAGE },
            margins: { left: 120 },
            borders: { left: { style: docx.BorderStyle.DASHED, size: 4, color: "CBD5E1" } },
            children: docxColumnChildren(page.right, questions, runOpts)
          })
        ]
      })]
    }));
    children.push(new docx.Paragraph({
      alignment: docxPageNumberAlign(pageNumberPos),
      spacing: { before: 100 },
      children: [new docx.TextRun({ text: "Page " + page.num, bold: true, color: "4A0E8F", size: 16 })]
    }));
    return children;
  }

  /* -------------------------------------------------------------------- *
   *  Booklet → Word (.docx)                                               *
   *  Mirrors the real print imposition: one physical (landscape) Word     *
   *  page = 2 logical booklet pages side by side (fold line between       *
   *  them), each logical page split into its own 2 question columns —    *
   *  same structure as "Landscape / Print View", but as a real,           *
   *  manually-editable Word file (native paragraphs/tables, not an       *
   *  image). Logical pages are kept in natural reading order (1, 2, 3…)   *
   *  rather than the front/back fold order used for physical printing.    *
   *  Reuses the exact math/HTML→Word helpers (htmlToDocxRuns /            *
   *  mathToWordHtml / docxQuestionBlock) that the normal "Download Word"  *
   *  button already uses, defined in qgen-app.js and loaded before this   *
   *  file — so MCQ option tables and LaTeX rendering behave identically   *
   *  to the regular Word export.                                          *
   * -------------------------------------------------------------------- */
  window.exportBookletToWord = async function () {
    var questions = collectQuestions();
    if (!questions.length) {
      alert("Pehle paper mein kam se kam ek question add karein.");
      return;
    }
    if (!window.docx && window.__ensureLib) {
      try { await window.__ensureLib("docx"); } catch (e) {}
    }
    if (!window.docx || typeof docxQuestionBlock !== "function") {
      alert("Word export library load nahi hui — internet check karke page reload karein.");
      return;
    }

    var testNo = (document.getElementById("testNo") || {}).value || "";
    var subject = (document.getElementById("subject") || {}).value || "";
    var timeMin = (document.getElementById("timeMin") || {}).value || "";
    var maxMarks = (document.getElementById("maxMarks") || {}).value || "";
    var instructions = (document.getElementById("instructions") || {}).value || "";

    // Compact sizes (half-points) for the BOOKLET Word export only — chosen to
    // match the small booklet-print CSS (stylesheet() above: .bp-qhead 10px,
    // .bp-opt 9.5px, header ~9-11.5px) that buildLogicalPagesForWord() actually
    // measures against. docx.HeadingLevel.HEADING1/HEADING2 (used before) pull
    // in Word's built-in 16pt/13pt defaults — nearly double what was measured —
    // which is why the header's own logical page (Page 1) was the one
    // overflowing. The plain "Download Word" full-page export is untouched;
    // docxQuestionBlock/docxOptionCell only apply a custom size when passed
    // one, so it keeps its normal, larger, more readable font.
    var WORD_TITLE_SIZE = 18; // 9pt  — Test No / Subject line
    var WORD_META_SIZE = 15;  // 7.5pt — Time / MM line
    var WORD_INSTR_SIZE = 14; // 7pt  — Instructions line
    var WORD_BODY_SIZE = 16;  // 8pt  — question text + MCQ options

    var headerChildren = [
      new docx.Paragraph({ alignment: docx.AlignmentType.CENTER, spacing: { after: 20 }, children: [new docx.TextRun({ text: ("TEST NO. " + testNo).toUpperCase(), bold: true, size: WORD_TITLE_SIZE })] }),
      new docx.Paragraph({ alignment: docx.AlignmentType.CENTER, spacing: { after: 30 }, children: [new docx.TextRun({ text: subject.toUpperCase(), bold: true, size: WORD_TITLE_SIZE, color: "4A0E8F" })] }),
      new docx.Paragraph({ alignment: docx.AlignmentType.CENTER, spacing: { after: 40 }, children: [new docx.TextRun({ text: "Time: " + timeMin + " min    |    MM: " + maxMarks, size: WORD_META_SIZE })] }),
      new docx.Paragraph({ border: { bottom: { color: "000000", space: 2, style: docx.BorderStyle.SINGLE, size: 4 } }, spacing: { after: 40 }, text: "" }),
      new docx.Paragraph({ spacing: { after: 100 }, children: [new docx.TextRun({ text: "Instructions: " + instructions, italics: true, size: WORD_INSTR_SIZE })] })
    ];
    var bodyRunOpts = { size: WORD_BODY_SIZE };

    var settings = getBookletSettings();
    var itemsHtml = questionItemsHtml(questions);
    var headerStr = headerHtml();
    var logicalPages = buildLogicalPagesForWord(headerStr, itemsHtml, settings);

    // pair logical pages 2-per-physical-sheet, in natural reading order
    // (1&2, 3&4, …) — NOT the front/back fold order used for print/staple.
    var sheetChildren = [];
    for (var s = 0; s < logicalPages.length; s += 2) {
      var leftPage = logicalPages[s];
      var rightPage = logicalPages[s + 1] || null;

      if (s > 0) sheetChildren.push(new docx.Paragraph({ children: [new docx.PageBreak()] }));

      sheetChildren.push(new docx.Table({
        width: { size: 100, type: docx.WidthType.PERCENTAGE },
        borders: docxNoBorders(),
        rows: [new docx.TableRow({
          children: [
            new docx.TableCell({
              width: { size: 50, type: docx.WidthType.PERCENTAGE },
              margins: { right: 200 },
              children: docxLogicalPageChildren(leftPage, questions, headerChildren, settings.pageNumberPos, bodyRunOpts)
            }),
            new docx.TableCell({
              width: { size: 50, type: docx.WidthType.PERCENTAGE },
              margins: { left: 200 },
              borders: { left: { style: docx.BorderStyle.DASHED, size: 6, color: "94A3B8" } },
              children: docxLogicalPageChildren(rightPage, questions, headerChildren, settings.pageNumberPos, bodyRunOpts)
            })
          ]
        })]
      }));
    }

    var doc = new docx.Document({
      sections: [{
        properties: {
          page: {
            size: { orientation: docx.PageOrientation.LANDSCAPE },
            margin: { top: 500, bottom: 500, left: 500, right: 500 }
          }
        },
        children: sheetChildren
      }]
    });

    var filename = "Booklet_" + (testNo || "Paper") + ".docx";
    try {
      var blob = await docx.Packer.toBlob(doc);
      try {
        var file = new File([blob], filename, { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: filename, text: "Booklet (Word file)" });
          if (typeof toast === "function") toast("📄 Booklet Word (.docx) file share ho gayi!");
          return;
        }
      } catch (shareErr) {
        console.warn("Share failed, falling back to direct download:", shareErr);
      }
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      if (typeof toast === "function") toast("📄 Booklet Word (.docx) file download shuru ho gayi!");
    } catch (err) {
      console.error(err);
      alert("Booklet Word file banane mein error: " + (err.message || err));
    }
  };

  /* -------------------------------------------------------------------- *
   *  Entry point                                                          *
   * -------------------------------------------------------------------- */
  window.printPaperBooklet = function () {
    var questions = collectQuestions();
    if (!questions.length) {
      alert("Pehle paper mein kam se kam ek question add karein.");
      return;
    }
    var settings = getBookletSettings();
    var header = headerHtml();
    var items = questionItemsHtml(questions);
    var doc = buildDocument(header, items, settings);

    var win = window.open("", "_blank");
    if (!win) {
      alert("Popup blocked ho gaya — browser mein is site ke liye popups allow karein aur dobara try karein.");
      return;
    }
    win.document.open();
    win.document.write(doc);
    win.document.close();
  };
})();
