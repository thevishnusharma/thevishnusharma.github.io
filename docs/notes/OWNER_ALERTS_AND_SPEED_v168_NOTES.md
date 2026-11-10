# v168 — Owner Auto-Alerts + Speed/Update fixes

## 1) Owner ko automatic alert (student ko kuch nahi dikhta)
Nayi file `error-reporter.js` (index.html me sabse pehle load). Ye chupke se pakadta hai: JS error, unhandled promise,
Firebase/Firestore error (permission-denied, **quota/resource-exhausted**), Firebase SDK load na hona, script/CSS load fail,
offline write reject, aur bahut slow startup (LCP > 4s, din me 1 baar/device).
- Duplicate rokne ke liye: per-session max 12, same error 30 min me ek baar, server par 3 ghante me ek baar push, max 40 push/ghanta.
- Internet na hone wale errors ("Failed to fetch") ignore hote hain (wo bug nahi, user ka net hai). Offline me alert queue hota hai, net aate hi jata hai.
- Student ko ab "data online save / network" wala pill-toast **nahi** dikhta (offline-sync.js). Sirf admin ko dikhta hai.

Owner tak pahunchne ke 3 raaste: (a) Owner Panel > "App Alerts" list, (b) Android app me owner login par FCM push (topic `owner_alerts`),
(c) Telegram (sabse pakka, optional).

### Aapko karna hai (ek baar)
1. Cloudflare Worker me naya `worker.js` paste karke Deploy (push-worker/worker.js wahi file hai).
2. (Optional par recommended) Telegram: @BotFather se bot banao -> token; bot ko message bhejo; chat id lo.
   Worker > Settings > Variables and Secrets: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`.
3. Saari nayi/badli files GitHub par upload: error-reporter.js, bank-idb.js, index.html, sw.js, script.js, offline-sync.js,
   native-push.js, owner-panel.js, owner-app.html, app-config.js, worker.js. Firestore rules me **koi badlav nahi**.
4. Test: Owner Panel > App Alerts. Ya koi page kholkar console me `SnapAlert.report("test","Owner alert test",{}, "error")`.

## 2) Speed / update
- sw.js: ab naya JS/CSS/HTML milte hi page ko signal jata hai; app background me jaate waqt apne-aap reload (exam ke beech kabhi nahi).
  Pehle naya version tabhi aata tha jab sw.js khud badle.
- Bank (7.5MB): IndexedDB fallback (bank-idb.js) — jin phones me localStorage 5MB me bank save nahi hota wahan har open par re-download band.
  Worker `/bank` ab ETag + 1 ghanta cache + stale-while-revalidate deta hai (304 = lagbhag 0 download).
  NOTE: Chromium desktop me localStorage me 7.5MB save ho gaya tha aur IndexedDB padhna JSON.parse se tez nahi tha —
  yaani ye safety-net hai, bada speedup nahi. Bada speedup agla step: bank ko class/subject-wise chhote chunks me todna.
- APK update: APK me app ki copy andar bandi hoti hai (`www/`), isliye web update APK me tab tak nahi aata jab tak naya APK na bane.
  **Sabse aasaan fix:** GitHub repo > Settings > Variables > `APP_URL` = `https://snaptestpro.github.io` rakhkar APK ek baar rebuild karein.
  Phir APK live site kholti hai — web update = app update, aur SW cache se repeat open instant. (Trade-off: pehli baar internet chahiye.)

## Verified (headless Chromium)
error-reporter: 3 unique errors gaye, duplicate dedupe hua, "Failed to fetch" ignore hua, quota error `critical` mila.
sw.js: file badalne par `snap-asset-updated` message aaya. build-www.js ka SW-disable marker abhi bhi kaam karta hai.
## Verify NAHI ho paya (mere paas Firebase/Cloudflare/phone nahi)
Worker `/alert` ka live FCM/Telegram send, Android me `owner_alerts` topic subscribe, APK build — deploy ke baad ek baar test karein.
