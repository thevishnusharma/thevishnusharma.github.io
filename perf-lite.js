/* Lag fix: (1) kam RAM/CPU wale phone par "lite" (blur band), (2) OMR scan camera khulte hi sab blur/animation band.
   ?lite=1 se zabardasti ON, ?lite=0 se zabardasti OFF (is device par yaad rakhta hai). */
(function () {
  var h = document.documentElement;
  try { var q = /[?&]lite=([01])/.exec(location.search); if (q) localStorage.setItem("snap_lite", q[1]); } catch (e) {}
  try { var sq = /[?&]scanq=(hi|std|low)/.exec(location.search); if (sq) localStorage.setItem("snap_scan_q", sq[1]); } catch (e) {}
  function low() { try { var m = navigator.deviceMemory, c = navigator.hardwareConcurrency; return (m && m <= 4) || (c && c <= 4); } catch (e) { return false; } }
  var pref = null; try { pref = localStorage.getItem("snap_lite"); } catch (e) {}
  if (pref === "1" || (pref !== "0" && low())) h.classList.add("lg-lite");
  function watch() {
    var ov = document.getElementById("examgr-scan-overlay"); if (!ov) return false;
    function upd() { h.classList.toggle("lg-scan", !ov.classList.contains("hidden")); }
    upd(); try { new MutationObserver(upd).observe(ov, { attributes: true, attributeFilter: ["class"] }); } catch (e) {}
    return true;
  }
  if (!watch()) document.addEventListener("DOMContentLoaded", watch);
})();

/* snP(fn): fn ko NEXT paint ke baad chalata hai -> click par screen/section pehle dikhta hai, bhaari render baad me (click turant open lagta hai). */
window.snP = function (f) {
  var raf = window.requestAnimationFrame || function (c) { return setTimeout(c, 0); };
  raf(function () { setTimeout(function () { try { f(); } catch (e) { try { console.error(e); } catch (_) {} } }, 0); });
};
