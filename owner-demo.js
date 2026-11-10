/* v220 Phase 3B — Demo Institute (Owner Panel).
   Ek click me nakli institute: ~20 students, 2 batches (YouTube links), 2 tests, 40 results. "Demo reset" ek click me hataata hai.
   - Sab docs me isDemo:true. Fixed IDs (deterministic) — reset kabhi asli data nahi chhoota.
   - Students ke secrets/sessions nahi bante => koi login nahi kar sakta. Mobile = 0000000001..20 (nakli series).
   - Seed 2 commits me (institute-dependent rules ke liye), har commit <= 400 writes.
   Kill-switch: SNAP_CONFIG.demo = false. */
(function () {
  "use strict";
  if (window.ownerDemoSeed) return;
  var ID = "demo_sample", CLASS = "class_10", LIM = 400, YT = "aqz-KE-bpKQ";
  var NAMES = ["Aarav Sharma", "Vivaan Singh", "Aditya Kumar", "Ananya Gupta", "Diya Verma", "Ishaan Yadav", "Kavya Mishra", "Riya Patel", "Arjun Prasad", "Saanvi Jha",
    "Rohan Das", "Pooja Kumari", "Karan Mehta", "Neha Rani", "Sahil Ansari", "Tanvi Singh", "Yash Raj", "Mira Devi", "Harsh Vardhan", "Simran Kaur"];
  function mob(i) { return "00000" + String(i).padStart(5, "0"); }

  /* pure: sab docs ki list. T = createdAt value (serverTimestamp), now = ms */
  function build(T, now) {
    var A = [], B = [], i, t;
    A.push({ p: "institutes/" + ID, d: { name: "Demo Institute", ownerName: "Demo Owner", active: true, allowedClasses: [CLASS], isDemo: true, plan: "Free", studentLimit: 0, storageLimitMB: 0, studentCount: 20,
      brandColor: "#0ea5e9", tagline: "Sample data — reset kar sakte hain", createdAt: T } });
    for (i = 1; i <= 20; i++) A.push({ p: "students/" + mob(i), d: { name: NAMES[i - 1], mobile: mob(i), hasPin: false, instituteId: ID, classId: CLASS, isDemo: true, createdAt: T } });
    var tests = [{ id: "demo-test-1", title: "Demo Test 1 — Algebra" }, { id: "demo-test-2", title: "Demo Test 2 — Mixed Practice" }];
    tests.forEach(function (x, ti) {
      var qs = [];
      for (var q = 1; q <= 5; q++) qs.push({ questionEN: "Demo sawaal " + q + " (" + x.title + ")", questionHI: "", optionsEN: ["Option A", "Option B", "Option C", "Option D"], optionsHI: [], correctAnswer: (q + ti) % 4, subject: "Mathematics", chapter: "Algebra", sectionId: "sec-1" });
      x.qs = qs;
      A.push({ p: "tests/" + x.id, d: { title: x.title, category: "Demo", minutes: 30, marksPerQuestion: 4, negativeEnabled: true, negativeMarks: 1, attemptLimit: null, subjectiveMarks: null, isDraft: false,
        sections: [{ id: "sec-1", title: "Section A", marksPerQuestion: null }], questionCount: 5, chunkCount: 1, instituteId: ID, classId: CLASS, isDemo: true, updatedAt: T } });
      B.push({ p: "tests/" + x.id + "/qchunks/c0", d: { questions: qs } });
    });
    for (t = 0; t < 2; t++) for (i = 1; i <= 20; i++) {
      var attempted = i % 4 === 0 ? 4 : 5, correct = Math.min(attempted, (i * 7 + t * 3) % 6), wrong = attempted - correct, score = correct * 4 - wrong, when = new Date(now - (t * 3 + (i % 3)) * 86400000);
      A.push({ p: "studentRecords/demo_rec_" + (t + 1) + "_" + String(i).padStart(2, "0"), d: { name: NAMES[i - 1], mobile: mob(i), instituteId: ID, classId: CLASS, testId: tests[t].id, testTitle: tests[t].title, testMode: "Saved", isPractice: false, chapters: [],
        totalQuestions: 5, attempted: attempted, negativeEnabled: true, negativeMarks: 1, maxScore: 20, score: score, percentage: Math.round(score / 20 * 1000) / 10, correct: correct, wrong: wrong, unattempted: 5 - attempted, extraNotCounted: 0,
        attemptLimit: null, pendingSubjective: 0, details: [], durationSeconds: 600 + i * 17, submittedAt: when.toLocaleString("en-IN"), submittedIso: when.toISOString(), isDemo: true, savedAt: T } });
    }
    var batches = [{ id: "demo_b1", name: "Class 10 — Maths Foundation (Demo)", code: "DEMO10M", subjects: ["Mathematics"], from: 1, to: 12 }, { id: "demo_b2", name: "Class 10 — Science Revision (Demo)", code: "DEMO10S", subjects: ["Science"], from: 9, to: 20 }];
    batches.forEach(function (b) {
      B.push({ p: "institutes/" + ID + "/batches/" + b.id, d: { name: b.name, code: b.code, classLabel: "Class 10", subjects: b.subjects, desc: "Demo batch — sample data", teachers: ["Demo Teacher"], startDate: "", endDate: "", type: "free", enrollment: "request", fee: 0, limit: 0,
        status: "active", published: true, instituteId: ID, enrolledCount: b.to - b.from + 1, createdAt: T, createdBy: "demo", isDemo: true } });
      for (var k = 1; k <= 3; k++) B.push({ p: "institutes/" + ID + "/batches/" + b.id + "/items/" + b.id + "_r" + k, d: { batchId: b.id, instituteId: ID, kind: "recording", title: "Demo Lecture " + k, desc: "", subject: b.subjects[0], chapter: "Chapter " + k, subjectId: "", chapterId: "", teacher: "Demo Teacher",
        status: "published", published: true, ytId: YT, createdAt: T, isDemo: true } });
      B.push({ p: "institutes/" + ID + "/batches/" + b.id + "/items/" + b.id + "_c1", d: { batchId: b.id, instituteId: ID, kind: "class", title: "Demo Live Class (kal)", desc: "", subject: b.subjects[0], chapter: "", subjectId: "", chapterId: "", teacher: "Demo Teacher",
        status: "upcoming", published: true, ytId: YT, mode: "external", scheduledAt: new Date(now + 86400000), createdAt: T, isDemo: true } });
      for (var s = b.from; s <= b.to; s++) B.push({ p: "institutes/" + ID + "/batches/" + b.id + "/members/" + mob(s), d: { mobile: mob(s), name: NAMES[s - 1], instituteId: ID, batchId: b.id, status: "active", joinedAt: T, isDemo: true } });
    });
    return { A: A, B: B };
  }

  function db() { if (typeof ownerGetDb !== "function") throw new Error("Owner login chahiye"); return ownerGetDb(); }
  function commit(ops) {   /* ops: [{ref,data}|{ref,del}] ; 400 ke tukde */
    var D = db(), p = Promise.resolve();
    for (var i = 0; i < ops.length; i += LIM) (function (part) {
      p = p.then(function () { var b = D.batch(); part.forEach(function (o) { o.del ? b.delete(o.ref) : b.set(o.ref, o.data); }); return b.commit(); });
    })(ops.slice(i, i + LIM));
    return p;
  }
  function msg(t) { var e = document.getElementById("owner-demo-msg"); if (e) e.textContent = t || ""; }

  window.ownerDemoSeed = function () {
    var D, T; try { D = db(); } catch (e) { return alert(e.message); }
    T = firebase.firestore.FieldValue.serverTimestamp();
    D.collection("institutes").doc(ID).get().then(function (x) {
      if (x.exists) { alert("Demo institute pehle se hai. Pehle \"Demo reset\" karein."); return; }
      if (!confirm("Demo institute banayein? (~20 students, 2 batches, 2 tests, 40 results — sab nakli)")) return;
      msg("Ban raha hai…"); var s = build(T, Date.now());
      return commit(s.A.map(function (o) { return { ref: D.doc(o.p), data: o.d }; }))
        .then(function () { return commit(s.B.map(function (o) { return { ref: D.doc(o.p), data: o.d }; })); })
        .then(function () {
          msg("✅ Demo ban gaya. Dekhne ke liye Institutes me Demo card ke \"Admin\" se apna doosra email jodein.");
          try { window.ouiTab && window.ouiTab("inst"); setTimeout(function () { var d = document.querySelector('details.oa-adm[data-iid="' + ID + '"]'); if (d) { d.open = true; d.scrollIntoView({ block: "center" }); } }, 600); } catch (e) {}
        });
    }).catch(function (e) { msg(""); alert("Demo nahi bana: " + (e && (e.message || e.code) || e)); });
  };

  function listAll(q) { return q.get().then(function (s) { return s.docs; }); }
  window.ownerDemoReset = function () {
    var D; try { D = db(); } catch (e) { return alert(e.message); }
    if (!confirm("Demo reset: sirf DEMO data (isDemo) hatega — asli institutes ko kuch nahi hoga. Chalu karein?")) return;
    msg("Reset ho raha hai…"); var inst = D.collection("institutes").doc(ID), del = function (docs) { return commit(docs.map(function (d) { return { ref: d.ref, del: true }; })); };
    var SUBS = ["items", "members", "assignments", "requests", "catalog", "subjects"];
    /* 1) demo institute ka batch-tree (rules ke liye institute doc sabse aakhir me jaayega) */
    inst.collection("batches").get().then(function (bs) {
      return bs.docs.reduce(function (p, b) {
        return p.then(function () {
          return SUBS.reduce(function (pp, sub) {
            return pp.then(function () {
              return listAll(b.ref.collection(sub)).then(function (docs) {
                if (sub !== "subjects") return del(docs);
                return docs.reduce(function (p3, sd) { return p3.then(function () { return listAll(sd.ref.collection("chapters")).then(del); }); }, Promise.resolve()).then(function () { return del(docs); });
              });
            });
          }, Promise.resolve()).then(function () { return del([b]); });
        });
      }, Promise.resolve());
    })
      /* 2) demo tests + unke qchunks */
      .then(function () { return listAll(D.collection("tests").where("isDemo", "==", true)); })
      .then(function (tests) { return tests.reduce(function (p, t) { return p.then(function () { return listAll(t.ref.collection("qchunks")).then(del); }); }, Promise.resolve()).then(function () { return del(tests); }); })
      /* 3) demo results aur students (400 ke round) */
      .then(function () { return purge(D.collection("studentRecords")); })
      .then(function () { return purge(D.collection("students")); })
      /* 4) institute doc */
      .then(function () { return inst.delete(); })
      .then(function () { msg("✅ Demo hat gaya. (Agar demo ke liye admin jora tha to Owner Panel me uska admin record alag se hata dein.)"); })
      .catch(function (e) { msg(""); alert("Reset nahi hua: " + (e && (e.message || e.code) || e)); });
    function purge(col) {
      var n = 0;
      return (function loop() {
        return listAll(col.where("isDemo", "==", true).limit(LIM)).then(function (docs) { if (!docs.length || ++n > 20) return; return del(docs).then(function () { return docs.length < LIM ? undefined : loop(); }); });
      })();
    }
  };

  function mount() {
    if ((window.SNAP_CONFIG || {}).demo === false) return;
    var host = document.getElementById("oa-v-set"); if (!host || document.getElementById("owner-demo-card")) return;
    var c = document.createElement("div"); c.id = "owner-demo-card"; c.className = "oa-card"; c.style.cssText = "margin:12px 0;padding:12px";
    c.innerHTML = '<b>🧪 Demo Institute</b><div style="font-size:.8rem;margin:6px 0;line-height:1.5">Ek click me nakli institute (20 students, 2 batches, 2 tests, 40 results). Stats me nahi ginta. Reset sirf demo data hataata hai.</div>' +
      '<button type="button" class="owner-mini-btn" onclick="ownerDemoSeed()">Demo banao</button> <button type="button" class="owner-mini-btn" onclick="ownerDemoReset()">Demo reset</button><div id="owner-demo-msg" style="font-size:.78rem;margin-top:6px"></div>';
    host.appendChild(c);
  }
  if (typeof document !== "undefined" && document.getElementById) mount();
  window.__ownerDemoTest = { build: build, ID: ID, LIM: LIM };
})();
