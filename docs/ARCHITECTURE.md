# Architecture

**Chart (image):** `docs/diagrams/SYSTEM_MAP.png` (kaun si app kis service se judti hai) aur `docs/diagrams/DATA_MAP.png` (kaun sa data kahan). PDF bhi wahin. Dobara banane ke liye: `python3 scripts/make-diagrams.py` (matplotlib chahiye).

The Vishnu Sharma is a vanilla JavaScript PWA served from GitHub Pages and packaged for Android with Capacitor. Firebase provides Auth, Firestore and Storage; `push-worker/worker.js` is the canonical Cloudflare Worker for bank publishing, push, owner alerts and account deletion.

## Main app loading order

`index.html` loads the Firebase SDKs and app config, then classic scripts for the student/admin app: `script.js`, admin settings, upgrade/update helpers, student features, session, batch tools, file/drive support, OMR, push, offline sync, UI and settings. `modules/app.mjs` is loaded as an ES module after the classic app scripts; it imports the chunked question-bank module and exposes the `window.SnapModules` adapters. The ten extracted classic inline scripts and four style blocks are under `inline/` and remain at their former HTML positions.

The complete ordered list is in `index.html`; update this summary when adding or reordering a script. Other entry pages are `owner-app.html` and `question-generator.html`.

## Source and module status

- `script.js` is an inherited global-state core. Its longest 29,882-character line was split at statement boundaries and syntax-checked. It is still not fully formatted or separated into isolated domain implementations.
- `modules/bank-chunks.mjs` is the first extracted ES module and exports `loadSubject`, `loadAll`, and `getIndex`.
- `modules/legacy-modules.mjs` exports domain facades for auth, tests, results, bank, OMR, admin, student and utilities. `modules/legacy-bridge.mjs` is the compatibility boundary for classic global functions and lexical state.
- `docs/MODULES.md` records which implementation remains legacy and how to migrate another domain without breaking inline handlers.

## Build and deployment

- `scripts/build-www.js` builds the student/admin Capacitor web bundle in `www/`; the owner APK uses a separate file allowlist.
- `sw.js` caches the legal pages, extracted assets, app shell and small question-bank manifest. The large question chunks are fetched on demand and cached in IndexedDB.
- Deploy the Worker separately from `push-worker/worker.js`. This repository task does not deploy web, Android or Worker builds.
