# v121 — "Welcome, Admin" flash fix (coaching ka naam turant dikhna)

## Problem
Admin login karte hi heading pehle "Welcome, Admin 👋" dikhata tha,
phir ek Firestore fetch (`institutes/{id}.get()`) complete hone ke
baad woh text badalkar "Welcome, <Coaching Naam> 👋" ho jaata tha —
matlab har baar ek visible flash/delay hota tha.

## Fix — localStorage cache + instant paint
1. Naya localStorage key (`savya_admin_institute_name`) — jab bhi
   asli naam Firestore se successfully fetch hota hai, wahin cache ho
   jaata hai.
2. Naya function `paintAdminWelcomeInstant()` — bilkul SYNCHRONOUS
   (koi await/fetch nahi), sirf localStorage se cached naam padh kar
   heading turant bhar deta hai. Yeh admin-panel dikhte hi (login ke
   turant baad, session-resume par, ya ?admin=1 deep-link par — teeno
   jagah) sabse pehle call hota hai, `startAdminSyncs()` (jo asli
   Firestore fetch shuru karta hai) se bhi PEHLE.
3. `renderAdminWelcomeInstituteName()` (asli Firestore fetch) ab sirf
   naam confirm/update karta hai — agar naam mil jaaye to cache update
   karke heading set karta hai; agar na mile (offline / pehli-hi-baar
   login) to heading ko chheda hi nahi jaata — jo pehle se (cache ya
   neutral) dikh raha hai wahi rehta hai. Matlab yeh function ab kabhi
   "Welcome, Admin" par wapas regress nahi karta.
4. Static HTML default (jo admin-panel unhide hote hi sabse pehle ek
   split-second ke liye potentially dikh sakta tha) "Welcome, Admin 👋"
   se badal kar "Welcome 👋" kar diya — "Admin" word kahin bhi, kabhi
   bhi nahi dikhta ab.

## Result
- **Doosri baar se (yaani wahi admin dobara login kare, ya session
  resume ho, ya admin/student tab switch kare)**: heading turant
  (0ms, koi network wait nahi) sahi coaching-naam dikhata hai — koi
  flash/loading nahi.
- **Pehli-hi-baar (bilkul naye device/browser par pehla login, cache
  khaali)**: neutral "Welcome 👋" dikhta hai jab tak asli naam Firestore
  se aa na jaaye (kuch hi second) — kabhi galat "Admin" text nahi
  dikhta, aur naam aate hi seedha sahi naam set ho jaata hai.

## Verify kiya
- `script.js` `node --check` se syntax-clean.
- Teeno jagah jahan admin-panel visible hota hai (naya login,
  same-session tab-switch, `?admin=1` deep-link) — sabhi mein
  `paintAdminWelcomeInstant()` call jodi gayi, `startAdminSyncs()` se
  pehle.
- Poore repo mein `"Welcome, Admin"` literal text search kiya —
  ab sirf comments mein hai (documentation ke liye), kahin bhi
  actual UI string ke roop mein nahi bacha.

## Deploy
Same as pehle — saari files overwrite karke deploy karein (batches
mein ya `git push` se, file-count limit yaad rakhein), phir dobara
admin login karke test karein: pehli baar neutral "Welcome 👋" dikhna
chahiye jo turant naam se badal jaaye, aur dusri baar se seedha sahi
naam turant dikhna chahiye.
