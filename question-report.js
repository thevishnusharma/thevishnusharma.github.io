/* v214 — Question Report: student test ke dauran galat question report kare, admin dekhe, edit kare, resolved mark kare.
   Data: top-level collection `questionReports/{testId}_{qIndex}_{mobile}`  (firestore.rules me naya match — deploy zaroori)
   Student: exam screen par "🚩 Report" button -> reason + message -> admin ko jata hai.
   Admin : dashboard card "🚩 Question Reports" (open count badge) -> list -> "✏️ Question Edit" (test editor khulta hai) -> "✅ Resolved".
   Edit ke baad admin wahi purana "Save Test Online" dabata hai — test online dobara set ho jata hai. */
(function () {
  "use strict";
  var REASONS = [
    "Question mein galti hai (spelling / data / likha hua galat)",
    "Sahi option (answer key) galat hai",
    "Koi bhi option sahi nahi hai",
    "Ek se zyada option sahi lag rahe hain",
    "Option galat ya adhoora hai",
    "Image / diagram / formula nahi dikh raha",
    "Koi aur problem"
  ];
  function $(i) { return document.getElementById(i); }
  function db() { return window.vishnuFirebase && window.vishnuFirebase.enabled ? window.vishnuFirebase.db : null; }
  function ts() { return firebase.firestore.FieldValue.serverTimestamp(); }
  function col() { var d = db(); return d ? d.collection("questionReports") : null; }
  function adminInst() { try { return typeof getCurrentAdminInstituteId === "function" ? (getCurrentAdminInstituteId() || "") : ""; } catch (e) { return ""; } }
  function ago(ms) { var m = Math.floor((Date.now() - ms) / 60000); return m < 1 ? "Abhi" : m < 60 ? m + " min pehle" : m < 1440 ? Math.floor(m / 60) + " ghante pehle" : Math.floor(m / 1440) + " din pehle"; }
  function clean(s, n) { return String(s == null ? "" : s).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, n); }
  function el(tag, css, txt) { var e = document.createElement(tag); if (css) e.style.cssText = css; if (txt != null) e.textContent = txt; return e; }

  // ───────────────────────── Student side ─────────────────────────
  function studentInfo() {
    var name = "", mobile = "";
    try { if (typeof current !== "undefined" && current.student) { name = current.student.name || ""; mobile = current.student.mobile || ""; } } catch (e) {}
    try { if (!mobile && typeof getStudentSession === "function") { var s = getStudentSession(); if (s) { mobile = s.mobile || ""; name = name || s.name || ""; } } } catch (e) {}
    return { name: clean(name, 80), mobile: String(mobile || "").replace(/\D/g, "").slice(0, 15) };
  }
  function qContext() {
    try {
      if (typeof current === "undefined" || !current.test || !current.test.questions) return null;
      var t = current.test, i = current.index, q = t.questions[i];
      if (!q) return null;
      var txt = q.textEN || q.textHI || q.text || "";
      // Practice (re-attempt / weak) me current.testId synthetic hota hai; asli test ka id aur sawaal ka index use karo,
      // taaki admin "Question Edit" usi test ko khol sake.
      var srcId = t.sourceTestId || current.testId;
      var orig = (typeof tests !== "undefined" && tests && srcId && tests[srcId]) || null;
      var qi = (Array.isArray(t.sourceQIdx) && t.sourceQIdx[i] != null) ? t.sourceQIdx[i] : i;
      return { testId: String(srcId || ""), testTitle: clean((orig && orig.title) || t.title, 120), instituteId: String(t.instituteId || (orig && orig.instituteId) || ""), qIndex: qi, qNumber: qi + 1, qText: clean(txt, 300) };
    } catch (e) { return null; }
  }
  function buildStudentModal() {
    if ($("qr-ov")) return;
    var o = el("div", "position:fixed;inset:0;z-index:100000;background:rgba(15,27,61,.55);display:none;align-items:center;justify-content:center;padding:14px;box-sizing:border-box");
    o.id = "qr-ov";
    var box = el("div", "background:#fff;border-radius:20px;width:100%;max-width:460px;max-height:92vh;overflow:auto;padding:16px;box-sizing:border-box");
    var head = el("div", "display:flex;align-items:center;justify-content:space-between;margin-bottom:6px");
    head.appendChild(el("h3", "margin:0;font-size:1.05rem", "🚩 Question Report Karein"));
    var x = el("button", "background:none;border:0;font-size:1.3rem;cursor:pointer", "✕"); x.type = "button"; x.id = "qr-x"; head.appendChild(x);
    box.appendChild(head);
    var info = el("p", "margin:0 0 10px;font-size:.8rem;color:#475569"); info.id = "qr-info"; box.appendChild(info);
    var lb1 = el("label", "display:block;font-size:.8rem;font-weight:700;margin-bottom:4px", "Kya galat hai?"); box.appendChild(lb1);
    var sel = el("select", "width:100%;box-sizing:border-box;margin-bottom:10px"); sel.id = "qr-reason";
    REASONS.forEach(function (r) { var op = document.createElement("option"); op.value = r; op.textContent = r; sel.appendChild(op); });
    box.appendChild(sel);
    var lb2 = el("label", "display:block;font-size:.8rem;font-weight:700;margin-bottom:4px", "Message (kya galti hai, likhkar batayein)"); box.appendChild(lb2);
    var ta = el("textarea", "width:100%;box-sizing:border-box;margin-bottom:8px"); ta.id = "qr-msg"; ta.rows = 4; ta.maxLength = 800; ta.placeholder = "Jaise: Option B mein 24 likha hai, par sahi answer 42 hona chahiye..."; box.appendChild(ta);
    var send = el("button", "width:100%", "📤 Admin ko bhejein"); send.type = "button"; send.id = "qr-send"; send.className = "btn-primary"; box.appendChild(send);
    var st = el("p", "margin:8px 0 0;font-size:.82rem;color:#475569"); st.id = "qr-st"; box.appendChild(st);
    o.appendChild(box); document.body.appendChild(o);
    o.onclick = function (e) { if (e.target === o) closeStudent(); };
    x.onclick = closeStudent; send.onclick = submitReport;
  }
  function stSet(m, bad) { var e = $("qr-st"); if (e) { e.textContent = m; e.style.color = bad ? "#b91c1c" : "#475569"; } }
  function closeStudent() { var o = $("qr-ov"); if (o) o.style.display = "none"; }
  function openStudent() {
    var ctx = qContext();
    if (!ctx) { alert("Pehle test shuru karein."); return; }
    buildStudentModal();
    $("qr-info").textContent = "Question " + ctx.qNumber + " — " + (ctx.testTitle || "Test");
    $("qr-msg").value = ""; $("qr-reason").selectedIndex = 0; stSet("");
    var b = $("qr-send"); b.disabled = false; b.textContent = "📤 Admin ko bhejein";
    $("qr-ov").style.display = "flex";
  }
  function submitReport() {
    var ctx = qContext(), me = studentInfo(), c = col();
    if (!ctx) return stSet("⚠️ Question pehchaan nahi hua.", true);
    if (!c) return stSet("❌ Internet / server abhi connect nahi hai. Thodi der baad try karein.", true);
    if (!me.mobile) return stSet("⚠️ Report ke liye student login/mobile number zaroori hai.", true);
    if (!ctx.testId) return stSet("⚠️ Test pehchaan nahi hua.", true);
    var reason = $("qr-reason").value, msg = clean($("qr-msg").value, 800);
    if (msg.length < 5) return stSet("⚠️ Kripya message mein galti likhkar batayein (kam se kam 5 akshar).", true);
    var btn = $("qr-send"); btn.disabled = true; stSet("⏳ Bhej rahe hain...");
    var id = (ctx.testId + "_" + ctx.qIndex + "_" + me.mobile).replace(/[\/\s]/g, "_");
    c.doc(id).set({
      testId: ctx.testId, testTitle: ctx.testTitle, instituteId: ctx.instituteId, qIndex: ctx.qIndex, qNumber: ctx.qNumber, qText: ctx.qText,
      reason: clean(reason, 100), message: msg, name: me.name, mobile: me.mobile, status: "open", createdAt: ts()
    }).then(function () {
      stSet("✅ Report admin ko bhej di gayi. Dhanyavaad! Aap test jaari rakh sakte hain."); btn.textContent = "✅ Bhej di gayi";
      setTimeout(closeStudent, 1600);
    }).catch(function (e) {
      btn.disabled = false;
      var m = String(e && e.message || e);
      stSet(/permission|insufficient/i.test(m) ? "ℹ️ Aap is question ko pehle hi report kar chuke hain (ya permission nahi mili)." : "❌ Nahi bhej paaye: " + m, true);
    });
  }
  function injectStudentButton() {
    if ($("qr-report-btn")) return true;
    var mr = $("mark-review"); if (!mr || !mr.parentNode) return false;
    var b = document.createElement("button"); b.type = "button"; b.id = "qr-report-btn"; b.className = mr.className || "btn-ghost"; b.textContent = "🚩 Report";
    b.setAttribute("aria-label", "Is question ko report karein");
    b.onclick = openStudent; mr.parentNode.insertBefore(b, mr.nextSibling);
    return true;
  }

  // ───────────────────────── Admin side ─────────────────────────
  var view = "open";
  function instKeys() { var i = adminInst(); return i ? [i, ""] : [""]; }
  function query(status) {
    var c = col(); if (!c) return null;
    return c.where("instituteId", "in", instKeys()).where("status", "==", status).limit(100);
  }
  function setBadge(n) {
    var b = document.querySelector("#qr-card .cd-badge"); if (b) b.textContent = n > 0 ? (n + " naye") : "Reports";
  }
  function refreshCount() {
    var q = query("open"); if (!q) return;
    q.get().then(function (s) { setBadge(s.size); }).catch(function () {});
  }
  function buildAdmin() {
    if ($("qra-ov")) return;
    var o = el("div", "position:fixed;inset:0;z-index:99998;background:rgba(15,27,61,.5);display:none;align-items:center;justify-content:center;padding:14px;box-sizing:border-box"); o.id = "qra-ov";
    var box = el("div", "background:#fff;border-radius:20px;width:100%;max-width:560px;max-height:92vh;overflow:auto;padding:16px;box-sizing:border-box");
    var head = el("div", "display:flex;align-items:center;justify-content:space-between;margin-bottom:8px");
    head.appendChild(el("h3", "margin:0;font-size:1.05rem", "🚩 Question Reports"));
    var x = el("button", "background:none;border:0;font-size:1.3rem;cursor:pointer", "✕"); x.type = "button"; head.appendChild(x); box.appendChild(head);
    box.appendChild(el("p", "margin:0 0 10px;font-size:.78rem;color:#64748b", "Students ne jo questions galat bataye, wo yahan dikhte hain. ✏️ dabakar question edit karein, phir wahi 'Save Test Online' dabayein — test dobara online set ho jaayega."));
    var tabs = el("div", "display:flex;gap:8px;margin-bottom:10px");
    ["open", "resolved"].forEach(function (k) {
      var t = el("button", "flex:1", k === "open" ? "🟠 Open" : "✅ Resolved"); t.type = "button"; t.className = "btn-secondary"; t.dataset.k = k;
      t.onclick = function () { view = k; paintTabs(); load(); }; tabs.appendChild(t);
    });
    box.appendChild(tabs);
    var st = el("p", "margin:0 0 8px;font-size:.8rem;color:#64748b"); st.id = "qra-st"; box.appendChild(st);
    var list = el("div"); list.id = "qra-list"; box.appendChild(list);
    o.appendChild(box); document.body.appendChild(o);
    o.onclick = function (e) { if (e.target === o) closeAdmin(); }; x.onclick = closeAdmin;
  }
  function paintTabs() {
    var o = $("qra-ov"); if (!o) return;
    o.querySelectorAll("button[data-k]").forEach(function (t) { var on = t.dataset.k === view; t.style.fontWeight = on ? "800" : "500"; t.style.outline = on ? "2px solid #4f46e5" : "none"; });
  }
  function closeAdmin() { var o = $("qra-ov"); if (o) o.style.display = "none"; }
  function openAdmin() { buildAdmin(); $("qra-ov").style.display = "flex"; paintTabs(); load(); }
  function aSt(m) { var e = $("qra-st"); if (e) e.textContent = m; }
  function load() {
    var box = $("qra-list"), q = query(view); if (!box) return;
    box.textContent = "";
    if (!q) { aSt("❌ Server connect nahi hai — admin dobara login karein."); return; }
    aSt("⏳ Loading...");
    q.get().then(function (s) {
      aSt(s.empty ? (view === "open" ? "🎉 Koi open report nahi hai." : "Abhi koi resolved report nahi hai.") : s.size + " report(s)");
      if (view === "open") setBadge(s.size);
      var docs = []; s.forEach(function (d) { docs.push(d); });
      docs.sort(function (a, b) { var A = a.data().createdAt, B = b.data().createdAt; return (B && B.toMillis ? B.toMillis() : 0) - (A && A.toMillis ? A.toMillis() : 0); });
      docs.forEach(function (d) { box.appendChild(row(d)); });
    }).catch(function (e) {
      var m = String(e && e.message || e);
      aSt(/permission/i.test(m) ? "❌ Permission nahi mili — naya firestore.rules deploy karein." : "❌ Load nahi hua: " + m);
    });
  }
  function row(d) {
    var x = d.data(), ms = x.createdAt && x.createdAt.toMillis ? x.createdAt.toMillis() : Date.now();
    var r = el("div", "border:1px solid #e4ebfb;border-radius:14px;padding:10px 12px;margin-bottom:8px;font-size:.84rem");
    r.appendChild(el("div", "font-weight:800", "📝 " + (x.testTitle || "Test") + " — Q" + (x.qNumber || "?")));
    if (x.qText) r.appendChild(el("div", "color:#475569;margin:3px 0;font-style:italic", "“" + x.qText + (String(x.qText).length >= 300 ? "…" : "") + "”"));
    r.appendChild(el("div", "color:#b45309;font-weight:700;margin-top:4px", "⚠️ " + (x.reason || "")));
    r.appendChild(el("div", "margin:3px 0;white-space:pre-wrap", x.message || ""));
    r.appendChild(el("small", "color:#94a3b8", "👤 " + (x.name || "Student") + (x.mobile ? " (" + x.mobile + ")" : "") + " • " + ago(ms)));
    var acts = el("div", "display:flex;flex-wrap:wrap;gap:6px;margin-top:8px");
    var ed = el("button", "", "✏️ Question Edit Karein"); ed.type = "button"; ed.className = "btn-primary";
    ed.onclick = function () { editQuestion(x); };
    acts.appendChild(ed);
    var tg = el("button", "", view === "open" ? "✅ Resolved" : "↩️ Dobara Open"); tg.type = "button"; tg.className = "btn-secondary";
    tg.onclick = function () {
      tg.disabled = true;
      var upd = view === "open" ? { status: "resolved", resolvedAt: ts() } : { status: "open", resolvedAt: firebase.firestore.FieldValue.delete() };
      d.ref.update(upd).then(function () { load(); refreshCount(); }).catch(function () { tg.disabled = false; aSt("❌ Update nahi hua."); });
    };
    acts.appendChild(tg);
    var del = el("button", "", "🗑️"); del.type = "button"; del.className = "btn-secondary"; del.setAttribute("aria-label", "Report delete karein");
    del.onclick = function () { if (confirm("Ye report delete karein?")) d.ref.delete().then(function () { load(); refreshCount(); }).catch(function () { aSt("❌ Delete nahi hua."); }); };
    acts.appendChild(del);
    r.appendChild(acts); return r;
  }
  function editQuestion(x) {
    try {
      if (typeof tests === "undefined" || !tests[x.testId] || typeof editTest !== "function") { aSt("⚠️ Ye test list mein nahi mila (delete ho gaya ya abhi load nahi hua). Admin → Tests mein jaakar dhoondhein."); return; }
      closeAdmin();
      try { if (typeof showAdminTab === "function") showAdminTab("tests"); } catch (e) {}
      editTest(x.testId);
      setTimeout(function () {
        var qi = x.qIndex != null && !isNaN(+x.qIndex) ? +x.qIndex : (+x.qNumber - 1);
        var note = "Student ne likha:\n" + (x.reason ? x.reason + "\n" : "") + (x.message || "");
        if (window.SnapQEdit && window.SnapQEdit.editDraft && qi >= 0) {
          window.SnapQEdit.editDraft(qi, { note: note, doneMsg: "✅ Question badal gaya. Ab 'Save Test Online' dabayein, fir Question Reports me ✅ Resolved kar dein." });
        } else {
          alert("✏️ '" + (x.testTitle || "Test") + "' mein Question " + x.qNumber + " ko theek karein.\n\nStudent ne likha: " + (x.message || "") + "\n\nEdit ke baad 'Save Test Online' dabayein — test dobara online ho jaayega. Fir yahan report ko ✅ Resolved mark kar dein.");
        }
      }, 400);
    } catch (e) { aSt("⚠️ Test edit nahi khul paya: " + (e && e.message || e)); }
  }
  function initAdminCard() {
    var grid = document.querySelector("#admin-dashboard-home .cd-grid");
    if (!grid || $("qr-card")) return !!grid;
    var b = document.createElement("button"); b.type = "button"; b.id = "qr-card"; b.className = "cd-card cd-gold";
    b.innerHTML = '<div class="cd-card-top"><div class="cd-icon-circle">🚩</div><span class="cd-badge">Reports</span></div><div class="cd-card-title">Question Reports</div><div class="cd-card-sub">Students ne jo galat questions bataye</div><div class="cd-card-bottom"><span class="cd-arrow-btn">→</span></div>';
    b.onclick = openAdmin; grid.appendChild(b);
    return true;
  }

  function init() {
    var tries = 0;
    (function tick() {
      var a = injectStudentButton(), b = initAdminCard();
      if (!(a && b) && ++tries < 20) setTimeout(tick, 1500);
      if (b) { setTimeout(refreshCount, 3000); setTimeout(refreshCount, 12000); }
    })();
  }
  window.SnapQuestionReport = { open: openStudent, openAdmin: openAdmin, _reasons: REASONS };
  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", init) : init();
})();
