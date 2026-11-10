# Firebase App Check rollout

`app-config.js` has an App Check feature switch and an intentionally blank public reCAPTCHA v3 site key. `firebase-config.js` starts the web compat provider when that key is configured and starts the Capacitor Firebase App Check plugin on native platforms. Android uses the native Firebase provider, Play Integrity. Automatic token refresh is enabled. The current code reports provider startup state through `window.vishnuFirebase.appCheckState` and continues to allow the app to start when the provider has not yet been configured.

## Required Firebase Console setup

1. In Firebase Console, register the deployed website under App Check with reCAPTCHA v3 and copy the **site key** (never the secret key) to `app-config.js > appCheck.webSiteKey`.
2. Register the Android app in Firebase App Check, link the Google Play Integrity API, and register the release app signing SHA-256 fingerprint. The app must use the same Firebase Android app/project as its `google-services.json`.
3. Install the Capacitor 6 compatible plugin by running the normal dependency install and `npx cap sync android`; build and inspect a signed internal-test APK.
4. Enable App Check metrics/monitoring for Firestore, Storage and Authentication in Firebase Console. Observe real web, PWA and Play-distributed APK traffic through a full release cycle.
5. Enforce one Firebase product at a time only after verified traffic is healthy and unsupported clients are understood. Rollback by disabling enforcement in Firebase Console.

Do not enable enforcement from this repository: it cannot verify Console provider registrations or live traffic. The Worker API is a separate custom backend. Firebase product enforcement does not validate Worker requests; before protecting those endpoints, send an App Check token and verify it with Firebase Admin in the Worker/server. Do not claim those routes are App Check protected until server verification exists.

The project currently uses Capacitor 6 and the matching `@capacitor-firebase/app-check` 6.x plugin. Its maintainers mark the 6.x line deprecated; keep this compatibility dependency only for the current Capacitor major and plan a coordinated Capacitor/plugin major upgrade. See the [plugin usage guide](https://github.com/capawesome-team/capacitor-firebase/blob/main/packages/app-check/README.md).

References: [Firebase App Check for Web](https://firebase.google.com/docs/app-check/web/recaptcha-provider), [Firebase App Check for Android with Play Integrity](https://firebase.google.com/docs/app-check/android/play-integrity-provider).

---

## v239 — Worker par App Check (staged rollout)

Worker (`push-worker/worker.js`) ab App Check token verify kar sakta hai (Google ke JWKS se, Admin SDK ke bina).
Default **OFF** hai — jab tak aap Cloudflare me variable na daalein, kuch nahi badalta.

**Cloudflare → Worker → Settings → Variables (Text):**

| Variable | Matlab |
|---|---|
| `APPCHECK_MODE` | `off` (default) · `monitor` (sirf log, kabhi block nahi) · `enforce` (token nahi/galat => 401) |
| `PROJECT_NUMBER` | optional — Firebase project number (extra check). Khaali ho to sirf project ID match hota hai |

**Client** (`firebase-config.js`) khud `X-Firebase-AppCheck` header lagata hai — sirf apne Worker URL par, sirf POST/PUT/DELETE, 1.5 sec se zyada nahi rukta.
Exempt: GET/HEAD/OPTIONS (bank/files ke public links), `/broadcast` (GitHub Action ka apna secret), `/alert` (error reports). JWKS down ho to fail-open (outage me app band na ho).

### Rollout (isi order me)
1. Firebase Console → App Check → **Web app** register → reCAPTCHA v3 **site key** (public) → `app-config.js` ke `appCheck.webSiteKey` me daalo. Android app ke liye **Play Integrity** register karo (SHA-256 fingerprint Play Console/App signing se). Owner APK aur har institute APK ka package alag app hai — unko bhi register karna padega.
2. Naya build deploy karo; Console → App Check → Metrics me "verified requests" dikhne chahiye.
3. Cloudflare me `APPCHECK_MODE=monitor`. `npx wrangler tail` me `{"appcheck":"missing"...}` lines dekho. 1–2 hafte tak `missing/invalid` ~0 hona chahiye (purane app versions wale students ko update karwane do).
4. Pehle Console me **Firestore/Storage** ke liye "Monitor" (unenforced) rakho; sab theek ho tab hi "Enforce".
5. Aakhir me Worker `APPCHECK_MODE=enforce`. Rollback: variable `off` kar do (turant, redeploy nahi).

### Verify result values (log / `X-AppCheck` response header)
`ok · missing · malformed · bad-alg · unknown-key · bad-signature · wrong-project · bad-iss · no-sub · expired · jwks-unavailable · no-project`

Tests: `tests/unit/test_worker_appcheck.js` (verifier + off/monitor/enforce gate), `tests/unit/test_appcheck_fetch.js` (client header, leak/atakna guard).
