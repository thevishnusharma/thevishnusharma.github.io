/* SnapTest Pro — Smart Attendance v2 — STUDENT side
   Student "Attendance" tab = Live session card (agar teacher ne QR session shuru kiya) + purani history (monthly/weekly/daily).
   Flow: GPS check -> QR scan (camera) -> Worker /attendance/verify -> Present / Late / Pending.
   Student kabhi school ki GPS location nahi dekhta; sab verification server par hota hai. */
(function () {
  "use strict";
  var SB = window.SnapBatch;
  if (!SB || !SB.ext || !SB.ext.studentTabs || !SB.ext.studentTabs.attendance) return;
  if ((window.SNAP_CONFIG || {}).attendance === false) return;
  var EXT = SB.ext, OLD = EXT.studentTabs.attendance, W = { unsub: null, unsubR: null, flow: null, cfg: {} };
  var REASON = { gps_missing: "Location nahi mili", gps_denied: "Location permission nahi di", gps_accuracy: "GPS accuracy kam thi", gps_stale: "Location purani thi", outside: "School area se bahar", geo_not_configured: "School location set nahi", camera: "Camera nahi chala", qr_failed: "QR scan nahi hua", other: "Technical problem" };
  var ERR = { qr_invalid: "Ye QR sahi nahi hai. Teacher ke screen ka QR scan karein.", qr_expired: "QR expire ho gaya. Naya QR scan karein.", not_member: "Aap is batch ke student nahi hain.", session_closed: "Ye session ab band ho chuka hai.", time_window: "Abhi attendance ka time nahi hai.", outside: "Aap school area ke bahar hain.", rate_limited: "Bahut zyada koshish. Thodi der baad try karein." };

  function e(t) { return String(t == null ? "" : t).replace(/[&<>"']/g, function (x) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[x]; }); }
  function tm(t) { return t ? new Date(t).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }) : ""; }
  function $(s, r) { return (r || document).querySelector(s); }
  function mobile(c) { var s = c.sess && c.sess(); return s && s.mobile ? String(s.mobile) : ""; }
  function AUTH() { try { return typeof getAuth === "function" ? getAuth() : window.vishnuFirebase && window.vishnuFirebase.auth; } catch (x) { return null; } }
  function api(op, body) {
    var a = AUTH(), u = a && a.currentUser;
    if (!u) return Promise.reject(Object.assign(new Error("Login nahi hai"), { status: 401 }));
    return u.getIdToken().then(function (t) {
      var w = String((window.SNAP_CONFIG || {}).workerUrl || "").replace(/\/+$/, ""); if (!w) throw new Error("Server set nahi hai");
      return fetch(w + "/attendance/" + op, { method: "POST", headers: { Authorization: "Bearer " + t, "Content-Type": "application/json" }, body: JSON.stringify(body || {}), cache: "no-store" });
    }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok || j.ok === false) { var er = new Error(j.error || "Request fail"); er.data = j; er.status = r.status; throw er; } return j; }); });
  }
  function unsub() { try { W.unsub && W.unsub(); } catch (x) {} try { W.unsubR && W.unsubR(); } catch (x) {} W.unsub = W.unsubR = null; }

  /* ---------------- tab ---------------- */
  EXT.studentTabs.attendance = { label: OLD.label || "Attendance", st: OLD.st, render: function (b, box, c) {
    if (box.classList && box.classList.contains("av2-hist")) return OLD.render(b, box, c);          /* purani history khud ko dobara render karti hai */
    unsub();
    box.innerHTML = '<div class="av2-s"><div id="av2-sl"></div><div class="av2-hist"></div></div>';
    OLD.st = EXT.studentTabs.attendance.st;
    var hist = $(".av2-hist", box), live = $("#av2-sl", box); OLD.render(b, hist, c); EXT.studentTabs.attendance.st = OLD.st;
    var mob = mobile(c); if (!mob) return;
    live.innerHTML = '<div class="av2-sempty">Live attendance check ho rahi hai…</div>';
    var ref = c.bref(c.A.inst, b.id)   /* purani student tab bhi yahi use karti hai */;
    try {
      W.unsub = ref.collection("attendanceLive").where("status", "==", "active").onSnapshot(function (q) {
        if (!document.body.contains(live)) { unsub(); return; }
        var s = q.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); }).sort(function (x, y) { return (y.startedAtMs || 0) - (x.startedAtMs || 0); })[0];
        if (!s) { try { W.unsubR && W.unsubR(); } catch (x) {} W.unsubR = null; live.innerHTML = '<div class="av2-sempty">📡 Abhi koi live attendance session nahi hai.<br><small>Teacher jab QR attendance shuru karenge, yahan dikhega.</small></div>'; return; }
        try { W.unsubR && W.unsubR(); } catch (x) {}
        W.unsubR = ref.collection("attendanceRecords").doc(s.id + "_" + mob).onSnapshot(function (d) { paintLive(c, b, live, s, d.exists ? d.data() : null); }, function () { paintLive(c, b, live, s, null); });
      }, function (x) { live.innerHTML = '<div class="av2-sempty">Live session load nahi hua (' + e(x.code || x.message) + ')</div>'; });
    } catch (x) { live.innerHTML = ""; }
  } };

  function paintLive(c, b, live, s, rec) {
    var st = rec && rec.status, done = st === "present" || st === "late" || st === "absent";
    live.innerHTML = '<div class="av2-slive"><span class="av2-pill live">● LIVE</span><h3>' + e(s.subject || s.title || "Class") + '</h3><small>' + e(s.teacher || "") + (s.teacher ? " · " : "") + "Shuru " + tm(s.startedAtMs) + "</small>" +
      (done ? '<div class="av2-sempty" style="margin-top:12px;color:#0f172a">' + (st === "absent" ? "❌ Teacher ne aapko Absent mark kiya hai." : "✅ Aapki attendance lag gayi: <b>" + (st === "late" ? "Late" : "Present") + "</b> · " + tm(rec.markedMs)) + "</div>" :
        st === "pending" ? '<div class="av2-sempty" style="margin-top:12px;color:#0f172a">⏳ Aapki attendance <b>Pending</b> hai (' + e(REASON[rec.pendingReason] || "teacher review") + '). Teacher confirm karenge.</div><button class="av2-b" data-go>↻ Dobara try karein</button>' :
          '<button class="av2-b" data-go>📍 Attendance Lagayein</button>') + "</div>";
    var g = $("[data-go]", live); g && (g.onclick = function () { startFlow(c, b, s); });
  }

  /* ---------------- flow ---------------- */
  function closeFlow() { var F = W.flow; if (!F) return; stopCam(); F.closed = true; F.o && F.o.remove(); W.flow = null; }
  function stopCam() { var F = W.flow; if (!F) return; try { F.scan && F.scan.stop && F.scan.stop(); } catch (x) {} F.scan = null; try { F.stream && F.stream.getTracks().forEach(function (t) { t.stop(); }); } catch (x) {} F.stream = null; clearInterval(F.det); F.det = null; }
  function frame(step, title, html) {
    var F = W.flow; if (!F || F.closed) return;
    F.o.innerHTML = '<header><button data-x aria-label="Band">←</button><b>' + e(title) + '</b></header><div class="av2-steps">' + ["Login", "GPS", "QR Scan", "Result"].map(function (x, i) { return '<i class="' + (i < step ? "ok" : i === step ? "on" : "") + '"></i>'; }).join("") + '</div><div class="av2-fbody">' + html + "</div>";
    $("[data-x]", F.o).onclick = closeFlow;
  }
  function startFlow(c, b, s) {
    closeFlow();
    var o = document.createElement("div"); o.className = "av2-flow"; document.body.appendChild(o);
    W.flow = { o: o, c: c, b: b, s: s, geo: null, bid: b.id, pendingReason: "" };
    api("config", { batchId: b.id }).then(function (r) { W.cfg = r.config || r.settings || r || {}; step_gps(); }).catch(function () { W.cfg = {}; step_gps(); });
  }
  function step_gps() {
    var F = W.flow; if (!F) return; var cfg = W.cfg || {};
    if (cfg.geoEnabled === false || cfg.locPolicy === "off") { F.geo = null; return step_qr(); }
    frame(1, "Location check", '<div class="av2-ic">📍</div><h3>Aapki location jaanch rahe hain…</h3><p>Browser location permission maange to <b>Allow</b> dabayein. Aapki exact location dusre students ko nahi dikhti.</p>');
    if (!navigator.geolocation) { return gpsFail("gps_missing", "Is device me location available nahi hai."); }
    navigator.geolocation.getCurrentPosition(function (p) {
      var F2 = W.flow; if (!F2 || F2.closed) return;
      var acc = p.coords.accuracy;
      F2.geo = { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: acc, ts: p.timestamp || Date.now() };
      if (cfg.maxAccM && acc > cfg.maxAccM) return gpsFail("gps_accuracy", "GPS accuracy kam hai (±" + Math.round(acc) + " m, chahiye ±" + cfg.maxAccM + " m). Khule me aakar dobara try karein.", true);
      frame(1, "Location mili ✔", '<div class="av2-ic g">✔</div><h3>Location mil gayi</h3><p>Accuracy ±' + Math.round(acc) + " m. Ab teacher ka QR scan karein.</p>");
      setTimeout(function () { step_qr(); }, 700);
    }, function (er) { gpsFail(er && er.code === 1 ? "gps_denied" : "gps_missing", er && er.code === 1 ? "Location permission band hai. Phone Settings → Apps → (is app/Chrome) → Permissions → Location → Allow karein, phir \"Dobara try karein\" dabayein." : "Location nahi mil paayi."); }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 5000 });
  }
  function gpsFail(reason, msg, hasGeo) {
    var F = W.flow; if (!F) return; F.pendingReason = reason; var cfg = W.cfg || {};
    frame(1, "Location problem", '<div class="av2-ic y">⚠️</div><h3>Location verify nahi hui</h3><p>' + e(msg) + '</p>' + (cfg.retry === false ? "" : '<button class="av2-b" data-r>↻ Dobara try karein</button>') +
      (cfg.locPolicy === "reject" ? "" : '<button class="av2-b sec" data-c>QR scan karein (teacher review ke liye Pending)</button>') + '<button class="av2-b ghost" data-x2>Cancel</button>');
    var r = $("[data-r]", F.o); r && (r.onclick = step_gps); var cc = $("[data-c]", F.o); cc && (cc.onclick = step_qr); $("[data-x2]", F.o).onclick = closeFlow;
  }
  function step_qr() {
    var F = W.flow; if (!F || F.closed) return;
    frame(2, "QR Scan", '<div class="av2-vid" id="av2-vid"></div><div id="av2-rd" style="display:none"></div><p id="av2-qm">Camera chal raha hai… teacher ke screen ka QR frame me rakhein.</p><button class="av2-b ghost" data-x2>Cancel</button>');
    $("[data-x2]", F.o).onclick = closeFlow;
    var done = false;
    function got(txt) { if (done) return; txt = String(txt || ""); if (txt.indexOf("SA1.") !== 0) { var m = $("#av2-qm", F.o); m && (m.textContent = "Ye attendance QR nahi hai. Dobara koshish karein."); return; } done = true; stopCam(); submit(txt); }
    function fallback(why) {
      if (done) return; stopCam(); var vid = $("#av2-vid", F.o), rd = $("#av2-rd", F.o); if (!vid) return; vid.style.display = "none"; rd.style.display = "block";
      function lib() { return window.Html5Qrcode ? Promise.resolve() : new Promise(function (res, rej) { var s = document.createElement("script"); s.src = "https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.8/html5-qrcode.min.js"; s.onload = res; s.onerror = rej; document.head.appendChild(s); }); }
      lib().then(function () { if (!W.flow || W.flow.closed) return; var q = new Html5Qrcode("av2-rd"); F.scan = q; return q.start({ facingMode: "environment" }, { fps: 10, qrbox: 240 }, got, function () {}); })
        .catch(function () { camFail(why); });
    }
    function camFail(why) { var F2 = W.flow; if (!F2 || F2.closed) return; stopCam(); F2.pendingReason = F2.pendingReason || "camera"; frame(2, "Camera problem", '<div class="av2-ic y">📷</div><h3>Camera nahi chala</h3><p>' + e(why === "denied" ? "Camera permission band hai. Settings me Camera Allow karein." : "QR scan nahi ho paaya.") + " Aap teacher ko manual review ke liye bhej sakte hain.</p><button class=\"av2-b\" data-r>↻ Dobara try karein</button><button class=\"av2-b sec\" data-p>Teacher ko review ke liye bhejein</button><button class=\"av2-b ghost\" data-x2>Cancel</button>"); $("[data-r]", F2.o).onclick = step_qr; $("[data-p]", F2.o).onclick = function () { submit(""); }; $("[data-x2]", F2.o).onclick = closeFlow; }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return camFail("na");
    navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false }).then(function (stream) {
      if (!W.flow || W.flow.closed) { stream.getTracks().forEach(function (t) { t.stop(); }); return; }
      F.stream = stream; var v = document.createElement("video"); v.setAttribute("playsinline", ""); v.muted = true; v.srcObject = stream; var host = $("#av2-vid", F.o); host.appendChild(v); v.play().catch(function () {});
      if ("BarcodeDetector" in window) {
        var bd; try { bd = new BarcodeDetector({ formats: ["qr_code"] }); } catch (x) { return fallback(); }
        F.det = setInterval(function () { if (v.readyState < 2) return; bd.detect(v).then(function (r) { r && r[0] && got(r[0].rawValue); }).catch(function () {}); }, 300);
      } else fallback();
    }).catch(function (er) { camFail(er && (er.name === "NotAllowedError" || er.name === "SecurityError") ? "denied" : "na"); });
  }
  function submit(token) {
    var F = W.flow; if (!F) return; stopCam();
    frame(3, "Verify ho raha hai", '<div class="av2-ic">⏳</div><h3>Attendance verify ho rahi hai…</h3>');
    var req;
    if (!token) req = api("pending", { batchId: F.bid, sessionId: F.s.id, reason: "camera" });   /* QR scan nahi hua: teacher review (Pending) */
    else {
      var body = { batchId: F.bid, sessionId: F.s.id, token: token };
      if (F.geo) { body.lat = F.geo.lat; body.lng = F.geo.lng; body.accuracy = F.geo.accuracy; body.locTs = F.geo.ts; }
      else if (F.pendingReason === "gps_denied") body.gpsDenied = true;
      req = api("verify", body);
    }
    req.then(function (r) {
      var st = r.status;
      if (r.already && st !== "pending") { frame(3, "Pehle se lagi hai", '<div class="av2-ic g">✔</div><h3>Attendance pehle se lagi hai</h3><p><b>' + (st === "late" ? "Late" : "Present") + '</b></p><button class="av2-b" data-d>Theek hai</button>'); return void ($("[data-d]", W.flow.o).onclick = closeFlow); }
      if (st === "pending") return frame(3, "Pending", '<div class="av2-ic y">⏳</div><h3>Teacher review ke liye bheja gaya</h3><p>' + e(REASON[r.reason || r.pendingReason] || "Verification poori nahi hui") + ". Aapko Absent nahi gina gaya. Teacher confirm karenge.</p><button class=\"av2-b\" data-d>Theek hai</button>"), $("[data-d]", W.flow.o).onclick = closeFlow;
      frame(3, "Done", '<div class="av2-ic g">✔</div><h3>Attendance lag gayi ✅</h3><p><b>' + (st === "late" ? "Late" : "Present") + "</b> · " + tm(r.markedMs || Date.now()) + (r.distanceM != null ? "<br>School se doori: " + r.distanceM + " m" : "") + '</p><button class="av2-b" data-d>Theek hai</button>');
      $("[data-d]", W.flow.o).onclick = closeFlow;
    }).catch(function (x) {
      var d = x.data || {}, code = d.code || "", F2 = W.flow; if (!F2) return;
            var retry = code === "qr_expired" || code === "qr_invalid" || (d.retry && code !== "outside");
      frame(3, "Attendance nahi lagi", '<div class="av2-ic r">✖</div><h3>Attendance nahi lagi</h3><p>' + e(x.message || ERR[code] || "Kuch gadbad hui") + (d.distanceM != null ? "<br>Aap school se " + d.distanceM + " m door hain." : "") + "</p>" + (retry ? '<button class="av2-b" data-r>↻ Dobara scan karein</button>' : "") + '<button class="av2-b ghost" data-x2>Band karein</button>');
      var r = $("[data-r]", F2.o); r && (r.onclick = step_qr); $("[data-x2]", F2.o).onclick = closeFlow;
    });
  }
  window.SnapAttV2Student = { start: startFlow };
})();
