# SnapTestPro v1.1 (build 156) — Release notes

## Naya
- **Admin Settings (app jaisa):** Profile & Institute, Notifications (push status), App & Data (update/cache/bank refresh), Help & Support (Call/WhatsApp/Email + FAQ), About, Privacy & Terms, Logout. (`admin-settings-pro.js`)
- **Owner config:** `app-config.js` — phone, WhatsApp, email, version, FAQ, Privacy/Terms link ek jagah badlo; Student aur Admin dono me dikhta hai.
- **Free background push:** app band hone par bhi students ko notification (Cloudflare Worker + FCM).
- **Question bank auto-publish:** admin ke badlaav par apne-aap Worker/KV par; students ko Firestore reads 0.

## Fix (Firebase rule / permission errors)
- `deletedTests` listener ab sirf admin ke liye (student par "Missing or insufficient permissions" aata tha).
- Question-bank auto-migration (rename/merge) ab sirf admin ke liye (student par rules deny karte the).

## Speed / reads
- Student ko sirf apne institute ke tests (pehle sabhi institutes ke).
- Records ka site-wide live listener sirf admin ke liye.
- Bank 12 ghante local cache; student result 5 min cache.
- Question Generator iframe ab tab load hota hai jab admin use khole (students ke liye download band).

## Owner ko ek baar karna hai
1. Firebase Console → Firestore → Rules → `firestore.rules` ka text paste → **Publish**.
2. Cloudflare: KV `snaptest-bank` + Worker binding `BANK_KV` + naya `worker.js`.
3. `app-config.js` me apni details check karein.
