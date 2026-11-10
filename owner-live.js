/* owner-live.js — Owner dashboard: abhi kitne Student / Admin ONLINE, aur kitne REGISTERED.
   Registered = pehle se load hue institutes (studentCount) aur admins se — koi extra read nahi.
   Online = presence collection (pichle 3 minute me ping). Har 60 sec refresh, sirf jab dashboard dikh raha ho. */
(function () {
  "use strict";
  var WINDOW_MS = 3 * 60 * 1000, EVERY = 60000, timer = null, online = { student: null, admin: null }, err = "";
  function el() {
    var c = document.getElementById("owner-live-card");
    if (c) return c;
    var anchor = document.getElementById("oa-kpis") || document.getElementById("owner-institutes-list");
    if (!anchor || !anchor.parentNode) return null;
    c = document.createElement("div"); c.id = "owner-live-card";
    c.style.cssText = "margin:10px 0;padding:12px;border-radius:14px;background:#fff;border:1px solid #e5e7eb;box-shadow:0 1px 4px rgba(0,0,0,.06);";
    anchor.parentNode.insertBefore(c, anchor);
    return c;
  }
  function registered() {
    var stu = 0, adm = 0, admOn = 0;
    try { Object.keys(_ownerInstitutesCache || {}).forEach(function (k) { var a = _ownerInstitutesCache[k]; if (!a.isDemo) stu += +a.studentCount || 0; }); } catch (e) {}
    try { Object.keys(_ownerAdminsCache || {}).forEach(function (k) { adm++; if (_ownerAdminsCache[k].active !== false) admOn++; }); } catch (e) {}
    return { stu: stu, adm: adm, admOn: admOn };
  }
  function cell(n, label, color) {
    return '<div style="flex:1 1 130px;text-align:center;padding:8px;border-radius:10px;background:#f8fafc;"><div style="font-size:1.4rem;font-weight:800;color:' + color + ';">' +
      (n == null ? "…" : n) + '</div><div style="font-size:.72rem;color:#64748b;">' + label + "</div></div>";
  }
  function render() {
    var c = el(); if (!c) return;
    var r = registered();
    c.innerHTML = '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;"><b style="font-size:.9rem;">🟢 Live users</b>' +
      '<button type="button" id="owner-live-refresh" style="border:0;background:#eef2ff;color:#4f46e5;border-radius:8px;padding:5px 10px;font-weight:600;font-size:.75rem;">↻ Refresh</button></div>' +
      '<div style="display:flex;flex-wrap:wrap;gap:8px;">' +
      cell(online.student, "Students abhi online", "#16a34a") + cell(online.admin, "Admins abhi online", "#16a34a") +
      cell(r.stu, "Students registered", "#4f46e5") + cell(r.adm, "Admins registered" + (r.adm !== r.admOn ? " (" + r.admOn + " active)" : ""), "#4f46e5") + "</div>" +
      '<div style="font-size:.68rem;color:#94a3b8;margin-top:6px;">Online = pichle 3 minute me app khula tha. ' + (err ? '<span style="color:#dc2626;">⚠️ ' + err + "</span>" : "") + "</div>";
    var b = document.getElementById("owner-live-refresh"); if (b) b.onclick = load;
  }
  async function load() {
    try {
      var db = ownerGetDb(), since = firebase.firestore.Timestamp.fromMillis(Date.now() - WINDOW_MS);
      var snap = await db.collection("presence").where("lastSeen", ">", since).get(), s = 0, a = 0;
      snap.forEach(function (d) { var role = (d.data() || {}).role; if (role === "student") s++; else if (role === "admin") a++; });
      online.student = s; online.admin = a; err = "";
    } catch (e) { err = "Online count nahi aaya: " + (e.message || e) + " (firestore.rules publish kiye?)"; }
    render();
  }
  function tick() {
    var panel = document.getElementById("owner-panel-box");
    if (panel && panel.classList.contains("hidden")) return;
    if (document.visibilityState === "hidden") return;
    if (!el()) return;
    load();
  }
  function init() { setTimeout(function () { render(); tick(); }, 1500); timer = setInterval(tick, EVERY); setInterval(render, 5000); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
