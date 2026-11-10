# v288 — APK Chrome me download + strict institute isolation

## 1. APK download (Chrome)
- download.html: "Download APK" ab Android par in-app browser / WebView me ho to Chrome ka `intent://` khol deta hai (wahin se download hota hai, Downloads me dikhta hai). Chrome me ho to seedha download.
- owner-panel.js: Owner app ka "APK download" link Chrome (Custom Tab) me khulta hai.
- app-update.js: fallback ab Chrome intent hai (pehle WebView me href — file dikhti nahi thi).

## 2. Strict tenant isolation (firestore.rules / storage.rules)
- tests/{id}/qchunks: write sirf us test ke institute ke admin se.
- examManagerExams/{id}/scanPhotos|scanResults|roster aur examRegistrations/{id}/roster|photos: sirf usi institute ka admin (pehle koi bhi admin).
- studentRecords update/delete: sirf usi institute ka admin.
- storage.rules: admin-doc + instituteId match ZAROORI (pehle admin-doc na ho to koi bhi email-admin chal jata tha).
- tests/security-rules.test.js me naye cases (emulator me chalana baaki hai).

## Abhi BAAKI (client code badalna padega, sirf rules se nahi hoga)
- Global collections bina instituteId ke: pdfDrafts, deletedTests, deletedQuestions, seedExclusions, draftQuestions, qchunks (root), omrTemplates, app_settings, appSettings — kisi bhi admin ko dikhte hain.
- students/{mobile} `get`, tests `read`, studentRecords `read` signed-in (anonymous) ko khule hain; config/privacy ke lockdown flags ON karne zaroori hain.
- Purane docs jinme instituteId field nahi, unpar legacy fallback abhi bhi hai.

## v288b — purane APK releases auto-delete
- build-institute-apk.yml / build-owner-apk.yml / build-android.yml: naya signed APK release banne ke baad usi ke purane releases (aur tags) automatic delete. Sirf latest rehta hai. Institute ke liye sirf usi institute ke (inst-<slug>-bN) delete hote hain, doosre institute ke nahi.
- Ye workflows tabhi apply hote hain jab .github/workflows GitHub par upload ho (WORKFLOW_PAT na ho to GitHub me khud edit karein).

## v288c — tez APK download
- push-worker/worker.js: naya route GET /apk/<tag>/<file>.apk (GitHub release ko Cloudflare edge se stream+cache) aur /apk/ping. Worker REDEPLOY zaroori (Cloudflare dashboard > Quick edit > paste > Deploy).
- download.html + app-update.js: pehle /apk/ping check; worker ready ho to tez link, warna seedha GitHub (purana). Isliye pehle worker deploy karein, phir site.

## v288d — download 100% par atakna
- Chrome Custom Tab (Browser.open) me APK download poora hokar bhi 'Downloading…' par ruk jata tha. app-update.js / owner-panel.js ab link ko system browser me kholte hain (location.href -> Capacitor ACTION_VIEW).

## v288e — APK proxy: galti par seedha GitHub
- download.html / app-update.js ab proxy URL ko pehle HEAD se check karte hain; theek na ho to seedha GitHub link. Worker ke error message me ab exact path dikhta hai.

## v288f — website Custom Tab me khuli ho to bhi asli Chrome me download (Android par hamesha chrome intent).
