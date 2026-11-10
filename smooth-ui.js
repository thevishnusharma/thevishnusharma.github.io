/* The Vishnu Sharma — SMOOTH UI helper (v1.4.7)
   1) Koi bhi full-screen overlay (Batch, Analysis/More, Settings, Admin panel) khulte hi <html> par `sn-ovl` class lagti hai
      -> peeche ka home page scroll/paint band (smooth-ui.css dekhein). Band hote hi class hat jaati hai.
   2) Sirf class/style badalne par chalta hai — koi timer/polling nahi, isliye CPU par bojh nahi.
   3) Exam/Result/Solution screen par kuch nahi karta (unka apna logic hai). */
(function () {
  "use strict";
  var root = document.documentElement, IDS = ["bm-student", "sn-page", "ssp-page", "asp-page", "bm-admin"], watched = {}, raf = 0;

  function isOpen(el) {
    if (!el || !el.isConnected) return false;
    if (el.classList.contains("bm-hidden") || el.classList.contains("hidden")) return false;
    var d = el.style.display; if (d === "none") return false;
    if (el.id === "sn-page" || el.id === "ssp-page" || el.id === "asp-page") return d === "block" || d === "flex";
    return true;                      /* bm-student / bm-admin: bm-hidden na ho to khule hain */
  }
  function update() {
    raf = 0;
    var on = false;
    for (var i = 0; i < IDS.length; i++) { if (isOpen(document.getElementById(IDS[i]))) { on = true; break; } }
    if (on !== root.classList.contains("sn-ovl")) root.classList.toggle("sn-ovl", on);
  }
  function schedule() { if (!raf) raf = requestAnimationFrame(update); }
  var mo = new MutationObserver(function (muts) {
    for (var i = 0; i < muts.length; i++) {
      var m = muts[i];
      if (m.type === "childList") { attach(); break; }
    }
    schedule();
  });
  function attach() {
    for (var i = 0; i < IDS.length; i++) {
      var el = document.getElementById(IDS[i]);
      if (el && !watched[IDS[i]] || (el && watched[IDS[i]] !== el)) {
        watched[IDS[i]] = el;
        mo.observe(el, { attributes: true, attributeFilter: ["class", "style"] });
      }
    }
  }
  function boot() {
    attach();
    /* overlays baad me bante hain (body me append) -> sirf body ke direct children ka add/remove dekho */
    mo.observe(document.body, { childList: true });
    schedule();
  }
  if (document.body) boot(); else document.addEventListener("DOMContentLoaded", boot);
  /* Android back / app resume par state sahi rakhna */
  document.addEventListener("visibilitychange", function () { if (!document.hidden) schedule(); });
  window.addEventListener("pageshow", schedule);
})();

/* ---- v201 INSTANT CLICK LAYER -------------------------------------------------------------
   a) Har "smooth" scroll turant (instant) — scrollIntoView/scrollTo/scrollBy/scroll ka animation 300-600ms leta tha,
      isi se screen badalte waqt page "slide" hota dikhta tha aur click dheema lagta tha.
   b) iOS/Android WebView me :active (tap feedback) turant chale, isliye passive touchstart listener. */
(function () {
  "use strict";
  function fix(a) { try { if (a && typeof a === "object" && a.behavior === "smooth") { var o = {}; for (var k in a) o[k] = a[k]; o.behavior = "auto"; return o; } } catch (e) {} return a; }
  function wrap(proto, name) {
    var f = proto && proto[name]; if (typeof f !== "function" || f.__snFast) return;
    var w = function (a, b) { return arguments.length > 1 ? f.call(this, a, b) : f.call(this, fix(a)); };
    w.__snFast = 1; try { proto[name] = w; } catch (e) {}
  }
  ["scrollIntoView", "scrollTo", "scrollBy", "scroll"].forEach(function (n) { wrap(Element.prototype, n); });
  ["scrollTo", "scrollBy", "scroll"].forEach(function (n) { wrap(window, n); wrap(Window.prototype, n); });
  document.addEventListener("touchstart", function () {}, { passive: true });
})();
