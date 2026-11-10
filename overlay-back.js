/* v266 — Android Back button: Batch (admin + student) aur admin/student pages (Tests, Students, More...) ab Back se band hote hain.
   Pehle ye overlay history me the hi nahi, isliye Back dabane par kuch nahi hota tha / "dobara Back dabayein" aata tha.
   back-button-guard.js se PEHLE load hota hai; sirf tab kaam karta hai jab koi overlay khula ho, warna guard ko hi chhod deta hai. */
(function () {
  "use strict";
  var pushed = false, ignore = 0, raf = 0, watched = {};
  function $(i) { return document.getElementById(i); }
  function vis(el) { return !!el && el.isConnected && !el.classList.contains("bm-hidden") && !el.classList.contains("hidden") && el.style.display !== "none"; }
  function top() {
    if (vis($("bm-admin"))) return "bm-admin";
    if (vis($("bm-student"))) return "bm-student";
    var p = $("sn-page"); if (p && p.style.display === "block") return "sn-page";
    return "";
  }
  function ctx() { try { return window.SnapBatch && window.SnapBatch.ctx ? window.SnapBatch.ctx() : null; } catch (e) { return null; } }
  function push() { try { history.pushState(Object.assign({}, history.state || {}, { ov: 1 }), "", location.href); pushed = true; } catch (e) {} }
  function check() {
    raf = 0; var t = top();
    if (t && !pushed) push();
    else if (!t && pushed) { pushed = false; if (history.state && history.state.ov) { ignore++; try { history.back(); } catch (e) { ignore--; } } }
  }
  function sched() { if (!raf) raf = requestAnimationFrame(check); }
  function attach() {
    ["bm-admin", "bm-student", "sn-page"].forEach(function (id) {
      var el = $(id); if (el && watched[id] !== el) { watched[id] = el; new MutationObserver(sched).observe(el, { attributes: true, attributeFilter: ["class", "style"] }); }
    });
    sched();
  }
  new MutationObserver(attach).observe(document.documentElement, { childList: true, subtree: false });
  new MutationObserver(attach).observe(document.body || document.documentElement, { childList: true });
  document.addEventListener("DOMContentLoaded", attach); attach();

  function clickNav(id) { var b = document.querySelector("#" + id + ' [data-k="home"]'); if (b) { b.click(); return true; } return false; }
  function goHome() { if (!clickNav("an-nav")) clickNav("sn-nav"); }

  /* Back dabane par: true = overlay abhi bhi khula (ek level peeche gaye), false = band ho gaya */
  function back(t) {
    var c = ctx();
    var modal = document.querySelector(".bm-viewer, .bm-modal");
    if (modal && (t === "bm-admin" || t === "bm-student")) {
      var x = modal.querySelector("[data-x],[data-c]"); if (x) x.click(); else modal.remove();
      return true;
    }
    if (t === "bm-admin") {
      if (c && c.A && c.A.view && c.A.view !== "dash" && c.adminGo) { try { c.A.touched = true; c.adminGo("dash"); return true; } catch (e) {} }
      var a = $("bm-admin"); a && a.remove(); goHome(); return false;
    }
    if (t === "bm-student") {
      if (c && c.S && c.S.cur && c.S.inHome === false && c.sHome) { try { c.sHome(); return true; } catch (e) {} }
      try { c && c.closeStudent && c.closeStudent(); } catch (e) {}
      var o = $("bm-student"); o && o.classList.add("bm-hidden");
      goHome(); return false;
    }
    if (t === "sn-page") {
      var bk = document.querySelector('#sn-page [data-a="back"]');
      if (bk) { bk.click(); return top() === "sn-page"; }
      goHome(); return false;
    }
    return false;
  }

  window.addEventListener("popstate", function (e) {
    if (ignore > 0) { ignore--; e.stopImmediatePropagation(); return; }
    var t = top(); if (!t) return;           /* koi overlay nahi — guard apna kaam kare */
    e.stopImmediatePropagation();
    pushed = false;
    var keep = false; try { keep = back(t); } catch (err) { console.warn(err); }
    if (keep || top()) { if (!pushed) push(); }
    sched();
  }, true);
})();
