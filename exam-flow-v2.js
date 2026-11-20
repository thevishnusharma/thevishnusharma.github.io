/* v313 — Exam Flow v2 (student side)
   1) Test card: sirf 3 button (Re-attempt, Solution, Analysis) + naya look
   2) Start Test dabane par pehle Instructions -> Symbols -> Language + Agree, phir exam shuru
   3) Analysis: attempt dropdown (Attempt 1/2/3), score ring, section/chapter performance, rank, top 3
   4) Exam me section tabs (Part A / B / C ...) + question slide (swipe) animation
   Purani files ko edit nahi karta: sirf global functions ko wrap karta hai. Kuch toot jaye to purana flow chalta rehta hai (try/catch).
   Kill-switch: app-config.js me `examFlowV2: false` likh do. */
(function () {
  "use strict";
  try { if (window.APP_CONFIG && window.APP_CONFIG.examFlowV2 === false) return; } catch (e) {}

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function num(n) { try { return typeof fmtNum === "function" ? fmtNum(n) : String(Math.round(n * 100) / 100); } catch (e) { return String(n); } }
  function svg(p) { return '<svg viewBox="0 0 24 24" aria-hidden="true">' + p + "</svg>"; }
  var P = {
    back: '<path d="M15 6l-6 6 6 6"/>', x: '<path d="M18 6L6 18M6 6l12 12"/>',
    redo: '<path d="M20 11a8 8 0 10-2.3 5.7"/><path d="M20 4v7h-7"/>',
    book: '<path d="M4 5a2 2 0 012-2h6v17H6a2 2 0 00-2 2z"/><path d="M20 5a2 2 0 00-2-2h-6v17h6a2 2 0 012 2z"/>',
    chart: '<path d="M5 20V10M12 20V4M19 20v-7"/>', clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/>', doc: '<path d="M7 3h8l4 4v14H7z"/><path d="M15 3v4h4"/>',
    pad: '<rect x="4" y="4" width="13" height="17" rx="2.5"/><path d="M8 4V3h5v1"/><path d="M7.5 10l1.4 1.4 2.4-2.6M7.5 16h2M13 11h2"/><path d="M21 6.5l-6 6-.8 2.8 2.8-.8 6-6a1.6 1.6 0 00-2-2z"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.4a2.5 2.5 0 114 2c-.9.6-1.6 1-1.6 2.1M12 16.8v.1"/>',
    cup: '<path d="M8 4h8v5a4 4 0 01-8 0z"/><path d="M8 6H5a3 3 0 003 4M16 6h3a3 3 0 01-3 4M12 13v4M9 20h6M10 17h4"/>'
  };
  function T() { try { return typeof tests !== "undefined" ? tests : (window.tests || {}); } catch (e) { return window.tests || {}; } }
  function sess() { try { return typeof getStudentSession === "function" ? getStudentSession() : null; } catch (e) { return null; } }
  function cur() { try { return typeof current !== "undefined" ? current : null; } catch (e) { return null; } }

  /* ---------- Android Back button: overlay Back se band ho (overlay-back.js jaisa tareeka) ---------- */
  var H = { pushed: false, ignore: 0, open: null };
  function histOpen(name) {
    H.open = name;
    if (!H.pushed) { try { history.pushState(Object.assign({}, history.state || {}, { xf: 1 }), "", location.href); H.pushed = true; } catch (e) {} }
  }
  function histClose() {
    H.open = null;
    if (H.pushed) { H.pushed = false; if (history.state && history.state.xf) { H.ignore++; try { history.back(); } catch (e) { H.ignore--; } } }
  }
  window.addEventListener("popstate", function (e) {
    if (H.ignore > 0) { H.ignore--; e.stopImmediatePropagation(); return; }
    if (H.open) { var n = H.open; H.pushed = false; H.open = null; e.stopImmediatePropagation(); if (n === "flow") closeFlow(true); else if (n === "an") closeAnalysis(true); }
  }, true);

  /* =====================================================================
     1) START FLOW (Instructions -> Symbols -> Ready)
     ===================================================================== */
  var F = { step: 0, il: "hi", tl: "", agree: false }, flowEl = null, _bypass = false, origBegin = null;

  function info(t) {
    var qs = (t.questions || []), neg = typeof getNeg === "function" ? getNeg(t) : 0;
    var lim = Number(t.attemptLimit) > 0 ? Number(t.attemptLimit) : 0;
    var secs = t.sections || [], titles = typeof getTestSectionTitles === "function" ? getTestSectionTitles(t) : [];
    var rows = titles.map(function (ti) {
      var q = qs.filter(function (x) { return x.section === ti; });
      var meta = secs.filter(function (s) { return s.title === ti; })[0] || {};
      var m = q.reduce(function (a, x) { return a + getQuestionMarks(t, x); }, 0);
      return { title: ti, subject: meta.subject || "", q: q.length, marks: m };
    });
    var uniq = {}; qs.forEach(function (q) { uniq[getQuestionMarks(t, q)] = 1; });
    var keys = Object.keys(uniq);
    return {
      n: qs.length, min: t.minutes || 30, marks: getTestGrandTotalMarks(t), neg: neg, lim: lim, rows: rows,
      each: keys.length === 1 ? Number(keys[0]) : null,
      subj: qs.filter(function (q) { return q.qType === "subjective"; }).length,
      hasSubject: rows.some(function (r) { return r.subject; })
    };
  }
  function txt(il, t, I) {
    var en = il === "en", L = {};
    L.title = en ? "Instructions" : "निर्देश";
    L.sub = en ? "Please read carefully before you begin." : "शुरू करने से पहले ध्यान से पढ़ें।";
    L.dur = en ? "Duration" : "समय"; L.q = en ? "Questions" : "प्रश्न"; L.mk = en ? "Marks" : "अंक"; L.ng = en ? "Negative" : "ऋणात्मक";
    L.ov = en ? "Exam overview" : "परीक्षा का संक्षिप्त विवरण";
    L.ovl = [
      en ? "Duration: <b>" + I.min + " minutes</b>" : "समयावधि: <b>" + I.min + " मिनट</b>",
      en ? "Total questions: <b>" + I.n + "</b>" + (I.each ? ", marks per question: <b>+" + num(I.each) + "</b>" : "") : "कुल प्रश्न: <b>" + I.n + "</b>" + (I.each ? ", प्रति प्रश्न अंक: <b>+" + num(I.each) + "</b>" : ""),
      I.neg > 0 ? (en ? "Negative marking: <b>" + num(I.neg) + "</b> marks deducted for each wrong answer" : "ऋणात्मक अंकन: प्रत्येक गलत उत्तर पर <b>" + num(I.neg) + "</b> अंक कटेंगे") : (en ? "There is <b>no negative marking</b>" : "इस टेस्ट में <b>ऋणात्मक अंकन नहीं</b> है")
    ];
    if (I.rows.length > 1) L.ovl.push(en ? "Sections: <b>" + I.rows.length + "</b>. You can move between them any time" : "अनुभाग: <b>" + I.rows.length + "</b>, आप कभी भी इनके बीच जा सकते हैं");
    if (I.lim) L.ovl.push(en ? "You can attempt only <b>" + I.lim + " MCQs</b>. Clear a response to free a slot" : "आप केवल <b>" + I.lim + " MCQ</b> attempt कर सकते हैं। नया उत्तर देने के लिए पहले किसी उत्तर को Clear करें");
    if (I.subj) L.ovl.push(en ? "<b>" + I.subj + "</b> subjective question(s) will be checked by the teacher later" : "<b>" + I.subj + "</b> subjective प्रश्न बाद में शिक्षक जाँचेंगे");
    L.tm = en ? "Timing & submission" : "समय और उत्तर जमा करना";
    L.tml = en
      ? ["The timer (top right) shows the remaining time.", "The test is submitted automatically when time ends.", "Your progress is kept on this device. If the app closes, tap Resume to continue."]
      : ["ऊपरी दाएँ कोने का टाइमर शेष समय दिखाता है।", "समय समाप्त होने पर टेस्ट अपने आप सबमिट हो जाएगा।", "आपकी प्रगति इसी डिवाइस पर सुरक्षित रहती है। ऐप बंद हो जाए तो Resume से आगे बढ़ें।"];
    L.lg = en ? "Language" : "भाषा";
    L.lgl = en ? ["Choose your test language before starting. You can switch between English, Hindi or both during the exam."] : ["परीक्षा शुरू करने से पहले भाषा चुनें। परीक्षा के दौरान अंग्रेज़ी, हिंदी या दोनों भाषाएँ बदल सकते हैं।"];
    L.nv = en ? "Navigation" : "नेविगेशन";
    L.nvl = en
      ? ["Tap a section name at the top to jump to that section, or open the question palette to go to any question.", "Swipe left or right on the question to move to the next or previous question.", "Use Mark For Review to flag a question. An answered question that is marked is still evaluated."]
      : ["ऊपर अनुभाग के नाम पर टैप करके उस अनुभाग में जाएँ, या Question Palette से किसी भी प्रश्न पर जाएँ।", "अगले या पिछले प्रश्न के लिए प्रश्न को बाएँ या दाएँ स्वाइप करें।", "बाद में देखने के लिए Mark For Review दबाएँ। उत्तर दिया हुआ और मार्क किया हुआ प्रश्न भी जाँचा जाएगा।"];
    L.rl = en ? "Rules" : "नियम";
    L.rll = en
      ? ["Do not take screenshots or photos of the exam screen.", "Any attempt to use unfair means will lead to disqualification.", "Do not discuss or share questions with others while the exam is on.", "In case of a technical issue, inform your teacher immediately."]
      : ["परीक्षा स्क्रीन का स्क्रीनशॉट या फोटो न लें।", "अनुचित साधन का प्रयास करने पर परीक्षा रद्द कर दी जाएगी।", "परीक्षा के दौरान प्रश्न किसी से साझा या चर्चा न करें।", "तकनीकी समस्या होने पर तुरंत शिक्षक को बताएँ।"];
    L.sec = en ? "Section" : "अनुभाग"; L.subj = en ? "Subject" : "विषय"; L.qn = en ? "Q" : "प्रश्न"; L.mks = en ? "Marks" : "अंक";
    return L;
  }
  function flowHtml() {
    var c = cur(), t = c && c.test; if (!t) return "";
    var I = info(t), L = txt(F.il, t, I), en = F.il === "en", b = "";
    var steps = '<div class="xf-steps">' + [0, 1, 2].map(function (i) { return '<i class="' + (i <= F.step ? "on" : "") + '"></i>'; }).join("") + "</div>";
    function list(h, a) { return '<div class="xf-card"><h3>' + h + "</h3><ul>" + a.map(function (x) { return "<li>" + x + "</li>"; }).join("") + "</ul></div>"; }
    if (F.step === 0) {
      var tbl = "";
      if (I.rows.length > 1) {
        tbl = '<table><tr><th>' + L.sec + "</th>" + (I.hasSubject ? "<th>" + L.subj + "</th>" : "") + "<th>" + L.qn + "</th><th>" + L.mks + "</th></tr>" +
          I.rows.map(function (r) { return "<tr><td>" + esc(r.title) + "</td>" + (I.hasSubject ? "<td>" + esc(r.subject || "—") + "</td>" : "") + "<td>" + r.q + "</td><td>" + num(r.marks) + "</td></tr>"; }).join("") + "</table>";
      }
      b = "<h1>" + L.title + "</h1><p class=\"xf-sb\">" + L.sub + "</p>" +
        '<div class="xf-tiles"><div class="xf-tile"><small>' + L.dur + "</small><b>" + I.min + ' min</b></div><div class="xf-tile"><small>' + L.q + "</small><b>" + I.n + '</b></div><div class="xf-tile"><small>' + L.mk + "</small><b>" + num(I.marks) + '</b></div><div class="xf-tile"><small>' + L.ng + "</small><b>" + (I.neg > 0 ? "−" + num(I.neg) : "0") + "</b></div></div>" +
        '<div class="xf-card"><h3>' + L.ov + "</h3><ul>" + L.ovl.map(function (x) { return "<li>" + x + "</li>"; }).join("") + "</ul>" + tbl + "</div>" +
        list(L.tm, L.tml) + list(L.lg, L.lgl) + list(L.nv, L.nvl) + list(L.rl, L.rll);
    } else if (F.step === 1) {
      var sy = function (ic, p) { return '<div class="xf-sy"><div>' + ic + "</div><p>" + p + "</p></div>"; };
      b = "<h1>" + (en ? "Symbols used in the exam" : "परीक्षा में प्रयुक्त संकेत") + '</h1><p class="xf-sb">' + (en ? "Know what each colour and button means." : "हर रंग और बटन का मतलब जान लें।") + "</p>" +
        '<div class="xf-card">' +
        sy('<span class="xf-rad"></span>', en ? "Option not chosen." : "विकल्प चुना नहीं गया।") +
        sy('<span class="xf-rad on"></span>', en ? "Option chosen." : "विकल्प चुना गया।") +
        sy('<span class="xf-nb n">1</span>', en ? "Not visited yet." : "अभी देखा नहीं गया।") +
        sy('<span class="xf-nb u">2</span>', en ? "Visited but not answered." : "देखा गया पर उत्तर नहीं दिया।") +
        sy('<span class="xf-nb a">3</span>', en ? "Answered." : "उत्तर दिया गया।") +
        sy('<span class="xf-nb m">4</span>', en ? "Marked for review. If it is answered, it is still evaluated." : "समीक्षा के लिए चिह्नित। उत्तर दिया हो तो भी जाँचा जाएगा।") + "</div>";
    } else {
      b = "<h1>" + (en ? "Ready to start?" : "शुरू करने के लिए तैयार?") + '</h1><p class="xf-sb">' + (en ? "Choose your test language and confirm." : "परीक्षा की भाषा चुनें और पुष्टि करें।") + "</p>" +
        '<div class="xf-card"><div class="xf-fld"><label>' + (en ? "Test language" : "परीक्षा की भाषा") + '</label><div class="xf-lg">' +
        [["en", "English"], ["hi", "हिंदी"], ["both", en ? "Both" : "दोनों"]].map(function (x) { return '<button type="button" class="' + (F.tl === x[0] ? "on" : "") + '" data-xl="' + x[0] + '">' + x[1] + "</button>"; }).join("") + "</div></div>" +
        '<div class="xf-ag" data-xag="1"><span class="xf-cb ' + (F.agree ? "on" : "") + '"></span><span>' + (en ? "I have read all the instructions carefully and understood them. I agree not to use unfair means in this examination and understand that doing so will lead to my disqualification." : "मैंने सभी निर्देश ध्यान से पढ़ लिए हैं और समझ लिए हैं। मैं इस परीक्षा में अनुचित साधन का प्रयोग नहीं करूँगा/करूँगी और समझता/समझती हूँ कि ऐसा करने पर मेरी परीक्षा रद्द हो जाएगी।") + "</span></div></div>";
    }
    var last = F.step === 2;
    var seg = '<div class="xf-seg"><button type="button" class="' + (en ? "on" : "") + '" data-xi="en">English</button><button type="button" class="' + (en ? "" : "on") + '" data-xi="hi">हिंदी</button></div>';
    return '<div class="xf-bar"><button type="button" class="xf-ic-btn" data-xc="1" aria-label="Back">' + svg(P.back) + '</button><span class="xf-bt">' + esc(t.title || L.title) + '</span><span class="xf-sp"></span>' + seg + "</div>" + steps +
      '<div class="xf-pg">' + b + '</div><div class="xf-fx"><div>' +
      (F.step ? '<button type="button" class="xf-btn o" data-xs="-1">' + (en ? "Back" : "वापस") + "</button>" : '<button type="button" class="xf-btn o" data-xc="1">' + (en ? "Cancel" : "रद्द करें") + "</button>") +
      '<button type="button" class="xf-btn" data-xs="1" ' + (last && !(F.tl && F.agree) ? "disabled" : "") + ">" + (last ? (en ? "Start Test" : "टेस्ट शुरू करें") : (en ? "Next" : "आगे")) + "</button></div></div>";
  }
  function renderFlow(keepScroll) {
    if (!flowEl) return;
    var sc = flowEl.scrollTop; flowEl.innerHTML = flowHtml(); flowEl.scrollTop = keepScroll ? sc : 0;
  }
  function openFlow() {
    if (!flowEl) {
      flowEl = document.createElement("div"); flowEl.id = "xf-flow"; flowEl.className = "xf-flow xf-hide"; flowEl.setAttribute("role", "dialog"); flowEl.setAttribute("aria-modal", "true");
      document.body.appendChild(flowEl);
      flowEl.addEventListener("click", function (e) {
        var t;
        if ((t = e.target.closest("[data-xi]"))) { F.il = t.getAttribute("data-xi"); renderFlow(true); }
        else if ((t = e.target.closest("[data-xl]"))) { F.tl = t.getAttribute("data-xl"); renderFlow(true); }
        else if (e.target.closest("[data-xag]")) { F.agree = !F.agree; renderFlow(true); }
        else if ((t = e.target.closest("[data-xs]"))) {
          var d = +t.getAttribute("data-xs");
          if (d > 0 && F.step === 2) { if (F.tl && F.agree) startNow(); }
          else { F.step = Math.max(0, Math.min(2, F.step + d)); renderFlow(); }
        } else if (e.target.closest("[data-xc]")) {
          if (F.step > 0 && e.target.closest(".xf-ic-btn")) { F.step--; renderFlow(); } else closeFlow(false);
        }
      });
    }
    F.step = 0; F.tl = ""; F.agree = false;
    try { var s = sess(); F.il = (localStorage.getItem("xf_il") || "hi"); } catch (e) { F.il = "hi"; }
    renderFlow(); flowEl.classList.remove("xf-hide"); document.documentElement.style.overflow = "hidden"; histOpen("flow");
  }
  function closeFlow(fromPop) {
    if (!flowEl) return;
    flowEl.classList.add("xf-hide"); flowEl.innerHTML = ""; document.documentElement.style.overflow = "";
    if (fromPop !== true) histClose(); else { H.open = null; H.pushed = false; }
  }
  function startNow() {
    var lang = F.tl;
    try { localStorage.setItem("xf_il", F.il); } catch (e) {}
    closeFlow(false);
    _bypass = true;
    try { origBegin.call(window); } finally { _bypass = false; }
    try { if (lang && typeof setExamLang === "function") setExamLang(lang); } catch (e) {}
  }
  function hookBegin() {
    if (typeof window.beginExam !== "function" || window.beginExam.__xf) return;
    origBegin = window.beginExam;
    window.beginExam = function () {
      var c = cur(), t = c && c.test;
      if (_bypass || !t || !t.questions || !t.questions.length || t.custom || t.isPractice || String(c.testId || "").indexOf("reattempt-") === 0) return origBegin.apply(this, arguments);
      try { openFlow(); } catch (e) { console.warn("[xf] flow open fail", e); return origBegin.apply(this, arguments); }
    };
    window.beginExam.__xf = 1;
  }

  /* =====================================================================
     2) TEST CARD (Re-attempt / Solution / Analysis)
     ===================================================================== */
  function restyleCards() {
    var list = $("#test-cards-list"); if (!list) return;
    $$(".test-card", list).forEach(function (card) {
      if (card.classList.contains("xf-tk")) return;
      var body = $(".test-card-body", card), acts = $(".test-card-actions", card); if (!body || !acts) return;
      var title = ($(".test-card-title", body) || {}).textContent || "";
      var meta = ($(".test-card-meta", body) || {}).textContent || "";
      var nums = (meta.match(/(\d+(?:\.\d+)?)/g) || []);
      var q = nums[0] || "—", m = nums[1] || "—", mn = nums[2] || "—";
      var extra = []; $$(":scope > *", body).forEach(function (n) { if (!n.classList.contains("test-card-title") && !n.classList.contains("test-card-meta")) extra.push(n); });
      var by = {}; $$("[data-action]", acts).forEach(function (b) { by[b.getAttribute("data-action")] = b; });
      var id = (by.solution || by.analysis || by.start || by.resume || by.locked || by.omr || {}).getAttribute ? (by.solution || by.analysis || by.start || by.resume || by.locked || by.omr).getAttribute("data-test") : "";
      var attempted = !!(by.solution || by.analysis);
      function mk(b, label, icon, cls) { b.className = "xf-ak " + (cls || ""); b.innerHTML = '<span class="xf-ic">' + svg(icon) + "</span>" + label; return b; }
      var order = [];
      if (by.resume) { by.resume.className = "xf-go xf-amber"; by.resume.innerHTML = "Resume"; order.push(by.resume); }
      if (attempted) {
        var rb = document.createElement("button"); rb.type = "button"; rb.setAttribute("data-action", "reattemptfull"); rb.setAttribute("data-test", id);
        rb.className = "xf-ak xf-re"; rb.textContent = "Re-attempt"; rb.onclick = function () { try { startTestWithId(id); } catch (e) { console.warn(e); } };
        order.push(rb);
        if (by.solution) { by.solution.className = "xf-ak xf-so"; by.solution.innerHTML = svg(P.book) + "Solution"; order.push(by.solution); }
        if (by.analysis) { by.analysis.className = "xf-ak xf-hi"; by.analysis.innerHTML = svg(P.chart) + "Analysis"; order.push(by.analysis); }
        if (by.omr) { by.omr.className = "xf-ak xf-so"; by.omr.innerHTML = svg(P.doc) + "OMR"; order.push(by.omr); }
      }
      if (by.start) { by.start.className = "xf-go"; by.start.innerHTML = "Start Test"; order.push(by.start); }
      if (by.locked) { by.locked.className = "xf-go xf-amber"; by.locked.innerHTML = svg(P.lock) + "Locked"; order.push(by.locked); }
      var one = !attempted;
      var badge = by.resume ? ["In Progress", "xf-b-amber"] : by.locked ? ["Locked", "xf-b-grey"] : attempted ? ["Completed", "xf-b-violet"] : ["Active", "xf-b-green"];
      card.className = "xf-tk";
      card.innerHTML = '<div class="xf-tk-top"><span class="xf-tk-ic">' + svg(P.pad) + '</span><h3></h3><span class="xf-badge ' + badge[1] + '">' + badge[0] + '</span></div>' +
        '<div class="xf-tk-s"><span>' + svg(P.help) + "<b>" + esc(q) + "</b> Qs</span><span>" + svg(P.cup) + "<b>" + esc(m) + "</b> Marks</span><span>" + svg(P.clock) + "<b>" + esc(mn) + "</b> Min</span></div>" +
        '<div class="xf-tk-x"></div><div class="xf-tk-a' + (one ? " xf-one" : "") + '"></div>';
      $(".xf-tk-top h3", card).textContent = title;
      var x = $(".xf-tk-x", card); extra.forEach(function (n2) { x.appendChild(n2); }); if (!extra.length) x.remove();
      var a = $(".xf-tk-a", card);
      order.forEach(function (b) { a.appendChild(b); });
      if (order.length > 3) a.style.gridTemplateColumns = "repeat(2,1fr)";
    });
  }
  function hookCards() {
    if (typeof window.renderStudentTestCards === "function" && !window.renderStudentTestCards.__xf) {
      var o = window.renderStudentTestCards;
      window.renderStudentTestCards = function () { var r = o.apply(this, arguments); try { restyleCards(); } catch (e) { console.warn("[xf] cards", e); } return r; };
      window.renderStudentTestCards.__xf = 1;
    }
    var list = $("#test-cards-list");
    if (list && !list.__xfObs && window.MutationObserver) {
      list.__xfObs = 1; var t = 0;
      new MutationObserver(function () { clearTimeout(t); t = setTimeout(function () { try { restyleCards(); } catch (e) {} }, 0); }).observe(list, { childList: true });
      try { restyleCards(); } catch (e) {}
    }
  }

  /* =====================================================================
     3) ANALYSIS (attempt dropdown)
     ===================================================================== */
  var A = null, anEl = null, anTimer = 0, origAnalysis = null;
  function byIso(a, b) { return String(a.submittedIso || "").localeCompare(String(b.submittedIso || "")); }
  function loadAttempts(testId, first) {
    var s = sess(), mob = s && typeof normalizeMobile === "function" ? normalizeMobile(s.mobile) : "";
    var p = (mob && typeof window.__getMyRecordsShared === "function") ? window.__getMyRecordsShared(mob).catch(function () { return []; }) : Promise.resolve([]);
    return p.then(function (list) {
      var arr = (list || []).filter(function (r) { return r && r.testId === testId && !r.isPractice; });
      if (first && !arr.some(function (r) { return r.submittedIso && r.submittedIso === first.submittedIso; })) arr.push(first);
      var seen = {}; arr = arr.filter(function (r) { var k = r.submittedIso || r.id; if (seen[k]) return false; seen[k] = 1; return true; });
      arr.sort(byIso); return arr;
    });
  }
  /* Rank/percentile: doosre students ke BEST score ke mukable is attempt ka score */
  function standing(rec) {
    var out = { ready: false, rank: 1, total: 1, pct: null, avg: null, top: null, top3: [] };
    try {
      var best = typeof getBestRecordsForTest === "function" ? getBestRecordsForTest(A.testId) : [];
      var cache = typeof _fullTestRecordsCache !== "undefined" ? _fullTestRecordsCache[A.testId] : null;
      if (!best.length && !cache) return out;
      out.ready = true;
      var me = studentIdentityKey(rec), sc = rec.score || 0;
      var others = best.filter(function (b) { return studentIdentityKey(b) !== me; });
      out.rank = 1 + others.filter(function (b) { return (b.score || 0) > sc; }).length;
      out.total = others.length + 1;
      if (others.length) out.pct = Math.round(others.filter(function (b) { return (b.score || 0) < sc; }).length / others.length * 100);
      var all = best.map(function (b) { return b.score || 0; }).concat(sc);
      var mine = best.filter(function (b) { return studentIdentityKey(b) === me; })[0];
      if (mine) all = best.map(function (b) { return b.score || 0; });
      out.avg = all.reduce(function (a, b) { return a + b; }, 0) / (all.length || 1);
      out.top = Math.max.apply(null, all.concat(sc));
      out.top3 = (typeof getRankedResultsForTest === "function" ? getRankedResultsForTest(A.testId) : []).slice(0, 3);
    } catch (e) { console.warn("[xf] standing", e); }
    return out;
  }
  function stats(rec) {
    var d = Array.isArray(rec.details) ? rec.details : [];
    var c = 0, w = 0, sk = 0;
    if (d.length) d.forEach(function (x) { x.status === "Correct" ? c++ : x.status === "Wrong" ? w++ : sk++; });
    else { c = rec.correct || 0; w = rec.wrong || 0; sk = rec.unattempted || 0; }
    var att = rec.attempted != null ? rec.attempted : (c + w);
    var accDen = c + w;
    return { c: c, w: w, sk: sk, att: att, total: rec.totalQuestions || d.length || (c + w + sk), acc: accDen ? Math.round(c / accDen * 100) : 0, d: d };
  }
  function mmss(s) { s = Math.max(0, Math.round(s || 0)); return String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0"); }
  function anHtml() {
    var rec = A.attempts[A.sel], t = A.test, st = stats(rec), n = A.attempts.length;
    var max = (t ? getTestGrandTotalMarks(t) : 0) || rec.maxScore || 0, sc = rec.score || 0, p = max > 0 ? Math.max(0, Math.min(100, sc / max * 100)) : 0;
    var S = standing(rec);
    var sel = n > 1 ? '<label class="xf-sel"><select data-xa="sel" aria-label="Attempt">' + A.attempts.map(function (r, i) { return '<option value="' + i + '"' + (i === A.sel ? " selected" : "") + ">Attempt " + (i + 1) + "</option>"; }).join("") + "</select></label>" : '<span class="xf-one-pill">Attempt 1</span>';
    var date = typeof formatResultDate === "function" ? formatResultDate(rec.submittedIso) : "";
    var rankTxt = S.ready && S.total > 1 ? " · " + S.total + " students · rank <b>" + S.rank + "</b>" : "";
    var msg = p >= 80 ? ["g", "Excellent work!", "You scored very well in this attempt. Review your weak chapters to improve further."]
      : p >= 50 ? ["", "Good attempt", "Review your weak chapters below and re-attempt to improve your score."]
        : ["r", "Needs more practice", "Go through the solutions, work on weak chapters and attempt again."];
    var h = '<div class="xf-bar"><button type="button" class="xf-ic-btn" data-xa="close" aria-label="Back">' + svg(P.back) + '</button><span class="xf-bt">Analysis</span><span class="xf-sp"></span>' + sel + "</div><div class=\"xf-ana\">";
    h += '<section class="xf-hx"><div class="xf-hl"><small>' + esc((rec.testTitle || (t && t.title) || "Test")) + (date ? " · " + esc(date) : "") + '</small><div class="xf-big">' + num(sc) + "<span>/" + num(max) + "</span></div><p>Attempt " + (A.sel + 1) + rankTxt + '</p></div><div class="xf-ring" style="--p:' + p.toFixed(0) + '"><div><b>' + Math.round(p) + "%</b></div></div></section>";
    h += '<section class="xf-st"><div><b>' + st.att + "<em>/" + st.total + "</em></b><small>Attempted</small></div><div><b style=\"color:#0e8a43\">" + st.c + "</b><small>Correct</small></div><div><b style=\"color:#d63a3f\">" + st.w + "</b><small>Wrong</small></div><div><b>" + st.sk + "</b><small>Skipped</small></div><div><b>" + st.acc + "<em>%</em></b><small>Accuracy</small></div><div><b>" + (rec.durationSeconds != null ? mmss(rec.durationSeconds) : "—") + "</b><small>Time" + (t && t.minutes ? " / " + t.minutes + ":00" : "") + "</small></div></section>";
    h += '<section class="xf-msg ' + msg[0] + '"><b>' + msg[1] + "</b><p>" + msg[2] + (S.pct != null ? " You are ahead of " + S.pct + "% of students." : "") + "</p></section>";
    if (n > 1) {
      h += '<section class="xf-sx"><h2>Improvement across attempts</h2><div class="xf-tr">' + A.attempts.map(function (r, i) { var m2 = max || r.maxScore || 1; return '<div class="' + (i === A.sel ? "on" : "") + '"><em>' + num(r.score || 0) + '</em><i style="height:' + Math.max(3, Math.min(100, (r.score || 0) / m2 * 100)) + '%"></i><small>Attempt ' + (i + 1) + "</small></div>"; }).join("") + "</div></section>";
    }
    var g = {}; st.d.forEach(function (x) { var k = x.section || x.subject || "General"; var o = g[k] || (g[k] = { m: 0, max: 0, c: 0, w: 0, s: 0 }); o.m += Number(x.marksAwarded) || 0; o.max += Number(x.marksPerQuestion) || 0; x.status === "Correct" ? o.c++ : x.status === "Wrong" ? o.w++ : o.s++; });
    var gk = Object.keys(g);
    if (gk.length) {
      h += '<section class="xf-sx"><h2>' + (gk.length > 1 ? "Section ke hisaab se" : "Performance") + "</h2>" + gk.map(function (k) {
        var o = g[k], pc = o.max > 0 ? Math.max(0, Math.min(100, o.m / o.max * 100)) : 0;
        return '<div class="xf-sr"><div class="xf-sn"><b>' + esc(k) + "</b><small>" + o.c + " correct · " + o.w + " wrong · " + o.s + ' skip</small></div><div class="xf-bar2"><i style="width:' + pc + '%"></i></div><div class="xf-sm"><b>' + num(o.m) + "</b>/" + num(o.max) + "</div></div>";
      }).join("") + "</section>";
    }
    var ch = {}; st.d.forEach(function (x) { var k = x.chapter || x.subject; if (!k) return; var o = ch[k] || (ch[k] = { c: 0, t: 0 }); o.t++; if (x.status === "Correct") o.c++; });
    var ck = Object.keys(ch).sort(function (a, b) { return ch[a].c / ch[a].t - ch[b].c / ch[b].t; }).slice(0, 8);
    if (ck.length) {
      h += '<section class="xf-sx"><h2>Chapter-wise (kamzor pehle)</h2>' + ck.map(function (k) {
        var o = ch[k], y = Math.round(o.c / o.t * 100), col = y >= 70 ? "#16a34a" : y >= 40 ? "#d97706" : "#e5484d", lb = y >= 70 ? "Strong" : y >= 40 ? "Average" : "Weak";
        return '<div class="xf-chap"><div><span>' + esc(k) + '</span><span style="color:' + col + '">' + lb + " " + y + "% (" + o.c + "/" + o.t + ')</span></div><div class="xf-bar2"><i style="width:' + y + "%;background:" + col + '"></i></div></div>';
      }).join("") + "</section>";
    }
    if (S.ready && S.top3.length) {
      h += '<section class="xf-sx"><h2>Top 3 scorers</h2><div class="xf-pod">' + [1, 0, 2].filter(function (k) { return S.top3[k]; }).map(function (k) {
        var x = S.top3[k]; return '<div class="p' + k + '"><u>' + esc(String(x.name || "S").charAt(0).toUpperCase()) + "</u><b>" + esc(x.name) + "</b><small>" + num(x.score) + "/" + num(x.maxScore) + "</small><i>" + (k + 1) + "</i></div>";
      }).join("") + "</div></section>";
    }
    if (S.ready && S.total > 1) {
      var mx = Math.max(max, S.top || 0, sc, 1), bar = function (v, cls) { return '<div class="xf-w"><em>' + num(Math.round(v * 10) / 10) + '</em><i class="' + cls + '" style="height:' + Math.max(2, v / mx * 100) + '%"></i></div>'; };
      h += '<section class="xf-sx"><h2>You, average and topper</h2><div class="xf-ch"><div>' + bar(sc, "xf-c0") + "<small>Aap</small></div><div>" + bar(S.avg || 0, "xf-c1") + "<small>Average</small></div><div>" + bar(S.top || 0, "xf-c2") + "<small>Topper</small></div></div></section>";
    }
    h += '</div><div class="xf-fx"><div><button type="button" class="xf-btn o" data-xa="re">Re-attempt</button>' + (st.d.length ? '<button type="button" class="xf-btn" data-xa="sol">Solution</button>' : "") + "</div></div>";
    return h;
  }
  function renderAn(keep) { if (!anEl || !A) return; var sc = anEl.scrollTop; anEl.innerHTML = anHtml(); anEl.scrollTop = keep ? sc : 0; }
  function openAnalysis(rec, testId) {
    var t = T()[testId];
    A = { testId: testId, test: t, attempts: [rec], sel: 0 };
    if (!anEl) {
      anEl = document.createElement("div"); anEl.id = "xf-an"; anEl.className = "xf-an xf-hide"; anEl.setAttribute("role", "dialog"); anEl.setAttribute("aria-modal", "true"); document.body.appendChild(anEl);
      anEl.addEventListener("click", function (e) {
        var b = e.target.closest("[data-xa]"); if (!b || !A) return; var a = b.getAttribute("data-xa");
        if (a === "close") closeAnalysis(false);
        else if (a === "re") { var id = A.testId; closeAnalysis(false); try { startTestWithId(id); } catch (x) { console.warn(x); } }
        else if (a === "sol") { var r = A.attempts[A.sel]; closeAnalysis(false); try { openTestSolutionFromRecord(r); } catch (x) { console.warn(x); } }
      });
      anEl.addEventListener("change", function (e) { if (e.target && e.target.getAttribute("data-xa") === "sel") { A.sel = +e.target.value; renderAn(false); } });
    }
    renderAn(false); anEl.classList.remove("xf-hide"); document.documentElement.style.overflow = "hidden"; histOpen("an");
    loadAttempts(testId, rec).then(function (arr) {
      if (!A || A.testId !== testId || !arr.length) return;
      var iso = rec.submittedIso, idx = -1; arr.forEach(function (r, i) { if (r.submittedIso === iso) idx = i; });
      A.attempts = arr; A.sel = idx >= 0 ? idx : arr.length - 1; renderAn(true);
    });
    /* Rank data thoda late aata hai (light records) — 4 baar tak dobara try */
    var tries = 0; clearInterval(anTimer);
    anTimer = setInterval(function () { tries++; if (!A || anEl.classList.contains("xf-hide") || tries > 4) { clearInterval(anTimer); return; } try { if (standing(A.attempts[A.sel]).ready) { renderAn(true); clearInterval(anTimer); } } catch (e) {} }, 900);
  }
  function closeAnalysis(fromPop) {
    if (!anEl) return; clearInterval(anTimer);
    anEl.classList.add("xf-hide"); anEl.innerHTML = ""; A = null; document.documentElement.style.overflow = "";
    if (fromPop !== true) histClose(); else { H.open = null; H.pushed = false; }
  }
  function hookAnalysis() {
    if (typeof window.openTestAnalysisFromRecord !== "function" || window.openTestAnalysisFromRecord.__xf) return;
    origAnalysis = window.openTestAnalysisFromRecord;
    window.openTestAnalysisFromRecord = function (rec, testId) {
      try {
        if (rec && !rec.isPractice && testId && T()[testId]) { openAnalysis(rec, testId); return; }
      } catch (e) { console.warn("[xf] analysis fallback", e); }
      return origAnalysis.apply(this, arguments);
    };
    window.openTestAnalysisFromRecord.__xf = 1;
  }

  /* =====================================================================
     4) EXAM: section tabs + swipe
     ===================================================================== */
  function tabsHost() {
    var h = $("#xf-sec-tabs"); if (h) return h;
    var m = $("#exam-screen .exam-main"); if (!m) return null;
    h = document.createElement("div"); h.id = "xf-sec-tabs"; h.className = "xf-sec-tabs hidden"; m.insertBefore(h, m.firstChild); return h;
  }
  function renderTabs() {
    var c = cur(), t = c && c.test, h = tabsHost(), scr = $("#exam-screen"); if (!h || !t) return;
    var qs = t.questions || [], titles = typeof getTestSectionTitles === "function" ? getTestSectionTitles(t) : [];
    if (titles.length < 2) { h.classList.add("hidden"); scr && scr.classList.remove("xf-has-tabs"); return; }
    var curSec = (qs[c.index] || {}).section || "";
    h.innerHTML = titles.map(function (ti) {
      var first = -1, tot = 0, ans = 0;
      qs.forEach(function (q, i) { if (q.section === ti) { if (first < 0) first = i; tot++; if (c.answers[i] !== null && c.answers[i] !== undefined && c.answers[i] !== "") ans++; } });
      return '<button type="button" class="' + (ti === curSec ? "on" : "") + '" data-first="' + first + '">' + esc(ti) + "<small>" + ans + "/" + tot + "</small></button>";
    }).join("");
    h.classList.remove("hidden"); scr && scr.classList.add("xf-has-tabs");
    var on = $("button.on", h); if (on && on.scrollIntoView) { try { h.scrollLeft = Math.max(0, on.offsetLeft - 16); } catch (e) {} }
    if (!h.__xfClick) {
      h.__xfClick = 1;
      h.addEventListener("click", function (e) {
        var b = e.target.closest("[data-first]"); if (!b) return; var i = +b.getAttribute("data-first"), cc = cur(); if (!cc || i < 0) return;
        var dir = i > cc.index ? 1 : -1; cc.index = i; window.renderQuestion(); slideIn(dir);
      });
    }
  }
  function hookRender() {
    if (typeof window.renderQuestion !== "function" || window.renderQuestion.__xf) return;
    var o = window.renderQuestion;
    window.renderQuestion = function () { var r = o.apply(this, arguments); try { renderTabs(); } catch (e) { console.warn("[xf] tabs", e); } return r; };
    window.renderQuestion.__xf = 1;
  }
  function slideEls() { return [$("#exam-question"), $("#exam-options")].filter(Boolean); }
  function slideIn(dir) {
    var els = slideEls(), cls = dir > 0 ? "xf-in-next" : "xf-in-prev";
    els.forEach(function (el) { el.style.transition = ""; el.style.transform = ""; el.style.opacity = ""; el.classList.remove("xf-in-next", "xf-in-prev"); void el.offsetWidth; el.classList.add(cls); });
    setTimeout(function () { els.forEach(function (el) { el.classList.remove(cls); }); }, 320);
  }
  function hookMove() {
    if (typeof window.moveQuestion !== "function" || window.moveQuestion.__xf) return;
    var o = window.moveQuestion;
    window.moveQuestion = function (d) { var c = cur(), b = c ? c.index : 0; var r = o.apply(this, arguments); if (c && c.index !== b) slideIn(d > 0 ? 1 : -1); return r; };
    window.moveQuestion.__xf = 1;
  }
  /* Purana setupExamSwipeNav "exam-main" id dhundta tha jo HTML me hai hi nahi (class hai) — isliye swipe kabhi chalta nahi tha. Ye naya swipe class se judta hai. */
  function blocked(el) {
    for (var n = el; n && n !== document.body; n = n.parentElement) {
      var tg = n.tagName; if (tg === "TEXTAREA" || tg === "INPUT" || tg === "SELECT") return true;
      if (n.classList && (n.classList.contains("xf-sec-tabs") || n.classList.contains("exam-actions") || n.classList.contains("exam-footer-btns"))) return true;
      if (n.scrollWidth > n.clientWidth + 4 && n !== document.documentElement) { var ov = getComputedStyle(n).overflowX; if (ov === "auto" || ov === "scroll") return true; }
      if (n.classList && n.classList.contains("exam-main")) break;
    }
    return false;
  }
  function bindSwipe() {
    var m = $("#exam-screen .exam-main"); if (!m || m.__xfSw) return; m.__xfSw = 1;
    var sx = 0, sy = 0, st = 0, dx = 0, on = false, hz = false;
    var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    function drag(x) { slideEls().forEach(function (el) { el.style.transition = "none"; el.style.transform = "translateX(" + (x * 0.4) + "px)"; el.style.opacity = String(Math.max(0.35, 1 - Math.abs(x) / 420)); }); }
    function spring() { slideEls().forEach(function (el) { el.style.transition = "transform .2s ease,opacity .2s ease"; el.style.transform = ""; el.style.opacity = ""; }); }
    m.addEventListener("touchstart", function (e) { if (e.touches.length !== 1 || blocked(e.target)) { on = false; return; } on = true; hz = false; dx = 0; sx = e.touches[0].clientX; sy = e.touches[0].clientY; st = Date.now(); }, { passive: true });
    m.addEventListener("touchmove", function (e) {
      if (!on) return; var x = e.touches[0].clientX - sx, y = e.touches[0].clientY - sy;
      if (!hz) { if (Math.abs(x) > 12 && Math.abs(x) > Math.abs(y) * 1.4) hz = true; else if (Math.abs(y) > 12) { on = false; return; } }
      if (hz) { dx = x; if (!reduce) drag(x); }
    }, { passive: true });
    function end() {
      if (!on || !hz) { on = false; return; } on = false;
      var c = cur(), n = c && c.test ? c.test.questions.length : 0, fast = Date.now() - st < 800;
      var go = fast && Math.abs(dx) > 70 || Math.abs(dx) > 140;
      slideEls().forEach(function (el) { el.style.transition = ""; el.style.transform = ""; el.style.opacity = ""; });
      if (go && c && dx < 0 && c.index < n - 1) window.moveQuestion(1);
      else if (go && c && dx > 0 && c.index > 0) window.moveQuestion(-1);
      else spring();
    }
    m.addEventListener("touchend", end, { passive: true }); m.addEventListener("touchcancel", function () { on = false; spring(); }, { passive: true });
  }


  /* =====================================================================
     5) SUBMIT ke baad Analysis apne-aap khule
     ===================================================================== */
  var _lastAuto = 0;
  function latestRecord(id) {
    var s = sess(), mob = s && typeof normalizeMobile === "function" ? normalizeMobile(s.mobile) : "", r = null;
    try { if (typeof myTestAttemptsCache !== "undefined" && myTestAttemptsCache && myTestAttemptsCache[id]) r = myTestAttemptsCache[id]; } catch (e) {}
    try {
      (typeof records !== "undefined" ? records : []).forEach(function (x) {
        if (!x || x.testId !== id || x.isPractice) return;
        if (mob && typeof normalizeMobile === "function" && normalizeMobile(x.mobile) !== mob) return;
        if (!r || String(x.submittedIso || "") > String(r.submittedIso || "")) r = x;
      });
    } catch (e) {}
    return r;
  }
  function hookSubmit() {
    if (typeof window.showResult !== "function" || window.showResult.__xf) return;
    var o = window.showResult;
    window.showResult = async function () {
      var c = cur(), t = c && c.test, id = c && c.testId, skip = !t || t.isPractice || t.custom || !id || !T()[id];
      var r = await o.apply(this, arguments);
      if (!skip && Date.now() - _lastAuto > 4000) {
        _lastAuto = Date.now();
        setTimeout(function () {
          try { var rec = latestRecord(id); if (rec) openAnalysis(rec, id); } catch (e) { console.warn("[xf] auto analysis", e); }
        }, 250);
      }
      return r;
    };
    window.showResult.__xf = 1;
  }

  /* ---------- hooks ko tab tak try karo jab tak script.js ke functions ready na ho ---------- */
  var tries = 0;
  function boot() {
    try { hookBegin(); hookCards(); hookAnalysis(); hookRender(); hookMove(); hookSubmit(); bindSwipe(); } catch (e) { console.warn("[xf] boot", e); }
    var ready = window.beginExam && window.beginExam.__xf && window.renderQuestion && window.renderQuestion.__xf && window.moveQuestion && window.moveQuestion.__xf && window.openTestAnalysisFromRecord && window.openTestAnalysisFromRecord.__xf && window.renderStudentTestCards && window.renderStudentTestCards.__xf && window.showResult && window.showResult.__xf && $("#test-cards-list") && $("#exam-screen .exam-main") && $("#exam-screen .exam-main").__xfSw;
    if (!ready && ++tries < 40) setTimeout(boot, 500);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();

  /* Test ke liye chhote pure helpers */
  window.__xfPure = { info: info, stats: stats, mmss: mmss };
})();
