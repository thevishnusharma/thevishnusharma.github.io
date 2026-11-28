/* SnapTest Pro — Smart Attendance v2 (GPS + Dynamic QR + Manual)  — ADMIN side
   attendance-system.js ke BAAD load hota hai aur uske views ko upgrade karta hai (purani file/data nahi tootta).
   Admin views : att_dash (Overview) | att_live (Start Session / Live QR) | att_manual | att_pend (Pending Review)
                 att_sched, att_abs (purane, jaise the) | att_stu (Student Profile) | att_rep (Reports) | att_cfg (Settings)
                 att_set (NFC Cards) | att_audit (Audit Log + Notifications)
   Server      : Cloudflare Worker  {workerUrl}/attendance/*  (QR token, verify, manual, review, end, finalize, settings)
   Data        : institutes/{i}/batches/{b}/attendanceSessions/{sid}   attendanceRecords/{sid}_{mobile}   attendanceLive/{sid}
                 institutes/{i}/attendanceAudit/*   attendanceNotifications/*   batchSettings/attendance
   Kill-switch : SNAP_CONFIG.attendance = false */
(function () {
  "use strict";
  var SB = window.SnapBatch, OLD = window.SnapAttendance;
  if (!SB || !SB.ext || !OLD || !OLD.x) { console.warn("[attendance-v2] attendance-system.js pehle load hona chahiye"); return; }
  if ((window.SNAP_CONFIG || {}).attendance === false) return;
  var EXT = SB.ext, H = OLD.x, V = { pre: null, live: null, man: null, stu: null, cfg: null, cfgAt: 0, sc: {} };
  var DEFC = { geoEnabled: true, lat: 0, lng: 0, radiusM: 150, maxAccM: 50, locPolicy: "pending", retry: true, qrEnabled: true, qrRotateSec: 30, qrValiditySec: 30, qrGraceSec: 10, startTime: "00:00", endTime: "23:59", lateMin: 10, autoMin: 15, manualEnabled: true, teacherCorrection: true, pendingPolicy: "review", notify: { enabled: true, present: false, absent: true, late: false } };

  /* ---------------- helpers ---------------- */
  function C() { return SB.ctx(); }
  function e(t) { return String(t == null ? "" : t).replace(/[&<>"']/g, function (x) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[x]; }); }
  function p2(n) { return (n < 10 ? "0" : "") + n; }
  function ymd(t) { var d = new Date(t); return d.getFullYear() + "-" + p2(d.getMonth() + 1) + "-" + p2(d.getDate()); }
  function tm(t) { return t ? new Date(t).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }) : "—"; }
  function dd(t) { return new Date(t).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }); }
  function dayStart(t) { var d = new Date(t); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); }
  function inst(c) { return c.A.inst; }
  function bsub(c, b, n) { return c.bref(c.A.inst, b).collection(n); }
  function isub(c, n) { return c.DB().collection("institutes").doc(inst(c)).collection(n); }
  function bname(c, id) { try { return c.batchName(id) || id; } catch (x) { return id; } }
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return [].slice.call((r || document).querySelectorAll(s)); }
  function flat(a) { return a.reduce(function (s, x) { return s.concat(x); }, []); }
  function guard(v, c) { return (c.A.view === v || (c.A.attSub === v && (c.A.attHost === c.A.view || (c.A.view === "att" && c.A.attHost === "att_take")))) && document.getElementById("bm-main"); }
  var HOSTOF = {};   /* child view -> sidebar host */
  function curB(c) { return c.A.wsOn ? c.A.f.batch : ""; }
  function go(c, k) {
    var h = HOSTOF[k] || k; c.A.attTab = c.A.attTab || {}; if (HOSTOF[k]) c.A.attTab[h] = k;
    if (h === "att_take" && c.wsOpen) { var b = (V.pre && V.pre.b) || curB(c) || (c.A.batches[0] || {}).id; if (b) return c.wsOpen(b, "att"); }   /* QR / Manual / Pending hamesha batch ke andar */
    c.adminGo(h);
  }
  function toast(c, t) { try { c.toast(t); } catch (x) { alert(t); } }
  function safeId(s) { return String(s).replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 100); }
  var LBL = { present: "Present", absent: "Absent", late: "Late", pending: "Pending", u: "Not Marked" };
  var PILL = { present: "p", absent: "a", late: "l", pending: "w", u: "u" };
  var METH = { gps_qr: "GPS+QR", manual: "Manual", admin_correction: "Correction", auto_final: "Auto (final)", nfc: "NFC", qr: "GPS+QR" };
  var REASON = { gps_missing: "Location nahi mili", gps_denied: "Location permission nahi di", gps_accuracy: "GPS accuracy kam", gps_stale: "Location purani", outside: "School area se bahar", geo_not_configured: "School location set nahi", camera: "Camera nahi chala", qr_failed: "QR scan fail", qr_expired: "QR expire", other: "Technical issue" };
  function pill(st) { return '<span class="av2-pill ' + (PILL[st] || "u") + '">' + (LBL[st] || st) + "</span>"; }
  function csvCell(v) { v = String(v == null ? "" : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
  function legacyToStatus(v) { return v === "P" ? "present" : v === "A" ? "absent" : v === "L" ? "late" : ""; }

  function AUTH() { try { return typeof getAuth === "function" ? getAuth() : window.vishnuFirebase && window.vishnuFirebase.auth; } catch (x) { return null; } }
  function api(op, body) {
    var a = AUTH(), u = a && a.currentUser;
    if (!u) return Promise.reject(new Error("Login nahi hai"));
    return u.getIdToken().then(function (t) {
      var w = String((window.SNAP_CONFIG || {}).workerUrl || "").replace(/\/+$/, ""); if (!w) throw new Error("Worker URL set nahi hai (SNAP_CONFIG.workerUrl)");
      return fetch(w + "/attendance/" + op, { method: "POST", headers: { Authorization: "Bearer " + t, "Content-Type": "application/json" }, body: JSON.stringify(body || {}), cache: "no-store" });
    }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok || j.ok === false) { var er = new Error(j.error || "Request fail " + r.status); er.data = j; er.status = r.status; throw er; } return j; }); });
  }
  function dlg(html, mount) {
    var o = document.createElement("div"); o.className = "av2-modal"; o.innerHTML = '<div class="av2-sheet">' + html + "</div>";
    document.body.appendChild(o); var close = function () { o.remove(); };
    o.addEventListener("click", function (ev) { if (ev.target === o) close(); });
    mount && mount(o.firstChild, close); return close;
  }
  function confirmD(title, msg, okLabel, cb, reason) {
    dlg("<h3>" + e(title) + "</h3><p>" + e(msg) + "</p>" + (reason ? '<textarea data-r placeholder="Kaaran likhein (zaroori)" maxlength="300"></textarea>' : "") + '<div class="av2-acts"><button class="av2-b ghost" data-n>Cancel</button><button class="av2-b" data-y>' + e(okLabel || "Haan") + "</button></div>", function (s, close) {
      s.querySelector("[data-n]").onclick = close;
      s.querySelector("[data-y]").onclick = function () { var r = reason ? s.querySelector("[data-r]").value.trim() : ""; if (reason && r.length < 3) { s.querySelector("[data-r]").style.borderColor = "#dc2626"; return; } close(); cb(r); };
    });
  }
  function loadCfg(c, force) {
    if (!force && V.cfg && Date.now() - V.cfgAt < 60000 && V.cfgI === inst(c)) return Promise.resolve(V.cfg);
    return isub(c, "batchSettings").doc("attendance").get().then(function (d) { var v = d.exists ? d.data() : {}; V.cfg = Object.assign({}, DEFC, v, { notify: Object.assign({}, DEFC.notify, v.notify || {}) }); V.cfgAt = Date.now(); V.cfgI = inst(c); return V.cfg; });
  }
  function bids(c, f) { if (f && f !== "all") return [f]; var cb = curB(c); return cb ? [cb] : (c.A.batches || []).map(function (b) { return b.id; }); }
  function batchSelect(c, val, all) { return '<select data-b>' + (all ? '<option value="all">Sabhi Batch</option>' : "") + (c.A.batches || []).map(function (b) { return '<option value="' + e(b.id) + '"' + (b.id === val ? " selected" : "") + ">" + e(b.name) + "</option>"; }).join("") + "</select>"; }
  function statusOf(rec, legacy) { return rec ? rec.status : legacy ? legacyToStatus(legacy) : ""; }

  /* session identity: scheduled class => class id, warna extra session */
  function sessionFor(c, b, it, x, date) {
    if (it) { var base = H.baseOf(c, it); return { sid: safeId(it.id), classId: it.id, title: base.title, subject: base.subject, teacher: base.teacher, startMs: base.startMs, endMs: base.endMs, date: base.date, period: x && x.period || "" }; }
    var now = Date.now(), d = date || ymd(now), per = safeId(x.period || "t" + p2(new Date(now).getHours()) + p2(new Date(now).getMinutes()));
    return { sid: safeId("x_" + d.replace(/-/g, "") + "_" + per + "_" + b), classId: "", title: x.title || "Extra session", subject: x.subject || "", teacher: x.teacher || "", startMs: now, endMs: now + 36e5, date: d, period: x.period || "" };
  }
  function sessBody(b, s) { return { batchId: b, sessionId: s.sid, classId: s.classId, title: s.title, subject: s.subject, teacher: s.teacher, period: s.period, date: s.date, startMs: s.startMs, endMs: s.endMs }; }

  /* classes for a date across selected batches (+ already-existing sessions) */
  function dayClasses(c, date, bs) {
    var d0 = new Date(date + "T00:00:00").getTime();
    return H.classesIn(c, d0, d0 + 864e5).filter(function (i) { return bs.indexOf(i.batchId) >= 0; });
  }
  function recsOf(c, b, sid) { return bsub(c, b, "attendanceRecords").where("sessionId", "==", sid).get().then(function (q) { var m = {}; q.docs.forEach(function (d) { m[d.data().mobile] = Object.assign({ id: d.id }, d.data()); }); return m; }); }

  /* =====================================================================
     OVERVIEW
     ===================================================================== */
  function trendLoad(c, bs, days) {
    var to = ymd(Date.now()), from = ymd(Date.now() - days * 864e5), k = bs.join(",") + from;
    if (V.sc[k] && Date.now() - V.sc[k].t < 3e5) return Promise.resolve(V.sc[k].v);
    return H.sessRange(c, bs, from, to, true).then(function (ss) { V.sc[k] = { t: Date.now(), v: ss }; return ss; });
  }
  function trendGroup(ss, mode) {
    var g = {};
    ss.forEach(function (s) {
      if (s.status !== "submitted" && s.status !== "auto") return;
      var d = new Date(s.date + "T00:00:00"), key, lab;
      if (mode === "d") { key = s.date; lab = d.toLocaleDateString("en-IN", { weekday: "short" }) + " " + d.getDate(); }
      else if (mode === "w") { var mon = new Date(d.getTime() - ((d.getDay() + 6) % 7) * 864e5); key = ymd(mon); lab = "Wk " + mon.getDate() + "/" + (mon.getMonth() + 1); }
      else { key = s.date.slice(0, 7); lab = d.toLocaleDateString("en-IN", { month: "short" }); }
      var n = H.counts(s), o = g[key] = g[key] || { lab: lab, p: 0, a: 0, l: 0 }; o.p += n.p; o.a += n.a; o.l += n.l;
    });
    return Object.keys(g).sort().map(function (k) { var o = g[k], t = o.p + o.a + o.l; o.pct = t ? Math.round(100 * (o.p + o.l) / t) : 0; return o; });
  }
  EXT.adminViews.att_dash = { icon: "🗓️", label: "Attendance", render: function (m, c) {
    var F = c.A.av2F = c.A.av2F || { date: ymd(Date.now()), b: "all", sub: "", teacher: "", st: "all", me: "all", tr: "d" };
    F.date = F.date || ymd(Date.now());
    m.innerHTML = '<div class="av2-empty">Loading…</div>';
    EXT.attRefresh = function () { if (guard("att_dash", c)) { var t = document.getElementById("av2-tab"); t && EXT.adminViews.att_dash.render(t, C()); } };
    var bs = bids(c, F.b), now = Date.now();
    Promise.all([
      H.sessRange(c, bs, F.date, F.date, true),
      Promise.all(bs.map(function (b) { return bsub(c, b, "attendanceRecords").where("date", "==", F.date).get().then(function (q) { return q.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); }); }).catch(function () { return []; }); })).then(flat),
      Promise.all(bs.map(function (b) { return bsub(c, b, "attendanceSessions").where("liveStatus", "==", "active").get().then(function (q) { return q.docs.map(function (d) { return Object.assign({ id: d.id, batchId: b }, d.data()); }); }).catch(function () { return []; }); })).then(flat),
      trendLoad(c, bs, F.tr === "d" ? 8 : F.tr === "w" ? 29 : 95)
    ]).then(function (r) {
      if (!guard("att_dash", c)) return;
      var ss = r[0].filter(function (s) { return (!F.sub || s.subject === F.sub) && (!F.teacher || s.teacher === F.teacher); }), recs = r[1], active = r[2], tss = r[3];
      var sm = {}; ss.forEach(function (s) { sm[s.classId || s.id] = s; });
      var ent = [];
      ss.forEach(function (s) {
        var sid = s.classId || s.id;
        if (s.liveStatus || s.qrOn !== undefined) recs.filter(function (x) { return x.sessionId === sid; }).forEach(function (x) { ent.push({ st: x.status, me: x.method, b: s.batchId }); });
        else Object.keys(s.marks || {}).forEach(function (mb) { var st = legacyToStatus(s.marks[mb]); if (st) ent.push({ st: st, me: (s.via || {})[mb] === "nfc" ? "nfc" : (s.via || {})[mb] === "qr" ? "gps_qr" : "manual", b: s.batchId }); });
      });
      ent = ent.filter(function (x) { return (F.st === "all" || x.st === F.st) && (F.me === "all" || x.me === F.me); });
      var n = { present: 0, absent: 0, late: 0, pending: 0 }; ent.forEach(function (x) { if (n[x.st] !== undefined) n[x.st]++; });
      var total = bs.reduce(function (s, b) { var bb = (c.A.batches || []).filter(function (x) { return x.id === b; })[0]; return s + ((bb && bb.enrolledCount) || 0); }, 0);
      var rec = n.present + n.late + n.absent, rate = rec ? Math.round(100 * (n.present + n.late) / rec) : 0;
      var td = trendGroup(tss, F.tr), mx = 100;
      var byB = {}; ent.forEach(function (x) { var o = byB[x.b] = byB[x.b] || { p: 0, t: 0 }; if (x.st !== "pending") { o.t++; if (x.st !== "absent") o.p++; } });
      var cl = dayClasses(c, F.date, bs), subs = {}, tchs = {};
      Object.keys(c.A.items || {}).forEach(function (b) { (c.A.items[b] || []).forEach(function (i) { if (i.kind === "class") { if (i.subject) subs[i.subject] = 1; if (i.teacher) tchs[i.teacher] = 1; } }); });
      var notFin = ss.filter(function (s) { return s.status !== "submitted" && s.status !== "auto" && s.liveStatus && s.liveStatus !== "active"; });
      function stat(k, ic, v, l) { return '<div class="av2-stat ' + k + '"><span>' + ic + "</span><b>" + v + "</b><small>" + l + "</small></div>"; }
      m.innerHTML =
        '<div class="av2-filters"><input type="date" data-f="date" value="' + e(F.date) + '">' + batchSelect(c, F.b, true).replace("data-b", 'data-f="b"') +
        '</div><details class="av2-more"><summary>Aur filter (subject / teacher / status / method)</summary><div class="av2-filters">' + '<select data-f="sub"><option value="">Sabhi Subject</option>' + Object.keys(subs).map(function (s) { return '<option' + (F.sub === s ? " selected" : "") + ">" + e(s) + "</option>"; }).join("") + "</select>" +
        '<select data-f="teacher"><option value="">Sabhi Teacher</option>' + Object.keys(tchs).map(function (s) { return '<option' + (F.teacher === s ? " selected" : "") + ">" + e(s) + "</option>"; }).join("") + "</select>" +
        '<select data-f="st">' + [["all", "Sabhi Status"], ["present", "Present"], ["absent", "Absent"], ["late", "Late"], ["pending", "Pending"]].map(function (o) { return '<option value="' + o[0] + '"' + (F.st === o[0] ? " selected" : "") + ">" + o[1] + "</option>"; }).join("") + "</select>" +
        '<select data-f="me">' + [["all", "Sabhi Method"], ["gps_qr", "GPS + QR"], ["manual", "Manual"], ["nfc", "NFC"], ["admin_correction", "Correction"], ["auto_final", "Auto (final)"]].map(function (o) { return '<option value="' + o[0] + '"' + (F.me === o[0] ? " selected" : "") + ">" + o[1] + "</option>"; }).join("") + "</select></div></details>" +
        '<div class="av2-stats">' + stat("b", "👥", total || "—", "Total Students") + stat("g", "✅", n.present, "Present") + stat("r", "✖", n.absent, "Absent") + stat("o", "🕒", n.late, "Late") + stat("y", "⏳", n.pending, "Pending") + stat("p", "📈", rate + "%", "Attendance %") + stat("n", "🔴", active.length, "Active Sessions") + "</div>" +
        '<div class="av2-grid21"><div class="av2-card"><div class="av2-h"><div><b>Attendance Trend</b><small>Final ho chuke sessions se</small></div><div class="av2-seg">' + [["d", "Daily"], ["w", "Weekly"], ["m", "Monthly"]].map(function (t) { return '<button data-tr="' + t[0] + '" class="' + (F.tr === t[0] ? "on" : "") + '">' + t[1] + "</button>"; }).join("") + "</div></div>" +
        (td.length ? '<div class="av2-bars">' + td.map(function (o) { return '<div><em>' + o.pct + '%</em><i class="' + (o.pct < 75 ? "lo" : "") + '" style="height:' + Math.max(4, o.pct * 1.2) + 'px"></i><span>' + e(o.lab) + "</span></div>"; }).join("") + "</div>" : '<div class="av2-empty">Is range me abhi final attendance nahi hai.</div>') + "</div>" +
        '<div class="av2-card"><div class="av2-h"><b>Present vs Absent</b></div><div class="av2-rr"><div class="av2-ring" style="--p:' + rate + '"><div><b>' + rate + '%</b><small>Present</small></div></div><div class="av2-hbs">' +
        [["Present", n.present, "#16a34a"], ["Late", n.late, "#f59e0b"], ["Absent", n.absent, "#dc2626"], ["Pending", n.pending, "#eab308"]].map(function (x) { var t = ent.length || 1; return '<div class="av2-hb"><span>' + x[0] + '</span><div><i style="width:' + Math.round(100 * x[1] / t) + "%;background:" + x[2] + '"></i></div><b>' + x[1] + "</b></div>"; }).join("") + "</div></div></div></div>" +
        '<div class="av2-grid2"><div class="av2-card"><div class="av2-h"><b>Batch / Class-wise</b></div>' + (Object.keys(byB).length ? Object.keys(byB).map(function (b) { var o = byB[b], pc = o.t ? Math.round(100 * o.p / o.t) : 0; return '<div class="av2-hb"><span>' + e(bname(c, b)) + '</span><div><i style="width:' + pc + '%"></i></div><b>' + pc + "%</b></div>"; }).join("") : '<div class="av2-empty">Is din ka data nahi.</div>') + "</div>" +
        '<div class="av2-card"><div class="av2-h"><b>Aaj ki Classes</b><button class="av2-lk" data-go="att_sched">Schedule →</button></div>' +
        (cl.length ? cl.map(function (i) { var s = sm[i.id], live = s && s.liveStatus === "active", fin = s && (s.status === "submitted" || s.status === "auto"), t = new Date(c.ms(i.scheduledAt)); return '<div class="av2-cls"><div class="av2-t"><b>' + tm(t) + "</b><small>" + (+i.durationMin || 60) + ' min</small></div><div class="av2-g"><b>' + e(i.subject || i.title) + "</b><small>" + e(bname(c, i.batchId)) + (i.teacher ? " • " + e(i.teacher) : "") + "</small></div>" + (fin ? '<span class="av2-pill p">Final</span>' : live ? '<button class="av2-b sm" data-live="' + e(i.id) + '">● Live</button>' : '<button class="av2-b sm" data-live="' + e(i.id) + '">▶ Start</button>') + '<button class="av2-b sm sec" data-man="' + e(i.id) + '">✍</button></div>'; }).join("") : '<div class="av2-empty">Is din koi class schedule nahi.</div>') + "</div></div>" +
        '<div class="av2-card"><div class="av2-h"><b>🔔 Alerts</b></div>' +
        (n.pending ? '<div class="av2-al warn"><i>⏳</i><div><b>' + n.pending + " students Pending verification</b><small>GPS/Camera/QR problem — teacher review chahiye</small></div><button class=\"av2-b sm\" data-go=\"att_pend\">Review</button></div>" : "") +
        (n.absent ? '<div class="av2-al bad"><i>!</i><div><b>' + n.absent + " students absent</b><small>Absent Students me jaakar parents ko call/WhatsApp karein</small></div><button class=\"av2-b sm sec\" data-go=\"att_abs\">Open</button></div>" : "") +
        notFin.slice(0, 4).map(function (s) { return '<div class="av2-al warn"><i>📝</i><div><b>Final submit baaki</b><small>' + e(bname(c, s.batchId)) + " – " + e(s.subject || s.title) + '</small></div><button class="av2-b sm" data-man="' + e(s.classId || s.id) + '" data-bb="' + e(s.batchId) + '">Finalize</button></div>'; }).join("") +
        (!n.pending && !n.absent && !notFin.length ? '<div class="av2-empty">Abhi koi alert nahi.</div>' : "") + "</div>" +
        "";
      $$("[data-f]", m).forEach(function (el) { el.onchange = function () { F[el.dataset.f] = el.value; EXT.adminViews.att_dash.render(m, c); }; });
      $$("[data-tr]", m).forEach(function (b) { b.onclick = function () { F.tr = b.dataset.tr; EXT.adminViews.att_dash.render(m, c); }; });
      $$("[data-go]", m).forEach(function (b) { b.onclick = function () { go(c, b.dataset.go); }; });
      $$("[data-live]", m).forEach(function (b) { b.onclick = function () { var it = cl.filter(function (i) { return i.id === b.dataset.live; })[0]; it && startFor(c, it); }; });
      $$("[data-man]", m).forEach(function (b) { b.onclick = function () { var it = cl.filter(function (i) { return i.id === b.dataset.man; })[0]; if (it) OLDOPEN(c, it); else { V.pre = { b: b.dataset.bb, sid: b.dataset.man, date: F.date }; go(c, "att_manual"); } }; });
    }).catch(function (x) { m.innerHTML = '<div class="av2-empty">Load nahi hua: ' + e(x && (x.code || x.message) || x) + "<br>Firestore Rules publish kiye?</div>"; });
  } };

  /* =====================================================================
     START SESSION + LIVE QR
     ===================================================================== */
  function startFor(c, it) { V.pre = { b: it.batchId, classId: it.id, date: ymd(H.baseOf(c, it).startMs), go: true }; go(c, "att_live"); }
  function stopLive(full) {
    var L = V.live; if (!L) return;
    clearInterval(L.tick); L.tick = null; try { L.unsub && L.unsub(); } catch (x) {} L.unsub = null;
    try { L.wl && L.wl.release && L.wl.release(); } catch (x) {} L.wl = null; if (full) V.live = null;
  }
  EXT.adminViews.att_live = { icon: "▶️", label: "Start Session", render: function (m, c) {
    if (V.live && V.live.s && !V.live.ended) return showLive(m, c);
    if (V.live && V.live.ended) return showEnded(m, c);
    var F = V.pre || {}; V.pre = null;
    m.innerHTML = '<div class="av2-empty">Loading…</div>';
    var bs = bids(c, "all");
    Promise.all(bs.map(function (b) { return bsub(c, b, "attendanceSessions").where("liveStatus", "==", "active").get().then(function (q) { return q.docs.map(function (d) { return Object.assign({ id: d.id, batchId: b }, d.data()); }); }).catch(function () { return []; }); })).then(flat).then(function (act) {
      if (!guard("att_live", c)) return;
      var b0 = F.b || curB(c) || (c.A.batches[0] || {}).id || "", date = F.date || ymd(Date.now());
      m.innerHTML = (act.length ? '<div class="av2-card"><div class="av2-h"><b>Chalu Sessions</b></div>' + act.map(function (s) { return '<div class="av2-cls"><div class="av2-g"><b>' + e(s.subject || s.title) + "</b><small>" + e(bname(c, s.batchId)) + " • shuru " + tm(s.startedAtMs) + '</small></div><button class="av2-b sm" data-res="' + e(s.id) + '" data-bb="' + e(s.batchId) + '">Resume QR</button></div>'; }).join("") + "</div>" : "") +
        '<div class="av2-card" style="max-width:760px"><div class="av2-h"><div><b>Attendance Session shuru karein</b><small>QR + GPS se students khud attendance lagayenge</small></div></div>' +
        '<div class="av2-fg"><label>Batch / Class' + batchSelect(c, b0, false) + '</label><label>Date<input type="date" data-d value="' + e(date) + '"></label><label class="full">Class (schedule se)<select data-cl></select></label>' +
        '<div class="av2-x full" data-xf style="display:none"><div class="av2-fg"><label>Title<input data-xt placeholder="Extra class"></label><label>Subject<input data-xs></label><label>Teacher<input data-xe></label><label>Period<input data-xp placeholder="1, 2, 3…"></label></div></div></div>' +
        '<div class="av2-ok" data-chk></div><div class="av2-acts"><button class="av2-b sec" data-man>✍ Manual se bharein</button><button class="av2-b" data-go>▶ Start Attendance</button></div></div>';
      var sb = $("[data-b]", m), sd = $("[data-d]", m), scl = $("[data-cl]", m);
      function fill() {
        var cl = dayClasses(c, sd.value, [sb.value]);
        scl.innerHTML = cl.map(function (i) { return '<option value="' + e(i.id) + '">' + tm(c.ms(i.scheduledAt)) + " · " + e(i.subject || i.title) + (i.teacher ? " (" + e(i.teacher) + ")" : "") + "</option>"; }).join("") + '<option value="__x">➕ Extra / bina schedule ka session</option>';
        if (F.classId && cl.some(function (i) { return i.id === F.classId; })) scl.value = F.classId; F.classId = ""; xs();
      }
      function xs() { $("[data-xf]", m).style.display = scl.value === "__x" ? "" : "none"; var bb = (c.A.batches || []).filter(function (x) { return x.id === sb.value; })[0]; $("[data-chk]", m).innerHTML = "🔒 Sirf aapke institute ka batch • " + ((bb && bb.enrolledCount) || "?") + " students enrolled"; }
      sb.onchange = fill; sd.onchange = fill; scl.onchange = xs; fill();
      function pick() {
        var b = sb.value, it = scl.value === "__x" ? null : dayClasses(c, sd.value, [b]).filter(function (i) { return i.id === scl.value; })[0];
        return sessionFor(c, b, it, { title: $("[data-xt]", m).value.trim(), subject: $("[data-xs]", m).value.trim(), teacher: $("[data-xe]", m).value.trim(), period: $("[data-xp]", m).value.trim() }, sd.value);
      }
      $("[data-go]", m).onclick = function () { runStart(c, sb.value, pick(), this); };
      $("[data-man]", m).onclick = function () { var s = pick(); V.pre = { b: sb.value, sid: s.sid, date: s.date, meta: s, classId: scl.value === "__x" ? "" : scl.value }; go(c, "att_manual"); };
      $$("[data-res]", m).forEach(function (b) { b.onclick = function () { var s = act.filter(function (x) { return x.id === b.dataset.res; })[0]; runStart(c, b.dataset.bb, { sid: s.id, classId: s.classId || "", title: s.title, subject: s.subject, teacher: s.teacher, startMs: s.startMs, endMs: s.endMs, date: s.date, period: s.period || "" }, b); }; });
      if (F.go) $("[data-go]", m).click();
    });
  } };
  function runStart(c, b, s, btn) {
    btn && (btn.disabled = true);
    api("start", sessBody(b, s)).then(function (r) {
      stopLive(true); V.live = { b: b, sid: s.sid, meta: s, s: r.session, cfg: r.settings, token: r.token, at: Date.now(), recs: {}, ro: [], feed: [], first: true };
      return H.roster(c, b, true).then(function (ro) { V.live.ro = ro; go(c, "att_live"); });
    }).catch(function (x) { btn && (btn.disabled = false); toast(c, "❌ " + (x.message || x)); });
  }
  function showLive(m, c) {
    var L = V.live, cfg = L.cfg || {}, rot = cfg.qrRotateSec || 30, qrOn = L.s.qrOn !== false;
    m.innerHTML = '<div id="av2-live" class="av2-proj"><div class="av2-qrbox"><div id="av2-qr">' + (qrOn ? "" : '<div class="av2-empty">QR band hai</div>') + '</div><div class="av2-cd"><b id="av2-cdn">' + rot + 's</b><div class="av2-cdbar"><i id="av2-cdb"></i></div></div><small>Naya QR har ' + rot + " sec me. Purana QR sirf " + (cfg.qrGraceSec != null ? "kuch" : "") + ' second ki grace tak chalta hai.</small></div>' +
      '<div class="av2-pr"><span class="av2-pill live">● SESSION ACTIVE</span><h3>' + e(L.s.subject || L.s.title) + " · " + e(bname(c, L.b)) + '</h3><div class="av2-meta">' + e(L.s.teacher || "") + (L.s.period ? " · Period " + e(L.s.period) : "") + " · Shuru " + tm(L.s.startedAtMs || L.at) + " · " + e(dd(new Date(L.s.date + "T00:00:00"))) + "</div>" +
      '<div class="av2-pc"><div><b id="lP">0</b><small>Present</small></div><div><b id="lW">0</b><small>Pending</small></div><div><b id="lL">0</b><small>Late</small></div><div><b id="lE">' + L.ro.length + '</b><small>Abhi baaki</small></div></div>' +
      '<div class="av2-lp">Attendance: <b id="lPct">0%</b> <span>(Absent final nahi — Session khatam hone par tay hoga)</span></div><div class="av2-feed" id="av2-feed"><div>Students scan kar rahe hain…</div></div>' +
      '<div class="av2-warn" id="av2-warn">⚠️ QR refresh nahi ho paya — internet check karein. Purana QR grace tak chalega.</div>' +
      '<div class="av2-acts left"><button class="av2-b light" id="av2-fs">⛶ Projector / Fullscreen</button><button class="av2-b light" data-go="att_pend">⏳ Pending</button><button class="av2-b red" id="av2-end">■ End Session</button></div></div></div>';
    var ro = L.ro, nm = {}; ro.forEach(function (r) { nm[r.mobile] = r.name; });
    function paintQR() { var q = $("#av2-qr"); if (q && L.token && window.SnapQR) q.innerHTML = SnapQR.svg(L.token, { ecc: "M", size: 340, margin: 2 }); }
    function counts() {
      var n = { present: 0, late: 0, pending: 0 }; Object.keys(L.recs).forEach(function (k) { var s = L.recs[k].status; if (n[s] !== undefined) n[s]++; });
      var mk = n.present + n.late + n.pending, t = ro.length; if ($("#lP")) { $("#lP").textContent = n.present; $("#lW").textContent = n.pending; $("#lL").textContent = n.late; $("#lE").textContent = Math.max(0, t - mk); $("#lPct").textContent = (t ? Math.round(100 * (n.present + n.late) / t) : 0) + "%"; }
      return n;
    }
    paintQR();
    L.unsub = bsub(c, L.b, "attendanceRecords").where("sessionId", "==", L.sid).onSnapshot(function (q) {
      q.docChanges().forEach(function (ch) {
        var d = ch.doc.data(); if (ch.type === "removed") { delete L.recs[d.mobile]; return; } L.recs[d.mobile] = d;
        if (!L.first) { var f = $("#av2-feed"); if (f) { if (f.firstChild && /scan kar rahe/.test(f.firstChild.textContent)) f.innerHTML = ""; var x = document.createElement("div"); x.textContent = tm(Date.now()) + "  " + (nm[d.mobile] || d.name || d.mobile) + " — " + (LBL[d.status] || d.status) + (d.status === "pending" ? " (" + (REASON[d.pendingReason] || "review") + ")" : ""); f.insertBefore(x, f.firstChild); } }
      }); L.first = false; counts();
    }, function (x) { toast(c, "Live counter: " + (x.code || x.message)); });
    var fetching = false, failSince = 0;
    function rotate() {
      if (fetching) return; fetching = true;
      api("token", { batchId: L.b, sessionId: L.sid }).then(function (r) { L.token = r.token; L.at = Date.now(); rot = r.rotateSec || rot; failSince = 0; paintQR(); var w = $("#av2-warn"); w && w.classList.remove("on"); })
        .catch(function (x) { if (!failSince) failSince = Date.now(); var w = $("#av2-warn"); w && w.classList.add("on"); if (x.status === 409) { toast(c, "Session ab chalu nahi hai"); stopLive(true); go(c, "att_live"); } })
        .then(function () { fetching = false; });
    }
    L.tick = setInterval(function () {
      if (!$("#av2-live")) { stopLive(false); return; }       /* view band: timers roko (session server par chalu rehta hai) */
      var left = Math.max(0, rot - Math.floor((Date.now() - L.at) / 1000)); $("#av2-cdn").textContent = left + "s"; $("#av2-cdb").style.width = (left / rot * 100) + "%";
      if (left <= 0) rotate(); else if (failSince && Date.now() - failSince > 4000 && left % 5 === 0) rotate();
    }, 1000);
    try { navigator.wakeLock && navigator.wakeLock.request("screen").then(function (w) { L.wl = w; }).catch(function () {}); } catch (x) {}
    $("#av2-fs").onclick = function () { var el = $("#av2-live"); try { (el.requestFullscreen || el.webkitRequestFullscreen).call(el); } catch (x) { toast(c, "Fullscreen is device par nahi chala"); } };
    $$("[data-go]", m).forEach(function (b) { b.onclick = function () { go(c, b.dataset.go); }; });
    $("#av2-end").onclick = function () {
      confirmD("Session khatam karein?", "QR band ho jayega. Phir Pending students review karke Final submit kar sakte hain.", "End Session", function () {
        api("end", { batchId: L.b, sessionId: L.sid }).then(function (r) { stopLive(false); L.ended = true; L.counts = r.counts; go(c, "att_live"); }).catch(function (x) { toast(c, "❌ " + x.message); });
      });
    };
  }
  function showEnded(m, c) {
    var L = V.live, n = L.counts || {};
    m.innerHTML = '<div class="av2-card" style="max-width:640px"><div class="av2-h"><div><b>Session Complete ✔</b><small>' + e(L.s.subject || L.s.title) + " · " + e(bname(c, L.b)) + '</small></div></div>' +
      '<div class="av2-stats s4"><div class="av2-stat g"><b>' + (n.present || 0) + '</b><small>Present</small></div><div class="av2-stat o"><b>' + (n.late || 0) + '</b><small>Late</small></div><div class="av2-stat y"><b>' + (n.pending || 0) + '</b><small>Pending</small></div><div class="av2-stat n"><b>' + (n.notMarked || 0) + '</b><small>Not marked</small></div></div>' +
      '<p class="av2-note">Final submit par jin students ne attendance nahi lagayi unhe Absent gina jayega. <b>Pending</b> students Absent nahi gine jaate — pehle unka review karein.</p>' +
      '<div class="av2-acts"><button class="av2-b sec" data-p>⏳ Pending Review (' + (n.pending || 0) + ')</button><button class="av2-b sec" data-m>✍ Manual / Correction</button><button class="av2-b" data-f>✅ Final Submit</button></div></div>';
    $("[data-p]", m).onclick = function () { V.live = null; go(c, "att_pend"); };
    $("[data-m]", m).onclick = function () { V.pre = { b: L.b, sid: L.sid, date: L.s.date, meta: L.meta, classId: L.meta.classId }; V.live = null; go(c, "att_manual"); };
    $("[data-f]", m).onclick = function () { finalize(c, L.b, L.sid, function () { V.live = null; go(c, "att_dash"); }); };
  }
  function finalize(c, b, sid, done) {
    api("finalize", { batchId: b, sessionId: sid }).then(function (r) { toast(c, "✅ Final submit ho gaya • Absent " + (r.counts.a || 0) + (r.pending ? " • Pending " + r.pending + " baaki" : "")); H.clearCache && H.clearCache(); done && done(r); })
      .catch(function (x) {
        if (x.status === 409 && x.data && x.data.pending) return confirmD(x.data.pending + " students Pending hain", "Pending students Absent nahi gine jayenge. Phir bhi final submit karein?", "Haan, Final karein", function () { api("finalize", { batchId: b, sessionId: sid, force: true }).then(function (r) { toast(c, "✅ Final ho gaya (Pending " + (r.pending || 0) + " baaki)"); done && done(r); }).catch(function (y) { toast(c, "❌ " + y.message); }); });
        toast(c, "❌ " + x.message);
      });
  }

  /* =====================================================================
     MANUAL ATTENDANCE
     ===================================================================== */
  function OLDOPEN(c, it) { V.pre = { b: it.batchId, classId: it.id, date: ymd(H.baseOf(c, it).startMs) }; go(c, "att_manual"); }
  EXT.adminViews.att_manual = { icon: "✍️", label: "Manual Attendance", render: function (m, c) {
    var F = V.pre || {}; V.pre = null;
    var st = V.man = { b: F.b || curB(c) || (V.man && V.man.b) || (c.A.batches[0] || {}).id || "", date: F.date || ymd(Date.now()), classId: F.classId || "", sid: F.sid || "", meta: F.meta || null, loc: {}, sel: {}, q: "", f: "all", ro: [], recs: {}, leg: null };
    m.innerHTML = '<div class="av2-card"><div class="av2-fg c3"><label>Batch / Class' + batchSelect(c, st.b, false) + '</label><label>Date<input type="date" data-d value="' + e(st.date) + '"></label><label>Class / Session<select data-cl></select></label></div></div><div id="av2-mbody"></div>';
    var sb = $("[data-b]", m), sd = $("[data-d]", m), scl = $("[data-cl]", m);
    function fill() {
      var cl = dayClasses(c, sd.value, [sb.value]);
      scl.innerHTML = cl.map(function (i) { return '<option value="' + e(i.id) + '">' + tm(c.ms(i.scheduledAt)) + " · " + e(i.subject || i.title) + "</option>"; }).join("") + '<option value="__x">➕ Extra session</option>';
      if (st.classId && cl.some(function (i) { return i.id === st.classId; })) scl.value = st.classId; else if (st.sid && !st.classId) scl.value = "__x"; else if (cl.length === 0) scl.value = "__x";
      load();
    }
    function load() {
      st.b = sb.value; st.date = sd.value; unsubMan();
      var it = scl.value === "__x" ? null : dayClasses(c, st.date, [st.b]).filter(function (i) { return i.id === scl.value; })[0];
      var meta = it ? sessionFor(c, st.b, it, {}, st.date) : (st.meta && st.meta.sid && st.meta.date === st.date ? st.meta : sessionFor(c, st.b, null, { title: "Extra session" }, st.date));
      if (!it && st.sid && !st.meta) { meta = Object.assign(meta, { sid: st.sid }); }
      st.meta = meta; st.it = it; st.loc = {}; st.sel = {};
      var body = $("#av2-mbody", m); body.innerHTML = '<div class="av2-empty">Loading…</div>';
      Promise.all([H.roster(c, st.b, true), bsub(c, st.b, "attendanceSessions").doc(meta.sid).get()]).then(function (r) {
        if (!guard("att_manual", c)) return; st.ro = r[0]; st.sd = r[1].exists ? r[1].data() : null; st.leg = st.sd && !st.sd.liveStatus && !st.sd.qrOn !== false && st.sd.marks ? st.sd : null;
        st.unsub = bsub(c, st.b, "attendanceRecords").where("sessionId", "==", meta.sid).onSnapshot(function (q) {
          st.recs = {}; q.docs.forEach(function (d) { st.recs[d.data().mobile] = d.data(); }); if (guard("att_manual", c) && !st.busy) paint();
        }, function (x) { body.innerHTML = '<div class="av2-empty">Load nahi hua: ' + e(x.code || x.message) + "</div>"; });
      }).catch(function (x) { body.innerHTML = '<div class="av2-empty">Load nahi hua: ' + e(x.code || x.message || x) + "</div>"; });
    }
    function base(r) { var rc = st.recs[r.mobile]; if (rc) return rc.status; var lg = st.leg && st.leg.marks && st.leg.marks[r.mobile]; return lg ? legacyToStatus(lg) : "u"; }
    function curr(r) { return st.loc[r.mobile] || base(r); }
    function method(r) { var rc = st.recs[r.mobile]; if (rc) return METH[rc.method] || rc.method || "—"; var lg = st.leg && st.leg.via && st.leg.via[r.mobile]; return st.leg && st.leg.marks && st.leg.marks[r.mobile] ? (lg ? METH[lg] || lg : "Manual") : "—"; }
    function when(r) { var rc = st.recs[r.mobile]; return rc && rc.markedMs ? tm(rc.markedMs) : "—"; }
    function dirtyN() { return Object.keys(st.loc).filter(function (k) { return st.loc[k] !== base({ mobile: k }); }).length; }
    function paint() {
      var body = $("#av2-mbody", m); if (!body) return;
      var tl = { present: 0, absent: 0, late: 0, pending: 0, u: 0 }; st.ro.forEach(function (r) { tl[curr(r)]++; });
      var rows = st.ro.filter(function (r) { return (st.f === "all" || curr(r) === st.f) && (!st.q || (r.name + " " + r.roll).toLowerCase().indexOf(st.q) >= 0); });
      var fin = st.sd && (st.sd.status === "submitted" || st.sd.status === "auto"), live = st.sd && st.sd.liveStatus === "active", dn = dirtyN();
      body.innerHTML = '<div class="av2-card tight"><div class="av2-chips"><span class="av2-pill b">' + e(bname(c, st.b)) + '</span><span class="av2-pill v">' + e(st.meta.subject || st.meta.title) + '</span><span class="av2-pill u">' + e(dd(new Date(st.meta.date + "T00:00:00"))) + "</span>" +
        (live ? '<span class="av2-pill live">● QR Session chalu</span>' : fin ? '<span class="av2-pill p">Final submitted</span>' : st.sd ? '<span class="av2-pill w">Final baaki</span>' : '<span class="av2-pill u">Naya</span>') +
        '<span class="av2-sum">' + ["present", "late", "absent", "pending", "u"].map(function (k) { return '<span class="av2-pill ' + PILL[k] + '">' + (k === "u" ? "—" : k === "pending" ? "⏳" : k[0].toUpperCase()) + " " + tl[k] + "</span>"; }).join("") + "</span></div></div>" +
        '<div class="av2-card"><div class="av2-filters"><input data-q placeholder="🔍 Student / Roll khojein" value="' + e(st.q) + '"><select data-sf>' + [["all", "Sabhi Status"], ["present", "Present"], ["absent", "Absent"], ["late", "Late"], ["pending", "Pending"], ["u", "Not Marked"]].map(function (o) { return '<option value="' + o[0] + '"' + (st.f === o[0] ? " selected" : "") + ">" + o[1] + "</option>"; }).join("") + "</select>" +
        '<button class="av2-b sm sec" data-allp>Mark All Present</button><button class="av2-b sm red" data-alla>Mark All Absent</button></div>' +
        '<div class="av2-selbar">Selected: <b>' + Object.keys(st.sel).length + '</b> <button class="av2-b sm sec" data-sp>P</button><button class="av2-b sm sec" data-sl>L</button><button class="av2-b sm sec" data-sa>A</button></div>' +
        '<div class="av2-tw"><table><thead><tr><th><input type="checkbox" data-all></th><th>Roll</th><th>Student</th><th>Status</th><th>Method</th><th>Time</th><th>Action</th></tr></thead><tbody>' +
        (rows.length ? rows.map(function (r) { var s = curr(r), ch = st.loc[r.mobile] && st.loc[r.mobile] !== base(r), rc = st.recs[r.mobile]; return '<tr class="' + (ch ? "chg" : "") + '"><td><input type="checkbox" data-s="' + e(r.mobile) + '"' + (st.sel[r.mobile] ? " checked" : "") + '></td><td>' + e(r.roll || "-") + '</td><td><div class="av2-person"><span class="av2-av">' + e((r.name || "?").charAt(0).toUpperCase()) + "</span><div>" + e(r.name) + (rc && rc.status === "pending" ? "<small>" + e(REASON[rc.pendingReason] || "Review chahiye") + "</small>" : "") + "</div></div></td><td>" + pill(s) + "</td><td>" + e(method(r)) + "</td><td>" + when(r) + '</td><td><div class="av2-segb">' + [["present", "P"], ["absent", "A"], ["late", "L"]].map(function (x) { return '<button class="' + PILL[x[0]] + (s === x[0] ? " on" : "") + '" data-m="' + e(r.mobile) + '" data-v="' + x[0] + '">' + x[1] + "</button>"; }).join("") + "</div></td></tr>"; }).join("") : '<tr><td colspan="7"><div class="av2-empty">Koi student nahi.</div></td></tr>') + "</tbody></table></div>" +
        '<div class="av2-save"><span class="av2-dirty' + (dn ? " on" : "") + '">● ' + dn + " unsaved badlav</span><span style=\"flex:1\"></span>" + (st.it && !live && !st.sd ? '<button class="av2-b sec" data-nfc title="Purana NFC card mode">📡 NFC</button>' : "") + '<button class="av2-b sec" data-qr>▶ QR Session</button><button class="av2-b ghost" data-rs>Reset</button><button class="av2-b" data-sv>💾 Save Attendance</button><button class="av2-b grn" data-fin>✅ Final Submit</button></div></div>';
      window.onbeforeunload = dn ? function () { return "Unsaved attendance hai"; } : null;
      $("[data-q]", body).oninput = function () { st.q = this.value.toLowerCase(); var pos = this.selectionStart; st.busy = false; paint(); var q = $("[data-q]", m); q.focus(); q.setSelectionRange(pos, pos); };
      $("[data-sf]", body).onchange = function () { st.f = this.value; paint(); };
      function setMany(list, v) { list.forEach(function (r) { st.loc[r.mobile] = v; }); paint(); }
      $("[data-allp]", body).onclick = function () { bulk("present"); }; $("[data-alla]", body).onclick = function () { bulk("absent"); };
      function bulk(v) { var tg = st.ro.filter(function (r) { var b = base(r); return b === "u" || b === "pending"; }); if (!tg.length) return toast(c, "Sabka status pehle se tay hai (confirmed ko bulk se nahi badalte)"); confirmD("Sab ko " + LBL[v] + " karein?", tg.length + " students (jinka status abhi tay nahi / Pending hai) " + LBL[v] + " ho jayenge. Save karne tak sirf draft rahega. Confirmed attendance nahi badlegi.", "Haan, " + LBL[v], function () { setMany(tg, v); }); }
      $$("[data-m]", body).forEach(function (b) { b.onclick = function () { var r = { mobile: b.dataset.m }; if (b.dataset.v === base(r)) delete st.loc[r.mobile]; else st.loc[r.mobile] = b.dataset.v; paint(); }; });
      $$("[data-s]", body).forEach(function (b) { b.onchange = function () { b.checked ? st.sel[b.dataset.s] = 1 : delete st.sel[b.dataset.s]; paint(); }; });
      $("[data-all]", body).onchange = function () { var on = this.checked; rows.forEach(function (r) { on ? st.sel[r.mobile] = 1 : delete st.sel[r.mobile]; }); paint(); };
      function selApply(v) { var ks = Object.keys(st.sel); if (!ks.length) return toast(c, "Pehle students chunein"); ks.forEach(function (k) { st.loc[k] = v; }); st.sel = {}; paint(); }
      $("[data-sp]", body).onclick = function () { selApply("present"); }; $("[data-sl]", body).onclick = function () { selApply("late"); }; $("[data-sa]", body).onclick = function () { selApply("absent"); };
      $("[data-rs]", body).onclick = function () { if (!dn) return; confirmD("Badlav hataein?", "Bina save kiye " + dn + " badlav hat jayenge.", "Reset", function () { st.loc = {}; paint(); }); };
      $("[data-qr]", body).onclick = function () { V.pre = { b: st.b, classId: st.it ? st.it.id : "", date: st.date }; go(c, "att_live"); };
      var nf = $("[data-nfc]", body); nf && (nf.onclick = function () { OLD.openLegacy(c, st.it); });
      $("[data-sv]", body).onclick = function () { save(false); };
      $("[data-fin]", body).onclick = function () { if (dirtyN()) return toast(c, "Pehle Save Attendance karein"); finalize(c, st.b, st.meta.sid, function () { setTimeout(function () { load(); }, 600); }); };
    }
    function save(after) {
      var ks = Object.keys(st.loc).filter(function (k) { return st.loc[k] !== base({ mobile: k }); });
      if (!ks.length) return toast(c, "Koi badlav nahi");
      var corr = ks.filter(function (k) { var b = base({ mobile: k }); return b === "present" || b === "late" || b === "absent"; });
      function go(reason) {
        st.busy = true;
        api("manual", { batchId: st.b, session: sessBody(st.b, st.meta), changes: ks.map(function (k) { var b = base({ mobile: k }); return { mobile: k, status: st.loc[k], reason: (b === "present" || b === "late" || b === "absent") ? reason : "" }; }) }).then(function (r) {
          st.busy = false; st.loc = {}; var sk = r.skipped || []; toast(c, "✅ " + r.saved + " records save hue" + (sk.length ? " • " + sk.length + " skip: " + sk[0].error : "")); load();
        }).catch(function (x) { st.busy = false; toast(c, "❌ " + x.message); });
      }
      if (corr.length) confirmD("Confirmed attendance badal rahe hain", corr.length + " confirmed records ka status badlega. Ye Audit Log me kaaran ke saath darj hoga.", "Save", go, true); else go("");
    }
    sb.onchange = function () { st.classId = ""; st.sid = ""; st.meta = null; fill(); }; sd.onchange = function () { st.classId = ""; st.sid = ""; st.meta = null; fill(); }; scl.onchange = function () { st.sid = ""; load(); };
    function unsubMan() { try { st.unsub && st.unsub(); } catch (x) {} st.unsub = null; }
    fill();
  } };

  /* =====================================================================
     PENDING REVIEW
     ===================================================================== */
  EXT.adminViews.att_pend = { icon: "⏳", label: "Pending Review", render: function (m, c) {
    m.innerHTML = '<div class="av2-empty">Loading…</div>';
    var bs = bids(c, "all"), sessC = {};
    Promise.all(bs.map(function (b) { return bsub(c, b, "attendanceRecords").where("status", "==", "pending").get().then(function (q) { return q.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); }); }).catch(function () { return []; }); })).then(flat).then(function (list) {
      var need = {}; list.forEach(function (r) { need[r.batchId + "|" + r.sessionId] = r; });
      return Promise.all(Object.keys(need).map(function (k) { var r = need[k]; return bsub(c, r.batchId, "attendanceSessions").doc(r.sessionId).get().then(function (d) { sessC[k] = d.exists ? d.data() : {}; }).catch(function () { sessC[k] = {}; }); })).then(function () { return list; });
    }).then(function (list) {
      if (!guard("att_pend", c)) return;
      list.sort(function (a, b) { return (a.markedMs || 0) - (b.markedMs || 0); });
      function badge() { var tb = document.querySelector('[data-tab="att_pend"]'); if (tb) tb.innerHTML = "⏳ Jaanch baaki" + (list.length ? ' <b class="av2-bd">' + list.length + "</b>" : ""); }
      function paint() {
        badge();
        m.innerHTML = '<div class="av2-note">Pending ≠ Absent. Jab tak aap tay na karein (ya Final policy na chale), student ko Absent nahi gina jata aur parent ko absent ka message nahi jata.</div>' +
          (list.length ? list.map(function (r, i) { var s = sessC[r.batchId + "|" + r.sessionId] || {}; return '<div class="av2-card"><div class="av2-prow"><div class="av2-person"><span class="av2-av">' + e((r.name || "?").charAt(0).toUpperCase()) + "</span><div><b>" + e(r.name || r.mobile) + "</b><small>" + e(bname(c, r.batchId)) + " · " + e(s.subject || s.title || "Session") + " · " + e(r.date) + '</small></div></div><div class="av2-pinfo"><span class="av2-pill w">' + e(REASON[r.pendingReason] || "Review") + "</span><small>Koshish: " + tm(r.markedMs) + (r.distanceM != null ? " · Doori " + r.distanceM + " m" : "") + (r.accuracy != null ? " · GPS ±" + Math.round(r.accuracy) + " m" : "") + '</small></div></div><div class="av2-acts left wrap"><button class="av2-b grn sm" data-a="present" data-i="' + i + '">✓ Present</button><button class="av2-b sm" style="background:#f59e0b" data-a="late" data-i="' + i + '">Late</button><button class="av2-b red sm" data-a="absent" data-i="' + i + '">Absent</button><button class="av2-b sec sm" data-a="retry" data-i="' + i + '">↻ Dobara try karne ko kahein</button><input class="av2-note-in" placeholder="Review note (optional)" data-n="' + i + '" maxlength="300"></div></div>'; }).join("") : '<div class="av2-card av2-empty">🎉 Koi Pending case nahi.</div>');
        $$("[data-a]", m).forEach(function (b) { b.onclick = function () {
          var r = list[+b.dataset.i], note = ($('[data-n="' + b.dataset.i + '"]', m) || {}).value || "";
          $$("[data-a]", m).forEach(function (x) { x.disabled = true; });
          api("review", { batchId: r.batchId, sessionId: r.sessionId, mobile: r.mobile, action: b.dataset.a, note: note }).then(function () { list.splice(+b.dataset.i, 1); toast(c, "✅ " + (r.name || r.mobile) + ": " + (b.dataset.a === "retry" ? "dobara try karne ko kaha" : LBL[b.dataset.a])); paint(); }).catch(function (x) { toast(c, "❌ " + x.message); paint(); });
        }; });
      }
      paint();
    }).catch(function (x) { m.innerHTML = '<div class="av2-empty">Load nahi hua: ' + e(x && (x.code || x.message) || x) + "</div>"; });
  } };

  /* =====================================================================
     STUDENT ATTENDANCE PROFILE (calendar)
     ===================================================================== */
  EXT.adminViews.att_stu = { icon: "👤", label: "Student Profile", render: function (m, c) {
    var S0 = V.stu = V.stu || { b: "", mob: "", ym: "" }, pre = V.pre; V.pre = null; if (pre && pre.stuB) { S0.b = pre.stuB; S0.mob = pre.stuM; }
    if (!S0.b) S0.b = (c.A.batches[0] || {}).id || ""; if (!S0.ym) { var n = new Date(); S0.ym = n.getFullYear() + p2(n.getMonth() + 1); }
    m.innerHTML = '<div class="av2-card"><div class="av2-fg c3"><label>Batch' + batchSelect(c, S0.b, false) + '</label><label>Student<select data-st></select></label><label>Mahina<input type="month" data-mo value="' + S0.ym.slice(0, 4) + "-" + S0.ym.slice(4) + '"></label></div></div><div id="av2-sbody"></div>';
    var sb = $("[data-b]", m), ss = $("[data-st]", m), mo = $("[data-mo]", m);
    function fillS() { H.roster(c, sb.value).then(function (ro) { S0.ro = ro; ss.innerHTML = ro.map(function (r) { return '<option value="' + e(r.mobile) + '">' + e((r.roll ? r.roll + ". " : "") + r.name) + "</option>"; }).join(""); if (S0.mob && ro.some(function (r) { return r.mobile === S0.mob; })) ss.value = S0.mob; show(); }); }
    function show() {
      S0.b = sb.value; S0.mob = ss.value; S0.ym = mo.value.replace("-", ""); var body = $("#av2-sbody", m); if (!S0.mob) { body.innerHTML = '<div class="av2-empty">Is batch me student nahi.</div>'; return; }
      body.innerHTML = '<div class="av2-empty">Loading…</div>';
      bsub(c, S0.b, "attendanceStudents").doc(S0.mob + "_" + S0.ym).get().then(function (d) {
        var days = d.exists ? d.data().days || {} : {}, byDay = {}, cnt = { P: 0, A: 0, L: 0, W: 0 }, hist = [];
        Object.keys(days).forEach(function (k) { var v = days[k]; cnt[v.s] !== undefined && cnt[v.s]++; (byDay[v.d] = byDay[v.d] || []).push(Object.assign({ id: k }, v)); hist.push(Object.assign({ id: k }, v)); });
        function dstat(a) { var P = a.filter(function (x) { return x.s === "P"; }).length, A = a.filter(function (x) { return x.s === "A"; }).length, L = a.filter(function (x) { return x.s === "L"; }).length, W = a.filter(function (x) { return x.s === "W"; }).length; return W ? "w" : A && !(P + L) ? "a" : A ? "l" : L ? "l" : "p"; }
        var y = +S0.ym.slice(0, 4), mm = +S0.ym.slice(4) - 1, first = new Date(y, mm, 1), nd = new Date(y, mm + 1, 0).getDate(), off = (first.getDay() + 6) % 7, rate = (cnt.P + cnt.L + cnt.A) ? Math.round(100 * (cnt.P + cnt.L) / (cnt.P + cnt.L + cnt.A)) : 0;
        var cells = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map(function (x) { return '<div class="h">' + x + "</div>"; }).join(""); for (var i = 0; i < off; i++) cells += "<span></span>";
        for (var dN = 1; dN <= nd; dN++) { var ds = y + "-" + p2(mm + 1) + "-" + p2(dN), a = byDay[ds]; cells += '<button class="' + (a ? dstat(a) : "h2") + '" data-d="' + ds + '">' + dN + "</button>"; }
        var who = (S0.ro || []).filter(function (r) { return r.mobile === S0.mob; })[0] || {};
        body.innerHTML = '<div class="av2-card"><div class="av2-person big"><span class="av2-av">' + e((who.name || "?").charAt(0).toUpperCase()) + "</span><div><b>" + e(who.name || S0.mob) + "</b><small>Roll " + e(who.roll || "-") + " · " + e(bname(c, S0.b)) + "</small></div></div></div>" +
          '<div class="av2-stats s4"><div class="av2-stat p"><b>' + rate + '%</b><small>Is mahine %</small></div><div class="av2-stat g"><b>' + cnt.P + '</b><small>Present</small></div><div class="av2-stat r"><b>' + cnt.A + '</b><small>Absent</small></div><div class="av2-stat o"><b>' + cnt.L + '</b><small>Late · Pending ' + cnt.W + "</small></div></div>" +
          '<div class="av2-grid21"><div class="av2-card"><div class="av2-h"><b>Calendar</b></div><div class="av2-cal">' + cells + '</div><div class="av2-leg"><span><i style="background:#16a34a"></i>Present</span><span><i style="background:#dc2626"></i>Absent</span><span><i style="background:#f59e0b"></i>Late</span><span><i style="background:#eab308"></i>Pending</span><span><i style="background:#cbd5e1"></i>Record nahi / Holiday</span></div></div>' +
          '<div class="av2-card"><div class="av2-h"><b id="av2-dt">Tareekh chunein</b></div><div id="av2-db" class="av2-note">Calendar ki kisi tareekh par click karein.</div></div></div>' +
          '<div class="av2-card"><div class="av2-h"><b>Date-wise History</b></div><div class="av2-tw"><table><thead><tr><th>Date</th><th>Class</th><th>Status</th></tr></thead><tbody>' + (hist.length ? hist.sort(function (x, z) { return z.d.localeCompare(x.d); }).map(function (x) { return "<tr><td>" + e(x.d) + "</td><td>" + e(x.k || x.t || "") + "</td><td>" + pill({ P: "present", A: "absent", L: "late", W: "pending" }[x.s] || "u") + "</td></tr>"; }).join("") : '<tr><td colspan="3"><div class="av2-empty">Is mahine ka record nahi.</div></td></tr>') + "</tbody></table></div></div>";
        $$("[data-d]", body).forEach(function (b) { b.onclick = function () {
          $$("[data-d]", body).forEach(function (x) { x.classList.remove("sel"); }); b.classList.add("sel"); var a = byDay[b.dataset.d]; $("#av2-dt", body).textContent = dd(new Date(b.dataset.d + "T00:00:00"));
          if (!a) { $("#av2-db", body).textContent = "Is din koi attendance record nahi (chhutti ya class nahi hui)."; return; }
          $("#av2-db", body).innerHTML = "Loading…";
          Promise.all(a.map(function (x) { return bsub(c, S0.b, "attendanceRecords").doc(x.id + "_" + S0.mob).get().then(function (d) { return d.exists ? d.data() : null; }).catch(function () { return null; }); })).then(function (rs) {
            $("#av2-db", body).innerHTML = a.map(function (x, k) { var r = rs[k]; return '<div class="av2-kv"><div><b>' + e(x.k || x.t || "Class") + "</b><small>" + (r ? e(METH[r.method] || r.method) + " · " + tm(r.markedMs) + (r.verifiedBy ? " · " + e(r.verifiedBy) : "") + (r.reviewNote ? " · “" + e(r.reviewNote) + "”" : "") : "Purana record / Manual") + "</small></div>" + pill({ P: "present", A: "absent", L: "late", W: "pending" }[x.s] || "u") + "</div>"; }).join("");
          });
        }; });
      }).catch(function (x) { body.innerHTML = '<div class="av2-empty">Load nahi hua: ' + e(x.code || x.message) + "</div>"; });
    }
    sb.onchange = function () { S0.mob = ""; fillS(); }; ss.onchange = show; mo.onchange = show; fillS();
  } };

  /* =====================================================================
     REPORTS (11 types, CSV / Print / PDF via Print)
     ===================================================================== */
  var RT = [["daily", "Daily"], ["weekly", "Weekly"], ["monthly", "Monthly"], ["student", "Student-wise"], ["class", "Class-wise"], ["section", "Section-wise"], ["teacher", "Teacher-wise Session"], ["late", "Late Arrival"], ["absence", "Absence"], ["pending", "Pending Verification"], ["method", "Attendance Method"]];
  function loadEntries(c, bs, from, to) {
    return Promise.all([H.sessRange(c, bs, from, to, true), Promise.all(bs.map(function (b) { return bsub(c, b, "attendanceRecords").where("date", ">=", from).where("date", "<=", to).get().then(function (q) { return q.docs.map(function (d) { return d.data(); }); }).catch(function () { return []; }); })).then(flat), Promise.all(bs.map(function (b) { return H.roster(c, b).then(function (ro) { return [b, ro]; }).catch(function () { return [b, []]; }); }))]).then(function (r) {
      var ss = r[0], recs = r[1], nm = {}, rl = {}; r[2].forEach(function (x) { x[1].forEach(function (s) { nm[x[0] + "|" + s.mobile] = s.name; rl[x[0] + "|" + s.mobile] = s.roll; }); });
      var smap = {}; ss.forEach(function (s) { smap[(s.classId || s.id)] = s; });
      var ent = [], seen = {};
      recs.forEach(function (x) { var s = smap[x.sessionId] || {}; seen[x.sessionId + "|" + x.mobile] = 1; ent.push({ b: x.batchId, sid: x.sessionId, date: x.date, mobile: x.mobile, name: x.name || nm[x.batchId + "|" + x.mobile] || x.mobile, roll: rl[x.batchId + "|" + x.mobile] || "", st: x.status, me: x.method, t: x.markedMs, subject: s.subject || "", teacher: s.teacher || "", reason: x.pendingReason || "", note: x.reviewNote || "" }); });
      ss.forEach(function (s) { var sid = s.classId || s.id; Object.keys(s.marks || {}).forEach(function (mb) { if (seen[sid + "|" + mb]) return; var st = legacyToStatus(s.marks[mb]); if (!st) return; ent.push({ b: s.batchId, sid: sid, date: s.date, mobile: mb, name: nm[s.batchId + "|" + mb] || mb, roll: rl[s.batchId + "|" + mb] || "", st: st, me: (s.via || {})[mb] === "qr" ? "gps_qr" : (s.via || {})[mb] || "manual", t: 0, subject: s.subject || "", teacher: s.teacher || "", reason: "", note: "" }); }); });
      return { ent: ent, ss: ss };
    });
  }
  function agg(list, keyf, labf) {
    var g = {}; list.forEach(function (x) { var k = keyf(x), o = g[k] = g[k] || { k: k, lab: labf ? labf(x) : k, p: 0, a: 0, l: 0, w: 0 }; o[{ present: "p", absent: "a", late: "l", pending: "w" }[x.st]]++; });
    return Object.keys(g).sort().map(function (k) { var o = g[k], t = o.p + o.a + o.l; o.pct = t ? Math.round(100 * (o.p + o.l) / t) + "%" : "—"; return o; });
  }
  function buildReport(c, type, ent, ss) {
    var cols, rows, tot = function (o) { return [o.p, o.a, o.l, o.w, o.pct]; }, H5 = ["Present", "Absent", "Late", "Pending", "%"];
    if (type === "daily") { cols = ["Date"].concat(H5); rows = agg(ent, function (x) { return x.date; }).map(function (o) { return [o.lab].concat(tot(o)); }); }
    else if (type === "weekly") { cols = ["Week (Mon)"].concat(H5); rows = agg(ent, function (x) { var d = new Date(x.date + "T00:00:00"); return ymd(d.getTime() - ((d.getDay() + 6) % 7) * 864e5); }).map(function (o) { return [o.lab].concat(tot(o)); }); }
    else if (type === "monthly") { cols = ["Month"].concat(H5); rows = agg(ent, function (x) { return x.date.slice(0, 7); }).map(function (o) { return [o.lab].concat(tot(o)); }); }
    else if (type === "student") { cols = ["Roll", "Student", "Batch"].concat(H5); rows = agg(ent, function (x) { return x.b + "|" + x.mobile; }, function (x) { return x; }).map(function (o) { var x = o.lab; return [x.roll || "-", x.name, bname(c, x.b)].concat(tot(o)); }).sort(function (a, b) { return String(a[0]).localeCompare(String(b[0]), undefined, { numeric: true }); }); }
    else if (type === "class") { cols = ["Batch / Class"].concat(H5); rows = agg(ent, function (x) { return x.b; }, function (x) { return bname(c, x.b); }).map(function (o) { return [o.lab].concat(tot(o)); }); }
    else if (type === "section") { cols = ["Batch", "Subject"].concat(H5); rows = agg(ent, function (x) { return x.b + "|" + x.subject; }, function (x) { return x; }).map(function (o) { return [bname(c, o.lab.b), o.lab.subject || "-"].concat(tot(o)); }); }
    else if (type === "teacher") { cols = ["Teacher", "Sessions"].concat(H5); var sc = {}; ss.forEach(function (s) { var t = s.teacher || s.startedBy || "-"; sc[t] = (sc[t] || 0) + 1; }); rows = agg(ent, function (x) { return x.teacher || "-"; }).map(function (o) { return [o.lab, sc[o.lab] || 0].concat(tot(o)); }); }
    else if (type === "late") { cols = ["Date", "Roll", "Student", "Batch", "Subject", "Time", "Method"]; rows = ent.filter(function (x) { return x.st === "late"; }).sort(function (a, b) { return b.date.localeCompare(a.date); }).map(function (x) { return [x.date, x.roll || "-", x.name, bname(c, x.b), x.subject, x.t ? tm(x.t) : "—", METH[x.me] || x.me]; }); }
    else if (type === "absence") { cols = ["Roll", "Student", "Batch", "Absent days/classes", "Dates"]; var g = {}; ent.filter(function (x) { return x.st === "absent"; }).forEach(function (x) { var k = x.b + "|" + x.mobile, o = g[k] = g[k] || { x: x, d: [] }; o.d.push(x.date); }); rows = Object.keys(g).map(function (k) { var o = g[k]; return [o.x.roll || "-", o.x.name, bname(c, o.x.b), o.d.length, o.d.sort().join(", ")]; }).sort(function (a, b) { return b[3] - a[3]; }); }
    else if (type === "pending") { cols = ["Date", "Student", "Batch", "Subject", "Reason", "Status", "Note"]; rows = ent.filter(function (x) { return x.st === "pending" || x.reason; }).map(function (x) { return [x.date, x.name, bname(c, x.b), x.subject, REASON[x.reason] || "-", LBL[x.st] || x.st, x.note]; }); }
    else { cols = ["Method", "Present", "Absent", "Late", "Pending"]; rows = agg(ent, function (x) { return METH[x.me] || x.me || "Manual"; }).map(function (o) { return [o.lab, o.p, o.a, o.l, o.w]; }); }
    return { cols: cols, rows: rows };
  }
  EXT.adminViews.att_rep = { icon: "📊", label: "Attendance Reports", render: function (m, c) {
    var F = c.A.av2R = c.A.av2R || { t: "monthly", from: ymd(new Date(new Date().getFullYear(), new Date().getMonth(), 1)), to: ymd(Date.now()), b: "all", st: "all", stu: "", teacher: "" };
    m.innerHTML = '<div class="av2-card"><div class="av2-quick">' + RT.map(function (t) { return '<button data-t="' + t[0] + '" class="' + (F.t === t[0] ? "on" : "") + '">' + t[1] + "</button>"; }).join("") + "</div></div>" +
      '<div class="av2-card"><div class="av2-filters"><input type="date" data-f="from" value="' + F.from + '"><input type="date" data-f="to" value="' + F.to + '">' + batchSelect(c, F.b, true).replace("data-b", 'data-f="b"') + '<input data-f="stu" placeholder="Student naam/roll" value="' + e(F.stu) + '"><input data-f="teacher" placeholder="Teacher" value="' + e(F.teacher) + '"><select data-f="st">' + [["all", "Sabhi Status"], ["present", "Present"], ["absent", "Absent"], ["late", "Late"], ["pending", "Pending"]].map(function (o) { return '<option value="' + o[0] + '"' + (F.st === o[0] ? " selected" : "") + ">" + o[1] + "</option>"; }).join("") + '</select><button class="av2-b sm" data-run>Report banayein</button></div><div id="av2-rb"><div class="av2-empty">Filter chunkar "Report banayein" dabayein.</div></div></div>';
    $$("[data-t]", m).forEach(function (b) { b.onclick = function () { F.t = b.dataset.t; $$("[data-t]", m).forEach(function (x) { x.classList.toggle("on", x === b); }); run(); }; });
    $$("[data-f]", m).forEach(function (el) { el.onchange = function () { F[el.dataset.f] = el.value; }; });
    function run() {
      var box = $("#av2-rb", m); box.innerHTML = '<div class="av2-empty">Loading…</div>';
      if (F.from > F.to) { box.innerHTML = '<div class="av2-empty">From date, To date se pehle honi chahiye.</div>'; return; }
      loadEntries(c, bids(c, F.b), F.from, F.to).then(function (r) {
        var q = (F.stu || "").toLowerCase(), t = (F.teacher || "").toLowerCase();
        var ent = r.ent.filter(function (x) { return (F.st === "all" || x.st === F.st) && (!q || (x.name + " " + x.roll).toLowerCase().indexOf(q) >= 0) && (!t || (x.teacher || "").toLowerCase().indexOf(t) >= 0); });
        var ss = r.ss.filter(function (s) { return !t || (s.teacher || "").toLowerCase().indexOf(t) >= 0; }), rep = buildReport(c, F.t, ent, ss), title = (RT.filter(function (x) { return x[0] === F.t; })[0] || [0, "Report"])[1] + " Report";
        V.rep = { title: title, rep: rep };
        box.innerHTML = '<div class="av2-h"><b>' + e(title) + "</b><small>" + e(F.from) + " → " + e(F.to) + " · " + rep.rows.length + ' rows</small><span class="av2-acts"><button class="av2-b sm sec" data-csv>⬇ CSV</button><button class="av2-b sm sec" data-pr>🖨 Print</button><button class="av2-b sm sec" data-pdf>📄 PDF</button></span></div><div class="av2-tw"><table><thead><tr>' + rep.cols.map(function (x) { return "<th>" + e(x) + "</th>"; }).join("") + "</tr></thead><tbody>" + (rep.rows.length ? rep.rows.map(function (row) { return "<tr>" + row.map(function (x) { return "<td>" + e(x) + "</td>"; }).join("") + "</tr>"; }).join("") : '<tr><td colspan="' + rep.cols.length + '"><div class="av2-empty">Is filter me data nahi.</div></td></tr>') + "</tbody></table></div>";
        $("[data-csv]", box).onclick = function () { var csv = "﻿" + [rep.cols].concat(rep.rows).map(function (rw) { return rw.map(csvCell).join(","); }).join("\n"), a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })); a.download = "attendance_" + F.t + "_" + F.from + "_" + F.to + ".csv"; document.body.appendChild(a); a.click(); setTimeout(function () { a.remove(); URL.revokeObjectURL(a.href); }, 500); };
        function prn() { var d = document.getElementById("av2-print") || document.body.appendChild(Object.assign(document.createElement("div"), { id: "av2-print" })); d.innerHTML = "<h2>" + e(title) + "</h2><p>" + e(F.from) + " → " + e(F.to) + " · " + e(inst(c)) + "</p><table><thead><tr>" + rep.cols.map(function (x) { return "<th>" + e(x) + "</th>"; }).join("") + "</tr></thead><tbody>" + rep.rows.map(function (row) { return "<tr>" + row.map(function (x) { return "<td>" + e(x) + "</td>"; }).join("") + "</tr>"; }).join("") + "</tbody></table>"; document.body.classList.add("av2-printing"); setTimeout(function () { window.print(); setTimeout(function () { document.body.classList.remove("av2-printing"); d.innerHTML = ""; }, 400); }, 50); }
        $("[data-pr]", box).onclick = prn; $("[data-pdf]", box).onclick = function () { toast(c, "Print screen me 'Save as PDF' chunein"); prn(); };
      }).catch(function (x) { box.innerHTML = '<div class="av2-empty">Load nahi hua: ' + e(x.code || x.message || x) + "</div>"; });
    }
    $("[data-run]", m).onclick = run; run();
  } };

  /* =====================================================================
     SETTINGS
     ===================================================================== */
  EXT.adminViews.att_cfg = { icon: "⚙️", label: "Attendance Settings", render: function (m, c) {
    m.innerHTML = '<div class="av2-empty">Loading…</div>';
    loadCfg(c, true).then(function (g) {
      if (!guard("att_cfg", c)) return;
      function tg(k, v) { return '<button class="av2-tg' + (v ? " on" : "") + '" data-tg="' + k + '" aria-label="' + k + '"></button>'; }
      function row(t, s, k, v) { return '<div class="av2-row"><div>' + t + (s ? "<small>" + s + "</small>" : "") + "</div>" + tg(k, v) + "</div>"; }
      var sel = function (k, opts) { return '<select data-k="' + k + '">' + opts.map(function (o) { return '<option value="' + o[0] + '"' + (g[k] === o[0] ? " selected" : "") + ">" + o[1] + "</option>"; }).join("") + "</select>"; };
      m.innerHTML = (g.lat === 0 && g.lng === 0 ? '<div class="av2-note warn">⚠️ <b>Pehle school ki location set karein.</b> Jab tak set nahi hogi, GPS wale attendance Pending me jayenge.</div>' : "") +
        '<div class="av2-card"><div class="av2-h"><b>📍 1. School ki location</b>' + tg("geoEnabled", g.geoEnabled) + '</div>' +
        '<div class="av2-fg"><label>Latitude<input data-k="lat" type="number" step="any" value="' + g.lat + '"></label><label>Longitude<input data-k="lng" type="number" step="any" value="' + g.lng + '"></label></div>' +
        '<div class="av2-loc"><button class="av2-b sec" data-here>📡 Meri abhi ki location lagayein</button><div class="av2-note" data-hs style="display:none"></div><label class="av2-rg">Ya Google Maps se paste karein<input data-paste placeholder="25.5941, 85.1376  ya Maps ka link"></label><small class="av2-hint">Google Maps me school par lamba dabayein → upar jo numbers aayein unhe copy karke yahan paste karein.</small></div>' +
        '<label class="av2-rg">School se kitni door tak attendance mane: <b data-rv>' + g.radiusM + ' m</b><input type="range" min="30" max="500" data-k="radiusM" value="' + Math.min(500, g.radiusM) + '"></label></div>' +
        '<div class="av2-card"><div class="av2-h"><b>⏰ 2. Late ka samay</b></div><label class="av2-rg">Class shuru hone ke itne minute baad aane wale ko Late maano<input data-k="lateMin" type="number" value="' + g.lateMin + '"></label></div>' +
        '<div class="av2-card"><div class="av2-h"><b>🔔 3. Parents ko message</b>' + tg("n.enabled", g.notify.enabled) + '</div>' + row("Bachha Absent ho to message", "Final submit ke baad hi jayega", "n.absent", g.notify.absent) + '<small class="av2-note">Abhi message log me jama hota hai. SMS/WhatsApp bhejne ke liye alag setup chahiye (docs dekhein).</small></div>' +
        '<details class="av2-more"><summary>⚙️ Advanced settings (zaroorat ho tabhi kholein)</summary>' +
        '<div class="av2-card"><div class="av2-h"><b>GPS (advanced)</b></div><label class="av2-rg">Kam se kam GPS accuracy: <b data-av>' + g.maxAccM + ' m</b><input type="range" min="10" max="150" data-k="maxAccM" value="' + Math.min(150, g.maxAccM) + '"></label>' + row("GPS dobara try karne dein", "", "retry", g.retry) +
        '<label class="av2-rg">Student school ke bahar ho to' + sel("locPolicy", [["pending", "Pending (teacher jaanche)"], ["reject", "Seedha reject"], ["off", "GPS check band (sirf QR)"]]) + '</label></div>' +
        '<div class="av2-card"><div class="av2-h"><b>QR (advanced)</b>' + tg("qrEnabled", g.qrEnabled) + '</div><div class="av2-fg c3"><label>QR kitne sec me badle<input data-k="qrRotateSec" type="number" value="' + g.qrRotateSec + '"></label><label>QR kitne sec chale<input data-k="qrValiditySec" type="number" value="' + g.qrValiditySec + '"></label><label>Grace (sec)<input data-k="qrGraceSec" type="number" value="' + g.qrGraceSec + '"></label></div></div>' +
        '<div class="av2-card"><div class="av2-h"><b>Niyam (advanced)</b></div><div class="av2-fg"><label>Attendance shuru time<input data-k="startTime" type="time" value="' + e(g.startTime) + '"></label><label>Attendance aakhri time<input data-k="endTime" type="time" value="' + e(g.endTime) + '"></label></div>' +
        row("Haath se attendance chalu", "", "manualEnabled", g.manualEnabled) + row("Teacher ko correction ki anumati", "", "teacherCorrection", g.teacherCorrection) + row("Present hone par parent ko message", "", "n.present", g.notify.present) + row("Late hone par parent ko message", "", "n.late", g.notify.late) +
        '<label class="av2-rg">Pending wale ka kya ho' + sel("pendingPolicy", [["review", "Teacher jaanch ke baad hi final"], ["auto_absent_24h", "24 ghante baad Final par Absent"]]) + '</label></div></details>' +
        '<div class="av2-save"><span style="flex:1" class="av2-note">Save par server har field jaanchta hai aur badlav Audit Log me jata hai.</span><button class="av2-b" data-save>💾 Save Settings</button></div>';
      $$(".av2-tg", m).forEach(function (b) { b.onclick = function () { b.classList.toggle("on"); }; });
      $$("[data-k]", m).forEach(function (el) { if (el.type === "range") el.oninput = function () { var t = m.querySelector(el.dataset.k === "radiusM" ? "[data-rv]" : "[data-av]"); t.textContent = el.value + " m"; }; });
      function say(t, bad) { var s = $("[data-hs]", m); s.style.display = ""; s.className = "av2-note" + (bad ? " warn" : ""); s.innerHTML = t; }
      function setLL(la, ln) { $('[data-k="lat"]', m).value = (+la).toFixed(6); $('[data-k="lng"]', m).value = (+ln).toFixed(6); }
      $("[data-here]", m).onclick = function () {
        if (!navigator.geolocation) return say("Is browser/app me location available nahi hai. Neeche Google Maps se coordinates paste karein.", true);
        say("Location dhoondh rahe hain… (permission aaye to <b>Allow</b> dabayein)");
        navigator.geolocation.getCurrentPosition(function (p) { setLL(p.coords.latitude, p.coords.longitude); say("✅ Mil gayi (accuracy ±" + Math.round(p.coords.accuracy) + " m). School ke andar khade hokar lagayi ho to <b>Save Settings</b> dabayein."); },
          function (er) {
            var den = er && er.code === 1;
            say(den ? "❌ <b>Location permission band hai.</b><br>• Chrome me: address bar ke 🔒 par dabayein → Permissions → Location → Allow.<br>• ऐप (APK) me: Phone Settings → Apps → is app → Permissions → Location → <b>Allow</b> (naya APK update karna pad sakta hai).<br>• Abhi ke liye: neeche <b>Google Maps se coordinates paste</b> karke bhi set kar sakte hain." : "Location nahi mili (" + e((er && er.message) || "error") + "). Khule me jaakar dobara try karein, ya neeche coordinates paste karein.", true);
          }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
      };
      $("[data-paste]", m).oninput = function () {
        var t = this.value, r = /@(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/.exec(t) || /[?&](?:q|ll)=(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/.exec(t) || /(-?\d{1,2}\.\d{3,})\s*[, ]\s*(-?\d{1,3}\.\d{3,})/.exec(t);
        if (r && Math.abs(+r[1]) <= 90 && Math.abs(+r[2]) <= 180) { setLL(r[1], r[2]); say("✅ Coordinates mil gaye: " + (+r[1]).toFixed(6) + ", " + (+r[2]).toFixed(6) + ". Ab <b>Save Settings</b> dabayein."); }
      };
      $("[data-save]", m).onclick = function () {
        var v = function (k) { return $('[data-k="' + k + '"]', m).value; }, on = function (k) { return $('[data-tg="' + k + '"]', m).classList.contains("on"); };
        var s = { geoEnabled: on("geoEnabled"), lat: +v("lat"), lng: +v("lng"), radiusM: +v("radiusM"), maxAccM: +v("maxAccM"), retry: on("retry"), locPolicy: v("locPolicy"), qrEnabled: on("qrEnabled"), qrRotateSec: +v("qrRotateSec"), qrValiditySec: +v("qrValiditySec"), qrGraceSec: +v("qrGraceSec"), startTime: v("startTime"), endTime: v("endTime"), lateMin: +v("lateMin"), manualEnabled: on("manualEnabled"), teacherCorrection: on("teacherCorrection"), pendingPolicy: v("pendingPolicy"), notify: { enabled: on("n.enabled"), present: on("n.present"), absent: on("n.absent"), late: on("n.late") } };
        var er = s.lat < -90 || s.lat > 90 || isNaN(s.lat) ? "Latitude -90 se 90" : s.lng < -180 || s.lng > 180 || isNaN(s.lng) ? "Longitude -180 se 180" : s.qrValiditySec < s.qrRotateSec ? "QR validity, rotation se kam nahi ho sakti" : s.qrRotateSec < 10 || s.qrRotateSec > 120 ? "QR rotation 10–120 sec" : s.startTime >= s.endTime ? "Shuru time, aakhri time se pehle ho" : s.lateMin < 0 || s.lateMin > 240 ? "Late 0–240 min" : "";
        if (er) return toast(c, "❌ " + er);
        var btn = this; btn.disabled = true;
        api("settings", { settings: s }).then(function () { V.cfg = null; toast(c, "✅ Settings save ho gayi"); EXT.adminViews.att_cfg.render(m, c); }).catch(function (x) { btn.disabled = false; toast(c, "❌ " + x.message); });
      };
    }).catch(function (x) { m.innerHTML = '<div class="av2-empty">Load nahi hua: ' + e(x.code || x.message) + "</div>"; });
  } };

  /* =====================================================================
     AUDIT LOG + NOTIFICATIONS
     ===================================================================== */
  EXT.adminViews.att_audit = { icon: "🧾", label: "Audit Log", render: function (m, c) {
    var F = c.A.av2A = c.A.av2A || { tab: "audit", act: "all", day: "" };
    m.innerHTML = '<div class="av2-card"><div class="av2-seg"><button data-tab="audit" class="' + (F.tab === "audit" ? "on" : "") + '">Audit Log</button><button data-tab="notif" class="' + (F.tab === "notif" ? "on" : "") + '">Parent Notifications</button></div></div><div id="av2-ab"><div class="av2-empty">Loading…</div></div>';
    $$("[data-tab]", m).forEach(function (b) { b.onclick = function () { F.tab = b.dataset.tab; EXT.adminViews.att_audit.render(m, c); }; });
    var q = F.tab === "audit" ? isub(c, "attendanceAudit").orderBy("atMs", "desc").limit(200) : isub(c, "attendanceNotifications").orderBy("createdAt", "desc").limit(200);
    q.get().then(function (s) {
      if (!guard("att_audit", c)) return; var box = $("#av2-ab", m), rows = s.docs.map(function (d) { return d.data(); });
      if (F.tab === "audit") {
        var acts = {}; rows.forEach(function (r) { acts[r.action] = 1; });
        rows = rows.filter(function (r) { return (F.act === "all" || r.action === F.act) && (!F.day || ymd(r.atMs) === F.day); });
        box.innerHTML = '<div class="av2-card"><div class="av2-filters"><input type="date" data-day value="' + e(F.day) + '"><select data-act><option value="all">Sabhi Action</option>' + Object.keys(acts).map(function (a) { return '<option' + (F.act === a ? " selected" : "") + ">" + e(a) + "</option>"; }).join("") + '</select></div><div class="av2-tw"><table><thead><tr><th>Samay</th><th>Kisne</th><th>Student / Session</th><th>Action</th><th>Pehle → Baad me</th><th>Kaaran</th></tr></thead><tbody>' +
          (rows.length ? rows.map(function (r) { return "<tr><td>" + e(dd(r.atMs)) + " " + tm(r.atMs) + "</td><td>" + e(r.by || "") + "</td><td>" + e(r.studentName || r.sessionId || r.detail || "") + '</td><td><span class="av2-pill v">' + e(r.action) + "</span></td><td>" + e((r.prevStatus || "—") + " → " + (r.newStatus || "—")) + '</td><td class="wrap">' + e(r.reason || "") + "</td></tr>"; }).join("") : '<tr><td colspan="6"><div class="av2-empty">Koi entry nahi.</div></td></tr>') + "</tbody></table></div></div>";
        $("[data-day]", box).onchange = function () { F.day = this.value; EXT.adminViews.att_audit.render(m, c); }; $("[data-act]", box).onchange = function () { F.act = this.value; EXT.adminViews.att_audit.render(m, c); };
      } else box.innerHTML = '<div class="av2-card"><div class="av2-tw"><table><thead><tr><th>Student</th><th>Type</th><th>Delivery</th><th>Session</th></tr></thead><tbody>' + (rows.length ? rows.map(function (r) { return "<tr><td>" + e(r.name || r.mobile) + '</td><td><span class="av2-pill ' + ({ absent: "a", late: "l", present: "p" }[r.type] || "u") + '">' + e(r.type) + "</span></td><td>" + e({ not_configured: "Queued (provider set nahi)", sent: "Sent", failed: "Failed" }[r.delivery] || r.delivery) + "</td><td>" + e(r.sessionId) + "</td></tr>"; }).join("") : '<tr><td colspan="4"><div class="av2-empty">Abhi koi notification log nahi.</div></td></tr>') + "</tbody></table></div></div>";
    }).catch(function (x) { $("#av2-ab", m).innerHTML = '<div class="av2-empty">Load nahi hua: ' + e(x.code || x.message) + "<br>Firestore Rules publish kiye?</div>"; });
  } };

  /* ---------------- SIMPLE MENU: sirf 4 sidebar items, baaki tabs ke andar ---------------- */
  var HOSTS = [
    ["att_home", "🗓️", "Attendance", [["att_dash", "Aaj ka haal"], ["att_rep", "Reports"], ["att_cfg", "Settings"]], [["att_stu", "Student ka record"], ["att_abs", "Absent list"], ["att_audit", "Badlav ka record"], ["att_set", "NFC Cards"], ["att_sched", "Class Schedule"]]],
    ["att_take", "▶️", "Attendance Lagayein", [["att_live", "📱 QR se"], ["att_manual", "✍️ Haath se"], ["att_pend", "⏳ Jaanch baaki"]], []]
  ];
  var av = EXT.adminViews;
  if (av.att_set) { av.att_set.label = "NFC Cards"; }
  HOSTS.forEach(function (h) { h[3].concat(h[4]).forEach(function (t) { if (av[t[0]]) { av[t[0]].hidden = true; HOSTOF[t[0]] = h[0]; } }); });
  HOSTS.forEach(function (h) {
    HOSTOF[h[0]] = null; delete HOSTOF[h[0]];
    av[h[0]] = { icon: h[1], label: h[2], render: function (m, c) {
      c.A.attTab = c.A.attTab || {}; var tabs = h[3].concat(h[4]).filter(function (t) { return av[t[0]]; }), cur = c.A.attTab[h[0]];
      if (!tabs.some(function (t) { return t[0] === cur; })) cur = tabs[0][0];
      c.A.attTab[h[0]] = cur; c.A.attHost = h[0]; c.A.attSub = cur;
      var prim = h[3].filter(function (t) { return av[t[0]]; }), more = h[4].filter(function (t) { return av[t[0]]; }), inMore = more.some(function (t) { return t[0] === cur; });
      function tb(t) { return '<button data-tab="' + t[0] + '" class="' + (t[0] === cur ? "on" : "") + '">' + t[1] + "</button>"; }
      m.innerHTML = '<div class="av2-tabs">' + prim.map(tb).join("") + (more.length ? '<button data-more class="' + (inMore ? "on" : "") + '">⋯ Aur</button>' : "") + '</div>' + (more.length ? '<div class="av2-tabs av2-morebar" style="display:' + (inMore ? "flex" : "none") + '">' + more.map(tb).join("") + "</div>" : "") + '<div id="av2-tab"></div>';
      $$("[data-tab]", m).forEach(function (b) { b.onclick = function () { c.A.attTab[h[0]] = b.dataset.tab; av[h[0]].render(m, C()); }; });
      var mb = $("[data-more]", m); mb && (mb.onclick = function () { var bar = $(".av2-morebar", m); bar.style.display = bar.style.display === "none" ? "flex" : "none"; });
      try { av[cur].render($("#av2-tab", m), c); } catch (x) { console.warn(x); $("#av2-tab", m).innerHTML = '<div class="av2-empty">Ye section load nahi hua: ' + e(x.message || x) + "</div>"; }
    } };
  });
  if (av.att_take) av.att_take.hidden = true;   /* QR/Manual/Pending sirf batch ke andar */
  /* sidebar me sirf 4 host (purane views ke baad naye keys add hue, hidden wale sidebar me nahi aate) */
  window.SnapAttV2 = { openClass: OLDOPEN, startFor: startFor, api: api, openStudent: function (c, b, mob) { V.pre = { stuB: b, stuM: mob }; go(c, "att_stu"); } };
})();
