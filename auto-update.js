/* v259 — Auto Update Detector (admin + student + owner, web aur APK ke andar ka web part).
   Kaam:
   1) App khulte hi (aur wapas aane par / internet aane par / har 3 min) chhoti version.json (GitHub Pages, Firebase read = 0) dekhta hai.
   2) Naya build mila -> service worker background me saari nayi files laata hai (sw.js precache: cache:'reload').
   3) Files taiyar hote hi, SAFE ho to turant ek seamless reload. Exam / solution / camera-scan / live class / likhte waqt kabhi nahi —
      tab tak ruka rehta hai aur safe hote hi (ya app background jaate hi) lag jata hai.
   Loop guard: ek hi build ke liye 10 min me ek hi auto-reload. Internet nahi to kuch nahi karta.
   Kill-switch: SNAP_CONFIG.autoUpdate = false. */
(function (root) {
  "use strict";
  if (typeof document === "undefined") return;
  var cfg = function () { return root.SNAP_CONFIG || {}; };
  if (cfg().autoUpdate === false) return;

  var GUARD_KEY = "snap_au_guard_v1", POLL_MS = 180000, MIN_GAP = 20000, READY_FALLBACK_MS = 30000;
  var st = { latest: 0, pending: false, ready: false, checking: false, last: 0, started: 0 };
  var swGone = false, readyTimer = null, applyTimer = null;

  function myBuild() { return parseInt(cfg().build, 10) || 0; }
  function vis(el) {
    try {
      if (!el || el.classList.contains("hidden")) return false;
      var cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden") return false;
      return el.offsetParent !== null || cs.position === "fixed";
    } catch (e) { return true; }
  }

  /* Kya abhi reload karna risky hai? (true = mat karo) */
  function busy() {
    try {
      if (vis(document.getElementById("exam-screen")) || vis(document.getElementById("solution-screen"))) return true;
      var ae = document.activeElement;                                   // abhi kuch likh raha hai
      if (ae && /^(INPUT|TEXTAREA)$/.test(ae.tagName) && ae.type !== "button" && ae.type !== "checkbox" && ae.type !== "radio" && String(ae.value || "").length > 0) return true;
      var t = document.getElementById("test-title"), tc = document.getElementById("test-create-box");   // admin test bana raha hai
      if (t && t.value && tc && vis(tc)) return true;
      var v = document.querySelectorAll("video");                        // camera / OMR scan / recording
      for (var i = 0; i < v.length; i++) { if (!v[i].paused && !v[i].ended && vis(v[i])) return true; }
      var fr = document.querySelectorAll("iframe[src*='youtube'],iframe[src*='youtu.be']");   // live class / recording
      for (var j = 0; j < fr.length; j++) { if (vis(fr[j])) return true; }
      if (root.__snapUploading) return true;                             // upload chal raha ho to
    } catch (e) { return true; }
    return false;
  }

  function guardOk(build) {
    try {
      var g = JSON.parse(localStorage.getItem(GUARD_KEY) || "null");
      if (g && g.b === build && Date.now() - g.t < 600000) return false;
    } catch (e) {}
    return true;
  }
  function reload(build) {
    try { localStorage.setItem(GUARD_KEY, JSON.stringify({ b: build, t: Date.now() })); } catch (e) {}
    try { root.dispatchEvent(new CustomEvent("snap-auto-update-apply", { detail: { build: build } })); } catch (e) {}
    location.reload();
  }

  function tryApply(why) {
    if (!st.pending || !st.ready) return false;
    if (busy()) return false;
    var b = st.latest || 1;
    if (!guardOk(b)) { st.pending = false; return false; }
    st.pending = false; reload(b); return true;
  }
  function scheduleApply() {
    if (applyTimer) return;
    applyTimer = setInterval(function () {                               // halka: sirf pending ho tab, 2 sec me ek check
      if (!st.pending) { clearInterval(applyTimer); applyTimer = null; return; }
      if (tryApply("poll")) { clearInterval(applyTimer); applyTimer = null; }
    }, 2000);
    tryApply("now");
  }

  function markReady() { st.ready = true; if (readyTimer) { clearTimeout(readyTimer); readyTimer = null; } scheduleApply(); }

  /* Naya service worker kaam sambhal le = nayi files cache me aa chuki hain */
  function fetchNew() {
    if (!navigator.serviceWorker || swGone) { markReady(); return; }
    navigator.serviceWorker.getRegistration().then(function (r) {
      if (!r) { markReady(); return; }
      var done = false, fin = function () { if (!done) { done = true; markReady(); } };
      var onCtl = function () { navigator.serviceWorker.removeEventListener("controllerchange", onCtl); fin(); };
      navigator.serviceWorker.addEventListener("controllerchange", onCtl);
      if (!readyTimer) readyTimer = setTimeout(fin, READY_FALLBACK_MS);   // SW na bole to bhi 30 sec baad aage badho
      return r.update().then(function () {
        if (!r.installing && !r.waiting && r.active && !done) { setTimeout(fin, 1500); }   // SW me kuch naya nahi mila (sirf asset badla) -> files pehle hi cache me
      });
    }).catch(function () { markReady(); });
  }

  function check(force) {
    var now = Date.now();
    if (st.checking || !navigator.onLine) return;
    if (!force && now - st.last < MIN_GAP) return;
    if (st.pending) { scheduleApply(); return; }
    st.checking = true; st.last = now;
    var ctrl = root.AbortController ? new AbortController() : null, to = setTimeout(function () { try { ctrl && ctrl.abort(); } catch (e) {} }, 4000);
    fetch("/version.json?au=" + now, { cache: "no-store", signal: ctrl ? ctrl.signal : undefined })
      .then(function (r) { clearTimeout(to); return r.ok ? r.json() : null; })
      .then(function (j) {
        st.checking = false;
        var nb = j && parseInt(j.build, 10) || 0, mb = myBuild();
        if (nb > 0 && mb > 0 && nb > mb && guardOk(nb)) {
          st.latest = nb; st.pending = true; st.ready = false; fetchNew();
        }
      })
      .catch(function () { st.checking = false; });
  }

  /* SW ne background me koi file badli hui pakdi -> (build number bhoolne par bhi) wahi safe-apply */
  try {
    if (navigator.serviceWorker) navigator.serviceWorker.addEventListener("message", function (ev) {
      if (ev && ev.data && ev.data.type === "snap-asset-updated") { st.latest = st.latest || (myBuild() + 1); st.pending = true; st.ready = true; scheduleApply(); }
    });
  } catch (e) {}

  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") check(false);
    else if (st.pending && st.ready && !busy()) tryApply("hidden");     // app background gayi -> lagao
  });
  root.addEventListener("online", function () { check(true); });
  root.addEventListener("pageshow", function () { check(false); });
  setInterval(function () { if (document.visibilityState === "visible") check(false); }, POLL_MS);

  st.started = Date.now();
  var boot = function () { setTimeout(function () { check(true); }, 600); };   // pehla paint hone ke baad turant
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();

  root.SnapAutoUpdate = { check: function () { check(true); }, state: st };
})(window);
