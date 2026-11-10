/* Real push (app band ho tab bhi) — FCM topic + free Cloudflare Worker relay.
   Website (browser) par ye kuch nahi karta; sirf Android app me chalta hai.
   STUDENT: login ke baad apne institute ke topic "inst_<id>" ko subscribe.
   ADMIN  : notification save hone ke baad window.SnapPush.send(notifId) Worker ko bulata hai. */
(function () {
  "use strict";
  // ⬇️ Cloudflare Worker deploy karne ke baad uska URL yahan daalein (PUSH_SETUP_FREE_REALTIME.md dekhein)
  var PUSH_WORKER_URL = "https://cool-thunder-a280.vishnu1234stm.workers.dev";

  var OPT_OUT = "savya_push_optout_v1", SUB_KEY = "snap_fcm_topic_v1", ASKED = "snap_fcm_asked_v1";
  function getCap() {
    var w = []; try { if (window.top) w.push(window.top); } catch (e) {}
    try { if (window.parent && window.parent !== window.top) w.push(window.parent); } catch (e) {}
    w.push(window);
    for (var i = 0; i < w.length; i++) { try { var c = w[i].Capacitor; if (c && typeof c.nativePromise === "function") return c; } catch (e) {} }
    return null;
  }
  function toast(m) {
    try { var b = document.createElement("div"); b.textContent = m;
      b.style.cssText = "position:fixed;left:50%;top:18px;transform:translateX(-50%);background:#0f172a;color:#fff;padding:10px 16px;border-radius:14px;font-size:.8rem;z-index:2147483647;max-width:90vw;text-align:center;box-shadow:0 6px 18px rgba(0,0,0,.35);pointer-events:none";
      document.body.appendChild(b); setTimeout(function () { b.remove(); }, 5000); } catch (e) {}
  }
  function batchTopic(i, b) { var re = /[^a-zA-Z0-9\-_.~%]/g; return "bat_" + String(i).replace(re, "_") + "_" + String(b).replace(re, "_"); }
  function appTopicFor(id) { return "app_inst_" + String(id).replace(/[^a-zA-Z0-9\-_.~%]/g, "_"); }   // sirf apne institute ka app update
  function topicFor(id) { return "inst_" + String(id).replace(/[^a-zA-Z0-9\-_.~%]/g, "_"); }
  function native(method, opts) { var C = getCap(); return C ? C.nativePromise("FirebaseMessaging", method, opts || {}) : Promise.reject(new Error("no plugin")); }

  /* ---------- Admin: Worker ko bulao ---------- */
  var PQ = "snap_push_queue_v1";
  function pqGet() { try { return JSON.parse(localStorage.getItem(PQ) || "[]") || []; } catch (e) { return []; } }
  function pqAdd(id) { try { var q = pqGet(); if (q.indexOf(id) < 0) q.push(id); localStorage.setItem(PQ, JSON.stringify(q)); } catch (e) {} }
  function pqFlush() {
    if (navigator.onLine === false) return;
    var q = pqGet(); if (!q.length) return;
    try { localStorage.setItem(PQ, "[]"); } catch (e) {}
    q.reduce(function (p, id) { return p.then(function () { return send(id); }); }, Promise.resolve());
  }
  function send(notifId, payload) {
    try {
      if (notifId && navigator.onLine === false) { pqAdd(String(notifId)); toast("📴 Offline — push internet aate hi apne aap chala jaayega"); return Promise.resolve(false); }
      var a = typeof getAuth === "function" ? getAuth() : null, u = a && a.currentUser;
      var inst = typeof getCurrentAdminInstituteId === "function" ? getCurrentAdminInstituteId() : null;
      if (!u || !inst || !notifId || /YOUR-SUBDOMAIN/.test(PUSH_WORKER_URL)) { toast("⚠️ Push nahi gaya: " + (!u ? "admin email login nahi hai" : !inst ? "institute id nahi mila" : "Worker URL set nahi")); return Promise.resolve(false); }
      return u.getIdToken().then(function (t) {
        return fetch(PUSH_WORKER_URL, { method: "POST", headers: { "Content-Type": "text/plain" }, body: JSON.stringify(Object.assign({ idToken: t, instituteId: inst, notifId: String(notifId) }, payload && payload.title ? { title: String(payload.title), body: String(payload.body || ""), type: String(payload.type || "admin"), batchId: payload.batchId ? String(payload.batchId) : undefined } : {})) });
      }).then(function (r) { return r.json(); }).then(function (j) {
        if (!j.ok) { console.warn("[SnapPush] push fail:", j.error); toast("❌ Push fail: " + j.error); } else toast("📲 Push bhej diya gaya"); return !!j.ok;
      }).catch(function (e) { console.warn("[SnapPush] push error", e); if (navigator.onLine === false) { pqAdd(String(notifId)); return false; } toast("❌ Worker tak nahi pahunch paaye: " + ((e && e.message) || e)); return false; });
    } catch (e) { return Promise.resolve(false); }
  }
  window.SnapPush = { send: send };
  window.addEventListener("snap-synced", function () { setTimeout(pqFlush, 600); });     // offline badlav online save hone ke BAAD hi push (worker doc dekhta hai)
  setTimeout(pqFlush, 6000);

  /* ---------- Student (sirf Android app) ---------- */
  if (!getCap() || window.top !== window) return;
  var busy = false, lastErr = "", noInst = false;
  function haveList() { try { var v = localStorage.getItem(SUB_KEY) || ""; if (!v) return []; return v.charAt(0) === "[" ? JSON.parse(v) : [v]; } catch (e) { return []; } }
  async function sync() {
    if (busy) return; busy = true;
    try {
      var s = typeof getStudentSession === "function" ? getStudentSession() : null;
      if (s && !s.instituteId && !noInst) { noInst = true; toast("⚠️ Push: aapke account me institute ID nahi mila"); }
      var admin = false;
      try { var a = typeof getAuth === "function" ? getAuth() : null; admin = !!(a && a.currentUser && a.currentUser.email && typeof getCurrentAdminInstituteId === "function" && getCurrentAdminInstituteId()); } catch (e) {}
      var wants = [];
      if (!localStorage.getItem(OPT_OUT)) {
        if (s && s.instituteId) { wants.push(topicFor(s.instituteId)); wants.push(appTopicFor(s.instituteId)); try { (window.SnapV169 ? window.SnapV169.mineList() : []).forEach(function (b) { wants.push(batchTopic(s.instituteId, b)); }); } catch (e) {} }   // institute notices + app update (students)
        /* v179: owner_alerts ab sirf alag Owner APK me subscribe hota hai (owner-push.js) — main app me nahi */
        if (admin) { try { var ai = getCurrentAdminInstituteId(); if (ai) wants.push(appTopicFor(ai)); } catch (e) {} }                                                        // app update (admin)
      }
      var have = haveList();
      var rm = have.filter(function (t) { return wants.indexOf(t) < 0; }), add = wants.filter(function (t) { return have.indexOf(t) < 0; });
      if (!rm.length && !add.length) return;
      for (var i = 0; i < rm.length; i++) { try { await native("unsubscribeFromTopic", { topic: rm[i] }); } catch (e) {} have = have.filter(function (t) { return t !== rm[i]; }); }
      if (add.length) {
        var p = await native("checkPermissions");
        if (p.receive !== "granted") { p = await native("requestPermissions"); }
        if (p.receive !== "granted") { localStorage.setItem(SUB_KEY, JSON.stringify(have)); if (lastErr !== "perm") { lastErr = "perm"; toast("⚠️ Notification permission nahi mili — phone Settings me Allow karein"); } return; }
        var first = !have.length;
        for (var j = 0; j < add.length; j++) { await native("subscribeToTopic", { topic: add[j] }); have.push(add[j]); }
        lastErr = ""; if (first) toast("🔔 Push chalu ho gaya");
      }
      localStorage.setItem(SUB_KEY, JSON.stringify(have));
    } catch (e) { var m = String((e && (e.message || e.errorMessage)) || e); console.warn("[SnapPush] sync", m); if (lastErr !== m) { lastErr = m; toast("❌ Push setup error: " + m.slice(0, 120)); } }
    finally { busy = false; }
  }
  /* Heads-up (pop-up) notification channel — notification ab sirf tray me chupke nahi, screen par bhi dikhti hai.
     Purane app me channel na ho to Android khud default channel par bhej deta hai (kuch toot-ta nahi). */
  setTimeout(function () { native("createChannel", { id: "snap_updates", name: "Tests & Updates", description: "Naya test, result aur app update", importance: 4, visibility: 1, vibration: true, lights: true }).catch(function () {}); }, 1500);

  /* ---------- App KHULA ho tab bhi notification dikhana (Android foreground me system notification nahi dikhata) ---------- */
  var seenMsg = {};
  function examBusy() {
    try {
      var vis = function (el) { if (!el || el.classList.contains("hidden")) return false; var cs = getComputedStyle(el); return cs.display !== "none" && cs.visibility !== "hidden"; };
      if (vis(document.getElementById("exam-screen")) && typeof current !== "undefined" && current && current.test) return true;
      return vis(document.getElementById("solution-screen"));
    } catch (e) { return false; }
  }
  function esc(x) { return String(x == null ? "" : x).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function refreshBell() { try { document.dispatchEvent(new Event("visibilitychange")); } catch (e) {} }   // student ki bell list server se turant refresh
  function route(d) {
    d = d || {};
    try {
      if (d.type === "app_update") {
        if (d.kind === "apk") { window.SnapAppUpdate && SnapAppUpdate.check({ manual: true }); }
        else if (navigator.serviceWorker && navigator.serviceWorker.getRegistration) navigator.serviceWorker.getRegistration().then(function (r) { r && r.update(); });
        return;
      }
      if (typeof getStudentSession === "function" && getStudentSession() && typeof window.snShowPage === "function") { refreshBell(); window.snShowPage("notifs", "home"); }
    } catch (e) {}
  }
  function banner(title, body, data) {
    try {
      var old = document.getElementById("snp-banner"); if (old) old.remove();
      var b = document.createElement("div"); b.id = "snp-banner";
      b.style.cssText = "position:fixed;top:calc(env(safe-area-inset-top,0px) + 10px);left:12px;right:12px;margin:0 auto;max-width:420px;z-index:2147483200;background:linear-gradient(135deg,#1e1b4b,#3730a3);color:#fff;border-radius:16px;padding:12px 14px;display:flex;gap:12px;align-items:flex-start;box-shadow:0 12px 28px rgba(15,23,42,.45);font-family:Inter,'Segoe UI',Arial,sans-serif;transform:translateY(-130%);transition:transform .28s ease;cursor:pointer";
      b.innerHTML = '<div style="width:36px;height:36px;border-radius:11px;background:linear-gradient(135deg,#fbbf24,#ea580c);display:flex;align-items:center;justify-content:center;flex:none"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9a6 6 0 0 1 12 0c0 6 2 7 2 8H4c0-1 2-2 2-8"/><path d="M10 21a2 2 0 0 0 4 0"/></svg></div><div style="min-width:0"><div style="font-weight:800;font-size:.9rem;line-height:1.3">' + esc(title || (window.SnapBrand && SnapBrand.plain ? SnapBrand.plain("The Vishnu Sharma") : "The Vishnu Sharma")) + '</div><div style="font-size:.8rem;opacity:.9;margin-top:2px;line-height:1.4">' + esc(body || "") + "</div></div>";
      var close = function () { b.style.transform = "translateY(-130%)"; setTimeout(function () { b.remove(); }, 320); };
      b.onclick = function () { close(); route(data); };
      document.body.appendChild(b); requestAnimationFrame(function () { b.style.transform = "translateY(0)"; }); setTimeout(close, 7500);
    } catch (e) {}
  }
  function onForeground(ev) {
    var n = (ev && ev.notification) || {}, d = n.data || {}, key = d.notifId || ((n.title || "") + "|" + (n.body || ""));
    var now = Date.now(); if (seenMsg[key] && now - seenMsg[key] < 20000) return; seenMsg[key] = now;
    if (d.type === "app_update") { if (d.kind === "apk") { window.SnapAppUpdate && SnapAppUpdate.check({}); } else if (navigator.serviceWorker && navigator.serviceWorker.getRegistration) navigator.serviceWorker.getRegistration().then(function (r) { r && r.update(); }); }
    else { refreshBell(); try { window.dispatchEvent(new CustomEvent("snap-push-in")); } catch (e) {} }
    if (examBusy()) return;                                                       // exam ke beech banner nahi (bell me aa jaata hai)
    var show = function () { banner(n.title, n.body, d); };
    if (d.type === "test") setTimeout(function () { if (!document.getElementById("savya-push-banner")) show(); }, 1500);   // purana local banner pehle se dikha ho to dobara nahi
    else show();
  }
  function attachForeground() {
    var tries = 0;
    (function go() {
      var C = getCap();
      if (!C || typeof C.nativeCallback !== "function") { if (++tries < 40) setTimeout(go, 250); return; }
      try { C.nativeCallback("FirebaseMessaging", "addListener", { eventName: "notificationReceived" }, onForeground); } catch (e) { console.warn("[SnapPush] fg listener", e); }
      try { C.nativeCallback("FirebaseMessaging", "addListener", { eventName: "notificationActionPerformed" }, function (ev) { var d = (ev && ev.notification && ev.notification.data) || {}; setTimeout(function () { route(d); }, 900); try { window.dispatchEvent(new CustomEvent("snap-push-in")); } catch (e) {} }); } catch (e) { console.warn("[SnapPush] tap listener", e); }
    })();
  }
  attachForeground();

  setTimeout(sync, 2500); setInterval(function () { if (!document.hidden) sync(); }, 15000); document.addEventListener("visibilitychange", function () { if (!document.hidden) sync(); });
})();
