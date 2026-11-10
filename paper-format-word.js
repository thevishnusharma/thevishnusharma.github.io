/* ============================================================================
   PAPER FORMAT WORD  ("Test_4" format)  — v1
   ----------------------------------------------------------------------------
   Naya, ALAG module. Koi purana function (exportToWord / exportBookletToWord /
   printPaperBooklet) nahi chheda gaya.

   Button: "📄 Paper Format Word"  ->  window.exportPaperFormatWord()

   Output = A4 landscape, margins 0.25" (print-safe). Booklet pages ki ginti
   questions ke hisaab se khud banti hai: 4, 8, 12 ... 40 pages (= N/2 Word pages).
   Har Word page = 2 half-pages, har half-page me 2 columns. Imposition (N pages):
        sheet s : front [N-2s | 1+2s] , back [2+2s | N-1-2s]
   N = 8 par:  [8|1] [2|7] [6|3] [4|5]   (page 1 = header box + instruction)

   - MCQ        : page 1 se aage, column 1 pehle poora bharta hai, phir column 2.
                  Ek question kabhi beech me nahi kategta.
   - Subjective : aakhri page(s) par (N-1 / N), single column list.
   - Page numbers print NAHI hote.

   Pagination kaise: har question ki height Word ke hisaab se estimate hoti hai
   (fixed line-height + text-width estimate + fraction/root ka extra). Paragraphs
   me line-height EXACT rakhi hai (jahan math nahi) taaki Word ki font-metrics
   se height na badle. Estimate me ~8% safety margin hai (SAFETY).
   Math (fraction / root) wahi helpers use karte hain jo normal "Download Word"
   karta hai: htmlToDocxRuns + mathToWordHtml (qgen-app.js).
   ========================================================================== */
(function () {
  "use strict";

  /* ---- geometry (twips; 1pt = 20) ------------------------------------- */
  var PAGE_M = 360;                       // 0.25" (6.35mm) = zyadatar printers ka safe minimum; aur kam karoge to print me kinara kat sakta hai
  var HF_DIST = 200;                      // header/footer distance (page me header/footer hai hi nahi)
  var HALF_W = (16838 - 2 * PAGE_M) / 2;   // 8059
  var ROW_H = 11906 - 2 * PAGE_M - 126;   // 11060: exact row height (page content minus section-break paragraph + slack)
  var PAD_X = 160, PAD_Y = 40, PAD_TOP = 0;   // half-page inner padding (upar 0 = header ke upar khali jagah nahi)
  var INNER_W = HALF_W - PAD_X * 2;       // 7619
  var COL_W = Math.floor(INNER_W / 2);    // 3809
  var COL_PAD = 60;                       // column cell side margin
  var COL_H = ROW_H - PAD_TOP - PAD_Y;     // usable height of a column
  var TXT_W = COL_W - 160;                // text width (right column ki asli width: 100 + 60 margin)
  var OPT_TBL_W = COL_W - COL_PAD * 2;    // 2x2 option table width
  var OPT_W = Math.floor(OPT_TBL_W / 2) - 60 - 20; // text width inside one option cell
  var PT = 9.5;                          // body font size (pt) — yahin se badlo (9 / 9.5 / 10)
  var SZ = Math.round(PT * 2);            // docx half-points
  var LH_RATIO = 1.625;                   // line height = font x ye ratio (1.5 = aur tight, par Hindi matra kat sakti hai)
  var LH = Math.round(PT * LH_RATIO * 20);   // exact line height (twips)
  var SPACER = 40;                        // base gap between questions
  var BOTTOM_GUARD = 100;                 // columns ke neeche itni jagah chhodte hain (twips)
  var MAX_EXTRA = 30;                     // bhare column ko neeche tak barabar baantne ke liye har gap me max itna (twips) extra: neeche anjaan khali patti nahi dikhegi, gap bhi bade nahi lagenge
  var SAFETY = 1.0;                       // estimate safety margin (1.0 = sabse zyada questions fit; 1.03-1.05 = zyada safe)
  var FIT_GUARD = 90;                    // column ke neeche itni jagah (twips) hamesha khali rakhte hain, kategne se bachne ke liye
  var FIT_PESSIMISM = 0.975;               // v2: FIT decision ke liye line-width 7% kam maante hain. Borderline wrap (jaise Hindi option ki line jo Word me 2 line ho jaati hai) ko hum 2 line gin lete hain, taaki question neeche kat na jaye; agar jagah kam ho to POORA question agle column/page me chala jaata hai.
  var BLOCK_PAD = 0;                      // har question block par extra twips (chhoti-chhoti errors jama hoke aakhri question ko katne se bachane ke liye)
  var MAX_PAGES = 40;                     // booklet max: 4, 8, 12 ... 40 pages
  var TAG_H = 280;                        // har page (page 1 ke alawa) ke upar chhote SET tag ki height (twips)
  var HEAD_H = LH + 140;                  // section heading ki height (twips)

  /* ---- collect questions (same source as Booklet Print) --------------- */
  function collectQuestions() {
    try { if (window.QGSets && typeof window.QGSets.flat === "function") return window.QGSets.flat(); } catch (e) {}
    try { if (typeof isSectionMode === "function" && isSectionMode() && typeof getAllQuestionsFlat === "function") return getAllQuestionsFlat(); } catch (e) {}
    try { if (typeof paperQuestions !== "undefined") return paperQuestions || []; } catch (e) {}
    return [];
  }

  /* ---- width / height estimation --------------------------------------
     v2: pehle har character ko ~0.5em maan kar sirf "total width / line width" nikalte the.
     Isse comma, space, '.', '-' (jo asal me bahut patle hain) zyada chaude maane jaate the,
     aur Hindi + math wali lines ek line zyada ginti thi => har column me jagah bachi reh
     jaati thi (Q7 col-1 me nahi aata tha jab ki space tha).
     Ab: (1) Times New Roman ki asli character widths, (2) Hindi (Mangal) ke liye alag widths,
     (3) sup/sub chhote (0.65), fraction/root atomic, (4) Word jaisa word-by-word wrapping.
     Screenshot ke 12/12 stem line-counts aur har question ki height se match verify ki gayi.  */
  var TNR = { 32: 250, 33: 333, 34: 408, 35: 500, 36: 500, 37: 833, 38: 778, 39: 180, 40: 333, 41: 333, 42: 500, 43: 564, 44: 250, 45: 333, 46: 250, 47: 278, 58: 278, 59: 278, 60: 564, 61: 564, 62: 564, 63: 444, 64: 921, 91: 333, 92: 278, 93: 333, 94: 469, 95: 500, 96: 333, 123: 480, 124: 200, 125: 480, 126: 541 };
  (function () {
    var U = "722 667 667 722 611 556 722 722 333 389 722 611 889 722 722 556 722 667 556 611 722 722 944 722 722 611".split(" ");
    var L = "444 500 444 500 444 333 500 500 278 278 500 278 778 500 500 500 500 333 389 278 500 500 722 500 500 444".split(" ");
    var i; for (i = 48; i <= 57; i++) TNR[i] = 500;
    for (i = 0; i < 26; i++) { TNR[65 + i] = +U[i]; TNR[97 + i] = +L[i]; }
  })();
  var HI_BASE = 0.40;                      // Devanagari akshar width (em). Aapke Word ke 34 asli stem line-counts se fit: 0.36-0.44 sab 34/34 sahi, beech ka 0.40 liya
  var WRAP_SAFE = 0.99;                    // line width ka 1% kam maante hain (borderline line ko wrap maan lo)
  var MATH_EXTRA = 25;                     // math (fraction/root) wali har line par extra twips (Word ka measured ~23)

  function cw(c) {                         // advance width in em
    if (c >= 0x900 && c <= 0x97F) {
      if (c === 0x94D) return -0.15;       // virama: conjunct compress hota hai
      if (c <= 0x903 || c === 0x93C || (c >= 0x941 && c <= 0x948) || (c >= 0x951 && c <= 0x957)) return 0;
      if (c === 0x93F) return 0.25;
      if ((c >= 0x93E && c <= 0x940) || (c >= 0x949 && c <= 0x94C)) return 0.3;
      if (c >= 0x966 && c <= 0x96F) return 0.5;
      return HI_BASE;
    }
    if (c >= 0x300 && c <= 0x36F) return 0;   // combining bar/dot (recurring decimal) ki width nahi
    if (TNR[c] !== undefined) return TNR[c] / 1000;
    if ((c >= 0x2080 && c <= 0x209F) || (c >= 0x2070 && c <= 0x207F) || c === 0xB2 || c === 0xB3) return 0.33;
    if (c === 0xBC || c === 0xBD || c === 0xBE) return 0.75;
    if (c === 0x221A) return 0.55;
    if (c === 0xD7 || c === 0xF7 || c === 0xB1 || c === 0x2212) return 0.564;
    if (c === 0x2026) return 1.0;
    if (c === 0xB0) return 0.4;
    return 0.6;
  }
  function strW(s, sc) { var w = 0; for (var i = 0; i < s.length; i++) w += cw(s.charCodeAt(i)); return w * (sc || 1); }

  function est(html, prefix, widthTw, pt) {
    var d = document.createElement("div");
    d.innerHTML = String(prefix || "").replace(/&/g, "&amp;").replace(/</g, "&lt;") + html;
    var atoms = [], cur = 0, mathN = 0;
    function flush() { if (cur > 0) { atoms.push({ w: cur }); cur = 0; } }
    function walk(n, sc) {
      if (n.nodeType === 3) {
        n.textContent.split(/(\s+)/).forEach(function (p) {
          if (!p) return;
          if (/^\s+$/.test(p)) { flush(); atoms.push({ sp: true, w: 0.25 * sc }); } else cur += strW(p, sc);
        });
        return;
      }
      if (n.nodeType !== 1) return;
      var t = n.tagName.toLowerCase();
      if (t === "sup" || t === "sub") { Array.prototype.forEach.call(n.childNodes, function (c) { walk(c, 0.65); }); return; }
      if (t === "radical") { mathN++; cur += strW(n.textContent) + 0.7; return; }
      if (t === "table") {
        mathN++;
        var tr = n.querySelectorAll("tr");
        cur += Math.max(strW(tr[0] ? tr[0].textContent : ""), strW(tr[1] ? tr[1].textContent : "")) * 0.9 + 0.25;
        return;
      }
      Array.prototype.forEach.call(n.childNodes, function (c) { walk(c, sc); });
    }
    walk(d, 1); flush();
    function wrapLines(W) {
      var lines = 1, x = 0, pend = 0;
      atoms.forEach(function (a) {
        if (a.sp) { pend = a.w; return; }
        if (x === 0) { x = a.w; pend = 0; }
        else if (x + pend + a.w <= W) { x += pend + a.w; pend = 0; }
        else { lines++; x = a.w; pend = 0; }
        while (x > W) { lines++; x -= W; }          // bahut lamba single word
      });
      return lines;
    }
    var Wn = (widthTw / 20 / pt) * WRAP_SAFE;
    // fit ke liye pessimistic count (Word me line zyada lag sakti hai, kam nahi)
    var lines = Math.max(wrapLines(Wn), wrapLines(Wn * FIT_PESSIMISM));
    var extra = Math.min(mathN, lines) * MATH_EXTRA;
    return { lines: lines, math: mathN > 0, h: lines * LH + extra };
  }
  function sp(math, after) {               // math wali line: AT_LEAST (clip na ho), baaki EXACT
    return { line: LH, lineRule: math ? docx.LineRuleType.AT_LEAST : docx.LineRuleType.EXACT, before: 0, after: after || 0 };
  }

  /* ---- docx building blocks ------------------------------------------- */
  function noBorders() {
    var n = { style: docx.BorderStyle.NONE, size: 0, color: "FFFFFF" };
    return { top: n, bottom: n, left: n, right: n, insideHorizontal: n, insideVertical: n };
  }
  function spacer(h) {
    return new docx.Paragraph({
      spacing: { line: h || SPACER, lineRule: docx.LineRuleType.EXACT, before: 0, after: 0 },
      children: [new docx.TextRun({ text: "", size: 2 })]
    });
  }
  function optCell(label, raw, w) {
    var html = mathToWordHtml(raw || ""), e = est(html, "[A] ", OPT_W, PT);
    return {
      h: e.h,
      cell: new docx.TableCell({
        width: { size: w, type: docx.WidthType.DXA },
        margins: { top: 0, bottom: 0, left: 30, right: 30 },
        children: [new docx.Paragraph({
          spacing: sp(e.math, 0),
          children: [new docx.TextRun({ text: "[" + label + "] ", size: SZ })].concat(htmlToDocxRuns(html, { size: SZ }))
        })]
      })
    };
  }
  function mcqBlock(n, q) {
    var sh = mathToWordHtml(q.text || ""), s = est(sh, n + ". ", TXT_W, PT);
    var out = [new docx.Paragraph({
      spacing: sp(s.math, 20),
      children: [new docx.TextRun({ text: n + ". ", bold: true, size: SZ })].concat(htmlToDocxRuns(sh, { size: SZ }))
    })];
    var h = s.h + 20, L = ["A", "B", "C", "D"], o = q.opts || [];
    var w1 = Math.floor(OPT_TBL_W / 2), w2 = OPT_TBL_W - w1, rows = [];
    for (var r = 0; r < 2; r++) {
      var a = optCell(L[r * 2], o[r * 2], w1), b = optCell(L[r * 2 + 1], o[r * 2 + 1], w2);
      rows.push(new docx.TableRow({ cantSplit: true, children: [a.cell, b.cell] }));
      h += Math.max(a.h, b.h);
    }
    out.push(new docx.Table({
      width: { size: OPT_TBL_W, type: docx.WidthType.DXA },
      columnWidths: [w1, w2], layout: docx.TableLayoutType.FIXED,
      borders: noBorders(), rows: rows
    }));
    return { children: out, h: (h + SPACER + BLOCK_PAD) * SAFETY };
  }
  function subBlock(n, q) {
    var html = mathToWordHtml(q.text || ""), e = est(html, n + ". ", INNER_W - 40, PT + 0.5);
    return {
      h: (e.h + e.lines * 20 + 100 + BLOCK_PAD) * SAFETY,
      children: [new docx.Paragraph({
        spacing: Object.assign(sp(e.math, 100), { line: LH + 20 }),
        children: [new docx.TextRun({ text: n + ". ", bold: true, size: SZ + 1 })].concat(htmlToDocxRuns(html, { size: SZ + 1 }))
      })]
    };
  }
  function colCell(blocks, w, isRight, extra) {
    var kids = [];
    blocks.forEach(function (b, i) {
      kids = kids.concat(b.children);
      kids.push(spacer(SPACER + (i < blocks.length - 1 ? (extra || 0) : 0)));   // gap (stretch se column neeche tak bharta hai)
    });
    if (!kids.length) kids.push(spacer());
    var cfg = {
      width: { size: w, type: docx.WidthType.DXA },
      verticalAlign: docx.VerticalAlign.TOP,
      margins: { top: 0, bottom: 0, left: isRight ? 100 : COL_PAD, right: COL_PAD },
      children: kids
    };
    return new docx.TableCell(cfg);
  }
  function colsTable(left, right, exL, exR) {
    return new docx.Table({
      width: { size: INNER_W, type: docx.WidthType.DXA },
      columnWidths: [COL_W, INNER_W - COL_W], layout: docx.TableLayoutType.FIXED,
      borders: noBorders(),
      rows: [new docx.TableRow({ children: [colCell(left, COL_W, false, exL), colCell(right, INNER_W - COL_W, true, exR)] })]
    });
  }

  /* ---- header box (page 1) --------------------------------------------
     Image jaisa: gol corner wala halka-grey box, shadow wala bada title, neeche ek line me
     TEST (date) | TIME | M.M.  Word table me gol corner nahi ban sakte, isliye box ek
     high-quality PNG ki tarah (canvas se) banta hai — har paper ke naam/date/time ke saath. */
  var HDR_PX_W = Math.round(INNER_W / 15), HDR_PX_H = Math.round(HDR_PX_W * 63 / 451);   // 96dpi px
  function drawHeaderPng(h) {
    var S = 4, W = 451, H = Math.round(451 * HDR_PX_H / HDR_PX_W), cv = document.createElement("canvas");
    cv.width = W * S; cv.height = H * S;
    var c = cv.getContext("2d"); c.scale(S, S);
    var FF = "'Times New Roman', Times, 'Noto Serif', 'Mangal', 'Noto Sans Devanagari', serif";
    // rounded box
    var x0 = 1.5, y0 = 1.5, x1 = W - 1.5, y1 = H - 1.5, r = 9;
    c.beginPath(); c.moveTo(x0 + r, y0); c.lineTo(x1 - r, y0); c.quadraticCurveTo(x1, y0, x1, y0 + r);
    c.lineTo(x1, y1 - r); c.quadraticCurveTo(x1, y1, x1 - r, y1); c.lineTo(x0 + r, y1);
    c.quadraticCurveTo(x0, y1, x0, y1 - r); c.lineTo(x0, y0 + r); c.quadraticCurveTo(x0, y0, x0 + r, y0); c.closePath();
    c.fillStyle = "#E7E6E6"; c.fill(); c.lineWidth = 1.4; c.strokeStyle = "#000"; c.stroke();
    // title (letter-spaced, grey shadow)
    var title = String(h.title || "").toUpperCase(), fs = 31, gap = 2.2, tw;
    function twOf() { c.font = "bold " + fs + "px " + FF; var w = 0; for (var i = 0; i < title.length; i++) w += c.measureText(title[i]).width + gap; return w - gap; }
    var maxTw = h.setLabel ? W - 160 : W - 60;
    tw = twOf(); while (tw > maxTw && fs > 12) { fs -= 1; gap = Math.max(0.5, gap - 0.1); tw = twOf(); }
    var tx = (W - tw) / 2, ty = 29;
    [[1.6, 1.6, "#9a9a9a"], [0, 0, "#000"]].forEach(function (L) {
      c.fillStyle = L[2]; var x = tx + L[0];
      for (var i = 0; i < title.length; i++) { c.font = "bold " + fs + "px " + FF; c.fillText(title[i], x, ty + L[1]); x += c.measureText(title[i]).width + gap; }
    });
    // SET badge (top-right, box ke andar) — sirf jab ek se zyada set hon
    if (h.setLabel) {
      var bx = W - 64, by = 9, bw = 52, bh = 17, br = 5;
      c.beginPath(); c.moveTo(bx + br, by); c.lineTo(bx + bw - br, by); c.quadraticCurveTo(bx + bw, by, bx + bw, by + br);
      c.lineTo(bx + bw, by + bh - br); c.quadraticCurveTo(bx + bw, by + bh, bx + bw - br, by + bh); c.lineTo(bx + br, by + bh);
      c.quadraticCurveTo(bx, by + bh, bx, by + bh - br); c.lineTo(bx, by + br); c.quadraticCurveTo(bx, by, bx + br, by); c.closePath();
      c.fillStyle = "#fff"; c.fill(); c.lineWidth = 1.2; c.strokeStyle = "#000"; c.stroke();
      c.fillStyle = "#000"; c.font = "bold 11px " + FF; c.textAlign = "center"; c.textBaseline = "middle";
      c.fillText(h.setLabel, bx + bw / 2, by + bh / 2 + 0.5);
      c.textAlign = "left"; c.textBaseline = "alphabetic";
    }
    // info line
    var ifs = 10.5, left = ("TEST:- " + h.test + (h.date ? " (" + h.date + ")" : "")).toUpperCase(),
        mid = "TIME:-" + h.time, right = "M.M:- " + h.mm, iy = 54;
    function iw(t) { c.font = "bold " + ifs + "px " + FF; return c.measureText(t).width; }
    while (iw(left) + iw(mid) + iw(right) + 40 > W - 40 && ifs > 6) ifs -= 0.5;
    c.fillStyle = "#000"; c.font = "bold " + ifs + "px " + FF;
    var lx = 16, rx = W - 24 - iw(right), mx = Math.max(W * 0.52, lx + iw(left) + 14);
    if (mx + iw(mid) + 10 > rx) mx = Math.max(lx + iw(left) + 8, rx - iw(mid) - 10);
    c.fillText(left, lx, iy); c.fillText(mid, mx, iy); c.fillText(right, rx, iy);
    return new Promise(function (res) {
      cv.toBlob(function (bl) { bl.arrayBuffer().then(function (ab) { res(new Uint8Array(ab)); }); }, "image/png");
    });
  }
  function buildHeader(h, png) {
    var instr = "Instructions: " + h.instr;
    var il = est(instr.replace(/&/g, "&amp;").replace(/</g, "&lt;"), "", INNER_W - 40, 8.5).lines;
    var box = new docx.Paragraph({
      alignment: docx.AlignmentType.LEFT,
      spacing: { line: 240, lineRule: docx.LineRuleType.AUTO, before: 0, after: 0 },
      children: [new docx.ImageRun({ data: png, type: "png", transformation: { width: HDR_PX_W, height: HDR_PX_H } })]
    });
    var ip = new docx.Paragraph({
      alignment: docx.AlignmentType.CENTER,
      spacing: { line: 240, lineRule: docx.LineRuleType.EXACT, before: 30, after: 40 },
      children: [new docx.TextRun({ text: instr, bold: true, italics: true, size: 17 })]
    });
    return { children: [box, ip], h: HDR_PX_H * 15 + 40 + il * 240 + 70 + 60 };
  }

  /* ---- distribute MCQ blocks into columns (as many as needed, up to maxCols) --- */
  function distribute(blocks, headerH, maxCols, tagH) {
    var cols = [[]], usedArr = [0], ci = 0, dropped = 0;
    blocks.forEach(function (b) {
      var avail = COL_H - (ci < 2 ? headerH : (tagH || 0));
      // question tab tak isi column me jaata hai jab tak jagah ho (serial order); aakhri question ka trailing gap count nahi hota
      if (usedArr[ci] > 0 && usedArr[ci] + b.h - SPACER * SAFETY > avail - FIT_GUARD) {
        if (ci + 1 >= maxCols) { dropped++; return; }
        ci++; cols.push([]); usedArr.push(0);
      }
      cols[ci].push(b);
      usedArr[ci] += b.h;
    });
    // bhare hue (aakhri ke alawa) columns ko neeche tak stretch karo: bacha hua space questions ke beech baant do
    var extras = cols.map(function (c, i) {
      if (i >= cols.length - 1 || c.length < 2) return 0;
      var left = (COL_H - (i < 2 ? headerH : (tagH || 0))) - usedArr[i] - BOTTOM_GUARD;
      return left > 0 ? Math.min(MAX_EXTRA, Math.floor(left / (c.length - 1))) : 0;
    });
    return { cols: cols, extras: extras, dropped: dropped };
  }

  function halfCell(children) {
    return new docx.TableCell({
      width: { size: HALF_W, type: docx.WidthType.DXA },
      verticalAlign: docx.VerticalAlign.TOP,
      margins: { top: PAD_TOP, bottom: PAD_Y, left: PAD_X, right: PAD_X },
      children: children
    });
  }

  function fmtDate(v) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v || "");
    return m ? m[3] + "/" + m[2] + "/" + m[1] : "__/__/____";
  }
  function fmtTime(v) {                    // minutes -> "2HOURS" / "1.5HOURS" / "45MIN"
    var m = parseFloat(v);
    if (!m || m <= 0) return "____";
    if (m < 60) return Math.round(m) + "MIN";
    var h = Math.round(m / 60 * 100) / 100;
    return h + (h === 1 ? "HOUR" : "HOURS");
  }
  function val(id) { var el = document.getElementById(id); return el ? el.value || "" : ""; }

  /* ---- main ------------------------------------------------------------ */
  /* ---- har page ka chhota SET tag + section heading ------------------- */
  function tagPara(label) {
    var b = { style: docx.BorderStyle.SINGLE, size: 6, color: "000000", space: 0 };
    return new docx.Paragraph({
      alignment: docx.AlignmentType.CENTER,
      indent: { left: INNER_W - 760 },
      border: { top: b, bottom: b, left: b, right: b },
      spacing: { line: 200, lineRule: docx.LineRuleType.EXACT, before: 0, after: 40 },
      children: [new docx.TextRun({ text: label, bold: true, size: 15 })]
    });
  }
  function headingPara(name) {
    return new docx.Paragraph({
      alignment: docx.AlignmentType.CENTER,
      shading: { type: docx.ShadingType.CLEAR, fill: "E7E6E6", color: "auto" },
      spacing: { line: LH, lineRule: docx.LineRuleType.EXACT, before: 40, after: 60 },
      children: [new docx.TextRun({ text: name, bold: true, size: SZ + 2 })]
    });
  }
  // section mode me (2+ sections) har question ka section naam; nahi to null
  function sectionMap(total) {
    try {
      if (typeof isSectionMode === "function" && isSectionMode() && typeof sections !== "undefined") {
        var out = [], used = 0;
        sections.forEach(function (sc) {
          var c = (sc.questions || []).length;
          for (var k = 0; k < c; k++) out.push(String(sc.name || ""));
          if (c) used++;
        });
        if (used >= 2 && out.length === total) return out;
      }
    } catch (e) {}
    return null;
  }
  function addHeadings(blocks, names) {    // section badalne par pehle question ke upar heading (usi block me, alag nahi hoti)
    var prev = null;
    blocks.forEach(function (b, i) {
      var nm = names[i];
      if (nm && nm !== prev) { b.children = [headingPara(nm)].concat(b.children); b.h += HEAD_H * SAFETY; }
      prev = nm;
    });
  }

  /* ---- ek set ka Word document banao ---------------------------------- */
  function buildPaperDoc(all, hdrData, png, askDrop) {
    var secMap = sectionMap(all.length), mcq = [], mcqSec = [], sub = [], subSec = [];
    all.forEach(function (q, i) {
      if (q.qType === "subjective") { sub.push(q); subSec.push(secMap ? secMap[i] : ""); }
      else { mcq.push(q); mcqSec.push(secMap ? secMap[i] : ""); }
    });
    var tagH = hdrData.setLabel ? TAG_H : 0;

    var header = buildHeader(hdrData, png);

    var mcqBlocks = mcq.map(function (q, i) { return mcqBlock(i + 1, q); });
    addHeadings(mcqBlocks, mcqSec);

    // subjective pages (single column per page); instruction sirf pehle subjective page par
    var SUB_INSTR_H = 400;
    var subPages = [], cur = [], used = 0;
    var subBlocks = sub.map(function (q, i) { return subBlock(i + 1, q); });
    addHeadings(subBlocks, subSec);
    subBlocks.forEach(function (b) {
      var avail = COL_H - tagH - (subPages.length === 0 ? SUB_INSTR_H : 0);
      if (cur.length && used + b.h > avail) { subPages.push(cur); cur = []; used = 0; }
      cur.push(b); used += b.h;
    });
    if (cur.length) subPages.push(cur);
    var subDropped = 0;
    while (subPages.length > MAX_PAGES - 1) subDropped += subPages.pop().length;
    var sp = subPages.length;

    var dist = distribute(mcqBlocks, header.h, (MAX_PAGES - sp) * 2, tagH);
    var mp = Math.max(1, Math.ceil(dist.cols.length / 2));
    var N = Math.max(4, Math.ceil((mp + sp) / 4) * 4);          // total booklet pages: 4, 8, 12 ... 40

    var dropped = dist.dropped + subDropped;
    if (dropped > 0) {
      if (askDrop && !confirm("⚠️ " + dropped + " question 40 page ki limit me nahi aa rahe.\nBaaki questions ke saath file bana dein?")) return null;
    }

    // half-page content by booklet page number
    var pageKids = {};
    for (var p = 1; p <= N; p++) {
      var kids = (hdrData.setLabel && p !== 1) ? [tagPara(hdrData.setLabel)] : [];
      if (p <= mp) {
        if (p === 1) kids = kids.concat(header.children);
        kids.push(colsTable(dist.cols[(p - 1) * 2] || [], dist.cols[(p - 1) * 2 + 1] || [], dist.extras[(p - 1) * 2], dist.extras[(p - 1) * 2 + 1]));
        kids.push(spacer());
      } else if (p > N - sp) {
        var si = p - (N - sp) - 1, blocks = subPages[si];
        if (si === 0) kids.push(new docx.Paragraph({
          alignment: docx.AlignmentType.RIGHT,
          spacing: { line: 240, lineRule: docx.LineRuleType.EXACT, before: 0, after: 120 },
          children: [new docx.TextRun({ text: "Instructions: सभी प्रश्न अनिवार्य हैं।", bold: true, italics: true, size: 17 })]
        }));
        blocks.forEach(function (b) { kids = kids.concat(b.children); });
      } else kids.push(spacer());
      pageKids[p] = kids;
    }

    // booklet imposition for ANY multiple of 4:  front [N-2s, 1+2s], back [2+2s, N-1-2s]
    var pairs = [];
    for (var s2 = 0; s2 < N / 4; s2++) { pairs.push([N - 2 * s2, 1 + 2 * s2]); pairs.push([2 + 2 * s2, N - 1 - 2 * s2]); }

    var sections = pairs.map(function (pair, si2) {
      var isLast = si2 === pairs.length - 1;
      return {
        properties: { page: {
          size: { width: 11906, height: 16838, orientation: docx.PageOrientation.LANDSCAPE },
          margin: { top: PAGE_M, bottom: PAGE_M, left: PAGE_M, right: PAGE_M, header: HF_DIST, footer: HF_DIST }
        } },
        children: [
          new docx.Table({
            width: { size: HALF_W * 2, type: docx.WidthType.DXA },
            columnWidths: [HALF_W, HALF_W], layout: docx.TableLayoutType.FIXED,
            borders: noBorders(),
            rows: [new docx.TableRow({
              cantSplit: true,
              height: { value: ROW_H, rule: docx.HeightRule.EXACT },
              children: [halfCell(pageKids[pair[0]]), halfCell(pageKids[pair[1]])]
            })]
          })
        ].concat(isLast ? [new docx.Paragraph({
          spacing: { line: 20, lineRule: docx.LineRuleType.EXACT, before: 0, after: 0 },
          children: [new docx.TextRun({ text: "", size: 2 })]
        })] : [])
      };
    });

    var doc = new docx.Document({
      // math bhi body size me aaye; default paragraph 1pt exact => docx.js ka section-break paragraph page ke neeche
      // extra jagah nahi leta (yehi "blank page" ka reason tha)
      styles: { default: { document: {
        run: { size: SZ },
        paragraph: { spacing: { line: 20, lineRule: docx.LineRuleType.EXACT, before: 0, after: 0 } }
      } } },
      sections: sections
    });
    return { doc: doc, N: N };
  }

  /* ---- institute ka naam: generator iframe me khulta hai, SnapBrand parent page me hota hai ---- */
  function instituteName(fallback) {
    var wins = [window];
    try { if (window.parent && window.parent !== window) wins.push(window.parent); } catch (e) {}
    try { if (window.top && window.top !== window) wins.push(window.top); } catch (e) {}
    for (var i = 0; i < wins.length; i++) {
      try {
        var sb = wins[i].SnapBrand;
        if (sb && typeof sb.plain === "function") { var n = sb.plain(""); if (n) return n; }
      } catch (e) {}
    }
    try {                                   // same-origin cache (branding.js yahi save karta hai)
      var last = localStorage.getItem("snap_brand_last");
      var b = last && JSON.parse(localStorage.getItem("snap_brand_" + last) || "null");
      var nm = b && b.name ? String(b.name).replace(/[*_~`\r\n]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 60) : "";
      if (nm) return nm;
    } catch (e) {}
    return fallback;
  }

  var DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  function safeName(t) { return String(t || "").replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim(); }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  /* ---- main: ek click = jitne sets hain, sab ki alag Word file ---------- */
  window.exportPaperFormatWord = async function () {
    try { if (window.QGSets && typeof QGSets.ensure === "function") QGSets.ensure(); } catch (e) {}
    var nSets = 1;
    try { if (window.QGSets && QGSets.state) nSets = Math.max(1, QGSets.state().n || 1); } catch (e) {}
    var letters = (window.PaperSets && PaperSets.LETTERS) || ["A", "B", "C", "D", "E"];

    function setQuestions(i) {
      try { if (window.QGSets && typeof QGSets.flatFor === "function") return QGSets.flatFor(i) || []; } catch (e) {}
      return i === 0 ? collectQuestions() : [];
    }
    if (!setQuestions(0).length) { alert("Pehle paper mein kam se kam ek question add karein."); return; }
    if (!window.docx && window.__ensureLib) { try { await window.__ensureLib("docx"); } catch (e) {} }
    if (!window.docx || typeof htmlToDocxRuns !== "function" || typeof mathToWordHtml !== "function") {
      alert("Word export library load nahi hui — internet check karke page reload karein.");
      return;
    }

    var brand = instituteName("The Vishnu Sharma");
    var hdrData = {
      title: brand,
      test: val("subject"),
      mm: val("maxMarks"),
      date: fmtDate(val("testDate")),
      time: fmtTime(val("timeMin")),
      instr: val("instructions") || "सभी प्रश्न अनिवार्य हैं। प्रत्येक प्रश्न के लिए एक ही सही उत्तर है।"
    };
    var base = safeName(val("subject")) || ("Test " + (safeName(val("testNo")) || "Paper"));

    try {
      if (typeof toast === "function") toast("⏳ " + nSets + " set ki Word file ban rahi hai...");
      var files = [];
      for (var i = 0; i < nSets; i++) {
        var letter = letters[i] || String.fromCharCode(65 + i);
        var hd = Object.assign({}, hdrData, { setLabel: nSets > 1 ? "SET " + letter : "" });
        var r = buildPaperDoc(setQuestions(i), hd, await drawHeaderPng(hd), i === 0);
        if (!r) return;                                   // user ne cancel kiya
        var blob = await docx.Packer.toBlob(r.doc);
        var name = base + " Set " + letter + ".docx";
        files.push(new File([blob], name, { type: DOCX_MIME }));
      }

      // mobile/app: sab files ek hi share-sheet me; nahi to ek ke baad ek automatic download
      try {
        if (files.length && navigator.canShare && navigator.canShare({ files: files })) {
          await navigator.share({ files: files, title: base, text: "Test paper — " + files.length + " set" });
          if (typeof toast === "function") toast("📄 " + files.length + " set ki Word file share ho gayi!");
          return;
        }
      } catch (shareErr) {
        if (shareErr && shareErr.name === "AbortError") return;
        console.warn("Share failed, downloading instead:", shareErr);
      }
      for (var k = 0; k < files.length; k++) {
        var url = URL.createObjectURL(files[k]), a = document.createElement("a");
        a.href = url; a.download = files[k].name;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        (function (u) { setTimeout(function () { URL.revokeObjectURL(u); }, 5000); })(url);
        if (k < files.length - 1) await sleep(700);       // browser ek saath kai downloads block na kare
      }
      if (typeof toast === "function") toast("📄 " + files.length + " Word file download shuru: " + files.map(function (f) { return f.name; }).join(", "));
    } catch (err) {
      console.error(err);
      alert("Paper Format Word banane mein error: " + (err.message || err));
    }
  };

  /* PDF module (paper-format-pdf.js) ye helpers use karta hai */
  window.__PFW = {
    drawHeaderPng: drawHeaderPng, fmtDate: fmtDate, fmtTime: fmtTime, val: val,
    instituteName: instituteName, safeName: safeName, sectionMap: sectionMap, collectQuestions: collectQuestions
  };

})();
