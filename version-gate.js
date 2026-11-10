/* v247  Version Gate (sirf admin/owner). version.json me "minBuild": N likho -> jo admin app N se purane build par hoga
   uski screen par band na hone wala "Update zaroori hai" parda aa jaayega (login bana rahega).
   - students par KABHI nahi lagta (exam ke waqt safe).
   - internet na ho to kuch nahi karta (offline kaam nahi rukta).
   - Kill-switch: SNAP_CONFIG.versionGate = false, ya version.json me "minBuild": 0.
   Check ka kharch: GitHub Pages ki chhoti version.json (Firebase read nahi). */
(function (root) {
  "use strict";
  function shouldBlock(myBuild, minBuild) {
    var a = parseInt(myBuild, 10) || 0, m = parseInt(minBuild, 10) || 0;
    return m > 0 && a > 0 && a < m;
  }
  if (typeof module !== "undefined" && module.exports) module.exports = { shouldBlock: shouldBlock };
  if (typeof document === "undefined") return;

  var last = 0, shown = false;
  function off() { return !!(root.SNAP_CONFIG && root.SNAP_CONFIG.versionGate === false); }
  function myBuild() { return (root.SNAP_CONFIG && root.SNAP_CONFIG.build) || 0; }
  function isAdmin() { try { return localStorage.getItem("savya_admin_logged_in") === "true"; } catch (e) { return false; } }

  function updateNow() {
    var go = function () { location.reload(); };
    try {
      var p = [];
      if (root.caches && caches.keys) p.push(caches.keys().then(function (ks) { return Promise.all(ks.map(function (k) { return caches.delete(k); })); }));
      if (navigator.serviceWorker && navigator.serviceWorker.getRegistrations) p.push(navigator.serviceWorker.getRegistrations().then(function (rs) { return Promise.all(rs.map(function (r) { return r.unregister(); })); }));
      Promise.all(p).then(go, go);
    } catch (e) { go(); }
  }

  function curtain(min) {
    if (shown) return; shown = true;
    var o = document.createElement("div");
    o.id = "snap-version-gate";
    o.style.cssText = "position:fixed;inset:0;z-index:2147483000;background:#0f172a;color:#fff;display:flex;align-items:center;justify-content:center;padding:24px;text-align:center;font-family:system-ui,sans-serif";
    var b = document.createElement("div"); b.style.cssText = "max-width:380px";
    var h = document.createElement("div"); h.style.cssText = "font-size:2.2rem"; h.textContent = "🔄";
    var t = document.createElement("div"); t.style.cssText = "font-size:1.25rem;font-weight:800;margin:10px 0 6px"; t.textContent = "App update zaroori hai";
    var d = document.createElement("div"); d.style.cssText = "font-size:.92rem;opacity:.85;line-height:1.5"; d.textContent = "Ye app purane version par chal raha hai. Naya version lene ke liye neeche dabayein. Aapka login bana rahega.";
    var btn = document.createElement("button"); btn.type = "button"; btn.textContent = "Update karein";
    btn.style.cssText = "margin-top:18px;padding:13px 26px;border:0;border-radius:14px;background:#4f46e5;color:#fff;font-weight:800;font-size:1rem;cursor:pointer";
    btn.onclick = function () { btn.disabled = true; btn.textContent = "Update ho raha hai..."; updateNow(); };
    var s = document.createElement("div"); s.style.cssText = "margin-top:14px;font-size:.74rem;opacity:.55"; s.textContent = "Aapka build " + (myBuild() || "?") + (min ? " • zaroori " + min + "+" : "") + " — baar-baar aaye to 2 minute baad dobara try karein.";
    b.append(h, t, d, btn, s); o.appendChild(b); document.body.appendChild(o);
    document.body.style.overflow = "hidden";
  }

  function check(force) {
    if (off() || shown || !isAdmin()) return;
    var now = Date.now();
    if (!force && now - last < 60000) return;
    last = now;
    fetch("/version.json?g=" + Math.floor(now / 60000), { cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { if (j && shouldBlock(myBuild(), j.minBuild)) curtain(j.minBuild); })
      .catch(function () { /* offline: kuch nahi */ });
  }

  root.addEventListener("snap-update-required", function () { if (!off() && isAdmin()) curtain(0); });
  setTimeout(function () { check(true); }, 2500);
  setTimeout(function () { check(true); }, 9000);
  setInterval(check, 600000);
  document.addEventListener("visibilitychange", function () { if (document.visibilityState === "visible") check(); });
  root.addEventListener("online", function () { check(true); });
  root.SnapVersionGate = { check: check, shouldBlock: shouldBlock };
})(typeof window !== "undefined" ? window : globalThis);
