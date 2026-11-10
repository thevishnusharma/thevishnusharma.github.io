# v169 — Batch notifications, Chapter test, batch-wise Start Test, Syllabus + Reminder

## Kya badla (sab 6 cheezein)
1. **"Data online save nahi hua" message** — admin aur student dono se pill/toast/"sab online save ho gaya" hata diya (`offline-sync.js`). Sync background me chalta rahega. (Sirf Settings > Offline & Sync card me status dikhta hai, jab aap khud kholein.)
2. **Batch notifications (app band ho tab bhi)** — Live class schedule / Live shuru / Announcement / Notes / PPT / Study material / Recording publish / Assignment publish / Test juda → sirf us batch ke students ko push + bell me. Per-batch FCM topic `bat_<institute>_<batch>`.
3. **Chapter test** — Subjects & Chapters me har chapter par naya **📝 Test** button: Question Bank se us chapter ke random questions → test ban kar batch/subject/chapter se auto-link. (Draft ya turant publish.)
4. **Start Test list** — chapter ke naam se chips; sirf student ke batch ke tests. Jo test kisi batch se juda nahi = general, sabko dikhta hai.
5. **Syllabus + Upcoming** — Create Test form me **Test Schedule (ab visible tha hi nahi — hidden tha)** + naya **Syllabus** box. Student card par 🔜 Upcoming + syllabus; publish par syllabus ke saath notification.
6. **Reminder** — test se ~24 ghante aur ~1 ghanta pehle syllabus ke saath push (Cloudflare cron).

## Aapko karna hai (is order me)
1. **Firestore rules publish** (`firestore.rules` — notifications me `batchId` allow hua).
2. **Cloudflare Worker**: naya `worker.js` paste → Deploy. Phir Worker > Settings > **Triggers > Cron Triggers > Add** → har 15 minute (`*/15 * * * *`). (Time IST maana gaya; alag ho to variable `TZ_OFFSET_MIN`.)
3. GitHub par saari files upload (naya: `batch-v169.js`).
4. **Pehle ke jude tests**: har batch ka Batch Management > Tests & Assignments ek baar kholein (auto-tag hota hai). Tab tak wo purane tests sabko dikhte rahenge (safe default).

## Dhyan rakhein
- Test ko batch se **Unlink** karne par wo general ban jaata hai (sab students ko dikhega).
- Ek test 2+ batch se juda ho to publish-notification pehle batch ko jaati hai (reminder sabhi batch ko).
- Naye/purane student ka batch-list pehli baar load hone tak batch wale tests hide rehte hain (1-2 sec, cache ke baad turant).
- Chapter test ke liye Question Bank me us chapter ke naam ke questions hone chahiye (naam match hota hai).
- Push app band hone par tabhi aayega jab Worker + FCM setup sahi ho (`PUSH_SETUP_FREE_REALTIME.md`). Mock se verified, real phone par mere yahan se check nahi hua.

## Files
Naya: `batch-v169.js`. Badle: `offline-sync.js, batch-system.js, batch-phase2.js, script.js, index.html, admin-notify.js, native-push.js, app-ui.js, worker.js (+push-worker/worker.js), firestore.rules, sw.js`.
