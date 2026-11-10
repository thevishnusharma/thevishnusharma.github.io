# Reads Monitor (v236) — poori site ke Firestore reads, Owner Panel me

Owner App > **Reads** tab: kab jhatka aaya, kis role (student/admin/owner/Worker) ne, kis collection se, kis function@file:line se, kis app build se.
Saath me Firebase ka asli number (Cloud Monitoring) aur dono ka farak.

## Setup (sirf Cloudflare dashboard, phone se ho jayega — 3 kaam)

### 1. D1 database
Cloudflare > Storage & Databases > **D1** > Create database > naam `snaptest-reads`.
Table apne-aap ban jaata hai (kuch likhna nahi).

### 2. Worker se jodo
Worker > Settings > **Bindings** > Add > **D1 database** > Variable name **`READS_DB`** > `snaptest-reads` chuno > Deploy.
Phir `push-worker/worker.js` ka naya code Worker me paste/deploy karein.
(Binding na ho to sab pehle jaisa chalta hai; Reads tab "READS_DB nahi hai" dikhata hai.)

### 3. Firebase ka asli number (optional; Billing/Blaze plan chahiye)
**Free (Spark) plan par Google Monitoring API band hai** — tab Reads tab me "haath se mel" box aata hai: Firebase Console > Usage ka number likho, gap nikal jata hai. Neeche wale kaam sirf Blaze plan par.
Google Cloud Console > IAM > Worker wale **service account** (jiski JSON `SERVICE_ACCOUNT_JSON` me hai) > Role add: **Monitoring Viewer**.
Cloud Monitoring API usi project me enabled honi chahiye (Console > APIs & Services > "Cloud Monitoring API" > Enable).
Na ho to Reads tab me peela "Firebase ka asli number nahi aaya" dikhega; baaki sab chalega.

## Kya ginta hai
- **App/browser** (`read-tracker.js`): Firestore compat SDK ke `get()` aur `onSnapshot()`. Cache se aaya = 0, doc get = 1, query = jitne doc aaye (kam se kam 1), listener ka pehla server snapshot = poore doc, baad me har badla doc = 1.
- **Worker**: apne Firestore REST reads (push, recount, delete-account, cron). Label = route ya `cron:<kaam>`.
- Har 30 sec me (aur app band/background hone par) chhota batch `/readlog` par jaata hai. Sirf valid Firebase token wale users ka data lete hain.

## Privacy
Owner ke liye user-wise ginti: admin/owner = **email**, student = **mobile + naam** (jo app ke student session me hota hai). Sirf Owner (OWNER_EMAILS) hi dekh sakta hai.
Baaki: waqt (minute), role, institute id, collection ka template (`students/{id}`), function@file:line, ginti, app build.
Doc ka data ya doc ID nahi jaata/rakha jaata.

## "Pura accurate match" — kitna aur kyun thoda farak
Hamari ginti SDK ke andar se hai, Firebase ki ginti server par. Farak ke karan:
1. **Purani app/APK** jisme tracker nahi (Owner Panel me *Build-wise* list me dikh jaata hai).
2. Firebase Console / export / Apps Script / koi aur tool jo SDK se nahi chalta.
3. **Listener resume**: app dobara jude to Firebase kuch listener ke sirf badle docs bill karta hai; hum badle docs hi ginte hain, par kuch halaton me Firebase poora bill karta hai.
4. Cloud Monitoring me 3-5 minute ki der.
Gap 10% se kam ho to hara, warna laal dikhta hai. Laal gap bhi kaam ka hai: wo batata hai ki reads *hamare tracker ke bahar* se aa rahe hain.

## "Kyu aaya" aur "kis ID se"
- Sabse bada jhatka Reads tab kholte hi apne-aap khul jata hai: saral bhasha me karan (kaun sa function, bulk read ya loop, purana build, ek user ya kai users).
- **Kaun kaun (ID wise)** list: admin ka email / student ka mobile, uske kitne reads. ID par dabane se uski collection-wise ginti khulti hai.
- User-wise ginti 5 minute ke bucket me jama hoti hai (D1 ke free writes bachane ke liye), isliye 1 minute ke jhatke ke saath "5 minute ke andar" likha aata hai.
- Table: `reads_min` (karan) + `reads_user` (ID). Dono 14 din baad apne-aap saaf.

## Jhatka kaise pakden
1. Reads tab > range chuno (1 ghanta / 6 / 24 / 7 din).
2. "Jhatke" me waqt par dabayein (ya graph ki bar par): us minute ka poora karan khulta hai — role, collection, function@file:line, build.
3. `syncBank@script.js:NNN` jaisa naam = us function ne padha; wahi line kholkar dekhein.

## Limits / safai
D1 free plan: 100K rows write/din. Bahut zyada ek saath users hon (kai sau) to ye limit chhoo sakti hai; tab D1 ka write fail hota hai par app/Worker normal chalta hai. 14 din se purana data roz cron me hat jaata hai.
Kill-switch (app side): `app-config.js` > `readTracker: false`.
Worker ke reads ka label ek saath aane wali requests me kabhi-kabhi doosre route ka dikh sakta hai (Workers me request-wise context nahi).
