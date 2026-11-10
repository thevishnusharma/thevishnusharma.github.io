# v234 — "Mera apna app" branding (web 1.4.21, build 230)

## Kya badla
1. **Student header** (Home ke upar): ab institute ka logo + naam + chhota "Powered by SnapTest Pro".
   Logo na ho to naam ka pehla akshar (brand rang me). Owner ne "Powered by chhupayein" kiya ho to tagline.
   Branding na mile to purana SnapTestPro look.
2. **Admin Welcome**: neeche wali instruction line hata di. "Welcome, ▓THE VISHNU SHARMA▓ 👋" jaisa tha waisa.
3. **About screens** (student More → About App, student Settings → About, admin Settings → About + App & Data card): institute logo/naam + Powered by.
4. **Batch screen** side-logo: institute logo/naam. Batch Tests text me "SnapTest Pro" hata kar neutral text.
5. **Admit card**: institute naam na ho to fallback ab SnapBrand naam (nahi to purana).
6. **Foreground notification banner**: title na ho to institute ka naam.

## Speed
Sab kuch localStorage ke cached branding se (`SnapBrand.ident/logoHtml/paintHeader`). Naya Firestore read nahi.
Header paint idempotent hai (same data par DOM nahi chhedta).

## Files (upload karein)
branding.js, app-ui.js, app-ui.css, index.html, student-settings-pro.js, admin-settings-pro.js,
batch-system.js, admit-card.js, native-push.js, sw.js, app-config.js, version.json
+ tests/unit/test_brand_header_v234.js (optional)

## Check
- `node --check` sab JS par OK. Nayi test 8/8 pass.
- Poori unit suite: koi naya fail nahi. 2 purane fail (test_apk_brand_v222, test_branding2_v221 — owner-panel.js check) pehle se the, is change se nahi.

## Abhi bhi "SnapTest Pro" (jaan-boojhkar nahi chheda)
Install-app popup title (index.html), privacy/terms pages, Owner panel, Android app ka naam/icon (APK me), server se aane wale push ke title.
