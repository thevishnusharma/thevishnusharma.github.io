# Phase 5 (v223) — Wo features jo institute ko bechne mein madad karte hain

Version 1.4.18 / build 223. Base: v222 zip (`snaptestpro_github_io-main__5_.zip`).
Pichli session ki Phase 5 files container me bachi nahi thi, isliye sab kuch is zip par nayi se likha gaya hai.

## Kya badla

**5A — Topper card + Parent report**
- `topper-card.js` (`SnapTopper`): top-3 ka canvas image (1080x1350), institute ka naam + brand rang, Download aur Share (device share sheet, nahi to download). Sab text canvas par, HTML injection ka khatra nahi.
- `parent-report.js` (`SnapParentReport`): marks, rank, sabse kamzor chapter (kam se kam 2 attempts) ka Hinglish message. Copy aur "WhatsApp kholo" buttons. Auto-send nahi. Galat parent number par WhatsApp button band.
  - Attendance abhi nahi jodi (har student ki alag query chahiye). Builder me jagah hai.

**5B — Anti-cheat + Analytics**
- `anti-cheat.js` (`SnapAntiCheat`): timed test (non-practice) me `visibilitychange` se tab/app switch ginti aur bahar bita samay. Sirf record, koi rok nahi. `script.js` ke `saveRecordOnline` me ek line: result me `antiCheat: {switches, awaySec}` jud jata hai. Practice par kuch nahi.
- `admin-analytics.js` (`SnapAnalytics`): class average, sabse galat 10 sawal (kam se kam 3 attempts), chapter-wise sahi %, 14 din se inactive students, tab-switch wale attempts. Sirf already loaded records par; koi naya query nahi.
- `result-tools.js` (`SnapResultTools`): Records hub me naya "📊 Result Tools" card (script se banta hai, `index.html` me koi markup nahi). Andar 3 tab: Topper, Parent, Analytics. Records ke purane sub-tabs nahi chhedte; `showRecordsSubTab`, `backToRecordsHub`, `showAdminTab` ko wrap karke hamara box chhupaya jata hai.

**5C — Fee Due**
- `fee-due.js`: Batch Admin me "💰 Fee Due" section (`SnapBatch.ext.adminViews`, batch-system.js nahi badla).
  - Pending = batch ki fee > 0 aur `members/{mobile}.paid` < fee.
  - Batch par optional due date `feeDueDate` (YYYY-MM-DD). Ye batch doc ka naya optional field hai; rules me batch update pehle se admin ko any-field allow karta hai.
  - Per-student "💬 Reminder" (wa.me link, auto-send nahi), "✅ Mil gaya" (cash: `paid = fee`).
  - "📣 Batch ko notification": `institutes/{i}/notifications/fee_<batchId>_<dueDate>` ek create-only doc hai, isliye ek due date par sirf ek baar. Push `SnapPush.send` se.
  - Cloud Functions nahi, isliye bhejna admin ke button se hota hai. Due date 3 din ke andar ho to banner dikhta hai.
  - Online UPI payments ka `payments` flow nahi chheda (cash entry me `payments` doc nahi banta).

**5D — Daily challenge + revision**
- `daily-challenge.js` (`SnapDaily`): student dashboard par "🌟 Aaj ka Challenge" (5 sawal, date + mobile se fixed; same din same sawal) aur "🔁 10 galti revision" (`studentMistakes/{mobile}` se 10 random).
  - Challenge ka result Firestore me save nahi (roz ke writes na badhen). Streak aur "aaj ho gaya" flag sirf is device (localStorage). Phone/browser badalne par reset.
  - Card tabhi dikhta hai jab "Practice" card dikh raha ho.

**Wiring**
- `index.html`: 7 nayi `<script defer>` tags (`batch-v169.js` ke baad, `script.js` ke baad).
- `sw.js`: 7 nayi files precache mein; `CACHE_NAME` = `snaptestpro-v223`.
- `app-config.js`: kill-switches `topperCard`, `parentReport`, `antiCheat`, `analytics`, `resultTools`, `feeDue`, `dailyChallenge` (sab `true`). Har ek `false` par us feature ka purana behaviour (feature hi nahi jurta).
- `version.json`: 1.4.18 / 223; `npm run stamp` ne `sw.js`, `app-config.js`, `package.json` sync kiye.
- `firestore.rules`: **nahi badle** (sha256 pehle jaisa). Naye fields (`antiCheat`, `feeDueDate`, `paidAt`, `paidBy`, notification type `fee`) rules me pehle se allowed hain — verify kiya, emulator par nahi.

## Firestore free-tier hisaab (100 institutes par)
- Anti-cheat: 0 extra read, record write me 2 chhote fields.
- Result Tools: loaded records par; sirf test chunne par `ensureFullRecordsForTest` (ek test ka query, cache hota hai).
- Fee Due: batch chunne par us batch ke members ki ek list (`members` get). Admin ke liye hi.
- Daily challenge: 5 sawal local bank se, 0 read. Revision: 1 read per click.
- Notification: batch + due date par 1 write.

## Tests
- Naya `tests/unit/test_phase5_v223.js`: ranking/ties, parent weak chapter + WhatsApp URL, analytics (avg, galat sawal, chapter, inactive, tab-switch), anti-cheat (ek hi consume, switch ginti, kill-switch), daily (deterministic, streak), fee (pending, days left, notif id), wiring (index, sw, config, load order), innerHTML-static check.
- `npm test`: **40/40 passed** (pichle v222 ke 39 + naya 1). Ye chala.
- `node scripts/stamp-version.js --check`: in sync. `npm run build:www` + `npm run check:precache`: pass (103 entries).
- `scan-secrets.js`: **chala nahi** (git repo nahi hai sandbox me). Badli files par manual grep kiya: kuch nahi mila.
- **Nahi chala:** Firestore emulator (`test:rules`) — rules nahi badle; asli phone, Firebase, canvas download/share, Android APK build.

## Deploy steps (phone se)
1. GitHub par repo khol kar `main` branch me yeh files upload/replace karein (sirf neeche ki list wali; `www/` aur `node_modules/` nahi).
2. Commit message me `[notify:all]` mat dalein jab tak phone test na ho jaye (warna sabko update notification chala jayega).
3. Pages deploy hone ke 2-3 minute baad web app kholein, purane cache ke liye Settings → "Cache saaf karke refresh".
4. Firestore rules: **kuch nahi** (nahi badle). Cloudflare Worker: **kuch nahi**.
5. Android APK: is version me APK build zaroori nahi (web-only features). Institute APK chahiye to baad me "build-android" workflow.

## Rollback
- Turant: `app-config.js` me `resultTools`, `feeDue`, `dailyChallenge`, `antiCheat` ko `false` karke push — feature chhup jaate hain, purana behaviour.
- Poora: is commit ko Revert karein. `sw.js` ka cache naam badalne se users ko naye files milengi; revert par purani files.

## Phone test checklist (main kya dabakar kya dekhun)
1. **Records → Result Tools** card dikhe. Test chunein → Topper tab par card dikhe, "⬇️ Download" se PNG save ho, "📤 Share" share sheet khole.
2. **Parent tab**: student chunein → message dikhe (naam, marks, rank, weak chapter). "📋 Copy" → WhatsApp me paste karke dekhein. "💬 WhatsApp kholo" → sahi parent number par chat khule, khud bhejien (auto-send nahi).
3. **Analytics tab**: class average, galat sawal, chapter list, inactive list, tab-switch list dikhe. Koi "undefined" ya khaali box nahi.
4. **Timed test** (practice nahi) do-teen baar tab/app badlein, phir submit karein. Result ke baad Analytics → "Tab/app switch" me wo student dikhe. Test band nahi hona chahiye.
5. **Batch Admin → 💰 Fee Due**: fee wale batch par pending list dikhe. Due date daalein → Save. "💬 Reminder" wa.me khole. "✅ Mil gaya" → confirm → wo student list se hat jaye.
6. "📣 Batch ko notification" → confirm → toast. Dobara dabane par "pehle hi bhej chuke" wala message aaye. Student app me notification dikhe.
7. **Student dashboard**: "🌟 Aaj ka Challenge" card dikhe. Shuru karein → 5 sawal. Submit ke baad card "✅ Ho gaya" dikhaye, streak 1.
8. "🔁 10 galti revision" → mistakes hon to 10 sawal; na hon to "bahut badhiya" message.

## Known limitations (saaf likhna zaroori)
- Anti-cheat: test beech me app band karke dobara kholne par tracking reset (resume par beginExam nahi chalta). Ye "halka record" hai, pakka proof nahi.
- Analytics "inactive" list admin ke loaded records par tiki hai; kuch active students bhi dikh sakte hain.
- Daily streak device-only hai. Challenge complete hone par streak code-level par verify hua hai: `script.js` `showResult` `window.SavyaExtras.onTestSubmitted({student,testTitle,details,isPractice})` runtime par call karta hai, aur daily-challenge us property ko wrap karta hai. Phone par ek baar dekhna phir bhi zaroori hai.
- Parent report me attendance nahi.
- Fee: online UPI payment ka `payments` record cash entry me nahi banta. Notification Cloud Functions ke bina admin ke button se.
- Records ke Back button (back-button-guard) Result Tools box ko nahi pehchanta; Records ke andar back dabane par hub par jata hai, Result Tools pe nahi.

## Code-level verification (addendum, bina app chalaye)
Ye sab repo ki files padh kar check kiya gaya; chalaya nahi gaya.
- `script.js` classic script hai (`defer`, module nahi), isliye `beginExam`, `current` (`let`) aur `_fullTestRecordsCache` dusri classic files se dikhte hain. Anti-cheat ka `beginExam` wrap aur result-tools ka `_fullTestRecordsCache` read dono yahi par tike hain.
- Real test shuru hona `beginExam()` ke bare-identifier call se hota hai (`confirmSubmit`/start flow), isliye window par reassign kiya hua wrapper use hota hai.
- Submitted record mein `testId: current.testId` aur `testTitle` hain; anti-cheat `consume(e.testId)` isi se milata hai.
- `window.SavyaExtras={onTestSubmitted: we, ...}` `student-features.js` mein hai; `we({student,testTitle,details,isPractice})` ka signature daily hook se mel khata hai.
- Naye code ke sabhi global naam (`ensureFullRecordsForTest`, `getCurrentAdminInstituteId`, `allStudentsCache`, `getStudentClassScopedQuestionBank`, `isValidQ`, `cloneQ`, `getStudentSession`, `getDB`, `SnapBrand.plain/cached`, `SnapPush.send(id, payload)`, batch ctx helpers `authReady/toast/sure/bref/DB/FV/adminEmail/audit`) repo mein maujood hain.
- `studentMistakes/{mobile}` ka shape `{mobile, items}` hai; revision code isi se padhta hai.
- Firestore rules is version mein nahi badle. Emulator regression ke liye `npm run test:rules` hai (`firebase-tools` aur Java chahiye; sandbox mein nahi chala).
