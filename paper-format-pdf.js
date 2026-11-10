/* ============================================================================
   PAPER FORMAT PDF  — "Paper Format Word" ka same layout, par PDF me
   ----------------------------------------------------------------------------
   Button: "📕 Paper Format PDF"  ->  window.exportPaperFormatPDF()

   Kyun: Word file laptop ke MS Word me sahi dikhti hai, par mobile / WPS Office me
   fonts aur line-height alag hone se options kat jaate hain. PDF me har page
   ek hi jaisa dikhta hai (har phone, WPS, print — sab me).

   Kaise: questions browser me asli CSS ke saath render hote hain aur HAR QUESTION KI
   ASLI HEIGHT NAAPI JAATI HAI (andaza nahi). Isliye:
     - koi question / option kabhi kat ta nahi,
     - jo question column me poora nahi aata wo POORA agle column / page me jaata hai,
     - questions ke beech sirf chhota fixed gap (extra khali line nahi), maximum questions fit.
   Layout wahi: A4 landscape, 2 half-page x 2 column, booklet imposition (4, 8, 12 ... pages),
   page 1 = header box + instruction, aakhri page(s) = subjective.
   Har sheet ko image banakar PDF me daala jaata hai (text select nahi hota, par kahin
   bhi bilkul same dikhta hai).
   ========================================================================== */
(function () {
  "use strict";

  /* ---- geometry (CSS px @96dpi; A4 landscape = 1123 x 794) ------------- */
  var SHEET_W = 1123, SHEET_H = 794, MARGIN = 24;            // 0.25" margin (Word jaisa)
  var HALF_W = (SHEET_W - 2 * MARGIN) / 2;                    // 537.5
  var HALF_H = SHEET_H - 2 * MARGIN;                          // 746
  var PAD_X = 11, PAD_B = 3;
  var INNER_W = HALF_W - PAD_X * 2;                           // 515.5
  var COL_GAP = 10;
  var COL_W = Math.floor((INNER_W - COL_GAP) / 2);            // 252
  var COL_H = HALF_H - PAD_B - 2;                             // column ki usable height
  var GAP = 5;                                                // do questions ke beech gap (px)
  var FIT_GUARD = 2;                                          // neeche 2px safety (measure asli hai)
  var PT = 9.5, FONT_PX = PT * 96 / 72;                       // 12.67px
  var LH = 1.6;
  var FF = "'Times New Roman', Times, 'Noto Serif', 'Mangal', 'Noto Serif Devanagari', 'Noto Sans Devanagari', serif";
  var SCALE = 3;                                              // image sharpness (3 = ~290 dpi)

  var CSS = [
    ".pfp-sheet{position:relative;box-sizing:border-box;width:" + SHEET_W + "px;height:" + SHEET_H + "px;padding:" + MARGIN + "px;background:#fff;display:flex;font-family:" + FF + ";color:#000;}",
    ".pfp-half{box-sizing:border-box;width:" + HALF_W + "px;height:" + HALF_H + "px;overflow:hidden;padding:0 " + PAD_X + "px " + PAD_B + "px;}",
    ".pfp-cols{display:flex;gap:" + COL_GAP + "px;align-items:flex-start;}",
    ".pfp-col{width:" + COL_W + "px;flex:none;}",
    ".pfp-q{font-size:" + FONT_PX + "px;line-height:" + LH + ";margin:0 0 " + GAP + "px;word-wrap:break-word;overflow-wrap:break-word;}",
    ".pfp-q.pfp-last{margin-bottom:0;}",
    ".pfp-stem{margin:0 0 1px;}",
    ".pfp-opts{display:grid;grid-template-columns:1fr 1fr;column-gap:4px;}",
    ".pfp-opt{padding:0 2px;min-width:0;}",
    ".pfp-n{font-weight:bold;}",
    ".pfp-sub{font-size:" + (FONT_PX + 0.7) + "px;line-height:" + (LH + 0.05) + ";margin:0 0 7px;}",
    ".pfp-head{text-align:center;background:#E7E6E6;font-weight:bold;font-size:" + (FONT_PX + 1.3) + "px;line-height:" + LH + ";margin:3px 0 4px;}",
    ".pfp-tag{box-sizing:border-box;border:1px solid #000;font-weight:bold;font-size:10px;line-height:13px;text-align:center;width:50px;margin:0 0 3px auto;}",
    ".pfp-instr{font-weight:bold;font-style:italic;font-size:11.3px;line-height:1.35;text-align:center;margin:2px 0 4px;}",
    ".pfp-instr-r{font-weight:bold;font-style:italic;font-size:11.3px;line-height:1.35;text-align:right;margin:0 0 6px;}",
    ".pfp-hdr{display:block;width:" + INNER_W + "px;height:" + Math.round(INNER_W * 63 / 451) + "px;}",
    ".pfp-sheet .katex{font-size:1.05em;}"
  ].join("\n");

  /* ---- libs ------------------------------------------------------------ */
  function loadScript(src) {
    return new Promise(function (res, rej) {
      var s = document.createElement("script");
      s.src = src; s.onload = res; s.onerror = function () { rej(new Error("Load nahi hua: " + src)); };
      document.head.appendChild(s);
    });
  }
  async function ensureLibs() {
    if (!window.jspdf || !window.jspdf.jsPDF) await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
    if (!window.html2canvas) await loadScript("https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js");
    if (document.fonts && document.fonts.ready) { try { await document.fonts.ready; } catch (e) {} }
  }

  /* ---- html helpers ---------------------------------------------------- */
  function esc(t) { return String(t == null ? "" : t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  function mathify(el) {
    try {
      if (window.renderMathInElement) {
        window.renderMathInElement(el, {
          delimiters: [{ left: "$$", right: "$$", display: false }, { left: "\\(", right: "\\)", display: false }, { left: "\\[", right: "\\]", display: false }],
          throwOnError: false
        });
      }
    } catch (e) {}
  }
  function mk(tag, cls, html) {
    var d = document.createElement(tag);
    if (cls) d.className = cls;
    if (html != null) d.innerHTML = html;
    return d;
  }
  function mcqEl(n, q, heading) {
    var wrap = mk("div", "pfp-q");
    if (heading) wrap.appendChild(mk("div", "pfp-head", esc(heading)));
    wrap.appendChild(mk("div", "pfp-stem", '<span class="pfp-n">' + n + ". </span>" + esc(q.text)));
    var o = q.opts || [], L = ["A", "B", "C", "D"], g = mk("div", "pfp-opts");
    for (var i = 0; i < 4; i++) g.appendChild(mk("div", "pfp-opt", "[" + L[i] + "] " + esc(o[i])));
    wrap.appendChild(g);
    mathify(wrap);
    return wrap;
  }
  function subEl(n, q, heading) {
    var wrap = mk("div", "pfp-sub");
    if (heading) wrap.appendChild(mk("div", "pfp-head", esc(heading)));
    wrap.appendChild(mk("div", "", '<span class="pfp-n">' + n + ". </span>" + esc(q.text)));
    mathify(wrap);
    return wrap;
  }

  /* ---- measure --------------------------------------------------------- */
  function measureAll(items, widthPx, host) {
    var box = mk("div"); box.style.cssText = "position:absolute;left:0;top:0;width:" + widthPx + "px;visibility:hidden;font-family:" + FF + ";";
    host.appendChild(box);
    items.forEach(function (it) {
      box.appendChild(it.el);
      it.h = Math.ceil(it.el.getBoundingClientRect().height);   // margin-bottom alag (GAP) gina jaata hai
      box.removeChild(it.el);
    });
    host.removeChild(box);
  }

  /* ---- pagination (asli heights se) ------------------------------------ */
  function distribute(items, headerH, tagH) {
    var cols = [[]], used = [0], ci = 0;
    items.forEach(function (it) {
      var avail = COL_H - (ci < 2 ? headerH : tagH) - FIT_GUARD;
      var need = used[ci] + (cols[ci].length ? GAP : 0) + it.h;
      if (cols[ci].length && need > avail) { ci++; cols.push([]); used.push(0); need = it.h; }
      cols[ci].push(it);
      used[ci] = need;
    });
    return cols;
  }
  function paginateSub(items, tagH, firstExtra) {
    var pages = [], cur = [], used = 0;
    items.forEach(function (it) {
      var avail = COL_H - tagH - (pages.length === 0 ? firstExtra : 0) - FIT_GUARD;
      var need = used + it.h + 7;
      if (cur.length && need > avail) { pages.push(cur); cur = []; need = it.h + 7; }
      cur.push(it); used = need;
    });
    if (cur.length) pages.push(cur);
    return pages;
  }

  /* ---- ek set ke sheets (HTML) ----------------------------------------- */
  function buildSheets(all, hd, pngUrl, host, H) {
    var secMap = H.sectionMap(all.length), mcq = [], mcqSec = [], sub = [], subSec = [];
    all.forEach(function (q, i) {
      if (q.qType === "subjective") { sub.push(q); subSec.push(secMap ? secMap[i] : ""); }
      else { mcq.push(q); mcqSec.push(secMap ? secMap[i] : ""); }
    });
    var tagH = hd.setLabel ? 16 : 0;

    // header (page 1): image + instruction
    var hdr = mk("div");
    var img = mk("img", "pfp-hdr"); img.src = pngUrl; hdr.appendChild(img);
    hdr.appendChild(mk("div", "pfp-instr", esc("Instructions: " + hd.instr)));
    var hm = [{ el: hdr }];
    measureAll(hm, INNER_W, host);
    var headerH = hm[0].h + 4;

    // MCQ items
    var prev = null;
    var mcqItems = mcq.map(function (q, i) {
      var nm = mcqSec[i], head = (nm && nm !== prev) ? nm : ""; prev = nm;
      return { q: q, n: i + 1, head: head, el: mcqEl(i + 1, q, head) };
    });
    measureAll(mcqItems, COL_W, host);

    // subjective items
    prev = null;
    var subItems = sub.map(function (q, i) {
      var nm = subSec[i], head = (nm && nm !== prev) ? nm : ""; prev = nm;
      return { el: subEl(i + 1, q, head) };
    });
    measureAll(subItems, INNER_W, host);

    var cols = distribute(mcqItems, headerH, tagH);
    var subPages = paginateSub(subItems, tagH, 24);
    var mp = Math.max(1, Math.ceil(cols.length / 2)), sp = subPages.length;
    var N = Math.max(4, Math.ceil((mp + sp) / 4) * 4);

    function colEl(items) {
      var c = mk("div", "pfp-col");
      items.forEach(function (it, i) {
        // asli element (measure ke baad dobara banate hain taaki ek hi node do jagah na ho)
        var e = it.q ? mcqEl(it.n, it.q, it.head) : it.el;
        if (i === items.length - 1) e.className += " pfp-last";
        c.appendChild(e);
      });
      return c;
    }
    var pageEls = {};
    for (var p = 1; p <= N; p++) {
      var half = mk("div", "pfp-half");
      if (hd.setLabel && p !== 1) half.appendChild(mk("div", "pfp-tag", esc(hd.setLabel)));
      if (p <= mp) {
        if (p === 1) {
          var h2 = mk("div"); var im2 = mk("img", "pfp-hdr"); im2.src = pngUrl; h2.appendChild(im2);
          h2.appendChild(mk("div", "pfp-instr", esc("Instructions: " + hd.instr)));
          half.appendChild(h2);
        }
        var row = mk("div", "pfp-cols");
        row.appendChild(colEl(cols[(p - 1) * 2] || []));
        row.appendChild(colEl(cols[(p - 1) * 2 + 1] || []));
        half.appendChild(row);
      } else if (p > N - sp) {
        var si = p - (N - sp) - 1;
        if (si === 0) half.appendChild(mk("div", "pfp-instr-r", "Instructions: सभी प्रश्न अनिवार्य हैं।"));
        subPages[si].forEach(function (it) { half.appendChild(it.el); });
      }
      pageEls[p] = half;
    }

    // booklet imposition: front [N-2s, 1+2s], back [2+2s, N-1-2s]
    var pairs = [];
    for (var s = 0; s < N / 4; s++) { pairs.push([N - 2 * s, 1 + 2 * s]); pairs.push([2 + 2 * s, N - 1 - 2 * s]); }
    return pairs.map(function (pr) {
      var sh = mk("div", "pfp-sheet");
      sh.appendChild(pageEls[pr[0]]); sh.appendChild(pageEls[pr[1]]);
      return sh;
    });
  }

  /* ---- sheets -> PDF --------------------------------------------------- */
  async function sheetsToPdf(sheets, host, onProgress) {
    var jsPDF = window.jspdf.jsPDF, pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });
    for (var i = 0; i < sheets.length; i++) {
      var stage = mk("div"); stage.style.cssText = "position:absolute;left:0;top:0;";
      stage.appendChild(sheets[i]); host.appendChild(stage);
      // images (header) load hone do
      var imgs = Array.prototype.slice.call(stage.querySelectorAll("img"));
      await Promise.all(imgs.map(function (im) { return im.complete ? 0 : new Promise(function (r) { im.onload = im.onerror = r; }); }));
      var cv = await window.html2canvas(sheets[i], {
        scale: SCALE, backgroundColor: "#ffffff", useCORS: true, logging: false,
        width: SHEET_W, height: SHEET_H, windowWidth: SHEET_W, windowHeight: SHEET_H, scrollX: 0, scrollY: 0
      });
      if (i > 0) pdf.addPage("a4", "landscape");
      pdf.addImage(cv.toDataURL("image/jpeg", 0.93), "JPEG", 0, 0, 297, 210, undefined, "FAST");
      host.removeChild(stage);
      if (onProgress) onProgress(i + 1, sheets.length);
      await new Promise(function (r) { setTimeout(r, 0); });
    }
    return pdf.output("blob");
  }

  /* ---- app (Capacitor) me seedha phone me save: Documents/TheVishnuSharma/ ---- */
  function getCap() {
    var w = []; try { if (window.top) w.push(window.top); } catch (e) {}
    try { if (window.parent && window.parent !== window.top) w.push(window.parent); } catch (e) {}
    w.push(window);
    for (var i = 0; i < w.length; i++) { try { var c = w[i].Capacitor; if (c && typeof c.nativePromise === "function") return c; } catch (e) {} }
    return null;
  }
  function blobToB64(blob) {
    return new Promise(function (res, rej) {
      var r = new FileReader();
      r.onload = function () { res(String(r.result).split(",")[1] || ""); };
      r.onerror = function () { rej(r.error || new Error("File padh nahi payi")); };
      r.readAsDataURL(blob);
    });
  }
  async function saveAllNative(files) {
    var C = getCap(); if (!C) return false;
    var dirs = ["DOCUMENTS", "EXTERNAL_STORAGE", "EXTERNAL"], done = 0;
    for (var i = 0; i < files.length; i++) {
      var data = await blobToB64(files[i]), ok = false, lastErr = null;
      for (var d = 0; d < dirs.length && !ok; d++) {
        try {
          await Promise.race([
            C.nativePromise("Filesystem", "writeFile", { path: "TheVishnuSharma/" + files[i].name, data: data, directory: dirs[d], recursive: true }),
            new Promise(function (_, rej) { setTimeout(function () { rej(new Error("timeout")); }, 25000); })
          ]);
          ok = true;
        } catch (e) { lastErr = e; }
      }
      if (!ok) { console.warn("native save fail", lastErr); return done; }
      done++;
    }
    return done;
  }

  function downloadFile(f) {
    var url = URL.createObjectURL(f), a = document.createElement("a");
    a.href = url; a.download = f.name;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
  }
  // Ek file share (ek tap = ek share). Fail ho to download.
  var sharing = false;
  async function shareOne(f, base, canShare) {
    if (sharing) return;
    sharing = true;
    try {
      if (canShare && navigator.share) {
        await navigator.share({ files: [f], title: base });
        return;
      }
      downloadFile(f);
    } catch (err) {
      if (err && err.name === "AbortError") return;           // user ne cancel kiya
      console.warn("Share fail, download try:", err);
      downloadFile(f);
    } finally {
      setTimeout(function () { sharing = false; }, 600);
    }
  }
  function showResultDialog(files, base, canShare) {
    var old = document.getElementById("pfpDlg"); if (old) old.remove();
    var ov = document.createElement("div"); ov.id = "pfpDlg";
    ov.style.cssText = "position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:16px;font-family:system-ui,sans-serif;";
    var bx = document.createElement("div");
    bx.style.cssText = "background:#fff;color:#111;border-radius:14px;max-width:420px;width:100%;padding:18px;box-shadow:0 10px 40px rgba(0,0,0,.4);max-height:90vh;overflow:auto;";
    bx.innerHTML = '<div style="font-weight:700;font-size:17px;margin-bottom:4px;">📕 PDF taiyar hai</div>' +
      '<div style="font-size:13px;color:#555;margin-bottom:12px;">Har set ke button ko alag se dabayein (ek ke baad ek).</div>';
    files.forEach(function (f) {
      var row = document.createElement("div"); row.style.cssText = "border:1px solid #ddd;border-radius:10px;padding:10px;margin-bottom:8px;";
      var nm = document.createElement("div"); nm.textContent = f.name + " (" + Math.round(f.size / 1024) + " KB)"; nm.style.cssText = "font-size:13px;font-weight:600;margin-bottom:8px;word-break:break-all;";
      var b1 = document.createElement("button"); b1.textContent = canShare ? "📤 Share / Save" : "⬇️ Download";
      b1.style.cssText = "padding:9px 14px;border:0;border-radius:8px;background:#2563eb;color:#fff;font-weight:600;margin-right:8px;";
      b1.onclick = function () { shareOne(f, base, canShare); };
      row.appendChild(nm); row.appendChild(b1);
      if (canShare) {
        var b2 = document.createElement("button"); b2.textContent = "⬇️ Download";
        b2.style.cssText = "padding:9px 14px;border:1px solid #2563eb;border-radius:8px;background:#fff;color:#2563eb;font-weight:600;";
        b2.onclick = function () { downloadFile(f); };
        row.appendChild(b2);
      }
      bx.appendChild(row);
    });
    var cl = document.createElement("button"); cl.textContent = "Band karein";
    cl.style.cssText = "width:100%;padding:10px;border:0;border-radius:8px;background:#eee;font-weight:600;margin-top:4px;";
    cl.onclick = function () { ov.remove(); };
    bx.appendChild(cl); ov.appendChild(bx); document.body.appendChild(ov);
  }

  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  /* ---- main ------------------------------------------------------------ */
  window.exportPaperFormatPDF = async function () {
    var H = window.__PFW;
    if (!H) { alert("Paper Format module load nahi hua — page reload karein."); return; }
    if (window.__pfpBusy) { if (typeof toast === "function") toast("⏳ PDF abhi ban rahi hai, ruko..."); return; }
    window.__pfpBusy = true;
    try { if (window.QGSets && typeof QGSets.ensure === "function") QGSets.ensure(); } catch (e) {}
    var nSets = 1;
    try { if (window.QGSets && QGSets.state) nSets = Math.max(1, QGSets.state().n || 1); } catch (e) {}
    var letters = (window.PaperSets && PaperSets.LETTERS) || ["A", "B", "C", "D", "E"];
    function setQuestions(i) {
      try { if (window.QGSets && typeof QGSets.flatFor === "function") return QGSets.flatFor(i) || []; } catch (e) {}
      return i === 0 ? H.collectQuestions() : [];
    }
    if (!setQuestions(0).length) { window.__pfpBusy = false; alert("Pehle paper mein kam se kam ek question add karein."); return; }

    var host = null, styleEl = null;
    try {
      if (typeof toast === "function") toast("⏳ PDF ban rahi hai, thoda ruko...");
      await ensureLibs();
      styleEl = document.createElement("style"); styleEl.textContent = CSS; document.head.appendChild(styleEl);
      host = document.createElement("div");
      host.style.cssText = "position:fixed;left:-20000px;top:0;width:" + SHEET_W + "px;pointer-events:none;";
      document.body.appendChild(host);

      var hdrBase = {
        title: H.instituteName("The Vishnu Sharma"),
        test: H.val("subject"), mm: H.val("maxMarks"),
        date: H.fmtDate(H.val("testDate")), time: H.fmtTime(H.val("timeMin")),
        instr: H.val("instructions") || "सभी प्रश्न अनिवार्य हैं। प्रत्येक प्रश्न के लिए एक ही सही उत्तर है।"
      };
      var base = H.safeName(H.val("subject")) || ("Test " + (H.safeName(H.val("testNo")) || "Paper"));
      var files = [];
      for (var i = 0; i < nSets; i++) {
        var letter = letters[i] || String.fromCharCode(65 + i);
        var hd = Object.assign({}, hdrBase, { setLabel: nSets > 1 ? "SET " + letter : "" });
        var png = await H.drawHeaderPng(hd);
        var pngUrl = URL.createObjectURL(new Blob([png], { type: "image/png" }));
        var sheets = buildSheets(setQuestions(i), hd, pngUrl, host, H);
        var blob = await sheetsToPdf(sheets, host, function (d, t) {
          if (typeof toast === "function") toast("⏳ Set " + letter + ": page " + d + "/" + t);
        });
        URL.revokeObjectURL(pngUrl);
        files.push(new File([blob], base + " Set " + letter + ".pdf", { type: "application/pdf" }));
      }

      // Saare sets AUTOMATIC device me save (koi tap / share sheet nahi)
      var isApp = !!(window.__IS_APP || getCap());
      if (isApp) {
        var n = await saveAllNative(files);
        if (n === files.length) {
          if (typeof toast === "function") toast("✅ " + n + " PDF save ho gayi: Documents/TheVishnuSharma folder me");
          return;
        }
        // native save nahi chali -> buttons wala dialog (fallback)
        showResultDialog(files, base, true);
        return;
      }
      for (var k = 0; k < files.length; k++) {
        downloadFile(files[k]);
        if (k < files.length - 1) await sleep(1200);          // browser multiple downloads block na kare
      }
      if (typeof toast === "function") toast("✅ " + files.length + " PDF download ho gayi: " + files.map(function (f) { return f.name; }).join(", "));
    } catch (err) {
      console.error(err);
      alert("Paper Format PDF banane mein error: " + (err.message || err));
    } finally {
      window.__pfpBusy = false;
      try { if (host && host.parentNode) host.parentNode.removeChild(host); } catch (e) {}
      try { if (styleEl && styleEl.parentNode) styleEl.parentNode.removeChild(styleEl); } catch (e) {}
    }
  };
})();
