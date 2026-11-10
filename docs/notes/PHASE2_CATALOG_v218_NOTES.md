# Phase 2 — Catalog (v218, web 1.4.13)

## Deploy (is order me)
1. Firebase Console -> Firestore -> Rules: `firestore.rules` paste -> **Publish** (naya `catalog` rule).
2. Zip ko GitHub `updates/` folder me upload karo (Actions "Apply update zip" chalega).
3. **Admin ek baar app khole** (Batch Management). Isse sab batches ka catalog apne-aap ban jata hai. Tab tak students ko purana tareeka chalta hai (kuch nahi tootta).

## Rollback
`app-config.js` me `catalog: false` (turant purana tareeka) ya GitHub me commit Revert. Catalog docs rehne se kuch nahi bigadta.

## Phone par test checklist
- Admin: Batch Management kholo, 1 naya note publish karo -> student (doosre phone) me refresh (🔄) par naya note aaye.
- Admin: item unpublish / delete -> student list se gayab.
- Admin: Go Live (YouTube link) -> student ko "Live Now / Join" dikhe, Join par embed khule.
- Student: recording "Play" -> file/link khule (pehli baar 1 extra read lagta hai, normal).
- Admin: subject ka naam badlo -> student me subject ke andar content sahi dikhe.
- Institute Settings -> "Catalog dobara banayein" -> toast "Catalog ban gaya".
- Firebase Console -> Firestore -> batch -> `catalog` collection me `c1` doc dikhe, usme links nahi.

## Dhyan do
- Catalog "likhne ke baad" sync hota hai (atomic nahi). Agar admin item badalte hi tab band kar de, to student ko purani list tab tak dikhegi jab tak admin panel dobara na khule ya koi aur badlaav na ho.
- Tests aur assignments catalog me nahi hain; unke apne collections hain aur wo pehle jaise chalte hain.
- Reads ke andaaze (naape nahi): 1000 items, 300 students, din me 3 badlaav: pehle ~900k reads, ab ~4k. Free-tier limits maine live verify nahi kiye.
- Chalaya nahi: `npm run test:rules` (emulator), phone/browser UI.
