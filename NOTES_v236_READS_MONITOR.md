# v236 — Owner Panel "Reads Monitor" (build 236)

## Naya
- `read-tracker.js` — app/admin/owner ke Firestore reads ginta hai (get + onSnapshot), Worker `/readlog` par bhejta hai. Kill-switch: `readTracker:false`.
- `owner-reads.js` + Owner App me naya **Reads** tab — graph, jhatke (tap = poora karan), role/collection/function@line/institute/build-wise, Firebase asli number se mel.
- `push-worker/worker.js` — `/readlog` (Firebase token zaroori), Worker ke apne reads ki ginti, `/owner/reads/summary|detail|actual`, cron me label + 14 din ki safai. `googleAccessToken` ab scope-wise cache.
- Docs: `docs/READS_MONITOR.md` (setup: D1 `READS_DB` binding + Monitoring Viewer role).

## Badli files
read-tracker.js, owner-reads.js, owner-app.html, owner-ui.js, index.html, question-generator.html, push-worker/worker.js, sw.js, scripts/build-www.js, app-config.js, version.json, package.json, docs/READS_MONITOR.md, tests (3 naye)

## Jo karna hai
1. Cloudflare par D1 + `READS_DB` binding + naya Worker code (guide dekhein) — iske bina Reads tab khaali rahega.
2. Naya build deploy (sw cache v236). Owner App ka APK dobara banana padega (Reads tab uske andar hai).

## Check
node --check OK, check-precache OK (101), stamp in sync, unit tests 51/51 (naye: test_read_tracker_v236, test_worker_reads_v236, test_owner_reads_ui_v236).
Browser/phone me chalakar nahi dekha.

## v237 (build 237)
- read-tracker.js: Owner APK me (page = index.html) owner ke reads "student" ginte the. Ab `ownerGetAuth`/`owner-panel-box` se role "owner" pehchanta hai. Test joda.

## v238 (build 238)
- Tracker ab user bhi bhejta hai (admin/owner email, student mobile+naam). Worker: nayi table `reads_user` (5 min bucket), `/owner/reads/user`, summary me `byUser`, detail me `users`.
- Owner panel: "Kaun kaun (ID wise)" list + ID par tap = collection-wise; sabse bada jhatka auto-khulta hai; "Kyu aaya?" box saral bhasha me. Purani app (8-field rows) bhi chalti rahegi.
- Worker code dobara deploy karna padega (naya table apne-aap banta hai).

## v239 (build 239)
- Free (Spark) plan par Monitoring API billing maangti hai: Worker ab 402 "BILLING" deta hai, panel me "haath se mel" box (Console ka number likho -> gap %).

## v240 (build 240) — Records ke reads kam
Reads Monitor ke data se (1 ghante, admin): studentRecords 102 (loadFakeMobileGroups@script.js:496 = 71, count-chunks 24), students 40 (fetchInstituteScopedStudents).
- "Fix mobile" tool ab bina button dabaye poora studentRecords scan nahi karta (pehle sub-tab kholte hi scan).
- Students directory ki list 5 minute tak dobara Firestore se nahi padhi jaati (record delete/fix par turant naya padhta hai). Naya student 5 minute tak list me na dikhe to ye wajah hai.

## Charts (v240 ke saath)
- docs/diagrams/SYSTEM_MAP.png + DATA_MAP.png (+PDF), generator scripts/make-diagrams.py. build-www.js me `diagrams` folder APK se bahar.
