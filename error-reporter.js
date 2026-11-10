/* v168 — Silent Error Reporter (student/admin ko kuch nahi dikhta; owner ko automatic alert jata hai)
   Kya pakadta hai:
     - JS errors, unhandled promise errors, script/css load fail
     - Firestore/Firebase errors (permission-denied, quota/resource-exhausted, unavailable...)
     - Firebase SDK load na hona, bahut slow load (LCP/startup), login/save fail (SnapAlert.report se)
   Alert Cloudflare Worker (/alert) par jata hai -> Worker owner ko push (FCM topic "owner_alerts") aur
   (optional) Telegram bhejta hai. Worker down/offline ho to alert phone me queue hota hai, baad me chala jata hai.
   Student ke liye koi toast/popup nahi. Ye file kabhi koi error throw nahi karti. */
(function () {
  "use strict";
  if (window.SnapAlert) return;

  var Q_KEY = "snap_alert_q_v1", COOL_KEY = "snap_alert_cool_v1", SLOW_KEY = "snap_alert_slow_v1";
  var SESSION_MAX = 12, COOLDOWN_MS = 30 * 60 * 1000, QUEUE_MAX = 25;
  var sent = 0, booted = Date.now(), seenSession = {}, flushing = false;

  function cfg() { return window.SNAP_CONFIG || {}; }
  function url() {
    var c = cfg();
    return String(c.alertUrl || ((c.workerUrl || "https://cool-thunder-a280.vishnu1234stm.workers.dev") + "/alert"));
  }
  function ls(k, v) {
    try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) {}
    return null;
  }
  function jget(k, d) { try { return JSON.parse(ls(k) || "null") || d; } catch (e) { return d; } }

  function platform() {
    try { var C = window.Capacitor; if (C && (C.isNativePlatform ? C.isNativePlatform() : C.platform && C.platform !== "web")) return "apk"; } catch (e) {}
    try { if (window.matchMedia && matchMedia("(display-mode: standalone)").matches) return "pwa"; } catch (e) {}
    return "web";
  }
  function role() {
    try {
      var a = typeof getAuth === "function" ? getAuth() : null, u = a && a.currentUser;
      if (u && !u.isAnonymous && u.email) return /thevishnusharmaapp@gmail\.com/i.test(u.email) ? "owner" : "admin";
    } catch (e) {}
    try { if (typeof getStudentSession === "function" && getStudentSession()) return "student"; } catch (e) {}
    return "guest";
  }
  function instituteId() {
    try { var s = typeof getStudentSession === "function" ? getStudentSession() : null; if (s && s.instituteId) return String(s.instituteId); } catch (e) {}
    try { if (typeof getCurrentAdminInstituteId === "function") { var i = getCurrentAdminInstituteId(); if (i) return String(i); } } catch (e) {}
    return "";
  }
  function screenName() {
    try {
      var ids = ["exam-screen", "solution-screen", "result-screen", "student-dashboard", "admin-dashboard", "login-screen"];
      for (var i = 0; i < ids.length; i++) { var el = document.getElementById(ids[i]); if (el && !el.classList.contains("hidden") && el.offsetParent !== null) return ids[i]; }
    } catch (e) {}
    return (location.hash || location.pathname || "").slice(0, 60);
  }
  function conn() { try { var c = navigator.connection; return c ? (c.effectiveType || "") + (c.downlink ? "/" + c.downlink + "Mbps" : "") : ""; } catch (e) { return ""; } }
  function scrub(v) {
    return String(v == null ? "" : v)
      .replace(/\bBearer\s+[A-Za-z0-9._~+/-]{10,}={0,2}/gi, "Bearer [redacted]")
      .replace(/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g, "[token]")
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]")
      .replace(/(?:\+?91[\s().-]?)?[6-9]\d{9}\b/g, "[phone]")
      .replace(/([?&](?:token|access_token|refresh_token|id_token|key|api_key|email|mobile|phone|code|password|secret)=)[^&#\s]*/gi, "$1[redacted]")
      .replace(/\b(studentname|name)\s*[:=]\s*(?:"[^"]*"|'[^']*'|[^,;|]+)/gi, "$1=[redacted]")
      .replace(/\b(password|passcode|pin|token|access[_-]?token|refresh[_-]?token|id[_-]?token|api[_-]?key|authorization|secret|private[_-]?key|email|mobile|phone|answer)\s*[:=]\s*(?:"[^"]*"|'[^']*'|[^\s,;|]+)/gi, "$1=[redacted]");
  }
  function s(v, n) { return scrub(v).replace(/\s+/g, " ").slice(0, n); }

  function fingerprint(type, msg, src) { return s(type, 24) + "|" + s(msg, 100) + "|" + s(src, 80); }

  var IGNORE = [
    /ResizeObserver loop/i, /^Script error\.?$/i, /chrome-extension:|moz-extension:|safari-extension:/i,
    /AbortError|The user aborted|The operation was aborted/i, /Non-Error promise rejection/i,
    /Failed to fetch|NetworkError|Load failed|network request failed/i,       // user ka internet — bug nahi
    /ServiceWorker|service worker/i, /play\(\) request was interrupted/i, /Notification permission/i,
    /Could not reach Cloud Firestore backend|Backend didn't respond within|operate in offline mode|client is offline/i,   // v200: user ke slow/toote internet ka SDK message — bug nahi
    /^(unavailable|deadline-exceeded):/i,
    /Failed to obtain primary lease/i, /Backfill Indexes/i                         // v177: Firestore multi-tab offline cache ka harmless warning (app ek se zyada tab/window me khula) — bug nahi
  ];
  function ignored(msg) { for (var i = 0; i < IGNORE.length; i++) if (IGNORE[i].test(msg)) return true; return false; }

  function severity(msg) {
    if (/resource-exhausted|quota|exceeded/i.test(msg)) return "critical";
    if (/permission-denied|Missing or insufficient permissions/i.test(msg)) return "error";
    if (/unavailable|deadline-exceeded/i.test(msg)) return "warn";
    return "error";
  }

  function build(type, msg, extra, sev) {
    var c = cfg();
    return {
      t: Date.now(), type: s(type, 24), sev: sev || severity(msg), msg: s(msg, 400),
      src: s(extra && extra.src, 160), stack: s(extra && extra.stack, 600),
      role: role(), inst: s(instituteId(), 60), plat: platform(), screen: s(screenName(), 60),
      app: s(c.version || "", 12) + "/" + s(c.build || "", 8), net: conn(), online: navigator.onLine !== false,
      ua: s(navigator.userAgent, 140), up: Math.round((Date.now() - booted) / 1000), ctx: s(extra && extra.ctx, 160)
    };
  }

  function queue(a) {
    var q = jget(Q_KEY, []); q.push(a); if (q.length > QUEUE_MAX) q = q.slice(-QUEUE_MAX);
    ls(Q_KEY, JSON.stringify(q));
  }
  function post(a) {
    var body = JSON.stringify(a);
    try {
      return fetch(url(), { method: "POST", headers: { "Content-Type": "text/plain" }, body: body, keepalive: true, mode: "cors" })
        .then(function (r) { return r.ok; }).catch(function () { return false; });
    } catch (e) { return Promise.resolve(false); }
  }
  function flush() {
    if (flushing || navigator.onLine === false) return;
    var q = jget(Q_KEY, []); if (!q.length) return;
    flushing = true; ls(Q_KEY, "[]");
    var left = [];
    (function next(i) {
      if (i >= q.length) { flushing = false; if (left.length) { var cur = jget(Q_KEY, []); ls(Q_KEY, JSON.stringify(left.concat(cur).slice(-QUEUE_MAX))); } return; }
      post(q[i]).then(function (ok) { if (!ok) left.push(q[i]); setTimeout(function () { next(i + 1); }, 400); });
    })(0);
  }

  function report(type, msg, extra, sev) {
    try {
      msg = s(msg, 400); if (!msg || ignored(msg)) return;
      var fp = fingerprint(type, msg, extra && extra.src);
      if (seenSession[fp]) { seenSession[fp]++; return; }
      seenSession[fp] = 1;
      if (sent >= SESSION_MAX) return;
      var cool = jget(COOL_KEY, {}), now = Date.now();
      if (cool[fp] && now - cool[fp] < COOLDOWN_MS) return;
      cool[fp] = now;
      var keys = Object.keys(cool); if (keys.length > 60) keys.sort(function (x, y) { return cool[x] - cool[y]; }).slice(0, keys.length - 60).forEach(function (k) { delete cool[k]; });
      ls(COOL_KEY, JSON.stringify(cool));
      sent++;
      var a = build(type, msg, extra, sev);
      if (a.online === false) { queue(a); return; }
      post(a).then(function (ok) { if (!ok) queue(a); });
    } catch (e) {}
  }

  window.SnapAlert = { report: function (t, m, x, sv) { report(t, m, x, sv); }, flush: flush };

  /* ---- JS errors + resource load fail ---- */
  window.addEventListener("error", function (e) {
    try {
      if (e && e.target && e.target !== window && (e.target.src || e.target.href)) {            // script/css/img load fail
        var u = e.target.src || e.target.href;
        /* v200: sirf asli .js/.css file ka load fail (page-URL / image wagairah slow internet me fail hote hain — bug nahi) */
        if ((/^(https?:)?\/\/(www\.gstatic\.com|cdnjs\.cloudflare\.com|fonts\.)/.test(u) || u.indexOf(location.origin) === 0) && /\.(m?js|css)$/i.test(String(u).split(/[?#]/)[0]))
          report("resource", "Load fail: " + String(u).slice(0, 150), { src: u }, /firebase|script\.js|index\.html/i.test(u) ? "critical" : "warn");
        return;
      }
      var msg = (e && e.message) || "";
      report("js", msg, { src: (e.filename || "").split("/").pop() + ":" + (e.lineno || 0), stack: e.error && e.error.stack });
    } catch (x) {}
  }, true);

  window.addEventListener("unhandledrejection", function (e) {
    try {
      var r = e && e.reason, msg = r && (r.code ? r.code + ": " : "") + (r.message || r) || "";
      report("promise", msg, { stack: r && r.stack });
    } catch (x) {}
  });

  /* ---- Firebase/Firestore SDK console.error (listener errors yahin aate hain) ---- */
  try {
    var oe = console.error;
    console.error = function () {
      try {
        var a = Array.prototype.slice.call(arguments), m = a.map(function (x) { return x && x.message ? (x.code ? x.code + ": " : "") + x.message : typeof x === "string" ? x : ""; }).join(" ");
        if (/firestore|firebase|@firebase/i.test(m)) report("firebase", m);
      } catch (x) {}
      return oe.apply(console, arguments);
    };
  } catch (e) {}

  /* ---- Health: Firebase SDK / app boot ---- */
  window.addEventListener("load", function () {
    setTimeout(function () {
      try {
        if (typeof firebase === "undefined") report("health", "Firebase SDK load nahi hua (10s baad bhi)", {}, "critical");
        else if (!(window.vishnuFirebase && window.vishnuFirebase.enabled)) report("health", "Firebase initialize/enabled nahi hua (firebase-config)", {}, "critical");
      } catch (e) {}
    }, 10000);
    setTimeout(flush, 3000);
  });
  window.addEventListener("online", function () { setTimeout(flush, 1500); });

  /* ---- Slow startup (LCP) — din me ek baar per device, sirf agar 4s se zyada ---- */
  try {
    if (window.PerformanceObserver) {
      var lcp = 0;
      new PerformanceObserver(function (l) { var en = l.getEntries(), x = en[en.length - 1]; if (x) lcp = x.startTime; }).observe({ type: "largest-contentful-paint", buffered: true });
      var done = false, check = function () {
        if (done) return; done = true;
        try {
          var day = new Date().toISOString().slice(0, 10);
          if (lcp > 10000 && ls(SLOW_KEY) !== day) { ls(SLOW_KEY, day); report("slow", "Slow startup: LCP " + Math.round(lcp) + "ms", { ctx: "net=" + conn() }, "warn"); }
        } catch (e) {}
      };
      document.addEventListener("visibilitychange", function () { if (document.visibilityState === "hidden") check(); });
      setTimeout(check, 15000);
    }
  } catch (e) {}
})();
