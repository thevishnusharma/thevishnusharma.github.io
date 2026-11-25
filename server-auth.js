/* Phase 4 — Server-verified student login (Cloudflare Worker). Default OFF: SNAP_CONFIG.serverAuth = false.
   ON hone par: login/register/PIN/reset Worker se hote hain (salted PBKDF2 + rate limit), Firebase custom token se sign-in. */
(function () {
  "use strict";
  function cfg() { return window.SNAP_CONFIG || {}; }
  try { var q = /[?&]serverauth=([01])/.exec(location.search); if (q) { q[1] === "1" ? localStorage.setItem("snap_server_auth", "1") : localStorage.removeItem("snap_server_auth"); } } catch (e) {}
  /* Test ke liye sirf apne phone par: app URL ke end me ?serverauth=1 lagayein (band karne ke liye ?serverauth=0). */
  function enabled() { var on = cfg().serverAuth === true; try { on = on || localStorage.getItem("snap_server_auth") === "1"; } catch (e) {} return on && !!cfg().workerUrl; }
  async function post(path, body) {
    var r;
    try { r = await fetch(String(cfg().workerUrl).replace(/\/+$/, "") + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); }
    catch (e) { throw new Error("Internet/connection check karein."); }
    var j = {}; try { j = await r.json(); } catch (e) {}
    if (!r.ok || !j.ok) { var er = new Error(j.error || ("Request fail (" + r.status + ")")); er.status = r.status; er.retryAfter = j.retryAfter; throw er; }
    return j;
  }
  async function postDelete(body) {
    for (var i = 0; i < 20; i++) {
      try { return await post("/student/delete-account", body); }
      catch (e) { if (e.status !== 503 || i === 19) throw e; await new Promise(function (resolve) { setTimeout(resolve, 250); }); }
    }
  }
  /* v330: bharosemand device ka token (email OTP 30 din tak dobara nahi). Key = institute + asli 10-digit mobile, taaki register (composite key) aur login (mobile) dono same device ko pehchanein. */
  function tdKey(inst, mobile) { return "snap_td:" + (inst || "") + ":" + String(mobile || "").slice(-10); }
  function getTd(inst, mobile) { try { return localStorage.getItem(tdKey(inst, mobile)) || ""; } catch (e) { return ""; } }
  function setTd(inst, mobile, v) { try { if (v) localStorage.setItem(tdKey(inst, mobile), v); } catch (e) {} }
  function needOtpUi() { if (!window.SnapOtp) throw new Error("Email verification load nahi hui — page refresh karke dobara try karein."); }
  function auth() { return window.firebase && firebase.auth && firebase.auth(); }
  async function idToken() { var a = auth(), u = a && a.currentUser; if (!u) throw new Error("Pehle login karein."); return u.getIdToken(); }
  window.SnapAuth = {
    enabled: enabled,
    post: post,
    login: async function (mobile, password, instituteId) {
      var j = await post("/student/login", { mobile: mobile, password: password, instituteId: instituteId || undefined, deviceToken: getTd(instituteId, mobile) || undefined });
      if (j.otpRequired) {                         /* v330: email OTP (naya device / pehla login) */
        needOtpUi();
        j = await window.SnapOtp.student(j, { post: post, purpose: "login" });
        if (j.deviceToken) setTd(instituteId, mobile, j.deviceToken);
      }
      /* Agar isi browser me Admin (email) login hai to usko replace NA karein (warna admin logout + "admin account nahi" alert aata hai). */
      var cu = auth() && auth().currentUser;
      if (!(cu && cu.email)) await auth().signInWithCustomToken(j.token);
      return j.student;
    },
    register: function (mobile, password, pin, instituteId) { return post("/student/register", { mobile: mobile, password: password, pin: pin, instituteId: instituteId || undefined }); },
    setPin: async function (mobile, pin) { return post("/student/set-pin", { idToken: await idToken(), mobile: mobile, pin: pin }); },
    resetWithPin: async function (mobile, pin, newPassword, instituteId) {
      var body = { mobile: mobile, pin: pin, newPassword: newPassword, instituteId: instituteId || undefined };
      var j = await post("/student/reset-with-pin", body);
      if (j.otpRequired) {                         /* v330: email jura ho to password reset par bhi OTP */
        needOtpUi();
        var v = await window.SnapOtp.student(j, { post: post, purpose: "reset" });
        j = await post("/student/reset-with-pin", Object.assign({}, body, { proof: v.proof }));
      }
      return j;
    },
    adminReset: async function (mobile, newPassword) { return post("/student/admin-reset", { idToken: await idToken(), mobile: mobile, newPassword: newPassword }); },
    institutes: async function () { var j = await post("/student/institutes", {}); return j.institutes || []; },
    deleteMyAccount: function (mobile, confirmMobile, password, instituteId) { return postDelete({ mobile: mobile, confirmMobile: confirmMobile, password: password, instituteId: instituteId || undefined }); },
    adminDelete: async function (mobile, confirmMobile) { return postDelete({ idToken: await idToken(), mobile: mobile, confirmMobile: confirmMobile }); },
    afterLogout: function () {
      try {
        var a = auth(), u = a && a.currentUser;
        if (u && !u.isAnonymous && !u.email) a.signOut().then(function () { return a.signInAnonymously(); }).catch(function () {});
      } catch (e) {}
    }
  };
})();
