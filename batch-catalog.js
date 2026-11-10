/* CATALOG (v218, Phase 2) — bade batch me student ke Firestore reads kam karna.

   Pehle: student batch kholta tha to us batch ke SAARE published items padhta tha (1000 items = 1000 reads, har badlaav ke baad dobara).
   Ab : har batch ka chhota "catalog" institutes/{inst}/batches/{b}/catalog/c1, c2... (har doc me max 300 entries, sirf published items,
        koi link/URL nahi). Student 1-5 reads me list dekh leta hai; poora item (link/file) tabhi padhta hai jab kholta/join karta hai.

   Sync: admin jab bhi kuch badalta hai (item, subject, chapter, import, bulk) to batch-system.js ka loadAll() chalta hai; uske baad
         SnapCatalog.sync() items se catalog banakar sirf BADLE huye docs likhta hai (hash se). Admin panel kholne par bhi apne aap theek hota hai.
   Safety: catalog na ho / fail ho to student ka purana tareeka (poore items) chalta hai. Kill-switch: SNAP_CONFIG.catalog = false */
(function () {
  "use strict";
  var MAXN = 300, MAXB = 70000;   /* ek doc me max entries / approx bytes (1 MiB limit se bahut door) */

  function ms(t) { return !t ? 0 : t.toMillis ? t.toMillis() : (typeof t === "number" ? t : new Date(t).getTime() || 0); }
  function hasFile(i) { return !!(i.url || i.fileId || i.storagePath || i.ownFile); }
  function str(v, n) { return String(v == null ? "" : v).slice(0, n); }

  /* item -> chhoti entry (sirf wahi jo student ki list ko chahiye) */
  function entryOf(it) {
    var e = { i: it.id, k: it.kind || "", t: str(it.title, 200) };
    if (it.subjectId) e.sid = it.subjectId; if (it.chapterId) e.cid = it.chapterId;
    if (it.subject) e.s = str(it.subject, 80); if (it.chapter) e.c = str(it.chapter, 80);
    var sc = ms(it.scheduledAt), cr = ms(it.createdAt); if (sc) e.d = sc; if (cr) e.cr = cr;
    if (it.status) e.st = it.status;
    if (it.ytId) e.v = it.ytId;
    if (it.durationMin) e.u = +it.durationMin || 0;
    if (it.kind !== "class" && hasFile(it)) e.f = 1;
    if (it.kind === "class" && !it.ytId && (it.liveRoom || it.liveUrl)) e.lv = 1;   /* purani (Jitsi/link) live — join par poora item aata hai */
    if (it.cat) e.ct = str(it.cat, 40);
    if (it.kind === "announcement" && it.desc) e.dc = str(it.desc, 300);
    return e;
  }
  /* entry -> item jaisa object (student ka maujooda UI code bina badle chale). _p = adhoora item (poora kholte waqt aayega) */
  function toItem(e, batchId, inst) {
    var o = { id: e.i, kind: e.k, title: e.t, subjectId: e.sid || "", chapterId: e.cid || "", subject: e.s || "", chapter: e.c || "", status: e.st || "", published: true, batchId: batchId, instituteId: inst, _p: 1 };
    if (e.d) o.scheduledAt = e.d; if (e.cr) o.createdAt = e.cr;
    if (e.v) o.ytId = e.v; if (e.u) o.durationMin = e.u; if (e.f) o._f = 1; if (e.lv) o._lv = 1;
    if (e.ct) o.cat = e.ct; if (e.dc) o.desc = e.dc;
    return o;
  }
  function hash(s) { var h = 5381, i; for (i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36) + "." + s.length; }

  /* published items -> catalog docs [{id:"c1", e:[...], h, n, tot}] (order stable: createdAt, phir id) */
  function build(items) {
    var pub = (items || []).filter(function (i) { return i && i.published === true && i.id; })
      .sort(function (a, b) { return (ms(a.createdAt) - ms(b.createdAt)) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0); });
    var docs = [], cur = [], sz = 0;
    pub.forEach(function (it) {
      var e = entryOf(it), l = JSON.stringify(e).length + 2;
      if (cur.length && (cur.length >= MAXN || sz + l > MAXB)) { docs.push(cur); cur = []; sz = 0; }
      cur.push(e); sz += l;
    });
    if (cur.length || !docs.length) docs.push(cur);   /* khaali batch ke liye bhi c1 (taaki student ko extra fallback read na lage) */
    return docs.map(function (e, k) { return { id: "c" + (k + 1), e: e, h: hash(JSON.stringify(e)), n: e.length, tot: docs.length }; });
  }

  function DB() { var v = window.vishnuFirebase; return v && v.enabled ? v.db : null; }
  function colOf(inst, b) { return DB().collection("institutes").doc(inst).collection("batches").doc(b).collection("catalog"); }
  function memoKey(inst, b) { return "snap_cat_h_" + inst + "_" + b; }
  function mget(k) { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch (e) { return null; } }
  function mset(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

  /* ---------- ADMIN: sync (items -> catalog). force=true to memo ignore karke sab dobara likhta hai ---------- */
  var busy = {};
  function sync(inst, b, items, force) {
    try {
      var d = DB(); if (!d || !inst || !b || busy[b]) return Promise.resolve(false);
      if (window.SNAP_CONFIG && window.SNAP_CONFIG.catalog === false) return Promise.resolve(false);
      var docs = build(items), key = memoKey(inst, b), memo = force ? null : mget(key), old = memo && memo.h ? memo.h : {}, oldN = memo ? memo.n || 0 : 0;
      var changed = docs.filter(function (x) { return old[x.id] !== x.h; }), extra = [];
      for (var k = docs.length + 1; k <= oldN; k++) extra.push("c" + k);
      if (!changed.length && !extra.length && memo) return Promise.resolve(false);
      busy[b] = 1;
      var FV = firebase.firestore.FieldValue, col = colOf(inst, b), wb = d.batch();
      changed.forEach(function (x) { wb.set(col.doc(x.id), { e: x.e, h: x.h, n: x.n, tot: x.tot, updatedAt: FV.serverTimestamp() }); });
      extra.forEach(function (id) { wb.delete(col.doc(id)); });
      return wb.commit().then(function () {
        var h = {}; docs.forEach(function (x) { h[x.id] = x.h; }); mset(key, { h: h, n: docs.length });
        delete busy[b]; return true;
      }).catch(function (e) { delete busy[b]; console.warn("[catalog] sync fail", e && e.code); return false; });
    } catch (e) { console.warn("[catalog]", e); return Promise.resolve(false); }
  }
  function syncAll(inst, batches, itemsByBatch, force) {
    return (batches || []).reduce(function (p, b) { return p.then(function () { return sync(inst, b.id, itemsByBatch[b.id] || [], force); }); }, Promise.resolve());
  }
  function drop(inst, b) {   /* batch delete ke saath catalog bhi hatao */
    var d = DB(); if (!d) return Promise.resolve();
    return colOf(inst, b).get().then(function (q) { var wb = d.batch(); q.docs.forEach(function (x) { wb.delete(x.ref); }); try { localStorage.removeItem(memoKey(inst, b)); } catch (e) {} return q.size ? wb.commit() : null; }).catch(function () {});
  }

  /* ---------- STUDENT: catalog padho -> item-jaise objects (null = catalog nahi, purana tareeka chalao) ---------- */
  function on() { return !(window.SNAP_CONFIG && window.SNAP_CONFIG.catalog === false); }
  function load(inst, b) {
    if (!on() || !DB()) return Promise.resolve(null);
    return colOf(inst, b).get().then(function (q) {
      if (!q.size) return null;
      var ds = q.docs.map(function (x) { return Object.assign({ id: x.id }, x.data()); }), c1 = ds.filter(function (x) { return x.id === "c1"; })[0];
      if (!c1) return null;
      var tot = +c1.tot || ds.length, seen = {}, out = [];
      ds.filter(function (x) { var n = +String(x.id).slice(1); return n >= 1 && n <= tot; })
        .sort(function (a, z) { return (+a.id.slice(1)) - (+z.id.slice(1)); })
        .forEach(function (x) { (x.e || []).forEach(function (e) { if (e && e.i && !seen[e.i]) { seen[e.i] = 1; out.push(toItem(e, b, inst)); } }); });
      return out;
    }).catch(function () { return null; });
  }
  /* poora item (link/file ke saath): kholte/join karte waqt 1 read, phir memory me yaad */
  var fullMemo = {};
  function full(it) {
    if (!it || !it._p) return Promise.resolve(it);
    var k = it.instituteId + "/" + it.batchId + "/" + it.id; if (fullMemo[k]) return Promise.resolve(fullMemo[k]);
    return DB().collection("institutes").doc(it.instituteId).collection("batches").doc(it.batchId).collection("items").doc(it.id).get().then(function (s) {
      if (!s.exists) throw new Error("Ye content ab available nahi hai");
      return (fullMemo[k] = Object.assign({ id: s.id }, s.data()));
    });
  }

  var API = { entryOf: entryOf, toItem: toItem, build: build, hash: hash, sync: sync, syncAll: syncAll, drop: drop, load: load, full: full };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  if (typeof window !== "undefined") window.SnapCatalog = API;
})();
