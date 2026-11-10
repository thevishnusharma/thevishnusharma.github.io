/* presence-ping.js — "abhi kaun login/online hai" ka signal.
   Student ya Admin app khula (aur visible) ho to har 60 sec me presence/{id} doc update hota hai.
   Owner dashboard 3 minute se purane pings ko "offline" maanta hai.
   Koi personal data nahi: sirf role, instituteId aur lastSeen. */
(function () {
  "use strict";
  var OWNER_EMAIL = "thevishnusharmaapp@gmail.com", KEY = "savya_student_session", EVERY = 60000, timer = null, lastId = null;
  function who() {
    try {
      var a = firebase.auth().currentUser;
      if (a && a.email && !a.isAnonymous) {
        if (a.email.toLowerCase() === OWNER_EMAIL) return null;
        return { id: "a_" + a.uid, role: "admin" };
      }
    } catch (e) {}
    try {
      var s = JSON.parse(localStorage.getItem(KEY) || "null");
      if (s && s.mobile) return { id: "s_" + String(s.mobile).replace(/\D/g, ""), role: "student", inst: s.instituteId || null };
    } catch (e) {}
    return null;
  }
  function ping() {
    if (document.visibilityState === "hidden") return;
    var w = who(); if (!w) return;
    try {
      var db = firebase.firestore(), data = { role: w.role, lastSeen: firebase.firestore.FieldValue.serverTimestamp() };
      if (w.inst) data.instituteId = String(w.inst);
      lastId = w.id;
      db.collection("presence").doc(w.id).set(data).catch(function () {});
    } catch (e) {}
  }
  function start() {
    if (timer) return;
    ping(); timer = setInterval(ping, EVERY);
    document.addEventListener("visibilitychange", function () { if (document.visibilityState === "visible") ping(); });
  }
  // Firebase ready hone ka intezaar
  var tries = 0, w8 = setInterval(function () {
    if (window.firebase && firebase.apps && firebase.apps.length && firebase.firestore) { clearInterval(w8); start(); }
    else if (++tries > 60) clearInterval(w8);
  }, 1000);
})();
