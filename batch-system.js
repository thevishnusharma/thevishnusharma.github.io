/* The Vishnu Sharma — Batch Management System v1
   Admin Panel (batches, live classes, recordings, notes, PPT, students, announcements) + Student "Batch" section.
   Data: institutes/{instituteId}/batches/{batchId}  +  .../items/{itemId}  +  .../members/{mobile}
   Free-tier safe: koi Firebase Storage / Cloud Functions nahi — files ke liye link (Drive/YouTube/URL). */
(function () {
  "use strict";
  var CFG = window.SNAP_CONFIG || {};
  var NOTE_TYPES = [["Notes", "note"], ["Handwritten Notes", "note"], ["Worksheet", "material"], ["Question Bank", "material"], ["Important Questions", "material"], ["Formula Sheet", "material"], ["Previous Year Paper", "material"], ["Reference Document", "material"]];
  var CLASSES = ["Class 6", "Class 7", "Class 8", "Class 9", "Class 10", "Class 11", "Class 12", "Foundation", "Other"];

  function $(s, r) { return (r || document).querySelector(s); }
  function esc(t) { return String(t == null ? "" : t).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function DB() { var v = window.vishnuFirebase; return v && v.enabled ? v.db : null; }
  function FV() { return firebase.firestore.FieldValue; }
  function authReady() { var v = window.vishnuFirebase; return Promise.resolve(v && v.authReady).catch(function () {}); }
  function toast(m) { var b = document.createElement("div"); b.className = "bm-toast"; b.textContent = m; document.body.appendChild(b); setTimeout(function () { b.remove(); }, 2800); }
  function ms(t) { return !t ? 0 : t.toMillis ? t.toMillis() : new Date(t).getTime(); }
  function fdate(t) { if (!t) return "—"; return new Date(ms(t)).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }); }
  function rnd(n) { var a = new Uint8Array(n), s = ""; crypto.getRandomValues(a); a.forEach(function (x) { s += "abcdefghijkmnpqrstuvwxyz23456789"[x % 32]; }); return s; }
  function okUrl(u) { return /^https:\/\/[^\s]+$/i.test(u || ""); }
  /* v217 Phase 1: YouTube Live — sirf 11-char video ID save hoti hai (poora URL nahi) */
  function ytId(u) {
    u = String(u || "").trim(); var m;
    if ((m = u.match(/^https:\/\/(?:www\.|m\.|music\.)?youtube\.com\/(?:watch\?(?:[^#\s]*&)?v=|live\/|embed\/|shorts\/)([\w-]{11})(?![\w-])/i))) return m[1];
    if ((m = u.match(/^https:\/\/youtu\.be\/([\w-]{11})(?![\w-])/i))) return m[1];
    return "";
  }
  function ytWatch(id) { return "https://www.youtube.com/watch?v=" + id; }
  function ytViewer(it) {
    var id = it.ytId, v = document.createElement("div"); v.className = "bm-viewer";
    v.innerHTML = '<div class="vt"><b>🔴 ' + esc(it.title) + '</b><button data-o>YouTube me kholein ↗</button><button data-x>Leave</button></div><iframe title="YouTube Live" allow="autoplay; fullscreen; picture-in-picture; encrypted-media" allowfullscreen referrerpolicy="strict-origin-when-cross-origin" src="https://www.youtube-nocookie.com/embed/' + encodeURIComponent(id) + '?autoplay=1&rel=0&playsinline=1"></iframe><div class="bm-note" style="margin:0;padding:8px 12px;background:#0b1650;color:#cbd5e1">Video na chale to upar "YouTube me kholein" dabayein.</div>';
    v.querySelector("[data-x]").onclick = function () { v.remove(); };
    v.querySelector("[data-o]").onclick = function () { window.open(ytWatch(id), "_blank", "noopener"); };
    document.body.appendChild(v);
  }
  function liveUrl(room, name) { return "https://" + (CFG.liveDomain || "meet.jit.si") + "/" + room + (name ? "#userInfo.displayName=%22" + encodeURIComponent(name) + "%22&config.prejoinPageEnabled=false" : ""); }

  /* link -> in-app preview url (sirf wahi jo browser sach me dikha sakta hai) */
  function embed(u) {
    var m;
    if ((m = u.match(/drive\.google\.com\/file\/d\/([^/]+)/))) return { t: "frame", u: "https://drive.google.com/file/d/" + m[1] + "/preview" };
    if ((m = u.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|live\/))([\w-]{6,})/))) return { t: "frame", u: "https://www.youtube-nocookie.com/embed/" + m[1] };
    if (/\.(mp4|webm|m3u8|mov|m4v|mp3|m4a|wav|ogg)(\?|$)/i.test(u)) return { t: "video", u: u };
    if (/\.(png|jpe?g|gif|webp|bmp)(\?|$)/i.test(u)) return { t: "frame", u: u };
    if (/\.(pdf|pptx?|docx?|xlsx?)(\?|$)/i.test(u)) return { t: "frame", u: "https://docs.google.com/viewer?embedded=true&url=" + encodeURIComponent(u) };
    return { t: "link", u: u };
  }
  function viewer(title, url, o) {
    o = o || {}; var e = url.indexOf("blob:") === 0 ? (/pdf|image/.test(o.mime || "") ? { t: "frame", u: url } : /video/.test(o.mime || "") ? { t: "video", u: url } : { t: "link", u: url }) : (o.mime && /^(image|video|audio)\//.test(o.mime) ? { t: /^image/.test(o.mime) ? "frame" : "video", u: url } : embed(url)), v = document.createElement("div"); v.className = "bm-viewer";
    v.innerHTML = '<div class="vt"><b>' + esc(title) + '</b><button data-d>⬇</button><button data-o>Open ↗</button><button data-x>✕</button></div>' +
      (e.t === "video" ? '<video controls autoplay playsinline src="' + esc(e.u) + '"></video>' : e.t === "frame" ? '<iframe allow="autoplay; fullscreen" allowfullscreen src="' + esc(e.u) + '"></iframe>' :
        '<div style="color:#fff;padding:24px;text-align:center">Is file ka preview in-app nahi ho sakta (PPT/DOC jaisi files).<br><br>Upar <b>⬇</b> se download karke apne phone ki app me kholein.</div>');
    v.querySelector("[data-x]").onclick = function () { v.remove(); };
    v.querySelector("[data-o]").onclick = function () { window.open(url, "_blank", "noopener"); };
    v.querySelector("[data-d]").onclick = function () { var a = document.createElement("a"); a.href = url; a.download = o.name || title; a.target = "_blank"; a.rel = "noopener"; document.body.appendChild(a); a.click(); a.remove(); };
    document.body.appendChild(v);
  }
  function liveViewer(title, url) {
    var v = document.createElement("div"); v.className = "bm-viewer";
    v.innerHTML = '<div class="vt"><b>🔴 ' + esc(title) + '</b><button data-o>Browser me kholein ↗</button><button data-x>Leave</button></div><iframe allow="camera; microphone; display-capture; autoplay; fullscreen; clipboard-write" src="' + esc(url) + '"></iframe>';
    v.querySelector("[data-x]").onclick = function () { v.remove(); };
    v.querySelector("[data-o]").onclick = function () { window.open(url, "_blank", "noopener"); };
    document.body.appendChild(v);
  }
  /* live join: mode "inapp" = app ke andar (Jitsi iframe), "external" = doosri app ka link (Zoom/Meet/YouTube...) */
  function joinLive(it, name) {
    if (it.ytId && CFG.youtubeLive !== false) return ytViewer(it);   /* v217: YouTube embed (kill-switch: SNAP_CONFIG.youtubeLive=false) */
    if (it._p) return fullOf(it).then(function (f) { f && joinLive(f, name); });   /* v218: catalog ka adhoora item -> poora laakar join */
    if (it.mode === "external") { if (!it.liveUrl) return toast("Live link abhi available nahi hai"); window.open(it.liveUrl, "_blank", "noopener"); return; }
    if (it.mode === "own") return toast("Ye purani SnapLive class hai — ab available nahi. Admin se YouTube link maangein.");   /* v216: SnapLive hata diya */
    if (!it.liveRoom) return toast("Class abhi live nahi hai");
    var s = (typeof getStudentSession === "function" && getStudentSession()) || {}, u = liveUrl(it.liveRoom, name || s.name || "Student");
    CFG.liveEmbed === false ? window.open(u, "_blank", "noopener") : liveViewer(it.title, u);
  }
  function hasFile(i) { return !!(i.url || i.fileId || i.storagePath || i.ownFile || i._f); }
  /* v218 catalog: adhoora item (_p) ko kholne/join se pehle poora laao (1 read). Fail ho to saaf message. */
  function fullOf(it) { return (window.SnapCatalog ? window.SnapCatalog.full(it) : Promise.resolve(it)).catch(function (e) { toast("Content nahi khula: " + (e && e.message || e)); return null; }); }
  /* ---- direct upload: Firebase Storage (ON ho to) warna Firestore chunks (max 4MB) ---- */
  var CH = 600000, MAXCH = 4 * 1024 * 1024;
  function storage() { var v = window.vishnuFirebase; return v && v.storage; }
  function b64(buf) { var s = "", a = new Uint8Array(buf), k = 0x8000; for (var i = 0; i < a.length; i += k) s += String.fromCharCode.apply(null, a.subarray(i, i + k)); return btoa(s); }
  function uploadFile(file, inst, batchId, prog) {
    var sd = window.SnapDrive;
    if (sd && sd.blocked && sd.blocked(inst)) { toast("Pehle Institute Settings → Mera Storage me apna Drive jodein"); return Promise.reject(Object.assign(new Error("Drive jura nahi"), { quota: true })); }
    if (sd && sd.ready()) {
      var qc = window.SnapQuota ? window.SnapQuota.check(inst, file.size) : Promise.resolve({ ok: true });
      return qc.then(function (q) {
        if (!q.ok) { toast(q.msg); return Promise.reject(Object.assign(new Error(q.msg), { quota: true })); }
        return sd.upload(file, { inst: inst, batchId: batchId }, prog).then(function (d) { window.SnapQuota && window.SnapQuota.add(inst, d.size); toast("✅ Upload ho gaya • Link apne aap ban gaya"); return { url: d.url, driveId: d.id, fileName: d.name, fileType: d.type, fileSize: d.size }; })
          .catch(function (e) { console.warn("[SnapDrive] fail:", e); toast("Google Drive upload nahi hua: " + (e && e.message || e) + " — doosre tareeke se try ho raha hai…"); return uploadFileOld(file, inst, batchId, prog); });
      });
    }
    return uploadFileOld(file, inst, batchId, prog);
  }
  function uploadFileOld(file, inst, batchId, prog) {
    var sf = window.SnapFiles;
    if (sf && sf.ready()) return sf.upload(file, { inst: inst, batchId: batchId }, prog).then(function (of) { if (of.used) toast("✅ Upload ho gaya • Storage: " + Math.round(of.used / 1048576) + " MB / 1 GB"); return { ownFile: of, fileName: file.name, fileType: of.type || file.type || "", fileSize: of.size }; })
      .catch(function (e) { console.warn("[SnapFiles] apna storage fail — Firebase tareeka:", e); try { sf.noteFail(e); } catch (x) {} toast(e && (e.status === 507 || e.status === 413) ? e.message : "Apna storage nahi chala — dusre storage se upload ho raha hai…"); return uploadFileFb(file, inst, batchId, prog); });
    return uploadFileFb(file, inst, batchId, prog);
  }
  function uploadFileFb(file, inst, batchId, prog) {
    var safe = file.name.replace(/[^\w.\-]+/g, "_"), path = "batches/" + inst + "/" + batchId + "/" + Date.now() + "_" + safe, st = storage();
    function viaChunks() {
      if (file.size > MAXCH) return Promise.reject(new Error("Online storage chalu nahi hai — file 4MB tak hi upload hogi. Badi file ke liye link use karein."));
      return file.arrayBuffer().then(function (buf) {
        var d = b64(buf), n = Math.ceil(d.length / CH) || 1, fref = bref(inst, batchId).collection("files").doc();
        return fref.set({ instituteId: inst, name: file.name, type: file.type || "", size: file.size, chunks: n, createdAt: FV().serverTimestamp() }).then(function () {
          var p = Promise.resolve();
          for (var i = 0; i < n; i++) (function (i) { p = p.then(function () { prog && prog(Math.round(100 * i / n)); return fref.collection("parts").doc(String(i)).set({ i: i, data: d.slice(i * CH, (i + 1) * CH) }); }); })(i);
          return p;
        }).then(function () { return { fileId: fref.id, fileName: file.name, fileType: file.type || "", fileSize: file.size }; });
      });
    }
    if (!st) return viaChunks();
    try { st.setMaxUploadRetryTime && st.setMaxUploadRetryTime(15000); } catch (e) {}
    return new Promise(function (res, rej) {
      var task; try { task = st.ref(path).put(file, file.type ? { contentType: file.type } : undefined); } catch (e) { return rej(e); }
      task.on("state_changed", function (x) { prog && prog(Math.round(100 * x.bytesTransferred / x.totalBytes)); }, rej, function () { task.snapshot.ref.getDownloadURL().then(function (u) { res({ url: u, storagePath: path, fileName: file.name, fileType: file.type || "", fileSize: file.size }); }, rej); });
    }).catch(function (e) { console.warn("Storage upload fail — chunk fallback", e); return viaChunks(); });
  }
  function loadChunked(inst, batchId, fileId) {
    var fr = bref(inst, batchId).collection("files").doc(fileId);
    return fr.get().then(function (d) {
      if (!d.exists) throw new Error("File nahi mili");
      var m = d.data();
      return fr.collection("parts").orderBy("i").get().then(function (q) {
        if (q.size !== m.chunks) throw new Error("File adhoori hai");
        var arr = q.docs.map(function (x) { var bin = atob(x.data().data), u = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; });
        return { blob: new Blob(arr, { type: m.type || "application/octet-stream" }), name: m.name, type: m.type || "" };
      });
    });
  }
  function openItem(it, inst) {
    if (it._p) return fullOf(it).then(function (f) { f && openItem(f, inst); });   /* v218: catalog ka adhoora item -> poora laakar kholo */
    if (it.ownKey) return toast("Ye purani SnapLive recording hai — ab available nahi. Admin se YouTube link maangein.");   /* v216 */
    if (it.ownFile && window.SnapFiles) {
      var ou = window.SnapFiles.urlOf(it.ownFile), on = it.ownFile.name || it.fileName || "";
      /* v172: apni storage ki PDF app ke andar (pdf.js) — Google viewer ki ~25MB limit se "too large" nahi aata */
      if (window.SnapPdf && (/pdf/i.test(it.ownFile.type || "") || /\.pdf$/i.test(on))) return window.SnapPdf.open(it.title, ou, { name: on, size: it.ownFile.size });
      return viewer(it.title, ou, { name: on, mime: it.ownFile.type });
    }
    if (it.fileId) { toast("File load ho rahi hai…"); return loadChunked(inst, it.batchId, it.fileId).then(function (f) { viewer(it.title, URL.createObjectURL(f.blob), { mime: f.type, name: f.name }); }).catch(function (e) { toast("File nahi khuli: " + (e.message || e.code)); }); }
    if (!it.url && it.storagePath && storage()) { toast("File load ho rahi hai…"); return storage().ref(it.storagePath).getDownloadURL().then(function (u) { viewer(it.title, u, { name: it.fileName }); }).catch(function (e) { toast("File nahi khuli (permission/network): " + (e.code || e.message)); }); }
    viewer(it.title, it.url, { name: it.fileName });
  }
  function deleteFileOf(it) {
    try {
      if (it.ownFile && it.ownFile.key && window.SnapFiles) window.SnapFiles.remove(it.ownFile.key);
      if (it.driveId && window.SnapDrive) window.SnapDrive.remove(it.driveId).then(function (ok) { if (ok && window.SnapQuota) window.SnapQuota.sub(A.inst, it.fileSize || 0); });
      if (it.storagePath && storage()) storage().ref(it.storagePath).delete().catch(function () {});
      if (it.fileId) { var fr = bref(A.inst, it.batchId).collection("files").doc(it.fileId); fr.collection("parts").get().then(function (q) { var wb = DB().batch(); q.docs.forEach(function (d) { wb.delete(d.ref); }); wb.delete(fr); return wb.commit(); }).catch(function () {}); }
    } catch (e) {}
  }
  function rupee(n) { return "₹" + Number(n || 0).toLocaleString("en-IN"); }
  function pref(inst) { return DB().collection("institutes").doc(inst).collection("batchSettings").doc("payment"); }
  /* image -> chhota dataURL (QR / payment screenshot), Firestore doc me save hota hai */
  function shrink(file, maxW, maxLen) {
    return new Promise(function (res, rej) {
      var fr = new FileReader(); fr.onerror = rej;
      fr.onload = function () { var im = new Image(); im.onerror = rej; im.onload = function () {
        var c = Math.min(1, maxW / im.width), cv = document.createElement("canvas"); cv.width = Math.round(im.width * c); cv.height = Math.round(im.height * c); cv.getContext("2d").drawImage(im, 0, 0, cv.width, cv.height);
        var q = 0.9, u = cv.toDataURL("image/jpeg", q); while (u.length > maxLen && q > 0.3) { q -= 0.1; u = cv.toDataURL("image/jpeg", q); }
        u.length > maxLen ? rej(new Error("Image bahut badi hai")) : res(u); }; im.src = fr.result; };
      fr.readAsDataURL(file);
    });
  }
  function showImg(title, src) {
    var v = document.createElement("div"); v.className = "bm-viewer";
    v.innerHTML = '<div class="vt"><b>' + esc(title) + '</b><button data-x>✕</button></div><div style="flex:1;overflow:auto;text-align:center;background:#111"><img src="' + src + '" style="max-width:100%"></div>';
    v.querySelector("[data-x]").onclick = function () { v.remove(); }; document.body.appendChild(v);
  }
  function bref(inst, id) { var c = DB().collection("institutes").doc(inst).collection("batches"); return id ? c.doc(id) : c; }
  function stBadge(it) {
    if (it.kind === "class") return it.status === "live" ? '<span class="bm-badge bm-live">LIVE</span>' : it.status === "completed" ? '<span class="bm-badge">Completed</span>' : it.status === "cancelled" ? '<span class="bm-badge r">Cancelled</span>' : '<span class="bm-badge b">Upcoming</span>';
    if (it.kind === "recording") return { processing: '<span class="bm-badge o">Processing</span>', ready: '<span class="bm-badge p">Ready for Review</span>', published: '<span class="bm-badge g">Published</span>', unpublished: '<span class="bm-badge">Unpublished</span>', failed: '<span class="bm-badge r">Failed</span>' }[it.status] || "";
    return it.published ? '<span class="bm-badge g">Published</span>' : '<span class="bm-badge">Draft</span>';
  }

  /* =================== ADMIN =================== */
  var A = { inst: null, batches: [], items: {}, students: null, view: "dash", f: {} };
  function adminEmail() { try { return (window.vishnuFirebase.auth.currentUser.email || "").toLowerCase(); } catch (e) { return ""; } }
  function audit(action, ref) { try { bref(A.inst).parent.collection("auditLogs").add({ action: action, ref: ref || "", by: adminEmail(), at: FV().serverTimestamp() }); } catch (e) {} }
  function allItems() { var a = []; Object.keys(A.items).forEach(function (b) { a = a.concat(A.items[b]); }); return a; }
  function batchName(id) { var b = A.batches.filter(function (x) { return x.id === id; })[0]; return b ? b.name : "—"; }

  function openAdmin() {
    if (typeof isAdminLoggedIn === "function" && !isAdminLoggedIn()) return;
    if (!DB()) return toast("Server se connection nahi hai");
    /* v201 INSTANT OPEN: panel turant dikhao (pichla data ho to usi se), network load peeche chalta hai */
    var inst0 = typeof getCurrentAdminInstituteId === "function" ? getCurrentAdminInstituteId() : null;
    var warm = !!(inst0 && A.inst === inst0 && A.loaded && A.batches);
    A.touched = false; A.openSeq = (A.openSeq || 0) + 1; var seq = A.openSeq;
    buildAdmin();
    if (warm) adminGo(A.view || "dash"); else $("#bm-main").innerHTML = '<div class="bm-empty">Loading…</div>';
    Promise.resolve(typeof ensureAdminInstituteResolved === "function" ? ensureAdminInstituteResolved() : null).then(function () {
      var inst = typeof getCurrentAdminInstituteId === "function" ? getCurrentAdminInstituteId() : null;
      if (!inst) { var ov = $("#bm-admin"); ov && ov.remove(); return toast("Institute resolve nahi hua — dobara try karein"); }
      if (A.inst !== inst) { A.inst = inst; A.loaded = false; }
      return loadAll().then(function () {
        A.loaded = true;
        if (seq !== A.openSeq || !$("#bm-admin")) return;
        if (!warm || !A.touched) adminGo(warm ? (A.view || "dash") : "dash");
      });
    }).catch(function (e) { console.warn(e); var m = $("#bm-main"); m && (m.innerHTML = '<div class="bm-empty">Data load nahi hua (' + esc(e.code || e.message) + '). Firestore Rules publish kiye? NOTES padhein.</div>'); });
  }
  /* v169: enrolledCount negative (jaise -8) ho gaya ho to asli members gin kar sahi number save karo (normal batch par koi extra read nahi) */
  function healCounts() {
    var bad = A.batches.filter(function (b) { return typeof b.enrolledCount === "number" && b.enrolledCount < 0; });
    if (!bad.length) return Promise.resolve();
    return Promise.all(bad.map(function (b) {
      return bref(A.inst, b.id).collection("members").get().then(function (q) { b.enrolledCount = q.size; return bref(A.inst, b.id).update({ enrolledCount: q.size }); }).catch(function () { b.enrolledCount = 0; });
    }));
  }
  function loadAll() {
    return authReady().then(function () { return bref(A.inst).get(); }).then(function (q) {
      A.batches = q.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); }); A.items = {};
      /* v170 read-diet: admin ke apne naye badlaav wale batch ke items hi dobara; baaki cache (ver doc se doosre admin ke badlaav bhi pakde jaate hain) */
      return (window.SnapDiet ? window.SnapDiet.ver(A.inst, true) : Promise.resolve(null)).then(function (ver) {
        return Promise.all(A.batches.map(function (b) {
          var fq = function () { return bref(A.inst, b.id).collection("items").get(); };
          var p = window.SnapDiet ? window.SnapDiet.cached("snap_diet_items_A_" + b.id, "b_" + b.id, fq, ver, false, 1800000, b.id) : fq().then(function (s) { return s.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); }); });
          return p.then(function (arr) { A.items[b.id] = arr; });
        }));
      });
    }).then(function () {
      /* v218: admin ka koi bhi badlaav (item/subject/chapter/import/bulk) loadAll se guzarta hai -> catalog apne aap match (sirf badle docs likhte hain) */
      try { window.SnapCatalog && CFG.catalog !== false && window.SnapCatalog.syncAll(A.inst, A.batches, A.items, false); } catch (e) {}
      return healCounts();
    }).then(function () {
      A.reqs = [];
      return Promise.all(A.batches.map(function (b) { return bref(A.inst, b.id).collection("requests").get().then(function (q) { q.docs.forEach(function (d) { var x = d.data(); if (x.status === "pending") A.reqs.push({ batchId: b.id, mobile: d.id, name: x.name, createdAt: x.createdAt, amount: x.amount, utr: x.utr, shot: x.shot }); }); }).catch(function () {}); }));
    });
  }
  var NAV = [["dash", "🏠", "Dashboard"], ["batches", "🎓", "Batch Management"], ["class", "🔴", "Live Classes"], ["recording", "🎬", "Recorded Lectures"], ["note", "📄", "Notes & Study Material"], ["ppt", "📊", "PPT / Presentations"], ["tests", "📝", "Tests & Assignments"], ["students", "👥", "Students"], ["pay", "💰", "Payments"], ["payset", "💳", "Payment Setup (UPI QR)"], ["announcement", "📢", "Announcements"]];
  /* v168: extension registry (batch-phase2.js) */
  var EXT = { adminViews: {}, studentTabs: {}, hooks: {} };
  function navAll() {
    var base = NAV.map(function (n) { var x = EXT.adminViews[n[0]]; return x && x.label ? [n[0], x.icon || n[1], x.label] : n; });
    Object.keys(EXT.adminViews).forEach(function (k) { if (!NAV.some(function (n) { return n[0] === k; })) base.push([k, EXT.adminViews[k].icon || "•", EXT.adminViews[k].label || k]); });
    return base;
  }
  function ctx() { return { A: A, S: S, DB: DB, FV: FV, bref: bref, esc: esc, ms: ms, fdate: fdate, toast: toast, form: form, sure: sure, audit: audit, adminEmail: adminEmail, ytId: ytId, ytWatch: ytWatch, authReady: authReady, loadAll: loadAll, adminGo: adminGo, driveBanner: driveBanner, openItem: openItem, hasFile: hasFile, sess: sess, rnd: rnd, shrink: shrink, subjOf: subjOf, batchName: batchName, topBtn: topBtn, stBadge: stBadge, rupee: rupee, sBatch: sBatch, sHome: sHome, closeStudent: closeStudent, allItems: allItems, joinLive: joinLive, $: $ }; }
  function nv(ev, it) { try { window.SnapV169 && window.SnapV169.itemEvent(ev, it); } catch (e) { console.warn(e); } }
  function fire(name, a, b) { try { var f = EXT.hooks[name]; f && f(a, b); } catch (e) { console.warn("[batch hook " + name + "]", e); } }
  function buildAdmin() {
    var o = $("#bm-admin"); o && o.remove();
    o = document.createElement("div"); o.id = "bm-admin";
    o.innerHTML = '<aside class="bm-side"><div class="bm-logo">' + (window.SnapBrand && SnapBrand.logoHtml ? SnapBrand.logoHtml(30) : '<img src="icon-512-maskable.png" alt="">') + (window.SnapBrand && SnapBrand.ident ? SnapBrand.esc(SnapBrand.ident({ name: "The Vishnu Sharma" }).name) : "The Vishnu Sharma") + '</div>' +
      navAll().map(function (n) { return '<button class="bm-nav" data-v="' + n[0] + '"><span>' + n[1] + '</span>' + n[2] + '</button>'; }).join("") +
      '<button class="bm-nav" data-v="exit"><span>⬅️</span>Admin Home</button><div class="bm-me">' + esc(adminEmail()) + '<br>Admin</div></aside>' +
      '<main class="bm-main"><div class="bm-top"><button class="bm-burger" id="bm-burger">☰</button><h2 id="bm-title"></h2><span id="bm-topact"></span></div><div id="bm-drivebn"></div><div id="bm-main"></div></main>';
    document.body.appendChild(o);
    $("#bm-burger").onclick = function () { o.classList.toggle("open"); };
    o.querySelectorAll(".bm-nav").forEach(function (b) { b.onclick = function () { A.touched = true; o.classList.remove("open"); b.dataset.v === "exit" ? o.remove() : (A.f = {}, adminGo(b.dataset.v)); }; });
  }
  function adminGo(v) {
    A.view = v; var t = (navAll().filter(function (n) { return n[0] === v; })[0] || [0, 0, "Dashboard"])[2];
    $("#bm-title").textContent = t; $("#bm-topact").innerHTML = "";
    var sb = $('#bm-admin .bm-nav[data-v="students"]'); sb && (sb.innerHTML = "<span>👥</span>Students" + (A.reqs && A.reqs.length ? ' <span class="bm-badge o">' + A.reqs.length + "</span>" : ""));
    document.querySelectorAll("#bm-admin .bm-nav").forEach(function (b) { b.classList.toggle("on", b.dataset.v === v); });
    var m = $("#bm-main"); driveBanner();
    var xv = EXT.adminViews[v]; if (xv && xv.render) { try { return xv.render(m, ctx()); } catch (e) { console.warn(e); m.innerHTML = '<div class="bm-empty">Ye section load nahi hua: ' + esc(e.message || e) + "</div>"; return; } }
    ({ dash: vDash, batches: vBatches, students: vStudents, tests: vTests, pay: vPay, payset: vPaySet })[v] ? ({ dash: vDash, batches: vBatches, students: vStudents, tests: vTests, pay: vPay, payset: vPaySet })[v](m) : vItems(m, v);
  }
  /* v219: "Setup adhoora" banner — Drive jura na ho to. SNAP_CONFIG.onboarding=false par band. */
  function driveBanner() {
    var bn = $("#bm-drivebn"); if (!bn || !window.SnapDrive || (window.SNAP_CONFIG || {}).onboarding === false) return;
    window.SnapDrive.status(A.inst).then(function (s) {
      var b = $("#bm-drivebn"); if (!b) return;
      if (s.connected || s.unknown) { b.innerHTML = ""; return; }
      var ok = !!(window.SNAP_CONFIG || {}).googleClientId;
      b.innerHTML = '<div class="bm-card bx-warn" style="margin:8px 0"><b>⚠️ Setup adhoora: apna Drive jodein</b><div class="bm-note">' + (ok ? "Institute Settings → Mera Storage me Google Drive jodein. Tab tak links/YouTube chalte rahenge." : "Drive jodne ka setup abhi baaki hai (Owner ko batayein). Tab tak links/YouTube chalte rahenge.") + "</div></div>";
    });
  }
  function topBtn(label, fn) { var s = $("#bm-topact"); s.innerHTML = '<button class="bm-btn">' + label + '</button>'; s.firstChild.onclick = fn; }

  function vDash(m) {
    var all = allItems(), now = new Date(), d0 = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime(), d1 = d0 + 864e5;
    var live = all.filter(function (i) { return i.kind === "class" && (i.status === "live" || (i.status === "upcoming" && ms(i.scheduledAt) >= d0 && ms(i.scheduledAt) < d1)); });
    var students = A.batches.reduce(function (s, b) { return s + (b.enrolledCount || 0); }, 0);
    var st = [["Total Batches", A.batches.length], ["Total Enrollments", students], ["Live Classes Today", live.length], ["Recorded Lectures", all.filter(function (i) { return i.kind === "recording"; }).length],
      ["Active Batches", A.batches.filter(function (b) { return b.status === "active"; }).length], ["Uploaded Notes", all.filter(function (i) { return i.kind === "note" || i.kind === "material"; }).length], ["Uploaded PPTs", all.filter(function (i) { return i.kind === "ppt"; }).length], ["Announcements", all.filter(function (i) { return i.kind === "announcement"; }).length]];
    var max = Math.max.apply(null, [1].concat(A.batches.map(function (b) { return b.enrolledCount || 0; })));
    var recent = all.slice().sort(function (a, b) { return ms(b.createdAt) - ms(a.createdAt); }).slice(0, 6);
    m.innerHTML = '<div class="bm-stats">' + st.map(function (s) { return '<div class="bm-stat"><small>' + s[0] + '</small><b>' + s[1] + '</b></div>'; }).join("") + '</div>' +
      '<div class="bm-grid2"><div class="bm-card"><h3>Today\'s Live Classes</h3>' + (live.length ? live.map(function (i) { return '<div class="bm-row"><div class="g"><b>' + esc(i.title) + '</b><small>' + esc(batchName(i.batchId)) + ' • ' + fdate(i.scheduledAt) + '</small></div>' + stBadge(i) + '</div>'; }).join("") : '<div class="bm-empty">Aaj koi live class schedule nahi hai.</div>') + '</div>' +
      '<div class="bm-card"><h3>Recent Activity</h3>' + (recent.length ? recent.map(function (i) { return '<div class="bm-row"><div class="g"><b>' + esc(i.title) + '</b><small>' + esc(i.kind) + ' • ' + esc(batchName(i.batchId)) + '</small></div><small>' + fdate(i.createdAt) + '</small></div>'; }).join("") : '<div class="bm-empty">Abhi koi activity nahi.</div>') + '</div></div>' +
      '<div class="bm-card"><h3>Students per Batch</h3>' + (A.batches.length ? '<div class="bm-bars">' + A.batches.slice(0, 8).map(function (b) { return '<div><i style="height:' + Math.round(100 * (b.enrolledCount || 0) / max) + '%"></i>' + (b.enrolledCount || 0) + '<br>' + esc((b.name || "").slice(0, 10)) + '</div>'; }).join("") + '</div>' : '<div class="bm-empty">Pehle ek batch banayein.</div>') + '</div>';
  }

  /* ---------- generic modal form ---------- */
  function form(title, fields, vals, save) {
    var md = document.createElement("div"); md.className = "bm-modal";
    md.innerHTML = '<div class="bm-sheet"><h3>' + esc(title) + '</h3><div class="bm-form">' + fields.map(function (f) {
      var v = vals[f.k] == null ? "" : vals[f.k], id = 'bmf_' + f.k, inp;
      if (f.t === "select") inp = '<select id="' + id + '">' + f.o.map(function (o) { var ov = Array.isArray(o) ? o[0] : o, ol = Array.isArray(o) ? o[1] : o; return '<option value="' + esc(ov) + '"' + (String(v) === String(ov) ? " selected" : "") + '>' + esc(ol) + '</option>'; }).join("") + '</select>';
      else if (f.t === "textarea") inp = '<textarea id="' + id + '" rows="3">' + esc(v) + '</textarea>';
      else if (f.t === "file") inp = '<input id="' + id + '" type="file" accept="' + esc(f.acc || "") + '">'; else inp = '<input id="' + id + '" type="' + (f.t || "text") + '" value="' + esc(v) + '" placeholder="' + esc(f.p || "") + '">';
      return '<label>' + esc(f.l) + (f.r ? " *" : "") + '</label>' + inp + (f.h ? '<div class="bm-note">' + f.h + '</div>' : "");
    }).join("") + '<div class="acts"><button class="bm-btn sec" data-c>Cancel</button><button class="bm-btn" data-s>Save</button></div></div></div>';
    document.body.appendChild(md); fire("form", md, title);
    md.querySelector("[data-c]").onclick = function () { md.remove(); };
    md.querySelector("[data-s]").onclick = function () {
      var out = {}, bad = "";
      fields.forEach(function (f) { var el = md.querySelector("#bmf_" + f.k); if (f.t === "file") { out[f.k] = (el.files && el.files[0]) || null; return; } var v = el.value.trim(); out[f.k] = v; if (f.r && !v && !bad) bad = f.l + " zaroori hai"; });
      if (bad) return toast(bad);
      var btn = md.querySelector("[data-s]"); btn.disabled = true;
      Promise.resolve(save(out)).then(function (ok) { ok === false ? (btn.disabled = false) : md.remove(); }).catch(function (e) { console.warn(e); btn.disabled = false; toast("Save nahi hua: " + (e.code || e.message)); });
    };
  }
  function sure(msg) { return confirm(msg); }

  /* ---------- Batches ---------- */
  function subjOf(b) { return Array.isArray(b.subjects) ? b.subjects : []; }
  function vBatches(m) {
    topBtn("+ Create Batch", function () { batchForm(null); });
    var q = (A.f.q || "").toLowerCase(), s = A.f.s || "all";
    var rows = A.batches.filter(function (b) { return (s === "all" || b.status === s) && (!q || (b.name + b.code).toLowerCase().indexOf(q) > -1); }).sort(function (a, b) { return ms(b.createdAt) - ms(a.createdAt); });
    m.innerHTML = '<div class="bm-tools"><input id="bm-q" placeholder="Search batch…" value="' + esc(A.f.q || "") + '"><select id="bm-s">' + [["all", "All"], ["active", "Active"], ["inactive", "Inactive"], ["upcoming", "Upcoming"], ["archived", "Archived"]].map(function (o) { return '<option value="' + o[0] + '"' + (s === o[0] ? " selected" : "") + '>' + o[1] + '</option>'; }).join("") + '</select></div>' +
      '<div class="bm-tablewrap"><table class="bm-table"><tr><th>Batch</th><th>Class</th><th>Subjects</th><th>Teacher</th><th>Students</th><th>Status</th><th>Created</th><th>Actions</th></tr>' +
      (rows.length ? rows.map(function (b) { return '<tr><td><b>' + esc(b.name) + '</b><br><small>' + esc(b.code || "") + ' • ' + (b.fee ? rupee(b.fee) : "Free") + '</small></td><td>' + esc(b.classLabel || "") + '</td><td>' + esc(subjOf(b).join(", ")) + '</td><td>' + esc((b.teachers || []).join(", ")) + '</td><td>' + (b.enrolledCount || 0) + (b.limit ? "/" + b.limit : "") + '</td><td><span class="bm-badge ' + (b.status === "active" ? "g" : b.status === "upcoming" ? "b" : "") + '">' + esc(b.status) + '</span></td><td>' + fdate(b.createdAt).split(",")[0] + '</td><td><div class="bm-act">' +
        '<button class="bm-btn sec sm" data-a="content" data-id="' + b.id + '">Content</button><button class="bm-btn sec sm" data-a="stu" data-id="' + b.id + '">Students</button><button class="bm-btn sec sm" data-a="edit" data-id="' + b.id + '">Edit</button><button class="bm-btn sec sm" data-a="tog" data-id="' + b.id + '">' + (b.status === "active" ? "Deactivate" : b.status === "archived" ? "Unarchive" : "Activate") + '</button>' + (b.status !== "archived" ? '<button class="bm-btn sec sm" data-a="arc" data-id="' + b.id + '">Archive</button>' : "") + '<button class="bm-btn sec sm" data-a="cnt" data-id="' + b.id + '">Recount</button><button class="bm-btn red sm" data-a="del" data-id="' + b.id + '">Delete</button><button class="bm-btn red sm" data-a="delall" data-id="' + b.id + '">Delete + Data</button></div></td></tr>'; }).join("") : '<tr><td colspan="8"><div class="bm-empty">Koi batch nahi mila. "+ Create Batch" dabayein.</div></td></tr>') + '</table></div>';
    $("#bm-q").oninput = function () { A.f.q = this.value; var p = this.selectionStart; vBatches(m); var n = $("#bm-q"); n.focus(); n.setSelectionRange(p, p); };
    $("#bm-s").onchange = function () { A.f.s = this.value; vBatches(m); };
    m.querySelectorAll("[data-a]").forEach(function (b) { b.onclick = function () { batchAct(b.dataset.a, b.dataset.id); }; });
  }
  function batchForm(b) {
    var v = b ? Object.assign({}, b, { subjectsTxt: subjOf(b).join(", "), teachersTxt: (b.teachers || []).join(", "), sd: b.startDate || "", ed: b.endDate || "" }) : { status: "active", type: "hybrid", enrollment: "request", sd: "", ed: "" };
    form(b ? "Edit Batch" : "Create New Batch", [
      { k: "name", l: "Batch Name", r: 1, p: "Class 10th - Board 2026" }, { k: "code", l: "Batch Code", p: "C10-B26" },
      { k: "classLabel", l: "Class / Grade", t: "select", o: CLASSES }, { k: "subjectsTxt", l: "Subjects (comma se alag)", r: 1, p: "Maths, Science, SST" },
      { k: "desc", l: "Description", t: "textarea" }, { k: "imgf", l: "Batch Image (optional)", t: "file", acc: "image/*" }, { k: "teachersTxt", l: "Teachers (naam, comma se alag)", p: "Vikash Sir, Pooja Ma'am" },
      { k: "sd", l: "Start Date", t: "date", r: 1 }, { k: "ed", l: "End Date", t: "date", r: 1 },
      { k: "type", l: "Batch Type", t: "select", o: [["live", "Live Batch"], ["recorded", "Recorded Batch"], ["hybrid", "Hybrid (Live + Recorded)"]] },
      { k: "fee", l: "Batch Fee ₹ (0 = free)", t: "number", p: "0" }, { k: "enrollment", l: "Student Enrollment", t: "select", o: [["request", "Students request bhej sakte hain (admin approve karega)"], ["closed", "Band — sirf admin enroll kare"]] }, { k: "limit", l: "Enrollment Limit (khaali = unlimited)", t: "number" }, { k: "status", l: "Status", t: "select", o: ["active", "inactive", "upcoming"] }
    ], v, function (o) {
      if (o.ed < o.sd) { toast("End Date, Start Date se pehle nahi ho sakti"); return false; }
      var data = { name: o.name, code: o.code, classLabel: o.classLabel, subjects: o.subjectsTxt.split(",").map(function (x) { return x.trim(); }).filter(Boolean), desc: o.desc, teachers: o.teachersTxt.split(",").map(function (x) { return x.trim(); }).filter(Boolean), startDate: o.sd, endDate: o.ed, type: o.type, enrollment: o.enrollment || "request", fee: Math.max(0, Math.round(+o.fee || 0)), limit: o.limit ? Math.max(1, +o.limit) : 0, status: o.status, published: o.status !== "inactive", instituteId: A.inst, updatedAt: FV().serverTimestamp() };
      var imgP = o.imgf ? shrink(o.imgf, 640, 90000).then(function (u) { data.image = u; }) : Promise.resolve();
      return imgP.then(function () {
      var p = b ? bref(A.inst, b.id).update(data) : bref(A.inst).add(Object.assign(data, { enrolledCount: 0, createdAt: FV().serverTimestamp(), createdBy: adminEmail() }));
      return p; }).then(function () { audit(b ? "batch.update" : "batch.create", b ? b.id : data.name); toast("✅ Batch save ho gaya"); return loadAll().then(function () { adminGo("batches"); }); });
    });
  }
  /* ---------- v169: Batch + uska SAARA data ek saath delete (khatam hone wale batch ke liye) ----------
     Content (+ files / recordings), chat, assignments + submissions, test links (tests delete nahi hote — batch se alag ho jaate hain),
     subjects/chapters, doubts, attendance, progress, requests, members (students ke batchIds se bhi hatta hai). Payments ka record bacha rehta hai.
     Har step pehle data padhta hai, isliye beech me ruk jaye to dobara dabane par bacha hua bhi hat jaata hai. */
  function collRefs(col) { return col.get().then(function (q) { return q.docs.map(function (d) { return d.ref; }); }); }
  function delDocs(refs, prog) {
    var p = Promise.resolve(), done = 0;
    for (var i = 0; i < refs.length; i += 400) (function (part) {
      p = p.then(function () { var wb = DB().batch(); part.forEach(function (r) { wb.delete(r); }); return wb.commit().then(function () { done += part.length; prog && prog(done); }); });
    })(refs.slice(i, i + 400));
    return p;
  }
  function inGroups(list, n, fn) {
    var p = Promise.resolve();
    for (var i = 0; i < list.length; i += n) (function (g) { p = p.then(function () { return Promise.all(g.map(fn)); }); })(list.slice(i, i + n));
    return p;
  }
  function deleteBatchAll(b) {
    var id = b.id, B = bref(A.inst, id), ov = document.createElement("div");
    if (navigator.onLine === false) return toast("Internet chalu karein — delete online hi hota hai");
    ov.className = "bm-modal";
    ov.innerHTML = '<div class="bm-sheet"><h3>🗑️ ' + esc(b.name) + ' delete ho raha hai…</h3><p id="bm-dp" style="white-space:pre-wrap;font-size:.9rem;margin:8px 0">Shuru…</p><small>App band na karein jab tak ye khatam na ho.</small><div class="acts" id="bm-dx" style="display:none"><button class="bm-btn sec" data-c>Close</button></div></div>';
    document.body.appendChild(ov);
    var say = function (t) { var e = ov.querySelector("#bm-dp"); e && (e.textContent = t); };
    var items = [], mobiles = [];
    return Promise.resolve()
      .then(function () { say("Content padh rahe hain…"); return B.collection("items").get().then(function (q) { items = q.docs.map(function (d) { return Object.assign({ id: d.id, ref: d.ref }, d.data()); }); }); })
      .then(function () {   // live chat / hands + recordings ki files
        var k = 0; say("Content ka chat/files hata rahe hain… (" + items.length + ")");
        return inGroups(items, 6, function (it) {
          if (it.storagePath && storage()) storage().ref(it.storagePath).delete().catch(function () {});
          if (it.ownFile && it.ownFile.key && window.SnapFiles) window.SnapFiles.remove(it.ownFile.key);
          k++; return Promise.resolve();
        });
      })
      .then(function () { say("Content delete ho raha hai… (" + items.length + ")"); return delDocs(items.map(function (i) { return i.ref; }), function (n) { say("Content delete: " + n + "/" + items.length); }); })
      .then(function () {   // chunk me upload ki hui files
        say("Uploaded files hata rahe hain…");
        return collRefs(B.collection("files")).then(function (frs) {
          return inGroups(frs, 4, function (fr) { return collRefs(fr.collection("parts")).then(function (pr) { return delDocs(pr); }); }).then(function () { return delDocs(frs); });
        });
      })
      .then(function () {
        say("Assignments aur submissions hata rahe hain…");
        return B.collection("assignments").get().then(function (aq) {
          aq.docs.forEach(function (d) { var of = d.data().ownFile; if (of && of.key && window.SnapFiles) window.SnapFiles.remove(of.key); });
          var ars = aq.docs.map(function (d) { return d.ref; });
          return inGroups(ars, 4, function (ar) { return collRefs(ar.collection("submissions")).then(function (sr) { return delDocs(sr); }); }).then(function () { return delDocs(ars); });
        });
      })
      .then(function () {   // tests delete nahi — sirf batch se alag
        say("Test links hata rahe hain…");
        return B.collection("testLinks").get().then(function (q) {
          var tids = q.docs.map(function (d) { return d.data().testId; }).filter(Boolean);
          return inGroups(tids, 6, function (t) { return window.SnapV169 ? window.SnapV169.untagTest(t, id) : null; }).then(function () { return delDocs(q.docs.map(function (d) { return d.ref; })); });
        });
      })
      .then(function () {
        say("Subjects aur chapters hata rahe hain…");
        return collRefs(B.collection("subjects")).then(function (srs) {
          return inGroups(srs, 4, function (sr) { return collRefs(sr.collection("chapters")).then(function (cr) { return delDocs(cr); }); }).then(function () { return delDocs(srs); });
        });
      })
      .then(function () { say("Doubts, attendance, progress, requests hata rahe hain…"); return inGroups(["doubts", "attendance", "progress", "requests", "catalog"], 4, function (n) { return collRefs(B.collection(n)).then(function (r) { return delDocs(r); }).catch(function () {}); }); })
      .then(function () { say("Students ki enrollment hata rahe hain…"); return B.collection("members").get().then(function (q) { mobiles = q.docs.map(function (d) { return d.id; }); }); })
      .then(function () {
        var k = 0, db = DB();
        return inGroups(mobiles, 10, function (m) { return db.collection("students").doc(m).update({ batchIds: FV().arrayRemove(id) }).catch(function () {}).then(function () { k++; say("Students se batch hata: " + k + "/" + mobiles.length); }); });
      })
      .then(function () { return collRefs(B.collection("members")).then(function (r) { return delDocs(r); }); })
      .then(function () { say("Batch delete ho raha hai…"); return B.delete(); })
      .then(function () { audit("batch.deleteall", id); ov.remove(); A.students = null; toast("✅ Batch aur uska saara data delete ho gaya"); return loadAll(); })
      .then(function () { adminGo("batches"); })
      .catch(function (e) {
        console.warn(e); say("❌ Beech me ruk gaya: " + (e.code || e.message) + "\n\nDobara 'Delete + Data' dabayein — jo bacha hai wo bhi hat jaayega.");
        var x = ov.querySelector("#bm-dx"); x && (x.style.display = ""); var c = ov.querySelector("[data-c]"); c && (c.onclick = function () { ov.remove(); loadAll().then(function () { adminGo("batches"); }); });
      });
  }
  function batchAct(a, id) {
    var b = A.batches.filter(function (x) { return x.id === id; })[0]; if (!b) return;
    if (a === "cnt") {
      return bref(A.inst, id).collection("members").get().then(function (q) { return bref(A.inst, id).update({ enrolledCount: q.size }).then(function () { toast("✅ Students ginti theek ho gayi: " + q.size); return loadAll(); }); }).then(function () { adminGo("batches"); }).catch(function (e) { toast("Nahi hua: " + (e.code || e.message)); });
    }
    if (a === "edit") return batchForm(b);
    if (a === "content") { A.f = { batch: id }; return adminGo("class"); }
    if (a === "stu") { A.f = { batch: id }; return adminGo("students"); }
    if (a === "arc") { if (!sure('"' + b.name + '" ko Archive karein?\n\nNayi enrollment band ho jaayegi; enrolled students purana content dekhte rahenge. Kuch delete nahi hota — baad me Unarchive kar sakte hain.')) return; return bref(A.inst, id).update({ status: "archived", enrollment: "closed", updatedAt: FV().serverTimestamp() }).then(function () { audit("batch.archive", id); toast("Batch archive ho gaya"); return loadAll(); }).then(function () { adminGo("batches"); }); }
    if (a === "tog") { var on = b.status !== "active"; return bref(A.inst, id).update({ status: on ? "active" : "inactive", published: on, updatedAt: FV().serverTimestamp() }).then(function () { audit("batch." + (on ? "activate" : "deactivate"), id); return loadAll(); }).then(function () { adminGo("batches"); }); }
    if (a === "delall") {
      return Promise.all([bref(A.inst, id).collection("members").get(), bref(A.inst, id).collection("assignments").get(), bref(A.inst, id).collection("testLinks").get()]).then(function (r) {
        var msg = 'Batch "' + b.name + '" ka SAARA data permanently delete hoga:\n\n• ' + (A.items[id] || []).length + ' content (class / recording / notes / PPT / announcement) aur unki files\n• ' + r[0].size + ' students ki enrollment\n• ' + r[1].size + ' assignments (submissions ke saath)\n• ' + r[2].size + ' test links (tests delete nahi honge, batch se alag ho jaayenge)\n• subjects, chapters, doubts, attendance\n\nPayments ka record bacha rahega. YE UNDO NAHI HOGA.\n\nConfirm karne ke liye batch ka naam likhein:';
        var typed = prompt(msg, ""); if (typed == null) return;
        if (typed.trim().toLowerCase() !== String(b.name || "").trim().toLowerCase()) return toast("Naam match nahi hua — delete nahi kiya");
        return deleteBatchAll(b);
      }).catch(function (e) { toast("Nahi hua: " + (e.code || e.message)); });
    }
    if (a === "del") {
      var n = (A.items[id] || []).length;
      /* v169: counter par bharosa nahi — batch ke asli members gine jaate hain (counter galat/negative ho to bhi delete rukta nahi) */
      return bref(A.inst, id).collection("members").get().then(function (mq) {
        var real = mq.size;
        if (n || real) return alert("Is batch me " + n + " content aur " + real + " students hain.\nSafe policy: pehle content/students hatayein, ya batch ko Deactivate karein (data surakshit rahega).");
        if (!sure('Batch "' + b.name + '" permanently delete karein? Ye undo nahi hoga.')) return;
        return bref(A.inst, id).delete().then(function () { audit("batch.delete", id); return loadAll(); }).then(function () { adminGo("batches"); });
      }).catch(function (e) { toast("Nahi hua: " + (e.code || e.message)); });
    }
  }

  /* ---------- Items (class / recording / notes / ppt / announcement) ---------- */
  var KIND_OF = { class: ["class"], recording: ["recording"], note: ["note", "material"], ppt: ["ppt"], announcement: ["announcement"] };
  function vItems(m, v) {
    if (!A.batches.length) { m.innerHTML = '<div class="bm-card bm-empty">Pehle "Batch Management" me ek batch banayein.</div>'; return; }
    var kinds = KIND_OF[v], q = (A.f.q || "").toLowerCase(), bf = A.f.batch || "all";
    topBtn(v === "recording" ? "+ Add Recording" : v === "class" ? "+ Schedule Class" : "+ Add", function () { itemForm(v, null); });
    var rows = allItems().filter(function (i) { return kinds.indexOf(i.kind) > -1 && (bf === "all" || i.batchId === bf) && (!q || (i.title || "").toLowerCase().indexOf(q) > -1); }).sort(function (a, b) { return (ms(b.scheduledAt) || ms(b.createdAt)) - (ms(a.scheduledAt) || ms(a.createdAt)); });
    m.innerHTML = '<div class="bm-tools"><select id="bm-bf"><option value="all">All Batches</option>' + A.batches.map(function (b) { return '<option value="' + b.id + '"' + (bf === b.id ? " selected" : "") + '>' + esc(b.name) + '</option>'; }).join("") + '</select><input id="bm-q" placeholder="Search…" value="' + esc(A.f.q || "") + '"></div>' +
      '<div class="bm-tablewrap"><table class="bm-table"><tr><th>Title</th><th>Batch</th><th>Subject</th><th>' + (v === "class" ? "Schedule" : "Date") + '</th><th>Status</th><th>Actions</th></tr>' +
      (rows.length ? rows.map(function (i) { return '<tr><td><b>' + esc(i.title) + '</b>' + (i.cat ? '<br><small>' + esc(i.cat) + '</small>' : "") + '</td><td>' + esc(batchName(i.batchId)) + '</td><td>' + esc(i.subject || "—") + '</td><td>' + fdate(i.scheduledAt || i.createdAt) + '</td><td>' + stBadge(i) + '</td><td><div class="bm-act">' + itemActs(i) + '</div></td></tr>'; }).join("") : '<tr><td colspan="6"><div class="bm-empty">Abhi kuch nahi hai. Upar "+" se jodein.</div></td></tr>') + '</table></div>' +
      (v === "recording" ? '<div class="bm-note">ℹ️ Recording tab "Ready" hoti hai jab aap uska valid link (YouTube unlisted / Google Drive / video URL) jodte hain.</div>' : "");
    $("#bm-bf").onchange = function () { A.f.batch = this.value; vItems(m, v); };
    $("#bm-q").oninput = function () { A.f.q = this.value; var p = this.selectionStart; vItems(m, v); var n = $("#bm-q"); n.focus(); n.setSelectionRange(p, p); };
    m.querySelectorAll("[data-a]").forEach(function (b) { b.onclick = function () { itemAct(b.dataset.a, b.dataset.b, b.dataset.id, v); }; });
  }
  function itemActs(i) {
    var a = function (k, l, c) { return '<button class="bm-btn ' + (c || "sec") + ' sm" data-a="' + k + '" data-b="' + i.batchId + '" data-id="' + i.id + '">' + l + '</button>'; }, h = "";
    if (i.kind === "class") {
      if (i.status === "upcoming") h += a("golive", "▶ Go Live", "");
      if (i.status === "live") h += a("rejoin", "Rejoin") + a("end", "■ End Class", "red");
      if (i.status === "upcoming") h += a("cancel", "Cancel");
    }
    if (hasFile(i)) h += a("view", "View");
    if (i.kind === "recording") {
      if (i.status === "ready" || i.status === "unpublished") h += a("pub", "Publish", "");
      if (i.status === "published") h += a("unpub", "Unpublish");
      if (i.status === "processing") h += a("fail", "Mark Failed");
      if (i.status === "failed") h += a("retry", "Retry");
    } else if (i.kind !== "class") h += a(i.published ? "unpub" : "pub", i.published ? "Unpublish" : "Publish", i.published ? "sec" : "");
    return h + a("edit", "Edit") + a("del", "Delete", "red");
  }
  function itemForm(v, it) {
    var kind = it ? it.kind : KIND_OF[v][0], bs = A.batches.map(function (b) { return [b.id, b.name]; }), upl = kind === "note" || kind === "material" || kind === "ppt" || kind === "recording";
    var f = [{ k: "batchId", l: "Batch", t: "select", o: bs, r: 1 }, { k: "title", l: "Title", r: 1 }];
    if (kind === "note" || kind === "material") f.push({ k: "cat", l: "Type", t: "select", o: NOTE_TYPES.map(function (x) { return x[0]; }) });
    if (kind !== "announcement") f.push({ k: "subject", l: "Subject" }, { k: "chapter", l: "Chapter" });
    f.push({ k: "desc", l: kind === "announcement" ? "Message" : "Description", t: "textarea", r: kind === "announcement" });
    if (kind === "class") f.push({ k: "dt", l: "Date & Time", t: "datetime-local", r: 1, h: "Live class YouTube Live par hogi. 'Go Live' dabate waqt YouTube Live ka link daalein." }, { k: "durationMin", l: "Duration (minutes)", t: "number" }, { k: "teacher", l: "Teacher" });
    if (kind === "recording") f.push({ k: "durationMin", l: "Duration (minutes)", t: "number" }, { k: "teacher", l: "Teacher" });
    if (upl) f.push({ k: "file", l: it && (it.fileName || hasFile(it)) ? "Nayi File Upload (purani replace hogi)" : "File Upload", t: "file", acc: kind === "recording" ? "video/*,audio/*" : ".pdf,.ppt,.pptx,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip,image/*,audio/*,video/*", h: "Phone/computer se seedhe upload — apna storage (badi file bhi chalegi, koi size limit nahi). Pehle upload poora hone dein." }, { k: "url", l: "YA Link (https)", h: "Google Drive (anyone with link) / YouTube / direct URL. Upload ya link — dono me se ek." + (it && it.fileName ? "<br>Abhi: " + esc(it.fileName) : "") });
    var vals = it ? Object.assign({ mode: "inapp" }, it, { dt: it.scheduledAt ? new Date(ms(it.scheduledAt) - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 16) : "" }) : { batchId: A.f.batch || (A.batches[0] || {}).id, cat: "Notes", mode: "external", subject: A.f.subject || "", chapter: A.f.chapter || "" };
    form((it ? "Edit " : "Add ") + kind, f, vals, function (o) {
      var ve = EXT.validateItem && EXT.validateItem(o, kind); if (ve) { toast(ve); return false; }
      if (o.url && !okUrl(o.url)) { toast("Link https:// se shuru hona chahiye"); return false; }
      if (o.file && o.file.size > 52428800 && !(window.SnapFiles && window.SnapFiles.ready()) && !(window.SnapDrive && window.SnapDrive.ready())) { toast("File 50MB se badi hai"); return false; }
      if (kind === "class" && !it && new Date(o.dt).getTime() < Date.now() - 36e5) { toast("Past ka time schedule nahi ho sakta"); return false; }
      if ((kind === "note" || kind === "material" || kind === "ppt") && !o.file && !o.url && !(it && hasFile(it))) { toast("File upload karein ya link daalein"); return false; }
      var up = Promise.resolve(null);
      if (o.file) { toast("⏳ Upload ho raha hai… (band na karein)"); up = uploadFile(o.file, A.inst, o.batchId, function (p) { var b = $(".bm-sheet [data-s]"); b && (b.textContent = "Upload " + p + "%"); }); }
      return up.then(function (fi) {
        var data = { batchId: o.batchId, instituteId: A.inst, kind: kind, title: o.title, desc: o.desc || "", subject: o.subject || "", chapter: o.chapter || "", updatedAt: FV().serverTimestamp() };
        EXT.stampIds && EXT.stampIds(data, o);
        if (kind === "note" || kind === "material") { data.cat = o.cat; data.kind = NOTE_TYPES.filter(function (x) { return x[0] === o.cat; })[0][1]; }
        if (upl) {
          data.url = o.url || "";
          if (fi) { if (fi.ownFile) data.ownFile = fi.ownFile; else if (it && it.ownFile) data.ownFile = FV().delete(); data.url = (fi.storagePath || fi.ownFile) ? "" : (fi.url || "");   /* v168: Storage file ka permanent token-link save nahi hota; dekhte waqt rules ke baad resolve hota hai */ data.fileId = fi.fileId || ""; data.storagePath = fi.storagePath || ""; if (fi.driveId) data.driveId = fi.driveId; else if (it && it.driveId) data.driveId = FV().delete(); data.fileName = fi.fileName; data.fileType = fi.fileType; data.fileSize = fi.fileSize; }
          else if (it && o.url && o.url !== it.url) { data.fileId = ""; data.storagePath = ""; data.fileName = ""; if (it.ownFile) data.ownFile = FV().delete(); if (it.driveId) data.driveId = FV().delete(); }
          else if (it && !o.url && it.url) data.url = it.url;
        }
        var has = !!(data.url || data.fileId || data.storagePath || (fi && fi.ownFile) || (it && (it.fileId || it.storagePath || it.ownFile) && !fi));
        if (kind === "class") { data.mode = (it && it.status === "live" && it.mode) ? it.mode : "external";   /* v216: naye/edit class sirf link wali; chalti purani live ka mode na badle */ data.scheduledAt = firebase.firestore.Timestamp.fromDate(new Date(o.dt)); data.durationMin = +o.durationMin || 60; data.teacher = o.teacher || ""; if (!it) { data.status = "upcoming"; data.published = true; } }
        if (kind === "recording") { data.durationMin = +o.durationMin || 0; data.teacher = o.teacher || ""; if (has && (!it || it.status === "processing" || it.status === "failed")) data.status = "ready"; if (!it) { data.status = has ? "ready" : "processing"; data.published = false; } }
        if (kind === "announcement" && !it) data.published = true;
        if (!it && kind !== "class" && kind !== "recording" && kind !== "announcement") data.published = false;
        var p = it ? bref(A.inst, it.batchId).collection("items").doc(it.id).update(data) : bref(A.inst, o.batchId).collection("items").add(Object.assign(data, { createdAt: FV().serverTimestamp(), createdBy: adminEmail() }));
        return p.then(function () { if (it && (fi || (it.ownFile && o.url && o.url !== it.url))) deleteFileOf(it); if (!it && data.published === true && (kind === "class" || kind === "announcement")) nv(kind === "class" ? "class_new" : "announce", data); audit("item." + (it ? "update" : "create"), kind); toast("✅ Save ho gaya"); return loadAll().then(function () { adminGo(v); }); });
      });
    });
  }
  function itemRef(b, id) { return bref(A.inst, b).collection("items").doc(id); }
  function itemAct(a, b, id, v) {
    var it = (A.items[b] || []).filter(function (x) { return x.id === id; })[0]; if (!it) return;
    var done = function (msg) { return function () { audit("item." + a, id); msg && toast(msg); return loadAll().then(function () { adminGo(v); }); }; }, upd = function (d) { d.updatedAt = FV().serverTimestamp(); return itemRef(b, id).update(d); };
    if (a === "edit") return itemForm(v, it);
    if (a === "view") return openItem(it, A.inst);
    if (a === "del") { if (!sure('"' + it.title + '" delete karein? Ye undo nahi hoga.')) return; return itemRef(b, id).delete().then(function () { deleteFileOf(it); }).then(done("Delete ho gaya")); }
    if (a === "pub") { if (it.kind === "recording" && !hasFile(it)) return toast("Pehle recording ka valid link jodein (Edit)"); return upd(it.kind === "recording" ? { status: "published", published: true } : { published: true }).then(function (r) { if (!it.published) nv("pub", it); return r; }).then(done("Published")); }
    if (a === "unpub") return upd(it.kind === "recording" ? { status: "unpublished", published: false } : { published: false }).then(done("Unpublished"));
    if (a === "fail") return upd({ status: "failed" }).then(done());
    if (a === "retry") return upd({ status: "processing" }).then(done());
    if (a === "cancel") return upd({ status: "cancelled" }).then(done());
    if (a === "golive") {
      /* v217: YouTube Live link form; sirf video ID (ytId) save hoti hai. Kill-switch false ho to Phase 0 wala link-prompt. */
      if (CFG.youtubeLive === false) {
        var link0 = prompt("YouTube Live ka link daalein (https):", ""); if (!link0) return; link0 = link0.trim();
        if (!okUrl(link0)) return toast("Link https:// se shuru hona chahiye");
        return upd({ status: "live", mode: "external", liveUrl: link0, published: true, startedAt: FV().serverTimestamp() }).then(function (r) { nv("live_start", it); return r; }).then(done()).then(function () { window.open(link0, "_blank", "noopener"); });
      }
      return form("🔴 Go Live — YouTube", [{ k: "yt", l: "YouTube Live link", r: 1, p: "https://youtube.com/live/xxxxxxxxxxx", h: "Valid: youtube.com/live/ID, youtube.com/watch?v=ID, youtu.be/ID. Student ko ye link seedha nahi dikhega — class app ke andar chalegi." }], {}, function (o) {
        var id = ytId(o.yt); if (!id) { toast("Ye YouTube link sahi nahi hai. youtube.com/live/… ya youtu.be/… link daalein"); return false; }
        return upd({ status: "live", mode: "external", liveUrl: ytWatch(id), ytId: id, published: true, startedAt: FV().serverTimestamp() }).then(function (r) { nv("live_start", it); return r; }).then(done("🔴 Live shuru"));
      });
    }
    if (a === "rejoin") return joinLive(it, "Teacher");
    if (a === "end") {
      if (!sure("Class khatam karein?")) return;
      var has = (A.items[b] || []).some(function (x) { return x.kind === "recording" && x.classId === id; });
      var yid = it.ytId || ytId(it.liveUrl || "");   /* v217: YouTube Live ki recording = wahi video ID */
      return upd({ status: "completed", liveRoom: FV().delete(), liveUrl: FV().delete(), ytId: FV().delete(), endedAt: FV().serverTimestamp() }).then(function () {
        if (has) return;
        var rec = { batchId: b, instituteId: A.inst, kind: "recording", classId: id, title: it.title, desc: it.desc || "", subject: it.subject || "", chapter: it.chapter || "", subjectId: it.subjectId || "", chapterId: it.chapterId || "", teacher: it.teacher || "", status: yid ? "ready" : "processing", published: false, createdAt: FV().serverTimestamp(), createdBy: adminEmail(), updatedAt: FV().serverTimestamp() };
        if (yid) { rec.url = ytWatch(yid); rec.ytId = yid; }
        return bref(A.inst, b).collection("items").add(rec);
      }).then(done(yid ? "Class khatam. Recording 'Ready' (unpublished) bani — Recorded Lectures me dekhkar Publish karein." : "Class khatam. Recording 'Processing' me hai — Recorded Lectures me uska link jodein."));
    }
  }

  /* ---------- Students / enrollment ---------- */
  function vStudents(m) {
    var go = function () {
      var q = (A.f.q || "").toLowerCase(), bf = A.f.batch || "all";
      var rows = A.students.filter(function (s) { return (bf === "all" || (s.batchIds || []).indexOf(bf) > -1) && (!q || (s.name + s.mobile).toLowerCase().indexOf(q) > -1); }).slice(0, 200);
      var rq = (A.reqs || []).length ? '<div class="bm-card"><h3>📥 Enrollment Requests (' + A.reqs.length + ')</h3>' + A.reqs.map(function (r, ix) { return '<div class="bm-row"><div class="g"><b>' + esc(r.name || r.mobile) + '</b><small>' + esc(r.mobile) + ' • ' + esc(batchName(r.batchId)) + ' • ' + fdate(r.createdAt) + (r.amount ? '<br>💰 ' + rupee(r.amount) + ' • UTR: <b>' + esc(r.utr) + '</b>' : "") + '</small></div>' + (r.shot ? '<button class="bm-btn sec sm" data-sh="' + ix + '">Screenshot</button>' : "") + '<button class="bm-btn sm" data-ap="' + ix + '">Approve</button><button class="bm-btn red sm" data-rj="' + ix + '">Reject</button></div>'; }).join("") + '</div>' : "";
      m.innerHTML = rq + '<div class="bm-tools"><select id="bm-bf"><option value="all">All Students</option>' + A.batches.map(function (b) { return '<option value="' + b.id + '"' + (bf === b.id ? " selected" : "") + '>In: ' + esc(b.name) + '</option>'; }).join("") + '</select><input id="bm-q" placeholder="Name / mobile search…" value="' + esc(A.f.q || "") + '"></div>' +
        '<div class="bm-tablewrap"><table class="bm-table"><tr><th>Name</th><th>Mobile</th><th>Batches</th><th>Action</th></tr>' + (rows.length ? rows.map(function (s) { return '<tr><td><b>' + esc(s.name) + '</b></td><td>' + esc(s.mobile) + '</td><td>' + esc((s.batchIds || []).map(batchName).join(", ") || "—") + '</td><td><button class="bm-btn sec sm" data-m="' + esc(s.mobile) + '">Manage Batches</button></td></tr>'; }).join("") : '<tr><td colspan="4"><div class="bm-empty">Koi student nahi mila.</div></td></tr>') + '</table></div><div class="bm-note">Sirf aapke institute ke students dikhte hain. Max 200 dikhaye gaye — search use karein.</div>';
      $("#bm-bf").onchange = function () { A.f.batch = this.value; vStudents(m); };
      $("#bm-q").oninput = function () { A.f.q = this.value; var p = this.selectionStart; go(); var n = $("#bm-q"); n.focus(); n.setSelectionRange(p, p); };
      m.querySelectorAll("[data-sh]").forEach(function (b) { b.onclick = function () { showImg("Payment Screenshot", A.reqs[+b.dataset.sh].shot); }; });
      m.querySelectorAll("[data-ap]").forEach(function (b) { b.onclick = function () { reqAct("ap", A.reqs[+b.dataset.ap]); }; });
      m.querySelectorAll("[data-rj]").forEach(function (b) { b.onclick = function () { reqAct("rj", A.reqs[+b.dataset.rj]); }; });
      m.querySelectorAll("[data-m]").forEach(function (b) { b.onclick = function () { enrollForm(b.dataset.m); }; });
    };
    if (A.students) return go();
    m.innerHTML = '<div class="bm-empty">Loading students…</div>';
    authReady().then(function () { return DB().collection("students").where("instituteId", "==", A.inst).limit(500).get(); }).then(function (q) { A.students = q.docs.map(function (d) { return Object.assign({ mobile: d.id }, d.data()); }); go(); }).catch(function (e) { m.innerHTML = '<div class="bm-empty">Students load nahi hue (' + esc(e.code || e.message) + ')</div>'; });
  }
  function reqAct(a, r) {
    if (!r) return; var db = DB(), b = A.batches.filter(function (x) { return x.id === r.batchId; })[0], rr = bref(A.inst, r.batchId).collection("requests").doc(r.mobile);
    var fin = function (p, msg) { return p.then(function () { audit("enroll.request." + a, r.mobile); A.students = null; toast(msg); return loadAll(); }).then(function () { adminGo("students"); }).catch(function (e) { toast("Nahi hua: " + (e.code || e.message)); }); };
    if (a === "rj") { if (!sure("Request reject karein?" + (r.amount ? "\n\n⚠️ Student ne " + rupee(r.amount) + " pay kiya hai to refund aapko khud karna hoga." : ""))) return; return fin(rr.update({ status: "rejected" }), "Reject kiya"); }
    if (b && b.limit && (b.enrolledCount || 0) >= b.limit) return toast("Batch ki limit poori ho chuki hai");
    var go = function () { return rr.parent.parent.collection("members").doc(r.mobile).get().then(function (m0) { return !m0.exists; }, function () { return true; }).then(function (isNew) {
      var wb = db.batch(); wb.update(db.collection("students").doc(r.mobile), { batchIds: FV().arrayUnion(r.batchId) });
      wb.set(bref(A.inst, r.batchId).collection("members").doc(r.mobile), { mobile: r.mobile, name: r.name || "", instituteId: A.inst, enrolledAt: FV().serverTimestamp(), by: adminEmail(), paid: r.amount || 0 });
      if (isNew) wb.update(bref(A.inst, r.batchId), { enrolledCount: FV().increment(1) }); wb.delete(rr);
      if (r.amount) wb.set(db.collection("institutes").doc(A.inst).collection("payments").doc(), { instituteId: A.inst, batchId: r.batchId, mobile: r.mobile, name: r.name || "", amount: r.amount, utr: r.utr || "", at: FV().serverTimestamp(), by: adminEmail() });
      return fin(wb.commit(), "✅ Student enroll ho gaya");
    }); };
    if (!r.amount) return go();
    if (!sure("Approve se pehle apni UPI app / bank me check karein ki " + rupee(r.amount) + " (UTR " + r.utr + ") sach me aaya hai.\n\nPayment mil gaya? Approve karein?")) return;
    return db.collection("institutes").doc(A.inst).collection("payments").where("utr", "==", r.utr).limit(1).get().then(function (q) { if (!q.empty && !sure("⚠️ Ye UTR pehle kisi aur payment me use ho chuka hai! Phir bhi approve karein?")) return; return go(); }).catch(function (e) { toast("Check nahi hua: " + (e.code || e.message)); });
  }
    function enrollForm(mobile) {
    var s = A.students.filter(function (x) { return x.mobile === mobile; })[0], cur = s.batchIds || [], md = document.createElement("div"); md.className = "bm-modal";
    md.innerHTML = '<div class="bm-sheet"><h3>' + esc(s.name) + ' — Batches</h3><div class="bm-form">' + (A.batches.length ? A.batches.map(function (b) { return '<label style="display:flex;gap:8px;align-items:center;font-size:.86rem"><input type="checkbox" style="width:auto" value="' + b.id + '"' + (cur.indexOf(b.id) > -1 ? " checked" : "") + '>' + esc(b.name) + (b.limit ? ' <small>(' + (b.enrolledCount || 0) + '/' + b.limit + ')</small>' : "") + '</label>'; }).join("") : '<div class="bm-empty">Pehle batch banayein.</div>') + '<div class="acts"><button class="bm-btn sec" data-c>Cancel</button><button class="bm-btn" data-s>Save</button></div></div></div>';
    document.body.appendChild(md);
    md.querySelector("[data-c]").onclick = function () { md.remove(); };
    md.querySelector("[data-s]").onclick = function () {
      var sel = [].map.call(md.querySelectorAll("input:checked"), function (i) { return i.value; }), add = sel.filter(function (x) { return cur.indexOf(x) < 0; }), rem = cur.filter(function (x) { return sel.indexOf(x) < 0; });
      for (var k = 0; k < add.length; k++) { var bb = A.batches.filter(function (x) { return x.id === add[k]; })[0]; if (bb && bb.limit && (bb.enrolledCount || 0) >= bb.limit) return toast('"' + bb.name + '" ki limit poori ho chuki hai'); }
      var db = DB(), sref = db.collection("students").doc(mobile), exist = {}, step = Promise.all(add.concat(rem).map(function (id) { return bref(A.inst, id).collection("members").doc(mobile).get().then(function (d) { exist[id] = d.exists; }, function () { exist[id] = null; }); })).then(function () {});
      if (add.length) step = step.then(function () { var wb = db.batch(); wb.update(sref, { batchIds: FV().arrayUnion.apply(FV(), add) }); add.forEach(function (id) { wb.set(bref(A.inst, id).collection("members").doc(mobile), { mobile: mobile, name: s.name || "", instituteId: A.inst, enrolledAt: FV().serverTimestamp(), by: adminEmail() }); if (exist[id] === false) wb.update(bref(A.inst, id), { enrolledCount: FV().increment(1) }); }); return wb.commit(); });
      if (rem.length) step = step.then(function () { var wb = db.batch(); wb.update(sref, { batchIds: FV().arrayRemove.apply(FV(), rem) }); rem.forEach(function (id) { wb.delete(bref(A.inst, id).collection("members").doc(mobile)); if (exist[id] === true) wb.update(bref(A.inst, id), { enrolledCount: FV().increment(-1) }); }); return wb.commit(); });
      step.then(function () { s.batchIds = sel; audit("enroll.update", mobile); md.remove(); toast("✅ Enrollment update hua"); return loadAll(); }).then(function () { adminGo("students"); }).catch(function (e) { toast("Nahi hua: " + (e.code || e.message)); });
    };
  }
function vPay(m) {
    m.innerHTML = '<div class="bm-empty">Loading…</div>';
    authReady().then(function () { return DB().collection("institutes").doc(A.inst).collection("payments").orderBy("at", "desc").limit(300).get(); }).then(function (q) {
      var rows = q.docs.map(function (d) { return d.data(); }), tot = rows.reduce(function (t, x) { return t + (x.amount || 0); }, 0), qq = (A.f.q || "").toLowerCase();
      var show = rows.filter(function (x) { return !qq || (x.name + x.mobile + x.utr).toLowerCase().indexOf(qq) > -1; });
      m.innerHTML = '<div class="bm-stats" style="grid-template-columns:1fr 1fr"><div class="bm-stat"><small>Total Collected (last 300)</small><b>' + rupee(tot) + '</b></div><div class="bm-stat"><small>Payments</small><b>' + rows.length + '</b></div></div>' +
        '<div class="bm-tools"><input id="bm-q" placeholder="Name / mobile / UTR…" value="' + esc(A.f.q || "") + '"></div><div class="bm-tablewrap"><table class="bm-table"><tr><th>Date</th><th>Student</th><th>Batch</th><th>Amount</th><th>UTR</th></tr>' +
        (show.length ? show.map(function (x) { return '<tr><td>' + fdate(x.at) + '</td><td><b>' + esc(x.name) + '</b><br><small>' + esc(x.mobile) + '</small></td><td>' + esc(batchName(x.batchId)) + '</td><td><b>' + rupee(x.amount) + '</b></td><td>' + esc(x.utr) + '</td></tr>'; }).join("") : '<tr><td colspan="5"><div class="bm-empty">Abhi koi payment record nahi hai.</div></td></tr>') + '</table></div><div class="bm-note">Ye record tab banta hai jab aap request Approve karte hain.</div>';
      $("#bm-q").oninput = function () { var q2 = this.value.toLowerCase(); [].forEach.call(m.querySelectorAll(".bm-table tr"), function (tr, i) { if (i) tr.style.display = tr.textContent.toLowerCase().indexOf(q2) > -1 ? "" : "none"; }); };
    }).catch(function (e) { m.innerHTML = '<div class="bm-empty">Load nahi hua (' + esc(e.code || e.message) + '). Rules publish kiye?</div>'; });
  }
  function vPaySet(m) {
    m.innerHTML = '<div class="bm-empty">Loading…</div>';
    authReady().then(function () { return pref(A.inst).get(); }).then(function (d) {
      var v = d.exists ? d.data() : {};
      m.innerHTML = '<div class="bm-card"><h3>UPI Payment Setup</h3><div class="bm-form"><label>Payee / Institute ka naam</label><input id="ps_n" value="' + esc(v.payeeName || "") + '" placeholder="The Vishnu Sharma">' +
        '<label>UPI ID (optional)</label><input id="ps_u" value="' + esc(v.upiId || "") + '" placeholder="name@upi"><div class="bm-note">UPI ID dene par student ko "UPI app se pay karein" button milta hai (amount apne aap bhar jaata hai).</div>' +
        '<label>QR Scanner image (PhonePe / GPay / Paytm ka QR screenshot)</label><input id="ps_f" type="file" accept="image/*"><div id="ps_p" style="margin-top:10px">' + (v.qr ? '<img src="' + v.qr + '" style="max-width:220px;border-radius:12px;border:1px solid #e2e8f0">' : '<span class="bm-note">Abhi QR set nahi hai.</span>') + '</div>' +
        '<div class="acts"><button class="bm-btn" id="ps_s">Save</button></div></div><div class="bm-note">⚠️ Payment automatic verify nahi hoti. Student UTR/screenshot bhejta hai, aap apni UPI app me paisa dekhkar Approve karte hain.</div></div>';
      $("#ps_f").onchange = function () { var f = this.files[0]; if (!f) return; shrink(f, 640, 380000).then(function (u) { A.f.qr = u; $("#ps_p").innerHTML = '<img src="' + u + '" style="max-width:220px;border-radius:12px;border:1px solid #e2e8f0">'; }).catch(function (e) { toast("Image nahi lagi: " + e.message); }); };
      $("#ps_s").onclick = function () {
        var up = $("#ps_u").value.trim(), qr = A.f.qr || v.qr || "";
        if (up && !/^[\w.\-]{2,}@[A-Za-z]{2,}$/.test(up)) return toast("UPI ID sahi nahi lagti (jaise name@upi)");
        if (!up && !qr) return toast("QR image ya UPI ID dein");
        pref(A.inst).set({ payeeName: $("#ps_n").value.trim(), upiId: up, qr: qr, instituteId: A.inst, updatedAt: FV().serverTimestamp() }).then(function () { audit("payment.setup", ""); toast("✅ Payment setup save ho gaya"); }).catch(function (e) { toast("Save nahi hua: " + (e.code || e.message)); });
      };
    }).catch(function (e) { m.innerHTML = '<div class="bm-empty">Load nahi hua (' + esc(e.code || e.message) + ')</div>'; });
  }
  function vTests(m) {
    m.innerHTML = '<div class="bm-card"><h3>Tests & Assignments</h3><p style="font-size:.86rem;color:#475569">Tests aapke Tests section se hi chalte hain. Test banakar publish karein — students use Tests tab me dekhte hain.</p><button class="bm-btn" id="bm-gt">Existing Tests kholein</button><p class="bm-note">Batch-wise test assignment aur assignment submissions agle phase me.</p></div>';
    $("#bm-gt").onclick = function () { $("#bm-admin").remove(); typeof goAdmin === "function" && goAdmin("tests"); };
  }

  /* =================== STUDENT =================== */
  var S = { batches: [], items: {}, mine: [], cur: null, tab: "overview" };
  function sess() { try { return getStudentSession(); } catch (e) { return null; } }
  /* v199 SPEED: batch dabate hi phone me saved data se list TURANT dikhti hai (0 wait); fresh data peeche se aata hai
     aur screen sirf tab badalti hai jab kuch sach me badla ho. Saved data na ho (pehli baar) to pehle jaisa Loading. */
  var SNAP_K = function (m) { return "snap_bm_snap_" + String(m); };
  function sigOf() {
    try {
      return JSON.stringify([(S.batches || []).map(function (b) { var l = liveOf(b), n = nextOf(b); return [b.id, b.name, b.enrolledCount || 0, b.type, b.image ? b.image.length : 0, (S.items[b.id] || []).length, l ? l.id : 0, n ? n.id + ms(n.scheduledAt) : 0]; }),
        (S.avail || []).map(function (b) { return [b.id, b.name, b.enrolledCount || 0, b.fee || 0, b.enrollment || "", b.limit || 0]; })]);
    } catch (e) { return String(Date.now()); }
  }
  function reqSig() { try { return JSON.stringify((S.avail || []).map(function (b) { return [b.id, b.req || null]; })); } catch (e) { return ""; } }
  function persistSnap() {
    try {
      var s = sess(), D = window.SnapDiet; if (!s || !D || !D.cset || !S.inst) return;
      D.cset(SNAP_K(s.mobile), 0, { inst: S.inst, mine: S.mine || [], batches: S.batches || [], avail: S.avail || [], reqs: S.reqs || {} });
    } catch (e) {}
  }
  function applyReqCache() {
    S.reqs = S.reqs || {}; var all = true;
    (S.avail || []).forEach(function (b) { if (Object.prototype.hasOwnProperty.call(S.reqs, b.id)) b.req = S.reqs[b.id]; else all = false; });
    S.reqDone = all && (S.avail || []).length > 0 ? true : !(S.avail || []).length; S.reqFresh = false; S.reqBusy = false;
  }
  function hydrate(s) {
    try {
      var D = window.SnapDiet; if (!D || !D.cget) return false;
      var c = D.cget(SNAP_K(s.mobile), 7 * 864e5), z = c && c.items; if (!z || !z.inst || !Array.isArray(z.batches)) return false;
      S.inst = z.inst; S.mine = z.mine || []; S.batches = z.batches; S.avail = z.avail || []; S.reqs = z.reqs || {}; S.items = S.items || {};
      S.batches.forEach(function (b) { var it = D.cget("snap_diet_items_S_" + String(s.mobile) + "_" + b.id); if (it && it.items) S.items[b.id] = it.items; else if (!S.items[b.id]) S.items[b.id] = []; });
      try { window.SnapV169 && window.SnapV169.setMine(S.mine); } catch (e) {}
      applyReqCache(); return true;
    } catch (e) { return false; }
  }
  function openStudent() {
    var s = sess(); if (!s) return;
    var o = $("#bm-student"); if (!o) { o = document.createElement("div"); o.id = "bm-student"; document.body.appendChild(o); }
    o.classList.remove("bm-hidden"); setNav(true); S.cur = null; S.inHome = true;
    var forced = !!S.force, warm = hydrate(s), seq = S.seq = (S.seq || 0) + 1;
    if (warm) sHome(); else o.innerHTML = '<div class="bm-sh"><b>My Batches</b></div><div class="bm-empty">Loading…</div>';
    var before = warm ? sigOf() : "";
    loadMine().then(function () {
      if (seq !== S.seq) return;
      persistSnap();
      if (!warm || forced || sigOf() !== before) { if (S.inHome !== false) sHome(); }
    }).catch(function (e) {
      console.warn(e);
      if (!warm && seq === S.seq) o.innerHTML = '<div class="bm-sh"><b>My Batches</b></div><div class="bm-empty">Batches load nahi hue. Internet check karein.</div>';
    });
  }
  function closeStudent() { var o = $("#bm-student"); o && o.classList.add("bm-hidden"); setNav(false); }
  function setNav(on) { if (window.snSyncNav) { window.snSyncNav(); return; } var n = $("#sn-nav"); if (!n) return; n.querySelectorAll("button").forEach(function (b) { b.classList.toggle("on", on && b.dataset.k === "batch"); }); }
  function fetchAllBatches(ver) {
    var fq = function () { return bref(S.inst).where("published", "==", true).get(); };
    return window.SnapDiet ? window.SnapDiet.cached("snap_diet_avail_" + S.inst, "batches", fq, ver, false) : fq().then(function (q) { return q.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); }); });
  }
  function loadMine() {
    var s = sess(), db = DB(); if (!db) return Promise.reject();
    var force = !!S.force; S.force = false;
    return authReady().then(function () { return Promise.resolve(typeof ensureMyInstituteId === "function" ? ensureMyInstituteId() : s.instituteId); }).then(function (inst) {
      S.inst = inst; if (!inst) { S.batches = []; S.avail = []; return; }
      /* v199: student doc, version doc aur Available list ek SAATH (pehle ek ke baad ek) */
      var stuP = db.collection("students").doc(String(s.mobile)).get();
      var verP = (window.SnapDiet ? window.SnapDiet.ver(inst, force) : Promise.resolve(null)).then(function (v) { S.ver = v; return v; });
      var allP = verP.then(fetchAllBatches).catch(function () { return []; });
      return stuP.then(function (d) {
        var mine = S.mine = (d.exists && d.data().batchIds) || []; try { window.SnapV169 && window.SnapV169.setMine(S.mine); } catch (e) {}
        /* batch docs aur items ek saath; items ke liye batch docs ka intezaar nahi */
        var bP = Promise.all(mine.map(function (id) { return bref(inst, id).get().then(function (b) { return b.exists ? Object.assign({ id: b.id }, b.data()) : null; }).catch(function () { return null; }); }));
        var iP = verP.then(function (ver) {
          return Promise.all(mine.map(function (id) {
            var fq0 = function () { return bref(inst, id).collection("items").where("published", "==", true).get(); };
            /* v218: pehle catalog (1-5 reads); catalog na ho to purana tareeka (poore items). Version = items ya catalog me se jo naya ho. */
            var useCat = window.SnapCatalog && CFG.catalog !== false, fq = !useCat ? fq0 : function () {
              return window.SnapCatalog.load(inst, id).then(function (arr) { return arr ? { docs: arr.map(function (o) { return { id: o.id, data: function () { return o; } }; }) } : fq0(); });
            }, ver2 = ver && useCat ? (function () { var o = {}; o["s_" + id] = Math.max(ver["b_" + id] || 0, ver["c_" + id] || 0); return o; })() : ver;
            var p = window.SnapDiet ? window.SnapDiet.cached("snap_diet_items_S_" + String(s.mobile) + "_" + id, useCat ? "s_" + id : "b_" + id, fq, ver2, force) : fq().then(function (q) { return q.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); }); });
            return p.then(function (arr) { S.items[id] = arr; }).catch(function () { S.items[id] = []; });
          }));
        });
        return Promise.all([bP, iP, allP]).then(function (r) {
          S.batches = r[0].filter(function (b) { return b && b.published; });
          S.avail = (r[2] || []).filter(function (b) { return mine.indexOf(b.id) < 0; });
          applyReqCache();
        });
      });
    });
  }
  function loadPay() { return pref(S.inst).get().then(function (d) { S.pay = d.exists ? d.data() : null; }).catch(function () { S.pay = null; }); }
  
  /* v170: request-status aur payment doc tabhi padhe jaate hain jab student "Available" tab kholta hai */
  function loadReqs() { var s = sess(); S.reqs = S.reqs || {}; return Promise.all([loadPay()].concat((S.avail || []).map(function (b) { return bref(S.inst, b.id).collection("requests").doc(String(s.mobile)).get().then(function (r) { b.req = r.exists ? r.data().status : null; S.reqs[b.id] = b.req; }).catch(function () {}); }))); }
  function payForm(b) {
    var p = S.pay || {}, s = sess(); if (!p.qr && !p.upiId) return toast("Institute ne abhi payment setup nahi kiya — admin se sampark karein");
    var md = document.createElement("div"); md.className = "bm-modal"; var up = p.upiId ? "upi://pay?pa=" + encodeURIComponent(p.upiId) + "&pn=" + encodeURIComponent(p.payeeName || "Institute") + "&am=" + b.fee + "&cu=INR&tn=" + encodeURIComponent((b.name || "Batch").slice(0, 40)) : "";
    md.innerHTML = '<div class="bm-sheet"><h3>' + esc(b.name) + '</h3><div style="text-align:center;font-size:1.5rem;font-weight:800;color:#1d4ed8">' + rupee(b.fee) + '</div>' +
      (p.qr ? '<div style="text-align:center;margin:10px 0"><img src="' + p.qr + '" style="max-width:240px;width:100%;border-radius:12px;border:1px solid #e2e8f0"><div class="bm-note">Is QR ko apni UPI app (PhonePe/GPay/Paytm) se scan karke ' + rupee(b.fee) + ' pay karein</div></div>' : "") +
      (p.upiId ? '<div style="text-align:center;font-size:.85rem">UPI ID: <b>' + esc(p.upiId) + '</b>' + (p.payeeName ? " (" + esc(p.payeeName) + ")" : "") + '<br><a class="bm-btn sm" style="display:inline-block;margin-top:8px;text-decoration:none" href="' + up + '">UPI app se pay karein</a></div>' : "") +
      '<div class="bm-form"><label>Payment ke baad UTR / Transaction ID *</label><input id="pf_u" placeholder="12 digit UTR" autocomplete="off"><label>Payment screenshot (optional)</label><input id="pf_f" type="file" accept="image/*"><div class="bm-note">Admin aapka payment check karke approve karega, tab batch khulega.</div><div class="acts"><button class="bm-btn sec" data-c>Cancel</button><button class="bm-btn" data-s>Submit</button></div></div></div>';
    document.body.appendChild(md);
    md.querySelector("[data-c]").onclick = function () { md.remove(); };
    md.querySelector("[data-s]").onclick = function () {
      var u = md.querySelector("#pf_u").value.trim(), f = md.querySelector("#pf_f").files[0], btn = md.querySelector("[data-s]");
      if (!/^[A-Za-z0-9]{6,30}$/.test(u)) return toast("UTR sahi daalein (6-30 letters/numbers)");
      btn.disabled = true;
      (f ? shrink(f, 900, 330000) : Promise.resolve("")).then(function (shot) {
        var d = { mobile: String(s.mobile), name: s.name || "", status: "pending", createdAt: FV().serverTimestamp(), amount: b.fee, utr: u }; if (shot) d.shot = shot;
        return bref(S.inst, b.id).collection("requests").doc(String(s.mobile)).set(d);
      }).then(function () { b.req = "pending"; md.remove(); toast("✅ Payment details bhej di — admin verify karega"); sHome(); }).catch(function (e) { btn.disabled = false; toast("Nahi gaya: " + (e.code || e.message)); });
    };
  }
  
  function reqEnroll(id) {
    var b0 = S.avail.filter(function (x) { return x.id === id; })[0]; if (b0 && b0.fee > 0) return payForm(b0);
    var s = sess(); bref(S.inst, id).collection("requests").doc(String(s.mobile)).set({ mobile: String(s.mobile), name: s.name || "", status: "pending", createdAt: FV().serverTimestamp() })
      .then(function () { var b = S.avail.filter(function (x) { return x.id === id; })[0]; b && (b.req = "pending"); toast("✅ Request bhej di — admin approve karega"); sHome(); }).catch(function (e) { toast("Request nahi gayi: " + (e.code || e.message)); });
  }
  function liveOf(b) { return (S.items[b.id] || []).filter(function (i) { return i.kind === "class" && i.status === "live" && (i.liveRoom || i.liveUrl || i.ytId || i._lv); })[0]; }
  function nextOf(b) { var n = Date.now() - 36e5; return (S.items[b.id] || []).filter(function (i) { return i.kind === "class" && i.status === "upcoming" && ms(i.scheduledAt) >= n; }).sort(function (a, c) { return ms(a.scheduledAt) - ms(c.scheduledAt); })[0]; }
  function sHome() {
    var o = $("#bm-student"), live = S.batches.map(liveOf).filter(Boolean), h = S.h || "my", av = S.avail || [], body;
      S.inHome = true;
      if (h === "avail" && !S.reqFresh && !S.reqBusy) { S.reqBusy = true; var was = S.reqDone ? reqSig() : "", fin = function () { S.reqBusy = false; S.reqFresh = true; var first = !S.reqDone; S.reqDone = true; persistSnap(); if (S.inHome !== false && (first || reqSig() !== was)) sHome(); }; loadReqs().then(fin, fin); }
    if (h === "my") body = S.batches.length ? S.batches.map(function (b) { var l = liveOf(b), n = nextOf(b); return '<div class="bm-bcard" data-b="' + b.id + '">' + (b.image ? '<img class="bx-bimg" loading="lazy" decoding="async" src="' + esc(b.image) + '" alt="">' : "") + '<span class="bm-tag"' + (l ? ' style="background:#ef4444"' : "") + '>' + (l ? "Live Now" : { live: "Live Batch", recorded: "Recorded", hybrid: "Hybrid" }[b.type] || "Batch") + '</span><b>' + esc(b.name) + '</b><small>' + esc(subjOf(b).join(" • ")) + '</small><div class="bm-meta"><span>👥 ' + (b.enrolledCount || 0) + (b.limit ? "/" + b.limit : "") + '</span><span>' + (n ? "⏰ " + fdate(n.scheduledAt) : "Koi upcoming class nahi") + '</span></div></div>'; }).join("") :
      '<div class="bm-empty">Abhi aap kisi batch me enrolled nahi hain.<br>"Available" tab se enroll request bhejein.</div>';
    else body = av.length ? av.map(function (b) {
      var full = b.limit && (b.enrolledCount || 0) >= b.limit, act = !S.reqDone ? '<span class="bm-badge">⏳ Check ho raha hai…</span>' : b.req === "pending" ? '<span class="bm-badge o">⏳ Request pending — admin approve karega</span>' : b.req === "rejected" ? '<span class="bm-badge r">Request reject hui — admin se baat karein</span>' : b.enrollment === "closed" ? '<span class="bm-badge">Enrollment band hai</span>' : full ? '<span class="bm-badge r">Batch full</span>' : '<button class="bm-btn sm" data-rq="' + b.id + '">' + (b.fee ? "Enroll & Pay " + rupee(b.fee) : "Enroll Request bhejein") + '</button>';
      return '<div class="bm-bcard" style="cursor:default"><span class="bm-tag" style="background:#6366f1">' + ({ live: "Live Batch", recorded: "Recorded", hybrid: "Hybrid" }[b.type] || "Batch") + '</span><b>' + esc(b.name) + '</b><small>' + esc(subjOf(b).join(" • ")) + '</small><div class="bm-meta"><span>👥 ' + (b.enrolledCount || 0) + (b.limit ? "/" + b.limit : "") + '</span><span>📅 ' + esc(b.startDate || "") + '</span><span>' + (b.fee ? "💰 " + rupee(b.fee) : "Free") + '</span></div><div style="margin-top:10px">' + act + '</div></div>'; }).join("") : '<div class="bm-empty">Abhi koi naya batch available nahi hai.</div>';
    o.innerHTML = '<div class="bm-sh"><b>Batch</b><button data-rf title="Refresh">🔄</button><button data-x>✕</button></div>' +
      (live.length ? '<div class="bm-next"><div>🔴 <b>Live Now:</b> ' + esc(live[0].title) + '</div><button data-j>Join Now</button></div>' : "") +
      '<div class="bm-tabs"><button data-h="my"' + (h === "my" ? ' class="on"' : "") + '>My Batches (' + S.batches.length + ')</button><button data-h="avail"' + (h === "avail" ? ' class="on"' : "") + '>Available (' + av.length + ')</button></div>' + body;
    o.querySelector("[data-x]").onclick = function () { closeStudent(); var hm = $('#sn-nav [data-k="home"]'); hm && hm.click(); };
    o.querySelector("[data-rf]").onclick = function () { S.force = true; openStudent(); };
    o.querySelectorAll("[data-h]").forEach(function (t) { t.onclick = function () { S.h = t.dataset.h; sHome(); }; });
    o.querySelectorAll("[data-b]").forEach(function (c) { c.onclick = function () { S.tab = EXT.studentTabs.subjects ? "subjects" : "overview"; sBatch(c.dataset.b); }; });
    o.querySelectorAll("[data-rq]").forEach(function (c) { c.onclick = function () { c.disabled = true; reqEnroll(c.dataset.rq); }; });
    var j = o.querySelector("[data-j]"); j && (j.onclick = function () { sJoin(live[0]); });
  }
    var TABS0 = [["overview", "Overview"], ["class", "Live Classes"], ["recording", "Recorded"], ["note", "Notes"], ["material", "Study Material"], ["ppt", "PPT"], ["tests", "Tests"], ["announcement", "Announcements"]];
  function tabsAll() { var x = Object.keys(EXT.studentTabs).map(function (k) { return [k, EXT.studentTabs[k].label]; }); return [TABS0[0]].concat(x, TABS0.slice(1)); }
  function sJoin(it) { fire("join", it, S.cur); joinLive(it); }
  function sBatch(id) {
    var b = S.batches.filter(function (x) { return x.id === id; })[0], o = $("#bm-student"); if (!b) return sHome(); if (S.cur !== id || S.inHome) o.scrollTop = 0; S.cur = id; S.inHome = false;
    var its = S.items[id] || [], l = liveOf(b), n = nextOf(b);
    var body = "", tab = S.tab, xt = EXT.studentTabs[tab];
    if (tab === "overview") body = '<div class="bm-bhero"><b>' + esc(b.name) + '</b><p>' + esc(b.desc || subjOf(b).join(" • ")) + '</p></div>' + (l ? '<div class="bm-next"><div>🔴 Live: ' + esc(l.title) + '</div><button data-j>Join Now</button></div>' : n ? '<div class="bm-next"><div>Next Live Class<br><b>' + fdate(n.scheduledAt) + '</b></div></div>' : "") +
      '<div class="bm-qa">' + [["class", "🔴", "Live"], ["recording", "🎬", "Recorded"], ["note", "📄", "Notes"], ["ppt", "📊", "PPT"]].map(function (q) { return '<button data-t="' + q[0] + '"><span>' + q[1] + '</span>' + q[2] + ' (' + its.filter(function (i) { return i.kind === q[0]; }).length + ')</button>'; }).join("") + '</div>' +
      (b.teachers && b.teachers.length ? '<div class="bm-list" style="margin-top:12px"><b style="font-size:.9rem">Batch Teachers</b><div style="margin-top:6px">' + b.teachers.map(function (t) { return '<span class="bm-badge b" style="margin:0 6px 6px 0;font-size:.78rem">👨‍🏫 ' + esc(t) + '</span>'; }).join("") + '</div></div>' : "");
    else if (xt) body = '<div id="bm-xtab"><div class="bm-empty">Loading…</div></div>';
    else if (tab === "tests") body = '<div class="bm-list"><div class="bm-item"><div class="ic">📝</div><div class="g"><b>Tests</b><small>Aapke tests app ke Tests section me hain</small></div><button class="go" data-tests>Open</button></div></div>';
    else {
      var list = its.filter(function (i) { return tab === "note" ? i.kind === "note" : i.kind === tab; }).sort(function (a, c) { return (ms(c.scheduledAt) || ms(c.createdAt)) - (ms(a.scheduledAt) || ms(a.createdAt)); });
      body = '<div class="bm-list">' + (list.length ? list.map(function (i) { var ic = { class: "🔴", recording: "🎬", note: "📄", material: "📚", ppt: "📊", announcement: "📢" }[i.kind];
        return '<div class="bm-item"><div class="ic">' + ic + '</div><div class="g"><b>' + esc(i.title) + '</b><small>' + esc([i.subject, i.chapter].filter(Boolean).join(" • ") || (i.cat || "")) + (i.kind === "class" ? " • " + fdate(i.scheduledAt) : "") + '</small>' + (i.kind === "announcement" ? '<small style="display:block;margin-top:4px;color:#334155">' + esc(i.desc) + '</small>' : "") + '</div>' +
          (i.kind === "class" ? (i.status === "live" && (i.liveRoom || i.liveUrl || i.ytId || i._lv) ? '<button class="go" style="background:#ef4444" data-live="' + i.id + '">Join</button>' : '<span class="bm-badge ' + (i.status === "completed" ? "" : "b") + '">' + (i.status === "completed" ? "Done" : i.status === "cancelled" ? "Cancelled" : "Upcoming") + '</span>') : hasFile(i) ? '<button class="go" data-v="' + i.id + '">' + (i.kind === "recording" ? "▶ Play" : "View") + '</button>' : "") + '</div>'; }).join("") : '<div class="bm-empty">Yahan abhi kuch publish nahi hua.</div>') + '</div>';
    }
    o.innerHTML = '<div class="bm-sh"><button data-back>←</button><b>' + esc(b.name) + '</b></div><div class="bm-tabs">' + tabsAll().map(function (t) { return '<button data-tab="' + t[0] + '"' + (t[0] === tab ? ' class="on"' : "") + '>' + t[1] + '</button>'; }).join("") + '</div>' + body;
    o.querySelector("[data-back]").onclick = sHome;
    o.querySelectorAll("[data-tab]").forEach(function (t) { t.onclick = function () { S.tab = t.dataset.tab; sBatch(id); }; });
    o.querySelectorAll("[data-t]").forEach(function (t) { t.onclick = function () { S.tab = t.dataset.t; sBatch(id); }; });
    var j = o.querySelector("[data-j]"); j && (j.onclick = function () { sJoin(l); });
    o.querySelectorAll("[data-live]").forEach(function (x) { x.onclick = function () { sJoin(its.filter(function (i) { return i.id === x.dataset.live; })[0]); }; });
    o.querySelectorAll("[data-v]").forEach(function (x) { x.onclick = function () { var i = its.filter(function (k) { return k.id === x.dataset.v; })[0]; fire("open", i, S.cur); openItem(i, S.inst); }; });
    if (xt) { try { xt.render(b, $("#bm-xtab"), ctx()); } catch (e) { console.warn(e); $("#bm-xtab").innerHTML = '<div class="bm-empty">Load nahi hua</div>'; } }
    var tb = o.querySelector("[data-tests]"); tb && (tb.onclick = function () { closeStudent(); typeof goStudentSection === "function" && goStudentSection("student-form-fields-anchor"); });
  }

  /* =================== hooks into existing app =================== */
  function hook() {
    var nav = $("#sn-nav");
    if (nav && !nav.querySelector('[data-k="batch"]')) {
      var b = document.createElement("button"); b.type = "button"; b.dataset.k = "batch";
      b.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>Batch';
      nav.insertBefore(b, nav.children[1] || null);
      b.addEventListener("click", function (e) { e.stopPropagation(); openStudent(); });
      nav.addEventListener("click", function (e) { var t = e.target.closest("button"); if (t && t.dataset.k !== "batch") closeStudent(); }, true);
    }
    var sg = $("#student-dashboard-home .cd-grid");
    if (sg && !sg.querySelector("[data-bm]")) { var c = document.createElement("button"); c.type = "button"; c.className = "cd-card cd-purple"; c.dataset.bm = "1"; c.innerHTML = '<div class="cd-card-top"><div class="cd-icon-circle">🎓</div><span class="cd-badge">New</span></div><div class="cd-card-title">My Batches</div><div class="cd-card-sub">Live, recordings, notes</div><div class="cd-card-bottom"><span class="cd-arrow-btn">→</span></div>'; c.onclick = function (e) { e.preventDefault(); openStudent(); }; sg.appendChild(c); }
    var ag = $("#admin-grid-students") || $("#admin-dashboard-home .cd-grid");
    if (ag && !ag.querySelector("[data-bm]")) { var d = document.createElement("button"); d.type = "button"; d.className = "cd-card cd-purple"; d.dataset.bm = "1"; d.innerHTML = '<div class="cd-card-top"><div class="cd-icon-circle">🎓</div><span class="cd-badge">New</span></div><div class="cd-card-title">Batch Management</div><div class="cd-card-sub">Batches, live classes, recordings, notes</div><div class="cd-card-bottom"><span class="cd-arrow-btn">→</span></div>'; d.onclick = openAdmin; ag.appendChild(d); }
  }
  setInterval(function () { if (!document.hidden) hook(); }, 2500);
  /* v199: app khulne ke baad (idle me) batches pehle se load — taaki Batch dabate hi sab ready mile.
     Sirf unke liye jinhone Batch pehle kabhi khola hai (saved data hai), aur 10 min me ek hi baar. */
  var PF = { t: 0, busy: false };
  function prefetch() {
    try {
      var s = sess(); if (!s || PF.busy || !DB()) return;
      if (Date.now() - PF.t < 600000) return;
      var D = window.SnapDiet; if (!D || !D.cget || !D.cget(SNAP_K(s.mobile), 7 * 864e5)) return;
      var o = $("#bm-student"); if (o && !o.classList.contains("bm-hidden")) return;
      PF.busy = true; PF.t = Date.now();
      loadMine().then(function () {
        persistSnap();
        var jobs = [];
        if ((S.avail || []).length <= 6) jobs.push(loadReqs().then(function () { S.reqFresh = true; S.reqDone = true; persistSnap(); }).catch(function () {}));
        try { var pb = EXT.prefetchBatch; if (pb) (S.batches || []).slice(0, 3).forEach(function (b) { jobs.push(Promise.resolve(pb(b, ctx())).catch(function () {})); }); } catch (e) {}
        return Promise.all(jobs);
      }).catch(function () {}).then(function () { PF.busy = false; });
    } catch (e) { PF.busy = false; }
  }
  function schedPrefetch() { if (PF.sched || !window.requestAnimationFrame) return; PF.sched = true; setTimeout(function () { PF.sched = false; var f = function () { prefetch(); }; window.requestIdleCallback ? requestIdleCallback(f, { timeout: 4000 }) : f(); }, 3500); }
  setInterval(function () { try { if (!document.hidden && $("#sn-nav") && sess()) schedPrefetch(); } catch (e) {} }, 15000);
  window.SnapBatch = { openAdmin: openAdmin, openStudent: openStudent, ext: EXT, ctx: ctx, prefetch: prefetch };
})();
