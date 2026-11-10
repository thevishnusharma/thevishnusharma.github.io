/* READ DIET (v170) — Firestore reads ko 20-50 guna kam karne ka simple tareeka.

   Idea: admin jab bhi kuch badalta hai (batch item, test, notification, batch list) to institute ke ek chhote doc
        institutes/{inst}/ver/main  me us cheez ka "version" (number) badal jaata hai.
   Student/admin ka app pehle sirf wo 1 doc padhta hai (45 sec memo). Version wahi hai jo phone me saved cache ka hai
   to cache use hota hai (0 reads) — warna sirf tab poora data dobara padhta hai.

   Safety: cache max 4 ghante purana (admin ka 30 min); ver doc na mile / offline ho to cache chalta hai;
           student batch page par 🔄 se force refresh; push aate hi bell/tests refresh.
   Fallback: ye file na chale to app bilkul pehle jaisa (live listener / full read) chalta rahega. Kill-switch: SNAP_CONFIG.readDiet = false */
(function () {
  "use strict";
  var W = window; if (W.SnapDiet) return;
  var API = W.SnapDiet = {}, H = 3600000;
  function on() { return !(W.SNAP_CONFIG && W.SNAP_CONFIG.readDiet === false); }
  function DB() { var v = W.vishnuFirebase; return v && v.enabled ? v.db : null; }
  function adminUser() { try { var u = W.vishnuFirebase.auth.currentUser; return !!(u && !u.isAnonymous && u.email); } catch (e) { return false; } }
  function adminInst() { try { return adminUser() && typeof getCurrentAdminInstituteId === "function" ? getCurrentAdminInstituteId() : null; } catch (e) { return null; } }
  function jget(k) { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch (e) { return null; } }
  function jset(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }

  /* ---------- Timestamp <-> JSON (cache me save/restore) ---------- */
  function plain(v) {
    if (v == null || typeof v !== "object") return v;
    if (typeof v.toMillis === "function") return { __t: v.toMillis() };
    if (Array.isArray(v)) return v.map(plain);
    var o = {}; Object.keys(v).forEach(function (k) { o[k] = plain(v[k]); }); return o;
  }
  function revive(v) {
    if (v == null || typeof v !== "object") return v;
    if (Array.isArray(v)) return v.map(revive);
    var ks = Object.keys(v);
    if (ks.length === 1 && ks[0] === "__t") { try { return firebase.firestore.Timestamp.fromMillis(v.__t); } catch (e) { var n = v.__t; return { seconds: Math.floor(n / 1000), nanoseconds: 0, toMillis: function () { return n; }, toDate: function () { return new Date(n); } }; } }
    var o = {}; ks.forEach(function (k) { o[k] = revive(v[k]); }); return o;
  }
  API.cget = function (key, maxAge) {
    var c = jget(key); if (!c || !c.items || !c.at) return null;
    if (maxAge && Date.now() - c.at > maxAge) return null;
    return { v: c.v, at: c.at, items: revive(c.items) };
  };
  API.cset = function (key, v, items) { jset(key, { v: v, at: Date.now(), items: plain(items) }); };

  /* ---------- version doc ---------- */
  var memo = { inst: "", t: 0, p: null };
  API.ver = function (inst, force) {
    var d = DB(); if (!on() || !inst || !d) return Promise.resolve(null);
    var n = Date.now(); if (!force && memo.inst === inst && memo.p && n - memo.t < 45000) return memo.p;
    var p = Promise.resolve(W.vishnuFirebase.authReady).catch(function () {})
      .then(function () { return d.collection("institutes").doc(inst).collection("ver").doc("main").get(); })
      .then(function (s) { return s.exists ? s.data() : {}; }, function () { return null; });
    memo = { inst: inst, t: n, p: p };
    p.then(function (v) { if (v === null && memo.p === p) memo.t = 0; });
    return p;
  };
  API.invalidate = function () { memo.t = 0; };

  /* ---------- generic cached list (batch items / avail batches) ----------
     key: localStorage key, verKey: ver doc ka field, fetchQ(): server query (billed), dirtyId: admin ke apne likhe huye badlav ka mark */
  var dirty = {};
  function docsOf(q) { return q.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); }); }
  API.cached = function (key, verKey, fetchQ, ver, force, maxAge, dirtyId) {
    if (!on()) return fetchQ().then(docsOf);
    var c = API.cget(key, maxAge || 4 * H), cur = ver ? (ver[verKey] || 0) : null;
    var isDirty = dirtyId && dirty[dirtyId];
    if (!force && !isDirty && c && (cur === null || c.v === cur)) return Promise.resolve(c.items);
    return fetchQ().then(function (q) {
      var items = docsOf(q); API.cset(key, cur === null ? 0 : cur, items); if (dirtyId) delete dirty[dirtyId]; return items;
    }).catch(function (e) { if (c) return c.items; throw e; });
  };

  /* ---------- student: tests list (live listener ki jagah, version-gated) ----------
     Pehle: har app-open par (30 min se purane listener ka) saare tests dobara gine jaate the.
     Ab: version wahi to Firestore ka apna local cache (0 reads); badla ho to ek baar server se. */
  var lastTests = 0;
  API.testsListen = function (q, cb, err, inst) {
    var stopped = false;
    API.ver(inst).then(function (ver) {
      if (stopped) return;
      var meta = jget("snap_diet_tests_meta"), cur = ver ? (ver.tests || 0) : null;
      var ok = meta && meta.inst === inst && Date.now() - meta.at < 4 * H && (cur === null || meta.v === cur);
      var p = ok ? q.get({ source: "cache" }).then(function (s) { return s.size && s.size >= meta.n ? s : null; }, function () { return null; }) : Promise.resolve(null);
      return p.then(function (s) {
        if (s) return s;
        return q.get().then(function (sv) { jset("snap_diet_tests_meta", { inst: inst, v: cur === null ? 0 : cur, n: sv.size, at: Date.now() }); return sv; });
      });
    }).then(function (s) { if (!stopped && s) { lastTests = Date.now(); cb(s); } }).catch(function (e) { if (!stopped && err) err(e); });
    return function () { stopped = true; };
  };

  /* ---------- admin ke likhe badlav => ver doc me version bump (debounced) ---------- */
  var pend = {}, timer = null, origSet = null;
  function schedule(inst, keys, now) {
    if (!inst || !keys || !keys.length) return;
    var e = pend[inst] || (pend[inst] = {}); keys.forEach(function (k) { e[k] = 1; });
    clearTimeout(timer); timer = setTimeout(flush, now || keys.indexOf("notifs") > -1 ? 0 : 1200);
  }
  function flush() {
    var P = pend; pend = {}; var d = DB(); if (!d || !origSet) return;
    Object.keys(P).forEach(function (inst) {
      var u = {}, n = Date.now(); Object.keys(P[inst]).forEach(function (k) { u[k] = n; });
      try { var r = origSet.call(d.collection("institutes").doc(inst).collection("ver").doc("main"), u, { merge: true }); r && r.catch && r.catch(function (e) { console.warn("[diet] ver bump fail", e && e.code); }); } catch (e) {}
    });
  }
  function keysFor(path, data, op) {
    var p = String(path || "").split("/"), a = adminInst(); if (!a) return null;
    if (p[0] === "institutes" && p[1] === a) {
      if (p.length === 6 && p[2] === "batches" && p[4] === "items") { dirty[p[3]] = 1; return ["b_" + p[3]]; }
      if (p.length === 6 && p[2] === "batches" && p[4] === "catalog") return ["c_" + p[3]];   /* v218: catalog badla -> student ka version badle (admin ka items-cache nahi) */
      if (p.length === 4 && p[2] === "batches") {
        if (op === "update" && data && typeof data === "object" && Object.keys(data).every(function (k) { return k === "enrolledCount" || k === "updatedAt"; })) return null;
        return ["batches"];
      }
      if (p.length === 4 && p[2] === "notifications") return ["notifs"];
    }
    if (p[0] === "tests" && p.length === 2) return ["tests"];
    return null;
  }
  function note(path, data, op) { try { var k = keysFor(path, data, op); if (k) schedule(adminInst(), k); } catch (e) {} }
  function installWrites() {
    try {
      var F = W.firebase && firebase.firestore; if (!F || !F.DocumentReference || F.DocumentReference.prototype.__diet) return !!(F && F.DocumentReference && F.DocumentReference.prototype.__diet);
      var D = F.DocumentReference.prototype; origSet = D.set;
      ["set", "update", "delete"].forEach(function (m) {
        var o = D[m]; D[m] = function () {
          var self = this, a = arguments, r = o.apply(this, a);
          if (r && r.then) r.then(function () { note(self.path, m === "delete" ? null : a[0], m); }, function () {});
          return r;
        };
      });
      D.__diet = 1;
      if (F.CollectionReference) { var C = F.CollectionReference.prototype, oa = C.add; C.add = function (data) { var self = this, r = oa.apply(this, arguments); if (r && r.then) r.then(function (ref) { note(String(self.path) + "/" + ((ref && ref.id) || "x"), data, "add"); }, function () {}); return r; }; }
      if (F.WriteBatch) {
        var B = F.WriteBatch.prototype;
        ["set", "update", "delete"].forEach(function (m) {
          var o = B[m]; B[m] = function (ref, data) { try { var k = keysFor(ref && ref.path, m === "delete" ? null : data, m); if (k) { (this.__dk = this.__dk || []).push(k); } } catch (e) {} return o.apply(this, arguments); };
        });
        var oc = B.commit; B.commit = function () { var self = this, r = oc.apply(this, arguments); if (r && r.then) r.then(function () { try { var inst = adminInst(), ks = {}; (self.__dk || []).forEach(function (a) { a.forEach(function (k) { ks[k] = 1; }); }); schedule(inst, Object.keys(ks)); } catch (e) {} }, function () {}); return r; };
      }
      return true;
    } catch (e) { console.warn("[diet] install fail", e); return false; }
  }

  /* ---------- push aate hi / app wapas khulte hi refresh (tests + bell) ---------- */
  function student() { return typeof getStudentSession === "function" && !!(getStudentSession() || {}).mobile && !adminUser(); }
  function refreshNow() {
    API.invalidate();
    try { if (student() && typeof syncTests === "function") syncTests(); } catch (e) {}
    try { W.__snapBellRefresh && W.__snapBellRefresh(); } catch (e) {}
  }
  W.addEventListener("snap-push-in", function () { setTimeout(refreshNow, 1500); });
  document.addEventListener("visibilitychange", function () { if (document.visibilityState === "visible" && student() && Date.now() - lastTests > 180000) { lastTests = Date.now(); API.invalidate(); try { typeof syncTests === "function" && syncTests(); } catch (e) {} } });

  if (on() && !installWrites()) { var n = 0, iv = setInterval(function () { if (installWrites() || ++n > 20) clearInterval(iv); }, 500); }
})();
