# 🔔 Asli Push (app band ho tab bhi) — 100% FREE, card nahi

Flow: Admin notification bhejta hai → Firestore me save → free Cloudflare Worker → FCM → student ke phone par (app band ho tab bhi).

## Ek baar ka setup (~15 min)

### 1) Firebase se 2 file lein (free)
- Firebase Console → Project settings → **Your apps → Add app → Android**. Package name: `com.snaptestpro.app` (jo APP_ID ho wahi). Download **google-services.json**.
- Project settings → **Service accounts → Generate new private key** → ek JSON file milegi.

### 2) Cloudflare Worker (free plan, card nahi)
- dash.cloudflare.com → Workers & Pages → Create → Hello World → naam: `snaptestpro-push` → Deploy → **Edit code**.
- `push-worker/worker.js` ka poora code paste karein → Deploy.
- Worker → Settings → Variables and Secrets → **Secret** `SERVICE_ACCOUNT_JSON` = service account JSON ka poora text.
- Worker ka URL (`https://snaptestpro-push.xxxx.workers.dev`) copy karein.

### 3) Code me URL
`native-push.js` me `PUSH_WORKER_URL` ki jagah apna Worker URL daalein.

### 4) GitHub
- Repo → Settings → Secrets → Actions → naya secret **GOOGLE_SERVICES_JSON_BASE64** = google-services.json ka base64
  (Linux/Mac: `base64 -w0 google-services.json`; Windows: `certutil -encode` ya koi online base64 tool).
- Actions → **Build Android App** → Run. Naya APK install karein.

## Test
Student phone par login → Notification permission **Allow** → app poori band karein → Admin se notification bhejein → phone par aani chahiye.

## Zaroori baatein
- Students ko **naya APK** install karna hoga (purane APK me ye system nahi hai).
- Admin ko **email login** chahiye (Worker email se admin verify karta hai).
- Android 13+ par permission popup aata hai — student ko Allow karna hoga.
- Firestore rules badalne ki zaroorat nahi.
- Free limits: Cloudflare 1 lakh requests/din, FCM unlimited — normal use me kabhi paise nahi lagenge.
- Website (browser) par ye wala push nahi chalta, sirf Android app me.

---
## Question bank auto-publish (KV) — ek baar ka setup
1. Cloudflare → Workers & Pages → **KV** → Create namespace: `snaptest-bank`.
2. Worker → Settings → **Bindings** → Add → **KV namespace** → Variable name: `BANK_KV` → namespace `snaptest-bank` → Deploy.
3. `push-worker/worker.js` ka naya code Worker me paste karke Deploy.
4. Uske baad admin ke bank badalte hi bank apne-aap publish ho jata hai (45 second baad). Manual export/upload ki zaroorat nahi.
