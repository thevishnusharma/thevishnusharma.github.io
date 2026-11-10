/* DEPRECATED (v216): SnapFiles (Cloudflare R2/KV) band hai (SNAP_CONFIG.ownFiles=false). Code abhi rakha hai; file upload ab Google Drive (SnapDrive). Aage hatega. */
/* SnapFiles (v169) — apna file storage. Notes / PPT / recording / assignment ki file device se seedhe Cloudflare R2 me (Worker ke through),
   Firebase Storage / Firestore ki limit ki zaroorat nahi. Firestore me sirf chhota pointer { key, name, type, size } save hota hai.
   - File <= 8 MB: ek request. Badi file: 8 MB ke tukde (multipart), har tukda 4 baar tak retry -> file size ki practical limit nahi.
   - Worker / R2 set na ho ya fail ho to caller (batch-system.js) apne aap purane Firebase tareeke par chala jaata hai.
   - Kill-switch: SNAP_CONFIG.ownFiles = false. Worker URL: SNAP_CONFIG.workerUrl. */
(function () {
  "use strict";
  if (window.SnapFiles) return;
  var PART = 8 * 1024 * 1024, off = false;

  function WK() { var c = window.SNAP_CONFIG || {}; return String(c.workerUrl || "https://cool-thunder-a280.vishnu1234stm.workers.dev").replace(/\/+$/, ""); }
  function user() {
    try { var v = window.vishnuFirebase; if (v && v.auth && v.auth.currentUser) return v.auth.currentUser; } catch (e) {}
    try { return window.firebase && firebase.auth && firebase.auth().currentUser; } catch (e) { return null; }
  }
  function token() { var u = user(); return u && u.getIdToken ? u.getIdToken() : Promise.reject(new Error("Admin email login chahiye")); }
  function enc(s) { return encodeURIComponent(String(s)); }
  function ready() { return !off && !(window.SNAP_CONFIG && window.SNAP_CONFIG.ownFiles === false) && navigator.onLine !== false && !!user(); }
  function noteFail(e) { if (e && (e.status === 501 || e.status === 404)) off = true; }   // Worker/R2 set nahi => is session me dobara try nahi

  var TYPES = { pdf: "application/pdf", ppt: "application/vnd.ms-powerpoint", pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation", doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", xls: "application/vnd.ms-excel", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp", mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime", mp3: "audio/mpeg", m4a: "audio/mp4", txt: "text/plain", csv: "text/csv", zip: "application/zip" };
  function typeOf(f) { if (f.type) return f.type; var m = /\.([a-z0-9]+)$/i.exec(f.name || ""); return (m && TYPES[m[1].toLowerCase()]) || "application/octet-stream"; }

  function xhr(method, url, headers, body, onProg) {
    return new Promise(function (res, rej) {
      var x = new XMLHttpRequest(); x.open(method, url, true);
      Object.keys(headers || {}).forEach(function (k) { x.setRequestHeader(k, headers[k]); });
      if (x.upload) x.upload.onprogress = function (e) { if (e.lengthComputable && onProg) onProg(e.loaded); };
      x.timeout = 10 * 60 * 1000;
      x.onload = function () {
        var j = {}; try { j = JSON.parse(x.responseText || "{}"); } catch (e) {}
        if (x.status >= 200 && x.status < 300 && j.ok !== false) return res(j);
        var er = new Error(j.error || ("HTTP " + x.status)); er.status = x.status; rej(er);
      };
      x.onerror = function () { var er = new Error("Network error"); er.net = true; rej(er); };
      x.ontimeout = function () { var er = new Error("Timeout"); er.net = true; rej(er); };
      x.send(body == null ? null : body);
    });
  }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function retry(fn, tries) {
    var n = 0;
    function go() { return fn().catch(function (e) { n++; if (n >= tries || !(e.net || e.status >= 500)) throw e; return wait(1000 * Math.pow(2, n - 1)).then(go); }); }
    return go();
  }
  function call(method, path, body, onProg, raw) {
    return token().then(function (t) {
      var h = { Authorization: "Bearer " + t };
      if (!raw) h["Content-Type"] = "application/json";
      return xhr(method, WK() + path, h, raw ? body : (body ? JSON.stringify(body) : null), onProg);
    });
  }

  /* phone ki bhari JPEG photo ko halka chhota (quality bachi rehti hai) — PDF / PNG / baaki files jyon ki tyon */
  function maybeShrink(file) {
    if (file.type !== "image/jpeg" || file.size < 3 * 1024 * 1024 || typeof createImageBitmap !== "function") return Promise.resolve(file);
    return createImageBitmap(file).then(function (bm) {
      var s = Math.min(1, 2600 / Math.max(bm.width, bm.height)), c = document.createElement("canvas");
      c.width = Math.round(bm.width * s); c.height = Math.round(bm.height * s); c.getContext("2d").drawImage(bm, 0, 0, c.width, c.height);
      return new Promise(function (r) { c.toBlob(function (b) { r(b && b.size < file.size * 0.9 ? new File([b], file.name, { type: "image/jpeg" }) : file); }, "image/jpeg", 0.88); });
    }).catch(function () { return file; });
  }

  /* file -> { key, name, type, size }.  prog(percent) */
  function upload(file, o, prog) {
    var name = file.name || "file", type = typeOf(file);
    return maybeShrink(file).then(function (f) {
      var size = f.size, done = 0;
      var report = function (cur) { prog && prog(Math.min(99, Math.round(100 * (done + (cur || 0)) / Math.max(1, size)))); };
      if (!size) return Promise.reject(new Error("File khaali hai"));
      if (size <= PART) {
        return retry(function () { return call("PUT", "/files/put?name=" + enc(name) + "&type=" + enc(type), f, report, true); }, 4)
          .then(function (j) { prog && prog(100); return { key: j.key, name: name, type: type, size: size, used: j.used }; });
      }
      var key, uid, parts = [], total = Math.ceil(size / PART);
      return call("POST", "/files/start", { name: name, type: type, size: size }).then(function (j) {
        key = j.key; uid = j.uploadId;
        var p = Promise.resolve();
        for (var i = 0; i < total; i++) (function (i) {
          p = p.then(function () {
            var blob = f.slice(i * PART, Math.min(size, (i + 1) * PART));
            return retry(function () { return call("PUT", "/files/part?key=" + enc(key) + "&uid=" + enc(uid) + "&n=" + (i + 1), blob, report, true); }, 4)
              .then(function (r) { parts.push({ partNumber: r.partNumber, etag: r.etag }); done += blob.size; report(0); });
          });
        })(i);
        return p;
      }).then(function () {
        return retry(function () { return call("POST", "/files/done", { key: key, uploadId: uid, parts: parts, name: name, type: type, size: size }); }, 3);
      }).then(function (j) { prog && prog(100); return { key: key, name: name, type: type, size: size, used: j && j.used }; })
        .catch(function (e) { if (key && uid) call("POST", "/files/abort", { key: key, uploadId: uid, count: parts.length + 1 }).catch(function () {}); throw e; });
    });
  }

  function urlOf(of) { return WK() + "/files/f/" + String(of.key).split("/").map(enc).join("/"); }
  function remove(key) { if (!key || !user()) return Promise.resolve(false); return call("POST", "/files/del", { key: key }).then(function () { return true; }, function () { return false; }); }

  function usage() { return call("GET", "/files/usage").then(function (j) { return j; }, function () { return null; }); }
  window.SnapFiles = { ready: ready, upload: upload, urlOf: urlOf, remove: remove, noteFail: noteFail, usage: usage };
})();
