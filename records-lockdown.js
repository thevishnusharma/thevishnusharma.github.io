/* Phase 3 — Result privacy (records lockdown).
   Default OFF: kuch bhi nahi badalta. Owner Firebase Console me config/privacy = { recordsLockdown: true } kare tabhi
   student devices par studentRecords ke queries me institute filter lagta hai (Firestore rules ke saath match karne ke liye).
   Admin/Owner par koi farq nahi. Kabhi throw nahi karta. */
(function () {
  "use strict";
  var KEY = "snap_rec_lockdown", TTL = 10 * 60 * 1000;
  function cached() { try { var c = JSON.parse(localStorage.getItem(KEY) || "null"); return c && Date.now() - c.at < TTL ? c : null; } catch (e) { return null; } }
  function isAdm() { try { return typeof isAdminLoggedIn === "function" && isAdminLoggedIn(); } catch (e) { return false; } }
  function myInst() { try { var s = typeof getStudentSession === "function" ? getStudentSession() : null; return s && s.instituteId ? String(s.instituteId) : null; } catch (e) { return null; } }
  function on() { var c = cached(); return !!(c && c.on); }
  function refresh() {
    try {
      var v = window.vishnuFirebase; if (!v || !v.enabled || !v.db) return;
      Promise.resolve(v.authReady).catch(function () {}).then(function () {
        return v.db.collection("config").doc("privacy").get();
      }).then(function (d) {
        var flag = !!(d && d.exists && d.data().recordsLockdown === true);
        try { localStorage.setItem(KEY, JSON.stringify({ on: flag, at: Date.now() })); } catch (e) {}
      }).catch(function () {});
    } catch (e) {}
  }
  function install() {
    try {
      var FS = window.firebase && firebase.firestore && firebase.firestore.Firestore;
      if (!FS || !FS.prototype || FS.prototype.__recLock) return false;
      var orig = FS.prototype.collection; FS.prototype.__recLock = true;
      FS.prototype.collection = function (path) {
        var col = orig.apply(this, arguments);
        try {
          if (path !== "studentRecords" || isAdm() || !on()) return col;
          var inst = myInst(); if (!inst) return col;
          var base = col.where("instituteId", "==", inst);
          return new Proxy(col, {
            get: function (t, p) {
              if (p === "where") return function (field) { return (field === "mobile" || field === "__name__" ? t : base).where.apply(field === "mobile" || field === "__name__" ? t : base, arguments); };
              if (p === "orderBy" || p === "limit" || p === "get" || p === "onSnapshot" || p === "startAfter" || p === "startAt") { var f = base[p]; return typeof f === "function" ? f.bind(base) : f; }
              var x = t[p]; return typeof x === "function" ? x.bind(t) : x;
            }
          });
        } catch (e) { return col; }
      };
      return true;
    } catch (e) { return false; }
  }
  install(); refresh();
  /* Admin tool: purane results me instituteId lagao (lockdown ON karne se pehle ek baar chalayein). */
  window.SnapRecordsBackfill = async function (opts) {
    var dry = !opts || opts.dry !== false, v = window.vishnuFirebase;
    if (!v || !v.enabled) throw new Error("Server se connected nahi");
    var list = (typeof allStudentsCache !== "undefined" && allStudentsCache) || [];
    var byMobile = {}; list.forEach(function (s) { var m = String(s.mobile || "").replace(/\D/g, "").slice(-10); if (m && s.instituteId) byMobile[m] = s.instituteId; });
    var mobiles = Object.keys(byMobile), todo = [];
    for (var i = 0; i < mobiles.length; i += 10) {
      var chunk = mobiles.slice(i, i + 10);
      var snap = await v.db.collection("studentRecords").where("mobile", "in", chunk).get();
      snap.docs.forEach(function (d) { var x = d.data(); if (!x.instituteId) todo.push({ ref: d.ref, inst: byMobile[String(x.mobile || "").replace(/\D/g, "").slice(-10)] }); });
    }
    if (!dry) for (var j = 0; j < todo.length; j += 400) {
      var b = v.db.batch(); todo.slice(j, j + 400).forEach(function (t) { if (t.inst) b.update(t.ref, { instituteId: t.inst }); }); await b.commit();
    }
    return { students: mobiles.length, recordsToFix: todo.length, applied: !dry };
  };
})();
