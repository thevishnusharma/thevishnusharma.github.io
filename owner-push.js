/* Owner APK push (v179) — sirf Android app me chalta hai (website par kuch nahi karta).
   Owner login hote hi FCM topic "owner_alerts" subscribe: error alerts + roz ka renewal reminder (Worker se).
   Logout par unsubscribe. App khula ho tab bhi upar banner dikhta hai. */
(function () {
  "use strict";
  var SUB = "snap_owner_topic_v1", TOPIC = "owner_alerts";
  function getCap() {
    var w = []; try { if (window.top) w.push(window.top); } catch (e) {}
    w.push(window);
    for (var i = 0; i < w.length; i++) { try { var c = w[i].Capacitor; if (c && typeof c.nativePromise === "function") return c; } catch (e) {} }
    return null;
  }
  if (!getCap()) return;
  function native(m, o) { var C = getCap(); return C ? C.nativePromise("FirebaseMessaging", m, o || {}) : Promise.reject(new Error("no plugin")); }
  function esc(x) { return String(x == null ? "" : x).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function toast(m) { try { var b = document.createElement("div"); b.textContent = m; b.style.cssText = "position:fixed;left:50%;top:18px;transform:translateX(-50%);background:#0f172a;color:#fff;padding:10px 16px;border-radius:14px;font-size:.8rem;z-index:2147483647;max-width:90vw;text-align:center;"; document.body.appendChild(b); setTimeout(function () { b.remove(); }, 5000); } catch (e) {} }
  function isOwnerEmail(e) {
    e = String(e || "").toLowerCase(); if (!e) return false;
    var list = []; try { if (typeof OWNER_TRUE_EMAIL === "string") list.push(OWNER_TRUE_EMAIL.toLowerCase()); } catch (x) {}
    try { var o = window.SNAP_CONFIG && window.SNAP_CONFIG.ownerAlertEmail; if (o) list.push(String(o).toLowerCase()); } catch (x) {}
    return list.indexOf(e) >= 0;
  }
  var busy = false, lastErr = "";
  async function sync() {
    if (busy) return; busy = true;
    try {
      var u = (typeof ownerGetAuth === "function" && ownerGetAuth().currentUser) || (window.firebase && firebase.auth && firebase.auth().currentUser), want = !!(u && isOwnerEmail(u.email)), have = localStorage.getItem(SUB) === "1";
      if (want === have) return;
      if (want) {
        var p = await native("checkPermissions"); if (p.receive !== "granted") p = await native("requestPermissions");
        if (p.receive !== "granted") { if (lastErr !== "perm") { lastErr = "perm"; toast("⚠️ Notification permission nahi mili — phone Settings me Allow karein"); } return; }
        await native("subscribeToTopic", { topic: TOPIC }); localStorage.setItem(SUB, "1"); lastErr = ""; toast("🔔 Owner alerts chalu ho gaye");
      } else { try { await native("unsubscribeFromTopic", { topic: TOPIC }); } catch (e) {} localStorage.removeItem(SUB); }
    } catch (e) { var m = String((e && (e.message || e.errorMessage)) || e); if (lastErr !== m) { lastErr = m; toast("❌ Push setup error: " + m.slice(0, 120)); } }
    finally { busy = false; }
  }
  setTimeout(function () { native("createChannel", { id: "snap_updates", name: "Owner alerts", description: "Error alerts aur renewal reminder", importance: 4, visibility: 1, vibration: true, lights: true }).catch(function () {}); }, 1500);
  var seen = {};
  function banner(t, b) {
    try {
      var old = document.getElementById("snp-owner-banner"); if (old) old.remove();
      var d = document.createElement("div"); d.id = "snp-owner-banner";
      d.style.cssText = "position:fixed;top:calc(env(safe-area-inset-top,0px) + 10px);left:12px;right:12px;margin:0 auto;max-width:420px;z-index:2147483200;background:#1e1b4b;color:#fff;border-radius:14px;padding:12px 14px;box-shadow:0 8px 24px rgba(0,0,0,.4);font:600 .84rem system-ui,sans-serif;";
      d.innerHTML = "<div style='font-weight:800;margin-bottom:3px'>" + esc(t) + "</div><div style='font-weight:500;opacity:.9;white-space:pre-line'>" + esc(String(b || "").slice(0, 220)) + "</div>";
      d.onclick = function () { d.remove(); }; document.body.appendChild(d); setTimeout(function () { d.remove(); }, 8000);
    } catch (e) {}
  }
  (function attach() { var tries = 0; (function go() { var C = getCap(); if (!C || typeof C.nativeCallback !== "function") { if (++tries < 40) setTimeout(go, 250); return; }
    try { C.nativeCallback("FirebaseMessaging", "addListener", { eventName: "notificationReceived" }, function (ev) { var n = (ev && ev.notification) || {}, k = (n.title || "") + "|" + (n.body || ""), now = Date.now(); if (seen[k] && now - seen[k] < 20000) return; seen[k] = now; banner(n.title, n.body); }); } catch (e) {}
  })(); })();
  setTimeout(sync, 2500); setInterval(sync, 5000);
})();
