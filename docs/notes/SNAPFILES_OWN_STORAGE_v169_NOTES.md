# v169 — SnapFiles: apna file storage (Firebase Storage / Firestore ki limit ki zaroorat nahi)

## Kya badla
- Notes / Study material / PPT / **Recording ki file** / **Assignment ki file** device se upload karne par file pehle **Cloudflare R2** (wahi bucket `snaptest-live`, folder `files/`) me jaati hai, Worker ke through. Firestore me sirf chhota pointer `{key,name,type,size}` save hota hai.
- **Koi size limit nahi:** 8 MB tak ek request; usse badi file 8 MB ke tukdon (multipart) me, har tukda 4 baar retry. Progress % dikhta hai. (Asli limit sirf R2 ki free 10 GB total jagah — SnapLive recordings ke saath shared.)
- **Koi bhi file type:** PDF, image, PPT/DOC/XLS, video, audio, zip, txt... Viewer: image/video/audio app me, PDF/PPT/DOC Google viewer se (⬇ / Open ↗ bhi hai). Video me seek (Range) chalta hai.
- Apna storage na chale (Worker/R2 set nahi, internet, error) to **apne-aap purane Firebase tareeke par** chala jaata hai (toast dikhta hai). Purani files waise hi khulti hain.
- Content/assignment/batch ("Delete + Data") delete karne par file R2 se bhi hat jaati hai — jagah wapas milti hai.
- Badi JPEG photo (3 MB+) upload se pehle halki chhoti ki jaati hai (quality bachi rehti hai); baaki files jyon ki tyon.
- SnapLive live + recording bilkul waise hi (is update se chhua nahi gaya).

## Aapko karna hai
1. Naya `worker.js` Cloudflare me paste → Deploy (R2 binding `LIVE_R2` wahi rahegi — SnapLive wali; naya setup nahi).
2. GitHub par files upload (naya: `snap-files.js`).
Kill-switch: `SNAP_CONFIG.ownFiles = false` => dobara Firebase tareeka.

## Dhyan rakhein
- Upload sirf admin ke email-login se (student se nahi). Student ke assignment-jawab ki upload abhi nahi.
- File ka link anuman se nahi bante (random key) aur sirf batch ke students ko Firestore item se milta hai. Delete ke baad pehle dekhne wale ke browser cache me file kuch der rah sakti hai.
- Upload poora hone tak app band na karein (progress % dikhta hai).

## Files
Naya: `snap-files.js`. Badle: `worker.js` (+`push-worker/worker.js`), `batch-system.js`, `batch-phase2.js`, `index.html`, `sw.js`.

---
## v171 — R2 ki jagah FREE KV storage (card ki zaroorat nahi)
Cloudflare R2 ke liye payment method (card) chahiye, isliye Worker ab **Workers KV** (free, card nahi) bhi use kar sakta hai. R2 bound ho to wahi pehle chalta hai (koi limit nahi); nahi to KV.

**Setup (2 minute, sirf ek baar):**
1. Cloudflare > Workers & Pages > **KV** > Create namespace: `snaptest-files`.
2. Worker > Settings > **Bindings** > Add > KV namespace > Variable name `FILES_KV` > wo namespace chunein > Deploy.
   (Ye bhi nahi karna chahein to pehle se bani `BANK_KV` apne-aap use ho jaati hai — naya setup nahi.)
3. Naya `worker.js` paste -> Deploy. Bas.

**KV ki limits (free plan):** total ~1 GB, ek file max 300 MB, upload/download ke liye koi card nahi. Storage bharne par message aata hai ("Free storage bhar gaya") — purani files delete karein (delete se jagah wapas milti hai). Upload ke baad toast me "Storage: X MB / 1 GB" dikhta hai.
- Notes / PDF / PPT / photos / assignment ki files ke liye kaafi hai.
- **Recording / lecture video:** YouTube par **Unlisted** upload karke uska link "Recorded Lecture" ke link-box me daalein (unlimited, free). Live class: "Meri app ke andar (Jitsi)" ya "Doosri app ka link (YouTube Live / Meet / Zoom)" — dono free. SnapLive (apna live + auto recording) sirf R2 ke saath chalta hai, isliye abhi band hi rakhein.
- Agar kabhi R2 mil gaya: bas `LIVE_R2` bind kar dein — limit hat jaayegi, KV ki purani files bhi chalti rahengi.

---
## v172 — PDF viewer app ke andar ("too large" fix)
Apni storage ki PDF ab app ke andar **pdf.js** (Mozilla, Apache-2.0, free) se khulti hai — Google viewer ki ~25 MB limit se "too large" nahi aata.
- Badi PDF turant: sirf wahi pages (HTTP Range) mangwata hai jo screen par dikhte hain; 57 MB ki 90-page test PDF me pehla page ~ kuch MB me khul gayi.
- Page-by-page (screen ki chaudai), − / + zoom, page number, ⬇ aur ↗ (phone ke viewer me kholein).
- pdf.js sirf pehli PDF kholne par load hota hai — app ki start-up speed par asar nahi. Files: `pdf-viewer.js`, `vendor/pdfjs/pdf.min.js`, `vendor/pdfjs/pdf.worker.min.js`, `vendor/pdfjs/LICENSE.txt` (**vendor folder bhi upload karein**).
- Link wali PDF pehle jaisi (Google viewer). Apni storage ki 25 MB se badi PPT/DOC ka preview nahi banta (Google ki limit) — ⬇ se download, ya PDF banake daalein.
