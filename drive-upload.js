/* SnapDrive (v173) — card-free file storage: file device se seedhe ADMIN ke apne Google Drive me upload,
   upload hote hi "anyone with link" ban jaata hai aur link apne aap mil jaata hai (hath se link banana nahi padta).
   - Storage institute ke apne Google account (15 GB free) me gina jaata hai — aapka storage / bandwidth kharcha zero.
   - Drive me folder banta hai:  The Vishnu Sharma / <instituteId>  (sirf wahi files jo app ne banayi, scope = drive.file).
   - Setup: SNAP_CONFIG.googleClientId (app-config.js) me Google OAuth Web Client ID daalni hai (DRIVE_SETUP_HINDI.md dekhein).
   - Kill-switch: SNAP_CONFIG.driveUpload = false.  Client ID khaali ho to ready() = false aur app purane tareeke par chalta hai. */
(function () {
  "use strict";
  if (window.SnapDrive) return;
  var SCOPE = "https://www.googleapis.com/auth/drive.file", GSI = "https://accounts.google.com/gsi/client";
  var PART = 8 * 1024 * 1024;                       /* 256 KB ka multiple (Drive ki shart) */
  var tok = null, tokExp = 0, tc = null, gsiP = null, folders = {}, tokEmail = "";   /* tokEmail: is token ka Google account (ek baar fetch, token ke saath cache) */

  function C() { return window.SNAP_CONFIG || {}; }
  function ready() { var c = C(); return c.driveUpload !== false && !!c.googleClientId && navigator.onLine !== false; }
  function enc(s) { return encodeURIComponent(String(s)); }

  function loadGsi() {
    if (window.google && google.accounts && google.accounts.oauth2) return Promise.resolve();
    if (gsiP) return gsiP;
    gsiP = new Promise(function (res, rej) {
      var s = document.createElement("script"); s.src = GSI; s.async = true;
      s.onload = function () { res(); }; s.onerror = function () { gsiP = null; rej(new Error("Google login script load nahi hui (internet check karein)")); };
      document.head.appendChild(s);
    });
    return gsiP;
  }

  /* access token (1 ghante chalta hai). Pehli baar Google ka "Allow" popup aata hai, uske baad chup-chaap refresh. */
  function getToken(force, hint) {
    if (!force && tok && Date.now() < tokExp - 60000) return Promise.resolve(tok);
    return loadGsi().then(function () {
      return new Promise(function (res, rej) {
        if (!tc) tc = google.accounts.oauth2.initTokenClient({ client_id: C().googleClientId, scope: SCOPE, callback: function () {} });
        tc.callback = function (r) {
          if (r && r.access_token) { tok = r.access_token; tokExp = Date.now() + (+r.expires_in || 3600) * 1000; tokEmail = ""; res(tok); }
          else rej(new Error((r && (r.error_description || r.error)) || "Google Drive ki permission nahi mili"));
        };
        tc.error_callback = function (e) { rej(new Error(e && e.type === "popup_closed" ? "Google popup band ho gaya — dobara try karein" : "Google Drive permission fail")); };
        try { tc.requestAccessToken(hint ? { prompt: "select_account", hint: hint } : { prompt: tok ? "" : "consent" }); } catch (e) { rej(e); }
      });
    });
  }

  function api(method, url, body, extra) {
    return getToken().then(function (t) {
      var h = Object.assign({ Authorization: "Bearer " + t }, extra || {});
      if (body && typeof body === "object" && !(body instanceof Blob)) { h["Content-Type"] = "application/json"; body = JSON.stringify(body); }
      return fetch(url, { method: method, headers: h, body: body }).then(function (r) {
        if (r.status === 401) { tok = null; throw Object.assign(new Error("Google session khatam — dobara try karein"), { status: 401 }); }
        if (!r.ok) return r.text().then(function (x) { var m = ""; try { m = JSON.parse(x).error.message; } catch (e) {} throw Object.assign(new Error(m || ("Drive error " + r.status)), { status: r.status }); });
        return r.status === 204 ? {} : r.json();
      });
    });
  }

  /* SnapTest Pro/<inst> folder dhoondo, na mile to banao */
  function folder(name, parent) {
    var key = (parent || "root") + "/" + name; if (folders[key]) return Promise.resolve(folders[key]);
    var q = "name='" + name.replace(/'/g, "\\'") + "' and mimeType='application/vnd.google-apps.folder' and trashed=false and '" + (parent || "root") + "' in parents";
    return api("GET", "https://www.googleapis.com/drive/v3/files?fields=files(id)&q=" + enc(q)).then(function (j) {
      if (j.files && j.files.length) return j.files[0].id;
      return api("POST", "https://www.googleapis.com/drive/v3/files?fields=id", { name: name, mimeType: "application/vnd.google-apps.folder", parents: parent ? [parent] : undefined }).then(function (f) { return f.id; });
    }).then(function (id) { return (folders[key] = id); });
  }

  /* Root folder: naya naam "The Vishnu Sharma"; purana "SnapTest Pro" folder ho to wahi use hota hai (purani files gayab na hon) */
  function findFolder(name) {
    var q = "name='" + name + "' and mimeType='application/vnd.google-apps.folder' and trashed=false and 'root' in parents";
    return api("GET", "https://www.googleapis.com/drive/v3/files?fields=files(id)&q=" + enc(q)).then(function (j) { return j.files && j.files.length ? j.files[0].id : null; });
  }
  function rootFolder() {
    if (folders["__root"]) return Promise.resolve(folders["__root"]);
    return findFolder("The Vishnu Sharma").then(function (id) { return id || findFolder("SnapTest Pro"); })
      .then(function (id) { return id || folder("The Vishnu Sharma"); }).then(function (id) { return (folders["__root"] = id); });
  }

  function put(url, blob, headers, onProg) {
    return new Promise(function (res, rej) {
      var x = new XMLHttpRequest(); x.open("PUT", url, true);
      Object.keys(headers).forEach(function (k) { x.setRequestHeader(k, headers[k]); });
      if (x.upload) x.upload.onprogress = function (e) { if (e.lengthComputable && onProg) onProg(e.loaded); };
      x.timeout = 10 * 60 * 1000;
      x.onload = function () { res(x); };
      x.onerror = function () { rej(Object.assign(new Error("Network error"), { net: true })); };
      x.ontimeout = function () { rej(Object.assign(new Error("Timeout"), { net: true })); };
      x.send(blob);
    });
  }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function retry(fn, n) { var i = 0; return (function go() { return fn().catch(function (e) { i++; if (i >= n || !e.net) throw e; return wait(1000 * i).then(go); }); })(); }

  /* file -> { id, url, name, type, size }   prog(percent) */
  function upload(file, o, prog) {
    o = o || {}; var name = file.name || "file", type = file.type || "application/octet-stream", size = file.size, fid;
    if (!size) return Promise.reject(new Error("File khaali hai"));
    return acctGuard(o.inst).then(function () { return rootFolder(); }).then(function (root) { return folder(String(o.inst || "general"), root); }).then(function (parent) {
      return getToken().then(function (t) {
        return fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id", {
          method: "POST",
          headers: { Authorization: "Bearer " + t, "Content-Type": "application/json; charset=UTF-8", "X-Upload-Content-Type": type, "X-Upload-Content-Length": String(size) },
          body: JSON.stringify({ name: name, parents: [parent], mimeType: type })
        });
      });
    }).then(function (r) {
      if (!r.ok) throw new Error("Drive upload shuru nahi hua (" + r.status + ")");
      var loc = r.headers.get("Location"); if (!loc) throw new Error("Drive ne upload link nahi diya");
      var off = 0;
      function next() {
        var end = Math.min(size, off + PART), blob = file.slice(off, end), base = off;
        return retry(function () {
          return put(loc, blob, { "Content-Range": "bytes " + base + "-" + (end - 1) + "/" + size }, function (l) { prog && prog(Math.min(99, Math.round(100 * (base + l) / size))); });
        }, 4).then(function (x) {
          if (x.status === 200 || x.status === 201) { try { return JSON.parse(x.responseText).id; } catch (e) { throw new Error("Drive ka jawab samajh nahi aaya"); } }
          if (x.status === 308) { off = end; return next(); }
          throw new Error("Drive upload fail (" + x.status + ")");
        });
      }
      return next();
    }).then(function (id) {
      fid = id;
      /* link banao: anyone with link = reader (student ko Google login nahi chahiye) */
      return api("POST", "https://www.googleapis.com/drive/v3/files/" + id + "/permissions?fields=id", { role: "reader", type: "anyone" });
    }).then(function () {
      prog && prog(100);
      return { id: fid, url: "https://drive.google.com/file/d/" + fid + "/view?usp=sharing", name: name, type: type, size: size };
    });
  }

  function remove(id) { if (!id || !ready()) return Promise.resolve(false); return api("DELETE", "https://www.googleapis.com/drive/v3/files/" + id).then(function () { return true; }, function () { return false; }); }

  /* ===== v219 Phase 3A: Drive STATUS (sirf driveConnected + driveEmail Firestore me; TOKEN kabhi save nahi hota) ===== */
  var st = {};                                       /* inst -> { connected, email } (memory cache) */
  var MAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
  function idb() { var v = window.vishnuFirebase; return v && v.enabled !== false && v.db; }
  function status(inst, force) {
    if (!inst) return Promise.resolve({ connected: false, email: "" });
    if (!force && st[inst]) return Promise.resolve(st[inst]);
    var db = idb(); if (!db) return Promise.resolve({ connected: false, email: "", unknown: true });
    return db.collection("institutes").doc(inst).get().then(function (d) {
      var x = d && d.exists ? d.data() : {}; return (st[inst] = { connected: x.driveConnected === true, email: String(x.driveEmail || ""), verifiedEmail: String(x.driveVerifiedEmail || "").toLowerCase(), files: +x.storageFiles || 0, usedMB: Math.round((+x.storageUsedBytes || 0) / 1048576) });
    }, function () { return { connected: false, email: "", unknown: true }; });
  }
  function saveStatus(inst, connected, email) {
    var db = idb(); if (!db) return Promise.reject(new Error("Server ready nahi"));
    email = connected && MAIL.test(email || "") ? String(email).slice(0, 100) : "";
    return db.collection("institutes").doc(inst).update({ driveConnected: !!connected, driveEmail: email }).then(function () { st[inst] = Object.assign(st[inst] || {}, { connected: !!connected, email: email }); return st[inst]; });
  }
  /* ===== v324: OWNER-VERIFIED DRIVE EMAIL =====
     Owner Panel me institute ke liye Drive email verify hota hai (institutes/{id}.driveVerifiedEmail — sirf Owner likh sakta hai, rules me).
     Uske baad: (1) admin sirf wahi Google account jod sakta hai, (2) har upload se pehle token ka account match hota hai,
     (3) Firestore rules driveEmail status ko bhi verifiedEmail se alag likhne nahi deti. Verified email na ho to purana behaviour. */
  var lc = function (v) { return String(v || "").trim().toLowerCase(); };
  function tokenEmail() {                            /* token ka account: ek baar Drive "about" se, phir cache (extra lag nahi) */
    if (tokEmail) return Promise.resolve(tokEmail);
    return api("GET", "https://www.googleapis.com/drive/v3/about?fields=user(emailAddress)").then(function (j) { return (tokEmail = lc(j && j.user && j.user.emailAddress)); });
  }
  function revokeNow() {
    var t = tok; tok = null; tokExp = 0; tokEmail = ""; folders = {};
    try { if (t && window.google && google.accounts && google.accounts.oauth2) google.accounts.oauth2.revoke(t, function () {}); } catch (e) {}
  }
  function mismatch(have, want) { return new Error("Ye Google account (" + have + ") verified nahi hai. Owner ne is institute ke liye " + want + " verify kiya hai — usi account se jodein."); }
  /* upload se pehle: verified email set ho to token ka account wahi hona chahiye. Cache hit par koi network call nahi. */
  function acctGuard(inst) {
    if (!inst) return Promise.resolve();
    var cached = st[inst], run = function (s) {
      var want = lc(s && s.verifiedEmail);
      if (!want) { if (C().driveVerifyRequired === true) throw new Error("Owner ne is institute ka Drive email abhi verify nahi kiya — Owner se verify karwayein."); return null; }
      return getToken().then(function () { return tokenEmail(); }).then(function (have) { if (have !== want) { revokeNow(); throw mismatch(have, want); } });
    };
    return cached ? Promise.resolve().then(function () { return run(cached); }) : status(inst).then(run);
  }
  /* admin ke Google account se jodo: popup -> Drive ke "about" se email -> (verified ho to match) -> sirf status save */
  function connect(inst) {
    if (!C().googleClientId) return Promise.reject(new Error("Google Client ID abhi set nahi hai (Owner ko batayein)"));
    tok = null; tokEmail = "";                        /* naya account chunne ka mauka */
    return status(inst, true).then(function (s) {
      var want = lc(s && s.verifiedEmail);
      if (!want && C().driveVerifyRequired === true) throw new Error("Owner ne is institute ka Drive email abhi verify nahi kiya — Owner se verify karwayein.");
      return getToken(true, want || undefined).then(function () { return tokenEmail(); }).then(function (have) {
        if (want && have !== want) { revokeNow(); throw mismatch(have, want); }
        return rootFolder().then(function (r) { return folder(String(inst), r); }).then(function () { return saveStatus(inst, true, have); });
      });
    });
  }
  /* OWNER: ek click me verify. Popup me Google login (email pehle se bhara hua) -> account email == likha hua email ho to hi save.
     Save sirf Owner kar sakta hai (rules). Purana admin-connect alag account par ho to reset, taaki admin verified account se dobara jode. */
  function verifyEmail(inst, email, ownerDb) {
    email = lc(email);
    if (!MAIL.test(email) || email.length > 100) return Promise.reject(new Error("Sahi Gmail/Google email likhein"));
    if (!C().googleClientId) return Promise.reject(new Error("Google Client ID abhi set nahi hai"));
    var db = ownerDb || idb(); if (!db) return Promise.reject(new Error("Server ready nahi"));   /* Owner Panel apna alag Firebase session (owner-panel-session) deta hai */
    tok = null; tokEmail = "";
    return getToken(true, email).then(function () { return tokenEmail(); }).then(function (have) {
      revokeNow();                                    /* owner ka token kabhi upload ke kaam nahi aana chahiye */
      if (have !== email) throw new Error("Aapne " + have + " se login kiya, par verify " + email + " karna tha. Sahi account chunkar dobara try karein.");
      return db.collection("institutes").doc(inst).get().then(function (d) {
        var x = d && d.exists ? d.data() : {}, patch = { driveVerifiedEmail: email, driveVerifiedAt: firebase.firestore.FieldValue.serverTimestamp() };
        if (x.driveConnected === true && lc(x.driveEmail) !== email) { patch.driveConnected = false; patch.driveEmail = ""; }
        return db.collection("institutes").doc(inst).update(patch);
      }).then(function () { delete st[inst]; return { email: email }; });
    });
  }
  function clearVerified(inst, ownerDb) {
    var db = ownerDb || idb(); if (!db) return Promise.reject(new Error("Server ready nahi"));
    return db.collection("institutes").doc(inst).update({ driveVerifiedEmail: "", driveVerifiedAt: firebase.firestore.FieldValue.delete() }).then(function () { delete st[inst]; });
  }
  function disconnect(inst) {
    var t = tok; tok = null; tokExp = 0; tokEmail = ""; folders = {};
    try { if (t && window.google && google.accounts && google.accounts.oauth2) google.accounts.oauth2.revoke(t, function () {}); } catch (e) {}
    return saveStatus(inst, false, "");
  }
  function folderUrl(inst) { return getToken().then(function () { return rootFolder(); }).then(function (r) { return folder(String(inst), r); }).then(function (id) { return "https://drive.google.com/drive/folders/" + id; }); }
  /* upload tabhi band jab Owner ne SNAP_CONFIG.driveRequired=true kiya ho AUR status pata ho ki Drive jura nahi. Default: kabhi block nahi. */
  function blocked(inst) { return !!C().googleClientId && !!st[inst] && ((C().driveRequired === true && st[inst].connected !== true) || (C().driveVerifyRequired === true && !st[inst].verifiedEmail)); }

  window.SnapDrive = { ready: ready, upload: upload, remove: remove, status: status, connect: connect, disconnect: disconnect, folderUrl: folderUrl, blocked: blocked, verifyEmail: verifyEmail, clearVerified: clearVerified, _t: { MAIL: MAIL } };
})();
