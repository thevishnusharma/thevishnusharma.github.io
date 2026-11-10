# Changelog

## 2026-10-17 — v222 Phase 4B: institute APK native splash + rang

- Naya `scripts/android-brand.js`: institute APK me native splash (brand rang par logo card, har `splash.png` size me), Android 12+ ka splash rang + icon, status bar / app rang (`colorPrimary/Dark`).
- `fetch-institute.js` ab `brandColor` bhi laata hai (`institute-brand.json`); `android-prepare.js` use try/catch me bulata hai; `capacitor.config.js` ka `backgroundColor` institute ka rang leta hai.
- Workflow, owner APK aur main APK nahi badle (brand file sirf institute build me banti hai). Kill-switch: `app-config.js` me `branding2: false` (ya brand rang na ho) = purana Capacitor default.
- Test: `test_apk_brand_v222.js`. Sandbox me `cap add android` ke baad script chalayi (11 splash.png + styles patch check). Gradle/APK build aur phone par splash chalaya nahi. Version 1.4.17 / build 222. Notes: `docs/notes/PHASE4B_APK_BRAND_v222_NOTES.md`.

## 2026-10-17 — v221 Phase 4A: gehri branding (web)

- Splash: pichli baar ka institute cache me ho to uska logo/naam/tagline/rang (`inline/index-inline-05.js`). Pehli baar / cache na ho to purana splash.
- Login card (student + admin) ke upar institute ka logo + naam + tagline; home ke neeche chhota "Powered by SnapTest Pro" (sirf jab institute ka naam ho).
- Owner Panel -> Branding & Plan: naya checkbox `hidePoweredBy` (sirf Owner). Rules me badlaav nahi (Owner pehle se institutes likh sakta hai).
- Result sheet ka brand block (logo/naam/tagline) aur WhatsApp result/reminder text me "SnapTest Pro" ki jagah institute ka naam (`SnapBrand.rsf/plain`). Institute na ho to purana "सव्यसाची" block jaisa tha waisa.
- Booklet aur 4-column print: upar ek patli brand patti (logo + naam, "Powered by" usi me). Layout/fonts nahi chhede.
- Kill-switch `SNAP_CONFIG.branding2=false`. Version 1.4.16 / build 221. Tests: `test_branding2_v221.js`. Details: `docs/notes/PHASE4A_BRANDING_v221_NOTES.md`.

## 2026-10-17 — v220 Phase 3B: Demo Institute

- Naya `owner-demo.js`: Owner Panel (Settings) me "Demo banao" / "Demo reset". `isDemo:true` institute `demo_sample`: 20 students (nakli mobile, login nahi), 2 batches (YouTube items), 2 tests, 40 results. Fixed IDs; reset sirf demo data hataata hai.
- Demo institute dashboard totals / recount / limit alerts me nahi ginta; card par DEMO badge.
- `firestore.rules`: Owner ko sirf `isDemo` students/tests(+qchunks)/studentRecords aur demo institute ke batch-tree par likhne/hatane ki ijazat. Tests: `test_demo_v220.js`, 7 naye rules test (chalaya nahi).
- Version 1.4.15 / build 220. Kill-switch `SNAP_CONFIG.demo`. Details: `docs/notes/PHASE3B_DEMO_v220_NOTES.md`.

## 2026-10-17 — v219 Phase 3A: Institute onboarding wizard + Drive status

- Naya `owner-wizard.js`: Owner Panel "Naya Institute" ab 6-step wizard (Basics, Branding + preview, Fair-use tier, YouTube, Drive sujhaav, Summary + app link). Maujooda institute fields hi likhta hai; billing nahi.
- Institute card par Branding/Drive/YouTube status chips (pehle se loaded data).
- `SnapDrive`: `status/connect/disconnect/folderUrl`. Firestore me sirf `driveConnected` + `driveEmail`, token kabhi nahi. Admin Panel me "Setup adhoora" banner aur Institute Settings me "Mera Storage" card.
- `driveRequired` (default false): true + Client ID set hone par hi Drive na jure institute ka file upload band.
- `firestore.rules`: admin apne institute ka Drive status (email format check). Tests: `test_onboarding_v219.js`, 5 naye rules test (chalaya nahi).
- `docs/setup/DRIVE_SETUP_HINDI.md`, `scripts/build-www.js` owner list fix. Version 1.4.14 / build 219. Kill-switch `SNAP_CONFIG.onboarding`.

## 2026-10-17 — v218 Phase 2: Catalog (student reads kam)

- Naya `batch-catalog.js`: har batch ke published items ka compact catalog `institutes/{i}/batches/{b}/catalog/c1,c2…` (max 300 entries/doc, koi link nahi).
- Student batch-open pehle catalog padhta hai (1-5 reads); poora item (link/file) tabhi aata hai jab kholta/join karta hai. Catalog na ho to purana tareeka.
- Admin ka koi bhi badlaav (`loadAll` se guzarne wala: item, subject, chapter, import, bulk) catalog ko apne-aap match karta hai (hash se, sirf badle docs likhte hain). Institute Settings me "Catalog dobara banayein".
- `read-diet.js`: catalog write par `c_<batch>` version bump (admin ka items-cache nahi chhedta). `firestore.rules`: `catalog/{id}`. Kill-switch `SNAP_CONFIG.catalog`.
- Version 1.4.13 / build 218. Details: `docs/notes/PHASE2_CATALOG_v218_NOTES.md`. Rules dobara Publish karne honge; emulator test chalaya nahi gaya.

## 2026-10-17 — v217 Phase 1: YouTube Live (embed, attendance, recording, bulk paste)

- Go Live: `prompt()` ki jagah form; sirf 11-char `ytId` save (`youtube.com/live/ID`, `watch?v=ID`, `youtu.be/ID`).
- Student Join: `youtube-nocookie.com` embed app ke andar + "YouTube me kholein" fallback. Attendance purane `EXT.hooks.join` se (koi naya system nahi).
- End Class: `ytId` se recording item `ready` (unpublished) banta hai; admin dekhkar Publish kare.
- Naya admin view "Bulk YouTube Add" (`link | title | subject | chapter`, preview, 400 ke chunks me write, oEmbed se title best-effort).
- Institute Settings: `youtubeChannelUrl` (rules me sirf https youtube.com) + student dashboard par channel link (SnapBrand cache se, naya read nahi) + unlisted-link note.
- Kill-switch: `SNAP_CONFIG.youtubeLive=false` -> Phase 0 wala link-prompt. Version 1.4.12 / build 217.
- Deploy: `firestore.rules` dobara Publish karna hoga. Emulator test (`npm run test:rules`) chalaya nahi gaya.

## 2026-10-17 — v216 Phase 0: SnapLive hataya, live = sirf YouTube link

- Hataya: `own-live.js` (poori file), uska `<script>` (`index.html`), `sw.js` precache entry, `snapLive` flag (`app-config.js`), SnapLive CSS (`batch-system.css`), SnapLive ke `chat`/`hands` Firestore rules, Worker ka `handleLive` + `/live/*` route aur uske helper.
- `batch-system.js`: class form se SnapLive aur Jitsi (`inapp`) option hata; naya class hamesha link wali (`external`). Purani `inapp` live class dekhne ka raasta (`joinLive`) rakha; purani `own` class/recording par saaf message.
- `SnapFiles` (R2 `files/`) abhi **deprecated** mark: code rakha, `ownFiles:false`. R2 binding `LIVE_R2` Worker me SnapFiles ke liye rakhi hai.
- Version 1.4.11 / build 216. Details: `docs/notes/PHASE0_SNAPLIVE_REMOVAL_v216_NOTES.md`.
- Deploy nahi hua: web, Worker aur Firestore rules alag se deploy karne honge.

## 2026-10-15 — Phases 6–10 engineering pass

- Added required registration consent capture, Privacy/Terms pages, public deletion page, and authenticated student/institute-admin deletion in the canonical Worker.
- Moved historical `*_NOTES.md` and release notes to `docs/notes/`; moved setup guides to `docs/setup/`.
- Split the student question bank into class/subject chunks, added lazy loading and IndexedDB caching, standardized Worker sources and CI, and added secret scanning.
- Extracted inline CSS/JavaScript and introduced tested module facades and data-model/contributor documentation. The large legacy core is only partly formatted and modularized.
- Added labeled/zoom-friendly UI markup, static accessibility checks, axe/Lighthouse CI for seven screens, keyboard/mobile checks, and an accessibility score gate of 90. The local score is not measured because the local runner could not install the browser-audit packages or serve localhost.
- Added web/native App Check bootstrap, custom-role claims with email fallback, bounded result-page reads, error-report scrubbing, API-key guidance, Firestore limit documentation, and a dry-run-only-by-default export/restore drill.
- Bumped web app metadata to 1.4.5/build 195. Firebase Console provider setup/enforcement, API-key restrictions, custom-claim migration, native APK build, and an actual staging restore remain external operator steps; see [`AUDIT_RESULT.md`](../AUDIT_RESULT.md).
- All work remains local; no web, Android or Worker deployment was performed.

## Historical releases

Older release notes are preserved under [`docs/notes/`](notes/). They describe the code at the time they were written; check the current guides before using any deployment steps.
