# v236 — Admin dashboard se 📊 Read-Meter hata diya (build 232)

## Kya hata
- `read-meter.js` poori delete (dev-only reads counter, dashboard par 📊 button + dark panel).
- index.html se script tag, sw.js precache se entry hata di. Firestore get/onSnapshot par wrapper bhi band => thoda halka.

## Panel ki cheezein kahan gayi
- Bank refresh  -> Admin Settings -> Data (pehle se tha)
- Bank publish  -> Admin Settings -> Data (pehle se tha) + AUTO: question change ke ~45 sec baad apne-aap
- Bank export   -> Admin Settings -> Data me NAYA row "Bank backup (export)"
- Reads table / Reset -> hata (admin ke kaam ka nahi)

## Files
index.html, sw.js, admin-settings-pro.js, version.json, app-config.js (+ read-meter.js delete)

## Check
node --check OK, check-precache OK (99 entries), unit tests 44/46 (2 purane fail same: test_apk_brand_v222, test_branding2_v221).

## v237 (sirf packaging)
- Zip me ab `.github/workflows/` ki 6 files hain (build-institute-apk, build-owner-apk, build-android, announce-update, ci, auto-extract).
- auto-extract.yml naya: repo secret `WORKFLOW_PAT` ho to zip ke saath workflows bhi extract+push hote hain; na ho to pehle jaisa (.github skip).
- DELETE_THESE.txt me read-meter.js joda (zip se file delete nahi hoti, GitHub par haath se delete karo).

## v238 (build 233)
- owner-panel.js: Branding box me checkbox '"Powered by SnapTest Pro" chhupayein' (hidePoweredBy). Save par institute doc me likhta hai, cache (snap_brand_<id>) saaf hota hai. Rules me badlav nahi (owner ko write pehle se hai).
- Unit tests ab 46/46 (test_branding2_v221 pass) => CI green hona chahiye.

## v239 (build 234) — master-prompt Batch 1+2
- package-lock.json (lockfileVersion 3) + CI/APK workflows `npm ci`; Actions SHA-pinned.
- ci.yml: JS syntax check (sab .js/.mjs) + alag `rules` job (Firebase emulator, Java 17).
- Worker: App Check verify (APPCHECK_MODE off|monitor|enforce, default off) + client header (firebase-config.js). Docs: docs/APP_CHECK.md
- Display brand "SmarTest Pro" (technical IDs untouched): docs/BRAND_NAME_INVENTORY.md
- A11y: axe-core scan, serious=0 (owner-app boot contrast, index heading order, offline main landmark)
- Tests 48/48 (naye: test_worker_appcheck, test_appcheck_fetch; 5 brand tests ki naam-expectation naye naam par)

## v240 — rules CI job fix
tests/security-rules.test.js: ek context par firestore() 3 baar (line ~94) => "Firestore has already been started". Ab ek baar; storage() bhi memoized. Koi assertion nahi badli/hataayi.
