/* v168 — Student session binding (strict batch access ke liye)
   Student login sahi hone par (password proof rules me verify ho chuka) ye studentSessions/{authUid} likhta hai.
   Firestore Rules is doc ko tabhi accept karte hain jab proof studentSecrets/{mobile}.hash se match kare — yaani server-side
   verify hota hai ki is device-uid ka malik wahi mobile hai. Isse institute ka "Strict Mode" student ko batch/member check de pata hai.
   Strict mode OFF ho ya rules publish na hue ho to ye chupchaap fail hota hai aur app purane tareeke se chalti hai. Kabhi throw nahi karta. */
(function () {
  "use strict";
  var ok = false, last = null;
  function fb() { var v = window.vishnuFirebase; return v && v.enabled ? v : null; }
  window.SnapSession = {
    ok: function () { return ok; },
    establish: function (mobile, proof) {
      try {
        var v = fb(); if (!v || !mobile || !proof) return Promise.resolve(false);
        return Promise.resolve(v.authReady).catch(function () {}).then(function () {
          var u = v.auth && v.auth.currentUser; if (!u) return false;
          return v.db.collection("studentSessions").doc(u.uid).set({ mobile: String(mobile), proof: String(proof), at: firebase.firestore.FieldValue.serverTimestamp() })
            .then(function () { ok = true; last = String(mobile); try { localStorage.setItem("snap_sess_ok", "1"); } catch (e) {} return true; })
            .catch(function (e) { ok = false; try { localStorage.setItem("snap_sess_ok", "0"); } catch (x) {} return false; });
        });
      } catch (e) { return Promise.resolve(false); }
    },
    /* logout par is device-uid ka session hata do (agla login naya bana dega) */
    clear: function () {
      try { var v = fb(); var u = v && v.auth && v.auth.currentUser; ok = false; if (u) v.db.collection("studentSessions").doc(u.uid).delete().catch(function () {}); } catch (e) {}
    },
    /* login ke baad ye device-uid ka session abhi bhi maujood hai? (strict mode me batch kholne se pehle check) */
    check: function (mobile) {
      try {
        var v = fb(); if (!v) return Promise.resolve(false);
        return Promise.resolve(v.authReady).catch(function () {}).then(function () {
          var u = v.auth && v.auth.currentUser; if (!u) return false;
          return v.db.collection("studentSessions").doc(u.uid).get().then(function (d) { ok = !!(d.exists && String(d.data().mobile) === String(mobile)); return ok; }).catch(function () { return false; });
        });
      } catch (e) { return Promise.resolve(false); }
    }
  };
})();
