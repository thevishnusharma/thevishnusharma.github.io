/* Firebase client bootstrap. Firebase API configuration is public client
   metadata; access control belongs in Security Rules and App Check. */
var firebaseConfig = {
  apiKey: "AIzaSyDVRrxUJspk9-q3R_N5gQwTQf1uyzqu8K0",
  authDomain: "the-vishnu-sharma.firebaseapp.com",
  projectId: "the-vishnu-sharma",
  storageBucket: "the-vishnu-sharma.firebasestorage.app",
  messagingSenderId: "664674204531",
  appId: "1:664674204531:web:145e70cf59e49649156306",
  measurementId: "G-0K5JDMQ8NC"
};

window.vishnuFirebase = {
  db: null,
  storage: null,
  auth: null,
  enabled: false,
  authReady: null,
  appCheckReady: null,
  appCheckState: "off"
};

function startFirebaseAppCheck() {
  var config = (window.SNAP_CONFIG || {}).appCheck || {};
  if (!config.enabled) return Promise.resolve("disabled");

  var C = window.Capacitor;
  var native = false;
  try { native = !!(C && (C.isNativePlatform ? C.isNativePlatform() : C.platform && C.platform !== "web")); } catch (e) {}
  if (native && config.nativeEnabled && C && typeof C.nativePromise === "function") {
    return C.nativePromise("FirebaseAppCheck", "initialize", {
      isTokenAutoRefreshEnabled: config.tokenAutoRefresh !== false
    }).then(function () {
      window.vishnuFirebase.appCheckState = "initialized:android-play-integrity";
      return window.vishnuFirebase.appCheckState;
    }).catch(function (error) {
      window.vishnuFirebase.appCheckState = "native-init-failed";
      console.warn("Firebase App Check native initialization failed", error && error.message || error);
      return window.vishnuFirebase.appCheckState;
    });
  }

  var siteKey = String(config.webSiteKey || "").trim();
  if (siteKey && typeof firebase.appCheck === "function") {
    try {
      var activation = firebase.appCheck().activate(siteKey, config.tokenAutoRefresh !== false);
      return Promise.resolve(activation).then(function () {
        window.vishnuFirebase.appCheckState = "initialized:web-recaptcha-v3";
        return window.vishnuFirebase.appCheckState;
      }).catch(function (error) {
        window.vishnuFirebase.appCheckState = "web-init-failed";
        console.warn("Firebase App Check web initialization failed", error && error.message || error);
        return window.vishnuFirebase.appCheckState;
      });
    } catch (error) {
      window.vishnuFirebase.appCheckState = "web-init-failed";
      console.warn("Firebase App Check web initialization failed", error && error.message || error);
      return Promise.resolve(window.vishnuFirebase.appCheckState);
    }
  }

  window.vishnuFirebase.appCheckState = native ? "native-plugin-unavailable" : "web-site-key-missing";
  console.warn("Firebase App Check is not activated:", window.vishnuFirebase.appCheckState);
  return Promise.resolve(window.vishnuFirebase.appCheckState);
}

try {
  if (typeof firebase !== "undefined") {
    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
    window.vishnuFirebase.appCheckReady = startFirebaseAppCheck();
    window.vishnuFirebase.db = firebase.firestore();
    /* HYBRID MODE (own-backend.js): SNAP_CONFIG.ownBackend me jo collections likhi hain sirf wahi apne backend par jati hain,
       baaki sab Firebase par. enabled:false (default) ho to ye line kuch nahi badalti. */
    try { if (window.SnapOwnBackend) window.vishnuFirebase.db = window.SnapOwnBackend.wrap(window.vishnuFirebase.db); } catch (e) { console.warn('own-backend wrap fail:', e); }
    /* v200: kuch mobile network/WebView me Firestore ka normal connection atak jaata hai ("Backend didn't respond within 10 seconds").
       Auto-detect ON: atakne par SDK khud long-polling par chala jaata hai. Fail ho to app pehle jaisa chalta hai. */
    try { window.vishnuFirebase.db.settings({ experimentalAutoDetectLongPolling: true, merge: true }); } catch (error) { console.warn("Firestore long-polling setting skip", error && error.message); }
    try { window.vishnuFirebase.storage = firebase.storage(); }
    catch (error) { console.warn("Firebase Storage unavailable", error); }

    try {
      window.vishnuFirebase.db.enablePersistence({ synchronizeTabs: true }).catch(function (error) {
        console.warn("Firestore offline persistence enable nahi ho payi:", error && error.code);
      });
    } catch (error) { console.warn("Firestore offline persistence setup error", error); }

    try {
      window.vishnuFirebase.auth = firebase.auth();
      window.vishnuFirebase.authReady = new Promise(function (resolve) {
        var signInStarted = false, unsubscribe = function () {};
        unsubscribe = window.vishnuFirebase.auth.onAuthStateChanged(function (user) {
          if (user) { unsubscribe(); resolve(user); return; }
          if (signInStarted) return;
          signInStarted = true;
          Promise.resolve(window.vishnuFirebase.appCheckReady).then(function () {
            return window.vishnuFirebase.auth.signInAnonymously();
          }).catch(function (error) {
            console.warn("Anonymous sign-in failed (enable it in Firebase Console > Authentication)", error);
            unsubscribe(); resolve(null);
          });
        }, function (error) {
          console.warn("Firebase Auth state listener failed", error);
          unsubscribe(); resolve(null);
        });
      });
    } catch (error) { console.warn("Firebase Auth unavailable", error); }

    window.vishnuFirebase.enabled = true;
  }
} catch (error) { console.warn("Firebase unavailable", error); }

/* v239: App Check token Worker ko bhejna. Sirf apne Worker URL par, sirf POST/PUT/DELETE; baaki har fetch bina chhede nikalti hai.
   Token 1.5 sec me na mile (ya App Check band ho) to request bina header ke chali jaati hai — app kabhi atakta nahi.
   Worker ka APPCHECK_MODE (off/monitor/enforce) decide karta hai ki header na hone par kya ho. Docs: docs/APP_CHECK.md */
(function () {
  var W = String((window.SNAP_CONFIG || {}).workerUrl || "").replace(/\/+$/, "");
  if (!W || typeof window.fetch !== "function" || window.__snapAcFetch) return;
  window.__snapAcFetch = true;
  var origFetch = window.fetch.bind(window), cached = "", cachedUntil = 0;

  function getAppCheckToken() {
    var vf = window.vishnuFirebase || {}, st = String(vf.appCheckState || "");
    if (st.indexOf("initialized:") !== 0) return Promise.resolve("");
    if (cached && Date.now() < cachedUntil) return Promise.resolve(cached);
    var p;
    try {
      if (st.indexOf("android") >= 0) {
        p = window.Capacitor.nativePromise("FirebaseAppCheck", "getToken", { forceRefresh: false }).then(function (r) { return r && r.token || ""; });
      } else {
        p = Promise.resolve(firebase.appCheck().getToken(false)).then(function (r) { return r && r.token || ""; });
      }
    } catch (e) { return Promise.resolve(""); }
    var timeout = new Promise(function (res) { setTimeout(function () { res(""); }, 1500); });
    return Promise.race([p.catch(function () { return ""; }), timeout]).then(function (t) {
      if (t) { cached = t; cachedUntil = Date.now() + 5 * 60 * 1000; }
      return t;
    });
  }

  window.fetch = function (input, init) {
    try {
      var url = typeof input === "string" ? input : (input && input.url) || "";
      var method = String((init && init.method) || (input && input.method) || "GET").toUpperCase();
      if (url.indexOf(W) === 0 && method !== "GET" && method !== "HEAD" && !(typeof input === "object" && input && input.url)) {
        return getAppCheckToken().then(function (t) {
          if (!t) return origFetch(input, init);
          var h = new Headers((init && init.headers) || {});
          h.set("X-Firebase-AppCheck", t);
          return origFetch(input, Object.assign({}, init, { headers: h }));
        });
      }
    } catch (e) {}
    return origFetch(input, init);
  };
})();
