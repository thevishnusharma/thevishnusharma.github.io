# v170 — Read Diet: Firestore reads 20–50 guna kam + push/live Firestore quota par nirbhar nahi

## Reads kahan se kharch hoti thi (code analysis)
1. Student Batch page: har open par batch ke SAARE published items + saare available batches + har batch ka request doc + payment doc.
2. Tests ka live listener: 30 min se purana ho to har open par saare tests dobara gine jaate the.
3. Bell: har baar 30 notification docs.
4. Worker: har push par 2 Firestore reads, aur SnapLive ke har segment (3 sec) / file call par admins doc ka 1 read. Read quota khatam => push + live bhi band.
5. Admin ka loadAll: har action ke baad SAARE batches ke SAARE items dobara.

## Ab kya hota hai
- Admin kuch badalta hai (item, test, notification, batch) => `institutes/{inst}/ver/main` doc me ek number badalta hai (apne-aap, ek chhota write).
- App pehle sirf wo 1 doc padhta hai (45 sec memo). Number wahi hai to phone ka cache (0 reads); badla hai to sirf tab data dobara.
  - Student batch items, available batches, tests list, bell => version-gated.
  - Request-status aur payment doc ab tabhi padhe jaate hain jab student "Available" tab kholta hai.
  - Tests: Firestore ke local cache se (0 reads); naya test aane par ek baar server se. Push aate hi / app wapas khulte hi refresh.
  - Admin loadAll: sirf badle huye batch ke items dobara.
- Worker: admins doc 10 min cache (24 ghante tak stale-ok); push ab payload ke saath => notification doc padhna nahi. Reminder cron bhi bell ko ver se batata hai.
- Student batch page par naya 🔄 (force refresh). Safety: cache max 4 ghante (admin 30 min); ver doc na mile/offline => cache; fail => purana tareeka.
- Kill-switch: `SNAP_CONFIG.readDiet = false`.

## Deploy order (zaroori)
1. **firestore.rules publish PEHLE** (`ver/{doc}` ka rule jud gaya).
2. `worker.js` Cloudflare me paste -> Deploy.
3. GitHub par saari files upload (naya: `read-diet.js`).
4. Admin ek baar naye app me login kare (uske badlaav se ver bantey hain). Purane admin app se kiye badlaav students ko max 4 ghante me dikhte hain.

## Dhyan rakhein
- Admin ke ek badlaav ke baad student ko turant dikhne ke liye wo app khole ya 🔄 dabaye / push aaye. (Pehle ki tarah live listener nahi hai.)
- Owner jiska institute id nahi hai, uske badlaav ver nahi badlate (students ko <=4 ghante me dikhega).
- Reads ka alert (40k par) nahi joda — abhi 📊 read-meter per-device hi hai.
- Spark quota har din ~12:30 PM IST par reset hota hai.

## Files
Naya: `read-diet.js`. Badle: `batch-system.js, script.js, app-ui.js, native-push.js, admin-notify.js, batch-v169.js, worker.js (+push-worker/worker.js), firestore.rules, index.html, sw.js`.
