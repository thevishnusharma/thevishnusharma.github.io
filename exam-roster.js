/* v230 — Exam Roster + Admit Card + Scan Verification (SnapRoster)
   Flow:  Exam banao -> "🎫 Admit Card & Roster" me students chuno (roll no + set AUTO) -> Admit Card Publish
          -> student apne app me card dekhta/download karta hai -> sheet scan karte waqt roll no roster se match hota hai.
   Scan par: ✅ verified (naam dikhta hai + student auto-link) | ⚠️ set/naam mismatch | ❌ roll registered nahi (anomaly).
   Data:  examManagerExams/{exam}/roster/main  = { list:[{roll,name,mobile,set,classId}], nextRoll }
          studentAdmitCards/{exam}_{mobile}    = student ko dikhne wala card (publish par bantा hai)
   exam-manager.js sirf chhote hooks se is module ko bulata hai (preload/onScan/guardSave/autoWhy/fieldsFor/linkTarget/tag/open).
   v231: Exam banane se PEHLE "Registration" (exam-registration.js) me students register + roll shuffle + admit card publish ho sakta hai.
         Exam ko Registration se jodne par (linkRegistration) wahi roll/students exam roster me copy ho jaate hain; scan verification waisa hi chalta hai.
   Kill-switch: SNAP_CONFIG.roster=false -> koi hook kuch nahi karta. */
(function (root) {
  "use strict";
  var SETS = ["A", "B", "C", "D", "E"], MAX_ROSTER = 3000, CARDS = "studentAdmitCards", EXAMS = "examManagerExams", REGS = "examRegistrations";

  /* ======================= PURE LOGIC (tests me bhi chalta hai) ======================= */
  function pad(n, d) { return String(n).padStart(d, "0"); }
  function setForRoll(roll, sets) {
    var n = parseInt(roll, 10), s = Math.min(Number(sets) || 1, SETS.length);
    return s > 1 && isFinite(n) && n >= 1 ? SETS[(n - 1) % s] : null;
  }
  function norm(s) { return String(s || "").toLowerCase().replace(/[^a-z\s]/g, " ").replace(/\s+/g, " ").trim(); }
  function lev(a, b) {
    var m = a.length, n = b.length, p = [], i, j; if (!m) return n; if (!n) return m;
    for (j = 0; j <= n; j++) p[j] = j;
    for (i = 1; i <= m; i++) { var q = [i]; for (j = 1; j <= n; j++) q[j] = Math.min(p[j] + 1, q[j - 1] + 1, p[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); p = q; }
    return p[n];
  }
  function sim(a, b) { var x = norm(a), y = norm(b); return !x || !y ? 0 : 1 - lev(x, y) / Math.max(x.length, y.length); }
  /* OCR sirf English padhta hai: Devanagari naam par kabhi galat alarm nahi; token-match se "Rahul K" jaise partial naam bhi pass */
  function nameLooksSame(ocr, reg) {
    var o = norm(ocr), r = norm(reg);
    if (o.length < 4 || r.length < 3) return true;
    if (sim(o, r) >= 0.3) return true;
    var ot = o.split(" ").filter(function (t) { return t.length >= 3; }), rt = r.split(" ").filter(function (t) { return t.length >= 3; });
    for (var i = 0; i < ot.length; i++) for (var j = 0; j < rt.length; j++) if (sim(ot[i], rt[j]) >= 0.6) return true;
    return false;
  }
  function indexList(list) { var by = {}; (list || []).forEach(function (e) { by[e.roll] = e; }); return by; }
  function cmpRoll(a, b) { return (parseInt(a.roll, 10) || 0) - (parseInt(b.roll, 10) || 0); }

  /* naye students ko roll no + set do. Purane entries kabhi renumber nahi hote (card chhap chuke hote hain).
     opts: {rollDigits, sets, ignoreSet, useProfile, nextRoll}   returns {list,nextRoll,added,skipped,error} */
  function mergeRoster(existing, students, opts) {
    opts = opts || {}; existing = (existing || []).slice();
    var digits = Math.max(1, Math.min(5, Number(opts.rollDigits) || 2)), cap = Math.pow(10, digits) - 1;
    var have = {}, used = {}, maxN = 0, skipped = 0;
    existing.forEach(function (e) { have[e.mobile] = 1; used[e.roll] = 1; maxN = Math.max(maxN, parseInt(e.roll, 10) || 0); });
    var next = Math.max(Number(opts.nextRoll) || 1, maxN + 1);
    var fresh = [], seen = {};
    (students || []).forEach(function (s) {
      var m = String(s.mobile || "").replace(/\D/g, "").slice(-10);
      if (m.length !== 10 || have[m] || seen[m]) { skipped++; return; }
      seen[m] = 1; fresh.push({ name: String(s.name || "").trim() || "Student", mobile: m, classId: s.classId || null, rollNumber: s.rollNumber });
    });
    if (existing.length + fresh.length > MAX_ROSTER) return { list: existing, nextRoll: next, added: 0, skipped: skipped, error: { code: "TOO_MANY", max: MAX_ROSTER } };
    fresh.sort(function (a, b) { return a.name.localeCompare(b.name, "en", { sensitivity: "base" }); });
    var out = [];
    if (opts.useProfile) fresh.forEach(function (s) {
      var rn = String(s.rollNumber == null ? "" : s.rollNumber).trim();
      if (/^\d{1,5}$/.test(rn)) { var v = parseInt(rn, 10), key = pad(v, digits); if (v >= 1 && v <= cap && key.length === digits && !used[key]) { used[key] = 1; s._roll = key; } }
    });
    for (var i = 0; i < fresh.length; i++) {
      var s = fresh[i], roll = s._roll;
      if (!roll) { while (used[pad(next, digits)] && next <= cap) next++; if (next > cap) return { list: existing, nextRoll: next, added: 0, skipped: skipped, error: { code: "DIGITS_FULL", need: String(next).length } }; roll = pad(next, digits); used[roll] = 1; next++; }
      out.push({ roll: roll, name: s.name, mobile: s.mobile, classId: s.classId, set: opts.ignoreSet ? null : setForRoll(roll, opts.sets) });
    }
    var list = existing.concat(out).sort(cmpRoll);
    return { list: list, nextRoll: next, added: out.length, skipped: skipped, error: null };
  }
  /* roll digits badle to purane numbers ko naye width par pad karo */
  function repad(list, digits, sets, ignoreSet) {
    var cap = Math.pow(10, digits) - 1, out = [];
    for (var i = 0; i < list.length; i++) {
      var n = parseInt(list[i].roll, 10); if (!(n >= 1) || n > cap) return { error: { code: "DIGITS_FULL", need: String(n).length } };
      var r = pad(n, digits); out.push({ roll: r, name: list[i].name, mobile: list[i].mobile, classId: list[i].classId, set: ignoreSet ? null : setForRoll(r, sets) });
    }
    return { list: out, error: null };
  }

  /* v231: Registration ka roster -> exam roster. Roll registration me fix hote hain (shuffled);
     Set exam ke sets ke hisaab se roll se nikalta hai (admit card par set nahi chhapta). */
  function fromRegistration(list, exam) {
    exam = exam || {}; var out = [], max = 0;
    (list || []).forEach(function (e) {
      if (!e || !e.roll || !e.mobile) return;
      var n = parseInt(e.roll, 10) || 0; if (n > max) max = n;
      out.push({ roll: String(e.roll), name: e.name || "Student", mobile: e.mobile, classId: e.classId || null, set: exam.scanIgnoreSet ? null : setForRoll(e.roll, exam.sets) });
    });
    out.sort(cmpRoll); return { list: out, nextRoll: max + 1 };
  }

  /* scan verification. R={list,by}, exam, scan={roll,setLetter,id}, results=[...], ocr=string
     -> {level:'none'|'ok'|'warn'|'error', issues:[{level,code,msg}], entry} */
  function verify(R, exam, scan, results, ocr) {
    var none = { level: "none", issues: [], entry: null };
    if (!R || !R.list || !R.list.length || !exam) return none;
    if (exam.scanIgnoreRollNumber || exam.includeRollNumber === false) return none;
    var roll = String(scan.roll || "").trim(), issues = [], by = R.by || indexList(R.list);
    function done(en) { var lv = issues.some(function (x) { return x.level === "error"; }) ? "error" : issues.length ? "warn" : "ok"; return { level: lv, issues: issues, entry: en || null }; }
    if (!roll || roll.indexOf("?") !== -1) { issues.push({ level: "error", code: "ROLL_UNREADABLE", msg: "Roll No poora nahi padha gaya — Edit se sahi digits chunein ya dobara scan karein." }); return done(); }
    var en = by[roll];
    if (!en) { issues.push({ level: "error", code: "NOT_REGISTERED", msg: "Roll " + roll + " is exam ke liye registered nahi hai — anomalous sheet." }); return done(); }
    var multi = !exam.scanIgnoreSet && (Number(exam.sets) || 1) > 1;
    if (multi && en.set) {
      if (!scan.setLetter) issues.push({ level: "warn", code: "SET_MISSING", msg: "Exam Set bubble nahi padha gaya — admit card me Set " + en.set + " tha." });
      else if (scan.setLetter !== en.set) issues.push({ level: "warn", code: "SET_MISMATCH", msg: "Admit card me Set " + en.set + " tha par sheet par Set " + scan.setLetter + " bhara hai." });
    }
    if ((results || []).some(function (r) { return r && r.id !== scan.id && String(r.roll || "").trim() === roll; }))
      issues.push({ level: "warn", code: "DUPLICATE", msg: "Roll " + roll + " pehle se scan ho chuka hai (ek hi sheet valid rahegi)." });
    if (ocr && !nameLooksSame(ocr, en.name)) issues.push({ level: "warn", code: "NAME_MISMATCH", msg: "Sheet par naam \"" + String(ocr).slice(0, 30) + "\" padha gaya, registered naam \"" + en.name + "\" se mel nahi khata — roll bubble check karein." });
    return done(en);
  }
  function summary(R, results) {
    var by = (R && R.by) || {}, best = {}, anomalies = [];
    (results || []).forEach(function (r) {
      var roll = String(r.roll || "").trim();
      if (!by[roll]) { anomalies.push({ roll: roll || "?", marks: r.marks, code: "NOT_REGISTERED", id: r.id }); return; }
      if (!best[roll] || (Number(r.marks) || 0) > (Number(best[roll].marks) || 0)) best[roll] = r;
      if (r.anomaly && r.anomaly !== "NOT_REGISTERED") anomalies.push({ roll: roll, marks: r.marks, code: r.anomaly, id: r.id });
    });
    var list = (R && R.list) || [];
    return { registered: list.length, scanned: list.filter(function (e) { return best[e.roll]; }).length, absent: list.filter(function (e) { return !best[e.roll]; }), best: best, anomalies: anomalies };
  }
  function csvCell(v) { return '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"'; }

  var pure = { pad: pad, setForRoll: setForRoll, nameLooksSame: nameLooksSame, sim: sim, mergeRoster: mergeRoster, repad: repad, fromRegistration: fromRegistration, verify: verify, summary: summary, indexList: indexList, csvCell: csvCell, MAX_ROSTER: MAX_ROSTER };
  if (typeof module !== "undefined" && module.exports) module.exports = { pure: pure };
  if (typeof document === "undefined") return;

  /* ======================= BROWSER PART ======================= */
  var C = {}, last = null, P = { id: null, sel: {}, q: "", tq: "", scope: "class", profile: true, regs: [] }, OV = null;
  function on() { return !(root.SNAP_CONFIG && root.SNAP_CONFIG.roster === false); }
  function X() { return root.__examgrCtx || null; }
  function DB() { return typeof root.getDB === "function" ? root.getDB() : null; }
  function students() { try { return typeof allStudentsCache !== "undefined" && Array.isArray(allStudentsCache) ? allStudentsCache : []; } catch (e) { return []; } }
  function h(t, a, c) {
    var e = document.createElement(t);
    if (a) for (var k in a) { if (k === "class") e.className = a[k]; else if (k === "text") e.textContent = a[k]; else if (k.slice(0, 2) === "on") e[k] = a[k]; else e.setAttribute(k, a[k]); }
    (c || []).forEach(function (x) { if (x != null) e.appendChild(typeof x === "string" ? document.createTextNode(x) : x); });
    return e;
  }
  function lsKey(id) { return "snap_roster_" + id; }
  function setData(id, d) { var e = C[id] = C[id] || {}; e.list = (d && d.list) || []; e.nextRoll = (d && d.nextRoll) || 1; e.by = indexList(e.list); return e; }
  function saveLocal(id) { try { var e = C[id]; localStorage.setItem(lsKey(id), JSON.stringify({ list: e.list, nextRoll: e.nextRoll })); } catch (x) {} }
  function load(id, force) {
    var e = C[id];
    if (e && e.p && !force) return e.p;
    e = C[id] = e || setData(id, null); e.loaded = false;
    e.p = Promise.resolve().then(function () {
      var d = DB(); if (!d) throw new Error("offline");
      return d.collection(EXAMS).doc(id).collection("roster").doc("main").get();
    }).then(function (s) { setData(id, s.exists ? s.data() : null); saveLocal(id); }).catch(function () {
      try { var l = JSON.parse(localStorage.getItem(lsKey(id)) || "null"); if (l) setData(id, l); } catch (x) {}
    }).then(function () { C[id].loaded = true; C[id].p = e.p; return C[id]; });
    return e.p;
  }
  function saveRoster(id) {
    var e = C[id], d = DB(); if (!d) { alert("Server se connect nahi ho paya — internet check karein."); return Promise.resolve(false); }
    e.by = indexList(e.list); saveLocal(id);
    return d.collection(EXAMS).doc(id).collection("roster").doc("main").set({ list: e.list, nextRoll: e.nextRoll, updatedAt: root.firebase.firestore.FieldValue.serverTimestamp() })
      .then(function () { return X().patch(id, { students: e.list.length, rosterCount: e.list.length }); })
      .then(function () { X().refresh(); return true; })
      .catch(function (err) { alert("Roster save nahi ho paya: " + (err.message || err)); return false; });
  }
  function results(ex) { return ex && Array.isArray(ex.results) ? ex.results : []; }

  /* ---------- hooks (exam-manager.js se) ---------- */
  function ensureBanner() {
    var b = document.getElementById("examgr-roster-banner"); if (b) return b;
    var anchor = document.getElementById("examgr-scan-name-guess") || document.getElementById("examgr-scan-graded-head"); if (!anchor || !anchor.parentNode) return null;
    b = h("div", { id: "examgr-roster-banner", class: "ros-banner", hidden: "" }); anchor.parentNode.insertBefore(b, anchor.nextSibling); return b;
  }
  function photoOf(m) { var s = students().filter(function (x) { return x.mobile === m; })[0]; return s && s.photoDataUrl ? s.photoDataUrl : null; }
  function renderBanner() {
    var b = ensureBanner(); if (!b || !last) return;
    var id = X() && X().id(), ex = last.exam, R = C[id];
    if (!ex || !(Number(ex.rosterCount) > 0 || (R && R.list && R.list.length))) { b.hidden = true; return; }
    b.textContent = ""; b.hidden = false;
    if (!R || !R.loaded) { b.className = "ros-banner ros-wait"; b.textContent = "⏳ Roster se match ho raha hai..."; return; }
    var v = verify(R, ex, { roll: last.det.roll, setLetter: last.det.setLetter, id: null }, results(ex), last.ocr);
    if (v.level === "none") { b.hidden = true; return; }
    b.className = "ros-banner ros-" + (v.level === "ok" ? "ok" : v.level === "warn" ? "warn" : "err");
    var ph = v.entry ? photoOf(v.entry.mobile) : null;
    if (ph) b.appendChild(h("img", { class: "ros-ava", src: ph, alt: "" }));
    var tx = h("div", { class: "ros-banner-tx" });
    if (v.level === "ok") {
      tx.appendChild(h("strong", { text: "✅ Verified: " + v.entry.name }));
      tx.appendChild(h("span", { text: "Roll " + v.entry.roll + (v.entry.set ? " • Set " + v.entry.set : "") + " • " + root.SnapAdmit.maskMobile(v.entry.mobile) + (ex.rosterAutoLink === false ? "" : " • Save par student se auto-link hoga") }));
    } else {
      tx.appendChild(h("strong", { text: (v.level === "error" ? "❌ ANOMALY" : "⚠️ Check karein") + (v.entry ? " — " + v.entry.name : "") }));
      v.issues.forEach(function (i) { tx.appendChild(h("span", { text: i.msg })); });
    }
    b.appendChild(tx);
  }
  function mismatchText(v) { return v.issues.map(function (i) { return i.msg; }).join(" "); }

  var api = {
    pure: pure, load: load,
    preload: function (id) { if (on() && id) load(id); },
    clear: function () { last = null; var b = document.getElementById("examgr-roster-banner"); if (b) { b.hidden = true; b.textContent = ""; } },
    onScan: function (ex, det, graded, ocr) {
      if (!on()) return; try {
        last = { exam: ex, det: det, graded: graded, ocr: ocr || "" }; renderBanner();
        var id = X() && X().id(); if (id && Number(ex.rosterCount) > 0 && !(C[id] && C[id].loaded)) load(id).then(renderBanner);
      } catch (e) { console.warn("[roster] onScan", e); }
    },
    onOcr: function (txt) { if (!on() || !last) return; last.ocr = txt || ""; try { renderBanner(); } catch (e) {} },
    /* Save dabane par: error ho to confirm; roll unreadable ho to rok do. {block:true} = save mat karo */
    guardSave: function (id, ex, det, graded, ocr) {
      if (!on()) return { block: false };
      try {
        var R = C[id];
        if (Number(ex.rosterCount) > 0 && !(R && R.loaded)) { alert("Roster abhi load ho raha hai — 2 second baad dobara Save dabayein."); load(id); return { block: true }; }
        var v = verify(R, ex, { roll: det.roll, setLetter: det.setLetter, id: null }, results(ex), ocr);
        if (v.level !== "error") return { block: false };
        if (v.issues[0].code === "ROLL_UNREADABLE") { alert("⚠️ " + mismatchText(v)); return { block: true }; }
        return { block: !confirm("❌ ANOMALY: " + mismatchText(v) + "\n\nPhir bhi is sheet ko save karein? (Result par ⚠️ flag lagega)") };
      } catch (e) { return { block: false }; }
    },
    /* auto-save ko tab rokna jab roster verification saaf na ho */
    autoWhy: function (ex, det, ocr) {
      if (!on()) return "";
      try {
        var id = X() && X().id(), R = C[id];
        if (Number(ex.rosterCount) > 0 && !(R && R.loaded)) return "roster load ho raha hai";
        var v = verify(R, ex, { roll: det.roll, setLetter: det.setLetter, id: null }, results(ex).filter(function () { return false; }), ocr);
        return v.level === "error" || v.level === "warn" ? "roster check: " + mismatchText(v) : "";
      } catch (e) { return ""; }
    },
    fieldsFor: function (id, roll, setLetter, ocr) {
      if (!on()) return {};
      try {
        var ex = X().exam(), v = verify(C[id], ex, { roll: roll, setLetter: setLetter, id: null }, [], ocr);
        if (v.level === "none") return {};
        return { verifiedMobile: v.entry ? v.entry.mobile : null, verifiedName: v.entry ? v.entry.name : null, anomaly: v.level === "ok" ? null : v.issues[0].code };
      } catch (e) { return {}; }
    },
    /* save ke baad: agar sab saaf hai to student ka mobile do (auto-link), warna null */
    linkTarget: function (id, rec) {
      if (!on()) return null;
      try {
        var ex = X().exam(); if (!ex || ex.rosterAutoLink === false) return null;
        var v = verify(C[id], ex, { roll: rec.roll, setLetter: rec.setLetter, id: rec.id }, results(ex), rec.ocrNameGuess);
        return v.level === "ok" && v.entry ? v.entry.mobile : null;
      } catch (e) { return null; }
    },
    nameOf: function (id, roll) { var R = C[id]; if (!on() || !R || !R.by) return ""; var en = R.by[String(roll || "").trim()]; return en && en.name ? String(en.name) : ""; },
    absentees: function (id, rows) { var R = C[id]; if (!on() || !R || !R.list || !R.list.length) return null; return summary(R, rows || []).absent.map(function (e) { return { roll: e.roll, name: e.name || "" }; }); },
    tag: function (id, roll) {
      var R = C[id]; if (!on() || !R || !R.by || !R.by[String(roll || "").trim()]) return "";
      return " · " + String(R.by[String(roll).trim()].name).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; });
    },
    open: function () { if (!on()) { alert("Roster feature band hai."); return; } openPanel(); },

    /* ---- v231: Registration se jodna ---- */
    regOptions: function () {
      var d = DB(); if (!d) return Promise.resolve([]);
      var iid = typeof getCurrentAdminInstituteId === "function" ? getCurrentAdminInstituteId() : null;
      var q = iid ? d.collection(REGS).where("instituteId", "==", iid) : d.collection(REGS);
      return q.get().then(function (snap) {
        return snap.docs.map(function (x) { var v = x.data(); return { id: x.id, name: v.name || "Registration", date: v.date || "", published: !!v.published, count: Number(v.count) || 0, rollDigits: Number(v.rollDigits) || 3 }; })
          .sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });
      }).catch(function () { return []; });
    },
    /* Exam banane wale form ka "Registration se jodein" dropdown bharta hai */
    fillRegSelect: function () {
      var sel = document.getElementById("examgr-add-reg"), row = document.getElementById("examgr-add-reg-row"); if (!sel) return;
      sel.textContent = ""; sel.appendChild(h("option", { value: "", text: "— Koi nahi (baad me bhi jod sakte hain) —" }));
      if (row) row.style.display = "none"; if (!on()) return;
      api.regOptions().then(function (arr) {
        if (!arr.length) return; if (row) row.style.display = "";
        arr.forEach(function (r) { var o = h("option", { value: r.id, text: r.name + " • " + r.count + " students" + (r.published ? "" : " (publish baaki)") }); if (!r.published) o.disabled = true; sel.appendChild(o); });
      });
    },
    /* Registration ke published students + rolls ko exam ke roster me copy karo. Promise<bool> */
    linkRegistration: function (examId, regId) {
      var d = DB(), c = X(), ex = c && c.all()[examId];
      if (!on() || !d || !ex || !regId) return Promise.resolve(false);
      var ref = d.collection(REGS).doc(regId);
      return Promise.all([ref.get(), ref.collection("roster").doc("main").get()]).then(function (r) {
        if (!r[0].exists) throw new Error("Registration nahi mili.");
        var reg = r[0].data(), ros = r[1].exists ? r[1].data() : { list: [] };
        if (!reg.published) throw new Error("Pehle Registration publish karein — roll no publish par hi bante hain.");
        var digits = Math.max(1, Math.min(5, Number(reg.rollDigits) || 3)), conv = fromRegistration(ros.list, ex);
        if (!conv.list.length) throw new Error("Registration me koi student nahi hai.");
        return d.collection(EXAMS).doc(examId).collection("roster").doc("main").set({ list: conv.list, nextRoll: conv.nextRoll, registrationId: regId, updatedAt: root.firebase.firestore.FieldValue.serverTimestamp() }).then(function () {
          setData(examId, { list: conv.list, nextRoll: conv.nextRoll }); saveLocal(examId);
          return c.patch(examId, { registrationId: regId, registrationName: reg.name || "", rollDigits: digits, students: conv.list.length, rosterCount: conv.list.length, instituteName: reg.instituteName || ex.instituteName || "" });
        });
      }).then(function (ok) { if (ok) c.refresh(); return !!ok; }).catch(function (e) { alert("Registration se jodna nahi ho paya: " + (e.message || e)); return false; });
    }
  };

  /* ======================= ADMIN PANEL ======================= */
  function cardFor(ex, en) {
    var a = ex.admit || {};
    return { examId: P.id, instituteName: ex.instituteName || "", examName: ex.examName || "", className: ex.className || "", date: ex.date || "", time: a.time || "", reportTime: a.reportTime || "", venue: a.venue || "", notes: a.notes || "", name: en.name, roll: en.roll, mobile: en.mobile };
  }
  function instName(ex) {
    if (ex.instituteName) return Promise.resolve(ex.instituteName);
    var n = ""; try { n = typeof getCachedAdminInstituteName === "function" ? getCachedAdminInstituteName() : ""; } catch (e) {}
    if (n) { ex.instituteName = n; return Promise.resolve(n); }
    var d = DB(), iid = ex.instituteId || (typeof getCurrentAdminInstituteId === "function" ? getCurrentAdminInstituteId() : null);
    if (!d || !iid) return Promise.resolve("");
    return d.collection("institutes").doc(iid).get().then(function (s) { n = s.exists && s.data().name || ""; ex.instituteName = n; return n; }).catch(function () { return ""; });
  }
  function note(msg) { var n = document.getElementById("ros-notice"); if (!n) return; n.textContent = msg || ""; n.hidden = !msg; }
  function ctxEx() { var c = X(); return c && c.all()[P.id]; }

  function addStudents(arr) {
    var ex = ctxEx(), R = C[P.id]; if (!ex || !R) return;
    if (ex.registrationId) { note("🔗 Ye exam Registration se juda hai — naye students Registration me jodein, phir yahan Sync dabayein."); return; }
    var res = mergeRoster(R.list, arr, { rollDigits: ex.rollDigits, sets: ex.sets, ignoreSet: ex.scanIgnoreSet, useProfile: P.profile, nextRoll: R.nextRoll });
    if (res.error) { note(res.error.code === "TOO_MANY" ? "⚠️ Ek exam me max " + res.error.max + " students." : "⚠️ Roll digits kam hain — Exam Settings me Roll No digits " + res.error.need + " ya zyada karein."); return; }
    R.list = res.list; R.nextRoll = res.nextRoll;
    saveRoster(P.id).then(function (ok) {
      if (!ok) return; P.sel = {}; renderAll();
      note("✅ " + res.added + " student jude" + (res.skipped ? " (" + res.skipped + " pehle se the / galat mobile)" : "") + "." + (ex.admitPublished && res.added ? " Naye students ke liye Admit Card dobara Publish karein." : ""));
    });
  }
  function removeEntry(en) {
    if (ctxEx().registrationId) { note("🔗 Registration se jude exam me student Registration se hatayein, phir Sync dabayein."); return; }
    if (!confirm("Roll " + en.roll + " — " + en.name + " ko roster se hata dein?" + (ctxEx().admitPublished ? "\nIska published Admit Card bhi delete ho jaayega." : ""))) return;
    var R = C[P.id]; R.list = R.list.filter(function (x) { return x.roll !== en.roll; });
    var d = DB(); if (d && ctxEx().admitPublished) d.collection(CARDS).doc(P.id + "_" + en.mobile).delete().catch(function () {});
    saveRoster(P.id).then(function (ok) { if (ok) { renderAll(); note("🗑️ Roll " + en.roll + " hata diya."); } });
  }
  function publish() {
    var ex = ctxEx(), R = C[P.id], d = DB();
    if (!R || !R.list.length) { note("⚠️ Pehle students jodein."); return; }
    if (!d) { alert("Server se connect nahi ho paya."); return; }
    var digits = Math.max(1, Math.min(5, Number(ex.rollDigits) || 2));
    if (R.list.some(function (e) { return e.roll.length !== digits; })) { note("⚠️ Roll digits exam settings se match nahi karte — neeche \"Roll dobara banayein\" dabayein."); return; }
    if (!confirm(R.list.length + " students ko Admit Card bhej dein? Student apne app me dekh/download kar paayenge.")) return;
    note("⏳ Admit cards ban rahe hain...");
    instName(ex).then(function (inst) {
      var FV = root.firebase.firestore.FieldValue, iid = ex.instituteId || (typeof getCurrentAdminInstituteId === "function" ? getCurrentAdminInstituteId() : null), chain = Promise.resolve();
      for (var i = 0; i < R.list.length; i += 400) (function (part) {
        chain = chain.then(function () {
          var b = d.batch();
          part.forEach(function (en) { var c = cardFor(ex, en); c.instituteName = inst; c.instituteId = iid || null; c.mobile = en.mobile; c.issuedAt = FV.serverTimestamp(); b.set(d.collection(CARDS).doc(P.id + "_" + en.mobile), c); });
          return b.commit();
        });
      })(R.list.slice(i, i + 400));
      return chain.then(function () { return X().patch(P.id, { admitPublished: true, admitPublishedAt: Date.now(), instituteName: inst || ex.instituteName || "" }); });
    }).then(function () { note("🚀 " + R.list.length + " students ka Admit Card publish ho gaya. Student app → Admit Card me dikhega."); renderAll(); })
      .catch(function (e) { note("❌ Publish nahi hua: " + (e.code || e.message || e)); });
  }
  function printAll() {
    var ex = ctxEx(), R = C[P.id]; if (!R || !R.list.length) { note("⚠️ Roster khaali hai."); return; }
    var PER = 60, total = R.list.length, parts = Math.ceil(total / PER);
    note("⏳ PDF ban rahi hai (jsPDF load ho raha hai)...");
    Promise.resolve(root.__ensureLib ? root.__ensureLib("jspdf") : null).catch(function () {}).then(function () { return instName(ex); }).then(function (inst) {
      if (!root.jspdf || !root.jspdf.jsPDF) throw new Error("PDF library load nahi hui — internet check karein.");
      var chain = Promise.resolve();
      for (var p = 0; p < parts; p++) (function (pi) {
        chain = chain.then(function () {
          var slice = R.list.slice(pi * PER, pi * PER + PER), pdf = new root.jspdf.jsPDF({ unit: "mm", format: "a4", orientation: "portrait" }), k = Promise.resolve();
          slice.forEach(function (en, i) {
            k = k.then(function () {
              var c = cardFor(ex, en); c.instituteName = inst;
              return root.SnapAdmit.render(c, photoOf(en.mobile), 0.8).then(function (cv) {
                if (i > 0 && i % 2 === 0) pdf.addPage();
                pdf.addImage(cv.toDataURL("image/jpeg", 0.8), "JPEG", 0, (i % 2) * 148.5, 210, 148.5);
                if (i % 10 === 0) note("⏳ PDF " + (pi + 1) + "/" + parts + " — " + (pi * PER + i + 1) + "/" + total + " cards...");
                return new Promise(function (r) { setTimeout(r, 0); });
              });
            });
          });
          return k.then(function () { pdf.save(String(ex.examName || "exam").replace(/[^\w-]+/g, "-").slice(0, 50) + "-admit-cards" + (parts > 1 ? "-part" + (pi + 1) : "") + ".pdf"); });
        });
      })(p);
      return chain;
    }).then(function () { note("✅ Admit cards PDF download ho gayi (A4 par 2 card)."); }).catch(function (e) { note("❌ PDF nahi bani: " + (e.message || e)); });
  }
  function csvDownload() {
    var ex = ctxEx(), R = C[P.id]; if (!R) return;
    X().ensureResults(P.id, ex).then(function () {
      var S = summary(R, results(ex)), rows = [["Roll No", "Name", "Mobile", "Class", "Set", "Status", "Marks", "Correct", "Wrong", "Blank"]];
      R.list.forEach(function (e) { var b = S.best[e.roll]; rows.push([e.roll, e.name, e.mobile, ex.className || e.classId || "", e.set || "", b ? "Present" : "Absent", b ? b.marks : "", b ? b.correct : "", b ? b.wrong : "", b ? b.blank : ""]); });
      S.anomalies.forEach(function (a) { rows.push([a.roll, "— ANOMALY (" + a.code + ")", "", "", "", "Unregistered", a.marks, "", "", ""]); });
      var blob = new Blob(["\ufeff" + rows.map(function (r) { return r.map(csvCell).join(","); }).join("\n")], { type: "text/csv;charset=utf-8" });
      var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = String(ex.examName || "exam").replace(/[^\w-]+/g, "-") + "-attendance.csv"; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    });
  }
  function fillAbsentees() {
    var ex = ctxEx(), R = C[P.id];
    X().ensureResults(P.id, ex).then(function () {
      var S = summary(R, results(ex)), txt = S.absent.map(function (e) { return e.name + " (" + e.roll + ")"; }).join(", ");
      return X().patch(P.id, { absentees: txt }).then(function (ok) { if (ok) note(S.absent.length ? "✅ " + S.absent.length + " absent students Absentees me save ho gaye." : "🎉 Sab registered students ki sheet scan ho chuki hai."); });
    });
  }
  function waLink(en, ex) {
    var t = "Namaste " + en.name + ", " + (ex.examName || "exam") + " (" + root.SnapAdmit.prettyDate(ex.date) + ") ka Admit Card ready hai. Roll No: " + en.roll + ". The Vishnu Sharma app me \"Admit Card\" se dekhein/download karein.";
    return "https://wa.me/91" + en.mobile + "?text=" + encodeURIComponent(t);
  }

  function stat(label, val, cls) { return h("div", { class: "ros-stat " + (cls || "") }, [h("strong", { text: String(val) }), h("span", { text: label })]); }
  function renderStats() {
    var box = document.getElementById("ros-stats"); if (!box) return; box.textContent = "";
    var ex = ctxEx(), R = C[P.id], S = summary(R, results(ex));
    box.appendChild(stat("Registered", S.registered)); box.appendChild(stat("Scanned", S.scanned, "ok")); box.appendChild(stat("Absent", S.absent.length)); box.appendChild(stat("Anomalies", S.anomalies.length, S.anomalies.length ? "err" : ""));
  }
  function renderPicker() {
    var box = document.getElementById("ros-picker"); if (!box) return; box.textContent = "";
    var ex = ctxEx(), R = C[P.id], all = students(), q = P.q.trim().toLowerCase(), cls = ex.classId;
    var list = all.filter(function (s) {
      if (P.scope === "class" && cls && s.classId !== cls) return false;
      if (!q) return true; return String(s.name || "").toLowerCase().indexOf(q) >= 0 || String(s.mobile || "").indexOf(q) >= 0;
    });
    box.appendChild(h("div", { class: "muted-text", text: list.length + " students" + (all.length ? "" : " — pehle Records → Directory se load karein") }));
    list.slice(0, 150).forEach(function (s) {
      var inR = (R.list || []).some(function (e) { return e.mobile === s.mobile; });
      var cb = h("input", { type: "checkbox" }); cb.checked = !!P.sel[s.mobile] || inR; cb.disabled = inR;
      cb.onchange = function () { if (cb.checked) P.sel[s.mobile] = s; else delete P.sel[s.mobile]; renderPickCount(); };
      box.appendChild(h("label", { class: "ros-pick" + (inR ? " in" : "") }, [cb, h("span", { text: (s.name || "Student") + " — " + s.mobile + (s.rollNumber ? " • Profile Roll " + s.rollNumber : "") + (inR ? " ✓" : "") })]));
    });
    if (list.length > 150) box.appendChild(h("div", { class: "muted-text", text: "Pehle 150 dikh rahe hain — search se narrow karein." }));
    renderPickCount();
  }
  function renderPickCount() { var b = document.getElementById("ros-add-btn"); if (b) b.textContent = "➕ " + Object.keys(P.sel).length + " chune hue add karein"; }
  function renderTable() {
    var box = document.getElementById("ros-table"); if (!box) return; box.textContent = "";
    var ex = ctxEx(), R = C[P.id], S = summary(R, results(ex)), q = P.tq.trim().toLowerCase();
    var rows = R.list.filter(function (e) { return !q || e.name.toLowerCase().indexOf(q) >= 0 || e.roll.indexOf(q) >= 0 || e.mobile.indexOf(q) >= 0; });
    if (!R.list.length) { box.appendChild(h("div", { class: "examgr-empty", text: "Abhi koi student roster me nahi hai. Upar se students chunkar add karein." })); return; }
    rows.slice(0, 300).forEach(function (e) {
      var b = S.best[e.roll];
      box.appendChild(h("div", { class: "examgr-report-row ros-row" }, [
        h("span", { class: "ros-roll", text: e.roll }),
        h("div", { class: "ros-rn" }, [h("strong", { text: e.name }), h("small", { text: e.mobile + (e.set ? " • Set " + e.set : "") })]),
        h("span", { class: "ros-pill " + (b ? "ok" : ""), text: b ? "✅ " + b.marks : "—" }),
        h("button", { type: "button", class: "ros-ic", title: "Admit card dekhein", onclick: function () { instName(ex).then(function (n) { var c = cardFor(ex, e); c.instituteName = n; root.SnapAdmit.preview(c, photoOf(e.mobile)); }); } }, ["🎫"]),
        h("a", { class: "ros-ic", title: "WhatsApp", href: waLink(e, ex), target: "_blank", rel: "noopener" }, ["💬"]),
        ex.registrationId ? null : h("button", { type: "button", class: "ros-ic", title: "Hatayein", onclick: function () { removeEntry(e); } }, ["🗑️"])
      ]));
    });
    if (rows.length > 300) box.appendChild(h("div", { class: "muted-text", text: "Pehle 300 dikh rahe hain — search use karein." }));
  }
  function renderStatus() {
    var box = document.getElementById("ros-status"); if (!box) return; box.textContent = "Load ho raha hai...";
    var ex = ctxEx(), R = C[P.id];
    X().ensureResults(P.id, ex).then(function () {
      var S = summary(R, results(ex)); box.textContent = ""; renderStats();
      box.appendChild(h("div", { class: "muted-text", text: "Scan hue: " + S.scanned + "/" + S.registered + "  •  Absent: " + S.absent.length }));
      if (S.absent.length) box.appendChild(h("div", { class: "ros-absent", text: "🙈 Absent: " + S.absent.slice(0, 40).map(function (e) { return e.name + " (" + e.roll + ")"; }).join(", ") + (S.absent.length > 40 ? " …+" + (S.absent.length - 40) : "") }));
      if (!S.anomalies.length) box.appendChild(h("div", { class: "ros-ok-line", text: "✅ Koi anomaly nahi mili." }));
      S.anomalies.forEach(function (a) {
        var t = { NOT_REGISTERED: "registered nahi hai", SET_MISMATCH: "set admit card se alag", SET_MISSING: "set bubble nahi bhara", NAME_MISMATCH: "naam mel nahi khata", ROLL_UNREADABLE: "roll nahi padha gaya", DUPLICATE: "duplicate" }[a.code] || a.code;
        box.appendChild(h("div", { class: "examgr-report-row ros-row ros-anom" }, [h("span", { class: "ros-roll", text: a.roll }), h("div", { class: "ros-rn" }, [h("strong", { text: "❌ " + t }), h("small", { text: "Marks: " + (a.marks == null ? "-" : a.marks) + " — Reports me jaakar Edit/Delete karein" })])]));
      });
    });
  }
  function renderAll() {
    var ex = ctxEx(), R = C[P.id]; if (!ex || !R) return;
    document.getElementById("ros-sub").textContent = (ex.examName || "Exam") + " • " + (ex.className || ex.date || "") + " • Roll digits: " + (Number(ex.rollDigits) || 2) + ((Number(ex.sets) || 1) > 1 && !ex.scanIgnoreSet ? " • " + ex.sets + " sets (auto-assign)" : "");
    var warn = document.getElementById("ros-warn"), digits = Math.max(1, Math.min(5, Number(ex.rollDigits) || 2)), msgs = [];
    if (ex.scanIgnoreRollNumber || ex.includeRollNumber === false) msgs.push("⚠️ Exam Settings me Roll No band/ignore hai — scan par roster verification nahi chalega.");
    if (R.list.some(function (e) { return e.roll.length !== digits; })) msgs.push("⚠️ Exam ke Roll digits (" + digits + ") roster ke rolls se alag hain.");
    warn.textContent = ""; warn.hidden = !msgs.length; msgs.forEach(function (m) { warn.appendChild(h("div", { text: m })); });
    if (msgs.length > (ex.scanIgnoreRollNumber || ex.includeRollNumber === false ? 1 : 0)) warn.appendChild(h("button", { type: "button", class: "btn-secondary", text: "🔁 Roll dobara banayein (digits ke hisaab se)", onclick: function () {
      var r = repad(R.list, digits, ex.sets, ex.scanIgnoreSet); if (r.error) { note("⚠️ Digits kam hain — Exam Settings me " + r.error.need + " ya zyada karein."); return; }
      R.list = r.list; saveRoster(P.id).then(function (ok) { if (ok) { renderAll(); note("✅ Roll numbers naye digits par set ho gaye. Admit card dobara Publish karein."); } });
    } }));
    var a = ex.admit || {}; ["time", "reportTime", "venue", "notes"].forEach(function (k) { var el = document.getElementById("ros-f-" + k); if (el && document.activeElement !== el) el.value = a[k] || ""; });
    var al = document.getElementById("ros-f-autolink"); if (al) al.checked = ex.rosterAutoLink !== false;
    var lk = !!ex.registrationId, shw = function (id, v) { var el = document.getElementById(id); if (el) el.style.display = v ? "" : "none"; };
    shw("ros-sec-add", !lk); shw("ros-sec-admit", !lk); shw("ros-link-sel", !lk); shw("ros-link-btn", !lk); shw("ros-sync-btn", lk);
    var li = document.getElementById("ros-link-info");
    if (li) li.textContent = lk ? "✅ Ye exam \"" + (ex.registrationName || "Registration") + "\" se juda hai. Roll No aur Admit Card wahin se bante/publish hote hain. Registration me badlav ke baad 'Sync' dabayein." : (P.regs && P.regs.length ? "Registration me pehle se students register hain? Chunkar jodein — roll no wahi rahenge jo admit card par hain." : "Koi publish ki hui Registration nahi mili. Exam Manager → 📝 Registration se banayein.");
    var pb = document.getElementById("ros-publish-btn"); if (pb) pb.textContent = ex.admitPublished ? "🔄 Admit Card dobara Publish (update)" : "🚀 Students ko Admit Card bhejein";
    renderStats(); renderPicker(); renderTable(); renderStatus();
  }
  function saveSettings() {
    var ex = ctxEx(), g = function (k) { return (document.getElementById("ros-f-" + k).value || "").trim(); };
    X().patch(P.id, { admit: { time: g("time"), reportTime: g("reportTime"), venue: g("venue"), notes: g("notes") }, rosterAutoLink: document.getElementById("ros-f-autolink").checked }).then(function (ok) { if (ok) note("✅ Admit card details save ho gaye." + (ex.admitPublished ? " Student ko naya card dikhane ke liye dobara Publish karein." : "")); });
  }
  function addByMobiles() {
    var raw = document.getElementById("ros-mobiles").value || "", nums = raw.split(/[\s,;]+/).map(function (x) { return x.replace(/\D/g, "").slice(-10); }).filter(function (x) { return x.length === 10; });
    if (!nums.length) { note("⚠️ Sahi 10-digit mobile number likhein."); return; }
    var all = students(), found = [], miss = [];
    nums.forEach(function (n) { var s = all.filter(function (x) { return x.mobile === n; })[0]; if (s) found.push(s); else miss.push(n); });
    document.getElementById("ros-mobiles").value = "";
    if (miss.length) note("⚠️ Ye mobile registered students me nahi mile: " + miss.slice(0, 5).join(", ") + (miss.length > 5 ? " …" : "")); 
    if (found.length) addStudents(found);
  }
  function fillLinkSel() {
    var sel = document.getElementById("ros-link-sel"); if (!sel) return; sel.textContent = "";
    sel.appendChild(h("option", { value: "", text: "— Registration chunein —" }));
    P.regs.forEach(function (r) { var o = h("option", { value: r.id, text: r.name + " • " + r.count + " students" + (r.published ? " • roll digits " + r.rollDigits : " (publish baaki)") }); if (!r.published) o.disabled = true; sel.appendChild(o); });
  }
  function linkFromPanel(forceId) {
    var ex = ctxEx(), sel = document.getElementById("ros-link-sel"), rid = typeof forceId === "string" ? forceId : (sel && sel.value), R = C[P.id];
    if (!rid) { note("⚠️ Pehle upar se Registration chunein."); return; }
    var reg = P.regs.filter(function (r) { return r.id === rid; })[0];
    if (!ex.registrationId && R && R.list.length && !confirm("Is exam ke abhi ke " + R.list.length + " roster students hat kar Registration wale students aa jaayenge. Aage badhein?")) return;
    if (reg && reg.rollDigits !== (Number(ex.rollDigits) || 2) && !confirm("Exam ke Roll digits " + (Number(ex.rollDigits) || 2) + " se " + reg.rollDigits + " ho jaayenge (OMR sheet par roll columns badlenge — chhapi hui sheet dobara chhapni pad sakti hai). Aage badhein?")) return;
    note("⏳ Registration se jod rahe hain...");
    api.linkRegistration(P.id, rid).then(function (ok) { if (ok) { renderAll(); note("✅ Registration se " + ((C[P.id] && C[P.id].list.length) || 0) + " students jud gaye. Roll No wahi hain jo admit card par hain."); } else note(""); });
  }
  function build() {
    if (OV) return;
    function sec(title, kids, open, id) { var d = h("details", open ? { open: "" } : {}, [h("summary", { text: title })].concat(kids)); d.className = "ros-sec"; if (id) d.id = id; return d; }
    function field(id, label, tag, ph) { var i = h(tag || "input", { id: "ros-f-" + id, placeholder: ph || "" }); if (tag === "textarea") i.rows = 3; return h("label", { class: "ros-field" }, [h("span", { text: label }), i]); }
    var scope = h("select", { id: "ros-scope", onchange: function () { P.scope = this.value; renderPicker(); } }, [h("option", { value: "class", text: "Is exam ki Class ke students" }), h("option", { value: "all", text: "Institute ke saare students" })]);
    var search = h("input", { type: "search", placeholder: "Naam / mobile se dhoondhein", oninput: function () { P.q = this.value; renderPicker(); } });
    var prof = h("input", { type: "checkbox", id: "ros-profile", onchange: function () { P.profile = this.checked; } }); prof.checked = true;
    var sheet = h("div", { class: "test-analysis-sheet ros-sheet" }, [
      h("button", { type: "button", class: "test-analysis-close", text: "✕", "aria-label": "Band karein", onclick: close }),
      h("div", { class: "test-analysis-title", text: "🎫 Admit Card & Roster" }),
      h("div", { class: "test-analysis-meta", id: "ros-sub" }),
      h("div", { class: "ros-stats", id: "ros-stats" }),
      h("p", { class: "examgr-notice", id: "ros-notice", hidden: "" }),
      h("div", { class: "examgr-notice ros-warnbox", id: "ros-warn", hidden: "" }),
      sec("🔗 Registration se jodein (pehle se register students)", [
        h("p", { class: "muted-text", id: "ros-link-info" }),
        h("select", { id: "ros-link-sel", class: "ros-linksel" }),
        h("div", { class: "ros-btnrow" }, [
          h("button", { type: "button", class: "btn-primary", id: "ros-link-btn", text: "🔗 Jodein", onclick: function () { linkFromPanel(); } }),
          h("button", { type: "button", class: "btn-secondary", id: "ros-sync-btn", text: "🔄 Registration se dobara sync", onclick: function () { var ex = ctxEx(); if (ex && ex.registrationId) linkFromPanel(ex.registrationId); } })])
      ], true, "ros-sec-link"),
      sec("👥 1. Students chunein (Roll No + Set auto)", [
        h("div", { class: "ros-ctl" }, [scope, search]),
        h("label", { class: "ros-chk" }, [prof, h("span", { text: "Student profile ka Roll Number use karein (jahan numeric aur unique ho), baaki auto" })]),
        h("div", { id: "ros-picker", class: "ros-picker" }),
        h("div", { class: "ros-btnrow" }, [
          h("button", { type: "button", class: "btn-secondary", text: "Sab chunein", onclick: function () { document.querySelectorAll("#ros-picker input:not(:disabled)").forEach(function (c) { if (!c.checked) c.click(); }); } }),
          h("button", { type: "button", class: "btn-primary", id: "ros-add-btn", text: "➕ Add karein", onclick: function () { addStudents(Object.keys(P.sel).map(function (k) { return P.sel[k]; })); } })]),
        h("label", { class: "ros-field" }, [h("span", { text: "Ya mobile numbers paste karein (comma / space se alag)" }), h("textarea", { id: "ros-mobiles", rows: "2" })]),
        h("button", { type: "button", class: "btn-secondary", text: "➕ Mobile se add karein", onclick: addByMobiles })
      ], true, "ros-sec-add"),
      sec("📋 Roster (Roll No → Student)", [h("input", { type: "search", placeholder: "Roster me dhoondhein", oninput: function () { P.tq = this.value; renderTable(); } }), h("div", { id: "ros-table" })], true),
      sec("🎫 2. Admit Card details", [
        field("time", "Exam Time", "input", "jaise 10:00 AM – 1:00 PM"), field("reportTime", "Reporting Time", "input", "jaise 9:30 AM"), field("venue", "Venue / Center", "input", "Hall / Room / Address"),
        field("notes", "Instructions (khaali = default)", "textarea", ""),
        h("label", { class: "ros-chk" }, [h("input", { type: "checkbox", id: "ros-f-autolink" }), h("span", { text: "Roll match hone par scan save par student se auto-link karein" })]),
        h("div", { class: "ros-btnrow" }, [
          h("button", { type: "button", class: "btn-secondary", text: "💾 Details save", onclick: saveSettings }),
          h("button", { type: "button", class: "btn-primary", id: "ros-publish-btn", text: "🚀 Publish", onclick: publish }),
          h("button", { type: "button", class: "btn-secondary", text: "📄 Sab ke Print (PDF)", onclick: printAll })])
      ], false, "ros-sec-admit"),
      sec("📊 3. Scan status & Anomalies", [h("div", { id: "ros-status" }), h("div", { class: "ros-btnrow" }, [
        h("button", { type: "button", class: "btn-secondary", text: "🙈 Absentees auto-fill", onclick: fillAbsentees }),
        h("button", { type: "button", class: "btn-secondary", text: "⬇️ Attendance CSV", onclick: csvDownload }),
        h("button", { type: "button", class: "btn-secondary", text: "🔄 Refresh", onclick: function () { var ex = ctxEx(); if (ex) ex._resultsLoaded = false; renderStatus(); } })])])
    ]);
    OV = h("div", { id: "ros-overlay", class: "test-analysis-overlay examgr-overlay-full hidden" }, [sheet]);
    OV.addEventListener("click", function (e) { if (e.target === OV) close(); });
    document.body.appendChild(OV);
  }
  function close() { if (OV) OV.classList.add("hidden"); var c = X(); if (c) c.showDetails(); }
  function openPanel() {
    var c = X(); if (!c || !c.id()) return;
    P.id = c.id(); P.sel = {}; P.q = ""; P.tq = ""; build();
    c.hideDetails(); OV.classList.remove("hidden"); note("");
    Promise.all([load(P.id), typeof root.ensureAllStudentsCache === "function" ? Promise.resolve(root.ensureAllStudentsCache()).catch(function () {}) : null]).then(renderAll);
    api.regOptions().then(function (arr) { P.regs = arr; fillLinkSel(); renderAll(); });
    renderAll();
  }
  root.SnapRoster = api;
})(typeof window !== "undefined" ? window : globalThis);
