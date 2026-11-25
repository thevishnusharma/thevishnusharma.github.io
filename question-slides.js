/* ============================================================================
   QUESTION SLIDES — Smart Board ke liye "ek slide = ek question"
   ----------------------------------------------------------------------------
   Button: "🖥️ Smart Board Slides"  ->  window.openQuestionSlides()

   Paper me jo questions hain (MCQ + Subjective) unka har ek ka ALAG slide banta hai (16:9).
   3 tareeke:
     1) ▶ Slideshow  : seedha browser me fullscreen PowerPoint jaisa (smart board par best).
                       Next/Back button, swipe, keyboard (→ ← Space Esc), "✅ Answer dikhao".
     2) 📕 PDF       : 16:9 PDF, 1 page = 1 question. Kisi bhi smart board ke PDF viewer me page-by-page.
     3) 📊 PowerPoint: .pptx (har slide ek chitra ke roop me — Hindi/Math bilkul waisa hi dikhta hai).
   Background: 8 ready theme + apna rang + apni photo. Choice yaad rehti hai.
   Slide ka design ek hi function (slideEl) se banta hai, isliye Slideshow, PDF aur PPTX bilkul same dikhte hain.
   Libs (jsPDF / html2canvas / PptxGenJS) tabhi load hoti hain jab PDF / PPTX banaya jaaye.
   ========================================================================== */
(function () {
  "use strict";

  var W = 1280, H = 720;
  var FF = "'Noto Sans Devanagari','Inter','Segoe UI',system-ui,-apple-system,Roboto,Arial,sans-serif";
  var LS_KEY = "qslSettings";

  /* ---- backgrounds ------------------------------------------------------ */
  var THEMES = [
    { id: "navy",   name: "Deep Navy",        rec: true,  bg: "linear-gradient(135deg,#0b1437 0%,#1e3a8a 100%)", text: "#ffffff", sub: "#cbd5ff", accent: "#fbbf24", card: "rgba(255,255,255,.10)", line: "rgba(255,255,255,.28)", dark: true },
    { id: "white",  name: "Clean White",      rec: true,  bg: "#ffffff",                                          text: "#0f172a", sub: "#475569", accent: "#2563eb", card: "#f1f5f9",               line: "#cbd5e1",               dark: false },
    { id: "board",  name: "Green Chalkboard", rec: false, bg: "radial-gradient(ellipse at 30% 20%,#2f6f55 0%,#1b4636 70%,#143527 100%)", text: "#ffffff", sub: "#d1fae5", accent: "#fde047", card: "rgba(255,255,255,.10)", line: "rgba(255,255,255,.30)", dark: true },
    { id: "cream",  name: "Warm Cream",       rec: false, bg: "#fdf6e3",                                          text: "#2f2417", sub: "#6b5a43", accent: "#b45309", card: "#f5e9c8",               line: "#d9c79a",               dark: false },
    { id: "purple", name: "Royal Purple",     rec: false, bg: "linear-gradient(135deg,#2e1065 0%,#6d28d9 100%)", text: "#ffffff", sub: "#e9d5ff", accent: "#fde047", card: "rgba(255,255,255,.12)", line: "rgba(255,255,255,.30)", dark: true },
    { id: "teal",   name: "Teal Ocean",       rec: false, bg: "linear-gradient(135deg,#042f2e 0%,#0f766e 100%)", text: "#ffffff", sub: "#ccfbf1", accent: "#fcd34d", card: "rgba(255,255,255,.12)", line: "rgba(255,255,255,.30)", dark: true },
    { id: "sunset", name: "Sunset",           rec: false, bg: "linear-gradient(135deg,#7c2d12 0%,#be123c 55%,#6d28d9 100%)", text: "#ffffff", sub: "#fde2e2", accent: "#fde047", card: "rgba(0,0,0,.22)", line: "rgba(255,255,255,.35)", dark: true },
    { id: "black",  name: "Pure Black",       rec: false, bg: "#000000",                                          text: "#ffffff", sub: "#cbd5e1", accent: "#facc15", card: "rgba(255,255,255,.10)", line: "rgba(255,255,255,.30)", dark: true }
  ];

  function lum(hex) {
    var m = /^#?([0-9a-f]{6})$/i.exec(hex || ""); if (!m) return 0;
    var n = parseInt(m[1], 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  }
  function customTheme(hex) {
    var dark = lum(hex) < 0.55;
    return dark
      ? { id: "custom", name: "Custom", bg: hex, text: "#ffffff", sub: "#e2e8f0", accent: "#fde047", card: "rgba(255,255,255,.12)", line: "rgba(255,255,255,.32)", dark: true }
      : { id: "custom", name: "Custom", bg: hex, text: "#0f172a", sub: "#475569", accent: "#2563eb", card: "rgba(0,0,0,.06)", line: "rgba(0,0,0,.22)", dark: false };
  }
  function imageTheme(dataUrl) {
    return { id: "image", name: "Photo", bg: "#000 url(" + dataUrl + ") center/cover no-repeat", text: "#ffffff", sub: "#e5e7eb", accent: "#fde047", card: "rgba(0,0,0,.45)", line: "rgba(255,255,255,.35)", dark: true, overlay: "rgba(0,0,0,.50)", fallback: "#000" };
  }

  /* ---- settings (localStorage, kabhi throw nahi) ------------------------ */
  var state = { theme: "navy", custom: "#0b3d91", image: "", answers: "none", blanks: 0, blankQ: true };
  function loadState() {
    try {
      var s = JSON.parse(localStorage.getItem(LS_KEY) || "null");
      if (s && typeof s === "object") {
        if (s.theme) state.theme = s.theme;
        if (s.custom) state.custom = s.custom;
        if (s.answers) state.answers = s.answers;
        if (typeof s.blanks === "number") state.blanks = Math.max(0, Math.min(5, s.blanks));
        if (typeof s.blankQ === "boolean") state.blankQ = s.blankQ;
      }
    } catch (e) {}
  }
  function saveState() { try { localStorage.setItem(LS_KEY, JSON.stringify({ theme: state.theme, custom: state.custom, answers: state.answers, blanks: state.blanks, blankQ: state.blankQ })); } catch (e) {} }
  function currentTheme() {
    if (state.theme === "image" && state.image) return imageTheme(state.image);
    if (state.theme === "custom") return customTheme(state.custom);
    for (var i = 0; i < THEMES.length; i++) if (THEMES[i].id === state.theme) return THEMES[i];
    return THEMES[0];
  }

  /* ---- helpers ---------------------------------------------------------- */
  function esc(t) { return String(t == null ? "" : t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  function fmt(t) { return esc(t).replace(/\r?\n/g, "<br>"); }
  function mk(tag, cls, html) { var d = document.createElement(tag); if (cls) d.className = cls; if (html != null) d.innerHTML = html; return d; }
  function toastMsg(m) { try { if (typeof toast === "function") toast(m); } catch (e) {} }
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
  function loadScript(src) {
    return new Promise(function (res, rej) {
      var s = document.createElement("script");
      s.src = src; s.onload = res; s.onerror = function () { rej(new Error("Load nahi hua (internet check karein): " + src)); };
      document.head.appendChild(s);
    });
  }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function getQuestions() {
    try { var P = window.__PFW; if (P && P.collectQuestions) return P.collectQuestions() || []; } catch (e) {}
    try { if (typeof getAllQuestionsFlat === "function") return getAllQuestionsFlat() || []; } catch (e) {}
    try { if (typeof paperQuestions !== "undefined") return paperQuestions || []; } catch (e) {}
    return [];
  }
  function metaVal(id, dflt) { try { var P = window.__PFW; return (P && P.val && P.val(id)) || dflt || ""; } catch (e) { return dflt || ""; } }
  function brandText() {
    var inst = "", subj = metaVal("subject", "");
    try { var P = window.__PFW; inst = (P && P.instituteName && P.instituteName("The Vishnu Sharma")) || "The Vishnu Sharma"; } catch (e) { inst = "The Vishnu Sharma"; }
    return subj ? inst + "  •  " + subj : inst;
  }
  // institute ka logo (branding.js ke SnapBrand se). Institute na ho to default Vishnu logo; institute ho par logo na ho to kuch nahi.
  function getLogo() {
    var wins = [window];
    try { if (window.parent && window.parent !== window) wins.push(window.parent); } catch (e) {}
    try { if (window.top && window.top !== window) wins.push(window.top); } catch (e) {}
    for (var i = 0; i < wins.length; i++) {
      try {
        var sb = wins[i].SnapBrand;
        if (sb && typeof sb.ident === "function") {
          var d = sb.ident();
          if (d && d.logo && /^data:image\//.test(d.logo)) return d.logo;
          if (d && d.brand) return "";
          return "vishnu-logo.png";
        }
      } catch (e) {}
    }
    try {
      var last = localStorage.getItem("snap_brand_last"), b = last && JSON.parse(localStorage.getItem("snap_brand_" + last) || "null");
      if (b && b.name) return /^data:image\//.test(b.logoDataUrl || "") ? b.logoDataUrl : "";
    } catch (e) {}
    return "vishnu-logo.png";
  }
  var logoUrl = "";
  var LET = ["A", "B", "C", "D", "E"];
  function optList(q) {
    var o = (q && q.opts) || [], out = [];
    for (var i = 0; i < o.length && i < 5; i++) {
      if (o[i] != null && String(o[i]).trim() !== "") out.push({ i: i, t: o[i] });
    }
    return out.length ? out : [0, 1, 2, 3].map(function (i) { return { i: i, t: (q && q.opts && q.opts[i]) || "" }; });
  }
  function explanationOf(q) { return q.explanationHI || q.explanation || q.explanationEN || q.solution || ""; }

  /* ---- css -------------------------------------------------------------- */
  var CSS = [
    ".qsl-slide{position:relative;box-sizing:border-box;width:" + W + "px;height:" + H + "px;overflow:hidden;font-family:" + FF + ";}",
    ".qsl-slide *{box-sizing:border-box;}",
    ".qsl-ov{position:absolute;inset:0;}",
    ".qsl-top{position:absolute;left:44px;right:56px;top:16px;height:58px;display:flex;align-items:center;justify-content:space-between;font-size:22px;font-weight:600;}",
    ".qsl-logo{height:54px;width:54px;object-fit:contain;border-radius:12px;background:#fff;padding:4px;box-shadow:0 2px 8px rgba(0,0,0,.25);}",
    ".qsl-qs{position:absolute;left:56px;right:56px;top:86px;font-size:26px;font-weight:600;line-height:1.35;opacity:.9;max-height:72px;overflow:hidden;padding-bottom:10px;border-bottom:2px dashed currentColor;}",
    ".qsl-no{font-weight:800;font-size:26px;padding:4px 18px;border-radius:999px;white-space:nowrap;}",
    ".qsl-body{position:absolute;left:56px;right:56px;top:86px;bottom:62px;display:flex;flex-direction:column;overflow:hidden;}",
    ".qsl-stem{font-weight:700;line-height:1.38;word-wrap:break-word;overflow-wrap:break-word;}",
    ".qsl-qn{font-weight:800;margin-right:12px;}",
    ".qsl-opts{display:grid;grid-template-columns:1fr 1fr;gap:16px 22px;margin-top:26px;}",
    ".qsl-opt{display:flex;align-items:center;gap:14px;border-radius:18px;padding:14px 20px;line-height:1.3;font-weight:600;min-width:0;word-wrap:break-word;overflow-wrap:anywhere;}",
    ".qsl-badge{flex:none;display:inline-flex;align-items:center;justify-content:center;border-radius:50%;font-weight:800;}",
    ".qsl-ans{margin-top:26px;border-radius:18px;padding:18px 24px;line-height:1.45;font-weight:600;}",
    ".qsl-ans b{display:block;margin-bottom:6px;}",
    ".qsl-foot{position:absolute;left:56px;right:56px;bottom:18px;height:34px;display:flex;align-items:center;justify-content:space-between;font-size:20px;font-weight:600;opacity:.9;}",
    ".qsl-tag{padding:3px 14px;border-radius:999px;font-weight:700;}",
    ".qsl-slide .katex{font-size:1.06em;}"
  ].join("\n");
  function ensureCss() {
    if (document.getElementById("qslCss")) return;
    var s = document.createElement("style"); s.id = "qslCss"; s.textContent = CSS; document.head.appendChild(s);
  }

  /* ---- ek slide banana (Slideshow + PDF + PPTX teeno yahi use karte hain) -- */
  // o = { type:"q"|"a", reveal:bool }
  function slideEl(q, no, total, th, o) {
    o = o || {};
    var isSub = q.qType === "subjective", isAns = o.type === "a", isBlank = o.type === "b";
    var sl = mk("div", "qsl-slide");
    sl.style.background = th.bg; sl.style.color = th.text;
    if (th.overlay) sl.appendChild((function () { var d = mk("div", "qsl-ov"); d.style.background = th.overlay; return d; })());

    var top = mk("div", "qsl-top");
    var lg = o.logo === undefined ? logoUrl : o.logo;
    if (lg) { var li = mk("img", "qsl-logo"); li.src = lg; li.alt = ""; top.appendChild(li); } else { top.appendChild(mk("span", "")); }
    var chipTxt = isBlank ? ("✍️ प्रश्न " + no + " · हल" + (o.parts > 1 ? " " + o.part + "/" + o.parts : "")) : ((isAns ? "✅ उत्तर · " : "प्रश्न ") + no + " / " + total);
    var no_ = mk("span", "qsl-no", chipTxt);
    no_.style.background = th.card; no_.style.border = "2px solid " + th.line; no_.style.color = (isAns || isBlank) ? th.accent : th.text;
    top.appendChild(no_); sl.appendChild(top);

    if (isBlank) {
      if (o.showQ) {
        var qs_ = mk("div", "qsl-qs"); qs_.style.color = th.sub;
        qs_.innerHTML = "<b style='color:" + th.accent + "'>" + no + ".</b> " + fmt(q.text);
        sl.appendChild(qs_); mathify(qs_);
      }
      sl._fit = function () {}; return sl;
    }
    var body = mk("div", "qsl-body"); sl.appendChild(body);
    var box = mk("div"); box.style.margin = "0"; body.appendChild(box);   // question UPAR se shuru (neeche solution likhne ki jagah bachti hai)
    var stem = mk("div", "qsl-stem"); stem.setAttribute("data-fs", isAns ? "34" : (isSub ? "50" : "44"));
    stem.innerHTML = '<span class="qsl-qn" style="color:' + th.accent + '">' + no + ".</span>" + fmt(q.text);
    box.appendChild(stem);

    var optsWrap = null, ansBox = null;
    if (!isAns && !isSub) {
      optsWrap = mk("div", "qsl-opts");
      optList(q).forEach(function (op) {
        var good = o.reveal && q.ans === op.i;
        var d = mk("div", "qsl-opt");
        d.style.background = good ? "#16a34a" : th.card;
        d.style.border = "2px solid " + (good ? "#bbf7d0" : th.line);
        d.style.color = good ? "#ffffff" : th.text;
        var b = mk("span", "qsl-badge", LET[op.i] || String(op.i + 1));
        b.style.background = good ? "#ffffff" : th.accent; b.style.color = good ? "#16a34a" : (th.dark ? "#111827" : "#ffffff");
        d.appendChild(b); d.appendChild(mk("span", "", fmt(op.t)));
        optsWrap.appendChild(d);
      });
      box.appendChild(optsWrap);
    }
    if (isAns || (o.reveal && isSub)) {
      ansBox = mk("div", "qsl-ans"); ansBox.setAttribute("data-fs", "34");
      ansBox.style.background = isAns || isSub ? "rgba(22,163,74,.92)" : th.card; ansBox.style.color = "#fff";
      var inner = "";
      if (isSub) {
        inner = "<b>✅ Model Answer</b>" + (q.modelAnswer ? fmt(q.modelAnswer) : "<span style='opacity:.85'>(model answer nahi diya gaya)</span>");
      } else {
        var correct = null; optList(q).forEach(function (op) { if (op.i === q.ans) correct = op; });
        inner = "<b>✅ सही उत्तर: (" + (LET[q.ans] || "?") + ")</b>" + (correct ? fmt(correct.t) : "");
        var ex = explanationOf(q); if (ex) inner += "<div style='margin-top:12px;font-size:.78em;font-weight:500;opacity:.97'>" + fmt(ex) + "</div>";
      }
      ansBox.innerHTML = inner; box.appendChild(ansBox);
    }

    var foot = mk("div", "qsl-foot");
    var left = q.chapter ? esc(q.chapter) : "";
    foot.appendChild(mk("span", "", left));
    if (isSub) {
      var tg = mk("span", "qsl-tag", "📝 Subjective" + (q.marks != null && q.marks !== "" ? " · " + esc(q.marks) + " marks" : ""));
      tg.style.background = th.card; tg.style.border = "2px solid " + th.line; foot.appendChild(tg);
    } else { foot.appendChild(mk("span", "", "")); }
    sl.appendChild(foot);

    mathify(sl);
    sl._fit = function () { fit(sl, body, stem, optsWrap, ansBox); };
    sl._badges = optsWrap;
    return sl;
  }

  // text ko box me fit karna: font chhota karte jao jab tak body overflow na kare
  function fit(sl, body, stem, optsWrap, ansBox) {
    var sf = parseFloat(stem.getAttribute("data-fs")) || 44, of = 32, af = parseFloat(ansBox && ansBox.getAttribute("data-fs")) || 34;
    for (var s = 1; s >= 0.36; s -= 0.04) {
      stem.style.fontSize = (sf * s).toFixed(1) + "px";
      if (optsWrap) {
        optsWrap.style.fontSize = (of * s).toFixed(1) + "px";
        optsWrap.style.marginTop = Math.max(10, 26 * s) + "px"; optsWrap.style.gap = Math.max(8, 16 * s) + "px " + Math.max(10, 22 * s) + "px";
        var bs = Math.max(30, 50 * s); [].forEach.call(optsWrap.querySelectorAll(".qsl-badge"), function (b) { b.style.width = b.style.height = bs + "px"; b.style.fontSize = (bs * 0.55) + "px"; });
      }
      if (ansBox) ansBox.style.fontSize = (af * s).toFixed(1) + "px";
      if (body.scrollHeight <= body.clientHeight + 1) break;
    }
    // aakhri safai: question chhota ho to option chhote na lagein (stem + options ek jaisa balance)
  }
  function buildSlide(q, no, total, th, o) {
    var el = slideEl(q, no, total, th, o);
    return el;
  }

  /* ---- slide sequence --------------------------------------------------- */
  function sequence(qs, answersMode, blanks) {
    var seq = [];
    qs.forEach(function (q, i) {
      seq.push({ q: q, no: i + 1, type: "q", reveal: answersMode === "inline" });
      for (var b = 0; b < (blanks || 0); b++) seq.push({ q: q, no: i + 1, type: "b" });   // solution likhne ke khali slides
      if (answersMode === "after") seq.push({ q: q, no: i + 1, type: "a", reveal: true });
    });
    return seq;
  }
  // khali slide ka "hal 2/3" — us question ke kitne khali slides hain aur ye kaunsa
  function partInfo(seq, i) {
    var it = seq[i], part = 0, parts = 0;
    for (var k = 0; k < seq.length; k++) if (seq[k].no === it.no && seq[k].type === "b") { parts++; if (k <= i) part++; }
    return { part: part, parts: parts };
  }
  function slideOpts(seq, i, reveal) {
    var it = seq[i], pi = it.type === "b" ? partInfo(seq, i) : {};
    return { type: it.type, reveal: reveal, part: pi.part, parts: pi.parts, showQ: state.blankQ };
  }


  /* ---- likhne ki parat (smart board / laptop) -------------------------------
     Slide ke upar canvas: pen, highlighter, eraser, text, undo, clear, rang, motai.
     Mouse, ungli aur stylus teeno chalte hain. Har slide ka apna likha hua alag yaad rehta hai
     (Slideshow band hone tak). Coordinates slide ke 1280x720 me — isliye har screen par sahi jagah. */
  var INK_COLORS = ["#111827", "#ffffff", "#ef4444", "#facc15", "#22c55e", "#3b82f6", "#f97316"];
  function makeInk(th0) {
    var store = {}, bak = {}, curId = null, tool = "pen", size = 5, lastPen = 0, drawing = null, tbox = null;
    var color = th0 && th0.dark ? "#fde047" : "#dc2626";
    var cv = document.createElement("canvas"); cv.width = W * 2; cv.height = H * 2;
    cv.style.cssText = "position:absolute;left:0;top:0;width:" + W + "px;height:" + H + "px;z-index:10;touch-action:none;cursor:crosshair;";
    var ctx = cv.getContext("2d");
    function list() { return store[curId] || (store[curId] = []); }
    function widthOf(it) { return it.tool === "hl" ? it.size * 4 + 6 : it.tool === "erase" ? it.size * 5 + 12 : it.size; }
    function applyStyle(it) {
      ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.lineWidth = widthOf(it);
      if (it.tool === "erase") { ctx.globalCompositeOperation = "destination-out"; ctx.strokeStyle = "#000"; ctx.globalAlpha = 1; }
      else { ctx.globalCompositeOperation = "source-over"; ctx.strokeStyle = it.color; ctx.globalAlpha = it.tool === "hl" ? 0.38 : 1; }
    }
    function drawItem(it) {
      ctx.save(); ctx.scale(2, 2);
      if (it.tool === "text") {
        ctx.fillStyle = it.color; ctx.font = "600 " + it.fs + "px " + FF; ctx.textBaseline = "top";
        String(it.text).split("\n").forEach(function (ln, i) { ctx.fillText(ln, it.x, it.y + i * it.fs * 1.35); });
      } else {
        applyStyle(it); var p = it.pts;
        ctx.beginPath(); ctx.moveTo(p[0][0], p[0][1]);
        if (p.length === 1) { ctx.lineTo(p[0][0] + 0.01, p[0][1]); }
        else {
          for (var i = 1; i < p.length - 1; i++) { var mx = (p[i][0] + p[i + 1][0]) / 2, my = (p[i][1] + p[i + 1][1]) / 2; ctx.quadraticCurveTo(p[i][0], p[i][1], mx, my); }
          ctx.lineTo(p[p.length - 1][0], p[p.length - 1][1]);
        }
        ctx.stroke();
      }
      ctx.restore();
    }
    function redraw() { ctx.clearRect(0, 0, cv.width, cv.height); list().forEach(drawItem); }
    function pt(e) { var r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * W, (e.clientY - r.top) / r.height * H]; }

    function commitText() {
      if (!tbox) return;
      var t = tbox, v = t.ta.value; tbox = null;
      if (t.ta.parentNode) t.ta.parentNode.removeChild(t.ta);
      if (v.trim()) { list().push({ tool: "text", x: t.x, y: t.y, text: v, color: t.color, fs: t.fs }); }
      redraw();
    }
    function cancelText() { if (!tbox) return; var t = tbox; tbox = null; if (t.ta.parentNode) t.ta.parentNode.removeChild(t.ta); }
    function startText(x, y) {
      commitText();
      var fs = 22 + size * 3, ta = document.createElement("textarea");
      ta.style.cssText = "position:absolute;z-index:12;left:" + x + "px;top:" + y + "px;min-width:260px;width:420px;height:" + Math.round(fs * 1.6) + "px;font:600 " + fs + "px/1.35 " + FF + ";color:" + color + ";background:rgba(128,128,128,.12);border:2px dashed " + color + ";border-radius:8px;padding:0 6px;resize:both;outline:none;overflow:hidden;";
      ta.addEventListener("input", function () { ta.style.height = "auto"; ta.style.height = Math.max(fs * 1.6, ta.scrollHeight) + "px"; });
      ta.addEventListener("keydown", function (e) {
        e.stopPropagation();
        if (e.key === "Escape") { cancelText(); }
        else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); commitText(); }
      });
      ta.addEventListener("blur", function () { setTimeout(commitText, 0); });
      cv.parentNode.appendChild(ta); tbox = { ta: ta, x: x, y: y, color: color, fs: fs };
      setTimeout(function () { ta.focus(); }, 0);
    }

    function down(e) {
      if (tool === "nav") return;
      if (e.pointerType === "touch" && Date.now() - lastPen < 1200) return;      // hath ki hatheli (palm) na likhe
      if (e.pointerType === "pen") lastPen = Date.now();
      if (e.pointerType === "mouse" && e.button !== 0) return;
      e.preventDefault();
      var p = pt(e);
      if (tool === "text") { startText(p[0], p[1]); return; }
      commitText();
      try { cv.setPointerCapture(e.pointerId); } catch (x) {}
      drawing = { tool: tool, color: color, size: size, pts: [p] };
      list().push(drawing); delete bak[curId];
      drawItem(drawing);
    }
    function move(e) {
      if (!drawing) return;
      e.preventDefault();
      var evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
      if (!evs.length) evs = [e];
      evs.forEach(function (ev) { drawing.pts.push(pt(ev)); });
      if (drawing.tool === "hl") redraw();
      else {
        var n = drawing.pts.length, a = drawing.pts[Math.max(0, n - evs.length - 1)];
        ctx.save(); ctx.scale(2, 2); applyStyle(drawing); ctx.beginPath(); ctx.moveTo(a[0], a[1]);
        for (var i = n - evs.length; i < n; i++) ctx.lineTo(drawing.pts[i][0], drawing.pts[i][1]);
        ctx.stroke(); ctx.restore();
      }
    }
    function up() { if (drawing) { drawing = null; redraw(); } }
    cv.addEventListener("pointerdown", down);
    cv.addEventListener("pointermove", move);
    cv.addEventListener("pointerup", up);
    cv.addEventListener("pointercancel", up);
    cv.addEventListener("contextmenu", function (e) { e.preventDefault(); });

    // ---- toolbar ----
    var bar = document.createElement("div"); bar.id = "qslInkBar";
    bar.style.cssText = "position:absolute;left:50%;top:6px;transform:translateX(-50%);width:max-content;z-index:6;display:flex;flex-wrap:wrap;gap:4px;align-items:center;justify-content:center;background:rgba(15,23,42,.88);padding:4px 8px;border-radius:14px;max-width:98vw;font-family:system-ui,sans-serif;box-shadow:0 4px 18px rgba(0,0,0,.35);";
    var toolBtns = {}, colBtns = [], sizeBtns = [];
    function tbtn(txt, title, fn, w) {
      var b = document.createElement("button"); b.type = "button"; b.textContent = txt; b.title = title;
      b.style.cssText = "border:2px solid transparent;cursor:pointer;color:#fff;background:rgba(255,255,255,.10);border-radius:10px;min-width:" + (w || 40) + "px;height:40px;font-size:19px;font-weight:700;padding:0 8px;touch-action:manipulation;white-space:nowrap;";
      b.addEventListener("click", function (e) { e.stopPropagation(); fn(); });
      bar.appendChild(b); return b;
    }
    function sep() { var d = document.createElement("span"); d.style.cssText = "width:2px;height:26px;background:rgba(255,255,255,.25);margin:0 1px;"; bar.appendChild(d); }
    function refresh() {
      Object.keys(toolBtns).forEach(function (k) { toolBtns[k].style.borderColor = k === tool ? "#fbbf24" : "transparent"; toolBtns[k].style.background = k === tool ? "rgba(251,191,36,.25)" : "rgba(255,255,255,.10)"; });
      colBtns.forEach(function (c) { c.b.style.outline = c.c === color ? "3px solid #fbbf24" : "2px solid rgba(255,255,255,.5)"; });
      sizeBtns.forEach(function (z) { z.b.style.borderColor = z.v === size ? "#fbbf24" : "transparent"; });
      cv.style.pointerEvents = tool === "nav" ? "none" : "auto";
      cv.style.cursor = tool === "text" ? "text" : tool === "erase" ? "cell" : "crosshair";
    }
    function setTool(t) { commitText(); tool = t; refresh(); }
    toolBtns.nav = tbtn("✋", "Slide badlein / swipe (V)", function () { setTool("nav"); });
    toolBtns.pen = tbtn("✏️", "Pen (P)", function () { setTool("pen"); });
    toolBtns.hl = tbtn("🖍️", "Highlighter (H)", function () { setTool("hl"); });
    toolBtns.erase = tbtn("🧽", "Eraser (E)", function () { setTool("erase"); });
    toolBtns.text = tbtn("🔤", "Text likhein (T) — Ctrl+Enter se pakka", function () { setTool("text"); });
    sep();
    INK_COLORS.forEach(function (c) {
      var b = document.createElement("button"); b.type = "button"; b.title = c;
      b.style.cssText = "width:28px;height:28px;border-radius:50%;border:0;cursor:pointer;background:" + c + ";touch-action:manipulation;";
      b.addEventListener("click", function (e) { e.stopPropagation(); color = c; if (tool === "nav" || tool === "erase") tool = "pen"; refresh(); });
      bar.appendChild(b); colBtns.push({ b: b, c: c });
    });
    sep();
    [[3, "●"], [6, "●"], [12, "●"]].forEach(function (z) {
      var b = tbtn(z[1], "Motai " + z[0], function () { size = z[0]; refresh(); }, 34);
      b.style.fontSize = (8 + z[0] * 1.3) + "px"; sizeBtns.push({ b: b, v: z[0] });
    });
    sep();
    function undo() {
      commitText();
      var l = list();
      if (l.length) { l.pop(); }
      else if (bak[curId]) { store[curId] = bak[curId]; delete bak[curId]; }
      redraw();
    }
    function clearAll() { commitText(); var l = list(); if (!l.length) return; bak[curId] = l.slice(); store[curId] = []; redraw(); }
    tbtn("↩", "Undo (Ctrl+Z)", undo);
    tbtn("🗑", "Is slide ka likha saaf karein (undo se wapas aa jata hai)", clearAll);
    refresh();

    return {
      cv: cv, bar: bar,
      setSlide: function (id) { cancelText(); drawing = null; curId = id; redraw(); },
      undo: undo, clear: clearAll, setTool: setTool,
      tool: function () { return tool; }, editing: function () { return !!tbox; }
    };
  }

  /* ---- fullscreen slideshow --------------------------------------------- */
  function startShow() {
    var qs = getQuestions();
    if (!qs.length) { alert("Pehle paper mein kam se kam ek question add karein."); return; }
    ensureCss();
    closeDialog();
    logoUrl = getLogo();
    var seq = sequence(qs, state.answers, state.blanks), idx = 0, revealed = {}, total = qs.length, nid = 1;
    seq.forEach(function (it) { it.id = nid++; });
    var themeIdx = Math.max(0, THEMES.map(function (t) { return t.id; }).indexOf(state.theme));
    var th = currentTheme();

    var ov = mk("div"); ov.id = "qslShow";
    ov.style.cssText = "position:fixed;inset:0;z-index:100000;overflow:hidden;touch-action:none;user-select:none;-webkit-user-select:none;";
    var stage = mk("div"); stage.style.cssText = "position:absolute;left:50%;top:50%;width:" + W + "px;height:" + H + "px;transform-origin:center center;";
    ov.appendChild(stage);
    var ink = makeInk(th);
    ov.appendChild(ink.bar);
    var bar = mk("div"); bar.style.cssText = "position:absolute;left:0;top:0;height:6px;background:#fbbf24;width:0;transition:width .25s;z-index:3;";
    ov.appendChild(bar);

    function btn(txt, title, fn, big) {
      var b = mk("button", "", txt); b.type = "button"; b.title = title;
      b.style.cssText = "border:0;cursor:pointer;color:#fff;background:rgba(15,23,42,.82);border-radius:14px;min-width:" + (big ? 76 : 56) + "px;height:56px;font-size:" + (big ? 30 : 20) + "px;font-weight:700;padding:0 16px;font-family:system-ui,sans-serif;touch-action:manipulation;white-space:nowrap;";
      b.addEventListener("click", function (e) { e.stopPropagation(); fn(); });
      return b;
    }
    var ctl = mk("div"); ctl.style.cssText = "position:absolute;left:50%;bottom:14px;transform:translateX(-50%);display:flex;gap:10px;align-items:center;z-index:5;transition:opacity .3s;";
    var bPrev = btn("◀", "Pichla (←)", function () { go(-1); }, true);
    var lbl = mk("div"); lbl.style.cssText = "color:#fff;background:rgba(15,23,42,.82);border-radius:14px;height:56px;min-width:96px;display:flex;align-items:center;justify-content:center;font:700 20px system-ui,sans-serif;padding:0 14px;";
    var bNext = btn("▶", "Agla (→ / Space)", function () { go(1); }, true);
    var bAns = btn("✅ Answer", "Answer dikhao / chhupao (A)", function () { toggleAns(); });
    var bBlank = btn("➕ खाली", "Is ke baad ek khali slide jodein — solution likhne ke liye (N)", function () { addBlank(); });
    var bBg = btn("🎨", "Background badlein (B)", function () { cycleBg(); });
    var bFs = btn("⛶", "Fullscreen (F)", function () { toggleFs(); });
    var bX = btn("✕", "Band karein (Esc)", function () { close(); });
    [bPrev, lbl, bNext, bAns, bBlank, bBg, bFs, bX].forEach(function (b) { ctl.appendChild(b); });
    ov.appendChild(ctl);
    document.body.appendChild(ov);

    function key(i) { return seq[i].no + seq[i].type; }
    function render() {
      var it = seq[idx];
      var reveal = it.reveal || !!revealed[key(idx)];
      stage.innerHTML = "";
      var el = buildSlide(it.q, it.no, total, th, slideOpts(seq, idx, reveal));
      stage.appendChild(el);
      try { el._fit(); } catch (e) {}
      stage.appendChild(ink.cv); ink.setSlide(it.id);
      ov.style.background = th.bg;
      lbl.textContent = (idx + 1) + " / " + seq.length;
      bar.style.width = (((idx + 1) / seq.length) * 100) + "%";
      bPrev.style.opacity = idx === 0 ? ".35" : "1"; bNext.style.opacity = idx === seq.length - 1 ? ".35" : "1";
      bAns.style.display = it.type === "q" ? "" : "none";
      bAns.textContent = reveal ? "🙈 Answer" : "✅ Answer";
    }
    function addBlank() {
      var it = seq[idx], at = idx;
      while (at + 1 < seq.length && seq[at + 1].no === it.no && seq[at + 1].type === "b") at++;
      if (it.type === "a") at = idx;
      else if (it.type === "q") { at = idx; while (at + 1 < seq.length && seq[at + 1].no === it.no && seq[at + 1].type === "b") at++; }
      seq.splice(at + 1, 0, { q: it.q, no: it.no, type: "b", id: nid++ });
      idx = at + 1; render();
    }
    function go(d) { var n = idx + d; if (n < 0 || n >= seq.length) return; idx = n; render(); }
    function toggleAns() { if (seq[idx].type !== "q") return; var k = key(idx); revealed[k] = !(revealed[k] || seq[idx].reveal); if (seq[idx].reveal) seq[idx].reveal = false; render(); }
    function cycleBg() {
      themeIdx = (themeIdx + 1) % THEMES.length; th = THEMES[themeIdx]; render();
      toastMsg("🎨 Background: " + th.name);
    }
    function toggleFs() {
      try {
        if (document.fullscreenElement) document.exitFullscreen();
        else if (ov.requestFullscreen) ov.requestFullscreen();
        else if (ov.webkitRequestFullscreen) ov.webkitRequestFullscreen();
      } catch (e) {}
    }
    function resize() {
      var s = Math.min(window.innerWidth / W, window.innerHeight / H);
      stage.style.transform = "translate(-50%,-50%) scale(" + s + ")";
    }
    function onKey(e) {
      if (e.target && (e.target.tagName === "TEXTAREA" || e.target.tagName === "INPUT")) return;   // text likhte waqt shortcuts band
      var k = e.key;
      if ((e.ctrlKey || e.metaKey) && (k === "z" || k === "Z")) { e.preventDefault(); ink.undo(); return; }
      if (k === "ArrowRight" || k === "PageDown" || k === " " || k === "ArrowDown" || k === "Enter") { e.preventDefault(); go(1); }
      else if (k === "ArrowLeft" || k === "PageUp" || k === "ArrowUp" || k === "Backspace") { e.preventDefault(); go(-1); }
      else if (k === "Home") { idx = 0; render(); }
      else if (k === "End") { idx = seq.length - 1; render(); }
      else if (k === "Escape") { close(); }
      else if (k === "a" || k === "A") { toggleAns(); }
      else if (k === "b" || k === "B") { cycleBg(); }
      else if (k === "n" || k === "N") { addBlank(); }
      else if (k === "p" || k === "P") { ink.setTool("pen"); }
      else if (k === "h" || k === "H") { ink.setTool("hl"); }
      else if (k === "e" || k === "E") { ink.setTool("erase"); }
      else if (k === "t" || k === "T") { e.preventDefault(); ink.setTool("text"); }
      else if (k === "v" || k === "V") { ink.setTool("nav"); }
      else if (k === "f" || k === "F") { toggleFs(); }
      showCtl();
    }
    var hideT = null;
    function showCtl() { ctl.style.opacity = "1"; ctl.style.pointerEvents = "auto"; clearTimeout(hideT); hideT = setTimeout(function () { ctl.style.opacity = "0"; ctl.style.pointerEvents = "none"; }, 3500); }
    // swipe
    var sx = null, sy = null;
    ov.addEventListener("touchstart", function (e) { if (e.touches.length === 1) { sx = e.touches[0].clientX; sy = e.touches[0].clientY; } showCtl(); }, { passive: true });
    ov.addEventListener("touchend", function (e) {
      if (sx === null) return;
      var t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy; sx = null;
      if (ink.tool() !== "nav") return;   // likhne wale mode me swipe se slide nahi badalti
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1);
    }, { passive: true });
    ov.addEventListener("mousemove", showCtl);
    ov.addEventListener("click", showCtl);
    function close() {
      document.removeEventListener("keydown", onKey, true);
      window.removeEventListener("resize", resize);
      document.removeEventListener("fullscreenchange", resize);
      clearTimeout(hideT);
      try { if (document.fullscreenElement) document.exitFullscreen(); } catch (e) {}
      if (ov.parentNode) ov.parentNode.removeChild(ov);
    }
    document.addEventListener("keydown", onKey, true);
    window.addEventListener("resize", resize);
    document.addEventListener("fullscreenchange", resize);
    resize(); render(); showCtl();
    toggleFs();
  }

  /* ---- slides -> images (PDF / PPTX ke liye) ---------------------------- */
  async function ensureLibs(needPdf, needPptx) {
    if (needPdf && (!window.jspdf || !window.jspdf.jsPDF)) await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
    if (!window.html2canvas) await loadScript("https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js");
    if (needPptx && !window.PptxGenJS) {
      // cdnjs ka path lowercase "pptxgenjs" hai (capital se 404); fail ho to jsdelivr
      try { await loadScript("https://cdnjs.cloudflare.com/ajax/libs/pptxgenjs/3.12.0/pptxgen.bundle.js"); }
      catch (e) { await loadScript("https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js"); }
    }
    if (document.fonts && document.fonts.ready) { try { await document.fonts.ready; } catch (e) {} }
  }
  async function renderImages(seq, th, onProgress) {
    var host = mk("div"); host.style.cssText = "position:fixed;left:-20000px;top:0;width:" + W + "px;pointer-events:none;";
    document.body.appendChild(host);
    var imgs = [], nQ = seq.filter(function (s) { return s.type === "q"; }).length;
    try {
      for (var i = 0; i < seq.length; i++) {
        var it = seq[i];
        var stage = mk("div"); stage.style.cssText = "position:absolute;left:0;top:0;";
        var el = buildSlide(it.q, it.no, nQ, th, slideOpts(seq, i, it.reveal));
        stage.appendChild(el); host.appendChild(stage);
        try { el._fit(); } catch (e) {}
        var cv = await window.html2canvas(el, { scale: 2, backgroundColor: null, useCORS: true, logging: false, width: W, height: H, windowWidth: W, windowHeight: H, scrollX: 0, scrollY: 0 });
        imgs.push(cv.toDataURL("image/jpeg", 0.92));
        host.removeChild(stage);
        if (onProgress) onProgress(i + 1, seq.length);
        await sleep(0);
      }
    } finally { try { document.body.removeChild(host); } catch (e) {} }
    return imgs;
  }

  /* ---- save / download (app me seedha Documents/TheVishnuSharma) -------- */
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
  async function deliver(blob, name) {
    var C = getCap();
    if (C) {
      var data = await blobToB64(blob), dirs = ["DOCUMENTS", "EXTERNAL_STORAGE", "EXTERNAL"];
      for (var d = 0; d < dirs.length; d++) {
        try {
          await Promise.race([
            C.nativePromise("Filesystem", "writeFile", { path: "TheVishnuSharma/" + name, data: data, directory: dirs[d], recursive: true }),
            new Promise(function (_, rej) { setTimeout(function () { rej(new Error("timeout")); }, 25000); })
          ]);
          toastMsg("✅ Save ho gaya: Documents/TheVishnuSharma/" + name);
          return;
        } catch (e) {}
      }
    }
    var url = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
    toastMsg("✅ Download ho gaya: " + name);
  }
  function baseName() {
    var s = ""; try { s = (window.__PFW && __PFW.safeName(metaVal("subject", ""))) || ""; } catch (e) {}
    return (s || "Questions") + " Slides";
  }

  /* ---- EDITABLE PowerPoint (.pptx) ------------------------------------------
     Asli PowerPoint text-boxes: question / options ka size, rang, jagah PowerPoint me badal sakte hain.
     Background + logo "Slide Master" me hai => PowerPoint me "New Slide" dabane par naya slide
     bilkul isi theme ke saath (logo + background + likhne ka box) khulta hai.
     Math (LaTeX) ko PowerPoint ke text me Unicode me badla jaata hai (x², √, ÷ …). Jo math bahut jatil ho,
     us question ka stem photo ki tarah lagta hai (taaki galat na dikhe). Speaker Notes me answer hai. */
  var SUP = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "+": "⁺", "-": "⁻", "−": "⁻", "=": "⁼", "(": "⁽", ")": "⁾", "n": "ⁿ", "i": "ⁱ", "x": "ˣ", "y": "ʸ" };
  var SUB = { "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄", "5": "₅", "6": "₆", "7": "₇", "8": "₈", "9": "₉", "+": "₊", "-": "₋", "−": "₋", "=": "₌", "(": "₍", ")": "₎", "n": "ₙ", "a": "ₐ", "e": "ₑ", "i": "ᵢ", "x": "ₓ" };
  var SYM = { times: "×", div: "÷", pm: "±", mp: "∓", cdot: "·", le: "≤", leq: "≤", ge: "≥", geq: "≥", ne: "≠", neq: "≠", approx: "≈", pi: "π", theta: "θ", alpha: "α", beta: "β", gamma: "γ", delta: "δ", Delta: "Δ", lambda: "λ", mu: "μ", sigma: "σ", Sigma: "Σ", omega: "ω", Omega: "Ω", phi: "φ", infty: "∞", circ: "°", degree: "°", angle: "∠", triangle: "△", perp: "⊥", parallel: "∥", therefore: "∴", because: "∵", rightarrow: "→", to: "→", leftarrow: "←", Rightarrow: "⇒", Leftrightarrow: "⇔", "in": "∈", subset: "⊂", cup: "∪", cap: "∩", ldots: "…", dots: "…", cdots: "…", sin: "sin", cos: "cos", tan: "tan", cot: "cot", sec: "sec", csc: "cosec", log: "log", ln: "ln", lim: "lim", propto: "∝", sim: "∼", cong: "≅", equiv: "≡", prime: "′", ang: "∠" };
  function mapScript(str, table) {
    var out = ""; for (var i = 0; i < str.length; i++) { var c = table[str[i]]; if (!c) return null; out += c; } return out;
  }
  function grab(s, i) {            // s[i] se '{...}' (nested) ya ek akshar; {txt, next}
    if (s[i] === "{") {
      var d = 0, j = i;
      for (; j < s.length; j++) { if (s[j] === "{") d++; else if (s[j] === "}") { d--; if (d === 0) break; } }
      return { txt: s.slice(i + 1, j), next: j + 1 };
    }
    if (s[i] === "\\") { var m = /^\\[A-Za-z]+/.exec(s.slice(i)); if (m) return { txt: m[0], next: i + m[0].length }; }
    return { txt: s[i] || "", next: i + 1 };
  }
  function wrapIf(t) { return /^[A-Za-z0-9.°²³]+$/.test(t) ? t : "(" + t + ")"; }
  function mathToUni(s, st) {
    var out = "", i = 0;
    while (i < s.length) {
      var c = s[i];
      if (c === "\\") {
        var m = /^\\([A-Za-z]+|.)/.exec(s.slice(i)); var cmd = m ? m[1] : ""; i += m ? m[0].length : 1;
        if (cmd === "frac" || cmd === "dfrac" || cmd === "tfrac") {
          var a = grab(s, i); i = a.next; var b = grab(s, i); i = b.next;
          out += wrapIf(mathToUni(a.txt, st)) + "/" + wrapIf(mathToUni(b.txt, st));
        } else if (cmd === "sqrt") {
          var idx = "";
          if (s[i] === "[") { var e = s.indexOf("]", i); idx = s.slice(i + 1, e); i = e + 1; }
          var r = grab(s, i); i = r.next; var inner = mathToUni(r.txt, st);
          out += (idx === "3" ? "∛" : idx === "4" ? "∜" : idx ? (mapScript(idx, SUP) || "") + "√" : "√") + wrapIf(inner);
        } else if (cmd === "text" || cmd === "mathrm" || cmd === "mathbf" || cmd === "textbf" || cmd === "mathit" || cmd === "operatorname" || cmd === "boldsymbol") {
          var t = grab(s, i); i = t.next; out += mathToUni(t.txt, st);
        } else if (cmd === "overline" || cmd === "bar" || cmd === "widehat" || cmd === "hat" || cmd === "overrightarrow" || cmd === "vec") {
          var o = grab(s, i); i = o.next; var ot = mathToUni(o.txt, st); out += (cmd === "vec" || cmd === "overrightarrow") ? ot + "⃗" : ot + (cmd === "hat" || cmd === "widehat" ? "̂" : "̅");
        } else if (cmd === "left" || cmd === "right" || cmd === "," || cmd === ";" || cmd === ":" || cmd === "!" || cmd === "displaystyle" || cmd === "limits") {
          if (cmd === "," || cmd === ";" || cmd === ":") out += " ";
          if ((cmd === "left" || cmd === "right") && s[i] === ".") i++;
        } else if (cmd === "quad" || cmd === "qquad" || cmd === " ") { out += "  "; }
        else if (cmd === "%" || cmd === "{" || cmd === "}" || cmd === "$" || cmd === "&" || cmd === "_" || cmd === "#") { out += cmd; }
        else if (cmd === "\\") { out += "\n"; }
        else if (Object.prototype.hasOwnProperty.call(SYM, cmd)) { out += SYM[cmd]; }
        else { st.hard = true; out += cmd; }
      } else if (c === "^" || c === "_") {
        var g = grab(s, i + 1); i = g.next; var gt = mathToUni(g.txt, st), mp = mapScript(gt, c === "^" ? SUP : SUB);
        out += (c === "^" && (gt === "°" || gt === "∘")) ? "°" : mp !== null ? mp : (c === "^" ? "^" : "_") + wrapIf(gt);
      } else if (c === "{" || c === "}") { i++; }
      else if (c === "~") { out += " "; i++; }
      else { out += c; i++; }
    }
    return out;
  }
  function texify(str) {            // { text, hard }
    var st = { hard: false };
    var t = String(str == null ? "" : str).replace(/\\\(([\s\S]+?)\\\)|\\\[([\s\S]+?)\\\]|\$\$([\s\S]+?)\$\$/g, function (_, a, b, c) { return mathToUni(a || b || c || "", st); });
    return { text: t, hard: st.hard };
  }
  function cssColor(c) {
    var m = /^#([0-9a-f]{6})$/i.exec(c || "");
    if (m) return { hex: m[1].toUpperCase(), tr: 0 };
    m = /rgba?\(([^)]+)\)/.exec(c || "");
    if (m) {
      var a = m[1].split(",").map(Number), hex = [a[0], a[1], a[2]].map(function (v) { return ("0" + Math.round(v).toString(16)).slice(-2); }).join("").toUpperCase();
      return { hex: hex, tr: Math.round((1 - (a.length > 3 ? a[3] : 1)) * 100) };
    }
    return { hex: "FFFFFF", tr: 0 };
  }
  function lineCount(text, fontPt, widthIn) {
    var cpl = Math.max(6, Math.floor(widthIn * 72 / (fontPt * 0.55))), n = 0;
    String(text).split("\n").forEach(function (ln) { n += Math.max(1, Math.ceil(ln.length / cpl)); });
    return n;
  }
  function pickFont(text, widthIn, maxH, sizes) {
    for (var i = 0; i < sizes.length; i++) { var h = lineCount(text, sizes[i], widthIn) * sizes[i] * 1.32 / 72 + 0.12; if (h <= maxH) return { fs: sizes[i], h: h }; }
    var f = sizes[sizes.length - 1]; return { fs: f, h: lineCount(text, f, widthIn) * f * 1.32 / 72 + 0.12 };
  }
  function toRuns(text, base) {
    var parts = String(text).split("\n"), runs = [];
    parts.forEach(function (p, i) { var o = Object.assign({}, base); if (i < parts.length - 1) o.breakLine = true; runs.push({ text: p === "" ? " " : p, options: o }); });
    return runs;
  }
  function loadImg(src) { return new Promise(function (res) { var im = new Image(); im.onload = function () { res(im); }; im.onerror = function () { res(null); }; im.src = src; }); }
  async function logoCard(src) {
    if (!src) return "";
    var im = await loadImg(src); if (!im) return "";
    var S = 256, cv = document.createElement("canvas"); cv.width = cv.height = S; var c = cv.getContext("2d");
    c.fillStyle = "#fff"; c.beginPath();
    if (c.roundRect) c.roundRect(0, 0, S, S, 48); else c.rect(0, 0, S, S);
    c.fill();
    var k = Math.min((S - 36) / im.width, (S - 36) / im.height), w = im.width * k, h = im.height * k;
    c.drawImage(im, (S - w) / 2, (S - h) / 2, w, h);
    try { return cv.toDataURL("image/png"); } catch (e) { return ""; }
  }
  async function bgImage(th) {
    var d = mk("div"); d.style.cssText = "position:fixed;left:-20000px;top:0;width:" + W + "px;height:" + H + "px;background:" + th.bg + ";";
    if (th.overlay) { var o = mk("div"); o.style.cssText = "position:absolute;inset:0;background:" + th.overlay + ";"; d.appendChild(o); }
    document.body.appendChild(d);
    try { var cv = await window.html2canvas(d, { scale: 1.5, backgroundColor: null, useCORS: true, logging: false, width: W, height: H }); return cv.toDataURL("image/jpeg", 0.9); }
    finally { document.body.removeChild(d); }
  }

  async function makeEditablePptx(qs, th, onProgress) {
    var PX = new window.PptxGenJS(); PX.layout = "LAYOUT_16x9"; PX.title = baseName();
    var FONT = "Nirmala UI";
    var seq = sequence(qs, state.answers, state.blanks), nQ = qs.length;
    var T = cssColor(th.text).hex, SUBc = cssColor(th.sub).hex, ACC = cssColor(th.accent).hex, CARD = cssColor(th.card), LINE = cssColor(th.line);
    var bg = await bgImage(th), lg = await logoCard(logoUrl);

    var objs = [];
    if (lg) objs.push({ image: { x: 0.3, y: 0.13, w: 0.52, h: 0.52, data: lg } });
    objs.push({ placeholder: { options: { name: "body", type: "body", x: 0.45, y: 0.9, w: 9.1, h: 3.9, fontFace: FONT, fontSize: 26, bold: true, color: T, valign: "top", margin: 0.05 }, text: "यहाँ प्रश्न / हल लिखें" } });
    PX.defineSlideMaster({ title: "QSL_BG", background: { data: bg }, objects: objs });

    var host = mk("div"); host.style.cssText = "position:fixed;left:-20000px;top:0;width:" + W + "px;pointer-events:none;"; document.body.appendChild(host);
    try {
      for (var i = 0; i < seq.length; i++) {
        var it = seq[i], q = it.q, no = it.no, isSub = q.qType === "subjective";
        var s = PX.addSlide({ masterName: "QSL_BG" });
        var pi = it.type === "b" ? partInfo(seq, i) : {};
        var chip = it.type === "b" ? ("✍️ प्रश्न " + no + " · हल" + (pi.parts > 1 ? " " + pi.part + "/" + pi.parts : "")) : ((it.type === "a" ? "✅ उत्तर · " : "प्रश्न ") + no + " / " + nQ);
        s.addText(chip, { x: 6.9, y: 0.18, w: 2.65, h: 0.44, shape: PX.ShapeType.roundRect, rectRadius: 0.5, fill: { color: CARD.hex, transparency: CARD.tr }, line: { color: LINE.hex, width: 1.5, transparency: LINE.tr }, fontFace: FONT, fontSize: 15, bold: true, color: (it.type === "q" ? T : ACC), align: "center", valign: "middle", margin: 0 });

        var stemTx = texify(q.text), stem = stemTx.text, y0 = 0.85;
        if (it.type === "b") {
          if (state.blankQ) s.addText(toRuns(no + ". " + stem, { fontFace: FONT, fontSize: 15, color: SUBc, bold: true }), { x: 0.45, y: 0.78, w: 9.1, h: 0.62, valign: "top", margin: 0.03, line: { type: "none" } });
        } else if (it.type === "a") {
          var ans = "", ex = "";
          if (isSub) ans = "✅ Model Answer\n" + (q.modelAnswer ? texify(q.modelAnswer).text : "(model answer nahi diya gaya)");
          else {
            var oo = optList(q).filter(function (o) { return o.i === q.ans; })[0];
            ans = "✅ सही उत्तर: (" + (LET[q.ans] || "?") + ")  " + (oo ? texify(oo.t).text : "");
            var e0 = explanationOf(q); if (e0) ans += "\n" + texify(e0).text;
          }
          var pf = pickFont(ans, 8.7, 3.8, [28, 24, 22, 20, 18, 16]);
          s.addText(toRuns(ans, { fontFace: FONT, fontSize: pf.fs, color: "FFFFFF", bold: true }), { x: 0.45, y: 0.95, w: 9.1, h: Math.min(3.9, pf.h + 0.4), shape: PX.ShapeType.roundRect, rectRadius: 0.12, fill: { color: "16A34A", transparency: 8 }, valign: "top", margin: 0.18 });
        } else {
          var gap = 0.2, optsRows = isSub ? 0 : 2, maxStemH = isSub ? 4.1 : 2.0;
          var stemY = y0, stemH, stemFs, imgStem = null;
          if (stemTx.hard) {                // jatil math: stem ki photo
            var tmp = slideEl(q, no, nQ, th, { type: "q", reveal: false }); host.appendChild(tmp); try { tmp._fit(); } catch (e) {}
            var stEl = tmp.querySelector(".qsl-stem"), cv0 = await window.html2canvas(stEl, { scale: 2, backgroundColor: null, logging: false });
            imgStem = { data: cv0.toDataURL("image/png"), w: Math.min(9.1, cv0.width / 2 / 1168 * 9.1), h: cv0.height / 2 / 1168 * 9.1 };
            host.removeChild(tmp); stemH = imgStem.h; stemFs = 0;
          } else {
            var pk = pickFont(no + ". " + stem, 9.0, maxStemH, isSub ? [32, 28, 26, 24, 22, 20] : [30, 28, 26, 24, 22, 20, 18]);
            stemFs = pk.fs; stemH = pk.h;
          }
          if (imgStem) s.addImage({ data: imgStem.data, x: 0.45, y: stemY, w: imgStem.w, h: imgStem.h });
          else {
            var runs = toRuns(stem, { fontFace: FONT, fontSize: stemFs, color: T, bold: true });
            runs.unshift({ text: no + ". ", options: { fontFace: FONT, fontSize: stemFs, color: ACC, bold: true } });
            s.addText(runs, { x: 0.45, y: stemY, w: 9.1, h: stemH, valign: "top", margin: 0.05 });
          }
          if (!isSub) {
            var ops = optList(q), oTop = stemY + stemH + gap, colW = 4.45, rowsY = oTop;
            for (var r = 0; r < ops.length; r += 2) {
              var pair = [ops[r], ops[r + 1]].filter(Boolean), rowH = 0.7;
              var fz = 20; pair.forEach(function (op) { var p2 = pickFont(texify(op.t).text, colW - 0.9, 1.1, [20, 18, 16, 14]); fz = Math.min(fz, p2.fs); rowH = Math.max(rowH, p2.h + 0.22); });
              pair.forEach(function (op, k) {
                var good = it.reveal && q.ans === op.i;
                s.addText([{ text: (LET[op.i] || (op.i + 1)) + "   ", options: { bold: true, color: good ? "FFFFFF" : ACC, fontFace: FONT, fontSize: fz } }, { text: texify(op.t).text, options: { color: good ? "FFFFFF" : T, bold: true, fontFace: FONT, fontSize: fz } }],
                  { x: 0.45 + k * (colW + 0.2), y: rowsY, w: colW, h: rowH, shape: PX.ShapeType.roundRect, rectRadius: 0.15, fill: good ? { color: "16A34A" } : { color: CARD.hex, transparency: CARD.tr }, line: { color: good ? "BBF7D0" : LINE.hex, width: 1.5, transparency: good ? 0 : LINE.tr }, valign: "middle", margin: [0, 0.15, 0, 0.18] });
              });
              rowsY += rowH + 0.14;
            }
          } else if (it.reveal && q.modelAnswer) {
            var ma = texify(q.modelAnswer).text, pm = pickFont(ma, 8.7, 1.8, [22, 20, 18, 16]);
            s.addText(toRuns("✅ Model Answer\n" + ma, { fontFace: FONT, fontSize: pm.fs, color: "FFFFFF", bold: true }), { x: 0.45, y: stemY + stemH + 0.2, w: 9.1, h: pm.h + 0.5, shape: PX.ShapeType.roundRect, rectRadius: 0.12, fill: { color: "16A34A", transparency: 8 }, valign: "top", margin: 0.15 });
          }
        }
        if (it.type === "q") {
          if (q.chapter) s.addText(String(q.chapter), { x: 0.45, y: 5.18, w: 4.5, h: 0.3, fontFace: FONT, fontSize: 11, color: SUBc, valign: "middle", margin: 0 });
          if (isSub) s.addText("📝 Subjective" + (q.marks != null && q.marks !== "" ? " · " + q.marks + " marks" : ""), { x: 6.9, y: 5.15, w: 2.65, h: 0.34, shape: PX.ShapeType.roundRect, rectRadius: 0.5, fill: { color: CARD.hex, transparency: CARD.tr }, line: { color: LINE.hex, width: 1.2, transparency: LINE.tr }, fontFace: FONT, fontSize: 12, bold: true, color: T, align: "center", valign: "middle", margin: 0 });
          // speaker notes: answer + explanation (padhate waqt sirf teacher ko dikhta hai)
          var note = "";
          if (isSub) note = q.modelAnswer ? "Model Answer: " + texify(q.modelAnswer).text : "";
          else { var co = optList(q).filter(function (o) { return o.i === q.ans; })[0]; note = "सही उत्तर: (" + (LET[q.ans] || "?") + ") " + (co ? texify(co.t).text : ""); var ee = explanationOf(q); if (ee) note += "\n" + texify(ee).text; }
          if (note) s.addNotes(note);
        }
        if (onProgress) onProgress(i + 1, seq.length);
        await sleep(0);
      }
    } finally { try { document.body.removeChild(host); } catch (e) {} }
    return PX.write({ outputType: "blob" });
  }

  var busy = false;
  async function makeFile(kind) {
    if (busy) { toastMsg("⏳ Slides abhi ban rahi hain, ruko..."); return; }
    var qs = getQuestions();
    if (!qs.length) { alert("Pehle paper mein kam se kam ek question add karein."); return; }
    busy = true; ensureCss();
    var btns = [].slice.call(document.querySelectorAll("#qslDlg button[data-act]"));
    btns.forEach(function (b) { b.disabled = true; });
    try {
      toastMsg("⏳ Slides ban rahi hain, thoda ruko...");
      await ensureLibs(kind === "pdf", kind !== "pdf");
      logoUrl = getLogo();
      var th = currentTheme();
      if (kind === "pptx") {
        var eb = await makeEditablePptx(qs, th, function (d, t) { toastMsg("⏳ Slide " + d + "/" + t); });
        await deliver(eb, baseName() + ".pptx");
        return;
      }
      var seq = sequence(qs, state.answers, state.blanks);
      var imgs = await renderImages(seq, th, function (d, t) { toastMsg("⏳ Slide " + d + "/" + t); });
      if (kind === "pdf") {
        var pdf = new window.jspdf.jsPDF({ orientation: "landscape", unit: "px", format: [W, H], compress: true, hotfixes: ["px_scaling"] });
        imgs.forEach(function (im, i) { if (i > 0) pdf.addPage([W, H], "landscape"); pdf.addImage(im, "JPEG", 0, 0, W, H, undefined, "FAST"); });
        await deliver(pdf.output("blob"), baseName() + ".pdf");
      } else {
        var px = new window.PptxGenJS(); px.layout = "LAYOUT_16x9"; px.title = baseName();
        imgs.forEach(function (im) { var s = px.addSlide(); s.addImage({ data: im, x: 0, y: 0, w: 10, h: 5.625 }); });
        var out = await px.write({ outputType: "blob" });
        await deliver(out, baseName() + " (photo).pptx");
      }
    } catch (err) {
      console.error(err);
      alert("Slides banane mein error: " + (err && err.message || err));
    } finally {
      busy = false; btns.forEach(function (b) { b.disabled = false; });
    }
  }

  /* ---- dialog ----------------------------------------------------------- */
  function closeDialog() { var d = document.getElementById("qslDlg"); if (d) d.remove(); }
  function openDialog() {
    loadState(); ensureCss();
    var qs = getQuestions();
    if (!qs.length) { alert("Pehle paper mein kam se kam ek question add karein."); return; }
    closeDialog();
    logoUrl = getLogo();
    var nSub = qs.filter(function (q) { return q.qType === "subjective"; }).length, nMcq = qs.length - nSub;

    var ov = mk("div"); ov.id = "qslDlg";
    ov.style.cssText = "position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;padding:12px;font-family:system-ui,sans-serif;";
    var bx = mk("div"); bx.style.cssText = "background:#fff;color:#111;border-radius:16px;max-width:560px;width:100%;max-height:94vh;overflow:auto;padding:18px;box-shadow:0 12px 44px rgba(0,0,0,.45);";
    bx.innerHTML =
      '<div style="font-weight:800;font-size:18px;">🖥️ Smart Board Slides</div>' +
      '<div style="font-size:13px;color:#555;margin:2px 0 10px;">' + qs.length + ' slides — har question ka alag slide (' + nMcq + ' MCQ, ' + nSub + ' Subjective)</div>' +
      '<div id="qslPrev" style="width:100%;aspect-ratio:16/9;border-radius:10px;overflow:hidden;position:relative;border:1px solid #ddd;background:#eee;"></div>' +
      '<div style="font-weight:700;font-size:14px;margin:12px 0 6px;">🎨 Background chunein <span style="font-weight:500;color:#666">(⭐ = smart board ke liye suggest)</span></div>' +
      '<div id="qslThemes" style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;"></div>' +
      '<div style="display:flex;gap:10px;align-items:center;margin-top:10px;flex-wrap:wrap;">' +
        '<label style="font-size:13px;display:flex;align-items:center;gap:6px;">Apna rang <input type="color" id="qslColor" style="width:42px;height:32px;border:1px solid #ccc;border-radius:6px;padding:0;"></label>' +
        '<label style="font-size:13px;display:flex;align-items:center;gap:6px;">Apni photo <input type="file" id="qslImg" accept="image/*" style="font-size:12px;max-width:190px;"></label>' +
      '</div>' +
      '<div style="font-weight:700;font-size:14px;margin:14px 0 6px;">✅ Answer</div>' +
      '<div style="display:grid;gap:6px;font-size:13px;">' +
        '<label><input type="radio" name="qslAns" value="none"> Sirf question (answer baad me Slideshow me "✅ Answer" button se dikhayein)</label>' +
        '<label><input type="radio" name="qslAns" value="after"> Har question ke baad alag "Answer" slide</label>' +
        '<label><input type="radio" name="qslAns" value="inline"> Question wale slide par hi sahi answer highlight</label>' +
      '</div>' +
      '<div style="font-weight:700;font-size:14px;margin:14px 0 6px;">✍️ Solution likhne ke liye khali slides</div>' +
      '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;font-size:13px;">' +
        '<label>Har question ke baad <select id="qslBlanks" style="padding:4px 6px;font-size:13px;"><option value="0">0 (nahi)</option><option value="1">1 khali slide</option><option value="2">2 khali slides</option><option value="3">3 khali slides</option><option value="4">4 khali slides</option></select></label>' +
        '<label><input type="checkbox" id="qslBlankQ"> khali slide par question chhota dikhayein</label>' +
      '</div>' +
      '<div style="font-size:12px;color:#666;margin-top:4px;">Slideshow me kabhi bhi "➕ खाली" (ya N key) se ek aur khali slide jod sakte hain.</div>' +
      '<div style="display:grid;grid-template-columns:1fr;gap:8px;margin-top:14px;">' +
        '<button data-act="show" style="padding:13px;border:0;border-radius:10px;background:#2563eb;color:#fff;font-weight:700;font-size:15px;">▶ Slideshow chalayein (fullscreen, smart board ke liye)</button>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">' +
          '<button data-act="pdf" style="padding:11px;border:0;border-radius:10px;background:#dc2626;color:#fff;font-weight:700;">📕 PDF download</button>' +
          '<button data-act="pptx" style="padding:11px;border:0;border-radius:10px;background:#ea580c;color:#fff;font-weight:700;">📊 PowerPoint (edit ho sakta hai) ⭐</button>' +
        '</div>' +
        '<button data-act="pptximg" style="padding:8px;border:1px solid #ea580c;border-radius:10px;background:#fff;color:#c2410c;font-weight:600;font-size:12px;">🖼️ PowerPoint (photo style — math bilkul exact, par text edit nahi hota)</button>' +
        '<button data-act="close" style="padding:10px;border:0;border-radius:10px;background:#eee;font-weight:600;">Band karein</button>' +
      '</div>' +
      '<div style="font-size:12px;color:#666;margin-top:10px;line-height:1.5;">PowerPoint (edit ho sakta hai): question/option ka size PowerPoint me badal sakte hain; naya slide "New Slide" se isi background + logo ke saath khulta hai; answer Speaker Notes me. Math ko ¹ ² √ ÷ jaise symbols me badla jaata hai.<br>Slideshow keys: → / Space = agla, ← = pichla, A = answer, N = khali slide, B = background badlo, F = fullscreen, Esc = band. Touch board par swipe ya niche ke bade button.</div>';
    ov.appendChild(bx); document.body.appendChild(ov);

    var grid = bx.querySelector("#qslThemes");
    function drawPreview() {
      var host = bx.querySelector("#qslPrev"); host.innerHTML = "";
      var th = currentTheme();
      var el = buildSlide(qs[0], 1, qs.length, th, { type: "q", reveal: false });
      var wrap = mk("div"); wrap.style.cssText = "position:absolute;left:0;top:0;width:" + W + "px;height:" + H + "px;transform-origin:0 0;";
      wrap.appendChild(el); host.appendChild(wrap);
      try { el._fit(); } catch (e) {}
      var sc = host.clientWidth / W; wrap.style.transform = "scale(" + sc + ")";
    }
    function drawThemes() {
      grid.innerHTML = "";
      THEMES.forEach(function (t) {
        var b = mk("button"); b.type = "button";
        var sel = state.theme === t.id;
        b.style.cssText = "border:" + (sel ? "3px solid #2563eb" : "2px solid #ddd") + ";border-radius:10px;padding:0;overflow:hidden;background:#fff;cursor:pointer;";
        b.innerHTML = '<div style="height:44px;background:' + t.bg + ';display:flex;align-items:center;justify-content:center;color:' + t.text + ';font-weight:800;">Aa</div>' +
          '<div style="font-size:11px;font-weight:600;padding:4px 2px;color:#222;">' + (t.rec ? "⭐ " : "") + t.name + '</div>';
        b.onclick = function () { state.theme = t.id; saveState(); drawThemes(); drawPreview(); };
        grid.appendChild(b);
      });
    }
    drawThemes();
    var col = bx.querySelector("#qslColor"); col.value = state.custom;
    col.oninput = function () { state.custom = col.value; state.theme = "custom"; saveState(); drawThemes(); drawPreview(); };
    bx.querySelector("#qslImg").onchange = function (e) {
      var f = e.target.files && e.target.files[0]; if (!f) return;
      var r = new FileReader();
      r.onload = function () {
        // badi photo ko chhota kar dete hain (PDF/PPTX halka rahe)
        var im = new Image();
        im.onload = function () {
          var k = Math.min(1, 1600 / Math.max(im.width, im.height)), c = document.createElement("canvas");
          c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
          c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
          state.image = c.toDataURL("image/jpeg", 0.85); state.theme = "image"; drawThemes(); drawPreview();
        };
        im.src = r.result;
      };
      r.readAsDataURL(f);
    };
    [].forEach.call(bx.querySelectorAll('input[name="qslAns"]'), function (r) {
      r.checked = r.value === state.answers;
      r.onchange = function () { if (r.checked) { state.answers = r.value; saveState(); } };
    });
    var bs = bx.querySelector("#qslBlanks"), bq = bx.querySelector("#qslBlankQ");
    bs.value = String(state.blanks); bq.checked = !!state.blankQ;
    bs.onchange = function () { state.blanks = parseInt(bs.value, 10) || 0; saveState(); };
    bq.onchange = function () { state.blankQ = bq.checked; saveState(); };
    bx.addEventListener("click", function (e) {
      var a = e.target && e.target.getAttribute && e.target.getAttribute("data-act"); if (!a) return;
      if (a === "close") closeDialog();
      else if (a === "show") startShow();
      else makeFile(a);
    });
    ov.addEventListener("click", function (e) { if (e.target === ov) closeDialog(); });
    setTimeout(drawPreview, 30);
  }

  loadState();
  window.openQuestionSlides = openDialog;
  window.QuestionSlides = { open: openDialog, start: startShow, themes: THEMES, _slideEl: buildSlide, _sequence: sequence, _pptx: function (qs, th) { logoUrl = getLogo(); return makeEditablePptx(qs, th || currentTheme()); }, _texify: texify };
})();
