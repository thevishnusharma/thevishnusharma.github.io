# v133 — Cross-Institute Admin Isolation Fix

Consultant ke security audit ke 🔴 CRITICAL #2 aur uske se related 🟡
items ka fix. `firestore.rules` mein.

## Kya fix hua (poori tarah, live app tod ke nahi)

`isAdmin()` pehle sirf "koi active admin hai" check karta tha — target
STUDENT us admin ke apne institute ka hai ya nahi, ye kabhi verify nahi
hota tha. Naya `studentBelongsToAdmin(mobile)` helper ye gap band karta
hai (target student ke `students/{mobile}.instituteId` ko admin ke
`adminInstituteId()` se compare karke), aur ab in sab jagah lagta hai:

- `studentSecrets/{mobile}` — read/update(admin-reset)/delete. Isse
  "Institute A ka admin, Institute B ke student ka password reset
  karke uske account mein login kar le" wala poora scenario band hota
  hai.
- `students/{mobile}` — delete + list (list ab sirf apne institute +
  institute-less legacy students tak).
- `studentMistakes/{mobile}` — delete.
- `studentScanReports/{docId}` — create/update/delete (doc ke `mobile`
  field se check, kyunki doc-id yahan mobile nahi hai).

Backward-compat: agar target student ka koi instituteId set hi nahi
hai (bahut purana, multi-institute se pehle ka), to allow rehta hai —
koi turant lock-out nahi.

## `students/{mobile}` update bhi tighten kiya (audit item #3)

Pehle `isSignedIn()` — koi bhi student kisi ka bhi naam/institute/class
badal sakta tha. Ab bina-proof self-update sirf in fields tak: `photoDataUrl,
hasPin, hash, pinHash, streakCount, lastActiveDate` — app ke saare
CURRENT student-side flows (DP photo, PIN set, login-migration
cleanup, streak) inhi fields ko chhoote hain, maine poora script.js
grep karke verify kiya hai. `name`/`instituteId`/`classId`/`mobile`
badalna ab sirf admin (apne hi institute ke student ke liye) kar sakta
hai — jaise "Proof Update" form se.

Side-effect: `loadStudentsDirectory()` ka "force full refresh" branch
(`t.collection(STUDENTS_COLLECTION).get()` bina filter) hata diya hai
— ab hamesha `fetchInstituteScopedStudents()` use hota hai, kyunki
naye institute-scoped `list` rule ke saath wo unfiltered call fail ho
jaata.

## Jaanbujhkar NAHI fix kiya — audit #1 aur #4

`studentRecords`/`studentScanReports` ka platform-wide `list` leak
(audit #1, sabse CRITICAL) aur `tests` ka cross-institute read (#4)
is file mein FIX NAHI kiye — dono ek hi wajah se: student login
Firebase Auth se bahar hai (sirf mobile+password, anonymous auth se
sign-in), isliye Firestore Rules ke paas koi trusted signal hi nahi
hai ye verify karne ke liye ki "ye signed-in visitor WAHI mobile ka
malik hai jiske records mang raha hai" — jabki ADMIN ke liye ye signal
hai (`request.auth.token.email`, real Firebase Auth), isliye #2 poori
tarah fix ho saka.

`list ko isAdmin() tak simit karo` (jo consultant ne suggest kiya)
literally apply karne se `loadMyTestAttempts`, "My Result", "My
Progress", aur "My Paper Exam Results" — ye CHAARO student-facing
screens turant `permission-denied` denge, kyunki sab `.where('mobile',
'==', ...)` list query par depend karte hain.

Real fix (in dono ke liye) — 2 raaste, dono is file ke scope se bahar
(bade, alag se plan karne wale kaam):
1. **Student records ko `students/{mobile}/records/{id}` subcollection
   mein restructure karna** + admin-only `collectionGroup` rule bulk
   queries (recompute scores, records panel, duplicate-mobile
   detection) ke liye. Rules-only nahi — saare `studentRecords`
   read/write call-sites (script.js mein ~15+ jagah) rewrite karne
   padenge, PLUS maujooda saare records ko naye path par migrate karna
   padega (data migration script chahiye, live scale par).
2. **Real per-student auth** (jaise Phone OTP) — permanent, sabse
   pakka fix, jaisa consultant ne khud bhi bataya.

Chat mein isi baare mein detail discuss kiya gaya hai.

---

# v134 — Institute Join Code: client-side-only bypass fix

## Bug jo report hua tha

Student registration ke waqt, institute select karne par, uske Join
Code ke bina hi account ban ja raha tha (jabki wo institute Join Code
protected tha).

## Root cause

v132 ka poora Join Code enforcement **sirf CLIENT-SIDE JS mein** tha:
`registerStudent()` sirf TABHI `instituteJoinCodeChecks` mein guess
likhta (aur verify karwata) tha jab uska ek-baar-cache kiya hua
`_registerInstitutesCache` list bolta ki `requiresJoinCode: true` hai.
Agar ye cache stale ho (admin ne code ABHI ON kiya, student ka browser
purana list already load kar chuka), ya koi bhi timing/edge-case ho
jahan ye client-side check skip ho jaaye — poora verification step
hi chhoot jaata tha, aur `students/{mobile}` doc bina kisi rules-level
gate ke seedha ban jaata tha (uski `create` rule sirf `isSignedIn()`
thi, Join Code ke baare mein bilkul anjaan).

Matlab: security 100% client ke "acche behave karne" par depend karti
thi — jo hamesha guaranteed nahi hota.

## Fix

1. **`students/{mobile}` ka `create` rule ab server-side, khud
   verify karta hai**: agar target institute ka `requiresJoinCode ==
   true` hai, to registration sirf tabhi allow hota hai jab ek matching,
   RECENT (30 min ke andar) `instituteJoinCodeChecks/{mobile}` doc
   exist karta ho, jisme sahi code already verify ho chuka ho.
2. `instituteJoinCodeChecks` ka doc-ID auto-generated (`checkId`) se
   badal kar `{mobile}` kar diya — taaki upar wala rule ise
   deterministically dhoond sake.
3. `registerStudent()` (script.js) ab is naye mobile-keyed doc par
   likhta hai; aur agar account-creation server-side reject ho (stale
   client-cache ki wajah se check step chhoot gaya ho), to ab clear
   "Ye institute Join Code se protected hai" message dikhta hai —
   pehle generic "Registration fail hua" milta tha.
4. `loadRegisterInstitutes()` ka forever-cache hata diya — register
   panel har baar khulne par institute list (aur uske
   `requiresJoinCode` flag) fresh fetch karta hai, taaki naya-ON-kiya
   code turant dikhe, admin ke bharose sirf server-side rule par na
   rehna pade.

Ab bhale hi client JS mein koi bug ho ya koi console se seedha
Firestore call kare — bina sahi code ke `students/{mobile}` create
nahi ho sakta, jab tak institute ka Join Code ON hai.
