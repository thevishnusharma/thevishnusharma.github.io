# Batch Management — Phase 2 (v168): Master-prompt status

Naya code: `batch-phase2.js`, `student-session.js`, `bm` hooks in `batch-system.js`, `firestore.rules`, `storage.rules`, `tests/security-rules.test.js`.
Purana kuch delete/replace nahi hua — sab usi Batch system ke andar plug hota hai.

## Kya ban gaya (section-wise)
| Master prompt | Status |
|---|---|
| 1 Existing app me integrate | ✅ pura code inspect karke usi `SnapBatch` me extension hooks |
| 2 Multi-institute / instituteId | ✅ har naye record par `instituteId` + rules me path-match validation (batch tree) |
| 3 Strict isolation | ✅ **Strict Mode** (per institute) — niche dekhein. ⚠️ sirf Batch system ke data par; purane (tests/results/leaderboard) collections par nahi |
| 4 Admin panel nav | ✅ Dashboard, Batch Mgmt, Live, Recorded, Notes, PPT, Tests & Assignments, Doubt Solving, Students, Teachers, Reports, Institute Settings |
| 5 Batch CRUD | ✅ create/edit/activate/deactivate/**archive**/delete(safe)/search/filter/**Batch Image** |
| 6–7 Student My Batches + Batch Dashboard | ✅ progress bar, live/next class, announcements, subject cards, teachers, recent recordings & notes, assignments count |
| 8 Subjects (own ID, order, status) | ✅ `batches/{b}/subjects/{id}`; same naam alag batch me alag content. ❌ Subject Image |
| 9 Chapters | ✅ add/edit/delete(safe)/reorder/on-off, har chapter me Live, Recorded, Notes, Study, PPT, Tests, Doubts |
| 10 Live class | ✅ SnapLive (teacher camera/screen+mic, chat, raise hand) + Jitsi + external link. ✅ **attendance** (join par record) |
| 11 Recording auto-save | ✅ **SnapLive** — apna live + auto recording (Jitsi/Zoom ke bina), details `SNAPLIVE_v168_NOTES.md`. R2 bucket + Worker binding chahiye. Limits: one-to-many, Chrome/Android, iPhone nahi |
| 12–13 Notes / PPT | ✅ subject→chapter dropdown (parent-child validated), file ab permanent token-link ke bajay `storagePath` se rules ke baad open hoti hai |
| 14 Tests & Assignments | ✅ Assignments (submit, due, marks, feedback, evaluate) + existing tests ko batch/chapter se link. ❌ Naya per-batch test engine (MCQ/multi/TF/short/long) nahi bana — maujooda test engine use hota hai |
| 15 Doubts | ✅ student ask (text+photo), apne doubts, admin answer/status/delete |
| 16 Enrollment | ✅ pehle se (approve/remove/enroll) — cross-institute silent transfer nahi |
| 17 Teachers | ⚠️ profile + batch/subject assign + permission flags (batch par naam sync). ❌ **Teacher login / restricted panel nahi** — Rule 3 (teacher sirf assigned batch) server par enforce nahi hota |
| 18 Edit/Delete + audit | ✅ confirm + safe-delete guards (content/submissions ho to block) + auditLogs |
| 19 DB design | ✅ Subjects, Chapters, Doubts, Assignments, Submissions, Attendance, Progress, Teachers, TestLinks, StudentSessions. Queries single-field (composite index nahi chahiye). ❌ Pagination (students list 500 limit) |
| 20 Firebase | ✅ Firestore + Storage rules. ❌ Cloud Functions (free-tier ke liye jaan-boojh kar nahi) |
| Reports | ✅ batch summary, class-wise & student-wise attendance, CSV export |

## Security kaise kaam karta hai (Strict Mode)
Pehle student anonymous-auth the, isliye rules "ye kaun hai / kis batch ka member" verify nahi kar sakte the.
Ab student login par `studentSessions/{authUid}` banta hai; rules khud check karte hain ki bheja gaya password-proof
`studentSecrets/{mobile}.hash` se match karta hai (wahi login-proof tareeka). Phir:
- batch content/files/recordings/subjects/assignments — sirf `members/{mobile}` wale student ko
- doubts & submissions — sirf apne mobile ko (doosre student/doosre institute/doosre admin ko nahi)
- doosre institute ka student/admin kuch read/write nahi kar sakta
- attendance: `v` field rules khud set-check karte hain (verified ya nahi)
- Storage: path `batches/{inst}/{batch}/…` par admin sirf apne institute me upload; padhna strict me sirf member/admin

### Rollout (zaroor is order me — warna students ko dikkat aayegi)
1. `firestore.rules` Firebase Console → Firestore → Rules → Publish. `storage.rules` → Storage → Rules → Publish (cross-service "Grant access" prompt Allow).
2. Naya app/web files deploy; students ek baar **logout → login** karein (verified session banta hai).
3. Admin → Batch Management → **Institute Settings → Strict Mode ON**. Kuch bigde to wahin OFF = purana behaviour turant wapas.
Default OFF hai — rules publish karne se kisi ka login/access nahi tootta.
Known: naya register hua student jab tak ek baar login na kare uska session nahi banta; session-less student ko strict me "dobara login karein" dikhta hai.

## Tests
`tests/security-rules.test.js` (admin A≠B, student A≠B, unenrolled, session proof, doubts/submissions privacy, attendance, storage, legacy-OFF).
Chalane ke liye: `npm i -D firebase-tools @firebase/rules-unit-testing firebase` → `npm run test:rules` (Java chahiye).
⚠️ Ye mere sandbox me CHALAYE NAHI GAYE (emulator download blocked). Rules + tests dono pehli baar aap chalayenge — fail aaye to bata dein, theek kar dunga.
Jo mere yahan chala (Chromium + in-memory Firestore mock): admin & student ka poora UI flow, import, validations, delete-guards, strict toggle, progress — 0 JS errors.
