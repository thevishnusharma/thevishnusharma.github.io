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
  var state = { theme: "navy", custom: "#0b3d91", image: "", answers: "none" };
  function loadState() {
    try {
      var s = JSON.parse(localStorage.getItem(LS_KEY) || "null");
      if (s && typeof s === "object") {
        if (s.theme) state.theme = s.theme;
        if (s.custom) state.custom = s.custom;
        if (s.answers) state.answers = s.answers;
      }
    } catch (e) {}
  }
  function saveState() { try { localStorage.setItem(LS_KEY, JSON.stringify({ theme: state.theme, custom: state.custom, answers: state.answers })); } catch (e) {} }
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
    ".qsl-top{position:absolute;left:56px;right:56px;top:22px;height:46px;display:flex;align-items:center;justify-content:space-between;font-size:22px;font-weight:600;}",
    ".qsl-brand{opacity:.9;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:900px;}",
    ".qsl-no{font-weight:800;font-size:26px;padding:4px 18px;border-radius:999px;white-space:nowrap;}",
    ".qsl-body{position:absolute;left:56px;right:56px;top:84px;bottom:62px;display:flex;flex-direction:column;overflow:hidden;}",
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
    var isSub = q.qType === "subjective", isAns = o.type === "a";
    var sl = mk("div", "qsl-slide");
    sl.style.background = th.bg; sl.style.color = th.text;
    if (th.overlay) sl.appendChild((function () { var d = mk("div", "qsl-ov"); d.style.background = th.overlay; return d; })());

    var top = mk("div", "qsl-top");
    top.appendChild(mk("span", "qsl-brand", esc(brandText())));
    var no_ = mk("span", "qsl-no", (isAns ? "✅ उत्तर · " : "प्रश्न ") + no + " / " + total);
    no_.style.background = th.card; no_.style.border = "2px solid " + th.line; no_.style.color = isAns ? th.accent : th.text;
    top.appendChild(no_); sl.appendChild(top);

    var body = mk("div", "qsl-body"); sl.appendChild(body);
    var box = mk("div"); box.style.margin = "auto 0"; body.appendChild(box);   // auto margin = safe centering (overflow neeche ki taraf)
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
  function sequence(qs, answersMode) {
    var seq = [];
    qs.forEach(function (q, i) {
      seq.push({ q: q, no: i + 1, type: "q", reveal: answersMode === "inline" });
      if (answersMode === "after") seq.push({ q: q, no: i + 1, type: "a", reveal: true });
    });
    return seq;
  }

  /* ---- fullscreen slideshow --------------------------------------------- */
  function startShow() {
    var qs = getQuestions();
    if (!qs.length) { alert("Pehle paper mein kam se kam ek question add karein."); return; }
    ensureCss();
    closeDialog();
    var seq = sequence(qs, state.answers), idx = 0, revealed = {}, total = qs.length;
    var themeIdx = Math.max(0, THEMES.map(function (t) { return t.id; }).indexOf(state.theme));
    var th = currentTheme();

    var ov = mk("div"); ov.id = "qslShow";
    ov.style.cssText = "position:fixed;inset:0;z-index:100000;overflow:hidden;touch-action:pan-y;user-select:none;-webkit-user-select:none;";
    var stage = mk("div"); stage.style.cssText = "position:absolute;left:50%;top:50%;width:" + W + "px;height:" + H + "px;transform-origin:center center;";
    ov.appendChild(stage);
    var bar = mk("div"); bar.style.cssText = "position:absolute;left:0;top:0;height:6px;background:#fbbf24;width:0;transition:width .25s;z-index:3;";
    ov.appendChild(bar);

    function btn(txt, title, fn, big) {
      var b = mk("button", "", txt); b.type = "button"; b.title = title;
      b.style.cssText = "border:0;cursor:pointer;color:#fff;background:rgba(15,23,42,.82);border-radius:14px;min-width:" + (big ? 76 : 56) + "px;height:56px;font-size:" + (big ? 30 : 20) + "px;font-weight:700;padding:0 16px;font-family:system-ui,sans-serif;touch-action:manipulation;";
      b.addEventListener("click", function (e) { e.stopPropagation(); fn(); });
      return b;
    }
    var ctl = mk("div"); ctl.style.cssText = "position:absolute;left:50%;bottom:14px;transform:translateX(-50%);display:flex;gap:10px;align-items:center;z-index:5;transition:opacity .3s;";
    var bPrev = btn("◀", "Pichla (←)", function () { go(-1); }, true);
    var lbl = mk("div"); lbl.style.cssText = "color:#fff;background:rgba(15,23,42,.82);border-radius:14px;height:56px;min-width:96px;display:flex;align-items:center;justify-content:center;font:700 20px system-ui,sans-serif;padding:0 14px;";
    var bNext = btn("▶", "Agla (→ / Space)", function () { go(1); }, true);
    var bAns = btn("✅ Answer", "Answer dikhao / chhupao (A)", function () { toggleAns(); });
    var bBg = btn("🎨", "Background badlein (B)", function () { cycleBg(); });
    var bFs = btn("⛶", "Fullscreen (F)", function () { toggleFs(); });
    var bX = btn("✕", "Band karein (Esc)", function () { close(); });
    [bPrev, lbl, bNext, bAns, bBg, bFs, bX].forEach(function (b) { ctl.appendChild(b); });
    ov.appendChild(ctl);
    document.body.appendChild(ov);

    function key(i) { return seq[i].no + seq[i].type; }
    function render() {
      var it = seq[idx];
      var reveal = it.reveal || !!revealed[key(idx)];
      stage.innerHTML = "";
      var el = buildSlide(it.q, it.no, total, th, { type: it.type, reveal: reveal });
      stage.appendChild(el);
      try { el._fit(); } catch (e) {}
      ov.style.background = th.bg;
      lbl.textContent = (idx + 1) + " / " + seq.length;
      bar.style.width = (((idx + 1) / seq.length) * 100) + "%";
      bPrev.style.opacity = idx === 0 ? ".35" : "1"; bNext.style.opacity = idx === seq.length - 1 ? ".35" : "1";
      bAns.style.display = it.type === "a" ? "none" : "";
      bAns.textContent = reveal ? "🙈 Answer" : "✅ Answer";
    }
    function go(d) { var n = idx + d; if (n < 0 || n >= seq.length) return; idx = n; render(); }
    function toggleAns() { if (seq[idx].type === "a") return; var k = key(idx); revealed[k] = !(revealed[k] || seq[idx].reveal); if (seq[idx].reveal) seq[idx].reveal = false; render(); }
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
      var k = e.key;
      if (k === "ArrowRight" || k === "PageDown" || k === " " || k === "ArrowDown" || k === "Enter") { e.preventDefault(); go(1); }
      else if (k === "ArrowLeft" || k === "PageUp" || k === "ArrowUp" || k === "Backspace") { e.preventDefault(); go(-1); }
      else if (k === "Home") { idx = 0; render(); }
      else if (k === "End") { idx = seq.length - 1; render(); }
      else if (k === "Escape") { close(); }
      else if (k === "a" || k === "A") { toggleAns(); }
      else if (k === "b" || k === "B") { cycleBg(); }
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
    if (needPptx && !window.PptxGenJS) await loadScript("https://cdnjs.cloudflare.com/ajax/libs/PptxGenJS/3.12.0/pptxgen.bundle.js");
    if (document.fonts && document.fonts.ready) { try { await document.fonts.ready; } catch (e) {} }
  }
  async function renderImages(seq, th, onProgress) {
    var host = mk("div"); host.style.cssText = "position:fixed;left:-20000px;top:0;width:" + W + "px;pointer-events:none;";
    document.body.appendChild(host);
    var imgs = [];
    try {
      for (var i = 0; i < seq.length; i++) {
        var it = seq[i];
        var stage = mk("div"); stage.style.cssText = "position:absolute;left:0;top:0;";
        var el = buildSlide(it.q, it.no, seq.filter(function (s) { return s.type === "q"; }).length, th, { type: it.type, reveal: it.reveal });
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
      await ensureLibs(kind === "pdf", kind === "pptx");
      var seq = sequence(qs, state.answers), th = currentTheme();
      var imgs = await renderImages(seq, th, function (d, t) { toastMsg("⏳ Slide " + d + "/" + t); });
      if (kind === "pdf") {
        var pdf = new window.jspdf.jsPDF({ orientation: "landscape", unit: "px", format: [W, H], compress: true, hotfixes: ["px_scaling"] });
        imgs.forEach(function (im, i) { if (i > 0) pdf.addPage([W, H], "landscape"); pdf.addImage(im, "JPEG", 0, 0, W, H, undefined, "FAST"); });
        await deliver(pdf.output("blob"), baseName() + ".pdf");
      } else {
        var px = new window.PptxGenJS(); px.layout = "LAYOUT_16x9"; px.title = baseName();
        imgs.forEach(function (im) { var s = px.addSlide(); s.addImage({ data: im, x: 0, y: 0, w: 10, h: 5.625 }); });
        var out = await px.write({ outputType: "blob" });
        await deliver(out, baseName() + ".pptx");
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
      '<div style="display:grid;grid-template-columns:1fr;gap:8px;margin-top:14px;">' +
        '<button data-act="show" style="padding:13px;border:0;border-radius:10px;background:#2563eb;color:#fff;font-weight:700;font-size:15px;">▶ Slideshow chalayein (fullscreen, smart board ke liye)</button>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">' +
          '<button data-act="pdf" style="padding:11px;border:0;border-radius:10px;background:#dc2626;color:#fff;font-weight:700;">📕 PDF download</button>' +
          '<button data-act="pptx" style="padding:11px;border:0;border-radius:10px;background:#ea580c;color:#fff;font-weight:700;">📊 PowerPoint (.pptx)</button>' +
        '</div>' +
        '<button data-act="close" style="padding:10px;border:0;border-radius:10px;background:#eee;font-weight:600;">Band karein</button>' +
      '</div>' +
      '<div style="font-size:12px;color:#666;margin-top:10px;line-height:1.5;">Slideshow keys: → / Space = agla, ← = pichla, A = answer, B = background badlo, F = fullscreen, Esc = band. Touch board par swipe ya niche ke bade button.</div>';
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
  window.QuestionSlides = { open: openDialog, start: startShow, themes: THEMES, _slideEl: buildSlide, _sequence: sequence };
})();
