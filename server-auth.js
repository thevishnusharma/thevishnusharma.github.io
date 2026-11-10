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
  function auth() { return window.firebase && firebase.auth && firebase.auth(); }
  async function idToken() { var a = auth(), u = a && a.currentUser; if (!u) throw new Error("Pehle login karein."); return u.getIdToken(); }
  window.SnapAuth = {
    enabled: enabled,
    login: async function (mobile, password) {
      var j = await post("/student/login", { mobile: mobile, password: password });
      /* Agar isi browser me Admin (email) login hai to usko replace NA karein (warna admin logout + "admin account nahi" alert aata hai). */
      var cu = auth() && auth().currentUser;
      if (!(cu && cu.email)) await auth().signInWithCustomToken(j.token);
      return j.student;
    },
    register: function (mobile, password, pin) { return post("/student/register", { mobile: mobile, password: password, pin: pin }); },
    setPin: async function (mobile, pin) { return post("/student/set-pin", { idToken: await idToken(), mobile: mobile, pin: pin }); },
    resetWithPin: function (mobile, pin, newPassword) { return post("/student/reset-with-pin", { mobile: mobile, pin: pin, newPassword: newPassword }); },
    adminReset: async function (mobile, newPassword) { return post("/student/admin-reset", { idToken: await idToken(), mobile: mobile, newPassword: newPassword }); },
    deleteMyAccount: function (mobile, confirmMobile, password) { return postDelete({ mobile: mobile, confirmMobile: confirmMobile, password: password }); },
    adminDelete: async function (mobile, confirmMobile) { return postDelete({ idToken: await idToken(), mobile: mobile, confirmMobile: confirmMobile }); },
    afterLogout: function () {
      try {
        var a = auth(), u = a && a.currentUser;
        if (u && !u.isAnonymous && !u.email) a.signOut().then(function () { return a.signInAnonymously(); }).catch(function () {});
      } catch (e) {}
    }
  };
})();
