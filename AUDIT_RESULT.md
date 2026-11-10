# Phase 6–10 audit result

Date: 2026-10-15. Scope: local source review of the extracted SnapTest Pro project. The original download ZIP was not edited. No production website, APK, Firebase rules or Worker was deployed.

## Fixed in this source tree

- **Phase 6 — Privacy/data deletion:** consent capture and policy pages, deletion UI/Worker flow, metadata and Play data-safety documentation. Earlier unit evidence: 17/17 phase tests and 12 Worker tests passed. The Firestore emulator was unavailable locally.
- **Phase 7 — Maintenance/question bank:** historical/setup documentation moved, changelog and stale-guide markings, canonical Worker source, duplicate removal supported by references, secrets scan, and exact split of 7,695 question records into class/subject chunks. Earlier evidence: 20/20 tests and secret scan passed.
- **Phase 9 — Accessibility foundation:** 97 static labels associated, zoom is enabled, page heading/navigation and iframe/floating-control names added, and a CI job now scans login, student dashboard, test, result, admin dashboard, admin settings and student settings. Static markup check passed.
- **Phase 10 — Local implementation:** App Check bootstrap and Capacitor plugin dependency, server-issued `snapRole` rules/migration script, 100-document cursor page helper for student history, telemetry redaction, API-key guidance, Firestore read-bound guide, and a dry-run-first backup/restore script. App Check, scrubber and backup-safety unit tests passed.
- **Build and repository checks:** `npm test` passed 25/25; `node scripts/build-www.js` copied 154 files and disabled website SW registration in the Android app copy; precache check passed for 93 entries; static accessibility check passed; secret scan found no configured private-key/token patterns; version stamp check passed at 1.4.5/build 195.

## Partial or deferred

- **Phase 8 — Full module migration/formatting:** inline assets and bank loading are real modules, and domain facades are tested. Most auth, test, result, OMR, admin and student implementation still lives in classic scripts, and the full legacy `script.js` formatter/domain extraction is unfinished. See `docs/MODULES.md`.
- **Phase 9 — Actual browser scores:** axe and Lighthouse automation is installed in CI with a Lighthouse accessibility threshold of 90, but no CI run was available in this local task. The local npm package install stalled without network access; the browser runner also received `ERR_NETWORK_ACCESS_DENIED` for localhost. **Lighthouse score: not measured.** The accessibility CI job must pass before claiming the score target.
- **App Check rollout:** provider initialization is wired for reCAPTCHA v3 on web and native Play Integrity, but `appCheck.webSiteKey` is blank. Firebase Console registration/monitoring and staged enforcement are not active. Worker APIs also need their own server-side App Check token verification before they can be described as protected.
- **Custom claims:** rules, migration utility and emulator cases are committed in source, but the claim migration was not run against Firebase. The Firebase Emulator rules suite was not run locally.
- **API-key restrictions:** safe review instructions are present; Google Cloud Console restrictions were not inspected or changed.
- **Backup recovery:** dry-run and destination-safety checks passed. No Cloud export/import or staging restore drill was run; Firestore and GCS project credentials were not available here.
- **Native app verification:** no Android `cap sync`, APK build or Play Integrity attestation was run after adding the plugin. The current app uses Capacitor 6; the matching plugin line is documented as deprecated and needs a coordinated major upgrade later.
- **Telemetry privacy:** tests cover emails, Indian mobile numbers, bearer/JWT tokens, API keys and labeled student/credential fields. Arbitrary unstructured user text can still include identifying information; keep such content out of `SnapAlert.report` calls.

## Operator steps to close deferred items

1. Add the public reCAPTCHA site key and register the web/Android providers in Firebase App Check; observe metrics before enforcing one product at a time.
2. Run the accessibility CI job and fix every reported issue until Lighthouse accessibility is at least 90 and the configured axe checks pass.
3. Run the Admin claims utility in dry-run mode, review the accounts/project, then run `--apply --confirm-project=...`; first confirm the Firestore rules emulator suite passes.
4. Review API key restrictions in Google Cloud Console with a test key, keeping the Firebase web and Android key use cases intact.
5. Build and inspect an internal Android APK, then execute the backup drill with a separate staging Firebase project and private GCS bucket.
