/* v163 — Offline mode: saved data se app chalti hai, offline badlav internet aate hi apne aap online save hote hain.
   Firestore offline persistence (firebase-config.js) pehle se chalu hai: offline likhe data phone me queue hota hai aur internet aate hi upload hota hai.
   Ye file sirf USER KO BATATI hai: offline pill, "data abhi online save nahi hua" notice, "N baaki" count, "sab online save ho gaya" confirmation.
   Online hone par koi write badla nahi jaata (wahi original promise lautta hai); sirf offline hone par save button atka na rahe isliye promise jaldi resolve hota hai. */
(function () {
  "use strict";
  var S = window.OfflineSync = { state: { offline: false, pending: 0, unknown: false }, syncNow: function () { return Promise.resolve(); }, probe: function () {} };
  var pending = 0, hadOffline = false, unknown = false, probing = false, lastNotice = 0, lastProbe = 0, lastSynced = 0, flashT = null, flashOk = false;

  function db() { try { return window.vishnuFirebase && window.vishnuFirebase.db; } catch (e) { return null; } }
  function offline() { return navigator.onLine === false; }
  function emit() {
    S.state.offline = offline(); S.state.pending = pending; S.state.unknown = unknown;
    try { window.dispatchEvent(new CustomEvent("snap-sync-state", { detail: S.state })); } catch (e) {}
  }

  /* ---------- UI: chhota pill (upar beech me, tap ke liye band nahi) + toast ---------- */
  var pill = null;
  function ensurePill() {
    if (pill && pill.isConnected) return pill;
    pill = document.createElement("div"); pill.id = "os-pill";
    pill.style.cssText = "position:fixed;top:calc(env(safe-area-inset-top,0px) + 6px);left:50%;transform:translateX(-50%);z-index:2147483000;pointer-events:none;display:none;align-items:center;gap:6px;padding:5px 13px;border-radius:99px;font:700 12px/1.2 Inter,'Segoe UI',Arial,sans-serif;box-shadow:0 4px 14px rgba(0,0,0,.25);white-space:nowrap;max-width:94vw";
    (document.body || document.documentElement).appendChild(pill); return pill;
  }
  var ICON = {
    off: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 8.8a15 15 0 0 1 4-2.6M22 8.8a15 15 0 0 0-8.5-3.7M5 12.8a10 10 0 0 1 3-1.9M19 12.8a10 10 0 0 0-5-2.6M8.5 16.4a5 5 0 0 1 7 0M12 20h.01M3 3l18 18"/></svg>',
    wait: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    ok: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7"/></svg>'
  };
  /* v168: student ko "online save / network" jaisa koi pill ya toast nahi dikhta — sirf admin ko. Student ke saath problem ho to owner ko silent alert. */
  function showUi() {
    return false;   /* v169: online-save pill / toast kisi ko (admin ya student) nahi dikhta — sync background me chalta rahega */
  }
  function paint() {
    if (!showUi()) { try { if (pill && pill.isConnected) pill.style.display = "none"; } catch (e) {} emit(); return; }
    var p = ensurePill(), n = pending, has = n > 0 || unknown, cnt = n > 0 ? n + " " : "";
    if (offline()) { p.style.cssText += ";display:flex;background:#fff7ed;color:#c2410c;border:1px solid #fed7aa"; p.innerHTML = ICON.off + "<span>Offline — saved data se chal raha hai" + (has ? " • " + cnt + "baaki" : "") + "</span>"; }
    else if (has && hadOffline) { p.style.cssText += ";display:flex;background:#fffbeb;color:#b45309;border:1px solid #fde68a"; p.innerHTML = ICON.wait + "<span>" + cnt + "badlav online save ho rahe hain…</span>"; }
    else if (flashOk) { p.style.cssText += ";display:flex;background:#f0fdf4;color:#15803d;border:1px solid #bbf7d0"; p.innerHTML = ICON.ok + "<span>Sab online save ho gaya</span>"; }
    else p.style.display = "none";
    emit();
  }
  function toast(msg, ok, ms) {
    try {
      if (!showUi()) return;
      var old = document.getElementById("os-toast"); if (old) old.remove();
      var t = document.createElement("div"); t.id = "os-toast";
      t.style.cssText = "position:fixed;left:14px;right:14px;bottom:84px;margin:0 auto;max-width:420px;z-index:2147483001;pointer-events:none;background:#1e1b4b;color:#fff;border-radius:16px;padding:12px 14px;font:600 13px/1.5 Inter,'Segoe UI',Arial,sans-serif;box-shadow:0 10px 24px rgba(0,0,0,.35);display:flex;gap:10px;align-items:flex-start";
      t.innerHTML = '<span style="color:' + (ok ? "#4ade80" : "#fbbf24") + ';flex:none;margin-top:1px">' + (ok ? ICON.ok : ICON.wait) + "</span><span>" + msg + "</span>";
      document.body.appendChild(t); setTimeout(function () { if (!t.isConnected) return; t.style.transition = "opacity .3s"; t.style.opacity = "0"; setTimeout(function () { t.remove(); }, 320); }, ms || 6500);
    } catch (e) {}
  }
  function notice(slow) {
    var now = Date.now(); if (now - lastNotice < 9000) return; lastNotice = now;
    toast("<b>Data abhi online save nahi hua</b><br>" + (slow ? "Network kamzor hai — data aapke phone me safe hai." : "Aapka data phone me safe hai.") + " Internet aate hi apne aap online upload ho jaayega.");
  }

  /* ---------- Write tracking ---------- */
  function finishedOk() {
    if (!hadOffline) return; hadOffline = false; flashOk = true; paint();
    toast("<b>Sab online save ho gaya</b><br>Offline kiye badlav safalta se upload ho gaye.", true, 5000);
    clearTimeout(flashT); flashT = setTimeout(function () { flashOk = false; paint(); }, 4500);
  }
  function settle(failed) { pending = Math.max(0, pending - 1); paint(); if (pending === 0 && !unknown && !offline()) { if (failed) { hadOffline = false; paint(); } else finishedOk(); } if (pending === 0) fireSynced(); }
  function track(p) {
    if (!p || typeof p.then !== "function") return;
    pending++; var slow = null;
    if (offline()) { hadOffline = true; notice(false); }
    else slow = setTimeout(function () { if (pending > 0) { hadOffline = true; notice(true); paint(); } }, 3000);
    paint();
    p.then(function () { clearTimeout(slow); settle(); }, function (e) {
      clearTimeout(slow); var wasOff = hadOffline; settle(true);
      try { window.SnapAlert && window.SnapAlert.report("save", "Write reject: " + String((e && (e.code || e.message)) || "error"), {}, "error"); } catch (x) {}
      if (wasOff) toast("<b>Ek offline badlav server ne accept nahi kiya</b><br>" + String((e && (e.code || e.message)) || "error").slice(0, 80));
    });
  }
  function guard(p) { track(p); return offline() ? Promise.resolve() : p; }

  function wrapWrites(P, names) {
    if (!P) return;
    names.forEach(function (n) {
      var o = P[n]; if (typeof o !== "function" || o.__os) return;
      P[n] = function () { return guard(o.apply(this, arguments)); }; P[n].__os = 1;
    });
  }
  function wrapAdd(P) {
    if (!P || typeof P.add !== "function" || P.add.__os) return;
    var o = P.add;
    P.add = function (data) {
      if (offline()) { try { var ref = this.doc(); ref.set(data); return Promise.resolve(ref); } catch (e) {} }
      var p = o.apply(this, arguments); track(p); return p;
    }; P.add.__os = 1;
  }
  var installed = false;
  function install() {
    if (installed) return true;
    try {
      var F = window.firebase && firebase.firestore, d = db(); if (!F || !d) return false;
      if (F.DocumentReference) wrapWrites(F.DocumentReference.prototype, ["set", "update", "delete"]);
      if (F.CollectionReference) wrapAdd(F.CollectionReference.prototype);
      try { var b = d.batch(); wrapWrites(Object.getPrototypeOf(b), ["commit"]); } catch (e) {}
      installed = true; return true;
    } catch (e) { console.warn("[OfflineSync] install fail", e); return false; }
  }

  /* ---------- Pehle ke (band hone se pehle ke) pending writes pata karna ---------- */
  function fireSynced() {
    var now = Date.now(); if (now - lastSynced < 1500 || offline()) return; lastSynced = now;
    try { window.dispatchEvent(new CustomEvent("snap-synced")); } catch (e) {}
  }
  function probe() {
    var d = db(); if (!d || typeof d.waitForPendingWrites !== "function" || probing) return;
    var now = Date.now(); if (now - lastProbe < 2500) return; lastProbe = now;
    probing = true; var done = false;
    var t = setTimeout(function () { if (!done) { unknown = true; hadOffline = true; paint(); } }, 1500);
    d.waitForPendingWrites().then(function () {
      done = true; clearTimeout(t); probing = false; var was = unknown; unknown = false; paint();
      if (pending === 0 && (was || hadOffline) && !offline()) finishedOk();
      if (pending === 0) fireSynced();
    }, function () { done = true; clearTimeout(t); probing = false; });
  }
  S.probe = probe;

  S.syncNow = function () {
    var d = db();
    if (offline()) { toast("<b>Internet nahi hai</b><br>Internet connect hote hi data apne aap sync ho jaayega."); return Promise.resolve(false); }
    if (!d || typeof d.waitForPendingWrites !== "function") { toast("Sync abhi available nahi hai", true); return Promise.resolve(false); }
    toast("Sync check ho raha hai…", true, 2500);
    try { d.enableNetwork && d.enableNetwork().catch(function () {}); } catch (e) {}
    return Promise.race([d.waitForPendingWrites().then(function () { return true; }), new Promise(function (r) { setTimeout(function () { r(false); }, 9000); })]).then(function (ok) {
      if (ok) { toast("<b>Sab online save hai</b><br>Koi badlav baaki nahi.", true, 4000); unknown = false; pending = Math.max(0, pending); paint(); fireSynced(); }
      else toast("Abhi kuch badlav baaki hain — network aate hi apne aap online ho jaayenge.");
      return ok;
    });
  };

  /* ---------- Events ---------- */
  window.addEventListener("offline", function () { paint(); toast("<b>Internet chala gaya</b><br>App saved data se chalti rahegi. Aap jo badlaenge wo phone me save hoga aur internet aate hi online ho jaayega."); });
  window.addEventListener("online", function () { paint(); lastProbe = 0; setTimeout(probe, 800); setTimeout(function () { lastProbe = 0; probe(); }, 4000); });
  document.addEventListener("visibilitychange", function () { if (document.visibilityState === "visible") { paint(); probe(); } });

  function boot() {
    if (!install()) { var n = 0, iv = setInterval(function () { if (install() || ++n > 50) clearInterval(iv); }, 400); }
    paint(); setTimeout(probe, 2500);
    if (offline()) paint();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
