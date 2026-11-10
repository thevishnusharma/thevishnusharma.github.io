/* READ TRACKER (v236) — poori site ke Firestore reads ginta hai (student, admin, owner) aur Worker ko bhejta hai.
   Owner Panel > Reads tab me: kab, kis collection se, kis function/line se, kitne reads.

   Kaise: firebase compat SDK ke Query.get / DocumentReference.get / onSnapshot ko lapet deta hai (data nahi badalta).
   Ginti ka niyam (Firestore billing jaisa):
     - cache se aaya (fromCache)  = 0 read      - doc get = 1 read      - query get = jitne doc aaye (kam se kam 1)
     - listener ka pehla server snapshot = poore doc; uske baad har badla hua doc = 1 read
   Ye ek anumaan hai (resume-token / metadata ki wajah se Firebase ke asli number se thoda farak aa sakta hai —
   Owner Panel dono saath dikhata hai).
   Kis user ne padha (owner ke liye): admin/owner = email, student = mobile + naam. Doc ka data/ID kuch nahi jaata.
   Kill-switch: SNAP_CONFIG.readTracker = false. Ye file na chale to app bilkul pehle jaisa chalta hai. */
(function () {
  "use strict";
  var W = window;
  if (W.SnapReads) return;
  var cfg = W.SNAP_CONFIG || {};
  if (cfg.readTracker === false) return;

  var API = W.SnapReads = { buf: {}, total: 0, sent: 0, fails: 0, lastErr: "" };
  var MAXROWS = 60, FLUSH_MS = 30000, FLUSH_AT = 400;

  function dev() {
    try {
      var d = localStorage.getItem("snap_rd_dev");
      if (!d) { d = Math.random().toString(36).slice(2, 10); localStorage.setItem("snap_rd_dev", d); }
      return d;
    } catch (e) { return "nodev"; }
  }
  function role() {
    try {
      if (/owner-app|owner=/.test(W.location.pathname + W.location.search)) return "owner";
      if (typeof W.ownerGetAuth === "function" || (document.getElementById && document.getElementById("owner-panel-box"))) return "owner";   // Owner APK me page ka naam index.html ban jaata hai
      var a = W.vishnuFirebase && W.vishnuFirebase.auth, u = a && a.currentUser;
      return u && !u.isAnonymous && u.email ? "admin" : "student";
    } catch (e) { return "student"; }
  }
  /* kis user ne padha: admin/owner = email, student = mobile (+naam), warna anonymous uid ka chhota hissa */
  function who(r) {
    try {
      if (r === "owner") {
        var oa = null; try { oa = W.firebase.app("owner-panel-session").auth().currentUser; } catch (e) {}
        return [(oa && oa.email) || "owner", ""];
      }
      var u = W.vishnuFirebase && W.vishnuFirebase.auth && W.vishnuFirebase.auth.currentUser;
      if (r === "admin") return [(u && u.email) || "admin", ""];
      var ss = null; try { ss = JSON.parse(localStorage.getItem("savya_student_session") || "null"); } catch (e) {}
      if (ss && (ss.mobile || ss.phone)) return [String(ss.mobile || ss.phone), String(ss.name || "")];
      return ["anon:" + String((u && u.uid) || "?").slice(0, 6), ""];
    } catch (e) { return ["?", ""]; }
  }
  var cl = function (x, n) { return String(x == null ? "" : x).replace(/[|\n\r]/g, "_").slice(0, n); };
  /* path me id ki jagah {id}; 'institutes/<id>/...' se institute alag nikalo */
  function tpl(path) {
    var s = String(path || "").split("/").filter(Boolean), inst = "";
    if (s[0] === "institutes" && s[1]) inst = s[1];
    var t = s.map(function (x, i) { return i % 2 === 1 ? "{id}" : x; }).join("/");
    return { coll: t.slice(0, 80), inst: inst.slice(0, 60) };
  }
  function queryPath(q) {
    try {
      if (q.path && typeof q.path === "string") return q.path;
      var d = q._delegate || q, qq = d._query || d._queryCore || null;
      if (qq) {
        if (qq.collectionGroup) return "(group)/" + qq.collectionGroup;
        if (qq.path && qq.path.canonicalString) return qq.path.canonicalString();
      }
      if (d.path && d.path.canonicalString) return d.path.canonicalString();
    } catch (e) {}
    return "?";
  }
  /* kaun sa function / file:line ne read mangi */
  function site() {
    try {
      var lines = String(new Error().stack || "").split("\n");
      for (var i = 1; i < lines.length; i++) {
        var l = lines[i];
        if (!l || /read-tracker\.js|firebasejs|firebase-firestore|gstatic\.com|<anonymous>$/.test(l)) continue;
        var fn = "", m = /at\s+(?:async\s+)?([^\s(]+)\s+\(/.exec(l) || /^\s*([^@\s]+)@/.exec(l);
        if (m) fn = m[1].replace(/^Object\.|^async\s+/, "");
        var f = /([^\/\s()@]+?)(?:\?[^:)\s]*)?:(\d+):\d+\)?\s*$/.exec(l);
        var loc = f ? f[1] + ":" + f[2] : "";
        if (!fn && !loc) continue;
        return (fn && fn !== "<anonymous>" ? fn : "anon") + "@" + loc;
      }
    } catch (e) {}
    return "unknown";
  }

  function rec(kind, path, n, st) {
    try {
      var t = tpl(path), min = Math.floor(Date.now() / 60000);
      var r = role(), w = who(r), key = [min, r, t.inst, t.coll, kind, st, cl(w[0], 60), cl(w[1], 40)].join("|");
      var b = API.buf[key] || (API.buf[key] = { n: 0, c: 0 });
      b.n += n; b.c += 1; API.total += n;
      if (n >= FLUSH_AT) flush(false);
    } catch (e) {}
  }

  /* ---- wrappers ---- */
  function wrapGet(proto, isDoc) {
    var orig = proto && proto.get; if (!orig || orig.__st) return;
    proto.get = function () {
      var self = this, st = site(), p = isDoc ? self.path : queryPath(self);
      var pr = orig.apply(self, arguments);
      try {
        pr.then(function (snap) {
          try {
            var cached = snap && snap.metadata && snap.metadata.fromCache;
            if (isDoc) rec("doc", p, cached ? 0 : 1, st);
            else rec("get", p, cached ? 0 : Math.max(1, snap.size || 0), st);
          } catch (e) {}
        }, function () {});
      } catch (e) {}
      return pr;
    };
    proto.get.__st = 1;
  }
  function wrapListen(proto, isDoc) {
    var orig = proto && proto.onSnapshot; if (!orig || orig.__st) return;
    proto.onSnapshot = function () {
      var self = this, st = site(), p = isDoc ? self.path : queryPath(self), first = true;
      var args = Array.prototype.slice.call(arguments);
      function count(snap) {
        try {
          var md = snap && snap.metadata;
          if (!md || md.fromCache || md.hasPendingWrites) return;
          if (isDoc) { rec(first ? "listen" : "listen+", p, 1, st); first = false; return; }
          var ch = snap.docChanges ? snap.docChanges().length : 0;
          if (first) { rec("listen", p, Math.max(1, snap.size || 0), st); first = false; }
          else if (ch) rec("listen+", p, ch, st);
        } catch (e) {}
      }
      for (var i = 0; i < args.length; i++) {
        var a = args[i];
        if (typeof a === "function") {
          args[i] = (function (f) { return function (snap) { count(snap); return f.apply(this, arguments); }; })(a);
          break;
        }
        if (a && typeof a === "object" && typeof a.next === "function") {
          var o = a, nx = o.next;
          args[i] = { next: function (snap) { count(snap); return nx.apply(o, arguments); }, error: o.error && o.error.bind(o), complete: o.complete && o.complete.bind(o) };
          break;
        }
      }
      return orig.apply(self, args);
    };
    proto.onSnapshot.__st = 1;
  }
  function install() {
    var F = W.firebase && W.firebase.firestore;
    if (!F || API.installed) return !!API.installed;
    wrapGet(F.Query && F.Query.prototype, false);
    wrapListen(F.Query && F.Query.prototype, false);
    wrapGet(F.DocumentReference && F.DocumentReference.prototype, true);
    wrapListen(F.DocumentReference && F.DocumentReference.prototype, true);
    /* CollectionReference apne prototype par override kare to use bhi lapeto */
    try {
      if (F.CollectionReference) {
        var cp = F.CollectionReference.prototype;
        if (Object.prototype.hasOwnProperty.call(cp, "get")) wrapGet(cp, false);
        if (Object.prototype.hasOwnProperty.call(cp, "onSnapshot")) wrapListen(cp, false);
      }
    } catch (e) {}
    API.installed = true; return true;
  }

  /* ---- bhejna ---- */
  function url() { var u = cfg.workerUrl; return u ? String(u).replace(/\/+$/, "") + "/readlog" : ""; }
  function token() {
    try {
      var a = W.vishnuFirebase && W.vishnuFirebase.auth, u = a && a.currentUser;
      if (!u && W.firebase && W.firebase.apps && W.firebase.apps.length) { try { u = W.firebase.auth().currentUser; } catch (e) {} }
      return u ? u.getIdToken() : Promise.resolve("");
    } catch (e) { return Promise.resolve(""); }
  }
  function take() {
    var keys = Object.keys(API.buf), now = Math.floor(Date.now() / 60000), rows = [], left = {};
    keys.forEach(function (k) {
      var p = k.split("|"), v = API.buf[k];
      if (rows.length < MAXROWS) rows.push([+p[0], p[1], p[2], p[3], p[4], p[5], v.n, v.c, p[6] || "", p[7] || ""]); else left[k] = v;
    });
    API.buf = left; return rows;
  }
  function flush(final) {
    var u = url(); if (!u || !Object.keys(API.buf).length) return;
    var rows = take(); if (!rows.length) return;
    var body = JSON.stringify({ v: 1, build: String(cfg.build || ""), dev: dev(), rows: rows });
    token().then(function (tk) {
      var h = { "Content-Type": "application/json" }; if (tk) h.Authorization = "Bearer " + tk;
      return fetch(u, { method: "POST", headers: h, body: body, keepalive: !!final });
    }).then(function (r) { if (r && r.ok) API.sent += rows.length; else throw new Error("http " + (r && r.status)); })
      .catch(function (e) {
        API.fails++; API.lastErr = String(e && e.message || e);
        if (API.fails < 5) rows.forEach(function (r) { var k = r.slice(0, 6).concat([r[8], r[9]]).join("|"), b = API.buf[k] || (API.buf[k] = { n: 0, c: 0 }); b.n += r[6]; b.c += r[7]; });   // dobara koshish
      });
  }
  API.flush = function () { flush(false); };
  API.install = install;

  var tries = 0, iv = setInterval(function () { if (install() || ++tries > 80) clearInterval(iv); }, 250);
  install();
  setInterval(function () { flush(false); }, FLUSH_MS);
  try {
    W.addEventListener("pagehide", function () { flush(true); });
    document.addEventListener("visibilitychange", function () { if (document.visibilityState === "hidden") flush(true); });
  } catch (e) {}
})();
