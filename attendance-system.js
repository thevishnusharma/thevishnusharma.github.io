/* SnapTest Pro — Smart Student Attendance (v314)
   batch-system.js ke andar plug hota hai (SnapBatch.ext) — koi purani file nahi chhuti.
   Admin  : Attendance (dashboard) | Class Schedule | Mark Attendance (Manual + NFC + Auto-submit) | Absent Students (+ parent call) | Reports | NFC Cards & Settings
   Student: "Attendance" tab (Daily / Weekly / Monthly)
   Data   : institutes/{i}/batches/{b}/attendanceSessions/{classId}      (admin-only: poori class ki P/A/L)
            institutes/{i}/batches/{b}/attendanceStudents/{mobile}_{YYYYMM} (student apna padh sake)
            institutes/{i}/nfcCards/{UID}                                (card -> student)
            institutes/{i}/batchSettings/attendance                      (lateMin, autoMin)
   Roster = SIRF us batch ke members. Kill-switch: SNAP_CONFIG.attendance = false */
(function () {
  "use strict";
  var SB = window.SnapBatch;
  if (!SB || !SB.ext) { console.warn("[attendance] batch-system.js pehle load hona chahiye"); return; }
  if ((window.SNAP_CONFIG || {}).attendance === false) return;
  var EXT = SB.ext, X = { cfg: null, cfgInst: "", ro: {}, stu: null, sc: {}, cards: {}, byMob: null };
  var DEF = { lateMin: 10, autoMin: 15 };

  function C() { return SB.ctx(); }
  function e(t) { return String(t == null ? "" : t).replace(/[&<>"']/g, function (x) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[x]; }); }
  function p2(n) { return (n < 10 ? "0" : "") + n; }
  function ymd(t) { var d = new Date(t); return d.getFullYear() + "-" + p2(d.getMonth() + 1) + "-" + p2(d.getDate()); }
  function ymOf(t) { return ymd(t).slice(0, 7).replace("-", ""); }
  function tm(t) { return new Date(t).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }); }
  function dd(t) { return new Date(t).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }); }
  function dayStart(t) { var d = new Date(t); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); }
  function bsub(c, b, n) { return c.bref(c.A.inst, b).collection(n); }
  function inst(c) { return c.A.inst; }
  function bname(c, id) { try { return c.batchName(id) || id; } catch (x) { return id; } }
  function flat(a) { return a.reduce(function (s, x) { return s.concat(x); }, []); }
  function digits(s) { return String(s || "").replace(/\D/g, ""); }
  function phone(s) { var d = digits(s); if (d.length > 10) d = d.slice(-10); return d.length === 10 ? d : ""; }
  function guard(name, c) { return (c.A.view === name || (c.A.attSub === name && c.A.attHost === c.A.view)) && document.getElementById("bm-main"); }
  function rollNum(r) { var n = parseInt(r.roll, 10); return isNaN(n) ? 1e9 : n; }

  /* ---------------- settings ---------------- */
  function cfgRef(c) { return c.DB().collection("institutes").doc(inst(c)).collection("batchSettings").doc("attendance"); }
  function loadCfg(c) {
    if (X.cfg && X.cfgInst === inst(c)) return Promise.resolve(X.cfg);
    return cfgRef(c).get().then(function (d) { var v = d.exists ? d.data() : {}; X.cfg = { lateMin: +v.lateMin >= 0 && v.lateMin !== undefined ? +v.lateMin : DEF.lateMin, autoMin: +v.autoMin > 0 ? +v.autoMin : DEF.autoMin }; X.cfgInst = inst(c); return X.cfg; }).catch(function () { X.cfg = Object.assign({}, DEF); X.cfgInst = inst(c); return X.cfg; });
  }

  /* ---------------- classes (existing batch "class" items = schedule) ---------------- */
  function stateOf(c, i, now) { var s = c.ms(i.scheduledAt), en = s + (+i.durationMin || 60) * 6e4; if (i.status === "live" || (now >= s && now <= en)) return "run"; return now < s ? "up" : "done"; }
  function classesIn(c, from, to) {
    var out = [];
    Object.keys(c.A.items || {}).forEach(function (b) {
      (c.A.items[b] || []).forEach(function (i) {
        if (i.kind !== "class" || i.status === "cancelled") return;
        var s = c.ms(i.scheduledAt); if (!s || s < from || s >= to) return;
        out.push(Object.assign({}, i, { batchId: i.batchId || b }));
      });
    });
    return out.sort(function (a, b) { return c.ms(a.scheduledAt) - c.ms(b.scheduledAt); });
  }
  function baseOf(c, i) {
    var s = c.ms(i.scheduledAt), en = s + (+i.durationMin || 60) * 6e4, d = ymd(s);
    return { classId: i.id, batchId: i.batchId, instituteId: inst(c), title: i.title || "Class", subject: i.subject || "", teacher: i.teacher || "", startMs: s, endMs: en, date: d, ym: ymOf(s) };
  }
  function sessRange(c, bids, fromD, toD, force) {
    return Promise.all(bids.map(function (b) {
      var k = b + "|" + fromD + "|" + toD, z = X.sc[k];
      if (!force && z && Date.now() - z.t < 45000) return Promise.resolve(z.v);
      return bsub(c, b, "attendanceSessions").where("date", ">=", fromD).where("date", "<=", toD).get().then(function (q) {
        var v = q.docs.map(function (d) { return Object.assign({ id: d.id, batchId: b }, d.data()); }); X.sc[k] = { t: Date.now(), v: v }; return v;
      }).catch(function () { return []; });
    })).then(flat);
  }
  function counts(s) {
    if (s.counts) return s.counts;
    var o = { p: 0, a: 0, l: 0, total: 0 }; Object.keys(s.marks || {}).forEach(function (m) { var v = (s.marks[m] || "").toLowerCase(); if (o[v] !== undefined) o[v]++; }); return o;
  }

  /* ---------------- roster: SIRF us batch ke registered students ---------------- */
  function loadStudents(c) {
    if (X.stu) return Promise.resolve(X.stu);
    var mk = function (arr) { var m = {}; (arr || []).forEach(function (s) { m[String(s.mobile)] = s; }); X.stu = m; return m; };
    if (c.A.students && c.A.students.length) return Promise.resolve(mk(c.A.students));
    return c.authReady().then(function () { return c.DB().collection("students").where("instituteId", "==", inst(c)).limit(500).get(); })
      .then(function (q) { return mk(q.docs.map(function (d) { return Object.assign({ mobile: d.id }, d.data()); })); }).catch(function () { return {}; });   /* fail ho to cache na karo, agli baar dobara koshish */
  }
  function roster(c, b, force) {
    var z = X.ro[b];
    if (!force && z && Date.now() - z.t < 300000) return Promise.resolve(z.v);
    return Promise.all([bsub(c, b, "members").get(), loadStudents(c)]).then(function (r) {
      var sm = r[1], v = r[0].docs.map(function (d) {
        var m = d.data(), s = sm[d.id] || {};
        return { mobile: d.id, name: m.name || s.name || d.id, roll: s.rollNumber || s.rollNo || "", par: phone(s.parentPhone || s.guardianMobile || "") };
      }).sort(function (a, b2) { return rollNum(a) - rollNum(b2) || a.name.localeCompare(b2.name); });
      X.ro[b] = { t: Date.now(), v: v }; return v;
    });
  }

  /* ---------------- save (submit / auto-submit) ---------------- */
  function commit(c, b, base, ro, marks, via, status) {
    var cn = { p: 0, a: 0, l: 0, total: ro.length }, mk = {}, vi = {};
    ro.forEach(function (r) { var s = marks[r.mobile] || "A"; mk[r.mobile] = s; if (via[r.mobile]) vi[r.mobile] = via[r.mobile]; cn[s.toLowerCase()]++; });
    var doc = Object.assign({}, base, { marks: mk, via: vi, counts: cn, status: status, submittedBy: c.adminEmail(), submittedAt: c.FV().serverTimestamp(), updatedAt: c.FV().serverTimestamp() });
    return bsub(c, b, "attendanceSessions").doc(base.classId).set(doc).then(function () {
      var chunks = []; for (var i = 0; i < ro.length; i += 400) chunks.push(ro.slice(i, i + 400));
      return chunks.reduce(function (p, ch) {
        return p.then(function () {
          var wb = c.DB().batch();
          ch.forEach(function (r) { var days = {}; days[base.classId] = { s: mk[r.mobile], d: base.date, st: base.startMs, t: base.title, k: base.subject }; wb.set(bsub(c, b, "attendanceStudents").doc(r.mobile + "_" + base.ym), { mobile: r.mobile, ym: base.ym, instituteId: base.instituteId, batchId: b, days: days, updatedAt: c.FV().serverTimestamp() }, { merge: true }); });
          return wb.commit();
        });
      }, Promise.resolve());
    }).then(function () { X.sc = {}; try { c.audit("attendance." + status, base.classId); } catch (x) {} return { counts: cn, marks: mk }; });
  }
  /* Server nahi hai, isliye: dashboard khulte hi purane "open" session (jinka auto-submit time nikal gaya) final ho jaate hain. Jo class kabhi shuru hi nahi hui wo Pending rehti hai (kisi ko Absent nahi gina jaata). */
  function lazyFinalize(c, sessions, cfg) {
    var now = Date.now(), jobs = sessions.filter(function (s) { return s.status === "open" && now > s.startMs + cfg.autoMin * 6e4; });
    return Promise.all(jobs.map(function (s) {
      return roster(c, s.batchId).then(function (ro) { return commit(c, s.batchId, { classId: s.classId, batchId: s.batchId, instituteId: s.instituteId, title: s.title, subject: s.subject, teacher: s.teacher, startMs: s.startMs, endMs: s.endMs, date: s.date, ym: s.ym }, ro, s.marks || {}, s.via || {}, "auto"); })
        .then(function (r) { s.status = "auto"; s.counts = r.counts; s.marks = r.marks; if (now - s.endMs < 6 * 36e5) pushBatch(c, s.batchId, { classId: s.classId, title: s.title, subject: s.subject, startMs: s.startMs }); }).catch(function (x) { console.warn("[attendance] auto-finalize", x); });
    }));
  }

  /* ---------------- NFC adapter ---------------- */
  var NFC = (function () {
    var ctl = null;
    function plugin() { var P = (window.Capacitor && window.Capacitor.Plugins) || {}; return P.Nfc || P.NFC || null; }
    function kind() { if (plugin()) return "native"; if ("NDEFReader" in window) return "web"; return ""; }
    function norm(s) { return String(s || "").replace(/[^0-9a-f]/gi, "").toUpperCase(); }
    function hex(a) { return a.map(function (b) { return ("0" + (b & 255).toString(16)).slice(-2); }).join("").toUpperCase(); }
    function stop() { if (ctl) { try { ctl.stop(); } catch (x) {} ctl = null; } }
    function start(onUid, onErr) {
      stop();
      var p = plugin();
      if (p && p.addListener) {
        var h = null;
        return Promise.resolve(p.addListener("nfcTagScanned", function (ev) { var id = ev && ev.nfcTag && ev.nfcTag.id; if (id) onUid(Array.isArray(id) ? hex(id) : norm(id)); }))
          .then(function (hd) { h = hd; return p.startScanSession ? p.startScanSession() : null; })
          .then(function () { ctl = { stop: function () { try { h && h.remove && h.remove(); } catch (x) {} try { p.stopScanSession && p.stopScanSession(); } catch (x) {} } }; })
          .catch(function (x) { onErr(x); });
      }
      if ("NDEFReader" in window) {
        var r = new window.NDEFReader(), ab = new AbortController();
        return r.scan({ signal: ab.signal }).then(function () {
          r.onreading = function (ev) { onUid(norm(ev.serialNumber)); };
          r.onreadingerror = function () { onErr({ message: "Card padh nahi paaya — dobara tap karein" }); };
          ctl = { stop: function () { ab.abort(); } };
        }).catch(function (x) { onErr(x); });
      }
      onErr({ message: "Is device/app me NFC support nahi hai" }); return Promise.resolve();
    }
    return { kind: kind, start: start, stop: stop, norm: norm };
  })();
  function nfcCard(c, uid) {
    if (X.cards[uid] !== undefined) return Promise.resolve(X.cards[uid]);
    return c.DB().collection("institutes").doc(inst(c)).collection("nfcCards").doc(uid).get().then(function (d) { var v = d.exists ? d.data() : null; if (v) X.cards[uid] = v; return v; });   /* null cache nahi: card baad me link ho to turant pehchane */
  }

  /* =====================================================================
     MARK ATTENDANCE (overlay)  — Manual + NFC + Auto-submit
     ===================================================================== */
  var M = null;
  function closeMark() {
    if (!M) return; clearInterval(M.tick); clearTimeout(M.dt); NFC.stop();
    if (M.dirty && !M.sub) flushDraft(); var o = document.getElementById("att-mark"); o && o.remove(); M = null;
  }
  function flushDraft() {
    if (!M || (M.sub && !M.edit)) return; var c = M.c; M.dirty = false;
    bsub(c, M.b, "attendanceSessions").doc(M.base.classId).set(Object.assign({}, M.base, { marks: M.marks, via: M.via, status: "open", updatedAt: c.FV().serverTimestamp() }), { merge: true }).catch(function (x) { console.warn("[attendance] draft", x); });
  }
  function draft() { if (!M || (M.sub && !M.edit)) return; M.dirty = true; clearTimeout(M.dt); M.dt = setTimeout(flushDraft, 1500); }
  function tally() { var o = { p: 0, a: 0, l: 0, u: 0 }; M.ro.forEach(function (r) { var s = M.marks[r.mobile]; if (s === "P") o.p++; else if (s === "A") o.a++; else if (s === "L") o.l++; else o.u++; }); return o; }
  function openMark(c, it, legacy) {
    if (!legacy && it && window.SnapAttV2) return window.SnapAttV2.openClass(c, it);   /* v2: naya Manual/QR screen */
    closeMark();
    var o = document.createElement("div"); o.id = "att-mark"; o.className = "att-ov"; o.innerHTML = '<div class="att-hd"><button data-x aria-label="Back">←</button><b>Mark Attendance</b></div><div class="att-load">Loading…</div>';
    document.body.appendChild(o); o.querySelector("[data-x]").onclick = closeMark;
    var b = it.batchId, base = baseOf(c, it);
    Promise.all([roster(c, b, true), bsub(c, b, "attendanceSessions").doc(it.id).get(), bsub(c, b, "attendance").where("itemId", "==", it.id).get().catch(function () { return { docs: [] }; }), loadCfg(c)]).then(function (r) {
      if (!document.getElementById("att-mark")) return;
      var ro = r[0], sd = r[1].exists ? r[1].data() : null, cfg = r[3], now = Date.now();
      M = { c: c, it: it, b: b, base: base, ro: ro, cfg: cfg, marks: Object.assign({}, sd && sd.marks || {}), via: Object.assign({}, sd && sd.via || {}), sub: !!(sd && (sd.status === "submitted" || sd.status === "auto")), subStatus: sd && sd.status, subAt: sd && sd.submittedAt, edit: false, tab: "manual", q: "", taps: [], last: null, nfcOn: false, deadline: base.startMs + cfg.autoMin * 6e4 };
      M.auto = !M.sub && now < M.deadline;   /* auto-submit tabhi jab screen deadline se pehle khuli ho */
      var roMobs = {}; ro.forEach(function (x) { roMobs[x.mobile] = 1; });
      r[2].docs.forEach(function (d) {   /* live class join karne walon ko pehle se Present */
        var j = d.data(), m = j.mobile; if (!roMobs[m] || M.marks[m]) return;
        var jt = j.joinedAt && j.joinedAt.toMillis ? j.joinedAt.toMillis() : 0; M.marks[m] = jt && jt > base.startMs + cfg.lateMin * 6e4 ? "L" : "P"; M.via[m] = "j";
      });
      shell(); M.tick = setInterval(tickFn, 1000);
    }).catch(function (x) { o.querySelector(".att-load").textContent = "Load nahi hua: " + (x && (x.code || x.message) || x) + " — Firestore Rules publish kiye?"; });
  }
  function shell() {
    var o = document.getElementById("att-mark"), it = M.it, c = M.c;
    o.innerHTML = '<div class="att-hd"><button data-x aria-label="Back">←</button><b>Mark Attendance</b><span class="att-hs"></span></div>' +
      '<div class="att-chips"><div><small>Batch</small><b>' + e(bname(c, M.b)) + '</b></div><div><small>Subject</small><b>' + e(M.base.subject || it.title) + '</b></div><div><small>Time</small><b>' + e(dd(M.base.startMs)) + "<br>" + e(tm(M.base.startMs)) + '</b></div></div>' +
      '<div class="att-tabs"><button data-t="manual">✋ Manual</button><button data-t="nfc">📡 NFC Tap</button></div><div class="att-body"></div>' +
      '<div class="att-foot"><div class="att-sum"></div><div class="att-cd"></div><div class="att-acts"></div></div>';
    o.querySelector("[data-x]").onclick = closeMark;
    o.querySelectorAll("[data-t]").forEach(function (t) { t.onclick = function () { if (M.tab === "nfc" && t.dataset.t !== "nfc") stopNfc(); M.tab = t.dataset.t; body(); }; });
    body(); foot();
  }
  function body() {
    var o = document.getElementById("att-mark"); if (!o) return;
    o.querySelectorAll("[data-t]").forEach(function (t) { t.classList.toggle("on", t.dataset.t === M.tab); });
    var bx = o.querySelector(".att-body");
    if (M.tab === "manual") {
      bx.innerHTML = '<input class="att-search" placeholder="🔍 Search student / roll / mobile" value="' + e(M.q) + '"><div class="att-list"></div>';
      bx.querySelector(".att-search").oninput = function () { M.q = this.value; list(); };
      bx.querySelector(".att-list").onclick = function (ev) {
        var bt = ev.target.closest("[data-s]"); if (!bt) return; var row = bt.closest("[data-m]"); if (!row) return;
        if (M.sub && !M.edit) return toastEdit();
        var m = row.dataset.m, s = bt.dataset.s; if (M.marks[m] === s) delete M.marks[m]; else M.marks[m] = s; M.via[m] = "m"; draft(); list(); foot();
      };
      list();
    } else nfcPanel(bx);
  }
  function toastEdit() { M.c.toast("Submit ho chuki hai — badalne ke liye neeche \"Edit\" dabayein"); }
  function list() {
    var l = document.querySelector("#att-mark .att-list"); if (!l) return; var q = M.q.trim().toLowerCase();
    var rows = M.ro.filter(function (r) { return !q || r.name.toLowerCase().indexOf(q) > -1 || String(r.roll).toLowerCase() === q || r.mobile.indexOf(q) > -1; });
    l.innerHTML = rows.length ? rows.map(function (r, i) {
      var s = M.marks[r.mobile] || "", lock = M.sub && !M.edit;
      return '<div class="att-row" data-m="' + e(r.mobile) + '"><div class="att-av">' + e((r.name || "?").charAt(0).toUpperCase()) + '</div><div class="att-g"><b>' + e(r.name) + '</b><small>Roll: ' + e(r.roll || (i + 1)) + (M.via[r.mobile] === "n" ? " • 📡" : M.via[r.mobile] === "j" ? " • 🔴 live" : "") + '</small></div><div class="att-seg' + (lock ? " lk" : "") + '">' +
        ["P", "A", "L"].map(function (k) { return '<button data-s="' + k + '" class="' + (s === k ? "on " + k.toLowerCase() : "") + '">' + k + "</button>"; }).join("") + "</div></div>";
    }).join("") : '<div class="att-empty">' + (M.ro.length ? "Koi student nahi mila" : "Is batch me abhi koi registered student nahi hai") + "</div>";
  }
  function foot() {
    var o = document.getElementById("att-mark"); if (!o) return; var t = tally();
    o.querySelector(".att-sum").innerHTML = '<span class="p">Present ' + t.p + '</span><span class="a">Absent ' + t.a + '</span><span class="l">Late ' + t.l + '</span><span class="u">Unmarked ' + t.u + "</span>";
    o.querySelector(".att-hs").innerHTML = M.sub ? '<span class="att-badge ok">✔ ' + (M.subStatus === "auto" ? "Auto-submitted" : "Submitted") + "</span>" : "";
    var a = o.querySelector(".att-acts");
    if (M.sub && !M.edit) { a.innerHTML = '<button class="att-b sec" data-edit>✏️ Edit & Resubmit</button>'; a.querySelector("[data-edit]").onclick = function () { M.edit = true; M.auto = false; foot(); list(); }; }
    else {
      a.innerHTML = (M.tab === "manual" ? '<button class="att-b sec" data-all>Mark All Present</button>' : "") + '<button class="att-b" data-sub>Submit</button>';
      var al = a.querySelector("[data-all]"); al && (al.onclick = function () { M.ro.forEach(function (r) { if (!M.marks[r.mobile]) { M.marks[r.mobile] = "P"; M.via[r.mobile] = "m"; } }); draft(); list(); foot(); });
      a.querySelector("[data-sub]").onclick = function () { submit(false); };
    }
    tickFn();
  }
  function tickFn() {
    var cd = document.querySelector("#att-mark .att-cd"); if (!cd || !M) return;
    if (M.sub && !M.edit) { cd.textContent = ""; return; }
    var left = M.deadline - Date.now();
    if (M.auto && !M.edit) {
      if (left <= 0) { M.auto = false; return submit(true); }
      var s = Math.ceil(left / 1000); cd.innerHTML = "⏳ Auto-submit: <b>" + p2(Math.floor(s / 3600)) + ":" + p2(Math.floor(s % 3600 / 60)) + ":" + p2(s % 60) + "</b> (baaki Absent ginge jaayenge, tab tak mark kar sakte hain)";
    } else cd.textContent = left <= 0 ? "Auto-submit time nikal chuka — manually Submit karein" : "";
  }
  function submit(auto) {
    if (!M || M.busy) return; var t = tally();
    if (!auto && t.u && !M.c.sure(t.u + " student unmarked hain — wo ABSENT gine jaayenge. Submit karein?")) return;
    M.busy = true; stopNfc(); var c = M.c, mm = M, wasSub = !!M.sub;
    var a = document.querySelector("#att-mark .att-acts"); a && (a.innerHTML = '<span class="att-note">Save ho raha hai…</span>');
    commit(c, M.b, M.base, M.ro, M.marks, M.via, auto ? "auto" : "submitted").then(function (r) {
      mm.marks = r.marks; mm.sub = true; mm.edit = false; mm.subStatus = auto ? "auto" : "submitted"; mm.busy = false; mm.dirty = false;
      c.toast("✅ Attendance " + (auto ? "auto-submit" : "submit") + " ho gayi — P " + r.counts.p + " • A " + r.counts.a + " • L " + r.counts.l);
      if (!wasSub) pushBatch(c, mm.b, mm.base);
      if (M === mm) { body(); foot(); } if (EXT.attRefresh) EXT.attRefresh();
    }).catch(function (x) { mm.busy = false; c.toast("Save nahi hua: " + (x && (x.code || x.message) || x)); if (M === mm) foot(); });
  }
  function stopNfc() { NFC.stop(); if (M) M.nfcOn = false; }

  /* ---- NFC panel ---- */
  function nfcPanel(bx) {
    var k = NFC.kind(), l = M.last;
    bx.innerHTML = '<div class="att-nfc"><div class="att-nfc-c' + (M.nfcOn ? " on" : "") + '"><span>📡</span></div><h3>' + (M.nfcOn ? "Student ID Card tap karein" : "NFC scan band hai") + '</h3>' +
      '<p class="att-note">' + (k ? "Card phone ke peeche lagayein. Late ka time: class shuru hone ke " + M.cfg.lateMin + " min baad." : "Is device/app me NFC nahi chal raha. Chrome (Android) me kholein ya APK me NFC plugin jodein — tab tak neeche Roll/Mobile se mark karein.") + "</p>" +
      (k ? '<button class="att-b" data-scan>' + (M.nfcOn ? "⏹ Scan band karein" : "▶ NFC Scan shuru karein") + "</button>" : "") +
      '<div class="att-last' + (l ? (l.ok ? " ok" : " bad") : " hide") + '">' + (l ? '<b>' + e(l.title) + "</b><small>" + e(l.sub || "") + "</small>" : "") + "</div>" +
      '<div class="att-fb"><input data-fb placeholder="Roll no ya Mobile"><button class="att-b sec" data-fbb>Mark</button></div>' +
      '<div class="att-taps">' + M.taps.slice(0, 8).map(function (x) { return '<div class="att-tap"><span>' + e(x.name) + "</span><small>" + e(x.s === "L" ? "Late" : "Present") + " • " + e(tm(x.at)) + "</small></div>"; }).join("") + "</div></div>";
    var sc = bx.querySelector("[data-scan]");
    sc && (sc.onclick = function () {
      if (M.nfcOn) { stopNfc(); return nfcPanel(bx); }
      M.nfcOn = true; nfcPanel(bx);
      NFC.start(onUid, function (x) { M.nfcOn = false; M.last = { ok: false, title: "NFC chalu nahi hua", sub: (x && x.message) || "Settings me NFC ON karein aur permission dein" }; nfcPanel(bx); });
    });
    var go = function () { var inp = bx.querySelector("[data-fb]"), v = inp.value.trim(); if (!v) return; var r = M.ro.filter(function (x) { return String(x.roll) === v || x.mobile === v || (v.length >= 6 && x.mobile.slice(-v.length) === v); })[0]; inp.value = ""; if (!r) { M.last = { ok: false, title: "Student nahi mila", sub: "Is batch me \"" + v + "\" nahi hai" }; return nfcPanel(bx); } apply(r, "m"); };
    bx.querySelector("[data-fbb]").onclick = go; bx.querySelector("[data-fb]").onkeydown = function (ev) { ev.key === "Enter" && go(); };
  }
  function apply(r, via) {
    if (M.sub && !M.edit) { M.last = { ok: false, title: "Attendance submit ho chuki hai", sub: "Pehle \"Edit\" karein" }; return refreshNfc(); }
    var now = Date.now(), cur = M.marks[r.mobile], s = now > M.base.startMs + M.cfg.lateMin * 6e4 ? "L" : "P";
    if (cur === "P" || cur === "L") { M.last = { ok: true, title: r.name, sub: "Pehle se " + (cur === "L" ? "Late" : "Present") + " marked • Roll " + (r.roll || "-") }; return refreshNfc(); }
    M.marks[r.mobile] = s; M.via[r.mobile] = via; M.taps.unshift({ name: r.name, s: s, at: now }); M.last = { ok: true, title: "✔ " + r.name, sub: "Roll " + (r.roll || "-") + " • " + (s === "L" ? "Late" : "Present") };
    try { navigator.vibrate && navigator.vibrate(80); } catch (x) {} draft(); foot(); refreshNfc();
  }
  function refreshNfc() { if (M && M.tab === "nfc") { var bx = document.querySelector("#att-mark .att-body"); bx && nfcPanel(bx); } }
  function onUid(uid) {
    if (!M) return; var c = M.c;
    nfcCard(c, uid).then(function (cd) {
      if (!cd) { M.last = { ok: false, title: "Card linked nahi hai", sub: "UID " + uid + " — NFC Cards me student se jodein" }; return refreshNfc(); }
      var r = M.ro.filter(function (x) { return x.mobile === String(cd.mobile); })[0];
      if (!r) { M.last = { ok: false, title: (cd.name || cd.mobile) + " — is batch ka student nahi", sub: "Ye card dusre batch ka hai" }; return refreshNfc(); }
      apply(r, "n");
    }).catch(function (x) { M.last = { ok: false, title: "Card check nahi hua", sub: (x && (x.code || x.message)) || "" }; refreshNfc(); });
  }

  /* =====================================================================
     ADMIN: Dashboard
     ===================================================================== */
  function stat(cls, ic, n, l) { return '<div class="att-stat ' + cls + '"><span>' + ic + "</span><b>" + n + "</b><small>" + l + "</small></div>"; }
  function ring(p, label) { return '<div class="att-ring" style="--p:' + p + '"><div><b>' + p + '%</b><small>' + label + "</small></div></div>"; }
  function chip(st) { return st === "run" ? '<span class="att-badge run">Ongoing</span>' : st === "up" ? '<span class="att-badge up">Upcoming</span>' : '<span class="att-badge dn">Done</span>'; }
  function sessChip(s, st) {
    if (s && (s.status === "submitted" || s.status === "auto")) { var n = counts(s); return '<span class="att-mk ok">P ' + n.p + " • A " + n.a + " • L " + n.l + "</span>"; }
    if (s) return '<span class="att-mk warn">Chal rahi (adhoori)</span>';
    return st === "up" ? "" : '<span class="att-mk pend">Attendance baaki</span>';
  }
  EXT.adminViews.att_dash = { icon: "🗓️", label: "Attendance", render: function (m, c) {
    m.innerHTML = '<div class="att-empty">Loading…</div>';
    var now = Date.now(), d0 = dayStart(now), today = ymd(now), cl = classesIn(c, d0, d0 + 864e5), bids = Object.keys(cl.reduce(function (o, i) { o[i.batchId] = 1; return o; }, {}));
    EXT.attRefresh = function () { if (guard("att_dash", c)) EXT.adminViews.att_dash.render(document.getElementById("bm-main"), C()); };
    Promise.all([loadCfg(c), sessRange(c, bids, today, today, true)]).then(function (r) {
      var cfg = r[0], ss = r[1];
      return lazyFinalize(c, ss, cfg).then(function () { return ss; });
    }).then(function (ss) {
      if (!guard("att_dash", c)) return;
      var by = {}; ss.forEach(function (s) { by[s.classId] = s; });
      var P = 0, A = 0, L = 0, T = 0, run = 0, up = 0, dn = 0, pend = 0;
      cl.forEach(function (i) {
        var st = stateOf(c, i, now), s = by[i.id], b = (c.A.batches || []).filter(function (x) { return x.id === i.batchId; })[0];
        st === "run" ? run++ : st === "up" ? up++ : dn++;
        if (s) { var n = counts(s); P += n.p; A += n.a; L += n.l; T += s.counts ? s.counts.total : (b && b.enrolledCount) || 0; } else { T += (b && b.enrolledCount) || 0; if (st !== "up") pend++; }
      });
      var rec = P + A + L, rate = rec ? Math.round(100 * (P + L) / rec) : 0;
      var alerts = [];
      ss.filter(function (s) { return s.status === "submitted" || s.status === "auto"; }).sort(function (a, b) { return c.ms(b.submittedAt) - c.ms(a.submittedAt); }).slice(0, 5).forEach(function (s) {
        var n = counts(s); alerts.push('<div class="att-al ok"><i>✔</i><div><b>Attendance ' + (s.status === "auto" ? "Auto-Submitted" : "Submitted") + "</b><small>" + e(bname(c, s.batchId)) + " – " + e(s.subject || s.title) + "<br>Present: " + n.p + " | Absent: " + n.a + " | Late: " + n.l + "</small></div><em>" + e(tm(c.ms(s.submittedAt) || s.startMs)) + "</em></div>");
      });
      if (A) alerts.unshift('<div class="att-al bad"><i>!</i><div><b>' + A + " students absent today</b><small>Absent Students me jaakar parents ko call karein</small></div></div>");
      cl.filter(function (i) { return stateOf(c, i, now) === "done" && !by[i.id]; }).slice(0, 4).forEach(function (i) { alerts.push('<div class="att-al warn"><i>⏰</i><div><b>Attendance baaki</b><small>' + e(bname(c, i.batchId)) + " – " + e(i.subject || i.title) + " • " + e(tm(c.ms(i.scheduledAt))) + "</small></div></div>"); });
      m.innerHTML = '<div class="att-card"><div class="att-h"><div><b>Attendance Overview</b><small>Today, ' + e(dd(now)) + '</small></div></div><div class="att-stats">' + stat("g", "👥", P, "Present") + stat("r", "✖", A, "Absent") + stat("o", "🕒", L, "Late") + stat("b", "👪", T, "Total") + '</div>' +
        '<div class="att-rate">' + ring(rate, "Attendance Rate") + '<div class="att-cs"><b>Classes Status</b><div><i class="dot g"></i>Running <b>' + run + '</b></div><div><i class="dot b"></i>Upcoming <b>' + up + '</b></div><div><i class="dot n"></i>Done <b>' + dn + '</b></div><div><i class="dot o"></i>Attendance baaki <b>' + pend + "</b></div></div></div></div>" +
        '<div class="att-card"><div class="att-h"><b>Aaj ki Classes</b><button class="att-lk" data-go="att_sched">View All →</button></div>' + (cl.length ? cl.map(function (i) { var st = stateOf(c, i, now); return '<div class="att-cls" data-c="' + e(i.id) + '" data-b="' + e(i.batchId) + '"><div class="att-t"><b>' + e(tm(c.ms(i.scheduledAt))) + "</b><small>" + (+i.durationMin || 60) + " min</small></div><div class=\"att-g\"><b>" + e(i.title) + "</b><small>" + e(bname(c, i.batchId)) + (i.subject ? " • " + e(i.subject) : "") + "</small>" + sessChip(by[i.id], st) + "</div>" + chip(st) + "</div>"; }).join("") : '<div class="att-empty">Aaj koi class schedule nahi hai.<br>Class Schedule se jodein.</div>') + "</div>" +
        '<div class="att-card"><div class="att-h"><b>🔔 Notifications</b></div>' + (alerts.length ? alerts.join("") : '<div class="att-empty">Abhi koi notification nahi.</div>') + "</div>";
      m.querySelectorAll("[data-go]").forEach(function (b) { b.onclick = function () { c.adminGo(b.dataset.go); }; });
      m.querySelectorAll("[data-c]").forEach(function (b) { b.onclick = function () { var it = cl.filter(function (i) { return i.id === b.dataset.c; })[0]; it && openMark(c, it); }; });
    }).catch(function (x) { m.innerHTML = '<div class="att-empty">Load nahi hua: ' + e(x && (x.code || x.message) || x) + "<br>Firestore Rules publish kiye?</div>"; });
  } };

  /* =====================================================================
     ADMIN: Class Schedule
     ===================================================================== */
  EXT.adminViews.att_sched = { icon: "📅", label: "Class Schedule", render: function (m, c) {
    var F = c.A.attF = c.A.attF || { r: "today", b: "all" };
    c.topBtn("+ Add Schedule", function () { c.adminGo("class"); });
    var now = Date.now(), d = new Date(now), d0 = dayStart(now), from, to;
    if (F.r === "today") { from = d0; to = d0 + 864e5; } else if (F.r === "week") { var wd = (d.getDay() + 6) % 7; from = d0 - wd * 864e5; to = from + 7 * 864e5; } else { from = new Date(d.getFullYear(), d.getMonth(), 1).getTime(); to = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime(); }
    var cl = classesIn(c, from, to).filter(function (i) { return F.b === "all" || i.batchId === F.b; }), bids = Object.keys(cl.reduce(function (o, i) { o[i.batchId] = 1; return o; }, {}));
    m.innerHTML = '<div class="att-tabs2">' + [["today", "Today"], ["week", "This Week"], ["month", "This Month"]].map(function (t) { return '<button data-r="' + t[0] + '" class="' + (F.r === t[0] ? "on" : "") + '">' + t[1] + "</button>"; }).join("") + '</div><select class="att-sel" data-bf><option value="all">Saare Batch</option>' + (c.A.batches || []).map(function (b) { return '<option value="' + e(b.id) + '"' + (F.b === b.id ? " selected" : "") + ">" + e(b.name) + "</option>"; }).join("") + '</select><div id="att-sl" class="att-empty">Loading…</div>';
    m.querySelectorAll("[data-r]").forEach(function (b) { b.onclick = function () { F.r = b.dataset.r; EXT.adminViews.att_sched.render(m, c); }; });
    m.querySelector("[data-bf]").onchange = function () { F.b = this.value; EXT.adminViews.att_sched.render(m, c); };
    sessRange(c, bids, ymd(from), ymd(to - 1)).then(function (ss) {
      if (!guard("att_sched", c)) return; var by = {}, last = ""; ss.forEach(function (s) { by[s.classId] = s; });
      var box = document.getElementById("att-sl"); if (!box) return; box.className = "";
      box.innerHTML = cl.length ? cl.map(function (i) {
        var st = stateOf(c, i, now), hd = ""; if (F.r !== "today" && ymd(c.ms(i.scheduledAt)) !== last) { last = ymd(c.ms(i.scheduledAt)); hd = '<div class="att-day">' + e(dd(c.ms(i.scheduledAt))) + "</div>"; }
        return hd + '<div class="att-cls" data-c="' + e(i.id) + '" data-b="' + e(i.batchId) + '"><div class="att-t"><b>' + e(tm(c.ms(i.scheduledAt))) + "</b><small>" + (+i.durationMin || 60) + ' min</small></div><div class="att-g"><b>' + e(i.title) + "</b><small>" + e(bname(c, i.batchId)) + (i.subject ? " • " + e(i.subject) : "") + (i.teacher ? " • " + e(i.teacher) : "") + "</small>" + sessChip(by[i.id], st) + "</div>" + chip(st) + "</div>";
      }).join("") : '<div class="att-empty">Is range me koi class nahi. "+ Add Schedule" se jodein.</div>';
      box.querySelectorAll("[data-c]").forEach(function (b) { b.onclick = function () { var it = cl.filter(function (i) { return i.id === b.dataset.c; })[0]; it && openMark(c, it); }; });
    });
  } };

  /* =====================================================================
     ADMIN: Absent Students + Parent calling
     ===================================================================== */
  function waUrl(num, name, what) { return "https://wa.me/91" + num + "?text=" + encodeURIComponent("Namaste, aapka bachha " + name + " aaj " + what + " ki class me absent tha. Kripya sampark karein."); }
  function openTel(n) { var a = document.createElement("a"); a.href = "tel:+91" + n; document.body.appendChild(a); a.click(); a.remove(); }
  EXT.adminViews.att_abs = { icon: "🚫", label: "Absent Students", render: function (m, c) {
    var F = c.A.attA = c.A.attA || { r: "today", b: "all" }, now = Date.now(), d = new Date(now), d0 = dayStart(now), from = d0, to = d0;
    if (F.r === "week") from = d0 - ((d.getDay() + 6) % 7) * 864e5; else if (F.r === "month") from = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
    m.innerHTML = '<div class="att-tabs2">' + [["today", "Today"], ["week", "This Week"], ["month", "This Month"]].map(function (t) { return '<button data-r="' + t[0] + '" class="' + (F.r === t[0] ? "on" : "") + '">' + t[1] + "</button>"; }).join("") + '</div><select class="att-sel" data-bf><option value="all">Saare Batch</option>' + (c.A.batches || []).map(function (b) { return '<option value="' + e(b.id) + '"' + (F.b === b.id ? " selected" : "") + ">" + e(b.name) + "</option>"; }).join("") + '</select><div id="att-al" class="att-empty">Loading…</div>';
    m.querySelectorAll("[data-r]").forEach(function (b) { b.onclick = function () { F.r = b.dataset.r; EXT.adminViews.att_abs.render(m, c); }; });
    m.querySelector("[data-bf]").onchange = function () { F.b = this.value; EXT.adminViews.att_abs.render(m, c); };
    var bids = F.b === "all" ? (c.A.batches || []).map(function (b) { return b.id; }) : [F.b];
    sessRange(c, bids, ymd(from), ymd(to), true).then(function (ss) {
      var map = {};
      ss.forEach(function (s) { Object.keys(s.marks || {}).forEach(function (mob) { if (s.marks[mob] !== "A") return; var k = s.batchId + "|" + mob; (map[k] = map[k] || { b: s.batchId, mobile: mob, cls: [] }).cls.push(s); }); });
      var arr = Object.keys(map).map(function (k) { return map[k]; });
      return Promise.all(bids.map(function (b) { return roster(c, b).catch(function () { return []; }).then(function (ro) { return [b, ro]; }); })).then(function (rs) {
        var rm = {}; rs.forEach(function (x) { x[1].forEach(function (r) { rm[x[0] + "|" + r.mobile] = r; }); });
        arr.forEach(function (a) { var r = rm[a.b + "|" + a.mobile] || { name: a.mobile, roll: "", par: "" }; a.name = r.name; a.roll = r.roll; a.par = r.par; });
        arr.sort(function (x, y) { return y.cls.length - x.cls.length || x.name.localeCompare(y.name); }); return arr;
      });
    }).then(function (arr) {
      if (!guard("att_abs", c)) return; var box = document.getElementById("att-al"); if (!box) return; box.className = "";
      if (!arr.length) { box.innerHTML = '<div class="att-empty">🎉 Is range me koi absent student nahi.</div>'; return; }
      var withPar = arr.filter(function (a) { return a.par; });
      box.innerHTML = '<div class="att-note" style="margin:6px 2px">' + arr.length + " student absent • " + withPar.length + " ke parent ka number hai</div>" + arr.map(function (a, i) {
        var what = a.cls[0].subject || a.cls[0].title;
        return '<div class="att-abrow"><div class="att-av r">' + e((a.name || "?").charAt(0).toUpperCase()) + '</div><div class="att-g"><b>' + e(a.name) + "</b><small>Roll: " + e(a.roll || "-") + " • " + e(bname(c, a.b)) + "<br>Absent: " + a.cls.length + " class" + (a.cls.length > 1 ? "es" : "") + " (" + e(a.cls.slice(0, 3).map(function (s) { return s.subject || s.title; }).join(", ")) + ")</small></div>" +
          (a.par ? '<button class="att-ic" data-call="' + i + '" aria-label="Call parent">📞</button><button class="att-ic wa" data-wa="' + i + '" aria-label="WhatsApp">💬</button>' : '<small class="att-note">Parent no. nahi</small>') + "</div>";
      }).join("") + (withPar.length ? '<button class="att-b" style="width:100%;margin-top:10px" data-all>📞 Call All Parents (' + withPar.length + ")</button>" : "");
      box.querySelectorAll("[data-call]").forEach(function (b) { b.onclick = function () { openTel(arr[+b.dataset.call].par); }; });
      box.querySelectorAll("[data-wa]").forEach(function (b) { b.onclick = function () { var a = arr[+b.dataset.wa]; window.open(waUrl(a.par, a.name, a.cls[0].subject || a.cls[0].title), "_blank", "noopener"); }; });
      var all = box.querySelector("[data-all]"); all && (all.onclick = function () { callAll(withPar); });
    }).catch(function (x) { var box = document.getElementById("att-al"); box && (box.innerHTML = "Load nahi hua: " + e(x && (x.code || x.message) || x)); });
  } };
  /* browser ek saath sabko dial nahi kar sakta — isliye ek-ek karke: Call -> Next */
  function callAll(list) {
    var i = 0, md = document.createElement("div"); md.className = "att-modal";
    function paint() {
      var a = list[i]; if (!a) { md.remove(); return; }
      md.innerHTML = '<div class="att-sheet"><small>' + (i + 1) + " / " + list.length + "</small><h3>" + e(a.name) + "</h3><p class=\"att-note\">Roll " + e(a.roll || "-") + " • " + e(a.cls[0].subject || a.cls[0].title) + "<br>Parent: +91 " + e(a.par) + '</p><div class="att-acts"><button class="att-b" data-c>📞 Call Parent</button><button class="att-b sec" data-w>💬 WhatsApp</button></div><div class="att-acts"><button class="att-b sec" data-n>' + (i + 1 < list.length ? "Next →" : "Done") + '</button><button class="att-b red" data-x>Band</button></div></div>';
      md.querySelector("[data-c]").onclick = function () { openTel(a.par); }; md.querySelector("[data-w]").onclick = function () { window.open(waUrl(a.par, a.name, a.cls[0].subject || a.cls[0].title), "_blank", "noopener"); };
      md.querySelector("[data-n]").onclick = function () { i++; paint(); }; md.querySelector("[data-x]").onclick = function () { md.remove(); };
    }
    document.body.appendChild(md); paint();
  }

  /* =====================================================================
     ADMIN: Reports (+ CSV)
     ===================================================================== */
  EXT.adminViews.att_rep = { icon: "📊", label: "Attendance Reports", render: function (m, c) {
    var F = c.A.attR = c.A.attR || { b: (c.A.batches[0] || {}).id || "", f: ymd(new Date(new Date().getFullYear(), new Date().getMonth(), 1)), t: ymd(Date.now()) };
    m.innerHTML = '<div class="att-card"><div class="att-fr"><select data-b>' + (c.A.batches || []).map(function (b) { return '<option value="' + e(b.id) + '"' + (F.b === b.id ? " selected" : "") + ">" + e(b.name) + "</option>"; }).join("") + '</select><input type="date" data-f value="' + e(F.f) + '"><input type="date" data-t value="' + e(F.t) + '"><button class="att-b" data-go>Dikhayein</button></div></div><div id="att-rp"></div>';
    var go = function () {
      F.b = m.querySelector("[data-b]").value; F.f = m.querySelector("[data-f]").value; F.t = m.querySelector("[data-t]").value; var box = document.getElementById("att-rp");
      if (!F.b) { box.innerHTML = '<div class="att-empty">Pehle batch banayein</div>'; return; }
      box.innerHTML = '<div class="att-empty">Loading…</div>';
      Promise.all([sessRange(c, [F.b], F.f, F.t, true), roster(c, F.b)]).then(function (r) {
        var ss = r[0].filter(function (s) { return s.status === "submitted" || s.status === "auto"; }).sort(function (a, b) { return a.startMs - b.startMs; }), ro = r[1];
        var rows = ro.map(function (s) { var p = 0, a = 0, l = 0; ss.forEach(function (x) { var v = (x.marks || {})[s.mobile]; v === "P" ? p++ : v === "A" ? a++ : v === "L" ? l++ : 0; }); var tot = p + a + l; return { s: s, p: p, a: a, l: l, tot: tot, pc: tot ? Math.round(100 * (p + l) / tot) : 0 }; });
        box.innerHTML = '<div class="att-card"><div class="att-h"><b>Student-wise</b><button class="att-b sm sec" data-csv>⬇ CSV</button></div><div class="att-tw"><table class="att-tb"><tr><th>Roll</th><th>Student</th><th>P</th><th>A</th><th>L</th><th>%</th></tr>' + (rows.length ? rows.map(function (x) { return "<tr><td>" + e(x.s.roll || "-") + "</td><td>" + e(x.s.name) + "</td><td>" + x.p + "</td><td>" + x.a + "</td><td>" + x.l + "</td><td><b" + (x.tot && x.pc < 75 ? ' class="lo"' : "") + ">" + (x.tot ? x.pc + "%" : "—") + "</b></td></tr>"; }).join("") : '<tr><td colspan="6">Koi student nahi</td></tr>') + "</table></div></div>" +
          '<div class="att-card"><div class="att-h"><b>Class-wise</b></div><div class="att-tw"><table class="att-tb"><tr><th>Date</th><th>Class</th><th>P</th><th>A</th><th>L</th></tr>' + (ss.length ? ss.map(function (s) { var n = counts(s); return "<tr><td>" + e(s.date) + "</td><td>" + e(s.subject || s.title) + "</td><td>" + n.p + "</td><td>" + n.a + "</td><td>" + n.l + "</td></tr>"; }).join("") : '<tr><td colspan="5">Is range me submit hui koi attendance nahi</td></tr>') + "</table></div></div>";
        box.querySelector("[data-csv]").onclick = function () {
          var q = function (t) { return '"' + String(t == null ? "" : t).replace(/"/g, '""') + '"'; };
          var csv = "Roll,Student,Mobile,Present,Absent,Late,Percent\n" + rows.map(function (x) { return [x.s.roll, x.s.name, x.s.mobile, x.p, x.a, x.l, x.tot ? x.pc : ""].map(q).join(","); }).join("\n");
          var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv" })); a.download = "attendance-" + String(bname(c, F.b)).replace(/\W+/g, "_") + "-" + F.f + "_" + F.t + ".csv"; a.click();
        };
      }).catch(function (x) { box.innerHTML = '<div class="att-empty">Load nahi hua: ' + e(x && (x.code || x.message) || x) + "</div>"; });
    };
    m.querySelector("[data-go]").onclick = go; go();
  } };

  /* =====================================================================
     ADMIN: NFC Cards & Settings
     ===================================================================== */
  function loadCards(c) {
    return c.DB().collection("institutes").doc(inst(c)).collection("nfcCards").where("instituteId", "==", inst(c)).get().then(function (q) {
      X.byMob = {}; q.docs.forEach(function (d) { var v = d.data(); X.cards[d.id] = v; X.byMob[String(v.mobile)] = d.id; }); return X.byMob;
    });
  }
  EXT.adminViews.att_set = { icon: "📡", label: "NFC Cards & Settings", render: function (m, c) {
    var F = c.A.attS = c.A.attS || { b: (c.A.batches[0] || {}).id || "" };
    m.innerHTML = '<div class="att-note">⚙️ Attendance settings (GPS, QR, Late, Notifications) ab <b>Settings → Attendance Settings</b> tab me hain.</div>' +
      '<div class="att-card"><div class="att-h"><b>📡 NFC ID Cards</b></div><div class="att-note">NFC: ' + (NFC.kind() === "native" ? "App plugin mila ✔" : NFC.kind() === "web" ? "Chrome Web NFC ✔" : "Is device/app me available nahi — UID haath se likh kar bhi jod sakte hain") + '</div><select class="att-sel" data-b>' + (c.A.batches || []).map(function (b) { return '<option value="' + e(b.id) + '"' + (F.b === b.id ? " selected" : "") + ">" + e(b.name) + "</option>"; }).join("") + '</select><div id="att-cl" class="att-empty">Loading…</div></div>';
    loadCfg(c).then(function (cfg) { var l = m.querySelector("[data-late]"), a = m.querySelector("[data-auto]"); if (l) { l.value = cfg.lateMin; a.value = cfg.autoMin; } });
    var legSave = m.querySelector("[data-save]"); if (legSave) legSave.onclick = function () {
      var l = Math.max(0, +m.querySelector("[data-late]").value || 0), a = Math.max(1, +m.querySelector("[data-auto]").value || DEF.autoMin);
      cfgRef(c).set({ lateMin: l, autoMin: a, updatedAt: c.FV().serverTimestamp(), by: c.adminEmail() }, { merge: true }).then(function () { X.cfg = { lateMin: l, autoMin: a }; X.cfgInst = inst(c); c.toast("✅ Settings save ho gayi"); }).catch(function (x) { c.toast("Save nahi hua: " + (x.code || x.message)); });
    };
    m.querySelector("[data-b]").onchange = function () { F.b = this.value; paint(); };
    function paint() {
      var box = document.getElementById("att-cl"); if (!box || !F.b) { box && (box.innerHTML = "Pehle batch banayein"); return; }
      Promise.all([roster(c, F.b), X.byMob ? Promise.resolve(X.byMob) : loadCards(c)]).then(function (r) {
        var ro = r[0], bm = r[1]; if (!guard("att_set", c)) return; box.className = "";
        box.innerHTML = ro.length ? ro.map(function (s, i) { var u = bm[s.mobile]; return '<div class="att-abrow"><div class="att-av">' + e((s.name || "?").charAt(0).toUpperCase()) + '</div><div class="att-g"><b>' + e(s.name) + "</b><small>Roll: " + e(s.roll || "-") + " • " + (u ? "Card: …" + e(u.slice(-6)) : "Card linked nahi") + "</small></div>" + (u ? '<button class="att-b sm red" data-un="' + i + '">Unlink</button>' : "") + '<button class="att-b sm" data-ln="' + i + '">' + (u ? "Change" : "Link") + "</button></div>"; }).join("") : '<div class="att-empty">Is batch me abhi koi student nahi</div>';
        box.querySelectorAll("[data-ln]").forEach(function (b) { b.onclick = function () { linkCard(c, ro[+b.dataset.ln], paint); }; });
        box.querySelectorAll("[data-un]").forEach(function (b) { b.onclick = function () { var s = ro[+b.dataset.un], u = X.byMob[s.mobile]; if (!u || !c.sure(s.name + " ka card unlink karein?")) return; c.DB().collection("institutes").doc(inst(c)).collection("nfcCards").doc(u).delete().then(function () { delete X.cards[u]; delete X.byMob[s.mobile]; c.toast("Unlink ho gaya"); paint(); }).catch(function (x) { c.toast("Nahi hua: " + (x.code || x.message)); }); }; });
      }).catch(function (x) { box.innerHTML = "Load nahi hua: " + e(x && (x.code || x.message) || x); });
    }
    paint();
  } };
  function linkCard(c, s, done) {
    var md = document.createElement("div"); md.className = "att-modal";
    md.innerHTML = '<div class="att-sheet"><h3>' + e(s.name) + ' ka card jodein</h3><p class="att-note" data-msg>' + (NFC.kind() ? "Card phone ke peeche lagayein…" : "NFC available nahi — UID neeche likhein (hex)") + '</p><input data-uid placeholder="Card UID (jaise 04A1B2C3)" class="att-search"><div class="att-acts"><button class="att-b" data-ok>Save</button><button class="att-b sec" data-x>Cancel</button></div></div>';
    document.body.appendChild(md);
    var close = function () { NFC.stop(); md.remove(); }, msg = md.querySelector("[data-msg]");
    function save(uid) {
      uid = NFC.norm(uid); if (uid.length < 4) { msg.textContent = "UID sahi nahi lag raha"; return; }
      var ref = c.DB().collection("institutes").doc(inst(c)).collection("nfcCards").doc(uid);
      ref.get().then(function (d) {
        if (d.exists && String(d.data().mobile) !== String(s.mobile) && !c.sure("Ye card pehle se " + (d.data().name || d.data().mobile) + " se linked hai. Badal dein?")) return;
        var old = X.byMob && X.byMob[s.mobile], ops = [ref.set({ mobile: String(s.mobile), name: s.name, instituteId: inst(c), linkedBy: c.adminEmail(), linkedAt: c.FV().serverTimestamp() })];
        if (old && old !== uid) ops.push(c.DB().collection("institutes").doc(inst(c)).collection("nfcCards").doc(old).delete());
        return Promise.all(ops).then(function () { X.byMob = null; X.cards = {}; c.toast("✅ Card link ho gaya"); close(); done(); });
      }).catch(function (x) { msg.textContent = "Nahi hua: " + (x.code || x.message); });
    }
    md.querySelector("[data-ok]").onclick = function () { save(md.querySelector("[data-uid]").value); }; md.querySelector("[data-x]").onclick = close;
    NFC.kind() && NFC.start(function (uid) { msg.textContent = "Card mila: " + uid; save(uid); }, function (x) { msg.textContent = (x && x.message) || "NFC chalu nahi hua"; });
  }

  /* =====================================================================
     STUDENT: "Attendance" tab
     ===================================================================== */
  EXT.studentTabs.attendance = { label: "Attendance", render: function (b, box, c) {
    var s = c.sess && c.sess(); if (!s || !s.mobile) { box.innerHTML = '<div class="att-empty">Login karein</div>'; return; }
    var St = EXT.studentTabs.attendance.st = EXT.studentTabs.attendance.st || { mode: "monthly", off: 0, full: false }, now = new Date();
    function mkey(off) { var d = new Date(now.getFullYear(), now.getMonth() + off, 1); return d.getFullYear() + p2(d.getMonth() + 1); }
    function get(k) { return bsub(c, b.id, "attendanceStudents").doc(s.mobile + "_" + k).get().then(function (d) { return d.exists ? d.data().days || {} : {}; }).catch(function (x) { if (x && x.code === "permission-denied") throw x; return {}; }); }
    box.innerHTML = '<div class="att-empty">Loading…</div>';
    Promise.all([get(mkey(St.off)), get(mkey(St.off - 1))]).then(function (r) {
      var cur = r[0], prev = r[1], all = [];
      var fromMap = function (mp) { Object.keys(mp).forEach(function (k) { var v = mp[k]; all.push({ id: k, s: v.s, d: v.d, st: v.st, t: v.t, k: v.k }); }); };
      var ents;
      if (St.mode === "monthly") { fromMap(cur); ents = all; }
      else { fromMap(cur); fromMap(prev); var td = ymd(Date.now()), w0 = ymd(Date.now() - 6 * 864e5); ents = all.filter(function (x) { return St.mode === "daily" ? x.d === td : x.d >= w0 && x.d <= td; }); }
      ents.sort(function (a, z) { return z.st - a.st; });
      var P = 0, A = 0, L = 0; ents.forEach(function (x) { x.s === "P" ? P++ : x.s === "A" ? A++ : x.s === "L" ? L++ : 0; });
      var tot = P + A + L, pc = tot ? Math.round(100 * (P + L) / tot) : 0, mdate = new Date(now.getFullYear(), now.getMonth() + St.off, 1);
      var show = St.full ? ents : ents.slice(0, 6);
      box.innerHTML = '<div class="att-tabs2">' + [["daily", "Daily"], ["weekly", "Weekly"], ["monthly", "Monthly"]].map(function (t) { return '<button data-md="' + t[0] + '" class="' + (St.mode === t[0] ? "on" : "") + '">' + t[1] + "</button>"; }).join("") + "</div>" +
        '<div class="att-card att-cen">' + (St.mode === "monthly" ? '<div class="att-mn"><button data-o="-1">‹</button><b>' + e(mdate.toLocaleDateString("en-IN", { month: "long", year: "numeric" })) + '</b><button data-o="1"' + (St.off >= 0 ? " disabled" : "") + ">›</button></div>" : "") + ring(pc, St.mode === "monthly" ? "This Month" : St.mode === "weekly" ? "Last 7 days" : "Today") + '<div class="att-stats3"><div class="g"><b>' + P + "</b><small>Present</small></div><div class=\"r\"><b>" + A + "</b><small>Absent</small></div><div class=\"o\"><b>" + L + "</b><small>Late</small></div></div></div>" +
        '<div class="att-card">' + (show.length ? show.map(function (x) { return '<div class="att-hrow"><div class="att-g"><b>' + e(x.t || "Class") + "</b><small>" + e(x.d) + (x.st ? " • " + e(tm(x.st)) : "") + (x.k ? " • " + e(x.k) : "") + '</small></div><span class="att-pill ' + (x.s || "").toLowerCase() + '">' + (x.s === "P" ? "Present" : x.s === "A" ? "Absent" : "Late") + "</span></div>"; }).join("") : '<div class="att-empty">Is period ki attendance abhi nahi hai.</div>') + (ents.length > 6 ? '<button class="att-b sec" style="width:100%;margin-top:8px" data-full>' + (St.full ? "Kam dikhayein" : "View Full History") + "</button>" : "") + "</div>";
      box.querySelectorAll("[data-md]").forEach(function (x) { x.onclick = function () { St.mode = x.dataset.md; St.full = false; if (St.mode !== "monthly") St.off = 0; EXT.studentTabs.attendance.render(b, box, c); }; });
      box.querySelectorAll("[data-o]").forEach(function (x) { x.onclick = function () { St.off += +x.dataset.o; EXT.studentTabs.attendance.render(b, box, c); }; });
      var fb = box.querySelector("[data-full]"); fb && (fb.onclick = function () { St.full = !St.full; EXT.studentTabs.attendance.render(b, box, c); });
    }).catch(function (x) { box.innerHTML = '<div class="att-empty">' + (x && x.code === "permission-denied" ? "Attendance abhi available nahi hai — admin se sampark karein." : "Load nahi hua") + "</div>"; });
  } };

  /* ---------------- batch ko push (sab ko ek jaisa message; kisi ka Present/Absent yahan nahi jaata) ---------------- */
  function pushBatch(c, b, base) {
    try {
      var V = window.SnapV169; if (!V || !V.notifyBatch) return;
      V.notifyBatch(b, "attendance", "📋 Attendance lag gayi", (base.subject || base.title || "Class") + " (" + tm(base.startMs) + ") — apna Present/Absent status app me dekhein");
    } catch (x) { console.warn("[attendance] push", x); }
  }

  /* =====================================================================
     STUDENT HOME: batch ke andar + My Batches cards par apni attendance
     (kitni class chali, kitni attend ki, Present / Absent / Late, kitne din aaya)
     ===================================================================== */
  var SS = { cache: {} };
  function myMobile(c) { var s = c.sess && c.sess(); return s && s.mobile ? String(s.mobile) : ""; }
  function monthKeys(c, b) {
    var now = new Date(), st = b && b.createdAt ? c.ms(b.createdAt) : 0, from = st ? new Date(st) : new Date(now.getFullYear(), now.getMonth() - 5, 1);
    var floor = new Date(now.getFullYear(), now.getMonth() - 11, 1); if (from < floor) from = floor;
    var out = [], d = new Date(from.getFullYear(), from.getMonth(), 1);
    while (d <= now && out.length < 12) { out.push(d.getFullYear() + p2(d.getMonth() + 1)); d = new Date(d.getFullYear(), d.getMonth() + 1, 1); }
    return out;
  }
  function loadMy(c, b, force) {
    var m = myMobile(c); if (!m) return Promise.reject({ code: "no-session" });
    var key = m + "|" + b.id, z = SS.cache[key];
    if (!force && z && Date.now() - z.t < 90000) return Promise.resolve(z.v);
    if (z && z.p) return z.p;
    var p = Promise.all(monthKeys(c, b).map(function (k) {
      return bsub(c, b.id, "attendanceStudents").doc(m + "_" + k).get().then(function (d) { return d.exists ? d.data().days || {} : {}; })
        .catch(function (x) { if (x && x.code === "permission-denied") throw x; return {}; });
    })).then(function (parts) {
      var ents = [], seen = {};
      parts.forEach(function (mp) { Object.keys(mp).forEach(function (k) { var v = mp[k]; if (seen[k]) return; seen[k] = 1; ents.push({ id: k, s: v.s, d: v.d, st: v.st || 0, t: v.t, k: v.k }); }); });
      ents.sort(function (a, z2) { return z2.st - a.st; });
      var P = 0, A = 0, L = 0, days = {}, pdays = {};
      ents.forEach(function (x) { if (x.s === "P") P++; else if (x.s === "A") A++; else if (x.s === "L") L++; else return; days[x.d] = 1; if (x.s !== "A") pdays[x.d] = 1; });
      var held = P + A + L, att = P + L, nd = Object.keys(days).length, npd = Object.keys(pdays).length;
      var v = { ents: ents, p: P, a: A, l: L, held: held, att: att, pc: held ? Math.round(100 * att / held) : 0, days: nd, pdays: npd, adays: nd - npd, last: ents[0] || null };
      SS.cache[key] = { t: Date.now(), v: v }; return v;
    });
    SS.cache[key] = { t: z ? z.t : 0, v: z ? z.v : null, p: p };
    p.then(function () { }, function () { delete SS.cache[key]; });
    return p;
  }
  function pcCls(pc) { return pc >= 75 ? "g" : pc >= 50 ? "o" : "r"; }
  function stTxt(s) { return s === "P" ? "Present ✅" : s === "L" ? "Late ⏰ (present)" : "Absent ❌"; }
  function summaryHtml(v) {
    if (!v || !v.held) return '<div class="att-card"><div class="att-h"><b>📋 Meri Attendance</b></div><div class="att-empty" style="padding:10px">Abhi is batch ki attendance shuru nahi hui.</div></div>';
    var last = v.last;
    return '<div class="att-card att-mysum"><div class="att-h"><b>📋 Meri Attendance</b><button class="att-lk" data-att-more>Details →</button></div>' +
      '<div class="att-mys"><div class="att-ring" style="--p:' + v.pc + '"><div><b>' + v.pc + '%</b><small>Attendance</small></div></div>' +
      '<div class="att-mysg"><div><b>' + v.held + '</b><small>Class chali</small></div><div><b>' + v.att + '</b><small>Attend ki</small></div><div class="g"><b>' + v.p + '</b><small>Present</small></div><div class="r"><b>' + v.a + '</b><small>Absent</small></div><div class="o"><b>' + v.l + '</b><small>Late</small></div><div><b>' + v.pdays + '/' + v.days + '</b><small>Din aaye</small></div></div></div>' +
      (last ? '<div class="att-mylast ' + (last.s === "A" ? "bad" : "ok") + '"><small>Pichli class</small><b>' + e(last.t || "Class") + (last.k ? " • " + e(last.k) : "") + '</b><span>' + e(last.d || "") + (last.st ? " • " + e(tm(last.st)) : "") + " — " + stTxt(last.s) + "</span></div>" : "") + "</div>";
  }
  /* student ko naya Present/Absent batana: pehli baar sirf pichle 24 ghante ki entries; baad me jo naya aaye */
  function notifyNew(c, b, v) {
    try {
      var m = myMobile(c); if (!m || !v) return;
      var k = "att_seen_" + m + "_" + b.id, seen = SS.seen && SS.seen[k] || null; try { if (!seen) seen = JSON.parse(localStorage.getItem(k) || "null"); } catch (x) {}
      var now = Date.now(); if (!seen) seen = v.ents.filter(function (x) { return x.st < now - 864e5; }).map(function (x) { return x.id; });
      var set = {}; seen.forEach(function (id) { set[id] = 1; });
      var fresh = v.ents.filter(function (x) { return !set[x.id] && (x.s === "P" || x.s === "A" || x.s === "L"); });
      var ids = v.ents.slice(0, 300).map(function (x) { return x.id; }); (SS.seen = SS.seen || {})[k] = ids;   /* storage na chale to bhi baar-baar toast na aaye */
      try { localStorage.setItem(k, JSON.stringify(ids)); } catch (x) {}
      fresh.slice(0, 3).forEach(function (x, i) { setTimeout(function () { try { c.toast("📋 " + bname(c, b.id) + " • " + (x.t || "Class") + " — aap " + stTxt(x.s)); } catch (y) {} }, i * 2600); });
      if (fresh.length > 3) setTimeout(function () { try { c.toast("📋 +" + (fresh.length - 3) + " aur attendance update — Attendance tab dekhein"); } catch (y) {} }, 3 * 2600);
    } catch (x) { console.warn("[attendance] notifyNew", x); }
  }
  EXT.hooks.overview = function (b, el, c) {
    var m = myMobile(c); if (!m || !el) return;
    var z = SS.cache[m + "|" + b.id]; if (z && z.v) el.innerHTML = summaryHtml(z.v); else el.innerHTML = '<div class="att-card"><div class="att-empty" style="padding:10px">Attendance load ho rahi hai…</div></div>';
    var wire = function () { var bt = el.querySelector("[data-att-more]"); bt && (bt.onclick = function () { c.S.tab = "attendance"; c.sBatch(b.id); }); };
    wire();
    loadMy(c, b).then(function (v) { if (!el.isConnected) return; el.innerHTML = summaryHtml(v); wire(); notifyNew(c, b, v); })
      .catch(function (x) { if (el.isConnected) el.innerHTML = ""; });
  };
  EXT.hooks.cards = function (list, root, c) {
    var m = myMobile(c); if (!m) return;
    (list || []).forEach(function (b) {
      var el = root.querySelector('[data-xc="' + b.id + '"]'); if (!el) return;
      var paint = function (v) { if (!el.isConnected) return; el.innerHTML = v && v.held ? '<span class="att-chip ' + pcCls(v.pc) + '">📋 ' + v.pc + '% • ' + v.att + '/' + v.held + ' class attend</span>' : ""; };
      var z = SS.cache[m + "|" + b.id]; if (z && z.v) paint(z.v);
      loadMy(c, b).then(function (v) { paint(v); notifyNew(c, b, v); }).catch(function () { });
    });
  };
  /* app khulte hi / wapas aate hi check (batch screen na bhi khuli ho): purana prefetchBatch hook chain karke */
  (function () {
    var prev = EXT.prefetchBatch;
    EXT.prefetchBatch = function (b, c) {
      var a = null; try { a = prev && prev(b, c); } catch (x) {}
      var mine = loadMy(c, b, true).then(function (v) { notifyNew(c, b, v); }).catch(function () { });
      return a && a.then ? Promise.all([a, mine]) : mine;
    };
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) return;
      try { var c = C(), S = c.S; if (!myMobile(c)) return; (S.batches || []).slice(0, 3).forEach(function (b) { loadMy(c, b, true).then(function (v) { notifyNew(c, b, v); }).catch(function () { }); }); } catch (x) { }
    });
  })();

  window.SnapAttendance = { open: openMark, openLegacy: function (c, it) { openMark(c, it, true); }, nfc: NFC,
    x: { baseOf: baseOf, classesIn: classesIn, roster: roster, sessRange: sessRange, counts: counts, clearCache: function () { X.sc = {}; X.ro = {}; } } };
})();
