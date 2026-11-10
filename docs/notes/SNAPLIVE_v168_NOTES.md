> ⚠️ **REMOVED (v216, Phase 0).** SnapLive (apna R2 live + recording) hata diya gaya hai. Live class ab sirf YouTube link se; recording sirf link. Ye note sirf itihaas ke liye hai — iske setup steps mat chalao.

# SnapLive — apna Live Class + Recording (Jitsi/Zoom ke bina)

**Kya hai:** teacher ka device (camera ya screen + mic) khud record karta hai, har ~3 sec ka tukda aapke Cloudflare Worker ke through **R2** me jata hai.
Students wahi tukde live chalate hain (~4–10 sec delay). Class khatam => wahi tukde **recording** ban jate hain (seek ke saath). Alag se kuch upload/convert nahi.
Sab kuch aapke apne Cloudflare account me — koi bahari video service nahi.

## Setup (ek baar, ~5 min)
1. Cloudflare → **R2** → *Create bucket* (naam: `snaptest-live`). (R2 free tier me bhi card/payment method maangta hai; 10 GB storage free.)
2. Worker → **Settings → Bindings → Add → R2 bucket** → Variable name **`LIVE_R2`** → bucket chunein. Naya `worker.js` paste karke Deploy.
3. (Recommended) Bucket → Settings → **Public access (r2.dev) Enable** → URL copy → Worker Variables: `LIVE_PUBLIC_BASE = https://pub-xxxx.r2.dev`.
   Bucket → Settings → **CORS policy**: AllowedOrigins `*`, AllowedMethods `GET`, AllowedHeaders `*`.
   (Ye na karein to segments Worker khud serve karta hai — chhoti classes ke liye theek, par Worker free plan 100k requests/din hai: ~50 students × 1 ghanta ≈ 60k.)
4. Batch → Live Classes → "+ Add" → **"Live kaise hogi?" = SnapLive** → class banayein → **Go Live** → Source chunein → "Live shuru karein".
5. Class khatam: studio me **"Class khatam"** (ya list se *End Class*). Saare segments upload hone ke baad recording apne-aap **Published** ho jati hai.
   Agar internet gaya aur upload poora nahi hua to recording **incomplete** (unpublished) rehti hai — aap dekh kar Publish kar sakte hain.

## Students kya karte hain
Class "Live" dikhe => Join => live video + chat + ✋ haath uthayein. Recording: Recorded Lectures → ▶ (seek bar, 1x–2x speed).
Attendance join par apne-aap likhi jati hai (Reports me).

## Security
- Upload / end / delete: sirf **admin** (Firebase ID token Worker me verify; admin doc active; dusre institute ka session chhoo nahi sakta).
- Dekhna: har class ki ek **192-bit random key** (capability URL) — key sirf us class/recording ke item me hoti hai, jo Strict Mode me sirf enrolled students ko padhne milta hai. Segment files par alag login nahi (ye jaan-boojh kar hai taaki Worker request limit na lage).
- Delete recording => R2 se saare segments bhi hat jate hain.

## Limits (seedhi baat)
- **One-to-many**: teacher bolta/dikhata hai; students ka mic/camera nahi (sawal chat/haath se). Sab students ka video-call (Zoom jaisa) iske liye media server chahiye — alag/paid cheez.
- Delay ~4–10 sec (live nahi, near-live). Pehla view mid-class join karne par 1–3 sec black ho sakta hai (keyframe ka intezaar).
- **Chrome / Android app** par chalta hai. **iPhone Safari par nahi** (WebM-MSE support nahi) — wahan "is device par nahi chalega" dikhta hai.
- Teacher ka stream **teacher ke device/internet** par depend hai: studio tab/app band mat karein; band hua to "Rejoin" se nayi *part* me continue hota hai (recording me beech ka gap nahi aata).
- Screen-share sirf **laptop/desktop Chrome** me. Android APK (WebView) me sirf camera.
- APK me ab **RECORD_AUDIO** permission jodi gayi (teacher mic ke liye). Play Store "Data safety" me mic mention karna pad sakta hai. Teacher chahe to Chrome (web) se bhi live kar sakta hai — APK change ki zaroorat nahi.
- **Kharcha/storage:** ~0.8 Mbps video => ~350 MB per ghanta class. R2 free 10 GB ≈ 28 ghante ki classes; uske baad ~$0.015/GB-mahina. Purani recordings delete karke jagah wapas milti hai.
- Segment upload teacher ke phone se hota hai: 0.8 Mbps+ stable upload chahiye (4G theek).

## Test (jo maine chalaya)
Chromium (fake camera/mic) + **asli worker.js** (mock R2) ke saath end-to-end: teacher studio → segments upload → student live (1280×720, time aage badhta hua, ~4s delay) → chat + haath → class end → recording item (published) → VOD play → seek (buffered / cold / part-boundary) → resume (studio band + Rejoin = nayi part) → delete purge. `node tests/live-worker.test.js` (12 checks: auth, institute isolation, key/path validation, size limit, resume, end, delete).
**Nahi test hua (mere paas nahi):** asli R2 bucket/Cloudflare, asli phone/APK, 50+ students ka load, iPhone, bahut lambi (2+ ghante) class.
