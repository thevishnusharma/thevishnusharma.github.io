/* v169 — Batch notifications + Chapter tests + batch-wise Start Test list + Syllabus / Upcoming.
   Purana kuch replace nahi hota; ye module existing batch-system / batch-phase2 / script.js me chhote hooks se judta hai.

   Data (denormalized — student side par 0 extra read, isliye list me koi lag nahi):
     tests/{id}.batchLinks = { <batchId>: { s: "Subject", c: "Chapter" } }   (jis test par ye nahi, wo "general" test hai — sabko dikhta hai)
     tests/{id}.syllabus   = "text"
     institutes/{i}/notifications/{n}.batchId  -> push sirf us batch ke topic "bat_<inst>_<batch>" par jaata hai
*/
(function () {
  "use strict";
  var W = window, KEY = "snap_my_batches_v169";
  var API = W.SnapV169 = {};

  function esc(t) { return String(t == null ? "" : t).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function norm(t) { return String(t == null ? "" : t).toLowerCase().replace(/\s+/g, " ").trim(); }
  function sess() { try { return typeof getStudentSession === "function" ? getStudentSession() : null; } catch (e) { return null; } }
  function mob() { var s = sess(); return s ? String(s.mobile || "").replace(/\D/g, "").slice(-10) : ""; }
  function DB() { var v = W.vishnuFirebase; return v && v.enabled ? v.db : null; }
  function FV() { return firebase.firestore.FieldValue; }
  function adminEmail() { try { return (W.vishnuFirebase.auth.currentUser.email || "").toLowerCase(); } catch (e) { return ""; } }
  function inst() { try { return typeof getCurrentAdminInstituteId === "function" ? getCurrentAdminInstituteId() : null; } catch (e) { return null; } }
  function fmtDT(s) {
    try { var d = s && s.toDate ? s.toDate() : new Date(s); if (isNaN(d)) return ""; return d.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }); } catch (e) { return ""; }
  }

  /* ================= STUDENT: mere batches (cache — list turant khulti hai) ================= */
  var mine = null, cm = "", lastRef = 0;
  function readCache() {
    try { var v = JSON.parse(localStorage.getItem(KEY) || "null"); mine = v && v.m === cm && Array.isArray(v.ids) ? v.ids : null; } catch (e) { mine = null; }
  }
  function ensure() { var m = mob(); if (m !== cm) { cm = m; readCache(); if (m) refresh(true); } }
  function setMine(ids) {
    ids = Array.isArray(ids) ? ids.slice() : [];
    var changed = !mine || mine.slice().sort().join("|") !== ids.slice().sort().join("|");
    mine = ids; cm = mob();
    try { localStorage.setItem(KEY, JSON.stringify({ m: cm, ids: ids })); } catch (e) {}
    if (changed) {
      try { W.dispatchEvent(new CustomEvent("snap-batches-changed")); } catch (e) {}
      try { if (typeof renderStudentTestCards === "function" && document.getElementById("test-cards-list")) renderStudentTestCards(); } catch (e) {}
    }
  }
  function refresh(force) {
    var m = mob(), d = DB(); if (!m || !d) return;
    var n = Date.now(); if (!force && n - lastRef < 300000) return; lastRef = n;
    Promise.resolve(W.vishnuFirebase.authReady).catch(function () {})
      .then(function () { return d.collection("students").doc(m).get(); })
      .then(function (s) { setMine((s.exists && s.data().batchIds) || []); })
      .catch(function () { lastRef = 0; });
  }
  API.setMine = setMine;
  API.mineList = function () { ensure(); return mine ? mine.slice() : []; };
  API.mineHas = function (b) { ensure(); return !!(mine && mine.indexOf(b) > -1); };
  API.refresh = refresh;

  /* ================= STUDENT: Start Test list ================= */
  function linkKeys(t) { var b = t && t.batchLinks; return b && typeof b === "object" ? Object.keys(b) : []; }
  API.visible = function (t) {
    ensure(); var k = linkKeys(t); if (!k.length) return true;          // batch se na juda test = general (sabko)
    if (!mine) return false;                                             // batch list abhi load ho rahi hai
    for (var i = 0; i < k.length; i++) if (mine.indexOf(k[i]) > -1) return true;
    return false;
  };
  function myLink(t) { var k = linkKeys(t); for (var i = 0; i < k.length; i++) if (mine && mine.indexOf(k[i]) > -1) return t.batchLinks[k[i]] || {}; return null; }
  API.group = function (t) {
    var L = myLink(t); if (L) { var g = String(L.c || L.s || "").trim(); if (g) return g; }
    return String(t.category || "").trim() || "General";
  };
  API.extra = function (t) {
    var h = "", L = myLink(t);
    var up = t.startTime && new Date(t.startTime) > new Date();
    if (L && L.s) h += '<div style="margin-top:5px;font-size:.74rem;font-weight:700;color:#4338ca">📘 ' + esc(L.s) + (L.c ? " › " + esc(L.c) : "") + "</div>";
    if (up) h += '<div style="margin-top:6px;font-size:.74rem;font-weight:800;color:#b45309;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:4px 8px;display:inline-block">🔜 Upcoming • ' + esc(fmtDT(t.startTime)) + " se</div>";
    var sy = String(t.syllabus || "").trim();
    if (sy) h += '<div style="margin-top:6px;font-size:.78rem;color:#475569;white-space:pre-wrap;line-height:1.45"><b>📚 Syllabus:</b> ' + esc(sy.length > 400 ? sy.slice(0, 400) + "…" : sy) + "</div>";
    return h;
  };

  /* ================= ADMIN: batch notification ================= */
  function notifyBatch(batchId, type, title, body) {
    try {
      var d = DB(), i = inst(); if (!d || !i || !batchId) return Promise.resolve(false);
      return d.collection("institutes").doc(i).collection("notifications").add({
        type: String(type || "batch"), batchId: String(batchId), title: String(title).slice(0, 100), body: String(body || "").slice(0, 300),
        createdAt: FV().serverTimestamp(), createdBy: adminEmail()
      }).then(function (ref) { try { W.SnapPush && W.SnapPush.send(ref.id, { type: String(type || "batch"), title: title, body: body, batchId: batchId }); } catch (e) {} return true; })
        .catch(function (e) { console.warn("[v169 notify]", e); return false; });
    } catch (e) { return Promise.resolve(false); }
  }
  API.notifyBatch = notifyBatch;
  function where(it) { return [it.subject, it.chapter].filter(Boolean).join(" › "); }
  API.itemEvent = function (ev, it) {
    try {
      if (!it || !it.batchId) return;
      var t = it.title || "", w = where(it), k = it.kind;
      if (ev === "class_new") notifyBatch(it.batchId, "class", "📅 Naya Live Class Schedule Hua", t + (it.scheduledAt ? " — " + fmtDT(it.scheduledAt) : "") + (w ? " (" + w + ")" : ""));
      else if (ev === "live_start") notifyBatch(it.batchId, "live", "🔴 Live Class Shuru Ho Gayi", t + " — abhi join karein");
      else if (ev === "announce") notifyBatch(it.batchId, "announcement", "📢 " + t, it.desc || "Batch me nayi announcement aayi hai");
      else if (ev === "pub") {
        var ti = k === "recording" ? "🎬 Nayi Recorded Lecture Aayi" : k === "ppt" ? "📊 Naya PPT Aaya" : k === "material" ? "📚 Naya Study Material Aaya" : "📄 Naye Notes Aaye";
        notifyBatch(it.batchId, k || "item", ti, t + (w ? " (" + w + ")" : ""));
      }
    } catch (e) { console.warn(e); }
  };
  API.assignmentPublished = function (a) {
    try { notifyBatch(a.batchId, "assignment", "📝 Naya Assignment", (a.title || "") + (a.due ? " — Due " + new Date(a.due).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "")); } catch (e) {}
  };

  /* ================= ADMIN: test <-> batch tag (student list filter ke liye test doc par) ================= */
  API.tagTest = function (testId, bid, subject, chapter, notify, title) {
    var d = DB(); if (!d || !testId || !bid) return Promise.resolve();
    try { var lt = W.tests && W.tests[testId]; if (lt) { lt.batchLinks = lt.batchLinks || {}; lt.batchLinks[bid] = { s: subject || "", c: chapter || "" }; } } catch (e) {}
    var u = {}; u["batchLinks." + bid] = { s: subject || "", c: chapter || "" };
    return d.collection("tests").doc(testId).update(u).then(function () {
      if (notify) notifyBatch(bid, "test", "📝 Naya Test Juda", (title || "Naya test") + (chapter ? " — " + chapter : ""));
    }).catch(function (e) { console.warn("[v169 tag]", e); });
  };
  API.untagTest = function (testId, bid) {
    var d = DB(); if (!d || !testId || !bid) return Promise.resolve();
    try { var lt = W.tests && W.tests[testId]; if (lt && lt.batchLinks) delete lt.batchLinks[bid]; } catch (e) {}
    var u = {}; u["batchLinks." + bid] = FV().delete();
    return d.collection("tests").doc(testId).update(u).catch(function (e) { console.warn("[v169 untag]", e); });
  };

  /* v169 se pehle jude tests (sirf testLinks me the) ko test doc par tag karna — taaki student list me batch filter lage. Silent, notification nahi. */
  API.backfill = function (links, bid) {
    try {
      (links || []).slice(0, 60).forEach(function (l) {
        var t = W.tests && W.tests[l.testId];
        if (t && (!t.batchLinks || !t.batchLinks[bid])) API.tagTest(l.testId, bid, l.subject, l.chapter, false);
      });
    } catch (e) {}
  };

  /* test edit/save par batchLinks / syllabus gum na ho (saveTestOnline poora doc overwrite karta hai) */
  function hookSave() {
    if (typeof W.saveTestOnline !== "function" || W.saveTestOnline.__v169) return;
    var orig = W.saveTestOnline;
    var w = function (id, t) {
      try {
        var prev = W.tests ? W.tests[id] : null;
        if (t && prev && prev.batchLinks && !t.batchLinks && Object.keys(prev.batchLinks).length) t.batchLinks = JSON.parse(JSON.stringify(prev.batchLinks));
      } catch (e) {}
      return orig.apply(this, arguments);
    };
    w.__v169 = 1; W.saveTestOnline = w;
  }

  /* ================= ADMIN: Chapter-wise test (batch > subject > chapter ke andar) ================= */
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), x = a[i]; a[i] = a[j]; a[j] = x; } return a; }
  function poolFor(subj, ch) {
    var bank = [];
    try { bank = (typeof getClassScopedQuestionBank === "function" ? getClassScopedQuestionBank() : (typeof questionBank !== "undefined" ? questionBank : [])).filter(function (q) { return typeof isValidQ === "function" ? isValidQ(q) : true; }); } catch (e) {}
    var nc = norm(ch.name), ns = norm(subj.name);
    var exact = bank.filter(function (q) { return norm(q.chapter) === nc; });
    if (!exact.length) exact = bank.filter(function (q) { var c = norm(q.chapter); return c && (c.indexOf(nc) > -1 || nc.indexOf(c) > -1); });
    var both = exact.filter(function (q) { try { return norm(typeof getQuestionSubject === "function" ? getQuestionSubject(q) : q.subject) === ns; } catch (e) { return true; } });
    return both.length ? both : exact;
  }
  API.chapterTest = function (c, bf, subj, ch, done) {
    var pool = poolFor(subj, ch);
    if (!pool.length) return c.toast("Question Bank me '" + ch.name + "' chapter ke questions nahi mile. Tests me test banayein, phir 'Link Test' se jodein.");
    var n0 = Math.min(10, pool.length);
    c.form("Chapter Test — " + ch.name + " (" + pool.length + " questions available)", [
      { k: "title", l: "Test ka naam", r: 1 },
      { k: "count", l: "Kitne questions (max " + pool.length + ")", t: "number", r: 1 },
      { k: "minutes", l: "Time (minutes)", t: "number" },
      { k: "marks", l: "Marks per question", t: "number" },
      { k: "startTxt", l: "Start time (optional — future = Upcoming test)", t: "datetime-local" },
      { k: "syllabus", l: "Syllabus (students ko dikhega)", t: "textarea" },
      { k: "status", l: "Status", t: "select", o: [["live", "Abhi publish karein (students ko notification jaayega)"], ["draft", "Draft me rakhein"]] }
    ], { title: ch.name + " — Chapter Test", count: n0, minutes: Math.max(5, Math.round(n0 * 1.2)), marks: 2, syllabus: subj.name + " › " + ch.name, status: "live" }, function (o) {
      var n = Math.floor(+o.count);
      if (!o.title || !String(o.title).trim()) { c.toast("Test ka naam likhein"); return false; }
      if (!(n >= 1) || n > pool.length) { c.toast("Questions 1 se " + pool.length + " ke beech rakhein"); return false; }
      if (typeof saveTestOnline !== "function" || typeof cloneQ !== "function") { c.toast("Test engine load nahi hua — page refresh karein"); return false; }
      var id = "test-" + Date.now();
      var picked = shuffle(pool).slice(0, n).map(function (q) { var x = cloneQ(q); x.section = "Section A"; return x; });
      var t = {
        title: String(o.title).trim(), category: null, minutes: +o.minutes || Math.max(5, Math.round(n * 1.2)), marksPerQuestion: +o.marks || 2,
        negativeEnabled: false, negativeMarks: 0, attemptLimit: null, subjectiveMarks: null, startTime: o.startTxt || null, endTime: null,
        syllabus: String(o.syllabus || "").trim() || null, sections: [{ id: "sec-1", title: "Section A", marksPerQuestion: null }],
        questions: picked, instituteId: c.A.inst, isDraft: o.status === "draft", batchLinks: {}
      };
      t.batchLinks[bf] = { s: subj.name, c: ch.name };
      try { if (typeof remoteTests !== "undefined") remoteTests[id] = t; if (typeof deletedTestIds !== "undefined") deletedTestIds.delete(id); } catch (e) {}
      c.toast("⏳ Test ban raha hai…");
      return saveTestOnline(id, t).then(function () {
        return c.bref(c.A.inst, bf).collection("testLinks").add({
          instituteId: c.A.inst, batchId: bf, testId: id, title: t.title, subject: subj.name, chapter: ch.name,
          subjectId: subj.id || "", chapterId: ch.id || "", createdAt: c.FV().serverTimestamp(), createdBy: c.adminEmail()
        });
      }).then(function () {
        c.audit("chaptertest.create", id); c.toast("✅ Chapter test ban gaya (" + n + " questions)" + (t.isDraft ? " — Draft hai, Tests me Publish karein" : ""));
        try { if (typeof renderTests === "function") renderTests(id); } catch (e) {}
        done && done();
      }).catch(function (e) { console.warn(e); c.toast("❌ Test nahi bana: " + ((e && e.message) || e)); return false; });
    });
  };

  /* ================= boot ================= */
  function boot() {
    hookSave(); ensure();
    setTimeout(function () { if (mob()) refresh(true); }, 1200);
    document.addEventListener("visibilitychange", function () { if (document.visibilityState === "visible") { ensure(); refresh(false); } });
  }
  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", boot) : boot();
  setTimeout(hookSave, 1500);
})();
